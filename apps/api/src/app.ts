import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import Fastify from 'fastify';
import {
  authenticatedSessionSchema,
  healthResponseSchema,
  invitationAcceptRequestSchema,
  invitationRequestSchema,
  loginRequestSchema,
  memberRoleUpdateRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  workspaceCreateRequestSchema,
  workspaceUpdateRequestSchema,
} from '@promaly/contracts';
import type { AppConfig } from '@promaly/config';
import { createDatabaseClient, type DatabaseClient } from '@promaly/db';
import {
  AuthenticationError,
  ConflictError,
  createIdentityService,
  PasswordResetError,
  type IdentityService,
} from './identity.js';
import { createPrincipalPreHandler, requireCapability } from './principal.js';
import {
  createTenancyService,
  InvitationAcceptanceError,
  LastOwnerError,
  TenancyNotFoundError,
  type TenancyService,
} from './tenancy.js';

type ReadinessChecks = {
  database: () => Promise<void>;
  objectStorage: () => Promise<void>;
  close: () => Promise<void>;
};

type AppDependencies = {
  readinessChecks: ReadinessChecks;
  identity: IdentityService | undefined;
  tenancy?: TenancyService | undefined;
};

export type MetricsState = {
  startedAt: bigint;
  requestCount: number;
};

export function createMetricsState(): MetricsState {
  return { startedAt: process.hrtime.bigint(), requestCount: 0 };
}

function metricsBody(metrics: MetricsState) {
  const uptimeSeconds = Number(process.hrtime.bigint() - metrics.startedAt) / 1_000_000_000;
  return [
    '# HELP promaly_process_uptime_seconds Time elapsed since the API process started.',
    '# TYPE promaly_process_uptime_seconds gauge',
    `promaly_process_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
    '# HELP promaly_http_requests_total Requests handled by this API process.',
    '# TYPE promaly_http_requests_total counter',
    `promaly_http_requests_total ${metrics.requestCount}`,
    '',
  ].join('\n');
}

export function buildMetricsApp(config: AppConfig, metrics = createMetricsState()) {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.authorization'] },
  });
  app.get('/metrics', async (request, reply) => {
    if (config.metricsToken && request.headers.authorization !== `Bearer ${config.metricsToken}`) {
      return reply.code(401).send({ error: 'Metrics authentication is required.' });
    }

    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(metricsBody(metrics));
  });
  return app;
}

function createAppDependencies(config: AppConfig): AppDependencies {
  const database: DatabaseClient | undefined = config.databaseUrl
    ? createDatabaseClient(config.databaseUrl)
    : undefined;

  return {
    identity: database ? createIdentityService(database) : undefined,
    tenancy: database ? createTenancyService(database) : undefined,
    readinessChecks: {
      async database() {
        if (!database) {
          throw new Error('DATABASE_URL is not configured');
        }

        await database.healthcheck();
      },
      async objectStorage() {
        if (!config.s3Endpoint) {
          throw new Error('S3_ENDPOINT is not configured');
        }

        const endpoint = new URL('/minio/health/live', config.s3Endpoint);
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(2_000) });

        if (!response.ok) {
          throw new Error(`Object storage returned HTTP ${response.status}`);
        }
      },
      async close() {
        await database?.close();
      },
    },
  };
}

function requestMetadata(request: { ip: string; headers: { 'user-agent'?: string | undefined } }) {
  const metadata: { ipAddress: string; userAgent?: string } = { ipAddress: request.ip };
  const userAgent = request.headers['user-agent'];

  if (userAgent) {
    metadata.userAgent = userAgent;
  }

  return metadata;
}

export function buildApp(
  config: AppConfig,
  dependencies = createAppDependencies(config),
  metrics = createMetricsState(),
) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        '*.password',
        '*.token',
      ],
    },
    genReqId: () => randomUUID(),
  });
  const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  };
  const requireCsrf = (
    request: Parameters<typeof app.csrfProtection>[0],
    reply: Parameters<typeof app.csrfProtection>[1],
    done: Parameters<typeof app.csrfProtection>[2],
  ) => app.csrfProtection(request, reply, done);
  const currentSession = async (request: { cookies: { promaly_session?: string } }) => {
    const token = request.cookies.promaly_session;
    return token && dependencies.identity ? dependencies.identity.getSession(token) : null;
  };
  const tenancyFailure = (
    error: unknown,
    reply: { code: (status: number) => { send: (body: object) => unknown } },
  ) => {
    if (error instanceof TenancyNotFoundError)
      return reply.code(404).send({ error: error.message });
    if (error instanceof LastOwnerError || error instanceof ConflictError) {
      return reply.code(409).send({ error: error.message });
    }
    if (error instanceof InvitationAcceptanceError)
      return reply.code(400).send({ error: error.message });
    throw error;
  };

  void app.register(cookie);
  void app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
  });
  void app.register(csrfProtection, {
    cookieOpts: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      path: '/',
    },
    getToken: (request) => request.headers['x-csrf-token'] as string | undefined,
  });
  void app.register(rateLimit, { global: false });
  void app.register(underPressure, {
    maxEventLoopDelay: 1_000,
    maxHeapUsedBytes: 512 * 1024 * 1024,
    maxRssBytes: 768 * 1024 * 1024,
  });

  // Workspace authorization spine. Routes that operate inside a workspace add
  // `app.requireWorkspace` (resolves `request.principal`) then a
  // `requireCapability(...)` preHandler.
  app.decorateRequest('principal', undefined);
  app.decorate('requireWorkspace', createPrincipalPreHandler(dependencies.identity));

  app.addHook('onResponse', async (request) => {
    if (request.routeOptions.url !== '/metrics') {
      metrics.requestCount += 1;
    }
  });
  app.addHook('onClose', async () => {
    await dependencies.readinessChecks.close();
  });

  app.get('/healthz', async () =>
    healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/readyz', async (_request, reply) => {
    try {
      if (app.isUnderPressure()) {
        return reply.code(503).send({ status: 'not_ready', reason: 'Service is under pressure' });
      }
      await dependencies.readinessChecks.database();
      await dependencies.readinessChecks.objectStorage();
      return { status: 'ready' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown readiness failure';
      return reply.code(503).send({ status: 'not_ready', reason });
    }
  });

  app.get('/v1/auth/csrf', async (_request, reply) => {
    return { csrfToken: reply.generateCsrf() };
  });

  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, onRequest: requireCsrf },
    async (request, reply) => {
      if (!dependencies.identity)
        return reply.code(503).send({ error: 'Identity is not configured.' });
      const input = registerRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid registration input.' });

      try {
        const result = await dependencies.identity.register(input.data, requestMetadata(request));
        reply.setCookie('promaly_session', result.token.value, {
          ...sessionCookie,
          expires: result.token.expiresAt,
        });
        return reply.code(201).send(authenticatedSessionSchema.parse(result));
      } catch (error) {
        if (error instanceof ConflictError) return reply.code(409).send({ error: error.message });
        throw error;
      }
    },
  );

  app.post(
    '/v1/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      onRequest: requireCsrf,
    },
    async (request, reply) => {
      if (!dependencies.identity)
        return reply.code(503).send({ error: 'Identity is not configured.' });
      const input = loginRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid login input.' });

      try {
        const result = await dependencies.identity.login(input.data, requestMetadata(request));
        reply.setCookie('promaly_session', result.token.value, {
          ...sessionCookie,
          expires: result.token.expiresAt,
        });
        return authenticatedSessionSchema.parse(result);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply.code(401).send({ error: 'Invalid email or password.' });
        }
        throw error;
      }
    },
  );

  app.post('/v1/auth/logout', { onRequest: requireCsrf }, async (request, reply) => {
    const token = request.cookies.promaly_session;
    if (token && dependencies.identity) await dependencies.identity.logout(token);
    reply.clearCookie('promaly_session', { path: '/' });
    return reply.code(204).send();
  });

  app.delete('/v1/auth/sessions', { onRequest: requireCsrf }, async (request, reply) => {
    const session = await currentSession(request);
    if (!session || !dependencies.identity) {
      return reply.code(401).send({ error: 'Authentication is required.' });
    }
    await dependencies.identity.logoutAll(session.account.id);
    reply.clearCookie('promaly_session', { path: '/' });
    return reply.code(204).send();
  });

  app.post(
    '/v1/auth/password-reset',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, onRequest: requireCsrf },
    async (request, reply) => {
      const input = passwordResetRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid password reset input.' });
      if (dependencies.identity) await dependencies.identity.requestPasswordReset(input.data.email);
      return reply.code(202).send();
    },
  );

  app.post('/v1/auth/password-reset/:token', { onRequest: requireCsrf }, async (request, reply) => {
    const input = passwordResetConfirmSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'Invalid password reset input.' });
    const token = (request.params as { token?: string }).token;
    if (!token || !dependencies.identity)
      return reply.code(400).send({ error: 'Invalid password reset link.' });
    try {
      await dependencies.identity.resetPassword(token, input.data.password);
      reply.clearCookie('promaly_session', { path: '/' });
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof PasswordResetError)
        return reply.code(400).send({ error: error.message });
      throw error;
    }
  });

  app.get('/v1/auth/me', async (request, reply) => {
    const token = request.cookies.promaly_session;
    const session =
      token && dependencies.identity ? await dependencies.identity.getSession(token) : null;
    if (!session) return reply.code(401).send({ error: 'Authentication is required.' });
    return authenticatedSessionSchema.parse(session);
  });

  app.post('/v1/workspaces', { onRequest: requireCsrf }, async (request, reply) => {
    const input = workspaceCreateRequestSchema.safeParse(request.body);
    const session = await currentSession(request);
    if (!session) return reply.code(401).send({ error: 'Authentication is required.' });
    if (!input.success) return reply.code(400).send({ error: 'Invalid workspace input.' });
    if (!dependencies.tenancy) return reply.code(503).send({ error: 'Tenancy is not configured.' });
    try {
      const workspace = await dependencies.tenancy.createWorkspace(
        session.account.id,
        input.data,
        requestMetadata(request),
      );
      return reply.code(201).send(workspace);
    } catch (error) {
      return tenancyFailure(error, reply);
    }
  });

  app.patch(
    '/v1/workspaces/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('workspace.settings')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = workspaceUpdateRequestSchema.safeParse(request.body);
      if (!id || request.principal?.workspaceId !== id)
        return reply.code(404).send({ error: 'Workspace not found.' });
      if (!input.success) return reply.code(400).send({ error: 'Invalid workspace input.' });
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      try {
        return await dependencies.tenancy.updateWorkspace(
          id,
          request.principal.accountId,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/workspaces/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('workspace.transfer')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || request.principal?.workspaceId !== id)
        return reply.code(404).send({ error: 'Workspace not found.' });
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      try {
        await dependencies.tenancy.deleteWorkspace(id, request.principal.accountId);
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/invitations',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('member.manage')],
    },
    async (request, reply) => {
      const input = invitationRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid invitation input.' });
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      const invitation = await dependencies.tenancy.createInvitation(
        request.principal.workspaceId,
        request.principal.accountId,
        input.data.email,
        input.data.role,
        requestMetadata(request),
      );
      return reply.code(201).send({ ...invitation, expiresAt: invitation.expiresAt.toISOString() });
    },
  );

  app.get(
    '/v1/invitations',
    { preHandler: [app.requireWorkspace, requireCapability('member.manage')] },
    async (request, reply) => {
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      const invitations = await dependencies.tenancy.listInvitations(request.principal.workspaceId);
      return invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
      }));
    },
  );

  app.delete(
    '/v1/invitations/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('member.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.tenancy || !request.principal)
        return reply.code(400).send({ error: 'Invalid invitation.' });
      try {
        await dependencies.tenancy.revokeInvitation(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post('/v1/invitations/:token/accept', { onRequest: requireCsrf }, async (request, reply) => {
    const input = invitationAcceptRequestSchema.safeParse(request.body);
    const token = (request.params as { token?: string }).token;
    if (!input.success || !token)
      return reply.code(400).send({ error: 'Invalid invitation acceptance input.' });
    if (!dependencies.tenancy) return reply.code(503).send({ error: 'Tenancy is not configured.' });
    const session = await currentSession(request);
    try {
      return reply
        .code(201)
        .send(
          await dependencies.tenancy.acceptInvitation(
            token,
            session?.account.id,
            input.data.password,
            requestMetadata(request),
          ),
        );
    } catch (error) {
      return tenancyFailure(error, reply);
    }
  });

  app.get('/v1/members', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.tenancy || !request.principal)
      return reply.code(503).send({ error: 'Tenancy is not configured.' });
    const members = await dependencies.tenancy.listMembers(request.principal.workspaceId);
    return members.map((member) => ({ ...member, joinedAt: member.joinedAt.toISOString() }));
  });

  app.patch(
    '/v1/members/:accountId',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('member.manage')],
    },
    async (request, reply) => {
      const input = memberRoleUpdateRequestSchema.safeParse(request.body);
      const accountId = (request.params as { accountId?: string }).accountId;
      if (!input.success || !accountId)
        return reply.code(400).send({ error: 'Invalid member input.' });
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      try {
        await dependencies.tenancy.updateMemberRole(
          request.principal.workspaceId,
          request.principal.accountId,
          accountId,
          input.data.role,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/members/:accountId',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('member.manage')],
    },
    async (request, reply) => {
      const accountId = (request.params as { accountId?: string }).accountId;
      if (!accountId || !dependencies.tenancy || !request.principal)
        return reply.code(400).send({ error: 'Invalid member.' });
      try {
        await dependencies.tenancy.removeMember(
          request.principal.workspaceId,
          request.principal.accountId,
          accountId,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/workspaces/:id/leave',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || request.principal?.workspaceId !== id)
        return reply.code(404).send({ error: 'Workspace not found.' });
      if (!dependencies.tenancy || !request.principal)
        return reply.code(503).send({ error: 'Tenancy is not configured.' });
      try {
        await dependencies.tenancy.removeMember(
          id,
          request.principal.accountId,
          request.principal.accountId,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  return app;
}

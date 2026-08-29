import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import underPressure from '@fastify/under-pressure';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import {
  authenticatedSessionSchema,
  healthResponseSchema,
  invitationAcceptRequestSchema,
  invitationRequestSchema,
  issueBulkRequestSchema,
  issueCreateRequestSchema,
  issueMoveRequestSchema,
  issueRelationCreateRequestSchema,
  issueUpdateRequestSchema,
  labelCreateRequestSchema,
  labelUpdateRequestSchema,
  loginRequestSchema,
  memberRoleUpdateRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  projectCreateRequestSchema,
  projectUpdateRequestSchema,
  teamCreateRequestSchema,
  teamMemberRequestSchema,
  teamUpdateRequestSchema,
  workflowCreateRequestSchema,
  workflowStateCreateRequestSchema,
  workflowStateReorderRequestSchema,
  workflowStateUpdateRequestSchema,
  workflowUpdateRequestSchema,
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
  createIssuesService,
  IssueRelationError,
  RevisionConflictError,
  type IssuesService,
} from './issues.js';
import {
  createProjectManagementService,
  ProjectKeyLockedError,
  type ProjectManagementService,
  WorkflowInvariantError,
} from './project-management.js';
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
  projectManagement?: ProjectManagementService | undefined;
  issues?: IssuesService | undefined;
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
    projectManagement: database ? createProjectManagementService(database) : undefined,
    issues: database ? createIssuesService(database) : undefined,
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

export async function buildApp(
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
    if (
      error instanceof LastOwnerError ||
      error instanceof ConflictError ||
      error instanceof WorkflowInvariantError ||
      error instanceof ProjectKeyLockedError ||
      error instanceof RevisionConflictError ||
      error instanceof IssueRelationError
    ) {
      return reply.code(409).send({ error: error.message });
    }
    if (error instanceof InvitationAcceptanceError)
      return reply.code(400).send({ error: error.message });
    throw error;
  };
  const page = (query: { cursor?: string; limit?: string }) => {
    const requested = Number(query.limit ?? 50);
    return {
      cursor: query.cursor,
      limit: Number.isInteger(requested) ? Math.max(1, Math.min(100, requested)) : 50,
    };
  };
  const ifMatch = (request: { headers: { 'if-match'?: string | undefined } }) => {
    const revision = Number(request.headers['if-match']);
    return Number.isInteger(revision) && revision > 0 ? revision : undefined;
  };

  // Registrations are awaited: @fastify/rate-limit only wires its hooks once it
  // has finished loading, so `void register(...)` silently disables it.
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy:
      config.nodeEnv === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'none'"],
              connectSrc: ["'self'"],
              imgSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
            },
          }
        : { directives: { defaultSrc: ["'none'"] } },
  });
  await app.register(csrfProtection, {
    cookieOpts: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      path: '/',
    },
    getToken: (request) => request.headers['x-csrf-token'] as string | undefined,
  });
  // Global baseline; auth routes tighten it with per-route `config.rateLimit`.
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(underPressure, {
    maxEventLoopDelay: 1_000,
    maxHeapUsedBytes: 512 * 1024 * 1024,
    maxRssBytes: 768 * 1024 * 1024,
  });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Promaly API', version: 'v1' },
      servers: [{ url: '/v1', description: 'Same-origin API' }],
    },
  });
  // Docker copies the Vite build here; API tests and local API development do
  // not require static assets to exist.
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  const servesWeb = config.nodeEnv === 'production' && existsSync(webDist);
  if (servesWeb) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
  }

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

  app.get('/healthz', { config: { rateLimit: false } }, async () =>
    healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    }),
  );
  app.get('/v1/openapi.json', { config: { rateLimit: false } }, async () => app.swagger());

  app.get('/readyz', { config: { rateLimit: false } }, async (_request, reply) => {
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
        const result = await dependencies.identity.login(
          input.data,
          requestMetadata(request),
          request.cookies.promaly_session,
        );
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

  app.post(
    '/v1/auth/password-reset/:token',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, onRequest: requireCsrf },
    async (request, reply) => {
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
    },
  );

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
    if (!dependencies.tenancy || !dependencies.identity)
      return reply.code(503).send({ error: 'Tenancy is not configured.' });
    const session = await currentSession(request);
    try {
      const result = await dependencies.tenancy.acceptInvitation(
        token,
        session?.account.id,
        input.data.password,
        requestMetadata(request),
      );
      // Log the accepting account in (new or existing) so it lands inside the workspace.
      const authed = await dependencies.identity.startSession(
        result.accountId,
        requestMetadata(request),
      );
      reply.setCookie('promaly_session', authed.token.value, {
        ...sessionCookie,
        expires: authed.token.expiresAt,
      });
      return reply.code(201).send(authenticatedSessionSchema.parse(authed));
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
      // Granting `owner` is ownership transfer, not member management.
      if (input.data.role === 'owner' && !request.principal.can('workspace.transfer')) {
        return reply.code(403).send({ error: 'Only an owner can grant the owner role.' });
      }
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

  app.post(
    '/v1/teams',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const input = teamCreateRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid team input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.projectManagement.createTeam(
              request.principal.workspaceId,
              request.principal.accountId,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get(
    '/v1/teams',
    { preHandler: [app.requireWorkspace, requireCapability('project.manage')] },
    async (request, reply) => {
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      const query = request.query as { cursor?: string; limit?: string };
      return dependencies.projectManagement.listTeams(
        request.principal.workspaceId,
        page(query).cursor,
        page(query).limit,
      );
    },
  );

  app.get(
    '/v1/teams/:id',
    { preHandler: [app.requireWorkspace, requireCapability('project.manage')] },
    async (request, reply) => {
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return await dependencies.projectManagement.getTeam(
          request.principal.workspaceId,
          (request.params as { id: string }).id,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.patch(
    '/v1/teams/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = teamUpdateRequestSchema.safeParse(request.body);
      if (!id || !input.success) return reply.code(400).send({ error: 'Invalid team input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return await dependencies.projectManagement.updateTeam(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/teams/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid team.' });
      try {
        await dependencies.projectManagement.deleteTeam(
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

  app.get(
    '/v1/teams/:id/members',
    { preHandler: [app.requireWorkspace, requireCapability('project.manage')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid team.' });
      try {
        return await dependencies.projectManagement.listTeamMembers(
          request.principal.workspaceId,
          id,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/teams/:id/members',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = teamMemberRequestSchema.safeParse(request.body);
      if (!id || !input.success || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid team member input.' });
      try {
        await dependencies.projectManagement.addTeamMember(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data.accountId,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/teams/:id/members/:accountId',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const { id, accountId } = request.params as { id?: string; accountId?: string };
      if (!id || !accountId || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid team member.' });
      try {
        await dependencies.projectManagement.removeTeamMember(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          accountId,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/workflows', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.projectManagement || !request.principal)
      return reply.code(503).send({ error: 'Project management is not configured.' });
    const query = request.query as { cursor?: string; limit?: string };
    const pagination = page(query);
    return dependencies.projectManagement.listWorkflows(
      request.principal.workspaceId,
      pagination.cursor,
      pagination.limit,
    );
  });

  app.get('/v1/workflows/:id', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.projectManagement || !request.principal)
      return reply.code(503).send({ error: 'Project management is not configured.' });
    try {
      return await dependencies.projectManagement.getWorkflow(
        request.principal.workspaceId,
        (request.params as { id: string }).id,
      );
    } catch (error) {
      return tenancyFailure(error, reply);
    }
  });

  app.post(
    '/v1/workflows',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const input = workflowCreateRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid workflow input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.projectManagement.createWorkflow(
              request.principal.workspaceId,
              request.principal.accountId,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.patch(
    '/v1/workflows/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = workflowUpdateRequestSchema.safeParse(request.body);
      if (!id || !input.success) return reply.code(400).send({ error: 'Invalid workflow input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return await dependencies.projectManagement.updateWorkflow(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/workflows/:id/states',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = workflowStateCreateRequestSchema.safeParse(request.body);
      if (!id || !input.success)
        return reply.code(400).send({ error: 'Invalid workflow state input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.projectManagement.createWorkflowState(
              request.principal.workspaceId,
              request.principal.accountId,
              id,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.patch(
    '/v1/workflows/:workflowId/states/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const { workflowId, id } = request.params as { workflowId?: string; id?: string };
      const input = workflowStateUpdateRequestSchema.safeParse(request.body);
      if (!workflowId || !id || !input.success)
        return reply.code(400).send({ error: 'Invalid workflow state input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return await dependencies.projectManagement.updateWorkflowState(
          request.principal.workspaceId,
          request.principal.accountId,
          workflowId,
          id,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/workflows/:workflowId/states/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const { workflowId, id } = request.params as { workflowId?: string; id?: string };
      if (!workflowId || !id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid workflow state.' });
      try {
        await dependencies.projectManagement.deleteWorkflowState(
          request.principal.workspaceId,
          request.principal.accountId,
          workflowId,
          id,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/workflows/:id/states/reorder',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = workflowStateReorderRequestSchema.safeParse(request.body);
      if (!id || !input.success)
        return reply.code(400).send({ error: 'Invalid workflow state order.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        await dependencies.projectManagement.reorderWorkflowStates(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data.stateIds,
          requestMetadata(request),
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/projects',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const input = projectCreateRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid project input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.projectManagement.createProject(
              request.principal.workspaceId,
              request.principal.accountId,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/projects', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.projectManagement || !request.principal)
      return reply.code(503).send({ error: 'Project management is not configured.' });
    const query = request.query as { cursor?: string; limit?: string; includeArchived?: string };
    const pagination = page(query);
    return dependencies.projectManagement.listProjects(request.principal.workspaceId, {
      ...pagination,
      includeArchived: query.includeArchived === 'true',
    });
  });

  app.get('/v1/projects/:id', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.projectManagement || !request.principal)
      return reply.code(503).send({ error: 'Project management is not configured.' });
    try {
      return await dependencies.projectManagement.getProject(
        request.principal.workspaceId,
        (request.params as { id: string }).id,
      );
    } catch (error) {
      return tenancyFailure(error, reply);
    }
  });

  app.patch(
    '/v1/projects/:id',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = projectUpdateRequestSchema.safeParse(request.body);
      if (!id || !input.success) return reply.code(400).send({ error: 'Invalid project input.' });
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return await dependencies.projectManagement.updateProject(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/projects/:id/archive',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid project.' });
      try {
        return await dependencies.projectManagement.setProjectArchived(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          true,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/projects/:id/unarchive',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('project.manage')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid project.' });
      try {
        return await dependencies.projectManagement.setProjectArchived(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          false,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  // Shared labels are workspace configuration (`project.manage`). Project-scoped
  // labels are issue metadata, so members with `issue.edit` may maintain them.
  app.post(
    '/v1/labels',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace] },
    async (request, reply) => {
      const input = labelCreateRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid label input.' });
      if (!request.principal?.can(input.data.projectId ? 'issue.edit' : 'project.manage')) {
        return reply.code(403).send({ error: 'You do not have this capability.' });
      }
      if (!dependencies.projectManagement || !request.principal)
        return reply.code(503).send({ error: 'Project management is not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.projectManagement.createLabel(
              request.principal.workspaceId,
              request.principal.accountId,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/labels', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.projectManagement || !request.principal)
      return reply.code(503).send({ error: 'Project management is not configured.' });
    const query = request.query as { cursor?: string; limit?: string };
    const pagination = page(query);
    return dependencies.projectManagement.listLabels(
      request.principal.workspaceId,
      pagination.cursor,
      pagination.limit,
    );
  });

  app.patch(
    '/v1/labels/:id',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = labelUpdateRequestSchema.safeParse(request.body);
      if (!id || !input.success || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid label input.' });
      try {
        const label = await dependencies.projectManagement.getLabel(
          request.principal.workspaceId,
          id,
        );
        if (!request.principal.can(label.projectId ? 'issue.edit' : 'project.manage'))
          return reply.code(403).send({ error: 'You do not have this capability.' });
        return await dependencies.projectManagement.updateLabel(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          input.data,
          requestMetadata(request),
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/labels/:id',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.projectManagement || !request.principal)
        return reply.code(400).send({ error: 'Invalid label.' });
      try {
        const label = await dependencies.projectManagement.getLabel(
          request.principal.workspaceId,
          id,
        );
        if (!request.principal.can(label.projectId ? 'issue.edit' : 'project.manage'))
          return reply.code(403).send({ error: 'You do not have this capability.' });
        await dependencies.projectManagement.deleteLabel(
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

  app.post(
    '/v1/issues',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('issue.create')],
    },
    async (request, reply) => {
      const input = issueCreateRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid issue input.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.issues.createIssue(
              request.principal.workspaceId,
              request.principal.accountId,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/issues/:id', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    const id = (request.params as { id?: string }).id;
    if (!id || !dependencies.issues || !request.principal)
      return reply.code(400).send({ error: 'Invalid issue.' });
    try {
      return await dependencies.issues.getIssue(request.principal.workspaceId, id);
    } catch (error) {
      return tenancyFailure(error, reply);
    }
  });

  app.patch(
    '/v1/issues/:id',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const revision = ifMatch(request);
      const input = issueUpdateRequestSchema.safeParse(request.body);
      if (!id || !revision || !input.success)
        return reply
          .code(400)
          .send({ error: 'A valid If-Match revision and issue changes are required.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return await dependencies.issues.updateIssue(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          revision,
          input.data,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/issues/:id/archive',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const revision = ifMatch(request);
      if (!id || !revision || !dependencies.issues || !request.principal)
        return reply.code(400).send({ error: 'A valid If-Match revision is required.' });
      try {
        return await dependencies.issues.archiveIssue(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          revision,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/issues', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    if (!dependencies.issues || !request.principal)
      return reply.code(503).send({ error: 'Issues are not configured.' });
    const query = request.query as Record<string, string | undefined>;
    const pagination = page(query);
    const split = (value: string | undefined) => value?.split(',').filter(Boolean);
    const priorities = split(query.priority)
      ?.map(Number)
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 4);
    const updatedSince = query.updatedSince ? new Date(query.updatedSince) : undefined;
    if (updatedSince && Number.isNaN(updatedSince.getTime()))
      return reply.code(400).send({ error: 'Invalid updatedSince timestamp.' });
    return dependencies.issues.listIssues(request.principal.workspaceId, {
      projectId: query.projectId,
      stateIds: split(query.stateId),
      assigneeIds: split(query.assigneeId),
      labelIds: split(query.labelId),
      priorities,
      parentId: query.parentId,
      query: query.q,
      updatedSince,
      cursor: pagination.cursor,
      limit: pagination.limit,
      sort:
        query.sort === 'manual' || query.sort === 'priority' || query.sort === 'created'
          ? query.sort
          : 'updated',
      groupBy:
        query.groupBy === 'state' ||
        query.groupBy === 'assignee' ||
        query.groupBy === 'priority' ||
        query.groupBy === 'label'
          ? query.groupBy
          : 'none',
    });
  });

  app.post(
    '/v1/issues/:id/subissues',
    {
      onRequest: requireCsrf,
      preHandler: [app.requireWorkspace, requireCapability('issue.create')],
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = issueCreateRequestSchema.omit({ projectId: true }).safeParse(request.body);
      if (!id || !input.success) return reply.code(400).send({ error: 'Invalid sub-issue input.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.issues.createSubIssue(
              request.principal.workspaceId,
              request.principal.accountId,
              id,
              input.data,
              requestMetadata(request),
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get(
    '/v1/issues/:id/subissues',
    { preHandler: [app.requireWorkspace] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.issues || !request.principal)
        return reply.code(400).send({ error: 'Invalid issue.' });
      const pagination = page(request.query as { cursor?: string; limit?: string });
      try {
        return await dependencies.issues.listSubIssues(
          request.principal.workspaceId,
          id,
          pagination.cursor,
          pagination.limit,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/issues/:id/relations',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const input = issueRelationCreateRequestSchema.safeParse(request.body);
      if (!id || !input.success) return reply.code(400).send({ error: 'Invalid relation input.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return reply
          .code(201)
          .send(
            await dependencies.issues.createRelation(
              request.principal.workspaceId,
              request.principal.accountId,
              id,
              input.data.targetIssueId,
              input.data.type,
            ),
          );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.delete(
    '/v1/relations/:id',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      if (!id || !dependencies.issues || !request.principal)
        return reply.code(400).send({ error: 'Invalid relation.' });
      try {
        await dependencies.issues.deleteRelation(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
        );
        return reply.code(204).send();
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/issues/bulk',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const input = issueBulkRequestSchema.safeParse(request.body);
      if (!input.success) return reply.code(400).send({ error: 'Invalid bulk issue input.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return await dependencies.issues.bulkUpdate(
          request.principal.workspaceId,
          request.principal.accountId,
          input.data.issues,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.post(
    '/v1/issues/:id/move',
    { onRequest: requireCsrf, preHandler: [app.requireWorkspace, requireCapability('issue.edit')] },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id;
      const expected = ifMatch(request);
      const input = issueMoveRequestSchema.safeParse(request.body);
      if (!id || !expected || !input.success)
        return reply
          .code(400)
          .send({ error: 'A valid If-Match revision and move destination are required.' });
      if (!dependencies.issues || !request.principal)
        return reply.code(503).send({ error: 'Issues are not configured.' });
      try {
        return await dependencies.issues.moveIssue(
          request.principal.workspaceId,
          request.principal.accountId,
          id,
          expected,
          input.data,
        );
      } catch (error) {
        return tenancyFailure(error, reply);
      }
    },
  );

  app.get('/v1/search/issues', { preHandler: [app.requireWorkspace] }, async (request, reply) => {
    const query = request.query as { q?: string; limit?: string };
    if (!query.q?.trim()) return reply.code(400).send({ error: 'A search query is required.' });
    if (!dependencies.issues || !request.principal)
      return reply.code(503).send({ error: 'Issues are not configured.' });
    const requested = Number(query.limit ?? 20);
    return dependencies.issues.searchIssues(
      request.principal.workspaceId,
      query.q.trim(),
      Number.isInteger(requested) ? Math.max(1, Math.min(100, requested)) : 20,
    );
  });
  if (servesWeb) {
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/v1/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found.' });
    });
  }

  return app;
}

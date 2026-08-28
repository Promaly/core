import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  authenticatedSessionSchema,
  healthResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
} from '@promaly/contracts';
import type { AppConfig } from '@promaly/config';
import { createDatabaseClient, type DatabaseClient } from '@promaly/db';
import {
  AuthenticationError,
  ConflictError,
  createIdentityService,
  type IdentityService,
} from './identity.js';

type ReadinessChecks = {
  database: () => Promise<void>;
  objectStorage: () => Promise<void>;
  close: () => Promise<void>;
};

type AppDependencies = {
  readinessChecks: ReadinessChecks;
  identity: IdentityService | undefined;
};

function createAppDependencies(config: AppConfig): AppDependencies {
  const database: DatabaseClient | undefined = config.databaseUrl
    ? createDatabaseClient(config.databaseUrl)
    : undefined;

  return {
    identity: database ? createIdentityService(database) : undefined,
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

export function buildApp(config: AppConfig, dependencies = createAppDependencies(config)) {
  const app = Fastify({ logger: { level: config.logLevel } });
  const startedAt = process.hrtime.bigint();
  let requestCount = 0;
  const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };

  void app.register(cookie);
  void app.register(rateLimit, { global: false });

  app.addHook('onResponse', async () => {
    requestCount += 1;
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
      await dependencies.readinessChecks.database();
      await dependencies.readinessChecks.objectStorage();
      return { status: 'ready' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown readiness failure';
      return reply.code(503).send({ status: 'not_ready', reason });
    }
  });

  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
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
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
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

  app.post('/v1/auth/logout', async (request, reply) => {
    const token = request.cookies.promaly_session;
    if (token && dependencies.identity) await dependencies.identity.logout(token);
    reply.clearCookie('promaly_session', { path: '/' });
    return reply.code(204).send();
  });

  app.get('/v1/auth/me', async (request, reply) => {
    const token = request.cookies.promaly_session;
    const session =
      token && dependencies.identity ? await dependencies.identity.getSession(token) : null;
    if (!session) return reply.code(401).send({ error: 'Authentication is required.' });
    return authenticatedSessionSchema.parse(session);
  });

  app.get('/metrics', async (_request, reply) => {
    const uptimeSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const body = [
      '# HELP promaly_process_uptime_seconds Time elapsed since the API process started.',
      '# TYPE promaly_process_uptime_seconds gauge',
      `promaly_process_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
      '# HELP promaly_http_requests_total Requests handled by this API process.',
      '# TYPE promaly_http_requests_total counter',
      `promaly_http_requests_total ${requestCount}`,
      '',
    ].join('\n');
    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(body);
  });

  return app;
}

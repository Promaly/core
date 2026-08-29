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
  const app = Fastify({ logger: { level: config.logLevel } });
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
    maxAge: 60 * 60 * 24 * 30,
  };
  const requireCsrf = (
    request: Parameters<typeof app.csrfProtection>[0],
    reply: Parameters<typeof app.csrfProtection>[1],
    done: Parameters<typeof app.csrfProtection>[2],
  ) => app.csrfProtection(request, reply, done);

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

  app.get('/v1/auth/me', async (request, reply) => {
    const token = request.cookies.promaly_session;
    const session =
      token && dependencies.identity ? await dependencies.identity.getSession(token) : null;
    if (!session) return reply.code(401).send({ error: 'Authentication is required.' });
    return authenticatedSessionSchema.parse(session);
  });

  return app;
}

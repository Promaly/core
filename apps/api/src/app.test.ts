import { describe, expect, it } from 'vitest';
import type { IdentityService } from './identity.js';
import { requireCapability } from './principal.js';
import { buildApp, buildMetricsApp, createMetricsState } from './app.js';

const config = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1',
  port: 3000,
  metricsHost: '127.0.0.1',
  metricsPort: 9090,
  metricsToken: undefined,
  databaseUrl: undefined,
  migrationDatabaseUrl: undefined,
  s3Endpoint: undefined,
  s3Bucket: 'promaly',
  s3Region: 'us-east-1',
  smtpUrl: undefined,
  smtpFrom: undefined,
  workerHealthPort: 8081,
  otelExporterOtlpEndpoint: undefined,
  otelServiceName: 'promaly-api',
  otelTracesEnabled: false,
  logLevel: 'silent' as const,
};

const session = {
  account: {
    id: '2e9d2678-14f8-4195-a85a-ac9eedb6d0c0',
    email: 'owner@example.com',
    createdAt: '2026-08-28T00:00:00.000Z',
  },
  workspaces: [
    {
      id: '41910ec6-4444-4ce5-bda1-f90d4474acba',
      name: 'Promaly',
      slug: 'promaly',
      role: 'owner' as const,
    },
  ],
};

function buildTestApp(identity?: IdentityService) {
  return buildApp(config, {
    identity,
    readinessChecks: {
      database: async () => undefined,
      objectStorage: async () => undefined,
      close: async () => undefined,
    },
  });
}

describe('health endpoints', () => {
  it('reports that the API is healthy', async () => {
    const app = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' });
    await app.close();
  });

  it('checks its dependencies before reporting ready', async () => {
    const app = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/readyz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
    await app.close();
  });

  it('exposes Prometheus-compatible metrics from the dedicated metrics app', async () => {
    const app = buildMetricsApp(config, createMetricsState());
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('promaly_http_requests_total');
    await app.close();
  });

  it('requires an optional bearer token for metrics', async () => {
    const app = buildMetricsApp({ ...config, metricsToken: 'metrics-secret' });

    const unauthenticated = await app.inject({ method: 'GET', url: '/metrics' });
    const authenticated = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer metrics-secret' },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(authenticated.statusCode).toBe(200);
    await app.close();
  });

  it('sets JSON-API security headers without affecting health checks', async () => {
    const app = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe('identity endpoints', () => {
  const identity: IdentityService = {
    register: async () => ({
      ...session,
      token: { value: 'opaque-token', expiresAt: new Date('2026-09-28') },
    }),
    login: async () => ({
      ...session,
      token: { value: 'opaque-token', expiresAt: new Date('2026-09-28') },
    }),
    getSession: async () => session,
    logout: async () => undefined,
    logoutAll: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
  };

  it('registers an account and sets an HTTP-only session cookie', async () => {
    const app = buildTestApp(identity);
    const csrf = await app.inject({ method: 'GET', url: '/v1/auth/csrf' });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: {
        cookie: csrf.headers['set-cookie'] as string,
        'x-csrf-token': csrf.json<{ csrfToken: string }>().csrfToken,
      },
      payload: {
        email: 'owner@example.com',
        password: 'a-secure-password',
        workspaceName: 'Promaly',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['set-cookie']).toContain('promaly_session=opaque-token');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.json()).toEqual(session);
    await app.close();
  });

  it('rejects a state-changing request without a CSRF token', async () => {
    const app = buildTestApp(identity);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'owner@example.com', password: 'a-secure-password' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('requires an authenticated session for the current account', async () => {
    const app = buildTestApp(identity);
    const response = await app.inject({ method: 'GET', url: '/v1/auth/me' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('wires the workspace authorization spine onto the main app', async () => {
    const app = buildTestApp(identity);
    app.get(
      '/_test/scoped',
      { preHandler: [app.requireWorkspace, requireCapability('project.manage')] },
      async (request) => request.principal,
    );

    const denied = await app.inject({ method: 'GET', url: '/_test/scoped' });
    expect(denied.statusCode).toBe(400); // no X-Workspace-Id

    const allowed = await app.inject({
      method: 'GET',
      url: '/_test/scoped',
      headers: { cookie: 'promaly_session=t', 'x-workspace-id': session.workspaces[0]!.id },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ workspaceId: session.workspaces[0]!.id, role: 'owner' });
    await app.close();
  });
});

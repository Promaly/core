import { describe, expect, it } from 'vitest';
import type { IdentityService } from './identity.js';
import { buildApp } from './app.js';

const config = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1',
  port: 3000,
  databaseUrl: undefined,
  s3Endpoint: undefined,
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

  it('exposes Prometheus-compatible process metrics', async () => {
    const app = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('promaly_http_requests_total');
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
  };

  it('registers an account and sets an HTTP-only session cookie', async () => {
    const app = buildTestApp(identity);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
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

  it('requires an authenticated session for the current account', async () => {
    const app = buildTestApp(identity);
    const response = await app.inject({ method: 'GET', url: '/v1/auth/me' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

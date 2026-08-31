import { describe, expect, it, vi } from 'vitest';
import type { CoreRole } from '@promaly/domain';
import type { IdentityService } from './identity.js';
import type { ProjectManagementService } from './project-management.js';
import type { IssuesService } from './issues.js';
import type { TenancyService } from './tenancy.js';
import type { StorageClient } from './storage.js';
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
  s3AccessKeyId: undefined,
  s3SecretAccessKey: undefined,
  s3ForcePathStyle: true,
  maxAttachmentBytes: 26_214_400,
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

function buildTestApp(
  identity?: IdentityService,
  tenancy?: TenancyService,
  projectManagement?: ProjectManagementService,
  issues?: IssuesService,
  storage?: StorageClient,
) {
  return buildApp(config, {
    identity,
    tenancy,
    projectManagement,
    issues,
    storage,
    readinessChecks: {
      database: async () => undefined,
      objectStorage: async () => undefined,
      close: async () => undefined,
    },
  });
}

const workspaceId = session.workspaces[0]!.id;

function sessionAs(role: CoreRole) {
  return {
    account: session.account,
    workspaces: [{ ...session.workspaces[0]!, role }],
  };
}

function identityAs(role: CoreRole): IdentityService {
  return {
    register: async () => ({
      ...session,
      token: { value: 't', expiresAt: new Date('2026-12-01') },
    }),
    login: async () => ({ ...session, token: { value: 't', expiresAt: new Date('2026-12-01') } }),
    startSession: async () => ({
      ...session,
      token: { value: 't', expiresAt: new Date('2026-12-01') },
    }),
    getSession: async (token) => (token ? sessionAs(role) : null),
    logout: async () => undefined,
    logoutAll: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
  };
}

function tenancyMock(overrides: Partial<TenancyService> = {}): TenancyService {
  return {
    createWorkspace: vi.fn(async () => ({ id: workspaceId, name: 'W', slug: 'w', role: 'owner' })),
    updateWorkspace: vi.fn(async () => ({ id: workspaceId, name: 'W', slug: 'w' })),
    deleteWorkspace: vi.fn(async () => undefined),
    listMembers: vi.fn(async () => []),
    updateMemberRole: vi.fn(async () => undefined),
    removeMember: vi.fn(async () => undefined),
    createInvitation: vi.fn(async () => ({
      id: 'inv-1',
      email: 'x@example.com',
      role: 'member' as const,
      expiresAt: new Date('2026-12-01'),
    })),
    listInvitations: vi.fn(async () => []),
    revokeInvitation: vi.fn(async () => undefined),
    acceptInvitation: vi.fn(async () => ({
      workspaceId,
      accountId: session.account.id,
      role: 'member' as const,
    })),
    ...overrides,
  } as TenancyService;
}

function projectManagementMock(): ProjectManagementService {
  return {
    createProject: vi.fn(async () => ({ id: 'project-1', key: 'CORE', name: 'Core' })),
  } as unknown as ProjectManagementService;
}

function issuesMock(): IssuesService {
  return {
    createIssue: vi.fn(async () => ({ id: 'issue-1', revision: 1, number: 1 })),
  } as unknown as IssuesService;
}

async function csrf(app: Awaited<ReturnType<typeof buildTestApp>>) {
  const response = await app.inject({ method: 'GET', url: '/v1/auth/csrf' });
  return {
    cookie: response.headers['set-cookie'] as string,
    token: response.json<{ csrfToken: string }>().csrfToken,
  };
}

const wsHeaders = { cookie: 'promaly_session=t', 'x-workspace-id': workspaceId };

describe('health endpoints', () => {
  it('reports that the API is healthy', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' });
    await app.close();
  });

  it('checks its dependencies before reporting ready', async () => {
    const app = await buildTestApp();
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
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('publishes the versioned OpenAPI document', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/openapi.json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'Promaly API' } });
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
    startSession: async () => ({
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
    const app = await buildTestApp(identity);
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
    const app = await buildTestApp(identity);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'owner@example.com', password: 'a-secure-password' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('requires an authenticated session for the current account', async () => {
    const app = await buildTestApp(identity);
    const response = await app.inject({ method: 'GET', url: '/v1/auth/me' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('wires the workspace authorization spine onto the main app', async () => {
    const app = await buildTestApp(identity);
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
      headers: wsHeaders,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ workspaceId, role: 'owner' });
    await app.close();
  });

  it('revokes every session on DELETE /v1/auth/sessions', async () => {
    const app = await buildTestApp(identityAs('member'));
    const { cookie, token } = await csrf(app);

    const anon = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/sessions',
      headers: { cookie, 'x-csrf-token': token },
    });
    expect(anon.statusCode).toBe(401);

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/sessions',
      headers: { cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toContain('promaly_session=;');
    await app.close();
  });

  it('always answers 202 to a password reset request', async () => {
    const app = await buildTestApp(identityAs('member'));
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/password-reset',
      headers: { cookie, 'x-csrf-token': token },
      payload: { email: 'nobody@example.com' },
    });
    expect(response.statusCode).toBe(202);
    await app.close();
  });

  it('rate-limits the password reset confirmation endpoint', async () => {
    const app = await buildTestApp(identityAs('member'));
    const { cookie, token } = await csrf(app);
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/password-reset/some-token',
        remoteAddress: '203.0.113.7',
        headers: { cookie, 'x-csrf-token': token },
        payload: { password: 'a-brand-new-password' },
      });

    const codes: number[] = [];
    for (let i = 0; i < 12; i += 1) codes.push((await send()).statusCode);
    expect(codes.at(-1)).toBe(429);
    await app.close();
  });
});

describe('tenancy endpoints', () => {
  it('creates a workspace for an authenticated account', async () => {
    const tenancy = tenancyMock();
    const app = await buildTestApp(identityAs('member'), tenancy);
    const { cookie, token } = await csrf(app);

    const anon = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: { cookie, 'x-csrf-token': token },
      payload: { name: 'New workspace' },
    });
    expect(anon.statusCode).toBe(401);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: { cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
      payload: { name: 'New workspace' },
    });
    expect(response.statusCode).toBe(201);
    expect(tenancy.createWorkspace).toHaveBeenCalledOnce();
    await app.close();
  });

  it('gates invitations on the member.manage capability', async () => {
    for (const [role, status] of [
      ['member', 403],
      ['admin', 201],
    ] as const) {
      const tenancy = tenancyMock();
      const app = await buildTestApp(identityAs(role), tenancy);
      const { cookie, token } = await csrf(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/invitations',
        headers: { ...wsHeaders, cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
        payload: { email: 'invitee@example.com', role: 'member' },
      });
      expect(response.statusCode).toBe(status);
      await app.close();
    }
  });

  it('logs the accepting account in on invitation acceptance', async () => {
    const app = await buildTestApp(identityAs('member'), tenancyMock());
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/invitations/invite-token/accept',
      headers: { cookie, 'x-csrf-token': token },
      payload: { password: 'a-brand-new-password' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.headers['set-cookie']).toContain('promaly_session=');
    await app.close();
  });

  it('requires the X-Workspace-Id header on workspace-scoped routes', async () => {
    const app = await buildTestApp(identityAs('admin'), tenancyMock());
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
      payload: { email: 'invitee@example.com', role: 'member' },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('lets only an owner grant the owner role', async () => {
    for (const [role, status] of [
      ['admin', 403],
      ['owner', 204],
    ] as const) {
      const tenancy = tenancyMock();
      const app = await buildTestApp(identityAs(role), tenancy);
      const { cookie, token } = await csrf(app);
      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/members/${session.account.id}`,
        headers: { ...wsHeaders, cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
        payload: { role: 'owner' },
      });
      expect(response.statusCode).toBe(status);
      if (status === 403) expect(tenancy.updateMemberRole).not.toHaveBeenCalled();
      await app.close();
    }
  });

  it('still allows an admin to set a non-owner role', async () => {
    const tenancy = tenancyMock();
    const app = await buildTestApp(identityAs('admin'), tenancy);
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/members/${session.account.id}`,
      headers: { ...wsHeaders, cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
      payload: { role: 'member' },
    });
    expect(response.statusCode).toBe(204);
    expect(tenancy.updateMemberRole).toHaveBeenCalledOnce();
    await app.close();
  });

  it('404s when the path workspace differs from the caller workspace', async () => {
    const app = await buildTestApp(identityAs('owner'), tenancyMock());
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/workspaces/00000000-0000-0000-0000-000000000000',
      headers: { ...wsHeaders, cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
      payload: { name: 'Renamed' },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('denies workspace settings to a plain member', async () => {
    const app = await buildTestApp(identityAs('member'), tenancyMock());
    const { cookie, token } = await csrf(app);
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: { ...wsHeaders, cookie: `${cookie}; promaly_session=t`, 'x-csrf-token': token },
      payload: { name: 'Renamed' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('lets any member read the member list', async () => {
    const app = await buildTestApp(identityAs('guest'), tenancyMock());
    const response = await app.inject({ method: 'GET', url: '/v1/members', headers: wsHeaders });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe('project-management authorization', () => {
  it('gates project creation and hides foreign workspaces', async () => {
    for (const [role, workspace, status] of [
      ['member', workspaceId, 403],
      ['owner', workspaceId, 201],
      ['owner', '00000000-0000-0000-0000-000000000000', 404],
    ] as const) {
      const management = projectManagementMock();
      const app = await buildTestApp(identityAs(role), undefined, management);
      const { cookie, token } = await csrf(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: {
          cookie: `${cookie}; promaly_session=t`,
          'x-csrf-token': token,
          'x-workspace-id': workspace,
        },
        payload: { key: 'CORE', name: 'Core' },
      });
      expect(response.statusCode).toBe(status);
      await app.close();
    }
  });
});

describe('issue authorization', () => {
  it('gates creation by issue.create and hides a foreign workspace', async () => {
    for (const [role, requestedWorkspace, status] of [
      ['guest', workspaceId, 403],
      ['member', workspaceId, 201],
      ['member', '00000000-0000-0000-0000-000000000000', 404],
    ] as const) {
      const app = await buildTestApp(identityAs(role), undefined, undefined, issuesMock());
      const { cookie, token } = await csrf(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/issues',
        headers: {
          cookie: `${cookie}; promaly_session=t`,
          'x-csrf-token': token,
          'x-workspace-id': requestedWorkspace,
        },
        payload: { projectId: workspaceId, title: 'Issue' },
      });
      expect(response.statusCode).toBe(status);
      await app.close();
    }
  });
});

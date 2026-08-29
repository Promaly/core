import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IdentityService } from './identity.js';
import { createPrincipalPreHandler, requireCapability } from './principal.js';

const workspaceId = '6f02621b-a7c2-4a52-a8b8-a738d257d7cd';
const otherWorkspaceId = 'dbd7bb4a-e73d-44ce-819f-91b51ffb4e65';

function identity(role: 'owner' | 'admin' | 'member' | 'guest'): IdentityService {
  return {
    register: async () => {
      throw new Error('not used');
    },
    login: async () => {
      throw new Error('not used');
    },
    logout: async () => undefined,
    logoutAll: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    getSession: async () => ({
      account: {
        id: 'a409e498-31fe-457d-a7eb-3a9d8195a904',
        email: 'owner@example.com',
        createdAt: new Date().toISOString(),
      },
      workspaces: [{ id: workspaceId, name: 'Promaly', slug: 'promaly', role }],
    }),
  };
}

const noSession: IdentityService = { ...identity('owner'), getSession: async () => null };

async function buildTestApp(identityService: IdentityService) {
  const app = Fastify();
  app.decorateRequest('principal', undefined);
  await app.register(cookie);
  app.get(
    '/protected',
    {
      preHandler: [createPrincipalPreHandler(identityService), requireCapability('project.manage')],
    },
    async () => ({ ok: true }),
  );
  // Capability check with no principal resolver in front of it.
  app.get('/misordered', { preHandler: [requireCapability('workspace.read')] }, async () => ({
    ok: true,
  }));
  return app;
}

const withSession = { cookie: 'promaly_session=session-token', 'x-workspace-id': workspaceId };

describe('principal pre-handler', () => {
  it('returns 400 without a workspace header', async () => {
    const app = await buildTestApp(identity('owner'));
    expect((await app.inject({ method: 'GET', url: '/protected' })).statusCode).toBe(400);
    await app.close();
  });

  it('returns 401 without a valid session', async () => {
    const app = await buildTestApp(noSession);
    const response = await app.inject({ method: 'GET', url: '/protected', headers: withSession });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('allows an owner and denies a member', async () => {
    const owner = await buildTestApp(identity('owner'));
    const member = await buildTestApp(identity('member'));
    expect(
      (await owner.inject({ method: 'GET', url: '/protected', headers: withSession })).statusCode,
    ).toBe(200);
    expect(
      (await member.inject({ method: 'GET', url: '/protected', headers: withSession })).statusCode,
    ).toBe(403);
    await owner.close();
    await member.close();
  });

  it('returns 404 for another workspace', async () => {
    const app = await buildTestApp(identity('owner'));
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: 'promaly_session=session-token', 'x-workspace-id': otherWorkspaceId },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('fails closed with 500 when requireCapability runs before the principal is resolved', async () => {
    const app = await buildTestApp(identity('owner'));
    const response = await app.inject({ method: 'GET', url: '/misordered', headers: withSession });
    expect(response.statusCode).toBe(500);
    await app.close();
  });
});

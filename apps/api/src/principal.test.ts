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

async function buildTestApp(role: 'owner' | 'admin' | 'member' | 'guest') {
  const app = Fastify();
  app.decorateRequest('principal', undefined);
  await app.register(cookie);
  app.get(
    '/protected',
    {
      preHandler: [createPrincipalPreHandler(identity(role)), requireCapability('project.manage')],
    },
    async () => ({ ok: true }),
  );
  return app;
}

describe('principal pre-handler', () => {
  it('returns 400 without a workspace header', async () => {
    const app = await buildTestApp('owner');
    expect((await app.inject({ method: 'GET', url: '/protected' })).statusCode).toBe(400);
    await app.close();
  });

  it('allows an owner and denies a member', async () => {
    const owner = await buildTestApp('owner');
    const member = await buildTestApp('member');
    const headers = { cookie: 'promaly_session=session-token', 'x-workspace-id': workspaceId };
    expect((await owner.inject({ method: 'GET', url: '/protected', headers })).statusCode).toBe(
      200,
    );
    expect((await member.inject({ method: 'GET', url: '/protected', headers })).statusCode).toBe(
      403,
    );
    await owner.close();
    await member.close();
  });

  it('returns 404 for another workspace', async () => {
    const app = await buildTestApp('owner');
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: 'promaly_session=session-token', 'x-workspace-id': otherWorkspaceId },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

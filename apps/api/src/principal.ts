import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { Capability, CoreRole } from '@promaly/domain';
import { can } from '@promaly/domain';
import type { IdentityService } from './identity.js';

export type Principal = {
  accountId: string;
  workspaceId: string;
  role: CoreRole;
  can: (capability: Capability) => boolean;
};

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | undefined;
  }
}

function workspaceHeader(request: FastifyRequest) {
  const header = request.headers['x-workspace-id'];
  return Array.isArray(header) ? header[0] : header;
}

export function createPrincipalPreHandler(
  identity: IdentityService | undefined,
): preHandlerHookHandler {
  return async (request, reply) => {
    const requestedWorkspaceId = workspaceHeader(request);
    if (!requestedWorkspaceId) {
      return reply.code(400).send({ error: 'X-Workspace-Id is required.' });
    }

    const token = request.cookies.promaly_session;
    const session = token && identity ? await identity.getSession(token) : null;
    if (!session) return reply.code(401).send({ error: 'Authentication is required.' });

    const membership = session.workspaces.find(
      (workspace) => workspace.id === requestedWorkspaceId,
    );
    if (!membership) return reply.code(404).send({ error: 'Workspace not found.' });

    request.principal = {
      accountId: session.account.id,
      workspaceId: membership.id,
      role: membership.role,
      can: (capability) => can(membership.role, capability),
    };
  };
}

export function requireCapability(capability: Capability): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.principal) return reply.code(500).send({ error: 'Principal was not resolved.' });
    if (!request.principal.can(capability)) {
      return reply.code(403).send({ error: 'You do not have this capability.' });
    }
  };
}

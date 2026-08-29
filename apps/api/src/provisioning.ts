import {
  auditEvents,
  type DbTransaction,
  emit,
  workflowStates,
  workflows,
  workspaceMembers,
  workspaces,
} from '@promaly/db';
import { newId } from '@promaly/domain';

const DEFAULT_STATES = [
  { name: 'Backlog', category: 'backlog', position: 0, color: '#6b7280' },
  { name: 'Todo', category: 'unstarted', position: 1, color: '#94a3b8' },
  { name: 'In progress', category: 'started', position: 2, color: '#3b82f6' },
  { name: 'Done', category: 'completed', position: 3, color: '#22c55e' },
  { name: 'Cancelled', category: 'cancelled', position: 4, color: '#ef4444' },
] as const;

type ProvisionInput = {
  workspaceId: string;
  ownerId: string;
  name: string;
  slug: string;
  source: string;
  ipAddress?: string | undefined;
};

/**
 * First-run setup for a new workspace, inside an existing transaction: the
 * workspace row, its owner membership, a default workflow with five categorised
 * states, an audit event, and a `workspace.created` outbox event. Shared by
 * account registration and explicit workspace creation.
 */
export async function provisionWorkspace(tx: DbTransaction, input: ProvisionInput) {
  const { workspaceId, ownerId, name, slug } = input;

  await tx.insert(workspaces).values({ id: workspaceId, name, slug, createdBy: ownerId });
  await tx.insert(workspaceMembers).values({ workspaceId, accountId: ownerId, role: 'owner' });

  const workflowId = newId();
  await tx.insert(workflows).values({
    id: workflowId,
    workspaceId,
    name: 'Default workflow',
    isDefault: true,
    createdBy: ownerId,
  });
  await tx
    .insert(workflowStates)
    .values(DEFAULT_STATES.map((state) => ({ id: newId(), workflowId, ...state })));

  await tx.insert(auditEvents).values({
    id: newId(),
    workspaceId,
    actorId: ownerId,
    action: 'workspace.created',
    targetType: 'workspace',
    targetId: workspaceId,
    metadata: { source: input.source },
    ipAddress: input.ipAddress,
  });
  await emit(tx, {
    id: newId(),
    workspaceId,
    aggregateType: 'workspace',
    aggregateId: workspaceId,
    type: 'workspace.created',
    payload: { accountId: ownerId },
  });
}

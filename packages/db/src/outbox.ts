import type { Phase1EventType } from '@promaly/contracts';
import type { DatabaseClient } from './index.js';
import { outboxEvents } from './schema.js';

export type OutboxEvent = {
  id: string;
  workspaceId?: string;
  aggregateType: string;
  aggregateId: string;
  type: Phase1EventType;
  payload: Record<string, unknown>;
  availableAt?: Date;
};

type OutboxTransaction = Pick<DatabaseClient['db'], 'insert'>;

export async function emit(transaction: OutboxTransaction, event: OutboxEvent) {
  await transaction.insert(outboxEvents).values({
    ...event,
    workspaceId: event.workspaceId,
    availableAt: event.availableAt,
  });
}

export async function withOutbox<T>(
  transaction: OutboxTransaction,
  event: OutboxEvent,
  write: (transaction: OutboxTransaction) => Promise<T>,
) {
  const result = await write(transaction);
  await emit(transaction, event);
  return result;
}

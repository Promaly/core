import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { Phase1EventType } from '@promaly/contracts';
import { outboxEvents } from './schema.js';

/**
 * A live database transaction. `emit` and `withOutbox` only accept this type —
 * never the top-level client — so the business write and the outbox row are
 * always committed together (data/API rule 3).
 */
export type DbTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

export type OutboxEvent = {
  id: string;
  workspaceId?: string;
  aggregateType: string;
  aggregateId: string;
  type: Phase1EventType;
  payload: Record<string, unknown>;
  availableAt?: Date;
};

export async function emit(tx: DbTransaction, event: OutboxEvent) {
  await tx.insert(outboxEvents).values({
    id: event.id,
    workspaceId: event.workspaceId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    type: event.type,
    payload: event.payload,
    availableAt: event.availableAt,
  });
}

export async function withOutbox<T>(
  tx: DbTransaction,
  event: OutboxEvent,
  write: (tx: DbTransaction) => Promise<T>,
) {
  const result = await write(tx);
  await emit(tx, event);
  return result;
}

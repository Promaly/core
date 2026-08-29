import { sql } from 'drizzle-orm';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  emit,
  runMigrations,
  systemMetadata,
  type DatabaseClient,
} from './index.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('outbox emit', () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = createDatabaseClient(container.getConnectionUri());
    await runMigrations(database.db);
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  async function countOutbox() {
    const rows = await database.db.execute<{ count: string }>(
      sql`select count(*) from outbox_events`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  it('writes the business row and the event in one committed transaction', async () => {
    const before = await countOutbox();
    await database.db.transaction(async (tx) => {
      await tx.insert(systemMetadata).values({ key: 'k1', value: { ok: true } });
      await emit(tx, {
        id: uuidv7(),
        aggregateType: 'system',
        aggregateId: uuidv7(),
        type: 'workspace.created',
        payload: { key: 'k1' },
      });
    });
    expect(await countOutbox()).toBe(before + 1);
    const meta = await database.db.execute(sql`select 1 from system_metadata where key = 'k1'`);
    expect(meta).toHaveLength(1);
  });

  it('discards both the business row and the event when the transaction rolls back', async () => {
    const before = await countOutbox();
    await expect(
      database.db.transaction(async (tx) => {
        await tx.insert(systemMetadata).values({ key: 'rollback-key', value: {} });
        await emit(tx, {
          id: uuidv7(),
          aggregateType: 'system',
          aggregateId: uuidv7(),
          type: 'workspace.created',
          payload: {},
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await countOutbox()).toBe(before);
    const meta = await database.db.execute(
      sql`select 1 from system_metadata where key = 'rollback-key'`,
    );
    expect(meta).toHaveLength(0);
  });
});

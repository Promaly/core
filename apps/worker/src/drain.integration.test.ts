import { eq } from 'drizzle-orm';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  createDatabaseClient,
  outboxEvents,
  runMigrations,
  type DatabaseClient,
} from '@promaly/db';
import type { MailMessage, MailPort } from '@promaly/domain';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drainOutbox } from './drain.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('outbox drain', () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseClient;
  const sent: MailMessage[] = [];
  const send = vi.fn(async (message: MailMessage) => void sent.push(message));
  const mail: MailPort = { send };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = createDatabaseClient(container.getConnectionUri());
    await runMigrations(database.db);
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    sent.length = 0;
    send.mockReset();
    send.mockImplementation(async (message: MailMessage) => void sent.push(message));
    await database.db.delete(outboxEvents);
  });

  async function seed(
    type: string,
    payload: Record<string, unknown>,
    availableAt: Date = new Date(),
  ) {
    const id = uuidv7();
    await database.db.insert(outboxEvents).values({
      id,
      aggregateType: 'test',
      aggregateId: uuidv7(),
      type,
      payload,
      availableAt,
    });
    return id;
  }

  async function row(id: string) {
    const [record] = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);
    if (!record) throw new Error(`no outbox row ${id}`);
    return record;
  }

  it('delivers an email.send event and marks it processed', async () => {
    const id = await seed('email.send', { to: 'a@b.com', subject: 'Hi', text: 'Body' });
    const result = await drainOutbox(database.raw, { mail });

    expect(result).toMatchObject({ claimed: 1, processed: 1, retried: 0, deadLettered: 0 });
    expect(sent).toEqual([{ to: 'a@b.com', subject: 'Hi', text: 'Body' }]);
    expect((await row(id)).processedAt).not.toBeNull();
  });

  it('marks a known no-op event processed without sending mail', async () => {
    const id = await seed('workspace.created', { accountId: uuidv7() });
    const result = await drainOutbox(database.raw, { mail });

    expect(result).toMatchObject({ claimed: 1, processed: 1 });
    expect(send).not.toHaveBeenCalled();
    expect((await row(id)).processedAt).not.toBeNull();
  });

  it('schedules a backoff retry when dispatch fails', async () => {
    send.mockRejectedValueOnce(new Error('smtp down'));
    const id = await seed('email.send', { to: 'a@b.com', subject: 'Hi', text: 'Body' });
    const result = await drainOutbox(database.raw, { mail });

    expect(result).toMatchObject({ processed: 0, retried: 1, deadLettered: 0 });
    const record = await row(id);
    expect(record.processedAt).toBeNull();
    expect(record.attempts).toBe(1);
    expect(record.lastError).toContain('smtp down');
    expect(record.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('dead-letters an event with no handler instead of retrying forever', async () => {
    const id = await seed('unknown.type', {});
    const result = await drainOutbox(database.raw, { mail });

    expect(result).toMatchObject({ deadLettered: 1, retried: 0 });
    const record = await row(id);
    expect(record.processedAt).not.toBeNull();
    expect(record.lastError).toContain('No handler');
  });

  it('leaves events whose available_at is in the future', async () => {
    await seed(
      'email.send',
      { to: 'a@b.com', subject: 'x', text: 'y' },
      new Date(Date.now() + 3_600_000),
    );
    const result = await drainOutbox(database.raw, { mail });
    expect(result.claimed).toBe(0);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseClient, runMigrations, type DatabaseClient } from '@promaly/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIdentityService } from './identity.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('identity registration', () => {
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

  it('seeds a default workflow, five states and a workspace.created outbox event', async () => {
    const identity = createIdentityService(database);
    const session = await identity.register(
      { email: 'owner@example.com', password: 'a-very-secure-password', workspaceName: 'Acme' },
      { ipAddress: '127.0.0.1' },
    );
    const workspaceId = session.workspaces[0]!.id;

    const workflows = await database.raw<{ id: string; is_default: boolean }[]>`
      select id, is_default from workflows where workspace_id = ${workspaceId}::uuid`;
    const workflow = workflows[0]!;
    expect(workflow.is_default).toBe(true);

    const states = await database.raw<{ category: string }[]>`
      select category from workflow_states where workflow_id = ${workflow.id}::uuid order by position`;
    expect(states.map((state) => state.category)).toEqual([
      'backlog',
      'unstarted',
      'started',
      'completed',
      'cancelled',
    ]);

    const events = await database.raw<{ type: string }[]>`
      select type from outbox_events where workspace_id = ${workspaceId}::uuid`;
    expect(events.map((event) => event.type)).toEqual(['workspace.created']);
  });

  it('rejects a second account with the same email', async () => {
    const identity = createIdentityService(database);
    await expect(
      identity.register(
        { email: 'owner@example.com', password: 'a-very-secure-password', workspaceName: 'Other' },
        {},
      ),
    ).rejects.toThrow(/already exists/i);
  });
});

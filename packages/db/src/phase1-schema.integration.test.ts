import { sql } from 'drizzle-orm';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabaseClient,
  runMigrations,
  type DatabaseClient,
  accounts,
  issues,
  labels,
  projectIssueCounters,
  projects,
  workflows,
  workflowStates,
  workspaces,
} from './index.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('phase 1 schema', () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseClient;
  const ids = {
    account: uuidv7(),
    workspace: uuidv7(),
    workflow: uuidv7(),
    state: uuidv7(),
    project: uuidv7(),
    issue: uuidv7(),
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = createDatabaseClient(container.getConnectionUri());
    await runMigrations(database.db);

    await database.db.insert(accounts).values({
      id: ids.account,
      email: 'owner@example.com',
      passwordHash: 'x',
    });
    await database.db.insert(workspaces).values({
      id: ids.workspace,
      name: 'Acme',
      slug: 'acme',
      createdBy: ids.account,
    });
    await database.db.insert(workflows).values({
      id: ids.workflow,
      workspaceId: ids.workspace,
      name: 'Default',
      createdBy: ids.account,
    });
    await database.db.insert(workflowStates).values({
      id: ids.state,
      workflowId: ids.workflow,
      name: 'Todo',
      category: 'unstarted',
      position: 0,
      color: '#fff',
    });
    await database.db.insert(projects).values({
      id: ids.project,
      workspaceId: ids.workspace,
      key: 'ACME',
      name: 'Acme',
      workflowId: ids.workflow,
      createdBy: ids.account,
    });
    await database.db
      .insert(projectIssueCounters)
      .values({ projectId: ids.project, nextNumber: 2 });
    await database.db.insert(issues).values({
      id: ids.issue,
      workspaceId: ids.workspace,
      projectId: ids.project,
      number: 1,
      title: 'Payment webhook retries',
      description: 'Investigate exponential backoff behaviour',
      stateId: ids.state,
      sortKey: 'a0',
      createdBy: ids.account,
    });
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it('stores ids as native uuid columns', async () => {
    const rows = await database.db.execute<{ data_type: string }>(
      sql`select data_type from information_schema.columns where table_name = 'accounts' and column_name = 'id'`,
    );
    expect(rows[0]?.data_type).toBe('uuid');
  });

  it('populates the generated full-text search vector', async () => {
    const rows = await database.db.execute<{ id: string }>(
      sql`select id from issues where search_tsv @@ to_tsquery('english', 'backoff')`,
    );
    expect(rows.map((row) => row.id)).toEqual([ids.issue]);
  });

  const causeOf = (error: unknown) => {
    const cause = (error as { cause?: unknown }).cause;
    return String(cause ?? error);
  };

  it('enforces the self-referencing parent-issue foreign key', async () => {
    const error = await database.db
      .update(issues)
      .set({ parentIssueId: uuidv7() })
      .where(sql`${issues.id} = ${ids.issue}`)
      .catch((caught: unknown) => caught);
    expect(causeOf(error)).toMatch(/foreign key constraint "issues_parent_issue_id_issues_id_fk"/i);
  });

  it('rejects a duplicate label name within the same scope', async () => {
    await database.db.insert(labels).values({
      id: uuidv7(),
      workspaceId: ids.workspace,
      name: 'Bug',
      color: '#f00',
      createdBy: ids.account,
    });
    const error = await database.db
      .insert(labels)
      .values({
        id: uuidv7(),
        workspaceId: ids.workspace,
        name: 'bug',
        color: '#f00',
        createdBy: ids.account,
      })
      .catch((caught: unknown) => caught);
    expect(causeOf(error)).toMatch(/duplicate key value|labels_scope_name_unique/i);
  });

  it('keeps updated_at current on update', async () => {
    // `$onUpdate` sets updated_at from the application clock, so compare two
    // application-clock writes rather than the DB `now()` used at insert.
    const readUpdatedAt = async () => {
      const rows = await database.db.execute<{ updated_at: string }>(
        sql`select updated_at from projects where id = ${ids.project}`,
      );
      return new Date(rows[0]!.updated_at).getTime();
    };
    await database.db
      .update(projects)
      .set({ description: 'First' })
      .where(sql`${projects.id} = ${ids.project}`);
    const first = await readUpdatedAt();
    await new Promise((resolve) => setTimeout(resolve, 25));
    await database.db
      .update(projects)
      .set({ description: 'Second' })
      .where(sql`${projects.id} = ${ids.project}`);
    expect(await readUpdatedAt()).toBeGreaterThan(first);
  });
});

import { eq } from 'drizzle-orm';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accounts,
  createDatabaseClient,
  createScopedRepository,
  labels,
  runMigrations,
  WorkspaceScopeError,
  workspaces,
  type DatabaseClient,
} from './index.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('scoped repository', () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseClient;
  const accountId = uuidv7();
  const workspaceA = uuidv7();
  const workspaceB = uuidv7();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = createDatabaseClient(container.getConnectionUri());
    await runMigrations(database.db);
    await database.db
      .insert(accounts)
      .values({ id: accountId, email: 'o@x.com', passwordHash: 'x' });
    await database.db.insert(workspaces).values([
      { id: workspaceA, name: 'A', slug: 'a', createdBy: accountId },
      { id: workspaceB, name: 'B', slug: 'b', createdBy: accountId },
    ]);
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it('throws without a workspace id', () => {
    expect(() => createScopedRepository(database.db, '')).toThrow(WorkspaceScopeError);
  });

  it('forces workspace_id on insert and never leaks across workspaces', async () => {
    const repoA = createScopedRepository(database.db, workspaceA);
    const repoB = createScopedRepository(database.db, workspaceB);

    const [labelA] = await repoA.insert(labels, {
      id: uuidv7(),
      name: 'A-only',
      color: '#111',
      createdBy: accountId,
    });
    expect(labelA?.workspaceId).toBe(workspaceA);

    await repoB.insert(labels, {
      id: uuidv7(),
      name: 'B-only',
      color: '#222',
      createdBy: accountId,
    });

    const seenByB = await repoB.select(labels);
    expect(seenByB.map((row) => row.name)).toEqual(['B-only']);
  });

  it('scopes update and delete to the repository workspace', async () => {
    const repoA = createScopedRepository(database.db, workspaceA);
    const repoB = createScopedRepository(database.db, workspaceB);

    const updated = await repoB.update(labels, { color: '#999' }, eq(labels.name, 'A-only'));
    expect(updated).toHaveLength(0);

    const deleted = await repoB.delete(labels, eq(labels.name, 'A-only'));
    expect(deleted).toHaveLength(0);

    const stillThere = await repoA.select(labels, eq(labels.name, 'A-only'));
    expect(stillThere).toHaveLength(1);
  });

  it('rejects an insert that names another workspace', async () => {
    const repoA = createScopedRepository(database.db, workspaceA);
    await expect(
      repoA.insert(labels, {
        id: uuidv7(),
        workspaceId: workspaceB,
        name: 'sneaky',
        color: '#333',
        createdBy: accountId,
      }),
    ).rejects.toThrow(WorkspaceScopeError);

    const none = await database.db.select().from(labels).where(eq(labels.name, 'sneaky'));
    expect(none).toHaveLength(0);
  });
});

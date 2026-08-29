import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseClient, runMigrations, type DatabaseClient } from '@promaly/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIdentityService } from './identity.js';
import { createIssuesService, IssueRelationError, RevisionConflictError } from './issues.js';
import { createProjectManagementService } from './project-management.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('issues lifecycle', () => {
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

  it('numbers issues atomically, rejects stale revisions, and blocks relation cycles', async () => {
    const identity = createIdentityService(database);
    const projects = createProjectManagementService(database);
    const issueService = createIssuesService(database);
    const owner = await identity.register(
      { email: 'issues@example.com', password: 'a-very-secure-password', workspaceName: 'Issues' },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;
    const project = await projects.createProject(
      workspaceId,
      owner.account.id,
      { key: 'ISSUE', name: 'Issues' },
      {},
    );

    const first = await issueService.createIssue(
      workspaceId,
      owner.account.id,
      { projectId: project.id, title: 'First issue' },
      {},
    );
    const second = await issueService.createIssue(
      workspaceId,
      owner.account.id,
      { projectId: project.id, title: 'Second issue' },
      {},
    );
    expect([first.number, second.number]).toEqual([1, 2]);

    const updated = await issueService.updateIssue(
      workspaceId,
      owner.account.id,
      first.id,
      first.revision,
      { title: 'Updated issue' },
    );
    await expect(
      issueService.updateIssue(workspaceId, owner.account.id, first.id, first.revision, {
        title: 'Stale update',
      }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect(updated.revision).toBe(first.revision + 1);

    await issueService.createRelation(workspaceId, owner.account.id, first.id, second.id, 'blocks');
    await expect(
      issueService.createRelation(workspaceId, owner.account.id, second.id, first.id, 'blocks'),
    ).rejects.toBeInstanceOf(IssueRelationError);
  });
});

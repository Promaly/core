import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseClient, runMigrations, type DatabaseClient } from '@promaly/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictError, createIdentityService } from './identity.js';
import { createIssuesService, IssueRelationError, RevisionConflictError } from './issues.js';
import {
  createProjectManagementService,
  ProjectKeyLockedError,
  WorkflowInvariantError,
} from './project-management.js';

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

  let counter = 0;
  async function setup() {
    const identity = createIdentityService(database);
    const projects = createProjectManagementService(database);
    const issues = createIssuesService(database);
    counter += 1;
    const owner = await identity.register(
      {
        email: `issues${counter}@example.com`,
        password: 'a-very-secure-password',
        workspaceName: `Issues ${counter}`,
      },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;
    const actorId = owner.account.id;
    const project = await projects.createProject(
      workspaceId,
      actorId,
      { key: `PRJ${counter}`, name: 'Project' },
      {},
    );
    const workflow = (await projects.listWorkflows(workspaceId)).items.find((w) => w.isDefault)!;
    return { workspaceId, actorId, projects, issues, project, workflow };
  }

  it('numbers issues atomically, rejects stale revisions, and blocks relation cycles', async () => {
    const s = await setup();
    const first = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'First issue' },
      {},
    );
    const second = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'Second issue' },
      {},
    );
    expect([first.number, second.number]).toEqual([1, 2]);

    await s.issues.updateIssue(s.workspaceId, s.actorId, first.id, first.revision, {
      title: 'Updated',
    });
    await expect(
      s.issues.updateIssue(s.workspaceId, s.actorId, first.id, first.revision, { title: 'Stale' }),
    ).rejects.toBeInstanceOf(RevisionConflictError);

    await s.issues.createRelation(s.workspaceId, s.actorId, first.id, second.id, 'blocks');
    await expect(
      s.issues.createRelation(s.workspaceId, s.actorId, second.id, first.id, 'blocks'),
    ).rejects.toBeInstanceOf(IssueRelationError);
    await expect(
      s.issues.createRelation(s.workspaceId, s.actorId, first.id, second.id, 'blocks'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('stamps completed_at on entering a completed state and clears it on reopen', async () => {
    const s = await setup();
    const started = s.workflow.states.find((state) => state.category === 'started')!;
    const completed = s.workflow.states.find((state) => state.category === 'completed')!;
    const issue = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'Ship it' },
      {},
    );

    const done = await s.issues.updateIssue(s.workspaceId, s.actorId, issue.id, issue.revision, {
      stateId: completed.id,
    });
    expect(done.completedAt).not.toBeNull();
    expect(done.startedAt).not.toBeNull();

    const reopened = await s.issues.updateIssue(s.workspaceId, s.actorId, issue.id, done.revision, {
      stateId: started.id,
    });
    expect(reopened.completedAt).toBeNull();
    expect(reopened.startedAt).not.toBeNull();
  });

  it('paginates a non-default sort with a keyset cursor', async () => {
    const s = await setup();
    for (let i = 0; i < 5; i += 1) {
      await s.issues.createIssue(
        s.workspaceId,
        s.actorId,
        { projectId: s.project.id, title: `Issue ${i}`, priority: i % 3 },
        {},
      );
    }
    const first = await s.issues.listIssues(s.workspaceId, {
      limit: 2,
      sort: 'priority',
      groupBy: 'none',
    });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await s.issues.listIssues(s.workspaceId, {
      limit: 2,
      sort: 'priority',
      groupBy: 'none',
      cursor: first.nextCursor!,
    });
    const firstIds = new Set(first.items.map((issue) => issue.id));
    expect(second.items.every((issue) => !firstIds.has(issue.id))).toBe(true);
  });

  it('reports per-item outcomes from a bulk update', async () => {
    const s = await setup();
    const a = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'A' },
      {},
    );
    const b = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'B' },
      {},
    );
    const results = await s.issues.bulkUpdate(s.workspaceId, s.actorId, [
      { id: a.id, revision: a.revision, priority: 3 },
      { id: b.id, revision: b.revision + 5, priority: 3 },
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(results[1]).toMatchObject({ ok: false, reason: 'revision_conflict' });
  });

  it('ranks a full-text search hit', async () => {
    const s = await setup();
    await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      {
        projectId: s.project.id,
        title: 'Payment webhook retries',
        description: 'exponential backoff',
      },
      {},
    );
    await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'Unrelated' },
      {},
    );
    const hits = await s.issues.searchIssues(s.workspaceId, 'webhook backoff');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe('Payment webhook retries');
  });

  it('rejects a sub-issue that would form a parent cycle', async () => {
    const s = await setup();
    const parent = await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'Parent' },
      {},
    );
    const child = await s.issues.createSubIssue(
      s.workspaceId,
      s.actorId,
      parent.id,
      { title: 'Child' },
      {},
    );
    await expect(
      s.issues.updateIssue(s.workspaceId, s.actorId, parent.id, parent.revision, {
        parentIssueId: child.id,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('reorders workflow states without a unique-index collision', async () => {
    const s = await setup();
    const ids = [...s.workflow.states]
      .sort((a, b) => a.position - b.position)
      .map((state) => state.id);
    const reversed = [...ids].reverse();
    await s.projects.reorderWorkflowStates(s.workspaceId, s.actorId, s.workflow.id, reversed, {});
    const after = await s.projects.getWorkflow(s.workspaceId, s.workflow.id);
    expect(after.states.map((state) => state.id)).toEqual(reversed);
    expect(after.states.map((state) => state.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it('will not run a project on a workflow with no started/completed states', async () => {
    const s = await setup();
    const empty = await s.projects.createWorkflow(s.workspaceId, s.actorId, { name: 'Empty' }, {});
    await expect(
      s.projects.createProject(
        s.workspaceId,
        s.actorId,
        { key: 'EMPTY', name: 'Empty', workflowId: empty.id },
        {},
      ),
    ).rejects.toBeInstanceOf(WorkflowInvariantError);
  });

  it('locks a project workflow once it has issues', async () => {
    const s = await setup();
    await s.issues.createIssue(
      s.workspaceId,
      s.actorId,
      { projectId: s.project.id, title: 'Anchor' },
      {},
    );
    const other = await s.projects.createWorkflow(s.workspaceId, s.actorId, { name: 'Other' }, {});
    await s.projects.createWorkflowState(
      s.workspaceId,
      s.actorId,
      other.id,
      {
        name: 'Doing',
        category: 'started',
        color: '#3b82f6',
      },
      {},
    );
    await s.projects.createWorkflowState(
      s.workspaceId,
      s.actorId,
      other.id,
      {
        name: 'Done',
        category: 'completed',
        color: '#22c55e',
      },
      {},
    );
    await expect(
      s.projects.updateProject(
        s.workspaceId,
        s.actorId,
        s.project.id,
        { workflowId: other.id },
        {},
      ),
    ).rejects.toBeInstanceOf(ProjectKeyLockedError);
  });
});

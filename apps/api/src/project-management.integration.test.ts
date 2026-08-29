import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseClient, runMigrations, type DatabaseClient } from '@promaly/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictError, createIdentityService } from './identity.js';
import { createProjectManagementService, WorkflowInvariantError } from './project-management.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('project management lifecycle', () => {
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

  it('creates a project from the default workflow and hides it once archived', async () => {
    const identity = createIdentityService(database);
    const management = createProjectManagementService(database);
    const owner = await identity.register(
      {
        email: 'projects@example.com',
        password: 'a-very-secure-password',
        workspaceName: 'Projects',
      },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;
    const workflows = await management.listWorkflows(workspaceId);
    const defaultWorkflow = workflows.items.find((workflow) => workflow.isDefault)!;

    const project = await management.createProject(
      workspaceId,
      owner.account.id,
      { key: 'CORE', name: 'Core', description: 'Promaly core' },
      {},
    );
    expect(project.workflowId).toBe(defaultWorkflow.id);
    expect(
      (await management.listProjects(workspaceId, { limit: 50, includeArchived: false })).items,
    ).toHaveLength(1);

    await management.setProjectArchived(workspaceId, owner.account.id, project.id, true, {});
    expect(
      (await management.listProjects(workspaceId, { limit: 50, includeArchived: false })).items,
    ).toHaveLength(0);
    expect(
      (await management.listProjects(workspaceId, { limit: 50, includeArchived: true })).items,
    ).toHaveLength(1);
  });

  it('enforces workflow category invariants and label scope uniqueness', async () => {
    const identity = createIdentityService(database);
    const management = createProjectManagementService(database);
    const owner = await identity.register(
      {
        email: 'workflow@example.com',
        password: 'a-very-secure-password',
        workspaceName: 'Workflow',
      },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;
    const workflow = (await management.listWorkflows(workspaceId)).items.find(
      (item) => item.isDefault,
    )!;
    const started = workflow.states.find((state) => state.category === 'started')!;

    await expect(
      management.deleteWorkflowState(workspaceId, owner.account.id, workflow.id, started.id, {}),
    ).rejects.toBeInstanceOf(WorkflowInvariantError);

    await management.createLabel(
      workspaceId,
      owner.account.id,
      { name: 'Bug', color: '#ef4444' },
      {},
    );
    await expect(
      management.createLabel(workspaceId, owner.account.id, { name: 'bug', color: '#ef4444' }, {}),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects adding an account from a different workspace to a team', async () => {
    const identity = createIdentityService(database);
    const management = createProjectManagementService(database);
    const owner = await identity.register(
      {
        email: 'team-owner@example.com',
        password: 'a-very-secure-password',
        workspaceName: 'Teams',
      },
      {},
    );
    const outsider = await identity.register(
      { email: 'outsider@example.com', password: 'a-very-secure-password', workspaceName: 'Other' },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;
    const team = await management.createTeam(
      workspaceId,
      owner.account.id,
      { name: 'Platform', key: 'PLAT' },
      {},
    );

    await expect(
      management.addTeamMember(workspaceId, owner.account.id, team.id, outsider.account.id, {}),
    ).rejects.toThrow(/member not found/i);
  });
});

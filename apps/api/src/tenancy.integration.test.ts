import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDatabaseClient, runMigrations, type DatabaseClient } from '@promaly/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictError, createIdentityService } from './identity.js';
import { LastOwnerError, createTenancyService } from './tenancy.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';

describe.skipIf(!shouldRun)('identity and tenancy lifecycle', () => {
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

  it('accepts an invitation, changes the member role, and lets that member leave', async () => {
    const identity = createIdentityService(database);
    const tenancy = createTenancyService(database);
    const owner = await identity.register(
      { email: 'owner@example.com', password: 'a-very-secure-password', workspaceName: 'Acme' },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;

    await tenancy.createInvitation(
      workspaceId,
      owner.account.id,
      'member@example.com',
      'member',
      {},
    );
    const message = (
      await database.raw<{ text: string }[]>`
        select payload ->> 'text' as text from outbox_events
        where workspace_id = ${workspaceId}::uuid and type = 'email.send'
        order by created_at desc limit 1`
    )[0]!.text;
    const token = message.match(/token within seven days: ([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeDefined();

    const accepted = await tenancy.acceptInvitation(
      token!,
      undefined,
      'a-second-secure-password',
      {},
    );
    expect(accepted.role).toBe('member');
    await tenancy.updateMemberRole(workspaceId, owner.account.id, accepted.accountId, 'admin', {});
    expect(
      (await tenancy.listMembers(workspaceId)).find(
        (member) => member.accountId === accepted.accountId,
      )?.role,
    ).toBe('admin');

    await tenancy.removeMember(workspaceId, accepted.accountId, accepted.accountId, {});
    expect(
      (await tenancy.listMembers(workspaceId)).some(
        (member) => member.accountId === accepted.accountId,
      ),
    ).toBe(false);
  });

  it('invalidates every session when a password reset token is consumed', async () => {
    const identity = createIdentityService(database);
    const account = await identity.register(
      { email: 'reset@example.com', password: 'a-very-secure-password', workspaceName: 'Reset' },
      {},
    );
    await identity.requestPasswordReset(account.account.email);
    const message = (
      await database.raw<{ text: string }[]>`
        select payload ->> 'text' as text from outbox_events
        where aggregate_id = ${account.account.id}::uuid and type = 'email.send'
        order by created_at desc limit 1`
    )[0]!.text;
    const token = message.match(/one hour: ([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeDefined();

    await identity.resetPassword(token!, 'a-replaced-secure-password');
    await expect(identity.getSession(account.token.value)).resolves.toBeNull();
    await expect(identity.resetPassword(token!, 'another-secure-password')).rejects.toThrow(
      /invalid|expired/i,
    );
  });

  it('does not allow the final owner to be removed or demoted', async () => {
    const identity = createIdentityService(database);
    const tenancy = createTenancyService(database);
    const owner = await identity.register(
      {
        email: 'sole-owner@example.com',
        password: 'a-very-secure-password',
        workspaceName: 'Solo',
      },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;

    await expect(
      tenancy.updateMemberRole(workspaceId, owner.account.id, owner.account.id, 'admin', {}),
    ).rejects.toBeInstanceOf(LastOwnerError);
    await expect(
      tenancy.removeMember(workspaceId, owner.account.id, owner.account.id, {}),
    ).rejects.toBeInstanceOf(LastOwnerError);
  });

  it('rejects inviting an existing member and supersedes a pending invite', async () => {
    const identity = createIdentityService(database);
    const tenancy = createTenancyService(database);
    const owner = await identity.register(
      { email: 'inv-owner@example.com', password: 'a-very-secure-password', workspaceName: 'Inv' },
      {},
    );
    const workspaceId = owner.workspaces[0]!.id;

    await expect(
      tenancy.createInvitation(
        workspaceId,
        owner.account.id,
        'inv-owner@example.com',
        'member',
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await tenancy.createInvitation(workspaceId, owner.account.id, 'dupe@example.com', 'member', {});
    await tenancy.createInvitation(workspaceId, owner.account.id, 'dupe@example.com', 'admin', {});
    const pending = (await tenancy.listInvitations(workspaceId)).filter(
      (invitation) => invitation.email === 'dupe@example.com',
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]!.role).toBe('admin');
  });

  it('provisions a default workflow when a workspace is created directly', async () => {
    const identity = createIdentityService(database);
    const tenancy = createTenancyService(database);
    const account = await identity.register(
      {
        email: 'second-ws@example.com',
        password: 'a-very-secure-password',
        workspaceName: 'First',
      },
      {},
    );
    const workspace = await tenancy.createWorkspace(account.account.id, { name: 'Second' }, {});

    const states = await database.raw<{ category: string }[]>`
      select ws.category
      from workflow_states ws
      join workflows w on w.id = ws.workflow_id
      where w.workspace_id = ${workspace.id}::uuid and w.is_default
      order by ws.position`;
    expect(states.map((state) => state.category)).toEqual([
      'backlog',
      'unstarted',
      'started',
      'completed',
      'cancelled',
    ]);
  });

  it('rotates the session on login', async () => {
    const identity = createIdentityService(database);
    const first = await identity.register(
      { email: 'rotate@example.com', password: 'a-very-secure-password', workspaceName: 'Rotate' },
      {},
    );
    await expect(identity.getSession(first.token.value)).resolves.not.toBeNull();

    await identity.login(
      { email: 'rotate@example.com', password: 'a-very-secure-password' },
      {},
      first.token.value,
    );
    await expect(identity.getSession(first.token.value)).resolves.toBeNull();
  });
});

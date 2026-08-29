import { and, asc, count, desc, eq, gt, inArray, isNull, lt } from 'drizzle-orm';
import {
  accounts,
  auditEvents,
  emit,
  issues,
  labels,
  projectIssueCounters,
  projects,
  teamMembers,
  teams,
  type DatabaseClient,
  type DbTransaction,
  workflowStates,
  workflows,
  workspaceMembers,
} from '@promaly/db';
import { newId } from '@promaly/domain';
import { ConflictError } from './identity.js';
import { TenancyNotFoundError } from './tenancy.js';

type Metadata = { ipAddress?: string | undefined };
type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export class WorkflowInvariantError extends Error {}
export class ProjectKeyLockedError extends Error {}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function audit(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | undefined;
    eventType:
      | 'team.created'
      | 'team.updated'
      | 'team.deleted'
      | 'team.members.changed'
      | 'workflow.created'
      | 'workflow.updated'
      | 'workflow.state.changed'
      | 'project.created'
      | 'project.updated'
      | 'project.archived'
      | 'project.unarchived'
      | 'label.created'
      | 'label.updated'
      | 'label.deleted';
  },
) {
  await tx.insert(auditEvents).values({
    id: newId(),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress,
  });
  await emit(tx, {
    id: newId(),
    workspaceId: input.workspaceId,
    aggregateType: input.targetType,
    aggregateId: input.targetId,
    type: input.eventType,
    payload: input.metadata ?? {},
  });
}

async function requireMember(tx: DbTransaction, workspaceId: string, accountId: string) {
  const member = (
    await tx
      .select({ id: workspaceMembers.accountId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.accountId, accountId),
        ),
      )
      .limit(1)
  )[0];
  if (!member) throw new TenancyNotFoundError('Workspace member not found.');
}

async function requireTeam(tx: DbTransaction, workspaceId: string, teamId: string) {
  const team = (
    await tx
      .select()
      .from(teams)
      .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
      .limit(1)
  )[0];
  if (!team) throw new TenancyNotFoundError('Team not found.');
  return team;
}

async function requireWorkflow(tx: DbTransaction, workspaceId: string, workflowId: string) {
  const workflow = (
    await tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.id, workflowId)))
      .limit(1)
  )[0];
  if (!workflow) throw new TenancyNotFoundError('Workflow not found.');
  return workflow;
}

async function requireProject(tx: DbTransaction, workspaceId: string, projectId: string) {
  const project = (
    await tx
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
      .limit(1)
  )[0];
  if (!project) throw new TenancyNotFoundError('Project not found.');
  return project;
}

function pageCursor(rows: { id: string }[], limit: number) {
  return rows.length === limit ? (rows.at(-1)?.id ?? null) : null;
}

export type ProjectManagementService = ReturnType<typeof createProjectManagementService>;

/**
 * Workspace-owned project-management records are always looked up with their
 * `workspace_id` here, before a mutation. This keeps route handlers free of
 * tenant predicates and ensures a foreign ID resolves as a 404.
 */
export function createProjectManagementService(database: DatabaseClient) {
  const { db } = database;

  return {
    async createTeam(
      workspaceId: string,
      actorId: string,
      input: { name: string; key: string },
      metadata: Metadata,
    ) {
      const id = newId();
      try {
        await db.transaction(async (tx) => {
          await tx.insert(teams).values({
            id,
            workspaceId,
            name: input.name.trim(),
            key: input.key,
            createdBy: actorId,
          });
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'team.created',
            targetType: 'team',
            targetId: id,
            metadata: input,
            ipAddress: metadata.ipAddress,
            eventType: 'team.created',
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('A team already uses this key.');
        throw error;
      }
      return { id, name: input.name.trim(), key: input.key };
    },

    async listTeams(workspaceId: string, cursor?: string, limit = 50) {
      const rows = await db
        .select()
        .from(teams)
        .where(
          cursor
            ? and(eq(teams.workspaceId, workspaceId), gt(teams.id, cursor))
            : eq(teams.workspaceId, workspaceId),
        )
        .orderBy(asc(teams.id))
        .limit(limit);
      return { items: rows, nextCursor: pageCursor(rows, limit) };
    },

    async updateTeam(
      workspaceId: string,
      actorId: string,
      teamId: string,
      input: { name?: string | undefined; key?: string | undefined },
      metadata: Metadata,
    ) {
      try {
        return await db.transaction(async (tx) => {
          await requireTeam(tx, workspaceId, teamId);
          const updated = await tx
            .update(teams)
            .set({ name: input.name?.trim(), key: input.key })
            .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
            .returning();
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'team.updated',
            targetType: 'team',
            targetId: teamId,
            metadata: input,
            ipAddress: metadata.ipAddress,
            eventType: 'team.updated',
          });
          return updated[0]!;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('A team already uses this key.');
        throw error;
      }
    },

    async deleteTeam(workspaceId: string, actorId: string, teamId: string, metadata: Metadata) {
      await db.transaction(async (tx) => {
        await requireTeam(tx, workspaceId, teamId);
        await tx.delete(teams).where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)));
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'team.deleted',
          targetType: 'team',
          targetId: teamId,
          ipAddress: metadata.ipAddress,
          eventType: 'team.deleted',
        });
      });
    },

    async listTeamMembers(workspaceId: string, teamId: string) {
      return db.transaction(async (tx) => {
        await requireTeam(tx, workspaceId, teamId);
        return tx
          .select({ accountId: accounts.id, email: accounts.email })
          .from(teamMembers)
          .innerJoin(accounts, eq(accounts.id, teamMembers.accountId))
          .where(eq(teamMembers.teamId, teamId));
      });
    },

    async addTeamMember(
      workspaceId: string,
      actorId: string,
      teamId: string,
      accountId: string,
      metadata: Metadata,
    ) {
      await db.transaction(async (tx) => {
        await requireTeam(tx, workspaceId, teamId);
        await requireMember(tx, workspaceId, accountId);
        await tx.insert(teamMembers).values({ teamId, accountId }).onConflictDoNothing();
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'team.member_added',
          targetType: 'team',
          targetId: teamId,
          metadata: { accountId },
          ipAddress: metadata.ipAddress,
          eventType: 'team.members.changed',
        });
      });
    },

    async removeTeamMember(
      workspaceId: string,
      actorId: string,
      teamId: string,
      accountId: string,
      metadata: Metadata,
    ) {
      await db.transaction(async (tx) => {
        await requireTeam(tx, workspaceId, teamId);
        await tx
          .delete(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.accountId, accountId)));
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'team.member_removed',
          targetType: 'team',
          targetId: teamId,
          metadata: { accountId },
          ipAddress: metadata.ipAddress,
          eventType: 'team.members.changed',
        });
      });
    },

    async listWorkflows(workspaceId: string, cursor?: string, limit = 50) {
      const rows = await db
        .select()
        .from(workflows)
        .where(
          cursor
            ? and(eq(workflows.workspaceId, workspaceId), gt(workflows.id, cursor))
            : eq(workflows.workspaceId, workspaceId),
        )
        .orderBy(asc(workflows.id))
        .limit(limit);
      const ids = rows.map((workflow) => workflow.id);
      const states = ids.length
        ? await db
            .select()
            .from(workflowStates)
            .where(inArray(workflowStates.workflowId, ids))
            .orderBy(asc(workflowStates.position))
        : [];
      return {
        items: rows.map((workflow) => ({
          ...workflow,
          states: states.filter((state) => state.workflowId === workflow.id),
        })),
        nextCursor: pageCursor(rows, limit),
      };
    },

    async createWorkflow(
      workspaceId: string,
      actorId: string,
      input: { name: string; isDefault?: boolean | undefined },
      metadata: Metadata,
    ) {
      const id = newId();
      await db.transaction(async (tx) => {
        if (input.isDefault)
          await tx
            .update(workflows)
            .set({ isDefault: false })
            .where(eq(workflows.workspaceId, workspaceId));
        await tx.insert(workflows).values({
          id,
          workspaceId,
          name: input.name.trim(),
          isDefault: input.isDefault ?? false,
          createdBy: actorId,
        });
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.created',
          targetType: 'workflow',
          targetId: id,
          metadata: input,
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.created',
        });
      });
      return { id, name: input.name.trim(), isDefault: input.isDefault ?? false };
    },

    async updateWorkflow(
      workspaceId: string,
      actorId: string,
      workflowId: string,
      input: { name?: string | undefined; isDefault?: boolean | undefined },
      metadata: Metadata,
    ) {
      return db.transaction(async (tx) => {
        await requireWorkflow(tx, workspaceId, workflowId);
        if (input.isDefault)
          await tx
            .update(workflows)
            .set({ isDefault: false })
            .where(eq(workflows.workspaceId, workspaceId));
        const updated = await tx
          .update(workflows)
          .set({ name: input.name?.trim(), isDefault: input.isDefault })
          .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.id, workflowId)))
          .returning();
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.updated',
          targetType: 'workflow',
          targetId: workflowId,
          metadata: input,
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.updated',
        });
        return updated[0]!;
      });
    },

    async createWorkflowState(
      workspaceId: string,
      actorId: string,
      workflowId: string,
      input: { name: string; category: StateCategory; color: string },
      metadata: Metadata,
    ) {
      const id = newId();
      return db.transaction(async (tx) => {
        await requireWorkflow(tx, workspaceId, workflowId);
        const current = await tx
          .select({ value: count() })
          .from(workflowStates)
          .where(eq(workflowStates.workflowId, workflowId));
        const position = current[0]?.value ?? 0;
        const created = await tx
          .insert(workflowStates)
          .values({
            id,
            workflowId,
            name: input.name.trim(),
            category: input.category,
            color: input.color,
            position,
          })
          .returning();
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.state_created',
          targetType: 'workflow_state',
          targetId: id,
          metadata: { workflowId, ...input },
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.state.changed',
        });
        return created[0]!;
      });
    },

    async updateWorkflowState(
      workspaceId: string,
      actorId: string,
      workflowId: string,
      stateId: string,
      input: { name?: string | undefined; color?: string | undefined },
      metadata: Metadata,
    ) {
      return db.transaction(async (tx) => {
        await requireWorkflow(tx, workspaceId, workflowId);
        const existing = (
          await tx
            .select()
            .from(workflowStates)
            .where(and(eq(workflowStates.workflowId, workflowId), eq(workflowStates.id, stateId)))
            .limit(1)
        )[0];
        if (!existing) throw new TenancyNotFoundError('Workflow state not found.');
        const updated = await tx
          .update(workflowStates)
          .set({ name: input.name?.trim(), color: input.color })
          .where(eq(workflowStates.id, stateId))
          .returning();
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.state_updated',
          targetType: 'workflow_state',
          targetId: stateId,
          metadata: input,
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.state.changed',
        });
        return updated[0]!;
      });
    },

    async deleteWorkflowState(
      workspaceId: string,
      actorId: string,
      workflowId: string,
      stateId: string,
      metadata: Metadata,
    ) {
      await db.transaction(async (tx) => {
        await requireWorkflow(tx, workspaceId, workflowId);
        const state = (
          await tx
            .select()
            .from(workflowStates)
            .where(and(eq(workflowStates.workflowId, workflowId), eq(workflowStates.id, stateId)))
            .limit(1)
        )[0];
        if (!state) throw new TenancyNotFoundError('Workflow state not found.');
        const all = await tx
          .select({ category: workflowStates.category })
          .from(workflowStates)
          .where(eq(workflowStates.workflowId, workflowId));
        if (
          (state.category === 'started' &&
            all.filter((item) => item.category === 'started').length <= 1) ||
          (state.category === 'completed' &&
            all.filter((item) => item.category === 'completed').length <= 1)
        ) {
          throw new WorkflowInvariantError(
            'A workflow must include at least one started and one completed state.',
          );
        }
        await tx.delete(workflowStates).where(eq(workflowStates.id, stateId));
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.state_deleted',
          targetType: 'workflow_state',
          targetId: stateId,
          metadata: { workflowId },
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.state.changed',
        });
      });
    },

    async reorderWorkflowStates(
      workspaceId: string,
      actorId: string,
      workflowId: string,
      stateIds: string[],
      metadata: Metadata,
    ) {
      await db.transaction(async (tx) => {
        await requireWorkflow(tx, workspaceId, workflowId);
        const states = await tx
          .select({ id: workflowStates.id })
          .from(workflowStates)
          .where(eq(workflowStates.workflowId, workflowId));
        if (
          states.length !== stateIds.length ||
          new Set(stateIds).size !== stateIds.length ||
          states.some((state) => !stateIds.includes(state.id))
        ) {
          throw new WorkflowInvariantError(
            'State order must contain every workflow state exactly once.',
          );
        }
        await Promise.all(
          stateIds.map((id, position) =>
            tx
              .update(workflowStates)
              .set({ position })
              .where(and(eq(workflowStates.workflowId, workflowId), eq(workflowStates.id, id))),
          ),
        );
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'workflow.states_reordered',
          targetType: 'workflow',
          targetId: workflowId,
          metadata: { stateIds },
          ipAddress: metadata.ipAddress,
          eventType: 'workflow.state.changed',
        });
      });
    },

    async createProject(
      workspaceId: string,
      actorId: string,
      input: {
        key: string;
        name: string;
        description?: string | undefined;
        teamId?: string | undefined;
        leadId?: string | undefined;
        workflowId?: string | undefined;
        icon?: string | undefined;
        color?: string | undefined;
      },
      metadata: Metadata,
    ) {
      const id = newId();
      try {
        return await db.transaction(async (tx) => {
          if (input.teamId) await requireTeam(tx, workspaceId, input.teamId);
          if (input.leadId) await requireMember(tx, workspaceId, input.leadId);
          const workflow = input.workflowId
            ? await requireWorkflow(tx, workspaceId, input.workflowId)
            : (
                await tx
                  .select()
                  .from(workflows)
                  .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.isDefault, true)))
                  .limit(1)
              )[0];
          if (!workflow) throw new WorkflowInvariantError('A project needs a workspace workflow.');
          const created = await tx
            .insert(projects)
            .values({
              id,
              workspaceId,
              key: input.key,
              name: input.name.trim(),
              description: input.description ?? '',
              teamId: input.teamId,
              leadId: input.leadId,
              workflowId: workflow.id,
              icon: input.icon,
              color: input.color,
              createdBy: actorId,
            })
            .returning();
          await tx.insert(projectIssueCounters).values({ projectId: id, nextNumber: 1 });
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'project.created',
            targetType: 'project',
            targetId: id,
            metadata: { ...input, workflowId: workflow.id },
            ipAddress: metadata.ipAddress,
            eventType: 'project.created',
          });
          return created[0]!;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('A project already uses this key.');
        throw error;
      }
    },

    async listProjects(
      workspaceId: string,
      options: { cursor?: string | undefined; limit: number; includeArchived: boolean },
    ) {
      const predicate = options.includeArchived
        ? eq(projects.workspaceId, workspaceId)
        : and(eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt));
      const rows = await db
        .select()
        .from(projects)
        .where(options.cursor ? and(predicate, lt(projects.id, options.cursor)) : predicate)
        .orderBy(desc(projects.id))
        .limit(options.limit);
      return { items: rows, nextCursor: pageCursor(rows, options.limit) };
    },

    async updateProject(
      workspaceId: string,
      actorId: string,
      projectId: string,
      input: {
        key?: string | undefined;
        name?: string | undefined;
        description?: string | undefined;
        teamId?: string | undefined;
        leadId?: string | undefined;
        workflowId?: string | undefined;
        icon?: string | undefined;
        color?: string | undefined;
      },
      metadata: Metadata,
    ) {
      try {
        return await db.transaction(async (tx) => {
          const existing = await requireProject(tx, workspaceId, projectId);
          if (input.key && input.key !== existing.key) {
            const anyIssue = (
              await tx
                .select({ id: issues.id })
                .from(issues)
                .where(eq(issues.projectId, projectId))
                .limit(1)
            )[0];
            if (anyIssue)
              throw new ProjectKeyLockedError('A project key cannot change after its first issue.');
          }
          if (input.teamId) await requireTeam(tx, workspaceId, input.teamId);
          if (input.leadId) await requireMember(tx, workspaceId, input.leadId);
          if (input.workflowId) await requireWorkflow(tx, workspaceId, input.workflowId);
          const updated = await tx
            .update(projects)
            .set({ ...input, name: input.name?.trim() })
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
            .returning();
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'project.updated',
            targetType: 'project',
            targetId: projectId,
            metadata: input,
            ipAddress: metadata.ipAddress,
            eventType: 'project.updated',
          });
          return updated[0]!;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('A project already uses this key.');
        throw error;
      }
    },

    async setProjectArchived(
      workspaceId: string,
      actorId: string,
      projectId: string,
      archived: boolean,
      metadata: Metadata,
    ) {
      return db.transaction(async (tx) => {
        await requireProject(tx, workspaceId, projectId);
        const updated = await tx
          .update(projects)
          .set({
            status: archived ? 'archived' : 'active',
            archivedAt: archived ? new Date() : null,
          })
          .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
          .returning();
        await audit(tx, {
          workspaceId,
          actorId,
          action: archived ? 'project.archived' : 'project.unarchived',
          targetType: 'project',
          targetId: projectId,
          metadata: { archived },
          ipAddress: metadata.ipAddress,
          eventType: archived ? 'project.archived' : 'project.unarchived',
        });
        return updated[0]!;
      });
    },

    async createLabel(
      workspaceId: string,
      actorId: string,
      input: { name: string; color: string; projectId?: string | undefined },
      metadata: Metadata,
    ) {
      const id = newId();
      try {
        return await db.transaction(async (tx) => {
          if (input.projectId) await requireProject(tx, workspaceId, input.projectId);
          const created = await tx
            .insert(labels)
            .values({
              id,
              workspaceId,
              name: input.name.trim(),
              color: input.color,
              projectId: input.projectId,
              createdBy: actorId,
            })
            .returning();
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'label.created',
            targetType: 'label',
            targetId: id,
            metadata: input,
            ipAddress: metadata.ipAddress,
            eventType: 'label.created',
          });
          return created[0]!;
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new ConflictError('A label already uses this name in this scope.');
        throw error;
      }
    },

    async listLabels(workspaceId: string, cursor?: string, limit = 50) {
      const rows = await db
        .select()
        .from(labels)
        .where(
          cursor
            ? and(eq(labels.workspaceId, workspaceId), gt(labels.id, cursor))
            : eq(labels.workspaceId, workspaceId),
        )
        .orderBy(asc(labels.id))
        .limit(limit);
      return { items: rows, nextCursor: pageCursor(rows, limit) };
    },

    async getLabel(workspaceId: string, labelId: string) {
      const label = (
        await db
          .select()
          .from(labels)
          .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
          .limit(1)
      )[0];
      if (!label) throw new TenancyNotFoundError('Label not found.');
      return label;
    },

    async updateLabel(
      workspaceId: string,
      actorId: string,
      labelId: string,
      input: { name?: string | undefined; color?: string | undefined },
      metadata: Metadata,
    ) {
      try {
        return await db.transaction(async (tx) => {
          const label = (
            await tx
              .select()
              .from(labels)
              .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
              .limit(1)
          )[0];
          if (!label) throw new TenancyNotFoundError('Label not found.');
          const updated = await tx
            .update(labels)
            .set({ name: input.name?.trim(), color: input.color })
            .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
            .returning();
          await audit(tx, {
            workspaceId,
            actorId,
            action: 'label.updated',
            targetType: 'label',
            targetId: labelId,
            metadata: input,
            ipAddress: metadata.ipAddress,
            eventType: 'label.updated',
          });
          return updated[0]!;
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new ConflictError('A label already uses this name in this scope.');
        throw error;
      }
    },

    async deleteLabel(workspaceId: string, actorId: string, labelId: string, metadata: Metadata) {
      await db.transaction(async (tx) => {
        const label = (
          await tx
            .select({ id: labels.id })
            .from(labels)
            .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
            .limit(1)
        )[0];
        if (!label) throw new TenancyNotFoundError('Label not found.');
        await tx
          .delete(labels)
          .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)));
        await audit(tx, {
          workspaceId,
          actorId,
          action: 'label.deleted',
          targetType: 'label',
          targetId: labelId,
          ipAddress: metadata.ipAddress,
          eventType: 'label.deleted',
        });
      });
    },
  };
}

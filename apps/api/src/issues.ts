import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  activityEvents,
  emit,
  isUniqueViolation,
  issueLabels,
  issueRelations,
  issues,
  labels,
  projectIssueCounters,
  projects,
  type DatabaseClient,
  type DbTransaction,
  workflowStates,
  workspaceMembers,
} from '@promaly/db';
import {
  initialIssueSortKey,
  newId,
  rebalanceIssueSortKeys,
  sortKeyBetween,
} from '@promaly/domain';
import { ConflictError } from './identity.js';
import { TenancyNotFoundError } from './tenancy.js';

type Metadata = { ipAddress?: string | undefined };
type IssuePatch = {
  title?: string | undefined;
  description?: string | undefined;
  stateId?: string | undefined;
  priority?: number | undefined;
  assigneeId?: string | null | undefined;
  parentIssueId?: string | null | undefined;
  dueAt?: string | null | undefined;
  labelIds?: string[] | undefined;
};
type ListSort = 'manual' | 'priority' | 'updated' | 'created';
type OrderableRow = {
  sortKey: string;
  priority: number;
  updatedAt: Date;
  createdAt: Date;
  id: string;
};

export class RevisionConflictError extends Error {}
export class IssueRelationError extends Error {}

const SORT_COLUMN = {
  manual: issues.sortKey,
  priority: issues.priority,
  updated: issues.updatedAt,
  created: issues.createdAt,
} as const;

function sortValue(sort: ListSort, row: OrderableRow): string | number {
  if (sort === 'manual') return row.sortKey;
  if (sort === 'priority') return row.priority;
  return (sort === 'updated' ? row.updatedAt : row.createdAt).toISOString();
}

function encodeIssueCursor(sort: ListSort, row: OrderableRow) {
  return Buffer.from(JSON.stringify([sortValue(sort, row), row.id])).toString('base64url');
}

/** Keyset predicate that matches the same (sortColumn, id) ordering the list uses. */
function issueCursorPredicate(sort: ListSort, cursor: string): SQL | undefined {
  let parsed: [string | number, string];
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    return undefined;
  }
  const [value, id] = parsed;
  const column = SORT_COLUMN[sort];
  return sort === 'manual'
    ? sql`(${column}, ${issues.id}) > (${value}, ${id})`
    : sql`(${column}, ${issues.id}) < (${value}, ${id})`;
}

async function findIssue(tx: DbTransaction, workspaceId: string, issueId: string) {
  const issue = (
    await tx
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
      .limit(1)
  )[0];
  if (!issue) throw new TenancyNotFoundError('Issue not found.');
  return issue;
}

async function findProject(tx: DbTransaction, workspaceId: string, projectId: string) {
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

async function validateState(tx: DbTransaction, workflowId: string, stateId: string) {
  const state = (
    await tx
      .select()
      .from(workflowStates)
      .where(and(eq(workflowStates.workflowId, workflowId), eq(workflowStates.id, stateId)))
      .limit(1)
  )[0];
  if (!state) throw new TenancyNotFoundError('Workflow state not found.');
  return state;
}

async function defaultState(tx: DbTransaction, workflowId: string) {
  const states = await tx
    .select()
    .from(workflowStates)
    .where(eq(workflowStates.workflowId, workflowId))
    .orderBy(asc(workflowStates.position));
  const state = states.find((candidate) => candidate.category === 'unstarted') ?? states[0];
  if (!state) throw new TenancyNotFoundError('Workflow has no states.');
  return state;
}

type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

/**
 * `started_at` is stamped once the issue first enters a started/completed state
 * and never cleared. `completed_at` tracks the completed state exactly — set on
 * entering, cleared on leaving (a reopen).
 */
function stateTimestamps(
  category: StateCategory,
  current: { startedAt: Date | null; completedAt: Date | null },
) {
  const now = new Date();
  const patch: { startedAt?: Date | null; completedAt?: Date | null } = {};
  if ((category === 'started' || category === 'completed') && current.startedAt === null) {
    patch.startedAt = now;
  }
  if (category === 'completed') {
    if (current.completedAt === null) patch.completedAt = now;
  } else if (current.completedAt !== null) {
    patch.completedAt = null;
  }
  return patch;
}

async function validateMember(
  tx: DbTransaction,
  workspaceId: string,
  accountId: string | null | undefined,
) {
  if (!accountId) return;
  const membership = (
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
  if (!membership) throw new TenancyNotFoundError('Assignee is not a workspace member.');
}

async function validateParent(
  tx: DbTransaction,
  workspaceId: string,
  projectId: string,
  issueId: string | undefined,
  parentId: string | null | undefined,
) {
  if (!parentId) return;
  if (parentId === issueId) throw new ConflictError('An issue cannot be its own parent.');
  const parent = await findIssue(tx, workspaceId, parentId);
  if (parent.projectId !== projectId)
    throw new ConflictError('A sub-issue must use the same project.');

  // Walk the ancestor chain; reaching this issue would close a loop.
  const seen = new Set<string>([parentId]);
  let ancestor: string | null = parent.parentIssueId;
  while (ancestor) {
    if (ancestor === issueId) throw new ConflictError('A sub-issue cannot create a parent cycle.');
    if (seen.has(ancestor)) break;
    seen.add(ancestor);
    const next = (
      await tx
        .select({ parentIssueId: issues.parentIssueId })
        .from(issues)
        .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, ancestor)))
        .limit(1)
    )[0];
    ancestor = next?.parentIssueId ?? null;
  }
}

async function validateLabels(
  tx: DbTransaction,
  workspaceId: string,
  projectId: string,
  labelIds: string[] | undefined,
) {
  if (!labelIds) return;
  if (new Set(labelIds).size !== labelIds.length)
    throw new ConflictError('Duplicate labels are not allowed.');
  const found = await tx
    .select({ id: labels.id, projectId: labels.projectId })
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, labelIds)));
  if (
    found.length !== labelIds.length ||
    found.some((label) => label.projectId !== null && label.projectId !== projectId)
  ) {
    throw new TenancyNotFoundError('Label not found in this project scope.');
  }
}

async function replaceLabels(tx: DbTransaction, issueId: string, labelIds: string[]) {
  await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (labelIds.length) {
    await tx.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
  }
}

async function recordActivity(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    issueId: string;
    actorId: string;
    type: string;
    data: Record<string, unknown>;
    eventType:
      | 'issue.created'
      | 'issue.updated'
      | 'issue.archived'
      | 'issue.moved'
      | 'issue.relation.created'
      | 'issue.relation.deleted';
  },
) {
  await tx.insert(activityEvents).values({
    id: newId(),
    workspaceId: input.workspaceId,
    issueId: input.issueId,
    actorId: input.actorId,
    type: input.type,
    data: input.data,
  });
  await emit(tx, {
    id: newId(),
    workspaceId: input.workspaceId,
    aggregateType: 'issue',
    aggregateId: input.issueId,
    type: input.eventType,
    payload: input.data,
  });
}

async function issueWithLabels(tx: DbTransaction, workspaceId: string, issueId: string) {
  const issue = await findIssue(tx, workspaceId, issueId);
  const assignedLabels = await tx
    .select({ id: labels.id, name: labels.name, color: labels.color, projectId: labels.projectId })
    .from(issueLabels)
    .innerJoin(labels, eq(labels.id, issueLabels.labelId))
    .where(eq(issueLabels.issueId, issueId));
  return { ...issue, labels: assignedLabels };
}

async function reachesSource(
  tx: DbTransaction,
  workspaceId: string,
  sourceId: string,
  targetId: string,
) {
  const visited = new Set<string>();
  let frontier = [targetId];
  while (frontier.length) {
    if (frontier.includes(sourceId)) return true;
    const current = frontier.filter((id) => !visited.has(id));
    current.forEach((id) => visited.add(id));
    if (!current.length) return false;
    const edges = await tx
      .select({ targetId: issueRelations.targetIssueId })
      .from(issueRelations)
      .where(
        and(
          eq(issueRelations.workspaceId, workspaceId),
          eq(issueRelations.type, 'blocks'),
          inArray(issueRelations.sourceIssueId, current),
        ),
      );
    frontier = edges.map((edge) => edge.targetId);
  }
  return false;
}

export type IssuesService = ReturnType<typeof createIssuesService>;

export function createIssuesService(database: DatabaseClient) {
  const { db } = database;

  async function createIssue(
    workspaceId: string,
    actorId: string,
    input: {
      projectId: string;
      title: string;
      description?: string | undefined;
      stateId?: string | undefined;
      priority?: number | undefined;
      assigneeId?: string | null | undefined;
      parentIssueId?: string | null | undefined;
      dueAt?: string | null | undefined;
      labelIds?: string[] | undefined;
    },
    metadata: Metadata,
  ) {
    void metadata;
    return db.transaction(async (tx) => {
      const project = await findProject(tx, workspaceId, input.projectId);
      const state = input.stateId
        ? await validateState(tx, project.workflowId, input.stateId)
        : await defaultState(tx, project.workflowId);
      await validateMember(tx, workspaceId, input.assigneeId);
      await validateParent(tx, workspaceId, project.id, undefined, input.parentIssueId);
      await validateLabels(tx, workspaceId, project.id, input.labelIds);

      const counter = await tx
        .update(projectIssueCounters)
        .set({ nextNumber: sql`${projectIssueCounters.nextNumber} + 1` })
        .where(eq(projectIssueCounters.projectId, project.id))
        .returning({ nextNumber: projectIssueCounters.nextNumber });
      const number = (counter[0]?.nextNumber ?? 1) - 1;
      const id = newId();
      await tx
        .insert(issues)
        .values({
          id,
          workspaceId,
          projectId: project.id,
          number,
          title: input.title.trim(),
          description: input.description ?? '',
          stateId: state.id,
          priority: input.priority ?? 0,
          assigneeId: input.assigneeId ?? null,
          parentIssueId: input.parentIssueId ?? null,
          sortKey: initialIssueSortKey(),
          createdBy: actorId,
          startedAt: state.category === 'started' ? new Date() : null,
          completedAt: state.category === 'completed' ? new Date() : null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        })
        .returning();
      if (input.labelIds) await replaceLabels(tx, id, input.labelIds);
      await recordActivity(tx, {
        workspaceId,
        issueId: id,
        actorId,
        type: 'issue.created',
        data: { projectId: project.id, number, stateId: state.id },
        eventType: 'issue.created',
      });
      return issueWithLabels(tx, workspaceId, id);
    });
  }

  async function updateIssue(
    workspaceId: string,
    actorId: string,
    issueId: string,
    revision: number,
    input: IssuePatch,
  ) {
    return db.transaction(async (tx) => {
      const current = await findIssue(tx, workspaceId, issueId);
      if (current.revision !== revision)
        throw new RevisionConflictError('Issue revision does not match.');
      const project = await findProject(tx, workspaceId, current.projectId);
      const state = input.stateId
        ? await validateState(tx, project.workflowId, input.stateId)
        : undefined;
      await validateMember(tx, workspaceId, input.assigneeId);
      await validateParent(tx, workspaceId, project.id, issueId, input.parentIssueId);
      await validateLabels(tx, workspaceId, project.id, input.labelIds);
      const changes: Record<string, unknown> = {};
      for (const key of [
        'title',
        'description',
        'stateId',
        'priority',
        'assigneeId',
        'parentIssueId',
        'dueAt',
      ] as const) {
        if (input[key] !== undefined && input[key] !== current[key]) changes[key] = input[key];
      }
      if (input.labelIds) changes.labelIds = input.labelIds;
      const updated = await tx
        .update(issues)
        .set({
          title: input.title?.trim(),
          description: input.description,
          stateId: input.stateId,
          priority: input.priority,
          assigneeId: input.assigneeId,
          parentIssueId: input.parentIssueId,
          dueAt:
            input.dueAt !== undefined ? (input.dueAt ? new Date(input.dueAt) : null) : undefined,
          revision: current.revision + 1,
          ...(state ? stateTimestamps(state.category, current) : {}),
        })
        .where(
          and(
            eq(issues.workspaceId, workspaceId),
            eq(issues.id, issueId),
            eq(issues.revision, revision),
          ),
        )
        .returning();
      if (!updated[0]) throw new RevisionConflictError('Issue revision does not match.');
      if (input.labelIds) await replaceLabels(tx, issueId, input.labelIds);
      await recordActivity(tx, {
        workspaceId,
        issueId,
        actorId,
        type: 'issue.updated',
        data: changes,
        eventType: 'issue.updated',
      });
      return issueWithLabels(tx, workspaceId, issueId);
    });
  }

  return {
    createIssue,
    updateIssue,

    async getIssue(workspaceId: string, issueId: string) {
      return db.transaction((tx) => issueWithLabels(tx, workspaceId, issueId));
    },

    async archiveIssue(workspaceId: string, actorId: string, issueId: string, revision: number) {
      return db.transaction(async (tx) => {
        const current = await findIssue(tx, workspaceId, issueId);
        if (current.revision !== revision)
          throw new RevisionConflictError('Issue revision does not match.');
        const updated = await tx
          .update(issues)
          .set({ archivedAt: new Date(), revision: revision + 1 })
          .where(
            and(
              eq(issues.workspaceId, workspaceId),
              eq(issues.id, issueId),
              eq(issues.revision, revision),
            ),
          )
          .returning();
        if (!updated[0]) throw new RevisionConflictError('Issue revision does not match.');
        await recordActivity(tx, {
          workspaceId,
          issueId,
          actorId,
          type: 'issue.archived',
          data: {},
          eventType: 'issue.archived',
        });
        return updated[0];
      });
    },

    async listIssues(
      workspaceId: string,
      options: {
        projectId?: string | undefined;
        stateIds?: string[] | undefined;
        assigneeIds?: string[] | undefined;
        labelIds?: string[] | undefined;
        priorities?: number[] | undefined;
        parentId?: string | undefined;
        query?: string | undefined;
        updatedSince?: Date | undefined;
        cursor?: string | undefined;
        limit: number;
        sort: 'manual' | 'priority' | 'updated' | 'created';
        groupBy: 'state' | 'assignee' | 'priority' | 'label' | 'none';
      },
    ) {
      const predicates: SQL[] = [eq(issues.workspaceId, workspaceId), isNull(issues.archivedAt)];
      if (options.projectId) predicates.push(eq(issues.projectId, options.projectId));
      if (options.stateIds?.length) predicates.push(inArray(issues.stateId, options.stateIds));
      if (options.assigneeIds?.length)
        predicates.push(inArray(issues.assigneeId, options.assigneeIds));
      if (options.priorities?.length) predicates.push(inArray(issues.priority, options.priorities));
      if (options.parentId) predicates.push(eq(issues.parentIssueId, options.parentId));
      if (options.updatedSince) predicates.push(gte(issues.updatedAt, options.updatedSince));
      if (options.cursor) {
        const predicate = issueCursorPredicate(options.sort, options.cursor);
        if (predicate) predicates.push(predicate);
      }
      if (options.query) {
        // Full-text on the generated tsvector (GIN), with a trigram-indexed
        // title fallback for partial words. Never a description seq-scan.
        predicates.push(
          sql`(${issues.searchTsv} @@ websearch_to_tsquery('english', ${options.query}) or ${
            issues.title
          } ilike ${`%${options.query}%`})`,
        );
      }
      if (options.labelIds?.length) {
        predicates.push(
          sql`exists (select 1 from issue_labels where ${and(
            eq(issueLabels.issueId, issues.id),
            inArray(issueLabels.labelId, options.labelIds),
          )})`,
        );
      }
      const order =
        options.sort === 'manual'
          ? [asc(issues.sortKey), desc(issues.id)]
          : options.sort === 'priority'
            ? [desc(issues.priority), desc(issues.id)]
            : options.sort === 'created'
              ? [desc(issues.createdAt), desc(issues.id)]
              : [desc(issues.updatedAt), desc(issues.id)];
      const rows = await db
        .select()
        .from(issues)
        .where(and(...predicates))
        .orderBy(...order)
        .limit(options.limit);
      const ids = rows.map((issue) => issue.id);
      const assigned = ids.length
        ? await db
            .select({
              issueId: issueLabels.issueId,
              id: labels.id,
              name: labels.name,
              color: labels.color,
            })
            .from(issueLabels)
            .innerJoin(labels, eq(labels.id, issueLabels.labelId))
            .where(inArray(issueLabels.issueId, ids))
        : [];
      const items = rows.map((issue) => ({
        ...issue,
        labels: assigned
          .filter((label) => label.issueId === issue.id)
          .map((label) => ({ id: label.id, name: label.name, color: label.color })),
      }));
      const groupCounts = items.reduce<Record<string, number>>((counts, issue) => {
        const key =
          options.groupBy === 'state'
            ? issue.stateId
            : options.groupBy === 'assignee'
              ? (issue.assigneeId ?? 'unassigned')
              : options.groupBy === 'priority'
                ? String(issue.priority)
                : options.groupBy === 'label'
                  ? issue.labels.map((label) => label.id).join(',') || 'unlabelled'
                  : 'all';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {});
      const last = rows.at(-1);
      return {
        items,
        nextCursor:
          last && rows.length === options.limit ? encodeIssueCursor(options.sort, last) : null,
        groupCounts,
      };
    },

    async createSubIssue(
      workspaceId: string,
      actorId: string,
      parentId: string,
      input: Omit<Parameters<typeof createIssue>[2], 'projectId' | 'parentIssueId'>,
      metadata: Metadata,
    ) {
      return db.transaction(async (tx) => {
        const parent = await findIssue(tx, workspaceId, parentId);
        return createIssue(
          workspaceId,
          actorId,
          { ...input, projectId: parent.projectId, parentIssueId: parentId },
          metadata,
        );
      });
    },

    async listSubIssues(workspaceId: string, parentId: string, cursor?: string, limit = 50) {
      await db.transaction((tx) => findIssue(tx, workspaceId, parentId));
      const rows = await db
        .select()
        .from(issues)
        .where(
          cursor
            ? and(
                eq(issues.workspaceId, workspaceId),
                eq(issues.parentIssueId, parentId),
                gt(issues.id, cursor),
              )
            : and(eq(issues.workspaceId, workspaceId), eq(issues.parentIssueId, parentId)),
        )
        .orderBy(asc(issues.sortKey))
        .limit(limit);
      return { items: rows, nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null };
    },

    async createRelation(
      workspaceId: string,
      actorId: string,
      sourceId: string,
      targetId: string,
      type: 'blocks' | 'relates_to' | 'duplicates',
    ) {
      if (sourceId === targetId) throw new IssueRelationError('An issue cannot relate to itself.');
      const id = newId();
      try {
        await db.transaction(async (tx) => {
          await findIssue(tx, workspaceId, sourceId);
          await findIssue(tx, workspaceId, targetId);
          if (type === 'blocks' && (await reachesSource(tx, workspaceId, sourceId, targetId))) {
            throw new IssueRelationError('This blocks relation would create a cycle.');
          }
          await tx.insert(issueRelations).values({
            id,
            workspaceId,
            sourceIssueId: sourceId,
            targetIssueId: targetId,
            type,
            createdBy: actorId,
          });
          await recordActivity(tx, {
            workspaceId,
            issueId: sourceId,
            actorId,
            type: 'issue.relation_created',
            data: { relationId: id, targetId, type },
            eventType: 'issue.relation.created',
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('This relation already exists.');
        throw error;
      }
      return { id, sourceIssueId: sourceId, targetIssueId: targetId, type };
    },

    async deleteRelation(workspaceId: string, actorId: string, relationId: string) {
      await db.transaction(async (tx) => {
        const relation = (
          await tx
            .delete(issueRelations)
            .where(
              and(eq(issueRelations.workspaceId, workspaceId), eq(issueRelations.id, relationId)),
            )
            .returning()
        )[0];
        if (!relation) throw new TenancyNotFoundError('Relation not found.');
        await recordActivity(tx, {
          workspaceId,
          issueId: relation.sourceIssueId,
          actorId,
          type: 'issue.relation_deleted',
          data: { relationId, targetId: relation.targetIssueId, type: relation.type },
          eventType: 'issue.relation.deleted',
        });
      });
    },

    async bulkUpdate(
      workspaceId: string,
      actorId: string,
      updates: Array<{ id: string; revision: number } & IssuePatch>,
    ) {
      // Each item is its own transaction; a failure is reported per item rather
      // than aborting the whole batch (callers reconcile with the returned map).
      const results = [];
      for (const update of updates) {
        const { id, revision, ...input } = update;
        try {
          const issue = await updateIssue(workspaceId, actorId, id, revision, input);
          results.push({ id, ok: true as const, issue });
        } catch (error) {
          const reason =
            error instanceof RevisionConflictError
              ? 'revision_conflict'
              : error instanceof TenancyNotFoundError
                ? 'not_found'
                : error instanceof ConflictError
                  ? 'conflict'
                  : 'error';
          if (reason === 'error') throw error;
          results.push({ id, ok: false as const, reason });
        }
      }
      return results;
    },

    async moveIssue(
      workspaceId: string,
      actorId: string,
      issueId: string,
      revision: number,
      input: {
        beforeId?: string | undefined;
        afterId?: string | undefined;
        stateId?: string | undefined;
      },
    ) {
      return db.transaction(async (tx) => {
        const issue = await findIssue(tx, workspaceId, issueId);
        if (issue.revision !== revision)
          throw new RevisionConflictError('Issue revision does not match.');
        const project = await findProject(tx, workspaceId, issue.projectId);
        const targetStateId = input.stateId ?? issue.stateId;
        const targetState = await validateState(tx, project.workflowId, targetStateId);
        const siblings = (
          await tx
            .select()
            .from(issues)
            .where(
              and(
                eq(issues.workspaceId, workspaceId),
                eq(issues.projectId, issue.projectId),
                eq(issues.stateId, targetStateId),
                isNull(issues.archivedAt),
              ),
            )
            .orderBy(asc(issues.sortKey))
        ).filter((candidate) => candidate.id !== issueId);
        const before = input.beforeId
          ? siblings.find((candidate) => candidate.id === input.beforeId)
          : undefined;
        const after = input.afterId
          ? siblings.find((candidate) => candidate.id === input.afterId)
          : undefined;
        if ((input.beforeId && !before) || (input.afterId && !after))
          throw new TenancyNotFoundError('Move neighbour not found.');
        let key = sortKeyBetween(
          after?.sortKey,
          before?.sortKey ?? (input.beforeId ? undefined : null),
        );
        if (!key) {
          const ranks = rebalanceIssueSortKeys(siblings.map((candidate) => candidate.id));
          await Promise.all(
            [...ranks].map(([id, sortKey]) =>
              tx.update(issues).set({ sortKey }).where(eq(issues.id, id)),
            ),
          );
          key =
            sortKeyBetween(
              after ? ranks.get(after.id) : undefined,
              before ? ranks.get(before.id) : undefined,
            ) ?? initialIssueSortKey();
        }
        const updated = await tx
          .update(issues)
          .set({
            stateId: targetStateId,
            sortKey: key,
            revision: revision + 1,
            ...stateTimestamps(targetState.category, issue),
          })
          .where(
            and(
              eq(issues.workspaceId, workspaceId),
              eq(issues.id, issueId),
              eq(issues.revision, revision),
            ),
          )
          .returning();
        if (!updated[0]) throw new RevisionConflictError('Issue revision does not match.');
        await recordActivity(tx, {
          workspaceId,
          issueId,
          actorId,
          type: 'issue.moved',
          data: { stateId: targetStateId, beforeId: input.beforeId, afterId: input.afterId },
          eventType: 'issue.moved',
        });
        return updated[0];
      });
    },

    async searchIssues(workspaceId: string, query: string, limit = 20) {
      const rows = await db
        .select({
          id: issues.id,
          projectId: issues.projectId,
          number: issues.number,
          title: issues.title,
          rank: sql<number>`ts_rank_cd(${issues.searchTsv}, websearch_to_tsquery('english', ${query}))`,
        })
        .from(issues)
        .where(
          and(
            eq(issues.workspaceId, workspaceId),
            isNull(issues.archivedAt),
            or(
              sql`${issues.searchTsv} @@ websearch_to_tsquery('english', ${query})`,
              ilike(issues.title, `%${query}%`),
            )!,
          ),
        )
        .orderBy(
          desc(sql`ts_rank_cd(${issues.searchTsv}, websearch_to_tsquery('english', ${query}))`),
        )
        .limit(limit);
      return rows;
    },
  };
}

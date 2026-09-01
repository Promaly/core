import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import {
  activityEvents,
  comments,
  emit,
  issues,
  type DatabaseClient,
  type DbTransaction,
} from '@promaly/db';
import { newId } from '@promaly/domain';
import { TenancyNotFoundError } from './tenancy.js';

function parseMentions(body: string): string[] {
  const matches =
    body.match(/@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

async function findComment(tx: DbTransaction, workspaceId: string, commentId: string) {
  const comment = (
    await tx
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.workspaceId, workspaceId),
          eq(comments.id, commentId),
          isNull(comments.deletedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!comment) throw new TenancyNotFoundError('Comment not found.');
  return comment;
}

export type CommentsService = ReturnType<typeof createCommentsService>;

export function createCommentsService(database: DatabaseClient) {
  const { db } = database;

  return {
    async listComments(workspaceId: string, issueId: string, cursor?: string, limit = 50) {
      const base = and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.issueId, issueId),
        isNull(comments.deletedAt),
      );
      const rows = await db
        .select()
        .from(comments)
        .where(cursor ? and(base, gt(comments.id, cursor)) : base)
        .orderBy(asc(comments.createdAt))
        .limit(limit);
      return { items: rows, nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null };
    },

    async createComment(workspaceId: string, actorId: string, issueId: string, body: string) {
      return db.transaction(async (tx) => {
        const issue = (
          await tx
            .select({ id: issues.id })
            .from(issues)
            .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
            .limit(1)
        )[0];
        if (!issue) throw new TenancyNotFoundError('Issue not found.');

        const id = newId();
        const mentionIds = parseMentions(body);
        const [comment] = await tx
          .insert(comments)
          .values({ id, workspaceId, issueId, authorId: actorId, body })
          .returning();

        await tx.insert(activityEvents).values({
          id: newId(),
          workspaceId,
          issueId,
          actorId,
          type: 'comment.created',
          data: { commentId: id },
        });

        await emit(tx, {
          id: newId(),
          workspaceId,
          aggregateType: 'issue',
          aggregateId: issueId,
          type: 'comment.created',
          payload: { commentId: id },
        });

        await emit(tx, {
          id: newId(),
          workspaceId,
          aggregateType: 'notification',
          aggregateId: issueId,
          type: 'notification.fanout',
          payload: { workspaceId, issueId, actorId, kind: 'comment', commentId: id, mentionIds },
        });

        return comment!;
      });
    },

    async updateComment(workspaceId: string, actorId: string, commentId: string, body: string) {
      return db.transaction(async (tx) => {
        const existing = await findComment(tx, workspaceId, commentId);
        if (existing.authorId !== actorId) throw new TenancyNotFoundError('Comment not found.');

        const [updated] = await tx
          .update(comments)
          .set({ body, editedAt: new Date() })
          .where(and(eq(comments.workspaceId, workspaceId), eq(comments.id, commentId)))
          .returning();

        await emit(tx, {
          id: newId(),
          workspaceId,
          aggregateType: 'issue',
          aggregateId: existing.issueId,
          type: 'comment.updated',
          payload: { commentId },
        });

        return updated!;
      });
    },

    async deleteComment(workspaceId: string, actorId: string, commentId: string) {
      await db.transaction(async (tx) => {
        const existing = await findComment(tx, workspaceId, commentId);
        if (existing.authorId !== actorId) throw new TenancyNotFoundError('Comment not found.');

        await tx
          .update(comments)
          .set({ deletedAt: new Date() })
          .where(and(eq(comments.workspaceId, workspaceId), eq(comments.id, commentId)));

        await emit(tx, {
          id: newId(),
          workspaceId,
          aggregateType: 'issue',
          aggregateId: existing.issueId,
          type: 'comment.deleted',
          payload: { commentId },
        });
      });
    },
  };
}

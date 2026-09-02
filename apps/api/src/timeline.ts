import { and, asc, eq, isNull } from 'drizzle-orm';
import { activityEvents, comments, issues, type DatabaseClient } from '@promaly/db';
import { TenancyNotFoundError } from './tenancy.js';

export type TimelineEntry =
  | {
      kind: 'activity';
      id: string;
      type: string;
      actorId: string | null;
      data: unknown;
      createdAt: string;
    }
  | {
      kind: 'comment';
      id: string;
      authorId: string;
      body: string;
      editedAt: string | null;
      createdAt: string;
      updatedAt: string;
    };

export type TimelineService = ReturnType<typeof createTimelineService>;

export function createTimelineService(database: DatabaseClient) {
  const { db } = database;

  return {
    async listTimeline(
      workspaceId: string,
      issueId: string,
      cursor?: string,
      limit = 50,
    ): Promise<{ items: TimelineEntry[]; nextCursor: string | null }> {
      const issue = (
        await db
          .select({ id: issues.id })
          .from(issues)
          .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
          .limit(1)
      )[0];
      if (!issue) throw new TenancyNotFoundError('Issue not found.');

      // Decode cursor: { type: 'activity'|'comment', id, createdAt }
      let cursorTs: Date | undefined;
      let cursorId: string | undefined;
      if (cursor) {
        try {
          const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
            ts: string;
            id: string;
          };
          cursorTs = new Date(parsed.ts);
          cursorId = parsed.id;
        } catch {
          // invalid cursor — ignore
        }
      }

      const actBase = and(
        eq(activityEvents.workspaceId, workspaceId),
        eq(activityEvents.issueId, issueId),
      );
      const cmtBase = and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.issueId, issueId),
        isNull(comments.deletedAt),
      );

      const [actRows, cmtRows] = await Promise.all([
        db
          .select()
          .from(activityEvents)
          .where(actBase)
          .orderBy(asc(activityEvents.createdAt))
          .limit(limit * 2),
        db
          .select()
          .from(comments)
          .where(cmtBase)
          .orderBy(asc(comments.createdAt))
          .limit(limit * 2),
      ]);

      const allItems: TimelineEntry[] = [
        ...actRows.map((row) => ({
          kind: 'activity' as const,
          id: row.id,
          type: row.type,
          actorId: row.actorId,
          data: row.data,
          createdAt: row.createdAt.toISOString(),
        })),
        ...cmtRows.map((row) => ({
          kind: 'comment' as const,
          id: row.id,
          authorId: row.authorId,
          body: row.body,
          editedAt: row.editedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      ].sort((a, b) => {
        const diff = a.createdAt.localeCompare(b.createdAt);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });

      // Apply cursor filter
      let page = allItems;
      if (cursorTs && cursorId) {
        const tsStr = cursorTs.toISOString();
        const idx = page.findIndex(
          (item) => item.createdAt > tsStr || (item.createdAt === tsStr && item.id > cursorId!),
        );
        page = idx >= 0 ? page.slice(idx) : [];
      }

      const items = page.slice(0, limit);
      const last = items.at(-1);
      const nextCursor =
        last && items.length === limit
          ? Buffer.from(JSON.stringify({ ts: last.createdAt, id: last.id })).toString('base64url')
          : null;

      return { items, nextCursor };
    },
  };
}

import { and, eq, inArray } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import {
  accounts,
  emit,
  issues,
  notificationPreferences,
  notifications,
  type DatabaseClient,
} from '@promaly/db';
import {
  computeRecipients,
  defaultNotificationPreferences,
  shouldNotify,
  type FanoutKind,
} from '@promaly/domain';

export type FanoutPayload = {
  workspaceId: string;
  issueId: string;
  actorId: string;
  kind: FanoutKind;
  commentId?: string;
  mentionIds?: string[];
};

export function createNotificationFanout(database: DatabaseClient) {
  const db = database.db;

  return {
    async fanout(rawPayload: Record<string, unknown>): Promise<void> {
      const payload = rawPayload as FanoutPayload;
      const { workspaceId, issueId, actorId, kind, commentId, mentionIds = [] } = payload;

      const [issue] = await db
        .select({ assigneeId: issues.assigneeId, createdBy: issues.createdBy, title: issues.title })
        .from(issues)
        .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
        .limit(1);

      if (!issue) return; // issue was deleted

      const recipientIds = computeRecipients({
        actorId,
        assigneeId: issue.assigneeId,
        authorId: issue.createdBy,
        mentionIds,
      });

      if (recipientIds.size === 0) return;

      const recipientArray = [...recipientIds];
      const prefsRows = await db
        .select({
          accountId: notificationPreferences.accountId,
          prefs: notificationPreferences.prefs,
        })
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.workspaceId, workspaceId),
            inArray(notificationPreferences.accountId, recipientArray),
          ),
        );

      const prefsMap = new Map(
        prefsRows.map((r) => [r.accountId, r.prefs as Record<string, boolean>]),
      );

      const toInsert: (typeof notifications.$inferInsert)[] = [];
      const emailRecipientIds: string[] = [];

      for (const recipientId of recipientIds) {
        const prefs = prefsMap.get(recipientId) ?? {};
        const isMentioned = mentionIds.includes(recipientId);
        if (shouldNotify(prefs, kind, isMentioned)) {
          toInsert.push({
            id: uuidv7(),
            workspaceId,
            recipientId,
            actorId,
            type: kind,
            issueId,
            commentId: commentId ?? undefined,
            data: { issueTitle: issue.title },
            readAt: null,
          });
          const effective = { ...defaultNotificationPreferences, ...prefs };
          if (effective.email) emailRecipientIds.push(recipientId);
        }
      }

      if (toInsert.length === 0) return;

      await db.transaction(async (tx) => {
        await tx.insert(notifications).values(toInsert);

        if (emailRecipientIds.length > 0) {
          const emailRows = await tx
            .select({ id: accounts.id, email: accounts.email })
            .from(accounts)
            .where(inArray(accounts.id, emailRecipientIds));

          for (const { email } of emailRows) {
            await emit(tx, {
              id: uuidv7(),
              workspaceId,
              aggregateType: 'notification',
              aggregateId: workspaceId,
              type: 'email.send',
              payload: {
                to: email,
                subject: `New activity on: ${issue.title}`,
                text: `You have a new ${kind} notification on issue "${issue.title}".`,
              },
            });
          }
        }
      });
    },
  };
}

export type NotificationFanout = ReturnType<typeof createNotificationFanout>;

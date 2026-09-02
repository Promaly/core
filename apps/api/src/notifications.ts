import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { notifications, notificationPreferences, type DatabaseClient } from '@promaly/db';
import { defaultNotificationPreferences, type NotificationPreferences } from '@promaly/domain';
import { TenancyNotFoundError } from './tenancy.js';

export type NotificationsService = ReturnType<typeof createNotificationsService>;

export function createNotificationsService(database: DatabaseClient) {
  const { db } = database;

  return {
    async listNotifications(
      workspaceId: string,
      accountId: string,
      options: { unreadOnly?: boolean; cursor?: string; limit?: number } = {},
    ) {
      const limit = Math.max(1, Math.min(100, options.limit ?? 50));
      const base = and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientId, accountId),
        options.unreadOnly ? isNull(notifications.readAt) : undefined,
      );
      const rows = await db
        .select()
        .from(notifications)
        .where(options.cursor ? and(base, lt(notifications.id, options.cursor)) : base)
        .orderBy(sql`${notifications.createdAt} desc`)
        .limit(limit);
      return {
        items: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString() ?? null,
        })),
        nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
      };
    },

    async getUnreadCount(workspaceId: string, accountId: string) {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.workspaceId, workspaceId),
            eq(notifications.recipientId, accountId),
            isNull(notifications.readAt),
          ),
        );
      return { count: result[0]?.count ?? 0 };
    },

    async markRead(workspaceId: string, accountId: string, notificationId: string) {
      const updated = await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.workspaceId, workspaceId),
            eq(notifications.recipientId, accountId),
            eq(notifications.id, notificationId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });
      if (!updated.length) throw new TenancyNotFoundError('Notification not found.');
    },

    async markAllRead(workspaceId: string, accountId: string) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.workspaceId, workspaceId),
            eq(notifications.recipientId, accountId),
            isNull(notifications.readAt),
          ),
        );
    },

    async getPreferences(workspaceId: string, accountId: string): Promise<NotificationPreferences> {
      const row = (
        await db
          .select({ prefs: notificationPreferences.prefs })
          .from(notificationPreferences)
          .where(
            and(
              eq(notificationPreferences.workspaceId, workspaceId),
              eq(notificationPreferences.accountId, accountId),
            ),
          )
          .limit(1)
      )[0];
      return {
        ...defaultNotificationPreferences,
        ...((row?.prefs as Partial<NotificationPreferences>) ?? {}),
      };
    },

    async updatePreferences(
      workspaceId: string,
      accountId: string,
      patch: Partial<NotificationPreferences>,
    ): Promise<NotificationPreferences> {
      const current = await this.getPreferences(workspaceId, accountId);
      const merged = { ...current, ...patch };
      await db
        .insert(notificationPreferences)
        .values({ workspaceId, accountId, prefs: merged })
        .onConflictDoUpdate({
          target: [notificationPreferences.workspaceId, notificationPreferences.accountId],
          set: { prefs: merged },
        });
      return merged;
    },
  };
}

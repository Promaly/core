import { and, eq, or } from 'drizzle-orm';
import { savedViews, type DatabaseClient } from '@promaly/db';
import { newId } from '@promaly/domain';
import { TenancyNotFoundError } from './tenancy.js';
import type { SavedViewCreateRequest } from '@promaly/contracts';

export type SavedViewsService = ReturnType<typeof createSavedViewsService>;

export function createSavedViewsService(database: DatabaseClient) {
  const { db } = database;

  return {
    async listSavedViews(workspaceId: string, accountId: string) {
      const rows = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.workspaceId, workspaceId),
            or(
              eq(savedViews.ownerId, accountId),
              eq(savedViews.ownerId, null as unknown as string),
            ),
          ),
        );
      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async createSavedView(workspaceId: string, accountId: string, input: SavedViewCreateRequest) {
      const isShared = input.scope === 'shared';
      const id = newId();
      const [row] = await db
        .insert(savedViews)
        .values({
          id,
          workspaceId,
          ownerId: isShared ? null : accountId,
          projectId: input.projectId ?? null,
          name: input.name,
          filters: input.filters,
          groupBy: input.groupBy,
          sort: input.sort,
          createdBy: accountId,
        })
        .returning();
      return {
        ...row!,
        createdAt: row!.createdAt.toISOString(),
        updatedAt: row!.updatedAt.toISOString(),
      };
    },

    async updateSavedView(
      workspaceId: string,
      accountId: string,
      viewId: string,
      patch: Partial<Omit<SavedViewCreateRequest, 'scope'>>,
    ) {
      const existing = (
        await db
          .select()
          .from(savedViews)
          .where(and(eq(savedViews.workspaceId, workspaceId), eq(savedViews.id, viewId)))
          .limit(1)
      )[0];
      if (!existing) throw new TenancyNotFoundError('Saved view not found.');
      if (existing.ownerId !== null && existing.ownerId !== accountId) {
        throw new TenancyNotFoundError('Saved view not found.');
      }

      const set: Record<string, unknown> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.filters !== undefined) set.filters = patch.filters;
      if (patch.groupBy !== undefined) set.groupBy = patch.groupBy;
      if (patch.sort !== undefined) set.sort = patch.sort;

      const [updated] = await db
        .update(savedViews)
        .set(set)
        .where(and(eq(savedViews.workspaceId, workspaceId), eq(savedViews.id, viewId)))
        .returning();
      return {
        ...updated!,
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      };
    },

    async deleteSavedView(workspaceId: string, accountId: string, viewId: string) {
      const existing = (
        await db
          .select({ id: savedViews.id, ownerId: savedViews.ownerId })
          .from(savedViews)
          .where(and(eq(savedViews.workspaceId, workspaceId), eq(savedViews.id, viewId)))
          .limit(1)
      )[0];
      if (!existing) throw new TenancyNotFoundError('Saved view not found.');
      if (existing.ownerId !== null && existing.ownerId !== accountId) {
        throw new TenancyNotFoundError('Saved view not found.');
      }
      await db
        .delete(savedViews)
        .where(and(eq(savedViews.workspaceId, workspaceId), eq(savedViews.id, viewId)));
    },
  };
}

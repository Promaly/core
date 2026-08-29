import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { DatabaseClient } from './index.js';

type Db = DatabaseClient['db'];

/** Any Drizzle table that carries a `workspaceId` column (i.e. tenant-owned). */
type TenantTable = PgTable & { workspaceId: AnyPgColumn };
type Row = Record<string, unknown>;

export class WorkspaceScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceScopeError';
  }
}

/**
 * The only sanctioned way for a module to touch tenant-owned tables. Every
 * operation is pinned to one workspace: reads and writes are filtered to it,
 * inserts have `workspace_id` forced onto them, and a value for another
 * workspace is rejected rather than silently rewritten. Modules receive one of
 * these; they never get the raw `db` handle.
 *
 * Signatures are deliberately loose (Row / SQL) — threading Drizzle's builder
 * generics through the wrapper makes type-checking pathologically slow.
 */
export function createScopedRepository(db: Db, workspaceId: string) {
  if (!workspaceId) {
    throw new WorkspaceScopeError('workspaceId is required for a scoped repository.');
  }

  const scopedWhere = (table: TenantTable, predicate?: SQL) =>
    predicate
      ? and(eq(table.workspaceId, workspaceId), predicate)
      : eq(table.workspaceId, workspaceId);

  const forceWorkspace = (row: Row): Row => {
    const given = row.workspaceId;
    if (given != null && given !== workspaceId) {
      throw new WorkspaceScopeError('scoped repository cannot write to another workspace');
    }
    return { ...row, workspaceId };
  };

  return {
    workspaceId,

    // async so the workspace guard surfaces as a rejection, never a sync throw.
    async insert(table: TenantTable, rows: Row | Row[]) {
      const scoped = (Array.isArray(rows) ? rows : [rows]).map(forceWorkspace);
      return db
        .insert(table)
        .values(scoped as never)
        .returning();
    },

    select(table: TenantTable, predicate?: SQL) {
      return db
        .select()
        .from(table as PgTable)
        .where(scopedWhere(table, predicate));
    },

    update(table: TenantTable, set: Row, predicate?: SQL) {
      return db
        .update(table)
        .set(set as never)
        .where(scopedWhere(table, predicate))
        .returning();
    },

    delete(table: TenantTable, predicate?: SQL) {
      return db.delete(table).where(scopedWhere(table, predicate)).returning();
    },
  };
}

export type ScopedRepository = ReturnType<typeof createScopedRepository>;

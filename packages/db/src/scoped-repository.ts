import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { DatabaseClient } from './index.js';

type ScopedDatabase = DatabaseClient['db'];

type TenantValues = { workspaceId?: string };

export function createScopedRepository(database: ScopedDatabase, workspaceId: string) {
  if (!workspaceId) throw new Error('workspaceId is required for a scoped repository.');
  void database;

  function scope<T extends TenantValues>(values: T): T & { workspaceId: string } {
    if (values.workspaceId && values.workspaceId !== workspaceId) {
      throw new Error('A scoped repository cannot write to another workspace.');
    }
    return { ...values, workspaceId };
  }

  function workspaceWhere(workspaceColumn: AnyPgColumn, predicate?: SQL) {
    return predicate
      ? and(eq(workspaceColumn, workspaceId), predicate)
      : eq(workspaceColumn, workspaceId);
  }

  return {
    workspaceId,
    scope,
    workspaceWhere,
  };
}

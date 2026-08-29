import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export * from './schema.js';
export * from './outbox.js';

/** Absolute path to the SQL migrations directory that ships with this package. */
export const migrationsDir = fileURLToPath(new URL('../drizzle', import.meta.url));

export function createDatabaseClient(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    onnotice: () => undefined,
  });

  return {
    db: drizzle({ client }),
    raw: client,
    async healthcheck() {
      await client`select 1`;
    },
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function runMigrations(db: DatabaseClient['db']) {
  await migrate(db, { migrationsFolder: migrationsDir });
}

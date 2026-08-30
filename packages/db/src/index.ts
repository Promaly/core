import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export * from './schema.js';
export * from './outbox.js';
export * from './scoped-repository.js';
export * from './errors.js';
export * from './app-role.js';

/** Absolute path to the SQL migrations directory that ships with this package. */
export const migrationsDir = fileURLToPath(new URL('../drizzle', import.meta.url));

export function createDatabaseClient(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    onnotice: () => undefined,
  });
  // A separate small pool for raw SQL (worker drain `sql.begin`, migration DDL,
  // health check). Keeping it off the pool Drizzle owns means a Drizzle query
  // and a raw transaction never share a connection.
  const rawClient = postgres(databaseUrl, {
    max: 4,
    onnotice: () => undefined,
  });

  return {
    db: drizzle({ client }),
    raw: rawClient,
    async healthcheck() {
      await rawClient`select 1`;
    },
    async close() {
      await Promise.all([client.end({ timeout: 5 }), rawClient.end({ timeout: 5 })]);
    },
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function runMigrations(db: DatabaseClient['db']) {
  await migrate(db, { migrationsFolder: migrationsDir });
}

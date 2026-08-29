import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export * from './schema.js';
export * from './outbox.js';

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

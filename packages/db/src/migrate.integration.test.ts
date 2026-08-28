import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, systemMetadata } from './index.js';

const shouldRun = process.env.RUN_DATABASE_TESTS === 'true';
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

describe.skipIf(!shouldRun)('database migrations', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let database: ReturnType<typeof createDatabaseClient> | undefined;

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it('applies cleanly to a new PostgreSQL instance', async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    database = createDatabaseClient(container.getConnectionUri());

    await migrate(database.db, { migrationsFolder });
    await database.db.insert(systemMetadata).values({
      key: 'migration-verification',
      value: { id: randomUUID() },
    });

    const rows = await database.db.select().from(systemMetadata);
    expect(rows).toHaveLength(1);
  });
});

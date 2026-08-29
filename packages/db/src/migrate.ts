import { createDatabaseClient, runMigrations } from './index.js';

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required to run database migrations.');
}

const database = createDatabaseClient(databaseUrl);

try {
  await runMigrations(database.db);
  console.info(JSON.stringify({ level: 'info', message: 'Database migrations completed' }));
} finally {
  await database.close();
}

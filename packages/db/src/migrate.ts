import { createDatabaseClient, ensureAppRole, runMigrations, syncAppRoleGrants } from './index.js';

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required to run database migrations.');
}

const database = createDatabaseClient(databaseUrl);
const appPassword = process.env.PROMALY_APP_PASSWORD;

try {
  if (appPassword) {
    await ensureAppRole(database.raw, appPassword);
    console.info(
      JSON.stringify({ level: 'info', message: 'Application role ensured', role: 'promaly_app' }),
    );
  }

  await runMigrations(database.db);

  if (appPassword) {
    await syncAppRoleGrants(database.raw);
  }

  console.info(JSON.stringify({ level: 'info', message: 'Database migrations completed' }));
} finally {
  await database.close();
}

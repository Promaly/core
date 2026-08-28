import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { createDatabaseClient } from './index.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run database migrations.');
}

const database = createDatabaseClient(databaseUrl);
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

try {
  await migrate(database.db, { migrationsFolder });
  console.info(JSON.stringify({ level: 'info', message: 'Database migrations completed' }));
} finally {
  await database.close();
}

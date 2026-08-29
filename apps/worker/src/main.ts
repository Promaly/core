import { createServer } from 'node:http';
import { PgBoss } from 'pg-boss';
import { loadConfig } from '@promaly/config';
import { createDatabaseClient } from '@promaly/db';
import { createMailPort } from '@promaly/domain';

const config = loadConfig(process.env);
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for the worker.');

const database = createDatabaseClient(config.databaseUrl);
const boss = new PgBoss(config.databaseUrl);
const mail = createMailPort(config.smtpUrl, config.smtpFrom);
let healthy = true;
let pending = 0;
let failed = 0;
let processed = 0;

type EventRow = { id: string; type: string; payload: Record<string, unknown>; attempts: number };

async function dispatch(event: EventRow) {
  if (event.type !== 'email.send') return;
  const { to, subject, text } = event.payload as { to?: string; subject?: string; text?: string };
  if (!to || !subject || !text) throw new Error('email.send payload is incomplete');
  await mail.send({ to, subject, text });
}

async function drainOutbox() {
  try {
    await database.raw.begin(async (transaction) => {
      const events = await transaction<EventRow[]>`
        select id, type, payload, attempts from outbox_events
        where processed_at is null and available_at <= now()
        order by available_at, created_at for update skip locked limit 25`;
      pending = events.length;
      for (const event of events) {
        try {
          await dispatch(event);
          await transaction`update outbox_events set processed_at = now(), last_error = null where id = ${event.id}::uuid`;
          processed += 1;
        } catch (error) {
          const attempts = event.attempts + 1;
          const message = error instanceof Error ? error.message : 'Unknown outbox failure';
          failed += 1;
          await transaction`update outbox_events set attempts = ${attempts}, last_error = ${message}, available_at = now() + (${Math.min(2 ** attempts, 300)} * interval '1 second') where id = ${event.id}::uuid`;
        }
      }
    });
  } catch (error) {
    healthy = false;
    throw error;
  } finally {
    healthy = true;
  }
}

await boss.start();
await boss.createQueue('outbox-drain');
await boss.work('outbox-drain', async () => void (await drainOutbox()));
const poll = setInterval(() => void boss.send('outbox-drain', {}), 5_000);
await boss.send('outbox-drain', {});

const healthServer = createServer((request, response) => {
  if (request.url === '/metrics') {
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
    response.end(
      `promaly_outbox_pending ${pending}\npromaly_outbox_failed ${failed}\npromaly_outbox_processed_total ${processed}\n`,
    );
    return;
  }
  response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: healthy ? 'ok' : 'not_ready', service: 'worker' }));
});
await new Promise<void>((resolve) =>
  healthServer.listen(config.workerHealthPort, '0.0.0.0', resolve),
);

async function close() {
  clearInterval(poll);
  await boss.stop();
  await database.close();
  healthServer.close();
}
process.once('SIGTERM', () => void close());
process.once('SIGINT', () => void close());

import { createServer } from 'node:http';
import { loadConfig } from '@promaly/config';
import { createDatabaseClient } from '@promaly/db';
import { createMailPort } from '@promaly/domain';
import { drainOutbox } from './drain.js';

const config = loadConfig(process.env);
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for the worker.');

const drainIntervalMs = 5_000;
const database = createDatabaseClient(config.databaseUrl);
const mail = createMailPort(config.smtpUrl, config.smtpFrom);
let healthy = true;
let running = false;
let pending = 0;
let processed = 0;
let deadLettered = 0;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await drainOutbox(database.raw, { mail });
    pending = result.claimed - result.processed - result.deadLettered;
    processed += result.processed;
    deadLettered += result.deadLettered;
    healthy = true;
  } catch (error) {
    healthy = false;
    console.error(
      JSON.stringify({ level: 'error', message: 'Outbox drain failed', error: `${error}` }),
    );
  } finally {
    running = false;
  }
}

const poll = setInterval(() => void tick(), drainIntervalMs);
void tick();

const healthServer = createServer((request, response) => {
  if (request.url === '/metrics') {
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
    response.end(
      [
        `promaly_outbox_pending ${pending}`,
        `promaly_outbox_processed_total ${processed}`,
        `promaly_outbox_dead_lettered_total ${deadLettered}`,
        '',
      ].join('\n'),
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
  healthServer.close();
  await database.close();
}
process.once('SIGTERM', () => void close());
process.once('SIGINT', () => void close());

import { loadConfig } from '@promaly/config';
import { writeFile } from 'node:fs/promises';

const config = loadConfig(process.env);

console.info(
  JSON.stringify({
    level: 'info',
    message: 'Promaly worker started',
    environment: config.nodeEnv,
  }),
);

async function heartbeat() {
  await writeFile('/tmp/promaly-worker.heartbeat', new Date().toISOString());
}

await heartbeat();
const heartbeatInterval = setInterval(() => void heartbeat(), 15_000);

function close() {
  clearInterval(heartbeatInterval);
  process.exit(0);
}

process.once('SIGTERM', close);
process.once('SIGINT', close);

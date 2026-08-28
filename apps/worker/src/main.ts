import { loadConfig } from '@promaly/config';

const config = loadConfig(process.env);

console.info(
  JSON.stringify({
    level: 'info',
    message: 'Promaly worker started',
    environment: config.nodeEnv,
  }),
);

process.once('SIGTERM', () => process.exit(0));
process.once('SIGINT', () => process.exit(0));

setInterval(() => undefined, 60_000);

import { loadConfig } from '@promaly/config';
import { buildApp } from './app.js';

const config = loadConfig(process.env);
const app = buildApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

async function close(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'Shutting down Promaly API');
  await app.close();
}

process.once('SIGTERM', () => void close('SIGTERM'));
process.once('SIGINT', () => void close('SIGINT'));

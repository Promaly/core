import { loadConfig } from '@promaly/config';
import { startOpenTelemetry } from './otel.js';

const config = loadConfig(process.env);
const stopOpenTelemetry = startOpenTelemetry(config);
const { buildApp, buildMetricsApp, createMetricsState } = await import('./app.js');
const metrics = createMetricsState();
const app = await buildApp(config, undefined, metrics);
const metricsApp = buildMetricsApp(config, metrics);

try {
  await app.listen({ host: config.host, port: config.port });
  await metricsApp.listen({ host: config.metricsHost, port: config.metricsPort });
} catch (error) {
  app.log.error(error);
  await metricsApp.close();
  await app.close();
  await stopOpenTelemetry?.();
  process.exit(1);
}

async function close(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'Shutting down Promaly API');
  await metricsApp.close();
  await app.close();
  await stopOpenTelemetry?.();
}

process.once('SIGTERM', () => void close('SIGTERM'));
process.once('SIGINT', () => void close('SIGINT'));

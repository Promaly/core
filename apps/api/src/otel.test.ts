import { describe, expect, it } from 'vitest';
import { startOpenTelemetry } from './otel.js';

const disabledConfig = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1',
  port: 3000,
  metricsHost: '127.0.0.1',
  metricsPort: 9090,
  metricsToken: undefined,
  databaseUrl: undefined,
  migrationDatabaseUrl: undefined,
  s3Endpoint: undefined,
  s3Bucket: 'promaly',
  s3Region: 'us-east-1',
  otelExporterOtlpEndpoint: undefined,
  otelServiceName: 'promaly-api',
  otelTracesEnabled: false,
  logLevel: 'silent' as const,
};

describe('OpenTelemetry bootstrap', () => {
  it('does nothing when tracing is disabled', () => {
    expect(startOpenTelemetry(disabledConfig)).toBeUndefined();
  });

  it('starts and stops cleanly with a configured exporter', async () => {
    const stop = startOpenTelemetry({
      ...disabledConfig,
      otelTracesEnabled: true,
      otelExporterOtlpEndpoint: 'http://127.0.0.1:4318/v1/traces',
    });

    expect(stop).toBeTypeOf('function');
    await stop?.();
  });
});

import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';

describe('loadConfig', () => {
  it('provides safe development defaults', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      host: '0.0.0.0',
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
      logLevel: 'info',
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow('Invalid configuration');
  });

  it('validates telemetry and metrics settings', () => {
    expect(
      loadConfig({
        METRICS_HOST: '0.0.0.0',
        METRICS_PORT: '9464',
        OTEL_TRACES_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318/v1/traces',
      }),
    ).toMatchObject({
      metricsHost: '0.0.0.0',
      metricsPort: 9464,
      otelTracesEnabled: true,
    });
    expect(() => loadConfig({ OTEL_TRACES_ENABLED: 'sometimes' })).toThrow('Invalid configuration');
    expect(loadConfig({ METRICS_TOKEN: '' }).metricsToken).toBeUndefined();
  });
});

import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  METRICS_HOST: z.string().default('127.0.0.1'),
  METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(9090),
  METRICS_TOKEN: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  MIGRATION_DATABASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().min(1).default('promaly'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('promaly-api'),
  OTEL_TRACES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof configSchema>['NODE_ENV'];
  host: string;
  port: number;
  metricsHost: string;
  metricsPort: number;
  metricsToken: string | undefined;
  databaseUrl: string | undefined;
  migrationDatabaseUrl: string | undefined;
  s3Endpoint: string | undefined;
  s3Bucket: string;
  s3Region: string;
  otelExporterOtlpEndpoint: string | undefined;
  otelServiceName: string;
  otelTracesEnabled: boolean;
  logLevel: z.infer<typeof configSchema>['LOG_LEVEL'];
};

export function loadConfig(environment: Record<string, string | undefined>): AppConfig {
  const result = configSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(`Invalid configuration: ${z.prettifyError(result.error)}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    host: result.data.HOST,
    port: result.data.PORT,
    metricsHost: result.data.METRICS_HOST,
    metricsPort: result.data.METRICS_PORT,
    metricsToken: result.data.METRICS_TOKEN,
    databaseUrl: result.data.DATABASE_URL,
    migrationDatabaseUrl: result.data.MIGRATION_DATABASE_URL,
    s3Endpoint: result.data.S3_ENDPOINT,
    s3Bucket: result.data.S3_BUCKET,
    s3Region: result.data.S3_REGION,
    otelExporterOtlpEndpoint: result.data.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelServiceName: result.data.OTEL_SERVICE_NAME,
    otelTracesEnabled: result.data.OTEL_TRACES_ENABLED,
    logLevel: result.data.LOG_LEVEL,
  };
}

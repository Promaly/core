import { z } from 'zod';

// Compose passes unset optional variables as "" (via `${VAR:-}`); treat blank as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  METRICS_HOST: z.string().default('127.0.0.1'),
  METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(9090),
  METRICS_TOKEN: optional(z.string().min(1)),
  DATABASE_URL: optional(z.string().url()),
  MIGRATION_DATABASE_URL: optional(z.string().url()),
  S3_ENDPOINT: optional(z.string().url()),
  S3_BUCKET: z.string().min(1).default('promaly'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(26_214_400),
  SMTP_URL: optional(z.string().url()),
  SMTP_FROM: optional(z.email()),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8081),
  OTEL_EXPORTER_OTLP_ENDPOINT: optional(z.string().url()),
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
  s3AccessKeyId: string | undefined;
  s3SecretAccessKey: string | undefined;
  s3ForcePathStyle: boolean;
  maxAttachmentBytes: number;
  smtpUrl: string | undefined;
  smtpFrom: string | undefined;
  workerHealthPort: number;
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
    s3AccessKeyId: result.data.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: result.data.S3_SECRET_ACCESS_KEY,
    s3ForcePathStyle: result.data.S3_FORCE_PATH_STYLE,
    maxAttachmentBytes: result.data.MAX_ATTACHMENT_BYTES,
    smtpUrl: result.data.SMTP_URL,
    smtpFrom: result.data.SMTP_FROM,
    workerHealthPort: result.data.WORKER_HEALTH_PORT,
    otelExporterOtlpEndpoint: result.data.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelServiceName: result.data.OTEL_SERVICE_NAME,
    otelTracesEnabled: result.data.OTEL_TRACES_ENABLED,
    logLevel: result.data.LOG_LEVEL,
  };
}

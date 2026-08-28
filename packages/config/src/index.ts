import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof configSchema>['NODE_ENV'];
  host: string;
  port: number;
  databaseUrl: string | undefined;
  s3Endpoint: string | undefined;
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
    databaseUrl: result.data.DATABASE_URL,
    s3Endpoint: result.data.S3_ENDPOINT,
    logLevel: result.data.LOG_LEVEL,
  };
}

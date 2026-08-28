import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  webServer: {
    command: 'HOST=127.0.0.1 PORT=3100 LOG_LEVEL=silent pnpm --filter @promaly/api start',
    port: 3100,
    reuseExistingServer: !process.env.CI,
  },
});

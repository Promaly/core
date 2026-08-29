import { defineConfig } from 'vitest/config';

// Integration tests boot a PostgreSQL container each; run files serially and
// allow for cold-start image pulls so a constrained CI runner isn't overwhelmed.
export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

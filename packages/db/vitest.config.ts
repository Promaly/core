import { defineConfig } from 'vitest/config';

// Integration tests start a PostgreSQL container; image pull and boot can take
// well over the default 5s on cold CI runners.
export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

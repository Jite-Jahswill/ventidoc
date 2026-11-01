import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    // These tests share one real Postgres database; running test files in
    // parallel workers would let them race on the same rows.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // A few tests exercise real sockets (Mailpit integration, retry/backoff,
    // a deliberately-unreachable port) — vitest's 5s default can be too
    // tight for those under load; match packages/db's headroom.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

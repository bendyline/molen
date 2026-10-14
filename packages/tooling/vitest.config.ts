import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Model suites decode and regenerate large GLBs. Bound memory and CPU contention.
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

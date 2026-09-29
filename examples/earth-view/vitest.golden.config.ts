import { defineConfig } from 'vitest/config';

// Streaming Seattle terrain and models on a software rasterizer took 87-180s per test on 4-vCPU CI
// runners, so each test allows 360s: a threshold for a wedged browser, not an expected duration.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    testTimeout: 360_000,
    hookTimeout: 120_000,
  },
});

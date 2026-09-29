import { defineConfig } from 'vitest/config';

// Golden-image tests are slow (launch a browser) and need Playwright chromium, so they run
// as a separate task (test:golden), not with the fast unit tests. The worldgen preview's lineup
// renders took 34-60s on 4-vCPU CI runners, so each test allows 180s: a threshold for a wedged
// browser, not an expected duration.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});

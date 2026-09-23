import { defineConfig } from 'vitest/config';

// Golden-image tests are slow (launch a browser) and need Playwright chromium, so they run
// as a separate task (test:golden), not with the fast unit tests.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

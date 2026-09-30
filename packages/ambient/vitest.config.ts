import { defineConfig } from 'vitest/config';

// Most tests here step a live traffic world for hundreds or thousands of ticks: well under 2 s each
// on a workstation, but 2-13 s on a CI runner shared with every other package's suite, past
// Vitest's 5 s default.
export default defineConfig({
  test: { testTimeout: 60_000 },
});

import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Scene scripts are authored in TypeScript; strip types when they are read as text.
  plugins: [molenScripts()],
  // Generous on purpose: the browser test boots a Worker game on a software rasterizer and waits
  // on six page conditions, each allowed 60s (see the test). The file budget must exceed the sum
  // of those waits, or vitest kills the run first and Playwright's precise "which wait" message
  // is lost. A healthy machine finishes far inside this.
  test: { include: ['test/golden/**/*.test.ts'], testTimeout: 420_000, hookTimeout: 60_000 },
});

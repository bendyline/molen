import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Scene scripts are authored in TypeScript; strip types when they are read as text.
  plugins: [molenScripts()],
  test: { include: ['test/golden/**/*.test.ts'], testTimeout: 60000, hookTimeout: 60000 },
});

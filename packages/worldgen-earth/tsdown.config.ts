import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/kernel.ts', 'src/client.ts', 'src/worker.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  external: ['three', '@bendyline/molen-client'],
});

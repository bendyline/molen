import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cache.ts', 'src/node.ts'],
  format: 'esm',
  dts: true,
  clean: true,
});

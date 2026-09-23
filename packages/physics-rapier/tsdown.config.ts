import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // WASM-inlined rapier is loaded at runtime; keep it external (its glue breaks when bundled).
  external: ['@dimforge/rapier3d-compat'],
});

import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // dist/schemas/ is part of the package (the "./schemas/*" export), so every tsdown run emits it,
  // not only `pnpm build`: `clean` would otherwise leave `pnpm assets:build` and the
  // `pnpm dev:packages` watcher with a dist that has no JSON Schemas.
  onSuccess: 'node scripts/emit-schemas.mjs',
});

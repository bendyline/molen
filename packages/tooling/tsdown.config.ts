import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // Runtime deps imported dynamically; never bundle them (CJS-in-ESM hazards / heavy / native
  // binaries + WASM files resolved relative to their own package).
  external: ['playwright', '@modelcontextprotocol/sdk', 'sharp', 'ktx2-encoder'],
  // dist/capture, dist/docs-src and dist/templates are part of the package, so every tsdown run
  // writes them, not only `pnpm build`: `clean` would otherwise leave `pnpm assets:build` and the
  // `pnpm dev:packages` watcher with a dist missing them.
  onSuccess:
    'node scripts/build-capture.mjs && node scripts/build-docs.mjs && node scripts/build-templates.mjs',
});

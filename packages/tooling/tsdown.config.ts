import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  // Runtime deps imported dynamically; never bundle them (CJS-in-ESM hazards / heavy / native
  // binaries + WASM files resolved relative to their own package).
  external: ['playwright', '@modelcontextprotocol/sdk', 'sharp', 'ktx2-encoder'],
});

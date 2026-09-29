import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/client.ts',
    'src/workers/elevation.ts',
    'src/workers/landcover.ts',
    'src/workers/surface.ts',
    'src/workers/worldgen.ts',
    'src/workers/material.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
  // One three.js and one client in the host's bundle; every molen package stays a real import.
  external: [/^three(\/.*)?$/, /^@bendyline\/molen-/],
});

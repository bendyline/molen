import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/client.ts',
    'src/workers/elevation.ts',
    'src/workers/landcover.ts',
    'src/workers/surface.ts',
    'src/workers/worldgen.ts',
    'src/workers/material.ts',
    'src/workers/semantic.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
  // One three.js and one client in the host's bundle; every molen package stays a real import.
  external: [/^three(\/.*)?$/, /^@bendyline\/molen-/],
  // Keep the vehicle runtimes (road vehicles, aircraft, trains) in their own chunk as the client
  // grows, so the entry stays under the package-content gate's per-chunk limit. This is code;
  // fleets, liveries and models remain in the content packs.
  outputOptions: {
    codeSplitting: {
      groups: [
        { name: 'vehicles', test: /[/\\]client[/\\](vehicles|aircraft|trains)\.ts$/ },
        { name: 'harbors', test: /[/\\]client[/\\]harbor[a-z-]*\.ts$/ },
      ],
    },
  },
});

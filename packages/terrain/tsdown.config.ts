import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/kernel.ts', 'src/client.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  external: ['three', '@bendyline/molen-client'],
  // Keep the ground/pavement shader implementation separate as the client grows. This is
  // renderer code; geographic catalogs and sign artwork remain in the content packs.
  outputOptions: {
    codeSplitting: {
      groups: [
        { name: 'ground-material', test: /[/\\]ground-material\.ts$/ },
        { name: 'surface-renderer', test: /[/\\]surface-client\.ts$/ },
      ],
    },
  },
});

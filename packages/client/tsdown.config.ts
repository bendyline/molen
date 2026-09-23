import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/camera-track.ts',
    'src/vite.ts',
    'src/vehicles.ts',
    'src/aircraft.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
  // three + its addons subpaths (GLTFLoader etc.) stay external — one pinned install.
  external: [/^three(\/.*)?$/],
});

import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play).
  base: './',
  // Reuse the World Explorer's Sammamish terrain package and content packs rather than copying
  // 22 MB of data; its build script writes the packs (see predev/prebuild).
  publicDir: '../world-explorer/public',
  build: {
    target: 'es2022',
    // main.ts mounts with a top-level `await` and the client lazy-loads its WebGPU driver; three
    // and the client in their own chunk keep that lazy import from waiting on the entry.
    rollupOptions: { output: { manualChunks: { vendor: ['three', '@bendyline/molen-client'] } } },
  },
});

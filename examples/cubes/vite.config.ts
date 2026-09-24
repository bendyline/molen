import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play hosts
  // the samples beneath subdirectories).
  base: './',
  // The kernel Worker is an ES module, bundled like the page.
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // main.ts mounts with a top-level `await`, and the client lazy-loads its WebGPU driver. By
    // default Rollup puts three.js and the client in the entry chunk, so the lazy chunk imports
    // the entry while the entry is still suspended at that `await`: the import never settles and
    // the page stays blank in every browser with a WebGPU adapter. Their own chunk breaks the cycle.
    rollupOptions: { output: { manualChunks: { vendor: ['three', '@bendyline/molen-client'] } } },
  },
});

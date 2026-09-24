import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Scene scripts are authored in TypeScript; strip types when they are read as text.
  plugins: [molenScripts()],
  base: './',
  // Vite gives worker bundles their own plugin pipeline, and the kernel runs in the Worker —
  // without this the Worker would receive unstripped TypeScript.
  worker: { format: 'es', plugins: () => [molenScripts()] },
  build: {
    target: 'es2022',
    // main.ts mounts with a top-level `await`, and the client lazy-loads its WebGPU driver. By
    // default Rollup puts three.js and the client in the entry chunk, so the lazy chunk imports
    // the entry while the entry is still suspended at that `await`: the import never settles and
    // the page stays blank in every browser with a WebGPU adapter. Their own chunk breaks the cycle.
    rollupOptions: { output: { manualChunks: { vendor: ['three', '@bendyline/molen-client'] } } },
  },
});

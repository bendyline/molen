import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [molenScripts()],
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play).
  base: './',
  // Reuse the World Explorer's Sammamish terrain package and content packs rather than copying
  // 22 MB of data; its build script writes the packs (see predev/prebuild).
  publicDir: '../world-explorer/public',
  build: {
    target: 'es2022',
    // main.ts mounts with a top-level `await` and the client lazy-loads its WebGPU driver; three
    // and the client in their own chunk keep that lazy import from waiting on the entry. The
    // dioramas' lazy scripting runtime shares the kernel and figures with the Earth view, so the
    // Earth client and everything it imports statically join them; lazy chunks stay lazy.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['three', '@bendyline/molen-client', '@bendyline/molen-earth/client'],
        },
      },
    },
  },
});

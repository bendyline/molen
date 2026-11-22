import { readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig, type Plugin } from 'vite';
import { EARTH_VIEW_TERRAIN } from './src/terrain-regions';

/**
 * The shared public directory carries every World Explorer region; the Earth view loads two.
 * Drop the others from the build, so the hosted sample does not publish a second copy of them
 * (GitHub Pages publishes at most 1 GB, and they are most of the site). The golden build
 * hard-links public/ in after Vite instead (scripts/build-golden.mjs); links cost no space.
 */
function earthViewTerrainOnly(): Plugin {
  let terrainDir = '';
  return {
    name: 'earth-view-terrain-only',
    apply: 'build',
    configResolved(config) {
      terrainDir = resolve(config.root, config.build.outDir, 'terrain');
    },
    // Vite copies the public directory before writing the bundle, so it is all there by now.
    async closeBundle() {
      const entries = await readdir(terrainDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isDirectory() && !EARTH_VIEW_TERRAIN.includes(entry.name)) {
          await rm(resolve(terrainDir, entry.name), { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [molenScripts(), earthViewTerrainOnly()],
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play).
  base: './',
  // Reuse the World Explorer's Seattle and Sammamish terrain packages and content packs rather
  // than keeping copies; dev reuses prepared packs and production prebuild refreshes them.
  publicDir: '../world-explorer/public',
  build: {
    target: 'es2022',
    // The golden build hard-links the shared public/ into dist instead (scripts/build-golden.mjs):
    // copying its ~20 GB of content packs into this and the explorer's dist filled the CI runner.
    copyPublicDir: process.env.MOLEN_SKIP_PUBLIC_COPY !== '1',
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

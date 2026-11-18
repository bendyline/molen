import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [molenScripts()],
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play hosts
  // the samples beneath subdirectories).
  base: './',
  build: {
    target: 'es2022',
    // The golden build hard-links public/ into dist instead (scripts/build-golden.mjs): copying
    // its ~20 GB of content packs into this and the Earth view's dist filled the CI runner.
    copyPublicDir: process.env.MOLEN_SKIP_PUBLIC_COPY !== '1',
    rollupOptions: {
      input: {
        main: 'index.html',
        structures: 'structures.html',
        sky: 'sky.html',
        signs: 'road-signs.html',
      },
    },
  },
});

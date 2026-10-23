import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [molenScripts()],
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play hosts
  // the samples beneath subdirectories).
  base: './',
  build: {
    target: 'es2022',
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

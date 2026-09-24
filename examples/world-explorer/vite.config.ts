import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so one production build plays from any directory (molen.dev/play hosts
  // the samples beneath subdirectories).
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: 'index.html', structures: 'structures.html', sky: 'sky.html' },
    },
  },
});

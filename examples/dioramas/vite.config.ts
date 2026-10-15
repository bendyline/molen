import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [molenScripts()],
  build: {
    target: 'es2022',
    // main.ts mounts with a top-level `await`, and both the client's WebGPU driver and the
    // diorama scripting runtime load lazily. Anything they share with the entry chunk would make
    // them import the entry while it is still suspended at that `await`, so the packages the page
    // imports statically get their own chunk. Lazy chunks (the kernel among them) stay lazy.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['three', '@bendyline/molen-client', '@bendyline/molen-dioramas/client'],
        },
      },
    },
  },
});

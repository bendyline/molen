import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Scene scripts are authored in TypeScript; strip types when they are read as text.
  plugins: [molenScripts()],
  // Vite gives worker bundles their own plugin pipeline, and the kernel runs in the Worker —
  // without this the Worker would receive unstripped TypeScript.
  worker: { format: 'es', plugins: () => [molenScripts()] },
  build: { target: 'es2022' },
});

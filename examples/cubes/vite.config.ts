import { defineConfig } from 'vite';

export default defineConfig({
  // Workers and the app both import workspace TS sources directly; Vite transpiles them.
  worker: { format: 'es' },
  build: { target: 'es2022' },
});

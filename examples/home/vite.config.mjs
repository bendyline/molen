import { defineConfig } from 'vite';

// The production build of the gallery. molen.dev serves it at /play/ with each sample's own build
// beside it at /play/<id>/ (docs-site/scripts/stage-hosted.mjs), so every URL in it is relative:
// `base: './'` covers the stylesheet, script and fonts, and the sample links in index.html are
// written as `./<id>/`. The local gallery (dev-server.mjs) does not read this file; it serves the
// page at `/` with each sample mounted at `/<id>/`, where the same relative links resolve.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});

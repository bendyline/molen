# Third-party notices

`@bendyline/molen-tooling` is MIT licensed (see LICENSE). Two parts of it carry third-party code:

- **Capture pages** (`dist/capture/harness.js`, `dist/capture/worldgen-preview.js`): prebuilt
  browser bundles that the rendering operations load into headless Chromium. They bundle three.js,
  zod, fflate and the map-tile libraries the terrain renderer uses. Each bundled package, its
  version, license and license text are listed in `dist/capture/THIRD-PARTY-NOTICES.md`, which the
  build writes from the bundler's own input list.
- **Basis Universal transcoder** (`dist/capture/basis/`): Binomial LLC's texture transcoder,
  copied unmodified from three.js, under the Apache License 2.0 (`dist/capture/basis/LICENSE.txt`).
  It lets captures render KTX2-compressed textures.

The engine documentation bundled in `dist/docs-src/` is Molen's own work under the MIT License.
Other npm dependencies are installed, not vendored, and carry their own licenses.

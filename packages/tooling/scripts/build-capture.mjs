// Bundles the browser capture harness (with three.js) into dist/capture/ and copies the page,
// plus three's Basis transcoder (dist/capture/basis/) so packed KTX2 assets render in captures.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

mkdirSync('dist/capture/basis', { recursive: true });

// three is the client's dependency, not ours: resolve it from the client package's entry.
const clientRequire = createRequire(
  createRequire(import.meta.url).resolve('@bendyline/molen-client'),
);
const basisDir = dirname(
  clientRequire.resolve('three/examples/jsm/libs/basis/basis_transcoder.js'),
);
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  copyFileSync(join(basisDir, file), join('dist/capture/basis', file));
}

await build({
  entryPoints: ['capture/harness.ts'],
  bundle: true,
  // esm (not iife) so lazy imports that never run in the capture path — materials' Node-side
  // SVG rung (resvg-wasm, node:*) — can stay external instead of breaking the bundle.
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  external: ['@resvg/resvg-wasm', 'node:module', 'node:fs/promises'],
  outfile: 'dist/capture/harness.js',
});

await build({
  entryPoints: ['capture/worldgen-preview.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  external: ['@resvg/resvg-wasm', 'node:module', 'node:fs/promises'],
  outfile: 'dist/capture/worldgen-preview.js',
});

copyFileSync('capture/capture.html', 'dist/capture/capture.html');
copyFileSync('capture/worldgen-preview.html', 'dist/capture/worldgen-preview.html');
console.log('built capture harnesses -> dist/capture/');

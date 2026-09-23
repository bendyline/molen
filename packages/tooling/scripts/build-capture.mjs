// Bundles the browser capture harness (with three.js) into dist/capture/ and copies the page,
// plus three's Basis transcoder (dist/capture/basis/) so packed KTX2 assets render in captures.
// The bundles carry third-party code, so this also writes dist/capture/THIRD-PARTY-NOTICES.md
// from the bundler's own list of inputs, with each package's license text.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
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
copyFileSync('capture/licenses/basis-universal.txt', 'dist/capture/basis/LICENSE.txt');
const bundled = new Set();

/** Record the npm package directory of every third-party module a bundle took in. */
function collect(result) {
  for (const input of Object.keys(result.metafile.inputs)) {
    const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/@.][^/]*)\//);
    if (match) bundled.add(resolve(match[1]));
  }
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
  metafile: true,
}).then(collect);

await build({
  entryPoints: ['capture/worldgen-preview.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  external: ['@resvg/resvg-wasm', 'node:module', 'node:fs/promises'],
  outfile: 'dist/capture/worldgen-preview.js',
  metafile: true,
}).then(collect);

const sections = [...bundled]
  .map((dir) => ({ dir, manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .sort((a, b) => (a.manifest.name < b.manifest.name ? -1 : 1))
  .map(({ dir, manifest }) => {
    // The package's own license file, else the text vendored in capture/licenses/ for packages
    // that publish none. Redistributing bundled code requires the license text itself, so a
    // package with neither fails the build rather than getting a link.
    const file = readdirSync(dir).find((name) => /^licen[cs]e/i.test(name));
    const vendored = join('capture/licenses', `${manifest.name.replace('/', '__')}.txt`);
    if (file === undefined && !existsSync(vendored)) {
      throw new Error(
        `${manifest.name} is bundled into the capture pages but ships no license text; add it to ${vendored} (see capture/licenses/README.md)`,
      );
    }
    const text = readFileSync(file !== undefined ? join(dir, file) : vendored, 'utf8').trim();
    return `## ${manifest.name} ${manifest.version} (${manifest.license})\n\n\`\`\`\n${text}\n\`\`\`\n`;
  });
writeFileSync(
  'dist/capture/THIRD-PARTY-NOTICES.md',
  `# Third-party code in the capture pages\n\n` +
    `harness.js and worldgen-preview.js bundle the following packages. basis/ holds the Basis ` +
    `Universal transcoder (Binomial LLC, Apache License 2.0; see basis/LICENSE.txt), copied from ` +
    `three.js.\n\n${sections.join('\n')}`,
);

copyFileSync('capture/capture.html', 'dist/capture/capture.html');
copyFileSync('capture/worldgen-preview.html', 'dist/capture/worldgen-preview.html');
console.log('built capture harnesses -> dist/capture/');

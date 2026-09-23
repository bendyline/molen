#!/usr/bin/env node
// Install the packed release tarballs into a fresh project the way a user would, with npm and
// nothing from this workspace, then use them. A missing or undeclared dependency, a peer range
// that rejects current three.js, content left in a package, or a CLI that only works inside the
// monorepo fails here instead of on npm.
//
//   pnpm -r build && node scripts/smoke-packed.mjs
//
// Needs the npm registry for third-party dependencies. Packing goes through packRelease, so the
// release's manifest and content checks run too.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packRelease, releasePackages } from './semantic-release-molen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');

function run(command, args, cwd, options = {}) {
  process.stdout.write(`$ ${command} ${args.join(' ')}\n`);
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe', ...options });
}

const packages = releasePackages();
const version = packages[0].data.version;
const archives = packRelease(packages, version).map((item) => item.archive);
const peer = (name, dep) =>
  JSON.parse(readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8')).peerDependencies[
    dep
  ];

const dir = mkdtempSync(join(tmpdir(), 'molen-packed-'));
try {
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'molen-packed-smoke', private: true, type: 'module' }, null, 2)}\n`,
  );
  // The highest three.js the declared peer range allows, as a new user would get it.
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      ...archives,
      `three@${peer('client', 'three')}`,
      'react@19',
      'react-dom@19',
      'typescript@6',
    ],
    dir,
    { stdio: 'inherit' },
  );

  // Every export of every package imports in plain Node.
  const probe = [];
  for (const { data } of packages) {
    for (const [subpath, target] of Object.entries(data.exports ?? {})) {
      const file = typeof target === 'string' ? target : target.default;
      if (!/\.m?js$/.test(file)) continue;
      probe.push(`${data.name}${subpath === '.' ? '' : subpath.slice(1)}`);
    }
  }
  writeFileSync(join(dir, 'imports.json'), JSON.stringify(probe));
  writeFileSync(
    join(dir, 'imports.mjs'),
    `import { readFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync('imports.json', 'utf8'));
const failed = [];
for (const id of ids) {
  try {
    await import(id);
  } catch (error) {
    failed.push(id + ': ' + error.message);
  }
}
if (failed.length > 0) {
  console.error(failed.join('\\n'));
  process.exit(1);
}
console.log('imported ' + ids.length + ' entry points');
`,
  );
  process.stdout.write(run('node', ['imports.mjs'], dir));

  // The CLI from the installed package: scaffold, validate, simulate and assert.
  const molen = join(dir, 'node_modules', '.bin', 'molen');
  process.stdout.write(run(molen, ['--version'], dir));
  run(molen, ['new', 'demo'], dir);
  const demo = join(dir, 'demo');
  process.stdout.write(run(molen, ['validate', 'scenes/main.scene.json'], demo));
  process.stdout.write(run(molen, ['scripts', 'check'], demo));
  process.stdout.write(
    run(
      molen,
      ['sim', 'run', 'main', '--ticks', '30', '--commands', 'cmds.json', '--assert', 'checks.json'],
      demo,
    ),
  );

  // Content comes from packs: build two with the installed CLI and read them with the packages.
  const packs = join(dir, 'packs');
  for (const source of ['entities', 'sky']) {
    run(molen, ['pack', 'build', join(ROOT, 'content', source), '--out-dir', packs], dir);
  }
  writeFileSync(
    join(dir, 'content.mjs'),
    `import { readdirSync } from 'node:fs';
import { decodeStarCatalog } from '@bendyline/molen-client';
import { molenAircraft } from '@bendyline/molen-entities';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { createPackSet } from '@bendyline/molen-pack';
import { openFilePack } from '@bendyline/molen-pack/node';

const file = (prefix) => \`packs/\${readdirSync('packs').find((name) => name.startsWith(prefix))}\`;
const entities = await openFilePack(file('molen.entities-'));
const types = createTypeLibrary(
  await Promise.all(entities.manifest.provides.types.map((path) => entities.readJson(path))),
);
const spec = molenAircraft(types, 'molen.entities.aircraft.p51d').spec;
const model = await createPackSet([entities]).readBytes('molen.entities.aircraft.p51d');
const sky = await openFilePack(file('molen.sky-'));
const stars = decodeStarCatalog(await sky.readBytes('stars.bin'));
if (!spec || model.byteLength < 1000 || stars.length !== 8404) throw new Error('content mismatch');
console.log(\`read the P-51D (\${model.byteLength} bytes of glTF) and \${stars.length} stars from packs\`);
`,
  );
  process.stdout.write(run('node', ['content.mjs'], dir));
  console.log(`smoke-packed: ${archives.length} tarballs installed and used from ${dir}`);
} finally {
  if (keep) console.log(`kept ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}

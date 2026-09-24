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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// The sample templates typecheck, test and build with their own dev tools; install the ranges
// their manifests declare, once, so every template project below resolves them from here.
const TEMPLATES = join(ROOT, 'packages', 'tooling', 'dist', 'templates');
function templateDevRange(dep) {
  const { templates } = JSON.parse(readFileSync(join(TEMPLATES, 'index.json'), 'utf8'));
  const ranges = new Set(
    templates
      .map(({ id }) => JSON.parse(readFileSync(join(TEMPLATES, id, 'package.json'), 'utf8')))
      .map((manifest) => manifest.devDependencies?.[dep])
      .filter((range) => range !== undefined),
  );
  if (ranges.size !== 1) throw new Error(`templates disagree on ${dep}: ${[...ranges].join(', ')}`);
  return [...ranges][0];
}

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
      `vite@${templateDevRange('vite')}`,
      `vitest@${templateDevRange('vitest')}`,
      `@types/three@${templateDevRange('@types/three')}`,
      `@types/node@${templateDevRange('@types/node')}`,
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

  // Every sample template, scaffolded by the installed CLI and driven through the loop `molen new`
  // printed for it: validate, scripts check, sim run with its commands and checks, replay. Then
  // the npm scripts a user runs: typecheck, the headless tests and a Vite build. The projects sit
  // inside this directory, so they resolve the installed tarballs from its node_modules (npm run
  // puts every ancestor's node_modules/.bin on PATH) instead of each running npm install.
  const templates = JSON.parse(run(molen, ['templates', '--json'], dir));
  if (templates.length === 0) throw new Error('molen templates listed nothing');
  const templatesDir = join(dir, 'templates');
  mkdirSync(templatesDir);
  for (const { id } of templates) {
    process.stdout.write(`\n# template ${id}\n`);
    const printed = run(molen, ['new', id, '--template', id], templatesDir);
    const project = join(templatesDir, id);
    const steps = printed
      .slice(printed.indexOf('\nnext:\n'))
      .split('\n')
      .map((line) => line.trim().replace(/\s+#.*$/, ''));
    const loop = steps.filter((step) => step.startsWith('npx molen '));
    if (loop.length === 0) throw new Error(`molen new --template ${id} printed no headless loop`);
    for (const step of loop) {
      process.stdout.write(run(molen, step.slice('npx molen '.length).split(/\s+/), project));
    }
    run('npm', ['run', 'typecheck'], project, { stdio: 'inherit' });
    if (steps.includes('npm test')) run('npm', ['test'], project, { stdio: 'inherit' });
    run('npm', ['run', 'build', '--', '--logLevel', 'warn'], project, { stdio: 'inherit' });
  }

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
  console.log(
    `smoke-packed: ${archives.length} tarballs installed and used from ${dir}; ${templates.length} templates scaffolded, checked, tested and built`,
  );
} finally {
  if (keep) console.log(`kept ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}

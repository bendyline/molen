#!/usr/bin/env node
// What the landmark LOD suites (`pnpm test:lods`) read, as one hash of the commit. CI skips them
// when they already passed on the same hash: they are half an hour of test time that only landmark
// content and the geometry code under it can change. The list covers whole directories rather than
// the files a suite happens to open, and scripts/test/lod-tests.test.mjs fails when a suite reaches
// something it does not cover.
//
// GLBs are not in Git, but the sidecars and source manifests here pin their hashes, which CI's
// `content` job compares with the bundle.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '@bendyline/molen-';
/** Packages whose code the suites import; their Molen dependencies come with them. */
const PACKAGES = ['worldgen', 'worldgen-earth', 'terrain'];
/** Parts of a package that decide what it does; its tests and changelog do not. */
const PACKAGE_PARTS = ['package.json', 'scripts', 'src', 'tsdown.config.ts'];
const PATHS = [
  '.node-version',
  'pnpm-lock.yaml',
  'reference-lock.json',
  'tsconfig.base.json',
  'content/earth',
  'content/worldgen',
  // Suites of placed landmarks share their capture footprints.
  'examples/world-explorer/test',
  'packages/tooling/package.json',
  'packages/tooling/scripts',
  'packages/tooling/test',
  'packages/tooling/vitest.config.ts',
  'packages/tooling/vitest.lods.config.ts',
  // Their pack helper.
  'packages/worldgen-earth/test/helpers',
];

/** `names` and every Molen package they depend on, transitively. */
function withDependencies(root, names, found = new Set()) {
  for (const name of names) {
    if (found.has(name)) continue;
    found.add(name);
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    const depends = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
      .filter((dependency) => dependency.startsWith(PREFIX))
      .map((dependency) => dependency.slice(PREFIX.length));
    withDependencies(root, depends, found);
  }
  return found;
}

/** The repository paths whose content the suites' results depend on. */
export function lodTestPaths(root = ROOT) {
  const packages = [...withDependencies(root, PACKAGES)];
  return [
    ...PATHS,
    ...packages.flatMap((name) => PACKAGE_PARTS.map((part) => `packages/${name}/${part}`)),
  ].sort();
}

/** A hash of those paths in the checked-out commit. */
export function lodTestHash(root = ROOT) {
  const tree = execFileSync('git', ['ls-tree', '-z', 'HEAD', '--', ...lodTestPaths(root)], {
    cwd: root,
    encoding: 'utf8',
  });
  if (!tree.includes('\tcontent/worldgen\0'))
    throw new Error('The commit has no content/worldgen; the landmark LOD inputs moved.');
  return createHash('sha256').update(tree).digest('hex').slice(0, 32);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.stdout.write(`${lodTestHash()}\n`);

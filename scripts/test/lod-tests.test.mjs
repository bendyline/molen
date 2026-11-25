// The landmark LOD suites are their own task, and CI skips them when they passed on the same inputs.
// Both rest on lists that drift: which files are suites, and what they read.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lodTestHash, lodTestPaths } from '../lod-test-inputs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS = 'packages/tooling/test';
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8').replaceAll('\r\n', '\n');
const suites = readdirSync(resolve(ROOT, TESTS)).filter((name) => /-lods\.test\.mjs$/.test(name));

test('every landmark LOD suite belongs to test:lods and none to test:unit', () => {
  const { scripts } = JSON.parse(read('packages/tooling/package.json'));
  assert.match(scripts['test:unit'], /--exclude "test\/\*\*\/\*-lods\.test\.mjs"/);
  assert.match(scripts['test:lods'], /--config vitest\.lods\.config\.ts/);
  assert.match(
    read('packages/tooling/vitest.lods.config.ts'),
    /include: \['test\/\*\*\/\*-lods\.test\.mjs'\]/,
  );
  assert.ok(suites.length > 300);
  // A suite under another name would go back to running in every unit job.
  const strays = readdirSync(resolve(ROOT, TESTS)).filter(
    (name) =>
      /\.test\.mjs$/.test(name) &&
      !suites.includes(name) &&
      read(`${TESTS}/${name}`).includes('landmark-lods.mjs'),
  );
  assert.deepEqual(strays, [], 'name landmark LOD suites *-lods.test.mjs');
  const root = JSON.parse(read('package.json')).scripts;
  assert.match(root.verify, /pnpm test:unit && pnpm test:lods/);
  // They regenerate landmarks beside the installed ones, so the bundle is checked afterwards too.
  assert.equal(root['posttest:lods'], root['posttest:unit']);
  // The full package builds, not tsdown alone: the suites read generated placement catalogs.
  assert.equal(root['pretest:lods'], root['pretest:unit']);
});

test("CI's hash of their inputs covers everything the suites name", () => {
  const covered = lodTestPaths().map((path) => path.replace(/\/$/, ''));
  const within = (path) =>
    covered.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  /** A built module is covered by the source it was built from. */
  const source = (path) => path.replace(/^(packages\/[\w-]+)\/dist(\/|$)/, '$1/src$2');
  const missing = new Set();
  for (const name of suites) {
    const text = read(`${TESTS}/${name}`);
    const named = [
      // Relative to the suite: imports, and the paths it resolves against its own URL.
      ...[...text.matchAll(/['"`]((?:\.\.?\/)+[^'"`$\s]*)['"`]/g)].map((match) =>
        posix.normalize(posix.join(TESTS, match[1])),
      ),
      // Relative to the repository.
      ...[
        ...text.matchAll(/['"`]((?:content|examples|packages|scripts|assets)\/[^'"`$\s]*)['"`]/g),
      ].map((match) => match[1]),
    ];
    for (const path of named) {
      const file = source(path.replace(/\/$/, ''));
      if (within(file)) continue;
      // A prefix that a suite completes itself (`../../..`, `packages`), or a path relative to
      // something other than the suite, which names no file here.
      const target = resolve(ROOT, file);
      if (!existsSync(target) || statSync(target).isDirectory()) continue;
      missing.add(`${name}: ${path}`);
    }
  }
  assert.deepEqual([...missing], [], 'add these to scripts/lod-test-inputs.mjs');
});

test('the hash follows the packages the suites import, and is stable', () => {
  const paths = lodTestPaths();
  for (const name of ['worldgen', 'worldgen-earth', 'terrain', 'kernel', 'schema', 'materials'])
    assert.ok(paths.includes(`packages/${name}/src`), name);
  assert.ok(!paths.includes('packages/entities/src'), 'unrelated packages do not rerun them');
  assert.deepEqual(paths, [...new Set(paths)].sort());
  // A source-only copy has no commit to hash.
  if (existsSync(resolve(ROOT, '.git'))) {
    assert.match(lodTestHash(), /^[a-f0-9]{32}$/);
    assert.equal(lodTestHash(), lodTestHash());
  }
});

test('CI runs the suites in shards unless they passed on these inputs, and notes when they do', () => {
  const ci = read('.github/workflows/ci.yml').replace(/^\s*#.*\n/gm, '');
  const jobs = new Map(
    ci
      .split(/^jobs:\s*$/m)[1]
      .split(/(?=^ {2}[\w-]+:\s*$)/m)
      .filter((block) => /^ {2}[\w-]+:/.test(block))
      .map((block) => [block.match(/^ {2}([\w-]+):/)[1], block]),
  );
  const check = jobs.get('check');
  assert.match(check, /key=lod-tests-\$\(node scripts\/lod-test-inputs\.mjs\)/);
  assert.match(check, /lookup-only: true/);
  const lods = jobs.get('lods');
  assert.match(lods, /if: needs\.check\.outputs\.lods-passed != 'true'/);
  const shards = lods.match(/shard: \[([\d, ]+)\]/)[1].split(',').length;
  assert.match(
    lods,
    new RegExp(`pnpm test:lods --shard=\\$\\{\\{ matrix\\.shard \\}\\}/${shards}`),
  );
  const noted = jobs.get('lods-passed');
  // Only after every shard: a job that needs the matrix waits for all of it and for its success.
  assert.match(noted, /needs: \[check, lods\]/);
  assert.doesNotMatch(noted, /always\(\)|!cancelled|failure\(\)/);
  const path = (job, action) =>
    job.match(new RegExp(`${action}@v4\\n\\s+with:\\n\\s+path: (\\S+)`))?.[1];
  assert.equal(path(check, 'cache/restore'), path(noted, 'cache/save'), 'a cache is found by path');
});

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const prepare = 'uses: ./.github/actions/prepare-asset-runner';

test('shared asset restoration prepares disk before downloading or extracting the cache', () => {
  const action = read('.github/actions/fetch-assets/action.yml');
  const prepared = action.indexOf(prepare);
  const restore = action.indexOf('uses: actions/cache/restore@');
  assert.ok(prepared >= 0 && restore > prepared);
  assert.ok(action.indexOf('pnpm assets:fetch') > restore);
});

test("a job that reads GLBs prepares disk, then installs this run's artifact offline", () => {
  const action = read('.github/actions/restore-assets/action.yml');
  const order = [
    prepare,
    'uses: actions/download-artifact@',
    'pnpm assets:fetch --no-build --offline',
  ].map((text) => action.indexOf(text));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  // It takes what `assets` checked and nothing else: no cache, no release, no source build.
  assert.doesNotMatch(action, /actions\/cache|assets:build|asset-packs\.mjs seed/);
  assert.equal(action.match(/pnpm assets:fetch/g).length, 1);
});

test('direct downloads of the asset archives also prepare disk first', () => {
  let restores = 0;
  for (const file of readdirSync(new URL('../../.github/workflows/', import.meta.url))) {
    if (!/\.ya?ml$/.test(file)) continue;
    const workflow = read(`.github/workflows/${file}`).replaceAll('\r\n', '\n');
    const jobs = workflow.split(/^jobs:\s*$/m)[1]?.split(/(?=^ {2}[\w-]+:\s*$)/m) ?? [];
    for (const job of jobs) {
      const steps = job.split(/(?=^ {6}- )/m);
      let prepared = false;
      for (const step of steps) {
        if (step.includes(prepare)) prepared = true;
        if (
          /uses: actions\/(cache\/restore|download-artifact)@/.test(step) &&
          step.includes('path: .artifacts/asset-packs/')
        ) {
          restores++;
          assert.ok(
            prepared,
            `${file}: ${job.trim().split('\n')[0]} restores assets before cleanup`,
          );
        }
      }
    }
  }
  assert.ok(restores > 0, 'the publish-assets job downloads its archives directly');
});

/** A workflow's jobs by id, each as its YAML text without comments. */
function workflowJobs(file) {
  const workflow = read(`.github/workflows/${file}`)
    .replaceAll('\r\n', '\n')
    .replace(/^\s*#.*\n/gm, '');
  const blocks = workflow.split(/^jobs:\s*$/m)[1]?.split(/(?=^ {2}[\w-]+:\s*$)/m) ?? [];
  return new Map(
    blocks
      .filter((block) => /^ {2}[\w-]+:/.test(block))
      .map((block) => [block.match(/^ {2}([\w-]+):/)[1], block]),
  );
}
const needs = (job) => {
  const value = job.match(/^ {4}needs: (.+)$/m)?.[1] ?? '';
  return value
    .replace(/[[\]]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

test('the fast CI checks need no GLBs and wait for nothing', () => {
  const check = workflowJobs('ci.yml').get('check');
  assert.ok(check, 'ci.yml has a check job');
  assert.deepEqual(needs(check), []);
  assert.doesNotMatch(check, /fetch-assets|actions\/cache\/restore|assets:fetch|assets:build/);
  // The full package builds run GLB-reading validators; the fast job compiles with tsdown alone.
  assert.doesNotMatch(check, /pnpm typecheck|pnpm build|-r build/);
  for (const command of ['exec tsdown', 'pnpm -r typecheck', 'pnpm lint', 'pnpm docs:check'])
    assert.ok(check.includes(command), `check runs ${command}`);
});

test('every CI job that restores GLBs waits for the job that builds them', () => {
  const jobs = workflowJobs('ci.yml');
  assert.match(jobs.get('assets') ?? '', /uses: \.\/\.github\/actions\/fetch-assets/);
  let readers = 0;
  for (const [id, job] of jobs) {
    if (id === 'assets') continue;
    // Only `assets` may download a release or build: four jobs doing that at once is what a
    // lost cache used to cost.
    assert.doesNotMatch(job, /fetch-assets/, `${id} must install the artifact, not rebuild`);
    if (job.includes('restore-assets') || job.includes('path: .artifacts/asset-packs/')) {
      readers++;
      assert.ok(needs(job).includes('assets'), `${id} restores GLBs before assets has them`);
    }
  }
  assert.ok(readers >= 5, 'docs-site, unit, packed, golden and publish-assets read the bundle');
});

test("the bundle reaches the other jobs as this run's artifact, never through the cache", () => {
  const jobs = workflowJobs('ci.yml');
  const steps = jobs.get('assets').split(/(?=^ {6}- )/m);
  const upload = steps.find((step) => step.includes('uses: actions/upload-artifact@'));
  assert.ok(upload, 'assets uploads the bundle');
  for (const line of [
    'name: asset-bundle',
    'path: .artifacts/asset-packs/',
    // `.artifacts` is hidden, the archives are already compressed, and a full re-run uploads
    // the same name again.
    'include-hidden-files: true',
    'compression-level: 0',
    'if-no-files-found: error',
    'overwrite: true',
  ])
    assert.ok(upload.includes(line), `the upload sets ${line}`);
  assert.match(upload, /retention-days: [1-7]\n/, 'about 8 GB a run is not kept for 90 days');
  // Upload what was restored and checked, after the checks that read it.
  const index = (text) => steps.findIndex((step) => step.includes(text));
  assert.ok(index('fetch-assets') < index('pnpm assets:check'));
  assert.ok(index('pnpm assets:check') < steps.indexOf(upload));
  const restore = read('.github/actions/restore-assets/action.yml').replaceAll('\r\n', '\n');
  for (const text of [restore, jobs.get('publish-assets')]) {
    assert.match(text, /uses: actions\/download-artifact@/);
    assert.match(text, /name: asset-bundle\n\s+path: \.artifacts\/asset-packs\/\n/);
  }
  for (const [id, job] of jobs)
    if (id !== 'assets')
      assert.doesNotMatch(job, /key: molen-assets-/, `${id} reads the bundle from the cache`);
});

test('the cache keeps one bundle, and none that would evict every other cache', () => {
  const action = read('.github/actions/fetch-assets/action.yml').replaceAll('\r\n', '\n');
  const steps = action.split(/(?=^ {4}- )/m);
  const prune = steps.findIndex((step) => step.includes('node scripts/asset-packs.mjs prune'));
  const saves = steps.flatMap((step, index) =>
    step.includes('uses: actions/cache/save@') ? [index] : [],
  );
  assert.equal(saves.length, 2, 'the job records and the bundle');
  assert.ok(prune >= 0 && saves.every((index) => index > prune), 'prune before saving');
  // The prune runs whatever the bundle came from: `assets` uploads this directory afterwards.
  assert.doesNotMatch(steps[prune], /^ {4}- if:/);
  assert.match(steps[prune], /id: bundle\n/);
  assert.match(
    steps[prune],
    /\[ "\$bytes" -le \d+ \]; then echo "cache=true" >> "\$GITHUB_OUTPUT"/,
  );
  const limit = Number(steps[prune].match(/-le (\d+) \]/)[1]);
  assert.ok(limit < 10e9, 'GitHub keeps 10 GB of caches for a repository');
  const bundle = steps[saves[1]];
  assert.match(bundle, /path: \.artifacts\/asset-packs\/\n/);
  assert.match(bundle, /steps\.bundle\.outputs\.cache == 'true'/);
  // The small job records are saved whatever the bundle's size.
  assert.doesNotMatch(steps[saves[0]], /steps\.bundle/);
});

test('a push to main publishes any bundle without a release, not only one it just built', () => {
  const jobs = workflowJobs('ci.yml');
  // A bundle whose publish failed comes back from the Actions cache, so "built" would skip it.
  assert.match(jobs.get('assets'), /gh release view "\$RELEASE"/);
  assert.match(jobs.get('assets'), /assets-unpublished: \$\{\{ steps\.release\.outputs\.unpublish/);
  assert.match(jobs.get('publish-assets'), /needs\.assets\.outputs\.assets-unpublished == 'true'/);
  const action = read('.github/actions/fetch-assets/action.yml');
  assert.match(action, /value: \$\{\{ steps\.key\.outputs\.release \}\}/);
});

test('a source build starts from an earlier one and keeps its records for the next', () => {
  const action = read('.github/actions/fetch-assets/action.yml').replaceAll('\r\n', '\n');
  const paths = [...action.matchAll(/path: \|\n((?: {10}.+\n)+)/g)].map((m) => m[1]);
  assert.equal(paths.length, 2, 'one restore and one save of the job records');
  assert.equal(paths[0], paths[1], 'restore and save must name the same paths to match');
  for (const path of ['.artifacts/asset-build/jobs/*.json', '.artifacts/asset-build/seed.json'])
    assert.ok(paths[0].includes(path));
  assert.match(action, /restore-keys: molen-asset-seed-\n/);
  const order = [
    'pnpm assets:fetch --no-build',
    'key: molen-asset-seed-',
    'node scripts/asset-packs.mjs seed',
    'pnpm assets:build --compile',
    'pnpm assets:pack',
    'cp .artifacts/asset-packs/installed.json .artifacts/asset-build/seed.json',
    // Without the prune the seed's archives ride along and the cache passes GitHub's 10 GB limit.
    'node scripts/asset-packs.mjs prune',
    'uses: actions/cache/save@',
  ].map((text) => action.indexOf(text));
  assert.ok(
    order.every((index) => index >= 0),
    'every seeding step is present',
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    'seed before building; record and prune after packing, before saving',
  );
});

test('SDK cleanup is limited to disposable hosted Linux runners', () => {
  const action = read('.github/actions/prepare-asset-runner/action.yml');
  assert.match(action, /if: runner\.os == 'Linux' && runner\.environment == 'github-hosted'/);
  assert.match(action, /shell: bash/);
  assert.match(action, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android/);
  assert.equal(action.match(/df -h \//g)?.length, 2, 'record free space before and after cleanup');
});

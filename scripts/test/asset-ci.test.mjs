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

test('direct asset cache restores also prepare disk first', () => {
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
          step.includes('uses: actions/cache/restore@') &&
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
  assert.ok(restores > 0, 'the publish-assets job restores its archives directly');
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
  for (const [id, job] of jobs) {
    if (id === 'assets') continue;
    if (job.includes('fetch-assets') || job.includes('path: .artifacts/asset-packs/'))
      assert.ok(needs(job).includes('assets'), `${id} restores GLBs before assets has them`);
  }
  assert.match(jobs.get('publish-assets'), /needs\.assets\.outputs\.assets-built == 'true'/);
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
    'uses: actions/cache/save@',
  ].map((text) => action.indexOf(text));
  assert.ok(
    order.every((index) => index >= 0),
    'every seeding step is present',
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    'seed before building, record after packing',
  );
});

test('SDK cleanup is limited to disposable hosted Linux runners', () => {
  const action = read('.github/actions/prepare-asset-runner/action.yml');
  assert.match(action, /if: runner\.os == 'Linux' && runner\.environment == 'github-hosted'/);
  assert.match(action, /shell: bash/);
  assert.match(action, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android/);
  assert.equal(action.match(/df -h \//g)?.length, 2, 'record free space before and after cleanup');
});

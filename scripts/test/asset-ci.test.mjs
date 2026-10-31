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

test('SDK cleanup is limited to disposable hosted Linux runners', () => {
  const action = read('.github/actions/prepare-asset-runner/action.yml');
  assert.match(action, /if: runner\.os == 'Linux' && runner\.environment == 'github-hosted'/);
  assert.match(action, /shell: bash/);
  assert.match(action, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android/);
  assert.equal(action.match(/df -h \//g)?.length, 2, 'record free space before and after cleanup');
});

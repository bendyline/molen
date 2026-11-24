// One workflow builds GLBs, once per bundle, and publishes them; every other job restores them from
// that release. These are the parts of that arrangement a small workflow edit would undo.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const url = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(url(path), 'utf8').replaceAll('\r\n', '\n');
const uncommented = (text) => text.replace(/^\s*#.*\n/gm, '');
const prepare = 'uses: ./.github/actions/prepare-asset-runner';
const WORKFLOWS = readdirSync(url('.github/workflows/')).filter((name) => /\.ya?ml$/.test(name));

/** A workflow's jobs by id, each as its YAML text without comments. */
function workflowJobs(file) {
  const workflow = uncommented(read(`.github/workflows/${file}`));
  const blocks = workflow.split(/^jobs:\s*$/m)[1]?.split(/(?=^ {2}[\w-]+:\s*$)/m) ?? [];
  return new Map(
    blocks
      .filter((block) => /^ {2}[\w-]+:/.test(block))
      .map((block) => [block.match(/^ {2}([\w-]+):/)[1], block]),
  );
}
const stepsOf = (job) => job.split(/(?=^ {6}- )/m).slice(1);
const needs = (job) => {
  const value = job.match(/^ {4}needs: (.+)$/m)?.[1] ?? '';
  return value
    .replace(/[[\]]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};
const ascending = (indexes, message) => {
  assert.ok(
    indexes.every((index) => index >= 0),
    `${message}: ${indexes}`,
  );
  assert.deepEqual(
    indexes,
    [...indexes].sort((a, b) => a - b),
    message,
  );
};

test('a job that reads GLBs prepares disk, then installs the published bundle and nothing else', () => {
  const action = uncommented(read('.github/actions/restore-assets/action.yml'));
  ascending(
    [prepare, 'pnpm assets:fetch --no-build --no-cache'].map((text) => action.indexOf(text)),
    'prepare the disk before downloading',
  );
  // It never builds, and takes nothing from a cache or an artifact another run could have left.
  assert.doesNotMatch(
    action,
    /actions\/cache|download-artifact|assets:build|asset-packs\.mjs seed/,
  );
  assert.equal(action.match(/pnpm assets:fetch/g).length, 1);
  // Only "not published" (status 3) is worth waiting for; anything else fails at once.
  assert.match(action, /if \[ "\$status" -ne 3 \]; then exit "\$status"; fi/);
});

test('only the Assets workflow builds GLBs', () => {
  for (const file of WORKFLOWS) {
    if (file === 'assets.yml') continue;
    const workflow = uncommented(read(`.github/workflows/${file}`));
    assert.doesNotMatch(
      workflow,
      /assets:build|assets:pack|assets:publish|asset-packs\.mjs (seed|state|pack|publish)/,
      file,
    );
  }
  assert.ok(!existsSync(url('.github/actions/fetch-assets')), 'no action builds as a fallback');
  const restore = read('package.json').match(/"assets:fetch": "([^"]+)"/)[1];
  assert.equal(restore, 'node scripts/asset-packs.mjs fetch');
});

test('the fast CI checks need no GLBs and wait for nothing', () => {
  const check = workflowJobs('ci.yml').get('check');
  assert.ok(check, 'ci.yml has a check job');
  assert.deepEqual(needs(check), []);
  assert.doesNotMatch(check, /restore-assets|assets:fetch|assets:build/);
  // The full package builds run GLB-reading validators; the fast job compiles with tsdown alone.
  assert.doesNotMatch(check, /pnpm typecheck|pnpm build|-r build/);
  for (const command of ['exec tsdown', 'pnpm -r typecheck', 'pnpm lint', 'pnpm docs:check'])
    assert.ok(check.includes(command), `check runs ${command}`);
});

test('every CI job that restores GLBs waits for the workflow that publishes them', () => {
  const jobs = workflowJobs('ci.yml');
  const assets = jobs.get('assets');
  assert.match(assets, /^ {4}uses: \.\/\.github\/workflows\/assets\.yml$/m);
  // Permission to publish ends at this call; every other job has the workflow's read-only token.
  assert.match(assets, /permissions:\n\s+contents: write/);
  assert.match(
    uncommented(read('.github/workflows/ci.yml')).split(/^jobs:/m)[0],
    /^permissions:\n {2}contents: read$/m,
  );
  // It must keep building when a fast check fails, so the next push starts from its bundle.
  assert.deepEqual(needs(assets), []);
  let readers = 0;
  for (const [id, job] of jobs) {
    if (!job.includes('restore-assets')) continue;
    readers++;
    assert.ok(needs(job).includes('assets'), `${id} restores GLBs before assets published them`);
    assert.doesNotMatch(job, /contents: write/, `${id} only reads`);
  }
  assert.ok(readers >= 6, 'content, docs-site, unit, lods, packed and golden read the bundle');
  // The bundle and the source bundles are checked against this checkout somewhere in CI.
  const content = stepsOf(jobs.get('content')).map((step) => step.trim());
  ascending(
    ['restore-assets', 'pnpm assets:check', 'molen-schema build', 'pnpm source:check'].map((text) =>
      content.findIndex((step) => step.includes(text)),
    ),
    'content restores, then checks',
  );
});

test('a bundle is built once, whoever asks, and a published one is not built at all', () => {
  const { key, build } = Object.fromEntries(workflowJobs('assets.yml'));
  assert.match(key, /published: \$\{\{ steps\.state\.outputs\.published \}\}/);
  assert.match(build, /if: needs\.key\.outputs\.published != 'true'/);
  // The group is the bundle: a pull request, its merge and a rerun wait for one build. Cancelling
  // the one that is running would throw its work away.
  assert.match(
    build,
    /concurrency:\n\s+group: asset-bundle-\$\{\{ needs\.key\.outputs\.release \}\}\n\s+cancel-in-progress: false/,
  );
  // Whoever waited asks again, and every step that builds depends on that answer.
  const steps = stepsOf(build);
  const state = steps.findIndex((step) => step.includes('asset-packs.mjs state'));
  assert.ok(state > 0);
  for (const step of steps.slice(state + 1)) {
    if (step.includes('asset-sidecars')) continue;
    assert.match(
      step,
      /if: (>-\s+)?steps\.state\.outputs\.published != 'true'/,
      `does not depend on the bundle's state:\n${step}`,
    );
  }
  // A pipe's status is its last command's unless the shell is named.
  for (const job of [key, build])
    for (const step of stepsOf(job).filter((text) => text.includes('| tee')))
      assert.match(step, /shell: bash/);
  // Both look at a published bundle's sidecars: they can change without naming a new one.
  for (const job of [key, build])
    assert.match(
      job,
      /run: node scripts\/asset-packs\.mjs state --check \| tee -a "\$GITHUB_OUTPUT"/,
    );
  const limit = Number(build.match(/timeout-minutes: (\d+)/)[1]);
  assert.ok(limit < 360, 'a hosted job ends at six hours; this one ends with its own message');
});

test('a source build seeds, builds, publishes, and only then checks the committed sidecars', () => {
  const steps = stepsOf(workflowJobs('assets.yml').get('build'));
  const at = (text) => steps.findIndex((step) => step.includes(text));
  ascending(
    [
      prepare,
      'node scripts/asset-packs.mjs seed --no-cache',
      "pnpm -r --filter './packages/**' exec tsdown",
      'pnpm assets:build',
      'pnpm assets:pack',
      'pnpm assets:publish',
      // After publishing: the push that commits the sidecars finds the bundle instead of building
      // it a second time.
      'pnpm assets:check --committed',
      'name: asset-sidecars',
    ].map(at),
    'the order of a source build',
  );
  // Without --committed a build is compared with the sidecars it just rewrote, and passes.
  const check = steps[at('pnpm assets:check --committed')];
  assert.doesNotMatch(check, /continue-on-error|\|\|/);
  const patch = steps[at('name: asset-sidecars')];
  for (const line of [
    'if: failure()',
    'uses: actions/upload-artifact@',
    'path: .artifacts/asset-build/sidecars.patch',
    'include-hidden-files: true',
    'if-no-files-found: ignore',
    'overwrite: true',
  ])
    assert.ok(patch.includes(line), `the sidecar upload sets ${line}`);
  // A fork's token cannot publish, so its build would be thrown away: say so before it starts.
  const fork = steps[at('head.repo.full_name != github.repository')];
  assert.ok(steps.indexOf(fork) < at('asset-packs.mjs seed'));
  assert.match(fork, /exit 1/);
  // The tag marks a commit of main, never the pull request's own (see the step).
  assert.match(steps[at('pnpm assets:publish')], /commits\/main/);
  assert.match(steps[at('pnpm assets:publish')], /--built-from "\$GITHUB_SHA"/);
});

test('generators run without a token that could write to the repository', () => {
  const build = workflowJobs('assets.yml').get('build');
  const steps = stepsOf(build);
  assert.match(
    steps.find((step) => step.includes('actions/checkout@')),
    /persist-credentials: false/,
  );
  const holders = steps.filter((step) => /GH_TOKEN|GITHUB_TOKEN/.test(step));
  assert.equal(holders.length, 2, 'only seeding (a listing) and publishing hold the token');
  for (const step of holders) assert.match(step, /asset-packs\.mjs seed|pnpm assets:publish/);
  assert.doesNotMatch(build.split(/^ {4}steps:/m)[0], /\benv:/, 'no token for the whole job');
});

test('bundles live in releases: no workflow keeps one in the cache or hands one over', () => {
  for (const file of [
    ...WORKFLOWS.map((name) => `.github/workflows/${name}`),
    '.github/actions/restore-assets/action.yml',
  ]) {
    const text = uncommented(read(file));
    // One bundle is most of the 10 GB GitHub keeps for a repository's caches.
    assert.doesNotMatch(text, /path: \.artifacts\/asset-packs/, file);
    assert.doesNotMatch(text, /name: asset-bundle\b/, file);
  }
  // Job records go with the bundle too; nothing saves them in a cache any more.
  for (const name of WORKFLOWS) {
    const saves = uncommented(read(`.github/workflows/${name}`)).match(
      /actions\/cache\/save@[\s\S]*?key: .+/g,
    );
    for (const save of saves ?? []) assert.doesNotMatch(save, /asset-(seed|build)/);
  }
});

test('a workflow that waits on GLBs, or could hang, has its own time limit', () => {
  for (const file of WORKFLOWS) {
    for (const [id, job] of workflowJobs(file)) {
      if (/^ {4}uses: /m.test(job)) continue; // Its own jobs have limits.
      assert.match(job, /timeout-minutes: \d+/, `${file}: ${id}`);
    }
  }
});

test('SDK cleanup is limited to disposable hosted Linux runners', () => {
  const action = read('.github/actions/prepare-asset-runner/action.yml');
  assert.match(action, /if: runner\.os == 'Linux' && runner\.environment == 'github-hosted'/);
  assert.match(action, /shell: bash/);
  assert.match(action, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android/);
  assert.equal(action.match(/df -h \//g)?.length, 2, 'record free space before and after cleanup');
});

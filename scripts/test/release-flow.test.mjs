// Release publishes npm packages from a commit CI passed and nothing else; Site builds molen.dev and
// the content packs from such a commit. Neither repeats CI's checks or reads what it does not ship.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { pushReleaseCommit } from '../push-release-commit.mjs';
import {
  checkedCommit,
  ciRuns,
  isReleaseMetadata,
  objection,
  requireGreenCi,
} from '../require-green-ci.mjs';

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const uncommented = (text) => text.replace(/^\s*#.*\n/gm, '');
/** A workflow's steps as text, in order, from the job named `id`. */
function steps(file, id) {
  const job = uncommented(read(`.github/workflows/${file}`))
    .split(/^jobs:\s*$/m)[1]
    .split(/(?=^ {2}[\w-]+:\s*$)/m)
    .find((block) => block.startsWith(`  ${id}:`));
  return { job, list: job.split(/(?=^ {6}- )/m).slice(1) };
}

const temps = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
const scratch = (name) => {
  const dir = mkdtempSync(join(tmpdir(), `molen-${name}-`));
  temps.push(dir);
  return dir;
};

/** A repository with its own origin, so nothing here can reach a real remote. */
function repository() {
  const dir = scratch('release-flow');
  const origin = join(dir, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const clone = (name) => {
    const root = join(dir, name);
    // Not the machine's autocrlf: the checkout's line endings would show up as a change.
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', origin, root], {
      stdio: 'ignore',
    });
    const git = (...args) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    git('checkout', '-q', '-B', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'commit.gpgsign', 'false');
    const commit = (message, files) => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
      }
      git('add', '-A');
      git('commit', '-q', '-m', message);
      return git('rev-parse', 'HEAD');
    };
    return { root, git, commit };
  };
  return { origin, clone };
}

const manifest = (version, extra = {}) =>
  `${JSON.stringify({ name: '@bendyline/molen-kernel', version, ...extra }, null, 2)}\n`;
const KERNEL = {
  'packages/kernel/package.json': manifest('0.0.1'),
  'packages/kernel/src/version.ts': "export const ENGINE_VERSION = '0.0.1';\n",
  'docs-src/llms.txt': 'Engine version: 0.0.1\n',
};
const RELEASED = {
  'packages/kernel/package.json': manifest('0.0.2'),
  'packages/kernel/CHANGELOG.md': '## 0.0.2\n',
  'packages/kernel/src/version.ts': "export const ENGINE_VERSION = '0.0.2';\n",
  'docs-src/llms.txt': 'Engine version: 0.0.2\n',
};

test('release metadata is a changelog or nothing but a version', () => {
  const path = 'packages/kernel/package.json';
  assert.ok(isReleaseMetadata(path, manifest('0.0.1'), manifest('0.0.2')));
  assert.ok(isReleaseMetadata(path, manifest('0.0.1'), manifest('0.0.2').replaceAll('\n', '\r\n')));
  assert.ok(
    !isReleaseMetadata(path, manifest('0.0.1'), manifest('0.0.2', { dependencies: { a: '1' } })),
  );
  assert.ok(!isReleaseMetadata(path, manifest('0.0.1'), manifest('0.0.1')));
  assert.ok(!isReleaseMetadata(path, undefined, manifest('0.0.1')), 'a new package is not checked');
  assert.ok(!isReleaseMetadata(path, manifest('0.0.1'), '{'));
  assert.ok(isReleaseMetadata('packages/kernel/CHANGELOG.md', undefined, '## 0.0.2\n'));
  assert.ok(!isReleaseMetadata('packages/kernel/CHANGELOG.md', '## 0.0.2\n', undefined));
  const engine = 'packages/kernel/src/version.ts';
  const stamped = (version) => `export const ENGINE_VERSION = '${version}';\n`;
  assert.ok(isReleaseMetadata(engine, stamped('0.0.1'), stamped('0.0.2')));
  assert.ok(!isReleaseMetadata(engine, stamped('0.0.1'), `${stamped('0.0.2')}evil();\n`));
  assert.ok(!isReleaseMetadata('packages/kernel/src/world.ts', 'a', 'b'));
});

test('a release commit inherits the CI result of the commit it records', () => {
  const { git, commit } = repository().clone('work');
  const source = commit('feat: kernel', KERNEL);
  assert.equal(checkedCommit(git, source), source, 'a root commit is its own');
  const release = commit('chore(release): update package versions [skip ci]', RELEASED);
  assert.equal(checkedCommit(git, release), source);
  // Two releases in a row, the second of which had only publishing left to record.
  const again = commit('chore(release): update package versions [skip ci]', {
    'packages/kernel/CHANGELOG.md': '## 0.0.2\n\nmore\n',
  });
  assert.equal(checkedCommit(git, again), source);
});

test('a commit that smuggles anything else beside the stamps needs its own CI run', () => {
  const { git, commit } = repository().clone('work');
  commit('feat: kernel', KERNEL);
  const release = commit('chore(release): update package versions [skip ci]', {
    ...RELEASED,
    'packages/kernel/src/world.ts': 'export {};\n',
  });
  assert.equal(checkedCommit(git, release), release);
  // A merge has two parents: neither's result says anything about the merged tree.
  git('checkout', '-q', '-b', 'side', 'HEAD^');
  commit('docs: side', { 'docs/side.md': 'side\n' });
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '-m', 'Merge side', 'side');
  const merge = git('rev-parse', 'HEAD');
  assert.equal(checkedCommit(git, merge), merge);
});

test('only a finished, successful newest CI run on main clears a commit', () => {
  const run = (id, status, conclusion, branch = 'main') => ({
    id,
    status,
    conclusion,
    html_url: `https://example.com/${id}`,
    head_branch: branch,
    created_at: `2026-11-2${id}T00:00:00Z`,
  });
  assert.match(objection([]), /has not run/);
  assert.match(objection([run(1, 'in_progress', null)]), /still running: https/);
  assert.match(objection([run(1, 'completed', 'failure')]), /finished with "failure"/);
  assert.match(objection([run(1, 'completed', 'cancelled')]), /finished with "cancelled"/);
  assert.equal(objection([run(1, 'completed', 'success')]), undefined);
  const listed = [
    run(1, 'completed', 'success'),
    run(3, 'completed', 'success', 'other'),
    run(2, 'completed', 'failure'),
  ];
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    return listed.map((item) => JSON.stringify(item)).join('\n');
  };
  const sha = 'a'.repeat(40);
  const runs = ciRuns(gh, 'bendyline/molen', sha);
  assert.deepEqual(
    runs.map((item) => item.id),
    [2, 1],
    'newest first, main only',
  );
  assert.match(calls[0].at(-1), new RegExp(`workflows/ci\\.yml/runs\\?head_sha=${sha}&event=push`));
  assert.match(objection(runs), /failure/, 'an older success does not clear a newer failure');
});

test('the gate names the commit it looked for and what to do', () => {
  const { git, commit } = repository().clone('work');
  const source = commit('feat: kernel', KERNEL);
  const release = commit('chore(release): update package versions [skip ci]', RELEASED);
  const gate = (gh) => requireGreenCi({ git, gh, repository: 'bendyline/molen', commit: release });
  assert.throws(
    () => gate(() => ''),
    new RegExp(
      `Refusing ${release} \\(CI runs on ${source}\\): CI has not run on it\\. Start this again`,
    ),
  );
  const success = JSON.stringify({
    id: 1,
    status: 'completed',
    conclusion: 'success',
    head_branch: 'main',
    created_at: '2026-11-24T00:00:00Z',
  });
  assert.equal(
    gate(() => success),
    source,
  );
});

test('the metadata commit lands on main as it is, or replayed when main moved', () => {
  const { clone } = repository();
  const release = clone('release');
  release.commit('feat: kernel', KERNEL);
  release.git('push', '-q', 'origin', 'main');
  const metadata = release.commit('chore(release): versions [skip ci]\n\n- kernel@0.0.2', RELEASED);
  assert.equal(
    pushReleaseCommit({ git: release.git, commit: metadata, delay: 0, log: () => {} }),
    metadata,
  );
  assert.equal(release.git('ls-remote', 'origin', 'refs/heads/main').split('\t')[0], metadata);

  // Someone pushes while the next release runs.
  const other = clone('other');
  const moved = other.commit('feat: more', { 'packages/kernel/src/more.ts': 'export {};\n' });
  other.git('push', '-q', 'origin', 'main');
  const next = release.commit('chore(release): versions [skip ci]\n\n- kernel@0.0.3', {
    'packages/kernel/package.json': manifest('0.0.3'),
  });
  const landed = pushReleaseCommit({ git: release.git, commit: next, delay: 0, log: () => {} });
  assert.notEqual(landed, next);
  other.git('fetch', '-q', 'origin');
  assert.equal(other.git('rev-parse', 'origin/main'), landed);
  assert.equal(other.git('rev-parse', `${landed}^`), moved);
  assert.equal(
    other.git('log', '-1', '--format=%B', landed),
    release.git('log', '-1', '--format=%B', next),
  );
  assert.deepEqual(other.git('diff', '--name-only', moved, landed).split('\n'), [
    'packages/kernel/package.json',
  ]);
  // What gets published is the tagged source with its stamps: the checkout did not move.
  assert.equal(release.git('rev-parse', 'HEAD'), next);
  assert.equal(release.git('status', '--porcelain'), '');
  assert.throws(() => readFileSync(join(release.root, 'packages/kernel/src/more.ts')), /ENOENT/);
});

test('a push that arrived although it reported failure is not pushed twice', () => {
  const { clone } = repository();
  const release = clone('release');
  release.commit('feat: kernel', KERNEL);
  release.git('push', '-q', 'origin', 'main');
  const metadata = release.commit('chore(release): versions [skip ci]', RELEASED);
  let pushes = 0;
  const git = (...args) => {
    const result = release.git(...args);
    if (args[0] === 'push' && ++pushes === 1) throw new Error('connection reset');
    return result;
  };
  assert.equal(pushReleaseCommit({ git, commit: metadata, delay: 0, log: () => {} }), metadata);
  assert.equal(pushes, 1);
});

test('a conflicting change on main and a refused push both fail instead of guessing', () => {
  const { clone } = repository();
  const release = clone('release');
  release.commit('feat: kernel', KERNEL);
  release.git('push', '-q', 'origin', 'main');
  const metadata = release.commit('chore(release): versions [skip ci]', RELEASED);
  const other = clone('other');
  other.commit('fix: version by hand', { 'packages/kernel/package.json': manifest('0.5.0') });
  other.git('push', '-q', 'origin', 'main');
  assert.throws(() =>
    pushReleaseCommit({ git: release.git, commit: metadata, delay: 0, log: () => {} }),
  );
  let pushes = 0;
  const refused = (...args) => {
    if (args[0] !== 'push') return release.git(...args);
    pushes++;
    throw new Error('refused');
  };
  // Nothing moved, so the same commit is tried again, then given up on.
  other.git('push', '-q', '-f', 'origin', `${release.git('rev-parse', `${metadata}^`)}:main`);
  assert.throws(
    () =>
      pushReleaseCommit({
        git: refused,
        commit: metadata,
        attempts: 3,
        delay: 0,
        log: () => {},
      }),
    /refused/,
  );
  assert.equal(pushes, 3);
});

test('Release compiles, versions, records and publishes; it restores and repeats nothing', () => {
  const { job, list } = steps('release.yml', 'release');
  const at = (text) => {
    const index = list.findIndex((step) => step.includes(text));
    assert.ok(index >= 0, `release.yml runs ${text}`);
    return index;
  };
  const order = [
    'node scripts/require-green-ci.mjs',
    "pnpm -r --filter './packages/**' exec tsdown",
    'pnpm exec multi-semantic-release',
    'node scripts/stage-release-metadata.mjs',
    'node scripts/publish-release.mjs',
    'gh workflow run site.yml',
  ].map(at);
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  const metadata = list[at('node scripts/stage-release-metadata.mjs')];
  // A cancelled or timed-out run must still record the tags it pushed.
  assert.match(metadata, /if: \$\{\{ always\(\) && steps\.version\.outcome != 'skipped' \}\}/);
  assert.match(metadata, /commit=\$\(node scripts\/push-release-commit\.mjs\)/);
  assert.doesNotMatch(metadata, /git push/);
  assert.doesNotMatch(
    job,
    /fetch-assets|restore-assets|assets:|pnpm (build|verify|test|docs)|docs:site|pages/,
  );
  const limit = Number(job.match(/timeout-minutes: (\d+)/)?.[1]);
  assert.ok(limit > 0 && limit <= 60, 'a hang ends long before GitHub cancels it');
  const publish = uncommented(read('scripts/publish-release.mjs')).replace(/^\/\/.*$/gm, '');
  assert.doesNotMatch(publish, /'verify'|docs:site/);
  assert.match(publish, /'tsdown'/);
});

test('the Site workflow checks the gate first and never builds a GLB', () => {
  const { job, list } = steps('site.yml', 'build');
  const order = [
    'node scripts/require-green-ci.mjs',
    'uses: ./.github/actions/restore-assets',
    'pnpm docs:site:build',
    'node scripts/publish-pack-release.mjs',
    'uses: actions/upload-pages-artifact@',
  ].map((text) => {
    const index = list.findIndex((step) => step.includes(text));
    assert.ok(index >= 0, `site.yml has ${text}`);
    return index;
  });
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.equal(job.match(/docs:site:build/g).length, 1, 'the site is built once');
  assert.doesNotMatch(job, /fetch-assets|assets:build|pnpm verify/);
  assert.match(job, /timeout-minutes: \d+/);
  assert.match(read('.github/workflows/site.yml'), /commit:\n\s+description:/);
});

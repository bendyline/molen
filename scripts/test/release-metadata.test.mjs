import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { KERNEL_STAMPS, releasedMetadata, remoteTags } from '../stage-release-metadata.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const HEAD = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
const pkg = (directory, version) => ({
  directory,
  data: { name: `@bendyline/molen-${directory}`, version },
});

test('ls-remote listings map tag names to commits, annotated tags peeled', () => {
  const tags = remoteTags(
    [
      `${HEAD}\trefs/tags/@bendyline/molen-figures@0.0.14`,
      `${'c'.repeat(40)}\trefs/tags/@bendyline/molen-kernel@0.0.11`,
      `${OLDER}\trefs/tags/@bendyline/molen-kernel@0.0.11^{}`,
      `${HEAD}\trefs/heads/main`,
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    [...tags],
    [
      ['@bendyline/molen-figures@0.0.14', HEAD],
      ['@bendyline/molen-kernel@0.0.11', OLDER],
    ],
  );
});

test('a release commit records only the packages whose tags reached GitHub', () => {
  // Run 43504403985: figures was tagged, GitHub refused input-react's tag, kernel never got that
  // far, and pack did not release.
  const packages = [
    pkg('figures', '0.0.14'),
    pkg('input-react', '0.0.14'),
    pkg('kernel', '0.0.11'),
    pkg('pack', '0.0.11'),
  ];
  const tags = new Map([
    ['@bendyline/molen-figures@0.0.13', OLDER],
    ['@bendyline/molen-figures@0.0.14', HEAD],
    ['@bendyline/molen-input-react@0.0.13', OLDER],
    ['@bendyline/molen-kernel@0.0.10', OLDER],
    ['@bendyline/molen-pack@0.0.11', OLDER],
  ]);
  const committed = new Map([
    ['@bendyline/molen-figures', '0.0.13'],
    ['@bendyline/molen-input-react', '0.0.13'],
    ['@bendyline/molen-kernel', '0.0.10'],
    ['@bendyline/molen-pack', '0.0.11'],
  ]);
  assert.deepEqual(releasedMetadata(packages, tags, HEAD, committed), {
    tags: ['@bendyline/molen-figures@0.0.14'],
    paths: ['packages/figures/package.json', 'packages/figures/CHANGELOG.md'],
    unreleased: ['@bendyline/molen-input-react@0.0.14', '@bendyline/molen-kernel@0.0.11'],
  });
});

test("the kernel's release also records its ENGINE_VERSION stamps", () => {
  const { paths } = releasedMetadata(
    [pkg('kernel', '0.0.11')],
    new Map([['@bendyline/molen-kernel@0.0.11', HEAD]]),
    HEAD,
    new Map([['@bendyline/molen-kernel', '0.0.10']]),
  );
  assert.deepEqual(paths, [
    'packages/kernel/package.json',
    'packages/kernel/CHANGELOG.md',
    ...KERNEL_STAMPS,
  ]);
  for (const path of KERNEL_STAMPS) assert.ok(read(path).length > 0, path);
});

test('the Release workflow versions through the push retry and commits through this script', () => {
  const workflow = read('.github/workflows/release.yml');
  const version = workflow.split('- name: Version packages')[1].split('- name:')[0];
  assert.match(version, /install -m 755 scripts\/git-push-retry\.sh "\$shim\/git"/);
  assert.match(version, /export REAL_GIT="\$\(command -v git\)"\n\s+export PATH="\$shim:\$PATH"/);
  const commit = workflow.split('- name: Commit release metadata')[1].split('- name:')[0];
  assert.match(commit, /node scripts\/stage-release-metadata\.mjs/);
  assert.doesNotMatch(commit, /git add/);
});

const temps = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

test('git push is retried through the PATH shim; dry runs and other commands are not', {
  skip: process.platform === 'win32' && 'the shim runs on the Linux release runner',
}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'molen-git-retry-'));
  temps.push(dir);
  const bin = join(dir, 'bin');
  const shim = join(bin, 'git');
  mkdirSync(bin);
  copyFileSync(fileURLToPath(new URL('../git-push-retry.sh', import.meta.url)), shim);
  chmodSync(shim, 0o755);
  // A stand-in for git that fails its first FAILS calls and counts every call.
  const fake = join(dir, 'fake-git');
  const count = join(dir, 'count');
  writeFileSync(
    fake,
    [
      '#!/bin/sh',
      `n=$(cat "${count}" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "${count}"`,
      '[ "$n" -gt "$FAILS" ] || exit 1',
      '',
    ].join('\n'),
  );
  chmodSync(fake, 0o755);
  const run = (fails, args) => {
    rmSync(count, { force: true });
    const result = spawnSync('git', args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        REAL_GIT: fake,
        FAILS: String(fails),
        GIT_PUSH_RETRY_DELAY: '0',
      },
    });
    return { status: result.status, calls: Number(readFileSync(count, 'utf8')) };
  };
  assert.deepEqual(run(2, ['push', '--tags', '--', 'url']), { status: 0, calls: 3 });
  assert.deepEqual(run(9, ['push', '--tags', '--', 'url']), { status: 1, calls: 4 });
  assert.deepEqual(run(9, ['push', '--dry-run', '--', 'url', 'HEAD:main']), {
    status: 1,
    calls: 1,
  });
  assert.deepEqual(run(9, ['tag', 'name', 'HEAD']), { status: 1, calls: 1 });
});

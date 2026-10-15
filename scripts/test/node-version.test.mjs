import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkNodeVersion } from '../check-node-version.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('accepts the pinned runtime and rejects a different Node/V8 before regression tests', () => {
  assert.doesNotThrow(() => checkNodeVersion('24.18.0', '24.18.0'));
  for (const actual of ['22.23.3', '24.19.0']) {
    assert.throws(
      () => checkNodeVersion(actual, '24.18.0'),
      /Pinned simulation hashes.*native math/,
    );
  }
});

test('CI regression jobs and release share the local runtime pin; packed installs also test Node 22', () => {
  const jobs = read('.github/workflows/ci.yml')
    .split('\njobs:\n')[1]
    .split(/(?=^ {2}[\w-]+:\s*$)/m)
    .slice(1);
  assert.ok(jobs.length > 0);
  for (const job of jobs) {
    if (job.startsWith('  packed:')) {
      assert.match(job, /node-version: 22\s/);
    } else {
      assert.match(job, /node-version-file: \.node-version/);
      assert.doesNotMatch(job, /node-version:/);
    }
  }
  for (const path of ['.github/workflows/release.yml', '.github/actions/fetch-assets/action.yml']) {
    assert.match(read(path), /node-version-file: \.node-version/);
  }
  const assetNode = JSON.parse(read('asset-build.json')).node;
  assert.equal(read('.node-version').trim().split('.')[0], assetNode);
});

test('local build and regression entry points check the runtime before doing work', () => {
  const { scripts } = JSON.parse(read('package.json'));
  for (const hook of ['prebuild', 'preverify', 'pretest:unit', 'pretest:golden']) {
    assert.ok(scripts[hook].startsWith('node scripts/check-node-version.mjs'), hook);
  }
});

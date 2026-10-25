import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkNodeVersion } from '../check-node-version.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('accepts any release of the pinned major and rejects another major before regression tests', () => {
  for (const actual of ['24.0.0', '24.18.0', '24.21.0', 'v24.0.0']) {
    assert.doesNotThrow(() => checkNodeVersion(actual, '24'));
    assert.doesNotThrow(() => checkNodeVersion(actual, '24.18.0'));
  }
  for (const actual of ['22.23.3', '23.11.0', '25.0.0']) {
    assert.throws(() => checkNodeVersion(actual, '24'), /Pinned simulation hashes.*native math/);
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

test('regression entry points check the runtime before doing work; build does not', () => {
  const { scripts } = JSON.parse(read('package.json'));
  assert.equal(scripts.prebuild, undefined);
  for (const hook of ['preverify', 'pretest:unit', 'pretest:golden']) {
    assert.ok(scripts[hook].startsWith('node scripts/check-node-version.mjs'), hook);
  }
});

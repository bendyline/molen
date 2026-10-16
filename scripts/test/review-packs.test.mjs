import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import * as tar from 'tar';
import { fileInfo } from '../asset-packs.mjs';
import {
  checkReviews,
  fetchReviews,
  isReviewPath,
  packReviews,
  publishReviews,
  validateReviewLock,
} from '../review-packs.mjs';

const roots = [];
const quiet = () => {};
const base = 'content/worldgen/source/places/gc/gcv/example';
const first = `${base}/shots/front.png`,
  second = `${base}/medium-fi/street.png`;
async function put(root, path, bytes) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), bytes);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-reviews-'));
  roots.push(root);
  await put(root, first, 'original first capture');
  await put(root, second, 'original second capture');
  await put(root, `${base}/preview.png`, 'keep thumbnail in Git');
  await put(root, `${base}/terrain.height.png`, 'keep source heightmap in Git');
  const lock = await packReviews({ root, repository: 'bendyline/molen', budget: 25, log: quiet });
  return { root, lock, directory: join(root, '.artifacts/review-packs', lock.release) };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}molen-reviews-`));
    await rm(root, { recursive: true, force: true });
  }
});

test('packs only review images, restores exact bytes, and preserves local edits', async () => {
  const { root, lock } = await fixture();
  assert.equal(lock.files.length, 2);
  assert.equal(lock.archives.length, 2);
  await checkReviews({ root, log: quiet });
  await rm(join(root, first));
  await put(root, second, 'new local render');
  assert.deepEqual(await fetchReviews({ root, offline: true, log: quiet }), {
    restored: 1,
    preserved: 1,
  });
  assert.equal(await readFile(join(root, first), 'utf8'), 'original first capture');
  assert.equal(await readFile(join(root, second), 'utf8'), 'new local render');
  await assert.rejects(checkReviews({ root, log: quiet }), /Missing or changed review/);
  await fetchReviews({ root, offline: true, force: true, log: quiet });
  await checkReviews({ root, log: quiet });
});

test('refuses incomplete repacking and missing or corrupt offline archives', async () => {
  const { root, directory, lock } = await fixture();
  await rm(join(root, first));
  await assert.rejects(
    packReviews({ root, repository: lock.repository, log: quiet }),
    /Missing previous review/,
  );
  const archive = lock.archives.find((a) => a.files.includes(first));
  await writeFile(join(directory, archive.file), 'corrupted');
  await assert.rejects(fetchReviews({ root, offline: true, log: quiet }), /missing or corrupt/);
});

test('rejects traversal, Windows paths, duplicates and incomplete archive coverage', async () => {
  const { lock } = await fixture();
  assert.equal(isReviewPath(`${base}/terrain.height.png`), false);
  assert.equal(isReviewPath('examples/game/test/golden/front.png'), false);
  for (const path of [
    `${base}/shots/../../escaped.png`,
    `${base}/shots/C:evil.png`,
    `${base}/shots/NUL.png`,
  ]) {
    const bad = structuredClone(lock);
    bad.files[0].path = path;
    assert.throws(() => validateReviewLock(bad), /Unsafe review path/);
  }
  const missing = structuredClone(lock);
  missing.archives.pop();
  assert.throws(() => validateReviewLock(missing), /cover every file/);
  const duplicate = structuredClone(lock);
  duplicate.archives.push(duplicate.archives[0]);
  assert.throws(() => validateReviewLock(duplicate), /Invalid review archive/);
});

test('checks archive members even when the outer archive hash matches', async () => {
  const { root, lock, directory } = await fixture();
  const archive = lock.archives.find((a) => a.files.includes(first));
  await put(root, 'unexpected.txt', 'not review evidence');
  await tar.c({ file: join(directory, archive.file), cwd: root }, [first, 'unexpected.txt']);
  Object.assign(archive, await fileInfo(join(directory, archive.file)));
  await writeFile(join(root, 'review-lock.json'), JSON.stringify(lock));
  await rm(join(root, first));
  await assert.rejects(
    fetchReviews({ root, offline: true, log: quiet }),
    /Unexpected archive entry/,
  );
  await assert.rejects(readFile(join(root, first)), { code: 'ENOENT' });
});

test('downloads only required archives and verifies their committed hashes', async () => {
  const { root, lock, directory } = await fixture();
  const archive = lock.archives.find((a) => a.files.includes(first));
  const bytes = await readFile(join(directory, archive.file));
  await rm(join(root, first));
  await rm(join(directory, archive.file));
  let calls = 0;
  await fetchReviews({
    root,
    log: quiet,
    fetchImpl: async (url) => {
      calls++;
      assert.equal(
        url,
        `https://github.com/bendyline/molen/releases/download/${lock.release}/${archive.file}`,
      );
      return new Response(bytes);
    },
  });
  assert.equal(calls, 1);
  await checkReviews({ root, log: quiet });
});

test('does not write through destination symlinks', async (t) => {
  const { root } = await fixture();
  await rm(join(root, first));
  await put(root, 'outside.png', 'outside');
  try {
    await symlink(join(root, 'outside.png'), join(root, first));
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Symlink privilege unavailable');
      return;
    }
    throw error;
  }
  await assert.rejects(fetchReviews({ root, force: true, offline: true, log: quiet }), /symlink/);
  assert.equal(await readFile(join(root, 'outside.png'), 'utf8'), 'outside');
});

test('publishes only after remote attachment digests match, and resumes without reuploading', async () => {
  const { root, directory, lock } = await fixture();
  const remote = [],
    calls = [];
  let release;
  const info = new Map();
  for (const file of [...lock.archives.map((a) => a.file), 'review-lock.json'])
    info.set(file, await fileInfo(join(directory, file)));
  const runGh = (args) => {
    calls.push(args);
    if (args.includes('--input')) {
      release = { id: 1, tag_name: lock.release, draft: true };
      return JSON.stringify(release);
    }
    if (args[0] === 'api')
      return JSON.stringify([args.at(-1).includes('/assets?') ? remote : release ? [release] : []]);
    if (args[1] === 'upload') {
      const name = args[3].split(/[\\/]/).at(-1),
        meta = info.get(name);
      remote.push({ name, size: meta.size, digest: `sha256:${meta.sha256}` });
    } else if (args[1] === 'edit') {
      assert.equal(remote.length, info.size);
      release.draft = false;
    }
    return '';
  };
  await publishReviews({ root, target: 'a'.repeat(40), runGh, log: quiet });
  const before = calls.filter((args) => args[1] === 'upload').length;
  await publishReviews({ root, target: 'a'.repeat(40), runGh, log: quiet });
  assert.equal(calls.filter((args) => args[1] === 'upload').length, before);
  remote[0].digest = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(
    publishReviews({ root, target: 'a'.repeat(40), runGh, log: quiet }),
    /refusing to replace/,
  );
});

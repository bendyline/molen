import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { contentHash } from './scan.mjs';
import {
  locateCompletedStory,
  syncCompleted,
  upsertCompletedModels,
  verifyCompletedStory,
  verifySelectedReferenceBytes,
} from './sync-completed.mjs';

test('reference verification accepts both fingerprint formats and rejects changed bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-reference-'));
  try {
    const bytes = Buffer.from('cleared original photograph');
    fs.writeFileSync(path.join(dir, 'photo.jpg'), bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    for (const sha256 of [digest, `sha256:${digest}`])
      verifySelectedReferenceBytes(dir, { path: 'photo.jpg', sha256 });
    for (const sha256 of [undefined, 'sha256:abc', `sha1:${digest}`, '0'.repeat(64)])
      assert.throws(
        () => verifySelectedReferenceBytes(dir, { path: 'photo.jpg', sha256 }),
        /bytes changed/,
      );
    fs.writeFileSync(path.join(dir, 'photo.jpg'), 'different photograph');
    assert.throws(
      () => verifySelectedReferenceBytes(dir, { path: 'photo.jpg', sha256: `sha256:${digest}` }),
      /bytes changed/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const model = () => ({
  assetId: 'molen.worldgen.structure.hall',
  structureId: 'QS-hall',
  candidateId: 'hall',
  sourcePath: 'content/worldgen/source/places/aa/aaa/hall',
  storyContentHash: 'abc',
  state: 'ready',
});
const desired = () => ({ models: [model()] });
test('bounded completion preserves other associations byte-for-byte and is idempotent', () => {
  const other = {
    ...model(),
    assetId: 'molen.other',
    state: 'needs-review',
    blockers: ['terrain'],
    custom: 'keep',
  };
  const first = upsertCompletedModels(undefined, desired());
  const before = { ...first, models: [other, ...first.models], custom: 'keep envelope' };
  const next = upsertCompletedModels(before, desired());
  assert.deepEqual(
    next.models.find((m) => m.assetId === 'molen.other'),
    other,
  );
  assert.equal(next.custom, 'keep envelope');
  assert.deepEqual(upsertCompletedModels(next, desired()), next);
});
test('bounded completion rejects foreign ownership, identity changes and false readiness', () => {
  const before = upsertCompletedModels(undefined, desired());
  assert.throws(
    () => upsertCompletedModels({ ...before, managedBy: 'other' }, desired()),
    /unrecognized/,
  );
  for (const key of ['structureId', 'candidateId', 'sourcePath', 'storyContentHash'])
    assert.throws(
      () => upsertCompletedModels(before, { models: [{ ...model(), [key]: 'changed' }] }),
      /identity differs/,
    );
  assert.throws(
    () => upsertCompletedModels(before, { models: [{ ...model(), state: 'needs-review' }] }),
    /ready/,
  );
  assert.throws(
    () => upsertCompletedModels({ ...before, models: [model(), model()] }, desired()),
    /Duplicate/,
  );
});
test('changed content, moved catalog and wrong story identity fail closed', () => {
  const article = {
      id: 'hall-wp',
      title: 'Hall',
      summary: 'Original',
      location: { longitude: 1, latitude: 2 },
    },
    current = { geohash4: 'u1ab', title: 'Hall' },
    story = { id: article.id, contentHash: contentHash(article, current.title) };
  verifyCompletedStory(story, article, current, 'u1ab');
  assert.throws(
    () => verifyCompletedStory(story, { ...article, summary: 'Changed' }, current, 'u1ab'),
    /changed/,
  );
  assert.throws(
    () => verifyCompletedStory(story, { ...article, id: 'other' }, current, 'u1ab'),
    /changed/,
  );
  assert.throws(
    () => verifyCompletedStory(story, article, { ...current, title: 'Changed' }, 'u1ab'),
    /changed/,
  );
  assert.throws(
    () => verifyCompletedStory(story, article, { ...current, geohash4: 'moved' }, 'u1ab'),
    /location/,
  );
});
test('completion sync requires explicit selected model identities', async () => {
  for (const ids of [undefined, [], [''], ['unrecognized-model']])
    await assert.rejects(syncCompleted({ ids }), /required|identity/);
});

test('unrelated broken bundles do not hide selected corruption, relocation or duplication', () => {
  const good = { name: 'u1ab.json', text: JSON.stringify({ 'hall-wp': { geohash4: 'u1ab' } }) },
    broken = { name: 'e9wq.json', text: '<<<<<<< conflict in unrelated editorial data' };
  assert.equal(locateCompletedStory([broken, good], 'hall-wp', 'u1ab').tile, 'u1ab');
  assert.throws(
    () =>
      locateCompletedStory(
        [broken, { name: 'u1ab.json', text: '{"hall-wp": <<<< conflict' }],
        'hall-wp',
        'u1ab',
      ),
    SyntaxError,
  );
  assert.throws(() => locateCompletedStory([good, good], 'hall-wp', 'u1ab'), /duplicate/);
  assert.throws(() => locateCompletedStory([good], 'hall-wp', 'else'), /relocation/);
  assert.throws(() => locateCompletedStory([broken], 'hall-wp', 'u1ab'), /Missing/);
});

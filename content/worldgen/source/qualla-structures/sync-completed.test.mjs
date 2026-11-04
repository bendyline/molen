import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { contentHash } from './scan.mjs';
import {
  completedBatchEntries,
  completedPhysicalModelIdentity,
  locateCompletedStory,
  syncCompleted,
  upsertCompletedModels,
  verifyCompletedStory,
  verifySelectedReferenceBytes,
} from './sync-completed.mjs';

test('a completed declared member links independently while its fixed parent stays unfinished', () => {
  const parent = {
    modelIdentity: 'observatory',
    structureId: 'QS-observatory',
    modelState: 'preparing-site-collection',
    storyIds: ['observatory-wp'],
    stories: [{ id: 'observatory-wp', contentHash: 'original' }],
  };
  const member = {
    ...parent,
    modelIdentity: 'observatory_control_building',
    parentModelIdentity: parent.modelIdentity,
    modelState: 'completed',
    sourcePath: 'content/worldgen/source/places/aa/aaa/observatory_control_building',
    workOwner: 'qualla-002',
  };
  parent.requiredMembers = [member];
  const batch = { id: 'qualla-002', entries: [parent] };
  assert.deepEqual(completedBatchEntries(batch, [member.modelIdentity]), [member]);
  assert.equal(parent.modelState, 'preparing-site-collection');
  assert.throws(() => completedBatchEntries(batch, [parent.modelIdentity]), /Not a completed/);
  for (const patch of [
    { parentModelIdentity: 'unrelated' },
    { structureId: 'QS-other' },
    { workOwner: 'other-device' },
    { storyIds: ['other-wp'] },
    { stories: [{ id: 'observatory-wp', contentHash: 'changed' }] },
    { modelState: 'authored-in-progress' },
    { sourcePath: undefined },
  ]) {
    const changed = structuredClone(batch);
    Object.assign(changed.entries[0].requiredMembers[0], patch);
    assert.throws(() => completedBatchEntries(changed, [member.modelIdentity]));
  }
  const duplicate = structuredClone(batch);
  duplicate.entries.push(member);
  assert.throws(() => completedBatchEntries(duplicate, [member.modelIdentity]), /Not a completed/);
});

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

test('a room batch key may link its explicitly identified whole physical building', () => {
  assert.equal(completedPhysicalModelIdentity({ modelIdentity: 'hall' }), 'hall');
  const parent = {
    modelIdentity: 'blue_room_white_house',
    physicalModelIdentity: 'white_house_executive_residence',
    physicalStructureId: 'QS-30c365bc4f36',
  };
  assert.equal(completedPhysicalModelIdentity(parent), 'white_house_executive_residence');
  for (const physicalStructureId of [undefined, '', 'unknown-parent'])
    assert.throws(
      () => completedPhysicalModelIdentity({ ...parent, physicalStructureId }),
      /identity invalid/,
    );
  for (const physicalModelIdentity of ['../white_house', 'qualla_white_house', 'White House', ''])
    assert.throws(
      () => completedPhysicalModelIdentity({ ...parent, physicalModelIdentity }),
      /identity invalid/,
    );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptedLodReviewDifferences,
  upsertAcceptedModel,
} from './link-accepted-existing-story.mjs';

const link = {
  assetId: 'molen.worldgen.structure.blue_house_hong_kong',
  candidateId: 'blue_house_hong_kong',
  structureId: 'QS-84da26848c96',
  sourcePath: 'content/worldgen/source/places/we/wec/blue_house_hong_kong',
  storyContentHash: 'story',
  state: 'needs-review',
};
const desired = { models: [link] };
const previous = {
  schemaVersion: 1,
  managedBy: 'molen-qualla-structures',
  models: [{ assetId: 'other-model', state: 'unlinked', inactiveReason: 'preserved history' }],
  custom: 'keep',
};

test('existing acceptance cannot certify current readiness', () => {
  assert.throws(() => upsertAcceptedModel(undefined, { models: [{ ...link, state: 'ready' }] }));
});
test('a bounded link preserves unrelated inactive history and annotation fields', () => {
  const next = upsertAcceptedModel(previous, desired);
  assert.deepEqual(
    next.models.find((m) => m.assetId === 'other-model'),
    previous.models[0],
  );
  assert.equal(next.custom, 'keep');
  assert.equal(next.models.find((m) => m.assetId === link.assetId).state, 'needs-review');
  assert.deepEqual(upsertAcceptedModel(next, desired), next);
});
test('a stale reuse operation preserves a newer ready link', () => {
  const current = {
    ...previous,
    models: [...previous.models, { ...link, state: 'ready', readinessBasis: 'newer review' }],
  };
  assert.deepEqual(upsertAcceptedModel(current, desired), current);
});
test('conflicting and duplicated physical identities are rejected', () => {
  assert.throws(() =>
    upsertAcceptedModel({ ...previous, models: [{ ...link, candidateId: 'different' }] }, desired),
  );
  assert.throws(() => upsertAcceptedModel({ ...previous, models: [link, link] }, desired));
});
test('foreign annotation ownership is preserved by refusal', () => {
  assert.throws(() => upsertAcceptedModel({ ...previous, managedBy: 'somebody-else' }, desired));
});
test('changed and previously unreviewed derivatives remain explicit differences', () => {
  const sidecar = {
    runtimeLods: {
      levels: [
        { name: 'skyline', hash: 'current' },
        { name: 'street', hash: 'same' },
        { name: 'closeup', hash: 'new' },
      ],
    },
  };
  const qa = {
    runtimeLodReview: {
      levels: [
        { name: 'skyline', hash: 'old' },
        { name: 'street', hash: 'same' },
      ],
    },
  };
  assert.deepEqual(acceptedLodReviewDifferences(sidecar, qa), [
    { name: 'skyline', currentHash: 'current', savedReviewHash: 'old' },
    { name: 'closeup', currentHash: 'new', savedReviewHash: null },
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { renameModelAnnotation } from './migrate-model-names.mjs';

const mapping = [
  {
    oldAsset: 'old',
    asset: 'new',
    oldSource: 'old/path',
    source: 'new/path',
    oldId: 'old-id',
    key: 'new-id',
    oldPlacement: 'old-placement',
    placement: 'new-placement',
  },
];
const previous = {
  schemaVersion: 1,
  managedBy: 'molen-qualla-structures',
  models: [
    {
      assetId: 'old',
      sourcePath: 'old/path',
      candidateId: 'old-id',
      activePlacementId: 'old-placement',
      placements: [{ id: 'old-placement', status: 'preview' }],
      structureId: 'story-target',
      storyContentHash: 'unchanged-story',
      state: 'ready',
      catalogEvidenceHash: 'previous-evidence',
    },
  ],
};

test('identity rename preserves coverage, provenance and unrelated links, then becomes a no-op', () => {
  const input = structuredClone(previous);
  input.models.push({ assetId: 'unrelated', state: 'needs-review' });
  const next = renameModelAnnotation(input, mapping);
  assert.equal(input.models[0].assetId, 'old');
  assert.deepEqual(next.models[0], {
    ...previous.models[0],
    assetId: 'new',
    sourcePath: 'new/path',
    candidateId: 'new-id',
    activePlacementId: 'new-placement',
    placements: [{ id: 'new-placement', status: 'preview' }],
  });
  assert.deepEqual(next.models[1], input.models[1]);
  assert.equal(renameModelAnnotation(next, mapping), next);
});

test('identity rename rejects changed ownership, mismatched sources and duplicate destinations', () => {
  assert.throws(() => renameModelAnnotation({ ...previous, managedBy: 'elsewhere' }, mapping));
  assert.throws(() => renameModelAnnotation(previous, [{ ...mapping[0], oldSource: 'different' }]));
  assert.throws(() =>
    renameModelAnnotation(
      { ...previous, models: [...previous.models, { assetId: 'new' }] },
      mapping,
    ),
  );
});

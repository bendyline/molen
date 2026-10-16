/** Annotation safety: false coverage, multiple structures, withdrawal and concurrent curation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  annotationScope,
  applyAnnotations,
  loadQuallaManager,
  modelAnnotations,
  planAnnotations,
  reconcileAnnotation,
} from './sync-qualla.mjs';

const story = {
  id: 'tower-wp',
  sourcePath: '_c/art/c/2/2/y/tower-wp.json',
  contentHash: 'story-v1',
};
const structure = () => ({
  id: 'QS-tower',
  name: 'Tower',
  status: 'existing-model-review',
  stories: [story],
  existing: [
    {
      basis: 'name-and-coordinate',
      assetId: 'molen.tower',
      candidateId: 'A01',
      sourcePath: 'content/worldgen/source/places/c2/c22/tower',
      sourceModelReported: true,
      registered: true,
      placements: [{ id: 'city.tower', status: 'preview' }],
    },
  ],
});
const entry = () => ({
  status: 'reviewed',
  geohash4: 'c22y',
  title: 'Tower',
  notes: 'Keep editorial notes',
  finalReview: { completed: true },
});
const bundles = (value = entry()) => [{ geohash4: 'c22y', entries: { [story.id]: value } }];

test('only unambiguous source-backed models qualify; registration is not readiness', () => {
  const base = structure();
  for (const status of ['new', 'existing-planned', 'identity-review']) {
    assert.equal(modelAnnotations([{ ...base, status }]).size, 0);
  }
  for (const patch of [
    { registered: false },
    { sourceModelReported: false },
    { assetId: null },
    { basis: 'possible-name-and-coordinate' },
  ]) {
    assert.equal(
      modelAnnotations([{ ...base, existing: [{ ...base.existing[0], ...patch }] }]).size,
      0,
    );
  }
  assert.equal(
    modelAnnotations([{ ...base, existing: [...base.existing, ...base.existing] }]).size,
    0,
  );
  const link = modelAnnotations([base]).get(story.id).models[0];
  assert.equal(link.state, 'needs-review');
  assert.deepEqual(link.placements, [{ id: 'city.tower', status: 'preview' }]);
  base.status = 'existing-ready';
  base.existing[0].readiness = { status: 'ready', activePlacement: null };
  assert.equal(modelAnnotations([base]).get(story.id).models[0].state, 'needs-review');
  base.existing[0].readiness.activePlacement = 'city.tower';
  assert.equal(modelAnnotations([base]).get(story.id).models[0].state, 'ready');
});

test('several models per story and several stories per model retain stable asset IDs', () => {
  const first = structure();
  first.stories.push({ ...story, id: 'tower-wk', sourcePath: '_c/art/c/2/2/y/tower-wk.json' });
  const second = structure();
  second.id = 'QS-hall';
  second.name = 'Hall';
  second.existing[0].assetId = 'molen.hall';
  const desired = modelAnnotations([first, second, first]);
  assert.equal(desired.size, 2);
  assert.deepEqual(
    desired.get(story.id).models.map((link) => link.assetId),
    ['molen.hall', 'molen.tower'],
  );
  assert.equal(desired.get('tower-wk').models.length, 1);
  assert.throws(
    () => modelAnnotations([{ ...first, stories: [story, { ...story, contentHash: 'other' }] }]),
    /Conflicting/,
  );
  assert.throws(
    () => modelAnnotations([{ ...first, stories: [{ ...story, sourcePath: '../outside.json' }] }]),
    /Invalid article path/,
  );
});

test('removed/ambiguous associations retain inactive history and can be relinked', () => {
  const desired = modelAnnotations([structure()]).get(story.id);
  const linked = reconcileAnnotation(undefined, desired);
  const unlinked = reconcileAnnotation(linked, undefined);
  assert.equal(unlinked.models[0].state, 'unlinked');
  assert.equal(unlinked.models[0].lastKnownState, 'needs-review');
  assert.equal(unlinked.models[0].assetId, 'molen.tower');
  assert.deepEqual(reconcileAnnotation(unlinked, undefined), unlinked);
  assert.deepEqual(reconcileAnnotation(unlinked, desired), linked);
  assert.throws(() => reconcileAnnotation({ managedBy: 'someone-else' }, desired), /unrecognized/);
});

test('planning is idempotent and refuses missing, moved and duplicate curation entries', () => {
  const desired = modelAnnotations([structure()]);
  const changes = planAnnotations(desired, bundles());
  assert.equal(changes.length, 1);
  const annotated = { ...entry(), molen3d: changes[0].next };
  assert.equal(planAnnotations(desired, bundles(annotated)).length, 0);
  assert.equal(planAnnotations(new Map(), bundles(annotated))[0].next.models[0].state, 'unlinked');
  assert.throws(() => planAnnotations(desired, []), /Missing curation entry/);
  assert.throws(
    () => planAnnotations(desired, bundles({ ...entry(), geohash4: 'c23n' })),
    /location differs/,
  );
  assert.throws(() => planAnnotations(desired, [...bundles(), ...bundles()]), /Duplicate/);
});

test('article-scoped sync preserves unrelated links while retaining selected identity guards', () => {
  const desired = modelAnnotations([structure()]);
  const unrelated = {
    ...entry(),
    geohash4: 'moved',
    molen3d: reconcileAnnotation(undefined, desired.get(story.id)),
  };
  const all = [{ geohash4: 'c22y', entries: { [story.id]: entry(), unrelated } }];
  assert.throws(() => planAnnotations(desired, all), /location differs/);
  const scoped = annotationScope(desired, all, [story.id]);
  assert.deepEqual(
    planAnnotations(scoped.desired, scoped.bundles).map((v) => v.articleId),
    [story.id],
  );
  assert.equal(all[0].entries.unrelated, unrelated);
  assert.throws(() => annotationScope(desired, all, ['misspelled-story']), /Missing curation/);
  assert.throws(() => annotationScope(desired, all, ['']), /nonempty/);
  const moved = annotationScope(desired, bundles({ ...entry(), geohash4: 'moved' }), [story.id]);
  assert.throws(() => planAnnotations(moved.desired, moved.bundles), /location differs/);
  const duplicate = annotationScope(desired, [...bundles(), ...bundles()], [story.id]);
  assert.throws(() => planAnnotations(duplicate.desired, duplicate.bundles), /Duplicate/);
  const retired = annotationScope(new Map(), bundles({ ...entry(), molen3d: unrelated.molen3d }), [
    story.id,
  ]);
  assert.equal(
    planAnnotations(retired.desired, retired.bundles)[0].next.models[0].state,
    'unlinked',
  );
});

test('writing preserves fresh curation and fails closed for conflicting annotations or changed stories', async () => {
  const changes = planAnnotations(modelAnnotations([structure()]), bundles());
  let latest = { ...entry(), notes: 'Concurrent editor note', priority: 'high' };
  const manager = {
    mutateEntry: async (_tile, _id, fn) => {
      latest = await fn(latest);
    },
  };
  assert.equal(await applyAnnotations(changes, manager), 1);
  assert.equal(latest.notes, 'Concurrent editor note');
  assert.equal(latest.priority, 'high');
  assert.deepEqual(latest.finalReview, { completed: true });
  assert.equal(await applyAnnotations(changes, manager), 0);
  latest.molen3d.models[0].fidelity = 'newer-review';
  await assert.rejects(applyAnnotations(changes, manager), /annotation changed/);
  latest = entry();
  await assert.rejects(
    applyAnnotations(changes, manager, () => {
      throw new Error('Story changed');
    }),
    /Story changed/,
  );
  assert.equal(latest.molen3d, undefined);
});

const qualla = fileURLToPath(new URL('../../../../../qualla-internal/', import.meta.url));
test('Qualla CatalogManager integration writes atomically and leaves identical reruns untouched', {
  skip: !fs.existsSync(path.join(qualla, 'node_modules/tsx')),
}, async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-qualla-annotations-'));
  try {
    const file = path.join(temporary, 'c22y.json');
    fs.writeFileSync(file, JSON.stringify({ [story.id]: entry(), unrelated: entry() }));
    const changes = planAnnotations(modelAnnotations([structure()]), bundles());
    const manager = await loadQuallaManager(qualla, temporary);
    assert.equal(await applyAnnotations(changes, manager), 1);
    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(result.unrelated, entry());
    assert.equal(result[story.id].molen3d.models[0].assetId, 'molen.tower');
    const bytes = fs.readFileSync(file, 'utf8');
    const mtime = fs.statSync(file).mtimeMs;
    assert.equal(await applyAnnotations(changes, manager), 0);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    assert.equal(fs.statSync(file).mtimeMs, mtime);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
/** Remember existing external-device assets without taking ownership or renewing QA. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashBytes } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { loadCatalog } from './scan.mjs';
import { locateCompletedStory, verifyCompletedStory } from './sync-completed.mjs';
import { loadQuallaManager, modelAnnotations, reconcileAnnotation } from './sync-qualla.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p));
const hash = (p) => hashBytes(fs.readFileSync(p));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safe = (base, relative) => {
  assert(typeof relative === 'string' && !path.isAbsolute(relative));
  assert(!relative.split(/[\\/]/).includes('..'));
  return path.join(base, relative);
};
const bindings = [
  ['arena_da_amazonia', 'arena_amazonia', 'Q641527'],
  ['great_mosque_of_herat', 'friday_mosque_of_herat', 'Q1291612'],
];

/** Bounded catalog memory preserves all unselected associations and inactive history. */
function upsert(previous, desired) {
  assert.equal(desired.models.length, 1);
  const selected = desired.models[0];
  assert.equal(selected.readinessBasis, 'reported-by-molen-catalog');
  assert(['ready', 'needs-review'].includes(selected.state));
  const envelope = reconcileAnnotation(previous, desired);
  const old = previous?.models?.filter((m) => m.assetId === selected.assetId) ?? [];
  assert(old.length <= 1);
  if (old.length)
    for (const key of ['structureId', 'candidateId', 'sourcePath', 'storyContentHash'])
      assert.equal(old[0][key], selected[key], 'Existing model/story identity differs');
  return {
    ...previous,
    ...envelope,
    models: [
      ...(previous?.models ?? []).filter((m) => m.assetId !== selected.assetId),
      selected,
    ].sort((a, b) => a.assetId.localeCompare(b.assetId, 'en')),
  };
}

export async function linkReservedCatalogStories({ write = false, check = false } = {}) {
  assert(!(write && check));
  const batchFile = path.join(here, 'batches/qualla-002.json');
  const batch = read(batchFile);
  const catalog = loadCatalog(root);
  const project = read(path.join(root, 'content/worldgen/project.json'));
  const snapshot = new Map([[batchFile, hash(batchFile)]]);
  const remember = (p) => snapshot.set(p, hash(p));
  const unchanged = () => {
    for (const [p, expected] of snapshot) assert.equal(hash(p), expected, `Changed: ${p}`);
  };
  const qualla = path.resolve(root, '../qualla-internal');
  const bundles = fs
    .readdirSync(path.join(qualla, 'catalog'))
    .filter((n) => /^[0-9bcdefghjkmnpqrstuvwxyz]{4}\.json$/.test(n))
    .map((name) => ({ name, text: fs.readFileSync(path.join(qualla, 'catalog', name), 'utf8') }));
  const manager = write ? await loadQuallaManager(qualla) : null;
  const results = [];
  for (const [alias, candidateId, wikidataId] of bindings) {
    const entry = batch.entries.find((e) => e.modelIdentity === alias);
    assert.equal(entry?.workOwner, 'structure-catalog-other-device');
    assert.equal(entry.modelState, 'deferred-other-device');
    assert.equal(entry.otherDeviceReservation?.localAuthoringAllowed, false);
    assert.equal(entry.otherDeviceReservation?.candidateId, candidateId);
    assert.equal(entry.otherDeviceReservation?.wikidataId, wikidataId);
    const model = catalog.models.find((m) => m.candidateId === candidateId);
    assert(model?.registered && model.sourceModelReported);
    assert.equal(model.wikidataId, wikidataId);
    assert.equal(model.assetId, entry.otherDeviceReservation.modelRef);
    assert.equal(model.assetId, `molen.worldgen.structure.${candidateId}`);
    assert(['ready', 'incomplete', 'needs-review'].includes(model.readiness?.status));
    const dir = safe(root, model.sourcePath);
    const qa = read(path.join(dir, 'qa.json'));
    const spec = read(path.join(dir, 'spec.json'));
    assert.equal(spec.wikidataId, wikidataId);
    assert.equal(spec.assetId, model.assetId);
    const sidecarFile = safe(path.join(root, 'content/worldgen'), project.assets[model.assetId]);
    const sidecar = read(sidecarFile);
    assert.equal(sidecar.id, model.assetId);
    assert.equal(sidecar.sourceHash, qa.sourceHash);
    assert.equal(sidecar.hash, qa.runtimeHash);
    assert.equal(hash(path.join(dir, 'models/source.glb')), qa.sourceHash);
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isFile()) remember(p);
    }
    remember(path.join(dir, 'models/source.glb'));
    remember(sidecarFile);
    assert.equal(sidecar.runtimeLods.levels.length, 4);
    for (const [file, expected] of [
      [sidecar.files.main, sidecar.hash],
      ...sidecar.runtimeLods.levels.map((l) => [l.file, l.hash]),
    ]) {
      const p = safe(path.dirname(sidecarFile), file);
      remember(p);
      assert.equal(snapshot.get(p), expected);
    }
    const desired = modelAnnotations([
      {
        id: entry.structureId,
        name: entry.name,
        status: model.readiness.status === 'ready' ? 'existing-ready' : 'existing-model-review',
        stories: entry.stories,
        existing: [{ ...model, basis: 'editorial-identity' }],
      },
    ]);
    assert.equal(desired.size, entry.storyIds.length);
    let changed = 0,
      written = 0;
    for (const [id, d] of desired) {
      const { tile, entry: current } = locateCompletedStory(bundles, id, d.geohash4);
      const articleFile = safe(qualla, d.story.sourcePath);
      const articleHash = hash(articleFile);
      verifyCompletedStory(d.story, read(articleFile), current, tile);
      const next = upsert(current.molen3d, d);
      const needs = !same(next, current.molen3d);
      changed += Number(needs);
      if (check) assert(!needs, `Catalog association needs synchronization: ${id}`);
      if (write && needs) {
        await manager.mutateEntry(tile, id, async (fresh) => {
          verifyCompletedStory(d.story, read(articleFile), fresh, tile);
          assert(same(fresh.molen3d, current.molen3d), 'Concurrent annotation changed');
          unchanged();
          return { ...fresh, molen3d: upsert(fresh.molen3d, d) };
        });
        written++;
      }
      const after = read(path.join(qualla, 'catalog', `${tile}.json`))[id];
      const curation = ({ molen3d, updatedAt, ...rest }) => rest;
      assert.equal(hash(articleFile), articleHash);
      assert.deepEqual(curation(after), curation(current));
      if (write || check) assert(same(upsert(after.molen3d, d), after.molen3d));
    }
    results.push({
      alias,
      candidateId,
      assetId: model.assetId,
      sourcePath: model.sourcePath,
      sourceHash: qa.sourceHash,
      runtimeHash: qa.runtimeHash,
      originalReviewDate: qa.reviewedOn,
      catalogReadiness: model.readiness,
      annotationState: [...desired.values()][0].models[0].state,
      workOwner: entry.workOwner,
      ownershipTransferred: false,
      localCompletionCreditAdded: false,
      currentReadinessRenewed: false,
      newImageryUsed: false,
      newModelBuilt: false,
      newRenders: false,
      sourceQaAndRuntimeUnchanged: true,
      storyContentAndOtherCurationUnchanged: true,
      linkedStories: desired.size,
      changedArticles: changed,
      writtenArticles: written,
      repeatChanges: 0,
    });
  }
  unchanged();
  return { mode: write ? 'write' : check ? 'check' : 'plan', results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert(args.every((a) => ['--write', '--check'].includes(a)));
  console.log(
    JSON.stringify(
      await linkReservedCatalogStories({
        write: args.includes('--write'),
        check: args.includes('--check'),
      }),
      null,
      2,
    ),
  );
}

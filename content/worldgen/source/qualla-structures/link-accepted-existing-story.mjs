#!/usr/bin/env node
/** Remember a story's already accepted physical model without renewing its QA.
 * This adds a needs-review association; only the normal completion path can
 * certify current readiness. Model sources, QA and runtime assets stay untouched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashBytes } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { loadCatalog } from './scan.mjs';
import { locateCompletedStory, verifyCompletedStory } from './sync-completed.mjs';
import { loadQuallaManager, modelAnnotations, reconcileAnnotation } from './sync-qualla.mjs';
import { structureCatalogMatches } from './work-ownership.mjs';

/** Preserve unrelated links and never silently promote an old review to current readiness. */
export function upsertAcceptedModel(previous, desired) {
  assert.equal(desired.models.length, 1);
  assert.equal(desired.models[0].state, 'needs-review');
  const envelope = reconcileAnnotation(previous, desired);
  const selected = desired.models[0];
  const old = previous?.models?.filter((m) => m.assetId === selected.assetId) ?? [];
  assert(old.length <= 1, 'Duplicate existing model association');
  if (old.length) {
    for (const key of ['structureId', 'candidateId', 'sourcePath', 'storyContentHash'])
      assert.equal(old[0][key], selected[key], 'Existing model/story identity differs');
    // A newer ready association must not be downgraded by replaying this old-review path.
    if (old[0].state === 'ready') return previous;
  }
  return {
    ...previous,
    ...envelope,
    models: [
      ...(previous?.models ?? []).filter((m) => m.assetId !== selected.assetId),
      selected,
    ].sort((a, b) => a.assetId.localeCompare(b.assetId, 'en')),
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p));
const hashFile = (p) => hashBytes(fs.readFileSync(p));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safe = (base, relative) => {
  assert(typeof relative === 'string' && !path.isAbsolute(relative));
  assert(!relative.split(/[\\/]/).includes('..'));
  return path.join(base, relative);
};

/** Derivative differences remain visible; they are not a new source-model acceptance. */
export function acceptedLodReviewDifferences(sidecar, qa) {
  return sidecar.runtimeLods.levels.flatMap((level) => {
    const reviewed = qa.runtimeLodReview.levels.find((l) => l.name === level.name);
    return level.hash === reviewed?.hash
      ? []
      : [{ name: level.name, currentHash: level.hash, savedReviewHash: reviewed?.hash ?? null }];
  });
}

export async function linkAcceptedExistingStory({
  alias,
  batchName = 'qualla-002',
  write = false,
  check = false,
} = {}) {
  assert(/^[a-z][a-z0-9_]*$/.test(alias ?? '') && /^qualla-\d{3}$/.test(batchName));
  assert(!(write && check));
  const batchFile = path.join(here, 'batches', `${batchName}.json`);
  const batch = read(batchFile);
  const entry = batch.entries.find((e) => e.modelIdentity === alias);
  const reuse = entry?.existingModelReuse;
  assert(entry?.workOwner === batch.id && reuse?.decision === 'accepted-existing-physical-model');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(reuse.decidedOn));
  assert(reuse.identityBasis?.length >= 2 && reuse.storyIdentityTerms?.length >= 2);
  assert.equal(reuse.physicalModelIdentity, entry.physicalModelIdentity);
  assert.equal(reuse.physicalStructureId, entry.physicalStructureId);
  assert(/^Q\d+$/.test(reuse.wikidata) && /^\d+$/.test(String(reuse.nativeWay)));
  const catalog = loadCatalog(root);
  const structures = fs
    .readFileSync(path.join(here, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const target = structures.find((s) => s.id === entry.structureId);
  const physical = structures.find((s) => s.id === entry.physicalStructureId);
  assert(target && physical);
  for (const [s, key] of [
    [target, alias],
    [physical, entry.physicalModelIdentity],
  ])
    assert.equal(structureCatalogMatches(s, catalog.structureCatalog, key).length, 0);
  for (const reserved of catalog.structureCatalog) {
    const text = JSON.stringify(reserved);
    assert(
      !text.includes(reuse.wikidata) && !text.includes(String(reuse.nativeWay)),
      'Physical identity reserved for other device',
    );
  }
  const model = catalog.models.find((m) => m.assetId === reuse.assetId);
  assert(model?.registered && model.sourceModelReported);
  assert.equal(model.candidateId, entry.physicalModelIdentity);
  assert.equal(model.sourcePath, reuse.sourcePath);
  assert(
    model.placements?.some(
      (p) => p.id === reuse.placementId && ['active', 'preview'].includes(p.status),
    ),
  );
  const dir = safe(root, reuse.sourcePath);
  const spec = read(path.join(dir, 'spec.json'));
  const qa = read(path.join(dir, 'qa.json'));
  assert.equal(spec.assetId, model.assetId);
  assert.equal(qa.status, 'completed');
  assert.equal(qa.validation.completed, true);
  assert.equal(qa.fidelityReview.status, 'passed');
  assert.equal(qa.imageryReview.status, 'passed');
  assert.equal(qa.imageryReview.inventoryStatus, 'passed');
  assert.equal(qa.sourceHash, reuse.acceptedSourceHash);
  assert.equal(qa.runtimeHash, reuse.acceptedRuntimeHash);
  const project = read(path.join(root, 'content/worldgen/project.json'));
  const sidecarFile = safe(path.join(root, 'content/worldgen'), project.assets[model.assetId]);
  const sidecar = read(sidecarFile);
  assert.equal(sidecar.hash, qa.runtimeHash);
  assert.equal(sidecar.sourceHash, qa.sourceHash);
  assert.equal(sidecar.runtimeLods.levels.length, 4);
  const lodReviewDifferences = acceptedLodReviewDifferences(sidecar, qa);
  const sourceFiles = [
    'qa.json',
    'source.json',
    'spec.json',
    'map-frame.json',
    'reference-images.json',
    'imagery-evidence.json',
    'models/source.glb',
  ];
  const snapshot = Object.fromEntries(
    sourceFiles.map((p) => [path.join(dir, p), hashFile(path.join(dir, p))]),
  );
  snapshot[sidecarFile] = hashFile(sidecarFile);
  for (const [file, expected] of [
    [sidecar.files.main, sidecar.hash],
    ...sidecar.runtimeLods.levels.map((l) => [l.file, l.hash]),
  ]) {
    const p = safe(path.dirname(sidecarFile), file);
    snapshot[p] = hashFile(p);
    assert.equal(snapshot[p], expected);
  }
  assert.equal(hashFile(path.join(dir, 'models/source.glb')), qa.sourceHash);
  const unchanged = () => {
    for (const [p, hash] of Object.entries(snapshot))
      assert.equal(hashFile(p), hash, 'Accepted physical model changed');
  };
  const desired = modelAnnotations([
    {
      id: physical.id,
      name: physical.name,
      status: 'existing-model-review',
      stories: entry.stories,
      existing: [
        {
          ...model,
          basis: 'editorial-identity',
          readiness: {
            status: 'needs-review',
            blockers: ['accepted-model-reused-without-renewing-current-readiness'],
            activePlacement: reuse.placementId,
            fidelity: 'medium-fi',
          },
        },
      ],
    },
  ]);
  const qualla = path.resolve(root, '../qualla-internal');
  const bundles = fs
    .readdirSync(path.join(qualla, 'catalog'))
    .filter((n) => /^[0-9bcdefghjkmnpqrstuvwxyz]{4}\.json$/.test(n))
    .map((name) => ({ name, text: fs.readFileSync(path.join(qualla, 'catalog', name), 'utf8') }));
  const manager = write ? await loadQuallaManager(qualla) : null;
  let changed = 0,
    written = 0;
  for (const [id, d] of desired) {
    const { tile, entry: current } = locateCompletedStory(bundles, id, d.geohash4);
    const articleFile = safe(qualla, d.story.sourcePath);
    const article = read(articleFile),
      articleHash = hashFile(articleFile);
    verifyCompletedStory(d.story, article, current, tile);
    for (const term of reuse.storyIdentityTerms)
      assert(JSON.stringify(article).toLowerCase().includes(term.toLowerCase()));
    const next = upsertAcceptedModel(current.molen3d, d);
    const needs = !same(next, current.molen3d);
    changed += Number(needs);
    if (check) assert(!needs, 'Existing-model association needs synchronization');
    if (write && needs) {
      await manager.mutateEntry(tile, id, async (fresh) => {
        verifyCompletedStory(d.story, read(articleFile), fresh, tile);
        assert(same(fresh.molen3d, current.molen3d), 'Concurrent annotation changed');
        unchanged();
        return { ...fresh, molen3d: upsertAcceptedModel(fresh.molen3d, d) };
      });
      written++;
    }
    const after = read(path.join(qualla, 'catalog', `${tile}.json`))[id];
    const curation = ({ molen3d, updatedAt, ...rest }) => rest;
    assert.equal(hashFile(articleFile), articleHash);
    assert.deepEqual(curation(after), curation(current));
    if (write || check) assert(same(upsertAcceptedModel(after.molen3d, d), after.molen3d));
  }
  unchanged();
  assert.equal(desired.size, entry.storyIds.length);
  const proof = {
    alias,
    physicalModelIdentity: entry.physicalModelIdentity,
    assetId: model.assetId,
    sourcePath: model.sourcePath,
    sourceHash: qa.sourceHash,
    runtimeHash: qa.runtimeHash,
    acceptedReviewDate: qa.reviewedOn,
    acceptancePreserved: true,
    currentReadinessRenewed: false,
    annotationState: 'needs-review',
    sourceAndQaUnchanged: true,
    runtimeAndFourLodsUnchanged: true,
    unchangedScope: 'Compared before/after this story-link transaction; no runtime files modified.',
    sourceAndMasterMatchSavedAcceptance: true,
    runtimeLodsMatchSavedAcceptance: lodReviewDifferences.length === 0,
    runtimeLodReviewDifferences: lodReviewDifferences,
    newModelBuilt: false,
    newRenders: false,
    linkedStories: desired.size,
    changedArticles: changed,
    writtenArticles: written,
    repeatChanges: 0,
    mode: write ? 'write' : check ? 'check' : 'plan',
  };
  if (write) {
    entry.sourcePath = model.sourcePath;
    entry.modelState = 'completed';
    entry.completedOn = reuse.decidedOn;
    entry.storyState = 'linked-and-repeat-verified-existing-acceptance';
    entry.referenceState = 'reused-accepted-physical-model';
    entry.reviewNotes = `${entry.name} reuses the already accepted ${physical.name} exterior. Existing accepted geometry/source/runtime/fourLOD bytes preserved. Story association added without reopening or renewing QA; annotation explicitly needs-review under current readiness. No duplicate model, new render or new strict-ready credit.`;
    entry.storySyncCommand = [
      'node',
      'content/worldgen/source/qualla-structures/link-accepted-existing-story.mjs',
      `--batch=${batch.id}`,
      `--alias=${alias}`,
      '--check',
    ];
    reuse.status = 'accepted-existing-model-story-linked';
    fs.writeFileSync(
      safe(path.join(here, 'batches'), reuse.proof),
      `${JSON.stringify(proof, null, 2)}\n`,
    );
    fs.writeFileSync(batchFile, `${JSON.stringify(batch, null, 2)}\n`);
  }
  return proof;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--alias=')) options.alias = arg.slice(8);
    else if (arg.startsWith('--batch=')) options.batchName = arg.slice(8);
    else if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else throw Error(`Unknown option: ${arg}`);
  }
  console.log(JSON.stringify(await linkAcceptedExistingStory(options), null, 2));
}

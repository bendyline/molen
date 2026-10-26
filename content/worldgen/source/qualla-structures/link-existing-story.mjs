#!/usr/bin/env node
/** Link an explicitly identified story alias to a currently ready physical model.
 * Source provenance describes the model's original references; story associations
 * live separately. Reusing a model must not edit its accepted source or QA.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashBytes,
  modelInputHash,
} from '../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { readPlacementSources } from '../../../../packages/worldgen-earth/scripts/placement-sources.mjs';
import { inspectLocalModel } from './progress.mjs';
import { loadCatalog } from './scan.mjs';
import { upsertCompletedModels, verifyCompletedStory } from './sync-completed.mjs';
import { loadQuallaManager, modelAnnotations } from './sync-qualla.mjs';
import { structureCatalogMatches } from './work-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, '../../../..'),
  read = (p) => JSON.parse(fs.readFileSync(p)),
  arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3),
  batchName = arg('batch') ?? 'qualla-002',
  alias = arg('alias'),
  write = process.argv.includes('--write'),
  check = process.argv.includes('--check');
assert(
  /^qualla-\d{3}$/.test(batchName) && /^[a-z][a-z0-9_]*$/.test(alias ?? ''),
  'Explicit --alias and valid --batch required',
);
assert(!(write && check), 'Choose --write or --check');
const batchPath = path.join(here, 'batches', `${batchName}.json`),
  batch = read(batchPath),
  entry = batch.entries.find((e) => e.modelIdentity === alias),
  decision = entry?.reuseDecision,
  canonical = batch.entries.find((e) => e.modelIdentity === entry?.physicalModelIdentity),
  qualla = path.resolve(root, '../qualla-internal');
assert(
  entry && canonical && entry !== canonical && decision?.kind === 'same-physical-structure',
  'A saved explicit same-physical-structure decision is required',
);
assert(/^\d{4}-\d{2}-\d{2}$/.test(decision.decidedOn), 'Saved decision date required');
assert.equal(entry.physicalStructureId, canonical.structureId);
assert.equal(canonical.modelState, 'completed');
assert.equal(canonical.workOwner, batch.id);
assert.equal(entry.workOwner, batch.id);
assert.equal(entry.sourcePath, canonical.sourcePath);
const structures = fs
    .readFileSync(path.join(here, 'structures.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse),
  target = structures.find((s) => s.id === entry.structureId),
  physical = structures.find((s) => s.id === canonical.structureId);
assert(target && physical);
assert.deepEqual(
  target.coordinate,
  physical.coordinate,
  'Alias and physical story points must agree',
);
const dir = path.join(root, canonical.sourcePath),
  frame = read(path.join(dir, 'map-frame.json')),
  feature = frame.features.find((f) => f.id === decision.featureId);
assert(feature, 'Declared native feature is missing');
assert.equal((feature.tags ?? feature.properties)?.wikidata, decision.wikidataId);
assert(/^Q\d+$/.test(decision.wikidataId));
const scale = (6378137 * Math.PI) / 180,
  dx =
    (target.coordinate[0] - frame.anchor[0]) * scale * Math.cos((frame.anchor[1] * Math.PI) / 180),
  dz = -(target.coordinate[1] - frame.anchor[1]) * scale,
  q = [
    Math.cos(frame.heading) * dx - Math.sin(frame.heading) * dz,
    Math.sin(frame.heading) * dx + Math.cos(frame.heading) * dz,
  ],
  ring = feature.outline;
let inside = false;
for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
  const a = ring[i],
    b = ring[j];
  if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0])
    inside = !inside;
}
assert(inside, 'Alias point must lie inside the declared physical structure');
const spec = read(path.join(dir, 'spec.json')),
  qaBefore = hashBytes(fs.readFileSync(path.join(dir, 'qa.json'))),
  manifestBefore = hashBytes(fs.readFileSync(path.join(dir, 'source.json'))),
  catalog = loadCatalog(root),
  placements = (await readPlacementSources(path.join(root, 'content/earth/source/placements')))
    .catalog;
for (const [s, key] of [
  [target, entry.modelIdentity],
  [physical, canonical.modelIdentity],
])
  assert.equal(
    structureCatalogMatches(s, catalog.structureCatalog, key).length,
    0,
    'Other-device reservations cannot be reused locally',
  );
assert(
  !catalog.structureCatalog.some(
    (s) =>
      JSON.stringify(s).includes(decision.wikidataId) ||
      JSON.stringify(s).includes(decision.featureId.split('/')[1]),
  ),
  'Actual physical identity is reserved',
);
const canonicalReferences = read(path.join(here, 'references', `${canonical.structureId}.json`)),
  row = await inspectLocalModel(canonical, {
    repository: root,
    project: read(path.join(root, 'content/worldgen/project.json')),
    stylepack: read(path.join(root, 'content/worldgen/stylepack.json')),
    placements,
    currentReferences: canonicalReferences,
    imageryPolicy: batch.policy.imagery,
    qualla,
  });
assert.equal(row.readiness, 'ready', JSON.stringify(row.blockers));
assert.equal(spec.assetId, `molen.worldgen.structure.${canonical.modelIdentity}`);
const matches = catalog.models.filter(
  (m) =>
    m.assetId === spec.assetId &&
    m.sourcePath === canonical.sourcePath &&
    m.candidateId === canonical.modelIdentity &&
    m.registered &&
    m.sourceModelReported,
);
assert.equal(matches.length, 1);
const project = read(path.join(root, 'content/worldgen/project.json')),
  sidecarPath = path.join(root, 'content/worldgen', project.assets[spec.assetId]),
  sidecar = read(sidecarPath),
  runtimeFiles = [
    sidecarPath,
    ...[sidecar.files.main, ...sidecar.runtimeLods.levels.map((l) => l.file)].map((file) =>
      path.join(path.dirname(sidecarPath), file),
    ),
  ],
  runtimeSnapshot = Object.fromEntries(
    runtimeFiles.map((file) => [file, hashBytes(fs.readFileSync(file))]),
  ),
  verifyRuntimeUnchanged = () => {
    for (const [file, hash] of Object.entries(runtimeSnapshot))
      assert.equal(hashBytes(fs.readFileSync(file)), hash, 'Accepted runtime changed');
  };
assert.equal(
  runtimeSnapshot[path.join(path.dirname(sidecarPath), sidecar.files.main)],
  sidecar.hash,
);
for (const level of sidecar.runtimeLods.levels)
  assert.equal(runtimeSnapshot[path.join(path.dirname(sidecarPath), level.file)], level.hash);
const model = {
    ...matches[0],
    basis: 'editorial-identity',
    readiness: {
      status: 'ready',
      blockers: [],
      activePlacement: row.geographic.activePlacement,
      fidelity: 'medium-fi',
    },
  },
  desired = modelAnnotations([
    {
      id: physical.id,
      name: physical.name,
      status: 'existing-ready',
      stories: entry.stories,
      existing: [model],
    },
  ]),
  manager = write ? await loadQuallaManager(qualla) : null;
const sourceFiles = Object.fromEntries(
  [
    'models/source.glb',
    'qa.json',
    'source.json',
    'spec.json',
    'map-frame.json',
    'reference-images.json',
    'imagery-evidence.json',
    'terrain-grid.json',
    'terrain-review.height.png',
  ].map((n) => [n, hashBytes(fs.readFileSync(path.join(dir, n)))]),
);
let changed = 0,
  written = 0;
for (const [id, d] of desired) {
  const catalogFile = path.join(qualla, 'catalog', `${d.geohash4}.json`),
    current = read(catalogFile)[id],
    articlePath = path.join(qualla, d.story.sourcePath),
    articleBefore = hashBytes(fs.readFileSync(articlePath)),
    curation = ({ molen3d, updatedAt, ...rest }) => rest;
  verifyCompletedStory(d.story, read(articlePath), current, d.geohash4);
  assert(decision.storyIdentityTerms?.length >= 2);
  const text = JSON.stringify(read(articlePath)).toLowerCase();
  for (const term of decision.storyIdentityTerms)
    assert(text.includes(term.toLowerCase()), 'Declared physical identity absent from alias story');
  const next = upsertCompletedModels(current.molen3d, d),
    needs = JSON.stringify(next) !== JSON.stringify(current.molen3d);
  if (needs) changed++;
  if (check) assert(!needs, 'Existing-model story annotation needs synchronization');
  if (write && needs) {
    await manager.mutateEntry(d.geohash4, id, async (fresh) => {
      verifyCompletedStory(d.story, read(articlePath), fresh, d.geohash4);
      assert.deepEqual(fresh.molen3d, current.molen3d, 'Concurrent annotation changed');
      assert.equal(await modelInputHash(dir, spec.assetId), row.inputHash);
      assert.equal(hashBytes(fs.readFileSync(path.join(dir, 'qa.json'))), qaBefore);
      verifyRuntimeUnchanged();
      return { ...fresh, molen3d: upsertCompletedModels(fresh.molen3d, d) };
    });
    written++;
  }
  const after = read(catalogFile)[id];
  assert.equal(hashBytes(fs.readFileSync(articlePath)), articleBefore, 'Article bytes changed');
  assert.deepEqual(curation(after), curation(current), 'Unrelated curation changed');
  if (write || check)
    assert.deepEqual(
      upsertCompletedModels(after.molen3d, d),
      after.molen3d,
      'Repeat would change annotation',
    );
}
assert.equal(desired.size, entry.storyIds.length);
assert.equal(await modelInputHash(dir, spec.assetId), row.inputHash);
assert.equal(hashBytes(fs.readFileSync(path.join(dir, 'qa.json'))), qaBefore);
assert.equal(hashBytes(fs.readFileSync(path.join(dir, 'source.json'))), manifestBefore);
verifyRuntimeUnchanged();
for (const [n, h] of Object.entries(sourceFiles))
  assert.equal(
    hashBytes(fs.readFileSync(path.join(dir, n))),
    h,
    'Accepted physical model input changed',
  );
const proof = {
  alias,
  physicalModelIdentity: canonical.modelIdentity,
  physicalStructureId: canonical.structureId,
  assetId: spec.assetId,
  sourcePath: canonical.sourcePath,
  nativeFeature: decision.featureId,
  wikidata: decision.wikidataId,
  inputHash: row.inputHash,
  sourceHash: read(path.join(dir, 'qa.json')).sourceHash,
  runtimeHash: read(path.join(dir, 'qa.json')).runtimeHash,
  sourceFiles,
  acceptedPhysicalModelUnchanged: true,
  acceptedRuntimeAndFourLodsUnchanged: true,
  newModelBuilt: false,
  newRenders: false,
  linkedStories: desired.size,
  changedArticles: changed,
  writtenArticles: written,
  repeatChanges: 0,
  mode: write ? 'write' : check ? 'check' : 'plan',
};
if (write) {
  entry.modelState = 'completed';
  entry.completedOn = decision.decidedOn;
  assert(/^\d{4}-\d{2}-\d{2}$/.test(entry.completedOn));
  entry.storyState = 'linked-and-repeat-verified';
  entry.referenceState = 'reused-ready-physical-model';
  entry.storySyncCommand = [
    'node',
    'content/worldgen/source/qualla-structures/link-existing-story.mjs',
    `--batch=${batch.id}`,
    `--alias=${alias}`,
    '--check',
  ];
  entry.placementState = canonical.placementState;
  entry.scope = canonical.scope;
  entry.era = canonical.era;
  entry.reviewNotes = `Same physical structure as the existing ready ${canonical.name} model. Reused its current source/runtime/accepted render evidence without editing source/QA, rebuilding, rerendering or counting a new physical model. Additional story annotation added; zero-change repeat verified.`;
  entry.reuseDecision = {
    ...decision,
    status: 'ready-existing-model-linked',
    proof: `research/${alias.replaceAll('_', '-')}-reuse.json`,
  };
  fs.writeFileSync(
    path.join(here, 'references', `${entry.structureId}.json`),
    `${JSON.stringify(
      {
        ...canonicalReferences,
        referenceReuse: {
          targetStructureId: entry.structureId,
          targetStories: entry.stories,
          physicalModelIdentity: canonical.modelIdentity,
          physicalStructureId: canonical.structureId,
          sourceManifestPath: `${canonical.sourcePath}/reference-images.json`,
          sourceInputHash: row.inputHash,
        },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(here, 'batches', entry.reuseDecision.proof),
    `${JSON.stringify(proof, null, 2)}\n`,
  );
  fs.writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
}
console.log(JSON.stringify(proof, null, 2));

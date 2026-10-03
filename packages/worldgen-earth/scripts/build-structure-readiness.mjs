/** Offline evidence ledger. File existence is never treated as a completed visual review. */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';
import { reviewedGlbEncoding } from '../../worldgen/scripts/reviewed-glb-encoding.mjs';
import { validateStructureCollections } from '../../worldgen/scripts/structure-collections.mjs';
import { writeIndex } from '../../worldgen/scripts/structure-model-files.mjs';
import {
  knownSourceEntries,
  structureSourceDirectory,
} from '../../worldgen/scripts/structure-source-paths.mjs';
import { collectionReadiness } from './collection-readiness.mjs';
import {
  hasHistoricalPlacementCapture,
  hasUsableStructurePlacement,
  historicalIdentityResolved,
} from './historical-placement.mjs';
import { readinessSourceIdentity } from './readiness-source-identity.mjs';
import { reviewedSourceMapFrame } from './reviewed-source-map-frame.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const catalog = await readJson('content/worldgen/source/next-1000/candidates.json');
const details = await readJson('content/earth/structures/evidence/wikidata-details.json');
const geographic = await readJson('content/earth/structures/georeferencing.json');
const identityReview = await readJson('content/earth/structures/identity-review.json');
const placements = await readJson('content/earth/structures/placements.json');
const project = await readJson('content/worldgen/project.json');
const geoById = new Map(geographic.candidates.map((entry) => [entry.candidateId, entry]));
const reviewedById = new Map(identityReview.reviews.map((entry) => [entry.candidateId, entry]));
const sourceEntries = knownSourceEntries();
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const bytes = async (path) =>
  readFile(resolve(root, path)).catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
const plainPath = (path) => path.replaceAll('\\', '/');
async function imageFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true }).catch(
    (error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const paths = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory() && entry.name === 'shots') paths.push(...(await imageFiles(path)));
    else if (entry.isDirectory() && directory.includes('/shots'))
      paths.push(...(await imageFiles(path)));
    else if (entry.isFile() && /\.(png|webp|jpg)$/i.test(entry.name)) paths.push(path);
  }
  return paths;
}
const collectionPath = 'content/worldgen/source/next-1000/collections.json';
const collectionBytes = await bytes(collectionPath);
const collections = validateStructureCollections(JSON.parse(collectionBytes), catalog.candidates);
async function modelReadiness(candidate, geo) {
  if (geo?.wikidataId !== candidate.wikidataId)
    throw new Error(`${candidate.id}: stale geographic identity; regenerate georeferencing`);
  const sourceIdentity = readinessSourceIdentity(candidate, geo, sourceEntries);
  const { asset, key } = sourceIdentity;
  const sourceDirectory =
    sourceIdentity.sourcePath ?? plainPath(relative(root, structureSourceDirectory(key)));
  const registeredSidecar = project.assets?.[asset];
  const sidecarPath = registeredSidecar ? `content/worldgen/${registeredSidecar}` : undefined;
  const sidecarBytes = sidecarPath ? await bytes(sidecarPath) : undefined;
  const sidecar = sidecarBytes ? JSON.parse(sidecarBytes) : undefined;
  const runtimePath =
    sidecarPath && sidecar?.files?.main
      ? plainPath(relative(root, resolve(root, dirname(sidecarPath), sidecar.files.main)))
      : null;
  const sourcePath = `${sourceDirectory}/models/source.glb`;
  const [source, runtime, sourceManifestBytes, reviewBytes, specBytes, captureBytes] =
    await Promise.all([
      bytes(sourcePath),
      runtimePath ? bytes(runtimePath) : undefined,
      bytes(`${sourceDirectory}/source.json`),
      bytes(`${sourceDirectory}/qa.json`),
      bytes(`${sourceDirectory}/spec.json`),
      bytes(`${sourceDirectory}/capture-report.json`),
    ]);
  const sourceManifest = sourceManifestBytes ? JSON.parse(sourceManifestBytes) : undefined;
  const qa = reviewBytes ? JSON.parse(reviewBytes) : undefined;
  const spec = specBytes ? JSON.parse(specBytes) : undefined;
  const capture = captureBytes ? JSON.parse(captureBytes) : undefined;
  const sourceHash = source ? hash(source) : undefined,
    runtimeHash = runtime ? hash(runtime) : undefined;
  const sourceDeclared = sourceManifest?.files?.models?.find(
    (model) => model.assetId === asset,
  )?.sha256;
  const sourceMatches = Boolean(
    sourceHash && sourceDeclared === sourceHash && sidecar?.sourceHash === sourceHash,
  );
  const runtimeMatches = Boolean(
    runtimeHash && sidecar?.hash === runtimeHash && sidecar?.id === asset,
  );
  const images = await imageFiles(sourceDirectory);
  const placement = placements.entries.find((entry) => entry.asset === asset);
  const placementHash = placement ? hash(JSON.stringify(placement)) : null;
  const encoding = reviewedGlbEncoding(source, sourceHash);
  const reviewMatches = Boolean(
    sourceHash &&
      runtimeHash &&
      qa &&
      encoding.matchesSource(qa.sourceHash) &&
      qa.runtimeHash === runtimeHash,
  );
  // A model hash alone does not bind a review to the actual renders the reviewer saw.
  // Keep the report and every reviewed frame in the evidence chain as well.
  const reviewedFrames = qa?.visualReview?.inspectedFrames ?? [];
  let capturesMatch = Boolean(
    captureBytes &&
      matchesEvidenceText(captureBytes, qa?.captureReportHash) &&
      encoding.matchesSource(capture?.sourceHash) &&
      capture?.runtimeHash === runtimeHash &&
      reviewedFrames.length > 0,
  );
  for (const path of reviewedFrames) {
    const frame = capture?.frames?.find((entry) => entry.path === path);
    const image = frame ? await bytes(`${sourceDirectory}/${path}`) : undefined;
    if (!image || hash(image) !== frame.hash) capturesMatch = false;
  }
  const sharedCaptureBytes = await bytes(`${sourceDirectory}/shared-capture-report.json`);
  const sharedCapture = sharedCaptureBytes ? JSON.parse(sharedCaptureBytes) : undefined;
  const sharedFrames = qa?.sharedSurfaceReview?.inspectedFrames ?? [];
  const needsSharedReview = (spec?.sharedSurfaces?.length ?? 0) > 0;
  let sharedMatches = Boolean(
    sharedCaptureBytes &&
      matchesEvidenceText(sharedCaptureBytes, qa?.sharedSurfaceReview?.captureReportHash) &&
      encoding.matchesSource(sharedCapture?.sourceHash) &&
      sharedCapture?.runtimeHash === runtimeHash &&
      specBytes &&
      encoding.matchesSpec(specBytes, sharedCapture?.specHash) &&
      sharedFrames.length > 0,
  );
  for (const path of sharedFrames) {
    const frame = sharedCapture?.frames?.find((entry) => entry.path === path);
    const image = frame ? await bytes(`${sourceDirectory}/${path}`) : undefined;
    if (!image || hash(image) !== frame.hash) sharedMatches = false;
  }
  for (const graph of Object.values(sharedCapture?.materialGraphs ?? {})) {
    const data = await bytes(`content/worldgen/${graph.path}`);
    if (!matchesEvidenceText(data, graph.hash)) sharedMatches = false;
  }
  const sharedReviewed =
    reviewMatches && sharedMatches && qa.sharedSurfaceReview?.status === 'passed';
  const visualReviewed = reviewMatches && capturesMatch && qa.visualReview?.status === 'passed';
  const geographicReviewed =
    reviewMatches &&
    hasHistoricalPlacementCapture(placement, sharedCapture, placementHash) &&
    Boolean(placementHash) &&
    qa.geographicReview?.status === 'passed' &&
    qa.geographicReview?.placementHash === placementHash;
  const fidelityReviewed =
    reviewMatches &&
    qa.fidelityReview?.target === 'maximum' &&
    qa.fidelityReview?.status === 'passed' &&
    typeof qa.fidelityReview?.notes === 'string' &&
    qa.fidelityReview.notes.trim().length > 0;
  const localFrame = reviewedSourceMapFrame({
    frameBytes:
      spec?.geographicProposal?.mapGeometrySource === 'map-frame.json'
        ? await bytes(`${sourceDirectory}/map-frame.json`)
        : undefined,
    sourceManifest,
    spec,
    placement,
    geographicReviewed,
  });
  const recommendation = reviewedById.get(candidate.id);
  const rejected =
    recommendation?.original.wikidataId === candidate.wikidataId ? recommendation : undefined;
  const blockers = [];
  if (rejected && !historicalIdentityResolved(rejected, placement, geographicReviewed))
    blockers.push(`identity:${rejected.reasonCode}`);
  if (!source) blockers.push('source-model-missing');
  if (!runtime || !sidecar) blockers.push('runtime-import-missing');
  if (source && runtime && !sourceMatches) blockers.push('source-hash-unverified');
  if (runtime && !runtimeMatches) blockers.push('runtime-hash-unverified');
  if (!visualReviewed) blockers.push('visual-review-missing-or-unbound');
  if (needsSharedReview && !sharedReviewed)
    blockers.push('shared-surface-review-missing-or-unbound');
  if (!fidelityReviewed) blockers.push('maximum-fidelity-review-missing-or-unbound');
  if (geo.orientationStatus === 'unresolved' && !localFrame)
    blockers.push('orientation-unresolved');
  if (!geographicReviewed) blockers.push('geographic-review-missing-or-unbound');
  if (!hasUsableStructurePlacement(placement)) blockers.push('runtime-placement-inactive');
  const assetRegistered = typeof project.assets?.[asset] === 'string';
  if (source && !assetRegistered) blockers.push('asset-registry-missing');
  return {
    candidateId: candidate.id,
    wikidataId: candidate.wikidataId,
    title: candidate.title,
    asset,
    readiness: blockers.length ? 'incomplete' : 'ready',
    blockers,
    sourceFacts: {
      available: Boolean(details.entities[candidate.wikidataId]),
      path: 'evidence/wikidata-details.json',
      heights: geo.facts.height.length,
      widths: geo.facts.width.length,
      lengths: geo.facts.length.length,
    },
    model: {
      quality: spec?.quality ?? null,
      source: {
        present: Boolean(source),
        path: sourcePath,
        hash: sourceHash ?? null,
        matchesManifestAndImport: sourceMatches,
        ...(reviewMatches && qa.sourceHash !== sourceHash
          ? { reviewedEncoding: { repair: 'rgb-u8-four-byte-stride', sourceHash: qa.sourceHash } }
          : {}),
      },
      runtime: {
        present: Boolean(runtime && sidecar),
        path: runtimePath,
        hash: runtimeHash ?? null,
        matchesSidecar: runtimeMatches,
        triangles: sidecar?.stats?.triangles ?? null,
      },
      assetRegistered,
    },
    geographic: {
      disposition: geo.disposition,
      orientationEvidence: localFrame ? 'reviewed-source-frame' : geo.orientationStatus,
      anchor: placement?.anchor ?? geo.anchor ?? geo.referenceAnchor,
      heading: placement?.heading ?? geo.heading ?? null,
      mappedFeatureIds: localFrame
        ? (localFrame.elements ?? []).map((p) => `${p.type}/${p.id}`)
        : (geo.featureIds ?? []),
      ...(localFrame
        ? {
            sourceFrame: {
              path: `${sourceDirectory}/map-frame.json`,
              hash: spec.geographicProposal.mapGeometryHash,
              sourceUrl: localFrame.sourceUrl,
            },
          }
        : {}),
      verified: geographicReviewed,
      activePlacement: placement?.status === 'preview' ? placement.id : null,
      ...(placement?.status === 'historical'
        ? { historicalPlacement: placement.id, appearance: placement.appearance }
        : {}),
      catalogPlacement: placement?.id ?? null,
      placementStatus: placement?.status ?? null,
      placementHash,
    },
    visualQa: {
      captureFiles: images.map(plainPath),
      captureFilesExist: images.length > 0,
      reviewedCaptureHashesMatch: capturesMatch,
      hashBoundReviewPassed: visualReviewed,
      note: 'Existing images are inspectable evidence, but their presence alone does not establish review against the current model hash.',
    },
    fidelityQa: {
      target: 'maximum',
      hashBoundReviewPassed: fidelityReviewed,
      declaredQuality: spec?.quality ?? null,
      notes: qa?.fidelityReview?.notes ?? null,
    },
    sharedSurfaceQa: {
      required: needsSharedReview,
      reviewedCaptureHashesMatch: sharedMatches,
      hashBoundReviewPassed: sharedReviewed,
      captureFiles: sharedCapture?.frames?.map((frame) => `${sourceDirectory}/${frame.path}`) ?? [],
    },
    ...(rejected
      ? {
          currentWorldReview: {
            reasonCode: rejected.reasonCode,
            reason: rejected.reason,
            recommendation: 'identity-review.json',
            suggestedReplacement: rejected.suggestedReplacement.wikidataId,
          },
        }
      : {}),
  };
}
const records = [];
for (const candidate of catalog.candidates) {
  const collection = collections.find((entry) => entry.id === candidate.id);
  if (!collection) {
    records.push(await modelReadiness(candidate, geoById.get(candidate.id)));
    continue;
  }
  const members = [];
  for (const member of collection.members) {
    members.push(
      await modelReadiness(
        member,
        geoById.get(member.id) ?? {
          wikidataId: member.wikidataId,
          asset: member.assetId,
          disposition: 'collection-member',
          orientationStatus: 'unresolved',
          referenceAnchor: [
            member.referenceCoordinate.longitude,
            member.referenceCoordinate.latitude,
          ],
          facts: { height: [], width: [], length: [] },
        },
      ),
    );
  }
  const aggregate = collectionReadiness(collection, members, {
    path: collectionPath,
    hash: hash(collectionBytes),
  });
  const originalReview = reviewedById.get(candidate.id);
  if (originalReview?.original.wikidataId === candidate.wikidataId) {
    aggregate.currentWorldReview = {
      reasonCode: originalReview.reasonCode,
      reason: originalReview.reason,
      recommendation: 'identity-review.json',
      resolution:
        'Explicit independent members; the collection has no geographic placement and is ready only when all member reviews pass.',
    };
  }
  records.push(aggregate);
}
const individualRecords = [
  ...new Map(
    records
      .flatMap((record) => record.collection?.members ?? [record])
      .map((record) => [record.asset, record]),
  ).values(),
];
const counts = {
  candidates: records.length,
  sourceFacts: records.filter((record) => record.sourceFacts.available).length,
  sourceModels: records.filter((record) => record.model.source.present).length,
  runtimeModels: records.filter((record) => record.model.runtime.present).length,
  verifiedHashes: records.filter(
    (record) => record.model.source.matchesManifestAndImport && record.model.runtime.matchesSidecar,
  ).length,
  mapAxes: records.filter((record) => record.geographic.orientationEvidence === 'axis-only').length,
  identityReview: records.filter((record) => record.currentWorldReview).length,
  visualReviews: records.filter((record) => record.visualQa.hashBoundReviewPassed).length,
  sharedSurfaceReviews: records.filter((record) => record.sharedSurfaceQa.hashBoundReviewPassed)
    .length,
  previewPlacements: records.filter(
    (record) =>
      record.geographic.activePlacement ||
      (record.geographic.activePlacements?.length === record.collection?.requiredCount &&
        record.collection),
  ).length,
  authoredAssets: individualRecords.filter((record) => record.model.source.present).length,
  importedAssets: individualRecords.filter((record) => record.model.runtime.present).length,
  placedAssets: individualRecords.filter((record) => record.geographic.activePlacement).length,
  fidelityReviews: records.filter((record) => record.fidelityQa.hashBoundReviewPassed).length,
  ready: records.filter((record) => record.readiness === 'ready').length,
};
const output = {
  format: 'molen/structure-readiness@1',
  title: 'Next 1,000 structure production and placement readiness',
  policy:
    'All current catalog identities remain visible. Missing geometry, undirected map axes, missing datum/facade review and unbound screenshots remain explicit blockers. ready requires hash-bound maximum-fidelity, visual and geographic review plus an active runtime placement.',
  counts,
  candidates: records,
};
const path = resolve(root, 'content/earth/structures/readiness.json');
const serialized = `${formatJson(output)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== serialized)
    throw new Error(
      'Structure readiness ledger is stale: run node packages/worldgen-earth/scripts/build-structure-readiness.mjs',
    );
} else await writeIndex(path, serialized);
const progressPath = resolve(root, 'content/worldgen/source/next-1000/PROGRESS.md');
const reviewed = (value) => (value ? 'Passed' : 'Pending');
const cells = (text) => String(text).replaceAll('|', '\\|');
const progress = `# All 1,000 structure models — production progress

Generated from source masters, imported sidecars, geographic placements and hash-bound reviews.
The scope remains **all 1,000 candidates**. Collections require every declared independent member.
There are ${counts.authoredAssets} authored assets, ${counts.importedAssets} imported assets and ${counts.placedAssets} active geographic asset previews.
A candidate is complete only after its current source/runtime,
portable render, shared-material render, geographic fit and maximum exterior fidelity pass.

| Stage | Models |
| --- | ---: |
| Source GLBs authored | ${counts.sourceModels} |
| Runtime GLBs imported | ${counts.runtimeModels} |
| Current source and runtime hashes verified | ${counts.verifiedHashes} |
| Portable visual reviews passed | ${counts.visualReviews} |
| Shared-material reviews passed | ${counts.sharedSurfaceReviews} |
| Active geographic previews | ${counts.previewPlacements} |
| Maximum exterior fidelity reviews passed | ${counts.fidelityReviews} |
| Complete | ${counts.ready} |
| Source models still to author | ${counts.candidates - counts.sourceModels} |

## Authored models

Review labels bind the current source and runtime to inspected captures. Geometry changes invalidate
older approvals. The RGB alignment repair preserves a review only when the exact historical source
bytes can be reconstructed and the runtime bytes, inspected images and material graphs still match.
See the [gallery](gallery.html) for renders and the [full readiness ledger](../../../earth/structures/readiness.json)
for exact blockers, identity issues and all 1,000 candidates.

| ID | Model | Runtime triangles | Visual | Shared materials | Placement review | Maximum fidelity | Complete |
| --- | --- | ---: | --- | --- | --- | --- | --- |
${records
  .filter((record) => record.model.source.present || record.collection?.sourceCount > 0)
  .map((record) => {
    const readme = plainPath(
      relative(
        dirname(progressPath),
        resolve(root, dirname(record.model.source.path ?? ''), '../README.md'),
      ),
    );
    if (record.collection)
      return `| ${record.candidateId} | [${cells(record.title)}](collections.json) (${record.collection.readyCount}/${record.collection.requiredCount} members complete) | ${record.model.runtime.triangles ?? 'Pending'} | ${reviewed(record.visualQa.hashBoundReviewPassed)} | ${reviewed(record.sharedSurfaceQa.hashBoundReviewPassed)} | ${reviewed(record.geographic.verified)} | ${reviewed(record.fidelityQa.hashBoundReviewPassed)} | ${record.readiness === 'ready' ? 'Yes' : 'Pending'} |`;
    return `| ${record.candidateId} | [${cells(record.title)}](${readme}) | ${record.model.runtime.triangles ?? 'Pending'} | ${reviewed(record.visualQa.hashBoundReviewPassed)} | ${record.sharedSurfaceQa.required ? reviewed(record.sharedSurfaceQa.hashBoundReviewPassed) : 'Not required'} | ${reviewed(record.geographic.verified)} | ${reviewed(record.fidelityQa.hashBoundReviewPassed)} | ${record.readiness === 'ready' ? 'Yes' : 'Pending'} |`;
  })
  .join('\n')}

Regenerate with \`node packages/worldgen-earth/scripts/build-structure-readiness.mjs\`.
`;
if (process.argv.includes('--check')) {
  if ((await readFile(progressPath, 'utf8')).replaceAll('\r\n', '\n') !== progress)
    throw new Error('Structure production progress is stale; rebuild the readiness ledger.');
} else await writeIndex(progressPath, progress);
console.log(JSON.stringify(counts));

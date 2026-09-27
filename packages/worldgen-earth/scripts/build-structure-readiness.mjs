/** Offline evidence ledger. File existence is never treated as a completed visual review. */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';

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
const records = [];
for (const candidate of catalog.candidates) {
  const geo = geoById.get(candidate.id);
  if (geo?.wikidataId !== candidate.wikidataId)
    throw new Error(`${candidate.id}: stale geographic identity; regenerate georeferencing`);
  const key = geo.asset.split('.').at(-1);
  const sourceDirectory = `content/worldgen/source/next-1000/models/${key}`;
  const runtimeDirectory = `content/worldgen/assets/${geo.asset.replaceAll('.', '/')}`;
  const sourcePath = `${sourceDirectory}/models/source.glb`,
    runtimePath = `${runtimeDirectory}/model.glb`,
    sidecarPath = `${runtimeDirectory}/asset.json`;
  const [source, runtime, sidecarBytes, sourceManifestBytes, reviewBytes, specBytes, captureBytes] =
    await Promise.all([
      bytes(sourcePath),
      bytes(runtimePath),
      bytes(sidecarPath),
      bytes(`${sourceDirectory}/source.json`),
      bytes(`${sourceDirectory}/qa.json`),
      bytes(`${sourceDirectory}/spec.json`),
      bytes(`${sourceDirectory}/capture-report.json`),
    ]);
  const sidecar = sidecarBytes ? JSON.parse(sidecarBytes) : undefined;
  const sourceManifest = sourceManifestBytes ? JSON.parse(sourceManifestBytes) : undefined;
  const qa = reviewBytes ? JSON.parse(reviewBytes) : undefined;
  const spec = specBytes ? JSON.parse(specBytes) : undefined;
  const capture = captureBytes ? JSON.parse(captureBytes) : undefined;
  const sourceHash = source ? hash(source) : undefined,
    runtimeHash = runtime ? hash(runtime) : undefined;
  const sourceDeclared = sourceManifest?.files?.models?.find(
    (model) => model.assetId === geo.asset,
  )?.sha256;
  const sourceMatches = Boolean(
    sourceHash && sourceDeclared === sourceHash && sidecar?.sourceHash === sourceHash,
  );
  const runtimeMatches = Boolean(
    runtimeHash && sidecar?.hash === runtimeHash && sidecar?.id === geo.asset,
  );
  const images = await imageFiles(sourceDirectory);
  const placement = placements.entries.find((entry) => entry.asset === geo.asset);
  const placementHash = placement ? hash(JSON.stringify(placement)) : null;
  const reviewMatches = Boolean(
    sourceHash &&
      runtimeHash &&
      qa &&
      qa.sourceHash === sourceHash &&
      qa.runtimeHash === runtimeHash,
  );
  // A model hash alone does not bind a review to the actual renders the reviewer saw.
  // Keep the report and every reviewed frame in the evidence chain as well.
  const reviewedFrames = qa?.visualReview?.inspectedFrames ?? [];
  let capturesMatch = Boolean(
    captureBytes &&
      qa?.captureReportHash === hash(captureBytes) &&
      capture?.sourceHash === sourceHash &&
      capture?.runtimeHash === runtimeHash &&
      reviewedFrames.length > 0,
  );
  for (const path of reviewedFrames) {
    const frame = capture?.frames?.find((entry) => entry.path === path);
    const image = frame ? await bytes(`${sourceDirectory}/${path}`) : undefined;
    if (!image || hash(image) !== frame.hash) capturesMatch = false;
  }
  const visualReviewed = reviewMatches && capturesMatch && qa.visualReview?.status === 'passed';
  const geographicReviewed =
    reviewMatches &&
    Boolean(placementHash) &&
    qa.geographicReview?.status === 'passed' &&
    qa.geographicReview?.placementHash === placementHash;
  const fidelityReviewed =
    reviewMatches &&
    qa.fidelityReview?.target === 'maximum' &&
    qa.fidelityReview?.status === 'passed' &&
    typeof qa.fidelityReview?.notes === 'string' &&
    qa.fidelityReview.notes.trim().length > 0;
  const recommendation = reviewedById.get(candidate.id);
  const rejected =
    recommendation?.original.wikidataId === candidate.wikidataId ? recommendation : undefined;
  const blockers = [];
  if (rejected) blockers.push(`identity:${rejected.reasonCode}`);
  if (!source) blockers.push('source-model-missing');
  if (!runtime || !sidecar) blockers.push('runtime-import-missing');
  if (source && runtime && !sourceMatches) blockers.push('source-hash-unverified');
  if (runtime && !runtimeMatches) blockers.push('runtime-hash-unverified');
  if (!visualReviewed) blockers.push('visual-review-missing-or-unbound');
  if (!fidelityReviewed) blockers.push('maximum-fidelity-review-missing-or-unbound');
  if (geo.orientationStatus === 'unresolved') blockers.push('orientation-unresolved');
  if (!geographicReviewed) blockers.push('geographic-review-missing-or-unbound');
  if (placement?.status !== 'preview') blockers.push('runtime-placement-inactive');
  const assetRegistered = typeof project.assets?.[geo.asset] === 'string';
  if (source && !assetRegistered) blockers.push('asset-registry-missing');
  records.push({
    candidateId: candidate.id,
    wikidataId: candidate.wikidataId,
    title: candidate.title,
    asset: geo.asset,
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
      orientationEvidence: geo.orientationStatus,
      anchor: placement?.anchor ?? geo.anchor ?? geo.referenceAnchor,
      heading: placement?.heading ?? geo.heading ?? null,
      mappedFeatureIds: geo.featureIds ?? [],
      verified: geographicReviewed,
      activePlacement: placement?.status === 'preview' ? placement.id : null,
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
  });
}
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
} else await writeFile(path, serialized);
console.log(JSON.stringify(counts));

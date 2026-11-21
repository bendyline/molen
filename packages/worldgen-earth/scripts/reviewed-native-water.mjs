import { createHash } from 'node:crypto';
import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** Natural sites use the bound Earth terrain and water stream while their relief stays portable. */
export function reviewedNativeWater({ spec, qa, anchor, waterFeatures, mapBytes, previewBytes }) {
  const review = qa?.nativeWaterReview;
  const proposal = spec?.geographicProposal;
  const hasLandform = proposal?.status === 'native-terrain-and-hydrology';
  if (
    (!hasLandform && proposal?.status !== 'native-hydrology') ||
    review?.status !== 'passed' ||
    review.inputHash !== qa.inputHash ||
    review.featureArchive !== proposal.source ||
    review.viewer !== 'mountEarthView' ||
    !matchesEvidenceText(mapBytes, review.mapGeometryHash) ||
    !previewBytes ||
    hash(previewBytes) !== review.previewHash
  )
    return undefined;

  const map = JSON.parse(mapBytes);
  const { anchor: mapAnchor } = map;
  const lakes = hasLandform ? map.lakes : [map.lake];
  const lakeIds = lakes.map((lake) => lake.id);
  if (
    !Array.isArray(mapAnchor) ||
    mapAnchor.length !== 2 ||
    !mapAnchor.every((coordinate, i) => Number.isFinite(coordinate) && coordinate === anchor?.[i])
  )
    return undefined;

  const { views, probes } = review;
  if (!Array.isArray(probes)) return undefined;
  const stages = new Map();
  for (const lake of lakes) {
    const feature = waterFeatures.find(({ id }) => id === lake.id);
    const expectedHash = hasLandform
      ? review.waterFeatureHashes?.[lake.id]
      : review.waterFeatureHash;
    if (
      !Number.isFinite(feature?.elevation) ||
      hash(JSON.stringify(feature)) !== expectedHash ||
      (hasLandform && feature.elevation !== lake.stageMeters)
    )
      return undefined;
    stages.set(lake.id, feature.elevation);
  }
  const islandCount = lakes.reduce(
    (count, lake) => count + lake.rings.reduce((sum, rings) => sum + rings.length - 1, 0),
    0,
  );
  const expectedLakeId = (probe) => (hasLandform ? probe.featureId : review.featureId);
  const dryLandCount = probes.filter((p) => p.surface === 'landform').length;
  if (hasLandform) {
    const generalized = waterFeatures.find(({ id }) => id === review.generalizedFeatureId);
    const patches = waterFeatures.filter(({ join }) => stages.has(join));
    if (
      lakeIds.length < 2 ||
      JSON.stringify(proposal.lakeIds) !== JSON.stringify(lakeIds) ||
      proposal.heading !== 0 ||
      JSON.stringify(proposal.anchor) !== JSON.stringify(mapAnchor) ||
      !map.rockslide?.id ||
      map.rockslide.id !== spec.sourceFacts?.rockslideMapId ||
      dryLandCount < 2 ||
      !generalized?.exclude ||
      !lakeIds.every((id) => patches.some((feature) => feature.join === id)) ||
      ![generalized, ...patches].every(
        (feature) => hash(JSON.stringify(feature)) === review.shorelineFeatureHashes?.[feature.id],
      ) ||
      Object.keys(review.shorelineFeatureHashes).length !== patches.length + 1
    )
      return undefined;
  } else if (dryLandCount || review.featureId !== lakeIds[0]) {
    return undefined;
  }
  const highWater = Math.max(...stages.values());
  const requiredViews = ['overview', 'west', 'east', 'away', 'return'];
  if (hasLandform) requiredViews.push('dam');
  if (
    !lakeIds.every(
      (id) => probes.filter((p) => p.surface === 'water' && expectedLakeId(p) === id).length >= 3,
    ) ||
    probes.filter((p) => p.surface === 'island').length !== islandCount ||
    !requiredViews.every((name) => {
      const view = views?.[name];
      if (view?.failedTiles !== 0 || view.waterHits?.length !== probes.length) return false;
      if (name === 'away') return view.waterMeshes === 0 && view.waterHits.every((h) => !h.length);
      return (
        view.waterMeshes > 0 &&
        view.maxLevel >= 15 &&
        view.waterHits.every((hits, i) => {
          const probe = probes[i];
          if (probe.surface === 'water') {
            const stage = stages.get(expectedLakeId(probe));
            return hits.length > 0 && hits.every((h) => Math.abs(h - stage) < 0.01);
          }
          if (probe.surface === 'island') return !hits.length;
          return probe.surface === 'landform' && !hits.length && view.ground?.[i] > highWater;
        })
      );
    })
  )
    return undefined;

  return hasLandform
    ? {
        lakes: lakes.map(({ id }) => ({ featureId: id, elevationMeters: stages.get(id) })),
        landformFeatureId: map.rockslide.id,
        islandCount,
      }
    : { featureId: review.featureId, elevationMeters: stages.get(review.featureId), islandCount };
}

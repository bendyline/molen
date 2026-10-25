import { createHash } from 'node:crypto';
import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';

export const categoryRuleHash = (rules) =>
  `sha256:${createHash('sha256').update(JSON.stringify(rules)).digest('hex')}`;

/** A type is approved through current map rules and real viewer evidence, never a centroid. */
export async function reviewedCategoryRules({
  spec,
  sourceEntry,
  sourceManifest,
  sidecar,
  qa,
  rules,
  placements,
  reportBytes,
  exampleBytes,
  readImage,
}) {
  if (
    spec?.usage?.kind !== 'map-category' ||
    sourceEntry?.role !== 'reusable' ||
    spec.geographicProposal ||
    spec.referenceCoordinate ||
    placements.some(
      (p) => p.asset === spec.assetId && ['preview', 'historical'].includes(p.status),
    ) ||
    !sourceManifest?.files?.documents?.includes('category-integration-report.json') ||
    !sourceManifest?.files?.documents?.includes('map-example.json') ||
    qa?.categoryReview?.status !== 'passed' ||
    !matchesEvidenceText(reportBytes, qa.categoryReview.reportHash)
  )
    return undefined;
  if (!Array.isArray(spec.usage.rules) || !spec.usage.rules.every((id) => typeof id === 'string'))
    return undefined;
  const active = rules.filter((r) => r.asset === spec.assetId);
  if (
    !active.length ||
    JSON.stringify(active.map((r) => r.id).sort()) !== JSON.stringify([...spec.usage.rules].sort())
  )
    return undefined;
  const ruleHash = categoryRuleHash(active);
  if (qa.categoryReview.ruleHash !== ruleHash) return undefined;
  let report, example;
  try {
    report = JSON.parse(reportBytes);
    example = JSON.parse(exampleBytes);
  } catch {
    return undefined;
  }
  if (
    report.assetId !== spec.assetId ||
    report.inputHash !== qa.inputHash ||
    report.sourceHash !== qa.sourceHash ||
    report.runtimeHash !== qa.runtimeHash ||
    report.ruleHash !== ruleHash ||
    !matchesEvidenceText(exampleBytes, report.mapExampleHash) ||
    report.productionDecoderVerified !== true ||
    report.decodeProof?.poi?.id !== example.feature?.id ||
    report.decodeProof?.poi?.class !== example.feature?.properties?.kind ||
    !report.orientationLimit?.trim()
  )
    return undefined;
  const modelHashes = [
    { name: 'source', hash: qa.sourceHash },
    { name: 'runtime', hash: qa.runtimeHash },
    ...(sidecar?.runtimeLods?.levels ?? []).map((l) => ({ name: l.name, hash: l.hash })),
  ];
  if (
    modelHashes.length !== 6 ||
    JSON.stringify(report.modelHashes) !== JSON.stringify(modelHashes)
  )
    return undefined;
  const levels = ['skyline', 'district', 'street', 'closeup', 'failure'];
  if (
    report.reports?.length !== 5 ||
    !levels.every((l) => report.reports.some((r) => r.level === l))
  )
    return undefined;
  for (const run of report.reports) {
    const s = run.state,
      u = run.unloaded,
      failed = run.level === 'failure';
    if (
      !s ||
      !u ||
      s.matched?.length !== 1 ||
      s.matched[0].asset !== spec.assetId ||
      !active.some((r) => s.matched[0].id.startsWith(`map.${r.id}.`)) ||
      !(s.sourceBuildings > s.independentBuildings && s.independentBuildings > 0) ||
      s.changedIndependent?.length !== 0 ||
      s.modelLoaded !== !failed ||
      s.sourceGridModified !== false ||
      s.groundCutoutActive !== false ||
      s.waterCutoutActive !== false ||
      !Number.isFinite(s.sourceWaterArea) ||
      !Number.isFinite(s.remainingWaterArea) ||
      !s.nativeWaterUnchanged ||
      Math.abs(s.sourceWaterArea - s.remainingWaterArea) > 1e-6 ||
      s.remainingBuildings !== (failed ? s.sourceBuildings : s.independentBuildings) ||
      !['outsideRegion', 'hotel', 'partialName'].every((k) => s.negatives?.[k] === 0) ||
      !u.groundRestored ||
      !u.waterRestored ||
      u.liveGeometries !== 0 ||
      !run.frames?.length ||
      run.errors?.length !== 0
    )
      return undefined;
    for (const frame of run.frames) {
      const image = await readImage(frame.path);
      if (!image || categoryBytesHash(image) !== frame.hash) return undefined;
    }
  }
  return {
    rules: active.map((r) => r.id),
    ruleHash,
    example: example.feature.id,
    orientationLimit: report.orientationLimit,
  };
}
function categoryBytesHash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

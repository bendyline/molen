/** Normalize explicit authoring dates; older undated reconstructions remain catalog drafts. */
import { isHistoricalStructureAppearance, isStructureViewingDate } from '../dist/kernel.mjs';

export function authoredHistoricalAppearance(spec) {
  const appearance = spec.appearance;
  if (spec.geographicProposal?.status !== 'historical-proposal') return undefined;
  if (
    appearance?.currentWorldEligible !== false ||
    (appearance.kind ?? appearance.mode) !== 'historical'
  )
    throw new Error(`${spec.id}: historical placement needs explicit historical-only appearance`);
  for (const field of ['validFrom', 'validUntil'])
    if (appearance[field] !== undefined && !isStructureViewingDate(appearance[field]))
      throw new Error(`${spec.id}: invalid historical ${field}`);
  // Do not infer the first supported appearance from an observed year or the building's age.
  if (appearance.validFrom === undefined || appearance.validUntil === undefined) return undefined;
  const normalized = {
    kind: 'historical',
    currentWorldEligible: false,
    ...(appearance.representedDate !== undefined
      ? { representedDate: appearance.representedDate }
      : {}),
    validFrom: appearance.validFrom,
    validUntil: appearance.validUntil,
  };
  if (!isHistoricalStructureAppearance(normalized))
    throw new Error(`${spec.id}: invalid historical appearance range`);
  return normalized;
}

/** Historical readiness means usable through the date opt-in, never default-world activation. */
export function hasUsableStructurePlacement(placement) {
  return (
    placement?.status === 'preview' ||
    (placement?.status === 'historical' && isHistoricalStructureAppearance(placement.appearance))
  );
}

/** Demolition excludes today's world, but a reviewed dated reconstruction remains usable. */
export function historicalIdentityResolved(recommendation, placement, geographicReviewed) {
  return (
    recommendation?.reasonCode === 'historical' &&
    geographicReviewed === true &&
    placement?.status === 'historical' &&
    isHistoricalStructureAppearance(placement.appearance)
  );
}

/** A historical geography review must exercise dated placement, not an isolated asset preview. */
export function hasHistoricalPlacementCapture(placement, report, placementHash) {
  if (placement?.status !== 'historical') return true;
  const appearance = placement.appearance;
  return (
    isHistoricalStructureAppearance(appearance) &&
    isStructureViewingDate(report?.viewingDate) &&
    report.viewingDate >= appearance.validFrom &&
    report.viewingDate < appearance.validUntil &&
    report.placementHash === placementHash &&
    report.frames?.length > 0 &&
    report.frames.every(
      (frame) =>
        frame.state?.mode === 'geographic-flat-terrain' &&
        frame.state?.placementId === placement.id,
    ) &&
    report.eviction?.disposed === true &&
    report.eviction?.liveModelGeometries === 0
  );
}

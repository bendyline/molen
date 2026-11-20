import { matchesEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';

/** Verify a selected proposal against its source map, runtime LODs and native site captures. */
export async function reviewedProposalPlacement({
  placement,
  placementHash,
  inputHash,
  sidecar,
  qa,
  reportBytes,
  mapBytes,
  readImage,
}) {
  if (
    placement?.status !== 'proposal' ||
    !placement.bounds ||
    placement.orientation !== 'fixed' ||
    !Number.isFinite(placement.heading) ||
    !inputHash ||
    sidecar?.runtimeLods?.levels?.length !== 4 ||
    !mapBytes ||
    !matchesEvidenceText(reportBytes, qa?.geographicReview?.proposalReportHash)
  )
    return false;
  const map = JSON.parse(mapBytes);
  const report = JSON.parse(reportBytes);
  if (
    report.format !== 'molen/structure-proposal-review@1' ||
    report.inputHash !== inputHash ||
    report.assetId !== placement.asset ||
    report.runtimeHash !== sidecar.hash ||
    report.placementHash !== placementHash ||
    report.selectedProposal !== placement.id ||
    !matchesEvidenceText(mapBytes, report.siteFrameHash) ||
    !Array.isArray(map.anchor) ||
    map.anchor.length !== 2 ||
    !map.anchor.every((value, i) => value === placement.anchor[i]) ||
    map.heading !== placement.heading ||
    report.defaultView?.proposalRequests !== 0 ||
    report.dateOnlyView?.proposalRequests !== 0 ||
    report.failedLoad?.fallbackRetained !== true ||
    !Array.isArray(report.levels) ||
    report.levels.length !== 4
  )
    return false;
  for (const level of sidecar.runtimeLods.levels) {
    const capture = report.levels.find((entry) => entry.level === level.name);
    if (
      capture?.modelHash !== level.hash ||
      capture?.visibleDraws < 1 ||
      !Number.isFinite(capture?.visibleDraws) ||
      capture?.liveGeometriesAfterUnload !== 0 ||
      capture?.groundRestored !== true ||
      capture?.surroundingsRetained !== true ||
      !Array.isArray(capture?.signedControlErrorsMeters) ||
      capture.signedControlErrorsMeters.length < 3 ||
      capture.signedControlErrorsMeters.some(
        (error) => !Number.isFinite(error) || error < 0 || error > 0.05,
      ) ||
      !Array.isArray(capture?.inspectedFrames) ||
      !capture.inspectedFrames.length
    )
      return false;
    for (const { path, hash } of capture.inspectedFrames) {
      if (!/^shots\/proposal\/[a-z0-9.-]+\.png$/.test(path)) return false;
      const image = await readImage(path);
      if (!image || hashBytes(image) !== hash) return false;
    }
  }
  return true;
}

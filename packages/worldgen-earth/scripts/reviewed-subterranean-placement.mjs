const levels = ['skyline', 'district', 'street', 'closeup'];

/** A buried landmark needs native terrain evidence of its interior and surface access. */
export function subterraneanIdentityResolved({
  recommendation,
  placement,
  placementHash,
  geographicReviewed,
  sharedReviewed,
  runtimeHash,
  inspectedFrames,
  capture,
}) {
  const ground = placement?.groundCutout;
  if (
    recommendation?.reasonCode !== 'subterranean' ||
    !geographicReviewed ||
    !sharedReviewed ||
    placement?.status !== 'preview' ||
    ground?.preservePaving !== true ||
    !placementHash ||
    capture?.placementHash !== placementHash ||
    !runtimeHash ||
    capture.runtimeHash !== runtimeHash ||
    capture.eviction?.disposed !== true ||
    capture.eviction.liveModelGeometries !== 0 ||
    !Array.isArray(capture.frames) ||
    !capture.frames.some(
      ({ path, state }) =>
        inspectedFrames.includes(path) &&
        state?.mode === 'geographic-native-terrain' &&
        state.placementId === placement.id &&
        state.assetId === placement.asset &&
        state.runtimeHash === runtimeHash &&
        state.visibleDraws > 0,
    ) ||
    !Array.isArray(capture.placementChecks)
  ) {
    return false;
  }
  const openings =
    ground.outlines?.length ?? (ground.outline ? 1 : 0) + (ground.additionalOutlines?.length ?? 0);
  return (
    openings > 0 &&
    levels.every((level) => {
      const check = capture.placementChecks.find((row) => row.level === level);
      if (
        check?.cutoutActive !== true ||
        check.unload?.groundRetained !== true ||
        check.unload.liveGeometries !== 0 ||
        !Array.isArray(check.portals) ||
        check.portals.length !== openings ||
        !check.portals.every(
          (portal) =>
            portal.openSurface === null &&
            Number.isFinite(portal.bottom) &&
            Number.isFinite(portal.nearbySurface) &&
            portal.bottom < portal.nearbySurface,
        )
      ) {
        return false;
      }
      if (level === 'skyline') return true;
      const { ground, ceiling, deck } = check.interior ?? {};
      return [ground, ceiling, deck].every(Number.isFinite) && ground > ceiling && ceiling > deck;
    })
  );
}

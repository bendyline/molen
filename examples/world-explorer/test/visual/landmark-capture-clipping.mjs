/** Fit review depth precision without clipping details when the camera enters the bounds. */
export function reviewClipping(minimumDepth, maximumDepth) {
  return {
    near: minimumDepth > 100 ? minimumDepth / 50 : 0.1,
    far: Math.max(20000, maximumDepth * 1.2),
  };
}

/**
 * Keep a bounded query near the actual structure when its native origin is elsewhere.
 * @param {readonly [number, number]} anchorCenter
 * @param {readonly (readonly [number, number])[]} boundCorners
 * @param {boolean} bounded
 * @returns {{center: [number, number], origin: [number, number], tileSize: number, tileTranslation: [number, number]}}
 */
export function placementReviewTile(anchorCenter, boundCorners, bounded) {
  const first = boundCorners[0],
    last = boundCorners[1],
    center =
      bounded && first && last
        ? [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]
        : [...anchorCenter],
    span = Math.max(
      0,
      ...boundCorners.flatMap((p) => p.map((v, i) => 2 * Math.abs(v - center[i]) + 16)),
    ),
    tileSize = Math.max(bounded && boundCorners.length && span < 128 ? 128 : 256, span),
    origin = [center[0] - tileSize / 2, center[1] - tileSize / 2];
  return {
    center: [center[0], center[1]],
    origin: [origin[0], origin[1]],
    tileSize,
    tileTranslation: [origin[0] - anchorCenter[0], origin[1] - anchorCenter[1]],
  };
}

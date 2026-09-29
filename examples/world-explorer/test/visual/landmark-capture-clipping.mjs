/** Fit review depth precision without clipping details when the camera enters the bounds. */
export function reviewClipping(minimumDepth, maximumDepth) {
  return {
    near: minimumDepth > 100 ? minimumDepth / 50 : 0.1,
    far: Math.max(20000, maximumDepth * 1.2),
  };
}

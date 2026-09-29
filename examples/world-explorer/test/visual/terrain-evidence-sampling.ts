/** A source no-data cell is not an elevation and must never bridge a hole. */
export function sampleEvidenceGrid(
  heights: readonly (number | null)[],
  resolution: number,
  size: number,
  origin: readonly [number, number],
  x: number,
  z: number,
): number | undefined {
  const u = ((x - origin[0]) / size) * (resolution - 1);
  const v = ((z - origin[1]) / size) * (resolution - 1);
  if (u < 0 || v < 0 || u > resolution - 1 || v > resolution - 1) return undefined;
  const a = Math.min(resolution - 2, Math.floor(u)),
    b = Math.min(resolution - 2, Math.floor(v));
  const fx = u - a,
    fz = v - b;
  let sum = 0;
  for (const [dx, dz, weight] of [
    [0, 0, (1 - fx) * (1 - fz)],
    [1, 0, fx * (1 - fz)],
    [0, 1, (1 - fx) * fz],
    [1, 1, fx * fz],
  ]) {
    if (weight <= 1e-12) continue;
    const value = heights[(b + dz) * resolution + a + dx];
    if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
    sum += value * weight;
  }
  return sum;
}

export function omitUnknownTriangles(
  indices: ArrayLike<number>,
  heights: readonly (number | null)[],
): Uint32Array {
  const valid: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    if (triangle.every((index) => heights[index] !== null && Number.isFinite(heights[index])))
      valid.push(...triangle);
  }
  return Uint32Array.from(valid);
}

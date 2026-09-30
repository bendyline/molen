/**
 * Height of the rendered terrain surface (not the source heightfield) at a world X/Z. Ground
 * overlays such as roads are draped on the rendered grid (`surfaceResolution` vertices per
 * side, split NW-SW-NE / NE-SW-SE like `buildChunkGeometry`); objects that must sit on painted
 * roads sample the same triangles so they neither sink nor float between grid vertices.
 */

/** The part of a heightfield the sampler reads. */
export interface RenderedGroundSource {
  readonly cols: number;
  sampleHeight(x: number, z: number): number;
}

/**
 * Build a world-space sampler for one tile's rendered ground. Points outside the tile clamp to
 * its edge cells. Vertex heights are cached, so the sampler is cheap after the first queries.
 */
export function renderedGroundSampler(
  heightfield: RenderedGroundSource,
  origin: readonly [number, number],
  tileSize: number,
  surfaceResolution?: number,
): (x: number, z: number) => number {
  const cells = Math.max(1, (surfaceResolution ?? heightfield.cols) - 1);
  const spacing = tileSize / cells;
  const stride = cells + 1;
  const heights = new Float64Array(stride * stride).fill(Number.NaN);
  const vertex = (x: number, z: number): number => {
    const key = z * stride + x;
    let height = heights[key] as number;
    if (Number.isNaN(height)) {
      height = heightfield.sampleHeight(origin[0] + x * spacing, origin[1] + z * spacing);
      heights[key] = height;
    }
    return height;
  };
  return (wx, wz) => {
    const gx = (wx - origin[0]) / spacing;
    const gz = (wz - origin[1]) / spacing;
    const x = Math.max(0, Math.min(cells - 1, Math.floor(gx)));
    const z = Math.max(0, Math.min(cells - 1, Math.floor(gz)));
    const u = Math.max(0, Math.min(1, gx - x));
    const v = Math.max(0, Math.min(1, gz - z));
    const ne = vertex(x + 1, z);
    const sw = vertex(x, z + 1);
    if (u + v <= 1) return vertex(x, z) * (1 - u - v) + ne * u + sw * v;
    return vertex(x + 1, z + 1) * (u + v - 1) + ne * (1 - v) + sw * (1 - u);
  };
}

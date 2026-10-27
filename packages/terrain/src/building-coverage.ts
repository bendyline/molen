/** Built-up density from a semantic tile's own footprints, for ground and height priors. */
import { polygonArea } from './polygon';
import type { TerrainSemanticTile } from './semantic-types';

/** Share of ground under building footprints in `size` x `size` cells across a tile. */
export interface TerrainBuildingCoverage {
  size: number;
  cells: Float32Array;
}

/**
 * Building coverage on a coarse grid (default 16 x 16), each footprint counted in the cell
 * holding its outline's mean point, then box-blurred over neighboring cells so a block's
 * coverage reaches the streets around it.
 */
export function terrainBuildingCoverage(
  tile: TerrainSemanticTile,
  size = 16,
): TerrainBuildingCoverage {
  const sums = new Float32Array(size * size);
  for (const feature of tile.buildings)
    for (const polygon of feature.polygons) {
      const ring = polygon.outer;
      if (ring.length < 3) continue;
      let u = 0,
        v = 0;
      for (const point of ring) {
        u += point[0];
        v += point[1];
      }
      const col = Math.floor((u / ring.length) * size);
      const row = Math.floor((v / ring.length) * size);
      if (col < 0 || row < 0 || col >= size || row >= size) continue;
      sums[row * size + col] =
        (sums[row * size + col] as number) + polygonArea(polygon) * size * size;
    }
  const cells = new Float32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      let total = 0,
        count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr,
            c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          total += sums[r * size + c] as number;
          count++;
        }
      cells[row * size + col] = Math.min(1, total / count);
    }
  return { size, cells };
}

/** Bilinear coverage at normalized tile coordinates, between cell centers. */
export function sampleTerrainBuildingCoverage(
  coverage: TerrainBuildingCoverage,
  u: number,
  v: number,
): number {
  const { size, cells } = coverage;
  const x = Math.max(0, Math.min(size - 1, u * size - 0.5));
  const y = Math.max(0, Math.min(size - 1, v * size - 0.5));
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1),
    y1 = Math.min(size - 1, y0 + 1);
  const fx = x - x0,
    fy = y - y0;
  const at = (c: number, r: number): number => cells[r * size + c] as number;
  return (
    (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) +
    (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy
  );
}

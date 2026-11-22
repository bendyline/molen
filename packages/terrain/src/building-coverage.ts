/** Built-up density from a semantic tile's own footprints, for ground and height priors. */
import { polygonArea } from './polygon';
import type { TerrainSemanticTile } from './semantic-types';

/** Share of ground under building footprints in `size` x `size` cells across a tile. */
export interface TerrainBuildingCoverage {
  size: number;
  cells: Float32Array;
}

/** The default grid of terrainBuildingCoverage, and of the coverage a tile carries. */
export const TERRAIN_BUILDING_COVERAGE_SIZE = 16;

/**
 * Building coverage on a coarse grid (default 16 x 16), each footprint counted in the cell
 * holding its outline's mean point, then box-blurred over neighboring cells so a block's
 * coverage reaches the streets around it. A tile whose `buildings` are a selection carries the
 * coverage of all of them (`buildingCoverage`); that is the answer when its grid is `size`.
 */
export function terrainBuildingCoverage(
  tile: Pick<TerrainSemanticTile, 'buildings' | 'buildingCoverage'>,
  size: number = TERRAIN_BUILDING_COVERAGE_SIZE,
): TerrainBuildingCoverage {
  if (tile.buildingCoverage?.size === size)
    return { size, cells: Float32Array.from(tile.buildingCoverage.cells) };
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
  return { size, cells: blurTerrainBuildingCoverage(sums, size) };
}

/**
 * Coverage cells from per-cell footprint sums (footprint area in cells): the 3 x 3 box blur and
 * the cap at 1 that terrainBuildingCoverage applies. For a caller that sums footprints itself.
 */
export function blurTerrainBuildingCoverage(sums: Float32Array, size: number): Float32Array {
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
  return cells;
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

/**
 * Land-cover appearances whose ground paves over as building coverage rises (the default of
 * `TerrainUrbanGround.classes`): unmapped ground and broad urban uses.
 */
export const TERRAIN_URBAN_GROUND_CLASSES: readonly string[] = [
  'open_ground',
  'urban_area',
  'residential',
  'commercial',
  'retail',
  'industrial',
  'civic',
  'school',
  'hospital',
  'university',
];

/** Building coverage at which urban ground starts to pave over, and is paved (the defaults). */
export const TERRAIN_URBAN_GROUND_COVERAGE = { from: 0.15, full: 0.45 } as const;

/** Paved share of urban ground at this building coverage: a smoothstep from `from` to `full`. */
export function terrainUrbanGroundPaved(
  coverage: number,
  from: number = TERRAIN_URBAN_GROUND_COVERAGE.from,
  full: number = TERRAIN_URBAN_GROUND_COVERAGE.full,
): number {
  const t = Math.max(0, Math.min(1, (coverage - from) / (Math.max(from + 0.01, full) - from)));
  return t * t * (3 - 2 * t);
}

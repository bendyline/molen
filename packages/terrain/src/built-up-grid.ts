/**
 * Built-up evidence: how much of the ground is under buildings, from a source that is independent
 * of the map's own footprints (a settlement layer derived from satellite imagery, a census grid).
 *
 * A basemap's footprints are complete in some towns and nearly absent in others, and nothing in a
 * tile says which. A host can ship a coarse grid of the built-up share of the ground beside its
 * terrain package (`TerrainPackageDescriptor.builtUp`). Each semantic tile then carries the part
 * of that grid lying over it as `TerrainSemanticTile.builtUp`, and a generator can compare it
 * with what the tile's footprints cover: where they already account for the evidence there is
 * nothing to add, and where no evidence exists nothing should be invented.
 *
 * The grid is an observation and carries no rendering recipe. Tiles are XYZ JSON documents at one
 * level, run-length encoded whole percents, small enough to fetch with the tiles they inform. This
 * module is pure (no fetch): built-up-client.ts loads the documents.
 *
 * Related files: built-up-client.ts (retrieval and the tile enricher), agriculture-grid.ts (the
 * same shape for crops), package-semantic-client.ts (where a package's grid is attached), and
 * worldgen-earth's frontage-infill.ts (the reader).
 *
 * Gotchas:
 * - A coverage's cells need not line up with the tile: `box` may reach past the unit square. Pick
 *   a grid whose cells nest in the tiles (a power-of-two resolution) to avoid cells cut by tile
 *   edges, for which a tile knows only its own part of the footprints.
 * - Shares are of projected area, the same in the tile's units as on the ground.
 * - Attach evidence with `withTerrainBuiltUp`, not by spreading a tile yourself: it keeps the
 *   tile's packet, without which the tile is cloned whole to every worker (30 to 80 ms of main
 *   thread for a town tile).
 */
import type { TerrainPyramidTileAddress } from './pyramid-types';
import { deriveBuiltUpTerrainSemanticTilePacket } from './semantic-packet';
import {
  markTerrainSemanticTileChecked,
  type TerrainBuiltUpCoverage,
  type TerrainSemanticTile,
  terrainSemanticTileChecked,
} from './semantic-types';

export type { TerrainBuiltUpCoverage };

export interface TerrainBuiltUpSource {
  /** Versioned XYZ JSON URL; includes {z}, {x}, {y}. Relative to the terrain package. */
  urlTemplate: string;
  /** The single XYZ level the grid is stored at; finer tiles read their ancestor's document. */
  level: number;
  /** Pinned dataset identity, checked against every document. */
  source: string;
  /** Observation year. */
  year: number;
  /** Maximum uncompressed response size; defaults to 128 KiB, at most 1 MiB. */
  maxTileBytes?: number;
  /**
   * [west, south, east, north] in degrees the dataset covers. Inside it a missing document means
   * nothing is built there; outside it nothing is known and tiles carry no evidence. Default: the
   * whole world.
   */
  bounds?: [number, number, number, number];
}

export interface TerrainBuiltUpGrid {
  format: 'molen/built-up-grid@1';
  level: number;
  x: number;
  z: number;
  /** Cells across and down, 1..256. */
  resolution: number;
  source: string;
  year: number;
  /** [run length, percent of the cell's ground under buildings 0..100, ...], row-major north to south. */
  runs: number[];
}

export function decodeBuiltUpGrid(grid: TerrainBuiltUpGrid): Uint8Array {
  if (
    grid.format !== 'molen/built-up-grid@1' ||
    !Number.isInteger(grid.resolution) ||
    grid.resolution < 1 ||
    grid.resolution > 256 ||
    !Number.isInteger(grid.level) ||
    grid.level < 0 ||
    grid.level > 20 ||
    !Number.isInteger(grid.x) ||
    !Number.isInteger(grid.z) ||
    grid.x < 0 ||
    grid.z < 0 ||
    grid.x >= 2 ** grid.level ||
    grid.z >= 2 ** grid.level ||
    typeof grid.source !== 'string' ||
    !grid.source.length ||
    !Number.isInteger(grid.year) ||
    grid.year < 1900 ||
    grid.year > 2200 ||
    !Array.isArray(grid.runs) ||
    grid.runs.length % 2 !== 0 ||
    grid.runs.length > 2 * grid.resolution * grid.resolution
  )
    throw new Error('Invalid built-up grid');
  const cells = new Uint8Array(grid.resolution * grid.resolution);
  let offset = 0;
  for (let i = 0; i < grid.runs.length; i += 2) {
    const count = grid.runs[i],
      percent = grid.runs[i + 1];
    if (
      count === undefined ||
      percent === undefined ||
      !Number.isInteger(count) ||
      count < 1 ||
      !Number.isInteger(percent) ||
      percent < 0 ||
      percent > 100 ||
      offset + count > cells.length
    )
      throw new Error('Invalid built-up RLE');
    cells.fill(percent, offset, offset + count);
    offset += count;
  }
  if (offset !== cells.length) throw new Error('Incomplete built-up RLE');
  return cells;
}

/** Whether a tile lies in the area a built-up source covers (any overlap with its bounds). */
export function terrainBuiltUpCovers(
  source: Pick<TerrainBuiltUpSource, 'bounds'>,
  address: TerrainPyramidTileAddress,
): boolean {
  if (source.bounds === undefined) return true;
  const n = 2 ** address.level;
  const longitude = (x: number): number => (x / n) * 360 - 180;
  const latitude = (z: number): number =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * z) / n))) * 180) / Math.PI;
  const [west, south, east, north] = source.bounds;
  return (
    longitude(address.x + 1) > west &&
    longitude(address.x) < east &&
    latitude(address.z) > south &&
    latitude(address.z + 1) < north
  );
}

/**
 * The part of a built-up grid lying over a tile at the grid's level or finer, or undefined when
 * the grid is not the tile's ancestor. `cells` is `decodeBuiltUpGrid(grid)`, for a caller that
 * keeps it.
 */
export function terrainBuiltUpCoverage(
  address: TerrainPyramidTileAddress,
  grid: TerrainBuiltUpGrid,
  cells: Uint8Array = decodeBuiltUpGrid(grid),
): TerrainBuiltUpCoverage | undefined {
  const factor = 2 ** (address.level - grid.level);
  if (
    factor < 1 ||
    Math.floor(address.x / factor) !== grid.x ||
    Math.floor(address.z / factor) !== grid.z
  )
    return undefined;
  const n = grid.resolution,
    dx = address.x - grid.x * factor,
    dz = address.z - grid.z * factor;
  const x0 = Math.floor((dx * n) / factor),
    z0 = Math.floor((dz * n) / factor);
  const x1 = Math.min(n, Math.ceil(((dx + 1) * n) / factor)),
    z1 = Math.min(n, Math.ceil(((dz + 1) * n) / factor));
  const values: number[] = [];
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) values.push((cells[z * n + x] ?? 0) / 100);
  return {
    source: grid.source,
    year: grid.year,
    columns: x1 - x0,
    rows: z1 - z0,
    box: [
      (x0 / n) * factor - dx,
      (z0 / n) * factor - dz,
      (x1 / n) * factor - dx,
      (z1 / n) * factor - dz,
    ],
    values,
  };
}

/** Evidence that nothing is built over a tile: a covered area with no document. */
export function emptyTerrainBuiltUpCoverage(
  source: Pick<TerrainBuiltUpSource, 'source' | 'year'>,
): TerrainBuiltUpCoverage {
  return {
    source: source.source,
    year: source.year,
    columns: 1,
    rows: 1,
    box: [0, 0, 1, 1],
    values: [0],
  };
}

/**
 * A copy of `tile` carrying `coverage`. A tile already checked stays checked, and one that
 * arrived from a decoder worker keeps crossing to workers as its packet (semantic-packet.ts).
 */
export function withTerrainBuiltUp(
  tile: TerrainSemanticTile,
  coverage: TerrainBuiltUpCoverage,
): TerrainSemanticTile {
  const result: TerrainSemanticTile = { ...tile, builtUp: coverage };
  if (terrainSemanticTileChecked(tile)) markTerrainSemanticTileChecked(result);
  deriveBuiltUpTerrainSemanticTilePacket(tile, result);
  return result;
}

/** The built-up share, 0..1, at a tile-unit point; points past the cells read the nearest cell. */
export function sampleTerrainBuiltUp(
  coverage: TerrainBuiltUpCoverage,
  u: number,
  v: number,
): number {
  const [u0, v0, u1, v1] = coverage.box;
  const column = Math.min(
    coverage.columns - 1,
    Math.max(0, Math.floor(((u - u0) / (u1 - u0)) * coverage.columns)),
  );
  const row = Math.min(
    coverage.rows - 1,
    Math.max(0, Math.floor(((v - v0) / (v1 - v0)) * coverage.rows)),
  );
  return coverage.values[row * coverage.columns + column] ?? 0;
}

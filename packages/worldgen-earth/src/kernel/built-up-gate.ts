/**
 * Where a tile's built-up evidence leaves room for invented buildings.
 *
 * Frontage infill (frontage-infill.ts) lays lots along streets the map has no footprints for.
 * Whether a street has no footprints because nothing stands there or because nobody mapped it is
 * not in the map. A terrain package can carry independent evidence of how much ground is under
 * buildings (terrain's built-up-grid.ts, `TerrainSemanticTile.builtUp`). This module compares it
 * with what the tile's own footprints cover, over blocks about EVIDENCE_BLOCK across, and opens a
 * block for invention only where the evidence exceeds the footprints by `minDeficit` of the
 * block's ground.
 *
 * Why a difference over blocks, not a ratio per cell: measured on zoom-15 tiles against three
 * cadastres (Alicante, Oviedo, Bogotá; November 2026) with GHSL's 100 m built-up surface as the
 * evidence. Such a layer reads a villa suburb or bare dry ground several points higher than the
 * footprints there, so on a complete map a per-cell ratio ("footprints under half the evidence")
 * still left 22,000 of Alicante's 50,700 invented buildings, nearly all on ground with no real
 * building. A difference of 0.15 over 4 x 4 cells leaves 1,200 there, 115 of 21,500 round Oviedo
 * and 41 of 2,200 in Bogotá, while a Bogotá map holding 15% of the city's buildings keeps 96% of
 * the 77,600 invented on it (92% of them on a real building). Thinning lots toward the evidence
 * instead of gating them scored no better in simulation.
 *
 * Related files: frontage-infill.ts (the reader), terrain's built-up-grid.ts and
 * built-up-client.ts (the evidence).
 *
 * Gotchas:
 * - Low-density places the map has no footprints for stay empty: evidence of 0.10 with nothing
 *   mapped is under the default difference. That is the price of the bias above.
 * - Blocks are groups of 2^n cells counted from the coverage's first cell. A grid whose cells
 *   nest in the tiles (a power-of-two resolution) gives every tile and level the same blocks; any
 *   other grid gives blocks cut by tile edges, where a tile knows only its own footprints.
 * - A footprint's area is spread over the blocks its bounding box touches, in proportion to the
 *   overlap: exact for a box-shaped building, close for the rest.
 */
import {
  polygonArea,
  polygonBounds,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';

/** Ground distance across an evidence block, m: blocks are the nearest 2^n cells to it. */
export const EVIDENCE_BLOCK = 480;
/** Share of a block's ground the evidence must exceed the footprints by before lots are invented. */
export const EVIDENCE_DEFICIT = 0.15;

export interface BuiltUpGateOptions {
  /** Share of a block's ground, 0..1, the evidence must exceed the footprints by. Default 0.15. */
  minDeficit?: number;
}

export interface BuiltUpGate {
  /** Blocks across and down. */
  columns: number;
  rows: number;
  /** Tile-unit box the blocks cover. */
  box: [number, number, number, number];
  /** Built share of each block by the evidence, row-major. */
  evidence: number[];
  /** Share of each block the tile's footprints cover, row-major. */
  mapped: number[];
  /** Whether any block is open. */
  any: boolean;
  /** Whether buildings may be invented at a tile-unit point; points outside read the nearest block. */
  allows(u: number, v: number): boolean;
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * The gate for a tile `tileMeters` across, or undefined when the tile carries no evidence (then
 * nothing is known and invention is not limited by it).
 */
export function createBuiltUpGate(
  tile: Pick<TerrainSemanticTile, 'buildings' | 'builtUp'>,
  tileMeters: number,
  options: BuiltUpGateOptions = {},
): BuiltUpGate | undefined {
  const coverage = tile.builtUp;
  if (coverage === undefined) return undefined;
  const minDeficit = options.minDeficit ?? EVIDENCE_DEFICIT;
  if (!(minDeficit >= 0 && minDeficit <= 1))
    throw new Error('builtUp.minDeficit must be a share in 0..1');
  const [u0, v0, u1, v1] = coverage.box;
  const cellU = (u1 - u0) / coverage.columns,
    cellV = (v1 - v0) / coverage.rows;
  // Cells to a block side: the power of two that brings a block nearest EVIDENCE_BLOCK.
  const cellMeters = cellU * tileMeters;
  let k = 1;
  while (k * 2 * cellMeters <= EVIDENCE_BLOCK * Math.SQRT2 && k < 1024) k *= 2;
  const columns = Math.ceil(coverage.columns / k),
    rows = Math.ceil(coverage.rows / k);
  const blockU = cellU * k,
    blockV = cellV * k;
  // Only the part of a block inside the tile counts: that is all the footprints are known for.
  const area = new Float64Array(columns * rows),
    evidence = new Float64Array(columns * rows),
    mapped = new Float64Array(columns * rows);
  for (let row = 0; row < coverage.rows; row++) {
    const inV = overlap(v0 + row * cellV, v0 + (row + 1) * cellV, 0, 1);
    if (inV <= 0) continue;
    for (let column = 0; column < coverage.columns; column++) {
      const inside = overlap(u0 + column * cellU, u0 + (column + 1) * cellU, 0, 1) * inV;
      if (inside <= 0) continue;
      const block = Math.floor(row / k) * columns + Math.floor(column / k);
      area[block] = (area[block] as number) + inside;
      evidence[block] =
        (evidence[block] as number) +
        inside * (coverage.values[row * coverage.columns + column] ?? 0);
    }
  }
  for (const feature of tile.buildings)
    for (const polygon of feature.polygons) {
      const [minU, minV, maxU, maxV] = polygonBounds(polygon);
      const boxArea = (maxU - minU) * (maxV - minV);
      if (!(boxArea > 0)) continue;
      const footprint = polygonArea(polygon) / boxArea;
      const c0 = Math.max(0, Math.floor((Math.max(0, minU) - u0) / blockU)),
        c1 = Math.min(columns - 1, Math.floor((Math.min(1, maxU) - u0) / blockU));
      const r0 = Math.max(0, Math.floor((Math.max(0, minV) - v0) / blockV)),
        r1 = Math.min(rows - 1, Math.floor((Math.min(1, maxV) - v0) / blockV));
      for (let row = r0; row <= r1; row++) {
        const inV = overlap(
          Math.max(0, v0 + row * blockV),
          Math.min(1, v0 + (row + 1) * blockV),
          minV,
          maxV,
        );
        if (inV <= 0) continue;
        for (let column = c0; column <= c1; column++) {
          const inU = overlap(
            Math.max(0, u0 + column * blockU),
            Math.min(1, u0 + (column + 1) * blockU),
            minU,
            maxU,
          );
          if (inU > 0) {
            const block = row * columns + column;
            mapped[block] = (mapped[block] as number) + footprint * inU * inV;
          }
        }
      }
    }
  const open: boolean[] = [];
  let any = false;
  for (let block = 0; block < area.length; block++) {
    const ground = area[block] as number;
    if (ground > 0) {
      evidence[block] = (evidence[block] as number) / ground;
      mapped[block] = Math.min(1, (mapped[block] as number) / ground);
    }
    const allowed =
      ground > 0 && (evidence[block] as number) - (mapped[block] as number) >= minDeficit;
    open.push(allowed);
    any ||= allowed;
  }
  return {
    columns,
    rows,
    box: [u0, v0, u0 + columns * blockU, v0 + rows * blockV],
    evidence: Array.from(evidence),
    mapped: Array.from(mapped),
    any,
    allows(u, v) {
      const column = Math.min(columns - 1, Math.max(0, Math.floor((u - u0) / blockU)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor((v - v0) / blockV)));
      return open[row * columns + column] === true;
    },
  };
}

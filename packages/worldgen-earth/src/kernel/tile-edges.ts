/**
 * Tile-edge ownership. Vector tiles clip footprints at a buffered boundary, so one building can
 * appear in two neighbouring tiles. Both tiles run this rule on their own copy and always reach
 * the same verdict: exactly one tile renders a complete footprint, and a footprint cut by both
 * buffers is rendered piecewise inside the unit square with seam walls and a flat roof.
 */

import {
  polygonBounds,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
} from '@bendyline/molen-terrain/kernel';
import { clipRingToRect } from '@bendyline/molen-worldgen/kernel';

/** Protomaps basemap tiles carry a 64 / 4096 buffer. */
export const PROTOMAPS_TILE_BUFFER: number = 64 / 4096;

const EPS = 1 / 8192;

export type EdgeDecision =
  | { mode: 'whole' }
  | { mode: 'clipped'; polygon: TerrainSemanticPolygon; seamEdges: number[] }
  | { mode: 'skip' };

function hasEdgeOnLine(ring: readonly TerrainSemanticPoint[], axis: 0 | 1, value: number): boolean {
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as TerrainSemanticPoint;
    const b = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
    if (Math.abs(a[axis] - value) < EPS && Math.abs(b[axis] - value) < EPS) return true;
  }
  return false;
}

function seamEdgesOf(ring: readonly TerrainSemanticPoint[]): number[] {
  const seams: number[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as TerrainSemanticPoint;
    const b = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
    const onSide =
      (Math.abs(a[0]) < EPS && Math.abs(b[0]) < EPS) ||
      (Math.abs(a[0] - 1) < EPS && Math.abs(b[0] - 1) < EPS) ||
      (Math.abs(a[1]) < EPS && Math.abs(b[1]) < EPS) ||
      (Math.abs(a[1] - 1) < EPS && Math.abs(b[1] - 1) < EPS);
    if (onSide) seams.push(index);
  }
  return seams;
}

/** Decide whether this tile renders a footprint whole, clipped to the unit square, or not at all. */
export function analyzeTileEdge(polygon: TerrainSemanticPolygon, buffer: number): EdgeDecision {
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  if (maxU <= 0 || minU >= 1 || maxV <= 0 || minV >= 1) return { mode: 'skip' };
  const sides: Array<{
    axis: 0 | 1;
    crossing: boolean;
    dOut: number;
    dIn: number;
    clipLine: number;
    neighbourLower: boolean;
  }> = [
    {
      axis: 0,
      crossing: minU < -EPS,
      dOut: -minU,
      dIn: Math.min(maxU, 1),
      clipLine: -buffer,
      neighbourLower: true,
    },
    {
      axis: 0,
      crossing: maxU > 1 + EPS,
      dOut: maxU - 1,
      dIn: 1 - Math.max(minU, 0),
      clipLine: 1 + buffer,
      neighbourLower: false,
    },
    {
      axis: 1,
      crossing: minV < -EPS,
      dOut: -minV,
      dIn: Math.min(maxV, 1),
      clipLine: -buffer,
      neighbourLower: true,
    },
    {
      axis: 1,
      crossing: maxV > 1 + EPS,
      dOut: maxV - 1,
      dIn: 1 - Math.max(minV, 0),
      clipLine: 1 + buffer,
      neighbourLower: false,
    },
  ];
  let clipped = false;
  for (const side of sides) {
    const onClipLine = hasEdgeOnLine(polygon.outer, side.axis, side.clipLine);
    if (!side.crossing && !onClipLine) continue;
    if (onClipLine) {
      if (side.dIn < buffer - EPS) return { mode: 'skip' };
      clipped = true;
      continue;
    }
    if (side.dIn > side.dOut + EPS) continue;
    if (side.dIn < side.dOut - EPS) return { mode: 'skip' };
    if (side.neighbourLower) return { mode: 'skip' };
  }
  if (!clipped) return { mode: 'whole' };
  const outer = clipRingToRect(polygon.outer, [0, 0, 1, 1]);
  if (outer.length < 3) return { mode: 'skip' };
  const holes = (polygon.holes ?? [])
    .map((hole) => clipRingToRect(hole, [0, 0, 1, 1]))
    .filter((hole) => hole.length >= 3);
  return {
    mode: 'clipped',
    polygon: { outer, ...(holes.length > 0 ? { holes } : {}) },
    seamEdges: seamEdgesOf(outer),
  };
}

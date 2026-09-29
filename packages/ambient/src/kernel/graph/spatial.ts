/**
 * A uniform-grid index over edge spans: which pieces of which edges lie in each 64 m cell, and
 * how many lane-metres of each class a cell holds. Spawners draw candidate positions from it and
 * size their targets by the lane-kilometres near the observer.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { lineSegmentIndex } from '@bendyline/molen-terrain/kernel';
import type { TransportClass, TransportEdge } from './types';

export const GRID_CELL = 64;

export interface EdgeSpan {
  readonly edge: string;
  /** Edge-path distances bounding the span. */
  readonly d0: number;
  readonly d1: number;
  /** Midpoint, for distance tests. */
  readonly x: number;
  readonly z: number;
}

interface Cell {
  spans: EdgeSpan[];
  meters: Record<TransportClass, number>;
}

const CLASSES: readonly TransportClass[] = ['road', 'rail', 'walk', 'air'];

export class LaneGrid {
  private readonly cells = new Map<string, Cell>();
  private readonly edgeCells = new Map<
    string,
    { key: string; meters: Record<TransportClass, number> }[]
  >();
  /** Bumped on every change; lets callers cache derived sums. */
  version = 0;

  insert(edge: TransportEdge, laneCounts: Readonly<Record<TransportClass, number>>): void {
    this.remove(edge.id);
    const path = edge.path;
    const pieces = dmath.max(1, dmath.ceil(path.length / (GRID_CELL / 2)));
    const step = path.length / pieces;
    const touched: { key: string; meters: Record<TransportClass, number> }[] = [];
    for (let i = 0; i < pieces; i++) {
      const d0 = i * step;
      const d1 = i === pieces - 1 ? path.length : (i + 1) * step;
      const mid = (d0 + d1) / 2;
      const k = lineSegmentIndex(path, mid);
      const a = path.points[k] as [number, number];
      const b = (path.points[k + 1] ?? a) as [number, number];
      const s0 = path.distances[k] as number;
      const s1 = (path.distances[k + 1] ?? s0) as number;
      const t = s1 > s0 ? (mid - s0) / (s1 - s0) : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const key = `${dmath.floor(x / GRID_CELL)}/${dmath.floor(z / GRID_CELL)}`;
      let cell = this.cells.get(key);
      if (cell === undefined) {
        cell = { spans: [], meters: { road: 0, rail: 0, walk: 0, air: 0 } };
        this.cells.set(key, cell);
      }
      cell.spans.push({ edge: edge.id, d0, d1, x, z });
      const meters = { road: 0, rail: 0, walk: 0, air: 0 };
      for (const cls of CLASSES) {
        const m = (d1 - d0) * laneCounts[cls];
        cell.meters[cls] += m;
        meters[cls] = m;
      }
      touched.push({ key, meters });
    }
    this.edgeCells.set(edge.id, touched);
    this.version++;
  }

  remove(edgeId: string): void {
    const touched = this.edgeCells.get(edgeId);
    if (touched === undefined) return;
    for (const { key, meters } of touched) {
      const cell = this.cells.get(key);
      if (cell === undefined) continue;
      cell.spans = cell.spans.filter((span) => span.edge !== edgeId);
      for (const cls of CLASSES) cell.meters[cls] = dmath.max(0, cell.meters[cls] - meters[cls]);
      if (cell.spans.length === 0) this.cells.delete(key);
    }
    this.edgeCells.delete(edgeId);
    this.version++;
  }

  /** Visit cells overlapping the disc of radius `r`, in a deterministic order. */
  private *cellsNear(x: number, z: number, r: number): Generator<Cell> {
    const x0 = dmath.floor((x - r) / GRID_CELL);
    const x1 = dmath.floor((x + r) / GRID_CELL);
    const z0 = dmath.floor((z - r) / GRID_CELL);
    const z1 = dmath.floor((z + r) / GRID_CELL);
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(`${cx}/${cz}`);
        if (cell === undefined) continue;
        // Nearest point of the cell to the centre.
        const nx = dmath.clamp(x, cx * GRID_CELL, (cx + 1) * GRID_CELL);
        const nz = dmath.clamp(z, cz * GRID_CELL, (cz + 1) * GRID_CELL);
        if (dmath.hypot(nx - x, nz - z) > r) continue;
        yield cell;
      }
  }

  /** Lane-metres of a class in cells overlapping the disc. */
  laneMeters(x: number, z: number, r: number, cls: TransportClass): number {
    let total = 0;
    for (const cell of this.cellsNear(x, z, r)) total += cell.meters[cls];
    return total;
  }

  /** Spans whose midpoint lies in the annulus [rMin, rMax]. */
  spansWithin(x: number, z: number, rMin: number, rMax: number): EdgeSpan[] {
    const out: EdgeSpan[] = [];
    for (const cell of this.cellsNear(x, z, rMax))
      for (const span of cell.spans) {
        const d = dmath.hypot(span.x - x, span.z - z);
        if (d >= rMin && d <= rMax) out.push(span);
      }
    return out;
  }

  /** Distinct edge ids with a span within `r` (span midpoints, padded by half a span). */
  edgesNear(x: number, z: number, r: number): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const cell of this.cellsNear(x, z, r + GRID_CELL / 2))
      for (const span of cell.spans) {
        if (seen.has(span.edge)) continue;
        if (dmath.hypot(span.x - x, span.z - z) > r + (span.d1 - span.d0) / 2 + 1) continue;
        seen.add(span.edge);
        out.push(span.edge);
      }
    return out;
  }

  clear(): void {
    this.cells.clear();
    this.edgeCells.clear();
    this.version++;
  }
}

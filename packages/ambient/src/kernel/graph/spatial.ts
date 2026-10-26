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

const CLASSES: readonly TransportClass[] = ['road', 'rail', 'walk', 'air', 'water'];

export class LaneGrid {
  /** Rows by cell z, then cells by cell x: integer keys, no string per probed cell. */
  private readonly rows = new Map<number, Map<number, Cell>>();
  private cellCount = 0;
  private readonly edgeCells = new Map<
    string,
    { cx: number; cz: number; meters: Record<TransportClass, number> }[]
  >();
  /** Bumped on every change; lets callers cache derived sums. */
  version = 0;

  insert(edge: TransportEdge, laneCounts: Readonly<Record<TransportClass, number>>): void {
    this.remove(edge.id);
    const path = edge.path;
    const pieces = dmath.max(1, dmath.ceil(path.length / (GRID_CELL / 2)));
    const step = path.length / pieces;
    const touched: { cx: number; cz: number; meters: Record<TransportClass, number> }[] = [];
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
      const cx = dmath.floor(x / GRID_CELL);
      const cz = dmath.floor(z / GRID_CELL);
      let row = this.rows.get(cz);
      if (row === undefined) {
        row = new Map();
        this.rows.set(cz, row);
      }
      let cell = row.get(cx);
      if (cell === undefined) {
        cell = { spans: [], meters: { road: 0, rail: 0, walk: 0, air: 0, water: 0 } };
        row.set(cx, cell);
        this.cellCount++;
      }
      cell.spans.push({ edge: edge.id, d0, d1, x, z });
      const meters = { road: 0, rail: 0, walk: 0, air: 0, water: 0 };
      for (const cls of CLASSES) {
        const m = (d1 - d0) * laneCounts[cls];
        cell.meters[cls] += m;
        meters[cls] = m;
      }
      touched.push({ cx, cz, meters });
    }
    this.edgeCells.set(edge.id, touched);
    this.version++;
  }

  remove(edgeId: string): void {
    const touched = this.edgeCells.get(edgeId);
    if (touched === undefined) return;
    for (const { cx, cz, meters } of touched) {
      const row = this.rows.get(cz);
      const cell = row?.get(cx);
      if (row === undefined || cell === undefined) continue;
      cell.spans = cell.spans.filter((span) => span.edge !== edgeId);
      for (const cls of CLASSES) cell.meters[cls] = dmath.max(0, cell.meters[cls] - meters[cls]);
      if (cell.spans.length === 0) {
        row.delete(cx);
        this.cellCount--;
        if (row.size === 0) this.rows.delete(cz);
      }
    }
    this.edgeCells.delete(edgeId);
    this.version++;
  }

  /**
   * Cells overlapping the disc of radius `r`, in row-major order (z, then x, ascending). A train
   * or boat ring spans thousands of mostly empty cells: probing each one cost a fast flight
   * several milliseconds per spawner run, so a disc larger than the populated grid walks the
   * populated cells instead and sorts the matches into the same order.
   */
  private cellsNear(x: number, z: number, r: number): Cell[] {
    const x0 = dmath.floor((x - r) / GRID_CELL);
    const x1 = dmath.floor((x + r) / GRID_CELL);
    const z0 = dmath.floor((z - r) / GRID_CELL);
    const z1 = dmath.floor((z + r) / GRID_CELL);
    const within = (cx: number, cz: number): boolean => {
      // Nearest point of the cell to the centre.
      const nx = dmath.clamp(x, cx * GRID_CELL, (cx + 1) * GRID_CELL);
      const nz = dmath.clamp(z, cz * GRID_CELL, (cz + 1) * GRID_CELL);
      return dmath.hypot(nx - x, nz - z) <= r;
    };
    const out: Cell[] = [];
    if ((x1 - x0 + 1) * (z1 - z0 + 1) <= this.cellCount) {
      for (let cz = z0; cz <= z1; cz++) {
        const row = this.rows.get(cz);
        if (row === undefined) continue;
        for (let cx = x0; cx <= x1; cx++) {
          const cell = row.get(cx);
          if (cell !== undefined && within(cx, cz)) out.push(cell);
        }
      }
      return out;
    }
    const found: { cx: number; cz: number; cell: Cell }[] = [];
    for (const [cz, row] of this.rows) {
      if (cz < z0 || cz > z1) continue;
      for (const [cx, cell] of row)
        if (cx >= x0 && cx <= x1 && within(cx, cz)) found.push({ cx, cz, cell });
    }
    found.sort((a, b) => a.cz - b.cz || a.cx - b.cx);
    for (const entry of found) out.push(entry.cell);
    return out;
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
    this.rows.clear();
    this.cellCount = 0;
    this.edgeCells.clear();
    this.version++;
  }
}

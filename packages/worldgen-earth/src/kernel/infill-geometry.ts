import { dmath } from '@bendyline/molen-kernel/determinism';
import { pointInPolygon, type TerrainSemanticPolygon } from '@bendyline/molen-terrain/kernel';
import type { Vec2 } from '@bendyline/molen-worldgen/kernel';
export type Bounds = [number, number, number, number];
/** Cell key stride: rows stay far below it for any tile infill accepts. */
const CELL_COLUMN = 0x100000;
/**
 * Values in 100 m cells. A query lists each value once, in the order its cells are visited (by
 * column, then row) and added. Cells are numbers and values ids: a lot's 240 m neighborhood
 * visits up to 36 cells, and string keys with a Set per query were a tenth of a town tile's work.
 */
export class InfillBins<T> {
  private readonly cells = new Map<number, number[]>();
  private readonly values: T[] = [];
  private readonly ids = new Map<T, number>();
  /** The query that last listed each value. */
  private readonly listed: number[] = [];
  private queries = 0;
  constructor(private readonly extent: number) {}
  add(value: T, bounds: Bounds): void {
    let id = this.ids.get(value);
    if (id === undefined) {
      id = this.values.length;
      this.ids.set(value, id);
      this.values.push(value);
      this.listed.push(0);
    }
    const [x0, x1, z0, z1] = this.range(bounds);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const cell = this.cells.get(x * CELL_COLUMN + z);
        if (cell === undefined) this.cells.set(x * CELL_COLUMN + z, [id]);
        else cell.push(id);
      }
  }
  query(bounds: Bounds): T[] {
    const query = ++this.queries;
    const values: T[] = [];
    const [x0, x1, z0, z1] = this.range(bounds);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const cell = this.cells.get(x * CELL_COLUMN + z);
        if (cell === undefined) continue;
        for (const id of cell) {
          if (this.listed[id] === query) continue;
          this.listed[id] = query;
          values.push(this.values[id] as T);
        }
      }
    return values;
  }
  private range(bounds: Bounds): [number, number, number, number] {
    return [
      Math.floor(Math.max(-300, bounds[0]) / 100),
      Math.floor(Math.min(this.extent + 300, bounds[2]) / 100),
      Math.floor(Math.max(-300, bounds[1]) / 100),
      Math.floor(Math.min(this.extent + 300, bounds[3]) / 100),
    ];
  }
}
export function around(x: number, z: number, r: number): Bounds {
  return [x - r, z - r, x + r, z + r];
}
export function distance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return dmath.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function cross(a: Vec2, b: Vec2, p: Vec2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}
/**
 * The proximity tests below first compare bounds, and answer "not near" only when the bounds are
 * apart by this much more than the padding asked for, so rounding in a computed distance can
 * never change an answer the full test would give. Most of what a lot is tested against (the
 * mapped footprints, land and roads in its cells) is nowhere near it. A caller testing many lots
 * against the same large polygon passes its extent, computed once (a cache keyed by polygon
 * object filled a WeakMap with every lot's parcel and slowed the collector more than it saved).
 */
const APART_MARGIN = 1e-6;
/** Bounds of every ring of a polygon, holes included. */
export function polygonExtent(polygon: TerrainSemanticPolygon): Bounds {
  const box: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
    for (const p of ring) {
      if (p[0] < box[0]) box[0] = p[0];
      if (p[1] < box[1]) box[1] = p[1];
      if (p[0] > box[2]) box[2] = p[0];
      if (p[1] > box[3]) box[3] = p[1];
    }
  return box;
}
/** Whether two bounds are certainly more than `gap` apart. */
function apart(a: Bounds, b: Bounds, gap: number): boolean {
  const g = gap + APART_MARGIN;
  return a[2] + g < b[0] || b[2] + g < a[0] || a[3] + g < b[1] || b[3] + g < a[1];
}
function segmentExtent(a: Vec2, b: Vec2): Bounds {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
/** `segmentDistance(a, b, c, d) < limit`, skipping the distance for segments far apart. */
export function segmentsWithin(a: Vec2, b: Vec2, c: Vec2, d: Vec2, limit: number): boolean {
  return (
    !apart(segmentExtent(a, b), segmentExtent(c, d), limit) && segmentDistance(a, b, c, d) < limit
  );
}
/** Whether segment a-b comes within `padding` of the polygon (or lies in it). */
export function lineNearPolygon(
  a: Vec2,
  b: Vec2,
  polygon: TerrainSemanticPolygon,
  padding: number,
  extent: Bounds = polygonExtent(polygon),
): boolean {
  if (apart(segmentExtent(a, b), extent, padding)) return false;
  if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon)) return true;
  return [polygon.outer, ...(polygon.holes ?? [])].some((r) =>
    r.some((p, i) => segmentDistance(a, b, p, r[(i + 1) % r.length] as Vec2) <= padding),
  );
}
/** Whether two polygons come within `padding` of each other; `bExtent` is b's polygonExtent. */
export function polygonsNear(
  a: TerrainSemanticPolygon,
  b: TerrainSemanticPolygon,
  padding = 0,
  bExtent: Bounds = polygonExtent(b),
): boolean {
  if (apart(polygonExtent(a), bExtent, padding)) return false;
  if (a.outer.some((p) => pointInPolygon(p, b)) || b.outer.some((p) => pointInPolygon(p, a)))
    return true;
  return [a.outer, ...(a.holes ?? [])].some((r) =>
    r.some((p, i) => lineNearPolygon(p, r[(i + 1) % r.length] as Vec2, b, padding, bExtent)),
  );
}
export function corridor(a: Vec2, b: Vec2, width: number): TerrainSemanticPolygon {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = dmath.hypot(dx, dz) || 1,
    nx = ((-dz / length) * width) / 2,
    nz = ((dx / length) * width) / 2;
  return {
    outer: [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz],
    ],
  };
}

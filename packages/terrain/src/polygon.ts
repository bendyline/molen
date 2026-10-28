/**
 * Polygon predicates over normalized `[u, v]` semantic geometry. Shared by the default semantic
 * renderer and by adapters that turn semantic tiles into other representations. Pure arithmetic
 * (no transcendental math), so kernel-half code may use it.
 */

import type {
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticRing,
} from './semantic-types';

export type TerrainSemanticBounds = [minU: number, minV: number, maxU: number, maxV: number];

/** Twice-signed shoelace area halved; positive when the ring winds +u then +v. */
export function ringSignedArea(ring: readonly TerrainSemanticPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index++) {
    const point = ring[index] as TerrainSemanticPoint;
    const next = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
    twiceArea += point[0] * next[1] - next[0] * point[1];
  }
  return twiceArea / 2;
}

export function ringArea(ring: readonly TerrainSemanticPoint[]): number {
  return Math.abs(ringSignedArea(ring));
}

/**
 * Normalized-area floor below which a ring encloses nothing a triangulator can use. Tile-local
 * `[u, v]` units, so this is ~1e-6 of a tile edge squared — far below any mapped real feature at
 * any zoom, and above the float noise of a collinear ring.
 */
export const DEGENERATE_RING_AREA: number = 1e-12;

/**
 * A ring that cannot bound a face: fewer than three distinct vertices, or an enclosed area below
 * {@link DEGENERATE_RING_AREA} (collinear or repeated points). Triangulators — three.js earcut
 * among them — fault or emit nothing for these, so contract validation and mesh adapters share
 * this one definition.
 */
export function isDegenerateRing(ring: readonly TerrainSemanticPoint[]): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return true;
  const distinct: TerrainSemanticPoint[] = [];
  for (const point of ring) {
    if (distinct.some((seen) => seen[0] === point[0] && seen[1] === point[1])) continue;
    distinct.push(point);
    if (distinct.length >= 3) break;
  }
  if (distinct.length < 3) return true;
  return Math.abs(ringSignedArea(ring)) <= DEGENERATE_RING_AREA;
}

/** Drop a repeated closing vertex and consecutive duplicates. */
export function normalizeRing(ring: TerrainSemanticRing): TerrainSemanticRing {
  const result: TerrainSemanticRing = [];
  for (const point of ring) {
    const last = result.at(-1);
    if (last !== undefined && last[0] === point[0] && last[1] === point[1]) continue;
    result.push(point);
  }
  const first = result[0];
  const last = result.at(-1);
  if (result.length > 3 && first !== undefined && last !== undefined) {
    if (first[0] === last[0] && first[1] === last[1]) result.pop();
  }
  return result;
}

/** Even-odd containment test against one ring. */
export function pointInRing(
  point: TerrainSemanticPoint,
  ring: readonly TerrainSemanticPoint[],
): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index] as TerrainSemanticPoint;
    const previousPoint = ring[previous] as TerrainSemanticPoint;
    if (
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygon(
  point: TerrainSemanticPoint,
  polygon: TerrainSemanticPolygon,
): boolean {
  if (!pointInRing(point, polygon.outer)) return false;
  return !(polygon.holes ?? []).some((hole) => pointInRing(point, hole));
}

/** Outer area minus hole areas, never negative. */
export function polygonArea(polygon: TerrainSemanticPolygon): number {
  return Math.max(
    0,
    ringArea(polygon.outer) - (polygon.holes ?? []).reduce((sum, hole) => sum + ringArea(hole), 0),
  );
}

/** Unclamped bounds of the outer ring (buffered geometry may exceed [0, 1]). */
export function polygonBounds(polygon: TerrainSemanticPolygon): TerrainSemanticBounds {
  let minU = Number.POSITIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (const point of polygon.outer) {
    minU = Math.min(minU, point[0]);
    minV = Math.min(minV, point[1]);
    maxU = Math.max(maxU, point[0]);
    maxV = Math.max(maxV, point[1]);
  }
  return [minU, minV, maxU, maxV];
}

/** Clamp bounds into `[lo, hi]` on both axes. */
export function clampBounds(bounds: TerrainSemanticBounds, lo = 0, hi = 1): TerrainSemanticBounds {
  return [
    Math.max(lo, bounds[0]),
    Math.max(lo, bounds[1]),
    Math.min(hi, bounds[2]),
    Math.min(hi, bounds[3]),
  ];
}

/**
 * A triangulation's triangles merged into convex pieces (Hertel-Mehlhorn: each shared edge goes
 * when the piece it leaves is still convex at both its ends), as cycles of point indices wound
 * like the triangles. The pieces cover exactly the triangles' area, in at most four times the
 * fewest convex pieces. Zero-area triangles are left out.
 */
export function convexTrianglePieces(
  points: readonly (readonly [number, number])[],
  triangles: readonly (readonly [number, number, number])[],
): number[][] {
  const turn = (a: number, b: number, c: number): number => {
    const p = points[a] as readonly [number, number],
      q = points[b] as readonly [number, number],
      r = points[c] as readonly [number, number];
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  };
  const pieces: (number[] | undefined)[] = [];
  let winding = 0;
  for (const [a, b, c] of triangles) {
    const area = turn(a, b, c);
    if (area === 0) continue;
    winding ||= Math.sign(area);
    pieces.push([a, b, c]);
  }
  // Which piece each triangle now belongs to (union-find over merges).
  const parent = pieces.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    while (parent[i] !== r) {
      const next = parent[i] as number;
      parent[i] = r;
      i = next;
    }
    return r;
  };
  // Edges two triangles share, each once, in triangle order, as (a, b, first owner, second
  // owner) runs in one flat list. String keys, and a new array for every merge tried, made a large
  // river's merge twice as slow.
  const count = points.length;
  const owners = new Map<number, number>();
  const shared: number[] = [];
  for (const [t, piece] of pieces.entries())
    for (let k = 0; k < 3; k++) {
      const a = (piece as number[])[k] as number,
        b = (piece as number[])[(k + 1) % 3] as number;
      const key = a < b ? a * count + b : b * count + a;
      const other = owners.get(key);
      if (other === undefined) owners.set(key, t);
      else shared.push(a, b, other, t);
    }
  const convexAt = (prev: number, at: number, next: number): boolean =>
    turn(prev, at, next) * winding >= 0;
  for (let s = 0; s < shared.length; s += 4) {
    const a = shared[s] as number,
      b = shared[s + 1] as number;
    const i = root(shared[s + 2] as number),
      j = root(shared[s + 3] as number);
    if (i === j) continue;
    const p = pieces[i] as number[],
      q = pieces[j] as number[];
    const m = p.length,
      n = q.length;
    // p runs u -> v along the edge, q runs v -> u (the same winding on both sides).
    let at = -1;
    for (let k = 0; k < m && at < 0; k++) {
      const v = p[k],
        w = p[(k + 1) % m];
      if ((v === a && w === b) || (v === b && w === a)) at = k;
    }
    if (at < 0) continue;
    const u = p[at] as number,
      v = p[(at + 1) % m] as number;
    let back = -1;
    for (let k = 0; k < n && back < 0; k++) if (q[k] === v && q[(k + 1) % n] === u) back = k;
    if (back < 0) continue;
    // Checked before merging: in the merged piece, u goes on to q's corner after the edge and v
    // comes from q's corner before it. q's other corners then go between u and v, in place.
    if (
      !convexAt(p[(at + m - 1) % m] as number, u, q[(back + 2) % n] as number) ||
      !convexAt(q[(back + n - 1) % n] as number, v, p[(at + 2) % m] as number)
    )
      continue;
    const between: number[] = [];
    for (let k = 2; k < n; k++) between.push(q[(back + k) % n] as number);
    p.splice(at + 1, 0, ...between);
    pieces[j] = undefined;
    parent[j] = i;
  }
  return pieces.filter((piece): piece is number[] => piece !== undefined);
}

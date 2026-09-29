/**
 * Pure, three-free metric line paths: convert normalized tile lines to metres, join fragments,
 * and sample by arc length with mitred lateral offsets. Shared by the surface painter (client)
 * and kernel-side consumers such as transport graphs.
 *
 * A positive `offset` in {@link sampleTerrainLine} lies on the right-hand side of travel in the
 * +X east / +Z south frame (the offset normal is `[-dz, dx]`).
 */
import type { TerrainSemanticLine, TerrainSemanticPoint } from './semantic-types';

export interface TerrainLinePath {
  points: TerrainSemanticPoint[];
  distances: number[];
  length: number;
}

export interface TerrainLineSample {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

/** Convert normalized tile geometry once; collapse duplicate vertices. */
export function terrainLinePath(line: TerrainSemanticLine, tileSize: number): TerrainLinePath {
  const points: TerrainSemanticPoint[] = [];
  const distances: number[] = [];
  let length = 0;
  for (const point of line) {
    if (
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      !Number.isFinite(tileSize) ||
      tileSize <= 0
    )
      throw new Error('Line coordinates and tile size must be finite; size positive');
    const p: TerrainSemanticPoint = [point[0] * tileSize, point[1] * tileSize];
    const previous = points.at(-1);
    const distance = previous ? Math.hypot(p[0] - previous[0], p[1] - previous[1]) : 0;
    if (previous && distance < 0.0001) continue;
    length += distance;
    points.push(p);
    distances.push(length);
  }
  return { points, distances, length };
}

/** Join degree-two source fragments so profiles and dash phases continue through tile features. */
export function joinTerrainLines(lines: readonly TerrainSemanticLine[]): TerrainSemanticLine[] {
  const ends = new Map<string, number[]>();
  const key = (p: TerrainSemanticPoint): string =>
    `${Math.round(p[0] * 1e7)}/${Math.round(p[1] * 1e7)}`;
  lines.forEach((line, i) => {
    if (line.length < 2) return;
    for (const p of [line[0], line.at(-1)] as TerrainSemanticPoint[]) {
      const k = key(p),
        list = ends.get(k) ?? [];
      list.push(i);
      ends.set(k, list);
    }
  });
  const used = new Set<number>();
  const result: TerrainSemanticLine[] = [];
  lines.forEach((line, i) => {
    if (used.has(i) || line.length < 2) return;
    used.add(i);
    const points = [...line];
    for (const front of [false, true]) {
      for (;;) {
        const p = (front ? points[0] : points.at(-1)) as TerrainSemanticPoint;
        const adjacent = ends.get(key(p));
        if (adjacent?.length !== 2) break;
        const next = adjacent.find((j) => !used.has(j));
        if (next === undefined) break;
        used.add(next);
        const other = [...(lines[next] as TerrainSemanticLine)];
        if ((key(other[0] as TerrainSemanticPoint) === key(p)) === front) other.reverse();
        if (front) points.unshift(...other.slice(0, -1));
        else points.push(...other.slice(1));
      }
    }
    result.push(points);
  });
  return result;
}

const pathJoins = new WeakMap<TerrainLinePath, TerrainSemanticPoint[]>();
function lineJoins(path: TerrainLinePath): TerrainSemanticPoint[] {
  const cached = pathJoins.get(path);
  if (cached) return cached;
  const points = path.points;
  const last = points.length - 1;
  const closed =
    last > 1 &&
    Math.hypot(
      (points[0]?.[0] ?? 0) - (points[last]?.[0] ?? 0),
      (points[0]?.[1] ?? 0) - (points[last]?.[1] ?? 0),
    ) < 0.0001;
  const joins = points.map((p, i): TerrainSemanticPoint => {
    const previous = points[i - 1] ?? (closed ? points[last - 1] : undefined);
    const next = points[i + 1] ?? (closed ? points[1] : undefined);
    const direction = (a: TerrainSemanticPoint, b: TerrainSemanticPoint): TerrainSemanticPoint => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    };
    const incoming = previous ? direction(previous, p) : direction(p, next ?? p);
    const outgoing = next ? direction(p, next) : incoming;
    const divisor = Math.max(0.5, 1 + incoming[0] * outgoing[0] + incoming[1] * outgoing[1]);
    return [(-incoming[1] - outgoing[1]) / divisor, (incoming[0] + outgoing[0]) / divisor];
  });
  pathJoins.set(path, joins);
  return joins;
}

/** Sample a path by arc length; offset edges interpolate shared, bounded miter joins.
 * Closed paths use the same join at both ends, avoiding a wedge at the closure. */
export function sampleTerrainLine(
  path: TerrainLinePath,
  distance: number,
  offset = 0,
): TerrainLineSample {
  let low = 0;
  let high = path.distances.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if ((path.distances[middle] ?? 0) <= distance) low = middle;
    else high = middle;
  }
  const a = path.points[low] ?? [0, 0];
  const b = path.points[low + 1] ?? a;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  const t = Math.max(0, Math.min(1, (distance - (path.distances[low] ?? 0)) / length));
  const joins = lineJoins(path);
  const start = joins[low] ?? [-dz, dx];
  const finish = joins[low + 1] ?? start;
  const nx = start[0] + (finish[0] - start[0]) * t;
  const nz = start[1] + (finish[1] - start[1]) * t;
  return {
    x: a[0] + (b[0] - a[0]) * t + nx * offset,
    z: a[1] + (b[1] - a[1]) * t + nz * offset,
    dx,
    dz,
  };
}

/** Index of the segment `[i, i + 1]` containing `distance` (clamped to the path). */
export function lineSegmentIndex(path: TerrainLinePath, distance: number): number {
  let low = 0;
  let high = path.distances.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if ((path.distances[middle] ?? 0) <= distance) low = middle;
    else high = middle;
  }
  return low;
}

/** Axis-aligned bounds `[minX, minZ, maxX, maxZ]` of a path's vertices. */
export function pathBounds(path: TerrainLinePath): [number, number, number, number] {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of path.points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

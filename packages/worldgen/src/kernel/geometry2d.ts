/**
 * 2D polygon helpers in local meters. Rings are open (no repeated closing vertex). The canonical
 * orientation of an outer ring has positive `ringSignedArea`; holes are negative. With that
 * convention the outward normal of edge `d = b - a` is `(d.z, -d.x) / |d|`.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { Vec2 } from './types';

export type Bounds2 = [minX: number, minZ: number, maxX: number, maxZ: number];

export function ringSignedArea(ring: readonly Vec2[]): number {
  let twice = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as Vec2;
    const b = ring[(index + 1) % ring.length] as Vec2;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return twice / 2;
}

export function ringArea(ring: readonly Vec2[]): number {
  return Math.abs(ringSignedArea(ring));
}

export function ringPerimeter(ring: readonly Vec2[]): number {
  let length = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as Vec2;
    const b = ring[(index + 1) % ring.length] as Vec2;
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

export function ringCentroid(ring: readonly Vec2[]): Vec2 {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as Vec2;
    const b = ring[(index + 1) % ring.length] as Vec2;
    const factor = a[0] * b[1] - b[0] * a[1];
    area += factor;
    cx += (a[0] + b[0]) * factor;
    cz += (a[1] + b[1]) * factor;
  }
  if (Math.abs(area) < 1e-12) {
    let sx = 0;
    let sz = 0;
    for (const point of ring) {
      sx += point[0];
      sz += point[1];
    }
    return [sx / Math.max(1, ring.length), sz / Math.max(1, ring.length)];
  }
  return [cx / (3 * area), cz / (3 * area)];
}

export function ringBounds(ring: readonly Vec2[]): Bounds2 {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    minX = Math.min(minX, point[0]);
    minZ = Math.min(minZ, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxZ = Math.max(maxZ, point[1]);
  }
  return [minX, minZ, maxX, maxZ];
}

/** Even-odd containment test. */
export function pointInRing(point: Vec2, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index] as Vec2;
    const before = ring[previous] as Vec2;
    if (
      current[1] > point[1] !== before[1] > point[1] &&
      point[0] <
        ((before[0] - current[0]) * (point[1] - current[1])) / (before[1] - current[1]) + current[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(
  point: Vec2,
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[] = [],
): boolean {
  if (!pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

/** Do any edge of `a` and any edge of `b` touch or cross? O(n*m); rings are small. */
export function ringsIntersect(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i] as Vec2;
    const a1 = a[(i + 1) % a.length] as Vec2;
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j] as Vec2;
      const b1 = b[(j + 1) % b.length] as Vec2;
      if (segmentsIntersect(a0, a1, b0, b1)) return true;
    }
  }
  return false;
}

/**
 * Is `inner` strictly inside `outer` — every vertex inside, and no edge touching or crossing the
 * boundary? A ring that shares an edge or a single point with `outer` is deliberately NOT
 * strictly inside: triangulation and wall building both need clearance from the outline.
 */
export function ringStrictlyInside(inner: readonly Vec2[], outer: readonly Vec2[]): boolean {
  if (inner.length < 3 || outer.length < 3) return false;
  for (const point of inner) {
    if (!pointInRing(point, outer)) return false;
  }
  return !ringsIntersect(inner, outer);
}

/** Do two rings share any area — crossing edges, or one ring containing the other? */
export function ringsOverlap(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (ringsIntersect(a, b)) return true;
  // No crossings: the rings are either disjoint or nested, and one vertex each decides which.
  return pointInRing(a[0] as Vec2, b) || pointInRing(b[0] as Vec2, a);
}

/** Copy of the ring with the requested orientation (`positive` = outer convention). */
export function ensureOrientation(ring: readonly Vec2[], positive: boolean): Vec2[] {
  const copy = ring.map((point): Vec2 => [point[0], point[1]]);
  const signed = ringSignedArea(copy);
  if (signed > 0 !== positive) copy.reverse();
  return copy;
}

/** Perpendicular distance from `p` to segment `ab`. */
export function distancePointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  let t = lengthSquared > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}

/** Distance from a point to the nearest edge of a ring. */
export function distancePointToRing(p: Vec2, ring: readonly Vec2[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as Vec2;
    const b = ring[(index + 1) % ring.length] as Vec2;
    best = Math.min(best, distancePointToSegment(p, a, b));
  }
  return best;
}

/**
 * Drop the closing duplicate, near-duplicate vertices, and collinear vertices. `collinear` is the
 * maximum perpendicular deviation (meters) a vertex may have from the chord of its neighbours.
 */
export function cleanRing(ring: readonly Vec2[], duplicate = 0.05, collinear = 0.05): Vec2[] {
  let points = ring.map((point): Vec2 => [point[0], point[1]]);
  const first = points[0];
  const last = points.at(-1);
  if (
    points.length > 1 &&
    first !== undefined &&
    last !== undefined &&
    Math.hypot(first[0] - last[0], first[1] - last[1]) <= duplicate
  ) {
    points.pop();
  }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const deduped: Vec2[] = [];
    for (let index = 0; index < points.length; index++) {
      const point = points[index] as Vec2;
      const previous = deduped.at(-1) ?? (points.at(-1) as Vec2);
      if (
        points.length > 3 &&
        Math.hypot(point[0] - previous[0], point[1] - previous[1]) <= duplicate
      ) {
        changed = true;
        continue;
      }
      deduped.push(point);
    }
    points = deduped;
    if (points.length < 3) return points;
    const kept: Vec2[] = [];
    for (let index = 0; index < points.length; index++) {
      const previous = points[(index + points.length - 1) % points.length] as Vec2;
      const point = points[index] as Vec2;
      const following = points[(index + 1) % points.length] as Vec2;
      const deviation = distancePointToSegment(point, previous, following);
      const e0x = point[0] - previous[0];
      const e0z = point[1] - previous[1];
      const e1x = following[0] - point[0];
      const e1z = following[1] - point[1];
      const cross = e0x * e1z - e0z * e1x;
      const dot = e0x * e1x + e0z * e1z;
      const lengths = Math.hypot(e0x, e0z) * Math.hypot(e1x, e1z);
      const nearlyStraight = lengths > 0 && dot > 0 && Math.abs(cross) / lengths < 0.017452;
      const remainingIfDropped = kept.length + (points.length - index - 1);
      if ((deviation <= collinear || nearlyStraight) && remainingIfDropped >= 3) {
        changed = true;
        continue;
      }
      kept.push(point);
    }
    points = kept;
    if (!changed) break;
  }
  return points;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return value > 1e-12 ? 1 : value < -1e-12 ? -1 : 0;
}

function onSegment(a: Vec2, b: Vec2, c: Vec2): boolean {
  return (
    Math.min(a[0], b[0]) - 1e-12 <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}

/** Do closed segments `ab` and `cd` intersect (including touching)? */
export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

/** True when no two non-adjacent edges intersect. O(n²); rings are small. */
export function isSimpleRing(ring: readonly Vec2[]): boolean {
  const count = ring.length;
  if (count < 3) return false;
  for (let i = 0; i < count; i++) {
    const a = ring[i] as Vec2;
    const b = ring[(i + 1) % count] as Vec2;
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      const c = ring[j] as Vec2;
      const d = ring[(j + 1) % count] as Vec2;
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/** Monotone chain convex hull; returns the hull in positive orientation. */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = points
    .map((point): Vec2 => [point[0], point[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2] as Vec2, lower[lower.length - 1] as Vec2, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Vec2[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index] as Vec2;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2] as Vec2, upper[upper.length - 1] as Vec2, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  return ringSignedArea(hull) < 0 ? hull.reverse() : hull;
}

export interface OrientedBox {
  /** Rotation of the box long axis, in radians. */
  angle: number;
  width: number;
  depth: number;
  center: Vec2;
}

/** Minimum-area bounding rectangle by rotating calipers over the convex hull edges. */
export function minAreaRectangle(points: readonly Vec2[]): OrientedBox {
  const hull = convexHull(points);
  if (hull.length < 3) {
    const bounds = ringBounds(points);
    return {
      angle: 0,
      width: bounds[2] - bounds[0],
      depth: bounds[3] - bounds[1],
      center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
    };
  }
  let best: OrientedBox | undefined;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let index = 0; index < hull.length; index++) {
    const a = hull[index] as Vec2;
    const b = hull[(index + 1) % hull.length] as Vec2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-9) continue;
    const c = dx / length;
    const s = dz / length;
    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const point of hull) {
      const u = c * point[0] + s * point[1];
      const v = -s * point[0] + c * point[1];
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const width = maxU - minU;
    const depth = maxV - minV;
    const area = width * depth;
    if (area < bestArea - 1e-9) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = {
        angle: dmath.atan2(s, c),
        width,
        depth,
        center: [c * cu - s * cv, s * cu + c * cv],
      };
    }
  }
  return best ?? { angle: 0, width: 0, depth: 0, center: [0, 0] };
}

/** Sutherland-Hodgman clip of a ring against an axis-aligned rectangle. */
export function clipRingToRect(ring: readonly Vec2[], rect: Bounds2): Vec2[] {
  let output = ring.map((point): Vec2 => [point[0], point[1]]);
  const edges: Array<{ inside: (p: Vec2) => boolean; cross: (a: Vec2, b: Vec2) => Vec2 }> = [
    {
      inside: (p) => p[0] >= rect[0],
      cross: (a, b) => [rect[0], a[1] + ((b[1] - a[1]) * (rect[0] - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[0] <= rect[2],
      cross: (a, b) => [rect[2], a[1] + ((b[1] - a[1]) * (rect[2] - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[1] >= rect[1],
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (rect[1] - a[1])) / (b[1] - a[1]), rect[1]],
    },
    {
      inside: (p) => p[1] <= rect[3],
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (rect[3] - a[1])) / (b[1] - a[1]), rect[3]],
    },
  ];
  for (const edge of edges) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    for (let index = 0; index < input.length; index++) {
      const current = input[index] as Vec2;
      const previous = input[(index + input.length - 1) % input.length] as Vec2;
      const currentInside = edge.inside(current);
      const previousInside = edge.inside(previous);
      if (currentInside) {
        if (!previousInside) output.push(edge.cross(previous, current));
        output.push(current);
      } else if (previousInside) {
        output.push(edge.cross(previous, current));
      }
    }
  }
  return output;
}

/**
 * Offset a ring along its outward normals by `distance` (negative insets). Mitered corners are
 * capped at four times the distance so acute corners cannot spike.
 */
export function offsetRing(ring: readonly Vec2[], distance: number): Vec2[] {
  const count = ring.length;
  const result: Vec2[] = [];
  for (let index = 0; index < count; index++) {
    const previous = ring[(index + count - 1) % count] as Vec2;
    const point = ring[index] as Vec2;
    const next = ring[(index + 1) % count] as Vec2;
    const e0x = point[0] - previous[0];
    const e0z = point[1] - previous[1];
    const e1x = next[0] - point[0];
    const e1z = next[1] - point[1];
    const l0 = Math.hypot(e0x, e0z) || 1;
    const l1 = Math.hypot(e1x, e1z) || 1;
    const n0: Vec2 = [e0z / l0, -e0x / l0];
    const n1: Vec2 = [e1z / l1, -e1x / l1];
    let bx = n0[0] + n1[0];
    let bz = n0[1] + n1[1];
    const bl = Math.hypot(bx, bz);
    if (bl < 1e-9) {
      bx = n1[0];
      bz = n1[1];
    } else {
      bx /= bl;
      bz /= bl;
    }
    const cosine = bx * n1[0] + bz * n1[1];
    const scale = Math.min(4, 1 / Math.max(0.25, cosine));
    result.push([point[0] + bx * distance * scale, point[1] + bz * distance * scale]);
  }
  return result;
}

/** Points from `a` to `b` inclusive, spaced at most `maxSpacing` apart. */
export function densifyEdge(a: Vec2, b: Vec2, maxSpacing: number): Vec2[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(length / Math.max(1e-6, maxSpacing)));
  const points: Vec2[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points;
}

/** Intersection rectangle of two bounds, or undefined when they do not overlap. */
export function intersectBounds(a: Bounds2, b: Bounds2): Bounds2 | undefined {
  const minX = Math.max(a[0], b[0]);
  const minZ = Math.max(a[1], b[1]);
  const maxX = Math.min(a[2], b[2]);
  const maxZ = Math.min(a[3], b[3]);
  if (maxX <= minX || maxZ <= minZ) return undefined;
  return [minX, minZ, maxX, maxZ];
}

/** Subtract source-defined convex apertures, then expose masonry jambs in the actual wall mass. */
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const EPS = 1e-7;
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
const value = (p, plane) => dot(p, plane.slice(0, 3)) + plane[3];
function clip(polygon, plane, positive = true) {
  if (polygon.length < 3) return [];
  const result = [],
    sign = positive ? 1 : -1;
  let a = polygon.at(-1),
    av = value(a, plane) * sign;
  for (const b of polygon) {
    const bv = value(b, plane) * sign;
    if (av >= -EPS !== bv >= -EPS) {
      const t = av / (av - bv);
      result.push(a.map((v, k) => v + (b[k] - v) * t));
    }
    if (bv >= -EPS) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function difference(polygon, planes) {
  const out = [];
  let inside = polygon;
  for (const plane of planes) {
    if (inside.some((p) => value(p, plane) < -EPS)) {
      const outside = clip(inside, plane, false);
      if (outside.length >= 3) out.push(outside);
    }
    inside = clip(inside, plane);
    if (inside.length < 3) break;
  }
  return out;
}
function emit(out, polygon, slot, ref, color, target) {
  if (polygon.length < 3) return;
  for (let i = 1; i < polygon.length - 1; i++) {
    const n = normalFor(polygon[0], polygon[i], polygon[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (dot(n, target) < 0) polygon = [...polygon].reverse();
    break;
  }
  for (let i = 1; i < polygon.length - 1; i++) {
    const p = [polygon[0], polygon[i], polygon[i + 1]].map((v) => v.map(Math.fround));
    const n = normalFor(...p);
    if (Math.hypot(...n) < 0.5) continue;
    // The caller's shared-surface adapter derives metric, face-aligned UVs.
    out.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((v) => [v[0], v[2]]),
      color,
    );
  }
}
/** Points run counterclockwise in aperture-local horizontal/vertical metres. */
export function openingShape(hole, detail = 3) {
  const w = hole.width / 2,
    bottom = hole.bottom ?? 0;
  if (hole.shape === 'pointed')
    return [
      [-w, bottom],
      [w, bottom],
      [w, bottom + hole.spring],
      [0, bottom + hole.height],
      [-w, bottom + hole.spring],
    ];
  if (hole.shape === 'round') {
    const n = detail <= 1 ? 4 : 8;
    return [
      [-w, bottom],
      [w, bottom],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = (i * Math.PI) / n;
        return [Math.cos(a) * w, bottom + hole.spring + Math.sin(a) * (hole.height - hole.spring)];
      }),
    ];
  }
  return [
    [-w, bottom],
    [w, bottom],
    [w, bottom + hole.height],
    [-w, bottom + hole.height],
  ];
}
export function prepareOpening(hole, baseY, detail = 3) {
  const length = Math.hypot(...hole.axis),
    axis = hole.axis.map((v) => v / length);
  const normal = [-axis[1], axis[0]],
    ring = openingShape(hole, detail);
  const local = (p) => [
    (p[0] - hole.center[0]) * axis[0] + (p[2] - hole.center[1]) * axis[1],
    p[1] - baseY,
    (p[0] - hole.center[0]) * normal[0] + (p[2] - hole.center[1]) * normal[1],
  ];
  const point = (u, v, n) => [
    hole.center[0] + axis[0] * u + normal[0] * n,
    baseY + v,
    hole.center[1] + axis[1] * u + normal[1] * n,
  ];
  const depth = hole.depth / 2,
    centerN = hole.center[0] * normal[0] + hole.center[1] * normal[1];
  const planes = [
    [normal[0], 0, normal[1], depth - centerN],
    [-normal[0], 0, -normal[1], depth + centerN],
  ];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    planes.push([
      -dv * axis[0],
      du,
      -dv * axis[1],
      dv * (hole.center[0] * axis[0] + hole.center[1] * axis[1] + a[0]) - du * (baseY + a[1]),
    ]);
  }
  return { ...hole, axis, normal, ring, planes, local, point };
}
export function openingBuilder(out, holes) {
  if (!holes.length) return out;
  return {
    addTriangle(slot, ref, points, normal, _uv, color) {
      let pieces = [points];
      for (const h of holes) pieces = pieces.flatMap((p) => difference(p, h.planes));
      for (const p of pieces) emit(out, p, slot, ref, color, normal);
    },
  };
}
function heightPlane(points, positiveY) {
  let n = normalFor(...points);
  if (n[1] > 0 !== positiveY) n = n.map((v) => -v);
  return [...n, -dot(n, points[0])];
}
/** Each reveal is intersected with the same triangulated, sloping footprint prism as the wall. */
export function openingReveals(out, ring, base, top, holes, color) {
  if (!holes.length) return;
  const indices = earcut(ring.flat(), null, 2);
  for (let k = 0; k < indices.length; k += 3) {
    const p = indices.slice(k, k + 3).map((i) => ring[i]);
    const sign = Math.sign(
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]),
    );
    const planes = p.map((a, i) => {
      const b = p[(i + 1) % 3],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      return [-dz * sign, 0, dx * sign, (dz * a[0] - dx * a[1]) * sign];
    });
    planes.push(
      heightPlane(
        p.map((q) => [q[0], base(q), q[1]]),
        true,
      ),
      heightPlane(
        p.map((q) => [q[0], top(q), q[1]]),
        false,
      ),
    );
    for (const h of holes)
      for (let j = 0; j < h.ring.length; j++) {
        const a = h.ring[j],
          b = h.ring[(j + 1) % h.ring.length],
          depth = h.depth / 2;
        let polygon = [
          h.point(...a, -depth),
          h.point(...b, -depth),
          h.point(...b, depth),
          h.point(...a, depth),
        ];
        for (const plane of planes) polygon = clip(polygon, plane);
        const du = b[0] - a[0],
          dv = b[1] - a[1];
        emit(out, polygon, 'rubble', 'palette:#ffffff', color, [
          -dv * h.axis[0],
          du,
          -dv * h.axis[1],
        ]);
      }
  }
}

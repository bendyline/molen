/** Meter-scale construction helpers for researched structure assets. No private dependencies. */
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff';
export const normalize = (v) => {
  const d = Math.hypot(...v) || 1;
  return v.map((n) => n / d);
};
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalFor = (a, b, c) =>
  normalize(
    cross(
      b.map((v, i) => v - a[i]),
      c.map((v, i) => v - a[i]),
    ),
  );

/** Loft matching convex rings; supplied order defines outward winding. */
export function loft(out, slot, rings, color, { cap = true } = {}) {
  for (let j = 1; j < rings.length; j++) {
    const previous = rings[j - 1],
      current = rings[j];
    if (current.length !== previous.length) throw new Error('Loft rings must have equal lengths');
    for (let i = 0; i < current.length; i++) {
      const k = (i + 1) % current.length;
      const points = [previous[i], previous[k], current[k], current[i]];
      quad(out, slot, points, normalFor(points[0], points[1], points[2]), color);
    }
  }
  if (!cap) return;
  for (const [ring, reverse] of [
    [rings[0], true],
    [rings.at(-1), false],
  ]) {
    const p = reverse ? [...ring].reverse() : ring;
    out.addConvexPolygon(slot, ref, p, normalFor(p[0], p[1], p[2]), (p) => [p[0], p[2]], color);
  }
}

/** Rectangular beam whose broad face is oriented using a stable reference vector. */
export function beam(out, slot, a, b, width, depth, color) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = cross(axis, across);
  const ring = (center) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) =>
      center.map((n, i) => n + (across[i] * u * width) / 2 + (other[i] * v * depth) / 2),
    );
  loft(out, slot, [ring(a), ring(b)], color);
}

export function sphere(out, slot, center, radii, color, segments = 32, latitudes = 16) {
  const point = (j, i) => {
    const t = -Math.PI / 2 + (Math.PI * j) / latitudes;
    const a = (-i / segments) * Math.PI * 2;
    return [
      center[0] + Math.cos(t) * Math.cos(a) * radii[0],
      center[1] + Math.sin(t) * radii[1],
      center[2] + Math.cos(t) * Math.sin(a) * radii[2],
    ];
  };
  const rings = Array.from({ length: latitudes - 1 }, (_, j) =>
    Array.from({ length: segments }, (_, i) => point(j + 1, i)),
  );
  loft(out, slot, rings, color, { cap: false });
  for (let i = 0; i < segments; i++) {
    const bottom = [[center[0], center[1] - radii[1], center[2]], point(1, i + 1), point(1, i)];
    const top = [
      [center[0], center[1] + radii[1], center[2]],
      point(latitudes - 1, i),
      point(latitudes - 1, i + 1),
    ];
    for (const points of [bottom, top])
      out.addTriangle(
        slot,
        ref,
        points,
        normalFor(...points),
        [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ],
        color,
      );
  }
}

export function torus(out, slot, center, radius, tubeRadius, color, segments = 48, sides = 8) {
  const rings = [];
  for (let j = 0; j <= segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    rings.push(
      Array.from({ length: sides }, (_, i) => {
        const t = (i / sides) * Math.PI * 2;
        return [
          center[0] + (radius + tubeRadius * Math.cos(t)) * Math.cos(a),
          center[1] + tubeRadius * Math.sin(t),
          center[2] + (radius + tubeRadius * Math.cos(t)) * Math.sin(a),
        ];
      }),
    );
  }
  loft(out, slot, rings, color, { cap: false });
}

export function radialRing(y, rx, rz, sides = 32, center = [0, 0], offset = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const a = offset - (i / sides) * Math.PI * 2;
    return [center[0] + Math.cos(a) * rx, y, center[1] + Math.sin(a) * rz];
  });
}

export function chamferedRectangle(cx, cy, cz, width, depth, chamfer = 0.4) {
  const w = width / 2,
    d = depth / 2,
    c = Math.min(chamfer, w * 0.4, d * 0.4);
  return [
    [-w + c, -d],
    [-w, -d + c],
    [-w, d - c],
    [-w + c, d],
    [w - c, d],
    [w, d - c],
    [w, -d + c],
    [w - c, -d],
  ].map(([x, z]) => [cx + x, cy, cz + z]);
}

/** Smooth coincident surface normals across modest angles while keeping sharp boundaries. */
export function smoothMeshNormals(mesh, slots, maxAngleDegrees = 38) {
  const cosine = Math.cos((maxAngleDegrees * Math.PI) / 180);
  const selected = new Set();
  for (const group of mesh.groups)
    if (slots.includes(group.slot)) {
      for (let i = group.start; i < group.start + group.count; i++) selected.add(mesh.indices[i]);
    }
  const buckets = new Map();
  for (const index of selected) {
    const start = index * 3;
    const key = [0, 1, 2]
      .map((axis) => Math.round(mesh.positions[start + axis] * 100000))
      .join(',');
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  }
  const original = mesh.normals.slice();
  for (const bucket of buckets.values())
    for (const index of bucket) {
      const normal = [0, 0, 0],
        start = index * 3;
      for (const other of bucket) {
        const j = other * 3;
        if (
          original[start] * original[j] +
            original[start + 1] * original[j + 1] +
            original[start + 2] * original[j + 2] <
          cosine
        )
          continue;
        for (let axis = 0; axis < 3; axis++) normal[axis] += original[j + axis];
      }
      const smooth = normalize(normal);
      for (let axis = 0; axis < 3; axis++) mesh.normals[start + axis] = smooth[axis];
    }
  return mesh;
}

/** Validate the exported Float32 representation, where very small details can collapse. */
export function validateAuthoredMesh(mesh, name) {
  for (const array of [mesh.positions, mesh.normals, mesh.uvs])
    for (const value of array) {
      if (!Number.isFinite(value)) throw new Error(`${name}: non-finite mesh attribute`);
    }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    if (ids.some((index) => index < 0 || index >= mesh.vertexCount))
      throw new Error(`${name}: invalid index at triangle ${i / 3}`);
    const points = ids.map((index) =>
      Array.from(mesh.positions.subarray(index * 3, index * 3 + 3)),
    );
    const normal = cross(
      points[1].map((value, axis) => value - points[0][axis]),
      points[2].map((value, axis) => value - points[0][axis]),
    );
    if (Math.hypot(...normal) < 1e-10)
      throw new Error(`${name}: degenerate Float32 triangle ${i / 3}`);
    for (const id of ids) {
      const dot = normal.reduce((sum, value, axis) => sum + value * mesh.normals[id * 3 + axis], 0);
      if (dot < -1e-7) throw new Error(`${name}: winding/normal mismatch at triangle ${i / 3}`);
    }
  }
}

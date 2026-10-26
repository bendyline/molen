/** Construction utilities for reference-authored airframes. No default vehicle shape. */
import '../../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothSurface } from '../surface-normals.mjs';
import { detailKit } from '../vehicle-detail.mjs';

export { detailKit, T };
export const mat = (name, color, options = {}) =>
  new T.MeshStandardMaterial({
    name,
    color,
    metalness: 0.12,
    roughness: 0.58,
    flatShading: true,
    ...options,
  });
export function group(parent, name, position = [0, 0, 0]) {
  const result = new T.Group();
  result.name = name;
  result.position.fromArray(position);
  parent.add(result);
  return result;
}
/** Triangulate a planar contour and true apertures. Explicit normal controls winding. */
export function sheet(d, contour, material, normal, holes = []) {
  const n = new T.Vector3(...normal).normalize();
  // The requested normal is a winding hint, not necessarily the surface plane
  // (duct walls often supply a forward hint). Project on the actual contour.
  const plane = new T.Vector3();
  for (let i = 0; i < contour.length; i++)
    plane.add(
      new T.Vector3(...contour[i]).cross(new T.Vector3(...contour[(i + 1) % contour.length])),
    );
  if (plane.lengthSq() < 1e-20) return;
  plane.normalize();
  const u = new T.Vector3(...contour[1]).sub(new T.Vector3(...contour[0])).normalize();
  const v = plane.cross(u).normalize();
  const project = (point) => {
    const p = new T.Vector3(...point);
    return new T.Vector2(p.dot(u), p.dot(v));
  };
  const all = [contour, ...holes].flat();
  const indices = T.ShapeUtils.triangulateShape(
    contour.map(project),
    holes.map((h) => h.map(project)),
  ).flat();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(all.flat(), 3));
  for (let i = 0; i < indices.length; i += 3) {
    const a = new T.Vector3(...all[indices[i]]),
      b = new T.Vector3(...all[indices[i + 1]]),
      c = new T.Vector3(...all[indices[i + 2]]);
    if (b.sub(a).cross(c.sub(a)).dot(n) < 0)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return d.add(geometry, material);
}
export function quad(d, a, b, c, e, material, normal) {
  // Loft panels may be warped. Triangulate their ordered boundary directly:
  // flattening against an approximate normal can collapse an entire side wall.
  const points = [a, b, c, e].map((p) => new T.Vector3(...p));
  const indices = [0, 1, 2, 0, 2, 3];
  const area = new T.Vector3();
  for (let i = 0; i < 6; i += 3)
    area.add(
      points[indices[i + 1]]
        .clone()
        .sub(points[indices[i]])
        .cross(points[indices[i + 2]].clone().sub(points[indices[i]])),
    );
  if (area.dot(new T.Vector3(...normal)) < 0)
    for (let i = 0; i < 6; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([a, b, c, e].flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return d.add(geometry, material);
}
/**
 * Each section supplies its measured contour, clockwise as seen from +Z. Sampled curves
 * (12+ points) shade continuously; sparse polygonal profiles retain their planes. Authors
 * can override `smooth` for either case. Caps remain separate hard surfaces.
 */
export function loft(
  d,
  sections,
  material,
  { caps = true, skip = () => false, smooth = sections[0].points.length >= 12 } = {},
) {
  const count = sections[0].points.length;
  const parts = [];
  const target = smooth
    ? {
        add: (geometry) => {
          parts.push(geometry);
        },
      }
    : d;
  const p = (i, j) => [...sections[i].points[(j + count) % count], sections[i].z];
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < count; j++) {
      if (skip(i, j)) continue;
      const a = p(i, j),
        b = p(i + 1, j),
        c = p(i + 1, j + 1),
        e = p(i, j + 1);
      const normal = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...e).sub(new T.Vector3(...a)));
      // A nose/pole section can collapse to one point; its surviving triangle
      // still closes the next ring and must not be dropped.
      if (normal.lengthSq() < 1e-14)
        normal
          .copy(new T.Vector3(...b).sub(new T.Vector3(...a)))
          .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
      // Ring order can be authored either way; orient by the section centroid.
      const center = sections[i].points.reduce(
        (sum, q) => [sum[0] + q[0] / count, sum[1] + q[1] / count],
        [0, 0],
      );
      const nextCenter = sections[i + 1].points.reduce(
        (sum, q) => [sum[0] + q[0] / count, sum[1] + q[1] / count],
        [0, 0],
      );
      const outward = new T.Vector3(
        (a[0] + b[0] + c[0] + e[0]) / 4 - (center[0] + nextCenter[0]) / 2,
        (a[1] + b[1] + c[1] + e[1]) / 4 - (center[1] + nextCenter[1]) / 2,
        0,
      );
      if (normal.dot(outward) < 0) normal.negate();
      if (normal.lengthSq() > 1e-14) quad(target, a, b, c, e, material, normal.toArray());
    }
  if (parts.length) {
    const merged = mergeGeometries(parts);
    d.add(smoothSurface(merged), material);
    merged.dispose();
    for (const geometry of parts) geometry.dispose();
  }
  if (caps) {
    sheet(
      d,
      sections[0].points.map((q) => [...q, sections[0].z]),
      material,
      [0, 0, Math.sign(sections[0].z - sections[1].z)],
    );
    sheet(
      d,
      sections.at(-1).points.map((q) => [...q, sections.at(-1).z]),
      material,
      [0, 0, Math.sign(sections.at(-1).z - sections.at(-2).z)],
    );
  }
}
export function outline(d, points, radius, material, closed = true) {
  const path = points
    .map((p) => new T.Vector3(...p))
    .filter((p, i, all) => i === 0 || p.distanceToSquared(all[i - 1]) > 1e-16);
  if (closed && path.length > 1 && path[0].distanceToSquared(path.at(-1)) < 1e-16) path.pop();
  if (path.length < 2) return;
  const segments = path.length - (closed ? 0 : 1);
  const directions = Array.from({ length: segments }, (_, i) =>
    path[(i + 1) % path.length].clone().sub(path[i]).normalize(),
  );
  const initial = closed ? directions.at(-1) : directions[0];
  const u = new T.Vector3(...(Math.abs(initial.y) < 0.9 ? [0, 1, 0] : [1, 0, 0]))
    .cross(initial)
    .normalize();
  const positions = [],
    indices = [],
    sides = 6;
  for (let i = 0; i < path.length; i++) {
    const incoming = directions[(i - 1 + segments) % segments];
    const from = i === 0 && !closed ? directions[0] : incoming;
    const to = directions[i % segments];
    const outgoing = i === path.length - 1 && !closed ? from : to;
    const tangent = from.clone().add(outgoing).normalize();
    const v = from.clone().cross(u).normalize();
    for (let j = 0; j < sides; j++) {
      const angle = (j * Math.PI * 2) / sides;
      const offset = u
        .clone()
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(v, Math.sin(angle) * radius);
      // Adjacent sections share this miter ring instead of ending in separate
      // cylinder caps, so even a sharp rail bend has no daylight wedge.
      const denominator = from.dot(tangent);
      if (denominator > 0.25) offset.addScaledVector(from, -offset.dot(tangent) / denominator);
      positions.push(...path[i].clone().add(offset).toArray());
    }
    u.applyQuaternion(new T.Quaternion().setFromUnitVectors(from, outgoing));
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = ((i + 1) % path.length) * sides + j;
      const c = ((i + 1) % path.length) * sides + ((j + 1) % sides);
      const e = i * sides + ((j + 1) % sides);
      indices.push(a, e, b, e, c, b);
    }
  if (!closed) {
    const first = positions.length / 3;
    positions.push(...path[0].toArray(), ...path.at(-1).toArray());
    for (let j = 0; j < sides; j++) {
      indices.push(first, (j + 1) % sides, j);
      indices.push(
        first + 1,
        (path.length - 1) * sides + j,
        (path.length - 1) * sides + ((j + 1) % sides),
      );
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return d.add(geometry, material);
}
export function glazing(d, points, glass, frame, radius = 0.018, normal = [0, 0, 1]) {
  sheet(d, points, glass, normal);
  outline(d, points, radius, frame);
}
export function ellipsoid(d, at, scale, material, segments = 20) {
  return d.add(new T.SphereGeometry(1, segments, 12).scale(...scale), material, at);
}
/** Beveled upholstery or housings, retaining a deliberately polygonal edge. */
export function beveledBox(d, size, at, material, bevel = 0.02) {
  const [w, h, depth] = size,
    b = Math.min(bevel, w / 4, h / 4, depth / 3);
  const shape = new T.Shape();
  shape.moveTo(-w / 2 + b, -h / 2 + b);
  shape.lineTo(w / 2 - b, -h / 2 + b);
  shape.lineTo(w / 2 - b, h / 2 - b);
  shape.lineTo(-w / 2 + b, h / 2 - b);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2 + b);
  return d.add(geometry, material, at);
}
/** A tapered lifting surface from explicit leading/trailing-edge stations. */
export function wing(d, stations, material, thickness = 0.06) {
  const sections = stations.map(([x, y, front, back, half]) => {
    const h = half ?? (front - back) * thickness;
    return [
      [x, y, front],
      [x, y + h, front - (front - back) * 0.25],
      [x, y + h * 0.52, back + (front - back) * 0.25],
      [x, y, back],
      [x, y - h * 0.36, back + (front - back) * 0.25],
      [x, y - h * 0.65, front - (front - back) * 0.25],
    ];
  });
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 6; j++) {
      const a = sections[i][j],
        b = sections[i + 1][j],
        c = sections[i + 1][(j + 1) % 6],
        e = sections[i][(j + 1) % 6];
      const n = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...e).sub(new T.Vector3(...a)));
      if (j < 3 ? n.y < 0 : n.y > 0) n.negate();
      quad(d, a, b, c, e, material, n.toArray());
    }
  for (const i of [0, sections.length - 1])
    sheet(d, sections[i], material, [
      i === 0
        ? -Math.sign(stations.at(-1)[0] - stations[0][0])
        : Math.sign(stations.at(-1)[0] - stations[0][0]),
      0,
      0,
    ]);
}
export function cleanGeometry(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const g = object.geometry,
      p = g.getAttribute('position'),
      index = g.index,
      kept = [];
    const a = new T.Vector3(),
      b = new T.Vector3(),
      c = new T.Vector3();
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      a.fromBufferAttribute(p, ids[0]);
      b.fromBufferAttribute(p, ids[1]);
      c.fromBufferAttribute(p, ids[2]);
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) kept.push(...ids);
    }
    g.setIndex(kept);
    // Removing degenerate faces does not invalidate authored normals. Recomputing after
    // material batching destroys the smooth normals on disconnected triangle vertices.
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const normals = g.getAttribute('normal');
    for (let i = 0; i < normals.count; i++)
      if (a.fromBufferAttribute(normals, i).lengthSq() < 1e-10) normals.setXYZ(i, 0, 1, 0);
  });
  root.updateMatrixWorld(true);
}

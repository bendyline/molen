/** Construction utilities for reference-authored airframes. No default vehicle shape. */
import '../../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
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
  const u = new T.Vector3(...contour[1]).sub(new T.Vector3(...contour[0])).normalize();
  const v = n.clone().cross(u).normalize();
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
  return sheet(d, [a, b, c, e], material, normal);
}
/** Each section supplies its own measured contour, clockwise as seen from +Z. */
export function loft(d, sections, material, { caps = true, skip = () => false } = {}) {
  const count = sections[0].points.length;
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
      // Ring order can be authored either way; orient by the section centroid.
      const center = sections[i].points.reduce(
        (sum, q) => [sum[0] + q[0] / count, sum[1] + q[1] / count],
        [0, 0],
      );
      const outward = new T.Vector3(
        (a[0] + e[0]) / 2 - center[0],
        (a[1] + e[1]) / 2 - center[1],
        0,
      );
      if (normal.dot(outward) < 0) normal.negate();
      if (normal.lengthSq() > 1e-14) quad(d, a, b, c, e, material, normal.toArray());
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
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++)
    d.rod(points[i], points[(i + 1) % points.length], radius, material);
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
    g.computeVertexNormals();
    const normals = g.getAttribute('normal');
    for (let i = 0; i < normals.count; i++)
      if (a.fromBufferAttribute(normals, i).lengthSq() < 1e-10) normals.setXYZ(i, 0, 1, 0);
  });
  root.updateMatrixWorld(true);
}

/** Fit a cockpit to its airframe. These helpers slice the model's own opaque skin at a fuselage
 * station and close the gaps a cockpit leaves against it: a bulkhead around the instrument panel
 * (so no painted skin shows beside or below it) and liners along the sidewalls from the floor to
 * the canopy sill. Call them after the exterior is built and before the cockpit kits finish.
 * Coordinates are the model frame: +Y up, +Z forward, +X the pilot's left.
 */
import '../../../worldgen/scripts/install-deterministic-math.mjs';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { quad, sheet, T } from './mesh-kit.mjs';

const a = new T.Vector3(),
  b = new T.Vector3(),
  c = new T.Vector3();
/** Segments [[x, y], [x, y]] where opaque skin crosses the plane at `z`. Glass (transparent
 * materials) and anything under a node named in `exclude` are skipped. */
export function skinSection(root, z, { exclude = ['cockpit'] } = {}) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const segments = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (Array.isArray(material) || material.transparent) return;
    for (let p = mesh; p && p !== root; p = p.parent) if (exclude.includes(p.name)) return;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    const position = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index,
      count = index ? index.count : position.count;
    const vertex = (i, v) =>
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
    for (let i = 0; i < count; i += 3) {
      vertex(i, a);
      vertex(i + 1, b);
      vertex(i + 2, c);
      if (Math.min(a.z, b.z, c.z) > z || Math.max(a.z, b.z, c.z) < z) continue;
      const points = [];
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const dp = p.z - z,
          dq = q.z - z;
        if (dp === 0) points.push([p.x, p.y]);
        else if (dp * dq < 0) {
          const t = dp / (dp - dq);
          points.push([p.x + t * (q.x - p.x), p.y + t * (q.y - p.y)]);
        }
      }
      if (points.length >= 2) segments.push([points[0], points[1]]);
    }
  });
  return segments;
}
/** The x of the nearest skin wall at height `y` on one side (+1 left, -1 right), at least `from`
 * outboard of the centerline; undefined where none crosses. */
export function wallAt(segments, y, side, from = 0.05) {
  let best;
  for (const [[x1, y1], [x2, y2]] of segments) {
    if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
    const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
    if (side * x < from) continue;
    if (best === undefined || side * x < side * best) best = x;
  }
  return best;
}
/**
 * A bulkhead across the fuselage at `z`, from `yFrom` to `yTo`, `inset` inside the skin, with
 * `holes` (contours of [x, y]) cut through it. It faces the pilot (-Z) unless `normal` says
 * otherwise. Returns the outline it drew.
 */
export function cockpitBulkhead(
  d,
  root,
  {
    z,
    yFrom,
    yTo,
    material,
    steps = 28,
    inset = 0.004,
    holes = [],
    from = 0.05,
    exclude,
    normal = [0, 0, -1],
  },
) {
  const segments = skinSection(root, z, { exclude });
  const left = [],
    right = [];
  for (let i = 0; i <= steps; i++) {
    const y = yFrom + ((yTo - yFrom) * i) / steps;
    const l = wallAt(segments, y, 1, from),
      r = wallAt(segments, y, -1, from);
    if (l !== undefined) left.push([l - inset, y, z]);
    if (r !== undefined) right.push([r + inset, y, z]);
  }
  if (left.length < 2 || right.length < 2)
    throw Error(`cockpitBulkhead: no skin found at z=${z} between y=${yFrom} and ${yTo}`);
  const outline = [...left, ...right.reverse()];
  sheet(
    d,
    outline,
    material,
    normal,
    holes.map((hole) => hole.map(([x, y]) => [x, y, z])),
  );
  return outline;
}
/**
 * Line the exterior surfaces the crew sees directly from a seat (canopy bows, sills, the inside
 * of windscreen frames, an exposed roof): any opaque triangle outside the nodes named in
 * `exclude` (the cockpit itself) within `reach` of an eye that faces it and that the eye can see,
 * with neither glass nor anything opaque (the cockpit's liners and panels included) in between.
 * From inside, those showed the exterior paint, often near white. Each is copied `inset` toward
 * the eye in `material`, front-faced to the cabin only, and parented with its source part so
 * the lining moves with an opening canopy. Occlusion runs against a uniform grid of `cell` m;
 * anything within `near` of the surface (a seal, a rim, coplanar trim) does not hide it, nor
 * glass within `paneDepth` (a pane's edge set into the frame it is seen beside), nor a
 * single-sided face seen from behind (the renderer culls it).
 */
export function lineSeatFrames(
  root,
  eyes,
  material,
  { reach = 1.5, inset = 0.003, exclude = [], cell = 0.05, near = 0.006, paneDepth = 0.05 } = {},
) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  // Names, or patterns, of nodes whose meshes are never lined (they still block the view).
  const skip = (mesh) => {
    for (let p = mesh; p && p !== root; p = p.parent)
      if (exclude.some((e) => (typeof e === 'string' ? e === p.name : e.test(p.name)))) return true;
    return false;
  };
  const glassy = (m) =>
    (m.transparent && m.opacity < 0.8) ||
    /glass|glaz|canopy-pane|windscreen|windshield/i.test(m.name ?? '');
  const lo = new T.Vector3(Infinity, Infinity, Infinity),
    hi = new T.Vector3(-Infinity, -Infinity, -Infinity);
  for (const eye of eyes) {
    lo.min(eye.clone().subScalar(reach));
    hi.max(eye.clone().addScalar(reach));
  }
  // Every triangle in reach blocks a view, glass and cockpit included; only exterior opaque ones
  // are candidates for a lining.
  const tris = [],
    panes = [],
    twoSided = [],
    candidates = [];
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    const position = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index,
      count = index ? index.count : position.count;
    const read = (i, v) =>
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
    // Dark parts (rubber seals, black frames) already read as trim; only paint is lined. A dark
    // colour that is paint, not trim (a Bell 407's wine red), is marked `userData.paint`.
    const color = mesh.material.color,
      dark =
        color && !mesh.material.userData?.paint
          ? 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b < 0.08
          : false;
    const glass = glassy(mesh.material),
      lineable = !glass && !dark && !skip(mesh),
      doubleSided = mesh.material.side === T.DoubleSide;
    for (let i = 0; i < count; i += 3) {
      read(i, a);
      read(i + 1, b);
      read(i + 2, c);
      if (
        Math.max(a.x, b.x, c.x) < lo.x ||
        Math.min(a.x, b.x, c.x) > hi.x ||
        Math.max(a.y, b.y, c.y) < lo.y ||
        Math.min(a.y, b.y, c.y) > hi.y ||
        Math.max(a.z, b.z, c.z) < lo.z ||
        Math.min(a.z, b.z, c.z) > hi.z
      )
        continue;
      const id = tris.length / 9;
      tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      panes.push(glass);
      twoSided.push(doubleSided);
      if (lineable) candidates.push({ id, doubleSided, mesh });
    }
  });
  // A sparse grid of triangle ids by cell.
  const nx = Math.max(1, Math.ceil((hi.x - lo.x) / cell)),
    ny = Math.max(1, Math.ceil((hi.y - lo.y) / cell)),
    nz = Math.max(1, Math.ceil((hi.z - lo.z) / cell));
  const clampCell = (v, n) => Math.min(n - 1, Math.max(0, Math.floor(v / cell)));
  const grid = new Map();
  const triangles = tris.length / 9;
  for (let id = 0; id < triangles; id++) {
    const o = id * 9;
    const range = (k, n, origin) => [
      clampCell(Math.min(tris[o + k], tris[o + k + 3], tris[o + k + 6]) - origin, n),
      clampCell(Math.max(tris[o + k], tris[o + k + 3], tris[o + k + 6]) - origin, n),
    ];
    const [x0, x1] = range(0, nx, lo.x),
      [y0, y1] = range(1, ny, lo.y),
      [z0, z1] = range(2, nz, lo.z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const key = x + nx * (y + ny * z);
          const list = grid.get(key);
          if (list) list.push(id);
          else grid.set(key, [id]);
        }
  }
  // Whether the segment eye -> point crosses any triangle but `self` (Möller–Trumbore).
  const stamp = new Int32Array(triangles);
  let query = 0;
  const blocked = (eye, px, py, pz, self) => {
    query++;
    const dx = px - eye.x,
      dy = py - eye.y,
      dz = pz - eye.z,
      length = Math.hypot(dx, dy, dz);
    const ux = dx / length,
      uy = dy / length,
      uz = dz / length;
    const steps = Math.max(1, Math.ceil(length / (cell * 0.5)));
    let last = -1;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const key =
        clampCell(eye.x + dx * f - lo.x, nx) +
        nx * (clampCell(eye.y + dy * f - lo.y, ny) + ny * clampCell(eye.z + dz * f - lo.z, nz));
      if (key === last) continue;
      last = key;
      const list = grid.get(key);
      if (!list) continue;
      for (const id of list) {
        if (stamp[id] === query || id === self) continue;
        stamp[id] = query;
        const o = id * 9;
        const e1x = tris[o + 3] - tris[o],
          e1y = tris[o + 4] - tris[o + 1],
          e1z = tris[o + 5] - tris[o + 2];
        const e2x = tris[o + 6] - tris[o],
          e2y = tris[o + 7] - tris[o + 1],
          e2z = tris[o + 8] - tris[o + 2];
        const hx = uy * e2z - uz * e2y,
          hy = uz * e2x - ux * e2z,
          hz = ux * e2y - uy * e2x;
        const det = e1x * hx + e1y * hy + e1z * hz;
        // A single-sided face seen from behind is culled, so it hides nothing (det < 0).
        if (Math.abs(det) < 1e-12 || (det < 0 && !twoSided[id])) continue;
        const inv = 1 / det;
        const sx = eye.x - tris[o],
          sy = eye.y - tris[o + 1],
          sz = eye.z - tris[o + 2];
        const u = inv * (sx * hx + sy * hy + sz * hz);
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y,
          qy = sz * e1x - sx * e1z,
          qz = sx * e1y - sy * e1x;
        const v = inv * (ux * qx + uy * qy + uz * qz);
        if (v < 0 || u + v > 1) continue;
        const t = inv * (e2x * qx + e2y * qy + e2z * qz);
        if (t > 1e-4 && t < length - (panes[id] ? paneDepth : near)) return true;
      }
    }
    return false;
  };
  // Which candidates an eye sees, and from which side.
  const n = new T.Vector3(),
    toEye = new T.Vector3(),
    center = new T.Vector3(),
    edge = new T.Vector3();
  const normals = new Map(),
    lined = new Map(); // candidate id -> { side: +1 front or -1 back toward the eye, eye }
  /** The eye a candidate faces (within reach), with the side it faces it on, or undefined. */
  const facingEye = ({ id, doubleSided }) => {
    const o = id * 9;
    a.fromArray(tris, o);
    b.fromArray(tris, o + 3);
    c.fromArray(tris, o + 6);
    center.copy(a).add(b).add(c).divideScalar(3);
    n.subVectors(b, a).cross(edge.subVectors(c, a));
    if (n.lengthSq() < 1e-14) return undefined;
    n.normalize();
    normals.set(id, n.clone());
    return (
      eyes
        .map((eye) => {
          toEye.subVectors(eye, center);
          const distance = toEye.length();
          if (distance > reach) return undefined;
          const facing = n.dot(toEye) / distance;
          // Grazing faces count too (a bow seen edge-on from a rear seat): occlusion decides.
          if (facing <= 0 && !(doubleSided && facing < 0)) return undefined;
          return { eye, side: facing > 0 ? 1 : -1, distance };
        })
        .filter(Boolean)
        // The nearest seat first: its view of the face is the one the lining must cover.
        .sort((p, q) => p.distance - q.distance)
    );
  };
  for (const candidate of candidates) {
    const facing = facingEye(candidate);
    if (!facing?.length) continue;
    // The centroid and three points toward the corners: a long strip half hidden still shows.
    const samples = [center, a, b, c].map((v, k) =>
      k === 0 ? v.clone() : center.clone().lerp(v, 0.7),
    );
    const seen = facing.find(({ eye }) =>
      samples.some((p) => !blocked(eye, p.x, p.y, p.z, candidate.id)),
    );
    if (seen) lined.set(candidate.id, seen);
  }
  // A quad's other half can hide behind its fold from the eye's sample rays and leave a sawtooth
  // along a bow: a facing triangle that shares an edge with a lined one at a similar angle is
  // lined too.
  const key = (o) => `${tris[o].toFixed(5)},${tris[o + 1].toFixed(5)},${tris[o + 2].toFixed(5)}`;
  const edges = new Map();
  for (const { id, mesh } of candidates)
    for (let k = 0; k < 3; k++) {
      const p = key(id * 9 + k * 3),
        q = key(id * 9 + ((k + 1) % 3) * 3);
      const shared = `${mesh.uuid}|${p < q ? `${p}|${q}` : `${q}|${p}`}`;
      if (!edges.has(shared)) edges.set(shared, []);
      edges.get(shared).push(id);
    }
  for (let pass = 0; pass < 2; pass++)
    for (const candidate of candidates) {
      const { id, mesh } = candidate;
      if (lined.has(id)) continue;
      const facing = facingEye(candidate);
      if (!facing?.length) continue;
      const normal = normals.get(id);
      for (let k = 0; k < 3 && !lined.has(id); k++) {
        const p = key(id * 9 + k * 3),
          q = key(id * 9 + ((k + 1) % 3) * 3);
        for (const other of edges.get(`${mesh.uuid}|${p < q ? `${p}|${q}` : `${q}|${p}`}`) ?? [])
          if (
            other !== id &&
            lined.has(other) &&
            normal.dot(normals.get(other)) * lined.get(other).side * facing[0].side > 0.6
          ) {
            lined.set(id, facing[0]);
            break;
          }
      }
    }
  // Lined triangles by source mesh, so each lining rides with its part (an opening canopy).
  const byMesh = new Map();
  for (const { id, mesh } of candidates) {
    const view = lined.get(id);
    if (view === undefined) continue;
    const o = id * 9;
    a.fromArray(tris, o);
    b.fromArray(tris, o + 3);
    c.fromArray(tris, o + 6);
    const corners = view.side > 0 ? [a, b, c] : [a, c, b];
    if (!byMesh.has(mesh)) byMesh.set(mesh, []);
    const positions = byMesh.get(mesh);
    // Set in toward the eye that sees it, not along the normal: seen obliquely, a copy moved
    // along the normal slides sideways and uncovers a sliver of the face it lines.
    for (const v of corners) {
      toEye.subVectors(view.eye, v).setLength(inset);
      positions.push(v.x + toEye.x, v.y + toEye.y, v.z + toEye.z);
    }
  }
  if (!byMesh.size) return undefined;
  for (const [mesh, positions] of byMesh) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    // Back into the source's parent frame: the lining moves with whatever moves the part.
    const parent = mesh.parent ?? root;
    geometry.applyMatrix4(parent.matrixWorld.clone().invert().multiply(root.matrixWorld));
    // Smooth across a coarse bow's facets (twisted quads shade as a sawtooth), hard at a sill.
    const lining = new T.Mesh(toCreasedNormals(geometry, Math.PI / 5), material);
    lining.name = `${mesh.name || parent.name || 'frame'}-lining`;
    parent.add(lining);
  }
  return {
    count: byMesh.size,
    triangles: [...byMesh.values()].reduce((t, p) => t + p.length / 9, 0),
  };
}
/**
 * Sidewall liners following the skin `inset` inside it, between stations `zFrom`..`zTo` and
 * heights `yFrom`..`yTo` (the floor to the canopy sill). Rows where the skin is missing (an
 * opening, the canopy) are left open. Faces point inboard.
 */
export function cockpitLiner(
  d,
  root,
  {
    zFrom,
    zTo,
    yFrom,
    yTo,
    material,
    zSteps = 10,
    ySteps = 10,
    inset = 0.01,
    sides = [1, -1],
    from = 0.05,
    exclude,
  },
) {
  const grid = [];
  for (let i = 0; i <= zSteps; i++) {
    const z = zFrom + ((zTo - zFrom) * i) / zSteps,
      segments = skinSection(root, z, { exclude });
    grid.push(
      Array.from({ length: ySteps + 1 }, (_, j) => {
        const y = yFrom + ((yTo - yFrom) * j) / ySteps;
        return { z, y, x: Object.fromEntries(sides.map((s) => [s, wallAt(segments, y, s, from)])) };
      }),
    );
  }
  for (const side of sides)
    for (let i = 0; i < zSteps; i++)
      for (let j = 0; j < ySteps; j++) {
        const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
        if (corners.some((p) => p.x[side] === undefined)) continue;
        const [p, q, r, s] = corners.map((p) => [p.x[side] - side * inset, p.y, p.z]);
        quad(d, p, q, r, s, material, [-side, 0, 0]);
      }
}

/**
 * Shared North American rolling-stock parts: wheelsets, freight, locomotive and passenger trucks,
 * couplers and draft gear, safety appliances, brake gear, lettering and the panel/lathe helpers the
 * rail builders in rail-models.mjs use. Deterministic: no clocks, no randomness, `Math.pow` for
 * powers. Coordinates: front +Z, +X is the vehicle's left, y = 0 the top of rail, metres.
 *
 * Every node's geometry is batched by material (`Mesher.emit`), so a car draws a handful of
 * meshes per node rather than one per part.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { joinedPath } from '../../worldgen/scripts/joined-path.mjs';

/** Standard gauge between rail heads; wheel contact points sit 1.5 m apart. */
export const GAUGE = 1.435;
export const WHEEL_X = 0.75;
/** AAR coupler centreline above the rail (34.5 in). */
export const COUPLER_Y = 0.876;

const mat = (name, color, metalness, roughness, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true, ...extra });

/**
 * One material set per model. `body` is the paint a host recolours (`rail-livery-body`); the
 * other names are shared across the rail family. No pure black or white on large surfaces.
 */
export function railMaterials(colors = {}) {
  const glass = mat('rail-glass', '#2c3a42', 0.1, 0.1, {
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    flatShading: false,
  });
  const tint = mat('rail-glass-tint', '#25323a', 0.1, 0.12, {
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    flatShading: false,
  });
  return {
    body: mat('rail-livery-body', colors.body ?? '#7a3f2e', 0.12, 0.62),
    stripe: mat('rail-livery-stripe', colors.stripe ?? '#e1c24a', 0.12, 0.55),
    accent: mat('rail-livery-accent', colors.accent ?? '#e5e2d6', 0.1, 0.55),
    frame: mat('rail-frame', colors.frame ?? '#3d4043', 0.2, 0.78),
    wheel: mat('rail-wheel', '#5b5149', 0.55, 0.6),
    steel: mat('rail-steel', '#9fa2a0', 0.7, 0.38),
    safety: mat('rail-safety', '#dcb03a', 0.1, 0.5),
    dark: mat('rail-dark', '#26292b', 0.05, 0.85),
    glass,
    tint,
    lamp: mat('rail-lamp', '#fff3d2', 0, 0.3, { emissive: '#fff1c8', emissiveIntensity: 0.55 }),
    marker: mat('rail-marker', '#c4302b', 0, 0.35, {
      emissive: '#7d1612',
      emissiveIntensity: 0.4,
    }),
    lettering: mat('rail-lettering', '#ebe8dc', 0, 0.6),
    ink: mat('rail-lettering-dark', '#2c2f31', 0, 0.6),
    board: mat('rail-number-board', '#e8e4d2', 0, 0.4, {
      emissive: '#d9d2b6',
      emissiveIntensity: 0.25,
    }),
  };
}

const AXES = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };

/** Non-indexed, position + normal only, so every part merges with every other. */
function clean(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(g.attributes))
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.clearGroups();
  return g;
}

/**
 * Collects geometry per material for one node and merges it on `emit`. Positions are in the
 * node's local frame.
 */
export class Mesher {
  constructor() {
    this.parts = new Map();
  }
  geo(geometry, material, matrix) {
    const g = clean(geometry);
    if (matrix) g.applyMatrix4(matrix);
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
    return g;
  }
  /** Box of `size` centred at `at`, optionally rotated by Euler `rot` (radians, XYZ). */
  box(material, size, at, rot) {
    const m = new T.Matrix4().compose(
      new T.Vector3(...at),
      new T.Quaternion().setFromEuler(new T.Euler(...(rot ?? [0, 0, 0]))),
      new T.Vector3(1, 1, 1),
    );
    return this.geo(new T.BoxGeometry(...size), material, m);
  }
  /** Axis-aligned box between two corners. */
  span(material, a, b) {
    return this.box(
      material,
      [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])],
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    );
  }
  /** Cylinder (or cone) along an axis, centred at `at`. */
  cyl(material, r0, r1, length, at, axis = 'y', segments = 12, open = false) {
    const g = new T.CylinderGeometry(r1, r0, length, segments, 1, open);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(...at);
    return this.geo(g, material);
  }
  /** Straight round bar from a to b. */
  rod(material, a, b, radius = 0.015, segments = 6) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b);
    const length = from.distanceTo(to);
    if (length < 1e-6) return undefined;
    const g = new T.CylinderGeometry(radius, radius, length, segments, 1, true);
    const m = new T.Matrix4().compose(
      from.clone().lerp(to, 0.5),
      new T.Quaternion().setFromUnitVectors(AXES.y, to.clone().sub(from).normalize()),
      new T.Vector3(1, 1, 1),
    );
    return this.geo(g, material, m);
  }
  /** Bent bar through `points` with mitred joints (handrails, grab irons, hoses). */
  path(material, points, radius = 0.015, sides = 6, closed = false) {
    const { positions, indices } = joinedPath(points, radius, sides, closed);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return this.geo(g, material);
  }
  /** Flat sheet from an explicit triangle list (each [a, b, c]); normals per face. */
  tris(material, triangles) {
    const p = [];
    for (const t of triangles) for (const v of t) p.push(...v);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return this.geo(g, material);
  }
  /** Convex polygon (fan) whose front faces `outward`. */
  face(material, points, outward) {
    const o = new T.Vector3(...outward);
    const tris = [];
    for (let i = 1; i + 1 < points.length; i++) {
      const a = new T.Vector3(...points[0]),
        b = new T.Vector3(...points[i]),
        c = new T.Vector3(...points[i + 1]);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      tris.push(
        n.dot(o) >= 0
          ? [points[0], points[i], points[i + 1]]
          : [points[0], points[i + 1], points[i]],
      );
    }
    return this.tris(material, tris);
  }
  /** Quad a-b-c-d (counter-clockwise seen from its front). */
  quad(material, a, b, c, d) {
    return this.tris(material, [
      [a, b, c],
      [a, c, d],
    ]);
  }
  /**
   * Extrude a 2D outline (with optional holes) through `depth`. `plane` maps the outline:
   * 'xy' (outline x, y; depth +z), 'zy' (outline z, y; depth -x), 'xz' (outline x, -z; depth +y).
   * `offset` translates the result.
   */
  slab(material, outline, depth, plane = 'xy', offset = [0, 0, 0], holes = [], matrix) {
    const shape = new T.Shape(outline.map(([u, v]) => new T.Vector2(u, v)));
    for (const hole of holes)
      shape.holes.push(new T.Path(hole.map(([u, v]) => new T.Vector2(u, v))));
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
    if (plane === 'zy') g.rotateY(-Math.PI / 2);
    if (plane === 'xz') g.rotateX(-Math.PI / 2);
    g.translate(...offset);
    if (matrix) g.applyMatrix4(matrix);
    return this.geo(g, material);
  }
  /**
   * Surface of revolution about `axis` through `center`. `profile` is [[radius, along], ...];
   * each profile segment is its own band (hard edges between bands, smooth round the axis).
   * `sign` -1 mirrors along the axis. Winding follows the profile normal (dr, -da).
   */
  lathe(
    material,
    profile,
    segments = 16,
    axis = 'x',
    center = [0, 0, 0],
    sign = 1,
    from = 0,
    to = 1,
  ) {
    const p = [],
      n = [];
    const point = (r, a, theta) => {
      const c = Math.cos(theta) * r,
        s = Math.sin(theta) * r;
      if (axis === 'x') return [center[0] + sign * a, center[1] + c, center[2] + s];
      if (axis === 'z') return [center[0] + s, center[1] + c, center[2] + sign * a];
      return [center[0] + c, center[1] + sign * a, center[2] + s];
    };
    const normal = (nr, na, theta) => {
      const c = Math.cos(theta) * nr,
        s = Math.sin(theta) * nr;
      if (axis === 'x') return [sign * na, c, s];
      if (axis === 'z') return [s, c, sign * na];
      return [c, sign * na, s];
    };
    const t0 = from * 2 * Math.PI,
      t1 = to * 2 * Math.PI;
    for (let i = 0; i + 1 < profile.length; i++) {
      const [r0, a0] = profile[i],
        [r1, a1] = profile[i + 1];
      const len = Math.hypot(r1 - r0, a1 - a0);
      if (len < 1e-9) continue;
      const nr = -(a1 - a0) / len,
        na = (r1 - r0) / len;
      for (let j = 0; j < segments; j++) {
        const ta = t0 + ((t1 - t0) * j) / segments,
          tb = t0 + ((t1 - t0) * (j + 1)) / segments;
        const A = point(r0, a0, ta),
          B = point(r1, a1, ta),
          C = point(r1, a1, tb),
          D = point(r0, a0, tb);
        const NA = normal(nr, na, ta),
          NB = normal(nr, na, tb);
        // Orient each quad to its intended outward normal.
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]],
          e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        let face = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        if (Math.hypot(...face) < 1e-12) {
          const e3 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
          face = [
            e2[1] * e3[2] - e2[2] * e3[1],
            e2[2] * e3[0] - e2[0] * e3[2],
            e2[0] * e3[1] - e2[1] * e3[0],
          ];
        }
        const mid = normal(nr, na, (ta + tb) / 2);
        const flip = face[0] * mid[0] + face[1] * mid[1] + face[2] * mid[2] < 0;
        const quad = flip
          ? [
              [A, NA],
              [D, NB],
              [C, NB],
              [B, NA],
            ]
          : [
              [A, NA],
              [B, NA],
              [C, NB],
              [D, NB],
            ];
        for (const k of [0, 1, 2, 0, 2, 3]) {
          p.push(...quad[k][0]);
          n.push(...quad[k][1]);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(n, 3));
    return this.geo(g, material);
  }
  /**
   * Loft closed rings (equal point counts) into a tube; `caps` closes the first and last ring.
   * Rings are arrays of [x, y, z]. Normals per face (flat) unless `smooth`.
   */
  loft(material, rings, { caps = false, smooth = false, closed = true } = {}) {
    const tri = [];
    const count = rings[0].length;
    const centroid = (ring) =>
      ring
        .reduce((sum, p) => sum.add(new T.Vector3(...p)), new T.Vector3())
        .multiplyScalar(1 / ring.length);
    const centres = rings.map(centroid);
    // Each triangle faces away from the local axis (the mean of its two rings' centroids).
    const orient = (t, axis) => {
      const a = new T.Vector3(...t[0]),
        b = new T.Vector3(...t[1]),
        c = new T.Vector3(...t[2]);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const mid = a
        .clone()
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3)
        .sub(axis);
      return n.dot(mid) >= 0 ? t : [t[0], t[2], t[1]];
    };
    for (let k = 0; k + 1 < rings.length; k++) {
      const axis = centres[k]
        .clone()
        .add(centres[k + 1])
        .multiplyScalar(0.5);
      for (let i = 0; i < (closed ? count : count - 1); i++) {
        const j = (i + 1) % count;
        tri.push(orient([rings[k][i], rings[k + 1][i], rings[k + 1][j]], axis));
        tri.push(orient([rings[k][i], rings[k + 1][j], rings[k][j]], axis));
      }
    }
    if (caps)
      for (const [ring, inner] of [
        [rings[0], centres[1]],
        [rings.at(-1), centres.at(-2)],
      ])
        for (let i = 1; i + 1 < count; i++)
          tri.push(orient([ring[0], ring[i], ring[i + 1]], inner));
    const p = [];
    for (const t of tri) for (const v of t) p.push(...v);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    if (smooth) {
      const indexed = mergeVerticesLoose(g);
      indexed.computeVertexNormals();
      return this.geo(indexed, material);
    }
    g.computeVertexNormals();
    return this.geo(g, material);
  }
  /** Merge everything per material and add one mesh per material to `node`. */
  emit(node, prefix = node.name) {
    for (const [material, list] of this.parts) {
      const merged = mergeGeometries(list);
      if (!merged) throw new Error(`Cannot merge ${prefix}/${material.name}`);
      const mesh = new T.Mesh(merged, material);
      mesh.name = `${prefix}-${material.name}`;
      node.add(mesh);
    }
    this.parts.clear();
    return node;
  }
}

function mergeVerticesLoose(geometry) {
  const p = geometry.getAttribute('position');
  const map = new Map(),
    positions = [],
    index = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = positions.length / 3;
      map.set(key, k);
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    index.push(k);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

export function group(name, at = [0, 0, 0]) {
  const g = new T.Group();
  g.name = name;
  g.position.set(...at);
  return g;
}

/** Rectangle with rounded corners as an outline, centre (u, v), size w × h. */
export function roundedRect(u, v, w, h, r = 0.06, steps = 2) {
  const out = [];
  const corners = [
    [u + w / 2 - r, v - h / 2 + r, -Math.PI / 2],
    [u + w / 2 - r, v + h / 2 - r, 0],
    [u - w / 2 + r, v + h / 2 - r, Math.PI / 2],
    [u - w / 2 + r, v - h / 2 + r, Math.PI],
  ];
  for (const [cu, cv, a0] of corners)
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i * Math.PI) / 2 / steps;
      out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
    }
  return out;
}

// --- Lettering -----------------------------------------------------------------------------------

// Compact 3 × 5 sans-serif, as the vehicle detail kit uses.
const GLYPHS = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '101111111111101',
  O: '010101101101010',
  P: '110101110100100',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  0: '111101101101111',
  1: '010110010010111',
  2: '110001010100111',
  3: '110001010001110',
  4: '101101111001001',
  5: '111100110001110',
  6: '011100111101111',
  7: '111001010010010',
  8: '111101111101111',
  9: '111101111001110',
  '-': '000000111000000',
  '.': '000000000000010',
  '/': '001001010100100',
};

/**
 * Flat lettering: each lit row run of a glyph is one quad. `at` is the text centre on the surface
 * (already standing off it), `right` the reading direction, `up` the glyph up; the quads face
 * right × up.
 */
export function letter(m, material, text, at, right, up, height) {
  const px = height / 5;
  const chars = [...text.toUpperCase()];
  const width = (chars.length * 4 - 1) * px;
  const R = new T.Vector3(...right).normalize(),
    U = new T.Vector3(...up).normalize();
  const origin = new T.Vector3(...at);
  const pt = (u, v) => origin.clone().addScaledVector(R, u).addScaledVector(U, v).toArray();
  const tris = [];
  chars.forEach((char, n) => {
    const bits = GLYPHS[char];
    if (!bits) return;
    for (let row = 0; row < 5; row++) {
      let col = 0;
      while (col < 3) {
        if (bits[row * 3 + col] !== '1') {
          col++;
          continue;
        }
        let end = col;
        while (end + 1 < 3 && bits[row * 3 + end + 1] === '1') end++;
        const u0 = -width / 2 + (n * 4 + col) * px,
          u1 = -width / 2 + (n * 4 + end + 1) * px - px * 0.12;
        const v1 = height / 2 - row * px,
          v0 = v1 - px * 0.88;
        tris.push([pt(u0, v0), pt(u1, v0), pt(u1, v1)], [pt(u0, v0), pt(u1, v1), pt(u0, v1)]);
        col = end + 1;
      }
    }
  });
  if (tris.length) m.tris(material, tris);
  return width;
}

/** Text on a side wall: side +1 is the +X face (reads toward -Z), -1 the -X face. */
export function sideText(m, material, text, side, x, y, z, height) {
  return letter(m, material, text, [x, y, z], [0, 0, -side], [0, 1, 0], height);
}

/** Text on an end: dir +1 the front (+Z) face (reads toward -X), -1 the rear face. */
export function endText(m, material, text, dir, x, y, z, height) {
  return letter(m, material, text, [x, y, z], [-dir, 0, 0], [0, 1, 0], height);
}

/** Small capacity / data stencil: a block of short bars standing in for unreadable data. */
export function stencilBlock(m, material, side, x, y, z, width, rows = 4) {
  for (let i = 0; i < rows; i++) {
    const w = width * (i % 2 ? 0.72 : 1) * (i === rows - 1 ? 0.5 : 1);
    const zc = z - (side * (w - width)) / 2;
    m.box(material, [0.004, 0.035, w], [x, y - i * 0.075, zc]);
  }
}

// --- Running gear --------------------------------------------------------------------------------

/**
 * One wheelset: a node `name` at the axle centre (y = wheel radius in the truck frame) with a
 * single child `<name>-spin` holding everything that turns, so hosts spin children[0] about X.
 */
export function wheelset(M, name, r, z, { segments = 16, bearing = 'freight' } = {}) {
  const node = group(name, [0, r, z]);
  const spin = group(`${name}-spin`);
  node.add(spin);
  const m = new Mesher();
  // Wheel profile [radius, x] from the hub's outer face round the tread and flange to the axle:
  // dished plate, rim, coned tread, flange on the gauge side (flange back at x = 0.678).
  const profile = [
    [0.095, 0.835],
    [0.17, 0.82],
    [r - 0.065, 0.8],
    [r - 0.04, 0.826],
    [r - 0.006, 0.826],
    [r + 0.002, 0.712],
    [r + 0.026, 0.694],
    [r + 0.012, 0.679],
    [r - 0.06, 0.679],
    [0.16, 0.7],
    [0.095, 0.67],
  ];
  for (const sign of [1, -1]) {
    m.lathe(M.wheel, profile.slice(0, 4), segments, 'x', [0, 0, 0], sign);
    m.lathe(M.steel, profile.slice(3, 8), segments, 'x', [0, 0, 0], sign);
    m.lathe(M.wheel, profile.slice(7), segments, 'x', [0, 0, 0], sign);
  }
  m.cyl(M.wheel, 0.09, 0.09, 1.36, [0, 0, 0], 'x', 10, true);
  // Journals run out to the bearings; the bearing end caps turn with the axle (three bolts).
  const capX = bearing === 'outboard' ? 1.04 : 1.07;
  for (const s of [1, -1]) {
    m.cyl(M.wheel, 0.08, 0.08, capX - 0.84, [(s * (0.84 + capX)) / 2, 0, 0], 'x', 10, true);
    m.lathe(
      M.steel,
      [
        [0.0, capX + 0.035],
        [0.075, capX + 0.035],
        [0.095, capX],
      ],
      12,
      'x',
      [0, 0, 0],
      s,
    );
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      m.box(
        M.dark,
        [0.025, 0.028, 0.028],
        [s * (capX + 0.045), Math.cos(a) * 0.045, Math.sin(a) * 0.045],
      );
    }
  }
  m.emit(spin);
  return node;
}

/**
 * Three-piece freight truck (cast side frames, bolster on spring nests, roller bearings, brake
 * beams). Returns the truck node at (0, 0, z) with its two wheelsets as children.
 */
export function freightTruck(
  M,
  name,
  z,
  axles,
  { r = 0.457, wheelbase = 1.778, segments = 16 } = {},
) {
  const truck = group(name, [0, 0, z]);
  const m = new Mesher();
  const half = wheelbase / 2;
  const fx = 1.016; // journal centres, 80 in apart
  // Side frame in the z-y plane: arched top member over the journals, tension member dipping
  // to the spring seat, column guides either side of the bolster opening.
  const top = r + 0.24,
    seat = r - 0.22;
  const outline = [
    [-(half + 0.3), r + 0.06],
    [-(half + 0.3), top - 0.02],
    [-(half - 0.1), top + 0.03],
    [-0.42, top + 0.05],
    [0.42, top + 0.05],
    [half - 0.1, top + 0.03],
    [half + 0.3, top - 0.02],
    [half + 0.3, r + 0.06],
    [half + 0.16, r + 0.06],
    [half - 0.22, r + 0.04],
    [0.55, seat + 0.1],
    [0.36, seat],
    [-0.36, seat],
    [-0.55, seat + 0.1],
    [-(half - 0.22), r + 0.04],
    [-(half + 0.16), r + 0.06],
  ];
  const holes = [
    [
      [-0.3, seat + 0.07],
      [0.3, seat + 0.07],
      [0.3, top - 0.06],
      [-0.3, top - 0.06],
    ],
    [
      [0.42, seat + 0.2],
      [half - 0.32, r + 0.12],
      [half - 0.32, top - 0.07],
      [0.42, top - 0.04],
    ],
    [
      [-(half - 0.32), r + 0.12],
      [-0.42, seat + 0.2],
      [-0.42, top - 0.04],
      [-(half - 0.32), top - 0.07],
    ],
  ];
  for (const s of [1, -1]) {
    m.slab(M.frame, outline, 0.13, 'zy', [s * fx + 0.065, 0, 0], holes);
    // Bearing adapters in the pedestal jaws, wedge-shaped spring planks, spring nest.
    for (const dz of [-half, half]) {
      m.box(M.frame, [0.2, 0.08, 0.26], [s * fx, r + 0.1, dz]);
      m.cyl(M.frame, 0.1, 0.1, 0.22, [s * (fx - 0.01), r, dz], 'x', 12);
    }
    m.box(M.frame, [0.2, 0.05, 0.62], [s * fx, seat + 0.05, 0]);
    for (const dz of [-0.2, 0, 0.2])
      for (const dx of [-0.04, 0.04])
        m.cyl(M.steel, 0.055, 0.055, 0.2, [s * fx + dx, seat + 0.18, dz], 'y', 8);
    // Friction wedges and bolster end.
    m.box(M.frame, [0.24, 0.16, 0.5], [s * fx, top - 0.15, 0]);
  }
  // Bolster across the truck (centre plate about 0.66 m above the rail) and side bearings.
  m.box(M.frame, [2 * fx - 0.08, 0.2, 0.36], [0, top - 0.14, 0]);
  m.cyl(M.frame, 0.2, 0.2, 0.04, [0, top - 0.02, 0], 'y', 12);
  for (const s of [1, -1]) m.box(M.frame, [0.14, 0.05, 0.18], [s * 0.64, top - 0.02, 0]);
  // Brake beams with heads and shoes on the treads, hanging inside the wheelbase.
  for (const dz of [-1, 1]) {
    const zb = dz * (half - r - 0.07);
    m.box(M.frame, [1.6, 0.07, 0.07], [0, r - 0.03, zb]);
    m.box(M.frame, [0.1, 0.22, 0.05], [0, r + 0.06, zb]);
    for (const s of [1, -1]) {
      const shoe = dz * (half - r - 0.02);
      m.box(M.dark, [0.12, 0.26, 0.05], [s * WHEEL_X, r - 0.02, shoe]);
      m.box(M.frame, [0.14, 0.1, 0.07], [s * WHEEL_X, r - 0.02, zb]);
    }
  }
  m.rod(M.frame, [0.0, r + 0.08, -(half - r - 0.07)], [0.0, r + 0.08, half - r - 0.07], 0.02);
  m.emit(truck);
  for (const [axleName, dz] of axles)
    truck.add(wheelset(M, axleName, r, dz, { segments, bearing: 'freight' }));
  return truck;
}

/**
 * Locomotive truck: fabricated side frames outside the wheels with journal boxes and coil
 * springs, brake cylinders, traction motors between the axles and sand pipes. `axleZ` lists the
 * axle positions relative to the truck centre (two for B, three for C trucks).
 */
export function locoTruck(
  M,
  name,
  z,
  axles,
  { r = 0.508, style = 'blomberg', segments = 22 } = {},
) {
  const truck = group(name, [0, 0, z]);
  const m = new Mesher();
  const zs = axles.map(([, dz]) => dz);
  const front = Math.max(...zs),
    rear = Math.min(...zs);
  const ends = [rear - 0.55, front + 0.55];
  const fx = 1.07;
  const top = r + 0.55,
    bottom = r + 0.12;
  // Side frame outline: a deep plate with pockets over each journal box for the springs.
  const outline = [[ends[0], bottom + 0.05]];
  outline.push([ends[0], top - 0.08], [ends[0] + 0.12, top]);
  outline.push([ends[1] - 0.12, top], [ends[1], top - 0.08], [ends[1], bottom + 0.05]);
  const sorted = [...zs].sort((a, b) => b - a);
  for (const dz of sorted) {
    outline.push(
      [dz + 0.28, bottom + 0.05],
      [dz + 0.22, top - 0.2],
      [dz - 0.22, top - 0.2],
      [dz - 0.28, bottom + 0.05],
    );
  }
  // Clean up: keep outline order from front end back along the bottom.
  const bottomRun = outline.slice(6);
  const plate = [...outline.slice(0, 6), ...bottomRun];
  for (const s of [1, -1]) {
    m.slab(M.frame, plate, 0.14, 'zy', [s * fx + 0.07, 0, 0]);
    // Journal boxes with bolted round covers, primary coil springs above them.
    for (const dz of zs) {
      m.box(M.frame, [0.26, 0.3, 0.34], [s * (fx - 0.02), r, dz]);
      m.cyl(M.steel, 0.11, 0.11, 0.05, [s * (fx + 0.12), r, dz], 'x', 12);
      for (const dzz of [-0.1, 0.1]) {
        m.cyl(
          M.steel,
          0.07,
          0.07,
          top - 0.2 - (r + 0.15),
          [s * (fx + 0.02), (r + 0.15 + top - 0.2) / 2, dz + dzz],
          'y',
          8,
        );
        for (let k = 0; k < 4; k++)
          m.cyl(
            M.dark,
            0.075,
            0.075,
            0.015,
            [s * (fx + 0.02), r + 0.18 + k * ((top - 0.2 - r - 0.2) / 3), dz + dzz],
            'y',
            8,
          );
      }
    }
    // Brake cylinders on the frame face between the axles, with levers to the shoes.
    for (let i = 0; i + 1 < sorted.length; i++) {
      const zc = (sorted[i] + sorted[i + 1]) / 2;
      m.cyl(M.frame, 0.11, 0.11, 0.26, [s * (fx + 0.2), top - 0.17, zc], 'x', 12);
      m.cyl(M.frame, 0.06, 0.06, 0.08, [s * (fx + 0.36), top - 0.17, zc], 'x', 8);
      m.rod(
        M.frame,
        [s * (fx + 0.15), top - 0.25, zc],
        [s * (fx + 0.1), r - 0.05, zc + 0.3],
        0.025,
      );
    }
    // Brake shoes on every tread (inside the frame), sand pipes ahead of the end wheels.
    for (const dz of zs)
      for (const d of [-1, 1])
        m.box(M.dark, [0.12, 0.28, 0.06], [s * WHEEL_X, r, dz + d * (r + 0.03)]);
    for (const dz of [front, rear]) {
      const d = Math.sign(dz);
      m.path(
        M.dark,
        [
          [s * WHEEL_X, top + 0.02, dz + d * 0.3],
          [s * WHEEL_X, r + 0.2, dz + d * (r + 0.12)],
          [s * WHEEL_X, 0.07, dz + d * (r - 0.05)],
        ],
        0.018,
        5,
      );
    }
    if (style === 'blomberg') {
      // Blomberg: equalizer under the journal boxes, swing-hanger bolster springs mid-frame,
      // and a diagonal shock absorber.
      m.box(M.frame, [0.1, 0.1, front - rear + 0.5], [s * (fx + 0.02), r - 0.2, 0]);
      for (const dz of [-0.15, 0.15])
        m.cyl(M.steel, 0.09, 0.09, 0.26, [s * (fx + 0.02), r + 0.13, dz], 'y', 10);
      m.rod(
        M.steel,
        [s * (fx + 0.11), r + 0.02, front - 0.35],
        [s * (fx + 0.11), top - 0.08, front - 0.05],
        0.035,
        8,
      );
    } else {
      // GE Hi-Ad: a shock absorber at each end journal.
      for (const dz of [front, rear])
        m.rod(
          M.steel,
          [s * (fx + 0.11), r + 0.05, dz - Math.sign(dz) * 0.32],
          [s * (fx + 0.11), top - 0.05, dz - Math.sign(dz) * 0.55],
          0.035,
          8,
        );
    }
  }
  // Transoms and end beams across the truck; traction motors (dark drums) on each axle.
  for (const zz of [ends[0] + 0.15, ends[1] - 0.15])
    m.box(M.frame, [2 * fx, 0.22, 0.22], [0, top - 0.15, zz]);
  for (let i = 0; i + 1 < sorted.length; i++)
    m.box(M.frame, [2 * fx - 0.1, 0.24, 0.3], [0, top - 0.14, (sorted[i] + sorted[i + 1]) / 2]);
  for (const dz of zs)
    m.cyl(M.dark, 0.36, 0.36, 1.05, [0, r + 0.05, dz - 0.42 * Math.sign(dz || 1)], 'x', 12);
  m.emit(truck);
  for (const [axleName, dz] of axles)
    truck.add(wheelset(M, axleName, r, dz, { segments, bearing: 'loco' }));
  return truck;
}

/** Passenger truck: outboard journal boxes, H frame, air springs, yaw dampers, disc brakes. */
export function passengerTruck(M, name, z, axles, { r = 0.457, segments = 20 } = {}) {
  const truck = group(name, [0, 0, z]);
  const m = new Mesher();
  const zs = axles.map(([, dz]) => dz);
  const half = Math.max(...zs);
  const fx = 1.05,
    top = r + 0.32;
  const plate = [
    [-(half + 0.32), r + 0.02],
    [-(half + 0.32), r + 0.2],
    [-(half - 0.25), top - 0.02],
    [half - 0.25, top - 0.02],
    [half + 0.32, r + 0.2],
    [half + 0.32, r + 0.02],
    [half - 0.2, r + 0.02],
    [half - 0.45, r - 0.12],
    [-(half - 0.45), r - 0.12],
    [-(half - 0.2), r + 0.02],
  ];
  for (const s of [1, -1]) {
    m.slab(M.frame, plate, 0.16, 'zy', [s * fx + 0.08, 0, 0]);
    for (const dz of zs) {
      m.box(M.frame, [0.22, 0.26, 0.36], [s * fx, r, dz]);
      m.cyl(M.steel, 0.1, 0.1, 0.06, [s * (fx + 0.12), r, dz], 'x', 12);
      // Chevron primary springs (rubber) between box and frame.
      m.box(M.dark, [0.18, 0.12, 0.3], [s * fx, r + 0.19, dz - Math.sign(dz) * 0.02]);
    }
    // Air spring on the frame centre, yaw damper along the frame.
    m.cyl(M.dark, 0.26, 0.24, 0.24, [s * (fx - 0.05), top + 0.12, 0], 'y', 16);
    m.cyl(M.frame, 0.2, 0.2, 0.04, [s * (fx - 0.05), top + 0.26, 0], 'y', 16);
    m.rod(
      M.steel,
      [s * (fx + 0.13), top - 0.08, -0.4],
      [s * (fx + 0.13), top - 0.08, -1.25],
      0.04,
      8,
    );
    for (const dz of zs)
      m.box(M.dark, [0.1, 0.24, 0.05], [s * WHEEL_X, r, dz - Math.sign(dz) * (r + 0.03)]);
  }
  m.box(M.frame, [2 * fx, 0.24, 0.5], [0, top - 0.12, 0]);
  m.box(M.frame, [1.2, 0.18, 0.4], [0, top + 0.06, 0]);
  // Axle-mounted brake discs live on the spinning wheelsets; calipers stay on the frame.
  for (const dz of zs)
    for (const s of [1, -1])
      m.box(M.dark, [0.08, 0.22, 0.2], [s * 0.38, r + 0.02, dz - Math.sign(dz) * 0.3]);
  m.emit(truck);
  axles.forEach(([axleName, dz]) => {
    const ws = wheelset(M, axleName, r, dz, { segments, bearing: 'outboard' });
    // Two brake discs per axle, inside the wheels.
    const disc = new Mesher();
    for (const x of [-0.38, 0.38]) disc.cyl(M.steel, 0.3, 0.3, 0.1, [x, 0, 0], 'x', 16);
    disc.emit(ws.children[0], `${axleName}-disc`);
    truck.add(ws);
  });
  return truck;
}

// --- Couplers and end gear -----------------------------------------------------------------------

/**
 * AAR E-type coupler with its knuckle face at `face` (dir +1 front, -1 rear), shank back to the
 * striker at `striker`, carrier iron, uncoupling lever to the car's left corner (+X at the front
 * end, -X at the rear) and the brake-pipe hose with its angle cock and glad hand.
 */
export function coupler(
  m,
  M,
  dir,
  face,
  striker,
  { halfWidth = 1.5, sillY = 1.0, hoseX = 0.32 } = {},
) {
  const y = COUPLER_Y;
  const z = (d) => dir * d;
  // Head: knuckle on one side, guard arm on the other, lock lift on top.
  m.box(M.frame, [0.28, 0.27, 0.24], [0, y, z(face - 0.2)]);
  m.box(M.frame, [0.1, 0.25, 0.16], [dir * 0.1, y, z(face - 0.08)]);
  m.box(M.frame, [0.07, 0.2, 0.12], [-dir * 0.12, y, z(face - 0.07)]);
  m.box(M.frame, [0.06, 0.08, 0.06], [0, y + 0.17, z(face - 0.22)]);
  m.box(
    M.frame,
    [0.15, 0.15, Math.max(0.05, face - 0.3 - striker + 0.15)],
    [0, y, z((face - 0.3 + striker - 0.15) / 2)],
  );
  // Striker casting and carrier iron.
  m.box(M.frame, [0.5, 0.36, 0.08], [0, y + 0.02, z(striker)]);
  m.box(M.frame, [0.42, 0.04, 0.16], [0, y - 0.13, z(striker + 0.06)]);
  // Uncoupling lever: from the lock lift across to a bracket near the corner, handle bent down.
  const side = dir;
  m.path(
    M.frame,
    [
      [0, y + 0.22, z(face - 0.22)],
      [0, y + 0.3, z(striker + 0.08)],
      [side * (halfWidth - 0.25), y + 0.3, z(striker + 0.08)],
      [side * (halfWidth - 0.08), y + 0.3, z(striker + 0.08)],
      [side * (halfWidth - 0.08), y + 0.08, z(striker + 0.12)],
    ],
    0.014,
    5,
  );
  m.box(M.frame, [0.05, 0.08, 0.05], [side * (halfWidth - 0.6), y + 0.3, z(striker + 0.04)]);
  // Brake pipe: angle cock under the sill, hose hanging to the glad hand beside the coupler.
  const hx = -dir * hoseX;
  m.cyl(M.frame, 0.035, 0.035, 0.18, [hx, sillY - 0.12, z(striker - 0.05)], 'z', 8);
  m.box(M.safety, [0.04, 0.03, 0.08], [hx, sillY - 0.06, z(striker - 0.02)]);
  m.path(
    M.dark,
    [
      [hx, sillY - 0.14, z(striker + 0.04)],
      [hx, sillY - 0.3, z(striker + 0.16)],
      [hx * 0.9, y - 0.22, z(face - 0.2)],
      [hx * 0.8, y - 0.22, z(face - 0.06)],
    ],
    0.024,
    6,
  );
  m.box(M.frame, [0.1, 0.05, 0.08], [hx * 0.8, y - 0.22, z(face - 0.04)]);
}

/** Ladder: stiles from y0 to y1 at (x, z) on a wall facing `normal` ('x' or 'z'), rungs between. */
export function ladder(
  m,
  material,
  { x, z, y0, y1, width = 0.42, along = 'z', out = 0.07, rungs },
) {
  const count = rungs ?? Math.max(2, Math.round((y1 - y0) / 0.42));
  const pos = (u, y, o = 0) => (along === 'z' ? [x + o, y, z + u] : [x + u, y, z + o]);
  const sign = along === 'z' ? Math.sign(x) || 1 : Math.sign(z) || 1;
  for (const u of [-width / 2, width / 2]) {
    // Flat-bar stiles stand off the wall on short brackets.
    const size = along === 'z' ? [0.012, y1 - y0, 0.05] : [0.05, y1 - y0, 0.012];
    m.box(material, size, pos(u, (y0 + y1) / 2, sign * out));
    for (const y of [y0 + 0.08, y1 - 0.08])
      m.box(
        material,
        along === 'z' ? [out, 0.03, 0.03] : [0.03, 0.03, out],
        pos(u, y, (sign * out) / 2),
      );
  }
  for (let i = 0; i < count; i++) {
    const y = y0 + 0.12 + ((y1 - y0 - 0.2) * i) / Math.max(1, count - 1);
    m.rod(material, pos(-width / 2, y, sign * out), pos(width / 2, y, sign * out), 0.012, 5);
  }
}

/** U-shaped grab iron between two wall points, standing `out` along the wall normal. */
export function grab(m, material, a, b, normal, out = 0.07, radius = 0.012) {
  const n = new T.Vector3(...normal).normalize().multiplyScalar(out);
  const A = new T.Vector3(...a),
    B = new T.Vector3(...b);
  m.path(
    material,
    [A.toArray(), A.clone().add(n).toArray(), B.clone().add(n).toArray(), B.toArray()],
    radius,
    5,
  );
}

/** Sill step: a stirrup hanging below a corner of the side sill. */
export function sillStep(m, material, x, z, top, drop = 0.42, width = 0.36) {
  const s = Math.sign(x);
  m.path(
    material,
    [
      [x, top, z - width / 2],
      [x + s * 0.02, top - drop, z - width / 2],
      [x + s * 0.02, top - drop, z + width / 2],
      [x, top, z + width / 2],
    ],
    0.014,
    5,
  );
  m.box(material, [0.12, 0.012, width], [x - s * 0.04, top - drop, z]);
}

/** Vertical hand-brake wheel on an end (dir) at (x, y, zFace), with its housing and chain. */
export function brakeWheel(
  m,
  M,
  dir,
  x,
  y,
  zFace,
  { radius = 0.27, housing = true, material } = {},
) {
  const wheel = material ?? M.frame;
  const z = zFace + dir * 0.2;
  m.lathe(
    wheel,
    [
      [radius - 0.018, -0.012],
      [radius + 0.018, -0.012],
      [radius + 0.018, 0.012],
      [radius - 0.018, 0.012],
      [radius - 0.018, -0.012],
    ],
    20,
    'z',
    [x, y, z],
  );
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    m.rod(wheel, [x, y, z], [x + Math.cos(a) * radius, y + Math.sin(a) * radius, z], 0.012, 5);
  }
  m.cyl(wheel, 0.04, 0.04, 0.2, [x, y, zFace + dir * 0.1], 'z', 8);
  if (housing) {
    m.box(M.frame, [0.32, 0.4, 0.14], [x, y - 0.32, zFace + dir * 0.07]);
    m.box(M.frame, [0.12, 0.6, 0.06], [x, y - 0.8, zFace + dir * 0.05]);
  }
}

/** AB brake set under a car: cylinder, reservoir, control valve, rods and the retainer pipe. */
export function brakeGear(m, M, z, y = 0.9, x = 0.55, rods = true) {
  m.cyl(M.frame, 0.13, 0.13, 0.42, [x, y, z], 'z', 12);
  m.cyl(M.steel, 0.025, 0.025, 0.5, [x, y, z - 0.45], 'z', 6);
  m.cyl(M.frame, 0.16, 0.16, 0.9, [-x + 0.1, y + 0.02, z + 0.2], 'z', 12);
  m.box(M.frame, [0.3, 0.32, 0.26], [-x + 0.1, y, z - 0.55]);
  m.rod(M.frame, [-x + 0.1, y - 0.12, z - 0.4], [x, y - 0.12, z - 0.2], 0.015);
  if (!rods) return;
  m.rod(M.frame, [x, y, z - 0.7], [0.0, y - 0.05, z - 2.6], 0.02);
  m.rod(M.frame, [x, y, z + 0.21], [0.0, y - 0.05, z + 2.4], 0.02);
}

/** A row of FRA reflectors: small yellow squares along a side. */
export function reflectors(m, M, side, x, y, zs) {
  for (const z of zs) m.box(M.safety, [0.006, 0.1, 0.1], [x + side * 0.003, y, z]);
}

/** Corrugation profile (trapezoid ribs) as a list of [u, depth] points from u0 to u1. */
export function corrugations(u0, u1, pitch, depth, flat = 0.4) {
  const n = Math.max(1, Math.round((u1 - u0) / pitch));
  const p = (u1 - u0) / n;
  const pts = [[u0, 0]];
  for (let i = 0; i < n; i++) {
    const a = u0 + i * p;
    const w = (p * (1 - flat)) / 2;
    pts.push(
      [a + p * flat * 0.5, 0],
      [a + p * flat * 0.5 + w * 0.5, depth],
      [a + p - p * flat * 0.5 - w * 0.5, depth],
      [a + p - p * flat * 0.5, 0],
    );
  }
  pts.push([u1, 0]);
  return pts;
}

/** Map a scalar `t` through piecewise-linear `knots` [[t, v], ...]. */
export function piecewise(knots, t) {
  if (t <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++)
    if (t <= knots[i][0]) {
      const [t0, v0] = knots[i - 1],
        [t1, v1] = knots[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  return knots.at(-1)[1];
}

/** Small deterministic generator (integer LCG) for clutter such as scrap loads. */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

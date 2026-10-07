/**
 * Deterministic P-51D Mustang master. No network, bitmap textures or private dependencies.
 *
 * Frame: the nose faces +Z, +X is the pilot's left, Y is up and the origin is on the ground under
 * the wing. The airframe rests level on its wheels, as the airplane solver holds it on the ground,
 * and keeps the reference points entity.types.json uses: pilot eye (0, 2.28, 0.05), thrust line
 * y 1.58, wing reference (0, 1.08, 0). Proportions follow the real aircraft: 9.83 m long, 11.28 m
 * span, a laminar-flow wing with a straight trailing edge, root glove, 5° dihedral and squared
 * tips, a teardrop canopy behind a framed three-panel windscreen, the ventral radiator scoop, a
 * dorsal fillet and a 3.4 m four-blade Hamilton Standard propeller.
 *
 * Finish: natural metal with an olive-drab anti-glare panel, a red nose band, spinner and tail,
 * yellow wing bands and the 1943 star-and-bar insignia, all geometry lifted a few millimetres off
 * the skin so nothing z-fights. Surfaces are lofted from analytic sections with smooth normals and
 * modest segment counts: crisp polygonal silhouettes, clean shading.
 *
 * Bound nodes (entity.types.json `visual`): `propeller` spins about Z; `gear--1`, `gear-1` and
 * `tail-gear` hide when the gear is up; `flap±1` and `aileron±1` rotate about their local X, which a
 * parent `*-hinge` frame aligns with the hinge line; the cockpit nodes come from interior.mjs.
 * `elevator±1` (local X) and `rudder` (local Y) are hinged for future bindings. Generators must stay
 * byte-deterministic: use Math.pow for every exponent other than 2 or 0.5.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addInterior } from './interior.mjs';

// GLTFExporter uses FileReader only to pack its binary buffer in Node.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
const root = dirname(fileURLToPath(import.meta.url));
const interiorLayout = JSON.parse(await readFile(resolve(root, 'interior.json'), 'utf8'));

// ------------------------------------------------------------------------------ materials
const mat = (name, color, metalness = 0, roughness = 0.6, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, ...extra });
const silver = mat('natural-metal', '#c4cacf', 0.72, 0.3);
const panel = mat('natural-metal-panel', '#a9b0b6', 0.66, 0.4);
// The laminar-flow wings were filled and painted aluminium lacquer: duller than the bare fuselage.
const lacquer = mat('aluminium-lacquer', '#c2c7cb', 0.5, 0.42);
const red = mat('signal-red-paint', '#b81d18', 0.12, 0.38);
const olive = mat('olive-drab', '#4d5235', 0.04, 0.8);
const dark = mat('cockpit-charcoal', '#172026', 0.05, 0.78);
const green = mat('interior-green', '#53624a');
const rubber = mat('rubber', '#16191a', 0, 0.9);
const white = mat('ivory-markings', '#ecebe3', 0.02, 0.45);
const blue = mat('instrument-sky', '#33729c');
const brown = mat('instrument-earth', '#79583e');
const yellow = mat('warning-yellow', '#e7b52a', 0.05, 0.42);
const insignia = mat('insignia-blue', '#1b2a5e', 0.05, 0.48);
const blades = mat('propeller-black', '#141516', 0.25, 0.48);
const iron = mat('exhaust-iron', '#4a3d36', 0.5, 0.6);
const soot = mat('exhaust-stain', '#5d5c5a', 0.45, 0.55);
const navRed = mat('nav-light-red', '#d8261f', 0.1, 0.25, { emissive: '#8a0f0b' });
const navGreen = mat('nav-light-green', '#24b552', 0.1, 0.25, { emissive: '#0c6a2a' });
const ink = mat('luminous-instrument-ink', '#dce9cd', 0, 0.6, { emissive: '#dce9cd' });
ink.emissiveIntensity = 0.4;
const glass = new T.MeshStandardMaterial({
  name: 'clear-canopy',
  color: '#d5dfdf',
  transparent: true,
  opacity: 0.12,
  metalness: 0.05,
  roughness: 0.12,
  side: T.DoubleSide,
  depthWrite: false,
});

// ------------------------------------------------------------------------------ primitives
// The cockpit builder (interior.mjs) uses group/box/rod/sphere/mesh/lettering.
const GLYPHS = {
  A: ['010', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  S: ['111', '100', '111', '001', '111'],
  L: ['100', '100', '100', '100', '111'],
  T: ['111', '010', '010', '010', '010'],
  R: ['110', '101', '110', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  M: ['101', '111', '111', '101', '101'],
  V: ['101', '101', '101', '101', '010'],
  H: ['101', '101', '111', '101', '101'],
  D: ['110', '101', '101', '101', '110'],
  G: ['111', '100', '101', '101', '111'],
  0: ['111', '101', '101', '101', '111'],
  3: ['111', '001', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};
function lettering(parent, name, text, x, y, z, pixel = 0.0022) {
  const positions = [],
    normals = [],
    indices = [];
  [...text].forEach((char, c) => {
    (GLYPHS[char] ?? []).forEach((row, r) => {
      [...row].forEach((v, col) => {
        if (v !== '1') return;
        const px = x + ((text.length * 4) / 2 - c * 4 - col) * pixel,
          py = y + (2.5 - r) * pixel;
        const i = positions.length / 3;
        positions.push(
          px,
          py,
          z,
          px - pixel * 0.8,
          py,
          z,
          px - pixel * 0.8,
          py - pixel * 0.8,
          z,
          px,
          py - pixel * 0.8,
          z,
        );
        normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
        indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
      });
    });
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  mesh(parent, name, geo, ink);
}
function group(parent, name, pos = [0, 0, 0]) {
  const g = new T.Group();
  g.name = name;
  g.position.fromArray(pos);
  parent.add(g);
  return g;
}
function mesh(parent, name, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const obj = new T.Mesh(geometry, material);
  obj.name = name;
  obj.position.fromArray(pos);
  obj.scale.fromArray(scale);
  parent.add(obj);
  return obj;
}
function box(parent, name, size, pos, material = dark) {
  return mesh(parent, name, new T.BoxGeometry(...size), material, pos);
}
function sphere(parent, name, radii, pos, material) {
  return mesh(parent, name, new T.SphereGeometry(1, 14, 8), material, pos, radii);
}
function rod(parent, name, a, b, radius, material = silver) {
  const delta = new T.Vector3(...b).sub(new T.Vector3(...a));
  const obj = mesh(
    parent,
    name,
    new T.CylinderGeometry(radius, radius, delta.length(), 8),
    material,
    a,
  );
  obj.position.addScaledVector(delta, 0.5);
  obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return obj;
}

// ------------------------------------------------------------------------------ geometry kit
const DEG = Math.PI / 180;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const vec = (p) => new T.Vector3(...p);

/** Fritsch-Carlson monotone cubic through knots (xs ascending); never overshoots. */
function monotone(xs, ys) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i],
      t = (x - xs[i]) / h,
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}
/** Monotone curves for every column of a table keyed by its first column. */
function table(rows) {
  const keys = rows.map((row) => row[0]);
  const curves = rows[0].slice(1).map((_, k) =>
    monotone(
      keys,
      rows.map((row) => row[k + 1]),
    ),
  );
  return (x) => curves.map((f) => f(x));
}
/** Split [a, b] evenly into pieces no longer than `step`, endpoints included. */
function span(a, b, step) {
  const n = Math.max(1, Math.round(Math.abs(b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => (i === n ? b : a + ((b - a) * i) / n));
}
/** Concatenate spans that share endpoints. */
function spans(...parts) {
  const out = [];
  for (const part of parts) for (const v of part) if (out.at(-1) !== v) out.push(v);
  return out;
}
function geometryOf(positions, indices) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function pushTriangle(p, out, a, b, c) {
  const ux = p[b * 3] - p[a * 3],
    uy = p[b * 3 + 1] - p[a * 3 + 1],
    uz = p[b * 3 + 2] - p[a * 3 + 2];
  const vx = p[c * 3] - p[a * 3],
    vy = p[c * 3 + 1] - p[a * 3 + 1],
    vz = p[c * 3 + 2] - p[a * 3 + 2];
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  if (nx * nx + ny * ny + nz * nz > 1e-14) out.push(a, b, c);
}
/**
 * Loft rings of [x, y, z] points (equal length) into one smooth strip. `loop` closes each ring;
 * `skip(i, j)` drops the quad between rings i, i + 1 and points j, j + 1.
 */
function loft(rings, { loop = false, skip, normals } = {}) {
  const n = rings[0].length;
  const positions = [];
  for (const ring of rings) for (const p of ring) positions.push(p[0], p[1], p[2]);
  const indices = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < (loop ? n : n - 1); j++) {
      if (skip?.(i, j)) continue;
      const j1 = (j + 1) % n;
      const a = i * n + j,
        b = (i + 1) * n + j,
        c = (i + 1) * n + j1,
        d = i * n + j1;
      pushTriangle(positions, indices, a, b, c);
      pushTriangle(positions, indices, a, c, d);
    }
  const geo = geometryOf(positions, indices);
  if (normals) {
    geo.setAttribute('normal', new T.Float32BufferAttribute(normals.flat(2), 3));
    geo.userData.fixedNormals = true;
  }
  return geo;
}
/** Flat polygon, fanned from its centroid. */
function cap(points) {
  const c = [0, 0, 0];
  for (const p of points) for (let k = 0; k < 3; k++) c[k] += p[k] / points.length;
  const positions = [...c];
  for (const p of points) positions.push(...p);
  const indices = [];
  for (let i = 0; i < points.length; i++)
    pushTriangle(positions, indices, 0, 1 + i, 1 + ((i + 1) % points.length));
  return geometryOf(positions, indices);
}
/** Wind `geo` so most faces point away from inside(faceCentroid). */
function orient(geo, inside) {
  const pos = geo.getAttribute('position'),
    idx = geo.index.array;
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    m = new T.Vector3();
  let score = 0;
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(pos, idx[i]);
    b.fromBufferAttribute(pos, idx[i + 1]);
    c.fromBufferAttribute(pos, idx[i + 2]);
    m.copy(a).add(b).add(c).divideScalar(3);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    score += n.dot(m.clone().sub(inside(m))) >= 0 ? 1 : -1;
  }
  if (score < 0) {
    const flipped = Array.from(idx);
    for (let i = 0; i < flipped.length; i += 3)
      [flipped[i + 1], flipped[i + 2]] = [flipped[i + 2], flipped[i + 1]];
    geo.setIndex(flipped);
    if (!geo.userData.fixedNormals) geo.computeVertexNormals();
  }
  return geo;
}
const from = (point) => () => vec(point);
const ahead = (dz) => (m) => m.clone().add(new T.Vector3(0, 0, dz));

/** Static parts merge into one mesh per (parent, name, material) when the model is finished. */
const batches = new Map();
function add(parent, name, material, geometry) {
  const key = `${parent.uuid}|${name}|${material.name}`;
  if (!batches.has(key)) batches.set(key, { parent, name, material, parts: [] });
  geometry.deleteAttribute('uv');
  if (!geometry.index)
    geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  batches.get(key).parts.push(geometry);
  return geometry;
}
function flush() {
  for (const { parent, name, material, parts } of batches.values())
    mesh(parent, name, parts.length === 1 ? parts[0] : mergeGeometries(parts), material);
  batches.clear();
}
/** Temporary meshes of everything batched under `name` so far (for projecting markings). */
function batched(name) {
  return [...batches.values()]
    .filter((entry) => entry.name === name)
    .flatMap((entry) => entry.parts.map((geo) => new T.Mesh(geo)));
}
/** Cylinder from a to b (radius ra at a, rb at b). */
function tubeBetween(a, b, ra, sides = 10, rb = ra) {
  const start = vec(a),
    delta = vec(b).sub(start);
  const geo = new T.CylinderGeometry(rb, ra, delta.length(), sides, 1);
  geo.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()),
  );
  geo.translate(...start.addScaledVector(delta, 0.5).toArray());
  return geo;
}
function curveTube(points, radius, sides = 6) {
  return new T.TubeGeometry(
    new T.CatmullRomCurve3(points.map(vec), false, 'centripetal'),
    Math.max(6, points.length * 2),
    radius,
    sides,
    false,
  );
}
/** A frame at `a` whose local +X runs toward `b` and whose local Y is as close to up as it can be. */
function hinge(parent, name, a, b) {
  const x = vec(b).sub(vec(a)).normalize();
  const z = new T.Vector3().crossVectors(x, new T.Vector3(0, 1, 0)).normalize();
  const y = new T.Vector3().crossVectors(z, x);
  const frame = group(parent, name, a);
  frame.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return frame;
}
/** Re-express root-frame geometry in the local space of `frame` (a direct child of the root). */
function into(frame, geometry) {
  frame.updateMatrix();
  return geometry.applyMatrix4(frame.matrix.clone().invert());
}
/** Rings around a local X axle at `center`: tyre/hub profile of [radius, axial offset] pairs. */
function wheelGeometry(profile, center, sides = 28) {
  const rings = profile.map(([r, w]) =>
    Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      return [center[0] + w, center[1] + r * Math.cos(a), center[2] + r * Math.sin(a)];
    }),
  );
  return orient(loft(rings, { loop: true }), (m) => new T.Vector3(m.x, center[1], center[2]));
}

// ------------------------------------------------------------------------------ fuselage
const SILL = 2.07;
const COCKPIT = { front: 1.08, rear: -0.95 };
const SIDES = 40;
// Stations, tail to nose: z, top, bottom, half width, height of the widest line, superellipse
// exponents of the upper and lower halves. Cockpit stations shape the sides only: everything
// above the canopy sill is cut away there.
const fuselageAt = table([
  [-5.3, 1.745, 1.52, 0.075, 1.63, 2.0, 2.0],
  [-5.0, 1.765, 1.48, 0.11, 1.63, 2.0, 2.0],
  [-4.4, 1.81, 1.4, 0.165, 1.635, 2.0, 2.0],
  [-3.7, 1.87, 1.3, 0.225, 1.64, 2.05, 2.0],
  [-3.0, 1.94, 1.19, 0.285, 1.65, 2.1, 2.0],
  [-2.3, 2.02, 1.07, 0.345, 1.67, 2.2, 2.1],
  [-1.6, 2.11, 0.975, 0.4, 1.69, 2.4, 2.2],
  [-1.1, 2.17, 0.935, 0.43, 1.7, 2.7, 2.3],
  [-0.7, 2.2, 0.915, 0.455, 1.7, 3.4, 2.35],
  [-0.2, 2.21, 0.905, 0.465, 1.69, 3.5, 2.4],
  [0.4, 2.2, 0.9, 0.47, 1.68, 3.5, 2.4],
  [0.85, 2.17, 0.9, 0.47, 1.67, 3.5, 2.4],
  [1.1, 2.135, 0.905, 0.468, 1.66, 3.5, 2.35],
  [1.5, 2.1, 0.915, 0.46, 1.64, 3.0, 2.3],
  [1.9, 2.08, 0.93, 0.45, 1.62, 2.7, 2.25],
  [2.3, 2.06, 0.96, 0.44, 1.6, 2.4, 2.2],
  [2.7, 2.03, 1.01, 0.43, 1.59, 2.25, 2.15],
  [3.0, 2.0, 1.08, 0.41, 1.58, 2.1, 2.1],
  [3.2, 1.965, 1.15, 0.385, 1.58, 2.0, 2.0],
  [3.32, 1.935, 1.225, 0.355, 1.58, 2.0, 2.0],
]);
function station(z) {
  const [top, bot, hw, wy, nT, nB] = fuselageAt(z);
  return { z, top, bot, hw, wy, nT, nB };
}
/** Point on a section at angle a (0 = +X, π/2 = top), on a skin grown by `inflate`. */
function sectionPoint(s, a, inflate = 0) {
  const c = Math.cos(a),
    n = Math.sin(a);
  const up = n >= 0,
    e = up ? s.nT : s.nB;
  const h = (up ? s.top - s.wy : s.wy - s.bot) + inflate;
  return [(s.hw + inflate) * spow(c, 2 / e), s.wy + h * spow(n, 2 / e), s.z];
}
/** Half width of a section at height y. */
function halfWidth(s, y, inflate = 0) {
  const up = y >= s.wy,
    e = up ? s.nT : s.nB;
  const h = (up ? s.top - s.wy : s.wy - s.bot) + inflate;
  const f = clamp01(Math.abs(y - s.wy) / h);
  return (s.hw + inflate) * Math.pow(1 - Math.pow(f, e), 1 / e);
}
/** Height of the upper skin above x (|x| inside the section). */
function topAt(s, x, inflate = 0) {
  const f = clamp01(Math.abs(x) / (s.hw + inflate));
  return s.wy + (s.top - s.wy + inflate) * Math.pow(1 - Math.pow(f, s.nT), 1 / s.nT);
}
const sillWidth = (z) => halfWidth(station(z), SILL);
/**
 * Outward unit normal of the analytic skin. Shading from the surface itself rather than from
 * neighbouring facets keeps uneven station spacing (around the cockpit cut) free of seams.
 */
function sectionNormal(z, a, inflate = 0) {
  const h = 1e-4;
  const at = (zz, aa) => vec(sectionPoint(station(zz), aa, inflate));
  const n = new T.Vector3()
    .crossVectors(at(z, a + h).sub(at(z, a - h)), at(z + h, a).sub(at(z - h, a)))
    .normalize();
  const p = at(z, a);
  if (n.x * p.x + n.y * (p.y - station(z).wy) < 0) n.negate();
  return n.toArray();
}
const ANGLES = Array.from({ length: SIDES }, (_, j) => (j / SIDES) * Math.PI * 2);
/** Skin rings; inside the cockpit opening, points above the sill fold onto the sill. */
function skinRings(zs, inflate = 0, sill = SILL) {
  const cut = [],
    normals = [];
  const rings = zs.map((z) => {
    const s = station(z),
      open = z >= COCKPIT.rear - 1e-9 && z <= COCKPIT.front + 1e-9;
    const flags = [],
      ringNormals = [];
    // Angle where the side meets the sill: folded points take the side wall's normal there.
    const rise = clamp01((sill - s.wy) / (s.top - s.wy + inflate));
    const sillAngle = Math.asin(Math.pow(rise, s.nT / 2));
    const ring = ANGLES.map((a) => {
      const p = sectionPoint(s, a, inflate);
      const folded = open && p[1] > sill;
      flags.push(folded);
      const left = p[0] < 0;
      ringNormals.push(
        sectionNormal(z, folded ? (left ? Math.PI - sillAngle : sillAngle) : a, inflate),
      );
      return folded ? [(left ? -1 : 1) * halfWidth(s, sill, inflate), sill, z] : p;
    });
    cut.push(flags);
    normals.push(ringNormals);
    return ring;
  });
  const skip = (i, j) => {
    const j1 = (j + 1) % SIDES;
    return cut[i][j] && cut[i][j1] && cut[i + 1][j] && cut[i + 1][j1];
  };
  return { rings, skip, normals };
}
const fuselageAxis = (m) => new T.Vector3(0, station(m.z).wy, m.z);

function buildFuselage(g) {
  const zs = spans(
    span(-5.3, -1.0, 0.22),
    [-1.0, COCKPIT.rear],
    span(COCKPIT.rear, COCKPIT.front, 0.16),
    [COCKPIT.front, 1.1],
    span(1.1, 2.95, 0.2),
  );
  const skin = skinRings(zs);
  const fuselage = orient(
    loft(skin.rings, { loop: true, skip: skin.skip, normals: skin.normals }),
    fuselageAxis,
  );
  mesh(g, 'fuselage', fuselage, silver);
  const band = skinRings(span(2.95, 3.32, 0.1));
  mesh(
    g,
    'red-engine-cowl',
    orient(loft(band.rings, { loop: true, normals: band.normals }), fuselageAxis),
    red,
  );
  const tail = station(-5.3);
  add(
    g,
    'fuselage',
    silver,
    orient(cap(ANGLES.map((a) => sectionPoint(tail, a))), from([0, 1.63, -4])),
  );
  const face = station(3.32);
  add(
    g,
    'engine-face',
    dark,
    orient(cap(ANGLES.map((a) => sectionPoint(face, a))), from([0, 1.58, 3])),
  );

  // Cockpit tub lining (facing inward) and the sill ledge joining it to the skin.
  const liningZ = span(COCKPIT.rear, COCKPIT.front, 0.16);
  const lining = skinRings(liningZ, -0.018, SILL - 0.004);
  const liningGeo = loft(lining.rings, {
    loop: true,
    skip: lining.skip,
    normals: lining.normals.map((ring) => ring.map(([x, y, z]) => [-x, -y, -z])),
  });
  mesh(
    g,
    'fuselage-interior',
    orient(liningGeo, (m) => fuselageAxis(m).multiplyScalar(2).sub(m)),
    green,
  );
  for (const side of [-1, 1]) {
    const rings = liningZ.map((z) => [
      [side * sillWidth(z), SILL, z],
      [side * halfWidth(station(z), SILL - 0.004, -0.018), SILL - 0.004, z],
    ]);
    add(g, 'cockpit-sill', silver, orient(loft(rings), from([0, 1.2, 0])));
  }
}

// ------------------------------------------------------------------------------ lifting surfaces
/** Laminar-style half thickness: 0.5 at 40% chord, round nose, thin trailing edge. */
function halfThickness(u) {
  if (u <= 0.4) {
    const v = u / 0.4;
    return 0.5 * Math.sqrt(Math.max(0, 2 * v - v * v));
  }
  const w = (u - 0.4) / 0.6;
  return 0.5 * (0.02 + 0.98 * Math.pow(Math.cos((w * Math.PI) / 2), 1.15));
}
// Chordwise samples: fractions of the chord ahead of the hinge, and of the chord behind it.
const FORE = [0, 0.004, 0.016, 0.04, 0.08, 0.13, 0.2, 0.29, 0.39, 0.5, 0.62, 0.74, 0.87, 1];
const AFT = [0, 0.33, 0.67, 1];
const foreU = (st) => FORE.map((f) => f * st.hinge);
const aftU = (st) => AFT.map((f) => st.hinge + f * (1 - st.hinge));
/**
 * Builders for a lifting surface whose `point(station, u, face)` maps chord fraction u
 * (0 = leading edge) and face (+1 upper/left, -1 lower/right, 0 camber line) to [x, y, z].
 */
function airfoil(point) {
  const loop = (st, us) => [
    ...us
      .slice()
      .reverse()
      .map((u) => point(st, u, 1)),
    ...us.slice(1).map((u) => point(st, u, -1)),
  ];
  const fullU = (st) => [...foreU(st), ...aftU(st).slice(1)];
  return {
    fore: (sts) => loft(sts.map((st) => loop(st, foreU(st)))),
    full: (sts) => loft(sts.map((st) => loop(st, fullU(st)))),
    hingeFace: (sts) => loft(sts.map((st) => [point(st, st.hinge, 1), point(st, st.hinge, -1)])),
    aftFace: (sts, face) => loft(sts.map((st) => aftU(st).map((u) => point(st, u, face)))),
    trailing: (sts) => loft(sts.map((st) => [point(st, 1, 1), point(st, 1, -1)])),
    aftCap: (st) =>
      cap([
        ...aftU(st).map((u) => point(st, u, 1)),
        ...aftU(st)
          .reverse()
          .map((u) => point(st, u, -1)),
      ]),
    fullCap: (st) => cap(loop(st, fullU(st))),
  };
}
/** Geometry of the aft (control-surface) part between stations, every face oriented. */
function aftPart(af, sts, inside) {
  return [
    orient(af.aftFace(sts, 1), inside),
    orient(af.aftFace(sts, -1), inside),
    orient(af.trailing(sts), ahead(0.3)),
    orient(af.hingeFace(sts), ahead(-0.3)),
  ];
}

// Wing: straight trailing edge, leading-edge sweep from taper, root glove, squared tips.
const WING = { te: -0.88, root: 2.65, tip: 1.27, semi: 5.64, y0: 1.1, dihedral: 5 * DEG };
const BAND = [2.7, 3.05];
const FLAP = [0.3, 3.25];
const AILERON = [3.25, 5.33];
const wingLE = (s) => WING.te + WING.root - ((WING.root - WING.tip) * s) / WING.semi;
const wingChordY = (s) => WING.y0 + s * Math.tan(WING.dihedral);
// Squared tip with rounded corners: leading/trailing edge pull-in and thickness scale.
const WING_TIP = [
  [5.33, 0, 0, 1],
  [5.45, 0.012, 0.002, 0.97],
  [5.53, 0.045, 0.01, 0.9],
  [5.59, 0.11, 0.03, 0.78],
  [5.625, 0.22, 0.075, 0.6],
  [5.64, 0.4, 0.15, 0.3],
];
const wingTip = table(WING_TIP);
function wingStation(s) {
  const [inLE, inTE, scale] = s > WING_TIP[0][0] ? wingTip(s) : [0, 0, 1];
  const le = wingLE(s) - inLE,
    te = WING.te + inTE;
  const glove = Math.max(0, 2.02 - 0.42 * s - wingLE(s));
  return { s, le, chord: le - te, glove, t: (0.155 - (0.04 * s) / WING.semi) * scale, hinge: 0.76 };
}
const wingPoint = (side) => (st, u, face) => {
  const z = st.le - u * st.chord + (u < 0.4 ? st.glove * (1 - u / 0.4) : 0);
  const camber = 0.048 * u * (1 - u);
  const y =
    wingChordY(st.s) + st.chord * (camber + face * st.t * halfThickness(u) * (1 + st.glove * 0.35));
  return [side * st.s, y, z];
};
const wingInside = (m) => new T.Vector3(m.x, wingChordY(Math.abs(m.x)) + 0.012, m.z);

function buildWings(g) {
  const fore = spans(
    span(0, 1.43, 0.36),
    span(1.43, BAND[0], 0.42),
    [BAND[0], BAND[1]],
    span(BAND[1], AILERON[1], 0.46),
  );
  const tip = WING_TIP.map((row) => row[0]);
  for (const side of [-1, 1]) {
    const af = airfoil(wingPoint(side));
    const name = `wing-${side}`;
    const forward = (list, material, label) => {
      const sts = list.map(wingStation);
      add(g, label, material, orient(af.fore(sts), wingInside));
      add(g, label, material, orient(af.hingeFace(sts), ahead(0.3)));
    };
    forward(
      fore.filter((s) => s <= BAND[0]),
      lacquer,
      name,
    );
    forward(BAND, yellow, `${name}-band`);
    forward(
      fore.filter((s) => s >= BAND[1]),
      lacquer,
      name,
    );
    const tipSts = tip.map(wingStation);
    add(g, name, lacquer, orient(af.full(tipSts), wingInside));
    add(g, name, lacquer, orient(af.trailing(tipSts), ahead(0.3)));
    add(g, name, lacquer, orient(af.aftCap(tipSts[0]), from([side * 7, 1.5, -0.7])));
    add(g, name, lacquer, orient(af.fullCap(tipSts.at(-1)), from([side * 4, 1.5, -0.2])));

    // Control surfaces: frames along the hinge lines, so local X rotation deflects them.
    const control = (label, range, cuts) => {
      const a = wingPoint(side)(wingStation(range[0]), 0.76, 0);
      const b = wingPoint(side)(wingStation(range[1]), 0.76, 0);
      const frame = hinge(g, `${label}-${side}-hinge`, side > 0 ? a : b, side > 0 ? b : a);
      const moving = group(frame, `${label}-${side}`);
      for (const [lo, hi, paint] of cuts) {
        const sts = span(lo, hi, 0.46).map(wingStation);
        const part = paint === yellow ? `${label}-band` : `${label}-surface`;
        for (const geo of aftPart(af, sts, wingInside)) add(moving, part, paint, into(frame, geo));
      }
      for (const [s, out] of [
        [range[0], -1],
        [range[1], 1],
      ])
        add(
          moving,
          `${label}-surface`,
          panel,
          into(frame, orient(af.aftCap(wingStation(s)), from([side * (s - out), 1.3, -0.7]))),
        );
    };
    control('flap', FLAP, [
      [FLAP[0], BAND[0], panel],
      [BAND[0], BAND[1], yellow],
      [BAND[1], FLAP[1], panel],
    ]);
    control('aileron', AILERON, [[AILERON[0], AILERON[1], panel]]);

    // Gun muzzles in the leading edge, wingtip navigation light, pitot under the right wing.
    for (const s of [2.18, 2.4, 2.62]) {
      const lead = wingPoint(side)(wingStation(s), 0, 0);
      add(
        g,
        'gun-muzzles',
        dark,
        tubeBetween(
          [lead[0], lead[1] - 0.01, lead[2] - 0.12],
          [lead[0], lead[1] - 0.01, lead[2] + 0.035],
          0.022,
          8,
        ),
      );
    }
    const end = wingStation(5.64);
    const light = wingPoint(side)(end, 0.2, 0);
    add(
      g,
      'nav-light',
      side > 0 ? navRed : navGreen,
      new T.SphereGeometry(0.03, 10, 6).translate(side * (WING.semi - 0.015), light[1], light[2]),
    );
    if (side < 0) {
      const st = wingStation(4.85),
        root = wingPoint(side)(st, 0.25, -1);
      add(
        g,
        'pitot',
        silver,
        tubeBetween(
          [root[0], root[1] + 0.03, root[2]],
          [root[0], root[1] - 0.13, root[2] + 0.04],
          0.012,
          6,
        ),
      );
      add(
        g,
        'pitot',
        silver,
        tubeBetween(
          [root[0], root[1] - 0.13, root[2] + 0.04],
          [root[0], root[1] - 0.13, root[2] + 0.46],
          0.011,
          6,
        ),
      );
    }
  }
}

// ------------------------------------------------------------------------------ empennage
const RUDDER_HINGE = -5.13;
const ELEVATOR_HINGE = -5.08;
const TAIL_Y = 1.66;
// Vertical tail, by height: y, leading edge z, trailing edge z, thickness ratio.
const VTAIL = [
  [1.52, -5.13, -5.66, 0.09],
  [1.62, -3.72, -5.71, 0.09],
  [1.95, -3.72, -5.77, 0.09],
  [2.28, -4.03, -5.78, 0.088],
  [2.61, -4.34, -5.745, 0.086],
  [2.89, -4.61, -5.66, 0.084],
  [3.03, -4.76, -5.585, 0.08],
  [3.105, -4.87, -5.5, 0.072],
  [3.148, -4.99, -5.4, 0.06],
  [3.167, -5.12, -5.27, 0.035],
];
// Horizontal tail, by span: s, leading edge z, trailing edge z, thickness ratio.
const HTAIL = [
  [0, -4.22, -5.54, 0.11],
  [0.5, -4.32, -5.52, 0.106],
  [1.0, -4.43, -5.49, 0.102],
  [1.5, -4.55, -5.45, 0.098],
  [1.8, -4.63, -5.42, 0.094],
  [1.93, -4.665, -5.4, 0.09],
  [1.995, -4.7, -5.375, 0.086],
  [2.03, -4.76, -5.33, 0.074],
  [2.045, -4.86, -5.25, 0.05],
];
const vtailAt = table(VTAIL);
const htailAt = table(HTAIL);
function tailStation(at, key, hingeZ) {
  const [le, te, t] = at(key);
  return { key, le, chord: le - te, t, hinge: clamp01((le - hingeZ) / (le - te)) };
}
const finPoint = (st, u, face) => [
  face * st.t * st.chord * halfThickness(u),
  st.key,
  st.le - u * st.chord,
];
const stabPoint = (side) => (st, u, face) => [
  side * st.key,
  TAIL_Y + face * st.t * st.chord * halfThickness(u),
  st.le - u * st.chord,
];

function buildTail(g) {
  // Fin and dorsal fillet (fixed), rudder on a vertical hinge.
  const fin = airfoil(finPoint);
  const finInside = (m) => new T.Vector3(0, m.y, m.z);
  const heights = spans(
    span(1.62, VTAIL[5][0], 0.34),
    VTAIL.slice(5).map((row) => row[0]),
  );
  const finSts = heights.map((y) => tailStation(vtailAt, y, RUDDER_HINGE));
  add(g, 'vertical-fin', red, orient(fin.fore(finSts), finInside));
  add(g, 'vertical-fin', red, orient(fin.hingeFace(finSts), ahead(0.3)));
  const rudder = group(g, 'rudder', [0, 2.4, RUDDER_HINGE]);
  const rudderSts = [VTAIL[0][0], ...heights].map((y) => tailStation(vtailAt, y, RUDDER_HINGE));
  for (const geo of aftPart(fin, rudderSts, finInside))
    add(rudder, 'rudder-surface', red, into(rudder, geo));
  add(
    rudder,
    'rudder-surface',
    red,
    into(rudder, orient(fin.aftCap(rudderSts[0]), from([0, 2.5, -5.4]))),
  );
  const top = rudderSts.at(-1);
  add(
    rudder,
    'rudder-surface',
    red,
    into(rudder, orient(cap(airfoilLoop(finPoint, top)), from([0, 2.5, -5.2]))),
  );

  const fillet = table([
    [-3.95, 2.24, 0.075],
    [-3.72, 2.16, 0.07],
    [-3.4, 2.085, 0.06],
    [-3.0, 2.015, 0.045],
    [-2.55, 1.985, 0.02],
  ]);
  const filletRings = span(-3.95, -2.55, 0.18).map((z) => {
    const [ridge, hw] = fillet(z),
      base = station(z).top - 0.05;
    return [
      [-hw, base, z],
      [-hw * 0.55, lerpY(base, ridge, 0.72), z],
      [0, ridge, z],
      [hw * 0.55, lerpY(base, ridge, 0.72), z],
      [hw, base, z],
    ];
  });
  add(g, 'vertical-fin', red, orient(loft(filletRings), finInside));

  // Stabilisers (fixed) and elevators on a hinge along X.
  for (const side of [-1, 1]) {
    const af = airfoil(stabPoint(side));
    const inside = (m) => new T.Vector3(m.x, TAIL_Y, m.z);
    const spanS = spans(
      span(0, 1.8, 0.45),
      HTAIL.slice(5).map((row) => row[0]),
    );
    const sts = spanS.map((s) => tailStation(htailAt, s, ELEVATOR_HINGE));
    const elevatorEnd = HTAIL[5][0];
    add(g, `tailplane-${side}`, red, orient(af.fore(sts), inside));
    add(g, `tailplane-${side}`, red, orient(af.hingeFace(sts), ahead(0.3)));
    const tipSts = sts.filter((st) => st.key >= elevatorEnd);
    for (const geo of aftPart(af, tipSts, inside)) add(g, `tailplane-${side}`, red, geo);
    add(
      g,
      `tailplane-${side}`,
      red,
      orient(af.fullCap(sts.at(-1)), from([side * 1.5, TAIL_Y, -4.8])),
    );
    const elevator = group(g, `elevator-${side}`, [side * 0.12, TAIL_Y, ELEVATOR_HINGE]);
    const elevSts = spans([0.12], span(0.5, 1.8, 0.45), [elevatorEnd]).map((s) =>
      tailStation(htailAt, s, ELEVATOR_HINGE),
    );
    for (const geo of aftPart(af, elevSts, inside))
      add(elevator, 'elevator-surface', red, into(elevator, geo));
    for (const [st, out] of [
      [elevSts[0], -1],
      [elevSts.at(-1), 1],
    ])
      add(
        elevator,
        'elevator-surface',
        red,
        into(elevator, orient(af.aftCap(st), from([side * (st.key - out), TAIL_Y, -5.3]))),
      );
  }
}
const lerpY = (a, b, t) => a + (b - a) * t;
function airfoilLoop(point, st) {
  const us = [...foreU(st), ...aftU(st).slice(1)];
  return [
    ...us.map((u) => point(st, u, 1)),
    ...us
      .slice(1, -1)
      .reverse()
      .map((u) => point(st, u, -1)),
  ];
}

// ------------------------------------------------------------------------------ belly scoops
/** Rounded-rectangle ring: z, bottom y, half width, top y, lower/upper exponents. */
function scoopRing(z, bottom, hw, top, nLow, nHigh, count = 28, inset = 0) {
  const cy = (top + bottom) / 2,
    hh = (top - bottom) / 2 - inset;
  return Array.from({ length: count }, (_, k) => {
    const a = (k / count) * Math.PI * 2,
      s = Math.sin(a),
      e = s >= 0 ? nHigh : nLow;
    return [(hw - inset) * spow(Math.cos(a), 2 / e), cy + hh * spow(s, 2 / e), z];
  });
}
function buildScoops(g) {
  // Ventral radiator: inlet lip clear of the belly (boundary-layer gap), exit behind the wing.
  const radiator = table([
    [-2.32, 0.88, 0.2, 1.22, 3.0, 8],
    [-2.1, 0.79, 0.225, 1.22, 3.0, 8],
    [-1.7, 0.65, 0.265, 1.22, 3.2, 8],
    [-1.2, 0.55, 0.292, 1.18, 3.4, 8],
    [-0.7, 0.515, 0.3, 1.1, 3.4, 8],
    [-0.3, 0.53, 0.29, 1.02, 3.4, 6],
    [-0.15, 0.55, 0.27, 0.875, 3.2, 3.2],
  ]);
  const ring = (z, inset = 0) => scoopRing(z, ...radiator(z), 28, inset);
  const axis = (m) => new T.Vector3(0, 0.8, m.z);
  const zs = spans(span(-2.32, -0.3, 0.2), [-0.22, -0.15]);
  add(
    g,
    'ventral-radiator',
    silver,
    orient(
      loft(
        zs.map((z) => ring(z)),
        { loop: true },
      ),
      axis,
    ),
  );
  const lip = [ring(-0.15), ring(-0.15, 0.028).map(([x, y]) => [x, y, -0.2])];
  add(
    g,
    'ventral-radiator',
    silver,
    orient(loft(lip, { loop: true }), (m) => axis(m).setZ(-1)),
  );
  const duct = ring(-0.15, 0.028).map(([x, y]) => [x, y, -0.34]);
  add(g, 'ventral-radiator', silver, orient(loft([lip[1], duct], { loop: true }), axis));
  add(g, 'radiator-inlet', dark, orient(cap(duct), from([0, 0.75, -1])));
  add(g, 'radiator-inlet', dark, orient(cap(ring(-2.32, 0.012)), from([0, 0.95, 0])));

  // Carburettor air intake under the spinner.
  const chin = table([
    [2.15, 0.94, 0.06, 1.03, 3, 3],
    [2.45, 0.95, 0.105, 1.08, 3, 3],
    [2.75, 0.965, 0.13, 1.14, 3, 3],
    [3.05, 0.995, 0.135, 1.2, 3, 3],
    [3.22, 1.03, 0.125, 1.26, 3, 3],
  ]);
  const chinRings = span(2.15, 3.22, 0.18).map((z) => scoopRing(z, ...chin(z), 20));
  add(
    g,
    'carburettor-intake',
    silver,
    orient(loft(chinRings, { loop: true }), (m) => new T.Vector3(0, 1.1, m.z)),
  );
  add(
    g,
    'carburettor-intake',
    dark,
    orient(cap(scoopRing(3.225, ...chin(3.22), 20, 0.018)), from([0, 1.1, 3])),
  );
}

// ------------------------------------------------------------------------------ canopy
const WINDSCREEN = { base: 1.1, top: 0.62 };
// Bubble sections: z, height above the sill, superellipse exponent, base half width (0 = sill).
const bubbleAt = table([
  [-1.33, 0.1, 2.2, 0.025],
  [-1.25, 0.13, 2.4, 0.12],
  [-1.15, 0.18, 2.6, 0.235],
  [-1.03, 0.255, 2.6, 0.335],
  [-0.88, 0.355, 2.45, 0],
  [-0.68, 0.47, 2.35, 0],
  [-0.42, 0.57, 2.3, 0],
  [-0.12, 0.628, 2.3, 0],
  [0.18, 0.632, 2.35, 0],
  [0.42, 0.585, 2.45, 0],
  [0.62, 0.495, 2.6, 0],
]);
function bubblePoint(z, a) {
  const [hc, n, override] = bubbleAt(z);
  const wc = z > -0.95 ? sillWidth(z) + 0.004 : override;
  return [wc * spow(Math.cos(a), 2 / n), SILL + hc * Math.pow(Math.sin(a), 2 / n), z];
}
function buildCanopy(g) {
  const arch = span(0, Math.PI, Math.PI / 20);
  const zs = spans(span(-1.33, -0.95, 0.1), span(-0.95, WINDSCREEN.top, 0.13));
  const rings = zs.map((z) => arch.map((a) => bubblePoint(z, a)));
  add(
    g,
    'bubble-canopy',
    glass,
    orient(loft(rings), (m) => new T.Vector3(0, SILL, m.z)),
  );

  // Three-panel windscreen: flat bullet-resistant centre panel, two-facet side panels.
  const topCorners = [0, 50 * DEG, 72 * DEG].map((a) => bubblePoint(WINDSCREEN.top, a));
  const base = station(WINDSCREEN.base);
  const baseX = [sillWidth(WINDSCREEN.base), sillWidth(WINDSCREEN.base) * 0.8, 0.19];
  const baseCorners = baseX.map((x, i) => [
    x,
    i === 0 ? SILL : topAt(base, x) + 0.004,
    WINDSCREEN.base,
  ]);
  const mirror = (p) => [-p[0], p[1], p[2]];
  const top = [...topCorners, ...topCorners.slice().reverse().map(mirror)];
  const bottom = [...baseCorners, ...baseCorners.slice().reverse().map(mirror)];
  for (let k = 0; k < top.length - 1; k++)
    add(
      g,
      'canopy-windscreen',
      glass,
      orient(
        loft([
          [bottom[k], bottom[k + 1]],
          [top[k], top[k + 1]],
        ]),
        from([0, 2.1, 0.4]),
      ),
    );
  const frame = (points, r = 0.016) => add(g, 'canopy-frame', silver, curveTube(points, r));
  frame(bottom, 0.018);
  for (const k of [2, 3]) frame([bottom[k], top[k]]);
  frame([top[2], top[3]], 0.02);
  frame(
    arch.map((a) => bubblePoint(WINDSCREEN.top - 0.01, a)),
    0.024,
  );
  for (const side of [-1, 1])
    frame(
      span(WINDSCREEN.top, -1.0, 0.1).map((z) => [
        side * (z > -0.95 ? sillWidth(z) + 0.008 : bubbleAt(z)[2] + 0.008),
        SILL + 0.006,
        z,
      ]),
      0.017,
    );
}

// ------------------------------------------------------------------------------ nose
const PROP_Z = 3.5;
const SPINNER = { base: 3.32, length: 0.73, radius: 0.355 };
function buildNose(g) {
  // Spinner: ogive cone.
  const ts = [0, 0.08, 0.18, 0.3, 0.42, 0.54, 0.65, 0.75, 0.84, 0.91, 0.96, 0.99];
  const rings = ts.map((t) => {
    const r = SPINNER.radius * Math.pow(1 - Math.pow(t, 1.35), 0.75);
    return Array.from({ length: 28 }, (_, k) => {
      const a = (k / 28) * Math.PI * 2;
      return [r * Math.cos(a), 1.58 + r * Math.sin(a), SPINNER.base + t * SPINNER.length];
    });
  });
  const spinnerGeo = orient(loft(rings, { loop: true }), (m) => new T.Vector3(0, 1.58, m.z));
  const tip = orient(cap(rings.at(-1)), from([0, 1.58, 3.6]));
  mesh(g, 'spinner', mergeGeometries([spinnerGeo, tip]), red);

  // Hamilton Standard paddle blades: r, chord, thickness, blade angle (degrees).
  const BLADE = [
    [0.26, 0.1, 0.085, 62],
    [0.4, 0.13, 0.062, 55],
    [0.55, 0.205, 0.042, 47],
    [0.75, 0.262, 0.032, 40],
    [1.0, 0.287, 0.026, 33],
    [1.25, 0.28, 0.021, 28],
    [1.45, 0.255, 0.017, 25],
    [1.58, 0.215, 0.014, 23],
    [1.66, 0.16, 0.011, 22],
    [1.7, 0.075, 0.007, 21],
  ];
  const section = ([r, chord, thick, beta]) => {
    const b = beta * DEG,
      cb = Math.cos(b),
      sb = Math.sin(b);
    return Array.from({ length: 12 }, (_, k) => {
      const phi = (k / 12) * Math.PI * 2;
      const u = (chord / 2) * Math.cos(phi),
        w = (thick / 2) * Math.sin(phi) * (Math.sin(phi) > 0 ? 1 : 0.45);
      return [-u * cb + w * sb, r, u * sb + w * cb];
    });
  };
  const bladeAxis = (m) => new T.Vector3(0, m.y, 0);
  const inner = BLADE.filter((row) => row[0] <= 1.58).map(section);
  const outer = BLADE.filter((row) => row[0] >= 1.58).map(section);
  const bladeGeo = orient(loft(inner, { loop: true }), bladeAxis);
  bladeGeo.deleteAttribute('uv');
  const tipGeo = mergeGeometries([
    orient(loft(outer, { loop: true }), bladeAxis),
    orient(cap(outer.at(-1)), from([0, 1.5, 0])),
  ]);
  const prop = group(g, 'propeller', [0, 1.58, PROP_Z]);
  for (let i = 0; i < 4; i++) {
    const blade = group(prop, `prop-blade-${i}`);
    blade.rotation.z = Math.PI / 4 + (i * Math.PI) / 2;
    mesh(blade, 'blade', bladeGeo, blades);
    mesh(blade, 'blade-tip', tipGeo, yellow);
  }

  // Six ejector stacks a side, on the upper cowling.
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const z = 2.84 - i * 0.162,
        y = 1.78,
        x = side * halfWidth(station(z), y);
      add(
        g,
        'exhaust-stacks',
        iron,
        tubeBetween(
          [x - side * 0.03, y + 0.004, z + 0.012],
          [x + side * 0.075, y - 0.006, z - 0.06],
          0.042,
          8,
          0.034,
        ),
      );
    }
}

// ------------------------------------------------------------------------------ landing gear
const TYRE = [
  [0.2, -0.07],
  [0.27, -0.094],
  [0.318, -0.088],
  [0.339, -0.058],
  [0.345, 0],
  [0.339, 0.058],
  [0.318, 0.088],
  [0.27, 0.094],
  [0.2, 0.07],
];
function buildGear(g) {
  for (const side of [-1, 1]) {
    const top = [side * 1.93, 1.22, 1.06],
      axle = [side * 1.93, 0.345, 1.3];
    const gear = group(g, `gear-${side}`, top);
    const put = (name, material, geo) => add(gear, name, material, into(gear, geo));
    const knee = [axle[0], 0.66, lerpY(top[2], axle[2], (1.22 - 0.66) / (1.22 - 0.345))];
    put('oleo-strut', silver, tubeBetween(top, knee, 0.058, 12));
    put('oleo-strut', panel, tubeBetween(knee, [axle[0], axle[1] + 0.02, axle[2]], 0.042, 12));
    put(
      'oleo-strut',
      dark,
      tubeBetween(
        [knee[0], knee[1] - 0.06, knee[2] + 0.06],
        [axle[0], 0.44, axle[2] + 0.08],
        0.016,
        6,
      ),
    );
    const hubX = side * 1.79;
    put(
      'oleo-strut',
      silver,
      tubeBetween([axle[0], axle[1], axle[2]], [hubX, axle[1], axle[2]], 0.034, 10),
    );
    put(
      'main-wheel',
      rubber,
      wheelGeometry(
        TYRE.map(([r, w]) => [r, w]),
        [hubX, axle[1], axle[2]],
      ),
    );
    for (const face of [-1, 1])
      put(
        'wheel-hub',
        panel,
        wheelGeometry(
          [
            [0.2, face * 0.07],
            [0.13, face * 0.082],
            [0.05, face * 0.09],
            [0.001, face * 0.092],
          ],
          [hubX, axle[1], axle[2]],
          20,
        ),
      );
    // Strut door outboard of the leg, covering the oleo.
    const outline = new T.Shape();
    const pts = [
      [0.95, 1.17],
      [1.2, 1.17],
      [1.38, 0.66],
      [1.46, 0.46],
      [1.4, 0.39],
      [1.2, 0.4],
      [1.1, 0.5],
    ];
    outline.moveTo(...pts[0]);
    for (const point of pts.slice(1)) outline.lineTo(...point);
    outline.closePath();
    const door = new T.ExtrudeGeometry(outline, {
      depth: 0.02,
      bevelEnabled: false,
      curveSegments: 1,
    });
    door.applyMatrix4(new T.Matrix4().makeBasis(vec([0, 0, 1]), vec([0, 1, 0]), vec([-1, 0, 0])));
    door.translate(side > 0 ? side * 2.02 : side * 2.0, 0, 0);
    put('gear-door', panel, door);
  }
  // Tail wheel: strut, fork, tyre and its open doors.
  const pivot = [0, 1.4, -4.42];
  const tail = group(g, 'tail-gear', pivot);
  const put = (name, material, geo) => add(tail, name, material, into(tail, geo));
  put('tail-strut', silver, tubeBetween([0, 1.46, -4.4], [0, 0.37, -4.48], 0.034, 10));
  for (const x of [-0.06, 0.06])
    put('tail-strut', silver, tubeBetween([x, 0.4, -4.49], [x, 0.155, -4.63], 0.016, 6));
  put('tail-strut', silver, tubeBetween([-0.07, 0.4, -4.49], [0.07, 0.4, -4.49], 0.02, 6));
  put(
    'tail-wheel',
    rubber,
    wheelGeometry(
      TYRE.map(([r, w]) => [r * 0.45, w * 0.5]),
      [0, 0.155, -4.63],
      20,
    ),
  );
  for (const x of [-0.085, 0.085]) {
    const door = new T.BoxGeometry(0.008, 0.22, 0.3);
    door.rotateZ(x > 0 ? -0.18 : 0.18);
    put('tail-gear-door', panel, door.translate(x, 1.3, -4.44));
  }
}

// ------------------------------------------------------------------------------ markings
/** A strip of the fuselage skin, lifted by `lift`: rows of [z, [x...]] samples on the top. */
function topPatch(zs, halfWidthAt, lift, count = 8) {
  const rings = zs.map((z) => {
    const s = station(z),
      w = halfWidthAt(z);
    return Array.from({ length: count + 1 }, (_, k) => {
      const x = -w + (2 * w * k) / count;
      return [x, topAt(s, x, lift), z];
    });
  });
  return orient(loft(rings), fuselageAxis);
}
/** A strip of the fuselage side skin between heights lo(z)..hi(z), lifted by `lift`. */
function sidePatch(side, zs, band, lift, count = 4) {
  const rings = zs.map((z) => {
    const s = station(z),
      [lo, hi] = band(z);
    return Array.from({ length: count + 1 }, (_, k) => {
      const y = lo + ((hi - lo) * k) / count;
      return [side * halfWidth(s, y, lift), y, z];
    });
  });
  return orient(loft(rings), fuselageAxis);
}
// 2D triangle soups for the 1943 star-and-bar (radius r; star point up = +v).
function disc(r, rings = 4, sectors = 40) {
  const tris = [];
  const p = (i, k) => {
    const rr = (r * i) / rings,
      a = (k / sectors) * Math.PI * 2;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  };
  for (let i = 0; i < rings; i++)
    for (let k = 0; k < sectors; k++) {
      if (i > 0)
        tris.push([p(i, k), p(i + 1, k), p(i + 1, k + 1)], [p(i, k), p(i + 1, k + 1), p(i, k + 1)]);
      else tris.push([[0, 0], p(1, k), p(1, k + 1)]);
    }
  return tris;
}
function rect(u0, u1, v0, v1, nu, nv) {
  const tris = [];
  const p = (i, k) => [u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * k) / nv];
  for (let i = 0; i < nu; i++)
    for (let k = 0; k < nv; k++)
      tris.push([p(i, k), p(i + 1, k), p(i + 1, k + 1)], [p(i, k), p(i + 1, k + 1), p(i, k + 1)]);
  return tris;
}
function subdivide(tris, levels) {
  let out = tris;
  for (let l = 0; l < levels; l++) {
    const next = [];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (const [a, b, c] of out) {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    out = next;
  }
  return out;
}
function insigniaLayers(r) {
  const border = r / 8,
    v0 = -0.191 * r,
    v1 = 0.309 * r;
  const points = Array.from({ length: 10 }, (_, k) => {
    const a = Math.PI / 2 + (k * Math.PI) / 5,
      rr = k % 2 ? r * 0.382 : r;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const star = subdivide(
    points.map((p, k) => [[0, 0], p, points[(k + 1) % 10]]),
    2,
  );
  // The blue disc around the star: strips from each star edge out to the circle.
  const ring = [];
  for (let k = 0; k < 10; k++)
    for (let i = 0; i < 4; i++) {
      const inner = [
        lerp2(points[k], points[(k + 1) % 10], i / 4),
        lerp2(points[k], points[(k + 1) % 10], (i + 1) / 4),
      ];
      const outer = inner.map(([u, v]) => {
        const l = Math.sqrt(u * u + v * v);
        return [(u / l) * r, (v / l) * r];
      });
      for (let f = 0; f < 3; f++) {
        const a = lerp2(inner[0], outer[0], f / 3),
          b = lerp2(inner[1], outer[1], f / 3),
          c = lerp2(inner[1], outer[1], (f + 1) / 3),
          d = lerp2(inner[0], outer[0], (f + 1) / 3);
        ring.push([a, b, c], [a, c, d]);
      }
    }
  // White bars from the circle out to two radii.
  const bars = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++)
      for (let k = 0; k < 2; k++) {
        const p = (ii, kk) => {
          const v = v0 + ((v1 - v0) * kk) / 2;
          return [
            side * (Math.sqrt(r * r - v * v) + ((2 * r - Math.sqrt(r * r - v * v)) * ii) / 8),
            v,
          ];
        };
        bars.push([p(i, k), p(i + 1, k), p(i + 1, k + 1)], [p(i, k), p(i + 1, k + 1), p(i, k + 1)]);
      }
  return [
    [
      insignia,
      0.004,
      [
        ...disc(r + border),
        ...rect(-2 * r - border, 2 * r + border, v0 - border, v1 + border, 16, 3),
      ],
    ],
    [white, 0.011, [...star, ...bars]],
    [insignia, 0.011, ring],
  ];
}
/** Project 2D triangles from `center` along -dir onto `targets`, lifted `lift` along the skin normal. */
function decal(targets, center, u, v, dir, tris, lift) {
  const caster = new T.Raycaster();
  const keyed = new Map(),
    positions = [],
    indices = [];
  const project = ([pu, pv]) => {
    const key = `${pu.toFixed(5)},${pv.toFixed(5)}`;
    if (keyed.has(key)) return keyed.get(key);
    const origin = vec(center).addScaledVector(vec(u), pu).addScaledVector(vec(v), pv);
    caster.set(origin.clone().addScaledVector(vec(dir), 1.5), vec(dir).negate());
    const hit = caster.intersectObjects(targets, false)[0];
    if (!hit) throw new Error(`marking misses the skin at ${origin.toArray()}`);
    const p = hit.point.addScaledVector(hit.face.normal, lift);
    positions.push(p.x, p.y, p.z);
    keyed.set(key, positions.length / 3 - 1);
    return positions.length / 3 - 1;
  };
  for (const tri of tris) {
    // Mirrored artwork arrives clockwise: wind every triangle counter-clockwise in the plane.
    const [p, q, r] = tri;
    const ccw = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) >= 0;
    const [a, b, c] = (ccw ? tri : [p, r, q]).map(project);
    pushTriangle(positions, indices, a, b, c);
  }
  return orient(geometryOf(positions, indices), () => vec(center).addScaledVector(vec(dir), -1));
}
function buildMarkings(g, fuselage) {
  // Olive-drab anti-glare panel from the windscreen to the red nose band.
  add(
    g,
    'anti-glare-panel',
    olive,
    topPatch(
      span(WINDSCREEN.base, 2.95, 0.15),
      (z) => 0.33 - ((z - WINDSCREEN.base) * 0.1) / 1.85,
      0.004,
    ),
  );
  // Exhaust staining streaming back from the stacks, tapering out over the cowling.
  for (const side of [-1, 1])
    add(
      g,
      'exhaust-stain',
      soot,
      sidePatch(
        side,
        span(1.3, 1.98, 0.085),
        (z) => {
          const t = (1.98 - z) / 0.68,
            mid = 1.78 - 0.035 * t,
            half = 0.045 * (1 - t * t) + 0.004;
          return [mid - half, mid + half];
        },
        0.003,
      ),
    );
  // Star-and-bar: both fuselage sides, upper left wing, lower right wing.
  const skin = [new T.Mesh(fuselage)];
  for (const side of [-1, 1])
    for (const [paint, lift, tris] of insigniaLayers(0.28))
      add(
        g,
        'national-insignia',
        paint,
        decal(skin, [side * 0.5, 1.6, -2.3], [0, 0, side], [0, 1, 0], [side, 0, 0], tris, lift),
      );
  for (const side of [-1, 1]) {
    const st = wingStation(4.3);
    const z = st.le - 0.45 * st.chord;
    const wing = batched(`wing-${side}`);
    for (const [paint, lift, tris] of insigniaLayers(0.4))
      add(
        g,
        'national-insignia',
        paint,
        decal(wing, [side * 4.3, 1.5, z], [side, 0, 0], [0, 0, 1], [0, side, 0], tris, lift),
      );
  }
  // Radio mast behind the canopy.
  const mast = station(-1.75).top;
  add(
    g,
    'antenna-mast',
    dark,
    tubeBetween([0, mast - 0.02, -1.72], [0, mast + 0.4, -1.94], 0.022, 6, 0.01),
  );
}

/**
 * Fuel caps on the upper wing. Panel joints and cowling fasteners (2–4 mm geometry) are not
 * modelled: under the medium-fi style guide detail thinner than a pixel at viewing distance
 * shimmers and costs a draw each, so the bare-metal panelling reads from the painted panel
 * colors alone. (They were 13,000 triangles and four draws.)
 */
function buildSurfaceDetail(g) {
  for (const side of [-1, 1]) {
    const center = wingPoint(side)(wingStation(1.65), 0.39, 1);
    add(
      g,
      'wing-fuel-cap',
      panel,
      new T.TorusGeometry(0.058, 0.004, 5, 24)
        .rotateX(Math.PI / 2)
        .translate(center[0], center[1] + 0.007, center[2]),
    );
    add(
      g,
      'wing-fuel-cap',
      red,
      new T.BoxGeometry(0.046, 0.009, 0.013).translate(center[0], center[1] + 0.008, center[2]),
    );
  }
}

// ------------------------------------------------------------------------------ assembly
function mustang() {
  const g = new T.Group();
  g.name = 'P-51D-Mustang';
  buildFuselage(g);
  buildScoops(g);
  buildWings(g);
  buildTail(g);
  buildCanopy(g);
  buildNose(g);
  buildGear(g);
  buildMarkings(g, g.getObjectByName('fuselage').geometry);
  buildSurfaceDetail(g);
  flush();
  addInterior(g, interiorLayout, {
    group,
    box,
    rod,
    sphere,
    mesh,
    lettering,
    silver,
    dark,
    white,
    yellow,
    blue,
    brown,
    green,
    rubber,
    olive,
    red,
    glass,
  });
  return g;
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (model) => model.path === 'models/source.glb',
)?.sha256;
if (!pinned) throw new Error(`${sourcePath}: models/source.glb has no sha256 pin`);
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(mustang(), { binary: true, onlyVisible: false }),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const argument = process.argv[outIndex + 1];
  if (!argument || argument.startsWith('--'))
    throw new Error('--out requires a candidate GLB path');
  const candidate = resolve(argument);
  if (candidate === path || candidate === sourcePath) {
    throw new Error('--out must be separate from the source master and its source.json');
  }
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} ${generatedHash}`);
  process.exit(0);
}
if (current && hash(current) !== pinned && !current.equals(bytes)) {
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
}
await mkdir(root, { recursive: true });
if (!current?.equals(bytes)) await writeFile(path, bytes);
if (pinned !== generatedHash)
  await writeFile(sourcePath, sourceText.replace(pinned, generatedHash));
console.log(`p51d: ${bytes.length} bytes, ${generatedHash}`);

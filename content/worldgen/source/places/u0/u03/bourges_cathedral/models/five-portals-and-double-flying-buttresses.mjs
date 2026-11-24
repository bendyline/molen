import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import plan from '../bourges-plan.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.94 },
  doors: { slot: 'door', graph: 'wood_plain', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
};
const buff = rgb('b8aa93'),
  trim = rgb('d1c4ab'),
  grey = rgb('888578'),
  blue = rgb('515e68');
const lightBlue = rgb('5e6870'),
  glass = rgb('465564'),
  dark = rgb('544738'),
  shade = rgb('6a665b');
const {
  along: [ax, az],
  north: [nx, nz],
  foundation,
  towers,
  tiers,
  chapels,
  piers,
  front,
} = plan;
const world = (u, v) => [ax * u + nx * v, az * u + nz * v];
const P = (u, y, v) => [ax * u + nx * v, y, az * u + nz * v];
const rings = (r) => r.map(([a, b]) => world(a, b));
const lerp = (a, b, t) => a + (b - a) * t;
const rect = (u, v, U, V) => [
  [u, v],
  [U, v],
  [U, V],
  [u, V],
];
const center = ([u, v, U, V]) => [(u + U) * 0.5, (v + V) * 0.5];
const capOut = withFootprintCaps;

function mass(out, slot, ring, y, Y, tint, optional = {}) {
  extrude(capOut(out), slot, rings(ring), y, Y, tint, optional);
}
function stoneBlock(out, a, b, c, d, y, Y, color = buff) {
  mass(out, 'stone', rect(a, b, c, d), y, Y, color);
}

function roof(out, t) {
  const { ring, y, peak, hip, centerZ } = t;
  const ordered = outwardRing(rings(ring));
  const station = (p) => Math.min(hip, p[0] * ax + p[1] * az);
  const crest = (p) => P(station(p), peak, centerZ);
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i],
      b = ordered[(i + 1) % ordered.length];
    const A = [a[0], y, a[1]],
      B = [b[0], y, b[1]];
    const C = crest(b),
      D = crest(a);
    const upright = (C[0] - D[0]) ** 2 + (C[2] - D[2]) ** 2 < 0.000006;
    const ab = [B[0] - A[0], B[2] - A[2]],
      ac = [C[0] - A[0], C[2] - A[2]];
    const top = ab[1] * ac[0] - ab[0] * ac[1];
    if (Math.abs(top) < 0.0001) {
      tri(out, 'stone', B, A, C, buff);
    } else if (upright) {
      tri(out, 'slate', A, B, C, blue);
    } else {
      quad4(out, 'slate', A, B, C, D, blue);
    }
  }
}

function window(out, f, u, y, width, height, d) {
  if (d < 2) {
    const w = width * 0.5,
      Y = y + height - width * 0.45;
    fan(
      out,
      'glass',
      [
        f.P(u - w, y, 0.05),
        f.P(u + w, y, 0.05),
        f.P(u + w, Y, 0.05),
        f.P(u, y + height, 0.05),
        f.P(u - w, Y, 0.05),
      ],
      glass,
    );
    return;
  }
  opening(out, f, u, y, width, height, {
    head: 'pointed',
    rise: Math.min(width * 0.68, height * 0.33),
    glass,
    glassSlot: 'glass',
    frameSlot: 'carved',
    frame: trim,
    frameWidth: d === 3 ? 0.089 : 0,
    frameDepth: 0.18,
    mullions: d >= 2 && width > 1.3 ? 1 : 0,
    sill: d >= 2,
    d: 0.052,
  });
}

function moulding(out, f, z0, z1, y, d, tint = trim) {
  fbox(out, 'carved', f, z0, z1, y, y + 0.18, 0, d, tint);
}

function clerestory(out, t, lod) {
  const ring = outwardRing(rings(t.ring));
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (f.length < t.minWindow) continue;
    const n = Math.max(1, Math.round(f.length / t.interval));
    // West end is covered by the west front and unequal towers.
    if (f.normal[0] * ax + f.normal[1] * az < -0.86 && f.P(0, 0)[0] * ax + f.P(0, 0)[2] * az < 0)
      continue;
    for (let k = 0; k < n; k++) {
      const w = Math.min(2.55, (f.length / n) * 0.29);
      const u = ((k + 0.5) * f.length) / n;
      const h = t.windowTop - t.windowSill;
      if (lod >= 2 && f.length / n > 4.3) {
        window(out, f, u - w * 0.54, t.windowSill, w * 0.91, h, lod);
        window(out, f, u + w * 0.54, t.windowSill, w * 0.91, h, lod);
      } else {
        window(out, f, u, t.windowSill, w * 1.2, h, lod);
      }
    }
    if (lod >= 2) moulding(out, f, 0, f.length, t.y - 0.35, 0.24);
  }
}

function portal(out, f, u, half, threshold, spring, top, detail) {
  const ray = pointedArch(half, half * 1.14, [1, 4, 6, 8][detail]);
  const recess = detail === 0 ? 1.07 : 1.54;
  for (let i = 1; i < ray.length; i++) {
    const [x, y] = ray[i - 1],
      [X, Y] = ray[i];
    const a = f.P(u + x, spring + y, 0.012),
      b = f.P(u + X, spring + Y, 0.012);
    quad4(out, 'stone', a, b, f.P(u + X, top, 0.012), f.P(u + x, top, 0.012), buff);
    quad4(
      out,
      'carved',
      b,
      a,
      f.P(u + x, spring + y, -recess),
      f.P(u + X, spring + Y, -recess),
      trim,
    );
    if (detail >= 1) beam(out, 'carved', a, b, 0.22, 0.2, trim);
    if (detail >= 2) {
      const line = (x, y, offset) =>
        f.P(u + x * offset, spring + y * offset, -(1 - offset) * recess);
      beam(out, 'carved', line(x, y, 1.17), line(X, Y, 1.17), 0.1, 0.12, buff);
      beam(out, 'carved', line(x, y, 0.88), line(X, Y, 0.88), 0.075, 0.1, grey);
    }
  }
  for (const side of [-1, 1]) {
    const x = u + side * half;
    quad4(
      out,
      'carved',
      f.P(x, threshold, -recess),
      f.P(x, threshold, 0.04),
      f.P(x, spring, 0.04),
      f.P(x, spring, -recess),
      trim,
    );
    if (detail >= 1)
      for (let i = 0; i < [0, 1, 3, 4][detail]; i++) {
        const u1 = x + side * (0.13 + i * 0.14),
          v = 0.06 - i * 0.09;
        beam(out, 'carved', f.P(u1, threshold, v), f.P(u1, spring + 0.6, v), 0.15, 0.14, grey);
      }
  }
  fbox(
    out,
    'doors',
    f,
    u - half * 0.91,
    u + half * 0.91,
    threshold,
    spring - 0.39,
    -recess - 0.08,
    -recess + 0.018,
    dark,
  );
  if (detail >= 2)
    fbox(
      out,
      'carved',
      f,
      u - 0.085,
      u + 0.085,
      threshold,
      spring - 0.34,
      -recess - 0.06,
      -recess + 0.08,
      trim,
    );
}

function rose(out, f, u, y, r, detail) {
  const segments = [12, 18, 26, 42][detail];
  const point = (theta, R, d) => f.P(u + Math.cos(theta) * R, y + Math.sin(theta) * R, d);
  const theta = (i) => (i * Math.PI * 2) / segments;
  fan(
    out,
    'glass',
    Array.from({ length: segments }, (_, i) => point(theta(i), r, 0.091)),
    glass,
  );
  const outer = r * 1.072;
  for (let i = 0; i < segments; i++) {
    quad4(
      out,
      'carved',
      point(theta(i), r, 0.1),
      point(theta(i), outer, 0.21),
      point(theta(i + 1), outer, 0.21),
      point(theta(i + 1), r, 0.1),
      trim,
    );
  }
  if (detail === 0) return;
  const spokes = detail === 1 ? 12 : detail === 2 ? 16 : 24;
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    const next = ((i + 0.5) * Math.PI * 2) / spokes;
    beam(
      out,
      'carved',
      point(a, r * 0.12, 0.16),
      point(a, r * 0.92, 0.16),
      0.043 * r,
      0.03 * r,
      trim,
    );
    if (detail >= 2)
      beam(
        out,
        'carved',
        point(a, r * 0.65, 0.15),
        point(next, r * 0.85, 0.16),
        0.038 * r,
        0.024 * r,
        buff,
      );
  }
}

function facadeFront(out, d) {
  const f = facade(world(front.u, 0), [-nx, -nz]);
  const levels = front.doors
    .map((p) => {
      const lo = -p.v - p.half,
        hi = -p.v + p.half;
      portal(out, f, -p.v, p.half, front.threshold, p.spring, front.top, d);
      return [lo, hi];
    })
    .sort(([a], [b]) => a - b);
  let start = -front.end;
  for (const [lo, hi] of levels) {
    if (lo - start > 0.05)
      fbox(out, 'stone', f, start, lo, front.threshold, front.top, -1.52, 0.015, buff);
    start = hi;
  }
  fbox(out, 'stone', f, start, -front.begin, front.threshold, front.top, -1.52, 0.015, buff);
  const U = -front.rosette.v,
    a = U - front.rosette.width / 2,
    b = U + front.rosette.width / 2;
  fbox(out, 'stone', f, -front.end, a, front.top, 27.8, -2.35, -0.05, buff);
  fbox(out, 'stone', f, b, -front.begin, front.top, 25.85, -2.35, -0.05, buff);
  fbox(out, 'stone', f, a, b, front.top, front.rosette.y + 10.11, -2.05, 0.05, buff);
  tri(
    out,
    'stone',
    f.P(a, front.rosette.y + 10.03, 0.062),
    f.P(b, front.rosette.y + 10.03, 0.062),
    f.P(U, 51.85, 0.062),
    buff,
  );
  rose(out, f, U, front.rosette.y, front.rosette.radius, d);
  if (d >= 2) rose(out, f, U, 45.29, 1.64, 1);
  if (d >= 1) for (const sign of [-1, 1]) window(out, f, U + sign * 4.41, 17.33, 2.27, 7.8, d);
  if (d < 2) return;
  for (const entry of front.doors) {
    const u = -entry.v;
    const width = entry.half * 1.27;
    const end = front.top - 1.9;
    const summit = f.P(u, end + entry.half * 1.91, 0.44);
    const left = f.P(u - width, end, 0.4);
    const right = f.P(u + width, end, 0.4);
    tri(out, 'carved', left, right, summit, buff);
    beam(out, 'carved', left, summit, 0.19, 0.28, trim);
    beam(out, 'carved', summit, right, 0.19, 0.28, trim);
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? a : b;
    fbox(out, 'carved', f, x - 0.44, x + 0.44, front.top, 38.15, 0.04, 0.53, trim);
  }
  moulding(out, f, a + 0.5, b - 0.5, 38.18, 0.55);
}

function tower(out, t, detail) {
  const {
    box: [u, v, U, V],
    peak,
    south,
  } = t;
  const width = V - v;
  const o = rect(u + 1.78, v, U, V);
  const cutoff = peak - (south ? 15.1 : 19.2);
  mass(out, 'stone', o, 0, cutoff, buff);
  const pad = width * 0.28;
  const pairs = [
    [u + 1.78, U - pad],
    [U - pad, U],
  ];
  for (const [a, b] of pairs) {
    if (b - a < 1.0) continue;
    if (a === U - pad) {
      stoneBlock(out, a, v, b, V, cutoff, peak - 2.65);
      continue;
    }
    stoneBlock(out, a, v, b, v + pad, cutoff, peak - 2.65);
    stoneBlock(out, a, V - pad, b, V, cutoff, peak - 2.65);
  }
  stoneBlock(out, u + 1.78, v, U, V, peak - 2.65, peak - 1.5, trim);
  const h = peak - 1.5;
  if (south) {
    roof(out, { ring: o, y: h - 5.1, peak, hip: (u + U) / 2, centerZ: (v + V) / 2 });
  } else {
    const ring = outwardRing(rings(o));
    for (let i = 0; i < ring.length; i++) {
      const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
      fbox(out, 'carved', f, 0, f.length, h, h + 0.52, -0.36, 0.12, trim);
      for (let j = 0, n = [2, 5, 7, 10][detail]; j < n; j++) {
        const x = ((j + 0.5) / n) * f.length;
        fbox(
          out,
          'carved',
          f,
          x - 0.19,
          x + 0.19,
          h + 0.49,
          h + (j % 2 ? 0.98 : 1.5),
          -0.36,
          0.12,
          trim,
        );
      }
    }
  }
  if (detail >= 1) {
    const f = facade(world(u + 1.765, (v + V) / 2), [-nx, -nz]);
    window(out, f, 0, cutoff - 26.07, width * 0.35, 12.2, detail);
    if (detail >= 2)
      for (const side of [-1, 1])
        moulding(out, f, side * width * 0.41 - 0.1, side * width * 0.41 + 0.1, cutoff - 0.27, 0.37);
  }
  if (detail >= 2) {
    const [westX, westZ] = world(u + 1.78, (v + V) / 2);
    const f = facade([westX, westZ], [-nx, -nz]);
    const half = width * 0.22;
    const top = peak - 2.63;
    const spring = top - half * 1.52;
    const arch = pointedArch(half, half * 1.28, detail === 3 ? 8 : 5);
    for (const [i, [a, h]] of arch.slice(0, -1).entries()) {
      const [b, H] = arch[i + 1];
      const A = f.P(a, spring + h, 0.024);
      const B = f.P(b, spring + H, 0.024);
      quad4(out, 'stone', A, B, f.P(b, top, 0.024), f.P(a, top, 0.024), buff);
      beam(out, 'carved', A, B, 0.24, 0.25, trim);
    }
    for (const side of [-1, 1]) {
      const x = side * half;
      fbox(out, 'carved', f, x - 0.131, x + 0.131, cutoff, spring, 0.03, 0.36, trim);
      const corner = side * width * 0.42;
      fbox(out, 'carved', f, corner - 0.27, corner + 0.27, 15.1, h - 0.9, 0.03, 0.51, trim);
    }
    for (const y of [cutoff - 18.6, cutoff - 2.63, cutoff, top])
      moulding(out, f, -width * 0.5, width * 0.5, y, 0.41);
    if (!south) {
      const springTop = spring + half * 0.54;
      fbox(out, 'carved', f, -0.12, 0.12, cutoff, springTop, 0.03, 0.49, trim);
      for (const y of [cutoff + 2.24, cutoff + 4.66, cutoff + 7.08, cutoff + 9.51, cutoff + 11.77])
        fbox(out, 'carved', f, -half + 0.07, half - 0.07, y, y + 0.13, -0.03, 0.26, grey);
    }
    const [a, b] = center(t.box);
    for (const side of [-1, 1]) {
      const at = P(a, h - 0.4, b + side * (width * 0.44)),
        top = P(a, h + 1.25, b + side * (width * 0.44));
      beam(out, 'carved', at, top, 0.39, 0.44, buff);
    }
  }
}

function fly(out, p, detail) {
  const { u, base, start, low, high, top } = p;
  const hull = rect(u - p.width / 2, base - p.depth / 2, u + p.width / 2, base + p.depth / 2);
  mass(out, 'stone', hull, p.grade, p.pierTop, buff);
  if (detail === 0 && p.ignoreSkyline) return;
  for (const [a, b, y, Y] of [
    [base, start, low, high],
    [start, p.end, high + 3.0, top],
  ]) {
    const spans = [1, 2, 6, 11][detail];
    const curve = (t) => P(u, lerp(y, Y, t) + Math.sin(Math.PI * t) * 1.46, lerp(a, b, t));
    for (let i = 0; i < spans; i++) {
      const A = curve(i / spans),
        B = curve((i + 1) / spans);
      beam(out, 'stone', A, B, p.width * 0.62, detail === 3 ? 1.09 : 0.92, buff);
      if (detail === 3)
        beam(
          out,
          'carved',
          [A[0], A[1] + 0.48, A[2]],
          [B[0], B[1] + 0.48, B[2]],
          p.width * 0.67,
          0.21,
          trim,
        );
    }
  }
  const height = p.pierTop + 3.2;
  for (const [a, b, c, d] of [[u - 0.49, base - 0.52, u + 0.49, base + 0.52]]) {
    mass(out, 'carved', rect(a, b, c, d), p.pierTop, height - 1.02, buff);
    const corners = rect(a, b, c, d);
    const top = P(u, height, base);
    for (let i = 0; i < corners.length; i++)
      tri(
        out,
        'carved',
        P(corners[i][0], height - 1.02, corners[i][1]),
        top,
        P(
          corners[(i + 1) % corners.length][0],
          height - 1.02,
          corners[(i + 1) % corners.length][1],
        ),
        trim,
      );
  }
}

function radialPier(out, p, detail) {
  const { foot, shoulder, head, width, grade, pierTop } = p;
  const [x, z] = foot;
  mass(out, 'stone', rect(x - 0.77, z - 0.89, x + 0.77, z + 0.89), grade, pierTop, buff);
  for (const [A, B, y, Y] of [
    [foot, shoulder, p.low, p.high],
    [shoulder, head, p.high + 1.15, p.top],
  ]) {
    const point = (t) =>
      P(lerp(A[0], B[0], t), lerp(y, Y, t) + Math.sin(Math.PI * t) * 1.12, lerp(A[1], B[1], t));
    const spans = detail === 1 ? 2 : detail === 2 ? 5 : 8;
    for (let i = 0; i < spans; i++)
      beam(out, 'stone', point(i / spans), point((i + 1) / spans), width * 0.71, 0.92, buff);
  }
}
function chapel(out, c, d) {
  const { ring, height, roofEave, at, grade } = c;
  mass(out, 'stone', ring, grade, roofEave, buff);
  const roof = outwardRing(rings(ring));
  const top = P(at[0], height, at[1]);
  for (let i = 0; i < roof.length; i++) {
    const a = roof[i],
      b = roof[(i + 1) % roof.length];
    tri(out, 'slate', [a[0], roofEave, a[1]], [b[0], roofEave, b[1]], top, lightBlue);
    if (d >= 2) {
      const f = wallFace(a, b);
      if (f.length > 1.5)
        window(out, f, f.length / 2, grade + 2.95, Math.min(f.length * 0.55, 1.53), 7.04, d);
    }
  }
}

function build(out, detail) {
  mass(
    out,
    'base',
    detail <= 1 ? plan.foundationSky : foundation,
    plan.foundationBottom,
    0.06,
    grey,
  );
  for (const t of tiers) {
    mass(out, 'stone', t.ring, 0.055, t.y, buff);
    roof(out, t);
    if (detail) clerestory(out, t, detail);
  }
  for (const p of towers) tower(out, p, detail);
  for (const a of plan.annexes)
    if (detail >= 2 || a.id === 778549211 || (detail === 1 && a.height >= 15))
      chapel(out, a, detail);
  facadeFront(out, detail);
  for (const c of chapels) if (detail > 0 || c.id === 778774444) chapel(out, c, detail);
  for (const p of piers) {
    if (detail === 0 && p.ignoreSkyline) continue;
    fly(out, p, detail);
  }
  if (detail > 0) for (const p of plan.radialPiers) radialPier(out, p, detail);
  if (detail >= 1)
    for (let i = 0, n = [2, 4, 6, 9][detail]; i < n; i++) {
      const u = front.u - 2.3 + (i * 2.3) / n;
      const top = lerp(front.threshold - 1.14, front.threshold, (i + 1) / n);
      stoneBlock(out, u, front.begin, u + 0.27, front.end, front.threshold - 1.25, top, grey);
    }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

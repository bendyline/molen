/** Medium-fi FNB derivatives: retained mapped calabash/roof controls and bounded stadium ground fit. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { fnbPlan } from './fnb-stadium-plan.mjs';
import { box } from './structure-mesh.mjs';

const TAU = 2 * Math.PI,
  palette = [
    [0.64, 0.22, 0.085],
    [0.53, 0.16, 0.066],
    [0.7, 0.31, 0.13],
    [0.44, 0.23, 0.15],
    [0.52, 0.35, 0.23],
    [0.74, 0.62, 0.4],
    [0.83, 0.73, 0.5],
    [0.63, 0.54, 0.38],
  ],
  cream = [0.88, 0.82, 0.65],
  concrete = [0.55, 0.54, 0.49],
  steel = [0.55, 0.57, 0.55];
const fit = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ke/ke7/n0687_fnb_stadium/pmtiles-fit.json',
      import.meta.url,
    ),
  ),
);
const MEANS = {
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  membrane: [0.7380356292847077, 0.7380356292847077, 0.7194874484523931],
};
function ground(x, z) {
  const g = fit.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fit.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function radius(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  if (!Number.isFinite(best)) throw Error('FNB polygon ray missed');
  return best;
}
const point = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
function skin(a, t) {
  const angle = -1.05 + t * (Math.PI / 2 + 1.05),
    r =
      radius(fnbPlan.roofOuter, a) +
      (radius(fnbPlan.outer, a) - radius(fnbPlan.roofOuter, a)) * Math.cos(angle);
  return point(a, r, 20 + 18 * Math.sin(angle));
}
function roof(a, t) {
  const ri = radius(fnbPlan.opening, a),
    ro = radius(fnbPlan.roofOuter, a),
    phase = ((a / TAU) * 60) % 1;
  return point(
    a,
    ri + (ro - ri) * t,
    36.9 + 3.1 * Math.sin(Math.PI * t) * Math.pow(Math.abs(Math.sin(Math.PI * phase)), 0.75),
  );
}
function rounded(a, x, z, r, y) {
  const sx = Math.sign(Math.sin(a)) || 1,
    sz = Math.sign(Math.cos(a)) || 1,
    dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let distance = Math.min(x / (dx || 1e-8), z / (dz || 1e-8));
  if (distance * dx > x - r && distance * dz > z - r) {
    const qx = x - r,
      qz = z - r,
      dot = qx * dx + qz * dz;
    distance = dot + Math.sqrt(Math.max(0, dot * dot - qx * qx - qz * qz + r * r));
  }
  return [sx * distance * dx, y, sz * distance * dz];
}
function build(destination, d) {
  const far = d === 0,
    n = [32, 48, 96, 192][d],
    rows = [4, 12, 18, 36][d];
  function emit(s, r, p, hint, uv, c) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        nn = normalFor(...t);
      if (Math.hypot(...nn) < 0.5) continue;
      if (hint && nn.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        nn = normalFor(...t);
      }
      destination.addTriangle(
        s,
        r,
        t,
        nn,
        t.map((v) => [v[0], v[2]]),
        far ? c.map((v, j) => v * (MEANS[s]?.[j] ?? 1)) : c,
      );
    }
  }
  const o = Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
  );
  const face = (s, p, c, target) => emit(s, 'palette:#ffffff', p, target, null, c);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        t = j / rows,
        u = (j + 1) / rows,
        vj = Math.floor(t * 36),
        seed = ((i * 251 + vj * 607 + i * vj * 17) % 997) / 997,
        mix = t > 0.66 ? 0.72 : t > 0.44 ? 0.32 : 0.11,
        index = seed < mix ? 5 + ((i + vj) % 3) : (i * 13 + vj * 7) % 5,
        open = d > 0 && t > 0.12 && t < 0.7 && seed > 0.74;
      face(
        'concrete',
        [
          skin(a, open ? t + (u - t) * 0.12 : t),
          skin(b, open ? t + (u - t) * 0.12 : t),
          skin(b, u),
          skin(a, u),
        ],
        palette[index],
        [Math.sin(a), 0, Math.cos(a)],
      );
    }
  const roofN = [32, 64, 144, 240][d],
    roofRows = [2, 3, 6, 8][d];
  for (let i = 0; i < roofN; i++)
    for (let j = 0; j < roofRows; j++) {
      const a = (i * TAU) / roofN,
        b = ((i + 1) * TAU) / roofN,
        t = j / roofRows,
        u = (j + 1) / roofRows,
        p = [roof(a, t), roof(b, t), roof(b, u), roof(a, u)],
        glass = d >= 2 && (j === 0 || j === roofRows - 1);
      face(glass ? 'glass' : 'membrane', p, glass ? [0.64, 0.73, 0.74] : cream, [0, 1, 0]);
      if (d >= 2)
        face(
          glass ? 'glass' : 'membrane',
          [...p].reverse(),
          glass ? [0.64, 0.73, 0.74] : cream,
          [0, -1, 0],
        );
    }
  const tiers = [
      { x: 43, z: 66, r: 23, y: 0.15, rows: 28, run: 0.82, rise: 0.34 },
      { x: 70, z: 84, r: 31, y: 11, rows: 25, run: 0.8, rise: 0.43 },
      { x: 92, z: 103, r: 50, y: 23.5, rows: 20, run: 0.79, rise: 0.5 },
    ],
    bowlN = [32, 48, 40, 44][d];
  for (const t of tiers) {
    const count = d === 3 ? t.rows : [1, 3, 8][d];
    for (let row = 0; row < count; row++) {
      const q = (row * t.rows) / count,
        next = ((row + 1) * t.rows) / count;
      for (let i = 0; i < bowlN; i++) {
        const a = (i * TAU) / bowlN,
          b = ((i + 1) * TAU) / bowlN,
          p = (a, k, y) => rounded(a, t.x + k * t.run, t.z + k * t.run, t.r + k * t.run * 0.6, y);
        const aisle = d === 3 || (d === 2 && i % 4 === 0);
        const split = a + (b - a) * 0.12;
        const cells = aisle
          ? [
              [a, split, concrete],
              [split, b, [0.86, 0.27, 0.035]],
            ]
          : [[a, b, [0.86, 0.27, 0.035]]];
        for (const [aa, bb, color] of cells) {
          const low = t.y + q * t.rise,
            high = t.y + next * t.rise;
          face(
            'plastic',
            [
              p(aa, q, low),
              p(bb, q, low),
              p(bb, next, d >= 2 ? low : high),
              p(aa, next, d >= 2 ? low : high),
            ],
            color,
            [0, 1, 0],
          );
          if (d >= 2)
            face(
              'plastic',
              [p(aa, next, low), p(bb, next, low), p(bb, next, high), p(aa, next, high)],
              color,
              [-Math.sin(aa), 0, -Math.cos(aa)],
            );
        }
      }
    }
    if (d > 0)
      for (let i = 0; i < bowlN; i++) {
        const a = (i * TAU) / bowlN,
          b = ((i + 1) * TAU) / bowlN;
        face(
          'concrete',
          [
            rounded(a, t.x, t.z, t.r, t.y - 0.5),
            rounded(b, t.x, t.z, t.r, t.y - 0.5),
            rounded(b, t.x, t.z, t.r, t.y),
            rounded(a, t.x, t.z, t.r, t.y),
          ],
          concrete,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
  }
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      at = (a, offset, y) => point(a, radius(fnbPlan.outer, a) + offset, y),
      p = at(a, 6, 3.1),
      q = at(b, 6, 3.1);
    face('concrete', [at(a, -19, 3.1), at(b, -19, 3.1), q, p], concrete, [0, 1, 0]);
    face(
      'concrete',
      [
        p,
        q,
        [q[0], Math.min(-0.2, ground(q[0], q[2]) - 0.2), q[2]],
        [p[0], Math.min(-0.2, ground(p[0], p[2]) - 0.2), p[2]],
      ],
      concrete,
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(
      'concrete',
      [
        [0, 0, 0],
        point(a, radius(fnbPlan.outer, a) - 19, 0),
        point(b, radius(fnbPlan.outer, b) - 19, 0),
      ],
      concrete,
      [0, 1, 0],
    );
  }
  const feet = [8, 16, 28, 28][d];
  for (let i = 0; i < feet; i++) {
    const a = (i * TAU) / feet,
      p = point(a, radius(fnbPlan.outer, a) - 5, 0),
      q = skin(a, 0.5);
    beam(o, 'concrete', p, [q[0], q[1] - 1, q[2]], d > 1 ? 2.1 : 2.4, 1.8, concrete);
  }
  if (d > 0) {
    const ribs = d === 1 ? 16 : d === 2 ? 30 : 60;
    for (let i = 0; i < ribs; i++) {
      const a = (i * TAU) / ribs;
      beam(o, 'metal', roof(a, 0.07), roof(a, 0.98), 0.25, 0.25, steel);
      if (d >= 2)
        beam(
          o,
          'metal',
          point(a, radius(fnbPlan.roofOuter, a) - 4, 30),
          roof(a, 0.95),
          0.2,
          0.2,
          steel,
        );
    }
  }
  if (d >= 2) {
    const ribs = d === 2 ? 12 : 120,
      steps = d === 2 ? 2 : 4;
    for (let i = 0; i < ribs; i++) {
      const a = (i * TAU) / ribs;
      for (let j = 0; j < steps; j++) {
        const p = skin(a, 0.28 + (0.72 * j) / steps),
          q = skin(a, 0.28 + (0.72 * (j + 1)) / steps);
        p[0] -= 1.3 * Math.sin(a);
        p[2] -= 1.3 * Math.cos(a);
        q[0] -= 1.3 * Math.sin(a);
        q[2] -= 1.3 * Math.cos(a);
        beam(o, 'metal', p, q, 0.15, 0.15, steel);
      }
    }
    const segments = d === 2 ? 24 : 120,
      ring = (a, k) =>
        point(
          a,
          radius(fnbPlan.roofOuter, a) - (k === 0 ? 5.4 : k === 1 ? 0 : 2.7),
          k === 2 ? 29.8 : 35.1,
        );
    for (let k = 0; k < 3; k++)
      for (let i = 0; i < segments; i++)
        beam(
          o,
          'metal',
          ring((i * TAU) / segments, k),
          ring(((i + 1) * TAU) / segments, k),
          0.74,
          0.74,
          steel,
        );
    for (let i = 0; i < segments; i += 2) {
      const a = (i * TAU) / segments,
        b = ((i + 1) * TAU) / segments;
      beam(o, 'metal', ring(a, 0), ring(b, 2), 0.15, 0.15, steel);
      beam(o, 'metal', ring(a, 1), ring(b, 2), 0.15, 0.15, steel);
    }
  }
  // The western hospitality strip fixes the asymmetry of the retained plan.
  for (const [x, y, count] of [
    [-68.4, 9.35, far ? 1 : 8],
    [-90.4, 21.8, far ? 1 : 10],
  ])
    for (let i = 0; i < count; i++) {
      const z = (i - (count - 1) / 2) * 10;
      box(o, 'glass', [x - 0.2, y, z - 4.7], [x, y + 1.7, z + 4.7], [0.17, 0.24, 0.25]);
    }
  face(
    'turf',
    [
      [-34, 0.04, -52.5],
      [34, 0.04, -52.5],
      [34, 0.04, 52.5],
      [-34, 0.04, 52.5],
    ],
    [0.09, 0.23, 0.08],
    [0, 1, 0],
  );
  if (d >= 2) {
    for (const x of [-34, 34])
      face(
        'plastic',
        [
          [x - 0.06, 0.06, -52.5],
          [x + 0.06, 0.06, -52.5],
          [x + 0.06, 0.06, 52.5],
          [x - 0.06, 0.06, 52.5],
        ],
        [0.88, 0.88, 0.82],
        [0, 1, 0],
      );
    for (const z of [-52.5, 0, 52.5])
      face(
        'plastic',
        [
          [-34, 0.06, z - 0.06],
          [34, 0.06, z - 0.06],
          [34, 0.06, z + 0.06],
          [-34, 0.06, z + 0.06],
        ],
        [0.88, 0.88, 0.82],
        [0, 1, 0],
      );
    for (const z of [-52.5, 52.5]) {
      const col = [0.88, 0.88, 0.82];
      beam(o, 'metal', [-3.66, 0.05, z], [-3.66, 2.44, z], 0.08, 0.08, col);
      beam(o, 'metal', [3.66, 0.05, z], [3.66, 2.44, z], 0.08, 0.08, col);
      beam(o, 'metal', [-3.66, 2.44, z], [3.66, 2.44, z], 0.08, 0.08, col);
    }
  }
}
export const buildFnbSkyline = (o) => build(o, 0);
export const buildFnbDistrict = (o) => build(o, 1);
export const buildFnbStreet = (o) => build(o, 2);
export const buildFnbCloseup = (o) => build(o, 3);

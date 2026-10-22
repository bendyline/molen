/** Atlanta–Fulton County Stadium: whole June1974 historical bowl and open radial skeleton. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dj/djg/atlanta_fulton_county_stadium/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    concrete: rgb('cbc8b7'),
    seat: rgb('386c69'),
    glass: rgb('364d4e'),
    metal: rgb('596b63'),
    grass: rgb('678747'),
    clay: rgb('ad7659'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    seat: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.84, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.05 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.18 },
    grass: { slot: 'foundation', localRef: 'palette:#fffeff', roughness: 1, metallic: 0 },
    clay: { slot: 'foundation', localRef: 'palette:#fffffe', roughness: 1, metallic: 0 },
  };
export function atlantaFultonGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const area = (P) =>
    P.reduce((s, a, i) => {
      const b = P[(i + 1) % P.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  ccw = (P) => (area(P) > 0 ? P : [...P].reverse());
function triangles(P) {
  const ix = P.map((_, i) => i),
    out = [],
    side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    inside = (q, a, b, c) =>
      side(a, b, q) >= -1e-8 && side(b, c, q) >= -1e-8 && side(c, a, q) >= -1e-8;
  let attempts = 0;
  while (ix.length > 3 && attempts++ < P.length * P.length) {
    let cut = false;
    for (let k = 0; k < ix.length; k++) {
      const a = ix[(k + ix.length - 1) % ix.length],
        b = ix[k],
        c = ix[(k + 1) % ix.length];
      if (side(P[a], P[b], P[c]) < 1e-8) continue;
      if (ix.some((i) => i !== a && i !== b && i !== c && inside(P[i], P[a], P[b], P[c]))) continue;
      out.push([P[a], P[b], P[c]]);
      ix.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) {
      const k = ix.findIndex(
        (b, k) =>
          Math.abs(side(P[ix[(k + ix.length - 1) % ix.length]], P[b], P[ix[(k + 1) % ix.length]])) <
          1e-6,
      );
      if (k < 0) throw Error('Native polygon cannot triangulate');
      ix.splice(k, 1);
    }
  }
  if (ix.length === 3) out.push(ix.map((i) => P[i]));
  return out;
}
function face(o, s, P, Y, n, col = C[s]) {
  for (const q of triangles(ccw(P)))
    T(
      o,
      s,
      q.map((v) => [v[0], typeof Y === 'function' ? Y(v) : Y, v[1]]),
      n,
      col,
    );
}
const Y = (y) => A.baseY + y,
  V = (t, r, y) => [Math.sin(t) * r, Y(y), Math.cos(t) * r],
  radial = (t) => [Math.sin(t), 0, Math.cos(t)];
export function atlantaFultonFieldRadius(t) {
  const u = [Math.sin(t), Math.cos(t)];
  let nearest = Infinity;
  for (let i = 0; i < p.field.length; i++) {
    const a = p.field[i],
      b = p.field[(i + 1) % p.field.length],
      v = [b[0] - a[0], b[1] - a[1]],
      den = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(den) < 1e-8) continue;
    const r = (a[0] * v[1] - a[1] * v[0]) / den,
      q = (a[0] * u[1] - a[1] * u[0]) / den;
    if (r > 0 && q >= 0 && q <= 1) nearest = Math.min(nearest, r);
  }
  if (!Number.isFinite(nearest)) throw Error('Missing field radial intersection');
  return nearest;
}
function ribbon(o, s, r0, r1, y0, y1, n, down = false) {
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n,
      R = (r, t) => (typeof r === 'function' ? r(t) : r);
    Q(
      o,
      s,
      [V(a, R(r0, a), y0), V(b, R(r0, b), y0), V(b, R(r1, b), y1), V(a, R(r1, a), y1)],
      [0, down ? -1 : 1, 0],
    );
  }
}
function band(o, s, r, y0, y1, n) {
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n;
    Q(o, s, [V(a, r, y0), V(b, r, y0), V(b, r, y1), V(a, r, y1)], radial((a + b) / 2));
  }
}
function slab(o, r0, r1, y, h, n) {
  ribbon(o, 'concrete', r0, r1, y + h, y + h, n);
  ribbon(o, 'concrete', r0, r1, y, y, n, true);
  band(o, 'concrete', r1, y, y + h, n);
  band(o, 'concrete', r0, y, y + h, n);
}
function beam(o, s, a, b, w, h) {
  const axis = b.map((v, k) => v - a[k]),
    L = Math.hypot(...axis),
    d = axis.map((v) => v / L),
    U0 = cross(d, Math.abs(d[1]) < 0.96 ? [0, 1, 0] : [1, 0, 0]),
    U = U0.map((v) => v / Math.hypot(...U0)),
    B = cross(d, U),
    ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => c.map((v, k) => v + (U[k] * x * w) / 2 + (B[k] * y * h) / 2)),
    P = ring(a),
    R = ring(b);
  Q(
    o,
    s,
    [...P].reverse(),
    d.map((v) => -v),
  );
  Q(o, s, R, d);
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    Q(
      o,
      s,
      [P[k], P[j], R[j], R[k]],
      P[k].map((v, i) => v - a[i]),
    );
  }
}
function tier(o, r0, r1, y0, y1, rows, n, d) {
  if (d === 0) {
    ribbon(o, 'seat', r0, r1, y0, y1, n);
    ribbon(o, 'concrete', r0, r1, y0 - 0.7, y1 - 0.7, n, true);
    band(o, 'concrete', r1, y1 - 0.7, y1 + 0.5, n);
    return;
  }
  const R = (t, f) => (typeof r0 === 'function' ? r0(t) : r0) * (1 - f) + r1 * f;
  for (let j = 0; j < rows; j++) {
    const f0 = j / rows,
      f1 = (j + 1) / rows,
      y = y0 + (y1 - y0) * f0,
      yy = y0 + (y1 - y0) * f1;
    ribbon(
      o,
      'seat',
      (t) => R(t, f0),
      (t) => R(t, f1),
      y,
      y,
      n,
    );
    for (let k = 0; k < n; k++) {
      const a = (k * Math.PI * 2) / n,
        b = ((k + 1) * Math.PI * 2) / n;
      Q(
        o,
        'concrete',
        [V(a, R(a, f1), y), V(b, R(b, f1), y), V(b, R(b, f1), yy), V(a, R(a, f1), yy)],
        radial((a + b) / 2).map((v) => -v),
      );
      if (d === 3) {
        const rA = R(a, f0 * 0.22 + f1 * 0.78),
          rB = R(b, f0 * 0.22 + f1 * 0.78),
          dy = 0.35;
        Q(
          o,
          'seat',
          [V(a, rA, y + 0.08), V(b, rB, y + 0.08), V(b, rB, y + dy), V(a, rA, y + dy)],
          radial((a + b) / 2).map((v) => -v),
        );
        Q(
          o,
          'seat',
          [
            V(a, rA + 0.045, y + 0.08),
            V(b, rB + 0.045, y + 0.08),
            V(b, rB + 0.045, y + dy),
            V(a, rA + 0.045, y + dy),
          ],
          radial((a + b) / 2),
        );
      }
    }
    // Narrow actual concrete aisle treads cross the merged seat rows.
    if (d > 1)
      for (let k = 0; k < 18; k++) {
        const t = ((k + 0.5) * Math.PI * 2) / 18,
          dr = 0.6 / Math.max(40, R(t, f0)),
          a = t - dr,
          b = t + dr;
        Q(
          o,
          'concrete',
          [
            V(a, R(a, f0), y + 0.012),
            V(b, R(b, f0), y + 0.012),
            V(b, R(b, f1), y + 0.012),
            V(a, R(a, f1), y + 0.012),
          ],
          [0, 1, 0],
        );
      }
  }
  ribbon(o, 'concrete', r0, r1, y0 - 0.7, y1 - 0.7, n, true);
  band(o, 'concrete', r1, y1 - 0.7, y1 + 0.45, n);
}
function bowl(o, d) {
  const n = [16, 32, 48, 96][d],
    rows = [
      [1, 1, 1],
      [3, 1, 4],
      [10, 3, 15],
      [22, 6, 28],
    ][d];
  tier(o, (t) => atlantaFultonFieldRadius(t) + 2.0, 93, 0.55, 9.5, rows[0], n, d);
  tier(o, 90.5, 101, 10.7, 14.8, rows[1], n, d);
  tier(o, 88.5, A.radius, 17.8, 30.7, rows[2], n, d);
  // The top has a genuine narrow open rim slot below its solid coping.
  band(o, 'concrete', A.radius, 30.9, 31.55, n);
  band(o, 'concrete', A.radius, 32.1, 32.5, n);
  if (d === 0) {
    for (const y of [0, 3.4, 7.2, 11.2]) band(o, 'concrete', A.radius - 2, y, y + 0.8, n);
    band(o, 'concrete', 95, 0.1, 11.2, n);
    for (const y of [3.4, 7.2]) ribbon(o, 'concrete', 95, A.radius - 2, y, y, n);
    return;
  }
  if (d > 1)
    for (const [lo, hi] of [
      [30.9, 31.55],
      [32.1, 32.5],
    ]) {
      ribbon(o, 'concrete', A.radius - 0.28, A.radius, hi, hi, n);
      for (let k = 0; k < n; k++) {
        const a = (k * Math.PI * 2) / n,
          b = ((k + 1) * Math.PI * 2) / n;
        Q(
          o,
          'concrete',
          [
            V(a, A.radius - 0.28, lo),
            V(b, A.radius - 0.28, lo),
            V(b, A.radius - 0.28, hi),
            V(a, A.radius - 0.28, hi),
          ],
          radial((a + b) / 2).map((v) => -v),
        );
      }
    }
  for (const y of [3.4, 7.2, 11.2]) slab(o, 95, A.radius - 2, y, 0.25, n);
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n,
      mid = (a + b) / 2,
      r = 95.6;
    // Inset service/entry fronts behind the open galleries; these never seal the outer slots.
    for (const [lo, hi] of [
      [0.1, 2.9],
      [4.1, 6.6],
      [8.0, 10.6],
    ])
      Q(
        o,
        k % 4 === 0 ? 'concrete' : 'glass',
        [V(a, r, lo), V(b, r, lo), V(b, r, hi), V(a, r, hi)],
        radial(mid),
      );
    if (d > 1 && (d === 3 || k % 2 === 0))
      for (const y of [3.7, 7.5, 11.5]) {
        const P = V(a, A.radius - 2.2, y + 0.75),
          R = V(b, A.radius - 2.2, y + 0.75);
        beam(o, 'metal', P, R, 0.065, 0.065);
        beam(o, 'metal', V(a, A.radius - 2.2, y), P, 0.045, 0.045);
      }
  }
}
export const atlantaFultonBents = Array.from({ length: A.radialBents }, (_, i) => {
  const t = (i * Math.PI * 2) / A.radialBents,
    q = V(t, A.radius - 8, 0);
  return {
    t,
    ground: atlantaFultonGround(q[0], q[2]),
    foot: [q[0], atlantaFultonGround(q[0], q[2]) - 0.15, q[2]],
    knee: V(t, A.radius - 2.5, 14.2),
    rim: V(t, A.radius, 32.4),
    rakerInner: V(t, 88.5, 17.05),
    rakerOuter: V(t, A.radius, 30.05),
  };
});
function skeleton(o, d) {
  const stride = [6, 3, 1, 1][d];
  for (let i = 0; i < atlantaFultonBents.length; i += stride) {
    const b = atlantaFultonBents[i];
    beam(o, 'concrete', b.foot, b.rim, d === 0 ? 1.1 : 0.72, 1.0);
    beam(o, 'concrete', b.rakerInner, b.rakerOuter, d === 0 ? 0.9 : 0.62, 1.05);
    if (d > 0) beam(o, 'concrete', b.knee, b.rakerInner, 0.64, 0.85);
    if (d > 1) {
      const r = A.radius - 0.15;
      beam(o, 'concrete', V(b.t, r, 31.45), V(b.t, r, 32.4), 0.22, 0.35);
      if (d === 3) {
        const P = V(b.t, A.radius - 7, 0.0);
        box(o, 'concrete', P[0], b.foot[1] - 0.1, P[2], 1.7, 0.3, 1.9);
      }
    }
  }
}
function disc(o, s, x, z, y, r, n = 24) {
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n;
    T(
      o,
      s,
      [
        [x, y, z],
        [x + Math.sin(a) * r, y, z + Math.cos(a) * r],
        [x + Math.sin(b) * r, y, z + Math.cos(b) * r],
      ],
      [0, 1, 0],
    );
  }
}
function playingField(o, d) {
  face(o, 'grass', p.field, A.fieldY, [0, 1, 0]);
  const [x, z] = p.homeplate,
    y = A.fieldY + 0.015,
    diamond = 27.432,
    U = [Math.SQRT1_2, Math.SQRT1_2],
    D = [-Math.SQRT1_2, Math.SQRT1_2],
    base = (a, b) => [x + U[0] * a + D[0] * b, z + U[1] * a + D[1] * b],
    P = [base(0, 0), base(diamond, 0), base(diamond, diamond), base(0, diamond)];
  face(o, 'clay', P, y, [0, 1, 0]);
  const infield = Array.from({ length: 4 }, (_, i) => {
    const q = P[i];
    return [q[0] * 0.72 + x * 0.28, q[1] * 0.72 + (z + diamond * Math.SQRT1_2) * 0.28];
  });
  face(o, 'grass', infield, y + 0.012, [0, 1, 0]);
  disc(o, 'clay', x, z + 18.4404, y + 0.025, 2.75, d === 0 ? 8 : 24);
  disc(o, 'clay', x, z, y + 0.02, 3.7, d === 0 ? 8 : 24);
  const n = [16, 32, 64, 96][d];
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n,
      ra = atlantaFultonFieldRadius(a),
      rb = atlantaFultonFieldRadius(b);
    Q(
      o,
      'metal',
      [V(a, ra, 0.1), V(b, rb, 0.1), V(b, rb, 3.15), V(a, ra, 3.15)],
      radial((a + b) / 2).map((v) => -v),
    );
  }
  if (d > 0) {
    for (const q of [P[1], P[2], P[3]]) box(o, 'concrete', q[0], y + 0.03, q[1], 0.38, 0.07, 0.38);
    for (const sign of [-1, 1]) {
      const a = [x, y + 0.04, z],
        b = [x + sign * 75 * Math.SQRT1_2, y + 0.04, z + 75 * Math.SQRT1_2];
      beam(o, 'concrete', a, b, 0.055, 0.015);
    }
    for (const theta of [-0.77, 0.77]) {
      const r = atlantaFultonFieldRadius(theta);
      beam(o, 'metal', V(theta, r, 0.1), V(theta, r, 16), 0.14, 0.14);
    }
  }
}
function equipment(o, d) {
  if (d === 0) return;
  // Approximate period equipment envelopes: no team logos or advertising artwork.
  box(o, 'glass', 0, Y(5.8), 72, 22, 7, 0.45);
  for (const x of [-9, 9]) beam(o, 'metal', [x, Y(1), 72], [x, Y(12.8), 72], 0.35, 0.35);
  if (d > 1) {
    for (let k = 0; k < 5; k++) box(o, 'metal', -8 + k * 4, Y(7.8), 71.73, 2.7, 1.7, 0.08);
  }
  // Press enclosure behind home plate, supported on the intermediate gallery.
  const z = -97;
  box(o, 'concrete', 0, Y(13.5), z, 25, 4.1, 5);
  Q(
    o,
    'glass',
    [
      [-11.5, Y(14.5), z + 2.55],
      [11.5, Y(14.5), z + 2.55],
      [11.5, Y(16.5), z + 2.55],
      [-11.5, Y(16.5), z + 2.55],
    ],
    [0, 0, 1],
  );
  for (let k = 0; k < 8; k++) {
    const t = ((k + 0.5) * Math.PI) / 4,
      r = A.radius - 1,
      lo = V(t, r, 32.5),
      hi = V(t, r, 39.5);
    beam(o, 'metal', lo, hi, 0.24, 0.24);
    const u = [Math.cos(t), 0, -Math.sin(t)],
      n = radial(t),
      P = (x, y, dep) => [hi[0] + u[0] * x + n[0] * dep, hi[1] + y, hi[2] + u[2] * x + n[2] * dep];
    Q(o, 'metal', [P(-3, -0.2, 0), P(3, -0.2, 0), P(3, 2.1, 0), P(-3, 2.1, 0)], n);
    if (d > 1) {
      Q(
        o,
        'metal',
        [P(3, -0.2, 0.15), P(-3, -0.2, 0.15), P(-3, 2.1, 0.15), P(3, 2.1, 0.15)],
        n.map((v) => -v),
      );
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 5; i++) {
          const x = -2.5 + i * 1.25,
            y = 0.2 + j * 1.1;
          Q(
            o,
            'concrete',
            [
              P(x - 0.28, y - 0.27, -0.02),
              P(x + 0.28, y - 0.27, -0.02),
              P(x + 0.28, y + 0.27, -0.02),
              P(x - 0.28, y + 0.27, -0.02),
            ],
            n.map((v) => -v),
          );
        }
    }
  }
}
function build(o, _f, d = 3) {
  playingField(o, d);
  bowl(o, d);
  skeleton(o, d);
  equipment(o, d);
}
export const atlantaFultonSkyline = (o, f) => build(o, f, 0),
  atlantaFultonDistrict = (o, f) => build(o, f, 1),
  atlantaFultonStreet = (o, f) => build(o, f, 2),
  atlantaFultonCloseup = (o, f) => build(o, f, 3);
export const atlantaFultonCountyStadiumModel = {
  id: 'atlanta_fulton_county_stadium',
  key: 'atlanta_fulton_county_stadium',
  cell: 'dj/djg',
  recipe: 'structure-atlanta-fulton-county-stadium.mjs',
  title: 'Atlanta–Fulton County Stadium',
  category: 'stadium-arena',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: p.appearance,
  brief: p.authoringDirection,
  camera: [282, 225, 319],
  lookAt: [0, 12, 0],
  mediumFiContext: { scale: 1.5 },
  qaCameras: [
    {
      name: 'whole-historical-bowl-open-baseballfield-and-radial-skeleton',
      position: [282, 225, 319],
      lookAt: [0, 12, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'white-radial-bents-upper-raker-and-genuine-open-concourses',
      position: [153, 20, 40],
      lookAt: [106, 16, 20],
    },
    {
      name: 'asymmetric-baseball-lower-rows-upper-deck-and-press-gallery',
      position: [22, 37, 9],
      lookAt: [0, 15, -90],
    },
    {
      name: 'stepped-green-seat-bands-concrete-aisles-and-rim-slot',
      position: [-31, 27, 66],
      lookAt: [-63, 15, 69],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-atlanta-fulton-county-stadium.mjs',
    level: 'skyline',
    export: 'atlantaFultonSkyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'atlantaFultonDistrict', errorMeters: 1, surfaces },
      street: { export: 'atlantaFultonStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'atlantaFultonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Historical-only representativeJune1974 exterior, explicit1974-06-01 through1974-07-01 viewing range and1974-06-15 capture day; no exact photograph exposure/game-day equipment claimed. Stadium razedAugust1997 and absent from current world. Later1983 own-photo field/fence and2007 post-demolition lot are context, not asserted1974 fitout.',
    'Whole asymmetric open baseballfield/three stepped tiers/open galleries/white radial inclined bent and raker skeleton/upper-deck underside/press box/scoreboard/rim lighting included. Native retained curved lot perimeter only approximates old outer frame; actual old wall/field grade/section/seat census/colors/lighting heights/equipment locations are unmeasured. Low LODs merge seat rows and omit small equipment; no solid drum or extruded parking parcel.',
    'Three exact published Qualla PD originals individually inspected/native SHA1/revisions bound; EPA NARA556790/412-DA-14338 JimPickerell1974/PD-USGov-EPA; Wahkeenah first-person1983 photo and UNCCTF Own2007 photo/PD-user-en. Questionable1960s–70s postcard and1968 unknown media-guide plan excluded/unviewed; all modern CC aerial/demolition photos unused. No metadata/body/category/policy changes, photographic textures, generated bitmaps or downloaded mesh.',
    'Independent512m129square4m16641-sample modern ground/two original Terrarium tiles frozen before geometry; values/heightPNG/tilebytes preserved. Provider297.6978m fixed external approach datum not surveyed1974 construction grade. Single bowl/field datum from frozen source centre and individual bent footings from source; historical excavation/later parking grading/actual host contact unverified. No terrain flattening/fitting/reacquisition or whole-lot platform. Historical dated preview/replacement disabled.',
    'Row bands and aisle treads represent seats without literal52700 individual chairs. Concrete raker sections and gallery widths bounded from one clear exterior; specific fasteners/glass hardware/speaker/electrical elements/signage omitted. No players, logos/advertisements/cars/trees, later Turner Field/newGSU ballpark or post-demolition parking substituted.',
  ],
};

/** Brasília browser tiers: open triple colonnade, compression ring and recessed red bowl. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const fit = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/6v/6vj/n0703_estadio_nacional_de_brasilia/pmtiles-fit.json',
      import.meta.url,
    ),
  ),
);
const TAU = 2 * Math.PI,
  concrete = [0.67, 0.66, 0.61],
  white = [0.88, 0.89, 0.86],
  steel = [0.57, 0.61, 0.61],
  red = [0.63, 0.017, 0.024],
  glass = [0.09, 0.14, 0.15],
  MEANS = {
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    membrane: [0.7380356292847077, 0.7380356292847077, 0.7194874484523931],
  };
const rad = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];
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
function rounded(a, hx, hz, r, y) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return rad(a, t, y);
}
const roofY = (r) => 40.3 + ((r - 68) / 64.5) * 2.9,
  bottomY = (r) => 31.3 + ((r - 68) / 64.5) * 7.9 - 1.1 * Math.sin(((r - 68) / 64.5) * Math.PI);
function build(destination, d) {
  function emit(s, r, p, hint, _uv, c) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        s,
        r,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        d === 0 ? c.map((v, j) => v * (MEANS[s]?.[j] ?? 1)) : c,
      );
    }
  }
  const o = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
    ),
    face = (s, p, c, h) => emit(s, 'palette:#ffffff', p, h, null, c),
    N = [24, 48, 96, 192][d],
    columnN = [24, 32, 96, 96][d],
    columnR = d === 0 ? [152] : [134, 143, 152];
  for (let i = 0; i < columnN; i++) {
    const a = ((i + 0.5) * TAU) / columnN;
    for (const r of columnR) {
      const c = rad(a, r),
        h = 39.65 + ((r - 132.5) / 22) * 9.3,
        w = 0.6 + (0.075 * (r - 134)) / 9;
      if (d < 2) {
        for (let k = 0; k < 4; k++) {
          const b = (k * TAU) / 4,
            B = ((k + 1) * TAU) / 4,
            p = [c[0] + w * Math.sin(b), 0, c[2] + w * Math.cos(b)],
            q = [c[0] + w * Math.sin(B), 0, c[2] + w * Math.cos(B)];
          face('concrete', [p, q, [q[0], h, q[2]], [p[0], h, p[2]]], concrete, [
            Math.sin(b),
            0,
            Math.cos(b),
          ]);
        }
      } else
        loft(
          o,
          'concrete',
          [
            radialRing(0, w, w, d === 3 ? 8 : 6, [c[0], c[2]]),
            radialRing(h, w, w, d === 3 ? 8 : 6, [c[0], c[2]]),
          ],
          concrete,
        );
    }
  }
  for (let i = 0; i < N; i++) {
    const a = (i * TAU) / N,
      b = ((i + 1) * TAU) / N,
      side = [Math.sin(a), 0, Math.cos(a)];
    face(
      'concrete',
      [rad(a, 154.5, 49.6), rad(b, 154.5, 49.6), rad(b, 132.5, 43.2), rad(a, 132.5, 43.2)],
      concrete,
      [0, 1, 0],
    );
    face(
      'concrete',
      [rad(a, 154.5, 48.5), rad(b, 154.5, 48.5), rad(b, 132.5, 39.2), rad(a, 132.5, 39.2)],
      concrete,
      [0, -1, 0],
    );
    face(
      'concrete',
      [rad(a, 154.5, 48.5), rad(b, 154.5, 48.5), rad(b, 154.5, 49.6), rad(a, 154.5, 49.6)],
      concrete,
      side,
    );
    face(
      'concrete',
      [rad(a, 132.5, 39.2), rad(b, 132.5, 39.2), rad(b, 132.5, 43.2), rad(a, 132.5, 43.2)],
      concrete,
      side.map((v) => -v),
    );
    face(
      'concrete',
      [rad(a, 130, 0.04), rad(b, 130, 0.04), rad(b, 155.7, 0.04), rad(a, 155.7, 0.04)],
      concrete,
      [0, 1, 0],
    );
    const p = rad(a, 168),
      q = rad(b, 168);
    p[1] = ground(p[0], p[2]) - 0.2;
    q[1] = ground(q[0], q[2]) - 0.2;
    face('concrete', [rad(a, 155.7, 0.04), rad(b, 155.7, 0.04), q, p], concrete, [0, 1, 0]);
    face(
      'concrete',
      [rad(a, 130, -12.2), rad(b, 130, -12.2), rad(b, 130, 0.04), rad(a, 130, 0.04)],
      concrete,
      side.map((v) => -v),
    );
    face(
      'concrete',
      [[0, -11.85, 0], rad(a, 130, -11.85), rad(b, 130, -11.85)],
      concrete,
      [0, 1, 0],
    );
  }
  const roofN = [24, 48, 96, 192][d],
    roofRows = [1, 2, 3, 7][d];
  for (let i = 0; i < roofN; i++)
    for (let j = 0; j < roofRows; j++) {
      const a = (i * TAU) / roofN,
        b = ((i + 1) * TAU) / roofN,
        r = 68 + (j * 64.5) / roofRows,
        R = 68 + ((j + 1) * 64.5) / roofRows,
        p = [rad(a, r, roofY(r)), rad(b, r, roofY(r)), rad(b, R, roofY(R)), rad(a, R, roofY(R))];
      if (d === 3) {
        const mid = rad((a + b) / 2, (r + R) / 2, roofY((r + R) / 2) + 0.85);
        for (let k = 0; k < 4; k++) {
          const t = [p[k], p[(k + 1) % 4], mid];
          face('membrane', t, white, [0, 1, 0]);
          face(
            'membrane',
            t.map((v) => [v[0], v[1] - 0.04, v[2]]),
            white,
            [0, -1, 0],
          );
        }
      } else {
        face('membrane', p, white, [0, 1, 0]);
        face(
          'membrane',
          p.map((v) => [v[0], v[1] - 0.04, v[2]]),
          white,
          [0, -1, 0],
        );
      }
    }
  for (let i = 0; i < roofN; i++) {
    const a = (i * TAU) / roofN,
      b = ((i + 1) * TAU) / roofN;
    face(
      'acrylic',
      [rad(a, 51, 40.1), rad(b, 51, 40.1), rad(b, 68, 40.3), rad(a, 68, 40.3)],
      [0.8, 0.86, 0.86],
      [0, 1, 0],
    );
  }
  const tiers = [
      { rows: 31, hx: 40.8, hz: 61.8, r: 12, dr: 0.55, run: 0.82, y: -11.25, rise: 0.365 },
      { rows: 8, hx: 68, hz: 89, r: 35, dr: 0.8, run: 0.67, y: 3.4, rise: 0.42 },
      { rows: 39, hx: 76, hz: 97, r: 42, dr: 1.1836, run: 0.81, y: 11.8, rise: 0.58 },
    ],
    bn = [24, 32, 32, 40][d],
    seat = (a, t, q, y = t.y + q * t.rise) =>
      rounded(a, t.hx + q * t.run, t.hz + q * t.run, t.r + q * t.dr, y);
  for (const t of tiers) {
    const count = d === 3 ? t.rows : d === 2 ? 6 : 1;
    for (let row = 0; row < count; row++) {
      const q = (row * t.rows) / count,
        Q = ((row + 1) * t.rows) / count,
        low = t.y + q * t.rise,
        high = t.y + Q * t.rise;
      for (let i = 0; i < bn; i++) {
        const a = (i * TAU) / bn,
          b = ((i + 1) * TAU) / bn,
          split = a + (b - a) * 0.1,
          cells =
            d >= 2 && i % (d === 3 ? 1 : 4) === 0
              ? [
                  [a, split, concrete],
                  [split, b, red],
                ]
              : [[a, b, red]];
        for (const [aa, bb, c] of cells) {
          face(
            'plastic',
            [
              seat(aa, t, q),
              seat(bb, t, q),
              seat(bb, t, Q, d >= 2 ? low : high),
              seat(aa, t, Q, d >= 2 ? low : high),
            ],
            c,
            [0, 1, 0],
          );
          if (d >= 2)
            face(
              'plastic',
              [
                seat(aa, t, Q, low),
                seat(bb, t, Q, low),
                seat(bb, t, Q, high),
                seat(aa, t, Q, high),
              ],
              c,
              rad(aa, -1),
            );
        }
      }
    }
  }
  if (d > 0)
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < bn; i++) {
        const a = (i * TAU) / bn,
          b = ((i + 1) * TAU) / bn,
          t = tiers[k],
          q = seat(a, t, t.rows),
          Q = seat(b, t, t.rows),
          next = tiers[k + 1];
        face(
          'glass',
          [
            [q[0], q[1] + 0.15, q[2]],
            [Q[0], Q[1] + 0.15, Q[2]],
            [Q[0], next.y - 0.2, Q[2]],
            [q[0], next.y - 0.2, q[2]],
          ],
          glass,
          rad(a, -1),
        );
        face(
          'concrete',
          [
            [q[0], next.y - 0.2, q[2]],
            [Q[0], next.y - 0.2, Q[2]],
            seat(b, next, 0),
            seat(a, next, 0),
          ],
          concrete,
          [0, 1, 0],
        );
      }
  face(
    'turf',
    [
      [-34, -11.8, -52.5],
      [34, -11.8, -52.5],
      [34, -11.8, 52.5],
      [-34, -11.8, 52.5],
    ],
    [0.09, 0.24, 0.07],
    [0, 1, 0],
  );
  if (d >= 2) {
    for (let i = 0; i < 48; i++) {
      const a = (i * TAU) / 48,
        steps = d === 3 ? 4 : 1;
      for (let j = 0; j < steps; j++) {
        const r = 68 + (j * 64.5) / steps,
          R = 68 + ((j + 1) * 64.5) / steps;
        beam(o, 'metal', rad(a, r, bottomY(r)), rad(a, R, bottomY(R)), 0.16, 0.16, steel);
        beam(o, 'metal', rad(a, r, roofY(r) - 0.23), rad(a, R, roofY(R) - 0.23), 0.13, 0.13, steel);
        beam(o, 'metal', rad(a, r, bottomY(r)), rad(a, r, roofY(r) - 0.23), 0.13, 0.13, white);
        if (d === 3)
          beam(o, 'metal', rad(a, r, bottomY(r)), rad(a, R, roofY(R) - 0.23), 0.1, 0.1, white);
      }
    }
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 4; j++) {
        const a = (i * TAU) / 8 - 0.15,
          b = a + 0.3,
          r = 135.5 + (j % 2) * 6.1,
          R = r + 5.4,
          y = j * 2.4,
          p = rad(a, r, y + (j % 2 ? 2.4 : 0)),
          q = rad(b, r, y + (j % 2 ? 0 : 2.4)),
          P = rad(a, R, p[1]),
          Q = rad(b, R, q[1]);
        face('concrete', [p, q, Q, P], concrete, [0, 1, 0]);
        face(
          'concrete',
          [p.map((v) => v), q, Q, P].map((v) => [v[0], v[1] - 0.3, v[2]]),
          concrete,
          [0, -1, 0],
        );
        if (d === 3) {
          beam(o, 'metal', [P[0], P[1] + 1.1, P[2]], [Q[0], Q[1] + 1.1, Q[2]], 0.04, 0.04, steel);
        }
      }
    for (const y of [1.5, 5.2, 9.4])
      for (let i = 0; i < N; i++) {
        const a = (i * TAU) / N,
          b = ((i + 1) * TAU) / N;
        face(
          'concrete',
          [rad(a, 113, y), rad(b, 113, y), rad(b, 130, y), rad(a, 130, y)],
          concrete,
          [0, 1, 0],
        );
        face(
          'glass',
          [
            rad(a, 124, y + 0.25),
            rad(b, 124, y + 0.25),
            rad(b, 124, y + 3.05),
            rad(a, 124, y + 3.05),
          ],
          glass,
          rad(a, 1),
        );
      }
    for (const z of [-52.5, 52.5]) {
      for (const x of [-3.66, 3.66])
        beam(o, 'metal', [x, -11.8, z], [x, -9.36, z], 0.08, 0.08, white);
      beam(o, 'metal', [-3.66, -9.36, z], [3.66, -9.36, z], 0.08, 0.08, white);
    }
    for (const z of [-69, 69])
      box(o, 'glass', [-9, 24, z - 0.3], [9, 33, z], [0.025, 0.035, 0.035]);
  }
  if (d === 3) {
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N;
      face(
        'concrete',
        [rad(a, 67.3, 30.9), rad(b, 67.3, 30.9), rad(b, 69.1, 30.9), rad(a, 69.1, 30.9)],
        concrete,
        [0, 1, 0],
      );
    }
    for (let i = 0; i < 48; i++) {
      const a = (i * TAU) / 48,
        b = ((i + 1) * TAU) / 48;
      for (const r of [51, 68])
        beam(o, 'metal', rad(a, r, 40.1), rad(b, r, 40.1), 0.12, 0.12, white);
      for (const r of [68, 100, 132.5])
        beam(o, 'metal', rad(a, r, bottomY(r)), rad(b, r, bottomY(r)), 0.1, 0.1, steel);
      const p = rad(a, 68, 31.3);
      box(
        o,
        'metal',
        [p[0] - 0.7, p[1] - 0.2, p[2] - 0.3],
        [p[0] + 0.7, p[1] + 0.3, p[2] + 0.3],
        [0.025, 0.035, 0.035],
      );
    }
    const line = (x, z, X, Z) =>
      face(
        'plastic',
        [
          [x, -11.78, z],
          [X, -11.78, Z],
          [X + 0.12, -11.78, Z + 0.12],
          [x + 0.12, -11.78, z + 0.12],
        ],
        white,
        [0, 1, 0],
      );
    for (const x of [-34, 34]) line(x, -52.5, x, 52.5);
    for (const z of [-52.5, 0, 52.5]) line(-34, z, 34, z);
    for (let i = 0; i < 40; i++)
      face(
        'plastic',
        [
          rad((i * TAU) / 40, 9.15, -11.78),
          rad(((i + 1) * TAU) / 40, 9.15, -11.78),
          rad(((i + 1) * TAU) / 40, 9.27, -11.78),
          rad((i * TAU) / 40, 9.27, -11.78),
        ],
        white,
        [0, 1, 0],
      );
  }
}
export const buildBrasiliaSkyline = (o) => build(o, 0);
export const buildBrasiliaDistrict = (o) => build(o, 1);
export const buildBrasiliaStreet = (o) => build(o, 2);
export const buildBrasiliaCloseup = (o) => build(o, 3);

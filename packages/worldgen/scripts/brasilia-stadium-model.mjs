/** Brasília: three concentric concrete colonnades and the two-layer spoke-wheel roof. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { brasiliaPlan as plan } from './brasilia-plan.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const concrete = [0.67, 0.66, 0.61],
  white = [0.88, 0.89, 0.86],
  steel = [0.57, 0.61, 0.61],
  red = [0.63, 0.017, 0.024],
  dark = [0.026, 0.037, 0.039];
const rad = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
function fabricFace(out, points, color, expected) {
  let ps = points,
    n = normalFor(...ps.slice(0, 3));
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    ps = [...ps].reverse();
    n = normalFor(...ps.slice(0, 3));
  }
  out.addQuad(
    'membrane',
    'metric:uv',
    ps,
    n,
    ps.map((p) => [p[0], p[2]]),
    color,
  );
}
const ring = (out, r, y, radius, color = steel, slot = 'metal', n = 288) =>
  curve(
    out,
    Array.from({ length: n + 1 }, (_, i) => rad((i * TAU) / n, r, y)),
    radius,
    color,
    slot,
    8,
  );
function rounded(a, hx, hz, r, y = 0) {
  const x = Math.sin(a),
    z = Math.cos(a);
  let lo = 0,
    hi = Math.hypot(hx, hz);
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    if (
      Math.hypot(Math.max(0, Math.abs(t * x) - (hx - r)), Math.max(0, Math.abs(t * z) - (hz - r))) >
      r
    )
      hi = t;
    else lo = t;
  }
  return [x * lo, y, z * lo];
}
function slab(out, ri, ro, y, depth = 0.35, color = concrete, n = 288) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      p = rad(a, ro, y),
      q = rad(b, ro, y),
      u = rad(a, ri, y),
      v = rad(b, ri, y),
      down = (p) => [p[0], p[1] - depth, p[2]];
    face(out, 'concrete', [p, q, v, u], color, [0, 1, 0]);
    face(out, 'concrete', [down(p), down(q), q, p], color, rad(a, 1));
    face(out, 'concrete', [down(u), down(v), v, u], color, rad(a, -1));
    face(out, 'concrete', [down(p), down(q), down(v), down(u)], color, [0, -1, 0]);
  }
}
function rails(out, pts, h = 1.1) {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const y of [h, h * 0.5])
      tube(
        out,
        'metal',
        pts[i].map((v, j) => v + (j === 1 ? y : 0)),
        pts[i + 1].map((v, j) => v + (j === 1 ? y : 0)),
        0.023,
        steel,
        6,
      );
    tube(
      out,
      'metal',
      pts[i],
      pts[i].map((v, j) => v + (j === 1 ? h : 0)),
      0.025,
      steel,
      6,
    );
  }
}
function colonnade(out) {
  slab(out, 130, 155.7, 0.04, 0.44);
  // 96 radial axes and three column rings are published, not a decorative approximation.
  for (let i = 0; i < 96; i++) {
    const a = ((i + 0.5) * TAU) / 96;
    for (let j = 0; j < 3; j++) {
      const r = 134 + 9 * j,
        h = 39.65 + ((r - 132.5) / 22) * 9.3,
        c = rad(a, r),
        o = transformed(out, 0, c),
        d = 0.6 + 0.075 * j;
      lathe(
        o,
        'concrete',
        [
          [0, d],
          [h, d],
        ],
        concrete,
        48,
      );
      for (let y = 3; y < h - 1; y += 3)
        loft(
          o,
          'concrete',
          [
            radialRing(y - 0.018, d + 0.008, d + 0.008, 48),
            radialRing(y + 0.018, d + 0.008, d + 0.008, 48),
          ],
          [0.6, 0.6, 0.57],
          { cap: false },
        );
      // Recessed form-tie marks remain subtle, metric, and symmetric around each cast lift.
      for (let y = 1.4; y < h - 1; y += 3)
        for (let k = 0; k < 4; k++) {
          const t = (k * Math.PI) / 2,
            p = rad(t, d + 0.009, y);
          const points = Array.from({ length: 8 }, (_, i) => {
            const a = (-i * TAU) / 8;
            return [
              p[0] + Math.cos(t) * Math.cos(a) * 0.021,
              p[1] + Math.sin(a) * 0.021,
              p[2] - Math.sin(t) * Math.cos(a) * 0.021,
            ];
          });
          o.addConvexPolygon(
            'concrete',
            'palette:#ffffff',
            points,
            rad(t, 1),
            (v) => [v[0], v[1]],
            [0.53, 0.54, 0.5],
          );
        }
    }
    const o = transformed(out, a, [0, 0, 0]);
    beam(o, 'concrete', [0, 39.3, 133.2], [0, 48.15, 154], 0.5, 0.6, concrete);
  }
  // Tapered22m-wide outer compression ring, open soffit beneath its inner lip.
  for (let i = 0; i < 384; i++) {
    const a = (i * TAU) / 384,
      b = ((i + 1) * TAU) / 384;
    face(
      out,
      'concrete',
      [rad(a, 154.5, 49.6), rad(b, 154.5, 49.6), rad(b, 132.5, 43.2), rad(a, 132.5, 43.2)],
      concrete,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [rad(a, 154.5, 48.5), rad(b, 154.5, 48.5), rad(b, 132.5, 39.2), rad(a, 132.5, 39.2)],
      concrete,
      [0, -1, 0],
    );
    face(
      out,
      'concrete',
      [rad(a, 154.5, 48.5), rad(b, 154.5, 48.5), rad(b, 154.5, 49.6), rad(a, 154.5, 49.6)],
      concrete,
      rad(a, 1),
    );
    face(
      out,
      'concrete',
      [rad(a, 132.5, 39.2), rad(b, 132.5, 39.2), rad(b, 132.5, 43.2), rad(a, 132.5, 43.2)],
      concrete,
      rad(a, -1),
    );
  }
  // Lower stadium enclosure is set far behind the freestanding columns.
  for (const y of [1.5, 5.2, 9.4]) {
    slab(out, 113, 130, y, 0.42);
    for (let i = 0; i < 192; i++) {
      const a = (i * TAU) / 192,
        b = ((i + 1) * TAU) / 192;
      face(
        out,
        'glass',
        [
          rad(a, 124, y + 0.25),
          rad(b, 124, y + 0.25),
          rad(b, 124, y + 3.05),
          rad(a, 124, y + 3.05),
        ],
        [0.1, 0.13, 0.13],
        rad(a, 1),
      );
      beam(out, 'concrete', rad(a, 124, y), rad(a, 124, y + 3.35), 0.22, 0.22, concrete);
    }
  }
  // Eight open ramp banks, visible between the columns in the architect's upper-bowl plan.
  for (let j = 0; j < 8; j++) {
    const a0 = (j * TAU) / 8 - 0.15;
    for (let flight = 0; flight < 4; flight++) {
      const y0 = flight * 2.4,
        rev = flight % 2 === 1,
        inner = 135.5 + (flight % 2) * 6.1,
        outer = inner + 5.4;
      const f = (t, r) => rad(a0 + t * 0.3, r, y0 + (rev ? 1 - t : t) * 2.4);
      for (let i = 0; i < 18; i++) {
        const t = i / 18,
          T = (i + 1) / 18,
          p = f(t, inner),
          q = f(T, inner),
          P = f(t, outer),
          Q = f(T, outer),
          d = (p) => [p[0], p[1] - 0.3, p[2]];
        face(out, 'concrete', [p, q, Q, P], concrete, [0, 1, 0]);
        face(out, 'concrete', [d(p), d(q), d(Q), d(P)], concrete, [0, -1, 0]);
        face(out, 'concrete', [P, Q, d(Q), d(P)], concrete, rad(a0, 1));
        face(out, 'concrete', [p, q, d(q), d(p)], concrete, rad(a0, -1));
      }
      for (const r of [inner, outer])
        rails(
          out,
          Array.from({ length: 19 }, (_, i) => f(i / 18, r)),
        );
      const t = rev ? 0 : 1,
        center = rad(a0 + t * 0.3, 141.3, y0 + 2.4),
        o = transformed(out, a0 + t * 0.3, center);
      box(o, 'concrete', [-1.8, -0.3, -6.1], [1.8, 0, 6.1], concrete);
    }
  }
  for (let i = 0; i < 19; i++) {
    const a = (i * TAU) / 19,
      o = transformed(out, a, rad(a, 125.1, 0.1));
    box(o, 'metal', [-2.3, 0, -0.15], [2.3, 3.05, 0.15], dark);
    for (let j = 0; j < 4; j++) {
      beam(o, 'metal', [-2 + j * 1.34, 0.2, 0.17], [-2 + j * 1.34, 2.9, 0.17], 0.08, 0.08, steel);
      tube(o, 'metal', [-1.9 + j * 1.1, 0.95, 0.4], [-1.9 + j * 1.1, 1.3, 0.4], 0.045, steel, 8);
    }
  }
  for (let j = 0; j < 8; j++) {
    const a = (j * TAU) / 8 - 0.15,
      o = transformed(out, a, [0, 9.6, 0]);
    box(o, 'concrete', [-1.8, -0.35, 123.5], [1.8, 0, 147.4], concrete);
    for (const x of [-1.8, 1.8])
      rails(o, [
        [x, 0, 123.5],
        [x, 0, 131],
        [x, 0, 139],
        [x, 0, 147.4],
      ]);
  }
}
const roofY = (r) => 40.3 + ((r - 68) / 64.5) * 2.9;
const bottomY = (r) => 31.3 + ((r - 68) / 64.5) * 7.9 - 1.1 * Math.sin(((r - 68) / 64.5) * Math.PI);
function roof(out) {
  const N = 96,
    R = 7;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < R; j++) {
      const r0 = 68 + (j * 64.5) / R,
        r1 = 68 + ((j + 1) * 64.5) / R;
      const p = (u, v) => {
        const r = r0 + (r1 - r0) * v,
          a = ((i + u) * TAU) / N;
        return rad(
          a,
          r,
          roofY(r) + 1.5 * Math.sin(Math.PI * u) * (0.22 + 0.78 * Math.cos(TAU * v)),
        );
      };
      for (let u = 0; u < 6; u++)
        for (let v = 0; v < 6; v++) {
          const ps = [
            p(u / 6, v / 6),
            p((u + 1) / 6, v / 6),
            p((u + 1) / 6, (v + 1) / 6),
            p(u / 6, (v + 1) / 6),
          ];
          fabricFace(out, ps, white, [0, 1, 0]);
          fabricFace(
            out,
            ps.map((p) => [p[0], p[1] - 0.032, p[2]]),
            [0.79, 0.81, 0.77],
            [0, -1, 0],
          );
        }
      if (j === 0)
        curve(
          out,
          Array.from({ length: 13 }, (_, k) => p(k / 12, 0)),
          0.049,
          white,
        );
      curve(
        out,
        Array.from({ length: 13 }, (_, k) => p(k / 12, 1)),
        0.049,
        white,
      );
      curve(
        out,
        Array.from({ length: 7 }, (_, k) => p(0, k / 6)),
        0.035,
        white,
      );
    }
  for (let i = 0; i < 48; i++) {
    const a = (i * TAU) / 48;
    // Lower radial cable chord carries the vertical roof trusses; the upper surface is independent.
    curve(
      out,
      Array.from({ length: 33 }, (_, j) => {
        const r = 68 + (j * 64.5) / 32;
        return rad(a, r, bottomY(r));
      }),
      0.087,
      steel,
      'metal',
      12,
    );
    curve(
      out,
      Array.from({ length: 15 }, (_, j) => {
        const r = 68 + (j * 64.5) / 14;
        return rad(a, r, roofY(r) - 0.23);
      }),
      0.075,
      white,
      'metal',
      12,
    );
    for (let j = 0; j <= 7; j++) {
      const r = 68 + (j * 64.5) / 7;
      tube(out, 'metal', rad(a, r, bottomY(r)), rad(a, r, roofY(r) - 0.2), 0.082, white, 12);
      if (j < 7) {
        const next = r + 64.5 / 7;
        tube(
          out,
          'metal',
          rad(a, r, bottomY(r)),
          rad(a, next, roofY(next) - 0.2),
          0.057,
          white,
          10,
        );
      }
    }
    const o = transformed(out, a, rad(a, 68, 31.3));
    box(o, 'metal', [-0.29, -0.18, -0.22], [0.29, 0.65, 0.22], steel);
    for (const x of [-0.16, 0.16])
      for (const y of [0, 0.45]) tube(o, 'metal', [x, y, 0.23], [x, y, 0.3], 0.038, dark, 8);
  }
  for (let j = 0; j <= 7; j++) {
    const r = 68 + (j * 64.5) / 7;
    ring(out, r, bottomY(r), j === 0 ? 0.18 : 0.075, steel, 'metal', 288);
    ring(out, r, roofY(r) - 0.23, 0.095, white);
    for (let i = 0; i < 48; i++) {
      const a = (i * TAU) / 48,
        b = ((i + 1) * TAU) / 48;
      tube(out, 'metal', rad(a, r, bottomY(r)), rad(b, r, roofY(r) - 0.23), 0.045, white, 8);
    }
  }
  // Clear inner panels follow the membrane arches at their outer edge and flatten at the oculus.
  const clear = (a, r) =>
    rad(a, r, 40.1 + ((r - 51) / 17) * (0.2 + 1.5 * Math.abs(Math.sin(a * 48))));
  for (let i = 0; i < 384; i++) {
    const a = (i * TAU) / 384,
      b = ((i + 1) * TAU) / 384;
    for (let j = 0; j < 4; j++) {
      const r = 51 + (j * 17) / 4,
        R = r + 17 / 4;
      face(
        out,
        'acrylic',
        [clear(a, r), clear(b, r), clear(b, R), clear(a, R)],
        [0.8, 0.86, 0.86],
        [0, 1, 0],
      );
    }
    if (i % 2 === 0)
      curve(
        out,
        Array.from({ length: 5 }, (_, j) => clear(a, 51 + (j * 17) / 4)),
        0.04,
        white,
      );
    if (i % 8 === 0) tube(out, 'metal', rad(a, 68, 31.3), clear(a, 55), 0.077, white, 12);
  }
  for (const r of [51, 55, 59, 63, 67])
    curve(
      out,
      Array.from({ length: 385 }, (_, i) => clear((i * TAU) / 384, r)),
      0.055,
      white,
    );
  // Sealed membrane flashing prevents a row of open gaps at the concrete compression ring.
  for (let i = 0; i < 576; i++) {
    const a = (i * TAU) / 576,
      b = ((i + 1) * TAU) / 576,
      pa = rad(a, 132.5, 43.2 + 1.5 * Math.abs(Math.sin(a * 48))),
      pb = rad(b, 132.5, 43.2 + 1.5 * Math.abs(Math.sin(b * 48))),
      da = rad(a, 132.5, 43.15),
      db = rad(b, 132.5, 43.15);
    face(out, 'membrane', [pa, pb, db, da], white, rad(a, 1));
    face(out, 'membrane', [pa, pb, db, da], white, rad(a, -1));
  }
  slab(out, 67.3, 69.1, 30.9, 0.13, [0.56, 0.6, 0.58]);
  for (const r of [67.4, 69])
    rails(
      out,
      Array.from({ length: 193 }, (_, i) => rad((i * TAU) / 192, r, 30.95)),
    );
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      o = transformed(out, a, rad(a, 67, 31.2));
    beam(o, 'metal', [-0.6, 0, 0], [0.6, 0, 0], 0.1, 0.12, steel);
    for (const x of [-0.42, 0, 0.42]) {
      box(o, 'metal', [x - 0.16, -0.36, -0.36], [x + 0.16, -0.03, 0.18], dark);
      face(
        o,
        'plastic',
        [
          [x - 0.14, -0.32, -0.38],
          [x + 0.14, -0.32, -0.38],
          [x + 0.14, -0.05, -0.38],
          [x - 0.14, -0.05, -0.38],
        ],
        [0.94, 0.95, 0.89],
        [0, 0, -1],
      );
    }
  }
  for (const s of [-1, 1]) {
    const o = transformed(out, s > 0 ? 0 : Math.PI, [0, 0, s * 69]);
    box(o, 'metal', [-7.8, 22, -0.4], [7.8, 30.6, 0.4], dark);
    face(
      o,
      'plastic',
      [
        [-7.45, 22.35, -0.42],
        [7.45, 22.35, -0.42],
        [7.45, 30.25, -0.42],
        [-7.45, 30.25, -0.42],
      ],
      [0.006, 0.012, 0.017],
      [0, 0, -1],
    );
    for (const x of [-6, 6]) tube(o, 'metal', [x, 30.5, 0], [x, 39.9, 0], 0.11, white, 16);
    for (let i = -7; i <= 7; i++)
      beam(o, 'metal', [i, 22.1, 0.44], [i, 30.5, 0.44], 0.1, 0.2, steel);
  }
}
const tiers = [
  { rows: 31, hx: 40.8, hz: 61.8, r: 12, dr: 0.55, run: 0.82, y: -11.25, rise: 0.365 },
  { rows: 8, hx: 68, hz: 89, r: 35, dr: 0.8, run: 0.67, y: 3.4, rise: 0.42 },
  { rows: 39, hx: 76, hz: 97, r: 42, dr: 1.1836, run: 0.81, y: 11.8, rise: 0.58 },
];
const seat = (a, t, row) =>
  rounded(a, t.hx + row * t.run, t.hz + row * t.run, t.r + row * t.dr, t.y + row * t.rise);
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, -11.8, 0]));
  for (let k = 0; k < tiers.length; k++) {
    const t = tiers[k];
    for (let row = 0; row < t.rows; row++)
      for (let i = 0; i < 400; i++) {
        const a = (i * TAU) / 400,
          b = ((i + 1) * TAU) / 400,
          p = seat(a, t, row),
          q = seat(b, t, row),
          P = seat(a, t, row + 1),
          Q = seat(b, t, row + 1);
        face(out, 'concrete', [p, q, [Q[0], p[1], Q[2]], [P[0], p[1], P[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[P[0], p[1], P[2]], [Q[0], p[1], Q[2]], Q, P], concrete, rad(a, -1));
        const sector = ((a / TAU) * 40) % 1;
        if (sector < 0.055 || sector > 0.945) {
          face(
            out,
            'concrete',
            [
              [p[0], p[1] + 0.011, p[2]],
              [q[0], p[1] + 0.011, q[2]],
              [Q[0], p[1] + 0.011, Q[2]],
              [P[0], p[1] + 0.011, P[2]],
            ],
            [0.85, 0.85, 0.8],
            [0, 1, 0],
          );
          continue;
        }
        const count = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.5));
        for (let j = 0; j < count; j++)
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), mix(p, q, (j + 0.5) / count), red);
      }
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        P = seat(a, t, t.rows),
        Q = seat(b, t, t.rows),
        down = (p) => [p[0], p[1] - 0.65, p[2]];
      face(out, 'concrete', [down(p), down(q), down(Q), down(P)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [P, Q, down(Q), down(P)], concrete, rad(a, 1));
    }
    for (let i = 0; i < 40; i++) {
      const a = (i * TAU) / 40;
      rails(
        out,
        Array.from({ length: t.rows + 1 }, (_, row) => seat(a + 0.01, t, row)),
      );
      if (k !== 1) {
        const row = k === 0 ? 23 : 14,
          p = seat(a, t, row),
          o = transformed(out, a, p);
        box(o, 'concrete', [-1.3, 0, -0.4], [1.3, 2.55, 3.0], concrete);
        face(
          o,
          'plastic',
          [
            [-1.13, 0.05, -0.42],
            [1.13, 0.05, -0.42],
            [1.13, 2.33, -0.42],
            [-1.13, 2.33, -0.42],
          ],
          dark,
          [0, 0, -1],
        );
      }
    }
  }
  // Hospitality glazing and concrete spandrels close both real gaps between the three tiers.
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        t = tiers[k],
        next = tiers[k + 1],
        low = seat(a, t, t.rows),
        Low = seat(b, t, t.rows),
        high = seat(a, next, 0),
        High = seat(b, next, 0),
        y0 = low[1] + 0.18,
        y1 = high[1] - 0.25;
      const p = [low[0], y0, low[2]],
        q = [Low[0], y0, Low[2]],
        P = [low[0], y1, low[2]],
        Q = [Low[0], y1, Low[2]];
      face(out, 'glass', [p, q, Q, P], [0.09, 0.14, 0.15], rad(a, -1));
      beam(out, 'metal', p, P, 0.065, 0.1, white);
      face(out, 'concrete', [P, Q, High, high], white, [0, 1, 0]);
      face(out, 'concrete', [low, Low, q, p], white, rad(a, -1));
      tube(out, 'metal', [p[0], y0 + 0.95, p[2]], [q[0], y0 + 0.95, q[2]], 0.026, white, 6);
      // Actual hospitality box depth behind the front glazing, sealed to the next bowl slab.
      const outside = (p) => [p[0] * 1.08, p[1], p[2] * 1.08];
      face(out, 'concrete', [low, Low, outside(Low), outside(low)], concrete, [0, 1, 0]);
      face(
        out,
        'concrete',
        [outside(low), outside(Low), outside(Q), outside(P)],
        concrete,
        rad(a, 1),
      );
    }
  // Open concourse behind the upper tier, seen through the monumental freestanding colonnade.
  for (let i = 0; i < 256; i++) {
    const a = (i * TAU) / 256,
      b = ((i + 1) * TAU) / 256,
      p = seat(a, tiers[2], 39),
      q = seat(b, tiers[2], 39);
    face(
      out,
      'concrete',
      [[p[0], 11.45, p[2]], [q[0], 11.45, q[2]], rad(b, 133.2, 11.45), rad(a, 133.2, 11.45)],
      concrete,
      [0, 1, 0],
    );
  }
  for (const z of [-16, 16]) {
    const o = transformed(out, Math.PI / 2, [-37.4, -11.7, z]);
    for (let j = 0; j < 14; j++) chair(o, 0, [j * 0.65 - 4.3, 0, 0], red);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 48,
        b = ((i + 1) * Math.PI) / 48,
        f = (a, x) => [x, 1.05 + 1.55 * Math.sin(a), 0.55 + 1.55 * Math.cos(a)];
      face(o, 'glassClear', [f(a, -5), f(a, 5), f(b, 5), f(b, -5)], [0.8, 0.89, 0.9], [0, 1, 1]);
      if (i % 4 === 0) beam(o, 'metal', f(a, -5), f(a, 5), 0.05, 0.05, steel);
    }
  }
}
export function buildBrasilia(out) {
  colonnade(out);
  bowl(out);
  roof(out);
}
export const brasiliaStudy = {
  id: 'N0703',
  key: 'estadio_nacional_de_brasilia',
  wikidataId: 'Q336088',
  title: 'Estádio Nacional de Brasília',
  build: buildBrasilia,
  metricTriangleUv: true,
  smoothNormalSlots: ['roof'],
  normalAt(p, slot, _ref, n) {
    if (slot !== 'foundation' || Math.abs(n[1]) > 0.05 || p[1] < 0 || p[1] > 50) return null;
    const a = ((Math.round((Math.atan2(p[0], p[2]) / TAU) * 96 - 0.5) + 0.5) * TAU) / 96;
    for (let j = 0; j < 3; j++) {
      const c = rad(a, 134 + 9 * j),
        x = p[0] - c[0],
        z = p[2] - c[2],
        r = Math.hypot(x, z);
      if (Math.abs(r - (0.6 + 0.075 * j)) < 0.035 && (n[0] * x + n[2] * z) / r > 0.96)
        return [x / r, 0, z / r];
    }
    return null;
  },
  size: [313, 63, 313],
  previewGroundless: true,
  portableReviewBasis:
    'Ground-free portable asset review exposes the depressed playing field. The shared geographic fixture cuts the actual terrain inside the colonnade; a raised field or filled flat ground would be incorrect.',
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Circular colonnade centre at its external pedestrian contact floor. +Z follows the football-field long axis; the street approach slopes down to this floor in the architect section.',
  },
  previewCamera: { position: [245, 164, 268], lookAt: [0, 17, 0] },
  visualBrief:
    'Brasília’s exposed circular concrete monument:288freestanding columns on96axes and3rings support a22m-wide tapered compression ring; a white doubly curved membrane roof covers48spoke-wheel cable/truss units and a clear polycarbonate cantilever around the102m open oculus. Three red seating tiers, two hospitality ribbons, open concourses,8ramp banks, hanging goal-end video screens and detailed roof light/catwalk systems remain visible.',
  sourceFacts: {
    published:
      'GMP completed photographs, scaled radial section and whole-bowl plan. ArcelorMittal:309m outer diameter,22m-wide ring,288columns in3rows on96axes,1.2–1.5m diameters,48radial cables; reported column lengths up to61m include portions not measurable as exposed height. SBP:55155m²roof; engineer project description:102m opening. Double polycarbonate/PTFE roof is documented by architect. Optional retractable closure was not built and is not represented.',
    reconstructed:
      'Visible roof49.6m and field−11.8m relative to colonnade contact floor are scaled from the architect section, not61m above ground. Bowl rows, curved membrane panel rise, small truss sizes,8ramp-bank transitions and hospitality details are constrained photographic reconstructions. Three red seating tiers and external circular envelope follow the architect plan. The full exterior is static.',
  },
  referencePages: [
    'https://www.gmp.de/en/projects/536/national-stadium-mane-garrincha',
    'https://www.sbp.solar/project/brasilia-national-stadium/?lang=en',
    'https://constructalia.arcelormittal.com/en/case_study_gallery/brazil/brasilia-national-stadium-mane-garrincha-reinforced-with-arcelormittal-steel',
    'https://german-architects.com/en/schlaich-bergermann-partner-sbp-stuttgart/project/estadio-nacional?nonav=1',
    'https://www.teufelberger.com/en/references/estadio-nacional-mane-garrincha',
    'https://www.openstreetmap.org/way/178591256',
  ],
  referenceRights:
    'Primary architect, engineer and supplier photographs/drawings consulted, not embedded. Original geometry and canonical shared procedural surfaces. OSM coordinates ©OpenStreetMap contributors,ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0is the colonnade pedestrian floor, not the underground pitch. Architect scaled radial section places the field about11.8m below and roof49.6m above this contact plane. The higher outer approach slope is site terrain.',
    groundCutout: {
      outline: Array.from({ length: 96 }, (_, i) => {
        const p = rad((i * TAU) / 96, 132);
        return [p[0], p[2]];
      }),
      basis:
        'Circular excavation inside the309m colonnade. Authored130–155.7m pavement annulus overlaps the132m cut boundary; negative bowl remains open.',
    },
    source: 'https://www.openstreetmap.org/way/178591256',
    featureIds: ['way/178591256'],
    notes:
      'Exact circular stadium footprint fixes centre/diameter. GMP whole-bowl plan north glyph and north-up masterplan independently put the north goal about11degrees east of north, so authored+Z north uses heading2.949606rad. Nearby mapped soccer pitch1160426074 is itself a circle and is rejected as heading evidence. This is a plan-derived field-axis estimate, not a surveyed bearing.',
  },
  limitations: [
    'Detailed permanent exterior and visible bowl; closed service rooms, subsurface foundations, temporary sponsor/video imagery and an exact ticket-seat inventory are excluded. Ramp and truss-member inventories are architectural reconstructions, with measured overall dimensions retained.',
  ],
  qaCameras: [
    { name: 'near-three-colonnades', position: [33, 9, 176], lookAt: [22, 24, 135] },
    { name: 'near-concrete-lifts', position: [4, 9, 160], lookAt: [5, 13, 152] },
    { name: 'near-ramp-bank', position: [35, 14, 155], lookAt: [2, 5, 142] },
    { name: 'near-compression-ring', position: [17, 58, 173], lookAt: [15, 45, 138] },
    { name: 'near-scalloped-membrane', position: [23, 62, 107], lookAt: [18, 42, 101] },
    { name: 'near-radial-truss', position: [12, 28, 91], lookAt: [0, 35, 89] },
    { name: 'near-clear-oculus', position: [10, 49, 29], lookAt: [9, 40, 59] },
    { name: 'near-catwalk-lights', position: [14, 31, 46], lookAt: [12, 30, 67] },
    { name: 'near-three-red-tiers', position: [0, -6, 0], lookAt: [93, 12, 0] },
    { name: 'near-hospitality', position: [42, 7, 0], lookAt: [74, 8, 0] },
    { name: 'near-screen', position: [18, 20, 40], lookAt: [0, 26, 69] },
    { name: 'far-roof-and-bowl', position: [139, 301, 179], lookAt: [0, 18, 0] },
  ],
};

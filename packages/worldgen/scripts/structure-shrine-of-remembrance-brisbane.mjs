/** Brisbane's open Doric shrine and its integral retaining crypt, stairs and pools. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r7/r7h/shrine_of_remembrance_brisbane/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  R = A.baseOuterRadius,
  F = A.forecourtY,
  B = F + A.baseSteps * A.baseStepHeight,
  shaftTop = B + A.shaftHeight,
  capitalTop = shaftTop + A.capitalHeight,
  ringTop = capitalTop + A.entablatureHeight,
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('d1b999'),
    trim: rgb('c1b092'),
    base: rgb('b5b5ac'),
    bronze: rgb('486152'),
    iron: rgb('36433d'),
    accent: rgb('f4b554'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
    base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
    bronze: { slot: 'roof', graph: 'metal_bronze_cast', roughness: 0.72, metallic: 0.6 },
    iron: { slot: 'door', graph: 'metal_painted', roughness: 0.88, metallic: 0.1 },
    accent: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.68, metallic: 0 },
  };
const circle = (r, N, offset = 0) =>
    Array.from({ length: N }, (_, i) => [
      r * Math.cos(offset + (2 * Math.PI * i) / N),
      r * Math.sin(offset + (2 * Math.PI * i) / N),
    ]),
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  ring = (r) =>
    r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 1e-7
      ? r.slice(0, -1)
      : r,
  feature = (role) => p.features.find((f) => f.role === role).outline,
  tint = (c, k) => c.map((v) => v * k);
function T(o, s, q, n, color = C[s]) {
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
    color,
  );
}
function Q(o, s, q, n, color = C[s]) {
  T(o, s, q.slice(0, 3), n, color);
  T(o, s, [q[0], q[2], q[3]], n, color);
}
function flat(o, s, poly, Y, color = C[s]) {
  const r = ring(poly),
    ids = earcut(r.flat()),
    yy = typeof Y === 'function' ? Y : () => Y;
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [r[k][0], yy(...r[k]), r[k][1]]),
      [0, 1, 0],
      color,
    );
}
function box(o, s, x, y, z, w, h, l, color = C[s], bottom = false, angle = 0) {
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [
      x + (Math.cos(angle) * i * w) / 2 - (Math.sin(angle) * j * l) / 2,
      y,
      z + (Math.sin(angle) * i * w) / 2 + (Math.cos(angle) * j * l) / 2,
    ]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  if (bottom) Q(o, s, a.toReversed(), [0, -1, 0], color);
  Q(o, s, b, [0, 1, 0], color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], color);
  }
}
function beam(o, s, a, b, w, h, color = C[s]) {
  const q = b.map((v, k) => v - a[k]),
    L = Math.hypot(...q),
    n = q.map((v) => v / L),
    v = cross(n, Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    V = v.map((x) => x / Math.hypot(...v)),
    U = cross(n, V),
    rr = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + (i * V[k] * w) / 2 + (j * U[k] * h) / 2)),
    a0 = rr(a),
    b0 = rr(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a0[i], a0[j], b0[j], b0[i]], null, color);
  }
  Q(o, s, b0, n, color);
}
function lathe(o, s, x, z, profile, N, color = C[s], flutes = 0, inward = false) {
  const point = (pr, i) => {
    const a = (2 * Math.PI * i) / N,
      r = pr[1] - (flutes ? 0.022 * (0.5 + 0.5 * Math.cos(a * flutes)) : 0);
    return [x + r * Math.cos(a), pr[0], z + r * Math.sin(a)];
  };
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const a = point(profile[j], i),
        b = point(profile[j], i + 1),
        c = point(profile[j + 1], i + 1),
        d = point(profile[j + 1], i);
      Q(
        o,
        s,
        [a, b, c, d],
        [
          Math.cos(((i + 0.5) * 2 * Math.PI) / N) * (inward ? -1 : 1),
          0,
          Math.sin(((i + 0.5) * 2 * Math.PI) / N) * (inward ? -1 : 1),
        ],
        color,
      );
    }
}
function annulus(o, s, outer, inner, y, N, color = C[s], down = false) {
  const a = circle(outer, N),
    b = circle(inner, N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    Q(
      o,
      s,
      [
        [a[i][0], y, a[i][1]],
        [a[j][0], y, a[j][1]],
        [b[j][0], y, b[j][1]],
        [b[i][0], y, b[i][1]],
      ],
      [0, down ? -1 : 1, 0],
      color,
    );
  }
}
function band(o, s, outer, inner, y0, y1, N, color = C[s]) {
  lathe(
    o,
    s,
    0,
    0,
    [
      [y0, outer],
      [y1, outer],
    ],
    N,
    color,
  );
  lathe(
    o,
    s,
    0,
    0,
    [
      [y1, inner],
      [y0, inner],
    ],
    N,
    color,
    0,
    true,
  );
  annulus(o, s, outer, inner, y0, N, color, true);
  annulus(o, s, outer, inner, y1, N, color);
}
function wall(o, a, b, lo0, lo1, hi0, hi1, w, d, color = C.trim) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L],
    P = (q, y, v = 0) => [q[0] + n[0] * v, y, q[1] + n[2] * v];
  Q(o, 'trim', [P(a, lo0), P(b, lo1), P(b, hi1), P(a, hi0)], n, color);
  if (d > 0) {
    Q(
      o,
      'trim',
      [P(a, lo0, -w), P(b, lo1, -w), P(b, hi1, -w), P(a, hi0, -w)],
      n.map((v) => -v),
      color,
    );
    Q(
      o,
      'trim',
      [P(a, hi0), P(b, hi1), P(b, hi1, -w), P(a, hi0, -w)],
      [0, 1, 0],
      tint(color, 1.08),
    );
  }
}
function columns(o, d) {
  const N = [4, 8, 60, 100][d],
    capN = [4, 8, 20, 28][d],
    rc = A.columnRadius;
  for (let i = 0; i < 18; i++) {
    const a = (i * 2 * Math.PI) / 18,
      x = rc * Math.cos(a),
      z = rc * Math.sin(a);
    if (d === 0)
      lathe(
        o,
        'stone',
        x,
        z,
        [
          [B, 0.33],
          [shaftTop, 0.29],
          [capitalTop, 0.46],
        ],
        N,
      );
    else {
      const profiles =
        d === 1
          ? [
              [B, 0.33],
              [shaftTop, 0.29],
            ]
          : [
              [B, 0.33],
              [B + A.shaftHeight * 0.42, 0.33],
              [shaftTop, 0.29],
            ];
      lathe(o, 'stone', x, z, profiles, N, C.stone, d > 1 ? 20 : 0);
      lathe(
        o,
        'stone',
        x,
        z,
        d === 1
          ? [
              [shaftTop, 0.29],
              [capitalTop - 0.16, 0.46],
            ]
          : [
              [shaftTop, 0.29],
              [shaftTop + 0.1, 0.34],
              [capitalTop - 0.16, 0.46],
            ],
        capN,
        tint(C.stone, 1.035),
      );
      box(o, 'stone', x, capitalTop - 0.16, z, 0.89, 0.16, 0.89, tint(C.stone, 1.035), false, a);
      if (d > 2)
        for (const yy of [B + 1.42, B + 2.86])
          lathe(
            o,
            'stone',
            x,
            z,
            [
              [yy, 0.326],
              [yy + 0.018, 0.326],
            ],
            40,
            tint(C.stone, 0.87),
          );
    }
  }
}
function baseAndFloor(o, d) {
  const N = [12, 36, 72, 108][d];
  for (let j = 0; j < 3; j++) {
    const r = R - j * 0.155,
      y = F + j * 0.18;
    lathe(
      o,
      'base',
      0,
      0,
      [
        [y, r],
        [y + 0.18, r],
      ],
      N,
      C.base,
    );
    if (j < 2) annulus(o, 'base', r, r - 0.155, y + 0.18, N, C.base);
  }
  flat(o, 'base', circle(R - 0.31, N), B, tint(C.base, 0.94));
  if (d > 0) {
    const N = 16,
      r = 3.85;
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        m = (a + b) / 2;
      T(
        o,
        'base',
        [
          [0, B + 0.012, 0],
          [Math.cos(a) * r, B + 0.012, Math.sin(a) * r],
          [Math.cos(m) * 0.95, B + 0.012, Math.sin(m) * 0.95],
        ],
        [0, 1, 0],
        rgb('be985b'),
      );
      T(
        o,
        'base',
        [
          [0, B + 0.013, 0],
          [Math.cos(m) * 0.95, B + 0.013, Math.sin(m) * 0.95],
          [Math.cos(b) * r, B + 0.013, Math.sin(b) * r],
        ],
        [0, 1, 0],
        rgb('9da9a0'),
      );
    }
    annulus(o, 'bronze', 4.04, 3.96, B + 0.013, [36, 48, 72, 108][d], rgb('526a5e'));
  }
}
function entablature(o, d) {
  const N = [18, 36, 72, 108][d];
  if (d < 2) band(o, 'stone', R - 0.2, R - 1.48, capitalTop, ringTop, N);
  else {
    const outer = [
        [capitalTop, R - 0.49],
        [capitalTop + 0.28, R - 0.49],
        [capitalTop + 0.34, R - 0.38],
        [ringTop - 0.28, R - 0.38],
        [ringTop - 0.22, R - 0.15],
        [ringTop - 0.1, R - 0.15],
        [ringTop, R - 0.23],
      ],
      inner = [
        [capitalTop, R - 1.5],
        [capitalTop + 0.26, R - 1.5],
        [capitalTop + 0.32, R - 1.44],
        [ringTop - 0.1, R - 1.44],
        [ringTop, R - 1.48],
      ];
    lathe(o, 'stone', 0, 0, outer, N);
    lathe(o, 'stone', 0, 0, inner.toReversed(), N, C.stone, 0, true);
    annulus(o, 'stone', R - 0.49, R - 1.5, capitalTop, N);
    annulus(o, 'stone', R - 0.23, R - 1.48, ringTop, N);
    const count = d === 1 ? 18 : 36;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count,
        r = R - 0.365,
        y = capitalTop + 0.72,
        P = (u, h, v = 0) => [
          Math.cos(a) * (r + v) - Math.sin(a) * u,
          y + h,
          Math.sin(a) * (r + v) + Math.cos(a) * u,
        ];
      // Original geometric metope flowers/triglyphs; no copied battlefield lettering or relief faces.
      const petals = d === 1 ? 4 : 8;
      for (let k = 0; k < petals; k++) {
        const t = (k * 2 * Math.PI) / petals,
          q = ((k + 1) * 2 * Math.PI) / petals;
        T(
          o,
          'stone',
          [
            P(0, 0, 0.035),
            P(Math.cos(t) * 0.16, Math.sin(t) * 0.16, 0.02),
            P(Math.cos(q) * 0.16, Math.sin(q) * 0.16, 0.02),
          ],
          [Math.cos(a), 0, Math.sin(a)],
          tint(C.stone, 1.04),
        );
      }
      if (d > 1) {
        const t = a + Math.PI / count,
          x = Math.cos(t) * (R - 0.345),
          z = Math.sin(t) * (R - 0.345);
        for (const u of [-0.08, 0, 0.08])
          beam(
            o,
            'stone',
            [x - Math.sin(t) * u, capitalTop + 0.34, z + Math.cos(t) * u],
            [x - Math.sin(t) * u, ringTop - 0.3, z + Math.cos(t) * u],
            0.045,
            0.035,
            tint(C.stone, 0.95),
          );
      }
    }
  }
  const rr = R - 0.3;
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N;
    Q(
      o,
      'bronze',
      [
        [rr * Math.cos(a), ringTop + 0.02, rr * Math.sin(a)],
        [rr * Math.cos(b), ringTop + 0.02, rr * Math.sin(b)],
        [rr * Math.cos(b), ringTop + 0.12, rr * Math.sin(b)],
        [rr * Math.cos(a), ringTop + 0.12, rr * Math.sin(a)],
      ],
      [(Math.cos(a) + Math.cos(b)) / 2, 0, (Math.sin(a) + Math.sin(b)) / 2],
    );
  }
  if (d > 0)
    for (let i = 0; i < 36; i++) {
      const a = (i * 2 * Math.PI) / 36,
        P = (u, y, v = 0) => [
          Math.cos(a) * (rr + v) - Math.sin(a) * u,
          ringTop + y,
          Math.sin(a) * (rr + v) + Math.cos(a) * u,
        ];
      T(
        o,
        'bronze',
        [P(-0.12, 0.1), P(0.12, 0.1), P(0, 0.36, 0.025)],
        [Math.cos(a), 0, Math.sin(a)],
      );
      if (d > 1) {
        T(o, 'bronze', [P(-0.16, 0.1), P(-0.05, 0.27), P(0, 0.19)], [Math.cos(a), 0, Math.sin(a)]);
        T(o, 'bronze', [P(0, 0.19), P(0.05, 0.27), P(0.16, 0.1)], [Math.cos(a), 0, Math.sin(a)]);
      }
    }
}
function railings(o, d) {
  const r = A.columnRadius;
  for (let i = 0; i < 18; i++) {
    if (i === 4 || i === 13) continue;
    const a = ((i + 0.055) * 2 * Math.PI) / 18,
      b = ((i + 0.945) * 2 * Math.PI) / 18,
      P = (t, y) => [r * Math.cos(t), B + y, r * Math.sin(t)];
    for (const y of [0.18, 1.1]) {
      if (d === 0)
        Q(
          o,
          'iron',
          [P(a, y), P(b, y), P(b, y + 0.045), P(a, y + 0.045)],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      else beam(o, 'iron', P(a, y), P(b, y), 0.035, 0.04);
    }
    if (d > 0) {
      const n = [0, 4, 6, 8][d];
      for (let k = 0; k < n; k++) {
        const t = a + ((b - a) * (k + 0.5)) / n;
        if (d === 1) {
          const p = P(t, 0.12),
            q = P(t, 1.2);
          Q(
            o,
            'iron',
            [
              [p[0] - 0.012, p[1], p[2]],
              [p[0] + 0.012, p[1], p[2]],
              [q[0] + 0.012, q[1], q[2]],
              [q[0] - 0.012, q[1], q[2]],
            ],
            [Math.cos(t), 0, Math.sin(t)],
          );
        } else {
          beam(o, 'iron', P(t, 0.1), P(t, 1.2), 0.022, 0.026);
          const q = P(t, 1.2);
          T(
            o,
            'iron',
            [
              [q[0] - 0.055, q[1], q[2]],
              [q[0] + 0.055, q[1], q[2]],
              [q[0], q[1] + 0.13, q[2]],
            ],
            [Math.cos(t), 0, Math.sin(t)],
          );
        }
      }
    }
  }
  // Two short simple rails give access over the three granite tiers at AnnStreet and the park side.
  if (d > 0)
    for (const sign of [-1, 1])
      for (const side of [-1, 1]) {
        const z = sign * (R - 0.2),
          x = side * 0.65;
        beam(
          o,
          'iron',
          [x, F + 0.95, z + sign * 0.7],
          [x, B + 0.95, z - sign * 0.55],
          0.035,
          0.035,
        );
        beam(o, 'iron', [x, F, z + sign * 0.7], [x, F + 0.95, z + sign * 0.7], 0.04, 0.04);
      }
}
function urn(o, d) {
  const N = [5, 12, 24, 36][d],
    y = B;
  if (d === 0) {
    for (const x of [-0.32, 0.32])
      for (const z of [-0.32, 0.32])
        Q(
          o,
          'bronze',
          [
            [x - 0.035, y, z],
            [x + 0.035, y, z],
            [x + 0.035, y + 1.15, z],
            [x - 0.035, y + 1.15, z],
          ],
          [0, 0, z > 0 ? 1 : -1],
        );
  } else {
    box(o, 'bronze', 0, y, 0, 0.86, 0.09, 0.86);
    for (const x of [-0.32, 0.32])
      for (const z of [-0.32, 0.32])
        beam(o, 'bronze', [x, y + 0.08, z], [x * 0.85, y + 1.13, z * 0.85], 0.065, 0.065);
  }
  lathe(
    o,
    'bronze',
    0,
    0,
    [
      [y + 1.02, 0.2],
      [y + 1.16, 0.42],
      [y + 1.42, 0.58],
      [y + 1.52, 0.45],
      [y + 1.63, 0.36],
      [y + 1.7, 0.41],
    ],
    N,
  );
  annulus(o, 'bronze', 0.41, 0.31, y + 1.7, N);
  if (d > 0)
    for (let k = 0; k < 12; k++) {
      const a = (k * 2 * Math.PI) / 12,
        x = Math.cos(a) * 0.5,
        z = Math.sin(a) * 0.5;
      beam(
        o,
        'bronze',
        [x, y + 1.24, z],
        [x * 0.9, y + 1.47, z * 0.9],
        0.035,
        0.03,
        tint(C.bronze, 0.78),
      );
    }
  for (let k = 0; k < 2; k++) {
    const a = (k * Math.PI) / 2,
      P = (u, h) => [Math.cos(a) * u, y + 1.66 + h, Math.sin(a) * u];
    T(
      o,
      'accent',
      [P(-0.12, 0.02), P(0.14, 0.04), P(0.065, 0.5)],
      [Math.sin(a), 0, -Math.cos(a)],
      rgb('efb257'),
    );
    T(
      o,
      'accent',
      [P(0.07, 0.03), P(0.2, 0.1), P(0.16, 0.34)],
      [Math.sin(a), 0, -Math.cos(a)],
      rgb('e28b42'),
    );
  }
}
function slabsAndRetaining(o, d) {
  const r = ring(feature('actual-paved-upper-forecourt-with-shrine-base-cutout'));
  flat(o, 'base', r, F, rgb('b7b3a0'));
  if (d > 1) {
    const inside = (q) => {
        let yes = false;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++)
          if (
            r[i][1] > q[1] !== r[j][1] > q[1] &&
            q[0] < ((r[j][0] - r[i][0]) * (q[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
          )
            yes = !yes;
        return yes;
      },
      step = d === 2 ? 1.2 : 0.75;
    for (let x = -35, k = 0; x < 29; x += step, k++)
      for (let z = -17, j = 0; z < 1; z += step, j++) {
        if ((k + j) % 2) continue;
        const q = [
          [x, z],
          [x + step, z],
          [x + step, z + step],
          [x, z + step],
        ];
        if (q.every(inside)) flat(o, 'base', q, F + 0.012, rgb('8f9d8c'));
      }
  }
  // Upper forecourt is a real mapped slab on a hollow retaining shell, not a fabricated terrain pad.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      mid = mix(a, b, 0.5);
    if (Math.hypot(...mid) < 6.5) continue;
    wall(o, a, b, A.parkY, A.parkY, F, F, 0.45, d, mid[1] < -9 ? tint(C.trim, 0.83) : C.trim);
    if (d > 0 && mid[1] > -9) wall(o, a, b, F, F, F + 0.82, F + 0.82, 0.3, d, tint(C.stone, 0.94));
  }
  const N = [12, 36, 72, 108][d],
    rc = R + 0.8;
  lathe(
    o,
    'trim',
    0,
    0,
    [
      [A.parkY, rc],
      [F, rc],
    ],
    N,
    C.trim,
  );
  annulus(o, 'base', rc, R, F, N, rgb('b7b3a0'));
  if (d > 0) {
    for (const yy of [A.landingY - 0.8, A.landingY + 0.4, F - 0.24])
      lathe(
        o,
        'trim',
        0,
        0,
        [
          [yy, rc + 0.025],
          [yy + 0.08, rc + 0.025],
        ],
        N,
        tint(C.trim, 1.06),
      );
    // Plain panel and lantern masses mark the frontage without reproducing memorial words/relief figures.
    box(o, 'trim', 0, A.landingY + 0.55, rc + 0.035, 0.9, 1.0, 0.08, tint(C.trim, 0.85));
    if (d > 1)
      for (const x of [-1.75, 1.75]) {
        box(o, 'bronze', x, A.landingY + 1.2, rc, 0.22, 0.45, 0.18);
        box(o, 'bronze', x, A.landingY + 1.65, rc, 0.3, 0.08, 0.24);
      }
  }
}
function pathAt(poly, t) {
  const lengths = [];
  let total = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const L = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]);
    lengths.push(L);
    total += L;
  }
  let q = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (q <= lengths[i] || i === lengths.length - 1)
      return mix(poly[i], poly[i + 1], q / lengths[i]);
    q -= lengths[i];
  }
  return poly.at(-1);
}
function smoothPath(raw) {
  const r = [];
  for (let i = 0; i < raw.length - 1; i++)
    for (let k = 0; k < 8; k++) {
      const t = k / 8,
        a = raw[Math.max(0, i - 1)],
        b = raw[i],
        c = raw[i + 1],
        d = raw[Math.min(raw.length - 1, i + 2)];
      r.push(
        [0, 1].map(
          (j) =>
            0.5 *
            (2 * b[j] +
              (-a[j] + c[j]) * t +
              (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t +
              (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * Math.pow(t, 3)),
        ),
      );
    }
  r.push(raw.at(-1));
  return r;
}
function flight(o, path, lo, hi, risers, width, d) {
  const N = d === 0 ? 3 : risers,
    sample = (t, y, side, extra = 0) => {
      const p = pathAt(path, t),
        a = pathAt(path, Math.max(0, t - 0.0001)),
        b = pathAt(path, Math.min(1, t + 0.0001)),
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        w = side * (width / 2 + extra);
      return [p[0] + (dz / L) * w, y, p[1] - (dx / L) * w];
    };
  for (let i = 0; i < N; i++) {
    const a = i / N,
      b = (i + 1) / N,
      y = lo + ((hi - lo) * (i + 1)) / N,
      prev = lo + ((hi - lo) * i) / N,
      P = (t, Y, side) => sample(t, Y, side);
    Q(o, 'base', [P(a, y, -1), P(b, y, -1), P(b, y, 1), P(a, y, 1)], [0, 1, 0]);
    Q(o, 'trim', [P(a, prev, -1), P(a, prev, 1), P(a, y, 1), P(a, y, -1)], null);
    for (const side of [-1, 1]) {
      Q(o, 'trim', [P(a, A.parkY, side), P(b, A.parkY, side), P(b, y, side), P(a, y, side)], null);
    }
  }
  if (d > 0) {
    const K = risers === 19 ? 2 : [0, 4, 12, 24][d];
    for (let i = 0; i < K; i++)
      for (const side of [-1, 1]) {
        const t = i / K,
          u = (i + 1) / K,
          y = lo + (hi - lo) * t,
          z = lo + (hi - lo) * u,
          a = sample(t, y, side, 0.16),
          b = sample(u, z, side, 0.16);
        wall(o, [a[0], a[2]], [b[0], b[2]], y, z, y + 1.02, z + 1.02, 0.25, d, tint(C.stone, 1.02));
      }
  }
}
function stairsAndPools(o, d) {
  const central = feature('central-19-step-path'),
    west = feature('western-18-step-wrapping-path'),
    east = feature('eastern-18-step-wrapping-path');
  flight(o, central, A.parkY, A.landingY, 19, A.centralStairWidth, d);
  flight(o, smoothPath(west), A.landingY, F, 18, A.curvedStairWidth, d);
  flight(o, smoothPath(east), A.landingY, F, 18, A.curvedStairWidth, d);
  const q = central.at(-1);
  flat(
    o,
    'base',
    [
      [q[0] - 3.3, q[1] - 1.2],
      [q[0] + 3.3, q[1] - 1.2],
      [q[0] + 3.3, q[1] + 0.15],
      [q[0] - 3.3, q[1] + 0.15],
    ],
    A.landingY,
  );
  if (d > 0)
    for (const [x, z, y] of [
      [-3.3, central[0][1], A.parkY],
      [3.3, central[0][1], A.parkY],
      [-3.3, q[1], A.landingY],
      [3.3, q[1], A.landingY],
      [-11.8, 0, F],
      [11.8, 0, F],
    ]) {
      box(o, 'stone', x, y, z, 0.66, 1.25, 0.66);
      box(o, 'stone', x, y + 1.25, z, 0.84, 0.12, 0.84, tint(C.stone, 1.06));
    }
  for (const role of ['eastern-reflecting-pool', 'western-reflecting-pool']) {
    const r = ring(feature(role));
    flat(o, 'accent', r, A.parkY + 0.12, rgb('71968e'));
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      wall(o, a, b, A.parkY, A.parkY, A.parkY + 0.3, A.parkY + 0.3, 0.22, d, tint(C.stone, 0.9));
    }
  }
}
function build(o, _f, d = 3) {
  slabsAndRetaining(o, d);
  stairsAndPools(o, d);
  baseAndFloor(o, d);
  columns(o, d);
  entablature(o, d);
  railings(o, d);
  urn(o, d);
}
export function brisbaneShrineTriangleStats(d) {
  return Object.fromEntries(
    [slabsAndRetaining, stairsAndPools, baseAndFloor, columns, entablature, railings, urn].map(
      (fn) => {
        let n = 0;
        fn(
          {
            addTriangle() {
              n++;
            },
          },
          d,
        );
        return [fn.name, n];
      },
    ),
  );
}
export const brisbaneShrineSkyline = (o, f) => build(o, f, 0),
  brisbaneShrineDistrict = (o, f) => build(o, f, 1),
  brisbaneShrineStreet = (o, f) => build(o, f, 2),
  brisbaneShrineCloseup = (o, f) => build(o, f, 3);
export const brisbaneShrineModel = {
  id: 'shrine_of_remembrance_brisbane',
  key: 'shrine_of_remembrance_brisbane',
  cell: 'r7/r7h',
  recipe: 'structure-shrine-of-remembrance-brisbane.mjs',
  title: 'Shrine of Remembrance, Brisbane',
  category: 'religious',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-43, 24, 46],
  lookAt: [0, 0.5, 0],
  portableGroundY: A.parkY - 0.35,
  mediumFiContext: { scale: 0.8, groundY: A.parkY - 0.2 },
  qaCameras: [
    {
      name: 'whole-open-shrine-forecourt-crypt-stairs-retaining-wings-and-pools',
      position: [-43, 24, 46],
      lookAt: [0, 0.5, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'front-twin-wrapping-stairs-central-flight-and-open-colonnade',
      position: [0, 7, 31],
      lookAt: [0, 1, 0],
    },
    {
      name: 'ann-street-eighteen-doric-columns-ring-and-three-granite-steps',
      position: [-12, 7, -15],
      lookAt: [0, 3, 0],
    },
    {
      name: 'open-sky-ring-fluted-shafts-rosettes-and-bronze-crest',
      position: [9, 11, 10],
      lookAt: [0, 4.8, 0],
    },
    {
      name: 'urn-open-legged-stand-static-flame-and-geometric-floor',
      position: [2.3, 2.8, 3.1],
      lookAt: [0, 1.8, 0],
    },
    {
      name: 'western-wrapping-flight-pool-and-sandstone-retaining-wing',
      position: [-23, 6, 15],
      lookAt: [-8, -1, 2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-shrine-of-remembrance-brisbane.mjs',
    level: 'skyline',
    export: 'brisbaneShrineSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'brisbaneShrineDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'brisbaneShrineStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'brisbaneShrineCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole surviving shrine and integral structural exterior: eighteen genuinely separate Doric columns/open circular entablature, three granite base tiers, iron intercolumn/entry rails, simplified bronze open-legged urn/static flame/geometric floor, actual upper forecourt, crypt-retaining drum/wings, mapped twin wrapping stair paths/central flight and reflecting pools. No solid roof/dome, full-park ground pad, neighbouring offices/railway station, other statues, copied memorial text/figured reliefs/urn faces, floral offerings/people/vegetation or hidden gallery interior/access invention.',
    'Four exact cleared published originals: Figaro2006 whole AnnStreet rotunda/two urn-and-column details and unrecorded-photographer SLQcirca1939 front/stairs/retaining-wall view. One conflicting merged hero alias is excluded; exact unchanged local hero bytes are independently bound to native own/PD-self release without source metadata repair. Native paving cutout supplies a5.395m fitted base radius with0.108m maximum residual; column/ring/ornament dimensions, precise metope/crest census, urn stand/hidden retaining sections and current conservation repairs remain medium-fi estimates.',
    'Independent coarse city terrain has the wrong grade for the documented stair descent; original16641 values/PNG/raw tile remain unchanged. Isolated model and flat contextual views show physical architecture, not certified ground contact. Source field is retained as separate incompatible-ground evidence; exact slab/crypt/retaining/park contacts and tide-free pool level unsurveyed, geographic replacement disabled.',
    'Plain subgrade closure beneath the AnnStreet paving is an unobserved structural-section estimate for a complete isolated asset, not a claimed exposed rear facade. Wrapped stair profiles follow smooth interpolation through actual native control points; actual riser counts are retained in district/near views. Paving checkers and geometric rosettes/crest/floor rays are original medium-fi interpretations; no text or figured sculptural reliefs copied.',
    'Six actual canonical slots/five shared graphs: Helidon sandstone wall, sandstone coping trim, granite foundation/terrazzo, cast bronze roof bucket for crest/urn, painted iron door bucket for railings and one local accent material for static flame/opaque pool colour. No physical roof implied by canonical material bucket, no water/fire simulation or generated photographic texture. Skyline retains all18 columns/open oculus/full site scope; near levels restore20-flute shafts/entasis/Doric capitals/abaci, original geometric rosettes/triglyphs, crest sprigs/iron pickets, exact mapped stair counts, coping/piers and floor pattern.',
  ],
};

/** Cascades Female Factory: surviving yards, Matron's Cottage and interpretation centre. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r2/r22/cascades_female_factory/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff';
const C = {
  stone: rgb('b0a085'),
  plaster: rgb('d5d0b8'),
  metal: rgb('727873'),
  wood: rgb('6d6456'),
  glass: rgb('35433d'),
  base: rgb('a29d8a'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
  plaster: { slot: 'trim', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.88, metallic: 0.15 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
};
export function cascadesFemaleFactoryGround(x, z) {
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
  if (h <= 0) return;
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, a.toReversed(), [0, -1, 0], col);
  Q(o, s, b, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], col);
  }
}
const _mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  tint = (c, k) => c.map((v) => Math.max(0, Math.min(1, v * k)));
function wall(o, a, b, H, d, { gabion = false, portal = null } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    vx = (b[0] - a[0]) / L,
    vz = (b[1] - a[1]) / L,
    n = [vz, 0, -vx],
    th = gabion ? 0.8 : A.wallThickness,
    at = (u, y, v = 0) => [a[0] + vx * u + n[0] * v, y, a[1] + vz * u + n[2] * v],
    gy = (u) => cascadesFemaleFactoryGround(a[0] + vx * u, a[1] + vz * u),
    col = gabion ? rgb('8d8a7b') : C.stone;
  const ranges = portal
    ? [
        [0, portal[0], -0.25],
        [portal[0], portal[1], portal[2]],
        [portal[1], L, -0.25],
      ]
    : [[0, L, -0.25]];
  for (const [l, r, lo] of ranges) {
    if (r <= l) continue;
    const steps = Math.max(1, Math.ceil((r - l) / [24, 8, 3, 2][d]));
    for (let i = 0; i < steps; i++) {
      const u = l + ((r - l) * i) / steps,
        v = l + ((r - l) * (i + 1)) / steps,
        ya = gy(u),
        yb = gy(v),
        top = (u, i) => gy(u) + H + (!gabion && d > 0 ? ((i % 3) - 1) * 0.035 : 0),
        P = [
          at(u, ya + lo, -th / 2),
          at(v, yb + lo, -th / 2),
          at(v, yb + lo, th / 2),
          at(u, ya + lo, th / 2),
        ],
        U = [
          at(u, top(u, i), -th / 2),
          at(v, top(v, i + 1), -th / 2),
          at(v, top(v, i + 1), th / 2),
          at(u, top(u, i), th / 2),
        ];
      Q(o, 'stone', P.toReversed(), [0, -1, 0], col);
      Q(o, 'stone', U, [0, 1, 0], col);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        Q(o, 'stone', [P[k], P[j], U[j], U[k]], null, col);
      }
    }
    if (d >= 2) {
      const rowH = gabion ? [0, 0, 1, 0.65][d] : [0, 0, 0.85, 0.48][d],
        bw = gabion ? 1.05 : [0, 0, 1.7, 1.05][d];
      for (let row = 0; row * rowH < H; row++) {
        const low = Math.max(lo, row * rowH + 0.035),
          high = Math.min(H - 0.04, (row + 1) * rowH - 0.035);
        if (high <= low) continue;
        let k = 0;
        for (let u = l - ((row % 2) * bw) / 2; u < r; u += bw, k++) {
          const x = Math.max(l + 0.015, u + 0.025),
            z = Math.min(r - 0.015, u + bw - 0.025);
          if (z <= x) continue;
          const c = tint(col, 0.8 + ((row * 17 + k * 7) % 11) * 0.035);
          for (const side of [-1, 1])
            Q(
              o,
              'stone',
              [
                at(x, gy(x) + low, side * (th / 2 + 0.008)),
                at(z, gy(z) + low, side * (th / 2 + 0.008)),
                at(z, gy(z) + high, side * (th / 2 + 0.008)),
                at(x, gy(x) + high, side * (th / 2 + 0.008)),
              ],
              n.map((v) => v * side),
              c,
            );
        }
      }
    }
    if (gabion && d > 0) {
      for (let u = l; u <= r; u += d === 1 ? 4 : 2) {
        const y = gy(u);
        const F = (x, h) => at(x, y + h, th / 2 + 0.018);
        Q(
          o,
          'metal',
          [F(u - 0.018, lo), F(u + 0.018, lo), F(u + 0.018, H), F(u - 0.018, H)],
          n,
          rgb('595f58'),
        );
      }
      for (let h = Math.max(0.03, lo); h < H; h += d === 1 ? 1.5 : 0.75) {
        const N = Math.ceil((r - l) / 8);
        for (let i = 0; i < N; i++) {
          const x = l + ((r - l) * i) / N,
            z = l + ((r - l) * (i + 1)) / N;
          Q(
            o,
            'metal',
            [
              at(x, gy(x) + h, th / 2 + 0.022),
              at(z, gy(z) + h, th / 2 + 0.022),
              at(z, gy(z) + h + 0.025, th / 2 + 0.022),
              at(x, gy(x) + h + 0.025, th / 2 + 0.022),
            ],
            n,
            rgb('595f58'),
          );
        }
      }
    }
  }
  if (portal && d > 0) {
    const [l, r, h] = portal;
    for (const u of [l - 0.06, r + 0.06]) {
      const y = gy(u);
      const F = (x, h) => at(x, y + h, th / 2 + 0.035);
      Q(
        o,
        'wood',
        [F(u - 0.065, 0), F(u + 0.065, 0), F(u + 0.065, h + 0.14), F(u - 0.065, h + 0.14)],
        n,
      );
    }
    const F = (u, y) => at(u, gy(u) + y, th / 2 + 0.045);
    Q(
      o,
      'wood',
      [F(l - 0.16, h - 0.02), F(r + 0.16, h - 0.02), F(r + 0.16, h + 0.16), F(l - 0.16, h + 0.16)],
      n,
    );
  }
}
function yards(o, d) {
  const y = A.yards,
    a = y[0].outline[0],
    b = y[1].outline[0],
    c = y[2].outline[0],
    e = y[2].outline[1],
    af = y[0].outline.at(-1),
    bf = y[0].outline[2],
    cf = y[2].outline.at(-1),
    ef = y[2].outline[2];
  for (const [P, R] of [
    [a, b],
    [b, c],
    [c, e],
    [a, af],
    [c, cf],
    [e, ef],
  ])
    wall(o, P, R, A.wallHeight, d);
  wall(o, b, bf, A.wallHeight, d, { portal: [33, 34.6, 2.45] });
  wall(o, af, bf, A.frontGabionHeight, d, { gabion: true, portal: [15.7, 18.5, 2.55] });
  wall(o, bf, [-7.65, 30.41], A.frontGabionHeight, d, { gabion: true });
  wall(o, [1.3, 30.39], cf, A.frontGabionHeight, d, { gabion: true, portal: [11.1, 12.7, 2.45] });
  wall(o, cf, [40.67, 30.6], A.frontGabionHeight, d, { gabion: true });
  if (d > 0) {
    for (const [x, z, w, l] of [
      [-44, -14, 8, 13],
      [-27, 5, 7, 11],
      [38, -13, 7, 15],
    ]) {
      for (const [a, b] of [
        [
          [x - w / 2, z - l / 2],
          [x + w / 2, z - l / 2],
        ],
        [
          [x + w / 2, z - l / 2],
          [x + w / 2, z + l / 2],
        ],
        [
          [x + w / 2, z + l / 2],
          [x - w / 2, z + l / 2],
        ],
        [
          [x - w / 2, z + l / 2],
          [x - w / 2, z - l / 2],
        ],
      ])
        wall(o, a, b, 0.28, Math.min(d, 1));
    }
    for (const [x, z, w, h] of [
      [-57.43, -12, 5, 1.8],
      [-57.43, 12, 3.8, 1.3],
      [-14.5, -17, 4.5, 2.3],
      [28.02, -10, 3.3, 1.4],
    ]) {
      const xwall = x < -40,
        normal = xwall ? [1, 0, 0] : [-1, 0, 0],
        y = cascadesFemaleFactoryGround(x, z) + 0.8,
        X = x + normal[0] * 0.34;
      Q(
        o,
        'plaster',
        [
          [X, y, z - w / 2],
          [X, y, z + w / 2],
          [X, y + h, z + w / 2 - 0.25],
          [X, y + h - 0.12, z - w / 2 + 0.1],
        ],
        normal,
        tint(C.plaster, 0.96),
      );
    }
  }
}
function roof(o, x0, x1, z0, z1, eave, ridge, d) {
  const a = [x0, eave, z0],
    b = [x1, eave, z0],
    c = [x1, eave, z1],
    e = [x0, eave, z1],
    m = (x0 + x1) / 2,
    hip = Math.min((x1 - x0) / 2, (z1 - z0) / 3),
    r0 = [m, ridge, z0 + hip],
    r1 = [m, ridge, z1 - hip];
  T(o, 'metal', [a, b, r0], [0, 1, -1]);
  Q(o, 'metal', [b, c, r1, r0], [1, 1, 0]);
  T(o, 'metal', [c, e, r1], [0, 1, 1]);
  Q(o, 'metal', [e, a, r0, r1], [-1, 1, 0]);
  if (d >= 2) {
    for (const z of [z0, z1]) box(o, 'metal', m, eave - 0.08, z, x1 - x0 + 0.13, 0.13, 0.1);
    box(o, 'metal', m, ridge, z0 + hip, 0.12, 0.1, z1 - z0 - 2 * hip);
  }
}
function cottage(o, d) {
  const B = A.cottage,
    f = B.floorY,
    z0 = 19.22,
    z1 = 30.5,
    x0 = 42.3,
    xm = 49.9,
    x1 = 57.45,
    H = A.cottageWallHeight;
  // The native notched eastern end is retained; veranda and solid rooms occupy its bounded sections.
  const floor = (x, z, w, l) => {
    const low = cascadesFemaleFactoryGround(x, z) - 0.25;
    box(o, 'base', x, low, z, w, Math.max(0.15, f - low), l);
  };
  floor((x0 + x1) / 2, 24.85, x1 - x0, 11.3);
  box(o, 'plaster', (x0 + x1) / 2, f, 24.85, x1 - x0, H, 11.3);
  roof(o, x0 - 0.12, xm + 0.1, z0 - 0.1, z1 + 0.1, f + H, f + A.cottageRidgeHeight, d);
  roof(o, xm + 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.1, f + H, f + 4.95, d);
  const facade = (side, x, u, base, w, h, type = 'glass') => {
    const v = side === -1 ? -1 : 1,
      N = [v, 0, 0],
      at = (z, y, dep = 0) => [x + v * dep, f + y, z],
      cols = type === 'wood' ? C.wood : C.glass;
    Q(
      o,
      type,
      [
        at(u - w / 2, base, 0.025),
        at(u + w / 2, base, 0.025),
        at(u + w / 2, base + h, 0.025),
        at(u - w / 2, base + h, 0.025),
      ],
      N,
      cols,
    );
    if (d > 0) {
      for (const zz of [u - w / 2 - 0.04, u + w / 2 + 0.04])
        box(o, 'wood', x + v * 0.07, f + base - 0.03, zz, 0.12, h + 0.1, 0.08);
      box(o, 'wood', x + v * 0.07, f + base - 0.05, u, 0.14, 0.11, w + 0.2);
      box(o, 'wood', x + v * 0.07, f + base + h, u, 0.14, 0.11, w + 0.2);
      if (type === 'glass') {
        box(o, 'wood', x + v * 0.09, f + base + h * 0.48, u, 0.14, 0.065, w);
        box(o, 'wood', x + v * 0.09, f + base, u, 0.14, h, 0.045);
      }
    }
  };
  facade(-1, x0, 24.8, 0.05, 1.05, 2.28, 'wood');
  facade(-1, x0, 28, 1.1, 1.2, 1.35);
  facade(1, x1, 24.8, 0.05, 1.05, 2.28, 'wood');
  for (const z of [21, 28.2]) facade(1, x1, z, 1.05, 1.15, 1.4);
  // West and east skillion verandas remain genuinely open under their roofs.
  for (const side of [-1, 1]) {
    const a = side < 0 ? 40.64 : 57.45,
      b = side < 0 ? 42.3 : 59.34,
      low = side < 0 ? 2.5 : 2.55,
      hi = 2.92;
    Q(
      o,
      'metal',
      [
        [a, f + (side < 0 ? low : hi), z0],
        [b, f + (side < 0 ? hi : low), z0],
        [b, f + (side < 0 ? hi : low), side > 0 ? 24.05 : z1],
        [a, f + (side < 0 ? low : hi), side > 0 ? 24.05 : z1],
      ],
      [0, 1, 0],
    );
    if (side > 0) {
      T(
        o,
        'metal',
        [
          [57.45, f + 2.92, 24.05],
          [59.34, f + 2.55, 24.05],
          [57.45, f + 2.55, 26.3],
        ],
        [0, 1, 0],
      );
    }
    const postx = side < 0 ? a + 0.1 : b - 0.12,
      Z = side < 0 ? [19.5, 22, 24.8, 27.5, 30.2] : [19.4, 21.7, 23.8];
    for (const z of Z) box(o, 'wood', postx, f, z, 0.15, low, 0.15);
    if (d > 0) {
      const end = side < 0 ? z1 : 24.05;
      box(o, 'wood', postx, f + 0.8, (z0 + end) / 2, 0.11, 0.12, end - z0);
      if (side > 0) box(o, 'wood', postx, f + 0.1, (z0 + end) / 2, 0.1, 0.62, end - z0);
      else
        for (let z = z0 + 0.15; z < end; z += d === 1 ? 0.65 : 0.24)
          box(o, 'wood', postx, f + 0.15, z, 0.06, 0.62, 0.045);
    }
  }
  // Cottage north bay, bathroom infill and two stacks are intrinsic, not nearby houses.
  box(o, 'plaster', 45.9, f, 18.87, 2.2, 2.5, 0.8);
  Q(
    o,
    'glass',
    [
      [45.15, f + 1, 18.455],
      [46.65, f + 1, 18.455],
      [46.65, f + 2.15, 18.455],
      [45.15, f + 2.15, 18.455],
    ],
    [0, 0, -1],
  );
  Q(
    o,
    'metal',
    [
      [44.75, f + 2.52, 19.27],
      [47.05, f + 2.52, 19.27],
      [47.05, f + 2.25, 18.45],
      [44.75, f + 2.25, 18.45],
    ],
    [0, 1, -1],
  );
  box(o, 'wood', 41.35, f, 20.25, 1.4, 2.45, 2);
  if (d > 0)
    Q(
      o,
      'glass',
      [
        [40.64, f + 1.2, 19.94],
        [40.64, f + 1.2, 20.56],
        [40.64, f + 1.8, 20.56],
        [40.64, f + 1.8, 19.94],
      ],
      [-1, 0, 0],
    );
  for (const x of [46.2, 53.25]) {
    box(o, 'plaster', x, f + 4, 25.1, 0.65, 2.15, 0.72);
    box(o, 'stone', x, f + 6.15, 25.1, 0.85, 0.16, 0.92);
  }
  // South boundary arch: actual aperture with a recessed protective screen, not a painted arch.
  const ax = 41.45,
    az = 30.56,
    gy = f - 0.1,
    R = 0.58,
    spring = 1.85,
    N = [0, 0, 1];
  for (const [x, w] of [
    [40.52, 0.43],
    [42.22, 0.39],
  ])
    box(o, 'stone', x, gy, az, w, 2.9, 0.55);
  const count = [4, 6, 12, 20][d];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * i) / count,
      b = (Math.PI * (i + 1)) / count,
      P = (r, t) => [ax + r * Math.cos(t), gy + spring + r * Math.sin(t), az + 0.29];
    Q(o, 'stone', [P(R, a), P(R + 0.26, a), P(R + 0.26, b), P(R, b)], N);
  }
  Q(
    o,
    'glass',
    [
      [ax - R, gy, az - 0.04],
      [ax + R, gy, az - 0.04],
      [ax + R, gy + 2.3, az - 0.04],
      [ax - R, gy + 2.3, az - 0.04],
    ],
    N,
    tint(C.glass, 1.1),
  );
}
function centre(o, d) {
  const B = A.centre,
    x0 = B.x0,
    x1 = B.x1,
    z0 = B.z0,
    z1 = B.z1,
    f = B.floorY,
    H = A.centreHeight;
  // Horizontal footprint is native. Roof and side opening census are explicitly estimated.
  box(o, 'base', (x0 + x1) / 2, f - 0.25, (z0 + z1) / 2, x1 - x0, 0.25, z1 - z0);
  box(o, 'wood', (x0 + x1) / 2, f, (z0 + z1) / 2, x1 - x0 - 0.2, H - 0.12, z1 - z0 - 0.2);
  box(
    o,
    'metal',
    (x0 + x1) / 2,
    f + H - 0.12,
    (z0 + z1) / 2,
    x1 - x0 + 0.08,
    0.14,
    z1 - z0 + 0.08,
    rgb('68716b'),
  );
  for (const z of [z0, z1]) {
    Q(
      o,
      'glass',
      [
        [x0 + 0.45, f + 0.12, z + (z < 0 ? -0.02 : 0.02)],
        [x1 - 0.45, f + 0.12, z + (z < 0 ? -0.02 : 0.02)],
        [x1 - 0.45, f + H - 0.35, z + (z < 0 ? -0.02 : 0.02)],
        [x0 + 0.45, f + H - 0.35, z + (z < 0 ? -0.02 : 0.02)],
      ],
      [0, 0, z < 0 ? -1 : 1],
    );
    for (const x of [x0 + 0.4, x1 - 0.4]) box(o, 'metal', x, f, z, 0.12, H, 0.12);
  }
  for (const x of [x0 - 0.02, x1 + 0.02]) {
    const side = x < 0 ? -1 : 1,
      N = [side, 0, 0];
    for (const [z, w] of [
      [-18, 7],
      [1, 10],
      [19, 8],
    ])
      Q(
        o,
        'glass',
        [
          [x, f + 0.8, z - w / 2],
          [x, f + 0.8, z + w / 2],
          [x, f + H - 0.38, z + w / 2],
          [x, f + H - 0.38, z - w / 2],
        ],
        N,
      );
    if (d > 0) {
      for (let z = z0 + 0.5; z < z1; z += 4)
        box(o, 'metal', x + side * 0.035, f, z, 0.075, H, 0.085);
      for (let z = z0 + 3; z < z1; z += 9) {
        const low = cascadesFemaleFactoryGround(x, z) - 0.2;
        box(o, 'base', x - side * 0.65, low, z, 0.45, Math.max(0.15, f - 0.25 - low), 0.8);
      }
    }
  }
  // Modern gabion cheeks identify the centre without adopting copyrighted facade imagery.
  for (const x of [x0 + 0.28, x1 - 0.28]) {
    wall(o, [x, z1 - 9], [x, z1 - 1], H - 0.1, d, { gabion: true });
  }
}
function build(o, _f, d = 3) {
  yards(o, d);
  cottage(o, d);
  centre(o, d);
}
export const cascadesFemaleFactorySkyline = (o, f) => build(o, f, 0),
  cascadesFemaleFactoryDistrict = (o, f) => build(o, f, 1),
  cascadesFemaleFactoryStreet = (o, f) => build(o, f, 2),
  cascadesFemaleFactoryCloseup = (o, f) => build(o, f, 3);
export const cascadesFemaleFactoryModel = {
  id: 'cascades_female_factory',
  key: 'cascades_female_factory',
  cell: 'r2/r22',
  recipe: 'structure-cascades-female-factory.mjs',
  title: 'Cascades Female Factory',
  category: 'industrial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [108, 94, 116],
  lookAt: [0, 1, 0],
  mediumFiContext: { scale: 1.25 },
  qaCameras: [
    {
      name: 'whole-surviving-three-yards-cottage-and-linear-centre',
      position: [108, 94, 116],
      lookAt: [0, 1, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'weathered-stone-party-wall-real-gateway-and-low-foundations',
      position: [-31, 7, 13],
      lookAt: [-14.5, 2.3, 4],
    },
    {
      name: 'matrons-cottage-twin-hips-open-west-veranda-north-bay-and-stacks',
      position: [31, 11, 6],
      lookAt: [48, 1.8, 24],
    },
    {
      name: 'cottage-degraves-arched-doorway-and-protective-screen',
      position: [41.4, 4.6, 41],
      lookAt: [41.6, 1, 29.5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cascades-female-factory.mjs',
    level: 'skyline',
    export: 'cascadesFemaleFactorySkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'cascadesFemaleFactoryDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'cascadesFemaleFactoryStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'cascadesFemaleFactoryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole surviving conservation complex: three adjoining open yards, enclosure/party walls and pedestrian gateways, reconstructed gabion frontage, selected low archaeological foundation remnants, twin-hipped Matron cottage with open west/east verandas, bathroom infill/north bay, stabilized south arch/protective screen and chimneys; mapped post2022 linear interpretation centre. Historic roofed cell ranges are not restored, and demolished Yards2/5, surrounding houses/industrial sheds, sculptures, independent art and interiors are excluded.',
    'One exact published Prout1844 PD-Australia lithograph provides historical context only; one Barrylb2009 own/self-CC0 yard original controls rough buff/gray sandstone, old plaster patches, repairs, gateway and low ruins. Cottage and modern-centre sections/opening census/roof profile derive from primary textual description with explicit unseen-detail estimates. No claim of current all-side photographic coverage, survey precision, complete archaeology, exact wall reconstruction chronology or all contemporary interpretation fixtures. No questionable Beattie image, modern CC/gallery/architectural copyrighted photos, competition renders, textures, borrowed meshes or generated bitmaps used.',
    'Modern-centre footprint is native July2026 mapping, approximately60m by8.4m. Its low level roof, dark side walls, glazing census and gabion cheeks are bounded medium-fi estimates; no unbuilt competition amphitheatre or superseded ghost building is invented as current fabric. Primary construction descriptions establish precast supports, gabions and archaeology protection. Ground-derived wall stepping/foundation contacts remain approximate; original16641 elevations, heightfield and raw tile never flattened or fitted, replacement disabled.',
    'Four LODs retain all three open courtyards, full centre/cottage volumes, gateway voids, cottage paired hips/north bay/verandas and chimneys. Near views add individual weathered stone face variation, gabion basket wires, plaster scars, window divisions/veranda balusters and arch voussoirs. Six actual canonical surface slots, five shared graphs and local glazing.',
  ],
};

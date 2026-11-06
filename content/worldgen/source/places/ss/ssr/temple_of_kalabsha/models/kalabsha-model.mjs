/** Original current Kalabsha exterior;meters,+Y up,+X lake-facing pylon. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const kalabshaControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  a = kalabshaControls;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('c5b38e'),
    trim: lin('d1c29f'),
    old: lin('b6a17e'),
    paving: lin('bfb294'),
    dark: lin('5c574b'),
    metal: lin('62665f'),
  };
export const kalabshaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  old: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  floor: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
};
const configs = {
  skyline: { far: true, sides: 4, profiles: 2 },
  district: { sides: 6, profiles: 3, cornice: true },
  street: { sides: 10, profiles: 5, cornice: true, frames: true, broken: true, leaves: 4 },
  closeup: {
    sides: 20,
    profiles: 7,
    cornice: true,
    frames: true,
    broken: true,
    leaves: 8,
    detail: true,
  },
  master: {
    sides: 40,
    profiles: 10,
    cornice: true,
    frames: true,
    broken: true,
    leaves: 12,
    detail: true,
    fine: true,
  },
};
export function kalabshaGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(g.size[0] - 2, Math.floor(u))),
    j = Math.max(0, Math.min(g.size[1] - 2, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s);
function B(o, c, lo, hi, s = 'wall', color = C.wall) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
const rect = (x, z, w, d, y) => [
  [x - w / 2, y, z - d / 2],
  [x - w / 2, y, z + d / 2],
  [x + w / 2, y, z + d / 2],
  [x + w / 2, y, z - d / 2],
];
function L(o, c, rings, s = 'wall', color = C.wall, cap = true) {
  loft(o, S(c, s), rings, color, { cap });
}
const normalRaw = (a, b, c) => {
  const u = b.map((v, i) => v - a[i]),
    v = c.map((v, i) => v - a[i]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};
function Q(o, c, p, s = 'wall', color = C.wall) {
  const ar = (a, b, d) => Math.hypot(...normalRaw(a, b, d));
  if (ar(p[0], p[1], p[2]) < 1e-7 || ar(p[0], p[2], p[3]) < 1e-7) return;
  const n = normalFor(...p);
  o.addQuad(
    S(c, s),
    'metric:uv',
    p,
    n,
    [
      [0, 0],
      [Math.hypot(...p[1].map((v, i) => v - p[0][i])), 0],
      [
        Math.hypot(...p[1].map((v, i) => v - p[0][i])),
        Math.hypot(...p[3].map((v, i) => v - p[0][i])),
      ],
      [0, Math.hypot(...p[3].map((v, i) => v - p[0][i]))],
    ],
    color,
  );
}
function footing(o, c, x0, z0, x1, z1, top) {
  let low = -0.5;
  for (let x = x0; x <= x1; x += 2)
    for (let z = z0; z <= z1; z += 2) low = Math.min(low, kalabshaGroundY(x, z) - 0.4);
  for (const p of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ])
    low = Math.min(low, kalabshaGroundY(...p) - 0.4);
  B(o, c, [x0, low, z0], [x1, top, z1], 'floor', C.paving);
}
function corniceX(o, c, x, z0, z1, y, w = 1.2) {
  if (!c.cornice) return;
  const rings = [];
  for (let j = 0; j <= c.profiles; j++) {
    const t = j / c.profiles,
      spread = 0.45 * (1 - Math.cos((t * Math.PI) / 2));
    rings.push(rect(x, z0 + (z1 - z0) / 2, w + spread * 2, z1 - z0 + spread * 0.6, y + t * 0.75));
  }
  L(o, c, rings, 'wall', C.trim);
  B(
    o,
    c,
    [x - w / 2 - 0.5, y + 0.75, z0 - 0.2],
    [x + w / 2 + 0.5, y + 0.93, z1 + 0.2],
    'wall',
    C.trim,
  );
}
function portalX(o, c, x, thick, z0, z1, y0, y1, doorHalf, doorTop, s = 'wall') {
  B(o, c, [x - thick / 2, y0, z0], [x + thick / 2, y1, -doorHalf], s);
  B(o, c, [x - thick / 2, y0, doorHalf], [x + thick / 2, y1, z1], s);
  B(o, c, [x - thick / 2, doorTop, -doorHalf], [x + thick / 2, y1, doorHalf], s);
  if (c.frames) {
    for (const z of [-doorHalf - 0.3, doorHalf + 0.3])
      B(
        o,
        c,
        [x + thick / 2, y0, z - 0.22],
        [x + thick / 2 + 0.24, doorTop + 0.5, z + 0.22],
        'wall',
        C.trim,
      );
    B(
      o,
      c,
      [x + thick / 2, doorTop, -doorHalf - 0.7],
      [x + thick / 2 + 0.32, doorTop + 0.5, doorHalf + 0.7],
      'wall',
      C.trim,
    );
  }
}
function brokenWallX(o, c, x0, x1, z, y0, top, t = 0.9) {
  const step = c.broken ? 2.7 : x1 - x0,
    n = Math.ceil((x1 - x0) / step);
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n,
      X = x0 + ((x1 - x0) * (i + 1)) / n,
      h = top + (c.broken ? [0.1, -0.45, 0, 0.38, -0.2, 0.05][i % 6] : 0);
    B(o, c, [x, y0, z - t / 2], [X, h, z + t / 2], 'old', C.old);
    if (c.detail && i % 3 === 0)
      B(
        o,
        c,
        [x + 0.18, h - 0.04, z - t / 2 + 0.06],
        [Math.min(X, x + 1.5), h + 0.36, z + t / 2 - 0.09],
        'old',
        C.wall,
      );
  }
}
function leaf(o, c, x, z, y, r, angle, scale) {
  const pts = [];
  for (let j = 0; j <= c.profiles; j++) {
    const t = j / c.profiles,
      rr = r + 0.25 * Math.sin((t * Math.PI) / 2),
      yy = y + t * scale,
      half = 0.11 * Math.sin(Math.max(0.02, t) * Math.PI) * Math.PI;
    pts.push(
      [rr * Math.cos(angle - half) + x, yy, rr * Math.sin(angle - half) + z],
      [rr * Math.cos(angle + half) + x, yy, rr * Math.sin(angle + half) + z],
    );
  }
  for (let j = 1; j < pts.length / 2; j++)
    Q(o, c, [pts[2 * j - 2], pts[2 * j - 1], pts[2 * j + 1], pts[2 * j]], 'old', C.trim);
}
function column(o, c, x, z, h = 9.8, variant = 0, base = 0.25) {
  const r = 0.72,
    profile = c.far
      ? [
          [base, r * 1.15],
          [h, r * 1.3],
        ]
      : c.sides === 6
        ? [
            [base, r * 1.3],
            [base + 0.4, r],
            [h - 1.6, r],
            [h - 0.5, r * 1.65],
            [h, r * 1.25],
          ]
        : [
            [base, r * 1.3],
            [base + 0.32, r * 1.3],
            [base + 0.43, r],
            [h - 2.5, r * 0.9],
            [h - 2.35, r * 0.95],
            [h - 1.6, r],
            [h - 0.72, r * 1.6],
            [h - 0.48, r * 1.65],
            [h - 0.32, r * 1.25],
            [h, r * 1.25],
          ];
  L(
    o,
    c,
    profile.map(([y, R]) => radialRing(y, R, R, c.sides, [x, z])),
    'wall',
    C.wall,
  );
  if (!c.far) B(o, c, [x - 1, h, z - 1], [x + 1, h + 0.35, z + 1], 'old', C.trim);
  if (c.leaves)
    for (let i = 0; i < c.leaves; i++) {
      const angle = (2 * Math.PI * i) / c.leaves;
      leaf(o, c, x, z, h - 1.65, r + 0.02, angle, variant % 2 ? 1.03 : 0.8);
      if (c.detail) leaf(o, c, x, z, h - 2.15, r * 0.94, angle + Math.PI / c.leaves, 0.65);
    }
  if (c.fine)
    for (const y of [base + 0.5, h - 3.8, h - 3.65])
      L(
        o,
        c,
        [
          radialRing(y, r * 0.98, r * 0.98, c.sides, [x, z]),
          radialRing(y + 0.055, r * 0.98, r * 0.98, c.sides, [x, z]),
        ],
        'old',
        C.trim,
      );
}
function pylon(o, c) {
  for (const sign of [-1, 1]) {
    const z = sign * 9.65,
      L0 = sign < 0 ? -16.7 : 2.7,
      U0 = sign < 0 ? -2.7 : 16.7;
    L(
      o,
      c,
      [rect(34.5, z, 6.9, U0 - L0, 0.1), rect(34.1, z, 4.5, U0 - L0 - 2.2, 14.4)],
      'wall',
      C.wall,
    );
    if (c.broken) {
      for (let i = 0; i < 6; i++) {
        const zz = L0 + 1.2 + ((U0 - L0 - 2.4) * i) / 6,
          h = [0.65, 0.05, 0.35, -0.1, 0.45, 0.8][(i + (sign > 0 ? 2 : 0)) % 6];
        B(o, c, [32, 14.3, zz], [36.1, 14.45 + h, zz + (U0 - L0 - 2.4) / 6 - 0.025], 'old', C.old);
      }
    }
    if (c.frames) {
      for (const zz of [L0 + 0.35, U0 - 0.35])
        beam(
          o,
          S(c, 'wall'),
          [37.98, 0.2, zz],
          [36.18, 14.25, zz - sign * 0.45],
          0.19,
          0.19,
          C.trim,
        );
      for (const zz of [sign * 6, sign * 12]) {
        const y0 = 1.6,
          yt = 8.6;
        Q(
          o,
          c,
          [
            [37.96 - y0 * 0.08, y0, zz - 0.13],
            [37.96 - y0 * 0.08, y0, zz + 0.13],
            [37.96 - yt * 0.08, yt, zz + 0.13],
            [37.96 - yt * 0.08, yt, zz - 0.13],
          ],
          'old',
          C.dark,
        );
      }
    }
  }
  portalX(o, c, 34.6, 5.6, -3.6, 3.6, 0.2, 10.6, 1.55, 6.9);
  corniceX(o, c, 34.6, -3.8, 3.8, 10.6, 5.5);
}
function wingedDisc(o, c, x, y) {
  if (!c.frames) return;
  L(
    o,
    c,
    [
      radialRing(x - 0.06, 0.47, 0.47, c.sides, [y, 0]),
      radialRing(x + 0.06, 0.47, 0.47, c.sides, [y, 0]),
    ].map((r) => r.map(([u, v, w]) => [v, u, w])),
    'old',
    C.old,
  );
  for (const s of [-1, 1])
    Q(
      o,
      c,
      [
        [x, y + 0.2, s * 0.5],
        [x, y + 0.35, s * 2.7],
        [x, y - 0.15, s * 2.3],
        [x, y - 0.23, s * 0.6],
      ],
      'old',
      C.old,
    );
}
function rear(o, c) {
  const floor = 0.42,
    roof = 10.5;
  for (const z of [-10.8, 10.8]) brokenWallX(o, c, -37, -8, z, floor, roof, 1.4);
  B(o, c, [-37, floor, -11.5], [-35.7, roof, 11.5], 'wall');
  for (const x of [-23, -15, -8]) portalX(o, c, x, 1.35, -10.8, 10.8, floor, roof, 1.45, 5.7);
  for (const z of [-5.3, 5.3]) B(o, c, [-35.7, floor, z - 0.5], [-8, roof, z + 0.5]);
  for (const [x0, x1, y] of [
    [-37, -23, 10.7],
    [-23, -15, 10.4],
    [-15, -8, 10.9],
  ]) {
    B(o, c, [x0, y - 0.5, -11.6], [x1, y, 11.6], 'old', C.old);
    if (c.cornice)
      for (const z of [-11.8, 11.8])
        B(o, c, [x0, y - 0.18, z - 0.23], [x1, y + 0.12, z + 0.23], 'wall', C.trim);
    if (c.detail)
      for (let x = x0 + 0.6; x < x1; x += 2.6)
        B(o, c, [x, y, -11.55], [Math.min(x1, x + 2.5), y + 0.045, 11.55], 'old', C.wall);
  }
}
function hall(o, c) {
  for (const z of [-12.6, 12.6]) brokenWallX(o, c, -8, 8.2, z, 0.3, 12.15, 1.25);
  for (const x of [-4.9, 1.5, 8])
    for (const [z, i] of [
      [-9.4, 0],
      [-3.7, 1],
      [3.7, 2],
      [9.4, 3],
    ])
      column(o, c, x, z, 11.5, i, 0.42); // surviving column hall has no roof cap
  for (const [x0, x1] of [
    [-12.5, -1.8],
    [1.8, 12.5],
  ])
    B(o, c, [7.2, 0.4, x0], [8.8, 5.5, x1], 'wall');
  portalX(o, c, 8, 1.6, -2.5, 2.5, 0.4, 7.4, 1.5, 5.6);
  B(o, c, [7.2, 11.85, -12.9], [8.8, 12.4, 12.9], 'wall', C.trim);
  corniceX(o, c, 8, -13, 13, 12.4, 1.6);
  if (c.frames) {
    for (const [z0, z1] of [
      [-12.1, -10.5],
      [-8.2, -4.9],
      [4.9, 8.2],
      [10.5, 12.1],
    ]) {
      for (const z of [z0, z1]) B(o, c, [8.8, 0.9, z - 0.12], [8.96, 4.9, z + 0.12], 'old', C.trim);
      for (const y of [0.9, 4.9]) B(o, c, [8.8, y, z0], [8.96, y + 0.13, z1], 'old', C.trim);
    }
    corniceX(o, c, 8, -12.4, -1.8, 5.5, 1.7);
    corniceX(o, c, 8, 1.8, 12.4, 5.5, 1.7);
  }
}
function court(o, c) {
  for (const z of [-11.1, 11.1])
    for (let i = 0; i < 4; i++) column(o, c, 12.2 + i * 5.2, z, 9.2, i, 0.25);
  for (const z of [-5.6, 5.6]) column(o, c, 29.5, z, 9.2, 1, 0.25);
  if (!c.far) {
    for (const z of [-11.1, 11.1]) {
      B(o, c, [11.4, 9.55, z - 0.75], [17.8, 10.05, z + 0.75], 'old', C.old);
      B(o, c, [22, 9.55, z - 0.75], [28.5, 10.05, z + 0.75], 'old', C.old);
    }
    for (const z of [-8.1, 8.1])
      B(o, c, [28.8, 9.55, z - 3.3], [30.2, 10.05, z + 3.3], 'old', C.old);
  }
}
function enclosure(o, c) {
  brokenWallX(o, c, -38, 32, -16.2, 0, 7.8, 1.25);
  brokenWallX(o, c, -38, 17.8, 16.2, 0, 7.8, 1.25);
  brokenWallX(o, c, 20.2, 32, 16.2, 0, 7.8, 1.25);
  B(o, c, [17.8, 5, 15.575], [20.2, 7.5, 16.825], 'old', C.old);
  B(o, c, [-38.2, 0, -16.8], [-37, 7.4, 16.8], 'old', C.old);
  if (c.frames)
    for (const x of [17.5, 20.25]) B(o, c, [x, 0.2, 16.825], [x + 0.25, 5.4, 17], 'wall', C.trim);
}
function approach(o, c) {
  const y = 0.2;
  for (let i = 0; i < 8; i++) {
    const x0 = 38 + i * 1.25,
      x1 = x0 + 1.25,
      h = y - i * 0.1;
    footing(o, c, x0, -3.5, x1, 3.5, h);
  }
  const x0 = 48,
    x1 = 62,
    z0 = -3.5,
    z1 = 3.5,
    h0 = -0.6,
    h1 = kalabshaGroundY(x1, 0) + 0.15;
  Q(
    o,
    c,
    [
      [x0, h0, z0],
      [x0, h0, z1],
      [x1, h1, z1],
      [x1, h1, z0],
    ],
    'floor',
    C.paving,
  );
  for (const s of [-1, 1]) {
    const z = s * 4.1;
    for (let i = 0; i < 6; i++) {
      const x = 38 + i * 4,
        h = i < 2 ? 0.45 : Math.max(-0.3, kalabshaGroundY(x, z) + 0.6);
      B(o, c, [x, kalabshaGroundY(x, z) - 0.35, z - 0.4], [x + 3.95, h, z + 0.4], 'old', C.old);
    }
  }
  if (c.frames) {
    for (const z of [-1.72, 1.72]) {
      B(o, c, [37.5, 0.25, z - 0.035], [37.65, 6.6, z + 0.035], 'metal', C.metal);
      if (c.detail)
        for (let y = 1; y < 6.5; y += 0.5)
          B(o, c, [37.5, y, z - 0.16], [37.65, y + 0.045, z + 0.16], 'metal', C.metal);
    }
  }
}
export function buildKalabshaLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Kalabsha level ' + level); // foundation is structural,not a terrain replacement
  footing(o, c, -38.3, -17.2, 38, 17.2, 0.25);
  pylon(o, c);
  enclosure(o, c);
  rear(o, c);
  hall(o, c);
  court(o, c);
  approach(o, c);
  wingedDisc(o, c, 37.44, 10.75);
}
export const buildKalabshaSkyline = (o) => buildKalabshaLevel(o, 'skyline');
export const buildKalabshaDistrict = (o) => buildKalabshaLevel(o, 'district');
export const buildKalabshaStreet = (o) => buildKalabshaLevel(o, 'street');
export const buildKalabshaCloseup = (o) => buildKalabshaLevel(o, 'closeup');

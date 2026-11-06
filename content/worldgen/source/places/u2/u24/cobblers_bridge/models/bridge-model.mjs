import {
  beam,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Exterior dimensions follow the retained crossing outline. Heights and carved details
// are photo-guided approximations; the 273 m candidate fact is not this bridge's span.
export const bridgeControls = {
  anchor: [14.505591719, 46.048426686],
  heading: 0.195241119183,
  datum: 279,
  deck: 284.6,
  length: 23.591,
  width: 12.5,
  lampProjection: 7.627,
  landingEnds: [-17.25, 15.35],
  columnStations: [-11.35, -6.81, -2.27, 2.27, 6.81, 11.35],
  centralPier: { x: 0.263, width: 1.22, ends: [-7.627, 7.627], bottom: -9 },
};
const palette = {
  stone: { slot: 'wall', graph: 'concrete_plain', rgb: [0.64, 0.625, 0.57] },
  trim: { slot: 'trim', graph: 'concrete_plain', rgb: [0.76, 0.74, 0.68] },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', rgb: [0.48, 0.47, 0.43] },
  deck: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.32, 0.315, 0.3] },
  metal: { slot: 'trim', graph: 'metal_painted', rgb: [0.2, 0.21, 0.2] },
  lamp: { slot: 'window', graph: 'concrete_plain', rgb: [0.93, 0.92, 0.83] },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...v }]) => [k, v]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const offset = bridgeControls.deck - bridgeControls.datum;
const p = (x, y, z) => [x, y + offset, z];
const rod = (o, m, a, b, w, d) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, p(x, y - h / 2, z), p(x, y + h / 2, z), d, w);
function face(o, m, points, direction) {
  let n = normalFor(...points);
  if (n.reduce((v, x, i) => v + x * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  o[points.length === 3 ? 'addTriangle' : 'addQuad'](
    m,
    'palette:#ffffff',
    points,
    n,
    undefined,
    palette[m].rgb,
  );
}
function turned(o, m, x, z, rows, n) {
  const rings = rows.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const t = (-i / n) * Math.PI * 2;
      return p(x + Math.cos(t) * r, y, z + Math.sin(t) * r);
    }),
  );
  loft(o, m, rings, palette[m].rgb);
}
function deck(o, t) {
  const { length: L, width: W } = bridgeControls;
  box(o, 'stone', 0, -0.46, 0, L, 0.8, W);
  box(o, 'deck', 0, -0.035, 0, L - 0.12, 0.05, W - 1.0);
  box(o, 'stone', 0.263, -0.44, 0, 1.22, 0.84, 15.254);
  for (const z of [-W / 2, W / 2]) {
    box(o, 'trim', 0, -0.22, z, L + 0.16, 0.18, 0.46);
    box(o, 'trim', 0, -0.77, z, L + 0.12, 0.19, 0.4);
    if (t > 0) {
      box(o, 'base', 0, -0.48, z, L, 0.22, 0.13);
      const n = [0, 12, 50, 44, 50][t];
      for (let i = 0; i < n; i++)
        box(
          o,
          'trim',
          -L / 2 + ((i + 0.5) * L) / n,
          -0.51,
          z + 0.09 * Math.sign(z),
          (L / n) * 0.64,
          0.28,
          0.24,
        );
    }
  }
  // Short end bearings; the river embankments remain native context.
  if (t > 0)
    for (const x of [-L / 2 + 0.31, L / 2 - 0.31]) box(o, 'base', x, -3.2, 0, 0.64, 4.8, W);
  // Photo-guided landing aprons reach the native quay paths without changing
  // the mapped 23.591 m river span or its six pairs of column positions.
  for (const [a, b] of [
    [bridgeControls.landingEnds[0], -L / 2],
    [L / 2, bridgeControls.landingEnds[1]],
  ]) {
    const x = (a + b) / 2,
      length = b - a + 0.08;
    if (t === 0) {
      box(o, 'stone', x, -4.505, 0, length, 8.99, W);
      continue;
    }
    box(o, 'base', x, -4.93, 0, length, 8.14, W);
    box(o, 'stone', x, -0.46, 0, length, 0.8, W);
    box(o, 'deck', x, -0.035, 0, length, 0.05, W - 0.12);
  }
}
function centralPier(o, t) {
  const x = 0.263,
    w = 1.22,
    ends = [-7.627, 7.627],
    top = -0.86,
    bottom = -9;
  box(o, 'base', x, -7.05, 0, w + 1.0, 3.9, 15.254);
  // Two real openings in the long pier wall. The underside is not a solid block.
  const bays = [
      [-5.85, -1.05],
      [1.05, 5.85],
    ],
    spring = -4.7,
    rise = 2.8;
  const n = [5, 8, 12, 16, 22][t];
  for (const [a, b] of bays)
    for (let i = 0; i < n; i++) {
      const z = a + ((b - a) * i) / n,
        Z = a + ((b - a) * (i + 1)) / n;
      const arch = (t) => spring + rise * Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
      const y = arch(i / n),
        Y = arch((i + 1) / n);
      for (const side of [-1, 1]) {
        const X = x + (side * w) / 2;
        face(o, 'stone', [p(X, y, z), p(X, Y, Z), p(X, top, Z), p(X, top, z)], [side, 0, 0]);
      }
      face(
        o,
        'stone',
        [p(x - w / 2, y, z), p(x + w / 2, y, z), p(x + w / 2, Y, Z), p(x - w / 2, Y, Z)],
        [0, -1, 0],
      );
    }
  for (const [a, b] of [
    [ends[0], bays[0][0]],
    [bays[0][1], bays[1][0]],
    [bays[1][1], ends[1]],
  ]) {
    box(o, 'stone', x, (top - 5.1) / 2, (a + b) / 2, w, top + 5.1, b - a);
  }
  for (const side of [-1, 1]) {
    const z = side * 7.3;
    box(o, 'base', x, -6.5, z, 1.65, 4.6, 0.75);
    box(o, 'stone', x, -3.25, z, 1.05, 3.5, 0.74);
    box(o, 'trim', x, -1.49, z, 1.7, 0.24, 1.2);
    const low = [
      p(x - 0.5, -1.38, z - 0.38),
      p(x + 0.5, -1.38, z - 0.38),
      p(x + 0.5, -1.38, z + 0.38),
      p(x - 0.5, -1.38, z + 0.38),
    ];
    const high = [
      p(x - 0.91, -0.7, z - 0.6),
      p(x + 0.91, -0.7, z - 0.6),
      p(x + 0.91, -0.7, z + 0.6),
      p(x - 0.91, -0.7, z + 0.6),
    ];
    loft(o, 'stone', [low.toReversed(), high.toReversed()], palette.stone.rgb);
  }
}
function tallColumn(o, t, x, z, index) {
  const top = 5.78 + [0.15, 0, -0.08, -0.08, 0, 0.15][index];
  box(o, 'stone', x, 0.54, z, 0.73, 1.08, 0.78);
  if (t === 0) {
    turned(
      o,
      'stone',
      x,
      z,
      [
        [1.08, 0.24],
        [top, 0.24],
      ],
      4,
    );
    box(o, 'trim', x, top + 0.22, z, 0.78, 0.44, 0.78);
    sphere(o, 'trim', p(x, top + 0.65, z), [0.29, 0.29, 0.29], palette.trim.rgb, 4, 2);
    return;
  }
  box(o, 'trim', x, 1.1, z, 0.85, 0.13, 0.86);
  turned(
    o,
    'stone',
    x,
    z,
    [
      [1.16, 0.29],
      [1.25, 0.24],
      [top - 0.1, 0.235],
      [top, 0.29],
    ],
    [6, 6, 10, 14, 20][t],
  );
  turned(
    o,
    'trim',
    x,
    z,
    [
      [top, 0.3],
      [top + 0.13, 0.32],
      [top + 0.47, 0.48],
      [top + 0.59, 0.53],
    ],
    [6, 6, 10, 14, 20][t],
  );
  box(o, 'trim', x, top + 0.64, z, 1.06, 0.12, 1.06);
  sphere(
    o,
    'stone',
    p(x, top + 1.02, z),
    [0.32, 0.32, 0.32],
    palette.stone.rgb,
    [4, 6, 10, 16, 24][t],
    [2, 3, 5, 8, 12][t],
  );
  // Stylized leaves on the capital carry its distinctive silhouette at close range.
  if (t > 1)
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2,
        tip = p(x + Math.cos(a) * 0.5, top + 0.51, z + Math.sin(a) * 0.5);
      const low = p(x + Math.cos(a) * 0.315, top + 0.12, z + Math.sin(a) * 0.315);
      const mid = p(x + Math.cos(a) * 0.41, top + 0.34, z + Math.sin(a) * 0.41),
        v = [-Math.sin(a) * 0.11, 0, Math.cos(a) * 0.11];
      face(
        o,
        'trim',
        [low, mid.map((n, i) => n + v[i]), tip, mid.map((n, i) => n - v[i])],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
}
function balustrades(o, t) {
  const stations = bridgeControls.columnStations;
  for (const z of [-6.0, 6.0]) {
    box(o, 'trim', 0, 0.17, z, 23.52, 0.22, 0.7);
    box(o, 'trim', 0, 1.18, z, 23.59, 0.19, 0.66);
    for (let j = 0; j < stations.length; j++) tallColumn(o, t, stations[j], z, j);
    if (t === 0) continue;
    const count = [0, 3, 9, 8, 9][t],
      segments = [4, 4, 6, 8, 10][t];
    for (let j = 1; j < stations.length; j++)
      for (let i = 1; i <= count; i++) {
        const x = stations[j - 1] + ((stations[j] - stations[j - 1]) * i) / (count + 1);
        const profile =
          t === 1
            ? [
                [0.28, 0.13],
                [0.42, 0.095],
                [0.92, 0.095],
                [1.08, 0.14],
              ]
            : [
                [0.28, 0.155],
                [0.35, 0.155],
                [0.42, 0.09],
                [0.72, 0.085],
                [0.89, 0.11],
                [0.99, 0.175],
                [1.08, 0.175],
              ];
        turned(o, 'stone', x, z, profile, segments);
      }
  }
}
function lampColumn(o, t, side) {
  const x = 0.263,
    z = side * 7.2;
  if (t > 0) box(o, 'trim', x, 0.16, z, 1.12, 0.3, 1.1);
  turned(
    o,
    'stone',
    x,
    z,
    [
      [0.31, 0.31],
      [0.49, 0.25],
      [4.65, 0.25],
      [4.85, 0.4],
    ],
    [4, 6, 10, 14, 18][t],
  );
  box(o, 'trim', x, 4.94, z, 0.98, 0.17, 0.98);
  if (t === 0) {
    box(o, 'lamp', x, 5.36, z, 0.89, 0.66, 0.42);
    return;
  }
  for (const dx of [-0.43, 0, 0.43]) {
    rod(o, 'metal', p(x + dx, 4.98, z), p(x + dx, 5.24 + (dx === 0 ? 0.18 : 0), z), 0.07, 0.07);
    const base = 5.2 + (dx === 0 ? 0.18 : 0);
    turned(
      o,
      'lamp',
      x + dx,
      z,
      [
        [base, 0.1],
        [base + 0.06, 0.16],
        [base + 0.35, 0.13],
        [base + 0.55, 0.025],
      ],
      [4, 6, 8, 12, 16][t],
    );
  }
}
export function buildBridgeLevel(o, level) {
  const t = tiers[level];
  if (t === undefined) throw Error('Unknown bridge tier ' + level);
  deck(o, t);
  centralPier(o, t);
  balustrades(o, t);
  lampColumn(o, t, -1);
  lampColumn(o, t, 1);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

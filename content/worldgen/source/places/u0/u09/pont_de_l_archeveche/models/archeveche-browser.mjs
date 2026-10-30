/** Authored distance models. The original detailed source master is preserved separately. */
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const archevecheBrowserSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  paving: { slot: 'roof', graph: 'stone_granite', roughness: 0.9 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.17,
    baseColorFactor: [1, 1, 1, 0.32],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
};
export const archevecheBrowserControls = {
  arches: [
    { c: -10.2, rx: 7.5, rise: 2 },
    { c: 8.15, rx: 8.55, rise: 2.4 },
    { c: 26.5, rx: 7.5, rise: 2 },
  ],
  piers: [-1.55, 17.85],
  spring: 4.4,
  west: -34.3,
  east: 34.25,
};
export const archevecheBrowserDeck = (x) => 7.55 + 0.26 * Math.exp(-(((x - 8) / 23) ** 2));
export const archevecheBrowserLimits = (x) => {
  const t = Math.max(0, Math.min(1, (-17.7 - x) / 16.6));
  return [-5.42 - t * 10.56, 5.62 + t * 11.09];
};
export function archevecheBrowserArch(a, x) {
  const r = (a.rx * a.rx + a.rise * a.rise) / (2 * a.rise);
  return 4.4 + a.rise - r + Math.sqrt(Math.max(0, r * r - (x - a.c) ** 2));
}
const C = archevecheBrowserControls,
  deck = archevecheBrowserDeck,
  limits = archevecheBrowserLimits;
const colors = {
  stone: [0.56, 0.505, 0.39],
  iron: [0.035, 0.043, 0.042],
  road: [0.205, 0.186, 0.176],
  walk: [0.28, 0.26, 0.22],
  glass: [0.82, 0.9, 0.9],
  mark: [0.65, 0.64, 0.57],
};
const levels = {
  skyline: { arch: 6, deck: 4, pier: 8, rails: 0, lamps: 0, ring: 0, stones: 0, soffit: 0, fan: 0 },
  district: {
    arch: 12,
    deck: 12,
    pier: 12,
    rails: 14,
    lamps: 4,
    ring: 0,
    stones: 0,
    soffit: 0,
    fan: 0,
  },
  street: {
    arch: 28,
    deck: 36,
    pier: 24,
    rails: 42,
    lamps: 8,
    ring: 16,
    stones: 1,
    soffit: 1,
    fan: 0,
  },
  closeup: {
    arch: 56,
    deck: 72,
    pier: 40,
    rails: 42,
    lamps: 16,
    ring: 32,
    stones: 1,
    soffit: 4,
    fan: 1,
  },
};
function writer(target, far) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, color) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]],
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((q) => [q[0], q[1]]),
            color,
          );
        }
      },
    ]),
  );
}
function slab(o, slot, xs, left, right, bottom, top, color) {
  loft(
    o,
    slot,
    xs.map((x) => [
      [x, bottom(x), left(x)],
      [x, top(x), left(x)],
      [x, top(x), right(x)],
      [x, bottom(x), right(x)],
    ]),
    color,
  );
}
function capsule(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (-i * 2 * Math.PI) / n;
    return [x + Math.cos(t) * r, y, Math.sin(t) * r + (Math.sin(t) >= 0 ? 4.7 : -4.7)];
  });
}
function ring(o, x, y, z, S) {
  loft(
    o,
    'iron',
    Array.from({ length: S.ring + 1 }, (_, i) => {
      const a = (i * 2 * Math.PI) / S.ring,
        p = (r, zz) => [x + r * Math.cos(a), y + r * Math.sin(a), zz];
      return [p(0.087, z - 0.012), p(0.087, z + 0.012), p(0.123, z + 0.012), p(0.123, z - 0.012)];
    }),
    colors.iron,
    { cap: false },
  );
}
function lamp(o, x, z, n) {
  const y = deck(x) + 0.14;
  const lathe = (slot, profile, color) =>
    loft(
      o,
      slot,
      profile.map(([h, r]) =>
        Array.from({ length: n }, (_, i) => {
          const t = (-i * 2 * Math.PI) / n;
          return [x + r * Math.cos(t), y + h, z + r * Math.sin(t)];
        }),
      ),
      color,
    );
  lathe(
    'iron',
    [
      [0, 0.24],
      [0.1, 0.2],
      [0.22, 0.16],
      [0.72, 0.15],
      [1.05, 0.095],
      [1.18, 0.075],
      [3.56, 0.055],
      [3.65, 0.09],
      [3.86, 0.11],
    ],
    colors.iron,
  );
  lathe(
    'glass',
    [
      [3.94, 0.085],
      [4, 0.15],
      [4.24, 0.205],
      [4.58, 0.225],
    ],
    colors.glass,
  );
  lathe(
    'iron',
    [
      [4.56, 0.3],
      [4.68, 0.34],
      [4.75, 0.28],
      [4.94, 0.19],
      [5.04, 0.14],
      [5.16, 0.19],
      [5.28, 0.045],
    ],
    colors.iron,
  );
  if (n >= 8)
    for (const side of [-1, 1])
      beam(
        o,
        'iron',
        [x + side * 0.12, y + 3.8, z],
        [x + side * 0.24, y + 4.6, z],
        0.035,
        0.035,
        colors.iron,
      );
}
export function buildArchevecheBrowser(target, level = 'closeup') {
  const S = levels[level];
  if (!S) throw Error(`Unknown Archeveche browser level ${level}`);
  const o = writer(target, level === 'skyline');
  for (const x of C.piers) {
    loft(
      o,
      'stone',
      [
        capsule(x, 0, 1.27, S.pier),
        capsule(x, 4.08, 1.15, S.pier),
        capsule(x, 4.36, 1.32, S.pier),
        capsule(x, 4.4, 1.15, S.pier),
      ],
      colors.stone,
    );
    slab(
      o,
      'stone',
      [x - 1.15, x + 1.15],
      () => -5.4,
      () => 5.6,
      () => 4.38,
      (q) => deck(q) - 0.18,
      colors.stone,
    );
    if (S.ring) for (const side of [-1, 1]) ring(o, x, 2.95, side * 5.925, S);
  }
  slab(
    o,
    'stone',
    [C.west, -17.7],
    (x) => limits(x)[0],
    (x) => limits(x)[1],
    () => 0,
    (x) => deck(x) - 0.17,
    colors.stone,
  );
  slab(
    o,
    'stone',
    [34, 34.48],
    () => -5.42,
    () => 5.62,
    () => 0,
    (x) => deck(x),
    colors.stone,
  );
  for (const a of C.arches) {
    const xs = Array.from({ length: S.arch + 1 }, (_, i) => a.c - a.rx + (2 * a.rx * i) / S.arch);
    slab(
      o,
      'stone',
      xs,
      () => -5.4,
      () => 5.6,
      (x) => archevecheBrowserArch(a, x),
      (x) => deck(x) - 0.18,
      colors.stone,
    );
    if (S.stones)
      for (let i = 1; i < xs.length; i++) {
        const x0 = xs[i - 1] + 0.008,
          x1 = xs[i] - 0.008;
        for (const side of [-1, 1])
          loft(
            o,
            'stone',
            [x0, x1].map((x) => {
              const y = archevecheBrowserArch(a, x),
                z = side < 0 ? -5.45 : 5.65;
              return [
                [x, y, z - 0.035],
                [x, y + 0.68, z - 0.035],
                [x, y + 0.68, z + 0.035],
                [x, y, z + 0.035],
              ];
            }),
            colors.stone.map((v, k) => v + ((i % 3) - 1) * 0.015 * (k === 0 ? 1 : 0.8)),
          );
        for (let k = 0; k < S.soffit; k++) {
          const z0 = -5.4 + (11 * k) / S.soffit + 0.012,
            z1 = -5.4 + (11 * (k + 1)) / S.soffit - 0.012;
          loft(
            o,
            'stone',
            [x0, x1].map((x) => {
              const y = archevecheBrowserArch(a, x);
              return [
                [x, y - 0.018, z0],
                [x, y + 0.006, z0],
                [x, y + 0.006, z1],
                [x, y - 0.018, z1],
              ];
            }),
            colors.stone,
          );
        }
      }
  }
  const xs = [
    ...new Set([
      C.west,
      -17.7,
      C.east,
      ...Array.from({ length: S.deck + 1 }, (_, i) => C.west + ((C.east - C.west) * i) / S.deck),
    ]),
  ].sort((a, b) => a - b);
  slab(
    o,
    'paving',
    xs,
    (x) => limits(x)[0],
    (x) => limits(x)[1],
    (x) => deck(x) - 0.18,
    deck,
    colors.road,
  );
  for (const side of [-1, 1]) {
    slab(
      o,
      'paving',
      xs,
      (x) => (side < 0 ? limits(x)[0] : 3.5),
      (x) => (side < 0 ? -3.5 : limits(x)[1]),
      deck,
      (x) => deck(x) + 0.15,
      colors.walk,
    );
    slab(
      o,
      'stone',
      xs,
      () => (side < 0 ? -3.6 : 3.4),
      () => (side < 0 ? -3.4 : 3.6),
      (x) => deck(x) + 0.01,
      (x) => deck(x) + 0.16,
      colors.stone,
    );
    slab(
      o,
      'stone',
      xs,
      (x) => limits(x)[side < 0 ? 0 : 1] - 0.14,
      (x) => limits(x)[side < 0 ? 0 : 1] + 0.14,
      (x) => deck(x) - 0.06,
      (x) => deck(x) + 0.2,
      colors.stone,
    );
    if (S.rails) {
      for (let i = 0; i < S.rails; i++) {
        const x0 = -33.8 + (68 * i) / S.rails,
          x1 = -33.8 + (68 * (i + 1)) / S.rails,
          z = (x) => limits(x)[side < 0 ? 0 : 1] + side * 0.04,
          p = (x) => [x, deck(x) + 0.23, z(x)];
        for (const h of [0, 1.1])
          beam(
            o,
            'iron',
            [x0, p(x0)[1] + h, z(x0)],
            [x1, p(x1)[1] + h, z(x1)],
            0.06,
            0.065,
            colors.iron,
          );
        beam(o, 'iron', p(x0), [x0, p(x0)[1] + 1.13, z(x0)], 0.07, 0.07, colors.iron);
        if (level !== 'district') {
          for (const [a, b] of [
            [0.06, 1.06],
            [1.06, 0.06],
          ])
            beam(
              o,
              'iron',
              [x0, p(x0)[1] + a, z(x0)],
              [x1, p(x1)[1] + b, z(x1)],
              0.032,
              0.035,
              colors.iron,
            );
          const q = [
            [x0 + 0.05, p(x0)[1] + 0.05, z(x0) + side * 0.035],
            [x1 - 0.05, p(x1)[1] + 0.05, z(x1) + side * 0.035],
            [x1 - 0.05, p(x1)[1] + 1.05, z(x1) + side * 0.035],
            [x0 + 0.05, p(x0)[1] + 1.05, z(x0) + side * 0.035],
          ];
          o.addQuad('glass', 'palette:#ffffff', q, [0, 0, side], [], colors.glass);
        }
      }
    }
  }
  if (S.lamps)
    for (const [x, z] of [
      [-1.8, 3.894],
      [18.151, 3.987],
    ])
      lamp(o, x, z, S.lamps);
  if (S.rails) {
    slab(
      o,
      'mark',
      xs,
      () => 0.55,
      () => 0.84,
      (x) => deck(x) + 0.014,
      (x) => deck(x) + 0.024,
      colors.mark,
    );
    for (const x of [-6.539, 7.963, 26.415]) {
      const y = deck(x) - 0.48;
      box(o, 'mark', [x - 0.45, y - 0.44, 5.68], [x + 0.45, y + 0.44, 5.74], [0.68, 0.024, 0.026]);
      box(
        o,
        'mark',
        [x - 0.45, y - 0.145, 5.743],
        [x + 0.45, y + 0.145, 5.751],
        [0.91, 0.91, 0.86],
      );
    }
  }
  if (S.fan) {
    for (let x = -34.15; x < 34.1; x += 0.72)
      for (let z = -3.1; z < 3.35; z += 0.44) {
        const dx = 0.1 * Math.cos(z * 1.8),
          a = x + dx,
          b = Math.min(34.2, a + 0.69);
        if (a >= b) continue;
        const q = [
          [a, deck(a) + 0.012, z],
          [b, deck(b) + 0.012, z],
          [b, deck(b) + 0.012, z + 0.4],
          [a, deck(a) + 0.012, z + 0.4],
        ];
        o.addQuad(
          'paving',
          'palette:#ffffff',
          q,
          [0, 1, 0],
          [],
          colors.road.map((v) => v + (Math.floor(x * 10) % 3) * 0.008),
        );
      }
  }
}
export const buildArchevecheSkyline = (o) => buildArchevecheBrowser(o, 'skyline');
export const buildArchevecheDistrict = (o) => buildArchevecheBrowser(o, 'district');
export const buildArchevecheStreet = (o) => buildArchevecheBrowser(o, 'street');
export const buildArchevecheCloseup = (o) => buildArchevecheBrowser(o, 'closeup');

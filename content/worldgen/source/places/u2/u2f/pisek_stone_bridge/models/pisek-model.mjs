/** Original Písek bridge: seven true openings, mapped bend/cutwaters and four statue ensembles. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildPisekStatue } from './pisek-statues.mjs';

export const pisekControls = {
  originMeters: 356.92734375,
  waterY: 0.6,
  width: 6.25,
  profile: [
    [-55.4, 5.58],
    [-38.2, 4.75],
    [-23.6, 5.15],
    [-9, 5.3],
    [15.7, 5.15],
    [40, 4.9],
    [55.4, 4.55],
  ],
  centerline: [
    [-55.4, -3.52],
    [-38.2, -1.15],
    [-23.6, 0.6],
    [-9, 0.34],
    [3.25, 0.21],
    [15.7, 0.04],
    [27.85, -0.42],
    [40.2, -0.89],
    [52.35, -1.28],
    [55.4, -0.7],
  ],
  openings: [
    { lo: -35.986, hi: -23.51, rise: 3.8, spring: 0.35, wide: true },
    { lo: -19.419, hi: -11.193, rise: 3.8, spring: 0.55 },
    { lo: -6.969, hi: 1.087, rise: 3.8, spring: 0.55 },
    { lo: 5.322, hi: 13.58, rise: 3.75, spring: 0.55 },
    { lo: 17.687, hi: 25.887, rise: 3.65, spring: 0.55 },
    { lo: 29.867, hi: 38.164, rise: 3.45, spring: 0.55 },
    { lo: 42.108, hi: 50.389, rise: 3.2, spring: 0.55 },
  ],
  piers: [-21.44, -9.13, 3.2, 15.67, 27.85, 40.2],
  pierTips: [
    [
      [-21.491, -5.842],
      [-21.398, 7.284],
    ],
    [
      [-9.273, -6.284],
      [-8.989, 6.749],
    ],
    [
      [3.099, -6.286],
      [3.265, 6.847],
    ],
    [
      [15.496, -6.465],
      [15.813, 6.459],
    ],
    [
      [27.605, -6.839],
      [28.032, 6.084],
    ],
    [
      [39.904, -7.284],
      [40.284, 5.746],
    ],
  ],
  statues: [
    { type: 'calvary', x: 15.66, z: -3.9, facing: 1 },
    { type: 'nepomuk', x: 3.55, z: -4.08, facing: 1 },
    { type: 'anne', x: 3.28, z: 4.89, facing: -1 },
    { type: 'anthony', x: 15.85, z: 4.33, facing: -1 },
  ],
};
const C = pisekControls;
export const pisekSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 1, metallic: 0 },
  arch: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.97, metallic: 0 },
  sculpture: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 1, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.25 },
};
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const v = Number.parseInt(h, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const stone = linear('b9b3a5'),
  rim = linear('c8c0ae'),
  paving = linear('afa99b'),
  sculpture = linear('bca586'),
  wood = linear('8f7960'),
  iron = linear('4e5656'),
  gold = linear('d0b260');
const configs = {
  skyline: { curve: 2, rim: 0, statue: -1, wood: false },
  district: { curve: 6, rim: 0, statue: 0, wood: true },
  street: { curve: 16, rim: 12, statue: 1, wood: true },
  closeup: { curve: 32, rim: 24, statue: 2, wood: true },
  master: { curve: 56, rim: 40, statue: 3, wood: true },
};
function interpolate(points, x) {
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, z] = points[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (z - y);
  }
  return points.at(-1)[1];
}
export const pisekDeckY = (x) => interpolate(C.profile, x);
export const pisekCenterZ = (x) => interpolate(C.centerline, x);
export const pisekWidthFactor = (x) => 1 + 0.18 * Math.max(0, Math.min(1, (-x - 23.6) / 31.8));
export const pisekPoint = ([x, y, z]) => [x, y, z * pisekWidthFactor(x) + pisekCenterZ(x)];
export function pisekArchY(arch, x) {
  const r = (arch.hi - arch.lo) / 2,
    c = (arch.hi + arch.lo) / 2,
    k = arch.wide ? 0 : r * 0.25;
  return (
    arch.spring +
    (arch.rise * Math.sqrt(Math.max(0, (r + k) * (r + k) - (Math.abs(x - c) + k) ** 2))) /
      Math.sqrt((r + k) * (r + k) - k * k)
  );
}
function writer(target, far) {
  const emit = (slot, _ref, p, hint, _uv, tint) => {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      t = t.map(pisekPoint);
      const area = cross(
        t[1].map((v, j) => v - t[0][j]),
        t[2].map((v, j) => v - t[0][j]),
      );
      if (Math.hypot(...area) < 1e-10) continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(o, slot, p, color, hint) {
  o.addConvexPolygon(slot, 'palette:#ffffff', p, hint ?? normalFor(...p), null, color);
}
function slab(o, slot, a, b, z0, z1, offset, depth, color) {
  const cuts = [
    ...new Set([
      a,
      ...C.profile.map(([x]) => x).filter((x) => x > a && x < b),
      ...C.centerline.map(([x]) => x).filter((x) => x > a && x < b),
      b,
    ]),
  ].sort((a, b) => a - b);
  loft(
    o,
    slot,
    cuts.map((x) => {
      const y = pisekDeckY(x) + offset;
      return [
        [x, y - depth, z0],
        [x, y, z0],
        [x, y, z1],
        [x, y - depth, z1],
      ];
    }),
    color,
  );
}
function planPrism(o, slot, polygon, bottom, top, color) {
  const points = polygon.map(([x, z]) => [x, typeof top === 'function' ? top(x, z) : top, z]);
  face(o, slot, points, color, [0, 1, 0]);
  face(
    o,
    slot,
    polygon.map(([x, z]) => [x, bottom, z]),
    color,
    [0, -1, 0],
  );
  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
    cz = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length,
      a = points[i],
      b = points[j];
    face(o, slot, [[a[0], bottom, a[2]], [b[0], bottom, b[2]], b, a], color, [
      (a[0] + b[0]) / 2 - cx,
      0,
      (a[2] + b[2]) / 2 - cz,
    ]);
  }
}
function core(o, cfg) {
  const cuts = [-55.4, 55.4, ...C.profile.map((p) => p[0]), ...C.centerline.map((p) => p[0])];
  for (const h of C.openings)
    for (let i = 0; i <= cfg.curve; i++) cuts.push(h.lo + ((h.hi - h.lo) * i) / cfg.curve);
  const xs = [...new Set(cuts)].sort((a, b) => a - b);
  const rings = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      h = C.openings.find((h) => (a + b) / 2 > h.lo && (a + b) / 2 < h.hi),
      ya = h ? pisekArchY(h, a) : 0,
      yb = h ? pisekArchY(h, b) : 0;
    rings.push(
      ...[
        [
          [a, ya, -C.width / 2],
          [a, pisekDeckY(a) - 0.12, -C.width / 2],
          [a, pisekDeckY(a) - 0.12, C.width / 2],
          [a, ya, C.width / 2],
        ],
        [
          [b, yb, -C.width / 2],
          [b, pisekDeckY(b) - 0.12, -C.width / 2],
          [b, pisekDeckY(b) - 0.12, C.width / 2],
          [b, yb, C.width / 2],
        ],
      ],
    );
  }
  loft(o, 'wall', rings, stone);
  if (cfg.rim)
    for (const h of C.openings)
      for (const side of [-1, 1])
        for (let i = 0; i < cfg.rim; i++) {
          const a = h.lo + ((h.hi - h.lo) * i) / cfg.rim,
            b = h.lo + ((h.hi - h.lo) * (i + 1)) / cfg.rim,
            za = side * (C.width / 2 + 0.035),
            zb = side * (C.width / 2 + 0.09),
            A = pisekArchY(h, a),
            B = pisekArchY(h, b),
            color = rim.map((v) => v * (0.97 + (i % 3) * 0.02));
          loft(
            o,
            'arch',
            [
              [
                [a, A, Math.min(za, zb)],
                [a, A + 0.27, Math.min(za, zb)],
                [a, A + 0.27, Math.max(za, zb)],
                [a, A, Math.max(za, zb)],
              ],
              [
                [b, B, Math.min(za, zb)],
                [b, B + 0.27, Math.min(za, zb)],
                [b, B + 0.27, Math.max(za, zb)],
                [b, B, Math.max(za, zb)],
              ],
            ],
            color,
          );
        }
}
function pierHeads(o) {
  for (const [index, x] of C.piers.entries())
    for (const side of [-1, 1]) {
      const edge = C.width / 2,
        [tipX, nativeZ] = C.pierTips[index][side > 0 ? 1 : 0],
        tipZ = nativeZ - pisekCenterZ(tipX),
        poly = [
          [x - 2.08, side * edge],
          [x - 2.08, side * (edge + 0.55)],
          [tipX, tipZ],
          [x + 2.08, side * (edge + 0.55)],
          [x + 2.08, side * edge],
        ];
      planPrism(
        o,
        'wall',
        poly,
        0,
        (u, z) => pisekDeckY(u) - 0.5 - Math.max(0, Math.abs(z) - edge) * 0.42,
        stone,
      );
    }
}
function iceGuards(o, cfg) {
  if (!cfg.wood) return;
  for (const x of C.piers) {
    const low = [x, 0.62, 12.6],
      high = [x, 3.1, 7.2];
    for (const dx of [-0.75, 0, 0.75])
      beam(o, 'wood', [x + dx, 0.45, 12.9], [x + dx, 3.14, 7.15], 0.18, 0.2, wood);
    beam(o, 'wood', [x - 0.95, 0.5, 12.6], [x + 0.95, 0.5, 12.6], 0.18, 0.18, wood);
    beam(o, 'wood', [x - 0.95, 3, 7.35], [x + 0.95, 3, 7.35], 0.18, 0.18, wood);
    for (const direction of [-1, 1])
      beam(o, 'wood', [x + direction * 0.84, 0.3, 7.3], [...high], 0.2, 0.2, wood);
    // Horizontal side and rear planks enclose the triangular ice-guard wedge.
    // Close levels retain the slatted enclosure instead of reading as a ladder.
    if (cfg.statue >= 1)
      for (let i = 0; i < 7; i++) {
        const y = 0.46 + i * 0.36,
          endZ = 12.9 - ((y - 0.45) / 2.69) * 5.75;
        for (const side of [-1, 1])
          beam(o, 'wood', [x + side * 0.9, y, 7.3], [x + side * 0.9, y, endZ], 0.13, 0.26, wood);
        beam(o, 'wood', [x - 0.94, y, 7.3], [x + 0.94, y, 7.3], 0.13, 0.26, wood);
      }
    if (cfg.statue >= 2)
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        beam(
          o,
          'wood',
          [x - 0.82, low[1] + t * (high[1] - low[1]), low[2] + t * (high[2] - low[2])],
          [x + 0.82, low[1] + t * (high[1] - low[1]), low[2] + t * (high[2] - low[2])],
          0.11,
          0.13,
          wood,
        );
      }
  }
}
export function buildPisekLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Písek bridge level');
  const o = writer(target, level === 'skyline');
  core(o, cfg);
  pierHeads(o);
  slab(o, 'paving', -55.4, 55.4, -C.width / 2, C.width / 2, 0.015, 0.18, paving);
  for (const side of [-1, 1]) {
    const a = side < 0 ? -C.width / 2 : C.width / 2 - 0.52,
      b = a + 0.52;
    slab(o, 'wall', -55.4, 55.4, a, b, 1.08, 1.065, stone);
    if (cfg.statue >= 0) slab(o, 'arch', -55.4, 55.4, a - 0.06, b + 0.06, 1.15, 0.16, rim);
  }
  for (const item of C.statues) {
    const z = item.z - pisekCenterZ(item.x),
      deck = pisekDeckY(item.x);
    planPrism(
      o,
      'wall',
      [
        [item.x - 1.8, z - 0.95],
        [item.x + 1.8, z - 0.95],
        [item.x + 1.8, z + 0.95],
        [item.x - 1.8, z + 0.95],
      ],
      deck - 0.6,
      deck + 0.07,
      stone,
    );
    buildPisekStatue(
      o,
      item.type,
      [item.x, deck + 0.07, z],
      item.facing,
      cfg.statue,
      sculpture,
      iron,
      gold,
    );
  }
  iceGuards(o, cfg);
  // Bounded approximate paving overlaps at both actual map footway ends.
  for (const side of [-1, 1]) {
    const a = side < 0 ? -56.2 : 54.9,
      b = side < 0 ? -54.9 : 56.2;
    slab(o, 'paving', a, b, -4.3, 4.3, 0.005, 0.4, paving);
  }
  if (cfg.statue >= 1)
    for (const x of [-22.2, -8.77, 28.26]) {
      const z = x === -22.2 ? -2.63 : 3.6;
      beam(o, 'metal', [x, pisekDeckY(x), z], [x, pisekDeckY(x) + 3.15, z], 0.07, 0.07, iron);
      beam(
        o,
        'metal',
        [x - 0.2, pisekDeckY(x) + 3.15, z],
        [x + 0.2, pisekDeckY(x) + 3.15, z],
        0.11,
        0.13,
        iron,
      );
    }
}
export const buildPisekSkyline = (o) => buildPisekLevel(o, 'skyline');
export const buildPisekDistrict = (o) => buildPisekLevel(o, 'district');
export const buildPisekStreet = (o) => buildPisekLevel(o, 'street');
export const buildPisekCloseup = (o) => buildPisekLevel(o, 'closeup');

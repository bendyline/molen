/** Original modern twin-deck Voroshilovsky bridge exterior. Meters; +X toward city. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const data = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url))),
  grid = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  concrete: linear('c8c8ba'),
  steel: linear('a3afa7'),
  road: linear('646a68'),
  paint: linear('e4dfcd'),
  glass: linear('b8d0c9'),
  dark: linear('5e6864'),
};
export const voroshilovskySurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.35 },
  road: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.16,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.24],
    doubleSided: true,
  },
};
export const voroshilovskyControls = {
  originElevation: data.originElevation,
  limits: data.limits,
  roadLines: data.roadLines,
  footLines: data.footLines,
  piers: data.riverPiers,
  lifts: data.lifts,
  deckProfile: data.deckProfile,
  waterCrossingX: data.waterCrossingX,
};
const interpolate = (p, x) => {
  const i = p.findIndex((p) => p[0] >= x);
  if (i <= 0) return p[i === 0 ? 0 : p.length - 1][1];
  const a = p[i - 1],
    b = p[i];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
};
export const voroshilovskyDeckY = (x) => interpolate(data.deckProfile, x);
export const voroshilovskyGroundY = (x, z) => {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = grid.size[0],
    h = grid.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    data.originElevation
  );
};
const cfgs = {
  skyline: {
    far: true,
    segments: 3,
    pierAggregate: true,
    cross: 0,
    posts: 0,
    balusters: 0,
    lamps: 0,
    liftDetail: false,
    liftGlass: false,
  },
  district: {
    segments: 6,
    cross: 0,
    posts: 0,
    balusters: 0,
    lamps: 105,
    liftDetail: false,
    liftGlass: false,
  },
  street: {
    segments: 24,
    cross: 32,
    posts: 16,
    balusters: 0,
    lamps: 48,
    liftDetail: false,
    liftGlass: true,
  },
  closeup: {
    segments: 48,
    cross: 12,
    posts: 4,
    balusters: 1.8,
    lamps: 42,
    liftDetail: true,
    liftGlass: true,
  },
  master: {
    segments: 72,
    cross: 6,
    posts: 2,
    balusters: 0.24,
    lamps: 42,
    liftDetail: true,
    liftGlass: true,
  },
};
// Cross-section rings face +X, giving outward top/bottom and end winding.
function ribbon(out, slot, a, b, za, zb, top, bottom, color) {
  const ring = (x) => {
    const hi = top(x),
      lo = bottom(x);
    return [
      [x, lo, za],
      [x, hi, za],
      [x, hi, zb],
      [x, lo, zb],
    ];
  };
  loft(out, slot, [ring(a), ring(b)], color);
}
const roadCenters = data.roadLines.map((l) => (l[0][1] + l.at(-1)[1]) / 2).sort((a, b) => a - b);
const [x0, x1] = data.limits;
const girderDepth = (x) =>
  2.15 + 1.25 * Math.max(0, 1 - Math.min(...data.riverPiers.map((p) => Math.abs(x - p))) / 20);
function pier(out, slot, x, cfg) {
  const nativeBase = Math.min(voroshilovskyGroundY(x, -13), voroshilovskyGroundY(x, 13)) - 0.7,
    base =
      x >= data.waterCrossingX[0] && x <= data.waterCrossingX[1]
        ? Math.min(0, nativeBase)
        : nativeBase,
    top = voroshilovskyDeckY(x) - girderDepth(x) - 0.5;
  if (top <= base + 0.2) return;
  const footTop = Math.min(top - 0.1, base + 1.7);
  box(out, slot, [x - 3.4, base, -15.3], [x + 3.4, footTop, 15.3], C.concrete);
  for (const z of roadCenters) {
    if (cfg.pierAggregate) {
      box(out, slot, [x - 1.05, footTop, z - 4.2], [x + 1.05, top, z + 4.2], C.concrete);
      continue;
    }
    for (const dz of [-4.15, 4.15]) {
      const bottom = footTop - 0.02,
        ring = (y, s) => [
          [x - 1.15 * s, y, z + dz - 1.5 * s],
          [x - 1.15 * s, y, z + dz + 1.5 * s],
          [x + 1.15 * s, y, z + dz + 1.5 * s],
          [x + 1.15 * s, y, z + dz - 1.5 * s],
        ];
      loft(out, slot, [ring(bottom, 1.22), ring(top, 1)], C.concrete);
      if (cfg.liftDetail)
        for (const y of [footTop + 2.3, footTop + 4.6])
          if (y + 0.22 < top)
            box(
              out,
              slot,
              [x - 1.18, y, z + dz - 1.56],
              [x + 1.18, y + 0.22, z + dz + 1.56],
              C.concrete,
            );
    }
    box(out, slot, [x - 1.5, top - 0.55, z - 6.5], [x + 1.5, top + 0.25, z + 6.5], C.concrete);
  }
}
function rail(out, slot, z, cfg, pedestrian) {
  const top = pedestrian ? 1.25 : 0.8,
    bottom = pedestrian ? 0.55 : 0.48,
    width = pedestrian ? 0.07 : 0.11;
  const profile =
    cfg === cfgs.district
      ? [data.deckProfile[0], data.deckProfile[4], data.deckProfile[6], data.deckProfile.at(-1)]
      : data.deckProfile;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    for (const h of cfg.far ? [top] : [bottom, top])
      beam(
        out,
        slot,
        [a[0], a[1] + h, z],
        [b[0], b[1] + h, z],
        width,
        pedestrian ? 0.065 : 0.24,
        C.steel,
      );
  }
  const spacing = pedestrian ? cfg.balusters || cfg.posts : cfg.posts;
  if (!spacing) return;
  for (let x = x0 + 1; x < x1; x += spacing) {
    const y = voroshilovskyDeckY(x);
    box(out, slot, [x - 0.04, y, z - 0.04], [x + 0.04, y + top, z + 0.04], C.steel);
  }
}
function lamp(out, slot, x, z, cfg) {
  const y = voroshilovskyDeckY(x),
    side = Math.sign(z);
  if (cfg === cfgs.district) {
    box(out, slot, [x - 0.09, y, z - 0.09], [x + 0.09, y + 10, z + 0.09], C.dark);
    return;
  }
  tubePath(
    out,
    slot,
    [
      [x, y, z],
      [x, y + 9.6, z],
      [x, y + 10.25, z - side * 0.6],
      [x, y + 10.25, z - side * 2],
    ],
    0.075,
    C.dark,
    cfg === cfgs.master ? 10 : 4,
  );
  box(
    out,
    slot,
    [x - 0.16, y + 10.15, z - side * 2 - 0.4],
    [x + 0.16, y + 10.3, z - side * 2 + 0.4],
    C.dark,
  );
}
function lift(out, S, control, cfg) {
  const { x, z, side } = control,
    ground = voroshilovskyGroundY(x, z),
    deck = voroshilovskyDeckY(x),
    height = deck - ground;
  if (height < 3) return;
  const a = x - 12,
    b = x,
    low = ground + 0.12,
    high = deck + 3.7;
  // Four-sided glass stair enclosure with a pitched triangular profile and real internal flights.
  const ring = (zz) => [
    [a, low, zz],
    [b, low, zz],
    [b, high, zz],
  ];
  loft(out, S(cfg.liftGlass ? 'glass' : 'steel'), [ring(z - 1.65), ring(z + 1.65)], C.glass);
  if (cfg.far) return;
  const baseRing = (y) => [
    [a - 0.35, y(a - 0.35, z - 2), z - 2],
    [a - 0.35, y(a - 0.35, z + 2), z + 2],
    [b + 0.35, y(b + 0.35, z + 2), z + 2],
    [b + 0.35, y(b + 0.35, z - 2), z - 2],
  ];
  loft(
    out,
    S('concrete'),
    [
      baseRing((x, z) => Math.min(low - 0.2, voroshilovskyGroundY(x, z) - 0.65)),
      baseRing(() => low),
    ],
    C.concrete,
  );
  for (const zz of [z - 1.7, z + 1.7]) {
    for (const [p, q] of [
      [
        [a, low, zz],
        [b, low, zz],
      ],
      [
        [b, low, zz],
        [b, high, zz],
      ],
      [
        [a, low, zz],
        [b, high, zz],
      ],
    ])
      beam(out, S('steel'), p, q, 0.18, 0.2, C.steel);
    if (cfg.liftDetail) {
      for (let y = low + 3; y < high; y += 3)
        beam(
          out,
          S('steel'),
          [a + ((y - low) / (high - low)) * (b - a), y, zz],
          [b, y, zz],
          0.07,
          0.1,
          C.steel,
        );
      for (let xx = a + 2; xx < b; xx += 2) {
        const top = low + ((xx - a) / (b - a)) * (high - low);
        beam(out, S('steel'), [xx, low, zz], [xx, top, zz], 0.065, 0.08, C.steel);
      }
    }
  }
  const shaftX = b - 1.4;
  for (const zz of [z - 0.9, z + 0.9])
    beam(out, S('steel'), [shaftX, low, zz], [shaftX, deck + 1.4, zz], 0.18, 0.16, C.steel);
  box(
    out,
    S('concrete'),
    [shaftX - 0.45, deck - 0.3, Math.min(z, side * 17.6)],
    [shaftX + 1.8, deck, Math.max(z, side * 17.6)],
    C.concrete,
  );
  if (!cfg.liftDetail) return;
  const flights = Math.max(2, Math.ceil(height / 2)),
    rise = height / flights;
  for (let j = 0; j < flights; j++) {
    const y = low + j * rise,
      left = Math.max(b - 5, a + ((y + rise - low) / (high - low)) * (b - a) + 0.22),
      right = b - 0.28,
      xa = j % 2 ? right : left,
      xb = j % 2 ? left : right,
      zz = z + (j % 2 ? 0.65 : -0.65);
    const count = 10;
    for (let i = 0; i < count; i++) {
      const xx = xa + ((xb - xa) * i) / count,
        next = xa + ((xb - xa) * (i + 1)) / count;
      box(
        out,
        S('concrete'),
        [Math.min(xx, next), y + (rise * i) / count - 0.12, zz - 0.53],
        [Math.max(xx, next), y + (rise * (i + 1)) / count, zz + 0.53],
        C.concrete,
      );
    }
    beam(
      out,
      S('steel'),
      [xa, y + 0.95, zz + 0.55],
      [xb, y + rise + 0.95, zz + 0.55],
      0.05,
      0.06,
      C.steel,
    );
  }
}
export function buildVoroshilovskyLevel(out, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Voroshilovsky tier ' + level);
  const S = (s) => (cfg.far ? 'far' : s);
  const breaks = cfg.far
    ? [x0, 0, x1]
    : cfg === cfgs.district
      ? [x0, -89, 67, x1]
      : [...new Set([x0, x1, ...data.deckProfile.map((p) => p[0])])].sort((a, b) => a - b);
  for (let j = 1; j < breaks.length; j++) {
    const a = breaks[j - 1],
      b = breaks[j],
      n = cfg.far ? 1 : Math.max(1, Math.round(((b - a) / (x1 - x0)) * cfg.segments));
    for (let i = 0; i < n; i++) {
      const p = a + ((b - a) * i) / n,
        q = a + ((b - a) * (i + 1)) / n;
      for (const z of roadCenters) {
        ribbon(
          out,
          S('concrete'),
          p,
          q,
          z - (z < 0 ? 9.6 : 7.65),
          z + (z > 0 ? 9.6 : 7.65),
          voroshilovskyDeckY,
          (x) => voroshilovskyDeckY(x) - 0.45,
          C.concrete,
        );
        ribbon(
          out,
          S('road'),
          p,
          q,
          z - 5.7,
          z + 5.7,
          (x) => voroshilovskyDeckY(x) + 0.035,
          voroshilovskyDeckY,
          C.road,
        );
        const outer = z + Math.sign(z) * 8;
        ribbon(
          out,
          S('concrete'),
          p,
          q,
          outer - 1.45,
          outer + 1.45,
          (x) => voroshilovskyDeckY(x) + 0.16,
          (x) => voroshilovskyDeckY(x) + 0.03,
          C.concrete,
        );
        if (!cfg.far)
          for (const zz of [z - 4.15, z + 4.15]) {
            ribbon(
              out,
              S('steel'),
              p,
              q,
              zz - 0.11,
              zz + 0.11,
              (x) => voroshilovskyDeckY(x) - 0.45,
              (x) => voroshilovskyDeckY(x) - girderDepth(x),
              C.steel,
            );
            for (const bottom of [false, true])
              ribbon(
                out,
                S('steel'),
                p,
                q,
                zz - 0.55,
                zz + 0.55,
                (x) => voroshilovskyDeckY(x) - (bottom ? girderDepth(x) : 0.5),
                (x) => voroshilovskyDeckY(x) - (bottom ? girderDepth(x) : 0.5) - 0.14,
                C.steel,
              );
          }
      }
    }
  }
  if (cfg.far)
    for (const z of roadCenters)
      for (let i = 1; i < breaks.length; i++)
        ribbon(
          out,
          'far',
          breaks[i - 1],
          breaks[i],
          z - 4.7,
          z + 4.7,
          (x) => voroshilovskyDeckY(x) - 0.45,
          (x) => voroshilovskyDeckY(x) - 2.5,
          C.steel,
        );
  for (const x of data.riverPiers) pier(out, S('concrete'), x, cfg);
  for (const x of [x0, x1])
    for (const z of roadCenters) {
      const y = voroshilovskyDeckY(x);
      box(
        out,
        S('concrete'),
        [x - 0.6, y - 1.5, z - (z < 0 ? 9.55 : 7.6)],
        [x + 0.6, y - 0.05, z + (z > 0 ? 9.55 : 7.6)],
        C.concrete,
      );
    }
  if (cfg.cross)
    for (let x = x0 + 5; x < x1; x += cfg.cross)
      for (const z of roadCenters) {
        const y = voroshilovskyDeckY(x) - 1.1;
        beam(out, S('steel'), [x, y, z - 5], [x, y, z + 5], 0.12, 0.55, C.steel);
        if (cfg.liftDetail)
          for (const zz of [z - 4.15, z + 4.15])
            box(
              out,
              S('steel'),
              [x - 0.06, y - girderDepth(x) + 1.3, zz - 0.45],
              [x + 0.06, y + 0.6, zz + 0.45],
              C.steel,
            );
      }
  if (!cfg.far) {
    for (const z of roadCenters) {
      const sign = Math.sign(z);
      rail(out, S('steel'), z + sign * 9.4, cfg, true);
      rail(out, S('steel'), z - sign * 6.7, cfg, false);
      rail(out, S('steel'), z + sign * 5.9, cfg, false);
    }
    if (level !== 'district')
      for (let x = x0 + 5; x < x1 - 4; x += 12)
        for (const z of roadCenters)
          for (const dz of [-1.9, 1.9])
            ribbon(
              out,
              S('paint'),
              x,
              x + 4,
              z + dz - 0.06,
              z + dz + 0.06,
              (p) => voroshilovskyDeckY(p) + 0.048,
              (p) => voroshilovskyDeckY(p) + 0.036,
              C.paint,
            );
    if (cfg.lamps)
      for (let x = x0 + 20; x < x1 - 10; x += cfg.lamps)
        for (const z of [-14.2, 14.2]) lamp(out, S('steel'), x, z, cfg);
  }
  for (const control of data.lifts) lift(out, S, control, cfg);
}
export const buildVoroshilovskySkyline = (out) => buildVoroshilovskyLevel(out, 'skyline');
export const buildVoroshilovskyDistrict = (out) => buildVoroshilovskyLevel(out, 'district');
export const buildVoroshilovskyStreet = (out) => buildVoroshilovskyLevel(out, 'street');
export const buildVoroshilovskyCloseup = (out) => buildVoroshilovskyLevel(out, 'closeup');

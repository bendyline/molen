/** Original Red Bridge exterior: retained map skew and ordinary photo proportions. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const redBridgeControls = {
  shear: 0.147,
  halfSpan: 11.65,
  halfLength: 16.8,
  halfWidth: 8.45,
  originMeters: 17.030528450012206,
  waterY: 0.524603462219238,
  archSpring: 1.25,
  archRise: 1.95,
  archDepth: 0.28,
  profile: [
    [-16.8, 3.98],
    [-11.65, 4.02],
    [0, 4.12],
    [11.65, 4.02],
    [16.8, 3.98],
  ],
};
const C = redBridgeControls;
export const redBridgeSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.32 },
  glass: {
    slot: 'window',
    localRef: 'palette:#eef0e3',
    roughness: 0.2,
    metallic: 0,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.5],
    doubleSided: true,
  },
};
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const v = Number.parseInt(h, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const paint = linear('bd342c'),
  edge = linear('c84135'),
  stone = linear('b7afa2'),
  paving = linear('b0aba1'),
  asphalt = linear('666866'),
  dark = linear('3c4140'),
  gold = linear('d7b455'),
  glass = linear('cbd0c1');
const levels = {
  skyline: { curve: 4, ribs: 0, bay: 0, ring: 0, flower: 0, lamp: 0 },
  district: { curve: 10, ribs: 3, bay: 2.35, ring: 8, flower: 0, lamp: 1 },
  street: { curve: 24, ribs: 5, bay: 1.18, ring: 12, flower: 4, lamp: 4 },
  closeup: { curve: 40, ribs: 9, bay: 1.18, ring: 20, flower: 8, lamp: 8 },
  master: { curve: 64, ribs: 9, bay: 1.18, ring: 32, flower: 8, lamp: 12, rivets: true },
};
export const redBridgePoint = ([u, y, z]) => [u - C.shear * z, y, z];
export function redBridgeDeckY(u) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, ya] = C.profile[i - 1],
      [b, yb] = C.profile[i];
    if (u <= b) return ya + Math.max(0, Math.min(1, (u - a) / (b - a))) * (yb - ya);
  }
  return C.profile.at(-1)[1];
}
export function redBridgeArchY(u) {
  const r = C.halfSpan,
    h = C.archRise,
    R = (r * r + h * h) / (2 * h);
  return C.archSpring + Math.sqrt(Math.max(0, R * R - u * u)) - (R - h);
}
export const redBridgeWalkOffset = (u) =>
  0.015 + 0.165 * Math.max(0, Math.min(1, (C.halfLength - Math.abs(u)) / 2.5));
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let original = [p[0], p[i], p[i + 1]];
      const n = normalFor(...original);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0)
        original = [original[0], original[2], original[1]];
      const triangle = original.map(redBridgePoint);
      const area = cross(
        triangle[1].map((v, j) => v - triangle[0][j]),
        triangle[2].map((v, j) => v - triangle[0][j]),
      );
      if (Math.hypot(...area) < 1e-10) continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        triangle,
        normalFor(...triangle),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far && slot !== 'glass' ? tint.map((v) => v * 0.65) : tint,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function slab(o, slot, u0, u1, z0, z1, offset, depth, color) {
  const cuts = [
    ...new Set([
      u0,
      ...[
        ...C.profile.map(([u]) => u),
        ...(typeof offset === 'function' ? [-14.3, 14.3] : []),
      ].filter((u) => u > u0 && u < u1),
      u1,
    ]),
  ].sort((a, b) => a - b);
  loft(
    o,
    slot,
    cuts.map((u) => {
      const y = redBridgeDeckY(u) + (typeof offset === 'function' ? offset(u) : offset);
      return [
        [u, y - depth, z0],
        [u, y - depth, z1],
        [u, y, z1],
        [u, y, z0],
      ].toReversed();
    }),
    color,
  );
}
function archStrip(o, cfg, z0, z1, web) {
  const rings = Array.from({ length: cfg.curve + 1 }, (_, i) => {
    const u = -C.halfSpan + (2 * C.halfSpan * i) / cfg.curve;
    const y = redBridgeArchY(u),
      top = web ? redBridgeDeckY(u) - 0.17 : y + C.archDepth;
    return [
      [u, y, z0],
      [u, y, z1],
      [u, top, z1],
      [u, top, z0],
    ].toReversed();
  });
  loft(o, 'metal', rings, paint);
}
function ring(o, slot, center, radius, width, color, segments) {
  const points = Array.from({ length: segments }, (_, i) => {
    const a = (i * Math.PI * 2) / segments;
    return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2]];
  });
  beamPath(o, slot, points, width, width, color, true);
}
function railing(o, cfg, z) {
  const n = cfg.bay ? Math.ceil((2 * C.halfSpan) / cfg.bay) : 0;
  if (!n) {
    slab(o, 'metal', -C.halfSpan, C.halfSpan, z - 0.06, z + 0.06, 1.17, 0.75, paint);
    return;
  }
  const pts = C.profile.filter(([u]) => Math.abs(u) <= C.halfSpan).map(([u, y]) => [u, y, z]);
  for (const h of [0.26, 1.21])
    beamPath(
      o,
      'metal',
      pts.map(([u, y, z]) => [u, y + h, z]),
      0.065,
      0.075,
      edge,
    );
  for (let i = 0; i <= n; i++) {
    const u = -C.halfSpan + (2 * C.halfSpan * i) / n,
      y = redBridgeDeckY(u);
    beam(o, 'metal', [u, y + 0.19, z], [u, y + 1.24, z], 0.055, 0.06, paint);
    if (i === n) continue;
    const mid = u + C.halfSpan / n,
      cy = redBridgeDeckY(mid) + 0.73;
    ring(o, 'metal', [mid, cy, z], cfg.flower ? 0.31 : 0.34, 0.04, paint, cfg.ring);
    if (cfg.flower) {
      const count = cfg.flower === 4 ? 8 : cfg.ring;
      const rosette = Array.from({ length: count }, (_, k) => {
        const a = (k * Math.PI * 2) / count,
          r = 0.16 + 0.07 * Math.cos(4 * a);
        return [mid + r * Math.cos(a), cy + r * Math.sin(a), z];
      });
      beamPath(o, 'metal', rosette, 0.033, 0.04, edge, true);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        beam(
          o,
          'metal',
          [mid + 0.225 * Math.cos(a), cy + 0.225 * Math.sin(a), z],
          [mid + 0.31 * Math.cos(a), cy + 0.31 * Math.sin(a), z],
          0.033,
          0.04,
          edge,
        );
      }
      for (const sign of [-1, 1]) {
        beam(
          o,
          'metal',
          [u + 0.05, redBridgeDeckY(u) + (sign < 0 ? 0.29 : 1.16), z],
          [mid - 0.19, cy + sign * 0.21, z],
          0.035,
          0.04,
          paint,
        );
        beam(
          o,
          'metal',
          [mid + 0.19, cy + sign * 0.21, z],
          [u + (2 * C.halfSpan) / n - 0.05, redBridgeDeckY(u) + (sign < 0 ? 0.29 : 1.16), z],
          0.035,
          0.04,
          paint,
        );
      }
    }
  }
}
function obelisk(o, cfg, u, z) {
  const y = redBridgeDeckY(u) + 0.18;
  box(o, 'stone', [u - 0.55, y, z - 0.45], [u + 0.55, y + 0.4, z + 0.45], stone);
  box(o, 'stone', [u - 0.43, y + 0.4, z - 0.36], [u + 0.43, y + 0.56, z + 0.36], paving);
  loft(
    o,
    'stone',
    [
      [
        [u - 0.34, y + 0.56, z - 0.29],
        [u - 0.34, y + 0.56, z + 0.29],
        [u + 0.34, y + 0.56, z + 0.29],
        [u + 0.34, y + 0.56, z - 0.29],
      ],
      [
        [u - 0.21, y + 2.54, z - 0.2],
        [u - 0.21, y + 2.54, z + 0.2],
        [u + 0.21, y + 2.54, z + 0.2],
        [u + 0.21, y + 2.54, z - 0.2],
      ],
    ],
    stone,
  );
  box(o, 'stone', [u - 0.24, y + 2.54, z - 0.22], [u + 0.24, y + 2.68, z + 0.22], paving);
  sphere(
    o,
    'metal',
    [u, y + 2.83, z],
    [0.13, 0.15, 0.13],
    gold,
    cfg.lamp > 1 ? 12 : 6,
    cfg.lamp > 1 ? 6 : 3,
  );
  if (!cfg.lamp) return;
  for (const direction of [-1, 1]) {
    const end = u + direction * 0.79;
    if (cfg.lamp === 1) {
      beam(o, 'metal', [u, y + 2.17, z], [end, y + 2.17, z], 0.07, 0.07, dark);
      box(o, 'metal', [end - 0.12, y + 1.65, z - 0.12], [end + 0.12, y + 2.12, z + 0.12], dark);
      continue;
    }
    const arm = Array.from({ length: cfg.lamp + 1 }, (_, i) => {
      const t = i / cfg.lamp;
      return [u + direction * 0.79 * t, y + 1.91 + 0.34 * Math.sin(t * Math.PI * 0.7), z];
    });
    beamPath(o, 'metal', arm, 0.055, 0.055, dark);
    beam(o, 'metal', [end, y + 2.19, z], [end, y + 1.96, z], 0.045, 0.045, dark);
    const bottom = y + 1.43,
      top = y + 1.95;
    box(o, 'metal', [end - 0.17, top - 0.08, z - 0.17], [end + 0.17, top, z + 0.17], dark);
    loft(
      o,
      'glass',
      [
        [
          [end - 0.1, bottom, z - 0.1],
          [end - 0.1, bottom, z + 0.1],
          [end + 0.1, bottom, z + 0.1],
          [end + 0.1, bottom, z - 0.1],
        ],
        [
          [end - 0.145, top - 0.08, z - 0.145],
          [end - 0.145, top - 0.08, z + 0.145],
          [end + 0.145, top - 0.08, z + 0.145],
          [end + 0.145, top - 0.08, z - 0.145],
        ],
      ],
      glass,
    );
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        beam(
          o,
          'metal',
          [end + a * 0.1, bottom, z + b * 0.1],
          [end + a * 0.145, top - 0.08, z + b * 0.145],
          0.025,
          0.025,
          dark,
        );
    box(
      o,
      'metal',
      [end - 0.12, bottom - 0.055, z - 0.12],
      [end + 0.12, bottom + 0.02, z + 0.12],
      dark,
    );
  }
}
export function buildRedBridgeLevel(target, level = 'master') {
  const cfg = levels[level];
  if (!cfg) throw new Error(`Unknown Red Bridge level ${level}`);
  const o = writer(target, level === 'skyline');
  for (const side of [-1, 1]) {
    const lo = side < 0 ? -C.halfLength : C.halfSpan;
    const hi = side < 0 ? -C.halfSpan : C.halfLength;
    box(o, 'stone', [lo, 0, -C.halfWidth], [hi, 3.7, C.halfWidth], stone);
    slab(o, 'stone', lo, hi, -C.halfWidth - 0.1, C.halfWidth + 0.1, -0.03, 0.5, paving);
    for (const z of [-8.35, 8.35]) obelisk(o, cfg, side * 12.55, z);
    // Thin approximate bank paving overlaps the skewed map lane/footway widths.
    const a = side < 0 ? -17.55 : 16.4,
      b = side < 0 ? -16.4 : 17.55;
    box(o, 'stone', [a, 0, -9.85], [b, 3.7, 9.85], stone);
    slab(o, 'road', a, b, -5.1, 5.1, 0.005, 0.3, asphalt);
    for (const sign of [-1, 1]) {
      const z0 = sign < 0 ? -9.85 : 5.1,
        z1 = sign < 0 ? -5.1 : 9.85;
      slab(o, 'stone', a, b, z0, z1, 0.005, 0.3, paving);
      const c = side < 0 ? -17.55 : 14.7,
        d = side < 0 ? -14.7 : 17.55;
      box(o, 'stone', [c, 0, sign < 0 ? -9.85 : 8.55], [d, 3.7, sign < 0 ? -8.55 : 9.85], stone);
      slab(o, 'stone', c, d, sign < 0 ? -9.85 : 8.55, sign < 0 ? -8.55 : 9.85, 0.005, 0.3, paving);
    }
  }
  slab(o, 'metal', -C.halfSpan, C.halfSpan, -8.45, 8.45, -0.08, 0.25, paint);
  slab(o, 'road', -C.halfLength, C.halfLength, -5.1, 5.1, 0, 0.12, asphalt);
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -8.45 : 5.1,
      z1 = side < 0 ? -5.1 : 8.45;
    slab(o, 'stone', -C.halfLength, C.halfLength, z0, z1, redBridgeWalkOffset, 0.18, paving);
    const z = side * 8.33;
    archStrip(o, cfg, z - 0.1, z + 0.1, true);
    const pts = Array.from({ length: cfg.curve + 1 }, (_, i) => {
      const u = -C.halfSpan + (2 * C.halfSpan * i) / cfg.curve;
      return [u, redBridgeArchY(u) + 0.1, z + side * 0.13];
    });
    beamPath(o, 'metal', pts, 0.14, 0.12, edge);
    railing(o, cfg, z);
    if (cfg.rivets)
      for (const [u, y, z] of pts.filter((_, i) => i % 2 === 0))
        sphere(o, 'metal', [u, y + 0.13, z + side * 0.05], [0.035, 0.035, 0.025], edge, 6, 3);
  }
  for (let i = 0; i < cfg.ribs; i++) {
    const z = -7.5 + (15 * i) / Math.max(1, cfg.ribs - 1);
    archStrip(o, cfg, z - 0.07, z + 0.07, false);
  }
  if (cfg.ribs)
    for (const u of [-9, -4.5, 0, 4.5, 9])
      beam(o, 'metal', [u, 3.62, -8.2], [u, 3.62, 8.2], 0.16, 0.24, dark);
}
export const buildRedBridgeSkyline = (o) => buildRedBridgeLevel(o, 'skyline');
export const buildRedBridgeDistrict = (o) => buildRedBridgeLevel(o, 'district');
export const buildRedBridgeStreet = (o) => buildRedBridgeLevel(o, 'street');
export const buildRedBridgeCloseup = (o) => buildRedBridgeLevel(o, 'closeup');

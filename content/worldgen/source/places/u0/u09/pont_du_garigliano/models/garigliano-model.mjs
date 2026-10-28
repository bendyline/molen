/** Original Pont du Garigliano: three green haunched spans and paired tapered stone piers. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import C from './garigliano-controls.json' with { type: 'json' };
import { buildGariglianoLandings } from './garigliano-landings.mjs';
export const gariglianoControls = C;
export const gariglianoSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.25 },
};
const linear = (h) =>
  h.match(/../g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const green = linear(C.paint),
  darkGreen = linear('3e6957'),
  stone = linear(C.stone),
  stoneJoint = linear('a6a295'),
  asphalt = linear('646766'),
  paving = linear('aaa59a'),
  marking = linear('eee9d4'),
  lampDark = linear('414b48');
const levels = {
  skyline: { sections: 6, bars: 0, ribs: 0, lamps: 0, joints: false, braces: false },
  district: { sections: 12, bars: 0, ribs: 5, lamps: 0, joints: false, braces: false },
  street: { sections: 24, bars: 0.65, ribs: 14, lamps: 4, joints: false, braces: false },
  closeup: { sections: 48, bars: 0.22, ribs: 30, lamps: 10, joints: true, braces: true },
  master: { sections: 72, bars: 0.16, ribs: 40, lamps: 14, joints: true, braces: true },
};
export function gariglianoDeckY(x) {
  return C.deckEndY + C.deckCrown * (1 - (x / C.halfLength) ** 2);
}
export function gariglianoGirderBottom(x) {
  const stations = [-C.halfLength, ...C.pierStations, C.halfLength];
  let i = 1;
  while (i < stations.length - 1 && x > stations[i]) i++;
  const a = stations[i - 1],
    b = stations[i],
    u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  const da = i === 1 ? C.girderDepthAtMidspan : C.girderDepthAtSupport,
    db = i === 3 ? C.girderDepthAtMidspan : C.girderDepthAtSupport;
  const t = u < 0.5 ? u * 2 : (1 - u) * 2,
    edge = u < 0.5 ? da : db;
  const depth = edge + (C.girderDepthAtMidspan - edge) * Math.sin((t * Math.PI) / 2);
  return gariglianoDeckY(x) - 0.45 - depth;
}
function writer(target, far) {
  const emit = (slot, _ref, points, hint, _uv, color) => {
    for (let i = 1; i < points.length - 1; i++) {
      let tri = [points[0], points[i], points[i + 1]],
        n = normalFor(...tri);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) tri = [tri[0], tri[2], tri[1]];
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, j) => v - tri[0][j]),
            tri[2].map((v, j) => v - tri[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        tri,
        normalFor(...tri),
        tri.map((p) => [p[0], p[1]]),
        color,
      );
    }
  };
  return { addTriangle: emit, addQuad: emit, addConvexPolygon: emit };
}
const cuts = (n) =>
  [
    ...new Set([
      ...Array.from({ length: n + 1 }, (_, i) => -C.halfLength + (2 * C.halfLength * i) / n),
      ...C.pierStations,
    ]),
  ].sort((a, b) => a - b);
function slab(o, slot, xs, z0, z1, top, bottom, color) {
  loft(
    o,
    slot,
    xs.map((x) =>
      [
        [x, bottom(x), z0],
        [x, bottom(x), z1],
        [x, top(x), z1],
        [x, top(x), z0],
      ].reverse(),
    ),
    color,
  );
}
function pier(o, x, detail) {
  const top = gariglianoGirderBottom(x) - 0.12,
    bottom = -0.9;
  for (const side of [-1, 1]) {
    const ring = (y, halfThickness, inner) => {
      const a = Math.min(side * 12, side * inner),
        b = Math.max(side * 12, side * inner);
      return [
        [x - halfThickness, y, a],
        [x - halfThickness, y, b],
        [x + halfThickness, y, b],
        [x + halfThickness, y, a],
      ];
    };
    loft(o, 'stone', [ring(bottom, 1.9, 5.6), ring(top, 3.15, 2.8)], stone);
    box(
      o,
      'stone',
      [x - 3.25, top - 0.05, Math.min(side * 12.1, side * 2.65)],
      [x + 3.25, top + 0.12, Math.max(side * 12.1, side * 2.65)],
      stone,
    );
    if (detail) {
      // Shallow cladding joints on the two broad faces, following the actual tapered opening.
      for (let y = 0.1, row = 0; y < top - 0.1; y += 0.82, row++) {
        const u = (y - bottom) / (top - bottom),
          thickness = 1.9 + 1.25 * u,
          inner = 5.6 - 2.8 * u,
          z0 = Math.min(side * 12, side * inner),
          z1 = Math.max(side * 12, side * inner);
        for (const face of [-1, 1]) {
          const X = x + face * (thickness + 0.006);
          o.addQuad(
            'stone',
            'palette:#ffffff',
            [
              [X, y - 0.008, z0],
              [X, y - 0.008, z1],
              [X, y + 0.008, z1],
              [X, y + 0.008, z0],
            ],
            [face, 0, 0],
            [],
            stoneJoint,
          );
          for (let z = z0 + (row % 2 ? 0.65 : 1.3); z < z1 - 0.2; z += 1.3) {
            const ya = y - 0.78,
              yb = y - 0.02,
              ua = (ya - bottom) / (top - bottom),
              ub = (yb - bottom) / (top - bottom);
            const za = Math.max(z0 + 0.05, Math.min(z1 - 0.05, z));
            o.addQuad(
              'stone',
              'palette:#ffffff',
              [
                [x + face * (1.9 + 1.25 * ua + 0.007), ya, za - 0.009],
                [x + face * (1.9 + 1.25 * ua + 0.007), ya, za + 0.009],
                [x + face * (1.9 + 1.25 * ub + 0.007), yb, za + 0.009],
                [x + face * (1.9 + 1.25 * ub + 0.007), yb, za - 0.009],
              ],
              [face, 0, 0],
              [],
              stoneJoint,
            );
          }
        }
      }
    }
  }
}
function lamp(o, x, side, segments) {
  const z = side * (C.halfWidth - 0.45),
    y = gariglianoDeckY(x) + C.walkRise;
  const path = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    return [x, y + C.lampHeight * t, z - side * (0.45 * t + 2.5 * Math.pow(t, 3))];
  });
  beamPath(o, 'metal', path, 0.13, 0.13, green);
  const p = path.at(-1);
  box(
    o,
    'metal',
    [p[0] - 0.16, p[1] - 0.06, p[2] - 0.47],
    [p[0] + 0.16, p[1] + 0.06, p[2] + 0.47],
    lampDark,
  );
}
export function buildGariglianoLevel(target, level = 'master') {
  const q = levels[level];
  if (!q) throw Error('Unknown Garigliano level ' + level);
  const o = writer(target, level === 'skyline'),
    xs = cuts(q.sections),
    L = C.halfLength,
    W = C.halfWidth,
    R = C.roadHalfWidth;
  slab(o, 'road', xs, -R, R, gariglianoDeckY, (x) => gariglianoDeckY(x) - 0.26, asphalt);
  for (const side of [-1, 1]) {
    const z0 = Math.min(side * R, side * W),
      z1 = Math.max(side * R, side * W);
    slab(
      o,
      'road',
      xs,
      z0,
      z1,
      (x) => gariglianoDeckY(x) + C.walkRise,
      (x) => gariglianoDeckY(x) - 0.4,
      paving,
    );
    slab(
      o,
      'stone',
      xs,
      Math.min(side * (R - 0.12), side * (R + 0.12)),
      Math.max(side * (R - 0.12), side * (R + 0.12)),
      (x) => gariglianoDeckY(x) + C.walkRise + 0.015,
      (x) => gariglianoDeckY(x) - 0.12,
      stone,
    );
  }
  const girders = level === 'skyline' ? [-11.8, 11.8] : [-11.8, -7.1, -2.4, 2.4, 7.1, 11.8];
  for (const z of girders) {
    const width = Math.abs(z) > 11 ? 0.28 : 0.18;
    slab(
      o,
      'metal',
      xs,
      z - width / 2,
      z + width / 2,
      (x) => gariglianoDeckY(x) - 0.27,
      gariglianoGirderBottom,
      green,
    );
    slab(
      o,
      'metal',
      xs,
      z - 0.45,
      z + 0.45,
      (x) => gariglianoGirderBottom(x) + 0.1,
      (x) => gariglianoGirderBottom(x) - 0.06,
      darkGreen,
    );
  }
  if (q.ribs)
    for (let i = 0; i <= q.ribs; i++) {
      const x = -L + (2 * L * i) / q.ribs,
        y = gariglianoDeckY(x) - 0.5;
      beam(o, 'metal', [x, y, -11.8], [x, y, 11.8], 0.15, 0.35, darkGreen);
      if (q.braces && i < q.ribs) {
        const b = -L + (2 * L * (i + 1)) / q.ribs;
        for (const side of [-1, 1])
          beam(
            o,
            'metal',
            [x, y - 0.25, side * 2.4],
            [b, gariglianoDeckY(b) - 0.75, side * 11.8],
            0.065,
            0.065,
            darkGreen,
          );
      }
    }
  for (const x of C.pierStations) pier(o, x, q.joints);
  // End bearings and abutment faces belong to the crossing, unlike the independent quays.
  for (const side of [-1, 1]) {
    const x = side * (L - 1.2),
      top = gariglianoDeckY(x) - 1.1;
    box(o, 'stone', [x - 1.2, 3.1, -12.6], [x + 1.2, top, 12.6], stone);
    box(o, 'metal', [x - 0.6, top, -11.9], [x + 0.6, top + 0.45, 11.9], lampDark);
  }
  for (const side of [-1, 1]) {
    const z = side * (W - 0.12),
      ys = (x) => gariglianoDeckY(x) + C.walkRise;
    if (!q.bars) {
      slab(
        o,
        'metal',
        xs,
        z - 0.045,
        z + 0.045,
        (x) => ys(x) + C.railingHeight,
        (x) => ys(x) + 0.08,
        green,
      );
    } else {
      const n = Math.ceil((2 * L) / q.bars);
      for (let i = 0; i <= n; i++) {
        const x = -L + (2 * L * i) / n,
          y = ys(x);
        beam(o, 'metal', [x, y + 0.04, z], [x, y + C.railingHeight, z], 0.045, 0.07, green);
      }
      for (const raise of [0.08, C.railingHeight])
        beamPath(
          o,
          'metal',
          xs.map((x) => [x, ys(x) + raise, z]),
          0.08,
          0.1,
          green,
        );
    }
    if (q.lamps) for (const x of C.lampStations) lamp(o, x, side, q.lamps);
  }
  if (level !== 'skyline') {
    // The photographed six-lane road: one center line and four broken lane dividers.
    slab(
      o,
      'road',
      xs,
      -0.045,
      0.045,
      (x) => gariglianoDeckY(x) + 0.008,
      (x) => gariglianoDeckY(x) + 0.003,
      marking,
    );
    for (const z of [-6.05, -3.05, 3.05, 6.05])
      for (let x = -L + 2; x < L - 2; x += 10) {
        const b = Math.min(L - 1, x + 3.5);
        slab(
          o,
          'road',
          [x, b],
          z - 0.055,
          z + 0.055,
          (v) => gariglianoDeckY(v) + 0.01,
          (v) => gariglianoDeckY(v) + 0.004,
          marking,
        );
      }
  }
  buildGariglianoLandings(target, level);
}
export const buildGariglianoSkyline = (o) => buildGariglianoLevel(o, 'skyline');
export const buildGariglianoDistrict = (o) => buildGariglianoLevel(o, 'district');
export const buildGariglianoStreet = (o) => buildGariglianoLevel(o, 'street');
export const buildGariglianoCloseup = (o) => buildGariglianoLevel(o, 'closeup');

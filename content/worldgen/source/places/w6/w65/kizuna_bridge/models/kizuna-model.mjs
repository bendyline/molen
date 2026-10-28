/** Kizuna: curved western approach and continuous haunched concrete river box girder. */
import {
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import controls from './kizuna-controls.json' with { type: 'json' };
export const kizunaControls = controls;
export const kizunaSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
};
const C = kizunaControls;
function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return points.at(-1)[1];
}
export const kizunaDeckY = (x) => interpolate(C.deckProfile, x);
export const kizunaCenterZ = (x) => interpolate(C.spine, x);
export function kizunaBoxDepth(x) {
  return (
    2 +
    4.5 * Math.pow(Math.max(0, 1 - Math.min(...C.mainPiers.map((p) => Math.abs(x - p))) / 60), 2)
  );
}
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('c5c3b4'),
  shade: linear('aea99a'),
  road: linear('77807c'),
  rail: linear('dfdbcb'),
  line: linear('e0dcca'),
  dark: linear('505b56'),
  waterline: linear('a89d83'),
};
const configs = {
  skyline: { far: true, step: 120, post: 0, rails: 0, piles: 0, detail: false },
  district: { step: 60, post: 32, rails: 1, piles: 0, detail: false },
  street: { step: 20, post: 8, rails: 2, piles: 6, detail: false },
  closeup: { step: 10, post: 3, rails: 2, piles: 8, detail: true },
  master: { step: 8, post: 2.5, rails: 2, piles: 12, detail: true },
};
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]];
      if (hint && normalFor(...t).reduce((s, v, j) => s + v * hint[j], 0) < 0)
        t = [t[0], t[2], t[1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
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
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
const b = (o, slot, x0, x1, y0, y1, z0, z1, c) => box(o, slot, [x0, y0, z0], [x1, y1, z1], c);
const rect = (x, y, z, dx, dz) => [
  [x - dx / 2, y, z - dz / 2],
  [x - dx / 2, y, z + dz / 2],
  [x + dx / 2, y, z + dz / 2],
  [x + dx / 2, y, z - dz / 2],
];
function strip(o, slot, xs, lo, hi, z0, z1, c) {
  loft(
    o,
    slot,
    xs.map((x) => {
      const y = kizunaDeckY(x),
        z = kizunaCenterZ(x);
      return [
        [x, y + lo, z + z0],
        [x, y + hi, z + z0],
        [x, y + hi, z + z1],
        [x, y + lo, z + z1],
      ];
    }),
    c,
  );
}
function cylinder(o, x, z, y0, y1, r, sides) {
  const ring = (y) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i / sides) * Math.PI * 2;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    });
  loft(o, 'concrete', [ring(y0), ring(y1)], color.waterline);
}
function platformRing(x, y, z) {
  return [
    [x - 4, y, z - 6],
    [x - 3, y, z - 8],
    [x + 3, y, z - 8],
    [x + 4, y, z - 6],
    [x + 4, y, z + 6],
    [x + 3, y, z + 8],
    [x - 3, y, z + 8],
    [x - 4, y, z + 6],
  ].reverse();
}
function pier(o, p, cfg) {
  const y = kizunaDeckY(p.x),
    depth = cfg.far ? 2 : kizunaBoxDepth(p.x),
    base = Math.min(p.baseY, y - depth - 4);
  if (cfg.far) {
    loft(
      o,
      'concrete',
      [rect(p.x, base, p.z, 3.8, 7), rect(p.x, y - depth, p.z, 3.8, 7)],
      color.shade,
    );
    return;
  }
  loft(
    o,
    'concrete',
    [
      rect(p.x, base, p.z, 4.5, 7.6),
      rect(p.x, y - depth - 1.8, p.z, 3.6, 6.4),
      rect(p.x, y - depth + 0.05, p.z, 4.4, 9),
    ],
    color.concrete,
  );
  if (p.main) {
    loft(o, 'concrete', [platformRing(p.x, 0.1, p.z), platformRing(p.x, 2.7, p.z)], color.shade);
    if (cfg.piles)
      for (const side of [-1, 1])
        for (const dz of [-5.4, -1.8, 1.8, 5.4])
          cylinder(o, p.x + side * 2.6, p.z + dz, -2, 0.4, 0.72, cfg.piles);
  }
  if (cfg.detail) {
    b(
      o,
      'metal',
      p.x - 1.5,
      p.x + 1.5,
      y - depth - 0.14,
      y - depth + 0.12,
      p.z - 3.3,
      p.z + 3.3,
      color.dark,
    );
    for (const side of [-1, 1])
      b(
        o,
        'concrete',
        p.x - 2.8,
        p.x + 2.8,
        y - depth - 2.1,
        y - depth - 1.8,
        p.z + side * 3.8 - 0.15,
        p.z + side * 3.8 + 0.15,
        color.shade,
      );
  }
}
export function buildKizunaLevel(target, level) {
  const cfg = configs[level];
  if (!cfg) throw Error(`Unknown Kizuna level ${level}`);
  const o = writer(target, cfg.far),
    [A, B] = C.ends,
    steps = Math.ceil((B[0] - A[0]) / cfg.step),
    deckXs = [
      ...new Set([...C.planKnots.map((p) => p[0]), ...C.deckProfile.map((p) => p[0])]),
    ].sort((a, b) => a - b),
    xs = [
      ...new Set([
        ...deckXs,
        ...C.piers.map((p) => p.x),
        ...C.mainPiers.slice(0, -1).map((x) => x + 60),
        ...Array.from({ length: steps + 1 }, (_, i) => A[0] + (i / steps) * (B[0] - A[0])),
      ]),
    ].sort((a, b) => a - b);
  if (cfg.far) strip(o, 'road', xs, -2, 0, -6.75, 6.75, color.road);
  else {
    loft(
      o,
      'concrete',
      xs.map((x) => {
        const y = kizunaDeckY(x),
          z = kizunaCenterZ(x);
        return [
          [x, y - kizunaBoxDepth(x), z - 4.1],
          [x, y - 0.18, z - 6.75],
          [x, y - 0.18, z + 6.75],
          [x, y - kizunaBoxDepth(x), z + 4.1],
        ];
      }),
      color.concrete,
    );
    strip(o, 'road', deckXs, -0.18, 0, -6.75, 6.75, color.road);
    for (const side of [-1, 1])
      strip(
        o,
        'concrete',
        deckXs,
        0,
        0.2,
        side < 0 ? -6.75 : 5.15,
        side < 0 ? -5.15 : 6.75,
        color.concrete,
      );
    for (const side of [-1, 1]) {
      for (let k = 0; k < cfg.rails; k++)
        strip(
          o,
          'concrete',
          deckXs,
          0.55 + k * 0.42,
          0.7 + k * 0.42,
          side * 6.52 - 0.09,
          side * 6.52 + 0.09,
          color.rail,
        );
      for (let x = A[0] + 1.5; x < B[0] - 1; x += cfg.post) {
        const y = kizunaDeckY(x),
          z = kizunaCenterZ(x) + side * 6.52;
        b(o, 'concrete', x - 0.12, x + 0.12, y + 0.2, y + 1.2, z - 0.12, z + 0.12, color.rail);
        if (cfg.detail && Math.round((x - A[0]) / cfg.post) % 4 === 0)
          b(
            o,
            'metal',
            x - 0.095,
            x + 0.095,
            y + 0.65,
            y + 0.82,
            z + side * 0.125 - 0.015,
            z + side * 0.125 + 0.015,
            color.dark,
          );
      }
    }
  }
  for (const p of C.piers) pier(o, p, cfg);
  for (const end of C.ends)
    strip(o, 'road', [end[0] - 7, end[0], end[0] + 7], -0.22, 0, -8.1, 8.1, color.road);
  if (!cfg.far) {
    strip(o, 'road', deckXs, 0.012, 0.022, -0.07, 0.07, color.line);
    for (const z of [-4.9, 4.9])
      strip(o, 'road', deckXs, 0.012, 0.022, z - 0.055, z + 0.055, color.line);
  }
  if (cfg.detail) {
    for (const p of C.piers) {
      const x = p.x + 5,
        y = kizunaDeckY(x),
        z = kizunaCenterZ(x);
      b(o, 'metal', x - 0.04, x + 0.04, y + 0.005, y + 0.025, z - 5.1, z + 5.1, color.dark);
    }
    for (let x = A[0] + 15; x < B[0] - 10; x += 30)
      for (const side of [-1, 1]) {
        const y = kizunaDeckY(x),
          z = kizunaCenterZ(x) + side * 5.95;
        b(o, 'metal', x - 0.22, x + 0.22, y + 0.202, y + 0.22, z - 0.14, z + 0.14, color.dark);
      }
  }
}
export const buildKizunaSkyline = (b) => buildKizunaLevel(b, 'skyline');
export const buildKizunaDistrict = (b) => buildKizunaLevel(b, 'district');
export const buildKizunaStreet = (b) => buildKizunaLevel(b, 'street');
export const buildKizunaCloseup = (b) => buildKizunaLevel(b, 'closeup');

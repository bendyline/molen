/** Rosario–Victoria: complete curved viaduct and twin H-pylon river section. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import controls from './rosario-controls.json' with { type: 'json' };

export const rosarioControls = controls;
export const rosarioSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.35 },
};
const C = rosarioControls;
function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return points.at(-1)[1];
}
export const rosarioCenterZ = (x) => interpolate(C.spine, x);
export const rosarioDeckY = (x) => interpolate(C.deckProfile, x);
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  concrete: linear('c4c2b6'),
  shade: linear('a8aca3'),
  road: linear('747b77'),
  cable: linear('e4e0c6'),
  sleeve: linear('f0eee0'),
  metal: linear('8a918c'),
  line: linear('e0dfc9'),
  dark: linear('555f5d'),
};
const configs = {
  skyline: { far: true, piers: 4, stays: 2, barrier: false, lights: 0, marking: 0, footing: false },
  district: { piers: 1, stays: 5, barrier: true, lights: 0, marking: 0, footing: false },
  street: { piers: 1, stays: 12, barrier: true, lights: 90, marking: 40, footing: true },
  closeup: { piers: 1, stays: 24, barrier: true, lights: 45, marking: 16, footing: true },
  master: { piers: 1, stays: 28, barrier: true, lights: 45, marking: 16, footing: true },
};
function writer(target, far) {
  function emit(slot, _ref, points, hint, _uv, tint) {
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]];
      if (hint && normalFor(...t).reduce((sum, v, j) => sum + v * hint[j], 0) < 0)
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
  return Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((key) => [key, emit]),
  );
}
function section(x, lo, hi, z0, z1) {
  const y = rosarioDeckY(x),
    z = rosarioCenterZ(x);
  // Clockwise viewed along +X: outward loft sides with increasing-X rings.
  return [
    [x, y + lo, z + z0],
    [x, y + hi, z + z0],
    [x, y + hi, z + z1],
    [x, y + lo, z + z1],
  ];
}
function strip(o, slot, xs, lo, hi, z0, z1, color) {
  loft(
    o,
    slot,
    xs.map((x) => section(x, lo, hi, z0, z1)),
    color,
  );
}
const b = (o, slot, x0, x1, y0, y1, z0, z1, color) =>
  box(o, slot, [x0, y0, z0], [x1, y1, z1], color);
function column(o, x, z, y0, y1, dx0, dz0, dx1, dz1, color, slot = 'concrete') {
  const ring = (y, dx, dz) => [
    [x - dx / 2, y, z - dz / 2],
    [x - dx / 2, y, z + dz / 2],
    [x + dx / 2, y, z + dz / 2],
    [x + dx / 2, y, z - dz / 2],
  ];
  loft(o, slot, [ring(y0, dx0, dz0), ring(y1, dx1, dz1)], color);
}
function pylon(o, x, cfg) {
  const deck = rosarioDeckY(x),
    z = rosarioCenterZ(x),
    base = 0.1;
  for (const side of [-1, 1]) {
    const ring = (y, center, width, depth) => [
      [x - width / 2, y, center - depth / 2],
      [x - width / 2, y, center + depth / 2],
      [x + width / 2, y, center + depth / 2],
      [x + width / 2, y, center - depth / 2],
    ];
    loft(
      o,
      'concrete',
      [
        ring(base, z + side * 13.8, 6.1, 4.3),
        ring(deck, z + side * 12.5, 5.4, 3.6),
        ring(deck + 75, z + side * 10.5, 3.4, 2.6),
      ],
      colors.concrete,
    );
    if (cfg.footing) {
      b(
        o,
        'concrete',
        x - 5.8,
        x + 5.8,
        -1.3,
        3.4,
        z + side * 13.8 - 4.6,
        z + side * 13.8 + 4.6,
        colors.shade,
      );
      for (const dx of [-7.3, 7.3])
        column(o, x + dx, z + side * 15, -1, 4.2, 1.7, 1.7, 1.7, 1.7, colors.shade);
    }
  }
  b(o, 'concrete', x - 3.6, x + 3.6, deck - 7.5, deck - 4.8, z - 14.8, z + 14.8, colors.shade);
  // Shallow hourglass upper crossbeam; broad ends are visibly distinct from a flat lintel.
  const crossRing = (zz, bottom, top) => [
    [x - 2.5, bottom, zz],
    [x + 2.5, bottom, zz],
    [x + 2.5, top, zz],
    [x - 2.5, top, zz],
  ];
  loft(
    o,
    'concrete',
    [
      crossRing(z - 11.3, deck + 43.5, deck + 51.5),
      crossRing(z, deck + 46, deck + 49),
      crossRing(z + 11.3, deck + 43.5, deck + 51.5),
    ],
    colors.concrete,
  );
  for (const direction of [-1, 1]) {
    const reach = direction < 0 ? (x === C.pylons[0] ? 123 : 164) : x === C.pylons[1] ? 123 : 164;
    for (let i = 1; i <= cfg.stays; i++) {
      const t = i / cfg.stays,
        ax = x + direction * (16 + t * (reach - 16));
      for (const side of [-1, 1]) {
        const a = [ax, rosarioDeckY(ax) + (cfg.far ? 0 : 0.8), rosarioCenterZ(ax) + side * 10.05];
        const h = 42 + t * 30,
          end = [x + direction * 1.6, deck + h, z + side * (12.5 - (h / 75) * 2)];
        beam(o, 'metal', a, end, cfg.far ? 1 : 0.26, cfg.far ? 1 : 0.26, colors.cable);
        if (cfg.footing) {
          const distance = Math.hypot(...end.map((v, j) => v - a[j])),
            sleeve = a.map((v, j) => v + ((end[j] - v) * 4.2) / distance);
          beam(o, 'metal', a, sleeve, 0.43, 0.43, colors.sleeve);
        }
      }
    }
  }
}
function pier(o, p, cfg) {
  const y = rosarioDeckY(p.x),
    bottom = Math.min(p.baseY, y - 5);
  if (cfg === configs.district) {
    column(o, p.x, p.z, bottom, y - 2, 2.9, 8, 2.9, 8, colors.shade);
    return;
  }
  if (!cfg.far) column(o, p.x, p.z, bottom, y - 4, 2.9, 7.4, 2.1, 7.4, colors.shade);
  else column(o, p.x, p.z, bottom, y - 2, 2.8, 8, 2.8, 8, colors.shade);
  if (cfg.far) return;
  column(o, p.x, p.z, y - 4, y - 2.35, 2.1, 7.4, 3.1, 19.9, colors.concrete);
  b(o, 'concrete', p.x - 1.65, p.x + 1.65, y - 2.35, y - 2.05, p.z - 10, p.z + 10, colors.concrete);
  if (cfg.footing)
    for (const side of [-1, 1])
      b(
        o,
        'metal',
        p.x - 0.85,
        p.x + 0.85,
        y - 2.05,
        y - 1.8,
        p.z + side * 6.2 - 1.2,
        p.z + side * 6.2 + 1.2,
        colors.dark,
      );
}
export function buildRosarioLevel(target, level) {
  const cfg = configs[level];
  if (!cfg) throw new Error(`Unknown Rosario level: ${level}`);
  const o = writer(target, cfg.far),
    stride = cfg.far ? 7 : cfg === configs.district ? 3 : 1;
  const xs = [
    ...new Set([
      ...C.spine.filter((_, i) => i % stride === 0).map((p) => p[0]),
      ...C.deckProfile.map((p) => p[0]),
    ]),
  ].sort((a, b) => a - b);
  // Whole curved bridge body, also present in the skyline mesh.
  if (cfg.far) strip(o, 'road', xs, -2, 0, -10.65, 10.65, colors.road);
  else {
    strip(o, 'concrete', xs, -2, -0.15, -10.65, 10.65, colors.concrete);
    strip(o, 'road', xs, -0.15, 0, -10.65, 10.65, colors.road);
  }
  if (cfg.barrier)
    for (const z of [-10.3, 0, 10.3])
      strip(o, 'concrete', xs, 0, 0.95, z - 0.28, z + 0.28, colors.concrete);
  for (const [index, end] of C.ends.entries()) {
    const sign = index ? 1 : -1,
      x = end[0],
      outer = x + sign * C.landings.length;
    const ring = (xx, w) => section(xx, -0.3, 0, -w, w);
    const inner = x - sign * C.landings.length;
    const rings = index
      ? [
          ring(inner, 10.65),
          ring(x - 2, C.landings.outerHalfWidth),
          ring(outer, C.landings.outerHalfWidth),
        ]
      : [
          ring(outer, C.landings.outerHalfWidth),
          ring(x + 4, C.landings.outerHalfWidth),
          ring(inner, 10.65),
        ];
    loft(o, 'road', rings, colors.road);
  }
  C.piers.forEach((p, i) => {
    if (i % cfg.piers === 0 || i === C.piers.length - 1) pier(o, p, cfg);
  });
  for (const x of C.pylons) pylon(o, x, cfg);
  if (cfg.lights)
    for (let x = C.ends[0][0] + 18; x < C.ends[1][0] - 12; x += cfg.lights) {
      const y = rosarioDeckY(x),
        z = rosarioCenterZ(x);
      beam(o, 'metal', [x, y + 0.95, z], [x, y + 12, z], 0.15, 0.15, colors.metal);
      beam(o, 'metal', [x, y + 12, z - 2.5], [x, y + 12, z + 2.5], 0.16, 0.16, colors.metal);
      for (const sign of [-1, 1])
        b(
          o,
          'metal',
          x - 0.65,
          x + 0.65,
          y + 11.9,
          y + 12.12,
          z + sign * 2.5 - 0.3,
          z + sign * 2.5 + 0.3,
          colors.dark,
        );
    }
  if (cfg.marking) {
    for (let x = C.ends[0][0] + 5; x < C.ends[1][0] - 5; x += cfg.marking)
      for (const z of [-5.2, 5.2])
        strip(o, 'road', [x, x + 5], 0.012, 0.022, z - 0.07, z + 0.07, colors.line);
    for (const z of [-9.75, -0.85, 0.85, 9.75])
      strip(o, 'road', xs, 0.012, 0.022, z - 0.065, z + 0.065, colors.line);
  }
}
export const buildRosarioSkyline = (b) => buildRosarioLevel(b, 'skyline');
export const buildRosarioDistrict = (b) => buildRosarioLevel(b, 'district');
export const buildRosarioStreet = (b) => buildRosarioLevel(b, 'street');
export const buildRosarioCloseup = (b) => buildRosarioLevel(b, 'closeup');

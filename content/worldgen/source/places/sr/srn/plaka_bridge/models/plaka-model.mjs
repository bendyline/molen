/** Original present-day Plaka Bridge, reconstructed from ordinary views and mapped plan. */
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const plakaControls = {
  west: -38.44,
  east: 38.44,
  halfWidth: 2.1425,
  walkHalfWidth: 1.65,
  deckEnds: [11.44, 5.8],
  main: { c: -4, rx: 20, rise: 18.1, spring: 0.3 },
  reliefs: [
    { c: -32.4, rx: 3.1, rise: 3.4, spring: 1.1 },
    { c: 29.4, rx: 3.4, rise: 3.8, spring: 1.1 },
  ],
  archRings: [0.58, 1.15],
  parapet: 0.86,
};
export const plakaSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94 },
  walk: { slot: 'roof', graph: 'stone_granite', roughness: 0.95 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
  joint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1 },
};
const C = plakaControls,
  linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  color = {
    wall: linear('a7a498'),
    stone: linear('b2b2a5'),
    walk: linear('a4a596'),
    cap: linear('c5c5b8'),
    iron: linear('6b6c62'),
    joint: linear('c4c3b5'),
  },
  tiers = {
    skyline: {
      main: 8,
      relief: 3,
      deck: 8,
      rings: 0,
      barrel: 0,
      masonry: 0,
      copes: 0,
      ties: 0,
      steps: 0,
    },
    district: {
      main: 16,
      relief: 6,
      deck: 16,
      rings: 1,
      barrel: 0,
      masonry: 0,
      copes: 0,
      ties: 0,
      steps: 0,
    },
    street: {
      main: 32,
      relief: 10,
      deck: 32,
      rings: 2,
      barrel: 1,
      masonry: 0,
      copes: 1.2,
      ties: 6,
      steps: 1.5,
    },
    closeup: {
      main: 64,
      relief: 20,
      deck: 64,
      rings: 2,
      barrel: 4,
      masonry: 1.1,
      copes: 0.7,
      ties: 10,
      steps: 0.55,
    },
    master: {
      main: 128,
      relief: 40,
      deck: 128,
      rings: 2,
      barrel: 10,
      masonry: 0.68,
      copes: 0.43,
      ties: 12,
      steps: 0.3,
    },
  };
const archY = (a, x) => a.spring + a.rise * Math.sqrt(Math.max(0, 1 - ((x - a.c) / a.rx) ** 2));
export const plakaIntrados = (x) => {
  for (const a of [C.main, ...C.reliefs]) if (Math.abs(x - a.c) <= a.rx) return archY(a, x);
  return undefined;
};
export const plakaDeckY = (x) => {
  const a = C.main,
    center = a.spring + a.rise + 1.85,
    negative = x < a.c,
    extent = negative ? a.c - C.west : C.east - a.c,
    end = C.deckEnds[negative ? 0 : 1],
    u = Math.min(1, Math.abs(x - a.c) / extent),
    ramp = center + (end - center) * u,
    arch = Math.abs(x - a.c) <= a.rx ? archY(a, x) + 1.85 : -100;
  return Math.max(ramp, arch);
};
function writer(target, far) {
  return Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, col) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]],
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          const major = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
            axes = major === 0 ? [2, 1] : major === 1 ? [0, 2] : [0, 1];
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((q) => axes.map((k) => q[k])),
            col,
          );
        }
      },
    ]),
  );
}
const Q = (o, slot, p, n, col) => o.addQuad(slot, 'palette:#ffffff', p, n, null, col);
function slab(o, slot, xs, z0, z1, lo, hi, col) {
  loft(
    o,
    slot,
    xs.map((x) => [
      [x, lo(x), z0],
      [x, hi(x), z0],
      [x, hi(x), z1],
      [x, lo(x), z1],
    ]),
    col,
  );
}
function arch(o, a, S) {
  const n = a === C.main ? S.main : S.relief,
    pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = Math.PI - (Math.PI * i) / n;
      return [a.c + a.rx * Math.cos(t), a.spring + a.rise * Math.sin(t), t];
    });
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    for (const side of [-1, 1]) {
      const z = side * C.halfWidth;
      Q(
        o,
        'wall',
        [
          [p[0], p[1], z],
          [q[0], q[1], z],
          [q[0], plakaDeckY(q[0]), z],
          [p[0], plakaDeckY(p[0]), z],
        ],
        [0, 0, side],
        color.wall,
      );
      for (let band = 0; band < S.rings; band++) {
        const r0 = band ? C.archRings[0] : 0,
          r1 = S.rings === 1 ? C.archRings[1] : C.archRings[band],
          gap = S.rings === 2 ? 0.003 : 0,
          v = (t, r) => [
            a.c + (a.rx + r) * Math.cos(t),
            a.spring + (a.rise + r) * Math.sin(t),
            z + side * (0.055 + band * 0.006),
          ];
        Q(
          o,
          'stone',
          [v(p[2] - gap, r0), v(q[2] + gap, r0), v(q[2] + gap, r1), v(p[2] - gap, r1)],
          [0, 0, side],
          i % 7 ? color.stone : color.cap,
        );
      }
    }
    Q(
      o,
      'stone',
      [
        [p[0], p[1], -C.halfWidth],
        [q[0], q[1], -C.halfWidth],
        [q[0], q[1], C.halfWidth],
        [p[0], p[1], C.halfWidth],
      ],
      [0, -1, 0],
      color.wall,
    );
    for (let j = 0; j < S.barrel; j++) {
      const z0 = -C.halfWidth + (2 * C.halfWidth * j) / S.barrel,
        z1 = -C.halfWidth + (2 * C.halfWidth * (j + 1)) / S.barrel - 0.012;
      Q(
        o,
        'stone',
        [
          [p[0], p[1] - 0.006, z0],
          [q[0], q[1] - 0.006, z0],
          [q[0], q[1] - 0.006, z1],
          [p[0], p[1] - 0.006, z1],
        ],
        [0, -1, 0],
        (i + j) % 9 ? color.stone : color.wall,
      );
    }
  }
}
function masonry(o, S) {
  if (!S.masonry) return;
  const step = S.masonry,
    rowHeight = 0.32;
  for (let row = 0; row < 64; row++) {
    const y = -0.4 + row * rowHeight;
    for (let x = C.west - 1 + (row % 2) * step * 0.47; x < C.east; x += step) {
      const a = Math.max(C.west, x + 0.015),
        b = Math.min(C.east, x + step - 0.015),
        mid = (a + b) / 2;
      if (b - a < 0.12) continue;
      const lower = Math.max(...[a, mid, b].map((x) => plakaIntrados(x) ?? -0.65));
      if (y < lower + 0.035 || y + rowHeight > Math.min(plakaDeckY(a), plakaDeckY(b)) - 0.17)
        continue;
      const tint = 1 + (((((row * 53 + Math.round(x * 10) * 17) % 11) + 11) % 11) - 5) * 0.009,
        col = color.wall.map((v) => v * tint);
      for (const side of [-1, 1]) {
        const z = side * (C.halfWidth + 0.025),
          p = [
            [a, y + 0.016, z],
            [b, y + 0.016, z],
            [b, y + rowHeight - 0.017, z],
            [a, y + rowHeight - 0.017, z],
          ];
        Q(o, 'wall', p, [0, 0, side], col);
        if (S.masonry < 1)
          box(
            o,
            'stone',
            [a, y + 0.01, side < 0 ? z - 0.012 : z - 0.025],
            [b, y + 0.025, side < 0 ? z + 0.025 : z + 0.012],
            color.joint,
          );
      }
    }
  }
}
function parapets(o, xs, S) {
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -C.halfWidth : C.walkHalfWidth,
      z1 = side < 0 ? -C.walkHalfWidth : C.halfWidth;
    slab(o, 'wall', xs, z0, z1, plakaDeckY, (x) => plakaDeckY(x) + C.parapet, color.wall);
    slab(
      o,
      'stone',
      xs,
      z0 - 0.035,
      z1 + 0.035,
      (x) => plakaDeckY(x) + C.parapet,
      (x) => plakaDeckY(x) + C.parapet + 0.12,
      color.cap,
    );
    if (S.copes)
      for (let x = C.west + 0.2; x < C.east; x += S.copes) {
        const y = plakaDeckY(x) + C.parapet;
        Q(
          o,
          'joint',
          [
            [x, y + 0.123, z0 - 0.036],
            [x + 0.018, plakaDeckY(x + 0.018) + C.parapet + 0.123, z0 - 0.036],
            [x + 0.018, plakaDeckY(x + 0.018) + C.parapet + 0.123, z1 + 0.036],
            [x, y + 0.123, z1 + 0.036],
          ],
          [0, 1, 0],
          color.joint,
        );
      }
    if (S.masonry)
      for (let x = C.west + 0.3; x < C.east; x += 1.4) {
        const y = plakaDeckY(x),
          z = side * (C.halfWidth + 0.028);
        Q(
          o,
          'stone',
          [
            [x - 0.035, y + 0.025, z],
            [x + 0.035, plakaDeckY(x + 0.035) + 0.025, z],
            [x + 0.035, plakaDeckY(x + 0.035) + 0.8, z],
            [x - 0.035, y + 0.8, z],
          ],
          [0, 0, side],
          color.stone,
        );
      }
  }
}
export function buildPlakaLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error(level);
  const o = writer(target, level === 'skyline'),
    arches = [...C.reliefs, C.main].sort((a, b) => a.c - b.c),
    xs = Array.from({ length: S.deck + 1 }, (_, i) => C.west + ((C.east - C.west) * i) / S.deck);
  for (const a of arches) arch(o, a, S);
  let last = C.west;
  for (const a of arches) {
    const start = a.c - a.rx;
    if (start > last)
      slab(
        o,
        'wall',
        [last, start],
        -C.halfWidth,
        C.halfWidth,
        () => -0.7,
        (x) => plakaDeckY(x),
        color.wall,
      );
    last = a.c + a.rx;
  }
  slab(
    o,
    'wall',
    [last, C.east],
    -C.halfWidth,
    C.halfWidth,
    () => -0.7,
    (x) => plakaDeckY(x),
    color.wall,
  );
  slab(
    o,
    'walk',
    xs,
    -C.walkHalfWidth,
    C.walkHalfWidth,
    (x) => plakaDeckY(x) - 0.13,
    plakaDeckY,
    color.walk,
  );
  parapets(o, xs, S);
  masonry(o, S);
  for (const [a, b, y] of [
    [C.west - 0.3, C.west, C.deckEnds[0]],
    [C.east, C.east + 0.3, C.deckEnds[1]],
  ])
    slab(
      o,
      'walk',
      [a, b],
      -C.walkHalfWidth,
      C.walkHalfWidth,
      () => y - 0.16,
      () => y,
      color.walk,
    );
  if (S.ties)
    for (let i = 1; i <= S.ties; i++) {
      const t = Math.PI - (Math.PI * i) / (S.ties + 1),
        x = C.main.c + (C.main.rx + 0.35) * Math.cos(t),
        y = C.main.spring + (C.main.rise + 0.35) * Math.sin(t);
      for (const side of [-1, 1]) {
        const z = side * (C.halfWidth + 0.08);
        beam(o, 'iron', [x - 0.28, y, z], [x + 0.28, y, z], 0.055, 0.06, color.iron);
        beam(o, 'iron', [x, y - 0.1, z], [x, y + 0.11, z], 0.045, 0.06, color.iron);
      }
    }
  if (S.steps)
    for (let x = C.west + 0.2; x < C.east - 0.1; x += S.steps) {
      const y = plakaDeckY(x);
      Q(
        o,
        'stone',
        [
          [x, y + 0.006, -C.walkHalfWidth],
          [x + 0.055, plakaDeckY(x + 0.055) + 0.006, -C.walkHalfWidth],
          [x + 0.055, plakaDeckY(x + 0.055) + 0.006, C.walkHalfWidth],
          [x, y + 0.006, C.walkHalfWidth],
        ],
        [0, 1, 0],
        color.stone,
      );
    }
}
export const buildPlakaSkyline = (o) => buildPlakaLevel(o, 'skyline');
export const buildPlakaDistrict = (o) => buildPlakaLevel(o, 'district');
export const buildPlakaStreet = (o) => buildPlakaLevel(o, 'street');
export const buildPlakaCloseup = (o) => buildPlakaLevel(o, 'closeup');

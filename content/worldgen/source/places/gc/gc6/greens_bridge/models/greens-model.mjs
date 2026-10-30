/** Original Green's Bridge: five main elliptical barrels, two eastern culverts and the asymmetric modern north walk. */
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const greensControls = {
  west: -38.71,
  east: 38.71,
  bodyNorth: -3.25,
  bodySouth: 3.85,
  northWalkEdge: -4.35,
  roadNorth: -2.0,
  roadSouth: 3.4,
  deckEnds: [4.75, 4.55],
  crown: 0.38,
  spring: 1.15,
  archThickness: 0.38,
  piers: [-26.5, -14.1, -1.1, 11.6],
  pierWidth: 1.8,
  spans: [
    [-37.4, -27.4, 2.8],
    [-25.6, -15, 3.05],
    [-13.2, -2, 3.2],
    [-0.2, 10.7, 3.05],
    [12.5, 22, 2.8],
  ],
  culverts: [
    [24.5, 29, 1.65],
    [31, 35.5, 1.65],
  ],
};
export const greensSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68 },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const C = greensControls,
  linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  col = {
    wall: linear('8d9188'),
    stone: linear('b4b6aa'),
    cap: linear('9fa496'),
    road: linear('535e5d'),
    concrete: linear('a8aaa0'),
    metal: linear('9ca99f'),
    yellow: linear('d7c277'),
    joint: linear('7e857c'),
  };
const tiers = {
  skyline: { arc: 4, deck: 4, dentils: 0, posts: 0, bars: 0, barrel: 0, panels: false },
  district: { arc: 10, deck: 12, dentils: 0, posts: 4, bars: 0, barrel: 0, panels: true },
  street: { arc: 24, deck: 32, dentils: 1.3, posts: 2, bars: 0.8, barrel: 1, panels: true },
  closeup: { arc: 48, deck: 64, dentils: 0.45, posts: 1.7, bars: 0.24, barrel: 5, panels: true },
  master: { arc: 72, deck: 96, dentils: 0.32, posts: 1.7, bars: 0.14, barrel: 10, panels: true },
};
export const greensDeckY = (x) => {
  const u = (x - C.west) / (C.east - C.west);
  return (
    C.deckEnds[0] +
    (C.deckEnds[1] - C.deckEnds[0]) * u +
    C.crown * Math.sin(Math.PI * Math.max(0, Math.min(1, u)))
  );
};
export function greensIntrados(x) {
  for (const [a, b, r] of [...C.spans, ...C.culverts])
    if (x >= a && x <= b) {
      const t = (x - (a + b) / 2) / ((b - a) / 2);
      return C.spring + r * Math.sqrt(Math.max(0, 1 - t * t));
    }
  return undefined;
}
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
const quad = (o, slot, p, n, color) => o.addQuad(slot, 'palette:#ffffff', p, n, [], color);
function slab(o, slot, xs, z0, z1, bottom, top, color) {
  loft(
    o,
    slot,
    xs.map((x) => [
      [x, bottom(x), z0],
      [x, top(x), z0],
      [x, top(x), z1],
      [x, bottom(x), z1],
    ]),
    color,
  );
}
function arch(o, [a, b, r], S) {
  const mid = (a + b) / 2,
    rx = (b - a) / 2,
    pts = Array.from({ length: S.arc + 1 }, (_, i) => {
      const t = Math.PI - (Math.PI * i) / S.arc;
      return [mid + rx * Math.cos(t), C.spring + r * Math.sin(t)];
    });
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    for (const [side, z] of [
      [-1, C.bodyNorth],
      [1, C.bodySouth],
    ]) {
      quad(
        o,
        'wall',
        [
          [p[0], p[1], z],
          [q[0], q[1], z],
          [q[0], greensDeckY(q[0]) - 0.16, z],
          [p[0], greensDeckY(p[0]) - 0.16, z],
        ],
        [0, 0, side],
        col.wall,
      );
      const gap = S.barrel ? 0.005 : 0,
        t0 = Math.PI - (Math.PI * (i - 1)) / S.arc - gap,
        t1 = Math.PI - (Math.PI * i) / S.arc + gap,
        th = C.archThickness + (i % 2 === 0 && S.panels ? 0.17 : 0),
        v = (t, outer) => [
          mid + (rx + (outer ? th : 0)) * Math.cos(t),
          C.spring + (r + (outer ? th : 0)) * Math.sin(t),
          z + side * (S.panels && i % 2 === 0 ? 0.08 : 0.02),
        ];
      quad(
        o,
        'stone',
        [v(t0, false), v(t1, false), v(t1, true), v(t0, true)],
        [0, 0, side],
        col.stone,
      );
    }
    quad(
      o,
      'stone',
      [
        [p[0], p[1], C.bodyNorth],
        [q[0], q[1], C.bodyNorth],
        [q[0], q[1], C.bodySouth],
        [p[0], p[1], C.bodySouth],
      ],
      [0, -1, 0],
      col.wall,
    );
    for (let j = 0; j < S.barrel; j++) {
      const za = C.bodyNorth + ((C.bodySouth - C.bodyNorth) * j) / S.barrel,
        zb = C.bodyNorth + ((C.bodySouth - C.bodyNorth) * (j + 1)) / S.barrel - 0.012;
      quad(
        o,
        'stone',
        [
          [p[0], p[1] - 0.003, za],
          [q[0], q[1] - 0.003, za],
          [q[0], q[1] - 0.003, zb],
          [p[0], p[1] - 0.003, zb],
        ],
        [0, -1, 0],
        (i + j) % 7 ? col.wall : col.stone,
      );
    }
  }
}
function noseRing(x, y, width, extension, round) {
  const r = width / 2,
    p = [
      [x - r, y, C.bodyNorth],
      [x, y, C.bodyNorth - extension],
      [x + r, y, C.bodyNorth],
      [x + r, y, C.bodySouth],
    ];
  if (round)
    for (let i = 1; i <= round; i++) {
      const a = (Math.PI * i) / round;
      p.push([x + r * Math.cos(a), y, C.bodySouth + extension * Math.sin(a)]);
    }
  else p.push([x, y, C.bodySouth + extension], [x - r, y, C.bodySouth]);
  return p.reverse();
}
function pier(o, x, S) {
  box(
    o,
    'wall',
    [x - C.pierWidth / 2, -0.8, C.bodyNorth],
    [x + C.pierWidth / 2, greensDeckY(x) - 0.15, C.bodySouth],
    col.wall,
  );
  const rings = [
    noseRing(x, -0.65, 2.12, 1.25, S.arc >= 10 ? 6 : 0),
    noseRing(x, 1.45, 2.12, 1.25, S.arc >= 10 ? 6 : 0),
  ];
  loft(o, 'stone', rings, col.wall);
  loft(
    o,
    'stone',
    [
      noseRing(x, 1.45, 2.24, 1.32, S.arc >= 10 ? 6 : 0),
      noseRing(x, 1.66, 2.24, 1.32, S.arc >= 10 ? 6 : 0),
    ],
    col.stone,
  );
  if (!S.panels) return;
  const z = C.bodySouth + 0.12,
    lo = 1.66,
    hi = greensDeckY(x) - 0.48;
  box(o, 'stone', [x - 0.72, lo, z], [x + 0.72, hi - 0.4, z + 0.12], col.stone);
  box(o, 'wall', [x - 0.48, lo + 0.23, z + 0.125], [x + 0.48, hi - 0.58, z + 0.17], col.wall);
  for (const sign of [-1, 1])
    box(
      o,
      'stone',
      [x + sign * 0.6 - 0.095, lo, z + 0.14],
      [x + sign * 0.6 + 0.095, hi - 0.27, z + 0.23],
      col.stone,
    );
  box(o, 'stone', [x - 0.84, hi - 0.42, z + 0.07], [x + 0.84, hi - 0.24, z + 0.27], col.stone);
  const pedY = hi - 0.22;
  loft(
    o,
    'stone',
    [
      [
        [x - 0.89, pedY, z + 0.06],
        [x + 0.89, pedY, z + 0.06],
        [x, pedY + 0.43, z + 0.06],
      ],
      [
        [x - 0.89, pedY, z + 0.31],
        [x + 0.89, pedY, z + 0.31],
        [x, pedY + 0.43, z + 0.31],
      ],
    ],
    col.stone,
  );
  if (S.barrel) {
    quad(
      o,
      'wall',
      [
        [x - 0.56, pedY + 0.06, z + 0.313],
        [x + 0.56, pedY + 0.06, z + 0.313],
        [x, pedY + 0.33, z + 0.313],
      ],
      [0, 0, 1],
      col.wall,
    );
  }
}
function guards(o, xs, S) {
  const near = S.posts > 0;
  for (const z of [-4.23, -2.03]) {
    for (const h of [0.5, 1.08])
      for (let i = 1; i < xs.length; i++)
        beam(
          o,
          'metal',
          [xs[i - 1], greensDeckY(xs[i - 1]) + 0.12 + h, z],
          [xs[i], greensDeckY(xs[i]) + 0.12 + h, z],
          0.055,
          0.055,
          col.metal,
        );
    if (near)
      for (let x = C.west + 0.2; x < C.east; x += S.posts)
        box(
          o,
          'concrete',
          [x - 0.055, greensDeckY(x) + 0.08, z - 0.06],
          [x + 0.055, greensDeckY(x) + 1.22, z + 0.06],
          col.concrete,
        );
    if (S.bars)
      for (let x = C.west + 0.3; x < C.east; x += S.bars)
        box(
          o,
          'metal',
          [x - 0.014, greensDeckY(x) + 0.2, z - 0.014],
          [x + 0.014, greensDeckY(x) + 1.02, z + 0.014],
          col.metal,
        );
  }
}
export function buildGreensLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error('Unknown Greens level ' + level);
  const far = level === 'skyline',
    o = writer(target, far),
    spans = [...C.spans, ...C.culverts],
    xs = Array.from({ length: S.deck + 1 }, (_, i) => C.west + ((C.east - C.west) * i) / S.deck);
  for (const s of spans) arch(o, s, S);
  for (const x of C.piers) pier(o, x, S);
  let prev = C.west;
  for (const [a, b] of spans) {
    if (a > prev)
      slab(
        o,
        'wall',
        [prev, a],
        C.bodyNorth,
        C.bodySouth,
        () => -0.8,
        (x) => greensDeckY(x) - 0.15,
        col.wall,
      );
    prev = b;
  }
  slab(
    o,
    'wall',
    [prev, C.east],
    C.bodyNorth,
    C.bodySouth,
    () => -0.8,
    (x) => greensDeckY(x) - 0.15,
    col.wall,
  );
  slab(
    o,
    'road',
    xs,
    C.bodyNorth,
    C.bodySouth,
    (x) => greensDeckY(x) - 0.17,
    greensDeckY,
    col.road,
  );
  slab(
    o,
    'concrete',
    xs,
    C.northWalkEdge,
    C.roadNorth,
    (x) => greensDeckY(x) - 0.3,
    (x) => greensDeckY(x) + 0.12,
    col.concrete,
  );
  slab(
    o,
    'stone',
    xs,
    C.roadSouth,
    C.bodySouth,
    (x) => greensDeckY(x) - 0.1,
    (x) => greensDeckY(x) + 0.93,
    col.wall,
  );
  slab(
    o,
    'stone',
    xs,
    C.roadSouth - 0.035,
    C.bodySouth + 0.09,
    (x) => greensDeckY(x) + 0.93,
    (x) => greensDeckY(x) + 1.02,
    col.cap,
  );
  if (!far) {
    slab(
      o,
      'stone',
      xs,
      C.bodySouth,
      C.bodySouth + 0.17,
      (x) => greensDeckY(x) - 0.45,
      (x) => greensDeckY(x) - 0.23,
      col.stone,
    );
    for (const x of C.piers)
      box(
        o,
        'concrete',
        [x - 0.35, greensDeckY(x) - 0.8, C.northWalkEdge],
        [x + 0.35, greensDeckY(x) - 0.2, C.bodyNorth + 0.1],
        col.concrete,
      );
    guards(o, xs, S);
  }
  if (S.dentils)
    for (let x = C.west + 0.2; x < C.east - 0.1; x += S.dentils)
      box(
        o,
        'stone',
        [x - 0.07, greensDeckY(x) - 0.63, C.bodySouth + 0.015],
        [x + 0.07, greensDeckY(x) - 0.43, C.bodySouth + 0.16],
        col.stone,
      );
  if (S.panels)
    for (const z of [-1.74, -1.63, 3.12, 3.23])
      slab(
        o,
        'mark',
        xs,
        z - 0.018,
        z + 0.018,
        greensDeckY,
        (x) => greensDeckY(x) + 0.005,
        col.yellow,
      );
  for (const side of [-1, 1]) {
    const x = side < 0 ? C.west : C.east,
      y = greensDeckY(x);
    slab(
      o,
      'road',
      [x, x + side * 0.7].sort((a, b) => a - b),
      -4.45,
      4.15,
      () => y - 0.17,
      () => y,
      col.road,
    );
  }
}
export const buildGreensSkyline = (o) => buildGreensLevel(o, 'skyline');
export const buildGreensDistrict = (o) => buildGreensLevel(o, 'district');
export const buildGreensStreet = (o) => buildGreensLevel(o, 'street');
export const buildGreensCloseup = (o) => buildGreensLevel(o, 'closeup');

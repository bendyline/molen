/** Richmond Bridge, London: five unequal arches, humpback deck and open stone balustrades. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const richmondControls = {
  originMeters: 2.0348180770874023,
  waterY: 0.6,
  halfLength: 70.949,
  width: 10.603,
  roadHalfWidth: 3.5,
  profile: [
    [-70.949, 3.9],
    [-55, 5.42],
    [-35, 6.42],
    [-17.5, 7.05],
    [0, 7.4],
    [17.5, 7.3],
    [35, 6.91],
    [55, 6.2],
    [70.949, 4.9],
  ],
  openings: [
    { lo: -63.5, hi: -42.5, spring: 0.65, rise: 3.05 },
    { lo: -38.7, hi: -17.5, spring: 0.75, rise: 4.05 },
    { lo: -13.7, hi: 13.7, spring: 0.85, rise: 5.15 },
    { lo: 17.5, hi: 38.7, spring: 0.75, rise: 4.05 },
    { lo: 42.5, hi: 63.5, spring: 0.65, rise: 3.05 },
  ],
  piers: [-40.6, -15.6, 15.6, 40.6],
};
export const richmondSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
  carved: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.25 },
  glass: {
    slot: 'window',
    localRef: 'palette:#e8eadb',
    roughness: 0.2,
    metallic: 0,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.48],
    doubleSided: true,
  },
};
const C = richmondControls,
  W = C.width / 2;
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  stone: linear('c8c4b8'),
  rim: linear('d7d1c1'),
  carved: linear('cfc9b9'),
  road: linear('656869'),
  walk: linear('b6b3a9'),
  iron: linear('3f4946'),
  glass: linear('d5ddd3'),
  mark: linear('ded6bb'),
};
const configs = {
  skyline: { far: true, curve: 3, rims: 0, head: 3, spacing: 0, sides: 0, profile: 0, lamp: 0 },
  district: { curve: 8, rims: 0, head: 4, spacing: 2, sides: 4, profile: 1, lamp: 1 },
  street: { curve: 20, rims: 14, head: 8, spacing: 1.05, sides: 4, profile: 3, lamp: 6 },
  closeup: { curve: 38, rims: 28, head: 16, spacing: 0.54, sides: 6, profile: 5, lamp: 10 },
  master: { curve: 64, rims: 48, head: 24, spacing: 0.54, sides: 12, profile: 9, lamp: 16 },
};
export function richmondDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, y] = C.profile[i - 1],
      [b, z] = C.profile[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (z - y);
  }
  return C.profile.at(-1)[1];
}
export const richmondWalkOffset = (x) =>
  0.16 * Math.max(0, Math.min(1, (C.halfLength - Math.abs(x)) / 3));
function deckFor(x, cfg) {
  if (!cfg.far) return richmondDeckY(x);
  const a = x < 0 ? C.profile[0] : [0, 7.4],
    b = x < 0 ? [0, 7.4] : C.profile.at(-1),
    t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
  return a[1] + t * (b[1] - a[1]);
}
export function richmondArchY(h, x) {
  const t = (2 * x - h.lo - h.hi) / (h.hi - h.lo);
  return h.spring + h.rise * Math.sqrt(Math.max(0, 1 - t * t));
}
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
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
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(o, slot, points, tint, hint) {
  o.addConvexPolygon(slot, 'palette:#ffffff', points, hint ?? normalFor(...points), null, tint);
}
function planPrism(o, slot, polygon, bottom, top, tint) {
  const high = polygon.map(([x, z]) => [x, typeof top === 'function' ? top(x, z) : top, z]);
  face(o, slot, high, tint, [0, 1, 0]);
  face(
    o,
    slot,
    polygon.map(([x, z]) => [x, bottom, z]),
    tint,
    [0, -1, 0],
  );
  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
    cz = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  for (let i = 0; i < high.length; i++) {
    const a = high[i],
      b = high[(i + 1) % high.length];
    face(o, slot, [[a[0], bottom, a[2]], [b[0], bottom, b[2]], b, a], tint, [
      (a[0] + b[0]) / 2 - cx,
      0,
      (a[2] + b[2]) / 2 - cz,
    ]);
  }
}
function slab(o, slot, a, b, z0, z1, offset, depth, tint, walk = false, cfg = configs.master) {
  const cuts = [
    ...new Set(
      [
        a,
        b,
        ...(cfg.far
          ? [-C.halfLength, 0, C.halfLength]
          : [...C.profile.map((p) => p[0]), -C.halfLength + 3, C.halfLength - 3]),
      ].filter((x) => x >= a && x <= b),
    ),
  ].sort((a, b) => a - b);
  const rings = cuts.map((x) => {
    const y = deckFor(x, cfg) + offset + (walk ? richmondWalkOffset(x) : 0);
    return [
      [x, y - depth, z0],
      [x, y, z0],
      [x, y, z1],
      [x, y - depth, z1],
    ];
  });
  loft(o, slot, rings, tint);
}
function core(o, cfg) {
  const cuts = [-C.halfLength, C.halfLength, ...(cfg.far ? [0] : C.profile.map((p) => p[0]))];
  for (const h of C.openings)
    for (let i = 0; i <= cfg.curve; i++) cuts.push(h.lo + ((h.hi - h.lo) * i) / cfg.curve);
  const xs = [...new Set(cuts)].sort((a, b) => a - b),
    rings = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      h = C.openings.find((h) => (a + b) / 2 > h.lo && (a + b) / 2 < h.hi),
      ya = h ? richmondArchY(h, a) : -0.35,
      yb = h ? richmondArchY(h, b) : -0.35;
    if (ya >= deckFor(a, cfg) - 0.15 || yb >= deckFor(b, cfg) - 0.15)
      throw Error('Richmond arch exceeds deck');
    rings.push(
      [
        [a, ya, -W],
        [a, deckFor(a, cfg) - 0.12, -W],
        [a, deckFor(a, cfg) - 0.12, W],
        [a, ya, W],
      ],
      [
        [b, yb, -W],
        [b, deckFor(b, cfg) - 0.12, -W],
        [b, deckFor(b, cfg) - 0.12, W],
        [b, yb, W],
      ],
    );
  }
  loft(o, 'stone', rings, color.stone);
  if (cfg.rims)
    for (const h of C.openings)
      for (const side of [-1, 1])
        for (let i = 0; i < cfg.rims; i++) {
          const angle0 = Math.PI * (1 - (i + 0.018) / cfg.rims),
            angle1 = Math.PI * (1 - (i + 0.982) / cfg.rims),
            cx = (h.lo + h.hi) / 2,
            r = (h.hi - h.lo) / 2;
          const inner = (t) => [cx + r * Math.cos(t), h.spring + h.rise * Math.sin(t)],
            outer = (t) => [
              cx + (r + 0.48) * Math.cos(t),
              h.spring + (h.rise + 0.48) * Math.sin(t),
            ];
          const p = [inner(angle0), inner(angle1), outer(angle1), outer(angle0)],
            z0 = side * W,
            z1 = side * (W + 0.075),
            tint = color.rim.map((v) => v * (0.985 + (i % 3) * 0.01));
          const ring = side < 0 ? p.toReversed() : p;
          loft(
            o,
            'carved',
            [ring.map(([x, y]) => [x, y, z0]), ring.map(([x, y]) => [x, y, z1])],
            tint,
          );
        }
}
const halfDisc = (x, side, r, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [x + r * Math.cos(t), side * (W - 0.07 + r * Math.sin(t))];
  });
function pierHeads(o, cfg) {
  for (const x of C.piers)
    for (const side of [-1, 1]) {
      if (cfg.far) {
        planPrism(
          o,
          'stone',
          halfDisc(x, side, 1.6, cfg.head),
          -0.35,
          (u) => deckFor(u, cfg) + 1.29,
          color.stone,
        );
        continue;
      }
      planPrism(o, 'stone', halfDisc(x, side, 1.9, cfg.head), -0.35, 1.2, color.stone);
      planPrism(
        o,
        'stone',
        halfDisc(x, side, 1.55, cfg.head),
        0.9,
        (u) => richmondDeckY(u) + 1.29,
        color.stone,
      );
      if (!cfg.spacing) continue;
      for (const [dy, height, r] of [
        [-0.42, 0.2, 1.7],
        [1.26, 0.18, 1.68],
      ])
        planPrism(
          o,
          'carved',
          halfDisc(x, side, r, cfg.head),
          richmondDeckY(x) + dy,
          (u) => richmondDeckY(u) + dy + height,
          color.carved,
        );
    }
}
function round(o, slot, x, z, profile, sides, tint) {
  loft(
    o,
    slot,
    profile.map(([y, r]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (-2 * Math.PI * i) / sides;
        return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      }),
    ),
    tint,
  );
}
function balusters(o, cfg) {
  if (!cfg.spacing) return;
  const full = [
      [0, 0.11],
      [0.07, 0.14],
      [0.15, 0.11],
      [0.23, 0.08],
      [0.37, 0.13],
      [0.55, 0.135],
      [0.72, 0.1],
      [0.82, 0.066],
      [0.91, 0.066],
      [0.96, 0.13],
      [1, 0.13],
    ],
    simple =
      cfg.profile === 1
        ? [
            [0, 0.1],
            [1, 0.1],
          ]
        : cfg.profile === 3
          ? [
              [0, 0.12],
              [0.15, 0.09],
              [0.5, 0.13],
              [0.85, 0.07],
              [1, 0.13],
            ]
          : cfg.profile === 5
            ? [
                [0, 0.12],
                [0.12, 0.13],
                [0.3, 0.09],
                [0.5, 0.135],
                [0.75, 0.095],
                [0.88, 0.066],
                [1, 0.13],
              ]
            : full;
  for (const side of [-1, 1]) {
    for (let x = -C.halfLength + 0.5; x < C.halfLength - 0.3; x += cfg.spacing) {
      if (C.piers.some((p) => Math.abs(x - p) < 1.9)) continue;
      const y = richmondDeckY(x);
      round(
        o,
        'carved',
        x,
        side * (W - 0.23),
        simple.map(([h, r]) => [y + 0.32 + h * 0.94, r]),
        cfg.sides,
        color.carved,
      );
    }
    for (let x = -C.halfLength + 2.5; x < C.halfLength - 1; x += cfg.profile === 1 ? 9 : 4.5) {
      if (C.piers.some((p) => Math.abs(x - p) < 2)) continue;
      const y = richmondDeckY(x);
      box(
        o,
        'stone',
        [x - 0.23, y + 0.3, side * (W - 0.23) - 0.25],
        [x + 0.23, y + 1.26, side * (W - 0.23) + 0.25],
        color.stone,
      );
    }
  }
}
function lamp(o, x, z, cfg) {
  const y = deckFor(x, cfg) + 1.46;
  if (cfg.lamp === 0) {
    beam(o, 'iron', [x, y, z], [x, y + 2.45, z], 0.22, 0.22, color.iron);
    return;
  }
  if (cfg.lamp === 1) {
    beam(o, 'iron', [x, y, z], [x, y + 1.95, z], 0.14, 0.14, color.iron);
    box(o, 'iron', [x - 0.18, y + 1.95, z - 0.18], [x + 0.18, y + 2.45, z + 0.18], color.iron);
    return;
  }
  round(
    o,
    'iron',
    x,
    z,
    [
      [y, 0.2],
      [y + 0.12, 0.22],
      [y + 0.32, 0.13],
      [y + 0.46, 0.1],
      [y + 1.78, 0.055],
      [y + 1.9, 0.11],
    ],
    cfg.lamp,
    color.iron,
  );
  const ring = (h, r) => [
    [x - r, h, z - r],
    [x + r, h, z - r],
    [x + r, h, z + r],
    [x - r, h, z + r],
  ];
  // The square rings face upward; use explicit pane/roof winding through the writer.
  const low = ring(y + 1.9, 0.13),
    high = ring(y + 2.5, 0.25);
  box(o, 'iron', [x - 0.16, y + 1.85, z - 0.16], [x + 0.16, y + 1.93, z + 0.16], color.iron);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, 'glass', [low[i], low[j], high[j], high[i]], color.glass, [
      (low[i][0] + low[j][0]) / 2 - x,
      0,
      (low[i][2] + low[j][2]) / 2 - z,
    ]);
    beam(o, 'iron', low[i], high[i], 0.035, 0.035, color.iron);
  }
  box(o, 'iron', [x - 0.27, y + 2.47, z - 0.27], [x + 0.27, y + 2.53, z + 0.27], color.iron);
  const roof = ring(y + 2.53, 0.28),
    top = [x, y + 2.78, z];
  for (let i = 0; i < 4; i++)
    face(o, 'iron', [roof[i], roof[(i + 1) % 4], top], color.iron, [
      roof[i][0] - x,
      1,
      roof[i][2] - z,
    ]);
  round(
    o,
    'iron',
    x,
    z,
    [
      [y + 2.76, 0.055],
      [y + 2.87, 0.035],
      [y + 2.94, 0.001],
    ],
    Math.max(6, cfg.lamp),
    color.iron,
  );
}
export function buildRichmondLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Richmond bridge level');
  const far = level === 'skyline',
    o = writer(target, far);
  const s = (...args) => slab(o, ...args, cfg);
  core(o, cfg);
  pierHeads(o, cfg);
  s('paving', -C.halfLength, C.halfLength, -W, W, 0.014, 0.19, color.road, false);
  for (const side of [-1, 1]) {
    const a = side < 0 ? -W : C.roadHalfWidth,
      b = side < 0 ? -C.roadHalfWidth : W;
    // Positive-bank walk is outside the roadway, as is the negative-bank walk.
    s('paving', -C.halfLength, C.halfLength, a, b, 0.014, 0.2, color.walk, true);
    const z0 = side < 0 ? -W : W - 0.46,
      z1 = z0 + 0.46;
    s('stone', -C.halfLength, C.halfLength, z0, z1, 0.34, 0.2, color.stone, false);
    s(
      'carved',
      -C.halfLength,
      C.halfLength,
      z0 - 0.055,
      z1 + 0.055,
      1.43,
      0.18,
      color.carved,
      false,
    );
    s('carved', -C.halfLength, C.halfLength, z0 - 0.07, z1 + 0.07, -0.08, 0.22, color.rim, false);
    if (far) s('stone', -C.halfLength, C.halfLength, z0, z1, 1.24, 0.9, color.stone, false);
  }
  balusters(o, cfg);
  for (const x of C.piers) for (const side of [-1, 1]) lamp(o, x, side * (W + 0.55), cfg);
  for (const side of [-1, 1]) {
    const a = side < 0 ? -C.halfLength - 1.5 : C.halfLength - 1,
      b = side < 0 ? -C.halfLength + 1 : C.halfLength + 1.5;
    s('paving', a, b, -7.2, 7.2, 0.006, 0.38, color.walk, false);
  }
  if (level === 'street' || level === 'closeup' || level === 'master') {
    // Low-frequency road marking geometry; no transient cars, signs, text or private images.
    for (let x = -C.halfLength + 3; x < C.halfLength - 3; x += 6)
      s('paving', x, x + 2.6, -0.06, 0.06, 0.023, 0.008, color.mark, false);
  }
}
export const buildRichmondSkyline = (o) => buildRichmondLevel(o, 'skyline');
export const buildRichmondDistrict = (o) => buildRichmondLevel(o, 'district');
export const buildRichmondStreet = (o) => buildRichmondLevel(o, 'street');
export const buildRichmondCloseup = (o) => buildRichmondLevel(o, 'closeup');

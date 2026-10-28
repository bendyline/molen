/** Inglisild, Tartu: classical timber footbridge with framed square piers and portrait frieze. */
import {
  beam,
  cross,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const inglisildControls = {
  originMeters: 64.6,
  halfLength: 15.704744372070433,
  ends: [-14.615345420985541, 16.794144088365687],
  width: 4.6,
  deckY: 5.75,
  tallPiers: [-8.4, -4.3, 4.3, 8.4],
  wingPiers: [9.65, 12.1, 14.55],
};
export const inglisildSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.4 },
};
const C = inglisildControls,
  Y = C.deckY,
  W = C.width / 2,
  A = C.ends[0],
  B = C.ends[1];
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const c = Object.fromEntries(
  Object.entries({
    cream: 'dfddca',
    yellow: 'bf9761',
    dark: '746a56',
    paving: 'a99b82',
    stone: 'a8a08c',
    bronze: '4d716a',
    relief: '729084',
    letter: '403e33',
    rail: 'deded5',
  }).map(([k, v]) => [k, linear(v)]),
);
const cfgs = {
  skyline: { far: true, rail: 0, board: 0, details: false, portrait: 0 },
  district: { rail: 0.85, board: 0, details: false, portrait: 8 },
  street: { rail: 0.28, board: 3, details: true, portrait: 10 },
  closeup: { rail: 0.18, board: 6, details: true, portrait: 18 },
  master: { rail: 0.18, board: 9, details: true, portrait: 28 },
};
export const inglisildDeckY = () => Y;
function writer(target, far) {
  const emit = (slot, _ref, p, hint, _uv, tint) => {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-9
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
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function b(o, slot, x0, x1, y0, y1, z0, z1, color) {
  box(o, slot, [x0, y0, z0], [x1, y1, z1], color);
}
function pier(o, x, z, bottom, top, cfg) {
  if (cfg.far) {
    b(o, 'plaster', x - 0.42, x + 0.42, bottom - 0.15, top, z - 0.42, z + 0.42, c.cream);
    return;
  }
  const short = bottom > 1,
    base = short ? 0.72 : 1.06,
    shaft = short ? 0.53 : 0.84;
  b(
    o,
    'stone',
    x - base / 2,
    x + base / 2,
    bottom - 0.16,
    bottom + 0.18,
    z - base / 2,
    z + base / 2,
    c.stone,
  );
  b(
    o,
    'plaster',
    x - shaft / 2,
    x + shaft / 2,
    bottom + 0.16,
    top - 0.38,
    z - shaft / 2,
    z + shaft / 2,
    c.cream,
  );
  // Mustard inset panels preserve the photographed pale perimeter frames on all four sides.
  if (!cfg.far) {
    const w = shaft * 0.63;
    for (const sign of [-1, 1]) {
      b(
        o,
        'plaster',
        x - w / 2,
        x + w / 2,
        bottom + 0.38,
        top - 0.56,
        z + (sign * shaft) / 2 - 0.004,
        z + (sign * shaft) / 2 + 0.004,
        c.yellow,
      );
      b(
        o,
        'plaster',
        x + (sign * shaft) / 2 - 0.004,
        x + (sign * shaft) / 2 + 0.004,
        bottom + 0.38,
        top - 0.56,
        z - w / 2,
        z + w / 2,
        c.yellow,
      );
    }
  }
  b(
    o,
    'wood',
    x - shaft * 0.58,
    x + shaft * 0.58,
    top - 0.4,
    top - 0.24,
    z - shaft * 0.58,
    z + shaft * 0.58,
    c.cream,
  );
  b(
    o,
    'wood',
    x - shaft * 0.7,
    x + shaft * 0.7,
    top - 0.26,
    top - 0.12,
    z - shaft * 0.7,
    z + shaft * 0.7,
    c.dark,
  );
  b(
    o,
    'wood',
    x - shaft * 0.8,
    x + shaft * 0.8,
    top - 0.14,
    top,
    z - shaft * 0.8,
    z + shaft * 0.8,
    c.cream,
  );
}
function disk(o, x, y, z, r, depth, color, segments = 20) {
  const face = (zz) =>
    Array.from({ length: segments }, (_, i) => [
      x + r * Math.cos((i / segments) * Math.PI * 2),
      y + r * Math.sin((i / segments) * Math.PI * 2),
      zz,
    ]);
  loft(o, 'bronze', [face(z - depth / 2), face(z + depth / 2)], color);
}
const glyphs = {
  O: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
      [0.6, 0],
      [0, 0],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.6, 1],
    ],
    [
      [0.3, 1],
      [0.3, 0],
    ],
  ],
  I: [
    [
      [0.3, 0],
      [0.3, 1],
    ],
    [
      [0.05, 0],
      [0.55, 0],
    ],
    [
      [0.05, 1],
      [0.55, 1],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.3, 0],
      [0.6, 1],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.3, 0.45],
      [0.6, 1],
      [0.6, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.6, 0.8],
      [0.5, 0.55],
      [0, 0.55],
    ],
    [
      [0.3, 0.55],
      [0.6, 0],
    ],
  ],
  E: [
    [
      [0.6, 1],
      [0, 1],
      [0, 0],
      [0.6, 0],
    ],
    [
      [0, 0.5],
      [0.5, 0.5],
    ],
  ],
  F: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
    ],
    [
      [0, 0.55],
      [0.5, 0.55],
    ],
  ],
  C: [
    [
      [0.6, 1],
      [0, 1],
      [0, 0],
      [0.6, 0],
    ],
  ],
  S: [
    [
      [0.6, 1],
      [0, 1],
      [0, 0.55],
      [0.6, 0.55],
      [0.6, 0],
      [0, 0],
    ],
  ],
};
function text(o, string, y, z, height) {
  const step = 0.86 * height,
    start = (-step * (string.length - 1)) / 2 - 0.3 * height;
  for (const [j, char] of [...string].entries())
    for (const line of glyphs[char] ?? [])
      for (let i = 1; i < line.length; i++) {
        const P = (p) => [
          (z < 0 ? -1 : 1) * (start + j * step + p[0] * height),
          y + p[1] * height,
          z,
        ];
        beam(o, 'bronze', P(line[i - 1]), P(line[i]), 0.023, 0.016, c.letter);
      }
}
function frieze(o, side, cfg) {
  const z = side * (W - 0.16);
  b(o, 'wood', -8.75, 8.75, Y - 0.18, Y + 0.98, z - 0.2, z + 0.2, c.yellow);
  b(o, 'wood', -2.65, 2.65, Y + 0.96, Y + 1.31, z - 0.2, z + 0.2, c.yellow);
  for (const [a, d, height] of [
    [-8.83, 8.83, Y + 1.03],
    [-2.72, 2.72, Y + 1.36],
  ])
    b(o, 'wood', a, d, height - 0.09, height, z - 0.28, z + 0.28, c.dark);
  if (cfg.board)
    for (let j = 1; j < cfg.board; j++)
      for (const s of [-1, 1])
        b(
          o,
          'wood',
          -8.75,
          8.75,
          Y + (j / cfg.board) * 0.96 - 0.012,
          Y + (j / cfg.board) * 0.96 + 0.012,
          z + s * 0.202 - 0.004,
          z + s * 0.202 + 0.004,
          c.dark,
        );
  if (cfg.portrait) {
    if (side > 0) {
      disk(o, 0, Y + 0.67, z + side * 0.24, 0.63, 0.06, c.bronze, cfg.portrait);
      // Original shallow profile abstraction: head, projecting nose, neck and draped shoulders.
      const n = cfg.portrait;
      sphere(
        o,
        'bronze',
        [0.02, Y + 0.83, z + 0.29],
        [0.205, 0.28, 0.07],
        c.relief,
        n,
        Math.max(4, Math.floor(n / 2)),
      );
      sphere(o, 'bronze', [-0.17, Y + 0.82, z + 0.3], [0.1, 0.052, 0.045], c.relief, n, 4);
      b(o, 'bronze', -0.08, 0.08, Y + 0.39, Y + 0.67, z + 0.26, z + 0.34, c.relief);
      sphere(o, 'bronze', [0.06, Y + 0.34, z + 0.29], [0.36, 0.17, 0.055], c.relief, n, 4);
    } else if (cfg.details) text(o, 'OTIVM REFICIT VIRES', Y + 0.36, z - 0.218, 0.38);
  }
  if (cfg.details)
    for (let x = -7.8; x < 8; x += 1.55) {
      disk(o, x, Y - 0.52, z + side * 0.075, 0.115, 0.025, c.cream, 10);
    }
}
export function buildInglisildLevel(target, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Inglisild level');
  const o = writer(target, cfg.far);
  // Deck and its complete lower soffit; no opaque wall closes any of the three street-level bays.
  b(o, 'wood', A, B, Y - 0.24, Y, -W, W, c.dark);
  b(o, 'wood', A, B, Y - 0.02, Y + 0.018, -W + 0.2, W - 0.2, c.paving);
  for (const side of [-1, 1]) {
    const z = side * (W - 0.16);
    for (const x of C.tallPiers) pier(o, x, z, 0, Y - 0.72, cfg);
    for (const dir of [-1, 1]) {
      b(
        o,
        'plaster',
        dir < 0 ? A : 9.0,
        dir < 0 ? -9.0 : B,
        -0.1,
        3.35,
        z - 0.5,
        z + 0.5,
        c.yellow,
      );
      b(o, 'stone', dir < 0 ? A : 9.0, dir < 0 ? -9.0 : B, 3.27, 3.47, z - 0.58, z + 0.58, c.dark);
      for (let j = 0; j < 3; j++) {
        const x = dir < 0 ? A + 0.7 + (j * (-9.3 - A - 0.7)) / 2 : 9.3 + (j * (B - 0.7 - 9.3)) / 2;
        pier(o, x, z, 3.4, Y - 0.48, cfg);
      }
      const a = dir < 0 ? A : 8.75,
        bx = dir < 0 ? -8.75 : B;
      if (cfg.far) b(o, 'wood', a, bx, Y, Y + 1.04, z - 0.09, z + 0.09, c.rail);
      else {
        for (const yy of [Y + 0.12, Y + 1.03])
          b(o, 'wood', a, bx, yy, yy + 0.095, z - 0.1, z + 0.1, c.rail);
        for (let x = a + 0.12; x < bx; x += cfg.rail)
          b(o, 'wood', x - 0.025, x + 0.025, Y + 0.14, Y + 1.05, z - 0.035, z + 0.035, c.rail);
        for (let x = a; x <= bx; x += 2.15)
          b(o, 'wood', x - 0.07, x + 0.07, Y + 0.03, Y + 1.13, z - 0.075, z + 0.075, c.rail);
      }
    }
    b(o, 'wood', A, B, Y - 0.68, Y - 0.23, z - 0.3, z + 0.3, c.yellow);
    b(o, 'wood', -8.9, 8.9, Y - 0.86, Y - 0.67, z - 0.39, z + 0.39, c.cream);
    b(o, 'wood', -8.9, 8.9, Y - 0.29, Y - 0.19, z - 0.4, z + 0.4, c.dark);
    frieze(o, side, cfg);
    if (cfg.details)
      for (let x = -8.7; x < 8.8; x += 0.23)
        b(o, 'wood', x - 0.047, x + 0.047, Y - 0.72, Y - 0.62, z - 0.41, z + 0.41, c.cream);
  }
  if (cfg.details) {
    for (let x = A + 0.15; x < B; x += 0.32)
      b(o, 'wood', x - 0.006, x + 0.006, Y + 0.018, Y + 0.023, -W + 0.2, W - 0.2, c.dark);
  }
  // Small fitted end caps overlap generalized paths; the engine supplies connected approach grading.
  for (const side of [-1, 1])
    b(
      o,
      'wood',
      side < 0 ? A - 1.1 : B - 0.3,
      side < 0 ? A + 0.3 : B + 0.8,
      Y - 0.26,
      Y + 0.014,
      -W - 0.35,
      W + 0.35,
      c.paving,
    );
}
export const buildInglisildSkyline = (o) => buildInglisildLevel(o, 'skyline');
export const buildInglisildDistrict = (o) => buildInglisildLevel(o, 'district');
export const buildInglisildStreet = (o) => buildInglisildLevel(o, 'street');
export const buildInglisildCloseup = (o) => buildInglisildLevel(o, 'closeup');

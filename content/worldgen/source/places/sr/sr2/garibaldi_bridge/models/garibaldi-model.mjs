/** Ponte Garibaldi, Rome: two shallow concrete vaults and rounded rusticated pier heads. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const garibaldiControls = {
  originMeters: 7,
  ends: [-62.0178015402837, 61.89889183455829],
  width: 23.5,
  roadHalfWidth: 7.8,
  profile: [
    [-62.0178015402837, 14.6],
    [0, 14.95],
    [61.89889183455829, 14.8],
  ],
  openings: [
    { lo: -55.5, hi: -4.8, spring: 4.8, rise: 8.8 },
    { lo: 4.8, hi: 55.4, spring: 4.8, rise: 8.85 },
  ],
};
export const garibaldiSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.3 },
};
const C = garibaldiControls,
  W = C.width / 2;
function box(o, slot, _ref, center, size, tint) {
  boundsBox(
    o,
    slot,
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    tint,
  );
}
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('c8c4b5'),
  rim: linear('d5cebc'),
  stone: linear('bab6a5'),
  walk: linear('b6b3a8'),
  road: linear('686b69'),
  iron: linear('48534c'),
  steel: linear('979d98'),
  glass: linear('d2d6c7'),
  mark: linear('e1dcc6'),
};
const configs = {
  skyline: { far: true, curve: 5, head: 3, rail: 0, lamp: 0 },
  district: { curve: 12, head: 4, rail: 6, lamp: 1 },
  street: { curve: 28, head: 8, rail: 1.5, lamp: 5 },
  closeup: { curve: 44, head: 12, rail: 0.7, lamp: 8 },
  master: { curve: 72, head: 20, rail: 0.55, lamp: 12 },
};
export function garibaldiDeckY(x) {
  const [a, ay] = x < 0 ? C.profile[0] : C.profile[1];
  const [b, by] = x < 0 ? C.profile[1] : C.profile[2];
  return ay + Math.max(0, Math.min(1, (x - a) / (b - a))) * (by - ay);
}
export function garibaldiArchY(h, x) {
  const t = (2 * x - h.lo - h.hi) / (h.hi - h.lo);
  return h.spring + h.rise * Math.sqrt(Math.max(0, 1 - t * t));
}
export const garibaldiWalkOffset = (x) =>
  0.16 * Math.max(0, Math.min(1, (x - C.ends[0]) / 3, (C.ends[1] - x) / 3));
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]];
      const n = normalFor(...t);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
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
function face(o, slot, p, tint, hint) {
  o.addConvexPolygon(slot, 'palette:#ffffff', p, hint, null, tint);
}
function slab(o, slot, a, b, z0, z1, offset, depth, tint) {
  const cuts = [
    ...new Set([a, ...[C.ends[0] + 3, 0, C.ends[1] - 3].filter((x) => x > a && x < b), b]),
  ].sort((x, y) => x - y);
  loft(
    o,
    slot,
    cuts.map((x) => {
      const y = garibaldiDeckY(x) + (typeof offset === 'function' ? offset(x) : offset);
      return [
        [x, y - depth, z0],
        [x, y, z0],
        [x, y, z1],
        [x, y - depth, z1],
      ];
    }),
    tint,
  );
}
function stadium(cx, radius, straight, steps) {
  return [1, -1]
    .flatMap((sign) =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const angle = sign === 1 ? (i / steps) * Math.PI : Math.PI + (i / steps) * Math.PI;
        return [cx + radius * Math.cos(angle), sign * straight + radius * Math.sin(angle)];
      }),
    )
    .reverse();
}
function pier(o, cx, cfg) {
  const stages = cfg.far
    ? [
        [-0.5, 0.7, 5.3, 10.7],
        [0.7, garibaldiDeckY(cx) - 0.1, 4.8, 10.6],
      ]
    : [
        [-0.5, 0.8, 5.35, 10.9],
        [0.8, 3, 5.05, 10.7],
        [3, 8.4, 4.8, 10.55],
        [8.4, 8.75, 5.15, 10.8],
        [8.75, garibaldiDeckY(cx) - 0.28, 4.7, 10.5],
        [garibaldiDeckY(cx) - 0.28, garibaldiDeckY(cx) - 0.05, 5.1, 10.8],
      ];
  for (const [lo, hi, radius, straight] of stages) {
    const outline = stadium(cx, radius, straight, cfg.head);
    loft(
      o,
      'stone',
      [lo, hi].map((y) => outline.map(([x, z]) => [x, y, z])),
      color.stone,
    );
  }
  if (cfg.curve >= 28) {
    for (let y = 1.2; y < garibaldiDeckY(cx) - 0.45; y += 0.68) {
      const radius = y < 3 ? 5.08 : y < 8.4 ? 4.83 : y < 8.75 ? 5.18 : 4.73;
      const straight = y < 3 ? 10.7 : y < 8.4 ? 10.55 : y < 8.75 ? 10.8 : 10.5;
      const outline = stadium(cx, radius, straight, cfg.head);
      loft(
        o,
        'stone',
        [y, y + 0.06].map((v) => outline.map(([x, z]) => [x, v, z])),
        color.stone,
      );
    }
  }
}
function vault(o, h, cfg) {
  for (let i = 0; i < cfg.curve; i++) {
    // Equal-angle samples resolve the almost vertical springing without tiny triangles at the crown.
    const angleA = Math.PI * (1 - i / cfg.curve),
      angleB = Math.PI * (1 - (i + 1) / cfg.curve);
    const mid = (h.lo + h.hi) / 2,
      radius = (h.hi - h.lo) / 2;
    const a = mid + radius * Math.cos(angleA),
      b = mid + radius * Math.cos(angleB);
    const ya = h.spring + h.rise * Math.sin(angleA),
      yb = h.spring + h.rise * Math.sin(angleB);
    const topA = garibaldiDeckY(a) - 0.26,
      topB = garibaldiDeckY(b) - 0.26;
    loft(
      o,
      'concrete',
      [
        [
          [a, ya, -W],
          [a, topA, -W],
          [a, topA, W],
          [a, ya, W],
        ],
        [
          [b, yb, -W],
          [b, topB, -W],
          [b, topB, W],
          [b, yb, W],
        ],
      ],
      color.concrete,
    );
    if (!cfg.far)
      for (const sign of [-1, 1]) {
        const z = sign * (W + 0.05);
        const p = [
          [a, ya, z],
          [b, yb, z],
          [b, yb + 0.2, z],
          [a, ya + 0.2, z],
        ];
        face(o, 'concrete', p, color.rim, [0, 0, sign]);
      }
  }
}
function lamp(o, x, z, cfg) {
  const y = garibaldiDeckY(x) + 0.16;
  box(o, 'iron', 'palette:#ffffff', [x, y + 0.2, z], [0.45, 0.4, 0.45], color.iron);
  beam(o, 'iron', [x, y + 0.3, z], [x, y + 5.8, z], cfg.lamp === 1 ? 0.16 : 0.12, 0.12, color.iron);
  for (const sign of [-1, 1]) {
    const p = [
      [x, y + 5.6, z],
      [x + sign * 0.35, y + 6.15, z],
      [x + sign * 0.8, y + 6.2, z],
      [x + sign * 1.05, y + 5.85, z],
    ];
    if (cfg.lamp === 1) beam(o, 'iron', p[0], p.at(-1), 0.12, 0.12, color.iron);
    else
      for (let i = 1; i < p.length; i++) beam(o, 'iron', p[i - 1], p[i], 0.085, 0.085, color.iron);
    box(
      o,
      'iron',
      'palette:#ffffff',
      [x + sign * 1.05, y + 5.72, z],
      [0.4, 0.23, 0.44],
      color.iron,
    );
    if (cfg.lamp > 1)
      box(
        o,
        'paving',
        'palette:#ffffff',
        [x + sign * 1.05, y + 5.59, z],
        [0.28, 0.035, 0.32],
        color.glass,
      );
  }
}
export function buildGaribaldiLevel(target, level = 'master') {
  const cfg = configs[level],
    o = writer(target, cfg.far),
    [A, B] = C.ends;
  for (const h of C.openings) vault(o, h, cfg);
  for (const x of [A + 1.3, 0, B - 1.3]) pier(o, x, cfg);
  for (const [a, b] of [
    [A, C.openings[0].lo],
    [C.openings[0].hi, C.openings[1].lo],
    [C.openings[1].hi, B],
  ]) {
    loft(
      o,
      'stone',
      [a, b].map((x) => [
        [x, -0.5, -W],
        [x, garibaldiDeckY(x) - 0.26, -W],
        [x, garibaldiDeckY(x) - 0.26, W],
        [x, -0.5, W],
      ]),
      color.stone,
    );
  }
  slab(o, 'paving', A, B, -W, W, 0, 0.3, color.road);
  for (const sign of [-1, 1]) {
    const low = sign < 0 ? -W : C.roadHalfWidth,
      high = sign < 0 ? -C.roadHalfWidth : W;
    slab(o, 'paving', A, B, low, high, garibaldiWalkOffset, 0.16, color.walk);
    slab(o, 'concrete', A, B, sign * W - 0.19, sign * W + 0.19, -0.06, 0.43, color.rim);
    if (cfg.far) {
      slab(
        o,
        'iron',
        A,
        B,
        sign * (W - 0.1) - 0.08,
        sign * (W - 0.1) + 0.08,
        1.08,
        0.88,
        color.iron,
      );
    } else {
      const z = sign * (W - 0.12),
        count = Math.ceil((B - A) / cfg.rail);
      for (let i = 0; i <= count; i++) {
        const x = A + (i / count) * (B - A),
          y = garibaldiDeckY(x) + garibaldiWalkOffset(x);
        box(
          o,
          'iron',
          'palette:#ffffff',
          [x, y + 0.53, z],
          [i % 5 === 0 ? 0.09 : 0.055, 1.06, 0.075],
          color.iron,
        );
      }
      for (const offset of [0.07, 0.56, 1.06])
        slab(
          o,
          'iron',
          A,
          B,
          z - 0.055,
          z + 0.055,
          (x) => offset + garibaldiWalkOffset(x),
          0.06,
          color.iron,
        );
      for (const x of [A + 8, 0, B - 8]) lamp(o, x, sign * (W - 1.3), cfg);
    }
  }
  // Small sloping overlaps seat the inferred outer walks at generalized map cut boundaries.
  for (const [end, sign] of [
    [A, -1],
    [B, 1],
  ])
    slab(
      o,
      'paving',
      Math.min(end, end + sign * 1.5),
      Math.max(end, end + sign * 1.5),
      -W - 0.9,
      W + 0.9,
      0.02,
      0.35,
      color.road,
    );
  if (!cfg.far) {
    for (const z of [-2.22, -0.78, 0.78, 2.22])
      slab(o, 'iron', A, B, z - 0.035, z + 0.035, 0.012, 0.02, color.steel);
    if (cfg.curve >= 28) {
      for (const z of [-4, 4])
        slab(o, 'paving', A + 2, B - 2, z - 0.05, z + 0.05, 0.014, 0.01, color.mark);
      // Contact wires are restricted to near views; six lamps provide the visible support rhythm.
      for (const z of [-1.5, 1.5])
        beam(
          o,
          'iron',
          [A, garibaldiDeckY(A) + 5.3, z],
          [B, garibaldiDeckY(B) + 5.3, z],
          0.025,
          0.025,
          color.iron,
        );
    }
  }
}
export const buildGaribaldiSkyline = (b) => buildGaribaldiLevel(b, 'skyline');
export const buildGaribaldiDistrict = (b) => buildGaribaldiLevel(b, 'district');
export const buildGaribaldiStreet = (b) => buildGaribaldiLevel(b, 'street');
export const buildGaribaldiCloseup = (b) => buildGaribaldiLevel(b, 'closeup');

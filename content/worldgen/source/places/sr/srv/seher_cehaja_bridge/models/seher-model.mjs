/** Original photo-led Šeher-Ćehaja Bridge. Shared controls keep all four arches open at every tier. */
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const seherControls = {
  halfLength: 20.386,
  halfWidth: 2.35,
  deckEnd: 3.75,
  crown: 0.58,
  parapetHeight: 0.88,
  parapetThickness: 0.32,
  pierXs: [-9.7, 0, 9.7],
  pierWidth: 1.7,
  springY: 0.5,
  archThickness: 0.42,
  spans: [
    [-18.9, -10.55, 2.62],
    [-8.85, -0.85, 2.93],
    [0.85, 8.85, 2.93],
    [10.55, 18.9, 2.62],
  ],
};
export const seherSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94 },
  paving: { slot: 'roof', graph: 'stone_granite', roughness: 0.96 },
};
const linear = (h) =>
  h.match(/../g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = seherControls,
  col = {
    wall: linear('c9a978'),
    stone: linear('d9d1b7'),
    parapet: linear('e7e2d4'),
    cap: linear('888a7c'),
    joint: linear('9b9382'),
    paving: linear('b7b1a2'),
  };
const settings = {
  skyline: { arc: 6, panels: 0, deck: 4, barrel: 0, cap: 2 },
  district: { arc: 12, panels: 1.4, deck: 20, barrel: 0, cap: 5 },
  street: { arc: 24, panels: 0.92, deck: 40, barrel: 2, cap: 8 },
  closeup: { arc: 40, panels: 0.92, deck: 72, barrel: 6, cap: 12 },
  master: { arc: 64, panels: 0.92, deck: 104, barrel: 10, cap: 16 },
};
export const seherDeckY = (x) => C.deckEnd + C.crown * (1 - (x / C.halfLength) ** 2);
export function seherIntrados(x) {
  for (const [a, b, r] of C.spans)
    if (x >= a && x <= b) {
      const t = (x - (a + b) / 2) / ((b - a) / 2);
      return C.springY + r * Math.sqrt(Math.max(0, 1 - t * t));
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
function quad(o, slot, p, n, color) {
  o.addQuad(slot, 'palette:#ffffff', p, n, [], color);
}
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
function pierRing(x, y, width, body, extension, sides) {
  const r = width / 2,
    p = [
      [x - r, y, -body],
      [x, y, -body - extension * 1.25],
      [x + r, y, -body],
      [x + r, y, body],
    ];
  for (let i = 1; i <= sides; i++) {
    const a = (i * Math.PI) / sides;
    p.push([x + r * Math.cos(a), y, body + extension * Math.sin(a)]);
  }
  return p.reverse();
}
function pier(o, x, S) {
  // Rectangular load-bearing pier continues to the deck; projecting noses sit outside its faces.
  box(
    o,
    'wall',
    [x - C.pierWidth / 2, -0.65, -C.halfWidth],
    [x + C.pierWidth / 2, seherDeckY(x) - 0.13, C.halfWidth],
    col.wall,
  );
  const rings = [
    pierRing(x, -0.55, 2.02, C.halfWidth + 0.08, 1.02, S.cap),
    pierRing(x, -0.3, 2.02, C.halfWidth + 0.08, 1.02, S.cap),
  ];
  loft(o, 'stone', rings, col.stone);
  loft(
    o,
    'stone',
    [
      pierRing(x, -0.3, C.pierWidth, C.halfWidth, 0.86, S.cap),
      pierRing(x, 1.65, C.pierWidth, C.halfWidth, 0.86, S.cap),
    ],
    col.stone,
  );
  loft(
    o,
    'stone',
    [
      pierRing(x, 1.64, C.pierWidth + 0.12, C.halfWidth + 0.04, 0.9, S.cap),
      pierRing(x, 1.79, C.pierWidth + 0.12, C.halfWidth + 0.04, 0.9, S.cap),
    ],
    col.parapet,
  );
  // Grey tapered caps on both projecting cutwaters remain solid silhouette geometry even far away.
  loft(
    o,
    'stone',
    [
      pierRing(x, 1.79, C.pierWidth + 0.06, C.halfWidth + 0.02, 0.87, S.cap),
      pierRing(x, 2.76, 0.56, C.halfWidth - 0.01, 0.025, S.cap),
    ],
    col.cap,
  );
  if (S.barrel) {
    // Narrow horizontal course faces on exposed nose skins; joints are material color, never painted shadow gradients.
    for (let y = 0.12; y < 1.65; y += 0.36) {
      const ring = pierRing(x, y, C.pierWidth + 0.005, C.halfWidth + 0.003, 0.863, S.cap);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.01) continue;
        quad(o, 'stone', [a, b, [b[0], y + 0.012, b[2]], [a[0], y + 0.012, a[2]]], null, col.joint);
      }
    }
  }
}
function arch(o, span, S) {
  const [a, b, rise] = span,
    center = (a + b) / 2,
    rx = (b - a) / 2,
    points = Array.from({ length: S.arc + 1 }, (_, i) => {
      const t = Math.PI - (Math.PI * i) / S.arc;
      return [center + rx * Math.cos(t), C.springY + rise * Math.sin(t)];
    });
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1],
      q = points[i],
      x0 = p[0],
      x1 = q[0],
      y0 = p[1],
      y1 = q[1],
      z = C.halfWidth;
    // Two spandrel faces, the full intrados and deck underside. No solid bridge slab across the opening.
    for (const side of [-1, 1])
      quad(
        o,
        'wall',
        [
          [x0, y0, side * z],
          [x1, y1, side * z],
          [x1, seherDeckY(x1) - 0.12, side * z],
          [x0, seherDeckY(x0) - 0.12, side * z],
        ],
        [0, 0, side],
        col.wall,
      );
    quad(
      o,
      'wall',
      [
        [x0, y0, -z],
        [x1, y1, -z],
        [x1, y1, z],
        [x0, y0, z],
      ],
      [0, -1, 0],
      col.stone,
    );
    // Pale voussoirs: a radial ring on each face, joint-separated on street/near tiers.
    for (const side of [-1, 1]) {
      const t0 = Math.PI - (Math.PI * (i - 1)) / S.arc,
        t1 = Math.PI - (Math.PI * i) / S.arc,
        gap = S.barrel ? 0.006 : 0,
        tA = t0 - gap,
        tB = t1 + gap,
        pt = (t, outer) => [
          center + (rx + (outer ? C.archThickness : 0)) * Math.cos(t),
          C.springY + (rise + (outer ? C.archThickness : 0)) * Math.sin(t),
          side * (z + 0.012),
        ];
      const tint = i % 5 === 0 && S.barrel ? col.parapet : col.stone;
      quad(
        o,
        'stone',
        [pt(tA, false), pt(tB, false), pt(tB, true), pt(tA, true)],
        [0, 0, side],
        tint,
      );
    }
    if (S.barrel) {
      // Barrel joints follow the actual curved intrados and the crossing width rather than a flat XY projection.
      for (let k = 0; k < S.barrel; k++) {
        const za = -z + (2 * z * k) / S.barrel,
          zb = -z + (2 * z * (k + 1)) / S.barrel - 0.008,
          pa = [x0, y0 - 0.003, za],
          pb = [x1, y1 - 0.003, za],
          pc = [x1, y1 - 0.003, zb],
          pd = [x0, y0 - 0.003, zb];
        quad(o, 'stone', [pa, pb, pc, pd], [0, -1, 0], (i + k) % 7 === 0 ? col.parapet : col.stone);
      }
    }
  }
}
export function buildSeherLevel(target, level = 'master') {
  const S = settings[level];
  if (!S) throw Error(`Unknown Seher tier ${level}`);
  const far = level === 'skyline',
    o = writer(target, far);
  for (const span of C.spans) arch(o, span, S);
  for (const x of C.pierXs) pier(o, x, S);
  for (const [a, b] of [
    [-C.halfLength, -18.9],
    [18.9, C.halfLength],
  ])
    slab(
      o,
      'wall',
      [a, b],
      -C.halfWidth,
      C.halfWidth,
      () => -0.65,
      (x) => seherDeckY(x) - 0.12,
      col.wall,
    );
  const xs = Array.from(
    { length: S.deck + 1 },
    (_, i) => -C.halfLength + (2 * C.halfLength * i) / S.deck,
  );
  slab(
    o,
    'paving',
    xs,
    -C.halfWidth,
    C.halfWidth,
    (x) => seherDeckY(x) - 0.13,
    seherDeckY,
    col.paving,
  );
  if (S.barrel)
    for (let x = -C.halfLength + 0.15; x < C.halfLength - 0.15; x += 0.56) {
      const y = seherDeckY(x) + 0.002;
      quad(
        o,
        'paving',
        [
          [x - 0.006, y, -2.02],
          [x + 0.006, y, -2.02],
          [x + 0.006, y, 2.02],
          [x - 0.006, y, 2.02],
        ],
        [0, 1, 0],
        col.joint,
      );
    }
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -C.halfWidth : -C.parapetThickness + C.halfWidth,
      z1 = z0 + C.parapetThickness;
    slab(
      o,
      'stone',
      xs,
      z0 - 0.025,
      z1 + 0.025,
      (x) => seherDeckY(x) - 0.09,
      (x) => seherDeckY(x) + 0.07,
      col.parapet,
    );
    // Solid parapets remain continuous: decorative joints do not turn them into disconnected columns.
    slab(
      o,
      'stone',
      xs,
      z0,
      z1,
      (x) => seherDeckY(x) + 0.07,
      (x) => seherDeckY(x) + C.parapetHeight,
      col.parapet,
    );
    slab(
      o,
      'stone',
      xs,
      z0 - 0.025,
      z1 + 0.025,
      (x) => seherDeckY(x) + C.parapetHeight,
      (x) => seherDeckY(x) + C.parapetHeight + 0.06,
      col.parapet,
    );
    if (S.panels)
      for (let x = -C.halfLength + 0.65; x < C.halfLength - 0.2; x += S.panels) {
        const y = seherDeckY(x);
        for (const z of [z0 - 0.003, z1 + 0.003])
          quad(
            o,
            'stone',
            [
              [x - 0.008, y + 0.09, z],
              [x + 0.008, y + 0.09, z],
              [x + 0.008, y + C.parapetHeight, z],
              [x - 0.008, y + C.parapetHeight, z],
            ],
            [0, 0, z < 0 ? -1 : 1],
            col.joint,
          );
      }
  }
  // Short open-mouth paving wings meet the narrower, slightly oblique current PMTiles paths.
  // They are visualization joins outside the40.772m mapped bridge, not extra historic spans.
  for (const side of [-1, 1]) {
    const x0 = side * C.halfLength,
      x1 = side * (C.halfLength + 0.95),
      shift = side < 0 ? 0.46 : 0.14,
      y0 = C.deckEnd,
      y1 = y0 - 0.057;
    const a = [x0, y0, -C.halfWidth],
      b = [x0, y0, C.halfWidth],
      c = [x1, y1, shift + 1.5],
      d = [x1, y1, shift - 1.5];
    quad(o, 'paving', [a, b, c, d], [0, 1, 0], col.paving);
    quad(
      o,
      'stone',
      [a, b, c, d].map((p) => [p[0], p[1] - 0.18, p[2]]),
      [0, -1, 0],
      col.stone,
    );
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      quad(
        o,
        'stone',
        [p, q, [q[0], q[1] - 0.18, q[2]], [p[0], p[1] - 0.18, p[2]]],
        [(p[0] + q[0] - x0 - x1) / 2, 0, (p[2] + q[2] - shift) / 2],
        col.stone,
      );
  }
}
export const buildSeherSkyline = (o) => buildSeherLevel(o, 'skyline');
export const buildSeherDistrict = (o) => buildSeherLevel(o, 'district');
export const buildSeherStreet = (o) => buildSeherLevel(o, 'street');
export const buildSeherCloseup = (o) => buildSeherLevel(o, 'closeup');

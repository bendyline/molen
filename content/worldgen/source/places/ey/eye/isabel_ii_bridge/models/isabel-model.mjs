/** Original photo/map Isabel II bridge draft. Three iron spans, hollow circular spandrels and the east-bank passage. */
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import bank from './bank-controls.json' with { type: 'json' };
export const isabelControls = {
  west: -82.5,
  east: 82.5,
  halfWidth: 8.16,
  roadHalfWidth: 4.7,
  deckEnds: [10.35, 10.45],
  crown: 0.25,
  springY: 2.85,
  archRise: 6.68,
  archThickness: 0.35,
  piers: [-27.97, 18.63],
  spans: [
    [-77.3, -29.47],
    [-26.47, 17.13],
    [20.13, 63.65],
  ],
  eastPassage: [70, 78.1, 3.8],
  pierSkew: -0.1675,
};
export const isabelSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.9 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.62 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92 },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1 },
};
const C = isabelControls,
  linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  col = {
    iron: linear('727d73'),
    stone: linear('b4ad95'),
    road: linear('626a67'),
    paving: linear('b4aea0'),
    mark: linear('d8d5c3'),
    glass: linear('e4d7b4'),
  };
const tiers = {
  skyline: {
    arch: 4,
    ribs: 2,
    circles: 1,
    ring: 5,
    tri: true,
    posts: 0,
    bars: 0,
    lamps: 0,
    cross: 0,
  },
  district: {
    arch: 7,
    ribs: 2,
    circles: 3,
    ring: 8,
    tri: true,
    posts: 8.5,
    bars: 0,
    lamps: 0,
    cross: 0,
  },
  street: {
    arch: 20,
    ribs: 3,
    circles: 4,
    ring: 12,
    tri: true,
    posts: 3,
    bars: 0.9,
    lamps: 4,
    cross: 6,
  },
  closeup: {
    arch: 40,
    ribs: 5,
    circles: 5,
    ring: 28,
    tri: false,
    posts: 2.4,
    bars: 0.28,
    lamps: 7,
    cross: 12,
  },
  master: {
    arch: 72,
    ribs: 7,
    circles: 5,
    ring: 48,
    tri: false,
    posts: 2.4,
    bars: 0.15,
    lamps: 7,
    cross: 18,
  },
};
export const isabelDeckY = (x) => {
  const u = (x - C.west) / (C.east - C.west);
  return (
    C.deckEnds[0] +
    (C.deckEnds[1] - C.deckEnds[0]) * u +
    C.crown * Math.sin(Math.PI * Math.max(0, Math.min(1, u)))
  );
};
export const isabelArchY = (span, x) => {
  const u = (x - span[0]) / (span[1] - span[0]);
  return C.springY + C.archRise * 4 * u * (1 - u);
};
const point = (x, y, z) => [x + C.pierSkew * z, y, z];
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
function slab(o, slot, x0, x1, z0, z1, bottom, top, color, n) {
  loft(
    o,
    slot,
    Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      return [
        [x, bottom(x), z0],
        [x, top(x), z0],
        [x, top(x), z1],
        [x, bottom(x), z1],
      ];
    }),
    color,
  );
}
function archRib(o, span, z, S) {
  loft(
    o,
    'iron',
    Array.from({ length: S.arch + 1 }, (_, i) => {
      const x = span[0] + ((span[1] - span[0]) * i) / S.arch,
        y = isabelArchY(span, x);
      return [
        point(x, y - C.archThickness / 2, z - 0.1),
        point(x, y + C.archThickness / 2, z - 0.1),
        point(x, y + C.archThickness / 2, z + 0.1),
        point(x, y - C.archThickness / 2, z + 0.1),
      ];
    }),
    col.iron,
  );
}
export function isabelCircle(span, x) {
  const top = isabelDeckY(x) - 0.65;
  let lo = 0,
    hi = 4.3;
  for (let i = 0; i < 30; i++) {
    const r = (lo + hi) / 2,
      cy = top - r;
    let clear = true;
    for (let k = 0; k <= 32; k++) {
      const a = Math.PI + (Math.PI * k) / 32,
        px = x + r * Math.cos(a),
        py = cy + r * Math.sin(a);
      if (px < span[0] + 0.25 || px > span[1] - 0.25 || py < isabelArchY(span, px) + 0.25) {
        clear = false;
        break;
      }
    }
    if (clear) lo = r;
    else hi = r;
  }
  return { x, y: top - lo, r: lo };
}
function circle(o, c, z, S) {
  const t = S.tri ? 0.055 : 0.045,
    d = S.tri ? 0.06 : 0.075;
  const ring = (a) => {
    const p = (r, zz) => point(c.x + r * Math.cos(a), c.y + r * Math.sin(a), zz);
    return S.tri
      ? [p(c.r - t, z), p(c.r + t, z + d), p(c.r + t, z - d)]
      : [p(c.r - t, z - d), p(c.r - t, z + d), p(c.r + t, z + d), p(c.r + t, z - d)];
  };
  loft(
    o,
    'iron',
    Array.from({ length: S.ring + 1 }, (_, i) => ring((2 * Math.PI * i) / S.ring)),
    col.iron,
    { cap: false },
  );
}
function supportRing(x, y, width, nose) {
  const z = C.halfWidth + 0.2,
    ps = [
      [x - width / 2 + C.pierSkew * -z, y, -z],
      [x + C.pierSkew * (-z - nose), y, -z - nose],
      [x + width / 2 + C.pierSkew * -z, y, -z],
      [x + width / 2 + C.pierSkew * z, y, z],
      [x + C.pierSkew * (z + nose), y, z + nose],
      [x - width / 2 + C.pierSkew * z, y, z],
    ];
  return ps.reverse();
}
function pier(o, x) {
  loft(
    o,
    'stone',
    [
      supportRing(x, -0.7, 4.4, 1.65),
      supportRing(x, 1.05, 4.1, 1.5),
      supportRing(x, 2.45, 3.2, 1.1),
      supportRing(x, isabelDeckY(x) - 0.48, 2.65, 0.35),
    ],
    col.stone,
  );
  loft(
    o,
    'stone',
    [
      supportRing(x, isabelDeckY(x) - 0.5, 3.1, 0.5),
      supportRing(x, isabelDeckY(x) - 0.26, 3.1, 0.5),
    ],
    col.stone,
  );
}
function eastPassage(o, S) {
  const [a, b, r] = C.eastPassage,
    mid = (a + b) / 2,
    rx = (b - a) / 2,
    n = Math.max(4, S.arch),
    z = C.halfWidth;
  for (let i = 1; i <= n; i++) {
    const t0 = Math.PI - (Math.PI * (i - 1)) / n,
      t1 = Math.PI - (Math.PI * i) / n,
      p = [mid + rx * Math.cos(t0), 0.3 + r * Math.sin(t0)],
      q = [mid + rx * Math.cos(t1), 0.3 + r * Math.sin(t1)];
    for (const side of [-1, 1])
      o.addQuad(
        'stone',
        'palette:#ffffff',
        [
          [p[0], p[1], side * z],
          [q[0], q[1], side * z],
          [q[0], isabelDeckY(q[0]) - 0.15, side * z],
          [p[0], isabelDeckY(p[0]) - 0.15, side * z],
        ],
        [0, 0, side],
        [],
        col.stone,
      );
    o.addQuad(
      'stone',
      'palette:#ffffff',
      [
        [p[0], p[1], -z],
        [q[0], q[1], -z],
        [q[0], q[1], z],
        [p[0], p[1], z],
      ],
      [0, -1, 0],
      [],
      col.stone,
    );
  }
  for (const [x0, x1] of [
    [63.65, a],
    [b, C.east],
  ])
    slab(
      o,
      'stone',
      x0,
      x1,
      -z,
      z,
      () => -0.7,
      (x) => isabelDeckY(x) - 0.15,
      col.stone,
      1,
    );
}
function lamp(o, x, z, S) {
  const y = isabelDeckY(x) + 0.12;
  box(o, 'iron', [x - 0.19, y, z - 0.19], [x + 0.19, y + 0.3, z + 0.19], col.iron);
  beam(o, 'iron', [x, y + 0.3, z], [x, y + 4.4, z], 0.1, 0.1, col.iron);
  for (const side of [-1, 1]) {
    beam(o, 'iron', [x, y + 3.3, z], [x + side * 0.72, y + 3.85, z], 0.055, 0.055, col.iron);
    beam(
      o,
      'iron',
      [x + side * 0.72, y + 3.85, z],
      [x + side * 0.72, y + 4.12, z],
      0.055,
      0.055,
      col.iron,
    );
  }
  for (const dx of [-0.72, 0, 0.72]) {
    const yy = y + 4.08 + (dx === 0 ? 0.5 : 0);
    loft(
      o,
      'iron',
      [
        [
          [x + dx - 0.16, yy, z - 0.16],
          [x + dx + 0.16, yy, z - 0.16],
          [x + dx + 0.16, yy, z + 0.16],
          [x + dx - 0.16, yy, z + 0.16],
        ],
        [
          [x + dx - 0.21, yy + 0.48, z - 0.21],
          [x + dx + 0.21, yy + 0.48, z - 0.21],
          [x + dx + 0.21, yy + 0.48, z + 0.21],
          [x + dx - 0.21, yy + 0.48, z + 0.21],
        ],
        [
          [x + dx, yy + 0.7, z],
          [x + dx + 0.01, yy + 0.7, z],
          [x + dx + 0.01, yy + 0.7, z + 0.01],
          [x + dx, yy + 0.7, z + 0.01],
        ],
      ],
      col.iron,
    );
    if (!S.tri)
      box(
        o,
        'mark',
        [x + dx - 0.11, yy + 0.06, z - 0.215],
        [x + dx + 0.11, yy + 0.4, z + 0.215],
        col.glass,
      );
  }
}
function westAbutment(o) {
  const ring = (x) => {
    const at = (z, top) => [
      x === C.west ? x : x - 0.047 * z,
      top ? isabelDeckY(x) - 0.15 : -0.7,
      z,
    ];
    return [
      at(-C.halfWidth, false),
      at(-C.halfWidth, true),
      at(C.halfWidth, true),
      at(C.halfWidth, false),
    ];
  };
  loft(o, 'stone', [ring(C.west), ring(-77.3)], col.stone);
}
function lowerQuays(o, S) {
  for (const q of bank.quays) {
    loft(
      o,
      'paving',
      q.sections.map((p) =>
        [
          [p.leftX, -0.5, p.z],
          [p.leftX, p.y, p.z],
          [p.rightX, p.y, p.z],
          [p.rightX, -0.5, p.z],
        ].reverse(),
      ),
      col.paving,
    );
    for (const side of [-1, 1]) {
      if (S.posts)
        loft(
          o,
          'stone',
          q.sections.map((p) => {
            const x = side < 0 ? p.leftX : p.rightX,
              top = side < 0 ? p.leftBank : p.rightBank;
            return [
              [x - 0.08, -0.5, p.z],
              [x - 0.08, top, p.z],
              [x + 0.08, top, p.z],
              [x + 0.08, -0.5, p.z],
            ].reverse();
          }),
          col.stone,
        );
      else
        for (let i = 1; i < q.sections.length; i++) {
          const a = q.sections[i - 1],
            b = q.sections[i],
            x0 = side < 0 ? a.leftX : a.rightX,
            x1 = side < 0 ? b.leftX : b.rightX;
          o.addQuad(
            'stone',
            'palette:#ffffff',
            [
              [x0, -0.5, a.z],
              [x0, side < 0 ? a.leftBank : a.rightBank, a.z],
              [x1, side < 0 ? b.leftBank : b.rightBank, b.z],
              [x1, -0.5, b.z],
            ],
            [-side, 0, 0],
            [],
            col.stone,
          );
        }
    }
  }
}
export function buildIsabelLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error('Unknown Isabel tier ' + level);
  const far = level === 'skyline',
    o = writer(target, far);
  for (const referenceSpan of C.spans) {
    for (let k = 0; k < S.ribs; k++) {
      const z = -7.55 + (15.1 * k) / (S.ribs - 1),
        span =
          referenceSpan === C.spans[0]
            ? [referenceSpan[0] + (0.1675 - 0.047) * z, referenceSpan[1]]
            : referenceSpan;
      archRib(o, span, z, S);
      if (level !== 'master' && k > 0 && k < S.ribs - 1) continue;
      for (const side of [-1, 1])
        for (const f of [0.12, 0.23, 0.32, 0.39, 0.445].slice(0, S.circles)) {
          const x =
              side < 0 ? span[0] + (span[1] - span[0]) * f : span[1] - (span[1] - span[0]) * f,
            c = isabelCircle(span, x);
          if (c.r > 0.12) circle(o, c, z, S);
        }
    }
    const span = referenceSpan;
    for (let i = 1; i <= S.cross; i++) {
      const x = span[0] + ((span[1] - span[0]) * i) / (S.cross + 1),
        y = isabelArchY(span, x);
      beam(o, 'iron', point(x, y, -7.5), point(x, y, 7.5), 0.12, 0.14, col.iron);
      if (i % 2 === 0)
        beam(
          o,
          'iron',
          point(x, y, -7.5),
          point(
            x + (span[1] - span[0]) / (S.cross + 1),
            isabelArchY(span, Math.min(span[1], x + (span[1] - span[0]) / (S.cross + 1))),
            7.5,
          ),
          0.08,
          0.08,
          col.iron,
        );
    }
  }
  for (const x of C.piers) pier(o, x);
  westAbutment(o);
  eastPassage(o, S);
  slab(
    o,
    'iron',
    C.west,
    C.east,
    -C.halfWidth,
    C.halfWidth,
    (x) => isabelDeckY(x) - 0.65,
    (x) => isabelDeckY(x) - 0.2,
    col.iron,
    far ? 1 : S.arch,
  );
  slab(
    o,
    'road',
    C.west,
    C.east,
    -C.roadHalfWidth,
    C.roadHalfWidth,
    (x) => isabelDeckY(x) - 0.21,
    isabelDeckY,
    col.road,
    far ? 2 : S.arch,
  );
  for (const side of [-1, 1]) {
    const a = side < 0 ? -C.halfWidth : C.roadHalfWidth,
      b = side < 0 ? -C.roadHalfWidth : C.halfWidth;
    slab(
      o,
      'paving',
      C.west,
      C.east,
      a,
      b,
      (x) => isabelDeckY(x) - 0.21,
      (x) => isabelDeckY(x) + 0.12,
      col.paving,
      far ? 2 : S.arch,
    );
    if (S.posts) {
      const z = side * (C.halfWidth - 0.12),
        xs = Array.from(
          { length: S.arch + 1 },
          (_, i) => C.west + ((C.east - C.west) * i) / S.arch,
        );
      for (let i = 1; i < xs.length; i++)
        for (const h of [0.4, 0.86, 1.16])
          beam(
            o,
            'iron',
            [xs[i - 1], isabelDeckY(xs[i - 1]) + h, z],
            [xs[i], isabelDeckY(xs[i]) + h, z],
            0.045,
            0.045,
            col.iron,
          );
      for (let x = C.west + 0.2; x < C.east; x += S.posts)
        box(
          o,
          'iron',
          [x - 0.045, isabelDeckY(x) + 0.13, z - 0.045],
          [x + 0.045, isabelDeckY(x) + 1.24, z + 0.045],
          col.iron,
        );
      if (S.bars)
        for (let x = C.west + 0.2; x < C.east; x += S.bars)
          box(
            o,
            'iron',
            [x - 0.014, isabelDeckY(x) + 0.21, z - 0.014],
            [x + 0.014, isabelDeckY(x) + 1.13, z + 0.014],
            col.iron,
          );
      if (S.lamps)
        for (let i = 0; i < S.lamps; i++) lamp(o, -72 + (134 * i) / (S.lamps - 1), side * 7.8, S);
    }
  }
  lowerQuays(o, S);
  if (S.posts) {
    slab(
      o,
      'mark',
      C.west,
      C.east,
      -0.035,
      0.035,
      isabelDeckY,
      (x) => isabelDeckY(x) + 0.003,
      col.mark,
      8,
    );
    for (const z of [-4.5, 4.5])
      slab(
        o,
        'mark',
        C.west,
        C.east,
        z - 0.035,
        z + 0.035,
        isabelDeckY,
        (x) => isabelDeckY(x) + 0.003,
        col.mark,
        8,
      );
  }
  for (const [x, sign] of [
    [C.west, -1],
    [C.east, 1],
  ]) {
    const y = isabelDeckY(x);
    box(
      o,
      'paving',
      [Math.min(x, x + sign), y - 0.2, -8.45],
      [Math.max(x, x + sign), y, 8.45],
      col.paving,
    );
  }
}
export const buildIsabelSkyline = (o) => buildIsabelLevel(o, 'skyline');
export const buildIsabelDistrict = (o) => buildIsabelLevel(o, 'district');
export const buildIsabelStreet = (o) => buildIsabelLevel(o, 'street');
export const buildIsabelCloseup = (o) => buildIsabelLevel(o, 'closeup');

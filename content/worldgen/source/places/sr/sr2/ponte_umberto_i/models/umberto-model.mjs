/** Original Ponte Umberto I exterior from normal photos and its exact-QID mapped outline. */
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const umbertoControls = {
  half: 52.554,
  width: 21.204,
  originMeters: 9.3,
  waterY: 1.964963150024414,
  profile: [
    [-52.554, 14.9],
    [-20, 15.15],
    [0, 15.3],
    [20, 15.15],
    [52.554, 14.7],
  ],
  openings: [
    { id: 'northwest-arch', cx: -33.25, r: 14.4, spring: 7.0, rise: 6.55 },
    { id: 'middle-arch', cx: 0, r: 14.65, spring: 7.0, rise: 6.7 },
    { id: 'southeast-arch', cx: 33.25, r: 14.4, spring: 7.0, rise: 6.55 },
  ],
  piers: [-16.75, 16.75],
  medianZ: -1.0,
  lamps: [-43, -25, -7, 11, 29, 47],
};
export const umbertoSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.94, metallic: 0 },
  raw: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 1, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.35 },
  glass: {
    slot: 'window',
    localRef: 'palette:#fefdf8',
    roughness: 0.22,
    metallic: 0,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.55],
    doubleSided: true,
  },
};
const C = umbertoControls,
  w = C.width / 2,
  linear = (hex) =>
    hex.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
const colors = {
  stone: linear('d0ccbf'),
  rim: linear('d9d5c8'),
  base: linear('9d9c92'),
  walk: linear('656866'),
  road: linear('44494d'),
  iron: linear('303739'),
  glass: linear('e5ddc5'),
  mark: linear('c9c7bb'),
};
const cfgs = {
  skyline: { curve: 5, piers: 3, rims: 0, posts: 0, lamps: 0, relief: 0, flags: 0 },
  district: { curve: 12, piers: 5, rims: 10, posts: 0, lamps: 1, relief: 0, flags: 0 },
  street: { curve: 24, piers: 8, rims: 22, posts: 7, lamps: 6, relief: 8, flags: 0 },
  closeup: { curve: 48, piers: 12, rims: 38, posts: 4, lamps: 10, relief: 16, flags: 2 },
  master: { curve: 80, piers: 16, rims: 54, posts: 4, lamps: 14, relief: 24, flags: 1 },
};
export function umbertoDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const a = C.profile[i - 1],
      b = C.profile[i];
    if (x <= b[0]) {
      const t = Math.max(0, (x - a[0]) / (b[0] - a[0]));
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return C.profile.at(-1)[1];
}
export function umbertoCrown(h, x, extra = 0) {
  const r = h.r + extra,
    rise = h.rise + extra,
    R = (r * r + rise * rise) / (2 * rise);
  return h.spring + Math.sqrt(Math.max(0, R * R - (x - h.cx) ** 2)) - (R - rise);
}
function writer(target, far) {
  const emit = (component, _ref, p, _n, _uv, tint) => {
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]].map((q) => q.map(Math.fround)),
        n = normalFor(...tri);
      const mean =
        component === 'iron' || component === 'glass' ? [0.66, 0.67, 0.65] : [0.73, 0.72, 0.68];
      target.addTriangle(
        far ? 'far' : component,
        'metric:uv',
        tri,
        n,
        tri.map((q) =>
          Math.abs(n[1]) > 0.7 ? [q[0], q[2]] : Math.abs(n[2]) > 0.7 ? [q[0], q[1]] : [q[2], q[1]],
        ),
        far ? tint.map((v, k) => v * mean[k]) : tint,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
const face = (out, slot, p, color) =>
  out.addConvexPolygon(slot, 'metric:uv', p, normalFor(p[0], p[1], p[2]), [], color);
const archAt = (x) => C.openings.find((h) => Math.abs(x - h.cx) <= h.r + 1e-8);
function core(out, cfg) {
  const cuts = new Set([-C.half, C.half, ...C.profile.map((p) => p[0])]);
  for (const h of C.openings)
    for (let i = 0; i <= cfg.curve; i++) cuts.add(h.cx - h.r * Math.cos((Math.PI * i) / cfg.curve));
  const xs = [...new Set([...cuts].map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      h = archAt((a + b) / 2),
      ya = h ? umbertoCrown(h, a) : 0,
      yb = h ? umbertoCrown(h, b) : 0,
      A = umbertoDeckY(a),
      B = umbertoDeckY(b);
    if (ya >= A || yb >= B) throw Error('Arch crosses bridge deck');
    for (const sign of [-1, 1]) {
      const p = [
        [a, ya, sign * w],
        [b, yb, sign * w],
        [b, B, sign * w],
        [a, A, sign * w],
      ];
      face(out, 'stone', sign > 0 ? p : p.toReversed(), colors.stone);
    }
    face(
      out,
      'raw',
      [
        [a, ya, -w],
        [b, yb, -w],
        [b, yb, w],
        [a, ya, w],
      ],
      colors.base,
    );
    face(
      out,
      'stone',
      [
        [a, A, -w],
        [a, A, w],
        [b, B, w],
        [b, B, -w],
      ],
      colors.stone,
    );
  }
  for (const [x, reverse] of [
    [-C.half, false],
    [C.half, true],
  ]) {
    const p = [
      [x, 0, -w],
      [x, 0, w],
      [x, umbertoDeckY(x), w],
      [x, umbertoDeckY(x), -w],
    ];
    face(out, 'raw', reverse ? p.toReversed() : p, colors.base);
  }
}
function band(out, z0, z1, y0, y1, color, slot = 'stone', xs = C.profile.map((p) => p[0])) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      A = umbertoDeckY(a),
      B = umbertoDeckY(b),
      rings = [
        [
          [a, A + y0, z0],
          [a, A + y0, z1],
          [a, A + y1, z1],
          [a, A + y1, z0],
        ],
        [
          [b, B + y0, z0],
          [b, B + y0, z1],
          [b, B + y1, z1],
          [b, B + y1, z0],
        ],
      ];
    loft(
      out,
      slot,
      rings.map((r) => r.toReversed()),
      color,
    );
  }
}
function cornices(out, far) {
  for (const sign of [-1, 1]) {
    const a = sign * (w - 0.16),
      b = sign * (w + 0.24);
    band(out, Math.min(a, b), Math.max(a, b), -0.18, 0.12, colors.stone);
    if (!far) {
      band(out, Math.min(a, b), Math.max(a, b), -0.48, -0.32, colors.rim);
      band(
        out,
        sign > 0 ? w - 0.06 : -w - 0.13,
        sign > 0 ? w + 0.13 : -w + 0.06,
        -0.32,
        -0.18,
        colors.rim,
      );
    }
  }
}
function parapets(out, cfg) {
  for (const sign of [-1, 1]) {
    const z0 = sign > 0 ? w - 0.62 : -w,
      z1 = sign > 0 ? w : -w + 0.62;
    band(out, z0, z1, 0.07, 1.02, colors.stone);
    band(out, z0 - 0.09, z1 + 0.09, 1.02, 1.18, colors.rim);
    band(out, z0 - 0.04, z1 + 0.04, 0.07, 0.22, colors.rim);
    if (cfg.relief) {
      for (let x = -C.half + 2; x < C.half - 1; x += 3.8) {
        const y = umbertoDeckY(x),
          z = sign * (w - 0.61),
          p = [
            [x - 0.95, y + 0.36, z],
            [x + 0.95, y + 0.36, z],
            [x + 0.95, y + 0.85, z],
            [x - 0.95, y + 0.85, z],
          ];
        face(
          out,
          'raw',
          sign < 0 ? p : p.toReversed(),
          colors.stone.map((v) => v * 0.88),
        );
      }
    }
  }
}
function archRims(out, cfg) {
  if (!cfg.rims) return;
  for (const h of C.openings)
    for (let i = 0; i < cfg.rims; i++) {
      const a = h.cx - h.r * Math.cos((Math.PI * i) / cfg.rims),
        b = h.cx - h.r * Math.cos((Math.PI * (i + 0.98)) / cfg.rims);
      for (const sign of [-1, 1]) {
        const z = sign * (w + 0.022),
          p = [
            [a, umbertoCrown(h, a), z],
            [b, umbertoCrown(h, b), z],
            [b, umbertoCrown(h, b, 0.6), z],
            [a, umbertoCrown(h, a, 0.6), z],
          ];
        face(out, 'raw', sign > 0 ? p : p.toReversed(), colors.rim);
      }
    }
}
function pierHeads(out, cfg) {
  for (const cx of C.piers)
    for (const sign of [-1, 1]) {
      const shape = (y, scale) => {
        const ring = Array.from({ length: cfg.piers + 1 }, (_, i) => {
          const a = (Math.PI * i) / cfg.piers;
          return [cx + Math.cos(a) * 2.05 * scale, y, sign * (w + Math.sin(a) * 1.65 * scale)];
        });
        return sign > 0 ? ring.toReversed() : ring;
      };
      loft(
        out,
        'raw',
        [
          shape(0, 1.14),
          shape(0.65, 1.14),
          shape(0.82, 1.0),
          shape(6.8, 1.0),
          shape(7.05, 1.15),
          shape(7.35, 1.15),
        ],
        colors.base,
      );
      if (cfg.relief) {
        for (let y = 1.15; y < 6.8; y += 0.75) {
          const A = shape(y, 1.012),
            B = shape(y + 0.04, 1.012);
          loft(
            out,
            'raw',
            [A, B],
            colors.base.map((v) => v * 0.83),
            { cap: false },
          );
        }
        box(
          out,
          'stone',
          [cx - 1.45, 7.25, sign > 0 ? w : -w - 0.45],
          [cx + 1.45, umbertoDeckY(cx) - 0.52, sign > 0 ? w + 0.45 : -w],
          colors.stone,
        );
      }
    }
}
function shield(out, cx, sign, cfg) {
  if (!cfg.relief) return;
  const y = 10.6,
    z = sign * (w + 0.48),
    shape = [
      [-0.7, 0.85],
      [0.7, 0.85],
      [0.72, 0.1],
      [0.48, -0.65],
      [0, -1.0],
      [-0.48, -0.65],
      [-0.72, 0.1],
    ],
    points = shape.map(([x, dy]) => [cx + x, y + dy, z]);
  face(out, 'stone', sign > 0 ? points.toReversed() : points, colors.rim);
  if (cfg.relief >= 16) {
    for (const side of [-1, 1])
      for (let i = 0; i < cfg.relief / 2; i++) {
        const a = 0.25 + (2.4 * i) / (cfg.relief / 2 - 1),
          x = cx + side * Math.sin(a) * 1.05,
          Y = y - 0.1 + Math.cos(a) * 1.2,
          dx = side * 0.17,
          dy = 0.12,
          p = [
            [x - dx, Y - dy, z],
            [x, Y + 0.15, z + sign * 0.06],
            [x + dx, Y + dy, z],
            [x, Y - 0.15, z + sign * 0.06],
          ];
        face(out, 'stone', side === sign ? p.toReversed() : p, colors.rim);
      }
    box(
      out,
      'stone',
      [cx - 0.11, y - 0.55, sign > 0 ? z : z - 0.06],
      [cx + 0.11, y + 0.65, sign > 0 ? z + 0.06 : z],
      colors.rim,
    );
    box(
      out,
      'stone',
      [cx - 0.45, y + 0.05, sign > 0 ? z : z - 0.06],
      [cx + 0.45, y + 0.22, sign > 0 ? z + 0.06 : z],
      colors.rim,
    );
  }
}
function ribbon(out, slot, xs, z0, z1, Y, color) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    face(
      out,
      slot,
      [
        [a, Y(a), z0],
        [a, Y(a), z1],
        [b, Y(b), z1],
        [b, Y(b), z0],
      ],
      color,
    );
  }
}
function roadAndWalk(out, cfg) {
  const xs = [
      -C.half - 0.85,
      -C.half,
      -C.half + 2,
      ...C.profile.slice(1, -1).map((p) => p[0]),
      C.half - 2,
      C.half,
      C.half + 0.85,
    ],
    walkY = (x) =>
      umbertoDeckY(x) + 0.015 + 0.16 * Math.max(0, Math.min(1, (C.half - Math.abs(x)) / 2));
  ribbon(out, 'road', xs, -8.2, 6.3, (x) => umbertoDeckY(x) + 0.015, colors.road);
  ribbon(out, 'paving', xs, -10.0, -8.2, walkY, colors.walk);
  ribbon(out, 'paving', xs, 6.3, 10.0, walkY, colors.walk);
  band(out, -1.55, -0.45, 0.02, 0.19, colors.walk, 'paving');
  if (cfg.flags) {
    for (const [z0, z1] of [
      [-10, -8.2],
      [6.3, 10],
    ])
      for (let x = -C.half + 1; x < C.half - 1; x += cfg.flags) {
        const b = Math.min(x + cfg.flags - 0.035, C.half - 1);
        ribbon(
          out,
          'paving',
          [x, b],
          z0 + 0.025,
          z1 - 0.025,
          (q) => walkY(q) + 0.008,
          colors.walk.map((v) => v * (0.96 + 0.04 * Math.sin(x))),
        );
      }
  }
  if (cfg.relief) {
    for (const z of [-8.2, 6.3]) band(out, z - 0.05, z + 0.05, 0.02, 0.16, colors.rim, 'stone');
  }
}
function column(out, slot, cx, cz, profile, sides, color) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * 2 * Math.PI) / sides;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    }),
  );
  loft(out, slot, rings, color);
}
function tube(out, points, r, sides, color) {
  const normalize = (v) => {
      const length = Math.hypot(...v);
      return v.map((n) => n / length);
    },
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    directions = points.slice(1).map((p, i) => normalize(p.map((v, k) => v - points[i][k])));
  let binormal;
  for (let i = 1; i < directions.length; i++) {
    const n = cross(directions[i - 1], directions[i]);
    if (Math.hypot(...n) > 1e-8) {
      binormal = normalize(n);
      break;
    }
  }
  if (!binormal) {
    const t = directions[0];
    binormal = normalize(cross(t, Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  }
  const rings = points.map((p, i) => {
    const tangent =
        i === 0
          ? directions[0]
          : i === points.length - 1
            ? directions.at(-1)
            : normalize(directions[i - 1].map((v, k) => v + directions[i][k])),
      v = cross(binormal, tangent);
    return Array.from({ length: sides }, (_, j) => {
      const a = (-j * 2 * Math.PI) / sides;
      return p.map((value, k) => value + r * (Math.cos(a) * binormal[k] + Math.sin(a) * v[k]));
    });
  });
  loft(out, 'iron', rings, color);
}
function lamps(out, cfg) {
  if (!cfg.lamps) return;
  for (const x of C.lamps) {
    const y = umbertoDeckY(x) + 0.19,
      z = C.medianZ;
    if (cfg.lamps === 1) {
      box(out, 'iron', [x - 0.07, y, z - 0.07], [x + 0.07, y + 5.7, z + 0.07], colors.iron);
      continue;
    }
    const sides = cfg.lamps;
    column(
      out,
      'iron',
      x,
      z,
      [
        [y, 0.24],
        [y + 0.15, 0.24],
        [y + 0.26, 0.17],
        [y + 0.65, 0.14],
        [y + 0.82, 0.1],
        [y + 4.65, 0.065],
        [y + 4.8, 0.11],
        [y + 4.9, 0.07],
      ],
      sides,
      colors.iron,
    );
    const count = Math.max(10, cfg.lamps * 2),
      arm = Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1),
          angle = Math.PI * (1 - t);
        return [x, y + 4.9 + Math.sin(angle) * 0.75, z + 0.72 + Math.cos(angle) * 0.72];
      });
    tube(out, arm, 0.045, Math.max(5, Math.floor(sides / 2)), colors.iron);
    const headZ = z + 1.44;
    column(
      out,
      'iron',
      x,
      headZ,
      [
        [y + 4.9, 0.075],
        [y + 4.82, 0.12],
        [y + 4.68, 0.26],
        [y + 4.6, 0.27],
      ],
      sides,
      colors.iron,
    );
    column(
      out,
      'glass',
      x,
      headZ,
      [
        [y + 4.2, 0.14],
        [y + 4.6, 0.23],
      ],
      sides,
      colors.glass,
    );
    column(
      out,
      'iron',
      x,
      headZ,
      [
        [y + 4.12, 0.08],
        [y + 4.18, 0.17],
        [y + 4.23, 0.17],
      ],
      sides,
      colors.iron,
    );
  }
}
function medianChains(out, cfg) {
  if (!cfg.posts) return;
  for (let x = -C.half + 2; x < C.half - 1; x += cfg.posts) {
    const y = umbertoDeckY(x) + 0.19;
    for (const z of [-1.53, -0.47]) {
      column(
        out,
        'iron',
        x,
        z,
        [
          [y, 0.085],
          [y + 0.08, 0.1],
          [y + 0.65, 0.055],
          [y + 0.73, 0.09],
          [y + 0.81, 0.055],
        ],
        cfg.lamps || 6,
        colors.iron,
      );
      const end = Math.min(x + cfg.posts, C.half - 1),
        points = Array.from({ length: 5 }, (_, i) => {
          const t = i / 4,
            q = x + (end - x) * t;
          return [q, umbertoDeckY(q) + 0.19 + 0.68 - 0.17 * 4 * t * (1 - t), z];
        });
      tube(out, points, 0.018, 4, colors.iron);
    }
  }
}
export function buildUmbertoLevel(target, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Umberto level');
  const out = writer(target, level === 'skyline');
  core(out, cfg);
  cornices(out, level === 'skyline');
  parapets(out, cfg);
  archRims(out, cfg);
  pierHeads(out, cfg);
  for (const cx of C.piers) for (const sign of [-1, 1]) shield(out, cx, sign, cfg);
  roadAndWalk(out, cfg);
  lamps(out, cfg);
  medianChains(out, cfg);
}
/** Small visualization aprons join offset map footways around the original parapet ends.
 * The 105.108m bridge body above is retained unchanged; these are approximate bank paving,
 * not an extension of the arches, parapets or surveyed bridge footprint. */
export function buildUmbertoSiteLevel(target, level = 'master') {
  buildUmbertoLevel(target, level);
  const out = writer(target, level === 'skyline');
  for (const sign of [-1, 1]) {
    const y = umbertoDeckY(sign * C.half) + 0.005;
    const paving = (a, b, z0, z1, slot, color) => {
      const xs = [sign * a, sign * b].sort((a, b) => a - b);
      box(out, slot, [xs[0], y - 0.35, z0], [xs[1], y, z1], color);
    };
    // These strips meet, rather than overlap, the retained 0.85m source thresholds.
    paving(C.half - 0.65, C.half + 0.85, -12.25, -10, 'paving', colors.walk);
    paving(C.half - 0.65, C.half + 0.85, 10, 12.25, 'paving', colors.walk);
    paving(C.half + 0.85, C.half + 2, -12.25, -8.2, 'paving', colors.walk);
    paving(C.half + 0.85, C.half + 2, -8.2, 6.3, 'road', colors.road);
    paving(C.half + 0.85, C.half + 2, 6.3, 12.25, 'paving', colors.walk);
  }
}
export const buildUmbertoSkyline = (out) => buildUmbertoSiteLevel(out, 'skyline');
export const buildUmbertoDistrict = (out) => buildUmbertoSiteLevel(out, 'district');
export const buildUmbertoStreet = (out) => buildUmbertoSiteLevel(out, 'street');
export const buildUmbertoCloseup = (out) => buildUmbertoSiteLevel(out, 'closeup');

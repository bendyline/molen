/** Original Ponte Cavour exterior. Normal photos and retained exact-QID map plan; no surveyed heights. */
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const cavourControls = {
  width: 20.5,
  originMeters: 9.5,
  waterY: 1.20037841796875,
  profile: [
    [-56.265, 12.4],
    [-25.3, 12.55],
    [0, 12.65],
    [25.3, 12.55],
    [56.265, 12.35],
  ],
  plan: [
    [56.265, -11.367],
    [53.993, 11.367],
    [-56.265, 11.367],
    [-51.975, -0.352],
    [-54.793, -10.176],
    [-50.716, -10.221],
  ],
  openings: [
    { id: 'west-small', cx: -45.2, r: 5.6, spring: 5.1, rise: 5.6 },
    { id: 'west-middle', cx: -24.5, r: 10.7, spring: 5.1, rise: 5.9 },
    { id: 'middle', cx: 0, r: 10.7, spring: 5.1, rise: 5.9 },
    { id: 'east-middle', cx: 24.5, r: 10.7, spring: 5.1, rise: 5.9 },
    { id: 'east-small', cx: 45.2, r: 5.6, spring: 5.1, rise: 5.6 },
  ],
  piers: [
    { x: -37.4, width: 4.4 },
    { x: -12.25, width: 3.1 },
    { x: 12.25, width: 3.1 },
    { x: 37.4, width: 4.4 },
  ],
  lamps: [-49, -16.3, 16.3, 49],
};
export const cavourSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.94, metallic: 0 },
  raw: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 1, metallic: 0 },
  soffit: { slot: 'wall', graph: 'brick', roughness: 1, metallic: 0 },
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
const C = cavourControls,
  w = C.width / 2,
  linear = (hex) =>
    hex.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  colors = {
    stone: linear('cec8b9'),
    rim: linear('d4cebf'),
    base: linear('8b8c83'),
    brick: linear('968875'),
    walk: linear('6b6c68'),
    road: linear('4c5151'),
    iron: linear('33413f'),
    glass: linear('e5ddc5'),
  };
const cfgs = {
  skyline: {
    far: true,
    curve: 5,
    heads: 3,
    rims: 0,
    spindles: 0,
    spindleSides: 0,
    spindleProfile: 0,
    lamps: 0,
    stoneLines: false,
  },
  district: {
    curve: 10,
    heads: 4,
    rims: 0,
    spindles: 1.2,
    spindleSides: 4,
    spindleProfile: 1,
    lamps: 1,
    stoneLines: false,
  },
  street: {
    curve: 22,
    heads: 6,
    rims: 18,
    spindles: 0.56,
    spindleSides: 4,
    spindleProfile: 3,
    lamps: 6,
    stoneLines: false,
  },
  closeup: {
    curve: 42,
    heads: 8,
    rims: 32,
    spindles: 0.42,
    spindleSides: 6,
    spindleProfile: 5,
    lamps: 8,
    stoneLines: true,
  },
  master: {
    curve: 64,
    heads: 12,
    rims: 48,
    spindles: 0.42,
    spindleSides: 6,
    spindleProfile: 7,
    lamps: 10,
    stoneLines: true,
  },
};
export function cavourDeckY(x) {
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
export function cavourCrown(h, x, extra = 0) {
  const a = h.r + extra,
    rise = h.rise + extra,
    R = (a * a + rise * rise) / (2 * rise);
  return h.spring + Math.sqrt(Math.max(0, R * R - (x - h.cx) ** 2)) - (R - rise);
}
function clip(poly, axis, value, keepGreater) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      A = keepGreater ? a[axis] >= value - 1e-9 : a[axis] <= value + 1e-9,
      B = keepGreater ? b[axis] >= value - 1e-9 : b[axis] <= value + 1e-9;
    if (A) result.push(a);
    if (A !== B) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return result.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 1e-8,
  );
}
const area = (p) =>
    p.reduce((n, a, i) => {
      const b = p[(i + 1) % p.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
// The retained outline has a <=7.5cm sliver along this20.5m-wide body edge. Snap it
// to the facade plane instead of extruding a tiny solid wall through the west arch.
const clippedPlan = clip(clip(C.plan, 1, -w, true), 1, w, false).map(([x, z]) => [
  x,
  Math.abs(z + w) < 0.08 ? -w : z,
]);
export const cavourPlan = clippedPlan.filter(
  (p, i, a) => Math.abs(cross(a[(i + a.length - 1) % a.length], p, a[(i + 1) % a.length])) > 1e-8,
);
function triangulate(poly) {
  const points = area(poly) > 0 ? poly.slice() : poly.toReversed(),
    result = [];
  while (points.length > 3) {
    let found = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length],
        b = points[i],
        c = points[(i + 1) % points.length];
      if (cross(a, b, c) <= 1e-9) continue;
      if (
        points.some(
          (p) =>
            p !== a &&
            p !== b &&
            p !== c &&
            cross(a, b, p) >= -1e-9 &&
            cross(b, c, p) >= -1e-9 &&
            cross(c, a, p) >= -1e-9,
        )
      )
        continue;
      result.push([a, b, c]);
      points.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid Cavour plan triangulation');
  }
  result.push(points);
  return result;
}
const planTriangles = triangulate(cavourPlan);
export function cavourEdgeX(z, side) {
  const hits = [];
  for (let i = 0; i < cavourPlan.length; i++) {
    const a = cavourPlan[i],
      b = cavourPlan[(i + 1) % cavourPlan.length];
    if (Math.abs(a[1] - z) < 1e-8) hits.push(a[0]);
    if ((a[1] < z && b[1] > z) || (a[1] > z && b[1] < z)) {
      const t = (z - a[1]) / (b[1] - a[1]);
      hits.push(a[0] + t * (b[0] - a[0]));
    }
  }
  if (!hits.length) throw Error(`Outside Cavour plan ${z}`);
  return side < 0 ? Math.min(...hits) : Math.max(...hits);
}
function writer(target, far) {
  const emit = (component, _ref, p, _n, _uv, tint) => {
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]].map((q) => q.map(Math.fround)),
        n = normalFor(...tri);
      target.addTriangle(
        far ? 'far' : component,
        'metric:uv',
        tri,
        n,
        tri.map((q) =>
          Math.abs(n[1]) > 0.7 ? [q[0], q[2]] : Math.abs(n[2]) > 0.7 ? [q[0], q[1]] : [q[2], q[1]],
        ),
        far ? tint.map((v, k) => v * [0.73, 0.72, 0.68][k]) : tint,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
const face = (o, slot, p, color) =>
  o.addConvexPolygon(slot, 'metric:uv', p, normalFor(p[0], p[1], p[2]), [], color);
function surface(o, slot, z0, z1, Y, color, x0 = -100, x1 = 100, up = true) {
  for (const tri of planTriangles) {
    const p = clip(clip(clip(clip(tri, 0, x0, true), 0, x1, false), 1, z0, true), 1, z1, false);
    if (p.length < 3 || Math.abs(area(p)) < 1e-8) continue;
    const q = p.map(([x, z]) => [x, Y(x, z), z]);
    face(o, slot, up ? q.toReversed() : q, color);
  }
}
function bands(
  o,
  z0,
  z1,
  y0,
  y1,
  color,
  slot = 'stone',
  from = cavourEdgeX((z0 + z1) / 2, -1),
  to = cavourEdgeX((z0 + z1) / 2, 1),
) {
  const xs = [from, ...C.profile.map((p) => p[0]).filter((x) => x > from && x < to), to];
  loft(
    o,
    slot,
    xs.map((x) => {
      const y = cavourDeckY(x);
      return [
        [x, y + y0, z0],
        [x, y + y0, z1],
        [x, y + y1, z1],
        [x, y + y1, z0],
      ].toReversed();
    }),
    color,
  );
}
function core(o, cfg) {
  for (const sign of [-1, 1]) {
    const from = cavourEdgeX(sign * w, -1),
      to = cavourEdgeX(sign * w, 1),
      cuts = [from, to, ...C.profile.map((p) => p[0])];
    for (const h of C.openings)
      for (let i = 0; i <= cfg.curve; i++)
        cuts.push(h.cx - h.r * Math.cos((Math.PI * i) / cfg.curve));
    const xs = [
      ...new Set(cuts.filter((x) => x >= from && x <= to).map((x) => Math.round(x * 1e6) / 1e6)),
    ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        h = C.openings.find((h) => Math.abs((a + b) / 2 - h.cx) <= h.r),
        A = h ? cavourCrown(h, a) : 0,
        B = h ? cavourCrown(h, b) : 0,
        p = [
          [a, A, sign * w],
          [b, B, sign * w],
          [b, cavourDeckY(b), sign * w],
          [a, cavourDeckY(a), sign * w],
        ];
      face(o, 'stone', sign > 0 ? p : p.toReversed(), colors.stone);
    }
  }
  for (const h of C.openings)
    for (let i = 0; i < cfg.curve; i++) {
      const a = h.cx - h.r * Math.cos((Math.PI * i) / cfg.curve),
        b = h.cx - h.r * Math.cos((Math.PI * (i + 1)) / cfg.curve),
        A = cavourCrown(h, a),
        B = cavourCrown(h, b);
      face(
        o,
        'soffit',
        [
          [a, A, -w],
          [b, B, -w],
          [b, B, w],
          [a, A, w],
        ],
        colors.brick,
      );
    }
  const sorted = C.openings.toSorted((a, b) => a.cx - b.cx),
    xs = [-60, ...sorted.flatMap((h) => [h.cx - h.r, h.cx + h.r]), 60];
  if (!cfg.far)
    for (let i = 0; i + 1 < xs.length; i += 2)
      surface(o, 'raw', -w, w, () => 0, colors.base, xs[i], xs[i + 1], false);
  for (let i = 0; i < cavourPlan.length; i++) {
    const a = cavourPlan[i],
      b = cavourPlan[(i + 1) % cavourPlan.length];
    if (Math.abs(a[1] - b[1]) < 1e-8 && Math.abs(Math.abs(a[1]) - w) < 1e-8) continue;
    face(
      o,
      'raw',
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], cavourDeckY(b[0]), b[1]],
        [a[0], cavourDeckY(a[0]), a[1]],
      ].toReversed(),
      colors.base,
    );
  }
  if (!cfg.far)
    for (let i = 1; i < C.profile.length; i++)
      surface(o, 'stone', -w, w, cavourDeckY, colors.stone, C.profile[i - 1][0], C.profile[i][0]);
}
function cornices(o, far) {
  for (const sign of [-1, 1]) {
    const z = sign * w,
      from = cavourEdgeX(z, -1),
      to = cavourEdgeX(z, 1);
    bands(o, z - 0.17, z + 0.17, -0.2, 0.12, colors.rim, 'stone', from, to);
    if (!far) {
      bands(o, z - 0.13, z + 0.13, -0.5, -0.34, colors.stone, 'stone', from, to);
      bands(o, z - 0.19, z + 0.19, -0.34, -0.2, colors.rim, 'stone', from, to);
    }
  }
}
function column(o, slot, x, z, profile, sides, color) {
  loft(
    o,
    slot,
    profile.map(([y, r]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (-i * 2 * Math.PI) / sides;
        return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      }),
    ),
    color,
  );
}
function pierHeads(o, cfg) {
  for (const { x, width } of C.piers)
    for (const sign of [-1, 1]) {
      const h = width / 2 - 0.25,
        shape = (y, scale) => {
          const ring = Array.from({ length: cfg.heads + 1 }, (_, i) => {
            const a = (Math.PI * i) / cfg.heads;
            return [x + Math.cos(a) * h * scale, y, sign * (w + Math.sin(a) * 1.1 * scale)];
          });
          return sign > 0 ? ring.toReversed() : ring;
        };
      loft(
        o,
        'raw',
        cfg.far
          ? [shape(0, 1), shape(4.3, 1)]
          : [
              shape(0, 1.12),
              shape(0.42, 1.12),
              shape(0.6, 1),
              shape(3.9, 1),
              shape(4.1, 1.08),
              shape(4.3, 1.08),
            ],
        colors.base,
      );
      box(
        o,
        'stone',
        [x - width * 0.38, 4.25, sign > 0 ? w : -w - 0.25],
        [x + width * 0.38, cavourDeckY(x) - 0.52, sign > 0 ? w + 0.25 : -w],
        colors.stone,
      );
      if (cfg.stoneLines)
        for (let y = 0.9; y < 3.9; y += 0.63)
          loft(
            o,
            'raw',
            [shape(y, 1.01), shape(y + 0.035, 1.01)],
            colors.base.map((v) => v * 0.86),
            { cap: false },
          );
      if (cfg.stoneLines)
        for (let y = 5; y < cavourDeckY(x) - 0.6; y += 0.8)
          box(
            o,
            'raw',
            [x - width * 0.38, y, sign > 0 ? w + 0.251 : -w - 0.27],
            [x + width * 0.38, y + 0.035, sign > 0 ? w + 0.27 : -w - 0.251],
            colors.stone.map((v) => v * 0.88),
          );
    }
}
function archRims(o, cfg) {
  if (!cfg.rims) return;
  for (const h of C.openings)
    for (let i = 0; i < cfg.rims; i++) {
      const a = h.cx - h.r * Math.cos((Math.PI * i) / cfg.rims),
        b = h.cx - h.r * Math.cos((Math.PI * (i + 0.985)) / cfg.rims);
      for (const sign of [-1, 1]) {
        const z = sign * (w + 0.024),
          p = [
            [a, cavourCrown(h, a), z],
            [b, cavourCrown(h, b), z],
            [b, cavourCrown(h, b, 0.45), z],
            [a, cavourCrown(h, a, 0.45), z],
          ];
        face(o, 'stone', sign > 0 ? p : p.toReversed(), colors.rim);
      }
    }
}
function balustrades(o, cfg) {
  for (const sign of [-1, 1]) {
    const z = sign * (w - 0.35),
      from = cavourEdgeX(sign * w, -1) + 0.3,
      to = cavourEdgeX(sign * w, 1) - 0.3;
    if (cfg.far) {
      bands(o, z - 0.25, z + 0.25, 0.12, 1.18, colors.stone, 'stone', from, to);
      continue;
    }
    bands(o, z - 0.25, z + 0.25, 0.12, 0.3, colors.rim, 'stone', from, to);
    bands(o, z - 0.29, z + 0.29, 1.02, 1.18, colors.rim, 'stone', from, to);
    const posts = [from + 0.55, ...C.piers.map((p) => p.x), to - 0.55],
      allPosts = [];
    for (let i = 1; i < posts.length; i++) {
      const a = posts[i - 1],
        b = posts[i],
        n = Math.ceil((b - a) / 8);
      for (let j = 0; j < n; j++) allPosts.push(a + ((b - a) * j) / n);
    }
    allPosts.push(posts.at(-1));
    for (const x of allPosts) {
      const y = cavourDeckY(x);
      box(o, 'stone', [x - 0.28, y + 0.18, z - 0.27], [x + 0.28, y + 1.13, z + 0.27], colors.stone);
    }
    if (!cfg.spindles) {
      bands(o, z - 0.12, z + 0.12, 0.3, 1.02, colors.stone, 'stone', from, to);
      continue;
    }
    for (let i = 1; i < allPosts.length; i++) {
      const a = allPosts[i - 1] + 0.42,
        b = allPosts[i] - 0.42,
        n = Math.max(1, Math.floor((b - a) / cfg.spindles));
      for (let j = 0; j < n; j++) {
        const x = a + ((b - a) * (j + 0.5)) / n,
          y = cavourDeckY(x),
          profile =
            cfg.spindleProfile === 1
              ? [
                  [y + 0.3, 0.105],
                  [y + 1.02, 0.105],
                ]
              : cfg.spindleProfile === 3
                ? [
                    [y + 0.3, 0.13],
                    [y + 0.58, 0.095],
                    [y + 0.78, 0.16],
                    [y + 1.02, 0.12],
                  ]
                : cfg.spindleProfile === 5
                  ? [
                      [y + 0.3, 0.14],
                      [y + 0.38, 0.14],
                      [y + 0.5, 0.095],
                      [y + 0.72, 0.17],
                      [y + 0.86, 0.135],
                      [y + 1.02, 0.12],
                    ]
                  : [
                      [y + 0.3, 0.14],
                      [y + 0.38, 0.14],
                      [y + 0.48, 0.09],
                      [y + 0.61, 0.13],
                      [y + 0.73, 0.17],
                      [y + 0.83, 0.145],
                      [y + 0.91, 0.11],
                      [y + 1.02, 0.12],
                    ];
        column(o, 'stone', x, z, profile, cfg.spindleSides, colors.stone);
      }
    }
  }
}
function roadAndWalk(o, far) {
  if (far) {
    surface(o, 'road', -7.2, 5.5, cavourDeckY, colors.road);
    surface(o, 'paving', -w, -7.2, cavourDeckY, colors.walk);
    surface(o, 'paving', 5.5, w, cavourDeckY, colors.walk);
    return;
  }
  const xs = [...C.profile.map((p) => p[0]), -54, -52, 52, 54].sort((a, b) => a - b),
    walk = (x, z) =>
      cavourDeckY(x) +
      0.015 +
      0.16 * Math.max(0, Math.min(1, Math.min(x - cavourEdgeX(z, -1), cavourEdgeX(z, 1) - x) / 2));
  for (let i = 1; i < xs.length; i++) {
    surface(o, 'road', -7.2, 5.5, (x) => cavourDeckY(x) + 0.015, colors.road, xs[i - 1], xs[i]);
    surface(o, 'paving', -w + 0.6, -7.2, walk, colors.walk, xs[i - 1], xs[i]);
    surface(o, 'paving', 5.5, w - 0.6, walk, colors.walk, xs[i - 1], xs[i]);
  }
  for (const z of [-7.2, 5.5]) bands(o, z - 0.035, z + 0.035, 0.015, 0.16, colors.rim, 'stone');
}
function tube(o, points, r, sides, color) {
  const normalize = (v) => {
      const l = Math.hypot(...v);
      return v.map((n) => n / l);
    },
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    ds = points.slice(1).map((p, i) => normalize(p.map((v, k) => v - points[i][k])));
  let binormal;
  for (let i = 1; i < ds.length; i++) {
    const n = cross(ds[i - 1], ds[i]);
    if (Math.hypot(...n) > 1e-8) {
      binormal = normalize(n);
      break;
    }
  }
  if (!binormal) binormal = [0, 0, 1];
  loft(
    o,
    'iron',
    points.map((p, i) => {
      const t =
          i === 0
            ? ds[0]
            : i === points.length - 1
              ? ds.at(-1)
              : normalize(ds[i - 1].map((v, k) => v + ds[i][k])),
        v = cross(binormal, t);
      return Array.from({ length: sides }, (_, j) => {
        const a = (-j * 2 * Math.PI) / sides;
        return p.map((q, k) => q + r * (Math.cos(a) * binormal[k] + Math.sin(a) * v[k]));
      });
    }),
    color,
  );
}
function lamps(o, cfg) {
  if (!cfg.lamps) return;
  for (const x of C.lamps)
    for (const sign of [-1, 1]) {
      const z = sign * (w - 0.9),
        y = cavourDeckY(x) + 0.16;
      if (cfg.lamps === 1) {
        box(o, 'iron', [x - 0.06, y, z - 0.06], [x + 0.06, y + 5.5, z + 0.06], colors.iron);
        box(o, 'iron', [x - 0.75, y + 5.1, z - 0.045], [x + 0.75, y + 5.2, z + 0.045], colors.iron);
        continue;
      }
      const sides = cfg.lamps;
      column(
        o,
        'iron',
        x,
        z,
        [
          [y, 0.2],
          [y + 0.18, 0.2],
          [y + 0.35, 0.13],
          [y + 0.75, 0.11],
          [y + 4.6, 0.065],
          [y + 5.2, 0.08],
          [y + 5.6, 0.035],
        ],
        sides,
        colors.iron,
      );
      for (const direction of [-1, 1]) {
        const count = Math.max(8, cfg.lamps * 2),
          points = Array.from({ length: count }, (_, i) => {
            const t = i / (count - 1),
              a = Math.PI * (1 - t);
            return [x + direction * (0.66 + 0.66 * Math.cos(a)), y + 5.1 + 0.68 * Math.sin(a), z];
          });
        tube(o, points, 0.045, Math.max(4, Math.floor(sides / 2)), colors.iron);
        const X = x + direction * 1.32;
        column(
          o,
          'iron',
          X,
          z,
          [
            [y + 5.1, 0.065],
            [y + 4.98, 0.12],
            [y + 4.86, 0.24],
            [y + 4.78, 0.24],
          ],
          sides,
          colors.iron,
        );
        column(
          o,
          'glass',
          X,
          z,
          [
            [y + 4.4, 0.12],
            [y + 4.78, 0.21],
          ],
          sides,
          colors.glass,
        );
        column(
          o,
          'iron',
          X,
          z,
          [
            [y + 4.33, 0.07],
            [y + 4.39, 0.15],
            [y + 4.43, 0.15],
          ],
          sides,
          colors.iron,
        );
      }
    }
}
export function buildCavourLevel(target, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Cavour level');
  const o = writer(target, level === 'skyline');
  core(o, cfg);
  cornices(o, level === 'skyline');
  pierHeads(o, cfg);
  archRims(o, cfg);
  roadAndWalk(o, cfg.far);
  balustrades(o, cfg);
  lamps(o, cfg);
}
/** Approximate upper-bank paving around the retained irregular masonry wings.
 * Thin slabs leave the independent lower river walk/cycleway open beneath them. */
export function buildCavourSiteLevel(target, level = 'master') {
  buildCavourLevel(target, level);
  const o = writer(target, level === 'skyline');
  const zs = [-12.5, -w, -7.2, -0.352, 5.5, w, 12.5];
  const exactProfile = !['skyline', 'district'].includes(level);
  for (const sign of [-1, 1]) {
    const outer = sign * 58.5,
      inner = sign < 0 ? -54.25 : 53.25;
    for (let i = 1; i < zs.length; i++) {
      const a = zs[i - 1],
        b = zs[i],
        mid = (a + b) / 2;
      const outside = Math.abs(mid) > w;
      const A = outside ? inner : cavourEdgeX(a, sign);
      const B = outside ? inner : cavourEdgeX(b, sign);
      let polygon = [
        [outer, a],
        [A, a],
        [B, b],
        [outer, b],
      ];
      if (area(polygon) < 0) polygon = polygon.toReversed();
      const xmin = Math.min(...polygon.map((p) => p[0])),
        xmax = Math.max(...polygon.map((p) => p[0]));
      const cuts = [
        xmin,
        ...(exactProfile ? C.profile.map((p) => p[0]).filter((x) => x > xmin && x < xmax) : []),
        xmax,
      ];
      for (let j = 1; j < cuts.length; j++) {
        const p = clip(clip(polygon, 0, cuts[j - 1], true), 0, cuts[j], false);
        if (p.length < 3 || Math.abs(area(p)) < 1e-8) continue;
        const slot = mid >= -7.2 && mid <= 5.5 ? 'road' : 'paving';
        const color = slot === 'road' ? colors.road : colors.walk;
        const top = p.map(([x, z]) => [x, cavourDeckY(x) + 0.005, z]);
        const bottom = top.map(([x, y, z]) => [x, y - 0.35, z]);
        face(o, slot, top.toReversed(), color);
        face(o, slot, bottom, color);
        for (let k = 0; k < p.length; k++) {
          const next = (k + 1) % p.length;
          face(o, slot, [bottom[k], top[k], top[next], bottom[next]], color);
        }
      }
    }
  }
}
export const buildCavourSkyline = (o) => buildCavourSiteLevel(o, 'skyline');
export const buildCavourDistrict = (o) => buildCavourSiteLevel(o, 'district');
export const buildCavourStreet = (o) => buildCavourSiteLevel(o, 'street');
export const buildCavourCloseup = (o) => buildCavourSiteLevel(o, 'closeup');

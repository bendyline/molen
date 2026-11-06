import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [28.50603056, -29.33708333],
  heading: 0.40069262057,
  datum: 2055.506213125,
  crest: [
    [-297.5796, 144.34564],
    [-284.23391, 136.80336],
    [-276.8008, 132.60256],
    [-259.47801, 115.06526],
    [-230.16502, 87.90792],
    [-199.33238, 64.50364],
    [-182.9715, 53.90828],
    [-166.19617, 44.33649],
    [-132.97836, 27.31328],
    [-95.3166, 10.47641],
    [-72.96386, 2.41912],
    [-35.20385, -7.30925],
    [6.74047, -13.56907],
    [47.00376, -13.19133],
    [62.35445, -12.05957],
    [77.67684, -9.52639],
    [95.81039, -4.95434],
    [124.24985, 3.9834],
    [157.80399, 18.19726],
    [179.14315, 29.21552],
    [199.39381, 41.46875],
    [219.92907, 56.38669],
    [257.5876, 87.604],
    [274.19491, 103.11944],
    [292.28519, 121.80721],
    [298.91946, 130.83653],
    [302.32814, 136.80336],
    [309.93212, 150.11399],
  ],
  crestElevation: 2060,
  foundationElevation: 1875,
  normalPool: 2053,
  stages: [
    [1875, 0.25, 53, 60],
    [1912, 0.42, 35, 52],
    [1948, 0.57, 19, 37],
    [1988, 0.74, 4, 24],
    [2025, 0.88, -6, 15],
    [2060, 1, -13.6, 9],
  ],
  overflow: {
    stationStart: 351,
    arcLength: 150,
    level: 2053,
    soffit: 2059.1,
    bays: 10,
  },
  low: {
    span: [-211, -134],
    low: 1913,
    high: 1929,
    depth: 9,
    bays: 2,
  },
  tailDam: {
    axis: [
      [-16.99595, 299.05875],
      [82.41104, 269.49104],
    ],
    crest: 1904,
    foundation: 1887,
    plunge: 1901.4,
    tailwater: 1899.8,
  },
};
const color = {
  board: [0.255, 0.243, 0.231],
  dark: [0.095, 0.106, 0.103],
  light: [0.57, 0.54, 0.485],
  stain: [0.215, 0.202, 0.191],
  paving: [0.42, 0.395, 0.35],
  green: [0.24, 0.31, 0.25],
  frame: [0.36, 0.39, 0.38],
  glazing: [0.18, 0.27, 0.3],
  stone: [0.43, 0.38, 0.29],
};
export const damSurfaces = {
  board: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  stain: { slot: 'wall', graph: 'concrete_boardformed' },
  light: { slot: 'wall', graph: 'concrete_plain' },
  paving: { slot: 'foundation', graph: 'concrete_plain' },
  green: { slot: 'door', graph: 'metal_painted' },
  frame: { slot: 'door', graph: 'metal_painted' },
  glazing: { slot: 'window', graph: 'window_grid' },
  stone: { slot: 'foundation', graph: 'gravel' },
};
const levels = {
  skyline: { stride: 6 },
  district: { stride: 3, edges: true },
  street: { stride: 2, edges: true, rails: true },
  closeup: { stride: 1, edges: true, rails: true, details: true, joints: true },
  master: { stride: 1, edges: true, rails: true, details: true, joints: true },
};
const { datum, crest, crestElevation, foundationElevation, stages, overflow, low, tailDam } =
  controls;
const first = crest[0][0],
  last = crest.at(-1)[0],
  center = 24;
const y = (e) => e - datum,
  lerp = (a, b, t) => a + (b - a) * t;
function interpolated(table, x) {
  const j = table.findIndex((p) => p[0] >= x);
  if (j <= 0) return table[j === 0 ? 0 : table.length - 1].slice(1);
  const a = table[j - 1],
    b = table[j],
    u = (x - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => lerp(v, b[i + 1], u));
}
const centerLine = interpolated(crest, center)[0];
function P(u, height, side = 1, offset = 0) {
  const [scale, depth, thickness] = interpolated(stages, height);
  const z = interpolated(crest, u)[0];
  return [
    center + (u - center) * scale,
    y(height),
    centerLine + depth + 13.6 + (z - centerLine) * scale + side * thickness * 0.5 + offset,
  ];
}
function face(out, points, material, expected) {
  let normal = normalFor(...points);
  if (normal.reduce((a, v, i) => a + v * expected[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3)
    out.addTriangle(material, 'palette:#ffffff', points, normal, undefined, color[material]);
  else out.addQuad(material, 'palette:#ffffff', points, normal, undefined, color[material]);
}
const rod = (out, m, a, b, w, d) => beam(out, m, a, b, w, d, color[m]);
function box(out, a, b, lo, hi, z, w, m) {
  face(
    out,
    [
      [a, lo, z],
      [b, lo, z],
      [b, hi, z],
      [a, hi, z],
    ],
    m,
    [0, 0, -1],
  );
  face(
    out,
    [
      [a, lo, w],
      [b, lo, w],
      [b, hi, w],
      [a, hi, w],
    ],
    m,
    [0, 0, 1],
  );
  face(
    out,
    [
      [a, hi, z],
      [b, hi, z],
      [b, hi, w],
      [a, hi, w],
    ],
    m,
    [0, 1, 0],
  );
  face(
    out,
    [
      [a, lo, z],
      [b, lo, z],
      [b, lo, w],
      [a, lo, w],
    ],
    m,
    [0, -1, 0],
  );
  face(
    out,
    [
      [a, lo, z],
      [a, hi, z],
      [a, hi, w],
      [a, lo, w],
    ],
    m,
    [-1, 0, 0],
  );
  face(
    out,
    [
      [b, lo, z],
      [b, hi, z],
      [b, hi, w],
      [b, lo, w],
    ],
    m,
    [1, 0, 0],
  );
}
function stations(a, b, detail) {
  return [
    a,
    ...crest.filter((p, i) => i % detail.stride === 0 && p[0] > a && p[0] < b).map((p) => p[0]),
    b,
  ];
}
function patch(out, detail, a, b, low, high, side = 1, material = 'board', offset = 0) {
  const xs = stations(a, b, detail),
    ys = [low, ...stages.map((p) => p[0]).filter((h) => h > low && h < high), high];
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const [u, v] = [xs[i - 1], xs[i]],
        [l, h] = [ys[j - 1], ys[j]];
      face(
        out,
        [
          P(u, l, side, offset),
          P(v, l, side, offset),
          P(v, h, side, offset),
          P(u, h, side, offset),
        ],
        material,
        [0, 0, side],
      );
    }
}

const arc = [0];
for (let i = 1; i < crest.length; i++)
  arc.push(arc.at(-1) + Math.hypot(crest[i][0] - crest[i - 1][0], crest[i][1] - crest[i - 1][1]));
function uAt(station) {
  const i = arc.findIndex((v) => v >= station);
  return lerp(crest[i - 1][0], crest[i][0], (station - arc[i - 1]) / (arc[i] - arc[i - 1]));
}
const spillLeft = uAt(overflow.stationStart),
  spillRight = uAt(overflow.stationStart + overflow.arcLength);
function overflowWorks(out, detail) {
  const { level, soffit, bays, stationStart, arcLength } = overflow,
    interval = arcLength / bays;
  for (const side of [-1, 1]) {
    patch(out, detail, first, spillLeft, level, soffit, side);
    patch(out, detail, spillRight, last, level, soffit, side);
  }
  for (let i = 0; i < bays; i++) {
    const station = stationStart + i * interval;
    const a = uAt(station),
      b = uAt(station + interval),
      l = uAt(station + 0.83),
      r = uAt(station + interval - 0.83);
    for (const side of [-1, 1]) {
      patch(out, detail, a, l, level, soffit, side);
      patch(out, detail, r, b, level, soffit, side);
    }
    for (const [u, normal] of [
      [l, 1],
      [r, -1],
    ]) {
      face(out, [P(u, level, -1), P(u, level), P(u, soffit), P(u, soffit, -1)], 'light', [
        normal,
        0,
        0,
      ]);
    }
    face(out, [P(l, level, -1), P(r, level, -1), P(r, level), P(l, level)], 'light', [0, 1, 0]);
    face(
      out,
      [P(l, soffit, -1), P(r, soffit, -1), P(r, soffit), P(l, soffit)],
      'board',
      [0, -1, 0],
    );
    if (detail.edges) {
      face(
        out,
        [P(l, level), P(r, level), P(r, level - 3.7, 1, 5.2), P(l, level - 3.7, 1, 5.2)],
        'light',
        [0, 1, 1],
      );
      for (const [u, dir] of [
        [l, -1],
        [r, 1],
      ]) {
        face(out, [P(u, level), P(u, level - 3.7, 1, 5.2), P(u, level - 3.7)], 'board', [
          dir,
          0,
          0,
        ]);
      }
    }
  }
}
function lowWorks(out, detail) {
  const [a, b] = low.span,
    step = (b - a) / low.bays,
    { low: h, high: k, depth } = low;
  patch(out, detail, first, a, h, k);
  patch(out, detail, b, last, h, k);
  for (let i = 0; i < low.bays; i++) {
    const u = a + i * step,
      v = u + step,
      l = u + step * 0.16,
      r = v - step * 0.16;
    patch(out, detail, u, l, h, k);
    patch(out, detail, r, v, h, k);
    patch(out, detail, l, r, h, k, 1, 'dark', -depth);
    for (const [x, dir] of [
      [l, 1],
      [r, -1],
    ])
      face(out, [P(x, h), P(x, k), P(x, k, 1, -depth), P(x, h, 1, -depth)], 'light', [dir, 0, 0]);
    face(out, [P(l, h), P(r, h), P(r, h, 1, -depth), P(l, h, 1, -depth)], 'board', [0, 1, 0]);
    face(out, [P(l, k), P(r, k), P(r, k, 1, -depth), P(l, k, 1, -depth)], 'board', [0, -1, 0]);
  }
  if (detail.edges) {
    face(out, [P(a, k), P(b, k), P(b, k, 1, 6.3), P(a, k, 1, 6.3)], 'paving', [0, 1, 0]);
    face(
      out,
      [P(a, k, 1, 6.3), P(b, k, 1, 6.3), P(b, k + 3.4, 1, 6.3), P(a, k + 3.4, 1, 6.3)],
      'light',
      [0, 0, 1],
    );
    face(
      out,
      [P(a, k + 3.4), P(b, k + 3.4), P(b, k + 3.4, 1, 6.3), P(a, k + 3.4, 1, 6.3)],
      'paving',
      [0, 1, 0],
    );
    for (const [u, dir] of [
      [a, -1],
      [b, 1],
    ])
      face(out, [P(u, k), P(u, k, 1, 6.3), P(u, k + 3.4, 1, 6.3), P(u, k + 3.4)], 'board', [
        dir,
        0,
        0,
      ]);
  }
}
function arch(out, detail) {
  for (const side of [-1, 1]) {
    if (side === 1) {
      patch(out, detail, first, last, foundationElevation, low.low);
      patch(out, detail, first, last, low.high, overflow.level);
    } else patch(out, detail, first, last, foundationElevation, overflow.level, side);
    patch(out, detail, first, last, overflow.soffit, crestElevation, side);
  }
  lowWorks(out, detail);
  overflowWorks(out, detail);
  const xs = stations(first, last, detail);
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = [xs[i - 1], xs[i]];
    for (const [height, mat, normal] of [
      [crestElevation, 'paving', 1],
      [foundationElevation, 'board', -1],
    ]) {
      face(out, [P(a, height, -1), P(b, height, -1), P(b, height), P(a, height)], mat, [
        0,
        normal,
        0,
      ]);
    }
    if (detail.rails)
      for (const side of [-1, 1]) {
        const rail = (u) =>
          P(u, crestElevation, side, -side * 0.31).map((v, j) => (j === 1 ? v + 0.35 : v));
        rod(out, 'frame', rail(a), rail(b), 0.2, 0.57);
      }
  }
  for (const [u, dir] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < stages.length; i++) {
      const a = stages[i - 1][0],
        b = stages[i][0];
      face(out, [P(u, a, -1), P(u, b, -1), P(u, b), P(u, a)], 'board', [dir, 0, 0]);
    }
  if (detail.joints)
    for (const [u] of crest.slice(1, -1)) {
      if (u > low.span[0] && u < low.span[1]) continue;
      patch(out, detail, u - 0.11, u + 0.11, 1911, 2052.1, 1, 'stain', 0.055);
    }
}
function tailwaterDam(out, detail) {
  const [a, b] = tailDam.axis,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    c = dx / length,
    s = dz / length;
  const p = (x, h, z) => [a[0] + x * c - z * s, y(h), a[1] + x * s + z * c];
  const slab = (a, b, h, k, z, w, m) => {
    face(out, [p(a, h, z), p(b, h, z), p(b, k, z), p(a, k, z)], m, [0, 0, -1]);
    face(out, [p(a, h, w), p(b, h, w), p(b, k, w), p(a, k, w)], m, [0, 0, 1]);
    face(out, [p(a, k, z), p(b, k, z), p(b, k, w), p(a, k, w)], m, [0, 1, 0]);
    for (const [x, dir] of [
      [a, -1],
      [b, 1],
    ])
      face(out, [p(x, h, z), p(x, h, w), p(x, k, w), p(x, k, z)], m, [dir, 0, 0]);
  };
  const { foundation, crest } = tailDam;
  slab(0, length, foundation, crest - 5.4, -2.6, 7.2, 'board');
  slab(0, 24, foundation, crest, -3.2, 4.1, 'board');
  slab(length - 25, length, foundation, crest, -3.2, 4.1, 'board');
  const span = (length - 49) / 4;
  for (let i = 0; i <= 4; i++) {
    const x = 24 + i * span;
    slab(x - 1.45, x + 1.45, foundation, crest + 0.3, -2.1, 10.8, 'light');
    if (detail.edges)
      face(
        out,
        [
          p(x - 1.45, crest + 0.3, 6),
          p(x + 1.45, crest + 0.3, 6),
          p(x + 1.45, foundation + 1, 17),
          p(x - 1.45, foundation + 1, 17),
        ],
        'light',
        [0, 1, 1],
      );
  }
  if (detail.rails) {
    rod(out, 'frame', p(0.5, crest + 0.42, -2.5), p(23.7, crest + 0.42, -2.5), 0.16, 0.19);
    rod(
      out,
      'frame',
      p(length - 24.5, crest + 0.42, -2.5),
      p(length - 0.5, crest + 0.42, -2.5),
      0.16,
      0.19,
    );
  }
}
function crestBuildings(out, detail) {
  if (!detail.edges) return;
  for (const u of [-53, 173]) {
    const [x, , z] = P(u, crestElevation, 0);
    box(out, x - 4.2, x + 4.2, y(2060), y(2063.2), z - 3.2, z + 0.6, 'light');
    box(out, x - 4.55, x + 4.55, y(2063.2), y(2063.52), z - 3.4, z + 0.83, 'green');
    if (detail.details)
      box(out, x - 2.6, x + 2.6, y(2061.25), y(2062.65), z + 0.62, z + 0.73, 'glazing');
  }
}
export function buildDamLevel(out, level) {
  const detail = levels[level];
  if (!detail) throw Error('Unknown Katse Dam detail level: ' + level);
  arch(out, detail);
  tailwaterDam(out, detail);
  crestBuildings(out, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
export const sampleArchPoint = P;

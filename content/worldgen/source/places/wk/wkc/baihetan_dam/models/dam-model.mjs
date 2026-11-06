import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [102.9030588, 27.2231173],
  heading: 3.109648611653,
  datum: 644.781044625,
  crest: [
    [-251.776, 148.1087],
    [-242.43921, 128.63064],
    [-227.13245, 102.35626],
    [-209.44029, 77.58166],
    [-189.58298, 54.25978],
    [-168.10867, 32.71333],
    [-144.78452, 12.95835],
    [-119.81557, -4.50816],
    [-93.46532, -19.94598],
    [-65.73369, -33.08214],
    [-37.1556, -43.89851],
    [-7.73298, -52.12961],
    [22.30443, -57.77827],
    [52.69, -60.83351],
    [83.18627, -61.28529],
    [113.46546, -59.38968],
    [143.8395, -54.62665],
    [173.5124, -47.49825],
    [202.47774, -37.743],
    [230.47965, -25.61279],
    [257.11726, -11.18192],
    [297.49922, 16.54681],
    [333.4668, 49.53194],
    [339.72715, 57.01881],
  ],
  crestElevation: 834,
  foundationElevation: 545,
  normalPool: 825,
  stages: [
    [545, 0.21, 26, 78],
    [610, 0.32, 23, 73],
    [660, 0.43, 13, 60],
    [710, 0.59, -9, 46],
    [750, 0.74, -32, 33],
    [790, 0.9, -49, 22],
    [834, 1, -58, 13.5],
  ],
  upper: {
    span: [-101, 133],
    low: 794,
    high: 822,
    bays: 6,
    depth: 11,
  },
  deep: {
    span: [-137, 169],
    low: 737,
    high: 754,
    bays: 7,
    depth: 16,
  },
  weir: {
    axis: [
      [-98.2608, 92.3906],
      [3.88497, 80.0947],
      [80.24465, 75.52949],
    ],
    crest: 650,
  },
  plunge: {
    waterStage: 643,
    downstreamStage: 632,
    west: [
      [-98.2608, 92.3906],
      [-92, 69],
      [-77, 43],
    ],
    east: [
      [80.24465, 75.52949],
      [72, 60],
      [62, 39],
    ],
  },
};
const color = {
  board: [0.46, 0.445, 0.408],
  dark: [0.18, 0.19, 0.18],
  light: [0.62, 0.6, 0.55],
  stain: [0.38, 0.359, 0.321],
  paving: [0.43, 0.41, 0.38],
  red: [0.65, 0.125, 0.064],
  frame: [0.34, 0.37, 0.37],
  glazing: [0.24, 0.33, 0.37],
  stone: [0.42, 0.37, 0.33],
};
export const damSurfaces = {
  board: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  stain: { slot: 'wall', graph: 'concrete_boardformed' },
  light: { slot: 'wall', graph: 'concrete_plain' },
  paving: { slot: 'foundation', graph: 'concrete_plain' },
  red: { slot: 'door', graph: 'metal_painted' },
  frame: { slot: 'door', graph: 'metal_painted' },
  glazing: { slot: 'window', graph: 'window_grid' },
  stone: { slot: 'foundation', graph: 'gravel' },
};
const levels = {
  skyline: { stride: 4 },
  district: { stride: 2, gates: true },
  street: { stride: 1, gates: true, rails: true },
  closeup: { stride: 1, gates: true, rails: true, detail: true },
  master: { stride: 1, gates: true, rails: true, detail: true, joints: true },
};
const { datum, crest, crestElevation, foundationElevation, stages, upper, deep, weir } = controls;
const first = crest[0][0],
  last = crest.at(-1)[0],
  center = 26;
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
    centerLine + depth + 58 + (z - centerLine) * scale + side * thickness * 0.5 + offset,
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
function openings(out, detail, group, deepRow) {
  const [a, b] = group.span,
    { low, high } = group,
    step = (b - a) / group.bays;
  patch(out, detail, first, a, low, high);
  patch(out, detail, b, last, low, high);
  for (let i = 0; i < group.bays; i++) {
    const left = a + i * step,
      right = left + step,
      u = left + step * 0.16,
      v = right - step * 0.16;
    patch(out, detail, left, u, low, high);
    patch(out, detail, v, right, low, high);
    patch(out, detail, u, v, low, high, 1, 'dark', -group.depth);
    for (const [x, dir] of [
      [u, 1],
      [v, -1],
    ]) {
      face(
        out,
        [P(x, low), P(x, high), P(x, high, 1, -group.depth), P(x, low, 1, -group.depth)],
        'light',
        [dir, 0, 0],
      );
    }
    face(
      out,
      [P(u, low), P(v, low), P(v, low, 1, -group.depth), P(u, low, 1, -group.depth)],
      'light',
      [0, 1, 0],
    );
    face(
      out,
      [P(u, high), P(v, high), P(v, high, 1, -group.depth), P(u, high, 1, -group.depth)],
      'light',
      [0, -1, 0],
    );
    if (deepRow && detail.gates) {
      const ramp = [P(u, low), P(v, low), P(v, low - 19, 1, 19), P(u, low - 19, 1, 19)];
      face(out, ramp, 'light', [0, 1, 1]);
      for (const [x, dir] of [
        [u, -1],
        [v, 1],
      ]) {
        face(out, [P(x, low + 2), P(x, low - 17, 1, 19), P(x, low - 19)], 'board', [dir, 0, 0]);
      }
    }
  }
}
function arch(out, detail) {
  for (const [lo, hi] of [
    [foundationElevation, deep.low],
    [deep.high, upper.low],
    [upper.high, crestElevation],
  ])
    patch(out, detail, first, last, lo, hi);
  openings(out, detail, deep, true);
  openings(out, detail, upper, false);
  patch(out, detail, first, last, foundationElevation, crestElevation, -1);
  const xs = stations(first, last, detail);
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = [xs[i - 1], xs[i]];
    face(
      out,
      [
        P(a, crestElevation, -1),
        P(b, crestElevation, -1),
        P(b, crestElevation),
        P(a, crestElevation),
      ],
      'paving',
      [0, 1, 0],
    );
    face(
      out,
      [
        P(a, foundationElevation, -1),
        P(b, foundationElevation, -1),
        P(b, foundationElevation),
        P(a, foundationElevation),
      ],
      'board',
      [0, -1, 0],
    );
    if (detail.rails)
      for (const side of [-1, 1]) {
        const lift = (u) =>
          P(u, crestElevation, side, -side * 0.42).map((v, j) => (j === 1 ? v + 0.58 : v));
        rod(out, 'light', lift(a), lift(b), 0.36, 0.57);
      }
  }
  for (const [u, dir] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < stages.length; i++) {
      const lo = stages[i - 1][0],
        hi = stages[i][0];
      face(out, [P(u, lo, -1), P(u, hi, -1), P(u, hi), P(u, lo)], 'board', [dir, 0, 0]);
    }
  if (detail.gates)
    for (const h of [690, 717, 774, 790]) {
      for (let i = 1; i < xs.length; i++) {
        const [a, b] = [xs[i - 1], xs[i]];
        face(out, [P(a, h), P(b, h), P(b, h, 1, 3.8), P(a, h, 1, 3.8)], 'paving', [0, 1, 0]);
        face(
          out,
          [P(a, h, 1, 3.8), P(b, h, 1, 3.8), P(b, h - 1.4, 1, 3.8), P(a, h - 1.4, 1, 3.8)],
          'stain',
          [0, 0, 1],
        );
      }
    }
  if (detail.joints)
    for (const [u] of crest.slice(1, -1)) {
      for (const [lo, hi] of [
        [660, 735],
        [756, 793],
        [823, 833.7],
      ])
        patch(out, detail, u - 0.11, u + 0.11, lo, hi, 1, 'stain', 0.07);
    }
}
function abutments(out) {
  for (const [u, sign, width] of [
    [first, -1, 22],
    [last, 1, 31],
  ]) {
    const edge = (h, side) => {
      const [x, j, z] = P(u, h, side);
      const fraction = (h - foundationElevation) / (crestElevation - foundationElevation);
      return [x + sign * lerp(6, width, fraction), j, z + side * lerp(2.5, 6, fraction)];
    };
    for (let i = 1; i < stages.length; i++) {
      const lo = stages[i - 1][0],
        hi = stages[i][0];
      for (const side of [-1, 1]) {
        face(out, [P(u, lo, side), edge(lo, side), edge(hi, side), P(u, hi, side)], 'board', [
          0,
          0,
          side,
        ]);
      }
      face(out, [edge(lo, -1), edge(lo, 1), edge(hi, 1), edge(hi, -1)], 'stone', [sign, 0, 0]);
    }
    const h = crestElevation;
    face(out, [P(u, h, -1), edge(h, -1), edge(h, 1), P(u, h, 1)], 'paving', [0, 1, 0]);
  }
}
function gantry(out, x, z, base, detail) {
  const top = base + 18.6;
  for (const a of [-6.5, 6.5])
    for (const b of [-3.1, 3.1]) {
      rod(out, 'red', [x + a, y(base), z + b], [x + a * 0.9, y(top - 1.1), z + b * 0.8], 0.9, 1.05);
    }
  box(out, x - 8, x + 8, y(top - 1.4), y(top), z - 3.35, z + 3.35, 'red');
  box(out, x - 3.4, x + 3.4, y(top), y(top + 2.7), z - 2.6, z + 2.6, 'red');
  if (detail.rails)
    for (const b of [-2.8, 2.8]) {
      rod(out, 'red', [x - 5.8, y(base + 7.8), z + b], [x + 5.8, y(base + 7.8), z + b], 0.34, 0.36);
    }
}
function intakeWorks(out, detail) {
  for (const u of [-176, 207]) {
    const [x, , z] = P(u, crestElevation, 0);
    if (detail.gates) gantry(out, x, z, crestElevation, detail);
    else box(out, x - 5, x + 5, y(834), y(848), z - 2.8, z + 2.8, 'red');
  }
  const a = 222,
    b = 301,
    z = -28,
    w = 16;
  box(out, a, b, y(796), y(832), z, w, 'board');
  box(out, a - 2, b + 1, y(832), y(834), z - 1, w + 1, 'paving');
  for (let x = a + 2; x < b - 1; x += detail.detail ? 3.65 : 7.3) {
    box(out, x, x + 1.45, y(800), y(832), w - 0.25, w + 1.7, 'light');
  }
  if (detail.gates) {
    gantry(out, a + 18, z + 12, 834, detail);
    box(out, b - 17, b - 2, y(834), y(844), z + 19, w - 1, 'light');
    for (let x = b - 15; x < b - 4; x += 3.7)
      box(out, x, x + 1.65, y(839), y(841.5), w - 0.98, w - 0.84, 'glazing');
  }
}
function auxiliaryWeir(out, detail) {
  for (let i = 1; i < weir.axis.length; i++) {
    const [a, z] = weir.axis[i - 1],
      [b, w] = weir.axis[i],
      h = weir.crest;
    const p = (x, e, d) => [x, y(e), d];
    face(out, [p(a, h, z), p(b, h, w), p(b, h, w + 7), p(a, h, z + 7)], 'paving', [0, 1, 0]);
    face(out, [p(a, h, z), p(b, h, w), p(b, 613, w - 4), p(a, 613, z - 4)], 'board', [0, 0, -1]);
    face(
      out,
      [p(a, h, z + 7), p(b, h, w + 7), p(b, 619, w + 24), p(a, 619, z + 24)],
      'light',
      [0, 1, 1],
    );
    if (detail.rails) rod(out, 'frame', p(a, h + 0.7, z + 0.7), p(b, h + 0.7, w + 0.7), 0.22, 0.29);
  }
  for (const [x, z, sign] of [
    [...weir.axis[0], -1],
    [...weir.axis.at(-1), 1],
  ]) {
    face(
      out,
      [
        [x, y(613), z - 4],
        [x, y(weir.crest), z],
        [x, y(weir.crest), z + 7],
        [x, y(619), z + 24],
      ],
      'board',
      [sign, 0, 0],
    );
  }
  for (const [edge, side] of [
    [controls.plunge.west, -1],
    [controls.plunge.east, 1],
  ]) {
    for (let i = 1; i < edge.length; i++) {
      const [x, z] = edge[i - 1],
        [u, v] = edge[i];
      const h = lerp(650, 647, i / edge.length),
        k = lerp(650, 647, (i - 1) / edge.length);
      face(
        out,
        [
          [x, y(k), z],
          [u, y(h), v],
          [u + side * 3, y(h), v],
          [x + side * 3, y(k), z],
        ],
        'paving',
        [0, 1, 0],
      );
      face(
        out,
        [
          [x, y(k), z],
          [u, y(h), v],
          [u, y(611), v],
          [x, y(611), z],
        ],
        'board',
        [-side, 0, 0],
      );
    }
  }
}
export function buildDamLevel(out, level) {
  const detail = levels[level];
  if (!detail) throw Error('Unknown Baihetan Dam detail level: ' + level);
  arch(out, detail);
  abutments(out);
  intakeWorks(out, detail);
  auxiliaryWeir(out, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

export const sampleArchPoint = P;

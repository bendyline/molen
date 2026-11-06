import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [24.7317, -29.9922],
  heading: -1.5707963267948966,
  datum: 1165.3184254999999,
  crestElevation: 1180,
  foundationElevation: 1072,
  riverBedElevation: 1089,
  normalPool: 1170.5,
  crest: [
    [-304.23119, 196.96079],
    [-281.52578, 158.79736],
    [-269.37127, 138.36796],
    [-247.90697, 99.06075],
    [-195.66871, 47.85794],
    [-147.30975, 15.79154],
    [-111.62253, 0.53414],
    [-94.29616, -4.89646],
    [-69.21177, -9.03406],
    [-45.93765, -9.29266],
    [-27.57698, -8.77546],
    [-3.52715, -4.37926],
    [17.16084, 2.08574],
    [53.10614, 15.27434],
    [72.75963, 26.65274],
    [94.99906, 39.84134],
    [105.86016, 46.56494],
    [285.32542, 158.79736],
    [322.97621, 182.34308],
  ],
  stages: [
    [1072, 0.42, 48, 34],
    [1090, 0.55, 35, 30],
    [1110, 0.68, 24, 26],
    [1138, 0.83, 12, 20],
    [1160, 0.945, 3, 13],
    [1170.5, 0.982, 0.6, 10],
    [1180, 1, 0, 8.4],
  ],
  overflow: {
    span: [-150, 56],
    sill: 1170.5,
    soffit: 1178.55,
    bays: 14,
  },
  gates: {
    span: [128, 211],
    sill: 1167.4,
    height: 9.5,
    width: 15,
    bays: 4,
  },
  outlets: {
    north: [-152, -102],
    south: [75, 89],
    sill: 1108.4,
    roof: 1114.8,
  },
};

const palette = {
  warm: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.37, 0.28, 0.19] },
  wet: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.22, 0.191, 0.154] },
  ribs: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.46, 0.35, 0.24] },
  slab: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.45, 0.388, 0.31] },
  asphalt: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.2, 0.21, 0.2] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.145, 0.172, 0.163] },
  green: { slot: 'door', graph: 'metal_painted', rgb: [0.19, 0.32, 0.21] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { slot, graph }]) => [k, { slot, graph }]),
);
const { datum, crestElevation, foundationElevation, crest, stages, overflow, gates, outlets } =
  controls;
const first = crest[0][0],
  last = crest.at(-1)[0],
  center = -50;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.min(1, Math.max(0, v));
function interpolate(rows, t) {
  const i = rows.findIndex((row) => row[0] >= t);
  if (i <= 0) return rows[i === 0 ? 0 : rows.length - 1].slice(1);
  const p = rows[i - 1],
    q = rows[i],
    s = (t - p[0]) / (q[0] - p[0]);
  return p.slice(1).map((v, j) => lerp(v, q[j + 1], s));
}
const bow = interpolate(crest, center)[0];
export function sampleArchPoint(u, h, side = 1, offset = 0) {
  const [scale, lean, thickness] = interpolate(stages, h);
  const weight = clamp((128 - u) / 70),
    z = interpolate(crest, u)[0];
  return [
    u + (center - u) * (1 - scale) * weight,
    h - datum,
    bow +
      lean * lerp(0.48, 1, weight) +
      (z - bow) * lerp(1, scale, weight) +
      side * thickness * 0.5 +
      offset,
  ];
}
const p = sampleArchPoint;
function surface(out, m, vertices, facing) {
  let normal = normalFor(...vertices);
  if (normal.reduce((sum, v, i) => sum + v * facing[i], 0) < 0) {
    vertices = vertices.toReversed();
    normal = normalFor(...vertices);
  }
  const add = vertices.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, m, 'palette:#ffffff', vertices, normal, undefined, palette[m].rgb);
}
const quad = (out, m, a, b, c, d, n) => surface(out, m, [a, b, c, d], n);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
const levels = {
  skyline: { skip: 5 },
  district: { skip: 3, edges: true },
  street: { skip: 2, edges: true, rails: true },
  closeup: { skip: 1, edges: true, rails: true, detail: true },
  master: { skip: 1, edges: true, rails: true, detail: true, service: true },
};
const stations = (a, b, detail) => [
  a,
  ...crest.filter(([x], i) => i % detail.skip === 0 && x > a && x < b).map(([x]) => x),
  b,
];
function shell(out, detail, a, b, base, top, side) {
  const rows = [base, ...stages.map((r) => r[0]).filter((h) => h > base && h < top), top];
  const segments = stations(a, b, detail);
  for (let i = 1; i < segments.length; i++)
    for (let j = 1; j < rows.length; j++) {
      const x = segments[i - 1],
        y = segments[i],
        h = rows[j - 1],
        k = rows[j];
      const tint = side === 1 && k <= 1160 ? 'wet' : 'warm';
      quad(out, tint, p(x, h, side), p(y, h, side), p(y, k, side), p(x, k, side), [0, 0, side]);
    }
}
function road(out, detail) {
  const xs = stations(first, last, { skip: detail.rails ? 1 : detail.skip }),
    h = crestElevation,
    deck = (u) => p(u, h, 0);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    const top = (u, z) => deck(u).map((v, j) => (j === 2 ? v + z : v));
    quad(out, 'asphalt', top(a, -3.4), top(b, -3.4), top(b, 3.4), top(a, 3.4), [0, 1, 0]);
    for (const side of [-1, 1]) {
      const z = side * 4.17;
      quad(out, 'slab', top(a, side * 3.4), top(b, side * 3.4), top(b, z), top(a, z), [0, 1, 0]);
      const parapet = (u) => top(u, z - side * 0.17).map((v, j) => (j === 1 ? v + 0.42 : v));
      if (detail.edges) rod(out, 'slab', parapet(a), parapet(b), 0.32, 0.84);
    }
    quad(
      out,
      'warm',
      p(a, 1178.55, -1),
      p(b, 1178.55, -1),
      p(b, 1178.55, 1),
      p(a, 1178.55, 1),
      [0, -1, 0],
    );
    for (const side of [-1, 1])
      quad(out, 'slab', p(a, 1178.55, side), p(b, 1178.55, side), p(b, h, side), p(a, h, side), [
        0,
        0,
        side,
      ]);
  }
}
function freeSpillway(out, detail) {
  const [a, b] = overflow.span,
    { sill, soffit, bays } = overflow,
    step = (b - a) / bays;
  const apron = [
    [sill, 0],
    [1167.5, 3.3],
    [1160.2, 5.4],
    [1155.8, 1.8],
  ];
  for (let i = 0; i < bays; i++) {
    const x = a + i * step,
      y = x + step,
      margin = detail.edges ? 1.5 : 1.8;
    const openX = x + margin,
      openY = y - margin;
    const rows = [...apron].reverse();
    for (let j = 1; j < rows.length; j++) {
      const [h, z] = rows[j - 1],
        [k, w] = rows[j];
      quad(
        out,
        j === rows.length - 1 ? 'ribs' : 'wet',
        p(x, h, 1, z),
        p(y, h, 1, z),
        p(y, k, 1, w),
        p(x, k, 1, w),
        [0, 1, 1],
      );
    }
    quad(
      out,
      'slab',
      p(openX, sill, -1),
      p(openY, sill, -1),
      p(openY, sill, 1),
      p(openX, sill, 1),
      [0, 1, 0],
    );
    for (const [l, r] of [
      [x, openX],
      [openY, y],
    ]) {
      const rib = [
        [p(l, soffit, 1), p(r, soffit, 1)],
        [p(l, sill, 1, 4.8), p(r, sill, 1, 4.8)],
        [p(l, 1156, 1, 1.82), p(r, 1156, 1, 1.82)],
      ];
      for (let j = 1; j < rib.length; j++)
        quad(out, 'ribs', ...rib[j], rib[j - 1][1], rib[j - 1][0], [0, 0, 1]);
      for (const [u, n] of [
        [l, -1],
        [r, 1],
      ]) {
        quad(out, 'ribs', p(u, sill, -1), p(u, sill, 1, 4.8), p(u, soffit, 1), p(u, soffit, -1), [
          n,
          0,
          0,
        ]);
        surface(out, 'wet', [p(u, 1156, 1, 1.82), p(u, sill, 1, 4.8), p(u, sill, 1)], [n, 0, 0]);
      }
      quad(
        out,
        'warm',
        p(l, sill, -1),
        p(r, sill, -1),
        p(r, soffit, -1),
        p(l, soffit, -1),
        [0, 0, -1],
      );
    }
  }
}
function radialWorks(out, detail) {
  const [a, b] = gates.span,
    step = (b - a) / gates.bays,
    sill = gates.sill,
    top = sill + gates.height;
  const chute = [
    [sill, 0],
    [1161, 5],
    [1147, 15],
    [1130, 29],
    [1112, 50],
    [1102, 68],
  ];
  for (let i = 0; i < gates.bays; i++) {
    const x = a + i * step,
      y = x + step,
      l = (x + y - gates.width) / 2,
      r = l + gates.width;
    for (let j = 1; j < chute.length; j++) {
      const [h, z] = chute[j - 1],
        [k, w] = chute[j];
      quad(out, 'slab', p(x, h, 1, z), p(y, h, 1, z), p(y, k, 1, w), p(x, k, 1, w), [0, 1, 1]);
      if (detail.edges)
        quad(
          out,
          'ribs',
          p(l, h, 1, z),
          p(l, k, 1, w),
          p(l, k + 2.2, 1, w),
          p(l, h + 2.2, 1, z),
          [1, 0, 0],
        );
    }
    for (const [u, n] of [
      [l, 1],
      [r, -1],
    ])
      quad(
        out,
        'ribs',
        p(u, sill, -1),
        p(u, sill, 1),
        p(u, overflow.soffit, 1),
        p(u, overflow.soffit, -1),
        [n, 0, 0],
      );
    for (const [u, v] of [
      [x, l],
      [r, y],
    ])
      for (const side of [-1, 1])
        quad(
          out,
          'ribs',
          p(u, sill, side),
          p(v, sill, side),
          p(v, overflow.soffit, side),
          p(u, overflow.soffit, side),
          [0, 0, side],
        );
    const rows = [
      [sill, 0.2],
      [sill + 4.4, 2.6],
      [top, 1.2],
    ];
    for (let j = 1; j < rows.length; j++) {
      const [h, z] = rows[j - 1],
        [k, w] = rows[j];
      quad(out, 'steel', p(l, h, 1, z), p(r, h, 1, z), p(r, k, 1, w), p(l, k, 1, w), [0, 0, 1]);
      quad(
        out,
        'steel',
        p(r, h, 1, z - 0.22),
        p(l, h, 1, z - 0.22),
        p(l, k, 1, w - 0.22),
        p(r, k, 1, w - 0.22),
        [0, 0, -1],
      );
    }
    if (detail.rails)
      for (const u of [l + 0.5, r - 0.5]) {
        rod(out, 'steel', p(u, sill + 1, 1, 1), p(u, 1172, 1, 7), 0.24, 0.32);
        rod(out, 'steel', p(u, top - 0.6, 1, 1.5), p(u, 1172, 1, 7), 0.24, 0.32);
      }
  }
}
const outletBanks = [
  [outlets.north, 4],
  [outlets.south, 2],
];
const outletOpening = (a, b, n, i) => [
  a + ((b - a) * i) / n + 1.1,
  a + ((b - a) * (i + 1)) / n - 1.1,
];
function lowerShell(out, detail, a, b, base, top) {
  const { sill, roof } = outlets;
  const openings = outletBanks
    .flatMap(([[x, y], n]) => Array.from({ length: n }, (_, i) => outletOpening(x, y, n, i)))
    .map(([x, y]) => [Math.max(x, a), Math.min(y, b)])
    .filter(([x, y]) => y > x);
  if (openings.length === 0) {
    shell(out, detail, a, b, base, top, 1);
    return;
  }
  shell(out, detail, a, b, base, sill, 1);
  shell(out, detail, a, b, roof, top, 1);
  let end = a;
  for (const [x, y] of openings) {
    if (x > end) shell(out, detail, end, x, sill, roof, 1);
    end = y;
  }
  if (end < b) shell(out, detail, end, b, sill, roof, 1);
}
function outletsAndAccess(out, detail) {
  const { sill, roof } = outlets,
    depth = 2.2,
    canopy = 5.6;
  for (const [[a, b], n] of outletBanks) {
    for (let i = 0; i < n; i++) {
      const [l, r] = outletOpening(a, b, n, i);
      quad(
        out,
        'green',
        p(l, sill, 1, -depth),
        p(r, sill, 1, -depth),
        p(r, roof, 1, -depth),
        p(l, roof, 1, -depth),
        [0, 0, 1],
      );
      quad(
        out,
        'slab',
        p(l, roof, 1, -depth),
        p(r, roof, 1, -depth),
        p(r, roof, 1, canopy),
        p(l, roof, 1, canopy),
        [0, 1, 0],
      );
      quad(
        out,
        'slab',
        p(l, sill, 1, -depth),
        p(r, sill, 1, -depth),
        p(r, sill, 1, canopy),
        p(l, sill, 1, canopy),
        [0, 1, 0],
      );
      for (const [x, sign] of [
        [l, 1],
        [r, -1],
      ])
        quad(
          out,
          'ribs',
          p(x, sill, 1, -depth),
          p(x, sill, 1, canopy),
          p(x, roof, 1, canopy),
          p(x, roof, 1, -depth),
          [sign, 0, 0],
        );
      if (detail.detail)
        rod(out, 'steel', p(l, roof + 0.7, 1, 5.2), p(r, roof + 0.7, 1, 5.2), 0.14, 0.16);
    }
    quad(
      out,
      'slab',
      p(a, sill - 0.2),
      p(b, sill - 0.2),
      p(b, sill - 0.2, 1, 12),
      p(a, sill - 0.2, 1, 12),
      [0, 1, 0],
    );
  }
  if (detail.service)
    for (let i = 0; i < 24; i++) {
      const u = -148 + i * 1.2,
        h = 1110 + i * 0.26;
      quad(
        out,
        'slab',
        p(u, h, 1, 5.5),
        p(u + 1.2, h, 1, 5.5),
        p(u + 1.2, h, 1, 8),
        p(u, h, 1, 8),
        [0, 1, 0],
      );
    }
}
export function buildDamLevel(out, level) {
  const detail = levels[level];
  if (!detail) throw Error('Unknown Vanderkloof Dam detail level: ' + level);
  const [a, b] = overflow.span,
    [l, r] = gates.span;
  const regions = [
    [first, a, 1180],
    [a, b, overflow.sill],
    [b, l, 1180],
    [l, r, gates.sill],
    [r, last, 1180],
  ];
  for (const [x, y, h] of regions) {
    const top = Math.min(h, overflow.soffit);
    shell(out, detail, x, y, foundationElevation, top, -1);
    lowerShell(out, detail, x, y, foundationElevation, top);
  }
  for (const [x, n] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < stages.length; i++) {
      const [h] = stages[i - 1],
        [k] = stages[i];
      quad(out, 'warm', p(x, h, -1), p(x, h, 1), p(x, k, 1), p(x, k, -1), [n, 0, 0]);
    }
  const xs = stations(first, last, detail);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1],
      y = xs[i],
      h = foundationElevation;
    quad(out, 'warm', p(x, h, -1), p(y, h, -1), p(y, h, 1), p(x, h, 1), [0, -1, 0]);
  }
  freeSpillway(out, detail);
  radialWorks(out, detail);
  outletsAndAccess(out, detail);
  road(out, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

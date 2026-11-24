import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.84, metallic: 0.17 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const marble = rgb('c6c4b7'),
  pale = rgb('d1d0c5'),
  coping = rgb('9c9d94');
const copper = rgb('839991'),
  patina = rgb('6b857c'),
  bronze = rgb('4a554e'),
  glass = rgb('667477');
const base = -0.89,
  angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [
  Math.fround(c * x - s * z),
  Math.fround(y),
  Math.fround(s * x + c * z),
];
const up = [0, 1, 0],
  uv = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const pt = ([x, z], y) => [x, y, z];
const signed = (r) =>
  r.reduce((a, [x, z], i) => a + x * r[(i + 1) % r.length][1] - z * r[(i + 1) % r.length][0], 0);
const clockwise = (r) => (signed(r) < 0 ? r : r.toReversed());
const blend = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

function face(out, slot, points, color, expected) {
  const raw = points.map(world),
    v = expected && world(expected);
  for (let i = 1; i < raw.length - 1; i++) {
    let p = [raw[0], raw[i], raw[i + 1]],
      n = normalFor(...p);
    if (Math.hypot(...n) < 0.98) continue;
    if (v && n.reduce((sum, w, j) => sum + w * v[j], 0) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((a) => -a);
    }
    out.addTriangle(slot, '', p, n, uv, color);
  }
}

function wall(out, r, low, high, slot = 'marble', tint = marble) {
  const ring = clockwise(r);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(out, slot, [pt(a, low), pt(b, low), pt(b, high), pt(a, high)], tint);
  }
}

function cap(out, r, y, slot, tint, normal = up) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'wall',
      'palette:#ffffff',
      r,
      [],
      () => y,
      up,
      (p) => p,
      tint,
    )
  )
    throw Error('Stoclet outline cannot be triangulated');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
    face(out, slot, p, tint, normal);
  }
}

function solid(out, r, low, top, slot = 'marble', tint = marble) {
  wall(out, r, low, top, slot, tint);
  cap(out, r, top, slot, tint);
}

function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    n = [-dz / length, 0, dx / length];
  return {
    length,
    n,
    at: (u, y, v = 0) => [
      a[0] + (dx * u) / length + v * n[0],
      y,
      a[1] + (dz * u) / length + v * n[2],
    ],
  };
}
const edges = (r) => clockwise(r).map((a, i, row) => edge(a, row[(i + 1) % row.length]));
const strip = (out, e, a, b, y, Y, d, slot, tint) =>
  face(out, slot, [e.at(a, y, d), e.at(b, y, d), e.at(b, Y, d), e.at(a, Y, d)], tint, e.n);

function opening(out, e, u, y, h, w, detail, shape = 'flat', d = 0.034) {
  const lo = u - w / 2,
    hi = u + w / 2,
    spring = y + h - (shape === 'arch' ? 0.53 : 0);
  strip(out, e, lo - 0.12, hi + 0.12, y - 0.12, spring + 0.116, d, 'trim', bronze);
  strip(out, e, lo, hi, y, spring, d + 0.047, 'glass', glass);
  if (shape === 'arch') {
    const count = detail >= 2 ? 8 : 4,
      p = (t, v) => e.at(lo + w * t, spring + v, d + 0.052);
    const curve = Array.from({ length: count + 1 }, (_, i) =>
      p(i / count, 0.53 * Math.sin((i * Math.PI) / count)),
    );
    face(out, 'glass', curve, glass, e.n);
    if (detail >= 2)
      for (let i = 1; i < curve.length; i++)
        beam(out, 'trim', world(curve[i - 1]), world(curve[i]), 0.052, 0.04, bronze);
  }
  if (detail < 2) return;
  for (const u of [0.12, 0.37, 0.63, 0.88]) {
    const x = lo + u * w;
    strip(out, e, x - 0.021, x + 0.021, y + 0.035, spring - 0.023, d + 0.065, 'marble', pale);
  }
  for (const t of detail === 2 ? [0.49] : [0.26, 0.49, 0.72]) {
    const Y = y + (spring - y) * t;
    strip(out, e, lo + 0.032, hi - 0.032, Y - 0.026, Y + 0.026, d + 0.065, 'marble', pale);
  }
}

function fascia(out, r, y, Y, color = bronze) {
  for (const e of edges(r)) strip(out, e, 0, e.length, y, Y, 0.029, 'trim', color);
}

function dome(out, detail) {
  const {
    center: [x, z],
    width,
    depth,
    spring,
    crown,
  } = site.windowBay;
  // The bay is a half dome whose straight side stops at the street wall.
  const count = [5, 8, 12, 18][detail],
    bands = [0, 0.43, 0.77, 0.94, 1];
  const row = (q, i) => {
    const a = (Math.PI * i) / count;
    const w = Math.cos((q * Math.PI) / 2);
    return [
      x + width * 0.5 * Math.cos(a) * w,
      spring + (crown - spring) * Math.sin((q * Math.PI) / 2),
      z - depth * Math.sin(a) * w,
    ];
  };
  for (let j = 1; j < bands.length; j++)
    for (let i = 0; i < count; i++) {
      const u = bands[j - 1],
        v = bands[j],
        inPlan = (-(i + 0.5) * Math.PI) / count;
      face(out, 'copper', [row(u, i), row(u, i + 1), row(v, i + 1), row(v, i)], copper, [
        Math.cos(inPlan),
        0.55,
        Math.sin(inPlan),
      ]);
      if (detail === 3 && i % 2 === 0)
        beam(out, 'copper', world(row(u, i)), world(row(v, i)), 0.064, 0.058, patina);
    }
  if (!detail) return;
  for (let i = 0; i < 5; i++) {
    const a = (i + 0.06) / 5,
      b = (i + 0.94) / 5;
    const P = (t) => [x + width * 0.5 * Math.cos(t * Math.PI), z - depth * Math.sin(t * Math.PI)];
    const e = edge(P(a), P(b));
    opening(out, e, e.length * 0.5, 5.22, 1.72, e.length * 0.8, detail, 'flat', 0.19);
  }
}

function mainRoof(out, detail) {
  const [x, X] = [-10.29, 29.54],
    [z, Z] = [-11.06, 2.81],
    ridge = -3.91;
  const y = 9.81,
    h = 12.12;
  const shape = [
    [
      [x, y, z],
      [X, y, z],
      [X, h, ridge],
      [x, h, ridge],
    ],
    [
      [x, h, ridge],
      [X, h, ridge],
      [X, y, Z],
      [x, y, Z],
    ],
  ];
  for (const p of shape) face(out, 'copper', p, copper, up);
  for (const [cx, d] of [
    [x, -1],
    [X, 1],
  ])
    face(
      out,
      'marble',
      [
        [cx, y, z],
        [cx, y, Z],
        [cx, h, ridge],
      ],
      marble,
      [d, 0, 0],
    );
  const e = edge([X, z], [x, z]);
  for (let j = 0; j < 7; j++) {
    const u = (e.length * (j + 0.48)) / 7,
      a = e.at(u - 1.07, y - 0.83, -0.83),
      b = e.at(u + 1.07, y - 0.83, 0.08);
    const [L, R] = [a[0], b[0]].sort((a, b) => a - b);
    const ring = rect(L, R, b[2], a[2]);
    solid(out, ring, y - 0.88, y + 0.65, 'trim', bronze);
    if (detail) opening(out, e, u, y - 0.68, 1.12, 1.74, detail, 'flat', 0.107);
  }
  if (detail < 2) return;
  const count = detail === 2 ? 13 : 23;
  for (let i = 1; i < count; i++) {
    const u = x + ((X - x) * i) / count;
    for (const front of [z, Z])
      beam(
        out,
        'copper',
        world([u, y + 0.037, front]),
        world([u, h + 0.035, ridge]),
        0.049,
        0.05,
        patina,
      );
  }
}

function guardian(out, x, z, y, sign, detail) {
  if (detail === 0) {
    const silhouette = [
      [0, 0.34, 0.25],
      [1.46, 0.43, 0.27],
      [1.84, 0.19, 0.21],
      [2.322, 0.14, 0.15],
    ];
    loft(
      out,
      'copper',
      silhouette.map(([h, r, d]) => radialRing(y + h, r, d, 4, [x, z], 0.35).map(world)),
      patina,
    );
    return;
  }
  const steps = detail < 2 ? 5 : 8;
  const profile = [
    [0, 0.29, 0.25],
    [0.6, 0.38, 0.3],
    [1.23, 0.28, 0.19],
    [1.52, 0.43, 0.24],
    [1.75, 0.31, 0.23],
  ];
  const rings = profile.map(([h, r, d]) =>
    radialRing(y + h, r, d, steps, [x + sign * h * 0.053, z], 0.35).map(world),
  );
  loft(out, 'copper', rings, patina);
  sphere(
    out,
    'copper',
    world([x + sign * 0.075, y + 2.02, z]),
    [0.233, 0.302, 0.224],
    patina,
    detail < 2 ? 5 : 8,
    detail < 2 ? 3 : 5,
  );
  if (detail < 2) return;
  for (const side of [-1, 1])
    beam(
      out,
      'copper',
      world([x + side * 0.27, y + 1.64, z]),
      world([x + side * 0.4, y + 1.04, z - 0.069]),
      0.16,
      0.21,
      patina,
    );
}

function tower(out, detail) {
  const {
    center: [x, z],
    baseBounds: [l, r, f, b],
    deck,
    crown,
  } = site.tower;
  const baseRing = rect(l, r, f, b),
    tiers = [
      [-2.6, 2.6, -2.55, 2.55, deck, 19.91],
      [-1.9, 1.9, -1.82, 1.82, 19.91, 22.52],
      [-1.19, 1.19, -1.08, 1.08, 22.52, crown],
    ];
  solid(out, baseRing, base, deck, 'marble', marble);
  const sides = edges(baseRing);
  fascia(out, baseRing, 12.24, 12.46);
  fascia(out, baseRing, deck - 0.21, deck + 0.07);
  for (const e of sides) {
    for (const u of [0.12, e.length - 0.12])
      strip(out, e, u - 0.065, u + 0.065, 0, deck, 0.045, 'trim', bronze);
    if (detail) {
      opening(out, e, e.length * 0.28, 13.05, 1.71, 1.39, detail, 'flat', 0.037);
      opening(out, e, e.length * 0.74, 8.01, 2.36, 1.68, detail, 'flat', 0.045);
    }
    if (detail >= 2) {
      beam(
        out,
        'trim',
        world(e.at(0, deck + 0.79, 0.039)),
        world(e.at(e.length, deck + 0.79, 0.039)),
        0.061,
        0.065,
        bronze,
      );
      const bays = Math.ceil(e.length / 0.88);
      for (let i = 0; i < bays; i++) {
        const u = (e.length * i) / bays;
        beam(
          out,
          'trim',
          world(e.at(u, deck + 0.09, 0.031)),
          world(e.at(u, deck + 0.79, 0.039)),
          0.051,
          0.06,
          bronze,
        );
      }
    }
  }
  const shaft = edge([r, f - 0.017], [l, f - 0.017]);
  strip(out, shaft, shaft.length - 0.92, shaft.length - 0.38, 1.19, 15.82, 0.047, 'glass', glass);
  for (const [a, B, F, G, low, top] of tiers) {
    const ring = rect(x + a, x + B, z + F, z + G);
    solid(out, ring, low, top, 'marble', marble);
    fascia(out, ring, top - 0.22, top + 0.035);
    for (const e of edges(ring)) {
      strip(out, e, 0.12, 0.18, low - 0.012, top, 0.052, 'trim', bronze);
      strip(out, e, e.length - 0.18, e.length - 0.12, low - 0.012, top, 0.052, 'trim', bronze);
      if (detail >= 1)
        strip(
          out,
          e,
          e.length * 0.44,
          e.length * 0.56,
          low + 0.54,
          top - 0.52,
          0.039,
          'trim',
          bronze,
        );
    }
  }
  for (const u of [-1, 1])
    for (const v of [-1, 1]) guardian(out, x + u * 1.18, z + v * 1.15, crown - 1.27, u, detail);
  beam(
    out,
    'trim',
    world([x, crown - 0.055, z]),
    world([x, crown + 1.43, z]),
    0.058,
    0.058,
    bronze,
  );
}

function facades(out, detail) {
  if (!detail) return;
  const street = edge([29.55, -11.063], [-22.71, -11.063]);
  for (const [x, h, w] of [
    [26, 1.95, 2.16],
    [20.91, 2.03, 2.07],
    [16.23, 2.01, 2.03],
    [5.38, 1.78, 1.09],
    [0.16, 1.9, 1.63],
    [-4.67, 2.04, 2.16],
    [-8.91, 2.02, 1.78],
  ]) {
    const u = 29.55 - x;
    opening(out, street, u, 4.48, h, w, detail);
    opening(out, street, u, 0.83, 1.79, w * 0.82, detail, x === -4.67 ? 'arch' : 'flat');
  }
  const gallery = edge([-23.02, 1.702], [-28.69, 1.702]);
  const e = edge([-19.0, -3.714], [-22.69, -3.714]);
  for (const edge of [gallery, e])
    for (let i = 0; i < Math.ceil(edge.length / 1.5); i++) {
      const count = Math.ceil(edge.length / 1.5),
        span = edge.length / count;
      opening(out, edge, span * (i + 0.5), 4.58, 2.35, span * 0.92, detail);
    }
  const west = cleanRing(site.parts.find((q) => q.name === 'west').ring);
  for (const edge of edges(west)) {
    if (edge.length < 1.15 || Math.abs(edge.at(edge.length * 0.5, 6)[0] + 29.01) < 0.12) continue;
    const bays = Math.max(1, Math.round(edge.length / 1.59));
    const width = edge.length / bays;
    for (let i = 0; i < bays; i++)
      opening(out, edge, width * (i + 0.5), 4.61, 2.21, width * 0.86, detail);
  }
  const back = edge([-11.52, 2.699], [27.61, 2.699]);
  for (const x of [1.67, 6.01, 10.35, 20.22, 24.5, 29.07, 32.94]) {
    opening(out, back, x, 5.05, 1.82, 1.78, detail);
    opening(out, back, x, 1.1, 2.15, 1.76, detail);
  }
}

function entrance(out, detail) {
  const p = site.parts.find((q) => q.name === 'entrance');
  for (const [x, z] of p.ring)
    solid(out, rect(x - 0.21, x + 0.21, z - 0.21, z + 0.21), base, p.base + 0.09, 'marble', pale);
  fascia(out, cleanRing(p.ring), p.top - 0.18, p.top + 0.038);
  guardian(out, 3.33, -16.21, p.top, 0.35, detail);
}

function build(out, detail) {
  for (const p of site.parts) {
    const r = cleanRing(p.ring);
    solid(out, r, p.base || base, p.top);
    if (p.base) cap(out, r, p.base, 'marble', coping, [0, -1, 0]);
    if (p.name !== 'body' && p.name !== 'northBay') fascia(out, r, p.top - 0.14, p.top + 0.014);
  }
  for (const [x, z] of [
    [-28.73, 2.05],
    [-22.89, 2.04],
  ])
    solid(out, rect(x - 0.26, x + 0.26, z - 0.39, z + 0.39), base, 4.12, 'marble', pale);
  mainRoof(out, detail);
  dome(out, detail);
  tower(out, detail);
  facades(out, detail);
  entrance(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

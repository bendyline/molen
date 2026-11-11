/** Drayton Hall's surveyed main house and two approaches in April 2008. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const { halfWidth: width, halfDepth: depth, mainEaves: eaves, land, river } = plan;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.16 },
  shingle: { slot: 'roof', graph: 'siding_shingle', roughness: 0.91, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    brick: 'b47963',
    sun: 'bc826b',
    shade: 'ac705e',
    base: 'ad7e66',
    red: 'a75245',
    ridge: 'a65d50',
    gable: '945145',
    ashlar: 'c5b7a2',
    stone: 'ddd4bf',
    trim: 'e2d7c0',
    cream: 'e8dfcb',
    door: '5e4b40',
    shutters: '7d7060',
    pane: '505859',
    sash: 'e3d9c5',
    iron: '514d46',
    palePaving: 'd6c7aa',
    redPaving: 'a26c57',
  }).map(([key, value]) => [key, rgb(value)]),
);
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const mix = (a, b, t) => a + (b - a) * t;

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2,
    normal = [-uz, 0, ux];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function oriented(out, slot, points, normal, color) {
  const n = normalFor(...points),
    p = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? points : points.toReversed();
  if (p.length === 4) face(out, slot, p, color);
  else triangle(out, slot, p, color);
}

function fill(out, s, slot, outer, color, d = 0, holes = []) {
  const vertices = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(vertices.length);
    vertices.push(...hole);
  }
  const mesh = earcut(vertices.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => s.p(...vertices[j], d)),
      s.normal,
      color,
    );
}

function band(out, s, slot, a, b, d0, d1, color, full = false) {
  const points = rect(...a, ...b);
  oriented(
    out,
    slot,
    points.map((p) => s.p(...p, d1)),
    s.normal,
    color,
  );
  if (!full) return;
  for (let i = 0; i < 4; i++) {
    const p = points[i],
      q = points[(i + 1) % 4];
    face(out, slot, [s.p(...p, d0), s.p(...q, d0), s.p(...q, d1), s.p(...p, d1)], color);
  }
}

function sashShape(w, divisions, margin = 0) {
  const lo = w.low - margin,
    hi = w.high + margin,
    r = w.width / 2 + margin;
  if (!w.side) return rect(w.x - r, lo, w.x + r, hi);
  const arch = Array.from({ length: divisions + 1 }, (_, i) => [
    w.x + r * (1 - (2 * i) / divisions),
    hi - 0.135 * Math.pow((2 * i) / divisions - 1, 2),
  ]);
  return [[w.x - r, lo], [w.x + r, lo], ...arch];
}

function sash(out, s, w, lod) {
  const { x, low, high, width: span, door, basement } = w;
  const a = x - span / 2,
    b = x + span / 2,
    n = lod === 3 ? 7 : 4,
    shape = sashShape(w, n),
    shell = sashShape(w, n, 0.1);
  const paneDepth = lod >= 2 ? -0.15 : 0.032;
  const color = basement ? tint.shutters : door ? tint.door : tint.pane;
  if (lod === 0) {
    band(out, s, 'detail', [a, low], [b, high], 0, paneDepth, color);
    return;
  }
  if (lod < 2) {
    fill(out, s, 'timber', shell, tint.sash, 0.022);
  } else {
    for (let i = 0; i < shape.length; i++) {
      const j = (i + 1) % shape.length,
        p = shape[i],
        q = shape[j];
      oriented(
        out,
        'timber',
        [p, q, shell[j], shell[i]].map((v) => s.p(...v, 0.045)),
        s.normal,
        tint.sash,
      );
      face(
        out,
        'brick',
        [s.p(...p, 0.038), s.p(...q, 0.038), s.p(...q, paneDepth), s.p(...p, paneDepth)],
        tint.shade,
      );
    }
  }
  fill(out, s, door ? 'timber' : 'detail', shape, color, paneDepth);
  if (lod >= 2)
    band(
      out,
      s,
      'timber',
      [a - 0.13, low - 0.105],
      [b + 0.13, low + 0.015],
      -0.01,
      0.135,
      tint.sash,
      true,
    );
  if (basement || door) {
    if (lod === 1) return;
    const count = door ? 2 : 5;
    for (let i = 1; i < count; i++) {
      const u = mix(a, b, i / count);
      band(
        out,
        s,
        'detail',
        [u - 0.017, low + 0.045],
        [u + 0.017, high - 0.1],
        paneDepth,
        paneDepth + 0.018,
        tint.iron,
      );
    }
    if (lod >= 2)
      for (const f of [0.26, 0.52, 0.79]) {
        const y = mix(low, high, f);
        band(
          out,
          s,
          'timber',
          [a + 0.1, y - 0.038],
          [b - 0.1, y + 0.038],
          paneDepth,
          paneDepth + 0.035,
          tint.shutters,
        );
      }
    return;
  }
  for (const f of [1 / 3, 2 / 3]) {
    const u = mix(a, b, f);
    band(
      out,
      s,
      'timber',
      [u - 0.018, low + 0.022],
      [u + 0.018, high - 0.046],
      paneDepth,
      0.027,
      tint.sash,
      lod >= 3,
    );
  }
  for (const f of lod === 1 ? [0.5] : [0.25, 0.5, 0.75]) {
    const y = mix(low, high, f),
      thickness = f === 0.5 ? 0.032 : 0.017;
    band(
      out,
      s,
      'timber',
      [a, y - thickness],
      [b, y + thickness],
      paneDepth,
      0.029,
      tint.sash,
      lod >= 3,
    );
  }
  if (lod >= 2) {
    const head = [a - 0.14, high + 0.015],
      tail = [b + 0.14, high + 0.13];
    band(out, s, 'brick', head, tail, 0, 0.019, tint.sun);
  }
}

function openings(xs, kind) {
  return xs.flatMap((x) => {
    const side = kind === 'side',
      center = Math.abs(x) < 0.07,
      basement = kind !== 'recess';
    const levels = [
      { x, width: 1.1, low: 3.49, high: 5.57, side },
      { x, width: 1.1, low: 7.53, high: 9.61, side },
    ];
    if (center && (kind === 'recess' || kind === 'river'))
      levels[0] = { x, width: 1.42, low: 2.67, high: 5.58, door: true };
    if (center && kind === 'recess')
      levels[1] = { x, width: 1.19, low: 6.6, high: 9.54, door: true };
    if (basement)
      levels.unshift({
        x,
        width: center ? 1.1 : 0.89,
        low: center ? 0.05 : 0.88,
        high: 2.17,
        basement: true,
        side,
      });
    return levels;
  });
}

function elevation(out, s, windows, outline, lod, color, voids = []) {
  const holes = lod >= 2 ? windows.map((w) => sashShape(w, lod === 3 ? 7 : 4)) : [];
  fill(out, s, 'brick', outline, color, 0, [...voids, ...holes]);
  for (const w of windows) sash(out, s, w, lod);
}

function belt(out, s, x0, x1, y, lod) {
  band(out, s, 'brick', [x0, y], [x1, y + 0.15], -0.02, 0.08, tint.base, lod >= 2);
  if (lod >= 1)
    band(out, s, 'brick', [x0, y + 0.12], [x1, y + 0.2], 0.02, 0.105, tint.sun, lod >= 2);
}

function windowPediment(out, s, x, low, high, arched, lod) {
  if (lod === 0) return;
  const width = 1.05;
  for (const sign of [-1, 1]) {
    const u = x + sign * 0.79;
    band(out, s, 'timber', [u - 0.078, low], [u + 0.078, high], -0.04, 0.15, tint.cream, lod >= 2);
    band(
      out,
      s,
      'stone',
      [u - 0.15, low - 0.13],
      [u + 0.15, low + 0.12],
      -0.03,
      0.196,
      tint.stone,
      lod >= 2,
    );
  }
  const y = high + 0.1;
  band(
    out,
    s,
    'timber',
    [x - width, y - 0.06],
    [x + width, y + 0.08],
    -0.04,
    0.2,
    tint.cream,
    lod >= 2,
  );
  const n = arched ? 8 : 2;
  const ridge = Array.from({ length: n + 1 }, (_, i) => {
    const f = (2 * i) / n - 1;
    return [x + width * f, y + 0.05 + 0.43 * (1 - Math.pow(Math.abs(f), arched ? 1.9 : 1))];
  });
  fill(out, s, 'timber', ridge, tint.trim, 0.177);
  if (lod >= 1)
    for (let i = 1; i < ridge.length; i++)
      beam(
        out,
        'timber',
        s.p(...ridge[i - 1], 0.21),
        s.p(...ridge[i], 0.21),
        0.057,
        0.074,
        tint.cream,
      );
}

function body(out, lod) {
  const bottom = -0.3,
    r = land.recessWidth / 2;
  const front = section([-width, depth], [width, depth]);
  const cutout = rect(-r, land.firstDeck - 0.04, r, 10.81);
  elevation(
    out,
    front,
    openings([-8.87, -6.44, 6.44, 8.87], 'land'),
    rect(-width, bottom, width, eaves),
    lod,
    tint.sun,
    [cutout],
  );
  const recess = section([-r, land.recessBack], [r, land.recessBack]);
  elevation(
    out,
    recess,
    openings([-2.73, 0, 2.73], 'recess'),
    rect(-r, land.firstDeck - 0.12, r, 10.88),
    lod,
    tint.shade,
  );
  for (const sign of [-1, 1]) {
    const a = [sign * r, land.recessBack],
      b = [sign * r, depth];
    const s = sign < 0 ? section(b, a) : section(a, b);
    fill(
      out,
      s,
      'brick',
      rect(-s.length / 2, land.firstDeck - 0.08, s.length / 2, 10.89),
      tint.shade,
    );
  }
  for (const [a, b] of [
    [-width + 0.34, -r - 0.45],
    [r + 0.45, width - 0.34],
  ])
    for (const y of [2.66, 5.98]) belt(out, front, a, b, y, lod);
  const back = section([width, -depth], [-width, -depth]);
  elevation(
    out,
    back,
    openings([-8.87, -6.44, -3.42, 0, 3.42, 6.44, 8.87], 'river'),
    rect(-width, bottom, width, eaves),
    lod,
    tint.brick,
  );
  for (const [a, b] of [
    [-width + 0.32, -1.73],
    [1.73, width - 0.32],
  ])
    for (const y of [2.66, 5.98]) belt(out, back, a, b, y, lod);
  windowPediment(out, back, 0, 2.75, 6.43, false, lod);
  for (const x of [-3.42, 0, 3.42]) windowPediment(out, back, x, 7.22, 9.6, x === 0, lod);
  for (const sign of [-1, 1]) {
    const s = section([sign * width, sign * depth], [sign * width, -sign * depth]);
    const xs = [-6.45, -4.03, -1.6, 0.52, 2.96, 5.64];
    elevation(
      out,
      s,
      openings(xs, 'side'),
      rect(-depth, bottom, depth, eaves),
      lod,
      sign < 0 ? tint.sun : tint.shade,
    );
    for (const y of [2.66, 5.98]) belt(out, s, -depth + 0.3, depth - 0.3, y, lod);
  }
  for (const s of [
    front,
    back,
    section([width, depth], [width, -depth]),
    section([-width, -depth], [-width, depth]),
  ]) {
    const h = s.length / 2;
    band(out, s, 'timber', [-h, 10.61], [h, 10.97], -0.02, 0.17, tint.trim, lod >= 1);
    band(out, s, 'timber', [-h, 10.97], [h, eaves + 0.09], -0.03, 0.27, tint.cream, lod >= 1);
    if (lod >= 2)
      for (let x = -h + 0.19; x < h - 0.12; x += lod === 2 ? 0.66 : 0.43)
        band(
          out,
          s,
          'timber',
          [x - 0.043, 10.74],
          [x + 0.043, 10.97],
          0.13,
          0.26,
          tint.cream,
          true,
        );
  }
}

function roundColumn(out, x, z, base, top, order, lod) {
  const n = [5, 7, 13, 17][lod],
    ionic = order === 'ionic',
    r = ionic ? 0.175 : 0.225;
  const foot = ionic ? 0.7 : 0.19,
    shaft = base + foot;
  box(
    out,
    'stone',
    [x - r - 0.082, base - 0.035, z - r - 0.085],
    [x + r + 0.082, shaft - 0.035, z + r + 0.085],
    tint.stone,
  );
  const detailed = [
    [shaft - 0.025, r * 1.17],
    [shaft + 0.056, r],
    [top - 0.25, r * 0.83],
    [top - 0.122, r * 1.09],
    [top - 0.07, r * 1.12],
  ];
  const levels =
    lod === 0
      ? [
          [shaft - 0.025, r],
          [top - 0.07, r * 0.83],
        ]
      : lod === 1
        ? [detailed[0], detailed[2], detailed[4]]
        : detailed;
  loft(
    out,
    'stone',
    levels.map(([y, s]) => radialRing(y, s, s, n, [x, z])),
    tint.cream,
    { cap: false },
  );
  box(
    out,
    'stone',
    [x - r * 1.28, top - 0.105, z - r * 1.25],
    [x + r * 1.28, top + 0.048, z + r * 1.25],
    tint.trim,
  );
  if (ionic && lod >= 2) {
    for (const side of [-1, 1]) {
      const cx = x + side * r * 0.88;
      const s = section([cx - 0.11, z + r * 1.12], [cx + 0.11, z + r * 1.12]);
      const ring = Array.from({ length: 10 }, (_, i) => [
        0.086 * Math.cos((i * Math.PI) / 5),
        top - 0.139 + 0.076 * Math.sin((i * Math.PI) / 5),
      ]);
      fill(out, s, 'stone', ring, tint.stone, 0.028);
    }
  }
}

function paving(out, x0, x1, z0, z1, y, lod) {
  if (lod < 2) return;
  const step = lod === 2 ? 0.68 : 0.47;
  for (let x = x0 + step; x < x1 - step * 0.52; x += step)
    for (let z = z0 + step; z < z1 - step * 0.52; z += step) {
      const p = [
        [x - step * 0.5, y, z],
        [x, y, z + step * 0.5],
        [x + step * 0.5, y, z],
        [x, y, z - step * 0.5],
      ];
      oriented(out, 'stone', p, [0, 1, 0], tint.redPaving);
    }
}

function railing(out, a, b, level, style, lod) {
  const height = style === 'wood' ? 0.69 : 0.88,
    top = level + height,
    slot = style === 'wood' ? 'timber' : 'detail';
  const color = style === 'wood' ? tint.cream : tint.iron;
  beam(out, slot, [a[0], top, a[1]], [b[0], top, b[1]], 0.045, 0.055, color);
  if (lod === 0) return;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.ceil(length / (lod === 1 ? 0.78 : 0.27)));
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = mix(a[0], b[0], t),
      z = mix(a[1], b[1], t),
      r = style === 'wood' ? (i === 0 || i === n ? 0.045 : 0.023) : 0.022;
    if (style === 'wood' && lod >= 2) {
      loft(
        out,
        slot,
        [
          [level, r * 1.4],
          [level + 0.16, r * 1.45],
          [level + 0.36, r],
          [top, r * 1.13],
        ].map(([y, s]) => radialRing(y, s, s, 5, [x, z])),
        color,
      );
    } else beam(out, slot, [x, level, z], [x, top, z], r * 2, r * 2, color);
  }
}

function stair(out, from, to, low, high, span, lod) {
  const n = lod === 0 ? 2 : lod === 1 ? 5 : Math.round((high - low) / 0.158),
    length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const offset = [
    (((to[1] - from[1]) / length) * span) / 2,
    (((from[0] - to[0]) / length) * span) / 2,
  ];
  for (let i = 0; i < n; i++) {
    const p = from.map((v, k) => mix(v, to[k], i / n)),
      q = from.map((v, k) => mix(v, to[k], (i + 1) / n));
    const x0 = Math.min(p[0], q[0]) - Math.abs(offset[0]),
      x1 = Math.max(p[0], q[0]) + Math.abs(offset[0]);
    const z0 = Math.min(p[1], q[1]) - Math.abs(offset[1]),
      z1 = Math.max(p[1], q[1]) + Math.abs(offset[1]);
    const y = mix(low, high, (i + 1) / n);
    box(out, 'stone', [x0, -0.27, z0], [x1, y, z1], tint.stone);
    if (lod >= 2 && i > 0) {
      const r = [p[0] - offset[0], y - 0.025, p[1] - offset[1]],
        s = [p[0] + offset[0], y - 0.025, p[1] + offset[1]];
      beam(out, 'stone', r, s, 0.038, 0.036, tint.ashlar);
    }
  }
  if (lod === 0) return;
  for (const side of [-1, 1]) {
    const o = offset.map((v) => v * side * 0.94);
    const p = [from[0] + o[0], low + 0.91, from[1] + o[1]],
      q = [to[0] + o[0], high + 0.91, to[1] + o[1]];
    beam(out, 'detail', p, q, 0.051, 0.053, tint.iron);
    const count = lod === 1 ? 3 : n;
    for (let i = 0; i <= count; i++) {
      const u = i / count,
        x = mix(p[0], q[0], u),
        z = mix(p[2], q[2], u),
        y = mix(low, high, u);
      beam(out, 'detail', [x, y + 0.045, z], [x, y + 0.91, z], 0.041, 0.041, tint.iron);
    }
  }
}

function terraceGate(out, z, height, lod, front = true) {
  const s = front ? section([-2, z], [2, z]) : section([2, z], [-2, z]);
  const gate = [
    [-0.57, 0.03],
    [0.57, 0.03],
    [0.57, 1.76],
    [0.28, 1.94],
    [-0.28, 1.94],
    [-0.57, 1.76],
  ];
  fill(out, s, 'detail', gate, tint.iron, 0.047);
  if (lod === 0) return;
  for (const u of [-0.67, 0.67])
    for (let y = 0.04; y < 1.77; y += 0.34) {
      const w = y % 0.68 < 0.2 ? 0.2 : 0.15;
      band(out, s, 'stone', [u - w / 2, y], [u + w / 2, y + 0.31], 0, 0.064, tint.ashlar, lod >= 2);
    }
  band(
    out,
    s,
    'stone',
    [-0.16, 1.88],
    [0.16, Math.min(height - 0.06, 2.2)],
    0,
    0.083,
    tint.stone,
    lod >= 2,
  );
  if (lod >= 2)
    for (let i = -4; i <= 4; i++) {
      const u = i * 0.113;
      beam(out, 'detail', s.p(u, 0.12, 0.052), s.p(u, 1.74, 0.052), 0.029, 0.032, tint.shutters);
    }
}

function landPorch(out, lod) {
  const r = land.recessWidth / 2,
    first = land.firstDeck,
    second = land.secondDeck;
  box(
    out,
    'brick',
    [-r - 0.16, -0.27, land.recessBack],
    [r + 0.16, first - 0.14, land.terraceEdge],
    tint.brick,
  );
  box(
    out,
    'stone',
    [-r - 0.24, first - 0.14, land.recessBack],
    [r + 0.24, first, land.terraceEdge + 0.065],
    tint.palePaving,
  );
  terraceGate(out, land.terraceEdge, first, lod);
  paving(out, -r, r, land.recessBack + 0.12, land.terraceEdge - 0.14, first + 0.003, lod);
  box(
    out,
    'timber',
    [-r - 0.42, second - 0.76, land.recessBack],
    [r + 0.42, second + 0.035, land.columnZ + 0.27],
    tint.trim,
  );
  box(
    out,
    'timber',
    [-r - 0.28, eaves - 0.42, land.recessBack],
    [r + 0.28, eaves - 0.07, land.columnZ + 0.4],
    tint.cream,
  );
  for (const x of [-4.79, -1.62, 1.62, 4.79]) {
    roundColumn(out, x, land.columnZ, first, second - 0.76, 'doric', lod);
    roundColumn(out, x, land.columnZ, second + 0.018, eaves - 0.43, 'ionic', lod);
  }
  for (const [a, b] of [
    [-4.5, -1.88],
    [-1.34, 1.34],
    [1.88, 4.5],
  ])
    railing(out, [a, land.columnZ + 0.09], [b, land.columnZ + 0.09], second + 0.035, 'wood', lod);
  if (lod >= 1) {
    railing(
      out,
      [-1.63, land.terraceEdge - 0.05],
      [1.63, land.terraceEdge - 0.05],
      first,
      'iron',
      lod,
    );
    for (const sign of [-1, 1])
      railing(
        out,
        [sign * (r + 0.03), land.columnZ + 0.24],
        [sign * (r + 0.03), land.terraceEdge - 0.04],
        first,
        'iron',
        lod,
      );
  }
  for (const x of [-3.24, 3.24])
    stair(
      out,
      [x, land.stairExtent],
      [x, land.terraceEdge - 0.06],
      grade(x, land.stairExtent) + 0.03,
      first,
      3.1,
      lod,
    );
  if (lod >= 2) {
    const s = section([-r - 0.42, land.columnZ + 0.27], [r + 0.42, land.columnZ + 0.27]);
    for (const u of [-4.79, -3.2, -1.62, 0, 1.62, 3.2, 4.79]) {
      const ring = Array.from({ length: 10 }, (_, i) => [
        u + 0.1 * Math.cos((i * Math.PI) / 5),
        second - 0.2 + 0.094 * Math.sin((i * Math.PI) / 5),
      ]);
      fill(out, s, 'timber', ring, tint.cream, 0.036);
    }
  }
}

function riverPorch(out, lod) {
  const z = -depth,
    edge = z - river.porchDepth,
    y = river.firstDeck,
    r = river.porchWidth / 2;
  box(out, 'brick', [-r - 0.12, -0.24, edge], [r + 0.12, y - 0.12, z + 0.07], tint.brick);
  box(out, 'stone', [-r - 0.22, y - 0.12, edge - 0.08], [r + 0.22, y, z + 0.08], tint.palePaving);
  paving(out, -r, r, edge, z, y + 0.004, lod);
  terraceGate(out, edge, y, lod, false);
  railing(out, [-r, edge], [r, edge], y, 'iron', lod);
  for (const sign of [-1, 1]) {
    const landingX = sign * 4.91,
      landingY = 1.13,
      mid = z - 0.96;
    box(
      out,
      'brick',
      [landingX - 1.03, -0.23, edge - 0.04],
      [landingX + 1.03, landingY, z + 0.04],
      tint.brick,
    );
    stair(out, [sign * 4.58, mid], [sign * r, mid], landingY, y, 1.73, lod);
    stair(
      out,
      [landingX, -river.stairExtent],
      [landingX, edge + 0.02],
      grade(landingX, -river.stairExtent) + 0.04,
      landingY,
      1.89,
      lod,
    );
  }
}

function roofRing(x, y, z) {
  return [
    [-x, y, -z],
    [-x, y, z],
    [x, y, z],
    [x, y, -z],
  ];
}

function pediment(out, front, lod) {
  const sign = front ? 1 : -1,
    z = sign * (front ? land.pedimentDepth : depth + 0.37),
    half = front ? 5.49 : 4.82;
  const apex = front ? land.pedimentApex : river.pedimentApex;
  const s = section([-half * sign, z], [half * sign, z]);
  const triangle = [
    [-half, eaves - 0.03],
    [half, eaves - 0.03],
    [0, apex],
  ];
  const mid = eaves + 1.17,
    n = [8, 12, 18, 22][lod];
  const oval = (r, y) =>
    Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      mid + y * Math.sin((i * 2 * Math.PI) / n),
    ]);
  const inner = oval(0.36, 0.47),
    outer = oval(0.45, 0.57);
  fill(out, s, 'shingle', triangle, tint.gable, 0, lod >= 2 ? [inner] : []);
  fill(out, s, 'timber', outer, tint.cream, 0.039);
  fill(out, s, 'detail', inner, tint.iron, 0.054);
  if (lod >= 1)
    for (let y = -0.39; y <= 0.41; y += 0.1) {
      const reach = 0.35 * Math.sqrt(1 - Math.pow(y / 0.49, 2));
      band(
        out,
        s,
        'timber',
        [-reach, mid + y - 0.012],
        [reach, mid + y + 0.012],
        0.053,
        0.065,
        tint.sash,
      );
    }
  for (const side of [-1, 1]) {
    const a = [side * half, eaves, z + sign * 0.12],
      b = [0, apex, z + sign * 0.12],
      q = [0, apex, -0.05 + sign * 5.07];
    beam(out, 'timber', a, b, 0.16, 0.16, tint.cream);
    oriented(out, 'roof', [a, b, q], [0, 1, 0], tint.red);
    oriented(out, 'roof', [a, q, [side * half, 12.9, sign * 5.55]], [0, 1, 0], tint.red);
  }
  beam(
    out,
    'timber',
    [-half, eaves - 0.03, z + sign * 0.095],
    [half, eaves - 0.03, z + sign * 0.095],
    0.13,
    0.12,
    tint.cream,
  );
}

function roof(out, lod) {
  const base = roofRing(width + 0.49, eaves, depth + 0.48);
  const shoulder = roofRing(8.46, plan.upperRoofBreak, 5.67);
  const bell = [base, roofRing(10.11, 11.91, 7.49), roofRing(9.24, 12.81, 6.58), shoulder];
  loft(out, 'roof', lod === 0 ? [base, shoulder] : bell, tint.red, { cap: false });
  loft(out, 'roof', [shoulder, roofRing(2.88, plan.ridge, 0.13)], tint.ridge, { cap: true });
  loft(
    out,
    'timber',
    [
      roofRing(8.52, plan.upperRoofBreak - 0.09, 5.72),
      roofRing(8.5, plan.upperRoofBreak + 0.055, 5.71),
    ],
    tint.cream,
    { cap: false },
  );
  for (const x of [-7.67, 7.67]) {
    box(out, 'brick', [x - 1.03, 12.86, -0.72], [x + 1.03, 15.6, 0.73], tint.brick);
    box(out, 'brick', [x - 1.11, 15.55, -0.79], [x + 1.11, 15.77, 0.79], tint.sun);
    box(out, 'stone', [x - 1.15, 15.75, -0.84], [x + 1.15, 15.89, 0.84], tint.ashlar);
    if (lod >= 2) box(out, 'detail', [x - 0.89, 15.88, -0.61], [x + 0.89, 15.91, 0.61], tint.iron);
  }
  pediment(out, true, lod);
  pediment(out, false, lod);
}

function build(out, lod) {
  body(out, lod);
  roof(out, lod);
  landPorch(out, lod);
  riverPorch(out, lod);
}
export const draytonSkyline = (out) => build(out, 0);
export const draytonDistrict = (out) => build(out, 1);
export const draytonStreet = (out) => build(out, 2);
export const draytonCloseup = (out) => build(out, 3);
const recipe = 'drayton-hall-model.mjs';
const camera = [-31, 18, 46],
  lookAt = [0, 7, 1.4];
export const draytonModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: draytonCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Drayton Hall, with seven-bay brick elevations, a recessed double portico, paired stone stairs and a red two-stage hip roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-28, 42, 39],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    outlines: frame.geometry.polygons,
    minimumCoverage: 0.92,
    basis: 'Named main-house roof outline, with the masonry wall dimensions from HABS SC-377.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'metal_standing_seam',
    'siding_shingle',
    'stone_limestone_weathered',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'southwest-portico-and-paired-stairs',
      position: [-8.5, 7.1, 42],
      lookAt: [0, 7.5, 4.5],
    },
    {
      name: 'ashley-river-elevation-and-returning-steps',
      position: [13, 8.5, -36],
      lookAt: [0, 7.4, -5],
    },
    { name: 'recessed-portico-and-columns', position: [-7.3, 5.1, 23.5], lookAt: [0, 6.4, 8.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'draytonSkyline',
    errorMeters: 1.03,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'draytonDistrict', 0.46],
        ['street', 'draytonStreet', 0.16],
        ['closeup', 'draytonCloseup', 0.056],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped position is ODbL. The Qualla photo and federal HABS control drawings are in the public domain.',
};

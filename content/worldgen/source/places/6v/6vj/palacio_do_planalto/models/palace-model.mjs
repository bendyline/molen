import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const planaltoSurfaces = {
  slab: { slot: 'trim', graph: 'stone_limestone_raw' },
  deck: { slot: 'foundation', graph: 'stone_marble' },
  base: { slot: 'foundation', graph: 'concrete_plain' },
  glass: { slot: 'window', graph: 'window_grid' },
  metal: { slot: 'door', graph: 'metal_painted' },
  roof: { slot: 'roof', graph: 'membrane' },
};
const names = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const palette = {
  slab: '#e7e0d0',
  deck: '#d6d5cd',
  base: '#b6b4a7',
  glass: '#798e8b',
  metal: '#889291',
  roof: '#c2c3b8',
  shadow: '#455752',
  panel: '#8da09b',
  blue: '#728c91',
  silver: '#a4afaa',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    [...hex.slice(1).matchAll(/../g)].map(([pair]) => {
      const x = Number.parseInt(pair, 16) / 255;
      return x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff';
function face(out, slot, points, outward, tint = slot) {
  const n = normalFor(points[0], points[1], points[2]),
    match = n.reduce((sum, v, i) => sum + v * outward[i], 0) > 0;
  out.addConvexPolygon(
    slot,
    ref,
    match ? points : points.toReversed(),
    match ? n : n.map((v) => -v),
    (p) => [p[0], p[2]],
    color[tint],
  );
}
const block = (out, slot, x0, z0, x1, z1, y0, y1, tint = slot) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], color[tint]);
const point = ([x, z], y) => [x, y, z];

function shellRoof(out) {
  const y = layout.roofY;
  face(
    out,
    'roof',
    layout.roof.map((p) => point(p, y)),
    [0, 1, 0],
  );
  face(
    out,
    'slab',
    layout.roof.map((p) => point(p, y - 0.62)),
    [0, -1, 0],
  );
  for (let i = 0; i < layout.roof.length; i++) {
    const p = layout.roof[i],
      q = layout.roof[(i + 1) % layout.roof.length];
    face(
      out,
      'slab',
      [point(p, y - 0.62), point(q, y - 0.62), point(q, y), point(p, y)],
      [q[1] - p[1], 0, p[0] - q[0]],
    );
  }
}

function pier(out, { center: [x, z], inward, foot }, detail) {
  const low = foot - 0.28,
    top = layout.roofY - 0.56,
    tip = layout.deckY + 0.08,
    w = 0.4;
  const profile =
    detail === 0
      ? [
          [low, 0.57],
          [3.85, 0.64],
          [5.82, 3.9],
          [tip, 6.42],
          [8.62, 1.53],
          [top, 0.55],
        ]
      : [
          [low, 0.58],
          [3.42, 0.63],
          [4.32, 1.22],
          [5.12, 2.52],
          [5.75, 4.35],
          [tip, 6.42],
          [6.91, 4.18],
          [7.51, 2.98],
          [8.38, 2.12],
          [9.5, 1.55],
          [11.1, 1.1],
          [13.7, 0.79],
          [top, 0.54],
        ];
  const reach = inward < 0 ? z - 19.1 + 0.35 : -23.65 - z + 0.35;
  const p = (side, [y, depth]) => [
    x + side * w,
    y,
    z + inward * (0.55 + ((depth - 0.55) * (reach - 0.55)) / (6.42 - 0.55)),
  ];
  const outer = (side, y) => [x + side * w, y, z];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    for (const s of [-1, 1])
      face(out, 'slab', [outer(s, a[0]), p(s, a), p(s, b), outer(s, b[0])], [s, 0, 0]);
    face(out, 'slab', [p(-1, a), p(1, a), p(1, b), p(-1, b)], [0, 0, inward]);
  }
  face(
    out,
    'slab',
    [outer(-1, low), outer(1, low), outer(1, top), outer(-1, top)],
    [0, 0, -inward],
  );
  if (detail) {
    face(
      out,
      'slab',
      [outer(-1, low), p(-1, profile[0]), p(1, profile[0]), outer(1, low)],
      [0, -1, 0],
    );
    face(
      out,
      'slab',
      [outer(-1, top), p(-1, profile.at(-1)), p(1, profile.at(-1)), outer(1, top)],
      [0, 1, 0],
    );
  }
}

function ramp(out) {
  const p = layout.ramp.map(([x, z, y]) => [x, y, z]);
  for (let i = 1; i < p.length - 1; i++) face(out, 'deck', [p[0], p[i], p[i + 1]], [0, 1, 0]);
  const bottom = p.map(([x, y, z]) => [x, y - 0.4, z]);
  for (let i = 1; i < p.length - 1; i++)
    face(out, 'base', [bottom[0], bottom[i], bottom[i + 1]], [0, -1, 0]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    face(
      out,
      'deck',
      [bottom[i], bottom[j], p[j], p[i]],
      [p[j][2] - p[i][2], 0, p[i][0] - p[j][0]],
    );
  }
  for (let i = 1; i < layout.approach.length; i++) {
    const [a, b] = layout.approach[i - 1].map(([x, z, y]) => [x, y, z]);
    const [c, d] = layout.approach[i].map(([x, z, y]) => [x, y, z]);
    face(out, 'deck', [a, b, d], [0, 1, 0]);
    face(out, 'deck', [a, d, c], [0, 1, 0]);
  }
}

function lectern(out, detail) {
  const link = layout.lecternLink,
    y = layout.deckY;
  const vertices = [[link[0][0], 18.76], [link[1][0], 18.76], link[2], link[3]];
  face(
    out,
    'deck',
    vertices.map((p) => point(p, y)),
    [0, 1, 0],
  );
  face(
    out,
    'slab',
    vertices.map((p) => point(p, y - 0.42)),
    [0, -1, 0],
  );
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i],
      q = vertices[(i + 1) % vertices.length];
    face(
      out,
      'slab',
      [point(p, y - 0.42), point(q, y - 0.42), point(q, y), point(p, y)],
      [q[1] - p[1], 0, p[0] - q[0]],
    );
  }
  const ring = layout.lectern,
    c = [31.1, 35.37],
    rim = y + (detail ? 0.67 : 0.39);
  const inset = ([x, z]) => [c[0] + (x - c[0]) * 0.9, c[1] + (z - c[1]) * 0.9];
  face(
    out,
    'deck',
    ring.map((p) => point(inset(p), y)),
    [0, 1, 0],
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      top = i === 0 ? y : rim;
    const n = [b[1] - a[1], 0, a[0] - b[0]];
    face(out, 'slab', [point(a, a[2]), point(b, b[2]), point(b, top), point(a, top)], n);
    if (i === 0) continue;
    face(
      out,
      'deck',
      [point(a, top), point(b, top), point(inset(b), top), point(inset(a), top)],
      [0, 1, 0],
    );
    face(
      out,
      'slab',
      [point(inset(a), y), point(inset(b), y), point(inset(b), top), point(inset(a), top)],
      n.map((v) => -v),
    );
  }
}

function gradedApron(out, detail) {
  if (!detail) return;
  const grid = layout.floorGrid,
    stride = detail === 1 ? 3 : detail === 2 ? 2 : 1;
  const p = ([x, z, y]) => [x, y, z];
  for (let j = 0; j + stride < grid.length; j += stride)
    for (let i = 0; i + stride < grid[j].length; i += stride) {
      const [a, b, c, d] = [
        grid[j][i],
        grid[j][i + stride],
        grid[j + stride][i + stride],
        grid[j + stride][i],
      ].map(p);
      face(out, 'deck', [a, b, c], [0, 1, 0]);
      face(out, 'deck', [a, c, d], [0, 1, 0]);
    }
}

function lowerGlazing(out) {
  const y = layout.deckY - 0.49;
  for (const row of layout.lowerWalls)
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1],
        b = row[i],
        n = [b[1] - a[1], 0, a[0] - b[0]];
      face(out, 'glass', [point(a, a[2]), point(b, b[2]), point(b, y), point(a, y)], n, 'shadow');
    }
}

function curtain(out, ring, low, high, detail, tint) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz),
      nx = dz / l,
      nz = -dx / l;
    const p = (t, y, offset = 0) => [a[0] + t * dx + offset * nx, y, a[1] + t * dz + offset * nz],
      n = [nx, 0, nz];
    face(out, 'glass', [p(0, low), p(1, low), p(1, high), p(0, high)], n, tint);
    if (!detail) continue;
    for (const t of [1 / 3, 2 / 3]) {
      const y = low + (high - low) * t;
      face(
        out,
        'metal',
        [
          p(0, y - 0.095, 0.033),
          p(1, y - 0.095, 0.033),
          p(1, y + 0.095, 0.033),
          p(0, y + 0.095, 0.033),
        ],
        n,
        'silver',
      );
    }
    if (detail < 2) continue;
    const count = Math.round(l / 2.64);
    for (let j = 1; j < count; j++) {
      const u = j / count,
        w = 0.032 / l;
      face(
        out,
        'metal',
        [p(u - w, low, 0.044), p(u + w, low, 0.044), p(u + w, high, 0.044), p(u - w, high, 0.044)],
        n,
        'silver',
      );
    }
    if (detail >= 3)
      for (let j = 0; j < count; j++)
        for (let story = 0; story < 3; story++) {
          const h = (high - low) / 3,
            y = low + h * story + h * 0.72,
            u = j / count,
            v = (j + 1) / count;
          face(
            out,
            'metal',
            [
              p(u, y - 0.025, 0.041),
              p(v, y - 0.025, 0.041),
              p(v, y + 0.025, 0.041),
              p(u, y + 0.025, 0.041),
            ],
            n,
            j % 6 === 0 ? 'blue' : 'silver',
          );
        }
  }
}

export function buildPlanaltoLevel(out, level) {
  const detail = names[level];
  if (detail === undefined) throw Error('Unknown Planalto tier ' + level);
  shellRoof(out);
  for (const column of layout.columns) pier(out, column, detail);
  const core = [
    [-50.9, -23.65],
    [52.1, -23.65],
    [53.1, 19.1],
    [-51.2, 18.78],
  ];
  block(out, 'slab', -51.2, -23.65, 53.1, 19.1, layout.deckY - 0.51, layout.deckY);
  curtain(out, core, layout.deckY, layout.roofY - 0.68, detail, 'glass');
  if (detail) lowerGlazing(out);
  else
    curtain(
      out,
      [
        [-43, -18],
        [47, -18],
        [48, 12],
        [-43, 12],
      ],
      -6.6,
      layout.deckY - 0.49,
      0,
      'shadow',
    );
  for (const x of detail
    ? [-43.2, -29.5, -15.8, -2.1, 11.6, 25.3, 39.0, 47.7]
    : [-43.2, -25.1, -7.0, 11.1, 29.2, 47.7])
    for (const z of [-19.7, 16.9]) {
      if (!detail)
        block(out, 'slab', x - 0.27, z - 0.27, x + 0.27, z + 0.27, -6.6, layout.deckY - 0.47);
      else
        tube(
          out,
          'slab',
          [x, -5.9, z],
          [x, layout.deckY - 0.47, z],
          0.31,
          color.slab,
          detail >= 3 ? 12 : 6,
        );
    }
  ramp(out);
  lectern(out, detail);
  gradedApron(out, detail);
  if (detail >= 2) {
    const y = layout.deckY,
      z = 19.22;
    face(
      out,
      'glass',
      [
        [-20.03, y, z],
        [-11.83, y, z],
        [-11.83, y + 2.84, z],
        [-20.03, y + 2.84, z],
      ],
      [0, 0, 1],
      'shadow',
    );
    for (const x of [-19.98, -17.99, -15.94, -13.91, -11.9])
      block(out, 'metal', x - 0.026, z - 0.02, x + 0.026, z + 0.026, y, y + 2.84, 'silver');
    block(out, 'metal', -20.04, z - 0.03, -11.82, z + 0.03, y + 2.83, y + 2.91, 'silver');
  }
  if (detail >= 2) {
    for (const [x0, z0, x1, z1] of [
      [-31, -6, -7, -3],
      [-4, -6, 13, -3],
      [18, -6, 34, -3],
      [-20, -17, 18, -14],
      [23, -16, 33, -12],
    ]) {
      block(out, 'base', x0, z0, x1, z1, layout.roofY - 0.015, layout.roofY + 0.48);
      block(
        out,
        'roof',
        x0 - 0.08,
        z0 - 0.08,
        x1 + 0.08,
        z1 + 0.08,
        layout.roofY + 0.48,
        layout.roofY + 0.58,
      );
    }
  }
  if (detail === 4) {
    for (const z of [-5.84, -5.37, 4.4, 4.84])
      block(out, 'metal', -43, z - 0.035, 42, z + 0.035, layout.roofY + 0.05, layout.roofY + 0.16);
  }
}
export const buildPlanaltoSkyline = (out) => buildPlanaltoLevel(out, 'skyline');
export const buildPlanaltoDistrict = (out) => buildPlanaltoLevel(out, 'district');
export const buildPlanaltoStreet = (out) => buildPlanaltoLevel(out, 'street');
export const buildPlanaltoCloseup = (out) => buildPlanaltoLevel(out, 'closeup');

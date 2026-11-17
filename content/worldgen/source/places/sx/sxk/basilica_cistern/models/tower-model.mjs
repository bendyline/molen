/** Basilica Cistern: the complete 4.8 m grid, brick groins and restored visitor route. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  masonry: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.84 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.84 },
  floor: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.64 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66 },
  deck: { slot: 'roof', graph: 'metal_expanded_diamond', roughness: 0.68 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8 },
  water: {
    slot: 'window',
    localRef: 'palette:#677a67',
    name: 'Shallow cistern water',
    alphaMode: 'BLEND',
    baseColorFactor: [0.34, 0.4, 0.33, 0.45],
    metallic: 0.12,
    roughness: 0.22,
  },
};
const p = {
  brick: [0.59, 0.352, 0.229],
  red: [0.63, 0.331, 0.236],
  arch: [0.66, 0.39, 0.26],
  marble: [0.68, 0.664, 0.57],
  trim: [0.755, 0.727, 0.645],
  light: [0.87, 0.83, 0.717],
  sand: [0.69, 0.609, 0.472],
  floor: [0.44, 0.319, 0.243],
  metal: [0.245, 0.242, 0.204],
  copper: [0.46, 0.36, 0.242],
  deck: [0.38, 0.35, 0.287],
  tile: [0.68, 0.382, 0.29],
  water: [0.25, 0.31, 0.26],
  dark: [0.29, 0.264, 0.217],
  green: [0.5, 0.57, 0.407],
  glass: [0.29, 0.32, 0.273],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const T = layout.interior;
const variation = (k, j) => ((k * 109 + j * 83 + 137) % 127) / 127;
const tint = (key, v = 1) => p[key].map((c) => c * v);

const up = [0, 1, 0],
  down = [0, -1, 0];
function face(out, slot, points, c, n) {
  let normal = normalFor(...points);
  if (n && normal.reduce((a, v, i) => a + v * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normal.map((v) => -v);
  }
  if (Math.hypot(...normal) < 0.5) return;
  if (points.length === 3) out.addTriangle(slot, '', points, normal, undefined, c);
  else out.addQuad(slot, '', points, normal, undefined, c);
}
function patch(out, slot, points, c, n) {
  face(out, slot, points.slice(0, 3), c, n);
  face(out, slot, [points[0], points[2], points[3]], c, n);
}
const grid = (col, row) => [(col - 13.5) * T.bay, (row - 5.5) * T.bay];
function column(out, col, row, d) {
  const [x, z] = grid(col, row),
    phase = variation(col, row),
    parts = d >= 3 ? 7 : d === 2 ? 5 : 3,
    base = col === 0 && row <= 1 ? 1.73 : 0.31;
  const wide = 0.31 + 0.14 * phase,
    top = wide * (0.86 + 0.12 * variation(row, col)),
    ornate = phase > 0.46;
  const soil = tint(phase < 0.15 ? 'sand' : 'marble', 0.84 + phase * 0.24);
  const shaft =
    d === 1
      ? [
          [base, wide],
          [8.09, top],
        ]
      : d === 2
        ? [
            [base, wide],
            [8.12, top],
          ]
        : [
            [base, wide],
            [base + 0.3, wide * 1.03],
            [7.12, top],
            [7.55, top * 1.2],
            [8.02, top * 1.56],
          ];
  loft(
    out,
    'marble',
    shaft.map(([y, r]) => radialRing(y, r, r, parts, [x, z], 0.12)),
    soil,
    { cap: false },
  );
  if (d >= 3 && base < 1)
    box(
      out,
      'masonry',
      [x - wide * 1.59, 0.01, z - wide * 1.59],
      [x + wide * 1.59, base + 0.01, z + wide * 1.59],
      tint('sand', 0.88 + phase * 0.13),
    );
  if (d >= 3) {
    const c = (y, w) => chamferedRectangle(x, y, z, w, w, 0.12);
    loft(out, 'masonry', [c(7.97, top * 3.02), c(8.13, top * 3.34)], tint('trim'), { cap: false });
    if (ornate && (d === 4 || (row + col) % 2 === 0)) {
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * i) / 2 + 0.14,
          dx = Math.cos(angle),
          dz = Math.sin(angle),
          r = top * 1.47,
          q = [x + r * dx, 7.76, z + r * dz];
        const h = 0.22,
          a = 0.22;
        const point = (u, v, forward) => [
          q[0] - dz * u + dx * forward,
          q[1] + v,
          q[2] + dx * u + dz * forward,
        ];
        const planes = [
          point(-a, -h, 0),
          point(a, -h, 0),
          point(a * 0.7, h, -0.02),
          point(0, h * 0.82, 0.123),
          point(-a * 0.7, h, -0.02),
        ];
        for (let j = 1; j < planes.length - 1; j++)
          face(
            out,
            'marble',
            [planes[0], planes[j], planes[j + 1]],
            tint('trim', 0.87 + phase * 0.22),
            [dx, 0, dz],
          );
      }
    }
  }
}
function rainColumn(out, d) {
  if (d < 3) return;
  const [x, z] = grid(6, 5);
  for (let i = 0; i < (d === 4 ? 30 : 17); i++) {
    const a = i * 2.399963,
      r = 0.444,
      dx = Math.cos(a),
      dz = Math.sin(a),
      y = 1.12 + (i * 6.03) / (d === 4 ? 30 : 17);
    const point = (u, v, f) => [x + dx * (r + f) - u * dz, y + v, z + dz * (r + f) + u * dx];
    face(
      out,
      'marble',
      [
        point(-0.073, 0.045, 0),
        point(0, 0.123, 0.031),
        point(0.073, 0.045, 0),
        point(0, -0.083, 0.017),
      ],
      tint('green', 0.9 + (i % 4) * 0.043),
      [dx, 0, dz],
    );
  }
}
function walls(out, d) {
  const { plan } = layout;
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      n = [a[1] - b[1], 0, b[0] - a[0]];
    const sign = n[0] * a[0] + n[2] * a[1] > 0 ? -1 : 1;
    const N = n.map((x) => x * sign);
    const at = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
    const rows = d >= 3 ? 3 : 1,
      cols = d >= 3 ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7.8)) : 1;
    for (let m = 0; m < rows; m++)
      for (let j = 0; j < cols; j++) {
        const lo = (m * T.height) / rows,
          hi = ((m + 1) * T.height) / rows;
        face(
          out,
          'brick',
          [at(j / cols, lo), at((j + 1) / cols, lo), at((j + 1) / cols, hi), at(j / cols, hi)],
          tint('brick', 0.84 + variation(m + i, j) * 0.22),
          N,
        );
      }
  }
  for (const [ring, y, c] of [
    [plan, 0, 'floor'],
    [plan, T.water, 'water'],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        out,
        c,
        [
          [0, y, 0],
          [a[0], y, a[1]],
          [b[0], y, b[1]],
        ],
        p[c],
        up,
      );
    }
}
const archHeight = (h) => T.spring + 2.11 * Math.sqrt(Math.max(0, 1 - h * h));
function vaults(out, d) {
  const roomXs = [-69, ...Array.from({ length: 28 }, (_, i) => grid(i, 0)[0]), 69];
  const roomZs = [-32.3, ...Array.from({ length: 12 }, (_, i) => grid(0, i)[1]), 32.3];

  const k = d === 1 ? 1 : d === 2 ? 2 : d === 3 ? 3 : 4;
  for (let i = 1; i < roomXs.length; i++)
    for (let j = 1; j < roomZs.length; j++) {
      const [a, b] = roomXs.slice(i - 1, i + 1),
        [c, e] = roomZs.slice(j - 1, j + 1);
      const portals = layout.portals
        .map((p) => {
          const ax = Math.abs(p.f[0]) > 0.5;
          return ax
            ? [
                p.center[0] - 9.15,
                p.center[1] - p.width / 2 - 0.06,
                p.center[0] + 3.9,
                p.center[1] + p.width / 2 + 0.06,
              ]
            : [
                p.center[0] - p.width / 2 - 0.06,
                p.center[1] - 9.15,
                p.center[0] + p.width / 2 + 0.06,
                p.center[1] + 3.9,
              ];
        })
        .filter(([x0, z0, x1, z1]) => x0 < b && x1 > a && z0 < e && z1 > c);
      const positions = (lo, hi, dim) => {
        const regular = Array.from({ length: k + 1 }, (_, i) => lo + ((hi - lo) * i) / k);
        for (const portal of portals)
          for (const x of [portal[dim], portal[dim + 2]])
            if (x > lo + 0.0001 && x < hi - 0.0001) regular.push(x);
        return [...new Set(regular)].sort((a, b) => a - b);
      };
      const xs = positions(a, b, 0),
        zs = positions(c, e, 1);
      const pos = (x, z) => {
        const t = Math.max(
          Math.abs((2 * (x - a)) / (b - a) - 1),
          Math.abs((2 * (z - c)) / (e - c) - 1),
        );
        return [x, d === 1 ? T.spring : archHeight(t), z];
      };
      for (let u = 1; u < xs.length; u++)
        for (let v = 1; v < zs.length; v++) {
          const x = (xs[u - 1] + xs[u]) / 2,
            z = (zs[v - 1] + zs[v]) / 2;
          if (portals.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
          patch(
            out,
            'brick',
            [
              pos(xs[u - 1], zs[v - 1]),
              pos(xs[u], zs[v - 1]),
              pos(xs[u], zs[v]),
              pos(xs[u - 1], zs[v]),
            ],
            tint('arch', 0.8 + variation(i * 7 + u, j * 7 + v) * 0.18),
            down,
          );
        }
      if (!portals.length && d >= 3 && i > 1 && j > 1 && (d === 4 || (i + j) % 2 === 0)) {
        // Shallow ribs follow the intrados between the columns.
        for (let t = 0; t < k; t++) {
          const u = (2 * t) / k - 1,
            v = (2 * (t + 1)) / k - 1,
            w = 0.17;
          const x0 = a + ((b - a) * t) / k,
            x1 = a + ((b - a) * (t + 1)) / k,
            z0 = c + ((e - c) * t) / k,
            z1 = c + ((e - c) * (t + 1)) / k;
          patch(
            out,
            'brick',
            [
              [x0, archHeight(u) - 0.104, c - w],
              [x1, archHeight(v) - 0.104, c - w],
              [x1, archHeight(v) - 0.104, c + w],
              [x0, archHeight(u) - 0.104, c + w],
            ],
            tint('arch', 1.04),
            down,
          );
          patch(
            out,
            'brick',
            [
              [a - w, archHeight(u) - 0.103, z0],
              [a - w, archHeight(v) - 0.103, z1],
              [a + w, archHeight(v) - 0.103, z1],
              [a + w, archHeight(u) - 0.103, z0],
            ],
            tint('arch', 1.02),
            down,
          );
        }
      }
    }
  if (d >= 3)
    for (let i = 0; i < 28; i += 2)
      for (let j = 0; j < 12; j++) {
        const [x, z] = grid(i, j);
        if (i < 27 && (d === 4 || j % 2 === 0))
          beam(out, 'metal', [x + 0.39, 7.83, z], [x + 4.8 - 0.39, 7.83, z], 0.025, 0.026, p.metal);
        if (j < 11 && (d === 4 || j % 2 === 1))
          beam(out, 'metal', [x, 7.84, z + 0.4], [x, 7.84, z + 4.4], 0.025, 0.025, p.metal);
      }
}
function route(out, path, d) {
  const y = T.floor,
    w = 0.78;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const n = [-dz / length, dx / length];
    const pos = (t, h, l = 0) => [a[0] + t * dx + l * n[0], h, a[1] + t * dz + l * n[1]];
    const width = d === 1 ? 0.85 : w;
    face(
      out,
      'deck',
      [pos(0, y, -width), pos(1, y, -width), pos(1, y, width), pos(0, y, width)],
      p.deck,
      up,
    );
    if (i < path.length - 1)
      face(
        out,
        'deck',
        [
          [b[0] - w, y + 0.002, b[1] - w],
          [b[0] + w, y + 0.002, b[1] - w],
          [b[0] + w, y + 0.002, b[1] + w],
          [b[0] - w, y + 0.002, b[1] + w],
        ],
        p.deck,
        up,
      );
    if (d === 1) continue;
    const count = Math.ceil(length / (d === 2 ? 6.1 : 2.8));
    for (const side of [-1, 1]) {
      const v = side * w,
        inward = [-n[0] * side, 0, -n[1] * side];
      face(
        out,
        'metal',
        [pos(0, y, v), pos(1, y, v), pos(1, y - 0.15, v), pos(0, y - 0.15, v)],
        p.metal,
        inward.map((n) => -n),
      );
      const before = i === 1 ? 0 : width / length,
        after = i === path.length - 1 ? 1 : 1 - width / length;
      if (after <= before) continue;
      const lookup = (j) => before + ((after - before) * j) / count;
      for (const h of [1.04, 0.58])
        beam(out, 'metal', pos(before, y + h, v), pos(after, y + h, v), 0.048, 0.044, p.metal);
      for (let j = 0; j <= count; j++) {
        const t = lookup(j);
        beam(out, 'metal', pos(t, y - 0.13, v), pos(t, y + 1.07, v), 0.048, 0.06, p.metal);
        if (d >= 3 && j % 2 === 0)
          beam(
            out,
            'metal',
            pos(t, 0.035, v * 0.8),
            pos(t, y - 0.02, v * 0.8),
            0.066,
            0.078,
            p.metal,
          );
      }
    }
  }
}
function medusa(out, index, d) {
  const [x, z] = grid(0, index);
  const y = 1.07,
    w = 0.63,
    points = chamferedRectangle(x, 0, z, 1.59, 1.53, 0.21);
  loft(
    out,
    'masonry',
    [0.014, 0.12, 1.68, 1.75].map((y, i) =>
      points.map(([a, , b]) => [
        x + (a - x) * (i === 1 ? 1.04 : 1),
        y,
        z + (b - z) * (i === 1 ? 1.04 : 1),
      ]),
    ),
    tint('sand'),
  );
  if (d === 1) return;
  // The base blocks display the same type of head at two different rotations.
  const angle = index ? Math.PI / 2 : Math.PI,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const at = (a, b, h) => [x + a * c - b * s, y + a * s + b * c, z + 0.754 + h];

  const n = d === 2 ? 10 : 20;
  const shape = [
    [-0.61, 0.38, 0.2],
    [-0.46, 0.63, 0.25],
    [-0.31, 0.86, 0.28],
    [-0.12, 1, 0.3],
    [0.12, 1, 0.305],
    [0.32, 0.91, 0.25],
    [0.49, 0.64, 0.19],
    [0.59, 0.34, 0.115],
  ];
  const rings = shape.map(([v, width, relief], j) =>
    Array.from({ length: n }, (_, i) => {
      const u = -Math.PI / 2 + (Math.PI * i) / (n - 1),
        f = Math.cos(u);
      const eye = j === 5 ? 0.078 * Math.sin(3.1 * u) ** 2 : 0,
        nose = j === 4 ? 0.135 * Math.max(0, 1 - Math.abs(u) * 2) : 0;
      return at(w * width * Math.sin(u), v, relief * f - eye * f + nose);
    }),
  );
  for (let i = 1; i < rings.length; i++)
    for (let j = 1; j < n; j++)
      patch(
        out,
        'masonry',
        [rings[i - 1][j - 1], rings[i - 1][j], rings[i][j], rings[i][j - 1]],
        tint('trim', 0.9 + variation(i, j) * 0.125),
        [0, 0, 1],
      );
  const arcs = d >= 3 ? 12 : 6;
  for (let i = 0; i < arcs; i++) {
    const a = ((i / (arcs - 1)) * 1.7 - 0.85) * Math.PI;
    const strand = [
      at(0.59 * Math.sin(a), 0.39 + 0.37 * Math.cos(a), 0.16),
      at(0.61 * Math.sin(a + 0.18), 0.43 + 0.44 * Math.cos(a), 0.15),
      at(0.66 * Math.sin(a - 0.08), 0.42 + 0.51 * Math.cos(a), 0.104),
    ];
    for (let j = 1; j < strand.length; j++)
      beam(
        out,
        'masonry',
        strand[j - 1],
        strand[j],
        0.072,
        0.094,
        tint('sand', 0.87 + variation(i, j) * 0.27),
      );
  }
  if (d >= 3) {
    const lips = [
      at(-0.187, -0.259, 0.238),
      at(-0.075, -0.288, 0.271),
      at(0.063, -0.285, 0.273),
      at(0.166, -0.254, 0.238),
    ];
    for (let j = 1; j < lips.length; j++)
      beam(out, 'masonry', lips[j - 1], lips[j], 0.025, 0.027, tint('dark'));
    for (const sign of [-1, 1]) {
      const inner = at(sign * 0.12, 0.25, 0.293),
        middle = at(sign * 0.28, 0.295, 0.264),
        outer = at(sign * 0.44, 0.27, 0.222);
      beam(out, 'masonry', inner, middle, 0.039, 0.06, tint('sand'));
      beam(out, 'masonry', middle, outer, 0.039, 0.06, tint('sand'));
    }
  }
}
function portal(out, e, d) {
  const f = e.f,
    r = e.r,
    [x, z] = e.center,
    g = e.grade,
    w = e.width / 2,
    stripe = e.style === 'striped',
    width = stripe ? 5.52 : 5.0,
    rear = -6.7,
    front = stripe ? 3.76 : 2.54;
  const point = (u, y, v) => [x + r[0] * u + f[0] * v, y, z + r[1] * u + f[1] * v];
  const panel = (slot, u0, u1, y0, y1, v, c, n = null) =>
    face(
      out,
      slot,
      [point(u0, y0, v), point(u1, y0, v), point(u1, y1, v), point(u0, y1, v)],
      p[c],
      n ?? [f[0], 0, f[1]],
    );
  const side = (slot, u, z0, z1, y0, y1, c, sign) =>
    face(
      out,
      slot,
      [point(u, y0, z0), point(u, y0, z1), point(u, y1, z1), point(u, y1, z0)],
      p[c],
      [r[0] * sign, 0, r[1] * sign],
    );
  const threshold = g + 0.044,
    wallTop = g + (stripe ? 3.46 : 3.88);
  for (const sign of [-1, 1]) {
    side('masonry', sign * width, rear, front, g - 0.65, wallTop, stripe ? 'light' : 'trim', sign);
    side('masonry', sign * (width - 0.19), rear, front, g - 0.67, wallTop, 'sand', -sign);
    const a = sign === 1 ? w : -width,
      b = sign === 1 ? width : -w;
    panel('masonry', a, b, g - 0.35, wallTop, front, stripe ? 'light' : 'trim');
    panel('masonry', a, b, g - 0.35, wallTop, rear, 'sand', [-f[0], 0, -f[1]]);
    if (stripe) {
      for (let j = 0; j < (d === 0 ? 4 : 7); j++) {
        const y = g + 0.35 + j * (d === 0 ? 0.75 : 0.44);
        panel('brick', a, b, y, y + 0.13, front + 0.012, 'red');
        side('brick', sign * (width + 0.013), rear, front, y, y + 0.13, 'red', sign);
      }
    }
    const glassMid = (sign * (w + width)) / 2,
      glassW = stripe ? 1.05 : 1.48;
    panel(
      'metal',
      glassMid - glassW / 2,
      glassMid + glassW / 2,
      g + 0.89,
      g + 2.4,
      front + 0.023,
      stripe ? 'glass' : 'metal',
    );
    if (d >= 2)
      for (let i = 0; i < 6; i++) {
        const q = glassMid - glassW / 2 + ((i + 0.27) * glassW) / 5.54;
        beam(
          out,
          'metal',
          point(q, g + 0.88, front + 0.08),
          point(q, g + 2.43, front + 0.08),
          0.031,
          0.033,
          tint('copper'),
        );
      }
  }
  const signTop = g + 2.76;
  panel('masonry', -w, w, signTop, wallTop, front, stripe ? 'light' : 'trim');
  panel('masonry', -w, w, signTop, wallTop, rear, 'sand', [-f[0], 0, -f[1]]);
  panel('metal', -1.02, 1.02, g + 2.86, g + 3.15, front + 0.02, 'copper');
  const roofRows = [
    [
      [-width - 0.26, wallTop, front + 0.31],
      [width + 0.26, wallTop, front + 0.31],
    ],
    [
      [-width * 0.74, wallTop + (stripe ? 0.84 : 0.23), -0.41],
      [width * 0.74, wallTop + (stripe ? 0.84 : 0.23), -0.41],
    ],
    [
      [-width - 0.26, wallTop, rear - 0.26],
      [width + 0.26, wallTop, rear - 0.26],
    ],
  ];
  for (let j = 1; j < roofRows.length; j++) {
    const [a, b] = roofRows[j - 1],
      [c, d] = roofRows[j];
    patch(
      out,
      stripe ? 'tile' : 'masonry',
      [a, b, d, c].map((q) => point(...q)),
      p[stripe ? 'tile' : 'trim'],
      up,
    );
    for (const sign of [0, 1]) {
      const a = roofRows[j - 1][sign],
        b = roofRows[j][sign];
      patch(
        out,
        stripe ? 'tile' : 'masonry',
        [
          [sign ? width + 0.26 : -width - 0.26, wallTop, a[2]],
          a,
          b,
          [sign ? width + 0.26 : -width - 0.26, wallTop, b[2]],
        ].map((q) => point(...q)),
        p[stripe ? 'tile' : 'trim'],
        [r[0] * (sign ? 1 : -1), 0, r[1] * (sign ? 1 : -1)],
      );
    }
  }
  const yAt = (t) => threshold + (T.floor - threshold) * t;
  const inAt = (t) => 2.5 - (e.run + 2.5) * t;
  const stepPoint = (u, t, height = t) => point(u, yAt(height), inAt(t));
  // Use the same open stair profile at all levels. Actual treads come in at street distance.
  const count = d < 2 ? 1 : stripe ? 52 : 45;
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count,
      step = d < 2 ? b : a;
    face(
      out,
      'masonry',
      [stepPoint(-w, a), stepPoint(w, a), stepPoint(w, b, step), stepPoint(-w, b, step)],
      p.sand,
      up,
    );
    if (d >= 2)
      face(
        out,
        'masonry',
        [stepPoint(-w, b, a), stepPoint(w, b, a), stepPoint(w, b, b), stepPoint(-w, b, b)],
        p.trim,
        [f[0], 0, f[1]],
      );
  }
  for (const sign of [-1, 1]) {
    const pos = sign * (w + 0.09);
    const bottom0 = stepPoint(pos, 0),
      bottom1 = stepPoint(pos, 1);
    const top0 = point(pos, g + 2.45, 2.5),
      top1 = point(pos, T.height + 0.05, -e.run);
    patch(out, 'brick', [bottom0, bottom1, top1, top0], p.brick, [-sign * r[0], 0, -sign * r[1]]);
    const sc = d < 2 ? 3 : Math.ceil(e.run / 2.4);
    if (d > 0) {
      const above = ([x, y, z], n) => [x, y + n, z];
      for (let j = 0; j <= sc; j++) {
        const p = stepPoint(pos * 0.94, j / sc);
        beam(out, 'metal', p, above(p, 1.08), 0.051, 0.062, tint('metal'));
      }
      beam(
        out,
        'metal',
        above(stepPoint(pos * 0.94, 0), 1.06),
        above(stepPoint(pos * 0.94, 1), 1.06),
        0.057,
        0.07,
        p.metal,
      );
    }
  }
  const insideRoof = [
    [-w, g + 2.52, 2.46],
    [w, g + 2.52, 2.46],
    [w, g + 0.03, -6.64],
    [-w, g + 0.03, -6.64],
  ];
  patch(
    out,
    'brick',
    insideRoof.map((p) => point(...p)),
    p.brick,
    down,
  );
  const a = point(-w, g - 0.02, front + 0.43),
    b = point(w, g - 0.02, front + 0.43);
  const c = stepPoint(w, 0),
    q = stepPoint(-w, 0);
  face(out, 'masonry', [a, b, c, q], p.sand, up);
}
function buildLevel(out, level) {
  const d = levels[level];
  for (const e of layout.portals) portal(out, e, d);
  if (d === 0) return;
  walls(out, d);
  for (let col = 0; col < T.columns; col++)
    for (let row = 0; row < T.rows; row++) column(out, col, row, d);
  vaults(out, d);
  for (const path of layout.routes) route(out, path, d);
  medusa(out, 0, d);
  medusa(out, 1, d);
  rainColumn(out, d);
}
export const buildSkyline = (out) => buildLevel(out, 'skyline');
export const buildDistrict = (out) => buildLevel(out, 'district');
export const buildStreet = (out) => buildLevel(out, 'street');
export const buildCloseup = (out) => buildLevel(out, 'closeup');
export const buildMaster = (out) => buildLevel(out, 'master');
export const buildTowerLevel = buildLevel;

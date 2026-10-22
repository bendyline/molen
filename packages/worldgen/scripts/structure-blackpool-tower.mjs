/** Blackpool Tower: four open lattice stanchions and its intrinsic entertainment block. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gct/blackpool_tower/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  brick: rgb('b7715e'),
  steel: rgb('aa4043'),
  roof: rgb('656b70'),
  glass: rgb('718b95'),
  pale: rgb('e4ddc7'),
  terra: rgb('cf9276'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.16 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.29, metallic: 0.08 },
  pale: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.05 },
  terra: { slot: 'trim', localRef: ref, roughness: 0.94, metallic: 0 },
};
const area = (p) =>
  p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0);
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  const n = normalFor(...p),
    a = n.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, n, p.map(uv), col);
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function face(a, b, sgn = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [sgn * t[1], -sgn * t[0]];
  return {
    len,
    n: [n[0], 0, n[1]],
    P: (u, y, dep = 0) => [a[0] + u * t[0] + dep * n[0], y, a[1] + u * t[1] + dep * n[1]],
  };
}
function panel(o, s, f, u, y, w, h, dep = 0.03, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(u - w / 2, y, dep),
      f.P(u + w / 2, y, dep),
      f.P(u + w / 2, y + h, dep),
      f.P(u - w / 2, y + h, dep),
    ],
    f.n,
    col,
  );
}
function strip(o, s, f, a, b, w, dep = 0.08, col = C[s]) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 1e-7) return;
  const n = [((-(b[1] - a[1]) / l) * w) / 2, (((b[0] - a[0]) / l) * w) / 2];
  Q(
    o,
    s,
    [
      f.P(a[0] + n[0], a[1] + n[1], dep),
      f.P(b[0] + n[0], b[1] + n[1], dep),
      f.P(b[0] - n[0], b[1] - n[1], dep),
      f.P(a[0] - n[0], a[1] - n[1], dep),
    ],
    f.n,
    col,
  );
}
function ribbon(o, s, a, b, width, normal, col = C[s]) {
  const t = b.map((v, i) => v - a[i]),
    n = [
      normal[1] * t[2] - normal[2] * t[1],
      normal[2] * t[0] - normal[0] * t[2],
      normal[0] * t[1] - normal[1] * t[0],
    ],
    l = Math.hypot(...n);
  if (l < 1e-8) return;
  const v = n.map((x) => ((x / l) * width) / 2),
    ps = [
      a.map((x, i) => x + v[i]),
      b.map((x, i) => x + v[i]),
      b.map((x, i) => x - v[i]),
      a.map((x, i) => x - v[i]),
    ];
  Q(o, s, ps, normal, col);
  Q(
    o,
    s,
    [...ps].reverse(),
    normal.map((x) => -x),
    col,
  );
}
function member(o, a, b, w, d, n = [0, 0, 1], col = C.steel) {
  if (d === 0 || d === 1 || d === 2) ribbon(o, 'steel', a, b, w, n, col);
  else beam(o, 'steel', a, b, w, w, col);
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function walls(o, s, p, y0, y1) {
  const sg = area(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const f = face(p[i], p[(i + 1) % p.length], sg);
    panel(o, s, f, f.len / 2, y0, f.len, y1 - y0, 0);
  }
}
function solid(o, s, p, y0, y1) {
  walls(o, s, p, y0, y1);
  cap(o, s, p, y0, false);
  cap(o, s, p, y1);
}
function polygonBand(o, s, p, y0, y1) {
  walls(o, s, p, y0, y1);
}
function ringLoft(o, s, ps, ys, scales) {
  const sg = area(ps) > 0 ? 1 : -1;
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < ps.length; i++) {
      const k = (i + 1) % ps.length,
        a = ps[i],
        b = ps[k],
        f = face(a, b, sg);
      Q(
        o,
        s,
        [
          [a[0] * scales[j - 1], ys[j - 1], a[1] * scales[j - 1]],
          [b[0] * scales[j - 1], ys[j - 1], b[1] * scales[j - 1]],
          [b[0] * scales[j], ys[j], b[1] * scales[j]],
          [a[0] * scales[j], ys[j], a[1] * scales[j]],
        ],
        f.n,
      );
    }
}
const component = (id) => plan.components.find((p) => p.id === `way/${id}`).outline;
function hip(o, p, eave, ridge, s = 'roof', ratio = 0.23) {
  const cx = p.reduce((s, p) => s + p[0], 0) / p.length,
    cz = p.reduce((s, p) => s + p[1], 0) / p.length,
    top = p.map(([x, z]) => [cx + (x - cx) * ratio, cz + (z - cz) * ratio]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      s,
      [
        [...p[i].slice(0, 1), eave, p[i][1]],
        [p[j][0], eave, p[j][1]],
        [top[j][0], ridge, top[j][1]],
        [top[i][0], ridge, top[i][1]],
      ],
      [0, 1, 0],
    );
  }
  cap(o, s, top, ridge);
}
function window(o, f, u, y, w, h, d) {
  panel(o, 'glass', f, u, y, w, h, 0.08);
  const border = d === 1 ? 0.15 : 0.11;
  for (const x of [u - w / 2, u + w / 2]) strip(o, 'pale', f, [x, y], [x, y + h], border, 0.12);
  for (const yy of [y, y + h]) strip(o, 'pale', f, [u - w / 2, yy], [u + w / 2, yy], border, 0.12);
  if (d < 2) return;
  strip(o, 'pale', f, [u, y], [u, y + h], 0.08, 0.14);
  for (let j = 1; j < 4; j++)
    strip(o, 'pale', f, [u - w / 2, y + (h * j) / 4], [u + w / 2, y + (h * j) / 4], 0.07, 0.14);
  strip(o, 'terra', f, [u - w / 2 - 0.2, y - 0.2], [u + w / 2 + 0.2, y - 0.2], 0.19, 0.17);
}
function halfRound(o, f, u, y, w, rise, d) {
  const n = d === 1 ? 6 : 12,
    points = [
      [u - w / 2, y],
      [u + w / 2, y],
    ];
  for (let j = 1; j < n; j++) {
    const t = (Math.PI * j) / n;
    points.push([u + (Math.cos(t) * w) / 2, y + Math.sin(t) * rise]);
  }
  const ix = earcut(points.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'glass',
      ix.slice(i, i + 3).map((j) => f.P(...points[j], 0.1)),
      f.n,
    );
  for (let j = 0; j < n; j++) {
    const a = (Math.PI * j) / n,
      b = (Math.PI * (j + 1)) / n;
    strip(
      o,
      'pale',
      f,
      [u + (Math.cos(a) * w) / 2, y + Math.sin(a) * rise],
      [u + (Math.cos(b) * w) / 2, y + Math.sin(b) * rise],
      0.19,
      0.16,
    );
  }
  strip(o, 'pale', f, [u - w / 2, y], [u + w / 2, y], 0.17, 0.16);
  if (d > 1)
    for (let j = -2; j <= 2; j++) {
      const x = (j * w) / 6;
      strip(
        o,
        'pale',
        f,
        [u + x, y],
        [u + x, y + rise * Math.sqrt(Math.max(0, 1 - Math.pow(x / (w / 2), 2)))],
        0.09,
        0.16,
      );
    }
}
function entrance(o, f, u, d) {
  const spring = 3.4,
    rise = 1.5,
    r = 1.58,
    n = d === 2 ? 8 : 12;
  const points = [
    [u - r, 0.2],
    [u + r, 0.2],
    [u + r, spring],
  ];
  for (let j = 1; j <= n; j++) {
    const a = (Math.PI * j) / n;
    points.push([u + r * Math.cos(a), spring + rise * Math.sin(a)]);
  }
  const ix = earcut(points.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      'glass',
      ix.slice(j, j + 3).map((k) => f.P(...points[k], 0.07)),
      f.n,
    );
  for (let j = 0; j < n; j++) {
    const a = (Math.PI * j) / n,
      b = (Math.PI * (j + 1)) / n,
      inner = (t) => [u + r * Math.cos(t), spring + rise * Math.sin(t)],
      outer = (t) => [u + (r + 0.28) * Math.cos(t), spring + (rise + 0.28) * Math.sin(t)];
    Q(
      o,
      'terra',
      [
        f.P(...inner(a), 0.34),
        f.P(...inner(b), 0.34),
        f.P(...outer(b), 0.34),
        f.P(...outer(a), 0.34),
      ],
      f.n,
    );
    Q(o, 'terra', [
      f.P(...inner(a), 0.07),
      f.P(...inner(b), 0.07),
      f.P(...inner(b), 0.34),
      f.P(...inner(a), 0.34),
    ]);
  }
  for (const s of [-1, 1]) {
    strip(o, 'terra', f, [u + s * (r + 0.14), 0.1], [u + s * (r + 0.14), spring], 0.28, 0.34);
    Q(o, 'terra', [
      f.P(u + s * r, 0.1, 0.07),
      f.P(u + s * r, spring, 0.07),
      f.P(u + s * r, spring, 0.34),
      f.P(u + s * r, 0.1, 0.34),
    ]);
  }
  strip(o, 'terra', f, [u, 0.2], [u, spring], 0.13, 0.11);
  strip(o, 'pale', f, [u - r, 3.05], [u + r, 3.05], 0.13, 0.11);
}
function base(o, d) {
  const p = plan.outline,
    sg = area(p) > 0 ? 1 : -1;
  // The full mapped polygon is the attached building, not its surrounding parcel.
  solid(o, 'brick', p, -0.5, 16);
  polygonBand(o, 'terra', p, 15.6, 16.6);
  const north = [p[2], p[3], p[4], p[5], [24, -18], [-30, -18]];
  hip(o, north, 16.65, 22, 'roof', 0.42);
  const middle = component(669354518);
  solid(o, 'brick', middle, 16, 19.5);
  hip(o, middle, 19.5, 23, 'roof', 0.28);
  // Twin intrinsic glazed roof-garden ranges; exact current glazing census is estimated.
  for (const [a, b] of [
    [18.2, 29.3],
    [29.3, 40.3],
  ]) {
    const x0 = -27.8,
      x1 = 27.2,
      mid = (a + b) / 2;
    for (const z of [a, b])
      Q(
        o,
        'glass',
        [
          [x0, 16.7, z],
          [x1, 16.7, z],
          [x1, 21, mid],
          [x0, 21, mid],
        ],
        [0, 1, 0],
      );
    for (const x of [x0, x1]) {
      const h = x === x0 ? [-1, 0, 0] : [1, 0, 0];
      tri(
        o,
        'glass',
        [
          [x, 16.7, a],
          [x, 16.7, b],
          [x, 21, mid],
        ],
        h,
      );
    }
    if (d > 0)
      for (let j = 0; j <= 8; j++) {
        const x = x0 + ((x1 - x0) * j) / 8;
        for (const z of [a, b]) {
          if (d === 1) ribbon(o, 'pale', [x, 16.72, z], [x, 21.03, mid], 0.22, [1, 0, 0], C.pale);
          else beam(o, 'pale', [x, 16.72, z], [x, 21.03, mid], 0.17, 0.17, C.pale);
        }
      }
    if (d > 1)
      for (const q of [0.33, 0.67])
        for (const z of [a, b])
          beam(
            o,
            'pale',
            [x0, 16.7 + (21 - 16.7) * q, z + (mid - z) * q],
            [x1, 16.7 + (21 - 16.7) * q, z + (mid - z) * q],
            0.12,
            0.12,
            C.pale,
          );
  }
  const front = face([-30.1, 17.6], [-30.1, -17.8], 1);
  panel(o, 'brick', front, front.len / 2, 16.1, front.len, 2.05, 0);
  Q(
    o,
    'roof',
    [
      [-30.1, 18.15, -17.8],
      [-30.1, 18.15, 17.6],
      [-15.52, 19.5, 17.6],
      [-15.52, 19.5, -17.8],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [15.83, 19.5, -17.8],
      [15.83, 19.5, 17.6],
      [28.4, 16.65, 17.6],
      [23.2, 16.65, -17.8],
    ],
    [0, 1, 0],
  );
  if (d === 0) return;
  for (let i = 0; i < p.length; i++) {
    const f = face(p[i], p[(i + 1) % p.length], sg),
      n = Math.floor(f.len / (d === 1 ? 5.8 : 3.8));
    if (n < 1) continue;
    for (const y of [5.2, 10.5, 14.9]) strip(o, 'terra', f, [0, y], [f.len, y], 0.22, 0.13);
    for (let j = 0; j < n; j++) {
      const u = (f.len * (j + 0.5)) / n;
      window(o, f, u, 6.0, d === 1 ? 1.9 : 1.45, 4.1, d);
      if (d > 1) window(o, f, u, 11.2, 1.45, 3.65, d);
      if (d > 1) {
        panel(o, 'terra', f, u - 1.1, 5.4, 0.22, 10.1, 0.2);
        panel(o, 'terra', f, u + 1.1, 5.4, 0.22, 10.1, 0.2);
      }
      const entryCenter = i === 1 ? (p[1][1] * f.len) / (p[1][1] - p[2][1]) : 0;
      if (i === 1 && d > 1 && Math.abs(u - entryCenter) < 6.5) continue;
      // Other ground doors are closed panels; only the selected main arches have modeled reveals.
      panel(o, 'glass', f, u, 0.35, Math.min(2.35, f.len / n - 0.5), 3.9, 0.07);
      if (d > 1) {
        for (const x of [u - 1.22, u + 1.22]) strip(o, 'terra', f, [x, 0], [x, 5.0], 0.35, 0.24);
        strip(o, 'terra', f, [u - 1.35, 4.6], [u + 1.35, 4.6], 0.28, 0.24);
      }
    }
    if (i === 1 && d > 1) {
      const center = (p[1][1] * f.len) / (p[1][1] - p[2][1]);
      for (const du of [-3.9, 0, 3.9]) entrance(o, f, center + du, d);
    }
  }
  // Western entrance and north ballroom pediments are attached exterior architecture.
  const f = face(p[1], p[2], sg);
  for (const z of [-35, -19]) {
    const u = (p[1][1] - z) / ((p[1][1] - p[2][1]) / f.len),
      w = 8.5;
    panel(o, 'brick', f, u, 15.7, w, 3.1, 0.18);
    tri(
      o,
      'brick',
      [f.P(u - w / 2, 18.8, 0.18), f.P(u + w / 2, 18.8, 0.18), f.P(u, 21.1, 0.18)],
      f.n,
    );
    halfRound(o, f, u, 16.05, 6.4, 2.45, d);
    for (const x of [u - w / 2, u + w / 2]) strip(o, 'terra', f, [x, 14.7], [x, 20.6], 0.45, 0.32);
    for (const s of [-1, 1]) strip(o, 'terra', f, [u + (s * w) / 2, 18.8], [u, 21.1], 0.33, 0.32);
    if (d > 1) {
      panel(o, 'terra', f, u, 19.35, 1.3, 0.4, 0.3);
      for (const x of [u - w / 2, u + w / 2])
        beam(o, 'terra', f.P(x, 20.4, 0.25), f.P(x, 21.7, 0.25), 0.25, 0.25, C.terra);
    }
  }
  const frontBays = d === 1 ? 11 : 12;
  for (let j = 0; j < frontBays; j++)
    window(o, front, (front.len * (j + 0.5)) / frontBays, 16.35, 2.5, 1.5, d);
  if (d > 1)
    for (const [z, y] of [
      [-41, 22],
      [-18.5, 22.9],
      [18, 23],
    ])
      box(o, 'brick', [-17, 16, z - 0.65], [-15.7, y + 2.2, z + 0.65], C.brick);
}
const section = [
  [0, 15.24, 15.24, 5.8, 5.55],
  [23, 8.74, 8.3, 5.8, 5.55],
  [45, 6.6, 6.3, 4.15, 4.0],
  [68, 5.12, 4.95, 2.75, 2.65],
  [91, 4.28, 4.18, 1.68, 1.6],
  [112, 3.79, 3.75, 1.25, 1.25],
];
function at(y) {
  let j = 1;
  while (j < section.length - 1 && section[j][0] < y) j++;
  const a = section[j - 1],
    b = section[j],
    q = (y - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => v + (b[i] - v) * q);
}
function legPoint(sx, sz, y, ix = 0, iz = 0) {
  const p = at(y);
  return [sx * p[1] + (ix * p[3]) / 2, y, sz * p[2] + (iz * p[4]) / 2];
}
function tower(o, d) {
  const ys =
    d === 0
      ? [16, 23, 45, 68, 112]
      : Array.from({ length: [0, 4, 16, 23][d] + 1 }, (_, j) => 16 + (96 * j) / [0, 4, 16, 23][d]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      if (d === 0) {
        for (let j = 1; j < ys.length; j++) {
          const a = at(ys[j - 1]),
            b = at(ys[j]),
            lo = rect(
              sx * a[1] - a[3] / 2,
              sx * a[1] + a[3] / 2,
              sz * a[2] - a[4] / 2,
              sz * a[2] + a[4] / 2,
            ),
            hi = rect(
              sx * b[1] - b[3] / 2,
              sx * b[1] + b[3] / 2,
              sz * b[2] - b[4] / 2,
              sz * b[2] + b[4] / 2,
            );
          for (let k = 0; k < 4; k++) {
            const l = (k + 1) % 4,
              f = face(lo[k], lo[l]);
            Q(
              o,
              'steel',
              [
                [lo[k][0], a[0], lo[k][1]],
                [lo[l][0], a[0], lo[l][1]],
                [hi[l][0], b[0], hi[l][1]],
                [hi[k][0], b[0], hi[k][1]],
              ],
              f.n,
            );
          }
        }
        continue;
      }
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (let j = 1; j < ys.length; j++) {
        const a = ys[j - 1],
          b = ys[j],
          width = d === 1 ? 0.5 : 0.34;
        for (const [ix, iz] of corners) {
          const start = legPoint(sx, sz, a, ix, iz),
            end = legPoint(sx, sz, b, ix, iz);
          if (d === 1) {
            ribbon(o, 'steel', start, end, width, [1, 0, 0]);
            ribbon(o, 'steel', start, end, width, [0, 0, 1]);
          } else beam(o, 'steel', start, end, width, width, C.steel);
        }
        for (let k = 0; k < 4; k++) {
          const [ix, iz] = corners[k],
            [jx, jz] = corners[(k + 1) % 4],
            n = k % 2 ? [sx, 0, 0] : [0, 0, sz],
            aa = legPoint(sx, sz, a, ix, iz),
            ab = legPoint(sx, sz, a, jx, jz),
            ba = legPoint(sx, sz, b, ix, iz),
            bb = legPoint(sx, sz, b, jx, jz);
          member(o, aa, bb, d === 1 ? 0.35 : 0.22, d, n);
          member(o, ab, ba, d === 1 ? 0.35 : 0.22, d, n);
          member(o, ba, bb, 0.25, d, n);
        }
      }
    }
  const levels =
    d === 0
      ? [23, 51, 80, 112]
      : d === 1
        ? [23, 42, 62, 81, 98, 112]
        : [23, 33, 44, 55, 66, 77, 88, 99, 112];
  for (let j = 1; j < levels.length; j++) {
    const a = levels[j - 1],
      b = levels[j];
    for (const side of [-1, 1])
      for (const axis of [0, 2]) {
        const pa = at(a),
          pb = at(b),
          A = axis === 0 ? [-pa[1], a, side * pa[2]] : [side * pa[1], a, -pa[2]],
          B = axis === 0 ? [pb[1], b, side * pb[2]] : [side * pb[1], b, pb[2]],
          D = axis === 0 ? [pa[1], a, side * pa[2]] : [side * pa[1], a, pa[2]],
          E = axis === 0 ? [-pb[1], b, side * pb[2]] : [side * pb[1], b, -pb[2]],
          n = axis === 0 ? [0, 0, side] : [side, 0, 0];
        member(o, A, B, d === 0 ? 0.65 : 0.36, d, n);
        member(o, D, E, d === 0 ? 0.65 : 0.36, d, n);
        if (d > 0) member(o, B, E, 0.34, d, n);
      }
  }
  // Twin lift shafts remain narrow, rather than a solid tower envelope.
  box(o, 'steel', [-1.08, 16, -1.05], [1.08, 118.7, 1.05], C.steel);
  if (d > 0)
    for (const y of [25, 40, 55, 70, 85, 100]) {
      for (const z of [-1.12, 1.12])
        Q(
          o,
          'glass',
          [
            [-0.68, y, z],
            [0.68, y, z],
            [0.68, y + 6, z],
            [-0.68, y + 6, z],
          ],
          [0, 0, Math.sign(z)],
        );
    }
}
function rail(o, p, y, d, height = 1.15) {
  if (d === 0) return;
  const sg = area(p) > 0 ? 1 : -1;
  for (let j = 0; j < p.length; j++) {
    const a = p[j],
      b = p[(j + 1) % p.length],
      f = face(a, b, sg);
    strip(o, 'steel', f, [0, y + height], [f.len, y + height], d === 0 ? 0.25 : 0.13, 0);
    if (d > 0) {
      strip(o, 'steel', f, [0, y + 0.5], [f.len, y + 0.5], 0.09, 0);
      const n = d === 1 ? 1 : Math.max(1, Math.ceil(f.len / 1.5));
      for (let k = 0; k < n; k++)
        strip(o, 'steel', f, [(f.len * k) / n, y], [(f.len * k) / n, y + height], 0.09, 0);
    }
  }
}
function gallery(o, p, y0, y1, d, cols = true) {
  solid(o, 'steel', p, y0, y0 + 0.3);
  rail(o, p, y0 + 0.3, d);
  if (cols)
    for (let j = 0; j < p.length; j++) {
      if (
        d < 2 &&
        ![
          0,
          Math.floor(p.length / 4),
          Math.floor(p.length / 2),
          Math.floor((3 * p.length) / 4),
        ].includes(j)
      )
        continue;
      const a = p[j];
      beam(
        o,
        'steel',
        [a[0], y0, a[1]],
        [a[0], y1, a[1]],
        d === 0 ? 0.45 : 0.28,
        d === 0 ? 0.45 : 0.28,
        C.steel,
      );
    }
  if (y1 > y0 + 0.5) {
    solid(o, 'steel', p, y1 - 0.22, y1);
    if (d > 0) rail(o, p, y1, d);
  }
}
function domeFrame(o, cx, cz, y, r, h, d) {
  const n = d < 2 ? 4 : 12,
    levels =
      d < 2
        ? [
            [0, 1],
            [0.65, 0.72],
            [1, 0.08],
          ]
        : [
            [0, 1],
            [0.15, 1.1],
            [0.45, 0.9],
            [0.72, 0.46],
            [1, 0.08],
          ];
  for (let i = 0; i < n; i++) {
    const t = (i * Math.PI * 2) / n;
    for (let j = 1; j < levels.length; j++) {
      const a = levels[j - 1],
        b = levels[j];
      member(
        o,
        [cx + r * a[1] * Math.cos(t), y + h * a[0], cz + r * a[1] * Math.sin(t)],
        [cx + r * b[1] * Math.cos(t), y + h * b[0], cz + r * b[1] * Math.sin(t)],
        d === 0 ? 0.25 : 0.15,
        d,
        [Math.cos(t), 0, Math.sin(t)],
      );
    }
  }
  if (d > 1)
    for (const [q, s] of levels.slice(0, -1)) {
      const p = Array.from({ length: n }, (_, j) => [
        cx + r * s * Math.cos((j * Math.PI * 2) / n),
        cz + r * s * Math.sin((j * Math.PI * 2) / n),
      ]);
      rail(o, p, y + h * q, d === 3 ? 1 : 0, 0.1);
    }
  beam(o, 'steel', [cx, y + h, cz], [cx, y + h + 0.8, cz], 0.22, 0.22, C.steel);
}
function crown(o, d) {
  const lip = component(669351790),
    glass = component(669351788),
    second = component(669351778),
    third = component(669351781);
  ringLoft(o, 'steel', lip, [112, 114.7, 115], [0.51, 1, 1]);
  cap(o, 'steel', lip, 115);
  if (d > 0) rail(o, lip, 115, d);
  walls(o, 'glass', glass, 115, 118.7);
  cap(o, 'steel', glass, 118.7);
  polygonBand(o, 'pale', glass, 115, 115.25);
  polygonBand(o, 'pale', glass, 118.45, 118.7);
  if (d > 0)
    for (let j = 0; j < glass.length; j++) {
      const a = glass[j],
        b = glass[(j + 1) % glass.length],
        f = face(a, b, area(glass) > 0 ? 1 : -1),
        n = Math.max(1, Math.round(f.len / 1.05));
      for (let k = 0; k < n; k++)
        strip(o, 'pale', f, [(f.len * k) / n, 115], [(f.len * k) / n, 118.7], 0.13, 0.035);
    }
  gallery(o, glass, 118.7, 124, d);
  gallery(o, second, 124, 128, d);
  gallery(o, third, 128, 134, d);
  if (d > 0)
    for (const p of [glass, second, third])
      for (let j = 0; j < p.length; j++) {
        const a = p[j],
          b = p[(j + 1) % p.length],
          y = p === glass ? 119.1 : p === second ? 124.4 : 128.4,
          h = p === glass ? 4.5 : 3.3;
        member(o, [a[0], y, a[1]], [b[0], y + h, b[1]], 0.17, d, [b[1] - a[1], 0, a[0] - b[0]]);
      }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 4.85,
        z = sz * 4.7,
        y = 123.8;
      if (d > 0)
        for (const [a, b] of [
          [
            [-0.65, -0.65],
            [0.65, -0.65],
          ],
          [
            [0.65, -0.65],
            [0.65, 0.65],
          ],
          [
            [0.65, 0.65],
            [-0.65, 0.65],
          ],
          [
            [-0.65, 0.65],
            [-0.65, -0.65],
          ],
        ]) {
          beam(
            o,
            'steel',
            [x + a[0], 120.9, z + a[1]],
            [x + a[0], y, z + a[1]],
            0.17,
            0.17,
            C.steel,
          );
          member(o, [x + a[0], 121.1, z + a[1]], [x + b[0], y, z + b[1]], 0.12, d, [
            a[1] - b[1],
            0,
            b[0] - a[0],
          ]);
        }
      domeFrame(o, x, z, y, 0.9, 3.0, d);
    }
  domeFrame(o, 0, 0, 134, 3.15, 12, d);
  if (d === 0) {
    ribbon(o, 'steel', [0, 146, 0], [0, 158, 0], 0.5, [1, 0, 0]);
    ribbon(o, 'steel', [0, 146, 0], [0, 158, 0], 0.5, [0, 0, 1]);
  } else box(o, 'steel', [-0.2, 146, -0.2], [0.2, 158, 0.2], C.steel);
  if (d > 0) {
    const p = rect(-0.62, 0.62, -0.62, 0.62);
    gallery(o, p, 146, 148, d, false);
  }
}
function build(o, _f, d = 3) {
  base(o, d);
  tower(o, d);
  crown(o, d);
}
export const blackpoolSkyline = (o, f) => build(o, f, 0),
  blackpoolDistrict = (o, f) => build(o, f, 1),
  blackpoolStreet = (o, f) => build(o, f, 2);
export const blackpoolTowerModel = {
  id: 'blackpool_tower',
  key: 'blackpool_tower',
  recipe: 'structure-blackpool-tower.mjs',
  cell: 'gc/gct',
  title: 'Blackpool Tower',
  category: 'observation-tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete intrinsic Tower Buildings native brick polygon and roofs, four tapering open lattice stanchions with constituent pillars/diagonal bracing, central twin lift framing, pale-framed polygonal glass main gallery, three open upper galleries/corner cupolas, ogee open crown and158mmast. Original mapped component positions/heights, Qualla-first public-domain night view plus inspected exact creator own-work CC0native exterior control recognizable geometry. Adjacent Art Deco clock/store building and modern shops, beach/pier/promenade, seasonal illumination art, interiors/people/branding excluded. Hidden sections and small facade/roof census approximate.',
  camera: [-182, 108, 205],
  lookAt: [0, 72, 0],
  portableGroundY: -0.65,
  mediumFiContext: { scale: 3.6, groundY: -0.65 },
  qaCameras: [
    {
      name: 'native-tower-lattice-gallery-crown-and-intrinsic-base',
      position: [-185, 102, 160],
      lookAt: [0, 76, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'open-stanchion-pillars-diagonals-and-narrow-lift',
      position: [-36, 61, 41],
      lookAt: [0, 64, 0],
    },
    {
      name: 'glazed-gallery-three-open-stages-cupolas-and-ogee-cap',
      position: [-30, 129, 30],
      lookAt: [0, 131, 0],
    },
    {
      name: 'intrinsic-brick-block-ballroom-clerestory-and-twin-glazed-roofs',
      position: [-70, 34, 40],
      lookAt: [0, 12, -2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed western entrance approach[-33,0] before independent220mrawterrain; foundations/thresholds/coastal host contact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-blackpool-tower.mjs',
    level: 'skyline',
    export: 'blackpoolSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'blackpoolDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'blackpoolStreet', errorMeters: 0.55, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Qualla first: exact native MarkSJobling/Mjobling2006PD-userreleased night photograph controls silhouette only; clear supplemental MichaelDBeckwith2016native8688x5792own-workCC0photograph and pinned primary record control daytime structural form. Original SHA1matched; both viewed. Interior child/glassfloor/circus and unrelated/attribution/uncertain photographs excluded. No original photographic pixels or copied artwork/lettering embedded.',
    'Exact original eight-vertex attached entertainment-block outline retained; native Towerway213940301/Q880905plus15component outlines/heights/min-heights control exposed legs/gallery/crown. Native solid/skillion tower tags are envelope approximations, interpreted as actual open braced steel. Published ground stanchion base100ft and30ftupper width support a bounded concealed root extension; native above-roof plan is not globally stretched.',
    'Three unequal brick storeys, separate north ballroom roof, central raised circus roof/clerestory and twin south glazed roof-garden ranges follow original intrinsic building scope. Nominal16meaves/22mnorthroof and independent untagged facade/clerestory heights, exact window/pediment/roof-garden census and hidden current conservation are architectural estimates from inspected exterior and official text facts. No independently mapped neighboring Art Deco store/clock tower or modern shops included.',
    'Four stanchions have constituent columns/open diagonal panels near, coarser representative bracing at district, and solid narrowed stanchion envelopes/sparse major crosses at skyline. Central closed twin lift framing remains narrow; surrounding inter-leg gaps stay open. Three upper gallery stages and original ogee rib/cupola interpretation remain open. Plate/member dimensions, connections, corner cupola census, concealed lift machinery and exact structural cross-sections are medium-fi estimates, not an engineering survey.',
    'Opaque blue-grey glazing approximates closed observation/roof-garden panes. Applied window/terracotta ornaments have limited depth; ground door panels are closed rather than navigable interiors. No seasonal light artwork, flags/branding, interior circus/ballroom decoration, people or neighborhood landscape.',
    'Independent220mrawTerrariumfield frozen before geometry at the fixed western entrance approach. Original tile bytes/grid/heightPNGremain unchanged, without flattening/fitting; composite coastal urban grade, beach/promenade edges and footings are approximate. No model ground platform or neighborhood terrain mesh. Flatstage is an inspection surface rather than geographic grade certification.',
  ],
};

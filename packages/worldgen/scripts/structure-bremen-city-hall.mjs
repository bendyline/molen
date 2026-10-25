/** Whole attached Bremen Old/New Town Hall; exact native parts and clear CC0 exterior controls. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const root = '../../../content/worldgen/source/places/u1/u1q/bremen_city_hall/',
  p = JSON.parse(fs.readFileSync(new URL(`${root}plan-controls.json`, import.meta.url))),
  roof = JSON.parse(fs.readFileSync(new URL(`${root}roof-facets.json`, import.meta.url))),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('985f47'),
    stone: rgb('bcb5a2'),
    roof: rgb('7caaa0'),
    glass: rgb('4c6163'),
    iron: rgb('484b48'),
  },
  oldStone = rgb('8b7960'),
  oldRoof = rgb('53505c'),
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
    stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.23 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.39, metallic: 0.08 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.28 },
  };
const area = (r) =>
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) / 2,
  rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  tint = (c, t) => c.map((v) => v * t),
  simplify = (r) =>
    r.filter((v, i) => {
      const a = r[(i + r.length - 1) % r.length],
        b = r[(i + 1) % r.length];
      return Math.abs((v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0])) > 0.05;
    });
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true, col = C[s], holes = []) {
  const flat = [r, ...holes].flat(),
    hs = [];
  let n = r.length;
  for (const h of holes) {
    hs.push(n);
    n += h.length;
  }
  const ix = earcut(flat.flat(), hs);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [flat[k][0], y, flat[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, r, lo, hi, col = C[s], holes = []) {
  cap(o, s, r, lo, false, col, holes);
  cap(o, s, r, hi, true, col, holes);
  for (const [a, hole] of [[r, false], ...holes.map((h) => [h, true])]) {
    const sg = Math.sign(area(a)) * (hole ? -1 : 1);
    for (let i = 0; i < a.length; i++) {
      const u = a[i],
        v = a[(i + 1) % a.length];
      Q(
        o,
        s,
        [
          [u[0], lo, u[1]],
          [v[0], lo, v[1]],
          [v[0], hi, v[1]],
          [u[0], hi, u[1]],
        ],
        [sg * (v[1] - u[1]), 0, sg * (u[0] - v[0])],
        col,
      );
    }
  }
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  prism(o, s, rect(x, z, w, l), y, y + h, col);
}
function rod(o, s, a, b, w, col = C[s]) {
  const v = b.map((x, i) => x - a[i]),
    len = Math.hypot(...v);
  if (len < 1e-7) return;
  const axis = v.map((x) => x / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u),
    ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    D = ring(b);
  Q(
    o,
    s,
    A,
    axis.map((x) => -x),
    col,
  );
  Q(o, s, D, axis, col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], D[j], D[i]], null, col);
  }
}
function profile(o, s, r, z0, z1, col = C[s], axis = 'z') {
  const P = (v, z) => (axis === 'z' ? [v[0], v[1], z] : [z, v[1], v[0]]),
    N = (x, y, z) => (axis === 'z' ? [x, y, z] : [z, y, x]),
    ix = earcut(r.flat()),
    sg = Math.sign(area(r));
  for (const [z, side] of [
    [z0, -1],
    [z1, 1],
  ])
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        s,
        ix.slice(i, i + 3).map((k) => P(r[k], z)),
        N(0, 0, side),
        col,
      );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [P(a, z0), P(b, z0), P(b, z1), P(a, z1)],
      N(sg * (b[1] - a[1]), sg * (a[0] - b[0]), 0),
      col,
    );
  }
}
function lathe(o, s, x, z, levels, n, col = C[s]) {
  const rings = levels.map(([_y, r]) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((2 * Math.PI * i) / n),
      z + r * Math.sin((2 * Math.PI * i) / n),
    ]),
  );
  cap(o, s, rings[0], levels[0][0], false, col);
  cap(o, s, rings.at(-1), levels.at(-1)[0], true, col);
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        s,
        [
          [...rings[j - 1][i].slice(0, 1), levels[j - 1][0], rings[j - 1][i][1]],
          [rings[j - 1][k][0], levels[j - 1][0], rings[j - 1][k][1]],
          [rings[j][k][0], levels[j][0], rings[j][k][1]],
          [rings[j][i][0], levels[j][0], rings[j][i][1]],
        ],
        [Math.cos((2 * Math.PI * (i + 0.5)) / n), 0, Math.sin((2 * Math.PI * (i + 0.5)) / n)],
        col,
      );
    }
}
/** Recessed panes, real jamb/soffit reveals, outward wall strips; window glass is behind the wall plane. */
function wall(o, d, a, b, y0, y1, windows = [], col = C.brick, nOverride = null) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = nOverride ?? [u[1], 0, -u[0]],
    P = (x, y, depth = 0) => [a[0] + u[0] * x + n[0] * depth, y, a[1] + u[1] * x + n[2] * depth],
    quad = (s, x0, x1, lo, hi, depth, color) =>
      Q(o, s, [P(x0, lo, depth), P(x1, lo, depth), P(x1, hi, depth), P(x0, hi, depth)], n, color),
    holes = windows.map((w) => [
      [w.x - w.w / 2, w.y],
      [w.x + w.w / 2, w.y],
      [w.x + w.w / 2, w.y + w.h],
      [w.x - w.w / 2, w.y + w.h],
    ]);
  if (d < 2) {
    quad('brick', 0, len, y0, y1, 0, col);
    for (const w of windows)
      quad('glass', w.x - w.w / 2, w.x + w.w / 2, w.y, w.y + w.h, 0.012, C.glass);
    return;
  }
  const outer = [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ],
    flat = [outer, ...holes].flat(),
    ix = earcut(
      flat.flat(),
      holes.map((_, i) => 4 + i * 4),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'brick',
      ix.slice(i, i + 3).map((k) => P(...flat[k])),
      n,
      col,
    );
  for (const [i, h] of holes.entries()) {
    const w = windows[i];
    quad(
      'glass',
      w.x - w.w / 2,
      w.x + w.w / 2,
      w.y,
      w.y + w.h,
      -0.18,
      tint(C.glass, 0.94 + (i % 4) * 0.025),
    );
    for (let k = 0; k < 4; k++) {
      const A = h[k],
        E = h[(k + 1) % 4];
      Q(o, 'stone', [P(...A), P(...E), P(...E, -0.18), P(...A, -0.18)], null, C.stone);
    }
    if (d === 2) {
      for (const xx of [w.x - w.w / 2 - 0.07, w.x + w.w / 2 + 0.07])
        quad('stone', xx - 0.07, xx + 0.07, w.y - 0.1, w.y + w.h + 0.1, 0.04, C.stone);
      quad('stone', w.x - 0.035, w.x + 0.035, w.y, w.y + w.h, -0.09, C.stone);
    }
    if (d === 3) {
      for (const x of [w.x - w.w / 2 - 0.07, w.x + w.w / 2 + 0.07])
        rod(o, 'stone', P(x, w.y - 0.1, 0.04), P(x, w.y + w.h + 0.12, 0.04), 0.14);
      for (const y of [w.y - 0.08, w.y + w.h + 0.07])
        rod(o, 'stone', P(w.x - w.w / 2 - 0.15, y, 0.06), P(w.x + w.w / 2 + 0.15, y, 0.06), 0.15);
      const vert = d === 3 ? Math.max(2, Math.round(w.w / 0.4)) : 2,
        horiz = d === 3 ? Math.max(3, Math.round(w.h / 0.5)) : 2;
      for (let k = 1; k < vert; k++)
        rod(
          o,
          'stone',
          P(w.x - w.w / 2 + (w.w * k) / vert, w.y, -0.09),
          P(w.x - w.w / 2 + (w.w * k) / vert, w.y + w.h, -0.09),
          d === 3 ? 0.045 : 0.06,
        );
      for (let k = 1; k < horiz; k++)
        rod(
          o,
          'stone',
          P(w.x - w.w / 2, w.y + (w.h * k) / horiz, -0.09),
          P(w.x + w.w / 2, w.y + (w.h * k) / horiz, -0.09),
          d === 3 ? 0.04 : 0.06,
        );
    }
  }
}
function shell(o, d, r, lo, hi, holes = [], spacing = 3.6, col = C.brick) {
  if (d) {
    cap(o, 'brick', r, hi, true, col, holes);
    cap(o, 'stone', r, lo, false, C.stone, holes);
  }
  for (const [ring, hole] of [[r, false], ...holes.map((h) => [h, true])]) {
    const sg = Math.sign(area(ring)) * (hole ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(sg * (b[1] - a[1])) / len, 0, (sg * (a[0] - b[0])) / len],
        count = d === 0 ? 0 : Math.max(0, Math.floor((len - 1) / spacing)),
        wins = [];
      for (let j = 0; j < count; j++)
        for (const [y, h] of [
          [1.1, 3.35],
          [5.5, 3.25],
          [9.8, 3.25],
        ])
          if (y > lo && y + h < hi - 0.2)
            wins.push({
              x: (len * (j + 1)) / (count + 1),
              y,
              w: Math.min(1.7, (len / (count + 1)) * 0.65),
              h,
            });
      wall(o, d, a, b, lo, hi, wins, col, n);
    }
  }
}
function hip(o, r, eave, top, along = 'x', color = C.roof) {
  const xs = r.map((v) => v[0]),
    zs = r.map((v) => v[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    inset = Math.min((x1 - x0) / 2, (z1 - z0) / 2),
    A = along === 'x' ? [x0 + inset, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z0 + inset],
    D = along === 'x' ? [x1 - inset, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z1 - inset],
    corners = [
      [x0, eave, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [x0, eave, z1],
    ];
  if (along === 'x') {
    Q(o, 'roof', [corners[0], corners[1], D, A], [0, 1, 0], color);
    T(o, 'roof', [corners[1], corners[2], D], [0, 1, 0], color);
    Q(o, 'roof', [corners[2], corners[3], A, D], [0, 1, 0], color);
    T(o, 'roof', [corners[3], corners[0], A], [0, 1, 0], color);
  } else {
    T(o, 'roof', [corners[0], corners[1], A], [0, 1, 0], color);
    Q(o, 'roof', [corners[1], corners[2], D, A], [0, 1, 0], color);
    T(o, 'roof', [corners[2], corners[3], D], [0, 1, 0], color);
    Q(o, 'roof', [corners[3], corners[0], A, D], [0, 1, 0], color);
  }
}
function arcade(o, d) {
  const g = p.arcade,
    step = (g.x1 - g.x0) / g.bays,
    n = [1, 4, 10, 18][d],
    r = (step - 0.5) / 2;
  if (d) B(o, 'stone', (g.x0 + g.x1) / 2, 0, 11.98, g.x1 - g.x0, 0.15, 3.1, oldStone);
  for (let i = 0; i < 11; i++) {
    const x = g.x0 + step * (i + 0.5),
      arc = Array.from({ length: n * 2 + 1 }, (_, j) => {
        const t = j / (n * 2);
        return [
          x - r + 2 * r * t,
          g.spring + (g.crown - g.spring) * (1 - Math.pow(Math.abs(2 * t - 1), 1.5)),
        ];
      }),
      poly = [
        [x - step / 2, g.spring],
        ...arc,
        [x + step / 2, g.spring],
        [x + step / 2, g.top],
        [x - step / 2, g.top],
      ];
    profile(o, 'stone', poly, 13.12, 13.5, oldStone);
    if (d > 1)
      for (let j = 1; j < arc.length; j++)
        rod(
          o,
          'stone',
          [arc[j - 1][0], arc[j - 1][1], 13.56],
          [arc[j][0], arc[j][1], 13.56],
          0.14,
          tint(oldStone, 1.15),
        );
  }
  for (let i = 0; i < 12; i++) {
    const x = g.x0 + step * i;
    B(o, 'stone', x, 0.15, 13.27, 0.5, g.spring - 0.15, 0.57, oldStone);
    if (d) {
      B(o, 'stone', x, 0.12, 13.27, 0.72, 0.25, 0.73, oldStone);
      B(o, 'stone', x, g.spring - 0.15, 13.27, 0.73, 0.23, 0.74, oldStone);
    }
  }
  B(o, 'stone', -7.26, 5.15, 12, 41.7, 0.25, 3.3, oldStone);
}
function oldHall(o, d) {
  const h = p.oldHall,
    r = rect((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, h.x1 - h.x0, h.z1 - h.z0);
  cap(o, 'brick', r, 14.5);
  cap(o, 'stone', r, 0, false);
  const front = [];
  for (const x of [-25.4, -21.5, -17.6, -13.7, -0.8, 3.1, 7, 10.9])
    front.push({ x: x - h.x0, y: 6.2, w: 2.35, h: 6.5 });
  wall(o, d, [h.x0, h.z1], [h.x1, h.z1], 0, 14.5, front, C.brick, [0, 0, 1]);
  wall(
    o,
    d,
    [h.x1, h.z0],
    [h.x0, h.z0],
    0,
    14.5,
    d ? [...Array(9)].map((_, i) => ({ x: 2.5 + i * 4.25, y: 6.3, w: 2.05, h: 6 })) : [],
    C.brick,
    [0, 0, -1],
  );
  for (const [x, n] of [
    [h.x0, -1],
    [h.x1, 1],
  ])
    wall(
      o,
      d,
      [x, h.z0],
      [x, h.z1],
      0,
      14.5,
      d
        ? [
            { x: 3.1, y: 6.25, w: 2.5, h: 6.1 },
            { x: 8.05, y: 6.25, w: 2.5, h: 6.1 },
            { x: 12.7, y: 6.25, w: 2.5, h: 6.1 },
            { x: 8.05, y: 0.45, w: 2.5, h: 3.7 },
          ]
        : [],
      C.brick,
      [n, 0, 0],
    );
  hip(o, r, 14.5, 22.5, 'x', oldRoof);
  arcade(o, d);
  const owin = [];
  for (let i = 0; i < 4; i++)
    for (const [y, h] of [
      [5.95, 3.45],
      [10.1, 3.65],
    ])
      owin.push({ x: 0.8 + i * 2.08, y, w: 1.35, h });
  wall(o, d, [-11.18, 13.5], [-3.16, 13.5], 5.35, 14.5, owin, oldStone, [0, 0, 1]);
  for (const x of [-11.18, -3.16])
    Q(
      o,
      'stone',
      [
        [x, 5.35, 10.45],
        [x, 5.35, 13.5],
        [x, 14.5, 13.5],
        [x, 14.5, 10.45],
      ],
      [x < 0 ? -1 : 1, 0, 0],
      oldStone,
    );
  for (const [y, w, deep] of [
    [5.35, 8.3, 3.3],
    [9.55, 8.6, 3.4],
    [14.1, 8.7, 3.45],
  ])
    if (d || y !== 9.55) B(o, 'stone', -7.17, y, 11.97, w, 0.27, deep, oldStone);
  if (d > 1) {
    for (const z of [h.z0 - 0.05, h.z1 + 0.05])
      for (const y of [0.5, 5.3, 13.9]) B(o, 'stone', -7.26, y, z, 41.5, 0.18, 0.16, oldStone);
    for (let i = 0; i < 8; i++) figure(o, d, -23.8 + i * 4.75, 6.0, 10.74, 1.65, oldStone);
  }
  gable(o, d, -7.17, 13.51, 8.02, 14.5, 28.3, oldStone, true);
  for (const x of [-17.49, 3.59]) gable(o, d, x, 10.91, 4.4, 14.5, 21.3, oldStone, false);
  if (d) {
    balustrade(o, d, [-28, 14.6, 10.8], [13.4, 14.6, 10.8], 1, oldStone);
    balustrade(o, d, [-11.4, 14.7, 13.62], [-2.94, 14.7, 13.62], 1.0, oldStone);
  }
}
function gable(o, d, x, z, w, y, top, col, central) {
  const h = top - y,
    poly = [
      [x - w * 0.5, y],
      [x + w * 0.5, y],
      [x + w * 0.5, y + h * 0.22],
      [x + w * 0.4, y + h * 0.22],
      [x + w * 0.4, y + h * 0.43],
      [x + w * 0.28, y + h * 0.43],
      [x + w * 0.28, y + h * 0.66],
      [x + w * 0.13, y + h * 0.66],
      [x + w * 0.13, y + h * 0.86],
      [x, y + h],
      [x - w * 0.13, y + h * 0.86],
      [x - w * 0.13, y + h * 0.66],
      [x - w * 0.28, y + h * 0.66],
      [x - w * 0.28, y + h * 0.43],
      [x - w * 0.4, y + h * 0.43],
      [x - w * 0.4, y + h * 0.22],
      [x - w * 0.5, y + h * 0.22],
    ];
  profile(
    o,
    'stone',
    d === 0
      ? [
          [x - w * 0.5, y],
          [x + w * 0.5, y],
          [x + w * 0.5, y + h * 0.35],
          [x + w * 0.28, y + h * 0.35],
          [x + w * 0.28, y + h * 0.72],
          [x, y + h],
          [x - w * 0.28, y + h * 0.72],
          [x - w * 0.28, y + h * 0.35],
          [x - w * 0.5, y + h * 0.35],
        ]
      : poly,
    z - 1,
    z,
    col,
  );
  const tiers = central
    ? [
        [0.04, 0.2, 0.79, 4],
        [0.25, 0.39, 0.6, 3],
        [0.47, 0.61, 0.42, 2],
        [0.7, 0.81, 0.19, 1],
      ]
    : [
        [0.03, 0.24, 0.7, 2],
        [0.3, 0.45, 0.48, 1],
        [0.51, 0.65, 0.24, 1],
      ];
  if (d)
    for (const [a, b, ww, num] of tiers) {
      const yy = y + h * a,
        hh = h * (b - a);
      for (let i = 0; i < num; i++) {
        const xx = x - (w * ww) / 2 + (w * ww * (i + 0.5)) / num;
        Q(
          o,
          'glass',
          [
            [xx - ((w * ww) / num) * 0.32, yy, z + 0.02],
            [xx + ((w * ww) / num) * 0.32, yy, z + 0.02],
            [xx + ((w * ww) / num) * 0.32, yy + hh, z + 0.02],
            [xx - ((w * ww) / num) * 0.32, yy + hh, z + 0.02],
          ],
          [0, 0, 1],
        );
        if (d > 1) {
          for (let k = 1; k < (d === 3 ? 5 : 3); k++)
            rod(
              o,
              'stone',
              [xx - ((w * ww) / num) * 0.32, yy + (hh * k) / (d === 3 ? 5 : 3), z + 0.06],
              [xx + ((w * ww) / num) * 0.32, yy + (hh * k) / (d === 3 ? 5 : 3), z + 0.06],
              0.045,
              col,
            );
          rod(o, 'stone', [xx, yy, z + 0.07], [xx, yy + hh, z + 0.07], 0.065, col);
        }
      }
      B(o, 'stone', x, yy - 0.16, z + 0.02, w * ww + 0.4, 0.17, 0.3, col);
    }
  if (d > 1)
    for (const sg of [-1, 1])
      for (const [yy, xx, rad] of [
        [0.21, 0.48, 0.53],
        [0.43, 0.37, 0.42],
        [0.65, 0.25, 0.3],
      ]) {
        const cx = x + sg * w * xx,
          cy = y + h * yy,
          r = rad * (central ? 1 : 0.7),
          ring = Array.from({ length: d === 3 ? 14 : 8 }, (_, i) => [
            cx + r * Math.cos((2 * Math.PI * i) / (d === 3 ? 14 : 8)),
            cy + r * 1.24 * Math.sin((2 * Math.PI * i) / (d === 3 ? 14 : 8)),
          ]);
        profile(o, 'stone', ring, z - 0.15, z + 0.15, col);
      }
  if (d > 1) {
    for (const sg of [-1, 1])
      for (let t = 0; t < 3; t++) {
        const yy = y + h * [0.23, 0.44, 0.67][t],
          xx = x + sg * w * [0.47, 0.37, 0.25][t];
        lathe(
          o,
          'stone',
          xx,
          z - 0.08,
          [
            [yy, 0.22],
            [yy + 0.15, 0.3],
            [yy + 0.35, 0.16],
            [yy + 0.7, 0.08],
          ],
          d === 3 ? 10 : 6,
          col,
        );
      }
    for (const sg of [-1, 1]) figure(o, d, x + sg * w * 0.44, y + h * 0.23, z + 0.1, 0.85, col);
    figure(o, d, x, y + h - 0.1, z - 0.25, central ? 1.5 : 0.65, col);
  }
}
function figure(o, d, x, y, z, h, col) {
  lathe(
    o,
    'stone',
    x,
    z,
    [
      [y, 0.16 * h],
      [y + h * 0.44, 0.19 * h],
      [y + h * 0.78, 0.11 * h],
      [y + h * 0.89, 0.14 * h],
      [y + h, 0.08 * h],
    ],
    d === 3 ? 8 : 5,
    col,
  );
  if (d === 3) {
    rod(
      o,
      'stone',
      [x - 0.1 * h, y + 0.71 * h, z],
      [x - 0.3 * h, y + 0.4 * h, z + 0.06],
      0.12 * h,
      col,
    );
    rod(
      o,
      'stone',
      [x + 0.1 * h, y + 0.71 * h, z],
      [x + 0.27 * h, y + 0.45 * h, z + 0.07],
      0.12 * h,
      col,
    );
  }
}
function balustrade(o, d, a, b, h, col) {
  rod(o, 'stone', a, b, 0.18, col);
  rod(o, 'stone', [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.15, col);
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (d === 3 ? 0.42 : 0.75));
  for (let i = 0; i <= n; i++) {
    const v = mix(a, b, i / n);
    rod(o, 'stone', v, [v[0], v[1] + h, v[2]], d === 3 ? 0.1 : 0.12, col);
  }
}
function newHall(o, d) {
  const r = simplify(p.plans['225552770'].outline),
    hole = p.courtyard;
  shell(o, d, r, 0, 14, [hole], d === 1 ? 5 : 3.6);
  for (const f of roof.faces) {
    const flat = [f.ring, ...(f.holes ?? [])].flat(),
      holes = [];
    let n = f.ring.length;
    for (const h of f.holes ?? []) {
      holes.push(n);
      n += h.length;
    }
    const ix = earcut(
      flat.flatMap((v) => v.slice(0, 2)),
      holes,
    );
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'roof',
        ix.slice(i, i + 3).map((k) => [flat[k][0], flat[k][2], flat[k][1]]),
        [0, 1, 0],
      );
  }
  const parts = [224608436, 224608468, 224608430, 224608448, 224608460, 374370994];
  for (const id of parts) {
    const a = simplify(p.plans[id].outline),
      height = id === 374370994 ? 16 : 16.5;
    shell(o, d, a, 0, height, [], d === 1 ? 4.5 : 3.8);
    if ([224608436, 224608468, 224608430, 224608460].includes(id)) {
      const xx = a.map((v) => v[0]),
        zz = a.map((v) => v[1]),
        x0 = Math.min(...xx),
        x1 = Math.max(...xx),
        z0 = Math.min(...zz),
        z1 = Math.max(...zz),
        zm = (z0 + z1) / 2;
      for (const x of [x0, x1])
        T(
          o,
          'brick',
          [
            [x, height, z0],
            [x, height, z1],
            [x, 19, zm],
          ],
          [x === x0 ? -1 : 1, 0, 0],
        );
      Q(
        o,
        'roof',
        [
          [x0, height, z0],
          [x1, height, z0],
          [x1, 19, zm],
          [x0, 19, zm],
        ],
        [0, 1, 0],
        oldRoof,
      );
      Q(
        o,
        'roof',
        [
          [x0, 19, zm],
          [x1, 19, zm],
          [x1, height, z1],
          [x0, height, z1],
        ],
        [0, 1, 0],
        oldRoof,
      );
    } else hip(o, a, height, id === 374370994 ? 16.6 : 18, 'x', oldRoof);
  }
  const con = simplify(p.plans['374370979'].outline);
  shell(o, d, con, 0, 14, [], 4.5);
  hip(o, con, 14, 18, 'x');
  // Rounded northwest stair turret, complete native centre/radius; green onion over brick cylinder.
  const tr = p.plans['224608466'].outline,
    cx = tr.reduce((a, v) => a + v[0], 0) / tr.length,
    cz = tr.reduce((a, v) => a + v[1], 0) / tr.length,
    n = [3, 10, 20, 32][d];
  lathe(
    o,
    'brick',
    cx,
    cz,
    [
      [0, 2.5],
      [16.5, 2.5],
    ],
    n,
  );
  lathe(
    o,
    'roof',
    cx,
    cz,
    [
      [16.5, 2.65],
      [17.2, 2.8],
      [18.5, 2.55],
      [19.4, 1.45],
      [20, 0.45],
      [21.1, 0.12],
    ],
    n,
  );
  if (d)
    for (const y of [0.25, 5.4, 10.3, 15.8])
      lathe(
        o,
        'stone',
        cx,
        cz,
        [
          [y, 2.58],
          [y + 0.32, 2.58],
        ],
        n,
      );
  if (d > 1)
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * i) / 8,
        xx = cx + 2.51 * Math.cos(a),
        zz = cz + 2.51 * Math.sin(a);
      for (const y of [1.5, 6.4, 11.5])
        Q(
          o,
          'glass',
          [
            [xx - 0.4 * Math.sin(a), y, zz + 0.4 * Math.cos(a)],
            [xx + 0.4 * Math.sin(a), y, zz - 0.4 * Math.cos(a)],
            [xx + 0.4 * Math.sin(a), y + 2.5, zz - 0.4 * Math.cos(a)],
            [xx - 0.4 * Math.sin(a), y + 2.5, zz + 0.4 * Math.cos(a)],
          ],
          [Math.cos(a), 0, Math.sin(a)],
        );
    }
  // Native north facade includes two shallow rounded oriel projections beyond the main roof body.
  if (d)
    for (const [x, z] of [
      [18.6, -51.85],
      [25.7, -51.85],
    ]) {
      lathe(
        o,
        'stone',
        x,
        z,
        [
          [0, 1.9],
          [14.1, 1.9],
        ],
        d === 1 ? 6 : 12,
      );
      if (d > 1)
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + (Math.PI * i) / 5,
            xx = x + 1.92 * Math.cos(a),
            zz = z + 1.92 * Math.sin(a);
          for (const yy of [1.1, 5.5, 9.8])
            Q(
              o,
              'glass',
              [
                [xx - 0.35, yy, zz - 0.02],
                [xx + 0.35, yy, zz - 0.02],
                [xx + 0.35, yy + 3.1, zz - 0.02],
                [xx - 0.35, yy + 3.1, zz - 0.02],
              ],
              [0, 0, -1],
            );
        }
    }
  if (d) {
    const wins = [];
    for (let i = 0; i < 3; i++)
      for (const y of [1.1, 5.5, 9.8]) wins.push({ x: 1.1 + i * 2.4, y, w: 1.6, h: 3.25 });
    wall(o, Math.min(d, 2), [18.55, -53.61], [25.76, -53.61], 0, 14.1, wins, C.stone, [0, 0, -1]);
    profile(
      o,
      'stone',
      [
        [18.4, 14.1],
        [25.9, 14.1],
        [25.9, 17.4],
        [22.15, 20],
        [18.4, 17.4],
      ],
      -53.65,
      -52.9,
      oldStone,
    );
    for (const x of [20.5, 23.7])
      Q(
        o,
        'glass',
        [
          [x - 0.75, 14.5, -53.67],
          [x + 0.75, 14.5, -53.67],
          [x + 0.75, 16.8, -53.67],
          [x - 0.75, 16.8, -53.67],
        ],
        [0, 0, -1],
      );
  }
  if (d > 1) {
    const r = simplify(p.plans['225552770'].outline),
      sg = Math.sign(area(r));
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 3) continue;
      const n = [(sg * (b[1] - a[1])) / len, 0, (sg * (a[0] - b[0])) / len],
        P = (t, y, off = 0.025) => [
          a[0] + (b[0] - a[0]) * t + n[0] * off,
          y,
          a[1] + (b[1] - a[1]) * t + n[2] * off,
        ];
      Q(o, 'stone', [P(0, 0), P(1, 0), P(1, 0.85), P(0, 0.85)], n);
      if (d === 2) Q(o, 'stone', [P(0, 0.85), P(0.55 / len, 0.85), P(0.55 / len, 14), P(0, 14)], n);
      else
        for (let j = 0; j < 24; j++) {
          const t = (j % 2 ? 0.62 : 0.45) / len;
          Q(
            o,
            'stone',
            [
              P(0, 0.85 + j * 0.54),
              P(t, 0.85 + j * 0.54),
              P(t, 1.34 + j * 0.54),
              P(0, 1.34 + j * 0.54),
            ],
            n,
            tint(C.stone, 0.94 + (j % 3) * 0.025),
          );
        }
    }
  }
  lantern(o, d);
  if (d > 1) {
    for (const z of [-48, -42, -36, -30, -24, -18, -13])
      dormer(o, d, 33.8, z, 14, 1.65, 'x', oldStone);
    for (const z of [-45, -38, -31, -24, -17, -10]) dormer(o, d, 28, z, 18.2, 0.7, 'x', C.roof);
    for (const x of [0, 7, 14, 28, 33]) dormer(o, d, x, -51.0, 14, 1.4, 'z', oldStone);
  }
  if (d > 1) roofSeams(o, d);
}
function lantern(o, d) {
  const x = 25.1,
    z = -32.2;
  B(o, 'roof', x, 22.1, z, 2.2, 1.8, 2.6);
  for (const a of [-1, 1])
    for (const b of [-1, 1]) B(o, 'roof', x + a * 0.85, 23.9, z + b * 0.95, 0.2, 2.1, 0.2);
  B(o, 'roof', x, 26, z, 2.1, 0.3, 2.4);
  if (d) {
    for (const a of [-1, 1])
      for (let i = 0; i < 5; i++) B(o, 'iron', x, 24 + i * 0.33, z + a * 0.94, 1.5, 0.12, 0.08);
    balustrade(o, d, [x - 1.5, 23.3, z - 1.55], [x + 1.5, 23.3, z - 1.55], 0.7, C.roof);
    balustrade(o, d, [x + 1.5, 23.3, z - 1.55], [x + 1.5, 23.3, z + 1.55], 0.7, C.roof);
  }
  lathe(
    o,
    'roof',
    x,
    z,
    [
      [26.3, 1.35],
      [26.9, 1.4],
      [27.4, 0.8],
      [27.8, 0.17],
      [28.8, 0.04],
    ],
    d === 0 ? 4 : d === 1 ? 6 : 12,
  );
  if (d > 1) for (const zz of [-46, -18]) B(o, 'roof', x, 22, zz, 0.8, 0.7, 0.9);
}
function dormer(o, d, x, z, y, w, axis, col) {
  const q = [
    [0, 0],
    [w, 0],
    [w, 1.7 * w],
    [w / 2, 2.45 * w],
    [0, 1.7 * w],
  ].map((v) => [v[0] - w / 2 + (axis === 'x' ? z : x), v[1] + y]);
  profile(
    o,
    'stone',
    q,
    (axis === 'x' ? x : z) - 0.7,
    (axis === 'x' ? x : z) + 0.1,
    col,
    axis === 'x' ? 'x' : 'z',
  );
  const v =
    axis === 'x'
      ? [
          [x + 0.12, y + 0.25 * w, z - 0.32 * w],
          [x + 0.12, y + 0.25 * w, z + 0.32 * w],
          [x + 0.12, y + 1.45 * w, z + 0.32 * w],
          [x + 0.12, y + 1.45 * w, z - 0.32 * w],
        ]
      : [
          [x - 0.32 * w, y + 0.25 * w, z + 0.12],
          [x + 0.32 * w, y + 0.25 * w, z + 0.12],
          [x + 0.32 * w, y + 1.45 * w, z + 0.12],
          [x - 0.32 * w, y + 1.45 * w, z + 0.12],
        ];
  Q(o, 'glass', v, axis === 'x' ? [1, 0, 0] : [0, 0, 1]);
  if (d === 3) {
    const a = mix(v[0], v[1], 0.5),
      b = mix(v[3], v[2], 0.5);
    rod(o, 'stone', a, b, 0.07, col);
  }
}
function roofSeams(o, d) {
  const seam = (s, a, b, w, col = C[s]) => {
    if (d === 3) rod(o, s, a, b, w, col);
    else
      Q(
        o,
        s,
        [
          [a[0] - 0.02, a[1] + 0.012, a[2]],
          [a[0] + 0.02, a[1] + 0.012, a[2]],
          [b[0] + 0.02, b[1] + 0.012, b[2]],
          [b[0] - 0.02, b[1] + 0.012, b[2]],
        ],
        [0, 1, 0],
        col,
      );
  };
  const n = d === 3 ? 52 : 24,
    h = p.oldHall;
  for (let i = 1; i < n; i++) {
    const x = h.x0 + ((h.x1 - h.x0) * i) / n;
    for (const sg of [-1, 1]) {
      const mid = (h.z0 + h.z1) / 2,
        z = sg > 0 ? h.z1 : h.z0;
      const top =
        14.5 + 8 * Math.min(1, (x - h.x0) / ((h.z1 - h.z0) / 2), (h.x1 - x) / ((h.z1 - h.z0) / 2));
      seam('roof', [x, 14.52, z], [x, top + 0.02, mid], 0.027, oldRoof);
    }
  }
}
function build(o, _f, d = 3) {
  oldHall(o, d);
  newHall(o, d);
}
export const bremenCityHallSkyline = (o, f) => build(o, f, 0),
  bremenCityHallDistrict = (o, f) => build(o, f, 1),
  bremenCityHallStreet = (o, f) => build(o, f, 2),
  bremenCityHallCloseup = (o, f) => build(o, f, 3);
export const bremenCityHallModel = {
  id: 'bremen_city_hall',
  key: 'bremen_city_hall',
  cell: 'u1/u1q',
  recipe: 'structure-bremen-city-hall.mjs',
  title: 'Bremen City Hall',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [85, 58, 85],
  lookAt: [2, 12, -20],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 1.5, groundY: -0.18 },
  qaCameras: [
    {
      name: 'whole-old-and-attached-new-town-hall',
      position: [90, 57, 90],
      lookAt: [2, 12, -20],
      reviewLod: 'skyline',
    },
    {
      name: 'eleven-open-market-arcades-central-oriel-and-three-gables',
      position: [-7, 18, 72],
      lookAt: [-7, 12, 6],
    },
    {
      name: 'new-townhall-copper-hips-dormers-open-lantern-north-oriel',
      position: [85, 50, -90],
      lookAt: [15, 13, -30],
    },
    {
      name: 'western-crossgables-onion-stair-turret-and-open-courtyard',
      position: [-75, 58, -65],
      lookAt: [0, 12, -22],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: p.geometryBasis,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bremen-city-hall.mjs',
    level: 'skyline',
    export: 'bremenCityHallSkyline',
    errorMeters: 3.8,
    surfaces,
    authoredLevels: {
      district: { export: 'bremenCityHallDistrict', errorMeters: 1.8, surfaces },
      street: { export: 'bremenCityHallStreet', errorMeters: 0.45, surfaces },
      closeup: { export: 'bremenCityHallCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole attached Old/NewTownHall; separateRoland/TownMusicians/heralds/churches/parliament/marketstreet/paving/naturalground and undergroundinteriors not modeled. Nativefullphysicalouter/innercourtyard/parts/roofgraph retained. Mainfacadeeleven truepointedarcadebays/two-storeycentraloriel/threeRenaissancegables; lowerdetailedlevels simplify windowrecess/figures/pinnacles/dormers. Sculptures/coatsofarms/inscription/tracery are coarse abstractions, not precise individual portraits.',
    'Seven exactnativecreatorCC0originals: startpublishedQuallaZairon2009front, thencurrent2026LeonhardLenzsixviews. NativeSHA1/revisions/ownselfCC0grants bound. No attributionlicensed/questionablephotos or localmediarepairs. Currentdarkgrayoldroof overrides2009green; attachednewroofgreen. No photo textures/generatedbitmap.',
    'Nativeoldroof28m/14mrise expressly estimatedfromshadow; roof/gable/lantern heights conservativelyphoto-bounded22.5mold/newmainhips/~29mornamentlantern; not asurvey. Facetgraphroofvalleys/hiddenreardetail/precisereliefandwindowcensus estimated. Roofseamsandfinejambs simplify atdistance.',
    'Independent256m129²16641samplefield/oneoriginalTerrariumtile frozen before geometry; source range14.6587..23.3836m/fixedapproachdatum17.0043m. Output2.87mspacing/2mreviewgrid mayoversamplecoarseurbanDEM, notsurveyclassificationorbuildingthresholdgrade. Originalgrid/heightfield/rawtile unchanged. Flatreviewfixtures; actualhostgroundcontactunverified, geographicpreview/replaceFootprint=false.',
  ],
};

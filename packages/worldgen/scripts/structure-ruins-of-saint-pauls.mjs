/** Complete surviving granite facade; no reconstruction of the lost church. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';
import { treviHumanAnatomy } from './trevi-sculpture-anatomy.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/we/web/ruins_of_saint_paul_s/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('929086'),
    trim: rgb('a3a194'),
    bronze: rgb('3b625c'),
    dark: rgb('3c403c'),
    repair: rgb('c0beb1'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  bronze: { slot: 'trim', localRef: ref, roughness: 0.82, metallic: 0.25 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
  repair: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
};
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function tri(o, s, ps, n, col = C[s]) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    col,
  );
}

function Q(o, s, ps, n, col = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, col);
  tri(o, s, [ps[0], ps[2], ps[3]], n, col);
}

function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}

function panel(o, f, s, r, holes = [], depth = 0, col = C[s]) {
  const ps = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    ix = earcut(ps.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => f.p(...ps[j], depth)),
      [f.n[0], 0, f.n[1]],
      col,
    );
}

function B(o, s, lo, hi, col = C[s]) {
  box(o, s, lo, hi, col);
}

function localBox(o, f, s, x, y, z, w, h, depth, col = C[s]) {
  const q = new Proxy(o, {
    get(t, k) {
      if (k === 'addQuad')
        return (s, m, ps, n, uv, c) =>
          t.addQuad(
            s,
            m,
            ps.map((p) => f.p(...p)),
            [f.u[0] * n[0] + f.n[0] * n[2], n[1], f.u[1] * n[0] + f.n[1] * n[2]],
            uv,
            c,
          );
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  box(q, s, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], col);
}

function arch(x, y, w, spring, n) {
  const r = [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    r.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
  }
  r[r.length - 1] = [x - w / 2, spring];
  if (n % 2 === 0) r[2 + n / 2] = [x, spring + w / 2];
  return r;
}

function oval(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => {
    if ((i * 4) % n === 0)
      return [
        [x + rx, y],
        [x, y + ry],
        [x - rx, y],
        [x, y - ry],
      ][(i * 4) / n];
    const a = (i * 2 * Math.PI) / n;
    return [x + rx * Math.cos(a), y + ry * Math.sin(a)];
  });
}

function border(o, f, r, width, d, depth = 0.04) {
  const xs = r.map((p) => p[0]),
    ys = r.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2,
    w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - Math.min(...ys),
    outer = r.map(([x, y]) => [
      cx + (x - cx) * (1 + (2 * width) / w),
      cy + (y - cy) * (1 + (2 * width) / h),
    ]);
  panel(o, f, 'trim', outer, [r], depth);
  if (d === 3)
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        o,
        'trim',
        [
          f.p(...outer[i], depth),
          f.p(...outer[j], depth),
          f.p(...r[j], depth - 0.06),
          f.p(...r[i], depth - 0.06),
        ],
        [f.n[0], 0, f.n[1]],
      );
    }
}

function cornice(o, f, x, y, w, d, depth = 0.25) {
  if (d < 2) {
    panel(o, f, 'trim', rect(x, y, w, 0.18), [], depth);
    return;
  }
  for (const [dy, thick, proj] of [
    [0, 0.16, 1],
    [-0.14, 0.08, 0.7],
    [0.16, 0.12, 1.25],
  ])
    localBox(o, f, 'trim', x, y + dy, depth, w, thick, proj * 0.36);
}

function column(o, f, x, y, h, r, d) {
  if (d === 0) {
    localBox(o, f, 'trim', x, y, 0.16, r * 2, h, 0.45);
    return;
  }
  const n = d === 1 ? 4 : d === 2 ? 6 : 10,
    levels =
      d === 1
        ? [
            [0, r * 1.35],
            [h, r * 0.9],
          ]
        : [
            [0, r * 1.55],
            [0.18, r * 1.55],
            [0.3, r],
            [h - 0.65, r * 0.84],
            [h - 0.48, r * 1.2],
            [h - 0.3, r * 1.65],
            [h, r * 1.65],
          ];
  const rings = levels.map(([yy, rr]) => {
    const p = f.p(x, y + yy, 0.12);
    return radialRing(p[1], rr, rr, n, [p[0], p[2]]);
  });
  loft(o, 'trim', rings, C.trim);
  if (d === 3) {
    for (const s of [-1, 1]) {
      const p = f.p(x + s * r * 0.9, y + h - 0.3, 0.27);
      sphere(o, 'trim', p, [r * 0.6, r * 0.35, r * 0.4], C.trim, 8, 4);
    }
  }
}

function saint(o, f, x, y, h, d, variant = 0) {
  if (d === 0) return;
  if (d === 1) {
    const r = [
      [x - 0.18, y],
      [x + 0.18, y],
      [x + 0.13, y + h * 0.67],
      [x + 0.22, y + h * 0.75],
      [x, y + h * 0.93],
      [x - 0.22, y + h * 0.75],
      [x - 0.13, y + h * 0.67],
    ];
    panel(o, f, 'bronze', r, [], 0.05);
    return;
  }
  const P = (p) => f.p(x + p[0], y + p[1], (d === 2 ? 0.05 : -0.22) + p[2] * 0.65);
  const n = d === 2 ? 4 : 14,
    m = d === 2 ? 3 : 10,
    rings = [];
  for (let j = 0; j <= m; j++) {
    const t = j / m,
      r = h * (0.16 - 0.07 * t);
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (-i * 2 * Math.PI) / n,
          fold = d === 3 ? 0.013 * Math.cos(7 * a + 2 * t) : 0;
        return P([(r + fold) * Math.cos(a), h * 0.74 * t, (r * 0.6 + fold) * Math.sin(a)]);
      }),
    );
  }
  loft(o, 'bronze', rings, C.bronze);
  if (d === 2) {
    sphere(o, 'bronze', P([0, h * 0.86, 0.01]), [h * 0.082, h * 0.105, h * 0.065], C.bronze, 6, 3);
    for (const s of [-1, 1])
      beam(
        o,
        'bronze',
        P([s * h * 0.12, h * 0.68, 0]),
        P([s * h * 0.03, h * 0.53, h * 0.17]),
        h * 0.05,
        h * 0.05,
        C.bronze,
      );
    return;
  }
  const k = h / 4.3;
  treviHumanAnatomy(
    o,
    3,
    variant % 3 === 0 ? 'health' : 'abundance',
    C.bronze,
    (out, _slot, ps, col) => {
      if (ps.every((p) => p[1] < 2.6)) return;
      const pp = ps.map((p) => P([p[0] * k, p[1] * k, p[2] * k]));
      out.addTriangle(
        'bronze',
        ref,
        pp,
        normalFor(...pp),
        pp.map((p) => [p[0], p[2]]),
        col,
      );
    },
  );
  // Robed torso and original bounded attributes distinguish niches without claiming portrait fidelity.
  loft(
    o,
    'bronze',
    [
      [0.68, 0.11],
      [0.76, 0.15],
      [0.84, 0.09],
    ].map(([yy, r]) =>
      radialRing(y + h * yy, r * h, r * h * 0.58, 12, [f.p(x, 0, -0.22)[0], f.p(x, 0, -0.22)[2]]),
    ),
    C.bronze,
  );
  if (variant % 4 === 0) {
    beam(
      o,
      'bronze',
      P([h * 0.22, 0.04, 0.12]),
      P([h * 0.22, h * 0.94, 0.12]),
      0.035,
      0.035,
      C.bronze,
    );
    beam(
      o,
      'bronze',
      P([h * 0.12, h * 0.81, 0.12]),
      P([h * 0.32, h * 0.81, 0.12]),
      0.025,
      0.025,
      C.bronze,
    );
  } else if (variant % 4 === 1)
    localBox(o, f, 'bronze', x + h * 0.08, y + h * 0.5, -0.03, h * 0.2, h * 0.18, 0.09);
}
const front = frame([0, 0.9672652], [plan.facadeWidthMeters, 0.9672652]);
const contour = [
  [-10.65, -0.25],
  [10.65, -0.25],
  [10.65, 13.1],
  [10.35, 13.6],
  [9.9, 13.6],
  [9.7, 13.0],
  [8.8, 13.2],
  [7.6, 13.9],
  [6.5, 15.1],
  [6.15, 16.2],
  [6.15, 17.8],
  [5.2, 17.8],
  [4.8, 18.3],
  [4.8, 21.75],
  [0, 24.7],
  [-4.8, 21.75],
  [-4.8, 18.3],
  [-5.2, 17.8],
  [-6.15, 17.8],
  [-6.15, 16.2],
  [-6.5, 15.1],
  [-7.6, 13.9],
  [-8.8, 13.2],
  [-9.7, 13.0],
  [-9.9, 13.6],
  [-10.35, 13.6],
  [-10.65, 13.1],
];
function stroke(o, f, ps, w = 0.05, depth = 0.25, s = 'trim', col = C[s]) {
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-5) continue;
    if (f.detail < 3 || w < 0.03) {
      const nx = (-(b[1] - a[1]) * w) / (2 * length),
        ny = ((b[0] - a[0]) * w) / (2 * length);
      Q(
        o,
        s,
        [
          f.p(a[0] + nx, a[1] + ny, depth),
          f.p(a[0] - nx, a[1] - ny, depth),
          f.p(b[0] - nx, b[1] - ny, depth),
          f.p(b[0] + nx, b[1] + ny, depth),
        ],
        [f.n[0], 0, f.n[1]],
        col,
      );
    } else beam(o, s, f.p(...a, depth), f.p(...b, depth), w, w, col);
  }
}
function reliefRing(o, f, x, y, rx, ry, d, depth = 0.3, s = 'trim') {
  const n = d === 1 ? 6 : d === 2 ? 12 : 24,
    ring = oval(x, y, rx, ry, n);
  stroke(o, f, [...ring, ring[0]], d === 3 ? 0.045 : 0.06, depth, s);
}
function spiral(o, f, x, y, r, d, mirror = 1, depth = 0.3) {
  if (d === 0) return;
  const n = d === 1 ? 4 : d === 2 ? 12 : 28,
    ps = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        a = t * Math.PI * 3.3,
        rr = r * (1 - 0.85 * t);
      return [x + mirror * rr * Math.cos(a), y + rr * Math.sin(a)];
    });
  stroke(o, f, ps, d === 3 ? 0.065 : 0.09, depth);
}
function sun(o, f, x, y, r, d, depth = 0.26) {
  if (d === 0) return;
  reliefRing(o, f, x, y, r * 0.55, r * 0.55, d, depth);
  const n = d === 1 ? 6 : d === 2 || r < 0.2 ? 8 : 12;
  for (let j = 0; j < n; j++) {
    const a = (j * Math.PI * 2) / n;
    stroke(
      o,
      f,
      [
        [x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65],
        [x + Math.cos(a) * r, y + Math.sin(a) * r],
      ],
      d === 3 ? 0.035 : 0.06,
      depth,
    );
  }
}
function pin(o, f, x, y, h, d) {
  const n = d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 6 : 10,
    p = f.p(x, y, 0.06);
  loft(
    o,
    'trim',
    [
      [0, 0.21],
      [0.15, 0.24],
      [h * 0.88, 0.08],
      [h, 0.08],
    ].map(([yy, r]) => radialRing(y + yy, r, r, n, [p[0], p[2]])),
    C.trim,
  );
  if (d > 0)
    sphere(
      o,
      'trim',
      [p[0], y + h + 0.12, p[2]],
      [0.17, 0.16, 0.17],
      C.trim,
      d === 3 ? 10 : 6,
      d === 3 ? 5 : 3,
    );
}
function capital(o, f, x, y, r, d) {
  if (d < 2) return;
  for (const sign of [-1, 1])
    spiral(o, f, x + sign * r * 0.65, y - 0.18, r * 0.28, d, sign, r * 0.83);
  if (d === 3)
    for (let j = 0; j < 5; j++) {
      const xx = x + (j - 2) * r * 0.27;
      panel(
        o,
        f,
        'trim',
        [
          [xx - 0.08, y - 0.5],
          [xx + 0.08, y - 0.5],
          [xx + 0.1, y - 0.3],
          [xx, y - 0.12],
          [xx - 0.1, y - 0.3],
        ],
        [],
        r * 0.9,
      );
    }
}
function pairedColumns(o, f, xs, y, h, d, r = 0.21) {
  for (const x of xs) {
    column(o, f, x, y, h, r, d);
    capital(o, f, x, y + h - 0.25, r, d);
  }
}
function stoneNiche(o, f, x, y, w, h, d, variant) {
  if (d === 0) return;
  const n = d === 1 ? 4 : d === 2 ? 8 : 16,
    r = arch(x, y, w, y + h - w / 2, n),
    depth = d === 3 ? -0.42 : 0.035;
  panel(o, f, 'dark', r, [], depth);
  border(o, f, r, 0.1, d, 0.08);
  if (d === 3) {
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        o,
        'wall',
        [f.p(...r[i]), f.p(...r[j]), f.p(...r[j], depth), f.p(...r[i], depth)],
        normalFor(f.p(...r[i]), f.p(...r[j]), f.p(...r[j], depth)),
      );
    }
    const cy = y + h - w / 2;
    for (let j = 0; j <= 12; j++) {
      const a = (j * Math.PI) / 12;
      stroke(
        o,
        f,
        [
          [x, cy],
          [x + Math.cos(a) * w * 0.48, cy + Math.sin(a) * w * 0.48],
        ],
        0.025,
        -0.35,
      );
    }
  }
  saint(o, f, x, y + 0.09, h - 0.18, d, variant);
  localBox(o, f, 'trim', x, y - 0.08, 0.17, w + 0.18, 0.12, 0.4);
}
function framedOpening(o, f, r, d, depth = 1.93) {
  if (d > 0) border(o, f, r, d === 3 ? 0.14 : 0.12, d, 0.08);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      ps = [f.p(...r[i]), f.p(...r[i], -depth), f.p(...r[j], -depth), f.p(...r[j])];
    Q(o, 'repair', ps, normalFor(...ps));
  }
}
function rectangleCarving(o, f, x, y, w, h, d) {
  if (d < 2) return;
  const r = rect(x, y, w, h);
  border(o, f, r, 0.055, d, 0.13);
  stroke(
    o,
    f,
    [
      [x, y + 0.1],
      [x + w * 0.4, y + h * 0.5],
      [x, y + h - 0.1],
      [x - w * 0.4, y + h * 0.5],
      [x, y + 0.1],
    ],
    0.026,
    0.16,
  );
}
function ship(o, f, x, y, d) {
  if (d < 2) return;
  panel(
    o,
    f,
    'trim',
    [
      [x - 1, y + 0.6],
      [x + 0.9, y + 0.6],
      [x + 0.5, y + 0.05],
      [x - 0.65, y],
    ],
    [],
    0.36,
  );
  for (const s of [-1, 1]) {
    stroke(
      o,
      f,
      [
        [x + s * 0.48, y + 0.6],
        [x + s * 0.48, y + 2.1],
      ],
      0.045,
      0.34,
    );
    panel(
      o,
      f,
      'trim',
      [
        [x + s * 0.48, y + 2.0],
        [x + s * 0.48, y + 1.1],
        [x + s * 0.48 + 0.5, y + 1.1],
        [x + s * 0.48 + 0.42, y + 1.95],
      ],
      [],
      0.35,
    );
  }
  for (let j = 0; j < (d === 3 ? 5 : 2); j++)
    stroke(
      o,
      f,
      [
        [x - 1.1, y - 0.18 - j * 0.13],
        [x - 0.55, y - 0.1 - j * 0.13],
        [x, y - 0.2 - j * 0.13],
        [x + 0.55, y - 0.1 - j * 0.13],
        [x + 1, y - 0.18 - j * 0.13],
      ],
      0.027,
      0.27,
    );
}
function dragon(o, f, x, y, d) {
  if (d < 2) return;
  const body = oval(x, y + 0.9, 0.75, 0.58, d === 3 ? 20 : 8);
  panel(o, f, 'trim', body, [], 0.35);
  stroke(
    o,
    f,
    [
      [x + 0.6, y + 0.75],
      [x + 1.0, y + 1.15],
      [x + 0.65, y + 1.65],
      [x + 0.2, y + 1.83],
      [x + 0.16, y + 2.1],
    ],
    0.12,
    0.48,
  );
  const p = f.p(x + 0.13, y + 2.0, 0.51);
  sphere(o, 'trim', p, [0.25, 0.18, 0.12], C.trim, d === 3 ? 10 : 6, 4);
  panel(
    o,
    f,
    'trim',
    [
      [x - 0.1, y + 1.0],
      [x + 0.6, y + 1.55],
      [x + 0.7, y + 0.7],
    ],
    [],
    0.49,
  );
  stroke(
    o,
    f,
    [
      [x - 0.6, y + 0.8],
      [x - 0.95, y + 0.4],
      [x - 0.45, y + 0.1],
      [x + 0.05, y + 0.25],
    ],
    0.085,
    0.43,
  );
  for (const sign of [-1, 1])
    stroke(
      o,
      f,
      [
        [x + sign * 0.35, y + 0.52],
        [x + sign * 0.55, y + 0.12],
        [x + sign * 0.85, y + 0.12],
      ],
      0.07,
      0.42,
    );
  if (d === 3)
    for (let row = 0; row < 4; row++)
      for (let j = 0; j < 5; j++) {
        const xx = x + (j - 2) * 0.22 + (row % 2) * 0.06,
          yy = y + 0.65 + row * 0.16;
        if (Math.pow((xx - x) / 0.73, 2) + Math.pow((yy - y - 0.9) / 0.56, 2) > 1) continue;
        stroke(
          o,
          f,
          [
            [xx - 0.07, yy + 0.05],
            [xx, yy],
            [xx + 0.07, yy + 0.05],
          ],
          0.015,
          0.48,
        );
      }
}
function wing(o, f, x, y, side, d, depth = 0.35) {
  if (d < 2) return;
  for (let j = 0; j < (d === 3 ? 8 : 4); j++) {
    const t = j / (d === 3 ? 7 : 3),
      xx = x + side * (0.25 + t * 0.95),
      yy = y + 0.55 - t * 0.5;
    panel(
      o,
      f,
      'trim',
      [
        [x, y],
        [xx, yy + 0.3],
        [xx + side * 0.14, yy],
        [x + side * 0.12, y - 0.12],
      ],
      [],
      depth,
    );
  }
}
function angelRelief(o, f, x, y, d, variant) {
  if (d < 2) return;
  const n = d === 3 ? 10 : 5,
    head = f.p(x, y + 0.77, 0.38);
  sphere(o, 'trim', head, [0.14, 0.17, 0.1], C.trim, n, d === 3 ? 5 : 3);
  panel(
    o,
    f,
    'trim',
    [
      [x - 0.16, y + 0.56],
      [x + 0.16, y + 0.56],
      [x + 0.42, y],
      [x - 0.42, y],
    ],
    [],
    0.38,
  );
  wing(o, f, x, y + 0.5, -1, d);
  wing(o, f, x, y + 0.5, 1, d);
  if (variant % 2 === 0)
    stroke(
      o,
      f,
      [
        [x - 0.08, y + 0.48],
        [x + 0.3, y + 0.35],
        [x + 0.48, y + 0.8],
      ],
      0.055,
      0.48,
    );
}
function inscription(o, f, text, x, y, w, h, d) {
  if (d !== 3) return;
  const glyph = {
    M: [
      [
        [0, 0],
        [0, 1],
        [0.5, 0.4],
        [1, 1],
        [1, 0],
      ],
    ],
    A: [
      [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
      [
        [0.22, 0.42],
        [0.78, 0.42],
      ],
    ],
    T: [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
    ],
    E: [
      [
        [1, 1],
        [0, 1],
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0.5],
        [0.8, 0.5],
      ],
    ],
    R: [
      [
        [0, 0],
        [0, 1],
        [0.7, 1],
        [1, 0.8],
        [0.7, 0.5],
        [0, 0.5],
      ],
      [
        [0.5, 0.5],
        [1, 0],
      ],
    ],
    D: [
      [
        [0, 0],
        [0, 1],
        [0.6, 1],
        [1, 0.75],
        [1, 0.25],
        [0.6, 0],
        [0, 0],
      ],
    ],
    I: [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ],
  };
  const pitch = w / text.length;
  for (let i = 0; i < text.length; i++)
    for (const ps of glyph[text[i]] ?? [])
      stroke(
        o,
        f,
        ps.map((p) => [x - w / 2 + i * pitch + p[0] * pitch * 0.72, y + p[1] * h]),
        0.021,
        0.22,
        'wall',
        rgb('77776c'),
      );
}
function frontRelief(o, f, d) {
  if (d === 0) return;
  for (const s of [-1, 1]) {
    // Open scroll shoulders connect each real stepped facade tier.
    const points = [
      [s * 10.3, 13.0],
      [s * 9.0, 13.0],
      [s * 7.75, 13.8],
      [s * 6.4, 15.15],
      [s * 6.15, 16.4],
    ];
    stroke(o, f, points, d === 3 ? 0.13 : 0.16, 0.28);
    spiral(o, f, s * 8.6, 13.6, 0.54, d, s, 0.26);
    stroke(
      o,
      f,
      [
        [s * 6.1, 17.55],
        [s * 5.5, 17.7],
        [s * 4.9, 18.6],
        [s * 4.8, 20.1],
      ],
      0.13,
      0.25,
    );
    spiral(o, f, s * 5.45, 18.3, 0.43, d, s, 0.27);
  }
  if (d < 2) return;
  ship(o, f, -4.5, 14.15, d);
  dragon(o, f, 4.55, 14.2, d);
  for (const s of [-1, 1]) {
    angelRelief(o, f, s * 1.8, 14.0, d, s + 2);
    angelRelief(o, f, s * 1.85, 16.55, d, s + 3);
    angelRelief(o, f, s * 3.5, 19.5, d, s + 4);
    for (const y of [6.4, 13.35, 17.8])
      for (
        let x = s > 0 ? 1 : y > 17 ? -5.8 : -9.8;
        x < (s > 0 ? (y > 17 ? 5.8 : 10) : -0.9);
        x += 1.05
      )
        sun(o, f, x, y, 0.12, d, 0.24);
    rectangleCarving(o, f, s * 9.85, 0.8, 0.42, 4.7, d);
    rectangleCarving(o, f, s * 4.4, 0.8, 0.55, 4.7, d);
    sun(o, f, s * 8.0, 13.2, 0.24, d, 0.26);
  }
  // Skeleton/hourglass symbols, with bounded relief scale rather than copied imagery.
  const skull = front.p(8.2, 13.25, 0.38);
  sphere(o, 'trim', skull, [0.2, 0.22, 0.12], C.trim, d === 3 ? 10 : 6, 4);
  stroke(
    o,
    f,
    [
      [8.08, 13.03],
      [7.75, 12.75],
      [7.52, 12.85],
    ],
    0.06,
    0.41,
  );
  for (const x of [-8.5, 8.5]) {
    stroke(
      o,
      f,
      [
        [x - 0.28, 12.8],
        [x + 0.28, 12.8],
        [x - 0.22, 13.25],
        [x + 0.22, 13.25],
        [x - 0.28, 12.8],
      ],
      0.045,
      0.3,
    );
  }
  inscription(o, f, 'MATER DEI', 0, 5.9, 4.3, 0.36, d);
  for (const s of [-1, 1]) {
    reliefRing(o, f, s * 7.0, 5.9, 0.72, 0.42, d, 0.19);
    sun(o, f, s * 7.0, 6.08, 0.32, d, 0.22);
  }
  // Pediment: patinated dove/blue field, sun faces and star rays from the actual photograph.
  panel(o, f, 'dark', rect(0, 22.25, 1.9, 1.5), [], 0.18, rgb('547376'));
  const p = f.p(0, 22.9, 0.4);
  sphere(o, 'bronze', p, [0.16, 0.31, 0.14], C.bronze, d === 3 ? 12 : 6, 4);
  for (const s of [-1, 1]) {
    panel(
      o,
      f,
      'bronze',
      [
        [0, 22.9],
        [s * 0.95, 23.25],
        [s * 0.75, 22.8],
        [s * 0.15, 22.6],
      ],
      [],
      0.42,
    );
    sun(o, f, s * 2.05, 22.65, 0.37, d, 0.24);
  }
  for (const [x, y] of [
    [-0.5, 23.65],
    [0.5, 23.65],
    [-0.55, 22.4],
    [0.55, 22.4],
  ])
    sun(o, f, x, y, 0.13, d, 0.26);
}
function build(o, _frame, d = 3) {
  const f = { ...front, detail: d },
    n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16,
    doors = [-7, 0, 7].map((x) => ({ x, w: x === 0 ? 3.2 : 2.65, h: x === 0 ? 4.3 : 3.9 })),
    lights = [-7, 0, 7].map((x) => ({
      x,
      w: x === 0 ? 3.0 : 2.6,
      y: 7.75,
      s: x === 0 ? 11.3 : 10.75,
    })),
    niches = [-9.4, -3.25, 3.25, 9.4].map((x, i) => ({ x, y: 8.1, w: 1.3, h: 3.7, v: i })),
    holes = [
      ...doors.map((q) => rect(q.x, 0.65, q.w, q.h)),
      ...lights.map((q) => arch(q.x, q.y, q.w, q.s, n)),
    ],
    sculptures = [
      ...niches,
      { x: 0, y: 14.1, w: 1.7, h: 3.1, v: 4 },
      { x: 0, y: 19.1, w: 1.35, h: 2.25, v: 5 },
    ];
  panel(
    o,
    f,
    'wall',
    contour,
    d === 3
      ? [...holes, ...sculptures.map((q) => arch(q.x, q.y, q.w, q.y + q.h - q.w / 2, n))]
      : holes,
  );
  const back = { ...f, n: f.n.map((v) => -v) };
  panel(o, back, 'wall', contour, holes, -plan.facadeThicknessMeters);
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length,
      ps = [
        f.p(...contour[i]),
        f.p(...contour[j]),
        f.p(...contour[j], -plan.facadeThicknessMeters),
        f.p(...contour[i], -plan.facadeThicknessMeters),
      ];
    Q(o, 'wall', ps, normalFor(...ps));
  }
  for (const q of doors)
    framedOpening(o, f, rect(q.x, 0.65, q.w, q.h), d, plan.facadeThicknessMeters);
  for (const q of lights)
    framedOpening(o, f, arch(q.x, q.y, q.w, q.s, n), d, plan.facadeThicknessMeters);
  for (const q of sculptures) stoneNiche(o, f, q.x, q.y, q.w, q.h, d, q.v);
  pairedColumns(o, f, [-10.15, -8.8, -4.0, -2.5, 2.5, 4.0, 8.8, 10.15], 0.75, 5.6, d, 0.22);
  pairedColumns(o, f, [-10.15, -8.7, -4.15, -2.35, 2.35, 4.15, 8.7, 10.15], 7.55, 5.2, d, 0.21);
  pairedColumns(o, f, [-5.7, -3.0, 3.0, 5.7], 13.75, 4.1, d, 0.2);
  pairedColumns(o, f, [-4.4, -1.75, 1.75, 4.4], 18.65, 3.0, d, 0.16);
  for (const [y, w] of [
    [0.6, 21.6],
    [6.85, 21.7],
    [7.3, 21.6],
    [13.15, 21.8],
    [13.6, 21.5],
    [18.15, 12.7],
    [18.55, 12.5],
    [21.9, 10.3],
  ])
    cornice(o, f, 0, y, w, d, 0.3);
  for (const s of [-1, 1])
    stroke(
      o,
      f,
      [
        [0, 24.7],
        [s * 4.9, 21.8],
      ],
      d === 0 ? 0.14 : 0.21,
      0.2,
    );
  if (d > 0)
    for (const s of [-1, 1])
      stroke(
        o,
        f,
        [
          [s * 0.15, 24.45],
          [s * 4.5, 21.98],
        ],
        0.07,
        0.31,
      );
  for (const [x, y, h] of [
    [-10.2, 13.55, 1.6],
    [-8.3, 13.5, 1.0],
    [-6.0, 17.9, 1.7],
    [-4.1, 22.2, 1.8],
    [-2.8, 23.0, 1.5],
    [2.8, 23, 1.5],
    [4.1, 22.2, 1.8],
    [6, 17.9, 1.7],
    [8.3, 13.5, 1],
    [10.2, 13.55, 1.6],
  ])
    if (d > 0 || Math.abs(x) === 10.2) pin(o, f, x, y, h, d);
  // Cross is retained in every distance silhouette.
  stroke(
    o,
    f,
    [
      [0, 24.65],
      [0, 26.2],
    ],
    d === 0 ? 0.1 : 0.08,
    0.1,
    'dark',
  );
  stroke(
    o,
    f,
    [
      [-0.52, 25.65],
      [0.52, 25.65],
    ],
    d === 0 ? 0.1 : 0.08,
    0.1,
    'dark',
  );
  frontRelief(o, f, d);
  if (d > 0) {
    for (const q of doors)
      for (let j = 0; j < 3; j++)
        localBox(o, f, 'trim', q.x, 0, 1.0 - j * 0.32, q.w + 0.35, 0.2 * (j + 1), 0.37);
  }
  // Bounded low remnants at the two back corners; no invented standing nave.
  for (const s of [-1, 1]) {
    const x = s * 10.1;
    B(o, 'wall', [x - 0.45, -0.25, -2.6], [x + 0.45, 3.0, -0.96]);
    if (d === 3)
      for (let k = 0; k < 5; k++) rectangleCarving(o, f, s * 10.43, 0.9 + k * 2.3, 0.28, 1.9, d);
  }
  if (d === 3) {
    // Sparse stone joints and shallow wear stay geometric and deterministic.
    for (let y = 0.9; y < 24.0; y += 0.7) {
      const half =
        y > 22 ? Math.max(0.1, (24.7 - y) * 1.64) : y > 18.6 ? 4.7 : y > 13.8 ? 6.0 : 10.45;
      for (let x = -half; x < half; x += 1.1) {
        if (
          holes.some((r) => {
            const xs = r.map((p) => p[0]),
              ys = r.map((p) => p[1]);
            return (
              x > Math.min(...xs) - 0.1 &&
              x < Math.max(...xs) + 0.1 &&
              y > Math.min(...ys) &&
              y < Math.max(...ys)
            );
          })
        )
          continue;
        stroke(
          o,
          f,
          [
            [x, y],
            [Math.min(x + 1, half), y],
          ],
          0.009,
          0.006,
          'wall',
          rgb('76776e'),
        );
      }
    }
  }
}
export const saintPaulsSkyline = (o, f) => build(o, f, 0);
export const saintPaulsDistrict = (o, f) => build(o, f, 1);
export const saintPaulsStreet = (o, f) => build(o, f, 2);
export const saintPaulsModel = {
  id: 'ruins_of_saint_paul_s',
  key: 'ruins_of_saint_paul_s',
  recipe: 'structure-ruins-of-saint-pauls.mjs',
  cell: 'we/web',
  title: "Ruins of Saint Paul's",
  category: 'archaeological',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  recipeDependencies: ['trevi-sculpture-anatomy.mjs'],
  brief:
    'Complete surviving five-tier granite facade with3real open portals/upper lights, bronze saints in deep shell niches, layered paired columns/capitals/entablatures, carved ship/dragon/skeleton/hourglass/angel/scroll relief, triangular dove/sun/star pediment, pin finials/cross and bounded threshold stairs/low rear remnants. No burned church or long public stairway reconstruction. Complete compiled-native thin facade extent; elevation detail and concealed rear supports are photographic estimates.',
  camera: [30, 20, 50],
  lookAt: [0, 11, 0],
  portableGroundY: 0,
  mediumFiContext: { scale: 1.4, cameraYaw: 0 },
  qaCameras: [
    {
      name: 'open-portals-shell-niches-bronze-saints-and-paired-columns',
      position: [14, 12, 33],
      lookAt: [0, 9, 0],
    },
    {
      name: 'asian-christian-relief-scrolls-and-dove-pediment',
      position: [8, 20, 23],
      lookAt: [0, 18, 0],
    },
    {
      name: 'complete-freestanding-rear-and-open-wall-depth',
      position: [-24, 20, -36],
      lookAt: [0, 11, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed short front approach chosen before terrain; bounded threshold stairs only.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ruins-of-saint-pauls.mjs',
    level: 'skyline',
    export: 'saintPaulsSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'saintPaulsDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'saintPaulsStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'The surviving church facade is the structure in scope: complete five-tier front/back and three portal/upper-light openings. Burned1835church/roof, separate college/museum/crypt/temple/city wall and public plaza are excluded. The68-step public approach lacks a complete accepted image/native footprint here and is not invented; only short intrinsic threshold stairs are modeled.',
    'One exact published QuallaGG001213CC0front original2017and one explicitly self-dedicatedMx.GrangerCC0column/joint/detail original2018were inspected. The Colegiofile is a crop of the same Qualla photo and not an independent reference. No attribution/share-alike/unknown-author image or photographic texture used.',
    'Compiled native facade width21.29m/thickness1.93m/height26.2m controls scale. Exact elevation tier heights, sculptural projections, repair plaster, small thresholds and rear support/remnant sections are medium-fi photographic estimates, not a survey. Signed native outline faces south/slightly east; contradictory east-facing story prose is not used as a bearing control.',
    'Six patinated saints use statically baked public Molen figure anatomy under original long robes/attributes. Carved ship/dragon/skeleton/hourglass, angel figures, sun/star/dove, scrolls and capitals are bounded original relief; fine faces, exact iconographic identities, inscription fonts, Chinese characters and erosion are approximated or omitted. MATERDEIis the visible bounded Latin entrance inscription; other detailed writing is not invented.',
    'Fixed front point[0,4.5]is defined before terrain acquisition. Intrinsic footings extend.25m below datum; model/host-terrain contact and precise thresholds remain unverified. No whole-site slab or ground flattening.',
  ],
};

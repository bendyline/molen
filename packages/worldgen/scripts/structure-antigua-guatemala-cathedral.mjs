/** Standing Baroque parish and complete native roofless cathedral, with no restored lost dome. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';
import { treviHumanAnatomy } from './trevi-sculpture-anatomy.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/9f/9fx/antigua_guatemala_cathedral/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('d5cfb8'),
    trim: rgb('e3ddc9'),
    brick: rgb('b58b6b'),
    roof: rgb('83877c'),
    wood: rgb('8d603c'),
    dark: rgb('414b45'),
  },
  niche = rgb('ae9e74'),
  blue = rgb('577786');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.96, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.94, metallic: 0 },
};
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
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
function cap(o, r, y, s = 'roof', col = C[s], up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
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
const ruinOutline = plan.components[1].outer[0],
  voids = plan.components[0].inner;
const clockwise = (r) => (area(r) > 0 ? [...r].reverse() : r);
function simplify(r, tolerance) {
  let p = [...r],
    changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz),
        dist = len ? Math.abs(dx * (a[1] - b[1]) - (a[0] - b[0]) * dz) / len : 0;
      if (dist < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function recess(o, f, r, d, back = -0.42, col = C.dark) {
  if (d < 3) back = 0.012;
  panel(o, f, 'dark', r, [], back, col);
  if (d === 0) return;
  for (let i = 0; d === 3 && i < r.length; i++) {
    const b = r[(i + 1) % r.length],
      ps = [f.p(...r[i]), f.p(...b), f.p(...b, back), f.p(...r[i], back)];
    quad(o, 'trim', ps, normalFor(...ps), C.trim);
  }
  border(o, f, r, 0.12, d, 0.035);
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
function urn(o, f, x, y, d) {
  const n = d < 2 ? 4 : d === 2 ? 6 : 12,
    p = f.p(x, y, 0.02),
    profile =
      d < 2
        ? [
            [0, 0.18],
            [0.8, 0.35],
            [1.35, 0.04],
          ]
        : d === 2
          ? [
              [0, 0.23],
              [0.24, 0.15],
              [0.67, 0.4],
              [1.04, 0.16],
              [1.38, 0.025],
            ]
          : [
              [0, 0.23],
              [0.14, 0.23],
              [0.24, 0.15],
              [0.42, 0.35],
              [0.67, 0.4],
              [0.93, 0.27],
              [1.04, 0.16],
              [1.18, 0.21],
              [1.38, 0.025],
            ];
  loft(
    o,
    'trim',
    profile.map(([yy, r]) => radialRing(y + yy, r, r, n, [p[0], p[2]])),
    C.trim,
  );
}
function rosette(o, f, x, y, r, d) {
  if (d < 2) return;
  const n = d === 3 ? 10 : 6,
    petals = d === 3 ? 7 : 5;
  panel(o, f, 'trim', oval(x, y, r * 0.2, r * 0.2, n), [], 0.115);
  for (let j = 0; j < petals; j++) {
    const a = (j * 2 * Math.PI) / petals,
      ps = Array.from({ length: d === 3 ? 8 : 4 }, (_, k) => {
        const b = (k * 2 * Math.PI) / (d === 3 ? 8 : 4),
          u = r * (0.57 + 0.38 * Math.cos(b)),
          v = r * 0.18 * Math.sin(b);
        return [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];
      });
    panel(o, f, 'trim', ps, [], 0.09);
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
    panel(o, f, 'trim', r, [], 0.05);
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
  loft(o, 'trim', rings, C.trim);
  if (d === 2) {
    sphere(o, 'trim', P([0, h * 0.86, 0.01]), [h * 0.082, h * 0.105, h * 0.065], C.trim, 6, 3);
    for (const s of [-1, 1])
      beam(
        o,
        'trim',
        P([s * h * 0.12, h * 0.68, 0]),
        P([s * h * 0.03, h * 0.53, h * 0.17]),
        h * 0.05,
        h * 0.05,
        C.trim,
      );
    return;
  }
  const k = h / 4.3;
  treviHumanAnatomy(
    o,
    3,
    variant % 3 === 0 ? 'health' : 'abundance',
    C.trim,
    (out, _slot, ps, col) => {
      if (ps.every((p) => p[1] < 2.6)) return;
      const pp = ps.map((p) => P([p[0] * k, p[1] * k, p[2] * k]));
      out.addTriangle(
        'trim',
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
    'trim',
    [
      [0.68, 0.11],
      [0.76, 0.15],
      [0.84, 0.09],
    ].map(([yy, r]) =>
      radialRing(y + h * yy, r * h, r * h * 0.58, 12, [f.p(x, 0, -0.22)[0], f.p(x, 0, -0.22)[2]]),
    ),
    C.trim,
  );
  if (variant % 4 === 0) {
    beam(o, 'trim', P([h * 0.22, 0.04, 0.12]), P([h * 0.22, h * 0.94, 0.12]), 0.035, 0.035, C.trim);
    beam(
      o,
      'trim',
      P([h * 0.12, h * 0.81, 0.12]),
      P([h * 0.32, h * 0.81, 0.12]),
      0.025,
      0.025,
      C.trim,
    );
  } else if (variant % 4 === 1)
    localBox(o, f, 'trim', x + h * 0.08, y + h * 0.5, -0.03, h * 0.2, h * 0.18, 0.09);
}
function nicheUnit(o, f, x, y, w, h, d, variant) {
  if (d === 0) return;
  const r = arch(x, y, w, y + h - w / 2, d === 1 ? 3 : d === 2 ? 6 : 12);
  recess(o, f, r, d, -0.58, niche);
  saint(o, f, x, y + 0.08, h - 0.24, d, variant);
  if (d > 1) {
    localBox(o, f, 'trim', x, y - 0.1, 0.12, w + 0.2, 0.13, 0.36);
    rosette(o, f, x, y + h + 0.15, 0.19, d);
  }
}
function fanDoor(o, f, x, y, w, spring, d, depth = -0.35) {
  const n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16,
    r = arch(x, y, w, spring, n);
  panel(o, f, 'wood', r, [], d === 3 ? depth : 0.025);
  const fan = arch(x, spring, w, spring, n);
  panel(o, f, 'dark', fan, [], d === 3 ? depth + 0.015 : 0.035, blue);
  if (d === 0) return;
  const z = d === 3 ? depth + 0.045 : 0.055;
  for (let j = 0; j <= n; j++) {
    const a = (j * Math.PI) / n;
    beam(
      o,
      'wood',
      f.p(x, spring, z),
      f.p(x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2, z),
      d === 3 ? 0.07 : 0.045,
      0.06,
      C.wood,
    );
  }
  for (const xx of [x - w / 2 + 0.08, x, x + w / 2 - 0.08])
    localBox(o, f, 'wood', xx, y, z, 0.075, spring - y, 0.12);
  if (d > 1) {
    for (let j = 0; j < 4; j++) {
      const yy = y + 0.22 + ((spring - y - 0.35) * j) / 4;
      localBox(o, f, 'wood', x, yy, z, w - 0.2, 0.075, 0.1);
    }
    if (d === 3)
      for (const s of [-1, 1])
        sphere(
          o,
          'dark',
          f.p(x + s * w * 0.11, y + (spring - y) * 0.5, z + 0.07),
          [0.07, 0.07, 0.045],
          C.dark,
          8,
          4,
        );
  }
}
function scrollShoulder(o, f, left, center, d) {
  const ps = [
      [3, 10.2],
      [4.8, 10.2],
      [6.4, 11.6],
      [7.8, 14.3],
      [8.1, 15.5],
      [9, 16.3],
      [10.7, 16.25],
      [11.1, 15.5],
      [11.1, 10.2],
    ],
    r = ps.map(([x, y]) => [left ? x : 2 * center - x, y]);
  panel(o, f, 'wall', r, [], 0.025);
  panel(o, { ...f, n: f.n.map((v) => -v) }, 'wall', r, [], -0.45);
  if (d === 0) return;
  for (let i = 1; i < r.length - 1; i++)
    beam(o, 'trim', f.p(...r[i - 1], 0.07), f.p(...r[i], 0.07), 0.15, 0.18, C.trim);
  const x = left ? 9.3 : 2 * center - 9.3;
  rosette(o, f, x, 15.55, 0.49, d);
  for (let j = 0; d > 1 && j < 3; j++) {
    const xx = left ? 7 + j : 2 * center - (7 + j);
    rosette(o, f, xx, 11.3 + j * 0.6, 0.32, d);
  }
}
function westFacade(o, d) {
  const f = frame([-18.06167000007754, 47.306120975414515], [22.3, 46.761]),
    w = f.len,
    c = w / 2,
    n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 14,
    doors = [
      { x: c - 12.2, w: 6, s: 3.9 },
      { x: c, w: 8.2, s: 5.6 },
      { x: c + 12.2, w: 6, s: 3.9 },
    ],
    ns = [];
  for (const x of [3.8, 14.8, 25.6, 36.7])
    for (const y of [1.95, 5.6]) ns.push({ x, y, w: 1.25, h: 2.0, v: ns.length });
  const holes = doors.map((q) => arch(q.x, 0.95, q.w, q.s, n));
  for (const q of ns) holes.push(arch(q.x, q.y, q.w, q.y + q.h - q.w / 2, n));
  const windows = [c - 12.2, c + 12.2];
  for (const x of windows) holes.push(rect(x, 7.3, 2.45, 2.0));
  panel(o, f, 'wall', rect(c, 0.85, w, 9.35), d === 3 ? holes : []);
  for (const q of doors) {
    const r = arch(q.x, 0.95, q.w, q.s, n);
    recess(o, f, r, d, -0.65, C.wall);
    fanDoor(o, f, q.x, 0.98, q.x === c ? 5.3 : 4.2, q.x === c ? 4.9 : 3.75, d, -0.57);
    if (d > 1) {
      border(o, f, r, 0.25, d, 0.06);
      if (q.x === c) {
        rosette(o, f, c, 8.7, 0.48, d);
        for (const s of [-1, 1]) rosette(o, f, c + s * 1.7, 8.0, 0.32, d);
      }
    }
  }
  for (const q of ns) nicheUnit(o, f, q.x, q.y, q.w, q.h, d, q.v);
  for (const x of [2.7, 4.9, 13.7, 15.9, 24.5, 26.7, 35.6, 37.8])
    column(o, f, x, 1.2, 8.6, d === 0 ? 0.31 : 0.36, d);
  for (const x of windows) {
    recess(o, f, rect(x, 7.3, 2.45, 2), d, -0.38);
    if (d > 0) {
      for (const xx of [x - 0.7, x, x + 0.7])
        localBox(o, f, 'wood', xx, 7.34, d === 3 ? -0.28 : 0.04, 0.07, 1.9, 0.07);
      localBox(o, f, 'wood', x, 8.2, d === 3 ? -0.27 : 0.05, 2.3, 0.06, 0.07);
      const ped = [
        [x - 1.85, 9.45],
        [x + 1.85, 9.45],
        [x, 10.05],
      ];
      panel(o, f, 'trim', ped, [], 0.16);
    }
  }
  cornice(o, f, c, 10.15, w + 0.65, d, 0.26);
  const upper = [
      [10.95, 10.25],
      [29.4, 10.25],
      [29.4, 18.6],
      [10.95, 18.6],
    ],
    un = [];
  for (const x of [13.5, 16.8, 23.6, 27.0])
    for (const y of [11.15, 14.55]) un.push({ x, y, w: 1.27, h: 2.15, v: 8 + un.length });
  const upperHoles = un.map((q) => arch(q.x, q.y, q.w, q.y + q.h - q.w / 2, n));
  if (d === 3) {
    upperHoles.push(arch(c, 11.4, 2.5, 13.0, n));
    upperHoles.push(arch(c, 14.5, 2.5, 15.35, n));
  } else upperHoles.push(arch(c, 11.5, 2.5, 15.2, n));
  panel(o, f, 'wall', upper, d === 3 ? upperHoles : [], 0.025);
  panel(o, { ...f, n: f.n.map((v) => -v) }, 'wall', upper, [], -0.65);
  for (const q of un) nicheUnit(o, f, q.x, q.y, q.w, q.h, d, q.v);
  if (d === 3) {
    nicheUnit(o, f, c, 11.4, 2.5, 2.85, d, 19);
    nicheUnit(o, f, c, 14.5, 2.5, 2.1, d, 20);
  } else nicheUnit(o, f, c, 11.5, 2.5, 4.8, d, 19);
  for (const x of [11.55, 14.55, 25.8, 28.8]) column(o, f, x, 10.55, 8.0, 0.25, d);
  cornice(o, f, c, 18.55, 19.3, d, 0.25);
  scrollShoulder(o, f, true, c, d);
  scrollShoulder(o, f, false, c, d);
  const crown = [
    [c - 3.3, 18.7],
    [c + 3.3, 18.7],
    [c + 2.2, 19.55],
    [c + 2.1, 20.15],
    [c, 21.1],
    [c - 2.1, 20.15],
    [c - 2.2, 19.55],
  ];
  panel(o, f, 'wall', crown, [], 0.04);
  panel(o, { ...f, n: f.n.map((v) => -v) }, 'wall', crown, [], -0.55);
  for (let i = 0; d > 0 && i < crown.length; i++)
    beam(
      o,
      'trim',
      f.p(...crown[i], 0.12),
      f.p(...crown[(i + 1) % crown.length], 0.12),
      0.13,
      0.17,
      C.trim,
    );
  for (const [x, y] of [
    [0.8, 10.5],
    [6, 10.5],
    [10.5, 18.7],
    [14.0, 18.7],
    [26.4, 18.7],
    [29.4, 18.7],
    [34.7, 10.5],
    [39.5, 10.5],
  ])
    urn(o, f, x, y, d);
  if (d > 1) {
    for (let x = 1.5; x < w; x += 2.4) rosette(o, f, x, 9.95, 0.25, d);
    for (const x of [3.8, 14.8, 25.6, 36.7]) {
      const rr = [
        [x - 0.55, 4.5],
        [x + 0.55, 4.5],
        [x, 5.0],
      ];
      panel(o, f, 'trim', rr, [], 0.2);
    }
  }
  // Intrinsic three short entrance flights and narrow iron fence; no plaza slab.
  for (const q of doors)
    for (let j = 0; j < (d === 0 ? 1 : 5); j++) {
      const yy = d === 0 ? 0.9 : 0.18 * (j + 1),
        z = d === 0 ? 1.7 : 2.0 - j * 0.35;
      localBox(o, f, 'trim', q.x, 0, z, q.w + 0.5, yy, d === 0 ? 2.0 : 0.39);
    }
  if (d > 0)
    for (const [a, b] of [
      [0, 4.0],
      [12, 15],
      [25, 28],
      [36, w],
    ]) {
      cornice(o, f, (a + b) / 2, 1.2, b - a, 0, 0.9);
      for (let x = a; x < b; x += d === 3 ? 0.36 : 0.9) {
        const aa = f.p(x, 0.15, 1.0),
          bb = f.p(x, 1.35, 1.0);
        beam(o, 'dark', aa, bb, 0.027, 0.027, C.dark);
      }
    }
  return f;
}
function hip(o, r, y, rise, d) {
  cap(o, r, y, 'roof');
  if (d === 0) return;
  const xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    lo = [Math.min(...xs) + 0.4, Math.min(...zs) + 0.4],
    hi = [Math.max(...xs) - 0.4, Math.max(...zs) - 0.4],
    mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2],
    corners = [
      [lo[0], y, lo[1]],
      [hi[0], y, lo[1]],
      [hi[0], y, hi[1]],
      [lo[0], y, hi[1]],
    ],
    p = [mid[0], y + rise, mid[1]];
  for (let i = 0; i < 4; i++) tri(o, 'roof', [corners[i], corners[(i + 1) % 4], p], [0, 1, 0]);
}
function clipX(r, x, keepLeft) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ia = keepLeft ? a[0] <= x : a[0] >= x,
      ib = keepLeft ? b[0] <= x : b[0] >= x;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
function parish(o, d) {
  const r = clockwise(
    d === 0 ? simplify(plan.standingParishRemainder[0], 0.16) : plan.standingParishRemainder[0],
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = frame(a, b),
      isWest = a[1] > 46.4 && b[1] > 46.4,
      isBack =
        Math.min(a[1], b[1]) > 27.7 &&
        Math.max(a[1], b[1]) < 28.6 &&
        Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
    if (isWest || isBack) continue;
    const h = (a[0] + b[0]) / 2 > 22.4 ? 8.4 : 10.25;
    panel(o, f, 'wall', rect(f.len / 2, -0.25, f.len, h + 0.25));
    panel(
      o,
      { ...f, n: f.n.map((v) => -v) },
      'wall',
      rect(f.len / 2, 1.0, f.len, h - 1),
      [],
      -0.65,
    );
    if (d > 0) cornice(o, f, f.len / 2, h - 0.25, f.len, d, 0.12);
  }
  const f = frame([22.3, 46.761], [39.2903939999897, 46.530345845083126]),
    h = 8.4;
  panel(o, f, 'wall', rect(f.len / 2, 0.85, f.len, h - 0.85));
  if (d > 0) {
    for (let j = 0; j < 3; j++) {
      const x = ((j + 0.5) * f.len) / 3;
      recess(o, f, rect(x, 3.0, 1.6, 2.3), d === 3 ? 2 : d, -0.2);
      column(o, f, x - 1.2, 1.1, 6.5, 0.16, d);
    }
    cornice(o, f, f.len / 2, 8.2, f.len, d);
  }
  const main = clipX(r, 22.4, true),
    south = clipX(r, 22.4, false);
  hip(o, main, 10.3, 1.1, d);
  hip(o, south, 8.4, 0.85, d);
  cap(o, r, 0.85, 'wall', C.wall);
  cap(o, r, -0.25, 'wall', C.wall, false);
  // Standing-to-ruin portal observed in the Qualla original; it opens into the uncovered nave.
  const back = frame(
      [22.414281999924626, 27.922517369548558],
      [-18.484686000077346, 28.45047544371943],
    ),
    x = 20.35,
    door = arch(x, 0.95, 6.2, 6.5, d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16);
  panel(o, back, 'wall', rect(back.len / 2, 0.85, back.len, 9.65), [door]);
  if (d > 0) {
    border(o, back, door, 0.35, d, 0.08);
    for (const xx of [x - 3.65, x + 3.65]) column(o, back, xx, 1.0, 9.4, 0.32, d);
    const p = [
      [x - 4.5, 10.5],
      [x + 4.5, 10.5],
      [x + 2, 12.0],
      [x + 1.5, 13.7],
      [x - 1.5, 13.7],
      [x - 2, 12.0],
    ];
    panel(o, back, 'wall', p, [], 0.02);
    nicheUnit(o, back, x, 11.0, 1.2, 2.1, d, 20);
    cornice(o, back, x, 10.5, 9.2, d);
    for (const s of [-1, 1]) rosette(o, back, x + s * 2.7, 11.0, 0.5, d);
  }
}
const roomBounds = voids.map((r, i) => {
  const xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    lo = [Math.min(...xs), Math.min(...zs)],
    hi = [Math.max(...xs), Math.max(...zs)];
  return {
    i,
    ring: r,
    lo,
    hi,
    c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2],
    width: hi[0] - lo[0],
    length: hi[1] - lo[1],
  };
});
function ruinStructure() {
  const piers = [],
    arches = new Map();
  const pier = (x, z, spring) => {
    let p = piers.find((p) => Math.hypot(p.x - x, p.z - z) < 1.45);
    if (!p) {
      p = { i: piers.length, x, z, h: spring, count: 1 };
      piers.push(p);
    } else {
      p.x = (p.x * p.count + x) / (p.count + 1);
      p.z = (p.z * p.count + z) / (p.count + 1);
      p.count++;
      p.h = Math.max(p.h, spring);
    }
    return p;
  };
  const edge = (a, b, spring, main) => {
    const key = [a.i, b.i].sort((a, b) => a - b).join(':');
    const old = arches.get(key);
    if (!old || spring > old.spring) arches.set(key, { a, b, spring, main });
  };
  for (const r of roomBounds) {
    const main = [0, 2, 3, 12, 14, 18].includes(r.i),
      spring = main ? 8.2 : 6.3,
      pad = 0.48,
      nx = r.width > 12 ? 2 : 1,
      nz = r.length > 12 ? 2 : 1,
      grid = [];
    for (let iz = 0; iz <= nz; iz++) {
      const row = [];
      for (let ix = 0; ix <= nx; ix++)
        row.push(
          pier(
            r.lo[0] - pad + (ix * (r.width + 2 * pad)) / nx,
            r.lo[1] - pad + (iz * (r.length + 2 * pad)) / nz,
            spring,
          ),
        );
      grid.push(row);
    }
    for (let iz = 0; iz <= nz; iz++)
      for (let ix = 0; ix < nx; ix++) edge(grid[iz][ix], grid[iz][ix + 1], spring, main);
    for (let ix = 0; ix <= nx; ix++)
      for (let iz = 0; iz < nz; iz++) edge(grid[iz][ix], grid[iz + 1][ix], spring, main);
  }
  return { piers, arches: [...arches.values()] };
}
const ruin = ruinStructure();
function archBridge(o, a, b, spring, d) {
  const f = frame([a.x, a.z], [b.x, b.z]),
    n = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 7 : 14,
    half = f.len / 2,
    rise = Math.min(4.4, half * 0.85),
    thick = d < 2 ? 0.45 : 0.52,
    depth = d < 2 ? 0.48 : 0.72;
  for (let i = 0; i < n; i++) {
    const t0 = (i * Math.PI) / n,
      t1 = ((i + 1) * Math.PI) / n,
      p = (t, r, z) => f.p(half + r * Math.cos(t), spring + rise * (r / half) * Math.sin(t), z),
      a0 = p(t0, half, -depth / 2),
      a1 = p(t1, half, -depth / 2),
      b0 = p(t0, half + thick, -depth / 2),
      b1 = p(t1, half + thick, -depth / 2),
      a2 = p(t0, half, depth / 2),
      a3 = p(t1, half, depth / 2),
      b2 = p(t0, half + thick, depth / 2),
      b3 = p(t1, half + thick, depth / 2);
    for (const ps of [
      [a0, a1, b1, b0],
      [a3, a2, b2, b3],
      [a2, a3, a1, a0],
      [b0, b1, b3, b2],
    ]) {
      const normal = normalFor(...ps);
      Q(o, 'brick', ps, normal);
    }
    if (d === 3 && i % 2 === 0) {
      beam(
        o,
        'trim',
        f.p(
          half + Math.cos((t0 + t1) / 2) * (half + 0.05),
          spring + rise * Math.sin((t0 + t1) / 2),
          depth / 2 + 0.02,
        ),
        f.p(
          half + Math.cos((t0 + t1) / 2) * (half + thick - 0.03),
          spring + rise * (1 + (thick - 0.03) / half) * Math.sin((t0 + t1) / 2),
          depth / 2 + 0.02,
        ),
        0.028,
        0.02,
        C.trim,
      );
    }
  }
}
function pierGeometry(o, p, d) {
  const w = p.h > 7 ? 1.45 : 1.18;
  if (d === 0) {
    B(o, 'brick', [p.x - w / 2, -0.2, p.z - w / 2], [p.x + w / 2, p.h, p.z + w / 2]);
    return;
  }
  const levels =
      d === 1
        ? [
            [0, w],
            [p.h, w],
          ]
        : d === 2
          ? [
              [0, w * 1.2],
              [p.h - 0.35, w],
              [p.h, w * 1.4],
            ]
          : [
              [0, w * 1.2],
              [0.25, w * 1.2],
              [0.5, w],
              [p.h - 0.6, w],
              [p.h - 0.42, w * 1.4],
              [p.h - 0.23, w * 1.15],
              [p.h, w * 1.5],
            ],
    n = d === 1 ? 4 : d === 2 ? 4 : 8;
  loft(
    o,
    'brick',
    levels.map(([y, r]) => radialRing(y, r * 0.62, r * 0.62, n, [p.x, p.z], Math.PI / 4)),
    C.brick,
  );
  if (d === 2) {
    for (const s of [-1, 1]) {
      const z = p.z + s * w * 0.46;
      Q(
        o,
        'wall',
        [
          [p.x - w * 0.5, 0.5, z],
          [p.x + w * 0.5, 0.5, z],
          [p.x + w * 0.5, p.h - 0.6, z],
          [p.x - w * 0.5, p.h - 0.6, z],
        ],
        [0, 0, s],
      );
    }
    B(
      o,
      'trim',
      [p.x - w * 0.78, p.h - 0.2, p.z - w * 0.78],
      [p.x + w * 0.78, p.h - 0.07, p.z + w * 0.78],
    );
    return;
  }
  if (d > 1) {
    for (const s of [-1, 1]) {
      B(
        o,
        'wall',
        [p.x - w * 0.52, 0.5, p.z + s * w * 0.37 - 0.12],
        [p.x + w * 0.52, p.h - 0.75, p.z + s * w * 0.37 + 0.12],
        C.wall,
      );
    }
    for (const yy of [p.h - 0.8, p.h - 0.52, p.h - 0.18])
      B(
        o,
        'trim',
        [p.x - w * 0.78, yy, p.z - w * 0.78],
        [p.x + w * 0.78, yy + 0.13, p.z + w * 0.78],
      );
  }
}
function vaultFragments(o, r, d) {
  if (d === 0 || (d === 1 && ![2, 14].includes(r.i))) return;
  const main = [0, 2, 3, 12, 14, 18].includes(r.i),
    spring = main ? 8.2 : 6.3,
    rectangular = r.ring.length <= 5;
  // Long rectangular openings have no photographic vault-edge control. Keep their
  // supporting arches, rather than projecting thin strips from those roof bounds.
  if (rectangular) return;
  let ring = d === 1 ? simplify(r.ring, 0.35) : r.ring;
  if (rectangular) {
    const expanded = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (d === 3 ? 1.2 : 2.4)));
      for (let j = 0; j < n; j++)
        expanded.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
    }
    ring = expanded;
  }
  const rx = r.width / 2,
    rz = r.length / 2,
    pad = 0.48,
    c = r.c;
  const outer = (p) => {
    const dx = p[0] - c[0],
      dz = p[1] - c[1],
      factor = Math.min(
        (rx + pad) / Math.max(Math.abs(dx), 1e-8),
        (rz + pad) / Math.max(Math.abs(dz), 1e-8),
      ),
      x = c[0] + dx * factor,
      z = c[1] + dz * factor,
      onX = Math.abs(dx) / (rx + pad) > Math.abs(dz) / (rz + pad),
      length = onX ? r.length + 2 * pad : r.width + 2 * pad,
      along = onX ? z - (r.lo[1] - pad) : x - (r.lo[0] - pad),
      bays = length - 2 * pad > 12 ? 2 : 1,
      t = ((((along / length) * bays) % 1) + 1) % 1,
      half = length / (2 * bays),
      height = spring + Math.min(4.4, half * 0.85) * Math.sin(Math.PI * t);
    return [x, height, z];
  };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      aa = outer(a),
      bb = outer(b),
      ya = rectangular ? aa[1] + 0.55 : (main ? 13.2 : 10.1) + 0.16 * Math.sin(i * 0.83 + r.i),
      yb = rectangular
        ? bb[1] + 0.55
        : (main ? 13.2 : 10.1) + 0.16 * Math.sin((i + 1) * 0.83 + r.i),
      ps = [[a[0], ya, a[1]], [b[0], yb, b[1]], bb, aa];
    Q(o, 'brick', ps, [0, 1, 0]);
    Q(o, 'brick', ps.map((p) => [p[0], p[1] - 0.18, p[2]]).reverse(), [0, -1, 0]);
    if (d > 1)
      Q(
        o,
        'brick',
        [
          [a[0], ya, a[1]],
          [a[0], ya - 0.18, a[1]],
          [b[0], yb - 0.18, b[1]],
          [b[0], yb, b[1]],
        ],
        [c[0] - (a[0] + b[0]) / 2, 0, c[1] - (a[1] + b[1]) / 2],
      );
  }
}

function outerRuins(o, d) {
  const r = clockwise(d === 0 ? simplify(ruinOutline, 0.2) : ruinOutline);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (a[1] > 27.6 && b[1] > 27.6 && a[0] < 23 && b[0] < 23) continue;
    const f = frame(a, b),
      h = 9.1 + 0.45 * Math.sin(a[0] * 0.43 + a[1] * 0.2),
      inner = 1.0;
    panel(o, f, 'brick', [
      [0, -0.25],
      [f.len, -0.25],
      [f.len, h + 0.28 * Math.sin(f.len)],
      [0, h],
    ]);
    panel(
      o,
      { ...f, n: f.n.map((v) => -v) },
      'wall',
      [
        [0, -0.1],
        [f.len, -0.1],
        [f.len, h - 0.08],
        [0, h - 0.12],
      ],
      [],
      -inner,
    );
    Q(
      o,
      'brick',
      [
        f.p(0, h),
        f.p(f.len, h + 0.28 * Math.sin(f.len)),
        f.p(f.len, h - 0.08, -inner),
        f.p(0, h - 0.12, -inner),
      ],
      [0, 1, 0],
    );
    if (d > 1 && f.len > 3) {
      for (let j = 0; j < Math.floor(f.len / 3); j++) {
        const x = ((j + 0.5) * f.len) / Math.floor(f.len / 3),
          y = 1.4 + 2.2 * (0.5 + 0.5 * Math.sin(j * 2.4 + i));
        panel(
          o,
          f,
          'wall',
          [
            [x - 0.7, y],
            [x + 0.9, y + 0.2],
            [x + 0.6, y + 2.2],
            [x - 0.9, y + 1.6],
          ],
          [],
          0.012,
          rgb('c9c1a6'),
        );
      }
      cornice(o, f, f.len / 2, Math.min(h - 0.4, 8.8), f.len, d, 0.08);
    }
  }
}
function ruinedNave(o, d) {
  outerRuins(o, d);
  const selected =
    d === 0
      ? ruin.arches
          .filter((a) => a.main && Math.abs(a.a.z - a.b.z) < 1.5 && Math.abs(a.a.x - a.b.x) > 5)
          .filter((_, i) => i % 2 === 0)
      : d === 1
        ? ruin.arches.filter((a, i) => a.main || i % 4 === 0)
        : ruin.arches;
  const used = new Set(selected.flatMap((a) => [a.a.i, a.b.i]));
  for (const p of ruin.piers) if (d > 1 || used.has(p.i)) pierGeometry(o, p, d);
  for (const a of selected) archBridge(o, a.a, a.b, a.spring, d);
  for (const r of roomBounds) vaultFragments(o, r, d);
  // Intrinsic nave floor only; the outer ruin grounds retain their host terrain.
  if (d > 0) for (const i of [0, 3, 12, 18]) cap(o, voids[i], 0.87, 'brick', rgb('b5a48e'));
}
function build(o, _frame, d = 3) {
  parish(o, d);
  westFacade(o, d);
  ruinedNave(o, d);
}
export const antiguaSkyline = (o, f) => build(o, f, 0);
export const antiguaDistrict = (o, f) => build(o, f, 1);
export const antiguaStreet = (o, f) => build(o, f, 2);
export const antiguaCathedralModel = {
  id: 'antigua_guatemala_cathedral',
  key: 'antigua_guatemala_cathedral',
  recipe: 'structure-antigua-guatemala-cathedral.mjs',
  cell: '9f/9fx',
  title: 'Antigua Guatemala Cathedral',
  category: 'cathedral',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native surviving cathedral: cream west Baroque facade/parish with3recessed timber doors/blue radial fanlights, paired engaged columns, lower and upper saint niches, scroll shoulders/raised ornament, urns and central crown; separate lower southern parish wing/roofs. Full eastern roofless ruin extent with battered brick/plaster walls, articulated compound piers/capitals, real open transverse/lateral arches and thin broken vault-edge fragments around the20mapped roof voids. Bounded intrinsic nave floor/entrance steps/iron fence only. Lost bell towers and complete old dome/roof absent. Native perimeters/voids exact, structural sections/elevations/hidden details photo-estimated.',
  camera: [112, 62, 128],
  lookAt: [0, 7, 0],
  portableGroundY: 0,
  mediumFiContext: { scale: 3 },
  qaCameras: [
    {
      name: 'west-baroque-doors-fanlights-saint-niches-and-scroll-crown',
      position: [8, 17, 91],
      lookAt: [2, 10, 44],
    },
    {
      name: 'roofless-nave-brick-arches-compound-piers-and-vault-voids',
      position: [31, 24, 18],
      lookAt: [1, 8, 4],
    },
    {
      name: 'complete-ruined-transepts-rear-chapels-and-standing-parish',
      position: [-95, 62, -107],
      lookAt: [0, 7, -3],
    },
  ],
  quality: 'medium-fi-exterior',
  recipeDependencies: ['trevi-sculpture-anatomy.mjs'],
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed west/front approach selected before terrain sampling. Intrinsic steps/floors remain bounded; no site-wide ground flattening.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-antigua-guatemala-cathedral.mjs',
    level: 'skyline',
    export: 'antiguaSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'antiguaDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'antiguaStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Current standing west/south parish and complete eastern ruined extent are both included. Original50vertex perimeter/59vertex ruin boundary and20roof voids are retained; exact35vertex standing remainder is their shared-native-boundary difference. Western main Baroque composition spans the original roughly40.6mfront; the lower parish wing continues south within the original outline. No adjacent ArchbishopPalace/SacristanHouse/seminary, lost bell towers or complete old dome is inferred.',
    'Main cornice10.2m/crown21.1m, lower parish8.4m/hidden hipped roofs, ruined walls9–10m and surviving arches/vault fragments roughly8–13m are photo-based medium-fi estimates, not surveys. Native voids locate open roof areas rather than measured ground-level pier sections; supporting pier/arch spans/levels and partial vault thickness/breakage are conservative original interpretations. No solid honeycomb extrusion or whole ruin roof replaces the open nave.',
    'One exact published QuallaNerdoguateCC0portal original and3explicitly self-dedicatedCC0front/nave originals from the same creator were fully inspected. Native metadata dates2025-01-03despite2024filenames. Interior event/carpet scenes, incomplete-attribution night source, other churches and archival appearances were not used. No photographic texture, modern ticket booth/furnishings, inscriptions, park/trees, visitors/vehicles or streets.',
    'Facade saints use statically baked public Molen figure anatomy under original long robes/attributes; detailed individual identities, portraits, gilded lettering, exact floral carving/capitals and fine erosion are bounded medium-fi approximations. Scrolls, doors/fanlights, niches, moldings, urns, compound piers and visible open arches are real geometry; delicate relief, louvres/fence rods and vault fragments retire with distance.',
    'The fixed west/front approach[0,53]controls approximate datum, with bounded intrinsic front steps and nave floors near.85m. Footing extends.25m below datum. Exact thresholds, original grade/drainage, demolished foundations and contact with host terrain remain unverified; source relief is preserved without a whole-site platform.',
  ],
};

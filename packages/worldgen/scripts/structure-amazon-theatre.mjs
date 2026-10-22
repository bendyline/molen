/** Full native theatre plan with pierced Renaissance facades, open loggia and original ceramic dome. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/6x/6xm/amazon_theatre/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('c58e93'),
    trim: rgb('e5dfd3'),
    roof: rgb('646b64'),
    base: rgb('a37d6a'),
    dark: rgb('3f4846'),
    tile: rgb('63856c'),
  },
  green = rgb('467a50'),
  yellow = rgb('c7b561'),
  blue = rgb('426086'),
  white = rgb('dad8c9');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.93, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.56, metallic: 0 },
};
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
const outline = area(plan.outline) > 0 ? [...plan.outline].reverse() : plan.outline;
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
function recess(o, f, r, d, back = -0.28, col = C.dark) {
  if (d < 3) back = 0.012;
  panel(o, f, 'dark', r, [], back, col);
  if (d === 0) return;
  if (d === 3)
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length,
        ps = [f.p(...r[i]), f.p(...r[j]), f.p(...r[j], back), f.p(...r[i], back)];
      quad(o, 'trim', ps, normalFor(...ps), C.trim);
    }
  border(o, f, r, 0.12, d);
}
function shutter(o, f, x, y, w, h, d) {
  if (d < 2) return;
  panel(o, f, 'trim', rect(x, y, w - 0.18, h), [], d === 2 ? 0.025 : -0.25, rgb('d3d4c6'));
  for (const xx of [x - w / 2 + 0.06, x, x + w / 2 - 0.06]) {
    if (d === 2) panel(o, f, 'trim', rect(xx, y, 0.07, h), [], 0.045);
    else localBox(o, f, 'trim', xx, y, -0.18, 0.075, h, 0.09);
  }
  const count = d === 2 ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const yy = y + 0.1 + (i * (h - 0.2)) / count;
    if (d === 2) panel(o, f, 'dark', rect(x, yy, w - 0.26, 0.035), [], 0.055, rgb('9da89f'));
    else localBox(o, f, 'trim', x, yy, -0.16, w - 0.25, 0.065, 0.12, rgb('c9cdbf'));
  }
}
function cornice(o, f, y, d, wide = 0.3) {
  if (d === 0) {
    panel(o, f, 'trim', rect(f.len / 2, y, f.len, 0.18), [], 0.015);
    return;
  }
  localBox(o, f, 'trim', f.len / 2, y, 0.05, f.len + 0.12, 0.16, 0.18 + wide);
  if (d > 1) {
    localBox(o, f, 'trim', f.len / 2, y - 0.17, 0.025, f.len, 0.1, 0.12 + wide / 2);
    localBox(o, f, 'trim', f.len / 2, y + 0.17, 0.06, f.len + 0.2, 0.09, 0.22 + wide);
  }
}
function facade(o, f, d, { low = 3.6, high = 17.6, short = false } = {}) {
  const n = d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 7 : 12,
    step = d === 0 ? 8.6 : 4.4,
    count = Math.max(1, Math.floor((f.len - 0.8) / step)),
    pitch = f.len / count,
    holes = [],
    lights = [];
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * pitch,
      z = f.p(x, 0)[2],
      w = Math.min(short ? 1.6 : 1.8, pitch * 0.5),
      r = arch(x, 8.2, w, 11.55, n);
    lights.push({ x, z, w, r });
    if (d === 3) holes.push(r);
    if (d > 0) {
      const ovalHole = oval(x, 15.35, 0.45, 0.61, Math.max(6, n * 2));
      if (d === 3) holes.push(ovalHole);
    }
  }
  panel(o, f, 'wall', rect(f.len / 2, low, f.len, high - low), holes);
  for (const { x, z, w, r } of lights) {
    if (d === 0) {
      panel(o, f, 'dark', r, [], 0.012);
      continue;
    }
    recess(o, f, r, d);
    shutter(o, f, x, 8.25, w, 3.22, d);
    const circle = oval(x, 15.35, 0.45, 0.61, Math.max(6, n * 2));
    recess(o, f, circle, d, -0.25, C.dark);
    if (d > 1) {
      localBox(o, f, 'trim', x, 8.01, 0.07, w + 0.47, 0.18, 0.24);
      localBox(o, f, 'trim', x, 13.0, 0.08, w + 0.67, 0.19, 0.26);
    }
    if (z > -10 && !short) {
      for (const xx of [x - w * 0.8, x + w * 0.8]) {
        if (d === 1) panel(o, f, 'trim', rect(xx, 8.0, 0.18, 5.5), [], 0.04);
        else {
          localBox(o, f, 'trim', xx, 8.0, 0.09, 0.24, 5.1, 0.25);
          localBox(o, f, 'trim', xx, 13.1, 0.12, 0.47, 0.21, 0.33);
        }
      }
      if (d > 1) {
        const brow = [
          [x - w * 0.72, 13.27],
          [x + w * 0.72, 13.27],
          [x + w * 0.52, 13.52],
          [x, 13.76],
          [x - w * 0.52, 13.52],
        ];
        panel(o, f, 'trim', brow, [], 0.1);
        if (d === 3) sphere(o, 'trim', f.p(x, 13.85, 0.12), [0.18, 0.22, 0.11], C.trim, 8, 4);
      }
    }
  }
  for (const y of [7.55, 13.75, 17.17]) cornice(o, f, y, d, y === 17.17 ? 0.42 : 0.24);
  if (d > 1) {
    for (let y = 4.2; y < 17.1; y += 0.72) {
      if ((y > 7.4 && y < 7.85) || (y > 13.6 && y < 14.0)) continue;
      panel(o, f, 'wall', rect(f.len / 2, y, f.len, 0.025), [], 0.006, rgb('a9757e'));
    }
    for (const x of [0.25, f.len - 0.25])
      for (let y = 3.7; y < 17.0; y += 0.75) {
        if (d === 2) panel(o, f, 'trim', rect(x, y, 0.48, 0.66), [], 0.045);
        else localBox(o, f, 'trim', x, y, 0.045, 0.48, 0.66, 0.14);
      }
  }
}
function clipZ(r, z) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ai = a[1] <= z,
      bi = b[1] <= z;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, z]);
    }
  }
  return out;
}
function body(o, d) {
  // Three low entrance arches are real recesses; all other lower perimeter remains the exact native shape.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      f = frame(a, b),
      front = Math.abs(a[1] - 34.81896112642611) < 0.01 && Math.abs(b[1] - a[1]) < 0.01;
    if (front) {
      const holes = Array.from({ length: 3 }, (_, j) =>
        arch(
          ((j + 0.5) * f.len) / 3,
          3.72,
          2.4,
          6.05,
          d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 8 : 14,
        ),
      );
      const upper = Array.from({ length: 5 }, (_, j) =>
        arch(((j + 0.5) * f.len) / 5, 9.0, 1.3, 11.6, d > 1 ? 8 : 4),
      );
      panel(o, f, 'wall', rect(f.len / 2, 3.6, f.len, 10.2), d === 3 ? [...holes, ...upper] : []);
      for (const r of holes) recess(o, f, r, d, -0.5);
      for (let j = 0; j < 5; j++) {
        const x = ((j + 0.5) * f.len) / 5,
          r = upper[j];
        recess(o, f, r, d);
        shutter(o, f, x, 9.03, 1.3, 2.45, d);
      }
      cornice(o, f, 8.2, d);
      cornice(o, f, 13.55, d);
      continue;
    }
    facade(o, f, d, { high: 17.6, short: f.len < 12 });
  }
  cap(o, outline, 3.6, 'base');
  // The main roof excludes the open projecting loggia.
  const a = plan.outline,
    main = [a[0], a[1], a[2], a[5], a[6], a[7]],
    mainRing = area(main) > 0 ? [...main].reverse() : main;
  cap(o, mainRing, 17.59, 'roof');
  const rear = clipZ(mainRing, -11.5),
    rn = d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 7 : 12;
  for (let i = 0; i < rear.length; i++) {
    const f = frame(rear[i], rear[(i + 1) % rear.length]),
      exterior =
        Math.abs(rear[i][1] + 11.5) > 0.01 ||
        Math.abs(rear[(i + 1) % rear.length][1] + 11.5) > 0.01,
      holes = [];
    if (exterior) {
      const count = Math.max(1, Math.round(f.len / 4.6));
      for (let j = 0; j < count; j++)
        holes.push(arch(((j + 0.5) * f.len) / count, 17.77, 2.35, 17.8, rn));
    }
    panel(o, f, 'wall', rect(f.len / 2, 17.6, f.len, 1.8), d === 3 ? holes : []);
    for (const r of holes) {
      recess(o, f, r, d, -0.26);
      if (d > 1) {
        const cx = (r[0][0] + r[1][0]) / 2;
        for (const xx of [cx - 0.44, cx, cx + 0.44])
          panel(o, f, 'trim', rect(xx, 17.8, 0.045, 0.55), [], -0.18);
      }
    }
    cornice(o, f, 19.12, d, 0.35);
  }
  cap(o, rear, 19.35, 'roof');
  if (d > 0) {
    // A low hipped stage roof is inset inside the retained rear masonry footprint.
    const roof = [
        [-11.4, 19.37, -32.6],
        [14.0, 19.37, -31.4],
        [12.6, 19.37, -12],
        [-12.4, 19.37, -12],
      ],
      ridge = [1, 20.35, -22];
    for (let i = 0; i < 4; i++) tri(o, 'roof', [roof[i], roof[(i + 1) % 4], ridge], [0, 1, 0]);
  }
}
function column(o, x, z, y0, y1, d, r = 0.22) {
  if (d === 0) {
    B(o, 'trim', [x - r, y0, z - r], [x + r, y1, z + r]);
    return;
  }
  const n = d === 1 ? 4 : d === 2 ? 6 : 10;
  if (d === 1) {
    loft(
      o,
      'trim',
      [radialRing(y0, r, r, 4, [x, z]), radialRing(y1, r * 0.9, r * 0.9, 4, [x, z])],
      C.trim,
    );
    return;
  }
  loft(
    o,
    'trim',
    [
      [y0, r * 1.5],
      [y0 + 0.13, r * 1.5],
      [y0 + 0.22, r * 1.1],
      [y1 - 0.3, r * 0.86],
      [y1 - 0.16, r * 1.55],
      [y1, r * 1.55],
    ].map(([y, rr]) => radialRing(y, rr, rr, n, [x, z])),
    C.trim,
  );
}
function loggia(o, d) {
  const r = plan.outline,
    front = frame(r[4], r[3]),
    width = front.len;
  // The original front edge goes right-to-left, so its outside normal is east/+Z.
  const f = front;
  localBox(o, f, 'trim', width / 2, 13.63, -2.9, width + 0.3, 0.22, 6.5);
  localBox(o, f, 'trim', width / 2, 18.85, -2.9, width + 0.65, 0.35, 6.8);
  for (let j = 0; j <= 5; j++) {
    const p = f.p((j * width) / 5, 0, 0.02);
    column(o, p[0], p[2], 13.85, 18.85, d, d === 0 ? 0.23 : 0.21);
  }
  if (d > 0)
    for (const x of [r[3][0], r[4][0]])
      for (const z of [30.0, 32.3]) column(o, x, z, 13.85, 18.85, d, 0.19);
  // Closed recessed background at the native projection's inner edge; upper loggia remains genuinely open.
  const back = frame([r[5][0], 28.51], [r[2][0], 28.51]);
  const backLights = Array.from({ length: 5 }, (_, j) =>
    oval(((j + 0.5) * back.len) / 5, 16.1, 0.88, 0.54, d > 1 ? 14 : 8),
  );
  panel(
    o,
    back,
    'wall',
    rect(back.len / 2, 13.8, back.len, 5.05),
    d === 3 ? backLights : [],
    -0.03,
  );
  for (let j = 0; j < 5; j++) {
    const rr = backLights[j];
    recess(o, back, rr, d, -0.08);
  }
  const n = [8, 14, 24, 42][d],
    rise = 4.1,
    outer = [
      [0, 19.2],
      [width, 19.2],
    ],
    curve = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      xx = width * (1 - t),
      yy = 19.2 + rise * Math.sin(t * Math.PI);
    curve.push([xx, yy]);
  }
  const pediment = [...outer, ...curve.slice(1, -1)];
  panel(o, f, 'wall', pediment, [], 0.01);
  panel(o, { ...f, n: f.n.map((v) => -v) }, 'wall', pediment, [], -0.5);
  for (let i = 0; i < pediment.length; i++) {
    const a = pediment[i],
      b = pediment[(i + 1) % pediment.length],
      ps = [f.p(...a, 0.01), f.p(...b, 0.01), f.p(...b, -0.5), f.p(...a, -0.5)];
    quad(o, 'wall', ps, normalFor(...ps), C.wall);
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i],
      b = curve[i + 1],
      ps = [
        f.p(a[0], a[1], 0.03),
        f.p(b[0], b[1], 0.03),
        f.p(b[0], b[1] + 0.28, 0.03),
        f.p(a[0], a[1] + 0.28, 0.03),
      ];
    Q(o, 'trim', ps, [0, 0, 1]);
    if (d > 1)
      beam(
        o,
        'trim',
        f.p(a[0], a[1] + 0.27, 0.05),
        f.p(b[0], b[1] + 0.27, 0.05),
        0.13,
        0.25,
        C.trim,
      );
  }
  cornice(o, f, 19.08, d, 0.5);
  if (d > 0) relief(o, f, width / 2, 20.3, d);
  if (d > 1)
    for (let j = 0; j < 5; j++) {
      const a = f.p((j * width) / 5 + 0.1, 14.15, 0.06),
        b = f.p(((j + 1) * width) / 5 - 0.1, 14.15, 0.06);
      beam(o, 'trim', a, b, 0.11, 0.18, C.trim);
    }
  // Handrail/balusters along the front of the open upper loggia.
  rail(o, f, 13.84, d, [0, width]);
}
function relief(o, f, cx, y, d) {
  const shield = [
    [cx - 0.8, y + 0.1],
    [cx + 0.8, y + 0.1],
    [cx + 0.86, y + 1.5],
    [cx, y + 1.9],
    [cx - 0.86, y + 1.5],
  ];
  panel(o, f, 'trim', shield, [], 0.12);
  if (d === 1) return;
  // Bounded original low relief of two reclining allegorical figures and foliage, not painted photo pixels.
  for (const sign of [-1, 1]) {
    const P = (x, yy, z = 0.24) => f.p(cx + sign * x, y + yy, z),
      col = C.trim;
    sphere(o, 'trim', P(1.65, 1.36), [0.24, 0.27, 0.13], col, d === 3 ? 12 : 8, 5);
    const torso = [
      [1.22, 0.35],
      [2.52, 0.1],
      [2.62, 0.44],
      [2.08, 0.79],
      [1.63, 1.15],
      [1.34, 0.91],
    ].map(([x, yy]) => [cx + sign * x, y + yy]);
    panel(o, f, 'trim', torso, [], 0.22);
    for (const [a, b, w] of [
      [[1.52, 1.05], [0.78, 1.48], 0.14],
      [[0.78, 1.48], [0.55, 1.7], 0.12],
      [[1.89, 0.87], [2.65, 0.51], 0.14],
      [[2.65, 0.51], [3.0, 0.68], 0.11],
      [[2.4, 0.26], [3.65, 0.15], 0.2],
      [[3.65, 0.15], [4.3, 0.43], 0.15],
    ])
      beam(o, 'trim', P(...a), P(...b), w, 0.18, col);
    if (d === 3)
      for (let j = 0; j < 6; j++) {
        const x = 1.5 + j * 0.25;
        beam(
          o,
          'trim',
          P(x, 0.17, 0.26),
          P(x + 0.08, 0.45 + 0.25 * Math.sin(j), 0.26),
          0.045,
          0.04,
          white,
        );
      }
    const branch = Array.from({ length: d === 3 ? 12 : 6 }, (_, j) => {
      const t = j / (d === 3 ? 11 : 5);
      return P(3.0 + 3.0 * t, 0.12 + 0.9 * t, 0.15);
    });
    for (let j = 0; j < branch.length - 1; j++) {
      beam(o, 'trim', branch[j], branch[j + 1], 0.055, 0.07, col);
      if (d === 3) {
        const p = branch[j];
        for (const s of [-1, 1])
          sphere(o, 'trim', [p[0] + s * 0.12, p[1] + 0.12, p[2]], [0.18, 0.07, 0.035], col, 6, 3);
      }
    }
  }
  if (d === 3)
    for (let j = 0; j < 7; j++)
      sphere(
        o,
        'trim',
        f.p(cx + (j - 3) * 0.21, y + 1.9 + 0.1 * Math.cos(j), 0.17),
        [0.17, 0.1, 0.07],
        C.trim,
        8,
        4,
      );
}
function rail(o, f, y, d, range = [0, f.len]) {
  const [lo, hi] = range,
    len = hi - lo;
  if (d === 0) {
    panel(o, f, 'trim', rect((lo + hi) / 2, y + 0.65, len, 0.13), [], 0.02);
    return;
  }
  for (const yy of [y, y + 0.83]) localBox(o, f, 'trim', (lo + hi) / 2, yy, 0.02, len, 0.13, 0.2);
  const count = Math.max(1, Math.round(len / (d === 1 ? 2.5 : d === 2 ? 1.8 : 0.76)));
  for (let j = 0; j <= count; j++) {
    const x = lo + (j * len) / count,
      p = f.p(x, y + 0.13, 0.02);
    if (d === 1) panel(o, f, 'trim', rect(x, y + 0.13, 0.09, 0.7), [], 0.03);
    else if (d === 2)
      loft(
        o,
        'trim',
        [
          [p[1], 0.09],
          [p[1] + 0.36, 0.14],
          [p[1] + 0.7, 0.08],
        ].map(([yy, r]) => radialRing(yy, r, r, 4, [p[0], p[2]])),
        C.trim,
      );
    else
      loft(
        o,
        'trim',
        [
          [p[1], 0.09],
          [p[1] + 0.14, 0.15],
          [p[1] + 0.36, 0.11],
          [p[1] + 0.64, 0.07],
          [p[1] + 0.7, 0.11],
        ].map(([yy, r]) => radialRing(yy, r, r, d === 2 ? 4 : 6, [p[0], p[2]])),
        C.trim,
      );
  }
}
function terrace(o, d) {
  // The photographs show this retaining terrace. It is intrinsic architecture, not a flattened world tile.
  const r = [
      [-22, -39],
      [-22, 37],
      [22, 37],
      [22, -39],
    ],
    curb = 3.58;
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    panel(o, f, 'base', rect(f.len / 2, -0.35, f.len, 3.95));
    if (d > 0) {
      cornice(o, f, 3.43, d, 0.2);
      for (let j = 0; j < f.len; j += d === 1 ? 12.4 : 6.2)
        localBox(o, f, 'wall', j, 3.6, 0, 0.65, 1.08, 0.65);
    }
    const isFront = i === 1;
    if (isFront) {
      for (const span of [
        [0, 7.5],
        [12.5, 31.5],
        [36.5, 44],
      ])
        rail(o, f, 3.6, d, span);
    } else rail(o, f, 3.6, d);
  }
  cap(o, r, curb, 'base', rgb('b1a18c'));
  // Two bounded flights descend from the photographed entrance terrace toward the plaza.
  for (const x of [-12, 12]) {
    if (d === 0) {
      const a = [x - 2.5, 3.6, 37],
        b = [x + 2.5, 3.6, 37],
        c = [x + 2.5, 0.02, 40.84],
        e = [x - 2.5, 0.02, 40.84];
      Q(o, 'trim', [a, b, c, e], [0, 1, 0]);
      Q(o, 'trim', [[a[0], -0.25, 37], a, e, [e[0], -0.25, 40.84]], [-1, 0, 0]);
      Q(o, 'trim', [b, [b[0], -0.25, 37], [c[0], -0.25, 40.84], c], [1, 0, 0]);
      continue;
    }
    B(o, 'trim', [x - 2.5, 3.3, 37], [x + 2.5, 3.6, 37.35]);
    for (let j = 0; j < (d === 0 ? 1 : 12); j++) {
      const yy = d === 0 ? 0 : j * 0.3,
        z0 = d === 0 ? 37 : 40.84 - j * 0.32;
      B(o, 'trim', [x - 2.5, -0.25, z0], [x + 2.5, yy + 0.3, d === 0 ? 40.84 : z0 + 0.36]);
    }
  }
}
function domeColor(a, t, cap) {
  const u = ((((a / (Math.PI * 2)) * 6) % 1) + 1) % 1,
    diamond = Math.abs(u - 0.5) * 2 + Math.abs(t - 0.5) * 1.7;
  if (!cap) {
    if (diamond < 0.24)
      return Math.abs(u - 0.5) < 0.035 || Math.abs(t - 0.5) < 0.045 ? white : blue;
    return diamond < 0.88 ? yellow : green;
  }
  const v = ((((a / (Math.PI * 2)) * 8 + t * 0.2) % 1) + 1) % 1,
    dd = Math.abs(v - 0.5) * 2 + Math.abs(((t * 2) % 1) - 0.5) * 1.7;
  return dd < 0.6 ? blue : dd < 0.88 ? green : yellow;
}
function dome(o, d) {
  const [cx, cz] = plan.domeEstimate.center,
    R = plan.domeEstimate.radius,
    n = [16, 20, 40, 104][d],
    rows = [2, 3, 6, 14][d],
    caps = [4, 5, 10, 22][d];
  const pt = (a, y, r) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  const surface = (y0, y1, r0, r1, count, color) => {
    for (let j = 0; j < count; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n,
          b = ((i + 1) * 2 * Math.PI) / n,
          t0 = j / count,
          t1 = (j + 1) / count,
          yA = y0 + (y1 - y0) * t0,
          yB = y0 + (y1 - y0) * t1,
          rA = r0 + (r1 - r0) * t0,
          rB = r0 + (r1 - r0) * t1;
        Q(
          o,
          'tile',
          [pt(a, yA, rA), pt(a, yB, rB), pt(b, yB, rB), pt(b, yA, rA)],
          [Math.cos((a + b) / 2), 0.05, Math.sin((a + b) / 2)],
          color((a + b) / 2, (t0 + t1) / 2),
        );
      }
  };
  surface(17.5, 21.0, R, R, rows, (a, t) => domeColor(a, t, false));
  surface(21.0, 22.8, R, R * 0.99, 1, () => blue);
  if (d > 0)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        p = pt(a, 21.03, R + 0.015),
        q = pt(a, 22.78, R * 0.99 + 0.015);
      beam(o, 'tile', p, q, d === 1 ? 0.055 : 0.042, 0.035, white);
    }
  surface(
    22.8,
    23.2,
    R * 0.99,
    R * 0.98,
    1,
    (a) => [yellow, blue, white, green][Math.floor((a / (2 * Math.PI)) * n) % 4],
  );
  for (let j = 0; j < caps; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        t0 = j / caps,
        t1 = (j + 1) / caps,
        theta0 = (t0 * Math.PI) / 2,
        theta1 = (t1 * Math.PI) / 2,
        y0 = 23.2 + 7 * Math.sin(theta0),
        y1 = 23.2 + 7 * Math.sin(theta1),
        r0 = Math.max(0.16, R * 0.98 * Math.cos(theta0)),
        r1 = Math.max(0.16, R * 0.98 * Math.cos(theta1));
      Q(
        o,
        'tile',
        [pt(a, y0, r0), pt(a, y1, r1), pt(b, y1, r1), pt(b, y0, r0)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
        domeColor((a + b) / 2, (t0 + t1) / 2, true),
      );
    }
  loft(
    o,
    'tile',
    [
      radialRing(30.15, 0.39, 0.39, d === 0 ? 6 : d === 1 ? 8 : 16, [cx, cz]),
      radialRing(30.52, 0.35, 0.35, d === 0 ? 6 : d === 1 ? 8 : 16, [cx, cz]),
      radialRing(31.36, 0.15, 0.15, d === 0 ? 6 : d === 1 ? 8 : 16, [cx, cz]),
      radialRing(31.49, 0.05, 0.05, d === 0 ? 6 : d === 1 ? 8 : 16, [cx, cz]),
    ],
    rgb('a6b1ac'),
  );
  beam(o, 'dark', [cx, 31.48, cz], [cx, 32.1, cz], 0.035, 0.035, C.dark);
}
function build(o, _frame, d = 3) {
  terrace(o, d);
  body(o, d);
  loggia(o, d);
  dome(o, d);
}
export const amazonSkyline = (o, f) => build(o, f, 0);
export const amazonDistrict = (o, f) => build(o, f, 1);
export const amazonStreet = (o, f) => build(o, f, 2);
export const amazonTheatreModel = {
  id: 'amazon_theatre',
  key: 'amazon_theatre',
  recipe: 'structure-amazon-theatre.mjs',
  cell: '6x/6xm',
  title: 'Amazon Theatre',
  category: 'theatre',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native pink RenaissanceRevivaltheatre with its small east/front projection, white quoins/cornices, physically recessed tall round-headed shuttered lights, oval attic oculi and rear semicircle attic windows. Separate rear stage roof, real open five-bay upper entrance loggia with columns/balustrade, segmental pediment and bounded original allegorical low relief. Distinctive green/yellow/blue ceramic-patterned drum/shallow dome and crown/finial. Intrinsic bounded raised retaining terrace, pale/pink balustrades and paired access stairs. Heights/dome position/concealed sections/terrace are photographic estimates; complete native main building outline retained.',
  camera: [64, 45, 83],
  lookAt: [0, 12, 0],
  portableGroundY: 0,
  mediumFiContext: { scale: 2.2 },
  qaCameras: [
    {
      name: 'east-open-loggia-segmental-pediment-and-patterned-dome',
      position: [3, 28, 77],
      lookAt: [-1, 18, 6],
    },
    {
      name: 'pink-dressed-side-windows-oculi-and-raised-terrace',
      position: [-50, 17, 35],
      lookAt: [-8, 10, -3],
    },
    {
      name: 'rear-attic-lunettes-stage-roof-and-dome',
      position: [43, 33, -61],
      lookAt: [0, 15, -13],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed east/front approach was chosen before terrain acquisition. Intrinsic raised terrace is architectural geometry; present source relief remains unflattened.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-amazon-theatre.mjs',
    level: 'skyline',
    export: 'amazonSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'amazonDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'amazonStreet', errorMeters: 0.09, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'The complete signed native8-corner building plan and small east projection remain fixed. Main facade17.6m, rear attic19.4m, front pediment23.6m, dome30.2m/finial32.1m,10.6mradius/dome position and hidden roof divisions are explicit photographic medium-fi estimates, not surveys. Main front faces east.',
    'Two exact Qualla-published RidiculopathyCC0exteriors were fully inspected:4608x2592side/rear view and4608x2128east/plaza view. Trees conceal lower front details; five-bay loggia, lower doorway/window rhythms, roof junctions, sculptural relief/fine carving and hidden faces are conservative original interpretations. The similarly named cafe interior/plaza sculpture photos and other sources are unused.',
    'Pink plaster, pale dressings, muted slate, red-brown stone and ceramic national-color lozenge pattern follow the current photographs. Dome tiles, white ribs, shutters, stone courses, ornament and simplified reclining allegorical figures are original mesh/color details, not photographic pixels or exact reproductions of every tile/portrait/letter. No interior/cafe/auditorium seating, chandelier, detached plaza monument, neighboring cathedral/courthouse, road/paving, vegetation, utilities, people or vehicles.',
    'The documented intrinsic retaining terrace is estimated44mwide,76mlong and3.6mhigh at the fixed front approach datum. Its boundaries, precise stairs, balustrade repeat and foundation/host-terrain contact remain approximate. Narrow footings extend.35m below datum. This is not a terrain flattening or city-wide platform; original source relief remains unchanged.',
    'All four LODs retain the complete theatre/dome/entrance/raised terrace silhouette. Curved window recesses, shutter louvres, quoins, balusters, pediment relief, roof/crown trim and ceramic tile subdivisions simplify with distance. Open loggia remains bounded; model is an exterior asset without navigable interior.',
  ],
};

/** Louisville Water Tower and the complete original Pumping Station No.1, at their native positions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { waterTowerStatue } from './structure-louisville-water-statuary.mjs';
import { box, profile as radialProfile, tube } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dn/dng/louisville_water_tower/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('d7dace'),
    trim: rgb('e0e2d6'),
    shaft: rgb('d8ddd2'),
    statue: rgb('d9ddd3'),
    roof: rgb('666f66'),
    glass: rgb('546764'),
    dark: rgb('3e4a45'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  shaft: { slot: 'wall', graph: 'metal_painted', roughness: 0.85, metallic: 0.18 },
  statue: { slot: 'trim', graph: 'metal_painted', roughness: 0.94, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.06 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
};
function tri(o, s, ps, n) {
  if (n && normalFor(...ps).reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), C[s]);
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const area = (r) =>
    r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, outer, holes, f, depth = 0) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => f.P(...pts[k], depth)),
      f.n,
    );
}
function strip(o, s, f, x, y, w, h, depth = 0) {
  panel(o, s, rect(x, y, w, h), [], f, depth);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, lo, hi) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    strip(o, s, f, f.len / 2, lo, f.len, hi - lo);
  }
  cap(o, s, r, hi);
  cap(o, s, r, lo, false);
}
function block(o, s, f, x, y, w, h, front, back = 0) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)];
    Q(o, s, ps, normalFor(...ps));
  }
}
function reveal(o, s, f, r, depth) {
  panel(o, s, r, [], f, depth);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [f.P(...a), f.P(...b), f.P(...b, depth), f.P(...a, depth)];
    Q(o, 'trim', ps, normalFor(...ps));
  }
}
const tc = plan.towerCenter,
  P = (r, a, y) => [tc[0] + r * Math.cos(a), y, tc[1] + r * Math.sin(a)],
  circle = (r, n) =>
    Array.from({ length: n }, (_, i) => [
      tc[0] + r * Math.cos((i / n) * Math.PI * 2),
      tc[1] + r * Math.sin((i / n) * Math.PI * 2),
    ]),
  columnAngles = Array.from(
    { length: 10 },
    (_, i) => Math.PI / 2 + Math.PI / 10 + (i / 10) * Math.PI * 2,
  );
function radial(o, s, layers, n, center = tc) {
  radialProfile(
    o,
    layers.map(([y, r]) => [y, r, r, s, C[s]]),
    n,
    center,
  );
}
function clip(r, axis, value, less = true) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ina = less ? a[axis] <= value : a[axis] >= value,
      inb = less ? b[axis] <= value : b[axis] >= value;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
function ringSlab(o, s, inner, outer, lo, hi, n) {
  const outside = circle(outer, n),
    inside = circle(inner, n),
    pts = [...outside, ...inside],
    ix = earcut(pts.flat(), [n]);
  for (const [y, up] of [
    [lo, false],
    [hi, true],
  ])
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((k) => [pts[k][0], y, pts[k][1]]),
        [0, up ? 1 : -1, 0],
      );
  for (const [r, reverse] of [
    [outside, false],
    [inside, true],
  ])
    for (let i = 0; i < n; i++) {
      const a = r[i],
        b = r[(i + 1) % n],
        ang = ((i + 0.5) / n) * Math.PI * 2,
        norm = [Math.cos(ang) * (reverse ? -1 : 1), 0, Math.sin(ang) * (reverse ? -1 : 1)];
      Q(
        o,
        s,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        norm,
      );
    }
}
function column(o, x, z, lo, hi, r, d) {
  if (!d) {
    radial(
      o,
      'trim',
      [
        [lo, r],
        [hi - 0.15, r * 0.8],
        [hi, r * 1.25],
      ],
      4,
      [x, z],
    );
    return;
  }
  if (d === 1) {
    radial(
      o,
      'trim',
      [
        [lo, r * 1.25],
        [lo + 0.2, r],
        [hi - 0.5, r * 0.85],
        [hi, r * 1.35],
      ],
      4,
      [x, z],
    );
    return;
  }
  const n = d > 2 ? 24 : 8;
  radial(
    o,
    'trim',
    [
      [lo, r * 1.3],
      [lo + 0.12, r * 1.3],
      [lo + 0.18, r * 1.15],
      [lo + 0.28, r],
      [hi - 0.65, r * 0.85],
      [hi - 0.55, r * 0.9],
      [hi - 0.44, r * 1.05],
      [hi - 0.18, r * 1.38],
    ],
    n,
    [x, z],
  );
  box(o, 'trim', [x - r * 1.45, hi - 0.18, z - r * 1.45], [x + r * 1.45, hi, z + r * 1.45], C.trim);
  if (d > 1) {
    const leaves = d > 2 ? 12 : 6;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2,
        u = [Math.cos(a), Math.sin(a)],
        v = [-u[1], u[0]],
        base = [x + u[0] * r * 0.92, hi - 0.6, z + u[1] * r * 0.92],
        tip = [x + u[0] * r * 1.34, hi - 0.24, z + u[1] * r * 1.34],
        left = [base[0] + v[0] * r * 0.29, hi - 0.52, base[2] + v[1] * r * 0.29],
        right = [base[0] - v[0] * r * 0.29, hi - 0.52, base[2] - v[1] * r * 0.29];
      tri(o, 'trim', [base, left, tip], [u[0], 0.1, u[1]]);
      tri(o, 'trim', [base, tip, right], [u[0], 0.1, u[1]]);
    }
    if (d > 2)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        tube(
          o,
          'trim',
          [x + Math.cos(a) * (r + 0.012), lo + 0.35, z + Math.sin(a) * (r + 0.012)],
          [x + Math.cos(a) * r * 0.87, hi - 0.68, z + Math.sin(a) * r * 0.87],
          0.018,
          C.trim,
          4,
        );
      }
  }
}
function lowerTower(o, d) {
  prism(o, 'wall', plan.towerBase, -0.2, 0.35);
  const n = d > 2 ? 48 : d > 1 ? 24 : d ? 10 : 10,
    r = cw(clip(circle(2.9, n), 1, tc[1] + 2.7));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = frame(a, b),
      door = Math.abs(a[1] - tc[1] - 2.7) < 0.01 && Math.abs(b[1] - tc[1] - 2.7) < 0.01,
      hole = rect(f.len / 2, 0.45, 0.95, 1.9);
    panel(o, 'wall', rect(f.len / 2, 0.35, f.len, 5.95), door && d > 1 ? [hole] : [], f);
    if (door) {
      if (d) reveal(o, 'glass', f, hole, -0.2);
      else panel(o, 'glass', hole, [], f, 0.016);
    }
  }
  cap(o, 'wall', r, 6.3);
  for (const a of columnAngles) {
    const p = P(4.7, a, 0);
    column(o, p[0], p[2], 0.35, 6.15, 0.31, d);
  }
  ringSlab(o, 'trim', 2.55, 5.7, 6.15, 6.85, d > 2 ? 60 : d > 1 ? 20 : 10);
  ringSlab(o, 'trim', 2.55, 5.82, 6.8, 7.02, d > 2 ? 40 : d > 1 ? 20 : 10);
  if (d > 1) {
    const n = d > 2 ? 100 : 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        p = P(5.65, a, 0);
      beam(o, 'trim', [p[0], 6.35, p[2]], [p[0], 6.65, p[2]], 0.12, 0.14, C.trim);
    }
  }
  for (const a of columnAngles) {
    const p = P(4.85, a, 0);
    box(o, 'trim', [p[0] - 0.35, 7.0, p[2] - 0.35], [p[0] + 0.35, 8.25, p[2] + 0.35], C.trim);
    if (d > 1)
      box(o, 'trim', [p[0] - 0.44, 8.12, p[2] - 0.44], [p[0] + 0.44, 8.25, p[2] + 0.44], C.trim);
  }
  ringSlab(o, 'trim', 4.95, 5.17, 7.1, 7.24, d > 2 ? 60 : d > 1 ? 20 : 10);
  ringSlab(o, 'trim', 4.9, 5.22, 8.03, 8.18, d > 2 ? 60 : d > 1 ? 20 : 10);
  if (d) {
    const count = d > 2 ? 60 : d > 1 ? 16 : 10;
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) / count) * Math.PI * 2,
        p = P(5.05, a, 0);
      radial(
        o,
        'trim',
        d > 2
          ? [
              [7.24, 0.065],
              [7.35, 0.09],
              [7.48, 0.135],
              [7.63, 0.11],
              [7.85, 0.065],
              [8.03, 0.09],
            ]
          : [
              [7.24, 0.085],
              [7.65, 0.12],
              [8.03, 0.085],
            ],
        d > 2 ? 10 : 4,
        [p[0], p[2]],
      );
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = columnAngles[i],
      p = P(4.85, a, 8.25);
    waterTowerStatue(o, i, d, p, Math.PI / 2 - a);
  }
}
function shaftRadius(y) {
  return 2.8 - ((y - 7.3) / (44.0 - 7.3)) * 0.58;
}
function shaft(o, d) {
  const n = d > 2 ? 64 : d > 1 ? 24 : 12;
  radial(
    o,
    'shaft',
    [
      [6.95, 3.02],
      [7.35, 3.02],
      [7.65, 2.8],
      [43.85, 2.22],
      [44.05, 2.35],
      [44.3, 2.35],
      [44.55, 2.75],
      [44.9, 3.15],
      [45.85, 3.15],
      [46.12, 2.7],
      [47.7, 2.15],
    ],
    n,
  );
  if (d > 1) {
    const ribs = 12;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2;
      const lo = P(shaftRadius(8.0) + 0.035, a, 8),
        hi = P(shaftRadius(43.8) + 0.035, a, 43.8);
      tube(o, 'shaft', lo, hi, d > 1 ? 0.07 : 0.055, C.shaft, d > 2 ? 8 : 5);
      if (d > 1) {
        const half = (Math.PI / ribs) * 0.73,
          angles = [a - half, a + half],
          bot = 9.0,
          top = 42.5;
        for (const aa of angles)
          tube(
            o,
            'shaft',
            P(shaftRadius(bot) + 0.02, aa, bot),
            P(shaftRadius(top) + 0.02, aa, top),
            0.022,
            C.shaft,
            4,
          );
        for (const [y, sign] of [
          [bot, 1],
          [top, -1],
        ]) {
          const count = d > 2 ? 10 : 2,
            points = Array.from({ length: count + 1 }, (_, j) => {
              const t = (j / count) * Math.PI,
                aa = a + half * Math.cos(t),
                yy = y - sign * 0.8 * Math.sin(t);
              return P(shaftRadius(yy) + 0.02, aa, yy);
            });
          for (let j = 1; j < points.length; j++)
            tube(o, 'shaft', points[j - 1], points[j], 0.022, C.shaft, 4);
        }
      }
    }
    if (d > 2)
      for (const y of [10.1, 20.7, 31.4, 42.1])
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          sphere(o, 'shaft', P(shaftRadius(y) + 0.025, a, y), [0.028, 0.028, 0.028], C.shaft, 4, 3);
        }
  }
}
function lantern(o, d) {
  const n = d > 2 ? 48 : d > 1 ? 20 : 8;
  radial(
    o,
    'trim',
    [
      [47.7, 2.12],
      [47.9, 2.2],
      [48.12, 1.86],
    ],
    n,
  );
  const count = d > 1 ? 12 : 8,
    R = 1.83,
    pts = cw(circle(R, count));
  for (let i = 0; i < count; i++) {
    const f = frame(pts[i], pts[(i + 1) % count]),
      hole = rect(f.len / 2, 48.65, 0.34, 2.85);
    panel(o, 'trim', rect(f.len / 2, 48.12, f.len, 4.1), d > 1 ? [hole] : [], f);
    if (d > 1) reveal(o, 'dark', f, hole, -0.22);
    else panel(o, 'dark', hole, [], f, 0.016);
  }
  radial(
    o,
    'trim',
    [
      [52.22, 1.88],
      [52.5, 2.02],
      [52.65, 2.42],
      [53.05, 2.42],
      [53.3, 2.3],
    ],
    n,
  );
  const countY = d > 2 ? 12 : d > 1 ? 5 : 3,
    layers = Array.from({ length: countY + 1 }, (_, j) => {
      const t = ((j / countY) * Math.PI) / 2;
      return [53.3 + Math.sin(t) * 2.65, Math.max(0.04, 2.3 * Math.cos(t))];
    });
  radial(o, 'shaft', layers, n);
  if (d > 1)
    for (let i = 0; i < (d > 2 ? 12 : 8); i++) {
      const a = (i / (d > 2 ? 12 : 8)) * Math.PI * 2,
        ps = layers.slice(0, -1).map(([y, r]) => P(r + 0.026, a, y));
      for (let j = 1; j < ps.length; j++) tube(o, 'trim', ps[j - 1], ps[j], 0.04, C.trim, 5);
    }
  radial(
    o,
    'shaft',
    [
      [55.95, 0.11],
      [56.12, 0.11],
      [56.18, 0.065],
      [56.388, 0.012],
    ],
    d > 1 ? 10 : 6,
  );
}
const pump = plan.pumpStation,
  main = cw(clip(clip(pump, 0, -9.75, false), 0, 6.98)),
  leftWing = cw(clip(pump, 0, -9.75)),
  rightWing = cw(clip(pump, 0, 6.98, false)),
  bodyMain = cw(clip(main, 1, -26.0));
function light(o, f, h, d) {
  const r = rect(h.x, h.y, h.w, h.h);
  if (!d) {
    panel(o, 'glass', r, [], f, 0.016);
    return;
  }
  reveal(o, 'glass', f, r, -0.22);
  if (d <= 2) {
    if (d === 2) {
      strip(o, 'trim', f, h.x, h.y, 0.055, h.h, -0.14);
      strip(o, 'trim', f, h.x, h.y + h.h * 0.5, h.w, 0.055, -0.14);
    }
    strip(o, 'trim', f, h.x, h.y - 0.1, h.w + 0.2, 0.14, 0.05);
    strip(o, 'trim', f, h.x, h.y + h.h, h.w + 0.28, 0.22, 0.05);
    return;
  }
  for (const sg of [-1, 1])
    block(o, 'trim', f, h.x + sg * (h.w / 2 + 0.06), h.y, 0.12, h.h, 0.08, -0.08);
  block(o, 'trim', f, h.x, h.y - 0.13, h.w + 0.32, 0.16, 0.16, -0.01);
  block(o, 'trim', f, h.x, h.y + h.h, h.w + 0.45, 0.32, 0.18, -0.01);
  strip(o, 'trim', f, h.x, h.y, 0.05, h.h, -0.14);
  for (let i = 1; i < 4; i++) strip(o, 'trim', f, h.x, h.y + (i * h.h) / 4, h.w, 0.045, -0.14);
  if (d > 2)
    for (const sg of [-1, 1]) strip(o, 'trim', f, h.x + (sg * h.w) / 3, h.y, 0.035, h.h, -0.14);
}
function buildingWalls(o, r, hi, d, high) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = frame(a, b),
      count = f.len > 3 ? Math.max(1, Math.round(f.len / 3.7)) : 0,
      hs = [];
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * f.len) / count;
      hs.push({ x, y: 0.9, w: 1.25, h: high ? 3.5 : 3.8 });
      if (high) hs.push({ x, y: 6.6, w: 1.1, h: 2.5 });
    }
    panel(
      o,
      'wall',
      rect(f.len / 2, 0.25, f.len, hi - 0.25),
      d ? hs.map((h) => rect(h.x, h.y, h.w, h.h)) : [],
      f,
    );
    for (const h of hs) light(o, f, h, d);
    if (d) {
      for (const y of [0.5, hi - 0.4]) block(o, 'trim', f, f.len / 2, y, f.len, 0.3, 0.12, -0.03);
      if (f.len > 5)
        for (const x of [0.25, f.len - 0.25])
          block(o, 'trim', f, x, 0.55, 0.42, hi - 1, 0.17, -0.01);
    }
  }
}
function roof(o, r, eave, ridge, axis, d) {
  const min = Math.min(...r.map((p) => p[axis])),
    max = Math.max(...r.map((p) => p[axis])),
    mid = (min + max) / 2,
    top = (p) =>
      eave +
      (ridge - eave) * (1 - Math.abs(p[axis] - mid) / (p[axis] < mid ? mid - min : max - mid));
  for (const side of [true, false]) {
    const q = clip(r, axis, mid, side),
      ix = earcut(q.flat());
    for (let j = 0; j < ix.length; j += 3)
      tri(
        o,
        'roof',
        ix.slice(j, j + 3).map((k) => [q[k][0], top(q[k]), q[k][1]]),
        [0, 1, 0],
      );
  }
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      pts = [a];
    if ((a[axis] - mid) * (b[axis] - mid) < 0) {
      const t = (mid - a[axis]) / (b[axis] - a[axis]);
      pts.push(a.map((v, k) => v + (b[k] - v) * t));
    }
    pts.push(b);
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j],
        b = pts[j + 1],
        f = frame(a, b);
      Q(
        o,
        'wall',
        [
          [a[0], eave - 0.12, a[1]],
          [b[0], eave - 0.12, b[1]],
          [b[0], top(b), b[1]],
          [a[0], top(a), a[1]],
        ],
        f.n,
      );
      if (d > 2)
        beam(
          o,
          'trim',
          [a[0], top(a) + 0.03, a[1]],
          [b[0], top(b) + 0.03, b[1]],
          0.13,
          0.14,
          C.trim,
        );
    }
    if (d)
      block(
        o,
        'trim',
        frame(a, b),
        Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
        eave - 0.05,
        Math.hypot(b[0] - a[0], b[1] - a[1]),
        0.18,
        0.15,
        -0.04,
      );
  }
}
function pediment(o, f, base, rise, d) {
  const r = [
    [0, base],
    [f.len, base],
    [f.len / 2, base + rise],
  ];
  panel(o, 'trim', r, [], f, 0.08);
  if (d)
    for (let i = 0; i < 3; i++)
      beam(o, 'trim', f.P(...r[i], 0.12), f.P(...r[(i + 1) % 3], 0.12), 0.2, 0.22, C.trim);
}
function pumpBuilding(o, d) {
  prism(o, 'wall', pump, -0.2, 0.25);
  if (!d) {
    prism(o, 'wall', bodyMain, 0.25, 11.2);
    prism(o, 'wall', leftWing, 0.25, 7.5);
    prism(o, 'wall', rightWing, 0.25, 7.5);
  } else {
    buildingWalls(o, bodyMain, 11.2, d, true);
    buildingWalls(o, leftWing, 7.5, d, false);
    buildingWalls(o, rightWing, 7.5, d, false);
  }
  roof(o, main, 11.2, 14.4, 0, d);
  roof(o, leftWing, 7.5, 8.9, 1, d);
  roof(o, rightWing, 7.5, 8.9, 1, d);
  const f = frame([-9.34, -19.802], [6.954, -19.802]),
    floor = [
      [-9.34, -26],
      [6.954, -26],
      [6.954, -19.802],
      [-9.34, -19.802],
    ];
  prism(o, 'trim', floor, 0.25, 0.5);
  cap(o, 'trim', floor, 10.25, false);
  for (let j = 0; j < 4; j++) {
    const x = -8.25 + j * 4.76;
    column(o, x, -20.7, 0.5, 10.25, 0.48, d);
  }
  for (const [y, h, depth] of [
    [10.25, 0.3, 0.08],
    [10.55, 0.5, 0.12],
    [11.05, 0.15, 0.3],
  ])
    block(o, 'trim', f, f.len / 2, y, f.len, h, depth, -0.9);
  pediment(o, f, 11.2, 3.2, d);
  for (const side of [-1, 1]) {
    const xmin = side < 0 ? -20.11 : 11.075,
      xmax = side < 0 ? -12.319 : 19.82,
      z = side < 0 ? -22.028 : -22.426,
      face = frame([xmin, z], [xmax, z]),
      r = clip(
        clip(clip(clip(side < 0 ? leftWing : rightWing, 0, xmin, false), 0, xmax), 1, z + 0.03),
        1,
        z - 4.3,
        false,
      );
    if (r.length > 2) roof(o, r, 7.5, 9.0, 0, d);
    pediment(o, face, 7.5, 1.5, d);
    if (d > 1)
      for (const x of [xmin + 0.3, xmax - 0.3])
        box(o, 'trim', [x - 0.2, 0.45, z - 0.05], [x + 0.2, 7.48, z + 0.17], C.trim);
  }
}
function annularPlane(o, inner, outer, y, n) {
  const pts = [...circle(outer, n), ...circle(inner, n)],
    ix = earcut(pts.flat(), [n]);
  for (let i = 0; i < ix.length; i += 3)
    for (const sg of [-1, 1])
      tri(
        o,
        'trim',
        ix.slice(i, i + 3).map((k) => [pts[k][0], y, pts[k][1]]),
        [0, sg, 0],
      );
}
function skyline(o) {
  prism(
    o,
    'wall',
    plan.towerBase.filter((_, i) => i % 2 === 0),
    -0.2,
    0.35,
  );
  prism(o, 'wall', circle(2.9, 8), 0.35, 6.85);
  for (let i = 0; i < 10; i++) {
    const a = columnAngles[i],
      p = P(4.7, a, 0),
      r = Array.from({ length: 3 }, (_, j) => [
        p[0] + Math.cos((j / 3) * Math.PI * 2) * 0.4,
        p[2] + Math.sin((j / 3) * Math.PI * 2) * 0.4,
      ]);
    prism(o, 'trim', r, 0.35, 6.15);
    const q = P(4.85, a, 0),
      b = Array.from({ length: 3 }, (_, j) => [
        q[0] + Math.cos((j / 3) * Math.PI * 2) * 0.4,
        q[2] + Math.sin((j / 3) * Math.PI * 2) * 0.4,
      ]);
    prism(o, 'trim', b, 7.02, 8.25);
    waterTowerStatue(o, i, 0, [q[0], 8.25, q[2]], Math.PI / 2 - a);
  }
  annularPlane(o, 2.55, 5.82, 6.85, 10);
  annularPlane(o, 4.9, 5.22, 8.15, 10);
  radial(
    o,
    'shaft',
    [
      [6.95, 3.02],
      [7.65, 2.8],
      [43.85, 2.22],
      [44.9, 3.15],
      [46.12, 3.15],
      [47.7, 2.15],
    ],
    8,
  );
  radial(
    o,
    'trim',
    [
      [47.7, 2.12],
      [48.12, 1.86],
      [52.5, 1.86],
      [53.3, 2.3],
    ],
    8,
  );
  for (let i = 0; i < 8; i++) {
    const r = cw(circle(1.86, 8)),
      f = frame(r[i], r[(i + 1) % 8]);
    strip(o, 'dark', f, f.len / 2, 48.65, 0.34, 2.85, 0.014);
  }
  radial(
    o,
    'shaft',
    [
      [53.3, 2.3],
      [55.1, 1.7],
      [55.95, 0.08],
      [56.388, 0.012],
    ],
    8,
  );
  const parts = [
    [-9.75, 6.98, -43.04, -26, 11.2],
    [-25.29, -9.75, -37.91, -26.43, 7.5],
    [6.98, 25.11, -37.66, -26.51, 7.5],
    [-20.11, -12.32, -26.43, -22.028, 7.5],
    [11.075, 19.82, -26.51, -22.426, 7.5],
    [-19.94, -12.56, -40.23, -37.91, 7.5],
    [11.87, 19.5, -40.28, -37.66, 7.5],
  ];
  for (const [x0, x1, z0, z1, y] of parts) box(o, 'wall', [x0, 0.25, z0], [x1, y, z1], C.wall);
  for (const [x0, x1, z0, z1, e, r, axis] of [
    [-9.75, 6.98, -43.04, -19.802, 11.2, 14.4, 0],
    [-25.29, -9.75, -37.91, -26.43, 7.5, 8.9, 1],
    [6.98, 25.11, -37.66, -26.51, 7.5, 8.9, 1],
  ])
    roof(
      o,
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      e,
      r,
      axis,
      0,
    );
  for (let j = 0; j < 4; j++) {
    const x = -8.25 + j * 4.76,
      r = Array.from({ length: 3 }, (_, i) => [
        x + Math.cos((i / 3) * Math.PI * 2) * 0.6,
        -20.7 + Math.sin((i / 3) * Math.PI * 2) * 0.6,
      ]);
    prism(o, 'trim', r, 0.5, 10.25);
  }
  box(o, 'trim', [-9.34, 0.25, -26], [6.954, 0.5, -19.802], C.trim);
  box(o, 'trim', [-9.34, 10.25, -20.2], [6.954, 11.2, -19.72], C.trim);
}
function districtPump(o) {
  pumpBuilding(o, 0);
  for (const [r, high] of [
    [bodyMain, true],
    [leftWing, false],
    [rightWing, false],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]);
      if (f.len < 6) continue;
      const count = Math.round(f.len / 4);
      for (let j = 0; j < count; j++)
        for (const [y, h] of high
          ? [
              [0.9, 3.5],
              [6.6, 2.5],
            ]
          : [[0.9, 3.8]]) {
          const x = ((j + 0.5) * f.len) / count;
          strip(o, 'glass', f, x, y, 1.25, h, 0.016);
          strip(o, 'trim', f, x, y + h, 1.55, 0.24, 0.02);
        }
    }
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  lowerTower(o, d);
  shaft(o, d);
  lantern(o, d);
  if (d === 1) districtPump(o);
  else pumpBuilding(o, d);
}
export const louisvilleSkyline = (o, f) => build(o, f, 0);
export const louisvilleDistrict = (o, f) => build(o, f, 1);
export const louisvilleStreet = (o, f) => build(o, f, 2);
export const louisvilleWaterModel = {
  id: 'louisville_water_tower',
  key: 'louisville_water_tower',
  recipe: 'structure-louisville-water-tower.mjs',
  recipeDependencies: ['structure-louisville-water-statuary.mjs'],
  cell: 'dn/dng',
  title: 'Louisville Water Tower',
  category: 'public-works',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole ornamental WaterTower and original1860whitePumpingStationNo1: actualnative17/36vertexplans/separatepositions, open10columncircularbase/balustrade/tenposedhumanstatues, tallribbedpaneledpaleironshaft/uppercapital/slottedlantern/ribbeddome/finial, highGreekpumpcenter/openfrontportico/pediment andcompleteattachedwings/endpavilions/dressedrecessedsash/slateroofs. No detachedlatercampusbuildings/river/site.',
  camera: [62, 48, 76],
  lookAt: [0, 19, -12],
  portableGroundY: -0.25,
  mediumFiContext: { scale: 1.2, groundY: -0.25 },
  qaCameras: [
    {
      name: 'open-circular-colonnade-balustrade-and-ten-zinc-statues',
      position: [17, 11, 19],
      lookAt: [tc[0], 5.8, tc[1]],
    },
    {
      name: 'draped-raised-arm-pouring-and-hunter-with-dog-figures',
      position: [8.8, 9.8, 9.5],
      lookAt: [2.0, 9.0, 3.3],
    },
    {
      name: 'tapered-ribbed-iron-shaft-capital-slotted-lantern-and-ribbed-dome',
      position: [20, 51, 26],
      lookAt: [0, 48, 0],
    },
    {
      name: 'complete-original-pump-station-center-portico-and-two-wings',
      position: [40, 24, 5],
      lookAt: [0, 6, -29],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent160mfield frozen before geometry at fixed SEfrontapproach; exact floors/steps/host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-louisville-water-tower.mjs',
    level: 'skyline',
    export: 'louisvilleSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'louisvilleDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'louisvilleStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Whole original WaterTowerandPumpingStationNo1 only; actual17/36vertexnativeplansandrelativepositions retained. Owner185ft/56.388moverallheight andtenstatuesareprimarycontrols. Allotherverticalsections, exactcolumn/rib/sashcensus, finecapitals/ornament/pumproofpartitionsandhiddenrearelevations remain bounded estimates from cleared2007exteriors andnativeplan.',
    'Realopenlowercolonnade/annularcoveredwalk/closedcentralbaseentry, openbalusters andtenpedestalhumanfigures. Near statuary uses original posed generatedanatomy andsculpteddrapery/urn/hunterdog/raisedarm/hatattributes fromseveralvisiblePDcloseups; unseenposes/placementassignmentsestimated andnotportraitreplicas. Skyline preserves tower/pump heights, alltenlowercolumns/figures and mainwing/pavilion silhouette with simplified footprints/thin annular roof/rail proxies; districtcoarsensdrapery/anatomy/capitals and pump lights are flat shadow/glazing hints within the0.9merror. Nearlevelsaddpaneledshaft/ribs/rivets/dome details and genuinely recessed pump/lantern lights; streetcoarsens paintseams/roofmoldings below0.35merror. No interiorwaterpipe/engines.',
    'Onlythree exact already-cleared publishedBedfordQualla1600x1200PDoriginals from2007; nativeSHA1/ownauthor/PD-user-w-or-en releases bound. Unrelated/food/grave/uncertain/attributionimageryunused. Riveroverviewviewedbutnotadopted. Ownertextonlysupports185ftheight/tenstatues/2024restoration; ownerwebphotographs/videos/docimagesunused. Shared proceduralplaster/paintedmetal/slate andmutedglazing, no copiedpixels/generatedbitmap.',
    'Cleanpalefinishesrepresentpermanentarchitectureafter2024restoration;2007peelingpaint/temporaryscaffold/currentcosmeticsunverified. No detachedlaterRomanesque/yellowpumphalls/chimneys, river/USGSgauge/pylons/othercampusbuildings/roads/plazas/lawns/landscape/people/signage. Original160mterrain/rawtiles/grid/PNG unchanged at fixedfrontapproach; no flattening/fitting or connectinggroundslab; exactfloor/threshold/host contactunverified; replaceFootprintfalse.',
  ],
};

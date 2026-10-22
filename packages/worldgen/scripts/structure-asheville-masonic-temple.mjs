/** Whole Asheville Masonic Temple: Broadway portico and connected Woodfin hall. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, profile as radialProfile } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dn/dnm/asheville_masonic_temple/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    brick: rgb('954e42'),
    inset: rgb('82473e'),
    stone: rgb('77796e'),
    trim: rgb('d6c9ac'),
    roof: rgb('874b3b'),
    metal: rgb('343d39'),
    glass: rgb('526668'),
  };
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.98, metallic: 0 },
  inset: { slot: 'wall', graph: 'brick', roughness: 0.98, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.2 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.07 },
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
    Q(o, s === 'glass' ? 'trim' : 'brick', ps, normalFor(...ps));
  }
}
function profile(o, layers, sides, center) {
  radialProfile(
    o,
    layers.map(([y, r]) => [y, r, r, 'trim', C.trim]),
    sides,
    center,
  );
}
function window(o, f, h, d) {
  const r = rect(h.x, h.y, h.w, h.h);
  if (!d) {
    panel(o, 'glass', r, [], f, 0.018);
    return;
  }
  reveal(o, 'glass', f, r, -0.22);
  if (d === 1) {
    strip(o, 'trim', f, h.x, h.y - 0.13, h.w + 0.35, 0.16, 0.08);
    strip(o, 'trim', f, h.x, h.y + h.h, h.w + 0.28, 0.3, 0.08);
    return;
  }
  block(o, 'trim', f, h.x, h.y - 0.13, h.w + 0.35, 0.16, 0.16, -0.025);
  block(o, 'trim', f, h.x, h.y + h.h, h.w + 0.28, 0.3, 0.1, -0.02);
  if (d > 1) {
    for (const sg of [-1, 1])
      block(o, 'trim', f, h.x + sg * (h.w / 2 + 0.045), h.y, 0.09, h.h, 0.045, -0.1);
    strip(o, 'trim', f, h.x, h.y + h.h * 0.48, h.w, 0.065, -0.14);
    if (d > 2) {
      strip(o, 'trim', f, h.x, h.y, 0.048, h.h, -0.14);
      block(o, 'trim', f, h.x, h.y + h.h + 0.035, 0.22, 0.25, 0.13, 0.11);
    }
  }
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
const frontZ = plan.frontZ,
  cx = (plan.frontPortion[0][0] + plan.frontPortion[4][0]) / 2,
  frontR = cw(clip(plan.frontPortion, 1, 3, false)),
  hallR = cw(clip(plan.outline, 1, 3)),
  F = frame([plan.frontPortion[0][0], frontZ], [plan.frontPortion[4][0], frontZ]),
  center = F.len / 2;
function arch(x, lo, w, spring, rise, n) {
  return [
    [x - w / 2, lo],
    [x + w / 2, lo],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + (Math.cos((i / n) * Math.PI) * w) / 2,
      spring + Math.sin((i / n) * Math.PI) * rise,
    ]),
  ];
}
function sashRows(f, hall, _d) {
  const count = Math.max(2, Math.round(f.len / (hall ? 4.0 : 3.2))),
    holes = [];
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * f.len) / count;
    for (const [y, h] of [
      [2.2, 2.6],
      [6.3, hall ? 2.2 : 3.0],
      [hall ? 10.0 : 12.0, hall ? 1.35 : 2.65],
    ])
      holes.push({ x, y, w: hall ? 1.1 : 1.25, h });
  }
  return holes;
}
function regularWall(o, f, top, d, hall) {
  const hs = sashRows(f, hall, d);
  panel(
    o,
    'brick',
    rect(f.len / 2, 1.5, f.len, top - 1.5),
    d ? hs.map((h) => rect(h.x, h.y, h.w, h.h)) : [],
    f,
  );
  for (const h of hs) window(o, f, h, d);
  for (const y of [1.5, 5.3]) block(o, 'trim', f, f.len / 2, y, f.len, 0.22, 0.06, -0.02);
  if (d > 1) strip(o, 'trim', f, f.len / 2, 5.62, f.len, 0.1, 0.03);
}
function thermalFacade(o, f, d) {
  const n = d > 2 ? 20 : d > 1 ? 12 : 6,
    L = f.len,
    x = L * 0.48,
    ar = arch(x, 10.95, L * 0.7, 16.4, 3.95, n),
    top = [
      [0, 19.2],
      [1.2, 19.2],
      [2.8, 21.5],
      [5.0, 21.5],
      [6.1, 22.5],
      [8.1, 22.5],
      [8.9, 23.2],
      [9.6, 23.2],
      [9.6, 21.1],
      [L, 21.1],
    ],
    outer = [[0, 1.5], [L, 1.5], ...top.slice().reverse()],
    hs = [];
  for (let i = 0; i < 4; i++) {
    const xx = x + (i - 1.5) * 1.64;
    for (const [y, h] of [
      [2.2, 2.65],
      [6.4, 1.8],
      [9.4, 1.25],
    ])
      hs.push({ x: xx, y, w: i === 0 || i === 3 ? 1.0 : 1.1, h });
  }
  panel(o, 'brick', outer, d ? [ar, ...hs.map((h) => rect(h.x, h.y, h.w, h.h))] : [], f);
  if (d) {
    reveal(o, 'inset', f, ar, -0.17);
    for (const sg of [-1, 1])
      block(o, 'brick', f, x + sg * L * 0.115, 11.0, 0.24, 8.9, 0.035, -0.17);
    if (d > 1) {
      for (let i = 2; i < ar.length - 1; i++)
        beam(o, 'brick', f.P(...ar[i], 0.04), f.P(...ar[i + 1], 0.04), 0.19, 0.18, C.brick);
    }
  }
  for (const h of hs) window(o, f, h, d);
  for (const y of [1.5, 5.3, 10.77])
    block(o, 'trim', f, f.len / 2, y, f.len, y > 10 ? 0.15 : 0.22, 0.07, -0.02);
  for (let i = 0; i < top.length - 1; i++)
    beam(o, 'trim', f.P(...top[i], 0.08), f.P(...top[i + 1], 0.08), 0.17, 0.23, C.trim);
  if (d > 1)
    for (let i = 1; i < 4; i++) block(o, 'brick', f, x + (i - 2) * 2.0, 2.0, 0.2, 7.0, 0.09, 0.0);
}
function frontWall(o, d) {
  const entry = arch(center, 1.5, 3.55, 3.85, 1.78, d > 1 ? 14 : 6),
    hs = [];
  for (const sg of [-1, 1])
    for (const [y, h] of [
      [2.2, 2.6],
      [6.3, 3],
      [12, 2.65],
    ])
      hs.push({ x: center + sg * 6.7, y, w: 1.25, h });
  panel(
    o,
    'brick',
    [
      [0, 1.5],
      [F.len, 1.5],
      [F.len, 16.5],
      [center + 5.1, 16.5],
      [center + 5.1, 5.7],
      [center - 5.1, 5.7],
      [center - 5.1, 16.5],
      [0, 16.5],
    ],
    [entry, ...(d ? hs.map((h) => rect(h.x, h.y, h.w, h.h)) : [])],
    F,
  );
  for (const h of hs) window(o, F, h, d);
  const back = frame(
    [plan.frontPortion[0][0], frontZ - 2.15],
    [plan.frontPortion[4][0], frontZ - 2.15],
  );
  const rearLights = [];
  for (const y of [7.1, 12.4])
    for (const sg of [-1, 1]) rearLights.push(rect(center + sg * 1.55, y, 1.25, 2.75));
  panel(o, 'brick', rect(center, 5.7, 10.2, 11.7), d ? rearLights : [], back);
  for (const y of [7.1, 12.4])
    for (const sg of [-1, 1]) window(o, back, { x: center + sg * 1.55, y, w: 1.25, h: 2.75 }, d);
  for (const sg of [-1, 1]) {
    const x = center + sg * 5.1;
    Q(o, 'trim', [F.P(x, 5.7), F.P(x, 17.4), back.P(x, 17.4), back.P(x, 5.7)], [-sg, 0, 0]);
  }
  reveal(o, 'glass', F, entry, -0.7);
  if (d > 1) {
    for (let i = 2; i < entry.length - 1; i++)
      beam(o, 'trim', F.P(...entry[i], 0.065), F.P(...entry[i + 1], 0.065), 0.28, 0.25, C.trim);
    strip(o, 'trim', F, center, 1.5, 0.07, 3.1, -0.6);
    for (const sg of [-1, 1]) block(o, 'trim', F, center + sg * 1.91, 1.5, 0.27, 2.35, 0.13, -0.05);
  }
  for (const y of [1.5, 5.3]) block(o, 'trim', F, center, y, F.len, 0.24, 0.08, -0.02);
  block(o, 'trim', F, center, 5.25, 8.7, 0.6, 0.14, -0.03);
}
function frontHip(o, d) {
  const xs = frontR.map((p) => p[0]),
    x0 = Math.min(...xs) - 0.36,
    x1 = Math.max(...xs) + 0.36,
    z0 = 2.66,
    z1 = frontZ + 0.36,
    y = 16.7,
    cy = (z0 + z1) / 2,
    a = [cx - 2.9, 19.35, cy],
    b = [cx + 2.9, 19.35, cy],
    p = [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ];
  Q(o, 'roof', [p[0], p[1], b, a], [0, 1, 0]);
  tri(o, 'roof', [p[1], p[2], b], [0, 1, 0]);
  Q(o, 'roof', [p[2], p[3], a, b], [0, 1, 0]);
  tri(o, 'roof', [p[3], p[0], a], [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const f = frame([p[i][0], p[i][2]], [p[(i + 1) % 4][0], p[(i + 1) % 4][2]]);
    block(o, 'trim', f, f.len / 2, 16.1, f.len, 0.6, 0.12, -0.1);
    if (d > 1) {
      const count = Math.ceil(f.len / 0.8);
      for (let j = 0; j < count; j++)
        block(o, 'trim', f, ((j + 0.5) * f.len) / count, 15.96, 0.16, 0.18, 0.04, -0.32);
    }
  }
  box(o, 'brick', [cx - 2.4, 18.1, 6.3], [cx - 1.0, 20.45, 7.55], C.brick);
  box(o, 'metal', [cx - 2.53, 20.45, 6.17], [cx - 0.87, 20.62, 7.68], C.metal);
  if (d > 1) {
    beam(o, 'roof', a, b, 0.18, 0.18, C.roof);
    for (let i = 0; i < 4; i++)
      beam(o, 'roof', p[i], i < 2 ? (i === 0 ? a : b) : i === 2 ? b : a, 0.12, 0.12, C.roof);
  }
}
function hallRoof(o, d) {
  const mid = 1.5,
    lo = -7.15,
    hi = 10.15,
    top = (p) => 19.2 + 3.0 * (1 - Math.abs(p[0] - mid) / (p[0] < mid ? mid - lo : hi - mid));
  for (const left of [true, false]) {
    const r = clip(hallR, 0, mid, left),
      ix = earcut(r.flat());
    for (let j = 0; j < ix.length; j += 3)
      tri(
        o,
        'roof',
        ix.slice(j, j + 3).map((k) => [r[k][0], top(r[k]), r[k][1]]),
        [0, 1, 0],
      );
  }
  const frontPoints = hallR.filter((p) => Math.abs(p[1] - 3) < 0.001).sort((a, b) => a[0] - b[0]);
  const frontFace = frame(frontPoints[0], frontPoints[frontPoints.length - 1]);
  strip(o, 'brick', frontFace, frontFace.len / 2, 16.5, frontFace.len, 2.7);
  // Close every original roof rim to its wall, splitting edges at the ridge.
  for (let i = 0; i < hallR.length; i++) {
    const a = hallR[i],
      b = hallR[(i + 1) % hallR.length],
      points = [a];
    if ((a[0] - mid) * (b[0] - mid) < 0) {
      const t = (mid - a[0]) / (b[0] - a[0]);
      points.push([mid, a[1] + (b[1] - a[1]) * t]);
    }
    points.push(b);
    for (let j = 0; j < points.length - 1; j++) {
      const q = points[j],
        r = points[j + 1],
        f = frame(q, r);
      Q(
        o,
        'brick',
        [
          [q[0], 19.2, q[1]],
          [r[0], 19.2, r[1]],
          [r[0], top(r), r[1]],
          [q[0], top(q), q[1]],
        ],
        f.n,
      );
    }
  }
  beam(o, 'roof', [mid, 22.2, -25], [mid, 22.2, 3], d > 1 ? 0.17 : 0.1, 0.15, C.roof);
  if (d > 1) {
    box(o, 'metal', [4.8, 20.45, -18.7], [6.0, 20.7, -17.6], C.metal);
  }
}
function ionic(o, x, d) {
  const z = frontZ + 0.08,
    sides = d > 2 ? 20 : d > 1 ? 12 : 6;
  profile(
    o,
    [
      [5.7, 0.66],
      [5.87, 0.66],
      [5.94, 0.56],
      [6.13, 0.56],
      [6.24, 0.47],
      [15.95, 0.42],
      [16.05, 0.55],
      [16.22, 0.55],
    ],
    sides,
    [x, z],
  );
  box(o, 'trim', [x - 0.68, 16.3, z - 0.57], [x + 0.68, 16.68, z + 0.57], C.trim);
  box(o, 'trim', [x - 0.75, 16.68, z - 0.65], [x + 0.75, 16.93, z + 0.65], C.trim);
  if (!d) return;
  for (const sg of [-1, 1]) {
    const count = d > 2 ? 24 : d > 1 ? 12 : 5;
    let prev;
    for (let i = 0; i <= count; i++) {
      const a = -Math.PI * 0.25 + (i / count) * Math.PI * 3.5,
        r = 0.29 * (1 - (i / count) * 0.78),
        p = [x + sg * 0.52 + Math.cos(a) * r, 16.34 + Math.sin(a) * r, z + 0.6];
      if (prev) beam(o, 'trim', prev, p, 0.09, 0.09, C.trim);
      prev = p;
    }
  }
}
function balustrade(o, d) {
  const z = frontZ + 0.1;
  for (const y of [5.7, 11.1])
    box(o, 'trim', [cx - 5.15, y, frontZ - 2.2], [cx + 5.15, y + 0.2, z + 0.28], C.trim);
  for (const x of [cx - 2.65, cx + 2.65])
    box(o, 'trim', [x - 0.35, 5.9, z - 0.16], [x + 0.35, 6.98, z + 0.22], C.trim);
  for (const y of [5.95, 6.86])
    box(o, 'trim', [cx - 2.45, y, z - 0.12], [cx + 2.45, y + 0.15, z + 0.19], C.trim);
  const n = d > 2 ? 10 : d > 1 ? 7 : 4;
  for (let i = 0; i < n; i++)
    profile(
      o,
      [
        [6.1, 0.12],
        [6.2, 0.12],
        [6.35, 0.18],
        [6.48, 0.11],
        [6.72, 0.08],
        [6.86, 0.12],
      ],
      d > 2 ? 10 : 6,
      [cx - 2.15 + (i * 4.3) / (n - 1), z + 0.035],
    );
  for (const y of [11.34, 12.02])
    beam(o, 'metal', [cx - 3, y, z + 0.03], [cx + 3, y, z + 0.03], 0.07, 0.07, C.metal);
  const bars = d > 2 ? 18 : d > 1 ? 12 : 5;
  for (let i = 0; i <= bars; i++)
    beam(
      o,
      'metal',
      [cx - 3 + (i * 6) / bars, 11.34, z + 0.03],
      [cx - 3 + (i * 6) / bars, 12.02, z + 0.03],
      0.055,
      0.055,
      C.metal,
    );
}
function portico(o, d) {
  for (const x of [-4.3, -3, 3, 4.3]) ionic(o, cx + x, d);
  balustrade(o, d);
  for (const [y, h, w, deep] of [
    [16.93, 0.3, 11.3, 0.82],
    [17.23, 0.75, 11.15, 0.75],
    [17.98, 0.26, 11.65, 0.94],
    [18.24, 0.32, 12.0, 1.1],
    [18.56, 0.55, 11.3, 0.76],
    [19.11, 0.2, 11.7, 0.94],
  ]) {
    block(o, 'trim', F, center, y, w, h, deep, -2.35);
    const r = rect(center, y, w, h).map((p) => F.P(...p, -2.35));
    Q(
      o,
      'trim',
      r,
      F.n.map((v) => -v),
    );
  }
  if (d > 1)
    for (let i = 0; i < 19; i++)
      block(o, 'trim', F, center + (i - 9) * 0.57, 17.05, 0.25, 0.25, 0.9, 0.72);
  const count = d > 1 ? 7 : 3;
  for (let i = 0; i < count; i++) {
    const depth = 2.0 - (i * 2.0) / count;
    box(
      o,
      'trim',
      [cx - 2.25, (i / count) * 1.5, frontZ + 0.15],
      [cx + 2.25, ((i + 1) / count) * 1.5, frontZ + 0.15 + depth],
      C.trim,
    );
  }
  if (d > 0)
    for (const sg of [-1, 1])
      beam(
        o,
        'metal',
        [cx + sg * 2.08, 2.15, frontZ + 0.25],
        [cx + sg * 2.08, 0.8, frontZ + 2.15],
        0.075,
        0.075,
        C.metal,
      );
}
function walls(o, d) {
  for (const [ring, hall] of [
    [frontR, false],
    [hallR, true],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        f = frame(a, b);
      if (!hall && Math.abs(a[1] - frontZ) < 0.01 && Math.abs(b[1] - frontZ) < 0.01) {
        frontWall(o, d);
        continue;
      }
      if (Math.abs(a[1] - 3) < 0.01 && Math.abs(b[1] - 3) < 0.01) continue;
      if (hall && f.n[0] < -0.97 && Math.min(a[1], b[1]) > -9.3 && f.len > 10) {
        thermalFacade(o, f, d);
        continue;
      }
      regularWall(o, f, hall ? 19.2 : 16.5, d, hall);
      if (hall) block(o, 'trim', f, f.len / 2, 19.0, f.len, 0.2, 0.08, -0.015);
    }
}
function skyline(o) {
  prism(o, 'stone', plan.outline, -0.4, 1.5);
  for (const [r, top] of [
    [frontR, 16.5],
    [hallR, 19.2],
  ])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        f = frame(a, b);
      if (Math.abs(a[1] - 3) < 0.01 && Math.abs(b[1] - 3) < 0.01) continue;
      if (Math.abs(a[1] - frontZ) < 0.01 && Math.abs(b[1] - frontZ) < 0.01) {
        frontWall(o, 0);
        continue;
      }
      strip(o, 'brick', f, f.len / 2, 1.5, f.len, top - 1.5);
    }
  frontHip(o, 0);
  hallRoof(o, 0);
  for (const x of [-4.3, -3, 3, 4.3]) {
    profile(
      o,
      [
        [5.7, 0.62],
        [6.0, 0.5],
        [16.4, 0.43],
        [16.6, 0.62],
      ],
      6,
      [cx + x, frontZ + 0.08],
    );
    box(
      o,
      'trim',
      [cx + x - 0.73, 16.6, frontZ - 0.5],
      [cx + x + 0.73, 16.93, frontZ + 0.66],
      C.trim,
    );
  }
  for (const [y, h, w] of [
    [5.7, 0.25, 10.3],
    [11.1, 0.2, 10.3],
    [16.93, 0.75, 11.3],
    [17.68, 0.9, 12],
    [18.58, 0.7, 11.7],
  ])
    block(o, 'trim', F, center, y, w, h, 0.9, -2.2);
  const north = frame(plan.frontPortion[1], [-7.1, 3]),
    top = [
      [0, 19.15],
      [1.2, 19.15],
      [2.8, 21.5],
      [5, 21.5],
      [6.1, 22.5],
      [8.1, 22.5],
      [8.9, 23.2],
      [9.6, 23.2],
      [9.6, 21.1],
      [north.len, 21.1],
    ];
  panel(o, 'brick', [[0, 19.1], [north.len, 19.1], ...top.slice().reverse()], [], north);
  box(o, 'trim', [cx - 2.25, 0, frontZ], [cx + 2.25, 1.5, frontZ + 2.15], C.trim);
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  prism(o, 'stone', plan.outline, -0.4, 1.5);
  walls(o, d);
  frontHip(o, d);
  hallRoof(o, d);
  portico(o, d);
}
export const ashevilleSkyline = (o, f) => build(o, f, 0);
export const ashevilleDistrict = (o, f) => build(o, f, 1);
export const ashevilleStreet = (o, f) => build(o, f, 2);
export const ashevilleModel = {
  id: 'asheville_masonic_temple',
  key: 'asheville_masonic_temple',
  recipe: 'structure-asheville-masonic-temple.mjs',
  cell: 'dn/dnm',
  title: 'Asheville Masonic Temple',
  category: 'religious',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete80BroadwayTemple and intrinsic connected rear hall, full original touching native plans: pressed redbrick/darkgranitebase/pale dressed sash and bands, genuinely recessed west two-story paired Ionic portico/lowerstonebalusters/uppermetalrail, recessed arched closed entry/ownsteps, bracketed front redtile hip roof/chimney, rearhall gable roof and shaped Woodfin parapet/three tall blind thermal recesses. No neighbors/site/interiors/lettering.',
  camera: [-47, 35, 60],
  lookAt: [1, 9, -4],
  portableGroundY: -0.45,
  mediumFiContext: { scale: 1.35, groundY: -0.45 },
  qaCameras: [
    {
      name: 'broadway-paired-ionic-columns-open-two-level-loggia-and-arched-entry',
      position: [-18, 13, 35],
      lookAt: [cx, 10, frontZ],
    },
    {
      name: 'woodfin-blind-thermal-recesses-shaped-parapet-and-dressed-sash',
      position: [-34, 15, -9],
      lookAt: [-6, 12, -3],
    },
    {
      name: 'front-hip-roof-chimney-and-connected-gabled-rear-hall',
      position: [-29, 38, -35],
      lookAt: [1, 13, -6],
    },
    {
      name: 'whole-south-rear-plan-and-granite-basement',
      position: [35, 21, -40],
      lookAt: [2, 9, -6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent160mfield frozen before geometry at fixed westentry approach; exact basement/steps/threshold and hostcontact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-asheville-masonic-temple.mjs',
    level: 'skyline',
    export: 'ashevilleSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'ashevilleDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'ashevilleStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete west Temple/front and intrinsic connected east hall; original5/4vertexnativeplans and sevenvertexunion retained in foundation. Three CC0exteriors and primary historic district text establish hipped front roof/gabledhall, four paired Ionic columns, open two-level portico, dark granitebase, dressed sash/bands and shaped Woodfin blind thermal field. Geometry heights, precise roof partitions/window census/volute profiles/balusters and concealed south/east elevations remain bounded estimates. Skyline uses simplified portico recess/columns/parapet and rearroof; nearlevels add true window/loggia recesses, scroll capitals, balusters, sash, arch reveals and brackets.',
    'Front upper portico is recessed2.15m with closed back glazing, lowerstonebalustrade and uppermetalrail. Lower entry arch closes at inset door. Woodfin tall arch field is blind brick with shallow recess and two dividing piers, not transparent glazing. Rear roof and south/east windows are inferred where hidden; no interiors, text or Masonic artwork.',
    'Only three exact already-cleared published WarrenLeMayCC0Qualla exteriors from2019, native original SHA1/source author/explicitcc-zero matched. Primary operator and historic district architectural text facts only; their images/drawings unused. Shared procedural brick/granite/limestone/ceramictile/paintedmetal and mutedglass, no copied pixels/generatedbitmap.',
    'No adjacent buildings, street/sidewalk/site slab/landscape/trees/signals/people/cars/lampposts/flags. Original independent160mterrain/rawtiles/grid/heightPNG frozen before geometry at fixed front approach; no flattening/fitting. Exact basement/stair/sill/host contact and current cosmetic condition unverified; replaceFootprint=false.',
  ],
};

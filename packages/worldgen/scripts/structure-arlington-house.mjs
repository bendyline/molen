/** Complete Arlington House with both connected wings and its intrinsic eight-column east portico. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, profile as radialProfile } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dq/dqc/arlington_house_the_robert_e_lee_memorial/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('cdbb99'),
    trim: rgb('d8c7a7'),
    vein: rgb('bea382'),
    roof: rgb('69716c'),
    wingRoof: rgb('99988a'),
    metal: rgb('777d70'),
    glass: rgb('5e7775'),
    wood: rgb('7d8479'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  vein: { slot: 'trim', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  wingRoof: { slot: 'roof', graph: 'gravel', roughness: 0.99, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.06 },
  wood: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.94, metallic: 0 },
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
function profile(o, layers, sides, center) {
  radialProfile(
    o,
    layers.map(([y, r]) => [y, r, r, 'trim', C.trim]),
    sides,
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
const body = plan.body,
  main = cw([body[0], body[6], body[7], body[13], body[14]]),
  south = cw(body.slice(0, 7)),
  north = cw(body.slice(7, 14)),
  frontZ = plan.frontZ,
  cx = (plan.portico[1][0] + plan.portico[2][0]) / 2,
  sideX = [plan.portico[1][0] + 1.1, plan.portico[2][0] - 1.1],
  columnXs = Array.from({ length: 6 }, (_, i) => sideX[0] + (i * (sideX[1] - sideX[0])) / 5),
  frontColumnsZ = frontZ - 0.95,
  backColumnsZ = 9.4;
const arch = (x, lo, w, spring, rise, n) => [
  [x - w / 2, lo],
  [x + w / 2, lo],
  ...Array.from({ length: n + 1 }, (_, i) => [
    x + (Math.cos((i / n) * Math.PI) * w) / 2,
    spring + Math.sin((i / n) * Math.PI) * rise,
  ]),
];
function opening(o, f, h, d) {
  const r = h.arch
    ? arch(h.x, h.y, h.w, h.spring, h.w / 2, d > 2 ? 18 : d > 1 ? 12 : 6)
    : rect(h.x, h.y, h.w, h.h);
  if (!d) {
    panel(o, h.door ? 'wood' : 'glass', r, [], f, 0.016);
    return;
  }
  reveal(o, h.door ? 'wood' : 'glass', f, r, -0.22);
  if (d === 1) {
    strip(o, 'trim', f, h.x, h.y - 0.1, h.w + 0.24, 0.13, 0.08);
    return;
  }
  block(o, 'trim', f, h.x, h.y - 0.12, h.w + 0.32, 0.16, 0.16, -0.025);
  if (h.arch) {
    for (let i = 2; i < r.length - 1; i++)
      beam(o, 'trim', f.P(...r[i], 0.035), f.P(...r[i + 1], 0.035), 0.13, 0.12, C.trim);
    for (const sg of [-1, 1])
      block(o, 'trim', f, h.x + sg * (h.w / 2 + 0.04), h.y, 0.1, h.spring - h.y, 0.04, -0.12);
    const fan = arch(h.x, h.spring - 0.05, h.w * 1.72, h.spring + 0.0, h.w * 0.86, d > 2 ? 16 : 10);
    for (let i = 2; i < fan.length - 1; i++)
      beam(o, 'trim', f.P(...fan[i], 0.018), f.P(...fan[i + 1], 0.018), 0.12, 0.08, C.trim);
    if (d > 2)
      for (let i = 0; i <= 8; i++) {
        const a = (i * Math.PI) / 8;
        beam(
          o,
          'trim',
          f.P(h.x + Math.cos(a) * h.w * 0.56, h.spring + Math.sin(a) * h.w * 0.56, 0.02),
          f.P(h.x + Math.cos(a) * h.w * 0.82, h.spring + Math.sin(a) * h.w * 0.82, 0.02),
          0.035,
          0.03,
          C.trim,
        );
      }
  } else {
    for (const sg of [-1, 1])
      block(o, 'trim', f, h.x + sg * (h.w / 2 + 0.06), h.y, 0.12, h.h, 0.045, -0.12);
    block(o, 'trim', f, h.x, h.y + h.h, h.w + 0.3, 0.22, 0.12, -0.01);
  }
  if (h.door) {
    strip(o, 'trim', f, h.x, h.y, 0.07, h.h, -0.15);
    if (d > 2)
      for (const sg of [-1, 1])
        block(o, 'wood', f, h.x + sg * h.w * 0.24, h.y + 0.25, h.w * 0.37, h.h * 0.6, -0.14, -0.22);
    return;
  }
  strip(o, 'trim', f, h.x, h.y, h.arch ? 0.055 : 0.05, h.arch ? h.spring - h.y : h.h, -0.14);
  const height = h.arch ? h.spring - h.y : h.h;
  for (let i = 1; i < (d > 2 ? 4 : 3); i++)
    strip(o, 'trim', f, h.x, h.y + (height * i) / (d > 2 ? 4 : 3), h.w, 0.045, -0.14);
  if (h.arch) {
    for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4])
      beam(
        o,
        'trim',
        f.P(h.x, h.spring, -0.14),
        f.P(h.x + (Math.cos(a) * h.w) / 2, h.spring + (Math.sin(a) * h.w) / 2, -0.14),
        0.035,
        0.035,
        C.trim,
      );
  } else if (d > 2)
    for (const sg of [-1, 1]) strip(o, 'trim', f, h.x + (sg * h.w) / 3, h.y, 0.035, h.h, -0.14);
}
function facade(o, s, f, lo, hi, hs, d) {
  panel(
    o,
    s,
    rect(f.len / 2, lo, f.len, hi - lo),
    d
      ? hs.map((h) =>
          h.arch
            ? arch(h.x, h.y, h.w, h.spring, h.w / 2, d > 2 ? 18 : d > 1 ? 12 : 6)
            : rect(h.x, h.y, h.w, h.h),
        )
      : [],
    f,
  );
  for (const h of hs) opening(o, f, h, d);
  if (d > 1) {
    for (const y of [0.65, 4.4])
      if (y < hi - 0.1) strip(o, 'trim', f, f.len / 2, y, f.len, 0.09, 0.02);
    if (d > 2) {
      const rows = Math.floor((hi - lo) / 0.58);
      for (let j = 1; j < rows; j++) {
        const y = lo + j * 0.58;
        const cuts = hs
          .filter((h) => y > h.y && y < (h.arch ? h.spring + h.w / 2 : h.y + h.h))
          .map((h) => {
            const half =
              h.arch && y > h.spring
                ? Math.sqrt(Math.max(0, (h.w * h.w) / 4 - (y - h.spring) * (y - h.spring)))
                : h.w / 2;
            return [h.x - half - 0.02, h.x + half + 0.02];
          })
          .sort((a, b) => a[0] - b[0]);
        let cursor = 0;
        for (const [a, b] of [...cuts, [f.len, f.len]]) {
          if (a > cursor + 0.02) strip(o, 'trim', f, (cursor + a) / 2, y, a - cursor, 0.018, 0.012);
          cursor = Math.max(cursor, b);
        }
      }
    }
  }
}
function mainWalls(o, d) {
  const walls = cw([body[0], body[6], body[7], body[13]]);
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i],
      b = walls[(i + 1) % walls.length],
      f = frame(a, b),
      hs = [],
      count = f.len > 8 ? 5 : 0;
    if (count)
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * f.len) / count;
        hs.push({
          x,
          y: 0.95,
          w: j === 2 && f.n[2] > 0.9 ? 1.7 : 1.12,
          h: 2.65,
          door: j === 2 && f.n[2] > 0.9,
        });
        hs.push({ x, y: 5.0, w: 1.13, h: 1.8 });
      }
    facade(o, 'wall', f, 0.6, 8.85, hs, d);
    if (d > 0) block(o, 'trim', f, f.len / 2, 8.52, f.len, 0.33, 0.14, -0.06);
  }
}
function wingWalls(o, r, d) {
  const front = cw(clip(r, 1, -0.7, false)),
    back = cw(clip(r, 1, -0.7));
  for (const [ring, top, serv] of [
    [front, 4.55, false],
    [back, 3.22, true],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        f = frame(a, b);
      if (Math.abs(a[1] + 0.7) < 0.01 && Math.abs(b[1] + 0.7) < 0.01) {
        if (!serv) strip(o, 'wall', f, f.len / 2, 3.2, f.len, 1.35);
        continue;
      }
      const inner = Math.max(Math.abs(a[0]), Math.abs(b[0])) < 10.5;
      if (inner) continue;
      const count =
          f.len > 5
            ? !serv && f.n[2] > 0.9
              ? 2
              : Math.max(1, Math.round(f.len / (serv ? 3.4 : 4.5)))
            : 0,
        hs = Array.from({ length: count }, (_, j) => ({
          x: ((j + 0.5) * f.len) / count,
          y: serv ? 0.75 : 0.85,
          w: serv ? 1.0 : 1.38,
          h: serv ? 1.65 : 2.0,
          arch: !serv,
          spring: 2.85,
        }));
      facade(o, 'wall', f, 0.3, top, hs, d);
      block(o, 'trim', f, f.len / 2, top - 0.15, f.len, 0.17, 0.12, -0.04);
    }
  cap(o, 'wingRoof', front, 4.6);
  cap(o, 'wingRoof', back, 3.3);
  for (const [ring, y] of [
    [front, 4.6],
    [back, 3.3],
  ])
    for (let i = 0; i < ring.length; i++) {
      const f = frame(ring[i], ring[(i + 1) % ring.length]);
      if (f.len > 2) block(o, 'trim', f, f.len / 2, y - 0.1, f.len, 0.17, 0.16, -0.08);
    }
}
function pitchedRoof(o, r, eave, ridge, s, d, frontPediment = false) {
  const xmin = Math.min(...r.map((p) => p[0])),
    xmax = Math.max(...r.map((p) => p[0])),
    mid = (xmin + xmax) / 2,
    top = (p) =>
      eave + (ridge - eave) * (1 - Math.abs(p[0] - mid) / (p[0] < mid ? mid - xmin : xmax - mid));
  for (const sg of [true, false]) {
    const half = clip(r, 0, mid, sg),
      ix = earcut(half.flat());
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((k) => [half[k][0], top(half[k]), half[k][1]]),
        [0, 1, 0],
      );
  }
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = frame(a, b),
      pts = [a];
    if ((a[0] - mid) * (b[0] - mid) < 0) {
      const t = (mid - a[0]) / (b[0] - a[0]);
      pts.push([mid, a[1] + (b[1] - a[1]) * t]);
    }
    pts.push(b);
    for (let j = 0; j < pts.length - 1; j++) {
      const q = pts[j],
        v = pts[j + 1],
        fq = frame(q, v),
        h0 = top(q),
        h1 = top(v);
      if (Math.abs(h0 - (eave - 0.12)) + Math.abs(h1 - (eave - 0.12)) > 0.0001) {
        const ps = [
          [q[0], eave - 0.12, q[1]],
          [v[0], eave - 0.12, v[1]],
          [v[0], h1, v[1]],
          [q[0], h0, q[1]],
        ];
        if (Math.abs(h0 - (eave - 0.12)) < 1e-8) tri(o, 'wall', [ps[0], ps[1], ps[2]], fq.n);
        else if (Math.abs(h1 - (eave - 0.12)) < 1e-8) tri(o, 'wall', [ps[0], ps[1], ps[3]], fq.n);
        else Q(o, 'wall', ps, fq.n);
      }
      if (d > 1 && (!frontPediment || f.n[2] < 0.9))
        beam(o, 'trim', [q[0], h0 + 0.03, q[1]], [v[0], h1 + 0.03, v[1]], 0.12, 0.15, C.trim);
    }
    if (d > 0 && !frontPediment)
      block(o, 'trim', f, f.len / 2, eave - 0.05, f.len, 0.13, 0.12, -0.04);
  }
  if (d > 1)
    beam(
      o,
      s,
      [mid, ridge, Math.min(...r.map((p) => p[1]))],
      [mid, ridge, Math.max(...r.map((p) => p[1]))],
      0.12,
      0.12,
      C[s],
    );
}
function doric(o, x, z, d) {
  const sides = d > 2 ? 32 : d > 1 ? 20 : d ? 12 : 6,
    layers =
      d === 0
        ? [
            [0.6, 0.762],
            [7.05, 0.63],
            [7.32, 0.83],
          ]
        : [
            [0.6, 0.762],
            [0.72, 0.762],
            [6.72, 0.65],
            [7.02, 0.63],
            [7.09, 0.7],
            [7.17, 0.76],
            [7.32, 0.86],
            [7.4, 0.87],
          ];
  profile(o, layers, sides, [x, z]);
  box(o, 'trim', [x - 0.92, 7.4, z - 0.92], [x + 0.92, 7.6104, z + 0.92], C.trim);
  if (d > 1) {
    const n = d > 2 ? 24 : 16,
      bands = d > 2 ? 3 : 2;
    for (let k = 0; k < bands; k++)
      for (let i = 0; i < n; i++) {
        const points = [];
        for (const [j, offset] of [
          [i, -0.021],
          [i + 1, -0.021],
          [i + 1, 0.021],
          [i, 0.021],
        ]) {
          const t = (j / n) * Math.PI * 2,
            y =
              1.85 +
              k * 1.45 +
              Math.sin(t + x * 0.045) * 0.58 +
              Math.sin(t * 2 + 0.6) * 0.14 +
              offset,
            r = 0.762 - ((y - 0.72) / 6) * 0.112 + 0.008;
          points.push([x + Math.cos(t) * r, y, z + Math.sin(t) * r]);
        }
        const t = ((i + 0.5) / n) * Math.PI * 2;
        Q(o, 'vein', points, [Math.cos(t), 0, Math.sin(t)]);
      }
  }
  if (d > 2) {
    for (const y of [2.2, 4.2, 6.2]) {
      const radius = 0.762 - ((y - 0.6) / 6.42) * 0.132;
      profile(
        o,
        [
          [y - 0.012, radius + 0.006],
          [y + 0.012, radius + 0.006],
        ],
        sides,
        [x, z],
      );
    }
  }
}
function portico(o, d) {
  prism(o, 'trim', plan.portico, 0.15, 0.6);
  cap(o, 'trim', plan.portico, 7.6104, false);
  for (const x of columnXs) doric(o, x, frontColumnsZ, d);
  for (const x of sideX) doric(o, x, backColumnsZ, d);
  const xmin = plan.portico[1][0],
    xmax = plan.portico[2][0],
    left = frame([xmin, 7.1], [xmin, frontZ]),
    right = frame([xmax, frontZ], [xmax, 7.1]),
    front = frame([xmin, frontZ], [xmax, frontZ]),
    w = xmax - xmin;
  for (const f of [front, left, right]) {
    for (const [y, h, dep] of [
      [7.6104, 0.23, 0.12],
      [7.8404, 0.7, 0.08],
      [8.5404, 0.18, 0.25],
      [8.7204, 0.22, 0.33],
    ])
      block(o, 'trim', f, f.len / 2, y, f.len, h, dep, -0.65);
    if (d > 1) {
      const count = Math.max(2, Math.round(f.len / 1.25));
      for (let j = 0; j <= count; j++) {
        const x = (j * f.len) / count;
        block(o, 'trim', f, x, 7.96, 0.28, 0.47, 0.115, 0.04);
        if (d > 2)
          for (const sg of [-1, 0, 1]) strip(o, 'wall', f, x + sg * 0.08, 8.0, 0.028, 0.39, 0.122);
      }
      if (d > 2)
        for (let j = 0; j < count * 2; j++)
          block(o, 'trim', f, ((j + 0.5) * f.len) / (count * 2), 8.62, 0.12, 0.12, 0.3, 0.18);
    }
  }
  pitchedRoof(o, plan.portico, 8.9404, 11.5, 'roof', d, true);
  const ped = [
    [0, 8.9404],
    [w, 8.9404],
    [w / 2, 11.5],
  ];
  panel(o, 'trim', ped, [], front, 0.05);
  if (d > 0) {
    for (let i = 0; i < 3; i++) {
      const a = ped[i],
        b = ped[(i + 1) % 3];
      beam(o, 'trim', front.P(...a, 0.14), front.P(...b, 0.14), d > 1 ? 0.22 : 0.16, 0.2, C.trim);
    }
    if (d > 1) {
      const inset = [
        [0.85, 9.15],
        [w - 0.85, 9.15],
        [w / 2, 11.16],
      ];
      panel(o, 'wall', inset, [], front, 0.075);
    }
  }
  const count = d > 1 ? 4 : 2;
  for (let j = 0; j < count; j++)
    box(
      o,
      'trim',
      [xmin - 0.15, (j * 0.6) / count, frontZ],
      [xmax + 0.15, ((j + 1) * 0.6) / count, frontZ + 1.2 - (j * 1.2) / count],
      C.trim,
    );
  if (d > 1)
    for (const sg of [-1, 1])
      beam(
        o,
        'metal',
        [cx + sg * 6.6, 1.45, frontZ - 0.05],
        [cx + sg * 6.6, 0.9, frontZ + 1.2],
        0.055,
        0.055,
        C.metal,
      );
}
function chimneys(o, d) {
  for (const x of [-5.6, 5.9]) {
    box(o, 'wall', [x - 0.62, 9.4, -4.7], [x + 0.62, 12.8, -3.55], C.wall);
    box(o, 'trim', [x - 0.74, 12.8, -4.82], [x + 0.74, 12.98, -3.43], C.trim);
    if (d > 1) box(o, 'metal', [x - 0.42, 12.98, -4.58], [x + 0.42, 13.03, -3.67], C.metal);
  }
  for (const sg of [-1, 1]) {
    const x = sg * 20.7;
    box(o, 'wall', [x - 0.6, 3.3, -3.8], [x + 0.6, 6.1, -2.8], C.wall);
    box(o, 'trim', [x - 0.73, 6.1, -3.93], [x + 0.73, 6.28, -2.67], C.trim);
  }
}
function skyline(o) {
  prism(o, 'wall', body, -0.35, 0.6);
  prism(o, 'wall', main, 0.6, 8.85);
  for (const r of [south, north]) {
    const front = clip(r, 1, -0.7, false),
      back = clip(r, 1, -0.7);
    prism(o, 'wall', front, 0.3, 4.6);
    prism(o, 'wall', back, 0.3, 3.3);
  }
  pitchedRoof(o, main, 8.94, 11.5, 'roof', 0);
  portico(o, 0);
  chimneys(o, 0);
}
function build(o, _f, d = 3) {
  if (!d) return skyline(o);
  prism(o, 'wall', body, -0.35, 0.6);
  mainWalls(o, d);
  wingWalls(o, south, d);
  wingWalls(o, north, d);
  pitchedRoof(o, main, 8.94, 11.5, 'roof', d);
  portico(o, d);
  chimneys(o, d);
}
export const arlingtonHouseSkyline = (o, f) => build(o, f, 0);
export const arlingtonHouseDistrict = (o, f) => build(o, f, 1);
export const arlingtonHouseStreet = (o, f) => build(o, f, 2);
export const arlingtonHouseModel = {
  id: 'arlington_house_the_robert_e_lee_memorial',
  key: 'arlington_house_the_robert_e_lee_memorial',
  recipe: 'structure-arlington-house.mjs',
  cell: 'dq/dqc',
  title: 'Arlington House, The Robert E. Lee Memorial',
  category: 'historic-residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete named Arlington House central two-story block/northsouthwings/nativewestoffsets plus intrinsic deep east eight-column Doric portico: six front and two return smooth massive tapered columns, open porch/recessed closed entry and upper sash, pale scored faux-sandstone stucco/entablature/pediment/ownlowsteps, tall round-headed winglights/slate central pitch/low gravel wings/lower rear service sections/pale chimneys. No detached quarters/foregroundgrave/cemeteryforecourt/site.',
  camera: [-48, 29, 62],
  lookAt: [0, 4, 1],
  portableGroundY: -0.4,
  mediumFiContext: { scale: 1.2, groundY: -0.4 },
  qaCameras: [
    {
      name: 'east-six-front-two-return-doric-deep-open-portico-and-pediment',
      position: [-25, 12, 37],
      lookAt: [0, 5, 10],
    },
    {
      name: 'north-wing-round-headed-sash-and-plain-low-roof',
      position: [32, 9, 23],
      lookAt: [15, 2.4, 4],
    },
    {
      name: 'deep-portico-recess-closed-front-entry-and-doric-capitals',
      position: [-3, 3.0, 19],
      lookAt: [0, 4.5, 7],
    },
    {
      name: 'whole-west-native-offsets-lower-service-roofs-and-chimneys',
      position: [-36, 23, -35],
      lookAt: [0, 5, -2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent original160mhilltop field frozen before geometry at fixed eastfrontapproach. Exact low stairs/basement/ramp/host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-arlington-house.mjs',
    level: 'skyline',
    export: 'arlingtonHouseSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'arlingtonHouseDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'arlingtonHouseStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete central two-story block and connected lower north/south wings, original15vertexbody/westoffsets and6vertexintrinsic portico/17vertexunion retained. Actual native axis and full native plans are not scaled to rounded NPSdimensions. Eight smooth tapering Doric columns use primary23ftheight/5ftbasediameter and6front+2return census; frontpediment/pale fauxsandstonestucco and tall archedwinglights from exact published NPSfrontphoto. Fine profiles, window census and exact vertical roof/wall sections remain medium-fi estimates.',
    'Main slate pitched roof/low gravel wing roofs supported by NPStext; lower rear service/conservatory partition within native wings is a bounded inference from historic NPSarchitectural text, not a current rear survey. Hidden rear sash, chimney count/positions, modern ramp hardware and finish cosmetics remain estimates. Skyline preserves whole structure/eight-column open porch/stepped roofs/pediment and chimneys with sparse detail; nearlevels add genuine sash recesses, arched winglights/fan relief, Doric capitals/entablature panels, original procedural faux-stone paint ribbons and scored stucco with aperture gaps.',
    'Exact already-cleared published NPS2008Qualla1500x1004frontoriginal only; original SHA1/explicitPD-USGov-NPS/agency photographer-publisher/NPGalleryaccession bound with tested native-release recovery for absent local categories, without editing media metadata. Null-author front image, reportcover composites, conflictedhero/portraits/interiors/historical/unrelated imagery unused. Primary NPSarchitectural text only, its web/document images not adopted; no supplemental images/copied pixels/generatedbitmap. Shared plaster/slate/gravel/paintedmetal/paintedwood and mutedglazing.',
    'No detached north/south quarters/bookstore/neighbor structures, LEnfantgrave/foregroundmonument/cemetery/tombs/forecourt/paths/lawn/trees/people/signage/interiors. Original160mterrain/rawtile/grid/heightPNG unchanged, fixedfrontapproach before geometry; no flattening/fitting. Exact low stairs/threshold/hostterrain contact unverified; replaceFootprint=false.',
  ],
};

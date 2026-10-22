/** Whole Brisbane Synagogue: native envelope and original geometric facade ornament. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r7/r7h/brisbane_synagogue/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  cx = plan.frontCenter[0],
  front = plan.frontCenter[1],
  coreL = cx - 4.25,
  coreR = cx + 4.25,
  left = plan.outline[5][0],
  right = plan.outline[4][0];
const C = {
  wall: rgb('d2d5c8'),
  trim: rgb('c5cbbb'),
  roof: rgb('7b857c'),
  spire: rgb('5e6c65'),
  glass: rgb('425851'),
  door: rgb('777d6d'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.94, metallic: 0.12 },
  spire: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.2 },
  glass: { slot: 'window', localRef: ref, roughness: 0.65, metallic: 0 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
};
function tri(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  // Earcut can emit a collinear bridge between coarse rose-window rings.
  // Its area is exactly zero after Float32 conversion; it contributes no surface.
  if (normalFor(...p).every((v) => v === 0)) return;
  if (n && normalFor(...p).reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - p[1] * r[(i + 1) % r.length][0], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ],
  circle = (x, y, r, n) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      y + r * Math.sin((i * 2 * Math.PI) / n),
    ]);
function F(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = b.map((v, i) => (v - a[i]) / len),
    n = [-u[1], 0, u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
const facade = { n: [0, 0, 1], P: (x, y, z = 0) => [cx + x, y, front + z] };
function panel(o, s, r, f, z = 0, holes = []) {
  const all = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
function reveal(o, s, r, f, a, b) {
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    Q(o, s, [f.P(...p, a), f.P(...q, a), f.P(...q, b), f.P(...p, b)]);
  }
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix
        .slice(i, i + 3)
        .map((k) => [r[k][0], typeof y === 'function' ? y(r[k][0], r[k][1]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function box(o, s, x0, x1, y0, y1, z0, z1) {
  const r = cw([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]);
    panel(o, s, rect(f.len / 2, y0, f.len, y1 - y0), f);
  }
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + r * Math.cos(a), spring + r * Math.sin(a)];
    }),
  ];
}
function ring(o, f, x, y, r, w, z, d, s = 'trim', n = d > 2 ? 32 : d > 1 ? 20 : d ? 12 : 6) {
  const outer = circle(x, y, r + w / 2, n),
    inner = circle(x, y, r - w / 2, n);
  panel(o, s, outer, f, z, [inner]);
  if (d > 1) {
    reveal(o, s, outer, f, z, z - 0.045);
    reveal(o, s, inner, f, z - 0.045, z);
  }
}
function curvedBand(o, f, x, spring, r, w, lo, hi, z, d, s = 'trim') {
  const n = d > 2 ? 32 : d > 1 ? 20 : d ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      P = (a, r) => f.P(x + r * Math.cos(a), spring + r * Math.sin(a), z);
    Q(o, s, [P(a, r - w / 2), P(b, r - w / 2), P(b, r + w / 2), P(a, r + w / 2)], f.n);
  }
  for (const xx of [x - r, x + r]) panel(o, s, rect(xx, lo, w, hi - lo), f, z);
}
function recess(o, s, hole, f, depth, d) {
  if (d > 1) {
    reveal(o, 'wall', hole, f, 0, -depth);
    panel(o, s, hole, f, -depth);
  } else panel(o, s, hole, f, 0.012);
}
function clip(r, edge, keepLess) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = (p) => (keepLess ? p[0] <= edge : p[0] >= edge),
      ia = inside(a),
      ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (edge - a[0]) / (b[0] - a[0]);
      out.push([edge, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
function between(r, l, h) {
  return clip(clip(r, l, false), h, true);
}
const roofSide = (x) =>
  x <= coreL
    ? 8.2 - ((coreL - x) * 1.8) / (coreL - left)
    : x >= coreR
      ? 8.2 - ((x - coreR) * 1.8) / (right - coreR)
      : 9.4;
const backZ = (x) =>
  plan.outline[0][1] +
  ((x - plan.outline[0][0]) * (plan.outline[1][1] - plan.outline[0][1])) /
    (plan.outline[1][0] - plan.outline[0][0]);
function body(o, d) {
  const r = cw(plan.outline);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = F(a, b),
      isFront = Math.abs(a[1] - front) < 0.001 && Math.abs(b[1] - front) < 0.001,
      isRear =
        Math.abs(a[1] - plan.outline[0][1]) < 0.001 && Math.abs(b[1] - plan.outline[0][1]) < 0.001;
    if (isFront || isRear) continue;
    const y0 = roofSide(a[0]),
      y1 = roofSide(b[0]),
      holes = [];
    if (f.len > 15)
      for (let k = 1; k <= 5; k++)
        holes.push(arch((k * f.len) / 6, 2.25, 1.05, 2.5, d > 1 ? 10 : 4));
    panel(
      o,
      'wall',
      [
        [0, 0],
        [f.len, 0],
        [f.len, y1],
        [0, y0],
      ],
      f,
      0,
      d > 1 ? holes : [],
    );
    if (d)
      for (const h of holes) {
        recess(o, 'glass', h, f, 0.16, d);
        if (d > 1) {
          const x = (h[0][0] + h[1][0]) / 2;
          curvedBand(o, f, x, 4.225, 0.525, 0.07, 2.25, 4.225, 0.025, d);
          beam(o, 'trim', f.P(x, 2.25, -0.11), f.P(x, 4.5, -0.11), 0.045, 0.045, C.trim);
        }
      }
    if (d)
      beam(o, 'trim', f.P(0, y0 + 0.015, 0.04), f.P(f.len, y1 + 0.015, 0.04), 0.12, 0.14, C.trim);
  }
  // Nave side walls rise above lower aisle roofs. All side/rear census is an explicit estimate.
  for (const x of [coreL, coreR]) {
    const f = x === coreL ? F([x, backZ(x)], [x, front]) : F([x, front], [x, backZ(x)]);
    const holes = Array.from({ length: 6 }, (_, k) =>
      arch(((k + 1) * f.len) / 7, 8.45, 0.55, 0.65, 6),
    );
    panel(o, 'wall', rect(f.len / 2, 6.35, f.len, 3.05), f, 0, d > 1 ? holes : []);
    if (d) for (const h of holes) recess(o, 'glass', h, f, 0.12, d);
  }
  const rf = { n: [0, 0, -1], P: (x, y, z = 0) => [cx + x, y, backZ(cx + x) - z] },
    rearHole = arch(0, 0.12, 1.8, 2.5, d > 1 ? 10 : 4),
    rearShape = [
      [left - cx, 0],
      [plan.outline[1][0] - cx, 0],
      [plan.outline[1][0] - cx, roofSide(plan.outline[1][0])],
      [4.25, 8.2],
      [4.25, 9.4],
      [0, 12.5],
      [-4.25, 9.4],
      [-4.25, 8.2],
      [left - cx, 6.4],
    ];
  panel(o, 'wall', rearShape, rf, 0, d > 1 ? [rearHole] : []);
  if (d) recess(o, 'door', rearHole, rf, 0.15, d);
  cap(o, 'wall', plan.outline, 0);
  cap(o, 'wall', plan.outline, -0.12, false);
  const nave = between(plan.outline, coreL, coreR),
    west = clip(plan.outline, coreL, true),
    east = clip(plan.outline, coreR, false);
  for (const rr of [clip(nave, cx, true), clip(nave, cx, false)])
    cap(o, 'roof', rr, (x) => 12.5 - (Math.abs(x - cx) * 3.1) / 4.25);
  for (const rr of [west, east]) cap(o, 'roof', rr, roofSide);
  if (d) {
    beam(o, 'roof', [cx, 12.54, backZ(cx) - 0.1], [cx, 12.54, front + 0.1], 0.1, 0.12, C.roof);
    for (const x of [coreL, coreR])
      beam(o, 'trim', [x, 9.4, backZ(x)], [x, 9.4, front], 0.13, 0.15, C.trim);
  }
  if (d > 2)
    for (let z = backZ(cx) + 0.8; z < front; z += 1.7)
      for (const x of [coreL, coreR])
        beam(o, 'roof', [x, 9.43, z], [cx, 12.53, z], 0.025, 0.025, C.roof);
}
function frontWall(o, d) {
  const n = d > 2 ? 48 : d > 1 ? 32 : d ? 24 : 12,
    rose = circle(0, 7.1, 2.05, n),
    door = arch(0, 0.12, 4.5, 3.65, d > 2 ? 24 : d > 1 ? 16 : d ? 8 : 6),
    vent = circle(0, 10.75, 0.46, d > 1 ? 20 : d ? 10 : 6),
    sideXs = [(left + coreL) / 2 - cx, (coreR + right) / 2 - cx],
    sideRoses = sideXs.map((x) => circle(x, 4.8, 0.7, d > 1 ? 20 : d ? 10 : 6)),
    shape = [
      [left - cx, 0],
      [right - cx, 0],
      [right - cx, 6.4],
      [4.25, 8.2],
      [4.25, 10.0],
      [0, 12.5],
      [-4.25, 10.0],
      [-4.25, 8.2],
      [left - cx, 6.4],
    ],
    holes = [rose, door, vent, ...sideRoses];
  // Even skyline keeps the main rose and portal as true closed recesses.
  panel(o, 'wall', shape, facade, 0, holes);
  for (const h of holes) {
    reveal(o, 'wall', h, facade, 0, -0.24);
    panel(o, h === door ? 'door' : 'glass', h, facade, -0.24);
  }
  ring(o, facade, 0, 7.1, 2.07, 0.16, 0.07, d);
  ring(o, facade, 0, 10.75, 0.49, 0.11, 0.05, d);
  if (d) {
    for (const x of sideXs) {
      ring(o, facade, x, 4.8, 0.74, 0.13, 0.045, d);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ring(
          o,
          facade,
          x + 0.29 * Math.sin(a),
          4.8 + 0.29 * Math.cos(a),
          0.24,
          0.055,
          -0.08,
          d,
          'trim',
          d > 1 ? 12 : 8,
        );
      }
    }
  }
  // Original circular tracery, no stained-glass photograph or copied artwork.
  const outerCount = d ? 12 : 6,
    nc = d > 2 ? 24 : d > 1 ? 16 : d ? 10 : 6;
  for (let k = 0; k < outerCount; k++) {
    const a = (k * 2 * Math.PI) / outerCount;
    ring(
      o,
      facade,
      1.58 * Math.sin(a),
      7.1 + 1.58 * Math.cos(a),
      0.36,
      d ? 0.065 : 0.09,
      -0.065,
      d,
      'trim',
      nc,
    );
  }
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    ring(
      o,
      facade,
      0.64 * Math.sin(a),
      7.1 + 0.64 * Math.cos(a),
      0.66,
      d ? 0.065 : 0.09,
      -0.07,
      d,
      'trim',
      nc,
    );
  }
  ring(o, facade, 0, 7.1, 0.45, 0.06, -0.06, d, 'trim', nc);
  for (const [r, w, z] of [
    [2.28, 0.13, 0.06],
    [2.48, 0.11, 0.075],
    [2.67, 0.09, 0.025],
  ]) {
    if (!d && r !== 2.48) continue;
    curvedBand(o, facade, 0, 7.1, r, w, 5.0, 7.1, z, d);
  }
  for (const [r, w, z] of [
    [2.3, 0.12, 0.06],
    [2.48, 0.1, 0.04],
    [2.63, 0.1, 0.02],
  ]) {
    if (!d && r !== 2.48) continue;
    curvedBand(o, facade, 0, 1.52, r, w, 0.12, 1.52, z, d);
  }
  if (d) {
    for (const yy of [4.65, 4.93, 9.5, 9.88])
      beam(o, 'trim', facade.P(-4.55, yy, 0.06), facade.P(4.55, yy, 0.06), 0.13, 0.14, C.trim);
    for (const x of [-3.22, 3.22]) ring(o, facade, x, 3.95, 0.24, 0.095, 0.055, d);
    // Stepped gable moulding follows the source's triangular parapet.
    for (const inset of [0, 0.25]) {
      beam(
        o,
        'trim',
        facade.P(-4.25 + inset, 10.0, 0.05),
        facade.P(0, 12.5 - inset * 0.5, 0.05),
        0.085,
        0.1,
        C.trim,
      );
      beam(
        o,
        'trim',
        facade.P(0, 12.5 - inset * 0.5, 0.05),
        facade.P(4.25 - inset, 10.0, 0.05),
        0.085,
        0.1,
        C.trim,
      );
    }
    beam(o, 'trim', facade.P(0, 12.48, 0.02), facade.P(0, 12.88, 0.02), 0.11, 0.11, C.trim);
  }
  if (d > 1) {
    for (let x = -4.12; x < 4.2; x += 0.36)
      ring(o, facade, x, 9.7, 0.14, 0.055, 0.125, d, 'trim', d > 2 ? 12 : 8);
    for (let x = -4.05; x < 4.1; x += 0.22)
      beam(o, 'trim', facade.P(x, 4.7, 0.12), facade.P(x, 4.94, 0.12), 0.075, 0.075, C.trim);
    beam(o, 'trim', facade.P(0, 0.12, -0.17), facade.P(0, 3.63, -0.17), 0.07, 0.07, C.trim);
    for (const yy of [1.25, 2.45])
      beam(o, 'trim', facade.P(-2.0, yy, -0.17), facade.P(2.0, yy, -0.17), 0.06, 0.06, C.trim);
  }
  // Only intrinsic short entrance steps, not a site platform.
  for (let k = 0; k < 2; k++)
    box(o, 'trim', cx - 2.35, cx + 2.35, 0, 0.06 * (k + 1), front, front + 0.7 - k * 0.25);
}
function radial(x, z, r, y, n = 8, offset = Math.PI / 8) {
  return cw(
    Array.from({ length: n }, (_, i) => {
      const a = offset + (i * 2 * Math.PI) / n;
      return [x + r * Math.sin(a), z + r * Math.cos(a)];
    }),
  ).map((p) => [p[0], y, p[1]]);
}
function profile(o, s, x, z, levels, d) {
  const rr = levels.map(([y, r]) => radial(x, z, r, y));
  for (let j = 1; j < rr.length; j++)
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      Q(
        o,
        s,
        [rr[j - 1][i], rr[j - 1][k], rr[j][k], rr[j][i]],
        [rr[j][i][0] + rr[j][k][0] - 2 * x, 0, rr[j][i][2] + rr[j][k][2] - 2 * z],
      );
    }
  for (const [k, up] of [
    [0, false],
    [rr.length - 1, true],
  ])
    if (d || (up && Math.abs(rr[k][0][1] - 11.1) < 0.001))
      cap(
        o,
        s,
        rr[k].map((p) => [p[0], p[2]]),
        rr[k][0][1],
        up,
      );
}
function towers(o, d) {
  for (const x of [cx - 4.6, cx + 4.6]) {
    const z = front - 0.66;
    const lower = cw([
      [x - 0.75, front - 1.45],
      [x + 0.75, front - 1.45],
      [x + 0.75, front + 0.08],
      [x - 0.75, front + 0.08],
    ]);
    for (let i = 0; i < lower.length; i++) {
      const a = lower[i],
        b = lower[(i + 1) % lower.length];
      if (a[1] > front && b[1] > front) continue;
      const f = F(a, b);
      panel(o, 'wall', rect(f.len / 2, 0, f.len, 9.4), f);
    }
    cap(o, 'wall', lower, 0, false);
    cap(o, 'wall', lower, 9.4);
    // Two lower narrow slots are closed recesses in the applied tower face, with bounded unseen lower detail.
    const f = { n: [0, 0, 1], P: (u, y, v = 0) => [x + u, y, front + 0.08 + v] },
      holes = [2.7, 7.0].map((y) => rect(0, y, 0.24, 1.3));
    panel(o, 'wall', rect(0, 0, 1.5, 9.4), f, 0, d > 1 ? holes : []);
    if (d) for (const h of holes) recess(o, 'glass', h, f, 0.065, d);
    for (const [y, w, h] of [
      [1.7, 1.65, 0.14],
      [5.0, 1.7, 0.18],
      [6.65, 1.65, 0.16],
      [9.25, 1.85, 0.25],
    ])
      if (d || y === 5 || y === 9.25)
        box(o, 'trim', x - w / 2, x + w / 2, y, y + h, front - 1.52, front + 0.1);
    profile(
      o,
      'wall',
      x,
      z,
      [
        [9.5, 0.72],
        [10.8, 0.66],
      ],
      d,
    );
    profile(
      o,
      'trim',
      x,
      z,
      d
        ? [
            [10.75, 0.76],
            [10.87, 0.82],
            [11.0, 0.82],
            [11.1, 0.72],
          ]
        : [
            [10.75, 0.8],
            [11.1, 0.72],
          ],
      d,
    );
    const r = radial(x, z, 0.63, 11.1).map((p) => [p[0], p[2]]);
    for (let i = 0; i < 8; i++) {
      const f = F(r[i], r[(i + 1) % 8]),
        open = d > 0 || i % 2 === 1,
        hole = arch(f.len / 2, 11.35, f.len * 0.53, 1.55, d > 2 ? 12 : d > 1 ? 8 : 4),
        shape = rect(f.len / 2, 11.1, f.len, 1.95);
      panel(o, 'wall', shape, f, 0, open ? [hole] : []);
      if (open) {
        reveal(o, 'wall', hole, f, 0, -0.075);
        const inner = { n: f.n.map((v) => -v), P: f.P };
        if (d) panel(o, 'wall', shape, inner, -0.075, [hole]);
      }
    }
    profile(
      o,
      'wall',
      x,
      z,
      [
        [13.05, 0.65],
        [13.42, 0.65],
      ],
      d,
    );
    profile(
      o,
      'trim',
      x,
      z,
      [
        [13.4, 0.7],
        [13.5, 0.76],
      ],
      d,
    );
    profile(
      o,
      'spire',
      x,
      z,
      [
        [13.5, 0.76],
        [14.17, 0.52],
        [14.73, 0.23],
        [15.04, 0.025],
      ],
      d,
    );
    beam(o, 'spire', [x, 15.0, z], [x, 15.3, z], 0.04, 0.04, C.spire);
    if (d > 1) {
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        beam(
          o,
          'spire',
          [x + 0.76 * Math.sin(a), 13.52, z + 0.76 * Math.cos(a)],
          [x + 0.025 * Math.sin(a), 15.04, z + 0.025 * Math.cos(a)],
          0.022,
          0.022,
          C.spire,
        );
      }
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        beam(
          o,
          'trim',
          [x + 0.66 * Math.sin(a), 13.07, z + 0.66 * Math.cos(a)],
          [x + 0.66 * Math.sin(a), 13.39, z + 0.66 * Math.cos(a)],
          0.035,
          0.035,
          C.trim,
        );
      }
    }
  }
}
function build(o, _f, d = 3) {
  body(o, d);
  frontWall(o, d);
  towers(o, d);
}
export const brisbaneSynagogueSkyline = (o, f) => build(o, f, 0);
export const brisbaneSynagogueDistrict = (o, f) => build(o, f, 1);
export const brisbaneSynagogueStreet = (o, f) => build(o, f, 2);
export const brisbaneSynagogueModel = {
  id: 'brisbane_synagogue',
  key: 'brisbane_synagogue',
  recipe: 'structure-brisbane-synagogue.mjs',
  cell: 'r7/r7h',
  title: 'Brisbane Synagogue',
  category: 'religious',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete surviving1886synagogue on its original six-vertex whole outline/rear jog. High nave/gabled roof and lower side aisles, pale rendered street facade, deep round rose/portal arches and original circular/flower tracery, twin octagonal towers with open upper arcades/pointed faceted spires, geometric friezes/gable vent and intrinsic threshold steps. Exact published1949public-domain facade and current native plan; hidden height/roof/side/color estimates. No neighboring buildings, grounds, signs or interior.',
  camera: [27, 22, 43],
  lookAt: [cx, 6.2, 4],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.6, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-six-vertex-synagogue-nave-aisles-and-twin-spires',
      position: [-25, 18, 40],
      lookAt: [cx, 6.5, 4],
    },
    {
      name: 'main-rose-geometric-tracery-concentric-arch-and-entry',
      position: [cx + 5, 7.4, 25],
      lookAt: [cx, 6.1, front],
    },
    {
      name: 'open-octagonal-tower-arcades-and-pointed-spires',
      position: [cx + 10, 13.2, 23],
      lookAt: [cx + 3, 12.5, front - 0.6],
    },
    {
      name: 'whole-estimated-rear-roofs-and-original-small-jog',
      position: [24, 23, -26],
      lookAt: [cx, 6, 3],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent96m field frozen before geometry. Exact historic/current floor, steps and host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-brisbane-synagogue.mjs',
    level: 'skyline',
    export: 'brisbaneSynagogueSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'brisbaneSynagogueDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'brisbaneSynagogueStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete current whole synagogue envelope/native rear jog, high nave and lower aisles. Front arcades/spires, round rose/portal/side lights and geometric moulding/friezes are original authored geometry, not copied stained-glass pixels. No whole grounds/site pad, neighbors, fence/people/birds/wires, signs or interior.',
    'Only unconflicted exact803x1000published1949SLQoriginal, native SHA1076740f84a9c004b2c37d9826ff56866b1463d5b and explicit public-domain archive grant matched. Full37source families inventoried; conflicting1906hero/relief-map path excluded, all other exterior/first-synagogue/interior/portrait/attribution imagery unused. No supplementary photography/copied pixels/generated bitmap.',
    'Current six-point plan and actual Margaret Street edge retained. Main nave/aisle split,12.5m ridge/15.3m tower tips, rose/tracery/arch dimensions, hidden wall/roof/door census, tower profiles and current finish after1949 are bounded estimates from one cropped monochrome facade. Neutral pale render/dark metal/wood/glass palette is not a historic or current color survey.',
    'Independent96m129x129at0.75m terrain, fixed approach[-1.7453225309977514,17.71767062448226], provider30.7177m/full relative[-13.5052,14.715]. Raw tile/grid/PNG unchanged without clipping/fitting/flattening. Coarse composite urban elevations may include neighboring roofs and vegetation; precise synagogue foot/threshold/steps/host contact unverified. Geographic preview; replaceFootprint=false.',
  ],
};

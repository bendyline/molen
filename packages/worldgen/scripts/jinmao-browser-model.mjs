/** Jin Mao compact derivatives preserve twelve occupied setbacks and the eight-stage crown. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  cap,
  clockwise,
  face,
  grid as fullGrid,
  localOutline,
  ringAt,
  solidPlan,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('n0145_jin_mao_tower', 'map-frame.json'))),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  },
  metal = [0.66, 0.7, 0.72];
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function jinMaoPlan(radius, tier) {
  // Eight corner facets, with a shallow projecting rib on each corner.
  const plan = [];
  for (let side = 0; side < 8; side++) {
    const a = (-side * Math.PI) / 4;
    for (const [delta, r] of tier < 2
      ? [[0, radius]]
      : [
          [0.17, radius * 0.91],
          [0.065, radius],
          [0, radius * 1.024],
          [-0.065, radius],
          [-0.17, radius * 0.91],
        ])
      plan.push([Math.cos(a + delta) * r, Math.sin(a + delta) * r]);
  }
  return clockwise(plan);
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    m = map;
  const grid = (o, p, color, dx, dy, frame, fc) =>
    fullGrid(
      o,
      p,
      color,
      dx * [30, 12, 5, 1][tier],
      dy * [20, 8, 4, 1][tier],
      tier === 0 ? 0 : frame,
      fc,
    );
  function glazedOutline(o, p, lo, hi, dy, color, fc, fr) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
      grid(
        o,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        color,
        1.6,
        dy,
        fr,
        fc,
      );
    }
  }
  function bandPlan(o, p, y, h, depth, color, slot = 'metal') {
    if (tier === 0) return;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.04) continue;
      const n = [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
      face(
        o,
        slot,
        [
          [a[0] + n[0] * depth, y, a[1] + n[1] * depth],
          [b[0] + n[0] * depth, y, b[1] + n[1] * depth],
          [b[0] + n[0] * depth, y + h, b[1] + n[1] * depth],
          [a[0] + n[0] * depth, y + h, a[1] + n[1] * depth],
        ],
        color,
      );
    }
  }
  const mapped = localOutline(m);
  solidPlan(out, 'stone', mapped, 0, 0.55, [0.54, 0.53, 0.5]);
  glazedOutline(out, mapped, 0.55, 8, 3.7, [0.2, 0.29, 0.34], metal, 0.1);
  cap(out, 'metal', ringAt(mapped, 8), [0.54, 0.57, 0.57]);
  const counts = [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
  let y = 8;
  for (let zone = 0; zone < counts.length; zone++) {
    const height = counts[zone] * (332.1 / 88),
      r = 32.8 - zone * 1.18,
      plan = jinMaoPlan(r, tier),
      y1 = y + height;
    glazedOutline(out, plan, y, y1, 332.1 / 88, [0.39, 0.46, 0.48], [0.67, 0.7, 0.69], 0.075);
    for (let floor = 1; floor <= counts[zone]; floor += [100, 8, 5, 1][tier])
      bandPlan(out, plan, y + floor * (332.1 / 88), 0.14, 0.22, [0.66, 0.69, 0.69], 'metal');
    cap(out, 'metal', ringAt(plan, y1), [0.55, 0.59, 0.59]);
    for (let i = 0; i < 8; i++) {
      const a = (-i * Math.PI) / 4;
      const p = [Math.cos(a) * (r + 0.38), y + 0.1, Math.sin(a) * (r + 0.38)],
        q = [p[0], y1 + 0.26, p[2]];
      if (tier > 1) beam(out, 'metal', p, q, 0.46, 0.52, [0.78, 0.8, 0.78]);
    }
    for (const dy of tier === 0 ? [] : tier === 1 ? [0.15] : [-0.35, 0.15, 0.65])
      bandPlan(out, plan, y1 + dy, 0.16, 0.5, [0.74, 0.76, 0.73], 'metal');
    y = y1;
  }
  const crown = [
    [340.1, 19.82],
    [346, 18],
    [355, 17],
    [365, 13.8],
    [375, 11.7],
    [386, 8.7],
    [397, 5.8],
    [407, 3.1],
    [415, 1.3],
  ];
  for (let j = 1; j < crown.length; j++) {
    const [a, r] = crown[j - 1],
      [b, s] = crown[j];
    const lower = radialRing(a, r, r, 8),
      shoulder = radialRing(b - 1.1, r * 0.985, r * 0.985, 8),
      upper = radialRing(b, s, s, 8);
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      grid(
        out,
        [lower[i], lower[k], shoulder[k], shoulder[i]],
        [0.39, 0.47, 0.48],
        1.8,
        1.8,
        0.12,
        [0.77, 0.78, 0.74],
      );
      face(out, 'metal', [shoulder[i], shoulder[k], upper[k], upper[i]], [0.75, 0.77, 0.72]);
      if (tier > 1) beam(out, 'metal', lower[i], shoulder[i], 0.55, 0.65, [0.8, 0.81, 0.77]);
      if (tier > 1) beam(out, 'metal', lower[i], shoulder[k], 0.18, 0.18, [0.71, 0.74, 0.73]);
    }
    bandPlan(
      out,
      shoulder.map((p) => [p[0], p[2]]),
      b - 1.1,
      0.7,
      1.45,
      [0.79, 0.8, 0.76],
      'metal',
    );
    cap(out, 'metal', upper, [0.58, 0.62, 0.6]);
  }
  tube(out, 'metal', [0, 414.6, 0], [0, 420.5, 0], 0.28, [0.78, 0.79, 0.74], 16);
}

export const buildJinmaoSkyline = (o) => build(o, 0),
  buildJinmaoDistrict = (o) => build(o, 1),
  buildJinmaoStreet = (o) => build(o, 2),
  buildJinmaoCloseup = (o) => build(o, 3);

/** Stable browser shells of the restored Red Bridge; detailed original masonry stays intact. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { beam, cross, loft, normalFor } from './authored-structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('n0017_red_bridge', 'map-frame.json')));
const MEANS = {
    sandstone: [0.7908977710930336, 0.7908977710930336, 0.7908977710930336],
    basalt: [0.9129740140085889, 0.9129740140085889, 0.9129740140085889],
    brick: [0.904731405734041, 0.904731405734041, 0.904731405734041],
  },
  z = -1.92,
  red = [0.44, 0.205, 0.105],
  gray = [0.165, 0.18, 0.176],
  mortar = [0.4, 0.359, 0.291];
const arches = [
  { c: -29.2, rx: 1.56, sy: 1.82, ry: 1.3, floor: 0.58, small: true },
  { c: -11.3, rx: 8.15, sy: 0.85, ry: 7.66, floor: 0 },
  { c: 8.25, rx: 8.55, sy: 0.85, ry: 8.14, floor: 0 },
  { c: 25.15, rx: 1.24, sy: 1.9, ry: 1.09, floor: 0.6, small: true },
  { c: 34.25, rx: 1.66, sy: 1.7, ry: 1.34, floor: 0.45, small: true },
];
const archY = (a, x, expand = 0) => {
  const rx = a.rx + expand,
    rise = a.ry + expand,
    k = rx * 0.75;
  return (
    a.sy +
    (rise * Math.sqrt(Math.max(0, (rx + k) ** 2 - (Math.abs(x - a.c) + k) ** 2))) /
      Math.sqrt((rx + k) ** 2 - k ** 2)
  );
};
function writer(destination, far) {
  function emit(slot, ref, p, hint, uv, color) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        area = cross(
          t[1].map((v, j) => v - t[0][j]),
          t[2].map((v, j) => v - t[0][j]),
        );
      if (Math.hypot(...area) < 1e-10) continue;
      let n = normalFor(...t);
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[1]]),
        far ? color.map((v, j) => v * (MEANS[slot]?.[j] ?? 1)) : color,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function prism(o, p, z0, z1, color, slot = 'sandstone') {
  const a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  o.addConvexPolygon(slot, 'palette:#ffffff', a.toReversed(), [0, 0, -1], null, color);
  o.addConvexPolygon(slot, 'palette:#ffffff', b, [0, 0, 1], null, color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      q = [a[i], a[j], b[j], b[i]];
    o.addQuad(slot, 'palette:#ffffff', q, normalFor(...q), null, color);
  }
}
function build(destination, detail) {
  const o = writer(destination, detail === 0),
    cuts = [-40, -27.8, -20.1, 19, 23.3, 40];
  for (const a of arches) {
    const n = (a.small ? 4 : 8) * [1, 2, 4, 8][detail];
    for (let i = 0; i <= n; i++) cuts.push(a.c - a.rx + (2 * a.rx * i) / n);
    cuts.push(a.c);
  }
  const xs = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1],
      b = xs[i],
      mid = (x + b) / 2,
      a = arches.find((a) => Math.abs(mid - a.c) < a.rx),
      low = (v) => (a ? archY(a, v) : 0),
      old = mid > -27.8 && mid < -20.1;
    prism(
      o,
      [
        [x, low(x)],
        [b, low(b)],
        [b, 9.9],
        [x, 9.9],
      ],
      z - 3.2,
      z + 3.2,
      old ? gray : red,
      old ? 'basalt' : 'sandstone',
    );
    if (a?.floor > 0)
      prism(
        o,
        [
          [x, 0],
          [b, 0],
          [b, a.floor],
          [x, a.floor],
        ],
        z - 3.2,
        z + 3.2,
        mortar,
        a.small ? 'brick' : 'sandstone',
      );
  }
  if (detail)
    for (const a of arches) {
      const n = detail === 1 ? (a.small ? 6 : 10) : (a.small ? 8 : 16) * [0, 1, 2, 4][detail],
        thick = a.small ? 0.24 : 0.55;
      for (let i = 0; i < n; i++) {
        const p = (t, e) => {
            const x = a.c - (a.rx + e) + 2 * (a.rx + e) * t;
            return [x, archY(a, x, e)];
          },
          a0 = i / n,
          b0 = (i + 1) / n;
        for (const side of [-1, 1])
          for (const [inner, outer] of a.small
            ? [[0, thick]]
            : [
                [0, thick],
                [thick + 0.075, thick + 0.21],
              ])
            prism(
              o,
              [p(a0, inner), p(b0, inner), p(b0, outer), p(a0, outer)],
              z + side * 3.27 - 0.03,
              z + side * 3.27 + 0.03,
              mortar,
              a.small ? 'brick' : 'sandstone',
            );
      }
    }
  const tiers = detail >= 2 ? 3 : 2;
  for (const [cx, r] of [
    [-1.6, 2.3],
    [-20.4, 1.5],
    [18.8, 1.5],
  ])
    for (let tier = 0; tier < tiers; tier++) {
      const ry = r * (1 - (tier * 0.3) / tiers),
        n = detail >= 2 ? 16 : 8,
        ring = (y) =>
          Array.from({ length: n }, (_, i) => {
            const a = (-Math.PI * 2 * i) / n;
            return [cx + ry * Math.cos(a), y, z + 3 + ry * 0.65 * Math.sin(a)];
          });
      loft(o, 'basalt', [ring((tier * 1.05) / tiers), ring(((tier + 1) * 1.05) / tiers)], gray);
    }
  const poly = [
    [-40, z + 3.25],
    [40, z + 3.25],
    ...frame.geometry.outline.slice(1, 4),
    [40, z - 3.25],
    [-40, z - 3.25],
    ...frame.geometry.outline.slice(4, 9),
  ];
  const cap = new MeshBufferBuilder();
  cap.addCap(
    'sandstone',
    'palette:#ffffff',
    poly,
    [],
    () => 9.9,
    [0, 1, 0],
    (p) => p,
    mortar,
  );
  const mesh = cap.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ps = [0, 1, 2].map((j) =>
      Array.from(mesh.positions.slice(mesh.indices[i + j] * 3, mesh.indices[i + j] * 3 + 3)),
    );
    o.addTriangle('sandstone', 'palette:#ffffff', ps, [0, 1, 0], null, mortar);
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (Math.max(Math.abs(a[0]), Math.abs(b[0])) > 40.01) {
      const q = [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 9.9, b[1]],
        [a[0], 9.9, a[1]],
      ];
      o.addQuad('sandstone', 'palette:#ffffff', q, normalFor(...q), null, red);
    }
    if (Math.min(a[0], b[0]) > 46 || Math.min(a[1], b[1]) > 5) continue;
    const n = detail ? Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2) : 1;
    for (let j = 0; j < n; j++) {
      const p = a.map((v, k) => v + ((b[k] - v) * j) / n),
        q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / n);
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.001)
        beam(
          o,
          'sandstone',
          [p[0], 10.375, p[1]],
          [q[0], 10.375, q[1]],
          0.16,
          0.95,
          j % 4 ? red : gray,
        );
    }
  }
}
export const buildRedBridgeSkyline = (out) => build(out, 0);
export const buildRedBridgeDistrict = (out) => build(out, 1);
export const buildRedBridgeStreet = (out) => build(out, 2);
export const buildRedBridgeCloseup = (out) => build(out, 3);

/** Seven-opened humped stone bridge silhouette, independent of the detailed masonry master. */
import './install-deterministic-math.mjs';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const arches = [
  { c: -26.45, rx: 1.34, sy: 3.57, ry: 1.26, floor: 3.57 },
  { c: -16.9, rx: 4.5, sy: 2.1, ry: 4.55, floor: 0 },
  { c: -10.75, rx: 1.09, sy: 6.54, ry: 1.47, floor: 6.54 },
  { c: 0, rx: 9.1, sy: 2.9, ry: 8.2, floor: 0 },
  { c: 10.93, rx: 1.25, sy: 6.23, ry: 1.73, floor: 6.23 },
  { c: 17.01, rx: 4.25, sy: 2.28, ry: 4.42, floor: 0 },
  { c: 26.18, rx: 1.76, sy: 3.84, ry: 1.76, floor: 3.84 },
];
const deck = (x) => 12.08 - Math.abs(x) * 0.177,
  bottom = (x) => (Math.abs(x) < 22 ? 0 : Math.min(4.6, (Math.abs(x) - 22) * 0.47)),
  color = [0.39, 0.385, 0.344].map((v) => v * 0.7011092892788303);
function polygon(o, p, n, far = true) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      normal = normalFor(...t);
    const area = cross(
      t[1].map((v, j) => v - t[0][j]),
      t[2].map((v, j) => v - t[0][j]),
    );
    if (Math.hypot(...area) < 1e-10) continue;
    if (n && normal.reduce((v, x, j) => v + x * n[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      normal = normalFor(...t);
    }
    o.addTriangle(
      'wall',
      'palette:#ffffff',
      t,
      normal,
      t.map((v) => [v[0], v[1]]),
      far
        ? color
        : [0.39, 0.385, 0.344].map(
            (v, j) =>
              v *
              [
                0.7011092892788303 / 0.44849861649919487,
                0.7011092892788303 / 0.44906994842942866,
                0.7011092892788303 / 0.37575318374011624,
              ][j],
          ),
    );
  }
}
function prism(o, p, z0 = -1.775, z1 = 1.775) {
  const a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  polygon(o, a.toReversed(), [0, 0, -1]);
  polygon(o, b, [0, 0, 1]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      q = [a[i], a[j], b[j], b[i]];
    polygon(o, q, normalFor(...q));
  }
}
function build(out, resolution = 1) {
  // Keep geometric detail in the arches, not in disconnected masonry slivers.
  // The authoring wrapper supplies metric UVs and a common wall texture for closer levels.
  const far = resolution === 1;
  const destination = out;
  out = {
    addTriangle(slot, ref, p, n, uv, c) {
      destination.addTriangle(
        slot,
        ref,
        p,
        n,
        uv,
        far
          ? c
          : [0.39, 0.385, 0.344].map(
              (v, j) =>
                v *
                [
                  0.7011092892788303 / 0.44849861649919487,
                  0.7011092892788303 / 0.44906994842942866,
                  0.7011092892788303 / 0.37575318374011624,
                ][j],
            ),
      );
    },
  };
  const cuts = [-32.85, 0, 32.85];
  for (const a of arches) {
    const n = (a.rx > 3 ? 8 : 4) * resolution;
    for (let i = 0; i <= n; i++) cuts.push(a.c - a.rx * Math.cos((Math.PI * i) / n));
  }
  const xs = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1],
      b = xs[i],
      a = arches.find((a) => Math.abs((x + b) / 2 - a.c) < a.rx),
      ceiling = (v) =>
        a ? a.sy + a.ry * Math.sqrt(Math.max(0, 1 - ((v - a.c) / a.rx) ** 2)) : bottom(v);
    prism(out, [
      [x, ceiling(x)],
      [b, ceiling(b)],
      [b, deck(b)],
      [x, deck(x)],
    ]);
    if (a?.floor > 0)
      prism(out, [
        [x, bottom(x)],
        [b, bottom(b)],
        [b, a.floor],
        [x, a.floor],
      ]);
  }
  for (const [a, b] of [
    [-32.85, 0],
    [0, 32.85],
  ])
    for (const [z0, z1] of [
      [-1.775, -1.58],
      [1.58, 1.775],
    ])
      prism(
        out,
        [
          [a, deck(a)],
          [b, deck(b)],
          [b, deck(b) + 0.12],
          [a, deck(a) + 0.12],
        ],
        z0,
        z1,
      );
  for (const [cx, w, h] of [
    [-10.75, 3.3, 6.45],
    [10.93, 3.66, 6.14],
  ]) {
    const a = [
        [cx - w / 2, 0, 1.65],
        [cx + w / 2, 0, 1.65],
        [cx, 0, 3.1],
      ],
      b = a.map((v) => [v[0], h, v[2]]);
    polygon(out, a.toReversed(), [0, -1, 0]);
    polygon(out, b, [0, 1, 0]);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3,
        q = [a[i], a[j], b[j], b[i]];
      polygon(out, q, normalFor(...q));
    }
  }
}
export const buildDyavolskiSkyline = (out) => build(out, 1);
export const buildDyavolskiDistrict = (out) => build(out, 2);
export const buildDyavolskiStreet = (out) => build(out, 4);
export const buildDyavolskiCloseup = (out) => build(out, 8);

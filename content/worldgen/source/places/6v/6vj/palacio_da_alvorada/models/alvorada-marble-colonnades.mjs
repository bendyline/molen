import {
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.88 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  soffit: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
};

const white = rgb('eae7dc'),
  warm = rgb('dedbd2'),
  edge = rgb('bfc1b6'),
  trim = rgb('708488');
const blue = rgb('52686e'),
  teal = rgb('496365'),
  reflection = rgb('66878b'),
  paving = rgb('b6b2a2'),
  door = rgb('8a6d4d');
const F = facade(site.frame.origin, site.frame.along);
const position = ([x, z], y) => [x, y, z];
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
function panel(out, slot, f, u, v, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(v, y, d), f.P(v, Y, d), f.P(u, Y, d), color);
}
function slab(out, ring, y, Y, side, top, slot) {
  for (const f of edges(outwardRing(ring))) panel(out, slot, f, 0, f.length, y, Y, 0, side);
  cap(out, slot, ring, Y, top);
}
function glazing(out, detail) {
  const p = (u, d) => {
    const [x, , z] = F.P(u, 0, d);
    return [x, z];
  };
  const ring = outwardRing([
    p(0.67, -4.31),
    p(site.length - 0.67, -4.31),
    p(site.length - 0.67, -26.8),
    p(0.67, -26.8),
  ]);
  for (const f of edges(ring)) {
    const w = f.length;
    panel(out, 'glass', f, 0, w, 0.47, 9.47, 0, w > 70 ? blue : teal);
    for (const y of [0.47, 4.36, 6.61, 9.42]) {
      panel(out, 'trim', f, 0, w, y, y + 0.077, 0.011, trim);
    }
    if (detail > 0) {
      const step = detail === 1 ? 3.0 : detail === 2 ? 1.72 : 0.945;
      const n = Math.floor(w / step);
      for (let i = 1; i < n; i++) {
        const u = (i * w) / n;
        panel(out, 'trim', f, u - 0.046, u + 0.046, 0.54, 9.41, 0.024, trim);
      }
    }
  }
  const mid = (site.bayGap[0] + site.bayGap[1]) * 0.5;
  for (const y of [3.15, 6.62])
    fbox(out, 'trim', F, mid - 5.25, mid + 5.25, y, y + 0.138, -4.34, -4.19, edge);
  for (const u of [mid - 5.25, mid + 5.25])
    fbox(out, 'marble', F, u - 0.104, u + 0.104, 0.39, 9.57, -4.43, -4.16, white);
}
function pier(out, row, i, d, detail) {
  const u = row[i],
    height = site.height;
  const left = i === 0 ? 0.31 : Math.min(5.07, (u - row[i - 1]) * 0.48);
  const right = i === row.length - 1 ? 0.31 : Math.min(5.07, (row[i + 1] - u) * 0.48);
  const a = i > 0 && u - row[i - 1] > 20 ? 2.52 : left;
  const b = i + 1 < row.length && row[i + 1] - u > 20 ? 2.52 : right;
  const curve =
    detail === 0
      ? [
          [0.12, 0.105],
          [0.71, 0.59],
          [1.27, 1],
          [3.86, 0.29],
          [height - 0.26, 0.029],
        ]
      : [
          [0.12, 0.105],
          [0.51, 0.43],
          [0.92, 0.82],
          [1.27, 1],
          [1.62, 0.721],
          [2.09, 0.512],
          [2.75, 0.367],
          [3.74, 0.25],
          [5.05, 0.158],
          [6.67, 0.095],
          [8.22, 0.052],
          [height - 0.26, 0.029],
        ];
  for (let j = 0; j < curve.length - 1; j++) {
    const [y, f] = curve[j],
      [Y, g] = curve[j + 1],
      front = d + 0.315,
      back = d - 0.315;
    const A = u - a * f,
      B = u + b * f,
      C = u + b * g,
      D = u - a * g;
    quad4(
      out,
      'marble',
      F.P(A, y, front),
      F.P(B, y, front),
      F.P(C, Y, front),
      F.P(D, Y, front),
      white,
    );
    quad4(out, 'marble', F.P(B, y, back), F.P(A, y, back), F.P(D, Y, back), F.P(C, Y, back), warm);
    quad4(
      out,
      'marble',
      F.P(A, y, back),
      F.P(A, y, front),
      F.P(D, Y, front),
      F.P(D, Y, back),
      shadowOnPiers,
    );
    quad4(
      out,
      'marble',
      F.P(B, y, front),
      F.P(B, y, back),
      F.P(C, Y, back),
      F.P(C, Y, front),
      shadowOnPiers,
    );
  }
}
const shadowOnPiers = rgb('d0cec0');

function palace(out, detail) {
  const length = site.length,
    roof = site.height;
  fbox(out, 'soffit', F, -0.17, length + 0.19, roof - 0.47, roof, -site.width - 0.43, 0.43, warm, {
    bottom: true,
  });
  fbox(out, 'paving', F, -0.25, length + 0.25, -1.7, 0.245, -site.width - 0.14, 1.61, paving);
  glazing(out, detail);
  for (const [i] of site.west.entries()) pier(out, site.west, i, -0.07, detail);
  for (const [i] of site.east.entries()) pier(out, site.east, i, -site.width, detail);
}

function approach(out, detail) {
  slab(out, site.approach, -0.7, 0.252, edge, paving, 'paving');
  for (const basin of site.pools) {
    const ring = outwardRing(basin);
    cap(out, 'glass', ring, site.poolLevel, reflection);
    for (const f of edges(ring)) {
      panel(out, 'paving', f, 0, f.length, -0.74, 0.065, 0, paving);
      if (detail > 0) fbox(out, 'paving', f, 0, f.length, -0.058, 0.069, -0.105, 0.14, edge);
    }
  }
}
function chapel(out, detail) {
  slab(out, site.annex, -2.7, 0.38, edge, paving, 'paving');
  slab(out, site.corridor, -0.58, 0.15, paving, paving, 'paving');
  for (const f of edges(outwardRing(site.corridor)))
    panel(out, 'glass', f, 0, f.length, 0.14, 2.81, 0, teal);
  slab(out, site.corridor, 2.75, 3.01, warm, white, 'soffit');

  const center = site.annex.reduce(
    ([x, z], [a, b]) => [x + a / site.annex.length, z + b / site.annex.length],
    [0, 0],
  );
  const n = [10, 14, 22, 30][detail],
    radius = 8.38;
  const ring = Array.from({ length: n }, (_, i) => {
    const theta = (2 * Math.PI * i) / n,
      r = radius + 1.22 * Math.sin(theta) * Math.sin(theta);
    return [center[0] + Math.cos(theta) * r, center[1] + Math.sin(theta) * r];
  });
  const h = (p) => 5.78 + (p[1] - center[1]) * 0.198 + (p[0] - center[0]) * 0.049;
  const r = outwardRing(ring);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length];
    quad4(
      out,
      'marble',
      position(a, 0.31),
      position(b, 0.31),
      position(b, h(b)),
      position(a, h(a)),
      white,
    );
  }
  const ridge = ring.map((p) => [
    center[0] + (p[0] - center[0]) * 0.55,
    center[1] + (p[1] - center[1]) * 0.55,
  ]);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      c = ridge[ring.indexOf(b)],
      d = ridge[ring.indexOf(a)];
    quad4(
      out,
      'soffit',
      position(a, h(a)),
      position(b, h(b)),
      position(c, 7.67),
      position(d, 7.67),
      warm,
    );
  }
  cap(out, 'soffit', ridge, 7.67, white);
  const f = wallFace(r[1], r[2]);
  panel(out, 'trim', f, 0, f.length, 0.41, 2.94, 0.02, door);
  if (detail > 0)
    lathe(
      out,
      'trim',
      center,
      [
        [7.65, 0.078, 0.078],
        [8.12, 0.065, 0.065],
      ],
      6,
      edge,
    );
}
function build(out, detail) {
  palace(out, detail);
  approach(out, detail);
  chapel(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

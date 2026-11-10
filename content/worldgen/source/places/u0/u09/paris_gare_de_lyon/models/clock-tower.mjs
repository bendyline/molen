import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { parts, clockGroundY } = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const ring = parts.clockTower.polygons[0][0];
const lo = (axis) => Math.min(...ring.map((p) => p[axis])),
  hi = (axis) => Math.max(...ring.map((p) => p[axis]));
const x = (lo(0) + hi(0)) / 2,
  z = (lo(1) + hi(1)) / 2;
export const clockTower = {
  center: [x, z],
  width: hi(0) - lo(0),
  depth: hi(1) - lo(1),
  height: parts.clockTower.heights[0],
};
export const towerSurfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone' },
  trim: { slot: 'trim', graph: 'stone_limestone_raw' },
  slate: { slot: 'roof', graph: 'slate' },
  glass: { slot: 'window', graph: 'window_punched' },
  metal: { slot: 'door', graph: 'metal_painted' },
};
const palette = {
  limestone: '#d1c6ae',
  trim: '#e1d9c5',
  slate: '#596363',
  glass: '#43535c',
  metal: '#58625f',
  blue: '#617978',
  brass: '#bb9c5a',
  ivory: '#ded4b4',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    [...hex.slice(1).matchAll(/../g)].map(([pair]) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff';
function face(out, slot, points, expected, tint = slot) {
  const n = normalFor(...points.slice(0, 3)),
    forward = n.reduce((s, a, i) => s + a * expected[i], 0) > 0;
  out.addConvexPolygon(
    slot,
    ref,
    forward ? points : points.toReversed(),
    forward ? n : n.map((a) => -a),
    (p) => [p[0], p[2]],
    colors[tint],
  );
}
function stage(out, slot, w, d, y0, y1, tint = slot) {
  box(
    out,
    slot,
    [x - w / 2, y0 + clockGroundY, z - d / 2],
    [x + w / 2, y1 + clockGroundY, z + d / 2],
    colors[tint],
  );
}
function stepRoof(out, y0, y1, w0, d0, w1, d1) {
  const outline = (w, d, y) =>
    [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ].map(([sx, sz]) => [x + (sx * w) / 2, y + clockGroundY, z + (sz * d) / 2]);
  const a = outline(w0, d0, y0),
    b = outline(w1, d1, y1);
  for (let i = 0; i < 4; i++)
    face(out, 'slate', [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]], [0, 1, 0]);
}
function view(side, half) {
  const normal = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, -1],
    [-1, 0, 0],
  ][side];
  const point = (u, y, offset = 0) => [
    x + normal[0] * (half + offset) + normal[2] * u,
    y + clockGroundY,
    z + normal[2] * (half + offset) - normal[0] * u,
  ];
  return { normal, point };
}
function panel(out, f, slot, lo, hi, y0, y1, depth, tint = slot) {
  face(
    out,
    slot,
    [
      [lo, y0],
      [hi, y0],
      [hi, y1],
      [lo, y1],
    ].map(([u, y]) => f.point(u, y, depth)),
    f.normal,
    tint,
  );
}
function arch(out, f, u, base, shoulder, r, rise, detail) {
  const n = detail >= 3 ? 12 : 6;
  const arc = (r0, r1) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const angle = (Math.PI * i) / n;
      return [u - r0 * Math.cos(angle), shoulder + r1 * Math.sin(angle)];
    });
  const inner = arc(r, rise),
    outer = arc(r + 0.22, rise + 0.22);
  panel(out, f, 'glass', u - r, u + r, base, shoulder, 0.045);
  face(
    out,
    'glass',
    inner.map(([u, y]) => f.point(u, y, 0.045)),
    f.normal,
  );
  for (let i = 1; i < inner.length; i++)
    face(
      out,
      'trim',
      [inner[i - 1], inner[i], outer[i], outer[i - 1]].map(([u, y]) => f.point(u, y, 0.14)),
      f.normal,
    );
  for (const v of [u - r, u + r]) panel(out, f, 'trim', v - 0.11, v + 0.11, base, shoulder, 0.14);
}
function dial(out, f, detail) {
  const y = 51.65,
    n = detail >= 3 ? 36 : detail >= 1 ? 20 : 10,
    r = 2.67;
  const ring = (radius, offset) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return f.point(radius * Math.cos(a), y + radius * Math.sin(a), offset);
    });
  face(out, 'metal', ring(r + 0.16, 0.08), f.normal, 'brass');
  face(out, 'metal', ring(r, 0.13), f.normal, 'blue');
  if (!detail) return;
  for (let i = 0; i < 12; i++) {
    const a = (2 * Math.PI * i) / 12,
      c = Math.cos(a),
      s = Math.sin(a);
    const point = (l, w) => f.point(l * c - w * s, y + l * s + w * c, 0.16);
    face(
      out,
      'metal',
      [
        point(r * 0.76, -0.045),
        point(r * 0.94, -0.045),
        point(r * 0.94, 0.045),
        point(r * 0.76, 0.045),
      ],
      f.normal,
      'ivory',
    );
  }
  for (const [a, length, width] of [
    [0.62, r * 0.72, 0.075],
    [2.41, r * 0.53, 0.105],
  ]) {
    const c = Math.cos(a),
      s = Math.sin(a),
      point = (l, w) => f.point(l * c - w * s, y + l * s + w * c, 0.18);
    face(
      out,
      'metal',
      [point(-0.17, -width), point(length, -width), point(length, width), point(-0.17, width)],
      f.normal,
      'ivory',
    );
  }
}

export function buildClockTower(out, detail) {
  const w = clockTower.width - 0.18,
    d = clockTower.depth - 0.18;
  stage(out, 'limestone', w, d, -2.2, 46.32);
  stage(out, 'trim', w + 0.28, d + 0.28, 45.78, 46.92);
  stage(out, 'limestone', w - 0.31, d - 0.31, 46.65, 56.55);
  stage(out, 'trim', w + 0.36, d + 0.36, 56.29, 57.45);
  stepRoof(out, 57.28, 61.42, w + 0.26, d + 0.26, 4.14, 4.56);
  stage(out, 'trim', 4.14, 4.56, 61.26, 62.88);
  stepRoof(out, 62.77, 65.78, 4.38, 4.72, 1.1, 1.19);
  stage(out, 'metal', 0.27, 0.27, 65.6, clockTower.height, 'brass');
  for (let i = 0; i < 4; i++) {
    const f = view(i, (i % 2 ? w : d) / 2),
      half = (i % 2 ? d : w) / 2;
    dial(out, view(i, (i % 2 ? w - 0.31 : d - 0.31) / 2), detail);
    if (!detail) continue;
    for (const y of [1.25, 7.44, 24.7, 32.25, 42.18])
      panel(out, f, 'trim', -half, half, y, y + 0.36, 0.22);
    for (const u of [-half + 0.41, half - 0.41])
      panel(out, f, 'trim', u - 0.32, u + 0.32, 7.48, 42.19, 0.11);
    if (i === 3 || i === 0) arch(out, f, 0, 21.1, 29.7, 2.07, 2.25, detail);
    else panel(out, f, 'glass', -0.71, 0.71, 26.65, 31.67, 0.045);
    if (detail >= 2)
      for (const u of [-1.61, 0, 1.61]) arch(out, f, u, 39.08, 41.05, 0.45, 0.66, detail);
  }
}

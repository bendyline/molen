/** Whole native Bethlehem Steel Administration Building; original bounded exterior geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
    wall: rgb('dddcd4'),
    trim: rgb('e4e1d4'),
    foundation: rgb('c2c0b6'),
    roof: rgb('626c69'),
    dark: rgb('536260'),
  },
  colors = ['d8d8d0', 'dfded6', 'd4d5cb'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.15 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.12 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  facadeEvidence = [],
  roofEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t,
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
export const ring = () =>
  frame.features[0].outline
    .slice(0, -1)
    .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  if (!q.flat().every(Number.isFinite)) throw Error(JSON.stringify({ k, q, n }));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) < 1e-6) return;
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function triangles(r) {
  return ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  );
}
function cap(o, k, r, y, up, col = C[k]) {
  for (const ix of triangles(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], bottom = false, top = true) {
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  if (bottom) cap(o, k, r, y, false, col);
  if (top) cap(o, k, r, Y, true, col);
}
const rect = (x, X, z, Z) => [
  [x, z],
  [X, z],
  [X, Z],
  [x, Z],
];
function piece(o, k, a, b, depth, r, col = C[k] ?? C.wall) {
  r = r.filter((v, i) => i === 0 || Math.hypot(...sub(v, r[i - 1])) > 1e-7);
  if (r.length < 3 || Math.abs(area(r)) < 1e-7) return;
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = [d[0] / L, d[1] / L],
    n = [u[1], -u[0]],
    P = (q, v) => [a[0] + u[0] * q[0] + n[0] * v, q[1], a[1] + u[1] * q[0] + n[1] * v];
  for (const ids of triangles(r))
    for (const v of [0, -depth])
      T(
        o,
        k,
        ids.map((i) => P(r[i], v)),
        [n[0] * (v === 0 ? 1 : -1), 0, n[1] * (v === 0 ? 1 : -1)],
        col,
      );
}
const archTop = (h, x) =>
  h.spring +
  (h.top - h.spring) *
    Math.sqrt(Math.max(0, 1 - ((x - h.center) * (x - h.center)) / (h.radius * h.radius)));
/** Genuine through-openings, with inward returns and closed masonry around each arch. */
function wall(o, k, a, b, depth, y, Y, holes, lod, col = C[k] ?? C.wall, courses = false) {
  const L = Math.hypot(...sub(b, a)),
    N = [2, 2, 8, 16][lod],
    list = holes.filter((h) => h.center - h.radius > 0.02 && h.center + h.radius < L - 0.02),
    cuts = [0, L];
  for (const h of list)
    for (let i = 0; i <= (h.arch ? N : 1); i++)
      cuts.push(h.center - h.radius + (2 * h.radius * i) / (h.arch ? N : 1));
  const cs = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 1; i < cs.length; i++) {
    const l = cs[i - 1],
      r = cs[i],
      mid = (l + r) / 2,
      hs = list
        .filter((h) => mid > h.center - h.radius && mid < h.center + h.radius)
        .sort((a, b) => a.bottom - b.bottom);
    let bottomL = y,
      bottomR = y;
    for (const h of hs) {
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [l, bottomL],
          [r, bottomR],
          [r, h.bottom],
          [l, h.bottom],
        ],
        col,
      );
      bottomL = h.arch ? archTop(h, l) : h.top;
      bottomR = h.arch ? archTop(h, r) : h.top;
    }
    piece(
      o,
      k,
      a,
      b,
      depth,
      [
        [l, bottomL],
        [r, bottomR],
        [r, Y],
        [l, Y],
      ],
      col,
    );
  }
  const u = sub(b, a).map((v) => v / L),
    normal = [u[1], -u[0]],
    P = (q, d) => [a[0] + u[0] * q[0] + normal[0] * d, q[1], a[1] + u[1] * q[0] + normal[1] * d];
  const edge = (q, t, sign) => {
    const dx = t[0] - q[0],
      dy = t[1] - q[1];
    Q(
      o,
      k,
      [P(q, 0), P(t, 0), P(t, -depth), P(q, -depth)],
      [sign * u[0] * dy, -sign * dx, sign * u[1] * dy],
      col,
    );
  };
  const border = [
    [0, y],
    [L, y],
    [L, Y],
    [0, Y],
  ];
  for (let i = 0; i < 4; i++) if (lod > 0 || i === 2) edge(border[i], border[(i + 1) % 4], 1);
  for (const h of list) {
    const a = h.center - h.radius,
      b = h.center + h.radius,
      ring = [
        [a, h.bottom],
        [b, h.bottom],
      ];
    if (h.arch)
      for (let i = 0; i <= N; i++) {
        const x = b - ((b - a) * i) / N;
        ring.push([x, archTop(h, x)]);
      }
    else ring.push([b, h.top], [a, h.top]);
    for (let i = 0; i < ring.length; i++) edge(ring[i], ring[(i + 1) % ring.length], -1);
  }
  for (const h of list) openingEvidence.push({ kind: k, a, b, depth, ...h });
  if (!courses || lod < 2) return;
  const n = [u[1], -u[0]],
    row = lod === 2 ? 0.84 : 0.42,
    w = lod === 2 ? 4.8 : 1.9;
  for (let j = 0; j < Math.ceil((Y - y) / row); j++) {
    const yy = y + j * row + 0.018,
      YY = Math.min(Y - 0.012, yy + row - 0.034);
    if (YY <= yy) continue;
    for (let i = -1; i < Math.ceil(L / w); i++) {
      const l = Math.max(0.012, (i + (j % 2) * 0.5) * w + 0.016),
        r = Math.min(L - 0.012, (i + 1 + (j % 2) * 0.5) * w - 0.016);
      if (r <= l) continue;
      if (
        list.some(
          (h) =>
            r > h.center - h.radius - 0.1 &&
            l < h.center + h.radius + 0.1 &&
            YY > h.bottom - 0.04 &&
            yy < (h.arch ? h.spring + h.radius : h.top) + 0.04,
        )
      )
        continue;
      const P = (t, h, d) => [a[0] + u[0] * t + n[0] * d, h, a[1] + u[1] * t + n[1] * d],
        col2 = colors[(j * 7 + i * 13 + 600) % colors.length],
        dd = lod === 3 ? 0.035 : 0.012;
      Q(o, k, [P(l, yy, dd), P(r, yy, dd), P(r, YY, dd), P(l, YY, dd)], [n[0], 0, n[1]], col2);
      if (lod === 3) {
        Q(o, k, [P(l, YY, 0), P(l, YY, dd), P(r, YY, dd), P(r, YY, 0)], [0, 1, 0], col2);
        Q(o, k, [P(r, yy, 0), P(r, yy, dd), P(r, YY, dd), P(r, YY, 0)], [u[0], 0, u[1]], col2);
      }
    }
  }
}
function rustication(o, k, a, b, y, Y, list, lod) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L);
  const n = [u[1], -u[0]],
    row = lod === 2 ? 0.84 : 0.42,
    w = lod === 2 ? 4.8 : 1.9;
  for (let j = 0; j < Math.ceil((Y - y) / row); j++) {
    const yy = y + j * row + 0.018,
      YY = Math.min(Y - 0.012, yy + row - 0.034);
    if (YY <= yy) continue;
    for (let i = -1; i < Math.ceil(L / w); i++) {
      const l = Math.max(0.012, (i + (j % 2) * 0.5) * w + 0.016),
        r = Math.min(L - 0.012, (i + 1 + (j % 2) * 0.5) * w - 0.016);
      if (r <= l) continue;
      if (
        list.some(
          (h) =>
            r > h.center - h.radius - 0.1 &&
            l < h.center + h.radius + 0.1 &&
            YY > h.bottom - 0.04 &&
            yy < (h.arch ? h.spring + h.radius : h.top) + 0.04,
        )
      )
        continue;
      const P = (t, h, d) => [a[0] + u[0] * t + n[0] * d, h, a[1] + u[1] * t + n[1] * d],
        col2 = colors[(j * 7 + i * 13 + 600) % colors.length],
        dd = lod === 3 ? 0.035 : 0.012;
      Q(o, k, [P(l, yy, dd), P(r, yy, dd), P(r, YY, dd), P(l, YY, dd)], [n[0], 0, n[1]], col2);
      if (lod === 3) {
        Q(o, k, [P(l, YY, 0), P(l, YY, dd), P(r, YY, dd), P(r, YY, 0)], [0, 1, 0], col2);
        Q(o, k, [P(r, yy, 0), P(r, yy, dd), P(r, YY, dd), P(r, YY, 0)], [u[0], 0, u[1]], col2);
      }
    }
  }
}
const original = ring(),
  positive = (r) => (area(r) > 0 ? r : [...r].reverse()),
  whole = positive(original),
  historic = positive([original[0], ...original.slice(6)]),
  atrium = positive(original.slice(0, 7));
export const physicalPlan = {
  whole,
  historic,
  atrium,
  sourceControls: 20,
  partitionBasis:
    'Current whole native outline, attached central atrium separated along enduring inner diagonal0to6; roof subdivisions/modern profiles original estimates.',
};
function strip(o, k, a, b, y, Y, depth, outset = 0, col = C[k]) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [u[1], -u[0]];
  const at = (t, d) => [a[0] + u[0] * t + n[0] * d, a[1] + u[1] * t + n[1] * d];
  solid(
    o,
    k,
    [at(0, outset), at(L, outset), at(L, outset - depth), at(0, outset - depth)],
    y,
    Y,
    col,
    false,
  );
}
function face(o, k, a, b, r, d, col = C[k]) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [u[1], -u[0]],
    P = (q) => [a[0] + u[0] * q[0] + n[0] * d, q[1], a[1] + u[1] * q[0] + n[1] * d];
  for (const ix of triangles(r))
    T(
      o,
      k,
      ix.map((i) => P(r[i])),
      [n[0], 0, n[1]],
      col,
    );
}
let activeLOD = 3;
function frameStrip(o, k, a, b, l, r, y, Y, depth = 0.09, outset = 0.035) {
  if (activeLOD > 0 && activeLOD < 3) {
    face(
      o,
      k,
      a,
      b,
      [
        [l, y],
        [r, y],
        [r, Y],
        [l, Y],
      ],
      outset,
    );
    return;
  }
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    aa = a.map((v, i) => v + u[i] * l),
    bb = a.map((v, i) => v + u[i] * r);
  strip(o, k, aa, bb, y, Y, depth, outset);
}
function sash(o, a, b, h, lod) {
  const l = h.center - h.radius,
    r = h.center + h.radius,
    top = h.arch ? h.spring + h.radius : h.top,
    d = -A.windowDepth;
  const paneRing = [
    [l, h.bottom],
    [r, h.bottom],
  ];
  if (h.arch)
    for (let i = 0; i <= 8; i++) {
      const x = r - ((r - l) * i) / 8;
      paneRing.push([x, archTop(h, x)]);
    }
  else paneRing.push([r, top], [l, top]);
  face(o, 'dark', a, b, paneRing, d);
  if (lod <= 1) return;
  const t = 0.095;
  frameStrip(o, 'trim', a, b, l - t, l + t, h.bottom, top, 0.12, 0.03);
  frameStrip(o, 'trim', a, b, r - t, r + t, h.bottom, top, 0.12, 0.03);
  frameStrip(o, 'trim', a, b, l, r, h.bottom - t, h.bottom + t, 0.12, 0.03);
  if (!h.arch) {
    frameStrip(o, 'trim', a, b, l - t, r + t, top - t, top + t, 0.12, 0.03);
    if (lod >= 2) {
      const transom = top - 0.76;
      frameStrip(o, 'roof', a, b, l, r, transom - 0.035, transom + 0.035, 0.055, d + 0.025);
      frameStrip(
        o,
        'roof',
        a,
        b,
        l,
        r,
        (h.bottom + transom) / 2 - 0.035,
        (h.bottom + transom) / 2 + 0.035,
        0.055,
        d + 0.025,
      );
    }
  }
  if (h.arch && lod >= 2) {
    for (let i = 0; i < 12; i++) {
      const t1 = (Math.PI * i) / 12,
        t2 = (Math.PI * (i + 1)) / 12;
      face(
        o,
        'trim',
        a,
        b,
        [
          [
            h.center + Math.cos(t1) * (h.radius + 0.14),
            h.spring + Math.sin(t1) * (h.top - h.spring + 0.14),
          ],
          [
            h.center + Math.cos(t2) * (h.radius + 0.14),
            h.spring + Math.sin(t2) * (h.top - h.spring + 0.14),
          ],
          [
            h.center + Math.cos(t2) * (h.radius - 0.02),
            h.spring + Math.sin(t2) * (h.top - h.spring - 0.02),
          ],
          [
            h.center + Math.cos(t1) * (h.radius - 0.02),
            h.spring + Math.sin(t1) * (h.top - h.spring - 0.02),
          ],
        ],
        0.08,
      );
    }
  }
}
function pilaster(o, a, b, t, lod) {
  const L = Math.hypot(...sub(b, a)),
    axis = sub(b, a).map((v) => v / L),
    n = [axis[1], -axis[0]],
    w = 0.96,
    at = (x, y, d) => [a[0] + axis[0] * (t + x) + n[0] * d, y, a[1] + axis[1] * (t + x) + n[1] * d];
  if (lod === 0) {
    frameStrip(o, 'trim', a, b, t - w / 2, t + w / 2, A.pilasterBottom, A.pilasterTop, 0.16, 0.2);
    return;
  }
  const N = lod === 1 ? 2 : lod === 2 ? 16 : 40,
    low = A.pilasterBottom + 0.25,
    high = A.pilasterCapitalBottom;
  for (let i = 0; i < N; i++) {
    const x = -w / 2 + (w * i) / N,
      X = -w / 2 + (w * (i + 1)) / N,
      depth = (x) =>
        0.19 - (lod >= 2 ? 0.05 * (0.5 + 0.5 * Math.cos((x / w + 0.5) * Math.PI * 16)) : 0);
    Q(
      o,
      'trim',
      [at(x, low, depth(x)), at(X, low, depth(X)), at(X, high, depth(X)), at(x, high, depth(x))],
      [n[0], 0, n[1]],
    );
  }
  for (const x of [-w / 2, w / 2])
    Q(
      o,
      'trim',
      [at(x, low, 0), at(x, low, 0.19), at(x, high, 0.19), at(x, high, 0)],
      [axis[0] * Math.sign(x), 0, axis[1] * Math.sign(x)],
    );
  frameStrip(
    o,
    'trim',
    a,
    b,
    t - 0.62,
    t + 0.62,
    A.pilasterBottom,
    A.pilasterBottom + 0.25,
    0.24,
    0.24,
  );
  frameStrip(
    o,
    'trim',
    a,
    b,
    t - 0.56,
    t + 0.56,
    A.pilasterCapitalBottom,
    A.pilasterTop - 0.22,
    0.23,
    0.23,
  );
  frameStrip(o, 'trim', a, b, t - 0.7, t + 0.7, A.pilasterTop - 0.22, A.pilasterTop, 0.3, 0.3);
}
function balustrade(o, a, b, t, width, lod) {
  const l = t - width / 2,
    r = t + width / 2,
    y = A.stringCourseTop + 0.05;
  frameStrip(o, 'trim', a, b, l - 0.12, r + 0.12, y - 0.13, y, 0.7, 0.5);
  frameStrip(o, 'trim', a, b, l - 0.12, r + 0.12, y + 0.62, y + 0.78, 0.5, 0.5);
  if (lod === 0) return;
  const N = lod === 1 ? 3 : 7;
  for (let j = 0; j < N; j++) {
    const c = mix(l + 0.15, r - 0.15, j / (N - 1));
    frameStrip(o, 'trim', a, b, c - 0.075, c + 0.075, y, y + 0.62, 0.22, 0.35);
    if (lod >= 2) frameStrip(o, 'trim', a, b, c - 0.115, c + 0.115, y + 0.18, y + 0.4, 0.24, 0.38);
  }
  for (const c of [l, r]) frameStrip(o, 'trim', a, b, c - 0.12, c + 0.12, y, y + 0.78, 0.5, 0.5);
}
function facades(o, lod) {
  const r = positive(historic.filter((q) => q !== original[12]));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(...sub(b, a));
    let street = null;
    if (
      (Math.hypot(...sub(a, original[10])) < 0.01 && Math.hypot(...sub(b, original[11])) < 0.01) ||
      (Math.hypot(...sub(b, original[10])) < 0.01 && Math.hypot(...sub(a, original[11])) < 0.01)
    )
      street = 'south';
    if (
      (Math.hypot(...sub(a, original[13])) < 0.01 && Math.hypot(...sub(b, original[14])) < 0.01) ||
      (Math.hypot(...sub(b, original[13])) < 0.01 && Math.hypot(...sub(a, original[14])) < 0.01)
    )
      street = 'west';
    const bevel = Math.abs(L - 8.2) < 0.35;
    const N = street ? 7 : bevel ? 1 : Math.max(0, Math.floor((L - 1.2) / 4.1)),
      holes = [],
      centers = [];
    for (let j = 0; j < N; j++) {
      const center = (L * (j + 1)) / (N + 1);
      centers.push(center);
      if (bevel) {
        holes.push({
          center,
          radius: 1.25,
          bottom: A.entryThreshold,
          top: A.entryArchTop,
          arch: true,
          spring: A.entryArchSpring,
        });
      } else if (lod < 2)
        holes.push({
          center,
          radius: street ? 1.22 : 0.72,
          bottom: A.firstWindowsBottom,
          top: A.firstWindowsTop,
        });
      else
        for (const dx of [-0.58, 0.58])
          holes.push({
            center: center + dx,
            radius: 0.48,
            bottom: A.firstWindowsBottom,
            top: A.firstWindowsTop,
          });
      for (const [y, Y] of [
        [A.secondWindowsBottom, A.secondWindowsTop],
        [A.thirdWindowsBottom, A.thirdWindowsTop],
      ]) {
        if (lod < 2)
          holes.push({ center, radius: street || bevel ? 1.34 : 0.75, bottom: y, top: Y });
        else
          for (const dx of street || bevel ? [-0.88, 0, 0.88] : [-0.46, 0.46])
            holes.push({
              center: center + dx,
              radius: street || bevel ? 0.36 : 0.36,
              bottom: y,
              top: Y,
            });
      }
    }
    if (lod === 0) {
      wall(o, 'wall', a, b, A.wallDepth, A.plinthTop, A.entablatureTop, [], lod);
      for (const h of holes)
        face(
          o,
          'dark',
          a,
          b,
          [
            [h.center - h.radius, h.bottom],
            [h.center + h.radius, h.bottom],
            [h.center + h.radius, h.top],
            [h.center - h.radius, h.top],
          ],
          0.008,
        );
    } else {
      wall(o, 'wall', a, b, A.wallDepth, A.plinthTop, A.entablatureTop, holes, lod, C.wall, false);
      for (const h of holes) sash(o, a, b, h, lod);
      if (lod >= 2)
        rustication(
          o,
          'wall',
          a,
          b,
          A.plinthTop,
          A.stringCourseBottom,
          holes.filter((h) => h.bottom < A.stringCourseBottom),
          lod,
        );
    }
    if (street || bevel) {
      if (lod === 0) {
        for (const t of [0.55, L - 0.55]) pilaster(o, a, b, t, lod);
      } else
        for (let j = 0; j <= N; j++)
          pilaster(o, a, b, Math.max(0.55, Math.min(L - 0.55, ((j + 0.5) * L) / (N + 1))), lod);
      for (let j = 0; j < centers.length; j++) {
        const t = centers[j];
        if (lod >= 2) {
          frameStrip(o, 'trim', a, b, t - 1.46, t + 1.46, 11.1, 11.72, 0.15, 0.06);
          if (lod === 3) {
            for (const yy of [11.18, 11.57])
              frameStrip(o, 'trim', a, b, t - 1.3, t + 1.3, yy, yy + 0.055, 0.1, 0.12);
          }
        }
        if (bevel || (lod > 0 && (j === 0 || j === centers.length - 1)))
          balustrade(o, a, b, t, 2.7, lod);
      }
    }
    facadeEvidence.push({
      a,
      b,
      street,
      bevel,
      L,
      estimatedBays: N,
      openings: lod === 0 ? 0 : holes.length,
    });
  }
}
function cornices(o, lod) {
  for (let i = 0; i < historic.length; i++) {
    const a = historic[i],
      b = historic[(i + 1) % historic.length];
    strip(o, 'trim', a, b, A.stringCourseBottom, A.stringCourseTop, 0.85, 0.35);
    strip(o, 'trim', a, b, A.entablatureTop, A.corniceTop, 0.95, 0.65);
    strip(o, 'trim', a, b, A.corniceTop, A.parapetTop, 0.43, 0.08);
    if (lod >= 2) {
      strip(o, 'trim', a, b, A.entablatureTop - 0.2, A.entablatureTop, 0.7, 0.25);
      strip(o, 'trim', a, b, A.corniceTop - 0.13, A.corniceTop, 0.95, 0.72);
    }
    if (lod === 3) {
      const L = Math.hypot(...sub(b, a));
      for (let t = 0.25; t < L; t += 0.65)
        frameStrip(
          o,
          'trim',
          a,
          b,
          t,
          t + 0.16,
          A.entablatureTop - 0.32,
          A.entablatureTop - 0.1,
          0.35,
          0.5,
        );
    }
  }
}
function pitchedGlass(o, r, bottom, eave, ridge, lod, label) {
  const xs = r.map((q) => q[0]),
    zs = r.map((q) => q[1]),
    x = Math.min(...xs),
    X = Math.max(...xs),
    z = Math.min(...zs),
    Z = Math.max(...zs),
    mid = (x + X) / 2,
    height = (q) => eave + (ridge - eave) * (1 - Math.abs(q[0] - mid) / ((X - x) / 2));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      'dark',
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], height(b), b[1]],
        [a[0], height(a), a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      rgb('788b87'),
    );
    if ((a[0] < mid && b[0] > mid) || (a[0] > mid && b[0] < mid)) {
      const t = (mid - a[0]) / (b[0] - a[0]),
        v = mix(a[1], b[1], t);
      T(
        o,
        'dark',
        [
          [a[0], height(a), a[1]],
          [b[0], height(b), b[1]],
          [mid, ridge, v],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        rgb('788b87'),
      );
    }
    if (lod > 0) {
      const N = Math.max(1, Math.ceil(Math.hypot(...sub(b, a)) / (lod === 1 ? 6 : 2.6)));
      for (let j = 0; j <= N; j++) {
        const q = a.map((v, k) => mix(v, b[k], j / N));
        B(o, 'roof', [q[0], bottom, q[1]], [q[0], height(q), q[1]], 0.1, 0.1);
      }
      B(o, 'roof', [a[0], height(a), a[1]], [b[0], height(b), b[1]], 0.14, 0.14);
    }
  }
  const clipX = (poly, value, positive) => {
    const out = [];
    let a = poly.at(-1);
    for (const b of poly) {
      const aa = positive ? a[0] >= value : a[0] <= value,
        bb = positive ? b[0] >= value : b[0] <= value;
      if (aa !== bb) {
        const t = (value - a[0]) / (b[0] - a[0]);
        out.push(a.map((v, k) => mix(v, b[k], t)));
      }
      if (bb) out.push(b);
      a = b;
    }
    return out;
  };
  for (const side of [false, true])
    cap(o, 'dark', clipX(r, mid, side), height, true, rgb('718782'));
  const crossing = (axis, value) => {
    const out = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if ((a[axis] <= value && b[axis] >= value) || (a[axis] >= value && b[axis] <= value)) {
        if (Math.abs(b[axis] - a[axis]) < 1e-8) continue;
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        out.push(mix(a[1 - axis], b[1 - axis], t));
      }
    }
    return out.length >= 2 ? [Math.min(...out), Math.max(...out)] : null;
  };
  if (lod > 0) {
    for (let v = z + 0.02; v < Z; v += lod === 1 ? 6 : 2.5) {
      const ends = crossing(1, v);
      if (!ends) continue;
      const [x1, x2] = ends,
        xx = [x1, ...(x1 < mid && x2 > mid ? [mid] : []), x2];
      for (let i = 1; i < xx.length; i++)
        B(
          o,
          'roof',
          [xx[i - 1], height([xx[i - 1], v]), v],
          [xx[i], height([xx[i], v]), v],
          0.11,
          0.11,
        );
    }
    for (const xx of lod === 1
      ? [mid]
      : [x + 0.02, mid - (X - x) / 4, mid, mid + (X - x) / 4, X - 0.02]) {
      const ends = crossing(0, xx);
      if (ends)
        B(o, 'roof', [xx, height([xx, 0]), ends[0]], [xx, height([xx, 0]), ends[1]], 0.1, 0.1);
    }
  }
  roofEvidence.push({ label, footprint: r, bottom, eave, ridge, hiddenProfileEstimate: true });
}
function roofs(o, lod) {
  cap(o, 'roof', historic, A.roofDeck, true);
  if (lod > 0) {
    cap(o, 'wall', historic, A.roofDeck - 0.25, false);
    for (const y of [6.45, 11.6]) cap(o, 'foundation', historic, y, true);
  }
  solid(o, 'foundation', atrium, A.foundationBottom, A.atriumPlinth, C.foundation, lod > 0);
  pitchedGlass(
    o,
    atrium,
    A.atriumPlinth,
    A.atriumEave,
    A.atriumRidge,
    lod,
    'native attached central glass-steel atrium',
  );
  const rr = rect(-21.6, -8.2, -17.5, 5.0);
  pitchedGlass(
    o,
    rr,
    A.conservatoryFloor,
    A.conservatoryEave,
    A.conservatoryRidge,
    lod,
    'text-supported original bounded rooftop conservatory',
  );
  const pent = [original[15], original[16], original[17], original[18]];
  solid(o, 'wall', positive(pent), A.roofDeck, A.portHistoricalUpperExtent - 0.35, C.wall, lod > 0);
  solid(
    o,
    'roof',
    positive(pent),
    A.portHistoricalUpperExtent - 0.35,
    A.portHistoricalUpperExtent,
    C.roof,
    lod > 0,
  );
  roofEvidence.push({
    label: 'actual north rear projection, original bounded partial fourth-floor penthouse',
    top: A.portHistoricalUpperExtent,
  });
}
function entrySteps(o, lod) {
  const a = original[11],
    b = original[13],
    L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [u[1], -u[0]],
    center = a.map((v, i) => (v + b[i]) / 2),
    N = lod === 0 ? 1 : 4;
  for (let j = 0; j < N; j++) {
    const D = 1.25 * (1 - j / N),
      q = (t, d) => [center[0] + u[0] * t + n[0] * d, center[1] + u[1] * t + n[1] * d];
    solid(
      o,
      'foundation',
      [q(-1.6, 0), q(1.6, 0), q(1.6, D), q(-1.6, D)],
      A.foundationBottom,
      (A.entryThreshold * (j + 1)) / N,
      C.foundation,
      lod > 0,
    );
  }
}
export function buildBethlehemSteelAdministrationBuilding(target, _frame, lod = 3) {
  activeLOD = lod;
  for (const a of [partEvidence, nativeEvidence, openingEvidence, facadeEvidence, roofEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const start = count;
      fn();
      partEvidence.push({ name, triangles: count - start });
    };
  part('whole20-native-footprint-and-raised-basement', () => {
    solid(o, 'foundation', whole, A.foundationBottom, A.plinthTop, C.foundation, lod > 0);
    for (const q of original)
      nativeEvidence.push({ id: 257338315, point: toWorld([q[0], A.plinthTop, q[1]]) });
  });
  part('three-storey-L-shell-beveled-entry-and-physical-sash-recesses', () => facades(o, lod));
  part('pilasters-stringcourse-balustraded-sills-entablature-cornice-parapet', () =>
    cornices(o, lod),
  );
  part('whole-intrinsic-atrium-conservatory-flat-roofs-and-penthouse', () => roofs(o, lod));
  part('intrinsic-beveled-corner-granite-entry-steps', () => entrySteps(o, lod));
}
export const bethlehemSteelAdministrationBuildingSkyline = (o) =>
    buildBethlehemSteelAdministrationBuilding(o, null, 0),
  bethlehemSteelAdministrationBuildingDistrict = (o) =>
    buildBethlehemSteelAdministrationBuilding(o, null, 1),
  bethlehemSteelAdministrationBuildingStreet = (o) =>
    buildBethlehemSteelAdministrationBuilding(o, null, 2),
  bethlehemSteelAdministrationBuildingCloseup = (o) =>
    buildBethlehemSteelAdministrationBuilding(o, null, 3);
export const bethlehemSteelAdministrationBuildingModel = {
  id: 'bethlehem_steel_administration_building',
  key: 'bethlehem_steel_administration_building',
  cell: '9q/9q8',
  title: 'Bethlehem Steel Administration Building',
  wikidataId: 'Q4986442',
  category: p.category,
  recipe: 'bethlehem-steel-administration-building-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBethlehemSteelAdministrationBuilding,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Building101/Pier70 Bethlehem Steel Administration Building: native20-control enduring1917ClassicalRevival Lshell and attached centralatrium, beveledarchedentry/granitesteps/raisedrusticatedbase, pairedlower and tripleuppersashtransoms/realrecesses/two-storyflutedpilasters/spandrels/stringcourse/balustradedsills/entablature/cornice/parapet/partialpenthouse/steelglassatrium and text-supportedrooftopconservatory. Exact cleared published creator-ownPDself exterior first/only, original bounded current hidden/newroofsections/census/finish, not wholeindustrialdistrict or copiedimage.',
  camera: toWorld([-75, 45, 78]),
  lookAt: toWorld([-1, 10, 0]),
  portableGroundY: F - 0.2,
  mediumFiContext: { scale: '1.3', groundY: F - 0.1, cameraYaw: 0.6 },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'stone_limestone_raw',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-street-facades-beveled-corner-and-rooftops',
      position: toWorld([-65, 34, 61]),
      lookAt: toWorld([-2, 9, 0]),
    },
    {
      name: 'whole-native-building101-and-intrinsic-atrium-plan',
      position: toWorld([0, 120, 0.2]),
      lookAt: toWorld([0, 0, 0]),
    },
    {
      name: 'physical-paired-triple-windows-fluted-pilasters-and-arched-entry',
      position: toWorld([-40, 14, 39]),
      lookAt: toWorld([-17, 9, 19]),
    },
    {
      name: 'whole-rear-court-central-atrium-conservatory-and-penthouse',
      position: toWorld([63, 42, -55]),
      lookAt: toWorld([-1, 9, -3]),
    },
    {
      name: 'original-bounded-glass-roof-sections-and-historic-parapet',
      position: toWorld([37, 43, 5]),
      lookAt: toWorld([-8, 15, -7]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/bethlehem-steel-administration-runtime-overlay.mjs',
    level: 'skyline',
    export: 'bethlehemSteelAdministrationBuildingSkyline',
    errorMeters: 5,
    surfaces,
    authoredLevels: {
      district: {
        export: 'bethlehemSteelAdministrationBuildingDistrict',
        errorMeters: 2,
        surfaces,
      },
      street: { export: 'bethlehemSteelAdministrationBuildingStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'bethlehemSteelAdministrationBuildingCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'One exact cleared published2007creator-ownPDself nativeoriginal first/only. Primaryowner/operator/architect text supplies dimensions/restoration/newglassatrium/conservatoryfacts; protectedmodernimages/plans not adopted. No sourcepixels embedded, oldboards/graffiti/furniture/brands/people/vehicles/wires/fences/landscape excluded.',
    'Currentwhole20nativefootprint and enduring1917shell. New/hiddenatrium/conservatory/penthouseroofprofiles/supportcensus/cornice/flutes/rearwindows/fineornament/currentfinish are originalboundedestimates, not measuredsections or precise currentconditions. Actual7+7baystreetfacades photo-bounded, not nativewindowplan. Opaque representative glazing intentionallysimplifiestransmission/interiors.',
    'Originalindependent256m129field/fourrawtiles/floor/sections fixed beforegeometry, nofitting/flattening/reacquire/reframe/lateraise. Exactentry/basement/foundation/streetcontact unverified, preview/replacementfalse. Flatgroundandcontextneighborhouses are fixtures.',
  ],
};

/** Whole native Emlen Physick House; original bounded exterior geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
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
    wall: rgb('aab1a6'),
    trim: rgb('3e4f47'),
    roof: rgb('57625d'),
    brick: rgb('886451'),
    foundation: rgb('b5b1a4'),
    dark: rgb('455551'),
    door: rgb('556454'),
    glass: rgb('66756e'),
  },
  colors = ['a9b0a5', 'a2aa9d', 'b0b7aa'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.1 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  roofEvidence = [],
  porchEvidence = [],
  chimneyEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t,
  mean = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
export const ring = (id) =>
  frame.features
    .find((e) => e.id === `way/${id}`)
    .outline.slice(0, -1)
    .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
const bounds = (r) => ({
  x: Math.min(...r.map((q) => q[0])),
  X: Math.max(...r.map((q) => q[0])),
  z: Math.min(...r.map((q) => q[1])),
  Z: Math.max(...r.map((q) => q[1])),
});
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
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const a = ids[(i + ids.length - 1) % ids.length],
      b = ids[i],
      c = ids[(i + 1) % ids.length];
    if (Math.hypot(...sub(r[a], r[b])) < 1e-6 || Math.abs(cr(r[a], r[b], r[c])) < 1e-8)
      ids.splice(i, 1);
  }
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-8 &&
            cr(r[b], r[c], r[k]) >= -1e-8 &&
            cr(r[c], r[a], r[k]) >= -1e-8,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid house polygon');
  }
  if (ids.length === 3 && Math.abs(cr(...ids.map((i) => r[i]))) > 1e-8) out.push(ids);
  return out;
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
  ],
  box = (o, k, x, X, y, Y, z, Z, col = C[k]) => solid(o, k, rect(x, X, z, Z), y, Y, col);
function record(id, y) {
  for (const q of ring(id)) nativeEvidence.push({ id, local: [q[0], y, q[1]] });
}
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
  h.spring + Math.sqrt(Math.max(0, h.radius * h.radius - (x - h.center) * (x - h.center)));
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
function clip(r, axis, value, less) {
  const out = [],
    test = (q) => (less ? q[axis] <= value + 1e-8 : q[axis] >= value - 1e-8);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      aa = test(a),
      bb = test(b);
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, j) => mix(v, b[j], t)));
    }
  }
  return out.filter((q, i) => Math.hypot(...sub(q, out[(i + out.length - 1) % out.length])) > 1e-6);
}
function roof(o, r, eave, ridge, axis, lod, skipWallSide = null) {
  const b = bounds(r),
    mid = axis === 0 ? (b.x + b.X) / 2 : (b.z + b.Z) / 2,
    half = axis === 0 ? (b.X - b.x) / 2 : (b.Z - b.z) / 2,
    Y = (q) => eave + (ridge - eave) * Math.max(0, 1 - Math.abs(q[axis] - mid) / half);
  for (const less of [true, false]) {
    const rr = clip(r, axis, mid, less);
    if (rr.length >= 3) cap(o, 'roof', rr, Y, true, C.roof);
  }
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    if (i === skipWallSide) continue;
    const a = r[i],
      b = r[(i + 1) % r.length],
      pts = [a];
    if (a[axis] < mid !== b[axis] < mid) {
      const t = (mid - a[axis]) / (b[axis] - a[axis]);
      pts.push(a.map((v, j) => mix(v, b[j], t)));
    }
    pts.push(b);
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1],
        b = pts[j];
      Q(
        o,
        'wall',
        [
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [b[0], Y(b), b[1]],
          [a[0], Y(a), a[1]],
        ],
        [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        C.wall,
      );
    }
    if (lod >= 2) B(o, 'trim', [a[0], eave, a[1]], [b[0], eave, b[1]], 0.13, 0.14, C.trim);
  }
  roofEvidence.push({ outline: r, eave, ridge, axis, originalProfile: true });
}
function backing(o, a, b, depth, holes, lod) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [u[1], -u[0]],
    P = (q) => [a[0] + u[0] * q[0] - n[0] * depth, q[1], a[1] + u[1] * q[0] - n[1] * depth];
  for (const h of holes) {
    const r = [
      [h.center - h.radius, h.bottom],
      [h.center + h.radius, h.bottom],
    ];
    if (h.arch)
      for (let i = 0; i <= [2, 4, 8, 16][lod]; i++) {
        const t = (i * Math.PI) / [2, 4, 8, 16][lod];
        r.push([h.center + h.radius * Math.cos(t), h.spring + h.radius * Math.sin(t)]);
      }
    else r.push([h.center + h.radius, h.top], [h.center - h.radius, h.top]);
    const c = mean(r);
    for (let i = 0; i < r.length; i++)
      T(
        o,
        'dark',
        [P(c), P(r[i]), P(r[(i + 1) % r.length])],
        [n[0], 0, n[1]],
        h.door ? C.door : C.dark,
      );
    if (lod >= 2) {
      const P2 = (q) => [
        a[0] + u[0] * q[0] + n[0] * 0.065,
        q[1],
        a[1] + u[1] * q[0] + n[1] * 0.065,
      ];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        if (lod === 3) B(o, 'trim', P2(a), P2(b), 0.14, 0.14, C.trim);
        else {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            L = Math.hypot(dx, dy),
            nx = (dy / L) * 0.07,
            ny = (-dx / L) * 0.07;
          Q(
            o,
            'trim',
            [
              P2([a[0] - nx, a[1] - ny]),
              P2([b[0] - nx, b[1] - ny]),
              P2([b[0] + nx, b[1] + ny]),
              P2([a[0] + nx, a[1] + ny]),
            ],
            [n[0], 0, n[1]],
            C.trim,
          );
        }
      }
      if (!h.door) {
        B(
          o,
          'trim',
          P([h.center, h.bottom]),
          P([h.center, h.arch ? h.spring + h.radius : h.top]),
          0.055,
          0.06,
          C.trim,
        );
        B(
          o,
          'trim',
          P([h.center - h.radius, (h.bottom + (h.arch ? h.spring : h.top)) / 2]),
          P([h.center + h.radius, (h.bottom + (h.arch ? h.spring : h.top)) / 2]),
          0.055,
          0.06,
          C.trim,
        );
      }
    }
  }
}
function shell(o, r, bottom, top, lod, makeHoles, courses = false) {
  const rr = area(r) > 0 ? r : r.slice().reverse();
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      L = Math.hypot(...sub(b, a)),
      hs = makeHoles?.(a, b, L, i) ?? [];
    wall(o, 'wall', a, b, 0.3, bottom, top, hs, lod, C.wall, courses);
    backing(o, a, b, 0.32, hs, lod);
  }
  cap(o, 'wall', r, top, true, C.wall);
}
function band(o, r, y, width, lod, k = 'trim') {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    B(o, k, [a[0], y, a[1]], [b[0], y, b[1]], width, width, C[k]);
    if (lod >= 2 && y > 12) {
      const L = Math.hypot(...sub(b, a)),
        N = Math.ceil(L / 0.75);
      for (let j = 0; j < N; j++) {
        const q = a.map((v, k) => mix(v, b[k], (j + 0.5) / N));
        box(o, k, q[0] - 0.09, q[0] + 0.09, y - 0.42, y - 0.12, q[1] - 0.09, q[1] + 0.09, C[k]);
      }
    }
  }
}
function loft(o, k, rings, col = C[k], top = false) {
  const center = mean(rings[0].map((q) => [q[0], q[2]]));
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const n = (i + 1) % rings[j].length,
        a = rings[j - 1][i],
        b = rings[j - 1][n],
        c = rings[j][n],
        d = rings[j][i];
      Q(
        o,
        k,
        [a, b, c, d],
        [(a[0] + b[0]) / 2 - center[0], 0.2, (a[2] + b[2]) / 2 - center[1]],
        col,
      );
    }
  if (top) {
    const r = rings.at(-1);
    for (const ix of triangles(r.map((q) => [q[0], q[2]])))
      T(
        o,
        k,
        ix.map((i) => r[i]),
        [0, 1, 0],
        col,
      );
  }
}
function roofHip(o, r, eave, ridge, lod) {
  const b = bounds(r),
    mid = (b.x + b.X) / 2,
    zc = (b.z + b.Z) / 2,
    half = Math.min((b.X - b.x) / 2, (b.Z - b.z) / 2),
    P = [mid, ridge, b.z + half],
    R = [mid, ridge, b.Z - half],
    q = r.map((v) => [v[0], eave, v[1]]);
  Q(o, 'roof', [q[0], q[1], P, P], [0, 1, 0], C.roof);
  Q(o, 'roof', [q[1], q[2], R, P], [1, 1, 0], C.roof);
  Q(o, 'roof', [q[2], q[3], R, R], [0, 1, 1], C.roof);
  Q(o, 'roof', [q[3], q[0], P, R], [-1, 1, 0], C.roof);
  if (lod >= 2 && Math.hypot(...sub(P, R)) > 0.05) B(o, 'trim', P, R, 0.09, 0.1, C.trim);
  roofEvidence.push({ kind: 'original-hip', outline: r, eave, ridge, center: [mid, zc] });
}
function mansard(o, x, X, z, Z, eave, shoulder, ridge, lod, name) {
  const inset = Math.min(A.mainRoofInset, (X - x) * 0.25, (Z - z) * 0.25),
    rings = [
      [eave, x - 0.25, X + 0.25, z - 0.25, Z + 0.25],
      [eave + 0.35, x, X, z, Z],
      [shoulder, x + inset, X - inset, z + inset, Z - inset],
    ].map(([y, x, X, z, Z]) => rect(x, X, z, Z).map((q) => [q[0], y, q[1]]));
  loft(o, 'roof', rings, C.roof);
  roofHip(o, rect(x + inset, X - inset, z + inset, Z - inset), shoulder, ridge, lod);
  if (lod >= 1) band(o, rect(x - 0.25, X + 0.25, z - 0.25, Z + 0.25), eave, 0.18, 0);
  roofEvidence.push({
    kind: 'original-flared-mansard',
    name,
    bounds: { x, X, z, Z },
    eave,
    shoulder,
    ridge,
    inset,
  });
}
function lineStroke(o, a, b, w, col = C.trim, k = 'trim') {
  B(o, k, a, b, w, w, col);
}
function framedBody(o, r, bottom, top, lod, holeMaker, role) {
  shell(o, r, bottom, top, lod, holeMaker, false);
  if (lod < 1) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      d = sub(b, a),
      L = Math.hypot(...d),
      n = [d[1] / L, -d[0] / L];
    for (const y of [bottom + 0.12, A.firstFloorCornice, top - 0.12].filter(
      (y) => y > bottom && y < top,
    ))
      lineStroke(
        o,
        [a[0] + n[0] * 0.06, y, a[1] + n[1] * 0.06],
        [b[0] + n[0] * 0.06, y, b[1] + n[1] * 0.06],
        0.16,
      );
    lineStroke(
      o,
      [a[0] + n[0] * 0.06, bottom, a[1] + n[1] * 0.06],
      [a[0] + n[0] * 0.06, top, a[1] + n[1] * 0.06],
      0.16,
    );
    if (lod >= 2) {
      const N = Math.ceil(L / 2.8);
      for (let j = 1; j < N; j++) {
        const t = j / N,
          u = a[0] + d[0] * t,
          v = a[1] + d[1] * t;
        lineStroke(
          o,
          [u + n[0] * 0.06, A.firstFloorCornice + 0.1, v + n[1] * 0.06],
          [u + n[0] * 0.06, top - 0.1, v + n[1] * 0.06],
          0.1,
        );
      }
      const hs = holeMaker?.(a, b, L, i) ?? [];
      for (const h of hs) {
        if (!h.door) {
          const u = a[0] + (d[0] * h.center) / L,
            v = a[1] + (d[1] * h.center) / L;
          lineStroke(
            o,
            [u + n[0] * 0.02, h.bottom, v + n[1] * 0.02],
            [u + n[0] * 0.02, h.top ?? h.spring, v + n[1] * 0.02],
            0.07,
            C.trim,
          );
        }
      }
    }
  }
  roofEvidence.push({ kind: 'full-wall-body', role, outline: r, top });
}
function windows(
  _a,
  _b,
  L,
  lod,
  role,
  levels = [
    [1.55, 3.7],
    [4.9, 7.1],
  ],
) {
  if (lod === 0 || L < 2) return [];
  const N = Math.max(1, Math.round(L / (lod === 1 ? 5.2 : 3.8))),
    hs = [];
  for (let j = 0; j < N; j++)
    for (const [y, Y] of levels)
      hs.push({ center: (L * (j + 0.5)) / N, radius: 0.52, bottom: y, top: Y, arch: false, role });
  return hs;
}
function profileWithWindow(o, a, b, y, peak, depth, h, lod, k = 'wall') {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [u[1], -u[0]],
    top = (x) => y + (peak - y) * (1 - Math.abs((2 * x) / L - 1)),
    P = (x, y, t = 0) => [a[0] + u[0] * x - n[0] * t, y, a[1] + u[1] * x - n[1] * t],
    cuts = [0, L / 2, L, ...(h ? [h.center - h.radius, h.center + h.radius] : [])].sort(
      (a, b) => a - b,
    );
  for (let i = 1; i < cuts.length; i++) {
    const x = cuts[i - 1],
      X = cuts[i];
    if (X - x < 1e-7) continue;
    const inside = h && (x + X) / 2 > h.center - h.radius && (x + X) / 2 < h.center + h.radius;
    if (inside) {
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [x, y],
          [X, y],
          [X, h.bottom],
          [x, h.bottom],
        ],
        C[k],
      );
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [x, h.top],
          [X, h.top],
          [X, top(X)],
          [x, top(x)],
        ],
        C[k],
      );
    } else
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [x, y],
          [X, y],
          [X, top(X)],
          [x, top(x)],
        ],
        C[k],
      );
  }
  const edge = (x, Y, X, Z, sign) => {
    Q(
      o,
      k,
      [P(x, Y), P(X, Z), P(X, Z, depth), P(x, Y, depth)],
      [sign * u[0] * (Z - Y), -sign * (X - x), sign * u[1] * (Z - Y)],
      C[k],
    );
  };
  edge(0, y, L, y, 1);
  edge(L, y, L / 2, peak, 1);
  edge(L / 2, peak, 0, y, 1);
  if (h) {
    const r = [
      [h.center - h.radius, h.bottom],
      [h.center + h.radius, h.bottom],
      [h.center + h.radius, h.top],
      [h.center - h.radius, h.top],
    ];
    for (let j = 0; j < r.length; j++) edge(...r[j], ...r[(j + 1) % r.length], -1);
    backing(o, a, b, depth + 0.02, [h], lod);
    openingEvidence.push({ a, b, depth, ...h });
  }
  if (lod >= 1)
    for (const [x, Y, X, Z] of [
      [0, y, L / 2, peak],
      [L / 2, peak, L, y],
    ])
      lineStroke(o, P(x, Y, -0.06), P(X, Z, -0.06), 0.18);
}
function porchRoof(o, lod) {
  const rr = ring(261320494),
    r = [rr[0], ...rr.slice(5).reverse()],
    coreFront = A.mainFrontU,
    frontRoof = clip(rr, 0, coreFront + 0.02, true),
    sideRoof = clip(clip(rr, 1, A.mainNorthV, true), 0, coreFront, false);
  for (const poly of [frontRoof, sideRoof])
    if (poly.length >= 3) {
      const out = poly.map((q) => [q[0], A.porchEave, q[1]]),
        center = mean(poly),
        inner = poly.map((q) => [
          center[0] + (q[0] - center[0]) * 0.6,
          A.porchRidge,
          center[1] + (q[1] - center[1]) * 0.6,
        ]);
      loft(o, 'roof', [out, inner], C.roof, true);
      cap(o, 'wall', poly, A.porchEave - 0.1, false, C.wall);
    }
  const sign = area(rr) > 0 ? 1 : -1;
  for (let i = 4; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length];
    if (i >= 4) {
      const d = sub(b, a),
        L = Math.hypot(...d);
      if (L < 0.4) continue;
      const N = Math.max(1, Math.round(L / (lod === 0 ? 4.5 : 2.6))),
        n = [(sign * d[1]) / L, (-sign * d[0]) / L];
      for (let j = 0; j <= N; j++) {
        const t = j / N,
          u = a[0] + d[0] * t,
          v = a[1] + d[1] * t;
        box(o, 'trim', u - 0.075, u + 0.075, A.deckTop, A.porchEave, v - 0.075, v + 0.075, C.trim);
        if (lod >= 2) {
          const step = lod === 2 ? 2 : 5;
          for (const dir of [-1, 1]) {
            let prev = [u, A.porchEave - 0.95, v];
            for (let k = 1; k <= step; k++) {
              const ang = ((k / step) * Math.PI) / 2,
                ss = 0.9 * (1 - Math.cos(ang)),
                yy = A.porchEave - 0.95 + 0.85 * Math.sin(ang),
                q = [u + (d[0] / L) * dir * ss, yy, v + (d[1] / L) * dir * ss];
              lineStroke(o, prev, q, 0.12);
              prev = q;
            }
          }
        }
        if (lod >= 1) {
          box(
            o,
            'trim',
            u - 0.14,
            u + 0.14,
            A.deckTop,
            A.deckTop + 0.15,
            v - 0.14,
            v + 0.14,
            C.trim,
          );
          box(
            o,
            'trim',
            u - 0.12,
            u + 0.12,
            A.porchEave - 0.18,
            A.porchEave,
            v - 0.12,
            v + 0.12,
            C.trim,
          );
        }
      }
      lineStroke(o, [a[0], A.porchEave, a[1]], [b[0], A.porchEave, b[1]], 0.18);
      if (lod >= 1) {
        const P = (t, y) => [a[0] + d[0] * t + n[0] * 0.02, y, a[1] + d[1] * t + n[1] * 0.02];
        for (const y of [A.deckTop + 0.07, A.porchEave - 0.2])
          lineStroke(o, P(0, y), P(1, y), 0.16);
      }
    }
  }
  const frontU = Math.min(...rr.map((q) => q[0])),
    V0 = 1.3,
    N = lod === 0 ? 3 : 6;
  for (let i = 0; i < N; i++)
    box(
      o,
      'foundation',
      frontU - 1.5 + i * 0.25,
      frontU + 0.06,
      0.02,
      (A.deckTop * (i + 1)) / N,
      V0 - 1.0,
      V0 + 1.0,
      C.foundation,
    );
  porchEvidence.push({
    wholeNativeOutline: true,
    frontRoof,
    sideRoof,
    arcaded: true,
    openAir: true,
    groundDeck: A.deckTop,
  });
  void r;
}
function mainHouse(o, lod) {
  const r = rect(A.mainFrontU, A.mainBackU, A.mainNorthV, A.mainSouthV);
  framedBody(
    o,
    r,
    A.deckTop,
    A.mainEave,
    lod,
    (a, b, L, i) => {
      const hs = windows(a, b, L, lod, 'mainhouse-sash-window');
      if (lod > 0 && i === 3) {
        const center = L * 0.43;
        return hs
          .filter((h) => Math.abs(h.center - center) > 1.1)
          .concat([
            {
              center,
              radius: 0.65,
              bottom: A.deckTop + 0.05,
              top: 3.6,
              arch: false,
              door: true,
              role: 'recessed-front-door',
            },
          ]);
      }
      return hs;
    },
    'whole-mainbody',
  );
  mansard(
    o,
    A.mainFrontU,
    A.mainBackU,
    A.mainNorthV,
    A.mainSouthV,
    A.mainEave,
    A.mansardShoulder,
    A.mainRidge,
    lod,
    'main-whole-mansard',
  );
  const bay = rect(
    A.mainFrontU - A.frontBayDepth,
    A.mainFrontU + 2.8,
    A.frontBayNorthV,
    A.frontBaySouthV,
  );
  framedBody(
    o,
    bay,
    A.deckTop,
    A.bayEave,
    lod,
    (a, b, L, i) => (i === 3 ? windows(a, b, L, lod, 'front-projecting-bay-sash') : []),
    'original-front-projection',
  );
  mansard(
    o,
    bay[0][0],
    bay[1][0],
    bay[0][1],
    bay[2][1],
    A.bayEave,
    10.9,
    A.bayRidge,
    lod,
    'projecting-front-hip',
  );
}
function dormers(o, lod) {
  for (let j = 0; j < A.dormerCentersV.length; j++) {
    const v = A.dormerCentersV[j],
      x = A.mainFrontU - (j === 0 ? A.frontBayDepth : 0) - 0.25,
      width = 2.25,
      depth = 2.8,
      a = [x, v + width / 2],
      b = [x, v - width / 2],
      h =
        lod === 0
          ? null
          : {
              center: width / 2,
              radius: 0.79,
              bottom: A.dormerBottom + 0.2,
              top: A.dormerEave - 0.12,
              arch: false,
              role: 'front-jerkinhead-dormer-recess',
            };
    wall(o, 'wall', a, b, 0.18, A.dormerBottom, A.dormerEave, h ? [h] : [], lod, C.wall, false);
    if (h) backing(o, a, b, 0.2, [h], lod);
    const clipY = A.dormerRidge - 0.55,
      clipR = ((width / 2) * (A.dormerRidge - clipY)) / (A.dormerRidge - A.dormerEave),
      cut = width / 2 - clipR,
      pr = [
        [0, A.dormerEave],
        [width, A.dormerEave],
        [width - cut, clipY],
        [cut, clipY],
      ],
      P = (q, d = 0) => [x + d, q[1], v + width / 2 - q[0]];
    piece(o, 'wall', a, b, 0.18, pr, C.wall);
    for (let i = 0; i < pr.length; i++) {
      const q = pr[i],
        r = pr[(i + 1) % pr.length],
        dy = r[1] - q[1],
        dx = r[0] - q[0];
      Q(o, 'wall', [P(q), P(r), P(r, 0.18), P(q, 0.18)], [0, -dx, -dy], C.wall);
      if (lod >= 1 && i !== 0) lineStroke(o, P(q, -0.07), P(r, -0.07), 0.16);
    }
    const fL = [x, A.dormerEave, v - width / 2],
      fR = [x, A.dormerEave, v + width / 2],
      bL = [x + depth, A.dormerEave, v - width / 2],
      bR = [x + depth, A.dormerEave, v + width / 2],
      rF = [x + 0.52, A.dormerRidge, v],
      rB = [x + depth, A.dormerRidge, v],
      cL = [x, clipY, v - clipR],
      cR = [x, clipY, v + clipR];
    for (const poly of [
      [fL, bL, rB, rF, cL],
      [fR, cR, rF, rB, bR],
      [cL, rF, cR],
    ])
      for (let i = 1; i < poly.length - 1; i++)
        T(o, 'roof', [poly[0], poly[i], poly[i + 1]], [0, 1, 0], C.roof);
    T(o, 'wall', [bL, bR, rB], [1, 0, 0], C.wall);
    for (const vv of [v - width / 2, v + width / 2])
      Q(
        o,
        'wall',
        [
          [x, A.dormerBottom, vv],
          [x + depth, A.dormerBottom, vv],
          [x + depth, A.dormerEave, vv],
          [x, A.dormerEave, vv],
        ],
        [0, 0, vv > v ? 1 : -1],
        C.wall,
      );
    if (lod >= 1) {
      for (const vv of [v - width / 2, v + width / 2])
        lineStroke(o, [x - 0.12, A.dormerEave, vv], [x - 0.12, A.dormerEave - 0.38, vv], 0.13);
      lineStroke(o, rF, rB, 0.09);
    }
    roofEvidence.push({
      kind: 'jerkinhead-front-dormer',
      v,
      x,
      clippedFrontY: clipY,
      ridge: A.dormerRidge,
      glazed: lod > 0,
    });
  }
}
function crossGable(o, lod) {
  const x = A.crossGableCenterU - A.crossGableWidth / 2,
    X = x + A.crossGableWidth,
    z = A.mainSouthV - 0.8,
    Z = A.crossGableFrontV,
    r = rect(x, X, z, Z);
  framedBody(
    o,
    r,
    A.deckTop,
    A.crossGableEave,
    lod,
    (a, b, L, i) => (i === 2 ? windows(a, b, L, lod, 'southwest-crossgable-sash') : []),
    'southwest-projecting-gable',
  );
  const a = [X, Z],
    b = [x, Z],
    h =
      lod === 0
        ? null
        : {
            center: A.crossGableWidth / 2,
            radius: 0.82,
            bottom: 8.6,
            top: 10.4,
            arch: false,
            role: 'southwest-gable-attic-recess',
          };
  profileWithWindow(o, a, b, A.crossGableEave, A.crossGableRidge, 0.2, h, lod);
  roof(o, rect(x - 0.15, X + 0.15, z - 3, Z + 0.2), A.crossGableEave, A.crossGableRidge, 0, lod, 2);
  if (lod >= 2) {
    for (const u of [x + 0.2, X - 0.2]) {
      lineStroke(o, [u, 6.9, Z + 0.08], [u, A.crossGableEave, Z + 0.08], 0.16);
      lineStroke(o, [u, 7.05, Z + 0.08], [u + (u < x + 1 ? 0.5 : -0.5), 7.7, Z + 0.08], 0.16);
    }
    const hood = rect(A.crossGableCenterU - 1.12, A.crossGableCenterU + 1.12, Z + 0.12, Z + 0.7);
    roof(o, hood, 10.4, 10.72, 1, lod);
  }
  roofEvidence.push({
    kind: 'southwest-overhanging-crossgable',
    frontV: Z,
    centerU: A.crossGableCenterU,
    window: h,
  });
}
function rearWing(o, lod) {
  const whole = ring(261320494),
    r = clip(whole, 0, A.mainBackU, false);
  framedBody(
    o,
    r,
    A.deckTop,
    A.rearEave,
    lod,
    (a, b, L) =>
      windows(a, b, L, lod, 'rear-wing-sash-window', [
        [1.55, 3.6],
        [4.75, 5.8],
      ]),
    'whole-native-rearwing',
  );
  roof(o, r, A.rearEave, A.rearRidge, 1, lod);
  roofEvidence.push({ kind: 'whole-native-rearwing', outline: r, nativeControlIndices: [1, 2, 3] });
}
function chimney(o, c, lod) {
  const half = 0.47,
    capHalf = 0.68,
    capBottom = c.shoulder,
    base = rect(c.u - half, c.u + half, c.v - half, c.v + half);
  solid(o, 'brick', base, c.bottom, capBottom, C.brick);
  loft(
    o,
    'brick',
    [
      base.map((q) => [q[0], capBottom, q[1]]),
      rect(c.u - capHalf, c.u + capHalf, c.v - capHalf, c.v + capHalf).map((q) => [
        q[0],
        capBottom + 0.65,
        q[1],
      ]),
    ],
    C.brick,
  );
  const rr = rect(c.u - capHalf, c.u + capHalf, c.v - capHalf, c.v + capHalf);
  solid(o, 'brick', rr, capBottom + 0.65, c.top, C.brick, false, lod === 0);
  if (lod > 0) {
    const inner = rect(c.u - 0.32, c.u + 0.32, c.v - 0.38, c.v + 0.38);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q(
        o,
        'brick',
        [
          [rr[i][0], c.top, rr[i][1]],
          [rr[j][0], c.top, rr[j][1]],
          [inner[j][0], c.top, inner[j][1]],
          [inner[i][0], c.top, inner[i][1]],
        ],
        [0, 1, 0],
        C.brick,
      );
      Q(
        o,
        'brick',
        [
          [inner[i][0], c.top, inner[i][1]],
          [inner[j][0], c.top, inner[j][1]],
          [inner[j][0], c.top - 0.55, inner[j][1]],
          [inner[i][0], c.top - 0.55, inner[i][1]],
        ],
        [c.u - inner[i][0], 0, c.v - inner[i][1]],
        C.brick,
      );
    }
    cap(o, 'dark', inner, c.top - 0.55, true, C.dark);
    for (const y of [c.shoulder - 0.2, c.shoulder + 0.5, c.top - 0.2])
      band(o, rr, y, 0.13, 0, 'brick');
  }
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      const u = c.u + side * (capHalf + 0.012);
      for (const y of [c.top - 1.15, c.shoulder + 0.1])
        Q(
          o,
          'brick',
          [
            [u, y - 0.035, c.v - 0.29],
            [u, y - 0.035, c.v + 0.29],
            [u, y + 0.035, c.v + 0.29],
            [u, y + 0.035, c.v - 0.29],
          ],
          [side, 0, 0],
          rgb('b39d84'),
        );
    }
  }
  chimneyEvidence.push({ ...c, openTop: lod > 0, invertedStepped: true });
}
export function buildEmlenPhysickHouse(o, _frame, lod = 3) {
  for (const a of [
    nativeEvidence,
    openingEvidence,
    roofEvidence,
    porchEvidence,
    chimneyEvidence,
    partEvidence,
  ])
    a.length = 0;
  let count = 0;
  const target = o;
  o = {
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
  };
  const part = (name, run) => {
    const start = count;
    run();
    partEvidence.push({ name, triangles: count - start });
  };
  part('whole-native-foundation-deck', () => {
    solid(
      o,
      'foundation',
      ring(261320494),
      A.foundationBottom,
      A.deckTop,
      C.foundation,
      lod > 0,
      true,
    );
    record(261320494, A.deckTop);
  });
  part('main-house-flared-mansard-front-projection', () => mainHouse(o, lod));
  part('whole-native-rearwing', () => rearWing(o, lod));
  part('arcaded-front-and-side-porch', () => porchRoof(o, lod));
  part('jerkinhead-dormers-and-southwest-crossgable', () => {
    dormers(o, lod);
    crossGable(o, lod);
  });
  part('two-stepped-inverted-chimneys', () => {
    for (const c of A.chimneys) chimney(o, c, lod);
  });
}
export const emlenPhysickHouseSkyline = (o) => buildEmlenPhysickHouse(o, null, 0),
  emlenPhysickHouseDistrict = (o) => buildEmlenPhysickHouse(o, null, 1),
  emlenPhysickHouseStreet = (o) => buildEmlenPhysickHouse(o, null, 2),
  emlenPhysickHouseCloseup = (o) => buildEmlenPhysickHouse(o, null, 3);
export const emlenPhysickHouseModel = {
  id: 'emlen_physick_house',
  key: 'emlen_physick_house',
  cell: 'dq/dqf',
  title: 'Emlen Physick House',
  wikidataId: 'Q5372658',
  category: p.category,
  recipe: 'emlen-physick-house-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildEmlenPhysickHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole restored1879 Emlen Physick House, the actual named/pictured house selected for CapeMay Victorian story. Native12-control whole house/attachedrearwing/porches, flared mansard/hip roofs/jerkinhead dormers/projecting southwestcrossgable, inverted stepped tall brick chimneys, exposed stickwork/woodclapboards/arcaded porch/heavycurved braces/physical sash-window and door recesses. Exact cleared published1961 JackBoucher/HABS federal photo first/only. Hidden profiles/heights/census/currentpaint-finish/contact are original bounded estimates; no copied sourcepixels/interiors/estateoutbuildings/gardens. Geographicpreview/replacementfalse.',
  camera: toWorld([-49, 27, 46]),
  lookAt: toWorld([0, 6, 0]),
  portableGroundY: F - 0.23,
  mediumFiContext: { scale: '1.1', groundY: F - 0.1, cameraYaw: Math.PI / 2 },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'wood_plain',
    'slate',
    'brick_flemish',
    'stone_limestone_raw',
  ],
  qaCameras: [
    {
      name: 'whole-rear-wing-and-main-house',
      position: toWorld([54, 30, -44]),
      lookAt: toWorld([1, 6, 0]),
    },
    {
      name: 'northwest-arcaded-porch-mansard-dormers-and-stepped-chimneys',
      position: toWorld([-41, 15, 14]),
      lookAt: toWorld([-6, 7, 0]),
    },
    {
      name: 'whole-native-house-rearwing-and-porch-plan',
      position: [0.1, F + 100, 0.15],
      lookAt: [0, F + 4, 0],
    },
    {
      name: 'southwest-projecting-crossgable-and-stickwork',
      position: toWorld([8, 13, 41]),
      lookAt: toWorld([0, 7, 5]),
    },
    {
      name: 'porch-true-open-volume-and-sash-recesses',
      position: toWorld([-21, 4, 8]),
      lookAt: toWorld([-9, 2.8, 1]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/emlen-physick-house-runtime-overlay.mjs',
    level: 'skyline',
    export: 'emlenPhysickHouseSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'emlenPhysickHouseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'emlenPhysickHouseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'emlenPhysickHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Exact1961JackBoucher/HABS PD-USGov published Qualla original personally inspected/nativeSHA1matched/unchangedguardpassed; no supplemental/questionable imagery/source-rights repair/reclassification/bypass. Currentstateoperator andstatepreservation factual descriptions support enduring restored1879shell. B&W reference cannot certify currentcolors; palette/fineornament/hiddenparts/window-chimneycensus/preciseprofiles original bounded estimates. No estate/garden/furniture/sourcepixel geometry.',
    'Originalindependent256m129x12916641sample/two rawtiles/SW2.5735m datum/fixednativebbox/heading0 beforefloor.2126m andallarchitecturalchoices. No latefit/flatten/reacquire/reframe/floorretune/modelraise. Ground/basement/thresholdcontact unverified; geographicpreview/replacementfalse. Portableflatground/contexthouses are fixtures.',
  ],
};

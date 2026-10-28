/** Whole native Larnach Castle, attached ballroom and connected extension; original bounded sections. */
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
    wall: rgb('ac9674'),
    trim: rgb('d5d0bd'),
    metal: rgb('deded0'),
    roof: rgb('545b59'),
    dark: rgb('394e4b'),
    door: rgb('6b5941'),
  },
  colors = ['9e8c73', 'b09b78', 'a18e70', 'b9a480', '8c8270'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.1 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  roofEvidence = [],
  verandaEvidence = [],
  towerEvidence = [];
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
    if (!found) throw Error('Invalid castle polygon');
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
function roof(o, r, eave, ridge, axis, lod) {
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
    if (lod >= 2) B(o, 'metal', [a[0], eave, a[1]], [b[0], eave, b[1]], 0.13, 0.14, C.metal);
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
          'metal',
          P([h.center, h.bottom]),
          P([h.center, h.arch ? h.spring + h.radius : h.top]),
          0.055,
          0.06,
          C.metal,
        );
        B(
          o,
          'metal',
          P([h.center - h.radius, (h.bottom + (h.arch ? h.spring : h.top)) / 2]),
          P([h.center + h.radius, (h.bottom + (h.arch ? h.spring : h.top)) / 2]),
          0.055,
          0.06,
          C.metal,
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
function battlements(o, r, y, Y, lod) {
  const b = bounds(r);
  if (lod === 0) {
    for (const u of [b.x, b.X])
      for (const v of [b.z, b.Z])
        box(o, 'wall', u - 0.25, u + 0.25, y, Y, v - 0.25, v + 0.25, C.wall);
    return;
  }
  solid(o, 'wall', r, y - 0.6, y, C.wall, false, false);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      bb = r[(i + 1) % r.length],
      d = sub(bb, a),
      L = Math.hypot(...d),
      u = d.map((v) => v / L),
      n = [u[1], -u[0]],
      N = Math.max(2, Math.round(L / 1.6));
    for (let j = 0; j < N; j++) {
      const c = ((j + 0.5) * L) / N,
        w = (L / N) * 0.52,
        aa = [a[0] + u[0] * (c - w / 2), a[1] + u[1] * (c - w / 2)],
        b = [a[0] + u[0] * (c + w / 2), a[1] + u[1] * (c + w / 2)],
        q = [aa, b, b.map((v, k) => v - n[k] * 0.46), aa.map((v, k) => v - n[k] * 0.46)];
      solid(o, 'wall', q, y, Y, C.wall);
      if (lod >= 2) cap(o, 'trim', q, Y + 0.06, true, C.trim);
    }
  }
}
function veranda(o, a, b, inner, lod, label) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [u[1], -u[0]],
    P = (s, y, depth = 0) => [a[0] + u[0] * s - n[0] * depth, y, a[1] + u[1] * s - n[1] * depth],
    q = [a, b, b.map((v, k) => v - n[k] * inner), a.map((v, k) => v - n[k] * inner)];
  for (const y of [A.podiumTop, A.verandaIntermediate, A.verandaEave]) {
    cap(o, 'trim', q, y, true, C.trim);
    if (y > 1) cap(o, 'trim', q, y - 0.14, false, C.trim);
  }
  const N = Math.max(1, Math.round(L / (lod === 0 ? 5 : 2.65)));
  for (let i = 0; i < N; i++) {
    const s = (i * L) / N,
      t = ((i + 1) * L) / N;
    for (const [y, Y] of [
      [0.35, A.verandaIntermediate - 0.15],
      [A.verandaIntermediate + 0.16, A.verandaEave - 0.2],
    ]) {
      Q(
        o,
        'dark',
        [P(s, y, 0.075), P(t, y, 0.075), P(t, Y, 0.075), P(s, Y, 0.075)],
        [n[0], 0, n[1]],
        C.dark,
      );
      if (lod >= 2) {
        B(o, 'metal', P(s, y), P(s, Y), 0.12, 0.12, C.metal);
        B(o, 'metal', P((s + t) / 2, y), P((s + t) / 2, Y), 0.055, 0.07, C.metal);
        B(o, 'metal', P(s, Y - 0.5), P(t, Y - 0.5), 0.08, 0.08, C.metal);
        if (lod >= 2) {
          for (const v of [s, t]) {
            B(
              o,
              'metal',
              P(v + 0.35 * (v === s ? 1 : -1), Y - 0.1),
              P(v, Y - 0.6),
              0.06,
              0.06,
              C.metal,
            );
          }
          const panels = lod === 2 ? 0 : 4;
          for (let j = 0; j < panels; j++) {
            const l = s + ((t - s) * j) / panels,
              r = s + ((t - s) * (j + 1)) / panels;
            for (const z of [
              [l, r],
              [r, l],
            ])
              B(o, 'metal', P(z[0], y + 0.12), P(z[1], y + 0.82), 0.025, 0.035, C.metal);
          }
        }
      }
    }
  }
  if (lod >= 1) {
    for (const y of [
      0.45,
      1.25,
      A.verandaIntermediate - 0.08,
      A.verandaIntermediate + 0.12,
      A.verandaIntermediate + 1.05,
      A.verandaEave - 0.08,
    ])
      B(o, 'metal', P(0, y), P(L, y), 0.1, 0.1, C.metal);
    for (let j = 0; j <= N; j++)
      B(o, 'metal', P((L * j) / N, 0.2), P((L * j) / N, A.verandaEave), 0.16, 0.16, C.metal);
  }
  verandaEvidence.push({
    label,
    a,
    b,
    depth: inner,
    glazed: true,
    twoStoreys: true,
    outward: [n[0], 0, n[1]],
    floorLevels: [A.podiumTop, A.verandaIntermediate, A.verandaEave],
  });
}
function tower(o, lod) {
  const r = ring(288613442),
    vs = r.slice(5, 9).map((q) => q[1]),
    z = Math.min(...vs),
    Z = Math.max(...vs),
    x = A.towerFrontU,
    X = A.towerBackU,
    poly = rect(x, X, z, Z);
  const holes = (_a, _b, L, i) => {
    if (lod === 0) return [];
    if (i === 3)
      return [
        {
          center: L / 2,
          radius: 1.28,
          bottom: A.verandaIntermediate,
          spring: 6.1,
          arch: true,
          door: true,
          role: 'recessed-arched-front-entry',
        },
        ...[-0.69, 0.69].map((d) => ({
          center: L / 2 + d,
          radius: 0.59,
          bottom: 9.1,
          spring: 12.3,
          arch: true,
          role: 'paired-middle-arched-tower-window',
        })),
        ...[-1.27, 0, 1.27].map((d) => ({
          center: L / 2 + d,
          radius: 0.49,
          bottom: 15.3,
          top: 18.5,
          arch: false,
          role: 'triple-upper-tower-window',
        })),
      ];
    if (L > 4.5)
      return [
        {
          center: L / 2,
          radius: 0.56,
          bottom: 15.3,
          top: 18.5,
          arch: false,
          role: 'original-side-tower-window',
        },
      ];
    return [];
  };
  shell(o, poly, A.podiumTop, A.towerCornice, lod, holes, lod >= 2);
  if (lod >= 1) {
    band(o, poly, 8.55, 0.2, 0);
    band(o, poly, 14.3, 0.2, 0);
    band(o, poly, A.towerCornice, 0.36, lod);
    band(o, poly, 0.42, 0.3, 0);
  }
  battlements(o, poly, A.towerCornice + 0.2, A.towerParapet, lod);
  if (lod >= 1) {
    const tx = X - 1.35,
      tz = z + 1.15,
      rr = rect(tx - 0.95, tx + 0.95, tz - 0.95, tz + 0.95);
    solid(o, 'wall', rr, 15.5, A.stairTurretTop - 0.8, C.wall);
    battlements(o, rr, A.stairTurretTop - 0.8, A.stairTurretTop, lod);
    B(o, 'metal', [tx, A.stairTurretTop, tz], [tx, A.flagpoleTop, tz], 0.055, 0.055, C.metal);
  }
  const steps = lod === 0 ? 4 : lod === 1 ? 8 : 16,
    front = A.stairFrontU;
  for (let i = 0; i < steps; i++) {
    const end = mix(front, x, i / steps),
      end2 = mix(front, x, (i + 1) / steps),
      y = (A.verandaIntermediate * (i + 1)) / steps;
    box(o, 'trim', end, end2 + 0.025, A.podiumTop, y, z + 0.45, Z - 0.45, C.trim);
  }
  if (lod >= 1) {
    for (const v of [z + 0.13, Z - 0.13])
      B(o, 'trim', [front, 0.65, v], [x, A.verandaIntermediate + 0.65, v], 0.34, 0.34, C.trim);
  }
  towerEvidence.push({
    x,
    X,
    z,
    Z,
    centralTower: true,
    entryArched: true,
    crenellated: true,
    upperWindows: 3,
    stairTurret: lod > 0,
    originalSections: true,
  });
}
function house(o, lod) {
  const core = rect(A.coreFrontU, A.coreBackU, A.coreNorthV, A.coreSouthV);
  shell(
    o,
    core,
    A.podiumTop,
    A.mainUpperCornice,
    lod,
    (a, b, L, i) => {
      if (lod === 0) return [];
      const N = i === 3 ? 4 : i === 1 ? 4 : 3,
        hs = [];
      for (let j = 0; j < N; j++) {
        const center = (L * (j + 0.5)) / N;
        if (i === 3) {
          const v = a[1] + ((b[1] - a[1]) * center) / L;
          if (Math.abs(v - A.towerCenterV) < 3.4) continue;
        }
        for (const [y, Y] of lod === 1
          ? [[9.5, 12.6]]
          : [
              [0.75, 3.2],
              [4.8, 7.8],
              [9.5, 12.6],
            ])
          hs.push({
            center,
            radius: 0.62,
            bottom: y,
            top: Y,
            arch: false,
            role: 'original-house-recessed-window',
          });
      }
      return hs;
    },
    lod >= 2,
  );
  roof(o, core, A.mainUpperCornice - 0.1, A.mainHiddenRoofRidge, 0, lod);
  if (lod >= 1) {
    band(o, core, 8.8, 0.22, 0);
    band(o, core, A.mainUpperCornice, 0.35, lod);
  }
  battlements(o, core, A.mainUpperCornice + 0.15, A.mainParapet, lod);
  const towerVs = ring(288613442)
      .slice(5, 9)
      .map((q) => q[1]),
    tz = Math.min(...towerVs),
    tZ = Math.max(...towerVs);
  veranda(
    o,
    [A.frontU, tz],
    [A.frontU, A.northV],
    A.verandaDepth,
    lod,
    'north-front-two-storey-glazed-veranda',
  );
  veranda(
    o,
    [A.frontU, A.southV],
    [A.frontU, tZ],
    A.verandaDepth,
    lod,
    'south-front-two-storey-glazed-veranda',
  );
  veranda(
    o,
    [A.frontU, A.northV],
    [A.coreBackU, A.northV],
    2.8,
    lod,
    'north-return-two-storey-glazed-veranda',
  );
  veranda(
    o,
    [A.coreBackU, A.southV],
    [A.frontU, A.southV],
    2.6,
    lod,
    'south-return-two-storey-glazed-veranda',
  );
  if (lod >= 1) {
    for (const v of [A.coreNorthV + 1.8, A.coreSouthV - 1.8]) {
      const u = A.coreBackU - 2.1;
      box(o, 'wall', u - 0.95, u + 0.95, 12.7, 15.5, v - 1.7, v + 1.7, C.wall);
      if (lod >= 2) {
        for (let i = 0; i < 4; i++) {
          const vv = v - 1.35 + i * 0.9;
          box(o, 'trim', u - 0.18, u + 0.18, 15.45, 16.5, vv - 0.22, vv + 0.22, C.trim);
          box(o, 'trim', u - 0.26, u + 0.26, 16.5, 16.7, vv - 0.3, vv + 0.3, C.trim);
        }
      } else box(o, 'trim', u - 0.25, u + 0.25, 15.5, 16.4, v - 1.55, v + 1.55, C.trim);
    }
  }
}
function wholeLowWings(o, lod) {
  const r = ring(288613442),
    south = r.slice(27, 46),
    ballroom = clip(south, 1, A.ballroomBreakV, false),
    connector = clip(south, 1, A.ballroomBreakV, true),
    rear = clip(r, 0, A.coreBackU, false),
    ext = ring(1297514177);
  for (const [poly, eave, ridge, name] of [
    [ballroom, A.ballroomEave, A.ballroomRidge, 'native-attached-ballroom'],
    [connector, A.connectorEave, A.connectorRidge, 'native-long-connector'],
    [rear, A.rearWingEave, A.rearWingRidge, 'native-rear-service-wings'],
    [ext, A.northExtensionEave, A.northExtensionRidge, 'native-connected-north-layer1-extension'],
  ]) {
    if (poly.length < 3) continue;
    shell(
      o,
      poly,
      A.podiumTop,
      eave,
      lod,
      (_a, _b, L) => {
        if (lod === 0 || L < 5 || (lod === 1 && name !== 'native-attached-ballroom')) return [];
        const N = Math.max(
            1,
            Math.round(L / (lod === 1 ? 9 : name === 'native-attached-ballroom' ? 4.6 : 5)),
          ),
          hs = [];
        for (let i = 0; i < N; i++)
          hs.push({
            center: (L * (i + 0.5)) / N,
            radius: name === 'native-attached-ballroom' ? 0.75 : 0.47,
            bottom: name === 'native-attached-ballroom' ? 1.1 : 0.8,
            top: eave - 1,
            arch: false,
            role: `${name}-original-window`,
          });
        return hs;
      },
      lod === 3,
    );
    roof(o, poly, eave, ridge, 0, lod);
  }
}
export function buildLarnachCastle(o, _frame, lod = 3) {
  for (const a of [
    nativeEvidence,
    openingEvidence,
    roofEvidence,
    verandaEvidence,
    towerEvidence,
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
    const n = count;
    run();
    partEvidence.push({ name, triangles: count - n });
  };
  part('whole-native-foundations', () => {
    for (const id of [288613442, 1297514177]) {
      solid(o, 'wall', ring(id), A.foundationBottom, A.podiumTop, C.wall, false, lod > 0);
      record(id, A.podiumTop);
    }
  });
  part('whole-main-house-and-glazed-verandas', () => house(o, lod));
  part('central-tower-steps-and-turret', () => tower(o, lod));
  part('whole-ballroom-connector-rear-and-north-extension', () => wholeLowWings(o, lod));
}
export const larnachCastleSkyline = (o) => buildLarnachCastle(o, null, 0),
  larnachCastleDistrict = (o) => buildLarnachCastle(o, null, 1),
  larnachCastleStreet = (o) => buildLarnachCastle(o, null, 2),
  larnachCastleCloseup = (o) => buildLarnachCastle(o, null, 3);
export const larnachCastleModel = {
  id: 'larnach_castle',
  key: 'larnach_castle',
  cell: 'pz/pzc',
  title: 'Larnach Castle',
  wikidataId: 'Q1759455',
  category: p.category,
  recipe: 'larnach-castle-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildLarnachCastle,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole current Larnach Castle: native46-control mainhouse/attached long ballroom/connector/rearwings plus shared-node six-control north extension. Warm rubble masonry/lighttrim, projecting crenellated Gothic tower/stairturret/arched entrance/steps/triplewindows, enclosed two-storey white-ironwork verandas on three sides, chimney groups/slate roofs. Exact published creator-own PD-self Qualla original first/only. Full native scope retained; uppersections/profiles/fineornament/window-chimneycensus/hiddenjoins/north-extensionuse/currentfinish/groundcontact original bounded estimates. Geographic preview/replacementfalse; no copied sourcepixels, garden/fountain/lodge/stables.',
  camera: [-120, F + 58, 95],
  lookAt: [0, F + 9, 0],
  portableGroundY: F - 0.23,
  mediumFiContext: { scale: '1.1', groundY: F - 0.1, cameraYaw: Math.PI },
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_limestone_raw', 'metal_painted', 'slate'],
  qaCameras: [
    {
      name: 'whole-main-house-ballroom-and-rear-wing',
      position: toWorld([100, 62, 80]),
      lookAt: toWorld([0, 8, 0]),
    },
    {
      name: 'front-tower-arched-entrance-steps-and-glazed-verandas',
      position: toWorld([-64, 20, A.towerCenterV]),
      lookAt: toWorld([-8, 10, A.towerCenterV]),
    },
    {
      name: 'whole-native-footprint-ballroom-and-connected-north-extension-plan',
      position: [0.1, F + 180, 0.15],
      lookAt: [0, F + 4, 0],
    },
    {
      name: 'white-veranda-ironwork-masonry-and-tower-windows',
      position: toWorld([-36, 12, A.towerCenterV + 17]),
      lookAt: toWorld([-9, 7, A.towerCenterV + 6]),
    },
    {
      name: 'whole-attached-ballroom-and-connector',
      position: toWorld([-60, 28, 74]),
      lookAt: toWorld([-6, 4, 17]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/larnach-castle-runtime-overlay.mjs',
    level: 'skyline',
    export: 'larnachCastleSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'larnachCastleDistrict', errorMeters: 0.75, surfaces },
      street: { export: 'larnachCastleStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'larnachCastleCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'One exact published2013 Pseudopanax own/PD-self original, individually viewed/nativeSHA1matched and unchanged published guard passed. Other entrance/unrelated Dunedin sources unselected; no supplemental or rights repair/reclassification/bypass. Primary heritage/government architectural facts only; no protected additional imagery/plans or source pixels. Fine sculpture/lion artwork deliberately simplified/omitted, no interiors.',
    'Original independent256m129x12916641sample/two raw tile field/fixed union-bbox anchor/heading0/SW288.0381m providerdatum frozen before floor11.8058m/sections/geometry. No fitting/flattening/reacquisition/reframing/late floor or modelraise. Precise hillside threshold/foundation/basement contact unverified; preview/replacementfalse. Portableflatground/contexthouses are fixtures.',
  ],
};

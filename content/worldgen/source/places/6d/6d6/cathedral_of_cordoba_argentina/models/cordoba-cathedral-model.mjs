/** Whole native cathedral and fifteen mapped parts; original exterior sections. */
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
    wall: rgb('e0d3b8'),
    trim: rgb('eee3ca'),
    roof: rgb('afa48b'),
    metal: rgb('887c60'),
    dark: rgb('4e5c56'),
    door: rgb('70624d'),
    clock: rgb('eeeadd'),
  },
  colors = ['d9cdae', 'd1c4a7', 'ded2b5'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.12 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5, metallic: 0 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  roofEvidence = [],
  towerEvidence = [],
  domeEvidence = [];
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
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function triangles(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
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
    if (!found) throw Error('Invalid cathedral polygon');
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
const ids = {
  whole: 1149552632,
  house: 1149552618,
  northBase: 1149552625,
  northCrown: 1149552619,
  southBase: 1149554037,
  southCrown: 1149554036,
  portico: 1149552626,
  nave: 1149552627,
  open: 1149552628,
  annex: 1149552629,
  connector: 1149552630,
  dome: 1149552624,
  corners: [1149552620, 1149552621, 1149552622, 1149552623],
};
function inside(r, q) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
function outsideCap(o, holes, y) {
  const r = ring(ids.whole),
    rings = [r, ...holes.map(ring)],
    xs = rings
      .flatMap((r) => r.map((q) => q[0]))
      .sort((a, b) => a - b)
      .filter((v, i, a) => !i || v - a[i - 1] > 0.00002);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      x = (a + b) / 2,
      edges = [];
    for (const poly of rings)
      for (let j = 0; j < poly.length; j++) {
        const p = poly[j],
          q = poly[(j + 1) % poly.length];
        if (x > Math.min(p[0], q[0]) && x < Math.max(p[0], q[0])) {
          const z = (t) => p[1] + ((q[1] - p[1]) * (t - p[0])) / (q[0] - p[0]);
          edges.push({ z: z(x), a: z(a), b: z(b) });
        }
      }
    edges.sort((a, b) => a.z - b.z);
    for (let j = 1; j < edges.length; j++) {
      const p = edges[j - 1],
        q = edges[j],
        z = (p.z + q.z) / 2;
      if (q.z - p.z < 1e-7 || !inside(r, [x, z]) || rings.slice(1).some((r) => inside(r, [x, z])))
        continue;
      Q(
        o,
        'roof',
        [
          [a, y, p.a],
          [b, y, p.b],
          [b, y, q.b],
          [a, y, q.a],
        ],
        [0, 1, 0],
        C.roof,
      );
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
      out.push(a.map((v, i) => mix(v, b[i], t)));
    }
  }
  return out.filter((q, i, a) => !i || Math.hypot(...sub(q, a[i - 1])) > 1e-7);
}
function gable(o, id, eave, ridge, axis, lod) {
  const r = ring(id),
    b = bounds(r),
    c = axis === 0 ? (b.x + b.X) / 2 : (b.z + b.Z) / 2,
    h = axis === 0 ? (b.X - b.x) / 2 : (b.Z - b.z) / 2,
    Y = (q) => eave + (ridge - eave) * Math.max(0, 1 - Math.abs(q[axis] - c) / h);
  for (const less of [true, false]) {
    const p = clip(r, axis, c, less);
    if (p.length >= 3) cap(o, 'roof', p, Y, true, C.roof);
  }
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      rs = [a];
    if (a[axis] < c !== b[axis] < c) {
      const t = (c - a[axis]) / (b[axis] - a[axis]);
      rs.push(a.map((v, j) => mix(v, b[j], t)));
    }
    rs.push(b);
    for (let j = 1; j < rs.length; j++) {
      const a = rs[j - 1],
        b = rs[j];
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
    if (lod >= 2) B(o, 'trim', [a[0], eave, a[1]], [b[0], eave, b[1]], 0.18, 0.2, C.trim);
  }
  roofEvidence.push({ id, eave, ridge, actualNativeFootprint: true, profileEstimated: true });
}
function profile(o, k, a, b, depth, r, col = C[k]) {
  piece(o, k, a, b, depth, r, col);
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [u[1], -u[0]],
    P = (q, v) => [a[0] + u[0] * q[0] + n[0] * v, q[1], a[1] + u[1] * q[0] + n[1] * v],
    sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    Q(
      o,
      k,
      [P(a, 0), P(b, 0), P(b, -depth), P(a, -depth)],
      [sign * u[0] * dy, -sign * dx, sign * u[1] * dy],
      col,
    );
  }
}
function bodyHeight(id) {
  return id === ids.house
    ? A.northHouseEave
    : id === ids.annex
      ? A.northAnnexRoof
      : id === ids.connector
        ? A.northConnectorRoof
        : id === ids.open
          ? A.lowOpenPartTop
          : A.lowDefaultRoof;
}
function base(o, lod) {
  const r = ring(ids.whole),
    rr = area(r) > 0 ? r : r.slice().reverse();
  solid(o, 'wall', r, A.foundationBottom, A.podiumTop, C.wall, lod > 0, lod > 0);
  if (lod === 0) cap(o, 'wall', ring(ids.portico), A.podiumTop, true, C.wall);
  record(ids.whole, A.podiumTop);
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      mid = a.map((v, j) => (v + b[j]) / 2),
      front = Math.min(a[0], b[0]) > 37.2 && Math.abs(a[0] - b[0]) < 0.1;
    let top = front ? A.porticoEave : A.lowDefaultRoof;
    for (const id of [ids.house, ids.annex, ids.connector]) {
      const q = ring(id),
        bb = bounds(q);
      if (
        mid[0] > bb.x - 0.02 &&
        mid[0] < bb.X + 0.02 &&
        mid[1] > bb.z - 0.02 &&
        mid[1] < bb.Z + 0.02
      )
        top = Math.min(top, bodyHeight(id));
    }
    const holes = front
      ? A.porticoArchCenters.map((v, j) => ({
          center: (v - a[1]) * (b[1] > a[1] ? 1 : -1),
          radius: A.porticoArchRadii[j],
          bottom: A.podiumTop + 0.015,
          spring: A.porticoArchSprings[j],
          arch: true,
          role: 'actual-open-portico-arch',
        }))
      : [];
    wall(o, 'wall', a, b, 0.55, A.podiumTop, top, holes, lod, C.wall, false);
  }
  outsideCap(o, [ids.house, ids.annex, ids.connector, ids.open, ids.portico], A.lowDefaultRoof);
}
function nativeSolid(o, id, y, Y, lod, k = 'wall') {
  solid(o, k, ring(id), y, Y, C[k]);
  record(id, Y);
  if (lod >= 2) {
    const r = ring(id);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      B(o, 'trim', [a[0], Y, a[1]], [b[0], Y, b[1]], 0.18, 0.2, C.trim);
    }
  }
}
function shaft(o, k, c, r, y, Y, N, col = C[k]) {
  const ring = Array.from({ length: N }, (_, i) => [
    c[0] + r * Math.cos((i * Math.PI * 2) / N),
    c[1] + r * Math.sin((i * Math.PI * 2) / N),
  ]);
  solid(o, k, ring, y, Y, col);
}
function loftRings(o, k, rings, col = C[k], top = true) {
  const N = rings[0].length,
    sign = area(rings[0].map((q) => [q[0], q[2]])) > 0 ? 1 : -1;
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const n = (i + 1) % N,
        a = rings[j - 1][i],
        b = rings[j - 1][n];
      Q(
        o,
        k,
        [a, b, rings[j][n], rings[j][i]],
        [sign * (b[2] - a[2]), 0, sign * (a[0] - b[0])],
        col,
      );
    }
  if (top) {
    const r = rings.at(-1);
    cap(
      o,
      k,
      r.map((q) => [q[0], q[2]]),
      r[0][1],
      true,
      col,
    );
  }
}
function finial(o, c, y, Y, lod) {
  if (lod === 0) {
    shaft(o, 'metal', c, 0.055, y, Y, 4, C.metal);
    return;
  }
  B(o, 'metal', [c[0], y, c[1]], [c[0], Y, c[1]], 0.09, 0.09, C.metal);
  B(o, 'metal', [c[0], Y - 0.4, c[1] - 0.34], [c[0], Y - 0.4, c[1] + 0.34], 0.085, 0.085, C.metal);
}
function backedOpenings(o, k, a, b, depth, holes, lod, col = C.dark) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [u[1], -u[0]],
    P = (q) => [a[0] + u[0] * q[0] - n[0] * depth, q[1], a[1] + u[1] * q[0] - n[1] * depth];
  for (const h of holes) {
    const N = [2, 4, 8, 16][lod],
      r = [
        [h.center - h.radius, h.bottom],
        [h.center + h.radius, h.bottom],
      ];
    for (let i = 0; i <= N; i++) {
      const t = (i * Math.PI) / N;
      r.push([h.center + h.radius * Math.cos(t), h.spring + h.radius * Math.sin(t)]);
    }
    const c = mean(r);
    for (let i = 0; i < r.length; i++)
      T(o, k, [P(c), P(r[i]), P(r[(i + 1) % r.length])], [n[0], 0, n[1]], col);
  }
}
function lantern(o, c, r, y, Y, capY, lod) {
  const N = lod <= 1 ? 4 : 8;
  if (lod === 0) {
    shaft(o, 'wall', c, r, y, Y, 4, C.wall);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        b = ((i + 1) * Math.PI) / 2;
      T(
        o,
        'wall',
        [
          [c[0] + r * Math.cos(a), Y, c[1] + r * Math.sin(a)],
          [c[0] + r * Math.cos(b), Y, c[1] + r * Math.sin(b)],
          [c[0], capY, c[1]],
        ],
        [0, 1, 0],
        C.wall,
      );
    }
    return;
  }
  shaft(o, 'trim', c, r * 1.18, y, y + 0.18, N, C.trim);
  const rr = Array.from({ length: N }, (_, i) => [
    c[0] + r * Math.cos((i * Math.PI * 2) / N),
    c[1] + r * Math.sin((i * Math.PI * 2) / N),
  ]);
  if (lod === 1) {
    solid(o, 'wall', rr, y + 0.18, Y, C.wall);
    for (let i = 0; i < N; i++) {
      const a = rr[i],
        b = rr[(i + 1) % N],
        d = sub(b, a),
        L = Math.hypot(...d),
        n = [d[1] / L, -d[0] / L],
        q = mean([a, b]),
        u = d.map((v) => v / L),
        w = 0.23,
        P = (s, h) => [q[0] + u[0] * s + n[0] * 0.012, h, q[1] + u[1] * s + n[1] * 0.012];
      Q(
        o,
        'dark',
        [P(-w, y + 0.65), P(w, y + 0.65), P(w, Y - 0.65), P(-w, Y - 0.65)],
        [n[0], 0, n[1]],
        C.dark,
      );
    }
  } else
    for (let i = 0; i < N; i++) {
      const a = rr[i],
        b = rr[(i + 1) % N],
        L = Math.hypot(...sub(b, a)),
        holes = [
          {
            center: L / 2,
            radius: Math.min(0.24, L * 0.28),
            bottom: y + 0.55,
            spring: Y - 0.85,
            arch: true,
            role: 'lantern-recessed-arched-window',
          },
        ];
      wall(o, 'wall', a, b, 0.16, y + 0.18, Y, holes, lod, C.wall, false);
      backedOpenings(o, 'dark', a, b, 0.18, holes, lod, C.dark);
    }
  shaft(o, 'trim', c, r * 1.2, Y - 0.08, Y + 0.12, N, C.trim);
  const rings = [
    [Y + 0.12, 1.22],
    [Y + (capY - Y) * 0.45, 1.05],
    [capY, 0.18],
  ].map(([h, s]) =>
    Array.from({ length: N }, (_, i) => [
      c[0] + r * s * Math.cos((i * Math.PI * 2) / N),
      h,
      c[1] + r * s * Math.sin((i * Math.PI * 2) / N),
    ]),
  );
  loftRings(o, 'wall', rings, C.wall);
}
function oculus(o, u, v, y, lod) {
  if (lod < 1) return;
  const N = lod === 1 ? 8 : lod === 2 ? 16 : 32,
    R = (t) => 0.46 + 0.1 * Math.cos(4 * t),
    P = (i, d, extra = 0) => {
      const t = (i * Math.PI * 2) / N,
        r = R(t) + extra;
      return [u + d, y + r * Math.sin(t), v + r * Math.cos(t)];
    };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    T(o, 'dark', [[u + 0.035, y, v], P(i, 0.035), P(j, 0.035)], [1, 0, 0], C.dark);
    Q(o, 'trim', [P(i, 0.15), P(j, 0.15), P(j, 0.15, 0.12), P(i, 0.15, 0.12)], [1, 0, 0], C.trim);
    Q(
      o,
      'trim',
      [P(i, 0.035), P(j, 0.035), P(j, 0.15), P(i, 0.15)],
      [0, -Math.sin(((i + 0.5) * Math.PI * 2) / N), -Math.cos(((i + 0.5) * Math.PI * 2) / N)],
      C.trim,
    );
  }
}
function naveShell(o, lod) {
  const id = ids.nave,
    r = ring(id),
    rr = area(r) > 0 ? r : r.slice().reverse();
  record(id, A.naveEave);
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      L = Math.hypot(...sub(b, a)),
      holes =
        L > 40
          ? Array.from({ length: 5 }, (_, j) => ({
              center: (L * (j + 0.5)) / 5,
              radius: 0.5,
              bottom: 9.6,
              spring: 12.05,
              arch: true,
              role: 'original-estimated-clerestory-window',
            }))
          : [];
    wall(o, 'wall', a, b, 0.35, 0, A.naveEave, holes, lod, C.wall, false);
    backedOpenings(o, 'dark', a, b, 0.37, holes, lod, C.dark);
    B(o, 'trim', [a[0], A.naveEave, a[1]], [b[0], A.naveEave, b[1]], 0.22, 0.24, C.trim);
  }
  cap(o, 'wall', r, A.naveEave, true, C.wall);
}

function clock(o, u, v, y, lod) {
  if (lod === 0) return;
  const N = [0, 16, 32, 48][lod],
    r = 0.91;
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      b = ((i + 1) * Math.PI * 2) / N,
      P = (r, t) => [u, y + r * Math.sin(t), v + r * Math.cos(t)];
    T(o, 'trim', [[u, y, v], P(r, a), P(r, b)], [1, 0, 0], C.clock);
    Q(o, 'trim', [P(r, a), P(r, b), P(r + 0.12, b), P(r + 0.12, a)], [1, 0, 0], C.trim);
  }
  const stroke = (a, b) => {
    if (lod !== 1) {
      B(o, 'metal', a, b, 0.045, 0.045, C.dark);
      return;
    }
    const d = sub(b, a),
      L = Math.hypot(d[1], d[2]),
      dy = (-d[2] / L) * 0.025,
      dz = (d[1] / L) * 0.025;
    Q(
      o,
      'metal',
      [
        [a[0], a[1] + dy, a[2] + dz],
        [b[0], b[1] + dy, b[2] + dz],
        [b[0], b[1] - dy, b[2] - dz],
        [a[0], a[1] - dy, a[2] - dz],
      ],
      [1, 0, 0],
      C.dark,
    );
  };
  for (let i = 0; i < 12; i++) {
    const t = (i * Math.PI) / 6;
    stroke(
      [u + 0.025, y + Math.sin(t) * 0.72, v + Math.cos(t) * 0.72],
      [u + 0.025, y + Math.sin(t) * 0.83, v + Math.cos(t) * 0.83],
    );
  }
  for (const [t, len] of [
    [Math.PI * 0.83, 0.62],
    [Math.PI * 0.17, 0.45],
  ])
    stroke([u + 0.04, y, v], [u + 0.04, y + Math.sin(t) * len, v + Math.cos(t) * len]);
}
function belfry(o, baseId, crownId, lod) {
  const r = ring(baseId),
    rr = area(r) > 0 ? r : r.slice().reverse(),
    b = bounds(r),
    c = mean(r);
  nativeSolid(o, baseId, 0, A.towerEave, lod);
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      L = Math.hypot(...sub(b, a)),
      hs = [];
    if (lod > 0 || Math.min(a[0], b[0]) > bounds(r).X - 0.1)
      for (let j = 0; j < (lod === 0 ? 1 : 3); j++)
        hs.push({
          center: (L * (j + 1)) / ((lod === 0 ? 1 : 3) + 1),
          radius: lod === 0 ? 0.8 : 0.57,
          bottom: 11.15,
          spring: 15.0,
          arch: true,
          role: 'true-open-belfry-arch',
        });
    wall(o, 'wall', a, b, 0.45, A.belfryBase, A.belfryTop, hs, lod, C.wall, false);
    if (lod >= 1) {
      for (const y of lod === 1 ? [A.belfryTop] : [A.towerEave, A.belfryTop])
        B(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.33, 0.24, C.trim);
      B(o, 'trim', [a[0], A.towerEave, a[1]], [a[0], A.belfryTop, a[1]], 0.38, 0.38, C.trim);
    }
  }
  const upper = ring(crownId),
    uc = mean(upper),
    steps =
      lod === 0
        ? [
            [18.4, 1],
            [21.3, 0.72],
            [24.1, 0.3],
          ]
        : [
            [18.4, 1],
            [19.3, 0.99],
            [20.4, 0.88],
            [21.3, 0.72],
            [22.3, 0.58],
            [23.2, 0.4],
            [24.1, 0.3],
          ];
  loftRings(
    o,
    'wall',
    steps.map(([y, s]) =>
      upper.map((q) => [uc[0] + (q[0] - uc[0]) * s, y, uc[1] + (q[1] - uc[1]) * s]),
    ),
    C.wall,
  );
  cap(o, 'wall', upper, A.towerCrownBase, false, C.wall);
  record(crownId, A.towerCrownBase);
  if (lod > 0) {
    for (const side of [-1, 1]) {
      const width = b.Z - b.z,
        a = [b.X + 0.1, side > 0 ? b.z : b.Z],
        bb = [b.X + 0.1, side > 0 ? b.Z : b.z];
      if (side < 0) continue;
      const N = lod === 1 ? 12 : lod === 2 ? 24 : 40,
        xs = Array.from({ length: N + 1 }, (_, i) => i / N),
        top = xs.map((t) => {
          const x = (t - 0.5) * 2,
            z = (Math.abs(x) - 0.82) / 0.14,
            q = (Math.abs(x) - 0.5) / 0.12;
          return (
            20.65 + 3.4 * Math.exp(-3 * x * x) + 1.2 * Math.exp(-z * z) - 0.8 * Math.exp(-q * q)
          );
        }),
        pr = [
          [0, A.towerCrownBase],
          [width, A.towerCrownBase],
          ...xs
            .slice()
            .reverse()
            .map((t, i) => [t * width, top[top.length - 1 - i]]),
        ];
      profile(o, 'wall', a, bb, 0.28, pr, C.wall);
      if (lod >= 2)
        for (let j = 1; j < xs.length; j++)
          B(
            o,
            'trim',
            [a[0] + 0.03, top[j - 1], a[1] + xs[j - 1] * width],
            [a[0] + 0.03, top[j], a[1] + xs[j] * width],
            0.12,
            0.12,
            C.trim,
          );
    }
    if (baseId === ids.southBase) clock(o, b.X + 0.12, c[1], 21.65, lod);
  }
  lantern(o, uc, 1.03, A.towerLanternBase, A.towerLanternTop, A.towerCapTop, lod);
  finial(o, uc, A.towerCapTop, A.towerCrossTop, lod);
  oculus(o, b.X, c[1], 6.5, lod);
  if (lod >= 2) {
    shaft(o, 'metal', c, 0.65, 12.1, 12.7, 12, C.metal);
    shaft(o, 'metal', c, 0.44, 12.7, 13.4, 12, C.metal);
    for (const u of [b.x, b.X])
      for (const v of [b.z, b.Z]) B(o, 'trim', [u, 0.35, v], [u, 10.0, v], 0.36, 0.22, C.trim);
    const rr = ring(baseId);
    for (let i = 0; i < rr.length; i++) {
      const a = rr[i],
        b = rr[(i + 1) % rr.length];
      for (const y of [0.6, 9.95])
        B(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.22, 0.22, C.trim);
    }
  }
  towerEvidence.push({
    baseId,
    crownId,
    center: c,
    nativeBase: true,
    actualOpenBelfry: true,
    threeStages: true,
    originalUpperSections: true,
  });
}
function dome(o, id, lod, main) {
  const r = ring(id),
    c = mean(r),
    lo = main ? A.drumBottom : A.cornerBottom,
    base = main ? A.drumCornice : A.cornerCornice,
    top = main ? A.domeTop : A.cornerDomeTop,
    body = r.map((q) => q.slice()),
    N = main ? [2, 4, 8, 14][lod] : [1, 2, 6, 10][lod];
  if (!main && lod >= 2) {
    const oct = r.map((q) => {
      const dx = q[0] - c[0],
        dz = q[1] - c[1],
        t = Math.atan2(dz, dx),
        fold = ((t + Math.PI * 4 + Math.PI / 8) % (Math.PI / 4)) - Math.PI / 8,
        s = Math.cos(Math.PI / 8) / Math.cos(fold);
      return [c[0] + dx * s, c[1] + dz * s];
    });
    loftRings(
      o,
      'wall',
      [r.map((q) => [q[0], lo, q[1]]), oct.map((q) => [q[0], base, q[1]])],
      C.wall,
      false,
    );
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        o,
        'trim',
        [
          [oct[i][0], base, oct[i][1]],
          [r[i][0], base, r[i][1]],
          [r[j][0], base, r[j][1]],
          [oct[j][0], base, oct[j][1]],
        ],
        [0, -1, 0],
        C.trim,
      );
    }
  } else if (main || lod > 0) solid(o, 'wall', body, lo, base, C.wall, false, false);
  record(id, base);
  if (!main && lod === 0) {
    for (let i = 0; i < r.length; i++)
      T(
        o,
        'wall',
        [
          [r[i][0], base, r[i][1]],
          [r[(i + 1) % r.length][0], base, r[(i + 1) % r.length][1]],
          [c[0], top, c[1]],
        ],
        [0, 1, 0],
        C.wall,
      );
    domeEvidence.push({ id, main, nativeControls: r.length, base, top, unverifiedHeight: true });
    return;
  }
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N,
      s = Math.max(0.14, Math.cos((t * Math.PI) / 2)),
      y = base + (top - base) * Math.sin((t * Math.PI) / 2);
    rings.push(r.map((q) => [c[0] + (q[0] - c[0]) * s, y, c[1] + (q[1] - c[1]) * s]));
  }
  loftRings(o, 'wall', rings, C.wall, lod > 0 || !main);
  if (lod >= 1) {
    if (lod >= 2)
      for (const y of [base - 0.22, base]) {
        const rr = r.map((q) => c.map((v, j) => v + (q[j] - v) * 1.04));
        solid(o, 'trim', rr, y, y + 0.12, C.trim);
      }
    if (main)
      for (let i = 0; i < r.length; i += lod === 1 ? 3 : 2) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          d = sub(b, a),
          L = Math.hypot(...d),
          n = [d[1] / L, -d[0] / L],
          cx = (a[0] + b[0]) / 2,
          z = (a[1] + b[1]) / 2;
        B(
          o,
          'dark',
          [cx + n[0] * 0.035, 18.7, z + n[1] * 0.035],
          [cx + n[0] * 0.035, 21.3, z + n[1] * 0.035],
          0.63,
          0.08,
          C.dark,
        );
      }
  }
  if (lod >= 2)
    for (let i = 0; i < r.length; i += main ? 2 : 3)
      for (let j = 1; j < rings.length; j++)
        B(
          o,
          'trim',
          rings[j - 1][i],
          rings[j][i],
          main ? 0.09 : 0.055,
          main ? 0.09 : 0.055,
          C.trim,
        );
  if (main) {
    lantern(o, c, 0.95, A.domeLanternBase, A.domeLanternTop, A.domeCapTop, lod);
    finial(o, c, A.domeCapTop, A.domeCrossTop, lod);
  } else if (lod > 0) shaft(o, 'trim', c, 0.16, top, top + 0.35, lod === 1 ? 4 : 8, C.trim);
  domeEvidence.push({
    id,
    main,
    nativeControls: r.length,
    base,
    top,
    unverifiedHeight: true,
    octagonalUpperShaft: !main && lod >= 2,
  });
}
function portico(o, lod) {
  const r = ring(ids.portico),
    b = bounds(r);
  cap(o, 'wall', r, A.porticoEave, false, C.wall);
  record(ids.portico, A.porticoEave);
  gable(o, ids.portico, A.porticoEave, A.porticoRidge, 1, lod);
  if (lod > 0) {
    for (const v of [-1.25, 3.05, 8.85, 13.15]) {
      const c = [b.X + 0.13, v];
      shaft(o, 'trim', c, 0.32, A.podiumTop, 8.25, [6, 8, 12, 16][lod], C.trim);
      shaft(o, 'trim', c, 0.48, 0.2, 0.5, 8, C.trim);
      shaft(o, 'trim', c, 0.46, 8.18, 8.48, 8, C.trim);
    }
    for (const y of [8.65, 9.25])
      B(o, 'trim', [b.X + 0.25, y, b.z - 0.2], [b.X + 0.25, y, b.Z + 0.2], 0.25, 0.25, C.trim);
    Q(
      o,
      'wall',
      [
        [A.porticoBackU + 0.05, 0.2, b.z],
        [A.porticoBackU + 0.05, 0.2, b.Z],
        [A.porticoBackU + 0.05, 8.6, b.Z],
        [A.porticoBackU + 0.05, 8.6, b.z],
      ],
      [1, 0, 0],
      rgb('b49c76'),
    );
    const back = [A.porticoBackU + 0.12, A.porticoCenterV];
    box(o, 'dark', back[0] - 0.05, back[0] + 0.05, 0.3, 4.7, back[1] - 1.8, back[1] + 1.8, C.door);
    for (let i = 0; i < 3; i++)
      box(
        o,
        'trim',
        b.X - 0.1,
        b.X + 1.4 - i * 0.35,
        -0.2 + i * 0.13,
        -0.07 + i * 0.13,
        b.z - 0.3,
        b.Z + 0.3,
        C.trim,
      );
  }
}
export function buildCordobaCathedral(o, _frame, lod = 3) {
  nativeEvidence.length = 0;
  openingEvidence.length = 0;
  roofEvidence.length = 0;
  towerEvidence.length = 0;
  domeEvidence.length = 0;
  let n = 0;
  const target = o;
  o = {
    addTriangle(...a) {
      n++;
      target.addTriangle(...a);
    },
    addQuad(...a) {
      n += 2;
      target.addQuad(...a);
    },
    addConvexPolygon(...a) {
      n += a[2].length - 2;
      target.addConvexPolygon(...a);
    },
  };
  partEvidence.length = 0;
  const part = (name, run) => {
    const before = n;
    run();
    partEvidence.push({ name, triangles: n - before });
  };
  part('whole-base', () => base(o, lod));
  part('nave', () => {
    if (lod >= 2) naveShell(o, lod);
    else nativeSolid(o, ids.nave, 0, A.naveEave, lod);
    gable(o, ids.nave, A.naveEave, A.naveRidge, 1, lod);
  });
  part('north-low-parts', () => {
    nativeSolid(o, ids.house, 0, A.northHouseEave, lod);
    gable(o, ids.house, A.northHouseEave, A.northHouseRidge, 0, lod);
    for (const id of [ids.annex, ids.connector, ids.open])
      nativeSolid(
        o,
        id,
        id === ids.open ? 0 : A.foundationBottom,
        bodyHeight(id),
        lod,
        id === ids.open ? 'roof' : 'wall',
      );
  });
  part('towers', () => {
    belfry(o, ids.northBase, ids.northCrown, lod);
    belfry(o, ids.southBase, ids.southCrown, lod);
  });
  part('portico', () => portico(o, lod));
  part('main-dome', () => dome(o, ids.dome, lod, true));
  part('four-corner-turrets', () => {
    for (const id of ids.corners) dome(o, id, lod, false);
  });
}

export const cordobaCathedralSkyline = (o) => buildCordobaCathedral(o, null, 0),
  cordobaCathedralDistrict = (o) => buildCordobaCathedral(o, null, 1),
  cordobaCathedralStreet = (o) => buildCordobaCathedral(o, null, 2),
  cordobaCathedralCloseup = (o) => buildCordobaCathedral(o, null, 3);
export const cordobaCathedralModel = {
  id: 'cathedral_of_cordoba_argentina',
  key: 'cathedral_of_cordoba_argentina',
  cell: '6d/6d6',
  title: 'Cathedral of Córdoba, Argentina',
  wikidataId: 'Q2942294',
  category: p.category,
  recipe: 'cordoba-cathedral-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCordobaCathedral,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole current Argentine Cathedral of Córdoba, exact26controlnativefootprint/15actualnativeparts/151partcontrols. Fullthreenavebody/rear/lowaisles/northernattachments/openzero-levelpart, actual3archclassicalportico/pediment/colonnades, twinopenbaroquebelfries/curvedcrowns/lanterns/southclock, mainbaroquedome/drum/lantern/cross/fourcornerturrets. Three exactpublishedHermannLuyken creatorCC0 front/belfry references first/only, no copiedphotopixels/sacredart. Wholemappedparts retained, levelcounts/hippedcrown tags notcertifiedsurvey; uppersections/profiles/heights/ornament/window-bellcensus/hiddenjoins/currentfinish/exactgroundcryptcontact originalestimates. Geographicpreview/replacementfalse.',
  camera: [105, F + 65, 95],
  lookAt: [0, F + 13, 0],
  portableGroundY: F - 0.23,
  sunDirection: [8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone_raw', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-rear-native-church-and-north-attachments',
      position: [-100, F + 58, -110],
      lookAt: [0, F + 12, 0],
    },
    {
      name: 'front-real-three-arch-portico-pediment-and-paired-baroque-towers',
      position: toWorld([77, 20, 5.95]),
      lookAt: toWorld([31, 14, 5.95]),
    },
    {
      name: 'whole-native-footprint-fifteen-parts-and-open-low-area-plan',
      position: [0.1, F + 180, 0.15],
      lookAt: [0, F + 5, 0],
    },
    {
      name: 'main-baroque-dome-lantern-and-four-corner-turrets',
      position: toWorld([-12, 33, 48]),
      lookAt: toWorld([-5.25, 25, 5.85]),
    },
    {
      name: 'south-clock-curved-crown-open-belfry-and-lantern',
      position: toWorld([57, 27, 38]),
      lookAt: toWorld([33.5, 21, 17.3]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/cordoba-cathedral-runtime-overlay.mjs',
    level: 'skyline',
    export: 'cordobaCathedralSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'cordobaCathedralDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'cordobaCathedralStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'cordobaCathedralCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Three exactpublished2011HermannLuyken own/self-CC0 structuralfront/belfry originals individually/contactsheet inspected/nativeSHA1matched, unchangedinventorypassed. Fourthsideview/ceilinghero/interior/tombs/unrelatedmuseum notadopted; no supplemental/questionablesource/source-rightsrepair/reclassification/guardchange/samephotobypass/protectedadditionalimagery or copiedsourcepixels. Primarydescriptivefacts only, no protectedplans. Uppersections/clocktime/crowns/fineornament/lantern/census/hiddenroofs/currentfinish originalboundedestimates.',
    'Originalindependent256m129x12916641sample/one rawtile field/fixedbboxanchor/heading0/SW402.2007mproviderdatum frozen before every floor/part/section/geometrychoice. Once-only eastportico field sample fixesfloor.2322m. No fit/flatten/reacquire/reframe/floorretune/late raising. Preciseground/crypt/foundationcontact unverified; geographicpreview/replacementfalse. Portableflatground/contextneighbors are reviewfixtures only.',
  ],
};

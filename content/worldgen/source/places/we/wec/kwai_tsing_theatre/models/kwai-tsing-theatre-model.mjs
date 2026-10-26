/** Whole native theatre exterior from creator-public-domain photographs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  U = A.planAxisU,
  V = A.planAxisV;
const C = {
  wall: rgb('b8a58e'),
  roof: rgb('a49e90'),
  stone: rgb('98988e'),
  metal: rgb('b5bcba'),
  glass: rgb('365b61'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.18 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.12 },
};
const worldPoint = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z],
  worldVector = worldPoint;
const nativeRing = f.geometry.outline
  .slice(0, -1)
  .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
export const openingEvidence = [],
  colonnadeEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  identity = (q) => q;
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => worldPoint(v).map(Math.fround));
  if (n) n = worldVector(n);
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function box(o, k, lo, hi, P = identity, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const q of [
    [
      [x, y, z],
      [x, y, Z],
      [X, y, Z],
      [X, y, z],
    ],
    [
      [x, Y, Z],
      [x, Y, z],
      [X, Y, z],
      [X, Y, Z],
    ],
    [
      [x, y, Z],
      [x, Y, Z],
      [X, Y, Z],
      [X, y, Z],
    ],
    [
      [X, y, z],
      [X, Y, z],
      [x, Y, z],
      [x, y, z],
    ],
    [
      [x, y, z],
      [x, Y, z],
      [x, Y, Z],
      [x, y, Z],
    ],
    [
      [X, y, Z],
      [X, Y, Z],
      [X, Y, z],
      [X, y, z],
    ],
  ])
    Q(o, k, q.map(P).reverse(), null, col);
}
/** Ear clipping keeps the swept, slightly concave wing boundary intact. */
function triangulate(ring) {
  const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const ids = ring.map((_, i) => i);
  const area = ring.reduce((s, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area < 0) ids.reverse();
  const triangles = [];
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cross2(ring[a], ring[b], ring[c]) < 1e-10) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross2(ring[a], ring[b], ring[k]) >= -1e-10 &&
            cross2(ring[b], ring[c], ring[k]) >= -1e-10 &&
            cross2(ring[c], ring[a], ring[k]) >= -1e-10,
        )
      )
        continue;
      triangles.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid swept wing profile');
  }
  triangles.push(ids);
  return triangles;
}
const area = (ring) =>
    ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  sign = Math.sign(area(nativeRing));
function cap(o, k, ring, y, up = true) {
  for (const ids of triangulate(ring))
    T(
      o,
      k,
      ids.map((i) => [ring[i][0], y, ring[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function clip(ring, axis, value, greater) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      inside = (q) => (greater ? q[axis] >= value : q[axis] <= value),
      ia = inside(a),
      ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out.filter((q, i) => i === 0 || Math.hypot(...sub(q, out[i - 1])) > 1e-6);
}
function edgeFrame(a, b) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [sign * u[1], 0, -sign * u[0]],
    P = ([x, y, d]) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[2] * d];
  return { L, u, n, P };
}
function strip(o, k, a, b, y0, y1, d = 0, col) {
  const { n, P, L } = edgeFrame(a, b);
  Q(
    o,
    k,
    [
      [0, y0, d],
      [L, y0, d],
      [L, y1, d],
      [0, y1, d],
    ].map(P),
    n,
    col,
  );
}
function slab(o, k, ring, y0, y1) {
  if (Math.sign(area(ring)) !== sign) ring = [...ring].reverse();
  cap(o, k, ring, y0, false);
  cap(o, k, ring, y1);
  for (let i = 0; i < ring.length; i++) strip(o, k, ring[i], ring[(i + 1) % ring.length], y0, y1);
}
function tube(o, k, a, b, r, N = 6, col = C.metal) {
  const axis = sub(b, a),
    len = Math.hypot(...axis);
  if (len < 1e-5) return;
  const w = axis.map((v) => v / len),
    u0 = cross(w, Math.abs(w[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    v = cross(w, u),
    point = (q, i) => {
      const t = (i * 2 * Math.PI) / N;
      return q.map((x, j) => x + r * (Math.cos(t) * u[j] + Math.sin(t) * v[j]));
    };
  for (let i = 0; i < N; i++) {
    const a0 = point(a, i),
      a1 = point(a, i + 1),
      b0 = point(b, i),
      b1 = point(b, i + 1),
      out = a0.map((q, j) => q - a[j]);
    Q(o, k, [a0, a1, b1, b0], out, col);
    T(
      o,
      k,
      [a, a1, a0],
      w.map((q) => -q),
      col,
    );
    T(o, k, [b, b0, b1], w, col);
  }
}
function perimeter(o, ring, y, lod) {
  if (!lod) return;
  const interval = lod === 1 ? 7 : 3;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      N = Math.max(1, Math.floor(Math.hypot(...sub(b, a)) / interval));
    tube(o, 'metal', [a[0], y + 1.05, a[1]], [b[0], y + 1.05, b[1]], 0.035, lod === 1 ? 3 : 5);
    if (lod >= 2) tube(o, 'metal', [a[0], y + 0.55, a[1]], [b[0], y + 0.55, b[1]], 0.026, 4);
    for (let j = 0; j < N; j++) {
      const t = j / N,
        x = a[0] + t * (b[0] - a[0]),
        z = a[1] + t * (b[1] - a[1]);
      tube(o, 'metal', [x, y, z], [x, y + 1.05, z], 0.03, lod === 1 ? 3 : 5);
    }
  }
}
function windowWall(
  o,
  a,
  b,
  y0,
  y1,
  rows,
  lod,
  { depth = A.windowDepth, spacing = 6, width = 1.8 } = {},
) {
  const { L, P, n } = edgeFrame(a, b),
    rect = (k, x0, Y0, x1, Y1, d = 0, col) => {
      if (x1 - x0 < 0.001 || Y1 - Y0 < 0.001) return;
      Q(
        o,
        k,
        [
          [x0, Y0, d],
          [x1, Y0, d],
          [x1, Y1, d],
          [x0, Y1, d],
        ].map(P),
        n,
        col,
      );
    },
    N = Math.max(1, Math.floor(L / spacing)),
    step = L / N;
  if (lod === 0) {
    rect('wall', 0, y0, L, y1);
    for (const [lo, hi] of rows)
      for (let j = 0; j < N; j++) {
        const x = (j + 0.5) * step,
          w = Math.min(width, step * 0.6);
        rect('glass', x - w / 2, lo, x + w / 2, hi, 0.012);
      }
    return;
  }
  let y = y0;
  for (const [lo, hi] of rows) {
    rect('wall', 0, y, L, lo);
    let prev = 0;
    for (let j = 0; j < N; j++) {
      const x = (j + 0.5) * step,
        w = Math.min(width, step * 0.6);
      rect('wall', prev, lo, x - w / 2, hi);
      const r = [
        [x - w / 2, lo],
        [x + w / 2, lo],
        [x + w / 2, hi],
        [x - w / 2, hi],
      ];
      for (let k = 0; k < 4; k++) {
        const a = r[k],
          b = r[(k + 1) % 4];
        Q(
          o,
          'wall',
          [
            [...a, 0],
            [...b, 0],
            [...b, -depth],
            [...a, -depth],
          ].map(P),
        );
      }
      rect('glass', x - w / 2, lo, x + w / 2, hi, -depth);
      openingEvidence.push({
        center: worldPoint(P([x, (lo + hi) / 2, 0])),
        normal: worldVector(n),
        depth,
      });
      if (lod >= 2) {
        rect('metal', x - 0.025, lo, x + 0.025, hi, -depth + 0.015);
        rect(
          'metal',
          x - w / 2,
          (lo + hi) / 2 - 0.025,
          x + w / 2,
          (lo + hi) / 2 + 0.025,
          -depth + 0.015,
        );
      }
      prev = x + w / 2;
    }
    rect('wall', prev, lo, L, hi);
    y = hi;
  }
  rect('wall', 0, y, L, y1);
}
function curtain(o, a, b, lod, { recess = 0, top = A.foyerTop, door = false } = {}) {
  const { L, P, n } = edgeFrame(a, b),
    panels = lod === 0 ? 1 : Math.max(1, Math.round(L / (lod === 1 ? 3.5 : 2))),
    Ys = lod === 0 ? [0.2, top] : [0.2, 3.35, 6.5, top],
    dw = Math.min(1.5, L * 0.72),
    dx = L / 2;
  for (let i = 0; i < panels; i++)
    for (let j = 1; j < Ys.length; j++) {
      if (door && lod && j === 1) continue;
      const x = (i * L) / panels,
        X = ((i + 1) * L) / panels,
        y = Ys[j - 1],
        Y = Ys[j];
      Q(
        o,
        'glass',
        [
          [x, y, -recess],
          [X, y, -recess],
          [X, Y, -recess],
          [x, Y, -recess],
        ].map(P),
        n,
        j === Ys.length - 1 ? rgb('526e74') : C.glass,
      );
    }
  if (lod >= 1) {
    if (door) {
      const panel = (x0, y0, x1, y1, d = 0) =>
        Q(
          o,
          'glass',
          [
            [x0, y0, d],
            [x1, y0, d],
            [x1, y1, d],
            [x0, y1, d],
          ].map(P),
          n,
        );
      panel(0, 0.2, dx - dw / 2, 3.35);
      panel(dx + dw / 2, 0.2, L, 3.35);
      panel(dx - dw / 2, 3.1, dx + dw / 2, 3.35);
      panel(dx - dw / 2, 0.2, dx + dw / 2, 3.1, -A.doorDepth);
      const r = [
        [dx - dw / 2, 0.2],
        [dx + dw / 2, 0.2],
        [dx + dw / 2, 3.1],
        [dx - dw / 2, 3.1],
      ];
      for (let j = 0; j < 4; j++) {
        const a = r[j],
          b = r[(j + 1) % 4];
        Q(
          o,
          'metal',
          [
            [...a, 0],
            [...b, 0],
            [...b, -A.doorDepth],
            [...a, -A.doorDepth],
          ].map(P),
        );
      }
      tube(
        o,
        'metal',
        P([dx, 0.2, -A.doorDepth + 0.02]),
        P([dx, 3.1, -A.doorDepth + 0.02]),
        0.025,
        4,
      );
      openingEvidence.push({
        center: worldPoint(P([dx + 0.22, 1.6, 0])),
        normal: worldVector(n),
        depth: A.doorDepth,
        type: 'foyer-door',
      });
    }
    for (let i = 0; i <= panels; i++) {
      const x = (i * L) / panels;
      tube(
        o,
        'metal',
        P([x, door && Math.abs(x - dx) < dw / 2 ? 3.35 : 0.2, -recess + 0.04]),
        P([x, top, -recess + 0.04]),
        0.045,
        lod === 1 ? 3 : 5,
        rgb('6b7d7c'),
      );
    }
    for (const y of Ys.slice(1, -1))
      tube(
        o,
        'metal',
        P([0, y, -recess + 0.04]),
        P([L, y, -recess + 0.04]),
        0.045,
        lod === 1 ? 3 : 5,
        rgb('6b7d7c'),
      );
  }
}
function canopy(o, a, b, lod, mast = false) {
  const { L, P } = edgeFrame(a, b),
    di = A.canopyInnerOffset,
    do0 = A.canopyOuterOffset;
  Q(
    o,
    'glass',
    [
      [0, A.canopyY, di],
      [L, A.canopyY, di],
      [L, A.canopyY - 0.18, do0],
      [0, A.canopyY - 0.18, do0],
    ].map(P),
    [0, 1, 0],
    rgb('8ca9a8'),
  );
  if (lod) {
    tube(
      o,
      'metal',
      P([0, A.canopyY - 0.18, do0]),
      P([L, A.canopyY - 0.18, do0]),
      0.075,
      lod === 1 ? 3 : 6,
    );
    tube(
      o,
      'metal',
      P([0, A.canopyY, di]),
      P([0, A.canopyY - 0.18, do0]),
      0.045,
      lod === 1 ? 3 : 5,
    );
  }
  if (mast) {
    const base = P([L * 0.5, 0.15, do0 + 1.1]),
      high = P([L * 0.5, A.mastTop, di + 1.25]);
    tube(o, 'metal', base, high, 0.115, lod === 0 ? 3 : lod === 1 ? 5 : 10);
    if (lod >= 1)
      for (const t of [0, 1])
        tube(o, 'metal', high, P([t * L, A.canopyY - 0.18, do0]), 0.026, lod === 1 ? 3 : 5);
    if (lod >= 2) tube(o, 'metal', high, P([L * 0.5, A.foyerTop, 0]), 0.025, 5);
  }
}
function colonnade(o, a, b, lod) {
  const { L, P, n } = edgeFrame(a, b);
  curtain(o, a, b, lod, { recess: A.columnRecess, top: 10.8 });
  strip(o, 'wall', a, b, 10.8, 11.5);
  windowWall(o, a, b, 11.5, A.barTop, [[12.1, 14.4]], lod, { depth: 0.5, spacing: 6, width: 3 });
  const N = Math.max(1, Math.floor(L / 6));
  for (let i = 0; i <= N; i++) {
    const x = (i * L) / N;
    tube(o, 'wall', P([x, 0.2, -0.05]), P([x, 11.5, -0.05]), 0.48, [4, 6, 10, 16][lod], C.wall);
  }
  if (lod) {
    for (const y of [4.5, 10.7]) {
      Q(
        o,
        'roof',
        [
          [0, y, 0],
          [L, y, 0],
          [L, y, -A.columnRecess],
          [0, y, -A.columnRecess],
        ].map(P),
        [0, 1, 0],
      );
      strip(o, 'roof', a, b, y - 0.2, y);
    }
    colonnadeEvidence.push({
      center: worldPoint(P([L / (N * 2), 6, 0])),
      normal: worldVector(n),
      depth: A.columnRecess,
    });
  }
}
function zoneTop(q) {
  return q[0] < A.opaqueCoreCutU - 1e-7
    ? A.auditoriumTop
    : q[1] <= A.barCutV + 1e-7
      ? A.barTop
      : A.foyerTop;
}
function edges() {
  const r = [];
  for (let i = 0; i < nativeRing.length; i++) {
    const a = nativeRing[i],
      b = nativeRing[(i + 1) % nativeRing.length],
      ts = [0, 1];
    for (const [k, val] of [
      [0, A.opaqueCoreCutU],
      [1, A.barCutV],
    ]) {
      const t = (val - a[k]) / (b[k] - a[k]);
      if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const P = (t) => a.map((v, k) => v + t * (b[k] - v));
      r.push({ index: i, a: P(ts[j - 1]), b: P(ts[j]), top: zoneTop(P((ts[j - 1] + ts[j]) / 2)) });
    }
  }
  return r;
}
export function buildKwai(o, _frame = null, lod = 3) {
  openingEvidence.length = 0;
  colonnadeEvidence.length = 0;
  slab(o, 'stone', nativeRing, 0, 0.2);
  for (const e of edges()) {
    const { index, a, b, top } = e;
    if (index >= 29 && index <= 38) {
      curtain(o, a, b, lod, { door: index === 33 || index === 34 });
      strip(o, 'metal', a, b, 9.4, 9.8, 0.035);
      strip(o, 'wall', a, b, 9.8, 10.9);
      canopy(o, a, b, lod, [29, 33, 37].includes(index));
    } else if (index >= 39 && index <= 40) colonnade(o, a, b, lod);
    else if (index >= 15 && index <= 28)
      windowWall(o, a, b, 0.2, top, [[0.65, 3.1]], lod, { spacing: 7, width: 3.1 });
    else if (index >= 3 && index <= 10)
      windowWall(o, a, b, 0.2, top, [[0.65, 4.3]], lod, { spacing: 5, width: 2.8 });
    else windowWall(o, a, b, 0.2, top, [[0.75, 3.2]], lod, { spacing: 9, width: 1.7 });
    if (!(index >= 29 && index <= 38)) strip(o, 'wall', a, b, top, top + 0.8);
  }
  const core = clip(nativeRing, 0, A.opaqueCoreCutU, false),
    bar = clip(clip(nativeRing, 0, A.opaqueCoreCutU, true), 1, A.barCutV, false),
    front = clip(clip(nativeRing, 0, A.opaqueCoreCutU, true), 1, A.barCutV, true);
  for (const [ring, y] of [
    [core, A.auditoriumTop],
    [bar, A.barTop],
    [front, A.foyerTop],
  ]) {
    cap(o, 'roof', ring, y);
    if (lod >= 2) perimeter(o, ring, y + 0.8, lod);
  }
  for (const [ring, y, axis, val, other] of [
    [core, A.auditoriumTop, 0, A.opaqueCoreCutU, null],
    [bar, A.barTop, 1, A.barCutV, A.foyerTop],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      if (Math.abs(a[axis] - val) < 1e-6 && Math.abs(b[axis] - val) < 1e-6) {
        const cuts = [0, 1],
          t = (A.barCutV - a[1]) / (b[1] - a[1]);
        if (other === null && t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
        cuts.sort((a, b) => a - b);
        for (let j = 1; j < cuts.length; j++) {
          const at = (t) => a.map((v, k) => v + t * (b[k] - v)),
            c = at(cuts[j - 1]),
            d = at(cuts[j]);
          const bottom = other ?? ((c[1] + d[1]) / 2 <= A.barCutV ? A.barTop : A.foyerTop);
          strip(o, 'wall', c, d, bottom, y);
        }
      }
    }
  const F = A.flytower;
  box(o, 'wall', [F.u0, A.auditoriumTop, F.v0], [F.u1, F.top, F.v1]);
  box(o, 'roof', [F.u0 - 0.18, F.top, F.v0 - 0.18], [F.u1 + 0.18, F.top + 0.25, F.v1 + 0.18]);
  if (lod >= 1) {
    for (const x of [F.u0 + 3, F.u1 - 3])
      box(o, 'metal', [x, F.top - 2, F.v1 + 0.01], [x + 1.0, F.top - 0.9, F.v1 + 0.08]);
    perimeter(
      o,
      [
        [F.u0, F.v0],
        [F.u1, F.v0],
        [F.u1, F.v1],
        [F.u0, F.v1],
      ],
      F.top + 0.25,
      lod,
    );
  }
  const D = A.restaurantDrum,
    N = [8, 12, 24, 40][lod],
    r = Array.from({ length: N }, (_, i) => [
      D.center[0] + D.radius * Math.cos((i * 2 * Math.PI) / N),
      D.center[1] + D.radius * Math.sin((i * 2 * Math.PI) / N),
    ]);
  slab(o, 'wall', r, D.bottom, D.top);
  cap(o, 'roof', r, D.top + 0.04);
  if (lod >= 2) perimeter(o, r, D.top, lod);
}
export const kwaiSkyline = (o) => buildKwai(o, null, 0),
  kwaiDistrict = (o) => buildKwai(o, null, 1),
  kwaiStreet = (o) => buildKwai(o, null, 2),
  kwaiCloseup = (o) => buildKwai(o, null, 3);
const cam = (q) => worldPoint(q);
export const kwaiModel = {
  id: 'kwai_tsing_theatre',
  key: 'kwai_tsing_theatre',
  cell: 'we/wec',
  title: 'Kwai Tsing Theatre',
  wikidataId: 'Q606350',
  recipe: 'kwai-tsing-theatre-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'theatre',
  brief:
    'Whole native48control theatre exterior: buff tiled auditorium/service blocks and taller rectilinear flytower, curved glazed entrance foyer/closed doors/whitefascia/parapet, real suspended curved canopy/splayed masts/tension rods, adjoining curved restaurant/roofdrum and columned deeply recessed sidewing. Whole mapped outline and native bearing retained; heights/internal part boundaries/hidden faces original bounded reconstruction. No plaza/roads/neighbors/sculpture/ads/interiors.',
  surfaces,
  build: buildKwai,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: cam([160, 62, 150]),
  lookAt: cam([0, 12, 8]),
  portableGroundY: -0.25,
  mediumFiContext: { scale: '1', groundY: -0.25 },
  qaCameras: [
    {
      name: 'whole-theatre-curves-and-tall-flytower',
      position: cam([150, 58, 145]),
      lookAt: cam([0, 12, 10]),
    },
    {
      name: 'whole-opaque-auditorium-backstage-and-roof-envelopes',
      position: cam([-160, 66, -130]),
      lookAt: cam([0, 13, 0]),
    },
    {
      name: 'curved-glazed-foyer-canopy-splayed-masts-and-rods',
      position: cam([76, 14, 53]),
      lookAt: cam([35, 5, 23]),
    },
    {
      name: 'columned-wing-open-recess-and-curved-restaurant-roofdrum',
      position: cam([95, 19, 45]),
      lookAt: cam([44, 7, 15]),
    },
    {
      name: 'whole-native48control-plan-and-multipart-roofs',
      position: cam([10, 235, 5]),
      lookAt: cam([0, 4, 0]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/kwai-tsing-runtime-overlay.mjs',
    level: 'skyline',
    export: 'kwaiSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'kwaiDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'kwaiStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'kwaiCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Five exact already-published2006/2007 Chong Fat creatorPD exteriors only; protected hero/nightphotos, interiors, ads/sculptures and unrelated imagery unselected. No supplemental imagery/copied texture pixels/generated bitmap or article/media/rightsmetadata repair. Native48control whole outline retained; internal boundaries/heights/hidden elevations/opening census/finish and canopy support arrangement original bounded estimates. Glass/canopy use opaque medium-fi surfaces without an interior/sorting claim.',
    'Independent400m129x129field16641values/two raw tiles frozen before all floors/sections/geometry. Fixed-.6065m provider-relative SW datum unchanged; urban source includes tall building artifacts and source ground/thresholds are unsurveyed. Geographic preview/replaceFootprint=false, no fit/flatten/reacquire or plaza plate.',
  ],
};

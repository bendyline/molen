/** Whole native principal house with intrinsic open veranda and arched side portico. */
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
  wall: rgb('c7b58f'),
  stone: rgb('ddd1b5'),
  roof: rgb('49525d'),
  dark: rgb('27332d'),
  metal: rgb('30393b'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  dark: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.35 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, holes = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  native = frame.features[0].outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
  partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  columnEvidence = [],
  roofEvidence = [],
  archEvidence = [],
  stairEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
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
  if (Math.hypot(...sub(b, a)) > 1e-6) beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, { top = true, bottom = false, col = C[k] } = {}) {
  const s = area(r) > 0 ? 1 : -1;
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
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      col,
    );
  }
  if (top) cap(o, k, r, Y, true, col);
  if (bottom) cap(o, k, r, y, false, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  center = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length);
function clip(r, k, value, greater) {
  const out = [],
    inside = (q) => (greater ? q[k] >= value : q[k] <= value);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      I = inside(a),
      J = inside(b);
    if (I) out.push(a);
    if (I !== J) {
      const t = (value - a[k]) / (b[k] - a[k]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out.filter((q, i, a) => !i || Math.hypot(...sub(q, a[i - 1])) > 1e-7);
}
function panel(a, b, r) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
    n = [s * u[1], -s * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function plane(o, k, f, l, r, y, Y, v = 0, col = C[k]) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]], col);
}
function bar(o, k, f, l, r, y, Y, v, depth, col = C[k]) {
  const points = [f.P(l, 0, v), f.P(r, 0, v), f.P(r, 0, v - depth), f.P(l, 0, v - depth)];
  solid(
    o,
    k,
    points.map((q) => [q[0], q[2]]),
    y,
    Y,
    { col },
  );
}
function facade(o, f, holes, y, Y, lod, index, upper) {
  if (lod === 0) {
    plane(o, 'wall', f, 0, f.L, y, Y);
    for (const h of holes)
      plane(o, 'dark', f, h.center - h.radius, h.center + h.radius, h.bottom, h.top, 0.012);
    return;
  }
  const outer = [
      [0, y],
      [f.L, y],
      [f.L, Y],
      [0, Y],
    ],
    cuts = holes.map((h) => [
      [h.center - h.radius, h.bottom],
      [h.center - h.radius, h.top],
      [h.center + h.radius, h.top],
      [h.center + h.radius, h.bottom],
    ]),
    all = [...outer, ...cuts.flat()];
  for (const ix of triangulate(outer, cuts))
    T(
      o,
      'wall',
      ix.map((i) => f.P(...all[i])),
      [f.n[0], 0, f.n[1]],
    );
  for (const h of holes) {
    const l = h.center - h.radius,
      r = h.center + h.radius,
      y = h.bottom,
      Y = h.top,
      D = -A.windowDepth;
    Q(o, 'wall', [f.P(l, y), f.P(l, Y), f.P(l, Y, D), f.P(l, y, D)], [f.u[0], 0, f.u[1]]);
    Q(o, 'wall', [f.P(r, y), f.P(r, y, D), f.P(r, Y, D), f.P(r, Y)], [-f.u[0], 0, -f.u[1]]);
    Q(o, 'wall', [f.P(l, y), f.P(l, y, D), f.P(r, y, D), f.P(r, y)], [0, 1, 0]);
    Q(o, 'wall', [f.P(l, Y), f.P(r, Y), f.P(r, Y, D), f.P(l, Y, D)], [0, -1, 0]);
    plane(o, 'dark', f, l, r, y, Y, D);
    if (lod === 1) {
      plane(o, 'stone', f, l - 0.1, l, y - 0.08, Y + 0.1, 0.025);
      plane(o, 'stone', f, r, r + 0.1, y - 0.08, Y + 0.1, 0.025);
      plane(o, 'stone', f, l, r, Y, Y + 0.1, 0.025);
      plane(o, 'stone', f, l, r, y - 0.08, y, 0.025);
    } else {
      for (const [a, b] of [
        [l - 0.09, l],
        [r, r + 0.09],
      ])
        bar(o, 'stone', f, a, b, y - 0.07, Y + 0.07, 0.05, 0.14);
      bar(o, 'stone', f, l - 0.14, r + 0.14, y - 0.15, y - 0.06, 0.11, 0.2);
      bar(o, 'dark', f, h.center - 0.035, h.center + 0.035, y, Y, D + 0.045, 0.07);
      for (const t of [0.32, 0.66])
        bar(o, 'dark', f, l, r, y + (Y - y) * t - 0.025, y + (Y - y) * t + 0.025, D + 0.04, 0.06);
      const N = lod === 2 ? 5 : 12;
      for (let j = 0; j < N; j++) {
        const a = (Math.PI * j) / N,
          b = (Math.PI * (j + 1)) / N,
          x = (t) => h.center + h.radius * Math.cos(t),
          yy = (t) => Y + 0.12 * Math.sin(t);
        B(o, 'stone', f.P(x(a), yy(a), 0.06), f.P(x(b), yy(b), 0.06), 0.11, 0.15);
      }
      if (lod === 3 && h.kind === 'door')
        B(
          o,
          'metal',
          f.P(h.center + 0.13, y + 0.95, D + 0.1),
          f.P(h.center + 0.13, y + 1.15, D + 0.1),
          0.035,
          0.035,
        );
    }
    openingEvidence.push({
      index,
      upper,
      a: f.a,
      b: f.b,
      u: f.u,
      normal: f.n,
      ...h,
      depth: A.windowDepth,
    });
  }
}
function body(o, lod) {
  for (const upper of [false, true])
    for (let i = 0; i < native.length; i++) {
      const f = panel(native[i], native[(i + 1) % native.length], native),
        y = upper ? A.upperFloor : A.platformTop,
        Y = upper ? A.wallTop : A.upperFloor - 0.18,
        holes = [];
      let N = f.L > 6 ? Math.max(1, Math.floor(f.L / 4.8)) : f.L > 3.5 ? 1 : 0;
      if (i === 3) N = 7;
      if (i === 0 || i === 6) N = 4;
      if (i === 1 || i === 5) N = 1;
      for (let j = 0; j < N; j++) {
        let center = (f.L * (j + 0.5)) / N;
        const door = (!upper && i === 3 && j === 3) || (!upper && i === 0 && j === 1);
        if (i === 0 && j === 1) center = A.porticoCenterV - f.a[1];
        holes.push({
          center,
          radius: (door ? A.doorWidth : A.windowWidth) / 2,
          bottom: door ? A.platformTop : upper ? A.upperWindowBottom : A.groundWindowBottom,
          top: door ? A.groundDoorTop : upper ? A.upperWindowTop : A.groundWindowTop,
          kind: door ? 'door' : 'window',
        });
      }
      facade(o, f, holes, y, Y, lod, i, upper);
    }
  cap(o, 'wall', native, A.wallTop);
  for (let i = 0; i < native.length; i++) {
    const a = native[i],
      b = native[(i + 1) % native.length];
    for (const y of [A.upperFloor - 0.12, A.wallTop - 0.13]) {
      if (lod === 0)
        Q(
          o,
          'stone',
          [
            [a[0], y - 0.12, a[1]],
            [b[0], y - 0.12, b[1]],
            [b[0], y + 0.1, b[1]],
            [a[0], y + 0.1, a[1]],
          ],
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      else B(o, 'stone', [a[0], y, a[1]], [b[0], y, b[1]], 0.24, 0.26);
    }
  }
}
function round(o, x, z, y, Y, r, R, N) {
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N,
      b = (2 * Math.PI * (i + 1)) / N,
      t = (a + b) / 2;
    Q(
      o,
      'stone',
      [
        [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y, z + r * Math.sin(b)],
        [x + R * Math.cos(b), Y, z + R * Math.sin(b)],
        [x + R * Math.cos(a), Y, z + R * Math.sin(a)],
      ],
      [Math.cos(t), 0, Math.sin(t)],
    );
  }
}
export const verandaRing = rect(native[3][0], native[4][0], native[3][1], A.verandaFront);
function veranda(o, lod) {
  solid(o, 'stone', verandaRing, 0, A.platformTop);
  solid(o, 'stone', verandaRing, A.upperFloor - 0.25, A.upperFloor);
  const z = A.verandaFront - 0.16;
  for (const x of [-12.8, -8, -3.2, 3.2, 8, 12.8])
    for (const side of [-1, 1]) {
      const u = x + side * 0.18,
        y = A.platformTop,
        Y = A.verandaColumnTop;
      if (lod === 0) B(o, 'stone', [u, y, z], [u, Y, z], 0.25, 0.25);
      else {
        solid(o, 'stone', rect(u - 0.21, u + 0.21, z - 0.21, z + 0.21), y, y + 0.18);
        round(o, u, z, y + 0.18, Y - 0.2, 0.16, 0.12, [4, 8, 12, 20][lod]);
        solid(o, 'stone', rect(u - 0.26, u + 0.26, z - 0.26, z + 0.26), Y - 0.2, Y);
      }
      columnEvidence.push({ u, v: z, bottom: y, top: Y });
    }
  solid(
    o,
    'stone',
    rect(native[3][0], native[4][0], z - 0.28, z + 0.28),
    A.verandaColumnTop,
    A.upperFloor - 0.25,
  );
  const edges = [
    [verandaRing[3], verandaRing[2]],
    [verandaRing[0], verandaRing[3]],
    [verandaRing[2], verandaRing[1]],
  ];
  for (const [a, b] of edges) {
    const L = Math.hypot(...sub(b, a)),
      P = (t, h) => [a[0] + (b[0] - a[0]) * t, h, a[1] + (b[1] - a[1]) * t];
    B(
      o,
      'metal',
      P(0, A.upperFloor + A.balconyRailHeight),
      P(1, A.upperFloor + A.balconyRailHeight),
      0.06,
      0.075,
    );
    if (lod > 0) {
      B(o, 'metal', P(0, A.upperFloor + 0.12), P(1, A.upperFloor + 0.12), 0.055, 0.055);
      const N = Math.ceil(L / [1, 1.4, 0.65, 0.42][lod]);
      for (let j = 0; j <= N; j++)
        B(
          o,
          'metal',
          P(j / N, A.upperFloor + 0.1),
          P(j / N, A.upperFloor + A.balconyRailHeight),
          0.035,
          0.035,
        );
    }
  }
  for (let j = 0; j < A.frontSteps; j++) {
    const Z = A.verandaFront + (A.frontSteps - j) * A.stairTread,
      z = Z - A.stairTread,
      top = (A.platformTop * (j + 1)) / A.frontSteps;
    solid(o, 'stone', rect(-A.frontStairWidth / 2, A.frontStairWidth / 2, z, Z), 0, top);
    stairEvidence.push({ kind: 'front', center: [0, (z + Z) / 2], top });
  }
}
function clipPlane(r, a, b, c) {
  const out = [],
    inside = (q) => a * q[0] + b * q[1] <= c + 1e-9;
  for (let i = 0; i < r.length; i++) {
    const q = r[i],
      s = r[(i + 1) % r.length],
      I = inside(q),
      J = inside(s);
    if (I) out.push(q);
    if (I !== J) {
      const t = (c - a * q[0] - b * q[1]) / (a * (s[0] - q[0]) + b * (s[1] - q[1]));
      out.push(q.map((v, k) => v + (s[k] - v) * t));
    }
  }
  return out.filter((q, i, all) => !i || Math.hypot(...sub(q, all[i - 1])) > 1e-7);
}
export const roofParts = [
  { label: 'west-end-wing', ring: clip(native, 0, A.roofPartitionLeft, false), ridge: A.wingRidge },
  {
    label: 'central-hipped-body',
    ring: clip(clip(native, 0, A.roofPartitionLeft, true), 0, A.roofPartitionRight, false),
    ridge: A.centralRidge,
  },
  { label: 'east-end-wing', ring: clip(native, 0, A.roofPartitionRight, true), ridge: A.wingRidge },
];
export function roofPlanes(r, h) {
  const xs = r.map((q) => q[0]),
    zs = r.map((q) => q[1]),
    x = Math.min(...xs),
    X = Math.max(...xs),
    z = Math.min(...zs),
    Z = Math.max(...zs),
    k = (h - A.eave) / Math.min(A.roofHipRun, (X - x) / 2, (Z - z) / 2);
  return [
    [0, 0, h],
    [k, 0, A.eave - k * x],
    [-k, 0, A.eave + k * X],
    [0, k, A.eave - k * z],
    [0, -k, A.eave + k * Z],
  ];
}
export const roofHeight = (q, r, h) =>
  Math.min(...roofPlanes(r, h).map(([a, b, c]) => a * q[0] + b * q[1] + c));
function roofs(o, lod) {
  for (const p of roofParts) {
    const ps = roofPlanes(p.ring, p.ridge);
    // Clip convex source triangles so notched wings cannot bridge disconnected roof regions.
    for (const base of triangulate(p.ring))
      for (let i = 0; i < ps.length; i++) {
        let r = base.map((index) => p.ring[index]);
        for (let j = 0; j < ps.length; j++)
          if (i !== j)
            r = clipPlane(r, ps[i][0] - ps[j][0], ps[i][1] - ps[j][1], ps[j][2] - ps[i][2]);
        if (r.length < 3) continue;
        for (const ix of triangulate(r))
          T(
            o,
            'roof',
            ix.map((j) => [r[j][0], ps[i][0] * r[j][0] + ps[i][1] * r[j][1] + ps[i][2], r[j][1]]),
            [0, 1, 0],
          );
      }
    const sign = area(p.ring) > 0 ? 1 : -1;
    for (let i = 0; i < p.ring.length; i++) {
      const a = p.ring[i],
        b = p.ring[(i + 1) % p.ring.length];
      const delta = sub(b, a),
        ts = [0, 1];
      for (let j = 0; j < ps.length; j++)
        for (let k = j + 1; k < ps.length; k++) {
          const du = ps[j][0] - ps[k][0],
            dv = ps[j][1] - ps[k][1],
            den = du * delta[0] + dv * delta[1];
          if (Math.abs(den) < 1e-9) continue;
          const t = (ps[k][2] - ps[j][2] - du * a[0] - dv * a[1]) / den;
          if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
        }
      ts.sort((a, b) => a - b);
      const edges = [];
      for (const t of ts) {
        if (edges.length && t - edges.at(-1).t < 1e-7) continue;
        const q = a.map((v, k) => v + delta[k] * t),
          h = roofHeight(q, p.ring, p.ridge);
        while (edges.length > 1) {
          const c = edges.at(-2),
            d = edges.at(-1);
          if (Math.abs((d.h - c.h) * (t - d.t) - (h - d.h) * (d.t - c.t)) > 1e-7) break;
          edges.pop();
        }
        edges.push({ q, h, t });
      }
      for (let j = 0; j < edges.length - 1; j++) {
        const { q: a, h: y } = edges[j],
          { q: b, h: Y } = edges[j + 1];
        Q(
          o,
          'stone',
          [
            [a[0], A.wallTop, a[1]],
            [b[0], A.wallTop, b[1]],
            [b[0], Y, b[1]],
            [a[0], y, a[1]],
          ],
          [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        );
      }
    }
    const q = center(p.ring);
    roofEvidence.push({ label: p.label, q, top: roofHeight(q, p.ring, p.ridge) });
  }
  const N = [4, 8, 12, 20][lod],
    r = 1.25,
    spring = 11.7,
    z = 6.1,
    Z = 3.0,
    base = A.wallTop - 0.05,
    contour = [
      [-r, base],
      [r, base],
      ...Array.from({ length: N + 1 }, (_, i) => {
        const a = (Math.PI * i) / N;
        return [r * Math.cos(a), spring + r * Math.sin(a)];
      }),
    ];
  for (const ix of triangulate(contour))
    T(
      o,
      'stone',
      ix.map((i) => [contour[i][0], contour[i][1], z]),
      [0, 0, 1],
    );
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * i) / N,
      b = (Math.PI * (i + 1)) / N;
    Q(
      o,
      'roof',
      [
        [r * Math.cos(a), spring + r * Math.sin(a), z],
        [r * Math.cos(b), spring + r * Math.sin(b), z],
        [r * Math.cos(b), spring + r * Math.sin(b), Z],
        [r * Math.cos(a), spring + r * Math.sin(a), Z],
      ],
      [Math.cos((a + b) / 2), 1, 0],
    );
  }
  solid(o, 'dark', rect(-0.42, 0.42, z + 0.012, z + 0.04), 11.0, 11.9);
  if (lod > 0) {
    B(o, 'stone', [-0.55, 10.95, z + 0.08], [0.55, 10.95, z + 0.08], 0.12, 0.13);
    B(o, 'dark', [0, 11.05, z + 0.06], [0, 11.9, z + 0.06], 0.055, 0.055);
  }
}
export const porticoRing = rect(
  native[0][0] - A.porticoProjection,
  native[0][0],
  A.porticoCenterV - A.porticoWidth / 2,
  A.porticoCenterV + A.porticoWidth / 2,
);
function archWall(o, f, radius, lod, index) {
  const N = [4, 8, 12, 24][lod],
    spring = A.porticoArchSpring,
    y = A.platformTop,
    Y = A.porticoRoof,
    L = f.L,
    c = L / 2,
    D = A.porticoWallDepth,
    contour = [
      [0, y],
      [0, Y],
      [L, Y],
      [L, y],
      [c + radius, y],
      [c + radius, spring],
      ...Array.from({ length: N }, (_, i) => {
        const t = (Math.PI * (i + 1)) / N;
        return [c + radius * Math.cos(t), spring + radius * Math.sin(t)];
      }),
      [c - radius, y],
    ];
  for (const ix of triangulate(contour))
    for (const d of [0, -D])
      T(
        o,
        'wall',
        ix.map((i) => f.P(...contour[i], d)),
        [f.n[0] * (d === 0 ? 1 : -1), 0, f.n[1] * (d === 0 ? 1 : -1)],
      );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    Q(
      o,
      'stone',
      [f.P(...a), f.P(...b), f.P(...b, -D), f.P(...a, -D)],
      [f.u[0] * (b[1] - a[1]), a[0] - b[0], f.u[1] * (b[1] - a[1])],
    );
  }
  if (lod > 0)
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * i) / N,
        b = (Math.PI * (i + 1)) / N,
        r = radius + 0.17,
        R = radius + 0.02;
      Q(
        o,
        'stone',
        [
          f.P(c + r * Math.cos(a), spring + r * Math.sin(a), 0.07),
          f.P(c + r * Math.cos(b), spring + r * Math.sin(b), 0.07),
          f.P(c + R * Math.cos(b), spring + R * Math.sin(b), 0.07),
          f.P(c + R * Math.cos(a), spring + R * Math.sin(a), 0.07),
        ],
        [f.n[0], 0, f.n[1]],
      );
    }
  archEvidence.push({
    index,
    front: f.P(c, spring - 0.6),
    normal: [f.n[0], 0, f.n[1]],
    span: radius * 2,
  });
}
function portico(o, lod) {
  solid(o, 'stone', porticoRing, 0, A.platformTop);
  solid(o, 'stone', porticoRing, A.porticoRoof, A.porticoRoof + 0.16);
  for (const i of [0, 2, 3]) {
    const f = panel(porticoRing[i], porticoRing[(i + 1) % 4], porticoRing);
    archWall(o, f, i === 3 ? A.porticoFrontRadius : A.porticoSideRadius, lod, i);
    bar(o, 'wall', f, 0, f.L, A.porticoRoof + 0.16, A.porticoParapet, 0, 0.3);
    if (lod > 0)
      bar(
        o,
        'stone',
        f,
        -0.1,
        f.L + 0.1,
        A.porticoParapet - 0.06,
        A.porticoParapet + 0.05,
        0.08,
        0.42,
      );
  }
  for (let j = 0; j < A.sideSteps; j++) {
    const X = porticoRing[0][0] - (A.sideSteps - j - 1) * A.stairTread,
      x = X - A.stairTread,
      top = (A.platformTop * (j + 1)) / A.sideSteps;
    solid(o, 'stone', rect(x, X, A.porticoCenterV - 1.8, A.porticoCenterV + 1.8), 0, top);
    stairEvidence.push({ kind: 'side', center: [(x + X) / 2, A.porticoCenterV], top });
  }
}
function detail(o, lod) {
  for (const x of [-18.3, -7, 6, 18.5]) {
    solid(o, 'wall', rect(x - 0.5, x + 0.5, -1.4, -0.35), 12, A.chimneyTop - 0.5);
    solid(
      o,
      'stone',
      rect(x - 0.65, x + 0.65, -1.55, -0.2),
      A.chimneyTop - 0.5,
      A.chimneyTop - 0.3,
    );
    solid(o, 'wall', rect(x - 0.52, x + 0.52, -1.42, -0.33), A.chimneyTop - 0.3, A.chimneyTop);
    cap(o, 'dark', rect(x - 0.38, x + 0.38, -1.27, -0.48), A.chimneyTop + 0.006);
  }
  if (lod > 1)
    for (const q of native)
      for (let y = 0.8; y < A.wallTop - 0.4; y += lod === 2 ? 0.95 : 0.6) {
        const w = Math.round(y * 10) % 2 ? 0.45 : 0.3;
        solid(o, 'stone', rect(q[0] - w / 2, q[0] + w / 2, q[1] - 0.17, q[1] + 0.17), y, y + 0.22);
      }
}
export function buildJimbourHomestead(target, _frame, lod = 3) {
  for (const a of [
    partEvidence,
    nativeEvidence,
    openingEvidence,
    columnEvidence,
    roofEvidence,
    archEvidence,
    stairEvidence,
  ])
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
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-twelve-native-control-principal-house-foundation', () => {
    solid(o, 'wall', native, A.foundationBottom, A.platformTop);
    for (const q of native) nativeEvidence.push({ point: toWorld([q[0], 0, q[1]]) });
  });
  part('two-storey-sandstone-house-and-recessed-facades', () => body(o, lod));
  part('open-paired-column-front-veranda-balcony-and-stairs', () => veranda(o, lod));
  part('three-hipped-roof-parts-and-rounded-central-dormer', () => roofs(o, lod));
  part('open-three-arch-side-portico-and-steps', () => portico(o, lod));
  part('four-chimneys-and-stone-courses', () => detail(o, lod));
}
export const jimbourHomesteadSkyline = (o) => buildJimbourHomestead(o, null, 0),
  jimbourHomesteadDistrict = (o) => buildJimbourHomestead(o, null, 1),
  jimbourHomesteadStreet = (o) => buildJimbourHomestead(o, null, 2),
  jimbourHomesteadCloseup = (o) => buildJimbourHomestead(o, null, 3),
  cam = (x, y, z) => toWorld([x, y, z]);
export const jimbourHomesteadModel = {
  id: 'jimbour_homestead',
  key: 'jimbour_homestead',
  cell: 'r7/r75',
  title: 'Jimbour Homestead',
  wikidataId: 'Q14935453',
  category: 'historic-house',
  recipe: 'jimbour-homestead-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildJimbourHomestead,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole principalJimbourHouse: actual12controlstonebody/projectingendwings/twostoreys, threehippedslateroofparts/roundedcentraldormer/fourchimneys, longopenpairedDoriccolumnveranda/balcony/centralstairs and actualthreeopenarchesofintrinsicsideportico. Two exactpublished1925front/1928sideSLQPDoriginals, nativewholewallplan. Derivedveranda/porch explicitlyextendbeyondnativewalloutline; estate/detachedbuildings/gardens/interiors excluded. Hiddenroof/rear/census/colors/repairs bounded estimates.',
  camera: cam(-66, 40, 78),
  lookAt: cam(-1, 7, 0),
  portableGroundY: F - 0.45,
  mediumFiContext: { cameraYaw: -0.7, groundY: F - 0.3 },
  embeddedCanonicalGraphs: [
    'stone_sandstone_raw',
    'stone_sandstone',
    'slate',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-front-veranda-projecting-wings-and-hipped-roofs',
      position: cam(-56, 32, 66),
      lookAt: cam(0, 6, 0),
    },
    {
      name: 'whole-native-house-and-derived-intrinsic-portico-plan',
      position: cam(0, 78, 0.1),
      lookAt: cam(-1, 5, 0),
    },
    {
      name: 'paired-doric-columns-open-veranda-balcony-and-recessed-doors',
      position: cam(0, 7, 29),
      lookAt: cam(0, 3.2, 7.8),
    },
    {
      name: 'three-open-arches-and-recessed-west-side-entrance',
      position: cam(-38, 5.5, 11),
      lookAt: cam(-24, 2.6, -1),
    },
    {
      name: 'whole-rear-wings-slate-roof-dormer-and-four-chimneys',
      position: cam(48, 30, -52),
      lookAt: cam(0, 7, 0),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/jimbour-homestead-runtime-overlay.mjs',
    level: 'skyline',
    export: 'jimbourHomesteadSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'jimbourHomesteadDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'jimbourHomesteadStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'jimbourHomesteadCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Two exact1925front/1928side1000px SLQpublic-domainoriginals supply exteriorarchitecture; unrecordedarchivephotographer explicitlybound by existingprimarygrantverifier. No circa1890alteredroofstate/protectedmodernphotos/gardenpixels/inscriptions used. Currentcolors/roofdivisions/hiddenrear/windowcensus/details/repairs are originalboundedestimates, not currentsurvey/photogrammetry.',
    'All12nativewallcontrols preserved; attachedverandafloor/colonnade/balcony/sideportico/stairs are explicitlyphoto-derivedintrinsicarchitecture, not native-taggedmeasurements or a sitepad. Threeopenarchesretain genuinevoids at everyLOD. Separatehangar/chapel/outbuildings/estate/fences/gardens/interiors excluded.',
    'Original256m129field/nativeframe/floor/mainsectionsfixed beforegeometry, no laterfit/flatten/reframe/reacquire/replacement/raising. Contactunverified/geographicpreview/replacementfalse. Reviewground and syntheticneighborbuildings are fixtures.',
  ],
};

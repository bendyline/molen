/** Atalaya: native whole-house frame and seven cleared published exterior references. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dj/djz/atalaya_castle_us/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    plaster: rgb('b9b4a5'),
    brick: rgb('987765'),
    roof: rgb('9d9e92'),
    green: rgb('315e4c'),
    wood: rgb('72634d'),
    copper: rgb('698177'),
  },
  surfaces = {
    plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.99, metallic: 0 },
    brick: { slot: 'wall', graph: 'brick', roughness: 0.99, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    green: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
    wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
    copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.5 },
  };
export function atalayaGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function ring(o, s, x, z, y, r0, r1, h, n = 16, col = C[s]) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      P = (r, t, h) => [x + Math.cos(t) * r, h, z + Math.sin(t) * r];
    Q(
      o,
      s,
      [P(r0, a, y), P(r0, b, y), P(r1, b, y + h), P(r1, a, y + h)],
      [Math.cos(a), 0, Math.sin(a)],
      col,
    );
    T(o, s, [[x, y + h, z], P(r1, a, y + h), P(r1, b, y + h)], [0, 1, 0], col);
    T(o, s, [[x, y, z], P(r0, b, y), P(r0, a, y)], [0, -1, 0], col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const area = (P) =>
    P.reduce((s, a, i) => {
      const b = P[(i + 1) % P.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  ccw = (P) => (area(P) > 0 ? P : [...P].reverse());
function triangles(P) {
  const ix = P.map((_, i) => i),
    out = [],
    side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    inside = (q, a, b, c) =>
      side(a, b, q) >= -1e-8 && side(b, c, q) >= -1e-8 && side(c, a, q) >= -1e-8;
  let attempts = 0;
  while (ix.length > 3 && attempts++ < P.length * P.length) {
    let cut = false;
    for (let k = 0; k < ix.length; k++) {
      const a = ix[(k + ix.length - 1) % ix.length],
        b = ix[k],
        c = ix[(k + 1) % ix.length];
      if (side(P[a], P[b], P[c]) < 1e-8) continue;
      if (ix.some((i) => i !== a && i !== b && i !== c && inside(P[i], P[a], P[b], P[c]))) continue;
      out.push([P[a], P[b], P[c]]);
      ix.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) {
      const k = ix.findIndex(
        (b, k) =>
          Math.abs(side(P[ix[(k + ix.length - 1) % ix.length]], P[b], P[ix[(k + 1) % ix.length]])) <
          1e-6,
      );
      if (k < 0) throw Error('Native polygon cannot triangulate');
      ix.splice(k, 1);
    }
  }
  if (ix.length === 3) out.push(ix.map((i) => P[i]));
  return out;
}
function face(o, s, P, Y, n, col = C[s]) {
  for (const q of triangles(ccw(P)))
    T(
      o,
      s,
      q.map((v) => [v[0], typeof Y === 'function' ? Y(v) : Y, v[1]]),
      n,
      col,
    );
}
// The house occupies four actual roof polygons; courts remain open at every detail level.
export const atalayaParts = p.parts.map((v) => {
  let P = ccw(v.outline);
  if (v.id === 108704349) {
    const a = P[1],
      b = P[2],
      at = (x) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    P = [
      P[0],
      a,
      [7, at(7)],
      [7, at(7) - 1.4],
      [-12, at(-12) - 1.4],
      [-12, at(-12)],
      ...P.slice(2),
    ];
  }
  return { ...v, outline: P };
});
const rect = (x, z, w, l) => [
  [x - w / 2, z - l / 2],
  [x + w / 2, z - l / 2],
  [x + w / 2, z + l / 2],
  [x - w / 2, z + l / 2],
];
let detail = 3;
function wallCell(o, P, x0, x1, y0, y1, slot = 'plaster', back = 'brick') {
  if (x1 - x0 < 1e-5 || y1 - y0 < 1e-5) return;
  const a = P.a,
    u = P.u,
    n = P.n,
    h = A.wallThickness,
    V = (x, y, t) => [a[0] + u[0] * x - n[0] * t, y, a[1] + u[1] * x - n[1] * t],
    n3 = [n[0], 0, n[1]];
  Q(o, slot, [V(x0, y0, 0), V(x1, y0, 0), V(x1, y1, 0), V(x0, y1, 0)], n3);
  Q(
    o,
    back,
    [V(x1, y0, h), V(x0, y0, h), V(x0, y1, h), V(x1, y1, h)],
    n3.map((v) => -v),
  );
  if (detail <= 1) return;
  Q(o, 'brick', [V(x0, y1, 0), V(x1, y1, 0), V(x1, y1, h), V(x0, y1, h)], [0, 1, 0]);
  Q(o, 'brick', [V(x0, y0, h), V(x1, y0, h), V(x1, y0, 0), V(x0, y0, 0)], [0, -1, 0]);
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    Q(
      o,
      'brick',
      [V(x, y0, 0), V(x, y0, h), V(x, y1, h), V(x, y1, 0)],
      [u[0] * sign, 0, u[1] * sign],
    );
}
function grille(o, a, u, n, w, h, y, d) {
  const V = (x, yy, t = 0.28) => [a[0] + u[0] * x + n[0] * t, y + yy, a[1] + u[1] * x + n[1] * t],
    bar = (x0, y0, t0, x1, y1, t1, r = 0.018) => {
      const aa = V(x0, y0, t0),
        bb = V(x1, y1, t1);
      if (d < 3) {
        if (Math.hypot(x1 - x0, y1 - y0) < 1e-8) {
          const q = [V(x0 - r, y0, t0), V(x1 - r, y1, t1), V(x1 + r, y1, t1), V(x0 + r, y0, t0)];
          Q(o, 'green', q, [0, 1, 0]);
          Q(o, 'green', [...q].reverse(), [0, -1, 0]);
          return;
        }
        const L = Math.hypot(x1 - x0, y1 - y0),
          dx = (-(y1 - y0) * r) / L,
          dy = ((x1 - x0) * r) / L,
          q = [
            V(x0 - dx, y0 - dy, t0),
            V(x1 - dx, y1 - dy, t1),
            V(x1 + dx, y1 + dy, t1),
            V(x0 + dx, y0 + dy, t0),
          ];
        Q(o, 'green', q, [n[0], 0, n[1]]);
        if (d === 2) Q(o, 'green', [...q].reverse(), [-n[0], 0, -n[1]]);
        return;
      }
      axial(o, 'green', aa, bb, r, 3);
    };
  const cols = d === 1 ? 3 : d === 2 ? 5 : 7;
  for (let k = 0; k < cols; k++) {
    const x = -w / 2 + (w * k) / (cols - 1);
    bar(x, 0, 0.28, x, h, 0.28, d === 1 ? 0.04 : 0.018);
  }
  for (const yy of [0, h * 0.35, h * 0.7, h])
    bar(-w / 2, yy, 0.28, w / 2, yy, 0.28, d === 1 ? 0.035 : 0.022);
  if (d > 1) {
    for (const x of [-w / 2, w / 2]) for (const yy of [0, h]) bar(x, yy, 0, x, yy, 0.28, 0.024);
    if (d === 3) {
      for (const x of [-w / 2, w / 2]) {
        let prev = V(x - 0.04, 0, 0.28);
        for (let k = 1; k <= 6; k++) {
          const t = k / 6,
            aa = t * Math.PI * 6,
            q = V(x + Math.cos(aa) * 0.04, h * t, 0.28 + Math.sin(aa) * 0.04);
          axial(o, 'green', prev, q, 0.018, 3);
          prev = q;
        }
      }
      for (const sign of [-1, 1]) {
        let prev = V(sign * w * 0.23, h, 0.28);
        for (let k = 1; k <= 6; k++) {
          const t = (k / 6) * Math.PI * 1.6,
            q = V(sign * (w * 0.23 + 0.15 * Math.sin(t)), h + 0.16 + 0.15 * Math.cos(t), 0.28);
          axial(o, 'green', prev, q, 0.015, 3);
          prev = q;
        }
        bar(sign * w * 0.4, h, 0.28, sign * w * 0.4, h + 0.33, 0.28, 0.02);
      }
    }
  }
}
function house(o, d) {
  for (const part of atalayaParts) {
    const P = part.outline;
    face(o, 'roof', P, A.roof, [0, 1, 0]);
    face(o, 'wood', P, A.roof - 0.18, [0, -1, 0]);
    face(o, 'roof', P, 0.1, [0, 1, 0]);
    for (let k = 0; k < P.length; k++) {
      const a = P[k],
        b = P[(k + 1) % P.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [u[1], -u[0]],
        m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        F = { a, u, n },
        inner = part.id === 108704349 && m[0] > -24.2 && m[0] < 20 && m[1] < 25 && m[1] > -9,
        slot = inner ? 'brick' : 'plaster';
      if (d === 0) {
        wallCell(o, F, 0, L, -0.12, A.parapet, slot);
        continue;
      }
      wallCell(o, F, 0, L, A.roof, A.parapet, slot, 'brick');
      if (d === 0 || L < 3) {
        wallCell(o, F, 0, L, -0.12, A.roof, slot);
        continue;
      }
      let count = Math.max(1, Math.floor(L / 5.3)),
        doors = [];
      if (part.id === 108704349 && n[1] > 0.9 && m[1] > 27) {
        count = m[0] < -12 ? 8 : m[0] > 7 ? 6 : 3;
        if (m[0] > -12 && m[0] < 7) doors = [0.32, 0.68];
      }
      if (part.id === 108704349 && n[0] < -0.9 && L > 25) count = 7;
      const openings = [];
      for (let j = 0; j < count; j++) {
        if (d === 1 && j % 2 && L > 25) continue;
        openings.push({
          x: (L * (j + 0.5)) / count,
          w: Math.min(1.18, (L / count) * 0.43),
          y: 0.83,
          h: 2.05,
          door: false,
        });
      }
      for (const f of doors) openings.push({ x: L * f, w: 1.1, y: 0.1, h: 2.8, door: true });
      openings.sort((a, b) => a.x - b.x);
      let last = 0;
      for (const v of openings) {
        const x0 = v.x - v.w / 2,
          x1 = v.x + v.w / 2;
        if (x0 < last + 0.03) continue;
        wallCell(o, F, last, x0, -0.12, A.roof, slot);
        wallCell(o, F, x0, x1, -0.12, v.y, slot);
        wallCell(o, F, x0, x1, v.y + v.h, A.roof, slot);
        last = x1;
        if (!v.door) grille(o, [a[0] + u[0] * v.x, a[1] + u[1] * v.x], u, n, v.w, v.h, v.y, d);
        else if (d > 1) {
          const V = (x, y) => [
            a[0] + u[0] * (v.x + x) - n[0] * 0.22,
            y,
            a[1] + u[1] * (v.x + x) - n[1] * 0.22,
          ];
          Q(
            o,
            'green',
            [
              V(-v.w * 0.48, v.y),
              V(v.w * 0.48, v.y),
              V(v.w * 0.48, v.y + v.h),
              V(-v.w * 0.48, v.y + v.h),
            ],
            [n[0], 0, n[1]],
          );
        }
      }
      wallCell(o, F, last, L, -0.12, A.roof, slot);
      if (d > 1) {
        const V = (x, y, t) => [a[0] + u[0] * x + n[0] * t, y, a[1] + u[1] * x + n[1] * t];
        Q(
          o,
          'brick',
          [
            V(0, A.parapet, 0.055),
            V(L, A.parapet, 0.055),
            V(L, A.parapet + 0.07, -0.38),
            V(0, A.parapet + 0.07, -0.38),
          ],
          [0, 1, 0],
        );
      }
    }
  }
}
// A real open arcade, with a rounded masonry intrados and empty air below it.
function arch(o, x, z0, z1, d) {
  const r = (z1 - z0) / 2 - 0.25,
    c = (z0 + z1) / 2,
    spring = 1.35,
    top = 3.28,
    thick = 0.34,
    N = [2, 2, 8, 12][d],
    W = 2 * r;
  box(o, 'brick', x, 0.08, z0 + 0.125, thick, spring - 0.08, 0.25);
  box(o, 'brick', x, 0.08, z1 - 0.125, thick, spring - 0.08, 0.25);
  for (let k = 0; k < N; k++) {
    const a = Math.PI - (k * Math.PI) / N,
      b = Math.PI - ((k + 1) * Math.PI) / N,
      Z0 = c + Math.cos(a) * r,
      Z1 = c + Math.cos(b) * r,
      Y0 = spring + Math.sin(a) * (d === 0 ? 1.65 : r),
      Y1 = spring + Math.sin(b) * (d === 0 ? 1.65 : r);
    for (const sign of [-1, 1])
      Q(
        o,
        'brick',
        [
          [x + (sign * thick) / 2, Y0, Z0],
          [x + (sign * thick) / 2, Y1, Z1],
          [x + (sign * thick) / 2, top, Z1],
          [x + (sign * thick) / 2, top, Z0],
        ],
        [sign, 0, 0],
      );
    Q(
      o,
      'brick',
      [
        [x - thick / 2, Y0, Z0],
        [x + thick / 2, Y0, Z0],
        [x + thick / 2, Y1, Z1],
        [x - thick / 2, Y1, Z1],
      ],
      [0, -1, 0],
    );
  }
  if (d > 1) {
    for (let j = 0; j < 3; j++) {
      const y = 0.12 + j * 0.19,
        blocks = d === 2 ? 3 : 6;
      for (let k = 0; k < blocks; k++) {
        const zz = z0 + 0.38 + ((W - 0.3) * (k + 0.5 + (j % 2) * 0.25)) / blocks;
        if (zz < z1 - 0.3) box(o, 'brick', x, y, zz, 0.28, 0.1, ((W - 0.3) / blocks) * 0.62);
      }
    }
    box(o, 'brick', x, 0.75, c, 0.48, 0.16, W + 0.15);
    // Narrow flower box, open above, carried by the lattice rather than a solid panel.
    box(o, 'brick', x + 0.2, 0.89, c, 0.12, 0.22, W * 0.68);
    box(o, 'brick', x - 0.2, 0.89, c, 0.12, 0.22, W * 0.68);
    box(o, 'brick', x, 0.89, c, 0.4, 0.06, W * 0.68);
  }
}
function arcade(o, d) {
  const ends = [
      [-22.45, -1.6],
      [2.9, 23.6],
    ],
    x = -4.4;
  for (const [a, b] of ends) {
    box(o, 'roof', x, 3.28, (a + b) / 2, 3.65, 0.25, b - a);
    box(o, 'wood', x, 3.16, (a + b) / 2, 3.3, 0.12, b - a);
    box(o, 'roof', x, 0.03, (a + b) / 2, 3.45, 0.1, b - a);
    const spans = d === 0 ? 3 : 5;
    for (let k = 0; k < spans; k++) {
      const z0 = a + ((b - a) * k) / spans,
        z1 = a + ((b - a) * (k + 1)) / spans;
      for (const xx of [x - 1.6, x + 1.6]) arch(o, xx, z0, z1, d);
      if (d > 1) box(o, 'wood', x, 3.03, z0 + 0.1, 3.4, 0.14, 0.14);
    }
  }
}
function tower(o, d) {
  const [x, z] = A.tower,
    w = A.towerSize[0],
    l = A.towerSize[1],
    h = A.towerHeight;
  const P = rect(x, z, w, l);
  for (let k = 0; k < 4; k++) {
    const a = P[k],
      b = P[(k + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      F = { a, u, n: [u[1], -u[0]] };
    wallCell(o, F, 0, L, 3.15, h - 0.4, 'brick');
    wallCell(o, F, 0, L, h - 0.4, h, 'brick');
  }
  face(o, 'roof', P, h - 0.4, [0, 1, 0]);
  // Lower arcade passes through beneath the tower; two side bearing walls leave its full axis open.
  for (const xx of [x - w / 2, x + w / 2]) box(o, 'brick', xx, 0.08, z, 0.36, 3.1, l);
  if (d > 0) {
    for (const xx of [x - w / 2 - 0.02, x + w / 2 + 0.02]) {
      const n = xx < x ? -1 : 1;
      for (const zz of [z - 0.55, z + 0.55])
        Q(
          o,
          'wood',
          [
            [xx, 9.8, zz - 0.12],
            [xx, 9.8, zz + 0.12],
            [xx, 10.65, zz + 0.12],
            [xx, 10.65, zz - 0.12],
          ],
          [n, 0, 0],
        );
    }
  }
}
export const atalayaChimneys = [
  ...Array.from({ length: 9 }, (_, i) => [-30 + i * 6.5, 27]),
  ...Array.from({ length: 5 }, (_, i) => [-29, -5 + i * 5.6]),
  ...Array.from({ length: 5 }, (_, i) => [24, -5 + i * 5.6]),
  ...Array.from({ length: 3 }, (_, i) => [-28 + i * 7, -27]),
  ...Array.from({ length: 3 }, (_, i) => [8 + i * 8, -26]),
];
function chimneys(o, d) {
  for (let i = 0; i < atalayaChimneys.length; i++) {
    if (d === 0 && i % 3) continue;
    const [x, z] = atalayaChimneys[i],
      base = 4.2,
      h = 0.95 + (i % 3) * 0.18;
    box(o, 'brick', x, base, z, 0.48, h, 0.48);
    if (d > 0) {
      ring(o, 'copper', x, z, base + h, 0.24, 0.1, 0.26, d === 1 ? 4 : 8);
      if (d > 1) {
        const y = base + h + 0.1;
        axial(o, 'copper', [x, y, z], [x + 0.28, y + 0.18, z], 0.12, d === 2 ? 4 : 8, 0.18);
      }
    }
  }
}
function studio(o, d) {
  const x = -28,
    z = 9,
    w = 5.2,
    l = 8.8,
    y = 4.25,
    h = A.studioSkylightHeight;
  // A tall pyramidal studio skylight is a primary-text scale estimate, without glass photography.
  const P = rect(x, z, w, l),
    peak = [x, h, z];
  for (let i = 0; i < 4; i++) {
    const a = P[i],
      b = P[(i + 1) % 4];
    T(o, 'roof', [[a[0], y, a[1]], [b[0], y, b[1]], peak], [0, 1, 0]);
    if (d > 0) axial(o, 'green', [a[0], y, a[1]], peak, 0.04, d === 1 ? 3 : 4);
  }
}
function fixtures(o, d) {
  // Low west enclosure/gates connect the detached service wings while leaving all courts open.
  for (const [a, b] of [
    [
      [-32.5, -23.6],
      [-33.35, -9.43],
    ],
    [
      [29.5, -21.85],
      [29.14, -9.44],
    ],
  ]) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    wallCell(o, { a, u, n: [u[1], -u[0]] }, 0, L, 0.0, 2.3);
  }
  box(o, 'brick', -8.1, 0, -30.2, 0.45, 3, 0.5);
  box(o, 'brick', 4.35, 0, -30.2, 0.45, 3, 0.5);
  if (d > 0) {
    for (const s of [-1, 1]) {
      const x = s === -1 ? -6.25 : 2.35;
      box(o, 'green', x, 0.15, -30.2, 3.4, 2.35, 0.13);
      if (d > 1)
        for (let k = 0; k < 10; k++)
          box(o, 'wood', x - 1.5 + k * 0.33, 0.18, -30.12, 0.055, 2.27, 0.035);
    }
  }
  const patio = [
    [-12, 29.05],
    [7, 29.4],
    ...Array.from({ length: d === 0 ? 5 : 13 }, (_, i) => {
      const t = (i * Math.PI) / (d === 0 ? 4 : 12);
      return [-2.5 + Math.cos(t) * 9.5, 30 + Math.sin(t) * 3.0];
    }),
  ];
  face(o, 'roof', patio, 0.23, [0, 1, 0]);
  if (d > 0) {
    for (const x of [-16, 11])
      for (let k = 0; k < 12; k++)
        box(o, 'roof', x, 0.14 + k * 0.333, 25.2 + k * 0.24, 1.05, 0.333, 0.26);
  }
}
function build(o, _f, d = 3) {
  detail = d;
  house(o, d);
  arcade(o, d);
  tower(o, d);
  chimneys(o, d);
  studio(o, d);
  fixtures(o, d);
}
export const atalayaCastleSkyline = (o, f) => build(o, f, 0),
  atalayaCastleDistrict = (o, f) => build(o, f, 1),
  atalayaCastleStreet = (o, f) => build(o, f, 2),
  atalayaCastleCloseup = (o, f) => build(o, f, 3);
export const atalayaCastleModel = {
  id: 'atalaya_castle_us',
  key: 'atalaya_castle_us',
  cell: 'dj/djz',
  recipe: 'structure-atalaya-castle-us.mjs',
  title: 'Atalaya Castle',
  category: 'palace-castle-fort',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [98, 72, 106],
  lookAt: [-2, 4, 0],
  mediumFiContext: { scale: 1.6 },
  qaCameras: [
    {
      name: 'whole-house-four-native-parts-both-open-courts',
      position: [98, 72, 106],
      lookAt: [-2, 4, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'west-entry-service-wings-arcade-and-square-water-tower',
      position: [-25, 17, -62],
      lookAt: [-4, 4, -1],
    },
    {
      name: 'courtyard-open-round-arches-pierced-lattice-tower',
      position: [8, 5.0, -16],
      lookAt: [-4.4, 2.0, -7],
    },
    {
      name: 'east-recessed-facade-projecting-green-basket-grilles',
      position: [-6, 4.5, 39],
      lookAt: [-5, 2.1, 29.4],
    },
    {
      name: 'south-studio-skylight-and-copper-chimney-cowls',
      position: [-47, 12, 8],
      lookAt: [-27, 4, 9],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent provider-relative west approach datum, house floor0.1m/foundation-.12m estimate; source field preserved and actual host footing contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-atalaya-castle-us.mjs',
    level: 'skyline',
    export: 'atalayaCastleSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'atalayaCastleDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'atalayaCastleStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'atalayaCastleCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole four native house components/open courtyards/central covered walkway/water tower are included. Primary nominal200ft not used to stretch mapped outline. Tower12.192m height and25 rotating copper cowls are primary text facts; no cleared image shows tower upper profile. Its4x4.5m rectangular section/plain flat parapet/vents are explicitly restrained architectural estimates, not an observed elaborate minaret.25ft studio skylight height is textual; exact glazed roof profile, windows behind vegetation, grille count, ornaments and hidden rooms approximate.',
    'Seven exact published Qualla PD originals individually inspected, native SHA1/revision bound, unchanged policy passed. Named photographer Ron Osborne is bound to creator Rono359 by explicit Own/PD-self Atalaya1/2 and exact PD-user-en releases for other images. Primary NHL/owner text facts only; CC/ambiguous supplemental pixels/PDF plans/photos unused. No media/body/category/policy edits, photographic textures, generated bitmaps or downloaded mesh.',
    'Independent256m129square2m16641sample field/two original Terrarium tiles frozen before geometry; all values/PNG/bytes retained. Provider0.6948m fixed west approach datum is not surveyed floor grade. Source ground not flattened/fitted/reacquired. Actual host footing contact unverified; ordinary geographic preview/replacement disabled.',
    'L0 retains exact four house parts/open courts/covered arcade/tower and representative cowls; window grilles/individual chimneys/lattice reduced with distance. L3 adds actual window void/reveals/projecting basket bars/scrolls/twisted posts, arched open walkway and pierced low masonry flowerboxes. Lattice/window census/chimney positions/cowl turning angle approximate, not as-built measurement.',
    'Separate Brookgreen Gardens/park retail and restrooms/portable trailers/trees/animal sculpture/signs/furniture/people are excluded. No whole park slab or distant secondary site placement.',
  ],
};

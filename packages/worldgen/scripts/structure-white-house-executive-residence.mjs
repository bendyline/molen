/** White House Executive Residence: native whole main building, open Ionic porticos and Truman Balcony. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dq/dqc/white_house_executive_residence/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('dddcd3'),
    trim: rgb('e9e6dc'),
    roof: rgb('777d7c'),
    copper: rgb('34413b'),
    gold: rgb('b6a05d'),
    glass: rgb('62796f'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stucco', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.93, metallic: 0 },
    copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.55 },
    gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.75 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.39, metallic: 0.05 },
  };
export function whiteHouseGround(x, z) {
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
const Y = (y) => A.floorY + y;
function lathe(o, s, x, z, profile, n, flute = 0) {
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n,
      P = (q, t) => [
        x + Math.cos(t) * (q[1] - flute * (0.5 + 0.5 * Math.cos(t * 20))),
        Y(q[0]),
        z + Math.sin(t) * (q[1] - flute * (0.5 + 0.5 * Math.cos(t * 20))),
      ];
    for (let j = 1; j < profile.length; j++)
      Q(
        o,
        s,
        [P(profile[j - 1], a), P(profile[j - 1], b), P(profile[j], b), P(profile[j], a)],
        [Math.cos(a), 0, Math.sin(a)],
      );
    const lo = profile[0],
      hi = profile.at(-1);
    T(o, s, [[x, Y(lo[0]), z], P(lo, b), P(lo, a)], [0, -1, 0]);
    T(o, s, [[x, Y(hi[0]), z], P(hi, a), P(hi, b)], [0, 1, 0]);
  }
}
const part = (id) => p.parts.find((q) => q.id === id).outline;
const centroid = (P) =>
  P.reduce((a, q) => [a[0] + q[0] / P.length, a[1] + q[1] / P.length], [0, 0]);
export const whiteHouseColumns = p.parts
  .filter(
    (q) =>
      q.tags.height === '18' &&
      Math.max(...q.outline.map((v) => v[0])) - Math.min(...q.outline.map((v) => v[0])) < 2,
  )
  .map((q) => ({ id: q.id, centre: centroid(q.outline) }));
const chimneyIds = [
  257920188, 257920189, 257920190, 257920191, 257920194, 257920195, 257920196, 257920198,
];
function prism(o, s, P, lo, hi) {
  P = ccw(P);
  face(o, s, P, hi, [0, 1, 0]);
  for (let k = 0; k < P.length; k++) {
    const a = P[k],
      b = P[(k + 1) % P.length],
      L = typeof lo === 'function' ? lo : () => lo;
    Q(
      o,
      s,
      [
        [...a.slice(0, 1), L(...a), a[1]],
        [b[0], L(...b), b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function band(o, P, y, h, s = 'trim', offset = 0) {
  P = ccw(P);
  for (let k = 0; k < P.length; k++) {
    const a = P[k],
      b = P[(k + 1) % P.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.01) continue;
    const n = [(b[1] - a[1]) / L, (a[0] - b[0]) / L],
      V = (q, Y, dep) => [q[0] + n[0] * dep, Y, q[1] + n[1] * dep];
    Q(
      o,
      s,
      [V(a, y, offset), V(b, y, offset), V(b, y + h, offset), V(a, y + h, offset)],
      [n[0], 0, n[1]],
    );
    Q(
      o,
      s,
      [
        V(a, y + h, offset),
        V(b, y + h, offset),
        V(b, y + h, offset - 0.22),
        V(a, y + h, offset - 0.22),
      ],
      [0, 1, 0],
    );
  }
}
function wall(o, a, b, rows, d, windows = true) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    n = [u[1], -u[0]],
    V = (x, y, dep = 0) => [a[0] + u[0] * x + n[0] * dep, y, a[1] + u[1] * x + n[1] * dep],
    quad = (s, x0, x1, y0, y1, dep = 0) =>
      Q(o, s, [V(x0, y0, dep), V(x1, y0, dep), V(x1, y1, dep), V(x0, y1, dep)], [n[0], 0, n[1]]);
  const count = windows ? Math.max(1, Math.round(L / 4.0)) : 0,
    w = 1.63;
  if (d < 2) {
    Q(
      o,
      'stone',
      [
        [a[0], whiteHouseGround(...a) - 0.12, a[1]],
        [b[0], whiteHouseGround(...b) - 0.12, b[1]],
        V(L, 16.8),
        V(0, 16.8),
      ],
      [n[0], 0, n[1]],
    );
    if (!d || !count) return;
  } else {
    Q(
      o,
      'stone',
      [
        [a[0], whiteHouseGround(...a) - 0.12, a[1]],
        [b[0], whiteHouseGround(...b) - 0.12, b[1]],
        V(L, 0),
        V(0, 0),
      ],
      [n[0], 0, n[1]],
    );
    if (!count) {
      quad('stone', 0, L, 0, 16.8);
      return;
    }
  }
  for (let k = 0; k < count; k++) {
    const c = (L * (k + 0.5)) / count,
      l = c - w / 2,
      r = c + w / 2;
    if (d > 1) {
      quad('stone', (k * L) / count, l, 0, 16.8);
      quad('stone', r, ((k + 1) * L) / count, 0, 16.8);
      let last = 0;
      for (const [sill, top] of rows) {
        quad('stone', l, r, last, sill);
        last = top;
      }
      quad('stone', l, r, last, 16.8);
    }
    for (let j = 0; j < rows.length; j++) {
      const [sill, top] = rows[j],
        dep = d < 2 ? 0.025 : -0.22;
      quad('glass', l, r, sill, top, dep);
      if (d > 1) {
        for (const x of [l, r])
          Q(
            o,
            'trim',
            [V(x, sill), V(x, sill, -0.22), V(x, top, -0.22), V(x, top)],
            [n[0], 0, n[1]],
          );
        Q(o, 'trim', [V(l, sill), V(r, sill), V(r, sill, -0.22), V(l, sill, -0.22)], [0, 1, 0]);
        Q(o, 'trim', [V(l, top), V(r, top), V(r, top, -0.22), V(l, top, -0.22)], [0, -1, 0]);
      }
      for (const [x0, x1, y0, y1] of [
        [l - 0.14, l, sill - 0.12, top + 0.14],
        [r, r + 0.14, sill - 0.12, top + 0.14],
        [l, r, sill - 0.12, sill],
        [l, r, top, top + 0.14],
      ])
        quad('trim', x0, x1, y0, y1, 0.06);
      if (d > 1) {
        quad('trim', c - 0.035, c + 0.035, sill, top, -0.16);
        for (let m = 1; m <= 4; m++) {
          const y = sill + ((top - sill) * m) / 5;
          quad('trim', l, r, y - 0.028, y + 0.028, -0.16);
        }
        quad('trim', l - 0.26, r + 0.26, sill - 0.22, sill - 0.1, 0.18);
      }
      if (j === 1 && d > 1) {
        const P = [
          V(l - 0.27, top + 0.25, 0.24),
          V(r + 0.27, top + 0.25, 0.24),
          V(c, top + 0.95, 0.24),
        ];
        if (k % 2 === 0) {
          T(o, 'trim', P, [n[0], 0, n[1]]);
          if (d === 3) {
            axial(o, 'trim', P[0], P[2], 0.09, 4);
            axial(o, 'trim', P[2], P[1], 0.09, 4);
          }
        } else {
          const N = d === 3 ? 12 : 6;
          for (let q = 0; q < N; q++) {
            const t0 = Math.PI - (q * Math.PI) / N,
              t1 = Math.PI - ((q + 1) * Math.PI) / N;
            axial(
              o,
              'trim',
              V(c + 1.03 * Math.cos(t0), top + 0.2 + 0.55 * Math.sin(t0), 0.22),
              V(c + 1.03 * Math.cos(t1), top + 0.2 + 0.55 * Math.sin(t1), 0.22),
              0.09,
              d === 3 ? 4 : 2,
            );
          }
        }
      }
    }
  }
}
function spiral(o, x, y, z, sign, d) {
  let prev;
  for (let k = 0; k <= (d === 3 ? 14 : 7); k++) {
    const N = d === 3 ? 14 : 7,
      t = (k / N) * Math.PI * 3.2,
      r = 0.23 * (1 - k / N) + 0.04,
      q = [x + sign * Math.cos(t) * r, y + Math.sin(t) * r, z];
    if (prev) axial(o, 'trim', prev, q, 0.044, d === 3 ? 4 : 2);
    prev = q;
  }
}
function column(o, x, z, d) {
  const lo = 4,
    hi = 16.8,
    profile =
      d === 0
        ? [
            [lo, 0.59],
            [hi, 0.49],
          ]
        : d === 1
          ? [
              [lo, 0.7],
              [lo + 0.4, 0.57],
              [hi - 0.45, 0.48],
              [hi, 0.7],
            ]
          : d === 2
            ? [
                [lo, 0.7],
                [lo + 0.5, 0.56],
                [hi - 0.6, 0.48],
                [hi - 0.3, 0.68],
                [hi, 0.74],
              ]
            : [
                [lo, 0.74],
                [lo + 0.13, 0.74],
                [lo + 0.23, 0.63],
                [lo + 0.4, 0.66],
                [lo + 0.55, 0.56],
                [hi - 0.6, 0.48],
                [hi - 0.5, 0.63],
                [hi - 0.3, 0.7],
                [hi - 0.13, 0.67],
                [hi, 0.76],
              ];
  lathe(o, 'trim', x, z, profile, [4, 6, 8, 24][d]);
  if (d > 1) for (const sign of [-1, 1]) spiral(o, x + sign * 0.39, hi - 0.27, z + 0.46, sign, d);
}
function balustrade(o, P, y, d, closed = true) {
  const N = closed ? P.length : P.length - 1;
  for (let k = 0; k < N; k++) {
    const a = P[k],
      b = P[(k + 1) % P.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.04) continue;
    axial(o, 'trim', [a[0], y + 0.08, a[1]], [b[0], y + 0.08, b[1]], 0.12, 4);
    axial(o, 'trim', [a[0], y + 1.0, a[1]], [b[0], y + 1.0, b[1]], 0.14, 4);
    if (d < 2) continue;
    const count = Math.max(1, Math.round(L / (d === 2 ? 1.1 : 0.65)));
    for (let j = 0; j <= count; j++) {
      const t = j / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (d < 3) axial(o, 'trim', [x, y + 0.12, z], [x, y + 0.92, z], 0.075, d === 1 ? 3 : 4, 0.1);
      else
        lathe(
          o,
          'trim',
          x,
          z,
          [
            [y + 0.12, 0.13],
            [y + 0.22, 0.13],
            [y + 0.3, 0.075],
            [y + 0.6, 0.125],
            [y + 0.76, 0.075],
            [y + 0.92, 0.11],
          ],
          6,
        );
    }
  }
}
const arc = (r, n = 24, z = 13.25, angle = Math.PI, rz = r * 0.77) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const t = (k / n) * angle;
    return [r * Math.cos(t), z + rz * Math.sin(t)];
  });
function balcony(o, d) {
  const P = arc(8.4, [4, 8, 16, 28][d], 12.9, Math.PI, 5.7);
  prism(o, 'trim', P, 9.55, 9.95);
  const count = d === 0 ? 4 : d === 1 ? 12 : d === 2 ? 34 : 66;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI,
      b = ((k + 1) / count) * Math.PI,
      V = (t, y) => [8.2 * Math.cos(t), y, 12.9 + 5.55 * Math.sin(t)];
    axial(o, 'copper', V(a, 11), V(b, 11), 0.035, d > 1 ? 4 : 2);
    axial(o, 'copper', V(a, 10), V(a, 11), 0.027, d > 1 ? 4 : 2);
  }
}
function house(o, d) {
  const body = [
      [-26.2, -13.25],
      [26.2, -13.25],
      [26.2, 13.25],
      [-26.2, 13.25],
    ],
    rows = [
      [0.7, 2.9],
      [4.8, 8.5],
      [10.7, 14.1],
    ];
  for (let k = 0; k < 4; k++) wall(o, body[k], body[(k + 1) % 4], rows, d);
  // The small native central southern oval-room bay is attached to the main body.
  const bay = part(257920202);
  if (d === 0) prism(o, 'stone', bay, 0, 20);
  else
    for (let k = 0; k < bay.length; k++)
      wall(
        o,
        bay[k],
        bay[(k + 1) % bay.length],
        rows,
        d,
        Math.hypot(
          bay[(k + 1) % bay.length][0] - bay[k][0],
          bay[(k + 1) % bay.length][1] - bay[k][1],
        ) > 2.4,
      );
  // Main cornice and continuous real stone balustrade around the main body.
  band(o, body, 16.8, 1.1, 'trim', 0.3);
  band(o, body, 17.9, 0.25, 'trim', 0.42);
  face(o, 'roof', body, 18.02, [0, 1, 0]);
  if (d > 0) balustrade(o, body, 18.05, d);
  // Hipped metal main roof; the north projecting gabled roof intersects it naturally.
  const B = [
      [-22.5, -9.75],
      [22.5, -9.75],
      [22.5, 9.75],
      [-22.5, 9.75],
    ],
    R = [
      [-18.5, 0],
      [18.5, 0],
    ];
  band(o, B, 18.02, 1.23, 'stone', 0);
  Q(
    o,
    'roof',
    [
      [...B[0].slice(0, 1), 19.25, B[0][1]],
      [B[1][0], 19.25, B[1][1]],
      [R[1][0], 21, 0],
      [R[0][0], 21, 0],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [B[2][0], 19.25, B[2][1]],
      [B[3][0], 19.25, B[3][1]],
      [R[0][0], 21, 0],
      [R[1][0], 21, 0],
    ],
    [0, 1, 0],
  );
  T(
    o,
    'roof',
    [
      [B[0][0], 19.25, B[0][1]],
      [R[0][0], 21, 0],
      [B[3][0], 19.25, B[3][1]],
    ],
    [-1, 1, 0],
  );
  T(
    o,
    'roof',
    [
      [B[1][0], 19.25, B[1][1]],
      [B[2][0], 19.25, B[2][1]],
      [R[1][0], 21, 0],
    ],
    [1, 1, 0],
  );
  prism(o, 'stone', bay, 18, 20.1);
  face(o, 'roof', bay, 20.15, [0, 1, 0]);
  if (d > 1) {
    const P = arc(4.1, 12, 13.2, Math.PI, 4.1);
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k],
        b = P[k + 1];
      Q(
        o,
        'glass',
        [
          [a[0], 18.5, a[1]],
          [b[0], 18.5, b[1]],
          [b[0], 19.7, b[1]],
          [a[0], 19.7, a[1]],
        ],
        [a[0], 0, a[1] - 13.2],
      );
    }
  }
  for (const id of chimneyIds) {
    const P = part(id),
      [x, z] = centroid(P);
    box(o, 'trim', x, 19.4, z, 1.85, 3.25, 2.35);
    if (d > 0) {
      box(o, 'trim', x, 22.65, z, 2.1, 0.35, 2.65);
      if (d > 1) box(o, 'roof', x, 23, z, 1.1, 0.22, 1.35);
    }
  }
  if (d > 1)
    for (let k = 0; k <= 30; k++) {
      const x = -21.6 + k * 1.44;
      for (const z of [-9.6, 9.6]) axial(o, 'roof', [x, 19.3, z], [x, 20.96, 0], 0.018, 2);
    }
  axial(o, 'trim', [0, 20.7, 0], [0, 30, 0], 0.065, d > 1 ? 8 : 4, 0.035);
  lathe(
    o,
    'gold',
    0,
    0,
    [
      [29.95, 0.1],
      [30.15, 0.04],
      [30.25, 0],
    ],
    d > 1 ? 8 : 4,
  );
}
function porticos(o, d) {
  for (const q of whiteHouseColumns) column(o, ...q.centre, d);
  // Semicircular southern roof/entablature leaves air between the real column shafts.
  const S = arc(9.5, [6, 12, 24, 40][d], 13.25, Math.PI, 7.4);
  prism(o, 'trim', S, 16.8, 18);
  if (d > 0) balustrade(o, S, 18.05, d);
  const N = [
    [-8.15, -13.2],
    [8.15, -13.2],
    [8.15, -26.0],
    [-8.15, -26.0],
  ];
  prism(o, 'trim', N, 16.8, 18);
  const F = [
      [-8.3, 18, -26.2],
      [8.3, 18, -26.2],
      [0, 21, -26.2],
    ],
    B = F.map((q) => [q[0], q[1], 0.2]);
  T(o, 'trim', F, [0, 0, -1]);
  T(o, 'trim', B, [0, 0, 1]);
  Q(o, 'roof', [F[0], B[0], B[2], F[2]], [-1, 1, 0]);
  Q(o, 'roof', [F[2], B[2], B[1], F[1]], [1, 1, 0]);
  if (d > 1) {
    for (const [a, b] of [
      [F[0], F[2]],
      [F[2], F[1]],
      [F[0], F[1]],
    ])
      axial(o, 'trim', a, b, 0.14, 4);
    for (let k = 0; k <= 28; k++) {
      const x = -8.0 + (k * 16) / 28;
      box(o, 'trim', x, 16.65, -26.12, 0.18, 0.22, 0.33);
    }
    for (let k = 0; k <= 42; k++) {
      const t = (k / 42) * Math.PI;
      box(o, 'trim', 9.55 * Math.cos(t), 16.62, 13.25 + 7.45 * Math.sin(t), 0.18, 0.22, 0.26);
    }
  }
  // Intrinsic State-floor decks and approaches, retaining the independent ground underneath.
  const south = part(257920173);
  prism(o, 'stone', south, (x, z) => whiteHouseGround(x, z) - 0.12, 3.8);
  face(o, 'trim', south, 4, [0, 1, 0]);
  prism(
    o,
    'trim',
    [
      [-8.1, -13.2],
      [8.1, -13.2],
      [8.1, -25.5],
      [-8.1, -25.5],
    ],
    (x, z) => whiteHouseGround(x, z) - 0.12,
    4,
  );
  const steps = d === 0 ? 3 : 10;
  for (let k = 0; k < steps; k++) {
    const z = -27.8 + k * 0.24,
      y = whiteHouseGround(0, -28) + ((4 - whiteHouseGround(0, -28)) * (k + 1)) / steps;
    box(
      o,
      'trim',
      0,
      whiteHouseGround(0, z) - 0.12,
      z,
      15.8,
      Math.max(0.02, y - whiteHouseGround(0, z) + 0.12),
      0.28,
    );
  }
  // Matching curved stair flights at the outer edges of the south terrace.
  for (const sign of [-1, 1]) {
    const n = d === 0 ? 3 : d === 1 ? 6 : 14;
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n) * Math.PI * 0.55,
        x = sign * (9.5 + 1.8 * Math.sin(t)),
        z = 13.2 + 6.6 * Math.cos(t),
        h = (4 * (k + 1)) / n;
      box(
        o,
        'trim',
        x,
        whiteHouseGround(x, z) - 0.1,
        z,
        2.0,
        Math.max(0.02, h - whiteHouseGround(x, z) + 0.1),
        0.6,
      );
    }
  }
  balcony(o, d);
  if (d > 0) {
    box(o, 'copper', 0.35, 4.05, -13.31, 1.8, 3.65, 0.15);
    box(o, 'trim', 0.35, 7.7, -13.42, 3.1, 0.3, 0.3);
    const n = d === 1 ? 6 : 16;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI,
        b = ((k + 1) / n) * Math.PI,
        P = (t) => [0.35 + 1.12 * Math.cos(t), 8.0 + 1.12 * Math.sin(t), -13.42];
      T(o, 'glass', [[0.35, 8, -13.42], P(a), P(b)], [0, 0, -1]);
      if (d > 1) {
        axial(o, 'trim', P(a), P(b), 0.08, 4);
        axial(o, 'trim', [0.35, 8, -13.44], P(a), 0.025, 2);
      }
    }
    for (const x of [-0.75, 1.45]) box(o, 'trim', x, 4, -13.47, 0.25, 4.0, 0.3);
  }

  if (d > 0) {
    const s = arc(9.7, d === 1 ? 8 : 24);
    for (let k = 0; k < s.length - 1; k++) {
      const a = s[k],
        b = s[k + 1];
      axial(o, 'copper', [a[0], 5.02, a[1]], [b[0], 5.02, b[1]], 0.03, 2);
      if (d > 1)
        for (let j = 0; j < 3; j++) {
          const t = j / 3,
            x = a[0] * (1 - t) + b[0] * t,
            z = a[1] * (1 - t) + b[1] * t;
          axial(o, 'copper', [x, 4, z], [x, 5.02, z], 0.023, 2);
        }
    }
  }
}
function build(o, _f, d = 3) {
  house(o, d);
  porticos(o, d);
}
export const whiteHouseSkyline = (o, f) => build(o, f, 0),
  whiteHouseDistrict = (o, f) => build(o, f, 1),
  whiteHouseStreet = (o, f) => build(o, f, 2),
  whiteHouseCloseup = (o, f) => build(o, f, 3);
export const whiteHouseExecutiveResidenceModel = {
  id: 'white_house_executive_residence',
  key: 'white_house_executive_residence',
  cell: 'dq/dqc',
  recipe: 'structure-white-house-executive-residence.mjs',
  title: 'The White House',
  category: 'government-building',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [77, 48, 86],
  lookAt: [0, 10, 0],
  mediumFiContext: { scale: 1.6 },
  qaCameras: [
    {
      name: 'whole-main-residence-south-portico-balcony-and-roof',
      position: [77, 48, 86],
      lookAt: [0, 10, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'south-six-ionic-columns-truman-balcony-and-real-openings',
      position: [22, 13, 39],
      lookAt: [0, 11, 13],
    },
    {
      name: 'north-open-ionic-portico-gabled-pediment-and-entry',
      position: [25, 12, -45],
      lookAt: [0, 11, -17],
    },
    {
      name: 'eight-native-chimneys-hipped-roof-stone-balusters-and-flagstaff',
      position: [40, 38, -10],
      lookAt: [0, 18, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-white-house-executive-residence.mjs',
    level: 'skyline',
    export: 'whiteHouseSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'whiteHouseDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'whiteHouseStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'whiteHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole main Executive Residence only; 14 native column centres and8 mapped chimney positions preserved. Photo-proportional openings/window counts, Ioniccapitals/volutes, curved balcony sections, attic wall/roof junction, curving stair treads, fine moldings and roof hardware are medium-fi approximations. No roominterior/newballroom/separateofficewings/art/grounds.',
    'Three individually inspected exact official public-domain photographs with named staff credits/official source/federal grant and native bytes; first is cleared publishedQualla. Views are cropped component references, whole form rests on mapped components; no claim of survey or full photographic coverage. No photographictextures/generatedbitmaps/borrowedmodels.',
    'Independent256m129square16641-sample field/two original Terrariumtiles frozen before geometry, values and hashes retained. Mainstatefloor4m over fixedSouthapproach16.2404mprovider datum is approximate. Terrain neverflattened/fitted/reacquired; hostgroundcontactunverified and replacementdisabled.',
    'Four authored LODs preserve mainbody/bothopenporticos/TrumanBalcony/8chimneys/roof/flagstaff. Distant windows/baluster/rail/mullion/volute and dentil sections reduced.',
  ],
};

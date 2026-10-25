/** Greenville: surviving granite column, marble soldier and paired Parrott display guns. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dn/dnj/confederate_monument_greenville_south_carolina/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = { granite: rgb('aaa99c'), marble: rgb('e1e2d5'), iron: rgb('414743'), dark: rgb('303631') },
  surfaces = {
    granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
    marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.9, metallic: 0 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.28 },
    dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.99, metallic: 0.18 },
  };
export function greenvilleMonumentGround(x, z) {
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
function loft(o, s, rings, col = C[s], cap = true) {
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j],
      c = centre3(a);
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      Q(o, s, [a[i], a[k], b[k], b[i]], [a[i][0] - c[0], 0, a[i][2] - c[2]], col);
    }
  }
  if (cap)
    for (const [R, n] of [
      [rings[0], [0, -1, 0]],
      [rings.at(-1), [0, 1, 0]],
    ]) {
      const c = centre3(R);
      for (let i = 0; i < R.length; i++) T(o, s, [c, R[i], R[(i + 1) % R.length]], n, col);
    }
}
const centre3 = (P) => [0, 1, 2].map((k) => P.reduce((s, v) => s + v[k], 0) / P.length);
function square(y, w, d) {
  const r = w / 2,
    c = d > 1 ? 0.035 : 0;
  return (
    d > 1
      ? [
          [-r + c, -r],
          [r - c, -r],
          [r, -r + c],
          [r, r - c],
          [r - c, r],
          [-r + c, r],
          [-r, r - c],
          [-r, -r + c],
        ]
      : [
          [-r, -r],
          [r, -r],
          [r, r],
          [-r, r],
        ]
  ).map(([x, z]) => [x, y, z]);
}
function profile(o, s, levels, d, col = C[s]) {
  loft(
    o,
    s,
    levels.map(([y, w]) => square(y, w, d)),
    col,
  );
}
function facePanel(o, s, poly, P, n, holes = []) {
  const all = [poly, ...holes].flat(),
    starts = holes.map((_, i) => poly.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    T(
      o,
      s,
      ix.slice(j, j + 3).map((i) => P(...all[i])),
      n,
    );
}
function pedestal(o, d) {
  profile(
    o,
    'granite',
    d === 0
      ? [
          [0, 3.05],
          [0.35, 3.05],
          [0.65, 2.4],
          [1.02, 1.65],
        ]
      : [
          [0, 3.05],
          [0.2, 3.05],
          [0.24, 2.82],
          [0.42, 2.82],
          [0.46, 2.46],
          [0.67, 2.46],
          [0.72, 2.06],
          [0.9, 2.06],
          [1.02, 1.65],
        ],
    d,
  );
  const low = square(1.02, 1.65, d),
    high = square(2.35, 1.65, d);
  for (let i = 0; i < low.length; i++) {
    const a = low[i],
      b = low[(i + 1) % low.length],
      l = Math.hypot(b[0] - a[0], b[2] - a[2]),
      u = [(b[0] - a[0]) / l, (b[2] - a[2]) / l],
      n = [u[1], 0, -u[0]],
      c = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2],
      P = (x, y, z = 0) => [c[0] + u[0] * x + n[0] * z, y, c[1] + u[1] * x + n[2] * z],
      rect = [
        [-l / 2, 1.02],
        [l / 2, 1.02],
        [l / 2, 2.35],
        [-l / 2, 2.35],
      ],
      hole = [
        [-0.5, 1.17],
        [0.5, 1.17],
        [0.5, 2.18],
        [-0.5, 2.18],
      ];
    if (l < 1.3 || d < 2) Q(o, 'granite', [a, b, high[(i + 1) % high.length], high[i]], n);
    else {
      facePanel(o, 'granite', rect, P, n, [hole]);
      for (let k = 0; k < 4; k++) {
        const a = hole[k],
          b = hole[(k + 1) % 4];
        Q(o, 'granite', [P(...a), P(...b), P(...b, -0.045), P(...a, -0.045)]);
      }
      facePanel(o, 'granite', hole, (x, y) => P(x, y, -0.045), n);
      if (d === 3)
        for (let k = 0; k < 8; k++) {
          const w = k % 3 === 0 ? 0.63 : 0.81,
            y = 1.3 + k * 0.093;
          Q(
            o,
            'granite',
            [
              P(-w / 2, y, -0.044),
              P(w / 2, y, -0.044),
              P(w / 2, y + 0.009, -0.044),
              P(-w / 2, y + 0.009, -0.044),
            ],
            n,
            rgb('8a8b7f'),
          );
        }
    }
  }
  profile(
    o,
    'granite',
    d === 0
      ? [
          [2.35, 1.8],
          [2.7, 1.25],
          [5.0, 1.21],
          [5.16, 1.35],
          [5.26, 1.12],
          [7.58, 0.97],
          [7.9, 1.6],
          [8.2, 1.18],
          [8.5344, 0.8],
        ]
      : [
          [2.35, 1.8],
          [2.43, 1.8],
          [2.52, 1.55],
          [2.65, 1.34],
          [2.7, 1.25],
          [5.0, 1.21],
          [5.04, 1.35],
          [5.16, 1.35],
          [5.22, 1.12],
          [7.55, 0.97],
          [7.63, 1.06],
          [7.7, 1.2],
          [7.78, 1.44],
          [7.84, 1.44],
          [7.88, 1.6],
          [7.98, 1.6],
          [8.08, 1.36],
          [8.22, 1.2],
          [8.38, 0.8],
          [8.5344, 0.8],
        ],
    d,
  );
  if (d > 1) {
    for (const sign of [-1, 1])
      for (let j = 0; j < 5; j++) {
        const a = sign * (0.2 + j * 0.047),
          y = 1.35 + j * 0.09;
        ell(o, 'granite', [a, y, 0.82], [0.105, 0.033, 0.035], d, 6, 4);
      }
    axial(o, 'granite', [0, 1.4, 0.815], [0, 2.06, 0.815], 0.022, 6);
    for (const sign of [-1, 1])
      for (let j = 0; j < 3; j++)
        axial(
          o,
          'granite',
          [0, 2.01 - j * 0.07, 0.82],
          [sign * (0.15 + j * 0.02), 1.99 - j * 0.08, 0.83],
          0.022,
          6,
        );
  }
}
function ell(o, s, c, r, d, n = [5, 8, 12, 20][d], rows = [3, 4, 6, 10][d], col = C[s]) {
  const P = (j, i) => {
    const a = (i * 2 * Math.PI) / n,
      t = -Math.PI / 2 + (j * Math.PI) / rows;
    return [
      c[0] + Math.cos(t) * Math.sin(a) * r[0],
      c[1] + Math.sin(t) * r[1],
      c[2] + Math.cos(t) * Math.cos(a) * r[2],
    ];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const q = [P(j, i), P(j, i + 1), P(j + 1, i + 1), P(j + 1, i)],
        n0 = q[0].map((v, k) => v - c[k]);
      Q(o, s, q, n0, col);
    }
}
function bodyRings(o, levels, d) {
  const n = [5, 8, 14, 24][d],
    rings = levels.map(([y, rx, rz, x = 0, z = 0]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          f = d > 1 ? 1 + 0.035 * Math.cos(a * 5 + y * 3) : 1;
        return [x + Math.sin(a) * rx * f, A.statueBase + y, z + Math.cos(a) * rz * f];
      }),
    );
  loft(o, 'marble', rings);
}
function soldier(o, d) {
  const Y = A.statueBase,
    n = [5, 8, 14, 24][d],
    pt = (q) => [q[0], Y + q[1], q[2]];
  for (const sign of [-1, 1]) {
    const x = sign * 0.125,
      z = sign > 0 ? 0.04 : 0;
    ell(o, 'marble', pt([x, 0.07, z + 0.075]), [0.105, 0.07, 0.2], d);
    bodyRings(
      o,
      [
        [0.1, 0.085, 0.085, x, z],
        [0.37, 0.093, 0.086, x + 0.015 * sign, z],
        [0.57, 0.105, 0.11, x + 0.02 * sign, z - 0.01],
        [0.82, 0.1, 0.105, x, z],
        [1.02, 0.11, 0.11, x, z],
      ],
      d,
    );
  }
  bodyRings(
    o,
    d === 0
      ? [
          [0.82, 0.25, 0.15],
          [1.22, 0.23, 0.15],
          [1.6, 0.31, 0.18],
          [1.75, 0.18, 0.13],
        ]
      : [
          [0.81, 0.255, 0.16],
          [0.92, 0.26, 0.16],
          [1.14, 0.23, 0.155],
          [1.28, 0.23, 0.16],
          [1.52, 0.3, 0.18],
          [1.66, 0.3, 0.17],
          [1.76, 0.16, 0.115],
        ],
    d,
  );
  bodyRings(
    o,
    [
      [1.7, 0.075, 0.075],
      [1.85, 0.075, 0.075],
    ],
    d,
  );
  const faceLevels = [
      [1.79, 0.06, 0.07],
      [1.83, 0.085, 0.09],
      [1.87, 0.105, 0.11],
      [1.94, 0.115, 0.125],
      [2.01, 0.125, 0.125],
      [2.07, 0.11, 0.1],
      [2.1, 0.07, 0.07],
    ],
    rings = faceLevels.map(([y, rx, rz]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          front = Math.max(0, Math.cos(a)),
          nose =
            d > 0 ? 0.035 * Math.exp(-Math.pow((y - 1.94) / 0.041, 2)) * Math.pow(front, 18) : 0;
        return [Math.sin(a) * rx, Y + y, Math.cos(a) * rz + nose];
      }),
    );
  loft(o, 'marble', rings);
  for (const sign of [-1, 1]) {
    const a = [sign * 0.275, 1.64, 0],
      b = [sign * 0.32, 1.31, 0.065],
      c = [sign < 0 ? -0.2 : -0.13, 1.26, 0.245];
    axial(o, 'marble', pt(a), pt(b), 0.083, d === 0 ? 4 : d === 1 ? 6 : 10, 0.07);
    axial(o, 'marble', pt(b), pt(c), 0.067, d === 0 ? 4 : d === 1 ? 6 : 10, 0.055);
    ell(o, 'marble', pt(c), [0.065, 0.047, 0.065], d, d < 2 ? 5 : 8, 4);
  }
  // The wide brim and indented crown are silhouette features even at the far level.
  loft(
    o,
    'marble',
    [
      [2.075, 0.225, 0.18],
      [2.095, 0.235, 0.19],
      [2.12, 0.14, 0.125],
      [2.19, 0.13, 0.115],
      [2.2, 0.07, 0.09],
    ].map(([y, rx, rz]) =>
      Array.from({ length: d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 20 : 32 }, (_, i) => {
        const a = (i * 2 * Math.PI) / (d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 20 : 32);
        return [Math.sin(a) * rx, Y + y - 0.015 * Math.sin(a), Math.cos(a) * rz];
      }),
    ),
  );
  // Long carved rifle: stock at the shoe, rising vertically just inside the right hand.
  box(o, 'marble', -0.2, Y + 0.1, 0.255, 0.065, 0.65, 0.085);
  axial(
    o,
    'marble',
    pt([-0.2, 0.68, 0.26]),
    pt([-0.2, 1.7, 0.26]),
    0.022,
    d === 0 ? 4 : d === 1 ? 6 : 10,
  );
  if (d > 1) {
    for (const y of [0.75, 1.02, 1.48])
      ring(o, 'marble', -0.2, 0.26, Y + y, 0.029, 0.029, 0.035, 8);
    axial(o, 'marble', pt([-0.18, 0.81, 0.3]), pt([-0.12, 0.91, 0.3]), 0.012, 6);
    for (const sign of [-1, 1]) {
      ell(o, 'marble', pt([sign * 0.122, 1.94, 0]), [0.023, 0.05, 0.027], d, 8, 5);
      axial(
        o,
        'marble',
        pt([sign * 0.01, 1.985, 0.125]),
        pt([sign * 0.08, 1.985, 0.115]),
        0.008,
        6,
      );
      axial(o, 'marble', pt([sign * 0.05, 1.77, 0.13]), pt([sign * 0.15, 1.69, 0.18]), 0.015, 6);
    }
    axial(o, 'marble', pt([-0.043, 1.87, 0.111]), pt([0.043, 1.87, 0.111]), 0.006, 6);
    for (const y of [0.99, 1.12, 1.37, 1.48, 1.59])
      ell(o, 'marble', pt([0, y, 0.174]), [0.012, 0.012, 0.01], d, 6, 4);
    axial(o, 'marble', pt([0, 0.86, 0.167]), pt([0, 1.61, 0.181]), 0.008, 6);
    if (d === 3)
      for (const sign of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const x = (sign < 0 ? -0.23 : -0.16) + j * 0.019;
          axial(o, 'marble', pt([x, 1.275, 0.282]), pt([x, 1.245, 0.29]), 0.009, 5);
        }
  }
}
export const greenvilleMonumentGuns = A.cannons.map((v) => ({
  ...v,
  ground: greenvilleMonumentGround(...v.point),
}));
function gun(o, g, d) {
  const [x, z] = g.point,
    y = g.ground,
    n = [5, 8, 16, 28][d],
    P = (zz, r, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x + Math.cos(a) * r, y + 1.15 + zz * 0.08 + Math.sin(a) * r, z + zz];
    },
    sections =
      d === 0
        ? [
            [-1.3, 0.19],
            [-0.7, 0.25],
            [0.4, 0.17],
            [1.8, 0.15],
          ]
        : [
            [-1.3, 0.19],
            [-1.1, 0.245],
            [-0.65, 0.245],
            [-0.59, 0.205],
            [0.6, 0.165],
            [1.56, 0.145],
            [1.66, 0.18],
            [1.8, 0.18],
          ],
    rings = sections.map(([zz, r]) => Array.from({ length: n }, (_, i) => P(zz, r, i)));
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++)
      Q(
        o,
        'iron',
        [rings[j - 1][i], rings[j - 1][(i + 1) % n], rings[j][(i + 1) % n], rings[j][i]],
        [Math.cos((i * 2 * Math.PI) / n), Math.sin((i * 2 * Math.PI) / n), 0],
      );
  for (let i = 0; i < n; i++)
    T(
      o,
      'iron',
      [[x, y + 1.15 - 1.3 * 0.08, z - 1.3], rings[0][i], rings[0][(i + 1) % n]],
      [0, 0, -1],
    );
  if (d === 0) {
    for (let i = 0; i < n; i++)
      T(
        o,
        'dark',
        [[x, y + 1.15 + 1.8 * 0.08, z + 1.8], rings.at(-1)[i], rings.at(-1)[(i + 1) % n]],
        [0, 0, 1],
      );
  } else {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(o, 'iron', [P(1.8, 0.18, i), P(1.8, 0.18, j), P(1.8, 0.1, j), P(1.8, 0.1, i)], [0, 0, 1]);
      Q(
        o,
        'dark',
        [P(1.8, 0.1, i), P(1.8, 0.1, j), P(1.39, 0.1, j), P(1.39, 0.1, i)],
        [-Math.cos((i * 2 * Math.PI) / n), -Math.sin((i * 2 * Math.PI) / n), 0],
      );
      T(
        o,
        'dark',
        [[x, y + 1.15 + 1.39 * 0.08, z + 1.39], P(1.39, 0.1, i), P(1.39, 0.1, j)],
        [0, 0, 1],
      );
    }
  }
  for (const sign of [-1, 1]) {
    const sx = x + sign * 0.46,
      shape = [
        [-1.15, 0],
        [1.1, 0],
        [0.72, 0.83],
        [-0.72, 0.83],
      ],
      L = shape.map(([zz, yy]) => [sx - 0.16, y + yy, z + zz]),
      R = shape.map(([zz, yy]) => [sx + 0.16, y + yy, z + zz]);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      Q(o, 'granite', [L[i], L[k], R[k], R[i]]);
    }
    for (const side of [L, R])
      for (const ix of [
        [0, 1, 2],
        [0, 2, 3],
      ])
        T(
          o,
          'granite',
          ix.map((i) => side[i]),
          [sign, 0, 0],
        );
  }
  axial(
    o,
    'iron',
    [x - 0.72, y + 1.13, z - 0.35],
    [x + 0.72, y + 1.13, z - 0.35],
    0.09,
    d === 0 ? 4 : 8,
  );
  if (d > 1) {
    ell(o, 'iron', [x, y + 1.15 - 1.4 * 0.08, z - 1.4], [0.1, 0.1, 0.13], d, 8, 6);
    for (const sign of [-1, 1]) {
      box(o, 'iron', x + sign * 0.47, y + 0.8, z - 0.35, 0.25, 0.06, 0.3);
      for (const zz of [-0.8, 0.2])
        box(o, 'iron', x + sign * 0.46, y + 0.04, z + zz, 0.35, 0.06, 0.08);
    }
    for (let j = 0; j < 3; j++)
      ell(o, 'iron', [x - 0.21 + j * 0.21, y + 0.105, z - 1.0], [0.095, 0.095, 0.095], d, 8, 5);
  }
}
function build(o, _f, d = 3) {
  pedestal(o, d);
  soldier(o, d);
  for (const g of greenvilleMonumentGuns) gun(o, g, d);
}
export const greenvilleMonumentSkyline = (o, f) => build(o, f, 0),
  greenvilleMonumentDistrict = (o, f) => build(o, f, 1),
  greenvilleMonumentStreet = (o, f) => build(o, f, 2),
  greenvilleMonumentCloseup = (o, f) => build(o, f, 3);
export const greenvilleConfederateMonumentModel = {
  id: 'confederate_monument_greenville_south_carolina',
  key: 'confederate_monument_greenville_south_carolina',
  cell: 'dn/dnj',
  recipe: 'structure-greenville-confederate-monument.mjs',
  title: 'Confederate Monument (Greenville, South Carolina)',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [17, 12, 25],
  lookAt: [0, 4.6, 0],
  mediumFiContext: { scale: 1.4 },
  qaCameras: [
    {
      name: 'whole-tiered-granite-column-marblesoldier-and-paired-parrott-displays',
      position: [17, 12, 25],
      lookAt: [0, 4.6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'standing-carved-soldier-hat-rifle-coat-hands-and-separated-legs',
      position: [1.9, 10.3, 3.9],
      lookAt: [0, 9.65, 0],
    },
    {
      name: 'stepped-granite-base-recessed-panels-relief-and-two-shaft-stages',
      position: [4.6, 4.8, 7.2],
      lookAt: [0, 3.4, 0],
    },
    {
      name: 'parrott-rifle-breech-band-trunnions-actual-bore-and-stone-mount',
      position: [12, 3.4, 5.2],
      lookAt: [8, 1.0, 0.65],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m16641samplefieldfrozenbeforegeometryatfixedexternalapproach. MonumenttoeY0/guncentredatums fromsourcefield, notsurveyed1924slabs; actualhostcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-greenville-confederate-monument.mjs',
    level: 'skyline',
    export: 'greenvilleMonumentSkyline',
    errorMeters: 0.22,
    surfaces,
    authoredLevels: {
      district: { export: 'greenvilleMonumentDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'greenvilleMonumentStreet', errorMeters: 0.035, surfaces },
      closeup: { export: 'greenvilleMonumentCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Wholegraniteshaft/plinth/cap/marblesoldier andtwoParrottdisplays included; bothlegvoids/hat/rifle/waistarms/fourfacecolumn/two-stageprofile retainedatalllevels. Nearclosedrecesspanels/moldings/restraintface/coatseam/buttons/fingers/bore/breech/trunnions/stonecheekmounts. Statueportrait/finefolds/reliefsymbol/gunmodel/calibre/currentcarriagerepairs andsmallcannonballs areapproximatephotographicinterpretations. Inscriptionrepresentedbyincisedlinefields, noliteralunreadableletteringinvented.',
    'Exactpublished1907AmericanNewsCoNewYorkPD-US-expiredpostcard/nativeSHA1bound andindividuallyinspected; unchangedpolicy passed. OriginalMainStreetsetting/ironfence/house/rails notcurrentmodel. Unknown1918bookimage/1948unrenewedclaim/modernCCphotosunusedandunviewed. PrimaryCityhistory andpublishedtextheightcaption usedasfacts only; no protectedPDFmaps/photos/newimageryadopted. No Quallamedia/body/category/policyedits orphotographictextures/downloadedmesh/generatedbitmap.',
    'Nativecurrentmonument3894273805/onegun3894273806/approachcircle42336424 fixcentre andonegun; approximateheadinginferredfromapproach. Secondguncentremirrored, notmapped. Reported28ftshaft8.5344m plusestimated2.20mstatue/10.7344mwholeheight; rough25ftQuallasummaryconflicts. Dimensions/rotationalbearingnotcertifiedsurvey. Smallmasonrytierwidths/ornament/portraitboundedestimates.',
    'Independent256m129square2m16641samplefield/twooriginalTerrariumtiles frozenbeforegeometry, allvalues/PNG/tilebytes retained. Provider299.4093mfixedapproachdatum isnot surveyedplaza/foundationgrade. Gunbases independentlysamplepreexistingfield; no flattening/fitting/reacquisition/parkdisc. Actualhostcontactunverified andordinarygeographicpreview/replacementdisabled.',
    'SeparateDixieHighway/Kershaw/81stDivisionmemorials/laterbronzeplaques/cemetery/park/fences/roads/trees/people areexcluded, notsubstitutedfornamedmonument.',
  ],
};

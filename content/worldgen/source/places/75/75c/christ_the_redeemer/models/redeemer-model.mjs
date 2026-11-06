/** Original photo-proportioned medium-fi Christ the Redeemer monument; authored source. */
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('b9bfb0'),
  edge: lin('b2b8a8'),
  base: lin('515653'),
  coping: lin('626761'),
  door: lin('4d5148'),
};
export const redeemerSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
};
const configs = {
  skyline: { n: 8, layers: 7, arms: 3, head: 8 },
  district: { n: 16, layers: 15, arms: 6, head: 16, detail: true },
  street: { n: 32, layers: 32, arms: 12, head: 24, detail: true, folds: true },
  closeup: { n: 56, layers: 56, arms: 24, head: 40, detail: true, folds: true, fine: true },
  master: {
    n: 112,
    layers: 112,
    arms: 48,
    head: 80,
    detail: true,
    folds: true,
    fine: true,
    master: true,
  },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function T(o, c, p, s = 'stone', col = C.stone, N) {
  p = p.map((p) => p.map(Math.fround));
  if (Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) < 1e-8) return;
  if (N && normalFor(...p).reduce((v, x, i) => v + x * N[i], 0) < 0) p.reverse();
  o.addTriangle(
    c === configs.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    col,
  );
}
function Q(o, c, p, s = 'stone', col = C.stone, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
function rings(o, c, rs, s = 'stone', col = C.stone, axis = 1) {
  const centers = rs.map((r) =>
    r.reduce((a, p) => a.map((v, i) => v + p[i] / r.length), [0, 0, 0]),
  );
  for (let j = 1; j < rs.length; j++)
    for (let i = 0; i < rs[j].length; i++) {
      const k = (i + 1) % rs[j].length,
        p = [rs[j - 1][i], rs[j - 1][k], rs[j][k], rs[j][i]],
        N = p.reduce(
          (a, p) =>
            a.map(
              (v, k) => v + (k === axis ? 0 : p[k] - (centers[j - 1][k] + centers[j][k]) / 2) / 4,
            ),
          [0, 0, 0],
        );
      Q(o, c, p, s, col, N);
    }
  for (const [end, sign] of [
    [0, -1],
    [rs.length - 1, 1],
  ]) {
    const r = rs[end],
      p = r.reduce((a, p) => a.map((v, i) => v + p[i] / r.length), [0, 0, 0]),
      N = [0, 0, 0];
    N[axis] = sign;
    for (let i = 0; i < r.length; i++) T(o, c, [p, r[i], r[(i + 1) % r.length]], s, col, N);
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
function at(rows, y) {
  let i = 1;
  while (i < rows.length - 1 && y > rows[i][0]) i++;
  const a = rows[i - 1],
    b = rows[i],
    t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  return a.slice(1).map((v, j) => lerp(v, b[j + 1], t));
}
function oval(o, c, rows, n, s = 'stone', col = C.stone) {
  const rs = rows.map(([y, x, z, Z = 0]) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return [x * Math.cos(t), y, Z + z * Math.sin(t)];
    }),
  );
  rings(o, c, rs, s, col);
}
function slab(o, c, p, lo, hi, s = 'base', col = C.base) {
  const rs = [lo, hi].map((y) => p.map(([x, z]) => [x, y, z]));
  rings(o, c, rs, s, col);
}
function pedestal(o, c) {
  const P = [
      [-3.1, -4.1],
      [3.1, -4.1],
      [4.2, -3],
      [4.2, 3],
      [3.1, 4.1],
      [-3.1, 4.1],
      [-4.2, 3],
      [-4.2, -3],
    ],
    scale = (v) => P.map((p) => p.map((x) => x * v));
  slab(o, c, scale(1.05), -6, 0.28);
  slab(o, c, P, 0.28, 7.55);
  slab(o, c, scale(1.035), 7.55, 7.84, 'base', C.coping);
  slab(o, c, scale(0.99), 7.84, 8.02, 'base', C.coping);
  if (c.detail) {
    for (const y of [0.4, 2.8, 5.15, 7.2]) slab(o, c, scale(1.002), y, y + 0.035, 'base', C.coping);
    // Approximate closed chapel door at the back of the pedestal; no navigable interior.
    const w = 1.05,
      z = -4.115;
    Q(
      o,
      c,
      [
        [-w, 0.28, z],
        [w, 0.28, z],
        [w, 3.9, z],
        [-w, 3.9, z],
      ],
      'door',
      C.door,
      [0, 0, -1],
    );
    for (const sign of [-1, 1])
      Q(
        o,
        c,
        [
          [sign * (w + 0.16), 0.28, z - 0.015],
          [sign * w, 0.28, z - 0.015],
          [sign * w, 4.02, z - 0.015],
          [sign * (w + 0.16), 4.02, z - 0.015],
        ],
        'base',
        C.coping,
        [0, 0, -1],
      );
  }
}
function body(o, c) {
  const n = c.n,
    rows = [
      [8.06, 2.64, 1.45],
      [9, 2.75, 1.48],
      [17, 2.72, 1.45],
      [21, 2.54, 1.34],
      [25, 2.62, 1.5],
      [29, 3.0, 1.65],
      [32, 3.3, 1.47],
      [33.4, 2.8, 1.15],
      [34, 1.05, 0.85],
    ],
    rs = [];
  const point = (y, t) => {
    const [rx, rz] = at(rows, y),
      x0 = Math.cos(t),
      z0 = Math.sin(t),
      front = Math.max(0, z0),
      back = Math.max(0, -z0);
    let z = rz * z0;
    if (c.folds) {
      const low = Math.max(0, Math.min(1, (19 - y) / 3)) * Math.min(1, (y - 8.06) * 2),
        pleat = Math.cos(t * 18);
      z += z0 * 0.11 * pleat * low;
      const d = (y - 17.1) / 17.4 + 0.3 * x0 + 0.13 * x0 * x0,
        u = (y - 25) / 15 - 0.25 * x0 * x0,
        b = Math.max(0, Math.min(1, (y - 24) / 4)),
        blend = b * b * (3 - 2 * b),
        amp = Math.sin(Math.max(0, Math.min(1, (y - 15) / 18)) * Math.PI) * 0.23;
      z +=
        front * amp * (0.75 + lerp(Math.cos(d * Math.PI * 7), Math.cos(u * Math.PI * 7), blend)) +
        0.08 * back * Math.sin(y * 0.9 + t * 3);
    }
    return [rx * x0, y, z];
  };
  const ys = [
    ...new Set([
      ...rows.map((r) => r[0]),
      ...Array.from({ length: c.layers + 1 }, (_, j) => lerp(8.06, 34, j / c.layers)),
    ]),
  ].sort((a, b) => a - b);
  for (const y of ys) rs.push(Array.from({ length: n }, (_, i) => point(y, (i / n) * Math.PI * 2)));
  rings(o, c, rs);
  // Paired toes protrude just below the robe hem and remain individually closed.
  if (c.detail)
    for (const x of [-1.2, 1.2]) {
      const r = [
        [8.04, 0.76, 0.95, 1.0],
        [8.18, 0.8, 1.02, 1.1],
        [8.45, 0.67, 0.85, 0.9],
      ].map(([y, X, Z, z]) =>
        Array.from({ length: Math.max(8, c.n / 2) }, (_, i) => {
          const t = (i / Math.max(8, c.n / 2)) * Math.PI * 2;
          return [x + X * Math.cos(t), y, z + Z * Math.sin(t)];
        }),
      );
      rings(o, c, r);
    }
  // Asymmetric front mantle edge and narrow upright fold: not a painted shadow.
  if (c.folds) {
    for (const sign of [-1, 1]) {
      const path = [];
      for (let j = 0; j <= c.layers / 2; j++) {
        const t = j / (c.layers / 2),
          y = lerp(sign < 0 ? 20.2 : 15.3, 33.5, t),
          x = sign < 0 ? lerp(-2.3, -0.5, t) : lerp(1.75, 1.15, t),
          [rx] = at(rows, y),
          p = point(y, Math.acos(Math.max(-1, Math.min(1, x / rx))));
        p[2] += 0.015;
        path.push(p);
      }
      for (let j = 1; j < path.length; j++)
        beam(o, 'stone', path[j - 1], path[j], c.master ? 0.095 : 0.13, 0.1, C.edge);
    }
  }
}
function arms(o, c) {
  const rows = [
      [2.7, 33.5, 27.2, 1.28],
      [5, 33.0, 27.1, 1.24],
      [7.6, 32.3, 27.8, 1.08],
      [10, 31.9, 29.7, 0.76],
      [11.5, 31.7, 30.6, 0.51],
    ],
    n = Math.max(6, c.n / 2);
  const xs = [
    ...new Set([
      ...rows.map((r) => r[0]),
      ...Array.from({ length: c.arms + 1 }, (_, j) => lerp(2.7, 11.5, j / c.arms)),
    ]),
  ].sort((a, b) => a - b);
  for (const sign of [-1, 1]) {
    const rs = [];
    for (const x of xs) {
      const [top, low, depth] = at(rows, x),
        y = (top + low) / 2,
        h = (top - low) / 2;
      rs.push(
        Array.from({ length: n }, (_, i) => {
          const t = (i / n) * Math.PI * 2,
            fold = c.folds
              ? 0.1 * Math.sin(t * 5 + x * 0.55) * Math.sin((Math.PI * (x - 2.7)) / 8.8)
              : 0;
          return [sign * x, y + (h + fold) * Math.cos(t), (depth + fold * 0.5) * Math.sin(t)];
        }),
      );
    }
    // Reverse the stations for the negative arm so its cap direction is correct.
    if (sign < 0) rs.reverse();
    rings(o, c, rs, 'stone', C.stone, 0);
    const palm = [
      [-0.1, 0.5, 0.34],
      [0.3, 0.56, 0.38],
      [1.05, 0.49, 0.31],
      [1.2, 0.39, 0.25],
    ].map(([d, h, z]) =>
      Array.from({ length: c.detail ? 12 : 6 }, (_, i) => {
        const t = (i / (c.detail ? 12 : 6)) * Math.PI * 2;
        return [sign * (11.55 + d), 31.45 + h * Math.cos(t), 0.11 + z * Math.sin(t)];
      }),
    );
    if (sign < 0) palm.reverse();
    rings(o, c, palm, 'stone', C.stone, 0);
    if (c.detail) {
      for (let k = 0; k < 4; k++) {
        const y = 31.05 + k * 0.24,
          L = [1.38, 1.55, 1.43, 1.13][k],
          r = [0, 0.72, 1].map((t) =>
            Array.from({ length: c.fine ? 10 : 6 }, (_, i) => {
              const a = (i / (c.fine ? 10 : 6)) * Math.PI * 2,
                R = t === 1 ? 0.055 : 0.105;
              return [
                sign * (12.6 + L * t),
                y + 0.04 * Math.sin(t * Math.PI) + R * Math.cos(a),
                0.16 + R * Math.sin(a),
              ];
            }),
          );
        if (sign < 0) r.reverse();
        rings(o, c, r);
      }
      const r = [0, 0.5, 1].map((t) =>
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2,
            R = t === 1 ? 0.08 : 0.16;
          return [
            sign * (11.9 + 0.8 * t),
            31.77 + 0.4 * t + R * Math.cos(a),
            0.25 + R * Math.sin(a),
          ];
        }),
      );
      if (sign < 0) r.reverse();
      rings(o, c, r);
    } else {
      const p = [
          [-0.2, -0.45],
          [1.4, -0.3],
          [1.45, 0.35],
          [-0.2, 0.5],
        ],
        r = [-0.1, 0.3].map((z) => p.map(([x, y]) => [sign * (12.6 + x), 31.45 + y, z]));
      if (sign < 0) for (const r0 of r) r0.reverse();
      rings(o, c, r, 'stone', C.stone, 2);
    }
  }
}
function head(o, c) {
  oval(
    o,
    c,
    [
      [32.8, 0.82, 0.76, 0],
      [34.7, 0.85, 0.75, 0.03],
    ],
    Math.max(8, c.head / 2),
  );
  // A closed faceted skull/hair mass plus a separate closed original face shell.
  oval(
    o,
    c,
    [
      [33.6, 0.95, 0.8, -0.12],
      [34.5, 1.18, 1.0, -0.1],
      [36, 1.3, 1.1, -0.13],
      [37.4, 1.19, 1.0, -0.18],
      [37.85, 0.84, 0.78, -0.15],
      [38.1, 0.22, 0.21, -0.15],
    ],
    c.head,
  );
  if (c.detail) {
    const rows = [
      [34.1, 0.5, 0.34, 1],
      [34.5, 0.77, 0.45, 1.02],
      [35.2, 0.9, 0.4, 1.04],
      [35.8, 0.91, 0.41, 1.06],
      [36.6, 0.97, 0.39, 0.99],
      [37.15, 1.05, 0.34, 0.8],
    ];
    oval(o, c, rows, Math.max(8, c.head));
    // Nose, brow and beard are coarse geometric planes, never private texture detail.
    const p = [
        [-0.18, 36.2, 1.4],
        [0.18, 36.2, 1.4],
        [0.27, 35.2, 1.84],
        [-0.27, 35.2, 1.84],
        [-0.12, 35.05, 1.48],
        [0.12, 35.05, 1.48],
      ],
      faces = [
        [0, 1, 2, 3],
        [3, 2, 5, 4],
        [0, 3, 4],
        [1, 5, 2],
        [0, 4, 5, 1],
      ],
      center = p.reduce((a, q) => a.map((v, i) => v + q[i] / p.length), [0, 0, 0]);
    for (const ids of faces) {
      const ps = ids.map((i) => p[i]),
        N = ps
          .reduce((a, p) => a.map((v, i) => v + p[i] / ps.length), [0, 0, 0])
          .map((v, i) => v - center[i]);
      if (ps.length === 4) Q(o, c, ps, 'stone', C.stone, N);
      else T(o, c, ps, 'stone', C.stone, N);
    }
    for (const sign of [-1, 1]) {
      beam(o, 'stone', [sign * 0.24, 36.25, 1.43], [sign * 0.86, 36.37, 1.36], 0.2, 0.2, C.edge);
      beam(o, 'stone', [sign * 0.28, 34.85, 1.42], [sign * 0.05, 34.35, 1.38], 0.24, 0.2, C.edge);
    }
    if (c.fine) {
      for (const sign of [-1, 1])
        for (let j = 0; j < 5; j++) {
          const x = sign * (0.94 + j * 0.065);
          beam(o, 'stone', [x, 37.0, -0.45], [x * 0.9, 33.75, -0.3], 0.055, 0.085, C.edge);
        }
    }
  }
}
export function buildRedeemerLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error(level);
  pedestal(o, c);
  body(o, c);
  arms(o, c);
  head(o, c);
}
export const buildRedeemerSkyline = (o) => buildRedeemerLevel(o, 'skyline'),
  buildRedeemerDistrict = (o) => buildRedeemerLevel(o, 'district'),
  buildRedeemerStreet = (o) => buildRedeemerLevel(o, 'street'),
  buildRedeemerCloseup = (o) => buildRedeemerLevel(o, 'closeup');

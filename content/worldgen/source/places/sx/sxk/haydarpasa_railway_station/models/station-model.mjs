/** Original complete Haydarpasa passenger building, unequal wings and open rail-side court. */

import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('cfbb91'),
  trim: lin('ded0ad'),
  base: lin('a49c86'),
  roof: lin('69747d'),
  metal: lin('736b55'),
  wood: lin('77694f'),
  glass: lin('657e86'),
  clock: lin('e2ddc8'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  trim: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.86 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.5 },
  clock: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
};
const cfg = {
  skyline: { arch: 3, round: 6, roof: 3, curveSpan: 3 },
  district: { arch: 4, round: 8, roof: 5, curveSpan: 2, detail: true },
  street: { arch: 7, round: 16, roof: 12, curveSpan: 1.4, detail: true, fine: true },
  closeup: {
    arch: 10,
    round: 24,
    roof: 20,
    curveSpan: 0.8,
    detail: true,
    recess: true,
    fine: true,
    near: true,
  },
  master: {
    arch: 24,
    round: 64,
    roof: 48,
    curveSpan: 0.35,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const stationPlan = [
  [17.761291, 17.749038],
  [18.579507, -42.472715],
  [36.252657, -41.733355],
  [35.437197, 32.505872],
  [35.988191, 34.034681],
  [36.223991, 35.610647],
  [36.010581, 37.414948],
  [35.25364, 38.817195],
  [34.315523, 40.085424],
  [33.015051, 41.085618],
  [30.540662, 41.778075],
  [28.05881, 41.343776],
  [25.569495, 39.782723],
  [24.112619, 37.583827],
  [-23.935801, 37.360999],
  [-25.449685, 40.165492],
  [-26.568978, 41.299704],
  [-28.231798, 42.031867],
  [-29.80776, 42.267661],
  [-31.430882, 42.188262],
  [-33.825863, 41.257605],
  [-34.960076, 40.138312],
  [-35.826254, 38.656668],
  [-36.203523, 36.13513],
  [-35.588057, 33.787307],
  [-35.675378, -6.641741],
  [-19.538523, -6.478171],
  [-19.468746, 17.679993],
  [17.761291, 17.749038],
];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  sub = (a, b) => a.map((v, i) => v - b[i]);
function T(o, c, p, s, col, N) {
  p = p.map((p) => p.map(Math.fround));
  let n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
    d = Math.hypot(...n);
  if (d < 1e-8) return;
  if (N && n.reduce((s, v, i) => s + v * N[i], 0) < 0) {
    p.reverse();
    n = n.map((v) => -v);
  }
  n = n.map((v) => v / d);
  o.addTriangle(
    c === cfg.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s, col, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'stone', col = C[s]) {
  for (const [p, N] of [
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
const adapter = (o, c) => ({
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
function lathe(o, c, x, z, profile, s = 'roof', elliptic = 1, n = c.round) {
  for (let k = 0; k < profile.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        p = ([y, r], t) => [x + r * Math.cos(t), y, z + r * elliptic * Math.sin(t)];
      Q(
        o,
        c,
        [p(profile[k], a), p(profile[k], b), p(profile[k + 1], b), p(profile[k + 1], a)],
        s,
        C[s],
        [Math.cos((a + b) / 2), 0.01, Math.sin((a + b) / 2)],
      );
    }
  for (const [ring, N] of [
    [profile[0], [0, -1, 0]],
    [profile.at(-1), [0, 1, 0]],
  ])
    for (let i = 0; i < n; i++)
      T(
        o,
        c,
        [
          [x, ring[0], z],
          [
            x + ring[1] * Math.cos((i / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin((i / n) * Math.PI * 2),
          ],
          [
            x + ring[1] * Math.cos(((i + 1) / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin(((i + 1) / n) * Math.PI * 2),
          ],
        ],
        s,
        C[s],
        N,
      );
}
const interp = (controls, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * (controls.length - 1),
      j = Math.min(controls.length - 2, Math.floor(t)),
      u = t - j;
    return controls[j].map((v, k) => v * (1 - u) + controls[j + 1][k] * u);
  });
const rect = (u, y, w, h) => [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + h],
    [u - w / 2, y + h],
  ],
  circle = (u, y, r, n) =>
    Array.from({ length: n }, (_, i) => [
      u + r * Math.cos((i / n) * Math.PI * 2),
      y + r * Math.sin((i / n) * Math.PI * 2),
    ]);
function arch(u, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r,
    a = [
      [u - r, y],
      [u + r, y],
      [u + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    a.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  return a;
}
// Subdivide in the cylinder's unwrapped metric coordinates before projection;
// interpolating curved world vertices would flatten the round tower walls.
function F(o, c, p, vs, s, col, N) {
  if (p.curved) {
    let edge = 0,
      span = 0;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(vs[i][0] - vs[(i + 1) % 3][0]);
      if (d > span) {
        span = d;
        edge = i;
      }
    }
    if (span > c.curveSpan) {
      const a = vs[edge],
        b = vs[(edge + 1) % 3],
        q = vs[(edge + 2) % 3],
        m = a.map((v, i) => (v + b[i]) / 2);
      F(o, c, p, [a, m, q], s, col, N);
      F(o, c, p, [m, b, q], s, col, N);
      return;
    }
  }
  T(o, c, vs.map(p), s, col, N);
}
function wall(o, c, p, outer, holes = [], surface = 'stone', N = sub(p([0, 0, 1]), p([0, 0, 0]))) {
  const active = c.recess ? holes : holes.filter((h) => h.kind === 'open'),
    flat = [...outer, ...active.flatMap((h) => h.ring)],
    starts = active.map(
      (h, i) => outer.length + active.slice(0, i).reduce((s, h) => s + h.ring.length, 0),
    ),
    ix = earcut(flat.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    F(
      o,
      c,
      p,
      ix.slice(i, i + 3).map((j) => [...flat[j], 0]),
      surface,
      C[surface],
      N,
    );
  for (const h of holes) {
    const depth = c.recess ? 0.26 : -0.018,
      r = h.ring;
    if (c.recess)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        F(
          o,
          c,
          p,
          [
            [...a, 0],
            [...b, 0],
            [...b, -depth],
          ],
          'trim',
          C.trim,
        );
        F(
          o,
          c,
          p,
          [
            [...a, 0],
            [...b, -depth],
            [...a, -depth],
          ],
          'trim',
          C.trim,
        );
      }
    if (h.kind !== 'open') {
      const ids = earcut(r.flat());
      for (let i = 0; i < ids.length; i += 3)
        F(
          o,
          c,
          p,
          ids.slice(i, i + 3).map((j) => [...r[j], -depth]),
          h.kind,
          C[h.kind],
          N,
        );
    }
    if (c.near)
      beamPath(
        adapter(o, c),
        'trim',
        r.map(([u, y]) => p([u, y, 0.05])),
        0.16,
        0.16,
        C.trim,
        true,
      );
    else if (c.fine) {
      const center = r.reduce((a, b) => a.map((v, i) => v + b[i] / r.length), [0, 0]);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          grow = (q) => {
            const d = Math.hypot(q[0] - center[0], q[1] - center[1]) || 1;
            return q.map((v, i) => v + (0.13 * (v - center[i])) / d);
          };
        F(
          o,
          c,
          p,
          [
            [...a, 0.04],
            [...b, 0.04],
            [...grow(b), 0.04],
          ],
          'trim',
          C.trim,
          N,
        );
        F(
          o,
          c,
          p,
          [
            [...a, 0.04],
            [...grow(b), 0.04],
            [...grow(a), 0.04],
          ],
          'trim',
          C.trim,
          N,
        );
      }
    }
    if (c.near && h.kind === 'glass') {
      const xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]),
        u = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys);
      beam(
        adapter(o, c),
        'wood',
        p([u, lo, -depth + 0.04]),
        p([u, hi, -depth + 0.04]),
        0.075,
        0.08,
        C.wood,
      );
      beam(
        adapter(o, c),
        'wood',
        p([Math.min(...xs), lo + (hi - lo) * 0.57, -depth + 0.04]),
        p([Math.max(...xs), lo + (hi - lo) * 0.57, -depth + 0.04]),
        0.075,
        0.08,
        C.wood,
      );
    }
  }
}
function slab(o, c, ring, y0, y1, s = 'base') {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3) {
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y1, ring[j][1]]),
      s,
      C[s],
      [0, 1, 0],
    );
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y0, ring[j][1]]),
      s,
      C[s],
      [0, -1, 0],
    );
  }
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1];
    Q(
      o,
      c,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      s,
      C[s],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) {
    const a = ring.at(-1),
      b = ring[0];
    Q(
      o,
      c,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      s,
      C[s],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function hip(o, c, ring, axis = 'z', eave = 23.5, peak = 33) {
  const P = ring.map(([x, z]) => [x, eave, z]),
    mid = (a, b, t = 0.5) => a.map((v, i) => v * (1 - t) + b[i] * t),
    back = mid(P[0], P[1]),
    front = mid(P[3], P[2]);
  let A, B, faces;
  if (axis === 'z') {
    A = mid(back, front, 0.13);
    B = mid(back, front, 0.87);
    A[1] = B[1] = peak;
    faces = [
      [P[0], P[3], B, A],
      [P[1], A, B, P[2]],
      [P[0], A, P[1]],
      [P[3], P[2], B],
    ];
  } else {
    A = mid(mid(P[0], P[3]), mid(P[1], P[2]), 0.13);
    B = mid(mid(P[0], P[3]), mid(P[1], P[2]), 0.87);
    A[1] = B[1] = peak;
    faces = [
      [P[0], P[1], B, A],
      [P[3], A, B, P[2]],
      [P[0], A, P[3]],
      [P[1], P[2], B],
    ];
  }
  for (const f of faces)
    if (f.length === 3) T(o, c, f, 'roof', C.roof, [0, 1, 0]);
    else Q(o, c, f, 'roof', C.roof, [0, 1, 0]);
  Q(o, c, P, 'roof', C.roof, [0, -1, 0]);
  if (c.fine) beam(adapter(o, c), 'roof', A, B, 0.14, 0.16, C.roof);
}
const backLeft = [
    [-35.675378, -6.641741],
    [-19.538523, -6.478171],
    [-19.5, 23],
    [-35.6, 23],
  ],
  backRight = [
    [18.579507, -42.472715],
    [36.252657, -41.733355],
    [35.6, 23],
    [17.69, 23],
  ],
  frontBar = [
    [-35.6, 17.7],
    [35.6, 17.7],
    [35.6, 37.35],
    [-35.6, 37.35],
  ];
function rows(c, L, front = false) {
  const holes = [],
    count = c.detail ? Math.max(2, Math.round(L / 5)) : 1;
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * L) / count,
      w = c.detail ? Math.min(2.6, L / count - 1) : L * 0.8;
    holes.push({
      ring: c.detail ? arch(u, 0.75, w, 5.7, c.arch) : rect(u, 0.75, w, 5.7),
      kind: 'glass',
    });
    holes.push({
      ring: c.detail ? arch(u, 8.2, w, 5.6, c.arch) : rect(u, 8.2, w, 5.6),
      kind: 'glass',
    });
    for (const [y, h] of [
      [15.3, 3.45],
      [20.25, 2.1],
    ])
      holes.push({ ring: rect(u, y, w, h), kind: 'glass' });
  }
  return holes;
}
function band(o, c, p, L, y, h = 0.24) {
  if (c.fine) beam(adapter(o, c), 'trim', p([0, y, 0.16]), p([L, y, 0.16]), h, 0.35, C.trim);
  else
    Q(
      o,
      c,
      [
        p([0, y - h / 2, 0.05]),
        p([L, y - h / 2, 0.05]),
        p([L, y + h / 2, 0.05]),
        p([0, y + h / 2, 0.05]),
      ],
      'trim',
      C.trim,
      sub(p([0, 0, 1]), p([0, 0, 0])),
    );
}
function pediment(o, c, p, u, y, w, h, front = 0.12) {
  const vs = [
      [u - w / 2, y],
      [u + w / 2, y],
      [u, y + h],
    ],
    N = sub(p([0, 0, 1]), p([0, 0, 0]));
  T(
    o,
    c,
    vs.map(([u, y]) => p([u, y, front])),
    'trim',
    C.trim,
    N,
  );
  if (c.near) {
    T(
      o,
      c,
      vs.map(([u, y]) => p([u, y, front - 0.4])),
      'trim',
      C.trim,
      N.map((v) => -v),
    );
    for (let i = 0; i < 3; i++) {
      const a = vs[i],
        b = vs[(i + 1) % 3];
      Q(
        o,
        c,
        [p([...a, front]), p([...b, front]), p([...b, front - 0.4]), p([...a, front - 0.4])],
        'trim',
        C.trim,
      );
    }
    beamPath(
      adapter(o, c),
      'trim',
      vs.map(([u, y]) => p([u, y, front + 0.08])),
      0.14,
      0.17,
      C.trim,
      true,
    );
  }
}
function range(o, c, ring, main = false) {
  const boundary = main
    ? ring
    : ring.map((p, i) => {
        if (i < 2) return p;
        const b = ring[i === 2 ? 1 : 0],
          t = (17.7 - b[1]) / (p[1] - b[1]);
        return [b[0] + (p[0] - b[0]) * t, 17.7];
      });
  for (let i = 0; i < 4; i++) {
    if (!main && i === 2) continue;
    const a = main && i === 0 ? [-19.47, 17.7] : main && i === 2 ? [24.5, 37.35] : boundary[i],
      b =
        main && i === 0 ? [17.76, 17.7] : main && i === 2 ? [-24.5, 37.35] : boundary[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      N = [U[1], 0, -U[0]],
      p = ([u, y, d]) => [b[0] - U[0] * u + N[0] * d, y, b[1] - U[1] * u + N[2] * d];
    let holes = rows(c, L);
    if (main && i === 2) {
      holes = [];
      for (const x of [-15.3, 0, 15.3])
        holes.push({ ring: arch(x - b[0], 0.35, 8, 6.45, c.arch * 2), kind: 'glass' });
      for (const x of [-23, 23])
        holes.push({ ring: arch(x - b[0], 0.65, 2.8, 5.7, c.arch), kind: 'glass' });
      const count = c.detail ? 11 : 1;
      for (let j = 0; j < count; j++) {
        const x = c.detail ? -23 + j * 4.6 : 0,
          u = x - b[0],
          w = c.detail ? 2.45 : 47;
        holes.push({
          ring: c.detail ? arch(u, 8.2, w, 5.6, c.arch) : rect(u, 8.2, w, 6),
          kind: 'glass',
        });
        for (const [y, h] of [
          [15.3, 3.45],
          [20.25, 2.1],
        ])
          holes.push({ ring: rect(u, y, w, h), kind: 'glass' });
      }
    }
    wall(
      o,
      c.fine && !c.near && main && i === 2 ? { ...c, recess: true } : c,
      p,
      rect(L / 2, 0.35, L, 23.15),
      holes,
      'stone',
      N,
    );
    if (c.detail) {
      for (const y of [7.2, 14.6, 19.7, 23.2]) band(o, c, p, L, y, y === 7.2 ? 0.38 : 0.24);
    }
    if (c.fine) {
      const count = Math.max(2, Math.round(L / 5));
      for (let j = 0; j <= count; j++) {
        const u = (j * L) / count;
        beam(adapter(o, c), 'trim', p([u, 7.5, 0.18]), p([u, 19.4, 0.18]), 0.32, 0.38, C.trim);
        if (c.near)
          for (const y of [7.5, 14.5, 19.4])
            band(o, c, ([v, h, d]) => p([u - 0.4 + v, h, d]), 0.8, y, 0.24);
      }
      if (c.near)
        for (let j = 0; j < count; j++) pediment(o, c, p, ((j + 0.5) * L) / count, 14.0, 3.3, 0.9);
    }
  }
  hip(o, c, ring, main ? 'x' : 'z');
}
function dormer(o, c, p, u, large = false, clock = false) {
  const w = large ? 5.6 : 2.35,
    y = large ? 25.2 : 25.5,
    h = large ? 5.7 : 2.8,
    depth = 0.26,
    front = 0.4;
  // Recessed glazing stays in front of its solid backing mass.
  const outer = rect(u, y, w, h),
    hole = rect(u, y + 0.35, clock ? 2.9 : w * 0.65, clock ? 3.15 : h - 0.6);
  wall(
    o,
    c,
    ([a, b, d]) => p([a, b, d + front]),
    outer,
    clock ? [] : [{ ring: hole, kind: 'glass' }],
  );
  Q(
    o,
    c,
    [
      [u - w / 2, y, front - 0.34],
      [u + w / 2, y, front - 0.34],
      [u + w / 2, y + h, front - 0.34],
      [u - w / 2, y + h, front - 0.34],
    ].map(p),
    'stone',
    C.stone,
    sub(p([0, 0, 0]), p([0, 0, 1])),
  );
  for (const side of [-1, 1])
    Q(
      o,
      c,
      [
        [u + (side * w) / 2, y, front],
        [u + (side * w) / 2, y + h, front],
        [u + (side * w) / 2, y + h, front - 0.34],
        [u + (side * w) / 2, y, front - 0.34],
      ].map(p),
      'stone',
      C.stone,
    );
  pediment(o, c, p, u, y + h, w + 0.6, large ? 1.6 : 0.9, 0.42);
  Q(
    o,
    c,
    [
      [u - w / 2, y + h, front - 0.4],
      [u + w / 2, y + h, front - 0.4],
      [u + w / 2, y + h, front],
      [u - w / 2, y + h, front],
    ].map(p),
    'roof',
    C.roof,
    [0, 1, 0],
  );
  if (clock) {
    const ring = circle(u, y + 2.9, 1.5, c.round);
    wall(o, c, ([a, b, d]) => p([a, b, d + 0.45]), ring, [], 'clock');
    if (c.detail) {
      beamPath(
        adapter(o, c),
        'metal',
        ring.map(([a, b]) => p([a, b, 0.5])),
        0.1,
        0.12,
        C.metal,
        true,
      );
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2;
        beam(
          adapter(o, c),
          'metal',
          p([u + 1.17 * Math.cos(t), y + 2.9 + 1.17 * Math.sin(t), 0.55]),
          p([u + 1.37 * Math.cos(t), y + 2.9 + 1.37 * Math.sin(t), 0.55]),
          0.05,
          0.06,
          C.metal,
        );
      }
      beam(
        adapter(o, c),
        'metal',
        p([u, y + 2.9, 0.6]),
        p([u + 0.9, y + 3.5, 0.6]),
        0.075,
        0.08,
        C.metal,
      );
      beam(
        adapter(o, c),
        'metal',
        p([u, y + 2.9, 0.61]),
        p([u - 0.7, y + 3.9, 0.61]),
        0.075,
        0.08,
        C.metal,
      );
    }
    if (c.fine)
      lathe(
        o,
        c,
        p([u, 0, 0.2])[0],
        p([u, 0, 0.2])[2],
        [
          [32.4, 0.5],
          [33.7, 0.24],
          [34.1, 0],
        ],
        'trim',
        1,
        c.round,
      );
  }
}
function roofWindows(o, c) {
  const front = ([u, y, d]) => [u, y, 35 + d];
  dormer(o, c, front, 0, true, true);
  if (c.detail)
    for (const x of [-21, -14, -7, 7, 14, 21]) dormer(o, c, front, x, Math.abs(x) === 14);
  for (const [ring, n] of [
    [backRight, 12],
    [backLeft, 5],
  ]) {
    const z0 = (ring[0][1] + ring[1][1]) / 2 + 4,
      z1 = 18;
    for (const side of [-1, 1]) {
      const x =
          side < 0 ? (ring[0][0] + ring[3][0]) / 2 + 2.2 : (ring[1][0] + ring[2][0]) / 2 - 2.2,
        p = ([u, y, d]) => [x + side * d, y, side < 0 ? u : -u];
      if (c.detail)
        for (let i = 0; i < n; i++) {
          const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
          dormer(o, c, p, side < 0 ? z : -z);
        }
      if (c.detail) dormer(o, c, p, side < 0 ? z0 + 3 : -(z0 + 3), true);
    }
  }
}
function rails(o, c, x, z, y, r, arc = [0, Math.PI * 2]) {
  if (!c.detail) return;
  const steps = c.near ? 24 : 8,
    pts = Array.from({ length: steps + 1 }, (_, i) => {
      const t = arc[0] + ((arc[1] - arc[0]) * i) / steps;
      return [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    });
  beamPath(
    adapter(o, c),
    'stone',
    pts.map((p) => [p[0], y + 1.15, p[2]]),
    0.16,
    0.18,
    C.trim,
  );
  if (c.fine)
    for (let i = 0; i <= steps; i++) {
      const p = pts[i];
      beam(adapter(o, c), 'metal', p, [p[0], y + 1.15, p[2]], 0.1, 0.11, C.metal);
    }
}
function tower(o, c, x, z, R = 6.0) {
  const L = (R * Math.PI) / 4,
    n = 8;
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2,
      p = ([u, y, d]) => [
        x + (R + d) * Math.cos(theta - u / R),
        y,
        z + (R + d) * Math.sin(theta - u / R),
      ];
    p.curved = true;
    const hidden = x < 0 ? [0, 5, 6, 7].includes(i) : [4, 5, 6, 7].includes(i),
      holes = [
        ...(!hidden || c.master
          ? [
              { ring: arch(0, 0.7, 2.7, 5.7, c.arch), kind: 'glass' },
              { ring: arch(0, 8.2, 2.4, 5.6, c.arch), kind: 'glass' },
              { ring: rect(0, 15.3, 2.4, 3.45), kind: 'glass' },
              { ring: rect(0, 20.2, 2.3, 2.4), kind: 'glass' },
            ]
          : []),
        { ring: arch(0, 24.6, 2.2, 2.7, c.arch), kind: 'glass' },
      ];
    wall(
      o,
      c.fine && !c.near ? { ...c, recess: true } : c,
      p,
      rect(0, 0.35, L, 28.15),
      holes,
      'stone',
      [Math.cos(theta), 0, Math.sin(theta)],
    );
  }
  for (const y of c.detail ? [7.2, 14.6, 19.7, 23.3, 28.1] : [7.2, 23.3])
    lathe(
      o,
      c,
      x,
      z,
      [
        [y - 0.15, R + 0.32],
        [y + 0.15, R + 0.32],
      ],
      'trim',
    );
  rails(o, c, x, z, 14.7, R + 0.45);
  rails(o, c, x, z, 23.4, R + 0.45);
  lathe(
    o,
    c,
    x,
    z,
    interp(
      [
        [28.5, 6.55],
        [31, 5.5],
        [35, 3.7],
        [38, 1.9],
        [40, 1.65],
      ],
      c.roof,
    ),
    'roof',
  );
  if (c.fine)
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      beamPath(
        adapter(o, c),
        'roof',
        [
          [28.5, 6.58],
          [31, 5.53],
          [35, 3.73],
          [38, 1.93],
          [40, 1.68],
        ].map(([y, r]) => [x + r * Math.cos(t), y, z + r * Math.sin(t)]),
        0.09,
        0.1,
        C.roof,
      );
    }
  const N = c.fine ? 8 : 4;
  lathe(
    o,
    c,
    x,
    z,
    [
      [39.9, 1.9],
      [40.25, 1.9],
    ],
    'trim',
    1,
    N,
  );
  for (let i = 0; i < N; i++) {
    const t = ((i + 0.5) / N) * Math.PI * 2,
      px = x + 1.5 * Math.cos(t),
      pz = z + 1.5 * Math.sin(t);
    if (c.detail) box(o, c, px - 0.16, px + 0.16, 40.25, 43, pz - 0.16, pz + 0.16, 'trim');
    else {
      const dx = 0.16 * Math.sin(t),
        dz = -0.16 * Math.cos(t),
        P = [
          [px - dx, 40.25, pz - dz],
          [px + dx, 40.25, pz + dz],
          [px + dx, 43, pz + dz],
          [px - dx, 43, pz - dz],
        ];
      Q(o, c, P, 'trim', C.trim, [Math.cos(t), 0, Math.sin(t)]);
      Q(o, c, P, 'trim', C.trim, [-Math.cos(t), 0, -Math.sin(t)]);
    }
  }
  lathe(
    o,
    c,
    x,
    z,
    [
      [43, 1.85],
      [43.5, 1.5],
      [44.1, 0.45],
      [44.3, 0],
    ],
    'roof',
  );
  box(o, c, x - 0.045, x + 0.045, 44.1, 45, z - 0.045, z + 0.045, 'metal');
}
function balconies(o, c) {
  if (!c.detail) return;
  for (const x of [-11.5, 11.5]) {
    box(o, c, x - 1.8, x + 1.8, 14.35, 14.65, 37.25, 38.6, 'trim');
    beam(adapter(o, c), 'trim', [x - 1.8, 15.7, 38.6], [x + 1.8, 15.7, 38.6], 0.17, 0.2, C.trim);
    if (c.fine)
      for (let j = 0; j <= 8; j++) {
        const u = x - 1.7 + (j * 3.4) / 8;
        beam(adapter(o, c), 'metal', [u, 14.65, 38.6], [u, 15.7, 38.6], 0.09, 0.1, C.metal);
      }
  }
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Haydarpasa level ' + level);
  slab(o, c, stationPlan, -3, 0.35);
  onStage?.('floor');
  range(o, c, backLeft);
  range(o, c, backRight);
  range(o, c, frontBar, true);
  onStage?.('ranges');
  tower(o, c, -30.1, 36.15, 6.05);
  tower(o, c, 30.15, 35.75, 6.05);
  onStage?.('towers');
  roofWindows(o, c);
  balconies(o, c);
  onStage?.('dormers');
  if (c.detail) box(o, c, 24.2, 25.9, 27.8, 38.4, 31, 32.5, 'stone');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

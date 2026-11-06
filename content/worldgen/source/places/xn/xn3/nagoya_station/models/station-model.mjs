/** Original Nagoya Station twin-tower passenger building and mapped open platform canopies. */

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
  stone: lin('d9dedb'),
  base: lin('a7ada7'),
  roof: lin('aebbbd'),
  metal: lin('718085'),
  glass: lin('526976'),
  doorGlass: lin('526976'),
  concrete: lin('d9dedb'),
  clock: lin('d9dedb'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.65, metallic: 0.24 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.36 },
  doorGlass: { slot: 'window', graph: 'window_grid', roughness: 0.36 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87 },
};
const cfg = {
  skyline: { round: 8 },
  district: { round: 12, detail: true },
  street: { round: 24, detail: true, rows: true },
  closeup: { round: 48, detail: true, rows: true, fins: true },
  master: { round: 96, detail: true, rows: true, fins: true, master: true },
};
export const stationPlans = [
  [
    [76.512488, -30.845727],
    [76.168734, 23.18744],
    [67.515875, 22.927377],
    [67.927845, 33.727804],
    [57.800358, 34.42856],
    [49.788561, 33.912379],
    [40.976616, 30.928141],
    [-74.430418, 33.731034],
    [-78.250804, -26.072747],
    [-73.443502, -26.134771],
    [-73.281258, -30.845802],
    [76.512488, -30.845727],
  ],
  [
    [-74.717557, 30.686322],
    [-83.466768, 30.650508],
    [-83.653716, 18.087493],
    [-82.785968, 12.35122],
    [-82.732046, -39.150392],
    [-76.190827, -46.967358],
    [131.802051, -46.429726],
    [131.637366, -36.142321],
    [135.226873, -36.461283],
    [135.205154, 13.72619],
    [130.718478, 13.660196],
    [131.058314, -31.07895],
    [-73.281258, -30.845802],
    [-73.443502, -26.134771],
    [-78.250804, -26.072747],
    [-74.717557, 30.686322],
  ],
  [
    [130.718478, 13.660196],
    [76.365222, 13.444864],
    [76.512488, -30.845727],
    [131.058314, -31.07895],
    [130.718478, 13.660196],
  ],
];
export const nativePlans = {
  35184571857004: [
    [76.512488, -30.845727],
    [76.168734, 23.18744],
    [67.515875, 22.927377],
    [67.927845, 33.727804],
    [57.800358, 34.42856],
    [49.788561, 33.912379],
    [40.976616, 30.928141],
    [-74.430418, 33.731034],
    [-78.250804, -26.072747],
    [-73.443502, -26.134771],
    [-73.281258, -30.845802],
    [76.512488, -30.845727],
  ],
  35184873501520: [
    [19.684462, -15.390665],
    [28.561665, -15.034341],
    [29.462835, -23.943371],
    [76.605529, -23.634835],
    [76.168734, 23.18744],
    [67.515875, 22.927377],
    [67.927845, 33.727804],
    [57.800358, 34.42856],
    [49.788561, 33.912379],
    [40.976616, 30.928141],
    [31.588815, 25.572084],
    [26.047443, 18.679347],
    [22.012508, 11.370624],
    [18.45957, 1.081616],
    [17.854294, -7.411431],
    [19.684462, -15.390665],
  ],
  35184873501521: [
    [-66.594394, -4.338973],
    [-66.046394, -11.805991],
    [-77.391744, -11.362202],
    [-78.250804, -26.072747],
    [-45.400681, -27.116193],
    [-36.972811, -25.093528],
    [-29.892319, -19.930712],
    [-25.729288, -12.301433],
    [-24.6754, -3.615897],
    [-27.082214, 3.850319],
    [-31.763816, 9.809291],
    [-38.527726, 13.812424],
    [-46.219852, 15.026957],
    [-53.750525, 13.389259],
    [-60.222554, 9.284295],
    [-64.738749, 3.097031],
    [-66.594394, -4.338973],
  ],
  35185207342120: [
    [130.718478, 13.660196],
    [76.365222, 13.444864],
    [76.512488, -30.845727],
    [131.058314, -31.07895],
    [130.718478, 13.660196],
  ],
};
export const platformPlans = [
  [
    [-184.109426, -174.278271],
    [-184.169957, -182.803171],
    [-102.411495, -187.029946],
    [-47.575798, -187.935566],
    [89.238721, -187.395988],
    [156.890956, -184.13027],
    [194.481799, -180.749254],
    [218.516257, -177.341973],
    [218.929811, -170.259148],
    [156.342121, -174.80447],
    [87.150849, -176.340231],
    [-91.999774, -177.250675],
    [-184.109426, -174.278271],
  ],
  [
    [-184.176958, -166.073911],
    [-47.007011, -168.834516],
    [85.993571, -168.072275],
    [154.063354, -167.017719],
    [218.252903, -161.253892],
    [218.666454, -154.171067],
    [153.898679, -156.73031],
    [-184.468793, -157.965795],
    [-184.176958, -166.073911],
  ],
  [
    [-106.943786, -79.285367],
    [121.817079, -78.866757],
    [121.90851, -67.938275],
    [-106.691598, -69.350273],
    [-106.943786, -79.285367],
  ],
  [
    [84.145067, -117.340678],
    [120.134979, -117.03691],
    [120.162791, -107.198091],
    [84.044836, -107.822391],
    [-106.002199, -108.096417],
    [-105.806578, -115.980224],
    [84.145067, -117.340678],
  ],
  [
    [120.730624, -86.23831],
    [-107.293002, -87.137361],
    [-107.289074, -96.431378],
    [120.606576, -95.85283],
    [120.730624, -86.23831],
  ],
  [
    [-143.328719, -56.386579],
    [-143.070248, -61.321913],
    [116.745725, -60.857811],
    [116.934198, -52.012422],
    [-71.349338, -52.060951],
    [-143.328719, -56.386579],
  ],
  [
    [84.500609, -124.359093],
    [-110.289445, -125.340287],
    [-110.641021, -127.615872],
    [-89.358825, -132.029314],
    [-39.426056, -134.50749],
    [84.793319, -134.325974],
    [84.500609, -124.359093],
  ],
  [
    [121.001706, -46.01768],
    [121.15756, -35.85833],
    [-85.362365, -33.639217],
    [-101.706749, -34.54363],
    [-109.205657, -35.636516],
    [-108.49622, -45.955771],
    [-83.242701, -44.15015],
    [121.001706, -46.01768],
  ],
];
const mainPlan = stationPlans[0],
  connectorPlan = stationPlans[0];
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
const rect = (u, y, w, h) => [
  [u - w / 2, y],
  [u + w / 2, y],
  [u + w / 2, y + h],
  [u - w / 2, y + h],
];
const openRing = (r) =>
  r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.00001
    ? r.slice(0, -1)
    : r;
function wall(o, c, p, L, lo, hi, holes = [], surface = 'stone') {
  const outer = rect(L / 2, lo, L, hi - lo),
    active = c.recess ? holes : [],
    flat = [...outer, ...active.flatMap((h) => h.ring)],
    starts = active.map(
      (h, i) => outer.length + active.slice(0, i).reduce((n, h) => n + h.ring.length, 0),
    ),
    ids = earcut(flat.flat(), starts),
    N = sub(p([0, 0, 1]), p([0, 0, 0]));
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      surface,
      C[surface],
      N,
    );
  for (const h of holes) {
    const depth = c.recess ? 0.2 : -0.02,
      r = h.ring;
    if (c.recess)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        Q(
          o,
          c,
          [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])],
          'metal',
          C.metal,
        );
      }
    const ix = earcut(r.flat());
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        c,
        ix.slice(i, i + 3).map((j) => p([...r[j], -depth])),
        h.kind,
        C[h.kind],
        N,
      );
    if (c.fine)
      beamPath(
        adapter(o, c),
        'metal',
        r.map(([u, y]) => p([u, y, 0.035])),
        c.near ? 0.09 : 0.065,
        0.12,
        C.metal,
        true,
      );
    if (c.near) {
      const xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]),
        u = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys);
      if (hi - lo > 5)
        beam(
          adapter(o, c),
          'metal',
          p([Math.min(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          p([Math.max(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          0.065,
          0.075,
          C.metal,
        );
      if (h.kind === 'doorGlass')
        beam(
          adapter(o, c),
          'metal',
          p([u, lo, -depth + 0.04]),
          p([u, hi, -depth + 0.04]),
          0.08,
          0.09,
          C.metal,
        );
    }
  }
}
function edge(ring, i) {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    N = [U[1], 0, -U[0]],
    p = ([u, y, d]) => [b[0] - U[0] * u + N[0] * d, y, b[1] - U[1] * u + N[2] * d];
  return { a, b, L, N, p };
}
function slab(o, c, ring, y0, y1, s = 'base') {
  ring = openRing(ring);
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
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
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
function outlineBeam(o, c, ring, y, width = 0.12, s = 'metal') {
  if (c.detail)
    beamPath(
      adapter(o, c),
      s,
      openRing(ring).map(([x, z]) => [x, y, z]),
      width,
      width,
      C[s],
      true,
    );
}
function smoothProfile(raw, start, c) {
  const r = openRing(raw),
    n = c.master ? 8 : c.fins ? 3 : c.rows ? 1 : 0;
  if (!n) return r;
  const result = r.slice(0, start + 1),
    cat = (p0, p1, p2, p3, t) =>
      p1.map(
        (v, k) =>
          0.5 *
          (2 * v +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * v + 4 * p2[k] - p3[k]) * t * t +
            (-p0[k] + 3 * v - 3 * p2[k] + p3[k]) * t * t * t),
      );
  for (let i = start; i < r.length; i++)
    for (let j = 1; j <= n; j++)
      result.push(
        cat(
          r[(i - 1 + r.length) % r.length],
          r[i],
          r[(i + 1) % r.length],
          r[(i + 2) % r.length],
          j / n,
        ),
      );
  if (Math.hypot(result[0][0] - result.at(-1)[0], result[0][1] - result.at(-1)[1]) < 0.001)
    result.pop();
  return result;
}
function tower(o, c, raw, curveStart, top) {
  const plan = smoothProfile(raw, curveStart, c),
    lo = 60;
  for (let i = 0; i < plan.length; i++) {
    const { p, L } = edge(plan, i);
    // Closed blue-gray curtain backing; strips below supply the pale facade grid.
    wall(o, c, p, L, lo, top, [], c.detail ? 'glass' : 'stone');
    if (!c.detail) continue;
    const step = c.master ? 3.5 : c.fins ? 3.5 : c.rows ? 7 : 21;
    for (let y = lo; y < top; y += step) {
      if (c.fins) {
        // Actual projecting horizontal pale spandrel; glazing remains visible between strips.
        beam(adapter(o, c), 'stone', p([0, y, 0.035]), p([L, y, 0.035]), 0.65, 0.3, C.stone);
      } else
        Q(
          o,
          c,
          [
            p([0, y, 0.02]),
            p([L, y, 0.02]),
            p([L, Math.min(top, y + 0.45), 0.02]),
            p([0, Math.min(top, y + 0.45), 0.02]),
          ],
          'stone',
          C.stone,
          sub(p([0, 0, 1]), p([0, 0, 0])),
        );
    }
  }
  if (c.detail) {
    // Facade fin spacing is independent of curve tessellation and stable between detailed levels.
    const finPlan = smoothProfile(raw, curveStart, { ...c, master: false });
    for (let i = 0; i < finPlan.length; i++) {
      const { p, L } = edge(finPlan, i),
        n = c.rows ? Math.max(1, Math.round(L / (c.fins ? 3.1 : 6.2))) : 1;
      for (let j = 0; j < n; j++) {
        const u = (j * L) / n;
        if (c.rows)
          beam(
            adapter(o, c),
            'stone',
            p([u, lo, 0.08]),
            p([u, top + 0.15, 0.08]),
            c.fins ? 0.55 : 0.45,
            c.fins ? 0.4 : 0.3,
            C.stone,
          );
        else
          Q(
            o,
            c,
            [
              p([u, lo, 0.03]),
              p([Math.min(L, u + 0.45), lo, 0.03]),
              p([Math.min(L, u + 0.45), top, 0.03]),
              p([u, top, 0.03]),
            ],
            'stone',
            C.stone,
            sub(p([0, 0, 1]), p([0, 0, 0])),
          );
      }
    }
  }
  slab(o, c, plan, top - 0.25, top, 'roof');
  outlineBeam(o, c, plan, top + 0.2, 0.2, 'stone');
}
function podium(o, c) {
  const r = openRing(nativePlans[35184571857004]);
  for (let i = 0; i < r.length; i++) {
    const { p, L } = edge(r, i);
    wall(o, c, c.rows ? ([u, y, d]) => p([u, y, d - 1.2]) : p, L, 0.35, 60, [], 'glass');
    if (c.detail) {
      const floors = c.rows ? 14 : 5,
        step = 58 / floors;
      for (let j = 0; j <= floors; j++) {
        const y = 1 + j * step;
        // Stacked pale sun-shading/slab bands stand in front of the dark glazing.
        const ranges =
          i === 6
            ? [
                [0, 59],
                [88, L],
              ]
            : [[0, L]];
        for (const [u0, u1] of ranges) {
          if (!c.rows)
            Q(
              o,
              c,
              [p([u0, y, 0.05]), p([u1, y, 0.05]), p([u1, y + 0.9, 0.05]), p([u0, y + 0.9, 0.05])],
              'stone',
              C.stone,
              sub(p([0, 0, 1]), p([0, 0, 0])),
            );
          if (c.fins && L > 8 && j % 3 === 1)
            beam(
              adapter(o, c),
              'metal',
              p([u0, y + 1, 0.04]),
              p([u1, y + 1, 0.04]),
              0.09,
              0.11,
              C.metal,
            );
        }
      }
      for (let u = 3; u < L; u += c.fins ? 5 : 12)
        if (i !== 6 || u < 59 || u > 88)
          beam(adapter(o, c), 'metal', p([u, 0.35, 0.06]), p([u, 60, 0.06]), 0.16, 0.18, C.metal);
      if (i === 6) {
        Q(
          o,
          c,
          [p([59, 0.35, 0.08]), p([88, 0.35, 0.08]), p([88, 60, 0.08]), p([59, 60, 0.08])],
          'glass',
          C.glass,
          sub(p([0, 0, 1]), p([0, 0, 0])),
        );
        for (let u = 59; u <= 88; u += c.fins ? 2.5 : 5.8)
          beam(adapter(o, c), 'stone', p([u, 0.35, 0.14]), p([u, 71, 0.14]), 0.34, 0.3, C.stone);
        if (c.rows)
          for (const u of [64, 73, 82]) {
            const ring = rect(u, 0.4, 6, 3.8);
            beamPath(
              adapter(o, c),
              'metal',
              ring.map(([u, y]) => p([u, y, 0.13])),
              0.12,
              0.15,
              C.metal,
              true,
            );
            beam(adapter(o, c), 'metal', p([u, 0.4, 0.14]), p([u, 4.2, 0.14]), 0.13, 0.15, C.metal);
          }
      }
    }
  }
  if (c.rows)
    for (let j = 0; j <= 14; j++) {
      const y = 1 + (j * 58) / 14;
      slab(o, c, r, y - 0.65, y, 'stone');
    }
  slab(o, c, r, 59.5, 60, 'roof');
  outlineBeam(o, c, r, 60.12, 0.22, 'stone');
  // The wide dark center connects both tower bases but does not fill the upper skyline gap.
  box(o, c, -15, 12, 60, 69, 25, 33, 'glass');
  const north = openRing(nativePlans[35185207342120]);
  for (let i = 0; i < north.length; i++) {
    const { p, L } = edge(north, i);
    wall(o, c, p, L, 0.35, 42, [], 'glass');
    if (c.detail)
      for (let y = 3; y < 42; y += 5)
        beam(adapter(o, c), 'stone', p([0, y, 0.04]), p([L, y, 0.04]), 0.4, 0.35, C.stone);
  }
  slab(o, c, north, 41.6, 42, 'roof');
  // Integral shallow street canopy cantilevers from the occupied parent; no plaza floor.
  box(o, c, -72, 65, 4.8, 5.2, 33, 35, 'stone');
  if (c.detail)
    for (let x = -68; x < 60; x += 12)
      beam(adapter(o, c), 'metal', [x, 4.3, 32.9], [x, 4.9, 34.8], 0.14, 0.16, C.metal);
}
function hotelCrown(o, c) {
  const cx = -45.7,
    cz = -6.2,
    R = 17.5,
    n = c.round;
  const ring = Array.from({ length: n }, (_, i) => [
    cx + R * Math.cos((i / n) * Math.PI * 2),
    cz + R * Math.sin((i / n) * Math.PI * 2),
  ]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    Q(
      o,
      c,
      [
        [a[0], 220, a[1]],
        [b[0], 220, b[1]],
        [b[0], 224, b[1]],
        [a[0], 224, a[1]],
      ],
      'glass',
      C.glass,
    );
  }
  slab(o, c, ring, 224, 224.6, 'metal');
  const disc = Array.from({ length: n }, (_, i) => [
    cx + 20.5 * Math.cos((i / n) * Math.PI * 2),
    cz + 20.5 * Math.sin((i / n) * Math.PI * 2),
  ]);
  slab(o, c, disc, 225.5, 226, 'roof');
  for (let i = 0; i < (c.detail ? Math.min(n, 24) : 4); i++) {
    const count = c.detail ? Math.min(n, 24) : 4,
      t = (i / count) * Math.PI * 2,
      x = cx + 15 * Math.cos(t),
      z = cz + 15 * Math.sin(t);
    box(o, c, x - 0.18, x + 0.18, 224.3, 225.7, z - 0.18, z + 0.18, 'metal');
  }
}
function platforms(o, c) {
  for (const raw of platformPlans) {
    const r = openRing(raw),
      a = r.flat(),
      x0 = Math.min(...r.map((p) => p[0])),
      x1 = Math.max(...r.map((p) => p[0])),
      z0 = Math.min(...r.map((p) => p[1])),
      z1 = Math.max(...r.map((p) => p[1])),
      zc = (z0 + z1) / 2,
      high = zc < -150 ? 14 : 9;
    // Open-sided thin roof polygons follow actual platform islands,not a solid railway block.
    slab(o, c, r, high - 0.25, high, 'roof');
    const n = c.detail ? Math.max(3, Math.floor((x1 - x0) / (c.rows ? 20 : 80))) : 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
      box(o, c, x - 0.18, x + 0.18, 0.35, high - 0.15, zc - 0.18, zc + 0.18, 'metal');
      if (c.rows)
        beam(
          adapter(o, c),
          'metal',
          [x, high - 1, zc],
          [x, high - 0.2, z1 - 0.5],
          0.13,
          0.16,
          C.metal,
        );
    }
  }
  // Photo-visible broad transverse station concourse spans above the rail approaches.
  box(o, c, -22, 12, 8, 8.6, -190, -31, 'concrete');
  if (c.detail)
    for (const z of [-178, -145, -110, -75])
      box(o, c, -18, -17, 0.35, 8.3, z - 0.5, z + 0.5, 'concrete');
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Nagoya level ' + level);
  for (const r of stationPlans) slab(o, c, r, -3, 0.35);
  onStage?.('floors');
  podium(o, c);
  onStage?.('podium');
  tower(o, c, nativePlans[35184873501520], 6, 245);
  tower(o, c, nativePlans[35184873501521], 4, 220);
  hotelCrown(o, c);
  onStage?.('towers');
  platforms(o, c);
  onStage?.('canopies');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

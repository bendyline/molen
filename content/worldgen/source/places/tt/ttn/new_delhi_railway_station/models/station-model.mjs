/** Original complete New Delhi passenger ranges and nine mapped platform canopy groups. */

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
  far: lin('ddddcc'),
  stone: lin('e5e3d1'),
  plaster: lin('d7c77a'),
  paint: lin('cf8458'),
  yellow: lin('e8bf35'),
  red: lin('bb6951'),
  blue: lin('56828b'),
  green: lin('829675'),
  base: lin('aca99b'),
  glass: lin('536976'),
  metal: lin('59696a'),
  roof: lin('b8c1bd'),
  canopyRoof: lin('bcc8c6'),
  clock: lin('e5e3d1'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  paint: { slot: 'wall', graph: 'metal_painted', roughness: 0.85 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.47 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9 },
  canopyRoof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86 },
};
const cfg = {
  skyline: { round: 4 },
  district: { round: 4, detail: true },
  street: { round: 4, detail: true, recess: true, fine: true },
  closeup: { round: 20, detail: true, recess: true, fine: true, near: true },
  master: { round: 64, detail: true, recess: true, fine: true, near: true, master: true },
};
export const westPlan = [
  [-161.759065, 87.516841],
  [3.291608869800524, 87.51690758045966],
  [24.549594, 87.442552],
  [24.987842, 115.241691],
  [13.015423845198796, 115.35373473271564],
  [-36.164491, 115.887043],
  [-36.082165, 125.496948],
  [-129.670716, 125.720032],
  [-130.077071, 114.983927],
  [-159.631616, 114.82989],
  [-161.759065, 87.516841],
];
export const eastPlans = [
  [
    [-137.314251, -105.96944],
    [-136.820143, -125.866557],
    [22.9159663051625, -116.31544915648017],
    [22.945472, -116.474451],
    [26.342672, -116.110556],
    [25.803461, -103.151262],
    [-137.314251, -105.96944],
  ],
  [
    [37.652519, -119.608673],
    [176.819154, -116.970777],
    [177.459318, -93.13193],
    [37.787962, -98.795179],
    [37.652519, -119.608673],
  ],
];
export const stationPlans = [westPlan, ...eastPlans];
export const platformPlans = [
  [
    [-185.400784, 21.031122],
    [-184.364849, 6.831417],
    [-144.486141, 10.233879],
    [-105.961916, 12.318922],
    [32.209965, 17.437398],
    [32.20561170745462, 17.460857248761492],
    [207.973673, 23.934859],
    [350.213157, 33.006363],
    [404.256625, 34.773076],
    [404.57008, 38.829005],
    [371.510742, 41.755834],
    [339.559125, 43.022598],
    [294.257497, 41.545506],
    [207.291061, 37.667096],
    [3.672363, 27.599736],
    [-185.400784, 21.031122],
  ],
  [
    [-412.444822, 48.193484],
    [-356.054046, 41.600708],
    [-261.003788, 32.054242],
    [-234.655417, 30.813763],
    [-208.803685, 30.813711],
    [-143.474247, 34.941259],
    [-107.383003, 35.775266],
    [-6.126185863665452, 40.18840022433502],
    [-6.123491, 40.173878],
    [5.242128, 40.683872],
    [54.874864, 43.231198],
    [180.545997, 51.093763],
    [180.182106, 54.490964],
    [54.842988, 52.020359],
    [5.247428, 52.145106],
    [-8.322787, 52.025561],
    [-8.318052873632608, 52.00004948859441],
    [-107.531787, 50.939151],
    [-144.119735, 51.345559],
    [-208.686901, 50.291156],
    [-411.844573, 50.703529],
    [-412.444822, 48.193484],
  ],
  [
    [-158.231426, -6.175717],
    [-157.694873, -11.939534],
    [-134.084743, -14.221179],
    [-67.294076, -12.221129],
    [3.0017454755301802, -9.00066602742969],
    [3.008371, -9.03637],
    [3.266016, -8.988559],
    [335.821694, 7.148746],
    [401.448893, 13.996724],
    [422.37731, 14.682166],
    [422.318889, 17.869534],
    [401.828758, 19.131047],
    [351.134801, 17.985897],
    [208.236607, 9.59171],
    [3.281943, -0.457045],
    [-67.679235, -2.964492],
    [-134.440687, -6.558225],
    [-158.231426, -6.175717],
  ],
  [
    [-123.290222, -43.667117],
    [-123.125522, -50.29949],
    [-91.948073, -51.709915],
    [-59.110471, -52.012716],
    [44.353907, -48.004503],
    [44.3436718696197, -47.94934742304342],
    [223.257225, -41.190947],
    [255.359913, -38.96495],
    [300.525892, -32.449199],
    [362.056994, -20.76446],
    [405.055924, -11.186117],
    [425.973729, -7.570953],
    [425.017513, -2.418048],
    [397.79118, -5.071735],
    [362.978747, -9.932714],
    [294.977124, -21.219072],
    [258.00817, -25.947198],
    [222.393989, -29.357851],
    [208.499494, -30.603641],
    [8.697855, -39.696158],
    [8.720122938948863, -39.81615657462247],
    [3.964619, -40.041462],
    [-59.657652, -43.31918],
    [-93.029132, -44.448036],
    [-123.290222, -43.667117],
  ],
  [
    [-132.849617, -25.185711],
    [-132.740681, -35.826194],
    [3.388224, -29.754242],
    [25.820199080504224, -29.110244692197032],
    [54.290539, -28.30391],
    [209.020127, -19.046778],
    [257.593832, -15.09687],
    [348.728184, -3.515573],
    [348.507729, -0.891308],
    [157.31235, -11.851503],
    [4.825181, -18.82689],
    [4.837110338480455, -18.89117544888489],
    [-132.849617, -25.185711],
  ],
  [
    [-86.564042, -82.159868],
    [-86.202749, -104.213771],
    [4.055016, -103.722357],
    [5.369794, -97.881509],
    [53.342336, -96.441815],
    [53.318267385244596, -96.31211283229875],
    [179.424887, -92.234148],
    [185.935161, -97.155949],
    [223.716636, -96.807841],
    [264.93269, -93.423728],
    [357.190592, -74.970999],
    [425.630799, -61.737632],
    [495.885614, -51.099223],
    [493.991784, -39.457373],
    [449.969923, -44.96126],
    [373.255441, -58.130965],
    [261.224683, -79.186839],
    [229.828541, -82.347793],
    [17.925339, -89.421697],
    [17.960878668238482, -89.61321508971349],
    [-7.993225, -90.500116],
    [-39.266489, -88.574436],
    [-76.314083, -84.255562],
    [-86.564042, -82.159868],
  ],
  [
    [-44.876271, -66.961451],
    [-44.557514, -77.29648],
    [-8.598842, -78.619214],
    [46.89509844020281, -76.45164663561887],
    [229.384983, -69.903783],
    [260.265829, -66.838452],
    [448.849056, -33.175972],
    [507.729956, -27.313376],
    [533.554019, -25.719458],
    [533.017495, -19.955636],
    [495.949574, -16.973121],
    [465.248737, -18.139426],
    [435.397963, -21.013609],
    [258.324183, -54.938957],
    [226.736794, -57.069331],
    [54.723511, -63.670384],
    [13.383313, -64.945395],
    [13.407490955328672, -65.07568641408312],
    [-44.876271, -66.961451],
  ],
  [
    [-408.397155, 69.466446],
    [-406.962831, 61.737088],
    [-208.843656, 61.189282],
    [5.730837, 61.029887],
    [24.08213, 61.237096],
    [24.0582241620384, 61.36592103280523],
    [43.979329, 61.731176],
    [184.386855, 64.86586],
    [184.450618, 73.139733],
    [43.517155, 72.839144],
    [21.835356709543333, 73.34462568851909],
    [21.835023, 73.346424],
    [5.239438, 73.731537],
    [-12.338894, 73.667765],
    [-12.33355344494889, 73.63898554118555],
    [-209.096033, 72.602699],
    [-337.581312, 72.746476],
    [-408.397155, 69.466446],
  ],
  [
    [-556.264057, 76.407789],
    [-554.256004, 65.586687],
    [-496.001451, 74.79778],
    [-422.439797, 83.384659],
    [-368.248333, 88.643562],
    [-161.759065, 87.516841],
    [19.205429, 87.516914],
    [19.195056535936715, 87.57280965401135],
    [191.640927, 87.533381],
    [191.906554, 91.846952],
    [115.302486, 93.889231],
    [52.842896, 92.959409],
    [24.623963, 92.786701],
    [18.20643444593172, 92.90034590323438],
    [18.201402, 92.927465],
    [12.717386680475578, 92.99754879012434],
    [-16.020325, 93.506451],
    [-15.993977823079028, 93.3644699467606],
    [-117.510934, 94.661821],
    [-133.705261, 94.321842],
    [-211.757537, 95.562344],
    [-339.241506, 97.491036],
    [-375.637549, 96.866986],
    [-413.98831, 92.415476],
    [-487.674877, 85.937556],
    [-556.264057, 76.407789],
  ],
];
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
    if (c.near)
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
function column(o, c, x, z, lo, hi, R = 0.3) {
  if (!c.fine) {
    if (lo > 1)
      Q(
        o,
        c,
        [
          [x - R, lo, z],
          [x + R, lo, z],
          [x + R, hi, z],
          [x - R, hi, z],
        ],
        'stone',
        C.stone,
        [0, 0, -1],
      );
    else box(o, c, x - R, x + R, lo, hi, z - R, z + R, 'stone');
    return;
  }
  const n = c.round,
    p = [
      [lo, R * 1.25],
      [lo + 0.18, R * 1.25],
      [lo + 0.32, R],
      [hi - 0.28, R],
      [hi - 0.12, R * 1.22],
      [hi, R * 1.22],
    ],
    rings = p.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => [
        x + r * Math.cos((i / n) * Math.PI * 2),
        y,
        z + r * Math.sin((i / n) * Math.PI * 2),
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++)
      Q(
        o,
        c,
        [rings[j - 1][i], rings[j - 1][(i + 1) % n], rings[j][(i + 1) % n], rings[j][i]],
        'stone',
        C.stone,
      );
  for (const [i, normal] of [
    [0, [0, -1, 0]],
    [rings.length - 1, [0, 1, 0]],
  ])
    for (let j = 1; j < n - 1; j++)
      T(o, c, [rings[i][0], rings[i][j], rings[i][j + 1]], 'stone', C.stone, normal);
}
function arch(u, y, w, h, n) {
  const R = w / 2,
    s = y + h - R,
    r = [
      [u - R, y],
      [u + R, y],
      [u + R, s],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    r.push([u + R * Math.cos(t), s + R * Math.sin(t)]);
  }
  return r;
}
function band(o, c, p, L, y, thick = 0.25, s = 'stone', color = C[s]) {
  if (c.detail) beam(adapter(o, c), s, p([0, y, 0.1]), p([L, y, 0.1]), 0.3, thick, color);
}
function clock(o, c, p, u, y) {
  const N = sub(p([0, 0, 1]), p([0, 0, 0])),
    R = 1.65,
    points = Array.from({ length: c.round * 2 }, (_, i) => [
      u + R * Math.cos((i / (c.round * 2)) * Math.PI * 2),
      y + R * Math.sin((i / (c.round * 2)) * Math.PI * 2),
    ]);
  for (let i = 1; i < points.length - 1; i++)
    T(
      o,
      c,
      [points[0], points[i], points[i + 1]].map(([u, y]) => p([u, y, 0.1])),
      'stone',
      C.stone,
      N,
    );
  if (c.detail) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'metal',
        p([u + 1.28 * Math.cos(t), y + 1.28 * Math.sin(t), 0.17]),
        p([u + 1.5 * Math.cos(t), y + 1.5 * Math.sin(t), 0.17]),
        0.065,
        0.065,
        C.metal,
      );
    }
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.22]),
      p([u - 0.68, y + 0.55, 0.22]),
      0.085,
      0.09,
      C.metal,
    );
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.23]),
      p([u + 0.25, y + 1.1, 0.23]),
      0.085,
      0.09,
      C.metal,
    );
  }
}
const westCore = [westPlan[0], westPlan[2], westPlan[3], westPlan[9]],
  westCanopy = [westPlan[8], westPlan[5], westPlan[6], westPlan[7]];
function west(o, c) {
  const roof = 16;
  for (let i = 0; i < westCore.length; i++) {
    const { p, L } = edge(westCore, i),
      holes = [],
      front = i === 2,
      n = c.detail ? Math.max(3, Math.round(L / (front ? 5.8 : 7))) : 1;
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * L) / n,
        w = c.detail ? Math.min(front ? 3.1 : 3.4, L / n - 0.6) : L * 0.8;
      if (front && u > L - 17) continue;
      holes.push({ ring: rect(u, 0.4, w, 3.7), kind: 'glass' });
      holes.push({ ring: rect(u, 9, w, 2.6), kind: 'glass' });
      holes.push({ ring: rect(u, 12.2, w, 2.1), kind: 'glass' });
    }
    wall(
      o,
      c.fine && !c.near && !front ? { ...c, recess: false } : c,
      p,
      L,
      0.35,
      roof,
      holes,
      'paint',
    );
    if (front) {
      const N = sub(p([0, 0, 1]), p([0, 0, 0]));
      // Quiet original panel colors replace the photo murals; no copied artwork or lettering.
      Q(
        o,
        c,
        [p([0, 5.2, 0.025]), p([L, 5.2, 0.025]), p([L, 8.5, 0.025]), p([0, 8.5, 0.025])],
        'plaster',
        C.plaster,
        N,
      );
      if (c.detail) {
        Q(
          o,
          c,
          [p([0, 5.2, 0.035]), p([L, 5.2, 0.035]), p([L, 5.85, 0.035]), p([0, 5.85, 0.035])],
          'plaster',
          C.green,
          N,
        );
        for (let u = 19; u < L - 23; u += 19) {
          beam(adapter(o, c), 'paint', p([u, 8.7, 0.4]), p([u, 11.7, 0.4]), 0.43, 0.5, C.yellow);
          for (const side of [-1, 1])
            beam(
              adapter(o, c),
              'paint',
              p([u, 11.7, 0.4]),
              p([u + side * 5.8, 15.2, 0.4]),
              0.43,
              0.5,
              C.yellow,
            );
        }
      }
      clock(o, c, p, L - 8.5, 12.25);
    }
    band(o, c, p, L, roof - 0.15, 0.35, 'paint');
  }
  slab(o, c, westCore, 15.75, 16, 'roof');
  outlineBeam(o, c, westCore, 16.15, 0.18, 'paint');
  slab(o, c, westCanopy, 7.6, 8.2, 'paint');
  outlineBeam(o, c, westCanopy, 8.2, 0.18, 'paint');
  const a = westCanopy[3],
    b = westCanopy[2],
    n = c.detail ? 7 : 2;
  for (let j = 0; j < n; j++) {
    const t = (j + 0.5) / n,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t - 0.6;
    if (c.detail) column(o, c, x, z, 0.35, 7.65, 0.4);
    else box(o, c, x - 0.35, x + 0.35, 0.35, 7.65, z - 0.35, z + 0.35, 'stone');
  }
  if (c.detail) {
    box(o, c, -125, -5, 16, 18.25, 90, 95, 'glass');
    box(o, c, -125, -5, 18.25, 18.5, 90, 95, 'roof');
    for (let x = -145; x < 15; x += c.fine ? 16 : 32) {
      box(o, c, x - 0.35, x + 0.35, 16, 16.7, 109, 109.7, 'paint', C.red);
      const r = [
        [x - 0.55, 108.8],
        [x + 0.55, 108.8],
        [x + 0.55, 109.9],
        [x - 0.55, 109.9],
      ];
      slab(o, c, r, 16.7, 17.05, 'paint');
    }
  }
}
function east(o, c, raw, range) {
  const r = openRing(raw),
    hi = 13.5,
    frontIndex = r.reduce((best, _, i) => {
      const e = edge(r, i),
        q = edge(r, best);
      return e.N[2] < q.N[2] ? i : best;
    }, 0);
  for (let i = 0; i < r.length; i++) {
    const { p, L } = edge(r, i),
      front = i === frontIndex;
    if (!front) {
      const holes = [],
        n = c.detail ? Math.max(1, Math.round(L / 7)) : 1;
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * L) / n,
          w = c.detail ? Math.min(3, L / n - 0.6) : L * 0.7;
        holes.push({ ring: rect(u, 1.2, w, 3), kind: 'glass' });
        holes.push({ ring: rect(u, 7.4, w, 3.5), kind: 'glass' });
      }
      wall(o, c.fine && !c.near ? { ...c, recess: false } : c, p, L, 0.35, hi, holes, 'plaster');
      continue;
    }
    const n = c.detail ? Math.max(4, Math.round((L - 20) / 6.7)) : 3,
      span = (L - 20) / n,
      lo = 5.35,
      N = sub(p([0, 0, 1]), p([0, 0, 0]));
    wall(o, c, ([u, y, d]) => p([u, y, d - 0.5]), L, lo, hi, [], 'plaster');
    const doors = [];
    for (let j = 0; j < n; j++) {
      const u = 10 + (j + 0.5) * span;
      doors.push({ ring: rect(u, 0.4, Math.min(4, span - 0.5), 3.8), kind: 'glass' });
    }
    wall(o, c, ([u, y, d]) => p([u, y, d - 2.6]), L, 0.35, lo, doors, 'plaster');
    for (const [u0, u1] of [
      [0, 9],
      [L - 9, L],
    ]) {
      const end = ([u, y, d]) => p([u + u0, y, d]),
        holes = [
          { ring: arch((u1 - u0) / 2, 0.4, 4.1, 4.4, c.round), kind: 'glass' },
          { ring: rect((u1 - u0) / 2, 8.1, 4.7, 2.9), kind: 'glass' },
        ];
      wall(o, c, end, u1 - u0, 0.35, hi + 0.7, holes, 'paint');
    }
    const count = c.detail ? n + 1 : 4;
    for (let j = 0; j < count; j++) {
      const u = 10 + (j * (L - 20)) / (count - 1),
        v = p([u, 0, 0.3]);
      if (c.detail) {
        column(o, c, v[0], v[2], 0.35, lo, 0.28);
        for (const d of [-0.43, 0.43]) {
          const w = p([u + d, 0, 0.25]);
          column(o, c, w[0], w[2], lo + 0.25, hi - 0.15, 0.19);
        }
      } else box(o, c, v[0] - 0.3, v[0] + 0.3, 0.35, hi, v[2] - 0.3, v[2] + 0.3, 'stone');
    }
    if (c.detail) {
      band(o, c, p, L, lo, 0.55);
      band(o, c, p, L, hi, 0.45);
      band(o, c, p, L, hi + 0.6, 0.4, 'paint', C.red);
      // Pale paneled ends frame an original quiet upper wall instead of branded facade imagery.
      for (let j = 0; j < n; j++) {
        const u = 10 + j * span;
        beam(
          adapter(o, c),
          'stone',
          p([u, lo + 0.5, 0.05]),
          p([u + span, lo + 0.5, 0.05]),
          0.14,
          0.18,
          C.stone,
        );
      }
    }
  }
  slab(o, c, r, hi - 0.2, hi, 'roof');
  outlineBeam(o, c, r, hi + 0.65, 0.2, 'stone');
}
function lineDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = dx * dx + dy * dy,
    t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function simplifyLine(r, tol) {
  let best = tol,
    k = -1;
  for (let i = 1; i < r.length - 1; i++) {
    const d = lineDistance(r[i], r[0], r.at(-1));
    if (d > best) {
      best = d;
      k = i;
    }
  }
  return k < 0
    ? [r[0], r.at(-1)]
    : [...simplifyLine(r.slice(0, k + 1), tol).slice(0, -1), ...simplifyLine(r.slice(k), tol)];
}
function canopyPlan(raw, c) {
  const r = openRing(raw);
  if (c.fine) return r;
  const lo = r.reduce((a, p, i) => (p[0] < r[a][0] ? i : a), 0),
    hi = r.reduce((a, p, i) => (p[0] > r[a][0] ? i : a), 0),
    path = (a, b) => {
      const q = [r[a]];
      for (let i = (a + 1) % r.length; i !== b; i = (i + 1) % r.length) q.push(r[i]);
      q.push(r[b]);
      return q;
    },
    tol = c.detail ? 0.5 : 1.5;
  return [
    ...simplifyLine(path(lo, hi), tol).slice(0, -1),
    ...simplifyLine(path(hi, lo), tol).slice(0, -1),
  ];
}
function crossSection(r, x) {
  const zs = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) {
      const t = (x - a[0]) / (b[0] - a[0]);
      zs.push(a[1] + t * (b[1] - a[1]));
    }
  }
  return zs.length ? [Math.min(...zs), Math.max(...zs)] : undefined;
}
function canopies(o, c) {
  for (const raw of platformPlans) {
    const r = canopyPlan(raw, c),
      x0 = Math.min(...r.map((p) => p[0])),
      x1 = Math.max(...r.map((p) => p[0])),
      hi = 9;
    slab(o, c, r, hi - 0.24, hi, 'canopyRoof');
    const n = c.detail ? Math.max(3, Math.floor((x1 - x0) / (c.near ? 24 : c.fine ? 48 : 100))) : 2;
    for (let j = 0; j < n; j++) {
      const x = x0 + ((j + 0.5) * (x1 - x0)) / n,
        s = crossSection(r, x);
      if (!s) continue;
      const z = (s[0] + s[1]) / 2;
      box(o, c, x - 0.16, x + 0.16, -2, hi - 0.2, z - 0.16, z + 0.16, 'metal');
      if (c.fine) {
        for (const d of [-1, 1])
          beam(
            adapter(o, c),
            'metal',
            [x, hi - 1.2, z],
            [x, hi - 0.22, z + d * Math.max(0.4, (s[1] - s[0]) / 2 - 0.35)],
            0.1,
            0.13,
            C.metal,
          );
      }
    }
    if (c.master)
      for (let x = x0 + 2; x < x1 - 1; x += 4) {
        const s = crossSection(r, x);
        if (s)
          beam(
            adapter(o, c),
            'metal',
            [x, hi + 0.035, s[0] + 0.15],
            [x, hi + 0.035, s[1] - 0.15],
            0.045,
            0.06,
            C.metal,
          );
      }
  }
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown New Delhi tier ' + level);
  for (const r of stationPlans) slab(o, c, r, -3, 0.35);
  onStage?.('floors');
  west(o, c);
  onStage?.('west');
  eastPlans.forEach((r, i) => {
    east(o, c, r, i);
  });
  onStage?.('east');
  canopies(o, c);
  onStage?.('canopies');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

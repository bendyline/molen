/** Original complete connected Tallinn passenger hall, covered connector and low pavilion. */

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
  stone: lin('d6d1c3'),
  base: lin('a6a99f'),
  roof: lin('c9cfca'),
  metal: lin('566263'),
  glass: lin('60727a'),
  doorGlass: lin('61777b'),
  concrete: lin('d1d3cb'),
  clock: lin('e2dfd1'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.48 },
  doorGlass: { slot: 'window', graph: 'storefront', roughness: 0.48 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  clock: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
};
const cfg = {
  skyline: { round: 8 },
  district: { round: 12, detail: true },
  street: { round: 20, detail: true, recess: true, fine: true },
  closeup: { round: 40, detail: true, recess: true, fine: true, near: true },
  master: { round: 80, detail: true, recess: true, fine: true, near: true, master: true },
};
export const stationPlans = [
  [
    [59.572475, -7.96583],
    [59.653212, -1.061011],
    [36.831505, -0.90782],
    [36.415224, 18.302424],
    [-28.638651, 18.785873],
    [-28.431729, 16.21337],
    [-36.840923, 16.952545],
    [-36.487356, -17.627484],
    [36.913055, -17.627484],
    [36.704936, -8.022396],
    [59.572475, -7.96583],
  ],
  [
    [59.653212, -1.061011],
    [59.925242, -59.137106],
    [74.1641, -58.842784],
    [73.785263, -47.002879],
    [102.554665, -46.58786],
    [101.383684, -1.171385],
    [67.187283, -1.279212],
    [59.653212, -1.061011],
  ],
];
export const nativePlans = {
  1: [
    [59.572475, -7.96583],
    [59.653212, -1.061011],
    [36.831505, -0.90782],
    [36.415224, 18.302424],
    [-28.638651, 18.785873],
    [-28.431729, 16.21337],
    [-36.840923, 16.952545],
    [-36.487356, -17.627484],
    [36.913055, -17.627484],
    [36.704936, -8.022396],
    [59.572475, -7.96583],
  ],
  143: [
    [64.221484, -59.087147],
    [71.975005, -58.80387],
    [71.829417, -50.421208],
    [64.075893, -50.704479],
    [64.221484, -59.087147],
  ],
  144: [
    [64.221484, -59.087147],
    [64.075893, -50.704479],
    [71.829417, -50.421208],
    [71.975005, -58.80387],
    [74.1641, -58.842784],
    [73.785263, -47.002879],
    [72.143441, -46.973691],
    [72.047007, -19.262896],
    [73.479091, -19.246248],
    [73.437739, -7.370157],
    [73.672643, -1.268203],
    [59.653212, -1.061011],
    [59.925242, -59.137106],
    [64.221484, -59.087147],
  ],
  145: [
    [73.479091, -19.246248],
    [72.047007, -19.262896],
    [72.143441, -46.973691],
    [102.554665, -46.58786],
    [101.383684, -1.171385],
    [73.672643, -1.268203],
    [73.437739, -7.370157],
    [89.865736, -7.114819],
    [89.591869, -15.405843],
    [77.587925, -15.529301],
    [77.565601, -19.150463],
    [73.479091, -19.246248],
  ],
  146: [
    [74.764613, -44.03041],
    [96.455567, -43.826458],
    [96.232561, -23.230234],
    [74.541578, -23.434142],
    [74.764613, -44.03041],
  ],
  159: [
    [59.653212, -1.061011],
    [59.925242, -59.137106],
    [74.1641, -58.842784],
    [73.785263, -47.002879],
    [102.554665, -46.58786],
    [101.383684, -1.171385],
    [67.187283, -1.279212],
    [59.653212, -1.061011],
  ],
};
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
const mainPlan = [
    nativePlans[1][3],
    nativePlans[1][4],
    nativePlans[1][5],
    nativePlans[1][6],
    nativePlans[1][7],
    nativePlans[1][8],
  ],
  connectorPlan = [nativePlans[1][9], nativePlans[1][0], nativePlans[1][1], nativePlans[1][2]];
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
function frontGlass(c, L) {
  const holes = [],
    n = c.detail ? Math.max(4, Math.round(L / 3.4)) : 1,
    w = L / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * w,
      door = c.detail && i >= n - 2;
    holes.push({
      ring: rect(u, door ? 0.35 : 1.2, w - 0.12, 5.05 - (door ? 0.35 : 1.2)),
      kind: door ? 'doorGlass' : 'glass',
    });
    holes.push({ ring: rect(u, 5.2, w - 0.12, 4.1), kind: 'glass' });
  }
  return holes;
}
function clock(o, c, p, u = 5.5, y = 10.4) {
  const R = 0.95,
    ring = Array.from({ length: c.round }, (_, i) => [
      u + R * Math.cos((i / c.round) * Math.PI * 2),
      y + R * Math.sin((i / c.round) * Math.PI * 2),
    ]);
  for (let i = 1; i < ring.length - 1; i++)
    T(
      o,
      c,
      [ring[0], ring[i], ring[i + 1]].map(([u, y]) => p([u, y, 0.06])),
      'clock',
      C.clock,
      sub(p([0, 0, 1]), p([0, 0, 0])),
    );
  if (c.detail) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'metal',
        p([u + 0.73 * Math.cos(t), y + 0.73 * Math.sin(t), 0.1]),
        p([u + 0.89 * Math.cos(t), y + 0.89 * Math.sin(t), 0.1]),
        0.055,
        0.06,
        C.metal,
      );
    }
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.13]),
      p([u - 0.53, y + 0.4, 0.13]),
      0.06,
      0.07,
      C.metal,
    );
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.14]),
      p([u + 0.18, y + 0.72, 0.14]),
      0.06,
      0.07,
      C.metal,
    );
  }
}
function mainHall(o, c) {
  for (let i = 0; i < mainPlan.length; i++) {
    const { p, L } = edge(mainPlan, i);
    let holes = [];
    if (i === 0) holes = frontGlass(c, L);
    else if (i === 5) {
      for (const u of [12, 16, 20, 24, 28]) {
        const y = u < 18 ? 2.2 : 4.9;
        holes.push({ ring: rect(u, y, 0.8, 11.25 - y), kind: 'glass' });
      }
      holes.push({ ring: rect(24, 0.35, 5.5, 3.7), kind: 'doorGlass' });
    } else if (L > 9) {
      const n = c.detail ? Math.max(3, Math.round(L / 6)) : 1;
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * L) / n,
          w = c.detail ? Math.min(3.5, L / n - 1) : L * 0.75;
        holes.push({ ring: rect(u, 1.2, w, 3.9), kind: 'glass' });
        holes.push({ ring: rect(u, 5.4, w, 3.4), kind: 'glass' });
      }
    }
    if (c.detail && i !== 5)
      for (let u = 3; u < L - 2; u += 6.2)
        holes.push({ ring: rect(u, 10.4, 0.25, 1.0), kind: 'metal' });
    wall(o, c, p, L, 0.35, 13, holes);
    if (i === 5) clock(o, c, p);
    if (c.detail) {
      beam(adapter(o, c), 'metal', p([0, 9.4, 0.06]), p([L, 9.4, 0.06]), 0.12, 0.14, C.metal);
      if (i === 0)
        beam(adapter(o, c), 'metal', p([0, 5.13, 0.055]), p([L, 5.13, 0.055]), 0.11, 0.13, C.metal);
    }
  }
  slab(o, c, mainPlan, 12.7, 13, 'roof');
  outlineBeam(o, c, mainPlan, 13.05, 0.12);
  if (c.detail) {
    const { p, L } = edge(mainPlan, 0);
    // Photo-led northeast entrance canopy: cantilevered from the hall, without an invented plaza floor.
    const start = Math.max(0, L - 17),
      A = p([start, 0, 0.02]),
      B = p([L, 0, 0.02]),
      C0 = p([L, 0, 1.6]),
      D = p([start, 0, 1.6]);
    slab(
      o,
      c,
      [A, B, C0, D].map((v) => [v[0], v[2]]),
      3.6,
      3.85,
      'concrete',
    );
    for (const u of [start + 0.5, (start + L) / 2, L - 0.5])
      beam(adapter(o, c), 'metal', p([u, 3.1, -0.15]), p([u, 3.65, 1.4]), 0.12, 0.14, C.metal);
  }
}
function connector(o, c) {
  slab(o, c, connectorPlan, 4.55, 4.9, 'concrete');
  outlineBeam(o, c, connectorPlan, 4.93, 0.1);
  for (const side of [1, 3]) {
    const { p, L } = edge(connectorPlan, side),
      n = c.detail ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const v = p([((i + 0.35) * L) / n, 0, -0.25]);
      box(o, c, v[0] - 0.17, v[0] + 0.17, 0.35, 4.6, v[2] - 0.17, v[2] + 0.17, 'concrete');
    }
  }
}
function lowRange(o, c, plan, lo, hi) {
  plan = openRing(plan);
  for (let i = 0; i < plan.length; i++) {
    const { p, L } = edge(plan, i),
      holes = [];
    if (L > 2.3) {
      const n = c.detail ? Math.max(1, Math.round(L / 3.8)) : 1;
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * L) / n,
          w = Math.min(c.detail ? 3.1 : L * 0.7, L / n - 0.3),
          bottom = lo < 1 ? 0.6 : lo + 0.4;
        holes.push({ ring: rect(u, bottom, w, hi - 0.5 - bottom), kind: 'doorGlass' });
      }
    }
    wall(o, c, p, L, lo, hi, holes, 'concrete');
  }
  slab(o, c, plan, hi - 0.2, hi, 'roof');
  outlineBeam(o, c, plan, hi + 0.035, 0.1);
}
function pavilion(o, c) {
  lowRange(o, c, nativePlans[143], 0.35, 5);
  lowRange(o, c, nativePlans[145], 0.35, 5);
  lowRange(o, c, nativePlans[146], 5, 8);
  // The mapped roof part is an open-sided portico, not an invented solid hall.
  const canopy = openRing(nativePlans[144]);
  slab(o, c, canopy, 4.7, 5, 'roof');
  outlineBeam(o, c, canopy, 5.04, 0.1);
  for (const i of c.detail ? [0, 3, 4, 6, 8, 10] : [0, 4, 8]) {
    const a = canopy[i % canopy.length];
    box(o, c, a[0] - 0.14, a[0] + 0.14, 0.35, 4.75, a[1] - 0.14, a[1] + 0.14, 'metal');
  }
}
function hood(o, c, x, z) {
  box(o, c, x - 0.28, x + 0.28, 13, 13.45, z - 0.28, z + 0.28, 'metal');
  const lower = [
      [x - 0.3, z - 0.3],
      [x + 0.3, z - 0.3],
      [x + 0.3, z + 0.3],
      [x - 0.3, z + 0.3],
    ],
    upper = [
      [x - 0.5, z - 0.5],
      [x + 0.5, z - 0.5],
      [x + 0.5, z + 0.5],
      [x - 0.5, z + 0.5],
    ];
  for (let i = 0; i < 4; i++)
    Q(
      o,
      c,
      [
        [lower[i][0], 13.45, lower[i][1]],
        [lower[(i + 1) % 4][0], 13.45, lower[(i + 1) % 4][1]],
        [upper[(i + 1) % 4][0], 13.9, upper[(i + 1) % 4][1]],
        [upper[i][0], 13.9, upper[i][1]],
      ],
      'metal',
      C.metal,
    );
  Q(
    o,
    c,
    upper.map(([x, z]) => [x, 13.9, z]),
    'metal',
    C.metal,
    [0, 1, 0],
  );
}
function services(o, c) {
  if (!c.detail) return;
  for (const x of [-25, -15, -5, 5, 15, 25]) hood(o, c, x, -5);
  box(o, c, -24, -20, 13, 14.2, 4, 6, 'metal');
  box(o, c, 18, 21, 13, 14.2, -12, -10, 'metal');
  box(o, c, 29.7, 30.15, 13, 15, -9.3, -8.85, 'metal');
  if (c.near)
    for (const x of [-23.6, -22.8, -22, -21.2])
      box(o, c, x, x + 0.2, 13.2, 13.95, 6, 6.1, 'concrete');
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Tallinn level ' + level);
  for (const plan of stationPlans) slab(o, c, plan, -3, 0.35);
  onStage?.('floors');
  mainHall(o, c);
  onStage?.('main');
  connector(o, c);
  onStage?.('connector');
  pavilion(o, c);
  onStage?.('pavilion');
  services(o, c);
  onStage?.('services');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

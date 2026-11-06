/** Original complete Barcelona Sants station and connected stepped hotel. */
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
  stone: lin('b8babc'),
  base: lin('8c9294'),
  roof: lin('9ca3a4'),
  metal: lin('87939a'),
  glass: lin('527482'),
  doorGlass: lin('4b626b'),
  mirror: lin('45728b'),
  dark: lin('555f65'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35 },
  doorGlass: { slot: 'window', graph: 'storefront', roughness: 0.4 },
  mirror: { slot: 'window', graph: 'window_grid', roughness: 0.24 },
  dark: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
};
const cfg = {
  skyline: {},
  district: { detail: true },
  street: { detail: true, recess: true, fine: true },
  closeup: { detail: true, recess: true, fine: true, near: true },
  master: { detail: true, recess: true, fine: true, near: true, master: true },
};
export const stationPlans = [
  [
    [-66.846368, 51.124266],
    [-67.755535, -30.567893],
    [-68.013615, -41.033129],
    [-69.407836, -43.807636],
    [-69.542518, -94.103895],
    [61.732712, -95.99422],
    [63.820388, 49.303739],
    [-66.846368, 51.124266],
  ],
];
export const nativePlans = {
  0: [
    [-52.103883, -24.903995],
    [52.025282, -24.728635],
    [52.05515, 24.851628],
    [-52.074287, 24.676051],
    [-52.103883, -24.903995],
  ],
  1: [
    [-69.056165, 53.541597],
    [-69.995387, -30.851129],
    [-70.261999, -41.662323],
    [-71.70231, -44.52855],
    [-71.841444, -96.487495],
    [63.773463, -98.44031],
    [65.930153, 51.660887],
    [-69.056165, 53.541597],
  ],
  8: [
    [65.930153, 51.660887],
    [63.710871, -94.766282],
    [81.276121, -94.521694],
    [84.594134, 58.796366],
    [81.270534, 59.012966],
    [81.279219, 63.316689],
    [78.410061, 63.322439],
    [78.434108, 57.898979],
    [75.425346, 58.07996],
    [75.354095, 57.450287],
    [71.852373, 56.092708],
    [65.37173, 52.361802],
    [65.930153, 51.660887],
  ],
  297: [
    [52.079213, 19.428181],
    [-7.543056, 19.477991],
    [-7.489123, 11.50026],
    [51.993515, 11.625659],
    [52.079213, 19.428181],
  ],
  298: [
    [-52.084776, 2.037863],
    [-52.069321, -7.689245],
    [19.973728, -7.869207],
    [19.993933, 2.172765],
    [-52.084776, 2.037863],
  ],
  299: [
    [51.993515, 11.625659],
    [-51.960621, 11.589746],
    [-52.084776, 2.037863],
    [52.184142, 2.038112],
    [51.993515, 11.625659],
  ],
  300: [
    [-52.074287, 24.676051],
    [-52.103883, -24.903995],
    [52.025282, -24.728635],
    [52.05515, 24.851628],
    [-52.074287, 24.676051],
  ],
};
export const hotelPolygons = [
  [
    [
      [-52.084776, 2.037863],
      [-52.069321, -7.689245],
      [19.973728, -7.869207],
      [19.99366191608568, 2.0380351273355983],
      [52.184142, 2.038112],
      [51.993515, 11.625659],
      [52.079213, 19.428181],
      [-7.543056, 19.477991],
      [-7.489831827829655, 11.605109308406893],
      [-51.960621, 11.589746],
      [-52.084776, 2.037863],
    ],
  ],
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
const FLOOR = 0.65,
  DECK = 8.5,
  PODIUM = 20,
  HOTEL = 41,
  FOOT = -6.3;
function railing(o, c, ring, y) {
  if (!c.detail) return;
  const r = openRing(ring);
  for (let i = 0; i < r.length; i++) {
    const e = edge(r, i);
    for (const h of [0.5, 1.05])
      beam(adapter(o, c), 'metal', e.p([0, y + h, 0]), e.p([e.L, y + h, 0]), 0.07, 0.07, C.metal);
    if (c.fine) {
      const n = Math.ceil(e.L / (c.near ? 2.8 : 7));
      for (let j = 0; j <= n; j++)
        beam(
          adapter(o, c),
          'metal',
          e.p([(j * e.L) / n, y, 0]),
          e.p([(j * e.L) / n, y + 1.1, 0]),
          0.075,
          0.075,
          C.metal,
        );
    }
  }
}
function concourse(o, c) {
  const r = openRing(stationPlans[0]);
  slab(o, c, r, FOOT, FLOOR, 'base');
  for (let i = 0; i < r.length; i++) {
    const e = edge(r, i),
      holes = [];
    if (e.L > 12) {
      const n = c.detail ? Math.max(3, Math.round(e.L / (c.near ? 3.4 : c.fine ? 10 : 12))) : 1,
        w = e.L / n;
      for (let j = 0; j < n; j++) {
        const u = (j + 0.5) * w,
          door = c.detail && j % 7 === 3;
        holes.push({
          ring: rect(u, door ? FLOOR : 1.1, w - 0.16, 3.55 - (door ? FLOOR : 1.1)),
          kind: door ? 'doorGlass' : 'glass',
        });
        holes.push({ ring: rect(u, 3.72, w - 0.16, 3.15), kind: 'glass' });
      }
    }
    wall(o, c, e.p, e.L, FLOOR, 7.1, holes, 'dark');
    if (c.detail) {
      for (let u = 2; u < e.L - 1; u += c.fine ? 10 : 24) {
        const p = e.p([u, 0, 1.35]);
        box(o, c, p[0] - 0.2, p[0] + 0.2, FOOT, 7.35, p[2] - 0.2, p[2] + 0.2, 'metal');
      }
    }
  }
  slab(o, c, nativePlans[1], 7.05, DECK, 'stone');
  slab(o, c, nativePlans[1], DECK, DECK + 0.08, 'roof');
  railing(o, c, nativePlans[1], DECK + 0.08);
  const canopy = openRing(nativePlans[8]);
  slab(o, c, canopy, 7.05, DECK, 'stone');
  slab(o, c, canopy, DECK, DECK + 0.08, 'roof');
  // This strip is a roof, never an artificial filled ground floor.
  for (const z of c.detail ? [-88, -68, -48, -28, -8, 12, 32, 52] : [-85, -20, 50]) {
    box(o, c, 80.6, 81.15, FOOT, 7.1, z - 0.28, z + 0.28, 'metal');
    if (c.fine) beam(adapter(o, c), 'metal', [65, 6.75, z], [81, 6.75, z], 0.22, 0.3, C.metal);
  }
  if (c.fine) {
    const r = openRing(nativePlans[1]);
    for (let i = 0; i < r.length; i++) {
      const e = edge(r, i);
      for (let u = 2; u < e.L; u += c.near ? 3 : 9)
        beam(
          adapter(o, c),
          'metal',
          e.p([u, 7.12, 0.025]),
          e.p([u, 8.4, 0.025]),
          0.035,
          0.05,
          C.metal,
        );
    }
  }
}
function stairs(o, c, x) {
  const z0 = -44,
    z1 = -26,
    lo = DECK + 0.08,
    hi = 14,
    steps = c.near ? 30 : c.fine ? 18 : 6;
  // A solid sloping stair flight with separately closed treads, two real stringers,
  // supported landing and rails. No floating decorative step stack.
  for (const dx of [-1.05, 1.05])
    beam(
      adapter(o, c),
      'metal',
      [x + dx, lo - 0.18, z0],
      [x + dx, hi - 0.18, z1],
      0.2,
      0.3,
      C.metal,
    );
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      y = lo + ((hi - lo) * (j + 1)) / steps,
      z = z0 + (z1 - z0) * t;
    box(o, c, x - 1.1, x + 1.1, y - 0.15, y, z, z + (z1 - z0) / steps + 0.025, 'metal');
  }
  box(o, c, x - 1.2, x + 1.2, hi - 0.2, hi, z1, -24.8, 'metal');
  for (const dx of [-1.1, 1.1]) {
    beam(adapter(o, c), 'metal', [x + dx, lo + 1, z0], [x + dx, hi + 1, z1], 0.07, 0.07, C.metal);
    beam(
      adapter(o, c),
      'metal',
      [x + dx, hi + 1, z1],
      [x + dx, hi + 1, -24.8],
      0.07,
      0.07,
      C.metal,
    );
    box(o, c, x + dx - 0.075, x + dx + 0.075, DECK, hi, z1 - 0.075, z1 + 0.075, 'metal');
    if (c.fine)
      for (let j = 0; j <= 6; j++) {
        const t = j / 6,
          z = z0 + (z1 - z0) * t,
          y = lo + (hi - lo) * t;
        beam(adapter(o, c), 'metal', [x + dx, y, z], [x + dx, y + 1, z], 0.055, 0.055, C.metal);
      }
  }
}
function podium(o, c) {
  const r = openRing(nativePlans[300]);
  for (let i = 0; i < r.length; i++) {
    const e = edge(r, i),
      holes = [],
      n = c.detail ? Math.max(2, Math.floor(e.L / 9)) : 1;
    for (let j = 0; j < n; j++)
      holes.push({
        ring: rect(((j + 0.5) * e.L) / n, 13.1, c.detail ? 2.8 : e.L * 0.6, 2.2),
        kind: 'glass',
      });
    // Three stair doors along the northeastern podium facade.
    if (e.N[2] < -0.95 && c.detail) {
      for (const x of [-32, 0, 32]) {
        const u = (e.b[0] - x) / ((e.b[0] - e.a[0]) / e.L);
        holes.splice(
          0,
          holes.length,
          ...holes.filter((h) => Math.abs(h.ring[0][0] + 1.4 - u) > 3.2),
        );
        holes.push({ ring: rect(u, 14, 1.55, 2.35), kind: 'doorGlass' });
      }
    }
    wall(o, c, e.p, e.L, DECK + 0.08, PODIUM, holes);
    if (c.fine) {
      for (let y = 10; y < 20; y += c.near ? 1.2 : 3.6)
        beam(
          adapter(o, c),
          'metal',
          e.p([0, y, 0.012]),
          e.p([e.L, y, 0.012]),
          0.025,
          0.03,
          C.metal,
        );
    }
  }
  slab(o, c, r, 19.72, 20.04, 'roof');
  railing(o, c, r, 20.05);
  if (c.detail) for (const x of [-32, 0, 32]) stairs(o, c, x);
}
function hotel(o, c) {
  for (const poly of hotelPolygons) {
    const r = openRing(poly[0]);
    for (let i = 0; i < r.length; i++) {
      const e = edge(r, i);
      if (e.L < 0.1) continue;
      const holes = [],
        mirror = e.N[0] < -0.95 && e.a[0] < -50 && e.b[0] < -50;
      const rows = c.detail ? 7 : 1,
        cols = c.detail ? Math.max(1, Math.round(e.L / (c.near ? 3.2 : c.fine ? 8 : 10))) : 1,
        w = e.L / cols;
      for (let row = 0; row < rows; row++)
        for (let j = 0; j < cols; j++) {
          const y = 20.5 + row * (20 / rows),
            h = 20 / rows - (mirror ? 0.08 : 0.62),
            ww = w - (mirror ? 0.08 : c.detail ? 0.64 : 0.7);
          if (ww > 0.12)
            holes.push({ ring: rect((j + 0.5) * w, y, ww, h), kind: mirror ? 'mirror' : 'glass' });
        }
      wall(o, c, e.p, e.L, PODIUM, HOTEL, holes);
      if (c.master) {
        for (let y = 21; y < 41; y += 1.42)
          beam(
            adapter(o, c),
            'metal',
            e.p([0, y, 0.018]),
            e.p([e.L, y, 0.018]),
            0.018,
            0.025,
            C.metal,
          );
      }
    }
    slab(o, c, r, 40.7, HOTEL, 'roof');
    outlineBeam(o, c, r, 41.12, 0.2, 'metal');
  }
  const services = [
    [-32, -2, 8, 4],
    [-5, 6, 10, 5],
    [24, 7, 9, 5],
    [39, 15, 7, 3.5],
  ];
  for (const [x, z, w, d] of services) {
    box(o, c, x - w / 2, x + w / 2, 41, 43, z - d / 2, z + d / 2, 'stone');
    box(
      o,
      c,
      x - w / 2 - 0.1,
      x + w / 2 + 0.1,
      43,
      43.15,
      z - d / 2 - 0.1,
      z + d / 2 + 0.1,
      'roof',
    );
    if (c.fine) {
      for (let j = 0; j < (c.near ? 9 : 3); j++) {
        const y = 41.35 + j * (1.3 / (c.near ? 9 : 3));
        box(
          o,
          c,
          x - w * 0.4,
          x + w * 0.4,
          y,
          y + 0.06,
          z - d / 2 - 0.025,
          z - d / 2 + 0.025,
          'metal',
        );
      }
    }
  }
  if (c.near) {
    for (const [x, z] of [
      [-41, 5],
      [9, 6],
      [42, 15],
    ]) {
      box(o, c, x - 0.3, x + 0.3, 41, 43.5, z - 0.3, z + 0.3, 'metal');
    }
  }
}
export function buildStationLevel(o, level = 'master', mark = () => {}) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Barcelona Sants tier ' + level);
  concourse(o, c);
  mark('concourse-and-open-canopy');
  podium(o, c);
  mark('podium-terraces-stairs');
  hotel(o, c);
  mark('connected-stepped-hotel');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

/** Gariep Dam in the retained signed map frame. Dimensions are in meters. */
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
  stone: lin('a1988b'),
  wall: lin('b6ac9e'),
  base: lin('a2a495'),
  gravel: lin('8d7e6a'),
  roof: lin('b9bab0'),
  metal: lin('a0a093'),
  dark: lin('565e60'),
  glass: lin('526d76'),
  paving: lin('95968c'),
  trim: lin('dfdbcb'),
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  trim: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.74 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.8 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.43 },
};

const cfg = {
  skyline: { step: 100, divisions: 3, round: 5 },
  district: { step: 35, divisions: 5, round: 8, detail: true },
  street: { step: 15, divisions: 8, round: 12, detail: true, fine: true },
  closeup: { step: 7, divisions: 12, round: 20, detail: true, fine: true, near: true },
  master: {
    step: 1.8,
    divisions: 32,
    round: 36,
    detail: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const controls = {
  anchor: [25.505942247, -30.624113651],
  heading: -1.242090458781,
  datum: 1260.965851,
  referenceLocal: [0, -280],
  outline: [
    [326.236, 91.045],
    [338.133, 104.303],
    [325.354, 118.527],
    [305.933, 105.81],
    [294.316, 98.801],
    [272.069, 86.334],
    [251.907, 74.893],
    [235.623, 69.946],
    [220.98, 78.048],
    [192.13, 50.112],
    [182.492, 40.782],
    [172.706, 31.3],
    [136.482, -3.777],
    [143.962, -17.672],
    [64.35, -68.956],
    [61.544, -70.763],
    [38.922, -82.132],
    [13.521, -87.143],
    [-12.723, -88.786],
    [-33.336, -87.285],
    [-44.654, -85.103],
    [-58.439, -82.447],
    [-79.639, -76.57],
    [-107.513, -67.191],
    [-132.011, -57.886],
    [-147.029, -49.375],
    [-165.238, -39.057],
    [-223.71, 18.062],
    [-214.475, 27.608],
    [-237.509, 52.14],
    [-249.798, 65.236],
    [-259.607, 75.685],
    [-267.11, 83.683],
    [-278.4, 74.022],
    [-305.659, 100.908],
    [-331.698, 118.524],
    [-338.132, 91.664],
    [-317.646, 65.808],
    [-330.249, 56.621],
    [-256.648, -23.061],
    [-247.193, -16.576],
    [-220.597, -43.618],
    [-202.53, -58.76],
    [-163.297, -80.267],
    [-124.99, -97.059],
    [-85.737, -110.279],
    [-70.773, -113.839],
    [-62.991, -115.689],
    [-50.748, -117.342],
    [-21.575, -118.526],
    [22.813, -113.041],
    [47.015, -107.894],
    [71.421, -100.653],
    [73.684, -104.496],
    [75.738, -108.137],
    [78.697, -107.675],
    [81.171, -106.962],
    [82.101, -100.137],
    [81.347, -96.72],
    [137.104, -69.565],
    [175.417, -46.994],
    [184.436, -58.715],
    [204.939, -45.203],
    [227.095, -29.367],
    [244.715, -16.161],
    [240.747, -12.495],
    [268.642, 12.758],
    [258.948, 22.903],
  ],
  crest: [
    [-358.43574, 124.91987],
    [-335.87047, 104.92622],
    [-271.83216, 33.3818],
    [-243.19683, 5.14256],
    [-216.71809, -16.77396],
    [-187.15525, -38.1815],
    [-139.00868, -67.91004],
    [-93.36186, -88.71817],
    [-63.5578, -98.09864],
    [-32.31729, -103.7315],
    [-1.59712, -104.65533],
    [13.66869, -103.24909],
    [44.34354, -97.67303],
    [81.80476, -86.52461],
    [126.8478, -67.36073],
    [159.54318, -48.60778],
    [183.48402, -32.84081],
    [208.86125, -13.32625],
    [251.6566, 25.15996],
    [335.19932, 116.09337],
  ],
  crestLength: 851.6845801133315,
  hall: [
    [124, 218],
    [164, 221],
    [172, 252],
    [163, 278],
    [123, 277],
    [119, 248],
    [124, 218],
  ],
  portalApron: [
    [92, 223],
    [124, 218],
    [119, 248],
    [123, 277],
    [87, 265],
    [92, 223],
  ],
  sideOutlet: [
    [-164, 4],
    [-142, 0],
    [-133, 33],
    [-151, 42],
    [-169, 34],
    [-164, 4],
  ],
  pairedOutlet: [
    [86, -4],
    [111, 9],
    [110, 37],
    [85, 37],
    [86, -4],
  ],
  runs: [
    {
      start: [141, -20],
      end: [129, 221],
      width: 6.8,
    },
    {
      start: [154, -10],
      end: [143, 221],
      width: 6.8,
    },
  ],
  archSpan: [-148, 70],
  bays: 15,
  deck: 10,
  westTieHeight: 3,
  base: -78,
  tailwater: -57,
  hallFloor: -45,
  scope:
    'Curved concrete arch, both solid gravity wings, fifteen visually interpreted spillway openings, continuous mapped crest deck, stepped side outlet, paired low round outlets, and the separate hydroelectric bank with two covered runs, raised powerhouse, and lower outlet portals.',
  interpretation:
    'The exact-Q dam outline and current crest bridge establish horizontal shape and facing. The named powerhouse location and two ordinary photographs control the approximate extent and features of the industrial bank. The retained 88 m height and 914 m length are distinct from the visible arch profile and sampled crest trace. One standard reservoir reference supplies the datum. Crest, sill, foundation, floor and tailwater levels are approximate.',
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
function wall(o, c, p, L, lo, hi, holes = [], surface = 'stone') {
  const outer = rect(L / 2, lo, L, hi - lo),
    active = holes.filter((h) => c.recess || h.kind === 'opening'),
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
    if (h.kind === 'opening') continue;
    const depth = c.recess ? (h.depth ?? 0.2) : -0.02,
      r = h.ring,
      frameSurface = h.kind === 'blind' ? 'stone' : 'metal';
    if (c.recess)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        Q(
          o,
          c,
          [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])],
          frameSurface,
          C[frameSurface],
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
    if (c.master)
      beamPath(
        adapter(o, c),
        frameSurface,
        r.map(([u, y]) => p([u, y, 0.035])),
        c.near ? 0.09 : 0.065,
        0.12,
        C[frameSurface],
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
          frameSurface,
          p([Math.min(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          p([Math.max(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          0.065,
          0.075,
          C[frameSurface],
        );
      if (h.kind === 'doorGlass')
        beam(
          adapter(o, c),
          frameSurface,
          p([u, lo, -depth + 0.04]),
          p([u, hi, -depth + 0.04]),
          0.08,
          0.09,
          C[frameSurface],
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
const FLOOR = 0.65,
  FOOT = -10;
function simplify(r, t = 0.3) {
  r = openRing(r).map((p) => [...p]);
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L && Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L < t) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function panel(o, c, poly, y, s, N = [0, 1, 0]) {
  const rs = poly.map((r) => (c === cfg.skyline ? simplify(r) : openRing(r))),
    a = rs.flat(),
    holes = rs.slice(1).map((_, i) => rs.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(a.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [a[j][0], typeof y === 'function' ? y(a[j]) : y, a[j][1]]),
      s,
      C[s],
      N,
    );
}
function solid(o, c, poly, lo, hi, s) {
  panel(o, c, poly, hi, s);
  panel(o, c, poly, lo, s, [0, -1, 0]);
  for (let j = 0; j < poly.length; j++) {
    const r = c === cfg.skyline ? simplify(poly[j]) : openRing(poly[j]);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      Q(
        o,
        c,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        s,
        C[s],
        [b[1] - a[1], 0, a[0] - b[0]].map((v) => (j ? -v : v)),
      );
    }
  }
}
function ringEdges(poly, fn) {
  for (let k = 0; k < poly.length; k++) {
    let r = openRing(poly[k]);
    const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0);
    if (area < 0) r = [...r].reverse();
    for (let j = 0; j < r.length; j++) {
      let e = edge(r, j);
      if (k) {
        const p = e.p;
        e = { ...e, N: e.N.map((v) => -v), p: ([u, y, d]) => p([u, y, -d]) };
      }
      fn(e, k);
    }
  }
}
const { outline, crest, archSpan, bays, deck, base, hallFloor } = controls;
const lerp = (a, b, t) => a + (b - a) * t;
const pt = ([x, z], y) => [x, y, z];

function interval(x) {
  const hits = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
    if (a[0] === b[0]) hits.push(a[1], b[1]);
    else hits.push(lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
  }
  if (!hits.length) throw Error('No dam cross section at ' + x);
  return [Math.min(...hits), Math.max(...hits)];
}
function roadZ(x) {
  const i = crest.findIndex((p) => p[0] >= x);
  if (i <= 0) return crest[i === 0 ? 0 : crest.length - 1][1];
  const a = crest[i - 1],
    b = crest[i];
  return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}
function xSamples(a, b, step) {
  const result = new Set([a, b, ...outline.map((p) => p[0]).filter((x) => x > a && x < b)]);
  for (let x = a + step; x < b; x += step) result.add(x);
  return [...result].sort((a, b) => a - b);
}
function polygonSection(x, profile) {
  const [back, front] = interval(x);
  return profile.map(([depth, y]) => [x, y, lerp(back, front, depth)]);
}

function archBody(o, c) {
  // The downstream face of the arch follows a smooth ogee into the foundation.
  const [a, b] = archSpan,
    xs = xSamples(a, b, c.step);
  const profile = [
    [0, base],
    [0, -6],
    [0.17, -6],
  ];
  for (let i = 1; i <= c.divisions; i++) {
    const t = i / c.divisions;
    profile.push([0.17 + 0.83 * t, -6 - 67 * (t * t * (3 - 2 * t))]);
  }
  profile.push([1, base]);
  const rows = xs.map((x) => polygonSection(x, profile));
  for (let i = 1; i < rows.length; i++)
    for (let k = 1; k < profile.length; k++) {
      const s = k === 2 ? 'base' : 'wall',
        normal = k === 1 ? [0, 0, -1] : k === 2 ? [0, 1, 0] : [0, 0, 1];
      const tint = c.master && k > 2 && k < profile.length - 1 && k % 8 === 1 ? C.stone : C[s];
      Q(o, c, [rows[i - 1][k - 1], rows[i][k - 1], rows[i][k], rows[i - 1][k]], s, tint, normal);
    }
}

function wing(o, c, boundary, direction) {
  const ring = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const insideA = direction * (a[0] - boundary) >= 0,
      insideB = direction * (b[0] - boundary) >= 0;
    if (insideA) ring.push(a);
    if (insideA !== insideB)
      ring.push([boundary, lerp(a[1], b[1], (boundary - a[0]) / (b[0] - a[0]))]);
  }
  solid(o, c, [ring], base, 8.15, 'wall');
}

function crestBridge(o, c) {
  const width = 9.5;
  const stations = crest.map(([x, z], i) => {
    const a = crest[Math.max(i - 1, 0)],
      b = crest[Math.min(i + 1, crest.length - 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    const y = i === 0 ? controls.westTieHeight : deck;
    return [-1, 1].map((k) => [
      x - (((k * dz) / L) * width) / 2,
      y,
      z + (((k * dx) / L) * width) / 2,
    ]);
  });
  const offset = ([x, y, z], dy) => [x, y + dy, z];
  for (let i = 1; i < stations.length; i++) {
    const [a, b] = stations.slice(i - 1, i + 1);
    Q(o, c, [a[0], b[0], b[1], a[1]], 'paving', C.paving, [0, 1, 0]);
    Q(
      o,
      c,
      [offset(a[0], -2), offset(b[0], -2), offset(b[1], -2), offset(a[1], -2)],
      'base',
      C.base,
      [0, -1, 0],
    );
    for (let j = 0; j < 2; j++) {
      Q(o, c, [offset(a[j], -2), offset(b[j], -2), b[j], a[j]], 'base', C.base, [0, 0, j ? 1 : -1]);
      if (c.fine)
        beam(adapter(o, c), 'dark', offset(a[j], 1.12), offset(b[j], 1.12), 0.14, 0.14, C.dark);
      if (c.near) {
        const length = Math.hypot(...a[j].map((v, h) => v - b[j][h]));
        const n = Math.ceil(length / (c.master ? 3 : 7));
        for (let k = 0; k < n; k++) {
          const p = a[j].map((v, h) => lerp(v, b[j][h], k / n));
          beam(adapter(o, c), 'dark', p, offset(p, 1.2), 0.12, 0.12, C.dark);
        }
      }
    }
  }
}

function spillway(o, c) {
  const [a, b] = archSpan,
    step = (b - a) / bays;
  for (let i = 0; i <= bays; i++) {
    const x = a + i * step,
      z = roadZ(x),
      width = i === 0 || i === bays ? 3.5 : 1.8;
    // The supports stop at the soffit and leave the lane and all bay openings clear.
    box(o, c, x - width, x + width, -12, 8, z - 5.1, z + 5.5, 'wall');
    if (c.detail) box(o, c, x - width - 0.3, x + width + 0.3, 6.2, 8, z - 5.5, z + 5.8, 'base');
  }
  for (let i = 0; i < bays; i++) {
    const x = a + i * step,
      l = x + 1.8,
      r = x + step - 1.8;
    const z0 = roadZ(l) - 2.5,
      z1 = roadZ(r) - 2.5;
    const s = c === cfg.skyline ? 'base' : 'dark';
    Q(
      o,
      c,
      [
        [l, -7, z0],
        [r, -7, z1],
        [r, -3, z1],
        [l, -3, z0],
      ],
      s,
      C[s],
      [0, 0, 1],
    );
    if (c.detail) {
      for (const k of [0.2, 0.5, 0.8]) {
        const t = lerp(l, r, k),
          z = lerp(z0, z1, k);
        beam(adapter(o, c), 'base', [t, -7, z + 0.18], [t, -3, z + 0.18], 0.45, 0.45, C.base);
      }
    }
  }
}

function controlCabin(o, c) {
  const x = 190,
    z = roadZ(x) - 11;
  box(o, c, x - 6, x + 6, 8.15, 14, z - 4.2, z + 4.2, 'wall');
  if (c.detail) {
    const a = x - 4.6,
      b = x + 4.6,
      k = z + 4.22;
    Q(
      o,
      c,
      [
        [a, 10, k],
        [b, 10, k],
        [b, 13, k],
        [a, 13, k],
      ],
      'glass',
      C.glass,
      [0, 0, 1],
    );
    box(o, c, x - 6.3, x + 6.3, 14, 14.4, z - 4.5, z + 4.5, 'roof');
  }
}

function circularRing(u, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return [u + r * Math.cos(a), y + r * Math.sin(a)];
  });
}
function hydraulicHall(o, c) {
  const roof = hallFloor + 14;
  panel(o, c, [controls.hall], roof + 0.45, 'roof');
  panel(o, c, [controls.hall], -66, 'base', [0, -1, 0]);
  ringEdges([controls.hall], (e) => {
    const face = e.N[0] < -0.5 && e.L > 18;
    const openingWidth = Math.min(e.L / 4, 8),
      upper = [];
    if (face || (c.detail && e.L > 22)) {
      const count = face ? 3 : 2;
      for (let i = 0; i < count; i++) {
        upper.push({
          ring: rect(((i + 0.5) * e.L) / count, hallFloor + 8, Math.min(e.L / count - 1.4, 10), 7),
          kind: 'glass',
          depth: 0.55,
        });
      }
    }
    const lower = face
      ? Array.from({ length: 3 }, (_, i) => ({
          ring: rect(((i + 0.5) * e.L) / 3, -54, openingWidth, 7),
          kind: 'opening',
        }))
      : [];
    wall(o, c, e.p, e.L, hallFloor, roof, upper, 'wall');
    wall(o, c, e.p, e.L, -66, hallFloor, lower, 'base');
    if (c.detail) {
      beam(
        adapter(o, c),
        'wall',
        e.p([0, roof + 0.24, 0.1]),
        e.p([e.L, roof + 0.24, 0.1]),
        0.42,
        0.58,
        C.wall,
      );
      beam(
        adapter(o, c),
        'base',
        e.p([0, hallFloor + 0.55, 0.12]),
        e.p([e.L, hallFloor + 0.55, 0.12]),
        0.38,
        0.75,
        C.base,
      );
    }
  });
  solid(o, c, [controls.portalApron], -66, -53, 'base');
  for (const run of controls.runs) {
    const from = pt(run.start, -4),
      to = pt(run.end, hallFloor + 3);
    beam(adapter(o, c), 'wall', from, to, run.width, 4.5, C.wall);
    if (c.detail)
      beam(
        adapter(o, c),
        'roof',
        [from[0], from[1] + 2.4, from[2]],
        [to[0], to[1] + 2.4, to[2]],
        run.width + 0.25,
        0.45,
        C.roof,
      );
    if (c.fine)
      for (let t = 0.16; t < 0.95; t += 0.15) {
        const p = from.map((v, i) => lerp(v, to[i], t));
        beam(adapter(o, c), 'base', [p[0], -58, p[2]], p, 3.3, 3.3, C.base);
      }
  }
}

function sideOutlet(o, c) {
  const left = controls.sideOutlet;
  solid(o, c, [left], -69, -53, 'base');
  const platform = [
    [-164, 4],
    [-142, 0],
    [-136, 19],
    [-160, 25],
    [-164, 4],
  ];
  solid(o, c, [platform], -53, -47, 'wall');
  const right = controls.pairedOutlet;
  panel(o, c, [right], -44, 'paving');
  ringEdges([right], (e) => {
    const apertures =
      e.N[2] > 0.8 && e.L > 20
        ? [0.3, 0.7].map((t) => ({
            ring: circularRing(e.L * t, -50, 2.8, c.round),
            kind: 'opening',
          }))
        : [];
    wall(o, c, e.p, e.L, -67, -44, apertures, 'wall');
  });
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Gariep Dam level ' + level);
  archBody(o, c);
  wing(o, c, archSpan[0], -1);
  wing(o, c, archSpan[1], 1);
  crestBridge(o, c);
  spillway(o, c);
  controlCabin(o, c);
  hydraulicHall(o, c);
  sideOutlet(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

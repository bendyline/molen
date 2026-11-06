/** Original Chicago Union Station headhouse, recessed Great Hall skylight and open porticoes. */
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
  stone: lin('c6bca5'),
  wall: lin('c6bca5'),
  trim: lin('d6cdb9'),
  base: lin('a6a69c'),
  roof: lin('9b9f97'),
  metal: lin('53645c'),
  glass: lin('658281'),
  doorGlass: lin('536b67'),
  clock: lin('485a53'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  trim: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.78 },
  clock: { slot: 'door', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.43 },
  doorGlass: { slot: 'window', graph: 'window_grid', roughness: 0.43 },
};
const cfg = {
  skyline: { round: 4, pitch: 30, roofSteps: 4 },
  district: { round: 5, pitch: 9, roofSteps: 6, detail: true },
  street: { round: 8, pitch: 6, roofSteps: 10, detail: true, recess: true, fine: true },
  closeup: {
    round: 14,
    pitch: 4.6,
    roofSteps: 20,
    detail: true,
    recess: true,
    fine: true,
    near: true,
  },
  master: {
    round: 32,
    pitch: 4.6,
    roofSteps: 40,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const controls = {
  anchor: [-87.640405599, 41.878665607],
  heading: -1.550562935269,
  groups: {
    main: [
      [
        [
          [-58.142177, 46.531239],
          [-58.053699, -45.745492],
          [57.81029, -46.513861],
          [58.085037, -5.149735],
          [57.712845, 46.207404],
          [-58.142177, 46.531239],
        ],
      ],
    ],
    canalArcade: [
      [
        [
          [-58.141029, -52.417996],
          [57.722956, -53.186365],
          [57.81029, -46.513861],
          [-58.053699, -45.745492],
          [-58.141029, -52.417996],
        ],
      ],
    ],
  },
  ownedParts: [44, 58],
  preservedNeighbors: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 45, 46, 47, 48, 49, 50,
    51, 52, 53, 54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
    76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
    119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137,
    138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156,
    157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
    176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194,
    195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,
    214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232,
    233, 234,
  ],
  referenceLocal: [66, -55],
  scope:
    'Whole individual above-ground Chicago Union Station historic headhouse and physically attached mapped Canal Street arcade/canopy. Preserve the separate underground concourse east of Canal, independent modern offices, public roads and surrounding buildings. Author all four exterior fronts and the actual roof/service masses after resolving the roof layout; no invented extra station platforms, copied lettering, advertising, people, trains or navigable interiors.',
  interpretation:
    'Retained exact-Q way/203442440 identifies Q1155989. The long axis is N/S: signed +X south toward Jackson Boulevard; -X north toward Adams Street; +Z west toward Clinton; -Z east toward Canal Street. Current PMTiles supplies the whole main building35184575531272 with height26m and attached long Canal strip35184815348058,layer1. The two ordinary street photographs show the Canal lower pilaster/door front and Jackson round-column colonnade, heavy entablature/friezes, arched corner entries, corner clocks, upper repeated rectangular windows/pilasters, narrow attic windows and a stepped rooftop service block. They do not establish the complete hidden roof/courtyard inventory; resolve that with an ordinary roof picture or available map geometry before authoring. Retained8levels and current native26m envelope are source controls, not surveyed facade/tower levels. Two additional ordinary rooftop photographs were inspected: a segmental barrel-vaulted Great Hall skylight is recessed inside four surrounding office wings. Model roof court x+-35,z+-25 and glass x+-33,z+-15 are picture-scale interpretations; hidden services and exact measured dimensions remain unverified. Use estimated exterior parapet35.2m,penthouse39m,skylight eaves21.5m/crest28.5m; native26m remains a conflicting coarse map control. One unchanged outside Jackson/Canal street reference[66,-55],179.7933694m absolute,sets Y=0. No bespoke surveys or archival research.',
  nativeFacts: [
    { index: 44, id: 35184575531272, properties: { sort_rank: 400, kind: 'building', height: 26 } },
    { index: 58, id: 35184815348058, properties: { sort_rank: 400, kind: 'building', layer: 1 } },
  ],
  groundFloors: [
    [
      [
        [-58.142177, 46.531239],
        [-58.053699, -45.745492],
        [57.81029, -46.513861],
        [58.085037, -5.149735],
        [57.712845, 46.207404],
        [-58.142177, 46.531239],
      ],
    ],
  ],
  datum: 179.7933694,
  floor: 0.65,
  sourceHeights: {
    nativeEnvelope: 26,
    retainedLevels: 8,
    estimatedEntablature: 14.8,
    estimatedCornice: 34.4,
    estimatedParapet: 35.2,
    estimatedPenthouse: 39,
    estimatedSkylightEaves: 21.5,
    estimatedSkylightCrest: 28.5,
  },
};
export const stationPlans = controls.groundFloors.map((p) => p[0]);
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
function arch(u, y, w, straight, rise, n) {
  const r = [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + straight],
  ];
  for (let j = 1; j <= n; j++) {
    const a = (j / n) * Math.PI;
    r.push([u + (w / 2) * Math.cos(a), y + straight + rise * Math.sin(a)]);
  }
  return r;
}
function band(o, c, e, y, h = 0.2, s = 'stone', d = 0.08) {
  Q(
    o,
    c,
    [e.p([0, y, d]), e.p([e.L, y, d]), e.p([e.L, y + h, d]), e.p([0, y + h, d])],
    s,
    C[s],
    e.N,
  );
}
function roundColumn(o, c, center, y0, y1, r, s = 'stone') {
  const [x, z] = center,
    n = c === cfg.skyline ? 4 : c.round;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2,
      b = ((j + 1) / n) * Math.PI * 2;
    Q(
      o,
      c,
      [
        [x + r * Math.cos(a), y0, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y0, z + r * Math.sin(b)],
        [x + r * Math.cos(b), y1, z + r * Math.sin(b)],
        [x + r * Math.cos(a), y1, z + r * Math.sin(a)],
      ],
      s,
      C[s],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
  if (c.fine) {
    box(o, c, x - r * 1.7, x + r * 1.7, y0 - 0.25, y0 + 0.2, z - r * 1.4, z + r * 1.4, s);
    box(o, c, x - r * 1.5, x + r * 1.5, y1 - 0.1, y1 + 0.35, z - r * 1.5, z + r * 1.5, s);
  }
}
function archBand(o, c, p, u, spring, R0, R1, s = 'stone', d = 0.1, n = c.round) {
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI,
      b = ((j + 1) / n) * Math.PI;
    Q(
      o,
      c,
      [
        p([u + R0 * Math.cos(a), spring + R0 * Math.sin(a), d]),
        p([u + R0 * Math.cos(b), spring + R0 * Math.sin(b), d]),
        p([u + R1 * Math.cos(b), spring + R1 * Math.sin(b), d]),
        p([u + R1 * Math.cos(a), spring + R1 * Math.sin(a), d]),
      ],
      s,
      C[s],
      sub(p([0, 0, 1]), p([0, 0, 0])),
    );
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
const outer = [
    [-58, -46.1],
    [58, -46.1],
    [58, 46.3],
    [-58, 46.3],
  ],
  court = [
    [-35, -25],
    [35, -25],
    [35, 25],
    [-35, 25],
  ];
function basis(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    N = [U[1], -U[0]];
  return {
    L,
    p: ([u, y, d]) => [a[0] + u * U[0] + d * N[0], y, a[1] + u * U[1] + d * N[1]],
    N: [N[0], 0, N[1]],
  };
}
function facade(o, c, a, b, kind) {
  const { L, p, N } = basis(a, b),
    n = Math.round((L - 12) / c.pitch),
    pitch = (L - 12) / n,
    holes = [];
  if (c.detail)
    for (let j = 0; j < n; j++) {
      const u = 6 + (j + 0.5) * pitch;
      for (const y of [19.4, 23.4, 27.4])
        holes.push({ kind: 'glass', ring: rect(u, y, pitch * 0.56, 3.25) });
      holes.push({ kind: 'glass', ring: rect(u, 32.2, pitch * 0.52, 1.25) });
      holes.push({ kind: 'glass', ring: arch(u, 15.9, pitch * 0.56, 1.7, 0.6, c.round) });
    }
  wall(o, c, p, L, 14.8, 35.2, holes);
  // Recessed lower walls remain behind real open colonnades, not opaque fills at their fronts.
  const lower = p([0, 0, kind === 'canal' ? 0 : kind === 'end' ? -6 : -1]);
  const pd = ([u, y, d]) => p([u, y, d + (kind === 'end' ? -6 : kind === 'canal' ? 0 : -1)]),
    entries = [];
  if (c.detail)
    for (let j = 0; j < n; j++) {
      const u = 6 + (j + 0.5) * pitch;
      entries.push({ kind: 'doorGlass', ring: rect(u, 0.65, pitch * 0.55, 5.3), depth: 0.3 });
      entries.push({ kind: 'glass', ring: rect(u, 10.4, pitch * 0.56, 2.2), depth: 0.25 });
    }
  wall(
    o,
    c,
    ([u, y, d]) => pd([u + 6, y, d]),
    L - 12,
    0.65,
    13.3,
    entries.map((h) => ({ ...h, ring: h.ring.map(([u, y]) => [u - 6, y]) })),
  );
  const depth = kind === 'canal' ? 6.8 : kind === 'end' ? 0 : 0.2;
  const bandPlan = [p([0, 0, depth]), p([L, 0, depth]), p([L, 0, -1]), p([0, 0, -1])].map((q) => [
    q[0],
    q[2],
  ]);
  slab(o, c, bandPlan, 13.0, 14.8, 'stone');
  for (const [y, h, w] of [
    [14.55, 0.35, 0.4],
    [18.7, 0.4, 0.24],
    [31.7, 0.35, 0.35],
    [34.3, 0.35, 0.45],
  ]) {
    const r = [p([0, 0, 0.2 + w]), p([L, 0, 0.2 + w]), p([L, 0, -0.2]), p([0, 0, -0.2])];
    slab(
      o,
      c,
      r.map((q) => [q[0], q[2]]),
      y,
      y + h,
      'trim',
    );
  }
  // Monumental corner piers with arched doors on both street faces.
  for (const u of [3, L - 3]) {
    const pc = ([v, y, d]) => p([v + u - 3, y, d]);
    wall(
      o,
      c,
      pc,
      6,
      0.65,
      13.3,
      c.detail
        ? [{ kind: 'doorGlass', ring: arch(3, 0.65, 2.9, 5.8, 1.45, c.round), depth: 0.5 }]
        : [],
    );
    if (c.detail) clock(o, c, p, u, 11.8);
  }
  const count = c === cfg.skyline ? (kind === 'canal' ? 14 : 10) : Math.round((L - 14) / 5.2);
  for (let j = 0; j <= count; j++) {
    const u = 7 + (j * (L - 14)) / count,
      depth = kind === 'canal' ? 5.8 : kind === 'end' ? -1 : 0.4,
      q = p([u, 0, depth]);
    if (kind === 'end') roundColumn(o, c, [q[0], q[2]], 0.65, 12.85, 0.86);
    else {
      const r = [
        p([u - 0.48, 0, depth + 0.5]),
        p([u + 0.48, 0, depth + 0.5]),
        p([u + 0.48, 0, depth - 0.5]),
        p([u - 0.48, 0, depth - 0.5]),
      ];
      slab(
        o,
        c,
        r.map((q) => [q[0], q[2]]),
        0.65,
        13,
        'stone',
      );
    }
  }
  if (c.fine)
    for (let j = 0; j < n; j++) {
      const u = 6 + (j + 0.5) * pitch;
      for (const y of [19.1, 23.1, 27.1])
        beam(
          adapter(o, c),
          'trim',
          p([u - pitch * 0.31, y, 0.08]),
          p([u + pitch * 0.31, y, 0.08]),
          0.12,
          0.16,
          C.trim,
        );
      if (c.near) {
        beam(
          adapter(o, c),
          'stone',
          p([u - pitch * 0.43, 19.0, 0.15]),
          p([u - pitch * 0.43, 31.5, 0.15]),
          0.32,
          0.25,
          C.stone,
        );
        for (const y of [22.8, 26.8, 30.8]) {
          const r = [
            p([u - pitch * 0.29, y, 0.08]),
            p([u + pitch * 0.29, y, 0.08]),
            p([u + pitch * 0.29, y + 0.3, 0.08]),
            p([u - pitch * 0.29, y + 0.3, 0.08]),
          ];
          Q(o, c, r, 'trim', C.trim, N);
        }
      }
    }
  if (c.master) {
    for (let u = 2; u < L - 2; u += 0.65)
      boxLocal(o, c, p, u, 14.45, depth + 0.02, 0.22, 0.18, 0.25, 'trim');
    for (let u = 2; u < L - 2; u += 1.2)
      boxLocal(o, c, p, u, 34.05, 0.15, 0.25, 0.22, 0.25, 'trim');
  }
}
function boxLocal(o, c, p, u, y, d, w, h, t, s) {
  const r = [
    p([u - w / 2, 0, d - t / 2]),
    p([u + w / 2, 0, d - t / 2]),
    p([u + w / 2, 0, d + t / 2]),
    p([u - w / 2, 0, d + t / 2]),
  ];
  slab(
    o,
    c,
    r.map((q) => [q[0], q[2]]),
    y,
    y + h,
    s,
  );
}
function clock(o, c, p, u, y) {
  const n = c.round * 2,
    r = 0.7;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2,
      b = ((j + 1) / n) * Math.PI * 2;
    T(
      o,
      c,
      [
        p([u, y, 0.12]),
        p([u + r * Math.cos(a), y + r * Math.sin(a), 0.12]),
        p([u + r * Math.cos(b), y + r * Math.sin(b), 0.12]),
      ],
      'clock',
      C.clock,
      sub(p([0, 0, 1]), p([0, 0, 0])),
    );
  }
  if (c.near) {
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'trim',
        p([u + 0.5 * Math.cos(a), y + 0.5 * Math.sin(a), 0.15]),
        p([u + 0.64 * Math.cos(a), y + 0.64 * Math.sin(a), 0.15]),
        0.035,
        0.045,
        C.trim,
      );
    }
    beam(adapter(o, c), 'trim', p([u, y, 0.16]), p([u + 0.37, y + 0.15, 0.16]), 0.06, 0.07, C.trim);
    beam(adapter(o, c), 'trim', p([u, y, 0.16]), p([u - 0.13, y + 0.48, 0.16]), 0.04, 0.05, C.trim);
  }
}
function courtFace(o, c, a, b) {
  const { L, p } = basis(a, b),
    holes = [],
    n = Math.round(L / (c.near ? 4.8 : 8));
  if (c.detail)
    for (let i = 0; i < n; i++)
      for (const y of [22.4, 26.4, 30.4])
        holes.push({ kind: 'glass', ring: rect(((i + 0.5) * L) / n, y, (L / n) * 0.52, 2.65) });
  wall(o, c, p, L, 19.8, 34.4, holes);
}
function skylight(o, c) {
  const P = (t) => [-15 * Math.cos(t), 21.5 + 7 * Math.sin(t)],
    n = c.roofSteps;
  for (let j = 0; j < n; j++) {
    const a = P((j / n) * Math.PI),
      b = P(((j + 1) / n) * Math.PI);
    Q(
      o,
      c,
      [
        [-33, a[1], a[0]],
        [33, a[1], a[0]],
        [33, b[1], b[0]],
        [-33, b[1], b[0]],
      ],
      'glass',
      C.glass,
      [0, 1, 0],
    );
  }
  for (const x of [-33, 33]) {
    const r = [
      [-15, 19.8],
      [15, 19.8],
      ...Array.from({ length: n + 1 }, (_, j) => P(Math.PI - (j / n) * Math.PI)),
    ];
    const ix = earcut(r.flat());
    for (let j = 0; j < ix.length; j += 3)
      T(
        o,
        c,
        ix.slice(j, j + 3).map((k) => [x, r[k][1], r[k][0]]),
        'glass',
        C.glass,
        [x > 0 ? 1 : -1, 0, 0],
      );
  }
  if (c.detail) {
    for (let x = -33; x <= 33 + 0.01; x += c.master ? 1.65 : c.near ? 3.3 : c.fine ? 8.25 : 22)
      beamPath(
        adapter(o, c),
        'metal',
        Array.from({ length: n + 1 }, (_, j) => {
          const p = P((j / n) * Math.PI);
          return [x, p[1] + 0.06, p[0]];
        }),
        c.near ? 0.08 : 0.14,
        c.near ? 0.1 : 0.15,
        C.metal,
      );
    if (c.fine)
      for (let j = 0; j <= n; j++) {
        const p = P((j / n) * Math.PI);
        beam(
          adapter(o, c),
          'metal',
          [-33, p[1] + 0.06, p[0]],
          [33, p[1] + 0.06, p[0]],
          0.06,
          0.08,
          C.metal,
        );
      }
  }
}
export function buildStationLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Chicago tier ' + level);
  for (const p of controls.groups.main) solid(o, c, p, -9, 0.65, 'base');
  for (let i = 0; i < 4; i++)
    facade(o, c, outer[i], outer[(i + 1) % 4], i === 0 ? 'canal' : i === 2 ? 'west' : 'end');
  // The entire office ring has a real recessed central light court, not a roof painted onto a box.
  panel(o, c, [outer, [...court].reverse()], 34.4, 'roof');
  for (let i = 0; i < 4; i++) courtFace(o, c, court[(i + 1) % 4], court[i]);
  box(o, c, -35, 35, 19.5, 19.8, -25, 25, 'roof');
  skylight(o, c);
  box(o, c, -22, 22, 34.4, 39, 32, 42, 'stone');
  if (c.detail) {
    const { L, p } = basis([-22, 42], [22, 42]);
    wall(
      o,
      c,
      p,
      L,
      34.5,
      39,
      Array.from({ length: 5 }, (_, i) => ({
        kind: 'glass',
        ring: rect(4 + i * 9, 35.1, 1.9, 2.5),
      })),
    );
  }
  if (c.fine) {
    for (const [x, z] of [
      [-44, -34],
      [44, 34],
      [-44, 34],
      [44, -34],
    ]) {
      box(o, c, x - 1.5, x + 1.5, 34.4, 36.2, z - 2, z + 2, 'roof');
      if (c.near)
        for (let y = 34.8; y < 36; y += 0.35)
          beam(
            adapter(o, c),
            'metal',
            [x - 1.5, y, z - 2.04],
            [x + 1.5, y, z - 2.04],
            0.08,
            0.09,
            C.metal,
          );
    }
  }
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

/** Taganrog's modest classical palace: native concave plan, raised basement and thirteen-window facade. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ub/ub7/alexander_i_palace/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('d0b387'),
    trim: rgb('deddd1'),
    roof: rgb('3f806b'),
    wood: rgb('9b774b'),
    glass: rgb('485b5b'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.25 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.04 },
  };
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
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      s,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
}
function rod(o, s, a, b, w, d = 1, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    len = Math.hypot(...v),
    axis = v.map((x) => x / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u);
  if (d === 0) {
    for (const n of [u, v2])
      Q(
        o,
        s,
        [
          a.map((x, k) => x - (n[k] * w) / 2),
          a.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x - (n[k] * w) / 2),
        ],
        cross(n, axis),
        col,
      );
    return;
  }
  const ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((x, k) => x - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    axis.map((x) => -x),
    col,
  );
  Q(o, s, B, axis, col);
}
function face(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sg = Math.sign(
      r.reduce(
        (s, v, k) => s + v[0] * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * v[1],
        0,
      ),
    ),
    n = [sg * u[1], 0, -sg * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 > 1e-5 && y1 - y0 > 1e-5)
    Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function flat(o, s, f, r, depth = 0, col = C[s], holes = []) {
  const coords = r.flat(),
    starts = [];
  for (const h of holes) {
    starts.push(coords.length / 2);
    coords.push(...h.flat());
  }
  const ix = earcut(coords, starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(coords[k * 2], coords[k * 2 + 1], depth)),
      f.n,
      col,
    );
}
const rectangle = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  arch = (x, y0, spring, r, n) => [
    [x - r, y0],
    [x + r, y0],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + Math.cos(a) * r, spring + Math.sin(a) * r];
    }),
  ];
function reveal(o, s, f, r, depth, col = C[s]) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = -(b[1] - a[1]),
      v = b[0] - a[0],
      A = f.P(0, 0),
      B = f.P(u, v);
    Q(
      o,
      s,
      [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)],
      [B[0] - A[0], v, B[2] - A[2]],
      col,
    );
  }
}

const r = p.outline,
  E = p.parameters.eave;
// Permanent hip-roof masses intersect along straight valleys; clip them to the full native plan.
const roofBlocks = [
  [-24.256, 9.476, -1.13, 14.254, 2.25],
  [1.424, 9.894, -13.136, 4, 1.44],
  [-8.046, -2.129, -6.208, 3, 1.0],
  [7.4, 13.637, -1.792, 7.769, 1.06],
];
function roofY(q) {
  let y = E + 0.1;
  for (const [a, b, c, e, h] of roofBlocks) {
    if (q[0] < a || q[0] > b || q[1] < c || q[1] > e) continue;
    const k = Math.min(b - a, e - c) / 2;
    y = Math.max(
      y,
      E + 0.1 + h * Math.min(1, (q[0] - a) / k, (b - q[0]) / k, (q[1] - c) / k, (e - q[1]) / k),
    );
  }
  return y;
}
function clipped(poly, ring) {
  const area = ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      side = (q) => sign * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])),
      next = [];
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j],
        q = poly[(j + 1) % poly.length],
        u = side(p),
        v = side(q);
      if (u >= -1e-7) next.push(p);
      if (u > 0 !== v > 0) {
        const t = u / (u - v);
        next.push(p.map((x, k) => x + (q[k] - x) * t));
      }
    }
    poly = next;
    if (poly.length < 3) return [];
  }
  return poly;
}
function roofGeometry(o) {
  const ix = earcut(r.flat());
  for (const [a, b, c, e, h] of roofBlocks) {
    const k = Math.min(b - a, e - c) / 2,
      base = E + 0.1,
      lo = [
        [a, base, c],
        [b, base, c],
        [b, base, e],
        [a, base, e],
      ],
      A = b - a >= e - c ? [a + k, base + h, (c + e) / 2] : [(a + b) / 2, base + h, c + k],
      B = b - a >= e - c ? [b - k, base + h, (c + e) / 2] : [(a + b) / 2, base + h, e - k],
      patches =
        b - a >= e - c
          ? [
              [lo[0], lo[1], B, A],
              [lo[1], lo[2], B],
              [lo[2], lo[3], A, B],
              [lo[3], lo[0], A],
            ]
          : [
              [lo[0], lo[1], A],
              [lo[1], lo[2], B, A],
              [lo[2], lo[3], B],
              [lo[3], lo[0], A, B],
            ];
    for (const patch of patches) {
      const n = normalFor(...patch.slice(0, 3)),
        outline = patch.map((v) => [v[0], v[2]]),
        height = (q) =>
          patch[0][1] - (n[0] * (q[0] - patch[0][0]) + n[2] * (q[1] - patch[0][2])) / n[1];
      for (let j = 0; j < ix.length; j += 3) {
        const poly = clipped(
          ix.slice(j, j + 3).map((k) => r[k]),
          outline,
        );
        for (let v = 1; v < poly.length - 1; v++)
          T(
            o,
            'roof',
            [poly[0], poly[v], poly[v + 1]].map((q) => [q[0], height(q), q[1]]),
            [0, 1, 0],
          );
      }
    }
  }
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i),
      n = Math.ceil(f.len);
    for (let j = 0; j < n; j++) {
      const a = f.P((f.len * j) / n, E),
        b = f.P((f.len * (j + 1)) / n, E),
        ya = roofY([a[0], a[2]]),
        yb = roofY([b[0], b[2]]);
      Q(o, 'wall', [a, b, [b[0], yb, b[2]], [a[0], ya, a[2]]], f.n);
    }
  }
}
function inside(q) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > q[1] !== r[j][1] > q[1] &&
      q[0] < ((r[j][0] - r[i][0]) * (q[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  return yes;
}
function windows(f, i) {
  if (i === 0)
    return Array.from({ length: 13 }, (_, j) => ({
      x: (f.len * (j + 0.5)) / 13,
      w: 1.12,
      base: true,
    }));
  const count = f.len > 7 ? Math.max(1, Math.floor(f.len / 3.25)) : f.len > 4 ? 1 : 0;
  return Array.from({ length: count }, (_, j) => ({
    x: (f.len * (j + 0.5)) / count,
    w: 1.06,
    base: i === 13 || i === 1,
  }));
}
function trimLine(o, s, f, x0, y0, x1, y1, z, d, col = C[s]) {
  const a = f.P(x0, y0, z),
    b = f.P(x1, y1, z);
  rod(o, s, a, b, 0.07, d, col);
}
function window(o, f, w, d, front) {
  const y0 = 2.04,
    y1 = 4.31,
    x0 = w.x - w.w / 2,
    x1 = w.x + w.w / 2,
    depth = 0.19;
  if (d === 0) {
    rect(o, 'glass', f, x0, y0, x1, y1, 0.012);
    return;
  }
  const shape = rectangle(x0, y0, x1, y1);
  reveal(o, 'wall', f, shape, depth);
  rect(o, 'glass', f, x0, y0, x1, y1, -depth);
  for (const [a, b, c, e] of [
    [x0 - 0.065, y0 - 0.06, x0 + 0.035, y1 + 0.06],
    [x1 - 0.035, y0 - 0.06, x1 + 0.065, y1 + 0.06],
    [x0, y0 - 0.06, x1, y0 + 0.035],
    [x0, y1 - 0.035, x1, y1 + 0.06],
  ])
    rect(o, 'wood', f, a, b, c, e, -0.13);
  if (d > 1) {
    rect(o, 'wood', f, w.x - 0.027, y0, w.x + 0.027, y1, -0.125);
    for (const y of [2.82, 3.58]) rect(o, 'wood', f, x0, y - 0.023, x1, y + 0.023, -0.12);
  }
  rect(o, 'trim', f, x0 - 0.11, y0 - 0.14, x1 + 0.11, y0 - 0.05, 0.095);
  if (front) {
    const width = w.w + 1.0;
    rect(o, 'trim', f, w.x - width / 2, 4.79, w.x + width / 2, 5.17, 0.012, rgb('d7d6cd'));
    if ([4, 6, 8].includes(w.index)) {
      flat(
        o,
        'trim',
        f,
        [
          [w.x - 0.88, 4.43],
          [w.x + 0.88, 4.43],
          [w.x, 4.77],
        ],
        0.09,
      );
      flat(
        o,
        'wall',
        f,
        [
          [w.x - 0.62, 4.47],
          [w.x + 0.62, 4.47],
          [w.x, 4.69],
        ],
        0.104,
        rgb('c4ac86'),
      );
    }
  }
  if (w.base) {
    const by0 = 0.26,
      by1 = 0.91,
      bw = 0.86;
    rect(o, 'glass', f, w.x - bw / 2, by0, w.x + bw / 2, by1, 0.013);
    if (d > 1) {
      for (const side of [-1, 1])
        rect(
          o,
          'wood',
          f,
          w.x + (side * bw) / 2 - 0.035,
          by0,
          w.x + (side * bw) / 2 + 0.035,
          by1,
          0.045,
        );
      rect(o, 'wood', f, w.x - bw / 2, by0 - 0.035, w.x + bw / 2, by0 + 0.035, 0.045);
      rect(o, 'wood', f, w.x - bw / 2, by1 - 0.035, w.x + bw / 2, by1 + 0.035, 0.045);
      for (const dx of [-0.2, 0, 0.2])
        trimLine(o, 'roof', f, w.x + dx, by0, w.x + dx, by1, 0.06, d, rgb('777970'));
    }
  }
}
function facade(o, i, d) {
  const f = face(r, i),
    ws = windows(f, i).map((w, j) => ({ ...w, index: j })),
    holes = d ? ws.map((w) => rectangle(w.x - w.w / 2, 2.04, w.x + w.w / 2, 4.31)) : [];
  flat(o, 'wall', f, rectangle(0, 1.35, f.len, E), 0, C.wall, holes);
  rect(o, 'trim', f, 0, 0, f.len, 1.35, 0, rgb('92938b'));
  for (const w of ws) window(o, f, w, d, i === 0);
  rect(o, 'trim', f, 0, 5.35, f.len, 5.46, 0.08);
  rect(o, 'trim', f, 0, 5.56, f.len, 5.73, 0.2);
  rect(o, 'roof', f, 0, E + 0.09, f.len, E + 0.17, 0.24);
  if (d > 1) {
    const n = Math.floor(f.len / 0.43);
    for (let j = 0; j < n; j++) {
      const x = (f.len * (j + 0.5)) / n,
        ps = [
          [x - 0.1, 5.43],
          [x + 0.1, 5.43],
          [x + 0.1, 5.58],
          [x - 0.1, 5.58],
        ];
      flat(o, 'trim', f, ps, 0.135);
    }
  }
  // Strong photographed corner quoins; unobserved rear corners remain plain.
  if (i === 0 || i === 13 || i === 1) {
    for (const side of [0, 1]) {
      const x = side ? f.len - 0.45 : 0;
      if (d === 0) rect(o, 'trim', f, x, 1.35, x + 0.45, 5.34, 0.035);
      else
        for (let y = 1.35; y < 5.3; y += 0.41)
          rect(o, 'trim', f, x, y, x + 0.45, Math.min(y + 0.32, 5.34), 0.065);
    }
  }
  if (i === 0 && d > 0) {
    const x = f.len / 2;
    for (const dx of [-4.45, 4.45])
      rect(o, 'wall', f, x + dx - 0.19, 1.35, x + dx + 0.19, 5.35, 0.07, rgb('d8bd94'));
  }
}
function gate(o, d) {
  const x = r[0][0],
    z = r[0][1] - 0.05,
    f = { n: [0, 0, 1], P: (u, y, v = 0) => [x - 4.1 + u, y, z + v] },
    span = 2.1,
    xc = 2.05,
    shape = arch(xc, 0.0, 2.0, span / 2, d ? 12 : 6);
  flat(o, 'wall', f, rectangle(0.48, 0, 3.62, 3.12), 0, C.wall, [shape]);
  reveal(o, 'wall', f, shape, 0.25);
  flat(o, 'wood', f, shape, -0.24);
  for (const u of [0.2, 3.9]) {
    box(o, 'trim', x - 4.1 + u, 0, z, 0.52, 3.38, 0.72);
    box(o, 'trim', x - 4.1 + u, 3.38, z, 0.72, 0.14, 0.88);
  }
  if (d > 0) {
    for (const u of [1.2, 1.55, 1.9, 2.25, 2.6, 2.9])
      trimLine(o, 'wood', f, u, 0.08, u, 1.9, -0.2, d, rgb('806744'));
    const path = Array.from({ length: 17 }, (_, i) => [
      xc + 1.24 * Math.cos((i * Math.PI) / 16),
      2.0 + 1.24 * Math.sin((i * Math.PI) / 16),
    ]);
    for (let i = 0; i < path.length - 1; i++)
      trimLine(o, 'trim', f, ...path[i], ...path[i + 1], 0.1, d);
  }
}
function build(o, _f, d = 3) {
  cap(o, 'trim', r, 0, false, rgb('92938b'));
  cap(o, 'wall', r, E, false);
  for (let i = 0; i < r.length; i++) facade(o, i, d);
  roofGeometry(o);
  if (d > 1) {
    for (let x = -23.8; x < 13.4; x += d === 3 ? 0.58 : 1.16) {
      let previous = null;
      for (let z = -13.4; z < 14.5; z += 0.7) {
        const q = [x, z];
        if (!inside(q)) {
          previous = null;
          continue;
        }
        const at = [x, roofY(q) + 0.02, z];
        if (previous) rod(o, 'roof', previous, at, 0.025, 0, rgb('4c8d77'));
        previous = at;
      }
    }
  }
  // Chimney box and vent stack are permanent elements visible in the 2010 original.
  box(o, 'wall', -5.4, 7.35, 5.2, 6.9, 1.35, 1.75, rgb('b9aa90'));
  box(o, 'trim', -5.4, 8.7, 5.2, 7.2, 0.16, 1.98, rgb('a5a497'));
  if (d > 0) {
    for (const x of [-7.6, -3.2]) box(o, 'glass', x, 7.7, 6.08, 0.4, 0.57, 0.03);
    box(o, 'roof', -1.8, 8.3, 4.9, 0.28, 0.85, 0.35, rgb('8f9691'));
  }
  if (d > 0) {
    const f = face(r, 8);
    rect(o, 'wood', f, 0.7, 0.8, 1.6, 3.23, 0.025);
  }
  gate(o, d);
}
export const alexanderIPalaceSkyline = (o, f) => build(o, f, 0),
  alexanderIPalaceDistrict = (o, f) => build(o, f, 1),
  alexanderIPalaceStreet = (o, f) => build(o, f, 2),
  alexanderIPalaceCloseup = (o, f) => build(o, f, 3);
export const alexanderIPalaceModel = {
  id: 'alexander_i_palace',
  key: 'alexander_i_palace',
  cell: 'ub/ub7',
  recipe: 'structure-alexander-i-palace.mjs',
  title: 'Alexander I Palace',
  category: 'palace-castle-fort',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [44, 27, 61],
  lookAt: [-5, 3.5, 1],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 0.7, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-palace-native-rear-returns-and-green-hip-roofs',
      position: [40, 42, -40],
      lookAt: [-5, 3, -1],
      reviewLod: 'skyline',
    },
    {
      name: 'thirteen-window-raised-basement-and-classical-cornice',
      position: [6, 10, 43],
      lookAt: [-6, 3.4, 14.2],
    },
    {
      name: 'left-return-rusticated-corner-and-intrinsic-pedestrian-gate',
      position: [-38, 11, 29],
      lookAt: [-24, 3, 12],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129-square2m field frozen before geometry at fixed street approach; heights/roof pitch are photographic architecture estimates, no DEM fitting and hostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alexander-i-palace.mjs',
    level: 'skyline',
    export: 'alexanderIPalaceSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'alexanderIPalaceDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'alexanderIPalaceStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'alexanderIPalaceCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Full14-vertex single-storey historic palace and attached rear returns, raised basement and13-window street front; green hipped metal roof/standing seams/chimney box, white rusticated corners/dentil cornice/upper panels/three pedimented hoods, wooden sashes/basement grilles and intrinsic attached pedestrian gate. Small painted moldings/window grille pattern simplified. Gate placement/dimensions, rear window census and low return hip profiles bounded estimates; full native outline retained, not surrounding campus.',
    'Two published ISasha PD originals exactly native-SHA1-bound and individually inspected. 2010 ochre/white/green repaint selected without temporary scaffolding;2008 photo supplies proportions, no mixed original1825restoration claim. Current exact finish/condition/rear arrangement unverified; hidden facades/roof subdivisions/chimney heights interpreted from complete native geometry and visible front. No attribution/unknown photo textures or generated bitmap.',
    'Original public independent256m129-square2m field/all16641values/one originalTerrariumtile/PNG frozen before geometry unchanged; provider-relative datum41.2232m/sourcepixel3.24534m, not survey accuracy. No terrain flattening/fit/reacquisition; actual host-grade contact unverified. All architecture localY0, slight internal basement/approach variations unsurveyed. Flat capture fixtures are separate.',
    'No TsarskoyeSeloAlexanderPalace, independent sanatorium campus/neighbor buildings, trees/yard/street/temporary renovation/cars/visitors/interiors or plaque inscriptions. Ordinary geographic preview, replacement disabled.',
  ],
};

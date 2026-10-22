/** Battered oval sea fort, six brick machicolations, attached entry ruins and short bridge/steps. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gb/gby/brehon_tower/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('969388'),
    trim: rgb('bbb5a5'),
    brick: rgb('936e5e'),
    slab: rgb('94948a'),
    wood: rgb('7c7769'),
    metal: rgb('535d5b'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
    brick: { slot: 'wall', graph: 'brick', roughness: 0.97, metallic: 0 },
    slab: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.24 },
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

const R = p.outline,
  H = p.ruin,
  c = p.towerCentre,
  vary = (col, t) => col.map((v) => Math.min(1, v * t)),
  scaled = (s) => R.map((a) => [c[0] + (a[0] - c[0]) * s, c[1] + (a[1] - c[1]) * s]);
function solid(o, s, f, x0, y0, x1, y1, z0, z1, col = C[s]) {
  const q = [
      f.P(x0, y0, z0),
      f.P(x1, y0, z0),
      f.P(x1, y1, z0),
      f.P(x0, y1, z0),
      f.P(x0, y0, z1),
      f.P(x1, y0, z1),
      f.P(x1, y1, z1),
      f.P(x0, y1, z1),
    ],
    mid = [0, 1, 2].map((k) => q.reduce((a, v) => a + v[k] / 8, 0));
  for (const ids of [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 7, 6, 2],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
  ]) {
    const pp = ids.map((i) => q[i]),
      n = [0, 1, 2].map((k) => pp.reduce((a, v) => a + v[k] / 4, 0) - mid[k]);
    Q(o, s, pp, n, col);
  }
}
function capHole(o, s, outer, inner, y) {
  const coords = [...outer.flat(), ...inner.flat()],
    ix = earcut(coords, [outer.length]);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [coords[k * 2], y, coords[k * 2 + 1]]),
      [0, 1, 0],
    );
}
const scaleAt = (y) => (y <= 2.2 ? 1 - (y * 0.03) / 2.2 : 0.97 - ((y - 2.2) * 0.045) / 8.7);
function wallFace(i) {
  const f = face(R, i);
  return {
    ...f,
    P: (x, y, z = 0) => {
      const q = f.P(x, 0),
        s = scaleAt(y);
      return [c[0] + (q[0] - c[0]) * s + f.n[0] * z, y, c[1] + (q[2] - c[1]) * s + f.n[2] * z];
    },
  };
}
function recess(o, f, loop, d, depth = 1.05, slot = 'wall') {
  if (d) {
    reveal(o, 'trim', f, loop, depth);
    flat(o, slot, f, loop, -depth, vary(C[slot], 0.36));
  } else flat(o, slot, f, loop, 0.018, vary(C[slot], 0.3));
  return loop;
}
function body(o, d) {
  cap(o, 'wall', R, 0, false);
  for (let i = 0; i < R.length; i++) {
    const f = wallFace(i),
      holes = [];
    flat(o, 'wall', f, rectangle(0, 0, f.len, 2.2), 0, vary(C.wall, 0.93));
    if (p.parameters.windowEdges.includes(i))
      for (const y of p.parameters.windowRows) {
        const sh = arch(f.len / 2, y, y + 0.69, 0.27, d > 1 ? 10 : 4);
        recess(o, f, sh, d);
        if (d) holes.push(sh);
        if (d > 1) rect(o, 'trim', f, f.len / 2 - 0.39, y - 0.1, f.len / 2 + 0.39, y - 0.025, 0.06);
      }
    if (i === p.parameters.doorEdge) {
      const sh = arch(f.len / 2, 3.1, 4.7, 0.48, d > 1 ? 12 : 5);
      recess(o, f, sh, d, 0.85, 'wood');
      if (d) holes.push(sh);
      rect(o, 'trim', f, 0.05, 5.37, f.len - 0.05, 5.6, 0.035, vary(C.trim, 0.91));
    }
    if (i === 0) {
      const sh = rectangle(f.len / 2 - 0.95, 2.35, f.len / 2 + 0.95, 3.45);
      recess(o, f, sh, d, 1.25);
      if (d) holes.push(sh);
    }
    flat(
      o,
      'wall',
      f,
      rectangle(0, 2.2, f.len, 10.9),
      0,
      vary(C.wall, 0.965 + (i % 4) * 0.018),
      holes,
    );
    if (d > 1 && i === 9)
      flat(
        o,
        'wall',
        f,
        [
          [0.35, 3.2],
          [1.5, 3.3],
          [1.8, 3.75],
          [0.65, 4.1],
          [0.2, 3.65],
        ],
        0.02,
        vary(C.trim, 0.89),
      );
  }
}
function corbel(o, f, x, d) {
  const w = d ? 0.22 : 0.4,
    prof = [
      [0, 9.6],
      [0, 10.45],
      [1.02, 10.45],
    ];
  for (const sign of [-1, 1])
    T(
      o,
      'trim',
      prof.map(([z, y]) => f.P(x + (sign * w) / 2, y, z)),
      [sign * (f.P(1, 0)[0] - f.P(0, 0)[0]), 0, sign * (f.P(1, 0)[2] - f.P(0, 0)[2])],
    );
  for (let i = 0; i < 3; i++) {
    const a = prof[i],
      b = prof[(i + 1) % 3],
      center = f.P(x, (9.6 + 10.45 + 10.45) / 3, 1.02 / 3),
      edge = f.P(x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
    Q(
      o,
      'trim',
      [
        f.P(x - w / 2, a[1], a[0]),
        f.P(x + w / 2, a[1], a[0]),
        f.P(x + w / 2, b[1], b[0]),
        f.P(x - w / 2, b[1], b[0]),
      ],
      edge.map((v, k) => v - center[k]),
    );
  }
}
function machicolation(o, i, d) {
  const f = face(scaled(0.925), i),
    x = f.len / 2,
    w = 1.85,
    front = { ...f, P: (a, b, z = 0) => f.P(a, b, z + 1.05) },
    holes = [];
  if (d)
    for (const off of [-0.46, 0.46]) {
      const sh = rectangle(x + off - 0.085, 11.05, x + off + 0.085, 11.48);
      holes.push(sh);
      reveal(o, 'brick', front, sh, 0.22);
      flat(o, 'wall', front, sh, -0.23, vary(C.wall, 0.25));
    }
  flat(o, 'brick', front, rectangle(x - w / 2, 10.4, x + w / 2, 12.2), 0, C.brick, holes);
  solid(o, 'brick', f, x - w / 2, 10.4, x - w / 2 + 0.2, 12.2, -0.04, 1.05);
  solid(o, 'brick', f, x + w / 2 - 0.2, 10.4, x + w / 2, 12.2, -0.04, 1.05);
  solid(o, 'slab', f, x - w / 2 - 0.04, 12.15, x + w / 2 + 0.04, 12.25, -0.08, 1.12);
  if (d) for (const off of [-0.63, 0, 0.63]) corbel(o, f, x + off, d);
  else corbel(o, f, x, 0);
  Q(
    o,
    'slab',
    [
      f.P(x - w / 2, 10.4, 0),
      f.P(x + w / 2, 10.4, 0),
      f.P(x + w / 2, 10.4, 1.05),
      f.P(x - w / 2, 10.4, 1.05),
    ],
    [0, -1, 0],
  );
  if (d > 1)
    for (const y of [10.65, 10.9, 11.65, 11.9])
      rect(o, 'brick', front, x - w / 2, y, x + w / 2, y + 0.018, 0.008, vary(C.brick, 0.79));
}
function parapet(o, d) {
  const out = scaled(0.925),
    inner = scaled(0.84);
  cap(o, 'slab', inner, 10.9);
  capHole(o, 'trim', out, inner, 12.2);
  for (let i = 0; i < R.length; i++) {
    const f = face(out, i),
      raw = face(inner, i),
      back = {
        ...raw,
        n: raw.n.map((v) => -v),
        len: f.len,
        P: (x, y, z = 0) => raw.P((x * raw.len) / f.len, y, -z),
      },
      sh = rectangle(f.len / 2 - 0.56, 10.9, f.len / 2 + 0.56, 11.9),
      open = p.parameters.machicolationEdges.includes(i),
      holes = d && open ? [sh] : [];
    flat(o, 'wall', f, rectangle(0, 10.9, f.len, 12.2), 0, C.wall, holes);
    flat(o, 'wall', back, rectangle(0, 10.9, f.len, 12.2), 0, C.wall, holes);
    if (d && open)
      for (let k = 0; k < sh.length; k++) {
        const a = sh[k],
          b = sh[(k + 1) % sh.length];
        const start = f.P(0, 0),
          inward = f.P(-(b[1] - a[1]), b[0] - a[0]);
        Q(
          o,
          'trim',
          [f.P(...a), f.P(...b), back.P(...b), back.P(...a)],
          inward.map((v, k) => v - start[k]),
        );
      }
    if (d > 1) {
      rect(o, 'trim', f, 0, 12.03, f.len, 12.2, 0.035);
      rect(o, 'trim', back, 0, 12.03, f.len, 12.2, 0.025);
    }
  }
  for (const i of p.parameters.machicolationEdges) machicolation(o, i, d);
}
function ruins(o, d) {
  cap(o, 'slab', H, 0.15);
  cap(o, 'wall', H, 0, false);
  for (let i = 0; i < 9; i++) {
    const f = face(H, i),
      h = p.parameters.ruinWallHeights[i],
      n = d > 1 ? Math.max(1, Math.round(f.len / 1.25)) : 1;
    for (let j = 0; j < n; j++) {
      const x0 = (f.len * j) / n,
        x1 = (f.len * (j + 1)) / n,
        top = h + (d > 1 ? ((i * 5 + j * 3) % 7) * 0.045 : 0);
      solid(o, 'wall', f, x0, 0, x1, top, -0.55, 0, vary(C.wall, 0.9 + (i % 5) * 0.025));
      if (d > 1) {
        const q = f.P((x0 + x1) / 2, top - 0.04, -0.25);
        box(
          o,
          'trim',
          q[0],
          q[1],
          q[2],
          Math.min(0.65, (x1 - x0) * 0.7),
          0.13,
          0.42,
          vary(C.wall, 0.92),
        );
      }
    }
  }
}
function bridgeSegment(o, a, b, ya, yb, d) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    n = [u[1], 0, -u[0]],
    w = 0.94;
  const P = (t, y, z) => [a[0] + u[0] * t + n[0] * z, y, a[1] + u[1] * t + n[2] * z];
  Q(
    o,
    'wood',
    [P(0, ya, -w / 2), P(len, yb, -w / 2), P(len, yb, w / 2), P(0, ya, w / 2)],
    [0, 1, 0],
  );
  for (const sign of [-1, 1])
    rod(o, 'wood', P(0, ya - 0.12, sign * w * 0.43), P(len, yb - 0.12, sign * w * 0.43), 0.16, d);
  if (d > 1) {
    const n = Math.ceil(len / 0.22);
    for (let j = 1; j < n; j++) {
      const t = (len * j) / n,
        y = ya + ((yb - ya) * j) / n;
      Q(
        o,
        'wood',
        [
          P(t - 0.007, y + 0.006, -w / 2),
          P(t + 0.007, y + 0.006, -w / 2),
          P(t + 0.007, y + 0.006, w / 2),
          P(t - 0.007, y + 0.006, w / 2),
        ],
        [0, 1, 0],
        vary(C.wood, 0.64),
      );
    }
  }
}
function access(o, d) {
  const a = p.steps[0],
    b = p.steps[1],
    f = { len: Math.hypot(b[0] - a[0], b[1] - a[1]), n: [0, 0, 0] };
  const u = [(b[0] - a[0]) / f.len, (b[1] - a[1]) / f.len],
    side = [u[1], -u[0]];
  f.n = [side[0], 0, side[1]];
  f.P = (x, y, z = 0) => [a[0] + u[0] * x + side[0] * z, y, a[1] + u[1] * x + side[1] * z];
  if (d)
    for (let j = 0; j < 10; j++)
      solid(o, 'slab', f, (j * f.len) / 10, 0, ((j + 1) * f.len) / 10, (j + 1) * 0.22, -0.55, 0.55);
  else {
    const v = [f.P(0, 0, -0.55), f.P(0, 0, 0.55), f.P(f.len, 2.2, 0.55), f.P(f.len, 2.2, -0.55)];
    Q(o, 'slab', v, [0, 1, 0]);
    Q(o, 'slab', [f.P(f.len, 0, -0.55), f.P(f.len, 0, 0.55), v[2], v[3]], [u[0], 0, u[1]]);
  }
  const landingY = ([x, z]) => Math.max(0, (((x - a[0]) * u[0] + (z - a[1]) * u[1]) * 2.2) / f.len),
    indices = earcut(p.landing.flat());
  for (let i = 0; i < indices.length; i += 3)
    T(
      o,
      'slab',
      indices
        .slice(i, i + 3)
        .map((k) => [p.landing[k][0], landingY(p.landing[k]), p.landing[k][1]]),
      [0, 1, 0],
    );
  for (let i = 0; i < p.landing.length; i++) {
    const q = face(p.landing, i),
      next = (i + 1) % p.landing.length;
    Q(
      o,
      'slab',
      [
        q.P(0, 0),
        q.P(q.len, 0),
        q.P(q.len, landingY(p.landing[next])),
        q.P(0, landingY(p.landing[i])),
      ],
      q.n,
    );
  }
  bridgeSegment(o, p.bridge[0], p.bridge[1], 2.2, 3.1, d);
  const door = wallFace(p.parameters.doorEdge),
    end = door.P(door.len / 2, 3.1, 0.03);
  bridgeSegment(o, p.bridge[1], [end[0], end[2]], 3.1, 3.1, d);
}
function roofDetails(o, d) {
  const [x, z] = c;
  if (d) {
    for (const dx of [-5, 5]) {
      const n = d > 1 ? 20 : 8,
        r = 1.35;
      for (let j = 0; j < n; j++) {
        const a = (2 * Math.PI * j) / n,
          b = (2 * Math.PI * (j + 1)) / n;
        Q(
          o,
          'metal',
          [
            [x + dx + Math.cos(a) * r, 10.925, z + Math.sin(a) * r],
            [x + dx + Math.cos(b) * r, 10.925, z + Math.sin(b) * r],
            [x + dx + Math.cos(b) * (r - 0.12), 10.925, z + Math.sin(b) * (r - 0.12)],
            [x + dx + Math.cos(a) * (r - 0.12), 10.925, z + Math.sin(a) * (r - 0.12)],
          ],
          [0, 1, 0],
        );
      }
    }
    box(o, 'slab', x - 1, 10.9, z + 2, 0.6, 0.8, 0.6);
    box(o, 'metal', x - 1, 11.7, z + 2, 0.3, 0.1, 0.3);
  }
  rod(o, 'metal', [x, 10.9, z], [x, 12.15, z], 0.12, d);
  box(o, 'trim', x, 12.0, z, 0.68, 0.44, 0.6);
  box(o, 'metal', x, 12.39, z, 0.75, 0.1, 0.66);
  if (d) rod(o, 'metal', [x, 12.44, z], [x, 13.4, z], 0.045, d);
}
function build(o, _f, d = 3) {
  body(o, d);
  parapet(o, d);
  ruins(o, d);
  access(o, d);
  roofDetails(o, d);
}
export const brehonTowerSkyline = (o, f) => build(o, f, 0),
  brehonTowerDistrict = (o, f) => build(o, f, 1),
  brehonTowerStreet = (o, f) => build(o, f, 2),
  brehonTowerCloseup = (o, f) => build(o, f, 3);
export const brehonTowerModel = {
  id: 'brehon_tower',
  key: 'brehon_tower',
  cell: 'gb/gby',
  recipe: 'structure-brehon-tower.mjs',
  title: 'Bréhon Tower',
  category: 'tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-25, 23, 44],
  lookAt: [12, 6, 9],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.15, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-oval-battered-fort-six-brick-defenses-and-attached-ruins',
      position: [-24, 23, 43],
      lookAt: [12, 5.5, 9],
      reviewLod: 'skyline',
    },
    {
      name: 'southern-arched-openings-ashlar-reveals-and-brick-machicolations',
      position: [6, 10, 36],
      lookAt: [11, 7.8, 14],
    },
    {
      name: 'open-roof-battery-plain-parapet-and-six-loopholed-boxes',
      position: [37, 30, 20],
      lookAt: [12, 9.6, 7],
    },
    {
      name: 'low-attached-ruins-short-entrance-bridge-and-ten-steps',
      position: [35, 14, 37],
      lookAt: [13, 3, 21],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129square2mfield frozen beforegeometry returns allzero/coarse sea and does not resolve isletrock. Architecturaltoe/entrylevels estimated independently; actualrock/tidalhostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-brehon-tower.mjs',
    level: 'skyline',
    export: 'brehonTowerSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'brehonTowerDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'brehonTowerStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'brehonTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Wholeovalfort22points/13pointattachedlowruin/6pointlanding/shortbridge/10steps represented. Sixbrickmachicolations and blankuppernorthwall follow primary2011sitevisit account. Southernwindowpositions/ruincrown/heights/doorlandingextension/rooftraces/beacon minorgeometry estimated. Openings have deep darksimplifiedinteriorclosures; interiors and exact internalvaults excluded.',
    'Two exactpublishedManvyiPD-self2010/2011originals individuallyinspected/nativeSHA1bound. Distantviews do not certify hiddenrooffine detail or everywindow. OfficialparishTownie2013textfacts only; protectedPDFphotos/plans notviewed orused. No metadata/category/articlebody/policychange, protectedphototexture/generatedbitmap/downloadedmesh.',
    'Bodybatteredtoe0..2.2m/top10.9m/parapet12.2m/beacon13.4m/door3.1m/tensteps2.2m/lowruin1.15..2.3m are independent architecturalestimates; Libraryreported~40ft notcurrentheight survey. Upperbody26x20m approximately matches parishtext; coarse nativebase28x22m retained.',
    'Independent256m129square2m all16641samples/oneoriginalTerrariumtile/PNG frozen unchanged beforegeometry. Provider sea-valuedfield is allzero and DOES NOT resolve actualrock/islet/tide; no terrainfitting/flattening/reacquisition or fabricatedisletmesh. Nativebottomstep fixesY0 but actualcompatiblehostcontact unverified. Ordinarygeographicpreview/replacementdisabled.',
    'Separatelandingpier/wholeislet/naturalrock/reef/sea/Jethou/ships/background/oldguns/lostroofbuildings/generalremoteaccesspaths excluded. Lowroofmountings/crane pedestal are simplified approximate surviving traces, not complete artillery reconstruction.',
  ],
};

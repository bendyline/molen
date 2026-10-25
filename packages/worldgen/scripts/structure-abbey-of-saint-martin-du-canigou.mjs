/** Restored cliff-side abbey: church/choir, crenellated tower, open cloister and attached monastic wings. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sp/sp9/abbey_of_saint_martin_du_canigou/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  P = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('b6a28b'),
    trim: rgb('d0c7b5'),
    tile: rgb('bb815b'),
    slate: rgb('899193'),
    wood: rgb('7d715e'),
    glass: rgb('4d6066'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
    tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
    slate: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0.02 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
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

const R = p.outline,
  H = p.court,
  vary = (c, t) => c.map((v) => Math.min(1, v * t)),
  rectXZ = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
function capHole(o, s, r, hole, y) {
  const coords = [...r.flat(), ...hole.flat()],
    ix = earcut(coords, [r.length]);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [coords[k * 2], y, coords[k * 2 + 1]]),
      [0, 1, 0],
    );
}
function pane(o, f, x, y, w, h, d, shape = 'rect', back = true) {
  const loop =
    shape === 'arch'
      ? arch(x, y, y + h - w / 2, w / 2, d > 1 ? 8 : 4)
      : rectangle(x - w / 2, y, x + w / 2, y + h);
  if (d) {
    reveal(o, 'trim', f, loop, 0.16);
    if (back) flat(o, 'glass', f, loop, -0.16);
  } else flat(o, 'glass', f, loop, 0.015);
  return loop;
}
function facade(o, r, i, bottom, top, d, counts = null, church = false) {
  const f = face(r, i),
    courtEdge = H.some(
      (a, k) =>
        Math.hypot(a[0] - r[i][0], a[1] - r[i][1]) < 0.03 &&
        Math.hypot(
          H[(k + 1) % H.length][0] - r[(i + 1) % r.length][0],
          H[(k + 1) % H.length][1] - r[(i + 1) % r.length][1],
        ) < 0.03,
    ),
    floor = courtEdge ? 9.35 : bottom,
    n0 = counts ?? (f.len > 3 ? Math.max(1, Math.floor(f.len / 3.4)) : 0),
    n = Math.min(n0, d === 0 ? 2 : d === 1 ? 3 : 100),
    holes = [],
    windows = [];
  for (let j = 0; j < n; j++) {
    const x = (f.len * (j + 0.5)) / n,
      w = church ? 0.52 : 0.7;
    for (const y of church
      ? [7.7, 11.5]
      : top > 12
        ? d < 2
          ? [11.6]
          : [8.1, 11.6]
        : d === 0
          ? [5.5]
          : [2.2, 5.5]) {
      if (y < floor || y + 1.12 > top) continue;
      const sh = pane(o, f, x, y, w, church ? 0.94 : 1.13, d, church ? 'arch' : 'rect');
      if (d) holes.push(sh);
      windows.push([x, y, w]);
    }
  }
  flat(o, 'wall', f, rectangle(0, floor, f.len, top), 0, C.wall, holes);
  if (d > 1)
    for (const [x, y, w] of windows)
      rect(o, 'trim', f, x - w / 2 - 0.07, y - 0.1, x + w / 2 + 0.07, y - 0.035, 0.06);
  rect(o, 'trim', f, 0, top - 0.16, f.len, top, 0.08, vary(C.trim, 0.92));
}
function body(o, r, y, top, d, church = false) {
  cap(o, 'wall', r, y, false);
  cap(o, 'wall', r, top);
  for (let i = 0; i < r.length; i++) facade(o, r, i, y, top, d, null, church);
}
function roof(o, r, eave, rise, material, d) {
  const edges = r.map((a, i) => {
      const b = r[(i + 1) % r.length],
        v = [b[0] - a[0], b[1] - a[1]],
        l = Math.hypot(...v);
      return { v: v.map((x) => x / l), l };
    }),
    axis = edges.reduce((a, b) => (a.l > b.l ? a : b)).v,
    perp = [-axis[1], axis[0]],
    dot = (p, v) => p[0] * v[0] + p[1] * v[1],
    vmin = Math.min(...r.map((q) => dot(q, perp))),
    vmax = Math.max(...r.map((q) => dot(q, perp))),
    mid = (vmin + vmax) / 2,
    half = (vmax - vmin) / 2,
    Y = (q) => eave + rise * Math.max(0, 1 - Math.abs(dot(q, perp) - mid) / half),
    clip = (positive) => {
      const out = [];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          u = (dot(a, perp) - mid) * (positive ? 1 : -1),
          v = (dot(b, perp) - mid) * (positive ? 1 : -1);
        if (u >= -1e-7) out.push(a);
        if (u > 0 !== v > 0) {
          const t = u / (u - v);
          out.push(a.map((x, k) => x + (b[k] - x) * t));
        }
      }
      return out;
    };
  for (const positive of [false, true]) {
    const ring = clip(positive);
    if (ring.length < 3) continue;
    const ix = earcut(ring.flat());
    for (let j = 0; j < ix.length; j += 3)
      T(
        o,
        material,
        ix.slice(j, j + 3).map((i) => [ring[i][0], Y(ring[i]), ring[i][1]]),
        [0, 1, 0],
      );
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      points = [a],
      u = dot(a, perp) - mid,
      v = dot(b, perp) - mid;
    if (u * v < 0) {
      const t = u / (u - v);
      points.push(a.map((x, k) => x + (b[k] - x) * t));
    }
    points.push(b);
    for (let k = 0; k < points.length - 1; k++) {
      const A = points[k],
        B = points[k + 1];
      Q(
        o,
        'wall',
        [
          [A[0], eave, A[1]],
          [B[0], eave, B[1]],
          [B[0], Y(B), B[1]],
          [A[0], Y(A), A[1]],
        ],
        [B[1] - A[1], 0, A[0] - B[0]],
      );
    }
  }
  if (d > 1) {
    const umin = Math.min(...r.map((q) => dot(q, axis))),
      umax = Math.max(...r.map((q) => dot(q, axis))),
      A = [axis[0] * umin + perp[0] * mid, eave + rise + 0.025, axis[1] * umin + perp[1] * mid],
      B = [axis[0] * umax + perp[0] * mid, eave + rise + 0.025, axis[1] * umax + perp[1] * mid];
    rod(o, material, A, B, 0.075, 0);
  }
}
function church(o, d) {
  const r = rectXZ(0.42, -7.35, 26, 3);
  for (let i = 0; i < 4; i++) {
    const f = face(r, i);
    if (i !== 3) facade(o, r, i, 6.5, 14.8, d, i === 1 ? 0 : null, true);
    else {
      const sh = arch(f.len * 0.54, 10.5, 12.1, 0.72, d > 1 ? 10 : 4);
      flat(o, 'wall', f, rectangle(0, 6.5, f.len, 14.8), 0, C.wall, d ? [sh] : []);
      reveal(o, 'trim', f, sh, 0.3);
      flat(o, 'wood', f, sh, -0.3);
      if (d > 0) {
        for (let k = 0; k < 15; k++)
          box(
            o,
            'trim',
            0.28,
            6.5 + k * 0.267,
            3.8 - k * 0.29,
            0.95,
            0.267,
            0.62,
            vary(C.trim, 0.94),
          );
      }
    }
  }
  cap(o, 'wall', r, 6.5, false);
  roof(o, r, 14.8, 2.7, 'slate', d);
  for (const [z, radius] of [
    [-5.45, 1.4],
    [-2.25, 1.95],
    [1.02, 1.35],
    [5.4, 1.3],
  ]) {
    const n = [4, 6, 10, 14][d],
      ring = Array.from({ length: n + 1 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        return [26 + Math.cos(a) * radius, z + Math.sin(a) * radius];
      }),
      top = z > 3 ? 13.4 : 14.3;
    cap(o, 'wall', ring, 6.5, false);
    cap(o, 'wall', ring, top);
    for (let i = 0; i < n; i++) {
      const f = face(ring, i),
        holes = [];
      if (i === Math.floor(n / 2))
        for (const y of [7.7, 11.6]) {
          const sh = pane(o, f, f.len / 2, y, Math.min(0.38, f.len * 0.7), 0.76, d, 'arch');
          if (d) holes.push(sh);
        }
      flat(o, 'wall', f, rectangle(0, 6.5, f.len, top), 0, C.wall, holes);
    }
    for (let i = 0; i < n; i++)
      T(
        o,
        'slate',
        [
          [ring[i][0], top, ring[i][1]],
          [ring[i + 1][0], top, ring[i + 1][1]],
          [26, top + 1.0, z],
        ],
        [0, 1, 0],
      );
  }
  const chapel = rectXZ(14.4, 3, 26, 7.7);
  body(o, chapel, 6.5, 13.4, d);
  roof(o, chapel, 13.4, 0.75, 'slate', d);
}
function tower(o, d) {
  const r = P.towerOutline;
  cap(o, 'wall', r, 6.5, false);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i),
      holes = [];
    if (d > 0) {
      if (i % 2 === 0) holes.push(arch(f.len / 2, 6.5, 9.9, 0.9, d > 1 ? 10 : 4));
      for (const y of [17.1, 22.1])
        for (const sign of [-1, 1])
          holes.push(arch(f.len / 2 + sign * 0.98, y, y + 1.5, 0.46, d > 1 ? 8 : 4));
    }
    flat(o, 'wall', f, rectangle(0, 6.5, f.len, 27.7), 0, C.wall, holes);
    if (d === 0) {
      for (const y of [17.1, 22.1])
        for (const sign of [-1, 1])
          flat(o, 'wood', f, arch(f.len / 2 + sign * 0.98, y, y + 1.5, 0.46, 2), 0.015);
    } else for (const sh of holes) reveal(o, 'wall', f, sh, 0.4);
    for (const y of [11.7, 16.1, 21.1, 27.3])
      rect(o, 'trim', f, 0, y, f.len, y + 0.15, 0.06, vary(C.wall, 1.06));
    if (d > 1) {
      for (const x of [0.18, f.len - 0.18])
        rect(o, 'wall', f, x - 0.1, 10.3, x + 0.1, 26.7, 0.11, vary(C.wall, 0.96));
      for (let j = 0; j < 4; j++) {
        const x = (f.len * (j + 0.5)) / 4;
        flat(o, 'wall', f, arch(x, 12.3, 13.8, 0.47, 6), 0.025, vary(C.wall, 0.88));
      }
    }
  }
  cap(o, 'wall', r, 27.7);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i),
      n = d === 0 ? 1 : 4;
    for (let j = 0; j < n; j++) {
      const x = (f.len * (j + 0.5)) / n,
        q = f.P(x, 27.7);
      box(o, 'wall', q[0], 27.7, q[2], 0.62, 0.6, 0.62);
    }
  }
}
function shaft(o, f, x, y, d) {
  const n = d === 1 ? 4 : d === 2 ? 6 : 8;
  for (const off of [-0.13, 0.13]) {
    const q = f.P(x + off, y, 0.02);
    const ring = (Y, rad) =>
      Array.from({ length: n }, (_, i) => [
        q[0] + Math.cos((i * 2 * Math.PI) / n) * rad,
        Y,
        q[2] + Math.sin((i * 2 * Math.PI) / n) * rad,
      ]);
    const A = ring(y, 0.085),
      B = ring(y + 1.65, 0.085);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(
        o,
        'trim',
        [A[i], A[j], B[j], B[i]],
        [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
        vary(C.trim, off < 0 ? 0.97 : 1.03),
      );
    }
    if (d > 1) {
      box(o, 'trim', q[0], y - 0.1, q[2], 0.25, 0.1, 0.25);
      box(o, 'trim', q[0], y + 1.65, q[2], 0.28, 0.19, 0.28, vary(C.trim, 0.94));
    }
  }
}
function cloister(o, d) {
  const backFace = (f) => ({
    ...f,
    n: f.n.map((v) => -v),
    P: (x, y, z = 0) => f.P(x, y, -0.28 - z),
  });
  cap(o, 'wall', H, 6.5, true, rgb('b8ad96'));
  const sg = H.reduce((s, a, i) => {
    const b = H[(i + 1) % H.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  for (let i = 0; i < H.length; i++) {
    const raw = face(H, i),
      f = { ...raw, n: raw.n.map((v) => -v), P: (x, y, z = 0) => raw.P(x, y, -z) },
      n = d < 2 ? Math.ceil(P.courtBays[i] / 2) : P.courtBays[i],
      holes = [],
      gap = (0.92 * f.len) / n;
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) * f.len) / n,
        sh = arch(x, 6.95, 8.4, gap / 2, d > 1 ? 10 : 4);
      if (d) holes.push(sh);
      else rect(o, 'wood', f, x - gap / 2, 6.95, x + gap / 2, 8.95, 0.02);
      if (d) shaft(o, f, ((j + 1) * f.len) / n, 7.0, d);
    }
    flat(o, 'wall', f, rectangle(0, 6.5, f.len, 9.35), 0, C.wall, holes);
    flat(o, 'wall', backFace(f), rectangle(0, 6.5, f.len, 9.35), 0, C.wall, holes);
    if (d) for (const sh of holes) reveal(o, 'trim', f, sh, 0.28);
    const edge = H[i],
      b = H[(i + 1) % H.length],
      u = [(b[0] - edge[0]) / f.len, (b[1] - edge[1]) / f.len],
      out = [sg > 0 ? u[1] : -u[1], sg > 0 ? -u[0] : u[0]],
      width = 2.1,
      outerA = [edge[0] + out[0] * width, edge[1] + out[1] * width],
      outerB = [b[0] + out[0] * width, b[1] + out[1] * width];
    Q(
      o,
      i % 2 === 0 ? 'slate' : 'tile',
      [
        [edge[0], 9.5, edge[1]],
        [b[0], 9.5, b[1]],
        [outerB[0], 10.7, outerB[1]],
        [outerA[0], 10.7, outerA[1]],
      ],
      [0, 1, 0],
    );
  }
  // Open outer cliff-side gallery, as seen in the whole-abbey reference.
  const f = face(R, 5),
    holes = [],
    n = d === 0 ? 4 : 7;
  for (let j = 0; j < n; j++) {
    const sh = arch((f.len * (j + 0.5)) / n, 6.95, 8.4, (f.len / n) * 0.39, d > 1 ? 8 : 4);
    if (d) holes.push(sh);
    else
      rect(
        o,
        'wood',
        f,
        (f.len * (j + 0.5)) / n - (f.len / n) * 0.39,
        6.95,
        (f.len * (j + 0.5)) / n + (f.len / n) * 0.39,
        8.95,
        0.015,
      );
  }
  flat(o, 'wall', f, rectangle(0, 6.5, f.len, 9.35), 0, C.wall, holes);
  flat(o, 'wall', backFace(f), rectangle(0, 6.5, f.len, 9.35), 0, C.wall, holes);
  if (d) for (const sh of holes) reveal(o, 'trim', f, sh, 0.28);
  Q(
    o,
    'slate',
    [f.P(0, 9.5, 0), f.P(f.len, 9.5, 0), f.P(f.len, 10.7, -2.2), f.P(0, 10.7, -2.2)],
    [0, 1, 0],
  );
}
function support(o, f, x) {
  const w = 0.55,
    q = [
      f.P(x - w / 2, 0, 0),
      f.P(x + w / 2, 0, 0),
      f.P(x + w / 2, 0, 2.2),
      f.P(x - w / 2, 0, 2.2),
    ],
    top = [
      f.P(x - w / 2, 6.55, 0),
      f.P(x + w / 2, 6.55, 0),
      f.P(x + w / 2, 4.8, 2.2),
      f.P(x - w / 2, 4.8, 2.2),
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, 'wall', [q[i], q[j], top[j], top[i]], null);
  }
  Q(o, 'wall', top, [0, 1, 0]);
}
function monastic(o, d) {
  capHole(o, 'wall', R, H, 6.5);
  for (let i = 0; i < R.length; i++) {
    const f = face(R, i);
    rect(o, 'wall', f, 0, 0, f.len, 6.5);
  }
  cap(o, 'wall', R, 0, false);
  for (const [i, n] of [
    [4, 3],
    [5, 3],
    [7, 2],
  ]) {
    const f = face(R, i);
    for (let j = 0; j < n; j++) support(o, f, (f.len * (j + 0.5)) / n);
  }
  const west = [...R.slice(0, 5), ...R.slice(20)],
    link = [R[4], R[20], [0.42, 5.8], [-8.8, 7.0]],
    east = [R[8], R[9], R[10], R[11], R[12], H[0], H[1]];
  for (const [part, eave, rise] of [
    [west, 14.1, 2.9],
    [link, 12.2, 2.2],
    [east, 14.1, 2.9],
  ]) {
    body(o, part, 6.5, eave, d);
    roof(o, part, eave, rise, 'tile', d);
  }
}
function annex(o, d) {
  const r = p.annex;
  body(o, r, 0, 8.8, d);
  roof(o, r, 8.8, 3, 'slate', d);
  const f = face(r, 0);
  if (d > 0)
    for (let j = 0; j < 3; j++) {
      const x = (f.len * (j + 1)) / 4,
        pts = [
          f.P(x - 0.65, 0, -0.55),
          f.P(x + 0.65, 0, -0.55),
          f.P(x + 0.65, 0, -1.9),
          f.P(x - 0.65, 0, -1.9),
        ].map((v) => [v[0], v[2]]);
      body(o, pts, 9.65, 10.95, d);
      roof(o, pts, 10.95, 0.65, 'slate', d);
      rect(o, 'glass', f, x - 0.4, 10.15, x + 0.4, 10.78, -0.54);
    }
  const fEnd = face(r, 7),
    mid = fEnd.P(fEnd.len / 2, 0, -0.2);
  box(o, 'wood', mid[0], 0.05, mid[2], 0.9, 2.05, 0.25);
  for (const t of [0.3, 0.76]) {
    const q = f.P(f.len * t, 9.2, -2.2);
    box(o, 'wall', q[0], 9.2, q[2], 0.45, 2.5, 0.55);
  }
  if (d > 0) {
    const a = fEnd.P(0, 3.8, 0.1),
      b = fEnd.P(fEnd.len, 3.8, 0.1),
      c = fEnd.P(fEnd.len, 3.1, 1.8),
      e = fEnd.P(0, 3.1, 1.8);
    Q(o, 'tile', [a, b, c, e], [0, 1, 0]);
  }
}
function build(o, _f, d = 3) {
  monastic(o, d);
  church(o, d);
  tower(o, d);
  cloister(o, d);
  annex(o, d);
}
export const abbeyOfSaintMartinDuCanigouSkyline = (o, f) => build(o, f, 0),
  abbeyOfSaintMartinDuCanigouDistrict = (o, f) => build(o, f, 1),
  abbeyOfSaintMartinDuCanigouStreet = (o, f) => build(o, f, 2),
  abbeyOfSaintMartinDuCanigouCloseup = (o, f) => build(o, f, 3);
export const abbeyOfSaintMartinDuCanigouModel = {
  id: 'abbey_of_saint_martin_du_canigou',
  key: 'abbey_of_saint_martin_du_canigou',
  cell: 'sp/sp9',
  recipe: 'structure-abbey-of-saint-martin-du-canigou.mjs',
  title: 'Abbey of Saint-Martin-du-Canigou',
  category: 'religious',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-80, 60, 92],
  lookAt: [3, 12, 7],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.1, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-restored-abbey-tower-cloister-wings-and-attached-annex',
      position: [-68, 58, 85],
      lookAt: [3, 12, 7],
      reviewLod: 'skyline',
    },
    {
      name: 'crenellated-open-bell-tower-and-four-apsidal-east-end',
      position: [64, 36, -16],
      lookAt: [21, 17, -3],
    },
    {
      name: 'true-trapezoidal-court-and-open-marble-column-arcades',
      position: [-12, 23, 39],
      lookAt: [1, 8.5, 13],
    },
    {
      name: 'three-slate-dormers-lower-annex-and-intrinsic-cliff-buttresses',
      position: [-3, 25, 75],
      lookAt: [8, 8, 30],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129-square2m field frozen before geometry; stepped crypt/court/annex floors and intrinsic buttress foundations are architectural estimates, not terrain fits; host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-abbey-of-saint-martin-du-canigou.mjs',
    level: 'skyline',
    export: 'abbeyOfSaintMartinDuCanigouSkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'abbeyOfSaintMartinDuCanigouDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'abbeyOfSaintMartinDuCanigouStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'abbeyOfSaintMartinDuCanigouCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Complete surviving restored compound:church3choirapses+Gauderiqueapse/two church levels, crenellated tower/paired upper openings, trapezoidal courtyard with open galleries/paired shafts, red-tiled monastic wings, intrinsic supporting buttresses/stairs and attached slate annex3dormers/chimneys. Small capital/stone carving/hidden rear fenestration and exact bay counts simplified or estimated. Native plan is a building-envelope proxy; curved apses/individual roof parts interpret the clear own PD plan/2019CC0 overview. No invented complete1009appearance.',
    'Published Qualla own-drawn upper-church PD plan inspected/exact nativeSHA1matched; primary source explicitlyselbstgezeichnet/JochenJahnke PD-user-de. Supplemental2019Chris06 selfCC0 whole-abbey original inspected/nativeSHA1matched. Original published CC0 landscape andSaint-Martin-le-Vieux captions excluded; attributed/free-use/historical-ruin views not adopted. No media metadata/categories/articlebody/policy changes, protected photo textures or generated bitmaps.',
    'Two-level church crypt/court floor6.5m, upper10.5m, towercrenels28.3m/relative22m above court, monastic eaves14.1m, lower annexfloor0/slateridge11.8m are photo/plan architectural estimates, not surveyed levels or fitted terrain. Actual host cliff burial/abutment/grades unverified. General mountain/cliff background/trails/trees/refuge/independent huts/temporary awnings/visitors/interiors excluded.',
    'Independent256m129-square2mfield/all16641samples/2originalTerrariumtiles/PNG frozen before geometry unchanged; provider datum1047.6265m/sourcepixel3.52062m/absolute920.5115–1094.4993m not survey accuracy. No flattening/fitting/reacquisition; flat review fixtures separate from actual hillside. Ordinary geographic preview, replacement disabled.',
  ],
};

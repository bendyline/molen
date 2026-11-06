/** 'palace_of_versailles': complete principal palace, long wings, chapel andforecourt pavilions. +X NNE,+Z ESE. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

// This pin also invalidates the runtime LOD recipe when external controls change.
const controlBytes = readFileSync(new URL('../layout.json', import.meta.url));
if (
  createHash('sha256').update(controlBytes).digest('hex') !==
  'd9d7fa72caa946c7773f18ff6326255dd28a61f812c7c3b74c2f92a5fcb7b75a'
)
  throw Error('Versailles controls changed: update the explicit geometry input pin');
export const versaillesControls = JSON.parse(controlBytes);
const a = versaillesControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('ddd6c7'),
    brick: lin('b18a76'),
    gold: lin('cfb66f'),
    check: lin('d8d7cc'),
    accent: lin('d1c4ab'),
    lead: lin('9ba6a7'),
    stone: lin('e5dfd0'),
    base: lin('c6c3b6'),
    roof: lin('707985'),
    glass: lin('4b6170'),
    wood: lin('e5e4d9'),
    metal: lin('52615f'),
    dark: lin('5b5d5c'),
    paving: lin('b8ac98'),
  };
export const versaillesSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.86, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.65, metallic: 0.35 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 2, step: 99, stairs: 3 },
  district: { n: 4, arch: 2, step: 30, stairs: 4, flat: true },
  street: { n: 6, arch: 4, step: 12, stairs: 8, dormers: true, flatWindows: true },
  closeup: { n: 6, arch: 6, step: 5.5, stairs: 14, dormers: true, details: true },
  master: { n: 20, arch: 20, step: 5.5, stairs: 24, dormers: true, details: true, fine: true },
};
const clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 1e-5) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((n, p, i) => {
      const q = r[(i + 1) % r.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  },
  S = (c, s) => (c.far ? 'far' : s),
  P = (p) => p;
function Q(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addQuad(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function T(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    Z = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * Z[2] - A[2] * Z[1], A[2] * Z[0] - A[0] * Z[2], A[0] * Z[1] - A[1] * Z[0]) <
    1e-10
  )
    return;
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    color,
  );
}
const B = (o, c, lo, hi, s = 'stone', color = C.stone) => box(o, S(c, s), lo, hi, color),
  L = (o, c, r, s = 'stone', color = C.stone) => loft(o, S(c, s), r, color),
  span = (o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.stone) =>
    beam(o, S(c, s), A, Z, w, d, color);
function cap(o, c, rs, y, s = 'wall', color = C.wall, up = true) {
  const rings = rs.map(clean),
    p = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      s,
      color,
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, c, rs, lo, hi, s = 'wall', color = C.wall) {
  for (const [ri, raw] of rs.entries()) {
    const r = ri ? cw(raw).reverse() : cw(raw);
    for (let j = 0; j < r.length; j++) {
      const A = r[j],
        Z = r[(j + 1) % r.length];
      Q(
        o,
        c,
        [
          [A[0], lo, A[1]],
          [Z[0], lo, Z[1]],
          [Z[0], hi, Z[1]],
          [A[0], hi, A[1]],
        ],
        s,
        color,
      );
    }
  }
  cap(o, c, rs, lo, s, color, false);
  cap(o, c, rs, hi, s, color);
}
const sub = (p, q) => p.map((v, i) => v - q[i]),
  mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t),
  faceNormal = (F) => sub(F(0, 0, 1), F(0, 0, 0));
function rectangleWindow(o, c, F, width, lo, height, door = false) {
  const p = [
      [-width / 2, lo],
      [width / 2, lo],
      [width / 2, lo + height],
      [-width / 2, lo + height],
    ],
    N = faceNormal(F);
  Q(
    o,
    c,
    p.map((p) => F(...p, 0.08)),
    door ? 'wood' : 'glass',
    door ? C.metal : C.glass,
    N,
  );
  if (c.flat || c.flatWindows) return;
  const outer = [
    [-width / 2 - 0.12, lo - 0.1],
    [width / 2 + 0.12, lo - 0.1],
    [width / 2 + 0.12, lo + height + 0.1],
    [-width / 2 - 0.12, lo + height + 0.1],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (c.fine) span(o, c, F(...p[i], 0.14), F(...p[j], 0.14), 0.14, 0.12, 'wood', C.wood);
    else
      Q(
        o,
        c,
        [F(...p[i], 0.14), F(...p[j], 0.14), F(...outer[j], 0.14), F(...outer[i], 0.14)],
        'wood',
        C.wood,
        N,
      );
  }
  for (const [A, Z] of [
    [
      [-0.035, lo],
      [0.035, lo + height],
    ],
    [
      [-width / 2, lo + height * 0.5 - 0.035],
      [width / 2, lo + height * 0.5 + 0.035],
    ],
  ])
    Q(
      o,
      c,
      [F(A[0], A[1], 0.16), F(Z[0], A[1], 0.16), F(Z[0], Z[1], 0.16), F(A[0], Z[1], 0.16)],
      'wood',
      C.wood,
      N,
    );
  if (c.fine)
    for (const side of [-1, 1])
      span(
        o,
        c,
        F((side * width) / 2, lo - 0.1, 0.1),
        F((side * width) / 2, lo + height + 0.1, 0.1),
        0.18,
        0.18,
        'stone',
        C.stone,
      );
}
function mappedCap(o, c, rs, height, s, color) {
  const rings = rs.map(clean),
    p = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [p[j][0], height(p[j]), p[j][1]]),
      s,
      color,
      [0, 1, 0],
    );
}
function hip(o, c, rs, lo, hi, color = C.roof, flat = false, roofData) {
  const r = cw(rs[0]),
    xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    X = Math.max(...xs) - Math.min(...xs),
    Z = Math.max(...zs) - Math.min(...zs),
    center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
    inset = Math.min(X, Z) * 0.46;
  const fraction = (p) =>
      roofData
        ? Math.max(
            0,
            Math.min(
              1,
              (p[0] - roofData.bounds[0]) / roofData.inset,
              (roofData.bounds[2] - p[0]) / roofData.inset,
              (p[1] - roofData.bounds[1]) / roofData.inset,
              (roofData.bounds[3] - p[1]) / roofData.inset,
            ),
          )
        : Math.max(
            0,
            Math.min(
              1,
              (p[0] - Math.min(...xs)) / inset,
              (Math.max(...xs) - p[0]) / inset,
              (p[1] - Math.min(...zs)) / inset,
              (Math.max(...zs) - p[1]) / inset,
            ),
          ),
    height = (p) => lo + (hi - lo) * fraction(p);
  if (roofData || flat) {
    for (let i = 0; i < r.length; i++) {
      if (c.far && roofData?.exposed?.[i] === false) continue;
      const bottom = c.far && roofData?.exposed?.[i] !== false ? -12 : lo;
      const j = (i + 1) % r.length,
        A = r[i],
        Z = r[j],
        Ay = flat ? lo : height(A),
        Zy = flat ? lo : height(Z),
        N = [-(Z[1] - A[1]), 0, Z[0] - A[0]],
        s = c.far ? 'wall' : 'roof',
        col = c.far ? C.wall : color;
      if (Zy - bottom > 1e-5)
        T(
          o,
          c,
          [
            [A[0], bottom, A[1]],
            [Z[0], bottom, Z[1]],
            [Z[0], Zy, Z[1]],
          ],
          s,
          col,
          N,
        );
      if (Ay - bottom > 1e-5)
        T(
          o,
          c,
          [
            [A[0], bottom, A[1]],
            [Z[0], Zy, Z[1]],
            [A[0], Ay, A[1]],
          ],
          s,
          col,
          N,
        );
    }
    if (flat) {
      cap(o, c, rs, lo, 'metal', C.lead);
      return;
    }
    for (const cell of roofData.cells)
      for (const p of cell.polygons) mappedCap(o, c, p, height, 'roof', color);
    for (const p of roofData.top) cap(o, c, p, hi, 'roof', color);
  }
  const top = r.map(([x, z]) => [
    center[0] + (x - center[0]) * (X < Z ? 0.025 : Math.max(0.03, 1 - (2 * inset) / X)),
    center[1] + (z - center[1]) * (Z <= X ? 0.025 : Math.max(0.03, 1 - (2 * inset) / Z)),
  ]);
  if (!roofData) {
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        o,
        c,
        [
          [r[i][0], lo, r[i][1]],
          [r[j][0], lo, r[j][1]],
          [top[j][0], hi, top[j][1]],
          [top[i][0], hi, top[i][1]],
        ],
        'roof',
        color,
        [0, 1, 0],
      );
    }
    cap(o, c, [top], hi, 'roof', color);
  }
  if (!c.far && c.fine && !roofData)
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length,
        len = Math.hypot(...sub(r[j], r[i]));
      for (let k = 1; k < Math.floor(len / 0.9); k++) {
        const t = k / Math.floor(len / 0.9),
          p = mix(r[i], r[j], t),
          q = mix(top[i], top[j], t);
        span(o, c, [p[0], lo + 0.02, p[1]], [q[0], hi + 0.02, q[1]], 0.018, 0.018, 'roof', color);
      }
    }
  if (!c.dormers) return;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      A = r[i],
      Z = r[j],
      len = Math.hypot(...sub(Z, A));
    if (len < 22) continue;
    const Tt = sub(Z, A).map((v) => v / len),
      N = [-Tt[1], Tt[0]],
      count = Math.max(1, Math.floor(len / (c.fine ? 7.5 : c.details ? 12 : 24))),
      d = Math.min(2, inset * 0.42);
    for (let k = 0; k < count; k++) {
      const p = mix(A, Z, (k + 0.5) / count),
        center = [p[0] - N[0] * d, p[1] - N[1] * d],
        y = height(center),
        F = (u, Y, z = 0) => [
          center[0] + Tt[0] * u + N[0] * z,
          Y,
          center[1] + Tt[1] * u + N[1] * z,
        ],
        w = c.details ? 1.8 : 1.5;
      for (const depth of [-0.7, 0.65])
        Q(
          o,
          c,
          [
            F(-w / 2, y - 0.15, depth),
            F(w / 2, y - 0.15, depth),
            F(w / 2, y + 1.65, depth),
            F(-w / 2, y + 1.65, depth),
          ],
          'wood',
          C.wood,
          faceNormal(F).map((v) => (depth > 0 ? v : -v)),
        );
      Q(
        o,
        c,
        [
          F(-w / 2, y - 0.15, -0.7),
          F(-w / 2, y - 0.15, 0.65),
          F(-w / 2, y + 1.65, 0.65),
          F(-w / 2, y + 1.65, -0.7),
        ],
        'wood',
        C.wood,
      );
      Q(
        o,
        c,
        [
          F(w / 2, y - 0.15, 0.65),
          F(w / 2, y - 0.15, -0.7),
          F(w / 2, y + 1.65, -0.7),
          F(w / 2, y + 1.65, 0.65),
        ],
        'wood',
        C.wood,
      );
      for (const depth of [-0.7, 0.65])
        T(
          o,
          c,
          [F(-w / 2, y + 1.65, depth), F(w / 2, y + 1.65, depth), F(0, y + 2.2, depth)],
          'wood',
          C.wood,
          faceNormal(F).map((v) => (depth > 0 ? v : -v)),
        );
      Q(
        o,
        c,
        [
          F(-w / 2 - 0.1, y + 1.65, -0.85),
          F(-w / 2 - 0.1, y + 1.65, 0.82),
          F(0, y + 2.25, 0.82),
          F(0, y + 2.25, -0.85),
        ],
        'roof',
        color,
        [0, 1, 0],
      );
      Q(
        o,
        c,
        [
          F(0, y + 2.25, -0.85),
          F(0, y + 2.25, 0.82),
          F(w / 2 + 0.1, y + 1.65, 0.82),
          F(w / 2 + 0.1, y + 1.65, -0.85),
        ],
        'roof',
        color,
        [0, 1, 0],
      );
      rectangleWindow(o, c, (u, Y, z = 0) => F(u, Y, 0.68 + z), w * 0.72, y + 0.05, 1.3);
    }
  }
}

function inside(r, p) {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const A = r[i],
      Z = r[j];
    if (
      A[1] > p[1] !== Z[1] > p[1] &&
      p[0] < ((Z[0] - A[0]) * (p[1] - A[1])) / (Z[1] - A[1]) + A[0]
    )
      hit = !hit;
  }
  return hit;
}
const inBody = (b, p) =>
    b.polygons.some((rs) => inside(rs[0], p) && !rs.slice(1).some((r) => inside(r, p))),
  bodyAt = (p) => a.bodies.find((b) => inBody(b, p));
function archWindow(o, c, F, width, lo, peak, door = false, gold = false) {
  const r = width / 2,
    spring = peak - r * 0.9,
    p = [
      [-r, lo],
      ...Array.from({ length: c.arch + 1 }, (_, i) => {
        const t = Math.PI - (i / c.arch) * Math.PI;
        return [Math.cos(t) * r, spring + Math.sin(t) * (peak - spring)];
      }),
      [r, lo],
    ],
    ids = earcut(p.flat(), [], 2),
    N = faceNormal(F);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => F(...p[j], 0.09)),
      door ? 'wood' : 'glass',
      door ? C.metal : C.glass,
      N,
    );
  if (c.flat || c.flatWindows) return;
  const cy = (lo + peak) / 2,
    outer = p.map(([x, y]) => [x * 1.12, cy + (y - cy) * 1.04]),
    s = gold ? 'metal' : 'stone',
    col = gold ? C.gold : C.stone;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    if (c.fine) span(o, c, F(...p[i], 0.14), F(...p[j], 0.14), 0.16, 0.13, s, col);
    else
      Q(
        o,
        c,
        [F(...p[i], 0.14), F(...p[j], 0.14), F(...outer[j], 0.14), F(...outer[i], 0.14)],
        s,
        col,
        N,
      );
  }
  Q(
    o,
    c,
    [
      F(-0.045, lo, 0.16),
      F(0.045, lo, 0.16),
      F(0.045, peak - 0.2, 0.16),
      F(-0.045, peak - 0.2, 0.16),
    ],
    'wood',
    C.wood,
    N,
  );
  const Y = lo + (spring - lo) * 0.55;
  Q(
    o,
    c,
    [F(-r, Y - 0.04, 0.16), F(r, Y - 0.04, 0.16), F(r, Y + 0.04, 0.16), F(-r, Y + 0.04, 0.16)],
    'wood',
    C.wood,
    N,
  );
}
function profileColumn(o, c, p, lo, hi, r = 0.4, s = 'stone', color = C.stone) {
  const rings = c.fine
    ? [
        [lo, r * 1.5],
        [lo + 0.22, r * 1.5],
        [lo + 0.4, r],
        [hi - 0.65, r * 0.85],
        [hi - 0.35, r * 1.5],
        [hi, r * 1.5],
      ]
    : [
        [lo, r],
        [hi, r],
      ];
  L(
    o,
    c,
    rings.map(([y, R]) => radialRing(y, R, R, c.n, p)),
    s,
    color,
  );
}
function urn(o, c, p, scale = 1, gold = false) {
  const s = gold ? 'metal' : 'stone',
    col = gold ? C.gold : C.stone;
  L(
    o,
    c,
    (c.fine
      ? [
          [0, 0.28],
          [0.2, 0.4],
          [0.45, 0.2],
          [1.05, 0.46],
          [1.4, 0.3],
          [1.52, 0.38],
          [1.8, 0.03],
        ]
      : [
          [0, 0.28],
          [0.45, 0.2],
          [1.05, 0.46],
          [1.8, 0.03],
        ]
    ).map(([y, r]) => radialRing(p[1] + y * scale, r * scale, r * scale, c.n, [p[0], p[2]])),
    s,
    col,
  );
}
function faceStrip(o, c, F, u, v, lo, hi, d = 0.18) {
  Q(o, c, [F(u, lo, d), F(v, lo, d), F(v, hi, d), F(u, hi, d)], 'stone', C.stone, faceNormal(F));
}
function parapet(o, c, F, len, eave) {
  if (c.far) return;
  if (c.flat) return;
  for (const y of [eave + 0.12, eave + 1.1]) {
    if (c.fine) span(o, c, F(0, y, 0.08), F(len, y, 0.08), 0.2, 0.28);
    else faceStrip(o, c, F, 0, len, y - 0.1, y + 0.1);
  }
  if (c.flat) return;
  const count = Math.max(1, Math.round(len / (c.fine ? 1.6 : c.details ? 3.8 : 12)));
  for (let j = 0; j <= count; j++) {
    const u = (j * len) / count,
      p = F(u, eave + 0.15, 0.08);
    if (c.fine) profileColumn(o, c, [p[0], p[2]], eave + 0.15, eave + 1.1, 0.11);
    else faceStrip(o, c, F, u - 0.065, u + 0.065, eave + 0.15, eave + 1.1);
  }
  if (c.details)
    for (let j = 0; j <= Math.floor(len / 15); j++) {
      const u = ((j + 0.5) * len) / (Math.floor(len / 15) + 1);
      urn(o, c, F(u, eave + 1.18, 0.08), 1);
    }
}
function facade(o, c) {
  if (c.far) return;
  for (const rs of a.whole)
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw).reverse() : cw(raw);
      for (let j = 0; j < r.length; j++) {
        const A = r[j],
          Z = r[(j + 1) % r.length],
          len = Math.hypot(...sub(Z, A));
        if (len < 3) continue;
        const tangent = sub(Z, A).map((v) => v / len),
          N = [-tangent[1], tangent[0]],
          F = (u, y, d = 0) => [
            A[0] + tangent[0] * u + N[0] * d,
            y,
            A[1] + tangent[1] * u + N[1] * d,
          ],
          mid = mix(A, Z, 0.5),
          b = bodyAt([mid[0] - N[0] * 0.1, mid[1] - N[1] * 0.1]),
          eave = b?.eave ?? 18.8,
          chapel = b?.kind === 'chapel',
          marble = Math.abs(mid[0]) < 33 && mid[1] > -55 && mid[1] < -9,
          coreGarden = Math.abs(mid[0]) < 55 && mid[1] < -25 && N[1] < -0.6,
          count = Math.max(1, Math.round(len / (chapel ? c.step * 0.8 : c.step)));
        if (marble)
          Q(
            o,
            c,
            [
              F(0, 2.5, 0.018),
              F(len, 2.5, 0.018),
              F(len, eave - 0.5, 0.018),
              F(0, eave - 0.5, 0.018),
            ],
            'brick',
            C.brick,
            [N[0], 0, N[1]],
          );
        for (let k = 0; k < count; k++) {
          const u = ((k + 0.5) * len) / count,
            p = F(u, 0),
            f = (x, y, d = 0) => F(u + x, y, d),
            B = bodyAt([p[0] - N[0] * 0.1, p[2] - N[1] * 0.1]),
            height = B?.eave ?? eave,
            portico = p[0] > 34.4 && p[0] < 49.3 && p[2] > 69.5 && p[2] < 73.6,
            clockFace = Math.abs(p[0] - a.clock.center[0]) < 10 && p[2] > -48 && p[2] < -47;
          if (clockFace) continue;
          if (chapel) {
            archWindow(o, c, f, Math.min(3.5, (len / count) * 0.62), 3.2, 9.1);
            archWindow(o, c, f, Math.min(3.5, (len / count) * 0.62), 11, 26.5);
          } else {
            const ground = coreGarden ? -4.2 : p[0] > 125 ? 4.6 : 2.5;
            if (!portico) {
              archWindow(
                o,
                c,
                f,
                Math.min(2.3, (len / count) * 0.56),
                ground + 0.3,
                ground + 4.7,
                false,
                marble,
              );
              if (coreGarden) archWindow(o, c, f, Math.min(2.5, (len / count) * 0.58), 2.3, 9.2);
              else rectangleWindow(o, c, f, Math.min(2.15, (len / count) * 0.52), 9.5, 4.3);
              rectangleWindow(
                o,
                c,
                f,
                Math.min(1.9, (len / count) * 0.5),
                15.4,
                Math.min(2, height - 16.1),
              );
            } else if (height > 20) rectangleWindow(o, c, f, 1.7, 18.6, 2);
          }
        }
        if (!c.flat)
          for (const y of [coreGarden ? -0.2 : 8.1, 14.9, eave - 0.2]) {
            if (mid[0] > 34.4 && mid[0] < 49.3 && mid[1] > 69.5 && y < a.portico.eave) continue;
            if (c.fine) span(o, c, F(0, y, 0.08), F(len, y, 0.08), 0.25, 0.3);
            else faceStrip(o, c, F, 0, len, y - 0.125, y + 0.125);
          }
        if (!c.flat)
          for (let k = 0; k <= count; k++) {
            const u = (k * len) / count,
              p = F(u, 0);
            if (p[0] > 34.4 && p[0] < 49.3 && p[2] > 69.5) continue;
            const lo = coreGarden ? 1.4 : 8.6,
              hi = chapel ? 27 : eave - 3;
            if (c.fine) {
              const q = F(u, lo, 0.24);
              profileColumn(o, c, [q[0], q[2]], lo, hi, chapel ? 0.34 : 0.22);
            } else faceStrip(o, c, F, u - 0.16, u + 0.16, lo, hi, 0.26);
          }
        if (!ri) parapet(o, c, F, len, eave);
        if (marble && !c.flat) {
          span(o, c, F(0, eave + 0.7, 0.15), F(len, eave + 0.7, 0.15), 0.14, 0.14, 'metal', C.gold);
          if (c.details)
            for (let k = 0; k <= Math.floor(len / 6); k++)
              urn(
                o,
                c,
                F(((k + 0.5) * len) / (Math.floor(len / 6) + 1), eave + 0.75, 0.12),
                0.55,
                true,
              );
        }
      }
    }
}
function clockAndBalcony(o, c) {
  const k = a.clock,
    [x, z] = k.center,
    F = (u, y, d = 0) => [x + u, y, z + d];
  B(o, c, [x - 6, k.stageBase, z - 9], [x + 6, k.stageTop, z - 0.05]);
  hip(
    o,
    c,
    [
      [
        [x - 6, z - 9],
        [x + 6, z - 9],
        [x + 6, z - 0.05],
        [x - 6, z - 0.05],
      ],
    ],
    k.stageTop,
    k.roofY,
    C.roof,
  );
  const N = [0, 0, 1],
    y = k.faceY,
    r = k.radius;
  for (let i = 0; i < c.n; i++) {
    const p = (t) => F(Math.cos(t) * r, y + Math.sin(t) * r, 0.08);
    T(
      o,
      c,
      [F(0, y, 0.08), p((i / c.n) * Math.PI * 2), p(((i + 1) / c.n) * Math.PI * 2)],
      'metal',
      C.gold,
      N,
    );
  }
  if (c.far) return;
  span(o, c, F(0, y, 0.12), F(-0.5, y + 0.4, 0.12), 0.08, 0.08, 'metal', C.metal);
  span(o, c, F(0, y, 0.12), F(0.15, y + 0.75, 0.12), 0.08, 0.08, 'metal', C.metal);
  for (const u of [-6, 0, 6]) {
    archWindow(o, c, (dx, Y, d = 0) => F(u + dx, Y, d), 2.8, 2.8, 7.7, true, true);
    rectangleWindow(o, c, (dx, Y, d = 0) => F(u + dx, Y, d), 2.8, 9.5, 4.4);
  }
  B(o, c, [x - 6.8, k.balconyY, z - 0.2], [x + 6.8, k.balconyY + 0.35, z + 1.6]);
  for (const depth of [0.2, 1.5])
    span(
      o,
      c,
      F(-6.7, k.balconyY + 1.35, depth),
      F(6.7, k.balconyY + 1.35, depth),
      0.13,
      0.13,
      'metal',
      C.gold,
    );
  for (let j = 0; j < (c.fine ? 38 : c.details ? 22 : 8); j++) {
    const count = c.fine ? 38 : c.details ? 22 : 8,
      u = -6.6 + (j * 13.2) / (count - 1);
    span(
      o,
      c,
      F(u, k.balconyY + 0.35, 1.5),
      F(u, k.balconyY + 1.35, 1.5),
      0.075,
      0.075,
      'metal',
      C.gold,
    );
  }
  for (const u of [-6, 6]) urn(o, c, F(u, k.stageTop + 0.2, 0), 0.8, true);
  T(
    o,
    c,
    [F(-3, k.stageTop + 0.2, 0.08), F(3, k.stageTop + 0.2, 0.08), F(0, k.roofY - 0.2, 0.08)],
    'stone',
    C.stone,
    N,
  );
  if (c.details) {
    for (const u of [-3, 3]) urn(o, c, F(u, k.stageTop + 0.2, 0.08), 0.65, true);
    urn(o, c, F(0, k.roofY - 0.2, 0.08), 0.9, true);
  }
}
function portico(o, c) {
  const p = a.portico,
    [x, z, X, Z] = p.bounds;
  B(o, c, [x - 0.2, -12, z], [X + 0.2, p.floorY + 0.45, Z + 0.6]);
  if (c.far) return;
  for (let j = 0; j < p.columns; j++) {
    const u = x + 0.55 + (j * (X - x - 1.1)) / (p.columns - 1);
    profileColumn(o, c, [u, Z - 0.25], p.floorY + 0.45, p.eave, 0.55);
  }
  for (const y of [p.eave, p.eave + 0.5]) B(o, c, [x - 0.7, y, z], [X + 0.7, y + 0.3, Z + 0.75]);
  T(
    o,
    c,
    [
      [x - 0.6, p.eave + 0.8, Z + 0.55],
      [X + 0.6, p.eave + 0.8, Z + 0.55],
      [(x + X) / 2, p.top, Z + 0.55],
    ],
    'stone',
    C.stone,
    [0, 0, 1],
  );
  for (const u of [(x + X) / 2 - 3.5, (x + X) / 2 + 3.5])
    archWindow(o, c, (dx, Y, d = 0) => [u + dx, Y, z + 0.09 + d], 2.4, p.floorY + 0.55, 9.5, true);
  const n = c.stairs;
  for (let j = 0; j < n; j++) {
    const z0 = Z + 0.6 + (j * 2) / n,
      y = p.floorY + 0.45 - (0.45 * j) / n;
    B(o, c, [x - 0.25, p.floorY - 0.1, z0], [X + 0.25, y, z0 + 2 / n]);
  }
}
function gate(o, c) {
  const g = a.gate,
    y = g.floorY;
  for (const x of g.posts) {
    B(o, c, [x - 0.4, -12, g.z - 0.35], [x + 0.4, y + g.height, g.z + 0.35], 'stone', C.stone);
    if (!c.far) urn(o, c, [x, y + g.height, g.z], 0.55, true);
  }
  for (const [A, Z] of [
    [-30, -6],
    [6, 30],
  ]) {
    for (const h of [y + 0.5, y + 4.7])
      span(o, c, [A, h, g.z], [Z, h, g.z], c.far ? 0.2 : 0.1, 0.1, 'metal', C.gold);
    if (c.far) continue;
    const n = c.flat ? 8 : Math.ceil((Z - A) / 0.5);
    for (let j = 0; j <= n; j++) {
      const x = A + (j * (Z - A)) / n;
      span(o, c, [x, y + 0.5, g.z], [x, y + 5.2, g.z], 0.07, 0.07, 'metal', C.gold);
    }
    if (c.details)
      for (let j = 0; j < 5; j++) {
        const x = A + ((j + 0.5) * (Z - A)) / 5;
        L(
          o,
          c,
          [
            radialRing(y + 5.1, 0.17, 0.17, c.n, [x, g.z]),
            radialRing(y + 5.6, 0.02, 0.02, c.n, [x, g.z]),
          ],
          'metal',
          C.gold,
        );
      }
  }
}
function gardenLanding(o, c) {
  const g = a.garden,
    [x, z, X, Z] = g.bounds;
  B(o, c, [x, -12, z], [X, g.floorY, Z], 'base', C.base);
  const [u, v, U, V] = g.stairBounds,
    n = c.stairs,
    [L, R] = g.outerY;
  for (let j = 0; j < n; j++) {
    const t = j / n,
      Tt = (j + 1) / n,
      zz = v + (V - v) * t,
      ZZ = v + (V - v) * Tt,
      yl = L + (g.floorY - L) * Tt,
      yr = R + (g.floorY - R) * Tt;
    T(
      o,
      c,
      [
        [u, yl, zz],
        [U, yr, zz],
        [U, yr, ZZ],
      ],
      'base',
      C.base,
      [0, 1, 0],
    );
    T(
      o,
      c,
      [
        [u, yl, zz],
        [U, yr, ZZ],
        [u, yl, ZZ],
      ],
      'base',
      C.base,
      [0, 1, 0],
    );
    Q(
      o,
      c,
      [
        [u, -12, zz],
        [U, -12, zz],
        [U, yr, zz],
        [u, yl, zz],
      ],
      'base',
      C.base,
      [0, 0, -1],
    );
    Q(
      o,
      c,
      [
        [u, -12, ZZ],
        [u, -12, zz],
        [u, yl, zz],
        [u, yl, ZZ],
      ],
      'base',
      C.base,
      [-1, 0, 0],
    );
    Q(
      o,
      c,
      [
        [U, -12, zz],
        [U, -12, ZZ],
        [U, yr, ZZ],
        [U, yr, zz],
      ],
      'base',
      C.base,
      [1, 0, 0],
    );
  }
}
function gateApproach(o, c) {
  const p = a.approach,
    [x, z, X, Z] = p.bounds,
    [L, R] = p.outerY,
    y = p.innerY;
  T(
    o,
    c,
    [
      [x, y, z],
      [X, y, z],
      [X, R, Z],
    ],
    'base',
    C.paving,
    [0, 1, 0],
  );
  T(
    o,
    c,
    [
      [x, y, z],
      [X, R, Z],
      [x, L, Z],
    ],
    'base',
    C.paving,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x, -12, z],
      [x, -12, Z],
      [x, L, Z],
      [x, y, z],
    ],
    'base',
    C.base,
    [-1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [X, -12, Z],
      [X, -12, z],
      [X, y, z],
      [X, R, Z],
    ],
    'base',
    C.base,
    [1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [x, -12, Z],
      [X, -12, Z],
      [X, R, Z],
      [x, L, Z],
    ],
    'base',
    C.base,
    [0, 0, 1],
  );
}
function skylineHoleWalls(o, c, rs, lo, hi, data) {
  const h = ([x, z]) =>
    lo +
    (hi - lo) *
      Math.max(
        0,
        Math.min(
          1,
          (x - data.bounds[0]) / data.inset,
          (data.bounds[2] - x) / data.inset,
          (z - data.bounds[1]) / data.inset,
          (data.bounds[3] - z) / data.inset,
        ),
      );
  for (const raw of rs.slice(1)) {
    const r = cw(raw).reverse();
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length,
        A = r[i],
        Z = r[j];
      Q(
        o,
        c,
        [
          [A[0], -12, A[1]],
          [Z[0], -12, Z[1]],
          [Z[0], h(Z), Z[1]],
          [A[0], h(A), A[1]],
        ],
        'wall',
        C.wall,
        [-(Z[1] - A[1]), 0, Z[0] - A[0]],
      );
    }
  }
}
export function buildVersaillesLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Versailles tier ' + level);
  for (const b of c.far ? a.skylineBodies : a.bodies) {
    const s = b.kind === 'brick-court' ? 'brick' : 'wall',
      col = b.kind === 'brick-court' ? C.brick : C.wall;
    if (!c.far && !c.flat) {
      const split = b.name === 'gabriel-pavilion' ? a.portico.eave : Math.min(8, b.eave);
      for (const rs of b.lower) {
        prism(o, c, rs, -12, 2.5, 'base', C.base);
        prism(o, c, rs, 2.5, split, s, col);
      }
      if (b.eave > split) for (const rs of b.polygons) prism(o, c, rs, split, b.eave, s, col);
    }
    const polygons = c.far ? b.skylinePolygons : b.polygons,
      roofs = c.far ? b.skylineRoofs : b.roofs;
    for (const [i, rs] of polygons.entries()) {
      if (c.flat) {
        const lo = b.name === 'gabriel-pavilion' ? a.portico.eave : -12;
        const ranges =
          b.name === 'gabriel-pavilion'
            ? [
                ...b.lower.map((rings) => ({ rings, bottom: -12, top: a.portico.eave })),
                { rings: rs, bottom: lo, top: b.eave },
              ]
            : [{ rings: rs, bottom: lo, top: b.eave }];
        for (const { rings, bottom, top } of ranges)
          for (const [ri, raw] of rings.entries()) {
            const r = ri ? cw(raw).reverse() : cw(raw);
            for (let j = 0; j < r.length; j++) {
              const A = r[j],
                Z = r[(j + 1) % r.length];
              Q(
                o,
                c,
                [
                  [A[0], bottom, A[1]],
                  [Z[0], bottom, Z[1]],
                  [Z[0], top, Z[1]],
                  [A[0], top, A[1]],
                ],
                s,
                col,
                [-(Z[1] - A[1]), 0, Z[0] - A[0]],
              );
            }
          }
      }
      hip(o, c, rs, b.eave, b.roofY, C.roof, false, roofs[i]);
      if (c.far) skylineHoleWalls(o, c, rs, b.eave, b.roofY, roofs[i]);
    }
  }
  facade(o, c);
  clockAndBalcony(o, c);
  portico(o, c);
  gate(o, c);
  gardenLanding(o, c);
  gateApproach(o, c);
  for (const court of a.enclosedCourts) cap(o, c, [court.outline], court.floorY, 'base', C.paving);
  for (const rs of a.openCourts) cap(o, c, rs, a.courtY, 'base', C.paving);
  for (const t of a.checkerTiles[level] ?? [])
    for (const rs of t.polygons) cap(o, c, rs, a.courtY + 0.005, 'base', t.dark ? C.dark : C.check);
  if (!c.far)
    for (const b of a.bodies) {
      if (b.kind === 'chapel') {
        const data = b.roofs[0],
          cx = (data.bounds[0] + data.bounds[2]) / 2;
        span(o, c, [cx, b.roofY + 0.1, 42], [cx, b.roofY + 0.1, 61], 0.17, 0.17, 'metal', C.gold);
        continue;
      }
      for (const data of b.roofs) {
        const [x, z, X, Z] = data.bounds,
          len = Math.max(X - x, Z - z);
        if (len < 25) continue;
        const n = c.flat ? 1 : Math.max(1, Math.floor(len / (c.fine ? 17 : 28)));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n,
            p = X - x > Z - z ? [x + t * (X - x), (z + Z) / 2] : [(x + X) / 2, z + t * (Z - z)],
            y = b.roofY - 1;
          B(
            o,
            c,
            [p[0] - 0.6, y - 1.4, p[1] - 0.5],
            [p[0] + 0.6, y + 1, p[1] + 0.5],
            'brick',
            C.brick,
          );
          B(o, c, [p[0] - 0.75, y + 0.8, p[1] - 0.62], [p[0] + 0.75, y + 1.1, p[1] + 0.62]);
        }
      }
    }
}
export const buildVersaillesSkyline = (o) => buildVersaillesLevel(o, 'skyline');
export const buildVersaillesDistrict = (o) => buildVersaillesLevel(o, 'district');
export const buildVersaillesStreet = (o) => buildVersaillesLevel(o, 'street');
export const buildVersaillesCloseup = (o) => buildVersaillesLevel(o, 'closeup');

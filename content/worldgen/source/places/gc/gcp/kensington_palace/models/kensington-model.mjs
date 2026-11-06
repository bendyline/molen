/** 'kensington_palace': original complete three-court palace exterior. Model+X SSE,+Z WSW. */
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
export const kensingtonControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = kensingtonControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('b67b61'),
    accent: lin('c58461'),
    lead: lin('9ba6a7'),
    stone: lin('e5dfd0'),
    base: lin('c6c3b6'),
    roof: lin('7b8385'),
    glass: lin('4b6170'),
    wood: lin('e5e4d9'),
    metal: lin('52615f'),
    dark: lin('45524e'),
    paving: lin('b8ac98'),
  };
export const kensingtonSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'brick', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.65, metallic: 0.35 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 2, step: 99, stairs: 3 },
  district: { n: 4, arch: 2, step: 20, stairs: 4, flat: true },
  street: { n: 6, arch: 4, step: 7.5, stairs: 8, dormers: true },
  closeup: { n: 10, arch: 8, step: 4.5, stairs: 14, dormers: true, details: true },
  master: { n: 24, arch: 24, step: 4.5, stairs: 24, dormers: true, details: true, fine: true },
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
  if (c.flat) return;
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
    const bottom = c.far ? Math.min(12.8, lo) : lo;
    for (let i = 0; i < r.length; i++) {
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
  if (!c.far && c.fine)
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
      count = Math.max(1, Math.floor(len / (c.fine || c.details ? 5 : 10))),
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
function trimFacade(o, c) {
  if (c.far) return;
  const roofAt = (p) =>
    a.bodies.find(
      (b) =>
        b.bounds &&
        p[0] >= b.bounds[0] - 0.05 &&
        p[0] <= b.bounds[2] + 0.05 &&
        p[1] >= b.bounds[1] - 0.05 &&
        p[1] <= b.bounds[3] + 0.05,
    )?.eave ?? 13.8;
  for (const rs of a.whole)
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw).reverse() : cw(raw);
      for (let j = 0; j < r.length; j++) {
        const A = r[j],
          Z = r[(j + 1) % r.length],
          len = Math.hypot(...sub(Z, A));
        if (len < 3) continue;
        const Tt = sub(Z, A).map((v) => v / len),
          N = [-Tt[1], Tt[0]],
          F = (u, y, d = 0) => [A[0] + Tt[0] * u + N[0] * d, y, A[1] + Tt[1] * u + N[1] * d],
          mid = mix(A, Z, 0.5),
          height = roofAt(mid),
          count = Math.max(1, Math.round(len / c.step)),
          state = height > 15.5;
        for (let k = 0; k < count; k++) {
          const u = ((k + 0.5) * len) / count,
            p = F(u, 0),
            entry = Math.abs(p[0]) < 0.5 && Math.abs(p[2] - a.clock.center[1]) < 3.1;
          if (!entry)
            rectangleWindow(
              o,
              c,
              (x, y, d = 0) => F(u + x, y, d),
              Math.min(1.6, (len / count) * 0.55),
              3.0,
              state ? 4.3 : 3.2,
            );
          rectangleWindow(
            o,
            c,
            (x, y, d = 0) => F(u + x, y, d),
            Math.min(1.6, (len / count) * 0.55),
            state ? 9.6 : 8.0,
            state ? 4.3 : 3.2,
          );
          if (!c.flat && !entry)
            rectangleWindow(
              o,
              c,
              (x, y, d = 0) => F(u + x, y, d),
              Math.min(1.4, (len / count) * 0.5),
              0.55,
              1.25,
            );
          if (c.details) {
            const w = Math.min(2.1, (len / count) * 0.7);
            for (const y of [state ? 7.5 : 6.6, state ? 14.2 : 11.4])
              span(
                o,
                c,
                F(u - w / 2, y, 0.06),
                F(u + w / 2, y, 0.06),
                0.16,
                0.16,
                'wall',
                C.accent,
              );
          }
        }
        for (const y of [2.55, height - 0.28]) {
          if (Math.abs(A[0]) < 0.5 && Math.abs(Z[0]) < 0.5 && y < a.clock.wallTop) {
            // The clock-court recess has real jambs; a continuous belt course
            // here would cut across the opening.
            const ends = [
                a.clock.center[1] - a.clock.width / 2 - 0.3,
                a.clock.center[1] + a.clock.width / 2 + 0.3,
              ]
                .map((z) => (z - A[1]) / Tt[1])
                .sort((a, b) => a - b),
              lo = Math.max(0, Math.min(len, ends[0])),
              hi = Math.max(0, Math.min(len, ends[1]));
            if (lo > 0.1) span(o, c, F(0, y, 0.07), F(lo, y, 0.07), 0.25, 0.28);
            if (hi < len - 0.1) span(o, c, F(hi, y, 0.07), F(len, y, 0.07), 0.25, 0.28);
          } else span(o, c, F(0, y, 0.07), F(len, y, 0.07), 0.25, 0.28);
        }
        if (c.details) {
          for (let k = 0; k <= Math.floor(len / 1.4); k++) {
            const u = (k * len) / Math.max(1, Math.floor(len / 1.4)),
              A = F(u, height - 0.5, 0.08),
              Z = F(u, height - 0.1, 0.35);
            B(
              o,
              c,
              A.map((v, i) => Math.min(v, Z[i]) - 0.08),
              A.map((v, i) => Math.max(v, Z[i]) + 0.08),
            );
          }
        }
      }
    }
}
function urn(o, c, p) {
  const profile = [
    [0, 0.23],
    [0.15, 0.36],
    [0.33, 0.2],
    [0.75, 0.37],
    [1, 0.26],
    [1.08, 0.32],
    [1.25, 0.04],
  ];
  L(
    o,
    c,
    profile.map(([y, r]) => radialRing(p[1] + y, r, r, c.n, [p[0], p[2]])),
  );
}
function clockEntry(o, c) {
  const k = a.clock,
    {
      center: [cx, cz],
      frontX,
      backX,
      width,
      floor,
      spring,
      crown,
      wallTop,
    } = k,
    F = (u, y, d = 0) => [frontX + d, y, cz + u],
    r = width / 2;
  if (c.far) {
    for (let j = 0; j < c.stairs; j++)
      B(
        o,
        c,
        [0.25 + (j * 3.2) / c.stairs, a.courts[0].floorY - 0.1, cz - r - 0.4],
        [
          0.25 + ((j + 1) * 3.2) / c.stairs,
          floor - ((floor - a.courts[0].floorY) * j) / c.stairs,
          cz + r + 0.4,
        ],
      );
    return;
  }
  for (let i = 0; i < c.arch; i++) {
    const t = Math.PI - (Math.PI * i) / c.arch,
      Tt = Math.PI - (Math.PI * (i + 1)) / c.arch,
      p = [Math.cos(t) * r, spring + Math.sin(t) * (crown - spring)],
      q = [Math.cos(Tt) * r, spring + Math.sin(Tt) * (crown - spring)];
    for (const [d, N] of [
      [0, [1, 0, 0]],
      [backX, [-1, 0, 0]],
    ])
      Q(
        o,
        c,
        [F(p[0], p[1], d), F(q[0], q[1], d), F(q[0], wallTop, d), F(p[0], wallTop, d)],
        'stone',
        C.stone,
        N,
      );
    Q(
      o,
      c,
      [F(p[0], p[1]), F(p[0], p[1], backX), F(q[0], q[1], backX), F(q[0], q[1])],
      'stone',
      C.stone,
      [(q[1] - p[1]) * 0, -(q[0] - p[0]), q[1] - p[1]],
    );
  }
  B(o, c, [backX, floor - 0.2, cz - r - 0.2], [frontX + 0.3, floor, cz + r + 0.2]);
  rectangleWindow(
    o,
    c,
    (u, y, d = 0) => [backX + 0.04 + d, y, cz + u],
    width * 0.85,
    floor + 0.04,
    crown - floor - 0.25,
    true,
  );
  const start = frontX + 0.25,
    run = 3.2,
    drop = floor - a.courts[0].floorY;
  for (let i = 0; i < c.stairs; i++) {
    const y = floor - (drop * i) / c.stairs;
    B(
      o,
      c,
      [start + (i * run) / c.stairs, a.courts[0].floorY - 0.1, cz - r - 0.4],
      [start + ((i + 1) * run) / c.stairs, y, cz + r + 0.4],
    );
  }
}
function clockTower(o, c) {
  const k = a.clock,
    [cx, cz] = k.center;
  B(
    o,
    c,
    [k.bounds[0], k.stageBase, k.bounds[1]],
    [k.bounds[2], k.stageTop, k.bounds[3]],
    'wall',
    C.wall,
  );
  hip(
    o,
    c,
    [
      [
        [k.bounds[0], k.bounds[1]],
        [k.bounds[2], k.bounds[1]],
        [k.bounds[2], k.bounds[3]],
        [k.bounds[0], k.bounds[3]],
      ],
    ],
    k.stageTop,
    k.roofY,
    C.roof,
  );
  const x = k.bounds[2] + 0.025,
    y = 16.15,
    r = 0.72;
  if (!c.far) {
    for (let i = 0; i < c.n; i++)
      T(
        o,
        c,
        [
          [x + 0.03, y, cz],
          [
            x + 0.03,
            y + Math.sin((i / c.n) * Math.PI * 2) * r,
            cz + Math.cos((i / c.n) * Math.PI * 2) * r,
          ],
          [
            x + 0.03,
            y + Math.sin(((i + 1) / c.n) * Math.PI * 2) * r,
            cz + Math.cos(((i + 1) / c.n) * Math.PI * 2) * r,
          ],
        ],
        'stone',
        C.stone,
        [1, 0, 0],
      );
    span(o, c, [x + 0.06, y, cz], [x + 0.06, y + 0.48, cz - 0.12], 0.06, 0.06, 'metal', C.metal);
    span(o, c, [x + 0.06, y, cz], [x + 0.06, y - 0.2, cz + 0.39], 0.06, 0.06, 'metal', C.metal);
  }
  const R = 1.35,
    base = k.roofY - 0.2;
  B(o, c, [cx - R - 0.15, base - 0.2, cz - R - 0.15], [cx + R + 0.15, base + 0.2, cz + R + 0.15]);
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    B(
      o,
      c,
      [cx + dx * R - 0.15, base, cz + dz * R - 0.15],
      [cx + dx * R + 0.15, k.lanternTop, cz + dz * R + 0.15],
    );
  for (const y of [base + 0.25, k.lanternTop - 0.12])
    B(o, c, [cx - R - 0.25, y - 0.1, cz - R - 0.25], [cx + R + 0.25, y + 0.1, cz + R + 0.25]);
  if (!c.far)
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2,
        N = [Math.cos(angle), Math.sin(angle)],
        Tt = [-N[1], N[0]],
        F = (u, Y, d = 0) => [cx + N[0] * (R + d) + Tt[0] * u, Y, cz + N[1] * (R + d) + Tt[1] * u],
        spring = k.lanternTop - 0.7;
      for (let i = 0; i < c.arch; i++) {
        const t = Math.PI - (i / c.arch) * Math.PI,
          Tt = Math.PI - ((i + 1) / c.arch) * Math.PI,
          p = [Math.cos(t) * 1.08, spring + Math.sin(t) * 0.55],
          q = [Math.cos(Tt) * 1.08, spring + Math.sin(Tt) * 0.55];
        Q(
          o,
          c,
          [F(p[0], p[1]), F(q[0], q[1]), F(q[0], k.lanternTop), F(p[0], k.lanternTop)],
          'stone',
          C.stone,
          [N[0], 0, N[1]],
        );
        Q(
          o,
          c,
          [F(p[0], p[1]), F(p[0], p[1], -0.3), F(q[0], q[1], -0.3), F(q[0], q[1])],
          'stone',
          C.stone,
          [0, -1, 0],
        );
      }
    }
  L(
    o,
    c,
    [
      [k.lanternTop, R + 0.2],
      [k.lanternTop + 0.2, R + 0.22],
      [k.capTop - 0.5, 0.85],
      [k.capTop, 0.24],
    ].map(([y, r]) => radialRing(y, r, r, c.n, [cx, cz])),
  );
  span(o, c, [cx, k.capTop, cz], [cx, k.finialTop, cz], 0.12, 0.12, 'metal', C.metal);
  sphere(
    o,
    S(c, 'metal'),
    [cx, k.finialTop - 0.1, cz],
    [0.18, 0.18, 0.18],
    C.lead,
    c.n,
    Math.max(3, c.n / 2),
  );
}
function eastAndSouth(o, c) {
  const face = (u, y, d = 0) => [11.15 + u, y, -52.06 - d],
    base = 17.4;
  T(
    o,
    c,
    [face(-6.8, base, 0.04), face(6.8, base, 0.04), face(0, 21.25, 0.04)],
    'wall',
    C.wall,
    [0, 0, -1],
  );
  for (const side of [-1, 1])
    span(o, c, face(side * 6.8, base, 0.12), face(0, 21.25, 0.12), 0.32, 0.32, 'stone', C.stone);
  if (!c.far) {
    B(o, c, [10.3, 10.1, -52.15], [12.0, 14.7, -52.05]);
    for (const x of [8.8, 13.5]) B(o, c, [x - 0.16, 9.8, -52.3], [x + 0.16, 14.6, -52.05]);
  }
  const attic = [43.1, 30.1, 54.85, 41.2];
  B(o, c, [attic[0], 14.8, attic[1]], [attic[2], 17.5, attic[3]], 'wall', C.accent);
  if (!c.far) {
    for (const z of [25, 28, 31, 34, 37, 40, 43, 46])
      span(o, c, [54.95, 2.7, z], [54.95, 14.4, z], 0.27, 0.45, 'wall', C.accent);
    for (const z of [30.2, 33.85, 37.5, 41.15]) urn(o, c, [54.7, 17.55, z]);
  }
}
function canopy(o, c) {
  const a0 = a.canopy,
    [x, z, X, Z] = a0.bounds;
  if (c.far) {
    B(o, c, [x, a0.floorY, z], [X, a0.eave, Z], 'metal', C.metal);
    return;
  }
  B(o, c, [x - 0.1, a0.floorY - 0.25, z - 0.1], [X + 0.1, a0.floorY, Z + 0.1], 'stone', C.stone);
  for (const y of [a0.floorY + 0.1, a0.eave])
    for (const side of [z, Z]) span(o, c, [x, y, side], [X, y, side], 0.12, 0.12, 'metal', C.metal);
  for (let i = 0; i <= Math.ceil((X - x) / 1.6); i++) {
    const u = x + (i * (X - x)) / Math.ceil((X - x) / 1.6);
    span(o, c, [u, a0.floorY, z], [u, a0.eave, z], 0.1, 0.1, 'metal', C.metal);
  }
  Q(
    o,
    c,
    [
      [x, a0.floorY, z + 0.03],
      [X, a0.floorY, z + 0.03],
      [X, a0.eave, z + 0.03],
      [x, a0.eave, z + 0.03],
    ],
    'glass',
    C.glass,
    [0, 0, -1],
  );
  Q(
    o,
    c,
    [
      [x, a0.floorY, z],
      [x, a0.floorY, Z],
      [x, a0.eave, Z],
      [x, a0.eave, z],
    ],
    'glass',
    C.glass,
    [-1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [X, a0.floorY, Z],
      [X, a0.floorY, z],
      [X, a0.eave, z],
      [X, a0.eave, Z],
    ],
    'glass',
    C.glass,
    [1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [x - 0.15, a0.eave, z - 0.1],
      [X + 0.15, a0.eave, z - 0.1],
      [X + 0.15, a0.roofY, Z + 0.1],
      [x - 0.15, a0.roofY, Z + 0.1],
    ],
    'metal',
    C.metal,
    [0, 1, 0],
  );
  rectangleWindow(
    o,
    c,
    (u, y, d = 0) => [(x + X) / 2 + u, y, z - 0.08 - d],
    2.6,
    a0.floorY + 0.05,
    3.9,
    true,
  );
}
export function buildKensingtonLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Kensington tier ' + level);
  if (c.far) {
    for (const rs of a.whole) prism(o, c, rs, -5, 12.8);
  } else
    for (const b of a.bodies) {
      for (const rs of b.lower) {
        prism(o, c, rs, -5, 2.6, 'base', C.base);
        prism(o, c, rs, 2.6, Math.min(7.8, b.eave));
      }
      if (b.eave > 7.8) for (const rs of b.polygons) prism(o, c, rs, 7.8, b.eave);
    }
  for (const b of a.bodies)
    for (const [i, rs] of b.polygons.entries())
      hip(o, c, rs, b.eave, b.roofY, lin(b.roofColor), b.flat, b.roofs[i]);
  trimFacade(o, c);
  clockEntry(o, c);
  clockTower(o, c);
  eastAndSouth(o, c);
  canopy(o, c);
  for (const court of a.courts) cap(o, c, [court.outline], court.floorY, 'base', C.paving);
  if (!c.far)
    for (const b of a.bodies) {
      if (!b.bounds || b.flat) continue;
      const [x, z, X, Z] = b.bounds;
      if (Math.max(X - x, Z - z) < 20) continue;
      const count = c.details ? Math.max(1, Math.floor(Math.max(X - x, Z - z) / 13)) : 1;
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count,
          p = X - x > Z - z ? [x + (X - x) * t, (z + Z) / 2] : [(x + X) / 2, z + (Z - z) * t],
          y = b.roofY - 1.4;
        B(
          o,
          c,
          [p[0] - 0.65, y - 1, p[1] - 0.55],
          [p[0] + 0.65, y + 1.9, p[1] + 0.55],
          'wall',
          C.accent,
        );
        B(
          o,
          c,
          [p[0] - 0.85, y + 1.65, p[1] - 0.7],
          [p[0] + 0.85, y + 1.9, p[1] + 0.7],
          'stone',
          C.stone,
        );
        if (c.details)
          for (const k of [-0.35, 0.35])
            B(
              o,
              c,
              [p[0] + k - 0.16, y + 1.9, p[1] - 0.18],
              [p[0] + k + 0.16, y + 2.35, p[1] + 0.18],
              'wall',
              C.wall,
            );
      }
    }
}
export const buildKensingtonSkyline = (o) => buildKensingtonLevel(o, 'skyline');
export const buildKensingtonDistrict = (o) => buildKensingtonLevel(o, 'district');
export const buildKensingtonStreet = (o) => buildKensingtonLevel(o, 'street');
export const buildKensingtonCloseup = (o) => buildKensingtonLevel(o, 'closeup');

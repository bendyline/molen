/** 'rundale_palace': original U-shaped palace draft. Internal u east/v south, model[-v,y,u]. */
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
export const rundaleControls = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const a = rundaleControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e2b85f'),
    stone: lin('e5dfcc'),
    base: lin('b7b6ac'),
    roof: lin('9ca9ae'),
    glass: lin('4b646d'),
    wood: lin('dce1da'),
    metal: lin('52615f'),
    dark: lin('45524e'),
    paving: lin('b8ac98'),
  };
export const rundaleSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, arch: 2, n: 4, step: 99, stairs: 3 },
  district: { flat: true, arch: 2, n: 4, step: 12, stairs: 5 },
  street: { flatFrames: true, arch: 4, n: 6, step: 8, stairs: 8, details: true },
  closeup: { flatFrames: true, arch: 8, n: 10, step: 4.25, stairs: 14, details: true },
  master: { frames: true, fine: true, arch: 24, n: 24, step: 4.25, stairs: 20, details: true },
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
  P = ([u, y, v]) => [-v, y, u];
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
function rectangularHip(o, c, bounds, lo, hi) {
  const [x, z, X, Z] = bounds,
    inset = Math.min(X - x, Z - z) * 0.43,
    r = (y) => [
      [x, y, z],
      [x, y, Z],
      [X, y, Z],
      [X, y, z],
    ],
    bottom = r(lo),
    top = [
      [x + inset, hi, z + inset],
      [x + inset, hi, Z - inset],
      [X - inset, hi, Z - inset],
      [X - inset, hi, z + inset],
    ];
  L(o, c, [bottom, top], 'roof', C.roof);
  if (!c.far && c.details)
    for (let side = 0; side < 4; side++) {
      const A = bottom[side],
        Z = bottom[(side + 1) % 4],
        len = Math.hypot(Z[0] - A[0], Z[2] - A[2]);
      if (len < 20) continue;
      const dx = (Z[0] - A[0]) / len,
        dz = (Z[2] - A[2]) / len,
        N = [-dz, dx];
      for (let j = 1; j <= Math.floor(len / 14); j++) {
        const t = j / (Math.floor(len / 14) + 1),
          u = A[0] + dx * len * t - N[0] * 2.2,
          v = A[2] + dz * len * t - N[1] * 2.2,
          y = lo + (hi - lo) * Math.min(1, 2.2 / inset),
          axis = ([x, Y, d]) => [u + dx * x + N[0] * d, Y, v + dz * x + N[1] * d];
        const rr = (Y, r) =>
          Array.from({ length: c.n }, (_, i) =>
            axis([
              Math.cos((-i / c.n) * Math.PI * 2) * r,
              Y + Math.sin((-i / c.n) * Math.PI * 2) * r,
              0,
            ]),
          );
        for (let k = 0; k < c.n; k++) {
          const t0 = (-k / c.n) * Math.PI * 2,
            t1 = (-(k + 1) / c.n) * Math.PI * 2,
            p0 = axis([Math.cos(t0) * 0.75, y + 1 + Math.sin(t0) * 0.75, 0.76]),
            p1 = axis([Math.cos(t1) * 0.75, y + 1 + Math.sin(t1) * 0.75, 0.76]);
          T(o, c, [axis([0, y + 1, 0.76]), p0, p1], 'glass', C.glass, [N[0], 0, N[1]]);
          if (c.frames) span(o, c, p0, p1, 0.15, 0.18);
          else if (c.n >= 8) {
            const t = (i) => (-i / c.n) * Math.PI * 2,
              ring = (i, r) => axis([Math.cos(t(i)) * r, y + 1 + Math.sin(t(i)) * r, 0.78]);
            Q(
              o,
              c,
              [ring(k, 0.75), ring(k + 1, 0.75), ring(k + 1, 0.9), ring(k, 0.9)],
              'stone',
              C.stone,
              [N[0], 0, N[1]],
            );
          }
        }
        B(o, c, [u - 0.7, y - 0.3, v - 0.7], [u + 0.7, y + 1, v + 0.7], 'roof', C.roof);
        if (c.fine)
          for (const k of [-1, 1])
            span(
              o,
              c,
              axis([k * 0.4, y + 0.6, 0.58]),
              axis([k * 0.4, y + 1.4, 0.58]),
              0.08,
              0.08,
              'wood',
              C.wood,
            );
      }
    }
}
function closedWindow(o, c, P, y, w, h, arched = false, door = false) {
  const n = c.arch,
    shape = arched
      ? [
          [-w / 2, y],
          [w / 2, y],
          ...Array.from({ length: n + 1 }, (_, i) => {
            const t = (i / n) * Math.PI;
            return [(Math.cos(t) * w) / 2, y + h - w * 0.3 + Math.sin(t) * w * 0.3];
          }),
        ]
      : [
          [-w / 2, y],
          [w / 2, y],
          [w / 2, y + h],
          [-w / 2, y + h],
        ];
  for (let k = 0; k < shape.length; k++)
    T(
      o,
      c,
      [P(0, y + h / 2, 0.055), P(...shape[k], 0.055), P(...shape[(k + 1) % shape.length], 0.055)],
      door ? 'wood' : 'glass',
      door ? C.dark : C.glass,
    );
  if (c.flat) return;
  for (let k = 0; k < shape.length; k++) {
    const A = shape[k],
      Z = shape[(k + 1) % shape.length];
    if (c.frames) span(o, c, P(...A, 0.11), P(...Z, 0.11), 0.13, 0.13, 'wood', C.wood);
    else {
      const dx = Z[0] - A[0],
        dy = Z[1] - A[1],
        len = Math.hypot(dx, dy),
        a = 0.065;
      Q(
        o,
        c,
        [
          P(A[0] - (dy / len) * a, A[1] + (dx / len) * a, 0.11),
          P(Z[0] - (dy / len) * a, Z[1] + (dx / len) * a, 0.11),
          P(Z[0] + (dy / len) * a, Z[1] - (dx / len) * a, 0.11),
          P(A[0] + (dy / len) * a, A[1] - (dx / len) * a, 0.11),
        ],
        'wood',
        C.wood,
      );
    }
  }
  if (c.details) {
    if (c.flatFrames) {
      Q(
        o,
        c,
        [
          P(-0.04, y, 0.12),
          P(0.04, y, 0.12),
          P(0.04, y + h - 0.12, 0.12),
          P(-0.04, y + h - 0.12, 0.12),
        ],
        'wood',
        C.wood,
      );
      Q(
        o,
        c,
        [
          P(-w / 2, y + h * 0.5 - 0.04, 0.12),
          P(w / 2, y + h * 0.5 - 0.04, 0.12),
          P(w / 2, y + h * 0.5 + 0.04, 0.12),
          P(-w / 2, y + h * 0.5 + 0.04, 0.12),
        ],
        'wood',
        C.wood,
      );
    } else {
      span(o, c, P(0, y, 0.12), P(0, y + h - 0.12, 0.12), 0.075, 0.08, 'wood', C.wood);
      span(
        o,
        c,
        P(-w / 2, y + h * 0.5, 0.12),
        P(w / 2, y + h * 0.5, 0.12),
        0.075,
        0.08,
        'wood',
        C.wood,
      );
    }
  }
}
function facade(o, c, ring) {
  if (c.far) return;
  const r = cw(ring);
  for (let j = 0; j < r.length; j++) {
    const A = r[j],
      Z = r[(j + 1) % r.length],
      dx = Z[0] - A[0],
      dz = Z[1] - A[1],
      len = Math.hypot(dx, dz);
    if (len < 2.8) continue;
    const N = [-dz / len, dx / len],
      P = (u, y, d = 0) => [A[0] + (dx * u) / len + N[0] * d, y, A[1] + (dz * u) / len + N[1] * d],
      count = Math.max(1, Math.round(len / c.step));
    for (let k = 0; k < count; k++) {
      const u = ((k + 0.5) * len) / count,
        p = P(u, 0),
        W = (x, y, d) => P(u + x, y, d),
        entry = Math.abs(p[0]) < 6.1 && p[2] > 24.5 && p[2] < 28.2;
      closedWindow(o, c, W, 1.1, Math.min(1.4, (len / count) * 0.55), 1, true);
      if (
        !entry &&
        !a.sideDoors.some(
          (d) =>
            Math.hypot(d.position[0] - p[0], d.position[1] - p[2]) < 2.8 &&
            d.normal[0] * N[0] + d.normal[1] * N[1] > 0.8,
        )
      )
        closedWindow(o, c, W, 3.65, Math.min(1.9, (len / count) * 0.55), 3.55, true);
      closedWindow(o, c, W, 8.55, Math.min(1.9, (len / count) * 0.55), 3.9, true);
      if (c.details) {
        const w = Math.min(2.3, (len / count) * 0.7);
        T(o, c, [W(-w / 2, 7.65, 0.12), W(w / 2, 7.65, 0.12), W(0, 8.15, 0.12)], 'stone', C.stone, [
          N[0],
          0,
          N[1],
        ]);
        if (c.frames) {
          span(o, c, W(-w / 2, 13.05, 0.12), W(w / 2, 13.05, 0.12), 0.2, 0.18);
          span(o, c, W(-w / 2, 3.4, 0.12), W(w / 2, 3.4, 0.12), 0.18, 0.15);
        }
      }
    }
    for (const y of [3.1, 7.9, 14.1]) {
      if (c.flat) continue;
      span(o, c, P(0, y, 0.12), P(len, y, 0.12), 0.25, 0.2);
    }
    if (c.details)
      for (let k = 0; k <= count; k++) {
        const u = (len * k) / count,
          p = P(u, 0);
        // The three recessed bays supply their own jambs. A regular facade
        // pilaster here would stand in front of a door and cross the soffit.
        if (Math.abs(p[0]) < 6.1 && p[2] > 24 && p[2] < 28.2) continue;
        span(o, c, P(u, 3.2, 0.16), P(u, 14.15, 0.16), 0.45, 0.25);
      }
  }
}
function stairs(o, c, { bounds, top = a.entryY, bottom = a.courtY, axis = 'v', reverse = false }) {
  const [u, v, U, V] = bounds,
    n = c.stairs;
  for (let j = 0; j < n; j++) {
    const t = (j + 1) / n,
      y = bottom + (top - bottom) * t;
    if (axis === 'v') {
      const z = reverse ? V - (V - v) * t : v + ((V - v) * j) / n;
      B(o, c, [u, bottom - 0.12, z], [U, y, reverse ? V - ((V - v) * j) / n : V]);
    } else {
      const x = reverse ? U - (U - u) * t : u + ((U - u) * j) / n;
      B(o, c, [x, bottom - 0.12, v], [reverse ? U - ((U - u) * j) / n : U, y, V]);
    }
  }
  if (c.details) {
    for (const s of [-1, 1]) {
      const x = s < 0 ? u + 0.12 : U - 0.12;
      span(
        o,
        c,
        [x, bottom + 0.8, reverse ? V : v],
        [x, top + 0.8, reverse ? v : V],
        0.1,
        0.1,
        'roof',
        C.metal,
      );
    }
  }
}
function entrance(o, c) {
  const front = 25.04,
    back = 28.15,
    spanWidth = 11.6,
    bay = spanWidth / 3,
    top = 7.8,
    spring = 5.25,
    r = 1.5;
  for (let j = 0; j < 3; j++) {
    const center = -spanWidth / 2 + (j + 0.5) * bay;
    for (let k = 0; k < c.arch; k++) {
      const t = (k / c.arch) * Math.PI,
        Tt = ((k + 1) / c.arch) * Math.PI,
        p = [center + Math.cos(t) * r, spring + Math.sin(t) * r],
        q = [center + Math.cos(Tt) * r, spring + Math.sin(Tt) * r];
      for (const [v, N] of [
        [front, [0, 0, -1]],
        [back, [0, 0, 1]],
      ])
        Q(
          o,
          c,
          [
            [p[0], p[1], v],
            [q[0], q[1], v],
            [q[0], top, v],
            [p[0], top, v],
          ],
          'stone',
          C.stone,
          N,
        );
      Q(
        o,
        c,
        [
          [p[0], p[1], front],
          [p[0], p[1], back],
          [q[0], q[1], back],
          [q[0], q[1], front],
        ],
        'stone',
        C.stone,
        [-Math.cos((t + Tt) / 2), -Math.sin((t + Tt) / 2), 0],
      );
    }
    for (const k of [-1, 1])
      B(
        o,
        c,
        [center + k * r - (k < 0 ? bay / 2 - r : 0), 3.4, front],
        [center + k * r + (k > 0 ? bay / 2 - r : 0), spring, back],
      );
    if (!c.far)
      closedWindow(o, c, (u, y, d) => [center - u, y, back - 0.04 - d], 3.45, 2.7, 3.3, true, true);
  }
  B(o, c, [-6.4, 3.1, 23.7], [6.4, 3.4, 25.2]);
  stairs(o, c, { bounds: [-6.4, 18, 6.4, 24.1] });
  B(o, c, [-6.1, 7.9, 24.1], [6.1, 8.15, 25.3]);
  if (c.details) {
    span(o, c, [-6.1, 8.9, 24.1], [6.1, 8.9, 24.1], 0.1, 0.1, 'roof', C.metal);
    for (let i = 0; i < 24; i++) {
      const u = -6.1 + (i / 23) * 12.2;
      span(o, c, [u, 8.15, 24.1], [u, 8.9, 24.1], 0.045, 0.045, 'roof', C.metal);
    }
  }
}
function gate(o, c) {
  for (const [u, v] of a.gate.posts)
    for (const x of [u - 0.5, u + 0.5]) {
      L(
        o,
        c,
        [
          [0.8, 0.5],
          [1.1, 0.52],
          [1.3, 0.35],
          [5.3, 0.32],
          [5.5, 0.55],
          [5.9, 0.55],
        ].map(([y, r]) => radialRing(y, r, r, c.n, [x, v])),
      );
      if (!c.far)
        sphere(
          o,
          S(c, 'stone'),
          [x, 6.25, v],
          [0.38, 0.45, 0.38],
          C.stone,
          c.n,
          Math.max(3, c.n / 2),
        );
    }
  if (!c.far)
    for (const [x, X] of [
      [-10, -5.6],
      [5, 10.1],
    ]) {
      for (const y of [1.1, 4.1])
        span(o, c, [x, y, -46.9], [X, y, -46.9], 0.08, 0.1, 'roof', C.metal);
      for (let i = 0; i < Math.ceil((X - x) / 0.35); i++) {
        const u = x + ((X - x) * i) / Math.ceil((X - x) / 0.35);
        span(o, c, [u, 1.1, -46.9], [u, 4.5, -46.9], 0.04, 0.04, 'roof', C.metal);
      }
    }
}
function approachRamp(o, c) {
  const [u, v, U, V] = a.ramp.bounds,
    [L, R] = a.ramp.outerY,
    y = a.courtY;
  Q(
    o,
    c,
    [
      [u, L, v],
      [U, R, v],
      [U, y, V],
      [u, y, V],
    ],
    'base',
    C.paving,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [u, -2, v],
      [u, L, v],
      [u, y, V],
      [u, -2, V],
    ],
    'base',
    C.base,
    [-1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [U, -2, v],
      [U, -2, V],
      [U, y, V],
      [U, R, v],
    ],
    'base',
    C.base,
    [1, 0, 0],
  );
}
export function buildRundaleLevel(output, level) {
  const c = cfg[level];
  if (!c) throw Error(level);
  const o = {
    addQuad: (s, r, p, n, uv, C) => output.addQuad(s, r, p.map(P), P(n), uv, C),
    addTriangle: (s, r, p, n, uv, C) => output.addTriangle(s, r, p.map(P), P(n), uv, C),
    addConvexPolygon: (s, r, p, n, uv, C) =>
      output.addConvexPolygon(s, r, p.map(P), P(n), (q) => uv([q[2], q[1], -q[0]]), C),
  };
  for (const rs of a.whole) {
    if (c.far) prism(o, c, rs, -2, a.eaveY);
    else {
      prism(o, c, rs, -2, 3.4, 'base', C.base);
      prism(o, c, rs, 7.8, a.eaveY);
      facade(o, c, rs[0]);
    }
  }
  if (!c.far) for (const rs of a.entryBand) prism(o, c, rs, 3.4, 7.8);
  for (const range of a.roofRanges) rectangularHip(o, c, range.bounds, a.eaveY, a.mainRoofY);
  const att = a.attic,
    [u, v, U, V] = att.bounds;
  B(o, c, [u, 14.5, v], [U, att.eaveY, V], 'wall', C.wall);
  rectangularHip(o, c, att.bounds, att.eaveY, att.roofY);
  T(
    o,
    c,
    [
      [u, att.eaveY, v - 0.03],
      [U, att.eaveY, v - 0.03],
      [(u + U) / 2, att.roofY - 0.2, v - 0.03],
    ],
    'stone',
    C.stone,
    [0, 0, -1],
  );
  {
    const u = (att.bounds[0] + att.bounds[2]) / 2,
      y = 20.05,
      v = att.bounds[1] - 0.055,
      r = 0.7;
    for (let i = 0; i < c.n; i++) {
      const p = (t) => [u + Math.cos(t) * r, y + Math.sin(t) * r, v];
      T(
        o,
        c,
        [[u, y, v], p((i / c.n) * Math.PI * 2), p(((i + 1) / c.n) * Math.PI * 2)],
        'stone',
        C.stone,
        [0, 0, -1],
      );
    }
    if (!c.far) {
      span(o, c, [u, y, v - 0.02], [u - 0.3, y + 0.3, v - 0.02], 0.08, 0.06, 'roof', C.dark);
      span(o, c, [u, y, v - 0.02], [u + 0.1, y + 0.42, v - 0.02], 0.08, 0.06, 'roof', C.dark);
    }
  }
  if (!c.far) {
    const n = c.flat ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const x = u + ((i + 0.5) * (U - u)) / n;
      closedWindow(
        o,
        c,
        (dx, y, d) => [x - dx, y, v - 0.04 - d],
        15.3,
        Math.min(1.8, ((U - u) / n) * 0.65),
        2.2,
        true,
      );
    }
    for (const r of a.roofRanges) {
      const [x, z, X, Z] = r.bounds,
        chimneys = c.flat ? 1 : Math.max(2, Math.round(Math.max(X - x, Z - z) / 13));
      for (let j = 0; j < chimneys; j++) {
        const t = (j + 0.5) / chimneys,
          q = X - x > Z - z ? [x + t * (X - x), (z + Z) / 2] : [(x + X) / 2, z + t * (Z - z)],
          y = a.mainRoofY - 0.2;
        B(o, c, [q[0] - 0.65, y - 2, q[1] - 0.6], [q[0] + 0.65, y + 1.1, q[1] + 0.6]);
        B(o, c, [q[0] - 0.85, y + 0.9, q[1] - 0.8], [q[0] + 0.85, y + 1.4, q[1] + 0.8]);
      }
    }
  }
  if (c.far) {
    B(o, c, [-6.4, 3.1, 23.7], [6.4, 3.4, 25.2]);
    stairs(o, c, { bounds: [-6.4, 18, 6.4, 24.1] });
  } else entrance(o, c);
  gate(o, c);
  stairs(o, c, { bounds: [20.6, -9, 23.2, 1] });
  stairs(o, c, { bounds: [-23.3, -9, -20.7, 1] });
  stairs(o, c, { bounds: [-9, 51.7, 9, 59], reverse: true });
  for (const rs of a.court.polygons) cap(o, c, rs, a.courtY, 'base', C.paving);
  for (const stair of a.extraStairs) {
    if (c.far)
      B(
        o,
        c,
        [stair.bounds[0], a.courtY, stair.bounds[1]],
        [stair.bounds[2], a.entryY, stair.bounds[3]],
      );
    else stairs(o, c, stair);
  }
  for (const landing of a.landings)
    B(
      o,
      c,
      [landing.bounds[0], a.courtY, landing.bounds[1]],
      [landing.bounds[2], a.entryY, landing.bounds[3]],
    );
  approachRamp(o, c);
  if (!c.far)
    for (const d of a.sideDoors) {
      const [u, v] = d.position,
        N = d.normal;
      closedWindow(
        o,
        c,
        (x, y, depth) => [u + N[1] * x + N[0] * depth, y, v - N[0] * x + N[1] * depth],
        a.entryY + 0.02,
        1.7,
        3.5,
        true,
        true,
      );
    }
}
export const buildRundaleSkyline = (o) => buildRundaleLevel(o, 'skyline');
export const buildRundaleDistrict = (o) => buildRundaleLevel(o, 'district');
export const buildRundaleStreet = (o) => buildRundaleLevel(o, 'street');
export const buildRundaleCloseup = (o) => buildRundaleLevel(o, 'closeup');

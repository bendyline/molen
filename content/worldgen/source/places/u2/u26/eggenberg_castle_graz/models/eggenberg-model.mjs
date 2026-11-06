/** Original individual Eggenberg palace exterior. Meters,+Y up,+X front bridge. */
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
export const eggenbergControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = eggenbergControls,
  H = a.geometryControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e6e0cd'),
    stone: lin('cbb37f'),
    pale: lin('ddd3b9'),
    roof: lin('aa7350'),
    red: lin('9d6059'),
    glass: lin('586b78'),
    wood: lin('655d4b'),
    metal: lin('5f6059'),
    dial: lin('d9ded6'),
    clock: lin('638b9d'),
    gold: lin('c3a86d'),
    paving: lin('b9b4a5'),
  };
export const eggenbergSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.83, metallic: 0 },
  red: { slot: 'roof', graph: 'metal_copper', roughness: 0.6, metallic: 0.45 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.36, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.18 },
};
const configs = {
  skyline: { far: true, sides: 4, arch: 2, bay: 30 },
  district: { sides: 4, arch: 1, bay: 20, flat: true },
  street: { sides: 6, arch: 3, bay: 4.5, frames: true, flatFrames: true },
  closeup: { sides: 16, arch: 6, bay: 4.5, frames: true, detail: true },
  master: { sides: 32, arch: 12, bay: 4.5, frames: true, detail: true, fine: true },
};
export function eggenbergGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    h = g.elevationsMeters,
    n = g.size[0];
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  rect = (x, z, w, d, y) => [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ],
  area = (r) =>
    r.reduce((t, p, i) => {
      const q = r[(i + 1) % r.length];
      return t + p[0] * q[1] - q[0] * p[1];
    }, 0),
  clean = (r) => {
    const q = r.slice();
    if (Math.hypot(...q[0].map((v, i) => v - q.at(-1)[i])) < 0.001) q.pop();
    return q;
  },
  cw = (r) => {
    const q = clean(r);
    return area(q) > 0 ? q.reverse() : q;
  };
function B(o, c, lo, hi, s = 'wall', color = C.wall) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
function Q(o, c, p, s = 'wall', color = C.wall) {
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
function L(o, c, r, s = 'wall', color = C.wall, cap = true) {
  loft(o, S(c, s), r, color, { cap });
}
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = true) {
  const rs = rings.map(clean),
    flat = rs.flat(),
    holes = rs.slice(0, -1).map((_, i) => rs.slice(0, i + 1).flat().length),
    ids = earcut(flat.flat(), holes, 2);
  for (let k = 0; k < ids.length; k += 3) {
    let p = ids.slice(k, k + 3).map((i) => [flat[i][0], y, flat[i][1]]);
    if (normalFor(...p)[1] > 0 !== up) p.reverse();
    o.addTriangle(
      S(c, s),
      'palette:#ffffff',
      p,
      up ? [0, 1, 0] : [0, -1, 0],
      p.map((p) => [p[0], p[2]]),
      color,
    );
  }
}
function wall(o, c, A, Z, base, top, s = 'wall', color = C.wall, gate) {
  const point = (t, y) => [A[0] + (Z[0] - A[0]) * t, y, A[1] + (Z[1] - A[1]) * t],
    ts = [0, 1],
    dz = Z[1] - A[1];
  if (gate && Math.abs(dz) > 1)
    for (let i = 0; i <= c.arch * 2; i++) {
      const theta = (i / (c.arch * 2)) * Math.PI,
        z = gate.z - gate.r * Math.cos(theta),
        t = (z - A[1]) / dz;
      if (t > 0 && t < 1) ts.push(t);
    }
  ts.sort((a, b) => a - b);
  const low = (t) => {
    const z = A[1] + dz * t,
      v = gate ? (z - gate.z) / gate.r : 2;
    return Math.abs(v) <= 1 + 1e-6
      ? gate.spring + gate.r * Math.sqrt(Math.max(0, 1 - v * v))
      : base;
  };
  for (let i = 1; i < ts.length; i++) {
    const t = ts[i - 1],
      T = ts[i],
      mid = (t + T) / 2,
      inside = gate && Math.abs(A[1] + dz * mid - gate.z) < gate.r,
      p = [
        point(t, inside ? low(t) : base),
        point(T, inside ? low(T) : base),
        point(T, top),
        point(t, top),
      ];
    Q(o, c, p, s, color);
  }
}
function floor(o, c, rings, y) {
  cap(o, c, rings, y, 'stone', C.paving);
}
function shell(o, c, ring, holes, central = false) {
  const r = cw(ring);
  let low = H.floor - 0.4;
  for (const [x, z] of r) low = Math.min(low, eggenbergGroundY(x, z) - 0.4);
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      Z = r[(i + 1) % r.length];
    wall(o, c, A, Z, low, H.floor, 'stone', C.pale);
    const x = (A[0] + Z[0]) / 2,
      gate =
        Math.abs(A[0] - Z[0]) < 1 && (central || x > 38 || x < -34)
          ? { z: central ? 2.54 : x > 0 ? 0.96 : 2.54, r: central ? 1.45 : 1.6, spring: 2.8 }
          : undefined;
    wall(o, c, A, Z, H.floor, H.eave, 'wall', C.wall, gate);
  }
  floor(o, c, [r, ...holes], H.floor);
  for (const y of [...H.upperFloors, H.eave]) cap(o, c, [r, ...holes], y, 'wall', C.wall);
}
function hip(o, c, x0, z0, x1, z1, ridge, along = 'x') {
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2,
    w = x1 - x0,
    d = z1 - z0,
    small = 0.06;
  L(
    o,
    c,
    [
      rect(x, z, w, d, H.eave),
      rect(
        x,
        z,
        along === 'x' ? Math.max(small, w - d * 0.7) : small,
        along === 'z' ? Math.max(small, d - w * 0.7) : small,
        ridge,
      ),
    ],
    'roof',
    C.roof,
  );
}
function portal(o, c, x0, x1, z, r = 1.6, spring = 2.8) {
  const n = c.arch * 2;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI,
      T = ((i + 1) / n) * Math.PI,
      A = [z - r * Math.cos(t), spring + r * Math.sin(t)],
      Z = [z - r * Math.cos(T), spring + r * Math.sin(T)];
    Q(
      o,
      c,
      [
        [x0, A[1], A[0]],
        [x1, A[1], A[0]],
        [x1, Z[1], Z[0]],
        [x0, Z[1], Z[0]],
      ],
      'wall',
      C.wall,
    );
  }
  for (const sign of [-1, 1])
    Q(
      o,
      c,
      [
        [x0, H.floor, z + sign * r],
        [x1, H.floor, z + sign * r],
        [x1, spring, z + sign * r],
        [x0, spring, z + sign * r],
      ],
      'stone',
      C.stone,
    );
}
function column(o, c, x, z, base, top) {
  const r = c.flat ? 0.28 : 0.32,
    profile =
      c.flat || c.flatFrames
        ? [
            [base, r],
            [top, r],
          ]
        : [
            [base, r * 1.25],
            [base + 0.15, r * 1.25],
            [base + 0.24, r],
            [top - 0.28, r * 0.9],
            [top - 0.14, r * 1.3],
            [top, r * 1.3],
          ];
  L(
    o,
    c,
    profile.map(([y, R]) => radialRing(y, R, R, c.sides, [x, z])),
    'stone',
    C.stone,
    !(c.flat || c.flatFrames),
  );
}
function gallery(o, c, court) {
  const r = cw(court.ring);
  floor(o, c, [r], H.floor);
  for (let e = 0; e < r.length; e++) {
    const A = r[e],
      Z = r[(e + 1) % r.length],
      dx = Z[0] - A[0],
      dz = Z[1] - A[1],
      len = Math.hypot(dx, dz),
      T = [dx / len, dz / len],
      N = [T[1], -T[0]],
      P = (u, y, v = 0) => [A[0] + T[0] * u + N[0] * v, y, A[1] + T[1] * u + N[1] * v];
    const meanX = (A[0] + Z[0]) / 2,
      gateZ = meanX > 10 ? 0.96 : 2.54,
      gate =
        Math.abs(dx) < 1 && gateZ > Math.min(A[1], Z[1]) + 2 && gateZ < Math.max(A[1], Z[1]) - 2
          ? { z: gateZ, r: 1.6, spring: 2.8 }
          : undefined;
    if (c.far) {
      wall(o, c, Z, A, H.floor, H.eave, 'wall', C.wall, gate);
      continue;
    }
    const count = Math.max(1, Math.round(len / c.bay)),
      bay = len / count,
      edges = Array.from({ length: count + 1 }, (_, i) => i * bay);
    // Keep one real arcade centered on the mapped passage at every non-far tier.
    // Redistribute the same number of bays, preserving the tier's geometry budget.
    if (gate && count > 1) {
      const center = (gate.z - A[1]) / T[1],
        k = Math.max(0, Math.min(count - 1, Math.round(center / bay - 0.5))),
        left = k === 0 ? 0 : k === count - 1 ? 2 * center - len : center - bay / 2,
        right = k === count - 1 ? len : k === 0 ? 2 * center : center + bay / 2;
      for (let i = 0; i <= k; i++) edges[i] = k ? (i * left) / k : 0;
      for (let i = k + 1; i <= count; i++)
        edges[i] = right + ((i - k - 1) * (len - right)) / (count - k - 1 || 1);
    }
    for (const [level, base] of [H.floor, ...H.upperFloors].entries()) {
      const ceil = level === 0 ? H.upperFloors[0] : level === 1 ? H.upperFloors[1] : H.eave,
        spring = base + (level === 0 ? 1.8 : 1.45),
        top = ceil - 0.08;
      for (let i = 0; i <= count; i++) {
        const p = P(edges[i], base);
        column(o, c, p[0], p[2], base, spring);
      }
      for (let i = 0; i < count; i++) {
        const center = (edges[i] + edges[i + 1]) / 2,
          radius = Math.min((edges[i + 1] - edges[i]) * 0.4, (ceil - spring) * 0.85),
          left = center - radius,
          right = center + radius;
        for (const [u0, u1] of [
          [edges[i], left],
          [right, edges[i + 1]],
        ])
          for (const v of [0, -0.32]) {
            const ps = [P(u0, base, v), P(u1, base, v), P(u1, top, v), P(u0, top, v)];
            if (v === 0) ps.reverse();
            Q(o, c, ps);
          }
        for (let j = 0; j < c.arch; j++) {
          const t = (j / c.arch) * Math.PI,
            V = ((j + 1) / c.arch) * Math.PI,
            u = center - radius * Math.cos(t),
            v = center - radius * Math.cos(V),
            y = spring + radius * Math.sin(t),
            Y = spring + radius * Math.sin(V);
          for (const deep of [0, -0.32]) {
            const ps = [P(u, y, deep), P(v, Y, deep), P(v, top, deep), P(u, top, deep)];
            if (deep === 0) ps.reverse();
            Q(o, c, ps);
          }
          Q(o, c, [P(u, y, 0), P(u, y, -0.32), P(v, Y, -0.32), P(v, Y, 0)].reverse());
        }
        if (level > 0)
          Bspan(
            o,
            c,
            P(edges[i], base + 0.22),
            P(edges[i + 1], base + 0.22),
            0.32,
            0.44,
            'stone',
            C.stone,
          );
        if (c.detail && i % 3 === 1 && level === 1) {
          const p = P(center, ceil - 0.48, -1.2);
          hangingLamp(o, c, p);
        }
        if (c.frames && (level > 0 || i % 3 === 0)) {
          const z = P(center, base)[2];
          if (!(level === 0 && gate && Math.abs(z - gate.z) < 2)) {
            const lo = base + (level === 0 ? 0.12 : 0.6),
              hi = base + 2.2;
            let pane = [
              P(center - 0.5, lo, -2.16),
              P(center + 0.5, lo, -2.16),
              P(center + 0.5, hi, -2.16),
              P(center - 0.5, hi, -2.16),
            ];
            if (normalFor(...pane)[0] * N[0] + normalFor(...pane)[2] * N[1] < 0) pane.reverse();
            Q(o, c, pane, level === 0 ? 'wood' : 'glass', level === 0 ? C.wood : C.glass);
          }
        }
      }
      let ps = [P(0, base, -2.2), P(len, base, -2.2), P(len, base, 0), P(0, base, 0)];
      if (normalFor(...ps)[1] < 0) ps.reverse();
      Q(o, c, ps, 'stone', C.pale);
      Q(o, c, ps.map((p) => [p[0], p[1] - 0.13, p[2]]).reverse(), 'wall', C.wall);
      const backA = P(0, base, -2.2),
        backZ = P(len, base, -2.2),
        meanX = (backA[0] + backZ[0]) / 2,
        backGate =
          Math.abs(backA[0] - backZ[0]) < 1
            ? { z: meanX > 10 ? 0.96 : 2.54, r: 1.6, spring: 2.8 }
            : undefined;
      wall(
        o,
        c,
        [backZ[0], backZ[2]],
        [backA[0], backA[2]],
        base,
        ceil,
        'wall',
        C.wall,
        level === 0 ? backGate : undefined,
      );
    }
  }
}
function Bspan(o, c, A, Z, width, depth, s, color) {
  beam(o, S(c, s), A, Z, width, depth, color);
}
function window(o, c, P, T, N, w = 1.2, h = 2, shutters = true) {
  const p = (u, v, d = 0) => [P[0] + T[0] * u + N[0] * d, P[1] + v, P[2] + T[1] * u + N[1] * d];
  let ps = [p(-w / 2, 0, 0.035), p(w / 2, 0, 0.035), p(w / 2, h, 0.035), p(-w / 2, h, 0.035)];
  if (normalFor(...ps)[0] * N[0] + normalFor(...ps)[2] * N[1] < 0) ps.reverse();
  Q(o, c, ps, 'glass', C.glass);
  if (shutters && !c.flat)
    for (const sign of [-1, 1]) {
      const center = sign * (w / 2 + 0.35),
        qs = [
          p(center - 0.28, 0, 0.07),
          p(center + 0.28, 0, 0.07),
          p(center + 0.28, h, 0.07),
          p(center - 0.28, h, 0.07),
        ];
      if (normalFor(...qs)[0] * N[0] + normalFor(...qs)[2] * N[1] < 0) qs.reverse();
      Q(o, c, qs, 'wood', C.wood);
      if (c.fine)
        for (let y = 0.16; y < h; y += 0.2)
          Bspan(
            o,
            c,
            p(center - 0.28, y, 0.09),
            p(center + 0.28, y, 0.09),
            0.035,
            0.035,
            'wood',
            C.wood,
          );
    }
  if (c.flatFrames) {
    const stripe = (u0, u1, v0, v1) => {
      const ps = [p(u0, v0, 0.08), p(u1, v0, 0.08), p(u1, v1, 0.08), p(u0, v1, 0.08)];
      if (normalFor(...ps)[0] * N[0] + normalFor(...ps)[2] * N[1] < 0) ps.reverse();
      Q(o, c, ps, 'stone', C.stone);
    };
    for (const u of [-w / 2, w / 2]) stripe(u - 0.045, u + 0.045, -0.07, h + 0.07);
    for (const v of [0, h, h * 0.5]) stripe(-w / 2 - 0.12, w / 2 + 0.12, v - 0.045, v + 0.045);
    return;
  }
  if (c.frames) {
    for (const u of [-w / 2, w / 2])
      Bspan(o, c, p(u, 0, 0.08), p(u, h, 0.08), 0.09, 0.12, 'stone', C.stone);
    for (const y of [0, h, h * 0.5])
      Bspan(
        o,
        c,
        p(-w / 2 - 0.14, y, 0.08),
        p(w / 2 + 0.14, y, 0.08),
        0.09,
        0.13,
        'stone',
        C.stone,
      );
    if (!c.flatFrames) Bspan(o, c, p(0, 0, 0.08), p(0, h, 0.08), 0.07, 0.1, 'wood', C.pale);
  }
}
function facades(o, c) {
  if (c.far) return;
  const r = cw(a.outline);
  for (let j = 0; j < r.length; j++) {
    const A = r[j],
      Z = r[(j + 1) % r.length],
      dx = Z[0] - A[0],
      dz = Z[1] - A[1],
      len = Math.hypot(dx, dz);
    if (len < 12) continue;
    const T = [dx / len, dz / len],
      N = [-T[1], T[0]],
      count = Math.max(2, Math.floor(len / (c.flat ? 11 : 4.2)));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        x = A[0] + dx * t,
        z = A[1] + dz * t;
      for (const y of [1.65, 5.25, 8.55]) {
        if (x > 38 && Math.abs(z - 0.96) < 6 && y < 8) continue;
        if (x < -34 && Math.abs(z - 2.54) < 2.4 && y < 5) continue;
        window(o, c, [x + N[0] * 0.035, y, z + N[1] * 0.035], T, N, 1.15, 1.85);
      }
    }
    if (c.frames)
      for (const y of [1.2, 4.55, 7.85, 10.95])
        Bspan(
          o,
          c,
          [A[0] + N[0] * 0.08, y, A[1] + N[1] * 0.08],
          [Z[0] + N[0] * 0.08, y, Z[1] + N[1] * 0.08],
          0.14,
          0.16,
          'stone',
          C.stone,
        );
  }
}
function corner(o, c, x, z) {
  B(o, c, [x - 5.3, H.floor, z - 5.3], [x + 5.3, H.cornerWall, z + 5.3]);
  L(
    o,
    c,
    [rect(x, z, 11.2, 11.2, H.cornerWall), rect(x, z, 2.0, 2.0, H.cornerRoofTop)],
    'roof',
    C.roof,
  );
  lantern(o, c, x, z, H.cornerRoofTop, 1.15, 2.8);
  if (c.far) L(o, c, [rect(x, z, 2.8, 2.8, 32), rect(x, z, 0.05, 0.05, 35.3)], 'red', C.red);
  else {
    L(
      o,
      c,
      [rect(x, z, 2.8, 2.8, 32), rect(x, z, 0.9, 0.9, 33.4), rect(x, z, 0.35, 0.35, 34.1)],
      'red',
      C.red,
    );
    L(
      o,
      c,
      [
        radialRing(34.1, 0.22, 0.22, c.sides, [x, z]),
        radialRing(35.3, 0.025, 0.025, c.sides, [x, z]),
      ],
      'metal',
      C.gold,
    );
  }
  if (!c.far)
    for (const sign of [-1, 1])
      for (const y of [5.4, 9.1, 12.8]) {
        window(o, c, [x + sign * 5.34, y, z], [0, 1], [sign, 0], 1.25, 1.8, false);
        window(o, c, [x, y, z + sign * 5.34], [1, 0], [0, sign], 1.25, 1.8, false);
      }
}
function lantern(o, c, x, z, base, r, height) {
  const n = c.far || c.flat ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2,
      X = x + Math.cos(t) * r,
      Z = z + Math.sin(t) * r;
    B(o, c, [X - 0.1, base, Z - 0.1], [X + 0.1, base + height, Z + 0.1], 'red', C.red);
  }
  L(
    o,
    c,
    [
      radialRing(base, r * 1.23, r * 1.23, c.sides, [x, z]),
      radialRing(base + 0.14, r * 1.23, r * 1.23, c.sides, [x, z]),
    ],
    'red',
    C.red,
  );
  if (c.detail)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        T = ((i + 1) / n) * Math.PI * 2,
        mid = (t + T) / 2;
      Bspan(
        o,
        c,
        [x + Math.cos(t) * r, base + height - 0.4, z + Math.sin(t) * r],
        [x + Math.cos(mid) * r, base + height - 0.05, z + Math.sin(mid) * r],
        0.13,
        0.13,
        'red',
        C.red,
      );
      Bspan(
        o,
        c,
        [x + Math.cos(mid) * r, base + height - 0.05, z + Math.sin(mid) * r],
        [x + Math.cos(T) * r, base + height - 0.4, z + Math.sin(T) * r],
        0.13,
        0.13,
        'red',
        C.red,
      );
    }
}
function dial(o, c, x, y, z, T, N, r = 0.75) {
  if (c.far) return;
  const P = (u, v, d = 0) => [x + T[0] * u + N[0] * d, y + v, z + T[1] * u + N[1] * d],
    n = c.flat ? 8 : c.detail ? 24 : 12;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2,
      V = ((i + 1) / n) * Math.PI * 2;
    let p = [P(0, 0), P(r * Math.cos(t), r * Math.sin(t)), P(r * Math.cos(V), r * Math.sin(V))];
    if (normalFor(...p)[0] * N[0] + normalFor(...p)[2] * N[1] < 0) p.reverse();
    o.addTriangle(
      S(c, 'stone'),
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      C.dial,
    );
  }
  if (c.frames) {
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      Bspan(
        o,
        c,
        P(r * 0.78 * Math.cos(t), r * 0.78 * Math.sin(t), 0.035),
        P(r * 0.93 * Math.cos(t), r * 0.93 * Math.sin(t), 0.035),
        0.05,
        0.04,
        'metal',
        C.clock,
      );
    }
    for (const [t, len] of [
      [2.6, r * 0.65],
      [0.9, r * 0.85],
    ])
      Bspan(
        o,
        c,
        P(0, 0, 0.06),
        P(Math.cos(t) * len, Math.sin(t) * len, 0.06),
        0.06,
        0.05,
        'metal',
        C.metal,
      );
  }
}
function clock(o, c) {
  const [x, z] = H.clockCenter;
  B(o, c, [x - 2.8, H.eave, z - 2.8], [x + 2.8, H.clockWallTop, z + 2.8]);
  if (!c.far) {
    for (const sign of [-1, 1]) {
      for (const y of [13, 18, 22]) {
        window(o, c, [x + sign * 2.84, y, z], [0, 1], [sign, 0], 1.2, 1.8, false);
        window(o, c, [x, y, z + sign * 2.84], [1, 0], [0, sign], 1.2, 1.8, false);
      }
      dial(o, c, x + sign * 2.86, 25, z, [0, 1], [sign, 0], 0.72);
      dial(o, c, x, 25, z + sign * 2.86, [1, 0], [0, sign], 0.72);
    }
    for (const y of [12, 17.5, 21.6, 26.4])
      B(o, c, [x - 2.88, y, z - 2.88], [x + 2.88, y + 0.18, z + 2.88], 'stone', C.stone);
  }
  lantern(o, c, x, z, H.clockWallTop, 2.2, 3.4);
  const profile = c.far
    ? [
        [30.2, 3.2],
        [32.5, 2.4],
        [34.6, 1.0],
        [36.2, 1.6],
        [37.8, 0.25],
        [39.5, 0.025],
      ]
    : [
        [30.2, 3.4],
        [30.6, 3.5],
        [31.1, 2.95],
        [32.5, 2.7],
        [34, 1.4],
        [34.8, 1.0],
        [35.4, 1.1],
        [36.2, 1.6],
        [36.7, 1.5],
        [37.3, 0.5],
        [38.1, 0.3],
        [39.5, 0.025],
      ];
  L(
    o,
    c,
    profile.map(([y, R]) => radialRing(y, R, R, c.sides, [x, z], Math.PI / 8)),
    'red',
    C.red,
  );
}
function gable(o, c, x, z, y, w, h) {
  const points = [
      [-w / 2, 0],
      [-w / 2, h * 0.28],
      [-w * 0.3, h * 0.28],
      [-w * 0.3, h * 0.58],
      [-w * 0.17, h * 0.58],
      [-w * 0.17, h * 0.8],
      [0, h],
      [w * 0.17, h * 0.8],
      [w * 0.17, h * 0.58],
      [w * 0.3, h * 0.58],
      [w * 0.3, h * 0.28],
      [w / 2, h * 0.28],
      [w / 2, 0],
    ],
    flat = points.flat(),
    ids = earcut(flat, [], 2),
    P = ([u, v]) => [x, y + v, z + u];
  for (let i = 0; i < ids.length; i += 3) {
    let p = ids.slice(i, i + 3).map((j) => P(points[j]));
    if (normalFor(...p)[0] < 0) p.reverse();
    o.addTriangle(
      S(c, 'stone'),
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      C.stone,
    );
  }
  if (c.frames)
    for (let i = 1; i < points.length; i++)
      Bspan(o, c, P(points[i - 1]), P(points[i]), 0.16, 0.18, 'stone', C.pale);
}
function entry(o, c) {
  if (c.far) return;
  const x = 40.2,
    z = 0.96;
  for (const side of [-1, 1])
    for (const shift of [0, 0.55]) {
      const Z = z + side * (2 + shift);
      L(
        o,
        c,
        [
          radialRing(H.floor, 0.28, 0.28, c.sides, [x + 0.2, Z]),
          radialRing(5.5, 0.23, 0.23, c.sides, [x + 0.2, Z]),
        ],
        'stone',
        C.stone,
      );
    }
  B(o, c, [40.05, 5.5, z - 3.3], [41.15, 5.8, z + 3.3], 'stone', C.stone);
  B(o, c, [40.05, 8, z - 2.7], [41.25, 8.24, z + 2.7], 'stone', C.stone);
  if (c.frames)
    for (let i = 0; i <= 8; i++) {
      const Z = z - 2.5 + (i * 5) / 8;
      Bspan(o, c, [41.1, 8.24, Z], [41.1, 9, Z], 0.1, 0.1, 'stone', C.stone);
    }
  window(o, c, [40.28, 8.4, z], [0, 1], [1, 0], 1.25, 2.0, false);
  gable(o, c, 40.3, z, 11.2, 8.6, 6.4);
  window(o, c, [40.34, 13.4, z], [0, 1], [1, 0], 1.2, 1.8, false);
  for (const Z of [-17.5, 18.2]) {
    gable(o, c, 39.2, Z, 12.1, 3, 3.3);
    window(o, c, [39.24, 12.65, Z], [0, 1], [1, 0], 0.8, 1.2, false);
  }
  if (c.detail) sphere(o, S(c, 'stone'), [40.35, 11.4, z], [0.25, 1.0, 1.7], C.stone, 16, 8);
}
function hangingLamp(o, c, p) {
  const [x, y, z] = p;
  Bspan(o, c, [x, y + 0.5, z], [x, y, z], 0.03, 0.03, 'metal', C.metal);
  L(
    o,
    c,
    [rect(x, z, 0.22, 0.22, y), rect(x, z, 0.35, 0.35, y - 0.18), rect(x, z, 0.23, 0.23, y - 0.65)],
    'metal',
    C.gold,
  );
}
function statue(o, c, x, z, base) {
  if (!c.detail) return;
  B(o, c, [x - 0.4, base, z - 0.4], [x + 0.4, base + 0.6, z + 0.4], 'stone', C.pale);
  L(
    o,
    c,
    [
      radialRing(base + 0.6, 0.26, 0.26, 8, [x, z]),
      radialRing(base + 1.7, 0.35, 0.23, 8, [x, z]),
      radialRing(base + 2, 0.16, 0.16, 8, [x, z]),
    ],
    'stone',
    C.pale,
  );
  sphere(o, S(c, 'stone'), [x, base + 2.2, z], [0.18, 0.23, 0.18], C.pale, 10, 5);
}
function bridge(o, c, line, front) {
  const [A, Z] = line,
    dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz),
    N = [-dz / len, dx / len],
    P = (t, y, v = 0) => [A[0] + dx * t + N[0] * v, y, A[1] + dz * t + N[1] * v];
  Bspan(o, c, P(0, H.floor - 0.12), P(1, H.floor - 0.12), 5, 0.24, 'stone', C.pale);
  for (const t of [0, 1]) {
    const p = P(t, 0),
      low = eggenbergGroundY(p[0], p[2]) - 0.4;
    B(
      o,
      c,
      [p[0] - 1, Math.min(low, H.floor - 0.5), p[2] - 3],
      [p[0] + 1, H.floor, p[2] + 3],
      'stone',
      C.stone,
    );
  }
  if (!c.far) {
    for (const sign of [-1, 1]) {
      Bspan(
        o,
        c,
        P(0, H.floor + 0.45, sign * 2.6),
        P(1, H.floor + 0.45, sign * 2.6),
        0.45,
        0.9,
        'stone',
        C.stone,
      );
      for (const t of [0, 1]) {
        const p = P(t, 0, sign * 3);
        statue(o, c, p[0], p[2], H.floor);
      }
    }
    const extension = front ? 10 : 8,
      E = [Z[0] + (dx / len) * extension, Z[1] + (dz / len) * extension],
      y = eggenbergGroundY(...E) + 0.15;
    const apron = [
      P(1, H.floor, -2.5),
      [E[0] + N[0] * -2.5, y, E[1] + N[1] * -2.5],
      [E[0] + N[0] * 2.5, y, E[1] + N[1] * 2.5],
      P(1, H.floor, 2.5),
    ];
    if (normalFor(...apron)[1] < 0) apron.reverse();
    Q(o, c, apron, 'stone', C.paving);
  }
}
export function buildEggenbergLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error(level);
  shell(o, c, a.outline, a.holes);
  const core = parts[3].polygons[0][0];
  shell(o, c, core, [], true);
  portal(o, c, 19, 40, 0.96);
  portal(o, c, -35.9, -0.4, 2.54, 1.45);
  for (const court of H.courts) gallery(o, c, court);
  hip(o, c, 18.8, -34.5, 40.3, 34.5, H.mainRoofRidge, 'z');
  hip(o, c, -39.8, -34.5, 40, -18.7, 21.4, 'x');
  hip(o, c, -40, 14.3, 40, 33, 22.0, 'x');
  hip(o, c, -36, -34, -28.8, 32, 17.6, 'z');
  hip(o, c, -29.6, -13.7, -0.4, 7.3, 21.0, 'x');
  hip(o, c, -13.4, -19.4, -0.4, -13.6, 16.6, 'x');
  hip(o, c, -13.3, 7.1, -0.3, 15.1, 17.6, 'x');
  for (const [x, z] of H.corners) corner(o, c, x, z);
  clock(o, c);
  facades(o, c);
  entry(o, c);
  bridge(o, c, H.frontBridge, true);
  bridge(o, c, H.rearBridge, false);
  if (!c.far)
    for (const [x, z, y] of [
      [29, -20, 18],
      [29, 20, 18],
      [-20, -26, 18],
      [0, -26, 18],
      [20, -26, 18],
      [-20, 24, 18],
      [0, 24, 18],
      [20, 24, 18],
      [-32, -15, 15],
      [-32, 15, 15],
      [-20, -8, 18],
      [-12, 2, 18],
    ]) {
      B(o, c, [x - 0.38, y, z - 0.38], [x + 0.38, y + 3, z + 0.38], 'wall', C.wall);
      B(o, c, [x - 0.47, y + 2.8, z - 0.47], [x + 0.47, y + 3.15, z + 0.47], 'stone', C.pale);
    }
}
export const buildEggenbergSkyline = (o) => buildEggenbergLevel(o, 'skyline');
export const buildEggenbergDistrict = (o) => buildEggenbergLevel(o, 'district');
export const buildEggenbergStreet = (o) => buildEggenbergLevel(o, 'street');
export const buildEggenbergCloseup = (o) => buildEggenbergLevel(o, 'closeup');

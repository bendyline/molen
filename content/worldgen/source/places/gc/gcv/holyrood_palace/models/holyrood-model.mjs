/** Original Holyroodhouse quadrangle. Meters,+Y up,+X SSE,+Z WSW entrance. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const holyroodControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = holyroodControls,
  H = a.geometryControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('c8b992'),
  court: lin('b4b1a2'),
  trim: lin('d2c8ad'),
  slate: lin('7a8187'),
  lead: lin('b8c4c9'),
  glass: lin('5e7486'),
  wood: lin('746149'),
  frame: lin('ebe7da'),
  dial: lin('536773'),
  gold: lin('bea468'),
};
export const holyroodSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.86, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.82, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.82, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 1, bays: 3, dormers: 0 },
  district: { flat: true, n: 6, arch: 3, bays: 7, dormers: 2 },
  street: { frames: true, flatFrames: true, n: 8, arch: 6, bays: 9, dormers: 5 },
  closeup: { frames: true, detail: true, n: 16, arch: 12, bays: 9, dormers: 7 },
  master: { frames: true, detail: true, fine: true, n: 32, arch: 28, bays: 9, dormers: 9 },
};
export function holyroodGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((v, p, i) => {
      const q = r[(i + 1) % r.length];
      return v + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  },
  ring = (i) => cw(parts[i].polygons[0][0]);
function Q(o, c, p, s = 'wall', color = C.wall, N) {
  if (N && normalFor(...p).reduce((t, v, i) => t + v * N[i], 0) < 0) p.reverse();
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
  if (N && normalFor(...p).reduce((t, v, i) => t + v * N[i], 0) < 0) p.reverse();
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
function B(o, c, lo, hi, s = 'wall', color = C.wall) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
function L(o, c, r, s = 'wall', color = C.wall, cap = true) {
  loft(o, S(c, s), r, color, { cap });
}
function span(o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.trim) {
  beam(o, S(c, s), A, Z, w, d, color);
}
function cap(o, c, r, y, s = 'wall', color = C.wall, up = true) {
  const p = clean(r),
    ids = earcut(p.flat(), [], 2);
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
function inset(r, d) {
  const p = cw(r);
  return p.map((P, i) => {
    const A = p[(i + p.length - 1) % p.length],
      Z = p[(i + 1) % p.length],
      v = [P[0] - A[0], P[1] - A[1]],
      w = [Z[0] - P[0], Z[1] - P[1]],
      n = [v[1] / Math.hypot(...v), -v[0] / Math.hypot(...v)],
      N = [w[1] / Math.hypot(...w), -w[0] / Math.hypot(...w)],
      dot = n[0] * N[0] + n[1] * N[1];
    return P.map((x, k) => x + (d * (n[k] + N[k])) / (1 + dot));
  });
}
const gateY = (x) =>
  H.gateSpring +
  Math.sqrt(Math.max(0, H.gateRadius * H.gateRadius - (x - H.gateCenterX) * (x - H.gateCenterX)));
function wall(o, c, A, Z, top, gate = false, s = 'wall', color = C.wall, N) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    ts = [0, 1],
    P = (t, y) => [A[0] + dx * t, y, A[1] + dz * t];
  if (gate && Math.abs(dx) > 0.1)
    for (let j = 0; j <= c.arch * 2; j++) {
      const x = H.gateCenterX - H.gateRadius * Math.cos((j * Math.PI) / (c.arch * 2)),
        t = (x - A[0]) / dx;
      if (t > 0 && t < 1) ts.push(t);
    }
  ts.sort((x, y) => x - y);
  for (let j = 1; j < ts.length; j++) {
    const t = ts[j - 1],
      v = ts[j],
      m = (t + v) / 2,
      inside = gate && Math.abs(A[0] + dx * m - H.gateCenterX) < H.gateRadius,
      low = (u) =>
        inside ? gateY(A[0] + dx * u) : holyroodGroundY(A[0] + dx * u, A[1] + dz * u) - 0.3;
    Q(o, c, [P(t, low(t)), P(v, low(v)), P(v, top), P(t, top)], s, color, N);
  }
}
function courtEdge(A, Z) {
  const mx = (A[0] + Z[0]) / 2,
    mz = (A[1] + Z[1]) / 2;
  return H.courtEdges.some((e) => {
    const dx = e.Z[0] - e.A[0],
      dz = e.Z[1] - e.A[1],
      l = Math.hypot(dx, dz),
      distance = Math.abs((mx - e.A[0]) * dz - (mz - e.A[1]) * dx) / l,
      t = ((mx - e.A[0]) * dx + (mz - e.A[1]) * dz) / (l * l);
    return distance < 0.35 && t > -0.02 && t < 1.02;
  });
}
function shell(o, c, index, eave, arcades = false, gate = false, upperOnly = false) {
  const p = ring(index);
  for (let i = 0; i < p.length; i++) {
    const A = p[i],
      Z = p[(i + 1) % p.length];
    if (!upperOnly && (!arcades || !courtEdge(A, Z)))
      wall(o, c, A, Z, H.arcadeTop, gate && Math.abs(Z[1] - A[1]) < 1 && A[1] > 9);
    const court = (arcades && courtEdge(A, Z)) || index === 66;
    Q(
      o,
      c,
      [
        [A[0], H.arcadeTop, A[1]],
        [Z[0], H.arcadeTop, Z[1]],
        [Z[0], eave, Z[1]],
        [A[0], eave, A[1]],
      ],
      court ? 'stone' : 'wall',
      court ? C.court : C.wall,
    );
  }
  cap(o, c, p, H.arcadeTop, 'stone', C.court, false);
  cap(o, c, p, eave);
}
function projector(e) {
  const dx = e.Z[0] - e.A[0],
    dz = e.Z[1] - e.A[1],
    len = Math.hypot(dx, dz);
  return {
    len,
    P: (u, y, d = 0) => [
      e.A[0] + (u * dx) / len + e.N[0] * d,
      y,
      e.A[1] + (u * dz) / len + e.N[1] * d,
    ],
  };
}
function pane(o, c, x, z, N, y, w, h, s = 'glass', color = C.glass) {
  const P = (u, Y, d = 0) => [x + N[1] * u + N[0] * d, Y, z - N[0] * u + N[1] * d];
  Q(
    o,
    c,
    [P(-w / 2, y, 0.035), P(w / 2, y, 0.035), P(w / 2, y + h, 0.035), P(-w / 2, y + h, 0.035)],
    s,
    color,
    [N[0], 0, N[1]],
  );
  if (c.flatFrames)
    for (const [u, U, Y, V] of [
      [-w / 2 - 0.08, -w / 2, y - 0.08, y + h + 0.08],
      [w / 2, w / 2 + 0.08, y - 0.08, y + h + 0.08],
      [-w / 2, w / 2, y - 0.08, y],
      [-w / 2, w / 2, y + h, y + h + 0.08],
    ])
      Q(o, c, [P(u, Y, 0.07), P(U, Y, 0.07), P(U, V, 0.07), P(u, V, 0.07)], 'wood', C.frame, [
        N[0],
        0,
        N[1],
      ]);
  else if (c.frames) {
    for (const u of [-w / 2, w / 2])
      span(o, c, P(u, y - 0.08, 0.08), P(u, y + h + 0.08, 0.08), 0.07, 0.07, 'wood', C.frame);
    for (const Y of [y, y + h])
      span(o, c, P(-w / 2 - 0.07, Y, 0.08), P(w / 2 + 0.07, Y, 0.08), 0.07, 0.07, 'wood', C.frame);
    if (c.detail) {
      span(o, c, P(0, y, 0.08), P(0, y + h, 0.08), 0.035, 0.035, 'wood', C.frame);
      for (let j = 1; j < (c.fine ? 6 : 4); j++)
        span(
          o,
          c,
          P(-w / 2, y + (h * j) / (c.fine ? 6 : 4), 0.08),
          P(w / 2, y + (h * j) / (c.fine ? 6 : 4), 0.08),
          0.03,
          0.03,
          'wood',
          C.frame,
        );
    }
  }
}
function gallery(o, c, e) {
  const { len, P } = projector(e),
    count = c.bays,
    bay = len / count,
    depth = H.galleryDepth,
    out = [-e.N[0], 0, -e.N[1]],
    spring = H.spring;
  for (let i = 0; i <= count; i++) {
    const u = i * bay,
      p = P(u, 0, 0.22),
      base = holyroodGroundY(p[0], p[2]) + 0.12;
    span(
      o,
      c,
      [p[0], base, p[2]],
      [p[0], c.far ? 4.4 : spring, p[2]],
      c.far ? 0.62 : 0.52,
      0.52,
      'stone',
      C.court,
    );
    if (c.detail) {
      const q = P(u, 0, -0.12);
      L(
        o,
        c,
        [
          [base, 0.2],
          [base + 0.16, 0.2],
          [base + 0.25, 0.14],
          [spring - 0.2, 0.14],
          [spring - 0.08, 0.2],
          [spring, 0.2],
        ].map(([y, r]) => radialRing(y, r, r, c.fine ? 12 : 8, [q[0], q[2]])),
        'stone',
        C.court,
      );
    }
  }
  if (c.far) span(o, c, P(0, 5.15, 0.22), P(len, 5.15, 0.22), 0.52, 1.5, 'stone', C.court);
  else
    for (let i = 0; i < count; i++) {
      const center = (i + 0.5) * bay,
        r = Math.min(1.3, (bay - 0.62) / 2),
        l = center - r,
        R = center + r;
      const base = (u, d) => {
        const p = P(u, 0, d);
        return holyroodGroundY(p[0], p[2]) + 0.12;
      };
      for (const [u, v] of [
        [i * bay, l],
        [R, (i + 1) * bay],
      ])
        for (const d of [0, 0.44])
          Q(
            o,
            c,
            [P(u, base(u, d), d), P(v, base(v, d), d), P(v, H.arcadeTop, d), P(u, H.arcadeTop, d)],
            'stone',
            C.court,
            d === 0 ? out : out.map((v) => -v),
          );
      for (const [u, sign] of [
        [l, 1],
        [R, -1],
      ]) {
        const dx = e.Z[0] - e.A[0],
          dz = e.Z[1] - e.A[1];
        Q(
          o,
          c,
          [P(u, base(u, 0), 0), P(u, base(u, 0.44), 0.44), P(u, spring, 0.44), P(u, spring, 0)],
          'stone',
          C.court,
          [(sign * dx) / len, 0, (sign * dz) / len],
        );
      }
      for (let j = 0; j < c.arch; j++) {
        const t = (j * Math.PI) / c.arch,
          Tt = ((j + 1) * Math.PI) / c.arch,
          u = center - r * Math.cos(t),
          v = center - r * Math.cos(Tt),
          y = spring + r * Math.sin(t),
          Y = spring + r * Math.sin(Tt);
        for (const d of [0, 0.44])
          Q(
            o,
            c,
            [P(u, y, d), P(v, Y, d), P(v, H.arcadeTop, d), P(u, H.arcadeTop, d)],
            'stone',
            C.court,
            d === 0 ? out : out.map((v) => -v),
          );
        Q(
          o,
          c,
          [P(u, y, 0), P(u, y, 0.44), P(v, Y, 0.44), P(v, Y, 0)],
          'stone',
          C.court,
          [0, -1, 0],
        );
      }
    }
  const A = P(0, 0, depth),
    Z = P(len, 0, depth);
  wall(o, c, [A[0], A[2]], [Z[0], Z[2]], H.arcadeTop, !!e.lower, 'stone', C.court, out);
  Q(
    o,
    c,
    [
      P(0, H.arcadeTop, 0),
      P(len, H.arcadeTop, 0),
      P(len, H.arcadeTop, depth),
      P(0, H.arcadeTop, depth),
    ],
    'stone',
    C.court,
    [0, -1, 0],
  );
  for (let i = 0; i < count; i++) {
    const p = [
      P(i * bay, 0, 0),
      P((i + 1) * bay, 0, 0),
      P((i + 1) * bay, 0, depth),
      P(i * bay, 0, depth),
    ].map(([x, , z]) => [x, holyroodGroundY(x, z) + 0.12, z]);
    Q(o, c, p, 'stone', C.court, [0, 1, 0]);
    if (!c.far) {
      const q = P((i + 0.5) * bay, 0, depth - 0.04);
      if (!(e.lower && Math.abs(q[0] - H.gateCenterX) < 2))
        pane(
          o,
          c,
          q[0],
          q[2],
          e.N.map((v) => -v),
          1.8,
          1,
          2.1,
          i % 3 === 1 ? 'wood' : 'glass',
          i % 3 === 1 ? C.wood : C.glass,
        );
      const levels = e.lower
        ? [[6.45, 2.55]]
        : [
            [7.1, 3.4],
            [12.8, 3.4],
          ];
      for (const [y, h] of levels) {
        const q = P((i + 0.5) * bay, 0, -0.02);
        pane(
          o,
          c,
          q[0],
          q[2],
          e.N.map((v) => -v),
          y,
          1.25,
          h,
        );
      }
      if (c.frames) {
        const q = P(i * bay, 0, -0.08);
        span(
          o,
          c,
          [q[0], 6, q[2]],
          [q[0], e.lower ? 9.65 : 18.4, q[2]],
          0.2,
          0.18,
          'stone',
          C.court,
        );
      }
    }
  }
}
function galleryReturns(o, c) {
  for (let i = 0; i < H.courtEdges.length; i++) {
    const e = H.courtEdges[i],
      next = H.courtEdges[(i + 1) % H.courtEdges.length],
      E = projector(e),
      F = projector(next),
      A = E.P(E.len, 0, H.galleryDepth),
      Z = F.P(0, 0, H.galleryDepth),
      mx = (A[0] + Z[0]) / 2,
      mz = (A[2] + Z[2]) / 2,
      N = [-mx, 0, -3 - mz];
    wall(o, c, [A[0], A[2]], [Z[0], Z[2]], H.arcadeTop, false, 'stone', C.court, N);
    T(
      o,
      c,
      [
        [e.Z[0], holyroodGroundY(...e.Z) + 0.12, e.Z[1]],
        [A[0], holyroodGroundY(A[0], A[2]) + 0.12, A[2]],
        [Z[0], holyroodGroundY(Z[0], Z[2]) + 0.12, Z[2]],
      ],
      'stone',
      C.court,
      [0, 1, 0],
    );
  }
}
function courtBelts(o, c) {
  if (!c.frames) return;
  for (const e of H.courtEdges) {
    const { len, P } = projector(e);
    for (const y of e.lower ? [5.98, 9.75] : [5.98, 11.9, 18.48])
      span(o, c, P(0, y, -0.08), P(len, y, -0.08), 0.25, 0.22, 'stone', C.court);
  }
  for (const y of [11.9, 18.48])
    span(o, c, [-5.3, y, -16.25], [4.45, y, -16.25], 0.25, 0.22, 'stone', C.court);
}
function mainRoof(o, c) {
  const p = cw(H.roofOutline),
    q = inset(p, H.roofInset);
  L(
    o,
    c,
    [p.map(([x, z]) => [x, H.mainEave, z]), q.map(([x, z]) => [x, H.roofTop, z])],
    'slate',
    C.slate,
    false,
  );
  cap(o, c, q, H.roofTop, 'metal', C.lead);
  cap(o, c, p, H.mainEave, 'slate', C.slate, false);
  if (c.detail)
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      span(
        o,
        c,
        [p[i][0], H.mainEave + 0.04, p[i][1]],
        [p[j][0], H.mainEave + 0.04, p[j][1]],
        0.09,
        0.09,
        'metal',
        C.lead,
      );
      if (c.fine)
        span(
          o,
          c,
          [q[i][0], H.roofTop + 0.04, q[i][1]],
          [q[j][0], H.roofTop + 0.04, q[j][1]],
          0.08,
          0.08,
          'metal',
          C.lead,
        );
    }
}
function turret(o, c, index) {
  const b = parts[index].bounds,
    x = (b[0] + b[2]) / 2,
    z = (b[1] + b[3]) / 2,
    r = Math.min(b[2] - b[0], b[3] - b[1]) / 2,
    base = holyroodGroundY(x, z) - 0.4,
    profile = c.far
      ? [
          [base, r],
          [H.towerEave, r * 1.08],
        ]
      : c.flat
        ? [
            [base, r],
            [14.1, r],
            [14.45, r * 1.13],
            [H.towerEave, r * 1.04],
          ]
        : [
            [base, r],
            [4.7, r],
            [4.9, r * 1.025],
            [5.1, r],
            [13.8, r],
            [14.1, r * 1.04],
            [14.45, r * 1.13],
            [15.1, r * 1.13],
            [15.3, r * 1.04],
            [H.towerEave, r * 1.04],
          ];
  L(
    o,
    c,
    profile.map(([y, R]) => radialRing(y, R, R, c.n, [x, z])),
  );
  const metal = index !== 63;
  L(
    o,
    c,
    [
      [H.towerEave, r * 1.12],
      [H.towerEave + 0.3, r * 1.12],
      [H.coneTop, 0.07],
    ].map(([y, R]) => radialRing(y, R, R, c.n, [x, z])),
    metal ? 'metal' : 'slate',
    metal ? C.lead : C.slate,
  );
  if (!c.far) {
    for (const y of [3, 7.5, 12, 16.5])
      for (const t of [index < 61 ? 0 : Math.PI, Math.PI / 2]) {
        const N = [Math.cos(t), Math.sin(t)];
        pane(o, c, x + N[0] * (r + 0.02), z + N[1] * (r + 0.02), N, y, 0.72, y === 16.5 ? 1 : 2);
      }
    if (c.detail)
      for (let j = 0; j < c.n; j++) {
        const t = (j * 2 * Math.PI) / c.n,
          Tt = ((j + 1) * 2 * Math.PI) / c.n;
        span(
          o,
          c,
          [x + r * 1.12 * Math.cos(t), H.towerEave + 0.3, z + r * 1.12 * Math.sin(t)],
          [x + 0.07 * Math.cos(Tt), H.coneTop, z + 0.07 * Math.sin(Tt)],
          0.035,
          0.035,
          'metal',
          C.lead,
        );
      }
  }
  L(
    o,
    c,
    [
      [H.coneTop, 0.08],
      [H.coneTop + 0.5, 0.05],
    ].map(([y, R]) => radialRing(y, R, R, c.far ? 4 : 8, [x, z])),
    'metal',
    C.gold,
  );
}
function towerRoof(o, c, index) {
  const p = ring(index);
  cap(o, c, p, H.towerEave + 0.05, 'metal', C.lead);
  if (!c.far)
    for (let i = 0; i < p.length; i++) {
      const A = p[i],
        Z = p[(i + 1) % p.length],
        len = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
      span(o, c, [A[0], H.towerEave + 0.35, A[1]], [Z[0], H.towerEave + 0.35, Z[1]], 0.45, 0.35);
      if (c.detail && len > 4)
        for (let j = 1; j < len / 2; j++) {
          const t = j / Math.ceil(len / 2),
            x = A[0] + t * (Z[0] - A[0]),
            z = A[1] + t * (Z[1] - A[1]);
          B(
            o,
            c,
            [x - 0.35, H.towerEave + 0.35, z - 0.25],
            [x + 0.35, H.towerEave + 0.9, z + 0.25],
            'stone',
            C.trim,
          );
        }
    }
}
function gate(o, c) {
  const x = H.gateCenterX,
    r = H.gateRadius,
    z0 = 10.1,
    z1 = 22.7,
    n = c.far ? 2 : c.arch * 2;
  for (let j = 0; j < 6; j++) {
    const Z = z0 + ((z1 - z0) * j) / 6,
      V = z0 + ((z1 - z0) * (j + 1)) / 6,
      p = [
        [x - r, 0, Z],
        [x + r, 0, Z],
        [x + r, 0, V],
        [x - r, 0, V],
      ].map(([X, , z]) => [X, holyroodGroundY(X, z) + 0.12, z]);
    Q(o, c, p, 'stone', C.court, [0, 1, 0]);
  }
  for (let j = 0; j < n; j++) {
    const t = (j * Math.PI) / n,
      Tt = ((j + 1) * Math.PI) / n,
      A = [x - r * Math.cos(t), H.gateSpring + r * Math.sin(t)],
      Z = [x - r * Math.cos(Tt), H.gateSpring + r * Math.sin(Tt)];
    Q(
      o,
      c,
      [
        [A[0], A[1], z0],
        [A[0], A[1], z1],
        [Z[0], Z[1], z1],
        [Z[0], Z[1], z0],
      ],
      'stone',
      C.court,
      [0, -1, 0],
    );
  }
  for (const side of [-1, 1])
    Q(
      o,
      c,
      [
        [x + side * r, holyroodGroundY(x + side * r, z0), z0],
        [x + side * r, holyroodGroundY(x + side * r, z1), z1],
        [x + side * r, H.gateSpring, z1],
        [x + side * r, H.gateSpring, z0],
      ],
      'stone',
      C.court,
      [-side, 0, 0],
    );
  B(o, c, [x - 1.55, 9.8, 19.65], [x + 1.55, 12.7, 22.3], 'stone', C.trim);
  L(
    o,
    c,
    [
      [12.7, 1.45],
      [13.4, 1.2],
      [14.4, 0.9],
    ].map(([y, R]) => radialRing(y, R, R, c.far ? 4 : c.n, [x, 20.9])),
    'stone',
    C.trim,
  );
  if (c.far || c.flat)
    L(
      o,
      c,
      [
        [14.4, 0.9],
        [15.7, 0.06],
      ].map(([y, R]) => radialRing(y, R, R, c.far ? 4 : c.n, [x, 20.9])),
      'metal',
      C.gold,
    );
  else {
    L(
      o,
      c,
      [
        [14.4, 0.9],
        [14.55, 0.9],
      ].map(([y, r]) => radialRing(y, r, r, c.n, [x, 20.9])),
      'metal',
      C.gold,
      false,
    );
    for (const axis of [0, 1])
      for (let j = 0; j < c.arch; j++) {
        const point = (t) => [
          x + (axis === 0 ? 0.85 * Math.cos(t) : 0),
          14.5 + 1.2 * Math.sin(t),
          20.9 + (axis === 1 ? 0.85 * Math.cos(t) : 0),
        ];
        span(
          o,
          c,
          point((j * Math.PI) / c.arch),
          point(((j + 1) * Math.PI) / c.arch),
          0.075,
          0.075,
          'metal',
          C.gold,
        );
      }
    span(o, c, [x, 15.65, 20.9], [x, 16.1, 20.9], 0.09, 0.09, 'metal', C.gold);
    span(o, c, [x - 0.18, 15.95, 20.9], [x + 0.18, 15.95, 20.9], 0.07, 0.07, 'metal', C.gold);
  }
  if (!c.far) {
    for (const X of [x - 3.1, x - 2.15, x + 2.15, x + 3.1]) {
      const base = holyroodGroundY(X, 22.95) + 0.1;
      L(
        o,
        c,
        [
          [base, 0.32],
          [base + 0.2, 0.4],
          [base + 0.35, 0.26],
          [8.1, 0.26],
          [8.25, 0.42],
          [8.55, 0.42],
        ].map(([y, R]) => radialRing(y, R, R, c.n, [X, 22.95])),
        'stone',
        C.trim,
      );
    }
    span(o, c, [x - 3.6, 8.7, 22.95], [x + 3.6, 8.7, 22.95], 0.3, 0.9);
    const N = [0, 1],
      y = 11.3;
    for (let j = 0; j < c.n; j++) {
      const t = (j * 2 * Math.PI) / c.n,
        Tt = ((j + 1) * 2 * Math.PI) / c.n;
      T(
        o,
        c,
        [
          [x, y, 22.34],
          [x + 0.65 * Math.cos(t), y + 0.65 * Math.sin(t), 22.34],
          [x + 0.65 * Math.cos(Tt), y + 0.65 * Math.sin(Tt), 22.34],
        ],
        'glass',
        C.dial,
        [0, 0, 1],
      );
    }
    if (c.frames) {
      span(o, c, [x, y, 22.38], [x - 0.3, y + 0.3, 22.38], 0.04, 0.04, 'metal', C.gold);
      span(o, c, [x, y, 22.38], [x + 0.08, y + 0.5, 22.38], 0.04, 0.04, 'metal', C.gold);
    }
    if (c.detail)
      for (const side of [-1, 1]) {
        B(
          o,
          c,
          [x + side * 2 - 0.25, 5.4, 22.75],
          [x + side * 2 + 0.25, 7.8, 23.05],
          'stone',
          C.trim,
        );
        for (let j = 0; j < 4; j++)
          span(
            o,
            c,
            [x + side * (0.7 + j * 0.4), 8.9, 22.85],
            [x + side * (0.9 + j * 0.4), 9.3, 22.85],
            0.08,
            0.08,
          );
      }
  }
}
function dormer(o, c, e, u) {
  const { P } = projector(e),
    w = 1.75,
    lo = 19.65,
    hi = 21.5,
    peak = 22.6,
    d0 = 1,
    d1 = 3.2,
    N = [-e.N[0], 0, -e.N[1]],
    A = P(u - w / 2, lo, d0),
    Z = P(u + w / 2, lo, d0),
    B0 = P(u - w / 2, hi, d0),
    B1 = P(u + w / 2, hi, d0),
    C0 = P(u - w / 2, hi, d1),
    C1 = P(u + w / 2, hi, d1),
    F = P(u, peak, d0),
    R = P(u, peak, d1);
  Q(o, c, [A, Z, B1, B0], 'wood', C.trim, N);
  T(o, c, [B0, B1, F], 'wood', C.trim, N);
  Q(o, c, [A, B0, C0, P(u - w / 2, lo, d1)], 'slate', C.slate);
  Q(o, c, [Z, P(u + w / 2, lo, d1), C1, B1], 'slate', C.slate);
  Q(o, c, [B0, F, R, C0], 'slate', C.slate, [0, 1, 0]);
  Q(o, c, [F, B1, C1, R], 'slate', C.slate, [0, 1, 0]);
  T(
    o,
    c,
    [C1, C0, R],
    'slate',
    C.slate,
    N.map((v) => -v),
  );
  const q = P(u, 0, d0 - 0.02);
  pane(
    o,
    c,
    q[0],
    q[2],
    e.N.map((v) => -v),
    20,
    1.05,
    1.2,
  );
}
function chimney(o, c, e, u) {
  const { P } = projector(e),
    q = P(u, 0, 8.5),
    x = q[0],
    z = q[2];
  B(o, c, [x - 0.65, 22.4, z - 0.65], [x + 0.65, 27.7, z + 0.65]);
  B(o, c, [x - 0.82, 27.4, z - 0.8], [x + 0.82, 27.8, z + 0.8], 'stone', C.trim);
  if (c.detail)
    for (const dx of [-0.36, 0.36])
      for (const dz of [-0.36, 0.36]) {
        const X = x + dx,
          Z = z + dz,
          r = 0.17,
          b = 27.8,
          t = 28.25;
        for (const [lo, hi] of [
          [
            [X - r, b, Z - r],
            [X + r, t, Z - r + 0.05],
          ],
          [
            [X - r, b, Z + r - 0.05],
            [X + r, t, Z + r],
          ],
          [
            [X - r, b, Z - r + 0.05],
            [X - r + 0.05, t, Z + r - 0.05],
          ],
          [
            [X + r - 0.05, b, Z - r + 0.05],
            [X + r, t, Z + r - 0.05],
          ],
        ])
          B(o, c, lo, hi, 'stone', C.trim);
      }
}
function cupola(o, c, x, z) {
  const n = c.far ? 4 : c.n,
    profiles = c.far
      ? [
          [23, 1.1],
          [25.6, 1.3],
          [27, 0.15],
        ]
      : [
          [23, 1.1],
          [23.3, 1.25],
          [25.4, 1.05],
          [25.6, 1.3],
          [26.4, 1],
          [27, 0.15],
        ];
  L(
    o,
    c,
    profiles.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    'metal',
    C.lead,
  );
  L(
    o,
    c,
    [
      [27, 0.1],
      [27.6, 0.06],
    ].map(([y, r]) => radialRing(y, r, r, c.far ? 4 : 8, [x, z])),
    'metal',
    C.gold,
  );
  if (!c.far)
    for (let j = 0; j < 4; j++) {
      const t = (j * Math.PI) / 2,
        N = [Math.cos(t), Math.sin(t)];
      pane(o, c, x + N[0] * 1.12, z + N[1] * 1.12, N, 23.8, 0.55, 1.2);
    }
}
function outsideWindows(o, c) {
  if (c.far) return;
  const p = ring(124);
  for (let i = 0; i < p.length; i++) {
    const A = p[i],
      Z = p[(i + 1) % p.length],
      dx = Z[0] - A[0],
      dz = Z[1] - A[1],
      len = Math.hypot(dx, dz);
    if (len < 5) continue;
    const N = [-dz / len, dx / len],
      count = Math.max(1, Math.round(len / 4));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        x = A[0] + t * dx,
        z = A[1] + t * dz,
        front = z > 18 && Math.abs(x) < 22,
        levels = front
          ? [
              [1.5, 1],
              [5, 3],
            ]
          : [
              [2, 2],
              [7.6, 3],
              [13, 3],
              [17, 1.1],
            ];
      for (const [y, h] of levels) {
        if (front && Math.abs(x - H.gateCenterX) < 4) continue;
        pane(o, c, x, z, N, y, front ? 1.25 : 1.05, h);
      }
    }
  }
}
function balcony(o, c) {
  if (c.far) return;
  const y = H.linkEave + 0.15;
  for (const z of [10.2, 19.4]) {
    span(o, c, [-14.5, y, z], [13.5, y, z], 0.2, 0.3);
    span(o, c, [-14.5, y + 1.05, z], [13.5, y + 1.05, z], 0.2, 0.24);
    if (c.detail)
      for (let x = -14; x <= 13; x += c.fine ? 0.65 : 1)
        L(
          o,
          c,
          [
            [y + 0.12, 0.08],
            [y + 0.4, 0.12],
            [y + 0.7, 0.08],
            [y + 1, 0.08],
          ].map(([Y, r]) => radialRing(Y, r, r, c.fine ? 8 : 4, [x, z])),
          'stone',
          C.trim,
        );
  }
}
function rearPediment(o, c) {
  const x = -0.45,
    x0 = -5.3,
    x1 = 4.45,
    y = H.mainEave,
    peak = 21.7,
    z0 = -16.35,
    z1 = -20.8;
  T(
    o,
    c,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x, peak, z0],
    ],
    'stone',
    C.court,
    [0, 0, 1],
  );
  T(
    o,
    c,
    [
      [x0, y, z1],
      [x1, y, z1],
      [x, peak, z1],
    ],
    'slate',
    C.slate,
    [0, 0, -1],
  );
  Q(
    o,
    c,
    [
      [x0, y, z0],
      [x, peak, z0],
      [x, peak, z1],
      [x0, y, z1],
    ],
    'slate',
    C.slate,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x, peak, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x, peak, z1],
    ],
    'slate',
    C.slate,
    [0, 1, 0],
  );
  if (!c.far) {
    for (const Y of [7.1, 12.8])
      for (const X of [-3.55, -0.45, 2.65]) pane(o, c, X, z0 + 0.04, [0, 1], Y, 1.25, 3.4);
    if (c.frames) {
      span(o, c, [x0, y, z0 + 0.1], [x, peak, z0 + 0.1], 0.16, 0.16);
      span(o, c, [x, peak, z0 + 0.1], [x1, y, z0 + 0.1], 0.16, 0.16);
    }
  }
}
export function buildHolyroodLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Holyrood level:' + level);
  for (const i of H.sourceRanges) shell(o, c, i, H.mainEave, true);
  shell(o, c, 65, H.linkEave, true, true);
  for (const i of H.towerBlocks) {
    shell(o, c, i, H.towerEave);
    towerRoof(o, c, i);
  }
  shell(o, c, 66, H.mainEave, false, false, true);
  for (const e of H.courtEdges) gallery(o, c, e);
  galleryReturns(o, c);
  courtBelts(o, c);
  mainRoof(o, c);
  cap(o, c, ring(65), H.linkEave + 0.06, 'metal', C.lead);
  cap(o, c, ring(66), H.mainEave + 0.03, 'metal', C.lead);
  for (const i of H.turretIndices) turret(o, c, i);
  gate(o, c);
  outsideWindows(o, c);
  balcony(o, c);
  rearPediment(o, c);
  for (const e of H.courtEdges.filter((e) => !e.lower)) {
    const { len } = projector(e);
    for (let j = 0; j < c.dormers; j++) dormer(o, c, e, (len * (j + 0.5)) / c.dormers);
    if (c.far) {
      if (e.id === 'rear') for (const t of [0.15, 0.85]) chimney(o, c, e, len * t);
    } else for (const t of [0.15, 0.5, 0.85]) chimney(o, c, e, len * t);
  }
  for (const x of [-7, 7]) cupola(o, c, x, -27);
}
export const buildHolyroodSkyline = (o) => buildHolyroodLevel(o, 'skyline');
export const buildHolyroodDistrict = (o) => buildHolyroodLevel(o, 'district');
export const buildHolyroodStreet = (o) => buildHolyroodLevel(o, 'street');
export const buildHolyroodCloseup = (o) => buildHolyroodLevel(o, 'closeup');

/** Original Schwerin principal castle. Meters,+Y up,+X NNE,+Z ESE. */
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
export const schwerinControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = schwerinControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('d4c6a8'),
  trim: lin('e1d7bd'),
  red: lin('aa7062'),
  roof: lin('66727d'),
  gold: lin('b8a25e'),
  green: lin('80a49a'),
  glass: lin('526779'),
  wood: lin('a1a496'),
  shadow: lin('837b6d'),
};
export const schwerinSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
  red: { slot: 'trim', graph: 'brick', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.8, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.48, metallic: 0.45 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35, metallic: 0.08 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const config = {
  skyline: { far: true, n: 4, arch: 2, windowStep: 99, gables: 0 },
  district: { n: 6, arch: 4, flat: true, windowStep: 9, gables: 1 },
  street: { n: 10, arch: 8, flatFrames: true, windowStep: 5.5, gables: 2 },
  closeup: { n: 20, arch: 16, frames: true, detail: true, windowStep: 5.5, gables: 3 },
  master: { n: 40, arch: 32, frames: true, detail: true, fine: true, windowStep: 4.5, gables: 7 },
};
export function schwerinGroundY(x, z) {
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
const slot = (c, s) => (c.far ? 'far' : s);
const clean = (r) => {
  const p = r.slice();
  if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
  return p;
};
const area = (r) =>
  r.reduce((v, p, i) => {
    const q = r[(i + 1) % r.length];
    return v + p[0] * q[1] - q[0] * p[1];
  }, 0);
const cw = (r) => {
  const p = clean(r);
  return area(p) > 0 ? p.reverse() : p;
};
function Q(o, c, p, s = 'wall', col = C.wall, N) {
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addQuad(
    slot(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    col,
  );
}
function T(o, c, p, s = 'wall', col = C.wall, N) {
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addTriangle(
    slot(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    col,
  );
}
const B = (o, c, l, h, s = 'stone', col = C.trim) => box(o, slot(c, s), l, h, col);
const L = (o, c, r, s = 'stone', col = C.trim, cap = true) => loft(o, slot(c, s), r, col, { cap });
const span = (o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', col = C.trim) =>
  beam(o, slot(c, s), A, Z, w, d, col);
function cap(o, c, rings, y, s = 'wall', col = C.wall, up = true) {
  const rs = rings.map(clean),
    ps = rs.flat(),
    holes = [];
  let count = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const ids = earcut(ps.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]),
      s,
      col,
      [0, up ? 1 : -1, 0],
    );
}
const G = [33.65, -33.7],
  D = [-11.05, 17.25],
  dl = Math.hypot(...D),
  V = D.map((v) => v / dl),
  U = [V[1], -V[0]],
  R = 2.4,
  spring = 4.1;
export const schwerinGatePoint = (u, y, v) => [
  G[0] + U[0] * u + V[0] * v,
  y,
  G[1] + U[1] * u + V[1] * v,
];
const gateCoords = (p) => [
  (p[0] - G[0]) * U[0] + (p[1] - G[1]) * U[1],
  (p[0] - G[0]) * V[0] + (p[1] - G[1]) * V[1],
];
function wall(o, c, A, Z, top, { low, gate = false, s = 'wall', col = C.wall, N } = {}) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    P = (t, y) => [A[0] + dx * t, y, A[1] + dz * t],
    ts = [0, 1],
    u0 = gateCoords(A)[0],
    u1 = gateCoords(Z)[0],
    du = u1 - u0;
  if (gate && Math.abs(du) > 0.001)
    for (let j = 0; j <= c.arch * 2; j++) {
      const u = -R * Math.cos((j * Math.PI) / (c.arch * 2)),
        t = (u - u0) / du;
      if (t > 0 && t < 1) ts.push(t);
    }
  ts.sort((a, b) => a - b);
  for (let j = 1; j < ts.length; j++) {
    const t = ts[j - 1],
      v = ts[j],
      mid = P((t + v) / 2, 0),
      [u, w] = gateCoords([mid[0], mid[2]]),
      inside = gate && Math.abs(u) < R - 0.0001 && w > -8 && w < 31;
    const Y = (k) =>
      inside
        ? spring + Math.sqrt(Math.max(0, R * R - (u0 + du * k) ** 2))
        : (low ?? schwerinGroundY(A[0] + dx * k, A[1] + dz * k) - 0.35);
    Q(o, c, [P(t, Y(t)), P(v, Y(v)), P(v, top), P(t, top)], s, col, N);
  }
}
function shell(o, c, r, eave, low = 17) {
  const p = cw(r);
  for (let i = 0; i < p.length; i++)
    wall(o, c, p[i], p[(i + 1) % p.length], eave, { low: low === null ? undefined : low });
  cap(o, c, [p], eave);
  if (low !== null) cap(o, c, [p], low, 'wall', C.wall, false);
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
function hip(o, c, r, eave, top, insetMeters = 4) {
  const lo = cw(r),
    hi = inset(lo, insetMeters);
  for (let i = 0; i < lo.length; i++) {
    const j = (i + 1) % lo.length;
    Q(
      o,
      c,
      [
        [lo[i][0], eave, lo[i][1]],
        [lo[j][0], eave, lo[j][1]],
        [hi[j][0], top, hi[j][1]],
        [hi[i][0], top, hi[i][1]],
      ],
      'roof',
      C.roof,
    );
  }
  cap(o, c, [hi], top, 'roof', C.roof);
  if (c.detail)
    for (const [r, y] of [
      [lo, eave + 0.06],
      [hi, top + 0.06],
    ])
      for (let i = 0; i < r.length; i++)
        span(
          o,
          c,
          [r[i][0], y, r[i][1]],
          [r[(i + 1) % r.length][0], y, r[(i + 1) % r.length][1]],
          0.1,
          0.12,
          'metal',
          C.roof,
        );
}
function projector(A, Z, N) {
  const l = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
  return {
    l,
    P: (u, y, d = 0) => [
      A[0] + ((Z[0] - A[0]) * u) / l + N[0] * d,
      y,
      A[1] + ((Z[1] - A[1]) * u) / l + N[1] * d,
    ],
  };
}
function pane(o, c, P, y, w = 1.7, h = 2.7, red = false) {
  const col = red ? C.red : C.trim,
    s = red ? 'red' : 'stone';
  Q(
    o,
    c,
    [P(-w / 2, y, 0.04), P(w / 2, y, 0.04), P(w / 2, y + h, 0.04), P(-w / 2, y + h, 0.04)],
    'glass',
    C.glass,
  );
  if (c.flatFrames)
    for (const [u, v, Y, Z] of [
      [-w / 2 - 0.12, -w / 2, y - 0.1, y + h + 0.1],
      [w / 2, w / 2 + 0.12, y - 0.1, y + h + 0.1],
      [-w / 2, w / 2, y - 0.1, y],
      [-w / 2, w / 2, y + h, y + h + 0.1],
    ])
      Q(o, c, [P(u, Y, 0.08), P(v, Y, 0.08), P(v, Z, 0.08), P(u, Z, 0.08)], s, col);
  if (c.frames) {
    for (const u of [-w / 2 - 0.08, w / 2 + 0.08])
      span(o, c, P(u, y - 0.14, 0.15), P(u, y + h + 0.14, 0.15), 0.16, 0.16, s, col);
    for (const Y of [y - 0.12, y + h + 0.12])
      span(o, c, P(-w / 2 - 0.22, Y, 0.17), P(w / 2 + 0.22, Y, 0.17), 0.22, 0.17, s, col);
    if (c.fine) {
      span(o, c, P(0, y, 0.1), P(0, y + h, 0.1), 0.065, 0.065, 'wood', C.wood);
      span(
        o,
        c,
        P(-w / 2, y + h * 0.55, 0.1),
        P(w / 2, y + h * 0.55, 0.1),
        0.065,
        0.065,
        'wood',
        C.wood,
      );
    } else {
      Q(
        o,
        c,
        [P(-0.035, y, 0.12), P(0.035, y, 0.12), P(0.035, y + h, 0.12), P(-0.035, y + h, 0.12)],
        'wood',
        C.wood,
      );
      Q(
        o,
        c,
        [
          P(-w / 2, y + h * 0.55 - 0.035, 0.12),
          P(w / 2, y + h * 0.55 - 0.035, 0.12),
          P(w / 2, y + h * 0.55 + 0.035, 0.12),
          P(-w / 2, y + h * 0.55 + 0.035, 0.12),
        ],
        'wood',
        C.wood,
      );
    }
    if (c.detail) {
      if (c.fine)
        for (let j = 1; j < 5; j++)
          span(
            o,
            c,
            P(-w / 2, y + (h * j) / 5, 0.12),
            P(w / 2, y + (h * j) / 5, 0.12),
            0.035,
            0.035,
            'wood',
            C.wood,
          );
      span(
        o,
        c,
        P(-w / 2 - 0.3, y + h + 0.4, 0.2),
        P(w / 2 + 0.3, y + h + 0.4, 0.2),
        0.25,
        0.18,
        s,
        col,
      );
    }
  }
}
function facade(o, c, A, Z, eave, { red = false, gate = false, bays } = {}) {
  // Retained facade controls run counterclockwise; face the glazing out of the masonry.
  [A, Z] = [Z, A];
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    l = Math.hypot(dx, dz),
    N = [-dz / l, dx / l],
    { P } = projector(A, Z, N);
  if (!c.far) {
    const n = bays ?? Math.max(2, Math.round(l / c.windowStep));
    for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) * l) / n,
        [gx, , gz] = P(u, 0),
        [gateU, gateV] = gateCoords([gx, gz]);
      for (const y of [2.7, 8.6, 14.5, 20.1]) {
        if (
          y + 2.7 > eave - 0.2 ||
          (gate && Math.abs(gateU) < 3 && gateV > -8 && gateV < 31 && y < 7)
        )
          continue;
        pane(o, c, (x, y, d) => P(u + x, y, d), y, Math.min(1.9, (l / n) * 0.6), 2.6, red);
      }
      if (c.detail && k < n - 1) {
        const t = ((k + 1) * l) / n;
        span(o, c, P(t, 1, 0.18), P(t, eave - 0.4, 0.18), 0.25, 0.25, 'stone', C.trim);
      }
    }
    for (const y of c.flat ? [7.4, eave - 0.3] : [1.6, 7.4, 13.3, 19.2, eave - 0.3]) {
      if (y > eave) continue;
      span(
        o,
        c,
        P(0, y, 0.11),
        P(l, y, 0.11),
        0.24,
        0.18,
        red ? 'red' : 'stone',
        red ? C.red : C.trim,
      );
    }
  }
}
function gable(o, c, A, Z, y, w = 4, h = 6, red = false) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    l = Math.hypot(dx, dz),
    N = [-dz / l, dx / l],
    { P } = projector(A, Z, N),
    s = red ? 'red' : 'stone',
    col = red ? C.red : C.trim;
  const stages = c.far
    ? [
        [0, w * 0.5],
        [h, 0.1],
      ]
    : [
        [0, w * 0.5],
        [h * 0.45, w * 0.5],
        [h * 0.45, w * 0.31],
        [h * 0.8, w * 0.31],
        [h * 0.8, w * 0.13],
        [h, w * 0.13],
      ];
  const outline = stages
      .map(([v, u]) => [-u, v])
      .concat(
        stages
          .slice()
          .reverse()
          .map(([v, u]) => [u, v]),
      ),
    front = outline.map(([u, v]) => P(l / 2 + u, y + v, 0.3));
  for (const back of [false, true]) {
    const p = back ? front.map((p) => [p[0] - N[0] * 0.7, p[1], p[2] - N[1] * 0.7]) : front;
    const ids = earcut(outline.flat(), [], 2);
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => p[j]),
        s,
        col,
        back ? [-N[0], 0, -N[1]] : [N[0], 0, N[1]],
      );
  }
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    Q(
      o,
      c,
      [
        front[i],
        front[j],
        [front[j][0] - N[0] * 0.7, front[j][1], front[j][2] - N[1] * 0.7],
        [front[i][0] - N[0] * 0.7, front[i][1], front[i][2] - N[1] * 0.7],
      ],
      s,
      col,
    );
  }
  if (!c.far)
    pane(
      o,
      c,
      (u, y, d) => P(l / 2 + u, y, d + 0.4),
      y + 0.5,
      Math.min(1.2, w * 0.35),
      Math.min(2.2, h * 0.4),
      red,
    );
  if (c.detail)
    for (let i = 0; i < front.length; i++) {
      const j = (i + 1) % front.length;
      span(o, c, front[i], front[j], 0.13, 0.13, 'stone', C.trim);
    }
}
function tower(o, c, t) {
  const { x, z, r, eave, top } = t,
    n = c.n,
    lo = schwerinGroundY(x, z) - 0.5,
    ring = (y, rad) => radialRing(y, rad, rad, n, [x, z]);
  L(o, c, [ring(lo, r), ring(eave, r)], 'wall', C.wall);
  if (!c.far)
    for (const y of c.flat ? [7.7, 19.5] : [2, 7.7, 13.6, 19.5, eave - 1]) {
      if (y >= eave) continue;
      if (!c.flat) L(o, c, [ring(y, r + 0.15), ring(y + 0.25, r + 0.15)], 'stone', C.trim);
      for (let j = 0; j < (c.flat ? 3 : 6); j++) {
        const v = (j * 2 * Math.PI) / (c.flat ? 3 : 6),
          N = [Math.sin(v), Math.cos(v)],
          P = (u, Y, d = 0) => [x + N[0] * (r + d) + N[1] * u, Y, z + N[1] * (r + d) - N[0] * u];
        if (y + 3.6 < eave) pane(o, c, P, y + 0.6, 1.25, 2.5);
      }
    }
  L(
    o,
    c,
    [ring(eave, r + 0.25), ring(eave + 0.6, r + 0.35), ring(eave + 0.85, r + 0.22)],
    'stone',
    C.trim,
  );
  const profile = c.far
    ? [
        [eave + 0.85, r + 0.25],
        [top - 2, 0.6],
        [top - 0.6, 0.45],
      ]
    : [
        [eave + 0.85, r + 0.35],
        [eave + 2, r * 0.92],
        [top - 6, r * 0.25],
        [top - 3, r * 0.13],
        [top - 2.4, r * 0.15],
        [top - 0.6, r * 0.075],
      ];
  L(
    o,
    c,
    profile.map(([y, r]) => ring(y, r)),
    'roof',
    C.roof,
  );
  L(o, c, [ring(top - 0.6, 0.2), ring(top + 0.5, 0.045)], 'metal', C.trim);
  if (c.detail) {
    const R = r * 0.36;
    for (let j = 0; j < 4; j++) {
      const v = (j * Math.PI) / 2,
        N = [Math.sin(v), Math.cos(v)],
        xx = x + N[0] * (r * 0.58),
        zz = z + N[1] * (r * 0.58);
      gable(
        o,
        c,
        [xx - N[1] * R, zz + N[0] * R],
        [xx + N[1] * R, zz - N[0] * R],
        eave + 1.2,
        R * 1.3,
        3,
      );
    }
  }
}
function goldDome(o, c) {
  const x = 22.65,
    z = -16.45,
    n = c.far ? 4 : Math.max(6, c.n),
    ring = (y, r) => radialRing(y, r, r, n, [x, z]);
  L(o, c, [ring(8.6, 6.3), ring(29.7, 6.3)], 'wall', C.wall);
  if (!c.far)
    for (let j = 0; j < 8; j++) {
      const v = (j * Math.PI) / 4,
        N = [Math.sin(v), Math.cos(v)],
        P = (u, y, d = 0) => [x + N[0] * (6.3 + d) + N[1] * u, y, z + N[1] * (6.3 + d) - N[0] * u];
      pane(o, c, P, 24, 1.5, 4);
    }
  L(o, c, [ring(29.7, 6.55), ring(30.5, 6.6), ring(31, 6)], 'stone', C.trim);
  const profile = [
    [31, 6],
    [32.5, 6.15],
    [35, 5.8],
    [38.2, 4.3],
    [40.6, 2.8],
    [42, 1.15],
  ];
  L(
    o,
    c,
    (c.far ? [profile[0], profile[3], profile[5]] : profile).map(([y, r]) => ring(y, r)),
    c.far ? 'metal' : 'roof',
    c.far ? C.gold : C.roof,
  );
  if (!c.far)
    for (let j = 0; j < (c.detail ? 12 : 6); j++) {
      const v = (j * 2 * Math.PI) / (c.detail ? 12 : 6);
      for (let k = 1; k < profile.length; k++) {
        const [y0, r0] = profile[k - 1],
          [y1, r1] = profile[k];
        span(
          o,
          c,
          [x + Math.sin(v) * (r0 + 0.08), y0, z + Math.cos(v) * (r0 + 0.08)],
          [x + Math.sin(v) * (r1 + 0.08), y1, z + Math.cos(v) * (r1 + 0.08)],
          0.14,
          0.14,
          'metal',
          C.gold,
        );
      }
    }
  if (!c.far) {
    for (const [y, r] of c.flat
      ? [[35, 5.88]]
      : [
          [32.5, 6.15],
          [35, 5.8],
          [38.2, 4.3],
          [40.6, 2.8],
        ])
      L(o, c, [ring(y - 0.08, r + 0.12), ring(y + 0.08, r + 0.12)], 'metal', C.gold);
  }
  L(o, c, [ring(42, 0.85), ring(44, 0.7), ring(44.5, 1)], 'metal', C.gold);
  // Original simplified figure/standard, no copied sculpture.
  L(o, c, [ring(44.5, 0.55), ring(46.1, 0.36), ring(47.1, 0.5)], 'metal', C.gold);
  if (!c.far)
    sphere(
      o,
      slot(c, 'metal'),
      [x, 47.6, z],
      [0.42, 0.5, 0.42],
      C.gold,
      c.fine ? 16 : 8,
      c.fine ? 8 : 4,
    );
  span(o, c, [x + 0.4, 46.8, z], [x + 1.1, 48.8, z], 0.12, 0.12, 'metal', C.gold);
}
function greenDome(o, c) {
  const x = -2.9,
    z = -31.5,
    n = c.n,
    ring = (y, r) => radialRing(y, r, r, n, [x, z]);
  L(o, c, [ring(29, 5), ring(31.5, 5)], 'wall', C.wall);
  L(
    o,
    c,
    [
      [31.5, 5.3],
      [33, 4.9],
      [34.5, 3.7],
      [35.4, 2.2],
      [36, 1],
    ].map(([y, r]) => ring(y, r)),
    'metal',
    C.green,
  );
  L(o, c, [ring(36, 0.7), ring(37, 0.2)], 'metal', C.gold);
}
function gate(o, c) {
  const P = schwerinGatePoint,
    n = c.arch * 2;
  for (let j = 0; j < n; j++) {
    const t = (j * Math.PI) / n,
      v = ((j + 1) * Math.PI) / n,
      u = -R * Math.cos(t),
      w = -R * Math.cos(v),
      y = spring + R * Math.sin(t),
      Y = spring + R * Math.sin(v);
    Q(o, c, [P(u, y, -1), P(w, Y, -1), P(w, Y, 27), P(u, y, 27)], 'stone', C.trim, [0, -1, 0]);
    if (!c.far)
      for (const d of [-1, 26])
        Q(
          o,
          c,
          [
            P(u, y, d),
            P(w, Y, d),
            P(-(R + 0.38) * Math.cos(v), spring + (R + 0.38) * Math.sin(v), d),
            P(-(R + 0.38) * Math.cos(t), spring + (R + 0.38) * Math.sin(t), d),
          ],
          'stone',
          C.trim,
        );
  }
  for (const u of [-R, R]) {
    const pp = P(u, 0, 10);
    Q(
      o,
      c,
      [
        P(u, schwerinGroundY(pp[0], pp[2]) + 0.12, -1),
        P(u, spring, -1),
        P(u, spring, 27),
        P(u, schwerinGroundY(pp[0], pp[2]) + 0.12, 27),
      ],
      'stone',
      C.trim,
    );
  }
  for (let k = 0; k < 7; k++) {
    const v = -1 + k * 4,
      w = v + 4,
      p0 = P(-R, 0, v),
      p1 = P(R, 0, v),
      p2 = P(R, 0, w),
      p3 = P(-R, 0, w);
    Q(
      o,
      c,
      [p0, p1, p2, p3].map(([x, , z]) => [x, schwerinGroundY(x, z) + 0.12, z]),
      'stone',
      C.shadow,
      [0, 1, 0],
    );
  }
  if (!c.far) {
    for (const u of [-3.9, 3.9]) {
      const p = P(u, 0, -0.8),
        floor = schwerinGroundY(p[0], p[2]);
      L(
        o,
        c,
        [
          radialRing(floor, 0.55, 0.55, c.n, [p[0], p[2]]),
          radialRing(7.2, 0.45, 0.45, c.n, [p[0], p[2]]),
        ],
        'stone',
        C.trim,
      );
      span(o, c, P(u - 0.7, 7.5, -1), P(u + 0.7, 7.5, -1), 1, 0.5);
    }
    // Principal portal pedestal and original low-detail equestrian silhouette.
    const p = P(0, 0, -1.3);
    B(o, c, [p[0] - 2, 9.4, p[2] - 1], [p[0] + 2, 10.2, p[2] + 1]);
    sphere(
      o,
      slot(c, 'metal'),
      [p[0], 11.2, p[2]],
      [1.5, 0.6, 0.45],
      C.shadow,
      c.n,
      Math.max(3, c.n / 2),
    );
    for (const dx of [-0.9, 0.9])
      for (const dz of [-0.25, 0.25])
        span(
          o,
          c,
          [p[0] + dx, 10.2, p[2] + dz],
          [p[0] + dx, 11.1, p[2] + dz],
          0.17,
          0.17,
          'metal',
          C.shadow,
        );
    sphere(
      o,
      slot(c, 'metal'),
      [p[0] + 1.4, 11.8, p[2]],
      [0.35, 0.7, 0.3],
      C.shadow,
      c.n,
      Math.max(3, c.n / 2),
    );
    span(o, c, [p[0] - 0.1, 11.7, p[2]], [p[0], 12.6, p[2]], 0.5, 0.4, 'metal', C.shadow);
  }
}
export function buildSchwerinLevel(o, level = 'master') {
  const c = config[level];
  if (!c) throw Error('Unknown Schwerin tier ' + level);
  const outer = cw(c.far ? a.farOutline : a.outline),
    inner = cw(c.far ? a.farCourt : a.court).reverse();
  for (const r of [outer, inner])
    for (let i = 0; i < r.length; i++) wall(o, c, r[i], r[(i + 1) % r.length], 17, { gate: true });
  cap(o, c, [outer, inner], 17); // Real courtyard hole; never a filled parent footprint.
  for (const w of a.wings) {
    shell(o, c, w.ring, w.eave, w.id === 'entrance' ? 17 : null);
    hip(o, c, w.ring, w.eave, w.roof, w.inset);
  }
  // Mapped lower northeastern chapel/bay has its own stepped roof.
  const chapel = a.chapel;
  shell(o, c, chapel, 18, 17);
  hip(o, c, chapel, 18, 24, 3);
  for (const t of a.towers) {
    if (t.small && (c.far || c.flat)) continue;
    tower(o, c, t);
  }
  goldDome(o, c);
  greenDome(o, c);
  gate(o, c);
  if (!c.far) {
    for (const e of a.facades) facade(o, c, e.A, e.Z, e.eave, e);
    for (const x of [-17, 12]) gable(o, c, [x + 4, -40.25], [x - 4, -40.25], 25.2, 7.4, 8.2);
    for (const w of a.wings) {
      if (c.flat && !w.red && w.id !== 'west') continue;
      const p = cw(w.ring);
      for (let i = 0; i < p.length; i++) {
        const A = p[i],
          Z = p[(i + 1) % p.length],
          l = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
        if (l < 15) continue;
        const count = Math.min(c.gables, Math.max(1, Math.floor(l / 11)));
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count,
            dx = (Z[0] - A[0]) / l,
            dz = (Z[1] - A[1]) / l,
            x = A[0] + (Z[0] - A[0]) * t,
            z = A[1] + (Z[1] - A[1]) * t;
          gable(
            o,
            c,
            [x - dx * 2.2, z - dz * 2.2],
            [x + dx * 2.2, z + dz * 2.2],
            w.eave + 0.1,
            4.3,
            c.flat ? 3.4 : 5.4,
            w.red,
          );
        }
      }
    }
    const chimneyStations = [
      [-16, -32],
      [10, -32],
      [-32, -10],
      [-25, 18],
      [12, 34],
      [34, 17],
      [34, -4],
    ];
    for (const [x, z] of chimneyStations) {
      B(o, c, [x - 0.5, 28, z - 0.55], [x + 0.5, 35, z + 0.55], 'stone', C.trim);
      B(o, c, [x - 0.7, 34.6, z - 0.75], [x + 0.7, 35.2, z + 0.75], 'stone', C.trim);
      if (c.detail)
        for (const dx of [-0.25, 0.25])
          B(
            o,
            c,
            [x + dx - 0.13, 35.2, z - 0.15],
            [x + dx + 0.13, 35.8, z + 0.15],
            'metal',
            C.shadow,
          );
    }
    // Courtyard terracotta belt courses,closed glazing and a short side stair.
    for (const e of a.courtFacades) facade(o, c, e.A, e.Z, e.eave, { red: true, gate: true });
    Q(
      o,
      c,
      [
        [33.9, 0.7, 42.55],
        [35.1, 0.7, 42.55],
        [35.1, 4.2, 42.55],
        [33.9, 4.2, 42.55],
      ],
      'wood',
      C.wood,
      [0, 0, 1],
    );
    if (c.detail) {
      for (let j = 0; j < 7; j++)
        B(
          o,
          c,
          [-13 - j * 0.18, j * 0.2, 11 + j * 0.4],
          [-8 + j * 0.18, (j + 1) * 0.2, 11 + (j + 1) * 0.4],
          'stone',
          C.trim,
        );
    }
  }
}
export const buildSchwerinSkyline = (o) => buildSchwerinLevel(o, 'skyline');
export const buildSchwerinDistrict = (o) => buildSchwerinLevel(o, 'district');
export const buildSchwerinStreet = (o) => buildSchwerinLevel(o, 'street');
export const buildSchwerinCloseup = (o) => buildSchwerinLevel(o, 'closeup');

/** Original KK100 exterior. Meters,+X east,+Z south. No downloaded mesh orprivate images. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  glass: lin('7198aa'),
  silver: lin('c4ccd0'),
  trim: lin('dde0dc'),
  dark: lin('50585e'),
  ground: lin('aaa69c'),
  water: lin('345a68'),
  roof: lin('aeb4b6'),
};
export const kingkeySurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.24, metallic: 0.18 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.52, metallic: 0.35 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.89, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.91, metallic: 0 },
};
export const kingkeyControls = a;
export function kingkeyGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
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
export function kingkeyProfile(y) {
  const i = Math.max(
      1,
      a.profile.findIndex((p) => p[0] >= y - 1e-8),
    ),
    p = a.profile[i - 1],
    q = a.profile[i],
    t = Math.max(0, Math.min(1, (y - p[0]) / (q[0] - p[0])));
  return p.map((v, k) => (k === 0 ? y : v + (q[k] - v) * t));
}
const config = {
  skyline: { far: true, rows: 10, cols: 1, arch: 6 },
  district: { rows: 14, cols: 5, arch: 10, fins: 3 },
  street: { rows: 42, cols: 12, arch: 12, fins: 7, entry: true, lattice: 3 },
  closeup: { rows: 104, cols: 24, arch: 28, fins: 24, entry: true, lattice: 9, plant: true },
  master: {
    rows: 104,
    cols: 40,
    arch: 48,
    fins: 40,
    entry: true,
    lattice: 20,
    plant: true,
    reveals: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s);
function patch(o, s, ps, color, n, uv) {
  for (const ids of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    let p = ids.map((i) => ps[i].map(Math.fround)),
      t = uv ? ids.map((i) => uv[i]) : p.map((v) => [v[0] + v[2], v[1]]);
    const A = p[1].map((v, i) => v - p[0][i]),
      B = p[2].map((v, i) => v - p[0][i]);
    if (
      Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
      1e-7
    )
      continue;
    if (n && normalFor(...p).reduce((v, k, i) => v + k * n[i], 0) < 0) {
      p = p.toReversed();
      t = t.toReversed();
    }
    o.addTriangle(s, uv ? 'metric:uv' : 'palette:#ffffff', p, normalFor(...p), t, color);
  }
}
function B(o, c, p, q, w, color = C.silver, d = w) {
  if (Math.hypot(...p.map((v, i) => v - q[i])) > 0.001) beam(o, S(c, 'metal'), p, q, w, d, color);
}
export const kingkeyArch = (x, t = 0) => {
  const e = a.entrance,
    u = Math.max(-1, Math.min(1, x / e.halfWidth)),
    v = Math.cos((u * Math.PI) / 2);
  return [
    x,
    e.springY + (e.backRise + (e.frontRise - e.backRise) * t) * v,
    e.backZ + e.projection * v * t,
  ];
};
// Four faces are parameterized independently so the physical south entry stays open.
export function kingkeyFacade(face, u, y, offset = 0) {
  const [, w, f, b] = kingkeyProfile(y);
  switch (face) {
    case 0:
      return [(2 * u - 1) * w, y, f + offset];
    case 1:
      return [w + offset, y, f + (b - f) * u];
    case 2:
      return [(1 - 2 * u) * w, y, b - offset];
    default:
      return [-w - offset, y, b + (f - b) * u];
  }
}
const normals = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 0, -1],
  [-1, 0, 0],
];
function facade(o, c) {
  const ys = [
    ...new Set([
      0,
      44,
      441.8,
      ...a.profile.map((p) => p[0]),
      ...a.mechanicalBands.flat(),
      ...Array.from(
        { length: c.rows + 1 },
        (_, i) => Math.round(((i * 441.8) / c.rows) * 1e6) / 1e6,
      ),
    ]),
  ].sort((x, y) => x - y);
  for (let f = 0; f < 4; f++)
    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j],
        y1 = ys[j + 1],
        mid = (y0 + y1) / 2,
        band = a.mechanicalBands.some(([p, q]) => mid > p && mid < q),
        slot = band ? 'metal' : 'glass';
      for (let k = 0; k < c.cols; k++) {
        const u0 = k / c.cols,
          u1 = (k + 1) / c.cols,
          p0 = kingkeyFacade(f, u0, y0),
          p1 = kingkeyFacade(f, u1, y0),
          q0 = kingkeyFacade(f, u0, y1),
          q1 = kingkeyFacade(f, u1, y1);
        if (f === 0) {
          const e0 = kingkeyArch(p0[0])[1],
            e1 = kingkeyArch(p1[0])[1];
          if (y1 <= Math.min(e0, e1)) continue;
          p0[1] = Math.max(y0, e0);
          p1[1] = Math.max(y0, e1);
          if (p0[1] >= y1) p0[1] = y1 - 0.002;
          if (p1[1] >= y1) p1[1] = y1 - 0.002;
        }
        const n = normals[f],
          color = band ? C.dark : C.glass,
          width = f % 2 === 0 ? 58.9 : 47.7;
        if (c.reveals && !band && y0 > 45 && y1 - y0 > 1) {
          const ins = 0.05,
            p = [p0, p1, q1, q0].map((v) => v.map((x, i) => x - n[i] * ins));
          patch(o, S(c, slot), p, color, n, [
            [u0 * width, y0 / 3.8],
            [u1 * width, y0 / 3.8],
            [u1 * width, y1 / 3.8],
            [u0 * width, y1 / 3.8],
          ]);
          const edge = [p0, p1, q1, q0];
          for (let k = 0; k < 4; k++)
            patch(o, 'metal', [edge[k], edge[(k + 1) % 4], p[(k + 1) % 4], p[k]], C.silver);
        } else
          patch(o, S(c, slot), [p0, p1, q1, q0], color, n, [
            [u0 * width, y0 / 3.8],
            [u1 * width, y0 / 3.8],
            [u1 * width, y1 / 3.8],
            [u0 * width, y1 / 3.8],
          ]);
      }
      if (!c.far && mid > 45 && y1 - y0 > 1 && c.rows > 25) {
        const p = kingkeyFacade(f, 0, y1, 0.035),
          q = kingkeyFacade(f, 1, y1, 0.035);
        B(o, c, p, q, 0.11, C.silver, 0.16);
      }
    }
  if (c.fins)
    for (let f = 0; f < 4; f++)
      for (let k = 0; k <= c.fins; k++) {
        const u = k / c.fins;
        for (let j = 0; j < a.profile.length - 1; j++) {
          let y0 = a.profile[j][0],
            y1 = a.profile[j + 1][0];
          if (f === 0) y0 = Math.max(y0, kingkeyArch((2 * u - 1) * 29.443)[1]);
          if (y0 >= y1) continue;
          B(
            o,
            c,
            kingkeyFacade(f, u, y0, 0.18),
            kingkeyFacade(f, u, y1, 0.18),
            k === 0 || k === c.fins ? 0.45 : 0.2,
            C.trim,
            0.4,
          );
        }
      }
  // Thin but closed high ridge;roof covers the entire bowed crown profile.
  const top = a.profile.at(-1),
    w = top[1],
    y = top[0];
  patch(
    o,
    S(c, 'roof'),
    [
      [-w, y, top[3]],
      [-w, y, top[2]],
      [w, y, top[2]],
      [w, y, top[3]],
    ],
    C.roof,
    [0, 1, 0],
  );
  if (!c.far)
    for (const side of [0, 1, 2, 3])
      B(o, c, kingkeyFacade(side, 0, 432, 0.2), kingkeyFacade(side, 1, 432, 0.2), 0.28, C.silver);
  if (c.plant)
    for (const x of [-18, 14]) {
      box(o, 'roof', [x - 2.4, 439.8, -8.9], [x + 2.4, 441.8, -7.3], C.roof);
      B(o, c, [x - 3.2, 441.6, -8], [x + 3.2, 441.6, -8], 0.25, C.silver);
      B(o, c, [x, 441.5, -8], [x, 442, -8], 0.18, C.silver);
    }
}
function foundation(o, c) {
  const r = [
      [-29.443, -28.559],
      [-29.443, 19.12],
      [29.443, 19.12],
      [29.443, -28.559],
    ],
    top = r.map(([x, z]) => [x, 0.3, z]),
    bottom = r.map(([x, z]) => [x, Math.min(-0.8, kingkeyGroundY(x, z) - 0.6), z]);
  loft(o, S(c, 'ground'), [bottom, top], C.ground);
  // Landing is separate from the hood;its outer edge follows the native field.
  const N = c.arch,
    back = [],
    front = [];
  for (let i = 0; i <= N; i++) {
    const x = -29.443 + (58.886 * i) / N,
      v = Math.cos(((x / 29.443) * Math.PI) / 2);
    back.push([x, 0.3, 15]);
    front.push([x, 0.3, 19.12 + 9.439 * v]);
  }
  for (let i = 0; i < N; i++)
    patch(o, S(c, 'ground'), [back[i], back[i + 1], front[i + 1], front[i]], C.ground, [0, 1, 0]);
  for (let i = 0; i < N; i++) {
    const p = front[i],
      q = front[i + 1],
      p0 = [p[0], kingkeyGroundY(p[0], p[2]) - 0.5, p[2]],
      q0 = [q[0], kingkeyGroundY(q[0], q[2]) - 0.5, q[2]];
    patch(o, S(c, 'ground'), [p0, q0, q, p], C.ground, [0, 0, 1]);
  }
}
function entrance(o, c) {
  const e = a.entrance,
    N = c.arch,
    point = (u, t) => kingkeyArch(-e.halfWidth + 2 * e.halfWidth * u, t);
  for (let i = 0; i < N; i++) {
    const p = point(i / N, 0),
      q = point((i + 1) / N, 0),
      r = point((i + 1) / N, 1),
      s = point(i / N, 1);
    patch(o, S(c, 'glass'), [p, q, r, s], C.glass, [0, 1, 0]);
    if (!c.far) {
      const low = [s, r].map((p) => [p[0], p[1] - 0.85, p[2] + 0.05]);
      patch(o, 'metal', [s, r, low[1], low[0]], C.trim, [0, 0, 1]);
      patch(
        o,
        'metal',
        [p, q, ...[q, p].map((p) => [p[0], p[1] - 0.32, p[2]])],
        C.trim,
        [0, 0, -1],
      );
    }
  }
  if (!c.far) {
    for (let i = 0; i <= N; i++) B(o, c, point(i / N, 0), point(i / N, 1), 0.18, C.silver, 0.28);
    for (const t of [0, 1])
      for (let i = 0; i < N; i++)
        B(o, c, point(i / N, t), point((i + 1) / N, t), t === 1 ? 0.5 : 0.23, C.trim);
  }
  if (c.lattice) {
    const L = c.lattice;
    for (let j = 0; j < L; j++)
      for (let i = 0; i < N; i++) {
        const t0 = j / L,
          t1 = (j + 1) / L,
          u0 = i / N,
          u1 = (i + 1) / N;
        B(
          o,
          c,
          point(u0, t0).map((v, k) => (k === 1 ? v - 0.2 : v)),
          point(u1, t1).map((v, k) => (k === 1 ? v - 0.2 : v)),
          0.09,
          C.dark,
        );
        B(
          o,
          c,
          point(u1, t0).map((v, k) => (k === 1 ? v - 0.2 : v)),
          point(u0, t1).map((v, k) => (k === 1 ? v - 0.2 : v)),
          0.09,
          C.dark,
        );
      }
    for (let j = 1; j < L * 2; j++)
      for (let i = 0; i < N; i++)
        B(o, c, point(i / N, j / (L * 2)), point((i + 1) / N, j / (L * 2)), 0.055, C.silver);
  }
  // Physical recessed lobby atz15;the main south skin has no plane across its mouth.
  const zs = (x) => e.lobbyZ + 2.3 * Math.cos(((x / e.halfWidth) * Math.PI) / 2),
    door = (x) => e.doorCenters.some((v) => x > v - e.doorHalfWidth && x < v + e.doorHalfWidth);
  const breaks = [
    -e.halfWidth,
    e.halfWidth,
    ...e.doorCenters.flatMap((x) => [x - e.doorHalfWidth, x + e.doorHalfWidth]),
    ...Array.from({ length: N + 1 }, (_, i) => -e.halfWidth + (2 * e.halfWidth * i) / N),
  ]
    .sort((x, y) => x - y)
    .filter((x, i, b) => !i || x - b[i - 1] > 1e-6);
  for (let i = 0; i < breaks.length - 1; i++) {
    const x = breaks[i],
      X = breaks[i + 1],
      top = (z) => Math.max(3, kingkeyArch(z, 0)[1] - 0.2),
      d = c.entry && door((x + X) / 2),
      base = d ? e.doorTop : e.landingY;
    patch(
      o,
      S(c, 'glass'),
      [
        [x, base, zs(x)],
        [X, base, zs(X)],
        [X, top(X), zs(X)],
        [x, top(x), zs(x)],
      ],
      C.glass,
      [0, 0, 1],
    );
    if (!c.far) B(o, c, [x, base, zs(x) + 0.1], [x, top(x), zs(x) + 0.1], 0.11, C.silver);
  }
  if (c.entry)
    for (const x of e.doorCenters) {
      const z = zs(x),
        w = e.doorHalfWidth,
        back = z - 1.8;
      patch(
        o,
        'metal',
        [
          [x - w, 0.3, back],
          [x + w, 0.3, back],
          [x + w, e.doorTop, back],
          [x - w, e.doorTop, back],
        ],
        C.dark,
        [0, 0, 1],
      );
      for (const xx of [x - w, x + w]) {
        patch(
          o,
          'metal',
          [
            [xx, 0.3, z],
            [xx, 0.3, back],
            [xx, e.doorTop, back],
            [xx, e.doorTop, z],
          ],
          C.silver,
          xx < x ? [1, 0, 0] : [-1, 0, 0],
        );
        B(o, c, [xx, 0.3, z + 0.05], [xx, e.doorTop, z + 0.05], 0.24, C.dark);
      }
      patch(
        o,
        'metal',
        [
          [x - w, e.doorTop, z],
          [x + w, e.doorTop, z],
          [x + w, e.doorTop, back],
          [x - w, e.doorTop, back],
        ],
        C.dark,
        [0, -1, 0],
      );
      B(o, c, [x - w, e.doorTop, z], [x + w, e.doorTop, z], 0.28, C.dark);
      const R = c.reveals ? 20 : 12;
      loft(
        o,
        'metal',
        [
          radialRing(0.35, 1.55, 1.55, R, [x, z - 0.35]),
          radialRing(0.48, 1.55, 1.55, R, [x, z - 0.35]),
        ],
        C.silver,
      );
      loft(
        o,
        'metal',
        [
          radialRing(4.8, 1.55, 1.55, R, [x, z - 0.35]),
          radialRing(5, 1.55, 1.55, R, [x, z - 0.35]),
        ],
        C.silver,
      );
      for (let j = 0; j < 3; j++) {
        const t = (j * Math.PI * 2) / 3,
          p = [x + Math.cos(t) * 1.4, 0.48, z - 0.35 + Math.sin(t) * 1.4],
          q = [p[0], 4.8, p[2]];
        B(o, c, p, q, 0.075, C.silver);
        patch(o, 'glass', [[x, 0.48, z - 0.35], p, q, [x, 4.8, z - 0.35]], C.glass);
        patch(o, 'glass', [[x, 4.8, z - 0.35], q, p, [x, 0.48, z - 0.35]], C.glass);
      }
      B(o, c, [x, 0.48, z - 0.35], [x, 4.8, z - 0.35], 0.1, C.silver);
    }
}
function pool(o, c) {
  const p = a.pool,
    [x, z] = p.center,
    N = c.far ? 12 : c.entry ? 48 : 20;
  loft(
    o,
    S(c, 'ground'),
    [
      radialRing(
        Math.min(-1, kingkeyGroundY(x, z) - 0.6),
        p.radius + 0.4,
        p.radius + 0.4,
        N,
        p.center,
      ),
      radialRing(p.rimY, p.radius + 0.4, p.radius + 0.4, N, p.center),
    ],
    C.ground,
    { cap: false },
  );
  const outer = radialRing(p.rimY, p.radius + 0.4, p.radius + 0.4, N, p.center),
    inner = radialRing(p.rimY, p.radius, p.radius, N, p.center);
  for (let i = 0; i < N; i++)
    patch(
      o,
      S(c, 'ground'),
      [outer[i], inner[i], inner[(i + 1) % N], outer[(i + 1) % N]],
      C.ground,
      [0, 1, 0],
    );
  const water = radialRing(p.waterY, p.radius, p.radius, N, p.center);
  o.addConvexPolygon(
    S(c, 'metal'),
    'palette:#ffffff',
    water,
    [0, 1, 0],
    (p) => [p[0] / 4, p[2] / 4],
    C.water,
  );
  if (c.entry)
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++)
        if (i * i + j * j < 13)
          loft(
            o,
            'metal',
            [
              radialRing(p.waterY, 0.15, 0.15, 6, [x + i * 4, z + j * 4]),
              radialRing(0.01, 0.15, 0.15, 6, [x + i * 4, z + j * 4]),
            ],
            C.silver,
          );
}
export function buildKingkeyLevel(o, level = 'master') {
  const c = config[level];
  if (!c) throw Error('Unknown Kingkey level:' + level);
  foundation(o, c);
  facade(o, c);
  entrance(o, c);
  pool(o, c);
}
export const buildKingkeySkyline = (o) => buildKingkeyLevel(o, 'skyline'),
  buildKingkeyDistrict = (o) => buildKingkeyLevel(o, 'district'),
  buildKingkeyStreet = (o) => buildKingkeyLevel(o, 'street'),
  buildKingkeyCloseup = (o) => buildKingkeyLevel(o, 'closeup');

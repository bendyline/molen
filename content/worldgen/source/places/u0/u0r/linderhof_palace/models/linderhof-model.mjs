/** Original Linderhof exterior. Meters,+Y up,+X south entrance,+Z west. */
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
export const linderhofControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = linderhofControls,
  H = a.geometryControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('eeede7'),
    stone: lin('e6e3d8'),
    roof: lin('4e5f6d'),
    gold: lin('bd9d4e'),
    glass: lin('adb9ba'),
    door: lin('292e31'),
    niche: lin('b9b6aa'),
    seam: lin('78848a'),
  };
export const linderhofSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.85, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  gold: { slot: 'trim', graph: 'metal_copper', roughness: 0.47, metallic: 0.65 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.06 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.85, metallic: 0 },
};
const configs = {
  skyline: { far: true, sides: 4, round: 1, arch: 2 },
  district: { sides: 4, round: 1, arch: 3, flat: true },
  street: { sides: 8, round: 4, arch: 6, frames: true },
  closeup: { sides: 16, round: 8, arch: 12, frames: true, detail: true },
  master: { sides: 32, round: 16, arch: 24, frames: true, detail: true, fine: true },
};
export function linderhofGroundY(x, z) {
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
  clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((t, p, i) => {
      const q = r[(i + 1) % r.length];
      return t + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
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
function L(o, c, r, s = 'stone', color = C.stone, cap = true) {
  loft(o, S(c, s), r, color, { cap });
}
function span(o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.stone) {
  beam(o, S(c, s), A, Z, w, d, color);
}
const plane = (x, z, N) => {
  const T = [N[1], -N[0]];
  return (u, y, d = 0) => [x + T[0] * u + N[0] * d, y, z + T[1] * u + N[1] * d];
};
function face(o, c, P, r, s = 'stone', color = C.stone, thick = 0) {
  const f = r.flat(),
    ids = earcut(f, [], 2),
    n = normalFor(P(0, 0), P(1, 0), P(1, 1));
  for (let k = 0; k < ids.length; k += 3) {
    let ps = ids.slice(k, k + 3).map((i) => P(...r[i]));
    const v = normalFor(...ps);
    if (v.reduce((t, v, i) => t + v * n[i], 0) < 0) ps.reverse();
    o.addTriangle(
      S(c, s),
      'palette:#ffffff',
      ps,
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color,
    );
  }
  if (thick)
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        Z = r[(i + 1) % r.length];
      Q(o, c, [P(...A), P(...Z), P(...Z, -thick), P(...A, -thick)], s, color);
    }
}
function floor(o, c, r, y, s = 'wall', color = C.wall) {
  const p = clean(r),
    ids = earcut(p.flat(), [], 2);
  for (let k = 0; k < ids.length; k += 3) {
    let ps = ids.slice(k, k + 3).map((i) => [p[i][0], y, p[i][1]]);
    if (normalFor(...ps)[1] < 0) ps.reverse();
    o.addTriangle(
      S(c, s),
      'palette:#ffffff',
      ps,
      [0, 1, 0],
      ps.map((p) => [p[0], p[2]]),
      color,
    );
  }
}
const ring = (r, y, scale = 1) => cw(r).map(([x, z]) => [x * scale, y, z * scale]);
function wall(o, c, A, Z, base, top, gates = []) {
  const P = (t, y) => [A[0] + (Z[0] - A[0]) * t, y, A[1] + (Z[1] - A[1]) * t],
    dz = Z[1] - A[1],
    cuts = [0, 1];
  for (const v of gates)
    for (let i = 0; i <= c.arch * 2; i++) {
      const z = v.z - v.r * Math.cos((i / (c.arch * 2)) * Math.PI),
        t = (z - A[1]) / dz;
      if (t > 0 && t < 1) cuts.push(t);
    }
  cuts.sort((a, b) => a - b);
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i - 1],
      hi = cuts[i],
      mid = P((lo + hi) / 2, 0)[2],
      v = gates.find((v) => Math.abs(mid - v.z) < v.r);
    // Arch endpoints must use the actual circular opening,not the surrounding base.
    const y = (t) =>
      v ? v.spring + v.r * Math.sqrt(Math.max(0, 1 - Math.pow((P(t, 0)[2] - v.z) / v.r, 2))) : base;
    Q(o, c, [P(lo, y(lo)), P(hi, y(hi)), P(hi, top), P(lo, top)]);
  }
}
function shell(o, c) {
  const r = cw(a.outline);
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      Z = r[(i + 1) % r.length],
      bottom = Math.min(
        H.floor - 0.35,
        linderhofGroundY(...A) - 0.35,
        linderhofGroundY(...Z) - 0.35,
      );
    wall(o, c, A, Z, bottom, H.floor);
    const gates =
      Math.min(A[0], Z[0]) > 14.8
        ? H.frontDoorCenters.map((z) => ({ z, r: 0.92, spring: H.floor + 1.75 }))
        : [];
    wall(o, c, A, Z, H.floor, H.cornice, gates);
  }
  floor(o, c, r, H.floor, 'stone', C.stone);
  floor(o, c, r, H.lowerTop);
  floor(o, c, r, H.cornice);
  for (const y of [H.lowerTop - 0.14, H.cornice - 0.25]) {
    L(o, c, [ring(r, y, 1.012), ring(r, y + 0.26, 1.012)], 'stone', C.stone, false);
    floor(
      o,
      c,
      r.map((p) => p.map((v) => v * 1.012)),
      y + 0.26,
      'stone',
      C.stone,
    );
  }
  if (c.detail)
    for (let y = H.floor + 0.42; y < H.lowerTop - 0.2; y += 0.42)
      L(o, c, [ring(r, y, 1.0015), ring(r, y + 0.025, 1.0015)], 'stone', C.stone, false);
}
function arch(o, c, P, u, base, w, h, s = 'glass', color = C.glass) {
  const r = w / 2,
    spring = base + h - r,
    outline = [
      [u - r, base],
      [u + r, base],
      [u + r, spring],
    ];
  for (let i = 1; i <= c.arch; i++) {
    const t = (i / c.arch) * Math.PI;
    outline.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  face(o, c, P, outline, s, color);
  if (c.frames) {
    for (const v of [-1, 1])
      span(o, c, P(u + v * r, base, 0.04), P(u + v * r, spring, 0.04), 0.14, 0.14);
    for (let i = 0; i < c.arch; i++) {
      const t = (i / c.arch) * Math.PI,
        T = ((i + 1) / c.arch) * Math.PI;
      Q(
        o,
        c,
        [
          P(u + (r + 0.13) * Math.cos(t), spring + (r + 0.13) * Math.sin(t), 0.04),
          P(u + (r + 0.13) * Math.cos(T), spring + (r + 0.13) * Math.sin(T), 0.04),
          P(u + r * Math.cos(T), spring + r * Math.sin(T), 0.04),
          P(u + r * Math.cos(t), spring + r * Math.sin(t), 0.04),
        ],
        'stone',
        C.stone,
      );
    }
    span(o, c, P(u - r - 0.15, base - 0.08, 0.05), P(u + r + 0.15, base - 0.08, 0.05), 0.2, 0.2);
  }
}
function window(o, c, P, u, base, w, h, round = false) {
  if (round) arch(o, c, P, u, base, w, h);
  else {
    face(
      o,
      c,
      P,
      [
        [u - w / 2, base],
        [u + w / 2, base],
        [u + w / 2, base + h],
        [u - w / 2, base + h],
      ],
      'glass',
      C.glass,
    );
    if (c.frames)
      for (const [A, Z] of [
        [
          [u - w / 2, base],
          [u - w / 2, base + h],
        ],
        [
          [u + w / 2, base],
          [u + w / 2, base + h],
        ],
        [
          [u - w / 2, base],
          [u + w / 2, base],
        ],
        [
          [u - w / 2, base + h],
          [u + w / 2, base + h],
        ],
      ])
        span(o, c, P(...A, 0.05), P(...Z, 0.05), 0.14, 0.14);
  }
  if (c.frames) {
    span(o, c, P(u, base, 0.07), P(u, base + h, 0.07), 0.055, 0.055);
    for (let y = base + h / 3; y < base + h - 0.1; y += h / 3)
      span(o, c, P(u - w / 2, y, 0.07), P(u + w / 2, y, 0.07), 0.05, 0.05);
  }
}
function column(o, c, x, z, base, top, r = 0.26) {
  const profile = c.flat
    ? [
        [base, r * 1.1],
        [base + 0.15, r],
        [top - 0.2, r],
        [top, r * 1.2],
      ]
    : [
        [base, r * 1.5],
        [base + 0.15, r * 1.5],
        [base + 0.24, r],
        [top - 0.42, r * 0.85],
        [top - 0.28, r * 1.25],
        [top - 0.15, r * 1.45],
        [top, r * 1.45],
      ];
  L(
    o,
    c,
    profile.map(([y, R]) => radialRing(y, R, R, c.sides, [x, z])),
  );
  if (c.fine)
    for (let y = base + 0.6; y < top - 0.5; y += 0.6)
      L(
        o,
        c,
        [
          [y, r * 1.05],
          [y + 0.08, r * 1.05],
        ].map(([y, R]) => radialRing(y, R, R, c.sides, [x, z])),
      );
}
function oval(o, c, P, u, y, rx, ry, glass = true) {
  const n = c.far ? 4 : c.flat ? 8 : c.sides,
    outline = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    outline.push([u + rx * Math.cos(t), y + ry * Math.sin(t)]);
  }
  // These are closed facade panels. Separate them from the attic/gable backing
  // by a real depth so they cannot flicker against a coplanar wall.
  face(
    o,
    c,
    (u, y, d = 0) => P(u, y, d + 0.025),
    outline,
    glass ? 'glass' : 'wall',
    glass ? C.glass : C.niche,
  );
  if (c.frames)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        T = ((i + 1) / n) * Math.PI * 2;
      Q(
        o,
        c,
        [
          P(u + (rx + 0.1) * Math.cos(t), y + (ry + 0.1) * Math.sin(t), 0.04),
          P(u + (rx + 0.1) * Math.cos(T), y + (ry + 0.1) * Math.sin(T), 0.04),
          P(u + rx * Math.cos(T), y + ry * Math.sin(T), 0.04),
          P(u + rx * Math.cos(t), y + ry * Math.sin(t), 0.04),
        ],
        'stone',
        C.stone,
      );
    }
}
function figure(o, c, x, z, base, h = 1.6, atlas = false) {
  const n = c.flat ? 4 : c.sides;
  if (atlas && c.frames) {
    // Original crouching carrier: bent legs,leaning torso,raised arms and a globe.
    // The small source sculpture is a silhouette cue,not a historical statue replica.
    L(o, c, [
      radialRing(base + 0.65, 0.22, 0.24, n, [x, z]),
      radialRing(base + 0.95, 0.25, 0.25, n, [x + 0.08, z]),
      radialRing(base + 1.32, 0.22, 0.36, n, [x + 0.2, z]),
      radialRing(base + 1.52, 0.11, 0.13, n, [x + 0.22, z]),
    ]);
    sphere(
      o,
      S(c, 'stone'),
      [x + 0.24, base + 1.72, z],
      [0.16, 0.2, 0.16],
      C.stone,
      n,
      Math.max(4, n / 2),
    );
    for (const sign of [-1, 1]) {
      span(
        o,
        c,
        [x, base + 0.75, z + sign * 0.18],
        [x + 0.36, base + 0.39, z + sign * 0.32],
        0.22,
        0.22,
      );
      span(
        o,
        c,
        [x + 0.36, base + 0.39, z + sign * 0.32],
        [x - 0.15, base + 0.08, z + sign * 0.3],
        0.16,
        0.16,
      );
      span(
        o,
        c,
        [x + 0.2, base + 1.3, z + sign * 0.34],
        [x + 0.17, base + 1.72, z + sign * 0.62],
        0.13,
        0.15,
      );
      span(
        o,
        c,
        [x + 0.17, base + 1.72, z + sign * 0.62],
        [x + 0.09, base + 2.1, z + sign * 0.48],
        0.1,
        0.12,
      );
    }
    sphere(
      o,
      S(c, 'stone'),
      [x, base + h - 0.62, z],
      [0.62, 0.62, 0.62],
      C.stone,
      n,
      Math.max(4, n / 2),
    );
    return;
  }
  if (c.far) {
    L(
      o,
      c,
      [
        [base, 0.16],
        [base + h * 0.65, 0.22],
        [base + h * 0.8, 0.1],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    );
    if (atlas) sphere(o, S(c, 'stone'), [x, base + h - 0.62, z], [0.62, 0.62, 0.62], C.stone, 6, 3);
    return;
  }
  const body = [
      [0, 0.21],
      [0.1, 0.28],
      [0.33, 0.2],
      [0.52, 0.24],
      [0.66, 0.16],
      [0.75, 0.12],
    ],
    scale = h / (atlas ? 3.1 : 1.6);
  L(
    o,
    c,
    body.map(([t, r]) => radialRing(base + t * h, r * scale, r * 0.7 * scale, n, [x, z])),
  );
  sphere(
    o,
    S(c, 'stone'),
    [x, base + h * 0.82, z],
    [0.14 * scale, 0.18 * scale, 0.14 * scale],
    C.stone,
    n,
    Math.max(4, n / 2),
  );
  for (const sign of [-1, 1]) {
    const A = [x + sign * 0.17 * scale, base + h * 0.63, z],
      mid = [x + sign * 0.37 * scale, base + h * (atlas ? 0.84 : 0.46), z + 0.02],
      end = [x + sign * 0.29 * scale, base + h * (atlas ? 0.96 : 0.32), z + 0.06];
    span(o, c, A, mid, 0.11 * scale, 0.14 * scale);
    span(o, c, mid, end, 0.09 * scale, 0.11 * scale);
  }
  if (atlas) {
    const r = 0.62;
    sphere(o, S(c, 'stone'), [x, base + h - r, z], [r, r, r], C.stone, n, Math.max(4, n / 2));
  }
}
function niche(o, c, P, u, base, h = 2) {
  arch(o, c, P, u, base, 1, h, 'wall', C.niche);
  if (c.detail) {
    const p = P(u, base, 0.2);
    figure(o, c, p[0], p[2], base + 0.12, 1.55);
  }
}
function balcony(o, c, P, u, base, w = 2.4) {
  const A = P(u - w / 2, base, 0.05),
    Z = P(u + w / 2, base, 0.7);
  B(
    o,
    c,
    [Math.min(A[0], Z[0]) - 0.12, base - 0.18, Math.min(A[2], Z[2]) - 0.12],
    [Math.max(A[0], Z[0]) + 0.12, base, Math.max(A[2], Z[2]) + 0.12],
    'stone',
    C.stone,
  );
  const count = c.flat ? 2 : c.detail ? 12 : 6;
  for (const y of [base + 0.12, base + 0.8])
    span(o, c, P(u - w / 2, y, 0.77), P(u + w / 2, y, 0.77), 0.07, 0.07, 'gold', C.gold);
  for (let i = 0; i <= count; i++) {
    const v = u - w / 2 + (w * i) / count;
    span(o, c, P(v, base + 0.12, 0.77), P(v, base + 0.8, 0.77), 0.045, 0.045, 'gold', C.gold);
    if (c.detail && i < count) {
      const center = v + w / count / 2;
      for (let j = 0; j < 8; j++) {
        const t = (j / 8) * Math.PI * 2,
          T = ((j + 1) / 8) * Math.PI * 2;
        span(
          o,
          c,
          P(center + (w / count) * 0.4 * Math.cos(t), base + 0.46 + 0.24 * Math.sin(t), 0.79),
          P(center + (w / count) * 0.4 * Math.cos(T), base + 0.46 + 0.24 * Math.sin(T), 0.79),
          0.025,
          0.025,
          'gold',
          C.gold,
        );
      }
    }
  }
  for (const sign of [-1, 1])
    span(
      o,
      c,
      P(u + (sign * w) / 2, base + 0.8, 0.1),
      P(u + (sign * w) / 2, base + 0.8, 0.77),
      0.07,
      0.07,
      'gold',
      C.gold,
    );
}
function rounded(x, z, w, d, y, r, n) {
  if (n === 1)
    return [
      [x - w / 2, y, z - d / 2],
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x + w / 2, y, z - d / 2],
    ];
  const out = [];
  for (const [X, Z, start] of [
    [x - w / 2 + r, z - d / 2 + r, Math.PI],
    [x - w / 2 + r, z + d / 2 - r, Math.PI / 2],
    [x + w / 2 - r, z + d / 2 - r, 0],
    [x + w / 2 - r, z - d / 2 + r, -Math.PI / 2],
  ])
    for (let j = 0; j < n; j++) {
      const t = start + Math.PI / 2 - ((j / (n - 1)) * Math.PI) / 2;
      out.push([X + Math.cos(t) * r, y, Z + Math.sin(t) * r]);
    }
  return out;
}
function mansard(o, c, x, z, w, d, top) {
  const profile = c.far
      ? [
          [0, 1],
          [0.6, 0.85],
          [1, 0.6],
        ]
      : c.flat
        ? [
            [0, 1],
            [0.5, 0.98],
            [0.9, 0.8],
            [1, 0.58],
          ]
        : [
            [0, 1],
            [0.08, 1.02],
            [0.32, 1],
            [0.62, 0.91],
            [0.86, 0.76],
            [1, 0.58],
          ],
    rings = profile.map(([t, s]) =>
      rounded(
        x,
        z,
        w * s,
        d * s,
        H.attic + t * (top - H.attic),
        Math.min(w * s, d * s) * 0.3,
        c.round,
      ),
    );
  // A closed attic supports each cap. Recess its backing behind the authored
  // facade panels; the metal skirt begins above the oval lights.
  L(
    o,
    c,
    [
      rounded(x, z, w - 0.3, d - 0.3, H.cornice, Math.min(w - 0.3, d - 0.3) * 0.3, c.round),
      rounded(x, z, w - 0.3, d - 0.3, H.attic, Math.min(w - 0.3, d - 0.3) * 0.3, c.round),
    ],
    'wall',
    C.wall,
  );
  L(o, c, rings, 'roof', C.roof);
  if (c.detail) {
    const stride = c.fine ? 2 : 4;
    for (let j = 0; j < rings[0].length; j += stride)
      for (let k = 1; k < rings.length; k++)
        span(o, c, rings[k - 1][j], rings[k][j], 0.026, 0.026, 'roof', C.seam);
  }
  L(
    o,
    c,
    [
      rounded(x, z, w * 0.6, d * 0.6, top + 0.03, Math.min(w, d) * 0.18, c.round),
      rounded(x, z, 0.12, 0.12, top + 0.5, 0.03, c.round),
    ],
    'roof',
    C.roof,
  );
}
function gable(o, c, P, base, w, h) {
  const n = c.far ? 4 : c.flat ? 6 : 20,
    r = [[-w / 2, base]];
  for (let i = 0; i <= n; i++) {
    const u = -w / 2 + (w * i) / n,
      t = Math.abs(u / (w / 2)),
      y = base + h * (Math.pow(1 - t, 1.5) + 0.18 * Math.exp(-Math.pow((t - 0.7) / 0.15, 2)));
    r.push([u, y]);
  }
  r.push([w / 2, base]);
  face(o, c, P, r, 'stone', C.stone, 0.22);
  if (c.frames)
    for (let i = 1; i < r.length - 1; i++)
      span(o, c, P(...r[i], 0.06), P(...r[i + 1], 0.06), 0.13, 0.13);
  if (c.detail)
    for (const sign of [-1, 1])
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2,
          T = ((i + 1) / 16) * Math.PI * 2,
          u = sign * w * 0.36;
        span(
          o,
          c,
          P(u + 0.45 * Math.cos(t), base + 0.5 + 0.45 * Math.sin(t), 0.14),
          P(u + 0.45 * Math.cos(T), base + 0.5 + 0.45 * Math.sin(T), 0.14),
          0.11,
          0.11,
        );
      }
}
function urn(o, c, x, z, y) {
  if (c.far) return;
  L(
    o,
    c,
    [
      [y, 0.18],
      [y + 0.15, 0.22],
      [y + 0.35, 0.12],
      [y + 0.55, 0.3],
      [y + 0.8, 0.26],
      [y + 0.95, 0.1],
    ].map(([Y, r]) => radialRing(Y, r, r, c.sides, [x, z])),
  );
}
function railing(o, c, A, Z, y) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz);
  span(o, c, [A[0], y + 0.08, A[1]], [Z[0], y + 0.08, Z[1]], 0.2, 0.18);
  span(o, c, [A[0], y + 0.75, A[1]], [Z[0], y + 0.75, Z[1]], 0.2, 0.16);
  const count = Math.max(1, Math.round(len / (c.flat ? 4 : 0.6)));
  for (let i = 0; i <= count; i++) {
    const x = A[0] + (dx * i) / count,
      z = A[1] + (dz * i) / count;
    if (c.detail)
      L(
        o,
        c,
        [
          [y + 0.15, 0.08],
          [y + 0.28, 0.12],
          [y + 0.4, 0.075],
          [y + 0.57, 0.07],
          [y + 0.68, 0.1],
        ].map(([Y, r]) => radialRing(Y, r, r, c.sides, [x, z])),
      );
    else B(o, c, [x - 0.06, y + 0.15, z - 0.06], [x + 0.06, y + 0.68, z + 0.06], 'stone', C.stone);
  }
}
function entry(o, c) {
  const x = H.frontX;
  for (const z of H.frontDoorCenters) {
    const P = plane(x + 0.02, z, [1, 0]),
      back = plane(x - 1.2, z, [1, 0]);
    arch(o, c, back, 0, H.floor, 1.84, 2.67, 'door', C.door);
    for (let i = 0; i < c.arch * 2; i++) {
      const t = (i / (c.arch * 2)) * Math.PI,
        T = ((i + 1) / (c.arch * 2)) * Math.PI;
      Q(
        o,
        c,
        [
          [x, H.floor + 1.75 + 0.92 * Math.sin(t), z - 0.92 * Math.cos(t)],
          [x - 1.2, H.floor + 1.75 + 0.92 * Math.sin(t), z - 0.92 * Math.cos(t)],
          [x - 1.2, H.floor + 1.75 + 0.92 * Math.sin(T), z - 0.92 * Math.cos(T)],
          [x, H.floor + 1.75 + 0.92 * Math.sin(T), z - 0.92 * Math.cos(T)],
        ],
        'stone',
        C.stone,
      );
    }
    if (c.frames)
      for (let i = -3; i <= 3; i++)
        span(
          o,
          c,
          back(i * 0.22, H.floor + 0.08, 0.04),
          back(i * 0.22, H.floor + 2.1, 0.04),
          0.035,
          0.035,
          'gold',
          C.gold,
        );
    if (c.detail) {
      for (const sign of [-1, 1]) {
        const p = P(sign * 1.1, H.floor + 1.25, 0.18);
        figure(o, c, p[0], p[2], H.floor + 1.2, 1.6);
      }
    }
  }
  if (!c.far) balcony(o, c, plane(x + 0.18, 0, [1, 0]), 0, H.lowerTop + 0.2, 9.6);
  const end = 25,
    y = linderhofGroundY(end, 0) + 0.15,
    n = c.far ? 1 : c.flat ? 4 : Math.ceil((H.floor - y) / 0.19);
  B(o, c, [15.05, Math.min(y - 0.3, H.floor - 0.3), -5.3], [18.2, H.floor, 5.3], 'stone', C.stone);
  for (let i = 0; i < n; i++) {
    const a = 18.2 + ((end - 18.2) * i) / n,
      b = 18.2 + ((end - 18.2) * (i + 1)) / n,
      top = H.floor + ((y - H.floor) * i) / n;
    B(o, c, [a, Math.min(y - 0.25, top - 0.2), -3.5], [b, top, 3.5], 'stone', C.stone);
  }
  if (!c.far) for (const z of [-5.1, 5.1]) railing(o, c, [15.2, z], [18, z], H.floor);
}
function facades(o, c) {
  if (c.far) return;
  const front = plane(15.1, 0, [1, 0]);
  for (const u of [-3.1, 3.1]) window(o, c, front, u, 5.7, 1.7, 4.5, true);
  niche(o, c, front, 0, 5.7, 4.1);
  for (const u of [-4.8, -1.55, 1.55, 4.8]) {
    const p = front(u, 5.5, 0.23);
    column(o, c, p[0], p[2], 5.5, 10.8, 0.24);
  }
  for (const sign of [-1, 1]) {
    const P = plane(13.64, sign * 8, [1, 0]);
    window(o, c, P, 0, 5.8, 1.6, 4.2);
    window(o, c, P, 0, 2.8, 0.8, 1.7);
    niche(o, c, front, sign * 6.2, 5.7, 2.7);
  }
  const back = plane(-15.1, 0.15, [-1, 0]);
  for (const u of [-3.6, 0, 3.6]) {
    window(o, c, back, u, 5.7, 1.7, 4.6);
    balcony(o, c, back, u, 5.65, 2.2);
  }
  face(
    o,
    c,
    back,
    [
      [-0.55, H.floor],
      [0.55, H.floor],
      [0.55, 4.5],
      [-0.55, 4.5],
    ],
    'door',
    C.door,
  );
  for (const sign of [-1, 1]) {
    const P = plane(-11.2, sign * 8.2, [-1, 0]);
    window(o, c, P, 0, 5.9, 1.3, 4.1);
    window(o, c, P, 0, 3, 0.7, 1.2);
    niche(o, c, P, sign * 2.1, 6.1, 2.3);
  }
  for (const sign of [-1, 1]) {
    const P = plane(-2.7, sign * 12.53, [0, sign]);
    for (const u of [-2.15, 2.15]) {
      window(o, c, P, u, 5.7, 1.6, 4.4);
      balcony(o, c, P, u, 5.5, 2.3);
    }
    niche(o, c, P, 0, 5.5, 3.3);
    for (const u of [-3.6, -0.95, 0.95, 3.6]) {
      const p = P(u, 5.5, 0.17);
      column(o, c, p[0], p[2], 5.5, 10.85, 0.2);
    }
    for (const x of [-8.7, 8.7]) {
      const W = plane(x, sign * 10.64, [0, sign]);
      window(o, c, W, 0, 5.8, 1.6, 4.3);
      window(o, c, W, 0, 2.8, 0.75, 1.5);
      niche(o, c, W, sign * 2.1, 5.8, 2.6);
    }
  }
}
function attics(o, c) {
  for (const [x, z, N, w] of [
    [15.04, 0, [1, 0], 10.6],
    [-15.05, 0.1, [-1, 0], 11.35],
    [-2.7, 12.46, [0, 1], 6.3],
    [-2.7, -12.46, [0, -1], 6.3],
  ]) {
    const P = plane(x, z, N);
    face(
      o,
      c,
      P,
      [
        [-w / 2, 11],
        [w / 2, 11],
        [w / 2, 13.4],
        [-w / 2, 13.4],
      ],
      'wall',
      C.wall,
      0.24,
    );
    if (!c.far)
      for (const u of [-w * 0.31, 0, w * 0.31])
        oval(o, c, P, u, 12.3, 0.48, 0.32, x > 14 || Math.abs(z) > 12);
    if (x > 14) {
      gable(o, c, P, 13.4, 11, 3.5);
      if (!c.far) {
        oval(o, c, P, 0, 14.9, 1, 0.65, false);
        for (const u of [-4.4, -2.8, 2.8, 4.4]) {
          const p = P(u, 13.55, 0.12);
          figure(o, c, p[0], p[2], 13.55, 1.5);
        }
      }
      const p = P(0, 16.9);
      figure(o, c, p[0], p[2], 16.9, 3.1, true);
    } else if (Math.abs(z) > 12) {
      for (const u of [-2.45, 0, 2.45]) {
        const G = (v, y, d) => P(v + u, y, d);
        gable(o, c, G, 13.4, 2.6, 1.3);
        const p = P(u, 14.8);
        urn(o, c, p[0], p[2], 14.8);
      }
    }
  }
}
function roofs(o, c) {
  const rect = (x, z, w, d, y) => [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
  L(o, c, [rect(1.2, 0, 25.4, 21.3, 11), rect(1.2, 0, 21, 17.6, 12.2)], 'roof', C.roof);
  for (const [x, z, w, d, top] of [
    [-10.8, 0.15, 8.5, 11.4, 16.4],
    [-2.7, -8.35, 11.6, 8.4, 16.1],
    [-2.7, 8.35, 11.6, 8.4, 16.1],
    [10.3, 0, 9.5, 9.4, 14.7],
  ])
    mansard(o, c, x, z, w, d, top);
  if (!c.far) {
    const r = cw(a.outline);
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        Z = r[(i + 1) % r.length];
      if (
        Math.max(Math.abs(A[0]), Math.abs(Z[0])) > 14.6 ||
        Math.max(Math.abs(A[1]), Math.abs(Z[1])) > 11.8
      )
        continue;
      railing(o, c, A, Z, 11.1);
    }
    for (const [x, z] of [
      [-8.8, -5.8],
      [-8.8, 5.8],
      [5.1, -5.6],
      [5.1, 5.6],
      [7.7, -7.1],
      [7.7, 7.1],
    ]) {
      B(o, c, [x - 0.45, 12.6, z - 0.45], [x + 0.45, 16.85, z + 0.45], 'wall', C.wall);
      if (c.flat) {
        B(o, c, [x - 0.58, 16.85, z - 0.58], [x + 0.58, 17.85, z + 0.58], 'stone', C.stone);
        continue;
      }
      B(o, c, [x - 0.58, 16.85, z - 0.58], [x + 0.58, 17.05, z + 0.58], 'stone', C.stone);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          B(
            o,
            c,
            [x + sx * 0.32 - 0.08, 17.05, z + sz * 0.32 - 0.08],
            [x + sx * 0.32 + 0.08, 17.65, z + sz * 0.32 + 0.08],
            'wall',
            C.wall,
          );
      B(o, c, [x - 0.58, 17.65, z - 0.58], [x + 0.58, 17.85, z + 0.58], 'stone', C.stone);
    }
  }
}
export function buildLinderhofLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error(level);
  shell(o, c);
  roofs(o, c);
  attics(o, c);
  facades(o, c);
  entry(o, c);
}
export const buildLinderhofSkyline = (o) => buildLinderhofLevel(o, 'skyline');
export const buildLinderhofDistrict = (o) => buildLinderhofLevel(o, 'district');
export const buildLinderhofStreet = (o) => buildLinderhofLevel(o, 'street');
export const buildLinderhofCloseup = (o) => buildLinderhofLevel(o, 'closeup');

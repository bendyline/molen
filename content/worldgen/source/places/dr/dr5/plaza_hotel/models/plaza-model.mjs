/** Original Plaza Hotel complete exterior. Meters,+X Fifth Avenue,-Z Central Park South. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    stone: lin('e1ded3'),
    trim: lin('f2ead6'),
    roof: lin('64765d'),
    patina: lin('8bb5a3'),
    dark: lin('575750'),
    glass: lin('647d7c'),
    base: lin('b8b4a8'),
    gold: lin('b99b54'),
  };
export const plazaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.82, metallic: 0 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.6, metallic: 0.25 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.25, metallic: 0.12 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
};
export const plazaControls = a;
export function plazaGroundY(x, z) {
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
const configs = {
  skyline: { far: true, sides: 8, gables: 2 },
  district: { rows: 8, pitch: 6.5, sides: 8, gables: 6, dormers: 1 },
  street: { rows: 15, pitch: 3.3, sides: 12, gables: 6, dormers: 2, sills: true, entry: true },
  closeup: {
    rows: 15,
    pitch: 3.3,
    sides: 20,
    gables: 6,
    dormers: 2,
    sills: true,
    entry: true,
    frames: true,
    ornament: true,
    plant: true,
  },
  master: {
    rows: 15,
    pitch: 3.3,
    sides: 32,
    gables: 6,
    dormers: 2,
    sills: true,
    entry: true,
    frames: true,
    reveals: true,
    ornament: true,
    dense: true,
    plant: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s),
  ring = a.outline.slice(0, -1),
  area = ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - p[1] * q[0];
  }, 0),
  oriented = area < 0 ? ring : ring.toReversed();
function patch(o, slot, ps, color, n) {
  let p = ps;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = ps.toReversed();
  quad(o, slot, p, normalFor(...p), color);
}
function cap(o, c, y) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    let ps = ids.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]);
    if (normalFor(...ps)[1] < 0) ps = ps.toReversed();
    o.addTriangle(
      S(c, 'stone'),
      'palette:#ffffff',
      ps,
      [0, 1, 0],
      ps.map((p) => [p[0], p[2]]),
      C.stone,
    );
  }
}
const face = (p, q) => {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  return { p, q, L, t, n: [-t[1], t[0]] };
};
function P(f, u, y, d = 0) {
  return [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d];
}
function panel(o, c, f, u0, u1, y0, y1, d, slot, color, uv) {
  const ps = [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)],
    n = [f.n[0], 0, f.n[1]];
  if (uv) {
    let p = ps;
    if (normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = ps.toReversed();
    o.addQuad(S(c, slot), 'metric:uv', p, n, uv, color);
  } else patch(o, S(c, slot), ps, color, n);
}
function molding(o, c, f, y, h, d, slot = 'trim', color = C.trim) {
  panel(o, c, f, 0, f.L, y, y + h, d, slot, color);
  if (!c.far) {
    patch(
      o,
      slot,
      [P(f, 0, y + h, 0), P(f, f.L, y + h, 0), P(f, f.L, y + h, d), P(f, 0, y + h, d)],
      color,
      [0, 1, 0],
    );
    patch(
      o,
      slot,
      [P(f, 0, y, 0), P(f, f.L, y, 0), P(f, f.L, y, d), P(f, 0, y, d)],
      color,
      [0, -1, 0],
    );
  }
}
function body(o, c) {
  for (let i = 0; i < oriented.length; i++) {
    const f = face(oriented[i], oriented[(i + 1) % oriented.length]);
    if (f.L < 0.02) continue;
    const low = Math.min(-0.65, plazaGroundY(...f.p) - 0.5, plazaGroundY(...f.q) - 0.5),
      isEntry =
        f.n[0] > 0.99 &&
        f.p[0] > 44 &&
        Math.min(f.p[1], f.q[1]) < 4 &&
        Math.max(f.p[1], f.q[1]) > -4;
    panel(o, c, f, 0, f.L, low, 0.3, 0, 'base', C.base);
    if (isEntry && c.entry) {
      const cut0 = Math.max(0, Math.min(f.L, (-4 - f.p[1]) / f.t[1])),
        cut1 = Math.max(0, Math.min(f.L, (4 - f.p[1]) / f.t[1])),
        u0 = Math.min(cut0, cut1),
        u1 = Math.max(cut0, cut1);
      if (u0 > 0.01) panel(o, c, f, 0, u0, 0.3, 4.7, 0, 'stone', C.stone);
      if (u1 < f.L - 0.01) panel(o, c, f, u1, f.L, 0.3, 4.7, 0, 'stone', C.stone);
      panel(o, c, f, 0, f.L, 4.7, 55.5, 0, 'stone', C.stone);
    } else panel(o, c, f, 0, f.L, 0.3, 55.5, 0, 'stone', C.stone);
    if (f.L < 3) continue;
    for (const [y, h, d] of c.far
      ? [
          [7, 0.7, 0.2],
          [46, 0.7, 0.3],
          [55, 0.5, 0.45],
        ]
      : [
          [6.8, 0.5, 0.25],
          [10, 0.3, 0.17],
          [43.8, 0.6, 0.35],
          [48.5, 0.35, 0.25],
          [54.8, 0.7, 0.55],
        ])
      molding(o, c, f, y, h, d);
    if (c.far) continue;
    const bays = Math.max(1, Math.floor(f.L / c.pitch)),
      pitch = f.L / bays;
    for (let row = 0; row < c.rows; row++) {
      const y = 8 + (row * 45) / c.rows,
        h = (45 / c.rows) * 0.64;
      for (let k = 0; k < bays; k++) {
        const u = (k + 0.5) * pitch,
          w = Math.min(1.32, pitch * 0.58),
          d = 0.045;
        panel(o, c, f, u - w / 2, u + w / 2, y, y + h, d, 'glass', C.glass, [
          [0.08, 0.08],
          [0.92, 0.08],
          [0.92, 0.92],
          [0.08, 0.92],
        ]);
        if (c.sills) {
          panel(o, c, f, u - w / 2 - 0.16, u + w / 2 + 0.16, y - 0.16, y, 0.22, 'trim', C.trim);
          if (row === 12 || row === 14)
            panel(
              o,
              c,
              f,
              u - w / 2 - 0.1,
              u + w / 2 + 0.1,
              y + h,
              y + h + 0.16,
              0.18,
              'trim',
              C.trim,
            );
        }
        if (c.frames) {
          for (const [lo, hi] of [
            [u - w / 2 - 0.1, u - w / 2],
            [u + w / 2, u + w / 2 + 0.1],
          ])
            panel(o, c, f, lo, hi, y, y + h, 0.12, 'trim', C.trim);
          panel(o, c, f, u - 0.035, u + 0.035, y, y + h, 0.09, 'metal', C.patina);
        }
        if (c.reveals) {
          for (const v of [u - w / 2, u + w / 2])
            patch(
              o,
              'trim',
              [P(f, v, y, d), P(f, v, y + h, d), P(f, v, y + h, 0.12), P(f, v, y, 0.12)],
              C.trim,
            );
        }
        if (c.ornament && (row === 12 || row === 14) && k % 2 === 0) {
          const A = P(f, u - w * 0.65, y - 0.18, 0.35),
            B = P(f, u + w * 0.65, y - 0.18, 0.35);
          beam(o, 'trim', A, B, 0.12, 0.12, C.trim);
          for (let j = 0; j < 5; j++) {
            const v = u - w * 0.6 + j * w * 0.3;
            beam(
              o,
              'trim',
              P(f, v, y - 0.18, 0.35),
              P(f, v, y - 0.18 + 0.65, 0.35),
              0.065,
              0.065,
              C.trim,
            );
          }
          beam(
            o,
            'trim',
            P(f, u - w * 0.65, y + 0.47, 0.35),
            P(f, u + w * 0.65, y + 0.47, 0.35),
            0.1,
            0.1,
            C.trim,
          );
        }
      }
    }
    for (let k = 0; k < bays; k++) {
      const u = (k + 0.5) * pitch;
      if (isEntry && Math.abs(P(f, u, 0)[2]) < 5) continue;
      panel(o, c, f, u - 0.8, u + 0.8, 1.2, 5.7, 0.04, 'glass', C.glass);
      if (c.frames) {
        for (const v of [u - 1.1, u + 1.1])
          beam(o, 'trim', P(f, v, 0.4, 0.18), P(f, v, 6.7, 0.18), 0.26, 0.26, C.trim);
      }
    }
    if (c.ornament) {
      for (let j = 1; j < 20; j++) {
        const y = j * 0.33;
        if (isEntry && y < 4.7) {
          const cuts = [(-4 - f.p[1]) / f.t[1], (4 - f.p[1]) / f.t[1]].sort((a, b) => a - b),
            u0 = Math.max(0, cuts[0]),
            u1 = Math.min(f.L, cuts[1]);
          if (u0 > 0) panel(o, c, f, 0, u0, y, y + 0.045, 0.02, 'base', C.base);
          if (u1 < f.L) panel(o, c, f, u1, f.L, y, y + 0.045, 0.02, 'base', C.base);
        } else panel(o, c, f, 0, f.L, y, y + 0.045, 0.02, 'base', C.base);
      }
      for (let k = 0; k < Math.floor(f.L / 0.9); k++)
        panel(o, c, f, k * 0.9, k * 0.9 + 0.3, 54.45, 54.8, 0.48, 'trim', C.trim);
    }
  }
  cap(o, c, 55.5);
}
function roof(o, c) {
  for (const r of a.roofStrips) {
    const f = face(r.p, r.q);
    f.n = r.n;
    // Miter outer corners; the two west sections meet squarely at the footprint step.
    const R = (u, y, d) =>
        P(
          f,
          u === 0 ? (r.name === 'west-south' ? 0 : -d) : r.name === 'west-north' ? f.L : f.L + d,
          y,
          d,
        ),
      profiles = [
        [55.5, 0],
        [67.7, -6.5],
        [70, -8],
        [72.5, -9.3],
      ],
      crossSection = [
        [0, 55.5],
        [-6.5, 67.7],
        [-8, 70],
        [-9.3, 72.5],
        [-11, 72.5],
        [-11, 55.5],
      ];
    for (let j = 1; j < profiles.length; j++) {
      const [y0, d0] = profiles[j - 1],
        [y1, d1] = profiles[j];
      patch(o, S(c, 'roof'), [R(0, y0, d0), R(f.L, y0, d0), R(f.L, y1, d1), R(0, y1, d1)], C.roof, [
        r.n[0],
        0.25,
        r.n[1],
      ]);
    }
    patch(
      o,
      S(c, 'metal'),
      [R(0, 72.5, -9.3), R(f.L, 72.5, -9.3), R(f.L, 72.5, -11), R(0, 72.5, -11)],
      C.patina,
      [0, 1, 0],
    );
    // The native roofwell sees a solid inner return,not backface-culled exterior slopes.
    patch(
      o,
      S(c, 'base'),
      [R(0, 55.5, -11), R(f.L, 55.5, -11), R(f.L, 72.5, -11), R(0, 72.5, -11)],
      C.base,
      [-r.n[0], 0, -r.n[1]],
    );
    const ids = earcut(crossSection.flat());
    for (const end of [0, f.L])
      for (let j = 0; j < ids.length; j += 3) {
        const ps = ids.slice(j, j + 3).map((k) => R(end, crossSection[k][1], crossSection[k][0]));
        triangle(o, S(c, 'roof'), ps, C.roof, [
          f.t[0] * (end === 0 ? -1 : 1),
          0,
          f.t[1] * (end === 0 ? -1 : 1),
        ]);
      }
    if (c.far) continue;
    const N = Math.max(2, Math.floor((f.L - 12) / (c.dormers === 1 ? 8 : 3.7)));
    for (let row = 0; row < c.dormers; row++)
      for (let k = 0; k < N; k++) {
        const u = 6 + ((k + 0.5) * (f.L - 12)) / N,
          y = 57.1 + row * 4.8,
          d = -0.7 - row * 2.65,
          w = 1.4,
          h = 1.9;
        panel(o, c, f, u - w / 2, u + w / 2, y, y + h, d + 0.35, 'glass', C.glass);
        panel(
          o,
          c,
          f,
          u - w / 2 - 0.14,
          u + w / 2 + 0.14,
          y - 0.15,
          y,
          d + 0.45,
          'metal',
          C.patina,
        );
        const l = P(f, u - w * 0.72, y + h, d + 0.5),
          rr = P(f, u + w * 0.72, y + h, d + 0.5),
          peak = P(f, u, y + h + 1, d - 0.25);
        triangle(o, 'roof', [l, rr, peak], C.dark, [r.n[0], 0, r.n[1]]);
        if (c.frames) {
          for (const v of [u - w / 2 - 0.12, u + w / 2 + 0.12])
            beam(o, 'metal', P(f, v, y, d + 0.48), P(f, v, y + h, d + 0.48), 0.14, 0.14, C.patina);
          beam(o, 'metal', l, peak, 0.14, 0.14, C.patina);
          beam(o, 'metal', rr, peak, 0.14, 0.14, C.patina);
        }
      }
    patch(
      o,
      'glass',
      [R(0, 69.3, -7.2), R(f.L, 69.3, -7.2), R(f.L, 71.3, -8.5), R(0, 71.3, -8.5)],
      C.glass,
      [r.n[0], 0.5, r.n[1]],
    );
    if (c.frames)
      for (let k = 0; k <= Math.floor((f.L - 18) / 1.5); k++) {
        const u = 9 + (k * (f.L - 18)) / Math.floor((f.L - 18) / 1.5);
        beam(o, 'metal', P(f, u, 69.3, -7.16), P(f, u, 71.3, -8.46), 0.055, 0.055, C.patina);
      }
  }
  const w = a.roofWell;
  box(o, S(c, 'base'), [w.minX, w.y - 0.3, w.minZ], [w.maxX, w.y, w.maxZ], C.base);
  const wing = w.westWing;
  box(o, S(c, 'base'), [wing.minX, w.y - 0.3, wing.minZ], [wing.maxX, w.y, wing.maxZ], C.base);
  if (c.plant)
    for (const [x, z, W, D, H] of [
      [-14, -4, 11, 7, 4],
      [1, 5, 13, 5, 3],
      [18, -4, 7, 10, 3.6],
      [-28, 12, 8, 5, 2.5],
    ]) {
      box(o, 'base', [x - W / 2, w.y, z - D / 2], [x + W / 2, w.y + H, z + D / 2], C.base);
      if (c.dense)
        for (let k = 0; k < 8; k++)
          box(
            o,
            'metal',
            [x - W / 2 + 0.1, w.y + H, z - D / 2 + (k * D) / 8],
            [x + W / 2 - 0.1, w.y + H + 0.06, z - D / 2 + (k * D) / 8 + 0.09],
            C.dark,
          );
    }
}
// Public quad helper is deliberately only used with four points.
function triangle(o, slot, ps, color, n) {
  let p = ps;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = ps.toReversed();
  o.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    color,
  );
}
function gables(o, c) {
  for (const ga of a.gables.slice(0, c.gables)) {
    let f;
    if (ga.face === 'east') f = face([43.85, ga.u - ga.width / 2], [43.85, ga.u + ga.width / 2]);
    else if (ga.face === 'north')
      f = face([ga.u - ga.width / 2, -31.85], [ga.u + ga.width / 2, -31.85]);
    else f = face([ga.u + ga.width / 2, 31.1], [ga.u - ga.width / 2, 31.1]);
    f.n = ga.face === 'east' ? [1, 0] : ga.face === 'north' ? [0, -1] : [0, 1];
    const L = f.L,
      A = P(f, 0, 55.3),
      B = P(f, L, 55.3),
      T = P(f, L / 2, 73.2);
    triangle(o, S(c, 'trim'), [A, B, T], C.trim, [f.n[0], 0, f.n[1]]);
    // Gable returns connect the facade to the mansard rather than a floating triangular card.
    for (const [p, q] of [
      [A, T],
      [T, B],
    ])
      patch(
        o,
        S(c, 'roof'),
        [
          p,
          q,
          [q[0] - f.n[0] * 4, q[1] - 0.25, q[2] - f.n[1] * 4],
          [p[0] - f.n[0] * 4, p[1], p[2] - f.n[1] * 4],
        ],
        C.roof,
      );
    if (c.far) continue;
    for (const [p, q] of [
      [A, T],
      [T, B],
    ])
      beam(o, 'metal', p, q, 0.22, 0.22, C.patina);
    for (let row = 0; row < 3; row++) {
      const y = 56.8 + row * 3.8,
        n = 3 - row;
      for (let k = 0; k < n; k++) {
        const u = L / 2 + (k - (n - 1) / 2) * 2.1;
        panel(o, c, f, u - 0.65, u + 0.65, y, y + 2, 0.055, 'glass', C.glass);
        if (c.frames)
          for (const v of [u - 0.77, u + 0.77])
            beam(o, 'metal', P(f, v, y, 0.15), P(f, v, y + 2, 0.15), 0.15, 0.15, C.patina);
      }
    }
    for (const y of [57, 60.8, 64.6]) {
      const half = (((73.2 - y) / 17.9) * L) / 2;
      panel(o, c, f, L / 2 - half, L / 2 + half, y - 0.12, y + 0.08, 0.18, 'metal', C.patina);
    }
    beam(o, 'metal', P(f, L / 2, 73.1, 0.02), P(f, L / 2, 75.9, 0.02), 0.16, 0.16, C.patina);
    if (c.ornament)
      for (const side of [-1, 1])
        for (let j = 1; j < 5; j++) {
          const y = 56 + j * 3.1,
            u = L / 2 + (((side * (73.2 - y)) / 17.9) * L) / 2;
          beam(o, 'metal', P(f, u, y, 0.1), P(f, u, y + 0.65, 0.1), 0.12, 0.12, C.patina);
        }
  }
}
function turrets(o, c) {
  for (const t of a.turrets) {
    const [x, z] = t.center,
      N = c.sides,
      r = t.radius,
      low = Math.min(-0.5, plazaGroundY(x, z) - 0.6);
    loft(
      o,
      S(c, 'stone'),
      [radialRing(low, r, r, N, [x, z]), radialRing(60.4, r, r, N, [x, z])],
      C.stone,
    );
    for (const y of [7, 44.2, 49, 55.2, 60.4])
      loft(
        o,
        S(c, 'metal'),
        [
          radialRing(y, r + 0.18, r + 0.18, N, [x, z]),
          radialRing(y + 0.3, r + 0.18, r + 0.18, N, [x, z]),
        ],
        C.patina,
      );
    const dome = [
      [60.7, r + 0.1],
      [61.9, r + 0.08],
      [64.1, r * 0.78],
      [65.7, r * 0.35],
      [66.2, 0.12],
    ];
    loft(
      o,
      S(c, 'metal'),
      dome.map(([y, r]) => radialRing(y, r, r, N, [x, z])),
      C.dark,
    );
    beam(o, S(c, 'metal'), [x, 66.1, z], [x, 68.4, z], 0.15, 0.15, C.patina);
    if (c.far) continue;
    for (let row = 0; row < 15; row++)
      for (let k = 0; k < (c.dense ? 8 : 4); k++) {
        const th = (k * Math.PI * 2) / (c.dense ? 8 : 4),
          th2 = th + 0.35,
          y = 8 + row * 3.15;
        patch(
          o,
          'glass',
          [
            [x + (r + 0.03) * Math.cos(th), y, z + (r + 0.03) * Math.sin(th)],
            [x + (r + 0.03) * Math.cos(th2), y, z + (r + 0.03) * Math.sin(th2)],
            [x + (r + 0.03) * Math.cos(th2), y + 2.05, z + (r + 0.03) * Math.sin(th2)],
            [x + (r + 0.03) * Math.cos(th), y + 2.05, z + (r + 0.03) * Math.sin(th)],
          ],
          C.glass,
        );
      }
    if (c.ornament)
      for (let k = 0; k < 8; k++) {
        const th = (k * Math.PI) / 4;
        for (let j = 1; j < dome.length; j++) {
          const [y0, r0] = dome[j - 1],
            [y1, r1] = dome[j];
          beam(
            o,
            'metal',
            [x + r0 * Math.cos(th), y0, z + r0 * Math.sin(th)],
            [x + r1 * Math.cos(th), y1, z + r1 * Math.sin(th)],
            0.055,
            0.055,
            C.patina,
          );
        }
        beam(
          o,
          'metal',
          [x + (r + 0.15) * Math.cos(th), 60.6, z + (r + 0.15) * Math.sin(th)],
          [x + (r + 0.15) * Math.cos(th), 62.5, z + (r + 0.15) * Math.sin(th)],
          0.1,
          0.1,
          C.patina,
        );
      }
  }
}
function entry(o, c) {
  const e = a.entrance,
    slot = S(c, 'base');
  box(o, slot, [43, -1.1, -7], [49, 0.3, 7], C.base);
  if (c.entry) {
    const ground = plazaGroundY(49.5, 0);
    for (let i = 0; i < 4; i++)
      box(
        o,
        'base',
        [49 + i * 0.34, ground - 0.35, -6.5],
        [49 + (i + 1) * 0.34, 0.3 - ((0.3 - ground) * (i + 1)) / 4, 6.5],
        C.base,
      );
    // Recessed vestibule back,side returns and lintel leave the east-facing opening clear.
    box(o, 'metal', [42.5, 0.3, -4], [42.65, 4.7, 4], C.dark);
    box(o, 'trim', [42.5, 4.7, -4], [44.95, 4.95, 4], C.trim);
    for (const z of [-4, 4]) box(o, 'trim', [42.6, 0.3, z - 0.15], [44.9, 4.7, z + 0.15], C.trim);
    for (const z of [-2.5, 0, 2.5]) {
      box(o, 'glass', [42.7, 0.35, z - 0.8], [42.78, 3.5, z + 0.8], C.glass);
      beam(o, 'metal', [42.85, 0.4, z], [42.85, 3.5, z], 0.07, 0.07, C.gold);
    }
  }
  box(o, S(c, 'metal'), [44.3, 5.4, -7], [49.8, 5.75, 7], C.dark);
  box(o, S(c, 'metal'), [49.6, 5.25, -7], [49.85, 5.65, 7], C.patina);
  if (!c.entry) return;
  for (const z of [-6.5, 6.5]) {
    beam(o, 'metal', [49.3, 0.3, z], [49.3, 5.45, z], 0.14, 0.14, C.gold);
    beam(o, 'metal', [49.4, 5.4, z], [44.8, 7.6, z], 0.065, 0.065, C.dark);
  }
  if (c.frames) {
    for (let i = 0; i < 9; i++)
      beam(
        o,
        'metal',
        [44.5, 5.78, -6.5 + i * 1.6],
        [49.5, 5.78, -6.5 + i * 1.6],
        0.06,
        0.06,
        C.gold,
      );
    for (const z of [-5, 5]) {
      box(o, 'base', [48.6, 0.3, z - 0.45], [49.5, 1.25, z + 0.45], C.base);
    }
  }
  // Second,smaller street canopy is signed to the north facade.
  box(o, 'metal', [-6, 5.1, -34.8], [7, 5.4, -30.8], C.dark);
  for (const x of [-5.5, 6.5])
    beam(o, 'metal', [x, plazaGroundY(x, -34), -34], [x, 5.1, -34], 0.12, 0.12, C.dark);
}
export function buildPlazaLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Plaza detail:' + level);
  body(o, c);
  roof(o, c);
  gables(o, c);
  turrets(o, c);
  entry(o, c);
}
export const buildPlazaSkyline = (o) => buildPlazaLevel(o, 'skyline'),
  buildPlazaDistrict = (o) => buildPlazaLevel(o, 'district'),
  buildPlazaStreet = (o) => buildPlazaLevel(o, 'street'),
  buildPlazaCloseup = (o) => buildPlazaLevel(o, 'closeup');

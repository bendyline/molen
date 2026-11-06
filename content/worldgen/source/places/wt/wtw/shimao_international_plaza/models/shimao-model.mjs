/** Original complete Shimao hotel/mall exterior. Meters,+X ENE,+Z SSE. */
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
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: lin('7898aa'),
    white: lin('e0e1db'),
    frame: lin('aebbc2'),
    dark: lin('5c6569'),
    podium: lin('d7d0c3'),
    brown: lin('9b8176'),
    roof: lin('b7b8b1'),
    ground: lin('aaa69c'),
  };
export const shimaoSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.23, metallic: 0.17 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.53, metallic: 0.3 },
  podium: { slot: 'wall', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.91, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
};
export const shimaoControls = a;
export function shimaoGroundY(x, z) {
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
const cfg = {
    skyline: { far: true, sides: 8, roofBeams: true },
    district: { rows: 18, pitch: 5.6, sides: 8, podiumRows: 4, canopy: 2 },
    street: { rows: 40, pitch: 2.3, sides: 12, podiumRows: 8, canopy: 5, entry: true },
    closeup: {
      rows: 60,
      pitch: 1.9,
      sides: 16,
      podiumRows: 8,
      canopy: 9,
      entry: true,
      mullions: true,
      plant: true,
    },
    master: {
      rows: 60,
      pitch: 1.35,
      sides: 24,
      podiumRows: 8,
      canopy: 13,
      entry: true,
      mullions: true,
      reveals: true,
      plant: true,
      dense: true,
    },
  },
  S = (c, s) => (c.far ? 'far' : s);
const area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  open = (r) => (r.at(-1)[0] === r[0][0] && r.at(-1)[1] === r[0][1] ? r.slice(0, -1) : r);
function patch(o, slot, ps, color, n) {
  let p = ps;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.toReversed();
  quad(o, slot, p, normalFor(...p), color);
}
function tri(o, slot, ps, color, n) {
  let p = ps;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    color,
  );
}
function cap(o, slot, raw, heights, color) {
  const r = open(raw),
    ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      slot,
      ids
        .slice(i, i + 3)
        .map((k) => [r[k][0], typeof heights === 'number' ? heights : heights[k], r[k][1]]),
      color,
      [0, 1, 0],
    );
}
function face(p, q) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  return { p, q, L, t, n: [-t[1], t[0]] };
}
function P(f, u, y, d = 0) {
  return [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d];
}
function panel(o, c, f, u0, u1, y0, y1, d, slot, color, uv) {
  if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
  let ps = [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)],
    n = [f.n[0], 0, f.n[1]];
  if (normalFor(...ps).reduce((s, v, i) => s + v * n[i], 0) < 0) ps = ps.toReversed();
  if (uv) o.addQuad(S(c, slot), 'metric:uv', ps, n, uv, color);
  else patch(o, S(c, slot), ps, color, n);
}
export const shimaoEntryPoint = (u, y, d = 0) => P(face(a.entrance.p, a.entrance.q), u, y, d);
function prism(o, c, r, y0, y1, slot, color) {
  const ps = area(open(r)) < 0 ? open(r) : open(r).toReversed();
  for (let i = 0; i < ps.length; i++) {
    const f = face(ps[i], ps[(i + 1) % ps.length]);
    panel(o, c, f, 0, f.L, y0, y1, 0, slot, color);
  }
  cap(o, S(c, slot), ps, y1, color);
}
function canopyBeam(o, c, A, B, w, color = C.dark) {
  beam(o, S(c, 'metal'), A, B, w, w, color);
}
function podium(o, c) {
  const r = area(open(a.outline)) < 0 ? open(a.outline) : open(a.outline).toReversed(),
    e = a.entrance;
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      low = Math.min(
        -0.8,
        ...Array.from({ length: Math.ceil(f.L / 4) + 1 }, (_, j) => {
          const p = P(f, (j * f.L) / Math.ceil(f.L / 4), 0);
          return shimaoGroundY(p[0], p[2]) - 0.6;
        }),
      ),
      entry = f.n[0] < -0.95 && f.p[0] < -65 && f.L > 45;
    panel(o, c, f, 0, f.L, low, e.landingY, 0, 'ground', C.ground);
    if (entry && c.entry) {
      panel(o, c, f, 0, e.centerU - e.openingHalfWidth, e.landingY, e.doorY, 0, 'podium', C.podium);
      panel(
        o,
        c,
        f,
        e.centerU + e.openingHalfWidth,
        f.L,
        e.landingY,
        e.doorY,
        0,
        'podium',
        C.podium,
      );
      panel(o, c, f, 0, f.L, e.doorY, a.podium.topY, 0, 'podium', C.podium);
    } else panel(o, c, f, 0, f.L, e.landingY, a.podium.topY, 0, 'podium', C.podium);
    const rows = c.far ? 4 : c.podiumRows;
    for (let j = 0; j < rows; j++) {
      const y = 3 + (j * 31) / rows,
        h = (31 / rows) * 0.6;
      if (c.far) {
        panel(o, c, f, 0, f.L, y, y + h, 0.03, 'glass', C.glass);
        continue;
      }
      const cols = Math.max(1, Math.floor(f.L / (c.dense ? 2.2 : c.entry ? 3.2 : 8))),
        pitch = f.L / cols;
      for (let k = 0; k < cols; k++) {
        const u = (k + 0.5) * pitch,
          w = pitch * 0.93;
        if (entry && c.entry && y < e.doorY && Math.abs(u - e.centerU) < e.openingHalfWidth + w / 2)
          continue;
        panel(o, c, f, u - w / 2, u + w / 2, y, Math.min(34, y + h), 0.04, 'glass', C.glass, [
          [0, 0],
          [Math.max(1, pitch / 2), 0],
          [Math.max(1, pitch / 2), 1],
          [0, 1],
        ]);
        if (c.mullions)
          for (const v of [u - w / 2, u + w / 2])
            beam(
              o,
              'metal',
              P(f, v, y, 0.12),
              P(f, v, Math.min(34, y + h), 0.12),
              0.06,
              0.06,
              C.frame,
            );
      }
      if (j > 0) {
        panel(o, c, f, 0, f.L, y - 0.55, y - 0.1, 0.3, 'podium', C.white);
        patch(
          o,
          'podium',
          [
            P(f, 0, y - 0.1, 0),
            P(f, f.L, y - 0.1, 0),
            P(f, f.L, y - 0.1, 0.3),
            P(f, 0, y - 0.1, 0.3),
          ],
          C.white,
          [0, 1, 0],
        );
      }
    }
    panel(o, c, f, 0, f.L, 34.5, 35.3, 0.35, 'podium', C.white);
    if (c.mullions)
      for (let k = 0; k <= Math.floor(f.L / 8); k++) {
        const u = (k * f.L) / Math.floor(f.L / 8);
        if (entry && Math.abs(u - e.centerU) < e.openingHalfWidth) continue;
        beam(o, 'podium', P(f, u, e.landingY, 0.16), P(f, u, 34.5, 0.16), 0.28, 0.28, C.white);
      }
  }
  cap(o, S(c, 'roof'), a.outline, a.podium.topY, C.roof);
  for (const p of a.podium.roofPavilions) {
    const [x, z] = p.center,
      [w, h, d] = p.size;
    box(o, S(c, 'metal'), [x - w / 2, 35, z - d / 2], [x + w / 2, 35 + h, z + d / 2], C.brown);
    box(
      o,
      S(c, 'roof'),
      [x - w / 2 - 0.2, 35 + h, z - d / 2 - 0.2],
      [x + w / 2 + 0.2, 35 + h + 0.25, z + d / 2 + 0.2],
      C.roof,
    );
    if (c.mullions)
      for (let j = 1; j < 8; j++)
        box(
          o,
          'metal',
          [x - w / 2 - 0.02, 35 + (j * h) / 8, z - d / 2 - 0.02],
          [x + w / 2 + 0.02, 35 + (j * h) / 8 + 0.055, z + d / 2 + 0.02],
          C.frame,
        );
  }
}
function tower(o, c) {
  const t = a.tower,
    r = t.outline,
    ys = t.topHeights,
    clockwise = area(r) < 0;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      p = clockwise ? r[i] : r[j],
      q = clockwise ? r[j] : r[i],
      h0 = clockwise ? ys[i] : ys[j],
      h1 = clockwise ? ys[j] : ys[i],
      f = face(p, q),
      height = (u) => h0 + ((h1 - h0) * u) / f.L;
    patch(
      o,
      S(c, 'glass'),
      [P(f, 0, t.baseY), P(f, f.L, t.baseY), P(f, f.L, h1), P(f, 0, h0)],
      C.glass,
      [f.n[0], 0, f.n[1]],
    );
    if (!c.far) {
      const cols = Math.max(1, Math.ceil(f.L / c.pitch)),
        pitch = f.L / cols,
        dy = 250 / c.rows;
      for (let row = 0; row < c.rows; row++) {
        const y = t.baseY + row * dy + 0.08;
        for (let k = 0; k < cols; k++) {
          const u0 = k * pitch + 0.06,
            u1 = (k + 1) * pitch - 0.06,
            top = Math.min(y + dy - 0.16, height(u0) - 0.14, height(u1) - 0.14);
          if (top - y < 0.2) continue;
          panel(o, c, f, u0, u1, y, top, 0.025, 'glass', C.glass, [
            [0.02, 0.02],
            [0.98, 0.02],
            [0.98, 0.98],
            [0.02, 0.98],
          ]);
          if (c.reveals) {
            for (const u of [u0, u1])
              patch(
                o,
                'metal',
                [P(f, u, y, 0.025), P(f, u, top, 0.025), P(f, u, top, 0.08), P(f, u, y, 0.08)],
                C.frame,
              );
          }
        }
        let u0 = 0,
          u1 = f.L;
        if (y > Math.max(h0, h1) - 0.2) continue;
        if (y > h0) u0 = ((y - h0) / (h1 - h0)) * f.L;
        if (y > h1) u1 = ((y - h0) / (h1 - h0)) * f.L;
        if (u1 - u0 > 0.1) panel(o, c, f, u0, u1, y - 0.09, y + 0.025, 0.07, 'metal', C.frame);
      }
      if (c.mullions)
        for (let k = 1; k < cols; k++) {
          const u = k * pitch;
          beam(
            o,
            'metal',
            P(f, u, t.baseY, 0.08),
            P(f, u, height(u) - 0.12, 0.08),
            0.06,
            0.06,
            C.frame,
          );
        }
    }
    const roofA = P(f, 0, h0, 0.16),
      roofB = P(f, f.L, h1, 0.16);
    beam(o, S(c, 'metal'), roofA, roofB, 1.8, 1.4, C.white);
  }
  for (let i = 0; i < r.length; i++) {
    const [x, z] = r[i],
      w = [0, 1, 3, 4, 6].includes(i) ? 2 : 0.8;
    beam(o, S(c, 'metal'), [x, 35, z], [x, ys[i], z], w, w, C.white);
    if (c.dense)
      for (const d of [-0.5, 0.5])
        beam(o, 'metal', [x + d, 35, z + 0.1], [x + d, ys[i], z + 0.1], 0.065, 0.065, C.frame);
  }
  for (const [i, poly] of t.roofPolygons.entries())
    cap(o, S(c, i === 0 ? 'roof' : 'glass'), poly.points, poly.heights, i === 0 ? C.dark : C.glass);
  // Inclined curtain-wall shoulders keep floor bands and mullions as cameras approach.
  if (!c.far)
    for (const poly of t.roofPolygons.slice(1)) {
      const [A, B, Cc, D] = poly.points,
        [h0, h1] = poly.heights,
        G = (u, v) => {
          const n = [A[0] + (B[0] - A[0]) * v, A[1] + (B[1] - A[1]) * v],
            s = [D[0] + (Cc[0] - D[0]) * v, D[1] + (Cc[1] - D[1]) * v];
          return [n[0] + (s[0] - n[0]) * u, h0 + (h1 - h0) * v, n[1] + (s[1] - n[1]) * u];
        },
        n = normalFor(G(0, 0), G(1, 0), G(1, 1)),
        F = (u, v) => G(u, v).map((p, i) => p + n[i] * 0.09),
        rows = Math.ceil(Math.abs(h0 - h1) / (c.dense ? 3.7 : c.mullions ? 4.2 : c.entry ? 8 : 20)),
        cols = c.dense ? 24 : c.mullions ? 18 : c.entry ? 10 : 4;
      for (let j = 1; j < rows; j++)
        beam(o, 'metal', F(0, j / rows), F(1, j / rows), 0.12, 0.09, C.frame);
      for (let k = 1; k < cols; k++)
        beam(o, 'metal', F(k / cols, 0), F(k / cols, 1), 0.1, 0.09, C.frame);
    }
  const roofCut = [r[1], r[6]];
  beam(
    o,
    S(c, 'metal'),
    [roofCut[0][0], 285, roofCut[0][1]],
    [roofCut[1][0], 285, roofCut[1][1]],
    1.1,
    1.1,
    C.white,
  );
}
function masts(o, c) {
  for (const m of a.tower.masts) {
    const [x, z] = m.center,
      N = c.sides,
      profiles = [
        [m.baseY, 1.1],
        [306, 0.72],
        [309, 0.68],
        [309.1, 1.25],
        [310.4, 1.25],
        [310.5, 0.64],
        [330, 0.35],
        [m.topY, 0.15],
      ];
    loft(
      o,
      S(c, 'metal'),
      profiles.map(([y, r]) => radialRing(y, r, r, N, [x, z])),
      C.white,
    );
    for (const v of [m.center[1] > 0 ? a.tower.outline[6] : a.tower.outline[1]]) {
      const y = v === a.tower.outline[0] ? 246 : 285;
      beam(
        o,
        S(c, 'metal'),
        [v[0], y + 0.2, v[1]],
        [x, 310, z],
        c.far ? 0.22 : c.dense ? 0.14 : 0.2,
        c.far ? 0.22 : c.dense ? 0.14 : 0.2,
        C.frame,
      );
    }
    if (c.dense)
      for (let j = 0; j < 7; j++)
        loft(
          o,
          'metal',
          [
            radialRing(316 + j * 2, 0.52, 0.52, N, [x, z]),
            radialRing(316.08 + j * 2, 0.52, 0.52, N, [x, z]),
          ],
          C.frame,
        );
  }
}
function entry(o, c) {
  const e = a.entrance,
    f = face(e.p, e.q),
    u0 = e.landingMinU,
    u1 = e.landingMaxU,
    top = [
      P(f, u0, e.landingY, 0),
      P(f, u1, e.landingY, 0),
      P(f, u1, e.landingY, e.landingDepth),
      P(f, u0, e.landingY, e.landingDepth),
    ],
    bottom = top.map((p) => [p[0], Math.min(-0.8, shimaoGroundY(p[0], p[2]) - 0.5), p[2]]);
  loft(o, S(c, 'ground'), [bottom.toReversed(), top.toReversed()], C.ground);
  if (c.entry) {
    for (let i = 0; i < 6; i++) {
      const d0 = e.landingDepth + (i * e.stairRun) / 6,
        d1 = e.landingDepth + ((i + 1) * e.stairRun) / 6,
        Y = (u) => {
          const p = P(f, u, 0, e.landingDepth + e.stairRun),
            ground = shimaoGroundY(p[0], p[2]);
          return e.landingY + ((ground - e.landingY) * (i + 1)) / 6;
        },
        t = [P(f, u0, Y(u0), d0), P(f, u1, Y(u1), d0), P(f, u1, Y(u1), d1), P(f, u0, Y(u0), d1)],
        b = t.map((p) => [p[0], Math.min(-1, shimaoGroundY(p[0], p[2]) - 0.5), p[2]]);
      loft(o, 'ground', [b.toReversed(), t.toReversed()], C.ground);
    }
    const left = e.centerU - e.openingHalfWidth,
      right = e.centerU + e.openingHalfWidth;
    panel(o, c, f, left, right, e.landingY, e.doorY, -1.7, 'metal', C.dark);
    for (const u of [left, right])
      patch(
        o,
        'podium',
        [
          P(f, u, e.landingY, 0),
          P(f, u, e.landingY, -1.7),
          P(f, u, e.doorY, -1.7),
          P(f, u, e.doorY, 0),
        ],
        C.podium,
        u === left ? [f.t[0], 0, f.t[1]] : [-f.t[0], 0, -f.t[1]],
      );
    patch(
      o,
      'podium',
      [
        P(f, left, e.doorY, 0),
        P(f, right, e.doorY, 0),
        P(f, right, e.doorY, -1.7),
        P(f, left, e.doorY, -1.7),
      ],
      C.podium,
      [0, -1, 0],
    );
    for (const du of [-4, 0, 4]) {
      panel(
        o,
        c,
        f,
        e.centerU + du - 1.2,
        e.centerU + du + 1.2,
        e.landingY + 0.1,
        5.1,
        -1.63,
        'glass',
        C.glass,
      );
      beam(
        o,
        'metal',
        P(f, e.centerU + du, e.landingY + 0.1, -1.58),
        P(f, e.centerU + du, 5.1, -1.58),
        0.07,
        0.07,
        C.white,
      );
    }
  }
  const R = (u, d) =>
      P(f, u, e.canopyBackY + ((e.canopyFrontY - e.canopyBackY) * d) / e.canopyDepth, d),
    N = c.far ? 1 : c.canopy;
  for (let k = 0; k < N; k++) {
    const l = e.canopyMinU + (k * (e.canopyMaxU - e.canopyMinU)) / N,
      r = e.canopyMinU + ((k + 1) * (e.canopyMaxU - e.canopyMinU)) / N;
    patch(
      o,
      S(c, 'glass'),
      [R(l, 0), R(r, 0), R(r, e.canopyDepth), R(l, e.canopyDepth)],
      C.glass,
      [0, 1, 0],
    );
  }
  for (const d of [0, e.canopyDepth]) {
    canopyBeam(o, c, R(e.canopyMinU, d), R(e.canopyMaxU, d), 0.22);
    if (!c.far) {
      const A = R(e.canopyMinU, d),
        B = R(e.canopyMaxU, d);
      canopyBeam(o, c, [A[0], A[1] - 1, A[2]], [B[0], B[1] - 1, B[2]], 0.18);
      for (let k = 0; k < N; k++) {
        const u = e.canopyMinU + (k * (e.canopyMaxU - e.canopyMinU)) / N,
          v = e.canopyMinU + ((k + 1) * (e.canopyMaxU - e.canopyMinU)) / N,
          A = R(u, d),
          B = R(v, d);
        canopyBeam(o, c, [A[0], A[1] - 1, A[2]], B, 0.12);
        canopyBeam(o, c, A, [B[0], B[1] - 1, B[2]], 0.12);
      }
    }
  }
  if (!c.far) {
    for (let k = 0; k <= N; k++) {
      const u = e.canopyMinU + (k * (e.canopyMaxU - e.canopyMinU)) / N;
      canopyBeam(o, c, R(u, 0), R(u, e.canopyDepth), 0.15);
      if (c.dense) {
        const A = R(u, 0),
          B = R(u, e.canopyDepth);
        canopyBeam(o, c, [A[0], A[1] - 0.85, A[2]], [B[0], B[1] - 0.85, B[2]], 0.12);
        canopyBeam(o, c, A, [B[0], B[1] - 0.85, B[2]], 0.1);
      }
    }
    for (const u of [10, 22, 34, 46]) {
      const p = R(u, e.canopyDepth - 0.3),
        ground = shimaoGroundY(p[0], p[2]);
      canopyBeam(o, c, [p[0], ground - 0.4, p[2]], [p[0], p[1] - 1, p[2]], 0.25);
    }
  }
}
function plant(o, c) {
  if (!c.plant) return;
  for (const [x, z, w, d, h] of [
    [-53, -20, 9, 7, 2.5],
    [-28, 24, 12, 6, 3],
    [48, -21, 12, 7, 3.2],
  ]) {
    box(o, 'roof', [x - w / 2, 35, z - d / 2], [x + w / 2, 35 + h, z + d / 2], C.roof);
    if (c.dense)
      for (let i = 0; i < 12; i++)
        box(
          o,
          'metal',
          [x - w / 2 + 0.1, 35 + h, z - d / 2 + (i * d) / 12],
          [x + w / 2 - 0.1, 35 + h + 0.05, z - d / 2 + (i * d) / 12 + 0.08],
          C.dark,
        );
  }
}
export function buildShimaoLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Shimao level:' + level);
  podium(o, c);
  tower(o, c);
  masts(o, c);
  entry(o, c);
  plant(o, c);
}
export const buildShimaoSkyline = (o) => buildShimaoLevel(o, 'skyline'),
  buildShimaoDistrict = (o) => buildShimaoLevel(o, 'district'),
  buildShimaoStreet = (o) => buildShimaoLevel(o, 'street'),
  buildShimaoCloseup = (o) => buildShimaoLevel(o, 'closeup');

/** Original Lyduvėnai railway viaduct reconstruction. +X northeast; meters. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    steel: linear('64736c'),
    concrete: linear('dfdac8'),
    wood: linear('96856d'),
    rail: linear('a8a9a0'),
    walk: linear('bbc5bf'),
  };
export const lyduvenaiSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.32 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
};
export const lyduvenaiControls = a;
export const lyduvenaiDeckY = (x) =>
  a.deckProfile[0][1] +
  ((a.deckProfile.at(-1)[1] - a.deckProfile[0][1]) * (x - a.limits[0])) /
    (a.limits[1] - a.limits[0]);
export const lyduvenaiGroundY = (x, z) => {
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
};
const configs = {
  skyline: { far: true, cells: 1 },
  district: { cells: 4 },
  street: { cells: 10, vertical: true, cross: true, ties: 3.2, railPosts: 12 },
  closeup: {
    cells: 10,
    vertical: true,
    cross: true,
    ties: 1.25,
    railPosts: 4.5,
    flanges: true,
    walk: true,
    gussets: true,
  },
  master: {
    cells: 10,
    vertical: true,
    cross: true,
    ties: 0.62,
    railPosts: 2.2,
    flanges: true,
    walk: true,
    gussets: true,
    rivets: true,
    grating: true,
  },
};
const [x0, x1] = a.limits,
  ends = a.spanEnds;
function member(o, s, p, q, w, d, color, cfg) {
  beam(o, s, p, q, w, d, color);
  if (cfg.flanges) {
    const dx = q[0] - p[0],
      dy = q[1] - p[1],
      dz = q[2] - p[2],
      l = Math.hypot(dx, dy, dz),
      nx = -dy / l,
      ny = Math.abs(dz) > 0.95 * l ? 1 : dx / l;
    for (const sign of [-1, 1]) {
      const shift = [nx * d * 0.5 * sign, ny * d * 0.5 * sign, 0];
      beam(
        o,
        s,
        p.map((v, i) => v + shift[i]),
        q.map((v, i) => v + shift[i]),
        w * 1.65,
        0.035,
        color,
      );
    }
  }
}
function pier(o, s, x, cfg) {
  const base = lyduvenaiGroundY(x, 0) - 1.2,
    top = lyduvenaiDeckY(x) - 9.35,
    foot = base + 2;
  box(o, s, [x - 2.75, base, -3.75], [x + 2.75, foot, 3.75], C.concrete);
  if (cfg.far) {
    box(o, s, [x - 1.5, foot, -2.6], [x + 1.5, top, 2.6], C.concrete);
  } else {
    // Three convex tapered volumes form the recessed shaft; no non-convex fan caps.
    for (const [u0, u1, v0, v1] of [
      [-1.5, -0.95, -2.65, 2.65],
      [-0.95, 0.95, -2.12, 2.12],
      [0.95, 1.5, -2.65, 2.65],
    ]) {
      const ring = (y, k) =>
        [
          [u0, v0],
          [u0, v1],
          [u1, v1],
          [u1, v0],
        ].map(([u, v]) => [x + u * k, y, v * k]);
      loft(o, s, [ring(foot, 1.12), ring(top, 1)], C.concrete);
    }
    if (cfg.flanges) {
      box(o, s, [x - 2.55, foot, -3.5], [x + 2.55, foot + 0.28, 3.5], C.concrete);
    }
  }
  box(o, s, [x - 2, top, -3.2], [x + 2, top + 0.55, 3.2], C.concrete);
  if (cfg.vertical)
    for (const z of [-2, 2])
      box(
        o,
        cfg.far ? 'far' : 'steel',
        [x - 0.7, top + 0.55, z - 0.38],
        [x + 0.7, top + 0.9, z + 0.38],
        C.steel,
      );
}
function abutment(o, s, x, sign, cfg) {
  const hi = lyduvenaiDeckY(x) - 0.5,
    base = lyduvenaiGroundY(x, 0) - 1.2;
  box(o, s, [x - 1.6, base, -3.25], [x + 1.6, hi, 3.25], C.concrete);
  // Retaining wings are bounded original reconstruction, not terrain replacement.
  for (const z of [-3, 3]) {
    const k = sign * 4.8;
    loft(
      o,
      s,
      [
        [
          [x, base, z - 0.25],
          [x, hi, z - 0.25],
          [x, hi, z + 0.25],
          [x, base, z + 0.25],
        ],
        [
          [x + k, base, z - 0.25],
          [x + k, hi - 1.4, z - 0.25],
          [x + k, hi - 1.4, z + 0.25],
          [x + k, base, z + 0.25],
        ],
      ].sort((r, t) => r[0][0] - t[0][0]),
      C.concrete,
    );
  }
  if (cfg.walk) {
    const walk = lyduvenaiDeckY(x) - 9.0;
    const end = x - sign * 1.7;
    const rise = (hi - walk) / 2,
      run = 4.8;
    for (let flight = 0; flight < 2; flight++) {
      const lo = walk + rise * flight,
        z = flight ? 1.05 : -1.05,
        steps = 12;
      for (let i = 0; i < steps; i++) {
        const xx = end - sign * (flight ? run - (run * i) / steps : (run * i) / steps),
          y = lo + (rise * i) / steps;
        box(o, 'steel', [xx - 0.22, y, z - 0.4], [xx + 0.22, y + 0.12, z + 0.4], C.walk);
      }
      box(
        o,
        'steel',
        [Math.min(end, end - sign * run), lo + rise - 0.12, -1.55],
        [Math.max(end, end - sign * run), lo + rise, 1.55],
        C.walk,
      );
    }
  }
}
export function buildLyduvenaiLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('unknown level ' + level);
  const metal = c.far ? 'far' : 'steel',
    stone = c.far ? 'far' : 'concrete',
    wood = c.far ? 'far' : 'wood';
  for (const x of a.piers) pier(o, stone, x, c);
  abutment(o, stone, x0, -1, c);
  abutment(o, stone, x1, 1, c);
  // Rail girders and sleeper belt, plus narrow outside maintenance walks. No solid side panels.
  for (const z of [-0.83, 0.83])
    beam(
      o,
      metal,
      [x0, lyduvenaiDeckY(x0) - 0.42, z],
      [x1, lyduvenaiDeckY(x1) - 0.42, z],
      0.23,
      0.56,
      C.steel,
    );
  if (!c.ties)
    box(
      o,
      wood,
      [x0, lyduvenaiDeckY(x0) - 0.14, -1.32],
      [x1, lyduvenaiDeckY(x1) - 0.01, 1.32],
      C.wood,
    );
  else
    for (let x = x0 + 0.3; x < x1; x += c.ties) {
      const y = lyduvenaiDeckY(x);
      box(o, wood, [x - 0.12, y - 0.18, -1.35], [x + 0.12, y, 1.35], C.wood);
    }
  for (const z of [-0.76, 0.76]) {
    const y0 = lyduvenaiDeckY(x0),
      y1 = lyduvenaiDeckY(x1);
    member(o, metal, [x0, y0 + 0.1, z], [x1, y1 + 0.1, z], 0.065, 0.14, C.rail, c);
  }
  for (const z of [-1.73, 1.73]) {
    beam(
      o,
      metal,
      [x0, lyduvenaiDeckY(x0) - 0.16, z],
      [x1, lyduvenaiDeckY(x1) - 0.16, z],
      0.5,
      0.12,
      C.steel,
    );
    beam(
      o,
      metal,
      [x0, lyduvenaiDeckY(x0) + 1.1, z + Math.sign(z) * 0.42],
      [x1, lyduvenaiDeckY(x1) + 1.1, z + Math.sign(z) * 0.42],
      0.06,
      0.065,
      C.steel,
    );
  }
  for (let s = 0; s < ends.length - 1; s++) {
    const start = ends[s] + 0.14,
      end = ends[s + 1] - 0.14,
      top = (x) => lyduvenaiDeckY(x) - 0.65,
      bottom = (x) => lyduvenaiDeckY(x) - 8.95;
    for (const z of c.far ? [0] : [-2.05, 2.05]) {
      for (const h of [top, bottom])
        member(
          o,
          metal,
          [start, h(start), z],
          [end, h(end), z],
          c.far ? 0.28 : 0.25,
          c.far ? 0.3 : 0.38,
          C.steel,
          c,
        );
      for (let k = 0; k < c.cells; k++) {
        const p = start + ((end - start) * k) / c.cells,
          q = start + ((end - start) * (k + 1)) / c.cells;
        // Two crossed diagonals keep real daylight through each individual panel.
        for (const flip of [false, true])
          member(
            o,
            metal,
            [p, (flip ? top : bottom)(p), z],
            [q, (flip ? bottom : top)(q), z],
            c.far ? 0.23 : 0.16,
            c.far ? 0.25 : 0.2,
            C.steel,
            c,
          );
        if (c.vertical) member(o, metal, [p, bottom(p), z], [p, top(p), z], 0.18, 0.22, C.steel, c);
        if (c.gussets) {
          for (const [x, y] of [
            [p, top(p)],
            [p, bottom(p)],
          ]) {
            box(o, metal, [x - 0.35, y - 0.35, z - 0.11], [x + 0.35, y + 0.35, z + 0.11], C.steel);
            if (c.rivets)
              for (const dz of [-0.13, 0.13])
                for (const dx of [-0.23, 0, 0.23])
                  for (const dy of [-0.23, 0.23])
                    box(
                      o,
                      metal,
                      [x + dx - 0.025, y + dy - 0.025, z + dz - 0.02],
                      [x + dx + 0.025, y + dy + 0.025, z + dz + 0.02],
                      C.rail,
                    );
          }
        }
      }
      if (c.vertical)
        member(o, metal, [end, bottom(end), z], [end, top(end), z], 0.18, 0.22, C.steel, c);
    }
    if (c.cross) {
      for (let k = 0; k <= c.cells; k++) {
        const x = start + ((end - start) * k) / c.cells,
          y = lyduvenaiDeckY(x);
        member(o, metal, [x, y - 0.85, -2.05], [x, y - 0.85, 2.05], 0.2, 0.2, C.steel, c);
        beam(o, metal, [x, y - 8.95, -2.05], [x, y - 8.95, 2.05], 0.16, 0.18, C.steel);
        if (k % 2 === 0) {
          for (const sign of [-1, 1])
            beam(
              o,
              metal,
              [x, y - 6.1, -2.05 * sign],
              [x, y - 0.85, 2.05 * sign],
              0.12,
              0.14,
              C.steel,
            );
        }
      }
    }
  }
  if (c.railPosts)
    for (let x = x0 + 1; x < x1; x += c.railPosts)
      for (const z of [-2.15, 2.15]) {
        const y = lyduvenaiDeckY(x);
        box(o, metal, [x - 0.035, y - 0.2, z - 0.035], [x + 0.035, y + 1.13, z + 0.035], C.steel);
        if (c.walk)
          box(
            o,
            metal,
            [x - 0.03, y - 8.95, z / 2 - 0.03],
            [x + 0.03, y - 7.8, z / 2 + 0.03],
            C.walk,
          );
      }
  // Current visitor route is under the railway, within the lower chord, never on the track.
  if (!c.far) {
    const walk = (x) => lyduvenaiDeckY(x) - 8.88;
    if (c.grating) {
      for (let x = x0 + 0.04; x < x1; x += 0.22)
        box(o, metal, [x - 0.018, walk(x) - 0.1, -0.85], [x + 0.018, walk(x), 0.85], C.walk);
      for (const z of [-0.82, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.82])
        beam(o, metal, [x0, walk(x0) - 0.09, z], [x1, walk(x1) - 0.09, z], 0.025, 0.06, C.walk);
    } else beam(o, metal, [x0, walk(x0) - 0.055, 0], [x1, walk(x1) - 0.055, 0], 1.7, 0.11, C.walk);
    for (const z of [-0.93, 0.93])
      for (const dy of c.walk ? [0.15, 0.6, 1.1] : [1.1])
        beam(o, metal, [x0, walk(x0) + dy, z], [x1, walk(x1) + dy, z], 0.045, 0.045, C.walk);
    if (c.walk) {
      for (const z of [-1.1, 1.1])
        beam(o, metal, [x0, walk(x0) + 2.4, z], [x1, walk(x1) + 2.4, z], 0.36, 0.035, C.steel);
    }
  }
}
export const buildLyduvenaiSkyline = (o) => buildLyduvenaiLevel(o, 'skyline');
export const buildLyduvenaiDistrict = (o) => buildLyduvenaiLevel(o, 'district');
export const buildLyduvenaiStreet = (o) => buildLyduvenaiLevel(o, 'street');
export const buildLyduvenaiCloseup = (o) => buildLyduvenaiLevel(o, 'closeup');

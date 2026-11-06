/** Original current Ponte alle Grazie. +X NNE; meters; no downloaded mesh. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    concrete: linear('e7dfca'),
    stone: linear('b3a38a'),
    cap: linear('c5b9a2'),
    paving: linear('c5c1b4'),
    road: linear('747873'),
    metal: linear('9eaaa3'),
    paint: linear('e1dfcf'),
  };
export const grazieSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.97, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
  road: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.3 },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};
export const grazieControls = a;
export const grazieDeckY = (x) =>
  a.deckBaseMeters + a.crownMeters * (1 - (x / a.limits[1]) * (x / a.limits[1]));
export const grazieGroundY = (x, z) => {
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
export const grazieArchY = (arch, x) => {
  const t = (x - arch.center) / arch.halfSpan;
  return grazieDeckY(x) - 0.72 - arch.rise * t * t;
};
const configs = {
  skyline: { far: true, arch: 6, deck: 4 },
  district: { arch: 12, deck: 8, posts: 6.5 },
  street: { arch: 24, deck: 16, posts: 2.6, balusters: 0.75, paving: 3.2, lights: true },
  closeup: {
    arch: 48,
    deck: 32,
    posts: 2.1,
    balusters: 0.32,
    paving: 1.5,
    blocks: 1.2,
    rows: 0.55,
    lights: true,
    trim: true,
  },
  master: {
    arch: 96,
    deck: 56,
    posts: 1.8,
    balusters: 0.16,
    paving: 0.85,
    blocks: 0.65,
    rows: 0.34,
    lights: true,
    trim: true,
  },
};
const F = (cfg, name) => (cfg.far ? 'far' : name);
function slab(o, s, xa, xb, za, zb, lo, hi, color) {
  const ring = (x) => [
    [x, lo(x), za],
    [x, hi(x), za],
    [x, hi(x), zb],
    [x, lo(x), zb],
  ];
  loft(o, s, [ring(xa), ring(xb)], color);
}
function archBody(o, arch, cfg) {
  const s = F(cfg, 'concrete'),
    n = cfg.arch,
    top = (x) => grazieDeckY(x) - 0.25;
  for (let i = 0; i < n; i++) {
    const p = arch.center - arch.halfSpan + (2 * arch.halfSpan * i) / n,
      q = arch.center - arch.halfSpan + (2 * arch.halfSpan * (i + 1)) / n,
      lp = grazieArchY(arch, p),
      lq = grazieArchY(arch, q),
      tp = top(p),
      tq = top(q);
    // Connected strips with exterior faces only: no internal slice caps or overlapping walls.
    for (const side of [-1, 1]) {
      const z = side * 7.85;
      let ps = [
        [p, lp, z],
        [q, lq, z],
        [q, tq, z],
        [p, tp, z],
      ];
      if (normalFor(...ps)[2] * side < 0) ps = ps.toReversed();
      quad(o, s, ps, [0, 0, side], C.concrete);
    }
    let ps = [
      [p, lp, -7.85],
      [p, lp, 7.85],
      [q, lq, 7.85],
      [q, lq, -7.85],
    ];
    if (normalFor(...ps)[1] > 0) ps = ps.toReversed();
    quad(o, s, ps, normalFor(...ps), C.concrete);
    ps = [
      [p, tp, -7.85],
      [q, tq, -7.85],
      [q, tq, 7.85],
      [p, tp, 7.85],
    ];
    if (normalFor(...ps)[1] < 0) ps = ps.toReversed();
    quad(o, s, ps, normalFor(...ps), C.concrete);
  }
  for (const sign of [-1, 1]) {
    const x = arch.center + sign * arch.halfSpan;
    let ps = [
      [x, grazieArchY(arch, x), -7.85],
      [x, top(x), -7.85],
      [x, top(x), 7.85],
      [x, grazieArchY(arch, x), 7.85],
    ];
    if (normalFor(...ps)[0] * sign < 0) ps = ps.toReversed();
    quad(o, s, ps, [sign, 0, 0], C.concrete);
  }
}
function wallBlocks(o, poly, lo, hi, cfg) {
  if (!cfg.blocks) return;
  const height = hi - lo,
    rows = Math.ceil(height / cfg.rows);
  for (let e = 0; e < poly.length; e++) {
    const p = poly[e],
      q = poly[(e + 1) % poly.length],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len;
    for (let row = 0; row < rows; row++) {
      const bottom = lo + (height * row) / rows + 0.012,
        top = lo + (height * (row + 1)) / rows - 0.012;
      if (top <= bottom) continue;
      const count = Math.ceil(len / cfg.blocks),
        offset = row % 2 ? 0.5 : 0;
      for (let j = -1; j < count; j++) {
        const t0 = Math.max(0, (j + offset) / count) + 0.009 / len,
          t1 = Math.min(1, (j + 1 + offset) / count) - 0.009 / len;
        if (t1 <= t0) continue;
        const at = (t, y, d) => [p[0] + dx * t + nx * d, y, p[1] + dz * t + nz * d],
          front = [
            at(t0, bottom, 0.025),
            at(t1, bottom, 0.025),
            at(t1, top, 0.025),
            at(t0, top, 0.025),
          ],
          back = [at(t0, bottom, 0), at(t1, bottom, 0), at(t1, top, 0), at(t0, top, 0)],
          f = 0.97 + 0.018 * ((row * 11 + e * 7 + j * 3 + 1000) % 4),
          color = C.stone.map((v) => v * f);
        quad(o, 'stone', front, [nx, 0, nz], color);
        for (let k = 0; k < 4; k++) {
          const k1 = (k + 1) % 4,
            ps = [back[k], back[k1], front[k1], front[k]];
          quad(o, 'stone', ps, normalFor(...ps), color);
        }
      }
    }
  }
}
function pier(o, p, cfg) {
  const s = F(cfg, 'stone'),
    poly = p.outline,
    ground = Math.min(...poly.map(([x, z]) => grazieGroundY(x, z))),
    bottom = ground - 1,
    top = grazieDeckY(p.station) + 0.14;
  // Clockwise XZ rings face upward; exact mapped tips preserve asymmetric cutwaters.
  const ring = (y, scale) =>
    poly.map(([x, z]) => [p.station + (x - p.station) * scale, y, z * scale]);
  loft(o, s, [ring(bottom, 1.06), ring(1.25, 1), ring(top, 1)], C.stone);
  wallBlocks(o, poly, 1.28, top - 0.16, cfg);
  if (cfg.trim) loft(o, s, [ring(top - 0.14, 1.025), ring(top + 0.03, 1.025)], C.cap);
}
function abutment(o, x, sign, cfg) {
  const s = F(cfg, 'stone'),
    front = x - sign * 1.65,
    rear = x + sign * 3,
    lo = Math.min(grazieGroundY(front, 0), grazieGroundY(rear, 0)) - 1,
    hi = grazieDeckY(x) - 0.26;
  box(o, s, [Math.min(front, rear), lo, -8.05], [Math.max(front, rear), hi, 8.05], C.stone);
  // Bounded masonry wing faces meet the authored end; surrounding native quay is outside scope.
  if (cfg.trim)
    for (const z of [-8, 8])
      box(
        o,
        s,
        [Math.min(front, rear), hi - 0.4, z - 0.15],
        [Math.max(front, rear), hi + 0.24, z + 0.15],
        C.cap,
      );
}
function railing(o, points, cfg) {
  const s = F(cfg, 'metal');
  if (cfg.far) return;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1],
      q = points[i],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]),
      at = (t, h) => {
        const x = p[0] + (q[0] - p[0]) * t,
          z = p[1] + (q[1] - p[1]) * t;
        return [x, grazieDeckY(x) + h, z];
      };
    for (const h of [0.42, 1.28]) beam(o, s, at(0, h), at(1, h), 0.06, 0.065, C.metal);
    const n = Math.max(1, Math.ceil(l / cfg.posts));
    for (let k = 0; k < n; k++) beam(o, s, at(k / n, 0.18), at(k / n, 1.3), 0.075, 0.075, C.metal);
    if (cfg.balusters) {
      const m = Math.max(1, Math.ceil(l / cfg.balusters));
      for (let k = 1; k < m; k++)
        beam(o, s, at(k / m, 0.25), at(k / m, 1.25), 0.032, 0.032, C.metal);
    }
  }
}
function lamp(o, x, z, cfg) {
  const y = grazieDeckY(x) + 0.17;
  box(o, 'metal', [x - 0.06, y, z - 0.06], [x + 0.06, y + 3.2, z + 0.06], C.metal);
  box(o, 'metal', [x - 0.16, y + 3.12, z - 0.16], [x + 0.16, y + 3.52, z + 0.16], C.metal);
  if (cfg.trim) {
    box(o, 'metal', [x - 0.23, y + 3.52, z - 0.23], [x + 0.23, y + 3.58, z + 0.23], C.metal);
  }
}
export function buildGrazieLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown level ' + level);
  const [x0, x1] = a.limits;
  for (const arch of a.arches) archBody(o, arch, c);
  for (const p of a.piers) pier(o, p, c);
  abutment(o, x0, -1, c);
  abutment(o, x1, 1, c);
  for (let i = 0; i < c.deck; i++) {
    const x = x0 + ((x1 - x0) * i) / c.deck,
      q = x0 + ((x1 - x0) * (i + 1)) / c.deck;
    slab(o, F(c, 'road'), x, q, -4.8, 4.8, (p) => grazieDeckY(p) - 0.25, grazieDeckY, C.road);
    for (const side of [-1, 1]) {
      const za = side < 0 ? -7.85 : 4.8,
        zb = side < 0 ? -4.8 : 7.85;
      slab(
        o,
        F(c, 'paving'),
        x,
        q,
        za,
        zb,
        (p) => grazieDeckY(p) - 0.25,
        (p) => grazieDeckY(p) + 0.17,
        C.paving,
      );
    }
  }
  for (const side of [-1, 1]) {
    let points = a.guardLines[side < 0 ? 0 : 1];
    if (c.far) points = [points[0], points.at(-1)];
    railing(o, points, c);
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1],
        q = points[i];
      beam(
        o,
        F(c, 'stone'),
        [p[0], grazieDeckY(p[0]) + 0.17, p[1]],
        [q[0], grazieDeckY(q[0]) + 0.17, q[1]],
        0.16,
        0.18,
        C.cap,
      );
    }
    for (let i = 0; i < c.deck; i++) {
      const p = x0 + ((x1 - x0) * i) / c.deck,
        q = x0 + ((x1 - x0) * (i + 1)) / c.deck,
        z = side * 4.85;
      beam(
        o,
        F(c, 'stone'),
        [p, grazieDeckY(p) + 0.09, z],
        [q, grazieDeckY(q) + 0.09, z],
        0.14,
        0.22,
        C.cap,
      );
    }
  }
  if (c.paving)
    for (let x = x0 + 0.02; x < x1; x += c.paving) {
      const q = Math.min(x1, x + c.paving - 0.018);
      for (const side of [-1, 1])
        for (let row = 0; row < 3; row++) {
          const z = side * (4.92 + 0.95 * row);
          const ps = [
            [x, grazieDeckY(x) + 0.174, z],
            [q, grazieDeckY(q) + 0.174, z],
            [q, grazieDeckY(q) + 0.174, z + side * 0.92],
            [x, grazieDeckY(x) + 0.174, z + side * 0.92],
          ];
          if (normalFor(...ps)[1] < 0) ps.reverse();
          quad(
            o,
            'paving',
            ps,
            [0, 1, 0],
            C.paving.map((v) => v * (0.98 + 0.008 * ((row + Math.trunc(x)) % 3))),
          );
        }
    }
  if (c.lights)
    for (const x of a.piers.map((p) => p.station)) for (const z of [-7.5, 7.5]) lamp(o, x, z, c);
  if (!c.far)
    for (let x = x0 + 5; x < x1 - 2; x += 6)
      slab(
        o,
        'paint',
        x,
        Math.min(x1 - 2, x + 2),
        -0.05,
        0.05,
        (p) => grazieDeckY(p) + 0.002,
        (p) => grazieDeckY(p) + 0.008,
        C.paint,
      );
  // The mapped transverse south-end path is owned by this deck too. Its painted
  // crossing is bounded by the modeled landing; dimensions are an approximation.
  if (!c.far) {
    const center = a.crossingLine.reduce((s, p) => s + p[0], 0) / 2,
      left = Math.max(x0 + 0.05, center - 1.3),
      right = center + 1.3;
    for (let z = -4.5; z < 4.5; z += 0.9)
      slab(
        o,
        'paint',
        left,
        right,
        z,
        z + 0.48,
        (x) => grazieDeckY(x) + 0.009,
        (x) => grazieDeckY(x) + 0.015,
        C.paint,
      );
  }
}
export const buildGrazieSkyline = (o) => buildGrazieLevel(o, 'skyline');
export const buildGrazieDistrict = (o) => buildGrazieLevel(o, 'district');
export const buildGrazieStreet = (o) => buildGrazieLevel(o, 'street');
export const buildGrazieCloseup = (o) => buildGrazieLevel(o, 'closeup');

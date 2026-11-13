/** General Belgrano Bridge. Mapped RN16 deck, split-leg towers and the Paraná approach spans. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.92 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.13 },
};
const colors = {
  shell: [0.58, 0.56, 0.51],
  edge: [0.74, 0.7, 0.61],
  soffit: [0.42, 0.405, 0.375],
  pier: [0.62, 0.6, 0.535],
  footing: [0.455, 0.435, 0.385],
  asphalt: [0.202, 0.191, 0.174],
  walk: [0.595, 0.539, 0.45],
  fill: [0.475, 0.384, 0.27],
  rail: [0.37, 0.351, 0.307],
  lamp: [0.51, 0.506, 0.471],
  cable: [0.222, 0.232, 0.218],
  stripe: [0.76, 0.745, 0.68],
  joint: [0.105, 0.103, 0.091],
  ochre: [0.66, 0.416, 0.138],
  red: [0.62, 0.137, 0.089],
};
const { deck, plan, piers, towers, body, outer, halfWidth: w, bankSkews } = layout;
const up = [0, 1, 0],
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t;
const levels = ['skyline', 'district', 'street', 'closeup', 'master'];
function station(rows, x) {
  const i = rows.findIndex((r) => r[0] >= x);
  if (i <= 0) return rows.at(i).slice(1);
  const a = rows[i - 1],
    b = rows[i],
    t = (x - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, k) => mix(v, b[k + 1], t));
}
function at(x, offset, lift = 0) {
  const [y, z] = station(deck, x);
  const a = Math.max(outer[0], x - 1.5),
    b = Math.min(outer[1], x + 1.5);
  let slope = -(station(plan, b)[0] - station(plan, a)[0]) / (b - a);
  if (x < outer[0] + 16) slope = mix(bankSkews[0], slope, (x - outer[0]) / 16);
  if (x > outer[1] - 16) slope = mix(bankSkews[1], slope, (outer[1] - x) / 16);
  const v = offset / Math.hypot(1, slope);
  return [x + slope * v, y + lift, z + v];
}
function tri(o, slot, tone, p, wanted) {
  let n = normalFor(...p);
  if (n.reduce((a, v, i) => a + v * wanted[i], 0) < 0) {
    p = p.toReversed();
    n = n.map((v) => -v);
  }
  if (Math.hypot(...n) > 0.5) o.addTriangle(slot, ref, p, n, undefined, colors[tone]);
}
function quad(o, slot, tone, a, b, c, d, n) {
  tri(o, slot, tone, [a, b, c], n);
  tri(o, slot, tone, [a, c, d], n);
}
function strip(o, slot, tone, a, b, u, v, y = 0) {
  quad(o, slot, tone, at(a, u, y), at(a, v, y), at(b, v, y), at(b, u, y), up);
}
const rod = (o, slot, tone, a, b, width, depth = width) =>
  beam(o, slot, a, b, width, depth, colors[tone]);
function ring(x, y, z, dx, dz, s = 0) {
  return [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ].map(([u, v]) => [x + dx * u * 0.5 + s * dz * v * 0.5, y, z + dz * v * 0.5]);
}
function block(o, slot, tone, x, z, lo, hi, dx, dz, s = 0) {
  loft(o, slot, [ring(x, lo, z, dx, dz, s), ring(x, hi, z, dx, dz, s)], colors[tone]);
}
function depth(x) {
  if (x < body[0] || x > body[1]) return 0.29;
  return 2.37 + 0.61 * Math.max(0, 1 - Math.min(...towers.map((t) => Math.abs(x - t.x))) / 30);
}
function stations(tier) {
  const path = [...outer, ...body, ...plan.map((p) => p[0])];
  if (tier > 1) return deck.map((p) => p[0]);
  const n = tier === 0 ? 7 : 3;
  return [...new Set([...path, ...deck.filter((p, i) => i % n === 0).map((p) => p[0])])].sort(
    (a, b) => a - b,
  );
}
function decks(o, tier) {
  const rows = stations(tier),
    lane = 4.15;
  const walkRise = (x) => 0.136 * Math.min(1, (x - outer[0]) / 12, (outer[1] - x) / 12);
  const section = (x, d) => [
    at(x, -w, 0.03),
    at(x, -w, -0.39),
    at(x, -3.08, -d),
    at(x, 3.08, -d),
    at(x, w, -0.39),
    at(x, w, 0.03),
  ];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    strip(o, 'paving', 'asphalt', a, b, tier === 0 ? -w : -lane, tier === 0 ? w : lane);
    if (tier > 0)
      for (const sign of [-1, 1]) {
        const u = sign * lane,
          v = sign * w;
        quad(
          o,
          'paving',
          'walk',
          at(a, u, walkRise(a)),
          at(a, v, walkRise(a)),
          at(b, v, walkRise(b)),
          at(b, u, walkRise(b)),
          up,
        );
        quad(
          o,
          'concrete',
          'edge',
          at(a, u),
          at(a, u, walkRise(a)),
          at(b, u, walkRise(b)),
          at(b, u),
          [0, 0, -sign],
        );
        quad(
          o,
          'concrete',
          'edge',
          at(a, v),
          at(b, v),
          at(b, v, walkRise(b)),
          at(a, v, walkRise(a)),
          [0, 0, sign],
        );
        if (tier >= 2)
          strip(o, 'metal', 'stripe', a, b, sign * 3.84 - 0.048, sign * 3.84 + 0.048, 0.011);
      }
    const A = section(a, depth(a)),
      B = section(b, depth(b)),
      indices = tier === 0 ? [0, 2, 3, 5] : [0, 1, 2, 3, 4, 5];
    for (let j = 1; j < indices.length; j++) {
      const u = indices[j - 1],
        v = indices[j],
        s = v <= 2 ? -1 : u >= 3 ? 1 : 0;
      quad(o, 'concrete', s ? 'shell' : 'soffit', A[u], A[v], B[v], B[u], [0, -0.8, s]);
    }
  }
  if (tier >= 2) {
    for (let x = outer[0] + 8; x < outer[1] - 11; x += 12)
      strip(o, 'metal', 'stripe', x, x + 4.5, -0.066, 0.066, 0.012);
    for (const x of [...layout.main, body[0], body[1], 332.4]) {
      strip(o, 'metal', 'joint', x - 0.1, x + 0.1, -lane, lane, 0.025);
      if (tier >= 3)
        for (const v of [-0.17, 0.17])
          strip(o, 'metal', 'lamp', x + v - 0.035, x + v + 0.035, -lane, lane, 0.026);
    }
  }
  for (const fills of layout.approachFills)
    for (let i = 1; i < fills.length; i++)
      for (const sign of [-1, 1]) {
        const a = fills[i - 1],
          b = fills[i],
          top = (p) => at(p.x, p.top[2] * sign, -0.105);
        const toe = (p) => [p.x, p.toe[sign === -1 ? 0 : 1], p.top[1] + sign * p.skirt];
        quad(o, 'paving', 'fill', top(a), toe(a), toe(b), top(b), [0, 1, sign]);
      }
}
function approachPiers(o, tier) {
  for (const { x, z, base, top, skew, bank } of piers) {
    if (bank) {
      block(o, 'concrete', 'footing', x, z, base, top + 1.7, 4.3, 12, skew);
      continue;
    }
    if (tier === 0) {
      block(o, 'concrete', 'pier', x, z, base, top + 0.11, 2.44, 6.0, skew);
      continue;
    }
    block(o, 'concrete', 'footing', x, z, base, base + 2.5, 4.48, 8.05, skew);
    for (const side of [-1, 1]) {
      const p = side * 2.28;
      loft(
        o,
        'concrete',
        [
          ring(x + skew * p, base + 1.9, z + p, 2.29, 1.62, skew),
          ring(x + skew * p, top - 0.72, z + p, 1.89, 1.53, skew),
        ],
        colors.pier,
      );
      if (tier >= 3)
        block(o, 'metal', 'joint', x + skew * p, z + p, top - 0.12, top + 0.14, 0.83, 1.37, skew);
    }
    loft(
      o,
      'concrete',
      [ring(x, top - 1.3, z, 2.4, 6.5, skew), ring(x, top + 0.14, z, 2.67, 8.9, skew)],
      colors.edge,
    );
  }
}
function thinStay(o, a, b, width) {
  const t = width * 0.5;
  for (const sign of [-1, 1])
    quad(
      o,
      'metal',
      'cable',
      [a[0], a[1] - t, a[2]],
      [b[0], b[1] - t, b[2]],
      [b[0], b[1] + t, b[2]],
      [a[0], a[1] + t, a[2]],
      [0, 0, sign],
    );
}
function fender(o, x, y, z, sign, tier) {
  const a = [
    [x - 7, y, z + sign * 23],
    [x - 7, y, z + sign * 51],
    [x + 23, y, z + sign * 36],
  ];
  loft(o, 'concrete', [a.map((p) => [p[0], p[1] - 4, p[2]]), a], colors.ochre);
  tri(
    o,
    'metal',
    'red',
    a.map((p) => [p[0], p[1] + 0.04, p[2]]),
    up,
  );
  if (tier >= 3) {
    for (let i = 0; i < 3; i++) {
      const p = a[i],
        q = a[(i + 1) % 3];
      rod(o, 'metal', 'ochre', [p[0], p[1] + 0.15, p[2]], [q[0], q[1] + 0.15, q[2]], 0.18);
    }
  }
}
function pylons(o, tier) {
  for (const t of towers) {
    const { x, z, y, top, cap, base, skew } = t;
    block(o, 'concrete', 'footing', x, z, base, cap, 18.8, 21.2, skew);
    if (tier > 0) block(o, 'concrete', 'edge', x, z, cap - 0.85, cap + 0.35, 19.45, 21.85, skew);
    for (const side of [-1, 1]) {
      const point = (dx, h, d) => [x + dx + skew * side * d, h, z + side * d];
      for (const face of [-1, 1]) {
        const foot = point(face * 2.9, cap - 0.3, 4.9),
          waist = point(face * 8.82, y - 0.82, 7.8),
          tip = point(face * 1.24, top - 0.72, 4.35);
        rod(o, 'concrete', 'pier', foot, waist, tier === 0 ? 1.86 : 1.69, 2.28);
        rod(o, 'concrete', 'edge', waist, tip, tier === 0 ? 1.94 : 1.78, 2.18);
      }
      const lengths = tier === 0 ? [48, 96, 111] : [35, 59, 84, 111];
      for (const sign of [-1, 1])
        for (const [i, d] of lengths.entries()) {
          const a = point(sign * (0.75 + i * 0.37), top - 2.8 + i * 0.48, 4.73),
            b = at(x + sign * d, side * 5.68, 0.38);
          if (tier === 0) thinStay(o, a, b, 0.27);
          else rod(o, 'metal', 'cable', a, b, tier === 1 ? 0.192 : 0.112);
          if (tier >= 2) {
            const q = a.map((v, k) => mix(b[k], v, 0.018));
            rod(o, 'metal', 'lamp', b, q, 0.265, 0.205);
          }
        }
      fender(o, x, cap + 1.46, z, side, tier);
    }
    const a = [x - skew * 4.35, top - 0.64, z - 4.35],
      b = [x + skew * 4.35, top - 0.64, z + 4.35];
    rod(o, 'concrete', 'edge', a, b, 3.76, 1.82);
    if (tier > 0) block(o, 'concrete', 'edge', x, z, top - 0.66, top + 0.14, 4.0, 10.45, skew);
  }
}
function railsAndLamps(o, tier) {
  const rows = stations(tier).filter((x) => x >= body[0] && x <= body[1]);
  for (const sign of [-1, 1]) {
    const z = sign * (w - 0.16);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      if (tier < 2) {
        if (tier === 0) continue;
        quad(o, 'metal', 'rail', at(a, z, 0.91), at(b, z, 0.91), at(b, z, 1.12), at(a, z, 1.12), [
          0,
          0,
          sign,
        ]);
      } else {
        rod(o, 'metal', 'rail', at(a, z, 1.12), at(b, z, 1.12), 0.091);
        rod(o, 'metal', 'rail', at(a, z, 0.55), at(b, z, 0.55), 0.049);
      }
    }
    const pitch = [0, 22, 8.3, 3.88, 3.26][tier];
    if (tier > 0)
      for (let x = body[0] + pitch * 0.5; x < body[1]; x += pitch) {
        if (tier < 3)
          quad(
            o,
            'metal',
            'rail',
            at(x - 0.04, z, 0.14),
            at(x + 0.04, z, 0.14),
            at(x + 0.04, z, 1.12),
            at(x - 0.04, z, 1.12),
            [0, 0, sign],
          );
        else rod(o, 'metal', 'rail', at(x, z, 0.14), at(x, z, 1.12), 0.073);
      }
  }
  if (tier >= 2) {
    let i = 0;
    for (let x = body[0] + 22; x < body[1] - 13; x += 48, i++) {
      const z = (i % 2 === 0 ? -1 : 1) * (w - 0.39),
        a = at(x, z, 0.16),
        b = at(x, z, 6.55),
        c = at(x, z * 0.72, 7.0);
      rod(o, 'metal', 'lamp', a, b, 0.118);
      rod(o, 'metal', 'lamp', b, c, 0.086);
      rod(o, 'metal', 'edge', c, at(x, z * 0.64, 7.0), 0.19, 0.11);
    }
  }
}
export function buildBelgranoLevel(out, level) {
  const tier = levels.indexOf(level);
  if (tier < 0) throw Error('Unknown General Belgrano Bridge LOD ' + level);
  decks(out, tier);
  approachPiers(out, tier);
  pylons(out, tier);
  railsAndLamps(out, tier);
}
export const buildBelgranoSkyline = (out) => buildBelgranoLevel(out, 'skyline');
export const buildBelgranoDistrict = (out) => buildBelgranoLevel(out, 'district');
export const buildBelgranoStreet = (out) => buildBelgranoLevel(out, 'street');
export const buildBelgranoCloseup = (out) => buildBelgranoLevel(out, 'closeup');

/** Kassuende Bridge and the two approach viaducts. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  girder: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.92 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.07 },
};
const colors = {
  shell: [0.64, 0.615, 0.548],
  face: [0.72, 0.688, 0.618],
  soffit: [0.47, 0.456, 0.415],
  pier: [0.635, 0.61, 0.539],
  footing: [0.505, 0.477, 0.423],
  asphalt: [0.206, 0.194, 0.177],
  walk: [0.506, 0.466, 0.392],
  dirt: [0.539, 0.42, 0.273],
  rail: [0.57, 0.145, 0.109],
  redDark: [0.359, 0.103, 0.082],
  lamp: [0.44, 0.447, 0.423],
  reflector: [0.79, 0.741, 0.633],
  white: [0.759, 0.749, 0.689],
  joint: [0.142, 0.135, 0.124],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0];
const { deck, supports, body, halfWidth, outer, bankSkews } = layout;
const mix = (a, b, t) => a + (b - a) * t;
function pose(x) {
  const i = deck.findIndex((p) => p[0] >= x);
  if (i <= 0) return deck.at(i).slice(1);
  const [a, b] = deck.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
function at(x, z, y = 0) {
  const [top, center] = pose(x);
  const skew =
    x < outer[0] + 15
      ? bankSkews[0] * (1 - (x - outer[0]) / 15)
      : x > outer[1] - 15
        ? bankSkews[1] * (1 - (outer[1] - x) / 15)
        : 0;
  return [x + skew * z, top + y, center + z];
}
function triangle(out, slot, tone, points, preferred) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * preferred[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
}
function quad(out, slot, tone, a, b, c, d, n) {
  triangle(out, slot, tone, [a, b, c], n);
  triangle(out, slot, tone, [a, c, d], n);
}
const strip = (out, slot, tone, a, b, z0, z1, y = 0) =>
  quad(out, slot, tone, at(a, z0, y), at(a, z1, y), at(b, z1, y), at(b, z0, y), up);
const rod = (out, slot, tone, a, b, w, h = w) => beam(out, slot, a, b, w, h, colors[tone]);
const ring = (x, y, z, w, d) => [
  [x - w / 2, y, z - d / 2],
  [x - w / 2, y, z + d / 2],
  [x + w / 2, y, z + d / 2],
  [x + w / 2, y, z - d / 2],
];

function depth(x) {
  if (x < body[0] - 0.001 || x > body[1] + 0.001) return 0.16;
  if (x <= layout.mainStart) return 2.25;
  const j = supports.findIndex((p) => p.x >= x);
  const a = supports[j - 1],
    b = supports[j],
    t = (x - a.x) / (b.x - a.x),
    atSupport = (p) => (p.main ? 6.3 : 2.25);
  const pier = t <= 0.5 ? a : b,
    d = 2 * Math.min(t, 1 - t),
    middle = 2.37;
  return mix(middle, atSupport(pier), Math.pow(1 - d, 2));
}
function stations(tier) {
  const main = supports
    .slice(20)
    .flatMap((p, i, all) => (i === 0 ? [p.x] : [mix(all[i - 1].x, p.x, 0.5), p.x]));
  const west = supports
    .slice(0, 20)
    .filter((_, i) => tier > 0 || i % 3 === 0)
    .map((p) => p.x);
  const retained = [...outer, ...body, layout.bendX, ...west, ...main];
  if (tier > 1) retained.push(...deck.map((p) => p[0]));
  else retained.push(...deck.filter(([, y], i) => i % 6 === 0 && y > 10).map((p) => p[0]));
  if (tier > 1)
    for (let i = 21; i < supports.length; i++) {
      const a = supports[i - 1].x,
        b = supports[i].x;
      retained.push(mix(a, b, 0.25), mix(a, b, 0.75));
    }
  // Keep one station when a profile knot and a structural division share a coordinate.
  return [...new Set(retained.map((x) => +x.toFixed(5)))].sort((a, b) => a - b);
}
function deckMesh(out, tier) {
  const w = halfWidth,
    edge = 5.83,
    rows = stations(tier);
  const section = (x, d) => [
    at(x, -w, -0.11),
    at(x, -w, -0.47),
    at(x, -3.09, -d),
    at(x, 3.09, -d),
    at(x, w, -0.47),
    at(x, w, -0.11),
  ];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      mid = (a + b) * 0.5,
      inBody = mid >= body[0] && mid <= body[1];
    if (tier === 0) strip(out, 'paving', 'asphalt', a, b, -w, w);
    else {
      strip(out, 'paving', 'asphalt', a, b, -edge, edge);
      for (const side of [-1, 1]) {
        const z = side * edge,
          outerZ = side * w;
        strip(out, 'paving', 'walk', a, b, Math.min(z, outerZ), Math.max(z, outerZ), 0.14);
        quad(out, 'girder', 'face', at(a, z), at(b, z), at(b, z, 0.14), at(a, z, 0.14), [
          0,
          0,
          -side,
        ]);
      }
    }
    if (!inBody) continue;
    const A = section(a, depth(a)),
      B = section(b, depth(b));
    for (let j = 1; j < A.length; j++) {
      if (tier === 0 && (j === 1 || j === 5)) continue;
      const j0 = tier === 0 && j === 2 ? 0 : j - 1,
        j1 = tier === 0 && j === 4 ? 5 : j;
      quad(
        out,
        'girder',
        j === 3 ? 'soffit' : j === 1 || j === 5 ? 'face' : 'shell',
        A[j0],
        A[j1],
        B[j1],
        B[j0],
        [0, -0.71, j < 3 ? -1 : j > 3 ? 1 : 0],
      );
    }
    if (tier > 0)
      for (const side of [-1, 1]) {
        quad(
          out,
          'girder',
          'face',
          at(a, side * w, -0.12),
          at(b, side * w, -0.12),
          at(b, side * w, 0.14),
          at(a, side * w, 0.14),
          [0, 0, side],
        );
        if (tier > 1)
          strip(out, 'metal', 'white', a, b, side * 4.64 - 0.048, side * 4.64 + 0.048, 0.011);
      }
  }
  if (tier > 0)
    for (const x of body) {
      const d = depth(x),
        v = section(x, d),
        normal = [x < 0 ? -1 : 1, 0, 0];
      for (let j = 1; j < v.length; j++)
        triangle(out, 'girder', 'shell', [at(x, 0, -0.11), v[j - 1], v[j]], normal);
    }
  if (tier > 1) {
    for (let x = outer[0] + 2.4; x < outer[1] - 6; x += 12) {
      strip(out, 'metal', 'white', x, x + 4, -0.052, 0.052, 0.016);
    }
    for (const x of layout.joints) {
      strip(out, 'metal', 'joint', x - 0.104, x + 0.104, -edge, edge, 0.022);
      if (tier > 2)
        for (const j of [-0.151, 0.151])
          strip(out, 'metal', 'lamp', x + j - 0.031, x + j + 0.031, -edge, edge, 0.0225);
    }
  }
}
function pierMesh(out, tier) {
  for (const p of supports) {
    const { x, z, top, base, w, d, main, bank, transition } = p;
    if (tier === 0) {
      loft(
        out,
        'girder',
        [ring(x, base, z, w, d), ring(x, top + 0.2, z, w, d)],
        colors[bank ? 'footing' : 'pier'],
      );
      continue;
    }
    const head = main ? 1.65 : bank ? 0.72 : 0.82,
      footTop = Math.min(top - head - 0.27, base + (main ? 2.64 : 1.45));
    loft(
      out,
      'girder',
      [
        ring(x, base, z, w * (bank ? 1.1 : 1.29), d * (bank ? 1 : 1.28)),
        ring(x, footTop, z, w * (bank ? 1.1 : 1.29), d * (bank ? 1 : 1.28)),
      ],
      colors.footing,
    );
    loft(
      out,
      'girder',
      [
        ring(x, footTop - 0.06, z, w, d),
        ring(x, top - head, z, w * (main ? 0.93 : 0.97), d),
        ring(x, top + 0.13, z, w * (bank ? 1 : 1.18), bank ? d : main ? d + 0.66 : d + 1.46),
      ],
      colors.pier,
    );
    if (tier > 1 && (bank || transition || !main)) {
      for (const sign of [-1, 1]) {
        const center = z + sign * (bank ? 4.25 : 1.68);
        loft(
          out,
          'paving',
          [ring(x, top + 0.115, center, 0.77, 1.31), ring(x, top + 0.24, center, 0.77, 1.31)],
          colors.joint,
        );
      }
    }
    if (tier > 2 && main) {
      for (const sign of [-1, 1]) {
        const face = z + sign * (d / 2 + 0.002),
          y = top - head - 0.36;
        quad(
          out,
          'girder',
          'shell',
          [x - w * 0.465, y, face],
          [x + w * 0.465, y, face],
          [x + w * 0.465, y + 0.029, face],
          [x - w * 0.465, y + 0.029, face],
          [0, 0, sign],
        );
      }
    }
  }
}
function embankments(out) {
  for (const rows of layout.approachFills)
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      for (const side of [-1, 1]) {
        const top = (r) => at(r.x, side * r.top[2], -0.038);
        const toe = (r) => [r.x, r.toe[side === -1 ? 0 : 1], r.top[1] + side * r.skirt];
        quad(out, 'paving', 'dirt', top(a), toe(a), toe(b), top(b), [0, 1, side]);
      }
    }
}
function parapets(out, tier) {
  const w = halfWidth - 0.17,
    rows = stations(tier).filter((x) => x >= body[0] - 0.001 && x <= body[1] + 0.001);
  for (const side of [-1, 1]) {
    const z = side * w;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      if (tier < 2) {
        quad(out, 'metal', 'rail', at(a, z, 0.92), at(b, z, 0.92), at(b, z, 1.17), at(a, z, 1.17), [
          0,
          0,
          side,
        ]);
      } else {
        rod(out, 'metal', 'rail', at(a, z, 1.16), at(b, z, 1.16), 0.108, 0.091);
        rod(out, 'metal', 'redDark', at(a, z, 0.49), at(b, z, 0.49), 0.054, 0.056);
      }
    }
    const pitch = [0, 15, 7, 3.68, 3.3][tier];
    if (tier > 0)
      for (let x = body[0] + pitch / 2; x < body[1] - 0.3; x += pitch) {
        if (tier < 3) {
          quad(
            out,
            'metal',
            'rail',
            at(x - 0.052, z, 0.14),
            at(x + 0.052, z, 0.14),
            at(x + 0.052, z, 1.16),
            at(x - 0.052, z, 1.16),
            [0, 0, side],
          );
        } else {
          rod(out, 'metal', 'rail', at(x, z, 0.16), at(x, z, 1.16), 0.076, 0.086);
          if (tier === 4)
            rod(out, 'metal', 'redDark', at(x - 0.13, z, 0.16), at(x + 0.13, z, 0.16), 0.15, 0.043);
        }
      }
  }
}
function furniture(out, tier) {
  if (tier < 1) return;
  for (let i = 0, x = body[0] + 29; x < body[1] - 10; x += 54, i++) {
    const side = i % 2 ? 1 : -1,
      z = side * (halfWidth - 0.47),
      base = at(x, z, 0.17),
      pole = at(x, z, 8.5),
      arm = at(x, z - side * 1.58, 9.21);
    if (tier === 1) {
      quad(
        out,
        'metal',
        'lamp',
        at(x - 0.115, z, 0.17),
        at(x + 0.115, z, 0.17),
        at(x + 0.069, z, 8.56),
        at(x - 0.069, z, 8.56),
        [0, 0, side],
      );
    } else {
      loft(out, 'metal', [ring(...base, 0.217, 0.217), ring(...pole, 0.109, 0.109)], colors.lamp);
      rod(out, 'metal', 'lamp', pole, at(x, z - side * 0.6, 9.12), 0.11);
      rod(out, 'metal', 'lamp', at(x, z - side * 0.6, 9.12), arm, 0.085);
      rod(out, 'metal', 'lamp', arm, at(x, z - side * 2.17, 9.21), 0.29, 0.15);
      if (tier > 2) {
        rod(
          out,
          'metal',
          'reflector',
          at(x, z - side * 1.69, 9.118),
          at(x, z - side * 2.12, 9.118),
          0.196,
          0.029,
        );
        rod(out, 'metal', 'redDark', at(x, z, 0.22), at(x, z, 0.33), 0.31, 0.31);
      }
    }
  }
  if (tier > 2)
    for (const side of [-1, 1]) {
      for (let x = body[0] + 17; x < body[1] - 15; x += 25) {
        rod(
          out,
          'metal',
          'joint',
          at(x, side * (halfWidth - 0.34), -0.65),
          at(x, side * (halfWidth - 0.34), -0.18),
          0.19,
          0.18,
        );
      }
    }
}
export function buildKassuendeLevel(out, level) {
  const tier = tiers[level];
  deckMesh(out, tier);
  pierMesh(out, tier);
  embankments(out);
  parapets(out, tier);
  furniture(out, tier);
}
export const buildKassuendeSkyline = (out) => buildKassuendeLevel(out, 'skyline');
export const buildKassuendeDistrict = (out) => buildKassuendeLevel(out, 'district');
export const buildKassuendeStreet = (out) => buildKassuendeLevel(out, 'street');
export const buildKassuendeCloseup = (out) => buildKassuendeLevel(out, 'closeup');

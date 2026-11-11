/** Curved NH1 viaduct and open, yellow-stayed Tsubasa Bridge pylons. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.9 },
  road: { slot: 'wall', graph: 'gravel', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.24 },
};
const tint = {
  concrete: [0.56, 0.53, 0.46],
  tower: [0.82, 0.78, 0.68],
  pier: [0.48, 0.46, 0.4],
  fascia: [0.67, 0.64, 0.57],
  deck: [0.16, 0.18, 0.18],
  walk: [0.52, 0.5, 0.44],
  metal: [0.36, 0.38, 0.36],
  dark: [0.17, 0.19, 0.18],
  white: [0.84, 0.82, 0.72],
  stripe: [0.83, 0.58, 0.18],
  stay: [0.75, 0.58, 0.23],
  base: [0.39, 0.38, 0.33],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';
const { sections, width, bearings, supports, portals } = layout;
const half = width * 0.5;
const mix = (a, b, t) => a + (b - a) * t;
const up = [0, 1, 0],
  down = [0, -1, 0];
function sectionAt(x) {
  const j = sections.findIndex((s) => s.x >= x);
  if (j <= 0) return sections.at(j);
  const [a, b] = sections.slice(j - 1, j + 1),
    t = (x - a.x) / (b.x - a.x);
  return {
    x,
    y: mix(a.y, b.y, t),
    center: mix(a.center, b.center, t),
    angle: mix(a.angle, b.angle, t),
  };
}
export const deckY = (x) => sectionAt(x).y;
const point = (s, offset, rise = 0) => [
  s.x - Math.sin(s.angle) * offset,
  s.y + rise,
  s.center + Math.cos(s.angle) * offset,
];
const bar = (out, slot, tone, a, b, width, depth = width) =>
  beam(out, slot, a, b, width, depth, tint[tone]);
function quad(out, slot, tone, a, b, c, d, normal) {
  for (let face of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...face);
    if (n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0) {
      face = face.toReversed();
      n = normalFor(...face);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, face, n, undefined, tint[tone]);
  }
}
const strip = (out, slot, tone, a, b, left, right, rise = 0, n = up) =>
  quad(
    out,
    slot,
    tone,
    point(a, left, rise),
    point(b, left, rise),
    point(b, right, rise),
    point(a, right, rise),
    n,
  );

function roadway(out, tier) {
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1],
      b = sections[i];
    strip(out, 'road', 'deck', a, b, -half, half);
    strip(out, 'concrete', 'fascia', a, b, -half * 0.59, half * 0.59, -2.45, down);
    for (const side of [-1, 1]) {
      const edge = side * half,
        box = edge * 0.59,
        n = [0, 0, side];
      quad(
        out,
        'concrete',
        'fascia',
        point(a, edge, 0.11),
        point(b, edge, 0.11),
        point(b, box, -2.45),
        point(a, box, -2.45),
        n,
      );
      if (tier === 0) continue;
      strip(out, 'concrete', 'walk', a, b, side * (half - 1.43), edge, 0.135);
      const outer = side * (half - 0.21),
        inner = side * (half - 0.51);
      quad(
        out,
        'concrete',
        'concrete',
        point(a, inner, 0.135),
        point(b, inner, 0.135),
        point(b, inner, 0.78),
        point(a, inner, 0.78),
        [0, 0, -side],
      );
      strip(out, 'concrete', 'fascia', a, b, inner, outer, 0.78);
      quad(
        out,
        'concrete',
        'concrete',
        point(a, outer, 0.135),
        point(b, outer, 0.135),
        point(b, outer, 0.78),
        point(a, outer, 0.78),
        n,
      );
      if (tier >= 2) bar(out, 'metal', 'metal', point(a, outer, 1.1), point(b, outer, 1.1), 0.084);
    }
    if (tier >= 2) {
      strip(out, 'metal', 'stripe', a, b, -0.062, 0.062, 0.018);
      for (const side of [-1, 1])
        strip(out, 'metal', 'white', a, b, side * (half - 1.55), side * (half - 1.68), 0.018);
    }
  }
  for (const [s, sign] of [
    [sections[0], -1],
    [sections.at(-1), 1],
  ]) {
    quad(
      out,
      'concrete',
      'fascia',
      point(s, -half, 0),
      point(s, half, 0),
      point(s, half * 0.59, -2.45),
      point(s, -half * 0.59, -2.45),
      [sign, 0, 0],
    );
  }
  if (tier < 2) return;
  const [first, last] = layout.ends;
  const interval = tier >= 3 ? 3.8 : 11.4;
  for (let x = first + 6; x < last - 5; x += interval) {
    const s = sectionAt(x);
    for (const side of [-1, 1]) {
      const z = side * (half - 0.21);
      bar(out, 'metal', 'metal', point(s, z, 0.77), point(s, z, 1.1), 0.055);
      if (tier >= 4) {
        const panel = sectionAt(x + 0.03);
        bar(
          out,
          'concrete',
          'base',
          point(panel, z - side * 0.24, 0.17),
          point(panel, z - side * 0.24, 0.77),
          0.023,
          0.024,
        );
      }
    }
  }
  for (let x = first + 22, i = 0; x < last - 19; x += 39, i++) {
    const s = sectionAt(x),
      side = i % 2 === 0 ? 1 : -1,
      z = side * (half - 0.8);
    bar(out, 'metal', 'metal', point(s, z, 0.12), point(s, z, 9.2), 0.22, 0.25);
    bar(out, 'metal', 'metal', point(s, z, 9.2), point(s, z - side * 1.9, 9.48), 0.124, 0.15);
    bar(
      out,
      'metal',
      'white',
      point(s, z - side * 1.86, 9.47),
      point(s, z - side * 2.39, 9.45),
      0.16,
      0.25,
    );
  }
}
function mass(out, tone, rows, tier, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rings = rows.map(([x, y, z, w, d]) => {
    const flat =
      tier > 0
        ? chamferedRectangle(0, y, 0, w, d, Math.min(w, d) * 0.083)
        : [
            [-w * 0.5, y, -d * 0.5],
            [-w * 0.5, y, d * 0.5],
            [w * 0.5, y, d * 0.5],
            [w * 0.5, y, -d * 0.5],
          ];
    return flat.map(([a, b, q]) => [x + c * a - s * q, b, z + s * a + c * q]);
  });
  loft(out, 'concrete', rings, tint[tone]);
}
function viaduct(out, tier) {
  for (const { x, z, grade, deck, angle } of bearings) {
    mass(
      out,
      'concrete',
      [
        [x, grade - 1.4, z, 4.3, width - 0.4],
        [x, deck - 0.45, z, 3.7, width - 0.55],
      ],
      tier,
      angle,
    );
  }
  for (const { x, z, grade, deck, angle } of supports) {
    const y = deck - 2.45;
    if (y <= grade + 0.3) continue;
    const foot = [x, grade - 1.6, z, 5.8, 6.1],
      cap = [x, y, z, 5.4, 12.15];
    const shoulder = [x, Math.max(grade + 0.08, y - 3.0), z, 4.8, 6.5];
    mass(out, 'pier', tier === 0 ? [foot, cap] : [foot, shoulder, cap], tier > 1 ? 1 : 0, angle);
    if (tier >= 3) {
      const s = { x, y, center: z, angle };
      for (const side of [-1, 1])
        bar(
          out,
          'metal',
          'dark',
          point(s, side * 2.5, -0.28),
          point(s, side * 4.4, -0.28),
          2.85,
          0.34,
        );
    }
  }
}
function crossbeam(out, x, z, y, tier) {
  const halfSpan = half + 0.25,
    halfLength = 2.3;
  const cuts = tier === 0 ? [-1, 1] : [-1, -0.62, -0.27, 0, 0.27, 0.62, 1];
  const p = (u, t, high) => [
    x + u * halfLength,
    high ? y + 1.1 : y - 1.6 + (1 - t * t) * 0.68,
    z + t * halfSpan,
  ];
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i];
    quad(
      out,
      'concrete',
      'tower',
      p(-1, a, true),
      p(1, a, true),
      p(1, b, true),
      p(-1, b, true),
      up,
    );
    quad(
      out,
      'concrete',
      'tower',
      p(-1, a, false),
      p(1, a, false),
      p(1, b, false),
      p(-1, b, false),
      down,
    );
    for (const side of [-1, 1])
      quad(
        out,
        'concrete',
        'tower',
        p(side, a, false),
        p(side, b, false),
        p(side, b, true),
        p(side, a, true),
        [side, 0, 0],
      );
  }
}
function distantStay(out, a, b) {
  const a0 = [a[0], a[1] - 0.28, a[2]],
    a1 = [a[0], a[1] + 0.28, a[2]];
  const b0 = [b[0], b[1] - 0.28, b[2]],
    b1 = [b[0], b[1] + 0.28, b[2]];
  for (const side of [-1, 1]) quad(out, 'metal', 'stay', a0, b0, b1, a1, [0, 0, side]);
}
function mainSpan(out, tier) {
  for (const { x, z, deck, height, base, fanCables, sideReach, centerReach } of portals) {
    const cross = deck + (height - deck) * 0.6;
    for (const side of [-1, 1]) {
      const legZ = (h) =>
        z + side * mix(half + 1.29, half - 0.83, Math.max(0, (h - deck) / (height - deck)));
      const foot = [x, base, legZ(deck), 9.5, 8.0],
        neck = [x, deck - 2.7, legZ(deck), 6.5, 4.2];
      const upper = [x, cross, legZ(cross), 4.25, 2.75],
        tip = [x - 0.61, height, legZ(height), 1.03, 0.48];
      mass(
        out,
        'tower',
        tier === 0
          ? [foot, neck, upper, tip]
          : [
              foot,
              [x, base + 3.5, legZ(deck), 8.05, 5.9],
              neck,
              upper,
              [x, height - 7.2, legZ(height - 7.2), 3.25, 1.79],
              [x - 0.35, height - 2.3, legZ(height - 2.3), 2.32, 1.17],
              tip,
            ],
        tier,
      );
      for (const direction of [-1, 1]) {
        const count = tier === 0 ? 4 : tier === 1 ? 10 : fanCables;
        const reach = (direction < 0 ? x < 0 : x > 0) ? sideReach : centerReach;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1),
            y = mix(deck + 24, height - 7.7, t);
          const a = [x + direction * 1.49, y, legZ(y)],
            b = point(sectionAt(x + direction * mix(29, reach, t)), side * (half - 1.29), 0.4);
          if (tier === 0) distantStay(out, a, b);
          else bar(out, 'metal', 'stay', a, b, tier === 1 ? 0.26 : 0.183);
          if (tier >= 2) {
            const near = b.map((q, j) => mix(q, a[j], 0.025));
            bar(out, 'metal', 'metal', b, near, 0.36, 0.39);
            if (tier >= 4) {
              const short = a.map((q, j) => mix(q, b[j], 0.008));
              bar(out, 'metal', 'dark', a, short, 0.29, 0.31);
            }
          }
        }
      }
    }
    crossbeam(out, x, z, cross, tier);
    crossbeam(out, x, z, deck - 3.1, tier === 0 ? 0 : 1);
  }
}
export function buildBridgeLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw Error('Unknown Neak Loeung Bridge level ' + level);
  roadway(out, tier);
  viaduct(out, tier);
  mainSpan(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

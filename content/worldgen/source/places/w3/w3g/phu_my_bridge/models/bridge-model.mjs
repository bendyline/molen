/** Phú Mỹ Bridge deck, graded viaducts, and paired H-shaped cable-stay pylons. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.88 },
  road: { slot: 'wall', graph: 'gravel', roughness: 0.94 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.3 },
};
const tint = {
  concrete: [0.58, 0.57, 0.52],
  tower: [0.75, 0.74, 0.68],
  pier: [0.57, 0.55, 0.5],
  fascia: [0.61, 0.61, 0.55],
  steel: [0.29, 0.33, 0.33],
  deck: [0.17, 0.18, 0.18],
  path: [0.43, 0.43, 0.38],
  white: [0.77, 0.78, 0.72],
  stay: [0.13, 0.34, 0.54],
  joint: [0.12, 0.14, 0.14],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';
const { sections, supports, portals } = layout;
const lerp = (a, b, t) => a + (b - a) * t;
const center = ({ center }) => center;
function sectionAt(x) {
  const i = sections.findIndex((s) => s.x >= x);
  if (i <= 0) return sections.at(i);
  const [a, b] = sections.slice(i - 1, i + 1);
  const t = (x - a.x) / (b.x - a.x);
  return {
    x,
    y: lerp(a.y, b.y, t),
    center: lerp(a.center, b.center, t),
    edges: a.edges.map((z, i) => lerp(z, b.edges[i], t)),
  };
}
export function deckY(x) {
  const i = layout.deck.findIndex((q) => q[0] >= x);
  if (i <= 0) return layout.deck.at(i)[1];
  const [a, b] = layout.deck.slice(i - 1, i + 1);
  return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}
const p = (s, z, h = 0) => [s.x, deckY(s.x) + h, z];
const rod = (out, slot, tone, a, b, w, h = w) => beam(out, slot, a, b, w, h, tint[tone]);
function quad(out, slot, tone, a, b, c, d, dir) {
  for (let tri of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...tri);
    if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
      tri = tri.toReversed();
      n = normalFor(...tri);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, tri, n, undefined, tint[tone]);
  }
}
function band(out, slot, tone, a, b, left, right, h = 0, n = [0, 1, 0]) {
  quad(
    out,
    slot,
    tone,
    p(a, left(a), h),
    p(b, left(b), h),
    p(b, right(b), h),
    p(a, right(a), h),
    n,
  );
}
function deck(out, tier) {
  const deckSections = sections;
  for (let i = 1; i < deckSections.length; i++) {
    const a = deckSections[i - 1],
      b = deckSections[i];
    const edge = (n) => (s) => s.edges[n];
    band(out, 'road', 'deck', a, b, edge(0), edge(1));
    band(out, 'concrete', 'fascia', a, b, edge(0), edge(1), -0.68, [0, -1, 0]);
    for (const sign of [-1, 1]) {
      const e = edge(sign < 0 ? 0 : 1);
      const inset = (d) => (s) => e(s) - sign * Math.min(d, Math.abs(e(s) - s.center) * 0.86);
      quad(
        out,
        'concrete',
        'fascia',
        p(a, e(a), 0.14),
        p(b, e(b), 0.14),
        p(b, e(b), -0.68),
        p(a, e(a), -0.68),
        [0, 0, sign],
      );
      const box = (f) => (s) => lerp(s.center, e(s), f);
      quad(
        out,
        'concrete',
        'concrete',
        p(a, box(0.74)(a), -0.66),
        p(b, box(0.74)(b), -0.66),
        p(b, box(0.51)(b), -3.1),
        p(a, box(0.51)(a), -3.1),
        [0, -1, sign],
      );
      band(out, 'concrete', 'concrete', a, b, center, box(0.51), -3.1, [0, -1, 0]);
      if (tier === 0) continue;
      band(out, 'concrete', 'path', a, b, e, inset(0.8), 0.09);
      rod(out, 'steel', 'steel', p(a, inset(0.16)(a), 1.18), p(b, inset(0.16)(b), 1.18), 0.09, 0.1);
      const median = (s) => s.center + sign * 0.38;
      rod(out, 'concrete', 'concrete', p(a, median(a), 0.35), p(b, median(b), 0.35), 0.32, 0.68);
    }
  }
  for (const [i, sign] of [
    [0, -1],
    [sections.length - 1, 1],
  ]) {
    const s = sections[i],
      [a, b] = s.edges;
    quad(
      out,
      'concrete',
      'fascia',
      p(s, a, 0.015),
      p(s, b, 0.015),
      p(s, b, -0.68),
      p(s, a, -0.68),
      [sign, 0, 0],
    );
  }
  if (tier < 2) return;
  const [first, last] = layout.ends;
  for (let x = first + 8; x + 3 < last - 2; x += 11) {
    const a = sectionAt(x),
      b = sectionAt(x + 3);
    for (const sign of [-1, 1]) {
      const t = 0.31;
      const line = (s) => lerp(s.center, s.edges[sign < 0 ? 0 : 1], t);
      band(
        out,
        'steel',
        'white',
        a,
        b,
        (s) => line(s) - 0.065,
        (s) => line(s) + 0.065,
        0.018,
      );
      const shoulder = (s) => lerp(s.center, s.edges[sign < 0 ? 0 : 1], 0.68);
      band(
        out,
        'steel',
        'white',
        a,
        b,
        (s) => shoulder(s) - 0.068,
        (s) => shoulder(s) + 0.068,
        0.018,
      );
    }
  }
  for (let x = first + 15; x < last - 8; x += tier > 2 ? 3.3 : 10.5) {
    const s = sectionAt(x);
    for (const z of s.edges.map((e, i) => e + (i === 0 ? 0.16 : -0.16))) {
      rod(out, 'steel', 'steel', p(s, z, 0.11), p(s, z, 1.2), 0.057);
      if (tier > 2 && x + 3 < last - 4) {
        const b = sectionAt(x + 3),
          i = z < s.center ? 0 : 1;
        rod(
          out,
          'steel',
          'steel',
          p(s, z, 0.47),
          p(b, b.edges[i] + (i === 0 ? 0.16 : -0.16), 0.47),
          0.047,
        );
      }
    }
  }
  for (let x = first + 30; x < last - 24; x += 46) {
    const s = sectionAt(x),
      z = s.center;
    rod(out, 'steel', 'steel', p(s, z, 0.28), p(s, z, 10.4), 0.21, 0.25);
    for (const sign of [-1, 1]) {
      rod(out, 'steel', 'steel', p(s, z, 10.1), p(s, z + sign * 2.5, 10.62), 0.12, 0.13);
      rod(
        out,
        'steel',
        'white',
        p(s, z + sign * 2.5, 10.62),
        p(s, z + sign * 3.18, 10.59),
        0.15,
        0.24,
      );
    }
  }
}
function solid(out, tone, rows, tier) {
  const rings = rows.map(([x, y, z, w, d]) =>
    tier > 0
      ? chamferedRectangle(x, y, z, w, d, Math.min(w, d) * 0.085)
      : [
          [x - w * 0.5, y, z - d * 0.5],
          [x - w * 0.5, y, z + d * 0.5],
          [x + w * 0.5, y, z + d * 0.5],
          [x + w * 0.5, y, z - d * 0.5],
        ],
  );
  loft(out, 'concrete', rings, tint[tone]);
}
function pylons(out, tier) {
  for (const { x, z, grade, deck } of layout.bearings) {
    const inner = x - Math.sign(x) * 1.7;
    solid(
      out,
      'pier',
      [
        [inner, grade - 1.12, z, 5.7, layout.width - 0.88],
        [inner, deck - 0.65, z, 4.8, layout.width - 0.44],
      ],
      tier,
    );
  }
  for (const { x, z, grade, deck } of supports) {
    const bearing = deck - 3.1;
    if (bearing <= grade + 0.7) continue;
    const pier = [
      [x, grade - 1.35, z, 5.2, 8.9],
      [x, lerp(grade, bearing, 0.68), z, 6.7, 9.8],
      [x, bearing, z, 10.2, 17.1],
    ];
    solid(out, 'pier', tier === 0 ? [pier[0], pier[2]] : pier, tier === 1 ? 0 : tier);
    if (tier >= 2)
      rod(
        out,
        'steel',
        'joint',
        [x, bearing - 0.18, z - 5.6],
        [x, bearing - 0.18, z + 5.6],
        4.8,
        0.29,
      );
    if (tier >= 4)
      for (const side of [-1, 1]) {
        rod(
          out,
          'steel',
          'steel',
          [x - 2.4, bearing - 0.35, z + side * 4.5],
          [x + 2.4, bearing - 0.35, z + side * 4.5],
          0.56,
          0.46,
        );
      }
  }
  for (const { x, z, deck, height, base, fanCables, sideReach, centerReach } of portals) {
    const cross = 109;
    const halfWidth = layout.width * 0.5;
    const baseRings = [
      [x, base - 0.6, z, 17.5, 46.0],
      [x, 3.1, z, 16.9, 43.5],
    ];
    solid(out, 'pier', baseRings, tier);
    for (const side of [-1, 1]) {
      const legZ = (h) => z + side * (halfWidth + 2.08 - (h - deck) * 0.07);
      const leg = [
        [x, 2.92, legZ(2.92), 9.3, 5.7],
        [x, deck - 3.1, legZ(deck - 3.1), 7.5, 4.45],
        [x, deck + 1.2, legZ(deck + 1.2), 7.1, 4.2],
        [x, cross - 2.7, legZ(cross - 2.7), 5.4, 3.66],
        [x, height - 3.8, legZ(height - 3.8), 4.2, 2.93],
        [x, height, legZ(height), 3.72, 2.73],
      ];
      solid(out, 'tower', tier === 0 ? [leg[0], leg.at(-1)] : leg, tier);
      for (const direction of [-1, 1]) {
        const count = tier === 0 ? 5 : tier === 1 ? 12 : fanCables,
          reach = Math.sign(x) === direction ? sideReach : centerReach;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1),
            aY = lerp(cross + 1.9, height - 2.8, t),
            a = [x + direction * 2.01, aY, legZ(aY)];
          const station = sectionAt(x + direction * lerp(29, reach, t)),
            b = p(station, station.edges[side < 0 ? 0 : 1] - side * 0.6, 0.63);
          if (tier === 0) {
            const axis = [b[0] - a[0], b[1] - a[1]],
              len = Math.hypot(...axis);
            const dx = (axis[1] * 0.3) / len,
              dy = (-axis[0] * 0.3) / len;
            for (const sign of [-1, 1])
              quad(
                out,
                'steel',
                'stay',
                [a[0] - dx, a[1] - dy, a[2]],
                [b[0] - dx, b[1] - dy, b[2]],
                [b[0] + dx, b[1] + dy, b[2]],
                [a[0] + dx, a[1] + dy, a[2]],
                [0, 0, sign],
              );
          } else rod(out, 'steel', 'stay', a, b, 0.17);
          if (tier >= 2) {
            const near = b.map((q, j) => lerp(q, a[j], 0.019));
            rod(out, 'steel', 'steel', b, near, 0.37, 0.35);
            if (tier >= 4) {
              const head = a.map((q, j) => lerp(q, b[j], 0.007));
              rod(out, 'steel', 'steel', a, head, 0.34, 0.34);
            }
          }
        }
      }
    }
    const top = cross + 2.8,
      baseBottom = cross - 2.8,
      span = 2 * (halfWidth + 2.08 - (cross - deck) * 0.07);
    const points = tier === 0 ? [-1, 1] : [-1, -0.75, 0, 0.75, 1];
    for (let j = 1; j < points.length; j++) {
      const a = points[j - 1],
        b = points[j],
        az = z + a * span * 0.5,
        bz = z + b * span * 0.5;
      const soffit = (t) => baseBottom + 0.34 * (1 - t * t);
      quad(
        out,
        'concrete',
        'tower',
        [x - 2.45, top, az],
        [x + 2.45, top, az],
        [x + 2.45, top, bz],
        [x - 2.45, top, bz],
        [0, 1, 0],
      );
      quad(
        out,
        'concrete',
        'tower',
        [x - 2.45, soffit(a), az],
        [x + 2.45, soffit(a), az],
        [x + 2.45, soffit(b), bz],
        [x - 2.45, soffit(b), bz],
        [0, -1, 0],
      );
      for (const side of [-1, 1]) {
        const px = x + side * 2.45;
        quad(
          out,
          'concrete',
          'tower',
          [px, top, az],
          [px, soffit(a), az],
          [px, soffit(b), bz],
          [px, top, bz],
          [side, 0, 0],
        );
      }
    }
  }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error('Unknown Phú Mỹ Bridge level ' + level);
  deck(out, tier);
  pylons(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

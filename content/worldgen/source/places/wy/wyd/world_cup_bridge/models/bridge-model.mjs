/** World Cup Bridge draft with a single central plane of stays over the Han. */
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
  concrete: [0.53, 0.5, 0.44],
  tower: [0.79, 0.77, 0.69],
  pier: [0.46, 0.44, 0.38],
  fascia: [0.61, 0.61, 0.55],
  steel: [0.29, 0.33, 0.33],
  deck: [0.17, 0.18, 0.18],
  path: [0.43, 0.43, 0.38],
  white: [0.77, 0.78, 0.72],
  stay: [0.71, 0.73, 0.71],
  joint: [0.12, 0.14, 0.14],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';
const { sections, supports, tower } = layout;
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
const p = (s, z, h = 0) => {
  if (!s.bearing) return [s.x, s.y + h, z];
  const j = s.bearing.findIndex((q) => q[1] >= z);
  const i = j < 0 ? s.bearing.length - 1 : Math.max(1, j);
  const [a, b] = s.bearing.slice(i - 1, i + 1);
  const x = lerp(a[0], b[0], (z - a[1]) / (b[1] - a[1]));
  return [x, deckY(x) + h, z];
};
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
  const structuralStations = new Set([
    ...layout.deck.map((q) => q[0]),
    -625,
    -612,
    -575,
    -450.205,
    -205,
    -199,
    47,
    467,
    555,
    625,
  ]);
  const deckSections = tier < 2 ? sections.filter((s) => structuralStations.has(s.x)) : sections;
  for (let i = 1; i < deckSections.length; i++) {
    const a = deckSections[i - 1],
      b = deckSections[i];
    const edge = (n) => (s) => s.edges[n];
    const bearing = a.bearing ? a : b.bearing ? b : null;
    const cuts = bearing
      ? bearing.bearing.map(
          (q) => (q[1] - bearing.edges[0]) / (bearing.edges[1] - bearing.edges[0]),
        )
      : [0, 1];
    const across = (t) => (s) => lerp(s.edges[0], s.edges[1], t);
    for (let j = 1; j < cuts.length; j++) {
      const left = across(cuts[j - 1]),
        right = across(cuts[j]);
      band(out, 'road', 'deck', a, b, left, right);
      band(out, 'concrete', 'fascia', a, b, left, right, -0.68, [0, -1, 0]);
    }
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
      const rampOpening = sign > 0 && a.x >= -211 && b.x <= -199;
      if (!rampOpening) {
        band(out, 'concrete', 'path', a, b, e, inset(1.37), 0.09);
        rod(
          out,
          'steel',
          'steel',
          p(a, inset(0.16)(a), 1.18),
          p(b, inset(0.16)(b), 1.18),
          0.09,
          0.1,
        );
      }
      const median = (s) => lerp(s.center, e(s), 0.035);
      rod(out, 'concrete', 'concrete', p(a, median(a), 0.24), p(b, median(b), 0.24), 0.25, 0.45);
    }
  }
  for (const [i, sign] of [
    [0, -1],
    [sections.length - 1, 1],
  ]) {
    const s = sections[i];
    for (let j = 1; j < s.bearing.length; j++) {
      const a = s.bearing[j - 1][1],
        b = s.bearing[j][1];
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
      if (tier > 1) rod(out, 'steel', 'joint', p(s, a, 0.012), p(s, b, 0.012), 0.16, 0.035);
    }
  }
  if (tier < 2) return;
  const [first, last] = layout.ends;
  for (let x = first + 8; x + 3 < last - 2; x += 11) {
    const a = sectionAt(x),
      b = sectionAt(x + 3);
    for (const sign of [-1, 1])
      for (const t of [0.32, 0.62]) {
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
      }
  }
  for (let x = first + 15; x < last - 8; x += tier > 2 ? 3 : 9) {
    const s = sectionAt(x);
    for (const z of s.edges.map((e, i) => e + (i === 0 ? 0.16 : -0.16))) {
      if (z > s.center && x >= -211 && x <= -199) continue;
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
  for (const { x, z, grade, deck } of supports) {
    const bearing = deck - 3.1;
    if (bearing <= grade + 0.7) continue;
    solid(
      out,
      'pier',
      [
        [x, grade - 1.35, z, 5.2, 8.9],
        [x, lerp(grade, bearing, 0.68), z, 6.7, 9.8],
        [x, bearing, z, 10.2, 17.1],
      ],
      tier,
    );
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
  const { x, z, deck, top, topX, base, footingShoulder } = tower;
  solid(
    out,
    'pier',
    [
      [x, base, z, 20, 26],
      [x, footingShoulder - 0.35, z, 20, 26],
      [x, footingShoulder, z, 16.1, 19],
      [x, deck - 14, z, 18.6, 21.4],
      [x, deck - 3.1, z, 28.2, 26],
    ],
    tier,
  );
  solid(
    out,
    'tower',
    [
      [x, deck - 0.18, z, 9.35, 6.05],
      [x - 2.45, deck + 10, z, 8.58, 5.27],
      [topX + 6.3, top - 24, z, 5.4, 4.12],
      [topX, top, z, 3.2, 3.2],
    ],
    tier,
  );
  if (tier >= 3)
    solid(
      out,
      'concrete',
      [
        [x, deck, z, 9.65, 6.35],
        [x - 0.15, deck + 0.29, z, 9.62, 6.29],
      ],
      tier,
    );
  for (const [side, end] of [
    [-1, tower.frontAnchor],
    [1, tower.backAnchor],
  ]) {
    const count = tier === 0 ? 6 : tower.fanCables;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1),
        aY = lerp(deck + 36, top - 3.25, t),
        aX = lerp(x, topX, (aY - deck) / (top - deck));
      const station = sectionAt(lerp(x + side * 29, end, t));
      const a = [aX + side * 1.28, aY, z],
        b = p(station, station.center, 0.53);
      rod(out, 'steel', 'stay', a, b, tier === 0 ? 0.44 : 0.18);
      if (tier >= 2) {
        const near = b.map((q, i) => lerp(q, a[i], 0.023));
        rod(out, 'steel', 'steel', b, near, 0.36, 0.37);
        if (tier >= 4) {
          const cap = b.map((q, i) => lerp(q, a[i], 0.006));
          rod(out, 'steel', 'joint', b, cap, 0.48, 0.5);
        }
        const head = a.map((q, i) => lerp(q, b[i], 0.008));
        rod(out, 'steel', 'steel', a, head, 0.29, 0.3);
      }
    }
  }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error('Unknown World Cup Bridge level ' + level);
  deck(out, tier);
  pylons(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

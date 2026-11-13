/** The restored Ponte dell'Industria iron trusses and separate cycle edge. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.35 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.92 },
  road: { slot: 'wall', graph: 'gravel', roughness: 0.98 },
};
const colors = {
  iron: [0.18, 0.21, 0.2],
  edge: [0.13, 0.17, 0.16],
  plate: [0.23, 0.25, 0.23],
  rail: [0.33, 0.35, 0.32],
  concrete: [0.55, 0.53, 0.47],
  foot: [0.46, 0.46, 0.4],
  road: [0.19, 0.19, 0.18],
  path: [0.39, 0.4, 0.37],
  white: [0.8, 0.79, 0.72],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const [west, east] = layout.ends,
  [left, right] = layout.edges,
  [roadLeft, roadRight] = layout.roadEdges;
const lerp = (a, b, t) => a + (b - a) * t;
export function deckY(x) {
  const i = layout.deck.findIndex((p) => p[0] >= x);
  if (i <= 0) return layout.deck.at(i)[1] - layout.datum;
  const [a, b] = layout.deck.slice(i - 1, i + 1);
  return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])) - layout.datum;
}
const p = (x, z, h = 0) => [x, deckY(x) + h, z];
const member = (out, slot, tone, a, b, w, h = w) => beam(out, slot, a, b, w, h, colors[tone]);
const steel = (out, tone, a, b, w, h) => member(out, 'steel', tone, a, b, w, h);
function strip(out, slot, tone, x0, x1, z0, z1, depth, offset = 0) {
  const y = (x) => deckY(x) + (typeof offset === 'function' ? offset(x) : offset);
  loft(
    out,
    slot,
    [x0, x1].map((x) => [
      [x, y(x) - depth, z0],
      [x, y(x), z0],
      [x, y(x), z1],
      [x, y(x) - depth, z1],
    ]),
    colors[tone],
  );
}
function deck(out, tier) {
  for (let i = 1; i < layout.deck.length; i++) {
    const x0 = layout.deck[i - 1][0],
      x1 = layout.deck[i][0];
    strip(out, 'road', 'road', x0, x1, left, right, 0.36);
    for (const z of [left + 0.45, right - 0.45])
      strip(out, 'steel', 'edge', x0, x1, z - 0.29, z + 0.29, 0.98, -0.27);
    if (tier === 0) continue;
    const cuts = [x0, ...[west + 2, east - 2].filter((x) => x > x0 && x < x1), x1];
    for (let j = 1; j < cuts.length; j++) {
      const a = cuts[j - 1],
        b = cuts[j],
        curb = (x) => 0.09 * Math.min(1, (x - west) / 2, (east - x) / 2);
      strip(out, 'concrete', 'path', a, b, left, roadLeft, 0.15, curb);
      strip(out, 'concrete', 'path', a, b, roadRight, right, 0.15, curb);
    }
    for (const z of [left + 0.12, right - 0.12]) {
      steel(out, 'rail', p(x0, z, 1.09), p(x1, z, 1.09), 0.08, 0.065);
      if (tier >= 2) steel(out, 'rail', p(x0, z, 0.21), p(x1, z, 0.21), 0.048);
    }
  }
  strip(out, 'road', 'road', west - 0.85, west, left, -2.55, 0.16, -0.002);
  strip(out, 'road', 'road', west - 0.85, west, 3.05, right, 0.16, -0.002);
  if (tier === 0) return;
  const postStep = tier === 1 ? 4.0 : tier === 2 ? 1.9 : 1.2;
  for (let x = west + 1.15; x < east - 0.95; x += postStep)
    for (const z of [left + 0.12, right - 0.12])
      steel(out, 'rail', p(x, z, 0.1), p(x, z, 1.1), 0.052);
  if (tier < 2) return;
  for (let x = west + 3; x < east - 3; x += 8.5)
    strip(out, 'steel', 'white', x, x + 2, -0.05, 0.05, 0.006, 0.014);
  for (let x = west + 5; x < east - 2; x += 4.1) {
    steel(out, 'edge', p(x, left + 0.36, -1.06), p(x, right - 0.36, -1.06), 0.17, 0.29);
    for (const z of [left + 0.44, right - 0.44])
      strip(out, 'steel', 'plate', x - 0.11, x + 0.11, z - 0.41, z + 0.41, 0.63, -0.33);
  }
  for (let x = west + 11; x < east - 9; x += 25) {
    const z = right - 0.4;
    steel(out, 'iron', p(x, z, 0.12), p(x, z, 5.4), 0.105);
    steel(out, 'iron', p(x, z, 5.4), p(x, z - 0.55, 5.8), 0.082);
    steel(out, 'rail', p(x, z - 0.54, 5.8), p(x, z - 0.85, 5.8), 0.13, 0.12);
  }
}
function trusses(out, tier) {
  for (const { start, end, rise } of layout.archSpans) {
    const nodes = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8,
        x = lerp(start, end, t),
        h = rise * [0, 0.5, 0.78, 0.94, 1, 0.94, 0.78, 0.5, 0][i] + 0.65;
      return { x, h };
    }).filter((_, i) => tier > 0 || i % 2 === 0);
    for (const z of [roadLeft + 0.08, roadRight + 0.12]) {
      steel(out, 'iron', p(start, z, 0.45), p(end, z, 0.45), 0.34, 0.6);
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1],
          b = nodes[i];
        steel(out, 'iron', p(a.x, z, a.h), p(b.x, z, b.h), 0.38, 0.52);
        if (tier > 0 && i < nodes.length - 1)
          steel(out, 'iron', p(b.x, z, b.h), p(b.x, z, 0.45), 0.18, 0.26);
        const upper = i <= nodes.length / 2 ? b : a,
          lower = i <= nodes.length / 2 ? a : b;
        steel(out, 'iron', p(upper.x, z, upper.h), p(lower.x, z, 0.45), 0.17, 0.24);
        if (tier < 2) continue;
        const outZ = z + Math.sign(z) * 0.15;
        for (const h of [0.48, b.h]) {
          const y = deckY(b.x) + h;
          steel(out, 'plate', [b.x - 0.29, y, outZ], [b.x + 0.29, y, outZ], 0.055, 0.5);
          if (tier >= 3)
            for (const dx of [-0.18, 0, 0.18])
              for (const dy of [-0.135, 0.135])
                sphere(
                  out,
                  'steel',
                  [b.x + dx, y + dy, outZ + Math.sign(z) * 0.038],
                  [0.044, 0.044, 0.026],
                  colors.plate,
                  6,
                  tier === 4 ? 4 : 3,
                );
        }
      }
    }
    if (tier >= 1)
      for (const i of [2, 4, 6]) {
        const n = nodes[i];
        steel(
          out,
          'iron',
          p(n.x, roadLeft + 0.08, n.h - 0.28),
          p(n.x, roadRight + 0.12, n.h - 0.28),
          0.22,
          0.3,
        );
      }
  }
  if (tier >= 1) {
    const a = layout.archSpans[0].end,
      b = layout.archSpans[1].start;
    for (const z of [roadLeft + 0.08, roadRight + 0.12]) {
      steel(out, 'edge', p(a, z, 1.05), p(b, z, 1.05), 0.2, 0.29);
      for (let i = 0; i < 12; i++)
        steel(
          out,
          'iron',
          p(lerp(a, b, i / 12), z, i % 2 ? 0.13 : 1.04),
          p(lerp(a, b, (i + 1) / 12), z, i % 2 ? 1.04 : 0.13),
          0.1,
          0.16,
        );
    }
  }
}
function supports(out, tier) {
  const sides = tier === 0 ? 6 : tier === 1 ? 8 : 14;
  for (const { x, feet } of layout.supports) {
    const top = deckY(x) - 1.2;
    for (const { z, base } of feet) {
      const foundation = base - layout.datum;
      loft(
        out,
        'concrete',
        [
          [foundation, 0.99],
          [foundation + 0.4, 1.03],
          [top - 0.62, 0.77],
          [top, 0.9],
        ].map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
        colors.foot,
      );
    }
    loft(
      out,
      'concrete',
      [
        chamferedRectangle(x, top - 0.66, 0, 2.1, 9.1, 0.27),
        chamferedRectangle(x, top + 0.15, 0, 2.7, 10, 0.34),
      ],
      colors.concrete,
    );
  }
  for (const x of [west + 1.55, east - 1.55]) {
    const y = deckY(x) - 0.36;
    loft(
      out,
      'concrete',
      [
        chamferedRectangle(x, y - 6.5, 0, 3.2, 10, 0.29),
        chamferedRectangle(x, y, 0, 3, 10.05, 0.29),
      ],
      colors.concrete,
    );
  }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Ponte dell'Industria level ${level}`);
  deck(out, tier);
  trusses(out, tier);
  supports(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

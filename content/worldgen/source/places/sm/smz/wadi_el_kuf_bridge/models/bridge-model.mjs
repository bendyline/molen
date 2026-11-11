/** Photo-based model of the paired concrete towers and straight gorge crossing. */
import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.91 },
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.04 },
};
const colors = {
  concrete: [0.71, 0.7, 0.632],
  bright: [0.78, 0.76, 0.673],
  weather: [0.51, 0.5, 0.445],
  soffit: [0.46, 0.45, 0.402],
  asphalt: [0.2, 0.209, 0.211],
  shoulder: [0.335, 0.337, 0.318],
  rail: [0.45, 0.467, 0.448],
  steel: [0.27, 0.281, 0.259],
  paint: [0.83, 0.819, 0.756],
  joint: [0.12, 0.123, 0.119],
  pad: [0.39, 0.398, 0.374],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const rod = (out, s, t, a, b, w, h = w) => beam(out, s, a, b, w, h, colors[t]);

function triangle(out, slot, tone, points, preferred) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * preferred[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
}
function quad(out, s, t, a, b, c, d, n) {
  triangle(out, s, t, [a, b, c], n);
  triangle(out, s, t, [a, c, d], n);
}
function rowAt(rows, x) {
  const i = rows.findIndex((p) => p[0] >= x);
  if (i === 0) return rows[0].slice(1);
  if (i < 0) return rows.at(-1).slice(1);
  const [a, b] = rows.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((p, j) => mix(p, b[j + 1], t));
}
export const deckAt = (x) => rowAt(layout.deck, x);
const at = (x, z, offset = 0) => {
  const [y, c] = deckAt(x),
    [west, east] = layout.outer,
    [westSkew, eastSkew] = layout.bankSkews;
  const skew =
    x < west + 16
      ? westSkew * (1 - (x - west) / 16)
      : x > east - 16
        ? eastSkew * (1 - (east - x) / 16)
        : 0;
  return [x + skew * z, y + offset, c + z];
};

function section([x, y, z], w, d) {
  return [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
}
function tapered(out, slot, tone, a, b, start, end) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, [0, 0, 1])),
    other = cross(axis, across);
  const ring = (c, [w, h]) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => c.map((v, k) => v + (i * w * across[k]) / 2 + (j * h * other[k]) / 2));
  loft(out, slot, [ring(a, start), ring(b, end)], colors[tone]);
}
function footing(out, { corners, floor, top }, tone = 'weather') {
  loft(
    out,
    'concrete',
    [
      corners.toReversed().map(([x, z], i) => [x, Math.min(floor[3 - i], top - 0.54), z]),
      corners.toReversed().map(([x, z]) => [x, top, z]),
    ],
    colors[tone],
  );
}
function prism(out, slot, tone, x, z0, z1, y0, y1, w) {
  loft(
    out,
    slot,
    [section([x, y0, (z0 + z1) / 2], w, z1 - z0), section([x, y1, (z0 + z1) / 2], w, z1 - z0)],
    colors[tone],
  );
}
function roadStrip(out, slot, tone, a, b, z0, z1, dy) {
  quad(out, slot, tone, at(a, z0, dy), at(a, z1, dy), at(b, z1, dy), at(b, z0, dy), up);
}

const girderDepth = [
  [layout.outer[0], 0.3],
  [-243.1, 0.74],
  [-238.7, 2.58],
  [-200, 2.82],
  [-169, 3.27],
  [-147, 3.83],
  [-122, 3.18],
  [-43, 2.47],
  [-41, 2.12],
  [41, 2.12],
  [43, 2.48],
  [113, 3.23],
  [136, 3.77],
  [159.2, 3.22],
  [201, 2.88],
  [238.7, 2.58],
  [243.1, 0.78],
  [layout.outer[1], 0.3],
];
function deck(out, tier) {
  const w = layout.halfWidth,
    stations = [
      ...new Set([...layout.deck.map((p) => p[0]), ...girderDepth.map((p) => p[0])]),
    ].sort((a, b) => a - b);
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      da = rowAt(girderDepth, a)[0],
      db = rowAt(girderDepth, b)[0];
    const topA = [
      at(a, -w, -0.14),
      at(a, -w, -0.67),
      at(a, -w * 0.68, -da),
      at(a, w * 0.68, -da),
      at(a, w, -0.67),
      at(a, w, -0.14),
    ];
    const topB = [
      at(b, -w, -0.14),
      at(b, -w, -0.67),
      at(b, -w * 0.68, -db),
      at(b, w * 0.68, -db),
      at(b, w, -0.67),
      at(b, w, -0.14),
    ];
    const roadEdge = 4.92;
    roadStrip(out, 'deck', 'asphalt', a, b, -roadEdge, roadEdge, 0);
    roadStrip(out, 'deck', 'shoulder', a, b, -w, -roadEdge, 0);
    roadStrip(out, 'deck', 'shoulder', a, b, roadEdge, w, 0);
    for (let j = 1; j < topA.length; j++) {
      const tone = j === 3 ? 'soffit' : j === 2 || j === 4 ? 'weather' : 'bright';
      quad(out, 'concrete', tone, topA[j - 1], topA[j], topB[j], topB[j - 1], [
        0,
        -0.6,
        j < 3 ? -1 : j > 3 ? 1 : 0,
      ]);
    }
    for (const side of [-1, 1]) {
      const z = side * w;
      quad(
        out,
        'concrete',
        'bright',
        at(a, z, -0.22),
        at(b, z, -0.22),
        at(b, z, 0.16),
        at(a, z, 0.16),
        [0, 0, side],
      );
      quad(
        out,
        'concrete',
        'bright',
        at(a, z, 0.16),
        at(b, z, 0.16),
        at(b, z - side * 0.29, 0.16),
        at(a, z - side * 0.29, 0.16),
        up,
      );
      const level = tier === 0 ? 0.65 : 0.91,
        inner = z - side * 0.095;
      if (tier < 2) {
        quad(
          out,
          'metal',
          'rail',
          at(a, inner, level - 0.14),
          at(b, inner, level - 0.14),
          at(b, inner, level),
          at(a, inner, level),
          [0, 0, side],
        );
      } else rod(out, 'metal', 'rail', at(a, inner, 0.89), at(b, inner, 0.89), 0.12, 0.17);
    }
    if (tier > 0) {
      for (const z of [-3.85, 3.85])
        roadStrip(out, 'metal', 'paint', a, b, z - 0.052, z + 0.052, 0.011);
    }
  }
  for (const side of [-1, 1]) {
    const step = tier === 0 ? 24 : tier === 1 ? 5.8 : tier === 2 ? 2.7 : tier === 3 ? 1.66 : 1.32,
      z = side * (w - 0.125),
      ends = layout.outer;
    for (let x = ends[0] + step / 2; x < ends[1] - 0.18; x += step) {
      if (tier === 0) {
        quad(
          out,
          'metal',
          'rail',
          at(x - 0.082, z, 0.1),
          at(x + 0.082, z, 0.1),
          at(x + 0.082, z, 0.6),
          at(x - 0.082, z, 0.6),
          [0, 0, side],
        );
      } else {
        rod(out, 'metal', 'steel', at(x, z, 0.13), at(x, z, 0.96), 0.09, 0.14);
        if (tier >= 3)
          rod(
            out,
            'metal',
            'steel',
            at(x, z - side * 0.06, 0.17),
            at(x, z - side * 0.06, 0.26),
            0.3,
            0.19,
          );
      }
    }
    if (tier >= 3)
      for (let i = 1; i < stations.length; i++) {
        const a = stations[i - 1],
          b = stations[i];
        rod(out, 'metal', 'rail', at(a, z, 0.47), at(b, z, 0.47), 0.064, 0.065);
      }
  }
  if (tier > 0) {
    for (let x = layout.outer[0] + 2; x < layout.outer[1] - 3.5; x += 9)
      roadStrip(out, 'metal', 'paint', x, x + 3.5, -0.056, 0.056, 0.012);
  }
  if (tier >= 2) {
    for (const x of [-239, -43, 43, 239]) {
      roadStrip(out, 'metal', 'joint', x - 0.11, x + 0.11, -6.08, 6.08, 0.019);
      if (tier >= 3)
        for (const j of [-0.17, 0.17])
          roadStrip(out, 'metal', 'rail', x + j - 0.025, x + j + 0.025, -6.12, 6.12, 0.02);
    }
  }
}
function towers(out, tier) {
  for (const tower of layout.towers) {
    const { x, deckY: y, peak, baseHalf, upperHalf, topHalf, arm, brace } = tower;
    for (const foot of tower.footings) {
      const { side, cap } = foot,
        z = side * baseHalf,
        mid = side * upperHalf,
        apex = side * topHalf;
      footing(out, { ...foot, top: cap });
      const rings = [
        [[x, cap - 0.46, z], 5.25, 3.68],
        [[x, cap + 5.2, z], 4.98, 3.54],
        [[x, y - 1.85, mid], 3.94, 3.38],
        [[x + 0.1, y + 8.7, mid * 0.86], 3.64, 2.9],
        [[x + 0.34, peak - 6.2, apex + side * 0.65], 2.74, 1.94],
        [[x + 0.32, peak, apex], 2.46, 1.63],
      ];
      const levels = tier === 0 ? [rings[0], rings[2], rings.at(-1)] : rings;
      loft(
        out,
        'concrete',
        levels.map(([p, w, d]) => section(p, w, d)),
        colors.concrete,
      );
      // The under-deck V spreads from the tower base to two separate deck seats.
      const branch = cap + Math.min(8.1, (y - cap) * 0.29),
        root = [x, branch, z * 0.9];
      for (const a of brace) {
        const ySeat = deckAt(a)[0] - 2.79,
          end = [a, ySeat, side * 5.43];
        tapered(out, 'concrete', 'bright', root, end, [3.22, 2.74], [2.06, 2.28]);
        if (tier >= 2)
          prism(
            out,
            'concrete',
            'weather',
            a,
            end[2] - 1.31,
            end[2] + 1.31,
            ySeat - 0.28,
            ySeat + 0.62,
            2.95,
          );
      }
      for (const a of arm) {
        const isInner = Math.abs(a) < 100,
          anchorZ = side * (layout.halfWidth - 0.87);
        const heel = [a, deckAt(a)[0] - 0.17, anchorZ],
          tip = [x + 0.32, peak - 0.94, apex];
        tapered(out, 'concrete', 'bright', heel, tip, [1.47, 1.54], [1.38, 1.42]);
        if (tier > 0) {
          const offset = side * 0.81,
            p = heel.map((v, i) => (i === 2 ? v + offset : v)),
            q = tip.map((v, i) => (i === 2 ? v + offset * 0.72 : v));
          rod(out, 'metal', 'rail', p, q, 0.12, 0.14);
        }
        if (tier >= 2) {
          const base = deckAt(a)[0];
          prism(
            out,
            'concrete',
            'weather',
            a,
            anchorZ - 0.72,
            anchorZ + 0.72,
            base - 0.38,
            base + 0.5,
            isInner ? 3.02 : 2.59,
          );
          if (tier >= 3)
            prism(
              out,
              'metal',
              'rail',
              a,
              anchorZ - 0.51,
              anchorZ + 0.51,
              base + 0.5,
              base + 0.66,
              1.71,
            );
        }
      }
      if (tier >= 2) {
        const sideZ = mid + side * 1.19;
        rod(
          out,
          'concrete',
          'weather',
          [x - 0.76, y - 1.55, sideZ],
          [x - 0.12, peak - 10.1, apex + side * 1.86],
          0.069,
          0.08,
        );
        rod(
          out,
          'concrete',
          'bright',
          [x + 0.44, y - 1.6, sideZ],
          [x + 0.65, peak - 8, apex + side * 1.61],
          0.075,
          0.085,
        );
      }
    }
    prism(out, 'concrete', 'bright', x + 0.32, -1.88, 1.88, peak - 1.05, peak + 0.46, 2.52);
    if (tier >= 1) {
      rod(
        out,
        'concrete',
        'weather',
        [x, y - 3.55, -upperHalf],
        [x, y - 3.55, upperHalf],
        1.9,
        2.6,
      );
      if (tier >= 2)
        prism(out, 'metal', 'steel', x + 0.37, -0.65, 0.65, peak + 0.46, peak + 0.64, 1.52);
    }
  }
}
function abutments(out, tier) {
  for (const a of layout.abutments) {
    footing(out, a, 'weather');
    prism(out, 'concrete', 'bright', a.x, -7.39, 7.39, a.top - 0.63, a.top + 0.27, 5.82);
    if (tier >= 2) {
      for (const z of [-3.3, 3.3])
        prism(out, 'metal', 'pad', a.x, z - 0.83, z + 0.83, a.top + 0.23, a.top + 0.44, 2.21);
      for (const side of [-1, 1]) {
        const direction = Math.sign(a.x),
          p = [a.x + direction * 1.28, a.top - 0.88, side * 6.58],
          q = [a.x + direction * 14.8, deckAt(a.x + direction * 14.8)[0] - 0.47, side * 7.32];
        tapered(out, 'concrete', 'weather', p, q, [1.17, 2.6], [0.53, 1.03]);
      }
    }
  }
}

export function buildWadiLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Wadi el Kuf Bridge tier ${level}`);
  deck(out, tier);
  abutments(out, tier);
  towers(out, tier);
}
export const buildWadiSkyline = (out) => buildWadiLevel(out, 'skyline');
export const buildWadiDistrict = (out) => buildWadiLevel(out, 'district');
export const buildWadiStreet = (out) => buildWadiLevel(out, 'street');
export const buildWadiCloseup = (out) => buildWadiLevel(out, 'closeup');

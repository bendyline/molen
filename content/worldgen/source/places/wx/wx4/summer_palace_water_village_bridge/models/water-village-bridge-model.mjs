import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, up } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  masonry: { slot: 'foundation', graph: 'stone_ashlar' },
  dressed: { slot: 'trim', graph: 'stone_granite' },
};

const { deck, ends, openings, width, horizon } = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url), 'utf8'),
);
const half = width / 2;
const footing = -2.12;
const thickness = 0.33;
const ashlar = [0.559, 0.535, 0.507];
const base = [0.489, 0.472, 0.452];
const agedPale = [0.704, 0.683, 0.643];
const cutStone = [0.635, 0.611, 0.576];
const recess = [0.547, 0.527, 0.501];

function deckAt(x) {
  for (let i = 1; i < deck.length; i++) {
    const [right, a] = deck[i];
    if (x <= right) {
      const [left, b] = deck[i - 1];
      return b + ((x - left) * (a - b)) / (right - left);
    }
  }
  return deck.at(-1)[1];
}

function crossSection(left, right, leftY, rightY, inner, outer) {
  return [
    [left, leftY, inner],
    [right, rightY, inner],
    [right, rightY, outer],
    [left, leftY, outer],
  ];
}

function bridgeSlab(out, detail) {
  const [first] = ends[0];
  const [last] = ends[1];
  for (let i = 1; i < deck.length; i++) {
    const [left, low] = deck[i - 1];
    const [right, high] = deck[i];
    const top = crossSection(left, right, low, high, -half, half);
    const underside = top.map(([x, y, z]) => [x, y - thickness, z]);
    face(out, 'dressed', top, agedPale, up);
    face(out, 'masonry', underside, ashlar, [0, -1, 0]);
    for (const side of [-1, 1]) {
      const z = side * half;
      face(
        out,
        'masonry',
        [
          [left, low - thickness, z],
          [right, high - thickness, z],
          [right, high, z],
          [left, low, z],
        ],
        ashlar,
        [0, 0, side],
      );
      if (detail) {
        beam(
          out,
          'dressed',
          [left, low - 0.087, z],
          [right, high - 0.087, z],
          0.08,
          0.099,
          cutStone,
        );
      }
    }
  }
  for (const [x, y, sign] of [
    [first, deckAt(first), -1],
    [last, deckAt(last), 1],
  ]) {
    face(
      out,
      'masonry',
      [
        [x, y - thickness, -half],
        [x, y - thickness, half],
        [x, y, half],
        [x, y, -half],
      ],
      ashlar,
      [sign, 0, 0],
    );
  }
  if (detail < 2) return;
  for (let i = 1; i < 21; i++) {
    const x = first + ((last - first) * i) / 21;
    beam(
      out,
      'dressed',
      [x, deckAt(x) + 0.001, -half + 0.158],
      [x, deckAt(x) + 0.001, half - 0.158],
      0.018,
      0.003,
      recess,
    );
  }
}

function masonrySupports(out, detail) {
  const supports = [[-6.38, openings[0].start]];
  for (let i = 1; i < openings.length; i++) {
    supports.push([openings[i - 1].end, openings[i].start]);
  }
  supports.push([openings.at(-1).end, 6.42]);
  for (const [i, [a, b]] of supports.entries()) {
    const top = Math.min(deckAt(a), deckAt(b)) - thickness + 0.055;
    const core = i === 1 || i === 2;
    const z = core ? half - 0.06 : half + 0.023;
    box(out, 'masonry', [a, footing, -z], [b, top, z], ashlar);
    if (!detail) continue;
    for (const [bottom, height, offset] of [
      [footing, 0.15, 0.063],
      [-0.39, 0.165, 0.056],
      [top - 0.142, 0.104, 0.059],
    ]) {
      box(
        out,
        'masonry',
        [a - offset, bottom, -z - offset],
        [b + offset, bottom + height, z + offset],
        base,
      );
    }
    if (detail < 2) continue;
    for (const [row, y] of [-1.35, -0.86, -0.32].entries()) {
      for (const side of [-1, 1]) {
        const surface = side * (z + 0.003);
        beam(
          out,
          'dressed',
          [a + 0.011, y, surface],
          [b - 0.011, y, surface],
          0.005,
          0.012,
          recess,
        );
        if (core) {
          const x = a + (b - a) * (row % 2 ? 0.44 : 0.62);
          beam(out, 'dressed', [x, y - 0.41, surface], [x, y, surface], 0.005, 0.009, recess);
        }
      }
    }
  }
}

function parapetPanel(out, left, right, h, side, detail) {
  const floorLeft = deckAt(left);
  const floorRight = deckAt(right);
  const z = side * (half - 0.104);
  const topLeft = floorLeft + h;
  const topRight = floorRight + h;
  const surface = side * (half - 0.005);
  for (const [depth, sign, offset] of [
    [surface, side, 0],
    [side * (half - 0.219), -side, 0.008],
  ]) {
    face(
      out,
      'dressed',
      [
        [left, floorLeft, depth],
        [right, floorRight, depth],
        [right, topRight - offset, depth],
        [left, topLeft - offset, depth],
      ],
      agedPale,
      [0, 0, sign],
    );
  }
  beam(out, 'dressed', [left, topLeft, z], [right, topRight, z], 0.251, 0.076, cutStone);
  if (detail < 2) return;
  for (const faceSide of [-1, 1]) {
    const depth = z + faceSide * 0.112;
    const panelLeft = left + 0.14;
    const panelRight = right - 0.14;
    const bottom = 0.127;
    const top = h - 0.118;
    const at = (x, y) => [x, deckAt(x) + y, depth];
    for (const [a, b] of [
      [at(panelLeft, bottom), at(panelRight, bottom)],
      [at(panelRight, bottom), at(panelRight, top)],
      [at(panelRight, top), at(panelLeft, top)],
      [at(panelLeft, top), at(panelLeft, bottom)],
    ]) {
      beam(out, 'dressed', a, b, detail >= 3 ? 0.023 : 0.018, detail >= 3 ? 0.028 : 0.018, recess);
    }
  }
}

function parapets(out, detail) {
  const edges = [-6.22, -4.66, -2.77, -0.98, 0.98, 2.77, 4.66, 6.22];
  const heights = [0.47, 0.555, 0.62, 0.674, 0.62, 0.555, 0.47];
  for (const side of [-1, 1]) {
    for (let i = 0; i < heights.length; i++) {
      parapetPanel(out, edges[i], edges[i + 1], heights[i], side, detail);
    }
    for (const [i, x] of edges.entries()) {
      const y = deckAt(x);
      const z = side * (half - 0.104);
      const height = Math.max(heights[i] ?? 0, heights[i - 1] ?? 0);
      box(out, 'dressed', [x - 0.052, y, z - 0.121], [x + 0.052, y + height, z + 0.121], cutStone);
    }
    for (const sign of [-1, 1]) {
      const inward = sign * 6.18;
      const outward = sign * 6.75;
      const low = deckAt(outward);
      const high = deckAt(inward);
      const z = side * (half - 0.105);
      for (const [depth, normal] of [
        [z + side * 0.105, side],
        [z - side * 0.105, -side],
      ]) {
        face(
          out,
          'dressed',
          [
            [outward, low, depth],
            [inward, high, depth],
            [inward, high + 0.47, depth],
            [outward, low + 0.14, depth],
          ],
          agedPale,
          [0, 0, normal],
        );
      }
      beam(
        out,
        'dressed',
        [outward, low + 0.14, z],
        [inward, high + 0.47, z],
        0.228,
        0.056,
        cutStone,
      );
      box(
        out,
        'dressed',
        [outward - 0.038, low, z - 0.106],
        [outward + 0.038, low + 0.152, z + 0.106],
        agedPale,
      );
      if (detail < 3) continue;
      const scroll = (t) => {
        const r = 0.111 - 0.062 * t;
        const angle = t * 4.65;
        return [
          sign * (6.49 + r * Math.cos(angle)),
          deckAt(sign * 6.49) + 0.269 + r * Math.sin(angle),
          side * (half + 0.012),
        ];
      };
      for (let i = 1; i <= 12; i++) {
        beam(out, 'dressed', scroll((i - 1) / 12), scroll(i / 12), 0.015, 0.021, recess);
      }
    }
  }
}

function build(out, detail) {
  bridgeSlab(out, detail);
  masonrySupports(out, detail);
  parapets(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

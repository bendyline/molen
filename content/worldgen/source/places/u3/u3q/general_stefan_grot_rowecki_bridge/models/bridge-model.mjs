/** Twin box-girder decks and braced widening wings over the Vistula. */
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
  road: { slot: 'wall', graph: 'gravel', roughness: 0.95 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.31 },
};
const tint = {
  concrete: 'aaa89b',
  deck: 'bfc0b4',
  path: 'a69f89',
  pathEdge: 'c9c2ac',
  surface: '5b6160',
  stripe: 'd8d7c5',
  girder: '868981',
  under: '737970',
  steel: '596064',
  rail: '9da69f',
  lamp: '828b84',
  head: 'b7b8a3',
  sign: '527059',
  black: '404a49',
  waterStain: '898a7c',
};
const colors = Object.fromEntries(
  Object.entries(tint).map(([key, hex]) => [
    key,
    hex.match(/../g).map((b) => {
      const c = parseInt(b, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
export function deckY(x) {
  const j = layout.deck.findIndex((p) => x <= p[0]);
  if (j <= 0) return layout.deck.at(j)[1];
  const [a, b] = layout.deck.slice(j - 1, j + 1);
  return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}
const P = (x, z, y = 0) => [x, deckY(x) + y, z];
const W = layout.width * 0.5,
  mid = layout.medianGap * 0.5;
const rod = (out, material, tint, a, b, width, depth = width) =>
  beam(out, material, a, b, width, depth, colors[tint]);
function quad(out, slot, tone, a, b, c, d, dir) {
  for (let t of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...t);
    if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
      t = t.toReversed();
      n = normalFor(...t);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, t, n, undefined, colors[tone]);
  }
}
function band(out, slot, tone, a, b, left, right, y = 0, n = up) {
  quad(out, slot, tone, P(a, left, y), P(b, left, y), P(b, right, y), P(a, right, y), n);
}
function deck(out, tier) {
  for (let i = 1; i < layout.deck.length; i++) {
    const a = layout.deck[i - 1][0],
      b = layout.deck[i][0];
    for (const s of [-1, 1]) {
      const inner = [mid, -0.45],
        outer = [W, -0.47],
        box = [mid + 0.65, 3.28, 14.7, 16.42];
      band(out, 'road', 'surface', a, b, s * mid, s * 20.1);
      band(out, 'concrete', 'path', a, b, s * 20.1, s * W, 0.08);
      band(out, 'concrete', 'girder', a, b, s * mid, s * W, -0.44, down);
      for (const [z, h, n] of [
        [inner[0], inner[1], -s],
        [outer[0], outer[1], s],
      ])
        quad(
          out,
          'concrete',
          'deck',
          P(a, s * z, 0.08),
          P(b, s * z, 0.08),
          P(b, s * z, h),
          P(a, s * z, h),
          [0, 0, n],
        );
      band(out, 'concrete', 'under', a, b, s * box[1], s * box[2], -2.86, down);
      for (const [z, Z] of [
        [box[0], box[1]],
        [box[3], box[2]],
      ])
        quad(
          out,
          'concrete',
          'girder',
          P(a, s * z, -0.42),
          P(b, s * z, -0.42),
          P(b, s * Z, -2.86),
          P(a, s * Z, -2.86),
          down,
        );
      if (tier === 0) continue;
      for (const [z, w] of [
        [mid + 0.11, 0.22],
        [10.37, 0.46],
        [19.93, 0.31],
      ])
        rod(out, 'concrete', 'deck', P(a, s * z, 0.28), P(b, s * z, 0.28), w, 0.55);
      for (const z of [mid + 0.58, 9.92, 10.91, 19.4])
        band(out, 'steel', 'stripe', a, b, s * (z - 0.058), s * (z + 0.058), 0.017);
      band(out, 'concrete', 'pathEdge', a, b, s * 20.14, s * 20.31, 0.087);
      rod(
        out,
        'steel',
        'rail',
        P(a, s * (W - 0.15), 1.19),
        P(b, s * (W - 0.15), 1.19),
        0.085,
        0.088,
      );
      if (tier >= 2)
        rod(
          out,
          'steel',
          'rail',
          P(a, s * (W - 0.15), 0.29),
          P(b, s * (W - 0.15), 0.29),
          0.051,
          0.072,
        );
    }
  }
  for (const x of layout.ends)
    for (const s of [-1, 1]) {
      const n = [Math.sign(x), 0, 0];
      quad(
        out,
        'concrete',
        'deck',
        P(x, s * mid, 0.08),
        P(x, s * W, 0.08),
        P(x, s * W, -0.47),
        P(x, s * mid, -0.47),
        n,
      );
      quad(
        out,
        'concrete',
        'girder',
        P(x, s * (mid + 0.65), -0.46),
        P(x, s * 16.42, -0.46),
        P(x, s * 14.7, -2.86),
        P(x, s * 3.28, -2.86),
        n,
      );
    }
}
function bent(out, slot, tone, x, z, rows, cut) {
  const rings = rows.map(([y, w, d]) =>
    cut
      ? chamferedRectangle(x, y, z, w, d, cut)
      : [
          [x - w * 0.5, y, z - d * 0.5],
          [x - w * 0.5, y, z + d * 0.5],
          [x + w * 0.5, y, z + d * 0.5],
          [x + w * 0.5, y, z - d * 0.5],
        ],
  );
  loft(out, slot, rings, colors[tone]);
}
function supports(out, tier) {
  for (const row of layout.piers) {
    const { x } = row,
      y = deckY(x),
      cap = y - 2.86;
    for (const s of [-1, 1]) {
      const z = s * 9.55,
        grade = s < 0 ? row.left : row.right,
        foot = grade - 1.75;
      if (tier > 0)
        bent(
          out,
          'concrete',
          'waterStain',
          x,
          z,
          [
            [foot, 7.4, 16.1],
            [grade + 0.51, 7.36, 16.1],
          ],
          0.55,
        );
      for (const cz of [s * 4.87, s * 14.2]) {
        const leg =
          tier === 0
            ? [
                [foot, 5.83, 5.73],
                [cap, 3.74, 3.4],
              ]
            : [
                [foot, 5.83, 5.73],
                [cap - 0.12, 3.69, 3.28],
                [cap, 3.74, 3.4],
              ];
        bent(out, 'concrete', 'concrete', x, cz, leg, tier > 0 ? 0.44 : 0);
        if (tier >= 2)
          bent(
            out,
            'steel',
            'black',
            x,
            cz,
            [
              [cap - 0.38, 3.51, 3.06],
              [cap - 0.06, 3.49, 3.08],
            ],
            0.17,
          );
      }
      bent(
        out,
        'concrete',
        'concrete',
        x,
        z,
        [
          [foot, 5.44, 8.35],
          [mix(grade, cap, 0.56), 4.02, 8.22],
        ],
        tier > 0 ? 0.3 : 0,
      );
    }
  }
  for (const { x, left, right } of layout.abutments)
    for (const s of [-1, 1]) {
      const z = s * (mid + W) * 0.5,
        y = deckY(x),
        grade = s < 0 ? left : right;
      bent(
        out,
        'concrete',
        'concrete',
        x,
        z,
        [
          [grade - 1.38, 5.64, W - mid],
          [y - 2.42, 5.25, W - mid],
          [y - 0.38, 4.65, W - mid],
        ],
        tier > 0 ? 0.26 : 0,
      );
    }
}
function brace(out, tier) {
  const [a, b] = layout.ends,
    step = tier === 1 ? 20.3 : tier === 2 ? 10.4 : tier === 3 ? 6.4 : 5.5;
  if (tier === 0) return;
  for (let x = a + step * 0.5; x < b - 2; x += step)
    for (const s of [-1, 1]) {
      rod(out, 'steel', 'steel', P(x, s * 15.39, -2.43), P(x, s * (W - 0.43), -0.49), 0.23, 0.26);
      if (tier >= 2)
        rod(out, 'steel', 'steel', P(x, s * 16.16, -0.48), P(x, s * (W - 0.43), -0.48), 0.23, 0.34);
      if (tier >= 3)
        rod(
          out,
          'steel',
          'steel',
          P(x, s * 15.69, -2.4),
          P(x + 2.51, s * 16.25, -0.48),
          0.14,
          0.16,
        );
    }
}
function fittings(out, tier) {
  if (tier < 2) return;
  const [a, b] = layout.ends,
    pitch = tier === 2 ? 9.3 : tier === 3 ? 3.45 : 2.9;
  for (let x = a + pitch * 0.57; x < b - 0.3; x += pitch)
    for (const s of [-1, 1]) {
      const z = s * (W - 0.16);
      rod(out, 'steel', 'rail', P(x, z, 0.08), P(x, z, 1.19), 0.066, 0.088);
      if (tier >= 3)
        for (const shift of [0.66, 1.32, 1.98, 2.64])
          if (x + shift < b)
            rod(out, 'steel', 'rail', P(x + shift, z, 0.28), P(x + shift, z, 1.19), 0.034, 0.032);
    }
  for (let x = a + 7; x < b - 9; x += 15.7)
    for (const s of [-1, 1])
      for (const z of [4.96, 14.97])
        band(out, 'steel', 'stripe', x, x + 4.26, s * (z - 0.065), s * (z + 0.065), 0.019);
  for (let x = a + 23; x < b - 12; x += 42)
    for (const s of [-1, 1]) {
      const z = s * 22.91;
      rod(out, 'steel', 'lamp', P(x, z, 0.09), P(x, z, 8.88), 0.15, 0.153);
      rod(out, 'steel', 'lamp', P(x, z, 8.84), P(x, z - s * 1.48, 9.22), 0.116, 0.116);
      rod(
        out,
        'steel',
        'head',
        P(x, z - s * 1.48, 9.22),
        P(x + 0.02, z - s * 1.86, 9.2),
        0.14,
        0.22,
      );
    }
  if (tier >= 3)
    for (const [x, s] of [
      [-112, -1],
      [202, 1],
    ]) {
      rod(out, 'steel', 'lamp', P(x, s * 19.88, 0), P(x, s * 19.88, 6.74), 0.25, 0.33);
      rod(out, 'steel', 'lamp', P(x, s * 10.57, 0), P(x, s * 10.57, 6.74), 0.23, 0.33);
      rod(out, 'steel', 'lamp', P(x, s * 10.57, 6.74), P(x, s * 19.88, 6.74), 0.24, 0.37);
      const n = [-s, 0, 0];
      quad(
        out,
        'steel',
        'sign',
        P(x - 0.04, s * 12.08, 4.98),
        P(x - 0.04, s * 18.44, 4.98),
        P(x - 0.04, s * 18.44, 6.59),
        P(x - 0.04, s * 12.08, 6.59),
        n,
      );
    }
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Grot-Rowecki Bridge level ${level}`);
  deck(out, tier);
  supports(out, tier);
  brace(out, tier);
  fittings(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

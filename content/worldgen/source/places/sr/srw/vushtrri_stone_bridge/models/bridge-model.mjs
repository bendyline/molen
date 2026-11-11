/** The dry Vushtrri bridge has uneven pointed vaults, a rounded belt and upright coping stones. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.92 },
  dressings: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.88 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tint = {
  body: 'a4987e',
  belt: 'ae9f82',
  soffit: '776e5a',
  path: '9e947d',
  mortar: '827765',
  ash: 'a29a84',
  gray: '918c7a',
  amber: 'b7a78a',
  dark: '8c816c',
  olive: '918e71',
  crown: 'b4a688',
  buff: 'b69f84',
  rust: 'a08065',
  warm: 'a78d70',
};
const palette = Object.fromEntries(
  Object.entries(tint).map(([key, hex]) => [
    key,
    hex.match(/../g).map((byte) => {
      const c = parseInt(byte, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const stone = ['ash', 'gray', 'amber', 'dark', 'olive', 'crown'];
const archStone = ['buff', 'rust', 'warm', 'ash', 'buff'];
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const floor = -2.55,
  fascia = 0.19;
const mix = (a, b, t) => a + (b - a) * t;
const noise = (i, j) =>
  (((Math.imul(i + 2191, 1987) ^ Math.imul(j + 709, 12713)) >>> 0) % 1009) / 1009;
const choice = (items, a, b) => items[Math.floor(noise(a, b) * items.length)];
function value(table, x) {
  for (let i = 1; i < table.length; i++) {
    const [b, v] = table[i];
    if (x <= b) {
      const [a, u] = table[i - 1];
      return mix(u, v, Math.max(0, (x - a) / (b - a)));
    }
  }
  return table.at(-1)[1];
}
export const deckY = (x) => value(layout.deck, x);
export const bridgePoint = (x, y, z = 0) => [x, y, z + value(layout.centerline, x)];
const at = (x, z, dy = 0) => bridgePoint(x, deckY(x) + dy, z);
const half = (x) => layout.halfWidth + 0.3 * Math.max(0, (Math.abs(x) - 56) / 9.81);
const normalSide = (side) => [0, 0, side];
function archY([center, halfSpan, spring, rise], x) {
  const q = Math.min(1, Math.abs(x - center) / halfSpan);
  const t = 0.3 + 0.7 * q;
  return spring + rise * Math.sqrt((1 - t * t) / 0.91);
}
function tri(out, surface, color, points, direction) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, c, i) => sum + c * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  out.addTriangle(surface, ref, points, n, undefined, palette[color]);
}
function quad(out, surface, color, a, b, c, d, direction) {
  tri(out, surface, color, [a, b, c], direction);
  tri(out, surface, color, [a, c, d], direction);
}
function sidePanel(out, mat, color, side, a, b, ya, yb, za, zb, offset = 0) {
  const x = side * (half(a) + offset),
    z = side * (half(b) + offset);
  quad(
    out,
    mat,
    color,
    bridgePoint(a, ya, x),
    bridgePoint(b, yb, z),
    bridgePoint(b, zb, z),
    bridgePoint(a, za, x),
    normalSide(side),
  );
}
function arcStations(arch, n) {
  const [center, w] = arch;
  return Array.from(
    { length: n + 1 },
    (_, i) => center + w * (i === n / 2 ? 0 : Math.cos(Math.PI - (i * Math.PI) / n)),
  );
}
function masonry(out, tier) {
  const pieces = [];
  let last = layout.body[0];
  for (const arch of layout.arches) {
    const xs = arcStations(arch, [8, 12, 20, 26, 34][tier]);
    pieces.push({ a: last, b: xs[0], ya: floor, yb: floor });
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      pieces.push({ a, b, ya: archY(arch, a), yb: archY(arch, b), ring: i });
    }
    last = xs.at(-1);
  }
  pieces.push({ a: last, b: layout.body[1], ya: floor, yb: floor });
  for (const [index, { a, b, ya, yb, ring }] of pieces.entries()) {
    for (const side of [-1, 1]) {
      const n = normalSide(side);
      sidePanel(out, 'masonry', 'body', side, a, b, ya, yb, deckY(a) - fascia, deckY(b) - fascia);
      if (ring && tier > 0) {
        const color = tier >= 2 ? choice(archStone, ring, index) : 'warm';
        sidePanel(
          out,
          'dressings',
          color,
          side,
          a,
          b,
          ya,
          yb,
          Math.min(ya + 0.35, deckY(a) - fascia),
          Math.min(yb + 0.35, deckY(b) - fascia),
          0.045,
        );
      }
      if (tier >= 2) courses(out, tier, side, index, a, b, ya, yb, ring);
    }
    if (!ring) {
      for (const [x, direction] of [
        [a, -1],
        [b, 1],
      ]) {
        const y = layout.arches.find(
          ([center, w]) => Math.abs(Math.abs(center - x) - w) < 0.001,
        )?.[2];
        if (y === undefined) continue;
        quad(
          out,
          'masonry',
          'soffit',
          bridgePoint(x, floor, -half(x)),
          bridgePoint(x, floor, half(x)),
          bridgePoint(x, y, half(x)),
          bridgePoint(x, y, -half(x)),
          [direction, 0, 0],
        );
      }
    }
    if (ring)
      quad(
        out,
        'masonry',
        tier > 1 ? choice(['soffit', 'dark', 'mortar'], ring, index) : 'soffit',
        bridgePoint(a, ya, -half(a)),
        bridgePoint(a, ya, half(a)),
        bridgePoint(b, yb, half(b)),
        bridgePoint(b, yb, -half(b)),
        down,
      );
  }
}
function courses(out, tier, side, piece, a, b, ya, yb, ring) {
  const spacing = tier === 2 ? 1.06 : 0.57,
    course = tier === 2 ? 0.53 : 0.31;
  for (let row = 0; row < 26; row++) {
    const y = floor + row * course,
      end = y + course - 0.02;
    if (y >= Math.max(deckY(a), deckY(b)) - fascia || end <= Math.min(ya, yb) + 0.38) continue;
    const shift = (row % 2) * spacing * 0.49;
    for (let col = Math.floor((a - shift) / spacing); col * spacing + shift < b; col++) {
      const jitter = (k) => (noise(k, row) - 0.5) * spacing * 0.39;
      const x = Math.max(a, col * spacing + shift + jitter(col) + 0.018);
      const X = Math.min(b, (col + 1) * spacing + shift + jitter(col + 1) - 0.018);
      if (X - x < 0.038) continue;
      const limits = (s) => {
        const cap = deckY(s) - fascia - 0.023,
          base = mix(ya, yb, (s - a) / (b - a)) + (ring ? 0.375 : 0.035);
        const low = Math.min(cap, Math.max(y, base));
        return [low, Math.max(low, Math.min(end, cap))];
      };
      const [l, h] = limits(x),
        [L, H] = limits(X);
      if (h - l + H - L < 0.037) continue;
      const tone = choice(stone, col, row + (side + 1) * 100);
      sidePanel(
        out,
        'masonry',
        tone,
        side,
        x,
        X,
        l,
        L,
        h,
        H,
        0.009 + 0.025 * noise(col + piece, row),
      );
    }
  }
}
function deck(out, tier) {
  const xs = [
      ...layout.deck.map((p) => p[0]),
      ...layout.centerline.slice(1, -1).map((p) => p[0]),
    ].sort((a, b) => a - b),
    [start, end] = layout.body;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    quad(
      out,
      'paving',
      'path',
      at(a, -half(a)),
      at(a, half(a)),
      at(b, half(b)),
      at(b, -half(b)),
      up,
    );
    if (a >= start && b <= end) continue;
    for (const s of [-1, 1])
      sidePanel(out, 'masonry', 'body', s, a, b, -0.24, -0.22, deckY(a), deckY(b));
  }
  for (const side of [-1, 1]) {
    const n = normalSide(side);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      if (a < start || b > end) continue;
      const z = (x) => side * half(x);
      if (tier > 0) {
        const belt = [
          [-0.2, -0.27],
          [-0.14, -0.17],
          [-0.13, -0.07],
          [-0.02, 0.04],
          [0.09, 0.05],
        ];
        for (let j = 1; j < belt.length; j++) {
          const [w, y] = belt[j - 1],
            [W, Y] = belt[j];
          quad(
            out,
            'dressings',
            'belt',
            at(a, z(a) + side * w, y),
            at(b, z(b) + side * w, y),
            at(b, z(b) + side * W, Y),
            at(a, z(a) + side * W, Y),
            n,
          );
        }
      }
      if (tier < 2) {
        const w = 0.43,
          h = 0.61;
        quad(
          out,
          'masonry',
          'crown',
          at(a, z(a), -0.05),
          at(b, z(b), -0.05),
          at(b, z(b), h),
          at(a, z(a), h),
          n,
        );
        quad(
          out,
          'masonry',
          'ash',
          at(a, z(a), h),
          at(b, z(b), h),
          at(b, z(b) - side * w, h),
          at(a, z(a) - side * w, h),
          up,
        );
        if (tier)
          quad(
            out,
            'masonry',
            'ash',
            at(a, z(a) - side * w, h),
            at(b, z(b) - side * w, h),
            at(b, z(b) - side * w, 0),
            at(a, z(a) - side * w, 0),
            normalSide(-side),
          );
        continue;
      }
      const count = Math.ceil((b - a) / (tier === 2 ? 0.94 : 0.53));
      for (let j = 0; j < count; j++) {
        const len = (b - a) / count,
          k = i * 31 + j;
        const x = a + (j === 0 ? 0 : j + 0.31 * (noise(k, side) - 0.5)) * len + 0.011;
        const X =
          a + (j === count - 1 ? count : j + 1 + 0.31 * (noise(k + 1, side) - 0.5)) * len - 0.011;
        capstone(out, tier, side, k, x, X);
      }
    }
  }
}
function capstone(out, tier, side, index, a, b) {
  const n = normalSide(side),
    top = 0.51 + 0.17 * noise(index, side + 10),
    h = top + 0.055 * (noise(index, side + 19) - 0.5),
    w = 0.41 + 0.08 * noise(index, 17),
    color = choice(stone, index, 23 + side),
    z = (x) => side * half(x);
  const p = (x, offset, y) => at(x, z(x) + side * offset, y);
  const bevel = tier === 2 ? 0 : 0.065;
  const rim = [
    p(a, 0, top - bevel),
    p(b, 0, h - bevel),
    p(b, -w, h - bevel),
    p(a, -w, top - bevel),
  ];
  const upper = [
    p(a + bevel * 0.4, -bevel, top),
    p(b - bevel * 0.4, -bevel, h),
    p(b - bevel * 0.4, -w + bevel, h),
    p(a + bevel * 0.4, -w + bevel, top),
  ];
  const base = [p(a, 0, -0.045), p(b, 0, -0.045), p(b, -w, -0.045), p(a, -w, -0.045)];
  for (const [i, direction] of [n, [1, 0, 0], normalSide(-side), [-1, 0, 0]].entries()) {
    const j = (i + 1) % 4;
    quad(out, 'masonry', color, base[i], base[j], rim[j], rim[i], direction);
    if (bevel) quad(out, 'masonry', color, rim[i], rim[j], upper[j], upper[i], direction);
  }
  quad(out, 'masonry', color, ...upper, up);
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Vushtrri bridge level ${level}`);
  masonry(out, tier);
  deck(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

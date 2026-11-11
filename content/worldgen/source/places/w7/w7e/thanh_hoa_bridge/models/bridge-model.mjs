/** Hàm Rồng's two steel through-trusses carry one track and two outer roadway decks. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.91 },
  road: { slot: 'wall', graph: 'gravel', roughness: 0.93 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.34 },
  sleepers: { slot: 'trim', graph: 'wood_plain', roughness: 0.93 },
};
const tint = {
  deck: 'a7a294',
  paving: '878a82',
  slab: 'a9a799',
  girder: '707971',
  web: '9ca69b',
  chord: 'a9b1a4',
  flange: 'b5bcb0',
  plate: '7d8980',
  rail: 'c2c4b3',
  track: '727c75',
  sleeper: '645e50',
  pier: '87877b',
  wet: '6c746d',
};
const color = Object.fromEntries(
  Object.entries(tint).map(([k, hex]) => [
    k,
    hex.match(/../g).map((b) => {
      const s = parseInt(b, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff';
const lerp = (a, b, t) => a + (b - a) * t;
export function deckY(x) {
  const i = layout.deck.findIndex((p) => p[0] >= x);
  if (i <= 0) return layout.deck.at(i)[1];
  const [[a, y], [b, Y]] = layout.deck.slice(i - 1, i + 1);
  return lerp(y, Y, (x - a) / (b - a));
}
function P(x, z, h = 0) {
  const bank = x < 0 ? 0 : 1,
    end = layout.railEnds[bank],
    from = layout.rail[bank][0];
  // The native ballast renderer adds a small lift at the clip seam. Ease into it only on the track.
  const seat =
    Math.abs(z) <= layout.trackHalf + 0.12
      ? Math.min(1, Math.max(0, (x - from) / (end - from))) * layout.railBedSeat[bank]
      : 0;
  return [x, deckY(x) + h + seat, z];
}
const rod = (out, mat, tone, a, b, w, d = w) => beam(out, mat, a, b, w, d, color[tone]);
function face(out, mat, tone, a, b, c, d, normal) {
  for (let tri of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...tri);
    if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
      tri = tri.toReversed();
      n = normalFor(...tri);
    }
    if (Math.hypot(...n) > 0.5) out.addTriangle(mat, ref, tri, n, undefined, color[tone]);
  }
}
function slab(out, mat, tone, a, b, z0, z1, y, h) {
  const xs = [a, ...layout.deck.map((p) => p[0]).filter((x) => x > a && x < b), b];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1],
      X = xs[i];
    face(out, mat, tone, P(x, z0, y), P(X, z0, y), P(X, z1, y), P(x, z1, y), up);
    if (h <= 0) continue;
    face(
      out,
      'concrete',
      'slab',
      P(x, z0, y - h),
      P(X, z0, y - h),
      P(X, z1, y - h),
      P(x, z1, y - h),
      down,
    );
    for (const [z, sign] of [
      [z0, -1],
      [z1, 1],
    ])
      face(out, 'concrete', 'slab', P(x, z, y), P(X, z, y), P(X, z, y - h), P(x, z, y - h), [
        0,
        0,
        sign,
      ]);
  }
  if (h > 0)
    for (const [x, sign] of [
      [a, -1],
      [b, 1],
    ])
      face(out, 'concrete', 'slab', P(x, z0, y), P(x, z1, y), P(x, z1, y - h), P(x, z0, y - h), [
        sign,
        0,
        0,
      ]);
}
function deck(out, tier) {
  const [railWest, railEast] = layout.railEnds,
    a = railWest - 0.16,
    b = railEast + 0.16,
    W = layout.trackHalf;
  slab(out, 'concrete', 'deck', a, b, -W - 0.12, W + 0.12, -0.035, 0.46);
  for (const [j, side] of [-1, 1].entries()) {
    const [mappedStart, mappedEnd] = layout.roadEnds[j],
      start = mappedStart - 0.16,
      end = mappedEnd + 0.16,
      lo = side * (W + 0.12),
      hi = side * layout.edge;
    slab(out, 'road', 'paving', start, end, Math.min(lo, hi), Math.max(lo, hi), 0, 0.32);
    if (tier === 0) continue;
    const zs = [lo, hi - side * 0.13],
      first = start + 0.72,
      last = end - 0.72,
      xs = [first, ...layout.deck.map((p) => p[0]).filter((x) => x > first && x < last), last];
    for (let i = 1; i < xs.length; i++)
      for (const z of zs) {
        const x = xs[i - 1],
          X = xs[i];
        rod(out, 'steel', 'rail', P(x, z, 1.03), P(X, z, 1.03), 0.092, 0.09);
        if (tier >= 2) rod(out, 'steel', 'rail', P(x, z, 0.23), P(X, z, 0.23), 0.079, 0.079);
      }
    const post = tier === 1 ? 12 : tier === 2 ? 4.2 : tier === 3 ? 2.45 : 1.95;
    for (let x = first + post * 0.45; x < last; x += post)
      for (const z of zs) {
        rod(out, 'steel', 'web', P(x, z, 0.035), P(x, z, 1.03), 0.066, 0.072);
        if (tier >= 3)
          for (const shift of [0.44, 0.88, 1.32, 1.76])
            if (x + shift < last)
              rod(out, 'steel', 'web', P(x + shift, z, 0.23), P(x + shift, z, 1.03), 0.038, 0.037);
      }
  }
  if (tier === 0) return;
  for (const side of [-1, 1]) {
    const z = 0.5 * side,
      xs = [a, ...layout.deck.map((p) => p[0]).filter((x) => x > a && x < b), b];
    for (let i = 1; i < xs.length; i++) {
      rod(
        out,
        'steel',
        'track',
        railPoint(xs[i - 1], z, 0.18),
        railPoint(xs[i], z, 0.18),
        0.074,
        0.115,
      );
      if (tier >= 3)
        rod(
          out,
          'steel',
          'rail',
          railPoint(xs[i - 1], z, 0.238),
          railPoint(xs[i], z, 0.238),
          0.065,
          0.033,
        );
    }
  }
  if (tier >= 2) {
    const pitch = tier === 2 ? 1.3 : tier === 3 ? 0.64 : 0.49;
    for (let x = a + 0.4; x < b - 0.2; x += pitch)
      rod(
        out,
        'sleepers',
        'sleeper',
        railPoint(x, -0.99, 0.042),
        railPoint(x, 0.99, 0.042),
        0.205,
        0.146,
      );
  }
}
function railPoint(x, z, h) {
  const i = x < 0 ? 0 : 1,
    from = layout.rail[i][0],
    end = layout.railEnds[i];
  const t = Math.min(1, Math.max(0, (x - from) / (end - from)));
  return P(x, z + t * layout.railEndOffsets[i], h);
}
function railBanks(out, tier) {
  const width = layout.trackHalf + 0.12;
  for (const samples of layout.railShoulders) {
    const rows =
      tier === 0 ? samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1) : samples;
    for (let i = 1; i < rows.length; i++) {
      const [a, g, G] = rows[i - 1],
        [b, h, H] = rows[i];
      for (const [side, floor, FLOOR] of [
        [-1, g, h],
        [1, G, H],
      ]) {
        const z = side * width,
          y = P(a, z, -0.495)[1],
          Y = P(b, z, -0.495)[1];
        const low = Math.min(y - 0.04, floor - 0.15),
          LOW = Math.min(Y - 0.04, FLOOR - 0.15);
        face(out, 'concrete', 'pier', [a, low, z], [b, LOW, z], [b, Y, z], [a, y, z], [0, 0, side]);
      }
    }
  }
}
function structure(out, tier) {
  for (const [start, end] of layout.spans) {
    const n = tier === 0 ? 6 : 10,
      x = (i) => lerp(start, end, i / n),
      W = layout.trackHalf;
    const upper = (i, s) => P(x(i), s * W, 9.1),
      lower = (i, s) => P(x(i), s * W, 0.3);
    for (const s of [-1, 1]) {
      rod(out, 'steel', 'chord', upper(1, s), upper(n - 1, s), 0.54, 0.66);
      rod(out, 'steel', 'girder', P(start, s * W, -0.41), P(end, s * W, -0.41), 0.64, 0.98);
      rod(out, 'steel', 'chord', lower(0, s), upper(1, s), 0.62, 0.72);
      rod(out, 'steel', 'chord', upper(n - 1, s), lower(n, s), 0.62, 0.72);
      for (let i = 1; i < n - 1; i++) {
        const a = i % 2 ? upper(i, s) : lower(i, s),
          b = i % 2 ? lower(i + 1, s) : upper(i + 1, s);
        rod(out, 'steel', 'web', a, b, 0.39, 0.53);
      }
      if (tier === 0) continue;
      for (let i = 1; i < n; i++) {
        rod(out, 'steel', 'web', lower(i, s), upper(i, s), 0.31, 0.38);
        if (tier >= 2)
          for (const [height, wide] of [
            [0.3, 1.01],
            [9.1, 0.85],
          ]) {
            const side = s * (W + 0.25),
              y = height;
            face(
              out,
              'steel',
              'plate',
              P(x(i) - wide * 0.5, side, y - 0.28),
              P(x(i) + wide * 0.5, side, y - 0.28),
              P(x(i) + wide * 0.32, side, y + 0.32),
              P(x(i) - wide * 0.32, side, y + 0.32),
              [0, 0, s],
            );
          }
        if (tier >= 3)
          rod(
            out,
            'steel',
            'flange',
            P(x(i) + 0.112, s * (W + 0.19), 0.45),
            P(x(i) + 0.112, s * (W + 0.19), 8.96),
            0.048,
            0.11,
          );
      }
    }
    for (const i of tier === 0 ? [1, n - 1] : Array.from({ length: n - 1 }, (_, k) => k + 1)) {
      rod(out, 'steel', 'chord', upper(i, -1), upper(i, 1), 0.3, 0.42);
      if (tier > 0)
        rod(
          out,
          'steel',
          'girder',
          P(x(i), -layout.edge + 0.24, -0.52),
          P(x(i), layout.edge - 0.24, -0.52),
          0.42,
          0.46,
        );
      if (tier >= 2 && i < n - 1) {
        rod(out, 'steel', 'web', upper(i, -1), upper(i + 1, 1), 0.2, 0.24);
        rod(out, 'steel', 'web', upper(i, 1), upper(i + 1, -1), 0.2, 0.24);
      }
      if (tier >= 3 && (i === 1 || i === n - 1)) {
        rod(out, 'steel', 'web', P(x(i), -W, 7.05), P(x(i), -1.45, 9.1), 0.21, 0.24);
        rod(out, 'steel', 'web', P(x(i), W, 7.05), P(x(i), 1.45, 9.1), 0.21, 0.24);
      }
    }
  }
}
function supports(out, tier) {
  const pier = (x, rows, bevel) =>
    loft(
      out,
      'concrete',
      rows.map(([y, width, depth]) => chamferedRectangle(x, y, 0, width, depth, bevel)),
      color.pier,
    );
  const y = deckY(0);
  pier(
    0,
    [
      [-0.46, 8.1, 13.0],
      [layout.pierGround + 0.65, 7.2, 11.6],
      [y - 2.36, 6.4, 10.6],
      [y - 1.04, 7.38, 14.3],
    ],
    tier < 2 ? 0.6 : 1.03,
  );
  for (const [x, grade] of layout.abutments) {
    const y = deckY(x);
    pier(
      x,
      [
        [grade - 2, 5.7, 15.75],
        [y - 1.66, 4.9, 15.55],
        [y - 0.51, 5.1, 16.9],
      ],
      0.46,
    );
    if (tier > 0)
      for (const side of [-1, 1])
        rod(
          out,
          'concrete',
          'slab',
          P(x - 1.2, side * 5.4, -0.65),
          P(x + 1.2, side * 5.4, -0.65),
          0.71,
          2.8,
        );
  }
  if (tier >= 2)
    for (const x of [-0.85, 0.85])
      for (const side of [-1, 1])
        rod(
          out,
          'steel',
          'plate',
          P(x, side * layout.trackHalf, -1.05),
          P(x, side * layout.trackHalf, -0.79),
          0.65,
          0.82,
        );
}
export function buildBridgeLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Thanh Hoa Bridge level ${level}`);
  deck(out, tier);
  railBanks(out, tier);
  structure(out, tier);
  supports(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

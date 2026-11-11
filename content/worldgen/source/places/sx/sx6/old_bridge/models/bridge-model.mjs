/** Original masonry model of the mapped Mustafa Pasha Bridge in Svilengrad. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  limestone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.97 },
  paving: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
};
const color = (hex) =>
  hex.match(/../g).map((part) => {
    const v = parseInt(part, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const shades = {
  stone: color('b1a18a'),
  warm: color('beab91'),
  pale: color('bdb099'),
  vault: color('aa9a85'),
  coping: color('b6ad98'),
  paving: color('a39a8b'),
  plaque: color('c4b7a1'),
  edge: color('998975'),
  relief: color('a89b84'),
  iron: color('626863'),
};
const [lo, hi] = layout.ends,
  { half, arches, piers, baseY, stelaX, stelaSide } = layout;
const quality = {
  skyline: { curve: 4, rim: 0, stone: 0, lamps: false, compact: true },
  district: { curve: 8, rim: 6, stone: 0, lamps: true },
  street: { curve: 16, rim: 14, stone: 4.8, lamps: true },
  closeup: { curve: 26, rim: 22, stone: 2.0, lamps: true },
  master: { curve: 40, rim: 34, stone: 1.35, lamps: true },
};
export function deckY(x) {
  const i = layout.deck.findIndex((row) => row[0] >= x);
  if (i <= 0) return (i === 0 ? layout.deck[0] : layout.deck.at(-1))[1];
  const [a, y] = layout.deck[i - 1],
    [b, h] = layout.deck[i];
  return y + ((h - y) * (x - a)) / (b - a);
}
const sinArch = (u) => {
  // A shallow pointed profile with the wider river openings approaching segmental arches.
  const point = 0.075,
    radius = 0.5 + point;
  return (
    Math.sqrt(Math.max(0, radius * radius - (Math.abs(u - 0.5) + point) ** 2)) /
    Math.sqrt(radius * radius - point * point)
  );
};
const crown = (arch, x) =>
  arch.spring +
  arch.rise * sinArch(Math.max(0, Math.min(1, (x - arch.left) / (arch.right - arch.left))));
function face(out, slot, points, wanted, tint) {
  const [a, ...tail] = points;
  for (let i = 1; i < tail.length; i++) {
    let p = [a, tail[i - 1], tail[i]],
      n = normalFor(...p);
    if (n.reduce((sum, v, k) => sum + v * wanted[k], 0) < 0) {
      p = [a, tail[i], tail[i - 1]];
      n = normalFor(...p);
    }
    const uv = p.map(([x, y, z]) =>
      Math.abs(n[1]) > 0.7 ? [x, z] : Math.abs(n[2]) > 0.65 ? [x, y] : [z, y],
    );
    out.addTriangle(slot, 'metric:uv', p, n, uv, tint);
  }
}
const unique = (rows) =>
  [...new Set(rows)].sort((a, b) => a - b).filter((x, i, all) => !i || x - all[i - 1] > 0.001);
function crossSection(out, slot, x, y, h, sign, tint) {
  if (h - y < 0.001) return;
  face(
    out,
    slot,
    [
      [x, y, -half],
      [x, h, -half],
      [x, h, half],
      [x, y, half],
    ],
    [sign, 0, 0],
    tint,
  );
}
function deckSurface(out, a, b) {
  const y = deckY(a),
    h = deckY(b);
  face(
    out,
    'paving',
    [
      [a, y, -half],
      [b, h, -half],
      [b, h, half],
      [a, y, half],
    ],
    [0, 1, 0],
    shades.paving,
  );
}
function section(out, arch, a, b, i, compact) {
  const y = arch ? crown(arch, a) : baseY,
    h = arch ? crown(arch, b) : baseY,
    topA = deckY(a),
    topB = deckY(b);
  if (Math.min(topA - y, topB - h) < 0.38) throw Error(`An arch rises into the deck at ${a}`);
  for (const sign of [-1, 1])
    face(
      out,
      'masonry',
      [
        [a, y, sign * half],
        [b, h, sign * half],
        [b, topB, sign * half],
        [a, topA, sign * half],
      ],
      [0, 0, sign],
      i % 7 === 0 ? shades.warm : shades.stone,
    );
  if (!compact) deckSurface(out, a, b);
  if (arch || !compact)
    face(
      out,
      arch ? 'limestone' : 'masonry',
      [
        [a, y, -half],
        [b, h, -half],
        [b, h, half],
        [a, y, half],
      ],
      [0, -1, 0],
      arch ? shades.vault : shades.stone,
    );
}
function arcade(out, detail) {
  const knots = [
    lo,
    hi,
    ...layout.deck.map((row) => row[0]),
    ...arches.flatMap((h) => {
      const N = detail.curve + (detail.curve % 2);
      return Array.from({ length: N + 1 }, (_, i) =>
        i === 0
          ? h.left
          : i === N
            ? h.right
            : h.left + ((h.right - h.left) * (1 - Math.cos((i * Math.PI) / N))) / 2,
      );
    }),
  ];
  const xs = unique(knots);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      mid = (a + b) / 2;
    section(
      out,
      arches.find((h) => h.left < mid && mid < h.right),
      a,
      b,
      i,
      detail.compact,
    );
  }
  if (detail.compact) {
    for (let i = 1; i < layout.deck.length; i++)
      deckSurface(out, layout.deck[i - 1][0], layout.deck[i][0]);
  }
  crossSection(out, 'masonry', lo, baseY, deckY(lo), -1, shades.stone);
  crossSection(out, 'masonry', hi, baseY, deckY(hi), 1, shades.stone);
  for (const arch of arches) {
    crossSection(out, 'limestone', arch.left, baseY, arch.spring, 1, shades.vault);
    crossSection(out, 'limestone', arch.right, baseY, arch.spring, -1, shades.vault);
  }
}
function cutwaters(out) {
  for (const { x, width, base, top, river } of piers) {
    for (const sign of [-1, 1]) {
      const projection = (river ? (sign === 1 ? 1.42 : 1.8) : 0.82) * Math.min(1.17, width / 2.25);
      const ring = (y, z, w) => [
        [x - w, y, sign * (half - 0.1)],
        [x, y, sign * (half + z)],
        [x + w, y, sign * (half - 0.1)],
      ];
      const bottom = ring(base, projection, width * 0.5),
        stem = ring(top - 0.58, projection * 0.96, width * 0.48),
        crown = ring(top, projection * 0.16, width * 0.42);
      for (const [lower, upper] of [
        [bottom, stem],
        [stem, crown],
      ])
        for (let i = 0; i < 2; i++)
          face(
            out,
            'masonry',
            [lower[i], lower[i + 1], upper[i + 1], upper[i]],
            [i === 0 ? -1 : 1, 0, sign],
            i === 0 ? shades.stone : shades.warm,
          );
      face(out, 'limestone', crown, [0, 1, 0], shades.pale);
    }
  }
}
function trim(out, detail) {
  if (!detail.rim) return;
  for (const arch of arches) {
    const N = detail.rim + (detail.rim % 2);
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI) / N,
        b = ((i + (detail.stone ? 0.984 : 1)) * Math.PI) / N;
      function point(t, extra, side) {
        const radius = (arch.right - arch.left) * 0.5;
        const x = arch.cx - (radius + extra) * Math.cos(t);
        const y = arch.spring + (arch.rise + extra) * sinArch((1 - Math.cos(t)) * 0.5);
        return [x, y, side * (half + 0.023)];
      }
      for (const sign of [-1, 1]) {
        const thickness = 0.42 + (arch.right - arch.left) * 0.007;
        const ring = [
          point(a, 0, sign),
          point(b, 0, sign),
          point(b, thickness, sign),
          point(a, thickness, sign),
        ];
        face(out, 'limestone', ring, [0, 0, sign], i % 5 === 0 ? shades.warm : shades.pale);
      }
    }
  }
}
function stoneStrip(out, slot, shade, sign, a, b, inside, outside, height, thickness, compact) {
  const ring = (x) => {
    const y = deckY(x) + height;
    return [
      [x, y, sign * inside],
      [x, y, sign * outside],
      [x, y + thickness, sign * outside],
      [x, y + thickness, sign * inside],
    ];
  };
  const A = ring(a),
    B = ring(b);
  const normals = [
    [0, -1, 0],
    [0, 0, sign],
    [0, 1, 0],
    [0, 0, -sign],
  ];
  for (let i = compact ? 1 : 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, slot, [A[i], B[i], B[j], A[j]], normals[i], shade);
  }
  if (!compact)
    for (const [r, normal] of [
      [A, [-1, 0, 0]],
      [B, [1, 0, 0]],
    ])
      face(out, slot, r, normal, shade);
}
function parapets(out, detail) {
  const stations = unique([lo + 0.65, hi - 0.65, ...layout.deck.slice(1, -1).map((row) => row[0])]);
  const segments = detail.stone
    ? unique([
        ...stations,
        ...Array.from(
          { length: Math.floor((hi - lo - 1.4) / detail.stone) },
          (_, i) => lo + 0.75 + (i + 1) * detail.stone,
        ),
      ])
    : stations;
  for (const sign of [-1, 1]) {
    for (let i = 1; i < stations.length; i++) {
      stoneStrip(
        out,
        'masonry',
        shades.stone,
        sign,
        stations[i - 1],
        stations[i],
        half - 0.5,
        half + 0.02,
        0,
        detail.compact ? 0.885 : 0.73,
        detail.compact,
      );
      if (detail.rim)
        stoneStrip(
          out,
          'limestone',
          shades.coping,
          sign,
          stations[i - 1],
          stations[i],
          half - 0.05,
          half + 0.092,
          -0.19,
          0.13,
        );
    }
    if (detail.compact) continue;
    for (let i = 1; i < segments.length; i++) {
      const a = segments[i - 1] + (detail.stone ? 0.013 : 0),
        b = segments[i] - (detail.stone ? 0.013 : 0);
      if (b - a < 0.03) continue;
      stoneStrip(
        out,
        'limestone',
        i % 6 === 0 ? shades.warm : shades.coping,
        sign,
        a,
        b,
        half - 0.57,
        half + 0.1,
        0.73,
        0.155,
      );
    }
  }
}
function box(out, slot, x0, y0, z0, x1, y1, z1, tint) {
  const A = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    B = A.map(([x, , z]) => [x, y1, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      slot,
      [A[i], A[j], B[j], B[i]],
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
      tint,
    );
  }
  face(out, slot, A, [0, -1, 0], tint);
  face(out, slot, B, [0, 1, 0], tint);
}
function inscription(out, detail) {
  const x = stelaX,
    y = deckY(x),
    z = stelaSide * (half - 0.29);
  const panel = (w, h0, h1, d, tint) =>
    box(out, 'limestone', x - w / 2, y + h0, z - d / 2, x + w / 2, y + h1, z + d / 2, tint);
  panel(4.4, 0, 0.37, 1.13, shades.coping);
  panel(3.76, 0.36, 4.63, 0.74, shades.plaque);
  panel(4.08, 4.58, 4.76, 0.99, shades.coping);
  if (!detail.rim) return;
  for (const side of [-1, 1])
    box(
      out,
      'limestone',
      x + side * 1.54 - 0.14,
      y + 0.66,
      z - 0.53,
      x + side * 1.54 + 0.14,
      y + 4.32,
      z + 0.41,
      shades.pale,
    );
  box(out, 'limestone', x - 1.43, y + 0.89, z - 0.416, x + 1.43, y + 4.12, z - 0.365, shades.edge);
  box(out, 'limestone', x - 1.28, y + 1.02, z - 0.448, x + 1.28, y + 3.97, z - 0.41, shades.plaque);
  if (detail.stone)
    for (let i = 0; i < 7; i++) {
      const left = x - 1.04 + (i % 2) * 0.13,
        bottom = y + 1.35 + i * 0.3;
      const right = x + 0.97 - (i % 3) * 0.14;
      for (let j = 0; j < 5; j++) {
        const a = left + ((right - left) * j) / 5;
        box(
          out,
          'limestone',
          a,
          bottom,
          z - 0.464,
          a + (right - left) * 0.15,
          bottom + 0.032 + (j % 2) * 0.016,
          z - 0.448,
          shades.relief,
        );
      }
    }
}
function lights(out, detail) {
  if (!detail.lamps) return;
  for (const x of [-79, -35, 41, 90]) {
    const z = -half + 0.62,
      y = deckY(x);
    const stations = [
      [x, y, z],
      [x, y + 4.75, z],
      [x, y + 5.02, z + 0.24],
      [x, y + 5.15, z + 0.75],
    ];
    for (let i = 1; i < stations.length; i++)
      beam(out, 'iron', stations[i - 1], stations[i], 0.105, 0.105, shades.iron);
    box(out, 'iron', x - 0.16, y + 5.06, z + 0.64, x + 0.16, y + 5.18, z + 1.04, shades.iron);
  }
}
export function buildBridgeLevel(out, level = 'master') {
  const detail = quality[level];
  if (!detail) throw Error(`Unknown Mustafa Pasha Bridge level ${level}`);
  arcade(out, detail);
  if (!detail.compact) cutwaters(out);
  trim(out, detail);
  parapets(out, detail);
  inscription(out, detail);
  lights(out, detail);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

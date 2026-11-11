import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.86 },
  pavement: { slot: 'wall', graph: 'gravel', roughness: 0.88 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.37 },
  stays: { slot: 'trim', graph: 'metal_stainless', roughness: 0.59, metallic: 0.55 },
};
const tint = {
  light: 'd0ccc0',
  footing: 'ada898',
  dark: '9d9b92',
  curb: 'bcbab2',
  stripe: 'e1e0ce',
  road: '51585b',
  shoulder: '64676a',
  girder: '6c7679',
  rail: '838d8e',
  cable: 'b2b7b6',
  red: '854f45',
  rubber: '454b4c',
};
const colors = Object.fromEntries(
  Object.entries(tint).map(([k, hex]) => [
    k,
    hex.match(/../g).map((pair) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detailByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const { ends, alignment, profiles, southMain, northMain } = layout;
const clamp = (t) => Math.min(1, Math.max(0, t));
const mix = (a, b, t) => a + (b - a) * t;
function value(x, rows, index = 1) {
  const i = rows.findIndex((row) => row[0] >= x);
  if (i < 1) return rows.at(i === 0 ? 0 : -1)[index];
  const [a, b] = rows.slice(i - 1, i + 1);
  return mix(a[index], b[index], (x - a[0]) / (b[0] - a[0]));
}
export const centerZ = (x) => value(x, alignment);
export const deckY = (x) => value(x, profiles);
const half = (x) => value(x, alignment, 2);
function p(x, u, h = 0) {
  const blend = 14;
  const z = centerZ(x) + u;
  const index = x < ends[0] + blend ? 0 : x > ends[1] - blend ? 1 : -1;
  if (index < 0) return [x, deckY(x) + h, z];
  const end = layout.endRows[index],
    sign = index === 0 ? -1 : 1;
  const f = clamp(1 - Math.abs(x - ends[index]) / blend),
    t = (1 + u / half(x)) * 0.5;
  const edgeX = mix(end.clipLeft[0], end.clipRight[0], t) + sign * 0.08;
  const edgeZ = mix(end.clipLeft[1], end.clipRight[1], t);
  const dz = edgeZ - end.center[1] - (u * half(ends[index])) / half(x);
  return [x + (edgeX - ends[index]) * f, deckY(x) + h, z + dz * f];
}
function face(out, slot, color, points, toward) {
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  for (let i = 1; i < points.length - 1; i++) {
    let tri = [points[0], points[i], points[i + 1]],
      n = normalFor(...tri);
    if (dot(n, toward) < 0) {
      tri = tri.toReversed();
      n = normalFor(...tri);
    }
    out.addTriangle(slot, ref, tri, n, undefined, colors[color]);
  }
}
function strip(out, slot, color, a, b, low, high, y, normal = up) {
  face(
    out,
    slot,
    color,
    [p(a, low(a), y), p(b, low(b), y), p(b, high(b), y), p(a, high(a), y)],
    normal,
  );
}
function station(x, z) {
  const slope = (centerZ(x + 7) - centerZ(x - 7)) / 14,
    n = Math.hypot(1, slope),
    c = 1 / n,
    s = slope / n;
  return (u, y, along = 0) => [x + c * along - s * u, y, z + s * along + c * u];
}
function block(out, slot, color, at, u, rows) {
  const rings = rows.map(([y, w, d, chamfer]) => {
    if (chamfer === 0)
      return [
        [-w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
        [w / 2, -d / 2],
      ].map(([a, b]) => at(u + b, y, a));
    return chamferedRectangle(0, y, u, w, d, chamfer).map(([x, y, z]) => at(z, y, x));
  });
  loft(out, slot, rings, colors[color]);
}
function reducedStations(first, last, tolerance) {
  const a = alignment[first],
    b = alignment[last];
  let max = tolerance,
    index = -1;
  for (let i = first + 1; i < last; i++) {
    const [x, z, w] = alignment[i],
      t = (x - a[0]) / (b[0] - a[0]);
    const error = Math.max(
      Math.abs(z - mix(a[1], b[1], t)),
      Math.abs(w - mix(a[2], b[2], t)),
      Math.abs(deckY(x) - mix(deckY(a[0]), deckY(b[0]), t)) * 2,
    );
    if (error > max) {
      max = error;
      index = i;
    }
  }
  if (index < 0) return [a[0], b[0]];
  return [
    ...reducedStations(first, index, tolerance).slice(0, -1),
    ...reducedStations(index, last, tolerance),
  ];
}
const skylineXs = reducedStations(0, alignment.length - 1, 0.82);
const districtXs = [
  ...new Set([...reducedStations(0, alignment.length - 1, 0.43), southMain, northMain]),
].sort((a, b) => a - b);
function deck(out, detail) {
  const xs = detail === 0 ? skylineXs : detail === 1 ? districtXs : alignment.map((row) => row[0]);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      inMain = a >= southMain && b <= northMain;
    strip(out, 'pavement', 'road', a, b, (x) => -half(x), half, 0);
    if (detail === 0) {
      for (const sign of [-1, 1])
        face(
          out,
          'concrete',
          'curb',
          [
            p(a, sign * half(a), 0),
            p(b, sign * half(b), 0),
            p(b, sign * half(b), -2.65),
            p(a, sign * half(a), -2.65),
          ],
          [0, 0, sign],
        );
      strip(out, 'concrete', 'dark', a, b, (x) => -half(x), half, -2.65, down);
      continue;
    }
    strip(out, 'concrete', 'curb', a, b, (x) => -half(x), half, -0.34, down);
    for (const sign of [-1, 1]) {
      const edge = (x) => sign * half(x);
      face(
        out,
        'concrete',
        'curb',
        [p(a, edge(a), 0), p(b, edge(b), 0), p(b, edge(b), -0.34), p(a, edge(a), -0.34)],
        [0, 0, sign],
      );
      const sections =
        detail === 1
          ? [
              [0, -0.34],
              [1.2, -2.58],
              [4.5, -2.58],
              [5.6, -0.34],
            ]
          : inMain
            ? [
                [-0.15, -0.33],
                [0.33, -0.82],
                [0.33, -2.94],
                [1.03, -3.26],
                [2.45, -3.26],
                [2.45, -2.95],
                [1.9, -2.93],
                [1.9, -0.33],
              ]
            : [
                [0, -0.34],
                [1.15, -0.83],
                [2.13, -2.4],
                [2.85, -2.65],
                [5.35, -2.65],
                [6.21, -0.34],
              ];
      for (let j = 1; j < sections.length; j++) {
        const [u, y] = sections[j - 1],
          [v, z] = sections[j];
        const q = (x, w, h) => p(x, edge(x) - sign * w, h);
        face(
          out,
          inMain ? 'steel' : 'concrete',
          inMain ? 'girder' : 'dark',
          [q(a, u, y), q(b, u, y), q(b, v, z), q(a, v, z)],
          [0, Math.sign(v - u), sign * Math.sign(y - z)],
        );
      }
      if (detail >= 2) {
        const limits =
          sign === 1 ? [(x) => half(x) - 2.8, half] : [(x) => -half(x), (x) => -half(x) + 2.8];
        strip(out, 'pavement', 'shoulder', a, b, ...limits, 0.018);
      }
    }
  }
  for (const x of ends) {
    const w = half(x),
      sign = x === ends[0] ? -1 : 1;
    face(
      out,
      'concrete',
      'dark',
      [p(x, -w, 0), p(x, w, 0), p(x, w, -2.65), p(x, -w, -2.65)],
      [sign, 0, 0],
    );
  }
  if (detail < 2) return;
  const spacing = detail === 2 ? 44 : detail === 3 ? 8 : 4;
  for (let x = southMain + spacing / 2; x < northMain; x += spacing) {
    const at = station(x, centerZ(x)),
      y = deckY(x) - 1.34;
    beam(
      out,
      'steel',
      at(-half(x) + 1.6, y),
      at(half(x) - 1.6, y),
      detail >= 3 ? 0.54 : 0.83,
      1.11,
      colors.girder,
    );
  }
}
function pier(out, s, detail, i) {
  if (!detail && i % 3 !== 0 && s.x !== southMain && s.x !== northMain) return;
  const at = station(s.x, s.z);
  if (s.cap - s.foot < 0.45) return;
  if (detail < 2) {
    block(out, 'concrete', 'footing', at, 0, [
      [s.foot, 4.8, 9.6, 0],
      [s.cap + 1.2, 5.6, 16, 0],
    ]);
    return;
  }
  const edge = detail >= 3 ? 0.42 : 0;
  for (const side of [-1, 1]) {
    const c = side * (s.bank === 0 ? 8.6 : 8.1),
      b = s.foot;
    if (detail >= 3)
      block(out, 'concrete', 'footing', at, c, [
        [b - 1, 7.2, 7.6, 0.5],
        [b + 0.9, 7.2, 7.6, 0.5],
      ]);
    block(out, 'concrete', 'light', at, c, [
      [b, 3.7, 4.85, edge],
      [s.cap - 2.1, 3.7, 4.85, edge],
      [s.cap, 5.65, 7.6, edge],
    ]);
    if (detail >= 3)
      block(out, 'steel', 'rubber', at, c, [
        [s.cap, 1.76, 2.35, 0],
        [s.cap + 0.4, 1.76, 2.35, 0],
      ]);
  }
  block(out, 'concrete', 'curb', at, 0, [
    [s.cap - 0.75, 5.0, 24, 0],
    [s.cap + 0.3, 5.5, 27.4, 0],
  ]);
}
function pylon(out, s, detail) {
  const at = station(s.x, s.z);
  const bottom = s.bottom,
    foot = s.footing,
    deck = s.deck,
    top = s.top;
  const cap = detail === 0 ? 0 : 0.75;
  block(out, 'concrete', 'footing', at, 0, [
    [bottom, 13.2, 48, cap],
    ...(detail === 0 ? [] : [[foot, 13.2, 48, cap]]),
    [foot + 1.1, 11.9, 44.2, cap],
  ]);
  const profile = [
    [foot, 21, 9.15, 8.4],
    [deck - 6.2, 20.6, 8.2, 7.1],
    [deck + 0.6, 18.9, 7.25, 5.5],
    [deck + (top - deck) * 0.43, 12.3, 6.2, 5.1],
    [deck + (top - deck) * 0.73, 7.7, 5.15, 4.7],
    [top - 3.5, 3.95, 4.9, 4.48],
    [top, 3.55, 4.5, 4.16],
  ];
  const rows = detail === 0 ? profile.filter((_, i) => [0, 2, 6].includes(i)) : profile;
  for (const side of [-1, 1]) {
    loft(
      out,
      'concrete',
      rows.map(([y, z, w, d]) => {
        const center = side * z;
        if (detail < 2)
          return [
            [-w / 2, -d / 2],
            [-w / 2, d / 2],
            [w / 2, d / 2],
            [w / 2, -d / 2],
          ].map(([a, b]) => at(center + b, y, a));
        return chamferedRectangle(0, y, center, w, d, 0.43).map(([x, y, z]) => at(z, y, x));
      }),
      colors.light,
    );
    if (detail >= 2) {
      const f = side * 1.0,
        h = top - 3.6;
      beam(
        out,
        'steel',
        at(side * 4.6, h, f * 2.55),
        at(side * 7.9, top - 19.7, f * 2.75),
        0.7,
        0.16,
        colors.red,
      );
      beam(
        out,
        'steel',
        at(side * 4.6, h, -f * 2.55),
        at(side * 7.9, top - 19.7, -f * 2.75),
        0.7,
        0.16,
        colors.red,
      );
      if (detail >= 3)
        tubePath(
          out,
          'steel',
          [at(side * 3.48, top), at(side * 3.48, top + 2.35)],
          0.068,
          colors.rail,
          5,
        );
    }
  }
  block(out, 'concrete', 'dark', at, 0, [
    [deck - 9.7, 6.1, 37.2, 0],
    ...(detail === 0 ? [] : [[deck - 5.4, 7.8, 42, 0]]),
    [deck - 4.8, 7.6, 42, 0],
  ]);
  const n = detail === 0 ? 2 : detail === 1 ? 5 : 10;
  const curve = Array.from({ length: n + 1 }, (_, i) => {
    const u = ((2 * i) / n - 1) * 6.4,
      t = u / 6.4;
    return [u, top - 2.85 * Math.max(0, 1 - Math.abs(t) * 2.15), top - 9.8 - 12.7 * t * t];
  });
  for (let i = 1; i < curve.length; i++) {
    const [u, upper, lower] = curve[i - 1],
      [v, head, toe] = curve[i];
    for (const sign of [-1, 1]) {
      const x = sign * 2.52;
      face(
        out,
        'concrete',
        'light',
        [at(u, lower, x), at(v, toe, x), at(v, head, x), at(u, upper, x)],
        [sign, 0, 0],
      );
    }
    face(
      out,
      'concrete',
      'light',
      [at(u, upper, -2.52), at(v, head, -2.52), at(v, head, 2.52), at(u, upper, 2.52)],
      up,
    );
    face(
      out,
      'concrete',
      'dark',
      [at(u, lower, -2.52), at(v, toe, -2.52), at(v, toe, 2.52), at(u, lower, 2.52)],
      down,
    );
  }
}
function cables(out, s, detail) {
  const count = [2, 4, 7, 11, 11][detail];
  const at = station(s.x, s.z);
  for (const across of [-1, 1])
    for (const along of [-1, 1])
      for (let i = 0; i < count; i++) {
        const j = (i + 0.38) / (count - 0.24),
          run = 26 + j * 114,
          y = s.top - 21 + j * 17.6;
        const x = s.x + along * run,
          offset = across * (half(x) - 0.96);
        const start = at(across * (8.1 - j * 3.4), y, along * 2.6),
          end = p(x, offset, 0.65);
        if (detail === 0) {
          for (const side of [-1, 1])
            face(
              out,
              'steel',
              'cable',
              [
                [start[0], start[1] - 0.3, start[2]],
                [end[0], end[1] - 0.3, end[2]],
                [end[0], end[1] + 0.3, end[2]],
                [start[0], start[1] + 0.3, start[2]],
              ],
              [0, 0, side],
            );
        } else {
          const radius = [0, 0.27, 0.162, 0.124, 0.119][detail];
          tubePath(out, 'stays', [start, end], radius, colors.cable, detail >= 3 ? 7 : 3);
          if (detail >= 3) {
            const alongCable = end.map((v, k) => mix(v, start[k], 0.017));
            tubePath(out, 'steel', [end, alongCable], 0.3, colors.rail, 6);
          }
        }
      }
}
function laneFurniture(out, detail) {
  if (detail === 0) return;
  const xs = detail === 1 ? districtXs : alignment.map((row) => row[0]);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    strip(
      out,
      'concrete',
      'curb',
      a,
      b,
      () => -0.39,
      () => 0.39,
      0.95,
    );
    for (const side of [-1, 1]) {
      const rail = (x) => side * (half(x) - 0.21);
      face(
        out,
        'concrete',
        'curb',
        [
          p(a, side * 0.39, 0),
          p(b, side * 0.39, 0),
          p(b, side * 0.39, 0.95),
          p(a, side * 0.39, 0.95),
        ],
        [0, 0, side],
      );
      strip(
        out,
        'steel',
        'rail',
        a,
        b,
        (x) => rail(x) - 0.12,
        (x) => rail(x) + 0.12,
        1.09,
      );
      face(
        out,
        'steel',
        'rail',
        [p(a, rail(a), 0.96), p(b, rail(b), 0.96), p(b, rail(b), 1.09), p(a, rail(a), 1.09)],
        [0, 0, side],
      );
      if (detail >= 2) {
        const edge = (x) => side * (half(x) - 2.9);
        strip(
          out,
          'concrete',
          'stripe',
          a,
          b,
          (x) => edge(x) - 0.085,
          (x) => edge(x) + 0.085,
          0.025,
        );
      }
    }
  }
  if (detail < 2) return;
  const interval = detail === 2 ? 46 : detail === 3 ? 18 : 14;
  const dash = detail === 2 ? 12 : 5.8;
  for (let x = ends[0] + 10; x < ends[1] - dash - 8; x += interval) {
    for (const sign of [-1, 1])
      for (const proportion of [0.246, 0.48, 0.708]) {
        const edge = (x) => sign * (0.4 + (half(x) - 3.2) * proportion);
        strip(
          out,
          'concrete',
          'stripe',
          x,
          x + dash,
          (x) => edge(x) - 0.073,
          (x) => edge(x) + 0.073,
          0.023,
        );
      }
  }
  const spacing = detail === 2 ? 40 : detail === 3 ? 9 : 5;
  for (let x = ends[0] + 6; x < ends[1] - 6; x += spacing)
    for (const sign of [-1, 1]) {
      const u = sign * (half(x) - 0.21);
      beam(out, 'steel', p(x, u, 0.05), p(x, u, 1.05), 0.13, 0.16, colors.rail);
    }
  const lampSpacing = detail === 2 ? 130 : detail === 3 ? 61 : 53;
  for (let x = ends[0] + 30; x < ends[1] - 20; x += lampSpacing)
    for (const sign of [-1, 1]) {
      const u = sign * (half(x) - 0.77),
        h = 10.4;
      tubePath(out, 'steel', [p(x, u, 0.02), p(x, u, h)], 0.14, colors.rail, detail >= 3 ? 6 : 4);
      beam(
        out,
        'steel',
        p(x, u, h - 0.12),
        p(x, u - sign * 1.82, h + 0.15),
        0.22,
        0.18,
        colors.rail,
      );
      beam(
        out,
        'steel',
        p(x, u - sign * 1.64, h + 0.13),
        p(x, u - sign * 2.2, h + 0.13),
        0.29,
        0.17,
        colors.rubber,
      );
    }
}
export function buildBridgeLevel(out, level) {
  const detail = detailByLevel[level];
  deck(out, detail);
  for (const [i, s] of layout.piers.entries()) pier(out, s, detail, i);
  for (const s of layout.pylons) {
    pylon(out, s, detail);
    cables(out, s, detail);
  }
  laneFurniture(out, detail);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

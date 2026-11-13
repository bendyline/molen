/** Pingtang Bridge follows the mapped S62 alignment with three photo-derived pylons. */
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
  concrete: { slot: 'foundation', graph: 'concrete_plain' },
  road: { slot: 'wall', graph: 'gravel' },
  metal: { slot: 'trim', graph: 'metal_painted' },
  cable: { slot: 'trim', graph: 'metal_stainless' },
};
const tint = {
  white: 'e4e3db',
  pale: 'c6cac9',
  foundation: 'a6a49a',
  underside: 'a9b3b5',
  fascia: 'c9d1d2',
  blue: '1466ad',
  brightBlue: '1997c8',
  darkBlue: '1c4773',
  cable: 'd4dcdf',
  road: '6c6f72',
  land: 'a8a58d',
  steel: '8d999e',
  paint: 'ebebdc',
  joint: '414b50',
  portal: 'b8b6a7',
  lining: '8c969b',
};
const colors = Object.fromEntries(
  Object.entries(tint).map(([name, hex]) => [
    name,
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, f) => a + (b - a) * f,
  clamp = (f) => Math.max(0, Math.min(1, f));
function value(x, table, column = 1) {
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1],
      b = table[i];
    if (x <= b[0]) return mix(a[column], b[column], clamp((x - a[0]) / (b[0] - a[0])));
  }
  return table.at(-1)[column];
}
export const centerZ = (x) => value(x, layout.alignment);
export const deckY = (x) => value(x, layout.profile);
const halfSeparation = (x) => value(x, layout.alignment, 2);
const halfDeck = (x) => halfSeparation(x) + 8.7;
const ends = layout.ends;
const [westX, westZ] = layout.endpoints[0],
  eastZ = layout.endpoints[1][1],
  blend = 1.3;
const westLane = layout.west[1],
  westSkew = (westLane[0] - westX) / (westLane[1] - westZ);
export function eastEndX(z) {
  const slopes = layout.east.map(([x, y], i) => x + (z + eastZ - y) * layout.eastNormals[i]);
  const a = layout.east[0][0] + (-blend + eastZ - layout.east[0][1]) * layout.eastNormals[0];
  const b = layout.east[1][0] + (blend + eastZ - layout.east[1][1]) * layout.eastNormals[1];
  return z < -blend ? slopes[0] : z > blend ? slopes[1] : mix(a, b, (z + blend) / (2 * blend));
}
function p(x, z, dy = 0) {
  const west = z * westSkew * clamp(1 - (x - ends[0]) / 24);
  const east = (eastEndX(z) - ends[1]) * clamp(1 - (ends[1] - x) / 28);
  return [x + west + east, deckY(x) + dy, centerZ(x) + z];
}
function face(out, slot, name, points, direction) {
  let n = normalFor(...points);
  if (n.reduce((s, a, i) => s + a * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (
    points.length === 4 &&
    Math.abs(n.reduce((s, a, i) => s + a * (points[3][i] - points[0][i]), 0)) > 0.00001
  ) {
    out.addTriangle(slot, ref, points.slice(0, 3), n, undefined, colors[name]);
    const tail = [points[0], points[2], points[3]];
    out.addTriangle(slot, ref, tail, normalFor(...tail), undefined, colors[name]);
  } else out.addConvexPolygon(slot, ref, points, n, (point) => [point[0], point[2]], colors[name]);
}
function strip(out, slot, name, a, b, lo, hi, dy) {
  face(
    out,
    slot,
    name,
    [p(a, lo(a), dy), p(b, lo(b), dy), p(b, hi(b), dy), p(a, hi(a), dy)],
    [0, 1, 0],
  );
}
function girder(out, tier) {
  const xs = [...new Set([...layout.alignment, ...layout.profile].map((row) => row[0]))].sort(
    (a, b) => a - b,
  );
  const profile = [
    [1, 0],
    [1, -1.15],
    [0.69, -4.0],
    [-0.69, -4.0],
    [-1, -1.15],
    [-1, 0],
  ];
  const t = (x, [z, y]) => p(x, z * halfDeck(x), y);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    const bands = b <= ends[1] - 28 ? [] : [() => -blend, () => blend];
    const edges = [(x) => -halfDeck(x), ...bands, halfDeck];
    for (let k = 1; k < edges.length; k++)
      strip(out, 'road', 'road', a, b, edges[k - 1], edges[k], 0);
    for (let j = 1; j < profile.length; j++) {
      const u = profile[j - 1],
        v = profile[j];
      const normal = [0, -Math.abs(u[0] - v[0]), Math.sign(u[0] + v[0])];
      if (j === 3 && bands.length) {
        const bottom = [
          (x) => 0.69 * halfDeck(x),
          () => blend,
          () => -blend,
          (x) => -0.69 * halfDeck(x),
        ];
        for (let k = 1; k < bottom.length; k++)
          face(
            out,
            'concrete',
            'underside',
            [
              p(a, bottom[k - 1](a), -4),
              p(b, bottom[k - 1](b), -4),
              p(b, bottom[k](b), -4),
              p(a, bottom[k](a), -4),
            ],
            normal,
          );
      } else
        face(
          out,
          'concrete',
          j === 1 || j === 5 ? 'fascia' : 'underside',
          [t(a, u), t(b, u), t(b, v), t(a, v)],
          normal,
        );
    }
    if (!tier) continue;
    const offsets = [(x) => -halfDeck(x) + 0.38, () => 0, (x) => halfDeck(x) - 0.38];
    for (const offset of offsets) {
      const height = offset === offsets[1] ? 0.89 : 1.07;
      const w = offset === offsets[1] ? 0.25 : 0.24;
      strip(
        out,
        'concrete',
        'pale',
        a,
        b,
        (x) => offset(x) - w,
        (x) => offset(x) + w,
        height,
      );
      for (const sign of [-1, 1])
        face(
          out,
          'concrete',
          'pale',
          [
            p(a, offset(a) + sign * w),
            p(b, offset(b) + sign * w),
            p(b, offset(b) + sign * w, height),
            p(a, offset(a) + sign * w, height),
          ],
          [0, 0, sign],
        );
    }
    for (const sign of [-1, 1]) {
      for (const off of [-5.4, 5.4]) {
        strip(
          out,
          'concrete',
          'paint',
          a,
          b,
          (x) => sign * halfSeparation(x) + off - 0.07,
          (x) => sign * halfSeparation(x) + off + 0.07,
          0.016,
        );
      }
    }
  }
  face(
    out,
    'concrete',
    'foundation',
    profile.map((pt) => t(ends[0], pt)),
    [-1, 0, 0],
  );
  const x = ends[1],
    w = halfDeck(x);
  for (const polygon of [
    [
      [-w, 0],
      [-w, -1.15],
      [-0.69 * w, -4],
      [-blend, -4],
      [-blend, 0],
    ],
    [
      [-blend, 0],
      [-blend, -4],
      [blend, -4],
      [blend, 0],
    ],
    [
      [blend, 0],
      [blend, -4],
      [0.69 * w, -4],
      [w, -1.15],
      [w, 0],
    ],
  ])
    face(
      out,
      'concrete',
      'foundation',
      polygon.map(([z, y]) => p(x, z, y)),
      [1, 0, 0],
    );
  if (tier < 2) return;
  const pitch = tier === 2 ? 23 : 12;
  const length = tier === 2 ? 6 : 5.6;
  for (let x = ends[0] + 2; x + length < ends[1]; x += pitch)
    for (const sign of [-1, 1]) {
      strip(
        out,
        'concrete',
        'paint',
        x,
        x + length,
        (s) => sign * halfSeparation(s) - 0.08,
        (s) => sign * halfSeparation(s) + 0.08,
        0.017,
      );
    }
  for (const x of [
    ...layout.pylons.map((p) => p.x),
    ...layout.approachPiers.filter((_, i) => i % 3 === 0).map((p) => p.x),
  ]) {
    strip(
      out,
      'metal',
      'joint',
      x - 0.13,
      x + 0.13,
      (q) => -halfDeck(q) + 0.75,
      (q) => halfDeck(q) - 0.75,
      0.019,
    );
  }
}
const rect = (x, y, z, w, d) => [
  [x - w / 2, y, z - d / 2],
  [x - w / 2, y, z + d / 2],
  [x + w / 2, y, z + d / 2],
  [x + w / 2, y, z - d / 2],
];
function tower(out, { x, z, baseY, embedY, topY }, tier) {
  const y = deckY(x),
    height = topY - y,
    below = y - baseY;
  const ring = (q, w, d, cz = z) =>
    tier === 0 ? rect(x, q, cz, w, d) : chamferedRectangle(x, q, cz, w, d, Math.min(w, d) * 0.1);
  if (tier)
    loft(out, 'concrete', [ring(embedY, 17, 20), ring(baseY + 3, 15.5, 18)], colors.foundation);
  const stages = [
    [tier ? baseY + 1.8 : embedY, 12.7, 15.4, 2.25],
    [baseY + 0.63 * below, 10.7, 13.9, 2.1],
    [y - 0.23 * below, 12.9, 20.4, 4.4],
    [y - 3.3, 17.0, 33.3, 10.65],
    [y + 0.2, 15.9, 32.8, 10.3],
  ];
  loft(
    out,
    'concrete',
    stages.map(([a, b, c]) => ring(a, b, c)),
    colors.white,
  );
  for (const side of [-1, 1])
    for (let i = 1; i < stages.length; i++) {
      const [a, w, , d] = stages[i - 1],
        [b, v, , e] = stages[i];
      const ax = x + side * (w * 0.5 + 0.055),
        bx = x + side * (v * 0.5 + 0.055);
      face(
        out,
        'concrete',
        i > 2 ? 'blue' : 'brightBlue',
        [
          [ax, a, z - d],
          [ax, a, z + d],
          [bx, b, z + e],
          [bx, b, z - e],
        ],
        [side, 0, 0],
      );
    }
  const legAt = (f) => [y + f * height, mix(13.0, 1.8, f), mix(12.3, 7.5, f), mix(5.45, 3.85, f)];
  for (const side of [-1, 1]) {
    const levels = (tier > 0 ? [0, 0.17, 0.55, 0.9, 1] : [0, 1]).map(legAt);
    loft(
      out,
      'concrete',
      levels.map(([y, o, w, d]) => ring(y, w, d, z + o * side)),
      colors.white,
    );
    for (let i = 1; i < levels.length; i++) {
      const [a, o, w, d] = levels[i - 1],
        [b, q, v, e] = levels[i];
      const innerA = z + (o - d / 2 - 0.045) * side,
        innerB = z + (q - e / 2 - 0.045) * side;
      face(
        out,
        'concrete',
        'darkBlue',
        [
          [x - w * 0.33, a, innerA],
          [x + w * 0.33, a, innerA],
          [x + v * 0.33, b, innerB],
          [x - v * 0.33, b, innerB],
        ],
        [0, 0, -side],
      );
    }
    if (tier >= 2)
      for (const sign of [-1, 1]) {
        const panel = (f) => {
          const [y, o, w] = legAt(f);
          return [x + sign * (w * 0.5 + 0.03), y, z + side * o];
        };
        const a = panel(0.09),
          b = panel(0.86),
          d = 0.55;
        face(
          out,
          'concrete',
          'blue',
          [
            [a[0], a[1], a[2] - d],
            [a[0], a[1], a[2] + d],
            [b[0], b[1], b[2] + d],
            [b[0], b[1], b[2] - d],
          ],
          [sign, 0, 0],
        );
      }
  }
  loft(out, 'concrete', [ring(topY - 5.6, 7.9, 6.85), ring(topY, 7.5, 6.72)], colors.white);
  if (tier >= 1)
    for (const fraction of [0.47, 0.83]) {
      const [h, o] = legAt(fraction);
      beam(out, 'concrete', [x, h, z - o], [x, h, z + o], 4.85, 1.12, colors.pale);
    }
}
function stays(out, pylon, tier) {
  const { x, z, topY, leftRun, rightRun } = pylon,
    y = deckY(x),
    height = topY - y;
  const total = [3, 8, 18, 28, 30][tier];
  for (const side of [-1, 1])
    for (const direction of [-1, 1]) {
      const run = direction === -1 ? leftRun : rightRun;
      const count = Math.max(3, Math.round((total * run) / 263));
      for (let i = 1; i <= count; i++) {
        const f = (i - 1) / (count - 1),
          at = mix(0.26, 0.957, f),
          dx = x + direction * mix(37, run, f);
        const a = [
          x + direction * mix(5.0, 3.34, at),
          y + height * at,
          z + side * mix(13, 1.8, at),
        ];
        const b = p(dx, side * (halfDeck(dx) - 1.08), 0.12);
        if (tier === 0) {
          for (const normal of [
            [0, 1, 0],
            [0, 0, 1],
          ]) {
            const i = normal[1] ? 2 : 1,
              w = 0.57;
            const shift = (p, s) => p.map((v, j) => (j === i ? v + s * w : v));
            const q = [shift(a, -1), shift(b, -1), shift(b, 1), shift(a, 1)];
            // Opposite side of each ribbon keeps the distant stays visible from both banks.
            face(out, 'cable', 'cable', q, normal);
            face(
              out,
              'cable',
              'cable',
              q,
              normal.map((n) => -n),
            );
          }
          continue;
        }
        const sides = [0, 4, 6, 8, 12][tier];
        tubePath(out, 'cable', [a, b], [0, 0.3, 0.18, 0.133, 0.127][tier], colors.cable, sides);
        if (tier < 3) continue;
        const l = Math.hypot(...a.map((v, j) => v - b[j])),
          offset = mix(1.2, 1.85, f);
        const collar = b.map((v, j) => v + ((a[j] - v) * offset) / l);
        tubePath(out, 'metal', [b, collar], 0.24, colors.steel, 6);
        const recess = a.map((v, j) => v + ((b[j] - v) * 0.83) / l);
        tubePath(out, 'metal', [a, recess], 0.235, colors.steel, 6);
      }
    }
}
function trestle(out, { x, z, feet }, tier) {
  const top = deckY(x) - 3.8;
  if (top < Math.min(...feet) + 2) return;
  if (!tier) {
    const f = Math.min(...feet);
    loft(out, 'concrete', [rect(x, f, z, 5.8, 10.1), rect(x, top, z, 4.7, 9.2)], colors.pale, {
      cap: false,
    });
    return;
  }
  for (const [i, side] of [-1, 1].entries()) {
    const f = feet[i],
      q = z + side * 9.25;
    if (f >= top - 1.15) continue;
    const rings = [rect(x, f, q, 6.2, 7.5), rect(x, top, q, 4.2, 5.35)];
    loft(out, 'concrete', rings, colors.pale);
  }
  if (tier)
    beam(
      out,
      'concrete',
      [x, top - 0.65, z - 12.1],
      [x, top - 0.65, z + 12.1],
      6.4,
      1.55,
      colors.pale,
    );
}
function portal(out, tier) {
  const { x, centers, roadwayY: y, retainingEdges, cover } = layout.westPortal;
  const mouth = x + 0.34,
    back = x - 20,
    n = tier === 0 ? 3 : tier === 1 ? 7 : 14;
  const edge = centers.map((c) => [c - 7.9, c + 7.9]);
  for (const [i, c] of centers.entries()) {
    const openHalf = 7.5,
      spring = y + 3.3,
      rise = 5.28;
    const outerHalf = 8.47,
      outerRise = 6.2;
    const arc = (j, outer) => {
      const angle = (j * Math.PI) / n;
      return [
        c + (outer ? outerHalf : openHalf) * Math.cos(angle),
        spring + (outer ? outerRise : rise) * Math.sin(angle),
      ];
    };
    const pt = (x, [z, y]) => [x, y, z];
    for (let j = 1; j <= n; j++) {
      const a = arc(j - 1, false),
        b = arc(j, false),
        q = arc(j - 1, true),
        r = arc(j, true);
      face(
        out,
        'concrete',
        'portal',
        [pt(mouth, a), pt(mouth, b), pt(mouth, r), pt(mouth, q)],
        [1, 0, 0],
      );
      face(
        out,
        'concrete',
        'lining',
        [pt(back, a), pt(back, b), pt(mouth, b), pt(mouth, a)],
        [0, -1, (c - (a[0] + b[0]) / 2) * 0.16],
      );
      face(
        out,
        'concrete',
        'pale',
        [pt(back, q), pt(back, r), pt(mouth, r), pt(mouth, q)],
        [0, 1, ((q[0] + r[0]) / 2 - c) * 0.16],
      );
      face(
        out,
        'concrete',
        'portal',
        [pt(mouth, q), pt(mouth, r), [mouth, y + 10.28, r[0]], [mouth, y + 10.28, q[0]]],
        [1, 0, 0],
      );
    }
    for (const sign of [-1, 1]) {
      const near = c + openHalf * sign,
        far = c + outerHalf * sign;
      face(
        out,
        'concrete',
        'portal',
        [
          [mouth, y, near],
          [mouth, y, far],
          [mouth, spring, far],
          [mouth, spring, near],
        ],
        [1, 0, 0],
      );
      face(
        out,
        'concrete',
        'lining',
        [
          [mouth, y, near],
          [back, y, near],
          [back, spring, near],
          [mouth, spring, near],
        ],
        [0, 0, -sign],
      );
    }
    face(
      out,
      'road',
      'road',
      [
        [back, y, edge[i][0]],
        [mouth, y, edge[i][0]],
        [mouth, y, edge[i][1]],
        [back, y, edge[i][1]],
      ],
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      'joint',
      [
        [back, y - 0.03, c - outerHalf],
        [back, y - 0.03, c + outerHalf],
        [back, y + 9.5, c + outerHalf],
        [back, y + 9.5, c - outerHalf],
      ],
      [1, 0, 0],
    );
  }
  for (let row = 1; row < cover.length; row++) {
    const before = tier ? cover[row - 1] : [cover[row - 1][0], cover[row - 1].at(-1)];
    const after = tier ? cover[row] : [cover[row][0], cover[row].at(-1)];
    for (let i = 1; i < before.length; i++)
      face(out, 'concrete', 'land', [before[i - 1], after[i - 1], after[i], before[i]], [0, 1, 0]);
    for (const [index, sign] of [
      [0, -1],
      [before.length - 1, 1],
    ]) {
      const a = before[index],
        b = after[index];
      face(
        out,
        'concrete',
        'land',
        [[a[0], y - 2.8, a[2]], [b[0], y - 2.8, b[2]], b, a],
        [0, 0, sign],
      );
    }
  }
  const wall = [
    cover.at(-1)[0][2],
    ...centers.flatMap((c) => [c - 8.47, c + 8.47]),
    cover.at(-1).at(-1)[2],
  ];
  for (let i = 0; i < wall.length - 1; i += 2)
    face(
      out,
      'concrete',
      'portal',
      [
        [mouth, y - 2, wall[i]],
        [mouth, y - 2, wall[i + 1]],
        [mouth, y + 10.28, wall[i + 1]],
        [mouth, y + 10.28, wall[i]],
      ],
      [1, 0, 0],
    );
  const wallRows = tier ? retainingEdges : retainingEdges.map((row) => [row[0], row.at(-1)]);
  for (const [i, rows] of wallRows.entries())
    for (let j = 1; j < rows.length; j++) {
      const [a, z, ha] = rows[j - 1],
        [b, , hb] = rows[j];
      if (Math.max(ha, hb) < y + 0.03) continue;
      const topA = Math.max(y + 0.04, ha),
        topB = Math.max(y + 0.04, hb);
      face(
        out,
        'concrete',
        'foundation',
        [
          [a, y - 2, z],
          [b, y - 2, z],
          [b, topB, z],
          [a, topA, z],
        ],
        [0, 0, i === 0 ? 1 : -1],
      );
    }
}
export function buildBridgeLevel(out, level) {
  const tier = detail[level];
  if (tier === undefined) throw Error('Unknown Pingtang Bridge level ' + level);
  girder(out, tier);
  for (const pylon of layout.pylons) {
    tower(out, pylon, tier);
    stays(out, pylon, tier);
  }
  for (const pier of layout.approachPiers) trestle(out, pier, tier);
  portal(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');

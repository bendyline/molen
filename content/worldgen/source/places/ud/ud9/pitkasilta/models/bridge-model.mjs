import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Individual bridge controls from the retained plan, ordinary exterior pictures
// and current viewer PMTiles. Heights and concealed sections are approximations.
export const bridgeControls = {
  anchor: [24.950172688, 60.17637339],
  heading: -1.519971523078,
  datum: 21,
  length: 57.002,
  width: 22.744,
  ends: [-28.501, 28.501],
  deck: 23.25,
  skew: 0,
  arches: [
    { name: 'north', a: -26.3, b: -10.4, spring: -1.7, rise: 2.3 },
    { name: 'central', a: -8.1, b: 8.2, spring: -1.7, rise: 2.45 },
    { name: 'south', a: 10.4, b: 26.3, spring: -1.7, rise: 2.3 },
  ],
  front: [
    [-28.501, 11.25],
    [28.501, 11.25],
  ],
  back: [
    [-28.501, -11.25],
    [28.501, -11.25],
  ],
  piers: [
    [-10.4, -8.1],
    [8.2, 10.4],
  ],
  tramCenters: [-1.48, 1.58],
  gauge: 1.0,
};
export const deckY = (x) => 2 + 0.25 * Math.max(0, 1 - (x * x) / (28.501 * 28.501));
const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: { slot: 'wall', graph: 'stone_granite', rgb: srgb('#b6a58f') },
  ring: { slot: 'trim', graph: 'stone_granite', rgb: srgb('#bdb19b') },
  coping: { slot: 'trim', graph: 'stone_granite', rgb: srgb('#9e9382') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#737b7c') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#989e98') },
  metal: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#727975') },
  paint: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#dfdccb') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
function interp(ps, x) {
  for (let i = 1; i < ps.length; i++)
    if (x <= ps[i][0]) {
      const a = ps[i - 1],
        b = ps[i],
        u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + u * (b[1] - a[1]);
    }
  return ps.at(-1)[1];
}
const sideZ = (x, s) => interp(s > 0 ? bridgeControls.front : bridgeControls.back, x);
const map = (x, y, z) => [
  x - bridgeControls.skew * z * Math.min(1, Math.max(0, (28.501 - Math.abs(x)) / 1.1)),
  y,
  z,
];
function face(o, m, p, n, tint = 1) {
  let N = normalFor(...p);
  if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    N = normalFor(...p);
  }
  o[p.length === 3 ? 'addTriangle' : 'addQuad'](
    m,
    'palette:#ffffff',
    p,
    N,
    undefined,
    palette[m].rgb.map((c) => c * tint),
  );
}
const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const archY = (a, u) => a.spring + a.rise * Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
function arches(o, t) {
  const n = [8, 16, 28, 40, 56][t];
  for (const a of bridgeControls.arches)
    for (let j = 0; j < n; j++) {
      const u = j / n,
        v = (j + 1) / n,
        x = a.a + (a.b - a.a) * u,
        X = a.a + (a.b - a.a) * v,
        y = archY(a, u),
        Y = archY(a, v);
      for (const s of [-1, 1]) {
        const z = sideZ(x, s),
          Z = sideZ(X, s),
          A = map(x, y, z),
          B = map(X, Y, Z);
        face(o, 'wall', [A, B, map(X, deckY(X) - 0.08, Z), map(x, deckY(x) - 0.08, z)], [0, 0, s]);
        if (t > 0) {
          const half = (a.b - a.a) / 2,
            outer = (x, y, u) => {
              const q = 2 * u - 1,
                n = [q / half, Math.sqrt(Math.max(0, 1 - q * q)) / a.rise],
                L = Math.hypot(...n);
              return [x + (n[0] / L) * 0.53, y + (n[1] / L) * 0.53];
            },
            c = outer(x, y, u),
            d = outer(X, Y, v),
            offset = s * 0.035;
          face(
            o,
            'ring',
            [
              map(x, y, z + offset),
              map(X, Y, Z + offset),
              map(d[0], d[1], Z + offset),
              map(c[0], c[1], z + offset),
            ],
            [0, 0, s],
            j % 4 === 0 ? 0.95 : 1,
          );
          if (t > 1 && j > 0)
            rod(
              o,
              'coping',
              map(x, y, z + s * 0.052),
              map(c[0], c[1], z + s * 0.052),
              0.018,
              0.018,
            );
        }
      }
      const z = sideZ(x, 1),
        Z = sideZ(X, 1),
        b = sideZ(x, -1),
        B = sideZ(X, -1);
      face(
        o,
        'wall',
        [map(x, y, z), map(x, y, b), map(X, Y, B), map(X, Y, Z)],
        [0, -1, 0],
        j % 5 === 0 ? 0.92 : 1,
      );
      if (t > 1 && j > 0)
        rod(o, 'coping', map(x, y - 0.006, z), map(x, y - 0.006, b), 0.018, 0.018);
    }
}
function supports(o, t) {
  const C = bridgeControls,
    spans = [[C.ends[0], C.arches[0].a], ...C.piers, [C.arches.at(-1).b, C.ends[1]]];
  for (const [a, b] of spans) {
    const xa = (a + b) / 2;
    for (const s of [-1, 1]) {
      const z = sideZ(a, s),
        Z = sideZ(b, s);
      face(
        o,
        'wall',
        [map(a, -6, z), map(b, -6, Z), map(b, deckY(b) - 0.08, Z), map(a, deckY(a) - 0.08, z)],
        [0, 0, s],
      );
    }
    for (const [x, s] of [
      [a, -1],
      [b, 1],
    ]) {
      const base = x === -28.501 || x === 28.501 ? deckY(x) - 0.08 : -1.7;
      face(
        o,
        'wall',
        [
          map(x, -6, sideZ(x, -1)),
          map(x, -6, sideZ(x, 1)),
          map(x, base, sideZ(x, 1)),
          map(x, base, sideZ(x, -1)),
        ],
        [s, 0, 0],
      );
    }
    face(
      o,
      'wall',
      [
        map(a, -6, sideZ(a, -1)),
        map(a, -6, sideZ(a, 1)),
        map(b, -6, sideZ(b, 1)),
        map(b, -6, sideZ(b, -1)),
      ],
      [0, -1, 0],
    );
    if (t > 0)
      for (const s of [-1, 1]) {
        const z = sideZ(xa, s),
          w = b - a;
        // Low battered pier face and narrow upper pilaster are bridge masonry,
        // not broad fabricated bank walls outside the retained crossing.
        const p = [
          [xa - w * 0.44, -3.8, z + s * 0.32],
          [xa + w * 0.44, -3.8, z + s * 0.32],
          [xa + w * 0.34, deckY(xa) - 0.1, z + s * 0.04],
          [xa - w * 0.34, deckY(xa) - 0.1, z + s * 0.04],
        ];
        face(o, 'wall', p, [0, 0, s]);
      }
  }
}
function deck(o, t) {
  const xs = [
    ...new Set([
      ...Array.from(
        { length: [9, 17, 29, 41, 57][t] },
        (_, i) => -28.501 + (i / [8, 16, 28, 40, 56][t]) * 57.002,
      ),
      ...bridgeControls.front.map((p) => p[0]),
      ...bridgeControls.back.map((p) => p[0]),
    ]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < xs.length; j++) {
    const a = xs[j - 1],
      b = xs[j],
      y = deckY(a),
      Y = deckY(b),
      fa = sideZ(a, 1),
      fb = sideZ(b, 1),
      ba = sideZ(a, -1),
      bb = sideZ(b, -1);
    face(o, 'road', [map(a, y, ba), map(b, Y, bb), map(b, Y, fb), map(a, y, fa)], [0, 1, 0]);
    if (t > 0)
      for (const side of [-1, 1]) {
        const za = side > 0 ? fa : ba,
          zb = side > 0 ? fb : bb,
          inner = side * 7.1,
          cycle = side * 9.75,
          h = 0.14 * Math.min(1, (28.501 - Math.abs((a + b) / 2)) / 1.3);
        face(
          o,
          'walk',
          [
            map(a, y + h, inner),
            map(b, Y + h, inner),
            map(b, Y + h, zb - side * 0.5),
            map(a, y + h, za - side * 0.5),
          ],
          [0, 1, 0],
        );
        if (h > 0.00001)
          face(
            o,
            'walk',
            [map(a, y, inner), map(b, Y, inner), map(b, Y + h, inner), map(a, y + h, inner)],
            [0, 0, -side],
          );
        if (t > 1)
          face(
            o,
            'paint',
            [
              map(a, y + h + 0.005, cycle),
              map(b, Y + h + 0.005, cycle),
              map(b, Y + h + 0.005, cycle + side * 0.07),
              map(a, y + h + 0.005, cycle + side * 0.07),
            ],
            [0, 1, 0],
          );
      }
    for (const s of [-1, 1]) {
      const za = s > 0 ? fa : ba,
        zb = s > 0 ? fb : bb,
        h = 0.96;
      face(
        o,
        'wall',
        [map(a, y - 0.1, za), map(b, Y - 0.1, zb), map(b, Y + h, zb), map(a, y + h, za)],
        [0, 0, s],
      );
      face(
        o,
        'wall',
        [
          map(a, y, za - s * 0.48),
          map(b, Y, zb - s * 0.48),
          map(b, Y + h, zb - s * 0.48),
          map(a, y + h, za - s * 0.48),
        ],
        [0, 0, -s],
      );
      face(
        o,
        'coping',
        [
          map(a, y + h, za + s * 0.055),
          map(b, Y + h, zb + s * 0.055),
          map(b, Y + h, zb - s * 0.535),
          map(a, y + h, za - s * 0.535),
        ],
        [0, 1, 0],
      );
      if (t > 0)
        for (const e of [0, h - 0.13])
          rod(
            o,
            'coping',
            map(a, y + e, za + s * 0.018),
            map(b, Y + e, zb + s * 0.018),
            0.065,
            0.065,
          );
    }
  }
  for (const x of bridgeControls.ends)
    for (const s of [-1, 1]) {
      const z = sideZ(x, s);
      face(
        o,
        'wall',
        [
          map(x, deckY(x), z),
          map(x, deckY(x), z - s * 0.48),
          map(x, deckY(x) + 0.96, z - s * 0.48),
          map(x, deckY(x) + 0.96, z),
        ],
        [Math.sign(x), 0, 0],
      );
    }
  // Broad slab panels and a few courses reinforce the common granite graph.
  if (t > 0)
    for (const side of [-1, 1])
      for (let i = 0; i < 22; i++) {
        const a = -28.1 + i * 2.56,
          b = Math.min(28.1, a + 2.48),
          z = side * 11.268;
        if (a >= 28.1) continue;
        const y = deckY(a),
          Y = deckY(b);
        face(
          o,
          'ring',
          [
            [a, y + 0.18, z],
            [b, Y + 0.18, z],
            [b, Y + 0.8, z],
            [a, y + 0.8, z],
          ],
          [0, 0, side],
          i % 3 === 0 ? 0.97 : 1,
        );
      }
  if (t > 1)
    for (const side of [-1, 1])
      for (let row = 0; row < 6; row++)
        for (let i = 0; i < 46; i++) {
          const y = -1.5 + row * 0.55,
            x = -28.1 + i * 1.24 + (row % 2) * 0.6,
            X = Math.min(28.1, x + 1.2);
          if (x >= 28.1) continue;
          const ceiling = (v) => {
            for (const a of bridgeControls.arches) {
              const q = (v - (a.a + a.b) / 2) / ((a.b - a.a) / 2);
              if (Math.abs(q) < 1)
                return a.spring + a.rise * Math.sqrt(Math.max(0, 1 - q * q)) + 0.56;
            }
            return -6;
          };
          if (y > ceiling(x) && y > ceiling(X) && y < Math.min(deckY(x), deckY(X)) - 0.25)
            rod(o, 'coping', [x, y, side * 11.278], [X, y, side * 11.278], 0.018, 0.018);
        }
}
function cutwaters(o, t) {
  for (const [a, b] of bridgeControls.piers)
    for (const side of [-1, 1]) {
      const z = side * 11.25,
        mid = (a + b) / 2,
        p = [
          [a, z],
          [b, z],
          [mid, z + side * 1.2],
        ],
        bottom = -6,
        top = -1.5;
      for (let i = 0; i < 3; i++) {
        const A = p[i],
          B = p[(i + 1) % 3];
        face(
          o,
          'wall',
          [
            [A[0], bottom, A[1]],
            [B[0], bottom, B[1]],
            [B[0], top, B[1]],
            [A[0], top, A[1]],
          ],
          [B[1] - A[1], 0, A[0] - B[0]],
        );
      }
      face(
        o,
        'ring',
        p.map(([x, z]) => [x, top, z]),
        [0, 1, 0],
      );
      if (t > 0) {
        const apex = [mid, -0.95, z],
          A = [a, top, z],
          B = [b, top, z],
          tip = [mid, top, z + side * 1.2];
        face(o, 'ring', [A, B, apex], [0, 1, 0]);
        face(o, 'ring', [A, apex, tip], [0, 1, side]);
        face(o, 'ring', [B, tip, apex], [0, 1, side]);
      }
    }
}
function transport(o, t) {
  if (t === 0) return;
  const C = bridgeControls,
    n = [0, 12, 24, 36, 48][t];
  for (let i = 0; i < n; i++) {
    const a = C.ends[0] + (i / n) * C.length,
      b = C.ends[0] + ((i + 1) / n) * C.length;
    for (const center of C.tramCenters)
      for (const offset of [-C.gauge / 2, C.gauge / 2]) {
        const z = center + offset;
        face(
          o,
          'metal',
          [
            [a, deckY(a) + 0.012, z - 0.035],
            [b, deckY(b) + 0.012, z - 0.035],
            [b, deckY(b) + 0.012, z + 0.035],
            [a, deckY(a) + 0.012, z + 0.035],
          ],
          [0, 1, 0],
        );
      }
  }
  if (t < 2) return;
  // Wire supports stand on the native banks. Only the crossing's contact and
  // suspension wires and six small suspended lamps belong to this source.
  for (const z of C.tramCenters)
    for (let i = 0; i < 12; i++) {
      const a = -28.5 + i * 4.75,
        b = a + 4.75,
        y = (x) => deckY(x) + 5.7 + (0.15 * x * x) / (28.5 * 28.5);
      rod(o, 'metal', [a, y(a), z], [b, y(b), z], 0.018, 0.018);
    }
  for (const x of [-18, 0, 18]) {
    const y = deckY(x) + 6.2;
    rod(o, 'metal', [x, y + 0.1, -11], [x, y + 0.1, 11], 0.014, 0.014);
    for (const z of [-5, 5]) {
      rod(o, 'metal', [x, y + 0.1, z], [x, y - 0.3, z], 0.025, 0.025);
      rod(o, 'metal', [x, y - 0.36, z], [x, y - 0.25, z], 0.38, 0.38);
    }
  }
  // Plain shallow geometric drops echo the photographed stone parapet motifs.
  for (const side of [-1, 1])
    for (const x of [-25, -15, -5, 5, 15, 25]) {
      const y = deckY(x),
        z = side * 11.29;
      const p = [
        [x - 0.16, y + 0.92, z],
        [x + 0.16, y + 0.92, z],
        [x + 0.16, y + 0.6, z],
        [x, y + 0.47, z],
        [x - 0.16, y + 0.6, z],
      ];
      for (let i = 1; i < p.length - 1; i++)
        face(o, 'coping', [p[0], p[i], p[i + 1]], [0, 0, side]);
    }
}
function bearings(o) {
  for (const side of [-1, 1]) {
    const x = side * 28.501,
      X = side * 28.801,
      y = deckY(x) + 0.003;
    face(
      o,
      'road',
      [
        [x, y, -7.1],
        [X, y, -7.1],
        [X, y, 7.1],
        [x, y, 7.1],
      ],
      [0, 1, 0],
    );
    face(
      o,
      'road',
      [
        [X, y - 0.12, -7.1],
        [X, y - 0.12, 7.1],
        [X, y, 7.1],
        [X, y, -7.1],
      ],
      [side, 0, 0],
    );
    for (const z of [-7.1, 7.1])
      face(
        o,
        'road',
        [
          [x, y - 0.12, z],
          [X, y - 0.12, z],
          [X, y, z],
          [x, y, z],
        ],
        [0, 0, Math.sign(z)],
      );
  }
}
export function buildBridgeLevel(o, level = 'master') {
  const t = tiers[level];
  if (t === undefined) throw Error(level);
  supports(o, t);
  arches(o, t);
  deck(o, t);
  cutwaters(o, t);
  transport(o, t);
  bearings(o);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Individual bridge controls from the retained plan, ordinary exterior pictures
// and current viewer PMTiles. Heights and concealed sections are approximations.
export const bridgeControls = {
  anchor: [30.316953067, 59.94262064],
  heading: -2.5232731292618964,
  datum: 29,
  length: 14.83,
  width: 16.134,
  ends: [-7.415, 7.415],
  deck: 32.6,
  skew: 0.012,
  arches: [{ name: 'Winter Canal', a: -5.65, b: 5.35, spring: -0.8, rise: 3.4 }],
  front: [
    [-7.415, 6.0],
    [-6.04, 7.7],
    [5.385, 7.528],
    [6.028, 8.067],
    [6.71, 7.09],
    [7.415, 6.089],
  ],
  back: [
    [-7.415, -8.067],
    [7.415, -8.051],
  ],
  stairs: [
    { a: -7.333814, b: -4.674174, side: -1, steps: 2 },
    { a: 3.705502, b: 7.35638, side: -1, steps: 3 },
    { a: 4.946458, b: 6.704033, side: 1, steps: 2 },
  ],
};
export const deckY = (x) => 3 + 0.6 * Math.max(0, 1 - (x * x) / (7.415 * 7.415));
const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: { slot: 'wall', graph: 'stone_granite', rgb: srgb('#b3aaa0') },
  ring: { slot: 'trim', graph: 'stone_granite', rgb: srgb('#beb1a1') },
  coping: { slot: 'trim', graph: 'stone_granite', rgb: srgb('#a59b90') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#737674') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#b6afa3') },
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
  x - bridgeControls.skew * z * Math.min(1, Math.max(0, (7.415 - Math.abs(x)) / 1.1)),
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
    spans = [
      [C.ends[0], C.arches[0].a],
      [C.arches[0].b, C.ends[1]],
    ];
  for (const [a, b] of spans) {
    const xa = (a + b) / 2;
    for (const s of [-1, 1]) {
      const z = sideZ(a, s),
        Z = sideZ(b, s);
      face(
        o,
        'wall',
        [map(a, -4, z), map(b, -4, Z), map(b, deckY(b) - 0.08, Z), map(a, deckY(a) - 0.08, z)],
        [0, 0, s],
      );
    }
    for (const [x, s] of [
      [a, -1],
      [b, 1],
    ]) {
      const base = x === -7.415 || x === 7.415 ? deckY(x) - 0.08 : -0.8;
      face(
        o,
        'wall',
        [
          map(x, -4, sideZ(x, -1)),
          map(x, -4, sideZ(x, 1)),
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
        map(a, -4, sideZ(a, -1)),
        map(a, -4, sideZ(a, 1)),
        map(b, -4, sideZ(b, 1)),
        map(b, -4, sideZ(b, -1)),
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
        (_, i) => -7.415 + (i / [8, 16, 28, 40, 56][t]) * 14.83,
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
    for (const s of [-1, 1]) {
      const za = s > 0 ? fa : ba,
        zb = s > 0 ? fb : bb,
        h = 1.02;
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
  // A few broad courses reinforce the granite graph, following the actual
  // parapet crown and leaving the open barrel free of decorative crossbars.
  if (t > 1)
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 10; i++) {
          const x = -7.15 + i * 1.44 + (row % 2) * 0.25,
            X = Math.min(7.3, x + 1.3),
            y = deckY(x) + 0.16 + row * 0.24,
            Y = deckY(X) + 0.16 + row * 0.24,
            z = sideZ(x, side) + side * 0.014,
            Z = sideZ(X, side) + side * 0.014;
          face(
            o,
            'ring',
            [map(x, y, z), map(X, Y, Z), map(X, Y + 0.2, Z), map(x, y + 0.2, z)],
            [0, 0, side],
            i % 3 === 0 ? 0.96 : 1,
          );
        }
  if (t > 1)
    for (const side of [-1, 1])
      for (let row = 0; row < 6; row++) {
        const y = -0.55 + row * 0.55;
        for (let i = 0; i < 13; i++) {
          const x = -7.05 + i * 1.1 + (row % 2) * 0.5,
            X = Math.min(7.2, x + 1.06),
            a = bridgeControls.arches[0];
          if (x >= 7.2 || X <= x) continue;
          const ceiling = (v) => {
            const q = (v - (a.a + a.b) / 2) / ((a.b - a.a) / 2);
            return Math.abs(q) < 1
              ? a.spring + a.rise * Math.sqrt(Math.max(0, 1 - q * q)) + 0.54
              : -4;
          };
          if (y > ceiling(x) && y > ceiling(X) && y < Math.min(deckY(x), deckY(X)) - 0.25)
            rod(
              o,
              'coping',
              map(x, y, sideZ(x, side) + side * 0.019),
              map(X, y, sideZ(X, side) + side * 0.019),
              0.018,
              0.018,
            );
        }
      }
}
function walks(o, t) {
  if (t === 0) return;
  const C = bridgeControls,
    height = (x, side) => {
      const r = C.stairs.find((s) => s.side === side && x >= s.a && x <= s.b);
      if (!r) return deckY(x) + 0.16;
      const u = (x - r.a) / (r.b - r.a),
        step = Math.min(r.steps - 1, Math.floor(u * r.steps)),
        v = (step + 0.5) / r.steps;
      return deckY(r.a) + 0.16 + v * (deckY(r.b) - deckY(r.a));
    };
  for (const side of [-1, 1]) {
    const xs = [
      ...new Set([
        C.ends[0],
        C.ends[1],
        ...Array.from(
          { length: [0, 13, 25, 37, 49][t] },
          (_, i) => C.ends[0] + (i / [0, 12, 24, 36, 48][t]) * (C.ends[1] - C.ends[0]),
        ),
        ...C.stairs
          .filter((r) => r.side === side)
          .flatMap((r) =>
            Array.from({ length: r.steps + 1 }, (_, i) => r.a + (i / r.steps) * (r.b - r.a)),
          ),
      ]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        y = height(a + 1e-6, side),
        Y = height(b - 1e-6, side),
        z = sideZ(a, side) - side * 0.5,
        Z = sideZ(b, side) - side * 0.5,
        inner = side * 4.45;
      face(o, 'walk', [map(a, y, inner), map(b, Y, inner), map(b, Y, Z), map(a, y, z)], [0, 1, 0]);
      face(
        o,
        'walk',
        [
          map(a, deckY(a) - 0.01, inner),
          map(b, deckY(b) - 0.01, inner),
          map(b, Y, inner),
          map(a, y, inner),
        ],
        [0, 0, -side],
      );
      if (i < xs.length - 1) {
        const next = height(b + 1e-6, side);
        if (Math.abs(next - Y) > 0.001)
          face(
            o,
            'walk',
            [map(b, Y, inner), map(b, Y, Z), map(b, next, Z), map(b, next, inner)],
            [next > Y ? -1 : 1, 0, 0],
          );
      }
    }
  }
}
export function buildBridgeLevel(o, level = 'master') {
  const t = tiers[level];
  if (t === undefined) throw Error(level);
  supports(o, t);
  arches(o, t);
  deck(o, t);
  walks(o, t);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Individual bridge controls from the retained plan, ordinary exterior pictures
// and current viewer PMTiles. Heights and concealed sections are approximations.
export const bridgeControls = {
  anchor: [-6.299929722, 53.372900987],
  heading: 1.486138613552,
  datum: 35,
  length: 30.933,
  width: 8.28,
  ends: [-15.467, 15.467],
  deck: 41.55,
  skew: 0.21,
  arches: [
    { name: 'railway', a: -13.4, b: -0.4, spring: -1.5, rise: 6.5 },
    { name: 'canal-and-towpath', a: 0.9, b: 14.15, spring: -1.65, rise: 5.85 },
  ],
  front: [
    [-15.467, 4.14],
    [-2.296, 2.942],
    [9.473, 4.057],
    [10.374, 4.14],
    [15.289, 3.996],
    [15.467, 3.96],
  ],
  back: [
    [-15.467, -3.04],
    [-14.967, -3.001],
    [0.577, -4.14],
    [12.088, -2.784],
    [15.467, -2.857],
  ],
};
export const deckY = (x) =>
  5 -
  (0.4 * (x + 15.467)) / 30.934 +
  1.75 * Math.pow(Math.max(0, 1 - (x * x) / (14.4 * 14.4)), 1.3);
const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: { slot: 'wall', graph: 'stone_granite', rgb: srgb('#969c96') },
  ring: { slot: 'trim', graph: 'stone_limestone', rgb: srgb('#adafa4') },
  coping: { slot: 'trim', graph: 'stone_granite', rgb: srgb('#777c76') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#737b7c') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#989e98') },
  plate: { slot: 'trim', graph: 'stone_limestone', rgb: srgb('#ccc7af') },
  bronze: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#ac9464') },
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
  x - bridgeControls.skew * z * Math.min(1, Math.max(0, (15.467 - Math.abs(x)) / 1.1)),
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
      [C.arches[0].b, C.arches[1].a],
      [C.arches[1].b, C.ends[1]],
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
      const base = x === -15.467 || x === 15.467 ? deckY(x) - 0.08 : x < 0 ? -1.5 : -1.65;
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
        (_, i) => -15.467 + (i / [8, 16, 28, 40, 56][t]) * 30.934,
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
    if (t > 0) {
      face(
        o,
        'walk',
        [
          map(a, y + 0.12, fa - 1.65),
          map(b, Y + 0.12, fb - 1.65),
          map(b, Y + 0.12, fb - 0.5),
          map(a, y + 0.12, fa - 0.5),
        ],
        [0, 1, 0],
      );
      face(
        o,
        'walk',
        [
          map(a, y, fa - 1.65),
          map(b, Y, fb - 1.65),
          map(b, Y + 0.12, fb - 1.65),
          map(a, y + 0.12, fa - 1.65),
        ],
        [0, 0, -1],
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
  // Quiet, sparse broad stones supplement the reusable granite graph. They do
  // not cover the vault or introduce photo-derived pixels/readable graffiti.
  if (t > 1)
    for (const s of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 17; i++) {
          const x = -14.6 + i * 1.72 + (row % 2) * 0.38;
          if (x > 15) continue;
          const X = x + 1.08,
            y = deckY(x) + 0.14 + row * 0.23,
            Y = deckY(X) + 0.14 + row * 0.23,
            z = sideZ(x, s) + s * 0.014,
            Z = sideZ(X, s) + s * 0.014;
          face(
            o,
            'ring',
            [map(x, y, z), map(X, Y, Z), map(X, Y + 0.18, Z), map(x, y + 0.18, z)],
            [0, 0, s],
            0.9 + (i % 3) * 0.025,
          );
        }
}
function plaques(o, t) {
  if (t === 0) return;
  // Plain material panels evoke the canal-side commemoration without invented
  // readable lettering, modeled portraits or baked exterior photo textures.
  const x = 14.05,
    y = deckY(x) - 0.18,
    z = sideZ(x, 1) + 0.065;
  face(
    o,
    'plate',
    [
      map(x - 0.35, y - 0.33, z),
      map(x + 0.35, y - 0.33, z),
      map(x + 0.35, y + 0.18, z),
      map(x - 0.35, y + 0.18, z),
    ],
    [0, 0, 1],
  );
  if (t > 1) {
    const cx = 13.4,
      cy = y - 0.05,
      r = 0.21,
      n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      face(
        o,
        'bronze',
        [
          map(cx, cy, z + 0.02),
          map(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + 0.02),
          map(cx + Math.cos(b) * r, cy + Math.sin(b) * r, z + 0.02),
        ],
        [0, 0, 1],
      );
    }
  }
}
export function buildBridgeLevel(o, level = 'master') {
  const t = tiers[level];
  if (t === undefined) throw Error(level);
  supports(o, t);
  arches(o, t);
  deck(o, t);
  plaques(o, t);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

import {
  beam,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const bridgeControls = {
  id: 'ponte_giuseppe_mazzini',
  anchor: [12.465997072534, 41.896063244046],
  heading: 0.7587772347645159,
  datum: 10,
  ends: [-54.2, 54.2],
  centerZ: 0,
  halfWidth: 8.933,
  roadHalfWidth: 5.65,
  foundationY: -4,
  openings: [
    [-50.6, -18.8],
    [-14.2, 14.2],
    [18.8, 50.6],
  ],
  mainPiers: [-16.5, 16.5],
  lampStations: [-50, -16.5, 16.5, 50],
  ownedRoadId: 35184396698369,
  ownedSidewalkIds: [35185731347560],
  underRoutes: [
    { id: 35184456292657, station: -47.638124 },
    { id: 35184602133230, station: 45.416685 },
  ],
};
export const deckY = (x) => 13 + 0.25 * (1 - (x / 54.2) * (x / 54.2));
export const archY = (x, opening) => {
  const [a, b] = opening,
    m = (a + b) / 2,
    h = (b - a) / 2,
    r = (h * h + 6.5 * 6.5) / (2 * 6.5);
  return 4.2 - r + 6.5 + Math.sqrt(Math.max(0, r * r - (x - m) * (x - m)));
};
const linear = (h) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    stone: { slot: 'wall', graph: 'stone_ashlar', rgb: linear('#c9c3ae') },
    trim: { slot: 'trim', graph: 'stone_travertine', rgb: linear('#d6d1bd') },
    bronze: { slot: 'trim', graph: 'metal_bronze_cast', rgb: linear('#495d50') },
    road: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#737b7b') },
    walk: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#b5b3a6') },
    mark: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#dddacc') },
    globe: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#d6d7c8') },
  };
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...m }]) => [k, m]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildBridgeLevel(o, level = 'master') {
  const C = bridgeControls,
    t = tiers[level],
    color = (m) => palette[m].rgb,
    face = (m, p, n, tint = 1) => {
      let N = normalFor(...p);
      if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
        p = p.toReversed();
        N = normalFor(...p);
      }
      if (
        p.length === 4 &&
        Math.abs(p[3].reduce((s, v, i) => s + (v - p[0][i]) * N[i], 0)) > 1e-6
      ) {
        face(m, [p[0], p[1], p[2]], n, tint);
        face(m, [p[0], p[2], p[3]], n, tint);
        return;
      }
      o[p.length === 3 ? 'addTriangle' : p.length === 4 ? 'addQuad' : 'addConvexPolygon'](
        m,
        'palette:#fff',
        p,
        N,
        undefined,
        color(m).map((v) => v * tint),
      );
    },
    rod = (m, a, b, w, d = w) => beam(o, m, a, b, w, d, color(m));
  const box = (m, x0, x1, z0, z1, y0, y1) => {
    const a = [x0, y0, z0],
      b = [x1, y0, z0],
      c = [x1, y0, z1],
      d = [x0, y0, z1],
      A = [x0, y1, z0],
      B = [x1, y1, z0],
      D = [x0, y1, z1],
      E = [x1, y1, z1];
    for (const [p, n] of [
      [
        [a, b, c, d],
        [0, -1, 0],
      ],
      [
        [A, D, E, B],
        [0, 1, 0],
      ],
      [
        [a, A, B, b],
        [0, 0, -1],
      ],
      [
        [d, c, E, D],
        [0, 0, 1],
      ],
      [
        [a, d, D, A],
        [-1, 0, 0],
      ],
      [
        [b, B, E, c],
        [1, 0, 0],
      ],
    ])
      face(m, p, n);
  };
  const band = (m, x0, x1, z0, z1, low, high, segments = 1) => {
    for (let i = 0; i < segments; i++) {
      const a = x0 + ((x1 - x0) * i) / segments,
        b = x0 + ((x1 - x0) * (i + 1)) / segments,
        L = typeof low === 'function' ? low(a) : low,
        R = typeof low === 'function' ? low(b) : low,
        H = typeof high === 'function' ? high(a) : high,
        J = typeof high === 'function' ? high(b) : high;
      face(
        m,
        [
          [a, H, z0],
          [b, J, z0],
          [b, J, z1],
          [a, H, z1],
        ],
        [0, 1, 0],
      );
      if (L === H && R === J) continue;
      face(
        m,
        [
          [a, L, z0],
          [a, L, z1],
          [b, R, z1],
          [b, R, z0],
        ],
        [0, -1, 0],
      );
      for (const [z, s] of [
        [z0, -1],
        [z1, 1],
      ])
        face(
          m,
          [
            [a, L, z],
            [b, R, z],
            [b, J, z],
            [a, H, z],
          ],
          [0, 0, s],
        );
    }
    if (low !== high)
      for (const [x, s] of [
        [x0, -1],
        [x1, 1],
      ])
        if (
          (typeof low === 'function' ? low(x) : low) !==
          (typeof high === 'function' ? high(x) : high)
        )
          face(
            m,
            [
              [x, typeof low === 'function' ? low(x) : low, z0],
              [x, typeof low === 'function' ? low(x) : low, z1],
              [x, typeof high === 'function' ? high(x) : high, z1],
              [x, typeof high === 'function' ? high(x) : high, z0],
            ],
            [s, 0, 0],
          );
  };
  const steps = [6, 10, 18, 28, 36][t];
  for (const opening of C.openings) {
    const [a, b] = opening;
    band(
      'stone',
      a,
      b,
      -8.35,
      8.35,
      (x) => archY(x, opening),
      (x) => deckY(x) - 0.25,
      steps,
    );
    if (t > 0)
      for (const side of [-1, 1])
        for (let i = 0; i < steps; i++) {
          const gap = t > 1 ? 0.035 : 0,
            x = a + ((b - a) * i) / steps + gap / 2,
            X = a + ((b - a) * (i + 1)) / steps - gap / 2,
            z = side * 8.38;
          face(
            'trim',
            [
              [x, archY(x, opening), z],
              [X, archY(X, opening), z],
              [X, archY(X, opening) + 0.77, z],
              [x, archY(x, opening) + 0.77, z],
            ],
            [0, 0, side],
            1 - (i % 4) * 0.018,
          );
        }
  }
  for (const [a, b] of [
    [-54.2, -50.6],
    [-18.8, -14.2],
    [14.2, 18.8],
    [50.6, 54.2],
  ])
    band('stone', a, b, -8.35, 8.35, C.foundationY, (x) => deckY(x) - 0.25);
  for (const x of C.mainPiers) {
    const n = t === 0 ? 4 : 6,
      ring = (y, r) => [
        ...Array.from({ length: n + 1 }, (_, i) => {
          const a = (-i / n) * Math.PI;
          return [x + r * Math.cos(a), y, -7.8 + r * Math.sin(a)];
        }),
        ...Array.from({ length: n + 1 }, (_, i) => {
          const a = -Math.PI - (i / n) * Math.PI;
          return [x + r * Math.cos(a), y, 7.8 + r * Math.sin(a)];
        }),
      ];
    loft(o, 'stone', [ring(C.foundationY, 2.8), ring(4.15, 2.38)], color('stone'));
    if (t > 0) {
      loft(o, 'trim', [ring(-0.5, 3.0), ring(0.1, 2.85)], color('trim'));
      loft(o, 'trim', [ring(4.05, 2.65), ring(4.45, 2.65), ring(4.7, 2.38)], color('trim'));
    }
  }
  const seg = t === 0 ? 2 : 6;
  band('road', -54.2, 54.2, -5.65, 5.65, deckY, deckY, seg);
  for (const side of [-1, 1]) {
    band(
      'walk',
      -54.2,
      54.2,
      Math.min(side * 5.65, side * 8.6),
      Math.max(side * 5.65, side * 8.6),
      (x) => deckY(x) + 0.12,
      (x) => deckY(x) + 0.12,
      seg,
    );
    band(
      'trim',
      -54.2,
      54.2,
      side * 8.42 - 0.28,
      side * 8.42 + 0.28,
      (x) => deckY(x) - 0.2,
      (x) => deckY(x) + 0.12,
      seg,
    );
    band(
      'trim',
      -54.2,
      54.2,
      side * 8.46 - 0.25,
      side * 8.46 + 0.25,
      (x) => deckY(x) + 1.12,
      (x) => deckY(x) + 1.3,
      seg,
    );
    const posts = [
      ...new Set([
        -54.2,
        ...Array.from({ length: t < 2 ? 13 : 33 }, (_, i) => -51 + (i * 102) / (t < 2 ? 12 : 32)),
        54.2,
        ...C.lampStations,
      ]),
    ].sort((a, b) => a - b);
    for (const x of posts) {
      const y = deckY(x);
      box('trim', x - 0.22, x + 0.22, side * 8.45 - 0.25, side * 8.45 + 0.25, y + 0.12, y + 1.14);
      if (t > 1)
        box('trim', x - 0.29, x + 0.29, side * 8.45 - 0.31, side * 8.45 + 0.31, y + 1.12, y + 1.37);
    }
    if (t > 1)
      for (let x = -52.5; x < 52.5; x += t === 2 ? 1.5 : 0.7) {
        const n = t === 2 ? 6 : 10,
          r = 0.32,
          R = 0.22,
          y = deckY(x) + 0.65,
          z = side * 8.45,
          d = 0.12;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2,
            A = [x + r * Math.cos(a), y + r * Math.sin(a)],
            B = [x + r * Math.cos(b), y + r * Math.sin(b)],
            I = [x + R * Math.cos(a), y + R * Math.sin(a)],
            J = [x + R * Math.cos(b), y + R * Math.sin(b)];
          for (const [s, Z] of [
            [-1, z - d],
            [1, z + d],
          ])
            face(
              'trim',
              [
                [...A, Z],
                [...B, Z],
                [...J, Z],
                [...I, Z],
              ],
              [0, 0, s],
            );
          for (const [u, v, norm] of [
            [A, B, [Math.cos(a), Math.sin(a), 0]],
            [J, I, [-Math.cos(a), -Math.sin(a), 0]],
          ])
            face(
              'trim',
              [
                [...u, z - d],
                [...v, z - d],
                [...v, z + d],
                [...u, z + d],
              ],
              norm,
            );
        }
      }
  }
  const lamp = (x, z, short = false) => {
    const y = deckY(x) + 0.16,
      H = short ? 3 : 4.9,
      n = t < 2 ? 6 : 10,
      rings = [
        [0, 0.35],
        [0.2, 0.42],
        [0.45, 0.25],
        [1, 0.22],
        [1.2, 0.48],
        [1.5, 0.24],
        [H - 0.7, 0.13],
        [H - 0.4, 0.24],
      ].map(([h, r]) =>
        Array.from({ length: n }, (_, i) => [
          x + r * Math.cos((i / n) * Math.PI * 2),
          y + h,
          z - r * Math.sin((i / n) * Math.PI * 2),
        ]),
      );
    loft(o, 'bronze', rings, color('bronze'));
    sphere(
      o,
      'globe',
      [x, y + H, z],
      [0.25, 0.33, 0.25],
      color('globe'),
      t < 2 ? 6 : 10,
      t < 2 ? 3 : 5,
    );
    if (t > 1) {
      for (const side of [-1, 1]) {
        const base = [x, y + 1.1, z + side * 0.18],
          tip = [x, y + 1.8, z + side * 0.94];
        rod('bronze', base, tip, 0.24, 0.18);
        rod('bronze', tip, [x, y + 1.92, z + side * 0.73], 0.2, 0.16);
        sphere(
          o,
          'bronze',
          [x, y + 1.42, z + side * 0.52],
          [0.19, 0.24, 0.32],
          color('bronze'),
          8,
          4,
        );
      }
      rod('bronze', [x, y + H + 0.3, z], [x, y + H + 0.54, z], 0.06);
    }
  };
  if (t > 0)
    for (const x of C.lampStations)
      for (const side of [-1, 1]) {
        const z = side * 8.05,
          y = deckY(x);
        box('trim', x - 0.65, x + 0.65, z - 0.64, z + 0.64, y + 0.1, y + 1.0);
        lamp(x, z);
      }
  if (t > 1)
    for (const x of [-34.7, 0, 34.7]) for (const side of [-1, 1]) lamp(x, side * 8.25, true);
  if (t > 1) {
    for (let x = -52; x < 50; x += 6)
      face(
        'mark',
        [
          [x, deckY(x) + 0.006, -0.05],
          [x + 3, deckY(x + 3) + 0.006, -0.05],
          [x + 3, deckY(x + 3) + 0.006, 0.05],
          [x, deckY(x) + 0.006, 0.05],
        ],
        [0, 1, 0],
      );
    for (const side of [-1, 1])
      band(
        'mark',
        -54.2,
        54.2,
        side * 5.4 - 0.05,
        side * 5.4 + 0.05,
        (x) => deckY(x) + 0.006,
        (x) => deckY(x) + 0.006,
        6,
      );
  }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

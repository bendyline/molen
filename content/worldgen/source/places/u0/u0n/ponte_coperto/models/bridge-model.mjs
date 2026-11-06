import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const bridgeControls = {
  id: 'ponte_coperto',
  anchor: [9.153186835354, 45.180638254145],
  heading: 1.28951534915485,
  datum: 53,
  ends: [-92.26, 92.26],
  centerZ: 0,
  halfWidth: 6.3385,
  roadHalfWidth: 3.35,
  foundationY: -7,
  mainPiers: [-47.35, -1.35, 29.5, 60.5],
  openings: [
    [-89.56, -50],
    [-44.7, -4],
    [1.3, 26.85],
    [32.15, 57.85],
    [63.15, 89.56],
  ],
  columnStationEnds: [-89, 89],
  profile: [
    [-92.26, 6.8],
    [-58, 11.0],
    [-20, 15.0],
    [16, 16.0],
    [54, 18.3],
    [92.26, 17.5],
  ],
  ownedRoadId: 35184802812090,
  ownedSidewalkIds: [35185539612940],
  ownedChapelBuilding: 52776573924436,
  chapel: { centerX: -1.35, backZ: -5.7, frontZ: -10.5, width: 7.28 },
  heightStatus:
    'Provisional ordinary-photo/global-terrain exterior controls; not yet native-fit or readiness approved.',
};
export const deckY = (x) => {
  const p = bridgeControls.profile;
  for (let i = 1; i < p.length; i++)
    if (x <= p[i][0]) {
      const a = p[i - 1],
        b = p[i],
        u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + (b[1] - a[1]) * u;
    }
  return p.at(-1)[1];
};
const lin = (h) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    brick: { slot: 'wall', graph: 'brick', rgb: lin('#ba8967') },
    stone: { slot: 'trim', graph: 'stone_granite', rgb: lin('#c9c4ae') },
    tile: { slot: 'roof', graph: 'tile_flat', rgb: lin('#ae6247') },
    wood: { slot: 'trim', graph: 'wood_plain', rgb: lin('#76624d') },
    road: { slot: 'foundation', graph: 'concrete_plain', rgb: lin('#747979') },
    walk: { slot: 'foundation', graph: 'concrete_plain', rgb: lin('#aaa89a') },
    dark: { slot: 'foundation', graph: 'concrete_plain', rgb: lin('#454a46') },
    mark: { slot: 'foundation', graph: 'concrete_plain', rgb: lin('#d7d4c1') },
  };
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...m }]) => [k, m]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildBridgeLevel(o, level = 'master') {
  const C = bridgeControls,
    t = tiers[level],
    rgb = (m) => palette[m].rgb,
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
        rgb(m).map((v) => v * tint),
      );
    },
    rod = (m, a, b, w, d = w) => beam(o, m, a, b, w, d, rgb(m));
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
  const extrude = (m, a, b, z0, z1, lo, hi, steps = 1) => {
    for (let i = 0; i < steps; i++) {
      const x = a + ((b - a) * i) / steps,
        X = a + ((b - a) * (i + 1)) / steps,
        L = lo(x),
        R = lo(X),
        H = hi(x),
        J = hi(X);
      face(
        m,
        [
          [x, H, z0],
          [X, J, z0],
          [X, J, z1],
          [x, H, z1],
        ],
        [0, 1, 0],
      );
      if (L === H && R === J) continue;
      face(
        m,
        [
          [x, L, z0],
          [x, L, z1],
          [X, R, z1],
          [X, R, z0],
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
            [x, L, z],
            [X, R, z],
            [X, J, z],
            [x, H, z],
          ],
          [0, 0, s],
        );
    }
    if (t > 0)
      for (const [x, s] of [
        [a, -1],
        [b, 1],
      ])
        if (lo(x) !== hi(x))
          face(
            m,
            [
              [x, lo(x), z0],
              [x, lo(x), z1],
              [x, hi(x), z1],
              [x, hi(x), z0],
            ],
            [s, 0, 0],
          );
  };
  const ends = [C.ends[0], ...C.mainPiers, C.ends[1]],
    segments = [3, 8, 16, 24, 32][t];
  for (let j = 0; j < 5; j++) {
    const [a, b] = C.openings[j],
      mid = (a + b) / 2,
      half = (b - a) / 2,
      rise = Math.min(8.7, deckY(mid) - 1.9),
      R = (half * half + rise * rise) / (2 * rise),
      under = (x) =>
        deckY(x) - 0.9 - rise + Math.sqrt(Math.max(0, R * R - (x - mid) * (x - mid))) - (R - rise);
    extrude('brick', a, b, -6.18, 6.18, under, (x) => deckY(x) - 0.18, segments);
    if (t > 0)
      for (const side of [-1, 1])
        for (let i = 0; i < segments; i++) {
          const gap = t > 1 ? 0.035 : 0,
            x = a + ((b - a) * i) / segments + gap / 2,
            X = a + ((b - a) * (i + 1)) / segments - gap / 2,
            z = side * 6.205;
          face(
            'stone',
            [
              [x, under(x), z],
              [X, under(X), z],
              [X, under(X) + 0.56, z],
              [x, under(x) + 0.56, z],
            ],
            [0, 0, side],
            1 - (i % 5) * 0.012,
          );
        }
  }
  for (let j = 0; j < ends.length; j++) {
    const x = ends[j],
      half = j === 0 || j === 5 ? 2.7 : 2.65,
      y = deckY(x) - 0.18;
    box(
      'brick',
      Math.max(-92.26, x - half),
      Math.min(92.26, x + half),
      -6.18,
      6.18,
      C.foundationY,
      y,
    );
    if (j > 0 && j < 5) {
      const chapelPier = Math.abs(x - C.chapel.centerX) < 0.01,
        tip = chapelPier ? 10.9 : t === 0 ? 9.1 : 10.1,
        ring = (Y, w) =>
          [
            [x - w, Y, -6.4],
            [x, Y, -tip],
            [x + w, Y, -6.4],
            [x + w, Y, 6.4],
            [x, Y, tip],
            [x - w, Y, 6.4],
          ].toReversed();
      loft(
        o,
        'stone',
        [
          ring(C.foundationY, 3.05),
          ring(chapelPier ? deckY(x) - 1 : Math.max(1.0, deckY(x) - 9.3), 2.65),
        ],
        rgb('stone'),
      );
    }
  }
  const xs = [
    ...new Set([
      ...C.profile.map((p) => p[0]),
      -89.5,
      -88.2,
      ...(t === 0 ? [] : [...ends, -84.3, 89.5]),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    extrude('road', a, b, -3.35, 3.35, deckY, deckY);
    for (const side of [-1, 1]) {
      const z0 = Math.min(
          side * 3.35,
          side * ((a + b) / 2 > -88.2 && (a + b) / 2 < -84.3 ? 6.6 : 6.25),
        ),
        z1 = Math.max(
          side * 3.35,
          side * ((a + b) / 2 > -88.2 && (a + b) / 2 < -84.3 ? 6.6 : 6.25),
        );
      const walkY = (x, z) => {
        const base = deckY(x) + 0.12,
          w =
            Math.max(0, Math.min(1, (z - 4.8) / 0.95)) *
            Math.max(0, Math.min(1, (-88.2 - x) / 1.3));
        return base - w * Math.max(0, base - deckY(-90.3479683));
      };
      const zs = side === 1 && a < -88.2 ? [z0, 4.8, 5.75, z1] : [z0, z1];
      for (let k = 1; k < zs.length; k++) {
        const z = zs[k - 1],
          Z = zs[k];
        face(
          'walk',
          [
            [a, walkY(a, z), z],
            [b, walkY(b, z), z],
            [b, walkY(b, Z), Z],
            [a, walkY(a, Z), Z],
          ],
          [0, 1, 0],
        );
      }
      if (Math.abs((a + b) / 2) < 89.5 && !((a + b) / 2 > -88.2 && (a + b) / 2 < -84.3)) {
        extrude(
          'brick',
          a,
          b,
          side * 6.05 - 0.25,
          side * 6.05 + 0.25,
          (x) => deckY(x) - 0.18,
          (x) => deckY(x) + 1.05,
        );
        extrude(
          'stone',
          a,
          b,
          side * 6.05 - 0.32,
          side * 6.05 + 0.32,
          (x) => deckY(x) + 1.05,
          (x) => deckY(x) + 1.18,
        );
      }
    }
  }
  const columnCount = [9, 32, 64, 64, 66][t],
    stations = Array.from({ length: columnCount }, (_, i) => -89 + (i / (columnCount - 1)) * 178);
  for (const x of stations)
    for (const side of [-1, 1]) {
      if ((side === -1 && x > -5.1 && x < 2.4) || (x > -88.2 && x < -84.3)) continue;
      const y = deckY(x),
        z = side * 5.95;
      if (t < 2) box('stone', x - 0.25, x + 0.25, z - 0.25, z + 0.25, y + 1.18, y + 4.05);
      else {
        const ring = (h, w) =>
          [
            [-w, -w],
            [-w, w],
            [w, w],
            [w, -w],
          ].map(([X, Z]) => [x + X, y + h, z + Z]);
        loft(
          o,
          'stone',
          [
            ring(1.18, 0.36),
            ring(1.36, 0.32),
            ring(1.5, 0.25),
            ring(3.76, 0.25),
            ring(3.92, 0.36),
            ring(4.05, 0.38),
          ],
          rgb('stone'),
        );
      }
    }
  // Both roof faces and the timber underside remain open above the roadway.
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      y = deckY(a),
      Y = deckY(b);
    for (const side of [-1, 1]) {
      const z = side * 6.8;
      face(
        'tile',
        [
          [a, y + 6.2, 0],
          [b, Y + 6.2, 0],
          [b, Y + 4.05, z],
          [a, y + 4.05, z],
        ],
        [0, 1, side],
      );
      if (t > 0) {
        face(
          'wood',
          [
            [a, y + 6.02, 0],
            [a, y + 3.87, z],
            [b, Y + 3.87, z],
            [b, Y + 6.02, 0],
          ],
          [0, -1, -side],
        );
        rod('wood', [a, y + 3.92, side * 5.95], [b, Y + 3.92, side * 5.95], 0.28, 0.32);
      }
    }
    if (t > 1) rod('tile', [a, y + 6.22, 0], [b, Y + 6.22, 0], 0.28, 0.26);
  }
  if (t > 1)
    for (let x = -88; x < 90; x += t === 2 ? 7.0 : 3.5) {
      const y = deckY(x);
      rod('wood', [x, y + 3.82, -5.95], [x, y + 3.82, 5.95], 0.2, 0.28);
      for (const side of [-1, 1]) {
        rod('wood', [x, y + 3.85, side * 5.95], [x, y + 6.0, 0], 0.18, 0.22);
        rod('wood', [x, y + 3.83, side * 3.7], [x, y + 5.15, side * 2.7], 0.14, 0.16);
      }
      rod('wood', [x, y + 3.82, 0], [x, y + 6, 0], 0.14, 0.16);
    }
  // Three real portal openings: the road arch and the two side pedestrian arches.
  for (const x of C.ends) {
    const y = deckY(x),
      openings = [
        [-6.25, -4.25, 2.15, 0.8],
        [-3.55, 3.55, 3.1, 1.15],
        [4.25, 6.25, 2.15, 0.8],
      ],
      walls = [
        [-6.65, -6.25],
        [-4.25, -3.55],
        [3.55, 4.25],
        [6.25, 6.65],
      ];
    for (const [a, b] of walls) box('brick', x - 0.7, x + 0.7, a, b, y, y + 7.3);
    for (const [a, b, spring, rise] of openings) {
      const n = t === 0 ? 2 : t === 1 ? 4 : t === 2 ? 8 : 12,
        mid = (a + b) / 2,
        half = (b - a) / 2,
        h = (z) =>
          y + spring + rise * Math.sqrt(Math.max(0, 1 - ((z - mid) / half) * ((z - mid) / half)));
      for (let i = 0; i < n; i++) {
        const A = a + (i / n) * (b - a),
          B = a + ((i + 1) / n) * (b - a);
        for (const side of [-1, 1]) {
          face(
            'brick',
            [
              [x + side * 0.7, h(A), A],
              [x + side * 0.7, h(B), B],
              [x + side * 0.7, y + 7.3, B],
              [x + side * 0.7, y + 7.3, A],
            ],
            [side, 0, 0],
          );
          if (t > 0)
            face(
              'stone',
              [
                [x + side * 0.715, h(A), A],
                [x + side * 0.715, h(B), B],
                [x + side * 0.715, h(B) + 0.24, B],
                [x + side * 0.715, h(A) + 0.24, A],
              ],
              [side, 0, 0],
            );
        }
        face(
          'stone',
          [
            [x - 0.7, h(A), A],
            [x + 0.7, h(A), A],
            [x + 0.7, h(B), B],
            [x - 0.7, h(B), B],
          ],
          [0, -1, 0],
        );
      }
    }
    const A = [x - 1.05, y + 7.3, -6.75],
      B = [x + 1.05, y + 7.3, -6.75],
      D = [x - 1.05, y + 7.3, 6.75],
      E = [x + 1.05, y + 7.3, 6.75],
      r = [x, y + 7.75, -5.7],
      R = [x, y + 7.75, 5.7];
    face('tile', [A, D, R, r], [-1, 1, 0]);
    face('tile', [B, r, R, E], [1, 1, 0]);
    face('tile', [A, r, B], [0, 1, -1]);
    face('tile', [D, E, R], [0, 1, 1]);
    if (t > 0)
      for (const side of [-1, 1]) {
        box(
          'stone',
          x + side * 0.72 - 0.025,
          x + side * 0.72 + 0.025,
          -2.9,
          2.9,
          y + 5.55,
          y + 6.45,
        );
        for (const z of [-6.5, 6.5])
          box(
            'stone',
            x + side * 0.75 - 0.08,
            x + side * 0.75 + 0.08,
            z - 0.22,
            z + 0.22,
            y,
            y + 4.0,
          );
      }
  }
  const chapel = C.chapel,
    cy = deckY(chapel.centerX),
    front = [
      [-2.8868, -10.5036],
      [0.6407, -10.4443],
      [2.2917, -6.3229],
      [2.2679, -5.6578],
      [-4.989, -5.7171],
      [-4.9652, -6.3822],
    ];
  const R = (Y) => front.map(([x, z]) => [x, Y, z]).toReversed();
  loft(o, 'brick', [R(cy - 1), R(cy + 9.3)], rgb('brick'));
  for (const side of [-1, 1]) {
    const x = chapel.centerX + side * 3.9;
    face(
      'tile',
      [
        [x, cy + 9.3, -10.8],
        [x, cy + 9.3, -5.2],
        [chapel.centerX, cy + 11.0, -5.2],
        [chapel.centerX, cy + 11.0, -10.8],
      ],
      [side, 1, 0],
    );
  }
  if (t > 0) {
    for (const x of [-2.4, -1.35, -0.3]) {
      const z = -10.53,
        h = cy + 6.4;
      face(
        'dark',
        [
          [x - 0.26, h, z],
          [x + 0.26, h, z],
          [x + 0.26, h + 1.7, z],
          [x - 0.26, h + 1.7, z],
        ],
        [0, 0, -1],
      );
    }
    rod('wood', [chapel.centerX, cy + 11.0, -8], [chapel.centerX, cy + 12, -8], 0.06);
    rod(
      'wood',
      [chapel.centerX - 0.28, cy + 11.7, -8],
      [chapel.centerX + 0.28, cy + 11.7, -8],
      0.06,
    );
  }
  if (t > 1) {
    for (const x of [-2.9, 0.65])
      box('stone', x - 0.12, x + 0.12, -10.65, -10.45, cy + 0.2, cy + 9.3);
    for (const x of [-84, 84])
      for (const side of [-1, 1])
        box(
          'stone',
          x - 0.35,
          x + 0.35,
          side * 6.23 - 0.03,
          side * 6.23 + 0.03,
          deckY(x) - 1.6,
          deckY(x) - 0.8,
        );
  }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

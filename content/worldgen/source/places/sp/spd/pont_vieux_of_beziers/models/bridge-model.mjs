import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Original picture-proportioned reconstruction. Current map/terrain fit is pending.
export const bridgeControls = {
  id: 'pont_vieux_of_beziers',
  anchor: [3.207738834, 43.339183677],
  heading: 0.453166047293,
  datum: 11,
  ends: [-119.7715, 119.7715],
  halfWidth: 2.6,
  foundationY: -5,
  ownedRoadId: 35184410227350,
  curve: [
    [-119.7715, -2.5322],
    [-52.0969, -1.0072],
    [-11.0741, 2.5448],
    [30.2679, -0.5108],
    [89.4906, -2.5883],
    [119.7715, -1.8376],
  ],
  profile: [
    [-119.7715, 6.2],
    [-90, 7.2],
    [-55, 8.8],
    [-10, 9.8],
    [35, 9.2],
    [75, 7.8],
    [119.7715, 6.1],
  ],
  // Unequal bay proportions from ordinary river photographs, not surveyed openings.
  spanWeights: [8, 9, 10.5, 12, 14, 17, 18.8, 15.5, 16, 14, 12.5, 11, 10, 8.5, 7.5],
  pierWidth: 2.65,
  abutmentWidth: 3.1,
  status: 'Draft: source silhouette and native bank/river placement require current Molen review.',
};
const interpolate = (x, points) => {
  for (let i = 1; i < points.length; i++)
    if (x <= points[i][0]) {
      const a = points[i - 1],
        b = points[i],
        u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + u * (b[1] - a[1]);
    }
  return points.at(-1)[1];
};
export const deckY = (x) => interpolate(x, bridgeControls.profile);
export const centerZ = (x) => interpolate(x, bridgeControls.curve);
const widthSum = bridgeControls.spanWeights.reduce((n, v) => n + v, 0),
  clearTotal =
    bridgeControls.ends[1] -
    bridgeControls.ends[0] -
    2 * bridgeControls.abutmentWidth -
    14 * bridgeControls.pierWidth;
let station = bridgeControls.ends[0] + bridgeControls.abutmentWidth;
export const openings = bridgeControls.spanWeights.map((weight) => {
  const a = station,
    b = a + (weight / widthSum) * clearTotal;
  station = b + bridgeControls.pierWidth;
  return [a, b];
});
export const pierStations = openings.slice(0, -1).map(([a, b]) => b + bridgeControls.pierWidth / 2);
bridgeControls.openings = openings;
bridgeControls.mainPiers = pierStations;
const linear = (h) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', color: linear('#b9b29c') },
  ring: { slot: 'trim', graph: 'stone_limestone', color: linear('#c9c1a8') },
  parapet: { slot: 'wall', graph: 'stone_ashlar', color: linear('#c0b9a4') },
  coping: { slot: 'trim', graph: 'stone_limestone', color: linear('#d0c7b1') },
  paving: { slot: 'foundation', graph: 'stone_ashlar', color: linear('#aa9d8c') },
  edge: { slot: 'foundation', graph: 'stone_ashlar', color: linear('#657073') },
  guard: { slot: 'trim', graph: 'stone_basalt', color: linear('#6c6a5d') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { color, ...surface }]) => [k, surface]),
);
export function buildBridgeLevel(target, level = 'master') {
  const C = bridgeControls,
    t = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 }[level];
  if (t === undefined) throw Error('Unknown bridge tier ' + level);
  const bend = ([x, y, z]) => [x, y, z + centerZ(x)];
  const out = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    out[method] = (m, r, points, n, uv, color) => {
      const ps = points.map(bend);
      target[method](m, r, ps, normalFor(...ps), uv, color);
    };
  const face = (m, ps, wanted, tint = 1) => {
    let n = normalFor(...ps);
    if (n.reduce((v, x, i) => v + x * wanted[i], 0) < 0) {
      ps = ps.toReversed();
      n = normalFor(...ps);
    }
    if (
      ps.length === 4 &&
      Math.abs(ps[3].reduce((v, x, i) => v + (x - ps[0][i]) * n[i], 0)) > 1e-7
    ) {
      face(m, [ps[0], ps[1], ps[2]], wanted, tint);
      face(m, [ps[0], ps[2], ps[3]], wanted, tint);
      return;
    }
    const metric = m === 'paving' || m === 'edge',
      uv = metric ? ps.map(([x, y, z]) => [x * 2, z * 2]) : undefined;
    out[ps.length === 3 ? 'addTriangle' : 'addQuad'](
      m,
      metric ? 'metric:uv' : 'palette:#fff',
      ps,
      n,
      uv,
      palette[m].color.map((x) => x * tint),
    );
  };
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
  const cuts = (a, b, n) =>
    [
      ...new Set([
        a,
        b,
        ...Array.from({ length: n - 1 }, (_, i) => a + ((b - a) * (i + 1)) / n),
        ...C.curve.map((p) => p[0]).filter((x) => x > a && x < b),
        ...C.profile.map((p) => p[0]).filter((x) => x > a && x < b),
      ]),
    ].sort((a, b) => a - b);
  const extrude = (m, a, b, z0, z1, low, high, n = 1) => {
    const xs = cuts(a, b, n);
    for (let i = 1; i < xs.length; i++) {
      const x = xs[i - 1],
        X = xs[i],
        L = low(x),
        R = low(X),
        H = high(x),
        J = high(X);
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
        if (low(x) !== high(x))
          face(
            m,
            [
              [x, low(x), z0],
              [x, low(x), z1],
              [x, high(x), z1],
              [x, high(x), z0],
            ],
            [s, 0, 0],
          );
  };
  const segments = [2, 6, 12, 18, 24][t];
  for (const [a, b] of openings) {
    const mid = (a + b) / 2,
      half = (b - a) / 2,
      rise = Math.min(6.3, half * 0.82),
      offset = half * 0.18,
      cy = (rise * rise - half * half - 2 * half * offset) / (2 * rise),
      R = Math.hypot(offset, rise - cy);
    const under = (x) =>
      deckY(x) -
      0.85 -
      rise +
      cy +
      Math.sqrt(Math.max(0, R * R - (Math.abs(x - mid) + offset) * (Math.abs(x - mid) + offset)));
    extrude('masonry', a, b, -2.6, 2.6, under, (x) => deckY(x) - 0.05, segments);
    if (t > 0) {
      const xs = cuts(a, b, segments);
      for (const side of [-1, 1])
        for (let i = 1; i < xs.length; i++) {
          const x = xs[i - 1],
            X = xs[i],
            z = side * 2.615;
          face(
            'ring',
            [
              [x, under(x), z],
              [X, under(X), z],
              [X, under(X) + 0.43, z],
              [x, under(x) + 0.43, z],
            ],
            [0, 0, side],
            1 - (i % 4) * 0.012,
          );
        }
    }
  }
  for (let i = 0; i < pierStations.length; i++) {
    const x = pierStations[i],
      w = C.pierWidth / 2,
      Y = deckY(x) - 0.05,
      holeFloor = deckY(x) - 3.75,
      holeHalf = 0.7;
    if (t < 2) box('masonry', x - w, x + w, -2.6, 2.6, C.foundationY, Y);
    else {
      box('masonry', x - w, x - holeHalf, -2.6, 2.6, C.foundationY, Y);
      box('masonry', x + holeHalf, x + w, -2.6, 2.6, C.foundationY, Y);
      box('masonry', x - holeHalf, x + holeHalf, -2.6, 2.6, C.foundationY, holeFloor);
      const h = (X) =>
        holeFloor +
        1.15 +
        0.65 * Math.sqrt(Math.max(0, 1 - ((X - x) / holeHalf) * ((X - x) / holeHalf)));
      extrude('masonry', x - holeHalf, x + holeHalf, -2.6, 2.6, h, () => Y, t === 2 ? 4 : 8);
    }
    // Solid tapered stone cutwaters stop below the small real relief opening.
    const top = Math.min(deckY(x) - 4.05, 1.7),
      ring = (y, d) =>
        [
          [x - w, y, -2.6],
          [x, y, -2.6 - d],
          [x + w, y, -2.6],
          [x + w, y, 2.6],
          [x, y, 2.6 + d],
          [x - w, y, 2.6],
        ].toReversed();
    if (t > 0 || i % 2 === 0)
      loft(
        out,
        'masonry',
        [ring(C.foundationY, t === 0 ? 0.65 : 1.05), ring(top, 0.7)],
        palette.masonry.color,
      );
    if (t > 1)
      for (const side of [-1, 1]) {
        // The ordinary photos show dark iron repair straps; simplified to their silhouette.
        const z = side * 2.632,
          y = deckY(x) - 1.7;
        beam(
          out,
          'guard',
          [x - 0.07, y - 0.65, z],
          [x + 0.06, y + 0.6, z],
          0.075,
          0.035,
          palette.guard.color,
        );
        beam(
          out,
          'guard',
          [x - 0.3, y - 0.35, z],
          [x + 0.3, y - 0.22, z],
          0.06,
          0.035,
          palette.guard.color,
        );
      }
  }
  for (const [a, b] of [
    [C.ends[0], openings[0][0]],
    [openings.at(-1)[1], C.ends[1]],
  ])
    extrude(
      'masonry',
      a,
      b,
      -2.6,
      2.6,
      () => C.foundationY,
      (x) => deckY(x) - 0.05,
    );
  const xs = cuts(...C.ends, Math.ceil((C.ends[1] - C.ends[0]) / (t > 1 ? 8 : 40)));
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    extrude('paving', a, b, -1.32, 1.32, deckY, deckY);
    for (const side of [-1, 1]) {
      const z0 = Math.min(side * 1.32, side * 2.18),
        z1 = Math.max(side * 1.32, side * 2.18);
      extrude('edge', a, b, z0, z1, deckY, deckY);
      extrude(
        'parapet',
        a,
        b,
        side * 2.39 - 0.21,
        side * 2.39 + 0.21,
        deckY,
        (x) => deckY(x) + 1.04,
      );
      if (t > 0)
        extrude(
          'coping',
          a,
          b,
          side * 2.39 - 0.23,
          side * 2.39 + 0.23,
          (x) => deckY(x) + 1.04,
          (x) => deckY(x) + 1.12,
        );
    }
  }
  if (t > 1) {
    const spacing = t === 2 ? 4.8 : 2.4;
    for (let x = C.ends[0] + 2.4; x < C.ends[1] - 2.4; x += spacing)
      for (const side of [-1, 1]) {
        const z = side * 1.91,
          y = deckY(x),
          n = t === 2 ? 4 : 6,
          ring = (Y, r) =>
            Array.from({ length: n }, (_, j) => {
              const angle = (-2 * Math.PI * j) / n;
              return [x + Math.cos(angle) * r, Y, z + Math.sin(angle) * r];
            });
        loft(
          out,
          'guard',
          [ring(y, 0.22), ring(y + 0.08, 0.2), ring(y + 0.44, 0.17), ring(y + 0.55, 0.11)],
          palette.guard.color,
        );
      }
  }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');

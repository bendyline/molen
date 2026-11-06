import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [124.962054994, 40.461438194],
  heading: -0.929686248123,
  datum: 81.29844916666666,
  crest: 45.10155083333335,
  foundation: -61.29844916666666,
  tailwater: -50.13844916666666,
  normalPond: 42.00155083333334,
  wall: {
    span: [-449.75, 449.75],
    upstreamFaceZ: -81.9,
    deckCenterZ: -77.6,
    downstreamToeZ: 57.5,
  },
  spill: {
    span: [-304, 86],
    bayCount: 26,
    bayClearWidth: 12,
    spillwaySill: 34.70155083333334,
    downstreamApronZ: 56,
  },
  plant: {
    span: [97, 224],
    upstreamZ: 13,
    downstreamZ: 44,
    generatingSections: 7,
    roof: -28.53844916666666,
    terrace: -40.73844916666666,
  },
  machinery: {
    gantryStations: [-249, -112, 26],
    sealedLogSluiceCount: 5,
    sealedPanels: [
      {
        x: -412,
        west: -416.2,
        east: -407.8,
        low: 41.20155083333335,
        high: 44.05155083333335,
        face: [-63.29668479360463, -63.11981634654873, -70.02571978560927, -70.07333821366278],
      },
      {
        x: -397.7,
        west: -401.9,
        east: -393.5,
        low: 41.20155083333335,
        high: 44.05155083333335,
        face: [-62.99558731825946, -62.96269609009466, -69.98341817810241, -69.99227350876217],
      },
      {
        x: -383.4,
        west: -387.59999999999997,
        east: -379.2,
        low: 41.20155083333335,
        high: 44.05155083333335,
        face: [-63.40477745611039, -64.03418143484463, -70.27189500168895, -70.10244008433742],
      },
      {
        x: -369.1,
        west: -373.3,
        east: -364.90000000000003,
        low: 41.20155083333335,
        high: 44.05155083333335,
        face: [-64.47626280086035, -65.1056667795946, -70.56037182527547, -70.39091690792394],
      },
      {
        x: -354.8,
        west: -359,
        east: -350.6,
        low: 41.20155083333335,
        high: 44.05155083333335,
        face: [-65.54774814561033, -66.17715212434459, -70.848848648862, -70.67939373151047],
      },
    ],
  },
  banks: [
    [
      {
        x: -498,
        u: -86,
        deck: -78,
        toe: -62,
        y: 52.70156933333334,
        contact: 51.53283866666669,
      },
      {
        x: -449.75,
        u: -81.9,
        deck: -73,
        toe: -61,
        y: 45.10155083333335,
        contact: 39.830341262152814,
      },
      {
        x: -395,
        u: -81.9,
        deck: -73,
        toe: -18,
        y: 45.10155083333335,
        contact: 23.807299166666713,
      },
      {
        x: -337,
        u: -81.9,
        deck: -73,
        toe: 35,
        y: 45.10155083333335,
        contact: -30.528372097222235,
      },
      {
        x: -304,
        u: -81.9,
        deck: -73,
        toe: 57.5,
        y: 45.10155083333335,
        contact: -43.50221016666666,
      },
    ],
    [
      {
        x: 264,
        u: -81.9,
        deck: -73,
        toe: 47,
        y: 45.10155083333335,
        contact: -23.480208083333313,
      },
      {
        x: 302,
        u: -81.9,
        deck: -73,
        toe: 36,
        y: 45.10155083333335,
        contact: -17.523849166666704,
      },
      {
        x: 358,
        u: -81.9,
        deck: -73,
        toe: -6,
        y: 45.10155083333335,
        contact: 12.363095666666712,
      },
      {
        x: 411,
        u: -81.9,
        deck: -73,
        toe: -46,
        y: 45.10155083333335,
        contact: 33.87272370833335,
      },
      {
        x: 449.75,
        u: -81.9,
        deck: -73,
        toe: -59,
        y: 45.10155083333335,
        contact: 44.70155083333335,
      },
      {
        x: 478,
        u: -83.5,
        deck: -74,
        toe: -60,
        y: 61.0525647777778,
        contact: 60.652564777777805,
      },
    ],
  ],
  scope:
    'Sup’ung Dam’s 899.5 m gravity wall, 26 spillway bays, three crest gantries, five sealed log sluices, the seven-section powerhouse and both concrete abutments.',
};
const C = {
  wall: [0.37, 0.36, 0.32],
  trim: [0.54, 0.52, 0.47],
  pale: [0.64, 0.63, 0.57],
  dark: [0.2, 0.23, 0.23],
  road: [0.34, 0.35, 0.33],
  stone: [0.38, 0.35, 0.29],
  gate: [0.3, 0.39, 0.41],
  frame: [0.42, 0.45, 0.44],
  red: [0.54, 0.23, 0.15],
  glass: [0.18, 0.28, 0.31],
  roof: [0.45, 0.46, 0.43],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  pale: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  gate: { slot: 'door', graph: 'metal_painted' },
  frame: { slot: 'door', graph: 'metal_painted' },
  red: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
};
const cfg = {
  skyline: {},
  district: { detail: true },
  street: { detail: true, near: true },
  closeup: { detail: true, near: true, fine: true },
  master: { detail: true, near: true, fine: true, master: true },
};
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  sub = (a, b) => a.map((v, i) => v - b[i]);
function T(o, c, p, s, col, N) {
  p = p.map((p) => p.map(Math.fround));
  let n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
    d = Math.hypot(...n);
  if (d < 1e-8) return;
  if (N && n.reduce((s, v, i) => s + v * N[i], 0) < 0) {
    p.reverse();
    n = n.map((v) => -v);
  }
  n = n.map((v) => v / d);
  o.addTriangle(
    c === cfg.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s, col, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
const adapter = (o, c) => ({
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
const q = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const rod = (o, c, a, b, w, h, s = 'gate') => beam(adapter(o, c), s, a, b, w, h, C[s]);
const lerp = (a, b, f) => a + (b - a) * f;
const point = (x, z, y) => [x, y, z];
function prism(o, c, P, a, b, z, w, y, h, s) {
  const A = P(a, z, h),
    B = P(b, z, h),
    D = P(a, w, h),
    E = P(b, w, h),
    p = P(a, z, y),
    r = P(b, z, y),
    u = P(a, w, y),
    v = P(b, w, y);
  const U = [B[0] - A[0], 0, B[2] - A[2]],
    V = [D[0] - A[0], 0, D[2] - A[2]],
    neg = (n) => n.map((x) => -x);
  for (const [ps, n] of [
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [[p, r, B, A], neg(V)],
    [[u, v, E, D], V],
    [[p, u, D, A], neg(U)],
    [[r, v, E, B], U],
  ])
    q(o, c, ps, s, n);
  if (c.near) q(o, c, [p, u, v, r], s, [0, -1, 0]);
}
const box = (o, c, a, b, z, w, y, h, s) => prism(o, c, point, a, b, z, w, y, h, s);
const { crest, foundation, tailwater, wall, spill, plant, machinery, banks } = controls;

function skin(o, c, a, b, section, material) {
  for (let i = 1; i < section.length; i++) {
    const [z, y] = section[i - 1],
      [w, h] = section[i];
    q(
      o,
      c,
      [
        [a, y, z],
        [b, y, z],
        [b, h, w],
        [a, h, w],
      ],
      material,
      [0, 1, 1],
    );
  }
}

function abutment(o, c, row) {
  const crossSection = (s) => [
    [s.u, s.y],
    [s.deck, s.y],
    [lerp(s.deck, s.toe, 0.55), lerp(s.y, s.contact, 0.57)],
    [s.toe, s.contact],
  ];
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1],
      b = row[i],
      A = crossSection(a),
      B = crossSection(b);
    const P = (p, k, j) => [p.x, k[j][1], k[j][0]];
    for (let j = 1; j < A.length; j++) {
      q(
        o,
        c,
        [P(a, A, j - 1), P(b, B, j - 1), P(b, B, j), P(a, A, j)],
        j === 1 ? 'road' : 'wall',
        [0, 1, 1],
      );
    }
    for (const [j, sign] of [
      [0, -1],
      [3, 1],
    ]) {
      const ap = P(a, A, j),
        bp = P(b, B, j);
      q(
        o,
        c,
        [ap, bp, [bp[0], foundation, bp[2]], [ap[0], foundation, ap[2]]],
        j === 0 ? 'wall' : 'stone',
        [0, 0, sign],
      );
    }
    if (c.detail)
      rod(o, c, [a.x, a.y + 0.52, a.deck], [b.x, b.y + 0.52, b.deck], 0.18, 0.18, 'trim');
  }
  for (const [p, sign] of [
    [row[0], -1],
    [row.at(-1), 1],
  ]) {
    const section = crossSection(p);
    for (let j = 1; j < section.length; j++) {
      const [z, y] = section[j - 1],
        [w, h] = section[j];
      q(
        o,
        c,
        [
          [p.x, y, z],
          [p.x, h, w],
          [p.x, foundation, w],
          [p.x, foundation, z],
        ],
        'wall',
        [sign, 0, 0],
      );
    }
  }
}

function gravityWall(o, c) {
  const [p, r] = spill.span,
    z = wall.upstreamFaceZ;
  const a = p,
    b = 264;
  box(o, c, a, b, z, z + 4, foundation, crest - 0.42, 'wall');
  box(o, c, a, b, z, -71.6, crest - 0.42, crest, 'road');
  box(o, c, a, b, z - 0.27, z + 0.28, crest, crest + 0.8, 'trim');
  box(o, c, a, b, -72.05, -71.63, crest, crest + 0.56, 'trim');
  for (const [u, v, toe] of [
    [r, plant.span[0], 57.5],
    [plant.span[0], plant.span[1], 30.5],
    [plant.span[1], b, 57.5],
  ]) {
    const section = [
      [-72.05, crest - 0.12],
      [-67.4, crest - 18.3],
      [-18.6, tailwater + 43.8],
      [toe - 25.3, tailwater + 13.3],
      [toe, tailwater + 0.78],
    ];
    skin(o, c, u, v, section, 'wall');
    box(o, c, u, v, toe - 0.7, toe + 1.1, foundation, tailwater + 0.78, 'wall');
    if (c.detail)
      for (let x = u + 13; x < v - 2; x += 14.95) {
        const shift = section.map(([z, y]) => [z + 0.09, y]);
        skin(o, c, x - 0.12, x + 0.12, shift, 'trim');
      }
  }
  for (const x of [p - 2, r + 1]) {
    box(o, c, x - 1.05, x + 1.05, -71.6, -65.5, tailwater + 48, crest + 0.25, 'trim');
    q(
      o,
      c,
      [
        [x - 1.1, crest - 2.3, -65.5],
        [x + 1.1, crest - 2.3, -65.5],
        [x + 1.1, tailwater + 2, 56],
        [x - 1.1, tailwater + 2, 56],
      ],
      'trim',
      [0, 1, 1],
    );
  }
}

function gatedSpillway(o, c) {
  const {
      span: [a, b],
      bayCount,
      bayClearWidth,
      spillwaySill,
      downstreamApronZ,
    } = spill,
    step = (b - a) / bayCount,
    half = (step - bayClearWidth) / 2;
  const profile = c.detail
    ? [
        [-64.8, spillwaySill],
        [-48.8, crest - 24],
        [-12, tailwater + 40],
        [36.2, tailwater + 11],
        [downstreamApronZ, tailwater + 1.22],
      ]
    : [
        [-64.8, spillwaySill],
        [-12, tailwater + 40],
        [downstreamApronZ, tailwater + 1.22],
      ];
  box(o, c, a, b, 53, 61.2, foundation, tailwater + 1.21, 'wall');
  box(o, c, a, b, -74.9, -64.78, spillwaySill - 0.52, spillwaySill, 'wall');
  for (let i = 0; i <= bayCount; i++) {
    const x = a + i * step;
    if (c.detail)
      box(o, c, x - half, x + half, -73, -63.2, spillwaySill - 2.2, crest + 0.12, 'trim');
    else
      q(
        o,
        c,
        [
          [x - half, spillwaySill, -63.2],
          [x + half, spillwaySill, -63.2],
          [x + half, crest, -63.2],
          [x - half, crest, -63.2],
        ],
        'trim',
        [0, 0, 1],
      );
    if (c.detail)
      skin(
        o,
        c,
        x - 0.3,
        x + 0.3,
        profile.map(([z, y]) => [z + 0.05, y + 0.43]),
        'trim',
      );
    if (i === bayCount) break;
    skin(o, c, x, x + step, profile, 'wall');
    const lo = x + half,
      hi = x + step - half;
    const bottom = spillwaySill + (i % 7 === 5 ? 1.2 : 0.18),
      top = bottom + 7.3;
    q(
      o,
      c,
      [
        [lo, bottom, -68.8],
        [hi, bottom, -68.8],
        [hi, top, -68.8],
        [lo, top, -68.8],
      ],
      'gate',
      [0, 0, 1],
    );
    if (c.detail) {
      q(
        o,
        c,
        [
          [lo, bottom, -69.04],
          [hi, bottom, -69.04],
          [hi, top, -69.04],
          [lo, top, -69.04],
        ],
        'gate',
        [0, 0, -1],
      );
      for (const z of [-69.12, -68.72])
        rod(o, c, [lo, bottom + 0.6, z], [hi, bottom + 0.6, z], 0.19, 0.18, 'frame');
    }
    if (c.near)
      for (let j = 1; j <= 3; j++) {
        const x = lerp(lo, hi, j / 4);
        rod(o, c, [x, bottom + 0.19, -68.65], [x, top, -68.65], 0.21, 0.25, 'frame');
      }
    if (c.master)
      for (const x of [lo + 0.27, hi - 0.27]) {
        rod(o, c, [x, bottom, -68.59], [x, crest - 0.32, -68.45], 0.1, 0.13, 'dark');
      }
  }
}

function crestGantry(o, c) {
  for (const x of machinery.gantryStations) {
    for (const dx of [-2.25, 2.25])
      for (const z of [-79.6, -71.3]) {
        rod(o, c, [x + dx, crest, z], [x + dx * 0.92, crest + 11.5, z], 0.38, 0.4, 'frame');
        if (c.near)
          rod(o, c, [x + dx, crest + 2.15, z], [x + dx * 0.68, crest + 10.8, z], 0.19, 0.21, 'red');
      }
    box(o, c, x - 3.7, x + 3.7, -80.3, -70.55, crest + 11.37, crest + 12.45, 'red');
    if (c.detail) {
      box(o, c, x + 0.9, x + 3.43, -72.7, -70.1, crest + 8.58, crest + 11.38, 'red');
      box(o, c, x + 1.22, x + 3.1, -70.2, -70.03, crest + 9.25, crest + 10.78, 'glass');
      rod(o, c, [x, crest + 11.38, -75.3], [x, crest + 1.02, -75.3], 0.1, 0.1, 'dark');
    }
  }
  for (const panel of machinery.sealedPanels) {
    const {
      west,
      east,
      low,
      high,
      face: [a, b, d, e],
    } = panel;
    const points = [
      [west, low, a],
      [east, low, b],
      [east, high, d],
      [west, high, e],
    ];
    q(o, c, points, 'trim', [0, 0, 1]);
    if (c.detail) {
      const inner = points.map(([x, y, z]) => [
        lerp(panel.x, x, 0.87),
        lerp((low + high) / 2, y, 0.72),
        z + 0.06,
      ]);
      q(o, c, inner, 'dark', [0, 0, 1]);
      for (let j = 0; j < 4; j++) {
        const p = points[j],
          r = points[(j + 1) % 4];
        q(o, c, [p, r, [r[0], r[1], r[2] - 0.48], [p[0], p[1], p[2] - 0.48]], 'trim', null);
      }
    }
  }
}

function powerhouse(o, c) {
  const {
      span: [a, b],
      upstreamZ: z,
      downstreamZ: w,
      generatingSections,
      roof,
      terrace,
    } = plant,
    step = (b - a) / generatingSections;
  box(o, c, a, b, z, w, terrace, roof, 'pale');
  box(o, c, a - 0.31, b + 0.39, z - 0.35, w + 0.49, roof, roof + 0.63, 'roof');
  box(o, c, a, b, w - 1.1, w + 7, terrace - 0.48, terrace + 0.4, 'trim');
  box(o, c, a, b, w - 3.6, w + 1.8, terrace + 5.2, terrace + 5.63, 'trim');
  for (let i = 0; i <= generatingSections; i++) {
    const x = a + i * step;
    box(o, c, x - 1.06, x + 1.06, w - 9, w + 6, foundation, terrace, 'trim');
    if (i === generatingSections) break;
    box(o, c, x + 1.07, x + step - 1.07, w - 12, w - 11.54, foundation, terrace, 'dark');
    if (c.detail) {
      for (const [y, h] of [
        [terrace + 0.87, terrace + 4.39],
        [terrace + 6.63, roof - 1.08],
      ]) {
        box(o, c, x + 1.23, x + step - 1.12, w + 0.017, w + 0.097, y, h, 'glass');
        if (c.near)
          for (let j = 1; j < 5; j++) {
            const u = x + (step * j) / 5;
            rod(o, c, [u, y, w + 0.11], [u, h, w + 0.11], 0.16, 0.17, 'pale');
          }
      }
    }
    if (c.fine) {
      for (const dx of [2.1, step - 2.1])
        rod(
          o,
          c,
          [x + dx, terrace - 0.44, w + 6.47],
          [x + dx, terrace + 1.24, w + 6.47],
          0.12,
          0.12,
          'frame',
        );
      if (c.master)
        box(o, c, x + 5.3, x + 7.1, w + 0.06, w + 0.27, terrace + 0.44, terrace + 2.65, 'frame');
    }
  }
  for (const [x, r] of [
    [a, 2.3],
    [b, 2.7],
  ])
    box(o, c, x - r, x + r, z - 5, w + 14, foundation, terrace - 0.03, 'wall');
  if (c.detail)
    rod(o, c, [a, terrace + 1.25, w + 6.45], [b, terrace + 1.25, w + 6.45], 0.14, 0.14, 'frame');
  box(o, c, 232, 249, 24, 45, foundation, terrace + 0.21, 'wall');
  box(o, c, 231.8, 249.4, 24.2, 44.5, terrace + 0.19, terrace + 8.23, 'pale');
  box(o, c, 231.5, 249.8, 23.8, 45, terrace + 8.21, terrace + 8.77, 'roof');
  if (c.detail) box(o, c, 233.9, 247.7, 44.5, 44.61, terrace + 3.1, terrace + 6.8, 'glass');
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error(`Unknown Supung tier ${level}`);
  for (const row of banks) abutment(o, c, row);
  gravityWall(o, c);
  gatedSpillway(o, c);
  crestGantry(o, c);
  powerhouse(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

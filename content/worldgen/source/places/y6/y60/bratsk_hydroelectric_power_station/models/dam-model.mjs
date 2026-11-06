import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [101.786825702, 56.28641663],
  heading: 2.328962879809793,
  datum: 390.994294,
  tailwater: -99.94986560937502,
  wall: {
    x0: -480.9606,
    x1: 688.9842,
    crestY: 9.3,
    railY: 10.2,
    heel: -111.94986560937502,
    profile: [
      [9.3, -98],
      [-11, -91],
      [-30, -81],
      [-56, -61],
      [-83, -42],
      [-98.94986560937502, -29],
      [-111.94986560937502, -28],
    ],
    upstreamZ: -132.2,
    roadZ: -105.6,
    railStart: -639.9884,
    railEnd: 849.8442,
    rails: [-120.8, -113.4],
    ribBays: 39,
  },
  banks: [
    {
      x: -480.9606,
      outer: -562.9606,
      z0: -135,
      z1: -20,
      heights: [5.003136927514049, 4.465510123471859, -12.120295553890685],
    },
    {
      x: 688.9842,
      outer: 766.9842,
      z0: -135,
      z1: -20,
      heights: [4.414303474791382, 3.0780071847108843, -19.51789087992819],
    },
  ],
  railGrades: [
    [-639.9884, 7.260677565690646],
    [-480.9606, 10.2],
    [688.9842, 10.2],
    [849.8442, 7.69633906471093],
  ],
  roadGrades: [
    [-480.9606, -562.9606, 4.815941575112957],
    [688.9842, 766.9842, 3.5924896659166077],
  ],
  powerhouse: [
    [-34.4189, -54.534],
    [-17.23451953590446, -55.085864586623025],
    [-17.2021, -55.1201],
    [-10.4078, -55.3051],
    [-10.2346, -44.6419],
    [429.5827, -45.3742],
    [467.1935, -46.0483],
    [467.736, -21.7976],
    [-33.3539, -19.7457],
    [-34.0114, -43.8772],
  ],
  roofIndices: [9, 0, 1, 1, 2, 3, 1, 3, 4, 5, 6, 7, 5, 7, 8, 5, 8, 9, 9, 1, 4, 9, 4, 5],
  spur: [
    [-42.2797, -37.5561],
    [-40.7041, 15.975],
    [-39.9119, 49.3637],
    [-32.5381, 126.4165],
    [-31.7004, 135.6547],
    [-28.1398, 145.8738],
    [-19.9445, 154.0909],
    [-14.6891, 153.3615],
    [-9.884, 149.0104],
    [-5.3587, 138.6883],
    [-7.6929, 57.2782],
    [-3.2806, 51.4138],
    [2.2911, 49.3864],
    [1.1079, -6.9685],
    [1.1079, -37.8],
  ],
  spurIndices: [
    1, 0, 14, 1, 14, 13, 1, 13, 12, 1, 12, 11, 1, 11, 10, 1, 10, 9, 1, 9, 8, 1, 8, 7, 1, 7, 6, 1, 6,
    5, 1, 5, 4, 1, 4, 3, 1, 3, 2,
  ],
  owned: {
    buildingIds: [35185186242865, 35185186242866],
    transportIds: [35184427568909, 35184427568910, 35185689010881],
  },
  scope:
    'Bratsk concrete gravity wall, deep crest ribs, highway and electrified double-track railway, crest gantry, generator hall, and downstream retaining spur.',
  note: 'PMTiles and ordinary photographs establish the plan. Concrete levels, bay count and individual machinery remain estimates.',
};
const C = {
  stone: [0.32, 0.31, 0.28],
  dark: [0.25, 0.245, 0.23],
  paving: [0.29, 0.3, 0.3],
  steel: [0.22, 0.26, 0.26],
  light: [0.66, 0.67, 0.64],
  roof: [0.33, 0.35, 0.35],
  glass: [0.13, 0.22, 0.24],
  warm: [0.47, 0.25, 0.15],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  stone: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  paving: { slot: 'foundation', graph: 'concrete_plain' },
  light: { slot: 'wall', graph: 'concrete_boardformed' },
  steel: { slot: 'door', graph: 'metal_painted' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  glass: { slot: 'window', graph: 'window_grid' },
  warm: { slot: 'wall', graph: 'concrete_boardformed' },
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
const { wall, tailwater } = controls;
const { x0, x1, crestY, heel } = wall;
const shift = (x) => -0.0072 * x;
const P = (x, y, z) => [x, y, z + shift(x)];
const lerp = (a, b, t) => a + (b - a) * t;
const quad = (o, c, p, slot, n) => Q(o, c, p, slot, C[slot], n);
const tri = (o, c, p, slot, n) => T(o, c, p, slot, C[slot], n);
const rod = (o, c, a, b, w, h, slot = 'steel') => beam(adapter(o, c), slot, a, b, w, h, C[slot]);

function box(o, c, a, b, y, h, z, v, slot, point = P) {
  const A = point(a, y, z),
    B = point(b, y, z),
    C = point(b, y, v),
    D = point(a, y, v);
  const E = point(a, h, z),
    F = point(b, h, z),
    G = point(b, h, v),
    H = point(a, h, v);
  for (const [p, n] of [
    [
      [E, F, G, H],
      [0, 1, 0],
    ],
    [
      [A, B, F, E],
      [0, 0, -1],
    ],
    [
      [D, C, G, H],
      [0, 0, 1],
    ],
    [
      [A, D, H, E],
      [-1, 0, 0],
    ],
    [
      [B, C, G, F],
      [1, 0, 0],
    ],
  ])
    quad(o, c, p, slot, n);
  if (c.detail) quad(o, c, [A, B, C, D], slot, [0, -1, 0]);
}
function strip(o, c, a, b, profile, slot = 'stone') {
  for (let i = 1; i < profile.length; i++) {
    const [y, z] = profile[i - 1],
      [h, w] = profile[i];
    quad(o, c, [P(a, y, z), P(b, y, z), P(b, h, w), P(a, h, w)], slot, [0, w - z, y - h]);
  }
}

function gravity(o, c) {
  box(o, c, x0, x1, heel, crestY, wall.upstreamZ, -118, 'stone');
  box(o, c, x0, x1, crestY - 3, crestY, -119, -98, 'paving');
  box(o, c, x0, x1, crestY - 4.1, crestY - 0.5, -99, -94, 'dark');
  strip(o, c, x0, x1, wall.profile);
  const n = c.near ? wall.ribBays : c.detail ? 26 : 13,
    interval = (x1 - x0) / n;
  const profile = [
    [crestY - 3.2, -94.8],
    [-16, -82],
    [-32, -79.1],
  ];
  for (let i = 1; i < n; i++) {
    const x = x0 + i * interval,
      a = x - 0.85,
      b = x + 0.85;
    strip(o, c, a, b, profile, 'light');
    for (const [u, s] of [
      [a, -1],
      [b, 1],
    ]) {
      const top = P(u, crestY - 3.2, -94.8),
        bend = P(u, -16, -82),
        toe = P(u, -32, -79.1),
        wallJoin = P(u, -11, -92);
      quad(o, c, [top, bend, toe, wallJoin], 'stone', [s, 0, 0]);
    }
    if (c.near)
      strip(
        o,
        c,
        x + 0.08,
        x + 0.34,
        wall.profile.map(([y, z]) => [y + 0.025, z + 0.075]),
        'dark',
      );
  }
  for (const { x, outer, z0, z1, heights } of controls.banks) {
    const inner = [
      [crestY, wall.upstreamZ],
      [crestY, -98],
      [heel, -28],
    ];
    const outerPoints = [
      P(outer, heights[0], z0),
      P(outer, heights[1], -98),
      P(outer, heights[2], z1),
    ];
    for (let i = 1; i < inner.length; i++) {
      const [a, u] = inner[i - 1],
        [b, v] = inner[i];
      quad(o, c, [P(x, a, u), P(x, b, v), outerPoints[i], outerPoints[i - 1]], 'stone', [0, 1, 0]);
      quad(
        o,
        c,
        [
          outerPoints[i - 1],
          outerPoints[i],
          P(outer, heel, i === 1 ? -98 : z1),
          P(outer, heel, i === 1 ? z0 : -98),
        ],
        'stone',
        [Math.sign(outer - x), 0, 0],
      );
    }
  }
}

function transportation(o, c) {
  for (const [x, outer, h] of controls.roadGrades) {
    const z = wall.roadZ;
    quad(
      o,
      c,
      [P(x, crestY, z - 3.9), P(outer, h, z - 3.9), P(outer, h, z + 3.9), P(x, crestY, z + 3.9)],
      'paving',
      [0, 1, 0],
    );
    for (const [v, sign] of [
      [z - 3.9, -1],
      [z + 3.9, 1],
    ]) {
      quad(
        o,
        c,
        [P(x, crestY, v), P(outer, h, v), P(outer, h - 0.55, v), P(x, crestY - 2, v)],
        'stone',
        [0, 0, sign],
      );
    }
  }
  const points = controls.railGrades;
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, h] = points[i];
    quad(
      o,
      c,
      [P(a, y, -127.5), P(b, h, -127.5), P(b, h, -109), P(a, y, -109)],
      'paving',
      [0, 1, 0],
    );
    for (const [z, dir] of [
      [-127.5, -1],
      [-109, 1],
    ]) {
      const depth = i === 2 ? 1.5 : 8.2;
      quad(
        o,
        c,
        [P(a, y, z), P(b, h, z), P(b, h - depth, z + dir * 4), P(a, y - depth, z + dir * 4)],
        i === 2 ? 'stone' : 'dark',
        [0, 0.45, dir],
      );
    }
    for (const z of wall.rails)
      for (const offset of [-0.76, 0.76])
        rod(o, c, P(a, y + 0.16, z + offset), P(b, h + 0.16, z + offset), 0.13, 0.18);
  }
  if (!c.detail) return;
  const wire = crestY + 7;
  for (const z of [-128.6, -98.6])
    rod(o, c, P(x0, crestY + 1.15, z), P(x1, crestY + 1.15, z), 0.15, 0.16);
  for (let x = x0 + 14; x < x1 - 9; x += c.fine ? 18 : 39) {
    for (const z of [-128.6, -98.6]) rod(o, c, P(x, crestY, z), P(x, crestY + 1.18, z), 0.14, 0.12);
  }
  for (let x = x0 + 23; x < x1 - 19; x += c.near ? 48 : 95) {
    rod(o, c, P(x, wall.railY, -126), P(x, wire, -126), 0.23, 0.29);
    rod(o, c, P(x, wire, -126), P(x, wire, -111.2), 0.13, 0.2);
    if (c.fine) rod(o, c, P(x, wire - 2, -126), P(x, wire, -118), 0.1, 0.1);
  }
  if (c.near)
    for (const z of wall.rails)
      rod(o, c, P(x0, wire - 0.61, z), P(x1, wire - 0.61, z), 0.045, 0.045);
  if (c.fine)
    for (let x = x0 + 8; x < x1 - 5; x += 13) {
      quad(
        o,
        c,
        [
          P(x, crestY + 0.02, wall.roadZ - 0.13),
          P(x + 4.3, crestY + 0.02, wall.roadZ - 0.13),
          P(x + 4.3, crestY + 0.02, wall.roadZ + 0.13),
          P(x, crestY + 0.02, wall.roadZ + 0.13),
        ],
        'light',
        [0, 1, 0],
      );
    }
}

function gantry(o, c) {
  const x = 389,
    y = crestY;
  for (const u of [x - 14, x + 14])
    for (const v of [-128, -102]) {
      rod(o, c, P(u, y, v), P(lerp(u, x, 0.16), y + 23, v), 1.8, 1.8, 'light');
    }
  box(o, c, x - 21, x + 21, y + 22, y + 32, -131, -98, 'light');
  if (c.detail)
    for (let i = 0; i < 5; i++)
      box(o, c, x - 17 + i * 7.3, x - 12 + i * 7.3, y + 25.5, y + 27.5, -97.98, -97.66, 'glass');
}

function prism(o, c, ring, indices, base, roof, wallSlot, roofSlot) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length],
      n = [v - z, 0, x - u];
    quad(
      o,
      c,
      [
        [x, base, z],
        [u, base, v],
        [u, roof, v],
        [x, roof, z],
      ],
      wallSlot,
      n,
    );
  }
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3).map((i) => [ring[i][0], roof, ring[i][1]]);
    tri(o, c, face, roofSlot, [0, 1, 0]);
  }
}
function powerhouse(o, c) {
  const roof = tailwater + 27,
    base = tailwater - 6;
  prism(o, c, controls.powerhouse, controls.roofIndices, base, roof, 'light', 'roof');
  prism(
    o,
    c,
    controls.spur.toReversed(),
    controls.spurIndices.map((i) => controls.spur.length - 1 - i),
    base,
    tailwater + 4.1,
    'stone',
    'light',
  );
  const raw = (x, y, z) => [x, y, z];
  if (!c.detail) return;
  quad(
    o,
    c,
    [
      [-30, base + 5, -21.9],
      [-30, base + 5, -40.2],
      [-30, roof - 3, -40.2],
      [-30, roof - 3, -21.9],
    ],
    'glass',
    [-1, 0, 0],
  );
  box(o, c, -35.3, -29.5, base + 1, roof - 6, -47, -41, 'light', raw);
  box(o, c, -35.9, -29.5, roof - 6, roof - 5.1, -47.4, -40.6, 'warm', raw);
  const facade = (x) => lerp(-19.73, -22.22, (x + 29) / 495);
  for (const [y, h] of [
    [tailwater + 7, 2.8],
    [tailwater + 16.8, 3.5],
  ]) {
    quad(
      o,
      c,
      [
        [-28, y, facade(-28) + 0.16],
        [462, y, facade(462) + 0.16],
        [462, y + h, facade(462) + 0.16],
        [-28, y + h, facade(-28) + 0.16],
      ],
      'glass',
      [0, 0, 1],
    );
  }
  for (let x = -24; x < 460; x += c.near ? 12 : 28) {
    const z = facade(x) + 0.18;
    rod(o, c, [x, tailwater + 4, z], [x, roof - 0.6, z], 0.39, 0.35, 'light');
  }
  for (let z = -14; z < 146; z += c.fine ? 9 : 20) {
    box(o, c, -14, -6, tailwater + 4.11, tailwater + 4.32, z, z + 0.18, 'dark', raw);
  }
  if (c.master)
    for (let x = -7; x < 455; x += 26) {
      box(o, c, x, x + 1.6, roof, roof + 0.65, -35, -32, 'steel', raw);
    }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Bratsk tier ' + level);
  gravity(o, c);
  transportation(o, c);
  gantry(o, c);
  powerhouse(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [111.27196732487181, 30.73910240285595],
  heading: -0.3397557779909933,
  datum: 62.58556,
  crestElevation: 70,
  fullPool: 66,
  tailwater: 39,
  foundation: 22,
  span: [-1030, 1576.5],
  powers: [
    {
      outline: [
        [-589.68719, 19.08404],
        [-223.22786, 18.57214],
        [-223.21738879850506, 18.601764687743376],
        [6.71525, 18.40903],
        [6.76173, 57.044],
        [-1.35234, 57.19008],
        [-1.37725, 64.82031],
        [-241.62678, 65.08754],
        [-241.63876140879765, 65.05364270511254],
        [-263.13636, 65.069],
        [-263.33234, 72.21525],
        [-308.21627, 72.29292],
        [-308.26226, 65.23221],
        [-559.14534, 65.44816],
        [-559.27896, 53.51909],
        [-586.46835, 53.60291],
        [-586.42026, 65.29002],
        [-589.66588, 65.34847],
      ],
      triangles: [
        16, 17, 0, 0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 6, 7, 8, 6, 8, 9, 9, 10, 11, 9, 11,
        12, 9, 12, 13, 9, 13, 14, 15, 16, 0, 0, 6, 9, 0, 9, 14, 0, 14, 15,
      ],
      roof: 77.2,
      extent: [
        [-589.68719, 6.76173],
        [18.40903, 72.29292],
      ],
    },
    {
      outline: [
        [548.50297, 58.81796],
        [548.58566, 22.85865],
        [858.8591365373263, 24.33256792935292],
        [858.83185, 24.25537],
        [876.85391, 24.41805],
        [876.77134, 60.3777],
      ],
      triangles: [4, 5, 0, 4, 0, 1, 4, 1, 2, 4, 2, 3],
      roof: 76.4,
      extent: [
        [548.50297, 876.85391],
        [22.85865, 60.3777],
      ],
    },
  ],
  gates: [
    {
      name: 'Dajiang silt sluices',
      start: -839.8,
      count: 9,
      pitch: 18.533333333333335,
      width: 12,
      sill: 41.5,
      height: 19.5,
      z: 0,
    },
    {
      name: 'Erjiang spillway',
      start: 20,
      count: 27,
      pitch: 18.53333333333333,
      width: 12,
      sill: 37,
      height: 24,
      z: 0,
    },
    {
      name: 'Sanjiang silt sluices',
      start: 1174,
      count: 6,
      pitch: 18.533333333333335,
      width: 12,
      sill: 43,
      height: 10.5,
      z: 45,
    },
  ],
  locks: [
    {
      id: 35184824506290,
      axis: [
        [-628.49096, -8.30054],
        [-628.39721, 316.93383],
      ],
      width: 34,
      length: 280,
      wall: 9.8,
      top: 70,
      tower: 91,
      gateFloor: 27.8,
      closed: false,
    },
    {
      id: 35184824506294,
      axis: [
        [1088.36143, 50.64481],
        [1138.83738, 369.79505],
      ],
      width: 34,
      length: 280,
      wall: 9.8,
      top: 70,
      tower: 83,
      gateFloor: 27.8,
      closed: false,
    },
    {
      id: 35184824507899,
      axis: [
        [1319.36478, 32.68942],
        [1320.87089, 174.79282],
      ],
      width: 18,
      length: 120,
      wall: 6.1,
      top: 66.8,
      tower: 76,
      gateFloor: 34,
      closed: true,
    },
  ],
  dividers: [
    [131, 75, 197],
    [353, 75, 197],
  ],
  crestTies: [
    [-1030, -839.8, 0],
    [-673, -659, 0],
    [-598, -589.7, 0],
    [520.4, 548.6, 0],
    [877, 1058, 0],
    [1120, 1174, 45],
    [1285.2, 1303, 45],
    [1336, 1576.5, 45],
  ],
};
const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.42, 0.439, 0.42] },
  bank: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.31, 0.337, 0.326] },
  cap: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.52, 0.55, 0.53] },
  white: { slot: 'wall', graph: 'concrete_plain', rgb: [0.66, 0.718, 0.699] },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.25, 0.284, 0.278] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.22, 0.282, 0.286] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.18, 0.257, 0.28] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.14, 0.196, 0.191] },
  red: { slot: 'trim', graph: 'metal_painted', rgb: [0.57, 0.138, 0.065] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { slot, graph }]) => [k, { slot, graph }]),
);
const {
  datum,
  crestElevation: crest,
  foundation,
  powers,
  gates,
  locks,
  dividers,
  crestTies,
} = controls;
const levels = {
  skyline: { coarse: true },
  district: { detail: 1 },
  street: { detail: 2, rails: true },
  closeup: { detail: 3, rails: true },
  master: { detail: 3, rails: true, service: true },
};
const p = (x, h, z) => [x, h - datum, z];
const identity = (point) => point;
function face(out, m, points, facing) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * facing[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  const add = points.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, m, 'palette:#ffffff', points, normal, undefined, palette[m].rgb);
}
const q = (out, m, a, b, c, d, n) => face(out, m, [a, b, c, d], n);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
function box(out, m, a, b, h, k, u, v, frame = identity) {
  const points = [
    [a, h, u],
    [b, h, u],
    [b, h, v],
    [a, h, v],
    [a, k, u],
    [b, k, u],
    [b, k, v],
    [a, k, v],
  ].map((t) => frame(p(...t)));
  const facing = (x, y, z) => frame([x, y, z]).map((n, i) => n - frame([0, 0, 0])[i]);
  const [A, B, C, D, E, F, G, H] = points;
  q(out, m, A, B, F, E, facing(0, 0, -1));
  q(out, m, B, C, G, F, facing(1, 0, 0));
  q(out, m, C, D, H, G, facing(0, 0, 1));
  q(out, m, D, A, E, H, facing(-1, 0, 0));
  q(out, m, E, F, G, H, [0, 1, 0]);
  q(out, m, D, C, B, A, [0, -1, 0]);
}
function gantry(out, d, x, z, base, width, depth, height) {
  const a = x - width / 2,
    b = x + width / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    h = base + height;
  if (d.coarse) {
    for (const [A, B, H, K] of [
      [a, a + 1.2, base, h],
      [b - 1.2, b, base, h],
      [a - 0.45, b + 0.45, h, h + 1.35],
    ]) {
      q(out, 'red', p(A, H, u), p(B, H, u), p(B, K, u), p(A, K, u), [0, 0, -1]);
      q(out, 'red', p(B, H, v), p(A, H, v), p(A, K, v), p(B, K, v), [0, 0, 1]);
      q(out, 'red', p(A, K, u), p(B, K, u), p(B, K, v), p(A, K, v), [0, 1, 0]);
    }
    return;
  }
  box(out, 'red', a - 0.45, b + 0.45, h, h + 1.35, u - 0.15, v + 0.15);
  for (const e of [a, b])
    for (const j of [u, v]) rod(out, 'red', p(e, base, j), p(e, h, j), 0.64, 0.7);
  for (const j of [u, v])
    for (const s of [-1, 1])
      rod(
        out,
        'red',
        p(x + (s * width) / 2, base + 0.7, j),
        p(x - (s * width) / 2, h - 0.15, j),
        0.31,
        0.27,
      );
  if (d.rails) {
    box(out, 'steel', x + 0.8, x + 2.7, h + 1.35, h + 2.8, u + 0.48, v - 0.48);
    rod(out, 'steel', p(x, h - 0.1, u + 0.1), p(x, base + 1.6, v - 0.1), 0.055, 0.055);
  }
}
function gateWorks(out, d, group) {
  const { start, count, pitch, width, sill, height, z } = group,
    finish = start + count * pitch,
    deckZ = z + 8.5;
  const tip = sill + height,
    top = crest - 2.4;
  box(out, 'road', start, finish, top, crest, z - 8.5, z + 15.6);
  box(out, 'bank', start, finish, foundation, sill, z - 8.5, z + 10.9);
  const pier = (x, X) => {
    const u = z - 8.5,
      v = z + 14;
    q(out, 'white', p(x, sill, u), p(X, sill, u), p(X, top, u), p(x, top, u), [0, 0, -1]);
    q(out, 'white', p(X, sill, v), p(x, sill, v), p(x, top, v), p(X, top, v), [0, 0, 1]);
    if (!d.coarse) {
      q(out, 'white', p(x, sill, v), p(x, sill, u), p(x, top, u), p(x, top, v), [-1, 0, 0]);
      q(out, 'white', p(X, sill, u), p(X, sill, v), p(X, top, v), p(X, top, u), [1, 0, 0]);
    }
  };
  const faceZ = z + 11.1,
    drop = z + 67;
  q(
    out,
    'body',
    p(start, sill, faceZ),
    p(finish, sill, faceZ),
    p(finish, sill - 3.6, drop),
    p(start, sill - 3.6, drop),
    [0, 1, 1],
  );
  const halfPier = (pitch - width) / 2;
  pier(start, start + halfPier);
  for (let i = 0; i < count; i++) {
    const l = start + i * pitch + halfPier,
      r = l + width;
    pier(r, i === count - 1 ? finish : r + 2 * halfPier);
    const points = d.coarse
      ? [
          [sill, 1.1],
          [tip, 1.1],
        ]
      : [
          [sill, 0.4],
          [sill + height * 0.5, 1.75],
          [tip, 0.74],
        ];
    for (let j = 1; j < points.length; j++) {
      const [h, u] = points[j - 1],
        [k, v] = points[j];
      q(
        out,
        'steel',
        p(l, h, deckZ + u),
        p(r, h, deckZ + u),
        p(r, k, deckZ + v),
        p(l, k, deckZ + v),
        [0, 0, 1],
      );
      if (!d.coarse)
        q(
          out,
          'steel',
          p(r, h, deckZ + u - 0.18),
          p(l, h, deckZ + u - 0.18),
          p(l, k, deckZ + v - 0.18),
          p(r, k, deckZ + v - 0.18),
          [0, 0, -1],
        );
    }
    if (d.rails) {
      for (const x of [l + 0.45, r - 0.45])
        rod(out, 'steel', p(x, sill + 3, deckZ + 1.4), p(x, tip + 2, deckZ + 7.7), 0.25, 0.34);
      const n = d.detail > 2 ? 5 : 2;
      for (let j = 1; j <= n; j++) {
        const h = sill + (j * height) / (n + 1);
        rod(out, 'steel', p(l + 0.1, h, deckZ + 1.9), p(r - 0.1, h, deckZ + 1.9), 0.15, 0.25);
      }
    }
  }
  if (d.rails)
    for (const offset of [-8.1, 15.1])
      rod(
        out,
        'steel',
        p(start, crest + 0.7, z + offset),
        p(finish, crest + 0.7, z + offset),
        0.14,
        0.19,
      );
  const machinery = d.coarse ? 1 : Math.ceil(count / 8);
  for (let i = 0; i < machinery; i++)
    gantry(
      out,
      d,
      start + ((i + 0.5) * (finish - start)) / machinery,
      z + 1.5,
      crest,
      10,
      8.6,
      7.1,
    );
}
function powerhouse(out, d, part) {
  const {
    outline,
    triangles,
    roof,
    extent: [[a, b], [u, v]],
  } = part;
  const floor = 49.4;
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i],
      [X, Z] = outline[(i + 1) % outline.length];
    q(out, 'white', p(x, floor, z), p(X, floor, Z), p(X, roof, Z), p(x, roof, z), [
      Z - z,
      0,
      x - X,
    ]);
    if (z < (u + v) / 2 && Z < (u + v) / 2) continue;
    const length = Math.hypot(X - x, Z - z);
    if (length < 10) continue;
    const pieces = d.coarse ? 1 : Math.max(1, Math.round(length / (d.rails ? 8 : 17)));
    const point = (t, h, extra = 0.09) =>
      p(
        x + (X - x) * t + ((Z - z) * extra) / length,
        h,
        z + (Z - z) * t - ((X - x) * extra) / length,
      );
    for (let j = 0; j < pieces; j++) {
      const l = (j + 0.1) / pieces,
        r = (j + 0.88) / pieces;
      q(
        out,
        'glass',
        point(l, roof - 8.7),
        point(r, roof - 8.7),
        point(r, roof - 3.6),
        point(l, roof - 3.6),
        [Z - z, 0, x - X],
      );
    }
    if (d.rails)
      rod(out, 'cap', point(0, roof + 0.38, 0.12), point(1, roof + 0.38, 0.12), 0.28, 0.54);
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const tri = triangles.slice(i, i + 3).map((j) => outline[j]);
    face(
      out,
      'roof',
      tri.map(([x, z]) => p(x, roof, z)),
      [0, 1, 0],
    );
    if (!d.coarse)
      face(
        out,
        'body',
        tri.map(([x, z]) => p(x, floor, z)),
        [0, -1, 0],
      );
  }
  box(out, 'bank', a, b, 26, floor, u - 11, v + 6.1);
  if (d.rails) {
    const bays = Math.round((b - a) / 11);
    for (let i = 0; i < bays; i++) {
      const x = a + ((b - a) * (i + 0.5)) / bays;
      box(out, 'body', x - 0.63, x + 0.63, 39.1, 49.3, v + 6, v + 6.7);
    }
  }
  for (const f of d.coarse ? [0.26] : [0.18, 0.66])
    gantry(out, d, a + (b - a) * f, u - 6.3, crest, 11.5, 8.8, 8.6);
}
export function lockFrame(lock) {
  const [a, b] = lock.axis,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    distance = Math.hypot(dx, dz),
    s = dx / distance,
    c = dz / distance;
  return { distance, point: ([x, y, z]) => [a[0] + c * x + s * z, y, a[1] - s * x + c * z] };
}
function lockWorks(out, d, lock) {
  const { distance, point } = lockFrame(lock),
    { width, length, wall, top, tower, gateFloor, closed } = lock;
  const half = width / 2,
    outer = half + wall,
    a = (distance - length) / 2,
    b = a + length;
  const slab = (m, x, X, h, k, z, Z) => box(out, m, x, X, h, k, z, Z, point);
  const node = (x, h, z) => point(p(x, h, z));
  for (const s of [-1, 1]) {
    const l = s < 0 ? -outer : half,
      r = s < 0 ? -half : outer;
    slab('body', l, r, gateFloor - 2.2, top, -4, distance + 4);
    if (!d.coarse) slab('cap', l - 0.12, r + 0.12, top, top + 0.36, -4, distance + 4);
    for (const station of [a, b]) {
      if (!d.coarse || station === a)
        slab('body', l - 1.6, r + 1.6, gateFloor - 2, top + 1.5, station - 8, station + 7);
      if (station !== a) continue;
      const x = s * (half + wall * 0.48);
      slab('white', x - 3.25, x + 3.25, top + 1.5, tower, station - 4, station + 4);
      if (!d.coarse)
        slab('roof', x - 3.55, x + 3.55, tower, tower + 0.55, station - 4.35, station + 4.35);
      if (d.rails) {
        for (let h = top + 3; h < tower - 2; h += 3.4)
          slab('glass', x - 1.5, x + 1.5, h, h + 1.64, station + 4.04, station + 4.1);
      }
    }
    const m = s * (half + wall * 0.49);
    if (d.rails)
      rod(out, 'steel', node(m, top + 1.06, -4), node(m, top + 1.06, distance + 4), 0.14, 0.15);
  }
  slab('bank', -half, half, gateFloor - 1.5, gateFloor, 0, distance);
  slab('white', -outer, outer, tower - 7.7, tower - 5.65, a - 2.2, a + 2.25);
  const leaf = (s, z, isClosed) => {
    const outer = s * half,
      tip = isClosed ? 0 : s * (half - 2.15),
      tipZ = z + (isClosed ? 5.9 : width * 0.44),
      h = gateFloor,
      k = top - 1;
    q(
      out,
      'steel',
      node(outer, h, z),
      node(tip, h, tipZ),
      node(tip, k, tipZ),
      node(outer, k, z),
      [0, 0, 1],
    );
    q(
      out,
      'steel',
      node(tip, h, tipZ - 0.25),
      node(outer, h, z - 0.25),
      node(outer, k, z - 0.25),
      node(tip, k, tipZ - 0.25),
      [0, 0, -1],
    );
    if (d.rails)
      for (let y = gateFloor + 2.2; y < top - 1; y += 3.8)
        rod(out, 'steel', node(outer, y, z + 0.19), node(tip, y, tipZ + 0.19), 0.21, 0.3);
  };
  for (const s of [-1, 1]) {
    leaf(s, a, true);
    leaf(s, b, closed);
  }
  if (d.detail > 1)
    for (const s of [-1, 1])
      for (let z = a + 15; z < b; z += 16) {
        const x = s * (half + 1.15);
        slab('steel', x - 0.17, x + 0.17, top + 0.37, top + 0.87, z - 0.24, z + 0.24);
      }
}
function separators(out, d) {
  for (const [x, a, b] of dividers) {
    box(out, 'body', x - 2.5, x + 2.5, 29, 44, a, b);
    box(out, 'cap', x - 2.7, x + 2.7, 44, 44.35, a, b);
    if (d.rails) rod(out, 'steel', p(x, 45.15, a), p(x, 45.15, b), 0.14, 0.16);
  }
  for (const [a, b, z] of crestTies) {
    if (d.coarse) {
      q(
        out,
        'body',
        p(a, 31, z - 10.5),
        p(b, 31, z - 10.5),
        p(b, crest, z - 10.5),
        p(a, crest, z - 10.5),
        [0, 0, -1],
      );
      q(
        out,
        'body',
        p(b, 31, z + 17),
        p(a, 31, z + 17),
        p(a, crest, z + 17),
        p(b, crest, z + 17),
        [0, 0, 1],
      );
      q(
        out,
        'road',
        p(a, crest, z - 10.5),
        p(b, crest, z - 10.5),
        p(b, crest, z + 17),
        p(a, crest, z + 17),
        [0, 1, 0],
      );
    } else {
      box(out, 'body', a, b, 31, crest - 1, z - 10.5, z + 17);
      box(out, 'road', a, b, crest - 1, crest, z - 8.5, z + 14);
    }
  }
  if (d.service) {
    for (const [x, z] of [
      [-214, 92],
      [541, 90],
      [892, 36],
    ])
      box(out, 'white', x - 4.4, x + 4.4, crest, crest + 3.2, z - 2.4, z + 2.4);
  }
}
export function buildDamLevel(out, level) {
  const d = levels[level];
  if (!d) throw Error('Unknown Gezhouba Dam detail level: ' + level);
  for (const group of gates) gateWorks(out, d, group);
  for (const power of powers) powerhouse(out, d, power);
  for (const lock of locks) lockWorks(out, d, lock);
  separators(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

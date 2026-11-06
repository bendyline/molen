import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [92.294444, 55.934722],
  heading: 2.53505751713827,
  datum: 223.0153305,
  tailwater: -85.93230525000001,
  dam: {
    ends: [
      [-490.33176, -6.03222],
      [545.35429, -6.62553],
    ],
    upstreamZ: -6.25,
    crestY: 16.2,
    crestBackZ: 13.5,
    foundationY: -100.93230525000001,
    gates: [114.75, 401.3],
    gateBays: 7,
  },
  solidProfiles: [
    [
      [16.2, -6.25],
      [16.2, 13.5],
      [13.2, 13.5],
      [-11, 39],
      [-52, 115],
      [-64, 133],
      [-100.93230525000001, 139],
    ],
    [
      [16.2, -6.25],
      [16.2, 13.5],
      [13.2, 13.5],
      [-11, 34],
      [-56, 97],
      [-79, 118],
      [-100.93230525000001, 131],
    ],
  ],
  abutments: [
    {
      x: -490.33176,
      end: -539.33176,
      toe: 139,
      inner: [
        [16.2, -6.25],
        [16.2, 13.5],
        [-11, 39],
        [-52, 115],
        [-64, 133],
        [-100.93230525000001, 139],
      ],
      outer: [
        [-6.25, 37.494290389986965],
        [13.5, 38.43060669660722],
        [39, 39.45181344789254],
        [115, 48.67647636837089],
        [133, 52.220661865046885],
        [139, 53.540875430603116],
      ],
    },
    {
      x: 545.35429,
      end: 601.35429,
      toe: 131,
      inner: [
        [16.2, -6.25],
        [16.2, 13.5],
        [-11, 34],
        [-56, 97],
        [-79, 118],
        [-100.93230525000001, 131],
      ],
      outer: [
        [-6.25, 19.629200984702244],
        [13.5, 22.662198452479835],
        [34, 26.701987783851855],
        [97, 27.86591012267619],
        [118, 27.606616765665315],
        [131, 28.378438402403482],
      ],
    },
  ],
  powerhouse: [
    [-330.13514, 126.29038],
    [-30.15626, 123.56041],
    [-30.147015784950586, 123.57373453751319],
    [105.38305, 122.34546],
    [108.1115, 154.44493],
    [-33.44546, 156.37501],
    [-33.45587776082436, 156.3599939244885],
    [-329.73066, 160.61477],
    [-330.13514, 126.29038],
  ],
  turntable: {
    center: [716.8879850000001, 68.42888500000001],
    radius: 54.2,
    y: 25.6,
  },
  upperRail: [
    {
      x: 626.56029,
      z: -113.44257,
      y: 6,
      ground: 7.748092406608862,
    },
    {
      x: 658.48202,
      z: -48.06624,
      y: 17,
      ground: 22.755979104968816,
    },
    {
      x: 692.14122,
      z: 20.98808,
      y: 26,
      ground: 20.291785063803587,
    },
  ],
  lowerRail: [
    {
      x: 707.36133,
      z: 121.5583,
      y: 26,
      ground: 21.054076970552984,
    },
    {
      x: 694.99998,
      z: 193.22876,
      y: 23.5,
      ground: 22.96210198767224,
    },
    {
      x: 687.19659,
      z: 252.9846,
      y: 17,
      ground: 10.422399869018392,
    },
    {
      x: 658.62649,
      z: 424.22787,
      y: -12.5,
      ground: -17.9696732572489,
    },
    {
      x: 604.45465,
      z: 721.70122,
      y: -34.5,
      ground: -37.21357248157835,
    },
    {
      x: 553.35047,
      z: 1002.17783,
      y: -57.8,
      ground: -61.93690703897926,
    },
    {
      x: 503.4621,
      z: 1275.89822,
      y: -84.58230525000002,
      ground: -75.51306414042688,
    },
  ],
  bridgeIds: [
    35184403388448, 35184403388448, 35184403388448, 35184876691075, 35184912834296, 35185087089959,
    35185087089961, 35185467226740,
  ],
  scope:
    'Krasnoyarsk gravity dam, spillways, crest gantries, right-bank power hall, and northwest ship lift including the upper reach, turntable and mapped descending alignment.',
  terrainNote:
    'Standard z14 Terrarium contains visibly corrupt low samples at this site. The draft uses finite, locally plausible samples for vertical guides. The raw retained field remains unchanged.',
};
const C = {
  concrete: [0.38, 0.375, 0.35],
  crest: [0.34, 0.35, 0.34],
  stone: [0.3, 0.31, 0.3],
  paint: [0.42, 0.48, 0.5],
  steel: [0.19, 0.23, 0.24],
  roof: [0.57, 0.53, 0.47],
  glass: [0.18, 0.25, 0.26],
  trim: [0.56, 0.52, 0.46],
  joint: [0.31, 0.31, 0.29],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  concrete: { slot: 'wall', graph: 'concrete_boardformed' },
  crest: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'stone_basalt' },
  paint: { slot: 'door', graph: 'metal_painted' },
  steel: { slot: 'door', graph: 'metal_painted' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  glass: { slot: 'window', graph: 'window_grid' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  joint: { slot: 'wall', graph: 'concrete_boardformed' },
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
const { dam } = controls;
const [minX, maxX] = dam.ends.map((p) => p[0]);
const [gateWest, gateEast] = dam.gates;
const lerp = (a, b, t) => a + (b - a) * t;
const quad = (o, c, p, slot, n) => Q(o, c, p, slot, C[slot], n);
const tri = (o, c, p, slot, n) => T(o, c, p, slot, C[slot], n);
const rod = (o, c, a, b, w, h, slot = 'steel') => beam(adapter(o, c), slot, a, b, w, h, C[slot]);

function box(o, c, x0, x1, y0, y1, z0, z1, slot) {
  const a = [x0, y0, z0],
    b = [x1, y0, z0],
    d = [x0, y0, z1],
    e = [x1, y0, z1];
  const A = [x0, y1, z0],
    B = [x1, y1, z0],
    D = [x0, y1, z1],
    E = [x1, y1, z1];
  for (const [p, n] of [
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [
      [a, b, B, A],
      [0, 0, -1],
    ],
    [
      [d, e, E, D],
      [0, 0, 1],
    ],
    [
      [a, d, D, A],
      [-1, 0, 0],
    ],
    [
      [b, e, E, B],
      [1, 0, 0],
    ],
  ])
    quad(o, c, p, slot, n);
  if (c.detail) quad(o, c, [a, b, e, d], slot, [0, -1, 0]);
}
function profileStrip(o, c, a, b, profile, slot = 'concrete') {
  for (let i = 1; i < profile.length; i++) {
    const [y, z] = profile[i - 1],
      [v, w] = profile[i];
    quad(
      o,
      c,
      [
        [a, y, z],
        [b, y, z],
        [b, v, w],
        [a, v, w],
      ],
      slot,
      [0, w - z, y - v],
    );
  }
}
function gravityWall(o, c) {
  const top = dam.crestY,
    low = dam.foundationY,
    up = dam.upstreamZ,
    back = dam.crestBackZ;
  box(o, c, minX, maxX, low, top, up, up + 7, 'concrete');
  box(o, c, minX, maxX, top - 3, top, up + 6, back, 'crest');
  const [plantSide, northwest] = controls.solidProfiles.map((p) => p.slice(2));
  profileStrip(o, c, minX, gateWest, plantSide);
  profileStrip(o, c, gateEast, maxX, northwest);
  for (const [x, p, n] of [
    [minX, plantSide, [-1, 0, 0]],
    [maxX, northwest, [1, 0, 0]],
  ]) {
    for (let i = 1; i < p.length; i++) {
      const [y, z] = p[i - 1],
        [v, w] = p[i];
      quad(
        o,
        c,
        [
          [x, y, up],
          [x, y, z],
          [x, v, w],
          [x, v, up],
        ],
        'concrete',
        n,
      );
    }
  }
  const bays = dam.gateBays,
    spacing = (gateEast - gateWest) / bays;
  const chute = [
    [-10, back],
    [-17, 29],
    [-38, 48],
    [-66, 72],
    [controls.tailwater + 1, 101],
    [low, 108],
  ];
  for (const [x, p, sign] of [
    [gateWest, plantSide, 1],
    [gateEast, northwest, -1],
  ]) {
    const atY = (row, y) => {
      const i = Math.max(
          1,
          row.findIndex(([h]) => h <= y),
        ),
        [a, b] = [row[i - 1], row[i]];
      return lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0]));
    };
    const levels = [...new Set([...p, ...chute].map(([y]) => y))].sort((a, b) => b - a);
    for (let i = 1; i < levels.length; i++) {
      const y = levels[i - 1],
        v = levels[i],
        z = atY(p, y),
        w = atY(p, v),
        a = atY(chute, Math.min(y, -10)),
        b = atY(chute, v);
      if (Math.abs(z - a) + Math.abs(w - b) < 0.01) continue;
      quad(
        o,
        c,
        [
          [x, y, z],
          [x, y, a],
          [x, v, b],
          [x, v, w],
        ],
        'concrete',
        [sign, 0, 0],
      );
    }
  }
  for (let i = 0; i < bays; i++) {
    const x = gateWest + i * spacing;
    profileStrip(o, c, x, x + spacing, chute);
    box(o, c, x + 2.8, x + spacing - 2.8, -9, top - 5.6, back - 1, back + 0.15, 'paint');
    box(o, c, x - 1.6, x + 1.6, -20, top + 1, back - 1, back + 4.1, 'trim');
    if (c.near) {
      for (const h of [-6, -1.5, 3.5])
        box(o, c, x + 3.05, x + spacing - 3.05, h, h + 0.17, back + 0.15, back + 0.42, 'steel');
      profileStrip(
        o,
        c,
        x - 0.5,
        x + 0.5,
        chute.map(([y, z]) => [y + 0.32, z + 0.27]),
        'trim',
      );
    }
  }
  box(o, c, gateEast - 1.6, gateEast + 1.6, -20, top + 1, back - 1, back + 4.1, 'trim');
  if (!c.detail) return;
  for (const z of [up + 0.4, back - 0.55])
    rod(o, c, [minX, top + 1.36, z], [maxX, top + 1.36, z], 0.18, 0.16);
  for (let x = minX + 12; x < maxX - 8; x += c.fine ? 13 : 35) {
    for (const z of [up + 0.4, back - 0.55]) rod(o, c, [x, top, z], [x, top + 1.4, z], 0.14, 0.14);
  }
  for (let x = minX + 19; x < maxX - 8; x += c.near ? 25 : 58) {
    box(o, c, x, x + 0.48, 1.5, top - 0.4, up - 0.25, up - 0.03, 'trim');
  }
  if (c.near)
    for (const [start, end, p] of [
      [minX, gateWest, plantSide],
      [gateEast, maxX, northwest],
    ]) {
      for (let x = start + 19; x < end - 4; x += 23) {
        profileStrip(
          o,
          c,
          x,
          x + 0.62,
          p.map(([y, z]) => [y + 0.035, z + 0.08]),
          'joint',
        );
      }
    }
  if (c.master)
    for (let x = minX + 32; x < maxX - 16; x += 48) {
      const z = up + 2.8;
      rod(o, c, [x, top, z], [x, top + 4.2, z], 0.15, 0.15);
      rod(o, c, [x, top + 4.2, z], [x, top + 4.4, z + 1.3], 0.09, 0.12);
      box(o, c, x - 0.2, x + 0.2, top + 4.3, top + 4.56, z + 1.05, z + 1.5, 'trim');
    }
}

function cranes(o, c) {
  const y = dam.crestY;
  for (const [x, w] of [
    [-294, 21],
    [-22, 22],
    [158, 22],
  ]) {
    const lo = x - w / 2,
      hi = x + w / 2;
    for (const a of [lo, hi])
      for (const z of [dam.upstreamZ + 2.1, dam.crestBackZ - 2.9]) {
        rod(o, c, [a, y, z], [lerp(a, x, 0.23), y + 16.5, z], 1.9, 1.8, 'paint');
        if (c.near) rod(o, c, [a, y + 2.5, z], [x, y + 12.5, z], 0.53, 0.44);
      }
    box(
      o,
      c,
      lo + 1.3,
      hi - 1.3,
      y + 15.1,
      y + 19.4,
      dam.upstreamZ - 0.3,
      dam.crestBackZ + 0.5,
      'roof',
    );
    box(
      o,
      c,
      x - 3.2,
      x + 3.2,
      y + 13.3,
      y + 16,
      dam.crestBackZ - 4,
      dam.crestBackZ + 1.15,
      'paint',
    );
  }
}

function abutments(o, c) {
  for (const { x, end, inner, outer } of controls.abutments) {
    for (let i = 1; i < inner.length; i++) {
      const [a, u] = inner[i - 1],
        [b, v] = inner[i],
        [w, d] = outer[i - 1],
        [z, e] = outer[i];
      quad(
        o,
        c,
        [
          [x, a, u],
          [x, b, v],
          [end, e, z],
          [end, d, w],
        ],
        i === 1 ? 'crest' : 'concrete',
        [0, 1, 0],
      );
      quad(
        o,
        c,
        [
          [end, d, w],
          [end, e, z],
          [end, dam.foundationY, z],
          [end, dam.foundationY, w],
        ],
        'concrete',
        [Math.sign(end - x), 0, 0],
      );
    }
    for (const [i, sign] of [
      [0, -1],
      [inner.length - 1, 1],
    ]) {
      const [a, u] = inner[i],
        [v, b] = outer[i];
      const face = [
        [x, a, u],
        [end, b, v],
        [end, dam.foundationY, v],
        [x, dam.foundationY, u],
      ];
      if (a === dam.foundationY) tri(o, c, face.slice(0, 3), 'concrete', [0, 0, sign]);
      else quad(o, c, face, 'concrete', [0, 0, sign]);
    }
  }
}

function plant(o, c) {
  const ring = controls.powerhouse.slice(0, -1),
    y0 = controls.tailwater - 5,
    y1 = -48.5;
  const middle = ring.reduce(
    (s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length],
    [0, 0],
  );
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, w] = ring[(i + 1) % ring.length],
      normal = [(x + u) / 2 - middle[0], 0, (z + w) / 2 - middle[1]];
    if (Math.hypot(u - x, w - z) < 0.05) continue;
    quad(
      o,
      c,
      [
        [x, y0, z],
        [u, y0, w],
        [u, y1, w],
        [x, y1, z],
      ],
      'concrete',
      normal,
    );
    tri(
      o,
      c,
      [
        [x, y1, z],
        [u, y1, w],
        [middle[0], y1, middle[1]],
      ],
      'roof',
      [0, 1, 0],
    );
  }
  if (!c.detail) return;
  const x0 = -329.7,
    x1 = 108.0;
  const facadeZ = (x) => lerp(160.61477, 154.44493, (x - x0) / (x1 - x0));
  for (const [y, h, slot] of [
    [-75, 0.8, 'trim'],
    [-65, 3.1, 'glass'],
    [-56, 3.8, 'glass'],
    [-49.6, 1.1, 'trim'],
  ]) {
    quad(
      o,
      c,
      [
        [x0, y, facadeZ(x0) + 0.12],
        [x1, y, facadeZ(x1) + 0.12],
        [x1, y + h, facadeZ(x1) + 0.12],
        [x0, y + h, facadeZ(x0) + 0.12],
      ],
      slot,
      [0, 0, 1],
    );
  }
  for (let i = 0; i <= 24; i++) {
    const x = lerp(x0 + 3, x1 - 3, i / 24),
      z = facadeZ(x);
    rod(o, c, [x, -76, z + 0.27], [x, -49, z + 0.27], 0.58, 0.74, 'trim');
  }
  for (const x of [-301, -243, -175, -114, -54, 8, 72])
    box(o, c, x - 4, x + 4, y1, y1 + 1.65, 136, 141, 'paint');
}

function railBed(o, c, route) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      d = Math.hypot(a.x - b.x, a.z - b.z),
      nx = (b.z - a.z) / d,
      nz = (a.x - b.x) / d;
    const P = (q, w, h) => [q.x + nx * w, q.y + h, q.z + nz * w];
    quad(o, c, [P(a, -7.4, 0), P(b, -7.4, 0), P(b, 7.4, 0), P(a, 7.4, 0)], 'crest', [0, 1, 0]);
    for (const side of [-1, 1]) {
      const w = side * 7.4;
      const liftEdge = (q) => Math.max(0.14, q.ground - q.y + 0.45);
      const A = P(a, w, liftEdge(a)),
        B = P(b, w, liftEdge(b));
      quad(o, c, [P(a, w, -1.2), P(b, w, -1.2), B, A], 'concrete', [nx * side, 0, nz * side]);
      quad(
        o,
        c,
        [A, B, P(b, w + side * 0.9, liftEdge(b)), P(a, w + side * 0.9, liftEdge(a))],
        'trim',
        [0, 1, 0],
      );
    }
    for (const w of [-4.5, 4.5]) rod(o, c, P(a, w, 0.22), P(b, w, 0.22), 0.32, 0.31);
    if (!c.detail) continue;
    const span = c.fine ? 5.8 : c.near ? 12 : 36;
    for (let k = span / 2; k < d; k += span) {
      const t = k / d,
        q = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
      rod(o, c, P(q, -5.8, 0.04), P(q, 5.8, 0.04), 0.39, 0.26, 'trim');
      const ground = lerp(a.ground, b.ground, t);
      if (q.y - ground > 3 && c.near && Math.floor(k / span) % 3 === 0) {
        box(o, c, q.x - 2.5, q.x + 2.5, ground - 3, q.y - 0.8, q.z - 2.1, q.z + 2.1, 'concrete');
      }
    }
  }
}
function lift(o, c) {
  const {
    center: [x, z],
    radius: r,
    y,
  } = controls.turntable;
  const n = c.detail ? 36 : 14,
    at = (i, h, scale = 1) => {
      const a = (i / n) * Math.PI * 2;
      return [x + Math.cos(a) * r * scale, h, z + Math.sin(a) * r * scale];
    };
  for (let i = 0; i < n; i++) {
    tri(o, c, [[x, y, z], at(i, y), at(i + 1, y)], 'concrete', [0, 1, 0]);
    quad(
      o,
      c,
      [at(i, y - 6), at(i + 1, y - 6), at(i + 1, y), at(i, y)],
      'concrete',
      sub(at(i + 0.5, y), [x, y, z]),
    );
    if (c.near) rod(o, c, at(i, y + 0.2, 0.92), at(i + 1, y + 0.2, 0.92), 0.42, 0.28);
  }
  for (const w of [-4.5, 4.5])
    rod(o, c, [692.1 + w, y + 0.4, 21], [707.4 + w, y + 0.4, 121], 0.39, 0.39);
  if (c.near) {
    box(o, c, x - 11.2, x + 10.9, y + 0.6, y + 2.3, z - 43, z + 39, 'paint');
    for (const a of [x - 11.2, x + 9.55])
      box(o, c, a, a + 1.35, y + 2.3, y + 6.1, z - 43, z + 39, 'paint');
    for (const a of [z - 43, z + 37.4])
      box(o, c, x - 9.85, x + 9.55, y + 2.3, y + 6.1, a, a + 1.6, 'paint');
    box(o, c, x + 7.7, x + 12.1, y + 6.1, y + 10.9, z + 23, z + 33, 'roof');
  }
  railBed(o, c, controls.upperRail);
  railBed(o, c, controls.lowerRail);
  const toe = controls.lowerRail.at(-1);
  for (const side of [-1, 1]) {
    const a = [toe.x + side * 13, toe.y + 2, toe.z - 8],
      b = [toe.x - 16 + side * 15, toe.y + 2, toe.z + 66];
    rod(o, c, a, b, 2.6, 3.4, 'concrete');
  }
  for (let i = 0; i < (c.near ? 7 : 4); i++) {
    const z = toe.z + 19 + i * 15,
      x = toe.x - 16 - i * 2.3;
    box(
      o,
      c,
      x - 3.5,
      x + 3.5,
      controls.tailwater - 3,
      controls.tailwater + 4.5,
      z - 3.5,
      z + 3.5,
      'concrete',
    );
  }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Krasnoyarsk tier ' + level);
  gravityWall(o, c);
  abutments(o, c);
  cranes(o, c);
  plant(o, c);
  lift(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

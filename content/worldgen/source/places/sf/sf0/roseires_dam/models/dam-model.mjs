import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [34.387517056, 11.798093465],
  heading: -2.173664636942,
  datum: 483.017491,
  tailwater: -32.01749100000001,
  foundation: -39.01749100000001,
  crestY: 7.8,
  crest: [
    [-467.178, -44.6],
    [-176.022, 8.539],
    [0.482, -1.543],
    [31.986, -3.714],
    [467.178, -33.83],
  ],
  wings: [
    [
      {
        x: -467.178,
        z: -44.6,
        y: 7.8,
        up: 5.434992763968774,
        down: -7.444480322425056,
      },
      {
        x: -530,
        z: -66,
        y: 7.8,
        up: 2.9130993906250295,
        down: -5.473521070312506,
      },
      {
        x: -620,
        z: -99,
        y: 7.8,
        up: 4.158527156250068,
        down: -9.754632624999976,
      },
      {
        x: -752.625,
        z: -129.63,
        y: 7.8,
        up: -4.811451910253913,
        down: -11.699534904238282,
      },
      {
        x: -890,
        z: -174,
        y: 3.058276117187509,
        up: -10.732280320312531,
        down: -12.125142492187512,
      },
      {
        x: -1050,
        z: -227,
        y: 1.4100634687500184,
        up: -5.604072859375014,
        down: -8.086824499999954,
      },
      {
        x: -1230,
        z: -355,
        y: -4.069573517578125,
        up: -8.97773532812497,
        down: -10.037118437500032,
      },
      {
        x: -1332.19,
        z: -472.62,
        y: -5.0684968161851325,
        up: -8.283177139336749,
        down: -7.3141900195460945,
      },
    ],
    [
      {
        x: 467.178,
        z: -33.83,
        y: 7.8,
        up: 1.8150126031466356,
        down: -5.780696768630639,
      },
      {
        x: 480.096,
        z: -34.699,
        y: 7.8,
        up: 4.941778643594455,
        down: -4.898385574892506,
      },
      {
        x: 528.938,
        z: -15.806,
        y: 7.8,
        up: 6.8999999999999995,
        down: -3.261387661701383,
      },
      {
        x: 654,
        z: 19,
        y: 7.8,
        up: -0.9055559999999674,
        down: -1.467347203125064,
      },
      {
        x: 793,
        z: 48,
        y: 6.775710749999987,
        up: 0.40706042187499625,
        down: 0.03180072265629397,
      },
      {
        x: 930,
        z: 63,
        y: 5.036657846875009,
        up: -0.13551662500001393,
        down: 2.4201575312500494,
      },
      {
        x: 1150,
        z: 102,
        y: 3.786437606250031,
        up: -0.12236503125004683,
        down: 0.06555553906249534,
      },
      {
        x: 1340,
        z: 122,
        y: 1.5951043249999746,
        up: -1.1389809218750089,
        down: -0.9110739375000549,
      },
      {
        x: 1525,
        z: 155,
        y: -0.036462609374950716,
        up: -1.116195874999994,
        down: -1.1490395312500028,
      },
    ],
  ],
  span: [-467.178, 467.178],
  sluice: {
    from: -112,
    to: 14,
    count: 7,
  },
  plant: {
    from: 14,
    to: 185,
    count: 12,
    apronY: -25.717491000000006,
  },
  scope:
    'Roseires Dam’s signed concrete barrage and approach embankments, photographed buttresses, the central sluice chutes, power hall and downstream apron.',
};
const C = {
  face: [0.59, 0.44, 0.3],
  head: [0.73, 0.65, 0.5],
  deck: [0.52, 0.46, 0.37],
  earth: [0.48, 0.39, 0.28],
  metal: [0.26, 0.3, 0.28],
  shade: [0.28, 0.23, 0.18],
  glass: [0.21, 0.29, 0.27],
  green: [0.42, 0.6, 0.58],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  face: { slot: 'wall', graph: 'concrete_boardformed' },
  head: { slot: 'wall', graph: 'concrete_boardformed' },
  shade: { slot: 'wall', graph: 'concrete_boardformed' },
  deck: { slot: 'foundation', graph: 'concrete_plain' },
  earth: { slot: 'foundation', graph: 'gravel' },
  metal: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  green: { slot: 'roof', graph: 'metal_standing_seam' },
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
const { crest, crestY, tailwater, foundation, span, sluice, plant } = controls;
const q = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const t = (o, c, p, s, n) => T(o, c, p, s, C[s], n);
const lerp = (a, b, f) => a + (b - a) * f;
const rod = (o, c, a, b, w, h, s = 'metal') => beam(adapter(o, c), s, a, b, w, h, C[s]);
function center(x) {
  const i = crest.findIndex((p) => p[0] > x),
    j = i > 0 ? i : crest.length - 1;
  const [a, b] = crest[j - 1],
    [d, e] = crest[j];
  return lerp(b, e, (x - a) / (d - a));
}
const P = (x, z, y) => [x, y, center(x) + z];
function box(o, c, a, b, v, w, y, h, s) {
  const A = P(a, v, h),
    B = P(b, v, h),
    D = P(a, w, h),
    E = P(b, w, h),
    p = P(a, v, y),
    r = P(b, v, y),
    u = P(a, w, y),
    v2 = P(b, w, y);
  for (const [ps, n] of [
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [
      [p, r, B, A],
      [0, 0, -1],
    ],
    [
      [u, v2, E, D],
      [0, 0, 1],
    ],
    [
      [p, u, D, A],
      [-1, 0, 0],
    ],
    [
      [r, v2, E, B],
      [1, 0, 0],
    ],
  ])
    q(o, c, ps, s, n);
  if (c.near) q(o, c, [p, u, v2, r], s, [0, -1, 0]);
}

function earthwork(o, c, stations) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      p = (q, d, y) => [q.x, q[y], q.z + d];
    q(o, c, [p(a, -29, 'up'), p(b, -29, 'up'), p(b, -5, 'y'), p(a, -5, 'y')], 'face', [0, 1, -1]);
    q(o, c, [p(a, -5, 'y'), p(b, -5, 'y'), p(b, 5, 'y'), p(a, 5, 'y')], 'deck', [0, 1, 0]);
    q(o, c, [p(a, 5, 'y'), p(b, 5, 'y'), p(b, 46, 'down'), p(a, 46, 'down')], 'earth', [0, 1, 1]);
    if (c.near)
      for (const z of [-4.8, 4.8]) {
        rod(o, c, [a.x, a.y + 0.4, a.z + z], [b.x, b.y + 0.4, b.z + z], 0.13, 0.13, 'head');
      }
  }
}

function crestworks(o, c) {
  for (let i = 1; i < crest.length; i++) {
    const a = crest[i - 1][0],
      b = crest[i][0];
    box(o, c, a, b, -7, 7, crestY - 0.85, crestY, 'deck');
    q(
      o,
      c,
      [
        P(a, -31, foundation),
        P(b, -31, foundation),
        P(b, -8, crestY - 0.8),
        P(a, -8, crestY - 0.8),
      ],
      'face',
      [0, 1, -1],
    );
    if (c.detail)
      for (const z of [-6.5, 6.5])
        rod(o, c, P(a, z, crestY + 0.58), P(b, z, crestY + 0.58), 0.14, 0.16, 'head');
  }
  for (let x = span[0] + 4; x < span[1]; x += c.fine ? 8 : c.near ? 14 : 23)
    if (c.detail)
      for (const z of [-6.5, 6.5]) {
        rod(o, c, P(x, z, crestY), P(x, z, crestY + 0.7), 0.13, 0.13, 'head');
      }
  for (const [x, w] of [
    [-315, 9],
    [231, 12],
    [352, 8],
  ]) {
    box(o, c, x, x + w, -5, 3, crestY, crestY + 7.3, 'head');
    if (c.detail) box(o, c, x + 0.6, x + w - 0.6, 3, 3.14, crestY + 3.2, crestY + 5.5, 'glass');
  }
}

function buttress(o, c, x, w) {
  if (!c.detail) {
    const a = x - w / 2,
      b = x + w / 2,
      p = P(a, 7, crestY - 0.8),
      r = P(b, 7, crestY - 0.8),
      u = P(a, 34, foundation),
      v = P(b, 34, foundation);
    q(o, c, [p, r, v, u], 'face', [0, 1, 1]);
    t(o, c, [p, u, P(a, -6, foundation)], 'face', [-1, 0, 0]);
    t(o, c, [r, v, P(b, -6, foundation)], 'face', [1, 0, 0]);
    return;
  }
  const a = x - w / 2,
    b = x + w / 2,
    d = [
      [-8, crestY - 0.8],
      [8, crestY - 0.8],
      [33, tailwater + 1.2],
      [36, foundation],
      [-24, foundation],
    ];
  const p = d.map(([z, y]) => P(a, z, y)),
    r = d.map(([z, y]) => P(b, z, y));
  for (let i = 1; i < d.length; i++)
    q(o, c, [p[i - 1], r[i - 1], r[i], p[i]], i === 1 ? 'head' : 'face', [0, 1, 1]);
  for (let i = 1; i < d.length - 1; i++) {
    t(o, c, [p[0], p[i], p[i + 1]], 'face', [-1, 0, 0]);
    t(o, c, [r[0], r[i], r[i + 1]], 'face', [1, 0, 0]);
  }
  if (c.fine) rod(o, c, P(a, 8, crestY - 0.9), P(a, 33, tailwater + 1.2), 0.24, 0.24, 'head');
}

function face(o, c, a, b, bays) {
  const w = (b - a) / bays;
  box(o, c, a, b, -13, -3, foundation, crestY - 1, 'shade');
  for (let i = 0; i < bays; i++) {
    const x = a + (i + 0.5) * w;
    buttress(o, c, x, w * 0.26);
    if (c.detail)
      box(o, c, a + i * w, Math.min(b, a + (i + 1) * w), 4, 8, crestY - 4.3, crestY - 0.85, 'head');
    if (c.master) {
      const y = tailwater + 4;
      rod(o, c, P(x, 30, y), P(x, 23, y + 8), 0.23, 0.21, 'head');
    }
  }
}

function gates(o, c) {
  const { from, to, count } = sluice,
    step = (to - from) / count;
  for (let i = 0; i <= count; i++) {
    const x = from + i * step;
    buttress(o, c, x, 2.35);
    const a = x - 1.25,
      b = x + 1.25,
      y0 = crestY - 6,
      y1 = tailwater + 1.3;
    q(o, c, [P(a, 9, y0), P(b, 9, y0), P(b, 50, y1), P(a, 50, y1)], 'head', [0, 1, 1]);
    for (const [u, n] of [
      [a, [-1, 0, 0]],
      [b, [1, 0, 0]],
    ]) {
      q(o, c, [P(u, 9, y0), P(u, 50, y1), P(u, 50, foundation), P(u, 9, foundation)], 'face', n);
    }
    if (i === count) break;
    const u = b,
      v = x + step - 1.25;
    q(
      o,
      c,
      [
        P(u, 9, crestY - 8),
        P(v, 9, crestY - 8),
        P(v, 50, tailwater + 0.6),
        P(u, 50, tailwater + 0.6),
      ],
      'face',
      [0, 1, 1],
    );
    box(o, c, u, v, -4, 1, crestY - 12, crestY - 0.8, 'metal');
    if (c.detail) box(o, c, u, v, 3, 8, crestY - 5, crestY - 2.7, 'head');
    if (c.near)
      for (let k = 1; k < 4; k++)
        rod(o, c, P(u, 1.3, crestY - 12 + k * 1.7), P(v, 1.3, crestY - 12 + k * 1.7), 0.19, 0.23);
    if (c.fine)
      for (const f of [0.27, 0.73]) {
        const a = lerp(u, v, f);
        rod(o, c, P(a, 3, crestY - 10), P(a, 3, crestY - 2.8), 0.19, 0.19);
        if (c.master) box(o, c, a - 0.68, a + 0.68, 2, 4, crestY - 3.6, crestY - 2.4, 'head');
      }
  }
}

function powerhouse(o, c) {
  const { from, to, count, apronY: y } = plant,
    w = (to - from) / count;
  face(o, c, from, to, 9);
  box(o, c, from, to, 18, 45, y, y + 6.8, 'face');
  box(o, c, from, to, 31, 75, y - 1.15, y, 'head');
  box(o, c, from, to, 38, 62, y + 6.35, y + 7.05, 'head');
  for (let i = 0; i <= count; i++) {
    const x = from + i * w;
    box(o, c, x - 0.75, x + 0.75, 40, 75, foundation, y - 0.85, 'face');
    if (c.detail) box(o, c, x - 0.8, x + 0.8, 50, 62, y, y + 6.35, 'head');
    if (i === count) break;
    box(o, c, x + 0.75, x + w - 0.75, 41, 43, foundation, y - 1.15, 'shade');
    box(o, c, x + 0.8, x + w - 0.8, 51, 60.3, y, y + 6.35, 'face');
    if (c.detail) box(o, c, x + 1.25, x + w - 1.25, 60.25, 60.46, y + 2.7, y + 4.8, 'glass');
    if (c.fine)
      for (const u of [x + 2, x + 6.8, x + 11])
        rod(o, c, P(u, 74.3, y), P(u, 74.3, y + 1.1), 0.13, 0.13);
    if (c.master)
      for (const u of [x + 3.4, x + 7.1, x + 10.7])
        box(o, c, u - 0.19, u + 0.19, 60.43, 60.58, y + 2.7, y + 4.8, 'head');
  }
  if (c.near) rod(o, c, P(from, 74.3, y + 1.07), P(to, 74.3, y + 1.07), 0.14, 0.15);
  if (c.detail)
    for (const [x, w] of [
      [29, 14],
      [124, 13],
      [155, 12],
    ]) {
      box(o, c, x, x + w, 4, 12, crestY - 0.3, crestY + 3, 'head');
      box(o, c, x - 0.55, x + w + 0.55, 3.5, 12.55, crestY + 3, crestY + 3.65, 'green');
      if (c.near) box(o, c, x + 0.5, x + w - 0.5, 12, 12.11, crestY + 0.25, crestY + 2.3, 'glass');
    }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Roseires tier ' + level);
  for (const wing of controls.wings) earthwork(o, c, wing);
  crestworks(o, c);
  face(o, c, span[0], sluice.from, 17);
  gates(o, c);
  powerhouse(o, c);
  face(o, c, plant.to, span[1], 15);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

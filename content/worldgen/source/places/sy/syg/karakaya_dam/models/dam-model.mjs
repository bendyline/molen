import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  crest: [
    [-191.05596, 0, 0],
    [-175.2001, -27.08675, 31.3863078730535],
    [-167.98802, -37.25594, 43.85332528631237],
    [-160.29863, -46.90808, 56.19393001832206],
    [-153.70958, -53.94836, 65.83660197068569],
    [-146.81559, -60.31249, 75.21899232586703],
    [-139.76249, -66.50427, 84.60431912776369],
    [-132.23209, -72.17902, 94.03351377643332],
    [-124.3835, -77.50907, 103.52086314233105],
    [-110.79425, -85.26558, 119.16794475337277],
    [-95.19001, -101.90502, 141.97941707523748],
    [-82.5685, -106.21441, 155.31633414224365],
    [-69.81439, -109.68855, 168.53514538348998],
    [-58.09437, -112.20807, 180.5229245702618],
    [-37.54453, -115.53669, 201.34060059641803],
    [-29.03291, -116.69049, 209.9300667884698],
    [-20.38869, -117.00903, 218.58015390595017],
    [-14.42256, -116.77063, 224.551045107178],
    [3.62166, -115.55162, 242.63639444824688],
    [18.49724, -113.96124, 257.5967483505047],
    [33.35959, -112.0394, 272.5828391185502],
    [45.21238, -109.57385, 284.6893484249771],
    [56.87958, -106.61774, 296.72521740781747],
    [85.68974, -96.50287, 327.25939357719363],
    [104.46348, -88.61495, 347.62290495205235],
    [119.76362, -81.03182, 364.6991499905993],
    [125.43822, -77.65119, 371.3044315407605],
    [134.77222, -70.30648, 383.1816501117939],
    [153.13544, -52.14339, 409.0100392817847],
    [159.81784, -44.90463, 418.86164402911396],
    [171.97621, -29.31337, 438.6331727875206],
    [181.86739, -15.14063, 455.9161702387731],
    [191.05596, 0, 473.62685897303186],
  ],
  deck: 16,
  foundation: -142,
  tailwater: -120,
  headwater: 0,
  gates: 10,
  bayWidth: 16,
  centralStart: 141,
  scope:
    'Signed PMTiles arc across the Euphrates, ten central ogee spillway chutes and crest machinery. The mapped lower powerhouse, stepped concrete terraces, and crest machinery complete the visible complex.',
  planBasis:
    'Southern reservoir edge from z15 PMTiles, feature 3708290, extract record 123 polygon 1, vertex indices 178 through 145. End controls are the visible tips of the mapped arc at both canyon shoulders.',
  datum: 681,
  powerhouse: {
    mapIndex: 124,
    id: 35184583045645,
    outline: [
      [61.35132, 1.62131],
      [41.82375, 45.82461],
      [23.71282, 37.96309],
      [43.41277, -6.39928],
      [61.35132, 1.62131],
    ],
  },
  downstreamBridge: {
    mapIndex: 78,
    id: 35184544332953,
    centerline: [
      [81.40983, 513.35221],
      [-12.71065, 530.00575],
    ],
  },
};
const C = {
  wall: [0.58, 0.54, 0.48],
  base: [0.39, 0.365, 0.335],
  chute: [0.68, 0.655, 0.595],
  paving: [0.38, 0.358, 0.325],
  gate: [0.12, 0.205, 0.215],
  rails: [0.16, 0.168, 0.168],
  machinery: [0.62, 0.48, 0.075],
  glass: [0.13, 0.25, 0.28],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_plain' },
  base: { slot: 'foundation', graph: 'concrete_plain' },
  chute: { slot: 'wall', graph: 'concrete_plain' },
  paving: { slot: 'foundation', graph: 'stone_basalt' },
  gate: { slot: 'door', graph: 'metal_painted' },
  rails: { slot: 'door', graph: 'metal_painted' },
  machinery: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
};
const cfg = {
  skyline: { step: 34, profileStep: 3 },
  district: { step: 17, profileStep: 2, details: true },
  street: { step: 8, profileStep: 1, details: true, rail: true },
  closeup: { step: 5, profileStep: 1, details: true, rail: true },
  master: { step: 3.5, profileStep: 1, details: true, rail: true },
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
const { crest, deck, gates, bayWidth, centralStart } = controls;
const length = crest.at(-1)[2],
  centralEnd = centralStart + gates * bayWidth;
const lerp = (a, b, t) => a + (b - a) * t;
function crestPoint(s) {
  const last = crest.findIndex((q) => q[2] > s),
    i = last < 0 ? crest.length - 2 : Math.max(0, last - 1),
    a = crest[i],
    b = crest[i + 1];
  const t = (s - a[2]) / (b[2] - a[2]);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
function frame(s) {
  const [x, z] = crestPoint(s),
    a = crestPoint(Math.max(0, s - 25)),
    b = crestPoint(Math.min(length, s + 25));
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  return { x, z, forward: [-dz / l, 0, dx / l], along: [dx / l, 0, dz / l] };
}
export function archPoint(s, depth, y) {
  const { x, z, forward } = frame(s);
  return [x + depth * forward[0], y, z + depth * forward[2]];
}
function strip(o, c, s0, s1, a, b, slot, n = [0, 1, 0]) {
  Q(
    o,
    c,
    [archPoint(s0, ...a), archPoint(s1, ...a), archPoint(s1, ...b), archPoint(s0, ...b)],
    slot,
    C[slot],
    n,
  );
}
function solid(o, c, s0, s1, z0, z1, y0, y1, slot) {
  const { forward, along } = frame((s0 + s1) / 2),
    back = forward.map((v) => -v),
    left = along.map((v) => -v);
  strip(o, c, s0, s1, [z0, y1], [z1, y1], slot);
  strip(o, c, s0, s1, [z0, y0], [z1, y0], slot, [0, -1, 0]);
  strip(o, c, s0, s1, [z0, y0], [z0, y1], slot, back);
  strip(o, c, s0, s1, [z1, y0], [z1, y1], slot, forward);
  for (const [s, n] of [
    [s0, left],
    [s1, along],
  ])
    Q(
      o,
      c,
      [
        [z0, y0],
        [z1, y0],
        [z1, y1],
        [z0, y1],
      ].map((p) => archPoint(s, ...p)),
      slot,
      C[slot],
      n,
    );
}
const wallProfile = [
  [4, 0],
  [9, -0.1],
  [19, -0.3],
  [33, -0.53],
  [48, -0.76],
  [63, -1],
];
const chuteProfile = [
  [9, 7],
  [22, -2],
  [38, -16],
  [60, -35],
  [83, -58],
  [106, -79],
  [129, -96],
  [151, -108],
  [166, -113],
  [180, -115],
];

// Keep the real arc at the gate. The lower chute dividers taper to the
// mapped outlet instead of following intersecting normals of the upper arch.
export function chutePoint(s, depth, y) {
  const f = archPoint(s, Math.min(depth, 52), y),
    t = Math.max(0, (depth - 52) / 128);
  const r = (s - centralStart) / (centralEnd - centralStart);
  return [lerp(f[0], -35 + 70 * r, t), y, lerp(f[2], 54 + 3 * r, t)];
}
export const chuteEdges = chuteProfile.map(([d, y]) => [
  chutePoint(centralStart - 1, d, y),
  chutePoint(centralEnd + 1, d, y),
]);
function chuteStrip(o, c, s0, s1, a, b, slot) {
  Q(
    o,
    c,
    [chutePoint(s0, ...a), chutePoint(s1, ...a), chutePoint(s1, ...b), chutePoint(s0, ...b)],
    slot,
    C[slot],
    [0, 1, 0],
  );
}
const buttressHeight = (s) => {
  const edge = Math.abs((s - length * 0.5) / (length * 0.5));
  return -142 + 112 * Math.pow(edge, 2.5);
};
function wall(o, c) {
  const stations = [0, centralStart, centralEnd, length];
  for (let s = c.step; s < length; s += c.step)
    if (Math.min(Math.abs(s - centralStart), Math.abs(s - centralEnd)) > 1) stations.push(s);
  stations.sort((a, b) => a - b);
  const S = (s, [depth, dy], top) => archPoint(s, depth, lerp(top, buttressHeight(s), -dy));
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      s = (a + b) / 2,
      central = s > centralStart && s < centralEnd,
      top = central ? 7 : deck,
      { forward } = frame(s);
    const profile = wallProfile.filter(
      (_, j) => j === wallProfile.length - 1 || j % c.profileStep === 0,
    );
    for (let j = 1; j < profile.length; j++)
      Q(
        o,
        c,
        [
          S(a, profile[j - 1], top),
          S(b, profile[j - 1], top),
          S(b, profile[j], top),
          S(a, profile[j], top),
        ],
        'wall',
        C.wall,
        forward,
      );
    strip(o, c, a, b, [-4, top], [4, top], 'paving');
    Q(
      o,
      c,
      [
        archPoint(a, -5, buttressHeight(a)),
        archPoint(b, -5, buttressHeight(b)),
        archPoint(b, 63, buttressHeight(b)),
        archPoint(a, 63, buttressHeight(a)),
      ],
      'base',
      C.base,
      [0, -1, 0],
    );
    Q(
      o,
      c,
      [
        archPoint(a, -4, top),
        archPoint(b, -4, top),
        archPoint(b, -5, buttressHeight(b)),
        archPoint(a, -5, buttressHeight(a)),
      ],
      'wall',
      C.wall,
      forward.map((v) => -v),
    );
    if (central) solid(o, c, a, b, -5, -0.4, deck - 1, deck, 'paving');
    if (c.rail) {
      beam(
        adapter(o, c),
        'rails',
        archPoint(a, -4.9, deck + 1.05),
        archPoint(b, -4.9, deck + 1.05),
        0.12,
        0.12,
        C.rails,
      );
      beam(
        adapter(o, c),
        'rails',
        archPoint(a, -4.9, deck),
        archPoint(a, -4.9, deck + 1.05),
        0.12,
        0.12,
        C.rails,
      );
    }
  }
  for (const s of [0, length]) {
    const { along } = frame(s),
      normal = s === 0 ? along.map((v) => -v) : along,
      foot = buttressHeight(s);
    Q(
      o,
      c,
      [
        archPoint(s, -4, deck),
        archPoint(s, 4, deck),
        archPoint(s, 63, foot),
        archPoint(s, -5, foot),
      ],
      'base',
      C.base,
      normal,
    );
  }
}
function spillway(o, c) {
  const pierWidth = 1.8;
  const profile = chuteProfile.filter(
    (_, j) => j === chuteProfile.length - 1 || j % c.profileStep === 0,
  );
  // Side faces support the outer spillway walls down to the real occupied foundation.
  for (const [s, side] of [
    [centralStart - 1, -1],
    [centralEnd + 1, 1],
  ]) {
    const normal = frame(s).along.map((v) => v * side);
    for (let j = 1; j < profile.length; j++) {
      const a = chutePoint(s, ...profile[j - 1]),
        b = chutePoint(s, ...profile[j]);
      Q(
        o,
        c,
        [a, b, [b[0], controls.foundation, b[2]], [a[0], controls.foundation, a[2]]],
        'base',
        C.base,
        normal,
      );
    }
  }
  for (let i = 0; i < gates; i++) {
    const start = centralStart + i * bayWidth,
      end = start + bayWidth;
    for (let j = 1; j < profile.length; j++) {
      const a = profile[j - 1],
        b = profile[j];
      chuteStrip(o, c, start, end, a, b, 'chute');
      const scale = (y) => (y > 0 ? 7.5 : Math.max(1.8, 6 + y * 0.037));
      for (const [s, n] of [
        [start, 1],
        [end, -1],
      ]) {
        const u = s + n * pierWidth * 0.55,
          along = frame(s).along.map((v) => v * n);
        Q(
          o,
          c,
          [
            chutePoint(u, ...a),
            chutePoint(u, ...b),
            chutePoint(u, b[0], b[1] + scale(b[1])),
            chutePoint(u, a[0], a[1] + scale(a[1])),
          ],
          'base',
          C.base,
          along,
        );
      }
      chuteStrip(
        o,
        c,
        start - pierWidth * 0.45,
        start + pierWidth * 0.55,
        [a[0], a[1] + scale(a[1])],
        [b[0], b[1] + scale(b[1])],
        'wall',
      );
      if (i === gates - 1)
        chuteStrip(
          o,
          c,
          end - pierWidth * 0.55,
          end + pierWidth * 0.45,
          [a[0], a[1] + scale(a[1])],
          [b[0], b[1] + scale(b[1])],
          'wall',
        );
    }
    solid(o, c, start - pierWidth * 0.55, start + pierWidth * 0.55, 1, 11, 7, deck + 2, 'wall');
    if (i === gates - 1)
      solid(o, c, end - pierWidth * 0.55, end + pierWidth * 0.55, 1, 11, 7, deck + 2, 'wall');
    solid(o, c, start + pierWidth * 0.55, end - pierWidth * 0.55, 7, 8, 8.2, 14.9, 'gate');
    solid(o, c, start, end, 2, 7, deck - 0.5, deck + 0.6, 'paving');
    if (c.details) {
      solid(o, c, start + 4, end - 4, 2, 5, deck + 0.6, deck + 3.1, 'gate');
      for (const u of [start + 3, end - 3])
        beam(
          adapter(o, c),
          'rails',
          archPoint(u, 8, 8.5),
          archPoint(u, 8, 15.1),
          0.28,
          0.3,
          C.rails,
        );
    }
  }
}

export const plantOutline = controls.powerhouse.outline.slice(0, -1);
export const westPlatform = [
  [-63, 21],
  [-44, 23],
  [-36, 55],
  [-42, 68],
  [-67, 55],
];
export const eastPlatform = [
  [33, 48],
  [49, 45],
  [63, 24],
  [76, 31],
  [73, 52],
  [54, 69],
  [37, 65],
];
export const apron = [
  [-36, 49],
  [36, 52],
  [32, 75],
  [-30, 75],
];
const plantCorners = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
function top(o, c, ring, y, slot, up = true) {
  const vertices = ring.map(([x, z]) => [x, y, z]);
  for (let i = 1; i + 1 < vertices.length; i++)
    T(o, c, [vertices[0], vertices[i], vertices[i + 1]], slot, C[slot], [0, up ? 1 : -1, 0]);
}
function sides(o, c, ring, low, high, slot) {
  const area = ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return a + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [a, b] = ring[(i + 1) % ring.length];
    Q(
      o,
      c,
      [
        [x, low, z],
        [a, low, b],
        [a, high, b],
        [x, high, z],
      ],
      slot,
      C[slot],
      [(b - z) * Math.sign(area), 0, (x - a) * Math.sign(area)],
    );
  }
}
function prism(o, c, ring, low, high, slot) {
  top(o, c, ring, high, slot);
  top(o, c, ring, low, slot, false);
  sides(o, c, ring, low, high, slot);
}
function facilities(o, c) {
  prism(o, c, apron, -142, -116, 'base');
  prism(o, c, westPlatform, -142, -108, 'base');
  prism(o, c, eastPlatform, -142, -105, 'base');
  prism(o, c, plantOutline, -138, -99, 'wall');
  const inset = (ring, m) => {
    const mid = ring.reduce(
      (a, q) => [a[0] + q[0] / ring.length, a[1] + q[1] / ring.length],
      [0, 0],
    );
    return ring.map(([x, z]) => [lerp(x, mid[0], m), lerp(z, mid[1], m)]);
  };
  prism(o, c, inset(plantOutline, 0.08), -99, -97.3, 'paving');
  if (!c.details) return;
  for (let i = 0; i < plantOutline.length; i++) {
    const p = plantOutline[i],
      q = plantOutline[(i + 1) % plantOutline.length],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      l = Math.hypot(dx, dz),
      n = [dz / l, 0, -dx / l];
    for (let j = 0, count = Math.round(l / 5); j < count; j++) {
      const point = (t, y) => {
        const [x, z] = plantCorners(p, q, t);
        return [x + n[0] * 0.045, y, z + n[2] * 0.045];
      };
      const a = (j + 0.19) / count,
        b = (j + 0.81) / count;
      Q(
        o,
        c,
        [point(a, -103.4), point(b, -103.4), point(b, -100.7), point(a, -100.7)],
        'glass',
        C.glass,
        n,
      );
    }
  }
  for (const ring of [westPlatform, eastPlatform]) {
    const terrace = inset(ring, 0.23);
    prism(
      o,
      c,
      terrace,
      ring === westPlatform ? -108 : -105,
      ring === westPlatform ? -104.9 : -102.3,
      'paving',
    );
    if (c.rail)
      for (const [i, p] of terrace.entries()) {
        const q = terrace[(i + 1) % terrace.length],
          y = ring === westPlatform ? -104.9 : -102.3;
        beam(
          adapter(o, c),
          'rails',
          [p[0], y + 1.12, p[1]],
          [q[0], y + 1.12, q[1]],
          0.13,
          0.13,
          C.rails,
        );
        for (
          let k = 0, n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 4));
          k < n;
          k++
        ) {
          const [x, z] = plantCorners(p, q, k / n);
          beam(adapter(o, c), 'rails', [x, y, z], [x, y + 1.12, z], 0.11, 0.11, C.rails);
        }
      }
  }
  // The photos show dark concrete lettering high on the northwest wing.
  const mark = [
    [101, 5, 0, 5, 10],
    [101, 5, 10, 8, 10],
    [101, 8, 10, 11, 7],
    [101, 11, 7, 11, 3],
    [101, 11, 3, 8, 0],
    [101, 8, 0, 5, 0],
    [111, 10, 10, 5, 10],
    [111, 5, 10, 5, 5],
    [111, 5, 5, 10, 5],
    [111, 10, 5, 10, 0],
    [111, 10, 0, 5, 0],
    [123, 6, 0, 6, 8],
    [123, 6, 9.8, 6, 10.6],
  ];
  if (c.rail)
    for (const [s, a, b, d, e] of mark) {
      const P = (u, v) => archPoint(s + u, 4.1 + (10.8 - v) * 0.035, 3.7 + v);
      beam(adapter(o, c), 'rails', P(a, b), P(d, e), 0.21, 0.7, [0.29, 0.28, 0.26]);
    }
  const service = centralEnd + 12;
  solid(o, c, service - 5, service + 5, 3, 11, deck - 2, deck, 'base');
  for (const s of [service - 4.5, service + 4.5])
    for (const d of [3.5, 10.5])
      beam(
        adapter(o, c),
        'machinery',
        archPoint(s, d, deck),
        archPoint(s, d, deck + 13),
        0.76,
        0.94,
        C.machinery,
      );
  for (const d of [3.5, 10.5])
    beam(
      adapter(o, c),
      'machinery',
      archPoint(service - 5.6, d, deck + 13),
      archPoint(service + 5.6, d, deck + 13),
      0.89,
      1.19,
      C.machinery,
    );
  for (const s of [service - 4.5, service, service + 4.5])
    beam(
      adapter(o, c),
      'machinery',
      archPoint(s, 3, deck + 13.4),
      archPoint(s, 11, deck + 13.4),
      0.56,
      0.82,
      C.machinery,
    );
  solid(o, c, service - 1.1, service + 1.1, 6, 9, deck + 11.9, deck + 13.4, 'machinery');
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Karakaya tier ' + level);
  wall(o, c);
  spillway(o, c);
  facilities(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

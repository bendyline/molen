import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [30.5116981667226, 50.588373212230145],
  heading: -0.3464413115815767,
  datum: 98.004144,
  crestElevation: 107.2,
  foundation: 86.9,
  fullPool: 103,
  tailwater: 91.5,
  plant: {
    span: [-103, 185],
    groups: 10,
    pitch: 28.8,
    clearHeight: [93.25, 104.8],
    openingZ: 7.2,
    recessZ: 0.05,
  },
  gantries: [
    { x: -211, z: -22, w: 26, d: 16 },
    { x: 146, z: -30, w: 23, d: 15 },
  ],
  lock: {
    axis: [
      [-386.34407, -190.59866],
      [-390.44064, -0.68777],
    ],
    width: 18,
    wall: 5.2,
    top: 104.9,
    bottom: 87.4,
    upstreamGate: 2.8,
    downstreamGate: 185.4,
  },
  bridge: { span: [-424.77, -347.16], z: -2.51, crest: 107.4 },
  quayOutlines: [
    [
      [-165.12, 88.76],
      [-99.82, 87.63],
      [-98.9, 9.12],
      [-104.8, 8.8],
      [-105.1, 81.72],
      [-164.9, 82.68],
    ],
    [
      [179.72, 9.14],
      [181.81, 89.2],
      [249.44, 91.21],
      [249.52, 84.93],
      [188.2, 83.2],
      [186.13, 8.92],
    ],
  ],
};
const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.49, 0.491, 0.447] },
  pale: { slot: 'trim', graph: 'concrete_plain', rgb: [0.69, 0.684, 0.608] },
  asphalt: { slot: 'wall', graph: 'concrete_plain', rgb: [0.31, 0.324, 0.322] },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: [0.18, 0.21, 0.218] },
  blue: { slot: 'trim', graph: 'metal_painted', rgb: [0.12, 0.375, 0.54] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.223, 0.36, 0.414] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.18, 0.24, 0.262] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([m, { slot, graph }]) => [m, { slot, graph }]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const {
  datum,
  crestElevation: crest,
  foundation,
  plant,
  lock,
  bridge,
  gantries,
  quayOutlines,
} = controls;
const [first, last] = plant.span,
  dy = (h) => h - datum;
const p = (x, h, z) => [x, dy(h), z];
const identity = (x) => x;
export function lockFrame() {
  const [[x, z], [X, Z]] = lock.axis,
    dx = X - x,
    dz = Z - z,
    length = Math.hypot(dx, dz),
    c = dz / length,
    s = dx / length;
  return { length, transform: ([a, y, b]) => [x + a * c + b * s, y, z - a * s + b * c] };
}
const { length: lockLength, transform: lockPoint } = lockFrame();
function face(out, m, points, n, rgb = palette[m].rgb) {
  let normal = normalFor(...points);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  const fn = points.length === 3 ? out.addTriangle : out.addQuad;
  fn.call(out, m, 'palette:#ffffff', points, normal, undefined, rgb);
}
const quad = (out, m, a, b, c, d, n, rgb) => face(out, m, [a, b, c, d], n, rgb);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
function box(out, m, a, b, h, k, u, v, frame = identity, rgb) {
  const [A, B, C, D, E, F, G, H] = [
    [a, h, u],
    [b, h, u],
    [b, h, v],
    [a, h, v],
    [a, k, u],
    [b, k, u],
    [b, k, v],
    [a, k, v],
  ].map((q) => frame(p(...q)));
  const zero = frame([0, 0, 0]),
    N = (a, b, c) => frame([a, b, c]).map((x, i) => x - zero[i]);
  quad(out, m, A, B, F, E, N(0, 0, -1), rgb);
  quad(out, m, B, C, G, F, N(1, 0, 0), rgb);
  quad(out, m, C, D, H, G, N(0, 0, 1), rgb);
  quad(out, m, D, A, E, H, N(-1, 0, 0), rgb);
  quad(out, m, E, F, G, H, [0, 1, 0], rgb);
  quad(out, m, D, C, B, A, [0, -1, 0], rgb);
}
export function hydraulicBays() {
  return Array.from({ length: plant.groups }, (_, i) => {
    const a = first + i * plant.pitch,
      m = a + plant.pitch / 2,
      b = a + plant.pitch;
    return [
      { left: a + 1.6, right: m - 0.67 },
      { left: m + 0.67, right: b - 1.6 },
    ];
  }).flat();
}
function support(out, d, x, w, strong) {
  const a = x - w / 2,
    b = x + w / 2,
    h = plant.clearHeight[0];
  const profile =
    strong && d === 0
      ? [
          [106.55, 6.9],
          [91, 17.7],
          [88.8, 18.9],
          [88.8, 5.5],
        ]
      : strong
        ? [
            [106.55, 6.9],
            [103, 9.4],
            [97.1, 12.8],
            [91, 17.7],
            [88.8, 18.9],
            [88.8, 5.5],
          ]
        : [
            [104.85, 6.85],
            [100.7, 7.5],
            [h, 11.5],
            [h, 5.5],
          ];
  for (const [u, s] of [
    [a, -1],
    [b, 1],
  ]) {
    const center = p(u, strong ? 97.9 : 100, strong ? 9.7 : 7.2);
    for (let i = 1; i < profile.length; i++) {
      const [H, z] = profile[i - 1],
        [K, Z] = profile[i];
      face(out, 'body', [center, p(u, H, z), p(u, K, Z)], [s, 0, 0]);
    }
    const [H, z] = profile[0],
      [K, Z] = profile.at(-1);
    face(out, 'body', [center, p(u, K, Z), p(u, H, z)], [s, 0, 0]);
  }
  for (let i = 1; i < profile.length - 1; i++) {
    const [H, z] = profile[i - 1],
      [K, Z] = profile[i];
    quad(out, 'pale', p(a, H, z), p(b, H, z), p(b, K, Z), p(a, K, Z), [0, 1, 1]);
  }
  if (d > 2 && strong) rod(out, 'dark', p(x, 91.35, 17.62), p(x, 93.1, 16.35), 0.11, 0.12);
}
function spillway(out, d) {
  const {
    openingZ,
    recessZ,
    clearHeight: [h, k],
  } = plant;
  box(out, 'body', first, last, foundation, 93.24, -50.5, 13.3);
  box(out, 'body', first, last, 93.24, 106.28, -50.5, recessZ - 0.15);
  box(out, 'pale', first, last, 104.8, 106.41, recessZ - 0.15, 6.9);
  box(out, 'asphalt', first, last, 106.41, crest, -8.4, 6.9);
  const bays = hydraulicBays();
  for (const { left: a, right: b } of bays) {
    quad(
      out,
      'dark',
      p(a, h, recessZ),
      p(b, h, recessZ),
      p(b, k, recessZ),
      p(a, k, recessZ),
      [0, 0, 1],
    );
    quad(
      out,
      'body',
      p(a, h, recessZ),
      p(b, h, recessZ),
      p(b, h - 0.2, openingZ),
      p(a, h - 0.2, openingZ),
      [0, 1, 0],
    );
    for (const [x, s] of [
      [a, 1],
      [b, -1],
    ])
      quad(out, 'body', p(x, h, recessZ), p(x, h, openingZ), p(x, k, openingZ), p(x, k, recessZ), [
        s,
        0,
        0,
      ]);
    if (d > 0)
      rod(out, 'dark', p(a, 98.85, openingZ - 0.62), p(b, 98.85, openingZ - 0.62), 0.47, 0.72);
    if (d > 1)
      for (const x of [a + 0.32, (a + b) / 2, b - 0.32])
        rod(
          out,
          'dark',
          p(x, h + 0.16, recessZ + 0.11),
          p(x, k - 0.23, recessZ + 0.11),
          0.18,
          0.22,
        );
  }
  for (let i = 0; i <= plant.groups; i++) {
    support(out, d, first + i * plant.pitch, 3.2, true);
    if (i < plant.groups) support(out, d, first + (i + 0.5) * plant.pitch, 1.34, false);
  }
  if (d > 1) {
    for (const z of [-8.19, 6.72]) {
      rod(out, 'pale', p(first, crest + 0.76, z), p(last, crest + 0.76, z), 0.12, 0.13);
      for (let x = first + 0.4; x < last; x += 4.6)
        rod(out, 'dark', p(x, crest, z), p(x, crest + 0.8, z), 0.068, 0.081);
    }
    for (let x = first + 3; x < last - 5; x += 8.6)
      rod(out, 'pale', p(x, crest + 0.014, -0.7), p(x + 3.7, crest + 0.014, -0.7), 0.12, 0.015);
  }
}
function gantry(out, d, { x, z, w, d: depth }) {
  const base = 106.28,
    h = 119.5,
    a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  for (const X of [a + 1, b - 1])
    for (const Z of [u + 1, v - 1]) {
      const K = x + (X - x) * 0.78;
      rod(out, 'blue', p(X, base, Z), p(K, h, Z), 1.65, 1.55);
      if (d > 0)
        rod(out, 'blue', p(X, base + 6, Z), p(K + (x - X) * 0.22, h - 0.25, Z), 0.68, 0.74);
    }
  box(out, 'blue', a, b, h - 0.2, h + 1.85, u, v);
  const ochre = [0.68, 0.45, 0.21];
  box(out, 'pale', x - w * 0.26, x + w * 0.28, h + 1.85, h + 6.1, u + 2, v - 2, identity, ochre);
  box(out, 'roof', x - w * 0.27, x + w * 0.29, h + 6.1, h + 6.52, u + 1.7, v - 1.7);
  if (d > 1) {
    for (const Z of [u, v])
      rod(out, 'blue', p(a + 1, h + 2.3, Z), p(b - 1, h + 2.3, Z), 0.13, 0.15);
    box(out, 'glass', x + w * 0.16, x + w * 0.245, h + 2.9, h + 4.75, v - 1.99, v - 1.91);
    rod(out, 'dark', p(x, h - 0.2, z), p(x, base + 3.4, z), 0.16, 0.17);
  }
}
function superstructure(out, d) {
  box(out, 'body', -237, -103, 91.9, 106.28, -39, 6.9);
  box(out, 'pale', -237, -103, 106.28, 106.86, -39, -8.4);
  box(out, 'asphalt', -237, -103, 106.28, crest, -8.4, 6.9);
  box(out, 'body', 185, 205, 91.2, 106.1, -49, 7.4);
  box(out, 'asphalt', 185, 205, 106.1, 107, -8.4, 7.4);
  for (const g of gantries) gantry(out, d, g);
  box(out, 'pale', -113.8, -93.4, 106.28, 120.25, -34.8, -11.8);
  box(out, 'roof', -114.15, -93.05, 120.25, 120.72, -35.1, -11.5);
  for (const z of [-11.76, -34.88])
    for (let i = 0; i < (d === 0 ? 2 : 5); i++) {
      const n = d === 0 ? 2 : 5,
        x = -112.75 + ((i + 0.45) * 18.4) / n;
      quad(
        out,
        'glass',
        p(x - 1.18, 107.75, z),
        p(x + 1.18, 107.75, z),
        p(x + 1.18, 118.6, z),
        p(x - 1.18, 118.6, z),
        [0, 0, z > -20 ? 1 : -1],
      );
    }
  if (d > 1) {
    for (const z of [-11.65, -35])
      for (let h = 109.5; h < 119; h += 2.45)
        rod(out, 'pale', p(-113.55, h, z), p(-93.6, h, z), 0.12, 0.24);
    for (let i = 0; i < 16; i++) {
      const x = -84 + (i + 0.5) * 13.7;
      box(out, 'pale', x - 2.35, x + 2.35, 106.28, 107.51, -32.6, -26.2);
      box(out, 'dark', x - 1.26, x + 1.26, 107.51, 108.5, -31.8, -27);
      if (d > 2)
        for (const z of [-31, -28.1])
          rod(out, 'dark', p(x, 108.52, z), p(x, 109.45, z), 0.18, 0.25);
    }
  }
}
function quays(out, d) {
  for (const r of quayOutlines) {
    const P = ([x, z], h) => p(x, h, z),
      h = 96.6;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        n = [b[1] - a[1], 0, a[0] - b[0]];
      quad(out, 'body', P(a, 89.4), P(b, 89.4), P(b, h), P(a, h), n);
      if (d > 1 && i < 2) rod(out, 'pale', P(a, h + 0.12), P(b, h + 0.12), 0.31, 0.26);
    }
    for (const [a, b, c, e] of [
      [r[0], r[1], r[4], r[5]],
      [r[1], r[2], r[3], r[4]],
    ])
      quad(out, 'pale', P(a, h), P(b, h), P(c, h), P(e, h), [0, 1, 0]);
  }
}
function lockWorks(out, d) {
  const P = (x, h, z) => lockPoint(p(x, h, z)),
    B = (m, a, b, h, H, u, v, rgb) => box(out, m, a, b, h, H, u, v, lockPoint, rgb);
  const { width, wall, top, bottom, upstreamGate, downstreamGate } = lock,
    half = width / 2;
  for (const s of [-1, 1]) {
    const a = s < 0 ? -half - wall : half,
      b = s < 0 ? -half : half + wall,
      edge = s * half;
    B('body', a, b, bottom, top, -5, lockLength + 6);
    const lining = edge - s * 0.017;
    quad(
      out,
      'body',
      P(lining, bottom, 0.04),
      P(lining, bottom, lockLength),
      P(lining, 96.2, lockLength),
      P(lining, 96.2, 0.04),
      [-s, 0, 0],
      [0.283, 0.294, 0.274],
    );
    if (d > 0) B('pale', a - 0.06, b + 0.06, top, top + 0.27, -5, lockLength + 6);
    for (const z of [upstreamGate, downstreamGate]) {
      const x = s * (half + wall * 0.55);
      B('pale', x - 2, x + 2, top, top + 1.18, z - 2.6, z + 3.2);
      if (z === upstreamGate) {
        const yellow = [0.69, 0.516, 0.163];
        B('pale', x - 0.62, x + 0.62, top + 1.18, top + 8.2, z - 0.49, z + 0.49, yellow);
        B('pale', x - 1.05, x + 1.05, top + 8.2, top + 8.53, z - 0.65, z + 0.65, yellow);
      }
    }
    if (d > 1) {
      const x = s * (half + 0.37);
      rod(out, 'pale', P(x, top + 1, -4), P(x, top + 1, lockLength + 4), 0.081, 0.095);
      for (let z = 4; z < lockLength; z += 4.25)
        rod(out, 'dark', P(x, top + 0.22, z), P(x, top + 1, z), 0.075, 0.087);
    }
    if (d > 2)
      for (let z = 15; z < lockLength - 8; z += 22) {
        rod(out, 'dark', P(edge - s * 0.13, 93.8, z), P(edge - s * 0.13, top + 0.2, z), 0.08, 0.09);
        for (let h = 94.5; h < top; h += 0.62)
          rod(out, 'dark', P(edge - s * 0.14, h, z), P(edge - s * 0.14, h, z + 0.38), 0.05, 0.06);
        rod(
          out,
          'dark',
          P(edge - s * 0.13, 93.8, z + 0.38),
          P(edge - s * 0.13, top + 0.2, z + 0.38),
          0.08,
          0.09,
        );
      }
  }
  B('body', -half, half, bottom - 0.5, bottom, 0, lockLength);
  B('dark', -half, half, bottom, 103.08, upstreamGate - 0.28, upstreamGate + 0.29);
  for (const s of [-1, 1]) {
    const x = s * half,
      z = downstreamGate,
      tip = z - 3.4;
    quad(
      out,
      'dark',
      P(x, bottom, z),
      P(0, bottom, tip),
      P(0, 102.8, tip),
      P(x, 102.8, z),
      [0, 0, 1],
    );
    quad(
      out,
      'dark',
      P(0, bottom, tip - 0.2),
      P(x, bottom, z - 0.2),
      P(x, 102.8, z - 0.2),
      P(0, 102.8, tip - 0.2),
      [0, 0, -1],
    );
    if (d > 1)
      for (let h = 90; h < 102; h += 2.7)
        rod(out, 'dark', P(x, h, z + 0.06), P(0, h, tip + 0.06), 0.17, 0.26);
  }
  const {
    span: [a, b],
    z,
    crest: h,
  } = bridge;
  box(out, 'dark', a, b, h - 2.1, h - 0.39, z - 5.45, z + 5.45);
  box(out, 'asphalt', a, b, h - 0.39, h, z - 5.75, z + 5.75);
  for (const x of [-418.9, -356.2])
    box(out, 'body', x - 1.82, x + 1.82, 92, h - 2.1, z - 4.9, z + 4.9);
  if (d > 0)
    for (const j of [z - 5.48, z + 5.48])
      rod(out, 'pale', p(a, h + 0.84, j), p(b, h + 0.84, j), 0.14, 0.17);
  if (d > 1)
    for (const j of [z - 5.48, z + 5.48])
      for (let x = a + 0.4; x < b; x += 3.8)
        rod(out, 'dark', p(x, h + 0.04, j), p(x, h + 0.88, j), 0.085, 0.09);
  if (d > 3)
    for (const [x, z0] of [
      [-410, -48],
      [-369, -44],
      [-371, -159],
      [-405, -155],
    ]) {
      rod(out, 'dark', p(x, 104.95, z0), p(x, 111.3, z0), 0.1, 0.12);
      rod(out, 'dark', p(x, 111.3, z0), p(x + 1.17, 111.3, z0), 0.09, 0.1);
    }
}
export function buildDamLevel(out, name) {
  const d = levels[name];
  if (d === undefined) throw Error('Unknown Kyiv HPP detail level: ' + name);
  spillway(out, d);
  superstructure(out, d);
  quays(out, d);
  lockWorks(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

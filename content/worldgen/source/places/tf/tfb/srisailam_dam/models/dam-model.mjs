import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [78.89679595828056, 16.086618323666798],
  heading: 2.302985620411987,
  datum: 250.053237,
  span: [-255.562649, 255.562649],
  crestElevation: 275.54,
  foundation: 132.28,
  normalPool: 269.75,
  gates: { count: 12, start: -140.4, pitch: 23.4, width: 18.29, sill: 252.98, height: 16.76 },
  // Upper ogee, main chute, upturned lip, stilling apron and toe.
  chute: [
    [252.98, -7.6],
    [251.85, -1.1],
    [248.4, 4.5],
    [241.2, 11.5],
    [227.2, 29.6],
    [209.4, 54.6],
    [195.7, 75.2],
    [196.9, 80.3],
    [194.4, 86.3],
    [182.1, 90.4],
    [181.3, 115.2],
  ],
  powerhouse: {
    id: 35184617217316,
    outline: [
      [-139.033, 429.55],
      [-137.422, 620.018],
      [-180.071, 620.258],
      [-181.682, 429.791],
    ],
    floor: 198.4,
    eaves: 217.2,
  },
};
const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.52, 0.479, 0.421] },
  pier: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.68, 0.611, 0.513] },
  pale: { slot: 'trim', graph: 'concrete_plain', rgb: [0.71, 0.686, 0.601] },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: [0.184, 0.219, 0.226] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.343, 0.403, 0.438] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.32, 0.39, 0.425] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.159, 0.235, 0.258] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([m, { slot, graph }]) => [m, { slot, graph }]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, span, crestElevation: crest, foundation, gates, chute, powerhouse } = controls;
const p = (x, h, z) => [x, h - datum, z];
function poly(out, m, points, n, rgb = palette[m].rgb) {
  let normal = normalFor(...points);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  const put = points.length === 3 ? out.addTriangle : out.addQuad;
  put.call(out, m, 'palette:#ffffff', points, normal, undefined, rgb);
}
const quad = (out, m, a, b, c, d, n, rgb) => poly(out, m, [a, b, c, d], n, rgb);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
function box(out, m, a, b, h, k, u, v) {
  const A = p(a, h, u),
    B = p(b, h, u),
    C = p(b, h, v),
    D = p(a, h, v),
    E = p(a, k, u),
    F = p(b, k, u),
    G = p(b, k, v),
    H = p(a, k, v);
  quad(out, m, A, B, F, E, [0, 0, -1]);
  quad(out, m, B, C, G, F, [1, 0, 0]);
  quad(out, m, C, D, H, G, [0, 0, 1]);
  quad(out, m, D, A, E, H, [-1, 0, 0]);
  quad(out, m, E, F, G, H, [0, 1, 0]);
  quad(out, m, D, C, B, A, [0, -1, 0]);
}
function band(out, m, a, b, profile, rgb) {
  for (let j = 1; j < profile.length; j++) {
    const [h, z] = profile[j - 1],
      [k, Z] = profile[j];
    quad(out, m, p(a, h, z), p(b, h, z), p(b, k, Z), p(a, k, Z), [0, 1, 1], rgb);
  }
}
const halfPier = (gates.pitch - gates.width) / 2;
export const bayCenter = (i) => gates.start + gates.pitch * (i + 0.5);
const finish = gates.start + gates.count * gates.pitch;
const wingProfile = [
  [crest, 7],
  [256, 9],
  [228, 32],
  [199, 62],
  [188.5, 76],
  [181.3, 88],
];
function wing(out, d, a, b, rightBank) {
  const back = [
    [foundation, -37],
    [181, -27],
    [crest, -8.8],
  ];
  for (let j = 1; j < back.length; j++) {
    const [h, z] = back[j - 1],
      [k, Z] = back[j];
    quad(out, 'body', p(b, h, z), p(a, h, z), p(a, k, Z), p(b, k, Z), [0, 0, -1]);
  }
  if (rightBank) {
    band(out, 'body', a, b, wingProfile.slice(0, 4));
    band(out, 'body', a, b, wingProfile.slice(-2));
    const ports = [-192, -179].map((x) => [x - 2, x + 2]);
    let x = a;
    for (const [u, v] of ports) {
      band(out, 'body', x, u, wingProfile.slice(3, 5));
      band(out, 'dark', u, v, [
        [199, 59.6],
        [188.5, 73.6],
      ]);
      for (const [q, s] of [
        [u, 1],
        [v, -1],
      ])
        quad(out, 'pier', p(q, 199, 59.6), p(q, 199, 62), p(q, 188.5, 76), p(q, 188.5, 73.6), [
          s,
          0,
          0,
        ]);
      quad(out, 'body', p(u, 199, 59.6), p(v, 199, 59.6), p(v, 199, 62), p(u, 199, 62), [0, -1, 0]);
      quad(
        out,
        'body',
        p(u, 188.5, 73.6),
        p(v, 188.5, 73.6),
        p(v, 188.5, 76),
        p(u, 188.5, 76),
        [0, 1, 0],
      );
      x = v;
    }
    band(out, 'body', x, b, wingProfile.slice(3, 5));
  } else band(out, 'body', a, b, wingProfile);
  box(out, 'body', a, b, foundation, 181.3, -37, 88);
  box(out, 'pale', a, b, crest - 0.48, crest, -8.8, 7);
  for (const [x, s] of [
    [a, -1],
    [b, 1],
  ])
    for (let j = 1; j < wingProfile.length; j++) {
      const [h, z] = wingProfile[j - 1],
        [k, Z] = wingProfile[j];
      quad(out, 'pier', p(x, h, -8.8), p(x, h, z), p(x, k, Z), p(x, k, -8.8), [s, 0, 0]);
    }
  if (d > 1)
    for (const z of [-8.3, 6.5])
      rod(out, 'steel', p(a, crest + 0.58, z), p(b, crest + 0.58, z), 0.13, 0.22);
}
function pier(out, d, a, b, outer) {
  // The triangular cheeks carry the radial arms and taper into the ogee below the catwalk.
  const z = outer ? 1.6 : 0,
    h = crest - 1.9;
  const cross = [
    [h, -11.5],
    [h, 6],
    [260, 21.2],
    [241.5, 37.3 + z],
    [219.2, 42.1 + z],
    [214.2, 47.6 + z],
    [215, 46],
    [229, 27],
    [245, 7],
    [252, -11.5],
  ];
  for (const [x, s] of [
    [a, -1],
    [b, 1],
  ]) {
    const center = p(x, 247, 7);
    for (let i = 0; i < cross.length; i++) {
      const [H, u] = cross[i],
        [K, v] = cross[(i + 1) % cross.length];
      poly(out, 'pier', [center, p(x, H, u), p(x, K, v)], [s, 0, 0]);
    }
  }
  for (let i = 1; i < (d === 0 ? 6 : cross.length); i++) {
    const [H, u] = cross[i - 1],
      [K, v] = cross[i];
    quad(
      out,
      'pier',
      p(a, H, u),
      p(b, H, u),
      p(b, K, v),
      p(a, K, v),
      [0, 1, 1],
      i < 2 ? [0.55, 0.504, 0.451] : undefined,
    );
  }
}
function leaf(out, d, x) {
  const { sill, height, width } = gates,
    a = x - width / 2,
    b = x + width / 2;
  const rows = [
    [sill, -7.7],
    [sill + 4.1, -7.25],
    [sill + 8.7, -5.9],
    [sill + 13.2, -3.5],
    [sill + height, 0.1],
  ];
  const skin = d === 0 ? [rows[0], rows[2], rows[4]] : rows;
  band(out, 'dark', a, b, skin);
  for (let i = 1; i < skin.length; i++) {
    const [h, z] = skin[i - 1],
      [k, Z] = skin[i];
    quad(
      out,
      'dark',
      p(b, h, z - 0.24),
      p(a, h, z - 0.24),
      p(a, k, Z - 0.24),
      p(b, k, Z - 0.24),
      [0, 0, -1],
    );
  }
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const q = x + s * (width / 2 - 0.72);
    rod(out, 'steel', p(q, sill + 3.7, -5), p(q, 242.7, 34.4), 0.48, 0.55);
    rod(out, 'steel', p(q, sill + height - 2.15, -0.4), p(q, 242.7, 34.4), 0.48, 0.58);
  }
  if (d > 1) {
    for (const [h, z] of rows.slice(1, -1))
      rod(out, 'steel', p(a + 0.3, h, z + 0.29), p(b - 0.3, h, z + 0.29), 0.22, 0.36);
    for (const q of [a + 4, x, b - 4])
      for (let j = 1; j < rows.length; j++) {
        const [h, z] = rows[j - 1],
          [H, Z] = rows[j];
        rod(out, 'dark', p(q, h, z + 0.17), p(q, H, Z + 0.17), 0.19, 0.29);
      }
  }
  if (d > 2)
    for (const q of [a + 1.1, b - 1.1]) {
      rod(out, 'dark', p(q, 271.1, 1.9), p(q, 275.2, 1.9), 0.09, 0.13);
      rod(out, 'dark', p(q, 269.4, 1.9), p(q, 271.1, 1.9), 0.07, 0.08);
    }
}
function spillway(out, d) {
  const { start, count, pitch, width } = gates;
  const profile = d === 0 ? chute.filter((_, i) => [0, 2, 4, 6, 7, 9, 10].includes(i)) : chute;
  for (let i = 0; i < count; i++) {
    const x = bayCenter(i),
      a = x - width / 2,
      b = x + width / 2;
    const tints = [
        [0.47, 0.427, 0.365],
        [0.519, 0.472, 0.402],
        [0.44, 0.421, 0.347],
        [0.5, 0.456, 0.399],
      ],
      rgb = tints[i % tints.length];
    const j = start + i * pitch;
    if (d === 0) band(out, 'body', j, j + pitch, profile, rgb);
    else {
      band(out, 'body', a, b, profile, rgb);
      band(out, 'body', j, a, profile, [0.388, 0.366, 0.327]);
      band(out, 'body', b, j + pitch, profile, [0.388, 0.366, 0.327]);
    }
    leaf(out, d, x);
  }
  for (let i = 0; i <= count; i++) {
    const x = start + i * pitch;
    pier(
      out,
      d,
      Math.max(start, x - halfPier),
      Math.min(finish, x + halfPier),
      i === 0 || i === count,
    );
  }
  box(out, 'body', start, finish, foundation, 181.3, -39, 115.2);
  quad(
    out,
    'body',
    p(finish, 181.3, -39),
    p(start, 181.3, -39),
    p(start, 252.98, -7.6),
    p(finish, 252.98, -7.6),
    [0, 0, -1],
  );
  box(out, 'steel', start, finish, crest - 2.35, crest - 0.38, -8.8, 7.1);
  box(out, 'pale', start, finish, crest - 0.38, crest, -8.8, 7.1);
  box(out, 'steel', start, finish, 240.96, 241.46, 36.2, 38.3);
  for (let i = 0; i < count; i++) {
    const x = bayCenter(i);
    if (d === 0) {
      const a = x - 3.8,
        b = x + 3.8,
        h = crest + 0.35,
        k = crest + 1.55;
      quad(out, 'steel', p(a, h, 3.7), p(b, h, 3.7), p(b, k, 3.7), p(a, k, 3.7), [0, 0, 1]);
      quad(out, 'steel', p(a, k, -0.8), p(b, k, -0.8), p(b, k, 3.7), p(a, k, 3.7), [0, 1, 0]);
    } else box(out, 'steel', x - 3.8, x + 3.8, crest + 0.35, crest + 1.55, -0.8, 3.7);
    if (d > 1) {
      for (const z of [36.2, 38.27]) {
        rod(out, 'steel', p(x - 11.7, 242.6, z), p(x + 11.7, 242.6, z), 0.14, 0.13);
        for (let j = 0; j < 8; j++) {
          const a = x - 11.7 + j * (pitch / 8),
            b = a + pitch / 8;
          rod(out, 'steel', p(a, 241.42, z), p(b, 242.62, z), 0.09, 0.095);
          if (d > 2) rod(out, 'steel', p(a, 242.62, z), p(b, 241.42, z), 0.075, 0.08);
        }
      }
      for (const x0 of [x - 9.2, x + 9.2])
        rod(out, 'pale', p(x0, crest - 2.2, 7.13), p(x0, crest - 0.5, 7.13), 0.14, 0.2);
    }
  }
  if (d > 1)
    for (const z of [-8.4, 6.7])
      rod(out, 'steel', p(start, crest + 0.6, z), p(finish, crest + 0.6, z), 0.12, 0.2);
}
function station(out, d) {
  const { outline, floor, eaves } = powerhouse,
    upper = eaves + 2.8;
  const [a, b, c, D] = outline;
  const at = ([x, z], h) => p(x, h, z);
  const interp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const g = interp(a, D, 0.5),
    h = interp(b, c, 0.5);
  for (let i = 0; i < outline.length; i++) {
    const A = outline[i],
      B = outline[(i + 1) % outline.length],
      normal = [B[1] - A[1], 0, A[0] - B[0]];
    quad(out, 'pale', at(A, floor), at(B, floor), at(B, eaves), at(A, eaves), normal);
    if (i === 0 || i === 2) {
      const bays = d > 1 ? 21 : 7;
      for (let j = 0; j < bays; j++) {
        const t0 = (j + 0.16) / bays,
          t1 = (j + 0.84) / bays;
        const offset = (P) => [P[0] + (i === 0 ? 0.14 : -0.14), P[1]],
          U = offset(interp(A, B, t0)),
          V = offset(interp(A, B, t1));
        quad(
          out,
          'glass',
          at(U, eaves - 7.2),
          at(V, eaves - 7.2),
          at(V, eaves - 2.5),
          at(U, eaves - 2.5),
          normal,
        );
        if (d > 2) {
          const R = offset(interp(A, B, j / bays));
          rod(out, 'pale', at(R, floor), at(R, eaves), 0.48, 0.52);
        }
      }
    }
  }
  quad(out, 'roof', at(a, eaves), at(b, eaves), at(h, upper), at(g, upper), [0, 1, 0]);
  quad(out, 'roof', at(g, upper), at(h, upper), at(c, eaves), at(D, eaves), [0, 1, 0]);
  poly(out, 'pale', [at(a, eaves), at(D, eaves), at(g, upper)], [0, 0, -1]);
  poly(out, 'pale', [at(c, eaves), at(b, eaves), at(h, upper)], [0, 0, 1]);
  box(out, 'body', -181.65, -138.2, 172.5, floor, 430, 620);
}
function structures(out, d) {
  for (const x of [-231, 218]) {
    box(out, 'pale', x - 3.9, x + 3.9, crest, crest + 8.7, -4.6, 4.1);
    box(out, 'roof', x - 4.1, x + 4.1, crest + 8.7, crest + 9.05, -4.8, 4.3);
    if (d > 1) box(out, 'glass', x - 1.15, x + 1.15, crest + 5.8, crest + 7.25, 4.12, 4.2);
  }
  box(out, 'pale', -210, -157, crest, crest + 3.8, -6.3, 2.8);
  box(out, 'roof', -210.2, -156.8, crest + 3.8, crest + 4.25, -6.55, 3);
  if (d > 2)
    for (const [a, b] of [
      [-141.7, -157.3],
      [141.7, 156.5],
    ]) {
      rod(out, 'steel', p(a, 241.8, 37.5), p(b, crest + 0.1, 9), 0.34, 0.25);
      rod(out, 'steel', p(a, 242.8, 37.5), p(b, crest + 1.1, 9), 0.13, 0.14);
    }
  if (d > 3)
    for (let i = 0; i < gates.count; i++) {
      const x = bayCenter(i);
      rod(out, 'steel', p(x - 3.7, crest + 0.4, 3.9), p(x + 3.7, crest + 0.4, 3.9), 0.17, 0.14);
    }
}
export function buildDamLevel(out, name) {
  const d = tiers[name];
  if (d === undefined) throw Error('Unknown Srisailam Dam detail level: ' + name);
  wing(out, d, span[0], gates.start, true);
  wing(out, d, finish, span[1], false);
  spillway(out, d);
  station(out, d);
  structures(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

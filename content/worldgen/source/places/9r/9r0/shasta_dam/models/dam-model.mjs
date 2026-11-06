import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [-122.41956532001495, 40.71888375385666],
  heading: -0.693792792373768,
  datum: 325.421875,
  crestElevation: 328.422,
  foundation: 144.9324,
  normalPool: 325.2216,
  crest: [
    [-449, 135.15],
    [-386.68189, 105.5681],
    [-379.69485, 101.22845],
    [-345.68982, 82.65859],
    [-312.09301, 66.78298],
    [-293.48323, 58.36879],
    [-267.80194, 48.19378],
    [-243.74508, 39.95856],
    [-216.47199, 31.69738],
    [-174.01363, 20.81378],
    [-154.85763, 16.94917],
    [-128.08055, 12.33839],
    [-97.70997, 7.09356],
    [-51.80944, 2.47188],
    [0, 0],
    [46.64848, 1.23213],
    [113.69702, 0.80318],
    [156.72292, 2.98827],
    [195.48872, 6.06761],
    [223.09844, 9.88973],
    [258.73259, 15.57399],
    [276.05618, 19.41532],
    [315.48227, 29.30478],
    [338.51162, 35.75946],
    [387.4631, 53.91631],
    [423.81299, 69.3085],
    [494.88542, 105.5681],
    [552.25, 135.2],
  ],
  powerhouse: {
    id: 35184522501426,
    outline: [
      [-139.10512, 303.78741],
      [-29.61251, 215.66236],
      [-14.62089, 234.39472],
      [-105.38153, 307.52848],
      [-101.32956, 312.40021],
      [-123.0193, 329.85156],
      [-132.97524, 317.52754],
      [-130.01748, 315.06747],
    ],
    triangles: [7, 0, 1, 7, 1, 2, 7, 2, 3, 7, 3, 4, 7, 4, 5, 7, 5, 6],
    floor: 182.2,
    eaves: 200.7,
  },
  pipes: [
    {
      line: [
        [-149, 252, 86],
        [-143.8317, 244.2313, 136.0206],
        [-139.0941, 238.0311, 181.8728],
        [-134.3564, 226.6933, 227.725],
        [-130.4802, 212.3876, 265.2405],
        [-127.4654, 197, 294.4192],
      ],
      radius: 2.77,
    },
    {
      line: [
        [-129.5, 251.3, 82.4],
        [-124.2769, 240.3256, 129.4738],
        [-119.489, 233.4817, 172.6248],
        [-114.7011, 223.7323, 215.7757],
        [-110.7838, 208.7626, 251.0811],
        [-107.737, 197, 278.5408],
      ],
      radius: 2.77,
    },
    {
      line: [
        [-110, 250.6, 78.8],
        [-104.7221, 237.736, 122.927],
        [-99.8839, 230.5099, 163.3767],
        [-95.0458, 221.3969, 203.8264],
        [-91.0874, 207.3539, 236.9217],
        [-88.0086, 197, 262.6624],
      ],
      radius: 2.77,
    },
    {
      line: [
        [-90.5, 249.9, 75.2],
        [-85.1672, 237.204, 116.3802],
        [-80.2789, 228.6179, 154.1286],
        [-75.3905, 219.8865, 191.8771],
        [-71.3909, 206.2173, 222.7622],
        [-68.2802, 197, 246.784],
      ],
      radius: 2.77,
    },
    {
      line: [
        [-71, 249.2, 71.6],
        [-65.6124, 236.672, 109.8333],
        [-60.6738, 226.4246, 144.8806],
        [-55.7352, 215.3761, 179.9278],
        [-51.6945, 205.2264, 208.6028],
        [-48.5518, 197, 230.9056],
      ],
      radius: 2.77,
    },
  ],
  spillway: {
    span: [-3.2, 111.1],
    gateCenters: [16.1, 54, 91.9],
    clearWidth: 33.528,
    sill: 316.6872,
    height: 8.5344,
  },
  nativeWaterIds: [13286933, 13428403],
};
const palette = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.43, 0.428, 0.403] },
  trim: { slot: 'trim', graph: 'concrete_plain', rgb: [0.65, 0.626, 0.566] },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: [0.148, 0.167, 0.17] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.395, 0.44, 0.461] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.345, 0.366, 0.358] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.18, 0.236, 0.25] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([m, { slot, graph }]) => [m, { slot, graph }]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, crestElevation: top, foundation, crest, spillway, powerhouse, pipes } = controls;
const [a, b] = spillway.span,
  first = crest[0][0],
  last = crest.at(-1)[0];
const p = (x, h, z) => [x, h - datum, z];
const profile = [
  [foundation, 136, -29, 0.22],
  [181.5, 131, -24, 0.29],
  [207, 112, -19, 0.42],
  [230, 95, -15, 0.59],
  [252, 73, -12, 0.73],
  [275, 52, -10, 0.85],
  [302, 29, -7.5, 0.93],
  [top, 4.57, -4.57, 1],
];
const chute = [
  [181.5, 142],
  [188, 127],
  [212, 110],
  [242, 83],
  [273, 57],
  [295, 36],
  [315.6, -0.6],
  [316.6872, -4.9],
];
const outletRows = [
  { elevation: 235, radius: 1.48 },
  { elevation: 263.8, radius: 1.48 },
  { elevation: 291.3, radius: 1.48 },
];
export const outlets = outletRows.map((row) => ({
  ...row,
  stations: [8, 22.2, 45.9, 60.1, 83.8, 98],
}));
const lerp = (x, y, t) => x + (y - x) * t;
function at(rows, t) {
  let i = 1;
  while (i < rows.length - 1 && t > rows[i][0]) i++;
  const x = rows[i - 1],
    y = rows[i],
    u = (t - x[0]) / (y[0] - x[0]);
  return x.slice(1).map((n, j) => lerp(n, y[j + 1], u));
}
const crown = (u) => at(crest, u)[0];
export function chutePoint(x, h, offset = 0) {
  return p(x, h, at(chute, h)[0] + offset + 0.4 * lerp(crown(a), crown(b), (x - a) / (b - a)));
}
export const wingPoint = (u, h, side) => {
  const [front, back, extent] = at(profile, h),
    edge = u <= a ? a : b;
  return p(
    edge + (u - edge) * extent,
    h,
    (side === 1 ? front : back) + crown(u) * (0.55 + 0.45 * extent),
  );
};
function polygon(out, m, pts, n, rgb = palette[m].rgb) {
  let normal = normalFor(...pts);
  if (normal.reduce((v, x, i) => v + x * n[i], 0) < 0) {
    pts = pts.toReversed();
    normal = normalFor(...pts);
  }
  const add = pts.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, m, 'palette:#ffffff', pts, normal, undefined, rgb);
}
const q = (out, m, a, b, c, d, n, rgb) => polygon(out, m, [a, b, c, d], n, rgb);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
function box(out, m, x, X, h, H, z, Z) {
  const A = p(x, h, z),
    B = p(X, h, z),
    C = p(X, h, Z),
    D = p(x, h, Z),
    E = p(x, H, z),
    F = p(X, H, z),
    G = p(X, H, Z),
    I = p(x, H, Z);
  q(out, m, A, B, F, E, [0, 0, -1]);
  q(out, m, B, C, G, F, [1, 0, 0]);
  q(out, m, C, D, I, G, [0, 0, 1]);
  q(out, m, D, A, E, I, [-1, 0, 0]);
  q(out, m, E, F, G, I, [0, 1, 0]);
  q(out, m, D, C, B, A, [0, -1, 0]);
}
function wings(out, d) {
  for (const [l, r] of [
    [first, a],
    [b, last],
  ]) {
    const stations = [
      l,
      ...crest.filter(([u], i) => u > l && u < r && (d > 0 || i % 4 === 0)).map(([u]) => u),
      r,
    ];
    const rows = d === 0 ? profile.filter((_, i) => [0, 1, 4, 7].includes(i)) : profile;
    for (let i = 1; i < stations.length; i++) {
      const x = stations[i - 1],
        X = stations[i];
      for (const s of [-1, 1])
        for (let j = 1; j < rows.length; j++) {
          const [h] = rows[j - 1],
            [H] = rows[j];
          const tint = (i % 5 === 0 ? 0.91 : i % 7 === 0 ? 1.12 : 1) * (H < 227 ? 0.84 : 1);
          q(
            out,
            'wall',
            wingPoint(x, h, s),
            wingPoint(X, h, s),
            wingPoint(X, H, s),
            wingPoint(x, H, s),
            [0, 0, s],
            palette.wall.rgb.map((v) => v * tint),
          );
        }
    }
    for (const [u, s] of [
      [l, -1],
      [r, 1],
    ])
      for (let j = 1; j < rows.length; j++) {
        const [h] = rows[j - 1],
          [H] = rows[j];
        q(
          out,
          'wall',
          wingPoint(u, h, -1),
          wingPoint(u, h, 1),
          wingPoint(u, H, 1),
          wingPoint(u, H, -1),
          [s, 0, 0],
        );
      }
  }
}
function crestRoad(out, d) {
  const stations = [...crest.map(([x]) => x), a, b].sort((a, b) => a - b);
  for (let i = 1; i < stations.length; i++) {
    const x = stations[i - 1],
      X = stations[i],
      P = (u, h, z) => p(u, h, crown(u) + z);
    q(out, 'trim', P(x, top, -4.57), P(X, top, -4.57), P(X, top, 4.57), P(x, top, 4.57), [0, 1, 0]);
    for (const s of [-1, 1]) {
      if (d === 0 && (x < a || X > b)) continue;
      const z = s * 4.55;
      q(out, 'wall', P(x, top - 1.12, z), P(X, top - 1.12, z), P(X, top, z), P(x, top, z), [
        0,
        0,
        s,
      ]);
      if (d > 0) rod(out, 'trim', P(x, top + 0.54, z), P(X, top + 0.54, z), 0.16, 0.19);
      if (d > 1)
        for (let u = x; u < X; u += 4.8)
          rod(out, 'steel', P(u, top + 0.03, z), P(u, top + 0.59, z), 0.085, 0.09);
    }
  }
}
function spillBand(out, a, b, lo, hi, d) {
  const rows = [
    lo,
    ...chute.filter(([h], i) => h > lo && h < hi && (d > 0 || i % 2 === 0)).map(([h]) => h),
    hi,
  ];
  for (let i = 1; i < rows.length; i++) {
    const h = rows[i - 1],
      H = rows[i];
    q(
      out,
      'wall',
      chutePoint(a, h),
      chutePoint(b, h),
      chutePoint(b, H),
      chutePoint(a, H),
      [0, 1, 1],
      [0.375, 0.369, 0.346],
    );
  }
}
function outletRow(out, d, { elevation: h, radius: r, stations }) {
  const margin = r * 1.43,
    n = d === 0 ? 4 : d === 1 ? 8 : 16;
  let prev = a;
  for (const u of stations) {
    spillBand(out, prev, u - margin, h - margin, h + margin, d);
    prev = u + margin;
    for (let j = 0; j < n; j++) {
      const direction = (i) => {
        const t = (2 * Math.PI * i) / n + (n === 4 ? Math.PI / 4 : 0);
        return [Math.cos(t), Math.sin(t)];
      };
      const point = ([x, y], outer, z) => {
        const w = outer ? margin / Math.max(Math.abs(x), Math.abs(y)) : r;
        return chutePoint(u + x * w, h + y * w, z);
      };
      const a = direction(j),
        b = direction(j + 1),
        A = point(a, true, 0),
        B = point(b, true, 0),
        C = point(b, false, 0),
        D = point(a, false, 0);
      const E = point(a, false, -2.75),
        F = point(b, false, -2.75);
      q(out, 'wall', A, B, C, D, [0, 1, 1], [0.375, 0.369, 0.346]);
      q(out, 'dark', D, C, F, E, [0, 0, 1]);
      if (d > 0) polygon(out, 'dark', [chutePoint(u, h, -2.75), E, F], [0, 0, 1]);
    }
    if (d === 0) {
      const P = (sx, sy) => chutePoint(u + sx * r * Math.SQRT1_2, h + sy * r * Math.SQRT1_2, -2.75);
      q(out, 'dark', P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 0, 1]);
    }
  }
  spillBand(out, prev, b, h - margin, h + margin, d);
}
function spillwayWorks(out, d) {
  let h = chute[0][0];
  for (const row of outlets) {
    const m = row.radius * 1.43;
    spillBand(out, a, b, h, row.elevation - m, d);
    outletRow(out, d, row);
    h = row.elevation + m;
  }
  spillBand(out, a, b, h, spillway.sill, d);
  box(out, 'wall', a, b, foundation, 181.5, -29, 142);
  q(
    out,
    'wall',
    p(a, 181.5, -29),
    p(b, 181.5, -29),
    p(b, spillway.sill, -5.5),
    p(a, spillway.sill, -5.5),
    [0, 0, -1],
  );
  for (const [x, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const P = (h, o) => chutePoint(x, h, o);
    const [l, k] = [181.5, spillway.sill];
    const rows = d === 0 ? chute.filter((_, i) => i % 2 === 0 || i === chute.length - 1) : chute;
    for (let i = 1; i < rows.length; i++) {
      const [h] = rows[i - 1],
        [H] = rows[i];
      q(out, 'trim', P(h, 1.7), P(H, 1.7), P(H, -2), P(h, -2), [0, 1, 1]);
      q(out, 'wall', P(h, 1.7), P(h, -1), P(H, -1), P(H, 1.7), [sign, 0, 0]);
    }
    box(out, 'trim', x - 3.5, x + 3.5, k, top + 12.5, crown(x) - 4.9, crown(x) + 5.8);
    if (d > 1)
      box(out, 'dark', x - 1.3, x + 1.3, top + 5.1, top + 8.6, crown(x) + 5.81, crown(x) + 5.99);
  }
  for (const x of [34.95, 73.05])
    box(out, 'trim', x - 1.25, x + 1.25, spillway.sill, top, crown(x) - 4.6, crown(x) + 8.35);
  for (const x of spillway.gateCenters) {
    const w = spillway.clearWidth / 2,
      z = crown(x);
    const rows = [
      [spillway.sill, -4.8],
      [spillway.sill + 2.1, -1.55],
      [spillway.sill + 5, 1.1],
      [spillway.sill + spillway.height, 2.3],
    ];
    for (let i = 1; i < rows.length; i++) {
      const [h, j] = rows[i - 1],
        [k, l] = rows[i];
      q(
        out,
        'steel',
        p(x - w, h, z + j),
        p(x + w, h, z + j),
        p(x + w, k, z + l),
        p(x - w, k, z + l),
        [0, 0, 1],
      );
      q(
        out,
        'steel',
        p(x + w, h, z + j - 0.38),
        p(x - w, h, z + j - 0.38),
        p(x - w, k, z + l - 0.38),
        p(x + w, k, z + l - 0.38),
        [0, 0, -1],
      );
      if (d > 1)
        rod(
          out,
          'steel',
          p(x - w + 0.4, k, z + l + 0.18),
          p(x + w - 0.4, k, z + l + 0.18),
          0.19,
          0.28,
        );
    }
  }
  if (d > 0)
    for (const x of [34.95, 73.05])
      for (let j = 1; j < chute.length; j++) {
        const [h] = chute[j - 1],
          [k] = chute[j];
        rod(out, 'trim', chutePoint(x, h, 0.4), chutePoint(x, k, 0.4), 0.5, 0.62);
      }
}
function pressurePipe(out, d, { line, radius }) {
  const segments = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 10 : 14;
  const rows = d === 0 ? [line[0], line[2], line[4], line[5]] : line;
  const ring = (p, i, step = 0) => {
    const t = (i * 2 * Math.PI) / segments,
      r = radius + step;
    return [p[0] + Math.cos(t) * r, p[1] - datum + Math.sin(t) * r, p[2]];
  };
  for (let i = 1; i < rows.length; i++)
    for (let j = 0; j < segments; j++) {
      const u = rows[i - 1],
        v = rows[i],
        n = [
          Math.cos(((j + 0.5) * 2 * Math.PI) / segments),
          Math.sin(((j + 0.5) * 2 * Math.PI) / segments),
          0,
        ];
      q(out, 'steel', ring(u, j), ring(u, j + 1), ring(v, j + 1), ring(v, j), n);
      if (d > 2 && i < rows.length - 1) {
        q(
          out,
          'dark',
          ring(v, j, 0.11),
          ring(v, j + 1, 0.11),
          ring([v[0], v[1], v[2] + 0.22], j + 1, 0.11),
          ring([v[0], v[1], v[2] + 0.22], j, 0.11),
          n,
        );
      }
    }
  if (d > 1)
    for (const [x, h, z] of rows.slice(1, -1))
      box(out, 'trim', x - 3.3, x + 3.3, h - 5, h - 2, z - 0.95, z + 0.95);
}
function station(out, d) {
  const { outline, triangles, floor, eaves } = powerhouse,
    P = ([x, z], h) => p(x, h, z);
  for (let i = 0; i < outline.length; i++) {
    const u = outline[i],
      v = outline[(i + 1) % outline.length],
      n = [v[1] - u[1], 0, u[0] - v[0]],
      len = Math.hypot(n[0], n[2]);
    const tint = i === 0 ? [0.59, 0.574, 0.517] : palette.trim.rgb;
    q(out, 'trim', P(u, floor - 9), P(v, floor - 9), P(v, eaves), P(u, eaves), n, tint);
    if (len < 60) continue;
    const N = d === 0 ? 4 : d === 1 ? 10 : 22;
    const W = (t, h, off) =>
      p(lerp(u[0], v[0], t) + (n[0] * off) / len, h, lerp(u[1], v[1], t) + (n[2] * off) / len);
    for (let j = 0; j < N; j++) {
      const a = (j + 0.12) / N,
        b = (j + 0.88) / N;
      q(
        out,
        'glass',
        W(a, eaves - 7.7, 0.17),
        W(b, eaves - 7.7, 0.17),
        W(b, eaves - 3.5, 0.17),
        W(a, eaves - 3.5, 0.17),
        n,
      );
      if (d > 2 && i === 2) {
        const t = (j + 0.06) / N;
        rod(out, 'trim', W(t, floor + 1, 0.33), W(t, eaves - 7.8, 0.33), 0.27, 0.48);
      }
    }
  }
  for (let i = 0; i < triangles.length; i += 3) {
    const pts = triangles.slice(i, i + 3).map((j) => P(outline[j], eaves));
    polygon(out, 'roof', pts, [0, 1, 0]);
  }
  if (d > 1) {
    const [u, v] = [outline[2], outline[3]],
      W = (t, h) => p(lerp(u[0], v[0], t) + 1.65, h, lerp(u[1], v[1], t) + 2);
    rod(out, 'trim', W(0, floor + 0.4), W(1, floor + 0.4), 2.35, 0.42);
    for (let j = 0; j < 15; j++) {
      const t = (j + 0.5) / 15;
      rod(out, 'trim', W(t, floor - 2.5), W(t, floor + 0.5), 0.32, 0.34);
      if (d > 3) rod(out, 'steel', W(t, floor + 0.6), W(t, floor + 3), 0.15, 0.15);
    }
  }
}
export function buildDamLevel(out, name) {
  const d = levels[name];
  if (d === undefined) throw Error('Unknown Shasta Dam detail level: ' + name);
  wings(out, d);
  crestRoad(out, d);
  spillwayWorks(out, d);
  for (const pipe of pipes) pressurePipe(out, d, pipe);
  station(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');

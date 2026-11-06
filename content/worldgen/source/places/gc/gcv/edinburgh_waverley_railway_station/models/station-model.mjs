/** Original complete Edinburgh Waverley passenger station; source-authored permanent exterior. */
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('c9c0a8'),
  blind: lin('b4ac95'),
  base: lin('969a95'),
  roof: lin('a1a9a7'),
  metal: lin('aeb9b9'),
  canopy: lin('bdc5c4'),
  glass: lin('869b9f'),
  doorGlass: lin('637d83'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.9 },
  blind: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.76, metallic: 0.16 },
  canopy: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.16 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4 },
  doorGlass: { slot: 'window', graph: 'storefront', roughness: 0.42 },
};
const cfg = {
  skyline: { arch: 2, rib: 120, curve: 3 },
  district: { arch: 4, rib: 50, curve: 6, detail: true },
  street: { arch: 6, rib: 14, curve: 10, detail: true, recess: true, fine: true },
  closeup: { arch: 10, rib: 4, curve: 20, detail: true, recess: true, fine: true, near: true },
  master: {
    arch: 28,
    rib: 1.4,
    curve: 64,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const stationPlans = [
  [
    [-72.3, -56.5],
    [-58, -56.5],
    [-58, -30.2],
    [-72.3, -30.2],
    [-72.3, -56.5],
  ],
  [
    [-72.3, 30],
    [-58, 30],
    [-58, 56],
    [-72.3, 56],
    [-72.3, 30],
  ],
  [
    [34.31841, 12.66791],
    [36.928536, 11.994565],
    [56.488716, 9.539661],
    [58.541087, 10.273634],
    [59.801286, 12.004286],
    [60.240212, 14.203775],
    [60.078139, 16.065782],
    [58.933529, 18.352572],
    [57.129721, 19.246189],
    [55.546185, 19.333489],
    [34.62355, 19.163324],
    [34.31841, 12.66791],
  ],
  [
    [36.907527, -7.593873],
    [36.999674, -17.446666],
    [57.849142, -17.643037],
    [58.889878, -17.01213],
    [60.00377, -16.014644],
    [60.662971, -14.62148],
    [60.383691, -12.964801],
    [59.620621, -11.440285],
    [57.77276, -10.385414],
    [36.907527, -7.593873],
  ],
  [
    [78.690899, -34.304691],
    [78.721608, -37.588932],
    [132.062202, -38.093888],
    [132.031496, -34.809658],
    [78.690899, -34.304691],
  ],
  [
    [79.172277, -28.454403],
    [149.98995, -28.863923],
    [150.203436, 21.103872],
    [79.385707, 21.513597],
    [79.172277, -28.454403],
  ],
  [
    [175.238867, 3.681529],
    [175.668478, -6.772202],
    [182.354242, -6.505426],
    [182.768091, -14.363994],
    [207.927608, -13.209585],
    [207.289472, 4.985481],
    [175.238867, 3.681529],
  ],
  [
    [190, 42],
    [220, 42],
    [220, 56],
    [190, 56],
    [190, 42],
  ],
  [
    [220.742186, -13.174763],
    [223.636388, -26.940927],
    [294.56916597790644, -12.053159497768881],
    [300.018692, -10.926773],
    [297.168548, 2.678116],
    [275.8914189376492, -1.766756923272386],
    [220.742186, -13.174763],
  ],
  [
    [228, 50],
    [233, 50],
    [233, 34],
    [238, 34],
    [238, 50],
    [248, 50],
    [248, 34],
    [253, 34],
    [253, 50],
    [260, 50],
    [260, 62],
    [228, 62],
    [228, 50],
  ],
];
export const nativePlans = {
  803: [
    [-72.42845, 29.777368],
    [16.848969, 29.038026],
    [16.663478, 17.029705],
    [-54.770243, 17.791194],
    [-55.033296, -18.673477],
    [17.412019, -19.331747],
    [17.563169, -30.034893],
    [-72.153901, -29.589288],
    [-71.96638, -56.919083],
    [133.565636, -56.91895],
    [188.12395, -59.343955],
    [188.487337, -51.793025],
    [195.45157, -51.276865],
    [204.145648, -50.114844],
    [217.765738, -47.953704],
    [233.467304, -44.530761],
    [252.995141, -39.889248],
    [266.424066, -36.393976],
    [301.168082, -24.649645],
    [301.1403662108442, -24.548190303055136],
    [304.789036, -23.31387],
    [304.242428, 56.07964],
    [279.10430337714973, 56.11565311419353],
    [279.097043, 56.14223],
    [266.7506125144554, 56.13335112812354],
    [256.913408, 56.147444],
    [256.91918941486244, 56.126280910851705],
    [80.016148, 55.999062],
    [-72.39583, 56.301327],
    [-72.42845, 29.777368],
  ],
  856: [
    [36.907527, -7.593873],
    [36.999674, -17.446666],
    [57.849142, -17.643037],
    [58.889878, -17.01213],
    [60.00377, -16.014644],
    [60.662971, -14.62148],
    [60.383691, -12.964801],
    [59.620621, -11.440285],
    [57.77276, -10.385414],
    [36.907527, -7.593873],
  ],
  857: [
    [34.31841, 12.66791],
    [36.928536, 11.994565],
    [56.488716, 9.539661],
    [58.541087, 10.273634],
    [59.801286, 12.004286],
    [60.240212, 14.203775],
    [60.078139, 16.065782],
    [58.933529, 18.352572],
    [57.129721, 19.246189],
    [55.546185, 19.333489],
    [34.62355, 19.163324],
    [34.31841, 12.66791],
  ],
  942: [
    [79.172277, -28.454403],
    [149.98995, -28.863923],
    [150.203436, 21.103872],
    [79.385707, 21.513597],
    [79.172277, -28.454403],
  ],
  1284: [
    [220.742186, -13.174763],
    [223.636388, -26.940927],
    [294.56916597790644, -12.053159497768881],
    [300.018692, -10.926773],
    [297.168548, 2.678116],
    [275.8914189376492, -1.766756923272386],
    [220.742186, -13.174763],
  ],
  1285: [
    [175.238867, 3.681529],
    [175.668478, -6.772202],
    [182.354242, -6.505426],
    [182.768091, -14.363994],
    [207.927608, -13.209585],
    [207.289472, 4.985481],
    [175.238867, 3.681529],
  ],
  1334: [
    [78.690899, -34.304691],
    [78.721608, -37.588932],
    [132.062202, -38.093888],
    [132.031496, -34.809658],
    [78.690899, -34.304691],
  ],
  1560: [
    [-72.42845, 29.777368],
    [16.848969, 29.038026],
    [16.663478, 17.029705],
    [-54.770243, 17.791194],
    [-55.033296, -18.673477],
    [17.412019, -19.331747],
    [17.563169, -30.034893],
    [-72.153901, -29.589288],
    [-71.96638, -56.919083],
    [133.565636, -56.91895],
    [188.12395, -59.343955],
    [188.487337, -51.793025],
    [195.45157, -51.276865],
    [204.145648, -50.114844],
    [217.765738, -47.953704],
    [233.467304, -44.530761],
    [252.995141, -39.889248],
    [266.424066, -36.393976],
    [301.168082, -24.649645],
    [301.1403662108442, -24.548190303055136],
    [304.789036, -23.31387],
    [304.242428, 56.07964],
    [279.10430337714973, 56.11565311419353],
    [279.097043, 56.14223],
    [266.7506125144554, 56.13335112812354],
    [256.913408, 56.147444],
    [256.91918941486244, 56.126280910851705],
    [80.016148, 55.999062],
    [-72.39583, 56.301327],
    [-72.42845, 29.777368],
  ],
};
export const controls = {
  roof: [
    [
      [
        [-72.42845, 29.777368],
        [16.848969, 29.038026],
        [16.663478, 17.029705],
        [-54.770243, 17.791194],
        [-55.033296, -18.673477],
        [17.412019, -19.331747],
        [17.563169, -30.034893],
        [-72.153901, -29.589288],
        [-71.96638, -56.919083],
        [133.565636, -56.91895],
        [188.12395, -59.343955],
        [188.487337, -51.793025],
        [195.45157, -51.276865],
        [204.145648, -50.114844],
        [217.765738, -47.953704],
        [233.467304, -44.530761],
        [252.995141, -39.889248],
        [266.424066, -36.393976],
        [301.168082, -24.649645],
        [301.1403662108442, -24.548190303055136],
        [304.789036, -23.31387],
        [304.242428, 56.07964],
        [279.10430337714973, 56.11565311419353],
        [279.097043, 56.14223],
        [266.7506125144554, 56.13335112812354],
        [260, 56.14302211921802],
        [260, 50],
        [253, 50],
        [253, 34],
        [248, 34],
        [248, 50],
        [238, 50],
        [238, 34],
        [233, 34],
        [233, 50],
        [228, 50],
        [228, 56.105483824771966],
        [80.016148, 55.999062],
        [-72.39583, 56.301327],
        [-72.42845, 29.777368],
      ],
      [
        [79.172277, -28.454403],
        [79.385707, 21.513597],
        [150.203436, 21.103872],
        [149.98995, -28.863923],
        [79.172277, -28.454403],
      ],
      [
        [190, 42],
        [190, 56],
        [220, 56],
        [220, 42],
        [190, 42],
      ],
    ],
  ],
  slopes: [
    {
      polygon: [
        [
          [-72.04816174637764, -45],
          [-71.96638, -56.919083],
          [133.565636, -56.91895],
          [188.12395, -59.343955],
          [188.487337, -51.793025],
          [195.45157, -51.276865],
          [204.145648, -50.114844],
          [217.765738, -47.953704],
          [231.31483253662068, -45],
          [-72.04816174637764, -45],
        ],
      ],
      lo: -60,
      hi: -30,
      mid: -45,
      ridge: 13.5,
    },
    {
      polygon: [
        [
          [-72.15108293550475, -30],
          [-72.04816174637764, -45],
          [231.31483253662068, -45],
          [233.467304, -44.530761],
          [252.995141, -39.889248],
          [266.424066, -36.393976],
          [285.33977984079826, -30],
          [17.562676240492653, -30],
          [17.563169, -30.034893],
          [10.537893871781023, -30],
          [-72.15108293550475, -30],
        ],
      ],
      lo: -60,
      hi: -30,
      mid: -45,
      ridge: 13.5,
    },
    {
      polygon: [
        [
          [-72.153901, -29.589288],
          [-72.15108293550475, -30],
          [10.537893871781023, -30],
          [-72.153901, -29.589288],
        ],
      ],
      lo: -30,
      hi: -6,
      mid: -18,
      ridge: 13,
    },
    {
      polygon: [
        [
          [-55.033296, -18.673477],
          [17.412019, -19.331747],
          [17.562676240492653, -30],
          [285.33977984079826, -30],
          [301.168082, -24.649645],
          [301.1403662108442, -24.548190303055136],
          [304.789036, -23.31387],
          [304.75245109711614, -18],
          [150.03636580573203, -18],
          [149.98995, -28.863923],
          [79.172277, -28.454403],
          [79.21693124336154, -18],
          [-55.0284375948527, -18],
          [-55.033296, -18.673477],
        ],
      ],
      lo: -30,
      hi: -6,
      mid: -18,
      ridge: 13,
    },
    {
      polygon: [
        [
          [-55.0284375948527, -18],
          [79.21693124336154, -18],
          [79.268187247204, -6],
          [-54.94187062706078, -6],
          [-55.0284375948527, -18],
        ],
      ],
      lo: -30,
      hi: -6,
      mid: -18,
      ridge: 13,
    },
    {
      polygon: [
        [
          [150.03636580573203, -18],
          [304.75245109711614, -18],
          [304.66983356326483, -6],
          [150.08763546852182, -6],
          [150.03636580573203, -18],
        ],
      ],
      lo: -30,
      hi: -6,
      mid: -18,
      ridge: 13,
    },
    {
      polygon: [
        [
          [-54.94187062706078, -6],
          [79.26818724720401, -6],
          [79.3173075842197, 5.5],
          [-54.85891061626019, 5.5],
          [-54.94187062706078, -6],
        ],
      ],
      lo: -6,
      hi: 17,
      mid: 5.5,
      ridge: 13,
    },
    {
      polygon: [
        [
          [150.08763546852182, -6],
          [304.66983356326483, -6],
          [304.5906584266573, 5.5],
          [150.13676889536205, 5.5],
          [150.08763546852182, -6],
        ],
      ],
      lo: -6,
      hi: 17,
      mid: 5.5,
      ridge: 13,
    },
    {
      polygon: [
        [
          [-54.85891061626019, 5.5],
          [79.31730758421969, 5.5],
          [79.36642792123538, 17],
          [-54.7759506054596, 17],
          [-54.85891061626019, 5.5],
        ],
      ],
      lo: -6,
      hi: 17,
      mid: 5.5,
      ridge: 13,
    },
    {
      polygon: [
        [
          [150.13676889536208, 5.5],
          [304.5906584266573, 5.5],
          [304.5114832900498, 17],
          [150.1859023222023, 17],
          [150.13676889536208, 5.5],
        ],
      ],
      lo: -6,
      hi: 17,
      mid: 5.5,
      ridge: 13,
    },
    {
      polygon: [
        [
          [-54.7759506054596, 17],
          [79.36642792123538, 17],
          [79.385707, 21.513597],
          [150.203436, 21.103872],
          [150.1859023222023, 17],
          [304.5114832900498, 17],
          [304.4701745231241, 23],
          [16.755700383949016, 23],
          [16.663478, 17.029705],
          [-54.770243, 17.791194],
          [-54.7759506054596, 17],
        ],
      ],
      lo: 17,
      hi: 29,
      mid: 23,
      ridge: 11.5,
    },
    {
      polygon: [
        [
          [16.755700383949016, 23],
          [304.4701745231242, 23],
          [304.4288657561985, 29],
          [16.848381617237166, 29],
          [16.755700383949016, 23],
        ],
      ],
      lo: 17,
      hi: 29,
      mid: 23,
      ridge: 11.5,
    },
    {
      polygon: [
        [
          [-72.42845, 29.777368],
          [16.848969, 29.038026],
          [16.848381617237166, 29],
          [304.42886575619843, 29],
          [304.3324786333719, 43],
          [253, 43],
          [253, 34],
          [248, 34],
          [248, 43],
          [238, 43],
          [238, 34],
          [233, 34],
          [233, 43],
          [220, 43],
          [220, 42],
          [190, 42],
          [190, 43],
          [-72.41218839079453, 43],
          [-72.42845, 29.777368],
        ],
      ],
      lo: 29,
      hi: 57,
      mid: 43,
      ridge: 13.5,
    },
    {
      polygon: [
        [
          [-72.41218839079453, 43],
          [190, 43],
          [190, 56],
          [220, 56],
          [220, 43],
          [233, 43],
          [233, 50],
          [228, 50],
          [228, 56.105483824771966],
          [80.016148, 55.999062],
          [-72.39583, 56.301327],
          [-72.41218839079453, 43],
        ],
      ],
      lo: 29,
      hi: 57,
      mid: 43,
      ridge: 13.5,
    },
    {
      polygon: [
        [
          [238, 43],
          [248, 43],
          [248, 50],
          [238, 50],
          [238, 43],
        ],
      ],
      lo: 29,
      hi: 57,
      mid: 43,
      ridge: 13.5,
    },
    {
      polygon: [
        [
          [253, 43],
          [304.3324786333719, 43],
          [304.242428, 56.07964],
          [279.10430337714973, 56.11565311419353],
          [279.097043, 56.14223],
          [266.7506125144554, 56.13335112812354],
          [260, 56.14302211921802],
          [260, 50],
          [253, 50],
          [253, 43],
        ],
      ],
      lo: 29,
      hi: 57,
      mid: 43,
      ridge: 13.5,
    },
  ],
  bays: [
    [-60, -30, 13.5],
    [-30, -6, 13],
    [-6, 17, 13],
    [17, 29, 11.5],
    [29, 57, 13.5],
  ],
  ranges: {
    856: [
      [
        [
          [36.907527, -7.593873],
          [36.999674, -17.446666],
          [57.849142, -17.643037],
          [58.889878, -17.01213],
          [60.00377, -16.014644],
          [60.662971, -14.62148],
          [60.383691, -12.964801],
          [59.620621, -11.440285],
          [57.77276, -10.385414],
          [36.907527, -7.593873],
        ],
      ],
    ],
    857: [
      [
        [
          [34.31841, 12.66791],
          [36.928536, 11.994565],
          [56.488716, 9.539661],
          [58.541087, 10.273634],
          [59.801286, 12.004286],
          [60.240212, 14.203775],
          [60.078139, 16.065782],
          [58.933529, 18.352572],
          [57.129721, 19.246189],
          [55.546185, 19.333489],
          [34.62355, 19.163324],
          [34.31841, 12.66791],
        ],
      ],
    ],
    942: [
      [
        [
          [79.172277, -28.454403],
          [149.98995, -28.863923],
          [150.203436, 21.103872],
          [79.385707, 21.513597],
          [79.172277, -28.454403],
        ],
      ],
    ],
    1284: [
      [
        [
          [220.742186, -13.174763],
          [223.636388, -26.940927],
          [294.56916597790644, -12.053159497768881],
          [300.018692, -10.926773],
          [297.168548, 2.678116],
          [275.8914189376492, -1.766756923272386],
          [220.742186, -13.174763],
        ],
      ],
    ],
    1285: [
      [
        [
          [175.238867, 3.681529],
          [175.668478, -6.772202],
          [182.354242, -6.505426],
          [182.768091, -14.363994],
          [207.927608, -13.209585],
          [207.289472, 4.985481],
          [175.238867, 3.681529],
        ],
      ],
    ],
    1334: [
      [
        [
          [78.690899, -34.304691],
          [78.721608, -37.588932],
          [132.062202, -38.093888],
          [132.031496, -34.809658],
          [78.690899, -34.304691],
        ],
      ],
    ],
  },
  west: [
    [
      [
        [-72.3, -56.5],
        [-58, -56.5],
        [-58, -30.2],
        [-72.3, -30.2],
        [-72.3, -56.5],
      ],
    ],
    [
      [
        [-72.3, 30],
        [-58, 30],
        [-58, 56],
        [-72.3, 56],
        [-72.3, 30],
      ],
    ],
  ],
  office: [
    [
      [
        [190, 42],
        [220, 42],
        [220, 56],
        [190, 56],
        [190, 42],
      ],
    ],
  ],
  pavilion: [
    [
      [
        [228, 50],
        [260, 50],
        [260, 62],
        [228, 62],
        [228, 50],
      ],
    ],
  ],
  stairPlans: [
    [
      [
        [233, 34],
        [238, 34],
        [238, 50],
        [233, 50],
        [233, 34],
      ],
    ],
    [
      [
        [248, 34],
        [253, 34],
        [253, 50],
        [248, 50],
        [248, 34],
      ],
    ],
  ],
  westStairs: [
    [
      [
        [-58, -46],
        [-38, -46],
        [-38, -41],
        [-58, -41],
        [-58, -46],
      ],
    ],
    [
      [
        [-58, 41],
        [-38, 41],
        [-38, 46],
        [-58, 46],
        [-58, 41],
      ],
    ],
  ],
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
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'stone', col = C[s]) {
  for (const [p, N] of [
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
const adapter = (o, c) => ({
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
const rect = (u, y, w, h) => [
  [u - w / 2, y],
  [u + w / 2, y],
  [u + w / 2, y + h],
  [u - w / 2, y + h],
];
const openRing = (r) =>
  r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.00001
    ? r.slice(0, -1)
    : r;
function wall(o, c, p, L, lo, hi, holes = [], surface = 'stone') {
  const outer = rect(L / 2, lo, L, hi - lo),
    active = c.recess ? holes : [],
    flat = [...outer, ...active.flatMap((h) => h.ring)],
    starts = active.map(
      (h, i) => outer.length + active.slice(0, i).reduce((n, h) => n + h.ring.length, 0),
    ),
    ids = earcut(flat.flat(), starts),
    N = sub(p([0, 0, 1]), p([0, 0, 0]));
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      surface,
      C[surface],
      N,
    );
  for (const h of holes) {
    const depth = c.recess ? 0.2 : -0.02,
      r = h.ring,
      frameSurface = h.kind === 'blind' ? 'stone' : 'metal';
    if (c.recess)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        Q(
          o,
          c,
          [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])],
          frameSurface,
          C[frameSurface],
        );
      }
    const ix = earcut(r.flat());
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        c,
        ix.slice(i, i + 3).map((j) => p([...r[j], -depth])),
        h.kind,
        C[h.kind],
        N,
      );
    if (c.near)
      beamPath(
        adapter(o, c),
        frameSurface,
        r.map(([u, y]) => p([u, y, 0.035])),
        c.near ? 0.09 : 0.065,
        0.12,
        C[frameSurface],
        true,
      );
    if (c.near) {
      const xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]),
        u = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys);
      if (hi - lo > 5)
        beam(
          adapter(o, c),
          frameSurface,
          p([Math.min(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          p([Math.max(...xs), lo + (hi - lo) * 0.5, -depth + 0.04]),
          0.065,
          0.075,
          C[frameSurface],
        );
      if (h.kind === 'doorGlass')
        beam(
          adapter(o, c),
          frameSurface,
          p([u, lo, -depth + 0.04]),
          p([u, hi, -depth + 0.04]),
          0.08,
          0.09,
          C[frameSurface],
        );
    }
  }
}
function edge(ring, i) {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    N = [U[1], 0, -U[0]],
    p = ([u, y, d]) => [b[0] - U[0] * u + N[0] * d, y, b[1] - U[1] * u + N[2] * d];
  return { a, b, L, N, p };
}
function slab(o, c, ring, y0, y1, s = 'base') {
  ring = openRing(ring);
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3) {
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y1, ring[j][1]]),
      s,
      C[s],
      [0, 1, 0],
    );
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y0, ring[j][1]]),
      s,
      C[s],
      [0, -1, 0],
    );
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      c,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      s,
      C[s],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function outlineBeam(o, c, ring, y, width = 0.12, s = 'metal') {
  if (c.detail)
    beamPath(
      adapter(o, c),
      s,
      openRing(ring).map(([x, z]) => [x, y, z]),
      width,
      width,
      C[s],
      true,
    );
}
const FLOOR = 0.65,
  UPPER = 7.5,
  FOOT = -6;
function simplify(r, t = 0.35) {
  r = openRing(r).map((p) => [...p]);
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d && Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / d < t) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function arch(u, y, w, straight, rise, n) {
  const r = [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + straight],
  ];
  for (let j = 1; j <= n; j++) {
    const a = (j / n) * Math.PI;
    r.push([u + (w / 2) * Math.cos(a), y + straight + rise * Math.sin(a)]);
  }
  return r;
}
function band(o, c, e, y, h = 0.17, s = 'stone') {
  Q(
    o,
    c,
    [e.p([0, y, 0.08]), e.p([e.L, y, 0.08]), e.p([e.L, y + h, 0.08]), e.p([0, y + h, 0.08])],
    s,
    C[s],
    e.N,
  );
}
function range(o, c, ring, top, floor = FLOOR, doors = false) {
  const r = c === cfg.skyline ? simplify(ring, 0.7) : openRing(ring);
  slab(o, c, r, FOOT, floor, 'base');
  for (let i = 0; i < r.length; i++) {
    const e = edge(r, i),
      holes = [];
    if (e.L > 4) {
      const n = c.detail ? Math.max(1, Math.floor(e.L / (c.near ? 4.7 : c.fine ? 10 : 20))) : 1,
        w = e.L / n,
        rows = top - floor > 10 && c.detail ? 2 : 1;
      for (let j = 0; j < n; j++)
        for (let row = 0; row < rows; row++) {
          const y = floor + 1.45 + row * 4.8,
            ww = c.detail ? Math.min(2.65, w - 0.8) : e.L * 0.7,
            h = Math.min(3.5, top - y - 0.7);
          if (h > 0.5) holes.push({ ring: rect((j + 0.5) * w, y, ww, h), kind: 'glass' });
        }
      if (doors && c.detail) {
        const u = e.L / 2;
        for (let j = holes.length - 1; j >= 0; j--)
          if (
            Math.abs(holes[j].ring[0][0] + (holes[j].ring[1][0] - holes[j].ring[0][0]) / 2 - u) <
            3.3
          )
            holes.splice(j, 1);
        holes.push({ ring: rect(u, floor, 3.3, 3.5), kind: 'doorGlass' });
      }
    }
    wall(o, c, e.p, e.L, floor, top - 0.3, holes);
    if (c.fine) for (const y of [floor + 0.3, top - 0.5]) band(o, c, e, y);
  }
  slab(o, c, r, top - 0.3, top, 'roof');
  if (c.fine) outlineBeam(o, c, r, top + 0.06, 0.18, 'stone');
}
function ranges(o, c) {
  const tops = { 856: 5.5, 857: 5.5, 942: 8, 1284: 6, 1285: 8, 1334: 5 };
  for (const [i, polys] of Object.entries(controls.ranges))
    for (const p of polys) range(o, c, p[0], tops[i], FLOOR, i === '942');
  // Original low clerestory rooflight on the booking hall, below the main sheds.
  const x0 = 96,
    x1 = 133,
    z0 = -17,
    z1 = 10,
    y0 = 8.05,
    y1 = 10.2;
  const base = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    top = [
      [x0 + 4, y1, z0 + 4],
      [x1 - 4, y1, z0 + 4],
      [x1 - 4, y1, z1 - 4],
      [x0 + 4, y1, z1 - 4],
    ];
  for (let i = 0; i < 4; i++)
    Q(o, c, [base[i], base[(i + 1) % 4], top[(i + 1) % 4], top[i]], 'glass', C.glass, [0, 1, 0]);
  Q(o, c, top, 'canopy', C.canopy, [0, 1, 0]);
  if (c.fine) {
    for (let x = x0 + 5; x < x1 - 3; x += c.near ? 3 : 9)
      beam(adapter(o, c), 'metal', [x, y0, z0], [x, y1, z0 + 4], 0.09, 0.11, C.metal);
  }
}
function heightAt(s, z) {
  return 9.5 + (s.ridge - 9.5) * (1 - Math.abs(z - s.mid) / ((s.hi - s.lo) / 2));
}
function slopedPanel(o, c, s) {
  const rings = s.polygon.map((r) => (c === cfg.skyline ? simplify(r, 0.5) : openRing(r))),
    flat = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(flat.flat(), holes);
  for (let i = 0; i < ix.length; i += 3) {
    const ps = ix.slice(i, i + 3).map((j) => [flat[j][0], heightAt(s, flat[j][1]), flat[j][1]]);
    T(o, c, ps, 'glass', C.glass, [0, 1, 0]);
    T(
      o,
      c,
      ps.map((p) => [p[0], p[1] - 0.14, p[2]]),
      'glass',
      C.glass,
      [0, -1, 0],
    );
  }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [a[0], heightAt(s, a[1]), a[1]],
        q = [b[0], heightAt(s, b[1]), b[1]];
      if (
        c === cfg.skyline &&
        Math.abs(a[1] - b[1]) < 0.0001 &&
        inside((a[0] + b[0]) / 2, a[1] - 0.01) &&
        inside((a[0] + b[0]) / 2, a[1] + 0.01)
      )
        continue;
      Q(o, c, [p, q, [q[0], q[1] - 0.14, q[2]], [p[0], p[1] - 0.14, p[2]]], 'canopy', C.canopy, [
        b[1] - a[1],
        0,
        a[0] - b[0],
      ]);
    }
}
function inside(x, z) {
  let ok = false;
  for (const poly of controls.roof) {
    let inP = false;
    for (let j = 0; j < poly.length; j++) {
      let yes = false;
      const r = openRing(poly[j]);
      for (let i = 0, k = r.length - 1; i < r.length; k = i++)
        if (
          r[i][1] > z !== r[k][1] > z &&
          x < ((r[k][0] - r[i][0]) * (z - r[i][1])) / (r[k][1] - r[i][1]) + r[i][0]
        )
          yes = !yes;
      if (j === 0) inP = yes;
      else if (yes) inP = false;
    }
    if (inP) ok = true;
  }
  return ok;
}
function shedRoofs(o, c) {
  for (const s of controls.slopes) slopedPanel(o, c, s);
  for (const [lo, hi, ridge] of controls.bays) {
    const mid = (lo + hi) / 2;
    // Closed, finite straight roof slopes; spacing changes actual ribs rather than
    // subdividing otherwise collinear roof triangles.
    if (c.detail)
      for (let x = -70; x < 304; x += c.rib) {
        for (const [a, b] of [
          [lo, mid],
          [mid, hi],
        ]) {
          const aa = a + 0.18,
            bb = b - 0.18;
          if (inside(x, (aa + bb) / 2) && inside(x, aa) && inside(x, bb)) {
            const s = { lo, hi, mid, ridge };
            beam(
              adapter(o, c),
              'metal',
              [x, heightAt(s, aa) + 0.035, aa],
              [x, heightAt(s, bb) + 0.035, bb],
              c.near ? 0.075 : 0.16,
              0.13,
              C.metal,
            );
          }
        }
      }
    if (c.detail) {
      for (const z of [lo + 0.3, hi - 0.3]) {
        let start = null;
        for (let x = -71; x <= 305; x += 2) {
          const valid = inside(x, z);
          if (valid && start === null) start = x;
          if ((!valid || x === 305) && start !== null) {
            if (x - start > 2)
              beam(adapter(o, c), 'metal', [start, 9.4, z], [x - 2, 9.4, z], 0.18, 0.2, C.metal);
            start = null;
          }
        }
      }
    }
    const spacing = c.near ? 18 : c.fine ? 38 : c.detail ? 65 : 350;
    if (c.detail)
      for (let x = -60; x < 302; x += spacing)
        for (const z of [lo + 0.7, hi - 0.7])
          if (inside(x, z)) box(o, c, x - 0.17, x + 0.17, FOOT, 9.5, z - 0.17, z + 0.17, 'metal');
  }
}
function stair(o, c, { x0, x1, z0, z1, axis = 'z', closedBase = false }) {
  const steps = c.near ? 40 : c.fine ? 20 : c.detail ? 10 : 3,
    point = (t, u, y) => (axis === 'z' ? [u, y, z0 + (z1 - z0) * t] : [x1 - (x1 - x0) * t, y, u]);
  const width = axis === 'z' ? [x0, x1] : [z0, z1];
  if (!c.detail) {
    const ps = [
        point(0, width[0], FLOOR),
        point(1, width[0], UPPER),
        point(1, width[1], UPPER),
        point(0, width[1], FLOOR),
      ],
      bs = ps.map((p) => [p[0], closedBase ? FOOT : p[1] - 0.25, p[2]]);
    Q(o, c, ps, 'stone', C.stone, [0, 1, 0]);
    Q(o, c, bs, 'stone', C.stone, [0, -1, 0]);
    for (let i = 0; i < 4; i++) {
      const a = ps[i],
        b = ps[(i + 1) % 4];
      Q(o, c, [a, b, bs[(i + 1) % 4], bs[i]], 'stone', C.stone, [b[2] - a[2], 0, a[0] - b[0]]);
    }
    return;
  }
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      y = FLOOR + ((UPPER - FLOOR) * (j + 1)) / steps,
      a = point(t, width[0], y),
      b = point((j + 1) / steps, width[1], y);
    box(
      o,
      c,
      Math.min(a[0], b[0]),
      Math.max(a[0], b[0]),
      closedBase ? FOOT : y - 0.18,
      y,
      Math.min(a[2], b[2]),
      Math.max(a[2], b[2]),
      'stone',
    );
  }
  for (const u of width) {
    beam(
      adapter(o, c),
      'metal',
      point(0, u, FLOOR - 0.25),
      point(1, u, UPPER - 0.25),
      0.2,
      0.3,
      C.metal,
    );
    beam(
      adapter(o, c),
      'metal',
      point(0, u, FLOOR + 1),
      point(1, u, UPPER + 1),
      0.07,
      0.08,
      C.metal,
    );
    if (c.fine)
      for (let j = 0; j <= 6; j++) {
        const t = j / 6,
          y = FLOOR + (UPPER - FLOOR) * t;
        beam(adapter(o, c), 'metal', point(t, u, y), point(t, u, y + 1), 0.055, 0.065, C.metal);
      }
  }
}
function westEntrances(o, c) {
  for (let j = 0; j < controls.west.length; j++) {
    const r = openRing(controls.west[j][0]),
      zs = r.map((p) => p[1]),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      x0 = -72.3,
      x1 = -58;
    slab(o, c, r, FOOT, UPPER, 'base');
    for (let i = 0; i < r.length; i++) {
      const e = edge(r, i),
        holes = [],
        n = c.detail ? Math.max(1, Math.floor(e.L / 5.2)) : 1;
      for (let k = 0; k < n; k++) {
        const u = ((k + 0.5) * e.L) / n;
        holes.push({
          ring: arch(u, UPPER, Math.min(3.7, e.L / n - 0.65), 2.8, 1.35, c.arch),
          kind: 'doorGlass',
        });
      }
      wall(o, c, e.p, e.L, UPPER, 13.1, holes);
      if (c.detail) {
        band(o, c, e, 12.2, 0.25);
        band(o, c, e, 12.65, 0.2);
      }
    }
    slab(o, c, r, 12.85, 13.1, 'roof');
    if (c.fine)
      for (const z of [z0 + 0.7, z1 - 0.7])
        box(o, c, x0 - 0.15, x0 + 0.45, UPPER, 13.35, z - 0.35, z + 0.35, 'stone');
    stair(o, c, { x0: -58, x1: -38, z0: j === 0 ? -46 : 41, z1: j === 0 ? -41 : 46, axis: 'x' });
  }
}
function southFrontage(o, c) {
  // Historic stone frontage is a wall, not an invented solid ground-floor plaza.
  for (const [x0, x1] of [
    [24, 190],
    [220, 228],
    [260, 304],
  ]) {
    const z = 56.05,
      p = ([u, y, d]) => [x0 + u, y, z + d],
      L = x1 - x0,
      holes = [];
    const n =
      c === cfg.skyline
        ? Math.max(1, Math.round(L / 90))
        : c.detail
          ? Math.floor(L / (c.near ? 5.2 : c.fine ? 9 : 18))
          : 5;
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * L) / n;
      holes.push({
        ring: arch(u, 7.4, Math.min(c.detail ? 3.8 : 18, L / n - 0.6), 1.2, 1.7, c.arch),
        kind: 'blind',
      });
    }
    wall(o, c, p, L, -3, 11.1, holes);
    Q(
      o,
      c,
      [
        [x0, -3, z - 1],
        [x1, -3, z - 1],
        [x1, 11.1, z - 1],
        [x0, 11.1, z - 1],
      ],
      'stone',
      C.stone,
      [0, 0, -1],
    );
    box(o, c, x0, x1, 10.95, 11.25, z - 1.15, z + 0.18, 'stone');
    if (c.detail) {
      for (let x = x0; x < x1; x += c.near ? 5.2 : 18)
        box(o, c, x - 0.16, x + 0.16, 6.8, 11.3, z - 0.3, z + 0.25, 'stone');
    }
  }
}
function curvedEntry(o, c) {
  for (const p of controls.office) range(o, c, p[0], 20, UPPER, true);
  const ring = controls.pavilion[0][0];
  slab(o, c, ring, FOOT, UPPER, 'base');
  const x0 = 228,
    x1 = 260,
    z0 = 50,
    z1 = 62,
    roofY = (x) => 11.2 + 1.1 * Math.sin(((x - x0) / (x1 - x0)) * Math.PI);
  for (const z of [z0, z1]) {
    const e = { p: ([u, y, d]) => [x0 + u, y, z + (z === z1 ? d : -d)], L: x1 - x0 },
      holes = [],
      n = c.detail ? 8 : 1;
    for (let i = 0; i < n; i++)
      holes.push({
        ring: rect(((i + 0.5) * e.L) / n, UPPER, e.L / n - 0.12, 3.35),
        kind: 'doorGlass',
      });
    wall(o, c, e.p, e.L, UPPER, 11.05, holes, 'metal');
  }
  for (const x of [x0, x1]) {
    Q(
      o,
      c,
      [
        [x, UPPER, z0],
        [x, UPPER, z1],
        [x, 11.2, z1],
        [x, 11.2, z0],
      ],
      'glass',
      C.glass,
      [x === x0 ? -1 : 1, 0, 0],
    );
  }
  for (let j = 0; j < c.curve; j++) {
    const a = x0 + ((x1 - x0) * j) / c.curve,
      b = x0 + ((x1 - x0) * (j + 1)) / c.curve,
      s = j < c.curve * 0.2 || j > c.curve * 0.8 ? 'canopy' : 'glass',
      ps = [
        [a, roofY(a), z0 - 0.35],
        [b, roofY(b), z0 - 0.35],
        [b, roofY(b), z1 + 0.35],
        [a, roofY(a), z1 + 0.35],
      ];
    Q(o, c, ps, s, C[s], [0, 1, 0]);
    Q(
      o,
      c,
      ps.map((p) => [p[0], p[1] - 0.16, p[2]]),
      s,
      C[s],
      [0, -1, 0],
    );
    for (const z of [z0 - 0.35, z1 + 0.35])
      Q(
        o,
        c,
        [
          [a, roofY(a), z],
          [b, roofY(b), z],
          [b, roofY(b) - 0.16, z],
          [a, roofY(a) - 0.16, z],
        ],
        'metal',
        C.metal,
        [0, 0, z < z0 ? -1 : 1],
      );
  }
  if (c.fine)
    for (const z of [z0, z1])
      beamPath(
        adapter(o, c),
        'metal',
        Array.from({ length: c.curve + 1 }, (_, j) => {
          const x = x0 + ((x1 - x0) * j) / c.curve;
          return [x, roofY(x) + 0.035, z];
        }),
        0.1,
        0.12,
        C.metal,
        false,
      );
  for (const [x, z] of [
    [234, 55],
    [253, 55],
  ]) {
    box(o, c, x - 2, x + 2, 12.0, 12.65, z - 2, z + 2, 'metal');
    box(o, c, x - 1.75, x + 1.75, 12.65, 12.75, z - 1.75, z + 1.75, 'glass');
  }
  for (const r of controls.stairPlans) {
    const xs = r[0].map((p) => p[0]),
      zs = r[0].map((p) => p[1]),
      a = Math.min(...xs),
      b = Math.max(...xs),
      lo = Math.min(...zs),
      hi = Math.max(...zs);
    stair(o, c, { x0: a, x1: b, z0: lo, z1: hi, closedBase: true });
    const roof = (z) => FLOOR + 3.1 + ((UPPER - FLOOR) * (z - lo)) / (hi - lo),
      points = [
        [a, roof(lo), lo],
        [b, roof(lo), lo],
        [b, roof(hi), hi],
        [a, roof(hi), hi],
      ];
    Q(o, c, points, 'glass', C.glass, [0, 1, 0]);
    Q(
      o,
      c,
      points.map((p) => [p[0], p[1] - 0.15, p[2]]),
      'glass',
      C.glass,
      [0, -1, 0],
    );
    for (const x of [a, b]) {
      Q(
        o,
        c,
        [
          [x, FLOOR, lo],
          [x, UPPER, hi],
          [x, roof(hi), hi],
          [x, roof(lo), lo],
        ],
        'glass',
        C.glass,
        [x === a ? -1 : 1, 0, 0],
      );
      beam(adapter(o, c), 'metal', [x, roof(lo), lo], [x, roof(hi), hi], 0.1, 0.14, C.metal);
    }
    if (c.fine) {
      for (let z = lo + 1; z < hi; z += c.near ? 2 : 5)
        beam(
          adapter(o, c),
          'metal',
          [a, roof(z) + 0.035, z],
          [b, roof(z) + 0.035, z],
          0.08,
          0.11,
          C.metal,
        );
    }
  }
}
export function buildStationLevel(o, level = 'master', mark = () => {}) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Edinburgh Waverley tier ' + level);
  ranges(o, c);
  mark('six-internal-ranges-and-booking-rooflight');
  shedRoofs(o, c);
  mark('whole-glazed-pitched-roof-field');
  westEntrances(o, c);
  southFrontage(o, c);
  mark('western-classical-entrances-and-stone-frontage');
  curvedEntry(o, c);
  mark('market-street-office-curved-pavilion-and-descending-stairs');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

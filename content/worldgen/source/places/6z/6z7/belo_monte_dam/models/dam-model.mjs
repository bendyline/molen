/** Belo Monte main dam in its signed retained map frame, in meters. */
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
  stone: lin('8b8377'),
  wall: lin('bcb5a6'),
  base: lin('a2a495'),
  gravel: lin('8d7e6a'),
  roof: lin('198855'),
  metal: lin('b4babd'),
  dark: lin('586163'),
  glass: lin('526d76'),
  paving: lin('95968c'),
  trim: lin('d5a72b'),
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  trim: { slot: 'door', graph: 'metal_painted', roughness: 0.8 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.74 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.8 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.43 },
};

const cfg = {
  skyline: { round: 5, pipe: 1, wing: 3 },
  district: { round: 8, pipe: 3, wing: 4, detail: true },
  street: { round: 12, pipe: 5, wing: 5, detail: true, fine: true, recess: true },
  closeup: { round: 20, pipe: 8, wing: 5, detail: true, fine: true, near: true, recess: true },
  master: {
    round: 36,
    pipe: 18,
    wing: 5,
    detail: true,
    fine: true,
    near: true,
    master: true,
    recess: true,
  },
};
export const controls = {
  anchor: [-51.777917853, -3.133655434],
  heading: -0.017833149255,
  datum: 64.695191,
  referenceLocal: [0, 620],
  outline: [
    [-890.983, 468.105],
    [-876.066, 453.031],
    [-86.386, -345.379],
    [588.822, -322.227],
    [709.257, -214.819],
    [674.36, -140.67],
    [792.587, 443.222],
    [797.633, 468.105],
    [819.677, 467.412],
    [833.54, 441.824],
    [829.095, 426.995],
    [841.362, 395.457],
    [854.04, 370.782],
    [858.826, 354.897],
    [896.75, 341.395],
    [845.255, 329.499],
    [828.646, 301.459],
    [802.372, 249.455],
    [778.114, 142.837],
    [776.052, 94.564],
    [823.542, -18.399],
    [753.083, -73.201],
    [743.921, -102.553],
    [786.883, -251.219],
    [760.911, -319.93],
    [684.726, -378.515],
    [635.314, -390.148],
    [613.912, -393.964],
    [600.539, -450.663],
    [568.596, -449.014],
    [-80.159, -468.105],
    [-154.905, -442.256],
    [-210.793, -416.208],
    [-260.137, -374.178],
    [-397.558, -237.844],
    [-460.172, -271.019],
    [-521.463, -180.177],
    [-574.684, -71.286],
    [-599.957, -83.951],
    [-625.176, -59.943],
    [-648.625, -87.559],
    [-774.497, 94.195],
    [-829.025, 197.141],
    [-872.864, 297.225],
    [-887.962, 386.942],
    [-896.75, 445.84],
    [-890.983, 468.105],
  ],
  core: [
    [-80.159, -468.105],
    [568.596, -449.014],
    [600.539, -450.663],
    [600.539, -311.777384],
    [588.822, -322.227],
    [-80.159, -345.165484],
    [-80.159, -468.105],
  ],
  wingWest: [
    [-896.75, 445.84],
    [-887.962, 386.942],
    [-872.864, 297.225],
    [-829.025, 197.141],
    [-774.497, 94.195],
    [-648.625, -87.559],
    [-625.176, -59.943],
    [-599.957, -83.951],
    [-574.684, -71.286],
    [-521.463, -180.177],
    [-460.172, -271.019],
    [-397.558, -237.844],
    [-260.137, -374.178],
    [-210.793, -416.208],
    [-154.905, -442.256],
    [-80.159, -468.105],
    [-80.159, -345.165484],
    [-86.386, -345.379],
    [-876.066, 453.031],
    [-890.983, 468.105],
    [-896.75, 445.84],
  ],
  wingEast: [
    [600.539, -450.663],
    [613.912, -393.964],
    [635.314, -390.148],
    [684.726, -378.515],
    [760.911, -319.93],
    [786.883, -251.219],
    [743.921, -102.553],
    [753.083, -73.201],
    [823.542, -18.399],
    [776.052, 94.564],
    [778.114, 142.837],
    [802.372, 249.455],
    [828.646, 301.459],
    [845.255, 329.499],
    [896.75, 341.395],
    [858.826, 354.897],
    [854.04, 370.782],
    [841.362, 395.457],
    [829.095, 426.995],
    [833.54, 441.824],
    [819.677, 467.412],
    [797.633, 468.105],
    [792.587, 443.222],
    [674.36, -140.67],
    [709.257, -214.819],
    [600.539, -311.777384],
    [600.539, -450.663],
  ],
  wingProfiles: [
    [
      {
        z: -468.105,
        left: -80.159,
        right: -80.159,
        leftY: -27.787592724548027,
        rightY: -27.787592724548027,
      },
      {
        z: -442.256,
        left: -154.905,
        right: -80.159,
        leftY: -35.445781064816664,
        rightY: -26.37530460842467,
      },
      {
        z: -416.208,
        left: -210.793,
        right: -80.159,
        leftY: -38,
        rightY: -26.898691762274666,
      },
      {
        z: -374.178,
        left: -260.137,
        right: -80.159,
        leftY: -38,
        rightY: -27.872317507390903,
      },
      {
        z: -345.379,
        left: -289.1656163319494,
        right: -80.159,
        leftY: -38,
        rightY: -27.04476724312969,
      },
      {
        z: -345.165484,
        left: -289.3808347091408,
        right: -80.159,
        leftY: -38,
        rightY: -27.044935134846952,
      },
      {
        z: -271.019,
        left: -460.172,
        right: -159.9329305244173,
        leftY: -37.00621665635678,
        rightY: -38,
      },
      {
        z: -237.844,
        left: -482.5551369300544,
        right: -192.74518738492756,
        leftY: -35.6974432724119,
        rightY: -38,
      },
      {
        z: -180.177,
        left: -521.463,
        right: -249.7816430405431,
        leftY: -32.06009144784786,
        rightY: -38,
      },
      {
        z: -87.559,
        left: -648.625,
        right: -341.38693636101755,
        leftY: -9.40273042120485,
        rightY: -28.87167668917253,
      },
      {
        z: -83.951,
        left: -651.1236860041595,
        right: -344.95548565273475,
        leftY: -9.316279132000417,
        rightY: -28.260464955491734,
      },
      {
        z: -71.286,
        left: -659.8947110159886,
        right: -357.4820036071693,
        leftY: -9.32033476368715,
        rightY: -26.4633588004115,
      },
      {
        z: -59.943,
        left: -667.7501975307283,
        right: -368.7009766160244,
        leftY: -9.489731110404563,
        rightY: -25.236212284791023,
      },
      {
        z: 94.195,
        left: -774.497,
        right: -521.1535959970441,
        leftY: -2.544423993154574,
        rightY: -5.758883633407557,
      },
      {
        z: 197.141,
        left: -829.025,
        right: -622.973960571636,
        leftY: 11.100117060787682,
        rightY: 4.836993911092293,
      },
      {
        z: 297.225,
        left: -872.864,
        right: -721.9636189175988,
        leftY: 16,
        rightY: 5.413309238735394,
      },
      {
        z: 386.942,
        left: -887.962,
        right: -810.6996324444833,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 445.84,
        left: -896.75,
        right: -868.9536280607707,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 453.031,
        left: -894.887413114754,
        right: -876.066,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 468.105,
        left: -890.983,
        right: -890.983,
        leftY: 16,
        rightY: 16,
      },
    ],
    [
      {
        z: -450.663,
        left: 600.539,
        right: 600.539,
        leftY: -21.93516750181881,
        rightY: -21.93516750181881,
      },
      {
        z: -393.964,
        left: 600.539,
        right: 613.912,
        leftY: -17.31388930461631,
        rightY: -16.647259211139968,
      },
      {
        z: -390.148,
        left: 600.539,
        right: 635.314,
        leftY: -16.95397276380583,
        rightY: -15.167142556245295,
      },
      {
        z: -378.515,
        left: 600.539,
        right: 684.726,
        leftY: -15.96784182767206,
        rightY: -12.404790810807896,
      },
      {
        z: -319.93,
        left: 600.539,
        right: 760.911,
        leftY: -6.953087785277724,
        rightY: -9.72563894177857,
      },
      {
        z: -311.777384,
        left: 600.539,
        right: 763.9925989106838,
        leftY: -5.879440861716532,
        rightY: -8.768693290227027,
      },
      {
        z: -251.219,
        left: 668.4422190935855,
        right: 786.883,
        leftY: 5.154790802677752,
        rightY: -3.2245580945124743,
      },
      {
        z: -214.819,
        left: 709.257,
        right: 776.3640057444204,
        leftY: 8.855324203349895,
        rightY: 3.4236843594641613,
      },
      {
        z: -140.67,
        left: 674.36,
        right: 754.9361786824156,
        leftY: 15.14226823491667,
        rightY: 16,
      },
      {
        z: -102.553,
        left: 682.0779659234927,
        right: 743.921,
        leftY: 16,
        rightY: 16,
      },
      {
        z: -73.201,
        left: 688.0211864231742,
        right: 753.083,
        leftY: 16,
        rightY: 16,
      },
      {
        z: -18.399,
        left: 699.1175468014633,
        right: 823.542,
        leftY: 16,
        rightY: 12.270306395126141,
      },
      {
        z: 94.564,
        left: 721.9904010296425,
        right: 776.052,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 142.837,
        left: 731.7647633620601,
        right: 778.114,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 249.455,
        left: 753.3528760370068,
        right: 802.372,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 301.459,
        left: 763.8826947500565,
        right: 828.646,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 329.499,
        left: 769.5602602587464,
        right: 845.255,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 341.395,
        left: 771.9689735002363,
        right: 896.75,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 354.897,
        left: 774.7028711285649,
        right: 858.826,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 370.782,
        left: 777.9192808327567,
        right: 854.04,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 395.457,
        left: 782.9154979842162,
        right: 841.362,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 426.995,
        left: 789.3013418149246,
        right: 829.095,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 441.824,
        left: 792.3039316483186,
        right: 833.54,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 443.222,
        left: 792.587,
        right: 832.7825952008754,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 467.412,
        left: 797.4924671864326,
        right: 819.677,
        leftY: 16,
        rightY: 16,
      },
      {
        z: 468.105,
        left: 797.633,
        right: 797.633,
        leftY: 16,
        rightY: 16,
      },
    ],
  ],
  hall: [
    [-80.22989, -468.00507],
    [-262.81941, -473.69411],
    [-261.81771, -517.84326],
    [-58.35138, -511.93019],
    [-57.53118, -532.81773],
    [570.77438, -514.20514],
    [568.3563, -449.15784],
    [-80.22989, -468.00507],
  ],
  apron: [
    [-56, -532.7723711374169],
    [556, -514.6428083813593],
    [556, -531.6428083813593],
    [-56, -549.7723711374169],
    [-56, -532.7723711374169],
  ],
  divider: [
    [203.63669, -535.09019],
    [220.39857, -765.58777],
    [247.83332, -765.48069],
    [232.85997, -535.01502],
    [203.63669, -535.09019],
  ],
  pipes: [
    {
      x: -55,
      start: [-55, -5, -386],
      end: [-55, -55, -474.27191603058736],
      radius: 7.5,
    },
    {
      x: -19.705882352941174,
      start: [-19.705882352941174, -5, -384.8705882352941],
      end: [-19.705882352941174, -55, -473.2463062300747],
      radius: 7.5,
    },
    {
      x: 15.588235294117652,
      start: [15.588235294117652, -5, -383.74117647058824],
      end: [15.588235294117652, -55, -472.22069642956205],
      radius: 7.5,
    },
    {
      x: 50.882352941176464,
      start: [50.882352941176464, -5, -382.61176470588236],
      end: [50.882352941176464, -55, -471.19508662904934],
      radius: 7.5,
    },
    {
      x: 86.1764705882353,
      start: [86.1764705882353, -5, -381.4823529411765],
      end: [86.1764705882353, -55, -470.1694768285367],
      radius: 7.5,
    },
    {
      x: 121.47058823529412,
      start: [121.47058823529412, -5, -380.3529411764706],
      end: [121.47058823529412, -55, -469.143867028024],
      radius: 7.5,
    },
    {
      x: 156.76470588235293,
      start: [156.76470588235293, -5, -379.22352941176473],
      end: [156.76470588235293, -55, -468.1182572275113],
      radius: 7.5,
    },
    {
      x: 192.05882352941177,
      start: [192.05882352941177, -5, -378.09411764705885],
      end: [192.05882352941177, -55, -467.09264742699867],
      radius: 7.5,
    },
    {
      x: 227.3529411764706,
      start: [227.3529411764706, -5, -376.9647058823529],
      end: [227.3529411764706, -55, -466.06703762648596],
      radius: 7.5,
    },
    {
      x: 262.6470588235294,
      start: [262.6470588235294, -5, -375.83529411764704],
      end: [262.6470588235294, -55, -465.0414278259733],
      radius: 7.5,
    },
    {
      x: 297.94117647058823,
      start: [297.94117647058823, -5, -374.70588235294116],
      end: [297.94117647058823, -55, -464.01581802546065],
      radius: 7.5,
    },
    {
      x: 333.2352941176471,
      start: [333.2352941176471, -5, -373.5764705882353],
      end: [333.2352941176471, -55, -462.99020822494793],
      radius: 7.5,
    },
    {
      x: 368.52941176470586,
      start: [368.52941176470586, -5, -372.4470588235294],
      end: [368.52941176470586, -55, -461.9645984244353],
      radius: 7.5,
    },
    {
      x: 403.8235294117647,
      start: [403.8235294117647, -5, -371.3176470588235],
      end: [403.8235294117647, -55, -460.93898862392257],
      radius: 7.5,
    },
    {
      x: 439.11764705882354,
      start: [439.11764705882354, -5, -370.18823529411765],
      end: [439.11764705882354, -55, -459.9133788234099],
      radius: 7.5,
    },
    {
      x: 474.4117647058823,
      start: [474.4117647058823, -5, -369.05882352941177],
      end: [474.4117647058823, -55, -458.88776902289726],
      radius: 7.5,
    },
    {
      x: 509.7058823529412,
      start: [509.7058823529412, -5, -367.9294117647059],
      end: [509.7058823529412, -55, -457.86215922238455],
      radius: 7.5,
    },
    {
      x: 545,
      start: [545, -5, -366.8],
      end: [545, -55, -456.8365494218719],
      radius: 7.5,
    },
  ],
  headY: 14,
  foundation: -68,
  roofY: -30,
  hallFloor: -48,
  tailwater: -53,
  scope:
    'Main Belo Monte dam at the retained exact map identity. Both rock-fill arms, intake headwall, eighteen exposed penstocks, the full native green-roof powerhouse including the west wing, river-facing transformer apron, outfall arcade and the mapped tailrace divider.',
  interpretation:
    'The reservoir datum comes from the standard Terrarium sample at local [0,620]. The layout uses the exact retained dam polygon and the single current PMTiles powerhouse footprint. Elevations, pipe diameters and grades are picture and standard-terrain estimates. The supplier confirms eighteen main units, and the aerial identifies the exposed penstock arrangement. The separately located Pimental site and diversion corridor are outside this main-dam reconstruction.',
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
    active = holes.filter((h) => c.recess || h.kind === 'opening'),
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
    if (h.kind === 'opening') continue;
    const depth = c.recess ? (h.depth ?? 0.2) : -0.02,
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
    if (c.master)
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
const FLOOR = 0.65,
  FOOT = -10;
function simplify(r, t = 0.3) {
  r = openRing(r).map((p) => [...p]);
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L && Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L < t) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function panel(o, c, poly, y, s, N = [0, 1, 0]) {
  const rs = poly.map((r) => (c === cfg.skyline ? simplify(r) : openRing(r))),
    a = rs.flat(),
    holes = rs.slice(1).map((_, i) => rs.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(a.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [a[j][0], typeof y === 'function' ? y(a[j]) : y, a[j][1]]),
      s,
      C[s],
      N,
    );
}
function solid(o, c, poly, lo, hi, s) {
  panel(o, c, poly, hi, s);
  panel(o, c, poly, lo, s, [0, -1, 0]);
  for (let j = 0; j < poly.length; j++) {
    const r = c === cfg.skyline ? simplify(poly[j]) : openRing(poly[j]);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      Q(
        o,
        c,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        s,
        C[s],
        [b[1] - a[1], 0, a[0] - b[0]].map((v) => (j ? -v : v)),
      );
    }
  }
}
function ringEdges(poly, fn) {
  for (let k = 0; k < poly.length; k++) {
    let r = openRing(poly[k]);
    const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0);
    if (area < 0) r = [...r].reverse();
    for (let j = 0; j < r.length; j++) {
      let e = edge(r, j);
      if (k) {
        const p = e.p;
        e = { ...e, N: e.N.map((v) => -v), p: ([u, y, d]) => p([u, y, -d]) };
      }
      fn(e, k);
    }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
const pt = ([x, z], y) => [x, y, z];
const crown = controls.headY;
const foundation = controls.foundation;

function rockWing(o, c, profile) {
  // Sample the retained rock-fill outline transversely. Crest, benches and toes
  // follow the same stations at every tier.
  const stops =
    c.wing === 3 ? [0, 0.48, 1] : c.wing === 4 ? [0, 0.4, 0.55, 1] : [0, 0.36, 0.43, 0.55, 1];
  const rows = profile.map((q) =>
    stops.map((t, k) => [
      lerp(q.left, q.right, t),
      k === 0
        ? q.leftY
        : k === stops.length - 1
          ? q.rightY
          : k === 1 && c.wing === 5
            ? crown - 5
            : crown,
      q.z,
    ]),
  );
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    for (let k = 1; k < stops.length; k++) {
      const mid = (stops[k - 1] + stops[k]) / 2,
        s = mid > 0.38 && mid < 0.56 ? 'paving' : 'gravel';
      Q(o, c, [a[k - 1], b[k - 1], b[k], a[k]], s, C[s], [0, 1, 0]);
    }
    for (const [k, sign] of [
      [0, -1],
      [stops.length - 1, 1],
    ]) {
      const p = a[k],
        q = b[k];
      Q(o, c, [p, q, [q[0], foundation, q[2]], [p[0], foundation, p[2]]], 'stone', C.stone, [
        sign,
        0,
        0,
      ]);
    }
  }
  for (const [row, sign] of [
    [rows[0], -1],
    [rows.at(-1), 1],
  ])
    for (let k = 1; k < row.length; k++) {
      const a = row[k - 1],
        b = row[k];
      Q(o, c, [a, b, [b[0], foundation, b[2]], [a[0], foundation, a[2]]], 'stone', C.stone, [
        0,
        0,
        sign,
      ]);
    }
}

function coreInterval(x) {
  const p = controls.core,
    hits = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i];
    if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
    if (a[0] === b[0]) hits.push(a[1], b[1]);
    else hits.push(lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
  }
  return [Math.min(...hits), Math.max(...hits)];
}

function headworks(o, c) {
  const p = controls.core;
  const xs = [...new Set(p.map((p) => p[0]))].sort((a, b) => a - b);
  const rows = xs.map((x) => {
    const [front, back] = coreInterval(x),
      head = lerp(front, back, 0.78),
      foot = lerp(front, back, 0.3);
    return [
      [x, foundation, back],
      [x, crown, back],
      [x, crown, head],
      [x, -16, head],
      [x, -63, foot],
      [x, -63, front],
      [x, foundation, front],
    ];
  });
  for (let i = 1; i < rows.length; i++)
    for (let k = 1; k < rows[i].length; k++) {
      const s = k === 2 ? 'paving' : k >= 4 ? 'base' : 'wall';
      const normal = k === 1 ? [0, 0, 1] : k === 2 || k === 5 ? [0, 1, 0] : [0, 0, -1];
      Q(o, c, [rows[i - 1][k - 1], rows[i][k - 1], rows[i][k], rows[i - 1][k]], s, C[s], normal);
    }
  for (const [row, sign] of [
    [rows[0], -1],
    [rows.at(-1), 1],
  ]) {
    const atBase = ([x, , z]) => [x, foundation, z];
    for (let k = 1; k < row.length; k++) {
      const a = row[k - 1],
        b = row[k];
      Q(o, c, [a, b, atBase(b), atBase(a)], 'base', C.base, [sign, 0, 0]);
    }
  }
  if (c.detail) {
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      beam(adapter(o, c), 'base', a[2], b[2], 0.65, 0.8, C.base);
      if (c.fine)
        beam(
          adapter(o, c),
          'trim',
          [a[2][0], crown + 1.2, a[2][2]],
          [b[2][0], crown + 1.2, b[2][2]],
          0.15,
          0.15,
          C.trim,
        );
    }
  }
}

function pipePoint(pipe, t) {
  return pipe.start.map((v, i) => lerp(v, pipe.end[i], t));
}

function penstock(o, c, pipe) {
  const delta = sub(pipe.end, pipe.start),
    L = Math.hypot(delta[1], delta[2]);
  const up = [0, -delta[2] / L, delta[1] / L];
  const ring = (t, r) =>
    Array.from({ length: c.round }, (_, j) => {
      const center = pipePoint(pipe, t),
        a = ((j + 0.5) * Math.PI * 2) / c.round;
      return [
        center[0] + r * Math.cos(a),
        center[1] + r * up[1] * Math.sin(a),
        center[2] + r * up[2] * Math.sin(a),
      ];
    });
  const skin = (a, b, r) => {
    const p = ring(a, r),
      q = ring(b, r);
    for (let j = 0; j < c.round; j++) {
      const k = (j + 1) % c.round,
        center = pipePoint(pipe, a),
        N = sub(
          p[j].map((v, i) => (v + p[k][i]) / 2),
          center,
        );
      Q(o, c, [p[j], q[j], q[k], p[k]], 'metal', C.metal, N);
    }
  };
  for (let i = 0; i < c.pipe; i++) skin(i / c.pipe, (i + 1) / c.pipe, pipe.radius);
  if (c.detail)
    for (let i = 1, n = c.master ? 18 : c.near ? 8 : c.fine ? 5 : 3; i <= n; i++) {
      const t = i / (n + 1);
      skin(t - 0.003, t + 0.003, pipe.radius + 0.21);
    }
  const [x, y, z] = pipe.start;
  if (c.detail) {
    const a = [x - 11, y - 10, z + 10],
      b = [x + 11, y - 10, z + 10],
      p = [x + 11, y + 11, z + 10],
      q = [x - 11, y + 11, z + 10];
    const n = [x - 8.5, y + 5, z - 10],
      m = [x + 8.5, y + 5, z - 10];
    Q(o, c, [q, p, m, n], 'wall', C.wall, [0, 1, 0]);
    Q(o, c, [a, q, n, [x - 8.5, y - 9, z - 10]], 'wall', C.wall, [-1, 0, 0]);
    Q(o, c, [b, p, m, [x + 8.5, y - 9, z - 10]], 'wall', C.wall, [1, 0, 0]);
    if (c.fine) {
      for (const side of [-1, 1])
        beam(
          adapter(o, c),
          'trim',
          [x + side * 10, y + 7, z + 1],
          [x + side * 9, y + 4, z - 12],
          0.28,
          0.28,
          C.trim,
        );
      const p = pipePoint(pipe, 0.62);
      box(o, c, x - 8.3, x + 8.3, p[1] - 11, p[1] - 5, p[2] - 2.5, p[2] + 2.5, 'base');
    }
  }
}

function powerhouse(o, c) {
  const ring = controls.hall,
    roof = controls.roofY,
    floor = controls.hallFloor;
  panel(o, c, [ring], roof, 'roof');
  panel(o, c, [ring], foundation, 'base', [0, -1, 0]);
  ringEdges([ring], (e) => {
    const river = e.N[2] < -0.7 && e.L > 550;
    const count = river ? controls.pipes.length : 0;
    const openings = [],
      glazing = [];
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * e.L) / count,
        step = e.L / count;
      openings.push({ ring: rect(u, -57, step * 0.64, 10), kind: 'opening' });
      if (c.detail)
        glazing.push({ ring: rect(u, -37, step * 0.66, 3.6), kind: 'glass', depth: 0.55 });
    }
    wall(o, c, e.p, e.L, foundation, floor, openings, 'wall');
    wall(o, c, e.p, e.L, floor, roof - 5, glazing, 'wall');
    Q(
      o,
      c,
      [
        e.p([0, roof - 5, 0.02]),
        e.p([e.L, roof - 5, 0.02]),
        e.p([e.L, roof, 0.02]),
        e.p([0, roof, 0.02]),
      ],
      'roof',
      C.roof,
      e.N,
    );
    if (c.near)
      for (let i = 1; i < count; i++) {
        const u = (i * e.L) / count;
        beam(adapter(o, c), 'base', e.p([u, -63, 0.7]), e.p([u, roof - 5, 0.7]), 1.1, 1.3, C.base);
      }
  });
  solid(o, c, [controls.apron], -54, -48, 'base');
  if (c.detail)
    for (const pipe of controls.pipes) {
      const x = pipe.x;
      const z = -532.81773 + ((x + 57.53118) * 18.61259) / 628.30556 - 9;
      box(o, c, x - 7.2, x + 7.2, -48, -42, z - 4, z + 4, 'base');
      if (c.fine) {
        box(o, c, x - 3.1, x + 3.1, -42, -40.2, z - 2.4, z + 2.4, 'metal');
        for (const d of [-4, 0, 4])
          beam(
            adapter(o, c),
            'dark',
            [x + d, -43, z - 4.3],
            [x + d, -41, z - 4.3],
            0.36,
            0.36,
            C.dark,
          );
      }
      if (c.near) {
        for (const d of [-4.8, 4.8]) {
          beam(
            adapter(o, c),
            'metal',
            [x + d, -48, z - 5.9],
            [x + d, -26, z - 3.8],
            0.38,
            0.38,
            C.metal,
          );
          beam(
            adapter(o, c),
            'metal',
            [x + d, -48, z + 5.9],
            [x + d, -26, z + 3.8],
            0.38,
            0.38,
            C.metal,
          );
          beam(
            adapter(o, c),
            'metal',
            [x + d, -26, z - 3.8],
            [x + d, -26, z + 3.8],
            0.36,
            0.36,
            C.metal,
          );
          beam(
            adapter(o, c),
            'metal',
            [x + d, -47, z - 5.9],
            [x + d, -28, z + 3.8],
            0.25,
            0.25,
            C.metal,
          );
        }
        beam(adapter(o, c), 'metal', [x - 4.8, -26, z], [x + 4.8, -26, z], 0.4, 0.4, C.metal);
      }
    }
  solid(o, c, [controls.divider], -64, -48.8, 'wall');
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Belo Monte tier ' + level);
  for (const profile of controls.wingProfiles) rockWing(o, c, profile);
  headworks(o, c);
  for (const pipe of controls.pipes) penstock(o, c, pipe);
  powerhouse(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

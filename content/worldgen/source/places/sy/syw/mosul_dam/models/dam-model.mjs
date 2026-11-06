/** Original Mosul Dam principal hydraulic core; ordinary aerial and named-map controls. */
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
  stone: lin('898075'),
  wall: lin('d2cec5'),
  base: lin('a2a495'),
  gravel: lin('8d7e6a'),
  roof: lin('b9bab0'),
  metal: lin('a0a093'),
  dark: lin('607975'),
  glass: lin('526d76'),
  paving: lin('95968c'),
  trim: lin('dfdbcb'),
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  trim: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.74 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.8 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.43 },
};
const cfg = {
  skyline: { round: 6, step: 600, profile: 4, chute: 4 },
  district: { round: 8, step: 60, profile: 6, chute: 8, detail: true },
  street: {
    round: 12,
    step: 34,
    profile: 8,
    chute: 14,
    detail: true,
    fine: true,
    recess: true,
    post: 44,
  },
  closeup: {
    round: 20,
    step: 15,
    profile: 8,
    chute: 24,
    detail: true,
    fine: true,
    recess: true,
    near: true,
    post: 18,
  },
  master: {
    round: 40,
    step: 6,
    profile: 8,
    chute: 48,
    detail: true,
    fine: true,
    recess: true,
    near: true,
    master: true,
    post: 5,
  },
};
export const controls = {
  anchor: [42.82421, 36.63083],
  heading: 0,
  datum: 307.003906,
  referenceLocal: [0, -700],
  path: [
    [-1123.94235, -274.46312],
    [-1112.44102, -284.04725],
    [-1106.69035, -286.44329],
    [-1101.41891, -286.92249],
    [-1074.58246, -277.33836],
    [-1051.10057, -270.15026],
    [-1033.36934, -261.04532],
    [-972.50811, -221.27099],
    [-934.17033, -205.45704],
    [13.73132, 50.44534],
    [75.07177, 67.21823],
    [923.77441, 296.77057],
    [953.48619, 310.18927],
    [981.28108, 328.40039],
    [1003.80453, 349.487],
    [1028.24487, 376.80383],
    [1054.60209, 412.26791],
    [1064.66576, 428.08302],
    [1087.66843, 470.73603],
    [1094.37754, 486.072],
    [1101.56587, 507.63825],
    [1108.75421, 522.01578],
    [1127.9231, 549.33316],
    [1150.92577, 570.42031],
    [1188.78433, 594.38306],
    [1240.06111, 616.42884],
    [1424.08246, 683.52504],
    [1437.50069, 691.67247],
    [1448.04358, 694.06877],
    [1461.4618, 696.94434],
    [1552.51403, 731.45122],
    [1724.55483, 792.31785],
    [1945.95552, 875.71063],
    [1976.62574, 893.44368],
    [1998.19074, 910.6975],
    [2016.88041, 930.82699],
    [2035.57008, 957.18712],
    [2037.96619, 962.93843],
  ],
  stations: [
    {
      s: 0,
      p: [-1123.94235, -274.46312],
      N: [0.6401721136797253, 0.7682315177515388],
      toe: 11.153605600478443,
    },
    {
      s: 14.971176961942623,
      p: [-1112.44102, -284.04725],
      N: [0.570383425214513, 0.8213785657299322],
      toe: 11.111618837936533,
    },
    {
      s: 21.20104157768659,
      p: [-1106.69035, -286.44329],
      N: [0.2524142494024054, 0.9676192674283725],
      toe: 5.566342120474133,
    },
    {
      s: 26.49421759153686,
      p: [-1101.41891, -286.92249],
      N: [-0.2728159872488797, 0.9620662332196361],
      toe: 18.634708833078946,
    },
    {
      s: 54.990719069076164,
      p: [-1074.58246, -277.33836],
      N: [-0.3162184334247382, 0.9486864088635425],
      toe: 16.19831545948381,
    },
    {
      s: 79.54816070256277,
      p: [-1051.10057, -270.15026],
      N: [-0.3676487598978418, 0.929964724785612],
      toe: 14.20874894053361,
    },
    {
      s: 99.48045735188302,
      p: [-1033.36934, -261.04532],
      N: [-0.5281250237479252, 0.8491666263409399],
      toe: 17.084116823428815,
    },
    {
      s: 172.18593612798213,
      p: [-972.50811, -221.27099],
      N: [-0.488849943580878, 0.8723678883710545],
      toe: 4.886492305899765,
    },
    {
      s: 213.6572079909344,
      p: [-934.17033, -205.45704],
      N: [-0.2656112975499019, 0.9640802034135219],
      toe: -4.5967292643927635,
    },
    {
      s: 1195.4940407500171,
      p: [13.73132, 50.44534],
      N: [-0.26082624142787775, 0.965385763196561],
      toe: -26.66102053913704,
    },
    {
      s: 1259.0863409533797,
      p: [75.07177, 67.21823],
      N: [-0.2612724082490138, 0.9652651079821339],
      toe: -27.66970089696349,
    },
    {
      s: 2138.2850943319577,
      p: [923.77441, 296.77057],
      N: [-0.26659150680754673, 0.96380961216315],
      toe: -0.6957170364748322,
    },
    {
      s: 2170.8864958426043,
      p: [953.48619, 310.18927],
      N: [-0.4819322199588883, 0.8762084999390828],
      toe: 0.29430158754882996,
    },
    {
      s: 2204.1160128683828,
      p: [981.28108, 328.40039],
      N: [-0.6155129893823122, 0.7881267410141909],
      toe: 0.44085480698447554,
    },
    {
      s: 2234.969714772605,
      p: [1003.80453, 349.487],
      N: [-0.7176993917848963, 0.6963530591816122],
      toe: 0.3393018291369003,
    },
    {
      s: 2271.624038126945,
      p: [1028.24487, 376.80383],
      N: [-0.7773967323081381, 0.6290105886204371],
      toe: -0.8278895481893755,
    },
    {
      s: 2315.810054199621,
      p: [1054.60209, 412.26791],
      N: [-0.815287921880884, 0.5790557869801057],
      toe: -4.797454438814498,
    },
    {
      s: 2334.5555912199625,
      p: [1064.66576, 428.08302],
      N: [-0.8704407395988206, 0.4922732156502708],
      toe: -4.374879501341695,
    },
    {
      s: 2383.015905799926,
      p: [1087.66843, 470.73603],
      N: [-0.8899804160998527, 0.45599874885654385],
      toe: -4.298154156346129,
    },
    {
      s: 2399.7552048543366,
      p: [1094.37754, 486.072],
      N: [-0.9358354470975446, 0.35243725108980606],
      toe: -5.254990125142797,
    },
    {
      s: 2422.487895571702,
      p: [1101.56587, 507.63825],
      N: [-0.9284841907580377, 0.3713719261231143],
      toe: -0.8234306048097437,
    },
    {
      s: 2438.56227272469,
      p: [1108.75421, 522.01578],
      N: [-0.8452728020081065, 0.5343349980914263],
      toe: 8.150922821546658,
    },
    {
      s: 2471.9342009563115,
      p: [1127.9231, 549.33316],
      N: [-0.7539830269541787, 0.656893899397014],
      toe: 8.175856729271516,
    },
    {
      s: 2503.1398209990443,
      p: [1150.92577, 570.42031],
      N: [-0.5949504354134277, 0.8037623898898061],
      toe: 12.77860944783589,
    },
    {
      s: 2547.9447755558353,
      p: [1188.78433, 594.38306],
      N: [-0.4586680571153647, 0.8886076824909949],
      toe: 16.152478424548235,
    },
    {
      s: 2603.7598683442275,
      p: [1240.06111, 616.42884],
      N: [-0.35427537458252906, 0.9351411438731636],
      toe: 18.0106270701815,
    },
    {
      s: 2799.6316562828238,
      p: [1424.08246, 683.52504],
      N: [-0.35611332985674515, 0.9344427731532526],
      toe: 14.963672596494064,
    },
    {
      s: 2815.32972979322,
      p: [1437.50069, 691.67247],
      N: [-0.4027654075223868, 0.9153032429218886],
      toe: 14.626321851376986,
    },
    {
      s: 2826.1415188793103,
      p: [1448.04358, 694.06877],
      N: [-0.21487833678282633, 0.9766408246543078],
      toe: 12.731478928215836,
    },
    {
      s: 2839.864402351573,
      p: [1461.4618, 696.94434],
      N: [-0.33690843141363574, 0.9415374176539155],
      toe: 13.030444175997445,
    },
    {
      s: 2937.236027352429,
      p: [1552.51403, 731.45122],
      N: [-0.34080654559556334, 0.9401334471654645],
      toe: 12.532877955743231,
    },
    {
      s: 3119.7265298784423,
      p: [1724.55483, 792.31785],
      N: [-0.34424945416913216, 0.9388782206997106],
      toe: 10.705625830605527,
    },
    {
      s: 3356.3118660440728,
      p: [1945.95552, 875.71063],
      N: [-0.37233465543368716, 0.9280985423774122],
      toe: 11.915066865276629,
    },
    {
      s: 3391.739587635376,
      p: [1976.62574, 893.44368],
      N: [-0.5564981150733183, 0.8308488718893731],
      toe: 10.97818844188896,
    },
    {
      s: 3419.357399452977,
      p: [1998.19074, 910.6975],
      N: [-0.6804899392133537, 0.7327574241380337],
      toe: 10.541067233886679,
    },
    {
      s: 3446.825565252116,
      p: [2016.88041, 930.82699],
      N: [-0.7793320228728493, 0.6266112017231361],
      toe: 10.835625048980944,
    },
    {
      s: 3479.139033316157,
      p: [2035.57008, 957.18712],
      N: [-0.8358968609802683, 0.5488865436529975],
      toe: 10.560869509608949,
    },
    {
      s: 3485.3695156288036,
      p: [2037.96619, 962.93843],
      N: [-0.9230922601812269, 0.38457857349768465],
      toe: 12.25164474458336,
    },
  ],
  length: 3485.3695156288036,
  gap: [2271.624038126945, 2383.015905799926],
  crest: 30,
  foundation: -82,
  tailwater: -55,
  floor: -37,
  outletFloor: -39,
  powerhouse: [
    [
      [
        [-666.28508, 346.61155],
        [-556.06396, 225.84351],
        [-531.1444, 248.36758],
        [-641.36553, 369.61518],
        [-666.28508, 346.61155],
      ],
    ],
  ],
  outletHouse: [
    [
      [
        [-419.48561, 246.92987],
        [-373.9595, 232.07357],
        [-368.20883, 249.80529],
        [-413.73495, 264.18239],
        [-419.48561, 246.92987],
      ],
    ],
  ],
  tankPlinths: [
    [
      [
        [-681.6202, 215.30035],
        [-682.09942, 210.50801],
        [-680.66175, 205.71567],
        [-677.78642, 202.36103],
        [-673.47342, 199.96487],
        [-668.20197, 199.48563],
        [-662.93053, 201.40257],
        [-663.88897, 191.33867],
        [-662.45131, 186.54634],
        [-659.57597, 182.71248],
        [-655.26297, 180.79555],
        [-646.15775, 179.83709],
        [-647.11619, 170.25244],
        [-645.67853, 165.93936],
        [-642.32397, 162.10551],
        [-638.01097, 159.70935],
        [-633.21875, 159.23012],
        [-628.90575, 160.66781],
        [-625.07197, 164.02243],
        [-622.67586, 168.33552],
        [-622.19663, 173.12784],
        [-623.6343, 177.44092],
        [-626.50964, 181.27478],
        [-630.82264, 183.67095],
        [-639.92786, 184.62941],
        [-638.96941, 193.73483],
        [-640.40708, 198.52717],
        [-643.76164, 202.36103],
        [-648.07464, 204.7572],
        [-652.86686, 205.23644],
        [-658.1383, 203.79874],
        [-657.17986, 212.90418],
        [-658.61753, 217.69652],
        [-661.97208, 221.5304],
        [-666.28508, 223.92657],
        [-671.07731, 224.40581],
        [-677.78642, 222.00963],
        [-681.6202, 215.30035],
      ],
    ],
    [
      [
        [-679.22408, 222.9681],
        [-676.34875, 229.19816],
        [-675.86953, 233.99051],
        [-677.3072, 238.78286],
        [-680.18253, 242.61675],
        [-684.49553, 245.01293],
        [-689.28775, 245.49216],
        [-694.07998, 244.05446],
        [-697.91375, 240.69981],
        [-700.30986, 236.38669],
        [-700.78909, 231.59433],
        [-699.35142, 226.80198],
        [-695.99686, 223.44734],
        [-691.68386, 221.05116],
        [-686.89164, 220.57193],
        [-679.22408, 222.9681],
      ],
    ],
  ],
  tanks: [
    [-688.1, 233],
    [-670.2, 212],
    [-651.3, 192],
    [-634.5, 172.2],
  ],
  tankRadius: 11.4,
  tankBottom: -35,
  tankTop: 13,
  spillway: {
    gates: 5,
    start: [
      [1028.24487, 376.80383],
      [1087.66843, 470.73603],
    ],
    end: [
      [459.78661370000003, 761.6933730000001],
      [516.1335692, 803.677463],
    ],
    basin: [
      [398.5468, 800.94465],
      [432.09236, 854.14345],
    ],
    top: 30,
    floor: -55,
    flow: [-0.8450907617349815, 0.534622861866371],
    throat: [
      [869.62229, 499.01175],
      [1078.5632, 465.94355],
    ],
    bridge: [
      [1028.24487, 376.80383],
      [1054.60209, 412.26791],
      [1064.66576, 428.08302],
      [1087.66843, 470.73603],
    ],
    canalRing: [
      [432.09236, 854.14345],
      [398.5468, 800.94465],
      [869.62229, 499.01175],
      [1029.68253, 387.34719],
      [1053.64365, 416.58112],
      [1078.5632, 465.94355],
      [911.31463, 552.20868],
      [432.09236, 854.14345],
    ],
  },
  spillOutline: [
    [1028.24487, 376.80383],
    [1087.66843, 470.73603],
    [1078.5632, 465.94355],
    [432.09236, 854.14345],
    [398.5468, 800.94465],
    [869.62229, 499.01175],
    [1028.24487, 376.80383],
  ],
  ownedParts: [31, 39, 41, 42],
  preservedNeighbors: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 40, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
    54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77,
    78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
    120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138,
    139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157,
    158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176,
    177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195,
    196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214,
    215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233,
    234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252,
    253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271,
    272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290,
    291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309,
    310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328,
    329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345,
  ],
  sourceFacts: {
    retainedLength: 3400,
    selectedCrestLength: 3485.3695156288036,
    nativeTanks: 4,
    mainGateBays: 5,
    estimatedCrest: 30,
    estimatedFoundation: -82,
    estimatedPowerhouseFloor: -37,
    estimatedTailwater: -55,
    mainSpillwayOutlet: 'Ends at mapped canal mouth;native tailrace continues unmodified',
    crestBridgeKnots: 4,
  },
  scope:
    'Whole map-associated bent Mosul barrier and crest road,five-gate service spillway with open lower apron to its mapped canal mouth,western native-plan main powerhouse and smaller outlet house,four native-plan surge cylinders and connecting plinths. Separate residential/maintenance buildings,substation,roads,islands and hills remain native context. Emergency spillway beyond the pictured/mapped principal hydraulic core remains unverified;not invented. Static closed gates;no lettering,logos,people,vehicles or baked whitewater.',
  interpretation:
    'One model datum equals the standard viewer reservoir sample307.003906m at local[0,-700]. Crest+30m,foundation-82m,tailwater-55m,powerhouse floor-37m,small outlet floor-39m,tank bottom-35m/top+13m and all hydraulic profiles are picture/map-scale estimates. Historical3400m length and selected3485.370m mapped road trace are distinct controls. No exact-Q OSM way or surveyed height claim;heading0 retains actual east/south geometry with ESE crest and NNE reservoir.',
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
function band(o, c, e, y, h = 0.2, s = 'stone', d = 0.08) {
  Q(
    o,
    c,
    [e.p([0, y, d]), e.p([e.L, y, d]), e.p([e.L, y + h, d]), e.p([0, y + h, d])],
    s,
    C[s],
    e.N,
  );
}
function roundColumn(o, c, center, y0, y1, r, s = 'stone') {
  const [x, z] = center,
    n = c === cfg.skyline ? 4 : c.round;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2,
      b = ((j + 1) / n) * Math.PI * 2;
    Q(
      o,
      c,
      [
        [x + r * Math.cos(a), y0, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y0, z + r * Math.sin(b)],
        [x + r * Math.cos(b), y1, z + r * Math.sin(b)],
        [x + r * Math.cos(a), y1, z + r * Math.sin(a)],
      ],
      s,
      C[s],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
  if (c.fine) {
    box(o, c, x - r * 1.7, x + r * 1.7, y0 - 0.25, y0 + 0.2, z - r * 1.4, z + r * 1.4, s);
    box(o, c, x - r * 1.5, x + r * 1.5, y1 - 0.1, y1 + 0.35, z - r * 1.5, z + r * 1.5, s);
  }
}
function archBand(o, c, p, u, spring, R0, R1, s = 'stone', d = 0.1, n = c.round) {
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI,
      b = ((j + 1) / n) * Math.PI;
    Q(
      o,
      c,
      [
        p([u + R0 * Math.cos(a), spring + R0 * Math.sin(a), d]),
        p([u + R0 * Math.cos(b), spring + R0 * Math.sin(b), d]),
        p([u + R1 * Math.cos(b), spring + R1 * Math.sin(b), d]),
        p([u + R1 * Math.cos(a), spring + R1 * Math.sin(a), d]),
      ],
      s,
      C[s],
      sub(p([0, 0, 1]), p([0, 0, 0])),
    );
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
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  pt = (p, y) => [p[0], y, p[1]];
function along(s) {
  const a = controls.stations;
  for (let i = 1; i < a.length; i++)
    if (s <= a[i].s) {
      const t = (s - a[i - 1].s) / (a[i].s - a[i - 1].s),
        N = mix(a[i - 1].N, a[i].N, t),
        L = Math.hypot(...N);
      return {
        p: mix(a[i - 1].p, a[i].p, t),
        N: N.map((v) => v / L),
        toe: a[i - 1].toe + (a[i].toe - a[i - 1].toe) * t,
      };
    }
  return a.at(-1);
}
const side = (p, N, d, y) => [p[0] + N[0] * d, y, p[1] + N[1] * d];
const boundsFor = (a, b) =>
  [
    a,
    b,
    ...controls.stations.map((p) => p.s).filter((s) => s > a && s < b),
    ...[3020, 3305].filter((s) => s > a && s < b),
  ].sort((x, y) => x - y);
const bankOffset = (d, k) => Math.sign(d) * (5 + (Math.abs(d) - 5) * k);
function section(s) {
  const q = along(s),
    gapDistance = Math.min(...controls.gap.map((t) => Math.abs(t - s))),
    blend = Math.max(0, 1 - gapDistance / 110),
    N = mix(q.N, controls.spillway.flow, blend),
    L = Math.hypot(...N);
  // At the eastern road tie-in the occupied embankment narrows into the hillside.
  // Retaining the full downstream profile here would cover mapped village buildings.
  const bank = 1 - 0.91 * Math.min(1, Math.max(0, (s - 3020) / 285));
  return { ...q, N: N.map((v) => v / L), bank };
}
// Same cross-section endpoints as the modeled levee. Adjacent cells are unioned for runtime masks.
export function leveeMaskCells() {
  return [
    [0, controls.gap[0]],
    [controls.gap[1], controls.length],
  ].flatMap(([a, b]) => {
    const rows = boundsFor(a, b).map((s) => {
      const q = section(s);
      return [-65, 230].map((d) => {
        const p = side(q.p, q.N, bankOffset(d, q.bank), 0);
        return [p[0], p[2]];
      });
    });
    return rows.slice(1).map((r, i) => [rows[i][0], r[0], r[1], rows[i][1], rows[i][0]]);
  });
}
function levee(o, c, a, b) {
  const fixed = boundsFor(a, b),
    cuts = fixed.slice();
  for (let s = a + c.step; s < b; s += c.step) cuts.push(s);
  cuts.sort((a, b) => a - b);
  const xs = [...new Set(cuts)],
    sections = fixed.map((s) => {
      const q = section(s),
        height = (t) => 30 + (q.toe - 30) * t;
      const profile =
        c.profile === 4
          ? [
              [-65, -8],
              [-5, 30],
              [5, 30],
              [230, q.toe],
            ]
          : c.profile === 6
            ? [
                [-65, -8],
                [-18, 15],
                [-5, 30],
                [5, 30],
                [110, height(0.55)],
                [230, q.toe],
              ]
            : [
                [-65, -8],
                [-25, 10],
                [-5, 30],
                [5, 30],
                [75, height(0.47)],
                [90, height(0.47)],
                [175, height(0.86)],
                [230, q.toe],
              ];
      return profile.map(([d, y]) => side(q.p, q.N, bankOffset(d, q.bank), y));
    });
  // Interpolate complete cross-sections so every LOD shares the occupied boundary.
  const rows = xs.map((s) => {
    const j = fixed.findIndex((t) => t >= s);
    if (fixed[j] === s) return sections[j];
    const t = (s - fixed[j - 1]) / (fixed[j] - fixed[j - 1]);
    return sections[j - 1].map((p, k) => mix(p, sections[j][k], t));
  });
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < rows[j].length - 1; i++)
      Q(
        o,
        c,
        [rows[j - 1][i], rows[j][i], rows[j][i + 1], rows[j - 1][i + 1]],
        i === (c.profile === 4 ? 1 : 2)
          ? 'paving'
          : i < (c.profile === 4 ? 1 : 2)
            ? 'stone'
            : 'gravel',
        C[
          i === (c.profile === 4 ? 1 : 2)
            ? 'paving'
            : i < (c.profile === 4 ? 1 : 2)
              ? 'stone'
              : 'gravel'
        ],
        [0, 1, 0],
      );
  for (let j = 1; j < rows.length; j++)
    for (const k of [0, rows[j].length - 1]) {
      const P = rows[j - 1][k],
        R = rows[j][k],
        sign = k === 0 ? -1 : 1;
      Q(o, c, [P, R, [R[0], -82, R[2]], [P[0], -82, P[2]]], 'stone', C.stone, [
        -sign * (R[2] - P[2]),
        0,
        sign * (R[0] - P[0]),
      ]);
    }
  for (const row of [rows[0], rows.at(-1)])
    for (let k = 1; k < row.length; k++)
      Q(
        o,
        c,
        [row[k - 1], row[k], [row[k][0], -82, row[k][2]], [row[k - 1][0], -82, row[k - 1][2]]],
        'stone',
        C.stone,
      );
  if (c.fine)
    for (const d of [-4.6, 4.6]) {
      for (let s = a; s < b; s += c.post) {
        const p = along(s);
        beam(
          adapter(o, c),
          'dark',
          side(p.p, p.N, d, 30),
          side(p.p, p.N, d, 31.2),
          0.14,
          0.14,
          C.dark,
        );
      }
      for (let j = 1; j < xs.length; j++) {
        const P = along(xs[j - 1]),
          R = along(xs[j]);
        beam(
          adapter(o, c),
          'dark',
          side(P.p, P.N, d, 31.1),
          side(R.p, R.N, d, 31.1),
          0.15,
          0.15,
          C.dark,
        );
      }
    }
}
function tank(o, c, p) {
  const n = c.round,
    r = controls.tankRadius;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2,
      b = ((j + 1) / n) * Math.PI * 2;
    Q(
      o,
      c,
      [
        [p[0] + r * Math.cos(a), -35, p[1] + r * Math.sin(a)],
        [p[0] + r * Math.cos(b), -35, p[1] + r * Math.sin(b)],
        [p[0] + r * Math.cos(b), 13, p[1] + r * Math.sin(b)],
        [p[0] + r * Math.cos(a), 13, p[1] + r * Math.sin(a)],
      ],
      'wall',
      C.wall,
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    T(
      o,
      c,
      [
        [p[0], 13.5, p[1]],
        [p[0] + r * Math.cos(a), 13, p[1] + r * Math.sin(a)],
        [p[0] + r * Math.cos(b), 13, p[1] + r * Math.sin(b)],
      ],
      'wall',
      C.wall,
      [0, 1, 0],
    );
  }
  if (c.detail)
    for (const y of [-34, 12.7])
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2,
          b = ((j + 1) / n) * Math.PI * 2;
        beam(
          adapter(o, c),
          'base',
          [p[0] + (r + 0.2) * Math.cos(a), y, p[1] + (r + 0.2) * Math.sin(a)],
          [p[0] + (r + 0.2) * Math.cos(b), y, p[1] + (r + 0.2) * Math.sin(b)],
          0.45,
          0.5,
          C.base,
        );
      }
  if (c.fine) {
    for (let y = -25; y < 10; y += c.master ? 4 : 9)
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2,
          b = ((j + 1) / n) * Math.PI * 2;
        beam(
          adapter(o, c),
          'base',
          [p[0] + r * Math.cos(a), y, p[1] + r * Math.sin(a)],
          [p[0] + r * Math.cos(b), y, p[1] + r * Math.sin(b)],
          0.08,
          0.08,
          C.base,
        );
      }
    for (let y = -30; y < 12; y += c.master ? 0.4 : 1)
      beam(
        adapter(o, c),
        'dark',
        [p[0] + r + 0.15, y, p[1] - 0.4],
        [p[0] + r + 0.15, y, p[1] + 0.4],
        0.08,
        0.08,
        C.dark,
      );
    for (const z of [-0.45, 0.45])
      beam(
        adapter(o, c),
        'dark',
        [p[0] + r + 0.15, -32, p[1] + z],
        [p[0] + r + 0.15, 12, p[1] + z],
        0.1,
        0.1,
        C.dark,
      );
  }
}
function building(o, c, poly, floor, height, count) {
  panel(o, c, poly, floor + height + 0.6, 'roof');
  panel(o, c, poly, floor, 'base');
  panel(o, c, poly, -58, 'base', [0, -1, 0]);
  ringEdges(poly, (e) => {
    const long = e.L > 35,
      ports = [],
      windows = [];
    if (c.detail && long) {
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * e.L) / count;
        windows.push({
          ring: rect(u, floor + height * 0.5, (e.L / count) * 0.66, height * 0.3),
          kind: 'glass',
          depth: 0.4,
        });
        if (e.N[2] > 0.25)
          ports.push({ ring: rect(u, -54, (e.L / count) * 0.6, 12), kind: 'opening' });
      }
    }
    wall(o, c, e.p, e.L, -58, floor, ports, 'wall');
    wall(o, c, e.p, e.L, floor, floor + height, windows, 'wall');
    if (c.detail) {
      band(o, c, e, floor - 0.5, 1, 'base', 0.15);
      band(o, c, e, floor + height - 0.25, 0.5, 'base', 0.15);
    }
    if (c.fine && long)
      for (let j = 0; j <= count; j++) {
        const u = (j * e.L) / count;
        beam(
          adapter(o, c),
          'base',
          e.p([u, floor, 0.16]),
          e.p([u, floor + height, 0.16]),
          0.55,
          0.65,
          C.base,
        );
      }
  });
}
function spillway(o, c) {
  const s = controls.spillway,
    n = c.chute,
    P = (u, t, dy = 0) => {
      const a = mix(s.start[0], s.start[1], u),
        b = mix(s.throat[0], s.throat[1], u),
        d = mix(s.end[0], s.end[1], u),
        p = t < 0.25 ? mix(a, b, t / 0.25) : mix(b, d, (t - 0.25) / 0.75);
      return [p[0], 10 - 67 * (t * t * (3 - 2 * t)) + dy, p[1]];
    };
  const cuts = [...new Set([0.25, ...Array.from({ length: n + 1 }, (_, i) => i / n)])].sort(
    (a, b) => a - b,
  );
  for (let j = 1; j < cuts.length; j++) {
    const [a, b] = cuts.slice(j - 1, j + 1);
    Q(o, c, [P(0, a), P(1, a), P(1, b), P(0, b)], 'wall', C.wall, [0, 1, 0]);
    if (c !== cfg.skyline)
      Q(o, c, [P(0, a, -2), P(1, a, -2), P(1, b, -2), P(0, b, -2)], 'base', C.base, [0, -1, 0]);
    for (const u of [0, 1]) {
      Q(o, c, [P(u, a, -3), P(u, b, -3), P(u, b, 7), P(u, a, 7)], 'wall', C.wall);
      if (c.detail) beam(adapter(o, c), 'base', P(u, a, 7), P(u, b, 7), 1.4, 0.55, C.base);
    }
    if (a < 0.25)
      for (let k = 1; k < 5; k++) {
        const rise = (t) => 6 * (1 - t / 0.25);
        Q(
          o,
          c,
          [P(k / 5, a), P(k / 5, b), P(k / 5, b, rise(b) + 0.2), P(k / 5, a, rise(a) + 0.2)],
          'base',
          C.base,
        );
      }
  }
  for (let i = 0; i <= 5; i++) {
    const p = P(i / 5, 0),
      h = [p[0] + s.flow[0] * 9, 0, p[2] + s.flow[1] * 9];
    beam(adapter(o, c), 'wall', [p[0], -5, p[2]], [p[0], 28.5, p[2]], 4.2, 9, C.wall);
    if (c.detail) {
      beam(adapter(o, c), 'wall', [h[0], 13, h[2]], [h[0], 33, h[2]], 3.5, 5, C.wall);
      box(o, c, h[0] - 2.1, h[0] + 2.1, 32, 34.8, h[2] - 2.1, h[2] + 2.1, 'wall');
    }
  }
  for (let i = 0; i < 5; i++)
    beam(adapter(o, c), 'dark', P((i + 0.1) / 5, 0, 10), P((i + 0.9) / 5, 0, 10), 1.5, 18, C.dark);
  const rows = s.bridge.map((p, i) => {
    const q = controls.stations.find((t) => t.p[0] === p[0] && t.p[1] === p[1]),
      N = section(q.s).N;
    return [-5, 5].map((d) => side(p, N, d, 30));
  });
  for (let j = 1; j < rows.length; j++) {
    const [a, b] = rows.slice(j - 1, j + 1),
      below = ([x, , z]) => [x, 28.5, z];
    Q(o, c, [a[0], b[0], b[1], a[1]], 'paving', C.paving, [0, 1, 0]);
    Q(o, c, [below(a[0]), below(b[0]), below(b[1]), below(a[1])], 'base', C.base, [0, -1, 0]);
    for (let k = 0; k < 2; k++) {
      Q(o, c, [a[k], b[k], below(b[k]), below(a[k])], 'base', C.base);
      if (c.fine)
        beam(
          adapter(o, c),
          'dark',
          [a[k][0], 31.1, a[k][2]],
          [b[k][0], 31.1, b[k][2]],
          0.15,
          0.15,
          C.dark,
        );
    }
  }
  const floor = -57;
  Q(
    o,
    c,
    [pt(s.end[0], floor), pt(s.end[1], floor), pt(s.basin[1], floor), pt(s.basin[0], floor)],
    'wall',
    C.wall,
    [0, 1, 0],
  );
  for (let i = 0; i < 2; i++)
    beam(adapter(o, c), 'wall', pt(s.end[i], -53.5), pt(s.basin[i], -53.5), 2.5, 9, C.wall);
}
export function buildDamLevel(o, level = 'master', mark = () => {}) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Mosul tier ' + level);
  levee(o, c, 0, controls.gap[0]);
  levee(o, c, controls.gap[1], controls.length);
  mark('whole-bent-barrier-and-crest-with-open-spillway-gap');
  for (const p of controls.tankPlinths) solid(o, c, p, -58, -35, 'base');
  for (const p of controls.tanks) tank(o, c, p);
  mark('four-native-surge-cylinders');
  for (const p of controls.powerhouse) building(o, c, p, -37, 15, 4);
  for (const p of controls.outletHouse) building(o, c, p, -39, 9, 2);
  mark('main-powerhouse-and-small-outlet');
  spillway(o, c);
  mark('five-gate-service-spillway-and-open-basin');
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

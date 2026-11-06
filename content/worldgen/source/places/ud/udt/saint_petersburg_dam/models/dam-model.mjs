/** Saint Petersburg flood barrier in its signed sea-level map frame. */
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('908d86'),
  wall: lin('bcb5a6'),
  base: lin('a2a495'),
  gravel: lin('87916b'),
  roof: lin('757c80'),
  metal: lin('b4babd'),
  dark: lin('4c5458'),
  glass: lin('526d76'),
  paving: lin('95968c'),
  trim: lin('9a5141'),
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
  skyline: { tol: 8, section: 3, sides: 5, arc: 3 },
  district: { tol: 7, section: 5, sides: 8, arc: 6, detail: true },
  street: { tol: 4, section: 7, sides: 10, arc: 10, detail: true, fine: true },
  closeup: { tol: 1.2, section: 7, sides: 14, arc: 18, detail: true, fine: true, near: true },
  master: {
    tol: 0.3,
    section: 7,
    sides: 20,
    arc: 30,
    detail: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const controls = {
  anchor: [29.74833, 60.00639],
  heading: 0.78,
  stations: [
    {
      x: -9040.6091,
      z: 2871.3176,
      s: 0,
    },
    {
      x: -9025.5,
      z: 2861.0823,
      s: 18.249555306910537,
    },
    {
      x: -8943,
      z: 2803.9556,
      s: 118.59749924643542,
    },
    {
      x: -8936,
      z: 2799.191,
      s: 127.06516794330824,
    },
    {
      x: -8884.5,
      z: 2764.6064,
      s: 189.10019480039904,
    },
    {
      x: -8874,
      z: 2757.9469,
      s: 201.53397701861417,
    },
    {
      x: -8820,
      z: 2721.2284,
      s: 266.83518866319235,
    },
    {
      x: -8809.5,
      z: 2714.0887,
      s: 279.53264179718747,
    },
    {
      x: -8421,
      z: 2449.9194,
      s: 749.3386326726655,
    },
    {
      x: -8412,
      z: 2443.8089,
      s: 760.2169694136385,
    },
    {
      x: -8159.5,
      z: 2272.2635,
      s: 1065.4776355027368,
    },
    {
      x: -8150.5,
      z: 2266.1622,
      s: 1076.3508071508807,
    },
    {
      x: -6817.5,
      z: 1364.0642,
      s: 2685.9065848746604,
    },
    {
      x: -6806.5,
      z: 1356.5659,
      s: 2699.2191542318506,
    },
    {
      x: -6753,
      z: 1320.391,
      s: 2763.801453587092,
    },
    {
      x: -6742,
      z: 1312.9532,
      s: 2777.0800404411216,
    },
    {
      x: -6203,
      z: 948.4999,
      s: 3427.7314124375926,
    },
    {
      x: -6193.5,
      z: 942.0719,
      s: 3439.201773547863,
    },
    {
      x: -5988,
      z: 802.2376,
      s: 3687.765410181402,
    },
    {
      x: -5979,
      z: 796.1773,
      s: 3698.6156284322024,
    },
    {
      x: -5806.5,
      z: 680.4558,
      s: 3906.3359104516767,
    },
    {
      x: -4750,
      z: -35.1372,
      s: 5182.371016414283,
    },
    {
      x: -4739,
      z: -42.331,
      s: 5195.514484694763,
    },
    {
      x: -4685.5,
      z: -78.5122,
      s: 5260.10031312051,
    },
    {
      x: -4675,
      z: -85.6132,
      s: 5272.776045880394,
    },
    {
      x: -4477,
      z: -219.5168,
      s: 5511.803605155386,
    },
    {
      x: -4469,
      z: -224.8314,
      s: 5521.408029821133,
    },
    {
      x: -4429.5,
      z: -249.7043,
      s: 5568.086838229339,
    },
    {
      x: -4317.5,
      z: -318.1431,
      s: 5699.341816593743,
    },
    {
      x: -4314,
      z: -320.1192,
      s: 5703.361141314389,
    },
    {
      x: -4245.5,
      z: -357.8614,
      s: 5781.570627061579,
    },
    {
      x: -4148.5,
      z: -409.3515,
      s: 5891.389707361907,
    },
    {
      x: -4017.5,
      z: -474.8184,
      s: 6037.837360110629,
    },
    {
      x: -4007.5,
      z: -479.725,
      s: 6048.9762435178645,
    },
    {
      x: -3851.5,
      z: -559.3561,
      s: 6224.125071910206,
    },
    {
      x: -3844.5,
      z: -562.7836,
      s: 6231.919156606307,
    },
    {
      x: -3807.5,
      z: -580.7796,
      s: 6273.063488123541,
    },
    {
      x: -3048,
      z: -961.4742,
      s: 7122.633160645553,
    },
    {
      x: -2752.5,
      z: -1110.4056,
      s: 7453.542229584378,
    },
    {
      x: -2718.5,
      z: -1127.6254,
      s: 7491.654189807385,
    },
    {
      x: -2554.5,
      z: -1209.3968,
      s: 7674.909645000293,
    },
    {
      x: -2527.5,
      z: -1223.2352,
      s: 7705.249409576834,
    },
    {
      x: -2491,
      z: -1240.8255,
      s: 7745.766920039472,
    },
    {
      x: -2477,
      z: -1247.6063,
      s: 7761.322602237306,
    },
    {
      x: -2455.5,
      z: -1257.5116,
      s: 7784.994631472037,
    },
    {
      x: -2416,
      z: -1275.7097,
      s: 7828.485099894555,
    },
    {
      x: -2404.5,
      z: -1281.0079,
      s: 7841.146889785404,
    },
    {
      x: -2402,
      z: -1282.1597,
      s: 7843.899460082417,
    },
    {
      x: -2395.5,
      z: -1285.0449,
      s: 7851.011026649637,
    },
    {
      x: -2288,
      z: -1329.3109,
      s: 7967.268193121214,
    },
    {
      x: -2287,
      z: -1329.7016,
      s: 7968.34180687392,
    },
    {
      x: -2224.5,
      z: -1353.1018,
      s: 8035.078748368418,
    },
    {
      x: -2208,
      z: -1358.6483,
      s: 8052.486035987401,
    },
    {
      x: -2188,
      z: -1364.8002,
      s: 8073.410802977979,
    },
    {
      x: -2085,
      z: -1394.1705,
      s: 8180.516426182786,
    },
    {
      x: -2011,
      z: -1411.625,
      s: 8256.547075070257,
    },
    {
      x: -1867,
      z: -1442.2061,
      s: 8403.758500160873,
    },
    {
      x: -1849.5,
      z: -1445.9225,
      s: 8421.64876647974,
    },
    {
      x: -1768,
      z: -1462.7477,
      s: 8504.867378310508,
    },
    {
      x: -1767.5,
      z: -1462.8541,
      s: 8505.378573928643,
    },
    {
      x: -1730.5,
      z: -1470.879,
      s: 8543.238830399116,
    },
    {
      x: -1713.5,
      z: -1474.5661,
      s: 8560.634079934836,
    },
    {
      x: -1613,
      z: -1497.1336,
      s: 8663.636711242245,
    },
    {
      x: -1610,
      z: -1497.8262,
      s: 8666.715622536842,
    },
    {
      x: -1192,
      z: -1596.0743,
      s: 9096.106690391787,
    },
    {
      x: -1171,
      z: -1601.4771,
      s: 9117.790561075777,
    },
    {
      x: -1168.5,
      z: -1602.1039,
      s: 9120.367939247486,
    },
    {
      x: -910.5,
      z: -1659.7491,
      s: 9384.729375699628,
    },
    {
      x: -887,
      z: -1665.369,
      s: 9408.892017856684,
    },
    {
      x: -664,
      z: -1721.0117,
      s: 9638.729155985598,
    },
    {
      x: -622.5,
      z: -1730.8601,
      s: 9681.381717251717,
    },
    {
      x: -536.5,
      z: -1746.8918,
      s: 9768.863231898471,
    },
    {
      x: -535,
      z: -1747.1547,
      s: 9770.386096439393,
    },
    {
      x: -509.5,
      z: -1753.526,
      s: 9796.669997666,
    },
    {
      x: -441,
      z: -1766.7405,
      s: 9866.432975026846,
    },
    {
      x: -394,
      z: -1777.0825,
      s: 9914.557365558052,
    },
    {
      x: -390.5,
      z: -1777.7236,
      s: 9918.115596749249,
    },
    {
      x: -342.5,
      z: -1783.5056,
      s: 9966.462587596663,
    },
    {
      x: -241,
      z: -1794.1781,
      s: 10068.522140095438,
    },
    {
      x: -207,
      z: -1796.9745,
      s: 10102.636944110118,
    },
    {
      x: -204.5,
      z: -1797.0949,
      s: 10105.139841662954,
    },
    {
      x: -160.5,
      z: -1797.4214,
      s: 10149.141053035484,
    },
    {
      x: -113,
      z: -1796.7116,
      s: 10196.646356066198,
    },
    {
      x: -112.5,
      z: -1796.6924,
      s: 10197.146724570403,
    },
    {
      x: -65,
      z: -1794.6403,
      s: 10244.691031426324,
    },
    {
      x: -7,
      z: -1788.7202,
      s: 10302.992382903027,
    },
    {
      x: 55,
      z: -1780.345,
      s: 10365.555502830344,
    },
    {
      x: 144,
      z: -1765.8508,
      s: 10455.72801434932,
    },
    {
      x: 145,
      z: -1765.6466,
      s: 10456.74865024914,
    },
    {
      x: 241.5,
      z: -1740.8751,
      s: 10556.3773469798,
    },
    {
      x: 250.5,
      z: -1738.4557,
      s: 10565.69686930447,
    },
    {
      x: 314,
      z: -1720.4075,
      s: 10631.71192458158,
    },
    {
      x: 318.5,
      z: -1718.9456,
      s: 10636.443430854428,
    },
    {
      x: 415.5,
      z: -1682.0247,
      s: 10740.232413202315,
    },
    {
      x: 418,
      z: -1680.9573,
      s: 10742.95074775862,
    },
    {
      x: 533,
      z: -1626.9634,
      s: 10869.995390452477,
    },
    {
      x: 538.5,
      z: -1623.9893,
      s: 10876.248011567657,
    },
    {
      x: 663.5,
      z: -1549.4067,
      s: 11021.807498454496,
    },
    {
      x: 668.5,
      z: -1546.0115,
      s: 11027.851287252925,
    },
    {
      x: 713.5,
      z: -1511.8475,
      s: 11084.350658010482,
    },
    {
      x: 792,
      z: -1452.2496,
      s: 11182.911094720199,
    },
    {
      x: 813,
      z: -1436.303,
      s: 11209.279523789068,
    },
    {
      x: 821.5,
      z: -1429.2643,
      s: 11220.315523865635,
    },
    {
      x: 1112,
      z: -1166.7789,
      s: 11611.836704918665,
    },
    {
      x: 1209,
      z: -1078.4688,
      s: 11743.014728085696,
    },
    {
      x: 1221,
      z: -1067.5438,
      s: 11759.242963510413,
    },
    {
      x: 1265.5,
      z: -1026.7628,
      s: 11819.603049337058,
    },
    {
      x: 1277.5,
      z: -1015.8843,
      s: 11835.800017023943,
    },
    {
      x: 1684.5,
      z: -644.378,
      s: 12386.858934871834,
    },
    {
      x: 1857.5,
      z: -486.6141,
      s: 12620.99233305161,
    },
    {
      x: 2110,
      z: -255.6541,
      s: 12963.18931082903,
    },
    {
      x: 2355.5,
      z: -31.097,
      s: 13295.899606973302,
    },
    {
      x: 2365,
      z: -22.4523,
      s: 13308.744093653975,
    },
    {
      x: 2554,
      z: 148.9206,
      s: 13563.870867737782,
    },
    {
      x: 2563.5,
      z: 157.6251,
      s: 13576.755677408475,
    },
    {
      x: 2721.5,
      z: 302.4383,
      s: 13791.079877848462,
    },
    {
      x: 2731.5,
      z: 310.7941,
      s: 13804.111354880633,
    },
    {
      x: 2922.5,
      z: 456.5158,
      s: 14044.352512576166,
    },
    {
      x: 2930.5,
      z: 462.2847,
      s: 14054.215585485255,
    },
    {
      x: 3047.5,
      z: 541.5819,
      s: 14195.555763523349,
    },
    {
      x: 3059.5,
      z: 549.7146,
      s: 14210.051997837474,
    },
    {
      x: 3112,
      z: 585.2952,
      s: 14273.473044000084,
    },
    {
      x: 3124,
      z: 593.4468,
      s: 14287.979890058412,
    },
    {
      x: 4001,
      z: 1186.9214,
      s: 15346.913835517316,
    },
    {
      x: 4037,
      z: 1211.0906,
      s: 15390.274534642676,
    },
    {
      x: 4456.5,
      z: 1495.0587,
      s: 15896.84943711773,
    },
    {
      x: 4465,
      z: 1500.863,
      s: 15907.142148057515,
    },
    {
      x: 5107,
      z: 1937.4169,
      s: 16683.50759525697,
    },
    {
      x: 5118,
      z: 1944.8968,
      s: 16696.80980950912,
    },
    {
      x: 5171.5,
      z: 1981.2763,
      s: 16761.506934794947,
    },
    {
      x: 5182.5,
      z: 1988.8937,
      s: 16774.886949098378,
    },
    {
      x: 5346.5,
      z: 2100.3548,
      s: 16973.178594946632,
    },
    {
      x: 5355.5,
      z: 2106.4519,
      s: 16984.049410390286,
    },
    {
      x: 6281.5,
      z: 2733.3365,
      s: 18102.2892333787,
    },
    {
      x: 6291,
      z: 2739.7668,
      s: 18113.76088356906,
    },
    {
      x: 6496.5,
      z: 2878.765,
      s: 18361.855118897573,
    },
    {
      x: 6505.5,
      z: 2884.8559,
      s: 18372.722458167606,
    },
    {
      x: 7167,
      z: 3333.2561,
      s: 19171.87512778715,
    },
    {
      x: 7178,
      z: 3340.7125,
      s: 19185.164142083177,
    },
    {
      x: 7231,
      z: 3376.3228,
      s: 19249.01626394369,
    },
    {
      x: 7242,
      z: 3383.8083,
      s: 19262.321627909023,
    },
    {
      x: 8179,
      z: 4018.6659,
      s: 20394.140152354423,
    },
    {
      x: 8187.5,
      z: 4024.4336,
      s: 20404.41226816812,
    },
    {
      x: 8398.5,
      z: 4167.818,
      s: 20659.520257387117,
    },
    {
      x: 8407,
      z: 4173.597,
      s: 20669.798722301686,
    },
    {
      x: 9224.5,
      z: 4729.968,
      s: 21658.664203366225,
    },
    {
      x: 9235.5,
      z: 4737.4543,
      s: 21671.970017422118,
    },
    {
      x: 9289,
      z: 4773.8652,
      s: 21736.684804285786,
    },
    {
      x: 9300,
      z: 4781.5707,
      s: 21750.11517026181,
    },
    {
      x: 9830,
      z: 5142.0116,
      s: 22391.06574744605,
    },
    {
      x: 10332,
      z: 5482.2697,
      s: 22997.51407551334,
    },
    {
      x: 10340.5,
      z: 5488.0042,
      s: 23007.76758663149,
    },
    {
      x: 10599.5,
      z: 5662.0538,
      s: 23319.816081676985,
    },
    {
      x: 10607.5,
      z: 5667.5137,
      s: 23329.501664158695,
    },
    {
      x: 11228,
      z: 6093.0158,
      s: 24081.87941974721,
    },
    {
      x: 11278,
      z: 6128.05,
      s: 24142.931816666904,
    },
    {
      x: 11293.5,
      z: 6138.9109,
      s: 24161.85823071738,
    },
    {
      x: 11342,
      z: 6173.0022,
      s: 24221.14116869864,
    },
    {
      x: 11356.5,
      z: 6183.0467,
      s: 24238.780385808535,
    },
    {
      x: 11392,
      z: 6208.0147,
      s: 24282.18143445946,
    },
    {
      x: 11417,
      z: 6226.9482,
      s: 24313.54187805087,
    },
    {
      x: 11480.8661,
      z: 6278.0459,
      s: 24395.33340373966,
    },
  ],
  length: 24395.33340373966,
  crossings: [
    {
      id: 'B1',
      type: 'sluice',
      record: 7,
      bays: 12,
      depth: 2.5,
      bridgeOrTunnelExtents: [-8420.758630321909, -8150.585417349199],
      center: [-8285.672, 2357.9833],
      coordinate: [29.67228055109994, 59.938985228483624],
      featureIds: [35184444100810],
      middle: 912.9416008025631,
      a: 749.6329834599503,
      b: 1076.250218145176,
      measuredSpan: 326.6172346852255,
      clearWidth: 24,
    },
    {
      id: 'B2',
      type: 'sluice',
      record: 6,
      bays: 10,
      depth: 5,
      bridgeOrTunnelExtents: [-6202.874303789364, -5979.174748875117],
      center: [-6091.0245, 872.3412],
      coordinate: [29.68154187058355, 59.96233795388833],
      featureIds: [35184452979060],
      middle: 3563.151568904749,
      a: 3427.8906809715363,
      b: 3698.412456837962,
      measuredSpan: 270.5217758664262,
      clearWidth: 24,
    },
    {
      id: 'S1',
      type: 'navigation-tunnel',
      record: 4,
      span: 273,
      clear: 200,
      depth: 16,
      bridgeOrTunnelExtents: [-3844.466558244031, -2718.520069362695],
      center: [-3281.4933, -844.4361],
      coordinate: [29.695737268857222, 59.991051395461895],
      featureIds: [35184418144580],
      middle: 6861.449715725101,
      a: 6231.95634413858,
      b: 7491.631693255834,
      measuredSpan: 1259.675349117254,
    },
    {
      id: 'B3',
      type: 'sluice',
      record: 15,
      bays: 10,
      depth: 2.5,
      bridgeOrTunnelExtents: [2355.5616346555225, 2563.337960970973],
      center: [2459.4498, 63.189],
      coordinate: [29.780547935608478, 60.02152444320794],
      featureIds: [35185077023530],
      middle: 13436.239716864879,
      a: 13295.963234676774,
      b: 13576.516199052983,
      measuredSpan: 280.5529643762093,
      clearWidth: 24,
    },
    {
      id: 'S2',
      type: 'navigation-lift',
      record: 17,
      span: 133.8,
      clear: 110,
      deck: 16,
      bridgeOrTunnelExtents: [4456.416967970275, 5182.536387230392],
      center: [4819.4767, 1741.9038],
      coordinate: [29.831912398368125, 60.02571362217764],
      featureIds: [35184962348290],
      middle: 16335.807976277589,
      a: 15896.749170270625,
      b: 16774.93094473132,
      measuredSpan: 878.181774460696,
    },
    {
      id: 'B4',
      type: 'sluice',
      record: 20,
      bays: 10,
      depth: 5,
      bridgeOrTunnelExtents: [6281.697160359758, 6505.293484068598],
      center: [6393.4953, 2809.0936],
      coordinate: [29.865507323351054, 60.028842411286256],
      featureIds: [35184962348290],
      middle: 18237.500509254052,
      a: 18102.527618729033,
      b: 18372.47339977907,
      measuredSpan: 269.94578105003893,
      clearWidth: 24,
    },
    {
      id: 'B5',
      type: 'sluice',
      record: 22,
      bays: 10,
      depth: 5,
      bridgeOrTunnelExtents: [8178.956275850076, 8407.21157032182],
      center: [8293.0839, 4096.1827],
      coordinate: [29.906040429059544, 60.032623712283154],
      featureIds: [35185077023550],
      middle: 20532.067701452004,
      a: 20394.084048906778,
      b: 20670.05135399723,
      measuredSpan: 275.967305090453,
      clearWidth: 24,
    },
    {
      id: 'B6',
      type: 'sluice',
      record: 24,
      bays: 12,
      depth: 2.5,
      bridgeOrTunnelExtents: [10332.105000310074, 10607.379384022444],
      center: [10469.7422, 5574.8554],
      coordinate: [29.952534278783357, 60.036931947443826],
      featureIds: [35185077023530],
      middle: 23163.481231443726,
      a: 22997.62378256787,
      b: 23329.338680319583,
      measuredSpan: 331.7148977517136,
      clearWidth: 24,
    },
  ],
  runs: [
    [0, 749.6329834599503],
    [1076.250218145176, 3427.8906809715363],
    [3698.412456837962, 6231.95634413858],
    [7491.631693255834, 7527.18138315167],
    [11690.684560891546, 13295.963234676774],
    [13576.516199052983, 15896.749170270625],
    [16774.93094473132, 18102.527618729033],
    [18372.47339977907, 20394.084048906778],
    [20670.05135399723, 22997.62378256787],
    [23329.338680319583, 24395.33340373966],
  ],
  kotlin: [7527.18138315167, 11690.684560891546],
  deck: 6.5,
  foundation: -8,
  scope:
    'Both maritime arms of the Saint Petersburg flood barrier, the six raised-gate sluice bridges, S-1 open navigation passage with parked sector gates and tunnel approaches, and the S-2 lift bridge and approach decks.',
  limitations:
    'The named A-118 carriageways and current PMTiles place the corridor and crossings. Official span and gate counts control the architecture. Width profiles and precise wall, gate housing and deck grades are visual estimates. Native Kotlin terrain and roads connect the two arms. Gates are static in the normal open position.',
  official: {
    length: 25400,
    embankmentSections: 11,
    sluices: 6,
    sluiceBays: 64,
    navigationPassages: 2,
    lanes: 6,
  },
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
const openRing = (r) =>
  r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.00001
    ? r.slice(0, -1)
    : r;
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
const { stations, deck, foundation } = controls;
const lerp = (a, b, t) => a + (b - a) * t;
export function station(s) {
  const i = stations.findIndex((p) => p.s >= s);
  const k = Math.max(1, i < 0 ? stations.length - 1 : i);
  const a = stations[k - 1],
    b = stations[k],
    t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
  const t0 = stations[Math.max(0, k - 2)],
    t1 = stations[Math.min(stations.length - 1, k + 1)];
  const dx = t1.x - t0.x,
    dz = t1.z - t0.z,
    L = Math.hypot(dx, dz);
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), nx: -dz / L, nz: dx / L };
}
const at = (s, d, y) => {
  const p = station(s);
  return [p.x + p.nx * d, y, p.z + p.nz * d];
};
const xz = ([x, , z]) => [x, z];
const crossRing = (a, b, left, right) =>
  [at(a, left, 0), at(b, left, 0), at(b, right, 0), at(a, right, 0)].map(xz);
function prism(o, c, a, b, d0, d1, y0, y1, slot) {
  solid(o, c, [crossRing(a, b, d0, d1)], y0, y1, slot);
}
function compact(points, tolerance) {
  if (points.length <= 2) return points;
  const p = points[0],
    q = points.at(-1),
    dx = q.x - p.x,
    dz = q.z - p.z,
    L = Math.hypot(dx, dz);
  let m = 0,
    index = 0;
  for (let j = 1; j < points.length - 1; j++) {
    const w = points[j],
      d = Math.abs(dx * (w.z - p.z) - dz * (w.x - p.x)) / L;
    if (d > m) {
      m = d;
      index = j;
    }
  }
  if (m <= tolerance) return [p, q];
  return [
    ...compact(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...compact(points.slice(index), tolerance),
  ];
}
function lineSamples(a, b, tol) {
  const ends = [
    { ...station(a), s: a },
    { ...station(b), s: b },
  ];
  return compact([ends[0], ...stations.filter((p) => p.s > a && p.s < b), ends[1]], tol).map(
    (p) => p.s,
  );
}
export function bankWidth(s) {
  const end = Math.min(s, controls.length - s),
    t = Math.min(1, Math.max(0, end / 380));
  // The Gulf-facing toe is wider than the Neva-facing toe.
  return [lerp(23, 63, t), lerp(23, 48, t)];
}
function roadMark(o, c, a, b, d, w) {
  Q(
    o,
    c,
    [
      at(a, d - w, deck + 0.035),
      at(b, d - w, deck + 0.035),
      at(b, d + w, deck + 0.035),
      at(a, d + w, deck + 0.035),
    ],
    'wall',
    C.wall,
    [0, 1, 0],
  );
}
function bank(o, c, a, b) {
  const cuts = lineSamples(a, b, c.tol);
  const sections = cuts.map((s) => {
    const [outer, inner] = bankWidth(s);
    const profile =
      c.section === 3
        ? [
            [-outer, -1.2],
            [-16, deck],
            [16, deck],
            [inner, -1.2],
          ]
        : c.section === 5
          ? [
              [-outer, -1.2],
              [-lerp(16, outer, 0.24), 4],
              [-16, deck],
              [16, deck],
              [lerp(16, inner, 0.28), 3.8],
              [inner, -1.2],
            ]
          : [
              [-outer, -1.2],
              [-lerp(16, outer, 0.51), 1.1],
              [-lerp(16, outer, 0.24), 4.2],
              [-16, deck],
              [16, deck],
              [lerp(16, inner, 0.28), 4.5],
              [lerp(16, inner, 0.61), 1.4],
              [inner, -1.2],
            ];
    return profile.map(([d, y]) => at(s, d, y));
  });
  for (let j = 1; j < sections.length; j++) {
    const [p, q] = sections.slice(j - 1, j + 1),
      road = (p.length - 1) / 2;
    for (let k = 1; k < p.length; k++) {
      const s =
        k === Math.ceil(road) ? 'paving' : k === 1 || k === p.length - 1 ? 'stone' : 'gravel';
      Q(o, c, [p[k - 1], q[k - 1], q[k], p[k]], s, C[s], [0, 1, 0]);
    }
    if (c !== cfg.skyline)
      for (const k of [0, p.length - 1]) {
        const A = p[k],
          B = q[k],
          N = station((cuts[j] + cuts[j - 1]) / 2),
          sign = k ? 1 : -1;
        Q(o, c, [A, B, [B[0], foundation, B[2]], [A[0], foundation, A[2]]], 'stone', C.stone, [
          N.nx * sign,
          0,
          N.nz * sign,
        ]);
      }
    if (c.fine)
      for (const d of [-15.7, 0, 15.7]) {
        beam(
          adapter(o, c),
          'metal',
          at(cuts[j - 1], d, deck + 0.8),
          at(cuts[j], d, deck + 0.8),
          0.15,
          0.16,
          C.metal,
        );
      }
  }
  if (c.detail)
    for (const [s, end] of [
      [a, sections[0]],
      [b, sections.at(-1)],
    ]) {
      const n = station(s),
        sgn = s === a ? -1 : 1;
      for (let k = 1; k < end.length; k++) {
        const p = end[k - 1],
          q = end[k];
        Q(o, c, [p, q, [q[0], foundation, q[2]], [p[0], foundation, p[2]]], 'base', C.base, [
          n.nz * sgn,
          0,
          -n.nx * sgn,
        ]);
      }
    }
  if (c.fine) {
    const stride = c.master ? 43 : c.near ? 92 : 180;
    for (let s = a + stride; s < b - 8; s += stride) {
      beam(adapter(o, c), 'metal', at(s, 0, deck), at(s, 0, deck + 10), 0.19, 0.19, C.metal);
      for (const sign of [-1, 1])
        beam(
          adapter(o, c),
          'metal',
          at(s, 0, deck + 10),
          at(s + 1.2, sign * 2.15, deck + 10),
          0.19,
          0.18,
          C.metal,
        );
    }
    for (let i = 1; i < cuts.length; i++)
      for (const d of [-13.2, -1.1, 1.1, 13.2]) roadMark(o, c, cuts[i - 1], cuts[i], d, 0.09);
    if (c.near)
      for (let s = a + 8; s < b - 9; s += c.master ? 17 : 34)
        for (const d of [-9, -5.2, 5.2, 9]) roadMark(o, c, s, s + 5.5, d, 0.085);
  }
}
function roadDeck(o, c, cuts, heights, width = 16) {
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i],
      A = heights[i - 1],
      B = heights[i];
    Q(
      o,
      c,
      [at(a, -width, A), at(b, -width, B), at(b, width, B), at(a, width, A)],
      'paving',
      C.paving,
      [0, 1, 0],
    );
    if (c !== cfg.skyline) {
      Q(
        o,
        c,
        [
          at(a, -width, A - 1.8),
          at(b, -width, B - 1.8),
          at(b, width, B - 1.8),
          at(a, width, A - 1.8),
        ],
        'base',
        C.base,
        [0, -1, 0],
      );
      for (const d of [-width, width]) {
        const n = station((a + b) / 2),
          sgn = Math.sign(d);
        Q(o, c, [at(a, d, A), at(b, d, B), at(b, d, B - 1.8), at(a, d, A - 1.8)], 'base', C.base, [
          n.nx * sgn,
          0,
          n.nz * sgn,
        ]);
        if (c.fine)
          beam(adapter(o, c), 'metal', at(a, d, A + 0.75), at(b, d, B + 0.75), 0.21, 0.19, C.metal);
      }
      if (c.fine)
        beam(adapter(o, c), 'base', at(a, 0, A + 0.4), at(b, 0, B + 0.4), 0.45, 0.6, C.base);
    }
  }
}
function sluice(o, c, q) {
  const { a, b, bays, depth } = q,
    cell = (b - a) / bays;
  roadDeck(o, c, [a, b], [deck, deck]);
  for (let i = 0; i <= bays; i++) {
    const s = a + i * cell,
      r = i === 0 || i === bays ? 1.3 : Math.max(0.78, (cell - q.clearWidth) * 0.5);
    if (c === cfg.skyline) {
      for (const sign of [-1, 1]) {
        Q(
          o,
          c,
          [
            at(s - r, sign * 17, -depth),
            at(s + r, sign * 17, -depth),
            at(s + r, sign * 17, deck),
            at(s - r, sign * 17, deck),
          ],
          'wall',
          C.wall,
          [station(s).nx * sign, 0, station(s).nz * sign],
        );
      }
    } else {
      prism(o, c, s - r, s + r, -23, 23, -depth - 1, deck - 0.7, 'wall');
      if (c.fine)
        prism(o, c, s - r - 0.35, s + r + 0.35, -24, 24, deck - 1.25, deck - 0.75, 'base');
    }
    if (i < bays && c.detail) {
      const g0 = s + r,
        g1 = s + cell - r;
      // The parked gate sits above the water opening.
      prism(o, c, g0, g1, -23.2, -20.9, 3.0, 5.5, 'dark');
      if (c.fine)
        for (const t of [0.22, 0.5, 0.78]) {
          const n = lerp(g0, g1, t);
          beam(adapter(o, c), 'metal', at(n, -23.6, 3.1), at(n, -23.6, 5.45), 0.28, 0.28, C.metal);
        }
    }
  }
  if (c.detail)
    for (const d of [-25, 25]) prism(o, c, a, b, d - 1, d + 1, -depth - 1, -depth - 0.1, 'base');
}

function tunnelPortal(o, c, s, sign) {
  const near = s - sign * 145,
    back = s - sign * 75;
  const cuts = sign < 0 ? [s, back, near] : [near, back, s];
  const ys = sign < 0 ? [6.5, 0.5, -5.4] : [-5.4, 0.5, 6.5];
  roadDeck(o, c, cuts, ys, 13);
  for (const d of [-16, 0, 16]) {
    const a = Math.min(near, s),
      b = Math.max(near, s);
    prism(o, c, a, b, d - 0.65, d + 0.65, -7, 6.35, 'wall');
  }
  const a = Math.min(near, near - sign * 11),
    b = Math.max(near, near - sign * 11);
  prism(o, c, a, b, -17, 17, -0.1, 6.5, 'base');
  if (c.detail)
    for (const d of [-11, 11]) {
      const face = near + sign * 0.04;
      Q(
        o,
        c,
        [
          at(face, d - 5, -5.35),
          at(face, d + 5, -5.35),
          at(face, d + 5, -0.15),
          at(face, d - 5, -0.15),
        ],
        'dark',
        C.dark,
        [station(s).nz * sign, 0, -station(s).nx * sign],
      );
    }
}
function s1Navigation(o, c, q) {
  const half = q.span / 2;
  for (const sign of [-1, 1]) {
    const shore = q.middle + sign * half,
      outer = shore + sign * 215,
      back = shore + sign * 350;
    const L = Math.min(shore, outer),
      R = Math.max(shore, outer);
    const ring = [
      at(shore, -49, 0),
      at(shore, 49, 0),
      at(outer, 94, 0),
      at(back, 46, 0),
      at(back, -55, 0),
      at(outer, -85, 0),
    ].map(xz);
    solid(o, c, [ring], -12, 4.1, 'base');
    const seat = shore + sign * 64;
    const swing = [at(seat, -36, 5), at(seat + sign * 52, 24, 5), at(seat + sign * 119, -29, 5)];
    const n = c === cfg.skyline ? 3 : c.arc;
    const arm = (i) =>
      swing[0].map(
        (v, k) => lerp(v, swing[2][k], i / n) + (k === 2 ? Math.sin((i * Math.PI) / n) * -15 : 0),
      );
    for (let i = 1; i <= n; i++) beam(adapter(o, c), 'wall', arm(i - 1), arm(i), 3.6, 4, C.wall);
    beam(adapter(o, c), 'wall', swing[0], swing[1], 3.2, 4.2, C.wall);
    beam(adapter(o, c), 'wall', swing[1], swing[2], 3.2, 4.2, C.wall);
    if (c.detail) {
      for (const t of [0.28, 0.5, 0.72]) {
        const p = swing[1].map((v, i) => lerp(v, swing[0][i], t)),
          n = swing[1].map((v, i) => lerp(v, swing[2][i], t));
        beam(adapter(o, c), 'wall', p, n, 1.9, 2.6, C.wall);
      }
      prism(o, c, Math.min(L + 27, R - 32), Math.min(L + 45, R - 12), -15, 7, 4.1, 11.2, 'wall');
      prism(o, c, Math.min(L + 27, R - 32), Math.min(L + 45, R - 12), -15, 7, 11.2, 12.0, 'roof');
      for (const d of [-63, 67]) {
        const a = Math.min(outer, back),
          b = Math.max(outer, back);
        beam(adapter(o, c), 'stone', at(a, d, 0.6), at(b, d + 8, 0.6), 5.4, 3.3, C.stone);
      }
    }
    tunnelPortal(o, c, sign < 0 ? q.a : q.b, sign);
  }
}
function s2Navigation(o, c, q) {
  const half = q.span / 2,
    L = q.middle - half,
    R = q.middle + half;
  const cuts = [q.a, L, R, q.b],
    heights = [deck, q.deck + 1.8, q.deck + 1.8, deck];
  roadDeck(o, c, cuts, heights, 17);
  for (const sign of [-1, 1]) {
    const s = q.middle + sign * (q.clear / 2 + 8.5);
    prism(o, c, s - 7, s + 7, -20, 20, -8, 16, 'wall');
    for (const d of [-16, 16]) {
      prism(o, c, s - 5.5, s + 5.5, d - 4, d + 4, 15.3, 25.4, 'wall');
      if (c.detail) prism(o, c, s - 4.3, s + 4.3, d - 4.1, d + 4.1, 21.6, 25.4, 'trim');
    }
    const near = sign < 0 ? q.a : q.b;
    if (c.detail)
      for (const t of [0.27, 0.56, 0.79]) {
        const p = lerp(s, near, t),
          y = lerp(14.9, 5.1, t);
        prism(o, c, p - 3.1, p + 3.1, -14, 14, -7, y, 'base');
      }
    const guideA = s + sign * 9,
      guideB = s + sign * 88;
    prism(o, c, Math.min(guideA, guideB), Math.max(guideA, guideB), -38, 38, -7, 3.3, 'base');
    if (c.fine)
      prism(o, c, Math.min(guideA, guideB), Math.max(guideA, guideB), -42, -38, -2, 4.4, 'wall');
  }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Saint Petersburg barrier tier ' + level);
  for (const [a, b] of controls.runs) bank(o, c, a, b);
  for (const q of controls.crossings) {
    if (q.type === 'sluice') sluice(o, c, q);
    else if (q.id === 'S1') s1Navigation(o, c, q);
    else s2Navigation(o, c, q);
  }
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

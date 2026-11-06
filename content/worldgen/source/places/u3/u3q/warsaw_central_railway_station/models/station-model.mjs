// Original photo-proportioned aboveground Warsaw Central ensemble.
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
  stone: lin('b4b3aa'),
  base: lin('a7a79f'),
  wall: lin('b0b1ab'),
  metal: lin('6e7477'),
  roof: lin('a8afb1'),
  glass: lin('71818a'),
  doorGlass: lin('71818a'),
  dark: lin('575e61'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'concrete_plain', roughness: 0.88 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.88 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.65, metallic: 0.3 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.7, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35 },
  doorGlass: { slot: 'window', graph: 'storefront', roughness: 0.4 },
};
const cfg = {
  skyline: { round: 3, z: 8 },
  district: { round: 6, z: 10, detail: true },
  street: { round: 8, z: 16, detail: true, fine: true, recess: true },
  closeup: { round: 16, z: 24, detail: true, fine: true, recess: true, near: true },
  master: { round: 40, z: 64, detail: true, fine: true, recess: true, near: true, master: true },
};
export const controls = {
  groups: {
    123: [
      [
        [
          [-37.854497, 6.605679],
          [-37.779237, -44.869188],
          [0.447731, -44.557189],
          [1.093391, -45.300877],
          [1.964492, -45.579001],
          [9.076686, -45.43083],
          [10.278608, -44.432325],
          [20.402297, -44.592927],
          [20.815174, -45.223896],
          [21.919058, -45.614738],
          [29.204002, -45.406532],
          [30.233172, -44.468059],
          [48.625626, -44.46579],
          [48.748287, -35.904282],
          [68.004501, -35.601856],
          [67.982476, -33.867012],
          [74.201544, -31.705868],
          [74.224004, -6.141355],
          [66.271368, -3.871007],
          [66.369404, -2.481655],
          [48.555224, -2.476541],
          [48.617832, 6.257779],
          [20.334442, 6.303477],
          [-37.854497, 6.605679],
        ],
      ],
    ],
    206: [
      [
        [
          [-54.738836, 1.706392],
          [-53.257853, -19.270055],
          [-54.668334, -40.283144],
          [-50.686822, -62.326591],
          [81.357297, -62.326591],
          [85.47186, -40.180487],
          [83.990966, -19.204294],
          [85.401479, 1.8087],
          [81.419944, 23.852215],
          [-50.684441, 24.025643],
          [-54.738836, 1.706392],
        ],
      ],
    ],
    216: [
      [
        [
          [39.268959, -40.940876],
          [40.080029, -41.046249],
          [40.065346, -39.889685],
          [39.314307, -39.957062],
          [39.268959, -40.940876],
        ],
      ],
    ],
    217: [
      [
        [
          [-30.458102, 2.593081],
          [-30.443415, 1.436504],
          [-29.692375, 1.503879],
          [-29.707063, 2.660456],
          [-30.458102, 2.593081],
        ],
      ],
    ],
    218: [
      [
        [
          [-30.793154, -39.343713],
          [-30.778469, -40.500282],
          [-29.967399, -40.605656],
          [-29.982084, -39.449087],
          [-30.793154, -39.343713],
        ],
      ],
    ],
    219: [
      [
        [
          [79.558577, 1.908008],
          [79.573262, 0.751439],
          [80.384332, 0.646064],
          [80.369647, 1.802633],
          [79.558577, 1.908008],
        ],
      ],
    ],
    220: [
      [
        [
          [69.494913, 1.895876],
          [69.509598, 0.739305],
          [70.260637, 0.806681],
          [70.245952, 1.963252],
          [69.494913, 1.895876],
        ],
      ],
    ],
    221: [
      [
        [
          [-20.66946, -39.504327],
          [-20.654776, -40.660896],
          [-19.903737, -40.593519],
          [-19.918421, -39.436951],
          [-20.66946, -39.504327],
        ],
      ],
    ],
    222: [
      [
        [
          [79.238111, -41.18507],
          [80.04918, -41.290442],
          [80.034498, -40.133881],
          [79.28346, -40.201258],
          [79.238111, -41.18507],
        ],
      ],
    ],
    223: [
      [
        [
          [59.558654, 0.959957],
          [60.369725, 0.854582],
          [60.355039, 2.011153],
          [59.604, 1.943777],
          [59.558654, 0.959957],
        ],
      ],
    ],
    224: [
      [
        [
          [9.17602, -39.58797],
          [9.190703, -40.744536],
          [10.001773, -40.849909],
          [10.159841, -39.633312],
          [9.17602, -39.58797],
        ],
      ],
    ],
    225: [
      [
        [
          [29.190618, -39.79646],
          [29.205301, -40.953025],
          [29.95634, -40.885648],
          [29.941656, -39.729083],
          [29.190618, -39.79646],
        ],
      ],
    ],
    226: [
      [
        [
          [-50.733044, -40.464517],
          [-49.809254, -40.33711],
          [-49.823939, -39.180539],
          [-50.574978, -39.247915],
          [-50.733044, -40.464517],
        ],
      ],
    ],
    227: [
      [
        [
          [-20.394431, 2.605193],
          [-20.379744, 1.448616],
          [-19.568672, 1.343239],
          [-19.58336, 2.499815],
          [-20.394431, 2.605193],
        ],
      ],
    ],
    228: [
      [
        [
          [19.574775, 2.360844],
          [19.589461, 1.20427],
          [20.400532, 1.098894],
          [20.385846, 2.255467],
          [19.574775, 2.360844],
        ],
      ],
    ],
    229: [
      [
        [
          [-10.503512, 2.557274],
          [-10.488825, 1.400699],
          [-9.677754, 1.295322],
          [-9.692441, 2.451897],
          [-10.503512, 2.557274],
        ],
      ],
    ],
    230: [
      [
        [
          [69.159773, -40.040666],
          [69.174456, -41.197228],
          [69.985525, -41.3026],
          [70.143595, -40.086006],
          [69.159773, -40.040666],
        ],
      ],
    ],
    231: [
      [
        [
          [-0.714889, -39.54008],
          [-0.700205, -40.696647],
          [0.110865, -40.802021],
          [0.096181, -39.645454],
          [-0.714889, -39.54008],
        ],
      ],
    ],
    232: [
      [
        [
          [29.465691, 2.312934],
          [29.480377, 1.156361],
          [30.291448, 1.050984],
          [30.276761, 2.207557],
          [29.465691, 2.312934],
        ],
      ],
    ],
    233: [
      [
        [
          [-0.379811, 2.396638],
          [-0.365124, 1.240063],
          [0.385916, 1.307438],
          [0.43126, 2.291261],
          [-0.379811, 2.396638],
        ],
      ],
    ],
    234: [
      [
        [
          [19.29971, -39.748575],
          [19.314394, -40.905141],
          [20.065433, -40.837764],
          [20.050749, -39.681199],
          [19.29971, -39.748575],
        ],
      ],
    ],
    235: [
      [
        [
          [49.494989, 0.947829],
          [50.30606, 0.842453],
          [50.464126, 2.059056],
          [49.653055, 2.164432],
          [49.494989, 0.947829],
        ],
      ],
    ],
    236: [
      [
        [
          [-40.684066, -39.295815],
          [-40.669381, -40.452385],
          [-39.918342, -40.385009],
          [-39.872995, -39.40119],
          [-40.684066, -39.295815],
        ],
      ],
    ],
    237: [
      [
        [
          [39.589389, 2.152306],
          [39.604075, 0.995734],
          [40.355114, 1.063109],
          [40.40046, 2.04693],
          [39.589389, 2.152306],
        ],
      ],
    ],
    238: [
      [
        [
          [9.511106, 2.348724],
          [9.525793, 1.192149],
          [10.276832, 1.259525],
          [10.262146, 2.416099],
          [9.511106, 2.348724],
        ],
      ],
    ],
    239: [
      [
        [
          [49.219895, -41.161506],
          [50.143686, -41.034097],
          [50.129003, -39.877533],
          [49.377964, -39.944911],
          [49.219895, -41.161506],
        ],
      ],
    ],
    240: [
      [
        [
          [59.268869, -39.992789],
          [59.283552, -41.149352],
          [60.03459, -41.081975],
          [60.079939, -40.098162],
          [59.268869, -39.992789],
        ],
      ],
    ],
    241: [
      [
        [
          [-50.472727, 2.801649],
          [-50.458039, 1.645071],
          [-49.646967, 1.539693],
          [-49.488904, 2.756303],
          [-50.472727, 2.801649],
        ],
      ],
    ],
    242: [
      [
        [
          [-10.77855, -39.552221],
          [-10.763866, -40.708788],
          [-10.012827, -40.641412],
          [-10.027511, -39.484844],
          [-10.77855, -39.552221],
        ],
      ],
    ],
    243: [
      [
        [
          [-40.349022, 2.641004],
          [-40.334334, 1.484426],
          [-39.583295, 1.551801],
          [-39.597983, 2.708379],
          [-40.349022, 2.641004],
        ],
      ],
    ],
    244: [
      [
        [
          [-22.338241, -44.730916],
          [48.625626, -44.46579],
          [48.617832, 6.257779],
          [0.439887, 6.166524],
          [-21.947917, 6.518463],
          [-22.338241, -44.730916],
        ],
      ],
    ],
    245: [
      [
        [
          [-39.819016, -34.542127],
          [-30.506391, -34.597371],
          [-30.504728, -2.844298],
          [-39.584576, -2.901756],
          [-39.819016, -34.542127],
        ],
      ],
    ],
    246: [
      [
        [
          [59.555642, -35.246473],
          [70.024833, -35.287007],
          [70.146626, -3.879629],
          [59.677427, -3.839075],
          [59.555642, -35.246473],
        ],
      ],
    ],
    247: [
      [
        [
          [-42.135294, 6.667],
          [-42.06003, -44.80788],
          [-22.338241, -44.730916],
          [-21.947917, 6.518463],
          [-42.135294, 6.667],
        ],
      ],
    ],
    248: [
      [
        [
          [48.506398, 10.478536],
          [48.737046, -48.686507],
          [74.128964, -48.768825],
          [74.243852, 10.516191],
          [48.506398, 10.478536],
        ],
      ],
    ],
    251: [
      [
        [
          [-54.738836, 1.706392],
          [-53.257853, -19.270055],
          [-54.668334, -40.283144],
          [-53.363617, -47.380625],
          [84.005184, -47.660134],
          [85.47186, -40.180487],
          [83.990966, -19.204294],
          [85.401479, 1.8087],
          [84.036731, 9.078934],
          [-53.279545, 9.764445],
          [-54.738836, 1.706392],
        ],
      ],
    ],
    363: [
      [
        [
          [-39.617315, -64.094635],
          [80.222745, -64.076119],
          [80.149341, -58.293334],
          [-39.517981, -58.251776],
          [-39.617315, -64.094635],
        ],
      ],
    ],
    364: [
      [
        [
          [-39.347824, -67.098764],
          [-39.207037, -73.632614],
          [80.227465, -73.561344],
          [80.154065, -67.778568],
          [-39.347824, -67.098764],
        ],
      ],
    ],
    394: [
      [
        [
          [0.447731, -44.557189],
          [1.093391, -45.300877],
          [1.964492, -45.579001],
          [9.076686, -45.43083],
          [10.278608, -44.432325],
          [9.933104, -44.552388],
          [0.447731, -44.557189],
        ],
      ],
    ],
    395: [
      [
        [
          [48.555224, -2.476541],
          [49.944581, -2.574573],
          [50.020588, 0.549638],
          [48.63123, 0.64767],
          [48.555224, -2.476541],
        ],
      ],
    ],
    396: [
      [
        [
          [20.334442, 6.303477],
          [30.225359, 6.255565],
          [29.81248, 6.88654],
          [28.708594, 7.277388],
          [21.881866, 7.42205],
          [20.905386, 6.889108],
          [20.334442, 6.303477],
        ],
      ],
    ],
    397: [
      [
        [
          [0.439887, 6.166524],
          [3.504076, 6.263272],
          [10.098021, 6.231328],
          [9.685142, 6.862304],
          [8.693976, 7.485937],
          [1.927279, 7.457849],
          [1.063519, 7.157691],
          [0.439887, 6.166524],
        ],
      ],
    ],
    398: [
      [
        [
          [20.402297, -44.592927],
          [20.815174, -45.223896],
          [21.919058, -45.614738],
          [28.685747, -45.586627],
          [29.722258, -45.226436],
          [30.233172, -44.468059],
          [20.402297, -44.592927],
        ],
      ],
    ],
    413: [
      [
        [
          [-54.738836, 1.706392],
          [-53.257853, -19.270055],
          [-54.668334, -40.283144],
          [-50.686822, -62.326591],
          [81.357297, -62.326591],
          [85.47186, -40.180487],
          [83.990966, -19.204294],
          [85.401479, 1.8087],
          [81.419944, 23.852215],
          [-50.684441, 24.025643],
          [-54.738836, 1.706392],
        ],
      ],
    ],
    698: [
      [
        [
          [48.748287, -35.904282],
          [48.792336, -39.373974],
          [50.527196, -39.351938],
          [50.483147, -35.882247],
          [48.748287, -35.904282],
        ],
      ],
    ],
    699: [
      [
        [
          [54.34716, -48.673083],
          [62.330451, -48.803024],
          [62.347737, -41.052593],
          [60.943698, -39.798003],
          [57.586699, -39.609294],
          [54.370485, -45.954428],
          [54.34716, -48.673083],
        ],
      ],
    ],
    700: [
      [
        [
          [53.875106, 6.729408],
          [54.639542, 1.186676],
          [60.940669, 1.440212],
          [63.531947, 2.340688],
          [63.66193, 10.32397],
          [55.333125, 10.333877],
          [55.220405, 10.101093],
          [53.891079, 10.026374],
          [53.875106, 6.729408],
        ],
      ],
    ],
  },
  columns: [
    {
      index: 216,
      centre: [39.674494, -40.467967],
      radius: 0.38931360000000037,
    },
    {
      index: 217,
      centre: [-30.075238499999998, 2.04848],
      radius: 0.36754896000000087,
    },
    {
      index: 218,
      centre: [-30.3802765, -39.9746845],
      radius: 0.3963624000000004,
    },
    {
      index: 219,
      centre: [79.9714545, 1.2770359999999998],
      radius: 0.3963624000000004,
    },
    {
      index: 220,
      centre: [69.877775, 1.3512785],
      radius: 0.3675475200000028,
    },
    {
      index: 221,
      centre: [-20.2865985, -40.0489235],
      radius: 0.3675470400000006,
    },
    {
      index: 222,
      centre: [79.6436455, -40.7121615],
      radius: 0.3893131200000016,
    },
    {
      index: 223,
      centre: [59.9641895, 1.4328675],
      radius: 0.3893140800000026,
    },
    {
      index: 224,
      centre: [9.6679305, -40.2189395],
      radius: 0.47223408000000033,
    },
    {
      index: 225,
      centre: [29.573479, -40.341054],
      radius: 0.3675465600000001,
    },
    {
      index: 226,
      centre: [-50.271149, -39.822528000000005],
      radius: 0.44341919999999846,
    },
    {
      index: 227,
      centre: [-19.981551500000002, 1.974216],
      radius: 0.3963643200000007,
    },
    {
      index: 228,
      centre: [19.9876535, 1.729869],
      radius: 0.3963633599999997,
    },
    {
      index: 229,
      centre: [-10.090633, 1.926298],
      radius: 0.3963638400000002,
    },
    {
      index: 230,
      centre: [69.651684, -40.671633],
      radius: 0.4722345600000017,
    },
    {
      index: 231,
      centre: [-0.302012, -40.17105050000001],
      radius: 0.39636192,
    },
    {
      index: 232,
      centre: [29.878569499999998, 1.681959],
      radius: 0.3963633599999997,
    },
    {
      index: 233,
      centre: [0.025724499999999983, 1.8183504999999998],
      radius: 0.38931408,
    },
    {
      index: 234,
      centre: [19.6825715, -40.29317],
      radius: 0.3675470399999989,
    },
    {
      index: 235,
      centre: [49.9795575, 1.5034425],
      radius: 0.46518576000000167,
    },
    {
      index: 236,
      centre: [-40.2785305, -39.8741],
      radius: 0.3893140799999992,
    },
    {
      index: 237,
      centre: [39.994924499999996, 1.57402],
      radius: 0.3893140800000026,
    },
    {
      index: 238,
      centre: [9.893969, 1.8041239999999998],
      radius: 0.36754848000000034,
    },
    {
      index: 239,
      centre: [49.681790500000005, -40.5195195],
      radius: 0.44341968000000065,
    },
    {
      index: 240,
      centre: [59.674404, -40.571070500000005],
      radius: 0.38931360000000037,
    },
    {
      index: 241,
      centre: [-49.9808155, 2.170671],
      radius: 0.47223504000000044,
    },
    {
      index: 242,
      centre: [-10.395688499999999, -40.096816000000004],
      radius: 0.3675470399999997,
    },
    {
      index: 243,
      centre: [-39.9661585, 2.0964025],
      radius: 0.36754895999999915,
    },
  ],
  sourceLevels: {
    mainFloor: 0.65,
    foundation: -8,
    lowerRoof: 3.3,
    mezzanineFloor: 3.3,
    mezzanineTop: 11.5,
    clerestoryFloor: 11.5,
    clerestoryTop: 15,
    columnTop: 15,
    roofUnderside: 15,
    roofTop: 18,
    lowCanopies: 4,
  },
  nativeFacts: {
    mainRoof: {
      height: 18,
      min_height: 16.5,
    },
    innerRoof: {
      height: 16.5,
      min_height: 15,
    },
    lowerHall: {
      height: 3.3,
    },
    centralHall: {
      height: 15,
      min_height: 3.3,
    },
    mezzanines: {
      height: 11.5,
      min_height: 3.3,
      layer: 1,
    },
    clerestories: {
      height: 15,
      min_height: 11.5,
      layer: 2,
    },
    columns: {
      height: 15,
      count: 28,
    },
    lowCanopies: {
      height: 4,
      layer: 1,
    },
    parent: {
      height: 11,
      layer: -1,
    },
    heightPolicy:
      'Numeric source heights retained explicitly. Use the18m upper/16.5m lower roof stacks as curved shells and28 fifteen-metre supports,not parent-wide solid boxes. Actual lower hall floor+.65m/foundations-8m and photo-proportioned bowed shell/beam/stair sections are architectural approximations on one common terrain datum. The layer-1 parent is an ownership envelope,not a surveyed aboveground mass or platform elevation. No per-part offsets.',
  },
};
export const stationPlans = controls.groups[123].map((p) => p[0]);
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

const FLOOR = 0.65,
  FOOT = -8;
function faceBand(o, c, e, lo, hi, s = 'metal', depth = 0) {
  if (hi - lo < 1e-6) return;
  Q(
    o,
    c,
    [e.p([0, lo, depth]), e.p([e.L, lo, depth]), e.p([e.L, hi, depth]), e.p([0, hi, depth])],
    s,
    C[s],
    e.N,
  );
}
function glazedRange(o, c, e, lo, hi, s = 'glass') {
  const count =
      c === cfg.skyline
        ? 1
        : Math.max(1, Math.ceil(e.L / (c.master ? 1.6 : c.near ? 3.1 : c.fine ? 7 : 22))),
    w = e.L / count,
    post = c.detail ? Math.min(0.17, w * 0.15) : 0,
    depth = c.recess ? 0.26 : 0.015;
  for (let i = 0; i < count; i++) {
    const a = i * w,
      b = (i + 1) * w,
      u0 = a + post,
      u1 = b - post;
    if (post) {
      Q(
        o,
        c,
        [e.p([a, lo, 0]), e.p([u0, lo, 0]), e.p([u0, hi, 0]), e.p([a, hi, 0])],
        'metal',
        C.metal,
        e.N,
      );
      Q(
        o,
        c,
        [e.p([u1, lo, 0]), e.p([b, lo, 0]), e.p([b, hi, 0]), e.p([u1, hi, 0])],
        'metal',
        C.metal,
        e.N,
      );
    }
    const r = [
      [u0, lo],
      [u1, lo],
      [u1, hi],
      [u0, hi],
    ];
    Q(
      o,
      c,
      r.map(([u, y]) => e.p([u, y, -depth])),
      s,
      C[s],
      e.N,
    );
    if (c.recess)
      for (let j = 0; j < 4; j++) {
        const a = r[j],
          b = r[(j + 1) % 4];
        Q(
          o,
          c,
          [e.p([...a, 0]), e.p([...b, 0]), e.p([...b, -depth]), e.p([...a, -depth])],
          'metal',
          C.metal,
        );
      }
    if (c.fine) {
      const adapterO = adapter(o, c),
        span = hi - lo,
        rows = c.master ? Math.max(1, Math.ceil(span / 1.3)) : c.near ? 2 : 1;
      for (let j = 1; j <= rows; j++) {
        const y = lo + (span * j) / (rows + 1);
        beam(
          adapterO,
          'metal',
          e.p([u0, y, -depth + 0.045]),
          e.p([u1, y, -depth + 0.045]),
          0.075,
          0.09,
          C.metal,
        );
      }
      if (c.master && w > 1)
        beam(
          adapterO,
          'metal',
          e.p([(u0 + u1) / 2, lo, -depth + 0.045]),
          e.p([(u0 + u1) / 2, hi, -depth + 0.045]),
          0.065,
          0.085,
          C.metal,
        );
    }
  }
}
function building(o, c, poly, lo, hi, glassLo, glassHi, door = false) {
  if (lo > FLOOR) {
    if (c === cfg.skyline) {
      panel(o, c, poly, lo, 'base', [0, -1, 0]);
      panel(o, c, poly, lo, 'base');
    } else {
      slab(o, c, poly[0], lo - 0.12, lo, 'base');
    }
  } else {
    panel(o, c, poly, lo, 'base', [0, -1, 0]);
  }
  panel(o, c, poly, hi, 'metal');
  ringEdges(poly, (e) => {
    faceBand(o, c, e, lo, glassLo);
    glazedRange(o, c, e, glassLo, glassHi, door ? 'doorGlass' : 'glass');
    faceBand(o, c, e, glassHi, hi);
    if (c.fine) {
      beam(
        adapter(o, c),
        'metal',
        e.p([0, glassLo, 0.08]),
        e.p([e.L, glassLo, 0.08]),
        0.15,
        0.16,
        C.metal,
      );
      beam(
        adapter(o, c),
        'metal',
        e.p([0, glassHi, 0.08]),
        e.p([e.L, glassHi, 0.08]),
        0.15,
        0.16,
        C.metal,
      );
    }
    if (c.near && hi - glassHi > 0.35) {
      const count = Math.floor(e.L / (c.master ? 0.3 : 0.9));
      for (let i = 1; i < count; i++)
        beam(
          adapter(o, c),
          'metal',
          e.p([(e.L * i) / count, glassHi + 0.1, 0.045]),
          e.p([(e.L * i) / count, hi - 0.05, 0.045]),
          0.035,
          0.06,
          C.metal,
        );
    }
  });
}
const roofMid = (-62.326591 + 24.025643) / 2,
  roofHalf = (24.025643 + 62.326591) / 2;
export const roofHeight = (z) => 16.5 + 1.5 * ((z - roofMid) / roofHalf) ** 2;
function across(r, z) {
  const xs = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (Math.abs(a[1] - z) < 1e-6) xs.push(a[0]);
    if ((a[1] < z && b[1] > z) || (b[1] < z && a[1] > z))
      xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
  }
  return [Math.min(...xs), Math.max(...xs)];
}
function roofShell(o, c, poly, offset, thickness) {
  const r = openRing(poly[0]),
    zmin = Math.min(...r.map((p) => p[1])),
    zmax = Math.max(...r.map((p) => p[1])),
    zs = [
      ...new Set([
        ...r.map((p) => p[1]),
        ...Array.from({ length: c.z + 1 }, (_, i) => zmin + ((zmax - zmin) * i) / c.z),
      ]),
    ].sort((a, b) => a - b),
    h = (z) => roofHeight(z) + offset;
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i],
      z1 = zs[i + 1];
    if (z1 - z0 < 1e-5) continue;
    const a = across(r, z0),
      b = across(r, z1),
      p = [
        [a[0], h(z0), z0],
        [a[1], h(z0), z0],
        [b[1], h(z1), z1],
        [b[0], h(z1), z1],
      ];
    Q(o, c, p, 'roof', C.roof, [0, 1, 0]);
    Q(
      o,
      c,
      p.map(([x, y, z]) => [x, y - thickness, z]),
      'roof',
      C.roof,
      [0, -1, 0],
    );
    for (const j of [0, 1])
      Q(
        o,
        c,
        [
          [a[j], h(z0) - thickness, z0],
          [a[j], h(z0), z0],
          [b[j], h(z1), z1],
          [b[j], h(z1) - thickness, z1],
        ],
        'metal',
        C.metal,
        [j ? 1 : -1, 0, 0],
      );
  }
  for (const z of [zmin, zmax]) {
    const a = across(r, z);
    Q(
      o,
      c,
      [
        [a[0], h(z) - thickness, z],
        [a[1], h(z) - thickness, z],
        [a[1], h(z), z],
        [a[0], h(z), z],
      ],
      'metal',
      C.metal,
      [0, 0, z === zmin ? -1 : 1],
    );
  }
  if (c.fine) {
    const spacing = c.master ? 0.65 : c.near ? 3.2 : 18,
      xmin = Math.min(...r.map((p) => p[0])) + 0.6,
      xmax = Math.max(...r.map((p) => p[0])) - 0.6;
    for (let x = xmin; x < xmax; x += spacing) {
      let run = [];
      for (const z of zs) {
        const a = across(r, z);
        if (x > a[0] + 0.12 && x < a[1] - 0.12) run.push([x, h(z) - thickness - 0.02, z]);
        else if (run.length) {
          if (run.length > 1) beamPath(adapter(o, c), 'metal', run, 0.05, 0.055, C.metal);
          run = [];
        }
      }
      if (run.length > 1) beamPath(adapter(o, c), 'metal', run, 0.05, 0.055, C.metal);
    }
    if (c.near && offset === 0) {
      for (const z of zs.filter((_, i) => i % (c.master ? 3 : 4) === 0)) {
        const a = across(r, z);
        beam(
          adapter(o, c),
          'metal',
          [a[0] + 0.2, h(z) + 0.025, z],
          [a[1] - 0.2, h(z) + 0.025, z],
          0.045,
          0.05,
          C.metal,
        );
      }
    }
  }
}
function column(o, c, x, z, r, lo, hi) {
  const n = c.round;
  for (let j = 0; j < n; j++) {
    const a = (j * 2 * Math.PI) / n,
      b = ((j + 1) * 2 * Math.PI) / n,
      p = [
        [x + r * Math.cos(a), lo, z + r * Math.sin(a)],
        [x + r * Math.cos(b), lo, z + r * Math.sin(b)],
        [x + r * Math.cos(b), hi, z + r * Math.sin(b)],
        [x + r * Math.cos(a), hi, z + r * Math.sin(a)],
      ];
    Q(o, c, p, 'stone', C.stone, [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
    T(o, c, [[x, hi, z], p[2], p[3]], 'stone', C.stone, [0, 1, 0]);
    T(o, c, [[x, lo, z], p[0], p[1]], 'stone', C.stone, [0, -1, 0]);
  }
}
function tallColumns(o, c) {
  for (const p of controls.columns) {
    const [x, z] = p.centre;
    column(o, c, x, z, p.radius, FOOT, 15);
    if (c.detail) {
      const y = Math.max(15.2, roofHeight(z) - 1.1);
      beam(
        adapter(o, c),
        'stone',
        [x, 14.65, z],
        [x, y, z],
        p.radius * 2.2,
        p.radius * 1.9,
        C.stone,
      );
      if (c.fine) {
        for (const dx of [-1.5, 1.5])
          beam(
            adapter(o, c),
            'stone',
            [x, 14.1, z],
            [x + dx, Math.max(15.2, roofHeight(z) - 1), z],
            0.32,
            0.38,
            C.stone,
          );
        box(o, c, x - 0.95, x + 0.95, -0.1, 0.2, z - 0.95, z + 0.95, 'base');
      }
    }
  }
}
function lowCanopies(o, c) {
  for (const key of [363, 364])
    for (const poly of controls.groups[key]) {
      slab(o, c, poly[0], 3.72, 4, 'roof');
      const r = openRing(poly[0]),
        x0 = Math.min(...r.map((p) => p[0])) + 3,
        x1 = Math.max(...r.map((p) => p[0])) - 3,
        z = r.reduce((s, p) => s + p[1], 0) / r.length,
        count = c === cfg.skyline ? 3 : 10;
      for (let j = 0; j < count; j++) {
        const x = x0 + ((x1 - x0) * j) / (count - 1);
        column(o, c, x, z, c === cfg.skyline ? 0.18 : 0.14, FOOT, 3.8);
        if (c.fine)
          beam(adapter(o, c), 'metal', [x, 3.7, z - 2.3], [x, 3.7, z + 2.3], 0.14, 0.14, C.metal);
      }
      if (c.near) {
        for (let x = x0; x < x1; x += c.master ? 0.6 : 2)
          beam(
            adapter(o, c),
            'metal',
            [x, 4.04, z - 2.4],
            [x, 4.04, z + 2.4],
            0.035,
            0.045,
            C.metal,
          );
      }
    }
}
function steps(o, c) {
  const count = c === cfg.skyline ? 1 : 6,
    x0 = -47.6,
    x1 = -37.85;
  for (let j = 0; j < count; j++) {
    const lo = x0 + ((x1 - x0) * j) / count,
      hi = x0 + ((x1 - x0) * (j + 1)) / count;
    box(o, c, lo, hi, -0.2, (FLOOR * (j + 1)) / count, -34, -3, 'base');
  }
  if (c.near)
    for (const z of [-34.3, -2.7]) {
      beam(adapter(o, c), 'metal', [x0, 0.95, z], [x1, 1.6, z], 0.07, 0.07, C.metal);
      for (const x of [x0, x1])
        beam(adapter(o, c), 'metal', [x, 0, z], [x, x === x0 ? 0.95 : 1.6, z], 0.07, 0.07, C.metal);
    }
}
export function buildStationLevel(o, level = 'master', mark = () => {}) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Warsaw tier ' + level);
  for (const poly of controls.groups[123]) {
    slab(o, c, poly[0], FOOT, FLOOR, 'base');
    building(o, c, poly, FLOOR, 3.3, 1.05, 2.9, true);
  }
  mark('closed-lower-hall');
  for (const poly of controls.groups[244]) building(o, c, poly, 3.3, 15, 4.35, 14.6);
  for (const i of [247, 248])
    for (const poly of controls.groups[i]) building(o, c, poly, 3.3, 11.5, 6.15, 10.75);
  for (const i of [245, 246])
    for (const poly of controls.groups[i]) building(o, c, poly, 11.5, 15, 11.8, 14.7);
  if (c.detail)
    for (const i of [394, 395, 396, 397, 398, 698, 699, 700])
      for (const poly of controls.groups[i]) building(o, c, poly, FLOOR, 3.3, 1.05, 2.9, true);
  mark('whole-stacked-passenger-hall');
  tallColumns(o, c);
  mark('all-native-tall-supports');
  if (c.detail) for (const poly of controls.groups[251]) roofShell(o, c, poly, -0.75, 0.75);
  for (const poly of controls.groups[206]) roofShell(o, c, poly, 0, c.detail ? 0.8 : 1.5);
  mark('complete-curved-cantilever-roof');
  lowCanopies(o, c);
  steps(o, c);
  mark('two-open-north-canopies-and-west-stairs');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

/** Original whole Nyugati historic passenger ensemble; source geometry, not a downloaded mesh. */
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
  brick: lin('d4ae99'),
  stone: lin('e1d1a4'),
  base: lin('ada89b'),
  roof: lin('7d8c97'),
  metal: lin('5b798a'),
  frame: lin('5b798a'),
  glass: lin('607984'),
  door: lin('614a3c'),
  canopy: lin('99a6a4'),
  gold: lin('c5b584'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.48 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
  canopy: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86 },
  gold: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
};
const cfg = {
  skyline: { round: 4, arch: 3, roof: 2 },
  district: { round: 8, arch: 4, roof: 4, detail: true },
  street: { round: 16, arch: 6, roof: 6, detail: true, recess: true, fine: true },
  closeup: { round: 32, arch: 10, roof: 12, detail: true, recess: true, fine: true, near: true },
  master: {
    round: 96,
    arch: 28,
    roof: 32,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const stationPlans = [
  [
    [76.753191, -59.946163],
    [63.037683, -59.742876],
    [62.994556, -58.452235],
    [53.128961, -58.403865],
    [52.821223, -106.725386],
    [76.708641, -106.714616],
    [76.753191, -59.946163],
  ],
  [
    [76.753191, -59.946163],
    [76.434676, -40.039832],
    [69.565909, -40.080363],
    [69.468892, -59.811509],
    [76.753191, -59.946163],
  ],
  [
    [64.057805, 60.613038],
    [49.642285, 61.013653],
    [49.058535, 29.448133],
    [63.933595, 29.441081],
    [64.057805, 60.613038],
  ],
  [
    [-55.712435, -39.824315],
    [-69.581234, -39.752086],
    [-69.558343, -37.608332],
    [-76.558336, -37.495618],
    [-76.693038, -44.77998],
    [-75.839939, -44.846012],
    [-75.822338, -53.858579],
    [-76.675437, -53.792547],
    [-76.656958, -60.945723],
    [-69.656974, -61.058426],
    [-69.65609, -59.199042],
    [-55.787306, -59.271254],
    [-55.712435, -39.824315],
  ],
  [
    [-55.757341, 3.947909],
    [-55.682549, 23.39494],
    [-69.267029, 23.445214],
    [-69.375326, 25.742168],
    [-76.397353, 25.570543],
    [-76.378837, 18.417324],
    [-75.525735, 18.351288],
    [-75.508097, 9.33868],
    [-76.514387, 9.273537],
    [-76.495879, 2.120327],
    [-69.62705, 2.160785],
    [-69.494994, 3.866988],
    [-55.757341, 3.947909],
  ],
  [
    [27.668229, -54.716919],
    [27.522178, -39.973101],
    [-55.712435, -39.824315],
    [-55.719505, -54.69939],
    [27.668229, -54.716919],
  ],
  [
    [-59.070324, 29.521633],
    [-55.635906, 29.541859],
    [-55.489892, 60.998423],
    [-72.355638, 61.159691],
    [-72.523631, 29.418725],
    [-59.070324, 29.521633],
  ],
  [
    [-22.157175, 3.778733],
    [-22.213526, 23.378911],
    [-55.682549, 23.39494],
    [-55.757341, 3.947909],
    [-22.157175, 3.778733],
  ],
  [
    [13.893062, 3.849083],
    [14.004883, 8.98968],
    [-22.176543, 9.07253],
    [-22.157175, 3.778733],
    [13.893062, 3.849083],
  ],
  [
    [14.004883, 8.98968],
    [14.014594, 29.442918],
    [-22.166872, 29.525817],
    [-22.176543, 9.07253],
    [14.004883, 8.98968],
  ],
  [
    [-59.070324, 29.521633],
    [-59.116965, 23.374713],
    [-22.213526, 23.378911],
    [-22.166872, 29.525817],
    [-59.070324, 29.521633],
  ],
  [
    [14.014594, 29.442918],
    [14.121116, 23.427205],
    [63.908923, 23.578574],
    [63.933595, 29.441081],
    [14.014594, 29.442918],
  ],
  [
    [14.121116, 23.427205],
    [13.893062, 3.849083],
    [76.674454, 3.71001],
    [76.771398, 23.441241],
    [14.121116, 23.427205],
  ],
  [
    [41.342424, -49.91085],
    [41.280856, -41.467078],
    [38.678442, -39.978354],
    [34.106594, -39.910577],
    [31.546418, -41.571872],
    [31.607991, -50.015649],
    [34.275544, -52.510652],
    [38.563025, -52.556416],
    [41.342424, -49.91085],
  ],
  [
    [44.708091, -56.321796],
    [46.56836, -54.463297],
    [46.482103, -51.882011],
    [44.623622, -50.021766],
    [41.342424, -49.91085],
    [39.175778, -52.031705],
    [39.284048, -54.328628],
    [40.464636, -55.707305],
    [41.426894, -56.210881],
    [44.708091, -56.321796],
  ],
  [
    [41.426894, -56.210881],
    [40.464636, -55.707305],
    [39.284048, -54.328628],
    [39.175778, -52.031705],
    [41.342424, -49.91085],
    [41.259737, -39.892069],
    [27.522178, -39.973101],
    [27.668229, -54.716919],
    [31.540169, -54.587489],
    [31.5595, -59.881243],
    [41.447116, -59.645259],
    [41.426894, -56.210881],
  ],
  [
    [-71.7, -40],
    [-55, -40],
    [-55, 3.85],
    [-71.7, 3.85],
    [-71.7, -40],
  ],
];
export const nativePlans = {
  62: [
    [76.434676, -40.039832],
    [76.771398, 23.441241],
    [63.908923, 23.578574],
    [64.057805, 60.613038],
    [49.642285, 61.013653],
    [49.058535, 29.448133],
    [-55.635906, 29.541859],
    [-55.489892, 60.998423],
    [-72.355638, 61.159691],
    [-72.523631, 29.418725],
    [-70.795417, 29.571021],
    [-70.819172, 25.56786],
    [-76.397353, 25.570543],
    [-76.378837, 18.417324],
    [-75.525735, 18.351288],
    [-75.508097, 9.33868],
    [-76.514387, 9.273537],
    [-76.495879, 2.120327],
    [-71.639629, 2.030498],
    [-71.702096, -37.585435],
    [-76.558336, -37.495618],
    [-76.693038, -44.77998],
    [-75.839939, -44.846012],
    [-75.822338, -53.858579],
    [-76.675437, -53.792547],
    [-76.656958, -60.945723],
    [-69.656974, -61.058426],
    [-69.65609, -59.199042],
    [-55.787306, -59.271254],
    [-55.719505, -54.69939],
    [31.540169, -54.587489],
    [31.5595, -59.881243],
    [41.447116, -59.645259],
    [41.426894, -56.210881],
    [44.708091, -56.321796],
    [46.56836, -54.463297],
    [46.482103, -51.882011],
    [44.623622, -50.021766],
    [41.342424, -49.91085],
    [41.259737, -39.892069],
    [76.434676, -40.039832],
  ],
  311: [
    [76.753191, -59.946163],
    [63.037683, -59.742876],
    [62.994556, -58.452235],
    [53.128961, -58.403865],
    [52.821223, -106.725386],
    [76.708641, -106.714616],
    [76.753191, -59.946163],
  ],
  312: [
    [76.753191, -59.946163],
    [76.434676, -40.039832],
    [69.565909, -40.080363],
    [69.468892, -59.811509],
    [76.753191, -59.946163],
  ],
  344: [
    [-69.62705, 2.160785],
    [-71.639629, 2.030498],
    [-71.702096, -37.585435],
    [-69.558343, -37.608332],
    [-69.581234, -39.752086],
    [76.434676, -40.039832],
    [76.674454, 3.71001],
    [-69.494994, 3.866988],
    [-69.62705, 2.160785],
  ],
  347: [
    [64.057805, 60.613038],
    [49.642285, 61.013653],
    [49.058535, 29.448133],
    [63.933595, 29.441081],
    [64.057805, 60.613038],
  ],
  352: [
    [76.753191, -59.946163],
    [76.708641, -106.714616],
    [97.861565, -106.921296],
    [97.928183, -59.868545],
    [76.753191, -59.946163],
  ],
  362: [
    [-55.712435, -39.824315],
    [-69.581234, -39.752086],
    [-69.558343, -37.608332],
    [-76.558336, -37.495618],
    [-76.693038, -44.77998],
    [-75.839939, -44.846012],
    [-75.822338, -53.858579],
    [-76.675437, -53.792547],
    [-76.656958, -60.945723],
    [-69.656974, -61.058426],
    [-69.65609, -59.199042],
    [-55.787306, -59.271254],
    [-55.712435, -39.824315],
  ],
  363: [
    [-55.757341, 3.947909],
    [-55.682549, 23.39494],
    [-69.267029, 23.445214],
    [-69.375326, 25.742168],
    [-76.397353, 25.570543],
    [-76.378837, 18.417324],
    [-75.525735, 18.351288],
    [-75.508097, 9.33868],
    [-76.514387, 9.273537],
    [-76.495879, 2.120327],
    [-69.62705, 2.160785],
    [-69.494994, 3.866988],
    [-55.757341, 3.947909],
  ],
  364: [
    [-70.135898, -56.158172],
    [-71.600866, -54.757468],
    [-73.744617, -54.734573],
    [-75.14532, -56.19954],
    [-75.015025, -58.212113],
    [-73.550057, -59.612818],
    [-71.406307, -59.635712],
    [-70.158791, -58.301923],
    [-70.135898, -56.158172],
  ],
  365: [
    [-70.193987, -40.276797],
    [-71.658958, -38.876089],
    [-73.802711, -38.853192],
    [-75.072236, -40.471348],
    [-75.073117, -42.330736],
    [-73.608146, -43.731443],
    [-71.617582, -43.885518],
    [-70.216879, -42.420551],
    [-70.193987, -40.276797],
  ],
  366: [
    [-69.821628, 7.039052],
    [-71.417786, 8.592959],
    [-73.430365, 8.462673],
    [-74.831068, 6.997705],
    [-74.700764, 4.985121],
    [-73.388974, 3.453226],
    [-71.376395, 3.583512],
    [-69.844513, 4.895291],
    [-69.821628, 7.039052],
  ],
  367: [
    [-69.879782, 22.920502],
    [-71.344763, 24.321223],
    [-73.641712, 24.212951],
    [-74.889226, 22.87916],
    [-74.912108, 20.735396],
    [-73.447127, 19.334676],
    [-71.303367, 19.31177],
    [-69.902665, 20.776739],
    [-69.879782, 22.920502],
  ],
  368: [
    [-71.702096, -37.585435],
    [-71.639629, 2.030498],
    [-76.495879, 2.120327],
    [-76.558336, -37.495618],
    [-71.702096, -37.585435],
  ],
  369: [
    [27.668229, -54.716919],
    [27.522178, -39.973101],
    [-55.712435, -39.824315],
    [-55.719505, -54.69939],
    [27.668229, -54.716919],
  ],
  370: [
    [31.540169, -54.587489],
    [-55.719505, -54.69939],
    [-55.787306, -59.271254],
    [-55.437794, -60.299549],
    [-54.453518, -60.518767],
    [30.793559, -60.537132],
    [31.3843, -60.296785],
    [31.5595, -59.881243],
    [31.540169, -54.587489],
  ],
  371: [
    [-59.070324, 29.521633],
    [-55.635906, 29.541859],
    [-55.489892, 60.998423],
    [-72.355638, 61.159691],
    [-72.523631, 29.418725],
    [-59.070324, 29.521633],
  ],
  372: [
    [-22.157175, 3.778733],
    [-22.213526, 23.378911],
    [-55.682549, 23.39494],
    [-55.757341, 3.947909],
    [-22.157175, 3.778733],
  ],
  373: [
    [13.893062, 3.849083],
    [14.004883, 8.98968],
    [-22.176543, 9.07253],
    [-22.157175, 3.778733],
    [13.893062, 3.849083],
  ],
  374: [
    [14.004883, 8.98968],
    [14.014594, 29.442918],
    [-22.166872, 29.525817],
    [-22.176543, 9.07253],
    [14.004883, 8.98968],
  ],
  375: [
    [63.868449, 30.447365],
    [63.908923, 23.578574],
    [77.777683, 23.506391],
    [77.890403, 30.506353],
    [63.868449, 30.447365],
  ],
  376: [
    [-55.547871, 30.679329],
    [-55.635906, 29.541859],
    [49.058535, 29.448133],
    [49.146577, 30.585596],
    [19.112059, 30.621748],
    [18.631367, 31.803235],
    [17.537921, 32.46001],
    [-23.937347, 32.523566],
    [-25.272021, 31.911699],
    [-25.666435, 30.511875],
    [-55.547871, 30.679329],
  ],
  377: [
    [-59.070324, 29.521633],
    [-59.116965, 23.374713],
    [-22.213526, 23.378911],
    [-22.166872, 29.525817],
    [-59.070324, 29.521633],
  ],
  378: [
    [14.014594, 29.442918],
    [14.121116, 23.427205],
    [63.908923, 23.578574],
    [63.933595, 29.441081],
    [14.014594, 29.442918],
  ],
  379: [
    [14.121116, 23.427205],
    [13.893062, 3.849083],
    [76.674454, 3.71001],
    [76.771398, 23.441241],
    [14.121116, 23.427205],
  ],
  380: [
    [41.342424, -49.91085],
    [41.280856, -41.467078],
    [38.678442, -39.978354],
    [34.106594, -39.910577],
    [31.546418, -41.571872],
    [31.607991, -50.015649],
    [34.275544, -52.510652],
    [38.563025, -52.556416],
    [41.342424, -49.91085],
  ],
  381: [
    [44.708091, -56.321796],
    [46.56836, -54.463297],
    [46.482103, -51.882011],
    [44.623622, -50.021766],
    [41.342424, -49.91085],
    [39.175778, -52.031705],
    [39.284048, -54.328628],
    [40.464636, -55.707305],
    [41.426894, -56.210881],
    [44.708091, -56.321796],
  ],
  382: [
    [41.426894, -56.210881],
    [40.464636, -55.707305],
    [39.284048, -54.328628],
    [39.175778, -52.031705],
    [41.342424, -49.91085],
    [41.259737, -39.892069],
    [27.522178, -39.973101],
    [27.668229, -54.716919],
    [31.540169, -54.587489],
    [31.5595, -59.881243],
    [41.447116, -59.645259],
    [41.426894, -56.210881],
  ],
  383: [
    [41.447116, -59.645259],
    [44.750324, -59.471809],
    [47.266475, -58.379242],
    [48.84238, -56.498735],
    [49.893581, -54.005483],
    [49.9385, -51.577383],
    [48.977137, -49.214436],
    [47.249832, -47.507378],
    [45.018939, -46.762581],
    [41.453376, -46.629656],
    [41.342424, -49.91085],
    [44.623622, -50.021766],
    [46.482103, -51.882011],
    [46.56836, -54.463297],
    [44.708091, -56.321796],
    [41.426894, -56.210881],
    [41.447116, -59.645259],
  ],
  543: [
    [-55.429095, 50.695135],
    [-55.489892, 60.998423],
    [-72.355638, 61.159691],
    [-72.43298, 36.13439],
    [-55.429095, 50.695135],
  ],
  804: [
    [-55.429095, 50.695135],
    [-55.489892, 60.998423],
    [-72.355638, 61.159691],
    [-72.43298, 36.13439],
    [-55.429095, 50.695135],
  ],
};
export const controls = {
  foyer: [
    [-71.7, -40],
    [-55, -40],
    [-55, 3.85],
    [-71.7, 3.85],
    [-71.7, -40],
  ],
  rangeSeeds: [311, 312, 347, 369, 371, 372, 373, 374, 377, 378, 379, 380, 381, 382],
  canopySeeds: [368, 370, 375, 376, 383, 352],
  towers: [
    { index: 364, x: -72.640609, z: -57.1851425 },
    { index: 365, x: -72.63355200000001, z: -41.369355 },
    { index: 366, x: -72.326348, z: 6.023092500000001 },
    { index: 367, x: -72.39594500000001, z: 21.8164965 },
  ],
  heights: {
    311: 8,
    312: 5,
    347: 8,
    369: 8,
    371: 8,
    372: 8,
    373: 11,
    374: 14,
    377: 5,
    378: 5,
    379: 8,
    380: 11,
    381: 8,
    382: 8,
  },
  wingPolygons: [
    [
      [
        [-72.523631, 29.418725],
        [-59.070324, 29.521633],
        [-55.635906, 29.541859],
        [-55.489892, 60.998423],
        [-72.355638, 61.159691],
        [-72.523631, 29.418725],
      ],
    ],
    [
      [
        [-59.116965, 23.374713],
        [-55.68262528918792, 23.375103677901482],
        [-55.757341, 3.947909],
        [-22.157175, 3.778733],
        [13.893062, 3.849083],
        [76.674454, 3.71001],
        [76.771398, 23.441241],
        [14.121116, 23.427205],
        [14.007090090283054, 13.638237599299572],
        [14.014594, 29.442918],
        [-22.166872, 29.525817],
        [-59.070324, 29.521633],
        [-59.116965, 23.374713],
      ],
      [
        [-22.166872, 29.525817],
        [-22.175957130276984, 10.31159127488635],
        [-22.213526, 23.378911],
        [-22.166872, 29.525817],
      ],
    ],
    [
      [
        [-55.719505, -54.69939],
        [27.668229, -54.716919],
        [31.540169, -54.587489],
        [31.5595, -59.881243],
        [41.447116, -59.645259],
        [41.426894, -56.210881],
        [44.708091, -56.321796],
        [46.56836, -54.463297],
        [46.482103, -51.882011],
        [44.623622, -50.021766],
        [41.342424, -49.91085],
        [41.280856, -41.467078],
        [41.272697344419605, -41.462410800096265],
        [41.259737, -39.892069],
        [35.249519506660505, -39.92752070899141],
        [34.106594, -39.910577],
        [34.06975833505682, -39.93447961684814],
        [27.522178, -39.973101],
        [-55.712435, -39.824315],
        [-55.719505, -54.69939],
      ],
    ],
    [
      [
        [14.014594, 29.442918],
        [14.121116, 23.427205],
        [63.908923, 23.578574],
        [63.933595, 29.441081],
        [14.014594, 29.442918],
      ],
    ],
    [
      [
        [49.058535, 29.448133],
        [63.933595, 29.441081],
        [64.057805, 60.613038],
        [49.642285, 61.013653],
        [49.058535, 29.448133],
      ],
    ],
    [
      [
        [52.821223, -106.725386],
        [76.708641, -106.714616],
        [76.753191, -59.946163],
        [63.037683, -59.742876],
        [62.994556, -58.452235],
        [53.128961, -58.403865],
        [52.821223, -106.725386],
      ],
    ],
    [
      [
        [69.468892, -59.811509],
        [76.753191, -59.946163],
        [76.434676, -40.039832],
        [69.565909, -40.080363],
        [69.468892, -59.811509],
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
function arch(u, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r,
    a = [
      [u - r, y],
      [u + r, y],
      [u + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    a.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  return a;
}
function wall(o, c, p, outer, holes = [], surface = 'stone', normal) {
  const N = normal ?? sub(p([0, 0, 1]), p([0, 0, 0])),
    active = holes.filter((h) => c.recess || h.kind === 'open'),
    flat = [...outer, ...active.flatMap((h) => h.ring)],
    starts = active.map(
      (h, i) => outer.length + active.slice(0, i).reduce((s, h) => s + h.ring.length, 0),
    );
  const ids = earcut(flat.flat(), starts);
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
    const depth = h.kind === 'open' ? 0.8 : c.fine ? 0.28 : 0.12;
    if (c.recess || (c.detail && h.kind === 'open'))
      for (let i = 0; i < h.ring.length; i++) {
        const a = h.ring[i],
          b = h.ring[(i + 1) % h.ring.length];
        Q(
          o,
          c,
          [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])],
          surface,
          C[surface],
        );
      }
    if (h.kind !== 'open') {
      const ix = earcut(h.ring.flat());
      for (let i = 0; i < ix.length; i += 3)
        T(
          o,
          c,
          ix.slice(i, i + 3).map((j) => p([...h.ring[j], c.recess ? -depth : 0.02])),
          h.kind,
          C[h.kind],
          N,
        );
    }
    if (c.near)
      beamPath(
        adapter(o, c),
        'stone',
        h.ring.map(([u, y]) => p([u, y, 0.06])),
        h.kind === 'open' ? 0.27 : 0.18,
        0.17,
        C.stone,
        true,
      );
    else if (c.fine) {
      const center = h.ring.reduce((a, b) => a.map((v, i) => v + b[i] / h.ring.length), [0, 0]);
      for (let i = 0; i < h.ring.length; i++) {
        const a = h.ring[i],
          b = h.ring[(i + 1) % h.ring.length],
          grow = (q) => {
            const d = Math.hypot(q[0] - center[0], q[1] - center[1]) || 1;
            return q.map((v, i) => v + (0.15 * (v - center[i])) / d);
          };
        Q(
          o,
          c,
          [p([...a, 0.035]), p([...b, 0.035]), p([...grow(b), 0.035]), p([...grow(a), 0.035])],
          'stone',
          C.stone,
          N,
        );
      }
    }
    if (c.near && h.kind === 'glass') {
      const xs = h.ring.map((p) => p[0]),
        ys = h.ring.map((p) => p[1]),
        x = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys);
      beam(
        adapter(o, c),
        'metal',
        p([x, lo, -depth + 0.05]),
        p([x, hi, -depth + 0.05]),
        0.08,
        0.08,
        C.frame,
      );
      beam(
        adapter(o, c),
        'metal',
        p([Math.min(...xs), lo + (hi - lo) * 0.56, -depth + 0.05]),
        p([Math.max(...xs), lo + (hi - lo) * 0.56, -depth + 0.05]),
        0.08,
        0.08,
        C.frame,
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
function lathe(o, c, x, z, profile, s = 'roof', elliptic = 1, n = c.round) {
  for (let k = 0; k < profile.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        p = ([y, r], t) => [x + r * Math.cos(t), y, z + r * elliptic * Math.sin(t)];
      Q(
        o,
        c,
        [p(profile[k], a), p(profile[k], b), p(profile[k + 1], b), p(profile[k + 1], a)],
        s,
        C[s],
        [Math.cos((a + b) / 2), 0.01, Math.sin((a + b) / 2)],
      );
    }
  for (const [ring, N] of [
    [profile[0], [0, -1, 0]],
    [profile.at(-1), [0, 1, 0]],
  ])
    for (let i = 0; i < n; i++)
      T(
        o,
        c,
        [
          [x, ring[0], z],
          [
            x + ring[1] * Math.cos((i / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin((i / n) * Math.PI * 2),
          ],
          [
            x + ring[1] * Math.cos(((i + 1) / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin(((i + 1) / n) * Math.PI * 2),
          ],
        ],
        s,
        C[s],
        N,
      );
}
const interp = (controls, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * (controls.length - 1),
      j = Math.min(controls.length - 2, Math.floor(t)),
      u = t - j;
    return controls[j].map((v, k) => v * (1 - u) + controls[j + 1][k] * u);
  });
const floor = 0.85,
  front = -76.6,
  HL = -40,
  HR = 4,
  HC = -18,
  H0 = -71.7,
  H1 = 76.7,
  EAVE = 15.5,
  PEAK = 28.3;
function simplify(input, tol = 0.8) {
  let r = openRing(input).slice(),
    changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        d = r[(i + 1) % r.length],
        dx = d[0] - a[0],
        dz = d[1] - a[1],
        u = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz)),
        );
      if (Math.hypot(b[0] - a[0] - u * dx, b[1] - a[1] - u * dz) < tol) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function solidPolygon(o, c, poly, y0, y1, s) {
  const rings = poly.map((r) => (c === cfg.skyline ? simplify(r) : openRing(r))),
    flat = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(flat.flat(), holes);
  for (let i = 0; i < ix.length; i += 3) {
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [flat[j][0], y1, flat[j][1]]),
      s,
      C[s],
      [0, 1, 0],
    );
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [flat[j][0], y0, flat[j][1]]),
      s,
      C[s],
      [0, -1, 0],
    );
  }
  for (let j = 0; j < rings.length; j++) {
    const r = rings[j];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        n = [b[1] - a[1], 0, a[0] - b[0]].map((v) => (j ? -v : v));
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
        n,
      );
    }
  }
}
const planeX =
  (x, sign = -1) =>
  ([u, y, d]) => [x + sign * d, y, sign < 0 ? u : -u];
function band(o, c, p, L, y, s = 'stone', h = 0.25) {
  Q(
    o,
    c,
    [p([0, y, 0.08]), p([L, y, 0.08]), p([L, y + h, 0.08]), p([0, y + h, 0.08])],
    s,
    C[s],
    sub(p([0, 0, 1]), p([0, 0, 0])),
  );
}
function lowRange(o, c, index) {
  const r = openRing(nativePlans[index]),
    top = controls.heights[index],
    eave = top > 10 ? top - 2.1 : top - 0.35;
  slab(o, c, r, -6.3, floor, 'base');
  slab(o, c, r, eave, top, 'roof');
  for (let i = 0; i < r.length; i++) {
    const { p, L, N } = edge(r, i),
      holes = [],
      count = Math.max(1, Math.floor(L / (c.near ? 4.2 : c.fine ? 15 : 12)));
    if (c.detail && L > 3.5)
      for (let j = 0; j < count; j++) {
        const door = j === 0 && L > 10,
          w = Math.min(2.25, L / count - 1),
          lo = door ? floor : Math.min(2, eave - 3),
          hi = door ? Math.min(4.3, eave - 0.7) : eave - 0.7;
        holes.push({
          ring: rect(((j + 0.5) * L) / count, lo, w, hi - lo),
          kind: door ? 'door' : 'glass',
        });
      }
    wall(o, c, p, rect(L / 2, floor, L, eave - floor), holes, 'brick', N);
    if (c.fine) {
      band(o, c, p, L, eave - 0.25);
      band(o, c, p, L, 0.5, 'stone', 0.18);
      if (top > 10) band(o, c, p, L, 6.4);
    }
  }
}
function wings(o, c) {
  if (c === cfg.skyline) {
    for (const p of controls.wingPolygons) {
      solidPolygon(o, c, p, -6.3, 8, 'brick');
    }
    slab(o, c, simplify(nativePlans[374]), 8, 14, 'brick');
    return;
  }
  for (const i of controls.rangeSeeds) lowRange(o, c, i);
}
function barrelRoof(o, c, x0, x1, z0, z1) {
  const zc = (z0 + z1) / 2,
    r = (z1 - z0) / 2,
    n = c.round,
    profile = Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * Math.PI;
      return [zc + r * Math.cos(t), 18.2 + 5.3 * Math.sin(t)];
    });
  for (let i = 0; i < n; i++) {
    const [z, y] = profile[i],
      [Z, Y] = profile[i + 1];
    Q(
      o,
      c,
      [
        [x0, y, z],
        [x1, y, z],
        [x1, Y, Z],
        [x0, Y, Z],
      ],
      'roof',
      C.roof,
      [0, 1, 0],
    );
    Q(
      o,
      c,
      [
        [x0, y - 0.18, z],
        [x0, Y - 0.18, Z],
        [x1, Y - 0.18, Z],
        [x1, y - 0.18, z],
      ],
      'roof',
      C.roof,
      [0, -1, 0],
    );
  }
  const shape = [[z0, 18], [z1, 18], ...profile];
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    wall(
      o,
      c,
      planeX(x, sign),
      shape.map(([z, y]) => [sign < 0 ? z : -z, y]),
      [],
      'roof',
      [sign, 0, 0],
    );
  if (c.fine)
    for (const x of [x0 + 0.05, x1 - 0.05, ...(c.near ? [x0 + 5, x1 - 5] : [])])
      beamPath(
        adapter(o, c),
        'metal',
        profile.map(([z, y]) => [x, y + 0.08, z]),
        0.09,
        0.11,
        C.metal,
      );
}
function clock(o, c, p, u, y) {
  const n = c.round * 2,
    r = 1.06;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    T(
      o,
      c,
      [
        p([u, y, 0.22]),
        p([u + r * Math.cos(a), y + r * Math.sin(a), 0.22]),
        p([u + r * Math.cos(b), y + r * Math.sin(b), 0.22]),
      ],
      'stone',
      C.stone,
      [-1, 0, 0],
    );
  }
  if (c.fine && c.detail) {
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'metal',
        p([u + 0.83 * Math.sin(a), y + 0.83 * Math.cos(a), 0.25]),
        p([u + 0.97 * Math.sin(a), y + 0.97 * Math.cos(a), 0.25]),
        0.035,
        0.035,
        C.metal,
      );
    }
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.25]),
      p([u - 0.45, y + 0.53, 0.25]),
      0.06,
      0.06,
      C.metal,
    );
    beam(
      adapter(o, c),
      'metal',
      p([u, y, 0.25]),
      p([u + 0.69, y + 0.04, 0.25]),
      0.05,
      0.05,
      C.metal,
    );
  }
}
function pavilion(o, c, index) {
  const r = c === cfg.skyline ? simplify(nativePlans[index], 0.8) : openRing(nativePlans[index]),
    zs = r.map((p) => p[1]),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    zc = (z0 + z1) / 2,
    x0 = Math.min(...r.map((p) => p[0])),
    x1 = Math.max(...r.map((p) => p[0]));
  slab(o, c, r, -6.3, floor, 'base');
  slab(o, c, r, 17.8, 18.2, 'stone');
  for (let i = 0; i < r.length; i++) {
    const e = edge(r, i),
      isFront = Math.max(e.a[0], e.b[0]) < front + 1.2,
      holes = [];
    if (!isFront && e.L > 7 && c.detail) {
      const n = c.fine ? Math.floor(e.L / 4.7) : 1;
      for (let j = 0; j < n; j++)
        for (const y of [1.1, 9])
          holes.push({
            ring: arch(
              ((j + 0.5) * e.L) / n,
              y,
              Math.min(2.6, e.L / n - 1.5),
              y === 9 ? 6.6 : 5.3,
              c.arch,
            ),
            kind: 'glass',
          });
    }
    if (!isFront) wall(o, c, e.p, rect(e.L / 2, floor, e.L, 17.45), holes, 'brick', e.N);
    if (c.detail && !isFront) for (const y of [6.7, 16.9]) band(o, c, e.p, e.L, y);
  }
  // The front galleries are genuinely open arches with closed recessed rooms behind.
  const p = planeX(front),
    centers = [zc - 6, zc, zc + 6],
    holes = centers.flatMap((z) => [
      { ring: arch(z, 7.4, 4.2, 8.7, c.arch), kind: 'open' },
      { ring: rect(z, floor, 3.75, 5.7), kind: 'door' },
    ]);
  wall(o, c, p, rect(zc, floor, z1 - z0, 17.45), holes, 'brick', [-1, 0, 0]);
  for (const z of centers) {
    wall(
      o,
      c,
      planeX(front + 3.6),
      rect(z, 7.4, 4.15, 8.55),
      [{ ring: arch(z, 7.6, 3.2, 7.8, c.arch), kind: 'glass' }],
      'stone',
      [-1, 0, 0],
    );
    if (c.fine)
      for (const y of [1.1, 2.2, 3.3, 4.4]) {
        box(o, c, front - 0.08, front - 0.015, y, y + 0.055, z - 1.65, z + 1.65, 'door');
      }
  }
  box(o, c, front - 0.08, front + 3.8, 7.1, 7.4, z0 + 0.2, z1 - 0.2, 'stone');
  if (c.fine) {
    for (const y of [0.5, 6.6, 7.15, 16.8, 17.7]) {
      box(o, c, front - 0.25, front + 0.18, y, y + 0.23, z0, z1, 'stone');
    }
    for (const z of [z0 + 0.35, zc - 9, zc - 3, zc + 3, zc + 9, z1 - 0.35])
      box(o, c, front - 0.22, front - 0.03, 0.6, 17.6, z - 0.18, z + 0.18, 'metal');
    for (const z of [z0 + 0.1, zc - 9, zc - 3, zc + 3, zc + 9, z1 - 0.1])
      box(o, c, front - 0.35, front + 0.05, 17.1, 17.6, z - 0.55, z + 0.55, 'stone');
  }
  if (c.fine) {
    for (let z = z0 + 0.4; z < z1 - 0.3; z += c.near ? 0.7 : 1.8) {
      box(o, c, front - 0.38, front - 0.22, 7.4, 8.35, z - 0.025, z + 0.025, 'metal');
    }
    box(o, c, front - 0.39, front - 0.2, 8.3, 8.39, z0 + 0.2, z1 - 0.2, 'metal');
  }
  barrelRoof(o, c, x0 + 0.1, x1, z0 + 0.1, z1 - 0.1);
  if (index === 363) {
    box(o, c, front - 0.28, front + 0.6, 20.4, 24.5, zc - 1.55, zc + 1.55, 'stone');
    clock(o, c, planeX(front - 0.3), zc, 22.1);
    box(o, c, front - 0.4, front + 0.7, 24.4, 24.7, zc - 1.8, zc + 1.8, 'stone');
  }
  if (c.fine) {
    for (const z of [zc - 6, zc + 6]) {
      const P = planeX(front - 0.06);
      clock(o, { ...c, detail: false }, P, z, 20.25);
    }
  }
}
const domeProfile = [
  [26.3, 2.8],
  [26.6, 3.05],
  [27.1, 3.1],
  [28.5, 2.88],
  [30.0, 2.25],
  [31.3, 1.4],
  [32.1, 0.55],
  [32.8, 0.14],
];
function tower(o, c, { x, z }) {
  const sides = c.fine ? 8 : 4,
    R = 2.72,
    ring = Array.from({ length: sides }, (_, i) => [
      x + R * Math.cos(((i + 0.5) / sides) * Math.PI * 2),
      z + R * Math.sin(((i + 0.5) / sides) * Math.PI * 2),
    ]);
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring, i),
      holes = c.detail
        ? [{ ring: arch(e.L / 2, 19.1, Math.min(1.5, e.L - 0.5), 5.5, c.arch), kind: 'glass' }]
        : [];
    wall(o, c, e.p, rect(e.L / 2, 17.7, e.L, 8.6), holes, 'stone', e.N);
  }
  if (c.detail) {
    lathe(
      o,
      c,
      x,
      z,
      [
        [17.5, 2.95],
        [18, 2.95],
      ],
      'stone',
      1,
      8,
    );
    lathe(
      o,
      c,
      x,
      z,
      [
        [25.9, 3.1],
        [26.3, 3.1],
      ],
      'stone',
      1,
      8,
    );
  }
  const profile =
    c === cfg.skyline
      ? [domeProfile[0], domeProfile[3], domeProfile[5], domeProfile.at(-1)]
      : interp(domeProfile, c.master ? 48 : c.near ? 20 : c.fine ? 10 : 7);
  lathe(o, c, x, z, profile, 'roof', 1, c.round);
  lathe(
    o,
    c,
    x,
    z,
    [
      [32.8, 0.15],
      [33.25, 0.19],
      [33.65, 0.1],
      [36.8, 0],
    ],
    'metal',
    1,
    c.detail ? 8 : 4,
  );
  if (c.near) {
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      beamPath(
        adapter(o, c),
        'stone',
        profile.map(([y, r]) => [x + (r + 0.04) * Math.cos(a), y, z + (r + 0.04) * Math.sin(a)]),
        0.075,
        0.075,
        C.stone,
      );
      box(
        o,
        c,
        x + 2.8 * Math.cos(a) - 0.15,
        x + 2.8 * Math.cos(a) + 0.15,
        17.7,
        18.6,
        z + 2.8 * Math.sin(a) - 0.15,
        z + 2.8 * Math.sin(a) + 0.15,
        'stone',
      );
    }
  }
}
const shedProfile = [
    [HL, EAVE],
    [HC - 2, PEAK],
    [HC + 2, PEAK],
    [HR, EAVE],
  ],
  roofPoint = (t, x, drop = 0) => {
    const d = t * (shedProfile.length - 1),
      i = Math.min(shedProfile.length - 2, Math.floor(d)),
      u = d - i,
      a = shedProfile[i],
      b = shedProfile[i + 1];
    return [x, a[1] + (b[1] - a[1]) * u - drop, a[0] + (b[0] - a[0]) * u];
  };
function shed(o, c) {
  slab(o, c, controls.foyer, -6.3, floor, 'base');
  for (const z of [HL, HR]) {
    const sign = z === HL ? -1 : 1,
      p = ([u, y, d]) => [sign < 0 ? -u : u, y, z + sign * d],
      center = sign < 0 ? -(H0 + H1) / 2 : (H0 + H1) / 2,
      L = H1 - H0,
      holes = [];
    if (c.detail)
      for (let j = 0; j < (c.fine ? 20 : 8); j++) {
        const n = c.fine ? 20 : 8,
          u = sign < 0 ? -(H0 + ((j + 0.5) * L) / n) : H0 + ((j + 0.5) * L) / n;
        holes.push({ ring: arch(u, 5, Math.min(5.6, L / n - 1), 8.5, c.arch), kind: 'glass' });
      }
    wall(o, c, p, rect(center, floor, L, EAVE - floor), holes, 'brick', [0, 0, sign]);
  }
  const nt = c.roof * 3;
  for (let i = 0; i < nt; i++) {
    const a = i / nt,
      b = (i + 1) / nt,
      s = i % c.roof > 0 && i % c.roof < c.roof - 1 && c.fine ? 'glass' : 'roof',
      col = C[s];
    Q(
      o,
      c,
      [roofPoint(a, H0), roofPoint(b, H0), roofPoint(b, H1), roofPoint(a, H1)],
      s,
      col,
      [0, 1, 0],
    );
    Q(
      o,
      c,
      [
        roofPoint(a, H0, 0.18),
        roofPoint(a, H1, 0.18),
        roofPoint(b, H1, 0.18),
        roofPoint(b, H0, 0.18),
      ],
      s,
      col,
      [0, -1, 0],
    );
    for (const [x, sign] of [
      [H0, -1],
      [H1, 1],
    ])
      Q(
        o,
        c,
        [roofPoint(a, x), roofPoint(a, x, 0.18), roofPoint(b, x, 0.18), roofPoint(b, x)],
        'metal',
        C.metal,
        [sign, 0, 0],
      );
  }
  const upper = [[HL, 10], [HR, 10], ...shedProfile.slice().reverse()],
    frontShape = [[HL, floor], [HR, floor], ...shedProfile.slice().reverse()];
  const doors = Array.from({ length: c.detail ? 6 : 3 }, (_, j) => {
    const n = c.detail ? 6 : 3,
      z = HL + ((j + 0.5) * (HR - HL)) / n;
    return { ring: rect(z, floor, Math.min(4.2, (HR - HL) / n - 1), 5.2), kind: 'glass' };
  });
  wall(o, c, planeX(H0), frontShape, doors, 'glass', [-1, 0, 0]);
  wall(
    o,
    c,
    planeX(H1, 1),
    upper.map(([z, y]) => [-z, y]),
    [],
    'glass',
    [1, 0, 0],
  );
  if (c.detail) {
    const nf = c.near ? 22 : c.fine ? 14 : 6;
    for (let j = 0; j <= nf; j++) {
      const z = HL + (j * (HR - HL)) / nf,
        t =
          z <= HC - 2
            ? (z - HL) / (HC - 2 - HL) / 3
            : z <= HC + 2
              ? 1 / 3 + (z - (HC - 2)) / 4 / 3
              : 2 / 3 + (z - (HC + 2)) / (HR - HC - 2) / 3,
        Y = roofPoint(t, H0)[1];
      beam(adapter(o, c), 'metal', [H0 - 0.04, floor, z], [H0 - 0.04, Y, z], 0.12, 0.16, C.metal);
      beam(adapter(o, c), 'metal', [H1 + 0.04, 10, z], [H1 + 0.04, Y, z], 0.14, 0.18, C.metal);
    }
    for (const x of [H0, H1])
      beam(adapter(o, c), 'metal', [x, 10, HL], [x, 10, HR], 0.35, 0.4, C.metal);
    const nx = c.master ? 50 : c.near ? 28 : c.fine ? 10 : 5;
    for (let j = 0; j <= nx; j++) {
      const x = H0 + ((H1 - H0) * j) / nx;
      beamPath(
        adapter(o, c),
        'metal',
        shedProfile.map(([z, y]) => [x, y, z]),
        0.12,
        0.17,
        C.metal,
      );
    }
  }
  if (c.fine) {
    for (const t of [1 / 6, 1 / 3, 2 / 3, 5 / 6])
      beam(adapter(o, c), 'metal', roofPoint(t, H0), roofPoint(t, H1), 0.08, 0.1, C.metal);
    for (const x of [H0, H1])
      for (const y of [14.9, 18.1, 21.3]) {
        const z = ((y - EAVE) / (PEAK - EAVE)) * (HC - 2 - HL) + HL;
        beam(
          adapter(o, c),
          'metal',
          [x, y, Math.max(HL, z)],
          [x, y, Math.min(HR, HR - (z - HL))],
          0.08,
          0.1,
          C.metal,
        );
      }
  }
}
function canopy(o, c, index) {
  const ring = c === cfg.skyline ? simplify(nativePlans[index], 1.5) : openRing(nativePlans[index]),
    top = index === 352 ? 8 : index === 368 ? 7 : 5.6;
  slab(o, c, ring, top - 0.2, top, 'canopy');
  if (c.detail) {
    for (let i = 0; i < ring.length; i++) {
      const e = edge(ring, i);
      if (e.L < 4) continue;
      const n = c.near ? Math.ceil(e.L / 8) : c.fine ? Math.ceil(e.L / 16) : Math.ceil(e.L / 28);
      for (let j = 0; j < n; j++) {
        const [x, y, z] = e.p([((j + 0.5) * e.L) / n, top - 0.2, -0.2]);
        beam(adapter(o, c), 'metal', [x, -6.3, z], [x, y, z], 0.14, 0.18, C.metal);
        if (c.near)
          beam(
            adapter(o, c),
            'metal',
            [x, top - 1.1, z],
            [x + 0.65, top - 0.2, z],
            0.1,
            0.12,
            C.metal,
          );
      }
    }
  }
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Nyugati level ' + level);
  wings(o, c);
  onStage?.('wings');
  for (const i of [362, 363]) pavilion(o, c, i);
  onStage?.('pavilions');
  for (const t of controls.towers) tower(o, c, t);
  onStage?.('towers');
  shed(o, c);
  onStage?.('shed');
  for (const i of controls.canopySeeds) canopy(o, c, i);
  onStage?.('canopies');
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

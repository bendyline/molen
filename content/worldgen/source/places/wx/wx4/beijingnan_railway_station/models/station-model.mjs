/** Original whole Beijing South oval station and thirteen mapped platform islands. */
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
  stone: lin('c8cdc5'),
  wall: lin('d2d5cb'),
  base: lin('9daba6'),
  roof: lin('ccd2cc'),
  soffit: lin('89938f'),
  metal: lin('7e938c'),
  glass: lin('577e87'),
  doorGlass: lin('577e87'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 },
  base: { slot: 'wall', graph: 'stone_granite', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76 },
  soffit: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.73 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38 },
  doorGlass: { slot: 'window', graph: 'window_grid', roughness: 0.38 },
};
const cfg = {
  skyline: { round: 4, step: 130 },
  district: { round: 5, step: 65, detail: true },
  street: { round: 8, step: 24, detail: true, fine: true },
  closeup: { round: 12, step: 10, detail: true, fine: true, near: true },
  master: { round: 24, step: 4, detail: true, fine: true, near: true, master: true },
};
export const controls = {
  anchor: [116.372573, 39.863546],
  heading: 0.7335683041041644,
  groups: {
    main: [
      [
        [
          [-222.725195, 6.845548],
          [-221.210192, -14.004495],
          [-214.856776, -35.430103],
          [-205.556685, -56.359449],
          [-191.912129, -78.000974],
          [-169.902315, -101.050077],
          [-147.743795, -118.102613],
          [-113.045822, -137.428313],
          [-70.258331, -154.090285],
          [-26.84733, -161.859372],
          [25.470772, -166.844858],
          [75.242859, -161.474943],
          [117.738289, -152.482094],
          [162.27194, -135.481266],
          [194.045602, -117.331837],
          [218.561766, -98.319198],
          [236.263961, -79.277719],
          [251.374475, -57.018644],
          [262.430647, -34.711568],
          [267.202616, -14.674931],
          [267.920228, 5.409723],
          [265.55221, 28.575358],
          [260.527573, 50.580627],
          [252.251636, 69.346821],
          [238.454054, 91.158119],
          [215.933899, 113.746485],
          [191.610551, 132.858437],
          [162.076992, 148.508432],
          [120.277083, 165.443985],
          [74.187567, 177.896234],
          [26.587275, 183.124573],
          [-21.2626, 180.414413],
          [-72.256014, 167.157154],
          [-112.261037, 153.005219],
          [-145.823628, 134.786633],
          [-173.147578, 111.700563],
          [-192.518467, 91.771918],
          [-205.943186, 70.723346],
          [-216.164654, 48.859457],
          [-220.799584, 28.328477],
          [-222.725195, 6.845548],
        ],
      ],
    ],
  },
  platforms: [
    {
      id: 35184415134058,
      polys: [
        [
          [
            [-224.625553, 85.973184],
            [-224.565733, 74.610651],
            [252.179864, 74.218762],
            [252.273723, 85.410798],
            [-224.625553, 85.973184],
          ],
        ],
      ],
      bounds: [-224.625553, 74.218762, 252.273723, 85.973184],
    },
    {
      id: 35184415134059,
      polys: [
        [
          [
            [-225.373096, -50.463019],
            [268.23461, -51.077591],
            [268.328545, -39.885638],
            [-225.279401, -39.2708],
            [-225.373096, -50.463019],
          ],
        ],
      ],
      bounds: [-225.373096, -51.077591, 268.328545, -39.2708],
    },
    {
      id: 35184415134060,
      polys: [
        [
          [
            [-225.670642, 115.886517],
            [252.387338, 115.750172],
            [252.497968, 127.265911],
            [-225.543463, 127.726205],
            [-225.670642, 115.886517],
          ],
        ],
      ],
      bounds: [-225.670642, 115.750172, 252.497968, 127.726205],
    },
    {
      id: 35184415134061,
      polys: [
        [
          [
            [-237.519927, -71.902393],
            [282.662465, -73.245824],
            [282.636572, -61.236313],
            [-237.375859, -59.739135],
            [-237.519927, -71.902393],
          ],
        ],
      ],
      bounds: [-237.519927, -73.245824, 282.662465, -59.739135],
    },
    {
      id: 35184415134062,
      polys: [
        [
          [
            [-225.563531, 42.856059],
            [-225.520523, 31.169869],
            [269.911151, 31.270199],
            [269.88519, 43.279784],
            [-225.563531, 42.856059],
          ],
        ],
      ],
      bounds: [-225.563531, 31.169869, 269.911151, 43.279784],
    },
    {
      id: 35184415134063,
      polys: [
        [
          [
            [-237.793636, -92.821836],
            [278.214115, -93.299185],
            [278.0012, -81.766803],
            [-237.683134, -81.305954],
            [-237.793636, -92.821836],
          ],
        ],
      ],
      bounds: [-237.793636, -93.299185, 278.214115, -81.305954],
    },
    {
      id: 35184415134064,
      polys: [
        [
          [
            [-224.886426, 137.266511],
            [252.814722, 136.499122],
            [252.771898, 148.185107],
            [-224.776045, 148.782526],
            [-224.886426, 137.266511],
          ],
        ],
      ],
      bounds: [-224.886426, 136.499122, 252.814722, 148.782526],
    },
    {
      id: 35184415134065,
      polys: [
        [
          [
            [-225.17597, -18.504755],
            [-225.149785, -30.514588],
            [269.105697, -31.163206],
            [269.079772, -19.15366],
            [-225.17597, -18.504755],
          ],
        ],
      ],
      bounds: [-225.17597, -31.163206, 269.105697, -18.504755],
    },
    {
      id: 35184415134066,
      polys: [
        [
          [
            [-224.662276, 22.686926],
            [-224.636068, 10.677066],
            [12.101997, 10.240895],
            [269.653883, 10.674825],
            [269.627934, 22.684397],
            [-224.662276, 22.686926],
          ],
        ],
      ],
      bounds: [-224.662276, 10.240895, 269.653883, 22.686926],
    },
    {
      id: 35184415134067,
      polys: [
        [
          [
            [-239.014182, -100.710045],
            [-238.865834, -116.620798],
            [277.601718, -117.608265],
            [277.777407, -101.714698],
            [-239.014182, -100.710045],
          ],
        ],
      ],
      bounds: [-239.014182, -117.608265, 277.777407, -100.710045],
    },
    {
      id: 35184415134068,
      polys: [
        [
          [
            [-225.076692, 52.24288],
            [269.334016, 51.422051],
            [269.988984, 64.045426],
            [-224.966264, 63.758844],
            [-225.076692, 52.24288],
          ],
        ],
      ],
      bounds: [-225.076692, 51.422051, 269.988984, 64.045426],
    },
    {
      id: 35184415134070,
      polys: [
        [
          [
            [-224.845931, 106.756163],
            [-224.802887, 95.069933],
            [253.050821, 94.13329],
            [253.008022, 105.819248],
            [-224.845931, 106.756163],
          ],
        ],
      ],
      bounds: [-224.845931, 94.13329, 253.050821, 106.756163],
    },
    {
      id: 35184415134071,
      polys: [
        [
          [
            [-225.276372, 1.460504],
            [-225.19981, -9.578295],
            [270.367622, -9.970888],
            [270.308095, 1.39132],
            [-225.276372, 1.460504],
          ],
        ],
      ],
      bounds: [-225.276372, -9.970888, 270.367622, 1.460504],
    },
  ],
  ownedParts: [253],
  preservedNeighbors: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
    50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73,
    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
    98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116,
    117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135,
    136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154,
    155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173,
    174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192,
    193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211,
    212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230,
    231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
    250, 251, 252, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269,
    270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288,
    289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307,
    308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326,
    327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345,
    346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364,
    365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383,
    384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402,
    403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421,
    422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440,
    441, 442, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459,
    460, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 478,
    479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497,
    498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516,
    517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535,
    536, 537, 538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553,
  ],
  referenceLocal: [25, 250],
  platformBounds: [-239.014182, -117.608265, 282.662465, 148.782526],
  scope:
    'Whole individual Beijing South passenger station: complete mapped oval roof and both curved entrance fronts,rolled eaves/soffit and roof bands,raised transverse concourse,attached curved approach deck sections and supports,all thirteen whole native platforms and their connecting stairs. Preserve independent buildings,streets,rail lines and water. No blanket oval floor or terrain opening.',
  nativeFacts: [
    { index: 253, id: 35184415134069, properties: { sort_rank: 400, kind: 'building', layer: 2 } },
  ],
  interpretation:
    'Current named Beijing South POIs and one whole oval layer2 footprint35184415134069 associate Q163962 with this physical terminal;no exact-Q-tagged building is claimed. The thirteen full station platform polygons and railway alignment resolve signed NE/SW track and SE/NW entrance axes. Ordinary whole-roof aerial and southern-front photograph supply broad banded curved roof,rolled metal eave/deep soffit,two-level curved glazing and white approach deck/columns. Source floor+.9m and upper concourse/attached approach decks14m,wall27.3m,roof edge28m/crest42m are explicit picture/map-scale estimates,not native height facts. Use one unchanged global viewer datum at outside forecourt[25,250],45.720697m absolute. Actual grade,rail clearances,hidden elevations,internal concourse extent,roof-band controls and intermediate facade details remain unverified. Closed ground floors are only the two front/rear crescents beyond the mapped track/platform corridor;the layer2 oval roof is not a blanket ground floor. An elevated transverse concourse and13separate platform stairs provide visible physical connectivity. No copied lettering,emblems,brands,signs,trains,people,private images or navigable passenger interiors.',
  datum: 45.720697,
  floor: 0.9,
  upperFloor: 14,
  roofEdge: 28,
  roofCrest: 42,
  floorBands: [-126, 157],
  groundFloors: [
    [
      [
        [-133.5645766070543, -126],
        [-113.045822, -137.428313],
        [-70.258331, -154.090285],
        [-26.84733, -161.859372],
        [25.470772, -166.844858],
        [75.242859, -161.474943],
        [117.738289, -152.482094],
        [162.27194, -135.481266],
        [178.87050853987483, -126],
        [-133.5645766070543, -126],
      ],
    ],
    [
      [
        [-100.96849603051683, 157],
        [141.11831591382128, 157],
        [120.277083, 165.443985],
        [74.187567, 177.896234],
        [26.587275, 183.124573],
        [-21.2626, 180.414413],
        [-72.256014, 167.157154],
        [-100.96849603051683, 157],
      ],
    ],
  ],
  concourse: [
    [
      [
        [-30, -161.29515171140795],
        [-26.84733, -161.859372],
        [25.470772, -166.844858],
        [60, -163.11949644593014],
        [60, 179.45457338710318],
        [26.587275, 183.124573],
        [-21.2626, 180.414413],
        [-30, 178.14286525097893],
        [-30, -161.29515171140795],
      ],
    ],
  ],
  sourceHeights: {
    stationFloor: 0.9,
    upperConcourse: 14,
    curtainWall: 27.3,
    roofEdge: 28,
    roofCrest: 42,
  },
};
export const stationPlans = controls.groundFloors.map((p) => p[0]);
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
function bounds(polys) {
  const a = polys.flat(2);
  return [
    Math.min(...a.map((p) => p[0])),
    Math.min(...a.map((p) => p[1])),
    Math.max(...a.map((p) => p[0])),
    Math.max(...a.map((p) => p[1])),
  ];
}
const boxPlan = bounds(controls.groups.main),
  cx = (boxPlan[0] + boxPlan[2]) / 2,
  cz = (boxPlan[1] + boxPlan[3]) / 2,
  rx = (boxPlan[2] - boxPlan[0]) / 2,
  rz = (boxPlan[3] - boxPlan[1]) / 2;
function roofY(x, z) {
  const u = (x - cx) / rx,
    v = (z - cz) / rz,
    s = Math.max(0, 1 - u * u - v * v);
  return controls.roofEdge + 8 * s + 6 * s * Math.pow(Math.cos(v * Math.PI * 2.5), 2);
}
function clipAxis(r, axis, k, less) {
  const next = [];
  for (let j = 0; j < r.length; j++) {
    const a = r[j],
      b = r[(j + 1) % r.length],
      ia = less ? a[axis] <= k : a[axis] >= k,
      ib = less ? b[axis] <= k : b[axis] >= k;
    if (ia) next.push(a);
    if (ia !== ib) {
      const t = (k - a[axis]) / (b[axis] - a[axis]);
      next.push(a.map((v, i) => v + (b[i] - v) * t));
    }
  }
  return next;
}
function roof(o, c) {
  const R = openRing(controls.groups.main[0][0]),
    knots = (min, max, step, extra) =>
      [
        min,
        ...Array.from({ length: Math.floor((max - min) / step) }, (_, i) => min + (i + 1) * step),
        ...extra.filter((v) => v > min && v < max),
        max,
      ]
        .sort((a, b) => a - b)
        .filter((v, i, a) => !i || v - a[i - 1] > 1e-5),
    xs = knots(boxPlan[0], boxPlan[2], c.step, [cx]),
    zs = knots(
      boxPlan[1],
      boxPlan[3],
      c.step,
      c === cfg.skyline
        ? [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map((v) => cz + v * rz)
        : [cz],
    );
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      let p = R;
      for (const [axis, k, less] of [
        [0, xs[i - 1], false],
        [0, xs[i], true],
        [1, zs[j - 1], false],
        [1, zs[j], true],
      ]) {
        p = clipAxis(p, axis, k, less);
        if (p.length < 3) break;
      }
      if (p.length < 3) continue;
      const ids = earcut(p.flat());
      for (let q = 0; q < ids.length; q += 3) {
        const ps = ids.slice(q, q + 3).map((k) => [p[k][0], roofY(...p[k]), p[k][1]]);
        T(o, c, ps, 'roof', C.roof, [0, 1, 0]);
        if (c !== cfg.skyline)
          T(
            o,
            c,
            ps.map((p) => [p[0], p[1] - 0.65, p[2]]),
            'soffit',
            C.soffit,
            [0, -1, 0],
          );
      }
    }
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    Q(
      o,
      c,
      [
        [a[0], roofY(...a), a[1]],
        [b[0], roofY(...b), b[1]],
        [b[0], roofY(...b) - 0.65, b[1]],
        [a[0], roofY(...a) - 0.65, a[1]],
      ],
      'soffit',
      C.soffit,
    );
  }
  if (c.fine) {
    beamPath(
      adapter(o, c),
      'metal',
      R.map(([x, z]) => [x, roofY(x, z) - 0.2, z]),
      c.master ? 0.35 : 0.28,
      0.4,
      C.metal,
      true,
    );
    for (const v of [-0.6, -0.2, 0.2, 0.6]) {
      const z = cz + v * rz,
        span = crossSection(controls.groups.main, z, 1),
        path = [];
      for (let x = span[0] + 2; x < span[1] - 1; x += c.master ? 3 : c.near ? 8 : 20)
        path.push([x, roofY(x, z) + 0.035, z]);
      if (path.length > 1) beamPath(adapter(o, c), 'metal', path, 0.18, 0.18, C.metal);
    }
  }
}
function crossSection(polys, v, axis) {
  const a = [];
  for (const p of polys)
    for (const r of p)
      for (let i = 1; i < r.length; i++) {
        const p = r[i - 1],
          q = r[i];
        if ((p[axis] <= v && q[axis] > v) || (q[axis] <= v && p[axis] > v))
          a.push(p[1 - axis] + ((q[1 - axis] - p[1 - axis]) * (v - p[axis])) / (q[axis] - p[axis]));
      }
  return [Math.min(...a), Math.max(...a)];
}
function facade(o, c) {
  for (const r of controls.groups.main[0]) {
    const R = openRing(r);
    for (let i = 0; i < R.length; i++) {
      const stations = [R[i], R[(i + 1) % R.length]];
      for (const z of controls.floorBands) {
        const a = stations[0],
          b = stations.at(-1);
        if ((a[1] < z && b[1] > z) || (a[1] > z && b[1] < z)) {
          const t = (z - a[1]) / (b[1] - a[1]);
          stations.push([a[0] + (b[0] - a[0]) * t, z]);
        }
      }
      stations.sort(
        (p, q) =>
          Math.hypot(p[0] - R[i][0], p[1] - R[i][1]) - Math.hypot(q[0] - R[i][0], q[1] - R[i][1]),
      );
      for (let j = 1; j < stations.length; j++) {
        const a = stations[j - 1],
          b = stations[j],
          z = (a[1] + b[1]) / 2,
          closed = z < controls.floorBands[0] || z > controls.floorBands[1],
          lo = closed ? controls.floor : controls.upperFloor,
          hi = 27.3;
        Q(
          o,
          c,
          [
            [a[0], lo, a[1]],
            [b[0], lo, b[1]],
            [b[0], hi, b[1]],
            [a[0], hi, a[1]],
          ],
          'glass',
          C.glass,
        );
        Q(
          o,
          c,
          [
            [a[0], hi, a[1]],
            [b[0], hi, b[1]],
            [b[0], roofY(...b) - 0.65, b[1]],
            [a[0], roofY(...a) - 0.65, a[1]],
          ],
          'glass',
          C.glass,
        );
        if (c.detail) {
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
            n = Math.max(1, Math.ceil(L / (c.master ? 3 : c.near ? 5 : c.fine ? 12 : 35)));
          for (let k = 0; k < n; k++) {
            if (!c.fine && i % 4 !== 0) continue;
            const t = k / n,
              x = a[0] + (b[0] - a[0]) * t,
              z = a[1] + (b[1] - a[1]) * t;
            beam(
              adapter(o, c),
              'metal',
              [x, lo, z],
              [x, roofY(x, z) - 0.7, z],
              c.near ? 0.22 : 0.3,
              0.22,
              C.metal,
            );
          }
          for (const y of [14, 20, 26])
            if (y > lo + 0.1 && y < hi) {
              if (c.fine)
                beam(adapter(o, c), 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.15, 0.15, C.metal);
              else {
                const dx = b[0] - a[0],
                  dz = b[1] - a[1],
                  L = Math.hypot(dx, dz),
                  nx = (dz / L) * 0.05,
                  nz = (-dx / L) * 0.05;
                Q(
                  o,
                  c,
                  [
                    [a[0] + nx, y - 0.08, a[1] + nz],
                    [b[0] + nx, y - 0.08, b[1] + nz],
                    [b[0] + nx, y + 0.08, b[1] + nz],
                    [a[0] + nx, y + 0.08, a[1] + nz],
                  ],
                  'metal',
                  C.metal,
                );
              }
            }
        }
      }
    }
  }
}
function deckRail(o, c, a, b, y) {
  if (!c.detail) return;
  beam(adapter(o, c), 'metal', [a[0], y + 1.05, a[1]], [b[0], y + 1.05, b[1]], 0.07, 0.07, C.metal);
  if (c.fine) {
    const n = Math.max(
      1,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (c.master ? 2.5 : c.near ? 5 : 15)),
    );
    for (let j = 0; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      beam(adapter(o, c), 'metal', [x, y, z], [x, y + 1.05, z], 0.065, 0.065, C.metal);
    }
  }
}
function approachDecks(o, c) {
  const R = openRing(controls.groups.main[0][0]);
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      z = (a[1] + b[1]) / 2;
    if (z > -120 && z < 152) continue;
    const outer = (p) => {
        const dx = p[0] - cx,
          dz = p[1] - cz,
          L = Math.hypot(dx, dz);
        return [p[0] + (dx / L) * 9, p[1] + (dz / L) * 9];
      },
      A = outer(a),
      B = outer(b);
    slab(o, c, [a, b, B, A], 13.2, 14, 'stone');
    deckRail(o, c, A, B, 14);
    if (c.detail) {
      const x = (A[0] + B[0]) / 2,
        z = (A[1] + B[1]) / 2;
      box(o, c, x - 0.65, x + 0.65, controls.floor, 13.2, z - 0.65, z + 0.65, 'stone');
    }
  }
}
function stair(o, c, x, z) {
  const lo = controls.floor,
    hi = controls.upperFloor,
    w = 2.8,
    n = c.master ? 80 : c.near ? 64 : c.fine ? 40 : c.detail ? 10 : 1,
    x0 = x + 32;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x - x0) * i) / n,
      b = x0 + ((x - x0) * (i + 1)) / n,
      y = lo + ((hi - lo) * (i + 1)) / n,
      Y = lo + ((hi - lo) * i) / n;
    Q(
      o,
      c,
      [
        [a, n === 1 ? lo : y, z - w / 2],
        [b, y, z - w / 2],
        [b, y, z + w / 2],
        [a, n === 1 ? lo : y, z + w / 2],
      ],
      'stone',
      C.stone,
      [0, 1, 0],
    );
    if (n > 1)
      Q(
        o,
        c,
        [
          [a, Y, z - w / 2],
          [a, Y, z + w / 2],
          [a, y, z + w / 2],
          [a, y, z - w / 2],
        ],
        'stone',
        C.stone,
      );
  }
  if (c.detail)
    for (const s of [-1, 1]) {
      const A = [x0, lo + 1.05, z + (s * w) / 2],
        B = [x, hi + 1.05, z + (s * w) / 2];
      beam(adapter(o, c), 'metal', A, B, 0.075, 0.075, C.metal);
      if (c.fine)
        for (let i = 0; i <= 8; i++) {
          const t = i / 8,
            p = A.map((v, j) => v + (B[j] - v) * t);
          beam(adapter(o, c), 'metal', [p[0], p[1] - 1.05, p[2]], p, 0.065, 0.065, C.metal);
        }
    }
}
function platformsAndFloors(o, c) {
  for (const p of controls.groundFloors) solid(o, c, p, -10, controls.floor, 'base');
  for (const p of controls.concourse) solid(o, c, p, 13.2, 14, 'stone');
  for (const p of controls.platforms) {
    for (const poly of p.polys) {
      solid(o, c, poly, -10, controls.floor, 'base');
      if (c.detail)
        for (const r of poly)
          beamPath(
            adapter(o, c),
            'stone',
            openRing(r).map(([x, z]) => [x, controls.floor + 0.025, z]),
            0.24,
            0.04,
            C.stone,
            true,
          );
    }
    const a = crossSection(p.polys, 60, 0),
      z = (a[0] + a[1]) / 2;
    stair(o, c, 60, z);
    if (c.detail)
      for (const x of [-25, 55]) {
        box(o, c, x - 0.35, x + 0.35, controls.floor, 13.2, z - 0.35, z + 0.35, 'stone');
        if (c.fine) {
          const y = roofY(x, z) - 0.8;
          box(o, c, x - 0.22, x + 0.22, 14, y, z - 0.22, z + 0.22, 'metal');
          for (const sign of [-1, 1])
            beam(
              adapter(o, c),
              'metal',
              [x, y - 3, z],
              [x + sign * 8, roofY(x + sign * 8, z) - 0.8, z],
              0.2,
              0.24,
              C.metal,
            );
        }
      }
  }
}
export function buildStationLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown station tier ' + level);
  platformsAndFloors(o, c);
  roof(o, c);
  facade(o, c);
  approachDecks(o, c);
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

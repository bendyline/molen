/** Original complete Taipei Main Station headhouse,curved hipped roof and six central glazed gables. */
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
  wall: lin('b9b4a2'),
  stone: lin('b9b4a2'),
  base: lin('a3a79e'),
  trim: lin('dadbd1'),
  roof: lin('b07458'),
  canopy: lin('a8b7b1'),
  metal: lin('8b9b91'),
  glass: lin('526b6d'),
  doorGlass: lin('526b6d'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.9 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 },
  trim: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.87 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.79 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.42 },
  doorGlass: { slot: 'window', graph: 'window_grid', roughness: 0.42 },
};
const cfg = {
  skyline: { round: 4, pitch: 28, roofSteps: 2 },
  district: { round: 5, pitch: 12, roofSteps: 3, detail: true },
  street: { round: 8, pitch: 7, roofSteps: 5, detail: true, recess: true, fine: true },
  closeup: {
    round: 14,
    pitch: 6,
    roofSteps: 9,
    detail: true,
    recess: true,
    fine: true,
    near: true,
  },
  master: {
    round: 24,
    pitch: 6,
    roofSteps: 24,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const controls = {
  anchor: [121.517113786, 25.047715127],
  heading: -0.186553387574,
  groups: {
    main: [
      [
        [
          [-78.786301, 63.407262],
          [-78.62423, -64.077091],
          [78.836804, -64.067631],
          [78.674783, 63.416985],
          [-28.387312, 63.52933],
          [-31.677359, 63.599761],
          [-33.803829, 64.001128],
          [-78.786301, 63.407262],
        ],
      ],
    ],
  },
  ownedParts: [0],
  preservedNeighbors: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
    51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
    75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98,
    99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
    118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136,
    137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155,
    156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174,
    175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193,
    194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212,
    213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
    232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250,
    251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269,
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
    536, 537, 538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554,
    555, 556, 557, 558, 559, 560, 561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572, 573,
    574, 575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586, 587, 588, 589, 590, 591, 592,
    593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611,
    612, 613, 614, 615, 616, 617, 618, 619, 620, 621, 622, 623, 624, 625, 626, 627, 628, 629, 630,
    631, 632, 633, 634, 635, 636, 637, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    650, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668,
    669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687,
    688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706,
    707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725,
    726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744,
    745, 746, 747, 748, 749, 750, 751, 752, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763,
    764, 765, 766, 767, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 782,
    783, 784, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801,
    802, 803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 814, 815, 816, 817, 818, 819, 820,
    821, 822, 823, 824, 825, 826, 827, 828, 829, 830, 831, 832, 833, 834, 835, 836, 837, 838, 839,
    840, 841, 842, 843, 844, 845, 846, 847, 848, 849, 850, 851, 852, 853, 854, 855, 856, 857, 858,
    859, 860, 861, 862, 863, 864, 865, 866, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877,
    878, 879, 880, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896,
    897, 898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915,
    916, 917, 918, 919, 920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 930, 931, 932, 933, 934,
    935, 936, 937, 938, 939, 940, 941, 942, 943, 944, 945, 946, 947, 948, 949, 950, 951, 952, 953,
    954, 955, 956, 957, 958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 970, 971, 972,
    973, 974, 975, 976, 977, 978, 979, 980, 981, 982, 983, 984, 985, 986, 987, 988, 989, 990, 991,
    992, 993, 994, 995, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008,
    1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024,
    1025, 1026, 1027, 1028, 1029, 1030, 1031, 1032, 1033, 1034, 1035, 1036, 1037, 1038, 1039, 1040,
    1041, 1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056,
    1057, 1058, 1059, 1060, 1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072,
    1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080, 1081, 1082, 1083, 1084, 1085, 1086, 1087, 1088,
    1089, 1090,
  ],
  referenceLocal: [-90, -60],
  scope:
    'Complete individual above-ground Taipei Main Station terminal: whole exact-Q main headhouse footprint,all four facades and colonnades,large four-sided curved red hipped roof and pale upper collar,central six-gable glazed main-hall roof,visible rooftop service blocks and simplified structural communications frames. Underground railway/metro rooms,public MRT/mall entrances and forecourt canopies,external elevated roads and independent surrounding buildings remain separate;no trains,people,lettering,emblems,adverts or navigable interiors.',
  interpretation:
    'Retained exact-Q way/23641610 supplies Q700588,footprint and undirected axis. Current standard PMTiles whole building35184395730442 has native height30m. Retained tags also give7above-ground levels,4underground levels and roof:height18m;these are source facts,not independent proof of visible eave/crest levels. Ordinary2007roof-overview and September2026southern-front pictures agree on the main hipped/collar roof and stacked beige facade grids;hidden roof details and intermediate levels remain picture-based estimates. Resolve visible wall/roof proportions explicitly before final authoring. +X ESE follows the long facade;+Z SSW faces Zhongxiao West Road;-Z NNE faces Beiping Road and the current independent QSquare building. The older roof photograph includes neighboring construction that is excluded from this model. Source exterior proportions use estimated eaves22m,curved hip inner edge38m and pale collar42m,with central glazed gables to40m and simplified communications frames to48m. The native30m envelope and18m roof-height tag are retained as conflicting coarse map controls rather than treated as surveyed visible levels;seven levels do not establish seven exposed facade rows. Pictures show three strong visible facade bands,which the model retains. Main floor+.65m uses one unchanged outside western street datum[-90,-60],5.704483m absolute. Exact wall/roof heights,threshold steps,hidden facade bays,current rooftop equipment and native contact remain unverified. The original southern sample [0,90] is27.724827m, inconsistent with two western street samples [-90,-60]5.704483m and[-60,-80]5.923095m. Use the single western street reference; retain the unmodified field and explicit native-contact uncertainty.',
  nativeFacts: [
    {
      index: 0,
      id: 35184395730442,
      properties: {
        sort_rank: 400,
        kind: 'building',
        height: 30,
      },
    },
  ],
  retainedTags: {
    'addr:city': '臺北市',
    'addr:country': 'TW',
    'addr:district': '中正區',
    'addr:full': '10041臺北市中正區北平西路3號',
    'addr:housenumber': '3',
    'addr:postcode': '10041',
    'addr:street': '北平西路',
    alt_name: '台北車站',
    'alt_name:nan': '台北車頭',
    building: 'train_station',
    'building:levels': '7',
    'building:levels:underground': '4',
    'building:material': 'plaster',
    height: '30',
    name: '臺北車站',
    'name:en': 'Taipei main station',
    'name:ja': '台北駅',
    'name:ko': '타이베이역',
    'name:nan': 'Tâi-pak Chhia-thâu',
    'name:zh': '臺北車站',
    'name:zh-Latn-pinyin': 'Tǎiběi Huǒchēzhàn',
    operator: '臺灣鐵路管理局;台灣高速鐵路股份有限公司',
    'roof:height': '18',
    'roof:material': 'brick',
    'roof:shape': 'pyramidal',
    short_name: '北車',
    start_date: '1989-09-02',
    wikidata: 'Q700588',
    wikipedia: 'zh:臺北車站',
  },
  groundFloors: [
    [
      [
        [-78.786301, 63.407262],
        [-78.62423, -64.077091],
        [78.836804, -64.067631],
        [78.674783, 63.416985],
        [-28.387312, 63.52933],
        [-31.677359, 63.599761],
        [-33.803829, 64.001128],
        [-78.786301, 63.407262],
      ],
    ],
  ],
  datum: 5.704483,
  floor: 0.65,
  sourceHeights: {
    mappedEnvelope: 30,
    mappedRoofHeight: 18,
    estimatedEaves: 22,
    estimatedInnerRoof: 38,
    estimatedCollarTop: 42,
    estimatedCentralGable: 40,
    estimatedMast: 48,
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
const xmin = -78.7,
  xmax = 78.8,
  zmin = -64,
  zmax = 64;
function face(o, c, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    p = ([u, y, d]) => [a[0] + u * U[0] + d * N[0], y, a[1] + u * U[1] + d * N[1]],
    n = Math.max(2, Math.round(L / c.pitch)),
    pitch = L / n,
    holes = [];
  if (c.detail)
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * pitch;
      holes.push({
        kind: Math.abs(u - L / 2) < pitch ? 'doorGlass' : 'glass',
        ring: rect(u, controls.floor + 0.3, pitch * 0.73, 10.4),
        depth: 0.35,
      });
      for (const y of [12.6, 17.2])
        holes.push({ kind: 'glass', ring: rect(u, y, pitch * 0.82, 3.1), depth: 0.24 });
    }
  wall(o, c, p, L, controls.floor, 21.7, holes, 'wall');
  for (let j = 0; j <= n; j++) {
    const u = j * pitch;
    const r = (du, d) => p([u + du, 0, d]);
    const A = r(-0.52, 0.2),
      B = r(0.52, 0.2),
      D = r(-0.52, -0.7),
      E = r(0.52, -0.7);
    solid(
      o,
      c,
      [
        [
          [A[0], A[2]],
          [B[0], B[2]],
          [E[0], E[2]],
          [D[0], D[2]],
          [A[0], A[2]],
        ],
      ],
      controls.floor,
      21.7,
      'stone',
    );
    if (c.detail) {
      const q = (du, d) => p([u + du, 0, d]),
        r = [q(-0.85, 0.85), q(0.85, 0.85), q(0.85, -0.9), q(-0.85, -0.9)];
      slab(
        o,
        c,
        r.map((p) => [p[0], p[2]]),
        controls.floor,
        1.6,
        'base',
      );
    }
  }
  for (const y of [11.3, 16.1, 21.1]) {
    Q(
      o,
      c,
      [p([0, y, 0.3]), p([L, y, 0.3]), p([L, y + 0.55, 0.3]), p([0, y + 0.55, 0.3])],
      'stone',
      C.stone,
      [N[0], 0, N[1]],
    );
    if (c.fine)
      beam(
        adapter(o, c),
        'trim',
        p([0, y + 0.55, 0.35]),
        p([L, y + 0.55, 0.35]),
        0.1,
        0.14,
        C.trim,
      );
  }
  if (c.fine)
    for (let j = 0; j < n; j++) {
      const lo = j * pitch + 0.75,
        hi = (j + 1) * pitch - 0.75;
      for (const Y of [12.6, 17.2]) {
        for (let u = lo; u < hi; u += c.master ? 0.55 : c.near ? 0.9 : 2.5)
          beam(
            adapter(o, c),
            'stone',
            p([u, Y, -0.05]),
            p([u, Y + 3.1, -0.05]),
            0.12,
            0.16,
            C.stone,
          );
        for (const y of c.near ? [Y + 1, Y + 2] : [Y + 1.55])
          beam(adapter(o, c), 'stone', p([lo, y, -0.03]), p([hi, y, -0.03]), 0.12, 0.16, C.stone);
      }
    }
  if (c.detail) {
    const m = p([L / 2, 0, 0]);
    for (let j = 0; j < 4; j++) {
      const A = p([L / 2 - 8, 0.1 + j * 0.14, 1.0 + (3 - j) * 0.33]),
        B = p([L / 2 + 8, 0.1 + (j + 1) * 0.14, 1.0 + (4 - j) * 0.33]);
      const r = [
        p([L / 2 - 8, 0, 1.0 + (3 - j) * 0.33]),
        p([L / 2 + 8, 0, 1.0 + (3 - j) * 0.33]),
        p([L / 2 + 8, 0, 1.0 + (4 - j) * 0.33]),
        p([L / 2 - 8, 0, 1.0 + (4 - j) * 0.33]),
      ];
      slab(
        o,
        c,
        r.map((q) => [q[0], q[2]]),
        0.1 + j * 0.14,
        0.1 + (j + 1) * 0.14,
        'base',
      );
    }
  }
}
function ring(t, y) {
  return [
    [-80.5 + 30.5 * t, y, -66 + 30 * t],
    [80.5 - 30.5 * t, y, -66 + 30 * t],
    [80.5 - 30.5 * t, y, 66 - 30 * t],
    [-80.5 + 30.5 * t, y, 66 - 30 * t],
  ];
}
function hip(o, c) {
  const rings = Array.from({ length: c.roofSteps + 1 }, (_, j) => {
    const t = j / c.roofSteps;
    return ring(t, 22 + 16 * Math.pow(t, 1.55));
  });
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 4; i++)
      Q(
        o,
        c,
        [rings[j - 1][i], rings[j - 1][(i + 1) % 4], rings[j][(i + 1) % 4], rings[j][i]],
        'roof',
        C.roof,
        [0, 1, 0],
      );
  const outer = rings[0],
    inner = rings.at(-1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      c,
      [[outer[i][0], 21.55, outer[i][2]], [outer[j][0], 21.55, outer[j][2]], outer[j], outer[i]],
      'trim',
      C.trim,
    );
    if (c.detail) {
      beam(adapter(o, c), 'trim', outer[i], outer[j], 0.45, 0.5, C.trim);
      beam(
        adapter(o, c),
        'trim',
        [inner[i][0], 42, inner[i][2]],
        [inner[j][0], 42, inner[j][2]],
        0.32,
        0.42,
        C.trim,
      );
    }
    if (c.fine)
      beamPath(
        adapter(o, c),
        'trim',
        rings.map((r) => r[i]),
        0.17,
        0.2,
        C.trim,
      );
  }
  for (const z of [-36, 36]) box(o, c, -50.35, 50.35, 38, 42, z - 0.35, z + 0.35, 'trim');
  for (const x of [-50, 50]) box(o, c, x - 0.35, x + 0.35, 38, 42, -36, 36, 'trim');
  // Whole interior service terrace and all six physically covered glazed roof lanes.
  box(o, c, -50, 50, 35.9, 36.4, -36, 36, 'base');
  const lane = 86 / 6;
  for (let j = 0; j < 6; j++) {
    const x0 = -43 + j * lane + 0.35,
      x1 = -43 + (j + 1) * lane - 0.35,
      x = (x0 + x1) / 2;
    for (const sign of [-1, 1]) {
      const e = sign < 0 ? x0 : x1;
      Q(
        o,
        c,
        [
          [e, 36.7, -30],
          [e, 36.7, 30],
          [x, 40, 30],
          [x, 40, -30],
        ],
        'glass',
        C.glass,
        [0, 1, 0],
      );
    }
    for (const z of [-30, 30])
      T(
        o,
        c,
        [
          [x0, 36.7, z],
          [x1, 36.7, z],
          [x, 40, z],
        ],
        'glass',
        C.glass,
        [0, 0, z > 0 ? 1 : -1],
      );
    if (c.detail) {
      for (const z of [-30, 30])
        beamPath(
          adapter(o, c),
          'metal',
          [
            [x0, 36.7, z],
            [x, 40, z],
            [x1, 36.7, z],
          ],
          0.13,
          0.16,
          C.metal,
        );
      if (c.fine)
        for (let z = -29; z < 30; z += c.master ? 1.5 : c.near ? 3 : 10)
          beamPath(
            adapter(o, c),
            'metal',
            [
              [x0, 36.7, z],
              [x, 40, z],
              [x1, 36.7, z],
            ],
            0.075,
            0.09,
            C.metal,
          );
    }
  }
  if (c.fine)
    for (const [x, z] of [
      [-46, -23],
      [-46, 23],
      [46, -23],
      [46, 23],
    ]) {
      box(o, c, x - 2, x + 2, 36.4, 39.3, z - 4, z + 4, 'canopy');
      if (c.near)
        for (let y = 37; y < 39.2; y += c.master ? 0.28 : 0.7)
          beam(
            adapter(o, c),
            'metal',
            [x - 2.03, y, z - 3.8],
            [x - 2.03, y, z + 3.8],
            0.07,
            0.09,
            C.metal,
          );
    }
  if (c.detail)
    for (const z of [-23, 23]) {
      const x = -45,
        r = 1.8;
      for (const [dx, dz] of [
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ])
        beam(
          adapter(o, c),
          'metal',
          [x + dx, 36.4, z + dz],
          [x + dx * 0.35, 48, z + dz * 0.35],
          0.13,
          0.15,
          C.metal,
        );
      if (c.fine)
        for (let y = 37; y < 48; y += c.master ? 1.5 : 3)
          for (const s of [-1, 1])
            beam(
              adapter(o, c),
              'metal',
              [x - r, y, z + s * r],
              [x + r * 0.5, y + 1.3, z + s * r * 0.5],
              0.075,
              0.085,
              C.metal,
            );
    }
}
export function buildStationLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown station tier ' + level);
  for (const p of controls.groups.main) solid(o, c, p, -9, controls.floor, 'base');
  const R = [
    [xmin, zmin],
    [xmax, zmin],
    [xmax, zmax],
    [xmin, zmax],
  ];
  for (let i = 0; i < 4; i++) face(o, c, R[i], R[(i + 1) % 4]);
  panel(o, c, controls.groups.main[0], 21.5, 'canopy');
  hip(o, c);
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

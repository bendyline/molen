/** Original whole Yaroslavsky passenger terminal with its individual historic silhouette. */
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
  wall: lin('aaa398'),
  stone: lin('cac8bd'),
  base: lin('b3b6ac'),
  trim: lin('e2dcc9'),
  mural: lin('77a29a'),
  roof: lin('596a65'),
  canopy: lin('c1c5c0'),
  metal: lin('81918c'),
  glass: lin('60757a'),
  doorGlass: lin('60757a'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  wall: { slot: 'wall', graph: 'brick', roughness: 0.88 },
  stone: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 },
  trim: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  mural: { slot: 'wall', graph: 'tile_glazed', roughness: 0.55 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.85 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4 },
  doorGlass: { slot: 'window', graph: 'window_grid', roughness: 0.4 },
};
const cfg = {
  skyline: { round: 4 },
  district: { round: 5, detail: true },
  street: { round: 8, detail: true, recess: true, fine: true },
  closeup: { round: 14, detail: true, recess: true, fine: true, near: true },
  master: { round: 32, detail: true, recess: true, fine: true, near: true, master: true },
};
export const controls = {
  anchor: [37.65736162662506, 55.7767766699601],
  heading: 0.26536400430958873,
  groups: {
    main: [
      [
        [
          [-43.481867, 28.72947],
          [-36.913473, 28.252313],
          [-36.92501908019651, 24.59474038218223],
          [-36.960907, 24.584987],
          [-37.066646, -28.171702],
          [-41.794327, -28.06441],
          [-42.169278, -35.649109],
          [-38.383971, -35.490455],
          [-38.48057, -44.739671],
          [13.303694, -45.109556],
          [13.235305, -55.743193],
          [31.395621, -55.332142],
          [31.206592, -36.067604],
          [31.036263, 4.258369],
          [37.060346, 4.503402],
          [37.068848, 14.076773],
          [31.118732, 14.199885],
          [31.05795824747138, 20.79611579186048],
          [31.065675, 20.798213],
          [31.051561, 21.490457],
          [33.658478, 21.502868],
          [33.70779970617887, 21.516272327268073],
          [46.32492, 21.638895],
          [46.170829, 47.177982],
          [46.097066480689676, 47.15793530892687],
          [46.070328, 50.10902],
          [33.035739, 50.046983],
          [32.905311, 52.447829],
          [31.330546, 53.76006],
          [26.808952, 53.749359],
          [24.112256, 52.146363],
          [19.752712, 52.179703],
          [15.231118, 52.169002],
          [12.551927, 53.703145],
          [7.338091, 53.678333],
          [5.569655, 52.501634],
          [5.538034, 50.056743],
          [-34.051892, 49.738538],
          [-36.452719, 49.608122],
          [-38.235271, 49.123672],
          [-40.283765, 47.696838],
          [-41.876035, 45.871928],
          [-42.540046, 44.473317],
          [-43.027891, 42.426498],
          [-43.481867, 28.72947],
        ],
      ],
    ],
    historic: [
      [
        [
          [31.065675, 20.798213],
          [31.051561, 21.490457],
          [33.658478, 21.502868],
          [46.298391, 24.93806],
          [46.070328, 50.10902],
          [33.035739, 50.046983],
          [32.905311, 52.447829],
          [31.330546, 53.76006],
          [26.808952, 53.749359],
          [24.112256, 52.146363],
          [19.752712, 52.179703],
          [15.231118, 52.169002],
          [12.551927, 53.703145],
          [7.338091, 53.678333],
          [5.569655, 52.501634],
          [5.538034, 50.056743],
          [-34.051892, 49.738538],
          [-36.452719, 49.608122],
          [-38.235271, 49.123672],
          [-40.283765, 47.696838],
          [-41.876035, 45.871928],
          [-42.540046, 44.473317],
          [-43.027891, 42.426498],
          [-43.481867, 28.72947],
          [-36.913473, 28.252313],
          [-36.995395, 2.301024],
          [31.065675, 20.798213],
        ],
      ],
    ],
    canopy: [
      [
        [
          [-61.507038, -68.225401],
          [-54.010396, -68.276221],
          [-54.017222, -75.934828],
          [-49.333585, -75.880059],
          [-49.349403, -77.102476],
          [-39.569949, -77.228949],
          [-39.492565, -73.031514],
          [-25.029474, -73.103218],
          [-24.900769, -77.418656],
          [-14.591125, -77.57505],
          [-14.60182, -73.053526],
          [4.382855, -73.114493],
          [4.393548, -77.636012],
          [14.703191, -77.792401],
          [14.648458, -73.108837],
          [29.229555, -72.97444],
          [29.166277, -77.864088],
          [38.091437, -78.048706],
          [37.948626, -73.041055],
          [42.470211, -73.030321],
          [42.473629, -69.201037],
          [38.438194, -69.079647],
          [38.429209, -62.643484],
          [-61.457881, -62.643484],
          [-61.507038, -68.225401],
        ],
      ],
    ],
    modern: [
      [
        [
          [-42.169278, -35.649109],
          [-38.383971, -35.490455],
          [-38.48057, -44.739671],
          [13.303694, -45.109556],
          [13.235305, -55.743193],
          [31.395621, -55.332142],
          [31.206592, -36.067604],
          [31.036263, 4.258369],
          [37.060346, 4.503402],
          [37.068848, 14.076773],
          [31.118732, 14.199885],
          [31.05795824747138, 20.79611579186048],
          [-36.995395, 2.301024],
          [-36.92501908019651, 24.59474038218223],
          [-36.960907, 24.584987],
          [-37.066646, -28.171702],
          [-41.794327, -28.06441],
          [-42.169278, -35.649109],
        ],
      ],
      [
        [
          [33.70779970617887, 21.516272327268073],
          [46.32492, 21.638895],
          [46.170829, 47.177982],
          [46.097066480689676, 47.15793530892687],
          [46.070328, 50.10902],
          [46.298391, 24.93806],
          [33.70779970617887, 21.516272327268073],
        ],
      ],
    ],
  },
  platforms: [
    {
      id: 52776559531090,
      polys: [
        [
          [
            [4.441599, -383.881155],
            [7.578687, -383.8986],
            [7.615414, -359.701944],
            [14.419782, -359.766756],
            [14.339015, -383.801366],
            [16.989954, -383.950933],
            [16.561854, -91.034521],
            [4.911772, -91.068421],
            [4.441599, -383.881155],
          ],
        ],
      ],
      bounds: [4.441599, -383.950933, 16.989954, -91.034521],
    },
    {
      id: 52776559531145,
      polys: [
        [
          [
            [-68.590308, -182.39022],
            [-67.92149, -241.198468],
            [-63.723152, -289.302229],
            [-56.368554, -332.371496],
            [-54.30594, -331.636926],
            [-53.45512, -335.407856],
            [-50.862318, -334.703201],
            [-53.074843, -322.079963],
            [-60.788963, -269.363787],
            [-63.115002, -219.184871],
            [-63.621464, -176.341468],
            [-63.372091, -78.65125],
            [-67.407528, -78.529855],
            [-68.590308, -182.39022],
          ],
        ],
      ],
      bounds: [-68.590308, -335.407856, -50.862318, -78.529855],
    },
    {
      id: 52776559531163,
      polys: [
        [
          [
            [8.994006, -591.44438],
            [18.007161, -591.952781],
            [26.96391, -509.653601],
            [34.549922, -428.073537],
            [33.66178, -90.563589],
            [25.354892, -90.732994],
            [24.726363, -411.777019],
            [23.2487, -433.232937],
            [8.994006, -591.44438],
          ],
        ],
      ],
      bounds: [8.994006, -591.952781, 34.549922, -90.563589],
    },
    {
      id: 52776559531164,
      polys: [
        [
          [
            [-48.684937, -91.7133],
            [-48.307541, -180.184149],
            [-47.002323, -268.227087],
            [-34.424535, -349.72458],
            [-28.532591, -348.993337],
            [-37.663283, -266.733041],
            [-39.317666, -91.603752],
            [-48.684937, -91.7133],
          ],
        ],
      ],
      bounds: [-48.684937, -349.72458, -28.532591, -91.603752],
    },
    {
      id: 52776559531166,
      polys: [
        [
          [
            [-58.275526, -176.802728],
            [-57.533047, -219.233947],
            [-55.501178, -268.970764],
            [-42.481269, -350.174124],
            [-38.66604, -349.485258],
            [-50.581531, -268.503782],
            [-52.401116, -179.208519],
            [-52.435187, -85.597845],
            [-52.532255, -78.837574],
            [-57.466023, -78.61229],
            [-58.275526, -176.802728],
          ],
        ],
      ],
      bounds: [-58.275526, -350.174124, -38.66604, -78.61229],
    },
    {
      id: 52776559531167,
      polys: [
        [
          [
            [-10.319423, -355.179859],
            [-3.028904, -355.112552],
            [-3.807297, -91.001811],
            [-10.199513, -91.172902],
            [-10.319423, -355.179859],
          ],
        ],
      ],
      bounds: [-10.319423, -355.179859, -3.028904, -91.001811],
    },
    {
      id: 52776559531168,
      polys: [
        [
          [
            [-24.942659, -91.351346],
            [-23.642348, -267.098747],
            [-17.072804, -347.618932],
            [-13.405525, -347.666299],
            [-13.122921, -279.552633],
            [-13.660717, -91.243486],
            [-24.942659, -91.351346],
          ],
        ],
      ],
      bounds: [-24.942659, -347.666299, -13.122921, -91.243486],
    },
    {
      id: 52776559531171,
      polys: [
        [
          [
            [-36.018512, -91.577211],
            [-35.450868, -181.388392],
            [-34.570227, -266.588468],
            [-25.0573, -349.6149],
            [-19.725481, -349.383895],
            [-26.601562, -265.814871],
            [-26.761743, -181.985133],
            [-27.711622, -91.407812],
            [-36.018512, -91.577211],
          ],
        ],
      ],
      bounds: [-36.018512, -349.6149, -19.725481, -91.407812],
    },
  ],
  ownedParts: [737, 738, 970],
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
    250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268,
    269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287,
    288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306,
    307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325,
    326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344,
    345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363,
    364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382,
    383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401,
    402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420,
    421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439,
    440, 441, 442, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458,
    459, 460, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
    478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496,
    497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515,
    516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534,
    535, 536, 537, 538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553,
    554, 555, 556, 557, 558, 559, 560, 561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572,
    573, 574, 575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586, 587, 588, 589, 590, 591,
    592, 593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610,
    611, 612, 613, 614, 615, 616, 617, 618, 619, 620, 621, 622, 623, 624, 625, 626, 627, 628, 629,
    630, 631, 632, 633, 634, 635, 636, 637, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648,
    649, 650, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667,
    668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686,
    687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705,
    706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724,
    725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 739, 740, 741, 742, 743, 744, 745,
    746, 747, 748, 749, 750, 751, 752, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763, 764,
    765, 766, 767, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 782, 783,
    784, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802,
    803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 814, 815, 816, 817, 818, 819, 820, 821,
    822, 823, 824, 825, 826, 827, 828, 829, 830, 831, 832, 833, 834, 835, 836, 837, 838, 839, 840,
    841, 842, 843, 844, 845, 846, 847, 848, 849, 850, 851, 852, 853, 854, 855, 856, 857, 858, 859,
    860, 861, 862, 863, 864, 865, 866, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878,
    879, 880, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897,
    898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916,
    917, 918, 919, 920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 930, 931, 932, 933, 934, 935,
    936, 937, 938, 939, 940, 941, 942, 943, 944, 945, 946, 947, 948, 949, 950, 951, 952, 953, 954,
    955, 956, 957, 958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 971, 972, 973, 974,
    975, 976, 977, 978, 979, 980, 981, 982, 983, 984, 985, 986, 987, 988, 989, 990, 991, 992, 993,
    994, 995, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
    1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025, 1026,
    1027, 1028, 1029, 1030, 1031, 1032, 1033, 1034, 1035, 1036, 1037, 1038, 1039, 1040, 1041, 1042,
    1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058,
    1059, 1060, 1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072, 1073, 1074,
    1075, 1076, 1077, 1078, 1079, 1080, 1081, 1082, 1083, 1084, 1085, 1086, 1087, 1088, 1089, 1090,
    1091, 1092, 1093, 1094, 1095, 1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103, 1104, 1105, 1106,
    1107, 1108, 1109, 1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 1120, 1121, 1122,
    1123, 1124, 1125, 1126, 1127, 1128, 1129, 1130, 1131, 1132, 1133, 1134, 1135, 1136, 1137, 1138,
    1139, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147, 1148, 1149, 1150, 1151, 1152, 1153, 1154,
    1155, 1156, 1157, 1158, 1159, 1160, 1161, 1162, 1163, 1164, 1165, 1166, 1167, 1168, 1169, 1170,
    1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178, 1179, 1180, 1181, 1182, 1183, 1184, 1185, 1186,
    1187, 1188, 1189, 1190, 1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1199, 1200, 1201, 1202,
    1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210, 1211, 1212, 1213, 1214, 1215, 1216, 1217, 1218,
    1219, 1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234,
    1235, 1236, 1237, 1238, 1239, 1240, 1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248, 1249, 1250,
    1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258, 1259, 1260, 1261, 1262, 1263, 1264, 1265, 1266,
    1267, 1268, 1269, 1270, 1271, 1272, 1273, 1274, 1275, 1276, 1277, 1278, 1279, 1280, 1281, 1282,
    1283, 1284, 1285, 1286, 1287, 1288, 1289, 1290, 1291, 1292, 1293, 1294, 1295, 1296, 1297, 1298,
    1299, 1300, 1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310, 1311, 1312, 1313, 1314,
    1315, 1316, 1317, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330,
    1331, 1332, 1333, 1334, 1335, 1336, 1337, 1338, 1339, 1340, 1341, 1342, 1343, 1344, 1345, 1346,
    1347, 1348, 1349, 1350, 1351, 1352, 1353, 1354, 1355, 1356, 1357, 1358, 1359, 1360, 1361, 1362,
    1363, 1364, 1365, 1366, 1367, 1368, 1369, 1370, 1371, 1372, 1373, 1374, 1375, 1376, 1377, 1378,
    1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 1387, 1388, 1389, 1390, 1391, 1392, 1393, 1394,
    1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408, 1409, 1410,
    1411, 1412, 1413, 1414, 1415, 1416, 1417, 1418, 1419, 1420, 1421, 1422, 1423, 1424, 1425, 1426,
    1427, 1428, 1429, 1430, 1431, 1432, 1433, 1434, 1435, 1436, 1437, 1438, 1439, 1440, 1441, 1442,
    1443, 1444, 1445, 1446, 1447, 1448, 1449, 1450, 1451, 1452, 1453, 1454, 1455, 1456, 1457, 1458,
    1459, 1460, 1461, 1462, 1463, 1464, 1465, 1466, 1467, 1468, 1469, 1470, 1471, 1472, 1473, 1474,
    1475, 1476, 1477, 1478, 1479, 1480, 1481, 1482, 1483, 1484, 1485, 1486, 1487, 1488, 1489, 1490,
    1491, 1492, 1493, 1494, 1495, 1496,
  ],
  groundFloors: [
    [
      [
        [-43.481867, 28.72947],
        [-36.913473, 28.252313],
        [-36.92501908019651, 24.59474038218223],
        [-36.960907, 24.584987],
        [-37.066646, -28.171702],
        [-41.794327, -28.06441],
        [-42.169278, -35.649109],
        [-38.383971, -35.490455],
        [-38.48057, -44.739671],
        [13.303694, -45.109556],
        [13.235305, -55.743193],
        [31.395621, -55.332142],
        [31.206592, -36.067604],
        [31.036263, 4.258369],
        [37.060346, 4.503402],
        [37.068848, 14.076773],
        [31.118732, 14.199885],
        [31.05795824747138, 20.79611579186048],
        [31.065675, 20.798213],
        [31.051561, 21.490457],
        [33.658478, 21.502868],
        [33.70779970617887, 21.516272327268073],
        [46.32492, 21.638895],
        [46.170829, 47.177982],
        [46.097066480689676, 47.15793530892687],
        [46.070328, 50.10902],
        [33.035739, 50.046983],
        [32.905311, 52.447829],
        [31.330546, 53.76006],
        [26.808952, 53.749359],
        [24.112256, 52.146363],
        [19.752712, 52.179703],
        [15.231118, 52.169002],
        [12.551927, 53.703145],
        [7.338091, 53.678333],
        [5.569655, 52.501634],
        [5.538034, 50.056743],
        [-34.051892, 49.738538],
        [-36.452719, 49.608122],
        [-38.235271, 49.123672],
        [-40.283765, 47.696838],
        [-41.876035, 45.871928],
        [-42.540046, 44.473317],
        [-43.027891, 42.426498],
        [-43.481867, 28.72947],
      ],
    ],
  ],
  referenceLocal: [10, 69],
  scope:
    'Complete individual Yaroslavsky passenger-terminal exterior: the whole named historic front headhouse and connected modern rear concourse, the entire mapped comb-shaped rear boarding canopy and each physically connected mapped passenger platform. Preserve the independent Leningradsky terminal and its many detailed mapped facade parts to the west, Kazansky terminal across the square, postal/rail service properties, streets and rail network. The candidate reference coordinate is in the northern yard; the named passenger-terminal footprint supplies the model anchor. No trains, people, branding, lettering, ticket interfaces or navigable railway interiors. No imagined future shared canopy between the independent terminals.',
  nativeFacts: [
    { index: 737, id: 52776559531169, properties: { sort_rank: 400, kind: 'building', height: 5 } },
    {
      index: 738,
      id: 52776559531195,
      properties: { sort_rank: 400, kind: 'building', height: 14 },
    },
    {
      index: 970,
      id: 52776559531195,
      properties: { sort_rank: 400, kind: 'building', height: 14 },
    },
  ],
  interpretation:
    'Standard 20261031 PMTiles physically associates the named Yaroslavsky Rail Terminal building/POI 52776559531195 with its complete two tile fragments and rear canopy 52776559531169. The ordinary front photo resolves asymmetric left spire, large eastern flared/tented roof, right turret, broad arched entry, grey-brown walls, pale trim and turquoise ceramic frieze. A 2026 yard picture establishes the open platform/track character but does not verify hidden terminal facades. Native main envelope height14m and rear canopy5m are retained as map facts; feature-specific roof/tower heights, wall bays, hidden facade details, floor/platform grades and current renovation state are explicit medium-fi estimates. Source hall and platform floors are +1.25m from one unchanged standard outside forecourt sample [10,69], 149.02778940000002m absolute datum. The native main envelope14m and boarding canopy5m are retained; western shaft19m/drum23.2m/spire42m/finial44.55m, broad eastern flared roof30.2m/crest32.7m and right turret26m are explicit picture-based estimates. Eight whole mapped platform islands are retained; a fixed transverse concrete boarding apron connects their noses to the rear canopy, without masking the rail corridor. Exact threshold, track-buffer and platform grades remain unverified.',
  datum: 149.02778940000002,
  floor: 1.25,
  platformFloor: 1.25,
  sourceHeights: {
    mainEnvelope: 14,
    rearCanopy: 5,
    westernShaft: 19,
    westernDrum: 23.2,
    westernSpire: 42,
    spireFinial: 44.55,
    mainFlaredRoof: 30.2,
    mainCrest: 32.7,
    rightTurretRoof: 26,
  },
};
export const stationPlans = controls.groups.main.map((p) => p[0]);
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
    if (c.master) {
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
    for (const [y, N] of [
      [y0, [0, -1, 0]],
      [y1, [0, 1, 0]],
    ])
      T(
        o,
        c,
        [
          [x, y, z],
          [x + r * Math.cos(a), y, z + r * Math.sin(a)],
          [x + r * Math.cos(b), y, z + r * Math.sin(b)],
        ],
        s,
        C[s],
        N,
      );
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
function canopySpan(poly, x) {
  const zs = [];
  for (const r of poly)
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1],
        b = r[i];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        zs.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
  return [Math.min(...zs), Math.max(...zs)];
}
function polygonBox(poly) {
  const a = poly.flat();
  return [
    Math.min(...a.map((p) => p[0])),
    Math.min(...a.map((p) => p[1])),
    Math.max(...a.map((p) => p[0])),
    Math.max(...a.map((p) => p[1])),
  ];
}
function hall(o, c, poly, hi, historic) {
  panel(o, c, poly, controls.floor, 'base');
  for (const r of poly) {
    const R = openRing(r);
    for (let i = 0; i < R.length; i++) {
      const e = edge(R, i),
        holes = [];
      if (c.detail && e.L > 4) {
        const n = Math.max(1, Math.floor(e.L / (c.master ? 3.2 : c.near ? 4 : c.fine ? 7 : 12))),
          pitch = e.L / n;
        for (let j = 0; j < n; j++) {
          const u = (j + 0.5) * pitch;
          holes.push({
            kind: j % 4 === 1 ? 'doorGlass' : 'glass',
            ring: historic
              ? arch(u, controls.floor + 0.25, Math.min(2.7, pitch * 0.6), 2.1, 1.1, c.round)
              : rect(u, controls.floor + 0.4, Math.min(2.8, pitch * 0.65), 2.8),
            depth: 0.2,
          });
          if (historic || hi > 10)
            holes.push({
              kind: 'glass',
              ring: rect(u, 7.7, Math.min(2.4, pitch * 0.6), 2.6),
              depth: 0.18,
            });
        }
      }
      wall(o, c, e.p, e.L, controls.floor, hi, holes, historic ? 'wall' : 'stone');
      if (historic) {
        band(o, c, e, 10.8, 1.9, 'mural', 0.08);
        if (c.detail) {
          band(o, c, e, 10.5, 0.24, 'trim', 0.15);
          band(o, c, e, 12.7, 0.23, 'trim', 0.18);
          band(o, c, e, hi - 0.25, 0.3, 'trim', 0.2);
        }
        if (c.fine)
          for (const h of holes) {
            const p = h.ring;
            if (h.kind === 'doorGlass')
              beamPath(
                adapter(o, c),
                'trim',
                p.map(([u, y]) => e.p([u, y, 0.05])),
                0.12,
                0.12,
                C.trim,
                true,
              );
          }
      } else if (c.detail) band(o, c, e, hi - 0.3, 0.3, 'metal', 0.06);
    }
  }
  if (!historic) panel(o, c, poly, hi, 'canopy');
}
function roof(o, c, x, z, w, d, lo, hi, s = 'roof', levels = 3, frontLimit = Infinity) {
  const rings = Array.from({ length: levels + 1 }, (_, i) => {
    const t = i / levels,
      k = i === 0 ? 1 : 1 - 0.68 * t + 0.08 * Math.sin(Math.PI * t);
    return [
      [x - (w * k) / 2, lo + (hi - lo) * t, z - (d * k) / 2],
      [x + (w * k) / 2, lo + (hi - lo) * t, z - (d * k) / 2],
      [x + (w * k) / 2, lo + (hi - lo) * t, Math.min(frontLimit, z + (d * k) / 2)],
      [x - (w * k) / 2, lo + (hi - lo) * t, Math.min(frontLimit, z + (d * k) / 2)],
    ];
  });
  for (let i = 0; i < levels; i++)
    for (let j = 0; j < 4; j++)
      Q(
        o,
        c,
        [rings[i][j], rings[i][(j + 1) % 4], rings[i + 1][(j + 1) % 4], rings[i + 1][j]],
        s,
        C[s],
      );
  Q(o, c, rings.at(-1), s, C[s], [0, 1, 0]);
  if (c.fine) {
    for (const i of [0, levels])
      beamPath(adapter(o, c), 'metal', rings[i], 0.1, 0.12, C.metal, true);
    if (c.near)
      for (let j = 0; j < 4; j++)
        for (let u = 0.1; u < 1; u += c.master ? 0.05 : 0.18) {
          const path = rings.map((r) => r[j].map((v, k) => v + (r[(j + 1) % 4][k] - v) * u));
          beamPath(adapter(o, c), 'roof', path, 0.055, 0.07, C.roof);
        }
  }
}
function pointedRoof(o, c, x, z, w, d, lo, hi) {
  const n = c === cfg.skyline ? 4 : c.round,
    ring = Array.from({ length: n }, (_, j) => [
      x + (w / 2) * Math.cos((j / n) * Math.PI * 2),
      lo,
      z + (d / 2) * Math.sin((j / n) * Math.PI * 2),
    ]);
  for (let i = 0; i < n; i++) T(o, c, [ring[i], ring[(i + 1) % n], [x, hi, z]], 'roof', C.roof);
  if (c.near)
    for (let i = 0; i < n; i++)
      beam(adapter(o, c), 'metal', ring[i], [x, hi, z], 0.045, 0.055, C.metal);
}
function frontPanel(o, c, outer, holes, z, s = 'trim', depth = 0) {
  if (depth) {
    for (let j = 0; j < outer.length; j++) {
      const a = outer[j],
        b = outer[(j + 1) % outer.length];
      Q(
        o,
        c,
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [b[0], b[1], z - depth],
          [a[0], a[1], z - depth],
        ],
        s,
        C[s],
      );
    }
  }
  const rs = [outer, ...(c.recess ? holes.map((h) => h.ring) : [])],
    a = rs.flat(),
    starts = rs.slice(1).map((_, i) => rs.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(a.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [a[j][0], a[j][1], z]),
      s,
      C[s],
      [0, 0, 1],
    );
  for (const h of holes) {
    const y = c.recess ? z - 0.18 : z + 0.02,
      ids = earcut(h.ring.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [h.ring[j][0], h.ring[j][1], y]),
        h.kind,
        C[h.kind],
        [0, 0, 1],
      );
    if (c.fine)
      beamPath(
        adapter(o, c),
        'trim',
        h.ring.map(([x, Y]) => [x, Y, z + 0.06]),
        0.16,
        0.16,
        C.trim,
        true,
      );
    if (c.recess)
      for (let j = 0; j < h.ring.length; j++) {
        const a = h.ring[j],
          b = h.ring[(j + 1) % h.ring.length];
        Q(
          o,
          c,
          [
            [a[0], a[1], z],
            [b[0], b[1], z],
            [b[0], b[1], y],
            [a[0], a[1], y],
          ],
          'trim',
          C.trim,
        );
      }
  }
  if (c.near)
    beamPath(
      adapter(o, c),
      'trim',
      outer.map(([x, y]) => [x, y, z + 0.06]),
      0.22,
      0.3,
      C.trim,
      true,
    );
}
function historicRoofs(o, c) {
  for (const poly of controls.groups.historic) panel(o, c, poly, 14, 'roof');
  // Long low wing, tall western spire and eastern flared roof are independent silhouettes.
  roof(o, c, -14, 32, 53, 39, 13.8, 17.2, 'roof', c.master ? 10 : c.near ? 5 : 2);
  box(o, c, -32, -24, controls.floor, 19, 40, 49, 'wall');
  box(o, c, -32.3, -23.7, 14.2, 15.1, 39.7, 49.3, 'trim');
  box(o, c, -32.5, -23.5, 18.6, 19.4, 39.5, 49.5, 'trim');
  const n = c === cfg.skyline ? 4 : c.round;
  roundColumn(o, c, [-28, 44.5], 19.2, 23.2, 3.8, 'trim');
  pointedRoof(o, c, -28, 44.5, 9, 10, 23.55, 42);
  if (c.detail) {
    beam(adapter(o, c), 'metal', [-28, 41.8, 44.5], [-28, 43.4, 44.5], 0.1, 0.1, C.metal);
    if (c.fine)
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4,
          b = ((j + 1) * Math.PI) / 4,
          r0 = j % 2 ? 0.28 : 0.75,
          r1 = (j + 1) % 2 ? 0.28 : 0.75;
        T(
          o,
          c,
          [
            [-28, 43.8, 44.55],
            [-28 + r0 * Math.cos(a), 43.8 + r0 * Math.sin(a), 44.55],
            [-28 + r1 * Math.cos(b), 43.8 + r1 * Math.sin(b), 44.55],
          ],
          'metal',
          C.metal,
          [0, 0, 1],
        );
      }
    for (const y of [5.1, 9.2, 16])
      frontPanel(
        o,
        c,
        [
          [-30.4, y],
          [-25.6, y],
          [-25.6, y + 2.5],
          [-30.4, y + 2.5],
        ],
        [{ kind: 'glass', ring: arch(-28, y + 0.1, 1.7, 1.2, 0.9, n) }],
        49.07,
        'trim',
      );
  }
  roof(
    o,
    c,
    18.5,
    38.5,
    34,
    35,
    14.1,
    30.2,
    'roof',
    c.master ? 16 : c.near ? 8 : c.fine ? 4 : 2,
    50,
  );
  const portal = arch(18.5, controls.floor + 0.05, 10.6, 2.4, 3.6, c.round),
    upper = rect(18.5, 10.3, 12.4, 6.0),
    shape = [
      [3, controls.floor],
      [34, controls.floor],
      [34, 14.2],
      [31, 17.2],
      [26, 18.6],
      [22, 20.5],
      [18.5, 24],
      [15, 20.5],
      [11, 18.6],
      [6, 17.2],
      [3, 14.2],
    ];
  frontPanel(
    o,
    c,
    shape,
    [
      { kind: 'doorGlass', ring: portal },
      { kind: 'glass', ring: upper },
    ],
    54.1,
    'wall',
    4.1,
  );
  for (const x of [4.4, 32.6]) {
    roundColumn(o, c, [x, 52.5], 8.8, 18.2, 2.4, 'trim');
    if (c.detail) {
      roundColumn(o, c, [x, 52.5], 11.4, 11.8, 2.62, 'trim');
      roundColumn(o, c, [x, 52.5], 17.5, 18.4, 2.65, 'trim');
    }
  }
  if (c.detail) {
    const p = ([u, y, d]) => [u, y, 54.1 + d];
    archBand(o, c, p, 18.5, controls.floor + 2.45, 5.3, 5.75, 'trim', 0.12, c.round);
    for (const x of [7, 30])
      frontPanel(
        o,
        c,
        [
          [x - 1.4, 9],
          [x + 1.4, 9],
          [x + 1.4, 14],
          [x - 1.4, 14],
        ],
        [{ kind: 'glass', ring: arch(x, 9.2, 1.7, 2.1, 1, c.round) }],
        54.25,
        'trim',
      );
    for (const y of [4.8, 13])
      beam(adapter(o, c), 'metal', [12.4, y, 54.0], [24.6, y, 54.0], 0.08, 0.08, C.metal);
    for (let x = 13; x < 25; x += c.master ? 0.7 : c.near ? 1.4 : 4)
      beam(adapter(o, c), 'metal', [x, 10.3, 53.95], [x, 16.3, 53.95], 0.05, 0.05, C.metal);
  }
  box(o, c, 37, 45, controls.floor, 17.2, 41, 49);
  roof(o, c, 41, 45, 10, 12, 17.2, 26, 'roof', c.master ? 8 : c.near ? 4 : 2);
  if (c.fine) {
    for (const x of [12, 25]) {
      box(o, c, x - 1, x + 1, 23, 25.2, 44, 45.5, 'roof');
      frontPanel(
        o,
        c,
        [
          [x - 1, 23],
          [x + 1, 23],
          [x + 1, 25],
          [x, 26.5],
          [x - 1, 25],
        ],
        [{ kind: 'glass', ring: arch(x, 23.2, 1.3, 0.9, 0.8, c.round) }],
        45.6,
        'roof',
      );
    }
    const path = [];
    for (let j = 0; j <= c.round; j++) {
      const t = j / c.round;
      path.push([13 + 11 * t, 30.4 + 2.3 * Math.sin(Math.PI * t), 38.5]);
    }
    beamPath(adapter(o, c), 'metal', path, 0.09, 0.11, C.metal);
    for (const x of [13, 18.5, 24])
      beam(adapter(o, c), 'metal', [x, 30.2, 38.5], [x, 32.4, 38.5], 0.07, 0.08, C.metal);
  }
}
function platforms(o, c) {
  for (const p of controls.platforms)
    for (const poly of p.polys) {
      solid(o, c, poly, -9, controls.platformFloor, 'base');
      if (c.detail)
        for (const r of poly)
          beamPath(
            adapter(o, c),
            'trim',
            openRing(r).map(([x, z]) => [x, controls.platformFloor + 0.02, z]),
            0.25,
            0.035,
            C.trim,
            true,
          );
    }
  // Transverse boarding apron connects actual platform noses to the mapped canopy/concourse.
  const apron = [
    [-69, -94],
    [40, -94],
    [40, -45],
    [-69, -45],
    [-69, -94],
  ];
  slab(o, c, apron, -9, controls.platformFloor, 'base');
  for (const poly of controls.groups.canopy) {
    solid(o, c, poly, 4.8, 5, 'canopy');
    if (c.detail) {
      const b = polygonBox(poly);
      for (let x = b[0] + 3; x < b[2] - 2; x += c.master ? 4.5 : c.near ? 8 : c.fine ? 15 : 40) {
        const v = canopySpan(poly, x),
          z = (v[0] + v[1]) / 2;
        box(o, c, x - 0.16, x + 0.16, controls.platformFloor, 4.8, z - 0.15, z + 0.15, 'metal');
        if (c.fine) {
          beam(adapter(o, c), 'metal', [x, 3.9, z], [x, 4.8, v[1] - 0.2], 0.12, 0.13, C.metal);
          beam(adapter(o, c), 'metal', [x, 3.9, z], [x, 4.8, v[0] + 0.2], 0.12, 0.13, C.metal);
        }
      }
      if (c.near)
        for (const r of poly)
          beamPath(
            adapter(o, c),
            'metal',
            openRing(r).map(([x, z]) => [x, 5.06, z]),
            0.1,
            0.12,
            C.metal,
            true,
          );
    }
  }
}
export function buildStationLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown terminal level ' + level);
  for (const p of controls.groups.main) solid(o, c, p, -9, controls.floor, 'base');
  for (const p of controls.groups.historic) hall(o, c, p, 14, true);
  for (const p of controls.groups.modern) hall(o, c, p, 14, false);
  historicRoofs(o, c);
  platforms(o, c);
  if (c.near)
    for (const p of controls.groups.modern) {
      const b = polygonBox(p);
      for (let x = b[0] + 4; x < b[2] - 3; x += c.master ? 5 : 10)
        box(o, c, x - 0.8, x + 0.8, 14, 14.7, b[1] + 4, b[1] + 6, 'metal');
    }
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

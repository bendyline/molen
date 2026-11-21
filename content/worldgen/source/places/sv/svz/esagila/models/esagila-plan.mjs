// Excavation plan from Wetzel and Schmidt, reproduced in Pedersén figure 4.8.
// These are interpreted trace coordinates on PDF page 150 rendered at 126 dpi.
// The main building spans 79.3 × 85.8 m. The outer annex perimeter is attested.
// Dashed subdivisions and unexcavated areas are stored separately.
export const plan = {
  imageSize: [844, 1191],
  main: { west: 103, east: 408, north: 149, south: 488, width: 79.3, depth: 85.8 },
  courtyard: { west: 229, east: 348.23, north: 244, south: 386.23 },
  annex: { east: 752, south: 607, inset: 469, elbow: 458 },
  pit: [
    [228, 246],
    [282, 181],
    [366, 206],
    [323, 279],
  ],
  pitCenter: [300, 232],
};

export function point(u, v) {
  const { west, east, north, south, width, depth } = plan.main;
  return [
    ((u - (east + west) / 2) * width) / (east - west),
    ((v - (south + north) / 2) * depth) / (south - north),
  ];
}

// [start pixel, end pixel, wall depth in metres, portal clear spans as plan pixels].
// All wall controls run north-to-south or west-to-east. Adjacent walls join in the
// model, while architectural pier spacing is a reconstruction of the elevation.
export const perimeter = [
  [[103, 149], [408, 149], 5.15, [[246, 273]]],
  [[103, 149], [103, 488], 5.25, [[298, 334]]],
  [[103, 488], [408, 488], 5.02, [[247, 270]]],
  [[408, 149], [752, 149], 5.45, [[428, 458]]],
  [
    [752, 149],
    [752, 607],
    5.45,
    [
      [285, 312],
      [449, 477],
    ],
  ],
  [[469, 607], [752, 607], 5.15, []],
  [[469, 458], [469, 607], 5.1, [[526, 549]]],
  [[408, 458], [469, 458], 4.72, []],
  [[408, 149], [408, 488], 4.82, [[295, 331]]],
];

// The courtyard walls and the rooms around it recorded by the exploratory shafts.
export const courtyardWalls = [
  [
    [229, 244],
    [349, 244],
    2.72,
    [
      [252, 270],
      [305, 325],
    ],
  ],
  [[229, 244], [229, 386.23], 3.06, [[298, 330]]],
  [[348.23, 244], [348.23, 386.23], 3.07, [[297, 330]]],
  [
    [229, 386.23],
    [348.23, 386.23],
    2.82,
    [
      [246, 266],
      [304, 326],
    ],
  ],
];

export const tracedPartitions = [
  [[136, 181], [229, 181], 2.38, [[168, 183]]],
  [
    [137, 182],
    [137, 461],
    2.37,
    [
      [296, 335],
      [417, 438],
    ],
  ],
  [
    [137, 461],
    [229, 461],
    2.38,
    [
      [165, 176],
      [202, 215],
    ],
  ],
  [[231, 150], [231, 244], 2.68, [[193, 215]]],
  [[276, 150], [276, 245], 2.78, [[198, 216]]],
  [
    [229, 179],
    [350, 179],
    2.66,
    [
      [248, 268],
      [302, 321],
    ],
  ],
  [[349, 149], [349, 244], 2.58, [[188, 209]]],
  [[349, 181], [407, 181], 2.86, [[367, 381]]],
  [[350, 241], [405, 241], 2.7, [[367, 382]]],
  [[351, 270], [407, 270], 2.41, [[364, 380]]],
  [[349, 355], [407, 355], 2.37, [[367, 385]]],
  [[350, 390], [408, 390], 2.56, [[364, 386]]],
  [[325, 387], [325, 488], 2.36, [[425, 444]]],
  [[280, 389], [280, 487], 2.55, [[417, 438]]],
  [[231, 388], [231, 488], 2.44, [[416, 437]]],
  [
    [231, 427],
    [405, 427],
    2.41,
    [
      [250, 265],
      [292, 303],
      [363, 381],
    ],
  ],
  [
    [228, 466],
    [407, 466],
    2.53,
    [
      [247, 268],
      [350, 366],
    ],
  ],
];

// The western sanctuary room and the two open annex courts are documented
// interpretations. They remain distinct from the excavated courtyard controls.
export const inferredPartitions = [
  [[137, 241], [230, 241], 2.72, [[160, 177]]],
  [[137, 392], [230, 392], 2.72, [[171, 191]]],
  [
    [452, 246],
    [720, 246],
    2.75,
    [
      [484, 514],
      [694, 712],
    ],
  ],
  [[453, 246], [453, 390], 2.78, [[295, 332]]],
  [[698, 246], [698, 391], 2.73, [[294, 319]]],
  [
    [453, 389],
    [719, 389],
    2.71,
    [
      [476, 502],
      [655, 684],
    ],
  ],
  [[536, 444], [695, 444], 2.72, [[605, 632]]],
  [[536, 444], [536, 548], 2.63, [[475, 502]]],
  [[693, 444], [693, 548], 2.58, [[459, 481]]],
  [[536, 548], [693, 548], 2.75, [[602, 631]]],
];

export const roofing = [
  // Lower temple four wings keep the central court fully open.
  [103, 149, 408, 244],
  [103, 244, 229, 386.23],
  [348.23, 244, 408, 386.23],
  [103, 386.23, 408, 488],
  // The annex surrounds two open courts.
  [408, 149, 752, 246],
  [408, 246, 453, 391],
  [698, 246, 752, 391],
  [408, 391, 752, 458],
  [469, 458, 536, 548],
  [693, 458, 752, 548],
  [469, 548, 752, 607],
];

export const gates = [
  { axis: 'z', along: 149, span: [246, 273], side: -1 },
  { axis: 'x', along: 103, span: [298, 334], side: -1 },
  { axis: 'z', along: 488, span: [247, 270], side: 1 },
  { axis: 'z', along: 149, span: [428, 458], side: -1 },
  { axis: 'x', along: 752, span: [285, 312], side: 1 },
  { axis: 'x', along: 752, span: [449, 477], side: 1 },
  { axis: 'x', along: 408, span: [295, 331], side: 1 },
];

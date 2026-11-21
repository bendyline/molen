// Fisher's 1680 plan in the 1807 Crace edition. Transfer three corners of
// the surviving hall to the same local frame as the east precinct.
export const fisherControls = {
  pixels: [
    [771, 476],
    [628, 516],
    [795, 548],
  ],
  metres: [
    [-14.08, 12.26],
    [23.16, 12.26],
    [-14.08, -8.46],
  ],
  check: { pixel: [584, 410], feature: 'Holbein Gate' },
};

export function fisherPoint([u, v]) {
  const [[u0, v0], [u1, v1], [u2, v2]] = fisherControls.pixels;
  const [au, av, bu, bv] = [u1 - u0, v1 - v0, u2 - u0, v2 - v0];
  const [du, dv] = [u - u0, v - v0];
  const determinant = au * bv - av * bu;
  return [
    -14.08 + (37.24 * (du * bv - dv * bu)) / determinant,
    12.26 - (20.72 * (au * dv - av * du)) / determinant,
  ];
}

const range = (name, front, depth, eaves, roof, floors, bays, skyline = false) => ({
  name,
  localFront: front.map(fisherPoint),
  depth,
  eaves,
  roof,
  floors,
  bays,
  skyline,
});

// East-facing fronts are directed so the shell extends back toward the park.
export const westRanges = [
  range(
    'Real Tennis Court',
    [
      [183, 388],
      [309, 368],
    ],
    12.1,
    9.4,
    'tennis',
    1,
    4,
    true,
  ),
  range(
    'Tennis south service wing',
    [
      [143, 407],
      [183, 398],
    ],
    12.7,
    7.1,
    'hip',
    2,
    2,
  ),
  range(
    'Tennis vestibule',
    [
      [305, 355],
      [355, 344],
    ],
    9.8,
    7.5,
    'gable',
    2,
    2,
  ),
  range(
    'Tennis street gallery',
    [
      [187, 430],
      [351, 402],
    ],
    5.1,
    6.8,
    'gable',
    2,
    6,
  ),
  range(
    'Cockpit Court street ranges',
    [
      [364, 399],
      [577, 359],
    ],
    11.2,
    9.2,
    'cross',
    2,
    6,
    true,
  ),
  range(
    'Cockpit Court inner south range',
    [
      [339, 241],
      [341, 302],
    ],
    7.3,
    7.5,
    'gable',
    2,
    3,
  ),
  range(
    'Cockpit Court inner north range',
    [
      [423, 281],
      [495, 268],
    ],
    10.7,
    8.5,
    'cross',
    2,
    3,
  ),
  range(
    'Cockpit Court west lodgings',
    [
      [283, 206],
      [334, 196],
    ],
    8.6,
    7.6,
    'hip',
    2,
    3,
  ),
  range(
    'Playhouse',
    [
      [347, 224],
      [411, 211],
    ],
    16.6,
    11.8,
    'cockpit',
    2,
    4,
    true,
  ),
  range(
    'Treasury courtyard west range',
    [
      [171, 170],
      [259, 154],
    ],
    6.2,
    7.4,
    'gable',
    2,
    4,
  ),
  range(
    'Treasury courtyard south range',
    [
      [170, 222],
      [187, 275],
    ],
    5.2,
    7,
    'gable',
    2,
    3,
  ),
  range(
    'Treasury courtyard east range',
    [
      [185, 293],
      [328, 265],
    ],
    6.7,
    8.2,
    'gable',
    2,
    5,
    true,
  ),
  range(
    'Park wall lodgings',
    [
      [211, 135],
      [342, 105],
    ],
    6.5,
    7.3,
    'gable',
    2,
    4,
  ),
  range(
    'Tiltyard lodge',
    [
      [660, 334],
      [727, 307],
    ],
    7.2,
    7.6,
    'gable',
    2,
    3,
  ),
  range(
    'South Horse Guard range',
    [
      [743, 298],
      [889, 239],
    ],
    6.8,
    7.8,
    'gable',
    2,
    5,
    true,
  ),
  range(
    'North Horse Guard range',
    [
      [909, 240],
      [1038, 189],
    ],
    7.7,
    8.9,
    'gable',
    2,
    5,
    true,
  ),
  range(
    'Northern Park lodgings',
    [
      [1055, 172],
      [1160, 134],
    ],
    8.6,
    8.4,
    'cross',
    2,
    4,
  ),
  range(
    'St James Park side gallery',
    [
      [994, 126],
      [894, 163],
    ],
    6.5,
    6.8,
    'gable',
    2,
    4,
  ),
];

export const westControls = {
  cockpit: fisherPoint([374, 181]),
  tennis: fisherPoint([244, 357]),
  treasuryCourt: fisherPoint([235, 238]),
  tiltyard: [
    [603, 284],
    [695, 242],
    [739, 302],
    [642, 351],
  ].map(fisherPoint),
  horseYard: [
    [777, 232],
    [978, 155],
    [1009, 201],
    [794, 281],
  ].map(fisherPoint),
  parkGate: [
    [827, 191],
    [867, 176],
  ].map(fisherPoint),
  westernBoundary: [
    [139, 420],
    [136, 342],
    [181, 329],
    [158, 181],
    [193, 169],
    [188, 69],
    [207, 68],
    [216, 111],
    [341, 95],
    [352, 141],
    [412, 142],
    [419, 211],
    [484, 215],
    [494, 263],
    [571, 241],
    [1100, 58],
    [1140, 53],
    [1173, 141],
    [617, 368],
    [591, 393],
    [353, 427],
    [143, 452],
  ].map(fisherPoint),
};

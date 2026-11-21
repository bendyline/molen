// Trace of the c.1670 plan reproduced by Historic Royal Palaces, 1024 × 711 px.
// Image coordinates follow the original plan. North lies to the right of the page.
// Fit the historical hall's north-west, south-west, and north-east corners to
// the three corresponding corners of the Jacobean hall in the Banqueting House map frame.
export const hallFit = {
  pixels: [
    [502, 207],
    [376, 249],
    [524, 273],
  ],
  metres: [
    [-14.08, 12.26],
    [23.16, 12.26],
    [-14.08, -8.46],
  ],
  anchor: [-0.1259, 51.5046],
  heading: -1.4016227089117175,
};

export function planPoint([u, v]) {
  const du = u - hallFit.pixels[0][0];
  const dv = v - hallFit.pixels[0][1];
  const [[au, av], [bu, bv]] = hallFit.pixels
    .slice(1)
    .map(([x, y]) => [x - hallFit.pixels[0][0], y - hallFit.pixels[0][1]]);
  const determinant = au * bv - av * bu;
  const south = (du * bv - dv * bu) / determinant;
  const east = (au * dv - av * du) / determinant;
  return [-14.08 + 37.24 * south, 12.26 - 20.72 * east];
}

// Wing records trace the principal ranges of the linked palace. Widths are
// perpendicular to each front in the plan. Roof heights are appearance estimates.
export const wings = [
  {
    name: 'Court Gate north lodge',
    front: [
      [581, 235],
      [606, 220],
    ],
    width: 40,
    eaves: 8.9,
    roof: 'hip',
    floors: 2,
  },
  {
    name: 'Scotland Yard street range',
    front: [
      [836, 136],
      [603, 225],
    ],
    width: 38,
    eaves: 8.6,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Court Gate south lodge',
    front: [
      [526, 267],
      [509, 220],
    ],
    width: 31,
    eaves: 9.6,
    roof: 'hip',
    floors: 2,
  },
  {
    name: 'Palace Court north-facing gallery',
    front: [
      [552, 258],
      [605, 430],
    ],
    width: 13,
    eaves: 4.6,
    roof: 'gable',
    floors: 1,
  },
  {
    name: 'Court passage',
    front: [
      [596, 425],
      [401, 478],
    ],
    width: 23,
    eaves: 8.8,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Palace Court south range',
    front: [
      [403, 475],
      [380, 319],
    ],
    width: 43,
    eaves: 9.4,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Privy Garden gabled frontage',
    front: [
      [331, 168],
      [353, 471],
    ],
    width: 37,
    eaves: 10.5,
    roof: 'cross',
    floors: 3,
    bays: 8,
  },
  {
    name: 'Garden north-east lodge',
    front: [
      [363, 229],
      [355, 175],
    ],
    width: 30,
    eaves: 9.5,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Garden long gallery',
    front: [
      [30, 533],
      [340, 491],
    ],
    width: 25,
    eaves: 8.9,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Guard Court range',
    front: [
      [658, 249],
      [708, 442],
    ],
    width: 37,
    eaves: 9.8,
    roof: 'gable',
    floors: 3,
  },
  {
    name: 'Guard Court lodgings',
    front: [
      [712, 255],
      [759, 334],
    ],
    width: 34,
    eaves: 9.2,
    roof: 'cross',
    floors: 2,
    bays: 3,
  },
  {
    name: 'Chapel approach range',
    front: [
      [770, 340],
      [790, 447],
    ],
    width: 34,
    eaves: 10.3,
    roof: 'hip',
    floors: 3,
  },
  {
    name: 'North offices and court',
    front: [
      [868, 104],
      [917, 236],
    ],
    width: 50,
    eaves: 9.7,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'North offices southern wing',
    front: [
      [914, 213],
      [862, 242],
    ],
    width: 32,
    eaves: 9.1,
    roof: 'cross',
    floors: 2,
    bays: 3,
  },
  {
    name: 'Scotland Yard east range',
    front: [
      [845, 301],
      [914, 483],
    ],
    width: 33,
    eaves: 8.5,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Scotland Yard rear court',
    front: [
      [841, 494],
      [917, 480],
    ],
    width: 29,
    eaves: 8.1,
    roof: 'cross',
    floors: 2,
    bays: 3,
  },
  {
    name: 'Great Hall',
    front: [
      [647, 463],
      [558, 490],
    ],
    width: 44,
    eaves: 14.6,
    roof: 'hall',
    floors: 2,
  },
  {
    name: 'Great Hall north stair and passage',
    front: [
      [658, 451],
      [697, 444],
    ],
    width: 28,
    eaves: 8.8,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Chapel Royal',
    front: [
      [555, 569],
      [658, 551],
    ],
    width: 42,
    eaves: 16.1,
    roof: 'chapel',
    floors: 1,
  },
  {
    name: 'Chapel Royal west vestibule',
    front: [
      [571, 593],
      [668, 579],
    ],
    width: 23,
    eaves: 9.6,
    roof: 'hip',
    floors: 2,
  },
  {
    name: 'Royal court south buildings',
    front: [
      [402, 477],
      [421, 528],
    ],
    width: 36,
    eaves: 9.1,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Royal court north buildings',
    front: [
      [526, 488],
      [543, 584],
    ],
    width: 32,
    eaves: 9.3,
    roof: 'cross',
    floors: 2,
    bays: 4,
  },
  {
    name: 'River Court north range',
    front: [
      [435, 564],
      [498, 551],
    ],
    width: 29,
    eaves: 8.1,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'River Court south return',
    front: [
      [391, 571],
      [406, 631],
    ],
    width: 31,
    eaves: 9.6,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Privy lodgings north court',
    front: [
      [711, 454],
      [765, 441],
    ],
    width: 31,
    eaves: 9.9,
    roof: 'cross',
    floors: 3,
    bays: 3,
  },
  {
    name: 'Privy lodgings north wing',
    front: [
      [764, 467],
      [799, 548],
    ],
    width: 28,
    eaves: 11.6,
    roof: 'gable',
    floors: 3,
  },
  {
    name: 'Privy lodgings south wing',
    front: [
      [685, 494],
      [721, 590],
    ],
    width: 34,
    eaves: 10.4,
    roof: 'gable',
    floors: 3,
  },
  {
    name: 'Office court north wing',
    front: [
      [833, 529],
      [857, 583],
    ],
    width: 20,
    eaves: 8.4,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Office court east range',
    front: [
      [895, 565],
      [824, 587],
    ],
    width: 35,
    eaves: 8.6,
    roof: 'cross',
    floors: 2,
    bays: 3,
  },
  {
    name: 'South river lodging',
    front: [
      [34, 635],
      [99, 646],
    ],
    width: 34,
    eaves: 10.7,
    roof: 'hip',
    floors: 3,
  },
  {
    name: 'River-front range south',
    front: [
      [99, 646],
      [203, 655],
    ],
    width: 22,
    eaves: 10,
    roof: 'flat',
    floors: 2,
  },
  {
    name: 'River-front bay pavilion',
    front: [
      [180, 653],
      [207, 653],
    ],
    width: 28,
    eaves: 11.4,
    roof: 'hip',
    floors: 3,
  },
  {
    name: 'River-front range centre',
    front: [
      [207, 654],
      [353, 655],
    ],
    width: 25,
    eaves: 11.2,
    roof: 'gable',
    floors: 3,
  },
  {
    name: 'King’s river lodgings',
    front: [
      [370, 656],
      [528, 654],
    ],
    width: 35,
    eaves: 12.5,
    roof: 'cross',
    floors: 3,
    bays: 6,
  },
  {
    name: 'Lodgings inner wing',
    front: [
      [218, 581],
      [332, 582],
    ],
    width: 35,
    eaves: 9.4,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Lodgings inner garden wing',
    front: [
      [93, 581],
      [205, 580],
    ],
    width: 29,
    eaves: 9.2,
    roof: 'cross',
    floors: 2,
    bays: 4,
  },
  {
    name: 'Lodgings south cross wing',
    front: [
      [76, 579],
      [60, 624],
    ],
    width: 20,
    eaves: 8.7,
    roof: 'gable',
    floors: 2,
  },
  {
    name: 'Lodgings east cross wing',
    front: [
      [345, 553],
      [343, 640],
    ],
    width: 22,
    eaves: 9.5,
    roof: 'hip',
    floors: 2,
  },
  {
    name: 'River-side privy gallery',
    front: [
      [538, 653],
      [669, 652],
    ],
    width: 36,
    eaves: 10.8,
    roof: 'hip',
    floors: 3,
  },
  {
    name: 'River-side apartments',
    front: [
      [701, 615],
      [819, 603],
    ],
    width: 28,
    eaves: 11.6,
    roof: 'hip',
    floors: 3,
    light: true,
  },
  {
    name: 'Northern terrace lodgings',
    front: [
      [821, 615],
      [1006, 613],
    ],
    width: 19,
    eaves: 8.6,
    roof: 'gable',
    floors: 2,
  },
];

export const controls = {
  holbeinGate: [334, 154],
  courtGate: [
    [507, 221],
    [568, 201],
  ],
  banquetingHouse: { centre: [4.54, 1.9], length: 37.24, depth: 20.72 },
  garden: [
    [32, 207],
    [330, 157],
    [352, 488],
    [32, 535],
  ],
  waterfront: [
    [28, 641],
    [197, 657],
    [366, 657],
    [530, 656],
    [693, 620],
    [819, 616],
    [1007, 616],
  ],
  privyStairs: [
    [345, 654],
    [369, 655],
  ],
};

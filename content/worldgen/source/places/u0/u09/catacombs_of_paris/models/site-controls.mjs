// Model axes +X east, +Z south. Footprints use PMTiles; see pmtiles-context.json.
const entranceShaft = [-7.2683, 8.0672];
// The exit cutaway places the shaft in the right-hand room off the street passage.
const exitShaft = [154.0341, 484.0256];

export const site = {
  anchor: [2.3323984359767334, 48.833829420885976],
  modelDatum: 66.29842,
  coordinateSpace: 'east-south-metres',
  entrance: {
    point: [0, 0],
    heading: -2.08128560281,
    width: 16.8945,
    depth: 12.2377,
    floor: 0.205,
    stair: entranceShaft,
    steps: 131,
    landingPad: [8.76, 0.6, 13.74, 5.26],
  },
  exit: {
    point: [152.6081, 480.2365],
    heading: -1.3296982633,
    width: 12.3471,
    depth: 8.96,
    floor: -2.2434,
    stair: exitShaft,
    steps: 112,
    landingPad: [2.02, -2.8, 5.89, 2.12],
    landingDoor: [-1.17, 0.21],
    landingRotation: Math.PI / 2,
  },
  routeDepth: -20,
  routeCenterlineMeters: 775.247,
  // Eastern ossuary leg traced from the museum route plan. Junctions use the modeled gallery walls.
  easternGallery: {
    mouths: [
      { segment: 27, side: 1, range: [0.035, 0.35] },
      { segment: 48, side: 1, range: [0.3, 0.53] },
    ],
    headroom: 1.89,
    points: [
      [67.3939, 396.8885],
      [74.1496, 400.4872],
      [85.4647, 405.113],
      [92.8989, 411.085],
      [101.4207, 417.4769],
      [109.4885, 422.1422],
      [115.8245, 426.8285],
      [113.9288, 431.1819],
      [112.0568, 437.4836],
      [111.2408, 441.6073],
      [111.7291, 446.1482],
    ],
  },
  route: [
    {
      point: entranceShaft,
      kind: 'entry-stair',
    },
    {
      point: [-4.6236, 17.2407],
      kind: 'quarry',
    },
    {
      point: [-19.0971, 37.7692],
      kind: 'quarry',
    },
    {
      point: [4.4464, 50.907],
      kind: 'quarry',
    },
    {
      point: [5.4018, 58.2569],
      kind: 'quarry',
    },
    {
      point: [22.7758, 133.8263],
      kind: 'quarry',
    },
    {
      point: [35.9689, 186.0629],
      kind: 'quarry',
    },
    {
      point: [37.3047, 189.0778],
      kind: 'quarry',
    },
    {
      point: [31.0312, 207.3415],
      kind: 'quarry',
    },
    {
      point: [34.5266, 209.8972],
      kind: 'aqueduct',
    },
    {
      point: [23.6642, 242.5067],
      kind: 'quarry',
    },
    {
      point: [15.2891, 265.9922],
      kind: 'quarry',
    },
    {
      point: [3.7516, 278.6905],
      kind: 'workshop',
    },
    {
      point: [-7.3318, 293.1153],
      kind: 'quarry',
    },
    {
      point: [-11.5562, 301.8273],
      kind: 'quarry',
    },
    {
      point: [4.9334, 304.658],
      kind: 'quarry',
    },
    {
      point: [35.2096, 301.6917],
      kind: 'quarry',
    },
    {
      point: [51.34, 310.5893],
      kind: 'quarry',
    },
    {
      point: [62.101, 305.2621],
      kind: 'pillars',
    },
    {
      point: [67.3861, 312.5593],
      kind: 'quarry',
    },
    {
      point: [68.3837, 323.373],
      kind: 'quarry',
    },
    {
      point: [73.3516, 340.2009],
      kind: 'stairs',
    },
    {
      point: [71.7356, 349.7472],
      kind: 'portal',
    },
    {
      point: [71.8251, 357.1077],
      kind: 'ossuary',
    },
    {
      point: [68.4403, 363.6443],
      kind: 'ossuary',
    },
    {
      point: [65.5779, 377.5362],
      kind: 'ossuary',
    },
    {
      point: [63.1117, 388.392],
      kind: 'ossuary',
    },
    {
      point: [56.2369, 392.8059],
      kind: 'ossuary',
    },
    {
      point: [48.8712, 392.4624],
      kind: 'ossuary',
    },
    {
      point: [40.2644, 396.8974],
      kind: 'ossuary',
    },
    {
      point: [35.5544, 401.285],
      kind: 'samaritaine',
    },
    {
      point: [26.3884, 395.334],
      kind: 'ossuary',
    },
    {
      point: [18.516, 388.9342],
      kind: 'ossuary',
    },
    {
      point: [12.9032, 390.3015],
      kind: 'ossuary',
    },
    {
      point: [7.4168, 402.0601],
      kind: 'sepulchral',
    },
    {
      point: [9.2486, 410.2655],
      kind: 'ossuary',
    },
    {
      point: [19.7031, 415.3347],
      kind: 'ossuary',
    },
    {
      point: [28.727, 409.5956],
      kind: 'ossuary',
    },
    {
      point: [36.5783, 414.2635],
      kind: 'ossuary',
    },
    {
      point: [41.8792, 422.8597],
      kind: 'ossuary',
    },
    {
      point: [51.0873, 432.2744],
      kind: 'memorial',
    },
    {
      point: [58.9545, 438.2412],
      kind: 'ossuary',
    },
    {
      point: [66.2991, 436.8528],
      kind: 'ossuary',
    },
    {
      point: [75.4441, 441.072],
      kind: 'ossuary',
    },
    {
      point: [84.9694, 440.9562],
      kind: 'ossuary',
    },
    {
      point: [93.2643, 446.4847],
      kind: 'ossuary',
    },
    {
      point: [102.8633, 452.4305],
      kind: 'ossuary',
    },
    {
      point: [111.5437, 454.0571],
      kind: 'ossuary',
    },
    {
      point: [118.8094, 446.1742],
      kind: 'passion',
    },
    {
      point: [126.1909, 447.8165],
      kind: 'ossuary',
    },
    {
      // The Paris Musées planning diagram places a return beside the Fontis junction.
      point: [124.21, 454.85],
      kind: 'ossuary',
    },
    {
      point: [123.978, 458.845],
      kind: 'quarry',
    },
    {
      point: [128.371, 459.485],
      kind: 'quarry',
    },
    {
      point: [133.17, 457.603],
      kind: 'quarry',
    },
    {
      point: [141.954, 458.884],
      kind: 'quarry',
    },
    {
      point: [144.108, 461.93],
      kind: 'quarry',
    },
    {
      point: [145.071, 470.725],
      kind: 'quarry',
    },
    {
      point: [150.861, 475.82],
      kind: 'quarry',
    },
    {
      point: exitShaft,
      kind: 'exit-stair',
    },
  ],
};

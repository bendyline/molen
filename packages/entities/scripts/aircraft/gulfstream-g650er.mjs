/** Gulfstream G650ER, BR725. No dimensioned drawing was found: Gulfstream does not publish an
 * airport planning three-view. Stations are traced from photograph EC-LZU, a long-lens profile
 * about 20 degrees off the beam: 57 px/m along the body from the 30.41 m length and 54 px/m in
 * height from the 7.82 m overall height, the two differing by that foreshortening. The wing is
 * built from the published 36 degree sweep and 119.2 m2 area, and its traced tip then falls where
 * the same yaw predicts. Treat this as a reconstruction, not a measured three-view.
 */
import { buildTransport, transportFrame } from './transport-kit.mjs';

const body = [
  [0.02, 0.05, 0.72, 0.78, 0.5],
  [0.05, 0.08, 0.71, 0.79, 0.5],
  [0.1, 0.13, 0.67, 0.83, 0.5],
  [0.2, 0.2, 0.61, 0.91, 0.5],
  [0.3, 0.25, 0.56, 0.96, 0.5],
  [0.5, 0.34, 0.49, 1.08, 0.5],
  [0.75, 0.45, 0.41, 1.22, 0.5],
  [1, 0.55, 0.35, 1.33, 0.5],
  [1.25, 0.64, 0.28, 1.5, 0.5],
  [1.5, 0.72, 0.23, 1.63, 0.5],
  [1.75, 0.8, 0.19, 1.8, 0.5],
  [2, 0.87, 0.15, 2, 0.5],
  [2.25, 0.94, 0.11, 2.15, 0.5],
  [2.5, 1, 0.08, 2.25, 0.5],
  [3, 1.12, 0.05, 2.41, 0.5],
  [3.5, 1.2, 0.02, 2.53],
  [4, 1.27, 0, 2.6],
  [4.5, 1.31, 0, 2.63],
  [5, 1.33, 0, 2.65],
  [6, 1.35, 0, 2.68],
  [10, 1.35, 0, 2.7],
  [19, 1.35, 0.04, 2.7],
  [20, 1.3, 0.25, 2.72],
  [21, 1.22, 0.55, 2.74],
  [22, 1.1, 0.85, 2.75],
  [23, 0.95, 1.1, 2.74],
  [24, 0.75, 1.4, 2.7],
  [25, 0.5, 1.72, 2.5],
  [25.75, 0.12, 2, 2.2],
];
const wingH = (x) => 0.3 + 0.1 * (x - 1.35);

export const g650 = {
  prefix: 'GLF6',
  length: 30.41,
  width: 2.7,
  bodyHeight: 2.7,
  // Keel set so the fin reaches the 7.82 m height; stands essentially level.
  stance: [0, 12, 1.55],
  midFraction: 0.5,
  bellyAngle: 2.1,
  bellyColor: '#d4d6d2',
  body,
  cockpit: {
    uStart: 1.7,
    uEnd: 3.47,
    centerPost: 2.3,
    low: [
      [1.6, 1.7],
      [1.86, 1.68],
      [2.6, 1.68],
      [3.47, 1.74],
      [3.9, 1.76],
    ],
    top: [
      [1.6, 2.1],
      [2.6, 2.16],
      [3.47, 2.18],
      [3.9, 2.18],
    ],
    arcs: [[1.7, 1.69]],
    posts: [
      [2.4, 2.6],
      [3, 3],
    ],
  },
  // No published eye position. Placed as on the Dash 8 and CJ4: forward in the side pane.
  eye: { u: 2.95, x: 0.44, h: 2, floor: 0.93, bulkhead: 5.45 },
  cabinWidth: 1.5,
  windows: {
    y: 1.68,
    w: 0.66,
    h: 0.43,
    oval: true,
    pitch: 1.3,
    runs: [{ from: 6.42, count: 8 }],
  },
  doors: [
    { u0: 4.4, u1: 5.28, y0: 0.35, y1: 2.42, corner: 0.2, side: 1 },
    { u0: 10.9, u1: 11.75, y0: 1.32, y1: 2.02, corner: 0.16 },
    { u0: 12.2, u1: 13.05, y0: 1.32, y1: 2.02, corner: 0.16 },
  ],
  seams: [1],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 14.2,
    rows: [
      [0.3, wingH(0.3), 8.6, 16.2, 0.36],
      [1.35, wingH(1.35), 9.4, 16.2, 0.34],
      [5.5, wingH(5.5), 12.4, 17, 0.2],
      [14.2, wingH(14.2), 18.7, 20.2, 0.07],
      [14.6, 1.8, 19.2, 20.5, 0.06],
      [14.85, 2.2, 19.9, 20.9, 0.05],
      [15.02, 2.8, 20.7, 21.4, 0.04],
      [15.18, 3.35, 21.4, 21.95, 0.015],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 1.5, to: 5.4, chord: 0.27 },
      { kind: 'flap', name: 'outer', from: 5.6, to: 10.5, chord: 0.28 },
      { kind: 'aileron', from: 10.7, to: 13.6, chord: 0.24 },
    ],
  },
  fin: {
    rows: [
      [2.4, 20.4, 25.6, 0.22],
      [2.75, 21, 25.85, 0.2],
      [3.11, 21.7, 26, 0.17],
      [4.18, 22.95, 26.4, 0.13],
      [5.1, 23.65, 26.75, 0.11],
      [6, 24.1, 27.2, 0.1],
      [6.26, 24.4, 27.3, 0.06],
    ],
    rudder: { from: 3.1, to: 5.85, chord: 0.33 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [23.9, 0.02, 6.1, 6.15],
          [24.6, 0.2, 5.98, 6.3],
          [26, 0.26, 5.98, 6.32],
          [27.6, 0.16, 6.02, 6.22],
          [28.6, 0.02, 6.1, 6.12],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.2, 6.05, 24.35, 28, 0.16],
      [0.8, 6.08, 25.1, 28.1, 0.14],
      [5.4, 6.22, 29.5, 30.25, 0.05],
      [5.7, 6.25, 29.95, 30.41, 0.02],
    ],
    elevator: { from: 0.7, to: 5.3, chord: 0.33 },
  },
  fairings: [
    {
      name: 'belly-fairing',
      rows: [
        [9, 0.9, 0.1, 0.9],
        [10.5, 1.35, -0.35, 1.1],
        [12.5, 1.55, -0.6, 1.2],
        [14, 1.55, -0.63, 1.2],
        [15.5, 1.45, -0.55, 1.15],
        [17, 1.1, -0.25, 1],
        [18.5, 0.45, 0.25, 0.8],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 2.55,
    u: 18.25,
    h: 2.28,
    lip: [
      [0.3, 0.62, 0.62, 0.62],
      [0.08, 0.63, 0.63, 0.63],
      [0, 0.68, 0.68, 0.68],
      [0.06, 0.74, 0.74, 0.74],
      [0.2, 0.8, 0.8, 0.8],
    ],
    cowl: [
      [0.2, 0.8, 0.8, 0.8],
      [0.7, 0.86, 0.86, 0.86],
      [1.4, 0.86, 0.86, 0.86],
      [2.2, 0.78, 0.78, 0.78],
      [3, 0.6, 0.6, 0.6],
      [3.6, 0.45, 0.45, 0.45],
    ],
    duct: [
      [0.3, 0.62, 0.62, 0.62],
      [0.6, 0.62, 0.62, 0.62],
    ],
    fanAt: 0.55,
    fanRadius: 0.61,
    spinner: [0.18, 0.4],
    core: [
      [3.2, 0.4, 0],
      [3.75, 0.36, 0],
    ],
    plug: [
      [3.7, 0.2, 0],
      [4, 0.03, 0],
    ],
    pylonMaterial: 'paint',
    pylon: [
      [19.4, 0.02, 2.25, 2.3, -0.65],
      [19.9, 0.62, 2.06, 2.46, -0.65],
      [21, 0.65, 2.06, 2.46, -0.65],
      [21.6, 0.6, 2.1, 2.4, -0.65],
      [22.3, 0.02, 2.25, 2.3, -0.65],
    ],
  },
  gear: {
    // Stations read from the photograph; Gulfstream's figures were not found.
    nose: { u: 2.28, r: 0.3, w: 0.17, spread: 0.36, top: 1.75, strut: 0.07 },
    main: { u: 15.2, x: 2.2, pivotX: 2.75, r: 0.5, w: 0.3, spread: 0.62, top: 2.2, strut: 0.1 },
  },
};
export const g650Frame = () => transportFrame(g650);
export const buildG650 = (s) => buildTransport(s, g650);

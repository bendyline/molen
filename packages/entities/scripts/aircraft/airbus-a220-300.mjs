/** Airbus A220-300 (BD-500-1A11), PW1500G.
 * The Airbus ACP (Oct 2026) tabulates locators A to BB, but in the PDF as published its dimension
 * figures have no line art: only the letters render. So dimensions come from the tables, with each
 * letter identified by where its label sits on the blank figure, and the fuselage outline comes
 * from a near-orthographic side-on photograph (airBaltic CS300 YL-CSA) at 43.65 px/m, a scale the
 * 38.69 m length and the 15.31 m wheelbase each give independently.
 * Identifying M 13.04, J 19.89, G 21.79 and F 24.42 m as wing stations gives a planform of
 * 111.4 m2 against the published 112.3 m2, which is why those readings were kept.
 */
import { buildTransport, canoe, transportFrame } from './transport-kit.mjs';

const body = [
  // Above u 1.25 the crown is read by eye off the photograph: the glazing defeats edge tracing.
  [0.02, 0.09, 1.05, 1.2, 0.5],
  [0.05, 0.13, 1.01, 1.26, 0.5],
  [0.1, 0.22, 0.96, 1.33, 0.5],
  [0.2, 0.35, 0.87, 1.44, 0.5],
  [0.3, 0.46, 0.82, 1.53, 0.5],
  [0.5, 0.62, 0.72, 1.7, 0.5],
  [0.75, 0.79, 0.57, 1.88, 0.5],
  [1, 0.93, 0.45, 2.02, 0.5],
  [1.25, 1.04, 0.35, 2.15, 0.5],
  [1.5, 1.14, 0.27, 2.35, 0.5],
  [2, 1.33, 0.17, 2.62, 0.5],
  [2.34, 1.43, 0.12, 2.84, 0.5],
  [2.5, 1.48, 0.1, 2.95, 0.5],
  [3, 1.6, 0.05, 3.16],
  [3.5, 1.7, 0.02, 3.37],
  [4, 1.77, 0, 3.51],
  [4.5, 1.81, 0, 3.6],
  [5, 1.82, 0, 3.67],
  [6, 1.86, 0, 3.72],
  [26, 1.86, 0, 3.72],
  [27, 1.84, 0.07, 3.72],
  [28, 1.8, 0.2, 3.72],
  [29, 1.71, 0.37, 3.72],
  [30, 1.6, 0.56, 3.72],
  [31, 1.48, 0.77, 3.72],
  [32, 1.35, 1, 3.72],
  [33, 1.19, 1.24, 3.71],
  [34, 1.02, 1.5, 3.68],
  [35, 0.85, 1.78, 3.62],
  [36, 0.66, 2.08, 3.55],
  [37, 0.48, 2.37, 3.45],
  [38, 0.28, 2.66, 3.3],
  [38.69, 0.1, 2.9, 3.12],
];
const wingH = (x) => 0.95 + 0.112 * (x - 1.86);
const tailH = (x) => 2.42 + 0.115 * x;
// Fin read at 5.46 m crown height in the photograph and scaled so its top lands on locator R.
const fin = (photo) => 3.72 + (photo - 5.46) * 1.056;

export const a220 = {
  prefix: 'BCS3',
  length: 38.69,
  width: 3.72,
  bodyHeight: 3.72,
  // Locator AA gives the static attitude directly: 0.477 degrees nose down. Locator A, fuselage
  // top, is 5.38 to 5.48 m, which puts a 3.72 m body 1.74 m off the ground.
  stance: [0.00833, 12, 1.74],
  midFraction: 0.5,
  bellyAngle: 1.95,
  body,
  cockpit: {
    uStart: 1.25,
    uEnd: 3.2,
    centerPost: 2.13,
    low: [
      [1.1, 2.13],
      [1.26, 2.13],
      [1.8, 2.16],
      [2.4, 2.2],
      [3.2, 2.24],
      [3.6, 2.26],
    ],
    // The photograph's side window top stands near 2.8, but this elliptical section then carries
    // the glass over the head: 2.71 gives the pilot about the published 25 degrees up.
    top: [
      [1.1, 2.71],
      [3.6, 2.71],
    ],
    posts: [[2.3, 2.34]],
  },
  // ACP 'Visibility from cockpit': eye 2.6 m aft of the nose tip, 0.5 m off the centerline; 17
  // degrees down, 25 up.
  eye: { u: 2.6, x: 0.5, h: 2.5, floor: 1.45, bulkhead: 5.2 },
  cabinWidth: 1.9,
  windows: {
    y: 2.47,
    w: 0.28,
    h: 0.45,
    pitch: 0.87,
    runs: [
      { from: 6.9, count: 10 },
      { from: 16.75, count: 14 },
    ],
  },
  doors: [
    { u0: 4.92, u1: 5.96, y0: 1.37, y1: 3.25, corner: 0.17 },
    { u0: 29.67, u1: 30.65, y0: 1.37, y1: 3.25, corner: 0.17 },
    { u0: 15.49, u1: 16.08, y0: 1.9, y1: 2.95 },
    { u0: 8, u1: 9.3, y0: 0.2, y1: 1.2, side: -1 },
    { u0: 23.6, u1: 24.9, y0: 0.2, y1: 1.2, side: -1 },
  ],
  seams: [1.1],
  wing: {
    rows: [
      [0.3, wingH(0.3), 12.25, 19.89, 0.38],
      [1.86, wingH(1.86), 13.04, 19.89, 0.35],
      [6, wingH(6), 15.15, 19.89, 0.22],
      [16.8, 2.62, 20.66, 21.79, 0.07],
      [17.1, 2.84, 20.95, 22.1, 0.065],
      [17.3, 3.2, 21.6, 22.6, 0.055],
      [17.45, 3.7, 22.6, 23.4, 0.04],
      [17.54, 4.14, 23.7, 24.42, 0.02],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 2, to: 5.9, chord: 0.28 },
      { kind: 'flap', name: 'outer', from: 6.1, to: 13, chord: 0.29 },
      { kind: 'aileron', from: 13.2, to: 16.2, chord: 0.23 },
    ],
    pods: [
      { x: 5.8, rows: canoe(18.8, 2.4, 0.8) },
      { x: 9, rows: canoe(19.2, 2.4, 0.8) },
      { x: 12, rows: canoe(19.6, 2.3, 0.75) },
    ],
  },
  fin: {
    rows: [
      [3.2, 29.4, 36.3, 0.34],
      [3.72, 30, 36.5, 0.3],
      [fin(6.05), 31.6, 36.75, 0.2],
      [fin(6.96), 32.8, 36.95, 0.16],
      [fin(8.34), 34.1, 37.2, 0.125],
      [fin(11.0), 35.85, 37.73, 0.07],
      [fin(11.13), 36.3, 37.8, 0.03],
    ],
    rudder: { from: fin(5.7), to: fin(11.05), chord: 0.33 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 33.6, 36.2, 0.16],
      [0.6, tailH(0.6), 33.75, 36.21, 0.155],
      [5.8, tailH(5.8), 36.25, 37.7, 0.05],
      [6.13, tailH(6.13), 36.65, 37.83, 0.025],
    ],
    elevator: { from: 0.7, to: 5.75, chord: 0.34 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [10.8, 0.9, 0.35, 0.95],
        [12, 1.5, 0.1, 1.3],
        [14, 2, -0.02, 1.45],
        [16, 2.15, -0.06, 1.5],
        [18, 2.15, -0.06, 1.5],
        [20, 2, 0, 1.45],
        [22, 1.4, 0.2, 1.25],
        [23.4, 0.4, 0.5, 0.9],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 4.75,
    u: 12.17,
    h: 0.1,
    // Locator G: 0.58 to 0.66 m under the nacelle. The photograph gives a pod about 2.45 m deep.
    lip: [
      [0.5, 0.94, 0.94, 0.94],
      [0.12, 0.94, 0.94, 0.94],
      [0, 1.02, 1.02, 1.02],
      [0.07, 1.1, 1.1, 1.1],
      [0.22, 1.16, 1.16, 1.16],
    ],
    cowl: [
      [0.22, 1.16, 1.16, 1.16],
      [0.7, 1.22, 1.22, 1.22],
      [1.4, 1.24, 1.24, 1.24],
      [2.2, 1.22, 1.2, 1.22],
      [3, 1.1, 1.06, 1.1],
      [3.75, 0.86, 0.82, 0.86],
    ],
    duct: [
      [0.5, 0.94, 0.94, 0.94],
      [0.82, 0.94, 0.94, 0.94],
    ],
    fanAt: 0.75,
    fanRadius: 0.92,
    spinner: [0.3, 0.6],
    blades: 18,
    core: [
      [3, 0.7, -0.06],
      [3.75, 0.52, -0.08],
      [4.4, 0.4, -0.1],
    ],
    plug: [
      [4.4, 0.24, -0.1],
      [4.7, 0.14, -0.1],
      [5.05, 0.012, -0.1],
    ],
    pylon: [
      [12.9, 0.03, 1.15, 1.25],
      [13.6, 0.1, 1.15, 1.42],
      [15, 0.16, 1, 1.5],
      [16.6, 0.15, 0.95, 1.42],
      [18, 0.1, 1.05, 1.36],
      [18.9, 0.03, 1.12, 1.25],
    ],
  },
  gear: {
    // Locators Z wheelbase, W nose gear station, Y track, X axle spread.
    nose: { u: 3.39, r: 0.31, w: 0.19, spread: 0.42, top: 2, strut: 0.075 },
    main: { u: 18.7, x: 3.365, pivotX: 4, r: 0.51, w: 0.34, spread: 0.69, top: 2.55, strut: 0.11 },
  },
};
export const a220Frame = () => transportFrame(a220);
export const buildA220 = (s) => buildTransport(s, a220);

/** Embraer 175 with the enhanced wingtip (28.65 m span), CF34-8E.
 * Traced from Embraer APM 2259 Rev 22 (Nov 29/24), figure 2.2. The printed views are not mutually
 * to scale, so each axis has its own calibration: 18.69 px/m along the body from the 31.68 m bar,
 * 19.3 px/m across it from the 10.00 m tail span, 19.9 px/m in the front view from the span.
 * Table 2.2 supplies the stance and clearances.
 */
import { buildE175Cockpit } from './embraer-e175-cockpit.mjs';
import { buildTransport, canoe, transportFrame } from './transport-kit.mjs';

const KEEL = 1.29;
const row = (u, half, keel, crown, mid) => [u, half, keel - KEEL, crown - KEEL, mid];
const body = [
  row(0.02, 0.09, 2.03, 2.17, 0.5),
  row(0.05, 0.13, 1.96, 2.25, 0.5),
  row(0.1, 0.17, 1.92, 2.31, 0.5),
  row(0.2, 0.25, 1.85, 2.43, 0.5),
  row(0.4, 0.41, 1.76, 2.6, 0.5),
  row(0.65, 0.59, 1.67, 2.8, 0.5),
  row(0.9, 0.73, 1.61, 2.98, 0.5),
  row(1.25, 0.88, 1.54, 3.2, 0.5),
  row(1.4, 0.95, 1.51, 3.3, 0.5),
  row(1.9, 1.1, 1.45, 3.62, 0.5),
  row(2.4, 1.23, 1.4, 3.92, 0.51),
  row(2.9, 1.3, 1.37, 4.2),
  row(3.4, 1.38, 1.33, 4.42),
  row(3.9, 1.43, 1.32, 4.53),
  row(4.9, 1.49, 1.3, 4.65),
  row(6, 1.505, 1.29, 4.68),
  row(19, 1.505, 1.29, 4.68),
  row(20, 1.5, 1.37, 4.68),
  row(21, 1.5, 1.47, 4.68),
  row(22, 1.48, 1.59, 4.67),
  row(23, 1.41, 1.76, 4.65),
  row(24, 1.29, 1.95, 4.62),
  row(25, 1.12, 2.11, 4.59),
  row(26, 0.9, 2.28, 4.55),
  row(27, 0.67, 2.48, 4.51),
  row(28, 0.52, 2.69, 4.46),
  row(29, 0.45, 2.93, 4.41),
  row(30, 0.32, 3.18, 4.34),
  row(31, 0.17, 3.47, 4.25),
  row(31.4, 0.09, 3.62, 4.16),
  row(31.68, 0.03, 3.8, 4.02),
];
const wingH = (x) => 1.13 + 0.0917 * (x - 6);
const tailH = (x) => 2.41 + 0.13 * (x - 1.8);
const fin = (y) => y - KEEL;

export const e175 = {
  prefix: 'E175',
  length: 31.68,
  width: 3.01,
  bodyHeight: 3.39,
  // Table 2.2: fuselage angle 0.4 to 0.6 degrees nose up, forward door 2.54 to 2.58 m against
  // 2.38 to 2.42 m aft. The ground line in figure 2.2 is drawn sloping for the same reason.
  stance: [-0.0087, 15.53, 1.29],
  midFraction: 0.52,
  bellyAngle: 1.95,
  body,
  cockpit: {
    uStart: 1.73,
    uEnd: 3.5,
    centerPost: 2.45,
    low: [
      [1.5, 2.2],
      [1.9, 2.22],
      [2.6, 2.2],
      [3.1, 2.22],
      [3.5, 2.34],
      [3.9, 2.34],
    ],
    // N401YX, side on: the windscreen pillar starts at 2.28 and its head stands at 2.65. On this
    // elliptical section its upper end has to stand further aft to stay outboard of the pilot.
    top: [
      [1.5, 2.66],
      [3.1, 2.66],
      [3.5, 2.62],
      [3.9, 2.62],
    ],
    posts: [
      [2.28, 2.85],
      [3.1, 3.16],
    ],
  },
  // APM figure 4.5: eye 2.92 m aft of the nose tip, 0.53 m off the centerline, 3.91 m high; 15
  // degrees down, 27.8 up.
  eye: { u: 2.92, x: 0.53, h: 2.5, floor: 1.42, bulkhead: 5.45 },
  cabinWidth: 1.8,
  flightDeck: buildE175Cockpit,
  // Photograph N401YX gives 0.72 m between windows; the APM schematic draws them 0.95 m apart.
  windows: {
    y: 2.39,
    w: 0.27,
    h: 0.4,
    pitch: 0.72,
    runs: [
      { from: 6.3, count: 12 },
      { from: 15, count: 1 },
      { from: 15.9, count: 10 },
    ],
  },
  doors: [
    { u0: 4.71, u1: 5.6, y0: 1.17, y1: 3, corner: 0.17 },
    { u0: 23.04, u1: 23.9, y0: 1.17, y1: 3, corner: 0.17 },
    { u0: 14.7, u1: 15.3, y0: 1.72, y1: 2.72, side: 1 },
    { u0: 7.1, u1: 8.35, y0: 0.2, y1: 1.05, side: -1 },
    { u0: 20, u1: 21.2, y0: 0.25, y1: 1.05, side: -1 },
  ],
  seams: [1.1],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 12.45,
    rows: [
      [0.3, wingH(0.3), 11.1, 16.72, 0.34],
      [1.8, wingH(1.8), 12, 16.72, 0.31],
      [3, wingH(3), 12.61, 16.72, 0.27],
      [5, wingH(5), 13.64, 16.84, 0.21],
      [8, wingH(8), 15.18, 17.66, 0.15],
      [12, wingH(12), 17.24, 18.74, 0.09],
      [12.45, 1.74, 17.47, 18.86, 0.08],
      [13, 2.24, 17.92, 19.06, 0.065],
      [13.5, 2.69, 18.37, 19.25, 0.05],
      [14, 3.14, 18.85, 19.43, 0.035],
      [14.325, 3.43, 19.3, 19.56, 0.015],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 1.9, to: 4.9, chord: 0.28 },
      { kind: 'flap', name: 'outer', from: 5.1, to: 9.6, chord: 0.29 },
      { kind: 'aileron', from: 9.8, to: 12.2, chord: 0.24 },
    ],
    pods: [
      { x: 5.6, rows: canoe(16, 2.3, 0.75) },
      { x: 7.8, rows: canoe(16.7, 2.3, 0.75) },
      { x: 9.9, rows: canoe(17.4, 2, 0.7) },
    ],
  },
  fin: {
    rows: [
      [2.9, 22.9, 29.5, 0.3],
      [fin(4.67), 23.3, 29.7, 0.29],
      [fin(5), 24.47, 29.89, 0.2],
      [fin(5.25), 25.4, 29.95, 0.15],
      [fin(5.5), 25.71, 30.01, 0.135],
      [fin(7), 27.04, 30.37, 0.11],
      [fin(9), 28.81, 30.87, 0.075],
      [fin(9.8), 29.64, 31.07, 0.05],
      [fin(9.9), 30, 31.1, 0.03],
    ],
    rudder: { from: fin(4.8), to: fin(9.7), chord: 0.32 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 25.7, 29.5, 0.16],
      [1, tailH(1), 26.7, 29.79, 0.14],
      [4, tailH(4), 28.84, 30.61, 0.06],
      [4.8, tailH(4.8), 29.49, 30.83, 0.04],
      [5, tailH(5), 30.05, 30.88, 0.02],
    ],
    elevator: { from: 0.6, to: 4.75, chord: 0.33 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [8.5, 0.9, 0.2, 1.1],
        [10, 1.35, -0.23, 1.2],
        [12, 1.6, -0.31, 1.3],
        [14, 1.7, -0.34, 1.4],
        [16, 1.65, -0.28, 1.4],
        [18, 1.35, -0.12, 1.3],
        [19.8, 0.5, 0.35, 0.9],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 3.96,
    u: 10.58,
    h: -0.01,
    lip: [
      [0.35, 0.62, 0.62, 0.62],
      [0.1, 0.63, 0.63, 0.63],
      [0, 0.7, 0.7, 0.7],
      [0.05, 0.76, 0.76, 0.76],
      [0.15, 0.8, 0.8, 0.8],
    ],
    cowl: [
      [0.15, 0.8, 0.8, 0.8],
      [0.42, 0.83, 0.82, 0.81],
      [0.92, 0.84, 0.81, 0.81],
      [1.42, 0.82, 0.78, 0.78],
      [1.72, 0.76, 0.72, 0.72],
      [1.95, 0.68, 0.64, 0.64],
    ],
    duct: [
      [0.35, 0.62, 0.62, 0.62],
      [0.6, 0.62, 0.62, 0.62],
    ],
    fanAt: 0.55,
    fanRadius: 0.61,
    spinner: [0.17, 0.4],
    core: [
      [1.6, 0.58, 0],
      [2.2, 0.49, -0.04],
      [2.92, 0.35, -0.05],
      [3.42, 0.28, -0.06],
      [3.92, 0.25, -0.07],
    ],
    plug: [
      [3.92, 0.12, -0.07],
      [4.3, 0.01, -0.07],
    ],
    pylon: [
      [11, 0.03, 0.75, 0.85],
      [11.6, 0.09, 0.7, 1.05],
      [12.6, 0.13, 0.55, 1.08],
      [13.8, 0.12, 0.4, 1.05],
      [14.8, 0.09, 0.4, 1],
      [15.6, 0.03, 0.6, 0.92],
    ],
  },
  gear: {
    // 11.40 m wheelbase, 5.20 m track, 4.13 m nose to nose gear.
    nose: { u: 4.13, r: 0.3, w: 0.19, spread: 0.37, top: 1.6, strut: 0.07 },
    main: { u: 15.53, x: 2.6, pivotX: 3.2, r: 0.48, w: 0.33, spread: 0.72, top: 2.25, strut: 0.1 },
  },
};
export const e175Frame = () => transportFrame(e175);
export const buildE175 = (s) => buildTransport(s, e175);

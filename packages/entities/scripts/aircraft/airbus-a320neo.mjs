/** Airbus A320neo, CFM LEAP-1A, sharklets.
 * Traced from Airbus AC A320 (Jul 01/26), figures 2-2-0-991-009-A01 sheets 1 and 2, at 16.1 px/m on
 * both axes: the 37.57 m length, 11.76 m height, 12.64 m wheelbase and 4.14 m body depth all agree
 * within a pixel. Annotated bars win over drawn width (3.95 m against 3.85 m drawn).
 * Ground clearances come from figure 2-3-0-991-032-A01.
 */
import { buildA320Cockpit } from './airbus-a320neo-cockpit.mjs';
import { buildTransport, canoe, transportFrame } from './transport-kit.mjs';

const KEEL = 1.79;
const body = [
  // u, half-breadth, then keel and crown read at ground heights less the 1.79 m barrel keel
  [0.02, 0.1, 3.14 - KEEL, 3.24 - KEEL, 0.5],
  [0.05, 0.14, 2.92 - KEEL, 3.33 - KEEL, 0.5],
  [0.1, 0.21, 2.82 - KEEL, 3.43 - KEEL, 0.5],
  [0.2, 0.32, 2.69 - KEEL, 3.56 - KEEL, 0.5],
  [0.3, 0.43, 2.6 - KEEL, 3.66 - KEEL, 0.5],
  [0.45, 0.56, 2.5 - KEEL, 3.77 - KEEL, 0.5],
  [0.6, 0.67, 2.42 - KEEL, 3.88 - KEEL, 0.5],
  [0.8, 0.82, 2.33 - KEEL, 4 - KEEL, 0.5],
  [1, 0.95, 2.25 - KEEL, 4.1 - KEEL, 0.5],
  [1.25, 1.06, 2.17 - KEEL, 4.21 - KEEL, 0.5],
  [1.5, 1.16, 2.1 - KEEL, 4.4 - KEEL, 0.5],
  [1.75, 1.26, 2.04 - KEEL, 4.66 - KEEL, 0.5],
  [2, 1.36, 1.99 - KEEL, 4.9 - KEEL, 0.5],
  [2.25, 1.45, 1.94 - KEEL, 5.07 - KEEL, 0.5],
  [2.5, 1.53, 1.9 - KEEL, 5.2 - KEEL, 0.5],
  [2.75, 1.6, 1.87 - KEEL, 5.33 - KEEL],
  [3, 1.66, 1.84 - KEEL, 5.41 - KEEL],
  [3.5, 1.78, 1.81 - KEEL, 5.57 - KEEL],
  [4, 1.86, 1.79 - KEEL, 5.7 - KEEL],
  [4.5, 1.92, 1.79 - KEEL, 5.8 - KEEL],
  [5, 1.965, 1.79 - KEEL, 5.87 - KEEL],
  [5.5, 1.975, 1.79 - KEEL, 5.9 - KEEL],
  [6, 1.975, 1.79 - KEEL, 5.93 - KEEL],
  [22, 1.975, 1.79 - KEEL, 5.93 - KEEL],
  [23, 1.975, 1.81 - KEEL, 5.93 - KEEL],
  [25, 1.975, 1.86 - KEEL, 5.93 - KEEL],
  [26, 1.975, 1.94 - KEEL, 5.93 - KEEL],
  [27, 1.93, 2.07 - KEEL, 5.93 - KEEL],
  [28, 1.85, 2.23 - KEEL, 5.93 - KEEL],
  [29, 1.74, 2.45 - KEEL, 5.93 - KEEL],
  [30, 1.6, 2.67 - KEEL, 5.93 - KEEL],
  [31, 1.46, 2.89 - KEEL, 5.93 - KEEL],
  [32, 1.29, 3.12 - KEEL, 5.93 - KEEL],
  [33, 1.09, 3.38 - KEEL, 5.92 - KEEL],
  [34, 0.92, 3.66 - KEEL, 5.86 - KEEL],
  [35, 0.76, 3.94 - KEEL, 5.72 - KEEL],
  [36, 0.6, 4.22 - KEEL, 5.57 - KEEL],
  [36.5, 0.49, 4.36 - KEEL, 5.5 - KEEL],
  [37, 0.33, 4.53 - KEEL, 5.43 - KEEL],
  [37.4, 0.15, 4.71 - KEEL, 5.33 - KEEL],
  [37.57, 0.03, 4.98 - KEEL, 5.15 - KEEL],
];
const wingH = (x) => 1.22 + 0.093 * (x - 2);
const tailH = (x) => 3 + 0.118 * (x - 2);
const fin = (y) => y - KEEL;

export const a320neo = {
  prefix: 'A20N',
  length: 37.57,
  width: 3.95,
  bodyHeight: 4.14,
  // D1 3.38 to 3.45 and D4 3.50 to 3.60 at MRW: 0.13 m over 24 m, 0.32 degrees nose down on the
  // mean CG. Barrel keel 1.78 m at the forward door, inside fuselage point F1 (1.72 to 1.82).
  stance: [0.0056, 5, 1.78],
  midFraction: 0.5,
  bellyAngle: 1.95,
  body,
  cockpit: {
    uStart: 1.33,
    uEnd: 3.3,
    centerPost: 1.92,
    low: [
      [1.2, 2.5],
      [1.33, 2.52],
      [1.7, 2.44],
      [2.1, 2.38],
      [2.6, 2.37],
      [3.3, 2.42],
      [3.7, 2.42],
    ],
    top: [
      [1.2, 3],
      [1.9, 3.05],
      [2.6, 3.08],
      [3.3, 3.08],
      [3.7, 3.08],
    ],
    // The pillar's upper end reaches the top edge outboard of the pilot. On this elliptical section
    // the side view's 1.84 lands near the centerline, across the forward view.
    posts: [
      [1.62, 2.3],
      [2.38, 2.45],
      [2.9, 2.9],
    ],
  },
  // AC 4-4-0: eye 2.41 m aft of the nose tip, 0.53 m off the centerline, 4.56 m high; 20 degrees
  // down, 30 up.
  eye: { u: 2.41, x: 0.53, h: 2.8, floor: 1.66, bulkhead: 5.2 },
  cabinWidth: 2,
  flightDeck: buildA320Cockpit,
  windows: {
    y: 2.81,
    w: 0.23,
    h: 0.33,
    pitch: 0.533,
    runs: [
      { from: 6.08, count: 2 },
      { from: 7.7, count: 12 },
      { from: 14.46, count: 1 },
      { from: 15.38, count: 1 },
      { from: 16, count: 10 },
      { from: 22.3, count: 11 },
    ],
  },
  doors: [
    { u0: 4.5, u1: 5.31, y0: 1.62, y1: 3.47, corner: 0.16 },
    { u0: 29.05, u1: 29.86, y0: 1.72, y1: 3.57, corner: 0.16 },
    { u0: 14.2, u1: 14.72, y0: 2.2, y1: 3.2 },
    { u0: 15.12, u1: 15.64, y0: 2.2, y1: 3.2 },
    { u0: 7.6, u1: 9.42, y0: 0.26, y1: 1.5, side: -1 },
    { u0: 24.4, u1: 26.2, y0: 0.32, y1: 1.56, side: -1 },
  ],
  seams: [1.2],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 17,
    rows: [
      [0.3, wingH(0.3), 11.2, 18.86, 0.4],
      [1.97, wingH(1.97), 12.1, 18.86, 0.37],
      [2.6, wingH(2.6), 13.2, 18.86, 0.34],
      [6.4, wingH(6.4), 15.1, 18.86, 0.25],
      [14, wingH(14), 19.07, 21.2, 0.115],
      [17, wingH(17), 20.76, 22.09, 0.08],
      [17.35, 2.91, 21.15, 22.2, 0.07],
      [17.55, 3.16, 21.5, 22.34, 0.06],
      [17.7, 3.51, 21.8, 22.5, 0.05],
      [17.8, 4.01, 22.1, 22.7, 0.04],
      [17.9, 4.91, 22.59, 22.97, 0.02],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 2.1, to: 6.3, chord: 0.27 },
      { kind: 'flap', name: 'outer', from: 6.5, to: 13.2, chord: 0.27 },
      { kind: 'aileron', from: 13.4, to: 16.6, chord: 0.22 },
    ],
    pods: [
      { x: 6.8, rows: canoe(17.8, 2.7) },
      { x: 9.8, rows: canoe(18.7, 2.7) },
      { x: 12.5, rows: canoe(19.6, 2.5) },
    ],
  },
  fin: {
    rows: [
      [3.3, 27.9, 35.2, 0.46],
      [fin(5.97), 28.6, 35.4, 0.44],
      [fin(6.3), 29.78, 35.46, 0.26],
      [fin(6.6), 30.31, 35.52, 0.2],
      [fin(7), 30.78, 35.62, 0.17],
      [fin(8), 31.64, 35.83, 0.15],
      [fin(10), 33.36, 36.28, 0.115],
      [fin(11), 34.22, 36.5, 0.09],
      [fin(11.6), 34.77, 36.63, 0.065],
      [fin(11.76), 35.35, 36.66, 0.03],
    ],
    rudder: { from: fin(6.1), to: fin(11.65), chord: 0.34 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 31.5, 35.3, 0.2],
      [1.1, tailH(1.1), 32.3, 35.5, 0.17],
      [5, tailH(5), 34.71, 36.3, 0.07],
      [5.9, tailH(5.9), 35.3, 36.55, 0.05],
      [6.225, tailH(6.225), 35.62, 36.68, 0.03],
    ],
    elevator: { from: 0.7, to: 5.85, chord: 0.33 },
  },
  fairings: [
    {
      name: 'belly-fairing',
      // BF1 is 1.60 to 1.72 m against the 1.79 m keel; the fairing is the A320's broad belly pod.
      rows: [
        [10.5, 1.2, 0.35, 1.3],
        [12, 1.75, 0.05, 1.55],
        [14, 2.15, -0.12, 1.7],
        [16, 2.35, -0.17, 1.75],
        [18, 2.35, -0.17, 1.75],
        [20, 2.2, -0.1, 1.7],
        [22, 1.7, 0.15, 1.45],
        [23.5, 0.9, 0.6, 1.1],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 5.75,
    u: 11.14,
    h: 0.04,
    // Clearance N1 is 0.46 to 0.56 m. The drawn pod is 2.78 m tall and wide, 3.8 m long.
    lip: [
      [0.5, 1, 1, 1],
      [0.14, 1, 1, 1],
      [0, 1.1, 1.1, 1.1],
      [0.08, 1.17, 1.17, 1.17],
      [0.22, 1.24, 1.24, 1.25],
    ],
    cowl: [
      [0.22, 1.24, 1.24, 1.25],
      [0.36, 1.27, 1.29, 1.3],
      [0.86, 1.355, 1.38, 1.4],
      [1.36, 1.385, 1.4, 1.4],
      [2.36, 1.35, 1.27, 1.38],
      [2.86, 1.285, 1.17, 1.33],
      [3.46, 1.2, 1.02, 1.2],
      [3.8, 1, 0.92, 1],
    ],
    duct: [
      [0.5, 1, 1, 1],
      [0.92, 1, 1, 1],
    ],
    fanAt: 0.85,
    fanRadius: 0.98,
    spinner: [0.3, 0.62],
    blades: 18,
    core: [
      [3.2, 0.78, -0.1],
      [3.86, 0.585, -0.145],
      [4.36, 0.44, -0.17],
      [4.7, 0.36, -0.17],
    ],
    plug: [
      [4.7, 0.2, -0.17],
      [5.05, 0.12, -0.17],
      [5.4, 0.012, -0.17],
    ],
    pylon: [
      [12.4, 0.03, 1.3, 1.42],
      [13.2, 0.1, 1.3, 1.6],
      [14.6, 0.17, 1.1, 1.62],
      [16, 0.16, 1, 1.62],
      [17.2, 0.1, 1.1, 1.58],
      [18, 0.03, 1.2, 1.48],
    ],
  },
  gear: {
    // 12.64 m wheelbase, 7.59 m track between leg centres, 0.93 and 0.50 m axle spreads.
    nose: { u: 5.07, r: 0.38, w: 0.22, spread: 0.5, top: 2.2, strut: 0.085 },
    main: {
      u: 17.71,
      x: 3.795,
      pivotX: 4.45,
      r: 0.585,
      w: 0.43,
      spread: 0.93,
      top: 3.2,
      strut: 0.12,
    },
  },
};
export const a320Frame = () => transportFrame(a320neo);
export const buildA320 = (s) => buildTransport(s, a320neo);

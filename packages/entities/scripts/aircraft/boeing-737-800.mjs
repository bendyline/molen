/** Boeing 737-800 with blended winglets (737-800W), CFM56-7B.
 * Traced from Boeing D6-58325-7 Rev C (October 2025), section 2.2.6 general dimensions, whose line
 * art is vector, so outlines are read numerically rather than from pixels. Page units are
 * calibrated on each axis separately: 39.47 m along the body and the 12.55 m height, which agree
 * with the 3.76 m width and the 4.01 m body depth to about 1 percent. The ground clearance tables
 * (2.3.3) and door drawings (2.7) override that drawing where they differ: see the stance note.
 */
import { build737Cockpit } from './boeing-737-800-cockpit.mjs';
import { buildTransport, canoe, transportFrame } from './transport-kit.mjs';

const body = [
  // u, half-breadth, keel, crown, height of maximum breadth as a fraction of the depth
  [0.02, 0.1, 1.45, 1.58, 0.5],
  [0.05, 0.13, 1.33, 1.69, 0.5],
  [0.1, 0.19, 1.21, 1.82, 0.5],
  [0.2, 0.29, 1.08, 1.94, 0.5],
  [0.3, 0.39, 0.98, 2.0, 0.5],
  [0.45, 0.47, 0.88, 2.12, 0.5],
  [0.6, 0.55, 0.8, 2.2, 0.5],
  [0.8, 0.64, 0.7, 2.3, 0.51],
  [1, 0.71, 0.59, 2.42, 0.51],
  [1.25, 0.79, 0.49, 2.53, 0.51],
  [1.5, 0.88, 0.39, 2.76, 0.52],
  [1.75, 0.96, 0.3, 2.96, 0.52],
  [2, 1.03, 0.22, 3.12, 0.52],
  [2.25, 1.1, 0.15, 3.24, 0.53],
  [2.5, 1.17, 0.09, 3.36, 0.53],
  [2.75, 1.24, 0.05, 3.45, 0.53],
  [3, 1.31, 0.02, 3.53],
  [3.25, 1.37, 0.01, 3.59],
  [3.5, 1.42, 0, 3.63],
  [3.75, 1.47, 0, 3.67],
  [4, 1.52, 0, 3.7],
  [4.5, 1.61, 0, 3.76],
  [5, 1.68, 0, 3.82],
  [5.5, 1.73, 0, 3.87],
  [6, 1.77, 0, 3.91],
  [6.5, 1.8, 0, 3.95],
  [7, 1.83, 0, 3.98],
  [8, 1.86, 0, 4.01],
  [9, 1.88, 0, 4.01],
  [24, 1.88, 0, 4.01],
  [26, 1.88, 0.01, 4.01],
  [27, 1.88, 0.07, 4.01],
  [28, 1.87, 0.17, 4.01],
  [29, 1.87, 0.29, 4.01],
  [30, 1.84, 0.43, 4],
  [31, 1.75, 0.6, 3.99],
  [32, 1.61, 0.8, 3.98],
  [33, 1.43, 1.03, 3.97],
  [34, 1.24, 1.29, 3.97],
  [35, 0.98, 1.57, 3.97],
  [36, 0.72, 1.88, 3.96],
  [36.5, 0.59, 2.05, 3.93],
  [37, 0.45, 2.22, 3.86],
  [37.5, 0.27, 2.4, 3.7],
  [37.8, 0.15, 2.52, 3.55],
  [38.02, 0.04, 2.7, 3.38],
];
const FIN_TOP = 10.92,
  CREST = 4.92;
// The drawing's fin stands 7.6 m above the crown; tables 2.3.3 leave 6.9 m, and the matched
// photographs agree with the tables. Fin heights are compressed onto the annotated figure.
const finH = (drawn) => 4.01 + ((drawn - CREST) * (FIN_TOP - 4.01)) / (12.55 - CREST);
const wingH = (x) => 0.97 + 0.0975 * (x - 1.9);
const tailH = (x) => 3.93 - (7.18 - x) * 0.144;

export const b737 = {
  prefix: 'B738',
  length: 39.47,
  width: 3.76,
  bodyHeight: 4.01,
  // Sills read 2.74 at the forward door and 3.12 at the aft door, with both cargo sills agreeing:
  // 0.38 m over the 26.4 m between doors, so the airplane stands 0.82 degrees nose down. The
  // figures are 72 percent of the way from MTW to OEW, the condition of the quoted 12.55 m height.
  stance: [0.0144, 5.4, 1.2],
  midFraction: 0.5325,
  bellyAngle: 1.95,
  body,
  cockpit: {
    // Drawing 2.7.1 and the photographs carry three panes aft to u 3.4; the small general
    // arrangement stops the outline at 2.94.
    uStart: 1.37,
    uEnd: 3.4,
    centerPost: 1.75,
    // Drawing 2.2.6 puts the front pane's lower corner at h 2.36, well under the crown: the sill
    // crosses the nose, which is what gives the published 15 degrees over it.
    low: [
      [1.2, 2.36],
      [1.37, 2.38],
      [1.9, 2.3],
      [2.25, 2.24],
      [2.85, 2.3],
      [3.4, 2.56],
      [3.8, 2.6],
    ],
    top: [
      [1.2, 2.92],
      [1.82, 2.94],
      [2.32, 2.98],
      [2.85, 2.98],
      [3.4, 2.9],
      [3.8, 2.88],
    ],
    arcs: [[1.37, 2.38]],
    posts: [
      [1.84, 2.02],
      [2.3, 2.42],
      [2.85, 2.92],
    ],
  },
  // Figure 4.4: eye 2.49 m aft of the nose tip and 0.51 m off the centerline; 15 degrees down and
  // 18 up through the main window. The 3.74 m eye height, over the drawing's 0.88 m keel, puts it
  // 1.3 m above the floor; 1.21 m here, because the model keeps the higher stance of tables 2.3.3.
  eye: { u: 2.49, x: 0.51, h: 2.76, floor: 1.55, bulkhead: 5.35 },
  cabinWidth: 1.84,
  flightDeck: build737Cockpit,
  windows: {
    y: 2.58,
    w: 0.23,
    h: 0.33,
    pitch: 0.508,
    runs: [
      { from: 6.42, count: 19 },
      { from: 16.71, count: 1 },
      { from: 17.83, count: 1 },
      { from: 18.63, count: 25 },
    ],
  },
  doors: [
    { u0: 5.03, u1: 5.89, y0: 1.52, y1: 3.35, corner: 0.16 },
    { u0: 31.5, u1: 32.26, y0: 1.52, y1: 3.35, corner: 0.16 },
    { u0: 16.46, u1: 16.96, y0: 2.04, y1: 3.0 },
    { u0: 17.58, u1: 18.08, y0: 2.04, y1: 3.0 },
    { u0: 7.98, u1: 9.2, y0: 0.17, y1: 1.3, side: -1 },
    { u0: 27.6, u1: 28.8, y0: 0.42, y1: 1.52, side: -1 },
  ],
  seams: [0.98],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 16.5,
    rows: [
      // x, h, u leading edge, u trailing edge, half thickness
      [0.3, wingH(0.3), 13.7, 21.4, 0.36],
      [1.94, wingH(1.94), 14.9, 21.4, 0.33],
      [3.3, wingH(3.3), 16, 21.4, 0.3],
      [5.6, wingH(5.6), 17.64, 21.42, 0.26],
      [16.5, 2.42, 23.25, 24.62, 0.085],
      [16.8, 2.59, 23.4, 24.75, 0.08],
      [17, 2.84, 23.55, 24.85, 0.075],
      [17.3, 3.69, 24.1, 25.05, 0.065],
      [17.6, 4.59, 24.9, 25.5, 0.05],
      [17.895, 5.28, 25.62, 26.1, 0.025],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 2.1, to: 5.55, chord: 0.3 },
      { kind: 'flap', name: 'outer', from: 5.7, to: 10.8, chord: 0.3 },
      { kind: 'aileron', from: 11, to: 15.6, chord: 0.24 },
    ],
    pods: [
      { x: 6.6, rows: canoe(20.2, 2.8) },
      { x: 9.8, rows: canoe(21.1, 2.8) },
      { x: 12.7, rows: canoe(22.2, 2.2) },
    ],
  },
  fin: {
    rows: [
      [3.2, 28.4, 36.9, 0.44],
      [finH(CREST), 28.75, 36.92, 0.42],
      [finH(5.5), 30.3, 37.1, 0.21],
      [finH(6), 31.6, 37.2, 0.17],
      [finH(6.4), 32.7, 37.33, 0.16],
      [finH(7), 33.2, 37.42, 0.15],
      [finH(8), 33.92, 37.62, 0.135],
      [finH(10), 35.39, 38.02, 0.105],
      [finH(12), 36.86, 38.43, 0.075],
      [finH(12.35), 37.2, 38.5, 0.06],
      [FIN_TOP, 37.6, 38.52, 0.04],
    ],
    rudder: { from: finH(5.1), to: finH(12.25), chord: 0.31 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 32.9, 37.16, 0.2],
      [1.82, tailH(1.82), 34, 37.65, 0.17],
      [6.75, tailH(6.75), 37.57, 39.24, 0.06],
      [7.175, tailH(7.175), 38.3, 39.47, 0.03],
    ],
    elevator: { from: 0.7, to: 6.85, chord: 0.33 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [12.5, 1.5, 0.12, 1.2],
        [14, 1.85, 0.02, 1.35],
        [16, 2.02, -0.03, 1.45],
        [19, 2.1, -0.05, 1.5],
        [21.5, 2.02, -0.02, 1.45],
        [23.5, 1.6, 0.2, 1.3],
        [25, 0.8, 0.6, 1],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 4.83,
    u: 13.36,
    h: 0.32,
    // Table 2.3.3 gives 0.595 m under the nacelle at this condition; the flat lower lobe follows
    // the front view, where the pod is 2.3 m wide and 2 m tall.
    lowerPower: 2.4,
    lip: [
      [0.45, 0.76, 0.72, 0.72],
      [0.12, 0.77, 0.73, 0.74],
      [0, 0.85, 0.79, 0.8],
      [0.06, 0.96, 0.86, 0.89],
      [0.22, 1.03, 0.9, 0.95],
    ],
    cowl: [
      [0.22, 1.03, 0.9, 0.95],
      [0.4, 1.07, 0.92, 0.98],
      [0.64, 1.11, 0.95, 1.02],
      [1.14, 1.15, 0.96, 1.05],
      [1.64, 1.17, 0.96, 1.07],
      [2.14, 1.16, 0.95, 1.04],
      [2.64, 1.1, 0.9, 0.97],
      [2.95, 1, 0.82, 0.88],
    ],
    duct: [
      [0.45, 0.76, 0.72, 0.72],
      [0.72, 0.76, 0.72, 0.72],
    ],
    fanAt: 0.66,
    fanRadius: 0.74,
    spinner: [0.25, 0.55],
    core: [
      [2.4, 0.72, -0.08],
      [2.95, 0.62, -0.1],
      [3.6, 0.48, -0.12],
      [3.95, 0.4, -0.12],
    ],
    plug: [
      [3.95, 0.22, -0.12],
      [4.3, 0.14, -0.12],
      [4.65, 0.012, -0.12],
    ],
    pylon: [
      [14.2, 0.03, 1.12, 1.2],
      [15, 0.1, 1.1, 1.4],
      [16.2, 0.15, 1, 1.42],
      [17.4, 0.16, 1, 1.38],
      [18.4, 0.13, 1, 1.25],
      [19.6, 0.03, 1.05, 1.12],
    ],
  },
  gear: {
    // 15.60 m wheelbase, 5.72 m track, 13 ft 5 in nose to nose gear. Tyres H44.5x16.5-21, 27x7.75R15.
    nose: { u: 4.09, r: 0.345, w: 0.2, spread: 0.42, top: 1.42, strut: 0.075 },
    main: {
      u: 19.69,
      x: 2.86,
      pivotX: 3.45,
      r: 0.555,
      w: 0.42,
      spread: 0.86,
      top: 2.3,
      strut: 0.11,
    },
  },
};
export const b737Frame = () => transportFrame(b737);
export const buildB737 = (s) => buildTransport(s, b737);

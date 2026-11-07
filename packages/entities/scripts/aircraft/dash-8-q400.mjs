/** De Havilland Canada Dash 8-400, PW150A, Dowty R408. No dimensioned drawing was found: the
 * manufacturer's spec sheet carries overall figures only (32.83 by 28.42 by 8.34 m). Wheelbase
 * 13.94 m, track 8.80 m and the 4.12 m propeller come from an operator's aeroplane-general notes.
 * Stations are read from photographs G-ECOG (ground, oblique) and C-GLQK (underside, for the
 * planform), with depth and clearance scaled from the 2.69 m body and 63.1 m2 wing area.
 * Treat this as a reconstruction, not a measured three-view.
 */
import { buildTransport, transportFrame } from './transport-kit.mjs';

const body = [
  [0.02, 0.08, 0.62, 0.74, 0.5],
  [0.1, 0.2, 0.5, 0.86, 0.5],
  [0.3, 0.36, 0.38, 1.02, 0.5],
  [0.6, 0.5, 0.27, 1.2, 0.5],
  [1, 0.66, 0.17, 1.42, 0.5],
  [1.5, 0.82, 0.09, 1.66, 0.5],
  [2, 0.98, 0.04, 1.9, 0.5],
  [2.5, 1.1, 0.01, 2.16, 0.5],
  [3, 1.2, 0, 2.36],
  [3.5, 1.27, 0, 2.5],
  [4, 1.31, 0, 2.6],
  [5, 1.345, 0, 2.69],
  [21, 1.345, 0, 2.69],
  [22, 1.34, 0.1, 2.69],
  [23, 1.3, 0.25, 2.69],
  [24, 1.24, 0.44, 2.69],
  [25, 1.16, 0.66, 2.69],
  [26, 1.06, 0.9, 2.69],
  [27, 0.94, 1.14, 2.68],
  [28, 0.8, 1.4, 2.66],
  [29, 0.64, 1.66, 2.6],
  [30, 0.44, 1.92, 2.5],
  [30.8, 0.12, 2.12, 2.4],
];

export const q400 = {
  prefix: 'DH8D',
  length: 32.83,
  width: 2.69,
  bodyHeight: 2.69,
  // The oblique photograph shows the type's slight nose-down sit; 0.5 degrees is an estimate.
  stance: [0.0087, 12, 1.1],
  midFraction: 0.5,
  bellyAngle: 2.05,
  body,
  cockpit: {
    uStart: 1.72,
    uEnd: 3.4,
    centerPost: 2.57,
    low: [
      [1.6, 1.72],
      [2, 1.68],
      [2.6, 1.67],
      [3.4, 1.7],
      [3.9, 1.72],
    ],
    top: [
      [1.6, 2.19],
      [3.9, 2.19],
    ],
    arcs: [[1.72, 1.71]],
    // G-ECOG shows two panes a side.
    posts: [[2.9, 2.9]],
  },
  // No published eye position. The pilot shows in the forward part of the side pane in G-ECOG.
  eye: { u: 3.15, x: 0.46, h: 2.02, floor: 0.92, bulkhead: 5.8 },
  cabinWidth: 1.7,
  windows: {
    y: 1.55,
    w: 0.26,
    h: 0.34,
    pitch: 0.76,
    runs: [
      { from: 6.3, count: 12 },
      { from: 16.3, count: 11 },
    ],
  },
  doors: [
    { u0: 4.5, u1: 5.3, y0: 0.72, y1: 2.42, corner: 0.15 },
    { u0: 25.3, u1: 26.1, y0: 0.9, y1: 2.45, corner: 0.15 },
  ],
  seams: [0.85],
  wing: {
    rows: [
      [0.3, 2.76, 13.3, 16.4, 0.27],
      [1.3, 2.79, 13.3, 16.4, 0.27],
      [4.6, 2.87, 13.3, 16.4, 0.26],
      [14, 3.2, 15.1, 16.3, 0.08],
      [14.21, 3.2, 15.5, 16.25, 0.03],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 1.5, to: 3.75, chord: 0.3 },
      { kind: 'flap', name: 'outer', from: 5.25, to: 9.6, chord: 0.3 },
      { kind: 'aileron', from: 9.8, to: 13.2, chord: 0.28 },
    ],
  },
  fin: {
    rows: [
      [2.2, 23.6, 30.4, 0.3],
      [2.69, 24.4, 30.6, 0.26],
      [3.2, 26.2, 30.9, 0.2],
      [3.6, 26.9, 31.05, 0.17],
      [5, 28, 31.5, 0.14],
      [6.6, 29.3, 32.1, 0.1],
      [6.98, 29.7, 32.3, 0.06],
    ],
    rudder: { from: 3.1, to: 6.6, chord: 0.33 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [29.2, 0.02, 6.92, 6.96],
          [29.8, 0.2, 6.82, 7.1],
          [31, 0.2, 6.82, 7.12],
          [32.3, 0.02, 6.95, 6.98],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.1, 6.95, 29.6, 31.7, 0.13],
      [0.6, 6.97, 29.9, 31.85, 0.12],
      [4.2, 7.1, 31.6, 32.6, 0.05],
      [4.4, 7.1, 31.85, 32.83, 0.03],
    ],
    elevator: { from: 0.6, to: 4.1, chord: 0.35 },
  },
  fairings: [
    {
      name: 'wing-root-fairing',
      material: 'paint',
      rows: [
        [11.8, 0.7, 2.6, 2.75],
        [13, 1, 2.4, 3.05],
        [15, 1, 2.4, 3.07],
        [17, 0.6, 2.5, 2.92],
        [18.5, 0.1, 2.62, 2.72],
      ],
    },
  ],
  engine: {
    kind: 'turboprop',
    // On the main gear track: the legs retract into these nacelles (8.80 m track, see the review).
    x: 4.4,
    u: 10.8,
    h: 2.02,
    // The nacelle runs well behind the trailing edge, holding the gear bay: it stays full to
    // du 7.7, round the stowed wheels, before its short tail cone. Depth and length as reviewed.
    cowl: [
      [0, 0.4, 0.4, 0.42],
      [0.6, 0.52, 0.56, 0.62],
      [1.6, 0.58, 0.64, 0.74],
      [3, 0.6, 0.68, 0.8],
      [5, 0.6, 0.66, 0.8],
      [6.4, 0.6, 0.63, 0.66],
      [7.7, 0.58, 0.6, 0.62],
      [8.4, 0.34, 0.36, 0.38],
      [8.9, 0.03, 0.03, 0.03],
    ],
    propAt: 0.02,
    spinner: [0.42, 0.85],
    radius: 2.06,
    blades: 6,
    bladeChord: 1.15,
  },
  gear: {
    nose: { u: 2.36, r: 0.3, w: 0.18, spread: 0.36, top: 1.3, strut: 0.075 },
    // The legs hang from the nacelles, raked from a pivot ahead of the axle, and retract aft into
    // the nacelle bay: the stowed wheels sit on the nacelle axis. Twin 34 x 10.75-16 tyres.
    main: {
      u: 16.3,
      x: 4.4,
      pivotX: 4.4,
      r: 0.43,
      w: 0.27,
      spread: 0.5,
      top: 2.62,
      hinge: 0.55,
      strut: 0.11,
      axis: 'x',
      retract: -Math.PI / 2,
    },
  },
};
export const q400Frame = () => transportFrame(q400);
export const buildQ400 = (s) => buildTransport(s, q400);

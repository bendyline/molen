/** Cessna Citation CJ4 (525C), FJ44-4A. No dimensioned drawing was found: stations are read from
 * photograph D-CEFE, a three-quarter view from the ground at about 100 px/m near mid-body, with
 * its perspective slope removed along the keel. Overall length, span and height are published, as
 * are 30.66 m2 wing area and 12.5 degrees of sweep; the wheelbase and tread come from a dealer
 * listing. Treat this as a reconstruction, not a measured three-view.
 */
import { buildTransport, transportFrame } from './transport-kit.mjs';

const body = [
  [0.02, 0.07, 0.42, 0.53, 0.5],
  [0.05, 0.11, 0.37, 0.58, 0.5],
  [0.2, 0.18, 0.3, 0.68, 0.5],
  [0.55, 0.33, 0.16, 0.86, 0.5],
  [1.15, 0.47, 0.09, 1.04, 0.5],
  [1.75, 0.57, 0.04, 1.2, 0.5],
  [2.25, 0.66, 0.01, 1.41, 0.5],
  [2.55, 0.71, 0, 1.6, 0.5],
  [3, 0.76, 0, 1.72],
  [3.5, 0.8, 0, 1.75],
  [4, 0.81, 0, 1.75],
  [8.5, 0.81, 0, 1.75],
  [9.5, 0.79, 0.08, 1.75],
  [10.5, 0.72, 0.2, 1.74],
  [11.5, 0.61, 0.38, 1.7],
  [12.5, 0.46, 0.8, 1.6],
  [13.3, 0.12, 1.28, 1.5],
];
const wingH = (x) => 0.15 + 0.07 * (x - 0.81);
const fin = (photo) => photo * 1.06;

export const cj4 = {
  prefix: 'C25C',
  length: 16.26,
  width: 1.62,
  bodyHeight: 1.75,
  compactDeck: true,
  stance: [0, 8, 0.65],
  midFraction: 0.5,
  bellyAngle: 2.05,
  bellyColor: '#cfd1cf',
  body,
  cockpit: {
    uStart: 1.8,
    uEnd: 3.4,
    centerPost: 2.53,
    low: [
      [1.7, 1.2],
      [2, 1.16],
      [2.4, 1.12],
      [2.9, 1.1],
      [3.4, 1.12],
      [3.8, 1.12],
    ],
    // D-CEFE: the window top stands about 0.17 m under the crown, not a bubble over the head.
    top: [
      [1.7, 1.58],
      [3.8, 1.58],
    ],
    arcs: [[1.8, 1.19]],
    posts: [[2.95, 2.95]],
  },
  // No published eye position. The pilot's head shows in the side pane in D-CEFE, about u 3.
  eye: { u: 3, x: 0.3, h: 1.42, floor: 0.42, bulkhead: 5.2 },
  cabinWidth: 1.02,
  windows: {
    y: 1.18,
    w: 0.26,
    h: 0.37,
    corner: 0.6,
    pitch: 0.5,
    runs: [
      { from: 4.42, count: 1 },
      { from: 5.33, count: 5 },
    ],
  },
  doors: [
    { u0: 3.42, u1: 4.05, y0: 0.32, y1: 1.5, corner: 0.14, side: 1 },
    { u0: 7.93, u1: 8.4, y0: 0.74, y1: 1.46, corner: 0.1 },
  ],
  seams: [0.9],
  wing: {
    rows: [
      [0.2, wingH(0.2), 5.85, 8.85, 0.2],
      [0.81, wingH(0.81), 6, 8.85, 0.19],
      [2.6, wingH(2.6), 6.5, 8.85, 0.15],
      [7.4, wingH(7.4), 7.85, 8.95, 0.055],
      [7.6, 0.68, 8.1, 9, 0.045],
      [7.745, 0.84, 8.45, 9.1, 0.02],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 0.95, to: 4.6, chord: 0.27 },
      { kind: 'aileron', from: 4.8, to: 7, chord: 0.27 },
    ],
  },
  fin: {
    rows: [
      [1.4, 10.4, 13.1, 0.16],
      [fin(1.72), 10.85, 13.25, 0.15],
      [fin(2.82), 12.1, 13.9, 0.1],
      [fin(3.3), 12.65, 14.25, 0.085],
      [fin(3.75), 13.1, 14.5, 0.05],
    ],
    rudder: { from: fin(1.85), to: fin(3.4), chord: 0.3 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [13, 0.02, 3.85, 3.9],
          [13.5, 0.12, 3.78, 3.98],
          [14.4, 0.12, 3.78, 4],
          [15.1, 0.02, 3.85, 3.88],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.1, 3.8, 13, 14.7, 0.09],
      [0.4, 3.82, 13.3, 14.75, 0.085],
      [2.9, 3.95, 15.3, 16, 0.035],
      [3.1, 3.97, 15.7, 16.26, 0.02],
    ],
    elevator: { from: 0.4, to: 2.85, chord: 0.33 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [5.4, 0.6, 0.1, 0.6],
        [6.4, 0.85, -0.07, 0.7],
        [8, 0.9, -0.07, 0.7],
        [9.2, 0.6, 0.1, 0.6],
        [9.9, 0.2, 0.3, 0.5],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 1.5,
    u: 9,
    h: 1.3,
    lip: [
      [0.25, 0.36, 0.36, 0.36],
      [0.06, 0.37, 0.37, 0.37],
      [0, 0.41, 0.41, 0.41],
      [0.04, 0.45, 0.45, 0.45],
      [0.12, 0.48, 0.48, 0.48],
    ],
    cowl: [
      [0.12, 0.48, 0.48, 0.48],
      [0.5, 0.52, 0.52, 0.52],
      [1.1, 0.52, 0.52, 0.52],
      [1.7, 0.46, 0.46, 0.46],
      [2.2, 0.34, 0.34, 0.34],
      [2.6, 0.24, 0.24, 0.24],
    ],
    duct: [
      [0.25, 0.36, 0.36, 0.36],
      [0.45, 0.36, 0.36, 0.36],
    ],
    fanAt: 0.42,
    fanRadius: 0.35,
    spinner: [0.12, 0.25],
    core: [
      [2.3, 0.2, 0],
      [2.58, 0.18, 0],
    ],
    plug: [
      [2.58, 0.12, 0],
      [2.8, 0.01, 0],
    ],
    pylonMaterial: 'paint',
    pylon: [
      [9.9, 0.02, 1.25, 1.3, -0.35],
      [10.3, 0.34, 1.16, 1.44, -0.35],
      [11, 0.36, 1.16, 1.44, -0.35],
      [11.4, 0.02, 1.25, 1.3, -0.35],
    ],
  },
  gear: {
    // Wheelbase 6.45 m and tread 3.76 m from a dealer listing; single wheels per the photograph.
    nose: { u: 1.5, r: 0.2, w: 0.13, top: 0.8, strut: 0.05 },
    main: { u: 7.95, x: 1.88, pivotX: 2.15, r: 0.29, w: 0.17, top: 0.95, strut: 0.065 },
  },
};
export const cj4Frame = () => transportFrame(cj4);
export const buildCJ4 = (s) => buildTransport(s, cj4);

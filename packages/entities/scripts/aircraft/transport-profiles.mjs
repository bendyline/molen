/** Transport outlines in metres. Nose stations are [distance aft of tip, half-width,
 * bottom, top]. Published overall dimensions and manufacturer three-views constrain
 * the envelopes; individual window outlines are reconstructed from the cited photos
 * in source/aircraft-shape-review-2026-10-28.json, not an interchangeable glass band.
 */
import { detailKit, group, loft, quad, T } from './mesh-kit.mjs';

// The Bendy airliner keeps this generic six-pane layout (its flight deck sits further aft).
export const narrowbodyWindows = [
  [
    [1.5, 1.7],
    [55, 2.7],
    [44, 3.25],
    [1.5, 2.4],
  ],
  [
    [58, 2.82],
    [71, 3.9],
    [52, 4.0],
    [48, 3.33],
  ],
  [
    [73, 4.03],
    [71, 4.45],
    [65, 4.78],
    [56, 4.62],
    [55, 4.15],
  ],
];
export const transportProfiles = {
  'airbus-a320neo': {
    cy: 3.85,
    ry: 2.03,
    radius: 1.975,
    // Eye, rounded ogive radome and the six-pane deck from the Eurowings D-AENC nose-detail
    // broadside (CC BY 2.0), heights from the nose-wheel hub; plan widths from the Scavini
    // three-view. The panes end 3.3 m aft of the tip, a door width ahead of door 1.
    eye: [0.57, 4.47, 2.88],
    cabinWidth: 2.7,
    smoothNose: true,
    nose: [
      [0, 0.012, 3.13, 3.16],
      [0.03, 0.14, 3.0, 3.29],
      [0.1, 0.26, 2.88, 3.39],
      [0.2, 0.37, 2.76, 3.49],
      [0.3, 0.45, 2.68, 3.57],
      [0.5, 0.59, 2.56, 3.7],
      [0.75, 0.75, 2.43, 3.83],
      [1, 0.92, 2.35, 3.94],
      [1.25, 1.08, 2.27, 4.06],
      [1.5, 1.24, 2.21, 4.31],
      [2, 1.52, 2.12, 4.81],
      [2.5, 1.68, 2.04, 5.02],
      [3, 1.8, 1.97, 5.24],
      [3.5, 1.89, 1.92, 5.4],
      [4, 1.94, 1.88, 5.55],
      [4.6, 1.965, 1.84, 5.68],
      [5.5, 1.975, 1.82, 5.8],
      [6.5, 1.975, 1.82, 5.86],
      [7.5, 1.975, 1.82, 5.88],
    ],
    // Two windscreens either side of a broad centre post, the sliding window and the
    // rounded aft window, all on one level sill (null = on the skin).
    glazing: [
      [
        [0.055, null, 1.45],
        [null, 4.24, 2.0],
        [null, 4.74, 2.24],
        [0.055, null, 1.89],
      ],
      [
        [null, 4.19, 2.09],
        [null, 4.19, 2.665],
        [null, 4.72, 2.665],
        [null, 4.72, 2.35],
      ],
      [
        [null, 4.19, 2.8],
        [null, 4.19, 3.18],
        [null, 4.26, 3.26],
        [null, 4.67, 3.26],
        [null, 4.74, 3.18],
        [null, 4.74, 2.8],
      ],
    ],
    cabin: {
      count: 39,
      front: 6.4,
      back: 29.5,
      halfWidth: 0.145,
      halfHeight: 0.205,
      rounding: 0.07,
    },
    // Planform, tail and gear stations: Airbus A320 three-view (J. Scavini, CC BY-SA 3.0)
    // corrected to the published 12.64 m wheelbase / 7.59 m track; neo nacelle from photos.
    engine: {
      radius: 1.25,
      length: 3.6,
      x: 5.75,
      y: 1.85,
      z: 6.0,
      pylon: [
        [0.6, 1.0],
        [0.0, 1.38],
        [-2.2, 1.38],
        [-3.8, 0.9],
        [-3.8, 0.4],
        [-1.5, 0.4],
      ],
      pylonWidth: 0.15,
    },
    wing: {
      y: 2.67,
      z: 3.125,
      span: 15.12,
      sweep: 8.19,
      root: 6.35,
      tip: 1.5,
      dihedral: 0.087,
      kink: [0.3235, 3.7],
      thickness: 0.12,
      // Flap-track fairings (span fractions), as seen from below on A320neo photos.
      tracks: [0.2, 0.38, 0.55, 0.71],
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [7.8, -3.6, 0.3, 1.46],
    // Sharklet: a tight 0.55 m root fillet into a tall, nearly upright swept blade.
    winglet: { height: 2.43, out: 0.805, root: 1.4, tip: 0.43, sweep: 1.35, radius: 0.55 },
    tail: {
      z: -13.68,
      base: 5.6,
      height: 6.16,
      root: 5.48,
      tip: 1.98,
      sweep: 5.05,
      span: 6.225,
      hZ: -14.53,
      hY: 4.6,
      hRoot: 3.84,
      hTip: 1.25,
      hSweep: 4.09,
      hDihedral: 0.105,
    },
    aft: [
      [0.66, 1, 0],
      [0.7, 0.94, 0.12],
      [0.75, 0.88, 0.24],
      [0.79, 0.8, 0.39],
      [0.84, 0.69, 0.59],
      [0.88, 0.57, 0.79],
      [0.92, 0.43, 0.98],
      [0.97, 0.27, 1.16],
      [1, 0.13, 1.25],
    ],
    gear: {
      nose: 13.73,
      main: 1.09,
      track: 3.795,
      r: [0.381, 0.584],
      top: [2.3, 2.75],
      strut: [0.08, 0.13],
      spread: [0.62, 0.79],
    },
  },
  'a220-300': {
    cy: 3.56,
    ry: 1.85,
    radius: 1.75,
    // Eye, blunt bulbous radome and panes from the Air France F-HZUT nose-detail broadside
    // (CC BY 2.0), heights from the nose-wheel hub: a broad round tip with a full chin, and a
    // low flight deck whose side window ends 3.2 m aft of the tip, well ahead of door 1.
    eye: [0.57, 3.92, 2.97],
    cabinWidth: 2.55,
    smoothNose: true,
    nose: [
      [0, 0.012, 2.64, 2.66],
      [0.03, 0.15, 2.5, 2.77],
      [0.1, 0.27, 2.38, 2.89],
      [0.2, 0.38, 2.28, 3.01],
      [0.3, 0.47, 2.21, 3.1],
      [0.5, 0.6, 2.12, 3.24],
      [0.8, 0.78, 2.03, 3.42],
      [1, 0.9, 1.98, 3.55],
      [1.25, 1.04, 1.94, 3.7],
      [1.5, 1.15, 1.9, 3.87],
      [2, 1.33, 1.85, 4.25],
      [2.5, 1.46, 1.8, 4.5],
      [3, 1.56, 1.77, 4.7],
      [3.5, 1.63, 1.75, 4.86],
      [4, 1.68, 1.73, 5.0],
      [4.65, 1.725, 1.715, 5.15],
      [5.5, 1.745, 1.71, 5.3],
      [6.5, 1.75, 1.71, 5.38],
      [7.5, 1.75, 1.71, 5.41],
    ],
    // Pane corners: [half-width, height, distance aft of tip]; null = on the skin. Two
    // windscreens and one large side window each side with a raked front edge.
    glazing: [
      [
        [0.05, null, 1.28],
        [null, 3.79, 2.11],
        [null, 4.31, 2.47],
        [0.05, null, 2.0],
      ],
      [
        [null, 3.8, 2.2],
        [null, 3.81, 3.12],
        [null, 3.88, 3.27],
        [null, 4.2, 3.29],
        [null, 4.28, 3.2],
        [null, 4.31, 2.62],
      ],
    ],
    cabin: { count: 38, front: 6.6, back: 30.7, halfWidth: 0.17, halfHeight: 0.23, rounding: 0.08 },
    // Stations: Bombardier CS100/CS300 manufacturer three-view (public domain; CS300 side,
    // shared wing from the CS100 plan) and a SWISS A220-300 landing-roll photo for gear.
    engine: {
      // PW1500G: the long fan cowl reaches 3.8 m (inlet station unchanged).
      radius: 1.12,
      length: 3.8,
      x: 5.55,
      y: 1.72,
      z: 5.25,
      pylon: [
        [0.8, 0.85],
        [0.2, 1.22],
        [-1.8, 1.22],
        [-3.6, 0.9],
        [-3.6, 0.4],
        [-1.4, 0.4],
      ],
      pylonWidth: 0.14,
    },
    wing: {
      y: 2.48,
      z: 2.85,
      span: 15.25,
      sweep: 8.6,
      root: 6.2,
      tip: 1.5,
      // 7.4 deg: the CS300 three-view front and A220 approach photos show the tips well up.
      dihedral: 0.13,
      kink: [0.283, 4.2],
      thickness: 0.12,
      tracks: [0.22, 0.4, 0.57, 0.73],
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [7.2, -3.2, 0.28, 1.27],
    // Canted winglet, broad at the root (full tip chord) with a 0.4 m root bend.
    winglet: { height: 1.55, out: 0.55, root: 1.5, tip: 0.42, sweep: 1.5, radius: 0.4 },
    tail: {
      z: -14.5,
      base: 5.0,
      height: 6.5,
      root: 5.81,
      tip: 1.66,
      sweep: 5.14,
      // Long, low dorsal fillet from the crown into the fin leading edge (HB-JCS side photo).
      dorsal: [-11.3, 1.25, 3.6, 0.4, 2.65],
      span: 5.8,
      hZ: -15.13,
      hY: 4.35,
      hRoot: 4.3,
      hTip: 1.2,
      hSweep: 3.59,
      hDihedral: 0.08,
    },
    aft: [
      [0.6, 1, 0],
      [0.68, 0.93, 0.12],
      [0.739, 0.808, 0.355],
      [0.85, 0.568, 0.77, 0.62],
      [0.923, 0.384, 1.0, 0.43],
      [1, 0.17, 1.07, 0.12],
    ],
    gear: {
      nose: 16.06,
      main: 0.99,
      track: 3.35,
      r: [0.36, 0.57],
      top: [2.0, 2.6],
      strut: [0.07, 0.12],
      spread: [0.7, 0.75],
    },
  },
  'boeing-737-800': {
    cy: 3.3,
    ry: 1.92,
    radius: 1.88,
    // Eye, nose and panes from the Jet2 G-JZHG nose-detail broadside (CC BY 2.0), heights
    // from the nose-wheel hub; plan widths measured on the Scavini three-view top view, where
    // the long, slim 737 nose only reaches full width about 8 m aft of the tip. The flight
    // deck sits low in it, its panes ending 3.5 m aft of the tip.
    eye: [0.57, 3.82, 3.08],
    cabinWidth: 2.65,
    smoothNose: true,
    nose: [
      [0, 0.012, 2.69, 2.72],
      [0.03, 0.12, 2.59, 2.79],
      [0.1, 0.21, 2.47, 2.86],
      [0.2, 0.3, 2.36, 2.96],
      [0.3, 0.37, 2.27, 3.05],
      [0.5, 0.48, 2.16, 3.2],
      [0.75, 0.6, 2.04, 3.335],
      [1, 0.71, 1.95, 3.455],
      [1.25, 0.81, 1.87, 3.56],
      [1.5, 0.9, 1.8, 3.68],
      [1.75, 0.98, 1.75, 3.98],
      [2, 1.06, 1.7, 4.24],
      [2.5, 1.2, 1.59, 4.51],
      [3, 1.31, 1.5, 4.7],
      [3.5, 1.41, 1.43, 4.84],
      [4, 1.5, 1.39, 4.97],
      [4.5, 1.58, 1.38, 5.08],
      [5.25, 1.68, 1.38, 5.18],
      [6, 1.76, 1.38, 5.22],
      [7, 1.83, 1.38, 5.22],
      [8.5, 1.88, 1.38, 5.22],
    ],
    // Pane corners: [half-width, height, distance aft of tip]; null = on the skin.
    glazing: [
      [
        [0.038, null, 1.53],
        [null, 3.66, 2.24],
        [null, 3.97, 2.43],
        [0.038, null, 1.76],
      ],
      [
        [null, 3.63, 2.3],
        [null, 3.51, 2.82],
        [null, 3.96, 2.93],
        [null, 3.96, 2.53],
      ],
      [
        [null, 3.54, 2.93],
        [null, 3.69, 3.51],
        [null, 3.95, 3.54],
        [null, 3.99, 3.0],
      ],
    ],
    cabin: {
      count: 41,
      front: 6.8,
      back: 31.3,
      halfWidth: 0.145,
      halfHeight: 0.205,
      rounding: 0.06,
    },
    // Planform, tail, nacelle and gear stations: Boeing 737-800 three-view (J. Scavini,
    // CC BY-SA 3.0) scaled nose-to-APU, checked against the published 15.60 m wheelbase,
    // 5.72 m track and 12.55 m height. The fin tip and stabiliser overhang the APU.
    engine: {
      radius: 1.05,
      length: 3.59,
      x: 4.84,
      y: 1.45,
      z: 4.24,
      // CFM56-7 flat-bottomed inlet: keel at 0.8 x radius below the axis.
      flatten: 0.8,
      pylon: [
        [1.0, 0.85],
        [0.3, 1.12],
        [-0.6, 1.35],
        [-2.6, 1.0],
        [-2.6, 0.3],
        [-0.5, 0.3],
      ],
      pylonWidth: 0.15,
    },
    wing: {
      y: 2.7,
      z: 1.89,
      span: 15.3,
      sweep: 8.58,
      root: 7.22,
      tip: 1.5,
      dihedral: 0.105,
      kink: [0.228, 5.3],
      thickness: 0.12,
      tracks: [0.2, 0.37, 0.54, 0.7],
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [6.8, -4.6, 0.25, 1.36],
    winglet: { height: 2.5, out: 0.72, root: 1.35, tip: 0.4, sweep: 1.25 },
    tail: {
      z: -15.71,
      base: 5.2,
      height: 7.35,
      root: 6.62,
      tip: 1.77,
      sweep: 6.62,
      dorsal: [-10.75, 2.0, 4.5, 0.6, 5.69],
      span: 7.18,
      hZ: -17.185,
      hY: 4.8,
      hRoot: 3.79,
      hTip: 1.16,
      hSweep: 4.08,
      hDihedral: 0.123,
    },
    aft: [
      [0.62, 1, 0],
      [0.704, 0.932, 0.15],
      [0.787, 0.794, 0.425],
      [0.87, 0.575, 0.855],
      [0.953, 0.297, 1.32, 0.22],
      [1, 0.16, 1.4, 0.1],
    ],
    gear: {
      nose: 15.635,
      main: 0.035,
      track: 2.86,
      r: [0.343, 0.565],
      top: [1.9, 2.5],
      strut: [0.07, 0.12],
      spread: [0.75, 0.76],
    },
  },
  'citation-cj4': {
    // Crown, sharp nose and panes from the same Hahn Air D-CHRA broadside: a 1.6 m deep
    // fuselage under a long, gently rising nose; a two-piece windscreen and a rounded side
    // window on a level sill.
    cy: 1.63,
    ry: 0.8,
    radius: 0.86,
    eye: [0.36, 2.05, 3.15],
    cabinWidth: 1.42,
    smoothNose: true,
    nose: [
      [0, 0.008, 1.2, 1.23],
      [0.03, 0.09, 1.15, 1.28],
      [0.1, 0.16, 1.1, 1.33],
      [0.3, 0.29, 1.02, 1.43],
      [0.6, 0.42, 0.94, 1.55],
      [1, 0.545, 0.885, 1.68],
      [1.5, 0.665, 0.85, 1.85],
      [1.9, 0.735, 0.835, 2.01],
      [2.3, 0.78, 0.83, 2.18],
      [2.7, 0.825, 0.83, 2.31],
      [3.2, 0.85, 0.83, 2.39],
      [4, 0.86, 0.83, 2.43],
    ],
    // Pane corners: [half-width, height, distance aft of tip]; null = on the skin.
    glazing: [
      [
        [0.03, null, 1.78],
        [null, 1.81, 2.44],
        [null, 2.18, 2.55],
        [0.03, null, 2.3],
      ],
      [
        [null, 1.79, 2.64],
        [null, 1.78, 3.17],
        [null, 1.84, 3.25],
        [null, 2.16, 3.26],
        [null, 2.22, 3.19],
        [null, 2.22, 2.69],
      ],
    ],
    // Small upright windows centred 1.95 m up (photo), not on the generic cabin line.
    cabin: {
      count: 6,
      front: 5.25,
      back: 8.0,
      y: 1.95,
      halfWidth: 0.15,
      halfHeight: 0.18,
      rounding: 0.06,
    },
    // Stations from a broadside Hahn Air CJ4 approach photo (GFDL): the 16.26 m overall
    // length runs to the swept T-tail, which overhangs a tail cone ending 14.2 m aft.
    engine: {
      radius: 0.45,
      length: 2.4,
      x: 1.32,
      y: 2.02,
      z: -2.27,
      core: 0.22,
      // FJ44-4A: bulged fan cowl tapering to a single mixed nozzle.
      lathe: [
        [-0.5, 0.74],
        [-0.35, 0.85],
        [-0.1, 0.96],
        [0.15, 1],
        [0.35, 1],
        [0.45, 0.975],
        [0.5, 0.93],
      ],
      mixed: true,
      pylon: [0.55, -0.95, 0.28],
    },
    wing: {
      y: 1.04,
      z: 0.475,
      span: 7.1,
      sweep: 1.45,
      root: 2.65,
      tip: 0.9,
      dihedral: 0.065,
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [2.25, -1.35, 0.1, 0.5],
    tail: {
      // Swept fin widening under the T-tail (D-CHRA tail close-up): root leading edge 11.36 m
      // aft of the nose, tip leading edge 0.4 m ahead of a parallelogram fin, same trailing edge.
      z: -4.085,
      base: 2.0,
      height: 2.6,
      root: 1.71,
      tip: 2.08,
      sweep: 2.9,
      dorsal: [-2.92, 0.75, 1.7, 0.4, 1.33],
      span: 2.75,
      hZ: -7.12,
      hY: 4.6,
      hRoot: 1.5,
      hTip: 0.65,
      hSweep: 1.05,
    },
    // The upswept tail cone still ends 2.02 m up under the fin, above the shallower cabin.
    aft: [
      [0.62, 1, 0],
      [0.7, 0.86, 0],
      [0.76, 0.72, 0.04],
      [0.81, 0.53, 0.11],
      [0.85, 0.3, 0.26],
      [0.872, 0.1, 0.377],
      [0.875, 0, 0.39],
    ],
    gear: {
      // Nose leg 1.39 m aft of the tip (photo 1.54 m): keeps the tyre and drag brace clear
      // of the cockpit footwell stations so the belly skin, not the wheel, closes them.
      nose: 6.74,
      main: 0.27,
      track: 1.6,
      r: [0.23, 0.28],
      top: [0.95, 1.0],
      strut: [0.045, 0.06],
      spread: [0, 0],
    },
  },
  'gulfstream-g650er': {
    cy: 2.63,
    ry: 1.43,
    radius: 1.47,
    eye: [0.53, 3.37, 3.75],
    cabinWidth: 2.35,
    smoothNose: true,
    // Slim, drooped radome: plan half-widths from the Gulfstream large-cabin three-view
    // (scaled to this fuselage), heights from the N400J and N7GF broadsides.
    nose: [
      [0, 0.01, 2.05, 2.08],
      [0.12, 0.13, 1.9, 2.25],
      [0.45, 0.32, 1.62, 2.55],
      [1.1, 0.6, 1.32, 2.94],
      [1.9, 0.91, 1.21, 3.39],
      [2.8, 1.19, 1.2, 3.81],
      [3.8, 1.39, 1.2, 4.04],
      [5.1, 1.47, 1.2, 4.06],
      [6.3, 1.47, 1.2, 4.06],
    ],
    // Pane corners: [half-width, height, distance aft of tip]; null = on the skin. The
    // compact, low glazing band of the N400J and N7GF broadsides: a raked windscreen and one
    // long side window with a raked aft edge, sill 3.05 m and brow 3.5 m, ending 3.9 m aft.
    // Outer corners are chamfered twice, so the panes read with the type's rounded corners.
    glazing: [
      [
        [null, 3.13, 2.15],
        [null, 3.43, 2.55],
        [null, 3.505, 2.57],
        [0.035, null, 2.17],
        [0.035, null, 1.5],
        [null, 3.08, 1.98],
      ],
      [
        [null, 3.12, 2.31],
        [null, 3.05, 2.4],
        [null, 3.05, 3.5],
        [null, 3.11, 3.62],
        [null, 3.42, 3.86],
        [null, 3.49, 3.78],
        [null, 3.49, 2.88],
        [null, 3.43, 2.72],
      ],
    ],
    // Eight large ovals (0.75 x 0.56 m) at ~1.35 m pitch, ending ahead of the nacelles
    // (N400J and N657FX broadside photos); the airstair door sits right behind the deck.
    cabin: {
      count: 8,
      front: 6.4,
      back: 15.85,
      halfWidth: 0.375,
      halfHeight: 0.28,
      door: 4.75,
    },
    // Stations from a broadside G650ER photo (N400J, CC BY-SA 2.0) cross-checked with the
    // Gulfstream G500 three-view: the 30.41 m length runs to the stabiliser tips, which
    // overhang a tail cone ending 26.8 m aft; wing root, nacelles and gear sit well forward.
    engine: {
      // Inlet station kept; the cowl runs 0.2 m further aft and sits 0.07 m higher (N657FX).
      radius: 0.91,
      length: 3.85,
      x: 2.04,
      y: 3.42,
      z: -5.15,
      core: 0.26,
      // BR725: near-cylindrical cowl with a large polished inlet and a mixed nozzle.
      lathe: [
        [-0.5, 0.8],
        [-0.38, 0.9],
        [-0.15, 0.98],
        [0.1, 1],
        [0.36, 1],
        [0.46, 0.985],
        [0.5, 0.95],
      ],
      mixed: true,
      pylon: [0.6, -1.4, 0.35],
    },
    wing: {
      y: 1.65,
      z: 2.05,
      span: 13.35,
      sweep: 9.8,
      root: 5.9,
      tip: 0.98,
      dihedral: 0.035,
      tracks: [0.3, 0.5, 0.68],
      trackSize: 0.7,
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [5.6, -1.9, 0.2, 0.95],
    // Tall, strongly swept blended winglets (N650VC in-flight photo).
    winglet: { height: 1.85, out: 0.6, root: 1.05, tip: 0.36, sweep: 1.35 },
    tail: {
      z: -9.39,
      base: 3.6,
      height: 4.05,
      root: 4.3,
      tip: 2.37,
      sweep: 2.88,
      span: 5.85,
      hZ: -11.6,
      hY: 7.7,
      hRoot: 3.05,
      hTip: 1.03,
      hSweep: 4.1,
    },
    aft: [
      [0.6, 1, 0],
      [0.7, 0.9, 0.08],
      [0.78, 0.74, 0.2],
      [0.84, 0.52, 0.32],
      [0.875, 0.25, 0.42],
      [0.882, 0.08, 0.44],
      [0.884, 0, 0.44],
    ],
    gear: {
      nose: 12.6,
      main: -0.58,
      track: 2.1,
      r: [0.3, 0.42],
      top: [1.5, 1.75],
      strut: [0.06, 0.1],
      spread: [0.75, 0.7],
    },
  },
  'embraer-e175': {
    cy: 2.97,
    ry: 1.62,
    radius: 1.505,
    // E-Jet nose from the Flybe G-FBJJ broadside (CC0), heights from the belly line, plan
    // widths from the Republic planform photo (slimmed near the tip to the Finnair E190 3/4
    // views): a low, drooped, slightly pointed tip 0.7 m above the belly, a long straight
    // upper slope, and a low flight deck with its glazing ending 3.3 m aft.
    eye: [0.53, 3.53, 3.4],
    cabinWidth: 2.3,
    smoothNose: true,
    nose: [
      [0, 0.012, 2.06, 2.09],
      [0.03, 0.12, 1.97, 2.17],
      [0.1, 0.22, 1.885, 2.27],
      [0.2, 0.31, 1.8, 2.385],
      [0.3, 0.39, 1.735, 2.48],
      [0.5, 0.52, 1.635, 2.63],
      [0.75, 0.67, 1.54, 2.79],
      [1, 0.8, 1.475, 2.935],
      [1.25, 0.91, 1.43, 3.075],
      [1.5, 1.0, 1.4, 3.22],
      [2, 1.14, 1.37, 3.6],
      [2.5, 1.27, 1.355, 3.93],
      [3, 1.35, 1.35, 4.17],
      [3.5, 1.42, 1.35, 4.32],
      [4, 1.465, 1.35, 4.41],
      [4.5, 1.49, 1.35, 4.47],
      [5, 1.505, 1.35, 4.53],
      [5.7, 1.505, 1.35, 4.57],
      [6.5, 1.505, 1.35, 4.59],
    ],
    // Pane corners: [half-width, height, distance aft of tip]; null = on the skin. A large
    // raked windscreen and a rounded side window each side, on one low sill.
    glazing: [
      [
        [0.035, null, 1.645],
        [null, 3.31, 2.29],
        [null, 3.86, 2.74],
        [0.035, null, 2.385],
      ],
      [
        [null, 3.32, 2.55],
        [null, 3.3, 3.24],
        [null, 3.36, 3.31],
        [null, 3.77, 3.31],
        [null, 3.83, 3.24],
        [null, 3.83, 2.79],
      ],
    ],
    cabin: {
      count: 23,
      front: 6.1,
      back: 24.8,
      halfWidth: 0.15,
      halfHeight: 0.205,
      rounding: 0.07,
    },
    // Planform from a Republic E175 (long wing) underside photo taken overhead; fin, nacelle
    // height and gear stations from a LOT E175 take-off photo (both cited in the review).
    engine: {
      radius: 0.82,
      length: 2.6,
      x: 3.92,
      y: 1.35,
      z: 3.96,
      core: 0.32,
      pylon: [
        [0.6, 0.6],
        [0.0, 0.92],
        [-1.5, 0.92],
        [-2.6, 0.7],
        [-2.6, 0.3],
        [-1.0, 0.3],
      ],
      pylonWidth: 0.11,
    },
    wing: {
      y: 2.04,
      z: 1.335,
      span: 12.95,
      sweep: 5.7,
      root: 5.04,
      tip: 1.19,
      dihedral: 0.08,
      kink: [0.282, 3.43],
      thickness: 0.12,
      tracks: [0.25, 0.47, 0.67],
      trackSize: 0.85,
    },
    // Wing-to-body fairing: [front z, back z, depth below the keel, half-width].
    belly: [5.0, -3.6, 0.24, 1.1],
    // E-Jet winglet: a straight, strongly canted, swept panel tapering to a narrow tip from a
    // short root bend (KLM PH-EXK photo), not a long blended curve.
    winglet: { height: 1.45, out: 1.76, root: 1.19, tip: 0.3, sweep: 1.6, radius: 0.25 },
    tail: {
      z: -11.58,
      base: 4.2,
      height: 5.66,
      root: 4.87,
      tip: 1.25,
      sweep: 5.06,
      dorsal: [-9.0, 1.4, 4.0, 0.5, 3.67],
      span: 4.95,
      hZ: -12.35,
      hY: 3.85,
      hRoot: 3.38,
      hTip: 1.45,
      hSweep: 3.37,
      hDihedral: 0.08,
    },
    aft: [
      [0.64, 1, 0],
      [0.72, 0.9, 0.12],
      [0.8, 0.74, 0.32],
      [0.88, 0.52, 0.55],
      [0.95, 0.3, 0.75],
      [1, 0.12, 0.85],
    ],
    gear: {
      nose: 11.78,
      main: 0.28,
      track: 2.45,
      r: [0.31, 0.48],
      top: [1.7, 2.1],
      strut: [0.06, 0.1],
      spread: [0.75, 0.75],
    },
  },
  'dash-8-q400': {
    cy: 2.58,
    ry: 1.32,
    radius: 1.345,
    eye: [0.5, 3.2, 3.5],
    cabinWidth: 2.16,
    smoothNose: true,
    nose: [
      [0, 0.012, 1.63, 1.66],
      [0.1, 0.2, 1.48, 1.88],
      [0.4, 0.42, 1.3, 2.11],
      [1, 0.76, 1.22, 2.56],
      [1.7, 1.04, 1.23, 3.12],
      [2.4, 1.22, 1.25, 3.61],
      [3.3, 1.32, 1.26, 3.87],
      [4.4, 1.345, 1.26, 3.9],
      [5.6, 1.345, 1.26, 3.9],
    ],
    // Pane corners: [half-width, height, distance aft of tip].
    glazing: [
      [
        [0.032, 2.94, 1.56],
        [0.88, 2.97, 2.12],
        [0.82, 3.53, 2.82],
        [0.032, 3.57, 2.34],
      ],
      // Side window ends 3.4-3.55 m aft of the tip (Team Lufthansa broadside), not 3.9 m.
      [
        [0.93, 2.96, 2.23],
        [null, 2.98, 3.55],
        [null, 3.51, 3.42],
        [0.87, 3.52, 2.91],
      ],
    ],
    cabin: {
      // Small rounded windows, about 0.26 x 0.38 m (D-ADHA broadside).
      count: 27,
      front: 7.1,
      back: 24.4,
      halfWidth: 0.13,
      halfHeight: 0.19,
      rounding: 0.065,
    },
    // Nacelle, wing, T-tail and gear stations from a near-broadside Team Lufthansa
    // DHC-8-402 photograph (GFDL); 8.8 m published track, 4.11 m propellers.
    engine: {
      radius: 0.6,
      length: 3.7,
      x: 4.4,
      y: 3.42,
      z: 3.0,
      prop: 1.95,
      propRadius: 2.055,
      // Black bullet spinner [radius, half-length] enclosing the cowl's nose stations.
      spinner: [0.4, 1.12],
      // R408 composite blade [radius, chord, leading edge] as fractions of the prop radius:
      // broad at mid-span, tapering into a rounded, swept-back tip.
      blade: [
        [0.08, 0.1, 0.05],
        [0.45, 0.14, 0.075],
        [0.85, 0.1, 0.04],
        [1, 0.025, -0.01],
      ],
      // [z, half-width, bottom, top] about the propeller axis: spinner, a deep, narrow oval
      // cowl dropping into the chin intake, flat-bottomed gear bay and the long tapering aft
      // fairing; the axis sits high under the wing (photo spinner just below the crown line).
      section: [
        [3.05, 0.02, -0.02, 0.02],
        [2.6, 0.24, -0.24, 0.24],
        [2.0, 0.37, -0.42, 0.37],
        [1.9, 0.48, -0.84, 0.5],
        [1.6, 0.58, -1.08, 0.66],
        [0.8, 0.62, -1.13, 0.74],
        [-1.0, 0.62, -1.13, 0.76],
        [-3.0, 0.6, -1.1, 0.74],
        [-4.0, 0.53, -1.06, 0.64],
        [-5.2, 0.34, -0.82, 0.36],
        [-6.22, 0.04, -0.4, -0.32],
      ],
      exponent: 2.3,
      // Chin-intake mouth on the cowl face behind the spinner: [y, half-width, half-height, z].
      // Nearly as wide as the cowl and half as tall (Air Baltic / Tyrolean front photos).
      intake: [-0.64, 0.43, 0.25, 1.96],
      // PW150A exhaust stub, outboard side under the wing leading edge: [offset, y, z, r].
      exhaust: [0.56, 0.3, -0.35, 0.16],
    },
    wing: {
      y: 4.05,
      z: 0.6,
      span: 13.2,
      sweep: 0.7,
      root: 3.4,
      tip: 1.6,
      dihedral: 0.044,
    },
    tail: {
      z: -14.045,
      base: 3.7,
      height: 4.5,
      root: 4.45,
      tip: 3.35,
      sweep: 2.3,
      dorsal: [-11.0, 1.3, 4.0, 0.6, 2.8],
      span: 4.635,
      hZ: -14.85,
      hY: 8.25,
      hRoot: 2.9,
      hTip: 1.4,
      hSweep: 2.5,
    },
    aft: [
      [0.62, 1, 0],
      [0.72, 0.9, 0.1],
      [0.82, 0.7, 0.35],
      [0.9, 0.5, 0.6],
      [0.96, 0.3, 0.85],
      [1, 0.12, 0.98],
    ],
    gear: {
      nose: 14.46,
      main: 0.13,
      track: 4.4,
      r: [0.3, 0.43],
      top: [1.6, 2.9],
      strut: [0.06, 0.1],
      spread: [0.7, 0.62],
    },
  },
};

// UV coordinates only determine which skin cells are cut. The photographed
// pane vertices determine the actual 3D shape, including the nearly level brow.
export function prepareGlazing(p) {
  const s = { length: 0 };
  // A corner written as [x, null, d] or [null, y, d] is placed on the skin at that station,
  // so photographed sill and brow heights stay seated on the nose they are cut from.
  p.glazing = p.glazing.map((pane) =>
    pane.map(([x, y, d]) => {
      if (x !== null && y !== null) return [x, y, d];
      const [, w, b, t] = transportSection(s, p, -d),
        c = (b + t) / 2,
        h = (t - b) / 2;
      return x === null
        ? [w * Math.sqrt(Math.max(0, 1 - ((y - c) / h) ** 2)), y, d]
        : [x, c + h * Math.sqrt(Math.max(0, 1 - (x / w) ** 2)), d];
    }),
  );
  p.windows = p.glazing.map((pane) =>
    pane.map(([x, y, d]) => {
      const [, w, b, t] = transportSection(s, p, -d);
      return [(Math.atan2(x / w, (y - (b + t) / 2) / ((t - b) / 2)) * 180) / Math.PI, d];
    }),
  );
  return p;
}
for (const p of Object.values(transportProfiles)) if (p.glazing) prepareGlazing(p);

export function transportFrame(s) {
  const p = transportProfiles[s.slug];
  if (!p) return;
  const eye = [p.eye[0], p.eye[1], s.length / 2 - p.eye[2]];
  return {
    heli: false,
    fighter: false,
    large: true,
    radius: p.radius,
    cy: p.cy,
    ry: p.ry,
    cabinZ: eye[2],
    cabinWidth: p.cabinWidth,
    eye,
    panelZ: eye[2] + 0.67,
    floor: eye[1] - (s.category === 'business' ? 1.12 : 1.25),
    profile: p,
  };
}

export function transportSection(s, p, z) {
  const d = s.length / 2 - z;
  const last = p.nose.at(-1);
  const aft = (
    p.aft ?? [
      [0.67, 1, 0],
      [0.78, 0.84, 0.1],
      [0.89, 0.48, 0.32],
      [1, 0.012, 0.52],
    ]
  ).map(([u, w, rise, wx = w]) => [
    s.length * u,
    p.radius * wx,
    p.cy + rise - p.ry * w,
    p.cy + rise + p.ry * w,
  ]);
  const sections = [...p.nose, ...aft.filter((a) => a[0] > last[0])];
  let i = sections.findIndex((a) => a[0] >= d);
  i = Math.max(1, i < 0 ? sections.length - 1 : i);
  const a = sections[i - 1],
    b = sections[i],
    t = Math.max(0, Math.min(1, (d - a[0]) / (b[0] - a[0])));
  return a.map((v, k) => {
    // smoothNose: true smooths every nose station; a number smooths only that many leading
    // stations, leaving fitted flight-deck sections linear.
    const smooth = p.smoothNose === true ? p.nose.length : (p.smoothNose ?? 0);
    if (!k || i >= smooth) return v + (b[k] - v) * t;
    const slope = (j) => {
      const prev = sections[Math.max(0, j - 1)],
        here = sections[j],
        next = sections[Math.min(sections.length - 1, j + 1)];
      const left = j
        ? (here[k] - prev[k]) / (here[0] - prev[0])
        : (next[k] - here[k]) / (next[0] - here[0]);
      const right = j < sections.length - 1 ? (next[k] - here[k]) / (next[0] - here[0]) : left;
      return left * right <= 0 ? 0 : (2 * left * right) / (left + right);
    };
    const h = b[0] - a[0];
    return (
      (2 * t * t * t - 3 * t * t + 1) * v +
      (t * t * t - 2 * t * t + t) * h * slope(i - 1) +
      (-2 * t * t * t + 3 * t * t) * b[k] +
      (t * t * t - t * t) * h * slope(i)
    );
  });
}

export function transportPoint(s, p, z, angle, offset = 0) {
  const [, w, b, t] = transportSection(s, p, z),
    cy = (b + t) / 2,
    ry = (t - b) / 2;
  return [Math.sin(angle) * (w + offset), cy + Math.cos(angle) * (ry + offset), z];
}

const windowCache = new WeakMap();
function paneData(s, p) {
  if (windowCache.has(p)) return windowCache.get(p);
  const panes = [];
  for (const side of [-1, 1])
    for (const [index, source] of p.windows.entries()) {
      const uv = source.map(([a, d]) => [
        s.length / 2 - d,
        side > 0 ? (a * Math.PI) / 180 : 2 * Math.PI - (a * Math.PI) / 180,
      ]);
      const world = p.glazing
        ? p.glazing[index].map(([x, y, d]) => [side * x, y, s.length / 2 - d])
        : uv.map(([z, a]) => transportPoint(s, p, z, a));
      panes.push({ uv, world });
    }
  windowCache.set(p, panes);
  return panes;
}
function panePoint(s, p, uv, only) {
  // Straight manufactured pane edges, shared by the surrounding skin. Mapping
  // an edge through an ellipse produces the false arched/eyelid windshields.
  let nearest;
  for (const pane of only ? [only] : paneData(s, p)) {
    for (let j = 0; j < pane.uv.length; j++) {
      const a = pane.uv[j],
        b = pane.uv[(j + 1) % pane.uv.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = ((uv[0] - a[0]) * dx + (uv[1] - a[1]) * dy) / (dx * dx + dy * dy);
      const distance = Math.abs((uv[0] - a[0]) * dy - (uv[1] - a[1]) * dx);
      const metric = p.radius,
        tn = Math.max(
          0,
          Math.min(
            1,
            ((uv[0] - a[0]) * dx + (uv[1] - a[1]) * dy * metric * metric) /
              (dx * dx + dy * dy * metric * metric),
          ),
        );
      const q = [a[0] + dx * tn, a[1] + dy * tn],
        dist = Math.hypot(uv[0] - q[0], (uv[1] - q[1]) * metric);
      if (!nearest || dist < nearest.dist) {
        const curved = transportPoint(s, p, q[0], q[1]);
        nearest = {
          dist,
          delta: pane.world[j].map(
            (v, k) => v + (pane.world[(j + 1) % pane.world.length][k] - v) * tn - curved[k],
          ),
        };
      }
      if (t >= -1e-6 && t <= 1 + 1e-6 && distance < 1e-7) {
        const A = pane.world[j],
          B = pane.world[(j + 1) % pane.world.length];
        return A.map((v, k) => v + (B[k] - v) * t);
      }
    }
    if (only || p.glazing) {
      for (let j = 1; j < pane.uv.length - 1; j++) {
        const [a, b, c] = [pane.uv[0], pane.uv[j], pane.uv[j + 1]],
          den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        const u = ((b[1] - c[1]) * (uv[0] - c[0]) + (c[0] - b[0]) * (uv[1] - c[1])) / den;
        const v = ((c[1] - a[1]) * (uv[0] - c[0]) + (a[0] - c[0]) * (uv[1] - c[1])) / den,
          w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-6)
          return pane.world[0].map(
            (q, k) => q * u + pane.world[j][k] * v + pane.world[j + 1][k] * w,
          );
      }
    }
  }
  const base = transportPoint(s, p, uv[0], uv[1]);
  // Fair the neighbouring skin into the flat glazing. Moving only the aperture
  // boundary leaves the next mesh row on the original ellipse and buckles it.
  if (nearest && nearest.dist < 0.7) {
    const t = 1 - nearest.dist / 0.7,
      weight = t * t * (3 - 2 * t);
    return base.map((v, k) =>
      p.glazing && k === 0 && Math.abs(Math.sin(uv[1])) < 1e-10 ? 0 : v + nearest.delta[k] * weight,
    );
  }
  return base;
}

/** Subtract each convex pane in longitudinal/azimuth coordinates, retaining identical
 * boundary vertices in the skin, inner lining and glazing. No oversized blanket cut. */
export function transportCell(s, p, uv, emit) {
  const clip = (points, dist) => {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        da = dist(a),
        db = dist(b);
      if (da >= -1e-10) result.push(a);
      if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
    }
    return result;
  };
  let opaque = [uv];
  for (const data of paneData(s, p)) {
    const pane = data.uv;
    const area = pane.reduce((sum, a, i) => {
      const b = pane[(i + 1) % pane.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const next = [];
    for (const cell of opaque) {
      let inside = cell;
      for (let i = 0; i < pane.length && inside.length; i++) {
        const a = pane[i],
          b = pane[(i + 1) % pane.length];
        const dist = (q) =>
          Math.sign(area) * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
        const out = clip(inside, (q) => -dist(q));
        if (out.length >= 3) next.push(out);
        inside = clip(inside, dist);
      }
      if (inside.length >= 3)
        emit(
          'glass',
          inside.map((q) => panePoint(s, p, q, data)),
        );
    }
    opaque = next;
  }
  for (const cell of opaque)
    emit(
      'skin',
      cell.map((q) => panePoint(s, p, q)),
    );
}

export function transportWindowFrames(
  d,
  s,
  p,
  material,
  radius = s.category === 'business' ? 0.009 : 0.014,
) {
  for (const pane of paneData(s, p))
    for (let j = 0; j < pane.world.length; j++)
      d.rod(pane.world[j], pane.world[(j + 1) % pane.world.length], radius, material);
}

export function transportInteriorWidth(s, p, z, y) {
  let previous = panePoint(s, p, [z, 0]);
  for (let j = 1; j <= 128; j++) {
    const next = panePoint(s, p, [z, (j * Math.PI) / 128]);
    if (previous[1] >= y && next[1] < y) {
      const t = (y - previous[1]) / (next[1] - previous[1]);
      return Math.max(0, previous[0] + (next[0] - previous[0]) * t - 0.028);
    }
    previous = next;
  }
  return 0;
}

export function transportCoaming(root, s, f, material) {
  const p = f.profile;
  if (!p) return;
  const g = group(root, 'fitted-glareshield-deck'),
    d = detailKit(g, g.name),
    y = f.eye[1] - 0.225;
  const start = f.panelZ + 0.11,
    end = s.length / 2;
  const width = (z) => transportInteriorWidth(s, p, z, y);
  for (let z = start; z < end; z += 0.09) {
    const w = width(z);
    if (w < 0.001) break;
    let next = Math.min(end, z + 0.09),
      w2 = width(next);
    if (w2 < 0.001) {
      // Stop at the skin intersection, rather than carrying a zero-width tip
      // beyond the falling nose roof where it appears as an exterior black fleck.
      let inside = z,
        outside = next;
      for (let i = 0; i < 20; i++) {
        const mid = (inside + outside) / 2;
        if (width(mid) >= 0.001) inside = mid;
        else outside = mid;
      }
      next = inside;
      w2 = width(next);
    }
    quad(d, [-w, y, z], [w, y, z], [w2, y, next], [-w2, y, next], material, [0, 1, 0]);
    for (const side of [-1, 1])
      quad(
        d,
        [side * w, y, z],
        [side * w2, y, next],
        [side * w2, y - 0.22, next],
        [side * w, y - 0.22, z],
        material,
        [side, 0, 0],
      );
  }
  d.finish();
}

/** Closed side-plane prism for an engine pylon: `outline` is [[z, y], ...] in engine
 * coordinates, extruded symmetrically across `halfWidth` (centred on `offset`). Flat faces,
 * shared material. */
export function transportPylon(d, outline, halfWidth, material, offset = [0, 0, 0]) {
  const positions = [];
  const tri = (a, b, c) => positions.push(...a, ...b, ...c);
  const n = outline.length;
  const at = (i, x) => [x, outline[(i + n) % n][1], outline[(i + n) % n][0]];
  for (let i = 1; i < n - 1; i++) {
    tri(at(0, halfWidth), at(i, halfWidth), at(i + 1, halfWidth));
    tri(at(0, -halfWidth), at(i + 1, -halfWidth), at(i, -halfWidth));
  }
  for (let i = 0; i < n; i++) {
    tri(at(i, -halfWidth), at(i, halfWidth), at(i + 1, halfWidth));
    tri(at(i, -halfWidth), at(i + 1, halfWidth), at(i + 1, -halfWidth));
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  d.add(geometry, material, offset);
}

/** Turboprop nacelle loft from measured stations [z, halfWidth, bottom, top] (engine
 * coordinates, +Z forward, listed front to back). Super-elliptic sections keep the
 * flat-sided cowling and deep gear bay of high-wing regional nacelles. */
export function transportNacelle(d, stations, material, segments = 24, exponent = 2.6) {
  const sections = stations.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: segments }, (_, i) => {
      const a = (i * 2 * Math.PI) / segments,
        s = Math.sin(a),
        c = Math.cos(a);
      const k = 2 / exponent;
      return [
        Math.sign(s) * Math.pow(Math.abs(s), k) * w,
        (b + t) / 2 + Math.sign(c) * Math.pow(Math.abs(c), k) * ((t - b) / 2),
      ];
    }),
  }));
  loft(d, sections, material, { caps: true, smooth: true });
}

/** Wing-to-body fairing under a low wing, `p.belly` = [front z, back z, depth below the keel,
 * half-width]: a super-elliptic keel, broad and flat under the wing box, tapering into the
 * fuselage at both ends. Its upper half stays inside the shell. */
export function transportBelly(d, s, p, material) {
  const [front, back, depth, half] = p.belly;
  const sections = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18,
      z = front + (back - front) * u;
    const bump = Math.min(
      Math.sin((Math.min(1, u / 0.28) * Math.PI) / 2),
      Math.sin((Math.min(1, (1 - u) / 0.38) * Math.PI) / 2),
    );
    const [, , b, t] = transportSection(s, p, z),
      bottom = b + 0.06 - (depth + 0.06) * bump,
      top = b + (t - b) * 0.4,
      width = half * (0.3 + 0.7 * Math.sqrt(bump));
    sections.push({
      z,
      points: Array.from({ length: 24 }, (_, j) => {
        const sn = Math.sin((j * Math.PI) / 12),
          cs = Math.cos((j * Math.PI) / 12),
          h = (top - bottom) / 2;
        return [
          Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 2.4) * width,
          bottom + h + Math.sign(cs) * Math.pow(Math.abs(cs), 2 / 2.4) * h,
        ];
      }),
    });
  }
  loft(d, sections, material, { caps: false, smooth: true });
}

/** Dark cabin sidewall a few centimetres inside the passenger-window band, so the windows
 * read dark as they do in daylight photographs instead of showing the sunlit far skin. */
export function transportCabinBacking(d, s, p, from, to, centerY, halfHeight, material) {
  const rows = [-1, -0.35, 0.35, 1].map((k) => centerY + k * (halfHeight + 0.12));
  const steps = Math.max(2, Math.ceil(Math.abs(from - to) / 0.6));
  for (const side of [-1, 1]) {
    const point = (z, y) => {
      const [, w, b, t] = transportSection(s, p, z),
        v = (y - (b + t) / 2) / ((t - b) / 2);
      return [side * (w * Math.sqrt(Math.max(0, 1 - v * v)) - 0.06), y, z];
    };
    for (let i = 0; i < steps; i++) {
      const z0 = from + ((to - from) * i) / steps,
        z1 = from + ((to - from) * (i + 1)) / steps;
      for (let r = 0; r < rows.length - 1; r++)
        quad(
          d,
          point(z0, rows[r]),
          point(z1, rows[r]),
          point(z1, rows[r + 1]),
          point(z0, rows[r + 1]),
          material,
          [side, 0, 0],
        );
    }
  }
}

/** Swept, tapered wingtip. Without `radius` the long blended curve of a 737 or G650 winglet;
 * with it, a circular root fillet of that radius into a straight canted panel (A320 sharklet,
 * E-Jet winglet), the cant solved so the tip still rises `height` and reaches `out`. */
export function transportWinglet(d, at, side, p, material) {
  const rings = [];
  const ring = (t, x, y) => {
    const chord = p.root + (p.tip - p.root) * t,
      le = at[2] - p.sweep * t;
    rings.push([at[0] + side * x, at[1] + y, le, chord, 0.015 - 0.006 * t]);
  };
  if (p.radius) {
    const r = p.radius;
    let cant = Math.atan2(p.out, p.height);
    for (let i = 0; i < 24; i++)
      cant = Math.atan2(p.out - r * Math.cos(cant), p.height - r + r * Math.sin(cant));
    const arc = r * (Math.PI / 2 - cant),
      straight = Math.hypot(p.out - r * Math.cos(cant), p.height - r + r * Math.sin(cant)),
      total = arc + straight;
    for (let i = 0; i <= 4; i++) {
      const phi = (i / 4) * (Math.PI / 2 - cant);
      ring((r * phi) / total, r * Math.sin(phi), r * (1 - Math.cos(phi)));
    }
    for (let i = 1; i <= 6; i++) {
      const run = (straight * i) / 6;
      ring(
        (arc + run) / total,
        r * Math.cos(cant) + run * Math.sin(cant),
        r * (1 - Math.sin(cant)) + run * Math.cos(cant),
      );
    }
  } else
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      ring(t, p.out * Math.sin((t * Math.PI) / 2), p.height * t * t * (3 - 2 * t));
    }
  // Thickness is offset across the local span direction, so a canted or curving panel
  // keeps both skins apart instead of folding flat where it runs outward.
  const skin = rings.map((r, j) => {
    const a = rings[Math.max(0, j - 1)],
      b = rings[Math.min(rings.length - 1, j + 1)],
      dx = (b[0] - a[0]) * side,
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy) || 1;
    return (face, edge) => [
      r[0] + (face * r[4] * dy * side) / length,
      r[1] - (face * r[4] * dx) / length,
      r[2] - edge * r[3],
    ];
  });
  for (let j = 0; j < rings.length - 1; j++) {
    const a = skin[j],
      b = skin[j + 1];
    for (const face of [-1, 1]) {
      const out = a(face, 0).map((v, k) => (k < 2 ? v - a(-face, 0)[k] : 0));
      quad(d, a(face, 0), b(face, 0), b(face, 1), a(face, 1), material, out);
    }
    for (const edge of [0, 1])
      quad(d, a(-1, edge), a(1, edge), b(1, edge), b(-1, edge), material, [0, 0, edge ? -1 : 1]);
  }
  for (const [a, normal] of [
    [skin[0], -1],
    [skin.at(-1), 1],
  ])
    quad(d, a(-1, 0), a(1, 0), a(1, 1), a(-1, 1), material, [0, normal, 0]);
}

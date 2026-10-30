import { prepareGlazing } from './transport-profiles.mjs';

// ATR's June 2015 three-view supplies the fuselage stations; nose half-widths follow the
// plan view of the Commons ATR family drawing (blunt, full width by the flight deck). The six-pane
// flight-deck outline is checked against ATR's photograph atr_66487md_1532.
const ppm = 1033 / 27.166;
export const atr72Stations = [
  [35, 0.012, 261, 260],
  [39, 0.34, 268.5, 251],
  [47, 0.62, 275, 239.5],
  [85, 1.08, 287.5, 223.5],
  [105, 1.2, 291, 205.5],
  [135, 1.35, 292, 194],
  [180, 1.42, 293, 193],
  [240, 1.43, 293, 193],
  [350, 1.43, 293, 193],
  [474, 1.43, 293, 193],
  [618, 1.43, 293, 193],
  [742, 1.4, 292, 194],
  [800, 1.32, 284, 198],
  [880, 1.06, 269, 202],
  [960, 0.68, 248, 207],
  [1035, 0.3, 229, 212],
  [1068, 0.015, 222, 218],
].map(([u, w, b, t]) => [13.583 - (u - 35) / ppm, w, (330 - b) / ppm, (330 - t) / ppm]);

// The radome stations follow G-ORAI's broadside (Aurigny, CC BY-SA 2.0): a blunt radome whose
// crown rises 0.55 m within 0.3 m of the tip, not a drooping point. Radome half-widths follow
// the family drawing's broad, round plan (0.8 m at 0.66 m aft, 1.08 m at 1.3 m). The radome
// (first four stations) is interpolated smoothly rather than as flat facets; the fitted
// flight-deck sections behind it stay linear.
export const atr72Nose = prepareGlazing({
  radius: 1.43,
  cy: 2.31,
  ry: 1.31,
  smoothNose: 4,
  nose: atr72Stations.map(([z, w, b, t]) => [13.583 - z, w, b, t]),
  glazing: [
    [
      [0.03, 2.86, 1.53],
      [0.85, 2.8, 2.16],
      [0.78, 3.33, 2.77],
      [0.03, 3.37, 2.23],
    ],
    [
      [0.9, 2.79, 2.27],
      [1.15, 2.72, 3.18],
      [1.04, 3.33, 3.18],
      [0.83, 3.33, 2.86],
    ],
    [
      [1.18, 2.73, 3.28],
      [1.3, 2.83, 3.97],
      [1.15, 3.32, 3.73],
      [1.08, 3.33, 3.28],
    ],
  ],
});

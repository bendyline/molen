/** The six timber viewing tiers inside Palazzo del Bo. Sections use the University of Padua's
 * published span range and the public-domain photograph of the historic interior.
 */
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tone = {
  board: rgb('9d7149'),
  tread: rgb('ad8257'),
  trim: rgb('785136'),
  carving: rgb('a67950'),
  floor: rgb('987a5a'),
};
const tau = 2 * Math.PI;

const elliptical = (radius, proportion, angle, y) => [
  radius * Math.cos(angle),
  y,
  radius * proportion * Math.sin(angle),
];

function strip(out, inside, outside, y, lower, ratio, pieces, openings) {
  for (let i = 0; i < pieces; i++) {
    const a = (i * tau) / pieces;
    const b = ((i + 1) * tau) / pieces;
    if (openings(i, pieces)) continue;
    const at = (r, theta, elevation) => elliptical(r, ratio, theta, elevation);
    face(
      out,
      'theatreWood',
      [at(inside, a, y), at(inside, b, y), at(outside, b, y), at(outside, a, y)],
      tone.tread,
    );
    face(
      out,
      'theatreWood',
      [at(inside, b, lower), at(inside, a, lower), at(inside, a, y), at(inside, b, y)],
      tone.trim,
    );
    face(
      out,
      'theatreWood',
      [at(outside, a, lower), at(outside, b, lower), at(outside, b, y), at(outside, a, y)],
      tone.board,
    );
  }
}

function railing(out, radius, ratio, base, height, pieces, openings, lod) {
  const course = (y, color, crossSection) => {
    const stopPositions = Array.from({ length: pieces }, (_, i) =>
      elliptical(radius, ratio, (i * tau) / pieces, y),
    );
    // Short closed runs retain a doorway gap on each occupied gallery tier.
    let run = [];
    for (let i = 0; i <= pieces; i++) {
      const current = i % pieces;
      run.push(stopPositions[current]);
      if (openings(current, pieces) || i === pieces) {
        if (run.length > 1) beamPath(out, 'theatreWood', run, crossSection, 0.095, color);
        run = [];
        continue;
      }
    }
  };
  course(base + height, tone.trim, 0.105);
  if (lod > 1) course(base + 0.095, tone.board, 0.076);
  const spacing = lod < 2 ? 1 : 2;
  const railPieces = pieces * spacing;
  for (let i = 0; i < railPieces; i++) {
    if (openings(Math.floor(i / spacing), pieces)) continue;
    const a = ((i + 0.41) * tau) / railPieces;
    const [x, , z] = elliptical(radius, ratio, a, 0);
    const spindle = transform(out, -a, [x, base, z]);
    const w = lod > 2 ? 0.03 : 0.036;
    box(spindle, 'theatreWood', [-w, 0.1, -0.022], [w, height, 0.022], tone.carving);
    if (lod > 2)
      box(
        spindle,
        'theatreWood',
        [-w - 0.013, height * 0.38, -0.026],
        [w + 0.013, height * 0.66, 0.026],
        tone.board,
      );
  }
}

/** `section` keeps opening widths, tier count, room orientation, and estimated rise inspectable. */
export function buildAnatomicalTheatre(out, section, lod) {
  const { center, heading, floor, spanMin, spanMax, tierCount, ratio, riser } = section;
  const room = transform(out, heading, [center[0], floor, center[1]]);
  const slices = [12, 18, 24, 32][lod];
  const radius = (tier) => (spanMin + ((spanMax - spanMin) * tier) / (tierCount - 1)) / 2;
  const aisle = (segment, total) => segment === 0 || segment === total - 1;
  // The photograph shows a central table enclosed by a low oval guard.
  box(room, 'theatreWood', [-1.1, -0.07, -0.64], [1.1, 0.02, 0.64], tone.floor);
  box(room, 'theatreWood', [-0.7, 0.04, -0.17], [0.7, 0.69, 0.17], tone.trim);
  box(room, 'theatreWood', [-0.94, 0.69, -0.27], [0.94, 0.83, 0.27], tone.board);
  if (lod > 1) railing(room, 1.08, 0.48, 0.025, 0.58, 24, () => false, lod);
  for (let tier = 0; tier < tierCount; tier++) {
    const a = radius(tier);
    const b = tier < tierCount - 1 ? radius(tier + 1) + 0.045 : a + 0.64;
    const height = 0.24 + tier * riser;
    strip(room, a, b, height, height - 0.17, ratio, slices, () => false);
    if (lod > 0) railing(room, a + 0.035, ratio, height, 0.94, slices, aisle, lod);
  }
}

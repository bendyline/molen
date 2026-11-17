/** Longitudinal Thai roof sections, gable fascia and simplified Front Palace finials. */
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const tile = rgb('bd6544');
export const darkTile = rgb('995439');
const brickTile = rgb('ac6748');
export const gilding = rgb('ce9a48');
const wood = rgb('663c32');
const goldShade = rgb('aa7638');
const mirroredGlass = rgb('4e5554');

function gableProfile(width, eave, rise, steps) {
  const half = width / 2;
  const flank = [[-half, eave]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const at = -half * (1 - t);
    const y = eave + rise * (t * 0.73 + t * t * 0.27);
    flank.push([at - 0.1, y - 0.13], [at, y + 0.2]);
  }
  return [...flank, [0, eave + rise], ...flank.toReversed().map(([z, y]) => [-z, y])];
}

function finials(out, x, sign, z, top, width, lod) {
  const h = Math.min(1.8, width * 0.087);
  const tip = (y, t, u = 0) => [x + t * sign, top + h * y, z + u];
  if (lod === 1) {
    beamPath(out, 'gold', [tip(-0.1, -0.14), tip(0.91, 0.43)], h * 0.13, h * 0.12, gilding);
    return;
  }
  const shaft = [
    tip(-0.14, -0.18),
    tip(0.42, 0.11),
    tip(0.84, 0.36),
    tip(1.05, 0.28),
    tip(0.93, 0.64),
  ];
  beamPath(out, 'gold', shaft, h * 0.105, h * 0.11, gilding);
  if (lod > 1) {
    const root = shaft[0];
    for (const s of [-1, 1])
      beamPath(
        out,
        'gold',
        [root, tip(0.19, 0.1, s * h * 0.16), tip(0.46, 0.27, s * h * 0.075)],
        0.09,
        0.1,
        goldShade,
      );
  }
}

function gableRelief(out, x, sign, z, width, eave, rise) {
  const xy = (h, w, depth) => [x + sign * depth, eave + rise * h, z + width * w];
  const panel = (slot, points, tint) =>
    triangle(out, slot, sign > 0 ? points : [...points].reverse(), tint);
  panel('gold', [xy(0.1, 0.3, 0.022), xy(0.1, -0.3, 0.022), xy(0.74, 0, 0.022)], goldShade);
  panel('gold', [xy(0.13, 0.27, 0.032), xy(0.13, -0.27, 0.032), xy(0.68, 0, 0.032)], mirroredGlass);
  for (const side of [-1, 1]) {
    const stops = [
      xy(0.15, 0.2 * side, 0.045),
      xy(0.23, 0.12 * side, 0.045),
      xy(0.41, 0.023 * side, 0.045),
    ];
    beamPath(out, 'gold', stops, 0.1, 0.062, gilding);
  }
  beamPath(
    out,
    'gold',
    [xy(0.14, 0, 0.055), xy(0.45, 0, 0.055), xy(0.54, 0, 0.055)],
    0.12,
    0.078,
    gilding,
  );
}

export function gabledRoof(
  out,
  { x0, x1, z, width, eave, rise, steps = 1, roofTile = tile, gilt = false, gableTint = wood },
  lod,
) {
  const stepCount = lod === 0 ? 1 : lod === 1 ? Math.min(steps, 2) : steps;
  const profile = gableProfile(width, eave, rise, stepCount);
  for (let i = 0; i + 1 < profile.length; i++) {
    const [a, y] = profile[i];
    const [b, yy] = profile[i + 1];
    const y0 = eave - 0.18;
    const ends = [
      [x0, -1],
      [x1, 1],
    ];
    face(
      out,
      'tiles',
      [
        [x0, y, z + a],
        [x0, yy, z + b],
        [x1, yy, z + b],
        [x1, y, z + a],
      ],
      i % 4 === 1 ? brickTile : roofTile,
    );
    for (const [x, sign] of ends) {
      const wall = [
        [x, y0, z + a],
        [x, y, z + a],
        [x, yy, z + b],
        [x, y0, z + b],
      ];
      face(out, 'wood', sign > 0 ? wall : [...wall].reverse(), gableTint);
      const rail = gilt ? 0.145 : 0.075;
      const lip = [wall[1], wall[2], [x, yy + rail, z + b], [x, y + rail, z + a]];
      if (lod > 0)
        face(
          out,
          gilt ? 'gold' : 'wood',
          sign > 0 ? [...lip].reverse() : lip,
          gilt ? gilding : wood,
        );
    }
  }
  if (lod === 0) return;
  if (lod > 1) {
    const half = width / 2;
    face(
      out,
      'wood',
      [
        [x0, eave - 0.1, z - half],
        [x1, eave - 0.1, z - half],
        [x1, eave - 0.1, z + half],
        [x0, eave - 0.1, z + half],
      ],
      gableTint,
    );
  }
  box(
    out,
    'tiles',
    [x0, eave + rise - 0.04, z - 0.08],
    [x1, eave + rise + 0.12, z + 0.08],
    roofTile,
  );
  if (!gilt) return;
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    finials(out, x, sign, z, eave + rise, width, lod);
    if (lod < 2) continue;
    gableRelief(out, x, sign, z, width, eave, rise);
    for (const side of [-1, 1]) {
      const edge = z + (side * width) / 2;
      beamPath(
        out,
        'gold',
        [
          [x - sign * 0.12, eave - 0.11, edge],
          [x + sign * 0.12, eave + 0.03, edge + side * 0.22],
          [x + sign * 0.18, eave + 0.38, edge + side * 0.23],
        ],
        0.13,
        0.13,
        gilding,
      );
    }
  }
}

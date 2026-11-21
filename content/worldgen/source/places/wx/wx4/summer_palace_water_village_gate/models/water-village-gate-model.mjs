import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, up } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  fabric: { slot: 'trim', graph: 'fabric_canvas' },
};

const postColor = [0.29, 0.233, 0.172];
const railColor = [0.34, 0.29, 0.22];
const slatColor = [0.363, 0.316, 0.243];
const roofColor = [0.2, 0.214, 0.206];
const ash = [0.38, 0.381, 0.349];
const lanternRed = [0.54, 0.024, 0.018];

function postLantern(out, x, detail) {
  const center = [x, 0.255];
  const sides = detail < 2 ? 8 : 16;
  const profile = [
    [1.554, 0.079],
    [1.61, 0.133],
    [1.8, 0.133],
    [1.86, 0.079],
  ];
  loft(
    out,
    'fabric',
    profile.map(([y, r]) => radialRing(y, r, r, sides, center)),
    lanternRed,
  );
  if (detail === 0) return;
  beam(out, 'timber', [x, 1.925, 0.083], [x, 1.925, center[1]], 0.027, 0.028, postColor);
  beam(out, 'timber', [x, 1.925, center[1]], [x, 1.86, center[1]], 0.024, 0.025, postColor);
  const collar = [
    [1.538, 0.071],
    [1.554, 0.079],
  ];
  loft(
    out,
    'timber',
    collar.map(([y, r]) => radialRing(y, r, r, sides, center)),
    railColor,
  );
}

function roof(out, detail) {
  const width = 1.45;
  const eave = [2.35, 0.91];
  const middle = [2.54, 0.48];
  const ridge = [2.87, 0.044];
  const rows = detail < 2 ? [eave, ridge] : [eave, middle, ridge];
  loft(
    out,
    'tile',
    rows.map(([y, z]) => [
      [-width, y, z],
      [width, y, z],
      [width, y, -z],
      [-width, y, -z],
    ]),
    roofColor,
    { cap: false },
  );
  beam(out, 'tile', [-width - 0.02, 2.876, 0], [width + 0.02, 2.876, 0], 0.125, 0.11, roofColor);
  for (const side of [-1, 1]) {
    const z = side * eave[1];
    beam(out, 'timber', [-width, 2.298, z], [width, 2.298, z], 0.088, 0.09, postColor);
    if (detail < 2) continue;
    const count = detail === 2 ? 12 : 21;
    for (let i = 0; i < count; i++) {
      const x = -width + 0.07 + ((2 * width - 0.14) * i) / (count - 1);
      beam(out, 'tile', [x, 2.37, z], [x, 2.56, middle[1] * side], 0.048, 0.043, roofColor);
      beam(
        out,
        'tile',
        [x, 2.56, middle[1] * side],
        [x, 2.883, ridge[1] * side],
        0.048,
        0.043,
        roofColor,
      );
    }
  }
  face(
    out,
    'timber',
    [
      [-width, 2.254, -0.86],
      [width, 2.254, -0.86],
      [width, 2.254, 0.86],
      [-width, 2.254, 0.86],
    ],
    postColor,
    [0, -1, 0],
  );
}

function lattice(out, left, right, detail) {
  const depth = 0.13;
  const lo = 0.13;
  const hi = 0.82;
  const step = detail === 1 ? 0.44 : detail === 2 ? 0.29 : 0.216;
  for (const direction of [-1, 1]) {
    const rise = (hi - lo) * direction;
    for (let edge = left - 0.64; edge < right + 0.66; edge += step) {
      const bottom = Math.max(0, Math.min((left - edge) / rise, (right - edge) / rise));
      const top = Math.min(1, Math.max((left - edge) / rise, (right - edge) / rise));
      if (top - bottom < 0.06) continue;
      const z = depth + 0.017 * direction;
      beam(
        out,
        'timber',
        [edge + rise * bottom, lo + (hi - lo) * bottom, z],
        [edge + rise * top, lo + (hi - lo) * top, z],
        detail === 1 ? 0.042 : 0.034,
        0.029,
        slatColor,
      );
    }
  }
}

function fence(out, posts, detail) {
  for (const x of posts)
    box(out, 'timber', [x - 0.054, -0.24, 0.07], [x + 0.054, 1.19, 0.193], postColor);
  for (let i = 1; i < posts.length; i++) {
    const left = posts[i - 1];
    const right = posts[i];
    for (const height of [0.115, 0.837, 1.17])
      box(out, 'timber', [left, height - 0.037, 0.084], [right, height + 0.037, 0.176], railColor);
    if (detail > 0) lattice(out, left, right, detail);
  }
}

function build(out, detail) {
  roof(out, detail);
  for (const x of [-0.995, 0.995]) {
    box(out, 'stone', [x - 0.144, -0.25, -0.155], [x + 0.144, 0.076, 0.19], ash);
    box(out, 'timber', [x - 0.105, 0.06, -0.106], [x + 0.105, 2.33, 0.106], postColor);
    postLantern(out, x, detail);
    if (detail >= 2) {
      for (const z of [-0.27, 0.27])
        beam(out, 'timber', [x, 2.05, 0], [x, 2.265, z], 0.096, 0.12, postColor);
    }
  }
  box(out, 'timber', [-1.16, 2.15, -0.135], [1.16, 2.328, 0.135], postColor);
  fence(out, [-4.87, -3.61, -2.27, -1.083], detail);
  fence(out, [1.083, 2.23, 3.58], detail);
}

export const buildMaster = (out) => build(out, 3);
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);

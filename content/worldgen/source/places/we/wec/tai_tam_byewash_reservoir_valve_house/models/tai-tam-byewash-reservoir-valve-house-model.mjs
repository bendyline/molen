import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  granite: surface('wall', 'stone_ashlar', 0.94),
  plinth: surface('foundation', 'stone_basalt_raw', 0.95),
  roof: surface('roof', 'concrete_plain', 0.87),
  frame: surface('trim', 'metal_painted', 0.78, 0.1),
  door: surface('door', 'wood_plain', 0.78),
  light: surface('window', 'window_punched', 0.72),
};
const colors = palette({
  granite: 'a49c83',
  plinth: '7f796a',
  cap: '9b988a',
  door: '465d58',
  frame: '4d534b',
  light: '666e61',
  stoneEdge: 'aaa28c',
});

function body(out, lod, outline, floor, wallHeight, grade) {
  const top = floor + wallHeight;
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, sign);
    face(
      out,
      'plinth',
      [
        at(a, Math.min(floor - 0.15, grade(a) - 0.32)),
        at(b, Math.min(floor - 0.15, grade(b) - 0.32)),
        at(b, floor),
        at(a, floor),
      ],
      wall.normal,
      colors.plinth,
    );
    face(
      out,
      'granite',
      [at(a, floor), at(b, floor), at(b, top), at(a, top)],
      wall.normal,
      colors.granite,
    );
    if (lod > 1) {
      panel(
        out,
        'plinth',
        wall,
        0,
        wall.length,
        floor + 0.08,
        floor + 0.32,
        0.036,
        colors.stoneEdge,
      );
      panel(out, 'plinth', wall, 0, wall.length, top - 0.19, top - 0.08, 0.038, colors.stoneEdge);
    }
  }
  block(out, 'roof', -3.08, top - 0.06, -2.09, 6.17, 0.21, 4.18, colors.cap);
  if (lod > 1) {
    block(out, 'plinth', -3.13, top + 0.11, -2.135, 6.26, 0.078, 4.27, colors.stoneEdge);
  }
}

function serviceEntrance(out, lod, floor, grade) {
  // The signed map frame records the public footway on the negative Z side.
  const front = plane(-1.95, -1);
  opening(
    out,
    front,
    -1.86,
    -0.58,
    floor + 0.06,
    floor + 2.15,
    'plinth',
    colors.door,
    'door',
    colors.stoneEdge,
    Math.max(0, lod - 1),
    0.037,
  );
  opening(
    out,
    front,
    0.77,
    1.62,
    floor + 1.18,
    floor + 1.93,
    'plinth',
    colors.light,
    'light',
    colors.stoneEdge,
    Math.max(0, lod - 1),
    0.036,
  );
  if (lod > 0) {
    const threshold = Math.max(0.08, floor - 0.01);
    const base = Math.min(grade([-1.3, -2.44]) - 0.18, threshold - 0.1);
    block(out, 'plinth', -2.02, base, -2.63, 1.61, threshold - base, 0.73, colors.plinth);
  }
  if (lod > 2) {
    panel(out, 'frame', front, -1.22, -1.182, floor + 0.09, floor + 2.11, 0.061, colors.frame);
    panel(out, 'plinth', front, 0.68, 1.71, floor + 1.08, floor + 1.18, 0.133, colors.stoneEdge);
    for (const x of [0.97, 1.185, 1.4])
      panel(
        out,
        'frame',
        front,
        x - 0.011,
        x + 0.011,
        floor + 1.22,
        floor + 1.91,
        0.1,
        colors.frame,
      );
    block(out, 'frame', -0.76, floor + 1.04, -2.055, 0.12, 0.027, 0.026, colors.frame);
  }
}

function walkwayRailing(out, lod, grade) {
  if (!lod) return;
  const z = -4.12,
    ends = [
      [-3.37, -2.04],
      [1.65, 3.34],
    ];
  for (const [left, right] of ends) {
    const bottom = (x) => grade([x, z]) - 0.05;
    const barAt = (x, y) => [x, bottom(x) + y, z];
    for (const x of [left, right]) {
      const base = bottom(x);
      block(out, 'frame', x - 0.03, base, z - 0.028, 0.06, 0.98, 0.058, colors.frame);
      if (lod > 2)
        block(out, 'plinth', x - 0.07, base, z - 0.069, 0.14, 0.085, 0.14, colors.plinth);
    }
    for (const y of lod === 1 ? [0.88] : [0.5, 0.91]) {
      const a = barAt(left, y),
        b = barAt(right, y),
        r = 0.023;
      const translate = ([x, h, z], dh, dz) => [x, h + dh, z + dz];
      face(
        out,
        'frame',
        [translate(a, -r, -r), translate(b, -r, -r), translate(b, r, -r), translate(a, r, -r)],
        [0, 0, -1],
        colors.frame,
      );
      face(
        out,
        'frame',
        [translate(a, -r, r), translate(b, -r, r), translate(b, r, r), translate(a, r, r)],
        [0, 0, 1],
        colors.frame,
      );
      face(
        out,
        'frame',
        [translate(a, r, -r), translate(b, r, -r), translate(b, r, r), translate(a, r, r)],
        up,
        colors.frame,
      );
    }
  }
}

function draw(out, lod, { outline, floor, wallHeight }, grade) {
  body(out, lod, outline, floor, wallHeight, grade);
  serviceEntrance(out, lod, floor, grade);
  walkwayRailing(out, lod, grade);
}

const house = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [9, 8, -13],
    lookAt: [0, 1.45, 0],
    yaw: 2.65,
    brief:
      'Tai Tam Byewash Reservoir’s small 1904 granite valve house with its flat slab, plain service entrance and safety rails beside the subsidiary dam.',
    views: [
      { name: 'service-door-and-reservoir-walk', position: [3.4, 4.5, -10], lookAt: [0, 1.3, -1] },
      { name: 'granite-valve-house-from-water-side', position: [10, 6, 12], lookAt: [0, 1.3, 0] },
      {
        name: 'valve-house-roof-and-native-approach',
        position: [7.5, 14, -8.8],
        lookAt: [0, 1.3, -0.9],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = house;
model.category = 'industrial';
model.mediumFiContext.scale = 0.2;
model.sourceLicense =
  'Independent reconstruction from OpenStreetMap, the Lands Department elevation grid and published heritage facts.';
const nativeFrame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
model.buildingCutout = {
  outline: nativeFrame.geometry.outline,
  minimumCoverage: 0.9,
  basis:
    'Replace the mapped valve house shell at its individual footprint, clear of the adjacent dam and path.',
};

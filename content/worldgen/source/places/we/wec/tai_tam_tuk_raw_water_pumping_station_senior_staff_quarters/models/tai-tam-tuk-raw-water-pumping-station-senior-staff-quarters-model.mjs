import {
  around,
  bounds,
  box,
  compoundModel,
  entryDoor,
  foundation,
  gabledRoof,
  hippedRoof,
  mix,
  plane,
  sash,
  sideWall,
  stair,
} from '../../../../../../../../packages/worldgen/scripts/tai-tam-pumping-compound-geometry.mjs';
import { palette } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const colors = palette({
  wall: 'f5efdd',
  trim: '819b9e',
  door: '53726f',
  glass: '5b6f6a',
  iron: '607375',
  stone: 'a39e90',
  roof: '966a55',
  ridge: 'a1745f',
});

function house(out, lod, area, floor, high, roofRise, grade) {
  const [left, right, front, back] = area;
  foundation(out, area, floor, grade, colors.stone);
  box(out, 'lime', area, floor, high, colors.wall);
  for (const y of [floor + 0.38, floor + 3.09, high - 0.22])
    box(out, 'trim', around(area, 0.09), y - 0.065, y + 0.065, colors.trim);
  hippedRoof(
    out,
    lod,
    [-5.91, 5.91, front, back],
    high + 0.04,
    roofRise,
    colors.roof,
    colors.ridge,
  );
  for (const [a, b] of [
    [left, -5.84],
    [5.84, right],
  ]) {
    box(out, 'trim', [a, b, front, back], high - 0.13, high + 0.16, colors.trim);
    for (const z of [front, back - 0.17])
      box(out, 'lime', [a, b, z, z + 0.17], high, high + 0.52, colors.wall);
    const x = a === left ? left : right - 0.18;
    box(out, 'lime', [x, x + 0.18, front, back], high, high + 0.52, colors.wall);
  }
  for (const [z, orientation] of [
    [front, -1],
    [back, 1],
  ]) {
    const wall = plane(z, orientation);
    for (const x of [-7.24, -4.67, -2.58, 2.58, 4.67, 7.24]) {
      sash(out, lod, wall, x, floor + 0.84, floor + 2.56, 1.18, colors);
      sash(out, lod, wall, x, floor + 3.77, floor + 5.31, 1.12, colors);
    }
    sash(out, lod, wall, 0, floor + 3.73, floor + 5.41, 1.33, colors);
  }
  for (const side of [-1, 1]) {
    const wall = sideWall(side < 0 ? left : right, side);
    for (const z of [-2.78, 0, 2.75])
      for (const y of [floor + 0.81, floor + 3.76])
        sash(out, lod, wall, z, y, y + 1.56, 1.21, colors);
  }
  const porch = [-1.93, 1.93, front - 2.34, front + 0.1];
  box(out, 'stone', porch, floor - 0.29, floor + 0.1, colors.stone);
  entryDoor(out, lod, plane(front, -1), 0, floor, 1.46, 2.52, colors);
  box(
    out,
    'trim',
    [-2.03, 2.03, front - 2.47, front + 0.08],
    floor + 2.86,
    floor + 3.05,
    colors.trim,
  );
  for (const x of [-1.68, 1.48]) {
    box(
      out,
      'lime',
      [x, x + 0.22, front - 2.23, front - 2.01],
      floor + 0.09,
      floor + 2.89,
      colors.wall,
    );
    if (lod > 1)
      box(
        out,
        'trim',
        [x - 0.06, x + 0.28, front - 2.29, front - 1.95],
        floor + 2.72,
        floor + 2.86,
        colors.trim,
      );
  }
}

function serviceWing(out, lod, floor, grade) {
  const wingFloor = Math.max(floor + 1.13, grade([7.8, 14.9]) + 0.28);
  for (const area of [
    [3.79, 14.59, 13.48, 18.65],
    [10.66, 14.73, 18.54, 23.18],
  ]) {
    const [left, right, front, back] = area;
    foundation(out, area, wingFloor, grade, colors.stone);
    box(out, 'lime', area, wingFloor, wingFloor + 3.07, colors.wall);
    gabledRoof(out, lod, area, wingFloor + 3.07, 1.3, colors.roof, colors.ridge);
    for (const x of [mix(left, right, 0.23), mix(left, right, 0.67)])
      sash(out, lod, plane(front, -1), x, wingFloor + 0.82, wingFloor + 2.15, 0.79, colors);
    entryDoor(out, lod, sideWall(left, -1), (front + back) / 2, wingFloor, 0.95, 2.24, colors);
  }
  const walk = [4.8, 7.05, 4.27, 13.58];
  stair(out, lod, walk, floor + 0.045, wingFloor + 0.02, colors);
  gabledRoof(
    out,
    lod,
    [4.73, 7.11, 4.36, 13.58],
    wingFloor + 2.52,
    0.73,
    colors.roof,
    colors.ridge,
  );
  for (const z of [4.52, 6.71, 8.91, 11.12, 13.44])
    for (const x of [4.83, 6.87]) {
      const y = mix(floor, wingFloor, (z - walk[2]) / (walk[3] - walk[2]));
      box(out, 'metal', [x, x + 0.079, z, z + 0.079], y, wingFloor + 2.55, colors.iron);
    }
}

function draw(out, lod, { outline, floor, wallHeight, roofRise }, grade) {
  house(out, lod, bounds(outline), floor, floor + wallHeight, roofRise, grade);
  serviceWing(out, lod, floor, grade);
}
const asset = compoundModel(
  import.meta.url,
  {
    category: 'house',
    scale: 0.44,
    yaw: 2.6,
    slots: ['lime', 'trim', 'stone', 'tile', 'ridge', 'glazing', 'door', 'metal'],
    camera: [29, 23, -34],
    lookAt: [3, 3.1, 5.2],
    brief:
      'Senior Staff Quarters at the Tai Tam Tuk pumping station, with a white and blue seaward house and roofed access to the servants’ quarters.',
    views: [
      { name: 'blue-trim-and-seaward-porch', position: [7, 7.5, -22], lookAt: [0, 3.3, 0] },
      { name: 'hipped-center-and-flat-side-roofs', position: [-17, 19, -16], lookAt: [0, 4.2, 0] },
      {
        name: 'covered-walkway-and-servants-quarters',
        position: [-16, 22, 28],
        lookAt: [6.6, 3.1, 12.6],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

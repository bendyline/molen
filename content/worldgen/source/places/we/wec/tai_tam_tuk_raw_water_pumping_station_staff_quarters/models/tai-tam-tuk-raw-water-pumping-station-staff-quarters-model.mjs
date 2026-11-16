import {
  archedWindow,
  bounds,
  box,
  compoundModel,
  entryDoor,
  face,
  foundation,
  hippedRoof,
  plane,
  rail,
  sideWall,
  stair,
} from '../../../../../../../../packages/worldgen/scripts/tai-tam-pumping-compound-geometry.mjs';
import { palette } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const colors = palette({
  wall: 'eae2d2',
  trim: 'b7ae98',
  door: '55706a',
  glass: '64736c',
  iron: '4f625b',
  stone: '9d9383',
  roof: '9b6652',
  ridge: 'a47a65',
  storeRoof: '565550',
});

function store(out, lod, floor, front, grade) {
  const area = [-13.9, -8.89, front - 5.04, front - 2.16];
  const [l, r, f, b] = area;
  const storeFloor = Math.max(floor - 0.2, grade([-11.4, f]) + 0.15);
  foundation(out, area, storeFloor, grade, colors.stone);
  box(out, 'lime', area, storeFloor, storeFloor + 2.35, colors.wall);
  box(out, 'lime', [l, r, b - 0.2, b], storeFloor + 2.3, storeFloor + 2.85, colors.wall);
  face(
    out,
    'ridge',
    [
      [l - 0.16, storeFloor + 2.36, f - 0.24],
      [r + 0.16, storeFloor + 2.36, f - 0.24],
      [r + 0.16, storeFloor + 2.89, b + 0.89],
      [l - 0.16, storeFloor + 2.89, b + 0.89],
    ],
    [0, 1, 0],
    colors.storeRoof,
  );
  box(
    out,
    'trim',
    [l, r, b - 0.1, front + 0.04],
    storeFloor - 0.17,
    storeFloor + 0.06,
    colors.trim,
  );
  for (const x of [l + 0.05, r - 0.17])
    box(out, 'lime', [x, x + 0.13, b + 0.72, b + 0.85], storeFloor, storeFloor + 2.83, colors.wall);
  entryDoor(out, lod, plane(b, 1), l + 1.3, storeFloor, 0.86, 1.98, colors);
}

function draw(out, lod, { outline, floor, wallHeight, roofRise }, grade) {
  const [l, r, f, b] = bounds(outline);
  const frontWall = f + 2.03;
  const mid = floor + 3.09;
  const eave = floor + wallHeight;
  foundation(out, [l, r, f, b], floor, grade, colors.stone);
  box(out, 'lime', [l, r, frontWall, b], floor, eave, colors.wall);
  hippedRoof(out, lod, [l, r, f, b], eave, roofRise, colors.roof, colors.ridge);
  for (const y of [floor, mid, eave - 0.08])
    box(out, 'trim', [l - 0.07, r + 0.07, f - 0.08, b + 0.02], y - 0.14, y + 0.09, colors.trim);
  for (const x of [-16.45, -12.34, -8.23, -4.1, 0, 4.1, 8.23, 12.34, 16.45]) {
    box(out, 'lime', [x - 0.15, x + 0.15, f + 0.12, f + 0.42], floor, eave, colors.wall);
    if (lod > 0)
      for (const y of [floor, mid, eave - 0.23])
        box(out, 'trim', [x - 0.23, x + 0.23, f + 0.04, f + 0.5], y, y + 0.22, colors.trim);
  }
  rail(out, lod, [-16.45, 16.45], f + 0.25, mid + 0.1, colors.iron);
  const facade = plane(frontWall, -1);
  for (const x of [-15, -10.4, -5.1, 0, 5.1, 10.4, 15]) {
    for (const y of [floor, mid]) {
      if (x === -15 || x === 0 || x === 15) entryDoor(out, lod, facade, x, y, 1.02, 2.22, colors);
      else archedWindow(out, lod, facade, x, y + 0.78, y + 2.03, 1.17, 0.22, colors);
    }
    archedWindow(out, lod, plane(b, 1), x, mid + 0.79, mid + 2.01, 1.1, 0.2, colors);
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? l : r;
    const area = side < 0 ? [x - 1.18, x - 0.02] : [x + 0.02, x + 1.18];
    const endFloor = floor + 0.13;
    stair(out, lod, [...area, f - 0.15, b - 0.97], endFloor, mid, colors);
    box(out, 'trim', [...area, b - 0.97, b + 0.09], mid - 0.18, mid + 0.06, colors.trim);
    archedWindow(out, lod, sideWall(x, side), 0.09, mid + 0.84, mid + 2.17, 1.18, 0.19, colors);
  }
  store(out, lod, floor, f, grade);
}

const asset = compoundModel(
  import.meta.url,
  {
    category: 'house',
    scale: 0.52,
    yaw: 2.8,
    slots: ['lime', 'trim', 'tile', 'ridge', 'stone', 'glazing', 'door', 'metal'],
    camera: [26, 17, -34],
    lookAt: [0, 2.42, -0.4],
    brief:
      'Tai Tam Tuk pumping station staff quarters, with two open sea-facing verandahs, concrete end stairs and a low connected store.',
    views: [
      { name: 'long-seaward-verandahs', position: [8, 9, -31], lookAt: [0, 3, -0.5] },
      { name: 'end-stair-and-hipped-roof', position: [27, 12, -12], lookAt: [11.0, 2.15, 0.4] },
      {
        name: 'lower-store-and-covered-approach',
        position: [-24, 13, -19],
        lookAt: [-11.2, 1.91, -4.6],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

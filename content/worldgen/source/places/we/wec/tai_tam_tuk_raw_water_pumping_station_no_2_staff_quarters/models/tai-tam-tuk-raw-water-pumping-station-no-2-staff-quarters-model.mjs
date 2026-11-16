import { palette } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  archedWindow,
  bounds,
  box,
  compoundModel,
  entryDoor,
  foundation,
  plane,
  rail,
  sash,
  sideWall,
  stair,
} from '../../../../../../../../packages/worldgen/scripts/tai-tam-pumping-compound-geometry.mjs';

const colors = palette({
  wall: 'a65f49',
  trim: 'b8b1a0',
  door: '5b6b61',
  glass: '63736b',
  iron: '535f55',
  stone: '82796b',
  roof: '858982',
});

function body(out, lod, [l, r, f, b], floor, mid, top, rise, grade) {
  const verandaWall = f + 1.64;
  foundation(out, [l, r, f, b], floor, grade, colors.stone);
  box(out, 'brick', [l, r, f, b], floor, mid, colors.wall);
  box(out, 'brick', [l, r, verandaWall, b], mid, top, colors.wall);
  box(out, 'brick', [l, -3.73, f, verandaWall], mid, top, colors.wall);
  box(out, 'trim', [l - 0.09, r + 0.1, f - 0.12, b + 0.08], mid - 0.14, mid + 0.08, colors.trim);
  box(out, 'trim', [l - 0.12, r + 0.12, f - 0.17, b + 0.12], top - 0.14, top + 0.09, colors.roof);
  for (const area of [
    [l, r, f, f + 0.19],
    [l, r, b - 0.16, b],
    [l, l + 0.17, f, b],
    [r - 0.17, r, f, b],
  ]) {
    box(out, 'brick', area, top + 0.08, top + rise, colors.wall);
    box(out, 'trim', area, top + rise, top + rise + 0.075, colors.trim);
  }
  const seaward = plane(f, -1);
  const upstairs = plane(verandaWall, -1);
  for (const x of [-4.81, -2.19, 0.29, 2.42, 4.69]) {
    if (x === 2.42) entryDoor(out, lod, seaward, x, floor, 1.04, 2.26, colors);
    else archedWindow(out, lod, seaward, x, floor + 0.8, floor + 1.99, 0.93, 0.19, colors);
    const wall = x < -3.73 ? seaward : upstairs;
    if (x === -2.19 || x === 4.69) entryDoor(out, lod, wall, x, mid, 0.89, 2.14, colors);
    else sash(out, lod, wall, x, mid + 0.72, mid + 2.22, 0.92, colors);
  }
  for (const x of [-3.65, -0.48, 2.75, 5.98]) {
    box(
      out,
      'trim',
      [x - 0.135, x + 0.135, f + 0.08, f + 0.35],
      mid + 0.08,
      top - 0.12,
      colors.trim,
    );
    if (lod > 0)
      box(
        out,
        'trim',
        [x - 0.18, x + 0.18, f + 0.04, f + 0.39],
        top - 0.34,
        top - 0.11,
        colors.trim,
      );
  }
  rail(out, lod, [-3.59, 5.98], f + 0.18, mid + 0.08, colors.iron);
  for (const x of [-4.77, -1.53, 1.66, 4.71])
    sash(out, lod, plane(b, 1), x, mid + 0.73, mid + 2.17, 0.93, colors);
  sash(out, lod, sideWall(r, 1), 0.49, mid + 0.65, mid + 2.16, 0.94, colors);
}

function returnAndStair(out, lod, [l, , f], floor, mid, grade) {
  const room = [l - 2.09, l + 0.08, f + 0.44, f + 2.95];
  const roomFloor = Math.max(floor, grade([l - 0.96, f + 1.76]) + 0.13);
  foundation(out, room, roomFloor, grade, colors.stone);
  box(out, 'brick', room, roomFloor, roomFloor + 2.29, colors.wall);
  box(out, 'trim', room, roomFloor + 2.28, roomFloor + 2.46, colors.roof);
  sash(out, lod, plane(f + 0.44, -1), l - 1.04, roomFloor + 1.05, roomFloor + 1.68, 0.64, colors);
  const [left, right] = [l - 2.47, l - 1.15];
  const stairFront = f - 2.84;
  const stairBack = f + 2.41;
  const lower = Math.max(floor + 0.07, grade([left + 0.6, stairFront]) + 0.18);
  stair(out, lod, [left, right, stairFront, stairBack], Math.min(lower, mid - 0.41), mid, colors);
  box(
    out,
    'trim',
    [left, l + 0.11, stairBack, stairBack + 1.04],
    mid - 0.16,
    mid + 0.075,
    colors.trim,
  );
  entryDoor(out, lod, sideWall(l, -1), stairBack + 0.48, mid, 0.86, 2.13, colors);
}

function draw(out, lod, { outline, floor, wallHeight, roofRise }, grade) {
  const area = bounds(outline);
  const mid = floor + 2.92;
  body(out, lod, area, floor, mid, floor + wallHeight, roofRise, grade);
  returnAndStair(out, lod, area, floor, mid, grade);
}
const asset = compoundModel(
  import.meta.url,
  {
    category: 'house',
    scale: 0.4,
    yaw: 2.8,
    slots: ['brick', 'trim', 'stone', 'glazing', 'door', 'metal'],
    camera: [-13, 12, -20],
    lookAt: [-1.0, 0.65, 0.4],
    brief:
      'No. 2 Staff Quarters at Tai Tam Tuk, a converted red-brick filter house with a flat roof, upper verandah and external stairs.',
    views: [
      { name: 'brick-and-upper-verandah', position: [6.4, 7, -15], lookAt: [0, 0.8, 0.2] },
      {
        name: 'external-stair-and-service-return',
        position: [-16, 7.5, -11],
        lookAt: [-4.2, 0.85, -0.8],
      },
      { name: 'flat-roof-and-return', position: [-14, 14, 10], lookAt: [-1.1, 1.1, 0.5] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

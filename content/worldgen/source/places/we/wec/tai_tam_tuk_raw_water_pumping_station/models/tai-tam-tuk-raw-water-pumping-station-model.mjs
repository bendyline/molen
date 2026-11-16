import {
  pairs,
  palette,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  archedWindow,
  bounds,
  box,
  compoundModel,
  entryDoor,
  face,
  foundation,
  gabledRoof,
  mix,
  panel,
  plane,
  sash,
  sideWall,
} from '../../../../../../../../packages/worldgen/scripts/tai-tam-pumping-compound-geometry.mjs';

const colors = palette({
  brick: 'a37060',
  darkBrick: '916254',
  roof: '746658',
  ridge: '8b796a',
  stone: '938778',
  trim: 'b0a591',
  door: '46534d',
  glass: '394849',
  iron: '52605b',
});

function quoins(out, lod, area, low, high) {
  if (lod === 0) return;
  const [left, right, front, back] = area;
  const courses = lod === 3 ? 12 : 6;
  for (const x of [left, right])
    for (const z of [front, back])
      for (let i = 0; i < courses; i++) {
        const bottom = mix(low + 0.3, high - 0.43, i / courses);
        const width = i % 2 === 0 ? 0.53 : 0.32;
        box(
          out,
          'brick',
          [
            x - (x === left ? 0.055 : width),
            x + (x === left ? width : 0.055),
            z - (z === front ? 0.065 : width),
            z + (z === front ? width : 0.065),
          ],
          bottom,
          bottom + 0.18,
          colors.darkBrick,
        );
      }
}

function bullseye(out, lod, x, facing, y, z) {
  const wall = sideWall(x, facing);
  const n = [8, 12, 16, 24][lod];
  const circle = (radius, depth) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return wall.p(z + radius * Math.cos(a), y + radius * Math.sin(a), depth);
    });
  const inner = circle(0.57, 0.025);
  face(out, 'glazing', inner.slice(0, -1), wall.normal, colors.glass);
  if (lod === 0) return;
  const outer = circle(0.72, 0.05);
  for (const [i, [a, b]] of pairs(inner).entries())
    face(out, 'trim', [a, b, outer[i + 1], outer[i]], wall.normal, colors.trim);
  if (lod > 1)
    panel(out, 'metal', wall, z - 0.037, z + 0.037, y - 0.56, y + 0.56, 0.061, colors.iron);
}

function annex(out, lod, area, floor, wallHeight, roofRise, grade) {
  const [left, right, , back] = area;
  foundation(out, area, floor, grade, colors.stone);
  box(out, 'brick', area, floor, floor + wallHeight, colors.darkBrick);
  gabledRoof(out, lod, area, floor + wallHeight, roofRise, colors.roof, colors.ridge);
  const bays = Math.max(3, Math.round((right - left) / 4.7));
  for (let i = 0; i < bays; i++) {
    const x = mix(left + 1, right - 1, (i + 0.5) / bays);
    sash(out, lod, plane(back, 1), x, floor + 1.21, floor + 3.42, 1.45, colors);
  }
}

function draw(out, lod, { outline, floor, wallHeight, roofRise }, grade) {
  const [left, right, front] = bounds(outline);
  const back = 1.269;
  const main = [left, right, front, back];
  const high = floor + wallHeight;
  foundation(out, main, floor, grade, colors.stone);
  box(out, 'brick', main, floor, high, colors.brick);
  gabledRoof(out, lod, main, high, roofRise, colors.roof, colors.ridge);
  quoins(out, lod, main, floor, high);
  const frontWall = plane(front, -1);
  const backWall = plane(back, 1);
  box(
    out,
    'trim',
    [left - 0.1, right + 0.1, front - 0.12, front + 0.15],
    high - 0.34,
    high - 0.2,
    colors.trim,
  );
  for (const wall of [sideWall(left, -1), sideWall(right, 1)]) {
    for (const z of [-13.7, -8.32, -3.07])
      archedWindow(out, lod, wall, z, floor + 1.45, floor + 4.12, 2.27, 1.12, colors);
  }
  for (const [x, side] of [
    [left - 0.25, -1],
    [right + 0.25, 1],
  ])
    bullseye(out, lod, x, side, high + 1.47, (front + back) / 2);
  for (const x of [-22.6, -14.3, -6.1, 2.0, 10.4, 18.7, 26.3]) {
    archedWindow(out, lod, frontWall, x, floor + 1.43, floor + 4.43, 2.38, 1.16, colors);
    if (lod > 1) {
      panel(
        out,
        'brick',
        frontWall,
        x - 0.135,
        x + 0.135,
        floor + 5.58,
        floor + 5.88,
        0.12,
        colors.darkBrick,
      );
      if (lod === 3)
        panel(
          out,
          'glazing',
          frontWall,
          x - 0.065,
          x + 0.065,
          floor + 0.59,
          floor + 1.06,
          0.047,
          colors.glass,
        );
    }
  }
  for (const x of [16, 22, 28])
    sash(out, lod, backWall, x, floor + 1.65, floor + 4.0, 1.68, colors);
  entryDoor(out, lod, sideWall(left, -1), -0.67, floor, 1.2, 2.45, colors);
  annex(out, lod, [left, -15.918, back - 0.08, 5.937], floor, 5.95, 1.75, grade);
  annex(out, lod, [-15.918, 12.145, back - 0.085, 10.586], floor + 0.31, 6.58, 2.3, grade);
}

const asset = compoundModel(
  import.meta.url,
  {
    category: 'industrial',
    scale: 0.77,
    yaw: 2.62,
    slots: ['brick', 'trim', 'tile', 'ridge', 'stone', 'glazing', 'door', 'metal'],
    camera: [56, 34, -64],
    lookAt: [0, -0.3, -4],
    brief:
      'Tai Tam Tuk Raw Water Pumping Station, with its red-brick engine hall, arched steel windows, tiled gables and attached service wings.',
    views: [
      { name: 'engine-hall-and-arched-windows', position: [17, 10, -46], lookAt: [0, -0.6, -13] },
      { name: 'brick-gable-and-bullseye', position: [-48, 12, -31], lookAt: [-22, 0.8, -10] },
      { name: 'tiled-roofs-and-service-wings', position: [27, 36, 36], lookAt: [0, 0, -3] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

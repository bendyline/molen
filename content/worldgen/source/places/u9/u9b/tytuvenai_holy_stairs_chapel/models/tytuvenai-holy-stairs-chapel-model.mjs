import {
  arch,
  face,
  opening,
  palette,
  panel,
  plane,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  blockBetween,
  churchModel,
  crossAt,
  gable,
  plinth,
  roofCap,
  square,
  wallX,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const c = palette({
  lime: 'e3dfd0',
  trim: 'eee8d6',
  stone: 'a49d91',
  roof: 'a56650',
  metal: '62686b',
  glass: '515858',
  wood: '694f3d',
  iron: '414944',
});

function cornice(out, [l, r, f, b], y) {
  blockBetween(out, 'plaster', [l - 0.19, r + 0.19, f - 0.19, b + 0.19], y - 0.27, y, c.trim);
}

function buttress(out, lod, x, z, floor, side) {
  const u = x + side * 0.72;
  const y = floor + 0.94,
    center = z + 0.35;
  const left = side < 0 ? u : x,
    right = side < 0 ? x : u;
  blockBetween(out, 'stone', [left, right, z, z + 0.7], floor - 0.2, floor + 0.08, c.stone);
  for (const v of [z, z + 0.7]) {
    face(
      out,
      'plaster',
      [
        [x, floor, v],
        [u, floor, v],
        [x, y, v],
      ],
      [0, 0, v < center ? -1 : 1],
      c.lime,
    );
  }
  face(
    out,
    'plaster',
    [
      [u, floor, z],
      [u, floor, z + 0.7],
      [x, y, z + 0.7],
      [x, y, z],
    ],
    [side, 1, 0],
    c.lime,
  );
  if (lod > 1)
    blockBetween(
      out,
      'plaster',
      [Math.min(x, u * 0.16 + x * 0.84), Math.max(x, u * 0.16 + x * 0.84), z, z + 0.7],
      y - 0.16,
      y - 0.014,
      c.trim,
    );
}

function draw(out, lod, { outline, floor, wallHeight, roofRise, towerCornice, towerTip }, grade) {
  const base = [-4.012, 4.014, -9.054, 9.052];
  const eave = floor + wallHeight;
  const high = floor + towerCornice;
  const towerZ = -5.5;
  const tower = [-3.79, 3.79, -9.05, -1.91];
  plinth(out, outline, floor, grade, c.stone);
  blockBetween(out, 'plaster', base, floor + 0.14, eave, c.lime);
  blockBetween(out, 'plaster', tower, eave - 0.04, high, c.lime);
  cornice(out, base, eave);
  cornice(out, tower, high);
  gable(out, [0, -2.12], [0, 9.17], 4.17, eave, roofRise, c.roof, 'plaster', c.lime);
  const cap = [0, towerZ];
  const tip = floor + towerTip;
  const steps =
    lod > 1
      ? [
          [high, 3.93],
          [high + 0.86, 3.0],
          [high + 1.86, 1.94],
          [tip - 0.88, 0.51],
          [tip - 0.55, 0.052],
        ]
      : [
          [high, 3.93],
          [high + 1.78, 2.06],
          [tip - 0.54, 0.055],
        ];
  roofCap(out, 'metal', cap, steps, square, c.metal);
  crossAt(out, [0, tip - 0.63, towerZ], 0.88, 0.62, c.iron);
  crossAt(out, [0, eave + roofRise, 8.98], 0.8, 0.55, c.iron);
  for (const side of [-1, 1]) {
    const facade = wallX(side * 4.015, side);
    const tall = wallX(side * 3.79, side);
    for (const z of [-7.96, -3.0])
      panel(out, 'plaster', tall, z - 0.16, z + 0.16, eave + 0.04, high - 0.26, 0.09, c.trim);
    opening(
      out,
      tall,
      -4.56,
      -3.89,
      eave + 0.84,
      high - 0.69,
      'plaster',
      c.glass,
      'glass',
      c.trim,
      lod,
      0.04,
    );
    for (const z of [1.05, 3.49, 5.94]) {
      arch(
        out,
        facade,
        z,
        floor + 1.1,
        floor + 2.62,
        0.34,
        0.19,
        0.035,
        lod,
        { inner: c.glass, trim: c.trim, width: 0.071 },
        { inner: 'glass', trim: 'plaster' },
      );
    }
    buttress(out, lod, side * 4.012, -8.45, floor, side);
  }
  const door = wallX(-4.017, -1);
  arch(
    out,
    door,
    -6.27,
    floor + 0.09,
    floor + 1.68,
    0.44,
    0.32,
    0.042,
    lod,
    { inner: c.wood, trim: c.trim, width: 0.085 },
    { inner: 'wood', trim: 'plaster' },
  );
  const south = plane(9.067, 1);
  arch(
    out,
    south,
    0.05,
    floor + 0.12,
    floor + 2.1,
    0.65,
    0.44,
    0.045,
    lod,
    { inner: c.wood, trim: c.trim, width: 0.095 },
    { inner: 'wood', trim: 'plaster' },
  );
  if (lod > 0)
    for (const z of [-8.2, -2.25, 1.93, 7.92]) {
      panel(out, 'plaster', door, z - 0.095, z + 0.095, floor + 0.31, eave - 0.27, 0.098, c.trim);
    }
}

const asset = churchModel(
  import.meta.url,
  {
    slots: ['plaster', 'stone', 'tile', 'metal', 'glass', 'wood'],
    scale: 0.42,
    yaw: -0.84,
    camera: [-20, 16, 22],
    lookAt: [0, 4.2, -1.2],
    sun: [-350, 470, 290],
    brief:
      'Baroque Holy Stairs Chapel in the Tytuvėnai courtyard, with a white masonry body, tall hipped-roof sanctuary bay and low tiled extension.',
    views: [
      { name: 'tall-sanctuary-and-low-body', position: [-15, 8, 19], lookAt: [0, 4.55, -2.2] },
      {
        name: 'buttresses-and-historical-roof-profile',
        position: [-11, 11, -18],
        lookAt: [0, 4.2, -4.4],
      },
      { name: 'shallow-arches-and-pilasters', position: [14, 7, 8], lookAt: [0, 3.4, 2.2] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

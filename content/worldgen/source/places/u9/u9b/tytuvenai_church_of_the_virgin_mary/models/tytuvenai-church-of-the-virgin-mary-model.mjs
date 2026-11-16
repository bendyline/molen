import {
  arch,
  at,
  block,
  face,
  mix,
  opening,
  palette,
  panel,
  plane,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  bevelSquare,
  blockBetween,
  churchModel,
  crossAt,
  gable,
  plinth,
  pointed,
  roofCap,
  wallX,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const colors = palette({
  lime: 'e3d8bf',
  trim: 'eddfbf',
  brick: 'a96a51',
  stone: 'a39a84',
  tile: 'ae674e',
  glass: '4d5455',
  bell: '53514b',
  wood: '644a3a',
  cap: '8c6651',
  iron: '4b5048',
  accent: 'c5a268',
});

function roundOpening(out, lod, wall, u, base, spring, w, r, kind = 'glass') {
  arch(
    out,
    wall,
    u,
    base,
    spring,
    w / 2,
    r,
    0.046,
    lod,
    { inner: colors[kind], trim: colors.trim, width: 0.13 },
    { inner: kind, trim: 'plaster' },
  );
}

function eastEnd(out, lod, outline, wallHeight, rise, floor) {
  const center = -0.765,
    xEnd = 16.345,
    front = 4.775,
    aisle = floor + 9.42;
  const nave = [-20.48, front, -6.1, 5.38];
  blockBetween(out, 'brick', nave, floor + 0.2, wallHeight, colors.brick);
  const eastern = outline.slice(2, 15);
  shell(out, eastern, () => floor + 0.18, wallHeight, { wall: 'brick', color: colors.brick });
  const chancel = [northZ(eastern), southZ(eastern)];
  gable(
    out,
    [-20.61, center],
    [xEnd, center],
    5.96,
    wallHeight + 0.015,
    rise,
    colors.tile,
    'brick',
    colors.brick,
  );
  for (let i = 1; i < 11; i++) {
    const a = eastern[i],
      b = eastern[i + 1];
    face(
      out,
      'tile',
      [at(a, wallHeight), at(b, wallHeight), [xEnd, wallHeight + rise, center]],
      [0, 1, 0],
      colors.tile,
    );
  }
  for (const side of [-1, 1]) {
    const inner = side < 0 ? nave[2] : nave[3],
      outer = side < 0 ? -11.31 : 10.475;
    face(
      out,
      'tile',
      [
        [-15.07, aisle, outer],
        [front, aisle, outer],
        [front, aisle + 2.78, inner],
        [-15.07, aisle + 2.78, inner],
      ],
      [0, 1, 0],
      colors.tile,
    );
    for (const x of [-12.25, -6.78, -1.25, 2.55]) {
      pointed(out, lod, plane(outer, side), x, floor + 2.95, floor + 6.3, 1.69, 0.95, colors);
      if (lod > 0)
        pointed(
          out,
          lod,
          plane(inner, side),
          x + 0.52,
          floor + 11.85,
          floor + 13.32,
          1.18,
          0.61,
          colors,
        );
    }
    const wall = plane(chancel[side < 0 ? 0 : 1], side);
    for (const x of [8.06, 13.08])
      pointed(out, lod, wall, x, floor + 4.7, floor + 8.67, 1.92, 1.24, colors);
    if (lod > 0)
      for (const x of [6.11, 11.03, 15.6]) {
        const minZ = side < 0 ? wall.p(x, 0)[2] - 0.65 : wall.p(x, 0)[2];
        block(out, 'brick', x, floor + 0.2, minZ, 0.45, 6.1, 0.65, colors.brick);
      }
  }
  pointed(out, lod, wallX(22.71, 1), center, floor + 4.62, floor + 8.22, 1.65, 1.04, colors);
}

const northZ = (outline) => outline[1][1] + 0.03;
const southZ = (outline) => outline.at(-1)[1] + 0.026;

function cornice(out, area, y, color, major = true) {
  const [l, r, f, b] = area;
  const off = major ? 0.32 : 0.18;
  blockBetween(out, 'plaster', [l - off, r + off, f - off, b + off], y - 0.27, y, color);
}

function tier(out, lod, area, bottom, top) {
  const [l, r, n, s] = area;
  blockBetween(out, 'plaster', area, bottom, top, colors.lime);
  cornice(out, area, top, colors.trim);
  const w = r - l,
    zlen = s - n;
  for (const side of [-1, 1]) {
    const front = wallX(side < 0 ? l : r, side);
    const end = plane(side < 0 ? n : s, side);
    roundOpening(
      out,
      lod,
      front,
      (n + s) / 2,
      bottom + (top - bottom) * 0.19,
      top - 1.68,
      zlen * 0.33,
      0.7,
    );
    roundOpening(
      out,
      lod,
      end,
      (l + r) / 2,
      bottom + (top - bottom) * 0.19,
      top - 1.68,
      w * 0.32,
      0.68,
    );
    if (lod > 0)
      for (const [wall, a, b] of [
        [front, n, s],
        [end, l, r],
      ]) {
        for (const p of [a + 0.27, b - 0.56])
          panel(out, 'plaster', wall, p, p + 0.29, bottom + 0.24, top - 0.29, 0.14, colors.trim);
      }
  }
}

function towers(out, lod, floor, capHeight, tip) {
  for (const z of [-7.36, 6.56]) {
    const x = -17.67;
    const bottom = [x - 3.2, x + 3.58, z - 3.31, z + 3.31];
    const mid = [x - 2.98, x + 3.11, z - 3.0, z + 3.0];
    const high = [x - 2.43, x + 2.37, z - 2.45, z + 2.45];
    blockBetween(out, 'plaster', bottom, floor + 0.06, floor + 14.14, colors.lime);
    cornice(out, bottom, floor + 14.16, colors.trim);
    tier(out, lod, mid, floor + 14.15, floor + 21.21);
    tier(out, lod, high, floor + 21.21, capHeight);
    const levels =
      lod === 0
        ? [
            [capHeight, 2.43],
            [capHeight + 1.1, 1.54],
            [tip - 1.24, 0.25],
          ]
        : [
            [capHeight, 2.43],
            [capHeight + 0.34, 2.29],
            [capHeight + 0.97, 1.52],
            [capHeight + 1.7, 1.04],
            [capHeight + 2.35, 0.69],
            [tip - 1.25, 0.24],
          ];
    roofCap(out, 'metal', [x, z], levels, bevelSquare, colors.cap);
    roofCap(
      out,
      'metal',
      [x, z],
      [
        [tip - 1.32, 0.41],
        [tip - 0.8, 0.31],
        [tip - 0.56, 0.16],
      ],
      bevelSquare,
      colors.accent,
    );
    crossAt(out, [x, tip - 0.6, z], 0.99, 0.72, colors.iron);
    const w = wallX(bottom[0], -1);
    roundOpening(out, lod, w, z, floor + 4.8, floor + 7.25, 1.05, 0.55);
    if (lod > 1)
      for (const p of [z - 2.75, z + 2.46])
        panel(out, 'plaster', w, p, p + 0.28, floor + 0.6, floor + 13.86, 0.14, colors.trim);
  }
}

function westFront(out, lod, floor) {
  const left = -20.86;
  const wall = wallX(left, -1);
  blockBetween(out, 'plaster', [left, -18.75, -5.4, 5.03], floor + 0.08, floor + 15.2, colors.lime);
  for (const [low, high, width] of [
    [14.8, 20.1, 5.2],
    [19.85, 21.72, 3.63],
    [21.35, 22.53, 2.35],
    [22.3, 23.04, 1.29],
  ]) {
    blockBetween(
      out,
      'plaster',
      [left + 0.04, -18.98, -0.46 - width, -0.46 + width],
      floor + low,
      floor + high,
      colors.lime,
    );
    panel(
      out,
      'plaster',
      wall,
      -0.46 - width,
      -0.46 + width,
      floor + high - 0.32,
      floor + high,
      0.12,
      colors.trim,
    );
  }
  roundOpening(out, lod, wall, -0.47, floor + 8.62, floor + 11.56, 2.36, 1.08);
  roundOpening(out, lod, wall, -0.47, floor + 15.54, floor + 17.62, 1.27, 0.65);
  for (const z of [-3.85, 2.9]) {
    panel(out, 'plaster', wall, z - 0.18, z + 0.18, floor + 4.0, floor + 14.35, 0.19, colors.trim);
    if (lod > 1)
      opening(
        out,
        wall,
        z - 0.35,
        z + 0.35,
        floor + 8.44,
        floor + 10.48,
        'plaster',
        colors.lime,
        'plaster',
        colors.trim,
        lod,
        0.034,
      );
  }
  const apron = [-23.14, -20.63, -3.74, 2.67];
  blockBetween(out, 'plaster', apron, floor + 0.03, floor + 4.78, colors.lime);
  cornice(out, apron, floor + 4.8, colors.trim);
  const portico = wallX(-23.16, -1);
  face(
    out,
    'plaster',
    [portico.p(-3.86, floor + 4.8), portico.p(2.77, floor + 4.8), portico.p(-0.54, floor + 6.52)],
    portico.normal,
    colors.lime,
  );
  gable(
    out,
    [-23.21, -0.535],
    [-20.62, -0.535],
    3.3,
    floor + 4.83,
    1.7,
    colors.tile,
    'plaster',
    colors.lime,
  );
  roundOpening(out, lod, portico, -0.55, floor + 0.19, floor + 2.94, 2.12, 0.86, 'wood');
  for (const z of [-3.2, 2.12])
    panel(out, 'plaster', portico, z, z + 0.34, floor + 0.18, floor + 4.52, 0.14, colors.trim);
  for (let i = 0; i < (lod === 0 ? 1 : 3); i++) {
    const n = lod === 0 ? 1 : 3;
    blockBetween(
      out,
      'stone',
      [-24.02 + (i * 0.45) / n, -23.08, -3.42, 2.42],
      floor - 0.19,
      mix(floor - 0.04, floor + 0.18, (i + 1) / n),
      colors.stone,
    );
  }
  crossAt(out, [-20.9, floor + 23.02, -0.46], 1.02, 0.68, colors.iron);
}

function draw(out, lod, { outline, floor, wallHeight, roofRise, towerCornice, towerTip }, grade) {
  plinth(out, outline, floor, grade, colors.stone);
  shell(out, outline, () => floor + 0.16, floor + 9.42, { wall: 'brick', color: colors.brick });
  eastEnd(out, lod, outline, floor + wallHeight, roofRise, floor);
  towers(out, lod, floor, floor + towerCornice, floor + towerTip);
  westFront(out, lod, floor);
}

const asset = churchModel(
  import.meta.url,
  {
    slots: ['plaster', 'brick', 'stone', 'tile', 'metal', 'glass', 'wood'],
    scale: 0.62,
    yaw: -1.61,
    camera: [-63, 34, -47],
    lookAt: [-3, 14, 0],
    sun: [-400, 510, -230],
    brief:
      'Twin Baroque towers and a white west facade identify the Church of the Blessed Virgin Mary at Tytuvėnai. The high red-tile basilica roof and brick chancel are visible behind them.',
    views: [
      { name: 'twin-towers-and-west-vestibule', position: [-63, 18, -3], lookAt: [-18, 16, 0] },
      {
        name: 'pointed-brick-aisle-and-semicircular-chancel',
        position: [49, 26, -35],
        lookAt: [7.4, 10, 0],
      },
      {
        name: 'stepped-tower-roof-and-central-pediment',
        position: [-43, 38, 10],
        lookAt: [-17, 23, 0],
      },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;

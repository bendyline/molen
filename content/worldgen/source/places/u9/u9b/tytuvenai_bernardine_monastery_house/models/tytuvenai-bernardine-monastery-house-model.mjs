import {
  arch,
  areaSign,
  at,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  blockBetween,
  churchModel,
  gable,
  plinth,
  wallX,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const c = palette({
  brick: 'a86c51',
  brickTrim: 'b87c5e',
  plaster: 'e0d3bb',
  trim: 'd3c3a6',
  tile: 'a6614a',
  stone: 'a09682',
  glass: '54605c',
  door: '694f3b',
});

function fenestration(out, lod, outline, floor, eave) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, sign);
    if (wall.length < 5.1) continue;
    const count = Math.max(1, Math.round(wall.length / 4.3)),
      step = wall.length / count;
    if (lod > 0) panel(out, 'brick', wall, 0, wall.length, eave - 0.34, eave, 0.13, c.brickTrim);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * step;
      for (const low of [floor + 1.15, floor + 4.56]) {
        const base = low,
          top = low + 1.54;
        arch(
          out,
          wall,
          u,
          base,
          top,
          0.53,
          0.19,
          0.05,
          lod,
          { inner: c.glass, trim: c.trim, width: 0.114 },
          { inner: 'glass', trim: 'plaster' },
        );
        if (lod > 1)
          panel(out, 'plaster', wall, u - 0.033, u + 0.033, base, top + 0.14, 0.081, c.trim);
      }
    }
  }
}

function houseWings(out, lod, wings, floor, grade) {
  for (const wing of wings) {
    const eave = floor + wing.eave;
    const [start, end, width] = wing.roof;
    plinth(out, wing.outline, floor, grade, c.stone);
    shell(out, wing.outline, () => floor + 0.16, eave, { wall: 'brick', color: c.brick });
    gable(out, start, end, width, eave + 0.015, wing.rise, c.tile, 'brick', c.brick);
    fenestration(out, lod, wing.outline, floor, eave);
  }
}

function westGable(out, lod, floor) {
  const west = -21.38,
    east = -13.1,
    north = 4.84,
    south = 13.02,
    mid = 8.93;
  const eave = floor + 7.74;
  blockBetween(out, 'brick', [west, east, north, south], floor + 0.13, eave, c.brick);
  gable(out, [west - 0.12, mid], [east, mid], 4.22, eave, 3.65, c.tile, 'brick', c.brick);
  const wall = wallX(west - 0.19, -1);
  for (const [low, high, width] of [
    [7.03, 9.26, 4.2],
    [9.11, 10.29, 2.81],
    [10.17, 11.47, 1.65],
  ]) {
    blockBetween(
      out,
      'brick',
      [west - 0.16, west + 0.23, mid - width, mid + width],
      floor + low,
      floor + high,
      c.brick,
    );
    panel(
      out,
      'plaster',
      wall,
      mid - width - 0.12,
      mid + width + 0.12,
      floor + high - 0.21,
      floor + high,
      0.075,
      c.trim,
    );
    const bottom = floor + low + 0.2;
    arch(
      out,
      wall,
      mid,
      bottom,
      floor + high - 0.53,
      Math.min(0.46, width * 0.25),
      0.22,
      0.059,
      lod,
      { inner: c.plaster, trim: c.trim, width: 0.084 },
      { inner: 'plaster', trim: 'brick' },
    );
  }
  const baseWall = wallX(west, -1);
  arch(
    out,
    baseWall,
    mid,
    floor + 0.18,
    floor + 2.33,
    0.83,
    0.37,
    0.045,
    lod,
    { inner: c.door, trim: c.trim, width: 0.11 },
    { inner: 'wood', trim: 'plaster' },
  );
  for (const z of [mid - 2.34, mid + 2.34])
    opening(
      out,
      baseWall,
      z - 0.51,
      z + 0.51,
      floor + 4.28,
      floor + 6.14,
      'plaster',
      c.glass,
      'glass',
      c.trim,
      lod,
      0.05,
    );
}

function glazedLink(out, lod, outline, floor, grade) {
  const [a, b, southEast, southWest] = outline;
  const lo = floor + 3.08,
    hi = floor + 3.97;
  plinth(out, outline, floor, grade, c.stone);
  shell(out, outline, () => floor + 0.19, lo, { wall: 'plaster', color: c.plaster });
  face(
    out,
    'tile',
    [at(a, hi), at(b, hi), at(southEast, lo), at(southWest, lo)],
    [0, 1, 0],
    c.tile,
  );
  const facade = edge(southWest, southEast, -1),
    count = lod === 0 ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const x = (i * facade.length) / count,
      right = ((i + 1) * facade.length) / count;
    opening(
      out,
      facade,
      x + 0.18,
      right - 0.16,
      floor + 0.99,
      floor + 2.84,
      'plaster',
      c.glass,
      'glass',
      c.trim,
      lod,
      0.06,
    );
  }
  if (lod > 0) panel(out, 'plaster', facade, 0, facade.length, lo - 0.18, lo, 0.09, c.trim);
}

function draw(out, lod, { wings, link, floor }, grade) {
  houseWings(out, lod, wings, floor, grade);
  westGable(out, lod, floor);
  glazedLink(out, lod, link, floor, grade);
}

const asset = churchModel(
  import.meta.url,
  {
    slots: ['brick', 'plaster', 'tile', 'stone', 'glass', 'wood'],
    scale: 0.51,
    yaw: -0.68,
    camera: [-47, 37, 44],
    lookAt: [0, 4, 0],
    sun: [-450, 520, 300],
    brief:
      'Three two-storey brick wings wrap around the smaller cloister court of Tytuvėnai’s Bernardine monastery. A stepped west gable and a low glazed link distinguish the house from the churchyard arcade.',
    views: [
      { name: 'brick-wings-and-courtyard', position: [31, 44, 33], lookAt: [0, 3, 1] },
      { name: 'stepped-west-gable-and-entrance', position: [-35, 11, 18], lookAt: [-15, 5, 4] },
      { name: 'glazed-link-and-inner-court', position: [-5, 21, -26], lookAt: [0, 3, -1] },
    ],
  },
  draw,
);
asset.model.sourceLicense =
  'Independent reconstruction from written Lithuanian heritage records, OpenStreetMap geometry and open terrain tiles.';
export const { model, skyline, district, street, closeup } = asset;

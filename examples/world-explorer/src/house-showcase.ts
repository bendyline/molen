import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';

/** Repeatable residential block for walking and material review with ?synthetic=1&houses=1. */
export function houseShowcaseTile(size: number): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  const point = (x: number, z: number): [number, number] => [
    0.5 + x / size,
    0.5 + (z - 120) / size,
  ];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 28;
    tile.buildings.push({
      id: `house-showcase:${i}`,
      class: 'building',
      subclass: 'house',
      height: i === 2 ? 5.8 : 9,
      levels: i === 2 ? 1 : 2,
      polygons: [{ outer: [point(x - 7, -7), point(x + 7, -7), point(x + 7, 7), point(x - 7, 7)] }],
    });
  }
  tile.transportation.push({
    class: 'minor_road',
    width: 5,
    lines: [[point(-52, 16), point(52, 16)]],
  });
  tile.landcover.push({
    class: 'residential',
    polygons: [{ outer: [point(-52, -20), point(52, -20), point(52, 25), point(-52, 25)] }],
  });
  return tile;
}

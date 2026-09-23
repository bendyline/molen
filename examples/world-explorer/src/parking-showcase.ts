import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
/** Repeatable parking lot, aisles and a wall for driving review with ?synthetic=1&parking=1. */
export function parkingShowcaseTile(size: number): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  const point = (x: number, z: number): [number, number] => [
    0.5 + x / size,
    0.5 + (z - 120) / size,
  ];
  tile.landcover.push({
    id: 'vehicle-demo-lot',
    class: 'parking',
    polygons: [{ outer: [point(-46, -34), point(46, -34), point(46, 36), point(-46, 36)] }],
  });
  tile.transportation.push({
    class: 'minor_road',
    subclass: 'service',
    width: 7,
    lines: [[point(-60, 0), point(60, 0)]],
  });
  tile.buildings.push({
    id: 'vehicle-demo-garage',
    class: 'building',
    subclass: 'commercial',
    height: 5,
    polygons: [{ outer: [point(-35, -48), point(35, -48), point(35, -38), point(-35, -38)] }],
  });
  return tile;
}

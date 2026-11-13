import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';

interface ShowcaseBuilding {
  id: string;
  /** Center, relative to the tile's center, in meters. */
  x: number;
  z: number;
  width: number;
  depth: number;
  height?: number;
  /** A POI sharing the footprint's id, as a mapped amenity on the building itself would. */
  poi?: string;
}

/** One of everything the classifier knows, in rows either side of a street. */
export const USE_SHOWCASE: readonly ShowcaseBuilding[] = [
  { id: 'office', x: -200, z: -130, width: 44, depth: 36, height: 30 },
  { id: 'skyscraper', x: -130, z: -130, width: 42, depth: 42, height: 160 },
  { id: 'hotel', x: -50, z: -130, width: 60, depth: 24, height: 40, poi: 'hotel' },
  { id: 'hospital', x: 40, z: -130, width: 80, depth: 44, height: 30, poi: 'hospital' },
  { id: 'civic', x: 125, z: -130, width: 40, depth: 30, height: 14, poi: 'townhall' },
  { id: 'apartments', x: 195, z: -130, width: 36, depth: 22, height: 18, poi: 'apartment' },
  { id: 'school', x: -190, z: -40, width: 70, depth: 40, height: 10, poi: 'school' },
  { id: 'church', x: -125, z: -40, width: 18, depth: 36, height: 12, poi: 'place_of_worship' },
  { id: 'theatre', x: -80, z: -40, width: 28, depth: 36, height: 14, poi: 'theatre' },
  { id: 'cinema', x: -35, z: -40, width: 30, depth: 34, height: 12, poi: 'cinema' },
  { id: 'museum', x: 30, z: -40, width: 60, depth: 44, height: 14, poi: 'museum' },
  { id: 'sports', x: 100, z: -40, width: 36, depth: 34, height: 10, poi: 'sports_centre' },
  { id: 'station', x: 170, z: -40, width: 60, depth: 26, height: 12, poi: 'station' },
  { id: 'fire', x: 225, z: -40, width: 28, depth: 22, height: 8, poi: 'fire_station' },
  { id: 'mall', x: -80, z: 90, width: 150, depth: 120, height: 14, poi: 'mall' },
];

/** The street of building uses for review, with ?synthetic=1&uses=1. */
export function useShowcaseTile(size: number): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  const point = (x: number, z: number): [number, number] => [0.5 + x / size, 0.5 + z / size];
  tile.landcover.push({
    id: 'use-demo-commercial',
    class: 'commercial',
    polygons: [
      { outer: [point(-240, -170), point(-100, -170), point(-100, -90), point(-240, -90)] },
    ],
  });
  for (const z of [-85, 20])
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'residential',
      width: 9,
      lines: [[point(-260, z), point(260, z)]],
    });
  for (const b of USE_SHOWCASE) {
    const id = `use-demo-${b.id}`;
    const [x0, z0, x1, z1] = [
      b.x - b.width / 2,
      b.z - b.depth / 2,
      b.x + b.width / 2,
      b.z + b.depth / 2,
    ];
    tile.buildings.push({
      id,
      class: 'building',
      ...(b.height !== undefined ? { height: b.height } : {}),
      polygons: [{ outer: [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)] }],
    });
    if (b.poi) tile.pois = [...(tile.pois ?? []), { id, class: b.poi, point: point(b.x, b.z) }];
  }
  return tile;
}

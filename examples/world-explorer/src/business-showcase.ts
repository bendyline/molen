/** Repeatable art-review block: original stores, expanded U.S. retail, and mapped furniture. */
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { BUSINESS_PROFILES } from '@bendyline/molen-worldgen-earth/kernel';
import { appendRetailExpansion } from './retail-expansion-showcase';
export function businessShowcaseTile(size: number): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  const point = (x: number, z: number): [number, number] => [
    0.5 + x / size,
    0.5 + (z - 120) / size,
  ];
  tile.pois = [];
  BUSINESS_PROFILES.slice(0, 8).forEach((profile, i) => {
    const x = ((i % 4) - 1.5) * 36,
      z = Math.floor(i / 4) * 42;
    const id = `showcase:${profile.id}`;
    tile.buildings.push({
      id,
      class: 'building',
      height: 5.8,
      polygons: [
        {
          outer: [
            point(x - 13, z - 9),
            point(x + 13, z - 9),
            point(x + 13, z + 9),
            point(x - 13, z + 9),
          ],
        },
      ],
    });
    tile.pois?.push({
      id,
      name: profile.aliases[0],
      class: profile.categories[0] ?? 'retail',
      brandId: profile.brandIds[0],
      point: point(x, z + 5),
    });
  });
  tile.buildings.push({
    id: 'shared-strip',
    class: 'building',
    height: 5.4,
    polygons: [{ outer: [point(-48, 77), point(48, 77), point(48, 95), point(-48, 95)] }],
  });
  for (const [i, profile] of [
    BUSINESS_PROFILES[0],
    BUSINESS_PROFILES[4],
    BUSINESS_PROFILES[6],
  ].entries())
    if (profile)
      tile.pois.push({
        id: `tenant:${profile.id}`,
        name: profile.aliases[0],
        class: profile.categories[0] ?? 'retail',
        point: point((i - 1) * 30, 91),
      });
  for (const z of [20, 63, 105])
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'service',
      width: 7,
      lines: [[point(-95, z), point(95, z)]],
    });
  tile.landcover.push({
    class: 'commercial',
    polygons: [{ outer: [point(-95, -25), point(95, -25), point(95, 125), point(-95, 125)] }],
  });
  for (const [i, kind] of [
    'street_lamp',
    'bench',
    'bicycle_parking',
    'charging_station',
    'tree',
  ].entries()) {
    tile.pois.push({
      id: `prop:${kind}`,
      class: kind,
      point: point(-24 + i * 12, 110),
      ...(kind === 'tree' ? { height: 7, crownDiameter: 4 } : {}),
      ...(kind === 'charging_station' ? { name: 'Tesla Supercharger' } : {}),
    });
  }
  appendRetailExpansion(tile, point);
  return tile;
}

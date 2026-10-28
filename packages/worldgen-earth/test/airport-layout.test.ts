import {
  createEmptyTerrainSemanticTile,
  webMercatorScaleAtLatitude,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import { expect, it } from 'vitest';
import { createRegionResolver } from '../src/kernel/region';
import { semanticTileToBatch } from '../src/kernel/semantic-adapter';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

it('renders a mapped Seattle hangar as a hangar rather than retail or housing', async () => {
  const pack = await loadDefaultPack(),
    atlas = await loadDefaultAtlas();
  const scale = webMercatorScaleAtLatitude(47.53);
  const [x, z] = wgs84ToWebMercator(-122.3, 47.53);
  const tile = createEmptyTerrainSemanticTile();
  tile.buildings.push({
    id: 1,
    class: 'hangar',
    height: 10,
    polygons: [
      {
        outer: [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.8, 0.8],
          [0.2, 0.8],
        ],
      },
    ],
  });
  tile.landcover.push({
    class: 'aerodrome',
    density: 0,
    polygons: [
      {
        outer: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      },
    ],
  });
  const batch = semanticTileToBatch(
    tile,
    {
      level: 15,
      x: 0,
      z: 0,
      originX: x * scale,
      originZ: z * scale,
      size: 100,
      metersPerUnit: scale,
      levelBelowMax: 0,
    },
    { pack, atlas, regions: createRegionResolver(atlas, { metersPerUnit: scale }) },
  );
  expect(batch.buildings[0]?.style).toBe('molen.worldgen.airport.hangar');
});

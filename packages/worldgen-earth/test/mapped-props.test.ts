/** A host's props (map overrides) among the mapped ones: which levels place them, and how. */
import {
  createEmptyTerrainSemanticTile,
  type TerrainPoiFeature,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import {
  MAP_OVERRIDE_COLOR_TAG,
  MAP_OVERRIDE_MODEL_TAG,
  MAP_OVERRIDE_PROP_CLASS,
  MAP_OVERRIDE_SCALE_TAG,
  MAP_OVERRIDE_TAG,
  mapOverrideFeatureId,
} from '../src/kernel/map-override-tags';
import {
  mappedPropExclusions,
  mappedPropRequests,
  overridePropRequests,
} from '../src/kernel/mapped-props';
import type { TileGeometry } from '../src/kernel/semantic-adapter';
import { PLACES } from './helpers/pack';

const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 100,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const coarser = (levelBelowMax: number): TileGeometry => ({ ...geom, levelBelowMax });

/** A host's prop as the tile edit injects it. */
function hostPoi(
  local: string,
  fields: Omit<TerrainPoiFeature, 'id' | 'tags'>,
  tags: Record<string, string> = {},
): TerrainPoiFeature {
  return {
    id: mapOverrideFeatureId('lot', local),
    ...fields,
    tags: { [MAP_OVERRIDE_TAG]: 'lot', ...tags },
  };
}
function tileWith(pois: TerrainPoiFeature[]): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.pois = pois;
  return tile;
}

describe('props a map override places', () => {
  it('places its trees and furniture one level coarser than mapped ones', () => {
    const tile = tileWith([
      { id: 1, class: 'tree', point: [0.2, 0.2] },
      { id: 2, class: 'bench', point: [0.3, 0.2], heading: 1.2 },
      hostPoi('oak', { class: 'tree', point: [0.2, 0.6], height: 12, crownDiameter: 6 }),
      hostPoi('seat', { class: 'bench', point: [0.3, 0.6], heading: 0.5 }),
      hostPoi('lamp', { class: 'street_lamp', point: [0.4, 0.6], heading: 0, height: 3.6 }),
      hostPoi('rack', { class: 'bicycle_parking', point: [0.5, 0.6], heading: 0 }),
      hostPoi('charger', { class: 'charging_station', point: [0.6, 0.6], heading: 0 }),
      // Buffered copies from the tiles beside this one: theirs to place.
      hostPoi('east', { class: 'bench', point: [1, 0.6], heading: 0 }),
      hostPoi('west', { class: 'tree', point: [-0.01, 0.6] }),
    ]);
    const finest = mappedPropRequests(tile, geom, true, PLACES.landmarks);
    expect(finest.map((request) => request.identity)).toEqual([
      'poi:1',
      'poi:2',
      'poi:override:lot:oak',
      'poi:override:lot:seat',
      'poi:override:lot:lamp',
      'poi:override:lot:rack',
      'poi:override:lot:charger',
    ]);
    const next = mappedPropRequests(tile, coarser(1), true, PLACES.landmarks);
    // The same requests, model for model, as on the finest level; the mapped ones are gone.
    expect(next).toEqual(finest.slice(2));
    expect(next.map((request) => request.model)).toEqual([
      'builtin:tree.mapped.broadleaf',
      'builtin:bench',
      'builtin:street_lamp',
      'builtin:bike_rack',
      'builtin:charger',
    ]);
    expect(next[0]?.scale).toEqual([6, 12, 6]);
    expect(next[1]?.yaw).toBe(0.5);
    expect(next[2]?.scale).toEqual([1, 0.5, 1]);
    expect(mappedPropRequests(tile, coarser(2), true, PLACES.landmarks)).toEqual([]);
    // As for mapped objects: trees with the scatter pass, furniture where the library holds it.
    expect(
      mappedPropRequests(tile, coarser(1), false, PLACES.landmarks).map((r) => r.identity),
    ).not.toContain('poi:override:lot:oak');
    expect(
      mappedPropRequests(tile, coarser(1), true, undefined).map((request) => request.identity),
    ).toEqual(['poi:override:lot:oak']);
  });

  it('places a model named by ref, with the scale, tint and heading its tags carry', () => {
    const tile = tileWith([
      { id: 1, class: 'bench', point: [0.3, 0.2] },
      hostPoi(
        'kiosk',
        { class: MAP_OVERRIDE_PROP_CLASS, point: [0.25, 0.75], heading: 1.5 },
        {
          [MAP_OVERRIDE_MODEL_TAG]: 'explorer.kiosk',
          [MAP_OVERRIDE_SCALE_TAG]: '2,3,0.5',
          [MAP_OVERRIDE_COLOR_TAG]: '#ff8000',
        },
      ),
      hostPoi(
        'rock',
        { class: MAP_OVERRIDE_PROP_CLASS, point: [0.5, 0.5] },
        {
          [MAP_OVERRIDE_MODEL_TAG]: 'builtin:rock',
          // Neither is usable: the model keeps its own size and colors.
          [MAP_OVERRIDE_SCALE_TAG]: '2,0',
          [MAP_OVERRIDE_COLOR_TAG]: 'orange',
        },
      ),
      // No model to place, a neighbour's buffered copy, and the same prop held twice.
      hostPoi('empty', { class: MAP_OVERRIDE_PROP_CLASS, point: [0.6, 0.6] }),
      hostPoi(
        'east',
        { class: MAP_OVERRIDE_PROP_CLASS, point: [1, 0.5] },
        { [MAP_OVERRIDE_MODEL_TAG]: 'builtin:rock' },
      ),
      hostPoi(
        'rock',
        { class: MAP_OVERRIDE_PROP_CLASS, point: [0.5, 0.5] },
        { [MAP_OVERRIDE_MODEL_TAG]: 'builtin:rock' },
      ),
    ]);
    const requests = overridePropRequests(tile, geom);
    expect(requests).toEqual([
      {
        identity: 'poi:override:lot:kiosk',
        model: 'explorer.kiosk',
        at: [25, 75],
        yaw: 1.5,
        scale: [2, 3, 0.5],
        color: [1, 128 / 255, 0],
      },
      {
        identity: 'poi:override:lot:rock',
        model: 'builtin:rock',
        at: [50, 50],
        yaw: 0,
        scale: [1, 1, 1],
      },
    ]);
    expect(overridePropRequests(tile, coarser(1))).toEqual(requests);
    expect(overridePropRequests(tile, coarser(2))).toEqual([]);
    // Not a kind the mapped pass knows: it leaves these to overridePropRequests.
    expect(
      mappedPropRequests(tile, geom, true, PLACES.landmarks).map((request) => request.identity),
    ).toEqual(['poi:1']);
  });

  it('keeps scattered plants clear of them, on the levels that place them', () => {
    const tile = tileWith([
      { id: 1, class: 'tree', point: [0.2, 0.2], crownDiameter: 5 },
      { id: 2, class: 'bus_stop', point: [0.3, 0.2] },
      hostPoi('oak', { class: 'tree', point: [0.2, 0.6], crownDiameter: 8 }),
      hostPoi(
        'kiosk',
        { class: MAP_OVERRIDE_PROP_CLASS, point: [0.4, 0.6] },
        { [MAP_OVERRIDE_MODEL_TAG]: 'explorer.kiosk' },
      ),
    ]);
    const widths = (hostOnly?: boolean) =>
      mappedPropExclusions(tile, geom.size, hostOnly).map((exclusion) => exclusion.width);
    expect(widths()).toEqual([6, 9, 2]);
    expect(widths(true)).toEqual([9, 2]);
    expect(mappedPropExclusions(tile, geom.size, true)[1]?.polyline?.[0]).toEqual([39.99, 60]);
  });
});

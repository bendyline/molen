import type {
  TerrainBuildingFeature,
  TerrainPoiFeature,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import type {
  BuildingRequest,
  ResolvedStylePack,
  WorldgenBatchInput,
} from '@bendyline/molen-worldgen/kernel';
import { FLAT_GROUND, generateWorldgenBatch } from '@bendyline/molen-worldgen/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildingPieces } from '../src/kernel/building-parts';
import { applyBuildingUse, associateBuildingUses } from '../src/kernel/building-use';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const SIZE = 800;
const square = (cx: number, cz: number, half: number) => ({
  outer: [
    [(cx - half) / SIZE, (cz - half) / SIZE],
    [(cx + half) / SIZE, (cz - half) / SIZE],
    [(cx + half) / SIZE, (cz + half) / SIZE],
    [(cx - half) / SIZE, (cz + half) / SIZE],
  ] as [number, number][],
});
const building = (
  id: string,
  half: number,
  extra: Partial<TerrainBuildingFeature> = {},
): TerrainBuildingFeature => ({
  id,
  class: 'building',
  polygons: [square(400, 400, half)],
  ...extra,
});
const poi = (cls: string, id?: string, name?: string): TerrainPoiFeature => ({
  class: cls,
  point: [0.5, 0.5],
  ...(id !== undefined ? { id } : {}),
  ...(name !== undefined ? { name } : {}),
});
function classify(
  features: TerrainBuildingFeature[],
  pois: TerrainPoiFeature[],
  context?: string,
): string | undefined {
  const tile: TerrainSemanticTile = {
    ...createEmptyTerrainSemanticTile(),
    buildings: features,
    pois,
  };
  const pieces = buildingPieces(tile.buildings);
  const uses = associateBuildingUses(tile, pieces, SIZE, () => context);
  return uses.get(pieces[0] as (typeof pieces)[number])?.use;
}

describe('building use', () => {
  it('keeps underground footprints out of surface building parts', () => {
    const station = building('station', 50, { layer: -1 });
    const entrance = building('entrance', 4, { class: 'building_part', layer: 0 });
    const tower = building('tower', 8, { class: 'building_part', layer: 2 });
    expect(buildingPieces([station, entrance, tower]).map((piece) => piece.feature.id)).toEqual([
      'entrance',
      'tower',
    ]);
  });

  it('believes a POI that is the same mapped element as the footprint', () => {
    for (const [cls, use] of [
      ['place_of_worship', 'place_of_worship'],
      ['hotel', 'hotel'],
      ['motel', 'hotel'],
      ['hospital', 'hospital'],
      ['school', 'school'],
      ['university', 'school'],
      ['theatre', 'theatre'],
      ['cinema', 'cinema'],
      ['museum', 'museum'],
      ['sports_centre', 'sports_hall'],
      ['townhall', 'civic'],
      ['courthouse', 'civic'],
      ['fire_station', 'fire_station'],
      ['library', 'library'],
      ['station', 'station'],
      ['mall', 'mall'],
      ['student_accommodation', 'apartments'],
    ] as const)
      expect(classify([building('a', 30)], [poi(cls, 'a')]), cls).toBe(use);
  });

  it('lets an institution inside a footprint name it, but not a tenant', () => {
    expect(classify([building('a', 30)], [poi('hotel', 'other')])).toBe('hotel');
    expect(classify([building('a', 30)], [poi('hospital', 'other')])).toBe('hospital');
    expect(classify([building('a', 30)], [poi('restaurant', 'other')])).toBeUndefined();
    // A chapel in a hospital or a screen in a tower is not what the building is for.
    expect(classify([building('a', 30)], [poi('cinema', 'other')])).toBeUndefined();
    expect(classify([building('a', 30)], [poi('place_of_worship', 'other')])).toBeUndefined();
  });

  it('calls a large footprint full of shops a mall, and a small one a parade of shops', () => {
    const shops = ['clothes', 'shoes', 'cafe', 'jewelry', 'restaurant', 'gift', 'bag', 'toys'].map(
      (cls, index) => poi(cls, `s${index}`),
    );
    expect(classify([building('a', 60)], shops)).toBe('mall');
    expect(classify([building('a', 60)], shops.slice(0, 5))).toBeUndefined();
    expect(classify([building('a', 30)], shops)).toBeUndefined();
  });

  it('reads the land a footprint stands on', () => {
    expect(classify([building('a', 12)], [], 'school')).toBe('school');
    expect(classify([building('a', 12)], [], 'university')).toBe('school');
    expect(classify([building('a', 12)], [], 'hospital')).toBe('hospital');
    // A shed on a campus is not a teaching block.
    expect(classify([building('a', 7)], [], 'school')).toBeUndefined();
  });

  it('tells offices from flats by the land under a block', () => {
    const block = (height: number) => [building('a', 20, { height })];
    expect(classify(block(30), [], 'commercial')).toBe('office');
    expect(classify(block(30), [], 'residential')).toBe('apartments');
    expect(classify(block(90), [], 'commercial')).toBe('skyscraper');
    expect(classify(block(90), [], 'residential')).toBe('apartment_tower');
    expect(classify(block(8), [], 'commercial')).toBeUndefined();
    expect(classify(block(8), [], 'residential')).toBeUndefined();
    // Levels stand in for a missing height.
    expect(classify([building('a', 20, { levels: 30 })], [], 'commercial')).toBe('skyscraper');
  });

  it('leaves the great majority of ordinary buildings to the style rules', () => {
    expect(classify([building('a', 8)], [], 'residential')).toBeUndefined();
    expect(classify([building('a', 30)], [])).toBeUndefined();
    expect(classify([building('a', 5)], [poi('school', 'a')])).toBeUndefined();
  });
});

describe('applying a use', () => {
  let pack: ResolvedStylePack;
  beforeAll(async () => {
    pack = await loadDefaultPack();
  });
  const request = (): BuildingRequest => ({
    identity: 'f:1',
    labels: ['building'],
    interiorLabels: ['cafe'],
    outline: [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ],
  });
  it('puts the use ahead of its tenants, and requests its exterior', () => {
    const built = request();
    applyBuildingUse(built, { use: 'hotel', source: 'identity' }, pack.archstyles);
    expect(built.style).toBe('molen.worldgen.use.hotel');
    expect(built.labels[0]).toBe('hotel');
    // A cafe in the lobby does not make it a cafe.
    expect(built.interiorLabels).toEqual(['hotel', 'cafe']);
  });
  it('keeps the architecture of a pack without that style', () => {
    const built = request();
    applyBuildingUse(built, { use: 'hotel', source: 'identity' }, {});
    expect(built.style).toBeUndefined();
    expect(built.labels[0]).toBe('hotel');
  });
  it('carries through the adapter to a real interior, and lets a car park win', () => {
    const tile: TerrainSemanticTile = {
      ...createEmptyTerrainSemanticTile(),
      buildings: [building('a', 22, { height: 30 })],
      pois: [poi('hotel', 'a')],
    };
    const geom: TileGeometry = {
      level: 15,
      x: 0,
      z: 0,
      originX: 0,
      originZ: 0,
      size: SIZE,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const batch = semanticTileToBatch(tile, geom, { pack }, FLAT_GROUND);
    expect(batch.buildings[0]?.style).toBe('molen.worldgen.use.hotel');
    const input: WorldgenBatchInput = { ...batch, ground: FLAT_GROUND, interiors: true };
    const site = generateWorldgenBatch(input).records[0]?.interior;
    expect(site?.storeys?.length).toBeGreaterThan(2);
    const garage = semanticTileToBatch(
      { ...tile, pois: [poi('hotel', 'a'), poi('parking', 'a')] },
      geom,
      { pack },
      FLAT_GROUND,
    );
    expect(garage.buildings[0]?.parking).toBeDefined();
    expect(garage.buildings[0]?.labels).not.toContain('hotel');
  });
  it('leaves a block of flats its local look, changing only what is inside', () => {
    const built = request();
    applyBuildingUse(built, { use: 'apartments', source: 'form' }, pack.archstyles);
    expect(built.style).toBeUndefined();
    expect(built.labels).toEqual(['building']);
    expect(built.interiorLabels?.[0]).toBe('apartments');
  });
  it('takes a use a richer source names outright', () => {
    expect(classify([building('a', 12, { subclass: 'hospital' })], [])).toBe('hospital');
  });
  it('asks only for exteriors the pack ships', () => {
    const uses = ['office', 'skyscraper', 'hotel', 'hospital', 'school'] as const;
    for (const use of [
      ...uses,
      'mall',
      'apartment_tower',
      'place_of_worship',
      'theatre',
      'cinema',
      'museum',
      'sports_hall',
      'civic',
      'station',
      'fire_station',
      'library',
    ] as const) {
      const built = request();
      applyBuildingUse(built, { use, source: 'form' }, pack.archstyles);
      expect(built.style, use).toBeDefined();
    }
  });
});

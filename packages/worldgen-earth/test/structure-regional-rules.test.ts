import { getSchema } from '@bendyline/molen-schema';
import { createEmptyTerrainSemanticTile, wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { createStructureIndex, type StructureMapRule } from '../src/kernel/structure-index';
import { registerStructurePlacementsSchema } from '../src/kernel/structure-index-schema';
import { matchMapStructures } from '../src/kernel/structure-matching';

const rule: StructureMapRule = {
  id: 'map.svanetian-tower.label',
  title: 'Svanetian tower',
  asset: 'model.svanetian',
  match: { classes: ['attraction'], names: ['Svan tower', 'Svanetian tower'] },
  bounds: [42.3, 42.6, 43.3, 43.3],
  dimensions: [5.6, 23, 5.6],
  source: 'https://www.wikidata.org/wiki/Q16375698',
};
function geometry(lon = 42.73, lat = 43.04) {
  const [x, z] = wgs84ToWorld(1, lon, lat);
  return {
    level: 15,
    x: 0,
    z: 0,
    size: 1000,
    originX: x - 500,
    originZ: z - 500,
    metersPerUnit: 1,
    levelBelowMax: 0,
  };
}
const document = (r: StructureMapRule) => ({
  format: 'molen/structure-placements@1' as const,
  title: 'Regional types',
  entries: [],
  rules: [r],
});
describe('regional category rules', () => {
  it('fits an explicitly typed point to its sole complete containing shell, not a nearby house', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [{ id: 1, class: 'attraction', name: 'Svan tower', point: [0.405, 0.414] }];
    const shell = {
      id: 2,
      class: 'building',
      height: 25,
      polygons: [
        {
          outer: [
            [0.4, 0.4],
            [0.41, 0.4],
            [0.41, 0.43],
            [0.4, 0.43],
          ] as [number, number][],
        },
      ],
    };
    tile.buildings = [shell];
    const fitted = matchMapStructures(tile, geometry(), [{ ...rule, fit: 'footprint' }])[0];
    expect(fitted?.heading).toBeCloseTo(Math.PI / 2);
    expect(fitted?.scale?.[0]).toBeCloseTo(5);
    expect(fitted?.scale?.[2]).toBeCloseTo(10 / 5.6);
    expect(fitted?.scale?.[1]).toBeCloseTo(25 / 23);
    tile.buildings = [
      {
        ...shell,
        polygons: [
          {
            outer: [
              [0.6, 0.6],
              [0.61, 0.6],
              [0.61, 0.63],
              [0.6, 0.63],
            ],
          },
        ],
      },
    ];
    expect(matchMapStructures(tile, geometry(), [{ ...rule, fit: 'footprint' }])[0]?.scale).toEqual(
      [1, 1, 1],
    );
    tile.buildings = [shell, { ...shell, id: 3 }];
    expect(matchMapStructures(tile, geometry(), [{ ...rule, fit: 'footprint' }])).toEqual([]);
    tile.buildings = [shell];
    tile.buildingsGeneralized = true;
    expect(matchMapStructures(tile, geometry(), [{ ...rule, fit: 'footprint' }])[0]?.scale).toEqual(
      [1, 1, 1],
    );
  });
  it('matches the exact map type label while excluding tourism businesses and partial names', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [
      { id: 1, class: 'attraction', name: ' Svan Tower ', point: [0.1, 0.1] },
      { id: 2, class: 'hotel', name: 'Svan tower', point: [0.2, 0.2] },
      { id: 3, class: 'attraction', name: 'Svan tower cafe', point: [0.3, 0.3] },
      { id: 4, class: 'attraction', name: 'Tower', point: [0.4, 0.4] },
      { id: 5, class: 'attraction', name: 'Svanetian tower', point: [0.5, 0.5] },
    ];
    const entries = matchMapStructures(tile, geometry(), [rule]);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.title)).toEqual([' Svan Tower ', 'Svanetian tower']);
    expect(matchMapStructures(tile, geometry(-122.3, 47.6), [rule])).toEqual([]);
    expect(matchMapStructures(tile, geometry(), [{ ...rule, maxPerTile: 1 }])).toHaveLength(1);
  });
  it('requires classification and valid regional bounds in the schema and direct index', () => {
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements')?.zod;
    if (!schema) throw new Error('Structure placement schema was not registered');
    expect(schema.safeParse(document(rule)).success).toBe(true);
    expect(createStructureIndex(document(rule)).rules).toHaveLength(1);
    for (const bad of [
      { ...rule, bounds: undefined },
      { ...rule, bounds: [43, 42, 42, 43] },
      { ...rule, bounds: [42, 43, 43, 42] },
      { ...rule, bounds: [-181, 42, 43, 43] },
      { ...rule, bounds: [42, 42, 43, 91] },
      { ...rule, match: { names: ['Svan tower'] } },
      { ...rule, match: { classes: ['attraction'], names: [' '] } },
    ]) {
      const doc = document(bad as StructureMapRule);
      expect(schema.safeParse(doc).success).toBe(false);
      expect(() => createStructureIndex(doc)).toThrow();
    }
  });
  it('uses half-open regional ownership and does not consume the budget outside the region', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [{ id: 1, class: 'attraction', name: 'Svan tower', point: [0.5, 0.5] }];
    expect(matchMapStructures(tile, geometry(42.3, 43), [rule])).toHaveLength(1);
    expect(matchMapStructures(tile, geometry(43.3, 43), [rule])).toHaveLength(0);
    const tagged = { ...rule, match: { tags: { 'tower:type': ['svanetian'] } } };
    tile.pois = [{ id: 2, class: 'tower', tags: { 'tower:type': 'svanetian' }, point: [0.5, 0.5] }];
    expect(matchMapStructures(tile, geometry(), [tagged])).toHaveLength(1);
    expect(matchMapStructures(tile, geometry(45, 43), [tagged])).toHaveLength(0);
  });
});

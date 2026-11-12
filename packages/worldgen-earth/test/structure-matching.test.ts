import {
  createEmptyTerrainSemanticTile,
  type TerrainPoiFeature,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';
import type { TileGeometry } from '../src/kernel/semantic-adapter';
import type { StructureMapRule, StructurePlacement } from '../src/kernel/structure-index';
import {
  matchMapStructures,
  orientMappedStructure,
  orientMappedStructures,
} from '../src/kernel/structure-matching';

const geometry: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 1000,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const windmill: StructureMapRule = {
  id: 'windmill',
  title: 'Windmill',
  asset: 'generic.windmill',
  match: { classes: ['windmill'] },
  dimensions: [20, 30, 20],
  source: 'https://example.com',
  minLevel: 14,
};

describe('mapped reusable structures', () => {
  it('scales native models uniformly from measured height so rotors stay circular', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [{ id: 'mill', class: 'windmill', height: 45, point: [0.2, 0.2] }];
    expect(matchMapStructures(tile, geometry, [{ ...windmill, fit: 'native' }])[0]?.scale).toEqual([
      1.5, 1.5, 1.5,
    ]);
    expect(matchMapStructures(tile, geometry, [windmill])[0]?.scale).toEqual([1.5, 1.5, 1.5]);
  });
  it('matches classes or explicit tags without using names as a category guess', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [
      { id: 1, class: 'windmill', heading: 0.7, point: [0.2, 0.2] },
      { id: 2, class: 'attraction', name: 'Windmill Cafe', point: [0.4, 0.4] },
      { id: 3, class: 'man_made', tags: { man_made: 'windmill' }, point: [0.6, 0.6] },
    ];
    const rules = [
      windmill,
      { ...windmill, id: 'tagged', match: { tags: { man_made: ['windmill'] } } },
    ];
    const entries = matchMapStructures(tile, geometry, rules);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.heading).toBe(0.7);
    expect(entries[1]?.heading).toBe(Math.PI);
    expect(entries.every((entry) => !entry.replaceFootprint)).toBe(true);
    expect(matchMapStructures(tile, { ...geometry, level: 13 }, rules)).toEqual([]);
  });

  it('orients and sizes an explicit category to a mapped footprint, deduplicating its POI', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      {
        id: 'b',
        class: 'windmill',
        height: 45,
        polygons: [
          {
            outer: [
              [0.2, 0.2],
              [0.22, 0.2],
              [0.22, 0.24],
              [0.2, 0.24],
            ],
          },
        ],
      },
    ];
    tile.pois = [{ id: 'p', class: 'windmill', point: [0.21, 0.22] }];
    const entries = matchMapStructures(tile, geometry, [{ ...windmill, fit: 'footprint' }]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.heading).toBeCloseTo(Math.PI / 2);
    expect(entries[0]?.scale?.[0]).toBeCloseTo(2);
    expect(entries[0]?.scale?.[1]).toBeCloseTo(1.5);
    expect(entries[0]?.scale?.[2]).toBeCloseTo(1);
    expect(entries[0]?.replaceFootprint).toBe(true);
    expect(entries[0]?.anchor[0]).toBeCloseTo(worldToWgs84(1, 210, 220)[0]);
    tile.buildingsGeneralized = true;
    expect(matchMapStructures(tile, geometry, [windmill])[0]?.replaceFootprint).toBe(false);
  });

  it("never claims a host's building or prop for a category model or a mapped identity", () => {
    const outer: [number, number][] = [
      [0.2, 0.2],
      [0.22, 0.2],
      [0.22, 0.24],
      [0.2, 0.24],
    ];
    const hostTags = { [MAP_OVERRIDE_TAG]: 'lot' };
    const tile = createEmptyTerrainSemanticTile();
    // What a map override put here: a building it calls a windmill, and a prop of the same class.
    tile.buildings = [
      {
        id: 'override:lot:mill',
        class: 'building',
        subclass: 'windmill',
        name: 'Unique tower',
        height: 45,
        polygons: [{ outer }],
        tags: hostTags,
      },
    ];
    tile.pois = [
      { id: 'override:lot:lamp', class: 'street_lamp', point: [0.6, 0.6], tags: hostTags },
    ];
    const footprint: StructureMapRule = {
      ...windmill,
      match: { subclasses: ['windmill'] },
      fit: 'footprint',
      replaceFootprint: true,
    };
    const lamps: StructureMapRule = {
      ...windmill,
      id: 'lamp',
      match: { classes: ['street_lamp'] },
    };
    expect(matchMapStructures(tile, geometry, [footprint, lamps])).toEqual([]);
    // A mapped point of the kind inside the host's walls stands on its own: the host's building
    // is not its shell, so nothing sizes a model to that footprint or asks for it to be replaced.
    const inside: TerrainPoiFeature = {
      id: 'p',
      class: 'man_made',
      subclass: 'windmill',
      point: [0.21, 0.22],
    };
    const entries = matchMapStructures({ ...tile, pois: [...tile.pois, inside] }, geometry, [
      { ...footprint, replaceFootprint: false },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toContain('map.windmill.');
    expect(entries[0]?.replaceFootprint).toBe(false);
    expect(entries[0]?.scale).toEqual([1, 1, 1]);
    // Nor does a catalogued landmark that follows a mapped footprint take the host's by name.
    const entry: StructurePlacement = {
      id: 'unique',
      title: 'Unique tower',
      asset: 'unique.tower',
      anchor: worldToWgs84(1, 210, 220),
      source: 'https://example.com',
      status: 'preview',
      orientation: 'mapped',
      mapIdentity: { names: ['Unique tower'] },
    };
    expect(orientMappedStructure(entry, tile, geometry)).toBeUndefined();
    expect(orientMappedStructures([entry], tile, geometry)).toEqual([]);
    // Untagged, the same features are the map's: both rules and the identity claim them.
    const { tags: _tags, ...mapped } = tile.buildings[0] as (typeof tile.buildings)[number];
    const { tags: _poiTags, ...lamp } = tile.pois[0] as (typeof tile.pois)[number];
    const untagged = { ...tile, buildings: [mapped], pois: [lamp] };
    expect(orientMappedStructure(entry, untagged, geometry)?.heading).toBeCloseTo(Math.PI / 2);
    const claimed = matchMapStructures(untagged, geometry, [footprint, lamps]);
    expect(claimed.map((placement) => placement.replaceFootprint)).toEqual([true, false]);
  });

  it('has half-open tile ownership, independent rule limits, and a hard tile budget', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      class: 'windmill',
      point: [(i % 10) / 10, Math.floor(i / 10) / 10] as [number, number],
    }));
    tile.pois.push({ id: 'border', class: 'windmill', point: [1, 0.4] });
    expect(
      matchMapStructures(tile, geometry, [{ ...windmill, maxPerTile: 64 }], [], 100),
    ).toHaveLength(64);
    expect(matchMapStructures(tile, geometry, [{ ...windmill, maxPerTile: 3 }])).toHaveLength(3);
    const small = { ...tile, pois: [tile.pois[100]].filter((p) => p !== undefined) };
    expect(matchMapStructures(small, geometry, [windmill])).toEqual([]);
  });

  it('keeps clipped building pieces procedural rather than repeating a whole model at seams', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      {
        class: 'windmill',
        polygons: [
          {
            outer: [
              [0.9, 0.2],
              [1 + 1 / 64, 0.2],
              [1 + 1 / 64, 0.3],
              [0.9, 0.3],
            ],
          },
        ],
      },
    ];
    expect(matchMapStructures(tile, geometry, [windmill])).toEqual([]);
  });

  it('keeps a named landmark distinct from category models', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [{ class: 'windmill', point: [0.2, 0.2] }];
    const landmark: StructurePlacement = {
      id: 'landmark',
      title: 'Historic windmill',
      asset: 'unique.mill',
      anchor: worldToWgs84(1, 200, 200),
      source: 'https://example.com',
      status: 'preview',
    };
    expect(matchMapStructures(tile, geometry, [windmill], [landmark])).toEqual([]);
    expect(matchMapStructures(tile, geometry, [], [landmark])).toEqual([]);
  });

  it('requires positive nearby identity and orientation evidence for mapped unique structures', () => {
    const tile = createEmptyTerrainSemanticTile();
    const entry: StructurePlacement = {
      id: 'unique',
      title: 'Unique tower',
      asset: 'unique.tower',
      anchor: worldToWgs84(1, 210, 220),
      source: 'https://example.com',
      status: 'preview',
      orientation: 'mapped',
      mapIdentity: { wikidata: 'Q42', names: ['Unique tower'] },
    };
    tile.pois = [
      { class: 'tower', name: 'Unique tower', wikidata: 'Q99', heading: 1, point: [0.21, 0.22] },
    ];
    expect(orientMappedStructure(entry, tile, geometry)).toBeUndefined();
    tile.pois[0] = { class: 'tower', wikidata: 'Q42', point: [0.21, 0.22] };
    expect(orientMappedStructure(entry, tile, geometry)).toBeUndefined();
    tile.buildings = [
      {
        class: 'tower',
        wikidata: 'Q42',
        polygons: [
          {
            outer: [
              [0.2, 0.2],
              [0.22, 0.2],
              [0.22, 0.24],
              [0.2, 0.24],
            ],
          },
        ],
      },
    ];
    expect(orientMappedStructure(entry, tile, geometry)?.heading).toBeCloseTo(Math.PI / 2);
    expect(
      orientMappedStructure({ ...entry, anchor: worldToWgs84(1, 900, 900) }, tile, geometry),
    ).toBeUndefined();
  });

  it('orients a batch as one entry at a time would, indexing the tile once', () => {
    const tile = createEmptyTerrainSemanticTile();
    const square = (u: number, v: number) => [
      {
        outer: [
          [u, v],
          [u + 0.02, v],
          [u + 0.02, v + 0.04],
          [u, v + 0.04],
        ] as [number, number][],
      },
    ];
    tile.buildings = [
      { class: 'tower', wikidata: 'Q1', polygons: square(0.2, 0.2) },
      { class: 'hall', name: 'Old Hall', polygons: square(0.5, 0.5) },
      { class: 'hall', name: ' old hall ', polygons: square(0.52, 0.5) },
      { class: 'church', name: 'St. Mark', polygons: square(0.7, 0.3) },
    ];
    tile.pois = [{ class: 'tower', name: 'Gate', heading: 0.5, point: [0.3, 0.6] }];
    tile.transportation = [
      {
        class: 'major_road',
        bridge: true,
        name: 'River Bridge',
        lines: [
          [
            [0.1, 0.8],
            [0.3, 0.8],
          ],
        ],
      },
    ];
    const at = (x: number, z: number) => worldToWgs84(1, x, z);
    const mapped = (id: string, anchor: [number, number], mapIdentity: object) =>
      ({
        id,
        title: id,
        asset: `unique.${id}`,
        anchor,
        orientation: 'mapped',
        mapIdentity,
        status: 'preview',
        source: 'https://example.com',
      }) as StructurePlacement;
    const entries: StructurePlacement[] = [
      mapped('tower', at(210, 220), { wikidata: 'Q1' }),
      mapped('hall', at(510, 520), { names: ['Old Hall'] }),
      mapped('church', at(710, 320), { names: ['nothing', 'ST. MARK'] }),
      mapped('gate', at(300, 600), { names: ['Gate'] }),
      mapped('bridge', at(200, 800), { names: ['River Bridge'] }),
      mapped('missing', at(400, 400), { wikidata: 'Q404' }),
      { ...mapped('fixed', at(100, 100), {}), orientation: undefined } as StructurePlacement,
    ];
    const one = entries.flatMap((entry) => {
      const resolved = orientMappedStructure(entry, tile, geometry);
      return resolved ? [resolved] : [];
    });
    expect(orientMappedStructures(entries, tile, geometry)).toEqual(one);
    expect(one.map((entry) => entry.id)).toEqual(['tower', 'church', 'gate', 'bridge', 'fixed']);
  });

  it('rejects ambiguous exact names and resolves identities across the antimeridian', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [
      { class: 'tower', name: 'Clock tower', heading: 0, point: [0.4, 0.5] },
      { class: 'tower', name: 'Clock tower', heading: 0, point: [0.5, 0.5] },
    ];
    const entry: StructurePlacement = {
      id: 'clock',
      title: 'Clock tower',
      asset: 'unique.clock',
      anchor: worldToWgs84(1, 450, 500),
      orientation: 'mapped',
      mapIdentity: { names: ['Clock tower'] },
      status: 'preview',
      source: 'https://example.com',
    };
    expect(orientMappedStructure(entry, tile, geometry)).toBeUndefined();
    const worldWidth = 2 * Math.PI * 6378137;
    const seam = { ...geometry, originX: -worldWidth / 2 };
    tile.pois = [{ class: 'tower', wikidata: 'Q42', heading: 1, point: [0.02, 0.5] }];
    const across = {
      ...entry,
      anchor: [179.9999, worldToWgs84(1, 0, 500)[1]] as [number, number],
      mapIdentity: { wikidata: 'Q42' },
    };
    expect(orientMappedStructure(across, tile, seam)?.heading).toBe(1);
  });
});

import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
  webMercatorScaleAtLatitude,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import {
  emptyWorldgenStats,
  generateWorldgenBatch,
  queueBuildings,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { buildingLabels, contextLabelAt, landcoverLabel } from '../src/kernel/labels';
import { createRegionResolver } from '../src/kernel/region';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';
import { generateWorldgenTile } from '../src/kernel/tile-generate';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const atlas = await loadDefaultAtlas();
const pack = await loadDefaultPack();
const metersPerUnit = webMercatorScaleAtLatitude(47.6);
const regions = createRegionResolver(atlas, { metersPerUnit });

function geometryAt(lon: number, lat: number, size = 1600): TileGeometry {
  const [x, z] = wgs84ToWebMercator(lon, lat);
  return {
    level: 14,
    x: 2600,
    z: 5700,
    originX: x * metersPerUnit,
    originZ: z * metersPerUnit,
    size,
    metersPerUnit,
    levelBelowMax: 0,
  };
}

function tileFixture(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({
    id: 1,
    class: 'residential',
    polygons: [
      {
        outer: [
          [0.1, 0.1],
          [0.6, 0.1],
          [0.6, 0.6],
          [0.1, 0.6],
        ],
      },
    ],
  });
  tile.landcover.push({
    id: 2,
    class: 'forest',
    subclass: 'evergreen',
    polygons: [
      {
        outer: [
          [0.6, 0.6],
          [1, 0.6],
          [1, 1],
          [0.6, 1],
        ],
      },
    ],
  });
  tile.buildings.push({
    id: 5,
    class: 'building',
    subclass: 'house',
    polygons: [
      {
        outer: [
          [0.2, 0.2],
          [0.21, 0.2],
          [0.21, 0.206],
          [0.2, 0.206],
        ],
      },
    ],
  });
  tile.buildings.push({
    class: 'building',
    polygons: [
      {
        outer: [
          [0.3, 0.3],
          [0.33, 0.3],
          [0.33, 0.32],
          [0.3, 0.32],
        ],
      },
    ],
    height: 24,
  });
  tile.transportation.push({
    id: 7,
    class: 'minor_road',
    lines: [
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  });
  return tile;
}

const flatGround = {
  sampleHeight: () => 12,
  slopeAt: () => 0,
  normalAt: (): [number, number, number] => [0, 1, 0],
};

describe('labels', () => {
  it('maps classes to opaque labels and finds context', () => {
    expect(buildingLabels({ class: 'building', subclass: 'house', polygons: [] })).toEqual([
      'house',
    ]);
    expect(buildingLabels({ polygons: [] })).toEqual(['building']);
    const tile = tileFixture();
    expect(landcoverLabel(tile.landcover[1] as never)).toBe('forest evergreen');
    expect(contextLabelAt([0.2, 0.2], tile.landcover)).toBe('residential');
    expect(contextLabelAt([0.9, 0.9], tile.landcover)).toBe('forest');
    expect(contextLabelAt([0.05, 0.9], tile.landcover)).toBeUndefined();
  });
});

describe('semantic adapter', () => {
  it.each([
    -122.03, 2.35,
  ])('keeps large low residential buildings low and tall residential roofs flat at longitude %s', (lon) => {
    const tile = tileFixture();
    tile.buildings = [
      {
        id: 10,
        class: 'building',
        polygons: [
          {
            outer: [
              [0.2, 0.2],
              [0.5, 0.2],
              [0.5, 0.27],
              [0.2, 0.27],
            ],
          },
        ],
      },
      {
        id: 11,
        class: 'building',
        height: 8,
        polygons: [
          {
            outer: [
              [0.2, 0.3],
              [0.5, 0.3],
              [0.5, 0.37],
              [0.2, 0.37],
            ],
          },
        ],
      },
      {
        id: 12,
        class: 'building',
        height: 17,
        polygons: [
          {
            outer: [
              [0.2, 0.4],
              [0.5, 0.4],
              [0.5, 0.47],
              [0.2, 0.47],
            ],
          },
        ],
      },
    ];
    tile.landcover.push({
      class: 'grass',
      polygons: [
        {
          outer: [
            [0.15, 0.15],
            [0.55, 0.15],
            [0.55, 0.55],
            [0.15, 0.55],
          ],
        },
      ],
    });
    const output = generateWorldgenTile({
      tile,
      geom: geometryAt(lon, 47.61, 200),
      ground: flatGround,
      pack,
      atlas,
      regions,
      features: { scatter: false },
    });
    expect(output.records).toHaveLength(3);
    const low = output.records.find((r) => r.identity === 'f:10');
    expect(low?.styleId).toContain('.house');
    expect(low?.height).toBeLessThan(7);
    expect(['gable', 'hip']).toContain(low?.roof);
    const known = output.records.find((r) => r.identity === 'f:11');
    expect(known?.height).toBe(8);
    expect(['gable', 'hip']).toContain(known?.roof);
    const tall = output.records.find((r) => r.identity === 'f:12');
    expect(tall?.height).toBe(17);
    expect(tall?.styleId).toContain('.house');
    expect(tall?.roof).toBe('flat');
  });

  it('honors explicit non-residential building use and specific land use inside residential areas', () => {
    const tile = tileFixture();
    const [school, block] = tile.buildings;
    if (school === undefined || block === undefined) throw new Error('Missing fixture buildings');
    school.subclass = 'school';
    tile.landcover.push({ class: 'school', polygons: block.polygons });
    const output = generateWorldgenTile({
      tile,
      geom: geometryAt(-122.03, 47.61),
      ground: flatGround,
      pack,
      atlas,
      regions,
      features: { scatter: false },
    });
    expect(output.records.every((r) => r.styleId.endsWith('.commercial'))).toBe(true);
  });

  it('preserves mapped parts, raised clearance, uncovered outlines, and a shared ground platform', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      {
        id: 20,
        class: 'building',
        subclass: 'apartments',
        height: 20,
        polygons: [
          {
            outer: [
              [0.1, 0.1],
              [0.5, 0.1],
              [0.5, 0.3],
              [0.1, 0.3],
            ],
          },
        ],
      },
      {
        id: 21,
        class: 'building_part',
        height: 8,
        polygons: [
          {
            outer: [
              [0.1, 0.1],
              [0.3, 0.1],
              [0.3, 0.3],
              [0.1, 0.3],
            ],
          },
        ],
      },
      {
        id: 22,
        class: 'building_part',
        height: 20,
        minHeight: 10,
        polygons: [
          {
            outer: [
              [0.3, 0.1],
              [0.4, 0.1],
              [0.4, 0.3],
              [0.3, 0.3],
            ],
          },
        ],
      },
    ];
    const geom = geometryAt(-122.03, 47.61, 100);
    const batch = semanticTileToBatch(tile, geom, { pack, atlas, regions });
    expect(batch.buildings).toHaveLength(3);
    const remainder = batch.buildings.find((r) => r.identity.startsWith('f:20'));
    expect(remainder?.outline.every((p) => p[0] >= 40)).toBe(true);
    expect(batch.buildings.every((r) => r.groundOutline?.length === 4)).toBe(true);
    expect(batch.buildings.find((r) => r.identity === 'f:22')?.minHeight).toBe(10);
    const output = generateWorldgenTile({
      tile,
      geom,
      ground: { ...flatGround, sampleHeight: (x) => (x - geom.originX) * 0.1 },
      pack,
      atlas,
      regions,
      features: { scatter: false },
    });
    for (const record of output.records) expect(record.base).toBeCloseTo(5, 6);
    expect(output.records.find((r) => r.identity === 'f:21')?.height).toBe(8);
    expect(output.records.find((r) => r.identity === 'f:22')?.height).toBe(20);
    const raised = tile.buildings[2]?.polygons[0];
    if (raised === undefined) throw new Error('Missing raised part');
    raised.outer = [
      [0.3, 0.1],
      [0.5, 0.1],
      [0.5, 0.3],
      [0.3, 0.3],
    ];
    expect(semanticTileToBatch(tile, geom, { pack }).buildings.map((r) => r.identity)).toEqual([
      'f:21',
      'f:22',
    ]);
  });

  it('converts a tile into identified, labeled, contextualized requests', () => {
    const geom = geometryAt(-122.03, 47.61);
    const batch = semanticTileToBatch(tileFixture(), geom, { pack, atlas, regions });
    expect(batch.regionId).toBe('us.pnw');
    expect(batch.scatterId).toBe('molen.worldgen.scatter.pnw');
    expect(batch.buildings).toHaveLength(2);
    const house = batch.buildings[0];
    expect(house?.identity).toBe('f:5');
    expect(house?.labels).toEqual(['house']);
    expect(house?.context).toBe('residential');
    expect(house?.outline[1]?.[0]).toBeCloseTo(0.21 * geom.size, 6);
    expect(batch.buildings[1]?.identity.startsWith('c:')).toBe(true);
    expect(batch.buildings[1]?.height).toBe(24);
    expect(batch.rules[0]?.style).toBe('molen.worldgen.pnw.house');
    expect(batch.scatter?.polygons.filter((polygon) => polygon.seed === undefined)).toHaveLength(2);
    expect(batch.scatter?.polygons.filter((polygon) => polygon.seed !== undefined)).toHaveLength(1);
    expect(batch.scatter?.exclusions.map((entry) => entry.kind)).toEqual([
      'buildings',
      'buildings',
      'roads',
    ]);
    expect(batch.scatter?.keep).toBe(1);
    expect(batch.scatter?.frame.unitsPerMeter).toBeCloseTo(1 / metersPerUnit, 9);
    expect(batch.tier).toBe(0);
  });

  it('starts coarser detail tiers from the tier offset', () => {
    const geom = { ...geometryAt(-122.03, 47.61), levelBelowMax: 1 };
    expect(semanticTileToBatch(tileFixture(), geom, { pack }).tier).toBe(1);
    expect(semanticTileToBatch(tileFixture(), geom, { pack, tierOffset: 1 }).tier).toBe(2);
    expect(semanticTileToBatch(tileFixture(), geom, { pack, tierOffset: -3 }).tier).toBe(1);
  });

  it('keeps identities stable in projected units across packages with different scale', () => {
    const a = semanticTileToBatch(tileFixture(), geometryAt(-122.03, 47.61), { pack });
    const scaled = { ...geometryAt(-122.03, 47.61), metersPerUnit: 1 };
    scaled.originX = scaled.originX / metersPerUnit;
    scaled.originZ = scaled.originZ / metersPerUnit;
    scaled.size = scaled.size / metersPerUnit;
    const b = semanticTileToBatch(tileFixture(), scaled, { pack });
    expect(a.buildings[1]?.identity).toBe(b.buildings[1]?.identity);
  });

  it('generates a tile end to end with regional styles and budgets', () => {
    const output = generateWorldgenTile({
      tile: tileFixture(),
      geom: geometryAt(-122.03, 47.61),
      ground: flatGround,
      pack,
      atlas,
      regions,
      budgets: worldgenTileBudgetForQuality('balanced', 0),
    });
    expect(output.records).toHaveLength(2);
    expect(output.records.find((record) => record.identity === 'f:5')?.styleId).toBe(
      'molen.worldgen.pnw.house',
    );
    expect(output.records.every((record) => record.base === 12)).toBe(true);
    expect(output.buildings?.vertexCount).toBeGreaterThan(0);
    expect(output.skippedByOwnership).toBe(0);
    const again = generateWorldgenTile({
      tile: tileFixture(),
      geom: geometryAt(-122.03, 47.61),
      ground: flatGround,
      pack,
      atlas,
      regions,
      budgets: worldgenTileBudgetForQuality('balanced', 0),
    });
    expect(again.hash).toBe(output.hash);
  });

  it('applies regional bindings only inside their regions', () => {
    const tokyo = generateWorldgenTile({
      tile: tileFixture(),
      geom: geometryAt(139.7, 35.7),
      ground: flatGround,
      pack,
      atlas,
      regions,
    });
    expect(tokyo.regionId).toBe('jp');
    expect(tokyo.records.find((record) => record.identity === 'f:5')?.styleId).toBe(
      'molen.worldgen.catalog.kyoto_machiya',
    );
    const paris = generateWorldgenTile({
      tile: tileFixture(),
      geom: geometryAt(2.35, 48.85),
      ground: flatGround,
      pack,
      atlas,
      regions,
    });
    expect(paris.regionId).toBe('library.france');
    expect([
      'molen.worldgen.catalog.normandy_farmhouse',
      'molen.worldgen.catalog.provencal_mas',
    ]).toContain(paris.records.find((record) => record.identity === 'f:5')?.styleId);
  });

  it.each([
    [
      -122.03,
      47.61,
      'us.pnw',
      ['pnw.house', 'catalog.craftsman', 'catalog.prairie', 'catalog.ranch'],
    ],
    [139.7, 35.7, 'jp', ['japan.house', 'catalog.kyoto_machiya', 'catalog.gassho_farmhouse']],
    [2.35, 48.85, 'library.france', ['catalog.normandy_farmhouse', 'catalog.provencal_mas']],
  ] as const)('varies stable house identities within %s,%s regional styles only', (lon, lat, regionId, styleNames) => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = Array.from({ length: 96 }, (_, i) => {
      const x = 0.05 + (i % 12) * 0.075,
        z = 0.05 + Math.floor(i / 12) * 0.11;
      return {
        id: 1000 + i,
        class: 'building',
        subclass: 'house',
        levels: 2,
        polygons: [
          {
            outer: [
              [x, z],
              [x + 0.008, z],
              [x + 0.008, z + 0.005],
              [x, z + 0.005],
            ],
          },
        ],
      };
    });
    const geom = geometryAt(lon, lat);
    const batch = semanticTileToBatch(tile, geom, { pack, atlas, regions });
    expect(batch.regionId).toBe(regionId);
    const queue = queueBuildings(batch, emptyWorldgenStats());
    expect(queue).toHaveLength(96);
    const expected = new Set(styleNames.map((name) => `molen.worldgen.${name}`));
    expect(new Set(queue.map((entry) => entry.styleId))).toEqual(expected);
    for (const entry of queue) {
      expect(expected.has(entry.styleId)).toBe(true);
      expect(entry.request.levels).toBe(2);
      expect(entry.analysis.area).toBeCloseTo(102.4, 5);
    }
    const choices = new Map(queue.map((entry) => [entry.request.identity, entry.styleId]));
    tile.buildings.reverse();
    const reordered = queueBuildings(
      semanticTileToBatch(tile, geom, { pack, atlas, regions }),
      emptyWorldgenStats(),
    );
    expect(new Map(reordered.map((entry) => [entry.request.identity, entry.styleId]))).toEqual(
      choices,
    );
  });

  it.each([
    [-122.03, 47.61],
    [139.7, 35.7],
    [2.35, 48.85],
  ] as const)('preserves mapped dimensions and explicit authored styles inside regional bindings at %s,%s', (lon, lat) => {
    const tile = tileFixture();
    const feature = tile.buildings[0];
    if (!feature) throw new Error('Missing fixture house');
    feature.height = 11;
    feature.minHeight = 3;
    feature.levels = 2;
    tile.buildings = [feature];
    const batch = semanticTileToBatch(tile, geometryAt(lon, lat), {
      pack,
      atlas,
      regions,
      features: { scatter: false },
    });
    const request = batch.buildings[0];
    expect(request).toMatchObject({ identity: 'f:5', height: 11, minHeight: 3, levels: 2 });
    if (!request) throw new Error('Missing house request');
    const measured = generateWorldgenBatch({ ...batch, ground: flatGround });
    expect(measured.records[0]?.height).toBe(11);
    const explicit = 'molen.worldgen.catalog.finnish_log_cabin';
    request.style = explicit;
    const authored = generateWorldgenBatch({ ...batch, ground: flatGround });
    expect(authored.records[0]).toMatchObject({ identity: 'f:5', styleId: explicit, height: 11 });
    const heights = Array.from(authored.buildings?.positions ?? []).filter((_, i) => i % 3 === 1);
    expect(Math.min(...heights)).toBeCloseTo(15, 5);
    expect(Math.max(...heights)).toBeCloseTo(23, 5);
  });

  it('scales budgets by quality and level', () => {
    expect(worldgenTileBudgetForQuality('economy', 0).maxBuildingVertices).toBeLessThan(
      worldgenTileBudgetForQuality('high', 0).maxBuildingVertices,
    );
    expect(worldgenTileBudgetForQuality('balanced', 1).maxBuildings).toBeGreaterThan(
      worldgenTileBudgetForQuality('balanced', 0).maxBuildings,
    );
  });

  it.each([
    [-122.03, 47.61, 'molen.worldgen.pnw.house'],
    [139.7, 35.7, 'molen.worldgen.japan.house'],
    [2.35, 48.85, 'molen.worldgen.generic.house'],
  ] as const)('keeps mapped eight-storey buildings out of low-rise variants at %s,%s', (lon, lat, expectedStyle) => {
    for (const subclass of ['house', undefined]) {
      const tile = tileFixture();
      const feature = tile.buildings[0];
      if (!feature) throw new Error('Missing house fixture');
      if (subclass === undefined) delete feature.subclass;
      else feature.subclass = subclass;
      feature.levels = 8;
      tile.buildings = [feature];
      const batch = semanticTileToBatch(tile, geometryAt(lon, lat), {
        pack,
        atlas,
        regions,
        features: { scatter: false },
      });
      const queue = queueBuildings(batch, emptyWorldgenStats());
      expect(queue[0]?.request.levels).toBe(8);
      expect(queue[0]?.request.height).toBeUndefined();
      expect(queue[0]?.styleId).toBe(expectedStyle);
      const output = generateWorldgenBatch({ ...batch, ground: flatGround });
      expect(output.records[0]?.roof).toBe('flat');
      expect(output.records[0]?.height).toBeGreaterThan(20);
      expect(output.records[0]?.height).toBeLessThan(30);
    }
  });
});

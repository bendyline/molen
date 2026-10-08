import { FLAT_GROUND, type ScatterDoc, samplePlacements } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { ECOLOGY_ATLAS_EXAMPLE } from '../src/kernel/ecology-atlas-schema';
import { projectWgs84 } from '../src/kernel/projection';
import { createRegionResolver } from '../src/kernel/region';
import { createRegionalLibrary, type RegionalCatalogDoc } from '../src/kernel/regional-content';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';

function scatter(id: string, model: string): ScatterDoc {
  return {
    format: 'molen/scatter@1',
    id,
    version: 1,
    title: id,
    surface: { default: '#808080', colors: {} },
    defaults: {
      avoid: { roads: 0, buildings: 0, water: 0 },
      slopeMax: 1,
      lod: { keepByTier: [1, 0.5], maxInstancesPerBatch: 10000 },
    },
    rules: [
      {
        id: 'plants',
        classes: ['forest'],
        densityPerHectare: 100,
        minSpacing: 0,
        populations: [{ model, weight: 1, scale: { min: 1, max: 1 }, yaw: 'random', align: 'up' }],
      },
    ],
  };
}

function catalog(): RegionalCatalogDoc {
  return {
    format: 'molen/regional-catalog@1',
    id: 'test.regional',
    version: 1,
    title: 'Test',
    requires: [],
    overrides: [],
    profiles: [
      {
        id: 'test.arid',
        title: 'Arid',
        priority: 10,
        match: { biomes: [13] },
        scatter: 'test.scrub',
      },
      {
        id: 'test.forest',
        title: 'Forest',
        priority: 10,
        match: { biomes: [4] },
        scatter: 'test.trees',
      },
      {
        id: 'test.houses',
        title: 'Houses',
        priority: 10,
        match: { regions: ['town'] },
        buildings: [{ style: 'test.house' }],
      },
    ],
    scatters: [
      scatter('test.scrub', 'builtin:shrub'),
      scatter('test.trees', 'builtin:tree.conifer.pine'),
    ],
  };
}

describe('composable regional content', () => {
  it('skips architectural geography for vegetation unless a vegetation profile requires it', () => {
    const doc = catalog();
    const regions = createRegionResolver(
      {
        format: 'molen/region-atlas@1',
        id: 'test.towns',
        version: 1,
        title: 'Towns',
        default: { buildings: [] },
        regions: [{ id: 'town', priority: 1, bbox: [-1, -1, 1, 1], bindings: { buildings: [] } }],
      },
      { metersPerUnit: 1 },
    );
    const env = createRegionalEnvironment({ atlas: ECOLOGY_ATLAS_EXAMPLE, catalogs: [doc] }, 1, {
      ...regions,
      resolve() {
        throw new Error('Unrelated architecture lookup');
      },
    });
    expect(() => env.scatterAt(0, 0)).not.toThrow();
    doc.profiles.push({
      id: 'test.town.plants',
      title: 'Town plants',
      priority: 100,
      match: { regions: ['town'] },
      scatter: 'test.scrub',
    });
    const refined = createRegionalEnvironment(
      { atlas: ECOLOGY_ATLAS_EXAMPLE, catalogs: [doc] },
      1,
      regions,
    );
    expect(refined.scatterAt(0, 0)?.id).toBe('test.scrub');
    expect(refined.scatterAt(0, 0)).toEqual(refined.at(0, 0).scatter);
    expect(refined.scatterAt(1_000_000, 0)).toEqual(refined.at(1_000_000, 0).scatter);
  });
  it('loads architecture without ecology and scopes modules to their selected style pack', () => {
    const doc: RegionalCatalogDoc = {
      ...catalog(),
      stylePack: 'test-style-pack',
      scatters: [],
      profiles: [
        {
          id: 'test.architecture',
          title: 'Architecture',
          priority: 0,
          match: {},
          buildings: [{ style: 'test.house' }],
        },
      ],
    };
    const env = createRegionalEnvironment({ catalogs: [doc] }, 1);
    expect(env.ecology).toBeUndefined();
    expect(env.hasEcology).toBe(false);
    expect(env.scatter([0, 0, 100, 100])).toBeUndefined();
    expect(env.at(0, 0).architectureProfile).toBe('test.architecture');
    expect(createRegionalLibrary([doc], { id: 'custom-pack', archstyles: {} }).profiles).toEqual(
      [],
    );
    expect(() => createRegionalLibrary([doc], { id: 'test-style-pack', archstyles: {} })).toThrow(
      /missing style/,
    );
    expect(() => createRegionalEnvironment({ catalogs: [catalog()] }, 1)).toThrow(
      /require an ecological atlas/,
    );
  });

  it('selects independent channels, preserving unknown geography', () => {
    const doc = regionalCatalogSchema.parse(catalog());
    const library = createRegionalLibrary([doc]);
    expect(library.select({})).toEqual({});
    const selected = library.select({
      regionId: 'town',
      ecoregion: { id: 3, biome: 13, name: 'Desert', realm: 'Nearctic' },
    });
    expect(selected.ecologyProfile).toBe('test.arid');
    expect(selected.architectureProfile).toBe('test.houses');
    expect(selected.buildings).toEqual([{ style: 'test.house' }]);
    expect(selected.scatter?.id).toBe('test.scrub');
  });

  it('resolves explicit replacements independent of load order and rejects invalid dependency graphs', () => {
    const base = catalog();
    const extension: RegionalCatalogDoc = {
      ...catalog(),
      id: 'test.extension',
      requires: [{ id: base.id, version: 1 }],
      overrides: ['test.arid'],
      scatters: [],
      profiles: [
        {
          id: 'test.arid',
          title: 'Replacement',
          priority: 11,
          match: { biomes: [13] },
          scatter: 'test.trees',
        },
      ],
    };
    const context = { ecoregion: { id: 1, biome: 13, realm: 'Test', name: 'Test' } };
    expect(createRegionalLibrary([extension, base]).select(context)).toEqual(
      createRegionalLibrary([base, extension]).select(context),
    );
    expect(createRegionalLibrary([extension, base]).select(context).scatter?.id).toBe('test.trees');
    expect(() => createRegionalLibrary([extension])).toThrow(/requires/);
    expect(() =>
      createRegionalLibrary([base, { ...extension, requires: [{ id: base.id, version: 2 }] }]),
    ).toThrow(/requires/);
    expect(() => createRegionalLibrary([base, { ...extension, overrides: [] }])).toThrow(
      /override/,
    );
    expect(() =>
      createRegionalLibrary([base, { ...extension, overrides: ['test.arid', 'test.unused'] }]),
    ).toThrow(/Unused/);
    expect(() => createRegionalLibrary([base, base])).toThrow(/duplicate/);
    expect(() =>
      createRegionalLibrary([{ ...base, requires: [{ id: extension.id, version: 1 }] }, extension]),
    ).toThrow(/cycle/);
  });

  it('rejects competing channels and missing scatter references before generation', () => {
    const doc = catalog();
    doc.profiles.push({
      id: 'test.conflict',
      title: 'Conflict',
      priority: 10,
      match: { biomes: [13] },
      scatter: 'test.trees',
    });
    expect(() => createRegionalLibrary([doc])).toThrow(/Ambiguous/);
    doc.profiles.pop();
    doc.scatters = [];
    expect(() => createRegionalLibrary([doc])).toThrow(/Missing/);
  });

  it('filters individual plants across a boundary and isolates seeds from unrelated catalog changes', () => {
    const atlas = structuredClone(ECOLOGY_ATLAS_EXAMPLE);
    atlas.regions = [
      { id: 1, name: 'West desert', biome: 13, realm: 'Test' },
      { id: 2, name: 'East forest', biome: 4, realm: 'Test' },
    ];
    atlas.rows[4] = [18, 1, 18, 2];
    const doc = catalog();
    const environment = createRegionalEnvironment({ atlas, catalogs: [doc] }, 1);
    const z = projectWgs84(0, 45)[1];
    const bounds: [number, number, number, number] = [-500, z, 500, z + 1000];
    expect(environment.ecology?.intersecting(bounds).map((e) => e?.id)).toEqual([1, 2]);
    const generate = (env: typeof environment) => {
      const composed = env.scatter(bounds);
      if (composed === undefined) throw new Error('Missing composed scatter');
      return samplePlacements({
        ...composed,
        ground: FLAT_GROUND,
        tier: 0,
        budget: { maxInstances: 10000, maxInstancesPerRule: 10000, maxPropModels: 8 },
        request: {
          polygons: [
            {
              label: 'forest',
              ring: [
                [0, 0],
                [1000, 0],
                [1000, 1000],
                [0, 1000],
              ],
            },
          ],
          exclusions: [],
          emitBounds: [0, 0, 1000, 1000],
          keep: 1,
          frame: { originX: 500, originZ: -z, unitsPerMeter: 1 },
        },
      });
    };
    const sets = generate(environment);
    expect(sets.map((s) => s.modelRef)).toEqual(['builtin:shrub', 'builtin:tree.conifer.pine']);
    for (const set of sets) {
      expect(set.count).toBeGreaterThan(100);
      for (let i = 0; i < set.count; i++) {
        const x = set.data[i * 10] as number;
        expect(set.modelRef === 'builtin:shrub' ? x < 500 : x >= 500).toBe(true);
      }
    }
    doc.version = 2;
    doc.profiles.push({
      id: 'test.other_buildings',
      title: 'Elsewhere',
      priority: 100,
      match: { regions: ['elsewhere'] },
      buildings: [{ style: 'test.other_house' }],
    });
    expect(generate(createRegionalEnvironment({ atlas, catalogs: [doc] }, 1))).toEqual(sets);
    expect(environment.at(0, 0).scatter).toBeUndefined();
  });
});

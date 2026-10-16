import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, samplePlacements } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { createEcologyResolver, type EcologyAtlasDoc } from '../src/kernel/ecology-atlas';
import { mappedPropRequests } from '../src/kernel/mapped-props';
import { projectWgs84 } from '../src/kernel/projection';
import { createRegionalLibrary } from '../src/kernel/regional-content';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { scatterRequestFromTile } from '../src/kernel/semantic-adapter';

const atlasBytes = await readFile(
  new URL('../../../content/ecology/ecoregions.json', import.meta.url),
);
const catalogBytes = await readFile(
  new URL('../../../content/ecology/regional.catalog.json', import.meta.url),
);
const atlas = JSON.parse(atlasBytes.toString()) as EcologyAtlasDoc;
const catalog = regionalCatalogSchema.parse(JSON.parse(catalogBytes.toString()));
const geography = createEcologyResolver(atlas);
const library = createRegionalLibrary([catalog]);

describe('shipped global ecological coverage', () => {
  it('changes deciduous appearance without moving or resizing the generated plants', () => {
    const [x, z] = projectWgs84(8.4, 48.9);
    const run = (month: number) => {
      const env = createRegionalEnvironment(
        { atlas, catalogs: [catalog], vegetationMonth: month },
        1,
      );
      const scatter = env.scatter([x, z, x + 200, z + 200]);
      if (!scatter) throw new Error('Missing seasonal fixture');
      const request = scatterRequestFromTile(
        {
          ...createEmptyTerrainSemanticTile(),
          landcover: [
            {
              class: 'forest',
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
            },
          ],
        },
        {
          level: 16,
          x: 0,
          z: 0,
          originX: x,
          originZ: z,
          size: 200,
          metersPerUnit: 1,
          levelBelowMax: 0,
        },
        scatter.doc.defaults.avoid,
        1,
      );
      const sets = samplePlacements({
        ...scatter,
        request,
        ground: FLAT_GROUND,
        tier: 0,
        budget: { maxInstances: 2000, maxInstancesPerRule: 2000, maxPropModels: 12 },
      });
      for (const set of sets) expect(env.library.plants[set.modelRef]).toBeDefined();
      return sets;
    };
    const summer = run(7),
      winter = run(1);
    expect(winter.some((set) => set.modelRef.endsWith('.winter'))).toBe(true);
    expect(
      winter
        .map((set) => ({
          ...set,
          modelRef: set.modelRef.replace(/\.winter$/, ''),
          setId: set.setId.replace(/\.winter$/, ''),
        }))
        .sort((a, b) => a.modelRef.localeCompare(b.modelRef)),
    ).toEqual([...summer].sort((a, b) => a.modelRef.localeCompare(b.modelRef)));
  });
  it('uses observed cultivation and water context without turning dry desert or inland forest into palms and mangroves', () => {
    const env = createRegionalEnvironment({ atlas, catalogs: [catalog] }, 1);
    const [x, z] = projectWgs84(12, 24);
    const geom = {
      level: 16,
      x: 0,
      z: 0,
      originX: x,
      originZ: z,
      size: 200,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      {
        class: 'orchard',
        trees: 'date_palms',
        irrigated: true,
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
      },
    ];
    const scatter = env.scatter([x, z, x + 200, z + 200]);
    if (!scatter) throw new Error('Missing regional environment');
    const run = () =>
      samplePlacements({
        ...scatter,
        request: scatterRequestFromTile(tile, geom, scatter.doc.defaults.avoid, 1),
        ground: FLAT_GROUND,
        tier: 0,
        budget: { maxInstances: 2000, maxInstancesPerRule: 2000, maxPropModels: 12 },
      });
    const dates = run();
    expect(new Set(dates.map((set) => set.modelRef))).toEqual(
      new Set(
        ['', '.spreading', '.slender'].map((suffix) => `molen.ecology.plant.date_palm${suffix}`),
      ),
    );
    expect(dates.reduce((sum, set) => sum + set.count, 0)).toBeGreaterThan(300);
    const land = tile.landcover[0];
    if (!land) throw new Error('Missing land fixture');
    tile.landcover[0] = {
      ...land,
      class: 'scrub',
      trees: undefined,
      irrigated: undefined,
    };
    expect(run().some((set) => set.modelRef.includes('palm'))).toBe(false);
    const mangroveDoc = library.scatters.get('molen.ecology.scatter.mangrove');
    if (!mangroveDoc) throw new Error('Missing mangrove fixture');
    tile.landcover[0] = { ...land, class: 'forest', trees: undefined, irrigated: undefined };
    const mangroves = () =>
      samplePlacements({
        request: scatterRequestFromTile(tile, geom, mangroveDoc.defaults.avoid, 1),
        doc: mangroveDoc,
        pack: { name: 'molen.ecology', version: '1' },
        ground: FLAT_GROUND,
        tier: 0,
        budget: { maxInstances: 2000, maxInstancesPerRule: 2000, maxPropModels: 12 },
      });
    expect(mangroves()).toEqual([]);
    tile.water = [
      {
        class: 'ocean',
        polygons: [
          {
            outer: [
              [-1, 0],
              [0.2, 0],
              [0.2, 1],
              [-1, 1],
            ],
          },
        ],
      },
    ];
    expect(mangroves().some((set) => set.modelRef.endsWith('.mangrove'))).toBe(true);
  });
  it('keeps mapped tree taxonomy and measurements authoritative, with regional choices for unknown trees', () => {
    const environment = createRegionalEnvironment({ atlas, catalogs: [catalog] }, 1);
    const [x, z] = projectWgs84(-111.05, 32.25);
    const geom = {
      level: 16,
      x: 0,
      z: 0,
      originX: x - 50,
      originZ: z - 50,
      size: 100,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const tile = createEmptyTerrainSemanticTile();
    tile.pois = [
      {
        id: 'mapped-palm',
        class: 'tree',
        point: [0.2, 0.2],
        species: 'Cocos nucifera',
        height: 18,
        crownDiameter: 9,
      },
      { id: 'unknown', class: 'tree', point: [0.5, 0.5], height: 6 },
      {
        id: 'mapped-conifer',
        class: 'tree',
        point: [0.6, 0.6],
        leafType: 'needleleaved',
        height: 12,
        crownDiameter: 5,
      },
      {
        id: 'mapped-stone-pine',
        class: 'tree',
        point: [0.7, 0.7],
        species: '  Pinus   pinea ',
        genus: 'Pinus',
      },
    ];
    const result = mappedPropRequests(tile, geom, true, undefined, environment);
    const palm = library.plants['molen.ecology.plant.coconut'];
    if (!palm) throw new Error('Missing coconut palm');
    expect(result[0]?.model).toBe(palm.id);
    expect(result[0]?.scale).toEqual([9 / palm.width, 18 / palm.height, 9 / palm.width]);
    expect(result[1]?.model?.replace(/\.(spreading|slender)$/, '')).toBe(
      'molen.ecology.plant.mesquite',
    );
    expect(result[2]?.model).toBe('builtin:tree.mapped.needleleaf');
    expect(result[2]?.scale).toEqual([5, 12, 5]);
    expect(result[3]?.model).toBe('molen.ecology.plant.stone_pine');
    const [mx, mz] = projectWgs84(15, 37.5);
    const mediterranean = mappedPropRequests(
      tile,
      { ...geom, originX: mx, originZ: mz },
      true,
      undefined,
      environment,
    );
    const regionalNeedle = library.plants[mediterranean[2]?.model ?? ''];
    expect(
      regionalNeedle?.leafType ?? (regionalNeedle?.family === 'conifer' ? 'needleleaved' : ''),
    ).toBe('needleleaved');
    expect(mappedPropRequests(tile, geom, true, undefined, environment)).toEqual(result);
    const unrelated = structuredClone(catalog);
    unrelated.version++;
    expect(
      mappedPropRequests(
        tile,
        geom,
        true,
        undefined,
        createRegionalEnvironment({ atlas, catalogs: [unrelated] }, 1),
      ),
    ).toEqual(result);
  });

  it('covers every source ecoregion and resolves every plant reference within a small data download', () => {
    for (const ecoregion of atlas.regions) {
      const selected = library.select({ ecoregion });
      expect(selected.scatter, ecoregion.name).toBeDefined();
    }
    for (const scatter of catalog.scatters)
      for (const rule of scatter.rules)
        for (const population of rule.populations) {
          expect(library.plants[population.model], population.model).toBeDefined();
          expect(population.variants).toHaveLength(3);
          for (const variant of population.variants ?? [])
            expect(library.plants[variant.model], variant.model).toBeDefined();
        }
    expect(atlasBytes.length + catalogBytes.length).toBeLessThan(2_500_000);
    expect(gzipSync(atlasBytes).length + gzipSync(catalogBytes).length).toBeLessThan(190_000);
  });

  it('distinguishes representative regions without exporting iconic species to the wrong realm', () => {
    const sites: Array<[string, number, number, string]> = [
      ['Tucson', -111.05, 32.25, 'sonoran'],
      ['Seattle', -122.33, 47.6, 'pacific_coastal'],
      ['Amazon', -60.1, -3.1, 'rainforest'],
      ['Borneo', 116, 0, 'asian_moist_forest'],
      ['Sahara', 12, 24, 'desert'],
      ['Namib', 15, -24, 'african_desert'],
      ['Siberia', 100, 62, 'siberian_boreal'],
      ['Auckland', 174.7, -36.8, 'nz_northern_forest'],
      ['Perth', 115.8, -31.9, 'australian_heath'],
      ['Sicily', 15, 37.5, 'mediterranean_basin'],
    ];
    for (const [name, lon, lat, profile] of sites) {
      const ecoregion = geography.at(lon, lat);
      if (ecoregion === undefined) throw new Error(`No geography at ${name}`);
      const selected = library.select({ ecoregion });
      expect(selected.ecologyProfile, `${name}: ${ecoregion.name}`).toBe(
        `molen.ecology.habitat.${profile}`,
      );
      const plants =
        selected.scatter?.rules.flatMap((r) => r.populations.map((p) => p.model)) ?? [];
      if (!['Nearctic', 'Neotropic'].includes(ecoregion.realm))
        expect(
          plants.some((p) => /saguaro|cactus|prickly_pear|agave/.test(p)),
          name,
        ).toBe(false);
      if (name === 'Auckland') expect(plants.some((p) => /eucalyptus|mallee/.test(p))).toBe(false);
    }
    expect(library.select({}).scatter).toBeUndefined();
  });
});

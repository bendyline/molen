import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  type TerrainLandcoverFeature,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, samplePlacements } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import {
  agricultureStage,
  prepareAgricultureTile,
  withAgricultureRules,
} from '../src/kernel/agriculture';
import { projectWgs84 } from '../src/kernel/projection';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { scatterRequestFromTile } from '../src/kernel/semantic-adapter';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';

const json = async (file: string) =>
  JSON.parse(await readFile(new URL(`../../../content/ecology/${file}`, import.meta.url), 'utf8'));
const catalog = regionalCatalogSchema.parse(await json('regional.catalog.json'));
const environment = createRegionalEnvironment(
  { atlas: await json('ecoregions.json'), catalogs: [catalog] },
  1,
);
const [x, z] = projectWgs84(-93.9, 42.02);
const geom = {
  level: 15,
  x: 0,
  z: 0,
  originX: x,
  originZ: z,
  size: 100,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const polygon: TerrainLandcoverFeature['polygons'][number] = {
  outer: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
};
const tileWith = (feature: Partial<TerrainLandcoverFeature> = {}) => ({
  ...createEmptyTerrainSemanticTile(),
  landcover: [{ id: 'field-17', class: 'farmland', polygons: [polygon], ...feature }],
});

describe('agricultural regions', () => {
  it('uses observed crops before geographic defaults and keeps source provenance', () => {
    const selected = prepareAgricultureTile(tileWith({ crop: 'rice' }), geom, environment);
    expect(selected.tile.landcover[0]?.cultivation).toMatchObject({
      crop: 'molen.ecology.crop.rice',
      evidence: 'mapped',
    });
    const classified = prepareAgricultureTile(
      tileWith({
        crop: 'maize',
        agriculture: {
          fieldId: 'source:17',
          source: 'WorldCereal-v100',
          year: 2021,
          confidence: 0.9,
        },
      }),
      geom,
      environment,
    );
    expect(classified.tile.landcover[0]?.cultivation).toMatchObject({
      evidence: 'classified',
      source: 'WorldCereal-v100',
      year: 2021,
    });
    const low = prepareAgricultureTile(
      tileWith({
        crop: 'rice',
        agriculture: { fieldId: 'source:17', source: 'classification', confidence: 0.3 },
      }),
      geom,
      environment,
    );
    expect(low.tile.landcover[0]?.cultivation?.evidence).toBe('inferred');
  });
  it('retains mapped field identity, rows and crop through adjacent clipping', () => {
    const tile = tileWith({
      agriculture: {
        fieldId: 'same-field',
        source: 'survey',
        anchor: [-93.9, 42.02],
        rowAngle: 27,
      },
    });
    const left = prepareAgricultureTile(tile, geom, environment);
    const right = prepareAgricultureTile(tile, { ...geom, originX: x + 100 }, environment);
    expect(left.tile.landcover[0]?.cultivation).toEqual(right.tile.landcover[0]?.cultivation);
    expect(left.rules).toEqual(right.rules);
    expect(prepareAgricultureTile(left.tile, geom, environment)).toEqual(left);
  });
  it('never converts natural habitat or a farmyard into crops', () => {
    for (const kind of ['forest', 'scrub', 'residential', 'farmyard', 'park']) {
      const tile = tileWith({ class: kind });
      const result = prepareAgricultureTile(tile, geom, environment);
      expect(result.rules).toHaveLength(0);
      expect(result.tile).toEqual(tile);
    }
  });
  it('selects agricultural regional overrides independently of natural vegetation', () => {
    const selection = environment.agricultureAt(...projectWgs84(-93.99, 42.03));
    expect(selection.agricultureProfile).toBe('molen.ecology.agriculture.corn_belt');
    expect(selection.agriculture?.crops.slice(0, 2).map((entry) => entry.crop)).toEqual([
      'molen.ecology.crop.maize',
      'molen.ecology.crop.soybean',
    ]);
    for (const name of [
      'cerrado_pampas',
      'indus_gangetic',
      'east_african_highland',
      'australian_wheatbelt',
    ])
      expect(
        catalog.profiles.some((profile) => profile.id === `molen.ecology.agriculture.${name}`),
      ).toBe(true);
  });
  it('keeps surface-only pasture from reviving legacy farmland scatter', () => {
    const prepared = prepareAgricultureTile(tileWith({ crop: 'pasture' }), geom, environment);
    expect(prepared.rules).toHaveLength(0);
    const base = environment.scatter([x, z, x + 100, z + 100]);
    if (!base) throw new Error('Missing regional scatter');
    const legacy = {
      ...base,
      acceptsRule: () => true,
      doc: {
        ...base.doc,
        rules: [
          {
            ...base.doc.rules[0]!,
            id: 'legacy.farmland',
            classes: ['farmland'],
            densityPerHectare: 1000,
          },
        ],
      },
    };
    const scatter = withAgricultureRules(legacy, prepared.rules);
    if (!scatter) throw new Error('Missing agriculture scatter');
    expect(
      samplePlacements({
        ...legacy,
        request: scatterRequestFromTile(prepared.tile, geom, base.doc.defaults.avoid, 1),
        ground: FLAT_GROUND,
        tier: 0,
        budget: worldgenTileBudgetForQuality('high', 0),
      }).length,
    ).toBeGreaterThan(0);
    expect(
      samplePlacements({
        ...scatter,
        request: scatterRequestFromTile(prepared.tile, geom, base.doc.defaults.avoid, 1),
        ground: FLAT_GROUND,
        tier: 0,
        budget: worldgenTileBudgetForQuality('high', 0),
      }),
    ).toHaveLength(0);
  });
  it('fills ordinary farmland with coherent crop rows while respecting holes and budgets', () => {
    const hole: typeof polygon.outer = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
    ];
    const prepared = prepareAgricultureTile(
      tileWith({ crop: 'maize', polygons: [{ ...polygon, holes: [hole] }] }),
      geom,
      environment,
    );
    const scatter = withAgricultureRules(
      environment.scatter([x, z, x + 100, z + 100]),
      prepared.rules,
    )!;
    const budget = worldgenTileBudgetForQuality('high', 0);
    const result = samplePlacements({
      ...scatter,
      request: scatterRequestFromTile(prepared.tile, geom, scatter.doc.defaults.avoid, 1),
      ground: FLAT_GROUND,
      tier: 0,
      budget,
    });
    const placements = result.filter((entry) => entry.modelRef.includes('maize'));
    expect(placements.length).toBeGreaterThan(0);
    let count = 0;
    for (const entry of placements)
      for (let i = 0; i < entry.data.length; i += 10) {
        count++;
        const px = entry.data[i]!,
          pz = entry.data[i + 2]!;
        expect(px > 40 && px < 60 && pz > 40 && pz < 60).toBe(false);
      }
    expect(count).toBeLessThanOrEqual(budget.maxAgricultureInstances!);
  });
  it('covers every habitat, supplies three annual forms, and shifts coarse seasons by hemisphere', () => {
    expect(catalog.profiles.every((profile) => profile.agriculture)).toBe(true);
    const corn = environment.library.crops.get('molen.ecology.crop.maize')!;
    expect(corn.variants).toHaveLength(3);
    expect(agricultureStage(corn, 4, -100)).toBe('sown');
    expect(agricultureStage(corn, 10, 100)).toBe('sown');
    expect(agricultureStage(corn, 1, -100)).toBe('stubble');
    expect(agricultureStage(corn, 1, -100, true)).toBe('mature');
    expect(agricultureStage(corn, 2, 100, true, { sowingMonth: 2, harvestMonth: 8 })).toBe('sown');
    for (const model of corn.variants!)
      for (const stage of ['sown', 'growing', 'ripe', 'stubble'])
        expect(environment.library.plants[`${model}.${stage}`]).toBeDefined();
  });
});

import { readFile } from 'node:fs/promises';
import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, samplePlacements } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { projectWgs84 } from '../src/kernel/projection';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { scatterRequestFromTile } from '../src/kernel/semantic-adapter';
import {
  type WorldgenQualityPreset,
  worldgenTileBudgetForQuality,
} from '../src/kernel/tile-budgets';

const json = async (name: string) =>
  JSON.parse(await readFile(new URL(`../../../content/ecology/${name}`, import.meta.url), 'utf8'));
const catalog = regionalCatalogSchema.parse(await json('regional.catalog.json'));
const environment = createRegionalEnvironment(
  { atlas: await json('ecoregions.json'), catalogs: [catalog] },
  1,
);

function fixture(
  lon: number,
  lat: number,
  label = 'forest',
  quality: WorldgenQualityPreset = 'high',
) {
  const [x, z] = projectWgs84(lon, lat);
  const scatter = environment.scatter([x, z, x + 200, z + 200]);
  if (!scatter) throw new Error('Missing habitat');
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover = [
    {
      class: label,
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
  tile.transportation = [
    {
      class: 'path',
      width: 5,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    },
  ];
  const request = scatterRequestFromTile(
    tile,
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
  const budget = worldgenTileBudgetForQuality(quality, 0);
  const run = (brush = true) =>
    samplePlacements({
      ...scatter,
      request,
      ground: FLAT_GROUND,
      tier: quality === 'economy' ? 1 : 0,
      budget: {
        ...budget,
        maxUnderstoryInstances: brush ? budget.maxUnderstoryInstances : 0,
        maxGroundCoverInstances: brush ? budget.maxGroundCoverInstances : 0,
      },
    });
  return { run, budget, doc: scatter.doc };
}

describe('layered regional brush', () => {
  it('adds substantial forest understory and ground coverage without removing the canopy', () => {
    for (const [lon, lat] of [
      [8.4, 48.9],
      [-60.1, -3.1],
      [-122.33, 47.6],
    ] as const) {
      const { run, budget, doc } = fixture(lon, lat);
      const canopyModels = new Set(
        doc.rules
          .filter((r) => (r.layer ?? 'canopy') === 'canopy')
          .flatMap((r) =>
            r.populations.flatMap((p) => [p.model, ...(p.variants ?? []).map((v) => v.model)]),
          ),
      );
      const full = run();
      expect(full).toEqual(run());
      expect(full.filter((s) => canopyModels.has(s.modelRef))).toEqual(run(false));
      const additions = full.filter((s) => !canopyModels.has(s.modelRef));
      const count = additions.reduce((n, s) => n + s.count, 0);
      expect(count).toBeGreaterThan(1000);
      expect(count).toBeLessThanOrEqual(
        (budget.maxUnderstoryInstances ?? 0) + budget.maxGroundCoverInstances,
      );
      expect(additions.some((s) => /shrub|bramble/.test(s.modelRef))).toBe(true);
      expect(additions.some((s) => /litter|moss|vine|runner/.test(s.modelRef))).toBe(true);
      for (const set of additions)
        for (let i = 0; i < set.count; i++)
          expect(Math.abs((set.data[i * 10] ?? 0) - 100)).toBeGreaterThanOrEqual(2.5);
    }
  });
  it('retains broad brush on Economy and omits fine grass and litter', () => {
    const { run, budget } = fixture(8.4, 48.9, 'forest', 'economy');
    const full = run();
    expect(full.reduce((n, s) => n + s.count, 0)).toBeGreaterThan(
      run(false).reduce((n, s) => n + s.count, 0),
    );
    expect(
      full.some((s) =>
        ['grass', 'fern', 'forb', 'vine', 'mat'].includes(
          environment.library.plants[s.modelRef]?.family ?? '',
        ),
      ),
    ).toBe(false);
    expect(budget.maxGroundCoverInstances).toBe(0);
    expect(worldgenTileBudgetForQuality('high', 2).maxUnderstoryInstances).toBe(0);
  });
  it('keeps wild brush out of managed parks, crops and bare ice and keeps deserts sparse', () => {
    for (const label of ['orchard', 'park', 'garden', 'residential']) {
      const { run } = fixture(8.4, 48.9, label);
      expect(run()).toEqual(run(false));
    }
    const desert = fixture(12, 24, 'scrub').run();
    const rainforest = fixture(-60.1, -3.1).run();
    expect(desert.reduce((n, s) => n + s.count, 0)).toBeLessThan(
      rainforest.reduce((n, s) => n + s.count, 0) / 5,
    );
    expect(desert.some((s) => /liana|tropical|fern|moss/.test(s.modelRef))).toBe(false);
    expect(
      catalog.scatters
        .find((s) => s.id.endsWith('.ice'))
        ?.rules.filter((r) => r.layer === 'understory' || r.layer === 'groundcover'),
    ).toHaveLength(0);
  });
});

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateByKind } from '@bendyline/molen-schema';
import {
  generateWorldgenBatch,
  groundSamplerForBatch,
  type WorldgenBatchDoc,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';
import { loadDefaultPack } from './helpers/pack';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, 'fixtures/sammamish-14-2634-5717.batch.json');

// A real finest-level Sammamish tile as adapted by the Earth binding (dumped by
// `molen worldgen stats --dump`, buildings only, coordinates rounded to centimeters): the
// default pack must turn it into mostly detailed, mostly pitched houses, deterministically.

describe('Sammamish tile fixture', () => {
  it('keeps architecture in a neighborhood that exceeds the High detail allowance', async () => {
    const doc = JSON.parse(await readFile(FIXTURE, 'utf8')) as WorldgenBatchDoc;
    const buildings = [
      ...doc.buildings,
      ...doc.buildings.map((building) => ({
        ...building,
        identity: `${building.identity}:dense-copy`,
      })),
    ];
    const budgets = worldgenTileBudgetForQuality('high', 0);
    expect(buildings.length).toBeGreaterThan(budgets.detailedCount);
    expect(buildings.length).toBeLessThan(budgets.maxBuildings);
    const output = generateWorldgenBatch({
      buildings,
      pack: await loadDefaultPack(),
      budgets,
      tier: 0,
    });
    expect(output.stats.buildingsRendered).toBe(buildings.length);
    expect(output.stats.buildingsBoxed).toBe(0);
    expect(output.stats.buildingsDropped).toBe(0);
    expect(output.stats.vertices).toBeLessThanOrEqual(budgets.maxBuildingVertices);
    expect(output.buildings?.groups.length).toBeLessThanOrEqual(budgets.maxMaterialGroups);
    expect((output.stats.roofs.gable ?? 0) + (output.stats.roofs.hip ?? 0)).toBeGreaterThan(600);
  });
  it('generates a dense residential tile from the adapted batch', async () => {
    const raw = JSON.parse(await readFile(FIXTURE, 'utf8'));
    const parsed = validateByKind('worldgen-batch' as never, raw);
    expect(parsed.ok, parsed.ok ? '' : parsed.formatted).toBe(true);
    const doc = parsed.value as WorldgenBatchDoc;
    expect(doc.buildings.length).toBeGreaterThan(500);
    const pack = await loadDefaultPack();
    const input = {
      buildings: doc.buildings,
      ground: groundSamplerForBatch(doc.ground),
      pack,
      rules: doc.rules ?? [],
      ...(doc.fallbackStyle !== undefined ? { fallbackStyle: doc.fallbackStyle } : {}),
      budgets: worldgenTileBudgetForQuality('balanced', 0),
      tier: doc.tier,
    };
    const output = generateWorldgenBatch(input);
    const again = generateWorldgenBatch(input);
    expect(again.hash).toBe(output.hash);
    expect(output.stats.buildingsRendered).toBeGreaterThan(300);
    expect(output.stats.buildingsSkipped).toBe(0);
    const pitched = (output.stats.roofs.gable ?? 0) + (output.stats.roofs.hip ?? 0);
    expect(pitched).toBeGreaterThan(100);
    expect(output.stats.styles['molen.worldgen.pnw.house']).toBeGreaterThan(100);
    expect(new Set(output.records.map((record) => record.identity)).size).toBe(
      output.records.length,
    );
    expect(output.placements.some((set) => set.modelRef.startsWith('molen.worldgen.prop.'))).toBe(
      true,
    );
    expect(output.buildings?.vertexCount).toBeLessThanOrEqual(
      worldgenTileBudgetForQuality('balanced', 0).maxBuildingVertices,
    );
  });
});

it('keeps the shopping-center blocks low-rise without replacing mapped heights', async () => {
  const doc = JSON.parse(
    await readFile(resolve(here, 'fixtures/sammamish-shopping-center.batch.json'), 'utf8'),
  ) as WorldgenBatchDoc;
  const output = generateWorldgenBatch({
    pack: await loadDefaultPack(),
    buildings: doc.buildings,
    ground: groundSamplerForBatch(doc.ground),
    rules: doc.rules ?? [],
    budgets: worldgenTileBudgetForQuality('high', 0),
  });
  expect(output.records).toHaveLength(doc.buildings.length);
  for (const request of doc.buildings) {
    const r = output.records.find((r) => r.identity === request.identity);
    if (!r) throw new Error('missing shopping-center block');
    if (request.height !== undefined) expect(r.height).toBe(request.height);
    else expect(r.height).toBeLessThan(10);
  }
});

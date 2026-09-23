import { generateWorldgenBatch, type Vec2 } from '@bendyline/molen-worldgen/kernel';
import { expect, it } from 'vitest';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';
import { loadDefaultPack } from './helpers/pack';

it('keeps a dense neighborhood textured and enterable within the High tile budget', async () => {
  const pack = await loadDefaultPack();
  const buildings = Array.from({ length: 240 }, (_, i) => {
    const x = (i % 20) * 20,
      z = Math.floor(i / 20) * 20;
    return {
      identity: `detail-budget:${i}`,
      labels: ['house'],
      levels: 2,
      style: 'molen.worldgen.pnw.house',
      outline: [
        [x, z],
        [x + 12, z],
        [x + 12, z + 10],
        [x, z + 10],
      ] as Vec2[],
    };
  });
  const budgets = worldgenTileBudgetForQuality('high', 0);
  const input = { buildings, pack, interiors: true, budgets };
  const result = generateWorldgenBatch(input);
  expect(result.stats.buildingsBoxed).toBe(0);
  expect(result.records.filter((r) => r.interior)).toHaveLength(buildings.length);
  expect(result.stats.materialsCollapsed).toBeLessThan(buildings.length / 4);
  expect(result.stats.vertices).toBeLessThanOrEqual(budgets.maxBuildingVertices);
  expect(result.buildings?.groups.length).toBeLessThanOrEqual(budgets.maxMaterialGroups);
  expect(generateWorldgenBatch(input).hash).toBe(result.hash);
});

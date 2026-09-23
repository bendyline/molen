import { describe, expect, it } from 'vitest';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';

describe('tile budgets', () => {
  it('shrinks scatter with the detail level and stops three levels below the finest', () => {
    for (const quality of ['economy', 'balanced', 'high'] as const) {
      const finest = worldgenTileBudgetForQuality(quality, 0);
      const below = worldgenTileBudgetForQuality(quality, 1);
      const coarse = worldgenTileBudgetForQuality(quality, 2);
      const off = worldgenTileBudgetForQuality(quality, 3);
      expect(finest.maxInstances).toBeGreaterThan(below.maxInstances);
      expect(below.maxInstances).toBeGreaterThan(coarse.maxInstances);
      expect(off.maxInstances).toBe(0);
      expect(worldgenTileBudgetForQuality(quality, 7).maxInstances).toBe(0);
      expect(finest.maxInstancesPerRule).toBeLessThanOrEqual(finest.maxInstances);
      expect(finest.maxBuildingVertices).toBeGreaterThan(below.maxBuildingVertices);
    }
    expect(worldgenTileBudgetForQuality('high', 0).maxInstances).toBeGreaterThan(
      worldgenTileBudgetForQuality('balanced', 0).maxInstances,
    );
    expect(worldgenTileBudgetForQuality('balanced', 0).maxInstances).toBeGreaterThan(
      worldgenTileBudgetForQuality('economy', 0).maxInstances,
    );
  });
});

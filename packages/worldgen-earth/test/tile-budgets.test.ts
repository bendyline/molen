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

  it('holds High building geometry under half when asked for compact buildings', () => {
    for (const level of [0, 1]) {
      const full = worldgenTileBudgetForQuality('high', level);
      const compact = worldgenTileBudgetForQuality('high', level, { compactBuildings: true });
      expect(compact.maxBuildingVertices).toBeLessThan(full.maxBuildingVertices);
      expect(compact.maxBuildingVertices).toBeGreaterThan(
        worldgenTileBudgetForQuality('balanced', level).maxBuildingVertices,
      );
      // Only the geometry budget changes; counts, detail and scatter stay with the preset.
      expect({ ...compact, maxBuildingVertices: 0 }).toEqual({ ...full, maxBuildingVertices: 0 });
    }
    for (const quality of ['economy', 'balanced'] as const)
      expect(worldgenTileBudgetForQuality(quality, 0, { compactBuildings: true })).toEqual(
        worldgenTileBudgetForQuality(quality, 0),
      );
  });
});

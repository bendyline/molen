import { describe, expect, it } from 'vitest';
import {
  explorerPerformanceTier,
  explorerPixelRatio,
  manualQualityLevel,
} from './performance-policy';

describe('explorer device detail policy', () => {
  it('coordinates six monotonically increasing detail and working-set budgets', () => {
    const tiers = Array.from({ length: 6 }, (_, level) => explorerPerformanceTier(level));
    expect(new Set(tiers.map((tier) => tier.name)).size).toBe(6);
    for (const [index, tier] of tiers.entries()) {
      expect(tier.resolutionScale).toBeGreaterThan(0);
      expect(tier.maxPixels).toBeGreaterThan(0);
      expect(tier.surfaceScale).toBeGreaterThan(0);
      expect(tier.surfaceScale).toBeLessThanOrEqual(1);
      expect(tier.terrain.maxResidentTiles).toBeGreaterThanOrEqual(
        tier.terrain.maxSelectedTiles as number,
      );
      expect(tier.terrain.maxConcurrentLayerLoads).toBeLessThanOrEqual(
        tier.terrain.maxConcurrentLoads as number,
      );
      expect(tier.cacheBytes).toBeLessThanOrEqual(tier.terrain.maxResidentBytes as number);
      const cells = (tier.terrain.maxSurfaceTileResolution as number) - 1;
      expect(cells).toBeGreaterThan(0);
      expect(cells & (cells - 1)).toBe(0);
      const previous = tiers[index - 1];
      if (!previous) continue;
      for (const field of ['resolutionScale', 'maxPixels', 'surfaceScale', 'cacheBytes'] as const)
        expect(tier[field], field).toBeGreaterThanOrEqual(previous[field]);
      for (const field of [
        'viewDistance',
        'maxSelectedTiles',
        'maxSurfaceTileResolution',
        'maxConcurrentLoads',
        'maxConcurrentLayerLoads',
        'maxResidentTiles',
        'maxResidentBytes',
      ] as const)
        expect(tier.terrain[field], field).toBeGreaterThanOrEqual(
          previous.terrain[field] as number,
        );
      expect(tier.objectPixelError).toBeLessThan(previous.objectPixelError);
      expect(tier.terrain.maxScreenSpaceError).toBeLessThan(
        previous.terrain.maxScreenSpaceError as number,
      );
    }
  });

  it('clamps tier inputs and returns independent budgets for each application', () => {
    expect(explorerPerformanceTier(-5)).toEqual(explorerPerformanceTier(0));
    expect(explorerPerformanceTier(200)).toEqual(explorerPerformanceTier(5));
    expect(explorerPerformanceTier(2.9)).toEqual(explorerPerformanceTier(2));
    const tier = explorerPerformanceTier(2);
    tier.terrain.maxSelectedTiles = 1;
    expect(explorerPerformanceTier(2).terrain.maxSelectedTiles).toBeGreaterThan(1);
    expect(explorerPerformanceTier(manualQualityLevel('economy')).quality).toBe('economy');
    expect(explorerPerformanceTier(manualQualityLevel('balanced')).quality).toBe('balanced');
    expect(explorerPerformanceTier(manualQualityLevel('high')).quality).toBe('high');
  });

  it.each([
    [1280, 720, 1],
    [1920, 1080, 2],
    [2560, 1440, 3],
    [3840, 2160, 4],
    [7680, 4320, 2],
    [15360, 4320, 1],
    [0, 0, 1],
  ])('respects both native ratio and hard pixel budget at %sx%s DPR%s', (width, height, dpr) => {
    let previous = 0;
    for (let level = 0; level < 6; level++) {
      const tier = explorerPerformanceTier(level);
      const ratio = explorerPixelRatio(level, width, height, dpr);
      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeGreaterThanOrEqual(previous);
      expect(width * height * ratio * ratio).toBeLessThanOrEqual(tier.maxPixels + 0.00001);
      expect(ratio).toBeLessThanOrEqual(Math.max(1, Math.min(dpr, 2)) * tier.resolutionScale);
      previous = ratio;
    }
    expect(explorerPixelRatio(3, width, height, 4)).toBe(explorerPixelRatio(3, width, height, 2));
  });

  it('rejects invalid dimensions, device ratios and nonfinite tiers before sizing the renderer', () => {
    for (const level of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
      expect(() => explorerPerformanceTier(level)).toThrow();
    for (const dimension of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => explorerPixelRatio(2, dimension, 720, 1)).toThrow();
      expect(() => explorerPixelRatio(2, 1280, dimension, 1)).toThrow();
    }
    for (const dpr of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => explorerPixelRatio(2, 1280, 720, dpr)).toThrow();
  });
});

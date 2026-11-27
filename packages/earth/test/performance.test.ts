import { terrainPyramidBudgetForQuality } from '@bendyline/molen-terrain/client';
import { describe, expect, it } from 'vitest';
import {
  createEarthAdmissionGovernor,
  createEarthMemoryGuard,
  EARTH_BACKLOG_MS,
  earthAdmission,
  earthArrivalAdmission,
  earthFixedObjectPixelError,
  earthFixedPixelRatio,
  earthFixedPreset,
  earthInitialQualityLevel,
  earthMemoryBudget,
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
  earthTerrainBudget,
  earthTerrainCacheBudget,
  earthWorldgenCacheBytes,
} from '../src/client/performance';

const MIB = 1024 * 1024;

describe('earth device detail policy', () => {
  it.each([
    'economy',
    'balanced',
    'high',
  ] as const)('keeps the full preparation pipeline available at manual %s quality', (quality) => {
    const rendering = terrainPyramidBudgetForQuality(quality);
    const streaming = earthTerrainCacheBudget(rendering, 512 * MIB);
    expect(streaming.maxConcurrentLoads).toBeGreaterThanOrEqual(12);
    expect(streaming.maxConcurrentLayerLoads).toBeGreaterThanOrEqual(24);
    expect(streaming.maxSelectedTiles).toBe(rendering.maxSelectedTiles);
    expect(streaming.maxSurfaceTileResolution).toBe(rendering.maxSurfaceTileResolution);
    expect(streaming.maxScreenSpaceError).toBe(rendering.maxScreenSpaceError);
  });

  it('admits the most streaming work while a view arrives', () => {
    const arrival = earthArrivalAdmission('webgl');
    expect(arrival).toEqual({ maxBytes: 16 * MIB, maxMilliseconds: 8 });
    // More than even a spare frame takes, on every backend.
    const spare = earthAdmission('webgl', true);
    expect(arrival.maxBytes).toBeGreaterThan(spare.maxBytes);
    expect(arrival.maxMilliseconds ?? 0).toBeGreaterThan(spare.maxMilliseconds ?? 0);
    expect(earthArrivalAdmission('webgpu')).toEqual({ maxBytes: 16 * MIB });
  });

  it('admits more streaming work only while frames have time to spare', () => {
    // Either budget grows to the arrival budget while work has been waiting (the backlog).
    const backlog = { afterMs: EARTH_BACKLOG_MS, maxBytes: 16 * MIB, maxMilliseconds: 8 };
    expect(earthAdmission('webgl', true)).toEqual({
      maxBytes: 8 * MIB,
      maxMilliseconds: 4,
      backlog,
    });
    expect(earthAdmission('webgl', false)).toEqual({
      maxBytes: 2 * MIB,
      maxMilliseconds: 2,
      backlog,
    });
    // WebGPU keeps its own (larger) time default, with and without a backlog.
    expect(earthAdmission('webgpu', true)).toEqual({
      maxBytes: 8 * MIB,
      backlog: { afterMs: EARTH_BACKLOG_MS, maxBytes: 16 * MIB },
    });
    const governor = createEarthAdmissionGovernor('webgl');
    expect(governor.spare).toBe(false);
    // Light frames for a while: spare, once.
    const changes = Array.from({ length: 200 }, () => governor.sample(6, 8.3)).filter(Boolean);
    expect(changes).toEqual([{ maxBytes: 8 * MIB, maxMilliseconds: 4, backlog }]);
    // Between the thresholds the choice stands; sustained heavy work takes it back.
    expect(Array.from({ length: 200 }, () => governor.sample(11.5, 16.7)).filter(Boolean)).toEqual(
      [],
    );
    const back = Array.from({ length: 200 }, () => governor.sample(20, 25)).filter(Boolean);
    expect(back).toEqual([{ maxBytes: 2 * MIB, maxMilliseconds: 2, backlog }]);
    expect(governor.sample(Number.NaN, 16)).toBeUndefined();
  });
  it('preserves flight preparation capacity and cache when render quality drops', () => {
    const minimum = earthPerformanceTier(0).terrain;
    expect(minimum.maxConcurrentLoads).toBeGreaterThanOrEqual(4);
    expect(minimum.maxConcurrentLayerLoads).toBeGreaterThanOrEqual(8);
    const memory = earthMemoryBudget({ deviceMemory: 8 });
    const high = earthTerrainCacheBudget(earthPerformanceTier(5).terrain, memory);
    const low = earthTerrainCacheBudget(minimum, memory);
    expect(low.maxResidentBytes).toBe(high.maxResidentBytes);
    expect(low.maxResidentTiles).toBe(high.maxResidentTiles);
    expect(low.maxSelectedTiles).toBe(minimum.maxSelectedTiles);
    expect(low.maxSurfaceTileResolution).toBe(minimum.maxSurfaceTileResolution);
    expect(minimum.maxResidentBytes).toBe(96 * MIB);
    expect(earthTerrainCacheBudget(minimum, 192 * MIB).maxResidentTiles).toBe(96);
    for (const bytes of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => earthTerrainCacheBudget(minimum, bytes)).toThrow(RangeError);
  });
  it('sizes a fixed memory budget and a starting level from what the device reports', () => {
    expect(earthMemoryBudget({ deviceMemory: 8 })).toBe(768 * MIB);
    // 8 GiB is as much as Chromium reports: many cores beside it say a workstation.
    expect(earthMemoryBudget({ deviceMemory: 8, cores: 20 })).toBe(2048 * MIB);
    expect(earthMemoryBudget({ deviceMemory: 8, cores: 12 })).toBe(768 * MIB);
    expect(earthMemoryBudget({ deviceMemory: 8, cores: 20, touch: true })).toBe(768 * MIB);
    expect(earthMemoryBudget({ deviceMemory: 4, cores: 20 })).toBe(384 * MIB);
    expect(earthMemoryBudget({ deviceMemory: 4 })).toBe(384 * MIB);
    expect(earthMemoryBudget({ deviceMemory: 0.5 })).toBe(192 * MIB);
    expect(earthMemoryBudget({ touch: true })).toBe(256 * MIB);
    expect(earthMemoryBudget({})).toBe(512 * MIB);
    expect(earthInitialQualityLevel({ touch: true, deviceMemory: 8 })).toBe(1);
    expect(earthInitialQualityLevel({ deviceMemory: 2 })).toBe(1);
    expect(earthInitialQualityLevel({ deviceMemory: 4 })).toBe(2);
    expect(earthInitialQualityLevel({ deviceMemory: 8 })).toBe(3);
    expect(earthInitialQualityLevel({})).toBe(3);
    // A software rasterizer starts lowest whatever its memory.
    expect(earthInitialQualityLevel({ deviceMemory: 8, softwareRasterizer: true })).toBe(0);
  });

  it('gives each tier its own wildlife count, apart from its pedestrians', () => {
    const tiers = Array.from({ length: 6 }, (_, level) => earthPerformanceTier(level));
    expect(tiers.map((tier) => [tier.name, tier.ambient.animals])).toEqual([
      ['Minimum', 6],
      ['Low', 8],
      ['Medium', 12],
      ['Balanced', 16],
      ['High', 24],
      ['Ultra', 32],
    ]);
    // Half the pedestrians, the count before, was 4 to 7 animals.
    for (const tier of tiers)
      expect(tier.ambient.animals).toBeGreaterThan(tier.ambient.pedestrians * 0.5 + 1);
  });

  it('coordinates six monotonically increasing detail and working-set budgets', () => {
    const tiers = Array.from({ length: 6 }, (_, level) => earthPerformanceTier(level));
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
        // Each height tile needs several independent semantic layers; allow a bounded
        // family to prepare while another family provides the current view's coverage.
        2 * (tier.terrain.maxConcurrentLoads as number),
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
      for (const field of [
        'cars',
        'pedestrians',
        'trains',
        'aircraft',
        'detailedCars',
        'skinnedFigures',
        'figureRadius',
        'activityRadius',
        'posesPerFrame',
      ] as const)
        expect(tier.ambient[field], field).toBeGreaterThanOrEqual(previous.ambient[field]);
      expect(tier.objectPixelError).toBeLessThan(previous.objectPixelError);
      expect(tier.terrain.maxScreenSpaceError).toBeLessThan(
        previous.terrain.maxScreenSpaceError as number,
      );
    }
  });

  it('clamps tier inputs and returns independent budgets for each application', () => {
    expect(earthPerformanceTier(-5)).toEqual(earthPerformanceTier(0));
    expect(earthPerformanceTier(200)).toEqual(earthPerformanceTier(5));
    expect(earthPerformanceTier(2.9)).toEqual(earthPerformanceTier(2));
    const tier = earthPerformanceTier(2);
    tier.terrain.maxSelectedTiles = 1;
    expect(earthPerformanceTier(2).terrain.maxSelectedTiles).toBeGreaterThan(1);
    expect(earthPerformanceTier(earthQualityLevel('economy')).quality).toBe('economy');
    expect(earthPerformanceTier(earthQualityLevel('balanced')).quality).toBe('balanced');
    expect(earthPerformanceTier(earthQualityLevel('high')).quality).toBe('high');
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
      const tier = earthPerformanceTier(level);
      const ratio = earthPixelRatio(level, width, height, dpr);
      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeGreaterThanOrEqual(previous);
      expect(width * height * ratio * ratio).toBeLessThanOrEqual(tier.maxPixels + 0.00001);
      expect(ratio).toBeLessThanOrEqual(Math.max(1, Math.min(dpr, 2)) * tier.resolutionScale);
      previous = ratio;
    }
    expect(earthPixelRatio(3, width, height, 4)).toBe(earthPixelRatio(3, width, height, 2));
  });

  it('rejects invalid dimensions, device ratios and nonfinite tiers before sizing the renderer', () => {
    for (const level of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
      expect(() => earthPerformanceTier(level)).toThrow();
    for (const dimension of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => earthPixelRatio(2, dimension, 720, 1)).toThrow();
      expect(() => earthPixelRatio(2, 1280, dimension, 1)).toThrow();
    }
    for (const dpr of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => earthPixelRatio(2, 1280, 720, dpr)).toThrow();
  });

  it('builds ultra as the high preset with the Ultra tier’s finer model detail', () => {
    expect(earthFixedPreset('ultra')).toBe('high');
    for (const preset of ['economy', 'balanced', 'high'] as const) {
      expect(earthFixedPreset(preset)).toBe(preset);
      expect(earthFixedObjectPixelError(preset)).toBe(2);
    }
    expect(earthQualityLevel('ultra')).toBe(earthQualityLevel('high'));
    expect(earthFixedObjectPixelError('ultra')).toBe(earthPerformanceTier(5).objectPixelError);
    expect(earthFixedObjectPixelError('ultra')).toBeLessThan(earthFixedObjectPixelError('high'));
  });

  it.each([
    [1280, 720, 1],
    [1920, 1080, 1],
    [2560, 1440, 1],
    [1440, 900, 2],
    [2560, 1440, 1.5],
    [3840, 2160, 2],
    [0, 0, 1],
  ])('draws ultra at least as sharp as the presets at %sx%s DPR%s', (width, height, dpr) => {
    const tier = earthPerformanceTier(5);
    for (const preset of ['economy', 'balanced', 'high'] as const)
      expect(earthFixedPixelRatio(preset, width, height, dpr)).toBe(dpr);
    const ultra = earthFixedPixelRatio('ultra', width, height, dpr);
    // Never below the device's ratio (a held Ultra tier would be, on large dense screens) ...
    expect(ultra).toBeGreaterThanOrEqual(dpr);
    expect(ultra).toBeLessThanOrEqual(dpr * tier.resolutionScale);
    // ... and supersampled only within the tier's pixel budget.
    if (ultra > dpr)
      expect(width * height * ultra * ultra).toBeLessThanOrEqual(tier.maxPixels + 0.00001);
  });

  it('supersamples ultra where the pixel budget allows', () => {
    expect(earthFixedPixelRatio('ultra', 1280, 720, 1)).toBe(1.25);
    expect(earthFixedPixelRatio('ultra', 1920, 1080, 1)).toBe(1.25);
    // 1440p at 1× has room for a little; 4K at its own 1.5 has none.
    expect(earthFixedPixelRatio('ultra', 2560, 1440, 1)).toBeCloseTo(
      Math.sqrt(4_000_000 / (2560 * 1440)),
      6,
    );
    expect(earthFixedPixelRatio('ultra', 2560, 1440, 1.5)).toBe(1.5);
    for (const dpr of [0, -1, Number.NaN])
      expect(() => earthFixedPixelRatio('ultra', 1280, 720, dpr)).toThrow();
  });
});

describe('earth terrain cache budget', () => {
  const MIB = 1024 * 1024;

  it('keeps ground just left warm within the device budget at every level', () => {
    for (let level = 0; level <= 5; level++) {
      const budget = earthTerrainBudget(earthPerformanceTier(level).terrain, 768 * MIB);
      expect(budget.maxResidentBytes).toBe(768 * MIB);
      expect(budget.maxResidentTiles).toBe(768);
      // Half for ground left behind, so a larger budget shows more rather than hides more.
      expect(budget.maxHiddenBytes).toBe(384 * MIB);
    }
  });

  it('never lowers a preset below its own limits', () => {
    const tier = earthPerformanceTier(5).terrain;
    const small = earthTerrainBudget(tier, 192 * MIB);
    expect(small.maxResidentBytes).toBe(tier.maxResidentBytes);
    expect(small.maxResidentTiles).toBe(tier.maxResidentTiles);
  });

  it('stops counting tiles past what memory would hold', () => {
    const budget = earthTerrainBudget(earthPerformanceTier(3).terrain, 8_000 * MIB);
    expect(budget.maxResidentBytes).toBe(8_000 * MIB);
    expect(budget.maxResidentTiles).toBe(1024);
  });

  it('keeps ground a little past the view loaded, for a turn', () => {
    const budget = earthTerrainBudget(earthPerformanceTier(3).terrain, 512 * MIB);
    expect(budget.peripheralDegrees).toBeGreaterThan(0);
    expect(budget.peripheralDetail).toBeGreaterThan(0);
  });

  it('keeps a quarter of the device budget of generated buildings, or the tier amount', () => {
    expect(earthWorldgenCacheBytes(48 * MIB, 768 * MIB)).toBe(192 * MIB);
    expect(earthWorldgenCacheBytes(128 * MIB, 192 * MIB)).toBe(128 * MIB);
  });
});

describe('earth memory guard', () => {
  /** Frames at 60 a second for `ms`, each at `pressure`: how many times the guard asked for a step. */
  const run = (
    guard: ReturnType<typeof createEarthMemoryGuard>,
    ms: number,
    pressure: number,
    frameMs = 1000 / 60,
  ): number => {
    let steps = 0;
    for (let elapsed = 0; elapsed < ms; elapsed += frameMs)
      if (guard.sample(frameMs, pressure)) steps++;
    return steps;
  };

  it('asks for a level only after ten seconds over the budget without a break', () => {
    const guard = createEarthMemoryGuard();
    // At the budget is not over it: a dense city at the level a host sized its budget for.
    expect(run(guard, 300_000, 1)).toBe(0);
    // A handover has a tile and what replaces it on show together, for a few seconds.
    for (let i = 0; i < 20; i++) {
      expect(run(guard, 6000, 1.15)).toBe(0);
      expect(run(guard, 1000, 0.9)).toBe(0);
    }
    expect(run(guard, 9500, 1.15)).toBe(0);
    expect(run(guard, 1000, 1.15)).toBe(1);
  });

  it('asks after two seconds a quarter past the budget', () => {
    const guard = createEarthMemoryGuard();
    expect(run(guard, 1500, 1.3)).toBe(0);
    expect(run(guard, 1000, 1.3)).toBe(1);
  });

  it('lets a step take effect before judging the budget again, one level at a time', () => {
    const guard = createEarthMemoryGuard();
    expect(run(guard, 3000, 2)).toBe(1);
    // What the lower level replaces stays on show until its tiles arrive.
    expect(run(guard, 29_000, 2)).toBe(0);
    expect(run(guard, 4000, 2)).toBe(1);
    guard.reset();
    expect(run(guard, 1500, 2)).toBe(0);
    expect(run(guard, 1000, 2)).toBe(1);
  });

  it('takes a pause for a frame, and ignores what is not a measurement', () => {
    const guard = createEarthMemoryGuard();
    // A tab hidden for a minute comes back with one long frame.
    expect(guard.sample(60_000, 1.5)).toBe(false);
    expect(run(guard, 20_000, 1.5, 5000)).toBe(0);
    expect(guard.sample(0, 9)).toBe(false);
    expect(guard.sample(Number.NaN, 9)).toBe(false);
    expect(guard.sample(16, Number.NaN)).toBe(false);
  });
});

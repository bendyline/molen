import type { TerrainPyramidBudget, TerrainQualityPreset } from '@bendyline/molen-terrain/client';
import type { EarthAmbientBudget } from './ambient';

// Adaptive performance tiers for Earth views: explicit work and working-set budgets per level,
// driven by measured frame times (AdaptiveQualityController) rather than device names.

export interface EarthPerformanceTier {
  name: string;
  quality: TerrainQualityPreset;
  resolutionScale: number;
  maxPixels: number;
  objectPixelError: number;
  surfaceScale: number;
  cacheBytes: number;
  terrain: TerrainPyramidBudget;
  /** Ambient life caps: agents, full models, animated figures and activity radius. */
  ambient: EarthAmbientBudget;
}
const MIB = 1024 * 1024;
const SPECS = [
  ['Minimum', 'economy', 0.5, 450_000, 8, 0.2, 24, 10, 12_000, 16, 17, 2, 1, 64, 96],
  ['Low', 'economy', 0.65, 700_000, 6, 0.35, 32, 7, 24_000, 24, 33, 2, 1, 96, 144],
  ['Medium', 'balanced', 0.8, 1_100_000, 4, 0.5, 48, 5, 40_000, 40, 33, 3, 3, 128, 208],
  ['Balanced', 'balanced', 1, 1_800_000, 2.5, 0.75, 64, 3.5, 60_000, 64, 65, 4, 4, 192, 288],
  ['High', 'high', 1, 2_800_000, 2, 1, 96, 2.4, 85_000, 96, 65, 6, 5, 288, 400],
  ['Ultra', 'high', 1.25, 4_000_000, 1.5, 1, 128, 1.75, 110_000, 128, 129, 8, 6, 384, 544],
] as const;

// cars, pedestrians, trains, aircraft, detailed cars, skinned figures, figure radius (m),
// activity radius (m), pose evaluations per frame.
const AMBIENT = [
  [24, 8, 0, 0, 2, 6, 60, 250, 4],
  [48, 16, 0, 1, 4, 12, 80, 350, 8],
  [96, 32, 1, 1, 6, 20, 100, 450, 12],
  [160, 48, 1, 2, 8, 32, 120, 600, 20],
  [240, 80, 2, 3, 12, 48, 150, 800, 32],
  [320, 120, 2, 4, 16, 64, 180, 1000, 48],
] as const;

/** Explicit work/working-set budgets, driven by measurements instead of device names. */
export function earthPerformanceTier(level: number): EarthPerformanceTier {
  if (!Number.isFinite(level)) throw new RangeError('Performance level must be finite');
  const index = Math.max(0, Math.min(5, Math.floor(level)));
  const spec = SPECS[index] as (typeof SPECS)[number];
  const ambient = AMBIENT[index] as (typeof AMBIENT)[number];
  return {
    name: spec[0],
    quality: spec[1],
    resolutionScale: spec[2],
    maxPixels: spec[3],
    objectPixelError: spec[4],
    surfaceScale: spec[5],
    cacheBytes: spec[6] * MIB,
    terrain: {
      maxScreenSpaceError: spec[7],
      viewDistance: spec[8],
      maxSelectedTiles: spec[9],
      maxSurfaceTileResolution: spec[10],
      maxConcurrentLoads: spec[11],
      maxConcurrentLayerLoads: spec[12],
      maxResidentTiles: spec[13],
      maxResidentBytes: spec[14] * MIB,
    },
    ambient: {
      cars: ambient[0],
      pedestrians: ambient[1],
      trains: ambient[2],
      aircraft: ambient[3],
      detailedCars: ambient[4],
      skinnedFigures: ambient[5],
      figureRadius: ambient[6],
      activityRadius: ambient[7],
      posesPerFrame: ambient[8],
    },
  };
}

/** Cap total pixels as well as pixel ratio, including ultrawide and high-DPI screens. */
export function earthPixelRatio(
  level: number,
  width: number,
  height: number,
  deviceRatio: number,
): number {
  const tier = earthPerformanceTier(level);
  if (
    !Number.isFinite(width) ||
    width < 0 ||
    !Number.isFinite(height) ||
    height < 0 ||
    !Number.isFinite(deviceRatio) ||
    deviceRatio <= 0
  ) {
    throw new RangeError(
      'Viewport dimensions must be finite and nonnegative, and pixel ratio positive',
    );
  }
  return Math.min(
    Math.max(0.25, Math.max(1, Math.min(deviceRatio, 2)) * tier.resolutionScale),
    Math.sqrt(tier.maxPixels / Math.max(1, width * height)),
  );
}

/** The performance level a fixed quality preset corresponds to. */
export function earthQualityLevel(quality: TerrainQualityPreset): number {
  return quality === 'economy' ? 1 : quality === 'high' ? 5 : 3;
}

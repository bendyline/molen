import type { CloudQuality } from '@bendyline/molen-client';
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
  /**
   * Sun shadow map quality: high from Balanced up, medium at Medium, off at the two lowest
   * levels, where the extra shadow pass costs more than it shows.
   */
  shadows: 'off' | 'medium' | 'high';
  /**
   * Cloud ray-marching work (`renderer.setCloudQuality`): low at the two lowest levels, medium
   * through Balanced, then high and ultra, which also cast cloud shadows on the ground.
   */
  clouds: CloudQuality;
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
// activity radius (m), pose evaluations per frame. Car and pedestrian caps are a third of what
// they were (High drew 320 cars and 40 people), matching the lower spawn density in ambient.ts.
const AMBIENT = [
  [8, 1, 0, 0, 2, 6, 60, 250, 4],
  [16, 2, 0, 1, 4, 12, 80, 350, 8],
  [32, 4, 1, 1, 6, 20, 100, 450, 12],
  [54, 6, 1, 2, 8, 32, 120, 600, 20],
  [80, 9, 2, 3, 12, 48, 150, 800, 32],
  [108, 13, 2, 4, 16, 64, 180, 1000, 48],
] as const;

/**
 * How long an adaptive level must hold before adaptation turns sticky, ms. The quick defaults
 * calibrate a device within seconds; afterwards every change swaps resolution, shadows and
 * building detail across the whole view (Low and Medium differ in worldgen quality, so a step
 * regenerates every resident town tile), and the defaults flipped a jet between them every
 * 10-15 s, a hitch and a rebuild each time.
 */
export const EARTH_QUALITY_CALIBRATION_MS = 12_000;
/**
 * Controller timing while calibrating: the controller's quick recovery and cooldown, but down
 * only after 2.5 s of overload, as after calibration. Lifting off reveals a whole view at once,
 * and the second of streaming that follows lowered every takeoff a level, then rose again in
 * flight, a rebuild each way. Each step already waits out the cooldown, so a slow device settles
 * as fast.
 */
export const EARTH_CALIBRATION_QUALITY = {
  decreaseDelayMs: 2_500,
} as const;
/** Controller timing after calibration: down after sustained overload, up after long headroom. */
export const EARTH_STICKY_QUALITY = {
  decreaseDelayMs: 2_500,
  increaseDelayMs: 20_000,
  cooldownMs: 6_000,
} as const;

/**
 * Main-thread admission budget for an Earth view (`createViewer`'s `admission`, later
 * `renderer.admission.setLimits`). With frame time to spare, 8 MiB of uploads a frame and, on
 * WebGL, 4 ms of work: each terrain tile and layer passes several admission jobs, and at the
 * renderer's default of 2 MiB a building cell's upload filled a frame, everything behind it waited
 * 30 ms a job on average, and the ground and buildings beneath a jet appeared a second late.
 * Without spare time, the renderer's defaults (2 MiB, and 2 ms on WebGL): a render-bound frame
 * (High detail over a town) lost a sixth of its rate to the larger budget.
 * `createEarthAdmissionGovernor` chooses between them.
 */
export function earthAdmission(
  backend: 'auto' | 'webgl' | 'webgpu' | undefined,
  spare: boolean,
): { maxBytes: number; maxMilliseconds?: number } {
  return {
    maxBytes: (spare ? 8 : 2) * MIB,
    ...(backend === 'webgl' ? { maxMilliseconds: spare ? 4 : 2 } : {}),
  };
}

/** Main-thread work per frame (ms, smoothed) below which a frame has time to spare, and above
 * which it has none; between the two the choice stands. */
const SPARE_WORK_MS = 10;
const BUSY_WORK_MS = 13;

/**
 * Chooses `earthAdmission`'s budget from the main-thread work each frame measures (not the frame
 * interval, which a 60 Hz display holds at 16.7 ms whatever the work). `sample` returns the new
 * limits when the choice changes; pass them to `renderer.admission.setLimits`. Starts busy.
 */
export function createEarthAdmissionGovernor(backend: 'auto' | 'webgl' | 'webgpu' | undefined): {
  sample(
    workMs: number,
    frameMs: number,
  ): { maxBytes: number; maxMilliseconds?: number } | undefined;
  readonly spare: boolean;
} {
  let smoothed: number | undefined;
  let spare = false;
  return {
    sample(workMs, frameMs) {
      if (!Number.isFinite(workMs) || workMs < 0 || !(frameMs > 0)) return undefined;
      // About a second of frames, whatever the refresh rate.
      const alpha = 1 - Math.exp(-Math.min(frameMs, 250) / 1000);
      smoothed = smoothed === undefined ? workMs : smoothed + alpha * (workMs - smoothed);
      const next = spare ? smoothed < BUSY_WORK_MS : smoothed < SPARE_WORK_MS;
      if (next === spare) return undefined;
      spare = next;
      return earthAdmission(backend, spare);
    },
    get spare() {
      return spare;
    },
  };
}

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
      // Loading is asynchronous (archive reads, worker decoding and generation), and main-thread
      // publication has its own budget (earthAdmission), so these bound requests in flight. At 4
      // and 8 a jet's newly selected tiles waited in line rather than loading (ground a few
      // hundred milliseconds, landcover, water and buildings most of a second) while the
      // workers sat idle and the coarse parent stayed on screen.
      maxConcurrentLoads: Math.max(12, spec[11]),
      maxConcurrentLayerLoads: Math.max(24, spec[12]),
      maxResidentTiles: spec[13],
      maxResidentBytes: spec[14] * MIB,
    },
    ambient: {
      cars: ambient[0],
      pedestrians: ambient[1],
      trains: ambient[2],
      aircraft: ambient[3],
      boats: [0, 2, 4, 6, 8, 12][index] ?? 4,
      detailedCars: ambient[4],
      skinnedFigures: ambient[5],
      figureRadius: ambient[6],
      activityRadius: ambient[7],
      posesPerFrame: ambient[8],
    },
    shadows: index >= 3 ? 'high' : index === 2 ? 'medium' : 'off',
    clouds: index >= 5 ? 'ultra' : index === 4 ? 'high' : index >= 2 ? 'medium' : 'low',
  };
}

/** Keep recently visible ground and the approaching route warm across render-quality changes. */
export function earthTerrainCacheBudget(
  budget: TerrainPyramidBudget,
  memoryBytes: number,
): TerrainPyramidBudget {
  if (!(memoryBytes > 0) || !Number.isFinite(memoryBytes))
    throw new RangeError('Terrain memory budget must be finite and positive');
  return {
    ...budget,
    maxResidentBytes: Math.max(budget.maxResidentBytes ?? 0, memoryBytes),
    maxResidentTiles: Math.max(
      budget.maxResidentTiles,
      Math.min(512, Math.round(memoryBytes / (2 * MIB))),
    ),
  };
}

/** What a device reports about its memory; see `earthMemoryBudget`. */
export interface EarthDeviceMemory {
  /** `navigator.deviceMemory` in GiB (Chromium reports at most 8), when the browser gives it. */
  deviceMemory?: number;
  /** A touch-first device (phone or tablet), whose tabs are killed early under memory pressure. */
  touch?: boolean;
}

function browserDeviceMemory(): EarthDeviceMemory {
  const reported =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined;
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return { ...(reported !== undefined ? { deviceMemory: reported } : {}), touch };
}

/**
 * Terrain and layer geometry a device can keep on screen, bytes. Adaptive quality measures memory
 * pressure against this fixed budget, so stepping down (which selects fewer, coarser tiles)
 * relieves it; a budget that shrank with each level would cascade to the minimum level while the
 * view's geometry stayed the same. The terrain cache also keeps at least this much, so ground
 * just left is still warm when the view pans back. 96 MiB per reported GiB within 192–768 MiB;
 * without a report, 256 MiB on touch devices and 512 MiB elsewhere.
 */
export function earthMemoryBudget(device: EarthDeviceMemory = browserDeviceMemory()): number {
  const { deviceMemory, touch } = device;
  const mib =
    deviceMemory !== undefined && Number.isFinite(deviceMemory) && deviceMemory > 0
      ? Math.min(768, Math.max(192, deviceMemory * 96))
      : touch
        ? 256
        : 512;
  return mib * MIB;
}

/**
 * The adaptive level a view starts at before measuring frames: 1 (Low) on touch devices and at
 * 2 GiB or less, 2 (Medium) at 4 GiB, otherwise 3 (Balanced). Calibration then moves it, so a
 * phone does not first stream a desktop's detail.
 */
export function earthInitialQualityLevel(
  device: EarthDeviceMemory = browserDeviceMemory(),
): number {
  const { deviceMemory, touch } = device;
  if (touch === true || (deviceMemory !== undefined && deviceMemory <= 2)) return 1;
  if (deviceMemory !== undefined && deviceMemory <= 4) return 2;
  return 3;
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

import {
  type AdaptiveQualityChange,
  AdaptiveQualityController,
  type AdaptiveQualityReason,
  type AdaptiveQualitySample,
  type AdaptiveQualityStats,
} from '@bendyline/molen-client';

/**
 * The frame rate Auto still accepts at the level it guessed. Slower than this for
 * `EXPLORER_FLOOR_SECONDS` in a row and it gives the level up.
 */
export const EXPLORER_FLOOR_FPS = 30;
export const EXPLORER_FLOOR_SECONDS = 10;

/** Calm running this long brings a lowered level back one step (see ExplorerQualityController). */
export const EXPLORER_RETURN_SECONDS = 60;
/** The longest a lowered level waits to come back, however often it failed to hold, ms. */
const RETURN_MAX_MS = 600_000;
/** A level lost again within this long of coming back failed to hold: the next wait doubles. */
const RETURN_FAILED_MS = 180_000;
/**
 * Calm: frames at 45 a second or better (smoothed over about two seconds), frame work within 60%
 * of a 30-a-second frame, no streaming strain, and shown content within `CALM_MEMORY` of the
 * memory budget. Far from the floor on purpose: a step up costs more than the level it leaves,
 * and frames are judged slow (see EXPLORER_FLOOR_FPS) only past 39 ms. Over Seattle at Medium
 * after a step down, frame work ran 11 to 17 ms at 36 to 57 frames a second.
 */
const CALM_FRAME_MS = 22;
const CALM_WORK_MS = (1000 / EXPLORER_FLOOR_FPS) * 0.6;
const CALM_MEMORY = 0.75;
/** Smoothing of the calm measures, ms. */
const CALM_SMOOTHING_MS = 2000;
/**
 * A frame longer than this is a hitch (a collection, a shader build, a stall), ms. It is not calm
 * itself, and it moves the smoothed measures only as one frame of this length would. A held view
 * over Bellevue stalled for a second or more about once a minute (with other work on the machine):
 * taken whole, one such frame kept the smoothed time over `CALM_FRAME_MS` for 8 s, and the calm,
 * which then restarted at each stall, never reached a minute.
 */
const CALM_FRAME_CAP_MS = 100;
/** The most of the calm (or of its drain) one frame counts for, ms, as the controller's pause. */
const CALM_STALL_MS = 1000;
/**
 * Time that is not calm takes back this many times its length from the calm counted so far: a
 * streaming hitch costs a second or two, half a minute over a city centre all of it.
 */
const CALM_DRAIN = 2;

/**
 * The explorer's Auto: one guess at a level from what the device reports, kept for the session.
 * It no longer follows frame times up and down. A level change swaps resolution, shadows, terrain
 * error and tile budget across the whole view at once, and a flight crossed the thresholds both
 * ways: a P-51 weaving over Seattle went Balanced, Medium, Balanced, High in four minutes, each
 * step a visible drop or rebuild, and a slow takeoff roll left a fast laptop at the lowest levels
 * for the rest of the flight. What a frame costs depends on where the camera is and what it is
 * doing (an airport, a city centre, a piloted aircraft) more than on the level, so the controller
 * chased the place, not the device.
 *
 * Three things still lower the level, one step at a time: the view outgrowing the device's memory
 * budget, streaming the level cannot hold (see `createStreamStrainMeter`), and frames under
 * `EXPLORER_FLOOR_FPS` for `EXPLORER_FLOOR_SECONDS` running.
 *
 * A lowered level comes back, one step at a time and never past the guess, once the view has been
 * calm for most of `EXPLORER_RETURN_SECONDS` (see `CALM_FRAME_MS`). Each lowering used to be for good, and
 * the busy moments that caused them pass while the steps did not: a 10-minute circle over Seattle
 * at Balanced lost a level over downtown (12 to 17 frames a second for half a minute) and kept
 * Medium at 50 a second for the rest of the flight. A longer session ran the same way down to
 * Minimum, which on a street draws coarse bare ground with no buildings near and calls it
 * finished, so nothing ever loaded again. A level lost again soon after coming back
 * (`RETURN_FAILED_MS`) waits twice as long the next time, so a device or a place that cannot hold
 * it does not flip back and forth.
 *
 * `restart` makes the guess again (choosing Auto in the quality menu does); a manual preset is the
 * way past it.
 */
export class ExplorerQualityController extends AdaptiveQualityController {
  private readonly guess: number;
  /** Measured time, ms, as the controller counts it (pauses as one long frame). */
  private elapsedMs = 0;
  /** Calm time running, ms (see `CALM_FRAME_MS`). */
  private calmMs = 0;
  private calmFrameMs: number | undefined;
  private calmCpuMs: number | undefined;
  private calmGpuMs: number | undefined;
  /** Calm needed before a lowered level comes back, ms; doubles after each failed return. */
  private returnDelayMs = EXPLORER_RETURN_SECONDS * 1000;
  /** The level last brought back, and when. */
  private returned: { level: number; atMs: number } | undefined;
  /** Why the level was last lowered, for as long as it stays below the guess. */
  private loweredFor: AdaptiveQualityReason | undefined;

  constructor(guess: number) {
    super({
      initialLevel: guess,
      maxLevel: guess,
      // The floor, not a target: overload is measured against it.
      targetFrameMs: 1000 / EXPLORER_FLOOR_FPS,
      decreaseDelayMs: EXPLORER_FLOOR_SECONDS * 1000,
      // A step's replacements load before the lower level is judged.
      cooldownMs: 20_000,
      // A long frame is a shader build or a collection, whatever the level: not a reason to lower.
      pauseRepeatMs: 0,
    });
    this.guess = guess;
  }

  override sample(
    frameMs: number,
    sample: AdaptiveQualitySample = {},
  ): AdaptiveQualityChange | undefined {
    const change = super.sample(frameMs, sample);
    if (change !== undefined) {
      this.endCalm();
      if (change.level < change.previousLevel) {
        // The ceiling comes down with the level: the controller's own step up is too eager (it
        // probes at 30 a second); only the calm below brings a level back.
        this.setBounds(0, change.level);
        this.loweredFor = change.reason;
        const returned = this.returned;
        if (
          returned !== undefined &&
          returned.level === change.previousLevel &&
          this.elapsedMs - returned.atMs < RETURN_FAILED_MS
        )
          this.returnDelayMs = Math.min(RETURN_MAX_MS, this.returnDelayMs * 2);
      }
      return change;
    }
    return this.comeBack(frameMs, sample);
  }

  override getStats(): AdaptiveQualityStats {
    const stats = super.getStats();
    return {
      ...stats,
      recoveryDelayMs: this.returnDelayMs,
      reason: stats.level < this.guess ? this.loweredFor : undefined,
    };
  }

  /** Make the guess afresh: back to the starting level, with whatever lowered it forgotten. */
  restart(): void {
    this.setBounds(0, this.guess);
    this.setLevel(this.guess);
    this.endCalm();
    this.returnDelayMs = EXPLORER_RETURN_SECONDS * 1000;
    this.returned = undefined;
    this.loweredFor = undefined;
  }

  /** One step back toward the guess once the view has been calm long enough. */
  private comeBack(
    frameMs: number,
    sample: AdaptiveQualitySample,
  ): AdaptiveQualityChange | undefined {
    if (sample.active === false) {
      this.endCalm();
      return undefined;
    }
    if (!Number.isFinite(frameMs) || frameMs <= 0) return undefined;
    const elapsed = Math.min(frameMs, CALM_STALL_MS);
    this.elapsedMs += elapsed;
    const level = super.getStats().level;
    if (level >= this.guess) {
      this.endCalm();
      return undefined;
    }
    const hitch = frameMs > CALM_FRAME_CAP_MS;
    const alpha = 1 - Math.exp(-Math.min(frameMs, CALM_FRAME_CAP_MS) / CALM_SMOOTHING_MS);
    const smooth = (previous: number | undefined, value: number): number => {
      const capped = Math.min(value, CALM_FRAME_CAP_MS);
      return previous === undefined ? capped : previous + alpha * (capped - previous);
    };
    this.calmFrameMs = smooth(this.calmFrameMs, frameMs);
    if (Number.isFinite(sample.cpuFrameMs) && (sample.cpuFrameMs ?? 0) > 0)
      this.calmCpuMs = smooth(this.calmCpuMs, sample.cpuFrameMs as number);
    // GPU timings arrive for some frames only.
    if (Number.isFinite(sample.gpuFrameMs) && (sample.gpuFrameMs ?? 0) > 0)
      this.calmGpuMs = smooth(this.calmGpuMs, sample.gpuFrameMs as number);
    const calm =
      !hitch &&
      this.calmFrameMs <= CALM_FRAME_MS &&
      Math.max(this.calmCpuMs ?? 0, this.calmGpuMs ?? 0) <= CALM_WORK_MS &&
      sample.strained !== true &&
      !((sample.memoryPressure ?? 0) > CALM_MEMORY);
    this.calmMs = calm ? this.calmMs + elapsed : Math.max(0, this.calmMs - CALM_DRAIN * elapsed);
    if (this.calmMs < this.returnDelayMs) return undefined;
    const next = level + 1;
    this.setBounds(0, next);
    this.setLevel(next);
    this.endCalm();
    this.returned = { level: next, atMs: this.elapsedMs };
    return { previousLevel: level, level: next, reason: 'headroom' };
  }

  private endCalm(): void {
    this.calmMs = 0;
    this.calmFrameMs = undefined;
    this.calmCpuMs = undefined;
    this.calmGpuMs = undefined;
  }
}

/** Auto for a device whose starting guess is `guess` (`earthInitialQualityLevel()`). */
export function createExplorerQualityController(guess = 3): ExplorerQualityController {
  return new ExplorerQualityController(guess);
}

/** Cumulative stream counters and cache pressure, as the explorer samples them. */
export interface StreamStrainSample {
  nowMs: number;
  builtTiles: number;
  /** Tiles built again within a minute of their eviction (the stream's `thrashedTiles`). */
  thrashedTiles: number;
  residentBytes: number;
  displayedBytes: number;
  maxResidentBytes: number | undefined;
}

/**
 * Whether the current level asks for more than the terrain cache can hold: over the last ten
 * seconds half or more of the tiles built had been evicted within the minute before, or the view
 * itself fills most of a full cache, so nothing just left can stay warm. Both come from the
 * level's own demand (a lower level selects fewer, coarser tiles), not from a slow network.
 *
 * Ground built again later is not strain. Counting every rebuild was: from the second lap of a
 * 6 km circle over Seattle on, every tile built had been built on the lap before, and Auto went
 * from Medium to Low for "streaming" at 50 to 100 frames a second.
 */
export function createStreamStrainMeter(): (sample: StreamStrainSample) => boolean {
  const history: StreamStrainSample[] = [];
  return (sample) => {
    history.push(sample);
    while (history.length > 1 && sample.nowMs - (history[0] as StreamStrainSample).nowMs > 10_000)
      history.shift();
    const oldest = history[0] as StreamStrainSample;
    const built = sample.builtTiles - oldest.builtTiles;
    const thrashed = sample.thrashedTiles - oldest.thrashedTiles;
    const thrashing = built >= 20 && thrashed / built >= 0.5;
    const cap = sample.maxResidentBytes;
    const crowded =
      cap !== undefined &&
      cap > 0 &&
      sample.residentBytes >= cap * 0.97 &&
      sample.displayedBytes >= cap * 0.6;
    return thrashing || crowded;
  };
}

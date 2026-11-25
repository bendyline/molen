import {
  type AdaptiveQualityChange,
  AdaptiveQualityController,
  type AdaptiveQualityReason,
  type AdaptiveQualitySample,
  type AdaptiveQualityStats,
} from '@bendyline/molen-client';

/**
 * How far the level Auto draws at may fall below the level its world is built at before slow
 * frames lower the world too (see ExplorerQualityController).
 */
export const EXPLORER_DETAIL_LEAD = 2;

/** One step of the explorer's Auto: `level` is the level drawn at, as in the controller's own. */
export interface ExplorerQualityChange extends AdaptiveQualityChange {
  /** The level the world is built at after the step, and before it. */
  detailLevel: number;
  previousDetailLevel: number;
}

export interface ExplorerQualityStats extends AdaptiveQualityStats {
  /** The level the world is built at; `level` is the level drawn at. */
  detailLevel: number;
}

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
 * A level is two things, and they do not move together. The level drawn at sets resolution,
 * shadows, clouds, ambient life and how soon a model hands over to a coarser one: all changed in
 * place, in a frame, with nothing to rebuild. The level the world is built at (`detailLevel`) sets
 * how far ground refines and how many tiles are held, and a change there is every tile in view
 * given up for a coarser one that has to be built first. Slow frames lower the first alone, for
 * `EXPLORER_DETAIL_LEAD` steps: a P-51 over Seattle, with other work on the machine, lost two
 * levels to slow frames in forty seconds, and at Low the ground beneath it was the box shells
 * of a tile four times too coarse, with no roads, until the levels came back and it was all built
 * again. Lowering the world did not help either: its coarser tiles are more streaming, asked for
 * at the moment the device was behind. Only when the drawing has those steps behind it and frames
 * are still slow does the world follow, a step at a time, so a device that cannot draw its guess
 * at all still ends at the bottom. Memory and streaming strain are the world's own size: they
 * lower both at once, as before.
 *
 * `restart` makes the guess again (choosing Auto in the quality menu does); a manual preset is the
 * way past it.
 */
export class ExplorerQualityController extends AdaptiveQualityController {
  private readonly guess: number;
  /**
   * Steps slow frames take from the drawing before the world follows: `EXPLORER_DETAIL_LEAD`, or
   * as many as the guess has levels under it. The controller counts its levels from that many
   * below the bottom, so its top is `guess + lead` and its level less `lead` is the level drawn.
   */
  private readonly lead: number;
  /** The controller's own level, on that scale (kept here: its stats are a new object a call). */
  private inner: number;
  /** Levels the world is held down for memory or streaming strain. */
  private detailDrop = 0;
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

  /** `held`: a level that will not move (`?tier=`), so drawing and world are the one level. */
  constructor(guess: number, held = false) {
    const lead = held ? 0 : Math.min(EXPLORER_DETAIL_LEAD, guess);
    super({
      initialLevel: guess + lead,
      maxLevel: guess + lead,
      // The floor, not a target: overload is measured against it.
      targetFrameMs: 1000 / EXPLORER_FLOOR_FPS,
      decreaseDelayMs: EXPLORER_FLOOR_SECONDS * 1000,
      // A step's replacements load before the lower level is judged.
      cooldownMs: 20_000,
      // A long frame is a shader build or a collection, whatever the level: not a reason to lower.
      pauseRepeatMs: 0,
    });
    this.guess = guess;
    this.lead = lead;
    this.inner = guess + lead;
  }

  /** The level drawn at: resolution, shadows, clouds, ambient life, model hand-over. */
  get drawLevel(): number {
    return Math.max(0, this.inner - this.lead);
  }

  /** The level the world is built at: terrain budget, building and surface quality. */
  get detailLevel(): number {
    return Math.max(this.drawLevel, Math.min(this.guess - this.detailDrop, this.inner));
  }

  override setLevel(level: number): AdaptiveQualityChange | undefined {
    const change = super.setLevel(level);
    if (change !== undefined) this.inner = change.level;
    return change;
  }

  override sample(
    frameMs: number,
    sample: AdaptiveQualitySample = {},
  ): ExplorerQualityChange | undefined {
    const drawn = this.drawLevel;
    const detail = this.detailLevel;
    const change = super.sample(frameMs, sample);
    if (change !== undefined) {
      this.inner = change.level;
      this.endCalm();
      if (change.level < change.previousLevel) {
        // The ceiling comes down with the level: the controller's own step up is too eager (it
        // probes at 30 a second); only the calm below brings a level back.
        this.setBounds(0, change.level);
        this.loweredFor = change.reason;
        // The world's own size, not what a frame costs: it gives a level up with the drawing.
        if (change.reason !== 'frame-time')
          this.detailDrop = Math.min(this.guess, this.detailDrop + 1);
        const returned = this.returned;
        if (
          returned !== undefined &&
          returned.level === change.previousLevel &&
          this.elapsedMs - returned.atMs < RETURN_FAILED_MS
        )
          this.returnDelayMs = Math.min(RETURN_MAX_MS, this.returnDelayMs * 2);
      }
      return this.report(drawn, detail, change.reason);
    }
    return this.comeBack(frameMs, sample, drawn, detail);
  }

  /** `level` is the level drawn at; the controller's own scale stays inside. */
  override getStats(): ExplorerQualityStats {
    const stats = super.getStats();
    return {
      ...stats,
      level: this.drawLevel,
      detailLevel: this.detailLevel,
      recoveryDelayMs: this.returnDelayMs,
      reason: stats.level < this.guess + this.lead ? this.loweredFor : undefined,
    };
  }

  /** Make the guess afresh: back to the starting level, with whatever lowered it forgotten. */
  restart(): void {
    this.setBounds(0, this.guess + this.lead);
    this.setLevel(this.guess + this.lead);
    this.endCalm();
    this.detailDrop = 0;
    this.returnDelayMs = EXPLORER_RETURN_SECONDS * 1000;
    this.returned = undefined;
    this.loweredFor = undefined;
  }

  /** A step as its host applies it: the two levels before and after. */
  private report(
    drawn: number,
    detail: number,
    reason: AdaptiveQualityReason,
  ): ExplorerQualityChange {
    return {
      previousLevel: drawn,
      level: this.drawLevel,
      reason,
      previousDetailLevel: detail,
      detailLevel: this.detailLevel,
    };
  }

  /** One step back toward the guess once the view has been calm long enough. */
  private comeBack(
    frameMs: number,
    sample: AdaptiveQualitySample,
    drawn: number,
    detail: number,
  ): ExplorerQualityChange | undefined {
    if (sample.active === false) {
      this.endCalm();
      return undefined;
    }
    if (!Number.isFinite(frameMs) || frameMs <= 0) return undefined;
    const elapsed = Math.min(frameMs, CALM_STALL_MS);
    this.elapsedMs += elapsed;
    const level = this.inner;
    if (level >= this.guess + this.lead) {
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
    this.detailDrop = Math.max(0, this.detailDrop - 1);
    this.returned = { level: next, atMs: this.elapsedMs };
    return this.report(drawn, detail, 'headroom');
  }

  private endCalm(): void {
    this.calmMs = 0;
    this.calmFrameMs = undefined;
    this.calmCpuMs = undefined;
    this.calmGpuMs = undefined;
  }
}

/**
 * Auto for a device whose starting guess is `guess` (`earthInitialQualityLevel()`). `held` is a
 * level that will not move (`?tier=`): the level drawn at and the world's are then the same.
 */
export function createExplorerQualityController(
  guess = 3,
  held = false,
): ExplorerQualityController {
  return new ExplorerQualityController(guess, held);
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
  /**
   * The share of the ground in view near the camera that is drawn as selected, with its layers
   * (the stream's `viewCoverage`, nearest band: `complete / tiles`), when the host reads it.
   */
  nearComplete?: number;
}

/**
 * Below this share of the near ground finished, over the meter's ten seconds, the view is behind:
 * tiles built again soon after their eviction are then strain (see createStreamStrainMeter).
 */
const NEAR_BEHIND = 0.85;

/**
 * Whether the current level asks for more than the terrain cache can hold: over the last ten
 * seconds half or more of the tiles built had been evicted within the minute before while the
 * ground near the camera fell behind, or the view itself fills most of a full cache, so nothing
 * just left can stay warm. Both come from the level's own demand (a lower level selects fewer,
 * coarser tiles), not from a slow network.
 *
 * Ground built again later is not strain. Counting every rebuild was: from the second lap of a
 * 6 km circle over Seattle on, every tile built had been built on the lap before, and Auto went
 * from Medium to Low for "streaming" at 50 to 100 frames a second.
 *
 * Nor is ground built again while the view keeps up. Three full turns over downtown Seattle at
 * Balanced rebuilt 209 of the 480 tiles they built, 190 of them within a minute of their eviction
 * (a lap's ground is more than the warm cache holds), with all of the ground within 1.5 km at its
 * selected detail throughout: the rebuilding cost worker time and nothing on screen. Lowering the
 * level for it did cost something on screen: the detailed ground under the aircraft gave way to
 * coarser tiles, came back a minute later, and went again. A host that does not say how the near
 * ground stands (`nearComplete`) is judged on the rebuilding alone, as before.
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
    let near = 0;
    let nearSamples = 0;
    for (const entry of history) {
      if (entry.nearComplete === undefined) continue;
      near += entry.nearComplete;
      nearSamples++;
    }
    const keepingUp = nearSamples > 0 && near / nearSamples >= NEAR_BEHIND;
    const thrashing = built >= 20 && thrashed / built >= 0.5 && !keepingUp;
    const cap = sample.maxResidentBytes;
    const crowded =
      cap !== undefined &&
      cap > 0 &&
      sample.residentBytes >= cap * 0.97 &&
      sample.displayedBytes >= cap * 0.6;
    return thrashing || crowded;
  };
}

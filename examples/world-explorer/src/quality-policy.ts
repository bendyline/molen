import {
  type AdaptiveQualityChange,
  AdaptiveQualityController,
  type AdaptiveQualitySample,
} from '@bendyline/molen-client';

/**
 * The frame rate Auto still accepts at the level it guessed. Slower than this for
 * `EXPLORER_FLOOR_SECONDS` in a row and it gives the level up.
 */
export const EXPLORER_FLOOR_FPS = 30;
export const EXPLORER_FLOOR_SECONDS = 10;

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
 * Three things still lower the level, each one step and for good, since none of them passes: the
 * view outgrowing the device's memory budget, streaming the level cannot hold (see
 * `createStreamStrainMeter`), and frames under `EXPLORER_FLOOR_FPS` for `EXPLORER_FLOOR_SECONDS`
 * running, which is a device the guess was wrong about rather than a busy moment. Nothing raises
 * it. `restart` makes the guess again (choosing Auto in the quality menu does); a manual preset is
 * the way to a higher level.
 */
export class ExplorerQualityController extends AdaptiveQualityController {
  private readonly guess: number;

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
    // A level given up is not tried again: the ceiling comes down with it.
    if (change !== undefined && change.level < change.previousLevel)
      this.setBounds(0, change.level);
    return change;
  }

  /** Make the guess afresh: back to the starting level, with whatever lowered it forgotten. */
  restart(): void {
    this.setBounds(0, this.guess);
    this.setLevel(this.guess);
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
  rebuiltTiles: number;
  residentBytes: number;
  displayedBytes: number;
  maxResidentBytes: number | undefined;
}

/**
 * Whether the current level asks for more than the terrain cache can hold: over the last ten
 * seconds half or more of the tiles built had been built before and evicted, or the view
 * itself fills most of a full cache, so nothing just left can stay warm. Both come from the
 * level's own demand (a lower level selects fewer, coarser tiles), not from a slow network.
 */
export function createStreamStrainMeter(): (sample: StreamStrainSample) => boolean {
  const history: StreamStrainSample[] = [];
  return (sample) => {
    history.push(sample);
    while (history.length > 1 && sample.nowMs - (history[0] as StreamStrainSample).nowMs > 10_000)
      history.shift();
    const oldest = history[0] as StreamStrainSample;
    const built = sample.builtTiles - oldest.builtTiles;
    const rebuilt = sample.rebuiltTiles - oldest.rebuiltTiles;
    const thrashing = built >= 20 && rebuilt / built >= 0.5;
    const cap = sample.maxResidentBytes;
    const crowded =
      cap !== undefined &&
      cap > 0 &&
      sample.residentBytes >= cap * 0.97 &&
      sample.displayedBytes >= cap * 0.6;
    return thrashing || crowded;
  };
}

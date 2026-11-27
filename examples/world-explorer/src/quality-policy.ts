import {
  type AdaptiveQualityChange,
  AdaptiveQualityController,
  type AdaptiveQualityReason,
  type AdaptiveQualitySample,
  type AdaptiveQualityStats,
} from '@bendyline/molen-client';
import { createEarthMemoryGuard } from '@bendyline/molen-earth/client';

/**
 * The explorer's Auto: one guess at a level from what the device reports, kept for the session.
 * Nothing a frame costs moves it, up or down, and nothing about how the stream is doing.
 *
 * A level change swaps resolution, shadows, terrain error and tile budget across the whole view at
 * once, and what a frame costs depends on where the camera is, what it is doing and what else the
 * machine is doing more than on the level. Every rule that let the level follow that was a way
 * for a flight to lose the world it was flying over:
 * - Following frame times both ways, a P-51 weaving over Seattle went Balanced, Medium, Balanced,
 *   High in four minutes, each step a visible drop or rebuild.
 * - Guessed once but given up for frames under 30 a second, streaming strain or memory, each for
 *   good, a long session ran down to Minimum, which on a street draws coarse bare ground with no
 *   buildings near and calls it finished.
 * - With a lowered level brought back after a minute of calm, a flight with other work on the
 *   machine lost two levels to slow frames in forty seconds, flew over the box shells and bare
 *   roads of a tile four times too coarse, got its levels back, and had it all built again; three
 *   turns over a city did the same through streaming strain.
 *
 * So the guess stands. A device it is wrong for has the quality menu: a manual preset is a level
 * by choice, and choosing Auto again makes the guess afresh (`restart`).
 *
 * One thing still lowers it, a step at a time and for good: what is on show outgrowing the
 * device's memory budget for seconds on end (`createEarthMemoryGuard`), which left alone ends with
 * the tab killed. A level that came back afterwards would outgrow the budget again over the same
 * place.
 *
 * The controller underneath still measures frames (the panel shows them); its bounds are the one
 * level, so it never answers with a change.
 */
export class ExplorerQualityController extends AdaptiveQualityController {
  private readonly guess: number;
  /** A level that will not move even for memory (`?tier=`, for measurements). */
  private readonly held: boolean;
  /** The level in use: the guess, less what memory has taken. */
  private current: number;
  private readonly memory = createEarthMemoryGuard();
  /** Why the level is below the guess, while it is. */
  private loweredFor: AdaptiveQualityReason | undefined;

  constructor(guess: number, held = false) {
    super({ initialLevel: guess, minLevel: guess, maxLevel: guess });
    this.guess = guess;
    this.held = held;
    this.current = guess;
  }

  override sample(
    frameMs: number,
    sample: AdaptiveQualitySample = {},
  ): AdaptiveQualityChange | undefined {
    // For its measures alone: bounded to one level, it has no change to make.
    super.sample(frameMs, sample);
    if (this.held || sample.active === false || this.current === 0) return undefined;
    if (!this.memory.sample(frameMs, sample.memoryPressure ?? 0)) return undefined;
    const previousLevel = this.current;
    this.current = previousLevel - 1;
    this.setBounds(this.current, this.current);
    this.loweredFor = 'memory-pressure';
    return { previousLevel, level: this.current, reason: 'memory-pressure' };
  }

  override getStats(): AdaptiveQualityStats {
    return {
      ...super.getStats(),
      level: this.current,
      reason: this.current < this.guess ? this.loweredFor : undefined,
    };
  }

  /** Make the guess afresh: back to the starting level, with what memory took given back. */
  restart(): void {
    this.current = this.guess;
    this.setBounds(this.guess, this.guess);
    this.memory.reset();
    this.loweredFor = undefined;
  }
}

/**
 * Auto for a device whose starting guess is `guess` (`earthInitialQualityLevel()`). `held` is a
 * level that will not move at all (`?tier=`).
 */
export function createExplorerQualityController(
  guess = 3,
  held = false,
): ExplorerQualityController {
  return new ExplorerQualityController(guess, held);
}

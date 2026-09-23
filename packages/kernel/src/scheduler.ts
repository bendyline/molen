import type { World } from './world';

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface SchedulerClock {
  now(): number;
  setTimer(cb: () => void, ms: number): TimerHandle;
  clearTimer(h: TimerHandle): void;
}

const realClock: SchedulerClock = {
  now: () => Date.now(),
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (h) => clearTimeout(h),
};

export interface SchedulerOptions {
  /** Max ticks to catch up per wake before dropping debt (spiral-of-death guard). */
  maxCatchUpTicks?: number;
  /** Playback rate multiplier; 1 = realtime. The sim tick rate is the world's tickRate. */
  rate?: number;
  /** Injectable clock for deterministic tests; defaults to Date.now + setTimeout. */
  clock?: SchedulerClock;
  /** Called once per advanced tick (after world.step()). */
  onTick?: (tick: number) => void;
  /** Called when the catch-up cap is hit and ticks are dropped. */
  onOverrun?: (droppedTicks: number) => void;
  /**
   * Called when a tick (or its onTick callback) throws. The scheduler has already paused; the
   * world is faulted and `start()` will refuse until it is restored. `tick` is the tick the
   * world was on when it failed.
   */
  onError?: (error: Error, tick: number) => void;
}

/**
 * Drives a world at its fixed timestep using a setTimeout accumulator. The world itself is
 * clock-free; all real-time concerns live here. One implementation serves Worker and Node
 * (setTimeout exists in both). Tests inject a clock to avoid flaky real timers.
 */
export class Scheduler {
  private readonly clock: SchedulerClock;
  private readonly maxCatchUp: number;
  private rate: number;
  private timer: TimerHandle | undefined;
  private acc = 0;
  private last = 0;
  private _state: 'running' | 'paused' = 'paused';

  constructor(
    private readonly world: World,
    private readonly opts: SchedulerOptions = {},
  ) {
    this.clock = opts.clock ?? realClock;
    this.maxCatchUp = opts.maxCatchUpTicks ?? 5;
    if (!Number.isSafeInteger(this.maxCatchUp) || this.maxCatchUp <= 0) {
      throw new RangeError('maxCatchUpTicks must be a positive safe integer');
    }
    this.rate = validateRate(opts.rate ?? 1);
  }

  get state(): 'running' | 'paused' {
    return this._state;
  }

  /**
   * Start or resume. Refuses a faulted world: a tick that threw leaves the world unable to step
   * (World.step throws on every call after a fault), so silently "resuming" would spin a dead
   * loop. Recovery is explicit — rebuild the world, or restore a keyframe with `applyKeyframeTo`,
   * which clears the fault — and then call `start()` again.
   */
  start(): void {
    const fault = this.world.faulted;
    if (fault !== undefined) {
      throw new Error(
        `scheduler cannot resume a faulted world: ${fault.message} — restore a keyframe (applyKeyframeTo) or rebuild the world first`,
        { cause: fault },
      );
    }
    if (this._state === 'running') return;
    this._state = 'running';
    this.last = this.clock.now();
    this.acc = 0;
    this.scheduleNext();
  }

  pause(): void {
    this._state = 'paused';
    if (this.timer !== undefined) {
      this.clock.clearTimer(this.timer);
      this.timer = undefined;
    }
  }

  setRate(rate: number): void {
    this.rate = validateRate(rate);
  }

  /**
   * Run n ticks synchronously (manual stepping while paused). A failing tick pauses the
   * scheduler and reports through `onError` like a timer-driven one, then rethrows so the
   * synchronous caller sees it too.
   */
  step(n = 1): void {
    if (!Number.isSafeInteger(n) || n < 0 || n > 100_000) {
      throw new RangeError('step count must be a safe integer between 0 and 100000');
    }
    for (let i = 0; i < n; i++) {
      const error = this.runTick();
      if (error !== undefined) throw error;
    }
  }

  /**
   * One tick plus its onTick callback. Returns the failure rather than throwing: an exception
   * escaping a timer callback kills the loop with no timer rescheduled, the state still
   * 'running' (so start() is a no-op forever) and nothing sent to the page. Pause and report
   * instead, and leave the fault on the world so resuming has to be deliberate.
   */
  private runTick(): Error | undefined {
    try {
      this.world.step();
      this.opts.onTick?.(this.world.tick);
      return undefined;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.pause();
      this.opts.onError?.(error, this.world.tick);
      return error;
    }
  }

  private dtMs(): number {
    return 1000 / this.world.tickRate / this.rate;
  }

  private scheduleNext(): void {
    if (this._state !== 'running') return;
    this.timer = this.clock.setTimer(() => this.wake(), this.dtMs());
  }

  private wake(): void {
    if (this._state !== 'running') return;
    const now = this.clock.now();
    this.acc += now - this.last;
    this.last = now;
    const dtMs = this.dtMs();

    let ran = 0;
    while (this.acc >= dtMs && ran < this.maxCatchUp) {
      // A failed tick has already paused and reported; stop without rescheduling a timer.
      if (this.runTick() !== undefined) return;
      this.acc -= dtMs;
      ran++;
    }
    if (this.acc >= dtMs) {
      // Still behind after the cap: drop the debt to avoid spiral-of-death.
      const dropped = Math.floor(this.acc / dtMs);
      this.acc = 0;
      this.opts.onOverrun?.(dropped);
    }
    this.scheduleNext();
  }
}

function validateRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    throw new RangeError('scheduler rate must be finite and greater than 0 (maximum 100)');
  }
  return rate;
}

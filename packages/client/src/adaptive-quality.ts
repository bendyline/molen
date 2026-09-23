export interface AdaptiveQualityOptions {
  /** Integer detail levels increase with quality. The host maps them to its own budgets. */
  minLevel?: number;
  maxLevel?: number;
  initialLevel?: number;
  targetFrameMs?: number;
  /** Measurements are evaluated in windows; frame samples alone never change quality. */
  evaluationIntervalMs?: number;
  warmupMs?: number;
  /** Sustained overload before stepping down; memory pressure bypasses this delay. */
  decreaseDelayMs?: number;
  /** Stable headroom before probing one higher level. Failed probes increase this delay. */
  increaseDelayMs?: number;
  cooldownMs?: number;
  /** An isolated longer interval is treated as a pause; repeated ones remain overload. */
  pauseFrameMs?: number;
}

export interface AdaptiveQualitySample {
  /** False while hidden, suspended, or deliberately not rendering. Resets measurement history. */
  active?: boolean;
  /** Loading may lower detail under sustained overload, but never authorizes an upgrade. */
  loading?: boolean;
  /** Optional measured work, excluding waiting for the next animation frame. */
  cpuFrameMs?: number;
  /** Supply only a completed, valid asynchronous GPU timing query. */
  gpuFrameMs?: number;
  /** Estimated resident working set / memory budget. Values above one lower detail. */
  memoryPressure?: number;
}

export type AdaptiveQualityReason = 'frame-time' | 'memory-pressure' | 'headroom' | 'manual';

export interface AdaptiveQualityChange {
  previousLevel: number;
  level: number;
  reason: AdaptiveQualityReason;
}

export interface AdaptiveQualityStats {
  level: number;
  targetFrameMs: number;
  /** Exponentially smoothed, trimmed frame time; undefined before the first complete window. */
  smoothedFrameMs: number | undefined;
  p90FrameMs: number | undefined;
  slowFrameRatio: number;
  /** Valid samples in the most recently completed measurement window. */
  samples: number;
  changes: number;
  recoveryDelayMs: number;
  reason: AdaptiveQualityReason | undefined;
}

function positive(value: number, name: string, allowZero = false): number {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(
      `${name} must be a finite ${allowZero ? 'nonnegative' : 'positive'} number`,
    );
  }
  return value;
}

function levelBounds(min: number, max: number): void {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) {
    throw new RangeError('Quality levels must be nonnegative integers with minLevel <= maxLevel');
  }
}

/**
 * Rendering-only feedback controller; does not change simulation state or depend on a browser.
 * Lower quickly, recover slowly, and probe with backoff instead of oscillating between tiers.
 * Hosts should apply a change atomically to resolution, screen-space error, and residency.
 */
export class AdaptiveQualityController {
  private minLevel: number;
  private maxLevel: number;
  private level: number;
  private readonly targetFrameMs: number;
  private readonly evaluationIntervalMs: number;
  private readonly warmupMs: number;
  private readonly decreaseDelayMs: number;
  private readonly increaseDelayMs: number;
  private readonly cooldownMs: number;
  private readonly pauseFrameMs: number;
  private readonly frames: number[] = [];
  private frameCursor = 0;
  private clockMs = 0;
  private windowMs = 0;
  private warmupElapsedMs = 0;
  private lastChangeMs = Number.NEGATIVE_INFINITY;
  private overloadMs = 0;
  private headroomMs = 0;
  private loading = false;
  private cpuTotalMs = 0;
  private cpuSamples = 0;
  private gpuTotalMs = 0;
  private gpuSamples = 0;
  private memoryTotal = 0;
  private memorySamples = 0;
  private previousPause = false;
  private smoothedFrameMs: number | undefined;
  private p90FrameMs: number | undefined;
  private slowFrameRatio = 0;
  private samples = 0;
  private changes = 0;
  private reason: AdaptiveQualityReason | undefined;
  private recoveryMultiplier = 1;
  private lastUpgradeMs = Number.NEGATIVE_INFINITY;

  constructor(options: AdaptiveQualityOptions = {}) {
    this.minLevel = options.minLevel ?? 0;
    this.maxLevel = options.maxLevel ?? 5;
    levelBounds(this.minLevel, this.maxLevel);
    const initial = options.initialLevel ?? Math.min(3, this.maxLevel);
    if (!Number.isSafeInteger(initial)) throw new RangeError('initialLevel must be an integer');
    this.level = Math.max(this.minLevel, Math.min(this.maxLevel, initial));
    this.targetFrameMs = positive(options.targetFrameMs ?? 1000 / 60, 'targetFrameMs');
    this.evaluationIntervalMs = positive(
      options.evaluationIntervalMs ?? 1000,
      'evaluationIntervalMs',
    );
    this.warmupMs = positive(options.warmupMs ?? 1500, 'warmupMs', true);
    this.decreaseDelayMs = positive(options.decreaseDelayMs ?? 1000, 'decreaseDelayMs', true);
    this.increaseDelayMs = positive(options.increaseDelayMs ?? 10000, 'increaseDelayMs');
    this.cooldownMs = positive(options.cooldownMs ?? 2000, 'cooldownMs', true);
    this.pauseFrameMs = positive(options.pauseFrameMs ?? 1000, 'pauseFrameMs');
  }

  /** No allocation in the usual per-frame path. A change object is returned only on a step. */
  sample(frameMs: number, sample: AdaptiveQualitySample = {}): AdaptiveQualityChange | undefined {
    if (sample.active === false) {
      this.resetMeasurements();
      this.previousPause = false;
      return;
    }
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    if (frameMs > this.pauseFrameMs && !this.previousPause) {
      this.resetMeasurements();
      this.previousPause = true;
      return;
    }
    this.previousPause = frameMs > this.pauseFrameMs;
    // Repeated very long frames count as overload, while a single pause cannot poison recovery.
    const elapsed = Math.min(frameMs, this.pauseFrameMs);
    this.clockMs += elapsed;
    this.windowMs += elapsed;
    this.warmupElapsedMs += elapsed;
    // Bound storage even at very high refresh rates. All auxiliary metrics remain accumulated.
    if (this.frames.length < 512) this.frames.push(elapsed);
    else this.frames[this.frameCursor++ % 512] = elapsed;
    this.loading ||= sample.loading === true;
    if (Number.isFinite(sample.cpuFrameMs) && (sample.cpuFrameMs ?? 0) > 0) {
      this.cpuTotalMs += sample.cpuFrameMs ?? 0;
      this.cpuSamples++;
    }
    if (Number.isFinite(sample.gpuFrameMs) && (sample.gpuFrameMs ?? 0) > 0) {
      this.gpuTotalMs += sample.gpuFrameMs ?? 0;
      this.gpuSamples++;
    }
    if (Number.isFinite(sample.memoryPressure) && (sample.memoryPressure ?? -1) >= 0) {
      this.memoryTotal += sample.memoryPressure ?? 0;
      this.memorySamples++;
    }
    if (this.windowMs < this.evaluationIntervalMs || this.frames.length < 8) return;
    return this.evaluate();
  }

  getStats(): AdaptiveQualityStats {
    return {
      level: this.level,
      targetFrameMs: this.targetFrameMs,
      smoothedFrameMs: this.smoothedFrameMs,
      p90FrameMs: this.p90FrameMs,
      slowFrameRatio: this.slowFrameRatio,
      samples: this.samples,
      changes: this.changes,
      recoveryDelayMs: this.increaseDelayMs * this.recoveryMultiplier,
      reason: this.reason,
    };
  }

  /** Set a manual tier or restart automatic adaptation without carrying stale timing samples. */
  setLevel(level: number): AdaptiveQualityChange | undefined {
    if (!Number.isSafeInteger(level)) throw new RangeError('level must be an integer');
    const clamped = Math.max(this.minLevel, Math.min(this.maxLevel, level));
    const change = clamped === this.level ? undefined : this.change(clamped, 'manual');
    this.recoveryMultiplier = 1;
    this.lastUpgradeMs = Number.NEGATIVE_INFINITY;
    this.resetMeasurements();
    this.previousPause = false;
    return change;
  }

  /** Change a user/device ceiling and floor; an out-of-bounds current level is clamped. */
  setBounds(minLevel: number, maxLevel: number): AdaptiveQualityChange | undefined {
    levelBounds(minLevel, maxLevel);
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    return this.setLevel(this.level);
  }

  private evaluate(): AdaptiveQualityChange | undefined {
    const ordered = this.frames.slice().sort((a, b) => a - b);
    const trim = Math.floor(ordered.length * 0.1);
    const middle = ordered.slice(trim, ordered.length - trim);
    const mean = middle.reduce((total, value) => total + value, 0) / middle.length;
    const elapsed = this.windowMs;
    const alpha = 1 - Math.exp(-elapsed / 1500);
    this.smoothedFrameMs =
      this.smoothedFrameMs === undefined
        ? mean
        : this.smoothedFrameMs + alpha * (mean - this.smoothedFrameMs);
    this.p90FrameMs = ordered[Math.ceil(ordered.length * 0.9) - 1] ?? mean;
    this.slowFrameRatio =
      ordered.filter((value) => value > this.targetFrameMs * 1.25).length / ordered.length;
    this.samples = ordered.length;
    const memory = this.memorySamples > 0 ? this.memoryTotal / this.memorySamples : 0;
    // GPU results often arrive for only a subset of frames. Averaging with unsampled CPU-only
    // frames would hide GPU saturation and authorize an unsafe detail upgrade.
    const work = Math.max(
      this.cpuSamples > 0 ? this.cpuTotalMs / this.cpuSamples : 0,
      this.gpuSamples > 0 ? this.gpuTotalMs / this.gpuSamples : 0,
    );
    const loading = this.loading;
    this.resetWindow();
    const overloaded =
      mean > this.targetFrameMs * 1.18 ||
      (this.p90FrameMs > this.targetFrameMs * 1.5 && this.slowFrameRatio >= 0.25);
    // RAF cadence is refresh-limited, so sustained on-target frames authorize a cautious probe.
    // Real CPU/GPU work, when supplied, must also have margin; submission time is not GPU time.
    const headroom =
      !loading &&
      memory < 0.85 &&
      mean <= this.targetFrameMs * 1.05 &&
      this.p90FrameMs <= this.targetFrameMs * 1.15 &&
      work < this.targetFrameMs * 0.9;
    this.overloadMs = overloaded ? this.overloadMs + elapsed : 0;
    this.headroomMs = headroom ? this.headroomMs + elapsed : 0;
    if (this.warmupElapsedMs < this.warmupMs) return;
    // Memory is a hard resource budget, so it may step down during the normal timing cooldown.
    if (memory > 1 && this.level > this.minLevel) {
      return this.change(this.level - 1, 'memory-pressure');
    }
    if (this.clockMs - this.lastChangeMs < this.cooldownMs) return;
    if (overloaded && this.overloadMs >= this.decreaseDelayMs && this.level > this.minLevel) {
      return this.change(this.level - 1, 'frame-time');
    }
    if (
      headroom &&
      this.headroomMs >= this.increaseDelayMs * this.recoveryMultiplier &&
      this.level < this.maxLevel
    ) {
      return this.change(this.level + 1, 'headroom');
    }
    return;
  }

  private change(level: number, reason: AdaptiveQualityReason): AdaptiveQualityChange {
    const previousLevel = this.level;
    if (reason === 'headroom') this.lastUpgradeMs = this.clockMs;
    else if (
      reason !== 'manual' &&
      this.clockMs - this.lastUpgradeMs < Math.max(15000, this.cooldownMs * 3)
    ) {
      this.recoveryMultiplier = Math.min(6, this.recoveryMultiplier * 2);
      this.lastUpgradeMs = Number.NEGATIVE_INFINITY;
    }
    this.level = level;
    this.reason = reason;
    this.changes++;
    this.lastChangeMs = this.clockMs;
    this.overloadMs = 0;
    this.headroomMs = 0;
    return { previousLevel, level, reason };
  }

  private resetWindow(): void {
    this.frames.length = 0;
    this.frameCursor = 0;
    this.windowMs = 0;
    this.loading = false;
    this.cpuTotalMs = 0;
    this.cpuSamples = 0;
    this.gpuTotalMs = 0;
    this.gpuSamples = 0;
    this.memoryTotal = 0;
    this.memorySamples = 0;
  }

  private resetMeasurements(): void {
    this.resetWindow();
    this.warmupElapsedMs = 0;
    this.overloadMs = 0;
    this.headroomMs = 0;
    this.smoothedFrameMs = undefined;
    this.p90FrameMs = undefined;
    this.slowFrameRatio = 0;
    this.samples = 0;
  }
}

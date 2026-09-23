/**
 * Transient-failure policy shared by the fixed-grid and pyramid terrain streamers.
 *
 * A tile that a source reports as absent (`undefined`, e.g. HTTP 404) is *missing*: stable, never
 * retried on its own. Anything thrown — a dropped range request, a 503, a CORS failure, a reader
 * that cannot read a response — is *transient*: retried with bounded exponential backoff and then
 * abandoned, so a streamer distinguishes "still retrying" from "gave up" instead of turning every
 * hiccup into a permanent hole.
 */

export interface TerrainTileRetryOptions {
  /** Retries after the first failed attempt before a tile is abandoned. Default 3; 0 disables. */
  maxRetries?: number;
  /** First backoff delay in milliseconds; doubles per attempt. Default 400. */
  retryDelayMs?: number;
  /** Ceiling for one backoff delay. Default 8000. */
  maxRetryDelayMs?: number;
  /** Per-request deadline in milliseconds. Default 20000; 0 or Infinity disables it. */
  requestTimeoutMs?: number;
}

export interface TerrainTileRetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  requestTimeoutMs: number;
}

/** Why a tile is not resident. `retrying` still has attempts left; `failed` has spent them. */
export type TerrainTileLoadState = 'missing' | 'retrying' | 'failed';

export interface TerrainTileFailure<TAddress> {
  address: TAddress;
  state: TerrainTileLoadState;
  /** Completed load attempts. Zero for a missing tile, which was answered, not failed. */
  attempts: number;
  /** Wall-clock milliseconds of the scheduled next attempt, while one is waiting. */
  nextAttemptAt?: number;
  /** The last thrown error; absent for a missing tile. */
  error?: unknown;
}

export function resolveTerrainTileRetryPolicy(
  options: TerrainTileRetryOptions = {},
): TerrainTileRetryPolicy {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 400;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 8_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new Error('terrain stream maxRetries must be a non-negative safe integer');
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs <= 0) {
    throw new Error('terrain stream retryDelayMs must be finite and positive');
  }
  if (!Number.isFinite(maxRetryDelayMs) || maxRetryDelayMs < retryDelayMs) {
    throw new Error('terrain stream maxRetryDelayMs must be finite and >= retryDelayMs');
  }
  if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs < 0) {
    throw new Error('terrain stream requestTimeoutMs must be zero, positive, or Infinity');
  }
  return { maxRetries, retryDelayMs, maxRetryDelayMs, requestTimeoutMs };
}

/** Backoff for the Nth completed attempt (1-based), doubling up to the configured ceiling. */
export function terrainTileRetryDelay(policy: TerrainTileRetryPolicy, attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(policy.maxRetryDelayMs, policy.retryDelayMs * 2 ** exponent);
}

/** True for both `AbortSignal.timeout` rejections and this module's normalized timeout errors. */
export function isTerrainTileTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'TimeoutError'
  );
}

function timeoutError(timeoutMs: number, cause: unknown): Error {
  const error = new Error(`terrain tile request timed out after ${timeoutMs} ms`, { cause });
  error.name = 'TimeoutError';
  return error;
}

/**
 * Run one tile request under a deadline composed with the streamer's evict-abort signal.
 *
 * The deadline is also raced against the request itself: a source that ignores its signal (or a
 * connection that stalls below the transport's own timeouts) must not pin a concurrency slot
 * forever. A timeout rejects with a `TimeoutError`, which is transient, unlike an evict abort.
 */
export async function loadTerrainTileWithTimeout<T>(
  load: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return load(signal);
  const timeout = new AbortController();
  const composed = AbortSignal.any([signal, timeout.signal]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = (): void => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    timer = setTimeout(() => {
      const error = timeoutError(timeoutMs, undefined);
      timeout.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([load(composed), deadline]);
  } catch (error) {
    // A source that rethrows its own AbortError still failed because of the deadline, unless the
    // streamer itself aborted the request (an evict), which stays a cancellation.
    const expired = isTerrainTileTimeout(error) || (timeout.signal.aborted && !signal.aborted);
    throw expired ? timeoutError(timeoutMs, error) : error;
  } finally {
    // A layer may retain its signal to dispose live geometry on eviction. A completed load
    // must not receive a delayed timeout that tears down its successfully published content.
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

interface RetryEntry<TAddress> {
  address: TAddress;
  state: TerrainTileLoadState;
  attempts: number;
  nextAttemptAt?: number;
  error?: unknown;
  timer?: ReturnType<typeof setTimeout>;
  /** A scheduled backoff has elapsed, so the tile may be queued again. */
  due: boolean;
}

/**
 * Per-tile missing/retry/abandoned bookkeeping. Keyed by the streamer's own tile key so both the
 * fixed-grid and pyramid addresses reuse one policy.
 */
export class TerrainTileRetryTracker<TAddress> {
  private readonly entries = new Map<string, RetryEntry<TAddress>>();

  constructor(readonly policy: TerrainTileRetryPolicy) {}

  /** The source answered "no such tile". Stable until an explicit retryFailed(). */
  markMissing(key: string, address: TAddress): void {
    this.cancelTimer(key);
    this.entries.set(key, { address, state: 'missing', attempts: 0, due: false });
  }

  /**
   * Record a thrown error. Schedules the next attempt and returns `retrying`, or returns `failed`
   * once the attempt budget is spent. `onDue` runs when that next attempt may start.
   */
  markFailed(
    key: string,
    address: TAddress,
    error: unknown,
    onDue: () => void,
  ): TerrainTileLoadState {
    const attempts = (this.entries.get(key)?.attempts ?? 0) + 1;
    this.cancelTimer(key);
    if (attempts > this.policy.maxRetries) {
      this.entries.set(key, { address, state: 'failed', attempts, error, due: false });
      return 'failed';
    }
    const delay = terrainTileRetryDelay(this.policy, attempts);
    const entry: RetryEntry<TAddress> = {
      address,
      state: 'retrying',
      attempts,
      nextAttemptAt: Date.now() + delay,
      error,
      due: false,
    };
    entry.timer = setTimeout(() => {
      entry.due = true;
      delete entry.timer;
      delete entry.nextAttemptAt;
      onDue();
    }, delay);
    this.entries.set(key, entry);
    return 'retrying';
  }

  /** Loading is blocked: the tile is missing, abandoned, or waiting out a backoff delay. */
  isBlocked(key: string): boolean {
    const entry = this.entries.get(key);
    if (entry === undefined) return false;
    return entry.state !== 'retrying' || !entry.due;
  }

  /** Backoff delays still counting down; the stream is not idle while any remain. */
  scheduledRetries(): number {
    let count = 0;
    for (const entry of this.entries.values()) if (entry.timer !== undefined) count++;
    return count;
  }

  /** Forget one tile, after it loads. */
  clear(key: string): void {
    this.cancelTimer(key);
    this.entries.delete(key);
  }

  /** Forget every recorded failure, for an explicit host-driven retry. */
  clearAll(): void {
    for (const key of [...this.entries.keys()]) this.cancelTimer(key);
    this.entries.clear();
  }

  state(key: string): TerrainTileLoadState | undefined {
    return this.entries.get(key)?.state;
  }

  /** Keys that will not load again on their own: missing tiles and abandoned ones. */
  stableKeys(): string[] {
    const keys: string[] = [];
    for (const [key, entry] of this.entries) if (entry.state !== 'retrying') keys.push(key);
    return keys;
  }

  failures(): Array<TerrainTileFailure<TAddress>> {
    return [...this.entries.values()].map((entry) => ({
      address: entry.address,
      state: entry.state,
      attempts: entry.attempts,
      ...(entry.nextAttemptAt !== undefined ? { nextAttemptAt: entry.nextAttemptAt } : {}),
      ...(entry.error !== undefined ? { error: entry.error } : {}),
    }));
  }

  counts(): { missing: number; retrying: number; failed: number } {
    let missing = 0;
    let retrying = 0;
    let failed = 0;
    for (const entry of this.entries.values()) {
      if (entry.state === 'missing') missing++;
      else if (entry.state === 'retrying') retrying++;
      else failed++;
    }
    return { missing, retrying, failed };
  }

  dispose(): void {
    this.clearAll();
  }

  private cancelTimer(key: string): void {
    const entry = this.entries.get(key);
    if (entry?.timer === undefined) return;
    clearTimeout(entry.timer);
    delete entry.timer;
  }
}

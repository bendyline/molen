import { expect, it, vi } from 'vitest';
import {
  loadTerrainTileWithTimeout,
  resolveTerrainTileRetryPolicy,
  TerrainTileRetryTracker,
} from '../src/tile-retry';

it('cancels a completed request deadline while preserving later owner cancellation', async () => {
  vi.useFakeTimers();
  const owner = new AbortController();
  let retained: AbortSignal | undefined;
  try {
    const result = await loadTerrainTileWithTimeout(
      async (signal) => {
        retained = signal;
        return 'published';
      },
      owner.signal,
      20,
    );
    expect(result).toBe('published');
    await vi.advanceTimersByTimeAsync(100);
    expect(retained?.aborted).toBe(false);
    owner.abort();
    expect(retained?.aborted).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it('aborts and rejects a stalled request even when the source ignores cancellation', async () => {
  vi.useFakeTimers();
  let retained: AbortSignal | undefined;
  try {
    const request = loadTerrainTileWithTimeout(
      (signal) => {
        retained = signal;
        return new Promise(() => {});
      },
      new AbortController().signal,
      20,
    );
    const rejected = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(20);
    await rejected;
    expect(retained?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('releases a stalled request and its deadline when the owner cancels', async () => {
  vi.useFakeTimers();
  const owner = new AbortController();
  try {
    const request = loadTerrainTileWithTimeout(() => new Promise(() => {}), owner.signal, 120_000);
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    owner.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('forgets unwanted failures only once their wait is over', () => {
  vi.useFakeTimers();
  try {
    const tracker = new TerrainTileRetryTracker<string>(
      resolveTerrainTileRetryPolicy({
        maxRetries: 1,
        retryDelayMs: 100,
        failedRetryDelayMs: 1_000,
      }),
    );
    const onDue = (): void => {};
    tracker.markMissing('missing', 'missing');
    tracker.markFailed('retrying', 'retrying', new Error('dropped'), onDue);
    tracker.markFailed('failed', 'failed', new Error('dropped'), onDue);
    tracker.markFailed('failed', 'failed', new Error('dropped'), onDue);
    tracker.markFailed('wanted', 'wanted', new Error('dropped'), onDue);
    tracker.markFailed('wanted', 'wanted', new Error('dropped'), onDue);
    expect(tracker.counts()).toEqual({ missing: 1, retrying: 1, failed: 2 });
    const wanted = (key: string): boolean => key === 'wanted';

    // Nothing has finished waiting: a camera passing back and forth cannot skip a delay.
    tracker.forgetUnwanted(wanted);
    expect(tracker.counts()).toEqual({ missing: 1, retrying: 1, failed: 2 });

    vi.advanceTimersByTime(100);
    tracker.forgetUnwanted(wanted);
    expect(tracker.counts()).toEqual({ missing: 1, retrying: 0, failed: 2 });

    vi.advanceTimersByTime(900);
    expect(tracker.isBlocked('wanted')).toBe(false);
    tracker.forgetUnwanted(wanted);
    // The 404 is an answer, and the wanted tile is about to be tried again.
    expect(tracker.counts()).toEqual({ missing: 1, retrying: 0, failed: 1 });
    expect(tracker.state('wanted')).toBe('failed');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps abandoned tiles for retryFailed() when the cool-down is disabled', () => {
  vi.useFakeTimers();
  try {
    const tracker = new TerrainTileRetryTracker<string>(
      resolveTerrainTileRetryPolicy({ maxRetries: 0, failedRetryDelayMs: 0 }),
    );
    tracker.markFailed('tile', 'tile', new Error('dropped'), () => {});
    vi.advanceTimersByTime(24 * 60 * 60 * 1_000);
    tracker.forgetUnwanted(() => false);
    expect(tracker.isBlocked('tile')).toBe(true);
    expect(tracker.failures()).toMatchObject([{ state: 'failed', attempts: 1 }]);
    expect(tracker.failures()[0]?.nextAttemptAt).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

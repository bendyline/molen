import { expect, it, vi } from 'vitest';
import { loadTerrainTileWithTimeout } from '../src/tile-retry';

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

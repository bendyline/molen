import { describe, expect, it } from 'vitest';
import { ReadScheduler } from '../src/source';
import { noise } from './helpers';

function slowReader(bytes: Uint8Array) {
  const state = { inFlight: 0, peak: 0, reads: [] as { offset: number; length: number }[] };
  return {
    state,
    reader: {
      size: bytes.length,
      read: async (offset: number, length: number) => {
        state.reads.push({ offset, length });
        state.inFlight++;
        state.peak = Math.max(state.peak, state.inFlight);
        await new Promise((done) => setTimeout(done, 5));
        state.inFlight--;
        return bytes.slice(offset, offset + length);
      },
    },
  };
}

describe('ReadScheduler', () => {
  const bytes = noise(1_000_000);

  it('merges reads that are close together and slices each caller its bytes', async () => {
    const { state, reader } = slowReader(bytes);
    const scheduler = new ReadScheduler(reader, new AbortController().signal);
    const [a, b, c] = await Promise.all([
      scheduler.read(100, 50),
      scheduler.read(10_000, 20),
      scheduler.read(500_000, 10),
    ]);
    expect(a).toEqual(bytes.subarray(100, 150));
    expect(b).toEqual(bytes.subarray(10_000, 10_020));
    expect(c).toEqual(bytes.subarray(500_000, 500_010));
    // 100 and 10 000 are within the 32 KiB gap; 500 000 is not.
    expect(state.reads).toEqual([
      { offset: 100, length: 9_920 },
      { offset: 500_000, length: 10 },
    ]);
  });

  it('keeps at most `concurrency` reads in flight, high priority first', async () => {
    const { state, reader } = slowReader(bytes);
    const scheduler = new ReadScheduler(reader, new AbortController().signal, { concurrency: 2 });
    await Promise.all([0, 1, 2, 3, 4, 5].map((i) => scheduler.read(i * 100_000, 10, i === 5)));
    expect(state.peak).toBe(2);
    // Read 5 was the only high-priority one, so it went first.
    expect(state.reads[0]?.offset).toBe(500_000);
  });

  it('rejects queued reads once its signal aborts', async () => {
    const controller = new AbortController();
    const { reader } = slowReader(bytes);
    const scheduler = new ReadScheduler(reader, controller.signal);
    controller.abort(new Error('closed'));
    await expect(scheduler.read(0, 10)).rejects.toThrow('closed');
  });
});

import { WebGPUBackend, type WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import {
  createWebGpuFrameTimer,
  installWebGpuTimestampGuard,
} from '../src/three/webgpu-frame-timer';

function fakeRenderer() {
  const pending: ReturnType<typeof Promise.withResolvers<number | undefined>>[] = [];
  const descriptor: { timestampWrites?: unknown } = {};
  const canvasTarget = {};
  const renderer = {
    backend: {
      trackTimestamp: false,
      initTimestampQuery: vi.fn(),
      get: vi.fn(() => ({ descriptor })),
    },
    getCanvasTarget: vi.fn(() => canvasTarget),
    hasFeature: vi.fn(() => true),
    resolveTimestampsAsync: vi.fn((_type: string) => {
      // Three only submits timestamp readback while tracking is enabled.
      expect(renderer.backend.trackTimestamp).toBe(true);
      const deferred = Promise.withResolvers<number | undefined>();
      pending.push(deferred);
      return deferred.promise;
    }),
  };
  return { renderer, pending, descriptor, input: renderer as unknown as WebGPURenderer };
}

describe('WebGPU frame timer', () => {
  it('returns no timer when timestamp queries are unsupported', () => {
    const { input, renderer } = fakeRenderer();
    renderer.hasFeature.mockReturnValue(false);
    expect(createWebGpuFrameTimer(input)).toBeUndefined();
    expect(renderer.hasFeature).toHaveBeenCalledWith('timestamp-query');
    expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    expect(renderer.backend.trackTimestamp).toBe(false);
  });

  it('does not wait in end or poll and bounds outstanding readback to one', async () => {
    const { input, renderer, pending } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 1 });
    expect(timer?.begin()).toBe(true);
    expect(renderer.backend.trackTimestamp).toBe(true);
    expect(timer?.begin()).toBe(false);
    expect(timer?.end()).toBeUndefined();
    expect(renderer.backend.trackTimestamp).toBe(false);
    for (let frame = 0; frame < 50; frame++) {
      expect(timer?.begin()).toBe(false);
      timer?.end();
      expect(timer?.poll()).toBeUndefined();
    }
    expect(renderer.resolveTimestampsAsync).toHaveBeenCalledExactlyOnceWith('render');
    pending[0]?.resolve(12.5);
    await pending[0]?.promise;
    expect(timer?.poll()).toBe(12.5);
    expect(timer?.poll()).toBeUndefined();
    expect(timer?.begin()).toBe(true);
    timer?.dispose();
  });

  it('samples at the configured frame interval after completed readbacks', async () => {
    const { input, pending } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 3 });
    const started: boolean[] = [];
    for (let frame = 0; frame < 7; frame++) {
      started.push(timer?.begin() ?? false);
      timer?.end();
      const current = pending.at(-1);
      current?.resolve(frame);
      await current?.promise;
      timer?.poll();
    }
    expect(started).toEqual([true, false, false, true, false, false, true]);
    timer?.dispose();
  });

  it('ignores absent and invalid results without reporting zero GPU work', async () => {
    const { input, pending } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 1 });
    for (const invalid of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(timer?.begin()).toBe(true);
      timer?.end();
      const current = pending.at(-1);
      current?.resolve(invalid);
      await current?.promise;
      expect(timer?.poll()).toBeUndefined();
    }
    expect(timer?.begin()).toBe(true);
    timer?.end();
    pending.at(-1)?.resolve(0);
    await pending.at(-1)?.promise;
    expect(timer?.poll()).toBe(0);
    timer?.dispose();
  });

  it('handles rejected readback without leaking a rejection or blocking future samples', async () => {
    const { input, pending, renderer } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 1 });
    timer?.begin();
    timer?.end();
    pending[0]?.reject(new Error('device readback failed'));
    await pending[0]?.promise.catch(() => undefined);
    expect(timer?.poll()).toBeUndefined();
    expect(renderer.backend.trackTimestamp).toBe(false);
    expect(timer?.begin()).toBe(true);
    timer?.end();
    pending[1]?.resolve(3);
    await pending[1]?.promise;
    expect(timer?.poll()).toBe(3);
    timer?.dispose();
  });

  it('recovers from synchronous readback errors and clears stale canvas writes', () => {
    const { input, renderer, descriptor } = fakeRenderer();
    renderer.resolveTimestampsAsync.mockImplementationOnce(() => {
      throw new Error('readback submission failed');
    });
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 1 });
    timer?.begin();
    descriptor.timestampWrites = { querySet: 'previous frame' };
    expect(() => timer?.end()).not.toThrow();
    expect(renderer.backend.trackTimestamp).toBe(false);
    expect(descriptor.timestampWrites).toBeUndefined();
    expect(timer?.poll()).toBeUndefined();
    expect(timer?.begin()).toBe(true);
    timer?.dispose();
  });

  it('allows one owner per renderer and waits for disposed pending readback before replacement', async () => {
    const { input, pending } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input);
    expect(timer).toBeDefined();
    expect(createWebGpuFrameTimer(input)).toBeUndefined();
    timer?.begin();
    timer?.end();
    timer?.dispose();
    expect(createWebGpuFrameTimer(input)).toBeUndefined();
    pending[0]?.resolve(6);
    await pending[0]?.promise;
    const replacement = createWebGpuFrameTimer(input);
    expect(replacement).toBeDefined();
    expect(replacement?.poll()).toBeUndefined();
    replacement?.dispose();
  });

  it('does not take ownership of another profiler that already enabled timestamp tracking', () => {
    const { input, renderer } = fakeRenderer();
    renderer.backend.trackTimestamp = true;
    expect(createWebGpuFrameTimer(input)).toBeUndefined();
    expect(renderer.backend.trackTimestamp).toBe(true);
  });

  it('drops late results after disposal and makes all subsequent calls harmless', async () => {
    const { input, pending, renderer } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input, { sampleEveryFrames: 1 });
    timer?.begin();
    timer?.end();
    timer?.dispose();
    pending[0]?.resolve(9);
    await pending[0]?.promise;
    expect(timer?.poll()).toBeUndefined();
    expect(timer?.begin()).toBe(false);
    timer?.end();
    timer?.dispose();
    expect(renderer.backend.trackTimestamp).toBe(false);
    expect(renderer.resolveTimestampsAsync).toHaveBeenCalledTimes(1);
  });

  it('disables active tracking when disposed before end', () => {
    const { input, renderer, descriptor } = fakeRenderer();
    const timer = createWebGpuFrameTimer(input);
    timer?.begin();
    descriptor.timestampWrites = { querySet: 'active frame' };
    expect(renderer.backend.trackTimestamp).toBe(true);
    timer?.dispose();
    expect(renderer.backend.trackTimestamp).toBe(false);
    expect(descriptor.timestampWrites).toBeUndefined();
    timer?.end();
    expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid sampling and pending-query bounds (%s)', (value) => {
    const { input } = fakeRenderer();
    expect(() => createWebGpuFrameTimer(input, { sampleEveryFrames: value })).toThrow(RangeError);
    expect(() => createWebGpuFrameTimer(input, { maxPendingQueries: value })).toThrow(RangeError);
  });
});

describe('pinned Three WebGPU timestamp descriptor guard', () => {
  it('clears reused canvas descriptors on untracked passes and keeps tracked queries working', () => {
    const backend = new WebGPUBackend({ trackTimestamp: false });
    const internal = backend as unknown as {
      trackTimestamp: boolean;
      timestampQueryPool: { render: unknown };
      initTimestampQuery(
        type: string,
        uid: string,
        descriptor: { timestampWrites?: unknown },
      ): void;
    };
    const allocate = vi.fn(() => 0);
    internal.timestampQueryPool.render = { querySet: {}, allocateQueriesForContext: allocate };
    const input = { backend } as unknown as WebGPURenderer;
    const descriptor: { timestampWrites?: unknown } = {};
    installWebGpuTimestampGuard(input);
    const guard = internal.initTimestampQuery;
    installWebGpuTimestampGuard(input);
    expect(internal.initTimestampQuery).toBe(guard);
    internal.trackTimestamp = true;
    internal.initTimestampQuery('render', 'screen:f1', descriptor);
    expect(descriptor.timestampWrites).toBeDefined();
    internal.trackTimestamp = false;
    internal.initTimestampQuery('render', 'screen:f2', descriptor);
    expect(descriptor.timestampWrites).toBeUndefined();
    expect(allocate).toHaveBeenCalledTimes(1);
    internal.trackTimestamp = true;
    internal.initTimestampQuery('render', 'screen:f3', descriptor);
    expect(descriptor.timestampWrites).toBeDefined();
    expect(allocate).toHaveBeenCalledTimes(2);
  });
});

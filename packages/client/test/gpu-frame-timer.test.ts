import { describe, expect, it, vi } from 'vitest';
import { createGpuFrameTimer } from '../src/three/gpu-frame-timer';

function fakeContext() {
  const extension = {
    TIME_ELAPSED_EXT: 0x88bf,
    GPU_DISJOINT_EXT: 0x8fbb,
    QUERY_COUNTER_BITS_EXT: 0x8864,
  };
  const state = {
    supported: true,
    bits: 64,
    lost: false,
    disjoint: false,
    allocationFails: false,
    current: null as WebGLQuery | null,
    results: new Map<WebGLQuery, { available: boolean; nanos: unknown }>(),
  };
  let nextId = 0;
  const gl = {
    canvas: new EventTarget(),
    CURRENT_QUERY: 0x8865,
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    isContextLost: vi.fn(() => state.lost),
    getExtension: vi.fn(() => (state.supported ? extension : null)),
    getQuery: vi.fn((_target: number, pname: number) =>
      pname === extension.QUERY_COUNTER_BITS_EXT ? state.bits : state.current,
    ),
    getParameter: vi.fn(() => {
      const disjoint = state.disjoint;
      state.disjoint = false;
      return disjoint;
    }),
    createQuery: vi.fn(() => {
      if (state.allocationFails) return null;
      const query = { id: ++nextId } as unknown as WebGLQuery;
      state.results.set(query, { available: false, nanos: 5_000_000 });
      return query;
    }),
    beginQuery: vi.fn((_target: number, query: WebGLQuery) => {
      state.current = query;
    }),
    endQuery: vi.fn(() => {
      state.current = null;
    }),
    deleteQuery: vi.fn((query: WebGLQuery) => {
      state.results.delete(query);
    }),
    getQueryParameter: vi.fn((query: WebGLQuery, pname: number): unknown => {
      const result = state.results.get(query);
      if (pname === 0x8867) return result?.available ?? false;
      if (!result?.available) throw new Error('A query result was read before it was available');
      return result.nanos;
    }),
  };
  return { gl, state, context: gl as unknown as WebGL2RenderingContext };
}

describe('GPU frame timer', () => {
  it('falls back for WebGL1, missing extensions, or unusable elapsed-time counters', () => {
    expect(createGpuFrameTimer({} as WebGLRenderingContext)).toBeUndefined();
    const { context, state } = fakeContext();
    state.supported = false;
    expect(createGpuFrameTimer(context)).toBeUndefined();
    state.supported = true;
    state.bits = 0;
    expect(createGpuFrameTimer(context)).toBeUndefined();
  });

  it('never reads an unavailable result and returns completed nanoseconds as milliseconds', () => {
    const { context, state, gl } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    expect(timer?.begin()).toBe(true);
    const query = state.current as WebGLQuery;
    timer?.end();
    expect(timer?.poll()).toBeUndefined();
    expect(gl.getQueryParameter).toHaveBeenCalledTimes(1);
    state.results.set(query, { available: true, nanos: 12_500_000 });
    expect(timer?.poll()).toBe(12.5);
    expect(gl.deleteQuery).toHaveBeenCalledWith(query);
    expect(timer?.poll()).toBeUndefined();
    timer?.dispose();
  });

  it('bounds outstanding queries and resumes after completed queries are released', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { maxPendingQueries: 2, sampleEveryFrames: 1 });
    for (let frame = 0; frame < 2; frame++) {
      expect(timer?.begin()).toBe(true);
      timer?.end();
    }
    for (let frame = 0; frame < 50; frame++) {
      expect(timer?.begin()).toBe(false);
      timer?.end();
      expect(timer?.poll()).toBeUndefined();
    }
    expect(gl.createQuery).toHaveBeenCalledTimes(2);
    let nanos = 1_000_000;
    for (const result of state.results.values()) {
      result.available = true;
      result.nanos = nanos++ * 2;
    }
    expect(timer?.poll()).toBe(2.000002);
    expect(timer?.begin()).toBe(true);
    timer?.dispose();
    expect(state.results.size).toBe(0);
  });

  it('samples at the configured frame interval', () => {
    const { context, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 3 });
    const started: boolean[] = [];
    for (let frame = 0; frame < 7; frame++) {
      started.push(timer?.begin() ?? false);
      timer?.end();
      for (const result of state.results.values()) result.available = true;
      timer?.poll();
    }
    expect(started).toEqual([true, false, false, true, false, false, true]);
    timer?.dispose();
  });

  it('discards every pending and active query when timing becomes disjoint', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    timer?.begin();
    timer?.end();
    timer?.begin();
    for (const result of state.results.values()) result.available = true;
    state.disjoint = true;
    expect(timer?.poll()).toBeUndefined();
    expect(state.current).toBeNull();
    expect(state.results.size).toBe(0);
    expect(gl.getQueryParameter).not.toHaveBeenCalled();
    expect(timer?.begin()).toBe(true);
    timer?.dispose();
  });

  it('forgets invalid handles on context loss and reacquires the extension on restoration', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    timer?.begin();
    timer?.end();
    timer?.begin();
    state.lost = true;
    gl.canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(timer?.begin()).toBe(false);
    expect(timer?.poll()).toBeUndefined();
    timer?.end();
    // Lost contexts have already invalidated their queries; do not operate on stale handles.
    expect(gl.deleteQuery).not.toHaveBeenCalled();
    state.results.clear();
    state.current = null;
    state.lost = false;
    gl.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(gl.getExtension).toHaveBeenCalledTimes(2);
    expect(timer?.begin()).toBe(true);
    timer?.dispose();
    gl.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(gl.getExtension).toHaveBeenCalledTimes(2);
  });

  it('detects loss before the event arrives and tolerates extension loss after restoration', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context);
    timer?.begin();
    state.lost = true;
    expect(timer?.poll()).toBeUndefined();
    state.lost = false;
    state.supported = false;
    gl.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(timer?.begin()).toBe(false);
    timer?.dispose();
  });

  it('does not interfere with another profiler or allocate nested timer queries', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    state.current = {} as WebGLQuery;
    expect(timer?.begin()).toBe(false);
    timer?.end();
    expect(gl.endQuery).not.toHaveBeenCalled();
    state.current = null;
    expect(timer?.begin()).toBe(true);
    expect(timer?.begin()).toBe(false);
    expect(gl.createQuery).toHaveBeenCalledTimes(1);
    timer?.dispose();
  });

  it('ignores allocation failure and invalid completed measurements', () => {
    const { context, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    state.allocationFails = true;
    expect(timer?.begin()).toBe(false);
    state.allocationFails = false;
    for (const nanos of [-1, Number.NaN, Number.POSITIVE_INFINITY, '100']) {
      timer?.begin();
      state.results.set(state.current as WebGLQuery, { available: true, nanos });
      timer?.end();
      expect(timer?.poll()).toBeUndefined();
    }
    timer?.dispose();
  });

  it('disposes active/pending queries once and makes subsequent calls harmless', () => {
    const { context, gl, state } = fakeContext();
    const timer = createGpuFrameTimer(context, { sampleEveryFrames: 1 });
    timer?.begin();
    timer?.end();
    timer?.begin();
    timer?.dispose();
    expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
    expect(state.current).toBeNull();
    expect(timer?.begin()).toBe(false);
    timer?.end();
    expect(timer?.poll()).toBeUndefined();
    timer?.dispose();
    expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid bounds instead of creating an unbounded query queue', () => {
    const { context } = fakeContext();
    expect(() => createGpuFrameTimer(context, { maxPendingQueries: 0 })).toThrow(RangeError);
    expect(() => createGpuFrameTimer(context, { sampleEveryFrames: 1.2 })).toThrow(RangeError);
  });
});

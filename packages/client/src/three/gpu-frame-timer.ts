export interface GpuFrameTimerOptions {
  /** Maximum outstanding queries, including an active measurement. Default 4. */
  maxPendingQueries?: number;
  /** Sample one frame out of this many to limit instrumentation overhead. Default 4. */
  sampleEveryFrames?: number;
}

export interface GpuFrameTimer {
  /** Returns false when unsupported, busy, suspended, or this frame is not sampled. */
  begin(): boolean;
  /** Finish the measurement started by begin(); safe when begin() returned false. */
  end(): void;
  /** Poll once per animation frame. Returns the latest completed valid duration in milliseconds. */
  poll(): number | undefined;
  dispose(): void;
}

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
  QUERY_COUNTER_BITS_EXT: number;
}

/**
 * Optional WebGL2 timing. Reads a result only after QUERY_RESULT_AVAILABLE; never waits,
 * flushes, finishes, or schedules polling. Unavailable extensions return undefined.
 * Context restoration reacquires the extension and starts with fresh query objects.
 */
export function createGpuFrameTimer(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  options: GpuFrameTimerOptions = {},
): GpuFrameTimer | undefined {
  const capacity = options.maxPendingQueries ?? 4;
  const interval = options.sampleEveryFrames ?? 4;
  for (const [name, value] of [
    ['maxPendingQueries', capacity],
    ['sampleEveryFrames', interval],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive integer`);
    }
  }
  if (!('createQuery' in context)) return;
  const gl = context as WebGL2RenderingContext;
  const acquireExtension = (): TimerExtension | undefined => {
    if (gl.isContextLost()) return;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    if (!ext) return;
    const bits: unknown = gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT);
    if (typeof bits !== 'number' || !Number.isFinite(bits) || bits <= 0) return;
    return ext;
  };
  let extension = acquireExtension();
  if (!extension) return;
  let disposed = false;
  let lost = false;
  let untilSample = 0;
  let active: WebGLQuery | undefined;
  const pending: WebGLQuery[] = [];

  const abandon = (contextLost: boolean): void => {
    if (active) {
      if (!contextLost && extension) {
        if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === active) {
          gl.endQuery(extension.TIME_ELAPSED_EXT);
        }
        gl.deleteQuery(active);
      }
      active = undefined;
    }
    if (!contextLost) for (const query of pending) gl.deleteQuery(query);
    pending.length = 0;
    untilSample = 0;
  };
  const onContextLost = (): void => {
    lost = true;
    abandon(true);
    extension = undefined;
  };
  const onContextRestored = (): void => {
    if (disposed) return;
    lost = false;
    extension = acquireExtension();
  };
  const usable = (): boolean => {
    if (disposed || lost) return false;
    if (gl.isContextLost()) {
      onContextLost();
      return false;
    }
    return extension !== undefined;
  };
  const discardDisjoint = (): boolean => {
    if (!extension || !gl.getParameter(extension.GPU_DISJOINT_EXT)) return false;
    // Disjoint invalidates every outstanding measurement, including an unfinished one.
    abandon(false);
    return true;
  };

  gl.canvas.addEventListener('webglcontextlost', onContextLost);
  gl.canvas.addEventListener('webglcontextrestored', onContextRestored);
  return {
    begin(): boolean {
      if (!usable() || !extension || active) return false;
      if (untilSample > 0) {
        untilSample--;
        return false;
      }
      if (pending.length >= capacity || discardDisjoint()) return false;
      // Timer-query targets cannot be nested. Do not interfere with another profiler's query.
      if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== null) return false;
      const query = gl.createQuery();
      if (!query) return false;
      active = query;
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      untilSample = interval - 1;
      return true;
    },
    end(): void {
      if (!usable() || !extension || !active) return;
      const query = active;
      active = undefined;
      if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== query) {
        gl.deleteQuery(query);
        return;
      }
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      pending.push(query);
    },
    poll(): number | undefined {
      if (!usable() || !extension || (pending.length === 0 && !active)) return;
      if (discardDisjoint()) return;
      let latest: number | undefined;
      // At most capacity checks; unavailable results are never read and never waited on.
      while (pending.length > 0) {
        const query = pending[0];
        if (!query || !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        const nanos: unknown = gl.getQueryParameter(query, gl.QUERY_RESULT);
        gl.deleteQuery(query);
        pending.shift();
        if (typeof nanos === 'number' && Number.isFinite(nanos) && nanos >= 0) {
          latest = nanos / 1_000_000;
        }
      }
      return latest;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      abandon(lost || gl.isContextLost());
      gl.canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.canvas.removeEventListener('webglcontextrestored', onContextRestored);
      extension = undefined;
    },
  };
}

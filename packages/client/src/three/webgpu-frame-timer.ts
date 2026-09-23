import type { WebGPURenderer } from 'three/webgpu';
import type { GpuFrameTimer, GpuFrameTimerOptions } from './gpu-frame-timer';

interface TimestampDescriptor {
  timestampWrites?: unknown;
}

// Three r184 implements these backend fields but its published Backend types omit them.
// Keep this pinned-version adaptation local instead of weakening renderer types elsewhere.
interface TimestampBackend {
  trackTimestamp: boolean;
  initTimestampQuery(type: string, uid: string, descriptor: TimestampDescriptor): void;
  get(target: object): { descriptor?: TimestampDescriptor };
}

const guardedBackends = new WeakSet<object>();
const timingOwners = new WeakSet<WebGPURenderer>();

/**
 * Three r184 caches its canvas pass descriptor and leaves timestampWrites on it when timing
 * is disabled. Clear that stale state before an untracked pass, including after a target swap.
 * This guard lasts for the driver lifetime so disposing a timer cannot restore stale writes.
 */
export function installWebGpuTimestampGuard(renderer: WebGPURenderer): void {
  const backend = renderer.backend as unknown as TimestampBackend;
  if (guardedBackends.has(backend)) return;
  guardedBackends.add(backend);
  const initialize = backend.initTimestampQuery;
  backend.initTimestampQuery = (type, uid, descriptor): void => {
    if (!backend.trackTimestamp) {
      delete descriptor.timestampWrites;
      return;
    }
    initialize.call(backend, type, uid, descriptor);
  };
}

/** One asynchronous readback at a time; never wait for the GPU on the render loop. */
export function createWebGpuFrameTimer(
  renderer: WebGPURenderer,
  options: GpuFrameTimerOptions = {},
): GpuFrameTimer | undefined {
  const interval = options.sampleEveryFrames ?? 4;
  if (!Number.isSafeInteger(interval) || interval < 1) {
    throw new RangeError('sampleEveryFrames must be a positive integer');
  }
  if (
    options.maxPendingQueries !== undefined &&
    (!Number.isSafeInteger(options.maxPendingQueries) || options.maxPendingQueries < 1)
  ) {
    throw new RangeError('maxPendingQueries must be a positive integer');
  }
  if (!renderer.hasFeature('timestamp-query')) return;
  // One backend flag and query pool cannot be independently owned by multiple profilers.
  const backend = renderer.backend as unknown as TimestampBackend;
  if (timingOwners.has(renderer) || backend.trackTimestamp) return;
  installWebGpuTimestampGuard(renderer);
  timingOwners.add(renderer);
  let disposed = false;
  let active = false;
  let pending = false;
  let untilSample = 0;
  let latest: number | undefined;

  function disableTracking(): void {
    backend.trackTimestamp = false;
    // clear() can reuse the canvas descriptor without calling initTimestampQuery first.
    const descriptor = backend.get(renderer.getCanvasTarget()).descriptor;
    if (descriptor !== undefined) delete descriptor.timestampWrites;
  }

  function finishReadback(): void {
    pending = false;
    if (disposed) timingOwners.delete(renderer);
  }

  return {
    begin(): boolean {
      if (disposed || pending || active) return false;
      if (untilSample > 0) {
        untilSample--;
        return false;
      }
      backend.trackTimestamp = true;
      active = true;
      untilSample = interval - 1;
      return true;
    },
    end(): void {
      if (!active) return;
      active = false;
      pending = true;
      // Resolve while tracking is enabled: Three checks that flag before submitting readback.
      let result: Promise<number | undefined>;
      try {
        result = renderer.resolveTimestampsAsync('render');
      } catch {
        pending = false;
        latest = undefined;
        return;
      } finally {
        disableTracking();
      }
      void result.then(
        (milliseconds) => {
          finishReadback();
          if (disposed) return;
          latest =
            milliseconds !== undefined && Number.isFinite(milliseconds) && milliseconds >= 0
              ? milliseconds
              : undefined;
        },
        () => {
          finishReadback();
          latest = undefined; // Missing telemetry is never reported as zero GPU work.
        },
      );
    },
    poll(): number | undefined {
      const value = latest;
      latest = undefined;
      return value;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      active = false;
      latest = undefined;
      disableTracking();
      // A pending readback still owns Three's shared pool until it settles.
      if (!pending) timingOwners.delete(renderer);
    },
  };
}

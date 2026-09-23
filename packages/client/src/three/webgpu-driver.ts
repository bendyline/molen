import { CanvasTarget, WebGPUBackend, WebGPURenderer } from 'three/webgpu';
import type { RendererOptions } from './renderer';
import { installWebGpuDepthBiasGuard } from './webgpu-depth-bias';
import { installWebGpuTimestampGuard } from './webgpu-frame-timer';

/** Loaded only by the asynchronous backend factory, never by a legacy WebGL-only viewer. */
export async function createWebGpuDriver(options: RendererOptions): Promise<WebGPURenderer> {
  // Failed initialization must not lock the caller's canvas to another context type.
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
  canvas.width = 1;
  canvas.height = 1;
  const renderer = new WebGPURenderer({
    canvas,
    alpha: false,
    antialias: options.antialias ?? false,
    reversedDepthBuffer: options.reverseDepthBuffer ?? false,
    logarithmicDepthBuffer: options.logarithmicDepthBuffer ?? false,
    trackTimestamp: false,
    ...(options.powerPreference === 'high-performance' || options.powerPreference === 'low-power'
      ? { powerPreference: options.powerPreference }
      : {}),
  });
  // Three can replace this backend during init without disposing the original GPU device.
  const initialBackend = renderer.backend as WebGPUBackend & { dispose(): void };
  try {
    await renderer.init();
    // Use Molen's legacy renderer on fallback, preserving existing GLSL/capture behavior.
    if (!(renderer.backend instanceof WebGPUBackend)) {
      throw new Error('Three.js could not initialize a WebGPU adapter/device');
    }
    installWebGpuTimestampGuard(renderer);
    installWebGpuDepthBiasGuard(renderer);
    // r184 initializes devices eagerly, but canvas contexts lazily. Check configuration now
    // so context failures reach the async factory's WebGL fallback before the first frame.
    renderer.getContext();
    if (options.canvas !== undefined) {
      const previousTarget = renderer.getCanvasTarget();
      renderer.setCanvasTarget(new CanvasTarget(options.canvas));
      previousTarget.dispose();
      renderer.getContext();
    }
    renderer.info.autoReset = false; // Molen owns RAF and resets once per rendered frame.
    return renderer;
  } catch (error) {
    const initialized = renderer.hasInitialized();
    // In r184 dispose() before init settles re-enters the rejected init promise through
    // setAnimationLoop(), producing an unhandled rejection. Dispose the backend directly.
    if (initialized) renderer.dispose();
    if (!initialized || renderer.backend !== initialBackend) initialBackend.dispose();
    renderer.getCanvasTarget().dispose();
    throw error;
  }
}

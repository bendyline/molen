import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebGpuDriver } from '../src/three/webgpu-driver';

const mocks = vi.hoisted(() => ({ construct: vi.fn(), timestampGuard: vi.fn() }));

vi.mock('three/webgpu', () => ({
  WebGPUBackend: class {
    dispose = vi.fn();
  },
  WebGPURenderer: mocks.construct,
  CanvasTarget: class {
    constructor(readonly domElement: HTMLCanvasElement) {}
    dispose = vi.fn();
  },
}));
vi.mock('../src/three/webgpu-frame-timer', () => ({
  installWebGpuTimestampGuard: mocks.timestampGuard,
}));

describe('WebGPU driver initialization transaction', () => {
  let driver: ReturnType<typeof fakeDriver>;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    mocks.construct.mockReset();
    mocks.timestampGuard.mockReset();
    const { WebGPUBackend } = await import('three/webgpu');
    driver = fakeDriver(new WebGPUBackend());
    canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ width: 0, height: 0 })) });
    mocks.construct.mockImplementation(function MockRenderer() {
      return driver as unknown as WebGPURenderer;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('configures the staging context before attaching and configuring the supplied canvas', async () => {
    const stagingTarget = driver.target;
    const result = await createWebGpuDriver({ canvas, antialias: true });
    expect(result).toBe(driver);
    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({ canvas: expect.not.objectContaining({ width: 640 }) }),
    );
    expect(driver.contextTargets).toEqual([stagingTarget, driver.target]);
    expect(driver.target.domElement).toBe(canvas);
    expect(stagingTarget.dispose).toHaveBeenCalledOnce();
    expect(driver.info.autoReset).toBe(false);
    expect(mocks.timestampGuard).toHaveBeenCalledExactlyOnceWith(driver);
    expect(driver.dispose).not.toHaveBeenCalled();
  });

  it('rejects a staging canvas configuration failure without claiming the caller canvas', async () => {
    driver.getContext.mockImplementation(() => {
      throw new Error('canvas configuration rejected');
    });
    await expect(createWebGpuDriver({ canvas })).rejects.toThrow('canvas configuration rejected');
    expect(driver.setCanvasTarget).not.toHaveBeenCalled();
    expect(driver.dispose).toHaveBeenCalledOnce();
    expect(driver.target.dispose).toHaveBeenCalledOnce();
  });

  it('detects a supplied canvas already bound to an incompatible context before returning', async () => {
    driver.getContext.mockImplementation(() => {
      if (driver.target.domElement === canvas) throw new Error('canvas already uses WebGL');
      return {};
    });
    await expect(createWebGpuDriver({ canvas })).rejects.toThrow('canvas already uses WebGL');
    expect(driver.dispose).toHaveBeenCalledOnce();
    expect(driver.target.dispose).toHaveBeenCalledOnce();
  });

  it('releases a partially initialized GPU backend without calling the unsafe renderer disposer', async () => {
    driver.init.mockRejectedValue(new Error('device initialization failed'));
    await expect(createWebGpuDriver({ canvas })).rejects.toThrow('device initialization failed');
    expect(driver.backend.dispose).toHaveBeenCalledOnce();
    expect(driver.dispose).not.toHaveBeenCalled();
    expect(driver.getContext).not.toHaveBeenCalled();
  });

  it('disposes both the abandoned GPU backend and an initialized internal Three fallback', async () => {
    const gpuBackend = driver.backend;
    const fallbackBackend = { dispose: vi.fn() };
    driver.init.mockImplementation(async () => {
      driver.backend = fallbackBackend;
      driver.initialized = true;
    });
    await expect(createWebGpuDriver({ canvas })).rejects.toThrow(
      'could not initialize a WebGPU adapter/device',
    );
    expect(driver.dispose).toHaveBeenCalledOnce();
    expect(fallbackBackend.dispose).toHaveBeenCalledOnce();
    expect(gpuBackend.dispose).toHaveBeenCalledOnce();
    expect(driver.setCanvasTarget).not.toHaveBeenCalled();
  });
});

function fakeDriver(backend: object) {
  const driver = {
    backend: backend as { dispose(): void },
    initialized: false,
    target: { domElement: {} as HTMLCanvasElement, dispose: vi.fn() },
    contextTargets: [] as object[],
    info: { autoReset: true },
    init: vi.fn(async (): Promise<void> => {
      driver.initialized = true;
    }),
    hasInitialized: (): boolean => driver.initialized,
    getContext: vi.fn((): object => {
      driver.contextTargets.push(driver.target);
      return {};
    }),
    getCanvasTarget: () => driver.target,
    setCanvasTarget: vi.fn((target: typeof driver.target): void => {
      driver.target = target;
    }),
    dispose: vi.fn((): void => driver.backend.dispose()),
  };
  return driver;
}

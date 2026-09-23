import type { WebGLRenderer } from 'three';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Renderer, type RendererOptions } from '../src/three/renderer';

const factories = vi.hoisted(() => ({ webgl: vi.fn(), webgpu: vi.fn() }));

vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: factories.webgl,
}));

vi.mock('../src/three/webgpu-driver', () => ({ createWebGpuDriver: factories.webgpu }));

function fakeDriver() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    initTexture: vi.fn(),
    compileAsync: vi.fn(async (_object: THREE.Object3D) => {}),
    render: vi.fn(),
    info: { reset: vi.fn(), autoReset: true },
    autoClear: true,
    getRenderTarget: vi.fn(() => null),
    setRenderTarget: vi.fn(),
    setRenderObjectFunction: vi.fn(),
    backend: { updateBinding: vi.fn() },
    _nodes: { needsRefresh: vi.fn() },
    setOpaqueSort: vi.fn(),
    setTransparentSort: vi.fn(),
    dispose: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
    onDeviceLost: undefined as ((info: { message: string }) => void) | undefined,
  };
}

describe('renderer backend selection', () => {
  let webgl: ReturnType<typeof fakeDriver>;
  let webgpu: ReturnType<typeof fakeDriver>;

  beforeEach(() => {
    factories.webgl.mockReset();
    factories.webgpu.mockReset();
    webgl = fakeDriver();
    webgpu = fakeDriver();
    factories.webgl.mockImplementation(function MockWebGlRenderer() {
      return webgl as unknown as WebGLRenderer;
    });
    factories.webgpu.mockResolvedValue(webgpu as unknown as WebGPURenderer);
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({}) } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps a sky preview independent of the simulation clock and resumes on release', async () => {
    const renderer = await Renderer.create({ backend: 'webgl' });
    const epoch = Date.parse('2024-03-20T12:00:00Z');
    renderer.setEnvironmentTimeOverride(43200);
    renderer.setSky({
      mode: 'earth',
      observer: { latitude: 0, longitude: 0 },
      time: { epochMs: epoch },
    });
    const sky = renderer.sky;
    renderer.setEnvironmentTime(60);
    renderer.render();
    expect(sky?.frame.earth?.utcMs).toBe(epoch + 43200000);
    renderer.setEnvironmentTimeOverride(0);
    renderer.render();
    expect(renderer.sky).toBe(sky);
    expect(sky?.frame.earth?.utcMs).toBe(epoch);
    renderer.setEnvironmentTimeOverride(undefined);
    renderer.render();
    expect(sky?.frame.earth?.utcMs).toBe(epoch + 60000);
    expect(() => renderer.setEnvironmentTimeOverride(Number.NaN)).toThrow(/finite/);
    renderer.dispose();
  });

  it('updates weather without rebuilding it and restores authored fog and lights on removal', async () => {
    const renderer = await Renderer.create({ backend: 'webgl' });
    const fog = new THREE.Fog('#aabbcc', 300, 8000);
    renderer.scene.fog = fog;
    const sunlight = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (object) => object instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    const initialIntensity = sunlight.intensity;
    renderer.setWeather({ clouds: { coverage: 1 }, visibility: 500 });
    const effect = renderer.weather;
    webgl.render.mockImplementation((scene: THREE.Scene) =>
      expect(scene.fog).toMatchObject({ far: 500 }),
    );
    renderer.render();
    expect(renderer.scene.fog).toBe(fog);
    expect(sunlight.intensity).toBeLessThan(initialIntensity);
    renderer.setWeather({ visibility: 500 });
    expect(renderer.weather).toBe(effect);
    renderer.render();
    expect(sunlight.intensity).toBe(initialIntensity);
    renderer.setWeather(undefined);
    webgl.render.mockImplementation((scene: THREE.Scene) => expect(scene.fog).toBe(fog));
    renderer.render();
    expect(renderer.weather).toBeUndefined();
    sunlight.intensity = 3;
    renderer.render();
    expect(sunlight.intensity).toBe(3);
    renderer.dispose();
  });

  it('shares pending resource preparation and isolates one caller cancellation', async () => {
    let complete!: () => void;
    webgpu.compileAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const renderer = await Renderer.create({ admission: { schedule: () => {} } });
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const a = new THREE.Mesh(geometry, material),
      b = new THREE.Mesh(geometry, material);
    const abort = new AbortController();
    const first = renderer.prepareObject(a, abort.signal).catch((error) => error.name);
    let ready = false;
    const second = renderer.prepareObject(b).then(() => {
      ready = true;
    });
    renderer.admission.flush();
    renderer.admission.flush();
    expect(webgpu.initTexture).toHaveBeenCalledOnce();
    expect(webgpu.compileAsync).toHaveBeenCalledOnce();
    expect(ready).toBe(false);
    abort.abort();
    complete();
    expect(await first).toBe('AbortError');
    await second;
    expect(ready).toBe(true);
    expect(a.visible && b.visible).toBe(true);
    renderer.dispose();
    geometry.dispose();
    material.dispose();
    texture.dispose();
  });

  it('batches buffer initialization and restores shared geometry ranges and the render target', async () => {
    const renderer = await Renderer.create({ backend: 'webgl', admission: { schedule: () => {} } });
    const root = new THREE.Group(),
      material = new THREE.MeshStandardMaterial();
    const geometries = Array.from({ length: 40 }, () => new THREE.BoxGeometry());
    for (const geometry of geometries) {
      geometry.setDrawRange(3, 30);
      root.add(new THREE.Mesh(geometry, material));
    }
    webgl.render.mockImplementation((scene: THREE.Scene) => {
      for (const child of scene.children)
        expect((child as THREE.Mesh).geometry.drawRange).toEqual({ start: 0, count: 0 });
    });
    const ready = renderer.prepareObject(root);
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    expect(webgl.render.mock.calls.length).toBeLessThan(5);
    for (const geometry of geometries) {
      expect(geometry.drawRange).toEqual({ start: 3, count: 30 });
      geometry.dispose();
    }
    expect(webgl.setRenderTarget).toHaveBeenLastCalledWith(null);
    material.dispose();
    renderer.dispose();
  });

  it('prepares each instanced LOD builder even when its material and every buffer are shared', async () => {
    const renderer = await Renderer.create({ admission: { schedule: () => {} } });
    const geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshStandardMaterial();
    const near = new THREE.InstancedMesh(geometry, material, 3);
    const far = new THREE.InstancedMesh(geometry, material, 0);
    far.count = near.count;
    far.instanceMatrix = near.instanceMatrix;
    far.visible = false;
    const root = new THREE.Group().add(near, far);
    const ready = renderer.prepareObject(root);
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    expect(webgpu.compileAsync.mock.calls.map((args) => args[0])).toEqual([near, far]);
    expect(far.visible).toBe(false);
    await renderer.prepareObject(root);
    expect(webgpu.compileAsync).toHaveBeenCalledTimes(2);
    renderer.dispose();
    near.dispose();
    far.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('defaults asynchronous construction to WebGPU and configures the initialized driver', async () => {
    const options = { width: 600, height: 400, pixelRatio: 2, antialias: true };
    const renderer = await Renderer.create(options);
    expect(renderer.backend).toBe('webgpu');
    expect(renderer.three).toBe(webgpu);
    expect(renderer.fallbackReason).toBeUndefined();
    expect(factories.webgpu).toHaveBeenCalledExactlyOnceWith(options);
    expect(factories.webgl).not.toHaveBeenCalled();
    expect(webgpu.setPixelRatio).toHaveBeenCalledWith(2);
    expect(webgpu.setSize).toHaveBeenCalledWith(600, 400, false);
    expect(renderer.scene.getObjectByName('$environment')).toBeDefined();
    renderer.dispose();
    renderer.dispose();
    expect(webgpu.dispose).toHaveBeenCalledOnce();
  });

  it('does not reconfigure an unchanged drawing buffer', async () => {
    const renderer = await Renderer.create({ width: 600, height: 400, pixelRatio: 2 });
    webgpu.setPixelRatio.mockClear();
    webgpu.setSize.mockClear();

    renderer.setPixelRatio(2);
    renderer.setSize(600, 400);
    expect(webgpu.setPixelRatio).not.toHaveBeenCalled();
    expect(webgpu.setSize).not.toHaveBeenCalled();

    renderer.setPixelRatio(1.5);
    renderer.setSize(800, 400);
    expect(webgpu.setPixelRatio).toHaveBeenCalledExactlyOnceWith(1.5);
    expect(webgpu.setSize).toHaveBeenCalledExactlyOnceWith(800, 400, false);
    renderer.dispose();
  });

  it('uses the legacy renderer directly when WebGL is requested', async () => {
    const canvas = {} as HTMLCanvasElement;
    const renderer = await Renderer.create({ backend: 'webgl', canvas, antialias: true });
    expect(renderer.backend).toBe('webgl');
    expect(renderer.three).toBe(webgl);
    expect(renderer.fallbackReason).toBeUndefined();
    expect(factories.webgpu).not.toHaveBeenCalled();
    expect(factories.webgl).toHaveBeenCalledWith(
      expect.objectContaining({ canvas, antialias: true }),
    );
    renderer.dispose();
  });

  it.each([
    undefined,
    {},
    { gpu: null },
  ])('falls back without loading the GPU driver when navigator has no usable GPU API (%s)', async (navigator) => {
    vi.stubGlobal('navigator', navigator);
    const renderer = await Renderer.create();
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toMatch(/WebGPU is unavailable/);
    expect(factories.webgpu).not.toHaveBeenCalled();
    expect(factories.webgl).toHaveBeenCalledOnce();
    renderer.dispose();
  });

  it('preserves caller canvas and options when GPU initialization rejects in auto mode', async () => {
    factories.webgpu.mockRejectedValue(new Error('adapter unavailable'));
    const canvas = {} as HTMLCanvasElement;
    const renderer = await Renderer.create({
      canvas,
      reverseDepthBuffer: true,
      powerPreference: 'low-power',
    });
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toBe('adapter unavailable');
    expect(factories.webgl).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas,
        reversedDepthBuffer: true,
        powerPreference: 'low-power',
      }),
    );
    renderer.dispose();
  });

  it('makes explicit WebGPU strict and preserves the underlying error as its cause', async () => {
    const cause = new Error('device denied');
    factories.webgpu.mockRejectedValue(cause);
    await expect(Renderer.create({ backend: 'webgpu' })).rejects.toMatchObject({
      message: 'WebGPU initialization failed: device denied',
      cause,
    });
    expect(factories.webgl).not.toHaveBeenCalled();
  });

  it('falls back without loading the driver when the device reports no adapter', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } });
    const renderer = await Renderer.create();
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toMatch(/no adapter/);
    // The point of asking first: a device without an adapter never pays for the driver chunk.
    expect(factories.webgpu).not.toHaveBeenCalled();
    renderer.dispose();
  });

  // A context can advertise navigator.gpu and then never settle. Unbounded, that is a page that
  // renders nothing and reports nothing, which is worse than losing WebGPU.
  it('falls back when the adapter request never settles', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: () => new Promise(() => {}) } });
    const renderer = await Renderer.create({ backendProbeTimeoutMs: 20 });
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toMatch(/did not settle within 20ms/);
    expect(factories.webgpu).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it('falls back when driver initialization never settles, and disposes a late driver', async () => {
    factories.webgpu.mockImplementation(() => new Promise(() => {}));
    const renderer = await Renderer.create({ backendProbeTimeoutMs: 20 });
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toMatch(/initialization did not settle within 20ms/);
    renderer.dispose();
  });

  it('rejects strict WebGPU on a probe timeout instead of falling back', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: () => new Promise(() => {}) } });
    await expect(Renderer.create({ backend: 'webgpu', backendProbeTimeoutMs: 20 })).rejects.toThrow(
      /did not settle within 20ms/,
    );
    expect(factories.webgl).not.toHaveBeenCalled();
  });

  it('also rejects strict WebGPU when the browser API is absent', async () => {
    vi.stubGlobal('navigator', {});
    await expect(Renderer.create({ backend: 'webgpu' })).rejects.toThrow(/WebGPU is unavailable/);
    expect(factories.webgpu).not.toHaveBeenCalled();
    expect(factories.webgl).not.toHaveBeenCalled();
  });

  it('disposes an initialized GPU driver if subsequent renderer setup fails', async () => {
    webgpu.setSize.mockImplementation(() => {
      throw new Error('canvas configure failed');
    });
    const renderer = await Renderer.create();
    expect(webgpu.dispose).toHaveBeenCalledOnce();
    expect(renderer.backend).toBe('webgl');
    expect(renderer.fallbackReason).toBe('canvas configure failed');
    renderer.dispose();
  });

  it('reports device loss and rejects further rendering instead of continuing on a lost device', async () => {
    const onDeviceLost = vi.fn();
    const renderer = await Renderer.create({ onDeviceLost });
    webgpu.onDeviceLost?.({ message: 'GPU device removed' });
    expect(onDeviceLost).toHaveBeenCalledExactlyOnceWith('GPU device removed');
    expect(() => renderer.render()).toThrow(/WebGPU device lost: GPU device removed/);
    expect(webgpu.render).not.toHaveBeenCalled();
    renderer.dispose();
    webgpu.onDeviceLost?.({ message: 'Late device event' });
    expect(onDeviceLost).toHaveBeenCalledTimes(1);
    expect(() => renderer.render()).toThrow('Renderer has been disposed');
  });

  it.each([
    { backend: 'invalid' } as unknown as RendererOptions,
    { cameraNear: 0 },
    { cameraNear: 2, cameraFar: 1 },
    { reverseDepthBuffer: true, logarithmicDepthBuffer: true },
    { autoWorldOrigin: { threshold: 0 } },
  ])('rejects invalid options before creating either driver (%s)', async (options) => {
    await expect(Renderer.create(options)).rejects.toThrow();
    expect(factories.webgpu).not.toHaveBeenCalled();
    expect(factories.webgl).not.toHaveBeenCalled();
  });

  it('keeps synchronous construction on WebGL and directs async preferences to the factory', () => {
    for (const backend of ['auto', 'webgpu'] as const) {
      expect(() => new Renderer({ backend })).toThrow('Use await Renderer.create()');
    }
    expect(factories.webgl).not.toHaveBeenCalled();
    const renderer = new Renderer();
    expect(renderer.backend).toBe('webgl');
    renderer.dispose();
  });
});

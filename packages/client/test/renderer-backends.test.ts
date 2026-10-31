import type { WebGLRenderer } from 'three';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyEnvironment } from '../src/three/environment';
import { Renderer, type RendererOptions } from '../src/three/renderer';

const factories = vi.hoisted(() => ({
  webgl: vi.fn(),
  webgpu: vi.fn(),
  reflections: vi.fn(),
  occlusion: vi.fn(),
}));

vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: factories.webgl,
}));

vi.mock('../src/three/webgpu-driver', () => ({ createWebGpuDriver: factories.webgpu }));
vi.mock('../src/three/sky-reflections', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/three/sky-reflections')>()),
  createWebGlSkyReflectionFilter: factories.reflections,
}));
vi.mock('../src/three/webgpu-sky-reflections', () => ({
  createWebGpuSkyReflectionFilter: factories.reflections,
}));
vi.mock('../src/three/webgpu-ambient-occlusion', () => ({
  createWebGpuAmbientOcclusion: factories.occlusion,
}));

const gl = { COLOR_BUFFER_BIT: 0x4000, colorMask: vi.fn(), clear: vi.fn() };

function fakeDriver() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    getClearColor: vi.fn((color: THREE.Color) => color.set('#98bed5')),
    initTexture: vi.fn(),
    compileAsync: vi.fn(async (_object: THREE.Object3D) => {}),
    // WebGL warm-ups compile synchronously, then poll the programs that compile built.
    compile: vi.fn((_object: THREE.Object3D) => new Set<THREE.Material>()),
    properties: { get: vi.fn((_material: THREE.Material) => ({})) },
    render: vi.fn(),
    info: { reset: vi.fn(), autoReset: true, render: { calls: 0, triangles: 0 } },
    autoClear: true,
    getRenderTarget: vi.fn(() => null),
    setRenderTarget: vi.fn(),
    getContext: vi.fn(() => gl),
    state: {
      buffers: {
        color: { setMask: vi.fn(), setClear: vi.fn() },
        depth: { getReversed: vi.fn(() => false) },
      },
    },
    setRenderObjectFunction: vi.fn(),
    backend: { updateBinding: vi.fn() },
    _nodes: { needsRefresh: vi.fn() },
    setOpaqueSort: vi.fn(),
    setTransparentSort: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
    onDeviceLost: undefined as ((info: { message: string }) => void) | undefined,
    capabilities: { reversedDepthBuffer: true },
  };
}

describe('renderer backend selection', () => {
  let webgl: ReturnType<typeof fakeDriver>;
  let webgpu: ReturnType<typeof fakeDriver>;

  beforeEach(() => {
    factories.webgl.mockReset();
    factories.webgpu.mockReset();
    factories.reflections.mockReset();
    webgl = fakeDriver();
    webgpu = fakeDriver();
    factories.webgl.mockImplementation(function MockWebGlRenderer() {
      return webgl as unknown as WebGLRenderer;
    });
    factories.webgpu.mockResolvedValue(webgpu as unknown as WebGPURenderer);
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({}) } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    'webgl',
    'webgpu',
  ] as const)('shares and disposes reflections through the %s viewer path', async (backend) => {
    const texture = new THREE.Texture();
    const filter = { update: vi.fn(() => texture), dispose: vi.fn() };
    factories.reflections.mockReturnValue(filter);
    const renderer = await Renderer.create({ backend, reflections: true, optimizeWebGpu: false });
    const ambient = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (light): light is THREE.HemisphereLight => light instanceof THREE.HemisphereLight,
      ) as THREE.HemisphereLight;
    const originalIntensity = ambient.intensity;
    (backend === 'webgl' ? webgl : webgpu).render.mockImplementation((scene: THREE.Scene) => {
      if (scene === renderer.scene)
        expect((renderer.sky?.ambientLight ?? ambient).visible).toBe(false);
    });
    renderer.render();
    // Still hidden between frames, so warm-up compiles light the scene as the draw does; the
    // authored intensity is untouched.
    expect(ambient.visible).toBe(false);
    expect(ambient.intensity).toBe(originalIntensity);
    expect(renderer.scene.environment).toBe(texture);
    expect(filter.update).toHaveBeenCalledTimes(1);
    renderer.setCamera({ position: [10000, 200, -300], lookAt: [10000, 0, 0] });
    renderer.setWorldOrigin([10000, 0, 0]);
    renderer.render();
    expect(filter.update).toHaveBeenCalledTimes(1);
    renderer.setSky({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
    renderer.render();
    expect(filter.update).toHaveBeenCalledTimes(2);
    const skyAmbient = renderer.sky?.ambientLight as THREE.HemisphereLight;
    expect(skyAmbient.visible).toBe(false);
    expect(ambient.visible).toBe(true);
    renderer.setWeather({ clouds: { coverage: 1 } });
    renderer.render();
    expect(filter.update).toHaveBeenCalledTimes(3);
    const host = new THREE.Texture();
    renderer.scene.environment = host;
    (backend === 'webgl' ? webgl : webgpu).render.mockImplementation((scene: THREE.Scene) => {
      if (scene === renderer.scene) {
        expect(skyAmbient.visible).toBe(true);
        expect(skyAmbient.intensity).toBeGreaterThan(0);
      }
    });
    renderer.render();
    expect(renderer.scene.environment).toBe(host);
    renderer.scene.environment = texture;
    (backend === 'webgl' ? webgl : webgpu).render.mockImplementation(() => {});
    renderer.render();
    expect(skyAmbient.visible).toBe(false);
    renderer.dispose();
    renderer.dispose();
    expect(skyAmbient.visible).toBe(true);
    expect(filter.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.scene.environment).toBeNull();
    host.dispose();
  });

  it('keeps reflections opt-in for existing viewers', async () => {
    const renderer = await Renderer.create({ backend: 'webgl' });
    renderer.render();
    expect(renderer.scene.environment).toBeNull();
    expect(factories.reflections).not.toHaveBeenCalled();
    renderer.dispose();
  });

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

  it('gathers warmup lights once per frame while retaining the real scene cache identity', async () => {
    const renderer = await Renderer.create({ backend: 'webgpu', optimizeWebGpu: false });
    const clutter = new THREE.Group();
    renderer.scene.add(clutter);
    const scan = vi.spyOn(clutter, 'traverseVisible');
    const light = new THREE.PointLight();
    renderer.scene.add(light);
    const seen: THREE.Object3D[][] = [];
    webgpu.compileAsync.mockImplementation(async (...args: unknown[]) => {
      const scene = args[2] as THREE.Scene;
      expect(scene).toBe(renderer.scene);
      const objects: THREE.Object3D[] = [];
      scene.traverseVisible((object) => objects.push(object));
      seen.push(objects);
    });
    const root = new THREE.Group();
    for (let i = 0; i < 4; i++)
      root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const ready = renderer.prepareObject(root);
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    expect(scan).toHaveBeenCalledOnce();
    expect(seen).toHaveLength(4);
    for (const lights of seen) {
      expect(lights).toContain(light);
      expect(lights).not.toContain(clutter);
    }
    expect(Object.hasOwn(renderer.scene, 'traverseVisible')).toBe(false);
    light.visible = false;
    renderer.render();
    const next = renderer.prepareObject(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    );
    while (renderer.admission.pending) renderer.admission.flush();
    await next;
    expect(seen.at(-1)).not.toContain(light);
    renderer.dispose();
  });

  it('waits for the programs a WebGL warm-up built, not the shared material current one', async () => {
    const renderer = await Renderer.create({ backend: 'webgl', admission: { schedule: () => {} } });
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 4);
    mesh.setColorAt(0, new THREE.Color('red'));
    let linked = false;
    const instanced = { program: {}, isReady: () => linked };
    const drawn = { program: {}, isReady: () => true };
    const state: { currentProgram?: typeof drawn } = {};
    webgl.properties.get.mockImplementation(() => state);
    webgl.compile.mockImplementation(() => {
      state.currentProgram = instanced;
      // The next frame draws the material's other meshes with their ready program.
      queueMicrotask(() => {
        state.currentProgram = drawn;
      });
      return new Set<THREE.Material>([material]);
    });
    let done = false;
    const ready = renderer.prepareObject(mesh).then(() => {
      done = true;
    });
    while (renderer.admission.pending) renderer.admission.flush();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(webgl.compile).toHaveBeenCalledOnce();
    expect(done).toBe(false);
    linked = true;
    await ready;
    mesh.geometry.dispose();
    material.dispose();
    renderer.dispose();
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

  it.each([
    false,
    true,
  ])('keeps visible-frame stats during background uploads (sky: %s)', async (sky) => {
    const renderer = await Renderer.create({ backend: 'webgl', admission: { schedule: () => {} } });
    if (sky) renderer.setSky({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    let triangles = 25_000;
    webgl.render.mockImplementation((scene: THREE.Scene) => {
      webgl.info.render.calls = scene === renderer.scene ? 3 : 1;
      webgl.info.render.triangles = scene === renderer.scene ? triangles : 0;
    });
    expect(renderer.stats()).toEqual({ drawCalls: 0, triangles: 0 });
    renderer.render();
    expect(renderer.stats()).toEqual({ drawCalls: 3, triangles: 25_000 });
    const ready = renderer.prepareObject(new THREE.Mesh(geometry, material));
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    expect(webgl.info.render.triangles).toBe(0);
    expect(renderer.stats()).toEqual({ drawCalls: 3, triangles: 25_000 });
    triangles = 30_000;
    renderer.render();
    expect(renderer.stats()).toEqual({ drawCalls: 3, triangles: 30_000 });
    renderer.dispose();
    geometry.dispose();
    material.dispose();
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

  it('prepares the LOD level the camera will show first and the other levels afterwards', async () => {
    const renderer = await Renderer.create({ admission: { schedule: () => {}, maxJobs: 1 } });
    const geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshStandardMaterial();
    const near = new THREE.InstancedMesh(geometry, material, 2);
    const far = new THREE.InstancedMesh(geometry, material, 0);
    far.count = near.count;
    far.instanceMatrix = near.instanceMatrix;
    const lod = new THREE.LOD();
    lod.addLevel(near, 0);
    lod.addLevel(far, 100);
    const root = new THREE.Group().add(lod);
    const tile = new THREE.Group();
    tile.position.set(0, 0, -1000);
    renderer.worldRoot.add(tile);
    renderer.camera.updateMatrixWorld();
    const compiled = (): THREE.Object3D[] => webgpu.compileAsync.mock.calls.map((args) => args[0]);
    const ready = renderer.prepareObject(root, new AbortController().signal, tile);
    renderer.admission.flush();
    await ready;
    expect(compiled()).toEqual([far]);
    expect(root.parent).toBeNull();
    expect(lod.getCurrentLevel()).toBe(1);

    // Published, the camera closes in before the near level is ready: keep drawing the far one
    // (drawing near would build its shaders mid-frame) and hurry near's preparation.
    tile.add(root);
    tile.updateMatrixWorld(true);
    renderer.camera.position.set(0, 0, -1000);
    renderer.camera.updateMatrixWorld();
    lod.update(renderer.camera);
    expect([near.visible, far.visible]).toEqual([false, true]);
    expect(Object.hasOwn(lod, 'update')).toBe(true);
    renderer.admission.flush();
    expect(compiled()).toEqual([far, near]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    lod.update(renderer.camera);
    expect([near.visible, far.visible]).toEqual([true, false]);
    expect(Object.hasOwn(lod, 'update')).toBe(false);
    renderer.camera.position.set(0, 0, 10);
    renderer.camera.updateMatrixWorld();
    tile.remove(root);

    // Deferred work for an evicted tile is dropped with its meshes.
    const nextNear = new THREE.InstancedMesh(geometry, material, 2);
    const nextFar = new THREE.InstancedMesh(geometry, material, 2);
    const next = new THREE.LOD();
    next.addLevel(nextNear, 0);
    next.addLevel(nextFar, 100);
    const nextReady = renderer.prepareObject(next, new AbortController().signal, tile);
    renderer.admission.flush();
    await nextReady;
    nextNear.dispose();
    while (renderer.admission.pending) renderer.admission.flush();
    expect(compiled()).toEqual([far, near, nextFar]);
    renderer.dispose();
    for (const mesh of [near, far, nextFar]) mesh.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('prepares a root marked background only in budget that normal work leaves', async () => {
    const renderer = await Renderer.create({ admission: { schedule: () => {}, maxJobs: 1 } });
    const parked = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const tile = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    parked.userData.admissionPriority = 'background';
    const compiled = (): THREE.Object3D[] => webgpu.compileAsync.mock.calls.map((args) => args[0]);
    // Queued first, the parked model still waits for the work a view needs.
    const parkedReady = renderer.prepareObject(parked);
    const tileReady = renderer.prepareObject(tile);
    renderer.admission.flush();
    await tileReady;
    expect(compiled()).toEqual([tile]);
    renderer.admission.flush();
    await parkedReady;
    expect(compiled()).toEqual([tile, parked]);
    renderer.dispose();
    for (const mesh of [parked, tile]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });

  it('publishes before hidden geometry-switch LODs compile and guards their later reveal', async () => {
    const renderer = await Renderer.create({ admission: { schedule: () => {}, maxJobs: 1 } });
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
      2,
    );
    const lod = new THREE.LOD().add(mesh);
    lod.update = (camera) => {
      mesh.visible = camera.position.z < -500;
    };
    const tile = new THREE.Group();
    tile.position.z = -1000;
    renderer.worldRoot.add(tile);
    await renderer.prepareObject(lod, new AbortController().signal, tile);
    expect(webgpu.compileAsync).not.toHaveBeenCalled();
    expect(mesh.visible).toBe(false);
    tile.add(lod);
    renderer.camera.position.z = -1000;
    lod.update(renderer.camera);
    expect(mesh.visible).toBe(false);
    renderer.admission.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    lod.update(renderer.camera);
    expect(mesh.visible).toBe(true);
    expect(webgpu.compileAsync).toHaveBeenCalledOnce();
    mesh.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    renderer.dispose();
  });

  it('drops queued preparation once every caller waiting for it has aborted', async () => {
    const renderer = await Renderer.create({ admission: { schedule: () => {} } });
    const geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    const a = new AbortController(),
      b = new AbortController();
    const first = renderer.prepareObject(mesh, a.signal).catch((error) => error.name);
    const second = renderer.prepareObject(mesh, b.signal).catch((error) => error.name);
    a.abort();
    expect(renderer.admission.pending).toBe(1);
    b.abort();
    expect(renderer.admission.pending).toBe(0);
    expect(await first).toBe('AbortError');
    expect(await second).toBe('AbortError');
    // A later caller schedules afresh instead of joining the cancelled job.
    const third = renderer.prepareObject(mesh);
    renderer.admission.flush();
    await third;
    expect(webgpu.compileAsync).toHaveBeenCalledOnce();
    renderer.dispose();
    mesh.dispose();
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

  it('releases the WebGL context on dispose only when the host opts in', async () => {
    const kept = await Renderer.create({ backend: 'webgl' });
    kept.dispose();
    expect(webgl.dispose).toHaveBeenCalledTimes(1);
    expect(webgl.forceContextLoss).not.toHaveBeenCalled();

    const released = await Renderer.create({ backend: 'webgl', releaseContextOnDispose: true });
    released.dispose();
    released.dispose();
    expect(webgl.forceContextLoss).toHaveBeenCalledTimes(1);

    const gpu = await Renderer.create({ backend: 'webgpu', releaseContextOnDispose: true });
    gpu.dispose();
    expect(webgpu.forceContextLoss).not.toHaveBeenCalled();
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

  it('uses logarithmic depth on the same context when reversed WebGL depth is unsupported', async () => {
    const canvas = {} as HTMLCanvasElement;
    const context = {} as WebGL2RenderingContext;
    const unsupported = {
      ...fakeDriver(),
      domElement: canvas,
      getContext: vi.fn(() => context),
      capabilities: { reversedDepthBuffer: false },
    };
    factories.webgl.mockImplementationOnce(function UnsupportedWebGlRenderer() {
      return unsupported as unknown as WebGLRenderer;
    });
    const renderer = await Renderer.create({
      backend: 'webgl',
      canvas,
      reverseDepthBuffer: true,
      cameraNear: 0.05,
      cameraFar: 500000,
    });
    expect(unsupported.dispose).toHaveBeenCalledOnce();
    expect(unsupported.forceContextLoss).not.toHaveBeenCalled();
    expect(factories.webgl).toHaveBeenCalledTimes(2);
    expect(factories.webgl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvas,
        context,
        reversedDepthBuffer: false,
        logarithmicDepthBuffer: true,
      }),
    );
    renderer.dispose();
    expect(webgl.dispose).toHaveBeenCalledOnce();
  });

  it('keeps reversed depth on supported WebGL without rebuilding the renderer', async () => {
    const renderer = await Renderer.create({ backend: 'webgl', reverseDepthBuffer: true });
    expect(factories.webgl).toHaveBeenCalledOnce();
    expect(webgl.dispose).not.toHaveBeenCalled();
    renderer.dispose();
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

  it('turns sun shadows on and aims them at a focus in absolute world coordinates', () => {
    const renderer = new Renderer();
    applyEnvironment(renderer, { sun: { direction: [0, 1, 1] } });
    const light = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    expect(light.castShadow).toBe(false);
    // Never on yet: 'off' leaves the renderer's shadow map off.
    renderer.setShadowQuality('off');
    expect(renderer.three.shadowMap.enabled).toBe(false);
    renderer.setShadowQuality('medium');
    expect(light.castShadow).toBe(true);
    expect(light.shadow.mapSize.x).toBe(2048);
    expect(renderer.three.shadowMap.enabled).toBe(true);
    renderer.setWorldOrigin([10_000, 0, 0]);
    renderer.setShadowFocus({ center: [10_100, 0, 0], radius: 300 });
    renderer.render();
    // Rebased: the focus 100 m east of the origin is 100 m east of the scene origin.
    expect(light.target.position.x).toBeCloseTo(100, 0);
    expect(light.shadow.camera.right).toBe(320);
    light.shadow.updateMatrices(light);
    const projected = new THREE.Vector3(101, 0, 0).applyMatrix4(light.shadow.matrix);
    // A different local origin must not change where an absolute point lands in the shadow map.
    renderer.setWorldOrigin([10_123.45, 10, -23.4]);
    renderer.render();
    light.shadow.updateMatrices(light);
    const rebased = new THREE.Vector3(10_101 - 10_123.45, -10, 23.4).applyMatrix4(
      light.shadow.matrix,
    );
    expect(rebased.distanceTo(projected)).toBeLessThan(1e-9);
    expect(() => renderer.setShadowFocus({ center: [0, 0, 0], radius: 0 })).toThrow(RangeError);
    // Off again parks the map instead: every lit program keeps the shadow inputs it was built
    // with, so a quality tier change does not rebuild them all in the next frame.
    renderer.setShadowQuality('off');
    expect(light.castShadow).toBe(true);
    expect(light.shadow.autoUpdate).toBe(false);
    expect(light.shadow.intensity).toBe(0);
    expect(renderer.three.shadowMap.enabled).toBe(true);
    renderer.setShadowQuality('high');
    expect(light.shadow.autoUpdate).toBe(true);
    expect(light.shadow.intensity).toBe(1);
    expect(light.shadow.mapSize.x).toBe(4096);
    renderer.dispose();
  });

  it('asks a parked shadow map to draw once for each kind of caster it has not drawn', () => {
    const renderer = new Renderer();
    applyEnvironment(renderer, { sun: { direction: [0, 1, 1] } });
    const light = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    renderer.setShadowQuality('medium');
    renderer.setShadowQuality('off');
    light.shadow.needsUpdate = false;
    const material = new THREE.MeshStandardMaterial();
    const caster = (mesh: THREE.Mesh): void => {
      mesh.castShadow = true;
      void renderer.prepareObject(mesh).catch(() => {});
    };
    caster(new THREE.Mesh(new THREE.BoxGeometry(), material));
    // Its depth program is built by that one parked render.
    expect(light.shadow.needsUpdate).toBe(true);
    light.shadow.needsUpdate = false;
    caster(new THREE.Mesh(new THREE.BoxGeometry(), material));
    expect(light.shadow.needsUpdate).toBe(false);
    caster(new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 2));
    expect(light.shadow.needsUpdate).toBe(true);
    renderer.dispose();
  });

  it('keeps ambient occlusion to the WebGPU backend and draws WebGL frames directly', () => {
    const renderer = new Renderer();
    expect(renderer.backend).toBe('webgl');
    renderer.setAmbientOcclusion(true, { radius: 2 });
    expect(() => renderer.render()).not.toThrow();
    renderer.setAmbientOcclusion(false);
    renderer.dispose();
    expect(() => renderer.setAmbientOcclusion(true)).toThrow(/disposed/);
  });

  it('leaves a WebGL frame opaque where alpha to coverage wrote partial alpha', () => {
    gl.colorMask.mockClear();
    gl.clear.mockClear();
    const renderer = new Renderer();
    renderer.render();
    // The canvas's alpha alone is cleared to 1, after the scene, and every channel writes again.
    expect(webgl.state.buffers.color.setClear).toHaveBeenCalledWith(0, 0, 0, 1, false);
    expect(gl.colorMask.mock.calls).toEqual([
      [false, false, false, true],
      [true, true, true, true],
    ]);
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT);
    expect(gl.clear.mock.invocationCallOrder[0]).toBeGreaterThan(
      webgl.render.mock.invocationCallOrder.at(-1) ?? Infinity,
    );
    // Not into a host's render target.
    gl.clear.mockClear();
    webgl.getRenderTarget.mockReturnValue(new THREE.WebGLRenderTarget(1, 1) as never);
    renderer.render();
    expect(gl.clear).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it('prepares a material a mesh swaps to itself once it asks, ahead of queued work', async () => {
    const renderer = await Renderer.create({ backend: 'webgpu', optimizeWebGpu: false });
    const shown = new THREE.MeshStandardMaterial();
    const twin = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), shown, 4);
    mesh.userData.materialVariants = [shown, twin];
    const compiled: THREE.Material[] = [];
    webgpu.compileAsync.mockImplementation(async (object: THREE.Object3D) => {
      compiled.push((object as THREE.Mesh).material as THREE.Material);
    });
    const ready = renderer.prepareObject(mesh);
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    // Only the material it shows; most meshes never switch.
    expect(compiled).toEqual([shown]);
    const materialReady = mesh.userData.materialReady as (material: THREE.Material) => boolean;
    expect(materialReady(shown)).toBe(true);
    void renderer.admission.run(() => compiled.push(new THREE.MeshBasicMaterial()));
    expect(materialReady(twin)).toBe(false);
    renderer.admission.flush();
    expect(compiled.indexOf(twin)).toBeGreaterThan(0);
    expect(compiled.indexOf(twin)).toBeLessThan(
      compiled.findIndex((material) => material instanceof THREE.MeshBasicMaterial),
    );
    while (renderer.admission.pending) renderer.admission.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(materialReady(twin)).toBe(true);
    expect(mesh.material).toBe(shown);
    // Built once per mesh and material.
    expect(materialReady(twin)).toBe(true);
    expect(compiled.filter((material) => material === twin)).toHaveLength(1);
    renderer.dispose();
  });

  it('builds prepared objects for the occlusion target and keeps it while suspended', async () => {
    const pass = { render: vi.fn(), compile: vi.fn(async () => {}), dispose: vi.fn() };
    factories.occlusion.mockResolvedValue(pass);
    const renderer = await Renderer.create({ backend: 'webgpu', optimizeWebGpu: false });
    renderer.setAmbientOcclusion(true);
    // Preparation started before the pass loads still builds for its target.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const ready = renderer.prepareObject(mesh);
    while (renderer.admission.pending) renderer.admission.flush();
    await ready;
    expect(pass.compile).toHaveBeenCalledWith(mesh);
    expect(webgpu.compileAsync).not.toHaveBeenCalled();
    renderer.render();
    expect(pass.render).toHaveBeenLastCalledWith(undefined, true);
    renderer.suspendAmbientOcclusion(true);
    renderer.setAmbientOcclusion(true);
    renderer.render();
    expect(pass.render).toHaveBeenLastCalledWith(undefined, false);
    expect(pass.dispose).not.toHaveBeenCalled();
    expect(factories.occlusion).toHaveBeenCalledTimes(1);
    renderer.setAmbientOcclusion(false);
    expect(pass.dispose).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it('never tears a WebGPU shadow map down once it exists, fading it out instead', async () => {
    // three r184's WebGPU shadow node keeps sampling a disposed depth texture after being turned
    // off and on or resized, so every submit fails; the map must keep its size and stay on.
    const renderer = await Renderer.create({ backend: 'webgpu' });
    applyEnvironment(renderer, { sun: { direction: [0, 1, 1] } });
    const light = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    renderer.setShadowQuality('high');
    // Simulate the first render allocating its depth target. Merely choosing a quality must
    // not freeze an unallocated map at a lower warm-up resolution.
    light.shadow.map = new THREE.WebGLRenderTarget(4096, 4096);
    const map = light.shadow.map;
    expect(light.castShadow).toBe(true);
    expect(light.shadow.mapSize.x).toBe(4096);
    renderer.setShadowQuality('off');
    expect(light.castShadow).toBe(true);
    expect(light.shadow.intensity).toBe(0);
    expect(light.shadow.autoUpdate).toBe(false);
    expect(renderer.three.shadowMap.enabled).toBe(true);
    renderer.setShadowQuality('medium');
    expect(light.shadow.intensity).toBe(1);
    expect(light.shadow.autoUpdate).toBe(true);
    expect(light.shadow.mapSize.x).toBe(4096);
    expect(light.shadow.map).toBe(map);
    renderer.dispose();
  });

  it('honors High after a WebGPU Medium warm-up before a shadow map has been allocated', async () => {
    const renderer = await Renderer.create({ backend: 'webgpu' });
    applyEnvironment(renderer, { sun: { direction: [0, 1, 1] } });
    const light = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    renderer.setShadowQuality('medium');
    renderer.setShadowQuality('off');
    expect(light.shadow.map).toBeNull();
    expect(light.shadow.needsUpdate).toBe(true);
    renderer.setShadowQuality('high');
    expect(light.shadow.mapSize.x).toBe(4096);
    expect(light.shadow.intensity).toBe(1);
    expect(light.shadow.autoUpdate).toBe(true);
    renderer.dispose();
  });

  it('keeps the static scene graph from recomposing every frame, updating the root on a rebase', () => {
    const renderer = new Renderer();
    const building = new THREE.Mesh();
    building.position.set(5, 0, 0);
    building.updateMatrix();
    building.matrixAutoUpdate = false;
    renderer.worldRoot.add(building);
    expect(renderer.scene.matrixAutoUpdate).toBe(false);
    expect(renderer.worldRoot.matrixAutoUpdate).toBe(false);
    renderer.scene.updateMatrixWorld();
    const write = vi.spyOn(building.matrixWorld, 'multiplyMatrices');
    renderer.scene.updateMatrixWorld();
    expect(write).not.toHaveBeenCalled();
    // A rebase moves the root once, and the static world follows it.
    renderer.setWorldOrigin([100, 0, 0]);
    renderer.scene.updateMatrixWorld();
    expect(write).toHaveBeenCalledTimes(1);
    expect(new THREE.Vector3().setFromMatrixPosition(building.matrixWorld).x).toBe(-95);
    renderer.dispose();
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

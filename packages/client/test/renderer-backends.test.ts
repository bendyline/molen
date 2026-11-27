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
  canvasDepthIsFloat: vi.fn(),
}));

vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: factories.webgl,
}));

vi.mock('../src/three/canvas-depth', () => ({ canvasDepthIsFloat: factories.canvasDepthIsFloat }));
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
    domElement: {} as HTMLCanvasElement,
    resetState: vi.fn(),
    state: {
      buffers: {
        color: { setMask: vi.fn(), setClear: vi.fn() },
        depth: { getReversed: vi.fn(() => false), setReversed: vi.fn(), setClear: vi.fn() },
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
    factories.canvasDepthIsFloat.mockReset();
    // SwiftShader's canvas depth: floating point, where reversed depth holds.
    factories.canvasDepthIsFloat.mockReturnValue(true);
    webgl = fakeDriver();
    webgpu = fakeDriver();
    factories.webgl.mockImplementation(function MockWebGlRenderer(options?: {
      canvas?: HTMLCanvasElement;
    }) {
      if (options?.canvas) webgl.domElement = options.canvas;
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

  it('prepares a model whose attributes and textures come from another copy of three', async () => {
    // A dev page can hold two copies of three, when another Vite server rewrote the dependency
    // cache under its server: a loader's objects then fail the renderer's `instanceof`. A
    // quantized model's attributes are all interleaved, with no `version` of their own, and its
    // preparation threw "Cannot read properties of undefined (reading 'promise')".
    const foreign = <T extends object>(object: T): T => {
      const prototype = Object.getPrototypeOf(object) as object;
      const copy = Object.create(
        Object.getPrototypeOf(prototype),
        Object.getOwnPropertyDescriptors(prototype),
      ) as object;
      return Object.setPrototypeOf(object, copy) as T;
    };
    const renderer = await Renderer.create({ backend: 'webgl', admission: { schedule: () => {} } });
    const buffer = new THREE.InterleavedBuffer(new Float32Array(3 * 4), 4);
    const position = foreign(new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    const texture = foreign(new THREE.Texture());
    expect(position).not.toBeInstanceOf(THREE.InterleavedBufferAttribute);
    expect(texture).not.toBeInstanceOf(THREE.Texture);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', position);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const ready = renderer.prepareObject(new THREE.Mesh(geometry, material));
    while (renderer.admission.pending) renderer.admission.flush();
    await expect(ready).resolves.toBeUndefined();
    expect(webgl.initTexture).toHaveBeenCalledWith(texture);
    // The buffer was uploaded with the first model: a second waits on that, not a new upload.
    const uploads = webgl.render.mock.calls.length;
    const again = renderer.prepareObject(new THREE.Mesh(geometry, material));
    while (renderer.admission.pending) renderer.admission.flush();
    await expect(again).resolves.toBeUndefined();
    expect(webgl.render.mock.calls.length).toBe(uploads);
    expect(webgl.initTexture).toHaveBeenCalledTimes(1);
    geometry.dispose();
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

  it('keeps reversed WebGL depth where the canvas depth buffer is floating point', async () => {
    const canvas = {} as HTMLCanvasElement;
    const renderer = await Renderer.create({ backend: 'webgl', canvas, reverseDepthBuffer: true });
    expect(factories.canvasDepthIsFloat).toHaveBeenCalledExactlyOnceWith(gl);
    expect(factories.webgl).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ canvas, reversedDepthBuffer: true, logarithmicDepthBuffer: false }),
    );
    // The probe drew behind three's state cache: reset it, then reverse depth and set its clear
    // value again as three's constructor did. Without the clear value the canvas drew nothing
    // but its background.
    expect(webgl.resetState).toHaveBeenCalledOnce();
    expect(webgl.state.buffers.depth.setReversed).toHaveBeenCalledExactlyOnceWith(true);
    expect(webgl.state.buffers.depth.setClear).toHaveBeenCalledExactlyOnceWith(1);
    expect(
      webgl.state.buffers.depth.setReversed.mock.invocationCallOrder[0] ?? Number.NaN,
    ).toBeLessThan(webgl.state.buffers.depth.setClear.mock.invocationCallOrder[0] ?? Number.NaN);
    expect(webgl.resetState.mock.invocationCallOrder[0] ?? Number.NaN).toBeLessThan(
      webgl.state.buffers.depth.setReversed.mock.invocationCallOrder[0] ?? Number.NaN,
    );
    expect(renderer.three).toBe(webgl);
    expect(webgl.dispose).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it('draws with logarithmic depth on the same context where the canvas depth is fixed point', async () => {
    // A 24-bit fixed-point buffer gains nothing from reversing: behind a 5 cm near plane, distant
    // roads fought the ground beneath them in stripes.
    factories.canvasDepthIsFloat.mockReturnValue(false);
    const replacement = fakeDriver();
    factories.webgl
      .mockImplementationOnce(function MockWebGlRenderer(options: { canvas: HTMLCanvasElement }) {
        webgl.domElement = options.canvas;
        return webgl as unknown as WebGLRenderer;
      })
      .mockImplementationOnce(function MockWebGlRenderer() {
        return replacement as unknown as WebGLRenderer;
      });
    const canvas = {} as HTMLCanvasElement;
    const renderer = await Renderer.create({
      backend: 'webgl',
      canvas,
      reverseDepthBuffer: true,
      cameraNear: 0.05,
      cameraFar: 500000,
    });
    expect(factories.webgl).toHaveBeenCalledTimes(2);
    expect(factories.webgl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvas,
        context: gl,
        reversedDepthBuffer: false,
        logarithmicDepthBuffer: true,
      }),
    );
    // Reset before disposing: the reset returns clip control to three's default, which the
    // replacement on the same context assumes.
    expect(webgl.resetState).toHaveBeenCalledOnce();
    expect(webgl.resetState.mock.invocationCallOrder[0] ?? Number.NaN).toBeLessThan(
      webgl.dispose.mock.invocationCallOrder[0] ?? Number.NaN,
    );
    expect(webgl.state.buffers.depth.setReversed).not.toHaveBeenCalled();
    expect(webgl.forceContextLoss).not.toHaveBeenCalled();
    expect(renderer.three).toBe(replacement);
    renderer.dispose();
    expect(replacement.dispose).toHaveBeenCalledOnce();
  });

  it('uses logarithmic depth without probing where EXT_clip_control is missing', async () => {
    webgl.capabilities.reversedDepthBuffer = false;
    const renderer = await Renderer.create({ backend: 'webgl', reverseDepthBuffer: true });
    expect(factories.canvasDepthIsFloat).not.toHaveBeenCalled();
    expect(factories.webgl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: gl,
        reversedDepthBuffer: false,
        logarithmicDepthBuffer: true,
      }),
    );
    renderer.dispose();
  });

  it('leaves WebGL depth alone when reversed depth is not asked for', async () => {
    const renderer = await Renderer.create({ backend: 'webgl' });
    expect(factories.webgl).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reversedDepthBuffer: false, logarithmicDepthBuffer: false }),
    );
    expect(factories.canvasDepthIsFloat).not.toHaveBeenCalled();
    expect(webgl.resetState).not.toHaveBeenCalled();
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

  it('reports a software rasterizer from the WebGL renderer string or the WebGPU adapter', async () => {
    // Hidden renderer strings (no debug extension) read as hardware.
    const hidden = await Renderer.create({ backend: 'webgl' });
    expect(hidden.softwareRasterizer).toBe(false);
    hidden.dispose();
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    const context = (name: string) => ({
      ...gl,
      RENDERER: 0x1f01,
      getExtension: vi.fn(() => ({ UNMASKED_RENDERER_WEBGL })),
      getParameter: vi.fn((parameter: number) =>
        parameter === UNMASKED_RENDERER_WEBGL ? name : 'WebKit WebGL',
      ),
    });
    webgl.getContext.mockReturnValue(
      context('ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
    );
    const hardware = await Renderer.create({ backend: 'webgl' });
    expect(hardware.softwareRasterizer).toBe(false);
    hardware.dispose();
    webgl.getContext.mockReturnValue(
      context('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'),
    );
    const swiftShader = await Renderer.create({ backend: 'webgl' });
    expect(swiftShader.softwareRasterizer).toBe(true);
    swiftShader.dispose();
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: async () => ({ info: { isFallbackAdapter: true } }) },
    });
    const fallback = await Renderer.create();
    expect(fallback.backend).toBe('webgpu');
    expect(fallback.softwareRasterizer).toBe(true);
    fallback.dispose();
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: async () => ({ info: { vendor: 'nvidia', architecture: 'ada' } }) },
    });
    const gpu = await Renderer.create();
    expect(gpu.softwareRasterizer).toBe(false);
    gpu.dispose();
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
    expect(renderer.shadowTexelSize).toBeUndefined();
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
    expect(renderer.shadowTexelSize).toBe(640 / 2048);
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
    expect(() =>
      renderer.setShadowFocus({
        center: [0, 0, 0],
        radius: 300,
        far: { center: [0, 0, 0], radius: Number.NaN },
      }),
    ).toThrow(RangeError);
    // A far square without static casters named, or without a shadow pass to draw it: no map.
    renderer.setShadowFocus({
      center: [10_100, 0, 0],
      radius: 300,
      far: { center: [10_000, 0, 0], radius: 2_000 },
    });
    renderer.render();
    expect(renderer.farShadowInfo).toBeUndefined();
    // Off again parks the map instead: every lit program keeps the shadow inputs it was built
    // with, so a quality tier change does not rebuild them all in the next frame.
    renderer.setShadowQuality('off');
    expect(light.castShadow).toBe(true);
    expect(light.shadow.autoUpdate).toBe(false);
    expect(light.shadow.intensity).toBe(0);
    expect(renderer.three.shadowMap.enabled).toBe(true);
    expect(renderer.shadowTexelSize).toBeUndefined();
    renderer.setShadowQuality('high');
    expect(light.shadow.autoUpdate).toBe(true);
    expect(light.shadow.intensity).toBe(1);
    expect(light.shadow.mapSize.x).toBe(4096);
    renderer.dispose();
  });

  it('gives a moving subject a sun shadow map of its own on WebGL only', async () => {
    const car = new THREE.Group();
    const subject = { object: car, center: [0, 0.7, 0] as const, radius: 2.8 };
    const renderer = new Renderer();
    renderer.worldRoot.add(car);
    expect(renderer.setShadowSubject(subject)).toBe(true);
    expect(() => renderer.setShadowSubject({ ...subject, radius: 0 })).toThrow(RangeError);
    expect(() => renderer.setShadowSubject({ ...subject, radius: Number.NaN })).toThrow(RangeError);
    // Without sun shadows, or a shadow pass to draw it: no map.
    renderer.render();
    expect(renderer.subjectShadowInfo).toBeUndefined();
    expect(renderer.setShadowSubject(undefined)).toBe(true);
    renderer.dispose();
    // WebGPU: the subject goes on casting into the sun's main map, and hosts are told so.
    const gpu = await Renderer.create({});
    expect(gpu.backend).toBe('webgpu');
    expect(gpu.setShadowSubject(subject)).toBe(false);
    expect(gpu.subjectShadowInfo).toBeUndefined();
    gpu.dispose();
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

  it('lets the focused sun map stand between drawings while it is coarse or its sun is dark', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000);
    const renderer = new Renderer();
    applyEnvironment(renderer, { sun: { direction: [0, 1, 1] } });
    const light = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
    renderer.setShadowQuality('high');
    // The test double has no shadow pass: clear the request as three's does once it has drawn.
    const frame = (): boolean => {
      light.shadow.needsUpdate = false;
      renderer.render();
      return light.shadow.autoUpdate || light.shadow.needsUpdate;
    };
    // A walking view's 8 cm texels: every frame, as three decides.
    renderer.setShadowFocus({ center: [0, 0, 0], radius: 160 });
    expect(frame()).toBe(true);
    expect(light.shadow.autoUpdate).toBe(true);
    expect(renderer.shadowHoldInfo).toEqual({ frames: 0, draws: 0 });
    // From 1,400 m the map is 10 km across, 2.5 m a texel: drawn once, then it stands.
    renderer.setShadowFocus({ center: [0, 0, 0], radius: 5_000 });
    expect(frame()).toBe(true);
    expect(light.shadow.autoUpdate).toBe(false);
    const aimed = light.target.position.clone();
    renderer.setShadowFocus({ center: [200, 0, 0], radius: 5_000 });
    expect(frame()).toBe(false);
    // Standing, it keeps the box it was drawn for.
    expect(light.target.position.equals(aimed)).toBe(true);
    expect(renderer.shadowHoldInfo).toEqual({ frames: 2, draws: 1 });
    // Drawn again: a quarter of a second on,
    now.mockReturnValue(1_250);
    expect(frame()).toBe(true);
    expect(light.target.position.x).toBeGreaterThan(190);
    // once the focus has left the middle of the box,
    renderer.setShadowFocus({ center: [600, 0, 0], radius: 5_000 });
    expect(frame()).toBe(true);
    // when the world origin moves (the map's matrix is in scene coordinates),
    renderer.setWorldOrigin([64, 0, 0]);
    expect(frame()).toBe(true);
    expect(frame()).toBe(false);
    // and when something asks for it: a new kind of caster, as for a parked map.
    light.shadow.needsUpdate = true;
    renderer.render();
    expect(light.shadow.needsUpdate).toBe(true);
    // Parked stays parked, and coming back draws at once.
    renderer.setShadowQuality('off');
    expect(frame()).toBe(false);
    expect(light.shadow.intensity).toBe(0);
    renderer.setShadowQuality('high');
    expect(frame()).toBe(true);
    expect(light.shadow.autoUpdate).toBe(false);
    // Fine texels again: every frame.
    renderer.setShadowFocus({ center: [600, 0, 0], radius: 160 });
    expect(frame()).toBe(true);
    expect(light.shadow.autoUpdate).toBe(true);
    // A sun that gives no light (night): its map is drawn once and stands until it does.
    light.intensity = 0;
    expect(frame()).toBe(true);
    now.mockReturnValue(60_000);
    renderer.setShadowFocus({ center: [9_000, 0, 0], radius: 160 });
    expect(frame()).toBe(false);
    light.intensity = 2;
    expect(frame()).toBe(true);
    expect(light.shadow.autoUpdate).toBe(true);
    renderer.dispose();
    // `holdShadows: false` draws every frame whatever the texels.
    const every = new Renderer({ holdShadows: false });
    applyEnvironment(every, { sun: { direction: [0, 1, 1] } });
    every.setShadowQuality('high');
    every.setShadowFocus({ center: [0, 0, 0], radius: 5_000 });
    every.render();
    every.render();
    expect(every.shadowHoldInfo).toEqual({ frames: 0, draws: 0 });
    every.dispose();
    now.mockRestore();
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

  it('keeps hold of a render group only while it has a parent', () => {
    // The renderer walks its render groups every frame. Holding every group ever made, weakly,
    // and dereferencing each to find the live ones kept the dead ones from being collected.
    const renderer = new Renderer();
    const held = (renderer as unknown as { renderGroups: Set<THREE.Object3D> }).renderGroups;
    const parent = new THREE.Group();
    renderer.scene.add(parent);
    const group = renderer.createRenderGroup();
    expect(held.has(group)).toBe(false);
    parent.add(group);
    expect(held.has(group)).toBe(true);
    // As a terrain stream keeps a tile warm: out of the scene, its parent set back by hand.
    parent.remove(group);
    group.parent = parent;
    expect(held.has(group)).toBe(false);
    parent.add(group);
    expect(held.has(group)).toBe(true);
    expect(parent.children.filter((child) => child === group)).toHaveLength(1);
    // And as it evicts one.
    parent.remove(group);
    expect(held.size).toBe(0);
    renderer.dispose();
  });

  it('leaves render groups out of the scene walk and the shadow maps they cannot reach', () => {
    // What a shadow map's own walk finds on show, as three's shadow pass would.
    const shadowWalks: boolean[][] = [];
    const shadowMap = webgl.shadowMap as {
      enabled: boolean;
      render?: (lights: THREE.Light[], scene: THREE.Object3D, camera: THREE.Camera) => void;
    };
    shadowMap.render = () => shadowWalks.push(groups.map((group) => group.visible));
    const renderer = new Renderer();
    shadowMap.enabled = true;
    const tiles = new THREE.Group();
    tiles.position.set(1_000, 0, 0);
    renderer.scene.add(tiles);
    // Bounds are in the parent's frame, which sits 1 km east.
    const tile = (x: number, z: number): THREE.Group => {
      const group = renderer.createRenderGroup();
      group.userData.renderBounds = new THREE.Box3(
        new THREE.Vector3(x - 1_050, 0, z - 50),
        new THREE.Vector3(x - 950, 30, z + 50),
      );
      tiles.add(group);
      return group;
    };
    const ahead = tile(0, -500);
    const behind = tile(0, 500);
    const unbounded = renderer.createRenderGroup();
    tiles.add(unbounded);
    const stale = tile(0, 800);
    stale.userData.renderBoundsStale = true;
    const hiddenByOwner = tile(0, -300);
    hiddenByOwner.visible = false;
    const groups = [ahead, behind, unbounded, stale, hiddenByOwner];
    renderer.camera.position.set(0, 10, 0);
    renderer.camera.lookAt(0, 10, -100);
    // The sun's map reaches the ground behind the camera and not the ground ahead of it.
    const sun = new THREE.DirectionalLight();
    sun.position.set(0, 1_000, 500);
    sun.target.position.set(0, 0, 500);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -100;
    sun.shadow.camera.right = sun.shadow.camera.top = 100;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 3_000;
    sun.shadow.camera.updateProjectionMatrix();
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    // Content its owner added while it was out of view has no world matrices yet.
    behind.userData.renderMatricesStale = true;
    const matrices = vi.spyOn(behind, 'updateMatrixWorld');
    // The pass as the renderer left it wrapped, which is what three calls.
    const drawShadows = (lights: THREE.Light[], scene: THREE.Object3D, camera: THREE.Camera) =>
      shadowMap.render?.(lights, scene, camera);
    const walks: boolean[][] = [];
    webgl.render.mockImplementation((scene: THREE.Scene) => {
      if (scene !== renderer.scene) return;
      walks.push(groups.map((group) => group.visible));
      matrices.mockClear();
      // Three draws its shadow maps inside the render, after the scene's own walk.
      drawShadows([sun], scene, renderer.camera);
      walks.push(groups.map((group) => group.visible));
    });
    renderer.render();
    // Only the tile behind the camera is left out; a group without bounds, one whose bounds are
    // out of date and one its owner hid are as they were.
    expect(walks[0]).toEqual([true, false, true, true, false]);
    // The sun reaches behind the camera, with that tile's matrices brought up to date for it,
    // and not ahead; the stale tile keeps casting.
    expect(shadowWalks).toEqual([[false, true, true, true, false]]);
    expect(matrices).toHaveBeenCalledTimes(1);
    expect(behind.userData.renderMatricesStale).toBe(false);
    // Back as the camera has them for the rest of the render, and all shown again after it.
    expect(walks[1]).toEqual([true, false, true, true, false]);
    expect(groups.map((group) => group.visible)).toEqual([true, true, true, true, false]);
    // A light of another kind keeps every group on show.
    shadowWalks.length = 0;
    drawShadows([new THREE.SpotLight()], renderer.scene, renderer.camera);
    expect(shadowWalks).toEqual([[true, true, true, true, false]]);
    // A group made but not attached yet (a tile still loading) is culled once it is, and one
    // that has left the scene is left alone.
    const late = renderer.createRenderGroup();
    late.userData.renderBounds = (behind.userData.renderBounds as THREE.Box3).clone();
    renderer.render();
    tiles.add(late);
    tiles.remove(behind);
    groups.splice(0, groups.length, late, behind);
    walks.length = 0;
    renderer.render();
    expect(walks[0]).toEqual([false, true]);
    expect(late.visible && behind.visible).toBe(true);
    renderer.dispose();
    // Turned off, nothing is hidden at any point.
    const plain = new Renderer({ cullRenderGroups: false });
    const kept = plain.createRenderGroup();
    kept.userData.renderBounds = new THREE.Box3(
      new THREE.Vector3(-50, 0, 450),
      new THREE.Vector3(50, 30, 550),
    );
    plain.scene.add(kept);
    plain.camera.position.set(0, 10, 0);
    plain.camera.lookAt(0, 10, -100);
    const seen: boolean[] = [];
    webgl.render.mockImplementation(() => seen.push(kept.visible));
    plain.render();
    expect(seen.every(Boolean)).toBe(true);
    plain.dispose();
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

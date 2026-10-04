/** Isolates the real landmark library and shared surfaces; not a complete Earth benchmark. */
import { MaterialResolver } from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import {
  createResolvedMaterialSet,
  type StructureLodManifest,
  StructureLodStreamer,
  StructureModelLibrary,
  structureStreamingBudget,
} from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

declare const __BENCHMARK_ROOT__: string;
const base = `/@fs/${__BENCHMARK_ROOT__}/`;
const json = async (path: string) => {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const audit = await json('.artifacts/landmark-performance/audit.json');
const pack = await resolveStylePackDocuments(
  await json('content/worldgen/stylepack.json'),
  (path) => json(`content/worldgen/${path}`),
);
const params = new URLSearchParams(location.search);
const progressiveWorkers = params.get('bake') !== 'sync';
const count = Number(params.get('count') ?? 1);
if (![1, 9, 41].includes(count)) throw new Error('count must be 1, 9, or 41');
const entries = audit.models.slice(0, count) as Array<{ id: string; asset: string; path: string }>;
const modelPath = params.get('modelPath');
if (modelPath && count === 1 && entries[0]) entries[0].path = modelPath;
const variant = params.get('lod');
const streaming = params.get('streaming');
if (variant && ['skyline', 'district', 'street', 'closeup'].includes(variant))
  for (const entry of entries) entry.path = entry.path.replace(/\.glb$/, `.${variant}.glb`);
const status = document.querySelector('#status') as HTMLElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c2d3df');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
// Count shadow passes as well as the color pass (Three resets after shadows by default).
renderer.info.autoReset = false;
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = params.get('shadows') === '1';
document.body.append(renderer.domElement);
const gl = renderer.getContext() as WebGL2RenderingContext;
const debug = gl.getExtension('WEBGL_debug_renderer_info');
const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
const device = {
  renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
  userAgent: navigator.userAgent,
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  width: innerWidth,
  height: innerHeight,
  gpuTimerAvailable: Boolean(timer),
  shadows: renderer.shadowMap.enabled,
};
const hemisphere = new THREE.HemisphereLight('#e6f1ff', '#657364', 2.1);
const sun = new THREE.DirectionalLight('#fff3db', 3);
sun.position.set(-700, 1000, 900);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1800, right: 1800, top: 1800, bottom: -1800, far: 5000 });
scene.add(hemisphere, sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10000, 10000).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#899980' }),
);
ground.receiveShadow = true;
ground.position.y = -0.1;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 15000);
const grid = Math.ceil(Math.sqrt(count));
const distance = count === 1 ? 750 : grid * 320;
const aim = new THREE.Vector3(0, 120, 0);
function angle(radians: number) {
  camera.position.set(Math.sin(radians) * distance, distance * 0.52, Math.cos(radians) * distance);
  camera.lookAt(aim);
}
angle(0.35);
const workerPool = progressiveWorkers
  ? createMaterialBakeWorkerPool(
      Array.from(
        { length: 2 },
        () => new Worker(new URL('./material.worker.ts', import.meta.url), { type: 'module' }),
      ),
    )
  : undefined;
const surfaceJobs: Promise<void>[] = [];
const materials = createResolvedMaterialSet(
  new MaterialResolver(
    {
      load: async () => {
        throw new Error('Expected a shared graph');
      },
      loadText: async (ref) => {
        const path = pack.root.materials[ref];
        if (!path) throw new Error(`Unknown material ${ref}`);
        return JSON.stringify(await json(`content/worldgen/${path}`));
      },
    },
    workerPool,
  ),
  {
    progressive: true,
    ...(streaming
      ? {
          concurrency: 2,
          maxTextureBytes: structureStreamingBudget(streaming === 'phone').maxTextureBytes,
        }
      : {}),
  },
);
const loads: Array<{
  asset: string;
  bytes: number;
  fetchMs: number;
  parseMs: number;
  surfacesMs: number;
}> = [];
const geometries = new Set<THREE.BufferGeometry>();
const disposed = new Set<THREE.BufferGeometry>();
const sourceScenes: THREE.Object3D[] = [];
const loader = new GLTFLoader();
const loadModel = async (asset: string, path?: string, signal?: AbortSignal) => {
  const entry = entries.find((value) => value.asset === asset);
  if (!entry) throw new Error(asset);
  const start = performance.now();
  const response = await fetch(base + (path ?? entry.path), {
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`${asset}: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const fetched = performance.now();
  const model = (await loader.parseAsync(bytes, '')).scene;
  const parsed = performance.now();
  const refs = new Set<string>();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    mesh.geometry.addEventListener('dispose', () => disposed.add(mesh.geometry));
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const ref = material.userData.molenSurface?.ref;
      if (typeof ref === 'string') refs.add(ref);
    }
  });
  const surfaces = materials.prepare([...refs]);
  surfaceJobs.push(surfaces);
  if (!progressiveWorkers) await surfaces;
  loads.push({
    asset,
    bytes: bytes.byteLength,
    fetchMs: fetched - start,
    parseMs: parsed - fetched,
    surfacesMs: performance.now() - parsed,
  });
  sourceScenes.push(model);
  return model;
};
const sharedOptions = {
  resolveSurface: ({
    ref,
    slot,
  }: {
    ref: string;
    slot: 'wall' | 'roof' | 'trim' | 'foundation' | 'window' | 'door';
  }) => materials.materialFor(slot, ref),
};
const entryFor = (asset: string) => {
  const entry = entries.find((value) => value.asset === asset);
  if (!entry) throw new Error(`Unknown benchmark asset: ${asset}`);
  return entry;
};
const streamer = streaming
  ? new StructureLodStreamer(
      async (asset) => {
        const entry = entryFor(asset);
        return (await json(
          entry.path.replace(/model\.glb$/, 'asset.json'),
        )) as StructureLodManifest;
      },
      async (asset, level, signal) =>
        loadModel(asset, entryFor(asset).path.replace(/model\.glb$/, level.file), signal),
      {
        ...sharedOptions,
        mobile: streaming === 'phone',
        prepareObject: async (object) => {
          await renderer.compileAsync(object, camera, scene);
        },
      },
    )
  : undefined;
const library = streamer ?? new StructureModelLibrary(loadModel, sharedOptions);
const streamingStats = () =>
  streamer ? { ...streamer.stats(), sharedTextureBytes: materials.textureBytes } : undefined;
function updateStreaming() {
  streamer?.update({
    position: camera.position.toArray(),
    direction: camera.getWorldDirection(new THREE.Vector3()).toArray(),
    verticalFov: camera.fov,
    viewportHeight: innerHeight,
  });
}
const objects: Array<{ asset: string; object: THREE.Object3D }> = [];
const longTasks: number[] = [];
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) longTasks.push(entry.duration);
});
if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
  observer.observe({ type: 'longtask', buffered: false });
const frame = () => new Promise<number>((accept) => requestAnimationFrame(accept));
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)] ?? null,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
    max: sorted.at(-1) ?? null,
  };
};
function memory(roots: THREE.Object3D[]) {
  const uploads = new Set<THREE.BufferAttribute | THREE.InterleavedBuffer>();
  const buffers = new Set<ArrayBufferLike>();
  const include = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null) => {
    if (!attribute) return;
    const data = 'isInterleavedBufferAttribute' in attribute ? attribute.data : attribute;
    uploads.add(data);
    buffers.add(data.array.buffer);
  };
  for (const root of roots)
    root.traverse((object) => {
      const mesh = object as THREE.InstancedMesh;
      if (!mesh.isMesh) return;
      for (const attribute of Object.values(mesh.geometry.attributes)) include(attribute);
      include(mesh.geometry.index);
      if (mesh.isInstancedMesh) {
        include(mesh.instanceMatrix);
        include(mesh.instanceColor);
      }
    });
  return {
    attributeUploadBytes: [...uploads].reduce((sum, data) => sum + data.array.byteLength, 0),
    backingArrayBufferBytes: [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0),
  };
}
async function measureFrames() {
  for (let i = 0; i < 30; i++) {
    await frame();
    updateStreaming();
    renderer.render(scene, camera);
  }
  const intervals: number[] = [];
  const cpu: number[] = [];
  const gpu: number[] = [];
  let query: WebGLQuery | null = null;
  let previous = await frame();
  for (let i = 0; i < 120; i++) {
    const now = await frame();
    updateStreaming();
    intervals.push(now - previous);
    previous = now;
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT))
        gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query);
      query = null;
    }
    const startQuery = timer && !query;
    if (startQuery) {
      query = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
    const start = performance.now();
    renderer.info.reset();
    renderer.render(scene, camera);
    cpu.push(performance.now() - start);
    if (startQuery) gl.endQuery(timer.TIME_ELAPSED_EXT);
  }
  if (query) gl.deleteQuery(query);
  return {
    frameIntervalMs: summary(intervals),
    renderCpuMs: summary(cpu),
    gpuMs: summary(gpu),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}
const result: Record<string, unknown> = {
  device,
  count,
  loads,
  materialMode: progressiveWorkers
    ? 'two-worker-progressive'
    : 'synchronous-blocking-review-baseline',
  modelPaths: entries.map((entry) => entry.path),
  streaming: streaming ?? false,
  methodology:
    'WebGL landmark-only scene; real StructureModelLibrary, optional StructureLodStreamer, and shared materials. Two simultaneous initial acquisitions; detail concurrency follows the selected preset. Cold loopback HTTP, no network throttling. Synthetic grid. No terrain, traffic, sky reflections or tile scheduler. Two material workers bake used surfaces. Streaming samples follow 300 settling frames; the pan rotates 20 degrees in place. Timings include only this workload.',
};
const benchmark = { result, done: false, error: '', screenshotReady: false, continue: false };
Object.assign(window, { landmarkPerformance: benchmark });
try {
  let rendering = true;
  const loadingFrames: number[] = [];
  let last = performance.now();
  const animate = () => {
    if (!rendering) return;
    const now = performance.now();
    loadingFrames.push(now - last);
    last = now;
    updateStreaming();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  const start = performance.now();
  let cursor = 0;
  let firstModelMs: number | undefined;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        const entry = entries[index];
        if (!entry) continue;
        const location: [number, number, number] = [
          ((index % grid) - (grid - 1) / 2) * 220,
          0,
          (Math.floor(index / grid) - (grid - 1) / 2) * 220,
        ];
        const model = await library.acquire(entry.asset, { position: location });
        const object = library.instantiate(model, {
          position: location,
          prepare: (child) => {
            child.traverse((object) => {
              if ((object as THREE.Mesh).isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
              }
            });
            return child;
          },
        });
        const center = model.bounds.getCenter(new THREE.Vector3());
        object.position.set(
          ((index % grid) - (grid - 1) / 2) * 220 - center.x,
          -model.bounds.min.y,
          (Math.floor(index / grid) - (grid - 1) / 2) * 220 - center.z,
        );
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(object);
        objects.push({ asset: entry.asset, object });
        firstModelMs ??= performance.now() - start;
        status.textContent = `${objects.length}/${count} models resident · synthetic mixed-city workload`;
        await frame();
      }
    }),
  );
  result.loadMs = performance.now() - start;
  result.firstModelReadyMs = firstModelMs;
  result.initialDownloadedBytes = loads.reduce((sum, load) => sum + load.bytes, 0);
  result.initialStreaming = streamingStats();
  if (streamer) {
    for (let i = 0; i < 300; i++) {
      await frame();
      updateStreaming();
    }
    result.settledStreaming = streamingStats();
  }
  await Promise.all(surfaceJobs);
  result.materialsReadyMs = performance.now() - start;
  result.materialFailures = [...materials.failures];
  if (materials.failures.size) throw new Error('Shared material preparation failed');
  rendering = false;
  const flush = performance.now();
  renderer.render(scene, camera);
  gl.finish(); // One explicit startup completion measurement; never used in steady-state timing.
  result.finalUploadAndGpuDrainMs = performance.now() - flush;
  result.loadingFrameIntervalMs = summary(loadingFrames);
  result.visibleGeometry = memory(objects.map(({ object }) => object));
  result.allRetainedGeometry = memory([...sourceScenes, ...objects.map(({ object }) => object)]);
  result.steady = await measureFrames();
  const beforePan = loads.length;
  camera.rotateY((20 * Math.PI) / 180);
  result.pan20Degrees = await measureFrames();
  result.panAdditionalLoads = loads.length - beforePan;
  result.afterPanStreaming = streamingStats();
  const first = objects.find(({ asset }) => asset === entries[0]?.asset)?.object;
  if (first) {
    const target = first.position.clone().add(new THREE.Vector3(0, 120, 0));
    camera.position.copy(target).add(new THREE.Vector3(100, 20, 240));
    camera.lookAt(target);
    result.nearSapphire = await measureFrames();
    angle(0.35 + (20 * Math.PI) / 180);
    renderer.render(scene, camera);
  }
  result.longTasksMs = summary(longTasks);
  status.textContent = `${count} ${streaming ? `${streaming} streaming` : (variant ?? 'full-detail')} models · ${Number((result.steady as { triangles: number }).triangles).toLocaleString()} rendered triangles · ${device.renderer}`;
  benchmark.screenshotReady = true;
  const save = document.createElement('button');
  save.textContent = 'Finish and download measurements';
  save.style.cssText = 'position:fixed;bottom:20px;left:20px;padding:12px';
  save.onclick = () => {
    benchmark.continue = true;
  };
  document.body.append(save);
  while (!benchmark.continue) await frame();
  for (const { asset, object } of objects) {
    scene.remove(object);
    object.userData.disposeTerrainSurfaces?.();
    object.traverse((child) => {
      if ((child as THREE.InstancedMesh).isInstancedMesh) (child as THREE.InstancedMesh).dispose();
    });
    library.release(asset);
  }
  objects.length = 0;
  sourceScenes.length = 0;
  library.dispose();
  renderer.render(scene, camera);
  result.unload = {
    generatedGeometries: geometries.size,
    disposedGeometries: disposed.size,
    remainingGpuGeometries: renderer.info.memory.geometries,
  };
  observer.disconnect();
  materials.dispose();
  workerPool?.dispose();
  library.dispose();
  benchmark.done = true;
  save.textContent = 'Download measurements';
  save.onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `landmarks-${count}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
} catch (error) {
  benchmark.error = String(error);
  status.textContent = benchmark.error;
  benchmark.done = true;
}

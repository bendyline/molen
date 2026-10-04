import { MaterialResolver } from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import { createResolvedMaterialSet, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

declare const __BENCHMARK_ROOT__: string;
const base = `/@fs/${__BENCHMARK_ROOT__}/`;
const json = async (path: string) => (await fetch(base + path)).json();
const pack = await json('content/worldgen/stylepack.json');
const id = new URLSearchParams(location.search).get('id') ?? 'n0229_istanbul_sapphire';
const entry = Object.entries(pack.assets as Record<string, string>).find(([key]) =>
  key.endsWith(id),
);
if (!entry) throw new Error(`Unknown model ${id}`);
const path = `content/worldgen/${entry[1]}`,
  sidecar = await json(path);
const pool = createMaterialBakeWorkerPool(
  Array.from(
    { length: 2 },
    () => new Worker(new URL('./material.worker.ts', import.meta.url), { type: 'module' }),
  ),
);
const materials = createResolvedMaterialSet(
  new MaterialResolver(
    {
      load: async () => {
        throw new Error('Expected shared graph');
      },
      loadText: async (ref) =>
        JSON.stringify(await json(`content/worldgen/${pack.materials[ref]}`)),
    },
    pool,
  ),
);
const loader = new GLTFLoader();
const library = new StructureModelLibrary(
  async (file) => {
    const bytes = await (await fetch(base + path.replace(/asset\.json$/, file))).arrayBuffer();
    const scene = (await loader.parseAsync(bytes, '')).scene;
    const refs = new Set<string>();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const ref = material.userData.molenSurface?.ref;
          if (ref) refs.add(ref);
        }
    });
    await materials.prepare([...refs]);
    return scene;
  },
  { resolveSurface: ({ ref, slot }) => materials.materialFor(slot, ref) },
);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);
const names = ['master', 'skyline', 'district', 'street', 'closeup'];
const bounds = new THREE.Box3(
  new THREE.Vector3(...sidecar.bounds.aabb.min),
  new THREE.Vector3(...sidecar.bounds.aabb.max),
);
const size = bounds.getSize(new THREE.Vector3()),
  center = bounds.getCenter(new THREE.Vector3());
const scenes: THREE.Scene[] = [];
const width = innerWidth / 5,
  camera = new THREE.PerspectiveCamera(40, width / innerHeight, 0.01, 100000);
const distance =
  Math.max(size.y, size.x / (width / innerHeight), size.z / (width / innerHeight)) * 1.65;
// Fit the depth range to this asset. A 1 cm–100 km range creates false z-fighting
// between district window panels and their walls in this side-by-side fixture.
const radius = size.length() / 2;
camera.near = Math.max(0.1, distance - radius * 1.2);
camera.far = distance + radius * 1.2;
camera.updateProjectionMatrix();
camera.position
  .copy(center)
  .add(new THREE.Vector3(0.7, 0.45, 1).normalize().multiplyScalar(distance));
camera.lookAt(center);
for (const name of names) {
  const file = name === 'master' ? sidecar.files.main : sidecar.files.variants[name];
  const model = await library.acquire(file),
    scene = new THREE.Scene();
  scene.background = new THREE.Color('#c2d3df');
  scene.add(new THREE.HemisphereLight('#e6f1ff', '#657364', 2.1));
  const sun = new THREE.DirectionalLight('#fff3db', 3);
  sun.position.set(-700, 1000, 900);
  scene.add(sun);
  scene.add(library.instantiate(model));
  scenes.push(scene);
  const label = document.createElement('div');
  const level = sidecar.runtimeLods.levels.find((l: { name: string }) => l.name === name);
  label.textContent = `${name} · ${((level?.bytes ?? sidecar.stats.sizeBytes) / 1e6).toFixed(3)} MB`;
  document.querySelector('#labels')?.append(label);
}
renderer.setScissorTest(true);
for (let i = 0; i < scenes.length; i++) {
  renderer.setViewport(i * width, 0, width, innerHeight);
  renderer.setScissor(i * width, 0, width, innerHeight);
  renderer.render(scenes[i] as THREE.Scene, camera);
}
const status = document.querySelector('#status');
if (status) status.textContent = `${id} · same camera, lighting, scale and shared surfaces`;
Object.assign(window, { lodReviewReady: true });
pool.dispose();

/** Isolated asset review in a synthetic Earth-style block; never geographic-fit evidence. */
import { MaterialResolver } from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import {
  buffersToObject3D,
  createResolvedMaterialSet,
  StructureModelLibrary,
} from '@bendyline/molen-worldgen/client';
import {
  type ArchStyleDoc,
  FLAT_GROUND,
  generateBuilding,
  MeshBufferBuilder,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Use the canonical source rig so a stale Earth bundle cannot silently change review lighting.
import {
  EARTH_EXPOSURE,
  EARTH_LIGHTING,
  EARTH_SKY_PALETTE,
  EARTH_TONE_MAPPING,
} from '../../../../packages/earth/src/client/look';

declare const __REVIEW_ROOT__: string;
const base = `/@fs/${__REVIEW_ROOT__}/`;
const read = async (path: string) => {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const id = new URLSearchParams(location.search).get('id');
const contextOptions = new URLSearchParams(location.search);
const contextScale = Number(contextOptions.get('scale') ?? 1);
const neighborStyle = contextOptions.get('neighborStyle') ?? 'molen.worldgen.catalog.siheyuan';
if (!Number.isFinite(contextScale) || contextScale <= 0) throw new Error('Invalid context scale');
const pack = await read('content/worldgen/stylepack.json');
const match = Object.entries(pack.assets as Record<string, string>).find(([key]) =>
  key.endsWith(id ?? ''),
);
if (!id || !match) throw new Error(`Unknown asset ${id}`);
const path = `content/worldgen/${match[1]}`,
  sidecar = await read(path);
const pool = createMaterialBakeWorkerPool(
  Array.from(
    { length: 2 },
    () =>
      new Worker(new URL('../performance/material.worker.ts', import.meta.url), { type: 'module' }),
  ),
);
const graphReads: Record<string, number> = {};
const materials = createResolvedMaterialSet(
  new MaterialResolver(
    {
      load: async () => {
        throw new Error('Review expects shared material graphs');
      },
      loadText: async (ref) => {
        graphReads[ref] = (graphReads[ref] ?? 0) + 1;
        return JSON.stringify(await read(`content/worldgen/${pack.materials[ref]}`));
      },
    },
    pool,
  ),
);
const loader = new GLTFLoader();
const library = new StructureModelLibrary(
  async (file) => {
    const bytes = await (await fetch(base + path.replace(/asset\.json$/, file))).arrayBuffer();
    const model = (await loader.parseAsync(bytes, '')).scene,
      refs = new Set<string>();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh)
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          if (m.userData.molenSurface?.ref) refs.add(m.userData.molenSurface.ref);
    });
    await materials.prepare([...refs]);
    return model;
  },
  { resolveSurface: ({ ref, slot }) => materials.materialFor(slot, ref) },
);
const scene = new THREE.Scene();
scene.background = new THREE.Color(EARTH_SKY_PALETTE.dayHorizon);
scene.add(
  new THREE.HemisphereLight(
    EARTH_SKY_PALETTE.dayHorizon,
    EARTH_SKY_PALETTE.ground,
    EARTH_LIGHTING.dayAmbient,
  ),
);
const sun = new THREE.DirectionalLight(EARTH_SKY_PALETTE.sun, EARTH_LIGHTING.sunIntensity);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.05;
sun.shadow.bias = -0.0001;
sun.shadow.camera.left = -140 * contextScale;
sun.shadow.camera.right = 140 * contextScale;
sun.shadow.camera.top = 140 * contextScale;
sun.shadow.camera.bottom = -140 * contextScale;
sun.shadow.camera.far = 650 * contextScale;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200),
  new THREE.MeshStandardMaterial({ color: '#aaa59a', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);
const context = new THREE.Group();
scene.add(context);
const builder = new MeshBufferBuilder();
const style = (await read(`content/worldgen/${pack.styles[neighborStyle]}`)) as ArchStyleDoc;
for (const [i, [x, z]] of [
  [-64, -30],
  [-62, 25],
  [62, -30],
  [63, 25],
  [-26, -58],
  [22, -61],
  [-95, -72],
  [88, -71],
].entries()) {
  const w = 15 + (i % 3) * 3,
    d = 12 + (i % 2) * 4;
  generateBuilding(
    {
      request: {
        identity: `medium-fi-neighbor:${i}`,
        style: style.id,
        outline: [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].map(([a, b]) => [a + x * contextScale, b + z * contextScale]),
        levels: 1 + (i % 3 === 0 ? 1 : 0),
      },
      style,
      pack: { name: pack.name, version: pack.version },
      ground: FLAT_GROUND,
      tier: 0,
    },
    builder,
  );
}
const mesh = builder.finalize();
await materials.prepare(mesh.groups.map((g) => g.materialRef));
const buildings = buffersToObject3D(mesh, materials);
context.add(buildings);
buildings.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
const models: Record<string, THREE.Object3D> = {};
for (const level of ['skyline', 'district', 'street', 'closeup']) {
  const model = await library.acquire(sidecar.files.variants[level]);
  const object = library.instantiate(model);
  object.visible = false;
  models[level] = object;
  scene.add(object);
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}
const silhouette = models.skyline.clone(true);
silhouette.traverse((o) => {
  const m = o as THREE.Mesh;
  if (m.isMesh)
    m.material = new THREE.MeshStandardMaterial({
      color: '#c4c0b6',
      flatShading: true,
      roughness: 1,
    });
});
silhouette.visible = false;
scene.add(silhouette);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
if (EARTH_TONE_MAPPING !== 'neutral')
  throw new Error('Update fixture for changed Earth tone mapping');
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = EARTH_EXPOSURE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(
  43,
  innerWidth / innerHeight,
  0.5,
  Math.max(3000, 600 * contextScale),
);
type View = {
  distance?: 'street' | 'block' | 'skyline';
  mode?: 'economy' | 'high';
  time?: 'noon' | 'late';
  level?: string;
  silhouette?: boolean;
  position?: number[];
  lookAt?: number[];
};
function view(options: View = {}) {
  const { distance = 'street', mode = 'high', time = 'noon' } = options;
  const level =
    options.level ?? { street: 'closeup', block: 'district', skyline: 'skyline' }[distance];
  for (const [key, object] of Object.entries(models))
    object.visible = key === level && !options.silhouette;
  silhouette.visible = !!options.silhouette;
  context.visible = !options.silhouette;
  renderer.shadowMap.enabled = mode === 'high';
  sun.castShadow = mode === 'high';
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.receiveShadow = mode === 'high';
  });
  renderer.setPixelRatio(mode === 'economy' ? 0.65 : 1);
  sun.position.set(
    (time === 'noon' ? -100 : -240) * contextScale,
    (time === 'noon' ? 290 : 75) * contextScale,
    160 * contextScale,
  );
  const positions = { street: [48, 26, 83], block: [97, 62, 168], skyline: [194, 100, 336] };
  const p = options.position ?? positions[distance].map((v) => v * contextScale),
    look = options.lookAt ?? [0, 11 * contextScale, 0];
  camera.position.set(p[0], p[1], p[2]);
  camera.lookAt(look[0], look[1], look[2]);
  renderer.render(scene, camera);
  const label = document.querySelector('#label');
  if (label)
    label.textContent = `${sidecar.id.split('.').at(-1)} · ${level}\n${distance} · ${time === 'late' ? 'late afternoon' : 'noon'} · ${mode}${options.silhouette ? ' · untextured silhouette' : ''}\nSynthetic procedural context; geographic placement unverified`;
  return {
    level,
    distance,
    time,
    mode,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    groundY: 0,
    position: p,
    lookAt: look,
    graphReads: { ...graphReads },
    neighborStyle,
    contextScale,
  };
}
Object.assign(window, {
  mediumFi: {
    view,
    rig: {
      palette: EARTH_SKY_PALETTE,
      lighting: EARTH_LIGHTING,
      toneMapping: EARTH_TONE_MAPPING,
      exposure: EARTH_EXPOSURE,
    },
    neighborTriangles: mesh.triangleCount,
  },
});
view();

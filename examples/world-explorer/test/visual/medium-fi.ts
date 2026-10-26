/** Isolated asset review in a synthetic Earth-style block; never geographic-fit evidence. */
import {
  createWebGlSkyReflectionFilter,
  MaterialResolver,
  reflectionStateFromLights,
  SkyReflections,
} from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import {
  createTerrainObject,
  markTerrainGroundSurface,
  setTerrainGroundCutouts,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from '@bendyline/molen-terrain/client';
import { heightfieldFromPng, type TerrainDescriptor } from '@bendyline/molen-terrain/kernel';
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
import { mediumFiAsset } from './medium-fi-asset.mjs';

declare const __REVIEW_ROOT__: string;
const base = `/@fs/${__REVIEW_ROOT__}/`;
const read = async (path: string) => {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const id = new URLSearchParams(location.search).get('id');
const contextOptions = new URLSearchParams(location.search);
const groundOpening = JSON.parse(contextOptions.get('groundOpening') ?? 'null') as
  | [number, number][]
  | null;
const groundOutlines = groundOpening
  ? [
      groundOpening,
      ...(JSON.parse(contextOptions.get('additionalGroundOpenings') ?? '[]') as [
        number,
        number,
      ][][]),
    ]
  : [];
if (
  groundOpening &&
  (groundOutlines.length > 64 ||
    groundOutlines.some(
      (outline) =>
        !Array.isArray(outline) ||
        outline.length < 3 ||
        outline.length > 512 ||
        !outline.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)),
    ))
)
  throw new Error('Invalid model-owned review ground opening');
const groundCutouts = groundOpening ? new TerrainGroundCutoutController() : undefined;
const openingSurfaces: Array<{
  mesh: THREE.Mesh;
  source: THREE.BufferGeometry;
  positions: number[];
}> = [];
const contextScale = Number(contextOptions.get('scale') ?? 1);
// Rotate the standard review cameras around steep or one-sided terrain fixtures.
const cameraYaw = Number(contextOptions.get('cameraYaw') ?? 0);
// Distributed arrays can keep local detail framing while retaining remote stations.
const reviewFar = Number(contextOptions.get('far') ?? 0);
const neighborStyle = contextOptions.get('neighborStyle') ?? 'molen.worldgen.catalog.siheyuan';
if (!Number.isFinite(contextScale) || contextScale <= 0) throw new Error('Invalid context scale');
if (!Number.isFinite(cameraYaw)) throw new Error('Invalid review camera yaw');
if (!Number.isFinite(reviewFar) || reviewFar < 0) throw new Error('Invalid review far plane');
const pack = await read('content/worldgen/stylepack.json');
const match = mediumFiAsset(pack.assets, id);
const path = `content/worldgen/${match.path}`,
  sidecar = await read(path);
if (sidecar.id !== match.assetId) throw new Error('Review sidecar identity mismatch');
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
const terrainDescriptor = contextOptions.get('terraindescriptor'),
  terrainHeightmap = contextOptions.get('terrainheightmap');
let groundY = Number(contextOptions.get('groundY') ?? 0);
if (!Number.isFinite(groundY)) throw new Error('Invalid review ground datum');
let neighborPositions = [
  [-64, -30],
  [-62, 25],
  [62, -30],
  [63, 25],
  [-26, -58],
  [22, -61],
  [-95, -72],
  [88, -71],
].map(([x, z]) => [x * contextScale, z * contextScale]);
const reviewCenter = terrainDescriptor ? sidecar.bounds.sphere.center : [0, 0, 0];
// Source-local review surfaces (such as moat water) accompany the research terrain.
// Only explicit palette boxes are accepted; no source scripts or asset loads run here.
const fixtureEntities = JSON.parse(contextOptions.get('fixtureEntities') ?? '[]');
for (const entity of fixtureEntities) {
  const { transform, renderable } = entity.components ?? {};
  if (
    renderable?.kind !== 'primitive' ||
    renderable.ref !== 'box' ||
    !/^palette:#[0-9a-f]{6}$/i.test(renderable.materialRef ?? '') ||
    ![transform?.pos, transform?.rot, transform?.scale].every(
      (v, i) => Array.isArray(v) && v.length === (i === 1 ? 4 : 3) && v.every(Number.isFinite),
    )
  )
    throw new Error('Invalid source-local review surface');
  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: renderable.materialRef.slice(8), roughness: 1 }),
  );
  surface.name = entity.id;
  surface.position.fromArray(transform.pos);
  surface.quaternion.fromArray(transform.rot);
  surface.scale.fromArray(transform.scale);
  surface.castShadow = renderable.shadows?.cast ?? false;
  surface.receiveShadow = renderable.shadows?.receive ?? false;
  scene.add(surface);
}
if (terrainDescriptor || terrainHeightmap) {
  if (!terrainDescriptor || !terrainHeightmap) throw new Error('Incomplete terrain fixture');
  const checked = validateByKind('terrain', await read(terrainDescriptor));
  if (!checked.ok) throw new Error(checked.formatted);
  const descriptor = checked.value as TerrainDescriptor;
  const response = await fetch(base + terrainHeightmap);
  if (!response.ok) throw new Error(`${terrainHeightmap}: ${response.status}`);
  const field = heightfieldFromPng(descriptor, new Uint8Array(await response.arrayBuffer()));
  const hill = createTerrainObject(field, descriptor);
  hill.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (groundOpening) {
        const mesh = o as THREE.Mesh;
        markTerrainGroundSurface(mesh);
        openingSurfaces.push({
          mesh,
          source: mesh.geometry,
          positions: Array.from(mesh.geometry.getAttribute('position').array),
        });
      }
    }
  });
  scene.add(hill);
  groundY = descriptor.height.min;
  // Synthetic neighbors stay outside the hill tile, so they cannot cut into the fortifications.
  const [x, z] = descriptor.origin,
    w = descriptor.chunkSize * descriptor.gridSize[0],
    d = descriptor.chunkSize * descriptor.gridSize[1],
    gap = 35;
  neighborPositions = [
    [x - gap, z + d * 0.25],
    [x - gap, z + d * 0.75],
    [x + w + gap, z + d * 0.25],
    [x + w + gap, z + d * 0.75],
    [x + w * 0.25, z - gap],
    [x + w * 0.75, z - gap],
    [x + w * 0.25, z + d + gap],
    [x + w * 0.75, z + d + gap],
  ];
}
scene.background = new THREE.Color(EARTH_SKY_PALETTE.dayHorizon);
const hemisphere = new THREE.HemisphereLight(
  EARTH_SKY_PALETTE.dayHorizon,
  EARTH_SKY_PALETTE.ground,
  EARTH_LIGHTING.dayAmbient,
);
scene.add(hemisphere);
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
sun.target.position.set(reviewCenter[0], reviewCenter[1], reviewCenter[2]);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#aaa59a', roughness: 1 }),
);
ground.position.y = groundY - 0.02;
ground.receiveShadow = true;
scene.add(ground);
const context = new THREE.Group();
scene.add(context);
const builder = new MeshBufferBuilder();
const style = (await read(`content/worldgen/${pack.styles[neighborStyle]}`)) as ArchStyleDoc;
for (const [i, [x, z]] of neighborPositions.entries()) {
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
        ].map(([a, b]) => [a + x, b + z]),
        levels: 1 + (i % 3 === 0 ? 1 : 0),
      },
      style,
      pack: { name: pack.name, version: pack.version },
      ground: { ...FLAT_GROUND, sampleHeight: () => groundY },
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
  if (groundOpening) setTerrainGroundCutouts(object, groundOutlines);
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
// Keep the backdrop beneath a finite terrain tile unless the authored model
// extends below it. Cutting a deeper backdrop otherwise exposes sky through
// the underside of the finite tile when viewed from a distant camera.
if (
  groundOpening &&
  (!terrainDescriptor ||
    Object.values(models).some(
      (object) => new THREE.Box3().setFromObject(object).min.y < ground.position.y,
    ))
) {
  markTerrainGroundSurface(ground);
  openingSurfaces.push({
    mesh: ground,
    source: ground.geometry,
    positions: Array.from(ground.geometry.getAttribute('position').array),
  });
}
const silhouette = models.skyline.clone(true);
if (groundOpening) setTerrainGroundCutouts(silhouette, groundOutlines);
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
if (EARTH_TONE_MAPPING !== 'aces') throw new Error('Update fixture for changed Earth tone mapping');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EARTH_EXPOSURE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
// Explicit opt-in preserves the original direct-light fixture for prior reviews.
const reflections =
  contextOptions.get('reflections') === '1'
    ? new SkyReflections(scene, createWebGlSkyReflectionFilter(renderer))
    : undefined;
if (reflections) {
  window.addEventListener('pagehide', () => reflections.dispose(), { once: true });
}
const camera = new THREE.PerspectiveCamera(
  43,
  innerWidth / innerHeight,
  0.5,
  Math.max(3000, 600 * contextScale, reviewFar),
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
const openingProbePoints: number[][] = [];
for (const opening of groundOutlines) {
  const xs = opening.map((p) => p[0]),
    zs = opening.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (const fx of [0.25, 0.5, 0.75])
    for (const fz of [0.25, 0.5, 0.75]) {
      const p = [x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz];
      let inside = false;
      for (let i = 0, j = opening.length - 1; i < opening.length; j = i++) {
        const a = opening[i],
          b = opening[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      if (inside) openingProbePoints.push(p);
    }
}
function groundOpeningCoverage() {
  const ray = new THREE.Raycaster(),
    groundMeshes = openingSurfaces.map(({ mesh }) => mesh);
  let covered = 0;
  for (const [x, z] of openingProbePoints) {
    ray.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0, -1, 0));
    if (ray.intersectObjects(groundMeshes, false).length) covered++;
  }
  return { probes: openingProbePoints.length, covered };
}
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
    (time === 'noon' ? -100 : -240) * contextScale + reviewCenter[0],
    (time === 'noon' ? 290 : 75) * contextScale + reviewCenter[1],
    160 * contextScale + reviewCenter[2],
  );
  const positions = { street: [48, 26, 83], block: [97, 62, 168], skyline: [194, 100, 336] };
  const [x, y, z] = positions[distance];
  const rotatedPosition = [
    x * Math.cos(cameraYaw) + z * Math.sin(cameraYaw),
    y,
    z * Math.cos(cameraYaw) - x * Math.sin(cameraYaw),
  ];
  const p = options.position ?? rotatedPosition.map((v, i) => v * contextScale + reviewCenter[i]),
    look = options.lookAt ?? [
      reviewCenter[0],
      11 * contextScale + reviewCenter[1],
      reviewCenter[2],
    ];
  camera.position.set(p[0], p[1], p[2]);
  camera.lookAt(look[0], look[1], look[2]);
  if (reflections) {
    hemisphere.intensity = EARTH_LIGHTING.dayAmbient;
    reflections.update(reflectionStateFromLights(hemisphere, sun, scene.background, 0));
    // PMREM now supplies sky irradiance; avoid adding it again through hemisphere light.
    hemisphere.intensity = 0;
  }
  groundCutouts?.update(scene);
  renderer.render(scene, camera);
  const label = document.querySelector('#label');
  if (label)
    label.textContent = `${sidecar.id.split('.').at(-1)} · ${level}\n${distance} · ${time === 'late' ? 'late afternoon' : 'noon'} · ${mode}${options.silhouette ? ' · untextured silhouette' : ''}\nSynthetic procedural context; geographic placement unverified`;
  return {
    assetId: sidecar.id,
    runtimeHash: sidecar.hash,
    lodHash: sidecar.runtimeLods.levels.find((entry) => entry.name === level)?.hash,
    level,
    distance,
    time,
    mode,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    groundY,
    terrainFixture: terrainDescriptor
      ? { descriptor: terrainDescriptor, heightmap: terrainHeightmap }
      : null,
    position: p,
    lookAt: look,
    graphReads: { ...graphReads },
    neighborStyle,
    contextScale,
    cameraYaw,
    reflections: reflections ? 'sky-pmrem' : 'none',
    ...(groundOpening
      ? {
          groundOpening: {
            points: groundOutlines.reduce((sum, outline) => sum + outline.length, 0),
            outlines: groundOutlines.length,
            surfaces: openingSurfaces.length,
            coverage: groundOpeningCoverage(),
            active:
              openingSurfaces.length > 0 &&
              openingSurfaces.every(({ mesh, source }) => mesh.geometry !== source),
            sourceValuesUnchanged: openingSurfaces.every(
              ({ mesh, source, positions }) =>
                terrainGroundSourceGeometry(mesh) === source &&
                positions.every((v, i) => v === source.getAttribute('position').array[i]),
            ),
          },
        }
      : {}),
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

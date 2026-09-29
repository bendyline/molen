/** Isolated browser fixture. No sample app UI or production terrain source is changed. */

import { MaterialResolver } from '@bendyline/molen-client';
import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { createEmptyTerrainSemanticTile, Heightfield } from '@bendyline/molen-terrain/kernel';
import { createResolvedMaterialSet, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import { createWorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import {
  createStructureIndex,
  type StructureCatalogDoc,
} from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

declare const __MAP_STRUCTURE_CONTENT_ROOT__: string;
const content = `/@fs/${__MAP_STRUCTURE_CONTENT_ROOT__}/`;
const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${content}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const pack = await resolveStylePackDocuments(await json('worldgen/stylepack.json'), (path) =>
  json(`worldgen/${path}`),
);
const rules = await json<StructureCatalogDoc>('earth/structures/map-rules.json');
const loads: string[] = [];
const assetTriangles: Record<string, number> = {};
const surfaceReads: Record<string, number> = {};
const sharedMaterials = createResolvedMaterialSet(
  new MaterialResolver({
    load: async () => {
      throw new Error('The shared surface library loads graph documents only');
    },
    loadText: async (ref) => {
      surfaceReads[ref] = (surfaceReads[ref] ?? 0) + 1;
      const path = pack.root.materials[ref];
      if (!path) throw new Error(`Unknown surface ${ref}`);
      return JSON.stringify(await json(`worldgen/${path}`));
    },
  }),
  { progressive: true },
);
const loader = new GLTFLoader();
const models = new StructureModelLibrary(
  async (ref) => {
    loads.push(ref);
    const sidecarPath = pack.assets[ref];
    if (!sidecarPath) throw new Error(`Unknown model asset: ${ref}`);
    const manifest = await json<{ files: { main: string }; stats: { triangles: number } }>(
      `worldgen/${sidecarPath}`,
    );
    assetTriangles[ref] = manifest.stats.triangles;
    const response = await fetch(
      new URL(manifest.files.main, new URL(`${content}worldgen/${sidecarPath}`, location.href)),
    );
    if (!response.ok) throw new Error(`${ref}: HTTP ${response.status}`);
    const scene = (await loader.parseAsync(await response.arrayBuffer(), '')).scene;
    const refs = new Set<string>();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const ref = material.userData.molenSurface?.ref;
        if (typeof ref === 'string') refs.add(ref);
      }
    });
    await sharedMaterials.prepare([...refs]);
    return scene;
  },
  { resolveSurface: ({ ref, slot }) => sharedMaterials.materialFor(slot, ref) },
);
let generatedBuildings = 0;
const renderers = createWorldgenSemanticRenderers(pack, {
  structures: createStructureIndex(rules),
  structureObjects: models,
  roads: { renderTransportation: false },
  onTileStats: (output) => {
    generatedBuildings = output.stats.buildingsRendered;
  },
});
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bed1df');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1280, 900);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42, 1280 / 900, 0.1, 4000);
scene.add(new THREE.HemisphereLight('#e8f4ff', '#727662', 2.1));
const sun = new THREE.DirectionalLight('#fff5df', 3.1);
sun.position.set(-200, 420, 500);
sun.target.position.set(200, 30, 200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -350;
sun.shadow.camera.right = 350;
sun.shadow.camera.top = 350;
sun.shadow.camera.bottom = -350;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 1500;
// Keep close inspections free of coplanar self-shadow banding at this broad sun frustum.
sun.shadow.bias = -0.0001;
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200),
  new THREE.MeshStandardMaterial({ color: '#91a480', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(200, -0.035, 200);
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(400, 20, '#697f76', '#859782');
grid.position.set(200, 0.01, 200);
scene.add(grid);

const context: TerrainPyramidTileLayerContext = {
  address: { level: 15, x: 0, z: 0 },
  origin: [0, 0],
  tileSize: 400,
  pyramid: {
    name: 'mapped-model-browser-check',
    origin: [0, 0],
    rootSize: 400,
    minLevel: 15,
    maxLevel: 15,
    tileResolution: 3,
    height: { min: 0, max: 1 },
    layers: [],
    skirts: false,
  },
  descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
  heightfield: new Heightfield(new Float32Array(9), 3, 3, {
    origin: [0, 0],
    worldSize: [400, 400],
    height: { min: 0, max: 1 },
  }),
  signal: new AbortController().signal,
};
const tile = createEmptyTerrainSemanticTile();
tile.buildings = [
  {
    id: 'mill-shell',
    class: 'building',
    height: 17,
    polygons: [
      {
        outer: [
          [0.3375, 0.5375],
          [0.3625, 0.5375],
          [0.3625, 0.5625],
          [0.3375, 0.5625],
        ],
      },
    ],
  },
  {
    id: 'cafe-shell',
    class: 'building',
    name: 'Windmill Cafe',
    height: 8,
    polygons: [
      {
        outer: [
          [0.52, 0.72],
          [0.58, 0.72],
          [0.58, 0.78],
          [0.52, 0.78],
        ],
      },
    ],
  },
];
tile.pois = [
  { id: 'mapped-mill', class: 'windmill', point: [0.35, 0.55], heading: Math.PI / 4 },
  {
    id: 'mapped-turbine',
    class: 'generator',
    tags: { power: 'generator', 'generator:source': 'wind' },
    point: [0.65, 0.3],
    heading: -Math.PI / 3,
  },
  { id: 'cafe', class: 'cafe', name: 'Windmill Cafe', point: [0.55, 0.75] },
];
let tileRoot: THREE.Object3D | undefined;
let missingTags = false;
async function mode(missing: boolean): Promise<void> {
  if (tileRoot) renderers.humanFeatures.disposeTile?.(tileRoot);
  missingTags = missing;
  const semantic = missing
    ? { ...tile, pois: tile.pois?.map(({ id, point }) => ({ id, point, class: 'unknown' })) }
    : tile;
  tileRoot = await renderers.humanFeatures.createTile(semantic, context);
  if (!tileRoot) throw new Error('No human feature tile');
  scene.add(tileRoot);
}
function telemetry() {
  const textureIds = new Map<string, Set<string>>();
  const structures: Array<{
    id: string;
    position: number[];
    heading: number;
    meshes: number;
    triangles: number;
    materials: number;
    surfaces: Record<string, string | null>;
  }> = [];
  tileRoot?.traverse((object) => {
    if (!object.name.startsWith('structure:')) return;
    const materials = new Set<THREE.Material>();
    let meshes = 0,
      triangles = 0;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        materials.add(material);
    });
    structures.push({
      id: object.name,
      position: object.position.toArray(),
      heading: object.rotation.y,
      meshes,
      triangles,
      materials: materials.size,
      surfaces: Object.fromEntries(
        [...materials]
          .filter((material) => material.name.startsWith('worldgen:matgraph:'))
          .map((material) => {
            const texture = (material as THREE.MeshStandardMaterial).map;
            let ids = textureIds.get(material.name);
            if (!ids) {
              ids = new Set();
              textureIds.set(material.name, ids);
            }
            if (texture) ids.add(texture.uuid);
            return [material.name, texture?.uuid ?? null];
          }),
      ),
    });
  });
  return {
    structures,
    assetTriangles,
    generatedBuildings,
    loads: [...loads],
    surfaceReads: { ...surfaceReads },
    surfaceTextureCounts: Object.fromEntries([...textureIds].map(([ref, ids]) => [ref, ids.size])),
    missingTags,
    draws: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
}
async function view(
  name:
    | 'overview'
    | 'windmill'
    | 'mill-materials'
    | 'mill-gallery'
    | 'turbine'
    | 'turbine-base'
    | 'turbine-nacelle'
    | 'missing-tags',
) {
  if ((name === 'missing-tags') !== missingTags) await mode(name === 'missing-tags');
  const positions = {
    overview: [
      [590, 355, 680],
      [200, 55, 190],
    ],
    windmill: [
      [192, 38, 275],
      [140, 14, 220],
    ],
    'mill-materials': [
      [158.385, 7, 222.828],
      [142.121, 4.5, 222.121],
    ],
    'mill-gallery': [
      [154.849, 8, 219.293],
      [145.657, 6.2, 220],
    ],
    turbine: [
      [45, 117, 265],
      [260, 76, 120],
    ],
    'turbine-base': [
      [254.474, 5, 132.428],
      [258.268, 2.2, 121],
    ],
    'turbine-nacelle': [
      [251.412, 98, 141.124],
      [260, 90, 120],
    ],
    'missing-tags': [
      [420, 225, 510],
      [190, 15, 235],
    ],
  } as const;
  const [position, target] = positions[name];
  camera.position.set(...position);
  camera.lookAt(...target);
  const title = document.querySelector('#title');
  const description = document.querySelector('#description');
  const status = document.querySelector('#status');
  if (!title || !description || !status) throw new Error('Missing fixture captions');
  title.textContent =
    name === 'missing-tags'
      ? 'Missing map evidence keeps ordinary buildings'
      : name.startsWith('mill-')
        ? 'Windmill · shared brick, timber and painted surfaces'
        : name === 'windmill'
          ? 'Windmill · mapped direction 45°'
          : name.startsWith('turbine')
            ? 'Wind turbine · mapped direction −60°'
            : 'Structures placed from map classifications';
  description.textContent =
    name === 'missing-tags'
      ? 'Removing structure classifications produces no landmark guesses. Both building footprints remain.'
      : 'Real authored GLBs, terrain contact and explicit mapped orientation. “Windmill Cafe” stays an ordinary building.';
  renderer.render(scene, camera);
  const state = telemetry();
  status.textContent = `${state.structures.length} mapped structures · ${state.generatedBuildings} procedural building${state.generatedBuildings === 1 ? '' : 's'} · ${state.triangles.toLocaleString('en-US')} rendered triangles`;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      resolve();
    }),
  );
  return telemetry();
}
await mode(false);
await view('overview');
Object.assign(window, { mapStructuresQA: { view, telemetry } });

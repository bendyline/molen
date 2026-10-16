/** Source-specific contact fixture. This relative grade is NOT a surveyed DEM. */
import { MaterialResolver } from '@bendyline/molen-client';
import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import { createResolvedMaterialSet, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import { createWorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import {
  createStructureIndex,
  type StructureCatalogDoc,
} from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

declare const __LANDMARK_CONTENT_ROOT__: string;
const folder = 'worldgen/source/places/u3/u3m/n0595_leaning_tower_of_torun';
const content = `/@fs/${__LANDMARK_CONTENT_ROOT__}/`;
async function json<T>(path: string): Promise<T> {
  const r = await fetch(content + path);
  if (!r.ok) throw Error(`${path}: ${r.status}`);
  return r.json();
}
const grade = await json<{
  modelLocal: {
    northShelfEndZ: number;
    southBaseStartZ: number;
    northHeight: number;
    southHeight: number;
  };
  terrainReferenceNative: number[];
}>(`${folder}/site-grade.json`);
const pack = await resolveStylePackDocuments(await json('worldgen/stylepack.json'), (p) =>
  json(`worldgen/${p}`),
);
const catalog = await json<StructureCatalogDoc>('earth/structures/placements.json');
const entry = catalog.entries.find((e) => e.id === 'next1000.n0595');
if (!entry?.terrainReference || entry.status !== 'preview')
  throw Error('Missing reviewed Toruń street reference');
const selectedEntry = entry;
const reads: Record<string, number> = {};
const surfaces = createResolvedMaterialSet(
  new MaterialResolver({
    load: async () => {
      throw Error('Only common graphs expected');
    },
    loadText: async (ref) => {
      reads[ref] = (reads[ref] ?? 0) + 1;
      const path = pack.root.materials[ref];
      if (!path) throw Error(ref);
      return JSON.stringify(await json(`worldgen/${path}`));
    },
  }),
  { progressive: true },
);
const loader = new GLTFLoader();
let geometries = 0,
  level = 'master';
const library = new StructureModelLibrary(
  async (asset) => {
    const path = pack.assets[asset];
    if (!path) throw Error(asset);
    const sidecar = await json<{ files: { main: string; variants?: Record<string, string> } }>(
      `worldgen/${path}`,
    );
    const file = level === 'master' ? sidecar.files.main : sidecar.files.variants?.[level];
    if (!file) throw Error(`Missing ${level}`);
    const response = await fetch(
      new URL(file, new URL(`${content}worldgen/${path}`, location.href)),
    );
    if (!response.ok) throw Error(`Model ${response.status}`);
    const model = (await loader.parseAsync(await response.arrayBuffer(), '')).scene,
      refs = new Set<string>(),
      seen = new Set<THREE.BufferGeometry>();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!seen.has(m.geometry)) {
        seen.add(m.geometry);
        geometries++;
        m.geometry.addEventListener('dispose', () => {
          geometries--;
        });
      }
      for (const mat of Array.isArray(m.material) ? m.material : [m.material])
        if (typeof mat.userData.molenSurface?.ref === 'string')
          refs.add(mat.userData.molenSurface.ref);
    });
    await surfaces.prepare([...refs]);
    return model;
  },
  { resolveSurface: ({ ref, slot }) => surfaces.materialFor(slot, ref) },
);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfd1df');
scene.add(new THREE.HemisphereLight('#e6f1ff', '#657364', 2.1));
const sun = new THREE.DirectionalLight('#fff3db', 3);
sun.position.set(-200, 400, 350);
scene.add(sun);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1440, 1080);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.05, 1000),
  ray = new THREE.Raycaster();
const heading = entry.heading ?? 0,
  c = Math.cos(heading),
  s = Math.sin(heading),
  factor = Math.cos((entry.anchor[1] * Math.PI) / 180),
  center = wgs84ToWorld(factor, ...entry.anchor),
  size = 128,
  origin: [number, number] = [center[0] - size / 2, center[1] - size / 2];
const local = (coordinate: readonly [number, number]) => {
  const p = wgs84ToWorld(factor, ...coordinate),
    x = p[0] - center[0],
    z = p[1] - center[1];
  return [x * c - z * s, x * s + z * c];
};
const heightAt = (z: number) => {
  const g = grade.modelLocal,
    f = Math.max(0, Math.min(1, (z - g.northShelfEndZ) / (g.southBaseStartZ - g.northShelfEndZ)));
  return g.northHeight + (g.southHeight - g.northHeight) * f;
};
const positions: number[] = [],
  indices: number[] = [];
for (let j = 0; j <= 160; j++)
  for (let i = 0; i <= 160; i++) {
    const x = -40 + i * 0.5,
      z = -40 + j * 0.5;
    positions.push(x, heightAt(z) - 0.015, z);
  }
for (let j = 0; j < 160; j++)
  for (let i = 0; i < 160; i++) {
    const a = j * 161 + i;
    indices.push(a, a + 161, a + 1, a + 1, a + 161, a + 162);
  }
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setIndex(indices);
geometry.computeVertexNormals();
const ground = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({ color: '#92a284', roughness: 1 }),
);
ground.rotation.y = heading;
scene.add(ground);
let tile: THREE.Object3D | undefined,
  object: THREE.Object3D | undefined,
  renderers: ReturnType<typeof createWorldgenSemanticRenderers> | undefined;
const samples: { coordinate: number[]; height: number }[] = [];
const matrix = new THREE.Matrix4().makeRotationY(heading);
function unload() {
  if (tile && renderers) {
    scene.remove(tile);
    renderers.humanFeatures.disposeTile?.(tile);
    renderers.dispose();
  }
  tile = undefined;
  object = undefined;
  renderers = undefined;
  return { liveModelGeometries: geometries };
}
async function mount(next: string) {
  unload();
  level = next;
  samples.length = 0;
  renderers = createWorldgenSemanticRenderers(pack, {
    structures: createStructureIndex({ ...catalog, entries: [selectedEntry] }),
    structureObjects: library,
    metersPerUnit: factor,
    roads: { renderTransportation: false },
    sampleStructureTerrain: (coordinate) => {
      const [, z] = local(coordinate),
        height = heightAt(z);
      samples.push({ coordinate: [...coordinate], height });
      return height;
    },
  });
  const context: TerrainPyramidTileLayerContext = {
    address: { level: 16, x: 0, z: 0 },
    origin,
    tileSize: size,
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    pyramid: {
      name: 'torun-reconstructed-grade',
      origin,
      rootSize: size,
      minLevel: 16,
      maxLevel: 16,
      tileResolution: 3,
      height: { min: 0, max: 4 },
      layers: [],
      skirts: false,
    },
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin,
      worldSize: [size, size],
      height: { min: 0, max: 4 },
    }),
    signal: new AbortController().signal,
  };
  tile =
    (await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), context)) ??
    undefined;
  object = tile?.getObjectByName(`structure:${selectedEntry.id}`);
  if (!object || !tile) throw Error('Production renderer did not place Toruń');
  tile.position.set(-size / 2, 0, -size / 2);
  scene.add(tile);
  scene.updateMatrixWorld(true);
  const elevation = object.userData.structureElevation as number;
  matrix.makeRotationY(heading);
  matrix.setPosition(0, elevation, 0);
  return {
    level,
    placementId: selectedEntry.id,
    modelOriginElevation: elevation,
    terrainSamples: samples.map((p) => ({ ...p })),
    surfaceReads: { ...reads },
    basis: 'Reconstructed relative2019 section; not measured DEM',
  };
}
function aim(position: [number, number, number], lookAt: [number, number, number]) {
  camera.position.copy(new THREE.Vector3(...position).applyMatrix4(matrix));
  camera.lookAt(new THREE.Vector3(...lookAt).applyMatrix4(matrix));
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
}
function probe(point: number[]) {
  const p = new THREE.Vector3(...point).applyMatrix4(matrix);
  ray.set(new THREE.Vector3(p.x, 50, p.z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(ground)[0];
  return {
    native: point,
    world: p.toArray(),
    ground: hit?.point.toArray() ?? null,
    clearance: hit ? p.y - hit.point.y : null,
  };
}
declare global {
  interface Window {
    torunGradeQA: {
      mount: typeof mount;
      aim: typeof aim;
      probe: typeof probe;
      unload: typeof unload;
    };
  }
}
window.torunGradeQA = { mount, aim, probe, unload };

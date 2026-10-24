/** Hohenzollern contact fixture: public Terrarium heights and reconstructed architectural floor. */
import { MaterialResolver } from '@bendyline/molen-client';
import {
  markTerrainGroundSurface,
  TerrainGroundCutoutController,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
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
const folder = 'worldgen/source/places/u0/u0w/hohenzollern_castle';
const content = `/@fs/${__LANDMARK_CONTENT_ROOT__}/`;
async function json<T>(path: string): Promise<T> {
  const r = await fetch(content + path);
  if (!r.ok) throw Error(`${path}: ${r.status}`);
  return r.json();
}
const grade = await json<{
  grid: { origin: number[]; stepMeters: number; width: number; height: number; heights: number[] };
  datumMeters: number;
  workingCourtFloor: number;
  architectureShift: number;
}>(`${folder}/site-grade.json`);
const pack = await resolveStylePackDocuments(await json('worldgen/stylepack.json'), (p) =>
  json(`worldgen/${p}`),
);
const catalog = await json<StructureCatalogDoc>('earth/structures/placements/authoring.json');
const entry = catalog.entries.find((e) => e.id === 'hohenzollern.castle');
if (!entry?.terrainReference || entry.status !== 'preview')
  throw Error('Missing reviewed Hohenzollern street reference');
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
const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.05, 2400),
  ray = new THREE.Raycaster();
const heading = entry.heading ?? 0,
  c = Math.cos(heading),
  s = Math.sin(heading),
  factor = Math.cos((entry.anchor[1] * Math.PI) / 180),
  center = wgs84ToWorld(factor, ...entry.anchor),
  size = 1024,
  origin: [number, number] = [center[0] - size / 2, center[1] - size / 2];
const local = (coordinate: readonly [number, number]) => {
  const p = wgs84ToWorld(factor, ...coordinate),
    x = p[0] - center[0],
    z = p[1] - center[1];
  return [x * c - z * s, x * s + z * c];
};
const heightAt = (x: number, z: number) => {
  const g = grade.grid;
  const px = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters));
  const pz = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters));
  const ix = Math.floor(px),
    iz = Math.floor(pz),
    fx = px - ix,
    fz = pz - iz;
  const value = (i: number, j: number) => g.heights[j * g.width + i] - grade.datumMeters;
  return (
    value(ix, iz) * (1 - fx) * (1 - fz) +
    value(ix + 1, iz) * fx * (1 - fz) +
    value(ix, iz + 1) * (1 - fx) * fz +
    value(ix + 1, iz + 1) * fx * fz
  );
};
const positions: number[] = [],
  indices: number[] = [];
const g = grade.grid;
for (let j = 0; j < g.height; j++)
  for (let i = 0; i < g.width; i++)
    positions.push(
      g.origin[0] + i * g.stepMeters,
      g.heights[j * g.width + i] - grade.datumMeters - 0.015,
      g.origin[1] + j * g.stepMeters,
    );
for (let j = 0; j < g.height - 1; j++)
  for (let i = 0; i < g.width - 1; i++) {
    const a = j * g.width + i;
    indices.push(a, a + g.width, a + 1, a + 1, a + g.width, a + g.width + 1);
  }
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setIndex(indices);
geometry.computeVertexNormals();
const ground = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({ color: '#a79a7a', roughness: 1 }),
);
ground.rotation.y = heading;
scene.add(ground);
markTerrainGroundSurface(ground);
const cutouts = new TerrainGroundCutoutController();
const surveyGround = new THREE.Mesh(geometry, ground.material);
surveyGround.rotation.y = heading;
surveyGround.updateWorldMatrix(true, false);
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
  cutouts.update(scene);
  return { liveModelGeometries: geometries, groundRestored: ground.geometry === geometry };
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
      const [x, z] = local(coordinate),
        height = heightAt(x, z);
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
      name: 'hohenzollern-reconstructed-grade',
      origin,
      rootSize: size,
      minLevel: 16,
      maxLevel: 16,
      tileResolution: 3,
      height: { min: -35, max: 65 },
      layers: [],
      skirts: false,
    },
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin,
      worldSize: [size, size],
      height: { min: -35, max: 65 },
    }),
    signal: new AbortController().signal,
  };
  tile =
    (await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), context)) ??
    undefined;
  object = tile?.getObjectByName(`structure:${selectedEntry.id}`);
  if (!object || !tile) throw Error('Production renderer did not place Hohenzollern');
  tile.position.set(-size / 2, 0, -size / 2);
  scene.add(tile);
  scene.updateMatrixWorld(true);
  cutouts.update(scene);
  const elevation = object.userData.structureElevation as number;
  matrix.makeRotationY(heading);
  matrix.setPosition(0, elevation, 0);
  return {
    level,
    placementId: selectedEntry.id,
    modelOriginElevation: elevation,
    terrainSamples: samples.map((p) => ({ ...p })),
    surfaceReads: { ...reads },
    groundCutoutActive: ground.geometry !== geometry,
    basis:
      'Retained public Terrarium grid with decoded 835.9281 m anchor datum and rigid -10.4563 m source shift. Fresh mapped upper platform skirts meet grade; the bounded lowest-road/Eagle cut preserves its sampled interior island. Castle relative floor rise is reconstructed, not surveyed.',
  };
}
function aim(position: [number, number, number], lookAt: [number, number, number]) {
  camera.position.copy(new THREE.Vector3(...position).applyMatrix4(matrix));
  camera.lookAt(new THREE.Vector3(...lookAt).applyMatrix4(matrix));
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
}
function probe(point: number[]) {
  const y = heightAt(point[0], point[1]) - (matrix.elements[13] ?? 0);
  const p = new THREE.Vector3(point[0], y, point[1]).applyMatrix4(matrix);
  ray.set(new THREE.Vector3(p.x, 100, p.z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(surveyGround)[0];
  // The rendered heightfield triangulates each grid cell. Its height differs from
  // bilinear sampling between vertices on this steep ridge; verify both explicitly.
  const u = (point[0] - grade.grid.origin[0]) / grade.grid.stepMeters;
  const v = (point[1] - grade.grid.origin[1]) / grade.grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j;
  const at = (dx: number, dz: number) =>
    grade.grid.heights[(j + dz) * grade.grid.width + i + dx] - grade.datumMeters;
  const triangleHeight =
    fx + fz <= 1
      ? at(0, 0) * (1 - fx - fz) + at(1, 0) * fx + at(0, 1) * fz
      : at(1, 1) * (fx + fz - 1) + at(0, 1) * (1 - fx) + at(1, 0) * (1 - fz);
  return {
    kind: 'open-ground-datum',
    native: [point[0], y, point[1]],
    world: p.toArray(),
    ground: hit?.point.toArray() ?? null,
    clearance: hit ? triangleHeight - hit.point.y : null,
    bilinearDifference: hit ? p.y - hit.point.y : null,
  };
}
function pavingProbes() {
  return [];
}
async function passageProbes() {
  const gates = await json<{
    gates: { name: string; x: number; z: number; a: number; depth: number; lo: number }[];
  }>(`${folder}/gate-frame.json`);
  return gates.gates.map((g) => {
    const d = new THREE.Vector3(Math.sin(g.a), 0, Math.cos(g.a));
    ray.set(
      new THREE.Vector3(
        g.x - d.x * (g.depth / 2 - 0.2),
        g.lo + grade.architectureShift + 2.2,
        g.z - d.z * (g.depth / 2 - 0.2),
      ).applyMatrix4(matrix),
      d.transformDirection(matrix),
    );
    const hit = object ? ray.intersectObject(object, true)[0] : undefined;
    return {
      name: g.name,
      native: [g.x, g.lo + grade.architectureShift + 2.2, g.z],
      distance: hit?.distance ?? null,
      requiredClearance: g.depth - 0.4,
    };
  });
}
async function foundationProbes() {
  const frame = await json<{ geometry: { outline: number[][] } }>(`${folder}/map-frame.json`);
  // Tower part seams inside the joined palace are not exposed foundation faces.
  // Test the assembled occupied outer boundary, as the source geometry test does.
  const ids = ['way/93612350-exterior-platform'];
  const result = [];
  for (const id of ids) {
    const ring = frame.geometry.outline;
    if (!ring) throw Error(id);
    const signed = ring.reduce((n, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0);
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 3 || a[0] > 28 || b[0] > 28) continue;
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        sign = signed < 0 ? -1 : 1;
      const n = new THREE.Vector3(
        (sign * (b[1] - a[1])) / length,
        0,
        (-sign * (b[0] - a[0])) / length,
      );
      const native = new THREE.Vector3(
        x + 3 * n.x,
        heightAt(x, z) - matrix.elements[13] + 0.12,
        z + 3 * n.z,
      );
      const world = native.clone().applyMatrix4(matrix),
        direction = n.clone().negate().transformDirection(matrix);
      ray.set(world, direction);
      const hit = object ? ray.intersectObject(object, true)[0] : undefined;
      result.push({
        id,
        native: [x, heightAt(x, z) - matrix.elements[13], z],
        outward: n.toArray(),
        distance: hit?.distance ?? null,
        offsetFromMappedWall: hit ? hit.distance - 3 : null,
      });
    }
  }
  return result;
}
declare global {
  interface Window {
    hohenzollernGradeQA: {
      mount: typeof mount;
      aim: typeof aim;
      probe: typeof probe;
      unload: typeof unload;
      foundationProbes: typeof foundationProbes;
      pavingProbes: typeof pavingProbes;
      passageProbes: typeof passageProbes;
    };
  }
}
window.hohenzollernGradeQA = {
  mount,
  aim,
  probe,
  unload,
  foundationProbes,
  pavingProbes,
  passageProbes,
};

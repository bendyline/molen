/** Batch review using the same model library and placement renderer as the world viewer. */
import {
  createWebGlSkyReflectionFilter,
  MaterialResolver,
  reflectionStateFromLights,
  SkyReflections,
} from '@bendyline/molen-client';
import {
  markTerrainGroundSurface,
  TerrainGroundCutoutController,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { createResolvedMaterialSet, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import { createWorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import {
  createStructureIndex,
  type StructureCatalogDoc,
  type StructurePlacement,
} from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { reviewClipping } from './landmark-capture-clipping.mjs';

declare const __LANDMARK_CONTENT_ROOT__: string;
const content = `/@fs/${__LANDMARK_CONTENT_ROOT__}/`;
function caption(selector: string, text: string): void {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing review caption: ${selector}`);
  element.textContent = text;
}
async function json<T>(path: string): Promise<T> {
  const response = await fetch(content + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const pack = await resolveStylePackDocuments(await json('worldgen/stylepack.json'), (path) =>
  json(`worldgen/${path}`),
);
const catalog = await json<StructureCatalogDoc>('earth/structures/placements.json');
const reads: Record<string, number> = {};
const loads: string[] = [];
const resources: Array<{ asset: string; disposed: boolean }> = [];
const surfaceSet = createResolvedMaterialSet(
  new MaterialResolver({
    load: async () => {
      throw new Error('Only shared material graph documents are expected');
    },
    loadText: async (ref) => {
      reads[ref] = (reads[ref] ?? 0) + 1;
      const path = pack.root.materials[ref];
      if (!path) throw new Error(`Unknown material graph: ${ref}`);
      return JSON.stringify(await json(`worldgen/${path}`));
    },
  }),
  { progressive: true },
);
const loader = new GLTFLoader();
const models = new StructureModelLibrary(
  async (asset) => {
    loads.push(asset);
    const sidecarPath = pack.assets[asset];
    if (!sidecarPath) throw new Error(`Unknown model asset: ${asset}`);
    const sidecar = await json<{ files: { main: string } }>(`worldgen/${sidecarPath}`);
    const response = await fetch(
      new URL(sidecar.files.main, new URL(`${content}worldgen/${sidecarPath}`, location.href)),
    );
    if (!response.ok) throw new Error(`${asset}: HTTP ${response.status}`);
    const model = (await loader.parseAsync(await response.arrayBuffer(), '')).scene;
    const refs = new Set<string>();
    const geometries = new Set<THREE.BufferGeometry>();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        const resource = { asset, disposed: false };
        resources.push(resource);
        mesh.geometry.addEventListener('dispose', () => {
          resource.disposed = true;
        });
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const ref = material.userData.molenSurface?.ref;
        if (typeof ref === 'string') refs.add(ref);
      }
    });
    await surfaceSet.prepare([...refs]);
    return model;
  },
  { resolveSurface: ({ ref, slot }) => surfaceSet.materialFor(slot, ref) },
);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfd1df');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1440, 1080);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
// Ambient occlusion is supplied by the shared surfaces; omit broad shadow-map artifacts.
document.body.append(renderer.domElement);
const hemisphere = new THREE.HemisphereLight('#e6f1ff', '#657364', 2.1);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#fff3db', 3);
sun.position.set(-200, 400, 350);
scene.add(sun);
// Opt in explicitly so earlier captures remain reproducible with their original lighting.
if (new URLSearchParams(location.search).get('reflections') === '1') {
  const reflections = new SkyReflections(scene, createWebGlSkyReflectionFilter(renderer));
  reflections.update(reflectionStateFromLights(hemisphere, sun, scene.background, 0));
  // The reflection map now supplies diffuse sky irradiance as well as metal reflections.
  hemisphere.intensity = 0;
  window.addEventListener('pagehide', () => reflections.dispose(), { once: true });
}
const perspectiveCamera = new THREE.PerspectiveCamera(38, 1440 / 1080, 0.1, 20000);
const placementCamera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 20000);
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspectiveCamera;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#93a185', roughness: 1 }),
);
markTerrainGroundSurface(ground);
const groundCutouts = new TerrainGroundCutoutController();
const uncutGroundGeometry = ground.geometry;
ground.position.y = -0.04;
scene.add(ground);

type Triplet = [number, number, number];
interface ReviewInput {
  viewingDate?: string;
  asset: string;
  title: string;
  placement?: StructurePlacement;
  /** Actual mapped perimeter, not a generated footprint. Coordinates are WGS84. */
  footprint?: [number, number][];
  /** Open mapped road alignments, kept separate without artificial closing segments. */
  footprintLines?: [number, number][][];
}
let active: ReviewInput | undefined;
let object: THREE.Object3D | undefined;
let tileRoot: THREE.Object3D | undefined;
let geographicRenderers: ReturnType<typeof createWorldgenSemanticRenderers> | undefined;
let outline: THREE.Line | undefined;
let resourceStart = 0;
let loadStart = 0;
let selectionBounds: [number, number, number, number] | undefined;
const bounds = new THREE.Box3();

function unload() {
  if (geographicRenderers && tileRoot) {
    scene.remove(tileRoot);
    geographicRenderers.humanFeatures.disposeTile?.(tileRoot);
    geographicRenderers.dispose();
  } else if (object && active) {
    scene.remove(object);
    models.release(active.asset);
  }
  if (outline) {
    scene.remove(outline);
    outline.geometry.dispose();
    (outline.material as THREE.Material).dispose();
    outline = undefined;
  }
  const disposed = resources.slice(resourceStart).every((entry) => entry.disposed);
  object = undefined;
  active = undefined;
  tileRoot = undefined;
  geographicRenderers = undefined;
  selectionBounds = undefined;
  groundCutouts.update(scene);
  renderer.render(scene, camera);
  return {
    disposed,
    liveModelGeometries: resources.filter((entry) => !entry.disposed).length,
    groundRestored: ground.geometry === uncutGroundGeometry && groundAt(new THREE.Vector3(0, 0, 0)),
  };
}

async function mount(input: ReviewInput) {
  unload();
  active = input;
  resourceStart = resources.length;
  loadStart = loads.length;
  if (
    input.placement &&
    (input.placement.status === 'preview' ||
      (input.placement.status === 'historical' && input.viewingDate !== undefined)) &&
    !input.placement.bounds
  ) {
    const entry = input.placement;
    const factor = Math.cos((entry.anchor[1] * Math.PI) / 180);
    const center = wgs84ToWorld(factor, ...entry.anchor);
    const tileSize = 256;
    const origin: [number, number] = [center[0] - tileSize / 2, center[1] - tileSize / 2];
    const [west, north] = worldToWgs84(factor, ...origin);
    const [east, south] = worldToWgs84(factor, origin[0] + tileSize, origin[1] + tileSize);
    selectionBounds = [west, south, east, north];
    geographicRenderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog),
      ...(input.viewingDate !== undefined ? { viewingDate: input.viewingDate } : {}),
      structureObjects: models,
      metersPerUnit: factor,
      roads: { renderTransportation: false },
    });
    const context: TerrainPyramidTileLayerContext = {
      address: { level: 16, x: 0, z: 0 },
      origin,
      tileSize,
      pyramid: {
        name: 'landmark-placement-review',
        origin,
        rootSize: tileSize,
        minLevel: 16,
        maxLevel: 16,
        tileResolution: 3,
        height: { min: 0, max: 1 },
        layers: [],
        skirts: false,
      },
      descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
      heightfield: new Heightfield(new Float32Array(9), 3, 3, {
        origin,
        worldSize: [tileSize, tileSize],
        height: { min: 0, max: 1 },
      }),
      signal: new AbortController().signal,
    };
    tileRoot = await geographicRenderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      context,
    );
    if (!tileRoot) throw new Error('Placement renderer returned an empty tile');
    object = tileRoot.getObjectByName(`structure:${entry.id}`);
    if (!object) throw new Error(`The runtime index did not place ${entry.id}`);
    // Keep the real regional selection and resource lifetime, but isolate the reviewed
    // landmark in its images. Nearby landmarks can legitimately share this tile.
    tileRoot.traverse((child) => {
      if (child.name.startsWith('structure:')) child.visible = child === object;
    });
    // Translate the geographic tile to the review origin, retaining model heading/scale.
    tileRoot.position.set(-tileSize / 2, 0, -tileSize / 2);
    scene.add(tileRoot);
    const evidenceLines = input.footprintLines ?? (input.footprint ? [input.footprint] : []);
    if (evidenceLines.length) {
      const project = (point: [number, number]) => {
        const [x, z] = wgs84ToWorld(factor, ...point);
        return new THREE.Vector3(x - center[0], 0.08, z - center[1]);
      };
      const material = new THREE.LineBasicMaterial({
        color: '#e241b0',
        depthTest: false,
        depthWrite: false,
      });
      if (input.footprintLines) {
        const points: THREE.Vector3[] = [];
        for (const line of evidenceLines) {
          for (let i = 1; i < line.length; i++) {
            const previous = line[i - 1],
              point = line[i];
            if (previous && point) points.push(project(previous), project(point));
          }
        }
        outline = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(points),
          material,
        );
      } else {
        outline = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints((input.footprint ?? []).map(project)),
          material,
        );
      }
      outline.renderOrder = 1000;
      scene.add(outline);
      outline.visible = false;
    }
  } else {
    const prepared = await models.acquire(input.asset);
    object = models.instantiate(prepared);
    scene.add(object);
  }
  scene.updateMatrixWorld(true);
  bounds.setFromObject(object);
  caption('#title', input.title);
  return telemetry();
}

function groundAt(point: THREE.Vector3): boolean {
  ground.updateWorldMatrix(true, false);
  return (
    new THREE.Raycaster(
      new THREE.Vector3(point.x, 10000, point.z),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(ground).length > 0
  );
}
function cutoutProbe(): THREE.Vector3 | undefined {
  const outline = active?.placement?.groundCutout?.outline;
  if (!outline || !object || !geographicRenderers) return undefined;
  const points = outline.map(([x, z]) => new THREE.Vector2(x, z));
  let selected: number[] | undefined,
    area = 0;
  for (const tri of THREE.ShapeUtils.triangulateShape(points, [])) {
    const [a, b, c] = tri.map((i) => points[i] as THREE.Vector2) as [
      THREE.Vector2,
      THREE.Vector2,
      THREE.Vector2,
    ];
    const next = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (next > area) {
      area = next;
      selected = tri;
    }
  }
  if (!selected) throw new Error('Ground opening has no interior probe');
  const center = new THREE.Vector3();
  for (const i of selected) {
    const p = points[i] as THREE.Vector2;
    center.x += p.x / 3;
    center.z += p.y / 3;
  }
  object.updateWorldMatrix(true, false);
  return object.localToWorld(center);
}
function verifyGroundLifecycle() {
  const probe = cutoutProbe();
  if (!probe || !object)
    return { applicable: false, unchanged: ground.geometry === uncutGroundGeometry };
  object.visible = false;
  groundCutouts.update(scene);
  const hiddenRestored = groundAt(probe) && ground.geometry === uncutGroundGeometry;
  object.visible = true;
  groundCutouts.update(scene);
  const visibleOpen = !groundAt(probe) && ground.geometry !== uncutGroundGeometry;
  return { applicable: true, hiddenRestored, visibleOpen };
}

function telemetry() {
  const materials = new Set<THREE.Material>();
  let triangles = 0,
    meshes = 0;
  object?.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      materials.add(material);
  });
  const world = object?.getWorldPosition(new THREE.Vector3());
  const visibleStructures: string[] = [];
  tileRoot?.traverseVisible((child) => {
    if (child.name.startsWith('structure:')) visibleStructures.push(child.name.slice(10));
  });
  return {
    asset: active?.asset,
    mode: geographicRenderers ? 'geographic-flat-terrain' : 'asset-review',
    placementId: geographicRenderers ? active?.placement?.id : null,
    position: world?.toArray(),
    heading: object?.rotation.y,
    meshes,
    triangles,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    surfaces: Object.fromEntries(
      [...materials]
        .filter((material) => material.name.startsWith('worldgen:matgraph:'))
        .map((material) => [
          material.name,
          (material as THREE.MeshStandardMaterial).map?.uuid ?? null,
        ]),
    ),
    loads: loads.slice(loadStart),
    selectionBounds,
    visibleStructures,
    groundCutoutActive: ground.geometry !== uncutGroundGeometry,
    groundCoversCutoutProbe: cutoutProbe() ? groundAt(cutoutProbe() as THREE.Vector3) : null,
    surfaceReads: { ...reads },
    draws: renderer.info.render.calls,
    renderedTriangles: renderer.info.render.triangles,
  };
}

async function view(input: {
  name: string;
  position?: Triplet;
  lookAt?: Triplet;
  angle?: number;
  placement?: boolean;
}) {
  if (!object) throw new Error('Mount a model before setting its view');
  if (outline) outline.visible = input.placement ?? false;
  const size = bounds.getSize(new THREE.Vector3());
  const target = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 1.9;
  camera = input.placement ? placementCamera : perspectiveCamera;
  camera.up.set(0, 1, 0);
  if (input.position && input.lookAt) {
    object.updateMatrixWorld(true);
    camera.position.copy(object.localToWorld(new THREE.Vector3(...input.position)));
    camera.lookAt(object.localToWorld(new THREE.Vector3(...input.lookAt)));
  } else if (input.placement) {
    // A perspective plan enlarges high roofs relative to the ground footprint. Use one
    // orthographic scale for all heights so the map overlay can expose actual fit errors.
    const halfHeight = Math.max(size.x / (1440 / 1080), size.z, 24) * 0.7;
    placementCamera.left = -halfHeight * (1440 / 1080);
    placementCamera.right = halfHeight * (1440 / 1080);
    placementCamera.top = halfHeight;
    placementCamera.bottom = -halfHeight;
    camera.position.set(target.x, bounds.max.y + Math.max(size.x, size.z, 30) * 2, target.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(target);
  } else {
    const angle = input.angle ?? 0.6;
    camera.up.set(0, 1, 0);
    camera.position.set(
      target.x + Math.sin(angle) * radius,
      target.y + radius * 0.3,
      target.z + Math.cos(angle) * radius,
    );
    camera.lookAt(target);
  }
  if (
    camera === perspectiveCamera &&
    new URLSearchParams(location.search).get('clipping') === 'adaptive'
  ) {
    camera.updateMatrixWorld(true);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const depths: number[] = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          depths.push(new THREE.Vector3(x, y, z).sub(camera.position).dot(forward));
    const clipping = reviewClipping(Math.min(...depths), Math.max(...depths));
    camera.near = clipping.near;
    camera.far = clipping.far;
  }
  camera.updateProjectionMatrix();
  groundCutouts.update(scene);
  renderer.render(scene, camera);
  await new Promise<void>((done) => requestAnimationFrame(() => done()));
  groundCutouts.update(scene);
  renderer.render(scene, camera);
  const state = telemetry();
  caption(
    '#detail',
    input.placement
      ? 'North is up · magenta: cached OSM outline · flat terrain placement check'
      : `${input.name} · shared world-viewer materials`,
  );
  caption(
    '#status',
    `${state.triangles.toLocaleString()} triangles · ${Object.keys(state.surfaces).length} shared surfaces · ${state.mode}`,
  );
  return state;
}

Object.assign(window, { landmarkLibraryQA: { mount, view, unload, verifyGroundLifecycle } });

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
let expectedBoundedPlacementBounds: THREE.Box3 | undefined;
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
  reviewSurface?: 'water';
  viewingDate?: string;
  asset: string;
  title: string;
  /** Explicit isolated-stage datum; never changes a geographic terrain placement. */
  reviewGroundY?: number;
  placement?: StructurePlacement;
  /** Review a complete bounded landmark in a tile large enough to contain its bounds. */
  reviewBoundedPlacement?: boolean;
  /** Actual mapped perimeter, not a generated footprint. Coordinates are WGS84. */
  footprint?: [number, number][];
  /** Optional source credit for non-OSM reference geometry. */
  footprintLabel?: string;
  /** Open mapped road alignments, kept separate without artificial closing segments. */
  footprintLines?: [number, number][][];
  /** Exact mapped point; a small cross is a review marker, never a building perimeter. */
  footprintPoint?: [number, number];
}
let active: ReviewInput | undefined;
let object: THREE.Object3D | undefined;
let tileRoot: THREE.Object3D | undefined;
let geographicRenderers: ReturnType<typeof createWorldgenSemanticRenderers> | undefined;
let outline: THREE.Line | undefined;
let resourceStart = 0;
let loadStart = 0;
let selectionBounds: [number, number, number, number] | undefined;
const terrainSamples: {
  placementId: string;
  coordinate: [number, number];
  height: number;
}[] = [];
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
  ground.position.y = -0.04;
  (ground.material as THREE.MeshStandardMaterial).color.set('#93a185');
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
  if (input.reviewGroundY !== undefined) {
    if (!Number.isFinite(input.reviewGroundY)) throw new Error('Invalid review datum');
    ground.position.y = input.reviewGroundY - 0.04;
  }
  if (input.reviewSurface === 'water') {
    (ground.material as THREE.MeshStandardMaterial).color.set('#4c6e77');
    ground.position.y = input.reviewGroundY ?? 0;
  }
  terrainSamples.length = 0;
  active = input;
  resourceStart = resources.length;
  loadStart = loads.length;
  expectedBoundedPlacementBounds = undefined;
  if (
    input.placement &&
    (input.placement.status === 'preview' ||
      (input.placement.status === 'historical' && input.viewingDate !== undefined)) &&
    (!input.placement.bounds || input.reviewBoundedPlacement)
  ) {
    const entry = input.placement;
    const factor = Math.cos((entry.anchor[1] * Math.PI) / 180);
    const center = wgs84ToWorld(factor, ...entry.anchor);
    const boundCorners = entry.bounds
      ? [
          wgs84ToWorld(factor, entry.bounds[0], entry.bounds[1]),
          wgs84ToWorld(factor, entry.bounds[2], entry.bounds[3]),
        ]
      : [];
    const boundedSpan = Math.max(
      0,
      ...boundCorners.flatMap((point) => point.map((v, i) => 2 * Math.abs(v - center[i]) + 16)),
    );
    // Small bounded ruins need a local review query. Preserve the existing stage
    // size for point placements and larger structures.
    const tileSize = Math.max(
      input.reviewBoundedPlacement && entry.bounds && boundedSpan < 128 ? 128 : 256,
      boundedSpan,
    );
    const origin: [number, number] = [center[0] - tileSize / 2, center[1] - tileSize / 2];
    const [west, north] = worldToWgs84(factor, ...origin);
    const [east, south] = worldToWgs84(factor, origin[0] + tileSize, origin[1] + tileSize);
    selectionBounds = [west, south, east, north];
    geographicRenderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog),
      ...(input.viewingDate !== undefined ? { viewingDate: input.viewingDate } : {}),
      structureObjects: models,
      metersPerUnit: factor,
      ...(entry.terrainReference
        ? {
            // Synthetic bank datum puts native Y0 on the review plane while exercising
            // the real off-origin reference path. It is not a geographic terrain survey.
            sampleStructureTerrain: (
              coordinate: readonly [number, number],
              request: { entry: StructurePlacement },
            ) => {
              const height =
                (request.entry.terrainReference?.modelHeight ?? 0) *
                (request.entry.scale?.[1] ?? 1);
              terrainSamples.push({
                placementId: request.entry.id,
                coordinate: [...coordinate],
                height,
              });
              return height;
            },
          }
        : {}),
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
    if (entry.bounds) {
      // Bounded placement bakes the transform into clipped vertex buffers; its
      // root transform is deliberately different from an unbounded landmark.
      const prepared = await models.acquire(entry.asset);
      const placementMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(0, entry.elevation ?? 0, 0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.heading ?? 0),
        new THREE.Vector3(...(entry.scale ?? [1, 1, 1])),
      );
      // Transform actual source vertices: rotating an axis-aligned box can
      // overestimate the envelope of tapered roofs, railings and piers.
      expectedBoundedPlacementBounds = new THREE.Box3();
      const point = new THREE.Vector3();
      prepared.scene.updateMatrixWorld(true);
      prepared.scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          point
            .fromBufferAttribute(positions, i)
            .applyMatrix4(mesh.matrixWorld)
            .applyMatrix4(placementMatrix);
          expectedBoundedPlacementBounds?.expandByPoint(point);
        }
      });
      models.release(entry.asset);
    }
    const evidenceLines = input.footprintLines ?? (input.footprint ? [input.footprint] : []);
    if (evidenceLines.length || input.footprintPoint) {
      const project = (point: [number, number]) => {
        const [x, z] = wgs84ToWorld(factor, ...point);
        return new THREE.Vector3(x - center[0], ground.position.y + 0.12, z - center[1]);
      };
      const material = new THREE.LineBasicMaterial({
        color: '#e241b0',
        depthTest: false,
        depthWrite: false,
      });
      if (input.footprintPoint) {
        const point = project(input.footprintPoint);
        outline = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints([
            point.clone().add(new THREE.Vector3(-0.4, 0, 0)),
            point.clone().add(new THREE.Vector3(0.4, 0, 0)),
            point.clone().add(new THREE.Vector3(0, 0, -0.4)),
            point.clone().add(new THREE.Vector3(0, 0, 0.4)),
          ]),
          material,
        );
      } else if (input.footprintLines) {
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
function cutoutProbe(outline: [number, number][]): THREE.Vector3 | undefined {
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
  const entry = expectedBoundedPlacementBounds ? active?.placement : undefined;
  if (entry) {
    // Bounded placement bakes the native transform into the vertices and opening.
    // Probe the same native frame used by the review cameras, not the clipped root.
    return center.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(0, entry.elevation ?? 0, 0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.heading ?? 0),
        new THREE.Vector3(...(entry.scale ?? [1, 1, 1])),
      ),
    );
  }
  object.updateWorldMatrix(true, false);
  return object.localToWorld(center);
}
function cutoutProbes(): THREE.Vector3[] {
  const cutout = active?.placement?.groundCutout;
  return cutout
    ? [cutout.outline, ...(cutout.additionalOutlines ?? [])]
        .map(cutoutProbe)
        .filter((p): p is THREE.Vector3 => !!p)
    : [];
}
function verifyGroundLifecycle() {
  const probes = cutoutProbes();
  if (!probes.length || !object)
    return { applicable: false, unchanged: ground.geometry === uncutGroundGeometry };
  object.visible = false;
  groundCutouts.update(scene);
  const hiddenRestored = probes.every(groundAt) && ground.geometry === uncutGroundGeometry;
  object.visible = true;
  groundCutouts.update(scene);
  const visibleOpen =
    probes.every((probe) => !groundAt(probe)) && ground.geometry !== uncutGroundGeometry;
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
    ...(expectedBoundedPlacementBounds
      ? {
          expectedBoundedPlacementBounds: {
            min: expectedBoundedPlacementBounds.min.toArray(),
            max: expectedBoundedPlacementBounds.max.toArray(),
          },
        }
      : {}),
    reviewGroundY: active?.reviewGroundY ?? 0,
    surfaces: Object.fromEntries(
      [...materials]
        .filter((material) => material.name.startsWith('worldgen:matgraph:'))
        .map((material) => [
          // Window-slot variants share the canonical graph's texture maps.
          material.name.endsWith(':glass') ? material.name.slice(0, -6) : material.name,
          (material as THREE.MeshStandardMaterial).map?.uuid ?? null,
        ]),
    ),
    loads: loads.slice(loadStart),
    selectionBounds,
    terrainSamples: terrainSamples.map((sample) => ({
      ...sample,
      coordinate: [...sample.coordinate],
    })),
    visibleStructures,
    groundCutoutActive: ground.geometry !== uncutGroundGeometry,
    groundCoversCutoutProbe: cutoutProbes().length ? cutoutProbes().some(groundAt) : null,
    groundCutoutProbes: cutoutProbes().length,
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
    const entry = expectedBoundedPlacementBounds ? active?.placement : undefined;
    const nativeFrame = entry
      ? new THREE.Matrix4().compose(
          new THREE.Vector3(0, entry.elevation ?? 0, 0),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.heading ?? 0),
          new THREE.Vector3(...(entry.scale ?? [1, 1, 1])),
        )
      : object.matrixWorld;
    camera.position.copy(new THREE.Vector3(...input.position).applyMatrix4(nativeFrame));
    camera.lookAt(new THREE.Vector3(...input.lookAt).applyMatrix4(nativeFrame));
  } else if (input.placement) {
    // A perspective plan enlarges high roofs relative to the ground footprint. Use one
    // orthographic scale for all heights so the map overlay can expose actual fit errors.
    // Nearby mapped roads can lie outside a narrow tower's envelope. Include the actual
    // evidence lines so a placement review cannot silently crop out its map evidence.
    const planBounds = bounds.clone();
    if (outline) planBounds.union(new THREE.Box3().setFromObject(outline));
    const planSize = planBounds.getSize(new THREE.Vector3());
    const planCenter = planBounds.getCenter(new THREE.Vector3());
    const halfHeight = Math.max(planSize.x / (1440 / 1080), planSize.z, 24) * 0.7;
    placementCamera.left = -halfHeight * (1440 / 1080);
    placementCamera.right = halfHeight * (1440 / 1080);
    placementCamera.top = halfHeight;
    placementCamera.bottom = -halfHeight;
    camera.position.set(
      planCenter.x,
      bounds.max.y + Math.max(planSize.x, planSize.z, 30) * 2,
      planCenter.z,
    );
    camera.up.set(0, 0, -1);
    camera.lookAt(new THREE.Vector3(planCenter.x, target.y, planCenter.z));
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
  // Large distributed arrays need the same depth fitting in the north-up plan.
  // The explicit opt-in keeps the existing default capture path unchanged.
  if (new URLSearchParams(location.search).get('clipping') === 'adaptive') {
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
      ? `North is up · magenta: ${active?.footprintLabel ?? 'cached OSM outline'} · flat terrain placement check`
      : `${input.name} · shared world-viewer materials`,
  );
  caption(
    '#status',
    `${state.triangles.toLocaleString()} triangles · ${Object.keys(state.surfaces).length} shared surfaces · ${state.mode}`,
  );
  return state;
}

Object.assign(window, { landmarkLibraryQA: { mount, view, unload, verifyGroundLifecycle } });

import {
  AdaptiveQualityController,
  AssetCache,
  type AssetProvider,
  applyEnvironment,
  createViewer,
  MaterialResolver,
  type MolenClient,
} from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import { type AircraftData, validateByKind } from '@bendyline/molen-schema';
import type { TerrainSurfaceRenderer } from '@bendyline/molen-terrain/client';
import {
  createDefaultTerrainSemanticRenderer,
  createProfiledTerrainPackageSemanticLayers,
  createTerrainLandcoverWorkerBridge,
  createTerrainPackagePyramidStream,
  createTerrainPackageStream,
  createTerrainSemanticPyramidLayer,
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
  type TerrainPackagePyramidStream,
  type TerrainPackageStream,
  type TerrainPyramidStreamStats,
  type TerrainPyramidTileLayer,
  type TerrainQualityPreset,
  type TerrainStreamStats,
  type TerrainTileArchive,
  type TerrainTileLayer,
  terrainDescriptorFromPackage,
  terrainPyramidBudgetForQuality,
  terrainStreamBudgetForQuality,
} from '@bendyline/molen-terrain/client';
import {
  encodePng16,
  type TerrainPackageDescriptor,
  webMercatorScaleAtLatitude,
  webMercatorToWgs84,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import {
  createResolvedMaterialSet,
  ModelLibrary,
  type ScreenSpaceLodPolicy,
} from '@bendyline/molen-worldgen/client';
import { stylePackMaterialRefs } from '@bendyline/molen-worldgen/kernel';
import {
  createRegionResolver,
  createWorldgenSemanticRenderers,
  createWorldgenTileCache,
  createWorldgenWorkerBridge,
  type WorldgenSemanticRenderers,
} from '@bendyline/molen-worldgen-earth/client';
import type { PlacesContent } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createExplorerFog, createExplorerSky, updateExplorerFog } from './atmosphere.js';
import { selectedAntialias, selectedRendererBackend } from './backend-options.js';
import {
  applyCameraLookDelta,
  cameraForward,
  cameraPlanarForward,
  cameraRight,
  terrainViewNeedsImmediateUpdate,
} from './camera-controls.js';
import { type ExplorerWorldgenContent, loadExplorerContent } from './content.js';
import { afterPreparation } from './deferred-renderer.js';
import { formatCameraLocation } from './location-readout.js';
import {
  explorerPerformanceTier,
  explorerPixelRatio,
  manualQualityLevel,
} from './performance-policy.js';
import { createSkyControls } from './sky-controls.js';
import { createSurfaceControls } from './surface-controls.js';
import { syntheticFeatureTile, syntheticLandcoverTile } from './synthetic-footprints.js';
import { WalkCollision } from './walk-collision.js';
import { WALK_EYE_HEIGHT, WalkController } from './walk-controller.js';
import { createWeatherControls } from './weather-controls.js';
import { AIRCRAFT_HELP, WorldAircraft } from './world-aircraft.js';
import { WorldVehicles } from './world-vehicles.js';

const DEMO_LEVEL = 13;
const DEMO_MIN_LEVEL = 8;
const DEMO_RESOLUTION = 33;
const START = { longitude: -122.0356, latitude: 47.6163, label: 'Sammamish, Washington' };
type AircraftKind = 'p51d' | 'oh6';
const aircraftEntityId = (kind: AircraftKind) => `molen.entities.aircraft.${kind}` as const;

const DEMO_PACKAGE: TerrainPackageDescriptor = {
  format: 'molen/terrain-package@1',
  name: 'procedural-earth-architecture-demo',
  version: '1',
  coordinateSpace: {
    kind: 'geospatial',
    crs: 'EPSG:3857',
    ellipsoid: 'WGS84',
    bounds: [-180, -85.05112878, 180, 85.05112878],
  },
  tileMatrix: {
    scheme: 'xyz',
    minLevel: DEMO_MIN_LEVEL,
    maxLevel: DEMO_LEVEL,
    rootTiles: [1, 1],
    tileResolution: DEMO_RESOLUTION,
  },
  elevation: {
    source: { kind: 'pmtiles', path: 'procedural-memory.pmtiles' },
    encoding: 'png16',
    height: { min: -100, max: 900 },
  },
  surface: { seaLevel: 0 },
  attribution: [{ text: 'Procedural demonstration data', license: 'CC0-1.0' }],
  provenance: {
    compiler: 'world-explorer demo',
    compilerVersion: '1',
    sources: [{ id: 'procedural', release: '1' }],
  },
  files: [
    {
      path: 'procedural-memory.pmtiles',
      sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      bytes: 0,
    },
  ],
};

class ProceduralElevationArchive implements TerrainTileArchive {
  async getHeader(): Promise<{ minZoom: number; maxZoom: number; tileType: number }> {
    return { minZoom: DEMO_MIN_LEVEL, maxZoom: DEMO_LEVEL, tileType: 2 };
  }

  async getZxy(
    level: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<{ data: ArrayBuffer } | undefined> {
    if (signal?.aborted || level < DEMO_MIN_LEVEL || level > DEMO_LEVEL) return undefined;
    const edge = DEMO_RESOLUTION - 1;
    const detailScale = 2 ** (DEMO_LEVEL - level);
    const values = new Float32Array(DEMO_RESOLUTION * DEMO_RESOLUTION);
    for (let row = 0; row < DEMO_RESOLUTION; row++) {
      for (let column = 0; column < DEMO_RESOLUTION; column++) {
        // Global integer sample coordinates make adjacent tile borders byte-identical.
        const gx = (x * edge + column) * detailScale;
        const gy = (y * edge + row) * detailScale;
        const broad = Math.sin(gx * 0.018) * Math.cos(gy * 0.015);
        const ridge = Math.sin((gx + gy) * 0.047) * 0.5;
        const detail = Math.sin(gx * 0.13 - gy * 0.11) * 0.18;
        values[row * DEMO_RESOLUTION + column] = Math.max(
          0.05,
          Math.min(0.95, 0.38 + broad * 0.22 + ridge * 0.12 + detail * 0.08),
        );
      }
    }
    const png = encodePng16({
      width: DEMO_RESOLUTION,
      height: DEMO_RESOLUTION,
      data: values,
    });
    return { data: png.slice().buffer };
  }
}

function random01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

const TREE_TRUNK_GEOMETRY = new THREE.CylinderGeometry(2.8, 4.2, 22, 6);
const TREE_TRUNK_MATERIAL = new THREE.MeshStandardMaterial({ color: '#604832', roughness: 1 });
const TREE_CANOPY_GEOMETRY = new THREE.ConeGeometry(14, 38, 7);
const TREE_CANOPY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#2f633d',
  roughness: 0.96,
});
const BUILDING_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const BUILDING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#b9ab96',
  roughness: 0.82,
});
const ROAD_MATERIAL = new THREE.MeshStandardMaterial({ color: '#34383b', roughness: 0.93 });
const SHOULDER_MATERIAL = new THREE.MeshStandardMaterial({ color: '#827964', roughness: 1 });

function disposeFeatureTile(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.terrainOwnedGeometry === true) mesh.geometry.dispose();
  });
}

const forestLayer: TerrainTileLayer = {
  id: 'land-classification',
  category: 'classification',
  visible: false,
  createTile({ address, descriptor, heightfield }): THREE.Object3D {
    const capacity = 180;
    const group = new THREE.Group();
    const trunks = new THREE.InstancedMesh(TREE_TRUNK_GEOMETRY, TREE_TRUNK_MATERIAL, capacity);
    const canopies = new THREE.InstancedMesh(TREE_CANOPY_GEOMETRY, TREE_CANOPY_MATERIAL, capacity);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const tileOriginX = descriptor.origin[0] + address.x * descriptor.chunkSize;
    const tileOriginZ = descriptor.origin[1] + address.z * descriptor.chunkSize;
    let placed = 0;
    for (let index = 0; index < capacity; index++) {
      const seed = (address.x * 73_856_093) ^ (address.z * 19_349_663) ^ (index * 83_492_791);
      const localX = random01(seed) * descriptor.chunkSize;
      const localZ = random01(seed ^ 0x9e3779b9) * descriptor.chunkSize;
      const worldX = tileOriginX + localX;
      const worldZ = tileOriginZ + localZ;
      const height = heightfield.sampleHeight(worldX, worldZ);
      const slope = heightfield.slopeAt(worldX, worldZ);
      const habitat =
        Math.sin(worldX * 0.00041) + Math.cos(worldZ * 0.00037) + random01(seed ^ 0x632be59b) * 0.9;
      if (height < 4 || slope > 0.16 || habitat < 0.15) continue;
      const scale = 0.65 + random01(seed ^ 0x85ebca6b) * 0.8;
      matrix.compose(
        new THREE.Vector3(localX, height + 11 * scale, localZ),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale),
      );
      trunks.setMatrixAt(placed, matrix);
      matrix.compose(
        new THREE.Vector3(localX, height + 41 * scale, localZ),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale),
      );
      canopies.setMatrixAt(placed, matrix);
      color.setHSL(0.32 + random01(seed ^ 0xc2b2ae35) * 0.05, 0.38, 0.27 + scale * 0.035);
      canopies.setColorAt(placed, color);
      placed++;
    }
    trunks.count = placed;
    canopies.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor !== null) canopies.instanceColor.needsUpdate = true;
    group.add(trunks, canopies);
    group.name = `forest:${address.x}_${address.z}`;
    return group;
  },
};

function roadLocalZ(address: { x: number; z: number }, chunkSize: number, u: number): number {
  const phase = (address.x + u) * 1.35 + address.z * 0.41;
  return chunkSize * (0.5 + Math.sin(phase) * 0.1 + Math.sin(phase * 0.37) * 0.045);
}

function createRoadRibbon(
  points: THREE.Vector3[],
  width: number,
  material: THREE.Material,
): THREE.Mesh {
  const positions = new Float32Array(points.length * 2 * 3);
  const normals = new Float32Array(points.length * 2 * 3);
  const indices: number[] = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[Math.max(0, index - 1)] as THREE.Vector3;
    const next = points[Math.min(points.length - 1, index + 1)] as THREE.Vector3;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const sideX = (-dz / length) * (width / 2);
    const sideZ = (dx / length) * (width / 2);
    const point = points[index] as THREE.Vector3;
    const offset = index * 6;
    positions.set([point.x + sideX, point.y, point.z + sideZ], offset);
    positions.set([point.x - sideX, point.y, point.z - sideZ], offset + 3);
    normals.set([0, 1, 0, 0, 1, 0], offset);
    if (index < points.length - 1) {
      const left = index * 2;
      indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.terrainOwnedGeometry = true;
  return mesh;
}

const humanFeatureLayer: TerrainTileLayer = {
  id: 'human-features',
  category: 'human-feature',
  visible: false,
  createTile({ address, descriptor, heightfield }): THREE.Object3D {
    const group = new THREE.Group();
    if (((address.z % 3) + 3) % 3 !== 0) return group;
    const tileOriginX = descriptor.origin[0] + address.x * descriptor.chunkSize;
    const tileOriginZ = descriptor.origin[1] + address.z * descriptor.chunkSize;
    const roadPoints: THREE.Vector3[] = [];
    for (let index = 0; index <= 32; index++) {
      const u = index / 32;
      const localX = u * descriptor.chunkSize;
      const localZ = roadLocalZ(address, descriptor.chunkSize, u);
      roadPoints.push(
        new THREE.Vector3(
          localX,
          heightfield.sampleHeight(tileOriginX + localX, tileOriginZ + localZ) + 2.2,
          localZ,
        ),
      );
    }
    const shoulderPoints = roadPoints.map(
      (point) => new THREE.Vector3(point.x, point.y - 0.8, point.z),
    );
    group.add(
      createRoadRibbon(shoulderPoints, 24, SHOULDER_MATERIAL),
      createRoadRibbon(roadPoints, 13, ROAD_MATERIAL),
    );

    const capacity = 24;
    const boxes = new THREE.InstancedMesh(BUILDING_GEOMETRY, BUILDING_MATERIAL, capacity);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const color = new THREE.Color();
    let placed = 0;
    for (let index = 0; index < capacity; index++) {
      const seed = (address.x * 91_273) ^ (address.z * 130_363) ^ (index * 17_389);
      const u = 0.06 + random01(seed) * 0.88;
      const localX = u * descriptor.chunkSize;
      const side = random01(seed ^ 0x27d4eb2d) > 0.5 ? 1 : -1;
      const localZ =
        roadLocalZ(address, descriptor.chunkSize, u) +
        side * (34 + random01(seed ^ 0x165667b1) * 75);
      if (localZ < 20 || localZ > descriptor.chunkSize - 20) continue;
      const width = 24 + random01(seed ^ 0x165667b1) * 52;
      const depth = 22 + random01(seed ^ 0xd3a2646c) * 44;
      const height = 24 + random01(seed ^ 0xfd7046c5) * 88;
      const ground = heightfield.sampleHeight(tileOriginX + localX, tileOriginZ + localZ);
      const nextRoadZ = roadLocalZ(address, descriptor.chunkSize, Math.min(1, u + 0.01));
      const angle = -Math.atan2(
        nextRoadZ - roadLocalZ(address, descriptor.chunkSize, u),
        0.01 * descriptor.chunkSize,
      );
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      matrix.compose(
        new THREE.Vector3(localX, ground + height / 2, localZ),
        rotation,
        new THREE.Vector3(width, height, depth),
      );
      boxes.setMatrixAt(placed, matrix);
      color.setHSL(0.075 + random01(seed ^ 0x9e3779b9) * 0.035, 0.18, 0.5 + random01(seed) * 0.14);
      boxes.setColorAt(placed, color);
      placed++;
    }
    boxes.count = placed;
    boxes.instanceMatrix.needsUpdate = true;
    if (boxes.instanceColor !== null) boxes.instanceColor.needsUpdate = true;
    group.add(boxes);
    group.name = `human:${address.x}_${address.z}`;
    return group;
  },
  disposeTile: disposeFeatureTile,
};

/** Adaptive synthetic layers; the worldgen renderers take over when a style pack is loaded. */
function createSyntheticAdaptiveLayers(options: {
  lineup: boolean;
  /** The store review block's catalog; undefined when `?stores` is off or places did not load. */
  stores: PlacesContent | undefined;
  houses: boolean;
  parking: boolean;
  surfaceRenderer: TerrainSurfaceRenderer;
  renderers: WorldgenSemanticRenderers | undefined;
}): TerrainPyramidTileLayer[] {
  return [
    createTerrainSemanticPyramidLayer({
      id: forestLayer.id,
      category: forestLayer.category,
      visible: false,
      minLevel: DEMO_LEVEL - 1,
      source: {
        load: async (address) =>
          options.parking
            ? syntheticFeatureTile(address, { parking: true })
            : options.houses
              ? syntheticFeatureTile(address, { houses: true })
              : options.stores !== undefined && address.level === DEMO_LEVEL
                ? syntheticFeatureTile(address, { stores: options.stores })
                : syntheticLandcoverTile(address),
      },
      renderer:
        options.renderers?.classification ??
        createDefaultTerrainSemanticRenderer({
          renderWater: false,
          renderTransportation: false,
          renderBuildings: false,
          treesPerSquareKilometer: 70,
          maxTreesPerTile: 180,
          treeHeight: 28,
        }),
    }),
    createTerrainSemanticPyramidLayer({
      id: humanFeatureLayer.id,
      category: humanFeatureLayer.category,
      visible: false,
      minLevel: DEMO_LEVEL - 1,
      source: {
        load: async (address) =>
          syntheticFeatureTile(address, {
            lineup: options.lineup && address.level === DEMO_LEVEL,
            ...(options.stores !== undefined && address.level === DEMO_LEVEL
              ? { stores: options.stores }
              : {}),
            houses: options.houses,
            parking: options.parking,
          }),
      },
      renderer:
        options.renderers?.humanFeatures ??
        createDefaultTerrainSemanticRenderer({
          surfaceRenderer: options.surfaceRenderer,
          renderLandcover: false,
          renderWater: false,
        }),
    }),
  ];
}

interface ExplorerWorldgen extends WorldgenSemanticRenderers {
  prepareMaterials(): Promise<void>;
}

/** Worldgen renderers over the style pack, atlas and places content loaded from the packs. */
async function loadWorldgen(options: {
  telemetry: GraphicsTelemetry;
  startupStage: (name: string) => void;
  prepareObject?: (object: THREE.Object3D, signal: AbortSignal) => Promise<void>;
  content: ExplorerWorldgenContent;
  /** Every pack's assets: entity models, style-pack props and material documents. */
  assets: AssetProvider;
  surfaceRenderer: TerrainSurfaceRenderer;
  metersPerUnit: number;
  quality: TerrainQualityPreset;
  lodPolicy: ScreenSpaceLodPolicy;
  /** Generate tiles in a Worker by default; `?worker=0` enables in-thread diagnostics. */
  worker: boolean;
}): Promise<ExplorerWorldgen> {
  const { pack, atlas, places, placesDocs } = options.content;
  const regions = createRegionResolver(atlas, { metersPerUnit: options.metersPerUnit });
  const provider = options.assets;
  const assets = new AssetCache(provider, new GLTFLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    places.landmarks.definitions,
  );
  // Shared texture work starts after the first camera frame. Building tiles wait for it;
  // terrain, water, sky and navigation can run while the worker pool prepares the facades.
  const baker =
    options.worker && new URLSearchParams(location.search).get('materialWorker') !== '0'
      ? createMaterialBakeWorkerPool(
          Array.from(
            { length: 2 },
            () => new Worker(new URL('./material-worker.ts', import.meta.url), { type: 'module' }),
          ),
          { onTiming: (ms) => options.telemetry.record('material-bake', ms) },
        )
      : undefined;
  // Material docs come from the style pack's solid block, already in memory once opened.
  const materials = createResolvedMaterialSet(new MaterialResolver(provider, baker));
  let preparation: Promise<void> | undefined;
  let disposed = false;
  const prepareMaterials = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    preparation ??= (async () => {
      const status = document.getElementById('worldgen-status');
      if (status) status.hidden = false;
      options.startupStage('material-baking-start');
      try {
        await materials.prepare(stylePackMaterialRefs(pack));
        if (disposed) return;
        for (const [ref, reason] of materials.failures)
          console.warn(`[molen] worldgen material ${ref}: ${reason}`);
        options.startupStage('material-baking');
      } finally {
        baker?.dispose();
        if (disposed) materials.dispose();
        if (status) status.hidden = true;
      }
    })();
    return preparation;
  };
  // Off-thread generation: the worker gets the same pack and atlas, and the renderer treats it
  // like the in-thread generator. Either way, repeat tiles come from the CPU cache.
  const generator = options.worker
    ? createWorldgenWorkerBridge(
        new Worker(new URL('./worldgen-worker.ts', import.meta.url), { type: 'module' }),
        { pack, atlas, metersPerUnit: options.metersPerUnit, places: placesDocs },
      )
    : undefined;
  const renderers = createWorldgenSemanticRenderers(pack, {
    places,
    ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
    onTileStats: (output, elapsed) => {
      options.telemetry.record('worldgen-total', elapsed);
      if (output.generationMs !== undefined)
        options.telemetry.record('worldgen-generation', output.generationMs);
      if (output.preparationMs !== undefined)
        options.telemetry.record('worldgen-preparation', output.preparationMs);
    },
    atlas,
    regions,
    models,
    materials,
    metersPerUnit: options.metersPerUnit,
    quality: options.quality,
    lodPolicy: options.lodPolicy,
    propLod: new URLSearchParams(location.search).get('propLod') !== '0',
    interiors: new URLSearchParams(location.search).get('interiors') !== '0',
    ...(options.worker
      ? {
          landcoverGenerator: createTerrainLandcoverWorkerBridge(
            new Worker(new URL('./landcover-worker.ts', import.meta.url), { type: 'module' }),
          ),
        }
      : {}),
    roads: { surfaceRenderer: options.surfaceRenderer },
    ...(generator !== undefined ? { generator } : {}),
    cache: createWorldgenTileCache({ maxEntries: 512, maxBytes: 192 * 1024 * 1024 }),
  });
  return {
    ...renderers,
    prepareMaterials,
    humanFeatures: afterPreparation(renderers.humanFeatures, prepareMaterials),
    dispose() {
      if (disposed) return;
      disposed = true;
      baker?.dispose();
      renderers.dispose();
      generator?.dispose();
      materials.dispose();
      assets.dispose();
    },
  };
}

async function loadPackage(): Promise<{
  descriptor: TerrainPackageDescriptor;
  baseUrl?: string;
  archive?: TerrainTileArchive;
  label: string;
  synthetic: boolean;
}> {
  const params = new URLSearchParams(location.search);
  if (params.has('synthetic')) {
    return {
      descriptor: DEMO_PACKAGE,
      archive: new ProceduralElevationArchive(),
      label: 'Synthetic demo · not matched to real geography',
      synthetic: true,
    };
  }
  const manifestParam = params.get('package') ?? 'terrain/sammamish/terrain-package.json';
  const manifestUrl = new URL(manifestParam, location.href);
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`terrain package failed: HTTP ${response.status}`);
  const parsed = validateByKind('terrain-package', await response.json());
  if (!parsed.ok) throw new Error(parsed.formatted);
  return {
    descriptor: parsed.value as TerrainPackageDescriptor,
    baseUrl: new URL('.', manifestUrl).href,
    label: `${(parsed.value as TerrainPackageDescriptor).name} · PMTiles elevation`,
    synthetic: false,
  };
}

function selectedLevel(pkg: TerrainPackageDescriptor): number {
  const raw = new URLSearchParams(location.search).get('level');
  if (raw === null) return pkg.tileMatrix.maxLevel;
  const level = Number(raw);
  if (!Number.isSafeInteger(level)) throw new Error(`invalid ?level=${raw}`);
  return level;
}

function selectedQuality(): TerrainQualityPreset {
  const value = new URLSearchParams(location.search).get('quality');
  return value === 'economy' || value === 'high' ? value : 'balanced';
}

function isPyramidStats(
  stats: TerrainStreamStats | TerrainPyramidStreamStats,
): stats is TerrainPyramidStreamStats {
  return 'fallbackLeaves' in stats;
}

function selectedStart(): { longitude: number; latitude: number; label: string } {
  const params = new URLSearchParams(location.search);
  const longitude = Number(params.get('lon') ?? START.longitude);
  const latitude = Number(params.get('lat') ?? START.latitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('longitude must be finite and between -180 and 180');
  }
  if (!Number.isFinite(latitude) || latitude < -85.05112878 || latitude > 85.05112878) {
    throw new Error('latitude must fit the Web Mercator range');
  }
  return {
    longitude,
    latitude,
    label: params.has('lon') || params.has('lat') ? 'Custom coordinates' : START.label,
  };
}

function selectedCameraAngles(): { altitude: number; yaw: number; pitch: number } {
  const params = new URLSearchParams(location.search);
  const altitude = Number(params.get('alt') ?? 1_400);
  const yaw = Number(params.get('yaw') ?? -Math.PI / 2);
  const pitch = Number(params.get('pitch') ?? -0.35);
  if (!Number.isFinite(altitude) || altitude < -1_000 || altitude > 500_000) {
    throw new Error('altitude must be finite and between -1000 and 500000 meters');
  }
  if (!Number.isFinite(yaw)) throw new Error('yaw must be finite radians');
  if (!Number.isFinite(pitch) || pitch < -1.5 || pitch > 1.5) {
    throw new Error('pitch must be finite radians from -1.5 through 1.5');
  }
  return { altitude, yaw, pitch };
}

async function addAtmosphere(viewer: MolenClient): Promise<void> {
  applyEnvironment(viewer.renderer, {
    ambient: { sky: '#d7eaf2', ground: '#283b32', intensity: 0.48 },
    sun: { direction: [-6, 10, 4], color: '#fff0ce', intensity: 2.05 },
    background: '#8fbed3',
    toneMapping: 'agx',
    exposure: 0.9,
  });
  viewer.renderer.scene.fog = createExplorerFog(viewer.renderer.backend);
  const sky = await createExplorerSky(viewer.renderer.backend);
  viewer.renderer.scene.add(sky);
}

function createWaterSurface(size: number, seaLevel: number, material: THREE.Material): THREE.Mesh {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  water.name = 'earth-water';
  water.rotation.x = -Math.PI / 2;
  water.position.y = seaLevel;
  water.renderOrder = 2;
  return water;
}

async function main(): Promise<void> {
  const graphics = new GraphicsTelemetry();
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const sourceLabel = document.getElementById('source') as HTMLParagraphElement;
  const locationLabel = document.getElementById('location') as HTMLElement;
  const attributionList = document.getElementById('attribution-list') as HTMLUListElement;
  const qualitySelect = document.getElementById('quality') as HTMLSelectElement;
  const status = document.getElementById('status') as HTMLPreElement;
  const performanceStatus = document.getElementById('performance-status') as HTMLPreElement;
  const navigationStatus = document.getElementById('navigation-status') as HTMLParagraphElement;
  const help = document.getElementById('help') as HTMLDivElement;
  // Milliseconds since navigation, exposed alongside the existing graphics diagnostics.
  const startupTimings: Record<string, number> = {};
  const startupStage = (name: string): void => {
    startupTimings[name] = performance.now();
    performanceStatus.dataset.startup = JSON.stringify(startupTimings);
  };
  startupStage('module-ready');
  const styleId = new URLSearchParams(location.search).has('nostyles')
    ? 'none'
    : (new URLSearchParams(location.search).get('style') ?? 'default');
  // Content packs download while the terrain manifest loads.
  const contentLoad = loadExplorerContent(new URL('./', location.href), { styleId }).then(
    (content) => {
      startupStage('content-packs');
      return content;
    },
  );
  const loaded = await loadPackage();
  startupStage('terrain-manifest');
  const start = selectedStart();
  const cameraAngles = selectedCameraAngles();
  const params = new URLSearchParams(location.search);
  let quality = selectedQuality();
  let automaticQuality =
    !params.has('level') && (!params.has('quality') || params.get('quality') === 'auto');
  let performanceLevel = automaticQuality ? 3 : manualQualityLevel(quality);
  const qualityController = new AdaptiveQualityController({ initialLevel: performanceLevel });
  const lodPolicy: ScreenSpaceLodPolicy = {
    viewportHeight: window.innerHeight,
    maxPixelError: automaticQuality
      ? explorerPerformanceTier(performanceLevel).objectPixelError
      : 2,
  };
  const content = await contentLoad;
  const surfaceRenderer = createSurfaceControls(quality, content.parkedVehicles);
  const pyramidBudget = automaticQuality
    ? explorerPerformanceTier(performanceLevel).terrain
    : terrainPyramidBudgetForQuality(quality);
  const fixedBudget = terrainStreamBudgetForQuality(quality);
  // Adaptive coverage is the normal perspective path at every altitude. ?level=N intentionally
  // pins the old fixed-grid path for diagnostics and orthographic experiments.
  const adaptive = !params.has('level');
  const level = adaptive ? undefined : selectedLevel(loaded.descriptor);
  // Initialize the backend before constructing shader materials and opening semantic layers.
  const finestTileSize = terrainDescriptorFromPackage(
    loaded.descriptor,
    level ?? loaded.descriptor.tileMatrix.maxLevel,
  ).chunkSize;
  let deviceLost = false;
  const viewer = await createViewer({
    admission: {
      onSample: (sample) => {
        graphics.record(sample.label, sample.workMs);
        graphics.record('admission-wait', sample.queueMs);
        if (sample.overBudget) graphics.count('admission-overruns');
      },
    },
    backend: selectedRendererBackend(params),
    optimizeWebGpu: params.get('gpuOptimizations') !== '0',
    // Keep silhouette and surface-marking edges smooth when adaptive quality renders below the
    // display resolution. Three uses 4x MSAA on WebGPU and requests context MSAA on WebGL.
    antialias: selectedAntialias(params),
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    clearColor: '#9fc4df',
    cameraNear: 1,
    cameraFar: 500_000,
    reverseDepthBuffer: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    onDeviceLost: (reason) => {
      deviceLost = true;
      status.id = 'error';
      status.textContent = `Graphics device lost: ${reason}. Reload with ?backend=webgl to continue.`;
    },
    autoWorldOrigin: {
      threshold: finestTileSize / 2,
      gridSize: finestTileSize / 4,
    },
  });
  startupStage('renderer');
  const waterMaterial = await createTerrainWaterMaterialAsync(
    {
      color: '#286d83',
      waveScale: 0.028,
      waveStrength: 0.045,
      waveSpeed: 0.5,
    },
    viewer.renderer.backend,
  );
  startupStage('water-material');
  performanceStatus.dataset.backend = viewer.renderer.backend;
  performanceStatus.dataset.fallbackReason = viewer.renderer.fallbackReason ?? '';
  const semanticDemo = loaded.synthetic;
  // The package adapters pre-multiply the projected frame by cos(center latitude) so world XZ
  // is metric; camera positions, the status readout, and the region atlas use the same factor.
  const space = loaded.descriptor.coordinateSpace;
  const metersPerUnit =
    space.kind === 'geospatial'
      ? webMercatorScaleAtLatitude((space.bounds[1] + space.bounds[3]) / 2)
      : 1;
  const useWorker = params.get('worker') !== '0';
  let worldgen: ExplorerWorldgen | undefined;
  let styleUnavailableReason: string | undefined = content.worldgenError;
  if (adaptive && content.worldgen !== undefined) {
    try {
      worldgen = await loadWorldgen({
        telemetry: graphics,
        startupStage,
        ...(params.get('warmup') !== '0'
          ? {
              prepareObject: (object: THREE.Object3D, signal: AbortSignal) =>
                viewer.renderer.prepareObject(object, signal),
            }
          : {}),
        content: content.worldgen,
        assets: content.assets,
        metersPerUnit,
        quality,
        worker: useWorker,
        lodPolicy,
        surfaceRenderer,
      });
    } catch (error) {
      styleUnavailableReason = `Style pack "${styleId}" unavailable: ${(error as Error).message}`;
      console.warn(styleUnavailableReason);
    }
  }
  startupStage('worldgen');
  const declaredSemantics = [loaded.descriptor.landcover, loaded.descriptor.features].filter(
    (section) => section !== undefined,
  );
  let realSemanticLayers: TerrainPyramidTileLayer[] = [];
  let semanticUnavailableReason: string | undefined;
  if (adaptive && !semanticDemo && declaredSemantics.length > 0) {
    try {
      const opened = await createProfiledTerrainPackageSemanticLayers(loaded.descriptor, {
        ...(loaded.baseUrl !== undefined ? { baseUrl: loaded.baseUrl } : {}),
        waterLayer: {
          visible: true,
          mesh: {
            materials: { water: waterMaterial },
            waterOffset: 0.65,
          },
        },
        ...(worldgen !== undefined
          ? {
              landcoverLayer: { renderer: worldgen.classification },
              featuresLayer: { renderer: worldgen.humanFeatures },
            }
          : { featuresLayer: { mesh: { surfaceRenderer } } }),
      });
      realSemanticLayers = opened.layers;
    } catch (error) {
      semanticUnavailableReason = `Semantic sidecars unavailable: ${(error as Error).message}`;
      console.warn(semanticUnavailableReason);
    }
  } else if (!semanticDemo && declaredSemantics.length > 0 && !adaptive) {
    semanticUnavailableReason = 'Semantic sidecars require adaptive mode; remove ?level';
  }
  startupStage('semantic-layers');
  const adaptiveLayers = semanticDemo
    ? createSyntheticAdaptiveLayers({
        lineup: params.has('lineup'),
        stores: params.has('stores') ? content.worldgen?.places : undefined,
        houses: params.has('houses'),
        parking: params.has('parking'),
        renderers: worldgen,
        surfaceRenderer,
      })
    : realSemanticLayers;
  const hasClassification =
    semanticDemo || adaptiveLayers.some((layer) => layer.category === 'classification');
  const hasHydrology = adaptiveLayers.some((layer) => layer.category === 'hydrology');
  const hasHumanFeatures =
    semanticDemo || adaptiveLayers.some((layer) => layer.category === 'human-feature');
  if (!adaptive || !hasHumanFeatures) {
    (document.getElementById('surface-controls') as HTMLFieldSetElement).disabled = true;
    (document.getElementById('surface-status') as HTMLElement).textContent =
      'Surface styles require adaptive Human layers.';
  }
  sourceLabel.textContent = `${loaded.label}${adaptive ? ' · adaptive LOD' : ''}${realSemanticLayers.length > 0 ? ' · semantic sidecars' : ''}${worldgen !== undefined ? ` · worldgen ${styleId}${useWorker ? ' (worker)' : ''}` : ''}`;
  sourceLabel.dataset.kind = loaded.synthetic ? 'synthetic' : 'package';
  sourceLabel.dataset.worldgen = worldgen !== undefined ? styleId : 'none';
  if (styleUnavailableReason !== undefined) sourceLabel.title = styleUnavailableReason;
  if (params.get('hud') === '0') {
    // Hide every DOM overlay, not just the panel: the camera readout and the key legend are text,
    // and text metrics differ between platforms, so leaving them in a golden frame makes the image
    // a font test as well as a render test. Opacity (not display) keeps `#status` and `#source`
    // readable for scenario probes.
    //
    // `#credit` is deliberately absent from this list. ODbL and the OSM Foundation attribution
    // guidelines require the map credit to be visible without a user interaction, and `hud=0` is
    // exactly the embed/capture path where a hidden credit would be a licence breach. It stays out
    // of the committed goldens because those all run `?synthetic=1`, and the branch below only
    // shows the credit for real packages.
    for (const id of ['hud', 'location', 'help']) {
      // Null-safe: losing an overlay to a refactor should not take the whole page down with it.
      const overlay = document.getElementById(id);
      if (overlay !== null) overlay.style.opacity = '0';
    }
  }
  qualitySelect.value = automaticQuality ? 'auto' : quality;
  for (const attribution of loaded.descriptor.attribution) {
    const item = document.createElement('li');
    item.textContent = `${attribution.text} · ${attribution.license}`;
    attributionList.append(item);
  }
  // Always-visible corner credit. The synthetic fixture carries only 'Procedural demonstration
  // data', which nobody has to be credited for, so it keeps the frame clean. Each entry's `text`
  // is written source-first ("© OpenStreetMap contributors; Protomaps Basemap"), so the head up to
  // the first ';' is the party to credit; the full strings stay in the HUD's attribution list.
  const credit = document.getElementById('credit') as HTMLParagraphElement;
  if (!loaded.synthetic && loaded.descriptor.attribution.length > 0) {
    const isOsm = (text: string): boolean => text.includes('OpenStreetMap');
    const entries = [...loaded.descriptor.attribution].sort(
      (left, right) => Number(isOsm(right.text)) - Number(isOsm(left.text)),
    );
    credit.replaceChildren();
    for (const [index, entry] of entries.entries()) {
      if (index > 0) credit.append(' · ');
      const head = (entry.text.split(';')[0] ?? entry.text).trim();
      if (!isOsm(entry.text)) {
        credit.append(head);
        continue;
      }
      // The OSMF guidelines ask that the credit link to the licence explainer where it can.
      const link = document.createElement('a');
      link.href = entry.sourceUrl ?? 'https://www.openstreetmap.org/copyright';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = head;
      credit.append(link);
    }
    credit.hidden = false;
  }

  const [projectedStartX, projectedStartZ] = wgs84ToWebMercator(start.longitude, start.latitude);
  const startX = projectedStartX * metersPerUnit;
  const startZ = projectedStartZ * metersPerUnit;
  const camera = {
    pos: [startX, cameraAngles.altitude, startZ] as [number, number, number],
    yaw: cameraAngles.yaw,
    pitch: cameraAngles.pitch,
  };
  const initialDirection = cameraForward(camera.yaw, camera.pitch);
  let parentFallbacks = 0;
  // The HUD rewrites #status every 250ms, so an error written straight into it flashes and is
  // gone. Keep the last message and let the readout below render it with the stream's own
  // missing/retrying/gave-up counts.
  let lastTileError: string | undefined;
  let lastLayerError: string | undefined;
  const fixedEarth: TerrainPackageStream | undefined =
    level === undefined
      ? undefined
      : await createTerrainPackageStream(loaded.descriptor, {
          level,
          ...(loaded.baseUrl !== undefined ? { baseUrl: loaded.baseUrl } : {}),
          ...(loaded.archive !== undefined ? { archive: loaded.archive } : {}),
          cameraPos: camera.pos,
          layers: semanticDemo ? [forestLayer, humanFeatureLayer] : [],
          ...fixedBudget,
          parentFallback: true,
          onParentFallback: () => {
            parentFallbacks++;
          },
          onError: (error) => {
            lastTileError = (error as Error).message;
          },
        });
  const pyramidEarth: TerrainPackagePyramidStream | undefined = adaptive
    ? await createTerrainPackagePyramidStream(loaded.descriptor, {
        ...(loaded.baseUrl !== undefined ? { baseUrl: loaded.baseUrl } : {}),
        ...(loaded.archive !== undefined ? { archive: loaded.archive } : {}),
        ...pyramidBudget,
        ...(useWorker && params.get('elevationWorker') !== '0'
          ? {
              elevationWorker: new Worker(new URL('./elevation-worker.ts', import.meta.url), {
                type: 'module',
              }),
            }
          : {}),
        onElevationTiming: (sample) =>
          graphics.record(`elevation-${sample.stage}`, sample.milliseconds),
        ...(params.get('admission') !== '0' ? { admission: viewer.renderer.admission } : {}),
        ...(params.get('warmup') !== '0'
          ? {
              prepareObject: (object: THREE.Object3D, signal: AbortSignal) =>
                viewer.renderer.prepareObject(object, signal),
            }
          : {}),
        createTileGroup: () => viewer.renderer.createRenderGroup(),
        morphMilliseconds: params.has('freeze') ? 0 : 180,
        layers: adaptiveLayers,
        onParentFallback: () => {
          parentFallbacks++;
        },
        initialView: {
          position: camera.pos,
          verticalFov: THREE.MathUtils.degToRad(60),
          viewportHeight: window.innerHeight,
          direction: initialDirection,
          aspect: window.innerWidth / window.innerHeight,
        },
        onError: (error, context) => {
          if (context.layerId !== undefined) lastLayerError = (error as Error).message;
          else lastTileError = (error as Error).message;
        },
      })
    : undefined;
  startupStage('terrain-stream');
  const maybeStream = fixedEarth?.stream ?? pyramidEarth?.stream;
  if (maybeStream === undefined) throw new Error('terrain stream was not created');
  const stream = maybeStream;
  let fogViewDistance = adaptive
    ? pyramidBudget.viewDistance
    : fixedBudget.loadRadius * finestTileSize;
  if (params.get('sky') === 'daylight') await addAtmosphere(viewer);
  // The star catalog comes from the sky pack; until it arrives the bundled stars show.
  void content.stars().then(
    (stars) => viewer.renderer.setStarCatalog(stars),
    (error) => console.warn(`[molen] star catalog unavailable: ${(error as Error).message}`),
  );
  const skyControls = createSkyControls(viewer.renderer, params);
  startupStage('environment-controls');
  viewer.renderer.worldRoot.add(stream.object);
  const gpuTimer = viewer.renderer.createGpuTimer();
  const resizeRenderer = (): void => {
    const ratio = automaticQuality
      ? explorerPixelRatio(
          performanceLevel,
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
        )
      : 1;
    viewer.renderer.setPixelRatio(ratio);
    viewer.renderer.setSize(window.innerWidth, window.innerHeight);
    lodPolicy.viewportHeight = canvas.height;
  };
  const applyPerformanceLevel = (): void => {
    const tier = explorerPerformanceTier(performanceLevel);
    if (automaticQuality) quality = tier.quality;
    lodPolicy.maxPixelError = automaticQuality ? tier.objectPixelError : 2;
    const budget = automaticQuality ? tier.terrain : terrainPyramidBudgetForQuality(quality);
    // Explicit undefined clears the automatic byte cap when the user takes manual control.
    pyramidEarth?.stream.setBudget({ ...budget, maxResidentBytes: budget.maxResidentBytes });
    worldgen?.setQuality(quality);
    worldgen?.setCacheBudget(automaticQuality ? tier.cacheBytes : 192 * 1024 * 1024);
    void surfaceRenderer
      .setPerformanceScale(automaticQuality ? tier.surfaceScale : 1, quality)
      .catch((error: unknown) => console.warn('Surface detail update failed:', error));
    fogViewDistance = budget.viewDistance;
    resizeRenderer();
    performanceStatus.dataset.mode = automaticQuality ? 'auto' : 'manual';
    performanceStatus.dataset.level = String(performanceLevel);
    performanceStatus.dataset.maxPixels = automaticQuality ? String(tier.maxPixels) : '';
  };
  qualitySelect.addEventListener('change', () => {
    const next = new URL(location.href);
    next.searchParams.set('quality', qualitySelect.value);
    if (!adaptive) {
      location.assign(next);
      return;
    }
    automaticQuality = qualitySelect.value === 'auto';
    if (!automaticQuality) quality = qualitySelect.value as TerrainQualityPreset;
    performanceLevel = automaticQuality
      ? Math.min(performanceLevel, 3)
      : manualQualityLevel(quality);
    qualityController.setLevel(performanceLevel);
    applyPerformanceLevel();
    history.replaceState(null, '', next);
  });
  if (adaptive) applyPerformanceLevel();
  else {
    qualitySelect.querySelector<HTMLOptionElement>('option[value="auto"]')?.remove();
    resizeRenderer();
  }
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      gpuTimer?.dispose();
      worldgen?.dispose();
    }
  });
  const seaLevel =
    loaded.descriptor.surface?.seaLevel ??
    (loaded.descriptor.elevation.height.min < 0 && loaded.descriptor.elevation.height.max > 0
      ? 0
      : loaded.descriptor.elevation.height.min);
  // Real packages use mapped hydrology. An unbounded plane turns missing terrain and low
  // inland ground into an invented ocean, whose apparent shoreline changes with terrain LOD.
  const water = semanticDemo
    ? createWaterSurface(
        Math.max(finestTileSize * 24, pyramidBudget.viewDistance * 3),
        seaLevel,
        waterMaterial,
      )
    : undefined;
  if (water !== undefined) {
    water.position.x = startX;
    water.position.z = startZ;
    viewer.renderer.worldRoot.add(water);
  }

  const setMode = (mode: 'bare' | 'classification' | 'human'): void => {
    if (mode === 'classification' && !hasClassification) return;
    if (mode === 'human' && !hasHumanFeatures) return;
    if (hasHydrology) stream.setLayerVisible('water-features', true);
    if (hasClassification) stream.setLayerVisible('land-classification', mode !== 'bare');
    if (hasHumanFeatures) stream.setLayerVisible('human-features', mode === 'human');
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    const unavailable =
      (button.dataset.mode === 'classification' && !hasClassification) ||
      (button.dataset.mode === 'human' && !hasHumanFeatures);
    if (unavailable) {
      button.disabled = true;
      button.title =
        semanticUnavailableReason ?? 'This package does not declare this semantic layer';
    }
    button.addEventListener('click', () => {
      setMode(button.dataset.mode as 'bare' | 'classification' | 'human');
      canvas.focus();
    });
  }

  const keys = new Set<string>();
  let jumpRequested = false;
  const walker = new WalkController();
  const walkCollision = new WalkCollision();
  let navigation: 'fly' | 'walk' = 'fly';
  let aircraft: WorldAircraft | undefined;
  const sampleHeight = (x: number, z: number): number | undefined =>
    aircraft?.groundHeight(x, z) ?? stream.sampleHeight(x, z);
  // Cars and aircraft: definitions from the entities pack's types, models read from the same pack
  // the first time each is shown.
  const loadEntityModel = async (id: string): Promise<THREE.Object3D> =>
    (await new GLTFLoader().parseAsync(await content.packs.readBytes(id), '')).scene;
  const vehicles = new WorldVehicles(stream.object, sampleHeight, loadEntityModel, content.types);
  const weatherControls = createWeatherControls(viewer.renderer, params, vehicles.world);
  aircraft = new WorldAircraft(
    vehicles.world,
    stream.object,
    (x, z) => stream.sampleHeight(x, z),
    camera.pos,
    loadEntityModel,
    content.types,
  );
  const flight = aircraft;
  let visitingAircraft: AircraftKind | undefined;
  const walkHelp =
    'WASD walk · Shift run · Space jump · E board vehicle · click to look · Esc release mouse';
  const exitVehicle = (): boolean => {
    const feet = vehicles.exit();
    if (!feet) {
      if (flight.mountedKind) flight.exitHint();
      return false;
    }
    flight.message = '';
    walker.feet.fromArray(feet);
    walker.velocity.set(0, 0, 0);
    walker.ready = true;
    walker.grounded = true;
    walker.waitingForTerrain = false;
    camera.pos = [feet[0], feet[1] + WALK_EYE_HEIGHT, feet[2]];
    camera.pitch = 0;
    keys.clear();
    help.textContent = walkHelp;
    return true;
  };
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      flight.dispose();
      vehicles.dispose();
    }
  });
  const setNavigation = (mode: 'fly' | 'walk'): void => {
    if (vehicles.mountedId && !exitVehicle()) return;
    if (navigation === mode) {
      canvas.focus();
      return;
    }
    navigation = mode;
    keys.clear();
    jumpRequested = false;
    if (mode === 'walk') {
      walker.reset(camera.pos[0], camera.pos[2]);
      camera.pitch = 0;
      if (hasHumanFeatures) setMode('human');
    } else {
      walkCollision.clear();
      camera.pos[1] = Math.max(
        camera.pos[1],
        (sampleHeight(camera.pos[0], camera.pos[2]) ?? camera.pos[1]) + 35,
      );
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }
    viewer.renderer.setCameraClip(mode === 'walk' ? 0.05 : 1, 500_000);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-navigation]')) {
      button.setAttribute('aria-pressed', String(button.dataset.navigation === mode));
    }
    help.textContent =
      mode === 'walk'
        ? walkHelp
        : 'WASD travel · Q/E altitude · drag look · Shift boost · R reset origin';
    document.body.dataset.navigation = mode;
    canvas.focus();
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-navigation]')) {
    button.addEventListener('click', () =>
      setNavigation(button.dataset.navigation as 'fly' | 'walk'),
    );
  }
  const visitAircraft = (kind: AircraftKind): void => {
    if (vehicles.mountedId && !exitVehicle()) return;
    visitingAircraft = kind;
    setNavigation('fly');
    camera.pos = [flight.center[0], camera.pos[1], flight.center[1] - 330];
    help.textContent = 'Loading practice airfield…';
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-aircraft]')) {
    button.addEventListener('click', () => visitAircraft(button.dataset.aircraft as AircraftKind));
  }
  window.addEventListener('keydown', (event) => {
    if (
      event.target instanceof HTMLElement &&
      (event.target.matches('input, select, textarea, button') || event.target.isContentEditable)
    )
      return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyQ',
        'KeyE',
        'Space',
        'ShiftLeft',
        'ShiftRight',
        'KeyR',
        'KeyV',
        'KeyI',
        'KeyG',
        'KeyF',
        'KeyZ',
        'ControlLeft',
        'ControlRight',
      ].includes(event.code)
    ) {
      event.preventDefault();
      keys.add(event.code);
      if (!event.repeat) flight.key(event.code);
      if (event.code === 'Space' && !event.repeat) jumpRequested = true;
      if (event.code === 'KeyE' && !event.repeat && navigation === 'walk' && walker.ready) {
        if (vehicles.mountedId) exitVehicle();
        else if (flight.enter(camera.pos) || vehicles.enter(camera.pos)) {
          keys.clear();
          vehicles.view = 'cockpit';
          vehicles.lookYaw = 0;
          vehicles.lookPitch = -0.18;
          help.textContent = flight.mountedKind
            ? AIRCRAFT_HELP
            : 'W/S accelerate / brake / reverse · A/D steer · Space brake · E exit · V change view · drag to look';
        }
      }
      if (event.code === 'KeyV' && !event.repeat && vehicles.mountedId) {
        vehicles.view = vehicles.view === 'cockpit' ? 'chase' : 'cockpit';
      }
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  let dragPointer: { id: number; x: number; y: number } | undefined;
  const clearInput = (): void => {
    keys.clear();
    jumpRequested = false;
    dragPointer = undefined;
  };
  window.addEventListener('blur', clearInput);
  document.getElementById('sky-controls')?.addEventListener('focusin', clearInput);
  document.getElementById('weather-controls')?.addEventListener('focusin', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  document.addEventListener('pointerlockchange', clearInput);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    canvas.focus();
    if (navigation === 'walk' && document.pointerLockElement !== canvas) {
      // Drag-look remains available when the host does not grant pointer lock.
      void canvas.requestPointerLock?.()?.catch(() => {});
    }
    dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && dragPointer?.id !== event.pointerId) return;
    const dx = locked ? event.movementX : event.clientX - (dragPointer?.x ?? event.clientX);
    const dy = locked ? event.movementY : event.clientY - (dragPointer?.y ?? event.clientY);
    if (dragPointer !== undefined) {
      dragPointer.x = event.clientX;
      dragPointer.y = event.clientY;
    }
    if (vehicles.mountedId) {
      vehicles.lookYaw = Math.max(-1.45, Math.min(1.45, vehicles.lookYaw + dx * 0.003));
      vehicles.lookPitch = Math.max(-0.8, Math.min(0.8, vehicles.lookPitch - dy * 0.003));
      return;
    }
    const orientation = applyCameraLookDelta(camera.yaw, camera.pitch, dx, dy);
    camera.yaw = orientation.yaw;
    camera.pitch = orientation.pitch;
  });
  const finishDrag = (event: PointerEvent): void => {
    if (dragPointer?.id !== event.pointerId) return;
    dragPointer = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', resizeRenderer);

  if (params.get('navigation') === 'walk') setNavigation('walk');
  if (params.get('aircraft') === 'p51d' || params.get('aircraft') === 'oh6')
    visitAircraft(params.get('aircraft') as AircraftKind);
  let lastTime = performance.now();
  let statusTime = 0;
  let streamTime = -Infinity;
  let streamedPosition: [number, number, number] = [...camera.pos];
  let streamedDirection: [number, number, number] = [...initialDirection];
  const immediateStreamMove = Math.max(8, finestTileSize / 8);
  const immediateStreamTurn = THREE.MathUtils.degToRad(2);
  let frameTotal = 0;
  let frameCount = 0;
  let frameMax = 0;
  let previousCpuMs = 0;
  let lastGpuMs: number | undefined;
  let lastGpuTime = -Infinity;
  let surfaceGeometryRevision = -1;
  let streamingBusy = true;
  canvas.addEventListener('webglcontextlost', () => {
    lastGpuMs = undefined;
  });
  document.addEventListener('visibilitychange', () => {
    qualityController.sample(0, { active: false });
    lastGpuMs = undefined;
    previousCpuMs = 0;
    frameTotal = 0;
    frameCount = 0;
    frameMax = 0;
    lastTime = performance.now();
  });
  function frame(now: number): void {
    const firstFrame = startupTimings['first-frame'] === undefined;
    if (firstFrame) startupStage('frame-start');
    pyramidEarth?.stream.updateTransitions(now);
    if (deviceLost) return;
    const cpuStarted = performance.now();
    const frameMs = now - lastTime;
    const completedGpuMs = gpuTimer?.poll();
    if (completedGpuMs !== undefined) {
      lastGpuMs = completedGpuMs;
      lastGpuTime = now;
    } else if (now - lastGpuTime > 2000) lastGpuMs = undefined;
    if (automaticQuality) {
      const pressure = pyramidEarth?.stream.pressure();
      const change = qualityController.sample(frameMs, {
        active: !document.hidden,
        loading: streamingBusy,
        cpuFrameMs: previousCpuMs,
        ...(completedGpuMs === undefined ? {} : { gpuFrameMs: completedGpuMs }),
        // Warm, hidden cache entries can be reclaimed; they must not prevent quality recovery.
        memoryPressure: pressure?.displayedByteRatio ?? 0,
      });
      if (change) {
        performanceLevel = change.level;
        applyPerformanceLevel();
      }
    }
    frameTotal += frameMs;
    frameCount++;
    frameMax = Math.max(frameMax, frameMs);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = (sprint ? 3_000 : 850) * dt;
    let viewDirection = cameraForward(camera.yaw, camera.pitch);
    const forward = cameraPlanarForward(camera.yaw);
    const right = cameraRight(camera.yaw);
    const move = (direction: [number, number, number], amount: number): void => {
      camera.pos[0] += direction[0] * amount;
      camera.pos[1] += direction[1] * amount;
      camera.pos[2] += direction[2] * amount;
    };
    worldgen?.updateInteriors(camera.pos);
    flight.sync();
    if (visitingAircraft && flight.ready) {
      const position = flight.visitPosition(visitingAircraft);
      setNavigation('walk');
      camera.pos = position;
      camera.yaw = visitingAircraft === 'p51d' ? Math.atan2(1.1, -1.8) : Math.atan2(-0.8, 1.7);
      camera.pitch = 0;
      walker.feet.set(position[0], position[1] - WALK_EYE_HEIGHT, position[2]);
      walker.velocity.set(0, 0, 0);
      walker.ready = true;
      walker.grounded = true;
      visitingAircraft = undefined;
    }
    vehicles.sync(now, camera.pos);
    flight.input(dt, keys, !document.hidden && document.hasFocus());
    vehicles.update(dt, {
      throttle: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
      steering: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
      brake: keys.has('Space') || document.hidden || !document.hasFocus(),
    });
    flight.render();
    const flightCamera = flight.cameraPose(vehicles.view, vehicles.lookYaw, vehicles.lookPitch);
    const vehicleCamera = flightCamera ?? vehicles.cameraPose();
    if (vehicleCamera) {
      camera.pos = vehicleCamera.position;
      camera.yaw = vehicleCamera.yaw;
      camera.pitch = vehicleCamera.pitch;
      const direction = new THREE.Vector3()
        .fromArray(vehicleCamera.lookAt)
        .sub(new THREE.Vector3().fromArray(camera.pos))
        .normalize();
      viewDirection = direction.toArray();
      jumpRequested = false;
    } else if (navigation === 'walk') {
      walkCollision.update(stream.object, camera.pos[0], camera.pos[2]);
      if (!walker.ready) {
        const ground = sampleHeight(camera.pos[0], camera.pos[2]);
        if (ground !== undefined) camera.pos[1] = ground + WALK_EYE_HEIGHT;
        // Request ground-level detail before choosing a landing spot among the buildings.
        const loading = stream.stats();
        if (loading.loading === 0 && loading.loadingLayers === 0) {
          walker.place(walkCollision, sampleHeight);
        }
      }
      walker.update(
        dt,
        {
          forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
          right: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
          yaw: camera.yaw,
          sprint,
          jump: keys.has('Space') || jumpRequested,
        },
        walkCollision,
        sampleHeight,
      );
      jumpRequested = false;
      if (walker.ready) {
        camera.pos[0] = walker.feet.x;
        camera.pos[1] = walker.feet.y + WALK_EYE_HEIGHT;
        camera.pos[2] = walker.feet.z;
      }
    } else {
      if (keys.has('KeyW')) move(forward, speed);
      if (keys.has('KeyS')) move(forward, -speed);
      if (keys.has('KeyA')) move(right, -speed);
      if (keys.has('KeyD')) move(right, speed);
      if (keys.has('KeyE')) move([0, 1, 0], speed);
      if (keys.has('KeyQ')) move([0, 1, 0], -speed);
      const ground = sampleHeight(camera.pos[0], camera.pos[2]);
      if (ground !== undefined && camera.pos[1] < ground + 35) camera.pos[1] = ground + 35;
    }
    // Keep the inexpensive 10 Hz cadence while the view barely changes, but refresh before this
    // frame renders if a drag or movement could outrun the selector's view guard band. Otherwise
    // the camera can briefly face resident-but-hidden terrain and expose a horizon-sized hole.
    const terrainViewChanged =
      adaptive &&
      terrainViewNeedsImmediateUpdate(
        streamedPosition,
        streamedDirection,
        camera.pos,
        viewDirection,
        immediateStreamMove,
        immediateStreamTurn,
      );
    if (now - streamTime >= 100 || terrainViewChanged) {
      streamTime = now;
      if (fixedEarth !== undefined) fixedEarth.stream.update(camera.pos);
      else {
        pyramidEarth?.stream.update({
          position: camera.pos,
          verticalFov: THREE.MathUtils.degToRad(60),
          viewportHeight: canvas.height,
          direction: viewDirection,
          aspect: window.innerWidth / window.innerHeight,
        });
      }
      streamedPosition = [...camera.pos];
      streamedDirection = [...viewDirection];
    }

    if (keys.delete('KeyR')) {
      viewer.renderer.setWorldOrigin([camera.pos[0], 0, camera.pos[2]]);
    }
    if (
      water !== undefined &&
      Math.hypot(camera.pos[0] - water.position.x, camera.pos[2] - water.position.z) >
        finestTileSize * 4
    ) {
      water.position.x = camera.pos[0];
      water.position.z = camera.pos[2];
    }
    viewer.setCamera({
      position: camera.pos,
      ...(flightCamera
        ? { rotation: flightCamera.rotation }
        : {
            lookAt: [
              camera.pos[0] + viewDirection[0],
              camera.pos[1] + viewDirection[1],
              camera.pos[2] + viewDirection[2],
            ],
          }),
    });
    const waterOrigin = viewer.renderer.getWorldOrigin();
    setTerrainWaterTime(waterMaterial, params.has('freeze') ? 0 : now / 1000, [
      waterOrigin[0],
      waterOrigin[2],
    ]);
    const skyLocation = webMercatorToWgs84(
      camera.pos[0] / metersPerUnit,
      camera.pos[2] / metersPerUnit,
    );
    skyControls.update({
      latitude: skyLocation[1],
      longitude: skyLocation[0],
      elevation: camera.pos[1],
    });
    if (firstFrame) startupStage('sky');
    const fog = viewer.renderer.scene.fog;
    if (fog instanceof THREE.Fog) updateExplorerFog(fog, fogViewDistance, camera.pos[1]);
    gpuTimer?.begin();
    weatherControls.update(now / 1000);
    viewer.renderFrame();
    if (firstFrame) {
      startupStage('first-frame');
      // Let the first frame paint before starting CPU-heavy fallback bakes (?materialWorker=0).
      setTimeout(() => {
        void worldgen
          ?.prepareMaterials()
          .catch((error: unknown) => console.warn('Building materials unavailable:', error));
      }, 0);
    }
    gpuTimer?.end();

    // Match the rendered camera every frame, including movement and floating-origin resets.
    // This readout stays visible in Walk mode and when the diagnostic HUD is hidden.
    const locationText = formatCameraLocation(camera, {
      label: loaded.synthetic ? `Synthetic · ${loaded.descriptor.name}` : loaded.descriptor.name,
      metersPerUnit,
      geospatial: space.kind === 'geospatial',
    });
    if (locationLabel.textContent !== locationText) locationLabel.textContent = locationText;

    if (now - statusTime > 250) {
      statusTime = now;
      const stats: TerrainStreamStats | TerrainPyramidStreamStats = stream.stats();
      const rendered = viewer.renderer.stats();
      const surfaceStats = surfaceRenderer.stats();
      streamingBusy =
        stats.loading > 0 ||
        stats.loadingLayers > 0 ||
        (isPyramidStats(stats) && stats.retryingLayers > 0) ||
        surfaceStats.loading > 0;
      if (surfaceStats.loading === 0 && surfaceStats.geometryRevision !== surfaceGeometryRevision) {
        pyramidEarth?.stream.refreshMemoryUsage();
        surfaceGeometryRevision = surfaceStats.geometryRevision;
      }
      const nearVehicle =
        navigation === 'walk' && walker.ready ? vehicles.nearest(camera.pos) : undefined;
      const nearAircraft =
        navigation === 'walk' && walker.ready ? flight.nearest(camera.pos) : undefined;
      navigationStatus.textContent = flight.mountedKind
        ? flight.status()
        : nearAircraft
          ? `E · Board ${content.types.component<AircraftData>(aircraftEntityId(nearAircraft), 'aircraft').spec.label} · I starts the engine`
          : flight.message ||
            (vehicles.mountedId
              ? `${vehicles.label(vehicles.mountedId)} · ${Math.abs(vehicles.speed * 3.6).toFixed(0)} km/h · ${vehicles.speed < -0.1 ? 'Reverse' : 'Drive'} · ${vehicles.view} · ${vehicles.waiting ? 'Waiting for terrain…' : vehicles.message || 'E exit · V view'}`
              : vehicles.message ||
                (nearVehicle
                  ? `E · Enter ${vehicles.label(nearVehicle)}`
                  : navigation === 'walk'
                    ? !walker.ready
                      ? 'Finding open ground nearby… Switch to Fly to choose another spot.'
                      : walker.waitingForTerrain
                        ? 'Waiting for terrain…'
                        : `Walk mode · ${WALK_EYE_HEIGHT.toFixed(1)}m eye height · ${walker.grounded ? 'On ground' : 'In air'}`
                    : 'Fly mode · Explore from above'));
      navigationStatus.dataset.vehicle = vehicles.mountedId ?? '';
      navigationStatus.dataset.speed = (flight.state?.airspeed ?? vehicles.speed).toFixed(3);
      navigationStatus.dataset.aircraft = flight.mountedKind ?? '';
      navigationStatus.dataset.agl = (flight.state?.altitudeAGL ?? 0).toFixed(2);
      navigationStatus.dataset.crashed = String(flight.state?.crashed ?? false);
      navigationStatus.dataset.power = String(Math.round(flight.power * 100));
      navigationStatus.dataset.flightState = !flight.state
        ? ''
        : flight.state.crashed
          ? 'crashed'
          : !flight.state.grounded
            ? 'airborne'
            : flight.mountedKind === 'p51d' && flight.state.airspeed >= 42
              ? 'rotation'
              : 'grounded';
      navigationStatus.dataset.view = vehicles.view;
      navigationStatus.dataset.entities = String(vehicles.world.query({ name: 'vehicle' }).count());
      navigationStatus.dataset.state = flight.mountedKind
        ? 'piloting'
        : vehicles.mountedId
          ? 'driving'
          : navigation === 'fly'
            ? 'fly'
            : !walker.ready
              ? 'placing'
              : walker.waitingForTerrain
                ? 'waiting'
                : walker.grounded
                  ? 'grounded'
                  : 'airborne';
      navigationStatus.dataset.x = camera.pos[0].toFixed(3);
      navigationStatus.dataset.y = camera.pos[1].toFixed(3);
      navigationStatus.dataset.z = camera.pos[2].toFixed(3);
      const [longitude, latitude] = webMercatorToWgs84(
        camera.pos[0] / metersPerUnit,
        camera.pos[2] / metersPerUnit,
      );
      const origin = viewer.renderer.getWorldOrigin();
      const adaptiveStats = isPyramidStats(stats) ? stats : undefined;
      const levelSummary =
        adaptiveStats === undefined
          ? `level ${level} fixed · tile edge ${(finestTileSize / 1000).toFixed(1)}km`
          : `levels ${adaptiveStats.minDisplayedLevel ?? '–'}–${adaptiveStats.maxDisplayedLevel ?? '–'} adaptive · SSE ${adaptiveStats.effectiveScreenSpaceError.toFixed(1)}px`;
      const fallbackSummary =
        adaptiveStats === undefined
          ? `${parentFallbacks} parent fallbacks`
          : `${adaptiveStats.fallbackLeaves} selected leaves awaiting coverage · ${parentFallbacks} ancestor fallbacks`;
      const unavailableTiles = stats.failed - stats.missing;
      status.id = unavailableTiles > 0 ? 'error' : 'status';
      const worldgenStats = worldgen?.stats();
      const worldgenSummary =
        worldgenStats === undefined
          ? `worldgen off${styleUnavailableReason !== undefined ? ' (pack unavailable)' : ''}`
          : `worldgen ${worldgenStats.buildings} buildings · ${worldgenStats.boxes} boxes · ${worldgenStats.tiles} tiles · gen ${worldgenStats.generateMs.mean.toFixed(1)}ms avg / ${worldgenStats.generateMs.max.toFixed(0)}ms max · ${(worldgenStats.geometryBytes / 1_048_576).toFixed(1)}MiB`;
      status.textContent = [
        `lat ${latitude.toFixed(5)}  lon ${longitude.toFixed(5)}  altitude ${camera.pos[1].toFixed(0)}m`,
        `${levelSummary} · quality ${quality}`,
        `tiles ${stats.resident} resident · ${stats.loading} loading terrain · ${stats.loadingLayers} loading layers · ${stats.failed} failed`,
        ...(stats.missing + stats.retrying + unavailableTiles > 0
          ? [
              `tile state: ${stats.missing} missing · ${stats.retrying} retrying · ${unavailableTiles} gave up${
                lastTileError === undefined ? '' : ` · last error: ${lastTileError}`
              }`,
            ]
          : []),
        `${fallbackSummary} · ${stats.evictions} evicted · ${(stats.decodedSamples / 1_000_000).toFixed(2)}M samples`,
        `geometry ${(stats.geometryBytes / 1_048_576).toFixed(1)}MiB · ${(stats.triangles / 1_000).toFixed(0)}k triangles`,
        `${stats.drawCalls} draws · ${stats.instances} instances`,
        `layers ${stats.layerObjects} objects · ${adaptiveStats?.retryingLayers ?? 0} retrying · ${stats.failedLayers} failed · origin ${origin[0].toFixed(0)}, ${origin[2].toFixed(0)}m`,
        ...(stats.failedLayers > 0 && lastLayerError !== undefined
          ? [`layer error: ${lastLayerError}`]
          : []),
        worldgenSummary,
        ...(worldgenStats?.interiors
          ? [
              `interiors ${worldgenStats.interiors.resident} resident / ${worldgenStats.interiors.sites} available · ${worldgenStats.interiors.pending} generating · ${(worldgenStats.interiors.bytes / 1_048_576).toFixed(1)}MiB · ${worldgenStats.interiors.failed} failed`,
            ]
          : []),
        (() => {
          const s = surfaceStats;
          return `surfaces ${s.style} · ${s.parkingAreas} lots · ${s.parkingBays} bays · ${s.junctions} junctions · ${s.streetlights} lights · ${s.parkedCars} cars`;
        })(),
      ].join('\n');
      const control = qualityController.getStats();
      const pressure = pyramidEarth?.stream.pressure();
      performanceStatus.textContent = [
        `${viewer.renderer.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}${viewer.renderer.fallbackReason ? ` · fallback: ${viewer.renderer.fallbackReason}` : ''}`,
        automaticQuality
          ? `Auto · ${explorerPerformanceTier(performanceLevel).name} · target 60 FPS · ${control.reason === 'manual' ? 'measuring' : (control.reason ?? 'measuring')}`
          : `Manual · ${quality}`,
        `frame ${(frameTotal / frameCount).toFixed(1)}ms avg / ${frameMax.toFixed(0)}ms max · p90 ${control.p90FrameMs?.toFixed(1) ?? '–'}ms`,
        `CPU ${previousCpuMs.toFixed(1)}ms · GPU ${lastGpuMs?.toFixed(1) ?? 'unavailable'}ms · resolution ${canvas.width}×${canvas.height}`,
        `rendered ${rendered.drawCalls} draws / ${(rendered.triangles / 1_000).toFixed(0)}k triangles`,
        ...(pressure
          ? [
              `resident buffers ${(pressure.residentBytes / 1_048_576).toFixed(1)}MiB${automaticQuality ? ` / ${((pressure.maxResidentBytes ?? 0) / 1_048_576).toFixed(0)}MiB` : ''}`,
            ]
          : []),
      ].join('\n');
      frameTotal = 0;
      performanceStatus.dataset.graphics = JSON.stringify(graphics.snapshot());
      frameCount = 0;
      frameMax = 0;
    }
    previousCpuMs = performance.now() - cpuStarted;
    graphics.record(streamingBusy ? 'loading-frame-cpu' : 'steady-frame-cpu', previousCpuMs);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void main().catch((error: unknown) => {
  const source = document.getElementById('source') as HTMLParagraphElement;
  source.id = 'error';
  source.textContent = (error as Error).message;
});

import { GraphicsTelemetry } from './graphics-telemetry';

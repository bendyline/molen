import {
  type AssetProvider,
  applyEnvironment,
  createIndexedDbMaterialStore,
  createViewer,
  type MolenClient,
} from '@bendyline/molen-client';
import { bindAircraftCockpitPointer } from '@bendyline/molen-client/aircraft';
import {
  applyCameraLookDelta,
  cameraForward,
  cameraPlanarForward,
  cameraRight,
  createNavigationControls,
  NavigationInputSource,
  viewNeedsImmediateUpdate,
  WALK_EYE_HEIGHT,
  WALK_PLACEMENT_RADIUS,
  WalkCollision,
  WalkController,
} from '@bendyline/molen-client/navigation';
import {
  ambientContentFromTypes,
  createAirportTerrainGrading,
  createEarthAdmissionGovernor,
  createEarthFleet,
  createEarthFog,
  createEarthRoadSigns,
  createEarthSky,
  createEarthTilePreloader,
  createEarthWorldgen,
  createRegionalGroundColor,
  EARTH_SHADOW_CASTER_HEIGHT,
  EARTH_WATER_COLOR,
  EARTH_WATER_CONDITIONS,
  EarthAirportPopulation,
  EarthAmbient,
  type EarthAudio,
  EarthAudioTerrain,
  type EarthFleet,
  EarthNightLighting,
  type EarthRoadSigns,
  EarthVehicles,
  EarthWildlife,
  type EarthWorldgen,
  earthAdmission,
  earthMemoryBudget,
  earthNightFactor,
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
  earthShadowFocus,
  earthTerrainCacheBudget,
  observeSemanticTiles,
  regionalEarthAttribution,
  SemanticTileBuffer,
  updateEarthFog,
  withEarthAirports,
} from '@bendyline/molen-earth/client';
import { validateByKind } from '@bendyline/molen-schema';
import type { TerrainSurfaceRenderer } from '@bendyline/molen-terrain/client';
import {
  createDefaultTerrainSemanticRenderer,
  createProfiledTerrainPackageSemanticLayers,
  createTerrainGroundMaterialAsync,
  createTerrainPackagePyramidStream,
  createTerrainPackageStream,
  createTerrainPavementMaterialAsync,
  createTerrainSemanticPyramidLayer,
  createTerrainWaterMaterialAsync,
  sampleTerrainTunnel,
  setTerrainGroundOrigin,
  setTerrainWaterTime,
  type TerrainPackagePyramidStream,
  type TerrainPackageStream,
  type TerrainPyramidHeightSource,
  type TerrainPyramidStreamStats,
  type TerrainPyramidTileLayer,
  type TerrainPyramidView,
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
  type BuildingMaterialDecorator,
  createBuildingWeatheringAsync,
  createScatterMaterialAsync,
  type ScreenSpaceLodPolicy,
} from '@bendyline/molen-worldgen/client';
import type { WorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import type { PlacesContent } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { airportStart } from './airport-start.js';
import { startExplorerAudio } from './audio.js';
import { selectedAntialias, selectedRendererBackend } from './backend-options.js';
import { type ExplorerWorldgenContent, loadExplorerContent } from './content.js';
import { createExplorerDioramas, DIORAMA_SITES, selectedDiorama } from './dioramas.js';
import { createFlightInstrumentPanel } from './flight-instrument-panel.js';
import { formatCameraLocation } from './location-readout.js';
import { createExplorerQualityController } from './quality-policy.js';
import {
  createRegionControls,
  DEFAULT_WORLD_REGION,
  regionPackagePath,
  selectedRegion,
} from './regions.js';
import { createSkyControls } from './sky-controls.js';
import { createSurfaceControls } from './surface-controls.js';
import { syntheticFeatureTile, syntheticLandcoverTile } from './synthetic-footprints.js';
import { createWeatherControls } from './weather-controls.js';
import { AIRCRAFT_HELP, aircraftBlocks, WorldAircraft } from './world-aircraft.js';
import { PARACHUTE_HELP, WorldParachute } from './world-parachute.js';

const DEMO_LEVEL = 13;
const DEMO_MIN_LEVEL = 8;
const DEMO_RESOLUTION = 33;
type AircraftKind = string;

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

type ExplorerWorldgen = EarthWorldgen;

/** Worldgen renderers over the style pack, atlas and places content loaded from the packs. */
async function loadWorldgen(options: {
  telemetry: GraphicsTelemetry;
  startupStage: (name: string) => void;
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent?: THREE.Object3D,
  ) => Promise<void>;
  prepareMaterialChange?: (current: THREE.Material, next: THREE.Material) => Promise<void>;
  content: ExplorerWorldgenContent;
  /** Every pack's assets: entity models, style-pack props and material documents. */
  assets: AssetProvider;
  surfaceRenderer: TerrainSurfaceRenderer;
  metersPerUnit: number;
  quality: TerrainQualityPreset;
  /** Compact scene for renderers without the WebGPU path's draw optimizations (WebGL). */
  compact: boolean;
  lodPolicy: ScreenSpaceLodPolicy;
  /** Generate tiles in a Worker by default; `?worker=0` enables in-thread diagnostics. */
  worker: boolean;
  groundMaterial?: THREE.Material;
  modelMaterial?: THREE.Material;
  buildingDecorator?: BuildingMaterialDecorator;
}): Promise<ExplorerWorldgen> {
  const params = new URLSearchParams(location.search);
  // Baked building materials persist across visits; ?materialCache=0 bakes every time.
  const materialStore =
    params.get('materialCache') !== '0' ? createIndexedDbMaterialStore() : undefined;
  const worldgen = createEarthWorldgen({
    buildingInfill:
      params.get('buildingInfill') === '0'
        ? false
        : {
            seed: Number(params.get('infillSeed') ?? 0),
          },
    // Freeze the host calendar for this mount; ?month=1..12 makes seasonal previews repeatable.
    // ?month=0 selects neutral leaf-on appearance.
    ...(params.get('month') !== '0'
      ? {
          vegetationMonth: params.has('month')
            ? Number(params.get('month'))
            : new Date().getUTCMonth() + 1,
        }
      : {}),
    content: options.content,
    assets: options.assets,
    surfaceRenderer: options.surfaceRenderer,
    metersPerUnit: options.metersPerUnit,
    quality: options.quality,
    compact: options.compact,
    lodPolicy: options.lodPolicy,
    ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
    ...(options.prepareMaterialChange
      ? { prepareMaterialChange: options.prepareMaterialChange }
      : {}),
    // Shared texture work starts after the first camera frame; buildings gain textures as it finishes.
    // Vite bundles a worker only from the literal `new Worker(new URL(...))` pattern.
    workers: options.worker
      ? {
          worldgen: () =>
            new Worker(new URL('./worldgen-worker.ts', import.meta.url), { type: 'module' }),
          landcover: () =>
            new Worker(new URL('./landcover-worker.ts', import.meta.url), { type: 'module' }),
          ...(params.get('materialWorker') !== '0'
            ? {
                material: () =>
                  new Worker(new URL('./material-worker.ts', import.meta.url), {
                    type: 'module',
                  }),
              }
            : {}),
        }
      : {},
    ...(materialStore !== undefined ? { materialStore } : {}),
    ...(options.groundMaterial ? { groundMaterial: options.groundMaterial } : {}),
    ...(options.modelMaterial ? { modelMaterial: options.modelMaterial } : {}),
    ...(options.buildingDecorator ? { buildingDecorator: options.buildingDecorator } : {}),
    propLod: params.get('propLod') !== '0',
    interiors: params.get('interiors') !== '0',
    onMaterialBakeTiming: (ms) => options.telemetry.record('material-bake', ms),
    onTileStats: (output, elapsed) => {
      options.telemetry.record('worldgen-total', elapsed);
      if (output.generationMs !== undefined)
        options.telemetry.record('worldgen-generation', output.generationMs);
      if (output.preparationMs !== undefined)
        options.telemetry.record('worldgen-preparation', output.preparationMs);
    },
    onMaterialFailures: (failures) => {
      for (const [ref, reason] of failures)
        console.warn(`[molen] worldgen material ${ref}: ${reason}`);
    },
  });
  let preparation: Promise<void> | undefined;
  return {
    ...worldgen,
    // Record the initial warm-up. Later visible surfaces bake on demand.
    prepareMaterials(): Promise<void> {
      preparation ??= (async () => {
        const status = document.getElementById('worldgen-status');
        if (status) status.hidden = false;
        options.startupStage('material-baking-start');
        try {
          await worldgen.prepareMaterials();
          options.startupStage('material-baking');
        } finally {
          if (status) status.hidden = true;
        }
      })();
      return preparation;
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
  const manifestParam =
    params.get('package') ?? regionPackagePath(selectedRegion(params) ?? DEFAULT_WORLD_REGION);
  const manifestUrl =
    manifestParam === 'qualla' ? await quallaRelease() : new URL(manifestParam, location.href);
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

/**
 * qualla.com's current terrain release, through the examples dev server's `/qualla/` proxy
 * (examples/home/qualla-proxy.mjs): `current.json` names the release, relative to itself.
 */
async function quallaRelease(): Promise<URL> {
  const pointerUrl = new URL('/qualla/_data/terrain/current.json', location.href);
  const response = await fetch(pointerUrl);
  if (!response.ok)
    throw new Error(`Qualla terrain needs the examples dev server: HTTP ${response.status}`);
  const pointer = (await response.json()) as { package?: string };
  if (pointer.package === undefined) throw new Error('Qualla terrain pointer names no package');
  return new URL(pointer.package, pointerUrl);
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
  const start = selectedRegion(params) ?? {
    ...DEFAULT_WORLD_REGION,
    longitude: -122.0356,
    latitude: 47.6163,
  };
  const place = selectedDiorama(params.get('diorama'));
  const framing = Math.max(1, window.innerHeight / window.innerWidth);
  const longitude = Number(
    params.get('lon') ??
      (place
        ? place.longitude + (0.0012 * place.overviewDistance * framing) / 134
        : start.longitude),
  );
  const latitude = Number(
    params.get('lat') ??
      (place ? place.latitude - (0.0009 * place.overviewDistance * framing) / 134 : start.latitude),
  );
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('longitude must be finite and between -180 and 180');
  }
  if (!Number.isFinite(latitude) || latitude < -85.05112878 || latitude > 85.05112878) {
    throw new Error('latitude must fit the Web Mercator range');
  }
  return {
    longitude,
    latitude,
    label:
      params.has('lon') || params.has('lat') ? 'Custom coordinates' : (place?.title ?? start.label),
  };
}

function selectedCameraAngles(): { altitude: number; yaw: number; pitch: number } {
  const params = new URLSearchParams(location.search);
  const place = selectedDiorama(params.get('diorama'));
  const altitude = Number(params.get('alt') ?? (place ? 200 : 1_400));
  const yaw = Number(params.get('yaw') ?? (place ? -2.3 : -Math.PI / 2));
  const pitch = Number(params.get('pitch') ?? (place ? -0.55 : -0.35));
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
  viewer.renderer.scene.fog = createEarthFog(viewer.renderer.backend);
  const sky = await createEarthSky(viewer.renderer.backend);
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
  createRegionControls(document.getElementById('region') as HTMLSelectElement);
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
  // ?aerialOrtho=<meters> draws a north-up orthographic frame that many meters tall, centered
  // under the camera, for comparison with orthophotos (scripts/aerial-color). Streaming and LOD
  // still follow the ordinary pose, so pair it with ?pitch=-1.5 and an altitude near the height.
  const aerialOrtho = Number(params.get('aerialOrtho') ?? 0);
  if (!Number.isFinite(aerialOrtho) || aerialOrtho < 0)
    throw new Error('aerialOrtho must be a finite, non-negative frame height in meters');
  let quality = selectedQuality();
  let automaticQuality =
    !params.has('level') && (!params.has('quality') || params.get('quality') === 'auto');
  let performanceLevel = automaticQuality ? 3 : earthQualityLevel(quality);
  const qualityController = createExplorerQualityController(performanceLevel);
  const memoryBudget = earthMemoryBudget();
  // The tier's object error; the frame loop scales it with height above the ground.
  let objectPixelError = automaticQuality
    ? earthPerformanceTier(performanceLevel).objectPixelError
    : 2;
  const lodPolicy: ScreenSpaceLodPolicy = {
    viewportHeight: window.innerHeight,
    maxPixelError: objectPixelError,
  };
  const content = await contentLoad;
  const loadEntityModel = async (id: string, signal?: AbortSignal): Promise<THREE.Object3D> =>
    (
      await new GLTFLoader().parseAsync(
        await content.packs.readBytes(id, signal ? { signal } : undefined),
        '',
      )
    ).scene;
  const roadContent = ambientContentFromTypes(content.types, loadEntityModel);
  let fleet: EarthFleet | undefined;
  let roadSigns: EarthRoadSigns | undefined;
  const surfaceRenderer = createSurfaceControls(
    quality,
    content.parkedVehicles,
    (x, z) => fleet?.parkedAt(x, z) ?? content.parkedVehicles,
    content.fonts,
    (x, z) => roadSigns?.profileAt(x, z),
    content.roadSigns?.shields,
  );
  const pyramidBudget = earthTerrainCacheBudget(
    automaticQuality
      ? earthPerformanceTier(performanceLevel).terrain
      : terrainPyramidBudgetForQuality(quality),
    memoryBudget,
  );
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
    reflections: true,
    admission: {
      ...earthAdmission(selectedRendererBackend(params), false),
      onSample: (sample) => {
        graphics.record(sample.label, sample.workMs);
        graphics.record(
          sample.background ? 'admission-wait-background' : 'admission-wait',
          sample.queueMs,
        );
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
  // Ambient occlusion (WebGPU): creases, corners and the ground at building and tree bases darken
  // a little. `?ao=0` turns it off for comparison.
  const occlusionWanted = params.get('ao') !== '0';
  viewer.renderer.setAmbientOcclusion(occlusionWanted);
  let occlusionOn = occlusionWanted;
  const waterMaterial = await createTerrainWaterMaterialAsync(
    {
      color: selectedRegion(params)?.water ?? EARTH_WATER_COLOR,
      swells: EARTH_WATER_CONDITIONS.waves ?? [],
      waveScale: 0.028,
      waveStrength: 0.045,
      waveSpeed: 0.5,
    },
    viewer.renderer.backend,
  );
  startupStage('water-material');
  // One ground material for terrain and landcover, with world-space variation; `?ground=flat`
  // keeps the solid vertex colors for comparison.
  const groundMaterial =
    params.get('ground') === 'flat'
      ? undefined
      : await createTerrainGroundMaterialAsync({}, viewer.renderer.backend);
  const fieldMaterial = groundMaterial
    ? await createTerrainGroundMaterialAsync({ agriculture: true }, viewer.renderer.backend)
    : undefined;
  // Roads, sidewalks, markings and lots: asphalt wear, concrete slabs and worn paint from the
  // bands' own coordinates. `?ground=flat` keeps the plain vertex colors here too.
  const pavementMaterial = groundMaterial
    ? await createTerrainPavementMaterialAsync({}, viewer.renderer.backend)
    : undefined;
  surfaceRenderer.setMaterial(pavementMaterial);
  // Trees, shrubs and props: leaf speckle and crown occlusion (also off with `?ground=flat`).
  const scatterMaterial = groundMaterial
    ? await createScatterMaterialAsync(viewer.renderer.backend)
    : undefined;
  // Buildings: facade tone drift, rain streaks and weathered roofs (also off with `?ground=flat`).
  const buildingDecorator = groundMaterial
    ? await createBuildingWeatheringAsync(viewer.renderer.backend)
    : undefined;
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
  if (content.roadSigns && space.kind === 'geospatial')
    roadSigns = createEarthRoadSigns(content.roadSigns, metersPerUnit);
  if (content.fleet)
    fleet = createEarthFleet(
      content.fleet,
      roadContent.types.car ?? [],
      content.parkedVehicles,
      metersPerUnit,
    );
  let worldgen: ExplorerWorldgen | undefined;
  let styleUnavailableReason: string | undefined = content.worldgenError;
  if (adaptive && content.worldgen !== undefined) {
    try {
      worldgen = await loadWorldgen({
        telemetry: graphics,
        startupStage,
        ...(params.get('warmup') !== '0'
          ? {
              prepareObject: (
                object: THREE.Object3D,
                signal: AbortSignal,
                parent?: THREE.Object3D,
              ) => viewer.renderer.prepareObject(object, signal, parent),
              prepareMaterialChange: (current: THREE.Material, next: THREE.Material) =>
                viewer.renderer.prepareMaterialChange(current, next),
            }
          : {}),
        content: content.worldgen,
        assets: content.assets,
        metersPerUnit,
        quality,
        // WebGL pays full price for every building and plant draw, so it keeps a compact scene.
        compact: viewer.renderer.backend === 'webgl',
        worker: useWorker,
        ...(fieldMaterial ? { groundMaterial: fieldMaterial } : {}),
        ...(scatterMaterial ? { modelMaterial: scatterMaterial } : {}),
        ...(buildingDecorator ? { buildingDecorator } : {}),
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
  let provideTunnelHeights!: (source: TerrainPyramidHeightSource) => void;
  const tunnelHeightsReady = new Promise<TerrainPyramidHeightSource>((resolve) => {
    provideTunnelHeights = resolve;
  });
  let semanticUnavailableReason: string | undefined;
  // Ambient life (NPC traffic, walkers, trains, aircraft) reads road tiles as they are built.
  // ?ambient=0 turns it off; frozen captures (?freeze, every golden) leave it off unless
  // ?ambient=1, because moving traffic would make their frames time-dependent.
  const ambientWanted = params.has('ambient')
    ? params.get('ambient') !== '0'
    : !params.has('freeze');
  const ambientTiles = ambientWanted ? new SemanticTileBuffer() : undefined;
  const audioTerrain = new EarthAudioTerrain();
  let audioTerrainSample: ReturnType<EarthAudioTerrain['sample']> | undefined;
  let audioTerrainAt = -Infinity;
  const wildlifeWanted =
    ambientWanted &&
    params.get('wildlife') !== '0' &&
    (worldgen?.environment?.library.animals.size ?? 0) > 0;
  const wildlifeCover = wildlifeWanted ? new SemanticTileBuffer() : undefined;
  const wildlifeFeatures = wildlifeWanted ? new SemanticTileBuffer() : undefined;
  let wildlife: EarthWildlife | undefined;
  let ambient: EarthAmbient | undefined;
  const observeRoads = (
    renderer: WorldgenSemanticRenderers['humanFeatures'],
  ): WorldgenSemanticRenderers['humanFeatures'] => {
    const observed =
      wildlifeFeatures !== undefined ? observeSemanticTiles(renderer, wildlifeFeatures) : renderer;
    return withEarthAirports(
      observeSemanticTiles(
        ambientTiles !== undefined ? observeSemanticTiles(observed, ambientTiles) : observed,
        audioTerrain.observer,
      ),
      content.airports,
    );
  };
  if (adaptive && !semanticDemo && declaredSemantics.length > 0) {
    try {
      const opened = await createProfiledTerrainPackageSemanticLayers(loaded.descriptor, {
        admission: viewer.renderer.admission,
        // Map tiles decode in a worker: on the main thread a town tile took 10-18 ms of a frame.
        ...(useWorker && params.get('semanticWorker') !== '0'
          ? {
              decoderWorker: new Worker(new URL('./semantic-worker.ts', import.meta.url), {
                type: 'module',
              }),
            }
          : {}),
        distantCoverage: worldgen !== undefined,
        tunnels: {
          heights: {
            load: async (address, signal) => (await tunnelHeightsReady).load(address, signal),
          },
        },
        ...(loaded.baseUrl !== undefined ? { baseUrl: loaded.baseUrl } : {}),
        waterLayer: {
          visible: true,
          renderer: observeSemanticTiles(
            createDefaultTerrainSemanticRenderer({
              renderLandcover: false,
              renderTransportation: false,
              renderBuildings: false,
              materials: { water: waterMaterial },
              waterOffset: 0.65,
              // The elevation carries Puget Sound bathymetry. Without a sea level each bay polygon
              // sits at its lower-quartile depth and shallower seabed shows through as ground, as
              // mountEarthView avoids the same way.
              ...(loaded.descriptor.coordinateSpace.kind === 'geospatial' ||
              loaded.descriptor.surface?.seaLevel !== undefined
                ? { seaLevel: loaded.descriptor.surface?.seaLevel ?? 0 }
                : {}),
            }),
            audioTerrain.observer,
          ),
        },
        ...(worldgen !== undefined
          ? {
              landcoverLayer: {
                renderer: withEarthAirports(
                  wildlifeCover !== undefined
                    ? observeSemanticTiles(
                        observeSemanticTiles(worldgen.classification, wildlifeCover),
                        audioTerrain.observer,
                      )
                    : observeSemanticTiles(worldgen.classification, audioTerrain.observer),
                  content.airports,
                ),
              },
              featuresLayer: { renderer: observeRoads(worldgen.humanFeatures) },
            }
          : {
              landcoverLayer: {
                renderer: withEarthAirports(
                  observeSemanticTiles(
                    createDefaultTerrainSemanticRenderer({
                      renderWater: false,
                      renderTransportation: false,
                      renderBuildings: false,
                    }),
                    audioTerrain.observer,
                  ),
                  content.airports,
                ),
              },
              featuresLayer: {
                renderer: observeRoads(
                  createDefaultTerrainSemanticRenderer({
                    surfaceRenderer,
                    renderLandcover: false,
                    renderWater: false,
                  }),
                ),
              },
            }),
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
    // of the render tests' captures because those all run `?synthetic=1`, and the branch below
    // only shows the credit for real packages.
    for (const id of ['hud', 'hud-toggle', 'location', 'help']) {
      // Null-safe: losing an overlay to a refactor should not take the whole page down with it.
      const overlay = document.getElementById(id);
      if (overlay !== null) {
        overlay.style.opacity = '0';
        overlay.inert = true;
        overlay.setAttribute('aria-hidden', 'true');
      }
    }
  }
  qualitySelect.value = automaticQuality ? 'auto' : quality;
  const allAttribution = [
    ...loaded.descriptor.attribution,
    ...(content.airports?.attribution ?? []),
    ...regionalEarthAttribution(content.worldgen?.environment),
  ];
  for (const attribution of allAttribution) {
    const item = document.createElement('li');
    item.textContent = `${attribution.text} · ${attribution.license}`;
    attributionList.append(item);
  }
  // Always-visible corner credit. The synthetic fixture carries only 'Procedural demonstration
  // data', which nobody has to be credited for, so it keeps the frame clean. Each entry's `text`
  // is written source-first ("© OpenStreetMap contributors; Protomaps Basemap"), so the head up to
  // the first ';' is the party to credit; the full strings stay in the HUD's attribution list.
  const credit = document.getElementById('credit') as HTMLParagraphElement;
  if (!loaded.synthetic && allAttribution.length > 0) {
    const isOsm = (text: string): boolean => text.includes('OpenStreetMap');
    const entries = [...allAttribution].sort(
      (left, right) => Number(isOsm(right.text)) - Number(isOsm(left.text)),
    );
    credit.replaceChildren();
    for (const [index, entry] of entries.entries()) {
      if (index > 0) credit.append(' · ');
      const head = (entry.text.split(';')[0] ?? entry.text).trim();
      if (!isOsm(entry.text) && entry.sourceUrl === undefined) {
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

  const region = loaded.synthetic ? undefined : selectedRegion(params);
  const startingAirport =
    region && content.airports
      ? await airportStart(region, content.airports, metersPerUnit)
      : undefined;
  const defaultAirportStart =
    startingAirport && !params.has('lat') && !params.has('lon') && !params.has('diorama')
      ? startingAirport
      : undefined;
  const [projectedStartX, projectedStartZ] = wgs84ToWebMercator(start.longitude, start.latitude);
  const startX = defaultAirportStart?.position[0] ?? projectedStartX * metersPerUnit;
  const startZ = defaultAirportStart?.position[1] ?? projectedStartZ * metersPerUnit;
  const camera = {
    pos: [startX, cameraAngles.altitude, startZ] as [number, number, number],
    yaw:
      defaultAirportStart && !params.has('yaw')
        ? Math.PI / 2 - defaultAirportStart.yaw
        : cameraAngles.yaw,
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
  const shadowsWanted = params.get('shadows') !== '0';
  const regionalGroundColor = createRegionalGroundColor(worldgen?.environment);
  const pyramidEarth: TerrainPackagePyramidStream | undefined = adaptive
    ? await createTerrainPackagePyramidStream(loaded.descriptor, {
        ...(regionalGroundColor !== undefined ? { surfaceColor: regionalGroundColor } : {}),
        ...(loaded.baseUrl !== undefined ? { baseUrl: loaded.baseUrl } : {}),
        ...(loaded.archive !== undefined ? { archive: loaded.archive } : {}),
        ...pyramidBudget,
        ...(content.airports
          ? { transformHeightfield: createAirportTerrainGrading(content.airports) }
          : {}),
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
              prepareObject: (
                object: THREE.Object3D,
                signal: AbortSignal,
                parent?: THREE.Object3D,
              ) => viewer.renderer.prepareObject(object, signal, parent),
            }
          : {}),
        createTileGroup: () => viewer.renderer.createRenderGroup(),
        morphMilliseconds: params.has('freeze') ? 0 : 180,
        ...(groundMaterial ? { material: groundMaterial } : {}),
        // Ground, roads and buildings receive sun shadows; tall layer parts cast them.
        shadows: shadowsWanted,
        shadowCasterHeight: EARTH_SHADOW_CASTER_HEIGHT,
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
  if (pyramidEarth) provideTunnelHeights(pyramidEarth.source);
  const maybeStream = fixedEarth?.stream ?? pyramidEarth?.stream;
  if (maybeStream === undefined) throw new Error('terrain stream was not created');
  const stream = maybeStream;
  const dioramasEnabled =
    !loaded.synthetic &&
    params.get('dioramas') !== '0' &&
    (!params.has('freeze') ||
      params.get('dioramas') === '1' ||
      selectedDiorama(params.get('diorama')) !== undefined);
  let dioramas = createExplorerDioramas(dioramasEnabled);
  const dioramaToggle = document.getElementById('dioramas-enabled') as HTMLInputElement;
  const dioramaStatus = document.getElementById('diorama-status') as HTMLParagraphElement;
  dioramaToggle.checked = dioramasEnabled;
  dioramaToggle.disabled = loaded.synthetic;
  dioramaToggle.addEventListener('change', () => {
    dioramas.dispose();
    dioramas = createExplorerDioramas(dioramaToggle.checked);
  });
  const requestedDiorama = selectedDiorama(params.get('diorama'));
  let fitDioramaCamera =
    requestedDiorama !== undefined &&
    !['lat', 'lon', 'alt', 'yaw', 'pitch'].some((key) => params.has(key));
  const dioramaSelect = document.getElementById('diorama-select') as HTMLSelectElement;
  for (const place of DIORAMA_SITES) dioramaSelect.add(new Option(place.title, place.scene));
  dioramaSelect.value = requestedDiorama?.scene ?? 'football';
  document.getElementById('visit-diorama')?.addEventListener('click', () => {
    const next = new URL(location.href);
    for (const key of [
      'lat',
      'lon',
      'alt',
      'yaw',
      'pitch',
      'synthetic',
      'freeze',
      'level',
      'package',
      'region',
      'navigation',
      'aircraft',
      'boat',
    ])
      next.searchParams.delete(key);
    next.searchParams.set('diorama', dioramaSelect.value);
    next.searchParams.set('dioramas', '1');
    next.searchParams.set('mode', 'human');
    location.assign(next);
  });
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
  // The sky's sun, fog and reflections now rather than at the first frame: every shader prepared
  // while terrain loads is built for the scene's lighting, so none is rebuilt when it first draws.
  {
    const [longitude, latitude] = webMercatorToWgs84(
      camera.pos[0] / metersPerUnit,
      camera.pos[2] / metersPerUnit,
    );
    skyControls.update({ latitude, longitude, elevation: camera.pos[1] });
  }
  startupStage('environment-controls');
  viewer.renderer.worldRoot.add(stream.object);
  const gpuTimer = viewer.renderer.createGpuTimer();
  const resizeRenderer = (): void => {
    const ratio = automaticQuality
      ? earthPixelRatio(
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
  // Sun shadows follow the performance tier; `?shadows=0` turns them off for comparison. Applied
  // in the frame loop whenever the tier changes.
  let shadowQuality = 'off' as 'off' | 'medium' | 'high';
  let appliedShadowQuality: 'off' | 'medium' | 'high' | undefined;
  // Shadows on once, now that the sky's sun exists: lit shaders are then built for them from the
  // start, and a tier without shadows parks the map instead of rebuilding every shader in view.
  if (shadowsWanted) {
    viewer.renderer.setShadowQuality('medium');
    viewer.renderer.setShadowQuality('off');
    appliedShadowQuality = 'off';
  }
  // A level change swaps resolution, terrain detail, building quality, surfaces, ambient life and
  // shadows. Applied together mid-flight, their one-off costs (a canvas reallocation, a terrain
  // visibility pass, surface rebuilds, a shadow map) stacked into one long frame at every change;
  // the frame loop applies them a frame apart instead. Startup and the menu apply them at once.
  const levelSteps: Array<() => void> = [];
  const applyPerformanceLevel = (staged = false): void => {
    const tier = earthPerformanceTier(performanceLevel);
    if (automaticQuality) quality = tier.quality;
    const stepQuality = quality;
    const level = automaticQuality ? performanceLevel : earthQualityLevel(stepQuality);
    const budget = automaticQuality ? tier.terrain : terrainPyramidBudgetForQuality(stepQuality);
    const steps: Array<() => void> = [
      () => {
        objectPixelError = automaticQuality ? tier.objectPixelError : 2;
        lodPolicy.maxPixelError = objectPixelError;
        fogViewDistance = budget.viewDistance;
        resizeRenderer();
        performanceStatus.dataset.mode = automaticQuality ? 'auto' : 'manual';
        performanceStatus.dataset.level = String(performanceLevel);
        performanceStatus.dataset.maxPixels = automaticQuality ? String(tier.maxPixels) : '';
      },
      () => pyramidEarth?.stream.setBudget(earthTerrainCacheBudget(budget, memoryBudget)),
      () => {
        worldgen?.setQuality(stepQuality);
        worldgen?.setCacheBudget(automaticQuality ? tier.cacheBytes : 192 * 1024 * 1024);
      },
      () => {
        void surfaceRenderer
          .setPerformanceScale(automaticQuality ? tier.surfaceScale : 1, stepQuality)
          .catch((error: unknown) => console.warn('Surface detail update failed:', error));
      },
      () => {
        ambient?.setBudget(earthPerformanceTier(level).ambient);
        wildlife?.setBudget(earthPerformanceTier(level).ambient);
      },
      () => {
        shadowQuality = shadowsWanted ? earthPerformanceTier(level).shadows : 'off';
      },
      // Uniform-driven like shadow parking: switching rebuilds no shader.
      () => viewer.renderer.setCloudQuality(earthPerformanceTier(level).clouds),
    ];
    levelSteps.length = 0;
    if (staged) levelSteps.push(...steps);
    else for (const step of steps) step();
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
    if (!automaticQuality) performanceLevel = earthQualityLevel(quality);
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
      dioramas.dispose();
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

  const input = new NavigationInputSource({ element: canvas, keyTarget: window, profile: 'fly' });
  let jumpRequested = false;
  input.map.onPress('nav-jump', () => {
    jumpRequested = true;
  });
  input.map.onReset(() => {
    jumpRequested = false;
  });
  const controllerControls = createNavigationControls(input, {
    container: document.getElementById('navigation') as HTMLElement,
    focusTarget: canvas,
    storageKey: 'molen:navigation-controls:v1',
  });
  if (selectedDiorama(params.get('diorama')) !== undefined || params.get('mode') === 'human')
    setMode('human');
  const walker = new WalkController();
  // A full scan of the streamed scene each frame was the walk mode's largest fixed cost; 5 Hz
  // rescans still catch streamed changes, and placement forces one.
  const walkCollision = new WalkCollision({ rescanIntervalMs: 200 });
  let navigation: 'fly' | 'walk' = 'fly';
  let aircraft: WorldAircraft | undefined;
  const sampleHeight = (x: number, z: number): number | undefined =>
    sampleTerrainTunnel(stream.object, x, camera.pos[1], z)?.floor ??
    aircraft?.groundHeight(x, z) ??
    stream.sampleHeight(x, z);
  // Cars and aircraft: definitions from the entities pack's types, models read from the same pack
  // the first time each is shown.
  const vehicles: EarthVehicles = new EarthVehicles({
    root: stream.object,
    sampleHeight,
    loadModel: loadEntityModel,
    types: content.types,
    ...(water
      ? {
          waterAt: (x: number, z: number) => {
            const ground = sampleHeight(x, z);
            return ground === undefined
              ? undefined
              : ground < seaLevel
                ? { height: seaLevel, depth: seaLevel - ground }
                : null;
          },
        }
      : {}),
    obstacles: (box, except) =>
      aircraftBlocks(vehicles.world, box, except) || (ambient?.blocks(box, except) ?? false),
  });
  let requestedBoat = params.get('boat') ?? undefined;
  let boatAttemptAt = 0;
  let boatSearchStarted = 0;
  const spawnBoat = (): void => {
    requestedBoat = requestedBoat ?? 'molen.entities.watercraft.speedboat';
    boatAttemptAt = 0;
    boatSearchStarted = 0;
  };
  const weatherControls = createWeatherControls(viewer.renderer, params, vehicles.world);
  aircraft = new WorldAircraft(
    vehicles.world,
    stream.object,
    (x, z, y) =>
      y === undefined
        ? stream.sampleHeight(x, z)
        : (sampleTerrainTunnel(stream.object, x, y, z)?.floor ?? stream.sampleHeight(x, z)),
    camera.pos,
    loadEntityModel,
    content.types,
    params.get('warmup') !== '0' ? (object) => viewer.renderer.prepareObject(object) : undefined,
    loaded.synthetic ? 'practice' : startingAirport,
    startingAirport ? () => stream.isAreaReady(...startingAirport.position, 100) : undefined,
  );
  const flight = aircraft;
  // E in flight: the seat fires and the pilot rides a canopy down, then walks from where it lands.
  const parachute = new WorldParachute(
    stream.object,
    {
      groundHeight: sampleHeight,
      waterHeight: (x, z) => vehicles.boatEnvironment.waterAt(x, z)?.height,
    },
    params.get('warmup') !== '0' ? (object) => viewer.renderer.prepareObject(object) : undefined,
  );
  // Climbing out of a wreck: the landing ray looks past aircraft, so the pilot stands beside it.
  const besideVehicles = new WalkCollision({ ignoreVehicles: true });
  const nightLighting = new EarthNightLighting({
    root: stream.object,
    world: vehicles.world,
    surface: surfaceRenderer,
    vehicleHeights: roadContent.heights,
    sampleHeight,
  });
  const airportPopulation =
    content.airports && params.get('airportTraffic') !== '0'
      ? new EarthAirportPopulation(content.airports, content.types, {
          spawn: (stand) => {
            // Let the supporting airport pavement arrive before models compete for admission.
            if (surfaceRenderer.stats().aprons === 0) return false;
            const [x, z] = wgs84ToWebMercator(stand.longitude, stand.latitude);
            return flight.spawnApron(
              stand.id,
              stand.type,
              x * metersPerUnit,
              z * metersPerUnit,
              stand.heading,
            );
          },
          remove: (id) => flight.removeApron(id),
          pose: (id) => {
            const pose = flight.apronPose(id);
            if (!pose) return undefined;
            const [longitude, latitude] = webMercatorToWgs84(
              pose.position[0] / metersPerUnit,
              pose.position[2] / metersPerUnit,
            );
            return { longitude, latitude, occupied: pose.occupied, speed: pose.speed };
          },
        })
      : undefined;
  // F5 while piloting: a camera beside the flight path watches the aircraft go by. It overlays
  // the cockpit or chase view, which V or F5 returns to.
  let flyby = false;
  const flightInstruments = createFlightInstrumentPanel(params.get('hud') !== '0');
  const cockpitPointer = bindAircraftCockpitPointer({
    element: canvas,
    camera: viewer.renderer.camera,
    session: () => (vehicles.view === 'cockpit' && !flyby ? flight.cockpitSession() : undefined),
  });
  if (ambientTiles !== undefined) {
    ambient = new EarthAmbient({
      world: vehicles.world,
      parent: stream.object,
      settings: {},
      ...(roadSigns ? { drivingSideAt: roadSigns.drivingSideAt } : {}),
      ...(fleet ? { carsAt: fleet.carsAt } : {}),
      content: ambientContentFromTypes(content.types, async (id, signal) => {
        try {
          return await loadEntityModel(id, signal);
        } catch {
          return undefined;
        }
      }),
      prepare: (object) => viewer.renderer.prepareObject(object),
      admission: viewer.renderer.admission,
      ground: (x, z) => stream.sampleHeight(x, z),
    });
    ambient.setBudget(
      earthPerformanceTier(automaticQuality ? performanceLevel : earthQualityLevel(quality))
        .ambient,
    );
    ambientTiles.attach(ambient);
  }
  if (
    wildlifeCover !== undefined &&
    wildlifeFeatures !== undefined &&
    worldgen?.environment !== undefined
  ) {
    wildlife = new EarthWildlife(
      worldgen.environment,
      stream.object,
      (object) => {
        void viewer.renderer.prepareObject(object);
      },
      loaded.descriptor.surface?.seaLevel ?? 0,
    );
    wildlife.setBudget(
      earthPerformanceTier(automaticQuality ? performanceLevel : earthQualityLevel(quality))
        .ambient,
    );
    wildlifeCover.attach(wildlife.landcover);
    wildlifeFeatures.attach(wildlife.features);
  }
  let visitingAircraft: AircraftKind | undefined;
  let visitingTransit: 'bus' | 'lightrail' | undefined;
  // Sound loads beside everything else; the explorer runs silent until (or unless) it arrives.
  let audio: EarthAudio | undefined;
  void startExplorerAudio(new URL('./', location.href), vehicles.world, viewer.renderer, params)
    .then((started) => {
      audio = started;
    })
    .catch((error: unknown) => console.warn('audio unavailable', error));
  const walkHelp =
    'WASD walk · Shift run · Space jump · E board vehicle · click to look · Esc release mouse';
  const boatHelp =
    'W/S thrust / reverse · A/D helm · Space opposing thrust · hold Shift to anchor slowly · E dockside exit · V view';
  const standAt = (feet: readonly [number, number, number]): void => {
    walker.feet.fromArray(feet);
    walker.velocity.set(0, 0, 0);
    walker.ready = true;
    walker.grounded = true;
    walker.waitingForTerrain = false;
    camera.pos = [feet[0], feet[1] + WALK_EYE_HEIGHT, feet[2]];
    camera.pitch = 0;
    input.map.reset();
    help.textContent = walkHelp;
  };
  /**
   * Leave the mounted vehicle by the kernel's rules, or bail out of an aircraft that cannot be
   * left that way: a wreck at rest is climbed out of, and with `eject` (E in flight) the seat fires.
   */
  const exitVehicle = (eject = false): boolean => {
    const feet = vehicles.exit();
    if (feet) {
      flight.message = '';
      standAt(feet);
      return true;
    }
    const leaving = flight.mountedKind ? flight.bailOut(eject) : undefined;
    if (!leaving) {
      if (flight.mountedKind) flight.exitHint();
      return false;
    }
    // Not the ordinary exit's complaint, now that the pilot is out.
    vehicles.message = '';
    if ('ejection' in leaving) {
      parachute.eject(leaving.ejection);
      walker.ready = false;
      vehicles.view = 'chase';
      vehicles.lookYaw = 0;
      vehicles.lookPitch = 0;
      input.map.reset();
      help.textContent = PARACHUTE_HELP;
      return true;
    }
    const [x, y, z] = leaving.wreck;
    walker.reset(x, z);
    walkCollision.invalidate();
    walkCollision.update(stream.object, x, z);
    besideVehicles.update(stream.object, x, z);
    // Open ground at the level the wreck rests on: the raised practice runway or a roof counts.
    const level = (px: number, pz: number): number | undefined => {
      const ground = sampleHeight(px, pz);
      return ground === undefined ? undefined : Math.max(ground, y - 2);
    };
    if (walker.place(walkCollision, level, besideVehicles)) {
      standAt([walker.feet.x, walker.feet.y, walker.feet.z]);
      return true;
    }
    // Nothing open in reach yet: the walk mode keeps looking around the wreck.
    camera.pos = [x, y, z];
    camera.pitch = 0;
    input.map.reset();
    help.textContent = walkHelp;
    return true;
  };
  const inputProfile = (): 'pilot' | 'drive' | 'fly' | 'walk' =>
    flight.mountedKind ? 'pilot' : vehicles.mountedId || parachute.active ? 'drive' : navigation;
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      audio?.dispose();
      ambient?.dispose();
      wildlifeCover?.detach();
      wildlifeFeatures?.detach();
      wildlife?.dispose();
      audioTerrain.clear();
      controllerControls.dispose();
      input.dispose();
      airportPopulation?.dispose();
      flight.dispose();
      cockpitPointer.dispose();
      flightInstruments.dispose();
      nightLighting.dispose();
      parachute.dispose();
      besideVehicles.clear();
      vehicles.dispose();
    }
  });
  const setNavigation = (mode: 'fly' | 'walk'): void => {
    if (vehicles.mountedId && !exitVehicle()) return;
    if (navigation === mode) {
      canvas.focus();
      return;
    }
    parachute.stop();
    navigation = mode;
    input.setProfile(mode);
    input.map.reset();
    if (mode === 'walk') {
      walker.reset(camera.pos[0], camera.pos[2]);
      camera.pitch = 0;
      if (hasHumanFeatures) setMode('human');
    } else {
      walkCollision.clear();
      camera.pos[1] = Math.max(
        camera.pos[1],
        (sampleHeight(camera.pos[0], camera.pos[2]) ?? camera.pos[1]) + 2,
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
        : 'WASD travel · Q/E altitude · drag look · Shift boost · R reset origin · B launch boat nearby';
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
    if (!loaded.synthetic && !startingAirport) {
      help.textContent = 'This terrain package has no starting airport';
      return;
    }
    visitingAircraft = kind;
    void flight.request(kind).catch((error) => {
      help.textContent = String(error);
      visitingAircraft = undefined;
    });
    setNavigation('fly');
    if (startingAirport) {
      if (hasHumanFeatures) setMode('human');
      camera.yaw = Math.PI / 2 - startingAirport.yaw;
      camera.pitch = -0.2;
    }
    camera.pos = [flight.center[0], camera.pos[1], flight.center[1] - (loaded.synthetic ? 330 : 0)];
    help.textContent = startingAirport
      ? `Loading aircraft at ${startingAirport.label}…`
      : 'Loading practice airfield…';
  };
  const aircraftCatalog = document.querySelector<HTMLSelectElement>('#aircraft-catalog');
  if (aircraftCatalog) {
    for (const choice of flight.choices) {
      const option = document.createElement('option');
      option.value = choice.kind;
      option.textContent = choice.label;
      aircraftCatalog.append(option);
    }
    aircraftCatalog.addEventListener('change', () => {
      if (aircraftCatalog.value) visitAircraft(aircraftCatalog.value);
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-aircraft]')) {
    button.addEventListener('click', () => visitAircraft(button.dataset.aircraft as AircraftKind));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-transit]')) {
    button.addEventListener('click', () => {
      if (vehicles.mountedId && !exitVehicle()) return;
      visitAircraft('p51d');
      visitingTransit = button.dataset.transit as 'bus' | 'lightrail';
    });
  }
  const interact = (): void => {
    if (navigation !== 'walk' || parachute.active || (!vehicles.mountedId && !walker.ready)) return;
    if (vehicles.mountedId) {
      const car = vehicles.mountedId;
      // Out through the door, which shuts once the walker moves off.
      if (exitVehicle(true)) vehicles.openDoor(camera.pos, car);
    } else if (
      flight.enter(camera.pos) ||
      // A car takes two presses: the first opens the door beside the walker, the next gets in.
      (!vehicles.openDoor(camera.pos) && vehicles.enter(camera.pos))
    ) {
      if (flight.mountedKind) airportPopulation?.claim(flight.mountedKind);
      input.map.reset();
      vehicles.view = 'cockpit';
      vehicles.lookYaw = 0;
      vehicles.lookPitch = -0.18;
      help.textContent = flight.mountedKind
        ? AIRCRAFT_HELP
        : vehicles.mountedId && vehicles.isBoat(vehicles.mountedId)
          ? boatHelp
          : 'W/S accelerate / brake / reverse · A/D steer · Space brake · Shift handbrake · 1–4 doors · 5 hood · 6 rear access · K wipers · L lights · E exit · V change view · drag to look';
    }
  };
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    // Not a reload in mid-flight, wherever focus is; Ctrl+F5 still reloads.
    if (
      event.code === 'F5' &&
      flight.mountedKind &&
      !(event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
    ) {
      event.preventDefault();
      if (!event.repeat) flyby = !flyby;
      return;
    }
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.closest('input, select, textarea, button, a, summary, dialog') ||
        event.target.isContentEditable)
    )
      return;
    if (event.code === 'KeyB' && !flight.mountedKind && !vehicles.mountedId) spawnBoat();
    if (event.code === 'KeyR' && !flight.mountedKind && !vehicles.mountedId)
      viewer.renderer.setWorldOrigin([camera.pos[0], 0, camera.pos[2]]);
    if (
      event.code === 'KeyL' &&
      ambient !== undefined &&
      !flight.mountedKind &&
      !vehicles.mountedId
    ) {
      ambient.setEnabled(!ambient.isEnabled);
      wildlife?.setEnabled(ambient.isEnabled);
    }
  });
  document.getElementById('hud')?.addEventListener('focusin', () => input.map.reset());
  window.addEventListener('resize', resizeRenderer);

  if (params.get('navigation') === 'walk') setNavigation('walk');
  if (flight.choices.some((choice) => choice.kind === params.get('aircraft')))
    visitAircraft(params.get('aircraft') as AircraftKind);
  let lastTime = performance.now();
  let statusTime = 0;
  let graphicsTime = 0;
  let streamTime = -Infinity;
  const tilePreloader = createEarthTilePreloader();
  let streamedPosition: [number, number, number] = [...camera.pos];
  let streamedDirection: [number, number, number] = [...initialDirection];
  const immediateStreamMove = Math.max(8, finestTileSize / 8);
  const immediateStreamTurn = THREE.MathUtils.degToRad(2);
  let frameTotal = 0;
  let frameCount = 0;
  let frameMax = 0;
  let previousCpuMs = 0;
  const admissionGovernor = createEarthAdmissionGovernor(viewer.renderer.backend);
  let lastGpuMs: number | undefined;
  let lastGpuTime = -Infinity;
  let surfaceGeometryRevision = -1;
  let memoryRefreshTime = Number.NEGATIVE_INFINITY;
  let streamingBusy = true;
  // Quality adapts once the first view has finished loading (or after 20 s). Until then frames
  // carry one-time work: the first ground refining under the camera, collision trees rebuilt
  // for each refinement, models and materials arriving. Measured as overload, it stepped a fast
  // desktop down to the lowest level before the visitor had moved.
  let qualitySettled = false;
  const qualityGraceUntil = performance.now() + 20_000;
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
      if (!qualitySettled && (!streamingBusy || now > qualityGraceUntil)) {
        qualitySettled = true;
      }
      const change = qualityController.sample(frameMs, {
        active: !document.hidden && qualitySettled,
        loading: streamingBusy,
        cpuFrameMs: previousCpuMs,
        ...(completedGpuMs === undefined ? {} : { gpuFrameMs: completedGpuMs }),
        // Warm, hidden cache entries can be reclaimed; they must not prevent quality recovery.
        // Measured against the fixed device budget, as EarthView does: each level's own byte
        // cap is smaller, so a dense city's buildings cascaded every step down to Low.
        memoryPressure: (pressure?.displayedBytes ?? 0) / memoryBudget,
      });
      if (change) {
        performanceLevel = change.level;
        applyPerformanceLevel(true);
      }
    }
    // One step of a level change per frame (see applyPerformanceLevel).
    levelSteps.shift()?.();
    frameTotal += frameMs;
    frameCount++;
    frameMax = Math.max(frameMax, frameMs);
    const dt = Math.max(0, Math.min(0.1, (now - lastTime) / 1000));
    lastTime = now;
    input.setProfile(inputProfile());
    input.map.setEnabled(!document.hidden && document.hasFocus());
    let frameInput = input.read(dt);
    frameInput.jump ||= jumpRequested;
    jumpRequested = false;
    if (frameInput.interact > 0) {
      interact();
      input.setProfile(inputProfile());
      frameInput = input.read(0);
    }
    flyby &&= flight.mountedKind !== undefined;
    if (frameInput.view % 2 === 1 && (vehicles.mountedId || parachute.active)) {
      if (flyby) flyby = false;
      else vehicles.view = vehicles.view === 'cockpit' ? 'chase' : 'cockpit';
    }
    if (vehicles.mountedId || parachute.active) {
      // Under a canopy the view turns all the way round, and down to the landing.
      const turn = parachute.active ? Math.PI : 1.45;
      vehicles.lookYaw = Math.max(
        -turn,
        Math.min(turn, vehicles.lookYaw + frameInput.look[0] * 0.003),
      );
      vehicles.lookPitch = Math.max(
        parachute.active ? -1.1 : -0.8,
        Math.min(0.8, vehicles.lookPitch - frameInput.look[1] * 0.003),
      );
    } else {
      const orientation = applyCameraLookDelta(camera.yaw, camera.pitch, ...frameInput.look);
      camera.yaw = orientation.yaw;
      camera.pitch = orientation.pitch;
    }
    const sprint = frameInput.sprint;
    const tunnelBefore = sampleTerrainTunnel(stream.object, ...camera.pos);
    const previousFlyPosition: [number, number, number] = [...camera.pos];
    const groundBelow = sampleHeight(camera.pos[0], camera.pos[2]);
    const altitudeAGL = Math.max(0, camera.pos[1] - (groundBelow ?? camera.pos[1] - 850));
    const speed = Math.max(12, Math.min(850, altitudeAGL * 1.2)) * (sprint ? 3.5 : 1) * dt;
    let viewDirection = cameraForward(camera.yaw, camera.pitch);
    const forward = cameraPlanarForward(camera.yaw);
    const right = cameraRight(camera.yaw);
    const move = (direction: [number, number, number], amount: number): void => {
      camera.pos[0] += direction[0] * amount;
      camera.pos[1] += direction[1] * amount;
      camera.pos[2] += direction[2] * amount;
    };
    worldgen?.updateInteriors(camera.pos);
    if (visitingAircraft && startingAirport) {
      // Request ground-level detail before placing the aircraft or pilot. Coarse overview
      // heights can differ by tens of meters and would drop them through a refining runway.
      const height = stream.sampleHeight(...startingAirport.position);
      if (height !== undefined) camera.pos[1] = height + 8;
    }
    // Only the synthetic fixture creates a practice field; real regions use existing pavement.
    if (loaded.synthetic || visitingAircraft !== undefined || visitingTransit !== undefined)
      flight.sync();
    if (visitingAircraft && flight.ready && flight.has(visitingAircraft)) {
      const position = flight.visitPosition(visitingAircraft);
      setNavigation('walk');
      camera.pos = position;
      const aircraftPosition =
        flight.apronPose(visitingAircraft)?.position ?? flight.spawnPosition(visitingAircraft);
      camera.yaw = Math.atan2(aircraftPosition[2] - position[2], aircraftPosition[0] - position[0]);
      camera.pitch = 0;
      walker.feet.set(position[0], position[1] - WALK_EYE_HEIGHT, position[2]);
      walker.velocity.set(0, 0, 0);
      walker.ready = true;
      walker.grounded = true;
      visitingAircraft = undefined;
    }
    if (visitingTransit && flight.ready) {
      const kind = visitingTransit,
        id = `practice-${kind}`;
      const x = flight.center[0] + (kind === 'lightrail' ? -38 : 37);
      const z = flight.center[1] - 150;
      const existing = vehicles.world.exists(id);
      const spawned = existing
        ? id
        : vehicles.spawn(
            `molen.entities.transit.${kind}`,
            [x, flight.groundHeight(x, z) ?? 0, z],
            0,
            { id, retain: true },
          );
      if (spawned && vehicles.board(spawned)) {
        vehicles.view = 'cockpit';
        help.textContent =
          kind === 'lightrail'
            ? 'W/S traction / reverse · Space brake · E exit when stopped · V view'
            : 'W/S throttle / reverse · A/D steer · Space brake · E exit · V view';
        canvas.focus();
      }
      visitingTransit = undefined;
    }
    vehicles.sync(now, camera.pos);
    if (requestedBoat && now >= boatAttemptAt && !vehicles.mountedId && !flight.mountedKind) {
      boatSearchStarted ||= now;
      boatAttemptAt = now + 2000;
      if (
        now - boatSearchStarted >
        (vehicles.message === 'Water is still loading' ? 60000 : 12000)
      ) {
        requestedBoat = undefined;
        vehicles.message = 'Move near open water and press B to launch';
      }
      const kind =
        !requestedBoat || requestedBoat === '1'
          ? 'molen.entities.watercraft.speedboat'
          : requestedBoat;
      if (EarthVehicles.boatTypeIds(content.types).includes(kind)) {
        const boat = vehicles.spawnNear(
          kind,
          camera.pos[0],
          camera.pos[2],
          Math.PI / 2 - camera.yaw,
          { radius: 160 },
        );
        if (boat && vehicles.board(boat)) {
          requestedBoat = undefined;
          navigation = 'walk';
          viewer.renderer.setCameraClip(0.05, 500_000);
          document.body.dataset.navigation = 'walk';
          help.textContent = boatHelp;
        }
      } else requestedBoat = undefined;
    }
    // Traffic stops for the walker and for cars a driver left standing, a taken traffic car too.
    ambient?.sync(now, { position: camera.pos, direction: viewDirection }, [
      ...(navigation === 'walk' &&
      vehicles.mountedId === undefined &&
      flight.mountedKind === undefined
        ? [{ x: camera.pos[0], z: camera.pos[2], radius: 0.5 }]
        : []),
      ...vehicles.trafficSolids(),
    ]);
    // Visiting or spawning a vehicle can change the mode after the frame began.
    const activeProfile = inputProfile();
    if (input.map.activeProfile !== activeProfile) {
      input.setProfile(activeProfile);
      frameInput = input.read(0);
    }
    flight.input(dt, frameInput);
    if (frameInput.actuators) vehicles.toggleActuators(frameInput.actuators);
    if ((frameInput.recover ?? 0) > 0) vehicles.recover();
    vehicles.update(dt, {
      throttle: frameInput.move.forward,
      steering: frameInput.move.right,
      brake: frameInput.jump || document.hidden || !document.hasFocus(),
      handbrake: frameInput.sprint,
    });
    const landing = parachute.update(dt, {
      forward: frameInput.move.forward,
      right: frameInput.move.right,
      flare: frameInput.jump,
    });
    if (landing) standAt(landing);
    // Last frame's camera: parked and distant aircraft draw without their cockpits.
    flight.render(camera.pos);
    cockpitPointer.update();
    flightInstruments.update(flight.instrumentSource(), flyby || vehicles.view === 'chase', now);
    surfaceRenderer.updateSignals(
      params.has('freeze') ? 0 : vehicles.world.tick / vehicles.world.tickRate,
      ambient?.surfaceSignalColor,
    );
    surfaceRenderer.updateDetail(viewer.renderer.camera.position);
    if (ambient !== undefined) {
      const ambientStarted = performance.now();
      ambient.render(camera.pos, dt);
      graphics.record('ambient-render', performance.now() - ambientStarted);
    }
    wildlife?.update(params.has('freeze') ? 0 : dt, camera.pos);
    const flightCamera = flight.cameraPose(
      flyby ? 'flyby' : vehicles.view,
      vehicles.lookYaw,
      vehicles.lookPitch,
    );
    const vehicleCamera =
      flightCamera ??
      vehicles.cameraPose() ??
      parachute.cameraPose(vehicles.view, vehicles.lookYaw, vehicles.lookPitch);
    if (vehicleCamera) {
      camera.pos = vehicleCamera.position;
      camera.yaw = vehicleCamera.yaw;
      camera.pitch = vehicleCamera.pitch;
      const direction = new THREE.Vector3()
        .fromArray(vehicleCamera.lookAt)
        .sub(new THREE.Vector3().fromArray(camera.pos))
        .normalize();
      viewDirection = direction.toArray();
    } else if (navigation === 'walk') {
      walkCollision.update(stream.object, camera.pos[0], camera.pos[2]);
      if (!walker.ready) {
        const ground = sampleHeight(camera.pos[0], camera.pos[2]);
        if (ground !== undefined) camera.pos[1] = ground + WALK_EYE_HEIGHT;
        // Land once ground-level detail around the landing spot is on screen, buildings included,
        // not the whole view: that took minutes on slow devices. Rescan collision then, not in
        // every frame of the wait.
        if (stream.isAreaReady(walker.feet.x, walker.feet.z, WALK_PLACEMENT_RADIUS)) {
          walkCollision.invalidate();
          walkCollision.update(stream.object, camera.pos[0], camera.pos[2]);
          walker.place(walkCollision, sampleHeight);
        }
      }
      walker.update(
        dt,
        {
          forward: frameInput.move.forward,
          right: frameInput.move.right,
          yaw: camera.yaw,
          sprint,
          jump: frameInput.jump,
        },
        walkCollision,
        sampleHeight,
      );
      if (walker.ready) {
        camera.pos[0] = walker.feet.x;
        camera.pos[1] = walker.feet.y + WALK_EYE_HEIGHT;
        camera.pos[2] = walker.feet.z;
      }
    } else {
      move(forward, speed * frameInput.move.forward);
      move(right, speed * frameInput.move.right);
      move([0, 1, 0], speed * frameInput.move.up);
      // Probe at the previous height so raising the camera cannot jump through a bore's roof.
      const tunnel = sampleTerrainTunnel(
        stream.object,
        camera.pos[0],
        tunnelBefore ? Math.min(camera.pos[1], tunnelBefore.ceiling - 0.1) : camera.pos[1],
        camera.pos[2],
      );
      if (tunnel)
        camera.pos[1] = Math.max(
          tunnel.floor + Math.min(2, (tunnel.ceiling - tunnel.floor) / 2),
          Math.min(tunnel.ceiling - 0.3, camera.pos[1]),
        );
      else {
        const ground = sampleHeight(camera.pos[0], camera.pos[2]);
        if (tunnelBefore && ground !== undefined && camera.pos[1] < ground) {
          camera.pos = previousFlyPosition;
        } else if (ground !== undefined && camera.pos[1] < ground + 2) camera.pos[1] = ground + 2;
      }
    }
    // Keep the inexpensive 10 Hz cadence while the view barely changes, but refresh before this
    // frame renders if a drag or movement could outrun the selector's view guard band. Otherwise
    // the camera can briefly face resident-but-hidden terrain and expose a horizon-sized hole.
    worldgen?.updateStructures({
      position: camera.pos,
      direction: viewDirection,
      verticalFov: 60,
      viewportHeight: canvas.height,
      maxPixelError: lodPolicy.maxPixelError,
    });
    const terrainViewChanged =
      adaptive &&
      viewNeedsImmediateUpdate(
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
        const streamView: TerrainPyramidView = {
          position: camera.pos,
          verticalFov: THREE.MathUtils.degToRad(60),
          viewportHeight: canvas.height,
          direction: viewDirection,
          aspect: window.innerWidth / window.innerHeight,
        };
        pyramidEarth?.stream.update(streamView, tilePreloader.views(now, streamView, true));
      }
      streamedPosition = [...camera.pos];
      streamedDirection = [...viewDirection];
    }

    if (
      water !== undefined &&
      Math.hypot(camera.pos[0] - water.position.x, camera.pos[2] - water.position.z) >
        finestTileSize * 4
    ) {
      water.position.x = camera.pos[0];
      water.position.z = camera.pos[2];
    }
    if (aerialOrtho > 0)
      viewer.renderer.setTopDownOrtho({
        center: [camera.pos[0], camera.pos[2]],
        viewHeight: aerialOrtho,
        cameraHeight: camera.pos[1],
      });
    else
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
    if (airportPopulation) {
      const [longitude, latitude] = webMercatorToWgs84(
        camera.pos[0] / metersPerUnit,
        camera.pos[2] / metersPerUnit,
      );
      airportPopulation.update(now, { longitude, latitude });
    }
    dioramas.update({
      root: stream.object,
      camera: viewer.renderer.camera,
      position: camera.pos,
      dt: params.has('freeze') ? 0 : dt,
      timeMs: Date.now(),
      toWorld: (latitude, longitude) => {
        const [x, z] = wgs84ToWebMercator(longitude, latitude);
        return [x * metersPerUnit, z * metersPerUnit];
      },
      groundHeight: (x, z) => stream.sampleHeight(x, z),
    });
    const activePlaces = DIORAMA_SITES.filter((place) => dioramas.status(place.id) === 'playing');
    const statusPlace =
      requestedDiorama ??
      activePlaces[0] ??
      DIORAMA_SITES.find((place) => dioramas.status(place.id) === 'loading');
    const dioramaState = statusPlace
      ? dioramas.status(statusPlace.id)
      : dioramaToggle.checked
        ? 'idle'
        : 'off';
    dioramaStatus.dataset.state = dioramaState ?? 'off';
    dioramaStatus.dataset.active = activePlaces.map((place) => place.scene).join(',');
    const dioramaText =
      dioramaState === 'playing'
        ? `${statusPlace?.title} · ${statusPlace?.description}`
        : dioramaState === 'loading'
          ? `Loading ${statusPlace?.title}…`
          : dioramaState === 'failed'
            ? `${statusPlace?.title} unavailable · toggle living places to retry`
            : dioramaState === 'idle'
              ? 'Living places appear as you approach.'
              : 'Living places off';
    if (dioramaStatus.textContent !== dioramaText) dioramaStatus.textContent = dioramaText;
    // Fit the visit once local terrain has arrived. Explicit camera parameters and navigation win.
    if (fitDioramaCamera && requestedDiorama) {
      if (
        input.map.activeActions().size > 0 ||
        camera.pos[0] !== startX ||
        camera.pos[2] !== startZ
      )
        fitDioramaCamera = false;
      else if (dioramaState === 'playing') {
        const [mx, mz] = wgs84ToWebMercator(requestedDiorama.longitude, requestedDiorama.latitude);
        const x = mx * metersPerUnit,
          z = mz * metersPerUnit;
        const heights: number[] = [];
        for (const dx of [-1, 0, 1])
          for (const dz of [-1, 0, 1]) {
            const px = dx * requestedDiorama.groundFootprint[0];
            const pz = dz * requestedDiorama.groundFootprint[1];
            const yaw = requestedDiorama.yaw;
            const height = stream.sampleHeight(
              x + px * Math.cos(yaw) + pz * Math.sin(yaw),
              z - px * Math.sin(yaw) + pz * Math.cos(yaw),
            );
            if (height !== undefined) heights.push(height);
          }
        if (heights.length === 9) {
          camera.pos[1] =
            Math.max(...heights) +
            requestedDiorama.lookHeight +
            Math.hypot(camera.pos[0] - x, camera.pos[2] - z) * Math.tan(-camera.pitch);
          fitDioramaCamera = false;
        }
      }
    }
    setTerrainWaterTime(
      waterMaterial,
      params.has('freeze') ? 0 : vehicles.world.tick * vehicles.world.dt,
      [waterOrigin[0], waterOrigin[2]],
    );
    if (groundMaterial) setTerrainGroundOrigin(groundMaterial, [waterOrigin[0], waterOrigin[2]]);
    if (fieldMaterial) setTerrainGroundOrigin(fieldMaterial, [waterOrigin[0], waterOrigin[2]]);
    if (pavementMaterial)
      setTerrainGroundOrigin(pavementMaterial, [waterOrigin[0], waterOrigin[2]]);
    const skyLocation = webMercatorToWgs84(
      camera.pos[0] / metersPerUnit,
      camera.pos[2] / metersPerUnit,
    );
    skyControls.update({
      latitude: skyLocation[1],
      longitude: skyLocation[0],
      elevation: camera.pos[1],
    });
    const sunY = viewer.renderer.sky?.frame.sunDirection[1];
    const night =
      sunY === undefined
        ? 0
        : earthNightFactor((Math.asin(Math.max(-1, Math.min(1, sunY))) * 180) / Math.PI);
    worldgen?.setNightFactor(night);
    surfaceRenderer.setNightFactor(night);
    nightLighting.update({
      camera: camera.pos,
      direction: viewDirection,
      factor: night,
      drivenVehicleId: vehicles.mountedId,
    });
    if (appliedShadowQuality !== shadowQuality) {
      viewer.renderer.setShadowQuality(shadowQuality);
      appliedShadowQuality = shadowQuality;
    }
    if (shadowQuality !== 'off' && aerialOrtho > 0) {
      // The orthophoto frame is centered under the camera; cover exactly it.
      viewer.renderer.setShadowFocus({
        center: [camera.pos[0], sampleHeight(camera.pos[0], camera.pos[2]) ?? 0, camera.pos[2]],
        radius: (aerialOrtho / 2) * Math.max(1, window.innerWidth / window.innerHeight) * 1.05,
      });
    } else if (shadowQuality !== 'off') {
      viewer.renderer.setShadowFocus(
        earthShadowFocus(
          navigation === 'walk' && !flight.mountedKind
            ? 'walk'
            : vehicles.mountedId
              ? 'drive'
              : 'fly',
          camera.pos,
          viewDirection,
          sampleHeight(camera.pos[0], camera.pos[2]) ?? 0,
        ),
      );
    }
    const above = camera.pos[1] - (sampleHeight(camera.pos[0], camera.pos[2]) ?? 0);
    // From high up a two-pixel error budget buys detail nobody can see, paid for on the GPU. Above
    // 100 m over the ground the budget grows with height (up to four times), so the trees and
    // buildings below hand over to their coarser levels sooner; street and rooftop views keep it.
    lodPolicy.maxPixelError = objectPixelError * Math.min(4, Math.max(1, above / 100));
    // Ambient occlusion darkens creases a meter or two across, under shrubs and along wall bases:
    // it grounds what a walker or driver sees up close. From rooftop height up the same creases
    // are small, while the passes cost a full-screen share of the frame (about 3 ms of 44 on an
    // Apple M2 at High, which put a rooftop view behind the explorer's frame rate before this
    // detail). Suspended above 24 m over the ground, back on below 18 m. Suspending keeps drawing
    // into the occlusion target: switching it off and on changed the target every object's shaders
    // were built for, and a takeoff or landing rebuilt everything in view mid-frame.
    if (occlusionWanted) {
      const on = occlusionOn ? above < 24 : above < 18;
      if (on !== occlusionOn) {
        viewer.renderer.suspendAmbientOcclusion(!on);
        occlusionOn = on;
      }
    }
    if (firstFrame) startupStage('sky');
    const fog = viewer.renderer.scene.fog;
    if (fog instanceof THREE.Fog) updateEarthFog(fog, fogViewDistance, camera.pos[1]);
    const audioGround = audio ? sampleHeight(camera.pos[0], camera.pos[2]) : undefined;
    const audioSky = viewer.renderer.sky?.frame.earth;
    if (audio && now - audioTerrainAt >= 250) {
      audioTerrainSample = audioTerrain.sample(camera.pos[0], camera.pos[2]);
      audioTerrainAt = now;
    }
    audio?.update({
      location: {
        latitude: skyLocation[1],
        longitude: skyLocation[0],
        ...(space.kind === 'geospatial' && audioSky
          ? {
              utcMs: audioSky.utcMs,
              sunAltitudeDeg: audioSky.sun.altitudeDeg,
            }
          : {}),
      },
      ...(wildlife !== undefined ? { regionalAmbience: wildlife.ambience(camera.pos) } : {}),
      nowMs: now,
      ...(audioTerrainSample ? { terrain: audioTerrainSample } : {}),
      surfaceAt: (x, z) => audioTerrain.sample(x, z).surface,
      ...(viewer.renderer.sky?.frame?.earth
        ? {
            solarHour:
              (((viewer.renderer.sky.frame.earth.utcMs / 3600000 + skyLocation[0] / 15) % 24) +
                24) %
              24,
          }
        : {}),
      ...(audioGround !== undefined ? { heightAboveGround: camera.pos[1] - audioGround } : {}),
      position: [camera.pos[0], camera.pos[1], camera.pos[2]],
      forward: [viewDirection[0], viewDirection[1], viewDirection[2]],
      // Under a canopy: the rushing air of flight, not footsteps.
      mode: parachute.active ? 'fly' : inputProfile(),
      inVehicle:
        vehicles.view === 'cockpit' &&
        !flyby &&
        (!!flight.mountedKind || (!!vehicles.mountedId && !vehicles.isBoat(vehicles.mountedId))),
      ...(navigation === 'walk' && !vehicleCamera ? { grounded: walker.grounded } : {}),
      ...(viewer.renderer.weather ? { weather: viewer.renderer.weather.data } : {}),
    });
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
      // The tracked byte estimate: the measured totals walk every resident tile's objects, a
      // stall four times a second over a warm cache.
      const stats: TerrainStreamStats | TerrainPyramidStreamStats =
        pyramidEarth?.stream.stats({ geometry: 'tracked' }) ?? stream.stats();
      status.dataset.preloading = String(isPyramidStats(stats) ? stats.preloading : 0);
      status.dataset.preloaded = String(isPyramidStats(stats) ? stats.preloaded : 0);
      const rendered = viewer.renderer.stats();
      const surfaceStats = surfaceRenderer.stats();
      streamingBusy =
        stats.loading > 0 ||
        stats.loadingLayers > 0 ||
        (isPyramidStats(stats) && stats.retryingLayers > 0) ||
        surfaceStats.loading > 0;
      // Surface detail changes in place on tiles in view; the rest of the cache is counted. The
      // recount walks every displayed mesh (4-6 ms in a city), so a pan's constant surface changes
      // recount every two seconds rather than at every status update.
      if (
        surfaceStats.loading === 0 &&
        surfaceStats.geometryRevision !== surfaceGeometryRevision &&
        now - memoryRefreshTime >= 2000
      ) {
        pyramidEarth?.stream.refreshMemoryUsage('displayed');
        surfaceGeometryRevision = surfaceStats.geometryRevision;
        memoryRefreshTime = now;
      }
      const nearVehicle =
        navigation === 'walk' && walker.ready ? vehicles.nearest(camera.pos) : undefined;
      const nearAircraft =
        navigation === 'walk' && walker.ready ? flight.nearest(camera.pos) : undefined;
      const navigationText = flight.mountedKind
        ? flight.status()
        : parachute.status() ||
          (nearAircraft
            ? `E · Board ${flight.label(nearAircraft)} · I starts the engine`
            : flight.message ||
              (vehicles.mountedId
                ? `${vehicles.label(vehicles.mountedId)} · ${Math.abs(vehicles.speed * 3.6).toFixed(0)} km/h · ${vehicles.speed < -0.1 ? 'Reverse' : 'Drive'} · ${vehicles.view} · ${vehicles.waiting ? 'Waiting for terrain…' : vehicles.message || 'E exit · V view'}`
                : vehicles.message ||
                  (nearVehicle
                    ? vehicles.closedDoor(nearVehicle, camera.pos)
                      ? `E · Open the ${vehicles.label(nearVehicle)} door`
                      : `E · Enter ${vehicles.label(nearVehicle)}`
                    : navigation === 'walk'
                      ? !walker.ready
                        ? 'Finding open ground nearby… Switch to Fly to choose another spot.'
                        : walker.waitingForTerrain
                          ? 'Waiting for terrain…'
                          : `Walk mode · ${WALK_EYE_HEIGHT.toFixed(1)}m eye height · ${walker.grounded ? 'On ground' : 'In air'}`
                      : 'Fly mode · Explore from above')));
      if (navigationStatus.textContent !== navigationText)
        navigationStatus.textContent = navigationText;
      navigationStatus.dataset.vehicle = vehicles.mountedId ?? '';
      navigationStatus.dataset.parachute = parachute.phase ?? '';
      const waterHere = vehicles.boatEnvironment.waterAt(camera.pos[0], camera.pos[2]);
      navigationStatus.dataset.waterHeight = waterHere ? String(waterHere.height) : '';
      navigationStatus.dataset.boat = String(
        Boolean(vehicles.mountedId && vehicles.isBoat(vehicles.mountedId)),
      );
      navigationStatus.dataset.anchored = String(
        vehicles.mountedId ? (vehicles.boatStatus(vehicles.mountedId)?.anchored ?? false) : false,
      );
      navigationStatus.dataset.speed = (flight.state?.airspeed ?? vehicles.speed).toFixed(3);
      navigationStatus.dataset.aircraft = flight.mountedKind ?? '';
      navigationStatus.dataset.apronAircraft = String(flight.apronCount);
      navigationStatus.dataset.apronLoading = String(flight.apronPending);
      navigationStatus.dataset.agl = (flight.state?.altitudeAGL ?? 0).toFixed(2);
      navigationStatus.dataset.crashed = String(flight.state?.crashed ?? false);
      navigationStatus.dataset.power = String(Math.round(flight.power * 100));
      navigationStatus.dataset.flightState = !flight.state
        ? ''
        : flight.state.crashed
          ? 'crashed'
          : !flight.state.grounded
            ? 'airborne'
            : flight.mountedKind !== 'oh6' &&
                flight.state.airspeed >= (flight.mountedKind === 'airliner' ? 65 : 42)
              ? 'rotation'
              : 'grounded';
      navigationStatus.dataset.view = flyby ? 'flyby' : vehicles.view;
      navigationStatus.dataset.entities = String(vehicles.world.query({ name: 'vehicle' }).count());
      const ambientStats = ambient?.stats();
      navigationStatus.dataset.ambientCars = String(ambientStats?.cars ?? 0);
      navigationStatus.dataset.ambientPedestrians = String(ambientStats?.pedestrians ?? 0);
      navigationStatus.dataset.ambientTrains = String(ambientStats?.trains ?? 0);
      navigationStatus.dataset.ambientAircraft = String(ambientStats?.aircraft ?? 0);
      const wildlifeStats = wildlife?.stats();
      navigationStatus.dataset.wildlifeAnimals = String(wildlifeStats?.animals ?? 0);
      navigationStatus.dataset.wildlifeCandidates = String(wildlifeStats?.candidates ?? 0);
      navigationStatus.dataset.wildlifeTriangles = String(wildlifeStats?.triangles ?? 0);
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
      const landmarkStats = worldgen?.structureStats();
      status.dataset.sharedTextureBytes = String(landmarkStats?.sharedTextureBytes ?? 0);
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
        ...(wildlifeStats === undefined
          ? []
          : [
              `wildlife ${wildlifeStats.animals} visible · ${wildlifeStats.candidates} active · ${wildlifeStats.triangles} triangles`,
            ]),
        ...(landmarkStats
          ? [
              `landmarks ${landmarkStats.assets} assets · ${landmarkStats.loading} loading · ${(landmarkStats.gpuBytes / 1_000_000).toFixed(1)} MB geometry · ${((landmarkStats.sharedTextureBytes ?? 0) / 1_000_000).toFixed(1)} MB shared textures`,
            ]
          : []),
        ...(worldgenStats?.interiors
          ? [
              `interiors ${worldgenStats.interiors.resident} resident / ${worldgenStats.interiors.sites} available · ${worldgenStats.interiors.pending} generating · ${(worldgenStats.interiors.bytes / 1_048_576).toFixed(1)}MiB · ${worldgenStats.interiors.failed} failed`,
            ]
          : []),
        (() => {
          const s = surfaceStats;
          return `surfaces ${s.style} · airport fragments: ${s.runways} runway / ${s.taxiways} taxiway / ${s.aprons} apron · ${s.parkingAreas} lots · ${s.parkingBays} bays · ${s.junctions} junctions · ${s.streetlights} lights · ${s.parkedCars} cars`;
        })(),
        ...(ambient === undefined
          ? []
          : [
              (() => {
                const a = ambient.stats();
                return ambient.isEnabled
                  ? `ambient ${a.cars} cars · ${a.pedestrians} people · ${a.trains} rail cars · ${a.aircraft} aircraft · ${a.detailedCars} detailed · ${a.tiles} road tiles (L hides)`
                  : 'ambient off (L shows)';
              })(),
            ]),
      ].join('\n');
      const control = qualityController.getStats();
      const pressure = pyramidEarth?.stream.pressure();
      performanceStatus.textContent = [
        `${viewer.renderer.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}${viewer.renderer.fallbackReason ? ` · fallback: ${viewer.renderer.fallbackReason}` : ''}`,
        automaticQuality
          ? `Auto · ${earthPerformanceTier(performanceLevel).name} · target 60 FPS · ${control.reason === 'manual' ? 'measuring' : (control.reason ?? 'measuring')}`
          : `Manual · ${quality}`,
        `frame ${(frameTotal / frameCount).toFixed(1)}ms avg / ${frameMax.toFixed(0)}ms max · p90 ${control.p90FrameMs?.toFixed(1) ?? '–'}ms`,
        `CPU ${previousCpuMs.toFixed(1)}ms · GPU ${lastGpuMs?.toFixed(1) ?? 'unavailable'}ms · resolution ${canvas.width}×${canvas.height}`,
        `rendered ${rendered.drawCalls} draws / ${(rendered.triangles / 1_000).toFixed(0)}k triangles`,
        ...(pressure
          ? [
              `resident buffers ${(pressure.residentBytes / 1_048_576).toFixed(1)}MiB${automaticQuality ? ` / ${((pressure.maxResidentBytes ?? 0) / 1_048_576).toFixed(0)}MiB` : ''} · shown ${(pressure.displayedBytes / 1_048_576).toFixed(0)}MiB`,
            ]
          : []),
      ].join('\n');
      frameTotal = 0;
      // The distributions sort every stage's samples: a few milliseconds, so every two seconds.
      if (now - graphicsTime >= 2000) {
        graphicsTime = now;
        performanceStatus.dataset.graphics = JSON.stringify(graphics.snapshot());
      }
      frameCount = 0;
      frameMax = 0;
    }
    previousCpuMs = performance.now() - cpuStarted;
    graphics.record(streamingBusy ? 'loading-frame-cpu' : 'steady-frame-cpu', previousCpuMs);
    // A larger streaming budget only while frames have time to spare (see earthAdmission).
    const admission = admissionGovernor.sample(previousCpuMs, frameMs);
    if (admission !== undefined) viewer.renderer.admission.setLimits(admission);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const hud = document.getElementById('hud') as HTMLElement;
const hudToggle = document.getElementById('hud-toggle') as HTMLButtonElement;
const setControlsOpen = (open: boolean): void => {
  hud.toggleAttribute('data-open', open);
  hudToggle.setAttribute('aria-expanded', String(open));
  hudToggle.textContent = open ? 'Hide controls' : 'Show controls';
};
hudToggle.addEventListener('click', () => setControlsOpen(!hud.hasAttribute('data-open')));
hud.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && hud.hasAttribute('data-open')) {
    setControlsOpen(false);
    hudToggle.focus();
  }
});

// On a wide viewport the panel folds down to its title bar. The narrow layout ignores this (its CSS
// hides #hud-collapse and never hides #hud-body) because #hud-toggle already hides the whole panel.
const HUD_COLLAPSED_KEY = 'molen.world-explorer.hud-collapsed';
const hudCollapse = document.getElementById('hud-collapse') as HTMLButtonElement;
const setControlsCollapsed = (collapsed: boolean): void => {
  hud.toggleAttribute('data-collapsed', collapsed);
  hudCollapse.setAttribute('aria-expanded', String(!collapsed));
  const label = collapsed ? 'Expand controls' : 'Collapse controls';
  hudCollapse.setAttribute('aria-label', label);
  hudCollapse.title = label;
};
try {
  setControlsCollapsed(localStorage.getItem(HUD_COLLAPSED_KEY) === '1');
} catch {
  // Private windows may refuse storage; the panel just starts expanded.
}
// The whole bar is the hit target, not just the chevron; the button stays the keyboard control.
document.getElementById('hud-titlebar')?.addEventListener('click', () => {
  if (!hudCollapse.checkVisibility()) return;
  const collapsed = !hud.hasAttribute('data-collapsed');
  setControlsCollapsed(collapsed);
  try {
    localStorage.setItem(HUD_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // The setting just does not persist.
  }
});

void main().catch((error: unknown) => {
  setControlsOpen(true);
  setControlsCollapsed(false);
  const source = document.getElementById('source') as HTMLParagraphElement;
  source.id = 'error';
  source.textContent = (error as Error).message;
});

import { GraphicsTelemetry } from './graphics-telemetry';

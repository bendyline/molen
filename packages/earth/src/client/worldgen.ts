// Styled buildings, landcover and street props for an Earth view: worldgen renderers over the
// style pack, region atlas and places content, with optional worker offload. Building materials
// are baked lazily after the first frame; geometry streams immediately and gains textures in place.

import { AssetCache, type AssetProvider, MaterialResolver } from '@bendyline/molen-client';
import {
  type BakedMaterialStore,
  bakeMatGraph,
  bakePixelGrid,
  createMaterialBakeWorkerPool,
  type MaterialBaker,
  type MatGraphDoc,
  type PixelGridDoc,
  withBakedMaterialStore,
} from '@bendyline/molen-materials';
import { sha256 } from '@bendyline/molen-pack';
import type { AssetSidecar } from '@bendyline/molen-schema';
import {
  createTerrainLandcoverWorkerBridge,
  type TerrainLandcoverGenerator,
  type TerrainQualityPreset,
  type TerrainSurfaceRenderer,
} from '@bendyline/molen-terrain/client';
import {
  type BuildingMaterialDecorator,
  createResolvedMaterialSet,
  ModelLibrary,
  NightWindowLighting,
  type ScreenSpaceLodPolicy,
  StructureLodStreamer,
  StructureModelLibrary,
  type StructureStreamingOptions,
  type StructureStreamingStats,
  type StructureStreamingView,
  structureStreamingBudget,
} from '@bendyline/molen-worldgen/client';
import {
  createRegionResolver,
  createWorldgenSemanticRenderers,
  createWorldgenTileCache,
  createWorldgenWorkerPool,
  type StructureTerrainSampler,
  type WorldgenSemanticRenderers,
} from '@bendyline/molen-worldgen-earth/client';
import {
  type BuildingInfillOptions,
  createRegionalEnvironment,
  isStructureViewingDate,
  type RegionalEnvironment,
  type WorldgenTileOutput,
} from '@bendyline/molen-worldgen-earth/kernel';
import type * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EarthWorldgenContent } from './content';
import { hasOnlyEmbeddedImages } from './structure-image-ownership';

/** Factories for module workers; each is optional and its work runs in-thread without it. */
export interface EarthViewWorkers {
  /** A worker importing `@bendyline/molen-earth/workers/elevation`. */
  elevation?: () => Worker;
  /** A worker importing `@bendyline/molen-earth/workers/landcover`. */
  landcover?: () => Worker;
  /** A worker importing `@bendyline/molen-earth/workers/surface`. */
  surface?: () => Worker;
  /** A worker importing `@bendyline/molen-earth/workers/worldgen`. */
  worldgen?: () => Worker;
  /** A worker importing `@bendyline/molen-earth/workers/material` (two are started). */
  material?: () => Worker;
  /** A worker importing `@bendyline/molen-earth/workers/semantic`: map tiles decode there. */
  semantic?: () => Worker;
}

export interface EarthWorldgen extends WorldgenSemanticRenderers {
  /** Fade building/model lights with a 0 (day) to 1 (night) factor. */
  setNightFactor(factor: number): void;
  readonly environment: RegionalEnvironment | undefined;
  /** Wait for the initial requested surfaces; later visible buildings request textures on demand. */
  prepareMaterials(): Promise<void>;
  updateStructures(view: StructureStreamingView): void;
  structureStats(): StructureStreamingStats | undefined;
}

export interface CreateEarthWorldgenOptions {
  /** Seeded synthetic homes in streets with missing map coverage (default true). */
  buildingInfill?: boolean | BuildingInfillOptions;
  /** Bounded, progressive landmark LODs by default; false opts into legacy full models. */
  landmarkStreaming?: StructureStreamingOptions | false;
  /** Explicit YYYY-MM-DD date for archival landmarks; omitted keeps them unloaded. */
  viewingDate?: string;
  /** Explicit month (1..12) for regional deciduous foliage. Omitted means neutral leaf-on. */
  vegetationMonth?: number;
  /** Ground heights in this terrain's vertical reference; may retrieve neighboring tiles. */
  sampleStructureTerrain?: StructureTerrainSampler;
  content: EarthWorldgenContent;
  assets: AssetProvider;
  surfaceRenderer: TerrainSurfaceRenderer;
  metersPerUnit: number;
  quality: TerrainQualityPreset;
  /** A compact scene (see `compact` on the semantic renderers); for WebGL. */
  compact?: boolean;
  lodPolicy: ScreenSpaceLodPolicy;
  workers?: EarthViewWorkers;
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent?: THREE.Object3D,
  ) => Promise<void>;
  /**
   * Build a baked building material's shaders before it upgrades its flat stand-in in place,
   * usually the renderer's `prepareMaterialChange`.
   */
  prepareMaterialChange?: (current: THREE.Material, next: THREE.Material) => Promise<void>;
  /** Called with material failures after baking (ref → reason). */
  onMaterialFailures?: (failures: ReadonlyMap<string, string>) => void;
  /** Generate building interiors near the walker (default true). */
  interiors?: boolean;
  /** Landcover class colors (forest, grass, park, urban_area…) over the style pack's palette. */
  landcoverColors?: Readonly<Record<string, string>>;
  /**
   * Material for landcover ground, usually `createTerrainGroundMaterialAsync` from
   * `@bendyline/molen-terrain/client` so flat classes gain world-space variation. Shared with the
   * terrain surface; the host owns and disposes it.
   */
  groundMaterial?: THREE.Material;
  /**
   * Material for scatter (trees, shrubs, ground cover) and props, usually
   * `createScatterMaterialAsync` from `@bendyline/molen-worldgen/client` for the renderer's
   * backend: leaf speckle and crown occlusion. Caller-owned. Default: the WebGL variant.
   */
  modelMaterial?: THREE.Material;
  /**
   * Detail for generated building materials, usually `createBuildingWeatheringAsync` from
   * `@bendyline/molen-worldgen/client` for the renderer's backend: facade tone drift, rain
   * streaks and weathered roofs. Default: none.
   */
  buildingDecorator?: BuildingMaterialDecorator;
  /** Distance LOD for street props and landmarks (default true). */
  propLod?: boolean;
  /** Per-tile generation telemetry. */
  onTileStats?: (output: WorldgenTileOutput, elapsedMs: number) => void;
  /** Milliseconds each material bake took in a worker. */
  onMaterialBakeTiming?: (milliseconds: number) => void;
  /**
   * Keep baked building materials across visits, e.g. `createIndexedDbMaterialStore()` from
   * `@bendyline/molen-client`. A later visit reads them instead of baking.
   */
  materialStore?: BakedMaterialStore;
}

/** The resolver's own synchronous bake, behind the baker interface a material store wraps. */
const inThreadBaker: MaterialBaker = {
  async bake(format: 'matgraph' | 'pixelgrid', doc: MatGraphDoc | PixelGridDoc) {
    return format === 'matgraph'
      ? bakeMatGraph(doc as MatGraphDoc)
      : bakePixelGrid(doc as PixelGridDoc);
  },
};

/** Worldgen renderers for an Earth view's classification and human-feature layers. */
export function createEarthWorldgen(options: CreateEarthWorldgenOptions): EarthWorldgen {
  if (options.viewingDate !== undefined && !isStructureViewingDate(options.viewingDate))
    throw new Error('viewingDate must be a valid YYYY-MM-DD calendar date');
  if (
    options.vegetationMonth !== undefined &&
    (!Number.isInteger(options.vegetationMonth) ||
      options.vegetationMonth < 1 ||
      options.vegetationMonth > 12)
  )
    throw new Error('vegetationMonth must be an integer from 1 through 12');
  const { pack, atlas, places, placesDocs, structures } = options.content;
  const workers = options.workers ?? {};
  const regions = createRegionResolver(atlas, { metersPerUnit: options.metersPerUnit });
  const environment =
    options.content.environment !== undefined
      ? createRegionalEnvironment(
          {
            ...options.content.environment,
            ...(options.vegetationMonth !== undefined
              ? { vegetationMonth: options.vegetationMonth }
              : {}),
          },
          options.metersPerUnit,
          regions,
        )
      : undefined;
  const assets = new AssetCache(options.assets, new GLTFLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    places.landmarks.definitions,
    false,
    environment?.library.plants,
    options.content.fonts,
    options.modelMaterial,
  );
  // Geographic assets are loaded only when a visible tile asks for them. Their source glTF
  // resources leave memory when the last tile using the asset is evicted. Keep the original
  // hierarchy and PBR materials: flattening prop geometry would discard landmark textures.
  const pool =
    workers.material !== undefined
      ? createMaterialBakeWorkerPool(
          Array.from({ length: 2 }, () => (workers.material as () => Worker)()),
          options.onMaterialBakeTiming !== undefined
            ? { onTiming: options.onMaterialBakeTiming }
            : {},
        )
      : undefined;
  const baker =
    options.materialStore === undefined
      ? pool
      : withBakedMaterialStore(pool ?? inThreadBaker, options.materialStore);
  const streamingOptions = options.landmarkStreaming || {};
  const nav =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number });
  const mobile =
    streamingOptions.mobile ?? ((nav?.maxTouchPoints ?? 0) > 0 || (nav?.deviceMemory ?? 8) <= 4);
  const materials = createResolvedMaterialSet(new MaterialResolver(options.assets, baker), {
    progressive: true,
    prepareOnUse: true,
    concurrency: 2,
    ...(options.buildingDecorator !== undefined ? { decorate: options.buildingDecorator } : {}),
    ...(options.prepareMaterialChange !== undefined
      ? { prepareChange: options.prepareMaterialChange }
      : {}),
    maxTextureBytes:
      streamingOptions.budget?.maxTextureBytes ?? structureStreamingBudget(mobile).maxTextureBytes,
  });
  const nightWindows = new NightWindowLighting();
  materials.nightWindows = nightWindows;
  const sharedRefs = new Set(Object.entries(pack.materials).map(([ref, kind]) => `${kind}:${ref}`));
  const structureLoader = new GLTFLoader();
  const ownedImageScenes = new WeakSet<THREE.Object3D>();
  const legacyStructures =
    options.landmarkStreaming === false
      ? new StructureModelLibrary(
          async (ref) => {
            const parsed = await structureLoader.parseAsync(await options.assets.load(ref), '');
            // Embedded images get fresh blob URLs per parse. URI/data-URI images may be borrowed
            // from Three's host-global cache, even when this GLTFParser is new.
            if (hasOnlyEmbeddedImages(parsed.parser.json)) ownedImageScenes.add(parsed.scene);
            return parsed.scene;
          },
          {
            nightWindows,
            ownsImageBitmaps: (scene) => ownedImageScenes.has(scene),
            resolveSurface: ({ ref, slot }) =>
              sharedRefs.has(ref) ? materials.materialFor(slot, ref) : undefined,
          },
        )
      : undefined;
  const structureManifests = new Map<string, AssetSidecar>();
  const streamingStructures =
    options.landmarkStreaming === false
      ? undefined
      : new StructureLodStreamer(
          async (ref) => {
            const path = pack.assets[ref];
            if (!path) throw new Error(`Unknown landmark asset: ${ref}`);
            const sidecar = JSON.parse(
              await options.assets.loadText(`pack:${options.content.styleId}/${path}`),
            ) as AssetSidecar;
            if (!sidecar.runtimeLods || sidecar.runtimeLods.masterHash !== sidecar.hash)
              throw new Error(`Landmark ${ref} needs current source-derived runtime LODs`);
            structureManifests.set(ref, sidecar);
            return { bounds: sidecar.bounds, runtimeLods: sidecar.runtimeLods };
          },
          async (ref, level, signal) => {
            const path = pack.assets[ref];
            if (!path || !structureManifests.has(ref) || !/^[a-zA-Z0-9_.-]+\.glb$/.test(level.file))
              throw new Error(`Invalid runtime landmark path: ${ref}`);
            const directory = path.slice(0, path.lastIndexOf('/') + 1);
            const bytes = await options.assets.load(
              `pack:${options.content.styleId}/${directory}${level.file}`,
              { signal },
            );
            if (signal.aborted) throw new DOMException('Landmark load cancelled', 'AbortError');
            if (
              bytes.byteLength !== level.bytes ||
              (await sha256(new Uint8Array(bytes))) !== level.hash
            )
              throw new Error(`Runtime landmark hash mismatch: ${ref}/${level.name}`);
            const parsed = await structureLoader.parseAsync(bytes, '');
            if (hasOnlyEmbeddedImages(parsed.parser.json)) ownedImageScenes.add(parsed.scene);
            return parsed.scene;
          },
          {
            ...options.landmarkStreaming,
            nightWindows,
            ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
            ownsImageBitmaps: (scene) => ownedImageScenes.has(scene),
            resolveSurface: ({ ref, slot }) =>
              sharedRefs.has(ref) ? materials.materialFor(slot, ref) : undefined,
          },
        );
  const structureObjects = streamingStructures ?? legacyStructures;
  if (!structureObjects) throw new Error('No structure model source');
  let preparation: Promise<void> | undefined;
  let disposed = false;
  const prepareMaterials = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    preparation ??= (async () => {
      try {
        await materials.prepare([]);
        if (!disposed && materials.failures.size > 0)
          options.onMaterialFailures?.(materials.failures);
      } finally {
        if (disposed) materials.dispose();
      }
    })();
    return preparation;
  };
  const generator =
    workers.worldgen !== undefined
      ? createWorldgenWorkerPool(Array.from({ length: generationWorkers() }, workers.worldgen), {
          pack,
          atlas,
          metersPerUnit: options.metersPerUnit,
          places: placesDocs,
          ...(environment !== undefined ? { environment: environment.docs } : {}),
        })
      : undefined;
  const renderers = createWorldgenSemanticRenderers(pack, {
    distantBuildings: true,
    buildingInfill: options.buildingInfill ?? true,
    places,
    structures,
    ...(options.viewingDate !== undefined ? { viewingDate: options.viewingDate } : {}),
    ...(options.sampleStructureTerrain
      ? { sampleStructureTerrain: options.sampleStructureTerrain }
      : {}),
    ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
    atlas,
    regions,
    ...(environment !== undefined ? { environment } : {}),
    models,
    structureObjects,
    materials,
    ...(options.buildingDecorator !== undefined
      ? { materialDecorator: options.buildingDecorator }
      : {}),
    metersPerUnit: options.metersPerUnit,
    quality: options.quality,
    ...(options.compact === true ? { compact: true } : {}),
    lodPolicy: options.lodPolicy,
    interiors: options.interiors ?? true,
    propLod: options.propLod ?? true,
    ...(options.landcoverColors !== undefined || options.groundMaterial !== undefined
      ? {
          landcover: {
            ...(options.landcoverColors !== undefined
              ? { landcoverColors: options.landcoverColors }
              : {}),
            ...(options.groundMaterial !== undefined
              ? { materials: { landcover: options.groundMaterial } }
              : {}),
          },
        }
      : {}),
    ...(options.onTileStats !== undefined ? { onTileStats: options.onTileStats } : {}),
    ...(workers.landcover !== undefined
      ? {
          landcoverGenerator: landcoverPool(
            Array.from({ length: surfaceWorkers() }, () =>
              createTerrainLandcoverWorkerBridge((workers.landcover as () => Worker)()),
            ),
          ),
        }
      : {}),
    roads: { surfaceRenderer: options.surfaceRenderer },
    ...(generator !== undefined ? { generator } : {}),
    cache: createWorldgenTileCache({ maxEntries: 512, maxBytes: 192 * 1024 * 1024 }),
  });
  return {
    ...renderers,
    setNightFactor: (factor) => nightWindows.setNightFactor(factor),
    environment,
    prepareMaterials,
    updateStructures: (view) => streamingStructures?.update(view),
    structureStats: () =>
      streamingStructures
        ? { ...streamingStructures.stats(), sharedTextureBytes: materials.textureBytes ?? 0 }
        : undefined,
    dispose() {
      if (disposed) return;
      disposed = true;
      pool?.dispose();
      renderers.dispose();
      generator?.dispose();
      structureObjects.dispose();
      nightWindows.dispose();
      materials.dispose();
      models.dispose();
      assets.dispose();
    },
  };
}

/**
 * World generation workers: a quarter of the logical cores, at most two. One worked through a
 * city's tiles one at a time; four, beside as many for land cover and road surfaces, took the
 * cores the frame needs: on a 12-core laptop a jet's frames drew the same scene up to twice as
 * slowly while a town streamed in, and a frame over 33 ms came every few seconds. Two halved those
 * for a tile generated ~170 ms later (most of it hidden by the predicted views loading ahead).
 */
export function generationWorkers(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  return Math.max(1, Math.min(2, Math.floor(cores / 4)));
}

/**
 * Land cover and road surface workers: one each. Their jobs are short beside world generation's,
 * and a second of each still took the frame's cores: with two, panning low over Kyoto, Sydney or
 * Seattle drew the same scene up to three times as slowly in some frames (a few a minute over
 * 50 ms, at about 80-90 fps); with one, none, at 100+ fps. A low flight streamed just as fast;
 * the first view loaded about a fifth later.
 */
export function surfaceWorkers(): number {
  return 1;
}

/** Landcover tiles go to whichever worker has the fewest in flight. */
function landcoverPool(members: readonly TerrainLandcoverGenerator[]): TerrainLandcoverGenerator {
  const busy = members.map(() => 0);
  return {
    generate(tile, context, options) {
      let index = 0;
      for (let i = 1; i < members.length; i++)
        if ((busy[i] as number) < (busy[index] as number)) index = i;
      busy[index] = (busy[index] as number) + 1;
      return (members[index] as TerrainLandcoverGenerator)
        .generate(tile, context, options)
        .finally(() => {
          busy[index] = (busy[index] as number) - 1;
        });
    },
    dispose(): void {
      for (const member of members) member.dispose();
    },
  };
}

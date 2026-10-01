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
import {
  createTerrainLandcoverWorkerBridge,
  type TerrainQualityPreset,
  type TerrainSurfaceRenderer,
} from '@bendyline/molen-terrain/client';
import {
  createResolvedMaterialSet,
  ModelLibrary,
  type ScreenSpaceLodPolicy,
  StructureModelLibrary,
} from '@bendyline/molen-worldgen/client';
import {
  createRegionResolver,
  createWorldgenSemanticRenderers,
  createWorldgenTileCache,
  createWorldgenWorkerBridge,
  type StructureTerrainSampler,
  type WorldgenSemanticRenderers,
} from '@bendyline/molen-worldgen-earth/client';
import {
  isStructureViewingDate,
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
}

export interface EarthWorldgen extends WorldgenSemanticRenderers {
  /** Bake the style pack's materials (idempotent); visible buildings gain textures as they finish. */
  prepareMaterials(): Promise<void>;
}

export interface CreateEarthWorldgenOptions {
  /** Explicit YYYY-MM-DD date for archival landmarks; omitted keeps them unloaded. */
  viewingDate?: string;
  /** Ground heights in this terrain's vertical reference; may retrieve neighboring tiles. */
  sampleStructureTerrain?: StructureTerrainSampler;
  content: EarthWorldgenContent;
  assets: AssetProvider;
  surfaceRenderer: TerrainSurfaceRenderer;
  metersPerUnit: number;
  quality: TerrainQualityPreset;
  lodPolicy: ScreenSpaceLodPolicy;
  workers?: EarthViewWorkers;
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent?: THREE.Object3D,
  ) => Promise<void>;
  /** Called with material failures after baking (ref → reason). */
  onMaterialFailures?: (failures: ReadonlyMap<string, string>) => void;
  /** Generate building interiors near the walker (default true). */
  interiors?: boolean;
  /** Landcover class colors (forest, grass, park, urban_area…) over the style pack's palette. */
  landcoverColors?: Readonly<Record<string, string>>;
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
  const { pack, atlas, places, placesDocs, structures } = options.content;
  const workers = options.workers ?? {};
  const regions = createRegionResolver(atlas, { metersPerUnit: options.metersPerUnit });
  const assets = new AssetCache(options.assets, new GLTFLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    places.landmarks.definitions,
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
  const materials = createResolvedMaterialSet(new MaterialResolver(options.assets, baker), {
    progressive: true,
  });
  const sharedRefs = new Set(Object.entries(pack.materials).map(([ref, kind]) => `${kind}:${ref}`));
  const structureLoader = new GLTFLoader();
  const ownedImageScenes = new WeakSet<THREE.Object3D>();
  const structureObjects = new StructureModelLibrary(
    async (ref) => {
      const parsed = await structureLoader.parseAsync(await options.assets.load(ref), '');
      // Embedded images get fresh blob URLs per parse. URI/data-URI images may be borrowed
      // from Three's host-global cache, even when this GLTFParser is new.
      if (hasOnlyEmbeddedImages(parsed.parser.json)) ownedImageScenes.add(parsed.scene);
      return parsed.scene;
    },
    {
      ownsImageBitmaps: (scene) => ownedImageScenes.has(scene),
      resolveSurface: ({ ref, slot }) =>
        sharedRefs.has(ref) ? materials.materialFor(slot, ref) : undefined,
    },
  );
  let preparation: Promise<void> | undefined;
  let disposed = false;
  const prepareMaterials = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    preparation ??= (async () => {
      try {
        await materials.prepare([...sharedRefs]);
        if (!disposed && materials.failures.size > 0)
          options.onMaterialFailures?.(materials.failures);
      } finally {
        pool?.dispose();
        if (disposed) materials.dispose();
      }
    })();
    return preparation;
  };
  const generator =
    workers.worldgen !== undefined
      ? createWorldgenWorkerBridge(workers.worldgen(), {
          pack,
          atlas,
          metersPerUnit: options.metersPerUnit,
          places: placesDocs,
        })
      : undefined;
  const renderers = createWorldgenSemanticRenderers(pack, {
    places,
    structures,
    ...(options.viewingDate !== undefined ? { viewingDate: options.viewingDate } : {}),
    ...(options.sampleStructureTerrain
      ? { sampleStructureTerrain: options.sampleStructureTerrain }
      : {}),
    ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
    atlas,
    regions,
    models,
    structureObjects,
    materials,
    metersPerUnit: options.metersPerUnit,
    quality: options.quality,
    lodPolicy: options.lodPolicy,
    interiors: options.interiors ?? true,
    propLod: options.propLod ?? true,
    ...(options.landcoverColors !== undefined
      ? { landcover: { landcoverColors: options.landcoverColors } }
      : {}),
    ...(options.onTileStats !== undefined ? { onTileStats: options.onTileStats } : {}),
    ...(workers.landcover !== undefined
      ? { landcoverGenerator: createTerrainLandcoverWorkerBridge(workers.landcover()) }
      : {}),
    roads: { surfaceRenderer: options.surfaceRenderer },
    ...(generator !== undefined ? { generator } : {}),
    cache: createWorldgenTileCache({ maxEntries: 512, maxBytes: 192 * 1024 * 1024 }),
  });
  return {
    ...renderers,
    prepareMaterials,
    dispose() {
      if (disposed) return;
      disposed = true;
      pool?.dispose();
      renderers.dispose();
      generator?.dispose();
      structureObjects.dispose();
      materials.dispose();
      models.dispose();
      assets.dispose();
    },
  };
}

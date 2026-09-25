// Styled buildings, landcover and street props for an Earth view: worldgen renderers over the
// style pack, region atlas and places content, with optional worker offload. Building materials
// are baked lazily after the first frame; tiles that need them wait, everything else streams.

import { AssetCache, type AssetProvider, MaterialResolver } from '@bendyline/molen-client';
import { createMaterialBakeWorkerPool } from '@bendyline/molen-materials';
import {
  createTerrainLandcoverWorkerBridge,
  type TerrainQualityPreset,
  type TerrainSurfaceRenderer,
} from '@bendyline/molen-terrain/client';
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
import type { WorldgenTileOutput } from '@bendyline/molen-worldgen-earth/kernel';
import type * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EarthWorldgenContent } from './content';
import { afterPreparation } from './deferred';

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
  /** Bake the style pack's materials (idempotent); building tiles wait for it. */
  prepareMaterials(): Promise<void>;
}

export interface CreateEarthWorldgenOptions {
  content: EarthWorldgenContent;
  assets: AssetProvider;
  surfaceRenderer: TerrainSurfaceRenderer;
  metersPerUnit: number;
  quality: TerrainQualityPreset;
  lodPolicy: ScreenSpaceLodPolicy;
  workers?: EarthViewWorkers;
  prepareObject?: (object: THREE.Object3D, signal: AbortSignal) => Promise<void>;
  /** Called with material failures after baking (ref → reason). */
  onMaterialFailures?: (failures: ReadonlyMap<string, string>) => void;
  /** Generate building interiors near the walker (default true). */
  interiors?: boolean;
  /** Distance LOD for street props and landmarks (default true). */
  propLod?: boolean;
  /** Per-tile generation telemetry. */
  onTileStats?: (output: WorldgenTileOutput, elapsedMs: number) => void;
  /** Milliseconds each material bake took in a worker. */
  onMaterialBakeTiming?: (milliseconds: number) => void;
}

/** Worldgen renderers for an Earth view's classification and human-feature layers. */
export function createEarthWorldgen(options: CreateEarthWorldgenOptions): EarthWorldgen {
  const { pack, atlas, places, placesDocs } = options.content;
  const workers = options.workers ?? {};
  const regions = createRegionResolver(atlas, { metersPerUnit: options.metersPerUnit });
  const assets = new AssetCache(options.assets, new GLTFLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    places.landmarks.definitions,
  );
  const baker =
    workers.material !== undefined
      ? createMaterialBakeWorkerPool(
          Array.from({ length: 2 }, () => (workers.material as () => Worker)()),
          options.onMaterialBakeTiming !== undefined
            ? { onTiming: options.onMaterialBakeTiming }
            : {},
        )
      : undefined;
  const materials = createResolvedMaterialSet(new MaterialResolver(options.assets, baker));
  let preparation: Promise<void> | undefined;
  let disposed = false;
  const prepareMaterials = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    preparation ??= (async () => {
      try {
        await materials.prepare(stylePackMaterialRefs(pack));
        if (!disposed && materials.failures.size > 0)
          options.onMaterialFailures?.(materials.failures);
      } finally {
        baker?.dispose();
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
    ...(options.prepareObject ? { prepareObject: options.prepareObject } : {}),
    atlas,
    regions,
    models,
    materials,
    metersPerUnit: options.metersPerUnit,
    quality: options.quality,
    lodPolicy: options.lodPolicy,
    interiors: options.interiors ?? true,
    propLod: options.propLod ?? true,
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

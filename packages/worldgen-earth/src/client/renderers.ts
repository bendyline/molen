/**
 * Terrain tile renderers that put the worldgen core behind the terrain streamer. Roads and the
 * land surface stay with the default terrain adapter; buildings, roof props, and scatter come
 * from a `WorldgenGenerator` (in-thread by default, a worker bridge when given, either one
 * optionally fronted by a tile cache).
 */

import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import {
  createTerrainSemanticObject,
  disposeTerrainSemanticObject,
  type TerrainLandcoverGenerator,
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticTile,
  type TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import {
  buffersToObject3D,
  createBuildingCellLod,
  createBuildingDetailLod,
  createInstancedPlacementLod,
  createInstancedPlacements,
  createVertexColorMaterialSet,
  disposeWorldgenObject,
  InteriorStreamer,
  type InteriorStreamingOptions,
  type InteriorStreamingStats,
  type ModelLibrary,
  type ScreenSpaceLodPolicy,
  unitBoxGeometry,
  type WorldgenMaterialSet,
} from '@bendyline/molen-worldgen/client';
import type {
  PlacementSet,
  ResolvedStylePack,
  WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import type { PlacesContent } from '../kernel/places';
import type { RegionResolver } from '../kernel/region';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';
import type { TileGeometry } from '../kernel/semantic-adapter';
import { type WorldgenQualityPreset, worldgenTileBudgetForQuality } from '../kernel/tile-budgets';
import type { WorldgenTileOutput } from '../kernel/tile-generate';
import { type WorldgenTileCache, worldgenTileCacheKey } from './cache';
import { createInThreadWorldgenGenerator, withWorldgenTileCache } from './generators';
import type { WorldgenGenerator } from './worker-bridge';

export interface WorldgenRendererOptions {
  atlas?: RegionAtlasDoc;
  regions?: RegionResolver;
  /**
   * Landmarks and business identities for mapped places; without them businesses are not
   * recognized and street furniture is not placed. With a worker `generator`, pass the worker the
   * same content; tile cache keys include its hashes.
   */
  places?: PlacesContent;
  materials?: WorldgenMaterialSet;
  /** Prepared prop models; without it the classification layer keeps the default tree cones. */
  models?: ModelLibrary;
  quality?: WorldgenQualityPreset;
  budgets?: Partial<WorldgenBudgets>;
  /** cos(center latitude) factor of the terrain package (1 for local packages). */
  metersPerUnit?: number;
  /** Shared surface styles/controller for roads, parking areas, markings and fixtures. */
  roads?: TerrainSemanticMeshOptions;
  /** Options forwarded to the default land surface (colors default to the scatter surface colors). */
  landcover?: TerrainSemanticMeshOptions;
  /** Optional worker-backed land-cover surface draping. Caller owns its lifetime. */
  landcoverGenerator?: TerrainLandcoverGenerator;
  /** Camera-distance vegetation LOD and spatial culling (default true). */
  propLod?: boolean;
  /**
   * Real openings and bounded lazy interiors, including residential upstairs (opt in). They are
   * laid out by the style pack's interior catalog; a pack without one generates no interiors.
   */
  interiors?: boolean | Omit<InteriorStreamingOptions, 'catalog'>;
  /** Shared screen-space policy for resident building and vegetation LODs. */
  lodPolicy?: ScreenSpaceLodPolicy;
  /** Buildings generated between cooperative yields (default 48, in-thread only). */
  yieldEveryBuildings?: number;
  /** Where tiles are generated (default: on this thread); e.g. `createWorldgenWorkerBridge`. */
  generator?: WorldgenGenerator;
  /** CPU-side cache of generated tiles keyed by pack, atlas, quality, and address. */
  cache?: WorldgenTileCache;
  /** Prepare replacement architecture before a resident quality change becomes visible. */
  prepareObject?: (object: THREE.Object3D, signal: AbortSignal) => Promise<void>;
  onTileStats?: (output: WorldgenTileOutput, generateMs: number) => void;
}

export interface WorldgenRenderStats {
  tiles: number;
  buildings: number;
  boxes: number;
  props: number;
  skippedByOwnership: number;
  geometryBytes: number;
  generateMs: { last: number; mean: number; max: number };
  cache?: { hits: number; misses: number; size: number; bytes: number };
  interiors?: InteriorStreamingStats;
}

export interface WorldgenSemanticRenderers {
  classification: TerrainSemanticTileRenderer;
  humanFeatures: TerrainSemanticTileRenderer;
  stats(): WorldgenRenderStats;
  /** Rebuild resident architecture cooperatively, keeping the previous geometry until ready. */
  setQuality(quality: WorldgenQualityPreset): void;
  setCacheBudget(maxBytes: number): void;
  /** Call before walking collision with the camera in metric world coordinates. */
  updateInteriors(position: readonly [number, number, number]): void;
  dispose(): void;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function geometryFor(context: TerrainPyramidTileLayerContext, metersPerUnit: number): TileGeometry {
  return {
    level: context.address.level,
    x: context.address.x,
    z: context.address.z,
    originX: context.origin[0],
    originZ: context.origin[1],
    size: context.tileSize,
    metersPerUnit,
    levelBelowMax: Math.max(0, context.pyramid.maxLevel - context.address.level),
  };
}

function surfaceColors(
  pack: ResolvedStylePack,
  scatterId: string | undefined,
): Record<string, string> | undefined {
  const doc = scatterId !== undefined ? pack.scatters[scatterId] : undefined;
  return doc?.surface.colors;
}

/** Renderers for the classification and human-feature layers of a terrain package. */
export function createWorldgenSemanticRenderers(
  pack: ResolvedStylePack,
  options: WorldgenRendererOptions = {},
): WorldgenSemanticRenderers {
  const materials = options.materials ?? createVertexColorMaterialSet();
  const ownsMaterials = options.materials === undefined;
  const metersPerUnit = options.metersPerUnit ?? 1;
  const interiors =
    options.interiors && pack.interiors !== undefined
      ? new InteriorStreamer({
          ...(typeof options.interiors === 'object' ? options.interiors : {}),
          catalog: pack.interiors,
        })
      : undefined;
  let quality = options.quality ?? 'balanced';
  interface ResidentBuildings {
    tile: TerrainSemanticTile;
    context: TerrainPyramidTileLayerContext;
    architecture: THREE.Group;
    quality: WorldgenQualityPreset;
    pending?: AbortController;
  }
  const residents = new Map<THREE.Object3D, ResidentBuildings>();
  let rebuilding = false;
  let disposed = false;
  const flatMaterials = options.lodPolicy ? createVertexColorMaterialSet() : undefined;
  const models = options.models;
  const warnedModels = new Set<string>();
  const stats: WorldgenRenderStats = {
    tiles: 0,
    buildings: 0,
    boxes: 0,
    props: 0,
    skippedByOwnership: 0,
    geometryBytes: 0,
    generateMs: { last: 0, mean: 0, max: 0 },
  };
  let totalMs = 0;
  const defaultScatterId = options.atlas?.default.scatter ?? pack.root.defaults.scatter;

  const base: WorldgenGenerator =
    options.generator ??
    createInThreadWorldgenGenerator(pack, {
      ...(options.atlas !== undefined ? { atlas: options.atlas } : {}),
      ...(options.regions !== undefined ? { regions: options.regions } : {}),
      ...(options.places !== undefined ? { places: options.places } : {}),
      ...(options.yieldEveryBuildings !== undefined
        ? { yieldEveryBuildings: options.yieldEveryBuildings }
        : {}),
    });
  const ownsGenerator = options.generator === undefined;
  const places = options.places;
  const cache = options.cache;
  const atlasHash =
    options.atlas !== undefined ? hashJson(options.atlas as unknown as JsonValue) : undefined;
  const generator =
    cache !== undefined
      ? withWorldgenTileCache(base, cache, (request) =>
          worldgenTileCacheKey({
            packHash: pack.hash,
            ...(atlasHash !== undefined ? { atlasHash } : {}),
            quality,
            variant: hashJson({
              budgets: request.budgets ?? {},
              tierOffset: request.tierOffset ?? 0,
              interiors: request.features?.interiors ?? false,
              renderCellsOnly: request.renderCellsOnly ?? false,
              identities: places?.businesses.hash ?? null,
              models: places?.landmarks.hash ?? null,
              semantics: request.tile,
              geometry: request.geom,
            } as unknown as JsonValue),
            level: request.geom.level,
            x: request.geom.x,
            z: request.geom.z,
            features: {
              buildings: request.features?.buildings === true,
              scatter: request.features?.scatter === true,
            },
          }),
        )
      : base;

  async function generate(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    features: { buildings: boolean; scatter: boolean },
    preset = quality,
  ): Promise<{ output: WorldgenTileOutput; generateMs: number } | undefined> {
    const geom = geometryFor(context, metersPerUnit);
    const started = now();
    const output = await generator.generate(
      {
        tile,
        geom,
        ground: context.heightfield,
        resolution: context.pyramid.tileResolution,
        renderCellsOnly: options.lodPolicy !== undefined,
        budgets: {
          ...worldgenTileBudgetForQuality(preset, geom.levelBelowMax),
          ...options.budgets,
        },
        features: { ...features, interiors: interiors !== undefined && features.buildings },
        tierOffset: preset === 'economy' ? 1 : 0,
      },
      context.signal,
    );
    if (output === undefined || context.signal.aborted) return undefined;
    const generateMs = now() - started;
    totalMs += generateMs;
    stats.tiles++;
    stats.generateMs = {
      last: generateMs,
      mean: totalMs / stats.tiles,
      max: Math.max(stats.generateMs.max, generateMs),
    };
    options.onTileStats?.(output, generateMs);
    return { output, generateMs };
  }

  async function instancedProps(
    sets: readonly PlacementSet[],
    context: TerrainPyramidTileLayerContext,
    name: string,
  ): Promise<THREE.Object3D[]> {
    if (models === undefined) return [];
    const objects: THREE.Object3D[] = [];
    for (const set of sets) {
      if (set.modelRef === 'builtin:box' || set.count === 0) continue;
      try {
        const coarse = context.address.level < context.pyramid.maxLevel;
        const prepared = await models.prepare(set.modelRef, coarse);
        if (context.signal.aborted) return objects;
        const medium =
          options.propLod !== false ? await models.prepare(set.modelRef, true) : prepared;
        const distant =
          options.propLod !== false ? await models.prepare(set.modelRef, 'distant') : prepared;
        if (context.signal.aborted) return objects;
        objects.push(
          options.propLod !== false
            ? createInstancedPlacementLod(
                set,
                [prepared, medium, distant],
                {
                  // Coarse terrain spans much more ground. Keep a bounded number of spatial
                  // batches per tile instead of compiling thousands of tiny distant cells.
                  cellSize:
                    512 *
                    2 ** Math.min(4, Math.max(0, context.pyramid.maxLevel - context.address.level)),
                  ...(options.lodPolicy ? { screenSpace: options.lodPolicy } : {}),
                },
                `${name}:${set.setId}`,
              )
            : createInstancedPlacements(
                set,
                prepared.geometry,
                prepared.material,
                `${name}:${set.setId}`,
              ),
        );
        stats.props += set.count;
        stats.geometryBytes += set.data.byteLength;
      } catch (error) {
        if (!warnedModels.has(set.modelRef)) {
          warnedModels.add(set.modelRef);
          console.warn(`[molen] worldgen model "${set.modelRef}": ${(error as Error).message}`);
        }
      }
    }
    return objects;
  }

  async function assembleBuildings(
    output: WorldgenTileOutput,
    context: TerrainPyramidTileLayerContext,
    name: string,
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    group.name = `${name}:architecture`;
    if (output.buildingCells && options.lodPolicy && flatMaterials) {
      const policy = options.lodPolicy;
      try {
        for (const cell of output.buildingCells) {
          const create = (): THREE.Object3D =>
            createBuildingCellLod(
              cell,
              materials,
              flatMaterials.materialFor('wall', 'palette:#ffffff'),
              policy,
              `${name}:buildings`,
            );
          const object = context.admission
            ? await context.admission.run(create, {
                signal: context.signal,
                label: 'building-assembly',
                bytes:
                  cell.positions.byteLength +
                  cell.normals.byteLength +
                  cell.colors.byteLength +
                  cell.uvs.byteLength +
                  cell.indices.byteLength +
                  cell.structuralIndices.byteLength,
              })
            : create();
          group.add(object);
        }
      } catch (error) {
        disposeWorldgenObject(group);
        throw error;
      }
    } else if (output.buildings !== undefined)
      group.add(
        options.lodPolicy && flatMaterials
          ? createBuildingDetailLod(
              output.buildings,
              materials,
              flatMaterials.materialFor('wall', 'palette:#ffffff'),
              options.lodPolicy,
              `${name}:buildings`,
              512,
              output.buildingCells,
            )
          : buffersToObject3D(output.buildings, materials, `${name}:buildings`),
      );
    for (const set of output.placements) {
      if (set.modelRef !== 'builtin:box') continue;
      group.add(
        createInstancedPlacements(
          set,
          unitBoxGeometry(),
          materials.materialFor('wall', 'palette:#ffffff'),
          `${name}:boxes`,
        ),
      );
    }
    for (const object of await instancedProps(output.placements, context, name)) group.add(object);
    return group;
  }

  function registerInteriors(
    root: THREE.Object3D,
    output: WorldgenTileOutput,
    context: TerrainPyramidTileLayerContext,
  ): void {
    interiors?.register(
      root,
      output.records.flatMap((r) => (r.interior ? [r.interior] : [])),
      [context.origin[0], context.origin[1]],
    );
  }

  // One replacement at a time bounds extra memory and worker pressure. Quality changes and
  // tile eviction cancel pending work; the displayed architecture survives until the swap.
  async function rebuildResidents(): Promise<void> {
    if (rebuilding) return;
    rebuilding = true;
    try {
      for (;;) {
        const entry = [...residents].find(([, resident]) => resident.quality !== quality);
        if (!entry) break;
        const [root, resident] = entry;
        const preset = quality;
        const controller = new AbortController();
        resident.pending = controller;
        const context = { ...resident.context, signal: controller.signal };
        let replacement: THREE.Group | undefined;
        try {
          const generated = await generate(
            resident.tile,
            context,
            { buildings: true, scatter: false },
            preset,
          );
          if (!generated) {
            if (!controller.signal.aborted) resident.quality = preset;
            continue;
          }
          if (controller.signal.aborted) continue;
          replacement = await assembleBuildings(generated.output, context, root.name);
          if (controller.signal.aborted || !residents.has(root) || preset !== quality) continue;
          await options.prepareObject?.(replacement, controller.signal);
          const publish = (): void => {
            if (
              controller.signal.aborted ||
              !residents.has(root) ||
              preset !== quality ||
              !replacement
            )
              return;
            interiors?.unregister(resident.architecture);
            disposeWorldgenObject(resident.architecture);
            resident.architecture.removeFromParent();
            root.add(replacement);
            resident.architecture = replacement;
            resident.quality = preset;
            registerInteriors(replacement, generated.output, context);
            replacement = undefined;
          };
          if (context.admission)
            await context.admission.run(publish, {
              signal: controller.signal,
              label: 'building-quality-publication',
            });
          else publish();
        } catch (error) {
          if (!controller.signal.aborted) {
            resident.quality = preset; // retry on the next preset change, not every frame
            console.warn('[molen] building quality update failed:', error);
          }
        } finally {
          if (replacement) disposeWorldgenObject(replacement);
          delete resident.pending;
        }
      }
    } finally {
      rebuilding = false;
    }
  }

  const humanFeatures: TerrainSemanticTileRenderer = {
    async createTile(tile: TerrainSemanticTile, context): Promise<THREE.Object3D | undefined> {
      if (context.signal.aborted || disposed) return undefined;
      const group = new THREE.Group();
      group.name = `worldgen:${context.address.level}/${context.address.x}/${context.address.z}`;
      try {
        // Roads and buildings have independent worker queues. Start both before waiting, and
        // settle both so a late road result cannot leak geometry after the building job fails.
        const preset = quality;
        const buildingsTask = generate(tile, context, { buildings: true, scatter: false }, preset);
        const roadsTask = (async (): Promise<THREE.Object3D | undefined> => {
          if (options.roads?.surfaceRenderer && options.roads.renderTransportation !== false) {
            return options.roads.surfaceRenderer.createTileAsync(tile, context);
          }
          return createTerrainSemanticObject(tile, context, {
            ...options.roads,
            renderLandcover: false,
            renderWater: false,
            renderBuildings: false,
          });
        })();
        const [roads, generated] = await Promise.allSettled([roadsTask, buildingsTask]);
        if (roads.status === 'fulfilled' && roads.value) group.add(roads.value);
        if (roads.status === 'rejected') throw roads.reason;
        if (generated.status === 'rejected') throw generated.reason;
        if (context.signal.aborted || disposed || generated.value === undefined) {
          disposeTerrainSemanticObject(group);
          return undefined;
        }
        const { output } = generated.value;
        const architecture = await assembleBuildings(output, context, group.name);
        group.add(architecture);
        if (context.signal.aborted || disposed) {
          disposeTerrainSemanticObject(group);
          disposeWorldgenObject(group);
          return undefined;
        }
        stats.buildings += output.stats.buildingsRendered;
        registerInteriors(architecture, output, context);
        residents.set(group, { tile, context, architecture, quality: preset });
        void rebuildResidents();
        stats.boxes += output.stats.buildingsBoxed;
        stats.skippedByOwnership += output.skippedByOwnership;
        stats.geometryBytes += output.stats.meshBytes + output.stats.instanceBytes;
        return group;
      } catch (error) {
        disposeTerrainSemanticObject(group);
        disposeWorldgenObject(group);
        throw error;
      }
    },
    disposeTile(object: THREE.Object3D): void {
      const resident = residents.get(object);
      if (resident) {
        resident.pending?.abort();
        interiors?.unregister(resident.architecture);
        residents.delete(object);
      }
      disposeTerrainSemanticObject(object);
      disposeWorldgenObject(object);
    },
  };
  const classification: TerrainSemanticTileRenderer = {
    async createTile(tile: TerrainSemanticTile, context): Promise<THREE.Object3D | undefined> {
      const colors = surfaceColors(pack, defaultScatterId);
      const meshOptions: TerrainSemanticMeshOptions = {
        ...(colors !== undefined ? { landcoverColors: colors } : {}),
        ...(models !== undefined ? { maxTreesPerTile: 0 } : {}),
        ...options.landcover,
        renderWater: false,
        renderTransportation: false,
        renderBuildings: false,
      };
      const useSurfaceWorker =
        options.landcoverGenerator !== undefined &&
        meshOptions.renderLandcover !== false &&
        meshOptions.renderLandcoverSurface !== false;
      const surface = createTerrainSemanticObject(tile, context, {
        ...meshOptions,
        ...(useSurfaceWorker ? { renderLandcoverSurface: false } : {}),
      });
      try {
        if (useSurfaceWorker) {
          const mesh = await options.landcoverGenerator?.generate(tile, context, meshOptions);
          if (mesh) surface.add(mesh);
        }
        if (context.signal.aborted) {
          disposeTerrainSemanticObject(surface);
          return undefined;
        }
      } catch (error) {
        disposeTerrainSemanticObject(surface);
        throw error;
      }
      if (models === undefined) return surface;
      const group = new THREE.Group();
      group.name = `worldgen-scatter:${context.address.level}/${context.address.x}/${context.address.z}`;
      group.add(surface);
      try {
        const generated = await generate(tile, context, { buildings: false, scatter: true });
        if (generated !== undefined) {
          for (const object of await instancedProps(
            generated.output.placements,
            context,
            group.name,
          )) {
            group.add(object);
          }
          if (!context.signal.aborted) return group;
        }
        disposeTerrainSemanticObject(group);
        disposeWorldgenObject(group);
        return undefined;
      } catch (error) {
        disposeTerrainSemanticObject(group);
        disposeWorldgenObject(group);
        throw error;
      }
    },
    disposeTile(object: THREE.Object3D): void {
      disposeTerrainSemanticObject(object);
      disposeWorldgenObject(object);
    },
  };

  return {
    classification,
    humanFeatures,
    updateInteriors: (position): void => interiors?.update(position),
    setQuality(next): void {
      if (quality === next) return;
      quality = next;
      for (const resident of residents.values()) resident.pending?.abort();
      void rebuildResidents();
    },
    setCacheBudget(maxBytes): void {
      cache?.setLimits({ maxBytes });
    },
    stats: () => ({
      ...stats,
      ...(interiors ? { interiors: interiors.stats() } : {}),
      generateMs: { ...stats.generateMs },
      ...(cache !== undefined
        ? {
            cache: { hits: cache.hits, misses: cache.misses, size: cache.size, bytes: cache.bytes },
          }
        : {}),
    }),
    dispose(): void {
      disposed = true;
      for (const resident of residents.values()) resident.pending?.abort();
      residents.clear();
      interiors?.dispose();
      if (ownsMaterials) materials.dispose?.();
      flatMaterials?.dispose?.();
      if (ownsGenerator) base.dispose();
    },
  };
}

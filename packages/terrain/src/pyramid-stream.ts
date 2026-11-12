/**
 * Camera-driven terrain-pyramid selection and residency.
 *
 * This module has no geographic or archive assumptions. It selects square planar tiles by
 * projected sample spacing, requests ancestors before descendants, and keeps an ancestor visible
 * until replacements for its visible layers are prepared. Detailed tiles refine in small
 * families; bare surfaces need not wait for newly requested detail across an entire region.
 */

import type { SceneAdmission } from '@bendyline/molen-client';
import * as THREE from 'three';
import type { TerrainDescriptor } from './descriptor-types';
import {
  markTerrainGroundCutScope,
  markTerrainGroundSurface,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from './ground-cutout';
import type { Heightfield } from './heightfield';
import {
  buildChunkGeometry,
  type ChunkEdge,
  type ChunkGeometry,
  neighborTileIndices,
  refreshChunkEdgeNormals,
  type TerrainNeighborHeightSampler,
} from './mesh';
import { TerrainCameraTrack } from './pyramid-motion';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidAddressAt,
  terrainPyramidAncestor,
  terrainPyramidParent,
  terrainPyramidTileCount,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from './pyramid-types';
import type { TerrainQualityPreset, TerrainStreamStats, TerrainTileLayerCategory } from './stream';
import {
  applySurfaceHeightMorph,
  prepareSurfaceHeightMorph,
  type SurfaceHeightMorph,
} from './surface-morph';
import {
  loadTerrainTileWithTimeout,
  resolveTerrainTileRetryPolicy,
  type TerrainTileFailure,
  type TerrainTileRetryOptions,
  type TerrainTileRetryPolicy,
  TerrainTileRetryTracker,
} from './tile-retry';

export interface TerrainPyramidView {
  position: [number, number, number];
  /** Perspective camera vertical field of view, in radians. */
  verticalFov: number;
  viewportHeight: number;
  /** Optional normalized or unnormalized camera forward vector for horizontal view culling. */
  direction?: [number, number, number];
  /** Viewport width / height. Required only when direction-aware culling is desired. */
  aspect?: number;
}

export interface TerrainPyramidSelectionOptions {
  /** Previous selection supplies a stable coarsening threshold while moving. */
  previousTiles?: readonly TerrainPyramidTileAddress[];
  hysteresis?: number;
  /** Maximum projected source-sample spacing before a tile refines. */
  maxScreenSpaceError: number;
  /** Radial world-space limit around the camera. */
  viewDistance: number;
  /** Selection ceiling; the selector raises error and then shortens range if needed. */
  maxSelectedTiles: number;
  /** The finest level to refine to, when it should stop short of the descriptor's. */
  maxLevel?: number;
  /**
   * How far past `maxScreenSpaceError` a tile's error must go before it refines into its
   * children, as a multiple of it (1 or more; default 1). Above 1 that detail reaches less far
   * from the camera: a fast camera keeps its finest levels around itself, rather than giving
   * them up or building them across the whole view.
   */
  refineScale?: (tile: TerrainPyramidTileAddress) => number;
  /**
   * The ground heights a tile really holds, when known (a tile without any inherits its nearest
   * known ancestor's). Without it a tile can reach anywhere in the descriptor's height range, and
   * a camera inside that range measures no height above the ground: an aircraft at 3 km over a
   * package whose range reaches 5 km refines the land beneath it as if it stood there.
   */
  tileHeight?: (address: TerrainPyramidTileAddress) => { min: number; max: number } | undefined;
  /**
   * Degrees beyond the camera's horizontal view (and its small guard band) where ground stays
   * selected at reduced detail, so turning the camera reveals terrain and layers that are already
   * built rather than empty ground (default 0).
   */
  peripheralDegrees?: number;
  /**
   * Error weight of peripheral tiles, in (0, 1] (default 0.4): they refine only while their
   * weighted error exceeds the budget, so they stay a level or two coarser than the view.
   */
  peripheralDetail?: number;
  /**
   * Error weight of ground everywhere else round the camera, in (0, 1] (default: none, so that
   * ground is not selected at all). A camera can look round faster than ground can load: a
   * quarter turn in a third of a second, against seconds for a tile and its layers. With a
   * small weight (0.1 or so) the whole circle stays selected several levels coarser than the
   * view, with the layers of `independentLayers` on it, so a look to the side shows coarse
   * finished ground that refines rather than bare ground that fills in.
   */
  surroundDetail?: number;
  /** How far round the camera `surroundDetail` reaches, world units (default: `viewDistance`). */
  surroundDistance?: number;
}

export interface TerrainPyramidSelection {
  tiles: TerrainPyramidTileAddress[];
  effectiveScreenSpaceError: number;
  effectiveViewDistance: number;
}

export interface TerrainPyramidHeightSource {
  load(address: TerrainPyramidTileAddress, signal: AbortSignal): Promise<Heightfield | undefined>;
  loadPrepared?(
    address: TerrainPyramidTileAddress,
    signal: AbortSignal,
    maxResolution: number,
  ): Promise<{ heightfield: Heightfield; geometry: ChunkGeometry } | undefined>;
  /**
   * Mesh a field this source did not produce, a `transformHeightfield` replacement, the way
   * `loadPrepared` meshes its own (the elevation worker's source does it off the main thread).
   * Undefined leaves the stream to mesh the field itself.
   */
  meshPrepared?(
    heightfield: Heightfield,
    address: TerrainPyramidTileAddress,
    signal: AbortSignal,
    maxResolution: number,
  ): Promise<ChunkGeometry | undefined>;
  dispose?(): void;
}

export interface TerrainPyramidTileLayerContext {
  admission?: SceneAdmission;
  address: TerrainPyramidTileAddress;
  pyramid: TerrainPyramidDescriptor;
  /** Fixed-grid view of this address, useful for generic terrain mesh/decorator code. */
  descriptor: TerrainDescriptor;
  heightfield: Heightfield;
  /** Actual rendered grid vertices per edge, after the quality cap. */
  surfaceResolution?: number;
  /** Returned objects use tile-local X/Z coordinates and world-space Y heights. */
  origin: [number, number];
  tileSize: number;
  signal: AbortSignal;
  /**
   * How soon the current view needs this tile, lower first, read again each time it is asked
   * (meters from the camera, ground outside the view after ground in it). A worker queue picks
   * its next job by it: a fast camera reorders the view while tiles wait their turn, and in
   * request order a jet's nearest ground queued behind ground it had already passed.
   */
  priority?: () => number;
}

/**
 * Per-tile content drawn over the terrain. A published object's transforms are frozen
 * (`matrixAutoUpdate = false`) because tile content is static; mark a part that moves with
 * `userData.dynamicTransform = true`, or call `updateMatrix()` after moving it.
 */
export interface TerrainPyramidTileLayer {
  id: string;
  category: TerrainTileLayerCategory;
  visible?: boolean;
  /** Inclusive detail-level bounds. Coarse fallback tiles outside them remain surface-only. */
  minLevel?: number;
  maxLevel?: number;
  createTile(
    context: TerrainPyramidTileLayerContext,
  ): THREE.Object3D | undefined | Promise<THREE.Object3D | undefined>;
  disposeTile?(object: THREE.Object3D): void;
}

export interface TerrainPyramidStreamErrorContext {
  address: TerrainPyramidTileAddress;
  layerId?: string;
}

export interface TerrainPyramidStreamOptions
  extends TerrainPyramidSelectionOptions,
    TerrainTileRetryOptions {
  /** Optional refinement height morph for bare surfaces. Grounded layers retain atomic handoff. */
  morphMilliseconds?: number;
  /**
   * Layer categories built for ground outside the view as well (the peripheral band and the
   * surround) and shown as soon as each is ready, rather than together with the tile's other
   * layers. Default `['hydrology']`. A host whose land cover is the ground's color adds
   * `'classification'`: without it, ground the camera turns to face is bare until every layer
   * of its tile has been built, and reads as a hole in the world. Handoffs between levels are
   * unchanged: a replacement still waits for every layer its predecessor shows.
   */
  independentLayers?: readonly TerrainTileLayerCategory[];
  /**
   * Sun shadows: every tile surface and layer mesh receives them, and layer meshes standing
   * taller than `shadowCasterHeight` meters (default 1.5: buildings, trees, landmarks) cast
   * them; flat roads and landcover do not. A layer part can opt in or out explicitly with
   * `userData.shadowCaster` = true or false (inherited by its children), and out of receiving
   * with `userData.shadowReceiver = false` (water does).
   */
  shadows?: boolean;
  shadowCasterHeight?: number;
  /** Shared frame budget for construction/publication, also passed to semantic adapters. */
  admission?: SceneAdmission;
  /**
   * Prepare GPU resources before publication. `parent` is the tile group a layer object will
   * join, so a renderer can prepare the LOD levels the camera will see first.
   */
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent?: THREE.Object3D,
  ) => Promise<void>;
  /** Optional renderer-owned tile group, e.g. a managed WebGPU render-command cache. */
  createTileGroup?: () => THREE.Group;
  material?: THREE.Material;
  /** Optional spatial color prior, applied once before upload to both worker and local meshes. */
  surfaceColor?: TerrainSurfaceColor;
  /**
   * Grade source heights before publishing terrain or creating layers. Return the original
   * field when unchanged to retain worker-prepared geometry. A replacement is meshed again (by
   * the source's `meshPrepared` when it has one, otherwise on the main thread) and becomes the
   * field shared by surface sampling and every layer. `source` is unmodified, for stable
   * reference samples; work must respect the context's cancellation signal.
   */
  transformHeightfield?: (
    context: TerrainPyramidTileLayerContext,
    source: TerrainPyramidHeightSource,
  ) => Heightfield | Promise<Heightfield>;
  layers?: TerrainPyramidTileLayer[];
  /** Maximum vertices along one surface-tile edge; height sampling remains full resolution. */
  maxSurfaceTileResolution?: number;
  maxConcurrentLoads: number;
  /** Independent ceiling for semantic tile decodes and mesh construction. */
  maxConcurrentLayerLoads?: number;
  /** Layer generation/GPU preparation deadline, default 120000 ms; 0 or Infinity disables. */
  layerTimeoutMs?: number;
  maxResidentTiles: number;
  /** Soft resident height/geometry byte cap; displayed coverage is never removed to meet it. */
  maxResidentBytes?: number | undefined;
  initialView?: TerrainPyramidView;
  /**
   * Build ahead of a moving camera (on by default). The stream follows the camera's track through
   * `update`, so it works for anything that moves it: a car, an aircraft, an orbit pan.
   */
  lookAhead?: TerrainPyramidLookAheadOptions | false;
  /** Clock for the camera's track, ms (default `performance.now`). */
  now?: () => number;
  onError?: (error: unknown, context: TerrainPyramidStreamErrorContext) => void;
  /** Where each finished layer's time went, for a host's diagnostics. */
  onLayerTiming?: (sample: TerrainPyramidLayerTiming) => void;
}

/**
 * How far ahead of a moving camera tiles are built. Tiles the track reaches are built while the
 * stream has capacity beyond what the camera sees now, and stay hidden until selected, so they
 * appear finished. They are the first thing given up under memory pressure.
 */
export interface TerrainPyramidLookAheadOptions {
  /** Times along the predicted track to select tiles for (default 3, 6, 12 and 20 seconds). */
  seconds?: readonly number[];
  /** Most tiles tracked ahead of the camera (default the budget's `maxSelectedTiles`). */
  maxTiles?: number;
  /**
   * Levels whose tiles the camera crosses in less than this keep their detail only near the
   * camera (default 5 seconds; 0 turns it off). Each level finer is four times the tiles for the
   * same ground, so a fast camera that refined its whole view to the finest level would build
   * far more than the stream can finish, and finish little of it.
   */
  minTileSeconds?: number;
  /**
   * How much of the work of one full-detail level each of those faster levels may take, in
   * [0, 1] (default 0.25). The faster the camera crosses a level, the nearer it its detail stops.
   * This limits building only: finer ground already built stays while the view would show it
   * at rest, so speeding up or turning does not take detail off the screen. 0 builds none.
   */
  fastDetail?: number;
}

/** One layer build, by phase, in milliseconds. */
export interface TerrainPyramidLayerTiming {
  layerId: string;
  level: number;
  /** Generating the object: reading its source, worker time, and scene assembly. */
  createMs: number;
  /** GPU preparation: uploads and shaders, which run in the frame budget. */
  prepareMs: number;
  /** Waiting for a frame to publish it. */
  publishMs: number;
}

/** World coordinates and slope, with linear RGB. Undefined preserves the package palette. */
export type TerrainSurfaceColor = ((
  x: number,
  y: number,
  z: number,
  slope: number,
  base: readonly [number, number, number],
) => readonly [number, number, number] | undefined) & {
  /**
   * The same coloring for a whole tile in one call: `positions` and `normals` are tile-local
   * (add `originX`/`originZ` for the world X/Z the callback receives) and `colors` holds the base
   * colors, replaced in place. Called per vertex, a tile's quarter of a million arguments were
   * each boxed: a third of the main thread's allocations in a fast flight at High detail.
   */
  colorTile?(
    positions: Float32Array,
    normals: Float32Array,
    colors: Float32Array,
    originX: number,
    originZ: number,
  ): void;
};

export interface TerrainPyramidStreamStats extends TerrainStreamStats {
  /** Future-view leaves requested for hidden preparation, within the resident budget. */
  preloading: number;
  /** Future-view leaves with terrain and all enabled layers prepared for display. */
  preloaded: number;
  /** Semantic layer requests that exhausted their retry budget and wait out a cool-down. */
  failedLayers: number;
  /** Semantic layer requests waiting for or performing another attempt. */
  retryingLayers: number;
  selected: number;
  displayed: number;
  fallbackLeaves: number;
  minDisplayedLevel: number | undefined;
  maxDisplayedLevel: number | undefined;
  effectiveScreenSpaceError: number;
  effectiveViewDistance: number;
  /** Terrain surfaces built so far, and how many of those had been built before and evicted. */
  builtTiles: number;
  rebuiltTiles: number;
  /** Tile layers built so far, and how many of those had been built before and evicted. */
  builtLayers: number;
  rebuiltLayers: number;
  /**
   * Of `builtLayers`, those `refreshLayers` built in place of one on screen. A host asked for
   * these: they are not the cache losing work, and `rebuiltLayers` does not count them.
   */
  refreshedLayers: number;
  /** Tile layers on screen still showing what a `refreshLayers` call is replacing. */
  refreshingLayers: number;
  /** Tiles the camera's track is about to reach that are not selected yet. */
  aheadTiles: number;
  /** Those of `aheadTiles` already built, layers included. */
  aheadReady: number;
  /** The camera's speed along its track, world units per second. */
  cameraSpeed: number;
  /**
   * The finest level refined across the whole view at that speed; finer levels refine only near
   * the camera (`lookAhead.fastDetail`).
   */
  speedLevel: number;
  /**
   * Times ground in the camera's view changed level so far: replaced by finer tiles, and by
   * coarser ones. Detail arriving is the point of streaming; detail given up while in view
   * reads as popping.
   */
  refinedInView: number;
  coarsenedInView: number;
}

/** How finished the view is within one distance band; see `TerrainPyramidStream.viewCoverage`. */
export interface TerrainPyramidCoverageBand {
  /** Band limits in world units from the camera; the last band's `to` is Infinity. */
  from: number;
  to: number;
  /** In-view selected tiles in the band. */
  tiles: number;
  /** Drawn at their selected detail, with every layer. */
  complete: number;
  /** Drawn from another level's tiles that carry layers. */
  stale: number;
  /** Terrain drawn, with layers still missing. */
  bare: number;
  /** Nothing drawn. */
  empty: number;
  /**
   * Mean level of the ground drawn over the band's selected tiles, weighted by area; undefined
   * when nothing is drawn. `complete` is measured against the selection, which coarsens at speed,
   * so it reads the same for coarse and fine ground; this says how fine the ground is.
   */
  drawnLevel: number | undefined;
}

export interface TerrainPyramidStatsOptions {
  /**
   * `'measured'` (the default) walks every resident tile's objects for byte totals, so it also
   * finds geometry an adapter added without calling `refreshMemoryUsage()`. `'tracked'` reports
   * the retained estimate `pressure()` keeps and counts triangles, draws and instances among
   * visible objects only. The full walk took several milliseconds over a warm cache; a panel
   * refreshing a few times a second stalled a frame each time.
   */
  geometry?: 'measured' | 'tracked';
}

/** What `TerrainPyramidStream.refreshLayers` builds again. */
export interface TerrainPyramidLayerRefresh {
  /** World X/Z rectangle [minX, minZ, maxX, maxZ]: every resident tile it overlaps or touches. */
  bounds: readonly [number, number, number, number];
  /** Layer ids to build again (default: every layer). An unknown id throws. */
  layers?: readonly string[];
}

export interface TerrainPyramidStream {
  /**
   * Call once a frame: advances refinement morphs and carries on ground cuts the last pass left
   * unfinished, within one cut budget a frame shared with `update`.
   */
  updateTransitions(nowMs?: number): void;
  /**
   * The root of every tile. Its transform does not update itself each frame (that would dirty
   * every tile's world matrix); after moving it, call `object.updateMatrix()`.
   */
  readonly object: THREE.Group;
  /**
   * Optional future views prepare a bounded set of leaves, including layers and GPU resources,
   * without changing displayed coverage. Supply nearest-in-time views first; omit to stop.
   */
  update(view: TerrainPyramidView, preloadViews?: readonly TerrainPyramidView[]): void;
  /** Replan in place. Surface resolution affects newly loaded tiles, preserving resident draping. */
  setBudget(budget: Partial<TerrainPyramidBudget>): void;
  getBudget(): TerrainPyramidBudget;
  /** Constant-time retained allocation estimates for an adaptive quality controller. */
  pressure(): TerrainPyramidStreamPressure;
  /**
   * Refresh retained allocation estimates after an adapter mutates resident layer geometry.
   * `'displayed'` re-counts only tiles on screen, where an adapter's in-place updates land:
   * re-counting the whole warm cache walked every resident tile's objects.
   */
  refreshMemoryUsage(tiles?: 'all' | 'displayed'): void;
  /**
   * Full-resolution source elevation before mesh simplification, preferring displayed tiles
   * and falling back to resident coverage outside the camera's cut.
   */
  sampleHeight(x: number, z: number): number | undefined;
  /**
   * Height on the displayed terrain triangles, including refinement morphs. Use for movement
   * and ground placement, with resident coverage as a fallback outside the camera's cut.
   * Roads, land cover and model-owned openings still need collision queries.
   */
  sampleSurfaceHeight(x: number, z: number): number | undefined;
  /**
   * True when the view's terrain and enabled layers within `radius` of (x, z) are on screen:
   * every selected tile there is displayed with its layers published (a layer that failed for
   * good does not hold it back), none of them still showing what a `refreshLayers` call is
   * replacing. Loads elsewhere in the view do not count, so a host can act on the ground around
   * a point, such as landing a walker, while the rest of the view streams in.
   */
  isAreaReady(x: number, z: number, radius: number): boolean;
  setLayerVisible(id: string, visible: boolean): void;
  isLayerVisible(id: string): boolean;
  residentTiles(): TerrainPyramidTileAddress[];
  displayedTiles(): TerrainPyramidTileAddress[];
  /** Tiles outside the quick retries: missing plus abandoned (see `failedRetryDelayMs`). */
  failedTiles(): TerrainPyramidTileAddress[];
  /** Per-tile missing/retrying/abandoned detail, so a host can say which state a hole is in. */
  tileFailures(): Array<TerrainTileFailure<TerrainPyramidTileAddress>>;
  retryFailed(): void;
  /**
   * Build layers again where what they are made from changed (a host edited the tiles a layer's
   * source or renderer hands out). A layer on screen stays until its replacement is prepared and
   * takes its place in one step, so the ground never stands bare in between; one that is resident
   * but hidden is dropped and built when next wanted; a build under way starts over. `isAreaReady`
   * is false for ground still showing what is being replaced.
   *
   * Resolves when everything that was on screen has been replaced, or will not be: its tile was
   * evicted, it left the screen or its layer was hidden, or its build failed for good (what was
   * there then stays until a later attempt succeeds). `whenIdle` also waits for these builds.
   */
  refreshLayers(options: TerrainPyramidLayerRefresh): Promise<void>;
  /**
   * Full counters, including triangle and byte totals gathered by walking every resident tile's
   * objects: for diagnostics, not every frame. Per-frame callers use `loading()`, and a live
   * diagnostics panel passes `{ geometry: 'tracked' }`.
   */
  stats(options?: TerrainPyramidStatsOptions): TerrainPyramidStreamStats;
  /** Tiles and layers loading now, in constant time. */
  loading(): { tiles: number; layers: number };
  /**
   * What the camera sees right now, by distance: `edges` are ascending band limits in world units.
   * Walks the selection, so sample it a few times a second at most.
   */
  viewCoverage(edges: readonly number[]): TerrainPyramidCoverageBand[];
  whenIdle(): Promise<void>;
  dispose(): void;
}

export interface TerrainPyramidBudget extends TerrainPyramidSelectionOptions {
  maxSurfaceTileResolution: number;
  maxConcurrentLoads: number;
  maxConcurrentLayerLoads: number;
  maxResidentTiles: number;
  /** Soft cap on retained height/geometry buffers; excludes textures, source caches and GPU copies. */
  maxResidentBytes?: number | undefined;
}

export interface TerrainPyramidStreamPressure {
  residentTiles: number;
  residentBytes: number;
  /** Retained height/geometry allocations belonging to currently displayed tiles. */
  displayedBytes: number;
  /** Displayed bytes / cap, excluding reclaimable hidden cache; zero when no cap is set. */
  displayedByteRatio: number;
  geometryBytes: number;
  decodedHeightBytes: number;
  maxResidentTiles: number;
  maxResidentBytes: number | undefined;
  tileRatio: number;
  /** Zero when no byte cap is configured. Shared geometries count conservatively per tile. */
  byteRatio: number;
  overBudget: boolean;
}

/** Portable adaptive-terrain budgets expressed as measurable limits. */
export function terrainPyramidBudgetForQuality(
  quality: TerrainQualityPreset,
): TerrainPyramidBudget {
  switch (quality) {
    case 'economy':
      return {
        maxScreenSpaceError: 5,
        viewDistance: 40_000,
        maxSelectedTiles: 32,
        maxSurfaceTileResolution: 33,
        maxConcurrentLoads: 2,
        maxConcurrentLayerLoads: 2,
        maxResidentTiles: 96,
      };
    case 'balanced':
      return {
        maxScreenSpaceError: 3,
        viewDistance: 70_000,
        maxSelectedTiles: 64,
        maxSurfaceTileResolution: 65,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxResidentTiles: 192,
      };
    case 'high':
      return {
        maxScreenSpaceError: 1.75,
        viewDistance: 110_000,
        maxSelectedTiles: 128,
        maxSurfaceTileResolution: 129,
        maxConcurrentLoads: 8,
        // High builds the most layer work per tile; eight in flight keep a host's worker pools
        // (worldgen, land cover, surfaces) busy rather than queued behind one another.
        maxConcurrentLayerLoads: 8,
        maxResidentTiles: 320,
      };
  }
}

function requireDescriptor(descriptor: TerrainPyramidDescriptor): void {
  if (!Number.isFinite(descriptor.rootSize) || descriptor.rootSize <= 0) {
    throw new Error('terrain pyramid rootSize must be finite and positive');
  }
  if (
    !Number.isSafeInteger(descriptor.minLevel) ||
    !Number.isSafeInteger(descriptor.maxLevel) ||
    descriptor.minLevel < 0 ||
    descriptor.maxLevel > 30 ||
    descriptor.minLevel > descriptor.maxLevel
  ) {
    throw new Error('terrain pyramid levels must be ordered safe integers from 0 through 30');
  }
  if (!Number.isSafeInteger(descriptor.tileResolution) || descriptor.tileResolution < 2) {
    throw new Error('terrain pyramid tileResolution must be a safe integer of at least 2');
  }
  if (!descriptor.origin.every(Number.isFinite)) {
    throw new Error('terrain pyramid origin must be finite');
  }
  if (
    !Number.isFinite(descriptor.height.min) ||
    !Number.isFinite(descriptor.height.max) ||
    descriptor.height.min >= descriptor.height.max
  ) {
    throw new Error('terrain pyramid height range must be finite and increasing');
  }
}

function requireView(view: TerrainPyramidView): void {
  if (!view.position.every(Number.isFinite)) {
    throw new Error('terrain pyramid camera position must be finite');
  }
  if (!Number.isFinite(view.verticalFov) || view.verticalFov <= 0 || view.verticalFov >= Math.PI) {
    throw new Error('terrain pyramid verticalFov must be between 0 and pi radians');
  }
  if (!Number.isFinite(view.viewportHeight) || view.viewportHeight <= 0) {
    throw new Error('terrain pyramid viewportHeight must be finite and positive');
  }
  if (view.direction !== undefined) {
    if (!view.direction.every(Number.isFinite) || Math.hypot(...view.direction) === 0) {
      throw new Error('terrain pyramid direction must be a finite non-zero vector');
    }
    if (!Number.isFinite(view.aspect) || (view.aspect as number) <= 0) {
      throw new Error('terrain pyramid aspect must be finite and positive when direction is set');
    }
  }
}

function requireSelectionOptions(options: TerrainPyramidSelectionOptions): void {
  if (!Number.isFinite(options.maxScreenSpaceError) || options.maxScreenSpaceError <= 0) {
    throw new Error('terrain pyramid maxScreenSpaceError must be finite and positive');
  }
  if (!Number.isFinite(options.viewDistance) || options.viewDistance <= 0) {
    throw new Error('terrain pyramid viewDistance must be finite and positive');
  }
  if (!Number.isSafeInteger(options.maxSelectedTiles) || options.maxSelectedTiles < 1) {
    throw new Error('terrain pyramid maxSelectedTiles must be a positive safe integer');
  }
  if (
    options.peripheralDegrees !== undefined &&
    (!Number.isFinite(options.peripheralDegrees) ||
      options.peripheralDegrees < 0 ||
      options.peripheralDegrees > 180)
  ) {
    throw new Error('terrain pyramid peripheralDegrees must be between 0 and 180');
  }
  if (
    options.peripheralDetail !== undefined &&
    (!Number.isFinite(options.peripheralDetail) ||
      options.peripheralDetail <= 0 ||
      options.peripheralDetail > 1)
  ) {
    throw new Error('terrain pyramid peripheralDetail must be in (0, 1]');
  }
  if (
    options.surroundDetail !== undefined &&
    (!Number.isFinite(options.surroundDetail) ||
      options.surroundDetail <= 0 ||
      options.surroundDetail > 1)
  ) {
    throw new Error('terrain pyramid surroundDetail must be in (0, 1]');
  }
  if (
    options.surroundDistance !== undefined &&
    (!Number.isFinite(options.surroundDistance) || options.surroundDistance <= 0)
  ) {
    throw new Error('terrain pyramid surroundDistance must be finite and positive');
  }
}

function requireBudget(budget: TerrainPyramidBudget): void {
  requireSelectionOptions(budget);
  for (const name of [
    'maxConcurrentLoads',
    'maxConcurrentLayerLoads',
    'maxResidentTiles',
  ] as const) {
    if (!Number.isSafeInteger(budget[name]) || budget[name] < 1) {
      throw new Error(`terrain pyramid ${name} must be a positive safe integer`);
    }
  }
  if (
    !Number.isSafeInteger(budget.maxSurfaceTileResolution) ||
    budget.maxSurfaceTileResolution < 2
  ) {
    throw new Error(
      'terrain pyramid maxSurfaceTileResolution must be a safe integer of at least 2',
    );
  }
  if (budget.maxResidentTiles < budget.maxSelectedTiles * 2) {
    throw new Error(
      'terrain pyramid maxResidentTiles must be at least twice maxSelectedTiles for parent-safe refinement',
    );
  }
  if (
    budget.maxResidentBytes !== undefined &&
    (!Number.isSafeInteger(budget.maxResidentBytes) || budget.maxResidentBytes < 1)
  ) {
    throw new Error('terrain pyramid maxResidentBytes must be a positive safe integer');
  }
}

function tileBounds(
  descriptor: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
): [number, number, number, number] {
  const size = descriptor.rootSize / 2 ** address.level;
  const minX = descriptor.origin[0] + address.x * size;
  const minZ = descriptor.origin[1] + address.z * size;
  return [minX, minZ, minX + size, minZ + size];
}

function boxesIntersect(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function distanceToBounds(
  position: [number, number, number],
  bounds: [number, number, number, number],
  height: { min: number; max: number },
): number {
  const dx = Math.max(bounds[0] - position[0], 0, position[0] - bounds[2]);
  const dz = Math.max(bounds[1] - position[2], 0, position[2] - bounds[3]);
  const dy = Math.max(height.min - position[1], 0, position[1] - height.max);
  return Math.hypot(dx, dy, dz);
}

/**
 * Main-thread time (ms) the visibility passes of one frame spend on new ground cuts: the frame's
 * own pass (each stream update renews the budget) and the passes tiles request before the next
 * one (see requestVisibility). Each taking a full budget held frames past 50 ms while panning
 * low over a city.
 */
const CUT_BUDGET_MS = 4;
/** Without stream updates (no frames: a hidden page, a test), the budget renews this often. */
const CUT_IDLE_WINDOW_MS = 100;
/**
 * The budget renews at most this often (a frame at 120 Hz): the stream's update and the frame's
 * transitions (see updateTransitions) share one budget a frame, whichever renews it first.
 */
const CUT_FRAME_MS = 8;
/** Added to a layer job's priority outside the view: farther than any ground in it. */
const OUT_OF_VIEW_PRIORITY = 1e9;

const VIEW_GUARD_RADIANS = THREE.MathUtils.degToRad(12);

const cones = new WeakMap<
  TerrainPyramidView,
  { forwardLength: number; horizontalFov: number } | undefined
>();
/**
 * The view's horizontal cone, or undefined when it covers every azimuth. It depends on the view
 * alone, and a selection tests hundreds of tiles against one view (and a view and its predicted
 * future views five times every update): computed once per view, not per tile.
 */
function horizontalCone(
  view: TerrainPyramidView,
): { forwardLength: number; horizontalFov: number } | undefined {
  if (cones.has(view)) return cones.get(view);
  let cone: { forwardLength: number; horizontalFov: number } | undefined;
  const direction = view.direction as [number, number, number];
  const forwardLength = Math.hypot(direction[0], direction[2]);
  if (forwardLength >= 1e-6) {
    // A circular cone enclosing the rectangular frustum is conservative for pitch and roll.
    // If it includes nadir/zenith, its horizontal projection covers every azimuth.
    const diagonalHalfFov = Math.atan(
      Math.tan(view.verticalFov / 2) * Math.hypot(1, view.aspect as number),
    );
    const cosPitch = forwardLength / Math.hypot(...direction);
    if (Math.sin(diagonalHalfFov) < cosPitch)
      cone = {
        forwardLength,
        horizontalFov: 2 * Math.asin(Math.min(1, Math.sin(diagonalHalfFov) / cosPitch)),
      };
  }
  cones.set(view, cone);
  return cone;
}

function intersectsHorizontalView(
  view: TerrainPyramidView,
  bounds: [number, number, number, number],
  guardRadians = VIEW_GUARD_RADIANS,
): boolean {
  if (view.direction === undefined || view.aspect === undefined) return true;
  if (
    view.position[0] >= bounds[0] &&
    view.position[0] <= bounds[2] &&
    view.position[2] >= bounds[1] &&
    view.position[2] <= bounds[3]
  ) {
    return true;
  }
  const centerX = (bounds[0] + bounds[2]) / 2;
  const centerZ = (bounds[1] + bounds[3]) / 2;
  const toX = centerX - view.position[0];
  const toZ = centerZ - view.position[2];
  const distance = Math.hypot(toX, toZ);
  if (distance === 0) return true;
  const cone = horizontalCone(view);
  if (cone === undefined) return true;
  const { forwardLength, horizontalFov } = cone;
  const dot = (toX * view.direction[0] + toZ * view.direction[2]) / (distance * forwardLength);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const radius = Math.hypot(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 2;
  const angularRadius = Math.asin(Math.min(1, radius / distance));
  // A small guard band avoids request churn just outside the camera edge while turning.
  return angle <= horizontalFov / 2 + angularRadius + guardRadians;
}

function childAddresses(address: TerrainPyramidTileAddress): TerrainPyramidTileAddress[] {
  const level = address.level + 1;
  const x = address.x * 2;
  const z = address.z * 2;
  return [
    { level, x, z },
    { level, x: x + 1, z },
    { level, x, z: z + 1 },
    { level, x: x + 1, z: z + 1 },
  ];
}

/** Whether one tile contains the other (or they are the same). Called for every pair of
 * displayed tiles in a visibility pass: arithmetic, without the ancestor and its key. */
function pyramidAddressesOverlap(
  a: TerrainPyramidTileAddress,
  b: TerrainPyramidTileAddress,
): boolean {
  const ancestor = a.level <= b.level ? a : b;
  const descendant = ancestor === a ? b : a;
  const scale = 2 ** (descendant.level - ancestor.level);
  return (
    Math.floor(descendant.x / scale) === ancestor.x &&
    Math.floor(descendant.z / scale) === ancestor.z
  );
}

type TileHeight = (address: TerrainPyramidTileAddress) => { min: number; max: number };

function selectAt(
  descriptor: TerrainPyramidDescriptor,
  view: TerrainPyramidView,
  maxScreenSpaceError: number,
  viewDistance: number,
  guardRadians = VIEW_GUARD_RADIANS,
  heightOf: TileHeight = () => descriptor.height,
): TerrainPyramidTileAddress[] {
  const selected: TerrainPyramidTileAddress[] = [];
  const pixelsPerRadian = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  const visit = (address: TerrainPyramidTileAddress): void => {
    const bounds = tileBounds(descriptor, address);
    if (descriptor.coverage !== undefined && !boxesIntersect(bounds, descriptor.coverage)) return;
    if (!intersectsHorizontalView(view, bounds, guardRadians)) return;
    const distance = distanceToBounds(view.position, bounds, heightOf(address));
    if (distance > viewDistance) return;
    const size = descriptor.rootSize / 2 ** address.level;
    const geometricError = size / (descriptor.tileResolution - 1);
    // A tile-relative floor caps possible error at every level. At small drawing-buffer
    // sizes/high error budgets even the camera's own tile would then remain at minLevel.
    // Keep the near-field denominator finite without suppressing local refinement.
    const stableDistance = Math.max(distance, 1);
    const projectedError = (geometricError * pixelsPerRadian) / stableDistance;
    const refine =
      address.level < descriptor.minLevel ||
      (address.level < descriptor.maxLevel && projectedError > maxScreenSpaceError);
    if (!refine) {
      selected.push(address);
      return;
    }
    const children = childAddresses(address).sort((a, b) => {
      const distanceA = distanceToBounds(view.position, tileBounds(descriptor, a), heightOf(a));
      const distanceB = distanceToBounds(view.position, tileBounds(descriptor, b), heightOf(b));
      return distanceA - distanceB || a.z - b.z || a.x - b.x;
    });
    for (const child of children) visit(child);
  };
  visit({ level: 0, x: 0, z: 0 });
  return selected.sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
}

function selectCoarseCoverage(
  descriptor: TerrainPyramidDescriptor,
  view: TerrainPyramidView,
  viewDistance: number,
  maxTiles: number,
): TerrainPyramidTileAddress[] {
  const radialView: TerrainPyramidView = {
    position: view.position,
    verticalFov: view.verticalFov,
    viewportHeight: view.viewportHeight,
  };
  return selectAt(descriptor, radialView, Number.MAX_VALUE, viewDistance)
    .sort((a, b) => {
      const boundsA = tileBounds(descriptor, a);
      const boundsB = tileBounds(descriptor, b);
      return (
        distanceToBounds(view.position, boundsA, descriptor.height) -
          distanceToBounds(view.position, boundsB, descriptor.height) ||
        a.z - b.z ||
        a.x - b.x
      );
    })
    .slice(0, maxTiles);
}

/** Select a non-overlapping set of pyramid leaves for a perspective camera. */
export function selectTerrainPyramidTiles(
  descriptor: TerrainPyramidDescriptor,
  view: TerrainPyramidView,
  options: TerrainPyramidSelectionOptions,
): TerrainPyramidSelection {
  requireDescriptor(descriptor);
  requireView(view);
  requireSelectionOptions(options);
  if (
    options.hysteresis !== undefined &&
    (!Number.isFinite(options.hysteresis) || options.hysteresis < 0 || options.hysteresis >= 1)
  )
    throw new RangeError('Terrain hysteresis must be in [0, 1)');
  const previousRefined = new Set<string>();
  for (const tile of options.previousTiles ?? [])
    for (let level = descriptor.minLevel; level < tile.level; level++)
      previousRefined.add(terrainPyramidTileKey(terrainPyramidAncestor(tile, level)));
  const hysteresis = options.hysteresis ?? 0.15;
  const peripheralGuard =
    VIEW_GUARD_RADIANS + THREE.MathUtils.degToRad(options.peripheralDegrees ?? 0);
  const peripheralDetail = options.peripheralDetail ?? 0.4;
  const surroundDetail = options.surroundDetail ?? 0;
  const surroundDistance = Math.min(
    options.viewDistance,
    options.surroundDistance ?? options.viewDistance,
  );
  const focal = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  const knownHeight = options.tileHeight;
  const heights = new Map<string, { min: number; max: number }>();
  const heightOf: TileHeight =
    knownHeight === undefined
      ? () => descriptor.height
      : (tile) => {
          const key = terrainPyramidTileKey(tile);
          let height = heights.get(key);
          if (height === undefined) {
            const parent = terrainPyramidParent(tile);
            height =
              knownHeight(tile) ??
              (tile.level > descriptor.minLevel && parent !== undefined
                ? heightOf(parent)
                : descriptor.height);
            heights.set(key, height);
          }
          return height;
        };
  // 1 inside the view (with its guard band), `peripheralDetail` in the peripheral band, then
  // `surroundDetail` for the rest of the circle within its distance, else 0.
  const weight = (tile: TerrainPyramidTileAddress): number => {
    const bounds = tileBounds(descriptor, tile);
    if (descriptor.coverage !== undefined && !boxesIntersect(bounds, descriptor.coverage)) return 0;
    const distance = distanceToBounds(view.position, bounds, heightOf(tile));
    if (distance > options.viewDistance) return 0;
    if (intersectsHorizontalView(view, bounds)) return 1;
    if (
      peripheralGuard > VIEW_GUARD_RADIANS &&
      intersectsHorizontalView(view, bounds, peripheralGuard)
    )
      return peripheralDetail;
    return distance <= surroundDistance ? surroundDetail : 0;
  };
  const projected = (tile: TerrainPyramidTileAddress): number =>
    (((terrainPyramidTileSize(descriptor, tile.level) / (descriptor.tileResolution - 1)) * focal) /
      Math.max(1, distanceToBounds(view.position, tileBounds(descriptor, tile), heightOf(tile)))) *
    weight(tile);
  const visible = (tile: TerrainPyramidTileAddress): boolean => weight(tile) > 0;
  const refineScale = options.refineScale;
  // Error measured against what refining into the next level needs, so the heap still spends a
  // limited tile budget on whatever is furthest over it.
  const excess = (tile: TerrainPyramidTileAddress): number => {
    const scale = refineScale?.(tile) ?? 1;
    return projected(tile) / (scale >= 1 ? scale : 1);
  };
  // Start with mandatory coarse coverage, then spend the remaining tile budget on the most
  // visible error. Every node is visited once; no whole-tree threshold retry traversals.
  const roots = selectAt(
    descriptor,
    view,
    Number.MAX_VALUE,
    options.viewDistance,
    peripheralGuard,
    heightOf,
  ).sort(
    (a, b) =>
      distanceToBounds(view.position, tileBounds(descriptor, a), heightOf(a)) -
        distanceToBounds(view.position, tileBounds(descriptor, b), heightOf(b)) ||
      a.z - b.z ||
      a.x - b.x,
  );
  const selected = new Map(
    roots.slice(0, options.maxSelectedTiles).map((t) => [terrainPyramidTileKey(t), t]),
  );
  // `priority` is the error over what refining needs. A tile refined last time needs `hysteresis`
  // less, in the threshold and in the order a tight tile budget goes: ranked by bare error, the
  // last refinements the budget allows changed hands as the camera moved, and ground in view
  // stepped back and forth between levels.
  type Candidate = { tile: TerrainPyramidTileAddress; error: number; priority: number };
  const heap: Candidate[] = [];
  const push = (tile: TerrainPyramidTileAddress): void => {
    const error = excess(tile);
    const refined = previousRefined.has(terrainPyramidTileKey(tile));
    const item = { tile, error, priority: error / (refined ? 1 - hysteresis : 1) };
    let index = heap.length;
    heap.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if ((heap[parent]?.priority ?? 0) >= item.priority) break;
      heap[index] = heap[parent] as Candidate;
      index = parent;
    }
    heap[index] = item;
  };
  const pop = (): Candidate => {
    const first = heap[0] as Candidate,
      last = heap.pop() as Candidate;
    if (heap.length > 0) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if ((heap[child + 1]?.priority ?? -Infinity) > (heap[child]?.priority ?? -Infinity))
          child++;
        if ((heap[child]?.priority ?? 0) <= last.priority) break;
        heap[i] = heap[child] as Candidate;
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  for (const tile of selected.values()) push(tile);
  let effectiveError = options.maxScreenSpaceError;
  const finestLevel = Math.min(descriptor.maxLevel, options.maxLevel ?? descriptor.maxLevel);
  while (heap.length > 0) {
    const { tile, error, priority } = pop();
    if (tile.level >= finestLevel) continue;
    if (priority <= options.maxScreenSpaceError) continue;
    const children = childAddresses(tile).filter(visible);
    if (children.length === 0) continue;
    if (selected.size + children.length - 1 > options.maxSelectedTiles) {
      effectiveError = Math.max(effectiveError, error);
      continue;
    }
    selected.delete(terrainPyramidTileKey(tile));
    for (const child of children) {
      selected.set(terrainPyramidTileKey(child), child);
      push(child);
    }
  }
  const tiles = [...selected.values()].sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
  return {
    tiles,
    effectiveScreenSpaceError: effectiveError,
    effectiveViewDistance: options.viewDistance,
  };
}

interface WantedTile {
  address: TerrainPyramidTileAddress;
  distance: number;
  inView: boolean;
}

/** A tile the camera's track reaches in `seconds`, at `distance` from the camera then. */
interface AheadTile {
  address: TerrainPyramidTileAddress;
  seconds: number;
  distance: number;
}

const DEFAULT_LOOK_AHEAD_SECONDS: readonly number[] = [3, 6, 12, 20];
const DEFAULT_MIN_TILE_SECONDS = 5;
const DEFAULT_FAST_DETAIL = 0.25;
/**
 * Layers under way for ground the camera has left may number this many times the layer budget
 * before they hold new work back: see startQueuedLayerLoads.
 */
const STALE_LAYER_ROOM = 2;
/** A level back in use needs this much more than `minTileSeconds`, so speed noise cannot flip it. */
const LEVEL_LIMIT_HYSTERESIS = 1.2;
/** How full the cache may get on tiles ahead alone, before they must replace something. */
const AHEAD_ROOM_FRACTION = 0.9;
/**
 * Once the cache gives up a tile ahead to stay in budget, building ahead waits until what it keeps
 * is this far under the byte cap. A tile ahead keeps growing after it loads, as its layers arrive,
 * so room judged when its ground arrived was gone by the time its buildings did.
 */
const AHEAD_RESUME_FRACTION = 0.75;
/** Tiles ahead wait while the frame queue holds this many jobs: they take only spare capacity. */
const MAX_AHEAD_BACKLOG = 12;
/** Tile selection along the track runs this often, ms; the track changes slowly. */
const LOOK_AHEAD_INTERVAL_MS = 250;
/** Work is ordered for where the camera will be when it finishes: this much past a layer's build time. */
const LEAD_LATENCY_FACTOR = 1.5;
const MIN_LEAD_SECONDS = 1;
const MAX_LEAD_SECONDS = 6;
/** With no update for this long the camera has stopped, however fast it was going, ms. */
const TRACK_SILENCE_MS = 1_200;

/**
 * `userData` flag for a tile layer object that drapes its whole tile with opaque ground (for
 * example landcover over a full-tile background). While that object is displayed, the stream
 * does not draw the tile's bare terrain surface, which it would hide completely.
 */
export const TERRAIN_COVERS_GROUND: 'terrainCoversGround' = 'terrainCoversGround';

interface ResidentTile {
  /** Whether the tile's group is among the stream object's children. */
  attached: boolean;
  morph?: SurfaceHeightMorph;
  allocations?: Set<ArrayBufferLike>;
  address: TerrainPyramidTileAddress;
  heightfield: Heightfield;
  object: THREE.Group;
  surface: THREE.Mesh;
  geometryBytes: number;
  decodedHeightBytes: number;
  surfaceResolution: number;
  triangles: number;
  lastUsed: number;
  layers: Map<string, THREE.Object3D>;
  /** Successful empty results are resident too; retrying them can starve farther layers. */
  emptyLayers: Set<string>;
}

interface PendingTile {
  address: TerrainPyramidTileAddress;
  controller: AbortController;
}

interface PendingLayer {
  address: TerrainPyramidTileAddress;
  layer: TerrainPyramidTileLayer;
  controller: AbortController;
}

interface ObjectGeometryStats {
  bytes: number;
  triangles: number;
  instances: number;
  drawCalls: number;
}

/**
 * Stop per-frame transform recomposition for tile content. An object that recomposes each frame
 * marks every descendant's world matrix dirty, so a city of static buildings would pay for a full
 * matrix pass every frame. Subtrees marked `userData.dynamicTransform = true` keep updating.
 */
const casterBox = new THREE.Box3();

/**
 * Mark tile content for sun shadows: everything receives, and tall parts cast. An object's
 * `userData.shadowCaster` (true or false) decides for it and everything beneath it; draped
 * ground (landcover, water, road surfaces) is marked false where it is built.
 */
function markShadows(
  root: THREE.Object3D,
  casterHeight: number,
  inherited?: boolean,
  parentMatrix?: THREE.Matrix4,
): void {
  const own = root.userData.shadowCaster;
  const decided = own === true || own === false ? own : inherited;
  // Heights are measured in the layer's own frame from its (frozen) local matrices, leaving
  // world matrices to the renderer once the layer is attached to its tile.
  const matrix =
    parentMatrix === undefined ? root.matrix.clone() : parentMatrix.clone().multiply(root.matrix);
  const mesh = root as THREE.Mesh;
  if (mesh.isMesh) {
    // Shadows smear across a reflective water surface; water opts out with shadowReceiver.
    mesh.receiveShadow = mesh.userData.shadowReceiver !== false;
    if (decided !== undefined) mesh.castShadow = decided;
    else {
      const geometry = mesh.geometry;
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      casterBox.copy(geometry.boundingBox as THREE.Box3);
      // Instances stand at their own heights; their shared shape decides.
      if (!(mesh as THREE.InstancedMesh).isInstancedMesh) casterBox.applyMatrix4(matrix);
      mesh.castShadow = casterBox.max.y - casterBox.min.y > casterHeight;
    }
  }
  for (const child of root.children) markShadows(child, casterHeight, decided, matrix);
}

/**
 * Leave a hidden tile's subtree out of the scene's per-frame world-matrix walk. The warm cache
 * keeps most resident tiles hidden, and three walks hidden objects too: two thirds of a flight's
 * scene graph, a millisecond or more of every frame. A move above the hidden tile (a floating
 * origin rebase) is remembered and applied when it is shown again. Readers outside rendering
 * already bring matrices up to date themselves (`updateWorldMatrix(true, ...)`).
 */
function skipHiddenWorldMatrices(object: THREE.Object3D): void {
  object.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean): void {
    if (!this.visible) {
      if (force === true) this.matrixWorldNeedsUpdate = true;
      return;
    }
    THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
  };
}

function freezeStaticTransforms(root: THREE.Object3D): void {
  if (root.userData.dynamicTransform === true) return;
  if (root.matrixAutoUpdate) {
    root.updateMatrix();
    root.matrixAutoUpdate = false;
  }
  for (const child of root.children) freezeStaticTransforms(child);
}

function objectGeometryStats(
  root: THREE.Object3D,
  visibleOnly: boolean,
  allocations = new Set<ArrayBufferLike>(),
): ObjectGeometryStats {
  // Visible counts need no byte totals: skip the per-buffer bookkeeping on that walk.
  const countBytes = !visibleOnly;
  const seen = new Set<THREE.BufferGeometry>();
  let bytes = 0;
  let triangles = 0;
  let instances = 0;
  let drawCalls = 0;
  const countBuffer = (array: { readonly buffer: ArrayBufferLike }): void => {
    if (allocations.has(array.buffer)) return;
    allocations.add(array.buffer);
    // Cells and LODs may wrap the same array in different attributes/geometries. Count the
    // retained backing allocation once, including aliased views of interleaved buffers.
    bytes += array.buffer.byteLength;
  };
  const visit = (object: THREE.Object3D): void => {
    const renderable = object as THREE.Mesh;
    if (!renderable.isMesh) return;
    const mesh = renderable as THREE.Mesh | THREE.InstancedMesh;
    drawCalls +=
      Array.isArray(mesh.material) && mesh.geometry.groups.length > 0
        ? mesh.geometry.groups.length
        : 1;
    const count = (mesh as THREE.InstancedMesh).isInstancedMesh
      ? (mesh as THREE.InstancedMesh).count
      : 1;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      instances += count;
      const instanced = mesh as THREE.InstancedMesh;
      if (countBytes)
        for (const buffer of [instanced.instanceMatrix, instanced.instanceColor]) {
          if (buffer !== null) countBuffer(buffer.array);
        }
    }
    const baseTriangles =
      mesh.geometry.index !== null
        ? mesh.geometry.index.count / 3
        : (mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
    triangles += baseTriangles * count;
    if (!countBytes || seen.has(mesh.geometry)) return;
    seen.add(mesh.geometry);
    for (const attribute of Object.values(mesh.geometry.attributes)) {
      countBuffer(attribute.array);
    }
    if (mesh.geometry.index !== null) countBuffer(mesh.geometry.index.array);
  };
  if (visibleOnly) root.traverseVisible(visit);
  else root.traverse(visit);
  return { bytes, triangles, instances, drawCalls };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

// Parsed tile keys: each visibility pass reads every candidate's, several passes a frame.
const parsedKeys = new Map<string, TerrainPyramidTileAddress>();

/** A tile key's address (shared: callers must not change it). */
function addressFromKey(key: string): TerrainPyramidTileAddress {
  let address = parsedKeys.get(key);
  if (address === undefined) {
    const [level, x, z] = key.split('/').map(Number);
    address = { level: level as number, x: x as number, z: z as number };
    if (parsedKeys.size >= 8192) parsedKeys.clear();
    parsedKeys.set(key, address);
  }
  return address;
}

export function surfaceDescriptor(
  descriptor: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
): TerrainDescriptor {
  const count = 2 ** address.level;
  const size = descriptor.rootSize / count;
  return {
    format: 'molen/terrain@2',
    name: `${descriptor.name}:${address.level}`,
    origin: descriptor.origin,
    chunkSize: size,
    tileResolution: descriptor.tileResolution,
    gridSize: [count, count],
    height: descriptor.height,
    tiles: { heightUrl: 'terrain-pyramid-source' },
    layers: descriptor.layers,
    lod: { levels: 1, distanceBands: [], skirts: descriptor.skirts },
    streaming: {
      loadRadius: 1,
      unloadRadius: 1,
      maxConcurrentLoads: 1,
      maxResidentTiles: 1,
    },
    collision: { enabled: false },
  };
}

/** A decoded tile plus, when a worker prepared it off-thread, its finished surface geometry. */
interface PreparedTile {
  heightfield: Heightfield;
  geometry?: ChunkGeometry;
}

function surfaceResolution(descriptor: TerrainPyramidDescriptor, maximum: number): number {
  const step = Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (maximum - 1)));
  return Math.floor((descriptor.tileResolution - 1) / step) + 1;
}

function createSurface(
  descriptor: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
  heightfield: Heightfield,
  material: THREE.Material,
  maxResolution: number,
  prepared?: ChunkGeometry,
  neighborHeight?: TerrainNeighborHeightSampler,
  surfaceColor?: TerrainSurfaceColor,
): { mesh: THREE.Mesh; bytes: number; triangles: number } {
  const step = Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (maxResolution - 1)));
  const geometry =
    prepared ??
    buildChunkGeometry(heightfield, surfaceDescriptor(descriptor, address), address.x, address.z, {
      localCoordinates: true,
      step,
      ...(neighborHeight === undefined ? {} : { neighborHeight }),
    });
  if (surfaceColor?.colorTile !== undefined) {
    const origin = terrainPyramidTileOrigin(descriptor, address);
    surfaceColor.colorTile(
      geometry.positions,
      geometry.normals,
      geometry.colors,
      origin[0],
      origin[1],
    );
  } else if (surfaceColor !== undefined) {
    const origin = terrainPyramidTileOrigin(descriptor, address);
    // One scratch base color for every vertex: the callback reads it, and its result is copied.
    const base: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const nx = geometry.normals[i] ?? 0,
        ny = geometry.normals[i + 1] ?? 1,
        nz = geometry.normals[i + 2] ?? 0;
      base[0] = geometry.colors[i] ?? 0;
      base[1] = geometry.colors[i + 1] ?? 0;
      base[2] = geometry.colors[i + 2] ?? 0;
      const color = surfaceColor(
        origin[0] + (geometry.positions[i] ?? 0),
        geometry.positions[i + 1] ?? 0,
        origin[1] + (geometry.positions[i + 2] ?? 0),
        Math.hypot(nx, nz) / Math.max(0.01, ny),
        base,
      );
      if (
        color !== undefined &&
        Number.isFinite(color[0]) &&
        Number.isFinite(color[1]) &&
        Number.isFinite(color[2])
      )
        geometry.colors.set(color, i);
    }
  }
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute('position', new THREE.BufferAttribute(geometry.positions, 3));
  buffer.setAttribute('normal', new THREE.BufferAttribute(geometry.normals, 3));
  buffer.setAttribute('color', new THREE.BufferAttribute(geometry.colors, 3));
  buffer.setIndex(new THREE.BufferAttribute(geometry.indices, 1));
  // Bounds from one pass over the positions array: three's computeBoundingSphere walks them twice
  // through per-vertex accessors, a seventh of meshing a full-resolution tile on the main thread.
  const positions = geometry.positions;
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    minZ = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i] as number,
      y = positions[i + 1] as number,
      z = positions[i + 2] as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  buffer.boundingBox = new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ),
  );
  buffer.boundingSphere = buffer.boundingBox.getBoundingSphere(new THREE.Sphere());
  const mesh = new THREE.Mesh(buffer, material);
  markTerrainGroundSurface(mesh);
  mesh.name = `surface:${terrainPyramidTileKey(address)}`;
  mesh.renderOrder = address.level;
  const bytes =
    geometry.positions.byteLength +
    geometry.normals.byteLength +
    geometry.colors.byteLength +
    geometry.indices.byteLength;
  return { mesh, bytes, triangles: geometry.indices.length / 3 };
}

class ScreenSpaceTerrainPyramidStream implements TerrainPyramidStream {
  private readonly morphing = new Map<ResidentTile, number>();
  private readonly allocations = new Map<ArrayBufferLike, number>();
  readonly object = new THREE.Group();
  private readonly material: THREE.Material;
  private readonly ownsMaterial: boolean;
  private readonly layerById = new Map<string, TerrainPyramidTileLayer>();
  /** Categories built outside the view and published on their own (see `independentLayers`). */
  private readonly independentCategories: ReadonlySet<TerrainTileLayerCategory>;
  private readonly layerVisibility = new Map<string, boolean>();
  private readonly resident = new Map<string, ResidentTile>();
  /** Height probes repeat within a finest-level cell (wheels, collision sweeps, parked craft).
   * Cache the ordered fields, not sampled heights; visibility/residency changes invalidate it. */
  private readonly heightProbeTiles = new Map<string, readonly ResidentTile[]>();
  private readonly layerPriorities = new Map<string, number>();
  private readonly pending = new Map<string, PendingTile>();
  private readonly pendingLayers = new Map<string, PendingLayer>();
  private readonly retries: TerrainTileRetryTracker<TerrainPyramidTileAddress>;
  private readonly retryPolicy: TerrainTileRetryPolicy;
  private readonly layerRetries: TerrainTileRetryTracker<TerrainPyramidStreamErrorContext>;
  private readonly wanted = new Map<string, WantedTile>();
  private readonly coarseWanted = new Set<string>();
  private readonly selected = new Map<string, TerrainPyramidTileAddress>();
  private readonly preloading = new Set<string>();
  private readonly preparationTargets = new Set<string>();
  private preloadViews: readonly TerrainPyramidView[] = [];
  private preloadMemoryHold = false;
  private readonly rejectedPreloads = new Map<string, number>();
  private displayed = new Set<string>();
  /** Surface cut being prepared behind the currently displayed, complete tiles. */
  private replacementTiles = new Set<string>();
  /** Retain existing detail while newly enabled layers finish on a displayed tile. */
  private readonly displayedLayers = new Map<string, Set<string>>();
  private queue: WantedTile[] = [];
  private selection: TerrainPyramidSelection;
  private view: TerrainPyramidView | undefined;
  private usage = 0;
  private evictionCount = 0;
  private disposed = false;
  private layerPumpScheduled = false;
  private idleWaiters: Array<() => void> = [];
  private budget: TerrainPyramidBudget;
  private readonly groundCutouts = new TerrainGroundCutoutController();
  /**
   * Whether ground cutouts must be recomputed: a surface, layer or tile changed visibility or a
   * surface's grid changed. The pass walks every cutter (a city's tunnels hold thousands) and
   * otherwise reran on every 10 Hz camera update with nothing to change.
   */
  private cutoutsDirty = true;
  /** When the current cut budget began, and the cutting it has paid for (see CUT_BUDGET_MS). */
  private cutWindowStart = Number.NEGATIVE_INFINITY;
  private cutWindowSpent = 0;
  /**
   * A visibility pass requested by a publication. A fast flight publishes dozens of tiles and
   * layers in one admission flush, and each ran the whole pass (the selection against displayed
   * tiles, every layer, cutouts, byte totals) and an eviction scan. They now share one pass after
   * the flush; reads that depend on what is displayed run a pending pass first.
   */
  private visibilityQueued = false;
  private geometryBytes = 0;
  private decodedHeightBytes = 0;
  private displayedBytes = 0;
  /** Bumped when a tile's allocations change; with the visible tiles it keys displayedBytes. */
  private allocationsVersion = 0;
  private countedVersion = -1;
  private countedTiles = new Set<string>();
  /** Completed builds per tile, and per tile layer: a second build means the cache lost it. */
  private readonly tileBuilds = new Set<string>();
  private readonly layerBuilds = new Set<string>();
  private readonly buildCounts = {
    tiles: 0,
    rebuiltTiles: 0,
    layers: 0,
    rebuiltLayers: 0,
    refreshedLayers: 0,
  };
  /**
   * Tile layers on screen whose source changed (see `refreshLayers`), by `"L/x/z:layerId"`. What
   * each published stays displayed, and counts as built, until its replacement takes its place.
   * Not the "stale" of STALE_LAYER_ROOM, which is work for ground the camera has left.
   */
  private readonly outdatedLayers = new Map<string, { tileKey: string; layerId: string }>();
  /** `refreshLayers` calls still waiting on some of the tile layers they found on screen. */
  private refreshWaiters: Array<{ keys: Set<string>; resolve: () => void }> = [];
  private readonly transitions = { refinedInView: 0, coarsenedInView: 0 };
  /** Ancestors of the displayed tiles, as of the last plan: ground refined on screen. */
  private readonly refinedOnScreen = new Set<string>();
  private readonly clock: () => number;
  private readonly track: TerrainCameraTrack;
  private readonly lookAhead: Required<
    Pick<TerrainPyramidLookAheadOptions, 'seconds' | 'minTileSeconds' | 'fastDetail'>
  > &
    Pick<TerrainPyramidLookAheadOptions, 'maxTiles'>;
  /** The finest level refined across the whole view at the camera's speed; finer ones stay near. */
  private speedLevel: number;
  private readonly lookAheadEnabled: boolean;
  /** Tiles the camera's track reaches next, soonest first. */
  private readonly ahead = new Map<string, AheadTile>();
  private aheadQueue: AheadTile[] = [];
  private aheadPlannedAt = Number.NEGATIVE_INFINITY;
  /** Whether residency can take more look-ahead work without displacing anything wanted. */
  private aheadRoom = true;
  /** Set when the cache gave up a tile ahead: see AHEAD_RESUME_FRACTION. */
  private aheadMemoryHold = false;
  /** The view a finished build will meet: set while the camera is moving. */
  private lead: TerrainPyramidView | undefined;
  /** Smoothed time a layer takes from start to publication, ms. */
  private layerLatencyMs = 1_000;
  /** Ends travel when updates stop, for a host that updates only while the camera moves. */
  private trackSilence: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly descriptor: TerrainPyramidDescriptor,
    private readonly source: TerrainPyramidHeightSource,
    private readonly options: TerrainPyramidStreamOptions,
  ) {
    requireDescriptor(descriptor);
    this.clock = options.now ?? (() => performance.now());
    const finest = terrainPyramidTileSize(descriptor, descriptor.maxLevel);
    // A step past a few of the finest tiles within one update is a teleport, not travel.
    this.track = new TerrainCameraTrack(finest * 4);
    this.lookAheadEnabled = options.lookAhead !== false;
    const lookAhead = options.lookAhead === false ? undefined : options.lookAhead;
    this.lookAhead = {
      seconds: [...(lookAhead?.seconds ?? DEFAULT_LOOK_AHEAD_SECONDS)].sort((a, b) => a - b),
      minTileSeconds: lookAhead?.minTileSeconds ?? DEFAULT_MIN_TILE_SECONDS,
      fastDetail: lookAhead?.fastDetail ?? DEFAULT_FAST_DETAIL,
      ...(lookAhead?.maxTiles !== undefined ? { maxTiles: lookAhead.maxTiles } : {}),
    };
    this.speedLevel = descriptor.maxLevel;
    if (this.lookAhead.seconds.some((seconds) => !Number.isFinite(seconds) || seconds <= 0)) {
      throw new RangeError('terrain lookAhead seconds must be finite and positive');
    }
    const { fastDetail } = this.lookAhead;
    if (!(fastDetail >= 0 && fastDetail <= 1)) {
      throw new RangeError('terrain lookAhead fastDetail must be in [0, 1]');
    }
    this.budget = {
      maxScreenSpaceError: options.maxScreenSpaceError,
      viewDistance: options.viewDistance,
      maxSelectedTiles: options.maxSelectedTiles,
      maxSurfaceTileResolution: options.maxSurfaceTileResolution ?? 65,
      maxConcurrentLoads: options.maxConcurrentLoads,
      maxConcurrentLayerLoads: options.maxConcurrentLayerLoads ?? options.maxConcurrentLoads,
      maxResidentTiles: options.maxResidentTiles,
      ...(options.maxResidentBytes === undefined
        ? {}
        : { maxResidentBytes: options.maxResidentBytes }),
      ...(options.hysteresis === undefined ? {} : { hysteresis: options.hysteresis }),
      ...(options.peripheralDegrees === undefined
        ? {}
        : { peripheralDegrees: options.peripheralDegrees }),
      ...(options.peripheralDetail === undefined
        ? {}
        : { peripheralDetail: options.peripheralDetail }),
      ...(options.surroundDetail === undefined ? {} : { surroundDetail: options.surroundDetail }),
      ...(options.surroundDistance === undefined
        ? {}
        : { surroundDistance: options.surroundDistance }),
    };
    requireBudget(this.budget);
    this.independentCategories = new Set(options.independentLayers ?? ['hydrology']);
    this.retryPolicy = resolveTerrainTileRetryPolicy(options);
    if (Number.isNaN(options.layerTimeoutMs) || (options.layerTimeoutMs ?? 0) < 0)
      throw new RangeError('terrain layerTimeoutMs must be zero, positive, or Infinity');
    this.retries = new TerrainTileRetryTracker<TerrainPyramidTileAddress>(this.retryPolicy);
    this.layerRetries = new TerrainTileRetryTracker<TerrainPyramidStreamErrorContext>(
      this.retryPolicy,
    );
    this.object.name = `terrain-pyramid:${descriptor.name}`;
    // A static root: recomposing it every frame would dirty every resident tile's world matrix.
    // Hosts that move the stream call `object.updateMatrix()` afterwards.
    this.object.matrixAutoUpdate = false;
    this.material =
      options.material ??
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.ownsMaterial = options.material === undefined;
    for (const layer of options.layers ?? []) {
      if (this.layerById.has(layer.id)) {
        throw new Error(`duplicate terrain pyramid tile layer "${layer.id}"`);
      }
      const minLevel = layer.minLevel ?? descriptor.minLevel;
      const maxLevel = layer.maxLevel ?? descriptor.maxLevel;
      if (
        !Number.isSafeInteger(minLevel) ||
        !Number.isSafeInteger(maxLevel) ||
        minLevel < descriptor.minLevel ||
        maxLevel > descriptor.maxLevel ||
        minLevel > maxLevel
      ) {
        throw new Error(
          `terrain pyramid layer "${layer.id}" levels must fit ${descriptor.minLevel}-${descriptor.maxLevel}`,
        );
      }
      this.layerById.set(layer.id, layer);
      this.layerVisibility.set(layer.id, layer.visible ?? true);
      this.displayedLayers.set(layer.id, new Set());
    }
    this.selection = {
      tiles: [],
      effectiveScreenSpaceError: options.maxScreenSpaceError,
      effectiveViewDistance: options.viewDistance,
    };
    if (options.initialView !== undefined) this.update(options.initialView);
  }

  update(view: TerrainPyramidView, preloadViews: readonly TerrainPyramidView[] = []): void {
    if (this.disposed) return;
    requireView(view);
    for (const future of preloadViews) requireView(future);
    this.preloadViews = preloadViews.map((future) => ({
      ...future,
      position: [...future.position],
      ...(future.direction === undefined ? {} : { direction: [...future.direction] }),
    }));
    this.track.sample(this.clock(), view.position);
    this.plan({
      ...view,
      position: [...view.position],
      ...(view.direction === undefined ? {} : { direction: [...view.direction] }),
    });
    clearTimeout(this.trackSilence);
    this.trackSilence = undefined;
    // A camera that stopped would otherwise keep the detail limit and look-ahead of its last speed.
    if (this.track.speed > 0) {
      this.trackSilence = setTimeout(() => {
        this.trackSilence = undefined;
        this.track.reset();
        if (!this.disposed && this.view !== undefined) this.plan(this.view);
      }, TRACK_SILENCE_MS);
    }
  }

  /** Where a view moves to along the camera's track, looking as far around as the track turns. */
  private predictedView(view: TerrainPyramidView, seconds: number): TerrainPyramidView | undefined {
    const predicted = this.track.predict(seconds);
    if (predicted === undefined) return undefined;
    const [x, y, z] = predicted.position;
    const direction = view.direction;
    const cos = Math.cos(predicted.turn);
    const sin = Math.sin(predicted.turn);
    return {
      ...view,
      position: [x, Math.max(y, this.descriptor.height.min), z],
      ...(direction === undefined
        ? {}
        : {
            direction: [
              direction[0] * cos - direction[2] * sin,
              direction[1],
              direction[0] * sin + direction[2] * cos,
            ],
          }),
    };
  }

  /**
   * A resident tile's ground, from the bottom of the package's range up to the highest ground it
   * holds: height above that ground is what coarsens it. A camera below a tile's lowest ground (in
   * a tunnel, beneath a cliff) is not taken farther from it; it measures across, as before.
   */
  private readonly tileHeight = (
    address: TerrainPyramidTileAddress,
  ): { min: number; max: number } | undefined => {
    const extent = this.resident.get(terrainPyramidTileKey(address))?.heightfield.heightExtent();
    return extent === undefined
      ? undefined
      : { min: Math.min(extent.min, this.descriptor.height.min), max: extent.max };
  };

  /** The finest level whose tiles the camera stays over long enough to be worth building. */
  private updateSpeedLevel(): void {
    const { descriptor } = this;
    const limit = this.lookAhead.minTileSeconds;
    const speed = this.track.speed;
    if (!this.lookAheadEnabled || limit <= 0 || speed === 0) {
      this.speedLevel = descriptor.maxLevel;
      return;
    }
    let level = descriptor.maxLevel;
    while (level > descriptor.minLevel && terrainPyramidTileSize(descriptor, level) / speed < limit)
      level--;
    // Coarsen at once; refine again only with a margin.
    while (
      level > this.speedLevel &&
      terrainPyramidTileSize(descriptor, level) / speed < limit * LEVEL_LIMIT_HYSTERESIS
    )
      level--;
    this.speedLevel = level;
  }

  /**
   * The selection's error multiple for refining `tile` into its children at the camera's speed.
   * A moving camera starts tiles of a level at a rate of its speed times the level's reach over
   * its tile area; a level just slow enough to build across the view sets the rate the stream
   * can keep up with. A faster level keeps `fastDetail` of that rate by shortening its reach,
   * which the error multiple divides (or, past the view distance, the reach the view distance
   * leaves it).
   *
   * The limit is on building. Children already built cost nothing to show, and giving them up
   * while in view (as the camera speeds up, crosses a level's limit or turns) reads as detail
   * popping out; they keep the ordinary error, like ground at rest.
   */
  private readonly refineScale = (tile: TerrainPyramidTileAddress): number => {
    const view = this.view;
    const level = tile.level + 1;
    if (
      level <= this.speedLevel ||
      view === undefined ||
      this.refinedOnScreen.has(terrainPyramidTileKey(tile)) ||
      this.childrenBuilt(tile)
    )
      return 1;
    const { minTileSeconds, fastDetail } = this.lookAhead;
    if (fastDetail === 0) return Number.POSITIVE_INFINITY;
    const { descriptor, budget } = this;
    const crossing = terrainPyramidTileSize(descriptor, level) / this.track.speed;
    const share = (fastDetail * crossing) / minTileSeconds;
    // Where the selection would otherwise refine a parent into this level.
    const focal = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
    const parentError =
      terrainPyramidTileSize(descriptor, level - 1) / (descriptor.tileResolution - 1);
    const reach = (parentError * focal) / budget.maxScreenSpaceError;
    return Math.max(1, reach / (share * Math.min(reach, budget.viewDistance)));
  };

  /** Whether every child of `tile` is resident with its layers, ready to show. */
  private childrenBuilt(tile: TerrainPyramidTileAddress): boolean {
    const { coverage } = this.descriptor;
    return childAddresses(tile).every((child) => {
      if (coverage !== undefined && !boxesIntersect(tileBounds(this.descriptor, child), coverage))
        return true;
      const resident = this.resident.get(terrainPyramidTileKey(child));
      return resident !== undefined && this.layersReady(resident);
    });
  }

  /** Whether the track will cross enough ground in time for looking ahead to change anything. */
  private travelling(): boolean {
    if (!this.lookAheadEnabled) return false;
    const horizon = this.lookAhead.seconds.at(-1) ?? 0;
    const finest = terrainPyramidTileSize(this.descriptor, this.descriptor.maxLevel);
    return this.track.speed * horizon >= finest / 2;
  }

  /** Select tiles along the track, soonest first, leaving out what the camera already selects. */
  private planAhead(view: TerrainPyramidView): void {
    if (this.lead === undefined) {
      this.ahead.clear();
      this.aheadPlannedAt = Number.NEGATIVE_INFINITY;
      return;
    }
    const now = this.clock();
    if (now - this.aheadPlannedAt < LOOK_AHEAD_INTERVAL_MS) return;
    this.aheadPlannedAt = now;
    this.ahead.clear();
    const limit = this.lookAhead.maxTiles ?? this.budget.maxSelectedTiles;
    for (const seconds of this.lookAhead.seconds) {
      const future = this.predictedView(view, seconds);
      if (future === undefined) return;
      const tiles = selectTerrainPyramidTiles(this.descriptor, future, {
        maxScreenSpaceError: this.budget.maxScreenSpaceError,
        viewDistance: this.budget.viewDistance,
        maxSelectedTiles: this.budget.maxSelectedTiles,
        hysteresis: 0,
        tileHeight: this.tileHeight,
        refineScale: this.refineScale,
      })
        .tiles.map((address) => ({
          address,
          seconds,
          distance: distanceToBounds(
            future.position,
            tileBounds(this.descriptor, address),
            this.descriptor.height,
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
      for (const tile of tiles) {
        if (this.ahead.size >= limit) return;
        const key = terrainPyramidTileKey(tile.address);
        if (!this.ahead.has(key) && !this.selected.has(key)) this.ahead.set(key, tile);
      }
    }
  }

  private plan(view: TerrainPyramidView): void {
    this.view = view;
    // Order work for where the camera will be once it is done, not where it is now.
    this.lead = this.travelling()
      ? this.predictedView(
          view,
          Math.max(
            MIN_LEAD_SECONDS,
            Math.min(MAX_LEAD_SECONDS, (LEAD_LATENCY_FACTOR * this.layerLatencyMs) / 1000),
          ),
        )
      : undefined;
    const focus = this.lead ?? view;
    this.usage++;
    this.renewCutWindow(performance.now());
    this.updateSpeedLevel();
    this.refinedOnScreen.clear();
    for (const key of this.displayed) {
      const address = this.resident.get(key)?.address;
      if (address === undefined) continue;
      for (let level = address.level - 1; level >= this.descriptor.minLevel; level--) {
        const ancestor = terrainPyramidTileKey(terrainPyramidAncestor(address, level));
        // Its own ancestors came with it.
        if (this.refinedOnScreen.has(ancestor)) break;
        this.refinedOnScreen.add(ancestor);
      }
    }
    this.selection = selectTerrainPyramidTiles(this.descriptor, this.view, {
      ...this.budget,
      previousTiles: this.selection.tiles,
      tileHeight: this.tileHeight,
      refineScale: this.refineScale,
    });
    this.selected.clear();
    this.wanted.clear();
    this.coarseWanted.clear();
    this.preloading.clear();
    this.preparationTargets.clear();
    const loadWanted = new Set<string>();
    const addWanted = (address: TerrainPyramidTileAddress): void => {
      const key = terrainPyramidTileKey(address);
      if (this.wanted.has(key)) return;
      const bounds = tileBounds(this.descriptor, address);
      this.wanted.set(key, {
        address,
        distance: distanceToBounds(focus.position, bounds, this.descriptor.height),
        inView: intersectsHorizontalView(focus, bounds, 0),
      });
    };
    for (const address of selectCoarseCoverage(
      this.descriptor,
      this.view,
      this.selection.effectiveViewDistance,
      this.budget.maxSelectedTiles,
    )) {
      const key = terrainPyramidTileKey(address);
      this.coarseWanted.add(key);
      loadWanted.add(key);
      addWanted(address);
    }
    for (const leaf of this.selection.tiles) {
      this.selected.set(terrainPyramidTileKey(leaf), leaf);
      // Resident descendants already cover their evicted ancestors. Reloading those parents
      // under memory pressure would create a continuous load/evict cycle.
      let coveredLevel = this.descriptor.minLevel - 1;
      for (let level = leaf.level; level >= this.descriptor.minLevel; level--) {
        if (this.resident.has(terrainPyramidTileKey(terrainPyramidAncestor(leaf, level)))) {
          coveredLevel = level;
          break;
        }
      }
      for (let level = this.descriptor.minLevel; level <= leaf.level; level++) {
        const ancestor = terrainPyramidAncestor(leaf, level);
        // Finer resident ground already covers older ancestors. Keep those parents as an
        // ordinary warm cache, not protected demand: otherwise a long flight fills the
        // resident budget with redundant levels and evicts the prepared route first.
        // Displayed parents remain protected independently until their layers can hand off.
        if (level >= coveredLevel) addWanted(ancestor);
        if (level > coveredLevel) loadWanted.add(terrainPyramidTileKey(ancestor));
      }
    }
    // Prepare future leaves directly: speculative ancestors consume slots and memory without
    // improving current coverage. Keep the real selection/error budget for each future view;
    // reducing its selection budget would predict coarser tiles than travel actually needs.
    // The same ground heights and speed limit apply, or a fast camera would prepare leaves finer
    // than its selection will reach.
    const futureSelection: TerrainPyramidSelectionOptions = {
      ...this.budget,
      tileHeight: this.tileHeight,
      refineScale: this.refineScale,
    };
    const byteCap = this.budget.maxResidentBytes;
    // A full hidden cache is reclaimable. Only displayed pressure should suspend the route;
    // otherwise a long flight would permanently stop preloading once its cache first fills.
    if (byteCap === undefined || this.displayedBytes < byteCap * 0.8)
      this.preloadMemoryHold = false;
    else if (this.displayedBytes >= byteCap) this.preloadMemoryHold = true;
    const preloadLimit = this.preloadMemoryHold
      ? 0
      : Math.max(
          0,
          Math.min(
            // Keep all four approaching families possible even at the lowest render tier.
            // A four-tile limit discarded farther views just when preparation was slow.
            Math.max(16, Math.floor(this.budget.maxSelectedTiles / 4)),
            this.budget.maxResidentTiles - this.wanted.size,
          ),
        );
    for (const future of this.preloadViews) {
      const distance = (address: TerrainPyramidTileAddress): number =>
        distanceToBounds(
          future.position,
          tileBounds(this.descriptor, address),
          this.descriptor.height,
        );
      const nearest = selectTerrainPyramidTiles(
        this.descriptor,
        future,
        futureSelection,
      ).tiles.sort(
        (a, b) => distance(a) - distance(b) || b.level - a.level || a.z - b.z || a.x - b.x,
      )[0];
      if (nearest === undefined) continue;
      // Prepare the approach's complete refinement family. A lone ready leaf stays hidden
      // behind its detailed parent until siblings settle; distant leaves from an entire
      // future frustum spend that lead time without releasing the ground on the flight path.
      const leaves =
        nearest.level === 0
          ? [nearest]
          : childAddresses(terrainPyramidAncestor(nearest, nearest.level - 1));
      leaves.sort(
        (a, b) => distance(a) - distance(b) || b.level - a.level || a.z - b.z || a.x - b.x,
      );
      for (const leaf of leaves) {
        if (
          this.descriptor.coverage !== undefined &&
          !boxesIntersect(tileBounds(this.descriptor, leaf), this.descriptor.coverage)
        )
          continue;
        const key = terrainPyramidTileKey(leaf);
        if (this.wanted.has(key)) {
          this.preparationTargets.add(key);
          continue;
        }
        if (this.preloading.size >= preloadLimit) continue;
        if ((this.rejectedPreloads.get(key) ?? 0) > this.usage) continue;
        this.rejectedPreloads.delete(key);
        this.preloading.add(key);
        this.preparationTargets.add(key);
        addWanted(leaf);
        loadWanted.add(key);
      }
    }
    this.planAhead(view);
    // A route change must not leave all height slots occupied by obsolete requests. Delete
    // before restarting; the old request's identity-checked settlement cannot delete a retry.
    for (const [key, request] of this.pending) {
      if (!this.wanted.has(key) && !this.ahead.has(key) && !this.visiblyRetains(key)) {
        request.controller.abort();
        this.pending.delete(key);
      }
    }
    for (const [key, tile] of this.resident) {
      if (this.wanted.has(key) || this.ahead.has(key)) tile.lastUsed = this.usage;
    }
    this.aheadQueue = [...this.ahead].flatMap(([key, tile]) =>
      this.wanted.has(key) ||
      this.resident.has(key) ||
      this.pending.has(key) ||
      this.retries.isBlocked(key)
        ? []
        : [tile],
    );
    this.queue = [...this.wanted.values()]
      .filter((tile) => {
        const key = terrainPyramidTileKey(tile.address);
        return (
          loadWanted.has(key) &&
          !this.resident.has(key) &&
          !this.pending.has(key) &&
          !this.retries.isBlocked(key)
        );
      })
      .sort(
        (a, b) =>
          Number(this.preloading.has(terrainPyramidTileKey(a.address))) -
            Number(this.preloading.has(terrainPyramidTileKey(b.address))) ||
          Number(this.coarseWanted.has(terrainPyramidTileKey(b.address))) -
            Number(this.coarseWanted.has(terrainPyramidTileKey(a.address))) ||
          Number(b.inView) - Number(a.inView) ||
          a.distance - b.distance ||
          a.address.level - b.address.level ||
          a.address.z - b.address.z ||
          a.address.x - b.address.x,
      );
    this.retries.forgetUnwanted((key) => loadWanted.has(key) || this.ahead.has(key));
    this.updateVisibility();
    this.evictUnused();
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
  }

  setBudget(budget: Partial<TerrainPyramidBudget>): void {
    if (this.disposed) return;
    const next = { ...this.budget, ...budget };
    // Validate the complete candidate before changing live state or issuing work.
    requireBudget(next);
    if (
      Object.keys(next).every((key) => {
        const field = key as keyof TerrainPyramidBudget;
        return next[field] === this.budget[field];
      })
    )
      return;
    this.budget = next;
    this.rejectedPreloads.clear();
    if (this.view !== undefined) this.plan(this.view);
    else {
      this.selection.effectiveScreenSpaceError = next.maxScreenSpaceError;
      this.selection.effectiveViewDistance = next.viewDistance;
    }
  }

  getBudget(): TerrainPyramidBudget {
    return { ...this.budget };
  }

  pressure(): TerrainPyramidStreamPressure {
    this.settleVisibility();
    const residentBytes = this.geometryBytes + this.decodedHeightBytes;
    const tileRatio = this.resident.size / this.budget.maxResidentTiles;
    const byteRatio =
      this.budget.maxResidentBytes === undefined ? 0 : residentBytes / this.budget.maxResidentBytes;
    return {
      residentTiles: this.resident.size,
      residentBytes,
      displayedBytes: this.displayedBytes,
      displayedByteRatio:
        this.budget.maxResidentBytes === undefined
          ? 0
          : this.displayedBytes / this.budget.maxResidentBytes,
      geometryBytes: this.geometryBytes,
      decodedHeightBytes: this.decodedHeightBytes,
      maxResidentTiles: this.budget.maxResidentTiles,
      maxResidentBytes: this.budget.maxResidentBytes,
      tileRatio,
      byteRatio,
      overBudget: tileRatio > 1 || byteRatio > 1,
    };
  }

  refreshMemoryUsage(tiles: 'all' | 'displayed' = 'all'): void {
    if (this.disposed) return;
    this.settleVisibility();
    for (const [key, tile] of this.resident) {
      if (tiles === 'all' || this.visiblyRetains(key)) this.trackAllocations(tile);
    }
    this.refreshDisplayedBytes();
    this.evictUnused();
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
  }

  updateTransitions(nowMs = performance.now()): void {
    for (const [tile, start] of this.morphing) {
      const morph = tile.morph;
      if (!morph) {
        this.morphing.delete(tile);
        continue;
      }
      const progress = (nowMs - start) / (this.options.morphMilliseconds ?? 180);
      const position = terrainGroundSourceGeometry(tile.surface).getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      applySurfaceHeightMorph(position.array as Float32Array, morph, progress);
      position.needsUpdate = true;
      this.cutoutsDirty = true;
      if (progress >= 1 || !tile.surface.visible) {
        applySurfaceHeightMorph(position.array as Float32Array, morph, 1);
        this.morphing.delete(tile);
        delete tile.morph;
      }
    }
    // Hosts update the stream ten times a second while the camera is still, and a cut that
    // outran one budget waited that long for each next one: ground a descent had just shown
    // stood uncut over its own water for most of a second (Seattle's waterfront). Unfinished
    // cuts go on every frame instead, still within one budget a frame.
    if (this.cutoutsDirty && this.groundCutouts.pending) {
      this.renewCutWindow(performance.now());
      this.cutGround();
      this.refreshDisplayedBytes();
    }
  }

  private trackAllocations(tile: ResidentTile, removed = false): void {
    for (const buffer of tile.allocations ?? []) {
      const count = (this.allocations.get(buffer) ?? 1) - 1;
      if (count === 0) {
        this.allocations.delete(buffer);
        this.geometryBytes -= buffer.byteLength;
      } else this.allocations.set(buffer, count);
    }
    const buffers = new Set<ArrayBufferLike>();
    if (!removed)
      tile.object.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const attribute of Object.values(mesh.geometry.attributes))
          buffers.add(attribute.array.buffer);
        if (mesh.geometry.index) buffers.add(mesh.geometry.index.array.buffer);
        const original = terrainGroundSourceGeometry(mesh);
        if (original !== mesh.geometry) {
          for (const attribute of Object.values(original.attributes))
            buffers.add(attribute.array.buffer);
          if (original.index) buffers.add(original.index.array.buffer);
        }
        const instanced = mesh as THREE.InstancedMesh;
        if (instanced.isInstancedMesh) {
          buffers.add(instanced.instanceMatrix.array.buffer);
          if (instanced.instanceColor) buffers.add(instanced.instanceColor.array.buffer);
        }
      });
    tile.allocations = buffers;
    this.allocationsVersion++;
    tile.geometryBytes = 0;
    for (const buffer of buffers) {
      tile.geometryBytes += buffer.byteLength;
      const count = this.allocations.get(buffer) ?? 0;
      if (count === 0) this.geometryBytes += buffer.byteLength;
      this.allocations.set(buffer, count + 1);
    }
  }

  sampleHeight(x: number, z: number): number | undefined {
    this.settleVisibility();
    if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
    const address = terrainPyramidAddressAt(this.descriptor, this.descriptor.maxLevel, x, z);
    if (address === undefined) return undefined;
    const cell = terrainPyramidTileKey(address);
    let tiles = this.heightProbeTiles.get(cell);
    if (tiles === undefined) {
      const shown: ResidentTile[] = [];
      const fallback: ResidentTile[] = [];
      for (let level = address.level; level >= this.descriptor.minLevel; level--) {
        const key = terrainPyramidTileKey(terrainPyramidAncestor(address, level));
        const tile = this.resident.get(key);
        if (tile) (this.displayed.has(key) ? shown : fallback).push(tile);
      }
      tiles = [...shown, ...fallback];
      if (this.heightProbeTiles.size >= 256) this.heightProbeTiles.clear();
      this.heightProbeTiles.set(cell, tiles);
    }
    // An aircraft's center/wheels can cross a tile edge behind its cockpit camera. The visual
    // cut need not include that ground, but its cached height must still support simulation;
    // waiting for a tile behind a stopped camera otherwise deadlocks flight indefinitely.
    for (const tile of tiles) {
      const height = tile.heightfield.sampleHeight(x, z);
      if (Number.isFinite(height)) return height;
    }
    return undefined;
  }

  sampleSurfaceHeight(x: number, z: number): number | undefined {
    this.settleVisibility();
    let fallback: number | undefined;
    for (let level = this.descriptor.maxLevel; level >= this.descriptor.minLevel; level--) {
      const address = terrainPyramidAddressAt(this.descriptor, level, x, z);
      if (address === undefined) continue;
      const key = terrainPyramidTileKey(address);
      const tile = this.resident.get(key);
      if (tile === undefined) continue;
      // Read the live grid so queries follow both reduced resolution and in-progress morphs.
      // Cutouts replace its topology; the original grid remains the terrain anchoring surface.
      const position = terrainGroundSourceGeometry(tile.surface).getAttribute('position');
      const cells = tile.surfaceResolution - 1;
      const size = terrainPyramidTileSize(this.descriptor, level);
      const origin = terrainPyramidTileOrigin(this.descriptor, address);
      const gx = Math.max(0, Math.min(cells, ((x - origin[0]) / size) * cells));
      const gz = Math.max(0, Math.min(cells, ((z - origin[1]) / size) * cells));
      const col = Math.min(cells - 1, Math.floor(gx));
      const row = Math.min(cells - 1, Math.floor(gz));
      const u = gx - col;
      const v = gz - row;
      const nw = row * tile.surfaceResolution + col;
      const ne = position.getY(nw + 1);
      const sw = position.getY(nw + tile.surfaceResolution);
      const height =
        u + v <= 1
          ? position.getY(nw) * (1 - u - v) + ne * u + sw * v
          : position.getY(nw + tile.surfaceResolution + 1) * (u + v - 1) +
            ne * (1 - v) +
            sw * (1 - u);
      if (this.displayed.has(key)) return height;
      fallback ??= height;
    }
    return fallback;
  }

  isAreaReady(x: number, z: number, radius: number): boolean {
    this.settleVisibility();
    const area: [number, number, number, number] = [x - radius, z - radius, x + radius, z + radius];
    let covered = false;
    for (const [key, address] of this.selected) {
      if (!boxesIntersect(tileBounds(this.descriptor, address), area)) continue;
      const tile = this.resident.get(key);
      if (tile === undefined || !this.displayed.has(key) || !this.layersReady(tile, true))
        return false;
      for (const id of tile.layers.keys()) {
        if (this.layerVisibility.get(id) === true && !this.displayedLayers.get(id)?.has(key))
          return false;
      }
      // Ground still showing what a refresh is replacing is not ready to stand on: the walls
      // there are about to change. A replacement that failed for good does not hold it back.
      for (const id of this.layerById.keys()) {
        const layerKey = `${key}:${id}`;
        if (this.outdatedLayers.has(layerKey) && this.layerRetries.state(layerKey) !== 'failed')
          return false;
      }
      covered = true;
    }
    return covered;
  }

  setLayerVisible(id: string, visible: boolean): void {
    const layer = this.layerById.get(id);
    if (layer === undefined) throw new Error(`unknown terrain pyramid tile layer "${id}"`);
    this.layerVisibility.set(id, visible);
    if (!visible) {
      for (const key of this.resident.keys()) this.layerRetries.clear(`${key}:${id}`);
    }
    // A layer can become visible while a previously bare surface is refining. Finish both
    // active and not-yet-visible morphs before attaching geometry grounded on target heights.
    if (visible) {
      for (const tile of this.resident.values()) {
        if (!tile.morph) continue;
        const position = terrainGroundSourceGeometry(tile.surface).getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        applySurfaceHeightMorph(position.array as Float32Array, tile.morph, 1);
        position.needsUpdate = true;
        this.cutoutsDirty = true;
        this.morphing.delete(tile);
        delete tile.morph;
      }
    }
    for (const [key, request] of this.pendingLayers) {
      if (request.layer.id === id && !visible) {
        request.controller.abort();
        this.pendingLayers.delete(key);
      }
    }
    this.updateVisibility();
    this.evictUnused();
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
  }

  isLayerVisible(id: string): boolean {
    if (!this.layerById.has(id)) throw new Error(`unknown terrain pyramid tile layer "${id}"`);
    return this.layerVisibility.get(id) === true;
  }

  residentTiles(): TerrainPyramidTileAddress[] {
    this.settleVisibility();
    return [...this.resident.values()]
      .map((tile) => ({ ...tile.address }))
      .sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
  }

  displayedTiles(): TerrainPyramidTileAddress[] {
    this.settleVisibility();
    return [...this.displayed]
      .map(addressFromKey)
      .sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
  }

  failedTiles(): TerrainPyramidTileAddress[] {
    return this.retries
      .stableKeys()
      .map(addressFromKey)
      .sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
  }

  tileFailures(): Array<TerrainTileFailure<TerrainPyramidTileAddress>> {
    return this.retries
      .failures()
      .sort(
        (a, b) =>
          a.address.level - b.address.level ||
          a.address.z - b.address.z ||
          a.address.x - b.address.x,
      );
  }

  retryFailed(): void {
    if (this.disposed || this.view === undefined) return;
    this.retries.clearAll();
    this.layerRetries.clearAll();
    this.plan(this.view);
  }

  refreshLayers(options: TerrainPyramidLayerRefresh): Promise<void> {
    const ids = options.layers ?? [...this.layerById.keys()];
    for (const id of ids)
      if (!this.layerById.has(id)) throw new Error(`unknown terrain pyramid tile layer "${id}"`);
    const [minX, minZ, maxX, maxZ] = options.bounds;
    if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || minX > maxX || minZ > maxZ)
      throw new Error('refresh bounds must be a finite [minX, minZ, maxX, maxZ] rectangle');
    if (this.disposed) return Promise.resolve();
    // Decide what is on screen from the current state, not a pass a publication left queued.
    this.settleVisibility();
    const waiting = new Set<string>();
    for (const [tileKey, tile] of this.resident) {
      // Touching counts: a change on a tile's edge is drawn by both tiles that share it.
      const [x0, z0, x1, z1] = tileBounds(this.descriptor, tile.address);
      if (x0 > maxX || x1 < minX || z0 > maxZ || z1 < minZ) continue;
      for (const id of ids) {
        const key = `${tileKey}:${id}`;
        // A build under way was made from what changed. The pump starts it over.
        const request = this.pendingLayers.get(key);
        if (request !== undefined) {
          request.controller.abort();
          this.pendingLayers.delete(key);
        }
        this.layerRetries.clear(key);
        // The build that follows is asked for, not one the cache lost (see rebuiltLayers).
        this.layerBuilds.delete(key);
        if (!tile.layers.has(id) && !tile.emptyLayers.has(id)) continue;
        if (this.displayedLayers.get(id)?.has(tileKey) === true) {
          this.outdatedLayers.set(key, { tileKey, layerId: id });
          waiting.add(key);
        } else {
          // Hidden in the warm cache, or prepared behind what is displayed: nothing to keep on
          // screen, and it must not come back as it was.
          this.outdatedLayers.delete(key);
          this.settleRefresh(key);
          this.dropLayer(tile, id);
        }
      }
    }
    const refreshed =
      waiting.size === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => this.refreshWaiters.push({ keys: waiting, resolve }));
    // Builds are under way (or queued behind a full window) before this returns, so a caller
    // awaiting `whenIdle` next waits for them too.
    this.updateVisibility();
    this.evictUnused();
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
    return refreshed;
  }

  /** A tile layer a refresh was waiting on is replaced, or will not be: tell its callers. */
  private settleRefresh(key: string): void {
    if (this.refreshWaiters.length === 0) return;
    this.refreshWaiters = this.refreshWaiters.filter((waiter) => {
      waiter.keys.delete(key);
      if (waiter.keys.size > 0) return true;
      waiter.resolve();
      return false;
    });
  }

  /** Take a tile's layer object (or its empty mark) away, to be built again when next wanted. */
  private dropLayer(tile: ResidentTile, id: string): void {
    tile.emptyLayers.delete(id);
    const object = tile.layers.get(id);
    if (object === undefined) return;
    this.groundCutouts.restore(object);
    tile.object.remove(object);
    tile.layers.delete(id);
    this.layerById.get(id)?.disposeTile?.(object);
    this.trackAllocations(tile);
    this.cutoutsDirty = true;
  }

  stats(options: TerrainPyramidStatsOptions = {}): TerrainPyramidStreamStats {
    this.settleVisibility();
    let decodedSamples = 0;
    let layerObjects = 0;
    for (const tile of this.resident.values()) {
      decodedSamples += tile.heightfield.cols * tile.heightfield.rows;
      layerObjects += tile.layers.size;
    }
    const failures = this.retries.counts();
    const layerFailures = this.layerRetries.counts();
    const visibleGeometry = objectGeometryStats(this.object, true);
    let allocatedBytes = this.geometryBytes;
    if (options.geometry !== 'tracked') {
      const counted = new Set<ArrayBufferLike>();
      allocatedBytes = objectGeometryStats(this.object, false, counted).bytes;
      // Hidden tiles are out of the scene graph, and walking them would make a large cache cost a
      // hitch at each sample; nothing changes them while they wait, so their tracked buffers stand.
      for (const tile of this.resident.values()) {
        if (tile.attached) continue;
        for (const buffer of tile.allocations ?? []) {
          if (counted.has(buffer)) continue;
          counted.add(buffer);
          allocatedBytes += buffer.byteLength;
        }
      }
    }
    const levels = this.displayedTiles().map((tile) => tile.level);
    let fallbackLeaves = 0;
    for (const address of this.selected.values()) {
      if (!this.resident.has(terrainPyramidTileKey(address))) fallbackLeaves++;
    }
    return {
      preloading: this.preloading.size,
      preloaded: [...this.preloading].filter((key) => {
        const tile = this.resident.get(key);
        return tile !== undefined && this.layersReady(tile);
      }).length,
      failedLayers: layerFailures.failed,
      retryingLayers: layerFailures.retrying,
      desired: this.selected.size,
      queued: this.queue.length,
      loading: this.pending.size,
      loadingLayers: this.pendingLayers.size,
      resident: this.resident.size,
      failed: failures.missing + failures.failed,
      missing: failures.missing,
      retrying: failures.retrying,
      layerObjects,
      evictions: this.evictionCount,
      decodedSamples,
      geometryBytes: allocatedBytes,
      triangles: visibleGeometry.triangles,
      instances: visibleGeometry.instances,
      drawCalls: visibleGeometry.drawCalls,
      selected: this.selected.size,
      displayed: this.displayed.size,
      fallbackLeaves,
      minDisplayedLevel: levels.length > 0 ? Math.min(...levels) : undefined,
      maxDisplayedLevel: levels.length > 0 ? Math.max(...levels) : undefined,
      effectiveScreenSpaceError: this.selection.effectiveScreenSpaceError,
      effectiveViewDistance: this.selection.effectiveViewDistance,
      builtTiles: this.buildCounts.tiles,
      rebuiltTiles: this.buildCounts.rebuiltTiles,
      builtLayers: this.buildCounts.layers,
      rebuiltLayers: this.buildCounts.rebuiltLayers,
      refreshedLayers: this.buildCounts.refreshedLayers,
      refreshingLayers: this.outdatedLayers.size,
      aheadTiles: this.ahead.size,
      aheadReady: [...this.ahead.keys()].filter((key) => {
        const tile = this.resident.get(key);
        return tile !== undefined && this.layersReady(tile);
      }).length,
      cameraSpeed: this.track.speed,
      speedLevel: this.speedLevel,
      refinedInView: this.transitions.refinedInView,
      coarsenedInView: this.transitions.coarsenedInView,
    };
  }

  loading(): { tiles: number; layers: number } {
    return { tiles: this.pending.size, layers: this.pendingLayers.size };
  }

  viewCoverage(edges: readonly number[]): TerrainPyramidCoverageBand[] {
    this.settleVisibility();
    const bands: TerrainPyramidCoverageBand[] = [...edges, Number.POSITIVE_INFINITY].map(
      (to, index) => ({
        from: index === 0 ? 0 : (edges[index - 1] as number),
        to,
        tiles: 0,
        complete: 0,
        stale: 0,
        bare: 0,
        empty: 0,
        drawnLevel: undefined,
      }),
    );
    const view = this.view;
    if (view === undefined) return bands;
    const levelArea = bands.map(() => ({ sum: 0, area: 0 }));
    const addLevel = (band: number, address: TerrainPyramidTileAddress, level: number): void => {
      const area = terrainPyramidTileSize(this.descriptor, address.level) ** 2;
      const entry = levelArea[band] as { sum: number; area: number };
      entry.sum += level * area;
      entry.area += area;
    };
    const visibleLayers = [...this.layerById.values()].filter(
      (layer) => this.layerVisibility.get(layer.id) === true,
    );
    const layersShown = (key: string, level: number): boolean =>
      visibleLayers.every(
        (layer) =>
          !this.layerEligible(layer, level) ||
          this.displayedLayers.get(layer.id)?.has(key) === true,
      );
    const drawn = [...this.displayed]
      .map((key) => ({ key, tile: this.resident.get(key) }))
      .filter((entry) => entry.tile !== undefined) as Array<{ key: string; tile: ResidentTile }>;
    for (const [key, address] of this.selected) {
      const bounds = tileBounds(this.descriptor, address);
      if (!intersectsHorizontalView(view, bounds, 0)) continue;
      const distance = distanceToBounds(view.position, bounds, this.descriptor.height);
      const index = bands.findIndex((entry) => distance < entry.to);
      const band = bands[index] as TerrainPyramidCoverageBand;
      band.tiles++;
      if (this.displayed.has(key)) {
        if (layersShown(key, address.level)) band.complete++;
        else band.bare++;
        addLevel(index, address, address.level);
        continue;
      }
      const covering = drawn.filter(({ tile }) => pyramidAddressesOverlap(tile.address, address));
      if (covering.length === 0) band.empty++;
      else if (covering.every(({ key: id, tile }) => layersShown(id, tile.address.level)))
        band.stale++;
      else band.bare++;
      if (covering.length > 0)
        addLevel(index, address, Math.max(...covering.map(({ tile }) => tile.address.level)));
    }
    bands.forEach((band, index) => {
      const { sum, area } = levelArea[index] as { sum: number; area: number };
      if (area > 0) band.drawnLevel = sum / area;
    });
    return bands;
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.trackSilence);
    for (const request of this.pending.values()) request.controller.abort();
    for (const request of this.pendingLayers.values()) request.controller.abort();
    this.pending.clear();
    this.pendingLayers.clear();
    this.retries.dispose();
    this.layerRetries.dispose();
    this.morphing.clear();
    this.queue = [];
    this.aheadQueue = [];
    this.ahead.clear();
    this.groundCutouts.dispose();
    for (const key of [...this.resident.keys()]) this.evict(key);
    // Nothing is left to replace: refreshes in progress end here.
    this.outdatedLayers.clear();
    const waiters = this.refreshWaiters;
    this.refreshWaiters = [];
    for (const waiter of waiters) waiter.resolve();
    this.object.removeFromParent();
    if (this.ownsMaterial) this.material.dispose();
    this.source.dispose?.();
    this.resolveIdleIfNeeded();
  }

  private startQueuedLoads(): void {
    while (this.pending.size < this.budget.maxConcurrentLoads && this.queue.length > 0) {
      // A quality reduction can put old displayed descendants above the new cap. Permit one
      // replacement parent at a time; removing children first would expose a hole or deadlock.
      if (
        this.resident.size + this.pending.size >= this.budget.maxResidentTiles &&
        (this.pending.size > 0 ||
          !this.queue.some((tile) => this.replacesDisplayedDescendants(tile.address)))
      )
        break;
      const transitionIndex =
        this.resident.size >= this.budget.maxResidentTiles
          ? this.queue.findIndex((tile) => this.replacesDisplayedDescendants(tile.address))
          : -1;
      // Keep bounded capacity making forward progress during continuous travel. Requiring the visible
      // queue to empty first starves preparation precisely when flight outruns the pipeline.
      const preloadIndex = this.reservePreloadSlot(
        this.pending.values(),
        this.budget.maxConcurrentLoads,
      )
        ? this.queue.findIndex((tile) =>
            this.preparationTargets.has(terrainPyramidTileKey(tile.address)),
          )
        : -1;
      const nextIndex =
        transitionIndex >= 0 ? transitionIndex : preloadIndex >= 0 ? preloadIndex : 0;
      const wanted = this.queue.splice(nextIndex, 1)[0] as WantedTile;
      const key = terrainPyramidTileKey(wanted.address);
      if (!this.wanted.has(key) || this.resident.has(key) || this.pending.has(key)) continue;
      this.startLoad(wanted.address);
    }
    // Then tiles ahead of the camera, keeping a load free for anything the camera turns to see.
    const aheadLoads = Math.max(1, this.budget.maxConcurrentLoads - 1);
    while (
      this.queue.length === 0 &&
      this.pending.size < aheadLoads &&
      this.aheadQueue.length > 0 &&
      this.resident.size + this.pending.size < this.budget.maxResidentTiles &&
      this.hasRoomAhead()
    ) {
      const next = this.aheadQueue.shift() as AheadTile;
      const key = terrainPyramidTileKey(next.address);
      if (
        this.ahead.has(key) &&
        !this.wanted.has(key) &&
        !this.resident.has(key) &&
        !this.pending.has(key)
      )
        this.startLoad(next.address);
    }
  }

  private startLoad(address: TerrainPyramidTileAddress): void {
    const key = terrainPyramidTileKey(address);
    const controller = new AbortController();
    this.pending.set(key, { address, controller });
    const resolution = this.budget.maxSurfaceTileResolution;
    const request = loadTerrainTileWithTimeout<PreparedTile | undefined>(
      async (signal): Promise<PreparedTile | undefined> => {
        const prepared = this.source.loadPrepared
          ? await this.source.loadPrepared(address, signal, resolution)
          : await this.source
              .load(address, signal)
              .then((heightfield) =>
                heightfield === undefined ? undefined : { heightfield, geometry: undefined },
              );
        if (!prepared || signal.aborted || !this.options.transformHeightfield) return prepared;
        const heightfield = await this.options.transformHeightfield(
          {
            address,
            pyramid: this.descriptor,
            descriptor: surfaceDescriptor(this.descriptor, address),
            heightfield: prepared.heightfield,
            surfaceResolution: surfaceResolution(this.descriptor, resolution),
            origin: terrainPyramidTileOrigin(this.descriptor, address),
            tileSize: terrainPyramidTileSize(this.descriptor, address.level),
            signal,
          },
          this.source,
        );
        if (heightfield === prepared.heightfield) return prepared;
        // Graded ground beside an airport was meshed on the main thread, up to 20 ms a tile in one
        // admitted job, while a takeoff streamed in every tile around the field.
        const geometry = await this.source.meshPrepared?.(heightfield, address, signal, resolution);
        return geometry === undefined ? { heightfield } : { heightfield, geometry };
      },
      controller.signal,
      this.retryPolicy.requestTimeoutMs,
    );
    void request
      .then(async (prepared) => {
        if (this.disposed || controller.signal.aborted) return;
        if (prepared === undefined) {
          // A track running off the data's edge is not worth a report, but must not ask again.
          if (this.wanted.has(key) || this.ahead.has(key)) {
            this.retries.markMissing(key, address);
            if (this.wanted.has(key)) {
              this.options.onError?.(new Error(`terrain pyramid tile ${key} is missing`), {
                address,
              });
            }
          }
          return;
        }
        this.retries.clear(key);
        await this.addResident(
          address,
          prepared.heightfield,
          controller.signal,
          resolution,
          prepared.geometry,
        );
      })
      .catch((error: unknown) => {
        if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
        this.retries.markFailed(key, address, error, () => this.retryDueTiles());
        this.options.onError?.(error, { address });
      })
      .finally(() => {
        if (this.pending.get(key)?.controller === controller) this.pending.delete(key);
        this.startQueuedLoads();
        this.resolveIdleIfNeeded();
      });
  }

  /** A backoff delay elapsed: replan against the latest view, which requeues the tile. */
  private retryDueTiles(): void {
    if (this.disposed || this.view === undefined) {
      this.resolveIdleIfNeeded();
      return;
    }
    this.plan(this.view);
    this.resolveIdleIfNeeded();
  }

  private async addResident(
    address: TerrainPyramidTileAddress,
    heightfield: Heightfield,
    signal: AbortSignal,
    resolution: number,
    prepared?: ChunkGeometry,
  ): Promise<void> {
    const key = terrainPyramidTileKey(address);
    if (this.resident.has(key)) return;
    const object = this.options.createTileGroup?.() ?? new THREE.Group();
    skipHiddenWorldMatrices(object);
    const origin = terrainPyramidTileOrigin(this.descriptor, address);
    object.name = `tile:${key}`;
    // The tile's own water cuts its ground and land cover; neighbors' level changes leave it be.
    markTerrainGroundCutScope(object);
    object.position.set(origin[0], 0, origin[1]);
    // Collision scans skip tiles out of reach (see WalkCollision); content overhangs a tile edge
    // by a few meters at most.
    const size = terrainPyramidTileSize(this.descriptor, address.level);
    object.userData.walkFootprint = [-16, -16, size + 16, size + 16];
    let morph: SurfaceHeightMorph | undefined;
    const surface = await this.admit(
      () => {
        const result = createSurface(
          this.descriptor,
          address,
          heightfield,
          this.material,
          resolution,
          prepared,
          this.levelNeighborHeight(address.level),
          this.options.surfaceColor,
        );
        if (
          (this.options.morphMilliseconds ?? 0) > 0 &&
          ![...this.layerVisibility.values()].some(Boolean)
        ) {
          for (let level = address.level - 1; level >= this.descriptor.minLevel; level--) {
            const parent = this.resident.get(
              terrainPyramidTileKey(terrainPyramidAncestor(address, level)),
            );
            if (!parent?.surface.visible || parent.morph) continue;
            const parentOrigin = terrainPyramidTileOrigin(this.descriptor, parent.address);
            const attribute = result.mesh.geometry.getAttribute(
              'position',
            ) as THREE.BufferAttribute;
            const full = attribute.array as Float32Array;
            const surfaceVertices = surfaceResolution(this.descriptor, resolution) ** 2;
            // Skirts keep their full depth throughout the transition.
            morph = prepareSurfaceHeightMorph(full.subarray(0, surfaceVertices * 3), {
              positions: terrainGroundSourceGeometry(parent.surface).getAttribute('position')
                .array as Float32Array,
              resolution: parent.surfaceResolution,
              size: terrainPyramidTileSize(this.descriptor, level),
              offsetX: origin[0] - parentOrigin[0],
              offsetZ: origin[1] - parentOrigin[1],
            });
            if (morph) {
              applySurfaceHeightMorph(full, morph, 0);
              // Bounds cover both ends of the morph, and so every height between them.
              const original = result.mesh.geometry.boundingSphere?.clone();
              const box = result.mesh.geometry.boundingBox?.clone();
              result.mesh.geometry.computeBoundingSphere();
              result.mesh.geometry.computeBoundingBox();
              if (original) result.mesh.geometry.boundingSphere?.union(original);
              if (box) result.mesh.geometry.boundingBox?.union(box);
            }
            break;
          }
        }
        return result;
      },
      signal,
      'terrain-assembly',
      0,
      'urgent',
    );
    object.add(surface.mesh);
    // Before preparing: the renderer builds the surface's shaders for its shadow flags.
    if (this.options.shadows === true) surface.mesh.receiveShadow = true;
    try {
      // Ground is small and the view waits on it: its preparation and publication are admitted
      // ahead of layer work, which otherwise held a tile's residency for frames behind uploads.
      object.userData.admissionPriority = 'urgent';
      try {
        await this.options.prepareObject?.(object, signal);
      } finally {
        delete object.userData.admissionPriority;
      }
      await this.admit(
        () => {
          if (this.disposed || signal.aborted)
            throw new DOMException('Tile cancelled', 'AbortError');
          surface.mesh.visible = false;
          freezeStaticTransforms(object);
          this.resident.set(key, {
            attached: true,
            address,
            heightfield,
            object,
            surface: surface.mesh,
            geometryBytes: surface.bytes,
            decodedHeightBytes:
              heightfield.cols * heightfield.rows * Float32Array.BYTES_PER_ELEMENT,
            surfaceResolution: surfaceResolution(this.descriptor, resolution),
            triangles: surface.triangles,
            lastUsed: this.usage,
            layers: new Map(),
            ...(morph ? { morph } : {}),
            emptyLayers: new Set(),
          });
          this.buildCounts.tiles++;
          if (this.tileBuilds.has(key)) this.buildCounts.rebuiltTiles++;
          this.tileBuilds.add(key);
          this.trackAllocations(this.resident.get(key) as ResidentTile);
          this.decodedHeightBytes +=
            heightfield.cols * heightfield.rows * Float32Array.BYTES_PER_ELEMENT;
          this.object.add(object);
          this.refreshBorderNormals(this.resident.get(key) as ResidentTile);
          this.requestVisibility();
        },
        signal,
        'terrain-publication',
        surface.bytes,
        'urgent',
      );
    } catch (error) {
      surface.mesh.geometry.dispose();
      throw error;
    }
  }

  /**
   * Heights from the same-level resident neighbour covering (x, z), for border normals. A sample
   * exactly on a tile border belongs to either neighbour, which share that height.
   */
  private levelNeighborHeight(level: number): TerrainNeighborHeightSampler {
    const size = terrainPyramidTileSize(this.descriptor, level);
    const count = terrainPyramidTileCount(level);
    return (x, z) => {
      const u = (x - this.descriptor.origin[0]) / size;
      const v = (z - this.descriptor.origin[1]) / size;
      for (const x2 of neighborTileIndices(u)) {
        if (x2 < 0 || x2 >= count) continue;
        for (const z2 of neighborTileIndices(v)) {
          if (z2 < 0 || z2 >= count) continue;
          const key = terrainPyramidTileKey({ level, x: x2, z: z2 });
          const height = this.resident.get(key)?.heightfield.sampleHeight(x, z);
          if (height !== undefined) return height;
        }
      }
      return undefined;
    };
  }

  /**
   * Make both sides of every shared same-level border agree once this tile is resident. Each side
   * recomputes its own edge normals from the neighbour's heights, so nothing is re-meshed and a
   * worker-prepared surface (which never saw a neighbour) converges the same way.
   */
  private refreshBorderNormals(tile: ResidentTile): void {
    const { level, x, z } = tile.address;
    const borders: Array<[dx: number, dz: number, own: ChunkEdge, theirs: ChunkEdge]> = [
      [-1, 0, 'west', 'east'],
      [1, 0, 'east', 'west'],
      [0, -1, 'north', 'south'],
      [0, 1, 'south', 'north'],
    ];
    for (const [dx, dz, own, theirs] of borders) {
      const other = this.resident.get(terrainPyramidTileKey({ level, x: x + dx, z: z + dz }));
      if (other === undefined) continue;
      this.refreshEdge(tile, own);
      this.refreshEdge(other, theirs);
    }
  }

  private refreshEdge(tile: ResidentTile, edge: ChunkEdge): void {
    const attribute = terrainGroundSourceGeometry(tile.surface).getAttribute('normal');
    const normals = attribute?.array;
    if (!(normals instanceof Float32Array)) return;
    const refreshed = refreshChunkEdgeNormals(
      tile.heightfield,
      surfaceDescriptor(this.descriptor, tile.address),
      tile.address.x,
      tile.address.z,
      edge,
      {
        normals,
        skirt: this.descriptor.skirts,
        neighborHeight: this.levelNeighborHeight(tile.address.level),
      },
    );
    if (refreshed) {
      attribute.needsUpdate = true;
      this.cutoutsDirty = true;
    }
  }

  private admit<T>(
    task: () => T,
    signal: AbortSignal,
    label: string,
    bytes = 0,
    priority: 'urgent' | 'normal' = 'normal',
    order?: () => number,
  ): Promise<T> {
    if (this.options.admission)
      return this.options.admission.run(task, {
        signal,
        label,
        bytes,
        priority,
        ...(order ? { order } : {}),
      });
    if (signal.aborted) return Promise.reject(new DOMException('Tile cancelled', 'AbortError'));
    return Promise.resolve().then(task);
  }

  private requestVisibility(): void {
    if (this.visibilityQueued) return;
    this.visibilityQueued = true;
    queueMicrotask(() => this.settleVisibility());
  }

  /** Run a requested visibility pass now, with the eviction its publications deferred. */
  private settleVisibility(): void {
    if (!this.visibilityQueued || this.disposed) return;
    this.updateVisibility();
    this.evictUnused();
  }

  private updateVisibility(): void {
    this.visibilityQueued = false;
    this.heightProbeTiles.clear();
    this.layerPriorities.clear();
    const previousDisplayed = this.displayed;
    const candidates = new Set<string>();
    const incompleteParents = new Set<string>();
    for (const leaf of this.selected.values()) {
      const tile = this.resident.get(terrainPyramidTileKey(leaf));
      if (tile && this.layersReady(tile)) continue;
      for (let level = leaf.level - 1; level >= this.descriptor.minLevel; level--)
        incompleteParents.add(terrainPyramidTileKey(terrainPyramidAncestor(leaf, level)));
    }
    // Tiles any layer currently displays, gathered once rather than per leaf and candidate.
    const layered = new Set<string>();
    for (const keys of this.displayedLayers.values()) for (const key of keys) layered.add(key);
    for (const leaf of this.selected.values()) {
      // Refine an already detailed tile one generation at a time. Jumping straight from a
      // large parent to dozens of leaves hides every finished leaf behind the slowest one.
      // Intermediate families keep the handoff atomic while allowing nearby families to
      // finish independently. Missing/evicted intermediates do not block resident leaves.
      let replacementLevel = leaf.level;
      for (const previousKey of previousDisplayed) {
        const previous = this.resident.get(previousKey);
        if (
          previous &&
          incompleteParents.has(previousKey) &&
          previous.address.level < leaf.level &&
          pyramidAddressesOverlap(previous.address, leaf) &&
          layered.has(previousKey) &&
          this.resident.has(
            terrainPyramidTileKey(terrainPyramidAncestor(leaf, previous.address.level + 1)),
          )
        )
          replacementLevel = Math.min(replacementLevel, previous.address.level + 1);
      }
      // The nearest resident stand-in: the leaf itself or its closest cached ancestor.
      let standIn: TerrainPyramidTileAddress | undefined;
      for (let level = replacementLevel; level >= this.descriptor.minLevel; level--) {
        const address = terrainPyramidAncestor(leaf, level);
        if (this.resident.has(terrainPyramidTileKey(address))) {
          standIn = address;
          break;
        }
      }
      if (standIn !== undefined && standIn.level === leaf.level) {
        candidates.add(terrainPyramidTileKey(standIn));
        continue;
      }
      // Until the leaf arrives, finer ground already on screen over it stays. Stepping back to a
      // coarser stand-in would drop visible detail, after zooming out or when the warm cache
      // has lost the intermediate levels.
      const floor = standIn?.level ?? Number.NEGATIVE_INFINITY;
      let retained = false;
      for (const key of previousDisplayed) {
        const address = this.resident.get(key)?.address;
        if (
          address !== undefined &&
          address.level > floor &&
          pyramidAddressesOverlap(address, leaf)
        ) {
          candidates.add(key);
          retained = true;
        }
      }
      if (retained || standIn === undefined) continue;
      // A distant stand-in covers far more than this leaf. When it would hide detail on screen
      // elsewhere, leave this leaf's patch briefly empty rather than blank that whole area.
      const coarse = standIn;
      let hidesDetail = false;
      for (const key of previousDisplayed) {
        const address = this.resident.get(key)?.address;
        if (
          address !== undefined &&
          address.level > coarse.level &&
          pyramidAddressesOverlap(address, coarse) &&
          !pyramidAddressesOverlap(address, leaf)
        ) {
          hidesDetail = true;
          break;
        }
      }
      if (!hidesDetail) candidates.add(terrainPyramidTileKey(coarse));
    }
    // First find the surface-only cut. Its hidden tiles must prepare layers too, including
    // intermediate fallbacks when a selected leaf is missing or still loading.
    this.replacementTiles = this.withoutCoveredDescendants(candidates);
    const prepared = new Set<string>();
    for (const key of this.replacementTiles) {
      const tile = this.resident.get(key) as ResidentTile;
      if (previousDisplayed.has(key) || this.layersReady(tile)) {
        prepared.add(key);
        continue;
      }
      let retained = false;
      for (const previousKey of previousDisplayed) {
        const previousTile = this.resident.get(previousKey);
        if (previousTile && pyramidAddressesOverlap(tile.address, previousTile.address)) {
          // A bare ancestor has no detail to preserve. Do not pin an entire region to it
          // while new building layers finish; only wait for layers it actually displays.
          if (!this.losesVisibleLayers(previousKey, tile)) continue;
          prepared.add(previousKey);
          retained = true;
        }
      }
      // Unvisited ground has no old visual to retain. Show its base surface immediately,
      // then publish water immediately and other enabled layers together once they settle.
      if (!retained) prepared.add(key);
    }
    // A retained parent suppresses every replacement beneath it until all siblings are ready.
    const displayed = this.withoutCoveredDescendants(prepared);
    this.displayed = displayed;
    this.countTransitions(previousDisplayed, displayed);
    for (const [key, tile] of this.resident) {
      const tileVisible = displayed.has(key);
      if (tileVisible && !tile.surface.visible && tile.morph && !this.morphing.has(tile))
        this.morphing.set(tile, performance.now());
      if (tile.surface.visible !== tileVisible) this.cutoutsDirty = true;
      tile.surface.visible = tileVisible;
    }
    this.updateLayerVisibility();
    // A tile the camera no longer wants may come round again. Let its semantic work finish into
    // the warm resident cache: a cancelled request leaves its worker job running with nothing to
    // show for it. Eviction and explicit layer toggles are the boundaries that abort it.
    for (const [key, request] of this.pendingLayers) {
      if (this.layerVisibility.get(request.layer.id) !== true) {
        request.controller.abort();
        this.pendingLayers.delete(key);
      }
    }
    this.layerRetries.forgetUnwanted((_key, { address, layerId }) => {
      const tileKey = terrainPyramidTileKey(address);
      return (
        layerId !== undefined &&
        this.layerVisibility.get(layerId) === true &&
        (displayed.has(tileKey) ||
          this.wanted.has(tileKey) ||
          this.ahead.has(tileKey) ||
          this.replacementTiles.has(tileKey) ||
          this.displayedLayers.get(layerId)?.has(tileKey) === true)
      );
    });
    this.startQueuedLayerLoads();
  }

  /** Count ground on screen that changed level: detail arriving, and detail given up. */
  private countTransitions(previous: ReadonlySet<string>, next: ReadonlySet<string>): void {
    const view = this.view;
    if (view === undefined) return;
    const before = [...previous]
      .map((key) => this.resident.get(key)?.address)
      .filter((address): address is TerrainPyramidTileAddress => address !== undefined);
    const inView = (address: TerrainPyramidTileAddress): boolean =>
      intersectsHorizontalView(view, tileBounds(this.descriptor, address), 0);
    for (const key of next) {
      if (previous.has(key)) continue;
      const address = this.resident.get(key)?.address;
      if (address === undefined || !inView(address)) continue;
      const replaced = before.filter((old) => pyramidAddressesOverlap(old, address));
      // Detail given up counts only where it was on screen: a large tile's bounds reach into the
      // view beside the camera after the finer ground it covers has left it.
      if (replaced.some((old) => old.level > address.level && inView(old)))
        this.transitions.coarsenedInView++;
      else if (replaced.some((old) => old.level < address.level)) this.transitions.refinedInView++;
    }
  }

  /** Choose one non-overlapping cut, keeping a parent whenever a child still needs it. */
  private withoutCoveredDescendants(candidates: Set<string>): Set<string> {
    const result = new Set(candidates);
    const addresses: TerrainPyramidTileAddress[] = [];
    const present = new Set<number>();
    for (const key of candidates) {
      const address = this.resident.get(key)?.address ?? addressFromKey(key);
      addresses.push(address);
      present.add(address.level);
    }
    // Only a level some candidate is at can hold a covering ancestor: building every ancestor's
    // key, down to the root, for each candidate was a few milliseconds of every pass.
    const levels = [...present].filter((level) => level >= this.descriptor.minLevel);
    let i = 0;
    for (const key of candidates) {
      const address = addresses[i++] as TerrainPyramidTileAddress;
      for (const level of levels) {
        if (
          level < address.level &&
          candidates.has(terrainPyramidTileKey(terrainPyramidAncestor(address, level)))
        ) {
          result.delete(key);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Expensive detail is built for ground in the camera's view and its guard band.
   * Peripheral and surround terrain also prepare the independent layers (hydrology by
   * default), so a turn never starts with a dry lakebed.
   */
  private wantsLayers(address: TerrainPyramidTileAddress): boolean {
    const peripheral =
      (this.budget.peripheralDegrees ?? 0) > 0 || (this.budget.surroundDetail ?? 0) > 0;
    return (
      this.preparationTargets.has(terrainPyramidTileKey(address)) ||
      !peripheral ||
      this.view === undefined ||
      this.ahead.has(terrainPyramidTileKey(address)) ||
      intersectsHorizontalView(this.view, tileBounds(this.descriptor, address))
    );
  }

  /** Whether a coarser tile on screen already draws the layers this tile has yet to build. */
  private coveredByCoarserLayers(tile: ResidentTile): boolean {
    for (const layer of this.layerById.values()) {
      if (
        this.layerVisibility.get(layer.id) !== true ||
        !this.layerEligible(layer, tile.address.level) ||
        tile.layers.has(layer.id) ||
        tile.emptyLayers.has(layer.id)
      )
        continue;
      const shown = this.displayedLayers.get(layer.id);
      let covered = false;
      for (let level = tile.address.level - 1; level >= this.descriptor.minLevel; level--) {
        if (shown?.has(terrainPyramidTileKey(terrainPyramidAncestor(tile.address, level)))) {
          covered = true;
          break;
        }
      }
      if (!covered) return false;
    }
    return true;
  }

  private layersReady(tile: ResidentTile, allowFailed = false): boolean {
    const detail = this.wantsLayers(tile.address);
    for (const layer of this.layerById.values()) {
      if (
        (detail || this.independentCategories.has(layer.category)) &&
        this.layerVisibility.get(layer.id) === true &&
        this.layerEligible(layer, tile.address.level) &&
        !tile.layers.has(layer.id) &&
        !tile.emptyLayers.has(layer.id) &&
        !(
          allowFailed &&
          this.layerRetries.state(`${terrainPyramidTileKey(tile.address)}:${layer.id}`) === 'failed'
        )
      )
        return false;
    }
    return true;
  }

  /** Only existing, visible detail needs an atomic replacement. New layers can arrive later. */
  private losesVisibleLayers(previousKey: string, replacement: ResidentTile): boolean {
    for (const [id, displayed] of this.displayedLayers) {
      if (
        displayed.has(previousKey) &&
        this.layerVisibility.get(id) === true &&
        this.resident.get(previousKey)?.layers.has(id) &&
        this.layerEligible(
          this.layerById.get(id) as TerrainPyramidTileLayer,
          replacement.address.level,
        ) &&
        !replacement.layers.has(id) &&
        !replacement.emptyLayers.has(id)
      )
        return true;
    }
    return false;
  }

  /** Publish independent layers on their own; retain atomic detail and coverage during handoffs. */
  private updateLayerVisibility(): void {
    // Match the surface handoff's losesVisibleLayers rule. A replacement may already carry
    // every layer its predecessor displayed, while a newly eligible layer is still building.
    // Publish that inherited detail with its surface; otherwise an unrelated new layer on
    // one sibling pins the old parent over all siblings, hiding even fully prepared leaves.
    const inheritedReady = new Map<string, Set<string>>();
    // Each displayed tile's readiness, once per pass rather than once per layer.
    const readiness = new Map<ResidentTile, boolean>();
    const ready = (tile: ResidentTile): boolean => {
      let result = readiness.get(tile);
      if (result === undefined) {
        result = this.layersReady(tile, true);
        readiness.set(tile, result);
      }
      return result;
    };
    for (const key of this.displayed) {
      const tile = this.resident.get(key);
      if (tile === undefined || ready(tile)) continue;
      const inherited = new Set<string>();
      for (const [id, previous] of this.displayedLayers) {
        const layer = this.layerById.get(id);
        if (
          !layer ||
          !this.layerVisibility.get(id) ||
          !this.layerEligible(layer, tile.address.level)
        )
          continue;
        for (const previousKey of previous) {
          const old = this.resident.get(previousKey);
          if (old?.layers.has(id) && pyramidAddressesOverlap(tile.address, old.address)) {
            inherited.add(id);
            break;
          }
        }
      }
      if ([...inherited].every((id) => tile.layers.has(id) || tile.emptyLayers.has(id)))
        inheritedReady.set(key, inherited);
    }
    for (const layer of this.layerById.values()) {
      const previous = this.displayedLayers.get(layer.id) ?? new Set<string>();
      const candidates = new Set<string>();
      if (this.layerVisibility.get(layer.id) === true) {
        for (const key of this.displayed) {
          const tile = this.resident.get(key);
          if (tile === undefined) continue;
          // A camera turn may temporarily use a surface-only ancestor. Keep already visible
          // detail beneath it until the selected replacement is ready; explicit coarsening
          // and layer toggles still retire that detail.
          if (!this.layerEligible(layer, tile.address.level)) {
            if (!this.selected.has(key)) {
              for (const previousKey of previous) {
                const old = this.resident.get(previousKey);
                if (old && pyramidAddressesOverlap(tile.address, old.address))
                  candidates.add(previousKey);
              }
            }
            continue;
          }
          if (
            (this.independentCategories.has(layer.category) ||
              ready(tile) ||
              inheritedReady.get(key)?.has(layer.id)) &&
            (tile.layers.has(layer.id) || tile.emptyLayers.has(layer.id))
          ) {
            candidates.add(key);
            continue;
          }
          if (!this.wantsLayers(tile.address)) {
            // Peripheral ground only gets independent layers. Detail already shown inside it may stay,
            // but never a coarser ancestor's, which would cover the view beside it.
            for (const previousKey of previous) {
              const old = this.resident.get(previousKey);
              if (
                old !== undefined &&
                old.address.level >= tile.address.level &&
                pyramidAddressesOverlap(tile.address, old.address)
              )
                candidates.add(previousKey);
            }
            continue;
          }
          for (const previousKey of previous) {
            const previousTile = this.resident.get(previousKey);
            if (
              previousTile !== undefined &&
              pyramidAddressesOverlap(tile.address, previousTile.address)
            ) {
              candidates.add(previousKey);
            }
          }
        }
      }

      this.displayedLayers.set(layer.id, this.withoutCoveredDescendants(candidates));
    }

    for (const [key, tile] of this.resident) {
      let covered = false;
      for (const [id, object] of tile.layers) {
        const visible = this.displayedLayers.get(id)?.has(key) === true;
        if (object.visible !== visible) this.cutoutsDirty = true;
        object.visible = visible;
        if (visible && object.userData[TERRAIN_COVERS_GROUND] === true) covered = true;
      }
      // A displayed layer that drapes the whole tile (full landcover) hides the bare surface
      // beneath it: skip drawing it rather than shading it under the cover. Render layers, not
      // `visible`, so the stream's own display state stays untouched.
      const surface = tile.surface;
      surface.userData.terrainLayerMask ??= surface.layers.mask;
      const mask = covered ? 0 : (surface.userData.terrainLayerMask as number);
      // Covered ground is not cut (see TerrainGroundCutoutController.update); uncovered, it is.
      if (surface.layers.mask !== mask) this.cutoutsDirty = true;
      surface.layers.mask = mask;
      // A warm tile can contain hundreds of LOD groups. Hide its root too, so renderer
      // traversal and WebGPU command inspection stop before visiting that cached subtree.
      const retained = this.visiblyRetains(key);
      if (tile.object.visible !== retained) this.cutoutsDirty = true;
      tile.object.visible = retained;
      this.setAttached(tile, retained);
    }
    // What a refresh was replacing has left the screen with no replacement under way (the camera
    // moved on, or the layer was hidden): drop it, or it would come back from the warm cache as
    // it was. One whose replacement is building keeps it until that lands, hidden or not.
    for (const [layerKey, { tileKey, layerId }] of this.outdatedLayers) {
      if (this.displayedLayers.get(layerId)?.has(tileKey) === true) continue;
      if (this.pendingLayers.has(layerKey)) continue;
      this.outdatedLayers.delete(layerKey);
      const tile = this.resident.get(tileKey);
      if (tile !== undefined) this.dropLayer(tile, layerId);
      this.settleRefresh(layerKey);
    }
    this.cutGround();
    this.refreshDisplayedBytes();
  }

  private renewCutWindow(now: number): void {
    if (now - this.cutWindowStart < CUT_FRAME_MS) return;
    this.cutWindowStart = now;
    this.cutWindowSpent = 0;
  }

  /** Bring ground cuts up to date within what is left of the budget. */
  private cutGround(): void {
    const now = performance.now();
    if (now - this.cutWindowStart >= CUT_IDLE_WINDOW_MS) {
      this.cutWindowStart = now;
      this.cutWindowSpent = 0;
    }
    // Out of budget, the pass waits for the next frame's (see updateTransitions). A pass with a
    // sliver left would still cut a whole slice and gather every opening first.
    if (this.cutoutsDirty && this.cutWindowSpent <= CUT_BUDGET_MS - 1) {
      this.cutoutsDirty = false;
      if (this.groundCutouts.update(this.object, CUT_BUDGET_MS - this.cutWindowSpent))
        this.trackCutAllocations(this.groundCutouts.changedMeshes);
      // The rest follow in later frames, a budget at a time; a pass requested now would only
      // run in this same task.
      if (this.groundCutouts.pending) this.cutoutsDirty = true;
      this.cutWindowSpent += performance.now() - now;
    }
  }

  /**
   * Re-count only the tiles whose ground a cutout pass rebuilt or restored. Re-counting every
   * resident tile walked the whole warm cache each time a stadium or bore came into view.
   */
  private trackCutAllocations(meshes: ReadonlySet<THREE.Object3D>): void {
    if (meshes.size === 0) return;
    const tiles = new Map<THREE.Object3D, ResidentTile>();
    for (const tile of this.resident.values()) tiles.set(tile.object, tile);
    const changed = new Set<ResidentTile>();
    for (const mesh of meshes)
      for (let cursor: THREE.Object3D | null = mesh; cursor !== null; cursor = cursor.parent) {
        const tile = tiles.get(cursor);
        if (tile !== undefined) {
          changed.add(tile);
          break;
        }
      }
    for (const tile of changed) this.trackAllocations(tile);
  }

  /**
   * A hidden tile leaves the scene graph, not only the draw list: `updateMatrixWorld` and every
   * `traverse` also walk invisible objects, so a warm cache of hundreds of tiles would cost frame
   * time for drawing nothing. The tile keeps its `parent`, so world matrices still resolve while
   * its layers prepare, and refreshes them on return in case the world moved while it was away.
   */
  private setAttached(tile: ResidentTile, attached: boolean): void {
    if (tile.attached === attached) return;
    tile.attached = attached;
    if (attached) {
      this.object.add(tile.object);
      tile.object.matrixWorldNeedsUpdate = true;
    } else {
      this.object.remove(tile.object);
      tile.object.parent = this.object;
    }
  }

  private refreshDisplayedBytes(): void {
    const visibleTiles = new Set(this.displayed);
    for (const layerTiles of this.displayedLayers.values()) {
      for (const key of layerTiles) visibleTiles.add(key);
    }
    // Most visibility passes change neither the tiles shown nor what they hold; counting every
    // buffer of every visible tile again was a frame's worth of work a second at High detail.
    if (
      this.countedVersion === this.allocationsVersion &&
      visibleTiles.size === this.countedTiles.size &&
      [...visibleTiles].every((key) => this.countedTiles.has(key))
    )
      return;
    this.countedVersion = this.allocationsVersion;
    this.countedTiles = visibleTiles;
    this.displayedBytes = 0;
    const counted = new Set<ArrayBufferLike>();
    for (const key of visibleTiles) {
      const tile = this.resident.get(key);
      if (tile !== undefined) {
        this.displayedBytes += tile.decodedHeightBytes;
        for (const buffer of tile.allocations ?? [])
          if (!counted.has(buffer)) {
            counted.add(buffer);
            this.displayedBytes += buffer.byteLength;
          }
      }
    }
  }

  private visiblyRetains(key: string): boolean {
    if (this.displayed.has(key)) return true;
    for (const layerTiles of this.displayedLayers.values()) {
      if (layerTiles.has(key)) return true;
    }
    return false;
  }

  private layerEligible(layer: TerrainPyramidTileLayer, level: number): boolean {
    return (
      level >= (layer.minLevel ?? this.descriptor.minLevel) &&
      level <= (layer.maxLevel ?? this.descriptor.maxLevel)
    );
  }

  private reservePreloadSlot(
    pending: Iterable<{ address: TerrainPyramidTileAddress }>,
    limit: number,
  ): boolean {
    if (limit < 3 || this.preparationTargets.size === 0) return false;
    let count = 0;
    let preparing = 0;
    for (const job of pending) {
      if (this.preparationTargets.has(terrainPyramidTileKey(job.address))) preparing++;
      count++;
    }
    const reserved = Math.floor(limit / 2);
    return preparing < reserved && count >= limit - reserved;
  }

  private startLayerLoad(tile: ResidentTile, layer: TerrainPyramidTileLayer): void {
    const tileKey = terrainPyramidTileKey(tile.address);
    const key = `${tileKey}:${layer.id}`;
    if (
      // Built already, unless a refresh asked for it again (see refreshLayers).
      (!this.outdatedLayers.has(key) &&
        (tile.layers.has(layer.id) || tile.emptyLayers.has(layer.id))) ||
      this.pendingLayers.has(key) ||
      this.layerRetries.isBlocked(key) ||
      !this.layerEligible(layer, tile.address.level) ||
      // The caller counts the slots in use; this bounds what is under way altogether.
      this.pendingLayers.size >= this.budget.maxConcurrentLayerLoads * (1 + STALE_LAYER_ROOM)
    ) {
      return;
    }
    const controller = new AbortController();
    this.pendingLayers.set(key, { address: tile.address, layer, controller });
    const started = performance.now();
    let created = started;
    let prepared = started;
    const origin = terrainPyramidTileOrigin(this.descriptor, tile.address);
    const tileSize = terrainPyramidTileSize(this.descriptor, tile.address.level);
    const priority = (): number => this.layerPriority(tile.address);
    const admission = this.options.admission;
    const scoped: SceneAdmission | undefined = admission && {
      run: (task, options) =>
        admission.run(task, { ...options, order: options?.order ?? priority }),
    };
    void loadTerrainTileWithTimeout(
      async (signal) => {
        const object = await layer.createTile({
          address: tile.address,
          pyramid: this.descriptor,
          descriptor: surfaceDescriptor(this.descriptor, tile.address),
          heightfield: tile.heightfield,
          surfaceResolution: tile.surfaceResolution,
          origin,
          tileSize,
          signal,
          priority,
          ...(scoped ? { admission: scoped } : {}),
        });
        created = performance.now();
        if (object !== undefined) {
          // A renderer builds each mesh's shaders for its shadow flags too: marked after preparing,
          // every instanced batch (three builds those per object) was built again mid-frame.
          freezeStaticTransforms(object);
          if (this.options.shadows === true)
            markShadows(object, this.options.shadowCasterHeight ?? 1.5);
          try {
            object.userData.admissionOrder = priority;
            if (!signal.aborted) await this.options.prepareObject?.(object, signal, tile.object);
            if (signal.aborted) throw signal.reason;
          } catch (error) {
            layer.disposeTile?.(object);
            throw error;
          } finally {
            delete object.userData.admissionOrder;
          }
        }
        prepared = performance.now();
        return object;
      },
      controller.signal,
      this.options.layerTimeoutMs ?? 120_000,
    )
      .then(async (object) => {
        await this.admit(
          () => {
            const current = this.resident.get(tileKey);
            if (this.disposed || controller.signal.aborted || current === undefined) {
              if (object !== undefined) layer.disposeTile?.(object);
              return;
            }
            // A refresh's replacement: what the tile shows now gives way to it in this one task.
            const replaced = current.layers.get(layer.id);
            const refreshed = this.outdatedLayers.delete(key);
            this.buildCounts.layers++;
            if (refreshed) this.buildCounts.refreshedLayers++;
            else if (this.layerBuilds.has(key)) this.buildCounts.rebuiltLayers++;
            this.layerBuilds.add(key);
            const finished = performance.now();
            if (object !== undefined) {
              this.layerLatencyMs += 0.1 * (finished - started - this.layerLatencyMs);
            }
            this.options.onLayerTiming?.({
              layerId: layer.id,
              level: tile.address.level,
              createMs: created - started,
              prepareMs: prepared - created,
              publishMs: finished - prepared,
            });
            if (object === undefined) {
              this.layerRetries.clear(key);
              // Nothing is there any more: what a refresh was replacing goes with no successor.
              if (replaced !== undefined) this.dropLayer(current, layer.id);
              current.emptyLayers.add(layer.id);
              // The pass is queued before the refresh's callers are told, so they resume after it.
              this.requestVisibility();
              if (refreshed) this.settleRefresh(key);
              return;
            }
            object.name ||= `layer:${layer.id}:${tileKey}`;
            this.layerRetries.clear(key);
            // A replacement is on screen at once if what it replaces was: the visibility pass runs
            // after this task, and cover hidden until then would leave its tile's ground bare
            // (see TERRAIN_COVERS_GROUND).
            object.visible = replaced?.visible ?? false;
            current.emptyLayers.delete(layer.id);
            if (replaced !== undefined) {
              this.groundCutouts.restore(replaced);
              current.object.remove(replaced);
              this.cutoutsDirty = true;
            }
            current.layers.set(layer.id, object);
            current.object.add(object);
            if (replaced !== undefined) layer.disposeTile?.(replaced);
            this.trackAllocations(current);
            this.requestVisibility();
            if (refreshed) this.settleRefresh(key);
          },
          controller.signal,
          'layer-publication',
          0,
          'normal',
          priority,
        ).catch((error) => {
          // Not published. By identity: during a refresh the tile still holds the object this
          // one was to replace, and a replacement dropped while queued must not leak.
          if (object !== undefined && this.resident.get(tileKey)?.layers.get(layer.id) !== object)
            layer.disposeTile?.(object);
          throw error;
        });
      })
      .catch((error: unknown) => {
        if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
        const state = this.layerRetries.markFailed(
          key,
          { address: tile.address, layerId: layer.id },
          error,
          () => {
            this.startQueuedLayerLoads();
            this.resolveIdleIfNeeded();
          },
        );
        this.updateVisibility();
        // Abandoned for now: what a refresh was replacing stays on screen, still to be replaced
        // when an attempt after the cool-down succeeds, and its caller stops waiting.
        if (state === 'failed') this.settleRefresh(key);
        this.options.onError?.(error, { address: tile.address, layerId: layer.id });
      })
      .finally(() => {
        // Keep the request pending through settlement so whenIdle cannot resolve between the
        // result and the next queue pump. An aborted older request must not remove its retry.
        if (this.pendingLayers.get(key)?.controller === controller) {
          this.pendingLayers.delete(key);
        }
        this.scheduleLayerPump();
      });
  }

  private scheduleLayerPump(): void {
    if (this.layerPumpScheduled || this.disposed) return;
    this.layerPumpScheduled = true;
    setTimeout(() => {
      this.layerPumpScheduled = false;
      if (!this.disposed) {
        this.startQueuedLayerLoads();
        this.startQueuedLoads();
      }
      this.resolveIdleIfNeeded();
    }, 0);
  }

  private startQueuedLayerLoads(): void {
    // A layer under way for ground the camera has since left runs on into the warm cache (a
    // cancelled request leaves its worker job running with nothing to show for it), but no
    // longer holds a slot. Worker queues take the nearest ground first, so those jobs ran last
    // while their slots stayed taken: after a turn, new ground waited for a window full of them.
    const layerCounts = new Map<string, number>();
    // Tiles showing something a refresh is replacing (see refreshLayers). A layer can stay on
    // screen beneath a tile that is no longer displayed itself, so these are not all in `displayed`.
    const outdatedTiles = new Set<string>();
    for (const { tileKey } of this.outdatedLayers.values()) outdatedTiles.add(tileKey);
    let live = 0;
    for (const { layer, address } of this.pendingLayers.values()) {
      const tileKey = terrainPyramidTileKey(address);
      // Everything this pass could start work for, and the tiles a handoff still waits on.
      if (
        !this.wanted.has(tileKey) &&
        !this.ahead.has(tileKey) &&
        !this.selected.has(tileKey) &&
        !this.replacementTiles.has(tileKey) &&
        !this.displayed.has(tileKey) &&
        !this.preloading.has(tileKey) &&
        !outdatedTiles.has(tileKey)
      )
        continue;
      live++;
      layerCounts.set(layer.id, (layerCounts.get(layer.id) ?? 0) + 1);
    }
    const room = this.budget.maxConcurrentLayerLoads * (1 + STALE_LAYER_ROOM);
    if (live >= this.budget.maxConcurrentLayerLoads || this.pendingLayers.size >= room) return;
    // Everything is judged at the view a build will finish into: a moving camera has left what
    // it sees now by then, and a tile right beneath it is about the last thing worth starting.
    const lead = this.lead;
    const view = lead ?? this.view;
    const detailedParents = new Set<string>();
    for (const [id, keys] of this.displayedLayers)
      for (const key of keys) if (this.resident.get(key)?.layers.has(id)) detailedParents.add(key);
    // Selected leaves already in the resident cache can prepare their detail while another
    // child's terrain is still loading. Publication remains coverage-safe in updateLayerVisibility.
    // The selection's camera guard band also warms detail just outside the current view.
    const current = new Set([
      ...this.displayed,
      ...this.replacementTiles,
      ...this.selected.keys(),
      ...this.preloading,
      ...outdatedTiles,
    ]);
    const candidates = [...current, ...(this.aheadRoom ? this.ahead.keys() : [])]
      .map((key) => this.resident.get(key))
      .filter((tile): tile is ResidentTile => tile !== undefined)
      .map((tile) => {
        const key = terrainPyramidTileKey(tile.address);
        const bounds = tileBounds(this.descriptor, tile.address);
        const ahead = current.has(key) ? undefined : this.ahead.get(key);
        const distance =
          ahead?.distance ??
          (view === undefined
            ? 0
            : distanceToBounds(view.position, bounds, this.descriptor.height));
        // A detailed parent stays visible until its replacement family is ready. Give the
        // immediate family its parent's distance, or a ready tile beneath the aircraft can stay
        // hidden while unrelated, individually nearer leaves consume every layer slot.
        // More distant ancestors are not this handoff: inheriting a level-8 parent's distance
        // made every level-15 leaf across a city equally urgent, defeating live priorities.
        let familyDistance = distance;
        let inView = view === undefined || intersectsHorizontalView(view, bounds, 0);
        if (ahead === undefined && view && tile.address.level > this.descriptor.minLevel) {
          const parent = terrainPyramidAncestor(tile.address, tile.address.level - 1);
          if (detailedParents.has(terrainPyramidTileKey(parent))) {
            const parentBounds = tileBounds(this.descriptor, parent);
            familyDistance = distanceToBounds(view.position, parentBounds, this.descriptor.height);
            inView = intersectsHorizontalView(view, parentBounds, 0);
          }
        }
        return {
          tile,
          ahead,
          preload: this.preloading.has(key),
          // What the camera will see, then ground it reaches next, then ground it has passed.
          group: ahead !== undefined ? 1 : inView ? 0 : 2,
          // At speed, ground with nothing on it comes before more detail for ground that has some.
          hole: lead !== undefined && !this.coveredByCoarserLayers(tile),
          selected: this.selected.has(key),
          replacement: this.replacementTiles.has(key),
          familyDistance,
          distance,
        };
      })
      .sort(
        (a, b) =>
          Number(a.preload) - Number(b.preload) ||
          a.group - b.group ||
          Number(b.hole) - Number(a.hole) ||
          (a.ahead?.seconds ?? 0) - (b.ahead?.seconds ?? 0) ||
          a.familyDistance - b.familyDistance ||
          Number(b.replacement) - Number(a.replacement) ||
          Number(b.selected) - Number(a.selected) ||
          a.distance - b.distance ||
          b.tile.address.level - a.tile.address.level ||
          a.tile.address.z - b.tile.address.z ||
          a.tile.address.x - b.tile.address.x,
      );
    const jobs = candidates.flatMap(({ tile, ahead, preload, group, hole }) =>
      [...this.layerById.values()]
        .filter((layer) => {
          const key = `${terrainPyramidTileKey(tile.address)}:${layer.id}`;
          // On screen and asked for again: built whether or not the view would start it now.
          const outdated = this.outdatedLayers.has(key);
          return (
            (outdated ||
              this.independentCategories.has(layer.category) ||
              this.wantsLayers(tile.address)) &&
            this.layerVisibility.get(layer.id) === true &&
            this.layerEligible(layer, tile.address.level) &&
            (outdated || (!tile.layers.has(layer.id) && !tile.emptyLayers.has(layer.id))) &&
            !this.pendingLayers.has(key) &&
            !this.layerRetries.isBlocked(key)
          );
        })
        .map((layer) => ({
          tile,
          layer,
          ahead,
          preload,
          group,
          hole,
          outdated: this.outdatedLayers.has(`${terrainPyramidTileKey(tile.address)}:${layer.id}`),
          route: this.preparationTargets.has(terrainPyramidTileKey(tile.address)),
          // Finish the layers needed to release an existing parent before starting newly
          // eligible detail. Otherwise a few slow building jobs occupy every slot while
          // inexpensive water/landcover on their siblings keeps the entire region coarse.
          handoff:
            this.replacementTiles.has(terrainPyramidTileKey(tile.address)) &&
            [...(this.displayedLayers.get(layer.id) ?? [])].some((key) => {
              const previous = this.resident.get(key);
              return (
                previous !== undefined &&
                previous.address.level < tile.address.level &&
                pyramidAddressesOverlap(previous.address, tile.address)
              );
            }),
        })),
    );
    // Fill visible lakes before nearby buildings can occupy every slot. Peripheral water
    // warms after visible work; speculative route jobs still use their reserved slots below.
    // At speed, bare ground keeps its lead: a coarser tile already shows the water beside it.
    // What a host asked to have replaced on screen goes before all of it: it shows the old state.
    jobs.sort(
      (a, b) =>
        Number(b.outdated) - Number(a.outdated) ||
        Number(a.preload) - Number(b.preload) ||
        a.group - b.group ||
        Number(b.hole) - Number(a.hole) ||
        Number(b.layer.category === 'hydrology') - Number(a.layer.category === 'hydrology') ||
        Number(b.handoff) - Number(a.handoff),
    );
    // Tiles ahead leave a slot free: a layer holds one for about a second, too long for ground
    // the camera turns to see to wait behind ground it has yet to reach. They also wait out a
    // backlog on the main thread: the frame queue is the scarce thing, and they are optional.
    const aheadLayers =
      (this.options.admission?.pending ?? 0) > MAX_AHEAD_BACKLOG
        ? 0
        : Math.max(1, this.budget.maxConcurrentLayerLoads - 1);
    // Each layer has its own downstream workers, but holds a stream slot from fetch through
    // publication. Do not let a slow source (including water) occupy the entire window while
    // the other workers are idle. Lend unused shares when another layer has no queued work.
    const enabledLayers = [...this.layerById.values()].filter(
      (layer) => this.layerVisibility.get(layer.id) === true,
    ).length;
    const layerCount = Math.max(1, enabledLayers);
    const share = Math.max(1, Math.ceil(this.budget.maxConcurrentLayerLoads / layerCount));
    // Keep one slot for each other enabled layer even when its heights have not arrived yet.
    // Otherwise lending the entire window to stalled reads starves the next arriving tile.
    const ceiling = Math.max(1, this.budget.maxConcurrentLayerLoads - layerCount + 1);
    while (
      jobs.length > 0 &&
      live < this.budget.maxConcurrentLayerLoads &&
      this.pendingLayers.size < room
    ) {
      const allowed = (job: (typeof jobs)[number]): boolean =>
        job.ahead === undefined || live < aheadLayers;
      const withinShare = (job: (typeof jobs)[number]): boolean =>
        (layerCounts.get(job.layer.id) ?? 0) < share;
      const available = jobs.some((job) => allowed(job) && withinShare(job));
      const eligible = (job: (typeof jobs)[number]): boolean =>
        allowed(job) &&
        (available ? withinShare(job) : (layerCounts.get(job.layer.id) ?? 0) < ceiling);
      const first = jobs.findIndex(eligible);
      if (first < 0) break;
      const preloadIndex = this.reservePreloadSlot(
        this.pendingLayers.values(),
        this.budget.maxConcurrentLayerLoads,
      )
        ? jobs.findIndex((job) => job.route && eligible(job))
        : -1;
      const index = preloadIndex >= 0 ? preloadIndex : first;
      const job = jobs.splice(index, 1)[0];
      if (job) {
        layerCounts.set(job.layer.id, (layerCounts.get(job.layer.id) ?? 0) + 1);
        this.startLayerLoad(job.tile, job.layer);
        live++;
      }
    }
  }

  /**
   * A layer job's live priority (see TerrainPyramidTileLayerContext.priority), ordered as
   * startQueuedLayerLoads orders new jobs: ground in view first, then by distance, a family
   * replacing a detailed parent at its parent's distance so the family finishes together. A
   * moving camera is judged where a build will finish, as there.
   */
  private layerPriority(address: TerrainPyramidTileAddress): number {
    const view = this.lead ?? this.view;
    if (view === undefined) return 0;
    const tileKey = terrainPyramidTileKey(address);
    const cached = this.layerPriorities.get(tileKey);
    if (cached !== undefined) return cached;
    let bounds = tileBounds(this.descriptor, address);
    if (address.level > this.descriptor.minLevel) {
      const parent = terrainPyramidAncestor(address, address.level - 1);
      const key = terrainPyramidTileKey(parent);
      if (this.displayed.has(key)) {
        for (const keys of this.displayedLayers.values()) {
          if (!keys.has(key)) continue;
          bounds = tileBounds(this.descriptor, parent);
          break;
        }
      }
    }
    const distance = distanceToBounds(view.position, bounds, this.descriptor.height);
    // A reserved request slot alone is not enough: a route tile must keep its lead through
    // geometry, assembly and upload, ahead of the rest of a wide High-quality view.
    const approach = distance === 0 || this.preparationTargets.has(tileKey);
    const priority = intersectsHorizontalView(view, bounds, 0)
      ? (approach ? 0 : OUT_OF_VIEW_PRIORITY / 2) + distance
      : (approach ? OUT_OF_VIEW_PRIORITY / 2 : OUT_OF_VIEW_PRIORITY) + distance;
    this.layerPriorities.set(tileKey, priority);
    return priority;
  }

  private replacesDisplayedDescendants(address: TerrainPyramidTileAddress): boolean {
    for (const key of this.displayed) {
      const displayed = this.resident.get(key)?.address;
      if (
        displayed !== undefined &&
        displayed.level > address.level &&
        terrainPyramidTileKey(terrainPyramidAncestor(displayed, address.level)) ===
          terrainPyramidTileKey(address)
      ) {
        return true;
      }
    }
    return false;
  }

  private evictUnused(): void {
    if (
      this.budget.maxResidentBytes !== undefined &&
      this.displayedBytes >= this.budget.maxResidentBytes
    )
      this.preloadMemoryHold = true;
    const availableLoadSlots = Math.max(
      0,
      Math.min(this.queue.length, this.budget.maxConcurrentLoads - this.pending.size),
    );
    const targetResident = this.budget.maxResidentTiles - this.pending.size - availableLoadSlots;
    const underBudget = (): boolean =>
      this.resident.size <= targetResident &&
      (this.budget.maxResidentBytes === undefined ||
        this.geometryBytes + this.decodedHeightBytes <= this.budget.maxResidentBytes);
    if (underBudget()) {
      this.aheadRoom = this.hasRoomAhead();
      return;
    }
    // Nearest stays, not most recent. Least-recently-used is the worst policy for a loop: flying
    // a circle, the ground used longest ago is the ground coming up next. Distance in tile widths
    // says how far the camera is from selecting a tile again, and drops ground it has truly left.
    const view = this.view;
    const remoteness = new Map<ResidentTile, number>();
    const remote = (tile: ResidentTile): number => {
      let value = remoteness.get(tile);
      if (value === undefined) {
        value =
          view === undefined
            ? 0
            : distanceToBounds(
                view.position,
                tileBounds(this.descriptor, tile.address),
                this.descriptor.height,
              ) / terrainPyramidTileSize(this.descriptor, tile.address.level);
        remoteness.set(tile, value);
      }
      return value;
    };
    const stale = [...this.resident.entries()]
      .filter(
        ([key]) =>
          !this.visiblyRetains(key) &&
          !this.wanted.has(key) &&
          !this.replacementTiles.has(key) &&
          !this.ahead.has(key),
      )
      .sort(
        ([, a], [, b]) =>
          remote(b) - remote(a) ||
          a.lastUsed - b.lastUsed ||
          b.address.level - a.address.level ||
          a.address.z - b.address.z,
      );
    for (const [key] of stale) {
      if (underBudget()) break;
      this.evict(key);
    }
    this.aheadRoom = this.hasRoomAhead();

    // Speculation is reclaimable before any current-view parent. Drop its queue entry too,
    // otherwise a full cache would continually rebuild and evict the same speculative leaf.
    for (const key of [...this.preloading].reverse()) {
      if (underBudget()) break;
      if (this.visiblyRetains(key)) continue;
      this.preloading.delete(key);
      this.preparationTargets.delete(key);
      // An unusually large future tile may not fit even after reclaiming stale cache. Do not
      // rebuild it every camera update; visible demand bypasses this short speculative backoff.
      this.rejectedPreloads.delete(key);
      this.rejectedPreloads.set(key, this.usage + 100);
      while (this.rejectedPreloads.size > this.budget.maxSelectedTiles)
        this.rejectedPreloads.delete(this.rejectedPreloads.keys().next().value as string);
      this.wanted.delete(key);
      this.queue = this.queue.filter((tile) => terrainPyramidTileKey(tile.address) !== key);
      this.pending.get(key)?.controller.abort();
      this.pending.delete(key);
      this.evict(key);
    }

    // Once descendants completely cover a parent it is hidden and safe to discard. Do this only
    // under pressure so the parent remains a useful short-lived cache during ordinary movement.
    if (underBudget()) return;
    const coveredParents = [...this.resident.entries()]
      .filter(
        ([key, tile]) =>
          !this.visiblyRetains(key) &&
          !this.selected.has(key) &&
          !this.replacementTiles.has(key) &&
          !this.coarseWanted.has(key) &&
          !this.ahead.has(key) &&
          tile.address.level < this.descriptor.maxLevel,
      )
      .sort(([, a], [, b]) => a.address.level - b.address.level || a.lastUsed - b.lastUsed);
    for (const [key] of coveredParents) {
      if (underBudget()) return;
      this.evict(key);
    }
    // Tiles ahead are speculative: they go last, the farthest along the track first.
    for (const key of [...this.ahead.keys()].reverse()) {
      if (underBudget()) return;
      if (this.resident.has(key) && !this.visiblyRetains(key) && !this.wanted.has(key)) {
        this.evict(key);
        this.aheadMemoryHold = true;
      }
    }
  }

  /**
   * Whether building another tile ahead would stay in budget once the cache has given up all it
   * gives up first. Tiles ahead are the last thing kept, so at the limit a new one only pushes
   * out the last. Counting a tile it could replace as room was not enough: eviction goes on past
   * that tile while still over budget, to the tiles ahead themselves, and a helicopter over
   * Seattle built and evicted the same tiles ahead about ten times a second while the ground
   * beneath it waited. Loads on their way in count at an average tile's size, or a burst of them
   * each judged against the same room overshoots it.
   */
  private hasRoomAhead(): boolean {
    const { maxResidentBytes, maxResidentTiles } = this.budget;
    const total = this.geometryBytes + this.decodedHeightBytes;
    let tiles = this.pending.size;
    let kept = 0;
    for (const [key, tile] of this.resident) {
      if (!this.visiblyRetains(key) && !this.wanted.has(key) && !this.ahead.has(key)) continue;
      tiles++;
      kept += tile.geometryBytes + tile.decodedHeightBytes;
    }
    // Shared buffers count once in the total but once per tile in each tile's own bytes.
    const average = this.resident.size > 0 ? total / this.resident.size : 0;
    const bytes = Math.min(kept, total) + this.pending.size * average;
    const fraction = this.aheadMemoryHold ? AHEAD_RESUME_FRACTION : AHEAD_ROOM_FRACTION;
    const room =
      tiles < maxResidentTiles * AHEAD_ROOM_FRACTION &&
      (maxResidentBytes === undefined || bytes < maxResidentBytes * fraction);
    if (room) this.aheadMemoryHold = false;
    return room;
  }

  private evict(key: string): void {
    const tile = this.resident.get(key);
    if (tile === undefined) return;
    this.heightProbeTiles.clear();
    this.groundCutouts.restore(tile.object);
    this.morphing.delete(tile);
    const wasDisplayed = this.visiblyRetains(key);
    for (const [pendingKey, request] of this.pendingLayers) {
      if (terrainPyramidTileKey(request.address) === key) {
        request.controller.abort();
        this.pendingLayers.delete(pendingKey);
      }
    }
    for (const [id, object] of tile.layers) {
      this.layerById.get(id)?.disposeTile?.(object);
    }
    for (const id of this.layerById.keys()) {
      const layerKey = `${key}:${id}`;
      this.layerRetries.clear(layerKey);
      // A refresh has nothing left to replace here; the tile is built anew if it returns.
      if (this.outdatedLayers.delete(layerKey)) this.settleRefresh(layerKey);
    }
    this.object.remove(tile.object);
    tile.object.parent = null;
    tile.surface.geometry.dispose();
    this.resident.delete(key);
    this.trackAllocations(tile, true);
    this.decodedHeightBytes -= tile.decodedHeightBytes;
    this.displayed.delete(key);
    for (const layerTiles of this.displayedLayers.values()) layerTiles.delete(key);
    if (wasDisplayed) this.refreshDisplayedBytes();
    this.evictionCount++;
  }

  private isIdle(): boolean {
    return (
      this.pending.size === 0 &&
      this.pendingLayers.size === 0 &&
      this.queue.length === 0 &&
      this.retries.scheduledRetries() === 0 &&
      this.layerRetries.scheduledRetries() === 0 &&
      !this.layerPumpScheduled
    );
  }

  private resolveIdleIfNeeded(): void {
    if (!this.isIdle()) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}

export function createTerrainPyramidStream(
  descriptor: TerrainPyramidDescriptor,
  source: TerrainPyramidHeightSource,
  options: TerrainPyramidStreamOptions,
): TerrainPyramidStream {
  return new ScreenSpaceTerrainPyramidStream(descriptor, source, options);
}

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
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidAddressAt,
  terrainPyramidAncestor,
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
   * field when unchanged to retain worker-prepared geometry. A replacement rebuilds the mesh
   * and becomes the field shared by surface sampling and every layer. `source` is unmodified,
   * for stable reference samples; work must respect the context's cancellation signal.
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
  onError?: (error: unknown, context: TerrainPyramidStreamErrorContext) => void;
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
  /** Semantic layer requests that exhausted their retry budget. */
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

export interface TerrainPyramidStream {
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
   * good does not hold it back). Loads elsewhere in the view do not count, so a host can act on
   * the ground around a point, such as landing a walker, while the rest of the view streams in.
   */
  isAreaReady(x: number, z: number, radius: number): boolean;
  setLayerVisible(id: string, visible: boolean): void;
  isLayerVisible(id: string): boolean;
  residentTiles(): TerrainPyramidTileAddress[];
  displayedTiles(): TerrainPyramidTileAddress[];
  /** Tiles that will not load again on their own: missing plus abandoned. */
  failedTiles(): TerrainPyramidTileAddress[];
  /** Per-tile missing/retrying/abandoned detail, so a host can say which state a hole is in. */
  tileFailures(): Array<TerrainTileFailure<TerrainPyramidTileAddress>>;
  retryFailed(): void;
  /**
   * Full counters, including triangle and byte totals gathered by walking every resident tile's
   * objects: for diagnostics, not every frame. Per-frame callers use `loading()`, and a live
   * diagnostics panel passes `{ geometry: 'tracked' }`.
   */
  stats(options?: TerrainPyramidStatsOptions): TerrainPyramidStreamStats;
  /** Tiles and layers loading now, in constant time. */
  loading(): { tiles: number; layers: number };
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

function selectAt(
  descriptor: TerrainPyramidDescriptor,
  view: TerrainPyramidView,
  maxScreenSpaceError: number,
  viewDistance: number,
  guardRadians = VIEW_GUARD_RADIANS,
): TerrainPyramidTileAddress[] {
  const selected: TerrainPyramidTileAddress[] = [];
  const pixelsPerRadian = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  const visit = (address: TerrainPyramidTileAddress): void => {
    const bounds = tileBounds(descriptor, address);
    if (descriptor.coverage !== undefined && !boxesIntersect(bounds, descriptor.coverage)) return;
    if (!intersectsHorizontalView(view, bounds, guardRadians)) return;
    const distance = distanceToBounds(view.position, bounds, descriptor.height);
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
      const distanceA = distanceToBounds(
        view.position,
        tileBounds(descriptor, a),
        descriptor.height,
      );
      const distanceB = distanceToBounds(
        view.position,
        tileBounds(descriptor, b),
        descriptor.height,
      );
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
  const focal = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  // 1 inside the view (with its guard band), `peripheralDetail` in the peripheral band, else 0.
  const weight = (tile: TerrainPyramidTileAddress): number => {
    const bounds = tileBounds(descriptor, tile);
    if (descriptor.coverage !== undefined && !boxesIntersect(bounds, descriptor.coverage)) return 0;
    if (distanceToBounds(view.position, bounds, descriptor.height) > options.viewDistance) return 0;
    if (intersectsHorizontalView(view, bounds)) return 1;
    return peripheralGuard > VIEW_GUARD_RADIANS &&
      intersectsHorizontalView(view, bounds, peripheralGuard)
      ? peripheralDetail
      : 0;
  };
  const projected = (tile: TerrainPyramidTileAddress): number =>
    (((terrainPyramidTileSize(descriptor, tile.level) / (descriptor.tileResolution - 1)) * focal) /
      Math.max(
        1,
        distanceToBounds(view.position, tileBounds(descriptor, tile), descriptor.height),
      )) *
    weight(tile);
  const visible = (tile: TerrainPyramidTileAddress): boolean => weight(tile) > 0;
  // Start with mandatory coarse coverage, then spend the remaining tile budget on the most
  // visible error. Every node is visited once; no whole-tree threshold retry traversals.
  const roots = selectAt(
    descriptor,
    view,
    Number.MAX_VALUE,
    options.viewDistance,
    peripheralGuard,
  ).sort(
    (a, b) =>
      distanceToBounds(view.position, tileBounds(descriptor, a), descriptor.height) -
        distanceToBounds(view.position, tileBounds(descriptor, b), descriptor.height) ||
      a.z - b.z ||
      a.x - b.x,
  );
  const selected = new Map(
    roots.slice(0, options.maxSelectedTiles).map((t) => [terrainPyramidTileKey(t), t]),
  );
  type Candidate = { tile: TerrainPyramidTileAddress; error: number };
  const heap: Candidate[] = [];
  const push = (tile: TerrainPyramidTileAddress): void => {
    const item = { tile, error: projected(tile) };
    let index = heap.length;
    heap.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if ((heap[parent]?.error ?? 0) >= item.error) break;
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
        if ((heap[child + 1]?.error ?? -Infinity) > (heap[child]?.error ?? -Infinity)) child++;
        if ((heap[child]?.error ?? 0) <= last.error) break;
        heap[i] = heap[child] as Candidate;
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  for (const tile of selected.values()) push(tile);
  let effectiveError = options.maxScreenSpaceError;
  while (heap.length > 0) {
    const { tile, error } = pop();
    if (tile.level >= descriptor.maxLevel) continue;
    const threshold =
      options.maxScreenSpaceError *
      (previousRefined.has(terrainPyramidTileKey(tile)) ? 1 - hysteresis : 1);
    if (error <= threshold) continue;
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

/**
 * `userData` flag for a tile layer object that drapes its whole tile with opaque ground (for
 * example landcover over a full-tile background). While that object is displayed, the stream
 * does not draw the tile's bare terrain surface, which it would hide completely.
 */
export const TERRAIN_COVERS_GROUND: 'terrainCoversGround' = 'terrainCoversGround';

interface ResidentTile {
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

function objectGeometryStats(root: THREE.Object3D, visibleOnly: boolean): ObjectGeometryStats {
  // Visible counts need no byte totals: skip the per-buffer bookkeeping on that walk.
  const countBytes = !visibleOnly;
  const seen = new Set<THREE.BufferGeometry>();
  const allocations = new Set<ArrayBufferLike>();
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
  private readonly layerVisibility = new Map<string, boolean>();
  private readonly resident = new Map<string, ResidentTile>();
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

  constructor(
    private readonly descriptor: TerrainPyramidDescriptor,
    private readonly source: TerrainPyramidHeightSource,
    private readonly options: TerrainPyramidStreamOptions,
  ) {
    requireDescriptor(descriptor);
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
    };
    requireBudget(this.budget);
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
    this.view = {
      ...view,
      position: [...view.position],
      ...(view.direction === undefined ? {} : { direction: [...view.direction] }),
    };
    this.usage++;
    this.cutWindowStart = performance.now();
    this.cutWindowSpent = 0;
    this.selection = selectTerrainPyramidTiles(this.descriptor, this.view, {
      ...this.budget,
      previousTiles: this.selection.tiles,
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
        distance: distanceToBounds(view.position, bounds, this.descriptor.height),
        inView: intersectsHorizontalView(view, bounds, 0),
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
      const nearest = selectTerrainPyramidTiles(this.descriptor, future, this.budget).tiles.sort(
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
    // A route change must not leave all height slots occupied by obsolete requests. Delete
    // before restarting; the old request's identity-checked settlement cannot delete a retry.
    for (const [key, request] of this.pending) {
      if (!this.wanted.has(key) && !this.visiblyRetains(key)) {
        request.controller.abort();
        this.pending.delete(key);
      }
    }
    for (const [key, tile] of this.resident) {
      if (this.wanted.has(key)) tile.lastUsed = this.usage;
    }
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
    if (this.view !== undefined) this.update(this.view, this.preloadViews);
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
    let fallback: number | undefined;
    for (let level = this.descriptor.maxLevel; level >= this.descriptor.minLevel; level--) {
      const address = terrainPyramidAddressAt(this.descriptor, level, x, z);
      if (address === undefined) continue;
      const key = terrainPyramidTileKey(address);
      const height = this.resident.get(key)?.heightfield.sampleHeight(x, z);
      if (height === undefined || !Number.isFinite(height)) continue;
      if (this.displayed.has(key)) return height;
      fallback ??= height;
    }
    // An aircraft's center/wheels can cross a tile edge behind its cockpit camera. The visual
    // cut need not include that ground, but its cached height must still support simulation;
    // waiting for a tile behind a stopped camera otherwise deadlocks flight indefinitely.
    return fallback;
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
    this.update(this.view, this.preloadViews);
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
    const allocatedBytes =
      options.geometry === 'tracked'
        ? this.geometryBytes
        : objectGeometryStats(this.object, false).bytes;
    const visibleGeometry = objectGeometryStats(this.object, true);
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
    };
  }

  loading(): { tiles: number; layers: number } {
    return { tiles: this.pending.size, layers: this.pendingLayers.size };
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const request of this.pending.values()) request.controller.abort();
    for (const request of this.pendingLayers.values()) request.controller.abort();
    this.pending.clear();
    this.pendingLayers.clear();
    this.retries.dispose();
    this.layerRetries.dispose();
    this.morphing.clear();
    this.queue = [];
    this.groundCutouts.dispose();
    for (const key of [...this.resident.keys()]) this.evict(key);
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
      const controller = new AbortController();
      this.pending.set(key, { address: wanted.address, controller });
      const resolution = this.budget.maxSurfaceTileResolution;
      const request = loadTerrainTileWithTimeout<PreparedTile | undefined>(
        async (signal): Promise<PreparedTile | undefined> => {
          const prepared = this.source.loadPrepared
            ? await this.source.loadPrepared(wanted.address, signal, resolution)
            : await this.source
                .load(wanted.address, signal)
                .then((heightfield) =>
                  heightfield === undefined ? undefined : { heightfield, geometry: undefined },
                );
          if (!prepared || signal.aborted || !this.options.transformHeightfield) return prepared;
          const heightfield = await this.options.transformHeightfield(
            {
              address: wanted.address,
              pyramid: this.descriptor,
              descriptor: surfaceDescriptor(this.descriptor, wanted.address),
              heightfield: prepared.heightfield,
              surfaceResolution: surfaceResolution(this.descriptor, resolution),
              origin: terrainPyramidTileOrigin(this.descriptor, wanted.address),
              tileSize: terrainPyramidTileSize(this.descriptor, wanted.address.level),
              signal,
            },
            this.source,
          );
          return heightfield === prepared.heightfield ? prepared : { heightfield };
        },
        controller.signal,
        this.retryPolicy.requestTimeoutMs,
      );
      void request
        .then(async (prepared) => {
          if (this.disposed || controller.signal.aborted) return;
          if (prepared === undefined) {
            if (this.wanted.has(key)) {
              this.retries.markMissing(key, wanted.address);
              this.options.onError?.(new Error(`terrain pyramid tile ${key} is missing`), {
                address: wanted.address,
              });
            }
            return;
          }
          this.retries.clear(key);
          await this.addResident(
            wanted.address,
            prepared.heightfield,
            controller.signal,
            resolution,
            prepared.geometry,
          );
        })
        .catch((error: unknown) => {
          if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
          this.retries.markFailed(key, wanted.address, error, () => this.retryDueTiles());
          this.options.onError?.(error, { address: wanted.address });
        })
        .finally(() => {
          if (this.pending.get(key)?.controller === controller) this.pending.delete(key);
          this.startQueuedLoads();
          this.resolveIdleIfNeeded();
        });
    }
  }

  /** A backoff delay elapsed: replan against the latest view, which requeues the tile. */
  private retryDueTiles(): void {
    if (this.disposed || this.view === undefined) {
      this.resolveIdleIfNeeded();
      return;
    }
    this.update(this.view, this.preloadViews);
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
  ): Promise<T> {
    if (this.options.admission)
      return this.options.admission.run(task, { signal, label, bytes, priority });
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
      // then publish the enabled layers together once they have all settled.
      if (!retained) prepared.add(key);
    }
    // A retained parent suppresses every replacement beneath it until all siblings are ready.
    const displayed = this.withoutCoveredDescendants(prepared);
    this.displayed = displayed;
    for (const [key, tile] of this.resident) {
      const tileVisible = displayed.has(key);
      if (tileVisible && !tile.surface.visible && tile.morph && !this.morphing.has(tile))
        this.morphing.set(tile, performance.now());
      if (tile.surface.visible !== tileVisible) this.cutoutsDirty = true;
      tile.surface.visible = tileVisible;
    }
    this.updateLayerVisibility();
    for (const [key, request] of this.pendingLayers) {
      // A temporarily hidden tile may become visible again on the next camera/LOD update. Let its
      // semantic work finish into the warm resident cache; eviction and explicit layer toggles
      // remain the lifecycle boundaries that abort it.
      const tileKey = terrainPyramidTileKey(request.address);
      if (
        this.layerVisibility.get(request.layer.id) !== true ||
        (!displayed.has(tileKey) &&
          !this.wanted.has(tileKey) &&
          !this.replacementTiles.has(tileKey) &&
          !this.displayedLayers.get(request.layer.id)?.has(tileKey))
      ) {
        request.controller.abort();
        this.pendingLayers.delete(key);
      }
    }
    this.startQueuedLayerLoads();
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
   * Layers (buildings, trees, water) are built for ground in the camera's view and its guard
   * band. Peripheral ground stays bare until a turn brings it into view: cheap terrain that is
   * already there, instead of a whole band of detail no one is looking at.
   */
  private wantsLayers(address: TerrainPyramidTileAddress): boolean {
    const peripheral = (this.budget.peripheralDegrees ?? 0) > 0;
    return (
      this.preparationTargets.has(terrainPyramidTileKey(address)) ||
      !peripheral ||
      this.view === undefined ||
      intersectsHorizontalView(this.view, tileBounds(this.descriptor, address))
    );
  }

  private layersReady(tile: ResidentTile, allowFailed = false): boolean {
    // Peripheral ground carries no layers until it is in view: its bare surface is complete.
    if (!this.wantsLayers(tile.address)) return true;
    for (const layer of this.layerById.values()) {
      if (
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

  /** Publish enabled layers together, retaining detail during explicit layer toggles. */
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
            (ready(tile) || inheritedReady.get(key)?.has(layer.id)) &&
            (tile.layers.has(layer.id) || tile.emptyLayers.has(layer.id))
          ) {
            candidates.add(key);
            continue;
          }
          if (!this.wantsLayers(tile.address)) {
            // Peripheral ground never gets layers of its own. Detail already shown inside it
            // may stay, but never a coarser ancestor's, which would cover the view beside it.
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
    }
    const now = performance.now();
    if (now - this.cutWindowStart >= CUT_IDLE_WINDOW_MS) {
      this.cutWindowStart = now;
      this.cutWindowSpent = 0;
    }
    // Out of budget, the pass waits: the next frame's update makes one before it renders. A pass
    // with a sliver left would still cut a whole slice and gather every opening first.
    if (this.cutoutsDirty && this.cutWindowSpent <= CUT_BUDGET_MS - 1) {
      this.cutoutsDirty = false;
      if (this.groundCutouts.update(this.object, CUT_BUDGET_MS - this.cutWindowSpent))
        this.trackCutAllocations(this.groundCutouts.changedMeshes);
      // The rest follow in later passes (each stream update makes one), a budget at a time; a
      // pass requested now would only run in this same task.
      if (this.groundCutouts.pending) this.cutoutsDirty = true;
      this.cutWindowSpent += performance.now() - now;
    }
    this.refreshDisplayedBytes();
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
      tile.layers.has(layer.id) ||
      tile.emptyLayers.has(layer.id) ||
      this.pendingLayers.has(key) ||
      this.layerRetries.isBlocked(key) ||
      !this.layerEligible(layer, tile.address.level) ||
      this.pendingLayers.size >= this.budget.maxConcurrentLayerLoads
    ) {
      return;
    }
    const controller = new AbortController();
    this.pendingLayers.set(key, { address: tile.address, layer, controller });
    const origin = terrainPyramidTileOrigin(this.descriptor, tile.address);
    const tileSize = terrainPyramidTileSize(this.descriptor, tile.address.level);
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
          ...(this.options.admission ? { admission: this.options.admission } : {}),
        });
        if (object !== undefined) {
          // A renderer builds each mesh's shaders for its shadow flags too: marked after preparing,
          // every instanced batch (three builds those per object) was built again mid-frame.
          freezeStaticTransforms(object);
          if (this.options.shadows === true)
            markShadows(object, this.options.shadowCasterHeight ?? 1.5);
          try {
            if (!signal.aborted) await this.options.prepareObject?.(object, signal, tile.object);
            if (signal.aborted) throw signal.reason;
          } catch (error) {
            layer.disposeTile?.(object);
            throw error;
          }
        }
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
            if (object === undefined) {
              this.layerRetries.clear(key);
              current.emptyLayers.add(layer.id);
              this.requestVisibility();
              return;
            }
            object.name ||= `layer:${layer.id}:${tileKey}`;
            this.layerRetries.clear(key);
            object.visible = false;
            current.layers.set(layer.id, object);
            current.object.add(object);
            this.trackAllocations(current);
            this.requestVisibility();
          },
          controller.signal,
          'layer-publication',
        ).catch((error) => {
          if (object !== undefined && !this.resident.get(tileKey)?.layers.has(layer.id))
            layer.disposeTile?.(object);
          throw error;
        });
      })
      .catch((error: unknown) => {
        if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
        this.layerRetries.markFailed(
          key,
          { address: tile.address, layerId: layer.id },
          error,
          () => {
            this.startQueuedLayerLoads();
            this.resolveIdleIfNeeded();
          },
        );
        this.updateVisibility();
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
    if (this.pendingLayers.size >= this.budget.maxConcurrentLayerLoads) return;
    const view = this.view;
    const detailedParents = new Set<string>();
    for (const [id, keys] of this.displayedLayers)
      for (const key of keys) if (this.resident.get(key)?.layers.has(id)) detailedParents.add(key);
    // Selected leaves already in the resident cache can prepare their detail while another
    // child's terrain is still loading. Publication remains coverage-safe in updateLayerVisibility.
    // The selection's camera guard band also warms detail just outside the current view.
    const candidates = [
      ...new Set([
        ...this.displayed,
        ...this.replacementTiles,
        ...this.selected.keys(),
        ...this.preloading,
      ]),
    ]
      .map((key) => this.resident.get(key))
      .filter((tile): tile is ResidentTile => tile !== undefined && this.wantsLayers(tile.address))
      .map((tile) => {
        const bounds = tileBounds(this.descriptor, tile.address);
        const distance =
          view === undefined ? 0 : distanceToBounds(view.position, bounds, this.descriptor.height);
        // A detailed parent stays visible until its replacement family is ready. Give the
        // whole family its parent's distance, or a ready tile beneath the aircraft can stay
        // hidden while unrelated, individually nearer leaves consume every layer slot.
        let familyDistance = distance;
        let inView = view === undefined || intersectsHorizontalView(view, bounds, 0);
        for (
          let level = tile.address.level - 1;
          view && level >= this.descriptor.minLevel;
          level--
        ) {
          const parent = terrainPyramidAncestor(tile.address, level);
          const key = terrainPyramidTileKey(parent);
          if (!detailedParents.has(key)) continue;
          const parentBounds = tileBounds(this.descriptor, parent);
          familyDistance = distanceToBounds(view.position, parentBounds, this.descriptor.height);
          inView = intersectsHorizontalView(view, parentBounds, 0);
          break;
        }
        return {
          tile,
          preload: this.preloading.has(terrainPyramidTileKey(tile.address)),
          inView,
          selected: this.selected.has(terrainPyramidTileKey(tile.address)),
          replacement: this.replacementTiles.has(terrainPyramidTileKey(tile.address)),
          familyDistance,
          distance,
        };
      })
      .sort(
        (a, b) =>
          Number(a.preload) - Number(b.preload) ||
          Number(b.inView) - Number(a.inView) ||
          a.familyDistance - b.familyDistance ||
          Number(b.replacement) - Number(a.replacement) ||
          Number(b.selected) - Number(a.selected) ||
          a.distance - b.distance ||
          b.tile.address.level - a.tile.address.level ||
          a.tile.address.z - b.tile.address.z ||
          a.tile.address.x - b.tile.address.x,
      );
    const jobs = candidates.flatMap(({ tile }) =>
      [...this.layerById.values()]
        .filter((layer) => {
          const key = `${terrainPyramidTileKey(tile.address)}:${layer.id}`;
          return (
            this.layerVisibility.get(layer.id) === true &&
            this.layerEligible(layer, tile.address.level) &&
            !tile.layers.has(layer.id) &&
            !tile.emptyLayers.has(layer.id) &&
            !this.pendingLayers.has(key) &&
            !this.layerRetries.isBlocked(key)
          );
        })
        .map((layer) => ({
          tile,
          layer,
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
    jobs.sort((a, b) => Number(b.handoff) - Number(a.handoff));
    while (jobs.length > 0 && this.pendingLayers.size < this.budget.maxConcurrentLayerLoads) {
      const preloadIndex = this.reservePreloadSlot(
        this.pendingLayers.values(),
        this.budget.maxConcurrentLayerLoads,
      )
        ? jobs.findIndex((job) => job.route)
        : -1;
      const job = jobs.splice(preloadIndex >= 0 ? preloadIndex : 0, 1)[0];
      if (job) this.startLayerLoad(job.tile, job.layer);
    }
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
    const stale = [...this.resident.entries()]
      .filter(
        ([key]) =>
          !this.visiblyRetains(key) && !this.wanted.has(key) && !this.replacementTiles.has(key),
      )
      .sort(
        ([, a], [, b]) =>
          a.lastUsed - b.lastUsed || b.address.level - a.address.level || a.address.z - b.address.z,
      );
    for (const [key] of stale) {
      if (underBudget()) break;
      this.evict(key);
    }

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
          tile.address.level < this.descriptor.maxLevel,
      )
      .sort(([, a], [, b]) => a.address.level - b.address.level || a.lastUsed - b.lastUsed);
    for (const [key] of coveredParents) {
      if (underBudget()) break;
      this.evict(key);
    }
  }

  private evict(key: string): void {
    const tile = this.resident.get(key);
    if (tile === undefined) return;
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
    for (const id of this.layerById.keys()) this.layerRetries.clear(`${key}:${id}`);
    tile.object.removeFromParent();
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

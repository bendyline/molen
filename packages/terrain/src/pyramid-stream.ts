/**
 * Camera-driven terrain-pyramid selection and residency.
 *
 * This module has no geographic or archive assumptions. It selects square planar tiles by
 * projected sample spacing, requests ancestors before descendants, and keeps an ancestor visible
 * until its replacement surfaces and enabled layers are prepared. That whole-tile transition
 * avoids holes, exposed layer construction and partial-refinement z-fighting while moving.
 */

import type { SceneAdmission } from '@bendyline/molen-client';
import * as THREE from 'three';
import type { TerrainDescriptor } from './descriptor-types';
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
  /** Shared frame budget for construction/publication, also passed to semantic adapters. */
  admission?: SceneAdmission;
  prepareObject?: (object: THREE.Object3D, signal: AbortSignal) => Promise<void>;
  /** Optional renderer-owned tile group, e.g. a managed WebGPU render-command cache. */
  createTileGroup?: () => THREE.Group;
  material?: THREE.Material;
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

export interface TerrainPyramidStreamStats extends TerrainStreamStats {
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

export interface TerrainPyramidStream {
  updateTransitions(nowMs?: number): void;
  readonly object: THREE.Group;
  update(view: TerrainPyramidView): void;
  /** Replan in place. Surface resolution affects newly loaded tiles, preserving resident draping. */
  setBudget(budget: Partial<TerrainPyramidBudget>): void;
  getBudget(): TerrainPyramidBudget;
  /** Constant-time retained allocation estimates for an adaptive quality controller. */
  pressure(): TerrainPyramidStreamPressure;
  /** Refresh retained allocation estimates after an adapter mutates resident layer geometry. */
  refreshMemoryUsage(): void;
  sampleHeight(x: number, z: number): number | undefined;
  setLayerVisible(id: string, visible: boolean): void;
  isLayerVisible(id: string): boolean;
  residentTiles(): TerrainPyramidTileAddress[];
  displayedTiles(): TerrainPyramidTileAddress[];
  /** Tiles that will not load again on their own: missing plus abandoned. */
  failedTiles(): TerrainPyramidTileAddress[];
  /** Per-tile missing/retrying/abandoned detail, so a host can say which state a hole is in. */
  tileFailures(): Array<TerrainTileFailure<TerrainPyramidTileAddress>>;
  retryFailed(): void;
  stats(): TerrainPyramidStreamStats;
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
        maxConcurrentLayerLoads: 4,
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

function intersectsHorizontalView(
  view: TerrainPyramidView,
  bounds: [number, number, number, number],
  guardRadians = THREE.MathUtils.degToRad(12),
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
  const forwardLength = Math.hypot(view.direction[0], view.direction[2]);
  if (forwardLength < 1e-6) return true;
  // A circular cone enclosing the rectangular frustum is conservative for pitch and roll.
  // If it includes nadir/zenith, its horizontal projection covers every azimuth.
  const diagonalHalfFov = Math.atan(Math.tan(view.verticalFov / 2) * Math.hypot(1, view.aspect));
  const cosPitch = forwardLength / Math.hypot(...view.direction);
  if (Math.sin(diagonalHalfFov) >= cosPitch) return true;
  const dot = (toX * view.direction[0] + toZ * view.direction[2]) / (distance * forwardLength);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const horizontalFov = 2 * Math.asin(Math.min(1, Math.sin(diagonalHalfFov) / cosPitch));
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

function pyramidAddressesOverlap(
  a: TerrainPyramidTileAddress,
  b: TerrainPyramidTileAddress,
): boolean {
  const [ancestor, descendant] = a.level <= b.level ? [a, b] : [b, a];
  return (
    terrainPyramidTileKey(terrainPyramidAncestor(descendant, ancestor.level)) ===
    terrainPyramidTileKey(ancestor)
  );
}

function selectAt(
  descriptor: TerrainPyramidDescriptor,
  view: TerrainPyramidView,
  maxScreenSpaceError: number,
  viewDistance: number,
): TerrainPyramidTileAddress[] {
  const selected: TerrainPyramidTileAddress[] = [];
  const pixelsPerRadian = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  const visit = (address: TerrainPyramidTileAddress): void => {
    const bounds = tileBounds(descriptor, address);
    if (descriptor.coverage !== undefined && !boxesIntersect(bounds, descriptor.coverage)) return;
    if (!intersectsHorizontalView(view, bounds)) return;
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
  const focal = view.viewportHeight / (2 * Math.tan(view.verticalFov / 2));
  const projected = (tile: TerrainPyramidTileAddress): number =>
    ((terrainPyramidTileSize(descriptor, tile.level) / (descriptor.tileResolution - 1)) * focal) /
    Math.max(1, distanceToBounds(view.position, tileBounds(descriptor, tile), descriptor.height));
  const visible = (tile: TerrainPyramidTileAddress): boolean => {
    const bounds = tileBounds(descriptor, tile);
    return (
      (descriptor.coverage === undefined || boxesIntersect(bounds, descriptor.coverage)) &&
      intersectsHorizontalView(view, bounds) &&
      distanceToBounds(view.position, bounds, descriptor.height) <= options.viewDistance
    );
  };
  // Start with mandatory coarse coverage, then spend the remaining tile budget on the most
  // visible error. Every node is visited once; no whole-tree threshold retry traversals.
  const roots = selectAt(descriptor, view, Number.MAX_VALUE, options.viewDistance).sort(
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

function objectGeometryStats(root: THREE.Object3D, visibleOnly: boolean): ObjectGeometryStats {
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
      for (const buffer of [instanced.instanceMatrix, instanced.instanceColor]) {
        if (buffer !== null) countBuffer(buffer.array);
      }
    }
    const baseTriangles =
      mesh.geometry.index !== null
        ? mesh.geometry.index.count / 3
        : (mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
    triangles += baseTriangles * count;
    if (seen.has(mesh.geometry)) return;
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

function addressFromKey(key: string): TerrainPyramidTileAddress {
  const [level, x, z] = key.split('/').map(Number);
  return { level: level as number, x: x as number, z: z as number };
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
): { mesh: THREE.Mesh; bytes: number; triangles: number } {
  const step = Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (maxResolution - 1)));
  const geometry =
    prepared ??
    buildChunkGeometry(heightfield, surfaceDescriptor(descriptor, address), address.x, address.z, {
      localCoordinates: true,
      step,
      ...(neighborHeight === undefined ? {} : { neighborHeight }),
    });
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute('position', new THREE.BufferAttribute(geometry.positions, 3));
  buffer.setAttribute('normal', new THREE.BufferAttribute(geometry.normals, 3));
  buffer.setAttribute('color', new THREE.BufferAttribute(geometry.colors, 3));
  buffer.setIndex(new THREE.BufferAttribute(geometry.indices, 1));
  buffer.computeBoundingSphere();
  const mesh = new THREE.Mesh(buffer, material);
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
  private geometryBytes = 0;
  private decodedHeightBytes = 0;
  private displayedBytes = 0;

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

  update(view: TerrainPyramidView): void {
    if (this.disposed) return;
    requireView(view);
    this.view = {
      ...view,
      position: [...view.position],
      ...(view.direction === undefined ? {} : { direction: [...view.direction] }),
    };
    this.usage++;
    this.selection = selectTerrainPyramidTiles(this.descriptor, this.view, {
      ...this.budget,
      previousTiles: this.selection.tiles,
    });
    this.selected.clear();
    this.wanted.clear();
    this.coarseWanted.clear();
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
        addWanted(ancestor);
        if (level > coveredLevel) loadWanted.add(terrainPyramidTileKey(ancestor));
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
          a.address.level - b.address.level ||
          Number(b.inView) - Number(a.inView) ||
          a.distance - b.distance ||
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
    if (this.view !== undefined) this.update(this.view);
    else {
      this.selection.effectiveScreenSpaceError = next.maxScreenSpaceError;
      this.selection.effectiveViewDistance = next.viewDistance;
    }
  }

  getBudget(): TerrainPyramidBudget {
    return { ...this.budget };
  }

  pressure(): TerrainPyramidStreamPressure {
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

  refreshMemoryUsage(): void {
    if (this.disposed) return;
    for (const tile of this.resident.values()) {
      this.trackAllocations(tile);
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
      const position = tile.surface.geometry.getAttribute('position') as THREE.BufferAttribute;
      applySurfaceHeightMorph(position.array as Float32Array, morph, progress);
      position.needsUpdate = true;
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
        const instanced = mesh as THREE.InstancedMesh;
        if (instanced.isInstancedMesh) {
          buffers.add(instanced.instanceMatrix.array.buffer);
          if (instanced.instanceColor) buffers.add(instanced.instanceColor.array.buffer);
        }
      });
    tile.allocations = buffers;
    tile.geometryBytes = 0;
    for (const buffer of buffers) {
      tile.geometryBytes += buffer.byteLength;
      const count = this.allocations.get(buffer) ?? 0;
      if (count === 0) this.geometryBytes += buffer.byteLength;
      this.allocations.set(buffer, count + 1);
    }
  }

  sampleHeight(x: number, z: number): number | undefined {
    for (let level = this.descriptor.maxLevel; level >= this.descriptor.minLevel; level--) {
      const address = terrainPyramidAddressAt(this.descriptor, level, x, z);
      if (address === undefined) continue;
      const key = terrainPyramidTileKey(address);
      if (!this.displayed.has(key)) continue;
      return this.resident.get(key)?.heightfield.sampleHeight(x, z);
    }
    return undefined;
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
        const position = tile.surface.geometry.getAttribute('position') as THREE.BufferAttribute;
        applySurfaceHeightMorph(position.array as Float32Array, tile.morph, 1);
        position.needsUpdate = true;
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
    return [...this.resident.values()]
      .map((tile) => ({ ...tile.address }))
      .sort((a, b) => a.level - b.level || a.z - b.z || a.x - b.x);
  }

  displayedTiles(): TerrainPyramidTileAddress[] {
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
    this.update(this.view);
  }

  stats(): TerrainPyramidStreamStats {
    let decodedSamples = 0;
    let layerObjects = 0;
    for (const tile of this.resident.values()) {
      decodedSamples += tile.heightfield.cols * tile.heightfield.rows;
      layerObjects += tile.layers.size;
    }
    const failures = this.retries.counts();
    const layerFailures = this.layerRetries.counts();
    const allocatedGeometry = objectGeometryStats(this.object, false);
    const visibleGeometry = objectGeometryStats(this.object, true);
    const levels = this.displayedTiles().map((tile) => tile.level);
    let fallbackLeaves = 0;
    for (const address of this.selected.values()) {
      if (!this.resident.has(terrainPyramidTileKey(address))) fallbackLeaves++;
    }
    return {
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
      geometryBytes: allocatedGeometry.bytes,
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
      const wanted = (
        transitionIndex >= 0 ? this.queue.splice(transitionIndex, 1)[0] : this.queue.shift()
      ) as WantedTile;
      const key = terrainPyramidTileKey(wanted.address);
      if (!this.wanted.has(key) || this.resident.has(key) || this.pending.has(key)) continue;
      const controller = new AbortController();
      this.pending.set(key, { address: wanted.address, controller });
      const resolution = this.budget.maxSurfaceTileResolution;
      const request = loadTerrainTileWithTimeout<PreparedTile | undefined>(
        async (signal): Promise<PreparedTile | undefined> => {
          if (this.source.loadPrepared) {
            return this.source.loadPrepared(wanted.address, signal, resolution);
          }
          const heightfield = await this.source.load(wanted.address, signal);
          return heightfield === undefined ? undefined : { heightfield };
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
    this.update(this.view);
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
    const origin = terrainPyramidTileOrigin(this.descriptor, address);
    object.name = `tile:${key}`;
    object.position.set(origin[0], 0, origin[1]);
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
              positions: parent.surface.geometry.getAttribute('position').array as Float32Array,
              resolution: parent.surfaceResolution,
              size: terrainPyramidTileSize(this.descriptor, level),
              offsetX: origin[0] - parentOrigin[0],
              offsetZ: origin[1] - parentOrigin[1],
            });
            if (morph) {
              applySurfaceHeightMorph(full, morph, 0);
              const original = result.mesh.geometry.boundingSphere?.clone();
              result.mesh.geometry.computeBoundingSphere();
              if (original) result.mesh.geometry.boundingSphere?.union(original);
            }
            break;
          }
        }
        return result;
      },
      signal,
      'terrain-assembly',
    );
    object.add(surface.mesh);
    try {
      await this.options.prepareObject?.(object, signal);
      await this.admit(
        () => {
          if (this.disposed || signal.aborted)
            throw new DOMException('Tile cancelled', 'AbortError');
          surface.mesh.visible = false;
          object.updateMatrix();
          object.matrixAutoUpdate = false;
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
          this.updateVisibility();
          this.evictUnused();
        },
        signal,
        'terrain-publication',
        surface.bytes,
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
    const attribute = tile.surface.geometry.getAttribute('normal');
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
    if (refreshed) attribute.needsUpdate = true;
  }

  private admit<T>(task: () => T, signal: AbortSignal, label: string, bytes = 0): Promise<T> {
    if (this.options.admission) return this.options.admission.run(task, { signal, label, bytes });
    if (signal.aborted) return Promise.reject(new DOMException('Tile cancelled', 'AbortError'));
    return Promise.resolve().then(task);
  }

  private updateVisibility(): void {
    const previousDisplayed = this.displayed;
    const candidates = new Set<string>();
    for (const leaf of this.selected.values()) {
      let covered = false;
      for (let level = leaf.level; level >= this.descriptor.minLevel; level--) {
        const address = terrainPyramidAncestor(leaf, level);
        const key = terrainPyramidTileKey(address);
        if (this.resident.has(key)) {
          candidates.add(key);
          covered = true;
          break;
        }
      }
      if (!covered) {
        // A coarser selected parent may have left the warm cache. Keep its former visible
        // descendants until it arrives instead of hiding an already covered patch.
        for (const key of previousDisplayed) {
          const address = this.resident.get(key)?.address;
          if (
            address !== undefined &&
            address.level > leaf.level &&
            terrainPyramidTileKey(terrainPyramidAncestor(address, leaf.level)) ===
              terrainPyramidTileKey(leaf)
          ) {
            candidates.add(key);
          }
        }
      }
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
          // After bounded retries, a bare ancestor has no missing detail to preserve.
          // Publish the usable replacement layers instead of pinning an entire region to it.
          // A complete old tile still wins when it can supply a layer the replacement lost.
          if (
            this.layersReady(tile, true) &&
            ![...previousTile.layers.keys()].some(
              (id) =>
                this.layerVisibility.get(id) === true &&
                this.layerRetries.state(`${key}:${id}`) === 'failed',
            )
          )
            continue;
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
    for (const key of candidates) {
      const address = addressFromKey(key);
      for (let level = address.level - 1; level >= this.descriptor.minLevel; level--) {
        if (candidates.has(terrainPyramidTileKey(terrainPyramidAncestor(address, level)))) {
          result.delete(key);
          break;
        }
      }
    }
    return result;
  }

  private layersReady(tile: ResidentTile, allowFailed = false): boolean {
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

  /** Publish enabled layers together, retaining detail during explicit layer toggles. */
  private updateLayerVisibility(): void {
    for (const layer of this.layerById.values()) {
      const previous = this.displayedLayers.get(layer.id) ?? new Set<string>();
      const candidates = new Set<string>();
      if (this.layerVisibility.get(layer.id) === true) {
        for (const key of this.displayed) {
          const tile = this.resident.get(key);
          if (tile === undefined || !this.layerEligible(layer, tile.address.level)) continue;
          if (
            this.layersReady(tile, true) &&
            (tile.layers.has(layer.id) || tile.emptyLayers.has(layer.id))
          ) {
            candidates.add(key);
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
      for (const [id, object] of tile.layers) {
        object.visible = this.displayedLayers.get(id)?.has(key) === true;
      }
      // A warm tile can contain hundreds of LOD groups. Hide its root too, so renderer
      // traversal and WebGPU command inspection stop before visiting that cached subtree.
      tile.object.visible = this.visiblyRetains(key);
    }
    this.refreshDisplayedBytes();
  }

  private refreshDisplayedBytes(): void {
    const visibleTiles = new Set(this.displayed);
    for (const layerTiles of this.displayedLayers.values()) {
      for (const key of layerTiles) visibleTiles.add(key);
    }
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

  private startEnabledLayers(tile: ResidentTile): void {
    for (const layer of this.layerById.values()) {
      if (
        this.layerVisibility.get(layer.id) === true &&
        this.layerEligible(layer, tile.address.level)
      ) {
        this.startLayerLoad(tile, layer);
      }
    }
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
          try {
            if (!signal.aborted) await this.options.prepareObject?.(object, signal);
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
              this.updateVisibility();
              this.evictUnused();
              return;
            }
            object.name ||= `layer:${layer.id}:${tileKey}`;
            this.layerRetries.clear(key);
            object.visible = false;
            current.layers.set(layer.id, object);
            current.object.add(object);
            this.trackAllocations(current);
            this.updateVisibility();
            this.evictUnused();
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
    // Selected leaves already in the resident cache can prepare their detail while another
    // child's terrain is still loading. Publication remains coverage-safe in updateLayerVisibility.
    // The selection's camera guard band also warms detail just outside the current view.
    const candidates = [
      ...new Set([...this.displayed, ...this.replacementTiles, ...this.selected.keys()]),
    ]
      .map((key) => this.resident.get(key))
      .filter((tile): tile is ResidentTile => tile !== undefined)
      .map((tile) => {
        const bounds = tileBounds(this.descriptor, tile.address);
        return {
          tile,
          inView: view === undefined || intersectsHorizontalView(view, bounds, 0),
          selected: this.selected.has(terrainPyramidTileKey(tile.address)),
          distance:
            view === undefined
              ? 0
              : distanceToBounds(view.position, bounds, this.descriptor.height),
        };
      })
      .sort(
        (a, b) =>
          Number(b.inView) - Number(a.inView) ||
          Number(b.selected) - Number(a.selected) ||
          a.distance - b.distance ||
          b.tile.address.level - a.tile.address.level ||
          a.tile.address.z - b.tile.address.z ||
          a.tile.address.x - b.tile.address.x,
      );
    for (const { tile } of candidates) {
      this.startEnabledLayers(tile);
      if (this.pendingLayers.size >= this.budget.maxConcurrentLayerLoads) return;
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
      .filter(([key]) => !this.visiblyRetains(key) && !this.wanted.has(key))
      .sort(
        ([, a], [, b]) =>
          a.lastUsed - b.lastUsed || b.address.level - a.address.level || a.address.z - b.address.z,
      );
    for (const [key] of stale) {
      if (underBudget()) break;
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

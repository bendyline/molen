/**
 * Client-side fixed-grid terrain streaming.
 *
 * The streamer turns the descriptor's tile grid into a bounded, prioritized residency set around
 * a camera. Height acquisition is provider-based, so URL templates, archives, procedural worlds,
 * and tests share the same lifecycle. Optional tile layers attach classification, hydrology, or
 * human-feature objects without coupling the terrain core to a vector schema.
 *
 * Mesh vertices are tile-local and the tile Object3D carries the world translation. This is
 * important for large-world precision and composes with Renderer.setWorldOrigin().
 */

import * as THREE from 'three';
import type { TerrainDescriptor } from './descriptor-types';
import type { Heightfield } from './heightfield';
import {
  buildChunkGeometry,
  type ChunkEdge,
  lodStepForDistance,
  neighborTileIndices,
  refreshChunkEdgeNormals,
  type TerrainNeighborHeightSampler,
} from './mesh';
import {
  heightfieldTileFromPng,
  type TerrainTileAddress,
  terrainTileKey,
  terrainTileOrigin,
} from './tile';
import {
  loadTerrainTileWithTimeout,
  resolveTerrainTileRetryPolicy,
  type TerrainTileFailure,
  type TerrainTileRetryOptions,
  type TerrainTileRetryPolicy,
  TerrainTileRetryTracker,
} from './tile-retry';

export interface TerrainHeightTileSource {
  load(address: TerrainTileAddress, signal: AbortSignal): Promise<Heightfield | undefined>;
  dispose?(): void;
}

export interface UrlTerrainTileSourceOptions {
  /** URL against which a relative heightUrl template resolves. */
  baseUrl?: string | URL;
  /** Injectable fetch implementation for native hosts and tests. */
  fetcher?: typeof globalThis.fetch;
}

export function resolveTerrainTileUrl(
  template: string,
  address: TerrainTileAddress,
  baseUrl?: string | URL,
): string {
  const path = template.replaceAll('{x}', String(address.x)).replaceAll('{z}', String(address.z));
  if (baseUrl !== undefined) return new URL(path, baseUrl).href;
  if (typeof document !== 'undefined') return new URL(path, document.baseURI).href;
  return path;
}

/** Fetch descriptor PNG16 tiles from its heightUrl template. HTTP 404 means an absent tile. */
export function createUrlTerrainTileSource(
  descriptor: TerrainDescriptor,
  options: UrlTerrainTileSourceOptions = {},
): TerrainHeightTileSource {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (fetcher === undefined) throw new Error('terrain URL tile source requires fetch');
  return {
    async load(address, signal): Promise<Heightfield | undefined> {
      const url = resolveTerrainTileUrl(descriptor.tiles.heightUrl, address, options.baseUrl);
      const response = await fetcher(url, { signal });
      if (response.status === 404) return undefined;
      if (!response.ok) {
        throw new Error(`terrain tile ${terrainTileKey(address)} failed: HTTP ${response.status}`);
      }
      const png = new Uint8Array(await response.arrayBuffer());
      return heightfieldTileFromPng(descriptor, address, png);
    },
  };
}

/** Broad semantic roles let applications compose modes without conflating natural and built data. */
export type TerrainTileLayerCategory = 'classification' | 'hydrology' | 'human-feature';

export interface TerrainTileLayerContext {
  address: TerrainTileAddress;
  descriptor: TerrainDescriptor;
  heightfield: Heightfield;
  /** Returned objects use tile-local X/Z coordinates and world-space Y heights. */
  origin: [number, number];
  signal: AbortSignal;
}

export interface TerrainTileLayer {
  id: string;
  category: TerrainTileLayerCategory;
  visible?: boolean;
  createTile(
    context: TerrainTileLayerContext,
  ): THREE.Object3D | undefined | Promise<THREE.Object3D | undefined>;
  /** Dispose layer-owned geometry/material resources when a terrain tile leaves residency. */
  disposeTile?(object: THREE.Object3D): void;
}

export interface TerrainStreamErrorContext {
  address: TerrainTileAddress;
  layerId?: string;
}

export interface TerrainStreamOptions extends TerrainTileRetryOptions {
  material?: THREE.Material;
  layers?: TerrainTileLayer[];
  loadRadius?: number;
  unloadRadius?: number;
  maxConcurrentLoads?: number;
  maxResidentTiles?: number;
  cameraPos?: [number, number, number];
  onError?: (error: unknown, context: TerrainStreamErrorContext) => void;
}

export type TerrainQualityPreset = 'economy' | 'balanced' | 'high';

export interface TerrainStreamBudget {
  loadRadius: number;
  unloadRadius: number;
  maxConcurrentLoads: number;
  maxResidentTiles: number;
}

/** Portable quality presets expressed only as streaming budgets, never device-name checks. */
export function terrainStreamBudgetForQuality(quality: TerrainQualityPreset): TerrainStreamBudget {
  switch (quality) {
    case 'economy':
      return { loadRadius: 1.5, unloadRadius: 2.25, maxConcurrentLoads: 2, maxResidentTiles: 24 };
    case 'balanced':
      return { loadRadius: 2.5, unloadRadius: 3.25, maxConcurrentLoads: 4, maxResidentTiles: 64 };
    case 'high':
      return { loadRadius: 3.5, unloadRadius: 4.5, maxConcurrentLoads: 8, maxResidentTiles: 128 };
  }
}

export interface TerrainStreamStats {
  desired: number;
  queued: number;
  loading: number;
  loadingLayers: number;
  resident: number;
  /** Tiles that will not load again without retryFailed(): missing plus abandoned. */
  failed: number;
  /** Tiles the source reported as absent (HTTP 404 / undefined). Stable, never retried. */
  missing: number;
  /** Tiles whose last attempt threw and that are still inside their retry budget. */
  retrying: number;
  failedLayers: number;
  layerObjects: number;
  evictions: number;
  decodedSamples: number;
  geometryBytes: number;
  triangles: number;
  instances: number;
  drawCalls: number;
}

export interface TerrainStream {
  readonly object: THREE.Group;
  update(cameraPos: [number, number, number]): void;
  sampleHeight(x: number, z: number): number | undefined;
  setLayerVisible(id: string, visible: boolean): void;
  isLayerVisible(id: string): boolean;
  residentTiles(): TerrainTileAddress[];
  /** Tiles that will not load again on their own: missing plus abandoned. */
  failedTiles(): TerrainTileAddress[];
  /** Per-tile missing/retrying/abandoned detail, so a host can say which state a hole is in. */
  tileFailures(): Array<TerrainTileFailure<TerrainTileAddress>>;
  retryFailed(): void;
  stats(): TerrainStreamStats;
  whenIdle(): Promise<void>;
  dispose(): void;
}

interface WantedTile {
  address: TerrainTileAddress;
  distance: number;
  step: number;
}

interface ResidentTile {
  address: TerrainTileAddress;
  heightfield: Heightfield;
  object: THREE.Group;
  surface: THREE.Mesh;
  step: number;
  lastUsed: number;
  layers: Map<string, THREE.Object3D>;
}

interface PendingTile {
  address: TerrainTileAddress;
  controller: AbortController;
}

interface PendingLayer {
  address: TerrainTileAddress;
  layer: TerrainTileLayer;
  controller: AbortController;
}

interface ObjectGeometryStats {
  bytes: number;
  triangles: number;
  instances: number;
  drawCalls: number;
}

function geometryStats(root: THREE.Object3D): ObjectGeometryStats {
  const seen = new Set<THREE.BufferGeometry>();
  let bytes = 0;
  let triangles = 0;
  let instances = 0;
  let drawCalls = 0;
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (!renderable.isMesh) return;
    const mesh = renderable as THREE.Mesh | THREE.InstancedMesh;
    drawCalls +=
      Array.isArray(mesh.material) && mesh.geometry.groups.length > 0
        ? mesh.geometry.groups.length
        : 1;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const instanced = mesh as THREE.InstancedMesh;
      instances += instanced.count;
      bytes += instanced.instanceMatrix.array.byteLength;
    }
    const geometry = mesh.geometry;
    const baseTriangles =
      geometry.index !== null
        ? geometry.index.count / 3
        : (geometry.getAttribute('position')?.count ?? 0) / 3;
    triangles +=
      baseTriangles *
      ((mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1);
    if (seen.has(geometry)) return;
    seen.add(geometry);
    for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
    if (geometry.index !== null) {
      bytes += geometry.index.array.byteLength;
    }
  });
  return { bytes, triangles, instances, drawCalls };
}

function addressFromKey(key: string): TerrainTileAddress {
  const [x, z] = key.split('_').map(Number);
  return { x: x as number, z: z as number };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function makeSurfaceMesh(
  descriptor: TerrainDescriptor,
  heightfield: Heightfield,
  address: TerrainTileAddress,
  step: number,
  material: THREE.Material,
  neighborHeight: TerrainNeighborHeightSampler,
): THREE.Mesh {
  const geometry = buildChunkGeometry(heightfield, descriptor, address.x, address.z, {
    step,
    localCoordinates: true,
    neighborHeight,
  });
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute('position', new THREE.BufferAttribute(geometry.positions, 3));
  buffer.setAttribute('normal', new THREE.BufferAttribute(geometry.normals, 3));
  buffer.setAttribute('color', new THREE.BufferAttribute(geometry.colors, 3));
  buffer.setIndex(new THREE.BufferAttribute(geometry.indices, 1));
  buffer.computeBoundingSphere();
  const mesh = new THREE.Mesh(buffer, material);
  mesh.name = `surface:${terrainTileKey(address)}:lod${step}`;
  return mesh;
}

class FixedGridTerrainStream implements TerrainStream {
  readonly object: THREE.Group;
  private readonly material: THREE.Material;
  private readonly ownsMaterial: boolean;
  private readonly layerById = new Map<string, TerrainTileLayer>();
  private readonly layerVisibility = new Map<string, boolean>();
  private readonly resident = new Map<string, ResidentTile>();
  private readonly pending = new Map<string, PendingTile>();
  private readonly pendingLayers = new Map<string, PendingLayer>();
  /**
   * Heights from whichever resident tile covers (x, z); undefined outside resident coverage.
   * A sample that lands exactly on a tile boundary belongs to either neighbour — they share that
   * height — so both are tried before giving up.
   */
  private readonly neighborHeight: TerrainNeighborHeightSampler = (x, z) => {
    const u = (x - this.descriptor.origin[0]) / this.descriptor.chunkSize;
    const v = (z - this.descriptor.origin[1]) / this.descriptor.chunkSize;
    for (const tx of neighborTileIndices(u)) {
      for (const tz of neighborTileIndices(v)) {
        const height = this.resident
          .get(terrainTileKey({ x: tx, z: tz }))
          ?.heightfield.sampleHeight(x, z);
        if (height !== undefined) return height;
      }
    }
    return undefined;
  };
  private readonly retries: TerrainTileRetryTracker<TerrainTileAddress>;
  private readonly failedLayers = new Set<string>();
  private readonly desired = new Map<string, WantedTile>();
  private queue: WantedTile[] = [];
  private cameraPos: [number, number, number];
  private usage = 0;
  private evictionCount = 0;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];
  private readonly loadRadius: number;
  private readonly unloadRadius: number;
  private readonly maxConcurrentLoads: number;
  private readonly maxResidentTiles: number;
  private readonly retryPolicy: TerrainTileRetryPolicy;

  constructor(
    private readonly descriptor: TerrainDescriptor,
    private readonly source: TerrainHeightTileSource,
    private readonly options: TerrainStreamOptions,
  ) {
    this.object = new THREE.Group();
    this.object.name = `terrain-stream:${descriptor.name}`;
    this.retryPolicy = resolveTerrainTileRetryPolicy(options);
    this.retries = new TerrainTileRetryTracker<TerrainTileAddress>(this.retryPolicy);
    this.material =
      options.material ??
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.ownsMaterial = options.material === undefined;
    this.loadRadius = options.loadRadius ?? descriptor.streaming.loadRadius;
    this.unloadRadius = options.unloadRadius ?? descriptor.streaming.unloadRadius;
    this.maxConcurrentLoads = options.maxConcurrentLoads ?? descriptor.streaming.maxConcurrentLoads;
    this.maxResidentTiles = options.maxResidentTiles ?? descriptor.streaming.maxResidentTiles;
    if (!Number.isFinite(this.loadRadius) || this.loadRadius <= 0) {
      throw new Error('terrain stream loadRadius must be finite and positive');
    }
    if (!Number.isFinite(this.unloadRadius) || this.unloadRadius < this.loadRadius) {
      throw new Error('terrain stream unloadRadius must be finite and >= loadRadius');
    }
    if (!Number.isSafeInteger(this.maxConcurrentLoads) || this.maxConcurrentLoads < 1) {
      throw new Error('terrain stream maxConcurrentLoads must be a positive safe integer');
    }
    if (!Number.isSafeInteger(this.maxResidentTiles) || this.maxResidentTiles < 1) {
      throw new Error('terrain stream maxResidentTiles must be a positive safe integer');
    }
    for (const layer of options.layers ?? []) {
      if (this.layerById.has(layer.id))
        throw new Error(`duplicate terrain tile layer "${layer.id}"`);
      this.layerById.set(layer.id, layer);
      this.layerVisibility.set(layer.id, layer.visible ?? true);
    }
    this.cameraPos = options.cameraPos ?? [descriptor.origin[0], 0, descriptor.origin[1]];
    this.update(this.cameraPos);
  }

  update(cameraPos: [number, number, number]): void {
    if (this.disposed) return;
    this.cameraPos = [...cameraPos];
    this.usage++;
    this.desired.clear();
    const wanted = this.computeWanted();
    for (const tile of wanted.slice(0, this.maxResidentTiles)) {
      const key = terrainTileKey(tile.address);
      this.desired.set(key, tile);
      const current = this.resident.get(key);
      if (current !== undefined) {
        current.lastUsed = this.usage;
        if (current.step !== tile.step) this.replaceSurface(current, tile.step);
      }
    }

    for (const [key, request] of this.pending) {
      if (!this.withinRadius(request.address, this.unloadRadius)) {
        request.controller.abort();
        this.pending.delete(key);
      }
    }
    for (const [key, tile] of this.resident) {
      if (!this.withinRadius(tile.address, this.unloadRadius)) this.evict(key);
    }
    this.enforceResidentLimit();

    this.queue = [...this.desired.values()].filter((tile) => {
      const key = terrainTileKey(tile.address);
      return !this.resident.has(key) && !this.pending.has(key) && !this.retries.isBlocked(key);
    });
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
  }

  sampleHeight(x: number, z: number): number | undefined {
    const tx = Math.floor((x - this.descriptor.origin[0]) / this.descriptor.chunkSize);
    const tz = Math.floor((z - this.descriptor.origin[1]) / this.descriptor.chunkSize);
    return this.resident.get(terrainTileKey({ x: tx, z: tz }))?.heightfield.sampleHeight(x, z);
  }

  setLayerVisible(id: string, visible: boolean): void {
    const layer = this.layerById.get(id);
    if (layer === undefined) throw new Error(`unknown terrain tile layer "${id}"`);
    this.layerVisibility.set(id, visible);
    for (const tile of this.resident.values()) {
      const object = tile.layers.get(id);
      if (object !== undefined) object.visible = visible;
      else if (visible) this.startLayerLoad(tile, layer);
    }
  }

  isLayerVisible(id: string): boolean {
    if (!this.layerById.has(id)) throw new Error(`unknown terrain tile layer "${id}"`);
    return this.layerVisibility.get(id) === true;
  }

  residentTiles(): TerrainTileAddress[] {
    return [...this.resident.values()]
      .map((tile) => ({ ...tile.address }))
      .sort((a, b) => a.z - b.z || a.x - b.x);
  }

  failedTiles(): TerrainTileAddress[] {
    return this.retries
      .stableKeys()
      .map(addressFromKey)
      .sort((a, b) => a.z - b.z || a.x - b.x);
  }

  tileFailures(): Array<TerrainTileFailure<TerrainTileAddress>> {
    return this.retries
      .failures()
      .sort((a, b) => a.address.z - b.address.z || a.address.x - b.address.x);
  }

  retryFailed(): void {
    if (this.disposed) return;
    this.retries.clearAll();
    this.failedLayers.clear();
    this.update(this.cameraPos);
    for (const tile of this.resident.values()) this.startVisibleLayers(tile);
  }

  stats(): TerrainStreamStats {
    let layerObjects = 0;
    let decodedSamples = 0;
    for (const tile of this.resident.values()) {
      layerObjects += tile.layers.size;
      decodedSamples += tile.heightfield.cols * tile.heightfield.rows;
    }
    const geometry = geometryStats(this.object);
    const failures = this.retries.counts();
    return {
      desired: this.desired.size,
      queued: this.queue.length,
      loading: this.pending.size,
      loadingLayers: this.pendingLayers.size,
      resident: this.resident.size,
      failed: failures.missing + failures.failed,
      missing: failures.missing,
      retrying: failures.retrying,
      failedLayers: this.failedLayers.size,
      layerObjects,
      evictions: this.evictionCount,
      decodedSamples,
      geometryBytes: geometry.bytes,
      triangles: geometry.triangles,
      instances: geometry.instances,
      drawCalls: geometry.drawCalls,
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
    this.queue = [];
    for (const key of [...this.resident.keys()]) this.evict(key);
    this.object.removeFromParent();
    if (this.ownsMaterial) this.material.dispose();
    this.source.dispose?.();
    this.resolveIdleIfNeeded();
  }

  private computeWanted(): WantedTile[] {
    const centerX = Math.floor(
      (this.cameraPos[0] - this.descriptor.origin[0]) / this.descriptor.chunkSize,
    );
    const centerZ = Math.floor(
      (this.cameraPos[2] - this.descriptor.origin[1]) / this.descriptor.chunkSize,
    );
    const range = Math.ceil(this.loadRadius + 1);
    const wanted: WantedTile[] = [];
    for (
      let z = Math.max(0, centerZ - range);
      z <= Math.min(this.descriptor.gridSize[1] - 1, centerZ + range);
      z++
    ) {
      for (
        let x = Math.max(0, centerX - range);
        x <= Math.min(this.descriptor.gridSize[0] - 1, centerX + range);
        x++
      ) {
        const address = { x, z };
        const distance = this.distanceTo(address);
        if ((x !== centerX || z !== centerZ) && distance > this.loadRadius) continue;
        const worldDistance = distance * this.descriptor.chunkSize;
        wanted.push({
          address,
          distance,
          step: lodStepForDistance(this.descriptor, worldDistance),
        });
      }
    }
    return wanted.sort(
      (a, b) => a.distance - b.distance || a.address.z - b.address.z || a.address.x - b.address.x,
    );
  }

  private distanceTo(address: TerrainTileAddress): number {
    const origin = terrainTileOrigin(this.descriptor, address);
    const cx = origin[0] + this.descriptor.chunkSize / 2;
    const cz = origin[1] + this.descriptor.chunkSize / 2;
    const dx = (cx - this.cameraPos[0]) / this.descriptor.chunkSize;
    const dz = (cz - this.cameraPos[2]) / this.descriptor.chunkSize;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private withinRadius(address: TerrainTileAddress, radius: number): boolean {
    return this.distanceTo(address) <= radius;
  }

  private startQueuedLoads(): void {
    while (this.pending.size < this.maxConcurrentLoads && this.queue.length > 0) {
      const wanted = this.queue.shift() as WantedTile;
      const key = terrainTileKey(wanted.address);
      if (!this.desired.has(key) || this.resident.has(key) || this.pending.has(key)) continue;
      const controller = new AbortController();
      this.pending.set(key, { address: wanted.address, controller });
      void loadTerrainTileWithTimeout(
        (signal) => this.source.load(wanted.address, signal),
        controller.signal,
        this.retryPolicy.requestTimeoutMs,
      )
        .then((heightfield) => {
          this.pending.delete(key);
          if (this.disposed || controller.signal.aborted || !this.desired.has(key)) return;
          if (heightfield === undefined) {
            this.retries.markMissing(key, wanted.address);
            this.options.onError?.(new Error(`terrain tile ${key} is missing`), {
              address: wanted.address,
            });
            return;
          }
          const currentWanted = this.desired.get(key);
          if (currentWanted === undefined) return;
          this.retries.clear(key);
          this.addResident(currentWanted, heightfield);
        })
        .catch((error: unknown) => {
          this.pending.delete(key);
          if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
          this.retries.markFailed(key, wanted.address, error, () => this.retryDueTile(key));
          this.options.onError?.(error, { address: wanted.address });
        })
        .finally(() => {
          this.startQueuedLoads();
          this.resolveIdleIfNeeded();
        });
    }
  }

  /** A backoff delay elapsed: queue the tile again if the camera still wants it. */
  private retryDueTile(key: string): void {
    if (this.disposed) return;
    const wanted = this.desired.get(key);
    if (wanted === undefined || this.resident.has(key) || this.pending.has(key)) {
      this.resolveIdleIfNeeded();
      return;
    }
    this.queue.push(wanted);
    this.startQueuedLoads();
    this.resolveIdleIfNeeded();
  }

  private addResident(wanted: WantedTile, heightfield: Heightfield): void {
    const key = terrainTileKey(wanted.address);
    if (this.resident.has(key)) return;
    const object = new THREE.Group();
    const origin = terrainTileOrigin(this.descriptor, wanted.address);
    object.name = `tile:${key}`;
    object.position.set(origin[0], 0, origin[1]);
    const surface = makeSurfaceMesh(
      this.descriptor,
      heightfield,
      wanted.address,
      wanted.step,
      this.material,
      this.neighborHeight,
    );
    object.add(surface);
    const tile: ResidentTile = {
      address: wanted.address,
      heightfield,
      object,
      surface,
      step: wanted.step,
      lastUsed: this.usage,
      layers: new Map(),
    };
    this.resident.set(key, tile);
    this.object.add(object);
    this.refreshBorderNormals(tile);
    this.startVisibleLayers(tile);
    this.enforceResidentLimit();
  }

  /**
   * Make both sides of every shared border agree, now that this tile is resident. Each side
   * recomputes its own edge normals from the neighbour's heights, so LOD steps need not match
   * and no geometry is rebuilt.
   */
  private refreshBorderNormals(tile: ResidentTile): void {
    const neighbors: Array<[dx: number, dz: number, own: ChunkEdge, theirs: ChunkEdge]> = [
      [-1, 0, 'west', 'east'],
      [1, 0, 'east', 'west'],
      [0, -1, 'north', 'south'],
      [0, 1, 'south', 'north'],
    ];
    for (const [dx, dz, own, theirs] of neighbors) {
      const other = this.resident.get(
        terrainTileKey({ x: tile.address.x + dx, z: tile.address.z + dz }),
      );
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
      this.descriptor,
      tile.address.x,
      tile.address.z,
      edge,
      { normals, skirt: this.descriptor.lod.skirts, neighborHeight: this.neighborHeight },
    );
    if (refreshed) attribute.needsUpdate = true;
  }

  private replaceSurface(tile: ResidentTile, step: number): void {
    const next = makeSurfaceMesh(
      this.descriptor,
      tile.heightfield,
      tile.address,
      step,
      this.material,
      this.neighborHeight,
    );
    tile.object.remove(tile.surface);
    tile.surface.geometry.dispose();
    tile.surface = next;
    tile.step = step;
    tile.object.add(next);
  }

  private startVisibleLayers(tile: ResidentTile): void {
    for (const layer of this.layerById.values()) {
      if (this.layerVisibility.get(layer.id) === true) this.startLayerLoad(tile, layer);
    }
  }

  private startLayerLoad(tile: ResidentTile, layer: TerrainTileLayer): void {
    const tileKey = terrainTileKey(tile.address);
    const key = `${tileKey}:${layer.id}`;
    if (tile.layers.has(layer.id) || this.pendingLayers.has(key) || this.failedLayers.has(key)) {
      return;
    }
    const controller = new AbortController();
    this.pendingLayers.set(key, { address: tile.address, layer, controller });
    const origin = terrainTileOrigin(this.descriptor, tile.address);
    void Promise.resolve(
      layer.createTile({
        address: tile.address,
        descriptor: this.descriptor,
        heightfield: tile.heightfield,
        origin,
        signal: controller.signal,
      }),
    )
      .then((object) => {
        this.pendingLayers.delete(key);
        const current = this.resident.get(tileKey);
        if (
          this.disposed ||
          controller.signal.aborted ||
          current === undefined ||
          object === undefined
        ) {
          if (object !== undefined) layer.disposeTile?.(object);
          return;
        }
        object.name ||= `layer:${layer.id}:${tileKey}`;
        object.visible = this.layerVisibility.get(layer.id) === true;
        current.layers.set(layer.id, object);
        current.object.add(object);
      })
      .catch((error: unknown) => {
        this.pendingLayers.delete(key);
        if (this.disposed || controller.signal.aborted || isAbortError(error)) return;
        this.failedLayers.add(key);
        this.options.onError?.(error, { address: tile.address, layerId: layer.id });
      })
      .finally(() => this.resolveIdleIfNeeded());
  }

  private enforceResidentLimit(): void {
    if (this.resident.size <= this.maxResidentTiles) return;
    const candidates = [...this.resident.entries()].sort((a, b) => {
      const aDesired = this.desired.has(a[0]) ? 1 : 0;
      const bDesired = this.desired.has(b[0]) ? 1 : 0;
      return aDesired - bDesired || a[1].lastUsed - b[1].lastUsed;
    });
    while (this.resident.size > this.maxResidentTiles && candidates.length > 0) {
      this.evict((candidates.shift() as [string, ResidentTile])[0]);
    }
  }

  private evict(key: string): void {
    const tile = this.resident.get(key);
    if (tile === undefined) return;
    for (const [layerId, object] of tile.layers) {
      this.layerById.get(layerId)?.disposeTile?.(object);
      object.removeFromParent();
    }
    for (const [pendingKey, pending] of this.pendingLayers) {
      if (terrainTileKey(pending.address) !== key) continue;
      pending.controller.abort();
      this.pendingLayers.delete(pendingKey);
    }
    tile.surface.geometry.dispose();
    tile.object.removeFromParent();
    this.resident.delete(key);
    this.evictionCount++;
  }

  private isIdle(): boolean {
    return (
      this.queue.length === 0 &&
      this.pending.size === 0 &&
      this.pendingLayers.size === 0 &&
      this.retries.scheduledRetries() === 0
    );
  }

  private resolveIdleIfNeeded(): void {
    if (!this.isIdle()) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}

export function createTerrainStream(
  descriptor: TerrainDescriptor,
  source: TerrainHeightTileSource,
  options: TerrainStreamOptions = {},
): TerrainStream {
  return new FixedGridTerrainStream(descriptor, source, options);
}

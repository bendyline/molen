/**
 * Executable adapter from molen/terrain-package@1 to fixed-grid terrain streaming.
 *
 * Version 1 opens the package's PNG16 elevation PMTiles at one selected detail level. The resulting
 * descriptor is the same generic fixed grid used by invented worlds; PMTiles and Web Mercator stay
 * at this boundary. A future hierarchical selector can refine across archive levels without
 * changing TerrainHeightTileSource or TerrainStream.
 */

import { PMTiles, TileType } from 'pmtiles';
import { createTerrainArchiveSetArchive } from './archive-set-client';
import type { TerrainDescriptor } from './descriptor-types';
import { createElevationTileDecoder } from './elevation-filter';
import {
  createTerrainElevationWorkerSource,
  type ElevationStageTiming,
  type ElevationWorkerLike,
} from './elevation-worker';
import { WEB_MERCATOR_HALF_WORLD_METERS, wgs84ToWebMercator } from './geospatial';
import { Heightfield } from './heightfield';
import { terrainPackageMetersPerUnit } from './package-frame';
import type {
  TerrainArchiveEntryInfo,
  TerrainArchiveTransport,
  TerrainPackageArchiveSource,
  TerrainPackageDescriptor,
  TerrainPackageFrame,
  TerrainPackageSemanticContent,
  TerrainSemanticTileDecoder,
  TerrainTileArchive,
} from './package-types';
import {
  createTerrainPyramidStream,
  type TerrainPyramidHeightSource,
  type TerrainPyramidStream,
  type TerrainPyramidStreamOptions,
} from './pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from './pyramid-types';
import { assertTerrainSemanticTile, type TerrainSemanticTile } from './semantic-types';
import {
  createTerrainStream,
  type TerrainHeightTileSource,
  type TerrainStream,
  type TerrainStreamOptions,
} from './stream';
import { heightfieldSubtileFromGray16, type TerrainTileAddress } from './tile';

export interface OpenTerrainPackageOptions {
  /** Remove isolated extreme DEM samples before resampling; defaults on for geospatial packages. */
  filterElevation?: boolean;
  /** Fixed PMTiles detail level used by this stream instance. */
  level: number;
  /** Base URL of terrain-package.json, or its containing directory. */
  baseUrl?: string | URL;
  /** Native/test archive implementation; otherwise the official PMTiles URL reader is used. */
  archive?: TerrainTileArchive;
  /** How the package's archive is opened when `archive` is not given (a cache, a native reader). */
  transport?: TerrainArchiveTransport;
  /** Use the nearest available ancestor elevation tile when requested detail is missing. */
  parentFallback?: boolean;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
  /** Metric frame for projected packages; defaults to the bounds' center latitude. */
  frame?: TerrainPackageFrame;
}

export interface OpenTerrainPackageElevation {
  package: TerrainPackageDescriptor;
  level: number;
  descriptor: TerrainDescriptor;
  archive: TerrainTileArchive;
  source: TerrainHeightTileSource;
}

export interface TerrainPackageStreamOptions extends TerrainStreamOptions {
  /** Defaults on for geospatial packages; false preserves raw DEM samples. */
  filterElevation?: boolean;
  level: number;
  baseUrl?: string | URL;
  archive?: TerrainTileArchive;
  transport?: TerrainArchiveTransport;
  parentFallback?: boolean;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
  /** Metric frame for projected packages; defaults to the bounds' center latitude. */
  frame?: TerrainPackageFrame;
}

export interface TerrainPackageStream extends OpenTerrainPackageElevation {
  stream: TerrainStream;
}

export interface OpenTerrainPackagePyramidOptions {
  /** Remove isolated extreme DEM samples before resampling; defaults on for geospatial packages. */
  filterElevation?: boolean;
  /** Worker runs decoded-grid caching, resampling and meshing; host retains archive I/O. */
  elevationWorker?: ElevationWorkerLike;
  onElevationTiming?: (timing: ElevationStageTiming) => void;
  /** Base URL of terrain-package.json, or its containing directory. */
  baseUrl?: string | URL;
  /** Native/test archive implementation; otherwise the official PMTiles URL reader is used. */
  archive?: TerrainTileArchive;
  /** How the package's archive is opened when `archive` is not given (a cache, a native reader). */
  transport?: TerrainArchiveTransport;
  /** Use the nearest available ancestor elevation tile when exact pyramid detail is absent. */
  parentFallback?: boolean;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
  /**
   * Metric frame for projected packages; defaults to the bounds' center latitude. Pass the
   * viewer's latitude for a worldwide package (see `TerrainPackageFrame`).
   */
  frame?: TerrainPackageFrame;
}

export interface OpenTerrainPackagePyramid {
  package: TerrainPackageDescriptor;
  descriptor: TerrainPyramidDescriptor;
  archive: TerrainTileArchive;
  source: TerrainPyramidHeightSource;
}

export interface TerrainPackagePyramidStreamOptions
  extends TerrainPyramidStreamOptions,
    OpenTerrainPackagePyramidOptions {}

export interface TerrainPackagePyramidStream extends OpenTerrainPackagePyramid {
  stream: TerrainPyramidStream;
}

export interface TerrainParentFallbackEvent {
  requestedLevel: number;
  resolvedLevel: number;
  requestedAddress: TerrainTileAddress;
  resolvedAddress: TerrainTileAddress;
}

export interface TerrainPackageHeightSourceOptions {
  /** Defaults on for geospatial packages; false preserves raw DEM samples. */
  filterElevation?: boolean;
  minLevel?: number;
  maxAvailableLevel?: number;
  parentFallback?: boolean;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
}

export interface TerrainPackagePyramidHeightSourceOptions {
  /** Defaults on for geospatial packages; false preserves raw DEM samples. */
  filterElevation?: boolean;
  onTiming?: (timing: ElevationStageTiming) => void;
  parentFallback?: boolean;
  /** LRU capacity for raw and corrected tiles, shared by exact and ancestor fallback requests. */
  maxDecodedArchiveTiles?: number;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
}

export interface TerrainPackageSemanticSource {
  load(
    address: TerrainPyramidTileAddress,
    signal: AbortSignal,
  ): Promise<TerrainSemanticTile | undefined>;
}

export interface TerrainPackageSemanticSourceOptions {
  minLevel?: number;
  maxLevel?: number;
}

export interface TerrainPackageCombinedSemanticSourceOptions {
  minLevel?: number;
  maxLevel?: number;
}

export interface OpenTerrainPackageSemanticsOptions {
  baseUrl?: string | URL;
  decoder: TerrainSemanticTileDecoder;
  landcoverArchive?: TerrainTileArchive;
  featuresArchive?: TerrainTileArchive;
  /** Host-provided archive for `features.buildingDetail` (instead of opening its source). */
  buildingDetailArchive?: TerrainTileArchive;
  /** How sidecar archives the host did not provide are opened (a cache, a native reader). */
  transport?: TerrainArchiveTransport;
  /** The building-detail sidecar's transport, when it differs (a lower cache priority). */
  buildingDetailTransport?: TerrainArchiveTransport;
}

export interface OpenTerrainPackageSemanticSidecar {
  archive: TerrainTileArchive;
  minLevel: number;
  maxLevel: number;
  source: TerrainPackageSemanticSource;
}

/** The building-detail sidecar: one finer level, read only for buildings and places. */
export interface OpenTerrainPackageBuildingDetail {
  archive: TerrainTileArchive;
  level: number;
  /** Loads tiles at `level` (other levels resolve to undefined). */
  source: TerrainPackageSemanticSource;
}

export interface OpenTerrainPackageSemantics {
  package: TerrainPackageDescriptor;
  landcover?: OpenTerrainPackageSemanticSidecar;
  features?: OpenTerrainPackageSemanticSidecar;
  buildingDetail?: OpenTerrainPackageBuildingDetail;
  /**
   * Why the declared building-detail sidecar could not be opened. It only refines buildings, so
   * the feature tiles carry on with their own footprints; hosts may report this.
   */
  buildingDetailError?: Error;
}

function checkPackageLevel(pkg: TerrainPackageDescriptor, level: number): void {
  if (
    !Number.isSafeInteger(level) ||
    level < pkg.tileMatrix.minLevel ||
    level > pkg.tileMatrix.maxLevel
  ) {
    throw new Error(
      `terrain package level must be an integer from ${pkg.tileMatrix.minLevel} through ${pkg.tileMatrix.maxLevel}, got ${level}`,
    );
  }
  if (pkg.tileMatrix.rootTiles[0] !== 1 || pkg.tileMatrix.rootTiles[1] !== 1) {
    throw new Error('the fixed-level PMTiles adapter currently requires rootTiles [1,1]');
  }
}

function defaultPackageSurfaceLayers(pkg: TerrainPackageDescriptor): TerrainDescriptor['layers'] {
  const { min, max } = pkg.elevation.height;
  const range = max - min;
  const seaLevel = min < 0 && max > 0 ? 0 : min;
  const snowLine = Math.max(seaLevel + range * 0.72, seaLevel + 900);
  return [
    { name: 'dirt', color: '#6d624d', tiling: 12 },
    {
      name: 'sand',
      color: '#b4a77b',
      tiling: 18,
      auto: { heightMax: seaLevel + Math.max(12, range * 0.015), slopeMax: 0.12 },
    },
    {
      name: 'grass',
      color: '#527346',
      tiling: 24,
      auto: { heightMin: seaLevel + 2, heightMax: snowLine, slopeMax: 0.18 },
    },
    { name: 'rock', color: '#77766e', tiling: 10, auto: { slopeMin: 0.1 } },
    { name: 'snow', color: '#e9eef1', tiling: 8, auto: { heightMin: snowLine } },
  ];
}

/** Build the generic planar quadtree represented by a package's complete elevation pyramid. */
export function terrainPyramidDescriptorFromPackage(
  pkg: TerrainPackageDescriptor,
  levels: { minLevel?: number; maxLevel?: number; frame?: TerrainPackageFrame } = {},
): TerrainPyramidDescriptor {
  checkPackageLevel(pkg, levels.minLevel ?? pkg.tileMatrix.minLevel);
  checkPackageLevel(pkg, levels.maxLevel ?? pkg.tileMatrix.maxLevel);
  if (pkg.tileMatrix.rootTiles[0] !== 1 || pkg.tileMatrix.rootTiles[1] !== 1) {
    throw new Error('the terrain pyramid adapter currently requires rootTiles [1,1]');
  }
  const minLevel = levels.minLevel ?? pkg.tileMatrix.minLevel;
  const maxLevel = levels.maxLevel ?? pkg.tileMatrix.maxLevel;
  if (minLevel > maxLevel) {
    throw new Error('terrain pyramid available levels do not overlap the package levels');
  }
  let origin: [number, number];
  let rootSize: number;
  let coverage: [number, number, number, number] | undefined;
  let metersPerUnit: number | undefined;
  if (pkg.coordinateSpace.kind === 'local') {
    const [minX, minZ, maxX, maxZ] = pkg.coordinateSpace.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const tolerance = Math.max(width, depth) * 1e-9;
    if (Math.abs(width - depth) > tolerance) {
      throw new Error('local terrain package bounds must be square for rootTiles [1,1]');
    }
    origin = [minX, minZ];
    rootSize = width;
  } else {
    if (pkg.coordinateSpace.crs !== 'EPSG:3857') {
      throw new Error(
        `projected Earth streaming currently supports EPSG:3857, got ${pkg.coordinateSpace.crs}`,
      );
    }
    // Mercator meters are inflated by 1/cos(lat); scale the whole projected frame once, here,
    // so tiles, meshes, semantic densities, and entity XZ are all metric downstream.
    const [west, south, east, north] = pkg.coordinateSpace.bounds;
    const s = terrainPackageMetersPerUnit(pkg, levels.frame);
    metersPerUnit = s;
    origin = [-WEB_MERCATOR_HALF_WORLD_METERS * s, -WEB_MERCATOR_HALF_WORLD_METERS * s];
    rootSize = WEB_MERCATOR_HALF_WORLD_METERS * 2 * s;
    const [minX, maxZ] = wgs84ToWebMercator(west, south);
    const [maxX, minZ] = wgs84ToWebMercator(east, north);
    coverage = [minX * s, minZ * s, maxX * s, maxZ * s];
  }
  return {
    name: `${pkg.name}@${pkg.version}`,
    origin,
    rootSize,
    minLevel,
    maxLevel,
    tileResolution: pkg.tileMatrix.tileResolution,
    height: { ...pkg.elevation.height },
    layers: pkg.surface?.layers ?? defaultPackageSurfaceLayers(pkg),
    skirts: true,
    ...(coverage !== undefined ? { coverage } : {}),
    ...(metersPerUnit !== undefined ? { metersPerUnit } : {}),
  };
}

/** Build the generic fixed-grid descriptor represented by one package pyramid level. */
export function terrainDescriptorFromPackage(
  pkg: TerrainPackageDescriptor,
  level: number,
  frame?: TerrainPackageFrame,
): TerrainDescriptor {
  checkPackageLevel(pkg, level);
  const count = 2 ** level;
  let origin: [number, number];
  let chunkSize: number;
  let metersPerUnit: number | undefined;
  if (pkg.coordinateSpace.kind === 'local') {
    const [minX, minZ, maxX, maxZ] = pkg.coordinateSpace.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const tolerance = Math.max(width, depth) * 1e-9;
    if (Math.abs(width - depth) > tolerance) {
      throw new Error('local terrain package bounds must be square for rootTiles [1,1]');
    }
    origin = [minX, minZ];
    chunkSize = width / count;
  } else {
    if (pkg.coordinateSpace.crs !== 'EPSG:3857') {
      throw new Error(
        `projected Earth streaming currently supports EPSG:3857, got ${pkg.coordinateSpace.crs}`,
      );
    }
    const s = terrainPackageMetersPerUnit(pkg, frame);
    metersPerUnit = s;
    origin = [-WEB_MERCATOR_HALF_WORLD_METERS * s, -WEB_MERCATOR_HALF_WORLD_METERS * s];
    chunkSize = ((WEB_MERCATOR_HALF_WORLD_METERS * 2) / count) * s;
  }

  const maxLodLevels = Math.floor(Math.log2(pkg.tileMatrix.tileResolution - 1)) + 1;
  const lodLevels = Math.max(1, Math.min(6, maxLodLevels));
  return {
    format: 'molen/terrain@2',
    name: `${pkg.name}@${pkg.version}:z${level}`,
    origin,
    chunkSize,
    tileResolution: pkg.tileMatrix.tileResolution,
    gridSize: [count, count],
    height: { ...pkg.elevation.height },
    tiles: {
      heightUrl: `pmtiles:${terrainPackageArchiveSourceLocation(pkg.elevation.source)}#${level}/{x}/{z}`,
    },
    layers: pkg.surface?.layers ?? defaultPackageSurfaceLayers(pkg),
    ...(metersPerUnit !== undefined ? { metersPerUnit } : {}),
    lod: {
      levels: lodLevels,
      distanceBands: Array.from({ length: lodLevels }, (_, index) => chunkSize * 1.5 * 2 ** index),
      skirts: true,
    },
    streaming: {
      loadRadius: 3,
      unloadRadius: 4,
      maxConcurrentLoads: 4,
      maxResidentTiles: 96,
    },
    collision: { enabled: false },
  };
}

function packageResourceUrl(path: string, baseUrl?: string | URL): string {
  if (baseUrl !== undefined) return new URL(path, baseUrl).href;
  if (typeof document !== 'undefined') return new URL(path, document.baseURI).href;
  return path;
}

/** Return the authored package-relative path or absolute streaming URL for diagnostics. */
export function terrainPackageArchiveSourceLocation(source: TerrainPackageArchiveSource): string {
  return 'url' in source ? source.url : source.path;
}

/** Resolve a local package archive against its manifest, leaving remote archives untouched. */
export function resolveTerrainPackageArchiveUrl(
  source: TerrainPackageArchiveSource,
  baseUrl?: string | URL,
): string {
  return 'url' in source ? source.url : packageResourceUrl(source.path, baseUrl);
}

function sameTerrainPackageArchiveSource(
  left: TerrainPackageArchiveSource,
  right: TerrainPackageArchiveSource,
): boolean {
  return (
    left.kind === right.kind &&
    terrainPackageArchiveSourceLocation(left) === terrainPackageArchiveSourceLocation(right)
  );
}

export interface OpenTerrainPackageArchiveOptions extends TerrainArchiveTransport {
  /** Name passed to `openArchive` for a single archive (default: its URL). */
  id?: string;
  /** What the package knows about a single archive (see `terrainPackageArchiveEntry`). */
  entry?: TerrainArchiveEntryInfo;
}

/**
 * Open a declared package source: one PMTiles archive, or a lazily routed archive set
 * (`molen/archive-set@1`) for `pmtiles-set`. Without a transport, archives use the official
 * PMTiles HTTP reader; `openArchive` replaces it for every archive (a cache, a native reader).
 */
export function openTerrainPackageArchive(
  source: TerrainPackageArchiveSource,
  baseUrl?: string | URL,
  options: OpenTerrainPackageArchiveOptions = {},
): TerrainTileArchive {
  const url = resolveTerrainPackageArchiveUrl(source, baseUrl);
  if (source.kind === 'pmtiles-set') {
    return createTerrainArchiveSetArchive(url, {
      ...(options.openArchive !== undefined ? { openArchive: options.openArchive } : {}),
      ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    });
  }
  return options.openArchive !== undefined
    ? options.openArchive(url, options.id ?? url, options.entry)
    : new PMTiles(url);
}

/** The `files` record of a package-relative single archive: its hash and size, when listed. */
export function terrainPackageArchiveEntry(
  pkg: TerrainPackageDescriptor,
  source: TerrainPackageArchiveSource,
): TerrainArchiveEntryInfo | undefined {
  if (source.kind !== 'pmtiles' || !('path' in source)) return undefined;
  const file = pkg.files?.find((record) => record.path === source.path);
  return file === undefined ? undefined : { sha256: file.sha256, bytes: file.bytes };
}

/** Open one section's declared archive through `transport`, naming it for the opener. */
function openSectionArchive(
  pkg: TerrainPackageDescriptor,
  source: TerrainPackageArchiveSource,
  id: string,
  baseUrl: string | URL | undefined,
  transport: TerrainArchiveTransport | undefined,
): TerrainTileArchive {
  const entry = terrainPackageArchiveEntry(pkg, source);
  return openTerrainPackageArchive(source, baseUrl, {
    ...transport,
    id,
    ...(entry !== undefined ? { entry } : {}),
  });
}

/** Adapt one declared semantic sidecar into normalized, format-neutral tile geometry. */
/**
 * Decoded semantic tiles by address: the last `size` loads, and older ones while anything else
 * still holds them. Classification, surfaces, water, tunnels and building detail each load their
 * own tiles, and with in-flight requests alone shared, a tile in view decoded a dozen times in
 * ten seconds of panning: each copy garbage the main thread then had to collect. Held weakly
 * past the last few, a tile no layer keeps is still released as before.
 */
class DecodedSemanticTiles {
  private readonly recent = new Map<string, DecodedSemanticEntry>();
  private readonly older = new Map<string, WeakRef<TerrainSemanticTile>>();
  constructor(private readonly size: number) {}

  load(
    key: string,
    decode: () => Promise<TerrainSemanticTile | undefined>,
  ): Promise<TerrainSemanticTile | undefined> {
    const known = this.recent.get(key);
    if (known !== undefined) {
      this.recent.delete(key);
      this.recent.set(key, known);
      return known.request;
    }
    const held = this.older.get(key)?.deref();
    this.older.delete(key);
    const entry: DecodedSemanticEntry =
      held !== undefined ? { request: Promise.resolve(held), tile: held } : { request: decode() };
    this.recent.set(key, entry);
    entry.request.then(
      (tile) => {
        if (tile !== undefined) entry.tile = tile;
      },
      // A failed load is tried again by the next request.
      () => {
        if (this.recent.get(key) === entry) this.recent.delete(key);
      },
    );
    while (this.recent.size > this.size) {
      const [oldest, evicted] = this.recent.entries().next().value as [
        string,
        DecodedSemanticEntry,
      ];
      this.recent.delete(oldest);
      if (evicted.tile !== undefined) this.older.set(oldest, new WeakRef(evicted.tile));
    }
    if (this.older.size > this.size * 8)
      for (const [address, ref] of this.older)
        if (ref.deref() === undefined) this.older.delete(address);
    return entry.request;
  }
}

interface DecodedSemanticEntry {
  request: Promise<TerrainSemanticTile | undefined>;
  tile?: TerrainSemanticTile;
}

/** Decoded tiles a package semantic source keeps strongly (see DecodedSemanticTiles). */
const RECENT_SEMANTIC_TILES = 16;

export function createTerrainPackageSemanticSource(
  pkg: TerrainPackageDescriptor,
  content: TerrainPackageSemanticContent,
  archive: TerrainTileArchive,
  decoder: TerrainSemanticTileDecoder,
  options: TerrainPackageSemanticSourceOptions = {},
): TerrainPackageSemanticSource {
  const landcover = content === 'landcover' ? pkg.landcover : undefined;
  const features = content === 'features' ? pkg.features : undefined;
  if (landcover === undefined && features === undefined) {
    throw new Error(`terrain package has no ${content} sidecar`);
  }
  const minLevel = options.minLevel ?? pkg.tileMatrix.minLevel;
  const maxLevel = options.maxLevel ?? pkg.tileMatrix.maxLevel;
  if (
    !Number.isSafeInteger(minLevel) ||
    !Number.isSafeInteger(maxLevel) ||
    minLevel < pkg.tileMatrix.minLevel ||
    maxLevel > pkg.tileMatrix.maxLevel ||
    minLevel > maxLevel
  ) {
    throw new Error(
      `semantic sidecar levels must fit package levels ${pkg.tileMatrix.minLevel}-${pkg.tileMatrix.maxLevel}`,
    );
  }
  const layers = landcover !== undefined ? [landcover.layer] : (features?.layers ?? []);
  const encoding = landcover?.encoding ?? 'mvt';
  const decoded = new DecodedSemanticTiles(RECENT_SEMANTIC_TILES);
  return {
    async load(
      address: TerrainPyramidTileAddress,
      signal: AbortSignal,
    ): Promise<TerrainSemanticTile | undefined> {
      if (address.level < minLevel || address.level > maxLevel || signal.aborted) return undefined;
      // A decode serves every layer asking for its tile, so no single caller's signal cancels it.
      const tile = await decoded.load(`${address.level}/${address.x}/${address.z}`, async () => {
        const count = 2 ** address.level;
        const archiveY = pkg.tileMatrix.scheme === 'tms' ? count - 1 - address.z : address.z;
        const archiveTile = await archive.getZxy(address.level, address.x, archiveY);
        if (archiveTile === undefined) return undefined;
        const result = await decoder.decode(new Uint8Array(archiveTile.data), {
          address: { ...address },
          content,
          encoding,
          layers,
        });
        assertTerrainSemanticTile(result);
        return result;
      });
      return signal.aborted ? undefined : tile;
    },
  };
}

/**
 * Decode a shared MVT sidecar once when landcover and feature layers use the same archive. Past
 * the last few decoded tiles, only tiles something else still holds are reused (see
 * DecodedSemanticTiles), so renderer-owned resident objects remain the memory authority.
 */
export function createTerrainPackageCombinedSemanticSource(
  pkg: TerrainPackageDescriptor,
  archive: TerrainTileArchive,
  decoder: TerrainSemanticTileDecoder,
  options: TerrainPackageCombinedSemanticSourceOptions = {},
): TerrainPackageSemanticSource {
  const landcover = pkg.landcover;
  const features = pkg.features;
  if (landcover === undefined || features === undefined) {
    throw new Error('combined semantic source requires landcover and feature sidecars');
  }
  if (
    landcover.encoding !== 'mvt' ||
    features.encoding !== 'mvt' ||
    !sameTerrainPackageArchiveSource(landcover.source, features.source)
  ) {
    throw new Error('combined semantic source requires one shared MVT archive');
  }
  const minLevel = options.minLevel ?? pkg.tileMatrix.minLevel;
  const maxLevel = options.maxLevel ?? pkg.tileMatrix.maxLevel;
  if (
    !Number.isSafeInteger(minLevel) ||
    !Number.isSafeInteger(maxLevel) ||
    minLevel < pkg.tileMatrix.minLevel ||
    maxLevel > pkg.tileMatrix.maxLevel ||
    minLevel > maxLevel
  ) {
    throw new Error(
      `combined semantic levels must fit package levels ${pkg.tileMatrix.minLevel}-${pkg.tileMatrix.maxLevel}`,
    );
  }
  const decoded = new DecodedSemanticTiles(RECENT_SEMANTIC_TILES);
  return {
    async load(
      address: TerrainPyramidTileAddress,
      signal: AbortSignal,
    ): Promise<TerrainSemanticTile | undefined> {
      if (address.level < minLevel || address.level > maxLevel || signal.aborted) return undefined;
      const tile = await decoded.load(`${address.level}/${address.x}/${address.z}`, async () => {
        const count = 2 ** address.level;
        const archiveY = pkg.tileMatrix.scheme === 'tms' ? count - 1 - address.z : address.z;
        const archiveTile = await archive.getZxy(address.level, address.x, archiveY);
        if (archiveTile === undefined) return undefined;
        const result = await decoder.decode(new Uint8Array(archiveTile.data), {
          address: { ...address },
          content: 'all',
          encoding: 'mvt',
          layers: [landcover.layer, ...features.layers],
        });
        assertTerrainSemanticTile(result);
        return result;
      });
      return signal.aborted ? undefined : tile;
    },
  };
}

async function semanticSidecarLevels(
  pkg: TerrainPackageDescriptor,
  content: TerrainPackageSemanticContent,
  archive: TerrainTileArchive,
): Promise<{ minLevel: number; maxLevel: number }> {
  const section = content === 'landcover' ? pkg.landcover : pkg.features;
  if (section === undefined) throw new Error(`terrain package has no ${content} sidecar`);
  let minLevel = pkg.tileMatrix.minLevel;
  let maxLevel = pkg.tileMatrix.maxLevel;
  if (archive.getHeader !== undefined) {
    const header = await archive.getHeader();
    minLevel = Math.max(minLevel, header.minZoom);
    maxLevel = Math.min(maxLevel, header.maxZoom);
    if (minLevel > maxLevel) {
      throw new Error(
        `${content} archive levels ${header.minZoom}-${header.maxZoom} do not overlap package levels ${pkg.tileMatrix.minLevel}-${pkg.tileMatrix.maxLevel}`,
      );
    }
    const expectedType = section.encoding === 'mvt' ? TileType.Mvt : TileType.Png;
    if (header.tileType !== undefined && header.tileType !== expectedType) {
      throw new Error(
        `${content} archive tile type must match ${section.encoding} (${expectedType}), got ${header.tileType}`,
      );
    }
  }
  return { minLevel, maxLevel };
}

/** Open every declared semantic PMTiles sidecar and expose normalized tile sources. */
export async function openTerrainPackageSemantics(
  pkg: TerrainPackageDescriptor,
  options: OpenTerrainPackageSemanticsOptions,
): Promise<OpenTerrainPackageSemantics> {
  let landcoverArchive = options.landcoverArchive;
  let featuresArchive = options.featuresArchive;
  if (pkg.landcover !== undefined && landcoverArchive === undefined) {
    landcoverArchive = openSectionArchive(
      pkg,
      pkg.landcover.source,
      'landcover',
      options.baseUrl,
      options.transport,
    );
  }
  if (pkg.features !== undefined && featuresArchive === undefined) {
    if (
      pkg.landcover !== undefined &&
      sameTerrainPackageArchiveSource(pkg.features.source, pkg.landcover.source) &&
      landcoverArchive !== undefined
    ) {
      featuresArchive = landcoverArchive;
    } else {
      featuresArchive = openSectionArchive(
        pkg,
        pkg.features.source,
        'features',
        options.baseUrl,
        options.transport,
      );
    }
  }
  let landcover: OpenTerrainPackageSemanticSidecar | undefined;
  if (pkg.landcover !== undefined && landcoverArchive !== undefined) {
    const levels = await semanticSidecarLevels(pkg, 'landcover', landcoverArchive);
    landcover = {
      archive: landcoverArchive,
      ...levels,
      source: createTerrainPackageSemanticSource(
        pkg,
        'landcover',
        landcoverArchive,
        options.decoder,
        levels,
      ),
    };
  }
  let features: OpenTerrainPackageSemanticSidecar | undefined;
  if (pkg.features !== undefined && featuresArchive !== undefined) {
    const levels = await semanticSidecarLevels(pkg, 'features', featuresArchive);
    features = {
      archive: featuresArchive,
      ...levels,
      source: createTerrainPackageSemanticSource(
        pkg,
        'features',
        featuresArchive,
        options.decoder,
        levels,
      ),
    };
  }
  let buildingDetail: OpenTerrainPackageBuildingDetail | undefined;
  let buildingDetailError: Error | undefined;
  const detail = pkg.features?.buildingDetail;
  if (detail !== undefined && features !== undefined) {
    try {
      const archive =
        options.buildingDetailArchive ??
        openSectionArchive(
          pkg,
          detail.source,
          'building-detail',
          options.baseUrl,
          options.buildingDetailTransport ?? options.transport,
        );
      if (archive.getHeader !== undefined) {
        const header = await archive.getHeader();
        if (detail.level < header.minZoom || detail.level > header.maxZoom) {
          throw new Error(
            `building detail archive levels ${header.minZoom}-${header.maxZoom} do not include level ${detail.level}`,
          );
        }
        if (header.tileType !== undefined && header.tileType !== TileType.Mvt) {
          throw new Error(`building detail archive tile type must be mvt, got ${header.tileType}`);
        }
      }
      buildingDetail = {
        archive,
        level: detail.level,
        source: createTerrainPackageBuildingDetailSource(
          pkg,
          archive,
          options.decoder,
          detail.level,
        ),
      };
    } catch (error) {
      buildingDetailError = error instanceof Error ? error : new Error(String(error));
    }
  }
  return {
    package: pkg,
    ...(landcover !== undefined ? { landcover } : {}),
    ...(features !== undefined ? { features } : {}),
    ...(buildingDetail !== undefined ? { buildingDetail } : {}),
    ...(buildingDetailError !== undefined ? { buildingDetailError } : {}),
  };
}

/** Decode only buildings and places from a building-detail archive, at its one level. */
function createTerrainPackageBuildingDetailSource(
  pkg: TerrainPackageDescriptor,
  archive: TerrainTileArchive,
  decoder: TerrainSemanticTileDecoder,
  level: number,
): TerrainPackageSemanticSource {
  const layers = (pkg.features?.layers ?? []).filter(
    (layer) => layer === 'building' || layer === 'poi',
  );
  return {
    async load(
      address: TerrainPyramidTileAddress,
      signal: AbortSignal,
    ): Promise<TerrainSemanticTile | undefined> {
      if (address.level !== level || signal.aborted || layers.length === 0) return undefined;
      const archiveY = pkg.tileMatrix.scheme === 'tms' ? 2 ** level - 1 - address.z : address.z;
      const archiveTile = await archive.getZxy(level, address.x, archiveY, signal);
      if (archiveTile === undefined || signal.aborted) return undefined;
      const decoded = await decoder.decode(new Uint8Array(archiveTile.data), {
        address: { ...address },
        content: 'features',
        encoding: 'mvt',
        layers,
      });
      if (signal.aborted) return undefined;
      assertTerrainSemanticTile(decoded);
      return decoded;
    },
  };
}

/** Adapt a selected package archive level into the generic decoded-height source contract. */
export function createTerrainPackageHeightSource(
  pkg: TerrainPackageDescriptor,
  descriptor: TerrainDescriptor,
  archive: TerrainTileArchive,
  level: number,
  options: TerrainPackageHeightSourceOptions = {},
): TerrainHeightTileSource {
  checkPackageLevel(pkg, level);
  const minLevel = options.minLevel ?? pkg.tileMatrix.minLevel;
  const maxAvailableLevel = options.maxAvailableLevel ?? level;
  if (!Number.isSafeInteger(minLevel) || minLevel < pkg.tileMatrix.minLevel || minLevel > level) {
    throw new Error(
      `terrain package fallback minLevel must be between ${pkg.tileMatrix.minLevel} and ${level}`,
    );
  }
  if (
    !Number.isSafeInteger(maxAvailableLevel) ||
    maxAvailableLevel < minLevel ||
    maxAvailableLevel > level
  ) {
    throw new Error(`terrain package available max level must be between ${minLevel} and ${level}`);
  }
  const fallback = options.parentFallback ?? true;
  const loadDecoded = createElevationTileDecoder({
    archive,
    scheme: pkg.tileMatrix.scheme,
    heightRange: descriptor.height.max - descriptor.height.min,
    tileSize: (resolvedLevel) => descriptor.chunkSize * 2 ** (level - resolvedLevel),
    filter: options.filterElevation ?? pkg.coordinateSpace?.kind === 'geospatial',
    maxTiles: 64,
  });
  return {
    async load(address: TerrainTileAddress, signal: AbortSignal) {
      const firstLevel = fallback ? maxAvailableLevel : level;
      for (let resolvedLevel = firstLevel; resolvedLevel >= minLevel; resolvedLevel--) {
        if (signal.aborted) return undefined;
        const subdivision = 2 ** (level - resolvedLevel);
        const resolvedAddress = {
          x: Math.floor(address.x / subdivision),
          z: Math.floor(address.z / subdivision),
        };
        const grid = await loadDecoded(resolvedLevel, resolvedAddress.x, resolvedAddress.z);
        if (grid === undefined) {
          if (!fallback) return undefined;
          continue;
        }
        if (signal.aborted) return undefined;
        if (resolvedLevel === level) {
          return new Heightfield(grid.data, grid.width, grid.height, {
            origin: [
              descriptor.origin[0] + address.x * descriptor.chunkSize,
              descriptor.origin[1] + address.z * descriptor.chunkSize,
            ],
            worldSize: [descriptor.chunkSize, descriptor.chunkSize],
            height: descriptor.height,
          });
        }
        options.onParentFallback?.({
          requestedLevel: level,
          resolvedLevel,
          requestedAddress: { ...address },
          resolvedAddress,
        });
        return heightfieldSubtileFromGray16(descriptor, address, grid, subdivision, {
          x: address.x - resolvedAddress.x * subdivision,
          z: address.z - resolvedAddress.z * subdivision,
        });
      }
      return undefined;
    },
  };
}

function fixedDescriptorFromPyramid(
  descriptor: TerrainPyramidDescriptor,
  level: number,
): TerrainDescriptor {
  const count = 2 ** level;
  return {
    format: 'molen/terrain@2',
    name: `${descriptor.name}:${level}`,
    origin: descriptor.origin,
    chunkSize: descriptor.rootSize / count,
    tileResolution: descriptor.tileResolution,
    gridSize: [count, count],
    height: descriptor.height,
    tiles: { heightUrl: 'terrain-package-pyramid' },
    layers: descriptor.layers,
    ...(descriptor.metersPerUnit !== undefined ? { metersPerUnit: descriptor.metersPerUnit } : {}),
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

/** Adapt sparse archive levels into the generic terrain-pyramid source contract. */
export function createTerrainPackagePyramidHeightSource(
  pkg: TerrainPackageDescriptor,
  descriptor: TerrainPyramidDescriptor,
  archive: TerrainTileArchive,
  options: TerrainPackagePyramidHeightSourceOptions = {},
): TerrainPyramidHeightSource {
  const fallback = options.parentFallback ?? true;
  const maxDecodedArchiveTiles = options.maxDecodedArchiveTiles ?? 64;
  if (!Number.isSafeInteger(maxDecodedArchiveTiles) || maxDecodedArchiveTiles < 1) {
    throw new Error('terrain package decoded archive cache size must be a positive safe integer');
  }
  const loadDecoded = createElevationTileDecoder({
    archive,
    scheme: pkg.tileMatrix.scheme,
    heightRange: descriptor.height.max - descriptor.height.min,
    tileSize: (level) => terrainPyramidTileSize(descriptor, level),
    filter: options.filterElevation ?? pkg.coordinateSpace?.kind === 'geospatial',
    maxTiles: maxDecodedArchiveTiles,
    onDecode: (milliseconds) => options.onTiming?.({ stage: 'decode', milliseconds }),
  });
  return {
    async load(address: TerrainPyramidTileAddress, signal: AbortSignal) {
      if (address.level < descriptor.minLevel || address.level > descriptor.maxLevel) {
        throw new Error(
          `terrain pyramid source level must be from ${descriptor.minLevel} through ${descriptor.maxLevel}, got ${address.level}`,
        );
      }
      for (
        let resolvedLevel = address.level;
        resolvedLevel >= descriptor.minLevel;
        resolvedLevel--
      ) {
        if (signal.aborted) return undefined;
        const subdivision = 2 ** (address.level - resolvedLevel);
        const resolvedAddress = {
          x: Math.floor(address.x / subdivision),
          z: Math.floor(address.z / subdivision),
        };
        const grid = await loadDecoded(resolvedLevel, resolvedAddress.x, resolvedAddress.z);
        if (grid === undefined) {
          if (!fallback) return undefined;
          continue;
        }
        if (signal.aborted) return undefined;
        if (resolvedLevel === address.level) {
          const origin = terrainPyramidTileOrigin(descriptor, address);
          const size = terrainPyramidTileSize(descriptor, address.level);
          return new Heightfield(grid.data, grid.width, grid.height, {
            origin,
            worldSize: [size, size],
            height: descriptor.height,
          });
        }
        options.onParentFallback?.({
          requestedLevel: address.level,
          resolvedLevel,
          requestedAddress: { x: address.x, z: address.z },
          resolvedAddress,
        });
        const resampleStart = performance.now();
        const heightfield = heightfieldSubtileFromGray16(
          fixedDescriptorFromPyramid(descriptor, address.level),
          { x: address.x, z: address.z },
          grid,
          subdivision,
          {
            x: address.x - resolvedAddress.x * subdivision,
            z: address.z - resolvedAddress.z * subdivision,
          },
        );
        options.onTiming?.({ stage: 'resample', milliseconds: performance.now() - resampleStart });
        return heightfield;
      }
      return undefined;
    },
  };
}

/** Open and verify the package elevation archive at one fixed detail level. */
export async function openTerrainPackageElevation(
  pkg: TerrainPackageDescriptor,
  options: OpenTerrainPackageOptions,
): Promise<OpenTerrainPackageElevation> {
  checkPackageLevel(pkg, options.level);
  const descriptor = terrainDescriptorFromPackage(pkg, options.level, options.frame);
  const archive =
    options.archive ??
    openSectionArchive(pkg, pkg.elevation.source, 'elevation', options.baseUrl, options.transport);
  const parentFallback = options.parentFallback ?? true;
  let minAvailableLevel = pkg.tileMatrix.minLevel;
  let maxAvailableLevel = options.level;
  if (archive.getHeader !== undefined) {
    const header = await archive.getHeader();
    if (
      (!parentFallback && (options.level < header.minZoom || options.level > header.maxZoom)) ||
      (parentFallback &&
        (options.level < header.minZoom || header.maxZoom < pkg.tileMatrix.minLevel))
    ) {
      throw new Error(
        `elevation archive contains levels ${header.minZoom}-${header.maxZoom}, not requested level ${options.level}`,
      );
    }
    if (header.tileType !== undefined && header.tileType !== TileType.Png) {
      throw new Error(
        `elevation archive tile type must be PNG (${TileType.Png}), got ${header.tileType}`,
      );
    }
    minAvailableLevel = Math.max(pkg.tileMatrix.minLevel, header.minZoom);
    maxAvailableLevel = Math.min(options.level, header.maxZoom);
  }
  const source = createTerrainPackageHeightSource(pkg, descriptor, archive, options.level, {
    ...(options.filterElevation !== undefined ? { filterElevation: options.filterElevation } : {}),
    minLevel: minAvailableLevel,
    maxAvailableLevel,
    parentFallback,
    ...(options.onParentFallback !== undefined
      ? { onParentFallback: options.onParentFallback }
      : {}),
  });
  return { package: pkg, level: options.level, descriptor, archive, source };
}

/** Open and verify the package's complete available elevation pyramid. */
export async function openTerrainPackagePyramid(
  pkg: TerrainPackageDescriptor,
  options: OpenTerrainPackagePyramidOptions = {},
): Promise<OpenTerrainPackagePyramid> {
  const archive =
    options.archive ??
    openSectionArchive(pkg, pkg.elevation.source, 'elevation', options.baseUrl, options.transport);
  let minLevel = pkg.tileMatrix.minLevel;
  let maxLevel = pkg.tileMatrix.maxLevel;
  if (archive.getHeader !== undefined) {
    const header = await archive.getHeader();
    minLevel = Math.max(minLevel, header.minZoom);
    if (options.parentFallback === false) maxLevel = Math.min(maxLevel, header.maxZoom);
    // Semantic detail can exceed DEM detail: crop/resample the closest elevation ancestor.
    if (minLevel > maxLevel || header.maxZoom < minLevel) {
      throw new Error(
        `elevation archive levels ${header.minZoom}-${header.maxZoom} do not overlap package levels ${pkg.tileMatrix.minLevel}-${pkg.tileMatrix.maxLevel}`,
      );
    }
    if (header.tileType !== undefined && header.tileType !== TileType.Png) {
      throw new Error(
        `elevation archive tile type must be PNG (${TileType.Png}), got ${header.tileType}`,
      );
    }
  }
  const descriptor = terrainPyramidDescriptorFromPackage(pkg, {
    minLevel,
    maxLevel,
    ...(options.frame !== undefined ? { frame: options.frame } : {}),
  });
  const source = options.elevationWorker
    ? createTerrainElevationWorkerSource(options.elevationWorker, pkg, descriptor, archive, {
        ...(options.filterElevation !== undefined
          ? { filterElevation: options.filterElevation }
          : {}),
        ...(options.onElevationTiming ? { onTiming: options.onElevationTiming } : {}),
        ...(options.onParentFallback ? { onParentFallback: options.onParentFallback } : {}),
        ...(options.parentFallback !== undefined ? { parentFallback: options.parentFallback } : {}),
      })
    : createTerrainPackagePyramidHeightSource(pkg, descriptor, archive, {
        ...(options.filterElevation !== undefined
          ? { filterElevation: options.filterElevation }
          : {}),
        ...(options.onElevationTiming ? { onTiming: options.onElevationTiming } : {}),
        ...(options.parentFallback !== undefined ? { parentFallback: options.parentFallback } : {}),
        ...(options.onParentFallback !== undefined
          ? { onParentFallback: options.onParentFallback }
          : {}),
      });
  return { package: pkg, descriptor, archive, source };
}

/** Open a terrain package and immediately create its bounded fixed-level stream. */
export async function createTerrainPackageStream(
  pkg: TerrainPackageDescriptor,
  options: TerrainPackageStreamOptions,
): Promise<TerrainPackageStream> {
  const {
    level,
    filterElevation,
    baseUrl,
    archive,
    transport,
    parentFallback,
    onParentFallback,
    frame,
    ...streamOptions
  } = options;
  const opened = await openTerrainPackageElevation(pkg, {
    level,
    ...(filterElevation !== undefined ? { filterElevation } : {}),
    ...(frame !== undefined ? { frame } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...(archive !== undefined ? { archive } : {}),
    ...(transport !== undefined ? { transport } : {}),
    ...(parentFallback !== undefined ? { parentFallback } : {}),
    ...(onParentFallback !== undefined ? { onParentFallback } : {}),
  });
  return {
    ...opened,
    stream: createTerrainStream(opened.descriptor, opened.source, streamOptions),
  };
}

/** Open a terrain package and create its camera-driven, multi-level pyramid stream. */
export async function createTerrainPackagePyramidStream(
  pkg: TerrainPackageDescriptor,
  options: TerrainPackagePyramidStreamOptions,
): Promise<TerrainPackagePyramidStream> {
  const {
    baseUrl,
    filterElevation,
    archive,
    transport,
    parentFallback,
    onParentFallback,
    elevationWorker,
    onElevationTiming,
    frame,
    ...streamOptions
  } = options;
  const opened = await openTerrainPackagePyramid(pkg, {
    ...(filterElevation !== undefined ? { filterElevation } : {}),
    ...(frame !== undefined ? { frame } : {}),
    ...(elevationWorker ? { elevationWorker } : {}),
    ...(onElevationTiming ? { onElevationTiming } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...(archive !== undefined ? { archive } : {}),
    ...(transport !== undefined ? { transport } : {}),
    ...(parentFallback !== undefined ? { parentFallback } : {}),
    ...(onParentFallback !== undefined ? { onParentFallback } : {}),
  });
  return {
    ...opened,
    stream: createTerrainPyramidStream(opened.descriptor, opened.source, streamOptions),
  };
}

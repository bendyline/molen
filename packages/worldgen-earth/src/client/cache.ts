/**
 * LRU cache of generated tile output (CPU buffers only) keyed by pack, atlas, quality, and tile
 * address, so a tile that leaves and re-enters residency is uploaded again, not regenerated.
 */

import type { WorldgenTileOutput } from '../kernel/tile-generate';

export interface WorldgenTileCacheOptions {
  /** Entries kept (default 256). */
  maxEntries?: number;
  /** Bytes of mesh and instance data kept (default 256 MiB). */
  maxBytes?: number;
}

export interface WorldgenTileCache {
  get(key: string): WorldgenTileOutput | undefined;
  set(key: string, output: WorldgenTileOutput): void;
  delete(key: string): boolean;
  clear(): void;
  /** Trim immediately when the device working-set budget changes. */
  setLimits(options: WorldgenTileCacheOptions): void;
  readonly size: number;
  readonly bytes: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
}

export interface WorldgenTileCacheKeyParts {
  packHash: string;
  atlasHash?: string;
  quality: string;
  /** Effective generation settings, when they differ within one named quality preset. */
  variant?: string;
  level: number;
  x: number;
  z: number;
  features: { buildings: boolean; scatter: boolean };
}

export function worldgenTileCacheKey(parts: WorldgenTileCacheKeyParts): string {
  const features = `${parts.features.buildings ? 'b' : ''}${parts.features.scatter ? 's' : ''}`;
  return `${parts.packHash}:${parts.atlasHash ?? '-'}:${parts.quality}:${features}:${parts.level}/${parts.x}/${parts.z}${parts.variant === undefined ? '' : `:${parts.variant}`}`;
}

export function outputBytes(output: WorldgenTileOutput): number {
  // Account for structural descriptors retained with cached meshes (not generated interiors).
  const descriptors = output.records.reduce((bytes, record) => {
    const site = record.interior;
    return (
      bytes +
      (site
        ? 512 +
          (site.outline.length + site.holes.reduce((n, h) => n + h.length, 0)) * 32 +
          site.openings.length * 80 +
          (site.storeys?.length ?? 0) * 32
        : 0)
    );
  }, 0);
  const preparedBytes = (output.buildingCells ?? []).reduce(
    (sum, c) =>
      sum +
      c.positions.byteLength +
      c.normals.byteLength +
      c.colors.byteLength +
      c.uvs.byteLength +
      c.indices.byteLength +
      c.structuralIndices.byteLength,
    0,
  );
  return (output.buildings?.bytes ?? 0) + output.stats.instanceBytes + descriptors + preparedBytes;
}

function validateLimits(count: number, size: number): void {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(size) || size < 0) {
    throw new Error(
      'Cache limits need a positive integer entry count and nonnegative finite bytes',
    );
  }
}

export function createWorldgenTileCache(options: WorldgenTileCacheOptions = {}): WorldgenTileCache {
  let maxEntries = options.maxEntries ?? 256;
  let maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
  validateLimits(maxEntries, maxBytes);
  const entries = new Map<string, { output: WorldgenTileOutput; bytes: number }>();
  let bytes = 0;
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  function evictUntilFits(): void {
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries && bytes <= maxBytes) break;
      entries.delete(key);
      bytes -= entry.bytes;
      evictions++;
    }
  }

  return {
    get(key: string): WorldgenTileOutput | undefined {
      const entry = entries.get(key);
      if (entry === undefined) {
        misses++;
        return undefined;
      }
      // Refresh recency.
      entries.delete(key);
      entries.set(key, entry);
      hits++;
      return entry.output;
    },
    set(key: string, output: WorldgenTileOutput): void {
      const existing = entries.get(key);
      if (existing !== undefined) {
        entries.delete(key);
        bytes -= existing.bytes;
      }
      const size = outputBytes(output);
      if (size > maxBytes) return;
      entries.set(key, { output, bytes: size });
      bytes += size;
      evictUntilFits();
    },
    delete(key: string): boolean {
      const entry = entries.get(key);
      if (entry === undefined) return false;
      entries.delete(key);
      bytes -= entry.bytes;
      return true;
    },
    setLimits(limits): void {
      const count = limits.maxEntries ?? maxEntries;
      const size = limits.maxBytes ?? maxBytes;
      validateLimits(count, size);
      maxEntries = count;
      maxBytes = size;
      evictUntilFits();
    },
    clear(): void {
      entries.clear();
      bytes = 0;
    },
    get size() {
      return entries.size;
    },
    get bytes() {
      return bytes;
    },
    get hits() {
      return hits;
    },
    get misses() {
      return misses;
    },
    get evictions() {
      return evictions;
    },
  };
}

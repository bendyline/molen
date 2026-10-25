import { getSchema } from '@bendyline/molen-schema';
import {
  parseStructureDirectory,
  type StructureDirectory,
  structureRegionBounds,
} from '../kernel/structure-directory';
import {
  createStructureIndex,
  type StructureCatalogDoc,
  type StructureIndex,
  type StructureLoadOptions,
  type StructurePlacement,
  type StructureQueryOptions,
} from '../kernel/structure-index';
import { registerStructurePlacementsSchema } from '../kernel/structure-index-schema';

type Bounds = readonly [number, number, number, number];

export interface StructureStreamOptions {
  /** Retained serialized bytes; parsed JS object overhead is additional. Default 4 MiB. */
  maxCacheBytes?: number;
  maxShards?: number;
  concurrency?: number;
}

export interface StructureStream extends StructureIndex {
  queryAsync(bounds: Bounds, options?: StructureLoadOptions): Promise<StructurePlacement[]>;
  isLoaded(bounds: Bounds): boolean;
  /** Abort reads owned by this stream and release its parsed catalog cache. */
  dispose(): void;
  stats(): { cachedBytes: number; cachedShards: number; pending: number };
}

function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const aborted = (): void => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

/** Async, bounded regional loading; synchronous queries report resident records only. */
export function createStructureStream(
  input: StructureDirectory,
  read: (path: string, signal: AbortSignal) => Promise<unknown>,
  base: StructureIndex = createStructureIndex({
    format: 'molen/structure-placement-data@1',
    title: 'Empty',
    entries: [],
  }),
  options: StructureStreamOptions = {},
): StructureStream {
  const directory = parseStructureDirectory(input);
  registerStructurePlacementsSchema();
  const maxBytes = options.maxCacheBytes ?? 4 * 1024 * 1024;
  const maxShards = options.maxShards ?? 32;
  const concurrency = options.concurrency ?? 4;
  if (![maxBytes, maxShards, concurrency].every((n) => Number.isSafeInteger(n) && n > 0))
    throw new Error('Structure stream budgets must be positive integers');
  const controller = new AbortController();
  const cache = new Map<string, StructureIndex>();
  const pending = new Map<string, Promise<StructureIndex>>();
  const queue: Array<() => void> = [];
  let active = 0,
    cachedBytes = 0;
  const regions = Object.entries(directory.cells).map(([cell, shards]) => ({
    bounds: structureRegionBounds(cell),
    shards,
  }));
  function needed(bounds: Bounds, level?: number): string[] {
    if (bounds.some((n) => !Number.isFinite(n)) || bounds[1] > bounds[3])
      throw new Error('Invalid structure query bounds');
    // Match the flat index: tile and proximity rectangles may extend beyond the world edges.
    const spans: Bounds[] =
      bounds[0] <= bounds[2]
        ? [bounds]
        : [
            [bounds[0], bounds[1], 180, bounds[3]],
            [-180, bounds[1], bounds[2], bounds[3]],
          ];
    return [
      ...new Set(
        regions.flatMap((region) =>
          spans.some(
            (b) =>
              region.bounds[0] <= b[2] &&
              region.bounds[2] >= b[0] &&
              region.bounds[1] <= b[3] &&
              region.bounds[3] >= b[1],
          )
            ? region.shards
            : [],
        ),
      ),
    ]
      .filter((id) => level === undefined || (directory.shards[id]?.minLevel ?? 0) <= level)
      .sort();
  }
  function combined(
    indexes: StructureIndex[],
    bounds: Bounds,
    options: boolean | StructureQueryOptions = false,
  ): StructurePlacement[] {
    const found = new Map<string, StructurePlacement>();
    for (const index of indexes)
      for (const entry of index.query(bounds, options)) {
        if (found.has(entry.id)) throw new Error(`Duplicate regional placement ${entry.id}`);
        found.set(entry.id, entry);
      }
    return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  function pump(): void {
    while (active < concurrency && queue.length) queue.shift()?.();
  }
  function load(id: string): Promise<StructureIndex> {
    const resident = cache.get(id);
    if (resident) {
      cache.delete(id);
      cache.set(id, resident);
      return Promise.resolve(resident);
    }
    const shared = pending.get(id);
    if (shared) return shared;
    const shard = directory.shards[id];
    if (!shard) return Promise.reject(new Error(`Unknown placement region ${id}`));
    const task = new Promise<StructureIndex>((resolve, reject) => {
      queue.push(() => {
        active++;
        void (async () => {
          controller.signal.throwIfAborted();
          const value = await untilAborted(read(shard.path, controller.signal), controller.signal);
          controller.signal.throwIfAborted();
          const parsed = getSchema('structure-placement-data')?.zod.parse(
            value,
          ) as StructureCatalogDoc;
          if (parsed.entries.length !== shard.count || parsed.rules?.length)
            throw new Error(`Invalid placement region count or rules: ${id}`);
          const index = createStructureIndex(parsed);
          if (shard.bytes <= maxBytes) {
            cache.set(id, index);
            cachedBytes += shard.bytes;
            while (cache.size > maxShards || cachedBytes > maxBytes) {
              const oldest = cache.keys().next().value as string;
              cache.delete(oldest);
              cachedBytes -= directory.shards[oldest]?.bytes ?? 0;
            }
          }
          return index;
        })()
          .finally(() => {
            active--;
            pending.delete(id);
            pump();
          })
          .then(resolve, reject);
      });
    });
    pending.set(id, task);
    pump();
    return task;
  }
  return {
    get entries() {
      return [base, ...cache.values()].flatMap((index) => [...index.entries]);
    },
    get cells() {
      const cells = new Map<string, StructurePlacement[]>();
      for (const index of [base, ...cache.values()])
        for (const [cell, entries] of index.cells)
          cells.set(cell, [...(cells.get(cell) ?? []), ...entries]);
      return cells;
    },
    rules: base.rules,
    query(bounds, options) {
      return combined(
        [
          base,
          ...needed(bounds).flatMap((id) =>
            cache.has(id) ? [cache.get(id) as StructureIndex] : [],
          ),
        ],
        bounds,
        options,
      );
    },
    isLoaded(bounds) {
      return !controller.signal.aborted && needed(bounds).every((id) => cache.has(id));
    },
    async queryAsync(bounds, options = {}) {
      controller.signal.throwIfAborted();
      options.signal?.throwIfAborted();
      // Keep this result's indexes alive even when loading a large rectangle evicts earlier shards.
      const indexes = await untilAborted(
        Promise.all(needed(bounds, options.level).map(load)),
        options.signal,
      );
      controller.signal.throwIfAborted();
      return combined([base, ...indexes], bounds, options);
    },
    dispose() {
      controller.abort();
      cache.clear();
      cachedBytes = 0;
      pump();
    },
    stats() {
      return { cachedBytes, cachedShards: cache.size, pending: pending.size };
    },
  };
}

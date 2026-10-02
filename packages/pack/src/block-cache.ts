/**
 * A persistent cache for byte-range archives (PMTiles, zip packs, anything read by offset).
 *
 * Each archive is split into fixed-size blocks (64 KiB by default) held in two tiers: a small
 * in-memory LRU and a `ByteStore` (IndexedDB in a browser, see `createIndexedDbByteStore`). A
 * read takes what it can from either tier and fetches the rest with one request per run of
 * contiguous missing blocks, so neighbouring reads share blocks and a revisited area costs no
 * network at all. Concurrent reads of the same block share one request; a request is cancelled
 * only when every read waiting on it has been aborted.
 *
 * Archives are identified by `key`: a content hash or a URL that never changes content. A stable
 * URL whose bytes are replaced in place uses `keyBy: 'etag'` instead, so each server version is
 * its own archive and older versions are deleted when a new one is seen. A server that changes
 * the validator of a keyed archive mid-session makes the cache drop that archive's bytes and
 * re-read, never mix versions.
 *
 * The store holds a byte budget. Blocks are evicted least recently used first, with a priority
 * that biases recency: `high` blocks count as a week newer than they are, `low` ones as a day
 * older, so a planet base layer outlives a street-level tile seen at the same time.
 */

/** How long an archive's blocks are kept relative to others when the store is full. */
export type ArchivePriority = 'high' | 'normal' | 'low';

/** What an archive is and where its bytes come from. */
export interface ArchiveKey {
  /** Identity of the bytes: a content hash or a URL whose content never changes. */
  key?: string;
  /** Key by the server's strong ETag instead, for a stable URL whose bytes are replaced. */
  keyBy?: 'etag';
  /** Where the bytes come from; recorded with the archive (and the basis of `keyBy: 'etag'`). */
  url: string;
  /** Total size in bytes, when known. A read never asks for bytes past it. */
  size?: number;
  /** Default `'normal'`. */
  priority?: ArchivePriority;
}

/** What a store records about one archive besides its blocks. */
export interface StoredArchiveInfo {
  key: string;
  url: string;
  priority: ArchivePriority;
  size?: number;
  /** The strong ETag the bytes were read with. */
  etag?: string;
  /** Media type, for documents. */
  type?: string;
  /** When a document was last confirmed current, in ms since the epoch. */
  validated?: number;
}

/** A stored archive and the bytes it holds. */
export interface StoredArchive extends StoredArchiveInfo {
  bytes: number;
  blocks: number;
}

/** Totals reported by a store. */
export interface ByteStoreStats {
  backend: 'memory' | 'indexeddb';
  bytes: number;
  blocks: number;
  archives: number;
  budgetBytes: number;
  /** The store could not be opened or ran out of quota; nothing more is written. */
  degraded: boolean;
}

/**
 * Persistent block storage behind a `BlockCache`. Every method resolves, never rejects: a failure
 * is a miss or a no-op, so a broken store only costs network.
 */
export interface ByteStore {
  readonly kind: 'memory' | 'indexeddb';
  /** The budget in force (possibly clamped below the requested one by the origin's quota). */
  readonly budgetBytes: number;
  getBlocks(key: string, indices: readonly number[]): Promise<Array<Uint8Array | undefined>>;
  /** Write blocks (replacing any with the same index) and the archive's record. */
  putBlocks(
    info: StoredArchiveInfo,
    blocks: ReadonlyArray<{ index: number; bytes: Uint8Array }>,
    now: number,
  ): Promise<void>;
  /** Mark blocks as used now (they move to the back of the eviction order). */
  touch(key: string, indices: readonly number[], now: number): Promise<void>;
  getArchive(key: string): Promise<StoredArchive | undefined>;
  /** Replace an archive's record without touching its blocks; creates an empty record if absent. */
  updateArchive(info: StoredArchiveInfo): Promise<void>;
  /** Every archive recorded with this URL. */
  archivesForUrl(url: string): Promise<StoredArchive[]>;
  deleteArchive(key: string): Promise<void>;
  /** Evict blocks in priority-biased LRU order until at most `targetBytes` remain; returns bytes freed. */
  evict(targetBytes: number): Promise<number>;
  setBudget(bytes: number): void;
  stats(): Promise<ByteStoreStats>;
  clear(): Promise<void>;
  close?(): void;
}

/** One read from the network (or wherever the archive lives) for the cache. */
export type SpanReader = (
  offset: number,
  length: number,
  signal: AbortSignal,
  etag?: string,
) => Promise<{ bytes: Uint8Array; etag?: string }>;

/** The result of a cached read. */
export interface CachedRead {
  bytes: Uint8Array;
  /** The validator these bytes belong to, when known. */
  etag?: string;
}

/** One archive opened through a `BlockCache`. */
export interface CachedArchive {
  /**
   * Read `length` bytes at `offset`; shorter only at the end of the archive. With `etag`, the
   * caller expects that version: bytes cached for another version are never returned.
   */
  read(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<CachedRead>;
  /** Total size, declared or learned from a short read at the end. */
  size(): number | undefined;
  /** The strong ETag of the cached bytes, when known. */
  etag(): string | undefined;
  /** Forget every cached block of this archive. */
  drop(): Promise<void>;
}

export interface BlockCacheOptions {
  /** Block size in bytes (default 64 KiB). */
  blockBytes?: number;
  /** In-memory tier (default 32 MiB). */
  memoryBytes?: number;
  /** Largest single network request when merging missing blocks (default 4 MiB). */
  maxSpanBytes?: number;
  /** Delay before buffered writes go to the store (default 50 ms). */
  flushDelayMs?: number;
  /** A block's last-used time is written at most this often (default 60 s). */
  touchIntervalMs?: number;
  /** Evict when the store holds more than this times the budget (default 1.05)… */
  evictHighWater?: number;
  /** …down to this times the budget (default 0.9). */
  evictLowWater?: number;
  /** Clock, for tests (default `Date.now`). */
  now?: () => number;
}

/** Counters and totals for a `BlockCache`. Block counts, not reads. */
export interface BlockCacheStats {
  backend: 'memory' | 'indexeddb';
  degraded: boolean;
  budgetBytes: number;
  blockBytes: number;
  memoryBytes: number;
  memoryBlocks: number;
  pendingBlocks: number;
  storeBytes: number;
  storeBlocks: number;
  storeArchives: number;
  memoryHits: number;
  storeHits: number;
  misses: number;
  networkRequests: number;
  networkBytes: number;
  /** Reads passed straight through (no validator to key them, or a version mismatch). */
  uncachedRequests: number;
  evictedBytes: number;
}

/** A shared cache of archive blocks; open each archive through it. */
export interface BlockCache {
  readonly store: ByteStore;
  readonly blockBytes: number;
  open(archive: ArchiveKey, source: SpanReader): CachedArchive;
  /** Forget an archive by key. */
  drop(key: string): Promise<void>;
  /** A snapshot; the store totals are as of the last `flush()`. */
  stats(): BlockCacheStats;
  /** Write buffered blocks, evict down to the budget and refresh the store totals. */
  flush(): Promise<void>;
  setBudget(bytes: number): void;
  /** Delete everything, in memory and in the store. */
  clear(): Promise<void>;
  dispose(): void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Recency bias per priority: added to a block's last-used time to order eviction. */
export const PRIORITY_BIAS_MS: Readonly<Record<ArchivePriority, number>> = {
  high: 7 * DAY_MS,
  normal: 0,
  low: -DAY_MS,
};

/** A block's place in the eviction order: lower ranks go first. */
export function evictionRank(priority: ArchivePriority, touched: number): number {
  return touched + PRIORITY_BIAS_MS[priority];
}

/** Whether an error says the server's bytes changed while they were being read. */
export function isChangedError(error: unknown): boolean {
  const named = error as { name?: unknown; constructor?: { name?: unknown } } | undefined;
  const name = named?.name;
  // pmtiles' EtagMismatch keeps Error's `name`; only its constructor carries the class name.
  return (
    name === 'EtagMismatch' ||
    name === 'PackChangedError' ||
    named?.constructor?.name === 'EtagMismatch'
  );
}

export function strongEtag(value: string | null | undefined): string | undefined {
  return value !== null && value !== undefined && value !== '' && !value.startsWith('W/')
    ? value
    : undefined;
}

/** The server replaced a keyed archive; the readers retry from a clean slate. */
class GenerationChanged extends Error {
  constructor(key: string) {
    super(`archive ${key} changed on the server`);
    this.name = 'GenerationChanged';
  }
}

function abortError(): Error {
  return typeof DOMException === 'function'
    ? new DOMException('The operation was aborted.', 'AbortError')
    : Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
}

/** Settle with `promise`, or reject early when `signal` aborts; the work itself continues. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError());
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason ?? abortError());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

interface Deferred<T> {
  promise: Promise<T>;
  settled: boolean;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // A block nobody waits for any more may still fail; that is not an unhandled rejection.
  promise.catch(() => undefined);
  const deferred: Deferred<T> = {
    promise,
    settled: false,
    resolve: (value) => {
      if (deferred.settled) return;
      deferred.settled = true;
      resolve(value);
    },
    reject: (error) => {
      if (deferred.settled) return;
      deferred.settled = true;
      reject(error);
    },
  };
  return deferred;
}

/** Everything known about one keyed archive this session. */
interface ArchiveState {
  key: string;
  url: string;
  priority: ArchivePriority;
  declaredSize: number | undefined;
  size: number | undefined;
  etag: string | undefined;
  /** `keyBy: 'etag'` archives: the etag is part of the key and never relearned. */
  fixedEtag: boolean;
  meta: Promise<void> | undefined;
  /** The server changed validators twice this session; reads bypass the cache. */
  unstable: boolean;
}

/** Blocks one read started loading; cancelled when every waiting read aborts. */
interface Batch {
  waiters: number;
  done: boolean;
  controller: AbortController;
  abort(): void;
}

interface Flight {
  batch: Batch;
  promise: Promise<Uint8Array | undefined>;
}

const blockKey = (key: string, index: number): string => `${key}\u0000${index}`;

/** Create a cache over `store` (default: an in-memory store with a 64 MiB budget). */
export function createBlockCache(
  store: ByteStore = createMemoryByteStore(),
  options: BlockCacheOptions = {},
): BlockCache {
  const B = options.blockBytes ?? 64 * 1024;
  if (!Number.isSafeInteger(B) || B < 1024) throw new Error('blockBytes must be at least 1024');
  const memoryLimit = options.memoryBytes ?? 32 * 1024 * 1024;
  const maxSpanBlocks = Math.max(1, Math.floor((options.maxSpanBytes ?? 4 * 1024 * 1024) / B));
  const flushDelay = options.flushDelayMs ?? 50;
  const touchInterval = options.touchIntervalMs ?? 60_000;
  const highWater = options.evictHighWater ?? 1.05;
  const lowWater = options.evictLowWater ?? 0.9;
  const now = options.now ?? Date.now;

  const states = new Map<string, ArchiveState>();
  /** In-memory LRU, oldest first. */
  const memory = new Map<string, { state: ArchiveState; index: number; bytes: Uint8Array }>();
  let memoryTotal = 0;
  /** Blocks waiting to be written to the store; readable until then. */
  const pending = new Map<string, { state: ArchiveState; index: number; bytes: Uint8Array }>();
  const inflight = new Map<string, Flight>();
  const lastTouch = new Map<string, number>();
  const dueTouches = new Map<ArchiveState, Set<number>>();
  const cleanedGenerations = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let flushChain: Promise<void> = Promise.resolve();
  let disposed = false;

  const counters = {
    memoryHits: 0,
    storeHits: 0,
    misses: 0,
    networkRequests: 0,
    networkBytes: 0,
    uncachedRequests: 0,
    evictedBytes: 0,
  };
  let storeStats: ByteStoreStats = {
    backend: store.kind,
    bytes: 0,
    blocks: 0,
    archives: 0,
    budgetBytes: store.budgetBytes,
    degraded: false,
  };
  void store.stats().then((stats) => {
    storeStats = stats;
  });

  const stateFor = (key: string, archive: ArchiveKey, fixedEtag?: string): ArchiveState => {
    let state = states.get(key);
    if (state === undefined) {
      state = {
        key,
        url: archive.url,
        priority: archive.priority ?? 'normal',
        declaredSize: archive.size,
        size: archive.size,
        etag: fixedEtag,
        fixedEtag: fixedEtag !== undefined,
        meta: undefined,
        unstable: false,
      };
      states.set(key, state);
    } else if (archive.size !== undefined && state.declaredSize === undefined) {
      state.declaredSize = archive.size;
      state.size ??= archive.size;
    }
    return state;
  };

  const loadMeta = (state: ArchiveState): Promise<void> => {
    state.meta ??= (async () => {
      const stored = await store.getArchive(state.key);
      if (stored === undefined) return;
      if (
        state.declaredSize !== undefined &&
        stored.size !== undefined &&
        stored.size !== state.declaredSize
      ) {
        // Same key, different size: the stored bytes are not this archive.
        await store.deleteArchive(state.key);
        return;
      }
      state.size ??= stored.size;
      if (!state.fixedEtag) state.etag ??= stored.etag;
    })();
    return state.meta;
  };

  const memoryGet = (state: ArchiveState, index: number): Uint8Array | undefined => {
    const k = blockKey(state.key, index);
    const hit = memory.get(k);
    if (hit !== undefined) {
      memory.delete(k);
      memory.set(k, hit);
      return hit.bytes;
    }
    return pending.get(k)?.bytes;
  };

  const memorySet = (state: ArchiveState, index: number, bytes: Uint8Array): void => {
    if (bytes.length > memoryLimit) return;
    const k = blockKey(state.key, index);
    const existing = memory.get(k);
    if (existing !== undefined) {
      memoryTotal -= existing.bytes.length;
      memory.delete(k);
    }
    memory.set(k, { state, index, bytes });
    memoryTotal += bytes.length;
    for (const [oldest, entry] of memory) {
      if (memoryTotal <= memoryLimit) break;
      memory.delete(oldest);
      memoryTotal -= entry.bytes.length;
    }
  };

  const scheduleFlush = (delay: number): void => {
    if (disposed) return;
    if (flushTimer !== undefined) {
      if (delay > 0) return;
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, delay);
  };

  const touchSoon = (state: ArchiveState, index: number): void => {
    const k = blockKey(state.key, index);
    const t = now();
    if (t - (lastTouch.get(k) ?? Number.NEGATIVE_INFINITY) < touchInterval) return;
    lastTouch.set(k, t);
    let due = dueTouches.get(state);
    if (due === undefined) {
      due = new Set();
      dueTouches.set(state, due);
    }
    due.add(index);
    scheduleFlush(flushDelay);
  };

  const queueWrite = (state: ArchiveState, index: number, bytes: Uint8Array): void => {
    const k = blockKey(state.key, index);
    pending.set(k, { state, index, bytes });
    lastTouch.set(k, now());
    scheduleFlush(pending.size >= 64 ? 0 : flushDelay);
  };

  const info = (state: ArchiveState): StoredArchiveInfo => ({
    key: state.key,
    url: state.url,
    priority: state.priority,
    ...(state.size !== undefined ? { size: state.size } : {}),
    ...(state.etag !== undefined ? { etag: state.etag } : {}),
  });

  const forget = (state: ArchiveState): void => {
    for (const [k, entry] of memory) {
      if (entry.state !== state) continue;
      memory.delete(k);
      memoryTotal -= entry.bytes.length;
    }
    for (const [k, entry] of pending) if (entry.state === state) pending.delete(k);
    const prefix = `${state.key}\u0000`;
    for (const k of lastTouch.keys()) if (k.startsWith(prefix)) lastTouch.delete(k);
    dueTouches.delete(state);
    state.size = state.declaredSize;
    if (!state.fixedEtag) state.etag = undefined;
    state.meta = Promise.resolve();
  };

  const dropState = async (state: ArchiveState): Promise<void> => {
    forget(state);
    await store.deleteArchive(state.key);
  };

  const fetchSpan = async (
    state: ArchiveState,
    start: number,
    count: number,
    batch: Batch,
    etag: string | undefined,
    source: SpanReader,
    settle: (index: number, value: Uint8Array | undefined | Error) => void,
  ): Promise<void> => {
    const offset = start * B;
    let want = count * B;
    if (state.size !== undefined) want = Math.min(want, state.size - offset);
    if (want <= 0) {
      for (let n = 0; n < count; n++) settle(start + n, undefined);
      return;
    }
    counters.networkRequests++;
    counters.misses += count;
    let response: { bytes: Uint8Array; etag?: string };
    try {
      response = await source(offset, want, batch.controller.signal, etag);
    } catch (error) {
      if (isChangedError(error)) await dropState(state);
      const failure = error instanceof Error ? error : new Error(String(error));
      for (let n = 0; n < count; n++) settle(start + n, failure);
      return;
    }
    const bytes = response.bytes;
    counters.networkBytes += bytes.length;
    const learned = strongEtag(response.etag);
    if (learned !== undefined && state.etag !== undefined && learned !== state.etag) {
      // The server replaced the archive under the same key: forget the old version.
      await dropState(state);
      if (!state.fixedEtag) state.etag = learned;
      const changed = new GenerationChanged(state.key);
      for (let n = 0; n < count; n++) settle(start + n, changed);
      return;
    }
    if (learned !== undefined && state.etag === undefined) state.etag = learned;
    if (bytes.length < want) {
      if (state.size !== undefined) {
        const short = new Error(
          `${state.url}: ${bytes.length} bytes at ${offset}, expected ${want} (size ${state.size})`,
        );
        for (let n = 0; n < count; n++) settle(start + n, short);
        return;
      }
      // A short read with no declared size is the end of the archive.
      state.size = offset + bytes.length;
    }
    for (let n = 0; n < count; n++) {
      const index = start + n;
      const from = n * B;
      if (from >= bytes.length) {
        settle(index, undefined);
        continue;
      }
      // Each block gets its own buffer so the store and the LRU never pin the whole response.
      const block = bytes.slice(from, Math.min(from + B, bytes.length));
      memorySet(state, index, block);
      queueWrite(state, index, block);
      settle(index, block);
    }
  };

  const startBatch = (
    state: ArchiveState,
    fresh: readonly number[],
    etag: string | undefined,
    source: SpanReader,
  ): Batch => {
    const deferreds = new Map<number, Deferred<Uint8Array | undefined>>();
    const batch: Batch = {
      waiters: 0,
      done: false,
      controller: new AbortController(),
      abort: () => {
        if (batch.done) return;
        batch.done = true;
        const reason = abortError();
        batch.controller.abort(reason);
        for (const index of fresh) settle(index, reason);
      },
    };
    const settle = (index: number, value: Uint8Array | undefined | Error): void => {
      const deferred = deferreds.get(index);
      if (deferred === undefined || deferred.settled) return;
      const k = blockKey(state.key, index);
      if (inflight.get(k)?.batch === batch) inflight.delete(k);
      if (value instanceof Error) deferred.reject(value);
      else deferred.resolve(value);
    };
    for (const index of fresh) {
      const deferred = defer<Uint8Array | undefined>();
      deferreds.set(index, deferred);
      inflight.set(blockKey(state.key, index), { batch, promise: deferred.promise });
    }
    void (async () => {
      const stored = await store.getBlocks(state.key, fresh);
      const missing: number[] = [];
      fresh.forEach((index, n) => {
        const hit = stored[n];
        if (hit !== undefined) {
          counters.storeHits++;
          memorySet(state, index, hit);
          touchSoon(state, index);
          settle(index, hit);
        } else {
          missing.push(index);
        }
      });
      if (missing.length === 0 || batch.done) {
        batch.done = true;
        return;
      }
      const spans: Array<[number, number]> = [];
      for (const index of missing) {
        const last = spans[spans.length - 1];
        if (last !== undefined && last[0] + last[1] === index && last[1] < maxSpanBlocks) last[1]++;
        else spans.push([index, 1]);
      }
      await Promise.all(
        spans.map(([start, count]) => fetchSpan(state, start, count, batch, etag, source, settle)),
      );
      batch.done = true;
    })().catch((error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      for (const index of fresh) settle(index, failure);
      batch.done = true;
    });
    return batch;
  };

  const passthrough = async (
    source: SpanReader,
    offset: number,
    length: number,
    signal: AbortSignal | undefined,
    etag: string | undefined,
  ): Promise<CachedRead> => {
    counters.uncachedRequests++;
    const response = await source(offset, length, signal ?? new AbortController().signal, etag);
    counters.networkBytes += response.bytes.length;
    return {
      bytes: response.bytes,
      ...(response.etag !== undefined ? { etag: response.etag } : {}),
    };
  };

  const readBlocks = async (
    state: ArchiveState,
    offset: number,
    length: number,
    signal: AbortSignal | undefined,
    etag: string | undefined,
    source: SpanReader,
  ): Promise<CachedRead> => {
    let end = offset + length;
    if (state.size !== undefined) end = Math.min(end, state.size);
    const done = (bytes: Uint8Array): CachedRead => ({
      bytes,
      ...(state.etag !== undefined ? { etag: state.etag } : {}),
    });
    if (end <= offset) return done(new Uint8Array(0));
    const out = new Uint8Array(end - offset);
    const place = (index: number, block: Uint8Array): void => {
      const blockStart = index * B;
      const from = Math.max(offset, blockStart);
      const to = Math.min(offset + out.length, blockStart + block.length);
      if (to > from) out.set(block.subarray(from - blockStart, to - blockStart), from - offset);
    };
    const first = Math.floor(offset / B);
    const last = Math.floor((end - 1) / B);
    const waits: Array<{ index: number; promise: Promise<Uint8Array | undefined> }> = [];
    const batches = new Set<Batch>();
    const fresh: number[] = [];
    for (let index = first; index <= last; index++) {
      const hit = memoryGet(state, index);
      if (hit !== undefined) {
        counters.memoryHits++;
        place(index, hit);
        touchSoon(state, index);
        continue;
      }
      const flight = inflight.get(blockKey(state.key, index));
      if (flight !== undefined) {
        waits.push({ index, promise: flight.promise });
        batches.add(flight.batch);
        continue;
      }
      fresh.push(index);
    }
    if (fresh.length > 0) {
      const batch = startBatch(state, fresh, etag, source);
      batches.add(batch);
      for (const index of fresh) {
        const flight = inflight.get(blockKey(state.key, index));
        if (flight !== undefined) waits.push({ index, promise: flight.promise });
      }
    }
    if (waits.length === 0) return done(out);
    for (const batch of batches) batch.waiters++;
    let released = false;
    const release = (aborted: boolean): void => {
      if (released) return;
      released = true;
      for (const batch of batches) {
        batch.waiters--;
        if (aborted && batch.waiters <= 0) batch.abort();
      }
    };
    let blocks: Array<Uint8Array | undefined>;
    try {
      blocks = await untilAborted(Promise.all(waits.map((wait) => wait.promise)), signal);
    } catch (error) {
      release(signal?.aborted === true);
      throw error;
    }
    release(false);
    waits.forEach((wait, n) => {
      const block = blocks[n];
      if (block !== undefined) place(wait.index, block);
    });
    // The archive's end may only have become known during this read.
    if (state.size !== undefined && offset + out.length > state.size) {
      return done(out.slice(0, Math.max(0, state.size - offset)));
    }
    return done(out);
  };

  const readState = async (
    state: ArchiveState,
    offset: number,
    length: number,
    signal: AbortSignal | undefined,
    etag: string | undefined,
    source: SpanReader,
  ): Promise<CachedRead> => {
    if (signal?.aborted) throw signal.reason ?? abortError();
    await untilAborted(loadMeta(state), signal);
    if (disposed || state.unstable) return passthrough(source, offset, length, signal, etag);
    // The caller holds another version than the cached one: let the source sort it out.
    if (etag !== undefined && state.etag !== undefined && etag !== state.etag) {
      return passthrough(source, offset, length, signal, etag);
    }
    try {
      return await readBlocks(state, offset, length, signal, etag, source);
    } catch (error) {
      if (!(error instanceof GenerationChanged)) throw error;
    }
    try {
      return await readBlocks(state, offset, length, signal, etag, source);
    } catch (error) {
      if (!(error instanceof GenerationChanged)) throw error;
      // Validators flip between requests (an inconsistent CDN): stop caching this archive.
      state.unstable = true;
      await dropState(state);
      return passthrough(source, offset, length, signal, etag);
    }
  };

  const cleanGenerations = (url: string, keep: string): void => {
    if (cleanedGenerations.has(keep)) return;
    cleanedGenerations.add(keep);
    void (async () => {
      for (const archive of await store.archivesForUrl(url)) {
        if (archive.key !== keep && archive.key.startsWith(`${url}@`)) {
          const stale = states.get(archive.key);
          if (stale !== undefined) forget(stale);
          await store.deleteArchive(archive.key);
        }
      }
    })();
  };

  const writeOut = async (): Promise<void> => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    const t = now();
    while (pending.size > 0) {
      const byState = new Map<ArchiveState, Array<{ index: number; bytes: Uint8Array }>>();
      for (const entry of pending.values()) {
        let list = byState.get(entry.state);
        if (list === undefined) {
          list = [];
          byState.set(entry.state, list);
        }
        list.push({ index: entry.index, bytes: entry.bytes });
      }
      pending.clear();
      await Promise.all(
        [...byState].map(([state, blocks]) => store.putBlocks(info(state), blocks, t)),
      );
    }
    if (dueTouches.size > 0) {
      const touches = [...dueTouches];
      dueTouches.clear();
      await Promise.all(touches.map(([state, indices]) => store.touch(state.key, [...indices], t)));
    }
    let stats = await store.stats();
    if (stats.bytes > stats.budgetBytes * highWater) {
      counters.evictedBytes += await store.evict(Math.floor(stats.budgetBytes * lowWater));
      stats = await store.stats();
    }
    storeStats = stats;
  };

  const flush = (): Promise<void> => {
    flushChain = flushChain.then(writeOut, writeOut);
    return flushChain;
  };

  const open = (archive: ArchiveKey, source: SpanReader): CachedArchive => {
    if (archive.keyBy === 'etag') {
      let current: ArchiveState | undefined;
      return {
        read: async (offset, length, signal, etag) => {
          if (etag === undefined) {
            // No version to key by (the first read of a session): read through, then remember
            // which version the server has so older ones can go.
            const read = await passthrough(source, offset, length, signal, undefined);
            const learned = strongEtag(read.etag);
            if (learned !== undefined) cleanGenerations(archive.url, `${archive.url}@${learned}`);
            return read;
          }
          current = stateFor(`${archive.url}@${etag}`, archive, etag);
          return readState(current, offset, length, signal, etag, source);
        },
        size: () => current?.size ?? archive.size,
        etag: () => current?.etag,
        drop: async () => {
          for (const stored of await store.archivesForUrl(archive.url)) {
            const state = states.get(stored.key);
            if (state !== undefined) forget(state);
            await store.deleteArchive(stored.key);
          }
        },
      };
    }
    if (archive.key === undefined || archive.key === '') {
      throw new Error(`cache archive ${archive.url} needs a key (or keyBy: 'etag')`);
    }
    const state = stateFor(archive.key, archive);
    return {
      read: (offset, length, signal, etag) =>
        readState(state, offset, length, signal, etag, source),
      size: () => state.size,
      etag: () => state.etag,
      drop: () => dropState(state),
    };
  };

  return {
    store,
    blockBytes: B,
    open,
    drop: async (key) => {
      const state = states.get(key);
      if (state !== undefined) forget(state);
      await store.deleteArchive(key);
    },
    stats: () => ({
      backend: storeStats.backend,
      degraded: storeStats.degraded,
      budgetBytes: storeStats.budgetBytes,
      blockBytes: B,
      memoryBytes: memoryTotal,
      memoryBlocks: memory.size,
      pendingBlocks: pending.size,
      storeBytes: storeStats.bytes,
      storeBlocks: storeStats.blocks,
      storeArchives: storeStats.archives,
      ...counters,
    }),
    flush,
    setBudget: (bytes) => {
      store.setBudget(bytes);
      scheduleFlush(0);
    },
    clear: async () => {
      memory.clear();
      memoryTotal = 0;
      pending.clear();
      lastTouch.clear();
      dueTouches.clear();
      cleanedGenerations.clear();
      for (const state of states.values()) {
        state.size = state.declaredSize;
        if (!state.fixedEtag) state.etag = undefined;
        state.meta = Promise.resolve();
      }
      await store.clear();
      storeStats = await store.stats();
    },
    dispose: () => {
      if (disposed) return;
      void flush().finally(() => store.close?.());
      disposed = true;
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      flushTimer = undefined;
    },
  };
}

interface MemoryArchive {
  info: StoredArchiveInfo;
  blocks: Map<number, { bytes: Uint8Array; rank: number }>;
  bytes: number;
}

/** A `ByteStore` in memory: for tests, private browsing, and hosts without IndexedDB. */
export function createMemoryByteStore(options: { budgetBytes?: number } = {}): ByteStore {
  let budget = options.budgetBytes ?? 64 * 1024 * 1024;
  const archives = new Map<string, MemoryArchive>();
  let total = 0;
  let blockCount = 0;
  const summary = (archive: MemoryArchive): StoredArchive => ({
    ...archive.info,
    bytes: archive.bytes,
    blocks: archive.blocks.size,
  });
  const remove = (key: string): void => {
    const archive = archives.get(key);
    if (archive === undefined) return;
    total -= archive.bytes;
    blockCount -= archive.blocks.size;
    archives.delete(key);
  };
  return {
    kind: 'memory',
    get budgetBytes() {
      return budget;
    },
    getBlocks: async (key, indices) => {
      const archive = archives.get(key);
      return indices.map((index) => archive?.blocks.get(index)?.bytes);
    },
    putBlocks: async (info, blocks, now) => {
      let archive = archives.get(info.key);
      if (archive === undefined) {
        archive = { info, blocks: new Map(), bytes: 0 };
        archives.set(info.key, archive);
      } else {
        archive.info = info;
      }
      const rank = evictionRank(info.priority, now);
      for (const block of blocks) {
        const previous = archive.blocks.get(block.index);
        if (previous !== undefined) {
          archive.bytes -= previous.bytes.length;
          total -= previous.bytes.length;
        } else {
          blockCount++;
        }
        archive.blocks.set(block.index, { bytes: block.bytes, rank });
        archive.bytes += block.bytes.length;
        total += block.bytes.length;
      }
    },
    touch: async (key, indices, now) => {
      const archive = archives.get(key);
      if (archive === undefined) return;
      const rank = evictionRank(archive.info.priority, now);
      for (const index of indices) {
        const block = archive.blocks.get(index);
        if (block !== undefined) block.rank = rank;
      }
    },
    getArchive: async (key) => {
      const archive = archives.get(key);
      return archive === undefined ? undefined : summary(archive);
    },
    updateArchive: async (info) => {
      const archive = archives.get(info.key);
      if (archive === undefined) archives.set(info.key, { info, blocks: new Map(), bytes: 0 });
      else archive.info = info;
    },
    archivesForUrl: async (url) =>
      [...archives.values()].filter((archive) => archive.info.url === url).map(summary),
    deleteArchive: async (key) => remove(key),
    evict: async (target) => {
      if (total <= target) return 0;
      const order: Array<{ archive: MemoryArchive; index: number; rank: number }> = [];
      for (const archive of archives.values()) {
        for (const [index, block] of archive.blocks)
          order.push({ archive, index, rank: block.rank });
      }
      order.sort((a, b) => a.rank - b.rank);
      let freed = 0;
      for (const { archive, index } of order) {
        if (total <= target) break;
        const block = archive.blocks.get(index);
        if (block === undefined) continue;
        archive.blocks.delete(index);
        archive.bytes -= block.bytes.length;
        total -= block.bytes.length;
        blockCount--;
        freed += block.bytes.length;
        if (archive.blocks.size === 0) archives.delete(archive.info.key);
      }
      return freed;
    },
    setBudget: (bytes) => {
      budget = Math.max(0, bytes);
    },
    stats: async () => ({
      backend: 'memory',
      bytes: total,
      blocks: blockCount,
      archives: archives.size,
      budgetBytes: budget,
      degraded: false,
    }),
    clear: async () => {
      archives.clear();
      total = 0;
      blockCount = 0;
    },
  };
}

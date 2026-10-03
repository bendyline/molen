/**
 * A `ByteStore` in IndexedDB, for a `BlockCache` that survives page loads.
 *
 * Three object stores: `blocks` holds each block's bytes under `[key, index]`; `touches` holds a
 * small record per block (`length`, eviction `rank`) indexed by rank, so eviction walks one index
 * oldest-first without loading any block; `archives` holds each archive's record and running
 * totals, indexed by URL. Totals are kept in memory and updated when a transaction commits.
 *
 * Every failure resolves: an unavailable database (private browsing, a blocked upgrade) makes
 * every read a miss and every write a no-op, and a quota failure evicts half the budget and
 * retries once before the store stops writing (`degraded`).
 */

import {
  type ArchivePriority,
  type ByteStore,
  type ByteStoreStats,
  evictionRank,
  type StoredArchive,
  type StoredArchiveInfo,
} from './block-cache';

export interface IndexedDbByteStoreOptions {
  /** Database name (default `'molen-bytes'`). */
  name?: string;
  /** Bytes kept before eviction (default 512 MiB); clamped to half the origin's free quota. */
  budgetBytes?: number;
  /**
   * Ask the browser to make this origin's storage persistent (default false). Firefox shows a
   * permission prompt for it, so only hosts that expect one (an installed app) should set it.
   */
  persist?: boolean;
  /** The IndexedDB factory (default `globalThis.indexedDB`). */
  indexedDB?: IDBFactory;
}

const BLOCKS = 'blocks';
const TOUCHES = 'touches';
const ARCHIVES = 'archives';
/** Deletes per eviction transaction, so eviction never holds the database for long. */
const EVICT_SLICE = 256;

interface TouchRecord {
  key: string;
  index: number;
  length: number;
  rank: number;
}

type ArchiveRecord = StoredArchive;

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? (bytes.buffer as ArrayBuffer)
    : (bytes.slice().buffer as ArrayBuffer);
}

const isQuotaError = (error: DOMException | null | undefined): boolean =>
  error?.name === 'QuotaExceededError';

const nextTick = (): Promise<void> =>
  new Promise((resolve) => {
    const idle = (globalThis as { requestIdleCallback?: (fn: () => void) => void })
      .requestIdleCallback;
    if (typeof idle === 'function') idle(() => resolve());
    else setTimeout(resolve, 0);
  });

/**
 * Open (lazily) a block store in IndexedDB. Undefined where IndexedDB does not exist (Node,
 * restricted embedded browsers); a database that fails to open behaves as an empty store.
 */
export function createIndexedDbByteStore(
  options: IndexedDbByteStoreOptions = {},
): ByteStore | undefined {
  const factory =
    options.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? undefined;
  if (factory === undefined) return undefined;
  const name = options.name ?? 'molen-bytes';
  let requested = Math.max(0, options.budgetBytes ?? 512 * 1024 * 1024);
  let quotaLimit = Number.POSITIVE_INFINITY;
  let total = 0;
  let blockCount = 0;
  let archiveCount = 0;
  let degraded = false;
  const priorities = new Map<string, ArchivePriority>();
  let database: Promise<IDBDatabase | undefined> | undefined;
  let evictChain: Promise<unknown> = Promise.resolve();

  const budget = (): number => Math.max(0, Math.min(requested, quotaLimit));

  const loadTotals = (db: IDBDatabase): Promise<void> =>
    new Promise((resolve) => {
      try {
        const request = db.transaction(ARCHIVES, 'readonly').objectStore(ARCHIVES).getAll();
        request.onsuccess = () => {
          for (const archive of request.result as ArchiveRecord[]) {
            total += archive.bytes;
            blockCount += archive.blocks;
            archiveCount++;
            priorities.set(archive.key, archive.priority);
          }
          resolve();
        };
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

  const estimateQuota = async (): Promise<void> => {
    const storage = (globalThis as { navigator?: { storage?: StorageManager } }).navigator?.storage;
    try {
      if (options.persist === true) await storage?.persist?.();
      const estimate = await storage?.estimate?.();
      if (estimate?.quota !== undefined) {
        const free = estimate.quota - (estimate.usage ?? 0) + total;
        quotaLimit = Math.max(0, Math.floor(free * 0.5));
      }
    } catch {
      // No estimate: the requested budget stands.
    }
  };

  const open = (): Promise<IDBDatabase | undefined> => {
    database ??= new Promise<IDBDatabase | undefined>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(name, 1);
      } catch {
        resolve(undefined);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(BLOCKS);
        const touches = db.createObjectStore(TOUCHES, { keyPath: ['key', 'index'] });
        touches.createIndex('rank', 'rank');
        touches.createIndex('key', 'key');
        const archives = db.createObjectStore(ARCHIVES, { keyPath: 'key' });
        archives.createIndex('url', 'url');
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading the schema: step aside rather than block it.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => resolve(undefined);
      request.onblocked = () => resolve(undefined);
    }).then(async (db) => {
      if (db === undefined) {
        degraded = true;
        return undefined;
      }
      await loadTotals(db);
      await estimateQuota();
      return db;
    });
    return database;
  };

  /** Run one transaction; resolves `fallback` when it fails or aborts. */
  const transact = async <T>(
    stores: string | string[],
    mode: IDBTransactionMode,
    fallback: T,
    work: (tx: IDBTransaction, finish: (value: T) => void) => void,
    onAbort?: (error: DOMException | null) => void,
  ): Promise<T> => {
    const db = await open();
    if (db === undefined) return fallback;
    return new Promise<T>((resolve) => {
      let result = fallback;
      try {
        const tx = db.transaction(stores, mode);
        tx.oncomplete = () => resolve(result);
        // A failed request (a quota error on a put) aborts the whole transaction: nothing commits.
        tx.onabort = () => {
          onAbort?.(tx.error);
          resolve(fallback);
        };
        work(tx, (value) => {
          result = value;
        });
      } catch {
        resolve(fallback);
      }
    });
  };

  const getBlocks = async (
    key: string,
    indices: readonly number[],
  ): Promise<Array<Uint8Array | undefined>> => {
    const misses = indices.map(() => undefined);
    if (indices.length === 0) return misses;
    return transact<Array<Uint8Array | undefined>>(BLOCKS, 'readonly', misses, (tx, finish) => {
      const store = tx.objectStore(BLOCKS);
      const out: Array<Uint8Array | undefined> = indices.map(() => undefined);
      finish(out);
      indices.forEach((index, n) => {
        const request = store.get([key, index]);
        request.onsuccess = () => {
          const value = request.result as ArrayBuffer | undefined;
          if (value !== undefined && value !== null) out[n] = new Uint8Array(value);
        };
      });
    });
  };

  const writeBlocks = (
    info: StoredArchiveInfo,
    blocks: ReadonlyArray<{ index: number; bytes: Uint8Array }>,
    now: number,
  ): Promise<'ok' | 'quota' | 'failed'> => {
    let addedBytes = 0;
    let addedBlocks = 0;
    let created = false;
    let quota = false;
    return transact<'ok' | 'quota' | 'failed'>(
      [BLOCKS, TOUCHES, ARCHIVES],
      'readwrite',
      'failed',
      (tx, finish) => {
        const blockStore = tx.objectStore(BLOCKS);
        const touchStore = tx.objectStore(TOUCHES);
        const archiveStore = tx.objectStore(ARCHIVES);
        const rank = evictionRank(info.priority, now);
        for (const block of blocks) {
          const previous = touchStore.get([info.key, block.index]);
          previous.onsuccess = () => {
            const old = previous.result as TouchRecord | undefined;
            addedBytes += block.bytes.length - (old?.length ?? 0);
            if (old === undefined) addedBlocks++;
            const record: TouchRecord = {
              key: info.key,
              index: block.index,
              length: block.bytes.length,
              rank,
            };
            try {
              touchStore.put(record);
              blockStore.put(toBuffer(block.bytes), [info.key, block.index]);
            } catch (error) {
              quota ||= isQuotaError(error as DOMException);
              tx.abort();
            }
          };
        }
        // Requests complete in order, so every delta above is known when this one lands.
        const existing = archiveStore.get(info.key);
        existing.onsuccess = () => {
          const old = existing.result as ArchiveRecord | undefined;
          created = old === undefined;
          const record: ArchiveRecord = {
            ...info,
            bytes: (old?.bytes ?? 0) + addedBytes,
            blocks: (old?.blocks ?? 0) + addedBlocks,
          };
          archiveStore.put(record);
          finish('ok');
        };
      },
      (error) => {
        quota ||= isQuotaError(error);
      },
    ).then((result) => {
      if (result === 'ok') {
        total += addedBytes;
        blockCount += addedBlocks;
        if (created) archiveCount++;
        priorities.set(info.key, info.priority);
        return 'ok';
      }
      return quota ? 'quota' : 'failed';
    });
  };

  const evictOnce = async (target: number): Promise<number> => {
    let freed = 0;
    for (;;) {
      if (total <= target) return freed;
      let sliceFreed = 0;
      let sliceBlocks = 0;
      let removedArchives = 0;
      let exhausted = false;
      const ok = await transact<boolean>(
        [BLOCKS, TOUCHES, ARCHIVES],
        'readwrite',
        false,
        (tx, finish) => {
          const blockStore = tx.objectStore(BLOCKS);
          const touchStore = tx.objectStore(TOUCHES);
          const archiveStore = tx.objectStore(ARCHIVES);
          const decrements = new Map<string, { bytes: number; blocks: number }>();
          const request = touchStore.index('rank').openCursor();
          const settleArchives = (): void => {
            for (const [key, dec] of decrements) {
              const get = archiveStore.get(key);
              get.onsuccess = () => {
                const record = get.result as ArchiveRecord | undefined;
                if (record === undefined) return;
                record.bytes -= dec.bytes;
                record.blocks -= dec.blocks;
                if (record.blocks <= 0) {
                  archiveStore.delete(key);
                  removedArchives++;
                } else {
                  archiveStore.put(record);
                }
              };
            }
            finish(true);
          };
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor === null) {
              exhausted = true;
              settleArchives();
              return;
            }
            if (total - sliceFreed <= target || sliceBlocks >= EVICT_SLICE) {
              settleArchives();
              return;
            }
            const record = cursor.value as TouchRecord;
            blockStore.delete([record.key, record.index]);
            cursor.delete();
            sliceFreed += record.length;
            sliceBlocks++;
            const dec = decrements.get(record.key) ?? { bytes: 0, blocks: 0 };
            dec.bytes += record.length;
            dec.blocks++;
            decrements.set(record.key, dec);
            cursor.continue();
          };
        },
      );
      if (!ok) return freed;
      total -= sliceFreed;
      blockCount -= sliceBlocks;
      archiveCount -= removedArchives;
      freed += sliceFreed;
      if (exhausted || sliceBlocks === 0) return freed;
      await nextTick();
    }
  };

  /** Evictions run one at a time; each walks the rank index from the oldest block. */
  const evict = (target: number): Promise<number> => {
    const run = evictChain.then(async () => {
      await open();
      return evictOnce(Math.max(0, target));
    });
    evictChain = run.catch(() => 0);
    return run;
  };

  return {
    kind: 'indexeddb',
    get budgetBytes() {
      return budget();
    },
    getBlocks,
    putBlocks: async (info, blocks, now) => {
      if (degraded || blocks.length === 0) return;
      let result = await writeBlocks(info, blocks, now);
      if (result === 'quota') {
        await evict(Math.floor(budget() * 0.5));
        result = await writeBlocks(info, blocks, now);
        if (result === 'quota') degraded = true;
      }
    },
    touch: async (key, indices, now) => {
      if (degraded || indices.length === 0) return;
      const rank = evictionRank(priorities.get(key) ?? 'normal', now);
      await transact<void>(TOUCHES, 'readwrite', undefined, (tx) => {
        const store = tx.objectStore(TOUCHES);
        for (const index of indices) {
          const request = store.get([key, index]);
          request.onsuccess = () => {
            const record = request.result as TouchRecord | undefined;
            if (record !== undefined) store.put({ ...record, rank });
          };
        }
      });
    },
    getArchive: (key) =>
      transact<StoredArchive | undefined>(ARCHIVES, 'readonly', undefined, (tx, finish) => {
        const request = tx.objectStore(ARCHIVES).get(key);
        request.onsuccess = () => finish(request.result as ArchiveRecord | undefined);
      }),
    updateArchive: async (info) => {
      let created = false;
      const ok = await transact<boolean>(ARCHIVES, 'readwrite', false, (tx, finish) => {
        const store = tx.objectStore(ARCHIVES);
        const request = store.get(info.key);
        request.onsuccess = () => {
          const old = request.result as ArchiveRecord | undefined;
          created = old === undefined;
          store.put({ ...info, bytes: old?.bytes ?? 0, blocks: old?.blocks ?? 0 });
          finish(true);
        };
      });
      if (ok) {
        if (created) archiveCount++;
        priorities.set(info.key, info.priority);
      }
    },
    archivesForUrl: (url) =>
      transact<StoredArchive[]>(ARCHIVES, 'readonly', [], (tx, finish) => {
        const request = tx.objectStore(ARCHIVES).index('url').getAll(url);
        request.onsuccess = () => finish(request.result as ArchiveRecord[]);
      }),
    deleteArchive: async (key) => {
      let removed: ArchiveRecord | undefined;
      const ok = await transact<boolean>(
        [BLOCKS, TOUCHES, ARCHIVES],
        'readwrite',
        false,
        (tx, finish) => {
          const range = IDBKeyRange.bound(
            [key, Number.NEGATIVE_INFINITY],
            [key, Number.POSITIVE_INFINITY],
          );
          tx.objectStore(BLOCKS).delete(range);
          tx.objectStore(TOUCHES).delete(range);
          const archives = tx.objectStore(ARCHIVES);
          const request = archives.get(key);
          request.onsuccess = () => {
            removed = request.result as ArchiveRecord | undefined;
            archives.delete(key);
            finish(true);
          };
        },
      );
      if (ok && removed !== undefined) {
        total -= removed.bytes;
        blockCount -= removed.blocks;
        archiveCount--;
        priorities.delete(key);
      }
    },
    evict,
    setBudget: (bytes) => {
      requested = Math.max(0, bytes);
    },
    stats: async (): Promise<ByteStoreStats> => {
      await open();
      return {
        backend: 'indexeddb',
        bytes: total,
        blocks: blockCount,
        archives: archiveCount,
        budgetBytes: budget(),
        degraded,
      };
    },
    clear: async () => {
      const ok = await transact<boolean>(
        [BLOCKS, TOUCHES, ARCHIVES],
        'readwrite',
        false,
        (tx, finish) => {
          tx.objectStore(BLOCKS).clear();
          tx.objectStore(TOUCHES).clear();
          tx.objectStore(ARCHIVES).clear();
          finish(true);
        },
      );
      if (ok) {
        total = 0;
        blockCount = 0;
        archiveCount = 0;
        priorities.clear();
        degraded = false;
      }
    },
    close: () => {
      void database?.then((db) => db?.close());
    },
  };
}

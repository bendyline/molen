import type { BakedMaterial, BakedMaterialStore } from '@bendyline/molen-materials';

const STORE = 'baked';

/**
 * Baked materials kept in IndexedDB across visits; pair with `withBakedMaterialStore` from
 * `@bendyline/molen-materials`. Undefined where IndexedDB is unavailable. Every failure (quota,
 * private browsing, a blocked upgrade) resolves as a miss, so baking simply runs as before.
 */
export function createIndexedDbMaterialStore(
  name = 'molen-baked-materials',
): BakedMaterialStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined;
  let database: Promise<IDBDatabase | undefined> | undefined;
  const open = (): Promise<IDBDatabase | undefined> => {
    database ??= new Promise((resolve) => {
      try {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
        request.onblocked = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
    return database;
  };
  const transact = async <T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore, done: (value: T | undefined) => void) => void,
  ): Promise<T | undefined> => {
    const db = await open();
    if (db === undefined) return undefined;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE, mode);
        transaction.onabort = () => resolve(undefined);
        transaction.onerror = () => resolve(undefined);
        work(transaction.objectStore(STORE), resolve);
      } catch {
        resolve(undefined);
      }
    });
  };
  return {
    get: (key) =>
      transact<BakedMaterial>('readonly', (store, done) => {
        const request = store.get(key);
        request.onsuccess = () => done(request.result as BakedMaterial | undefined);
      }),
    set: async (key, material) => {
      await transact<void>('readwrite', (store, done) => {
        store.put(material, key).onsuccess = () => done(undefined);
      });
    },
    prune: async (keep) => {
      await transact<void>('readwrite', (store, done) => {
        const request = store.openKeyCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor === null) return done(undefined);
          if (!keep(String(cursor.key))) store.delete(cursor.key);
          cursor.continue();
        };
      });
    },
  };
}

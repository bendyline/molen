import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createBlockCache } from '../src/block-cache';
import { createIndexedDbByteStore } from '../src/indexeddb-byte-store';
import { noise } from './helpers';

const KB = 1024;
const block = (seed: number, length = 64 * KB): Uint8Array => noise(length, seed);

/** A store on its own fresh in-memory IndexedDB. */
function freshStore(options: { budgetBytes?: number; factory?: IDBFactory } = {}) {
  const factory = options.factory ?? new IDBFactory();
  const store = createIndexedDbByteStore({
    indexedDB: factory,
    name: 'test-bytes',
    ...(options.budgetBytes !== undefined ? { budgetBytes: options.budgetBytes } : {}),
  });
  if (store === undefined) throw new Error('expected an IndexedDB store');
  return { store, factory };
}

const info = (key: string, priority: 'high' | 'normal' | 'low' = 'normal') => ({
  key,
  url: `https://x/${key}`,
  priority,
  size: 10 * 64 * KB,
  etag: '"e"',
});

describe('createIndexedDbByteStore', () => {
  it('is undefined without IndexedDB', () => {
    const saved = globalThis.indexedDB;
    try {
      (globalThis as { indexedDB?: IDBFactory }).indexedDB = undefined;
      expect(createIndexedDbByteStore()).toBeUndefined();
    } finally {
      (globalThis as { indexedDB?: IDBFactory }).indexedDB = saved;
    }
  });

  it('stores blocks and records and keeps totals across reopening', async () => {
    const { store, factory } = freshStore();
    await store.putBlocks(
      info('a'),
      [
        { index: 0, bytes: block(1) },
        { index: 1, bytes: block(2, 10 * KB) },
      ],
      1000,
    );
    const [first, second, missing] = await store.getBlocks('a', [0, 1, 7]);
    expect(first).toEqual(block(1));
    expect(second).toEqual(block(2, 10 * KB));
    expect(missing).toBeUndefined();
    expect(await store.getArchive('a')).toMatchObject({
      key: 'a',
      url: 'https://x/a',
      etag: '"e"',
      bytes: 74 * KB,
      blocks: 2,
    });
    // Replacing a block adjusts the totals instead of adding to them.
    await store.putBlocks(info('a'), [{ index: 1, bytes: block(3, 20 * KB) }], 2000);
    expect(await store.stats()).toMatchObject({ bytes: 84 * KB, blocks: 2, archives: 1 });
    store.close?.();

    const { store: reopened } = freshStore({ factory });
    expect(await reopened.stats()).toMatchObject({ bytes: 84 * KB, blocks: 2, archives: 1 });
    expect((await reopened.archivesForUrl('https://x/a')).map((a) => a.key)).toEqual(['a']);
  });

  it('evicts by priority-biased recency, oldest first', async () => {
    const { store } = freshStore({ budgetBytes: 10 * 64 * KB });
    const day = 24 * 60 * 60 * 1000;
    await store.putBlocks(info('high', 'high'), [{ index: 0, bytes: block(1) }], 1 * day);
    await store.putBlocks(info('old'), [{ index: 0, bytes: block(2) }], 2 * day);
    await store.putBlocks(info('low', 'low'), [{ index: 0, bytes: block(3) }], 2.5 * day);
    await store.putBlocks(info('new'), [{ index: 0, bytes: block(4) }], 3 * day);
    // Ranks: low 1.5d, old 2d, new 3d, high 8d.
    expect(await store.evict(2 * 64 * KB)).toBe(2 * 64 * KB);
    expect(await store.getArchive('low')).toBeUndefined();
    expect(await store.getArchive('old')).toBeUndefined();
    expect(await store.getArchive('new')).toBeDefined();
    expect(await store.getArchive('high')).toBeDefined();
    expect(await store.stats()).toMatchObject({ bytes: 2 * 64 * KB, blocks: 2, archives: 2 });
  });

  it('a touch moves a block back in the eviction order', async () => {
    const { store } = freshStore();
    await store.putBlocks(info('a'), [{ index: 0, bytes: block(1) }], 1000);
    await store.putBlocks(info('b'), [{ index: 0, bytes: block(2) }], 2000);
    await store.touch('a', [0], 3000);
    await store.evict(64 * KB);
    expect(await store.getArchive('a')).toBeDefined();
    expect(await store.getArchive('b')).toBeUndefined();
  });

  it('evicts in slices across many blocks', async () => {
    const { store } = freshStore();
    const blocks = Array.from({ length: 600 }, (_, index) => ({ index, bytes: block(index, KB) }));
    await store.putBlocks(info('many'), blocks, 1000);
    expect(await store.evict(100 * KB)).toBe(500 * KB);
    expect(await store.stats()).toMatchObject({ bytes: 100 * KB, blocks: 100 });
    expect((await store.getArchive('many'))?.blocks).toBe(100);
  });

  it('deletes an archive, updates records and clears', async () => {
    const { store } = freshStore();
    await store.putBlocks(
      info('a'),
      [
        { index: 0, bytes: block(1) },
        { index: 3, bytes: block(2) },
      ],
      1,
    );
    await store.putBlocks(info('b'), [{ index: 0, bytes: block(3) }], 1);
    await store.deleteArchive('a');
    expect(await store.getBlocks('a', [0, 3])).toEqual([undefined, undefined]);
    expect(await store.getArchive('a')).toBeUndefined();
    expect(await store.stats()).toMatchObject({ bytes: 64 * KB, blocks: 1, archives: 1 });
    await store.updateArchive({ ...info('b'), validated: 42 });
    expect(await store.getArchive('b')).toMatchObject({ validated: 42, bytes: 64 * KB, blocks: 1 });
    await store.clear();
    expect(await store.stats()).toMatchObject({ bytes: 0, blocks: 0, archives: 0 });
    expect(await store.getBlocks('b', [0])).toEqual([undefined]);
  });

  it('evicts and retries once when the quota runs out, then stops writing', async () => {
    const { store } = freshStore();
    await store.putBlocks(info('old'), [{ index: 0, bytes: block(1) }], 1);
    // Make every block write fail as a browser out of quota would.
    let failPuts = true;
    const realPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (failPuts && this.name === 'blocks') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return realPut.apply(this, args);
    } as IDBObjectStore['put'];
    try {
      await store.putBlocks(info('new'), [{ index: 0, bytes: block(2) }], 2);
      expect((await store.stats()).degraded).toBe(true);
      failPuts = false;
      await store.putBlocks(info('later'), [{ index: 0, bytes: block(3) }], 3);
      expect(await store.getArchive('later')).toBeUndefined();
    } finally {
      IDBObjectStore.prototype.put = realPut;
    }
  });

  it('backs a BlockCache across restarts', async () => {
    const factory = new IDBFactory();
    const bytes = noise(300 * KB, 9);
    let requests = 0;
    const source = async (offset: number, length: number) => {
      requests++;
      return { bytes: bytes.slice(offset, offset + length), etag: '"v1"' };
    };
    const first = createBlockCache(freshStore({ factory }).store);
    await first.open({ key: 'k', url: 'u', size: bytes.length }, source).read(1000, 200 * KB);
    await first.flush();
    expect(requests).toBe(1);
    first.dispose();

    const second = createBlockCache(freshStore({ factory }).store);
    const archive = second.open({ key: 'k', url: 'u', size: bytes.length }, source);
    const read = await archive.read(5000, 100 * KB);
    expect(read.bytes).toEqual(bytes.subarray(5000, 5000 + 100 * KB));
    expect(read.etag).toBe('"v1"');
    expect(requests).toBe(1);
    await second.flush();
    expect(second.stats()).toMatchObject({ backend: 'indexeddb', storeBlocks: 4, degraded: false });
  });
});

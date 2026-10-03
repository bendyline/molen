import { describe, expect, it } from 'vitest';
import {
  type ByteStore,
  createBlockCache,
  createMemoryByteStore,
  type SpanReader,
} from '../src/block-cache';
import { noise } from './helpers';

const KB = 1024;

/** A SpanReader over bytes that records every request, like a static host honouring Range. */
function spanSource(initial: Uint8Array, options: { etag?: string } = {}) {
  const state = {
    bytes: initial,
    etag: options.etag,
    failures: 0,
    reads: [] as { offset: number; length: number; etag?: string; signal: AbortSignal }[],
    /** Hold responses until `release()` (for concurrency tests). */
    gate: undefined as Promise<void> | undefined,
  };
  const source: SpanReader = async (offset, length, signal, etag) => {
    state.reads.push({ offset, length, signal, ...(etag !== undefined ? { etag } : {}) });
    if (state.gate !== undefined) await state.gate;
    if (signal.aborted) throw signal.reason;
    if (state.failures > 0) {
      state.failures--;
      throw new TypeError('network down');
    }
    return {
      bytes: state.bytes.slice(offset, offset + length),
      ...(state.etag !== undefined ? { etag: state.etag } : {}),
    };
  };
  let release: () => void = () => undefined;
  const hold = (): void => {
    state.gate = new Promise((resolve) => {
      release = () => {
        state.gate = undefined;
        resolve();
      };
    });
  };
  return { state, source, hold, release: () => release() };
}

const expectBytes = (actual: Uint8Array, expected: Uint8Array): void => {
  expect(actual.length).toBe(expected.length);
  expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
};

describe('createBlockCache', () => {
  it('fetches contiguous missing blocks in one request and serves repeats from memory', async () => {
    const bytes = noise(300 * KB, 3);
    const { state, source } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'https://x/a', size: bytes.length }, source);

    const read = await archive.read(70 * KB, 100 * KB);
    expectBytes(read.bytes, bytes.subarray(70 * KB, 170 * KB));
    // Blocks 1 and 2 (64–192 KiB), one request.
    expect(state.reads.map(({ offset, length }) => [offset, length])).toEqual([
      [64 * KB, 128 * KB],
    ]);
    // Inside the fetched blocks: no request.
    expectBytes((await archive.read(100 * KB, 20 * KB)).bytes, bytes.subarray(100 * KB, 120 * KB));
    // Straddling a cached block and a new one: only the new block is fetched.
    expectBytes((await archive.read(180 * KB, 30 * KB)).bytes, bytes.subarray(180 * KB, 210 * KB));
    expect(state.reads.map(({ offset, length }) => [offset, length])).toEqual([
      [64 * KB, 128 * KB],
      [192 * KB, 64 * KB],
    ]);
    expect(cache.stats().memoryHits).toBeGreaterThan(0);
  });

  it('splits long runs at maxSpanBytes', async () => {
    const bytes = noise(512 * KB, 4);
    const { state, source } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), {
      blockBytes: 64 * KB,
      maxSpanBytes: 128 * KB,
    });
    const archive = cache.open({ key: 'a', url: 'u', size: bytes.length }, source);
    expectBytes((await archive.read(0, 512 * KB)).bytes, bytes);
    expect(state.reads.map(({ offset, length }) => [offset, length])).toEqual([
      [0, 128 * KB],
      [128 * KB, 128 * KB],
      [256 * KB, 128 * KB],
      [384 * KB, 128 * KB],
    ]);
  });

  it('learns the size from a short last block and never reads past it', async () => {
    const bytes = noise(100 * KB, 5);
    const { state, source } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'u' }, source);
    const read = await archive.read(90 * KB, 50 * KB);
    expectBytes(read.bytes, bytes.subarray(90 * KB));
    expect(archive.size()).toBe(100 * KB);
    expect(state.reads).toHaveLength(1);
    expect((await archive.read(120 * KB, 10 * KB)).bytes.length).toBe(0);
    expectBytes((await archive.read(64 * KB, 36 * KB)).bytes, bytes.subarray(64 * KB));
    expect(state.reads).toHaveLength(1);
  });

  it('shares one request between concurrent reads of the same blocks', async () => {
    const bytes = noise(128 * KB, 6);
    const { state, source, hold, release } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'u', size: bytes.length }, source);
    hold();
    const first = archive.read(0, 10 * KB);
    const second = archive.read(5 * KB, 10 * KB);
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    expectBytes((await first).bytes, bytes.subarray(0, 10 * KB));
    expectBytes((await second).bytes, bytes.subarray(5 * KB, 15 * KB));
    expect(state.reads).toHaveLength(1);
  });

  it('reads from the store after a restart, and from the network only for new blocks', async () => {
    const bytes = noise(256 * KB, 7);
    const store = createMemoryByteStore();
    const first = spanSource(bytes);
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    await cache.open({ key: 'a', url: 'u', size: bytes.length }, first.source).read(0, 128 * KB);
    await cache.flush();
    expect(cache.stats().storeBlocks).toBe(2);

    const again = spanSource(bytes);
    const restarted = createBlockCache(store, { blockBytes: 64 * KB });
    const archive = restarted.open({ key: 'a', url: 'u', size: bytes.length }, again.source);
    expectBytes((await archive.read(10 * KB, 100 * KB)).bytes, bytes.subarray(10 * KB, 110 * KB));
    expect(again.state.reads).toHaveLength(0);
    expect(restarted.stats().storeHits).toBe(2);
    expectBytes((await archive.read(120 * KB, 20 * KB)).bytes, bytes.subarray(120 * KB, 140 * KB));
    expect(again.state.reads.map(({ offset }) => offset)).toEqual([128 * KB]);
  });

  it('never stores a failed read', async () => {
    const bytes = noise(64 * KB, 8);
    const { state, source } = spanSource(bytes);
    state.failures = 1;
    const store = createMemoryByteStore();
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'u', size: bytes.length }, source);
    await expect(archive.read(0, KB)).rejects.toThrow('network down');
    await cache.flush();
    expect((await store.stats()).blocks).toBe(0);
    expectBytes((await archive.read(0, KB)).bytes, bytes.subarray(0, KB));
    expect(state.reads).toHaveLength(2);
  });

  it('cancels a shared request only when every waiting read aborts', async () => {
    const bytes = noise(64 * KB, 9);
    const { state, source, hold, release } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'u', size: bytes.length }, source);
    hold();
    const a = new AbortController();
    const b = new AbortController();
    const readA = archive.read(0, KB, a.signal);
    const readB = archive.read(KB, KB, b.signal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    a.abort();
    await expect(readA).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.reads[0]?.signal.aborted).toBe(false);
    b.abort();
    await expect(readB).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.reads[0]?.signal.aborted).toBe(true);
    release();
    // Nothing was cached; a later read fetches again.
    expectBytes((await archive.read(0, KB)).bytes, bytes.subarray(0, KB));
    expect(state.reads).toHaveLength(2);
  });

  it('keeps reading for a read that did not abort', async () => {
    const bytes = noise(64 * KB, 10);
    const { source, hold, release } = spanSource(bytes);
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'a', url: 'u', size: bytes.length }, source);
    hold();
    const a = new AbortController();
    const readA = archive.read(0, KB, a.signal);
    const readB = archive.read(KB, KB);
    await new Promise((resolve) => setTimeout(resolve, 10));
    a.abort();
    await expect(readA).rejects.toMatchObject({ name: 'AbortError' });
    release();
    expectBytes((await readB).bytes, bytes.subarray(KB, 2 * KB));
  });

  it('evicts least recently used blocks, biased by priority, down to the low-water mark', async () => {
    let clock = 1_000_000;
    const store = createMemoryByteStore({ budgetBytes: 4 * 64 * KB });
    const cache = createBlockCache(store, {
      blockBytes: 64 * KB,
      memoryBytes: 64 * KB,
      now: () => clock,
    });
    const bytes = noise(128 * KB, 11);
    const open = (key: string, priority: 'high' | 'normal' | 'low') =>
      cache.open({ key, url: key, size: bytes.length, priority }, spanSource(bytes).source);
    // Oldest first: a high-priority archive, then a normal and a low one at the same time.
    await open('high', 'high').read(0, 128 * KB);
    await cache.flush();
    clock += 60_000;
    await open('normal', 'normal').read(0, 128 * KB);
    await open('low', 'low').read(0, 128 * KB);
    await cache.flush();
    // 6 blocks against a budget of 4 (high water 4.2, low water 3.6): three go, low first.
    const remaining = await Promise.all(
      ['high', 'normal', 'low'].map(async (key) => (await store.getArchive(key))?.blocks ?? 0),
    );
    expect(remaining).toEqual([2, 1, 0]);
    expect(cache.stats().evictedBytes).toBe(3 * 64 * KB);
  });

  it('moves touched blocks to the back of the eviction order', async () => {
    let clock = 1_000_000;
    const store = createMemoryByteStore({ budgetBytes: 4 * 64 * KB });
    const cache = createBlockCache(store, {
      blockBytes: 64 * KB,
      memoryBytes: 0,
      touchIntervalMs: 1000,
      now: () => clock,
    });
    const bytes = noise(128 * KB, 12);
    const open = (key: string) =>
      cache.open({ key, url: key, size: bytes.length }, spanSource(bytes).source);
    const older = open('older');
    await older.read(0, 128 * KB);
    await cache.flush();
    clock += 10_000;
    await open('newer').read(0, 128 * KB);
    await cache.flush();
    clock += 10_000;
    // Reading the older archive again (from the store) makes it more recent than `newer`.
    await older.read(0, 128 * KB);
    await cache.flush();
    clock += 10_000;
    // A fifth block: two must go, and they are `newer`'s.
    await open('third').read(0, 64 * KB);
    await cache.flush();
    expect((await store.getArchive('older'))?.blocks).toBe(2);
    expect(await store.getArchive('newer')).toBeUndefined();
    expect((await store.getArchive('third'))?.blocks).toBe(1);
  });

  it('keys a stable URL by its ETag and deletes older versions', async () => {
    const v1 = noise(128 * KB, 13);
    const server = spanSource(v1, { etag: '"v1"' });
    const store = createMemoryByteStore();
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    const archive = cache.open({ keyBy: 'etag', url: 'https://x/base' }, server.source);

    // The first read (no version yet) goes straight through.
    const header = await archive.read(0, 16 * KB);
    expect(header.etag).toBe('"v1"');
    expect(server.state.reads).toHaveLength(1);
    expectBytes(
      (await archive.read(70 * KB, KB, undefined, '"v1"')).bytes,
      v1.subarray(70 * KB, 71 * KB),
    );
    expectBytes(
      (await archive.read(70 * KB, KB, undefined, '"v1"')).bytes,
      v1.subarray(70 * KB, 71 * KB),
    );
    expect(server.state.reads).toHaveLength(2);
    await cache.flush();
    expect(await store.getArchive('https://x/base@"v1"')).toBeDefined();

    // A new version on the server: the old one is deleted once the new header is seen.
    const v2 = noise(128 * KB, 14);
    server.state.bytes = v2;
    server.state.etag = '"v2"';
    expect((await archive.read(0, 16 * KB)).etag).toBe('"v2"');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await store.getArchive('https://x/base@"v1"')).toBeUndefined();
    expectBytes(
      (await archive.read(70 * KB, KB, undefined, '"v2"')).bytes,
      v2.subarray(70 * KB, 71 * KB),
    );
  });

  it('drops a keyed archive whose server validator changes, and never mixes versions', async () => {
    const v1 = noise(192 * KB, 15);
    const server = spanSource(v1, { etag: '"v1"' });
    const store = createMemoryByteStore();
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'k', url: 'u', size: v1.length }, server.source);
    await archive.read(0, 64 * KB);
    expect(archive.etag()).toBe('"v1"');

    const v2 = noise(192 * KB, 16);
    server.state.bytes = v2;
    server.state.etag = '"v2"';
    // Block 0 is cached (v1), block 1 is not: the read must come back entirely as v2.
    const read = await archive.read(32 * KB, 64 * KB);
    expectBytes(read.bytes, v2.subarray(32 * KB, 96 * KB));
    expect(read.etag).toBe('"v2"');
  });

  it('passes a read for another version straight through', async () => {
    const bytes = noise(64 * KB, 17);
    const server = spanSource(bytes, { etag: '"v1"' });
    const cache = createBlockCache(createMemoryByteStore(), { blockBytes: 64 * KB });
    const archive = cache.open({ key: 'k', url: 'u', size: bytes.length }, server.source);
    await archive.read(0, KB);
    const read = await archive.read(0, KB, undefined, '"v0"');
    expect(server.state.reads.at(-1)).toMatchObject({ offset: 0, length: KB, etag: '"v0"' });
    expect(read.etag).toBe('"v1"');
    expect(cache.stats().uncachedRequests).toBe(1);
  });

  it('drops an archive when the source reports a changed file', async () => {
    const bytes = noise(128 * KB, 18);
    const store = createMemoryByteStore();
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    let fail = false;
    class EtagMismatch extends Error {}
    const source: SpanReader = async (offset, length) => {
      if (fail) throw new EtagMismatch('changed');
      return { bytes: bytes.slice(offset, offset + length) };
    };
    const archive = cache.open({ key: 'k', url: 'u', size: bytes.length }, source);
    await archive.read(0, KB);
    await cache.flush();
    expect((await store.getArchive('k'))?.blocks).toBe(1);
    fail = true;
    await expect(archive.read(64 * KB, KB)).rejects.toBeInstanceOf(EtagMismatch);
    expect(await store.getArchive('k')).toBeUndefined();
  });

  it('discards stored bytes whose size disagrees with the declared one', async () => {
    const store: ByteStore = createMemoryByteStore();
    const bytes = noise(64 * KB, 19);
    const first = createBlockCache(store, { blockBytes: 64 * KB });
    await first
      .open({ key: 'k', url: 'u', size: bytes.length }, spanSource(bytes).source)
      .read(0, KB);
    await first.flush();
    const other = noise(80 * KB, 20);
    const server = spanSource(other);
    const second = createBlockCache(store, { blockBytes: 64 * KB });
    const read = await second
      .open({ key: 'k', url: 'u', size: other.length }, server.source)
      .read(0, KB);
    expectBytes(read.bytes, other.subarray(0, KB));
    expect(server.state.reads).toHaveLength(1);
  });

  it('clears memory and the store', async () => {
    const bytes = noise(64 * KB, 21);
    const store = createMemoryByteStore();
    const cache = createBlockCache(store, { blockBytes: 64 * KB });
    const server = spanSource(bytes);
    const archive = cache.open({ key: 'k', url: 'u', size: bytes.length }, server.source);
    await archive.read(0, KB);
    await cache.flush();
    await cache.clear();
    expect(cache.stats().storeBytes).toBe(0);
    expect(cache.stats().memoryBlocks).toBe(0);
    await archive.read(0, KB);
    expect(server.state.reads).toHaveLength(2);
  });
});

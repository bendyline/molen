import { describe, expect, it } from 'vitest';
import { createBlockCache, createMemoryByteStore } from '../src/block-cache';
import { createPack } from '../src/build';
import {
  cachingRangeReader,
  cachingRangeSource,
  type RangeSourceLike,
  type RangeSourceResponse,
} from '../src/cache-adapters';
import { cachingDocumentFetch, DOCUMENT_CACHE_HEADER } from '../src/document-cache';
import { openPack } from '../src/pack';
import { PackChangedError, urlRangeReader } from '../src/source';
import { fakeServer, noise, recordingReader, sampleFiles } from './helpers';

const KB = 1024;

/** pmtiles' error for a validator that changed: its instances keep Error's `name`. */
class EtagMismatch extends Error {}

/** A PMTiles-shaped source over bytes, validating like pmtiles' FetchSource. */
function stubSource(initial: Uint8Array, etag = '"v1"') {
  const state = {
    bytes: initial,
    etag,
    calls: [] as { offset: number; length: number; etag?: string }[],
  };
  const source: RangeSourceLike = {
    getKey: () => 'https://tiles.example/a.pmtiles',
    getBytes: async (offset, length, _signal, expected): Promise<RangeSourceResponse> => {
      state.calls.push({ offset, length, ...(expected !== undefined ? { etag: expected } : {}) });
      if (expected !== undefined && expected !== state.etag) throw new EtagMismatch('changed');
      return { data: state.bytes.slice(offset, offset + length).buffer, etag: state.etag };
    },
  };
  return { state, source };
}

describe('cachingRangeSource', () => {
  it('serves repeated reads from the cache with the stored validator', async () => {
    const bytes = noise(200 * KB, 1);
    const { state, source } = stubSource(bytes);
    const cache = createBlockCache(createMemoryByteStore());
    const cached = cachingRangeSource(source, cache, {
      key: 'sha256:a',
      url: 'a',
      size: bytes.length,
    });
    expect(cached.getKey()).toBe(source.getKey());

    const header = await cached.getBytes(0, 16 * KB);
    expect(header.etag).toBe('"v1"');
    expect(new Uint8Array(header.data)).toEqual(bytes.subarray(0, 16 * KB));
    // Tile reads carry the header's validator; the second is a hit.
    await cached.getBytes(20 * KB, 5 * KB, undefined, '"v1"');
    const tile = await cached.getBytes(20 * KB, 5 * KB, undefined, '"v1"');
    expect(new Uint8Array(tile.data)).toEqual(bytes.subarray(20 * KB, 25 * KB));
    expect(tile.data.byteLength).toBe(5 * KB);
    expect(state.calls).toHaveLength(1);
  });

  it('lets the inner source detect a replaced file and forgets the cached bytes', async () => {
    const bytes = noise(200 * KB, 2);
    const { state, source } = stubSource(bytes);
    const store = createMemoryByteStore();
    const cache = createBlockCache(store);
    const cached = cachingRangeSource(source, cache, {
      key: 'url-a',
      url: 'a',
      size: bytes.length,
    });
    await cached.getBytes(0, 16 * KB);
    await cache.flush();
    state.etag = '"v2"';
    // A miss carrying the old validator reaches the server, which has another version.
    const failure = await cached.getBytes(100 * KB, KB, undefined, '"v1"').catch((e) => e);
    expect(failure).toBeInstanceOf(EtagMismatch);
    expect(await store.getArchive('url-a')).toBeUndefined();
    // pmtiles then re-reads the header: from the network, as the new version.
    expect((await cached.getBytes(0, 16 * KB)).etag).toBe('"v2"');
  });
});

describe('cachingRangeReader', () => {
  it('opens a pack again with no requests', async () => {
    const { bytes, manifest } = await createPack(
      [...sampleFiles(), { path: 'models/big.glb', bytes: noise(300 * KB, 3) }],
      { id: 'example.pack', version: '1.0.0' },
    );
    const store = createMemoryByteStore();
    const archive = { key: manifest.contentHash, url: 'https://packs.example/p.zip' };

    const first = recordingReader(bytes);
    const cache = createBlockCache(store);
    const pack = await openPack(cachingRangeReader(first, cache, archive, { wholeBelow: 0 }), {
      expect: { contentHash: manifest.contentHash },
    });
    expect(await pack.readJson('types/aircraft.types.json')).toEqual({ b: 'two' });
    expect(new Uint8Array(await pack.readBytes('models/big.glb'))).toEqual(noise(300 * KB, 3));
    expect(first.reads.length).toBeGreaterThan(0);
    await cache.flush();

    const second = recordingReader(bytes);
    const reopened = await openPack(
      cachingRangeReader(second, createBlockCache(store), archive, { wholeBelow: 0 }),
      { expect: { contentHash: manifest.contentHash } },
    );
    expect(await reopened.readJson('types/aircraft.types.json')).toEqual({ b: 'two' });
    expect(new Uint8Array(await reopened.readBytes('models/big.glb'))).toEqual(noise(300 * KB, 3));
    expect(second.reads).toHaveLength(0);
  });

  it('fetches a small archive whole on the first read', async () => {
    const { bytes, manifest } = await createPack(sampleFiles(), {
      id: 'example.small',
      version: '1.0.0',
    });
    const reader = recordingReader(bytes);
    const cache = createBlockCache(createMemoryByteStore());
    const pack = await openPack(
      cachingRangeReader(reader, cache, { key: manifest.contentHash, url: 'p.zip' }),
    );
    await pack.readBytes('models/roadster/model.glb');
    await pack.readBytes('NOTICE.md');
    expect(reader.reads).toEqual([{ offset: 0, length: bytes.length }]);
  });
});

describe('urlRangeReader', () => {
  it('reads ranges of a URL of known size with no opening request', async () => {
    const bytes = noise(100 * KB, 4);
    const { state, fetcher } = fakeServer(bytes, { etag: '"e1"' });
    const reader = urlRangeReader('https://packs.example/p.zip', {
      size: bytes.length,
      fetch: fetcher,
    });
    expect(state.requests).toHaveLength(0);
    expect(await reader.read(10, 20)).toEqual(bytes.subarray(10, 30));
    expect(await reader.read(50 * KB, KB)).toEqual(bytes.subarray(50 * KB, 51 * KB));
    // The first response's ETag validates every later read.
    expect(state.requests).toEqual([
      { range: 'bytes=10-29' },
      { range: `bytes=${50 * KB}-${51 * KB - 1}`, ifRange: '"e1"' },
    ]);
  });

  it('fails with PackChangedError when the file is replaced mid-read', async () => {
    const bytes = noise(100 * KB, 5);
    const { state, fetcher } = fakeServer(bytes, { etag: '"e1"' });
    const reader = urlRangeReader('https://packs.example/p.zip', {
      size: bytes.length,
      fetch: fetcher,
    });
    await reader.read(0, 10);
    state.etag = '"e2"';
    await expect(reader.read(10, 10)).rejects.toBeInstanceOf(PackChangedError);
  });

  it('caches through cachingRangeReader and drops the archive when it changes', async () => {
    const bytes = noise(200 * KB, 6);
    const { state, fetcher } = fakeServer(bytes, { etag: '"e1"' });
    const store = createMemoryByteStore();
    const cache = createBlockCache(store);
    const reader = cachingRangeReader(
      urlRangeReader('https://packs.example/p.zip', { size: bytes.length, fetch: fetcher }),
      cache,
      { key: 'sha256:p', url: 'https://packs.example/p.zip' },
      { wholeBelow: 0 },
    );
    await reader.read(0, 10);
    await reader.read(0, 10);
    expect(state.requests).toHaveLength(1);
    await cache.flush();
    state.etag = '"e2"';
    await expect(reader.read(150 * KB, 10)).rejects.toBeInstanceOf(PackChangedError);
    expect(await store.getArchive('sha256:p')).toBeUndefined();
  });
});

/** A fetch serving one JSON document with ETag / If-None-Match, like a static host. */
function documentServer(initial: unknown) {
  const state = {
    body: JSON.stringify(initial),
    etag: '"d1"',
    offline: false,
    status: 200,
    requests: [] as { ifNoneMatch?: string }[],
  };
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const ifNoneMatch = new Headers(init?.headers).get('if-none-match') ?? undefined;
    state.requests.push(ifNoneMatch !== undefined ? { ifNoneMatch } : {});
    if (state.offline) throw new TypeError('Failed to fetch');
    if (state.status !== 200) return new Response(null, { status: state.status });
    if (ifNoneMatch === state.etag) return new Response(null, { status: 304 });
    return new Response(state.body, {
      status: 200,
      headers: { 'content-type': 'application/json', etag: state.etag },
    });
  }) as typeof fetch;
  return { state, fetcher };
}

describe('cachingDocumentFetch', () => {
  const URL_ = 'https://example.test/index.json';

  it('stores a document and revalidates it with If-None-Match', async () => {
    const { state, fetcher } = documentServer({ v: 1 });
    const store = createMemoryByteStore();
    const cached = cachingDocumentFetch(store, fetcher);
    const first = await cached(URL_);
    expect(await first.json()).toEqual({ v: 1 });
    expect(first.headers.get(DOCUMENT_CACHE_HEADER)).toBe('network');
    const second = await cached(URL_);
    expect(await second.json()).toEqual({ v: 1 });
    expect(second.headers.get(DOCUMENT_CACHE_HEADER)).toBe('revalidated');
    expect(state.requests).toEqual([{}, { ifNoneMatch: '"d1"' }]);

    state.body = JSON.stringify({ v: 2 });
    state.etag = '"d2"';
    expect(await (await cached(URL_)).json()).toEqual({ v: 2 });
    expect(await (await cached(URL_)).json()).toEqual({ v: 2 });
    expect(state.requests.at(-1)).toEqual({ ifNoneMatch: '"d2"' });
  });

  it('serves a fresh copy without a request, and a stale one when offline', async () => {
    let clock = 0;
    const { state, fetcher } = documentServer({ v: 1 });
    const cached = cachingDocumentFetch(createMemoryByteStore(), fetcher, {
      maxAgeMs: 1000,
      now: () => clock,
    });
    await cached(URL_);
    clock = 500;
    expect((await cached(URL_)).headers.get(DOCUMENT_CACHE_HEADER)).toBe('hit');
    expect(state.requests).toHaveLength(1);
    clock = 5000;
    state.offline = true;
    const offline = await cached(URL_);
    expect(offline.headers.get(DOCUMENT_CACHE_HEADER)).toBe('stale');
    expect(await offline.json()).toEqual({ v: 1 });
  });

  it('serves the stored copy when the server is slow, and refreshes it later', async () => {
    const { fetcher: fast } = documentServer({ v: 1 });
    const store = createMemoryByteStore();
    await cachingDocumentFetch(store, fast)(URL_);
    let release: () => void = () => undefined;
    const slow = (async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return new Response(JSON.stringify({ v: 2 }), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"d2"' },
      });
    }) as typeof fetch;
    const response = await cachingDocumentFetch(store, slow, { timeoutMs: 20 })(URL_);
    expect(response.headers.get(DOCUMENT_CACHE_HEADER)).toBe('stale');
    expect(await response.json()).toEqual({ v: 1 });
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((await store.getArchive(`doc:${URL_}`))?.etag).toBe('"d2"');
  });

  it('passes other requests through and forgets a deleted document', async () => {
    const { state, fetcher } = documentServer({ v: 1 });
    const store = createMemoryByteStore();
    const cached = cachingDocumentFetch(store, fetcher);
    await cached(URL_, { method: 'HEAD' });
    await cached(URL_, { headers: { Range: 'bytes=0-1' } });
    await cached(URL_, { cache: 'no-store' });
    expect(await store.getArchive(`doc:${URL_}`)).toBeUndefined();
    expect(state.requests).toHaveLength(3);
    await cached(URL_);
    expect(await store.getArchive(`doc:${URL_}`)).toBeDefined();
    state.status = 404;
    expect((await cached(URL_)).status).toBe(404);
    expect(await store.getArchive(`doc:${URL_}`)).toBeUndefined();
  });

  it('does not cache a failed first fetch', async () => {
    const { state, fetcher } = documentServer({ v: 1 });
    state.offline = true;
    const cached = cachingDocumentFetch(createMemoryByteStore(), fetcher);
    await expect(cached(URL_)).rejects.toThrow('Failed to fetch');
  });
});

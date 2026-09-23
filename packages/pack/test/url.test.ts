import { describe, expect, it } from 'vitest';
import { createPack } from '../src/build';
import { openPack } from '../src/pack';
import { PackChangedError } from '../src/source';
import { noise, sampleFiles } from './helpers';

interface ServerOptions {
  /** Honour Range headers (default true). */
  ranges?: boolean;
  /** Let the client read Content-Range (default true); cross-origin servers often hide it. */
  exposeRange?: boolean;
  etag?: string;
  /** Answer this many requests with 503 first. */
  failures?: number;
  status?: number;
}

/** A fetch that serves one file the way a static host would. */
function fakeServer(initial: Uint8Array, options: ServerOptions = {}) {
  const state = {
    bytes: initial,
    etag: options.etag,
    failures: options.failures ?? 0,
    requests: [] as { range?: string; ifRange?: string }[],
  };
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const range = headers.get('range') ?? undefined;
    const ifRange = headers.get('if-range') ?? undefined;
    state.requests.push({
      ...(range !== undefined ? { range } : {}),
      ...(ifRange !== undefined ? { ifRange } : {}),
    });
    if (options.status !== undefined) return new Response(null, { status: options.status });
    if (state.failures > 0) {
      state.failures--;
      return new Response(null, { status: 503 });
    }
    const out = new Headers();
    if (state.etag !== undefined) out.set('etag', state.etag);
    const stale = ifRange !== undefined && ifRange !== state.etag;
    if (range === undefined || options.ranges === false || stale) {
      return new Response(state.bytes.slice(), { status: 200, headers: out });
    }
    const size = state.bytes.length;
    const [, from, to] = /bytes=(\d*)-(\d*)/.exec(range) ?? [];
    const start = from === '' ? Math.max(0, size - Number(to)) : Number(from);
    const end = from === '' ? size - 1 : Math.min(size - 1, Number(to));
    if (options.exposeRange !== false) out.set('content-range', `bytes ${start}-${end}/${size}`);
    return new Response(state.bytes.slice(start, end + 1), { status: 206, headers: out });
  }) as typeof fetch;
  return { state, fetcher };
}

const OPTIONS = { id: 'example.vehicles', version: '1.0.0' };
const LARGE = [
  { path: 'models/b.glb', bytes: noise(1_000, 12) },
  { path: 'models/c.glb', bytes: noise(1_000, 13) },
  { path: 'models/z.glb', bytes: noise(150_000, 11) },
];

describe('openPack(url)', () => {
  it('opens with one tail request and reads the rest with ranges', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    for (const exposeRange of [true, false]) {
      const { state, fetcher } = fakeServer(bytes, { exposeRange });
      const progress: number[] = [];
      const pack = await openPack('https://packs.example/p.zip', {
        fetch: fetcher,
        onProgress: (p) => progress.push(p.requests),
      });
      expect(state.requests).toEqual([{ range: 'bytes=-65536' }]);
      // Everything in the tail (manifest, documents) needs no further request.
      expect(await pack.readJson('types/aircraft.types.json')).toEqual({ b: 'two' });
      await Promise.all([pack.readBytes('models/b.glb'), pack.readBytes('models/c.glb')]);
      expect(state.requests).toHaveLength(2);
      expect(new Uint8Array(await pack.readBytes('models/z.glb'))).toEqual(noise(150_000, 11));
      expect(state.requests).toHaveLength(3);
      expect(progress).toEqual([1, 2, 3]);
    }
  });

  it('uses the whole file when the server ignores Range', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    const { state, fetcher } = fakeServer(bytes, { ranges: false });
    const pack = await openPack('https://packs.example/p.zip', { fetch: fetcher });
    expect(new Uint8Array(await pack.readBytes('models/z.glb'))).toEqual(noise(150_000, 11));
    expect(new Uint8Array(await pack.readBytes('models/b.glb'))).toEqual(noise(1_000, 12));
    expect(state.requests).toHaveLength(1);
  });

  it('downloads small packs in one plain request when their size is known', async () => {
    const { bytes } = await createPack(sampleFiles(), OPTIONS);
    const { state, fetcher } = fakeServer(bytes);
    const pack = await openPack('https://packs.example/p.zip', {
      fetch: fetcher,
      sizeHint: bytes.length,
    });
    expect(state.requests).toEqual([{}]);
    expect(await pack.readText('NOTICE.md')).toContain('Example');
  });

  it('retries transient failures and gives up on permanent ones', async () => {
    const { bytes } = await createPack(sampleFiles(), OPTIONS);
    const flaky = fakeServer(bytes, { failures: 2 });
    const retry = { baseDelayMs: 1 };
    await expect(
      openPack('https://packs.example/p.zip', { fetch: flaky.fetcher, retry }),
    ).resolves.toBeDefined();
    expect(flaky.state.requests).toHaveLength(3);
    const missing = fakeServer(bytes, { status: 404 });
    await expect(
      openPack('https://packs.example/p.zip', { fetch: missing.fetcher, retry }),
    ).rejects.toThrow(/HTTP 404/);
    expect(missing.state.requests).toHaveLength(1);
  });

  it('detects a pack replaced on the server mid-read', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    const { state, fetcher } = fakeServer(bytes, { etag: '"v1"' });
    const pack = await openPack('https://packs.example/p.zip', { fetch: fetcher });
    state.etag = '"v2"';
    await expect(pack.readBytes('models/z.glb')).rejects.toBeInstanceOf(PackChangedError);
    expect(state.requests.at(-1)?.ifRange).toBe('"v1"');
  });
});

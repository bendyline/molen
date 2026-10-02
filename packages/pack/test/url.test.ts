import { describe, expect, it } from 'vitest';
import { createPack } from '../src/build';
import { openPack } from '../src/pack';
import { PackChangedError } from '../src/source';
import { fakeServer, noise, sampleFiles } from './helpers';

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

  it('repairs a suffix served as a prefix without downloading the entire large pack', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    const { state, fetcher } = fakeServer(bytes, { suffixAsPrefix: true, etag: 'W/"v1"' });
    const progress: number[] = [];
    const pack = await openPack('https://packs.example/p.zip', {
      fetch: fetcher,
      sizeHint: bytes.length,
      wholeThreshold: 65536,
      onProgress: (p) => progress.push(p.requests),
    });
    expect(state.requests).toEqual([
      { range: 'bytes=-65536' },
      { range: `bytes=${bytes.length - 65536}-${bytes.length - 1}` },
    ]);
    expect(await pack.readJson('types/aircraft.types.json')).toEqual({ b: 'two' });
    expect(new Uint8Array(await pack.readBytes('models/z.glb'))).toEqual(noise(150_000, 11));
    expect(state.requests).toHaveLength(3);
    expect(state.requests.every((request) => request.range !== undefined)).toBe(true);
    expect(progress).toEqual([1, 2, 3]);
    pack.close();
  });

  it('keeps the strong validator while repairing a misserved suffix', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    const { state, fetcher } = fakeServer(bytes, { suffixAsPrefix: true, etag: '"v1"' });
    const changing = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (state.requests.length === 1) state.etag = '"v2"';
      return fetcher(input, init);
    }) as typeof fetch;
    await expect(
      openPack('https://packs.example/p.zip', { fetch: changing }),
    ).rejects.toBeInstanceOf(PackChangedError);
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1]?.ifRange).toBe('"v1"');
  });

  it('rejects a later range at the wrong offset even when its byte count is correct', async () => {
    const { bytes } = await createPack([...sampleFiles(), ...LARGE], OPTIONS);
    const { state, fetcher } = fakeServer(bytes);
    const misaddressed = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetcher(input, init);
      if (state.requests.length > 1) {
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: 206,
          headers: { 'content-range': `bytes 1-${body.byteLength}/${bytes.length}` },
        });
      }
      return response;
    }) as typeof fetch;
    const pack = await openPack('https://packs.example/p.zip', { fetch: misaddressed });
    await expect(pack.readBytes('models/z.glb')).rejects.toThrow(/range .* was not honoured/);
    pack.close();
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

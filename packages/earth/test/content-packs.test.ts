import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPack, type Pack } from '@bendyline/molen-pack';
import { createBlockCache, createMemoryByteStore } from '@bendyline/molen-pack/cache';
import { describe, expect, it, vi } from 'vitest';
import { loadEarthContent, openPacksFromIndex } from '../src/client/content';

describe('Earth pack transport', () => {
  it('routes index, archive and later model ranges through the host fetch', async () => {
    const model = randomBytes(150_000);
    const { bytes, manifest } = await createPack(
      [
        { path: 'models/nearby.glb', bytes: model },
        { path: 'models/remote.glb', bytes: randomBytes(4 * 1024 * 1024) },
      ],
      { id: 'example.landmarks', version: '1.0.0' },
    );
    const indexUrl = 'https://host.example/packs/index.json';
    const archiveUrl = 'https://host.example/packs/landmarks.zip';
    const requests: { url: string; range: string | null }[] = [];
    let transferred = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const range = new Headers(init?.headers).get('range');
      requests.push({ url, range });
      if (url === indexUrl) {
        return Response.json({
          format: 'molen/pack-index@1',
          packs: {
            'example.landmarks': {
              file: 'landmarks.zip',
              size: bytes.length,
              version: '1.0.0',
              contentHash: manifest.contentHash,
            },
          },
        });
      }
      expect(url).toBe(archiveUrl);
      const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
      if (match === null) throw new Error('Large archive must use HTTP Range');
      const start = match[1] === '' ? bytes.length - Number(match[2]) : Number(match[1]);
      const end = match[1] === '' ? bytes.length - 1 : Number(match[2]);
      const body = bytes.slice(start, end + 1);
      transferred += body.length;
      return new Response(body, {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${end}/${bytes.length}` },
      });
    });
    const unexpectedFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Bypassed host'));
    let pack: Pack | undefined;
    try {
      [pack] = await openPacksFromIndex(indexUrl, ['example.landmarks'], fetchImpl);
      if (pack === undefined) throw new Error('Expected landmark pack');
      expect(requests).toEqual([
        { url: indexUrl, range: null },
        { url: archiveUrl, range: 'bytes=-65536' },
      ]);
      expect(new Uint8Array(await pack.readBytes('models/nearby.glb'))).toEqual(
        new Uint8Array(model),
      );
      expect(requests).toHaveLength(3);
      expect(requests[2]?.url).toBe(archiveUrl);
      expect(transferred).toBeLessThan(bytes.length / 10);
      expect(unexpectedFetch).not.toHaveBeenCalled();
    } finally {
      pack?.close();
      unexpectedFetch.mockRestore();
    }
  });
});

describe('Earth pack byte cache', () => {
  it('opens packs again from cached bytes, revalidating only the index', async () => {
    const model = randomBytes(300_000);
    const { bytes, manifest } = await createPack(
      [
        { path: 'models/a.glb', bytes: model },
        { path: 'models/b.glb', bytes: randomBytes(2 * 1024 * 1024) },
      ],
      { id: 'example.cached', version: '1.0.0' },
    );
    const indexUrl = 'https://host.example/packs/index.json';
    const index = {
      format: 'molen/pack-index@1',
      packs: {
        'example.cached': {
          file: 'cached-0123456789ab.zip',
          size: bytes.length,
          version: '1.0.0',
          contentHash: manifest.contentHash,
        },
      },
    };
    const requests: { url: string; range: string | null; ifNoneMatch: string | null }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const range = headers.get('range');
      requests.push({ url, range, ifNoneMatch: headers.get('if-none-match') });
      if (url === indexUrl) {
        if (headers.get('if-none-match') === '"i1"') return new Response(null, { status: 304 });
        return new Response(JSON.stringify(index), {
          headers: { 'content-type': 'application/json', etag: '"i1"' },
        });
      }
      const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '');
      if (match === null) throw new Error(`expected an explicit range, got ${range}`);
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), bytes.length - 1);
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${end}/${bytes.length}`, etag: '"z1"' },
      });
    }) as typeof fetch;
    const store = createMemoryByteStore();

    const cache = createBlockCache(store);
    const [first] = await openPacksFromIndex(indexUrl, ['example.cached'], fetchImpl, {
      byteCache: cache,
    });
    expect(new Uint8Array(await (first as Pack).readBytes('models/a.glb'))).toEqual(
      new Uint8Array(model),
    );
    first?.close();
    await cache.flush();
    const firstVisit = requests.length;
    expect(firstVisit).toBeGreaterThan(1);

    const [again] = await openPacksFromIndex(indexUrl, ['example.cached'], fetchImpl, {
      byteCache: createBlockCache(store),
    });
    expect(new Uint8Array(await (again as Pack).readBytes('models/a.glb'))).toEqual(
      new Uint8Array(model),
    );
    again?.close();
    // Only the index's revalidation went out (answered 304); every pack byte came from the cache.
    expect(requests.slice(firstVisit)).toEqual([
      { url: indexUrl, range: null, ifNoneMatch: '"i1"' },
    ]);
  });

  it('reads an unzipped pack file by file, then from the cache by content', async () => {
    const model = randomBytes(300_000);
    const doc = new TextEncoder().encode(JSON.stringify({ name: 'loose' }));
    const files = [
      { path: 'models/a.glb', bytes: model },
      { path: 'docs/a.json', bytes: doc },
    ];
    const zipped = (await createPack(files, { id: 'example.loose', version: '1.0.0' })).manifest;
    // The layout writeDirectoryPack produces: every file loose, the same contentHash.
    const manifest = {
      ...zipped,
      blocks: {},
      entries: Object.fromEntries(
        Object.entries(zipped.entries).map(([path, { block: _b, offset: _o, ...entry }]) => [
          path,
          entry,
        ]),
      ),
    };
    const base = 'https://cdn.example/_a/';
    const indexUrl = `${base}index.json`;
    const manifestPath = 'example.loose/0123456789ab/molen-pack.json';
    const served = new Map<string, Uint8Array>([
      [`${base}${manifestPath}`, new TextEncoder().encode(JSON.stringify(manifest))],
      ...files.map((f) => [`${base}example.loose/0123456789ab/${f.path}`, f.bytes] as const),
    ]);
    const index = {
      format: 'molen/pack-index@1',
      packs: {
        'example.loose': {
          file: manifestPath,
          size: (served.get(`${base}${manifestPath}`) as Uint8Array).length,
          version: '1.0.0',
          contentHash: manifest.contentHash,
        },
      },
    };
    const requests: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requests.push(`${url.slice(base.length)} ${headers.get('range') ?? ''}`.trim());
      const body =
        url === indexUrl ? new TextEncoder().encode(JSON.stringify(index)) : served.get(url);
      if (body === undefined) return new Response('missing', { status: 404 });
      const etag = `"${url.length}"`;
      if (headers.get('if-none-match') === etag) return new Response(null, { status: 304 });
      const match = /^bytes=(\d+)-(\d+)$/.exec(headers.get('range') ?? '');
      if (match === null) return new Response(body, { headers: { etag } });
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), body.length - 1);
      return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${end}/${body.length}`, etag },
      });
    }) as typeof fetch;
    const store = createMemoryByteStore();

    const cache = createBlockCache(store);
    const [first] = await openPacksFromIndex(indexUrl, ['example.loose'], fetchImpl, {
      byteCache: cache,
    });
    expect(new Uint8Array(await (first as Pack).readBytes('models/a.glb'))).toEqual(
      new Uint8Array(model),
    );
    expect(await (first as Pack).readJson('docs/a.json')).toEqual({ name: 'loose' });
    first?.close();
    await cache.flush();
    const firstVisit = requests.length;
    expect(requests).toContain('index.json');
    expect(requests).toContain(manifestPath);
    expect(requests.some((r) => r.startsWith('example.loose/0123456789ab/models/a.glb'))).toBe(
      true,
    );

    const [again] = await openPacksFromIndex(indexUrl, ['example.loose'], fetchImpl, {
      byteCache: createBlockCache(store),
    });
    expect(new Uint8Array(await (again as Pack).readBytes('models/a.glb'))).toEqual(
      new Uint8Array(model),
    );
    again?.close();
    // The index and manifest revalidate (304); no file is fetched again.
    expect(requests.slice(firstVisit)).toEqual(['index.json', manifestPath]);
  });
});

describe('Earth structure catalogs', () => {
  it('merges geographic and category catalogs without fetching any model bytes', async () => {
    const binaryRead = vi.fn(async () => {
      throw new Error('Models must load on demand');
    });
    const fakePack = (id: string, folder: string, provides: Record<string, string[]>): Pack =>
      ({
        manifest: { id, version: '0.0.1', provides },
        readJson: async (path: string) =>
          JSON.parse(
            await readFile(new URL(`../../../content/${folder}/${path}`, import.meta.url), 'utf8'),
          ),
        readBytes: binaryRead,
      }) as unknown as Pack;
    const style = fakePack('molen.worldgen.default', 'worldgen', {
      stylepack: ['stylepack.json'],
      landmarks: ['landmarks/catalog.json'],
    });
    const earth = fakePack('molen.earth', 'earth', {
      atlas: ['world.atlas.json'],
      businesses: ['businesses/catalog.json'],
      structures: ['structures/placements.json', 'structures/map-rules.json'],
    });
    const content = await loadEarthContent([style, earth]);
    expect(content.worldgenError).toBeUndefined();
    expect(content.worldgen?.structures.entries.some((entry) => entry.title.includes('520'))).toBe(
      true,
    );
    expect(
      content.worldgen?.structures.rules.some((rule) => rule.asset.endsWith('map_smock_windmill')),
    ).toBe(true);
    expect(binaryRead).not.toHaveBeenCalled();
  });
});

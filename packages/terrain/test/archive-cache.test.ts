import { createBlockCache, createMemoryByteStore } from '@bendyline/molen-pack/cache';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import { cachingArchiveOpener } from '../src/archive-cache';
import type { TerrainArchiveSetDescriptor } from '../src/archive-set';
import { createTerrainArchiveSetArchive } from '../src/archive-set-client';
import {
  openTerrainPackageArchive,
  openTerrainPackageSemantics,
  terrainPackageArchiveEntry,
} from '../src/package-client';
import type {
  TerrainArchiveEntryInfo,
  TerrainPackageDescriptor,
  TerrainSemanticTileDecoder,
  TerrainTileArchive,
} from '../src/package-types';
import { writePmtilesArchive } from '../src/pmtiles-writer';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A Source over bytes that counts its reads. */
class CountingSource implements Source {
  reads = 0;
  constructor(
    private readonly key: string,
    private readonly bytes: Uint8Array,
  ) {}
  getKey(): string {
    return this.key;
  }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    this.reads++;
    return { data: this.bytes.slice(offset, offset + length).buffer, etag: '"v1"' };
  }
}

function archiveBytes(label: string, z: number): Uint8Array {
  const tiles = [];
  for (let y = 0; y < 2 ** z; y++) {
    for (let x = 0; x < 2 ** z; x++) tiles.push({ z, x, y, data: text(`${label} ${z}/${x}/${y}`) });
  }
  return writePmtilesArchive(tiles, { tileType: 'mvt', bounds: [-180, -85, 180, 85] });
}

async function tileText(archive: TerrainTileArchive, z: number, x: number, y: number) {
  const tile = await archive.getZxy(z, x, y);
  return tile === undefined ? undefined : new TextDecoder().decode(tile.data);
}

const SET: TerrainArchiveSetDescriptor = {
  format: 'molen/archive-set@1',
  name: 'unit',
  tileType: 'mvt',
  partitionLevel: 1,
  base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 0, sha256: 'b0', bytes: 1234 },
  archives: [{ id: 'all', url: 'all.pmtiles', minLevel: 1, maxLevel: 1, partitions: '0-3' }],
};

describe('archive-set openArchive entries', () => {
  it('passes each member its listed hash and size', async () => {
    const seen: Array<[string, TerrainArchiveEntryInfo | undefined]> = [];
    const bytes = { base: archiveBytes('base', 0), all: archiveBytes('all', 1) };
    const archive = createTerrainArchiveSetArchive(SET, {
      baseUrl: 'https://tiles.example/set.json',
      openArchive: (_url, id, entry) => {
        seen.push([id, entry]);
        return new PMTiles(new CountingSource(id, id === 'base' ? bytes.base : bytes.all));
      },
    });
    await archive.getZxy(0, 0, 0);
    await archive.getZxy(1, 1, 1);
    expect(seen).toEqual([
      ['base', { sha256: 'b0', bytes: 1234 }],
      ['all', {}],
    ]);
  });
});

describe('cachingArchiveOpener', () => {
  it('reads an archive opened again from the cache', async () => {
    const bytes = archiveBytes('world', 1);
    const cache = createBlockCache(createMemoryByteStore());
    const sources: CountingSource[] = [];
    const open = cachingArchiveOpener(cache, {
      source: () => {
        const source = new CountingSource('https://tiles.example/w.pmtiles', bytes);
        sources.push(source);
        return source;
      },
    });
    const first = open('https://tiles.example/w.pmtiles', 'w', { sha256: 'abc' });
    expect(await tileText(first, 1, 1, 0)).toBe('world 1/1/0');
    expect(sources[0]?.reads).toBe(1);
    await cache.flush();
    expect(cache.stats().storeArchives).toBe(1);

    // A fresh reader (a new page, or an archive the set's LRU closed) reads nothing.
    const second = open('https://tiles.example/w.pmtiles', 'w', { sha256: 'abc' });
    expect(await tileText(second, 1, 0, 1)).toBe('world 1/0/1');
    expect(await tileText(second, 1, 1, 1)).toBe('world 1/1/1');
    expect(sources[1]?.reads).toBe(0);
  });

  it('keys by the listed hash, or reads uncached when keyFor says so', async () => {
    const bytes = archiveBytes('world', 0);
    const cache = createBlockCache(createMemoryByteStore());
    const keys: string[] = [];
    const open = cachingArchiveOpener(cache, {
      source: () => new CountingSource('u', bytes),
      keyFor: (url, _id, entry) => {
        const key = entry?.sha256 !== undefined ? `sha256:${entry.sha256}` : undefined;
        keys.push(key ?? `uncached ${url}`);
        return key;
      },
      priority: 'low',
    });
    await tileText(open('https://a/x.pmtiles', 'x', { sha256: 'ff' }), 0, 0, 0);
    await tileText(open('https://a/y.pmtiles', 'y'), 0, 0, 0);
    await cache.flush();
    expect(keys).toEqual(['sha256:ff', 'uncached https://a/y.pmtiles']);
    expect(await cache.store.getArchive('sha256:ff')).toMatchObject({ priority: 'low' });
    expect(cache.stats().storeArchives).toBe(1);
  });
});

describe('package archive transports', () => {
  const pkg = (
    sources: Partial<Record<'elevation' | 'features', unknown>>,
  ): TerrainPackageDescriptor =>
    ({
      format: 'molen/terrain-package@1',
      name: 'unit',
      version: '1',
      coordinateSpace: {
        kind: 'geospatial',
        crs: 'EPSG:3857',
        ellipsoid: 'WGS84',
        bounds: [-180, -85.0511287798066, 180, 85.0511287798066],
      },
      tileMatrix: { scheme: 'xyz', minLevel: 0, maxLevel: 1, rootTiles: [1, 1], tileResolution: 3 },
      elevation: {
        source: sources.elevation ?? { kind: 'pmtiles', path: 'elevation.pmtiles' },
        encoding: 'png16',
        height: { min: 0, max: 1 },
      },
      ...(sources.features !== undefined
        ? {
            features: {
              source: sources.features,
              encoding: 'mvt',
              profile: 'protomaps-basemap@1',
              layers: ['building'],
              buildingDetail: {
                source: { kind: 'pmtiles', url: 'https://tiles.example/hd.pmtiles' },
                level: 1,
              },
            },
          }
        : {}),
      attribution: [{ text: 'Test', license: 'CC0-1.0' }],
      provenance: { compiler: 'test', compilerVersion: '1', sources: [{ id: 't', release: '1' }] },
      files: [{ path: 'elevation.pmtiles', sha256: 'e1', bytes: 99 }],
    }) as TerrainPackageDescriptor;

  it('reports the files record of a package-relative archive', () => {
    const descriptor = pkg({});
    expect(terrainPackageArchiveEntry(descriptor, descriptor.elevation.source)).toEqual({
      sha256: 'e1',
      bytes: 99,
    });
    expect(
      terrainPackageArchiveEntry(descriptor, { kind: 'pmtiles', url: 'https://x/e.pmtiles' }),
    ).toBeUndefined();
  });

  it('opens single archives and archive sets through the transport', async () => {
    const calls: Array<[string, string, TerrainArchiveEntryInfo | undefined]> = [];
    const openArchive = (url: string, id: string, entry?: TerrainArchiveEntryInfo) => {
      calls.push([url, id, entry]);
      return new PMTiles(new CountingSource(url, archiveBytes('a', 0)));
    };
    const single = openTerrainPackageArchive(
      { kind: 'pmtiles', path: 'elevation.pmtiles' },
      'https://pkg.example/v1/terrain-package.json',
      { openArchive, id: 'elevation', entry: { sha256: 'e1' } },
    );
    expect(await tileText(single, 0, 0, 0)).toBe('a 0/0/0');
    let documents = 0;
    const set = openTerrainPackageArchive(
      { kind: 'pmtiles-set', url: 'https://pkg.example/set.json' },
      undefined,
      {
        openArchive,
        fetch: (async () => {
          documents++;
          return Response.json(SET);
        }) as typeof fetch,
      },
    );
    await set.getZxy(0, 0, 0);
    expect(documents).toBe(1);
    expect(calls).toEqual([
      ['https://pkg.example/v1/elevation.pmtiles', 'elevation', { sha256: 'e1' }],
      ['https://pkg.example/base.pmtiles', 'base', { sha256: 'b0', bytes: 1234 }],
    ]);
  });

  it('names each semantic sidecar and lets building detail use its own transport', async () => {
    const ids: string[] = [];
    const detailIds: string[] = [];
    const archive = (url: string) => new PMTiles(new CountingSource(url, archiveBytes('f', 1)));
    const decoder: TerrainSemanticTileDecoder = {
      decode: async () => ({ format: 'molen/terrain-semantic-tile@1', layers: [] }) as never,
    };
    const semantics = await openTerrainPackageSemantics(
      pkg({ features: { kind: 'pmtiles', url: 'https://tiles.example/f.pmtiles' } }),
      {
        decoder,
        transport: {
          openArchive: (url, id) => {
            ids.push(id);
            return archive(url);
          },
        },
        buildingDetailTransport: {
          openArchive: (url, id) => {
            detailIds.push(id);
            return archive(url);
          },
        },
      },
    );
    expect(semantics.features).toBeDefined();
    expect(semantics.buildingDetailError).toBeUndefined();
    expect(ids).toEqual(['features']);
    expect(detailIds).toEqual(['building-detail']);
  });
});

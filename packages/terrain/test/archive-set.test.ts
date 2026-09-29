import { createServer } from 'node:http';
import { validate } from '@bendyline/molen-schema';
import { PMTiles, type RangeResponse, type Source, TileType } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import {
  createTerrainArchiveSetRouter,
  encodeTerrainArchiveSetPartitions,
  parseTerrainArchiveSetPartitions,
  type TerrainArchiveSetDescriptor,
} from '../src/archive-set';
import { createTerrainArchiveSetArchive } from '../src/archive-set-client';
import { openTerrainPackagePyramid } from '../src/package-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from '../src/package-types';
import { writePmtilesArchive } from '../src/pmtiles-writer';
import { encodePng16 } from '../src/png16';
import { registerTerrainSchemas } from '../src/schema';

registerTerrainSchemas();

class MemorySource implements Source {
  constructor(
    private readonly key: string,
    private readonly bytes: Uint8Array,
  ) {}

  getKey(): string {
    return this.key;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return { data: this.bytes.slice(offset, offset + length).buffer };
  }
}

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A 2-level world split at level 1: base holds level 0, two archives hold level 1-2 quadrants. */
function worldSet(): TerrainArchiveSetDescriptor {
  return {
    format: 'molen/archive-set@1',
    name: 'unit-world',
    tileType: 'mvt',
    partitionLevel: 1,
    base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 0 },
    archives: [
      // Partition cells at level 1 are y * 2 + x: west column (0, 2) and east column (1, 3).
      { id: 'west', url: 'build/west.pmtiles', minLevel: 1, maxLevel: 2, partitions: '0,2' },
      { id: 'east', url: 'build/east.pmtiles', minLevel: 1, maxLevel: 2, partitions: '1,3' },
    ],
  };
}

function archiveBytes(label: string, levels: number[], columns: (x: number, z: number) => boolean) {
  const tiles = [];
  for (const z of levels) {
    for (let y = 0; y < 2 ** z; y++) {
      for (let x = 0; x < 2 ** z; x++) {
        if (columns(x, z)) tiles.push({ z, x, y, data: text(`${label} ${z}/${x}/${y}`) });
      }
    }
  }
  return writePmtilesArchive(tiles, { tileType: 'mvt', bounds: [-180, -85, 180, 85] });
}

const memberBytes: Record<string, Uint8Array> = {
  base: archiveBytes('base', [0], () => true),
  west: archiveBytes('west', [1, 2], (x, z) => x < 2 ** (z - 1)),
  east: archiveBytes('east', [1, 2], (x, z) => x >= 2 ** (z - 1)),
};

async function tileText(archive: TerrainTileArchive, z: number, x: number, y: number) {
  const tile = await archive.getZxy(z, x, y);
  return tile === undefined ? undefined : new TextDecoder().decode(tile.data);
}

describe('archive-set partitions and routing', () => {
  it('round-trips run-length partition lists', () => {
    expect(parseTerrainArchiveSetPartitions('3-5,9, 12')).toEqual([3, 4, 5, 9, 12]);
    expect(parseTerrainArchiveSetPartitions('')).toEqual([]);
    expect(encodeTerrainArchiveSetPartitions([9, 3, 5, 4, 12, 4])).toBe('3-5,9,12');
    expect(() => parseTerrainArchiveSetPartitions('5-3')).toThrow(/end before start/);
    expect(() => parseTerrainArchiveSetPartitions('a')).toThrow(/invalid partition/);
  });

  it('routes coarse levels to the base and detail tiles to their partition owner', () => {
    const router = createTerrainArchiveSetRouter(worldSet());
    expect([router.minLevel, router.maxLevel]).toEqual([0, 2]);
    expect(router.resolve(0, 0, 0)).toMatchObject({ kind: 'base' });
    expect(router.resolve(1, 0, 1)).toMatchObject({ kind: 'archive', entry: { id: 'west' } });
    expect(router.resolve(2, 3, 0)).toMatchObject({ kind: 'archive', entry: { id: 'east' } });
    expect(router.resolve(2, 1, 3)).toMatchObject({ kind: 'archive', entry: { id: 'west' } });
    // Finer than any archive, and outside the grid, resolve to nothing.
    expect(router.resolve(3, 0, 0)).toBeUndefined();
    expect(router.resolve(2, 4, 0)).toBeUndefined();
  });

  it('leaves unowned cells uncovered and rejects double-claimed cells', () => {
    const sparse = { ...worldSet(), archives: [{ ...worldSet().archives[0]!, partitions: '0' }] };
    expect(createTerrainArchiveSetRouter(sparse).resolve(1, 0, 1)).toBeUndefined();
    const overlapping = {
      ...worldSet(),
      archives: [worldSet().archives[0]!, { ...worldSet().archives[1]!, partitions: '1-2' }],
    };
    expect(() => createTerrainArchiveSetRouter(overlapping)).toThrow(/claimed by both/);
  });

  it('validates as molen/archive-set@1 and reports overlaps and level errors', () => {
    expect(validate('archive-set' as never, worldSet()).ok).toBe(true);
    const bad = validate('archive-set' as never, {
      ...worldSet(),
      base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 1 },
      archives: [
        { id: 'a', url: 'a.pmtiles', minLevel: 1, maxLevel: 2, partitions: '0-2' },
        { id: 'a', url: 'b.pmtiles', minLevel: 1, maxLevel: 2, partitions: '2,9' },
      ],
    });
    expect(bad.ok).toBe(false);
    const codes = bad.ok ? [] : bad.issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining(['duplicate_id', 'base_overlap', 'partition_overlap']),
    );
  });
});

describe('archive-set archive', () => {
  it('opens members lazily, routes tiles, and reports a combined header', async () => {
    const opened: string[] = [];
    const archive = createTerrainArchiveSetArchive(worldSet(), {
      baseUrl: 'https://tiles.example/world/set.json',
      openArchive: (url, id) => {
        opened.push(url);
        return new PMTiles(new MemorySource(id, memberBytes[id]!));
      },
    });

    expect(await archive.getHeader()).toEqual({ minZoom: 0, maxZoom: 2, tileType: TileType.Mvt });
    expect(opened).toEqual([]);
    expect(await tileText(archive, 0, 0, 0)).toBe('base 0/0/0');
    expect(await tileText(archive, 2, 3, 2)).toBe('east 2/3/2');
    expect(await tileText(archive, 1, 0, 1)).toBe('west 1/0/1');
    expect(await tileText(archive, 3, 0, 0)).toBeUndefined();
    expect(opened).toEqual([
      'https://tiles.example/world/base.pmtiles',
      'https://tiles.example/world/build/east.pmtiles',
      'https://tiles.example/world/build/west.pmtiles',
    ]);
    expect(archive.openArchiveIds()).toEqual(['base', 'east', 'west']);
  });

  it('keeps at most maxOpenArchives members open, least recently used first out', async () => {
    const archive = createTerrainArchiveSetArchive(worldSet(), {
      baseUrl: 'https://tiles.example/set.json',
      maxOpenArchives: 2,
      openArchive: (_url, id) => new PMTiles(new MemorySource(id, memberBytes[id]!)),
    });
    await archive.getZxy(1, 0, 0);
    await archive.getZxy(1, 1, 0);
    await archive.getZxy(1, 0, 0);
    await archive.getZxy(0, 0, 0);
    expect(archive.openArchiveIds()).toEqual(['west', 'base']);
  });

  it('refuses relative member URLs without a base and non-archive-set documents', async () => {
    const archive = createTerrainArchiveSetArchive(worldSet(), {
      openArchive: () => {
        throw new Error('unreachable');
      },
    });
    await expect(archive.getZxy(0, 0, 0)).rejects.toThrow(/pass baseUrl/);
    const wrong = createTerrainArchiveSetArchive('https://tiles.example/set.json', {
      fetch: (async () => Response.json({ format: 'molen/terrain@2' })) as typeof fetch,
    });
    await expect(wrong.getHeader()).rejects.toThrow(/molen\/archive-set@1/);
  });

  it('streams a package whose elevation is an archive set over HTTP ranges', async () => {
    const png = (normalized: number) =>
      encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(normalized) });
    const files: Record<string, Uint8Array> = {
      '/set/base.pmtiles': writePmtilesArchive([{ z: 0, x: 0, y: 0, data: png(0.25) }], {
        tileType: 'png',
        bounds: [-180, -85, 180, 85],
      }),
      '/set/detail/west.pmtiles': writePmtilesArchive([{ z: 1, x: 0, y: 1, data: png(0.75) }], {
        tileType: 'png',
        bounds: [-180, -85, 0, 0],
      }),
    };
    const setDocument: TerrainArchiveSetDescriptor = {
      format: 'molen/archive-set@1',
      name: 'unit-elevation',
      tileType: 'png',
      partitionLevel: 1,
      base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 0 },
      archives: [
        { id: 'west', url: 'detail/west.pmtiles', minLevel: 1, maxLevel: 1, partitions: '2' },
      ],
    };
    const server = createServer((request, response) => {
      if (request.url === '/set/archive-set.json') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(setDocument));
        return;
      }
      const body = files[request.url ?? ''];
      const match = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? '');
      if (body === undefined || match === null) {
        response.writeHead(404).end();
        return;
      }
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), body.byteLength - 1);
      response
        .writeHead(206, {
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${body.byteLength}`,
        })
        .end(body.subarray(start, end + 1));
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (address === null || typeof address === 'string') throw new Error('no test port');
      const pkg: TerrainPackageDescriptor = {
        format: 'molen/terrain-package@1',
        name: 'set-elevation',
        version: '1',
        coordinateSpace: {
          kind: 'geospatial',
          crs: 'EPSG:3857',
          ellipsoid: 'WGS84',
          bounds: [-180, -85.0511287798066, 180, 85.0511287798066],
        },
        tileMatrix: {
          scheme: 'xyz',
          minLevel: 0,
          maxLevel: 1,
          rootTiles: [1, 1],
          tileResolution: 3,
        },
        elevation: {
          source: {
            kind: 'pmtiles-set',
            url: `http://127.0.0.1:${address.port}/set/archive-set.json`,
          },
          encoding: 'png16',
          height: { min: -100, max: 900 },
        },
        attribution: [{ text: 'Test', license: 'CC0-1.0' }],
        provenance: {
          compiler: 'test',
          compilerVersion: '1',
          sources: [{ id: 't', release: '1' }],
        },
        files: [],
      };
      expect(validate('terrain-package' as never, pkg).ok).toBe(true);

      const opened = await openTerrainPackagePyramid(pkg);
      const signal = new AbortController().signal;
      const coarse = await opened.source.load({ level: 0, x: 0, z: 0 }, signal);
      const detail = await opened.source.load({ level: 1, x: 0, z: 1 }, signal);
      // The eastern level-1 cell has no archive: parent fallback crops the base tile.
      const fallback = await opened.source.load({ level: 1, x: 1, z: 0 }, signal);
      const center = (tile: typeof coarse) =>
        tile!.sampleHeight(
          tile!.origin[0] + tile!.worldSize[0] / 2,
          tile!.origin[1] + tile!.worldSize[1] / 2,
        );
      expect(center(coarse)).toBeCloseTo(150, 0);
      expect(center(detail)).toBeCloseTo(650, 0);
      expect(center(fallback)).toBeCloseTo(150, 0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

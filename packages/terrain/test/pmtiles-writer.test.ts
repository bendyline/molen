import { gzipSync } from 'fflate';
import { Compression, PMTiles, type RangeResponse, type Source, TileType } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import {
  buildPmtilesDirectories,
  createPmtilesPrefix,
  PMTILES_HEADER_BYTES,
  type PmtilesWriterTile,
  pmtilesTileId,
  writePmtilesArchive,
} from '../src/pmtiles-writer';

class MemorySource implements Source {
  constructor(private readonly bytes: Uint8Array) {}

  getKey(): string {
    return 'memory';
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return { data: this.bytes.slice(offset, offset + length).buffer };
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function payload(z: number, x: number, y: number): Uint8Array {
  return encoder.encode(`tile ${z}/${x}/${y}`);
}

function everyTile(levels: readonly number[]): PmtilesWriterTile[] {
  const tiles: PmtilesWriterTile[] = [];
  for (const z of levels) {
    const count = 2 ** z;
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) tiles.push({ z, x, y, data: payload(z, x, y) });
    }
  }
  return tiles;
}

async function readTile(archive: PMTiles, z: number, x: number, y: number): Promise<string> {
  const tile = await archive.getZxy(z, x, y);
  if (tile === undefined) throw new Error(`missing ${z}/${x}/${y}`);
  return decoder.decode(tile.data);
}

describe('PMTiles writer', () => {
  it('writes a small archive with one root directory, metadata and header fields', async () => {
    const bytes = writePmtilesArchive(everyTile([0, 1, 2]).reverse(), {
      tileType: 'png',
      metadata: { name: 'unit' },
      bounds: [-10, -5, 10, 5],
    });
    const archive = new PMTiles(new MemorySource(bytes));
    const header = await archive.getHeader();

    expect(header.specVersion).toBe(3);
    expect(header.tileType).toBe(TileType.Png);
    expect(header.internalCompression).toBe(Compression.Gzip);
    expect(header.tileCompression).toBe(Compression.None);
    expect([header.minZoom, header.maxZoom]).toEqual([0, 2]);
    expect(header.numAddressedTiles).toBe(21);
    expect(header.leafDirectoryLength).toBe(0);
    expect([header.minLon, header.minLat, header.maxLon, header.maxLat]).toEqual([-10, -5, 10, 5]);
    expect(await archive.getMetadata()).toEqual({ name: 'unit' });
    expect(await readTile(archive, 2, 3, 1)).toBe('tile 2/3/1');
  });

  it('stays readable past the root-directory limit by writing leaf directories', async () => {
    // Levels 0-7 hold 21,845 tiles, far past what one root directory in 16 KiB can address.
    // Payloads really are gzip, as the header declares; the reader transparently inflates them.
    const tiles = everyTile([0, 1, 2, 3, 4, 5, 6, 7]).map((tile) => ({
      ...tile,
      data: gzipSync(tile.data),
    }));
    const bytes = writePmtilesArchive(tiles, {
      tileType: 'mvt',
      tileCompression: 'gzip',
      bounds: [-180, -85, 180, 85],
    });
    const archive = new PMTiles(new MemorySource(bytes));
    const header = await archive.getHeader();

    expect(header.numAddressedTiles).toBe(21_845);
    expect(header.leafDirectoryLength).toBeGreaterThan(0);
    expect(header.rootDirectoryOffset + header.rootDirectoryLength).toBeLessThanOrEqual(16_384);
    expect(header.tileType).toBe(TileType.Mvt);
    expect(header.tileCompression).toBe(Compression.Gzip);
    for (const [z, x, y] of [
      [0, 0, 0],
      [7, 0, 0],
      [7, 127, 127],
      [7, 20, 44],
      [6, 63, 1],
    ] as const) {
      expect(await readTile(archive, z, x, y)).toBe(`tile ${z}/${x}/${y}`);
    }
    expect(await archive.getZxy(8, 0, 0)).toBeUndefined();
  });

  it('streams: a prefix plus separately written tile data forms the same archive', async () => {
    const tiles = everyTile([3]).sort(
      (left, right) =>
        pmtilesTileId(left.z, left.x, left.y) - pmtilesTileId(right.z, right.x, right.y),
    );
    const records = tiles.map((tile) => ({
      tileId: pmtilesTileId(tile.z, tile.x, tile.y),
      byteLength: tile.data.byteLength,
    }));
    const dataLength = records.reduce((sum, record) => sum + record.byteLength, 0);
    const options = {
      tileType: 'png',
      bounds: [-180, -85, 180, 85],
      minZoom: 3,
      maxZoom: 3,
    } as const;
    const prefix = createPmtilesPrefix(records, dataLength, options);
    const streamed = new Uint8Array(prefix.byteLength + dataLength);
    streamed.set(prefix, 0);
    let offset = prefix.byteLength;
    for (const tile of tiles) {
      streamed.set(tile.data, offset);
      offset += tile.data.byteLength;
    }

    expect(streamed).toEqual(writePmtilesArchive(tiles, options));
    expect(await readTile(new PMTiles(new MemorySource(streamed)), 3, 5, 2)).toBe('tile 3/5/2');
  });

  it('grows leaves until a multi-million-entry root still fits the initial fetch', () => {
    const entries = Array.from({ length: 2_000_000 }, (_, index) => ({
      tileId: index * 3,
      offset: index * 70_000,
      length: 70_000,
      runLength: 1,
    }));
    const directories = buildPmtilesDirectories(entries);

    expect(directories.root.byteLength).toBeLessThanOrEqual(16_384 - PMTILES_HEADER_BYTES);
    expect(directories.leafDirectoryCount).toBeGreaterThan(1);
  });

  it('rejects unsorted records, mismatched data lengths and empty archives', () => {
    const options = { tileType: 'png', bounds: [-1, -1, 1, 1], minZoom: 0, maxZoom: 1 } as const;
    expect(() =>
      createPmtilesPrefix(
        [
          { tileId: 2, byteLength: 1 },
          { tileId: 1, byteLength: 1 },
        ],
        2,
        options,
      ),
    ).toThrow(/sorted/);
    expect(() => createPmtilesPrefix([{ tileId: 0, byteLength: 4 }], 5, options)).toThrow(
      /cover 4 bytes/,
    );
    expect(() => writePmtilesArchive([], options)).toThrow(/at least one tile/);
  });
});

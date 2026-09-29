// PMTiles v3 writer: header, directories and metadata for clustered archives, pure-JS (fflate for
// gzip) so terrain compilers run in Node, Workers and the browser alike.
//
// Official readers fetch the first 16 KiB of an archive and expect the header plus the whole root
// directory inside it. A single root directory stops fitting at a few thousand tiles, so larger
// archives keep only leaf-directory pointers in the root and store the entries in gzip-compressed
// leaf directories, growing the leaf size until the root fits (the go-pmtiles strategy). Every
// archive this module writes therefore opens through the official `pmtiles` reader at any size.
//
// Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md

import { gzipSync } from 'fflate';
import { zxyToTileId } from 'pmtiles';

/** PMTiles v3 header size in bytes. */
export const PMTILES_HEADER_BYTES = 127;
/** Bytes an official reader fetches first; the header and root directory must fit inside. */
const INITIAL_FETCH_BYTES = 16_384;
const INTERNAL_GZIP = 2;

/** Tile payload types, with their PMTiles header codes. */
export type PmtilesTileType = 'mvt' | 'png' | 'jpeg' | 'webp' | 'avif' | 'unknown';
/** Compression already applied to every tile payload. */
export type PmtilesTileCompression = 'none' | 'gzip' | 'brotli' | 'zstd';

const TILE_TYPE_CODES: Record<PmtilesTileType, number> = {
  unknown: 0,
  mvt: 1,
  png: 2,
  jpeg: 3,
  webp: 4,
  avif: 5,
};
const COMPRESSION_CODES: Record<PmtilesTileCompression, number> = {
  none: 1,
  gzip: 2,
  brotli: 3,
  zstd: 4,
};

/** One tile to archive. `data` is stored verbatim (already compressed if `tileCompression` says so). */
export interface PmtilesWriterTile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

/** One tile's position in a caller-streamed tile-data block, sorted by `tileId`. */
export interface PmtilesTileRecord {
  tileId: number;
  byteLength: number;
}

export interface PmtilesArchiveOptions {
  tileType: PmtilesTileType;
  /** Compression of the tile payloads themselves (default `'none'`). */
  tileCompression?: PmtilesTileCompression;
  /** JSON metadata (TileJSON-like). Stored gzip-compressed, like every directory. */
  metadata?: Record<string, unknown>;
  /** `[west, south, east, north]` in degrees. */
  bounds: readonly [number, number, number, number];
  /** `[longitude, latitude, zoom]`; defaults to the bounds center at `minZoom`. */
  center?: readonly [number, number, number];
}

export interface PmtilesPrefixOptions extends PmtilesArchiveOptions {
  minZoom: number;
  maxZoom: number;
}

/** A directory entry: one tile run, or (with `runLength` 0) a pointer to a leaf directory. */
export interface PmtilesDirectoryEntry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

export interface PmtilesDirectories {
  /** gzip-compressed root directory, sized to fit the reader's initial fetch. */
  root: Uint8Array;
  /** Concatenated gzip-compressed leaf directories (empty when the root holds every entry). */
  leaves: Uint8Array;
  leafDirectoryCount: number;
}

/** The PMTiles v3 tile id (Hilbert order across zoom levels) of an XYZ tile. */
export function pmtilesTileId(z: number, x: number, y: number): number {
  return zxyToTileId(z, x, y);
}

function appendVarint(output: number[], value: number): void {
  let remaining = value;
  while (remaining >= 0x80) {
    output.push((remaining % 0x80) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }
  output.push(remaining);
}

/** Encode a directory in the uncompressed PMTiles v3 column layout. */
export function serializePmtilesDirectory(entries: readonly PmtilesDirectoryEntry[]): Uint8Array {
  const output: number[] = [];
  appendVarint(output, entries.length);
  let previousTileId = 0;
  for (const entry of entries) {
    appendVarint(output, entry.tileId - previousTileId);
    previousTileId = entry.tileId;
  }
  for (const entry of entries) appendVarint(output, entry.runLength);
  for (const entry of entries) appendVarint(output, entry.length);
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index] as PmtilesDirectoryEntry;
    const previous = entries[index - 1];
    // 0 means "directly after the previous entry"; any other offset is stored plus one.
    const contiguous = previous !== undefined && entry.offset === previous.offset + previous.length;
    appendVarint(output, contiguous ? 0 : entry.offset + 1);
  }
  return Uint8Array.from(output);
}

function compressedDirectory(entries: readonly PmtilesDirectoryEntry[]): Uint8Array {
  return gzipSync(serializePmtilesDirectory(entries));
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function rootAndLeaves(
  entries: readonly PmtilesDirectoryEntry[],
  leafSize: number,
): PmtilesDirectories {
  const rootEntries: PmtilesDirectoryEntry[] = [];
  const leaves: Uint8Array[] = [];
  let leavesLength = 0;
  for (let start = 0; start < entries.length; start += leafSize) {
    const chunk = entries.slice(start, start + leafSize);
    const leaf = compressedDirectory(chunk);
    rootEntries.push({
      tileId: (chunk[0] as PmtilesDirectoryEntry).tileId,
      offset: leavesLength,
      length: leaf.byteLength,
      runLength: 0,
    });
    leaves.push(leaf);
    leavesLength += leaf.byteLength;
  }
  return {
    root: compressedDirectory(rootEntries),
    leaves: concat(leaves),
    leafDirectoryCount: leaves.length,
  };
}

/**
 * Split directory entries (sorted by tile id) into a root that fits the reader's initial fetch
 * plus leaf directories. `rootBudget` is the compressed-root byte budget.
 */
export function buildPmtilesDirectories(
  entries: readonly PmtilesDirectoryEntry[],
  rootBudget: number = INITIAL_FETCH_BYTES - PMTILES_HEADER_BYTES,
): PmtilesDirectories {
  if (entries.length < 16_384) {
    const root = compressedDirectory(entries);
    if (root.byteLength <= rootBudget) {
      return { root, leaves: new Uint8Array(0), leafDirectoryCount: 0 };
    }
  }
  let leafSize = Math.max(4096, entries.length / 3500);
  for (;;) {
    const directories = rootAndLeaves(entries, Math.floor(leafSize));
    if (directories.root.byteLength <= rootBudget) return directories;
    leafSize *= 1.2;
  }
}

function writeUint64(view: DataView, offset: number, value: number): void {
  view.setBigUint64(offset, BigInt(value), true);
}

function e7(degrees: number): number {
  return Math.round(degrees * 10_000_000);
}

/**
 * Everything that precedes the tile data of a clustered archive: header, root directory,
 * metadata and leaf directories. Write the returned bytes, then the tile payloads in `tiles`
 * order — the streaming path for archives too large to hold in memory.
 */
export function createPmtilesPrefix(
  tiles: readonly PmtilesTileRecord[],
  tileDataLength: number,
  options: PmtilesPrefixOptions,
): Uint8Array {
  let offset = 0;
  const entries: PmtilesDirectoryEntry[] = [];
  let previousTileId = -1;
  for (const tile of tiles) {
    if (tile.tileId <= previousTileId) {
      throw new Error('PMTiles tiles must be sorted by strictly increasing tile id');
    }
    previousTileId = tile.tileId;
    entries.push({ tileId: tile.tileId, offset, length: tile.byteLength, runLength: 1 });
    offset += tile.byteLength;
  }
  if (offset !== tileDataLength) {
    throw new Error(`tile records cover ${offset} bytes but tile data is ${tileDataLength}`);
  }
  if (
    !Number.isInteger(options.minZoom) ||
    options.minZoom < 0 ||
    options.maxZoom < options.minZoom
  ) {
    throw new Error('PMTiles zooms must satisfy 0 <= minZoom <= maxZoom');
  }

  const { root, leaves } = buildPmtilesDirectories(entries);
  const metadata = gzipSync(new TextEncoder().encode(JSON.stringify(options.metadata ?? {})));
  const rootOffset = PMTILES_HEADER_BYTES;
  const metadataOffset = rootOffset + root.byteLength;
  const leavesOffset = metadataOffset + metadata.byteLength;
  const tileDataOffset = leavesOffset + leaves.byteLength;

  const prefix = new Uint8Array(tileDataOffset);
  prefix.set(new TextEncoder().encode('PMTiles'), 0);
  prefix.set(root, rootOffset);
  prefix.set(metadata, metadataOffset);
  prefix.set(leaves, leavesOffset);

  const [west, south, east, north] = options.bounds;
  const center = options.center ?? [(west + east) / 2, (south + north) / 2, options.minZoom];
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  view.setUint8(7, 3);
  writeUint64(view, 8, rootOffset);
  writeUint64(view, 16, root.byteLength);
  writeUint64(view, 24, metadataOffset);
  writeUint64(view, 32, metadata.byteLength);
  writeUint64(view, 40, leavesOffset);
  writeUint64(view, 48, leaves.byteLength);
  writeUint64(view, 56, tileDataOffset);
  writeUint64(view, 64, tileDataLength);
  writeUint64(view, 72, entries.length);
  writeUint64(view, 80, entries.length);
  writeUint64(view, 88, entries.length);
  view.setUint8(96, 1); // clustered: tile data is in tile-id order
  view.setUint8(97, INTERNAL_GZIP);
  view.setUint8(98, COMPRESSION_CODES[options.tileCompression ?? 'none']);
  view.setUint8(99, TILE_TYPE_CODES[options.tileType]);
  view.setUint8(100, options.minZoom);
  view.setUint8(101, options.maxZoom);
  view.setInt32(102, e7(west), true);
  view.setInt32(106, e7(south), true);
  view.setInt32(110, e7(east), true);
  view.setInt32(114, e7(north), true);
  view.setUint8(118, center[2]);
  view.setInt32(119, e7(center[0]), true);
  view.setInt32(123, e7(center[1]), true);
  return prefix;
}

/**
 * Build a complete clustered PMTiles v3 archive in memory. Tiles may arrive in any order; zooms
 * are derived from them. Use `createPmtilesPrefix` to stream larger archives to disk.
 */
export function writePmtilesArchive(
  tiles: readonly PmtilesWriterTile[],
  options: PmtilesArchiveOptions,
): Uint8Array {
  if (tiles.length === 0) throw new Error('a PMTiles archive needs at least one tile');
  const sorted = tiles
    .map((tile) => ({ tile, tileId: pmtilesTileId(tile.z, tile.x, tile.y) }))
    .sort((left, right) => left.tileId - right.tileId);
  const data = concat(sorted.map((entry) => entry.tile.data));
  let minZoom = Number.POSITIVE_INFINITY;
  let maxZoom = Number.NEGATIVE_INFINITY;
  for (const tile of tiles) {
    minZoom = Math.min(minZoom, tile.z);
    maxZoom = Math.max(maxZoom, tile.z);
  }
  const prefix = createPmtilesPrefix(
    sorted.map((entry) => ({ tileId: entry.tileId, byteLength: entry.tile.data.byteLength })),
    data.byteLength,
    { ...options, minZoom, maxZoom },
  );
  return concat([prefix, data]);
}

/**
 * Terrain archives read through a persistent byte cache.
 *
 * `cachingArchiveOpener` turns a `BlockCache` (from `@bendyline/molen-pack/cache`) into the
 * `openArchive` hook that archive sets and package transports take, so elevation, landcover,
 * feature and building tiles a viewer has seen are read from the cache on the next visit. An
 * archive is keyed by the SHA-256 its archive set or package lists, or by its URL when none is
 * listed (safe for versioned URLs; a server that replaces a file in place is caught by its ETag).
 *
 * Self-healing: a persistent cache can come to hold bytes that are not the archive it names (blocks
 * of two files once served at one URL, a write cut short), and every later visit reads the same
 * garbage. Each archive opened here checks what it reads: a raster tile must start the way its
 * header's tile type does (a PNG elevation tile with the PNG signature), and the header and
 * directories must parse. The first time either fails, the archive's cached bytes are dropped and
 * it reopens from the network, then the read is tried once more; concurrent failures share that
 * one repair. A second failure is reported as it is, so a server that really serves bad tiles is
 * not refetched over and over. MVT tiles have no signature, so only their directories are checked.
 */

import {
  type ArchivePriority,
  type BlockCache,
  cachingRangeSource,
  type RangeSourceLike,
} from '@bendyline/molen-pack/cache';
import { FetchSource, PMTiles, TileType } from 'pmtiles';
import type {
  TerrainArchiveEntryInfo,
  TerrainArchiveHeader,
  TerrainArchiveOpener,
  TerrainArchiveTile,
  TerrainTileArchive,
} from './package-types';

export interface CachingArchiveOpenerOptions {
  /** Eviction priority of the archives opened (default `'normal'`), or one per archive. */
  priority?: ArchivePriority | ((url: string, id: string) => ArchivePriority);
  /**
   * The cache key of an archive (default `sha256:<hash>` when listed, else the URL). Return
   * undefined to read that archive uncached.
   */
  keyFor?: (url: string, id: string, entry?: TerrainArchiveEntryInfo) => string | undefined;
  /** The byte source for a URL (default: PMTiles' `FetchSource`); wrap it for retries. */
  source?: (url: string) => RangeSourceLike;
}

const defaultKey = (url: string, _id: string, entry?: TerrainArchiveEntryInfo): string =>
  entry?.sha256 !== undefined ? `sha256:${entry.sha256}` : url;

/** A tile or directory that is not what the archive's header says it holds. */
export class CorruptTerrainArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorruptTerrainArchiveError';
  }
}

/** How each raster tile type begins. MVT has no fixed signature. */
const SIGNATURES: Partial<Record<number, (bytes: Uint8Array) => boolean>> = {
  [TileType.Png]: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  [TileType.Jpeg]: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  [TileType.Webp]: (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
  [TileType.Avif]: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
};

/** PMTiles' own errors for bytes that do not parse as an archive (not network failures). */
const CORRUPT_ARCHIVE = /magic number|spec version|empty directory|directory depth|varint|corrupt/i;

const isCorruption = (error: unknown): boolean =>
  error instanceof CorruptTerrainArchiveError ||
  (error instanceof Error && CORRUPT_ARCHIVE.test(error.message));

/**
 * An archive over a reader it can replace: when what it reads is corrupt, it calls `repair`
 * (drop the cached bytes) once, reopens with `open`, and reads again.
 */
export function selfHealingArchive(
  open: () => PMTiles,
  repair: () => Promise<void>,
  url: string,
): TerrainTileArchive & { getHeader(): Promise<TerrainArchiveHeader> } {
  let reader = open();
  let repaired = false;
  let repairing: Promise<void> | undefined;

  const checked = async (
    current: PMTiles,
    level: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<TerrainArchiveTile | undefined> => {
    const tile = await current.getZxy(level, x, y, signal);
    if (tile === undefined || tile.data.byteLength === 0) return tile;
    const { tileType } = await current.getHeader();
    const starts = SIGNATURES[tileType];
    if (
      starts !== undefined &&
      !starts(new Uint8Array(tile.data, 0, Math.min(12, tile.data.byteLength)))
    )
      throw new CorruptTerrainArchiveError(
        `${url}: tile ${level}/${x}/${y} is not the archive's ${TileType[tileType]} type`,
      );
    return tile;
  };

  /** Run `read`; on corruption repair once (shared with concurrent failures) and run it again. */
  const healing = async <T>(
    read: (current: PMTiles) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> => {
    const current = reader;
    try {
      return await read(current);
    } catch (error) {
      if (signal?.aborted || !isCorruption(error)) throw error;
      if (reader === current) {
        if (repaired) throw error;
        repaired = true;
        repairing = (async () => {
          await repair();
          reader = open();
        })().finally(() => {
          repairing = undefined;
        });
      }
      await repairing;
      return read(reader);
    }
  };

  return {
    getHeader: () => healing((current) => current.getHeader()),
    getZxy: (level, x, y, signal) =>
      healing((current) => checked(current, level, x, y, signal), signal),
  };
}

/** An `openArchive` hook that reads every archive through `cache`, repairing what it finds corrupt. */
export function cachingArchiveOpener(
  cache: BlockCache,
  options: CachingArchiveOpenerOptions = {},
): TerrainArchiveOpener {
  return (url, id, entry) => {
    const key = (options.keyFor ?? defaultKey)(url, id, entry);
    if (key === undefined) return new PMTiles(options.source?.(url) ?? new FetchSource(url));
    const priority =
      typeof options.priority === 'function'
        ? options.priority(url, id)
        : (options.priority ?? 'normal');
    return selfHealingArchive(
      () =>
        new PMTiles(
          cachingRangeSource(options.source?.(url) ?? new FetchSource(url), cache, {
            key,
            url,
            priority,
            ...(entry?.bytes !== undefined ? { size: entry.bytes } : {}),
          }),
        ),
      () => cache.drop(key),
      url,
    );
  };
}

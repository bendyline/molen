/**
 * Terrain archives read through a persistent byte cache.
 *
 * `cachingArchiveOpener` turns a `BlockCache` (from `@bendyline/molen-pack/cache`) into the
 * `openArchive` hook that archive sets and package transports take, so elevation, landcover,
 * feature and building tiles a viewer has seen are read from the cache on the next visit. An
 * archive is keyed by the SHA-256 its archive set or package lists, or by its URL when none is
 * listed (safe for versioned URLs; a server that replaces a file in place is caught by its ETag).
 */

import {
  type ArchivePriority,
  type BlockCache,
  cachingRangeSource,
  type RangeSourceLike,
} from '@bendyline/molen-pack/cache';
import { FetchSource, PMTiles } from 'pmtiles';
import type { TerrainArchiveEntryInfo, TerrainArchiveOpener } from './package-types';

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

/** An `openArchive` hook that reads every archive through `cache`. */
export function cachingArchiveOpener(
  cache: BlockCache,
  options: CachingArchiveOpenerOptions = {},
): TerrainArchiveOpener {
  return (url, id, entry) => {
    const source = options.source?.(url) ?? new FetchSource(url);
    const key = (options.keyFor ?? defaultKey)(url, id, entry);
    if (key === undefined) return new PMTiles(source);
    const priority =
      typeof options.priority === 'function'
        ? options.priority(url, id)
        : (options.priority ?? 'normal');
    return new PMTiles(
      cachingRangeSource(source, cache, {
        key,
        url,
        priority,
        ...(entry?.bytes !== undefined ? { size: entry.bytes } : {}),
      }),
    );
  };
}

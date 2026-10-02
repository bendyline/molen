/**
 * Adapters that put a `BlockCache` in front of the two byte-source shapes Molen reads: the
 * PMTiles `Source` interface (terrain, landcover, vector and building tiles) and the pack
 * `RangeReader` (content packs and model archives).
 */

import type { ArchiveKey, BlockCache } from './block-cache';
import type { RangeReader } from './source';

/** A PMTiles range response, typed structurally so this package never imports pmtiles. */
export interface RangeSourceResponse {
  data: ArrayBuffer;
  etag?: string;
  expires?: string;
  cacheControl?: string;
}

/** The shape of a PMTiles `Source` (`FetchSource`, a retrying wrapper, a native reader). */
export interface RangeSourceLike {
  getKey(): string;
  getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeSourceResponse>;
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? (bytes.buffer as ArrayBuffer)
    : (bytes.slice().buffer as ArrayBuffer);
}

/**
 * A PMTiles source whose bytes come from `cache` when it has them. The inner source must honour
 * Range requests. Its validator handling is kept: a request carrying the archive's ETag still
 * reaches the inner source on a miss, so a replaced file fails with the inner source's own
 * mismatch error (which also drops the cached bytes). Use `keyBy: 'etag'` for a stable URL whose
 * contents are replaced in place; then the first read of a session (the header) always goes to
 * the network and names the version the rest are cached under.
 */
export function cachingRangeSource(
  source: RangeSourceLike,
  cache: BlockCache,
  archive: ArchiveKey,
): RangeSourceLike {
  const handle = cache.open(archive, async (offset, length, signal, etag) => {
    const response = await source.getBytes(offset, length, signal, etag);
    return {
      bytes: new Uint8Array(response.data),
      ...(response.etag !== undefined ? { etag: response.etag } : {}),
    };
  });
  return {
    getKey: () => source.getKey(),
    getBytes: async (offset, length, signal, etag) => {
      const read = await handle.read(offset, length, signal, etag);
      return {
        data: exactBuffer(read.bytes),
        ...(read.etag !== undefined ? { etag: read.etag } : {}),
      };
    },
  };
}

export interface CachingRangeReaderOptions {
  /**
   * Archives at most this size are fetched whole on the first read, in one request (default
   * 4 MiB), so a small pack costs one request on its first visit and none after.
   */
  wholeBelow?: number;
}

/**
 * A pack `RangeReader` whose bytes come from `cache` when it has them. Key it by the pack's
 * content hash (`contentHash` in a pack index) so a cached copy can never be another version.
 */
export function cachingRangeReader(
  reader: RangeReader,
  cache: BlockCache,
  archive: ArchiveKey,
  options: CachingRangeReaderOptions = {},
): RangeReader {
  const wholeBelow = options.wholeBelow ?? 4 * 1024 * 1024;
  // A PackChangedError from the reader makes the cache drop this archive's bytes.
  const handle = cache.open(
    { ...archive, size: archive.size ?? reader.size },
    async (offset, length, signal) => ({ bytes: await reader.read(offset, length, signal) }),
  );
  let whole: Promise<unknown> | undefined;
  return {
    size: reader.size,
    read: async (offset, length, signal) => {
      if (reader.size <= wholeBelow) {
        whole ??= handle.read(0, reader.size).catch((error: unknown) => {
          whole = undefined;
          throw error;
        });
        await whole;
      }
      return (await handle.read(offset, length, signal)).bytes;
    },
  };
}

// Byte caching for range-read archives: a block cache with memory and IndexedDB tiers, adapters
// for PMTiles sources and pack readers, and a revalidating fetch for small documents. This entry
// imports nothing beyond the platform, so a page can cache map bytes without loading the pack
// reader, its schemas or zlib.

export {
  type ArchiveKey,
  type ArchivePriority,
  type BlockCache,
  type BlockCacheOptions,
  type BlockCacheStats,
  type ByteStore,
  type ByteStoreStats,
  type CachedArchive,
  type CachedRead,
  createBlockCache,
  createMemoryByteStore,
  evictionRank,
  isChangedError,
  PRIORITY_BIAS_MS,
  type SpanReader,
  type StoredArchive,
  type StoredArchiveInfo,
} from './block-cache';
export {
  type CachingRangeReaderOptions,
  cachingRangeReader,
  cachingRangeSource,
  type RangeSourceLike,
  type RangeSourceResponse,
} from './cache-adapters';
export {
  cachingDocumentFetch,
  DOCUMENT_CACHE_HEADER,
  type DocumentCacheOptions,
} from './document-cache';
export { createIndexedDbByteStore, type IndexedDbByteStoreOptions } from './indexeddb-byte-store';
export { type RangeReader, type UrlRangeReaderOptions, urlRangeReader } from './source';

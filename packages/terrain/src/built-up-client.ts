/**
 * Retrieval of a package's built-up grid (built-up-grid.ts) and the enricher that attaches it to
 * semantic tiles as `TerrainSemanticTile.builtUp`.
 *
 * How it fits in: package-semantic-client.ts wraps the classification and human-feature sources
 * with it when a package declares `builtUp`, after building detail has composed the tile, so
 * every reader of a tile sees the same evidence. Downloads are bounded and shared between the
 * tiles under one grid document, as the agriculture enricher's are.
 *
 * What a tile gets:
 * - a document was found: the part of its grid over the tile;
 * - no document (404 or 204) inside the source's `bounds`: evidence that nothing is built;
 * - outside `bounds`, coarser than the grid's level, or a failed download: no `builtUp` at all,
 *   and readers behave as they do without a grid.
 *
 * Gotchas:
 * - A failed download leaves a tile without evidence for 30 seconds of retries, so the same place
 *   can be generated with and without it. The enriched tile's content hash names the grid, so
 *   caches keyed by content keep the two apart.
 * - The grid document is fetched once per parent tile and kept (32 documents); a tile's coverage
 *   is a few dozen numbers, so enriched tiles stay cheap to post to a worker.
 * - A base tile yields the same enriched tile every time, unless a retry after a failed download
 *   has since found the document.
 */
import {
  decodeBuiltUpGrid,
  emptyTerrainBuiltUpCoverage,
  type TerrainBuiltUpGrid,
  type TerrainBuiltUpSource,
  terrainBuiltUpCoverage,
  terrainBuiltUpCovers,
  withTerrainBuiltUp,
} from './built-up-grid';
import type { TerrainSemanticTileSource } from './semantic-client';
import {
  setTerrainSemanticTileContentHash,
  type TerrainSemanticTile,
  terrainSemanticTileContentHash,
} from './semantic-types';

interface LoadedGrid {
  grid: TerrainBuiltUpGrid;
  cells: Uint8Array;
}

export function createBuiltUpTileEnricher(
  source: TerrainBuiltUpSource,
  baseUrl?: string | URL,
  options: { fetch?: typeof fetch; onError?: (error: Error) => void } = {},
): (base: TerrainSemanticTileSource) => TerrainSemanticTileSource {
  if (
    !Number.isInteger(source.level) ||
    source.level < 0 ||
    source.level > 20 ||
    !Number.isInteger(source.year) ||
    source.year < 1900 ||
    source.year > 2200 ||
    !source.source ||
    !['{x}', '{y}', '{z}'].every((token) => source.urlTemplate.includes(token)) ||
    (source.maxTileBytes !== undefined &&
      (!Number.isInteger(source.maxTileBytes) ||
        source.maxTileBytes < 1 ||
        source.maxTileBytes > 1_048_576)) ||
    (source.bounds !== undefined &&
      (source.bounds.length !== 4 ||
        source.bounds.some((value) => !Number.isFinite(value)) ||
        !(source.bounds[2] > source.bounds[0]) ||
        !(source.bounds[3] > source.bounds[1])))
  )
    throw new Error('Invalid built-up source descriptor');
  const fetcher = options.fetch ?? fetch;
  // undefined: the source has no document there. null: the download failed.
  const cache = new Map<string, Promise<LoadedGrid | undefined | null>>();
  const retryAfter = new Map<string, number>();
  const limit = Math.min(1_048_576, source.maxTileBytes ?? 131072);
  const download = async (
    key: string,
    x: number,
    z: number,
  ): Promise<LoadedGrid | undefined | null> => {
    const path = source.urlTemplate
      .replace('{z}', String(source.level))
      .replace('{x}', String(x))
      .replace('{y}', String(z));
    const response = await fetcher(new URL(path, baseUrl), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404 || response.status === 204) return undefined;
    if (!response.ok) throw new Error(`Built-up tile ${key}: HTTP ${response.status}`);
    if (Number(response.headers.get('content-length') ?? 0) > limit) {
      await response.body?.cancel();
      throw new Error('Built-up tile exceeds byte budget');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty built-up response');
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error('Built-up tile exceeds byte budget');
      }
      chunks.push(next.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    const grid = JSON.parse(new TextDecoder().decode(buffer)) as TerrainBuiltUpGrid;
    const cells = decodeBuiltUpGrid(grid);
    if (
      grid.level !== source.level ||
      grid.x !== x ||
      grid.z !== z ||
      grid.source !== source.source ||
      grid.year !== source.year
    )
      throw new Error('Built-up tile identity/provenance mismatch');
    return { grid, cells };
  };
  // One enriched tile per base tile: readers ask again and some keep what they derived by tile.
  const enrichedTiles = new WeakMap<TerrainSemanticTile, TerrainSemanticTile>();
  return (base) => ({
    async load(address, signal) {
      if (address.level < source.level || signal.aborted || !terrainBuiltUpCovers(source, address))
        return base.load(address, signal);
      const factor = 2 ** (address.level - source.level),
        x = Math.floor(address.x / factor),
        z = Math.floor(address.z / factor);
      const key = `${source.level}/${x}/${z}`;
      let request = cache.get(key);
      if ((retryAfter.get(key) ?? Number.POSITIVE_INFINITY) <= Date.now()) {
        cache.delete(key);
        retryAfter.delete(key);
        request = undefined;
      }
      if (!request) {
        request = download(key, x, z).catch((error: unknown) => {
          // One cooldown for every tile under the document: an outage must not retry per tile.
          if (cache.has(key)) retryAfter.set(key, Date.now() + 30_000);
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
          return null;
        });
        cache.set(key, request);
        while (cache.size > 32) {
          const oldest = cache.keys().next().value as string;
          cache.delete(oldest);
          retryAfter.delete(oldest);
        }
      }
      const [tile, loaded] = await Promise.all([base.load(address, signal), request]);
      if (signal.aborted) return undefined;
      if (!tile || loaded === null) return tile;
      const known = enrichedTiles.get(tile);
      if (known !== undefined) return known;
      const coverage =
        loaded === undefined
          ? emptyTerrainBuiltUpCoverage(source)
          : terrainBuiltUpCoverage(address, loaded.grid, loaded.cells);
      if (coverage === undefined) return tile;
      const enriched = withTerrainBuiltUp(tile, coverage);
      enrichedTiles.set(tile, enriched);
      // Keyed by the base tile's content and the grid's checked identity, as agriculture is.
      const hash = terrainSemanticTileContentHash(tile);
      if (hash !== undefined)
        setTerrainSemanticTileContentHash(
          enriched,
          `${hash}|builtUp:${source.source}@${source.year}:${loaded === undefined ? 'none' : `${source.level}/${x}/${z}`}>${address.level}/${address.x}/${address.z}`,
        );
      return enriched;
    },
  });
}

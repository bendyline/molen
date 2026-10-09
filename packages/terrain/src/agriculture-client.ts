/** Optional agricultural retrieval with bounded downloads and a small shared cache. Failed or
 * uncovered requests leave the basemap usable and retain regional crop inference. */
import {
  applyAgricultureGrid,
  decodeAgricultureGrid,
  type TerrainAgricultureGrid,
  type TerrainAgricultureSource,
} from './agriculture-grid';
import type { TerrainSemanticTileSource } from './semantic-client';

export function createAgricultureTileEnricher(
  source: TerrainAgricultureSource,
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
        source.maxTileBytes > 1_048_576))
  )
    throw new Error('Invalid agriculture source descriptor');
  const fetcher = options.fetch ?? fetch;
  const cache = new Map<string, Promise<TerrainAgricultureGrid | undefined>>();
  const retryAfter = new Map<string, number>();
  return (base) => ({
    async load(address, signal) {
      if (address.level < source.level || signal.aborted) return base.load(address, signal);
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
        request = (async () => {
          const path = source.urlTemplate
            .replace('{z}', String(source.level))
            .replace('{x}', String(x))
            .replace('{y}', String(z));
          const response = await fetcher(new URL(path, baseUrl), {
            signal: AbortSignal.timeout(8000),
            headers: { Accept: 'application/json' },
          });
          if (response.status === 404 || response.status === 204) return undefined;
          if (!response.ok) throw new Error(`Agriculture tile ${key}: HTTP ${response.status}`);
          const limit = Math.min(1_048_576, source.maxTileBytes ?? 131072);
          if (Number(response.headers.get('content-length') ?? 0) > limit) {
            await response.body?.cancel();
            throw new Error('Agriculture tile exceeds byte budget');
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Empty agriculture response');
          let bytes = 0;
          const chunks: Uint8Array[] = [];
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.length;
            if (bytes > limit) {
              await reader.cancel();
              throw new Error('Agriculture tile exceeds byte budget');
            }
            chunks.push(next.value);
          }
          const buffer = new Uint8Array(bytes);
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
          const grid = JSON.parse(new TextDecoder().decode(buffer)) as TerrainAgricultureGrid;
          decodeAgricultureGrid(grid);
          if (
            grid.level !== source.level ||
            grid.x !== x ||
            grid.z !== z ||
            grid.source !== source.source ||
            grid.year !== source.year
          )
            throw new Error('Agriculture tile identity/provenance mismatch');
          return grid;
        })().catch((error: unknown) => {
          // Share a short failure cooldown across all child tiles. A malformed response or
          // service outage must not cause one retry per rendered child; later visits retry.
          if (cache.has(key)) retryAfter.set(key, Date.now() + 30_000);
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
          return undefined;
        });
        cache.set(key, request);
        while (cache.size > 32) {
          const oldest = cache.keys().next().value as string;
          cache.delete(oldest);
          retryAfter.delete(oldest);
        }
      }
      const [tile, grid] = await Promise.all([base.load(address, signal), request]);
      if (signal.aborted) return undefined;
      return tile && grid ? applyAgricultureGrid(tile, address, grid) : tile;
    },
  });
}

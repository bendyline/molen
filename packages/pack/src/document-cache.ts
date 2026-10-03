/**
 * A `fetch` that keeps small documents (pack indexes, archive sets, terrain manifests, release
 * pointers) in a `ByteStore`, so a page starts from its last good copy and keeps working offline.
 *
 * A stored copy younger than `maxAgeMs` is served without asking the server. An older one is
 * revalidated with `If-None-Match`: a 304 serves the stored bytes, a 200 replaces them, and a
 * network failure or a server slower than `timeoutMs` serves the stored copy (the request keeps
 * running and updates the store when it lands). With nothing stored the request goes straight to
 * the network. Only plain GETs are cached: a request with a `Range` header, another method, or
 * `cache: 'no-store'` passes through untouched.
 */

import type { ByteStore } from './block-cache';

export interface DocumentCacheOptions {
  /**
   * Serve a stored copy without asking the server while it is younger than this, in ms (default
   * 0: always revalidate). A function picks a policy per URL.
   */
  maxAgeMs?: number | ((url: string) => number);
  /** Serve the stored copy when the server has not answered within this many ms (default 4000). */
  timeoutMs?: number;
  /** Largest document kept, in bytes (default 2 MiB). */
  maxBytes?: number;
  /** Clock, for tests (default `Date.now`). */
  now?: () => number;
}

/** Response header naming where a cached document came from: `hit`, `revalidated` or `stale`. */
export const DOCUMENT_CACHE_HEADER = 'x-molen-cache';

const documentKey = (url: string): string => `doc:${url}`;

function requestUrl(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const base = (globalThis as { location?: { href?: string } }).location?.href;
  return base === undefined ? raw : new URL(raw, base).href;
}

function cacheable(input: RequestInfo | URL, init: RequestInit | undefined): boolean {
  const request = typeof input === 'object' && 'method' in input ? input : undefined;
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return false;
  if ((init?.cache ?? request?.cache) === 'no-store') return false;
  const headers = new Headers(init?.headers ?? request?.headers);
  return !headers.has('range');
}

/** Wrap `fetchImpl` so GETs of small documents are kept in `store`. */
export function cachingDocumentFetch(
  store: ByteStore,
  fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
  options: DocumentCacheOptions = {},
): typeof fetch {
  const timeoutMs = options.timeoutMs ?? 4000;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const now = options.now ?? Date.now;
  const maxAge = (url: string): number =>
    typeof options.maxAgeMs === 'function' ? options.maxAgeMs(url) : (options.maxAgeMs ?? 0);

  const save = async (url: string, response: Response): Promise<Uint8Array> => {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length <= maxBytes) {
      const etag = response.headers.get('etag') ?? undefined;
      const type = response.headers.get('content-type') ?? undefined;
      await store.putBlocks(
        {
          key: documentKey(url),
          url,
          priority: 'high',
          size: bytes.length,
          validated: now(),
          ...(etag !== undefined ? { etag } : {}),
          ...(type !== undefined ? { type } : {}),
        },
        [{ index: 0, bytes }],
        now(),
      );
    }
    return bytes;
  };

  const respond = (
    bytes: Uint8Array,
    status: number,
    headers: { type?: string | undefined; etag?: string | undefined },
    origin: 'hit' | 'revalidated' | 'stale' | 'network',
  ): Response => {
    const out = new Headers({ [DOCUMENT_CACHE_HEADER]: origin });
    if (headers.type !== undefined) out.set('content-type', headers.type);
    if (headers.etag !== undefined) out.set('etag', headers.etag);
    return new Response(bytes.slice(), { status, headers: out });
  };

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!cacheable(input, init)) return fetchImpl(input, init);
    const url = requestUrl(input);
    const key = documentKey(url);
    const info = await store.getArchive(key);
    const stored = info !== undefined ? (await store.getBlocks(key, [0]))[0] : undefined;
    if (info === undefined || stored === undefined || stored.length !== info.size) {
      const response = await fetchImpl(input, init);
      if (response.status !== 200) return response;
      const bytes = await save(url, response);
      return respond(
        bytes,
        200,
        {
          type: response.headers.get('content-type') ?? undefined,
          etag: response.headers.get('etag') ?? undefined,
        },
        'network',
      );
    }
    const cached = (origin: 'hit' | 'revalidated' | 'stale'): Response =>
      respond(stored, 200, { type: info.type, etag: info.etag }, origin);
    if (info.validated !== undefined && now() - info.validated < maxAge(url)) return cached('hit');

    const headers = new Headers(init?.headers);
    if (info.etag !== undefined) headers.set('if-none-match', info.etag);
    const absorb = async (response: Response): Promise<'revalidated' | 'replaced' | 'kept'> => {
      if (response.status === 304) {
        await store.updateArchive({ ...info, validated: now() });
        return 'revalidated';
      }
      if (response.status === 200) {
        await save(url, response);
        return 'replaced';
      }
      if (response.status === 404 || response.status === 410) await store.deleteArchive(key);
      return 'kept';
    };
    const request = fetchImpl(url, { ...init, headers });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    let response: Response | 'timeout';
    try {
      response = await Promise.race([request, timeout]);
    } catch {
      clearTimeout(timer);
      return cached('stale');
    }
    clearTimeout(timer);
    if (response === 'timeout') {
      // Keep the request: when it lands it refreshes the store for the next visit.
      void request.then(absorb).catch(() => undefined);
      return cached('stale');
    }
    if (response.status === 304) {
      await absorb(response);
      return cached('revalidated');
    }
    if (response.status === 200) {
      const bytes = await save(url, response);
      return respond(
        bytes,
        200,
        {
          type: response.headers.get('content-type') ?? undefined,
          etag: response.headers.get('etag') ?? undefined,
        },
        'network',
      );
    }
    if (response.status === 404 || response.status === 410) {
      await store.deleteArchive(key);
      return response;
    }
    // A server error: the stored copy is better than nothing.
    return cached('stale');
  }) as typeof fetch;
}

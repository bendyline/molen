import type { PackFile } from '../src/build';
import type { RangeReader } from '../src/source';

export const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Deterministic pseudo-random bytes that don't compress. */
export function noise(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = state & 0xff;
  }
  return out;
}

/** A small pack's worth of files: JSON docs, a sidecar with its model and variant, a notice. */
export function sampleFiles(): PackFile[] {
  const sidecar = {
    format: 'molen/asset@1',
    id: 'example.vehicle.roadster',
    kind: 'model',
    files: { main: 'model.glb', variants: { ktx2: 'model.ktx2.glb' } },
  };
  return [
    { path: 'NOTICE.md', bytes: encode('# Notice\n\nExample content, CC0.\n') },
    { path: 'types/vehicles.types.json', bytes: encode(JSON.stringify({ a: 1, list: [1, 2, 3] })) },
    { path: 'types/aircraft.types.json', bytes: encode(JSON.stringify({ b: 'two' })) },
    { path: 'models/roadster/asset.json', bytes: encode(JSON.stringify(sidecar)) },
    { path: 'models/roadster/model.glb', bytes: noise(3000, 7) },
    { path: 'models/roadster/model.ktx2.glb', bytes: noise(2000, 9) },
    { path: 'models/roadster/empty.bin', bytes: new Uint8Array(0) },
  ];
}

/** A RangeReader over bytes that records every read. */
export function recordingReader(bytes: Uint8Array): RangeReader & {
  reads: { offset: number; length: number }[];
} {
  const reads: { offset: number; length: number }[] = [];
  return {
    size: bytes.length,
    reads,
    read: async (offset, length) => {
      reads.push({ offset, length });
      return bytes.slice(offset, offset + length);
    },
  };
}

export interface ServerOptions {
  /** Honour Range headers (default true). */
  ranges?: boolean;
  /** Let the client read Content-Range (default true); cross-origin servers often hide it. */
  exposeRange?: boolean;
  etag?: string;
  /** Answer this many requests with 503 first. */
  failures?: number;
  status?: number;
  /** Reproduce static servers which incorrectly serve bytes0-N for a suffix request. */
  suffixAsPrefix?: boolean;
}

/** A fetch that serves one file the way a static host would. */
export function fakeServer(initial: Uint8Array, options: ServerOptions = {}) {
  const state = {
    bytes: initial,
    etag: options.etag,
    failures: options.failures ?? 0,
    requests: [] as { range?: string; ifRange?: string }[],
  };
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const range = headers.get('range') ?? undefined;
    const ifRange = headers.get('if-range') ?? undefined;
    state.requests.push({
      ...(range !== undefined ? { range } : {}),
      ...(ifRange !== undefined ? { ifRange } : {}),
    });
    if (options.status !== undefined) return new Response(null, { status: options.status });
    if (state.failures > 0) {
      state.failures--;
      return new Response(null, { status: 503 });
    }
    const out = new Headers();
    if (state.etag !== undefined) out.set('etag', state.etag);
    const stale = ifRange !== undefined && ifRange !== state.etag;
    if (range === undefined || options.ranges === false || stale) {
      return new Response(state.bytes.slice(), { status: 200, headers: out });
    }
    const size = state.bytes.length;
    const [, from, to] = /bytes=(\d*)-(\d*)/.exec(range) ?? [];
    const brokenSuffix = from === '' && options.suffixAsPrefix === true;
    const start = brokenSuffix ? 0 : from === '' ? Math.max(0, size - Number(to)) : Number(from);
    const end = brokenSuffix
      ? Math.min(size - 1, Number(to))
      : from === ''
        ? size - 1
        : Math.min(size - 1, Number(to));
    if (options.exposeRange !== false) out.set('content-range', `bytes ${start}-${end}/${size}`);
    return new Response(state.bytes.slice(start, end + 1), { status: 206, headers: out });
  }) as typeof fetch;
  return { state, fetcher };
}

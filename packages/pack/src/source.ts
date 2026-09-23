/**
 * Byte sources a pack can be read from, and the transport policy for remote ones: tail-first
 * opening, range reads merged when they are close together, bounded concurrency, and retries.
 */

/** Random access to a pack's bytes. Supply one for storage Molen does not know about. */
export interface RangeReader {
  /** Total size in bytes. */
  readonly size: number;
  read(offset: number, length: number, signal?: AbortSignal): Promise<Uint8Array>;
}

export interface PackRetryOptions {
  /** Attempts per request, including the first (default 3). */
  attempts?: number;
  /** Delay before the first retry; doubles each time (default 250 ms). */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Per-request deadline (default 30 s). */
  timeoutMs?: number;
}

/** The server replaced the pack while it was being read (its ETag changed). */
export class PackChangedError extends Error {
  constructor(url: string) {
    super(`pack ${url} changed on the server while it was being read; open it again`);
    this.name = 'PackChangedError';
  }
}

export class HttpStatusError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
  }
}

export function bytesReader(bytes: Uint8Array): RangeReader {
  return {
    size: bytes.length,
    read: async (offset, length) => bytes.subarray(offset, offset + length),
  };
}

export function blobReader(blob: Blob): RangeReader {
  return {
    size: blob.size,
    read: async (offset, length) =>
      new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer()),
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof PackChangedError) return false;
  const name = (error as { name?: string } | undefined)?.name;
  // fetch rejects with TypeError on network failure; our deadline aborts with TimeoutError.
  return error instanceof TypeError || name === 'TimeoutError';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Run `task` with a per-attempt deadline, retrying transient failures with backoff. */
export async function withRetry<T>(
  task: (signal: AbortSignal) => Promise<T>,
  retry: PackRetryOptions,
  signal: AbortSignal,
): Promise<T> {
  const attempts = Math.max(1, retry.attempts ?? 3);
  const base = retry.baseDelayMs ?? 250;
  for (let attempt = 1; ; attempt++) {
    const deadline = AbortSignal.timeout(retry.timeoutMs ?? 30_000);
    try {
      return await task(AbortSignal.any([signal, deadline]));
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await sleep(Math.min(base * 2 ** (attempt - 1), retry.maxDelayMs ?? 4_000), signal);
    }
  }
}

/** Bytes fetched when a remote pack is opened: the manifest and central directory live here. */
export const TAIL_BYTES: number = 64 * 1024;

export type OpenedUrl =
  | { kind: 'whole'; bytes: Uint8Array }
  | {
      kind: 'range';
      tail: Uint8Array;
      /** Total size, when the server exposed Content-Range. */
      size?: number;
      /** Build a reader once the size is known (from Content-Range or the zip end record). */
      reader(size: number): RangeReader;
    };

export interface UrlOptions {
  fetch: typeof fetch;
  retry: PackRetryOptions;
  signal: AbortSignal;
  /** 'whole' downloads everything; 'range' and 'auto' start with a tail request. */
  mode: 'auto' | 'whole' | 'range';
  sizeHint?: number;
  wholeThreshold: number;
  onResponse(bytes: number): void;
}

async function fetchBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Open a pack URL. A server that honours Range gets range reads; one that ignores it (200 to a
 * range request) has already sent the whole file, which is used as is.
 */
export async function openUrl(url: string, options: UrlOptions): Promise<OpenedUrl> {
  const { fetch: fetcher, retry, signal } = options;
  const whole =
    options.mode === 'whole' ||
    (options.mode === 'auto' &&
      options.sizeHint !== undefined &&
      options.sizeHint <= options.wholeThreshold);
  if (whole) {
    const bytes = await withRetry(
      async (attemptSignal) => {
        const response = await fetcher(url, { signal: attemptSignal });
        if (!response.ok) throw new HttpStatusError(url, response.status);
        return fetchBytes(response);
      },
      retry,
      signal,
    );
    options.onResponse(bytes.length);
    return { kind: 'whole', bytes };
  }
  const first = await withRetry(
    async (attemptSignal) => {
      const response = await fetcher(url, {
        headers: { Range: `bytes=-${TAIL_BYTES}` },
        signal: attemptSignal,
      });
      if (response.status !== 200 && response.status !== 206) {
        throw new HttpStatusError(url, response.status);
      }
      return {
        status: response.status,
        bytes: await fetchBytes(response),
        etag: response.headers.get('etag') ?? undefined,
        range: response.headers.get('content-range') ?? undefined,
      };
    },
    retry,
    signal,
  );
  options.onResponse(first.bytes.length);
  if (first.status === 200) return { kind: 'whole', bytes: first.bytes };
  const total = first.range === undefined ? undefined : Number(first.range.split('/')[1]);
  // If-Range needs a strong validator; without one a mid-read change can't be detected.
  const etag = first.etag !== undefined && !first.etag.startsWith('W/') ? first.etag : undefined;
  return {
    kind: 'range',
    tail: first.bytes,
    ...(total !== undefined && Number.isFinite(total) ? { size: total } : {}),
    reader: (size) => ({
      size,
      read: (offset, length, readSignal) =>
        withRetry(
          async (attemptSignal) => {
            const headers: Record<string, string> = {
              Range: `bytes=${offset}-${offset + length - 1}`,
            };
            if (etag !== undefined) headers['If-Range'] = etag;
            const response = await fetcher(url, {
              headers,
              signal:
                readSignal === undefined
                  ? attemptSignal
                  : AbortSignal.any([attemptSignal, readSignal]),
            });
            if (response.status === 200) {
              // With If-Range, a full response means the file changed underneath us.
              if (etag !== undefined) throw new PackChangedError(url);
              const all = await fetchBytes(response);
              options.onResponse(all.length);
              return all.subarray(offset, offset + length);
            }
            if (response.status !== 206) throw new HttpStatusError(url, response.status);
            const bytes = await fetchBytes(response);
            options.onResponse(bytes.length);
            if (bytes.length !== length) {
              throw new Error(`range ${offset}+${length} of ${url} returned ${bytes.length} bytes`);
            }
            return bytes;
          },
          retry,
          signal,
        ),
    }),
  };
}

interface Waiter {
  offset: number;
  length: number;
  high: boolean;
  resolve(bytes: Uint8Array): void;
  reject(error: unknown): void;
}

export interface SchedulerOptions {
  /** Requests in flight at once (default 6). */
  concurrency?: number;
  /** Merge reads whose gap is at most this many bytes (default 32 KiB). */
  mergeGap?: number;
  /** Never merge into a single request longer than this (default 4 MiB). */
  maxSpan?: number;
}

/**
 * Queue reads for one source. Reads issued in the same tick are sorted, merged when close
 * together, and run with bounded concurrency, high priority first.
 */
export class ReadScheduler {
  private queue: Waiter[] = [];
  private flushing = false;
  private running = 0;
  private batches: { start: number; end: number; high: boolean; waiters: Waiter[] }[] = [];
  private readonly concurrency: number;
  private readonly mergeGap: number;
  private readonly maxSpan: number;

  constructor(
    private readonly reader: RangeReader,
    private readonly signal: AbortSignal,
    options: SchedulerOptions = {},
  ) {
    this.concurrency = Math.max(1, options.concurrency ?? 6);
    this.mergeGap = options.mergeGap ?? 32 * 1024;
    this.maxSpan = options.maxSpan ?? 4 * 1024 * 1024;
  }

  read(offset: number, length: number, high = true, signal?: AbortSignal): Promise<Uint8Array> {
    if (length === 0) return Promise.resolve(new Uint8Array(0));
    return new Promise<Uint8Array>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      // Aborting one read rejects only that caller; a merged request serving others continues.
      const abort = (): void => reject(signal?.reason);
      signal?.addEventListener('abort', abort, { once: true });
      this.queue.push({
        offset,
        length,
        high,
        resolve: (bytes) => {
          signal?.removeEventListener('abort', abort);
          resolve(bytes);
        },
        reject: (error) => {
          signal?.removeEventListener('abort', abort);
          reject(error);
        },
      });
      if (!this.flushing) {
        this.flushing = true;
        queueMicrotask(() => this.flush());
      }
    });
  }

  private flush(): void {
    this.flushing = false;
    const waiters = this.queue.sort((a, b) => a.offset - b.offset);
    this.queue = [];
    for (const waiter of waiters) {
      const last = this.batches.at(-1);
      const end = waiter.offset + waiter.length;
      // `last` may be a queued batch from an earlier flush; batches that started are no longer
      // in the list, so merging into it is safe.
      if (
        last !== undefined &&
        waiter.offset - last.end <= this.mergeGap &&
        Math.max(last.end, end) - last.start <= this.maxSpan &&
        last.start <= waiter.offset
      ) {
        last.end = Math.max(last.end, end);
        last.high ||= waiter.high;
        last.waiters.push(waiter);
      } else {
        this.batches.push({ start: waiter.offset, end, high: waiter.high, waiters: [waiter] });
      }
    }
    // High-priority batches run first; the sort is stable, so offsets stay ordered within each.
    this.batches.sort((a, b) => Number(b.high) - Number(a.high));
    this.pump();
  }

  private pump(): void {
    if (this.signal.aborted) {
      for (const batch of this.batches.splice(0)) {
        for (const waiter of batch.waiters) waiter.reject(this.signal.reason);
      }
      return;
    }
    while (this.running < this.concurrency && this.batches.length > 0) {
      const batch = this.batches.shift() as (typeof this.batches)[number];
      this.running++;
      this.reader
        .read(batch.start, batch.end - batch.start, this.signal)
        .then(
          (bytes) => {
            for (const waiter of batch.waiters) {
              const from = waiter.offset - batch.start;
              waiter.resolve(bytes.subarray(from, from + waiter.length));
            }
          },
          (error) => {
            for (const waiter of batch.waiters) waiter.reject(error);
          },
        )
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }
}

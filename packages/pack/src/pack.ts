/**
 * Open a pack from any source and read its files. Only the tail of a remote pack is fetched up
 * front (manifest and central directory); files are read on demand, and small documents that
 * share a solid block arrive together.
 */

import {
  PACK_MANIFEST_ENTRY,
  type PackEntry,
  type PackManifest,
  validate,
} from '@bendyline/molen-schema';
import { describePack, type PackFile, type PackOptions, sha256 } from './build';
import {
  blobReader,
  openUrl,
  type PackRetryOptions,
  type RangeReader,
  ReadScheduler,
  TAIL_BYTES,
} from './source';
import {
  decodeMember,
  findZipEnd,
  LOCAL_HEADER_LENGTH,
  localDataOffset,
  parseCentralDirectory,
  type ZipMember,
} from './zip';

/** Where a pack's bytes come from: a URL, a file the user picked, bytes, or your own reader. */
export type PackInput = string | URL | Blob | ArrayBuffer | Uint8Array | RangeReader;

export interface PackProgress {
  /** The pack's label (URL, file name, ...). */
  label: string;
  /** Bytes read from the source so far. */
  bytes: number;
  /** Reads (network requests, for a URL) so far. */
  requests: number;
}

export interface OpenPackOptions {
  /** 'auto' (default) picks whole or range reads; 'whole' downloads the file in one request. */
  mode?: 'auto' | 'whole' | 'range';
  /** Expected size in bytes; with `auto`, packs up to `wholeThreshold` are fetched whole. */
  sizeHint?: number;
  /** Default 4 MiB. */
  wholeThreshold?: number;
  fetch?: typeof fetch;
  /** Aborts opening and every later read. */
  signal?: AbortSignal;
  retry?: PackRetryOptions;
  /** Reads in flight at once (default 6). */
  concurrency?: number;
  /** 'crc' (default) checks each zip member; 'sha256' also checks every file's hash. */
  integrity?: 'crc' | 'sha256';
  /** Fail to open unless the manifest's contentHash matches. */
  expect?: { contentHash: string };
  /** Decoded bytes kept for reuse (default 16 MiB). */
  maxCacheBytes?: number;
  onProgress?(progress: PackProgress): void;
  /** Name used in errors and progress (default: the URL, or "bytes"/"blob"/"reader"). */
  label?: string;
}

export interface ReadOptions {
  signal?: AbortSignal;
  /** Low-priority reads wait behind high-priority ones (default 'high'). */
  priority?: 'high' | 'low';
}

export interface Pack {
  readonly manifest: PackManifest;
  readonly label: string;
  has(path: string): boolean;
  /** Every file path, sorted. */
  paths(): string[];
  readBytes(path: string, options?: ReadOptions): Promise<ArrayBuffer>;
  readText(path: string, options?: ReadOptions): Promise<string>;
  readJson<T = unknown>(path: string, options?: ReadOptions): Promise<T>;
  /** Start fetching files now so later reads are served from the cache. */
  prefetch(paths: readonly string[], options?: ReadOptions): Promise<void>;
  /** Abort outstanding reads and drop cached bytes. */
  close(): void;
}

export class PackEntryNotFoundError extends Error {
  constructor(
    readonly pack: string,
    readonly path: string,
  ) {
    super(`pack "${pack}" has no file "${path}"`);
    this.name = 'PackEntryNotFoundError';
  }
}

export class PackIntegrityError extends Error {
  constructor(pack: string, path: string, detail: string) {
    super(`pack "${pack}" file "${path}" failed its integrity check: ${detail}`);
    this.name = 'PackIntegrityError';
  }
}

abstract class BasePack implements Pack {
  abstract readonly manifest: PackManifest;
  abstract readonly label: string;
  abstract readBytes(path: string, options?: ReadOptions): Promise<ArrayBuffer>;
  abstract prefetch(paths: readonly string[], options?: ReadOptions): Promise<void>;
  abstract close(): void;

  has(path: string): boolean {
    return this.manifest.entries[path] !== undefined;
  }

  paths(): string[] {
    return Object.keys(this.manifest.entries).sort();
  }

  protected entry(path: string): PackEntry {
    const entry = this.manifest.entries[path];
    if (entry === undefined) throw new PackEntryNotFoundError(this.manifest.id, path);
    return entry;
  }

  async readText(path: string, options?: ReadOptions): Promise<string> {
    return new TextDecoder().decode(await this.readBytes(path, options));
  }

  async readJson<T = unknown>(path: string, options?: ReadOptions): Promise<T> {
    const text = await this.readText(path, options);
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`pack "${this.manifest.id}" file "${path}" is not valid JSON`, {
        cause: error,
      });
    }
  }
}

/** Decoded zip members, least recently used first, bounded by total bytes. */
class ByteCache {
  private readonly entries = new Map<string, Promise<Uint8Array>>();
  private readonly sizes = new Map<string, number>();
  private total = 0;

  constructor(private readonly limit: number) {}

  get(key: string, load: () => Promise<Uint8Array>): Promise<Uint8Array> {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit;
    }
    const pending = load();
    this.entries.set(key, pending);
    pending.then(
      (bytes) => {
        if (this.entries.get(key) !== pending) return;
        if (bytes.length > this.limit) {
          this.entries.delete(key);
          return;
        }
        this.sizes.set(key, bytes.length);
        this.total += bytes.length;
        for (const [oldest] of this.entries) {
          if (this.total <= this.limit) break;
          const size = this.sizes.get(oldest);
          if (size === undefined) continue;
          this.entries.delete(oldest);
          this.sizes.delete(oldest);
          this.total -= size;
        }
      },
      // A failed read is not cached; the next read tries again.
      () => {
        if (this.entries.get(key) === pending) this.entries.delete(key);
      },
    );
    return pending;
  }

  clear(): void {
    this.entries.clear();
    this.sizes.clear();
    this.total = 0;
  }
}

function copy(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/** Settle with `promise`, or reject early when `signal` aborts; the work itself continues. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

class ZipPack extends BasePack {
  private readonly cache: ByteCache;

  constructor(
    readonly manifest: PackManifest,
    readonly label: string,
    private readonly members: ReadonlyMap<string, ZipMember>,
    private readonly size: number,
    private readonly window: { start: number; bytes: Uint8Array },
    private readonly scheduler: ReadScheduler | undefined,
    private readonly controller: AbortController,
    private readonly options: OpenPackOptions,
  ) {
    super();
    this.cache = new ByteCache(options.maxCacheBytes ?? 16 * 1024 * 1024);
  }

  /** Loads are shared between callers, so they run under the pack's signal, not a caller's. */
  private range(offset: number, length: number, high: boolean): Promise<Uint8Array> {
    const { start, bytes } = this.window;
    if (offset >= start && offset + length <= start + bytes.length) {
      return Promise.resolve(bytes.subarray(offset - start, offset - start + length));
    }
    if (this.scheduler === undefined) {
      return Promise.reject(new Error(`pack ${this.label} is truncated`));
    }
    return this.scheduler.read(offset, length, high);
  }

  private member(name: string, options?: ReadOptions): Promise<Uint8Array> {
    if (this.controller.signal.aborted) return Promise.reject(this.controller.signal.reason);
    const member = this.members.get(name);
    if (member === undefined) {
      return Promise.reject(
        new Error(`pack "${this.manifest.id}" is missing zip member "${name}"`),
      );
    }
    const high = options?.priority !== 'low';
    const load = this.cache.get(name, async () => {
      // Guess the local header's length so header and data usually arrive in one read.
      const guess = LOCAL_HEADER_LENGTH + new TextEncoder().encode(name).length + 64;
      const want = Math.min(guess + member.compressedSize, this.size - member.localOffset);
      let chunk = await this.range(member.localOffset, want, high);
      const dataStart = localDataOffset(chunk);
      if (dataStart + member.compressedSize > chunk.length) {
        chunk = await this.range(member.localOffset, dataStart + member.compressedSize, high);
      }
      const data = decodeMember(
        member,
        chunk.subarray(dataStart, dataStart + member.compressedSize),
      );
      // A stored member is a view into a larger buffer; keep only its own bytes.
      return member.method === 0 ? data.slice() : data;
    });
    return untilAborted(load, options?.signal);
  }

  private async bytes(path: string, options?: ReadOptions): Promise<Uint8Array> {
    const entry = this.entry(path);
    if (entry.block === undefined) return this.member(path, options);
    const block = this.manifest.blocks[entry.block];
    if (block === undefined)
      throw new Error(`pack "${this.manifest.id}" has no block "${entry.block}"`);
    const data = await this.member(block.entry, options);
    const offset = entry.offset ?? 0;
    return data.subarray(offset, offset + entry.size);
  }

  async readBytes(path: string, options?: ReadOptions): Promise<ArrayBuffer> {
    const entry = this.entry(path);
    const bytes = await this.bytes(path, options);
    if (this.options.integrity === 'sha256') {
      const actual = await sha256(bytes);
      if (actual !== entry.sha256) {
        throw new PackIntegrityError(this.manifest.id, path, `sha256 is ${actual}`);
      }
    }
    return copy(bytes);
  }

  async prefetch(paths: readonly string[], options?: ReadOptions): Promise<void> {
    await Promise.all(paths.map((path) => this.bytes(path, options)));
  }

  close(): void {
    this.controller.abort(new Error(`pack "${this.manifest.id}" was closed`));
    this.cache.clear();
  }
}

class MemoryPack extends BasePack {
  constructor(
    readonly manifest: PackManifest,
    readonly label: string,
    private files: Map<string, Uint8Array>,
  ) {
    super();
  }

  async readBytes(path: string): Promise<ArrayBuffer> {
    this.entry(path);
    return copy(this.files.get(path) as Uint8Array);
  }

  async prefetch(): Promise<void> {}

  close(): void {
    this.files = new Map();
  }
}

/**
 * A pack over loose files, with the same manifest a built pack of those files would have. For
 * tests, development, and content generated at runtime.
 */
export async function packFromFiles(
  files: readonly PackFile[],
  options: PackOptions,
  label: string = options.id,
): Promise<Pack> {
  const manifest = await describePack(files, options);
  return new MemoryPack(manifest, label, new Map(files.map((file) => [file.path, file.bytes])));
}

function isRangeReader(input: unknown): input is RangeReader {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as RangeReader).read === 'function' &&
    typeof (input as RangeReader).size === 'number'
  );
}

function defaultLabel(input: PackInput): string {
  if (typeof input === 'string' || input instanceof URL) return String(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return (input as Blob & { name?: string }).name ?? 'blob';
  }
  if (isRangeReader(input)) return 'reader';
  return 'bytes';
}

/** Open a pack. Reads only the manifest and zip directory; files are fetched when read. */
export async function openPack(input: PackInput, options: OpenPackOptions = {}): Promise<Pack> {
  const label = options.label ?? defaultLabel(input);
  const controller = new AbortController();
  const signal =
    options.signal === undefined
      ? controller.signal
      : AbortSignal.any([options.signal, controller.signal]);
  let bytesRead = 0;
  let requests = 0;
  const counted = (bytes: number): void => {
    bytesRead += bytes;
    requests++;
    options.onProgress?.({ label, bytes: bytesRead, requests });
  };
  const counting = (reader: RangeReader): RangeReader => ({
    size: reader.size,
    read: async (offset, length, readSignal) => {
      const bytes = await reader.read(offset, length, readSignal);
      counted(bytes.length);
      return bytes;
    },
  });

  let reader: RangeReader | undefined;
  let tail: Uint8Array;
  let tailStart: number | undefined;
  let size: number | undefined;
  if (typeof input === 'string' || input instanceof URL) {
    const fetcher = options.fetch ?? globalThis.fetch;
    if (fetcher === undefined) throw new Error('openPack needs fetch to read a URL');
    const opened = await openUrl(String(input), {
      fetch: fetcher,
      retry: options.retry ?? {},
      signal,
      mode: options.mode ?? 'auto',
      ...(options.sizeHint !== undefined ? { sizeHint: options.sizeHint } : {}),
      wholeThreshold: options.wholeThreshold ?? 4 * 1024 * 1024,
      onResponse: counted,
    });
    if (opened.kind === 'whole') {
      tail = opened.bytes;
      tailStart = 0;
      size = opened.bytes.length;
    } else {
      tail = opened.tail;
      if (opened.size !== undefined) {
        size = opened.size;
        tailStart = size - tail.length;
      }
      const end = findZipEnd(tail, tailStart);
      size ??= end.archiveSize;
      tailStart ??= size - tail.length;
      // openUrl reports its own responses through onResponse.
      reader = opened.reader(size);
    }
  } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    // Bytes in memory: the whole pack is the read window.
    tail = input instanceof Uint8Array ? input : new Uint8Array(input);
    tailStart = 0;
    size = tail.length;
  } else {
    if (typeof Blob !== 'undefined' && input instanceof Blob) reader = counting(blobReader(input));
    else if (isRangeReader(input)) reader = counting(input);
    else throw new Error('openPack: unsupported input');
    size = reader.size;
    const length = Math.min(size, TAIL_BYTES);
    tailStart = size - length;
    tail = await reader.read(tailStart, length, signal);
  }
  const archiveSize = size as number;
  const windowStart = tailStart as number;
  const scheduler =
    reader === undefined
      ? undefined
      : new ReadScheduler(reader, signal, {
          ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
        });
  const read = (offset: number, length: number): Promise<Uint8Array> => {
    if (offset >= windowStart && offset + length <= windowStart + tail.length) {
      return Promise.resolve(tail.subarray(offset - windowStart, offset - windowStart + length));
    }
    if (scheduler === undefined) return Promise.reject(new Error(`pack ${label} is truncated`));
    return scheduler.read(offset, length);
  };

  const end = findZipEnd(tail, windowStart);
  const members = parseCentralDirectory(
    await read(end.centralOffset, end.centralSize),
    end.entries,
  );
  const manifestMember = members.get(PACK_MANIFEST_ENTRY);
  if (manifestMember === undefined) {
    throw new Error(`${label} is not a Molen pack: it has no ${PACK_MANIFEST_ENTRY}`);
  }
  const header = await read(
    manifestMember.localOffset,
    Math.min(LOCAL_HEADER_LENGTH + 512, archiveSize - manifestMember.localOffset),
  );
  const dataStart = manifestMember.localOffset + localDataOffset(header);
  const manifestBytes = decodeMember(
    manifestMember,
    await read(dataStart, manifestMember.compressedSize),
  );
  let manifestDoc: unknown;
  try {
    manifestDoc = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (error) {
    throw new Error(`${label}: ${PACK_MANIFEST_ENTRY} is not valid JSON`, { cause: error });
  }
  const parsed = validate('pack', manifestDoc);
  if (!parsed.ok) throw new Error(`${label}: invalid pack manifest\n${parsed.formatted}`);
  const manifest = parsed.value;
  if (options.expect !== undefined && manifest.contentHash !== options.expect.contentHash) {
    throw new Error(
      `${label}: pack "${manifest.id}" has contentHash ${manifest.contentHash}, expected ${options.expect.contentHash}`,
    );
  }
  for (const [path, entry] of Object.entries(manifest.entries)) {
    if (entry.block === undefined && !members.has(path)) {
      throw new Error(
        `${label}: pack "${manifest.id}" lists "${path}" but the zip has no such member`,
      );
    }
  }
  for (const [name, block] of Object.entries(manifest.blocks)) {
    if (!members.has(block.entry)) {
      throw new Error(`${label}: pack "${manifest.id}" block "${name}" is missing from the zip`);
    }
  }
  return new ZipPack(
    manifest,
    label,
    members,
    archiveSize,
    { start: windowStart, bytes: tail },
    scheduler,
    controller,
    options,
  );
}

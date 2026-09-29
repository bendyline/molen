import type { Pack, ReadOptions } from '@bendyline/molen-pack';

/** Logical model paths remain in the style pack; their bytes live in bounded regional packs. */
export interface ModelArchivesDoc {
  format: 'molen/model-archives@1';
  archives: Record<string, { contentHash: string }>;
  files: Record<string, string>;
  ids: Record<string, string>;
}

export interface ModelArchiveOptions {
  /** Idle archive handles retained after reads (default 4). Active reads are never evicted. */
  maxOpenArchives?: number;
}

/** Hosts can open regional archives from URLs, local bytes, or their own storage. */
export type OpenModelArchive = (
  id: string,
  contentHash: string,
  signal: AbortSignal,
) => Promise<Pack>;

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !/[\\:]/.test(path) &&
    [...path].every((character) => character.charCodeAt(0) >= 32) &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

function routesFrom(raw: unknown): ModelArchivesDoc {
  const doc = raw as ModelArchivesDoc;
  if (
    doc?.format !== 'molen/model-archives@1' ||
    !doc.archives ||
    !doc.files ||
    !doc.ids ||
    [doc.archives, doc.files, doc.ids].some(
      (value) => typeof value !== 'object' || Array.isArray(value),
    )
  )
    throw new Error('Invalid model archive routes');
  for (const [id, entry] of Object.entries(doc.archives)) {
    if (
      !/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/.test(id) ||
      !/^sha256:[a-f0-9]{64}$/.test(entry?.contentHash)
    ) {
      throw new Error(`Invalid model archive: ${id}`);
    }
  }
  for (const [path, id] of Object.entries(doc.files)) {
    if (!safePath(path) || typeof id !== 'string' || !Object.hasOwn(doc.archives, id))
      throw new Error(`Invalid model archive route: ${path}`);
  }
  for (const [id, path] of Object.entries(doc.ids)) {
    if (!id || typeof path !== 'string' || !Object.hasOwn(doc.files, path))
      throw new Error(`Invalid routed model id: ${id}`);
  }
  return doc;
}

function aborted(): DOMException {
  return new DOMException('Model archive reader is closed or aborted', 'AbortError');
}

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const abort = (): void => reject(aborted());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/**
 * Add lazy model reads to a style core. Its manifest still describes the verified physical
 * archive; has/paths/read additionally expose only paths explicitly registered in its route
 * document. Closing the returned pack closes the core and every regional archive it opened.
 * Packs without the model-archives role are returned unchanged.
 */
export async function withModelArchives(
  core: Pack,
  openArchive: OpenModelArchive,
  options: ModelArchiveOptions = {},
): Promise<Pack> {
  const documents = core.manifest.provides['model-archives'];
  if (!documents?.length) return core;
  if (documents.length !== 1)
    throw new Error('A style core must have one model archive route document');
  const doc = routesFrom(await core.readJson(documents[0] as string));
  for (const path of Object.keys(doc.files)) {
    if (core.has(path)) throw new Error(`Model archive route shadows a core file: ${path}`);
  }
  for (const id of Object.keys(doc.ids)) {
    if (core.has(id) || Object.hasOwn(core.manifest.ids, id))
      throw new Error(`Routed model id shadows a core asset: ${id}`);
  }
  const limit = options.maxOpenArchives ?? 4;
  if (!Number.isInteger(limit) || limit < 0)
    throw new Error('maxOpenArchives must be a nonnegative integer');
  const controller = new AbortController();
  let closed = false;
  let clock = 0;
  type Resident = { promise: Promise<Pack>; pack?: Pack; readers: number; last: number };
  const residents = new Map<string, Resident>();
  const evict = (): void => {
    const idle = [...residents]
      .filter(([, value]) => value.readers === 0 && value.pack !== undefined)
      .sort((a, b) => a[1].last - b[1].last);
    while (residents.size > limit && idle.length) {
      const [id, resident] = idle.shift() as [string, Resident];
      residents.delete(id);
      resident.pack?.close();
    }
  };
  const pathOf = (path: string): string =>
    Object.hasOwn(doc.ids, path) ? (doc.ids[path] as string) : path;
  const readBytes = async (requested: string, readOptions?: ReadOptions): Promise<ArrayBuffer> => {
    if (closed || readOptions?.signal?.aborted) throw aborted();
    const signal = readOptions?.signal
      ? AbortSignal.any([controller.signal, readOptions.signal])
      : controller.signal;
    const path = pathOf(requested);
    const id = Object.hasOwn(doc.files, path) ? doc.files[path] : undefined;
    if (id === undefined) return core.readBytes(requested, readOptions);
    let resident = residents.get(id);
    if (!resident) {
      const contentHash = (doc.archives[id] as { contentHash: string }).contentHash;
      const created: Resident = {
        promise: undefined as unknown as Promise<Pack>,
        readers: 0,
        last: ++clock,
      };
      residents.set(id, created);
      created.promise = Promise.resolve()
        .then(() => {
          if (closed) throw aborted();
          return openArchive(id, contentHash, controller.signal);
        })
        .then((pack) => {
          if (closed) {
            pack.close();
            throw aborted();
          }
          if (pack.manifest.id !== id || pack.manifest.contentHash !== contentHash) {
            pack.close();
            throw new Error(`Model archive identity/hash mismatch: ${id}`);
          }
          created.pack = pack;
          evict();
          return pack;
        })
        .catch((error: unknown) => {
          if (residents.get(id) === created) residents.delete(id);
          throw error;
        });
      resident = created;
    }
    resident.readers++;
    resident.last = ++clock;
    try {
      const pack = await waitFor(resident.promise, signal);
      if (closed) throw aborted();
      return await pack.readBytes(path, { ...readOptions, signal });
    } finally {
      resident.readers--;
      resident.last = ++clock;
      evict();
    }
  };
  const readText = async (path: string, readOptions?: ReadOptions): Promise<string> =>
    new TextDecoder().decode(await readBytes(path, readOptions));
  return {
    manifest: core.manifest,
    label: core.label,
    has: (path) => core.has(path) || Object.hasOwn(doc.files, pathOf(path)),
    paths: () => [...core.paths(), ...Object.keys(doc.files)].sort(),
    readBytes,
    readText,
    readJson: async <T>(path: string, readOptions?: ReadOptions) =>
      JSON.parse(await readText(path, readOptions)) as T,
    prefetch: async (paths, readOptions) => {
      await Promise.all(paths.map((path) => readBytes(path, readOptions)));
    },
    close: () => {
      if (closed) return;
      closed = true;
      controller.abort();
      core.close();
      for (const resident of residents.values()) resident.pack?.close();
      residents.clear();
    },
  };
}

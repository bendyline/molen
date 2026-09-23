import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, join, posix, resolve } from 'node:path';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { createPackSet, openPack, type Pack, type PackSet } from '@bendyline/molen-pack';
import { openPackAt } from '@bendyline/molen-pack/node';
import type { ContentIdentity, ProjectPackRef, ScriptRef, TypesDoc } from '@bendyline/molen-schema';

// Content packs for the CLI and MCP server. A project lists its packs in project.json `packs`;
// MOLEN_PACKS adds more (paths or URLs, separated like PATH). Nothing is fetched unless a pack is
// listed: there is no built-in default location.

/** Where downloaded packs are cached: $MOLEN_CACHE_DIR, else the XDG cache, else ~/.cache. */
export function packCacheDir(): string {
  const explicit = process.env.MOLEN_CACHE_DIR;
  if (explicit !== undefined && explicit !== '') return resolve(explicit);
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg !== undefined && xdg !== '' ? xdg : join(homedir(), '.cache');
  return join(base, 'molen', 'packs');
}

const isUrl = (source: string): boolean => /^https?:\/\//.test(source);
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export interface OpenContentOptions {
  /** Never download; URL packs must already be cached (also MOLEN_OFFLINE=1). */
  offline?: boolean;
  cacheDir?: string;
}

/**
 * Open one pack source: a URL (downloaded once into the cache; a pinned contentHash keys the
 * cache entry and is checked), a built pack file, or a pack source directory.
 */
export async function openContentPack(
  source: string,
  base: string,
  options: OpenContentOptions & { contentHash?: string } = {},
): Promise<Pack> {
  const expect =
    options.contentHash !== undefined ? { expect: { contentHash: options.contentHash } } : {};
  if (!isUrl(source)) return openPackAt(resolve(base, source), expect);
  const offline = options.offline === true || process.env.MOLEN_OFFLINE === '1';
  const cacheDir = options.cacheDir ?? packCacheDir();
  const key =
    options.contentHash !== undefined
      ? options.contentHash.replace('sha256:', '')
      : `url-${sha256(source)}`;
  const cached = join(cacheDir, `${key}.zip`);
  const pinned = options.contentHash !== undefined;
  // A pinned pack is immutable, so a cached copy is always good; an unpinned URL is re-fetched
  // unless we are offline.
  if (pinned || offline) {
    try {
      return await openPack(new Uint8Array(await readFile(cached)), { label: source, ...expect });
    } catch (error) {
      if (offline) {
        throw new Error(`pack ${source} is not in the cache (${cached}) and MOLEN_OFFLINE is set`, {
          cause: error,
        });
      }
    }
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`HTTP ${response.status} for pack ${source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pack = await openPack(bytes, { label: source, ...expect });
  await mkdir(cacheDir, { recursive: true });
  const temporary = `${cached}.${process.pid}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, cached);
  return pack;
}

/** Pack sources from MOLEN_PACKS, separated like PATH. */
export function envPackSources(): string[] {
  return (process.env.MOLEN_PACKS ?? '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * Every pack a project uses, in precedence order: project.json `packs` (paths relative to the
 * project), then MOLEN_PACKS (relative to the working directory). Later packs win.
 */
export async function openProjectPacks(
  project: { dir: string; packs: readonly ProjectPackRef[] } | undefined,
  options: OpenContentOptions & { cwd?: string } = {},
): Promise<PackSet> {
  const set = createPackSet();
  for (const ref of project?.packs ?? []) {
    set.add(
      await openContentPack(ref.source, project?.dir ?? '.', {
        ...options,
        ...(ref.contentHash !== undefined ? { contentHash: ref.contentHash } : {}),
      }),
    );
  }
  for (const source of envPackSources()) {
    set.add(await openContentPack(source, options.cwd ?? process.cwd(), options));
  }
  return set;
}

/** Pack labels as "id@version". */
export function packLabels(packs: readonly Pack[]): string[] {
  return packs.map((pack) => `${pack.manifest.id}@${pack.manifest.version}`);
}

export interface PackTypeDocs {
  docs: { doc: TypesDoc; source: string }[];
  /** Content identity of the pack-provided types, when any pack provides some. */
  identity?: ContentIdentity;
}

/**
 * The molen/types@1 documents packs provide (role `types`), with script `path` refs inlined from
 * the same pack. `validateDoc` validates each document against the project's vocabulary.
 */
export async function packTypeDocuments(
  set: PackSet,
  validateDoc: (raw: unknown, source: string) => TypesDoc,
  stripTypes: (source: string, file: string) => string,
): Promise<PackTypeDocs> {
  const provided = set.provided('types');
  const docs: PackTypeDocs['docs'] = [];
  for (const { pack, path } of provided) {
    const source = `pack:${pack.manifest.id}/${path}`;
    const doc = validateDoc(await pack.readJson(path), source);
    for (const def of Object.values(doc.types)) {
      for (const script of def.scripts as ScriptRef[]) {
        if (script.path === undefined) continue;
        const file = posix.join(posix.dirname(path), script.path);
        const text = await pack.readText(file);
        script.code = file.endsWith('.ts') ? stripTypes(text, file) : text;
        delete script.path;
      }
    }
    docs.push({ doc, source });
  }
  if (docs.length === 0) return { docs };
  const owners = [...new Set(provided.map(({ pack }) => pack))];
  return {
    docs,
    identity: {
      types: {
        hash: createTypeLibrary(docs.map(({ doc }) => doc)).hash,
        packs: packLabels(owners),
      },
    },
  };
}

/** The file the last pack providing a role holds, read as JSON, with a reader beside it. */
export async function providedDocument(
  set: PackSet,
  role: string,
): Promise<
  { doc: unknown; readBeside(relative: string): Promise<unknown>; label: string } | undefined
> {
  const hits = set.provided(role);
  const hit = hits[hits.length - 1];
  if (hit === undefined) return undefined;
  const dir = posix.dirname(hit.path);
  return {
    doc: await hit.pack.readJson(hit.path),
    readBeside: (relative) => hit.pack.readJson(dir === '.' ? relative : posix.join(dir, relative)),
    label: `pack:${hit.pack.manifest.id}/${hit.path}`,
  };
}

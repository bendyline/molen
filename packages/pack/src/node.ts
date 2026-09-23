// Node-only pack helpers: open packs from files and source directories, build them, extract them.

import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  type PackIndex,
  type PackManifest,
  type PackSourceConfig,
  validate,
} from '@bendyline/molen-schema';
import { createPack, type PackFile, type PackOptions, sha256 } from './build';
import { type OpenPackOptions, openPack, type Pack, packFromFiles } from './pack';
import type { RangeReader } from './source';

/** Build settings file in a pack's source directory. */
export const PACK_SOURCE_FILE = 'molen-pack.source.json';
/** Index written next to built packs. */
export const PACK_INDEX_FILE = 'index.json';

/** Open a built pack file. Reads go to the file on demand; close() releases it. */
export async function openFilePack(path: string, options: OpenPackOptions = {}): Promise<Pack> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const reader: RangeReader = {
      size,
      read: async (offset, length) => {
        const buffer = new Uint8Array(length);
        const { bytesRead } = await handle.read(buffer, 0, length, offset);
        if (bytesRead !== length) throw new Error(`${path}: short read at ${offset}`);
        return buffer;
      },
    };
    const pack = await openPack(reader, { label: path, ...options });
    const close = pack.close.bind(pack);
    pack.close = () => {
      close();
      void handle.close();
    };
    return pack;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

function globToRegExp(glob: string): RegExp {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] as string;
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      pattern += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (char === '*') pattern += '[^/]*';
    else if (char === '?') pattern += '[^/]';
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${pattern}$`);
}

async function walk(dir: string, root: string, out: string[]): Promise<void> {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) await walk(full, root, out);
    else if (item.isFile()) out.push(relative(root, full).split(sep).join('/'));
  }
}

export interface PackSource {
  dir: string;
  config: PackSourceConfig;
  files: PackFile[];
}

/** Read a pack's source directory: its settings file and every file it includes. */
export async function readPackSource(dir: string): Promise<PackSource> {
  const root = resolve(dir);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, PACK_SOURCE_FILE), 'utf8'));
  } catch (error) {
    throw new Error(`${root} has no readable ${PACK_SOURCE_FILE}`, { cause: error });
  }
  const parsed = validate('pack-source', raw);
  if (!parsed.ok) throw new Error(`${join(root, PACK_SOURCE_FILE)}:\n${parsed.formatted}`);
  const config = parsed.value;
  const include = config.include.map(globToRegExp);
  const exclude = config.exclude.map(globToRegExp);
  const paths: string[] = [];
  await walk(root, root, paths);
  const selected = paths
    .filter((path) => path !== PACK_SOURCE_FILE)
    .filter((path) => include.some((glob) => glob.test(path)))
    .filter((path) => !exclude.some((glob) => glob.test(path)))
    .sort();
  const files = await Promise.all(
    selected.map(async (path) => ({
      path,
      bytes: new Uint8Array(await readFile(join(root, ...path.split('/')))),
    })),
  );
  return { dir: root, config, files };
}

function optionsOf(config: PackSourceConfig): PackOptions {
  return {
    id: config.id,
    version: config.version,
    ...(config.title !== undefined ? { title: config.title } : {}),
    ...(config.license !== undefined ? { license: config.license } : {}),
    ...(config.notice !== undefined ? { notice: config.notice } : {}),
    ids: config.ids,
    provides: config.provides,
    solid: config.solid,
  };
}

/**
 * Open an unbuilt pack source directory as a pack. It has the manifest the built pack would
 * have (same entries, ids and contentHash), without zipping anything.
 */
export async function openDirPack(
  dir: string,
  options: Pick<OpenPackOptions, 'expect'> = {},
): Promise<Pack> {
  const source = await readPackSource(dir);
  const pack = await packFromFiles(source.files, optionsOf(source.config), source.dir);
  const expected = options.expect?.contentHash;
  if (expected !== undefined && pack.manifest.contentHash !== expected) {
    throw new Error(
      `${source.dir}: pack "${pack.manifest.id}" has contentHash ${pack.manifest.contentHash}, expected ${expected}`,
    );
  }
  return pack;
}

/** Open a pack from a URL, a built pack file, or a pack source directory. */
export async function openPackAt(source: string, options: OpenPackOptions = {}): Promise<Pack> {
  if (/^https?:\/\//.test(source)) return openPack(source, options);
  const info = await stat(source);
  return info.isDirectory() ? openDirPack(source, options) : openFilePack(source, options);
}

export interface BuiltPackFile {
  manifest: PackManifest;
  /** File name, `<id>-<first 12 hex of the file's sha256>.zip`. */
  file: string;
  /** Absolute path of the written file. */
  path: string;
  size: number;
  /** sha256 of the file's bytes. */
  fileSha256: string;
  /** Path of the updated index.json. */
  indexPath: string;
}

async function readIndex(path: string): Promise<PackIndex> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return { format: 'molen/pack-index@1', packs: {} };
  }
  const parsed = validate('pack-index', raw);
  if (!parsed.ok) throw new Error(`${path} is not a pack index:\n${parsed.formatted}`);
  return parsed.value;
}

/**
 * Build a pack source directory into `outDir`. The file name carries a hash of its bytes, so a
 * host can cache it forever; `index.json` in `outDir` maps the pack id to its current file, and
 * the previous build of the same pack is removed.
 */
export async function buildPack(
  dir: string,
  options: { outDir: string; solid?: boolean },
): Promise<BuiltPackFile> {
  const source = await readPackSource(dir);
  const built = await createPack(source.files, {
    ...optionsOf(source.config),
    ...(options.solid !== undefined ? { solid: options.solid } : {}),
  });
  const fileSha256 = await sha256(built.bytes);
  const id = built.manifest.id;
  const file = `${id}-${fileSha256.slice('sha256:'.length, 'sha256:'.length + 12)}.zip`;
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, file);
  await writeFile(path, built.bytes);
  const indexPath = join(outDir, PACK_INDEX_FILE);
  const index = await readIndex(indexPath);
  const previous = index.packs[id]?.file;
  index.packs[id] = {
    version: built.manifest.version,
    file,
    contentHash: built.manifest.contentHash,
    size: built.bytes.length,
  };
  const sorted: PackIndex = {
    format: 'molen/pack-index@1',
    packs: Object.fromEntries(Object.entries(index.packs).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  await writeFile(indexPath, `${JSON.stringify(sorted, null, 2)}\n`);
  const stillListed = Object.values(sorted.packs).some((entry) => entry.file === previous);
  if (previous !== undefined && previous !== file && !stillListed) {
    await rm(join(outDir, previous), { force: true });
  }
  return {
    manifest: built.manifest,
    file,
    path,
    size: built.bytes.length,
    fileSha256,
    indexPath,
  };
}

/**
 * Write every file of a pack into `outDir`, with a `molen-pack.source.json` that builds it back
 * to the same content.
 */
export async function extractPack(pack: Pack, outDir: string): Promise<string[]> {
  const root = resolve(outDir);
  const written: string[] = [];
  for (const path of pack.paths()) {
    const target = join(root, ...path.split('/'));
    if (!target.startsWith(root + sep))
      throw new Error(`refusing to write outside ${root}: ${path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, new Uint8Array(await pack.readBytes(path)));
    written.push(path);
  }
  const { manifest } = pack;
  const config: PackSourceConfig = {
    format: 'molen/pack-source@1',
    id: manifest.id,
    version: manifest.version,
    ...(manifest.title !== undefined ? { title: manifest.title } : {}),
    ...(manifest.license !== undefined ? { license: manifest.license } : {}),
    ...(manifest.notice !== undefined ? { notice: manifest.notice } : {}),
    include: ['**'],
    exclude: [],
    ids: manifest.ids,
    provides: manifest.provides,
    solid: Object.keys(manifest.blocks).length > 0,
  };
  await writeFile(join(root, PACK_SOURCE_FILE), `${JSON.stringify(config, null, 2)}\n`);
  return written;
}

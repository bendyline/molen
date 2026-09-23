/**
 * Turn a set of files into a pack. Pure over bytes, so it runs in Node (molen pack build), a
 * browser editor, or a test. The manifest is validated before any bytes are produced.
 */

import {
  type AssetSidecar,
  PACK_MANIFEST_ENTRY,
  PACK_RESERVED_PREFIX,
  type PackEntry,
  type PackManifest,
  validate,
} from '@bendyline/molen-schema';
import { writeZip, type ZipMemberInput } from './zip';

export interface PackFile {
  /** Pack-relative POSIX path. */
  path: string;
  bytes: Uint8Array;
}

export interface PackOptions {
  id: string;
  version: string;
  title?: string;
  license?: string;
  /** Path of the file carrying the attribution notice. */
  notice?: string;
  /** Asset id to file path. Ids declared by molen/asset@1 sidecars are added automatically. */
  ids?: Record<string, string>;
  /** Role (e.g. `types`, `stylepack`) to the file or files that provide it. */
  provides?: Record<string, string | readonly string[]>;
  /** Group small text files into compressed solid blocks (default true). */
  solid?: boolean;
}

export interface BuiltPack {
  bytes: Uint8Array;
  manifest: PackManifest;
}

/** Largest uncompressed solid block; a group that exceeds it is split. */
const BLOCK_LIMIT = 1 << 20;
/** Text files at least this large are stored as their own member instead of in a block. */
const OWN_MEMBER_LIMIT = BLOCK_LIMIT / 2;

const TEXT_EXTENSIONS = new Set([
  'json',
  'txt',
  'md',
  'ts',
  'mts',
  'js',
  'mjs',
  'csv',
  'svg',
  'glsl',
  'wgsl',
  'html',
  'css',
  'xml',
  'yaml',
  'yml',
]);

const MEDIA_TYPES: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  json: 'application/json',
  bin: 'application/octet-stream',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ktx2: 'image/ktx2',
  svg: 'image/svg+xml',
  md: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/x-typescript',
  mts: 'text/x-typescript',
  glsl: 'text/plain',
  wgsl: 'text/plain',
  wasm: 'application/wasm',
  pmtiles: 'application/vnd.pmtiles',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function mediaTypeOf(path: string): string {
  return MEDIA_TYPES[extension(path)] ?? 'application/octet-stream';
}

export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extension(path));
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  let hex = '';
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
  return `sha256:${hex}`;
}

/** Join a sidecar-relative path onto the sidecar's directory. */
function besideFile(file: string, relative: string): string {
  const slash = file.lastIndexOf('/');
  return slash < 0 ? relative : `${file.slice(0, slash + 1)}${relative}`;
}

function sortedFiles(files: readonly PackFile[]): PackFile[] {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) throw new Error(`pack file "${file.path}" is listed twice`);
    seen.add(file.path);
  }
  return [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Asset ids and variants declared by molen/asset@1 sidecars among the files. */
function sidecarIds(
  files: readonly PackFile[],
  present: ReadonlySet<string>,
): { ids: Record<string, string>; variants: Map<string, Record<string, string>> } {
  const ids: Record<string, string> = {};
  const variants = new Map<string, Record<string, string>>();
  const decoder = new TextDecoder();
  for (const file of files) {
    if (extension(file.path) !== 'json' || file.bytes.length > BLOCK_LIMIT) continue;
    let doc: Partial<AssetSidecar>;
    try {
      doc = JSON.parse(decoder.decode(file.bytes)) as Partial<AssetSidecar>;
    } catch {
      continue;
    }
    if (doc?.format !== 'molen/asset@1' || typeof doc.id !== 'string') continue;
    const main = typeof doc.files?.main === 'string' ? besideFile(file.path, doc.files.main) : '';
    if (!present.has(main)) continue;
    ids[doc.id] = main;
    const found: Record<string, string> = {};
    for (const [name, relative] of Object.entries(doc.files?.variants ?? {})) {
      const path = besideFile(file.path, relative);
      if (present.has(path)) found[name] = path;
    }
    if (Object.keys(found).length > 0) variants.set(main, found);
  }
  return { ids, variants };
}

/**
 * Describe files as a pack manifest with no blocks: entries, ids, roles and the content hash.
 * The content hash covers paths and contents only, so a built pack and its unbuilt source
 * directory report the same one.
 */
export async function describePack(
  files: readonly PackFile[],
  options: PackOptions,
): Promise<PackManifest> {
  const sorted = sortedFiles(files);
  const present = new Set(sorted.map((file) => file.path));
  const derived = sidecarIds(sorted, present);
  const entries: Record<string, PackEntry> = {};
  let hashInput = '';
  for (const file of sorted) {
    const hash = await sha256(file.bytes);
    const entry: PackEntry = {
      size: file.bytes.length,
      sha256: hash,
      mediaType: mediaTypeOf(file.path),
    };
    const variants = derived.variants.get(file.path);
    if (variants !== undefined) entry.variants = variants;
    entries[file.path] = entry;
    hashInput += `${file.path}\t${hash}\n`;
  }
  const ids = Object.fromEntries(
    Object.entries({ ...derived.ids, ...options.ids }).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const provides = Object.fromEntries(
    Object.entries(options.provides ?? {})
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([role, paths]) => [role, typeof paths === 'string' ? [paths] : [...paths]]),
  );
  const manifest: PackManifest = {
    format: 'molen/pack@1',
    id: options.id,
    version: options.version,
    ...(options.title !== undefined ? { title: options.title } : {}),
    ...(options.license !== undefined ? { license: options.license } : {}),
    ...(options.notice !== undefined ? { notice: options.notice } : {}),
    contentHash: await sha256(new TextEncoder().encode(hashInput)),
    provides,
    ids,
    blocks: {},
    entries,
  };
  assertValidManifest(manifest);
  return manifest;
}

export function assertValidManifest(manifest: PackManifest): void {
  const result = validate('pack', manifest);
  if (!result.ok) throw new Error(`invalid pack "${manifest.id}":\n${result.formatted}`);
}

/** Top-level directory of a path; files at the root share one group. */
function groupOf(path: string): string {
  const slash = path.indexOf('/');
  return slash < 0 ? 'root' : path.slice(0, slash);
}

/** Build a pack: a deterministic zip whose last member is the manifest. */
export async function createPack(
  files: readonly PackFile[],
  options: PackOptions,
): Promise<BuiltPack> {
  const sorted = sortedFiles(files);
  for (const file of sorted) {
    if (file.path === PACK_MANIFEST_ENTRY || file.path.startsWith(PACK_RESERVED_PREFIX)) {
      throw new Error(`"${file.path}" is reserved for the pack's own structure`);
    }
  }
  const described = await describePack(sorted, options);
  const entries: Record<string, PackEntry> = structuredClone(described.entries);
  const members: ZipMemberInput[] = [];
  const blocks: PackManifest['blocks'] = {};
  const blockMembers: ZipMemberInput[] = [];
  const pending = new Map<string, PackFile[]>();
  for (const file of sorted) {
    if (options.solid !== false && isTextPath(file.path) && file.bytes.length < OWN_MEMBER_LIMIT) {
      const group = groupOf(file.path);
      pending.set(group, [...(pending.get(group) ?? []), file]);
    } else {
      members.push({ name: file.path, data: file.bytes, compression: 'auto' });
    }
  }
  for (const [group, groupFiles] of [...pending].sort(([a], [b]) => (a < b ? -1 : 1))) {
    let part = 1;
    let chunk: PackFile[] = [];
    let size = 0;
    const flush = (): void => {
      if (chunk.length === 0) return;
      const name = part === 1 ? group : `${group}.${part}`;
      const data = new Uint8Array(size);
      let offset = 0;
      for (const file of chunk) {
        data.set(file.bytes, offset);
        entries[file.path] = { ...(entries[file.path] as PackEntry), block: name, offset };
        offset += file.bytes.length;
      }
      const entry = `${PACK_RESERVED_PREFIX}blocks/${name}.blk`;
      blocks[name] = { entry, size };
      blockMembers.push({ name: entry, data, compression: 'auto' });
      part++;
      chunk = [];
      size = 0;
    };
    for (const file of groupFiles) {
      if (size + file.bytes.length > BLOCK_LIMIT) flush();
      chunk.push(file);
      size += file.bytes.length;
    }
    flush();
  }
  const manifest: PackManifest = { ...described, blocks, entries };
  assertValidManifest(manifest);
  // Manifest last, blocks just before it: one read of the archive's tail usually returns the
  // manifest, the central directory and the small documents together.
  const bytes = writeZip([
    ...members,
    ...blockMembers,
    {
      name: PACK_MANIFEST_ENTRY,
      data: new TextEncoder().encode(JSON.stringify(manifest)),
      compression: 'auto',
    },
  ]);
  return { bytes, manifest };
}

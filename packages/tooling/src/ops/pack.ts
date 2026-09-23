import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { openPack, type Pack, sha256 } from '@bendyline/molen-pack';
import { buildPack, extractPack, openPackAt } from '@bendyline/molen-pack/node';
import {
  type AssetSidecar,
  detectKind,
  getSchema,
  type ProjectPackRef,
  validate,
  validateByKind,
} from '@bendyline/molen-schema';
import { findProjectFile, updateProjectFile } from '../project';
import { guardOp } from './errors';
import { parseJson } from './parse';

// Content packs (molen/pack@1): zip files of models, documents and catalogs that live outside
// the code packages. These ops build, inspect, verify, extract and download them.

export interface BuildPackInput {
  /** Pack source directory (holds molen-pack.source.json). */
  sourceDir: string;
  outDir: string;
  /** Group small text files into solid blocks (default: the source config's setting). */
  solid?: boolean;
}

export interface BuildPackOutput {
  ok: boolean;
  id?: string;
  version?: string;
  file?: string;
  path?: string;
  size?: number;
  contentHash?: string;
  files?: number;
  indexPath?: string;
  error?: string;
}

export async function buildContentPack(input: BuildPackInput): Promise<BuildPackOutput> {
  return guardOp<BuildPackOutput>(
    (error) => ({ ok: false, error }),
    async () => {
      const built = await buildPack(input.sourceDir, {
        outDir: input.outDir,
        ...(input.solid !== undefined ? { solid: input.solid } : {}),
      });
      return {
        ok: true,
        id: built.manifest.id,
        version: built.manifest.version,
        file: built.file,
        path: built.path,
        size: built.size,
        contentHash: built.manifest.contentHash,
        files: Object.keys(built.manifest.entries).length,
        indexPath: built.indexPath,
      };
    },
  );
}

export interface InspectPackInput {
  /** Built pack file, pack source directory, or http(s) URL. */
  source: string;
}

export interface InspectPackOutput {
  ok: boolean;
  id?: string;
  version?: string;
  title?: string;
  license?: string;
  contentHash?: string;
  /** Size of the pack file (absent for a URL or source directory). */
  fileSize?: number;
  /** Total uncompressed size of every file. */
  contentSize?: number;
  files?: number;
  blocks?: { name: string; size: number; files: number }[];
  ids?: Record<string, string>;
  provides?: Record<string, string[]>;
  largest?: { path: string; size: number; mediaType: string }[];
  error?: string;
}

export async function inspectContentPack(input: InspectPackInput): Promise<InspectPackOutput> {
  return guardOp<InspectPackOutput>(
    (error) => ({ ok: false, error }),
    async () => {
      const pack = await openPackAt(input.source);
      try {
        const { manifest } = pack;
        const entries = Object.entries(manifest.entries);
        const fileSize = /^https?:\/\//.test(input.source)
          ? undefined
          : (await stat(input.source)).isFile()
            ? (await stat(input.source)).size
            : undefined;
        return {
          ok: true,
          id: manifest.id,
          version: manifest.version,
          ...(manifest.title !== undefined ? { title: manifest.title } : {}),
          ...(manifest.license !== undefined ? { license: manifest.license } : {}),
          contentHash: manifest.contentHash,
          ...(fileSize !== undefined ? { fileSize } : {}),
          contentSize: entries.reduce((total, [, entry]) => total + entry.size, 0),
          files: entries.length,
          blocks: Object.entries(manifest.blocks).map(([name, block]) => ({
            name,
            size: block.size,
            files: entries.filter(([, entry]) => entry.block === name).length,
          })),
          ids: manifest.ids,
          provides: manifest.provides,
          largest: entries
            .sort(([, a], [, b]) => b.size - a.size)
            .slice(0, 10)
            .map(([path, entry]) => ({ path, size: entry.size, mediaType: entry.mediaType })),
        };
      } finally {
        pack.close();
      }
    },
  );
}

export interface VerifyPackIssue {
  path: string;
  message: string;
}

export interface VerifyPackOutput {
  ok: boolean;
  id?: string;
  /** Files read and checked. */
  checked?: number;
  /** JSON documents validated against their registered schema. */
  validated?: number;
  issues?: VerifyPackIssue[];
  error?: string;
}

/**
 * Read every file (checking CRC and sha256), validate each JSON document whose `format` is a
 * registered schema, and check that asset sidecars' hashes match their models.
 */
export async function verifyContentPack(input: InspectPackInput): Promise<VerifyPackOutput> {
  return guardOp<VerifyPackOutput>(
    (error) => ({ ok: false, error }),
    async () => {
      const pack = await openPackAt(input.source, { integrity: 'sha256' });
      try {
        const issues: VerifyPackIssue[] = [];
        let validated = 0;
        const { manifest } = pack;
        for (const path of pack.paths()) {
          let bytes: ArrayBuffer;
          try {
            bytes = await pack.readBytes(path);
          } catch (error) {
            issues.push({ path, message: error instanceof Error ? error.message : String(error) });
            continue;
          }
          if (!path.endsWith('.json')) continue;
          let doc: unknown;
          try {
            doc = JSON.parse(new TextDecoder().decode(bytes));
          } catch {
            issues.push({ path, message: 'not valid JSON' });
            continue;
          }
          const kind = detectKind(doc);
          if (kind === undefined || getSchema(kind) === undefined) continue;
          validated++;
          const result = validateByKind(kind, doc);
          if (!result.ok) {
            issues.push({ path, message: result.formatted });
            continue;
          }
          if (kind === 'asset') {
            const sidecar = result.value as AssetSidecar;
            const main = posix.join(posix.dirname(path), sidecar.files.main);
            const entry = manifest.entries[main];
            if (entry === undefined) {
              issues.push({ path, message: `sidecar's main file "${main}" is not in the pack` });
            } else if (entry.sha256 !== sidecar.hash) {
              issues.push({
                path,
                message: `sidecar hash ${sidecar.hash} does not match "${main}" (${entry.sha256})`,
              });
            }
          }
        }
        return {
          ok: issues.length === 0,
          id: manifest.id,
          checked: Object.keys(manifest.entries).length,
          validated,
          issues,
        };
      } finally {
        pack.close();
      }
    },
  );
}

export interface ExtractPackInput {
  /** Built pack file or http(s) URL. */
  source: string;
  outDir: string;
}

export interface ExtractPackOutput {
  ok: boolean;
  id?: string;
  outDir?: string;
  files?: number;
  error?: string;
}

export async function extractContentPack(input: ExtractPackInput): Promise<ExtractPackOutput> {
  return guardOp<ExtractPackOutput>(
    (error) => ({ ok: false, error }),
    async () => {
      const pack = await openPackAt(input.source);
      try {
        const written = await extractPack(pack, input.outDir);
        return {
          ok: true,
          id: pack.manifest.id,
          outDir: resolve(input.outDir),
          files: written.length,
        };
      } finally {
        pack.close();
      }
    },
  );
}

export interface FetchPackInput {
  /** URL of a pack file, or of a molen/pack-index@1 listing packs. */
  url: string;
  /** With an index URL, fetch only these pack ids (default: all). */
  ids?: string[];
  /** Download directory (default: packs/ beside project.json, else ./packs). */
  outDir?: string;
  projectPath?: string;
  cwd?: string;
}

export interface FetchedPack {
  id: string;
  version: string;
  file: string;
  contentHash: string;
  size: number;
}

export interface FetchPackOutput {
  ok: boolean;
  packs?: FetchedPack[];
  outDir?: string;
  /** The project.json whose `packs` list was updated, when there is one. */
  projectPath?: string;
  error?: string;
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Download packs into a project so it runs offline, and pin them in project.json `packs` with
 * their contentHash. Nothing is fetched implicitly anywhere else: this is the explicit step.
 */
export async function fetchContentPack(input: FetchPackInput): Promise<FetchPackOutput> {
  return guardOp<FetchPackOutput>(
    (error) => ({ ok: false, error }),
    async () => {
      const cwd = resolve(input.cwd ?? process.cwd());
      const projectPath =
        input.projectPath !== undefined
          ? resolve(cwd, input.projectPath)
          : await findProjectFile(cwd);
      const outDir = resolve(
        input.outDir !== undefined
          ? resolve(cwd, input.outDir)
          : join(projectPath !== undefined ? dirname(projectPath) : cwd, 'packs'),
      );
      const first = await download(input.url);
      const targets: { url: string; bytes?: Uint8Array; contentHash?: string }[] = [];
      if (first[0] === 0x7b /* '{' */) {
        const index = validate('pack-index', parseJson(new TextDecoder().decode(first)));
        if (!index.ok) throw new Error(`${input.url} is neither a pack nor a pack index`);
        const wanted = input.ids ?? Object.keys(index.value.packs);
        for (const id of wanted) {
          const entry = index.value.packs[id];
          if (entry === undefined)
            throw new Error(`the index at ${input.url} lists no pack "${id}"`);
          targets.push({
            url: new URL(entry.file, input.url).href,
            contentHash: entry.contentHash,
          });
        }
      } else {
        targets.push({ url: input.url, bytes: first });
      }
      await mkdir(outDir, { recursive: true });
      const fetched: FetchedPack[] = [];
      for (const target of targets) {
        const bytes = target.bytes ?? (await download(target.url));
        const pack: Pack = await openPack(bytes, {
          label: target.url,
          ...(target.contentHash !== undefined
            ? { expect: { contentHash: target.contentHash } }
            : {}),
        });
        const hash = await sha256(bytes);
        const file = `${pack.manifest.id}-${hash.slice('sha256:'.length, 'sha256:'.length + 12)}.zip`;
        await writeFile(join(outDir, file), bytes);
        fetched.push({
          id: pack.manifest.id,
          version: pack.manifest.version,
          file,
          contentHash: pack.manifest.contentHash,
          size: bytes.length,
        });
      }
      if (projectPath !== undefined) {
        await updateProjectFile(projectPath, (manifest) => {
          for (const pack of fetched) {
            const file = relative(dirname(projectPath), join(outDir, pack.file));
            const ref: ProjectPackRef = {
              id: pack.id,
              source: file.split(sep).join('/'),
              contentHash: pack.contentHash,
            };
            const at = manifest.packs.findIndex((existing) => existing.id === pack.id);
            if (at >= 0) manifest.packs[at] = ref;
            else manifest.packs.push(ref);
          }
        });
      }
      return {
        ok: true,
        packs: fetched,
        outDir,
        ...(projectPath !== undefined ? { projectPath } : {}),
      };
    },
  );
}

/** Shared discovery for authored landmarks and reusable map structures. */
import { createHash } from 'node:crypto';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { biomeJson } from './format-json.mjs';
import {
  readStructureCollections,
  selectedStructureIds,
  validateCollectionSpec,
} from './structure-collections.mjs';
import { knownSourceEntries, structureSourceDirectory } from './structure-source-paths.mjs';

export const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
export const content = resolve(root, 'content/worldgen');
export const projectPath = resolve(content, 'project.json');
export const hashBytes = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** Replace shared authoring indexes without truncating a file mapped by a Windows watcher. */
export async function writeIndex(path, contents) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Review/import reports belong to the editable source bundle, never the runtime pack. */
export async function registerSourceDocuments(dir, paths) {
  const path = resolve(dir, 'source.json');
  const manifest = await readOptionalJson(path);
  if (!manifest) throw new Error(`Missing source manifest in ${dir}`);
  manifest.files.documents = [...new Set([...manifest.files.documents, ...paths])];
  await writeIndex(path, biomeJson(manifest, path));
}

export async function authoredModels() {
  const collections = await readStructureCollections(
    resolve(content, 'source/next-1000/collections.json'),
  );
  const selected = process.argv
    .find((arg) => arg.startsWith('--ids='))
    ?.slice(6)
    .split(',');
  const expanded = selectedStructureIds(selected, collections);
  const models = [];
  for (const dir of await authoredModelDirectories()) {
    const spec = await readOptionalJson(resolve(dir, 'spec.json'));
    if (!spec || (expanded && !expanded.includes(spec.id))) continue;
    validateCollectionSpec(spec, collections);
    if (typeof spec.assetId !== 'string' || !spec.assetId.startsWith('molen.worldgen.structure.'))
      throw new Error(`Invalid asset id in ${dir}`);
    const sourcePath = resolve(dir, 'models/source.glb');
    models.push({ dir, spec, sourcePath, sourceHash: hashBytes(await readFile(sourcePath)) });
  }
  for (const id of selected ?? [])
    if (!models.some((model) => selectedStructureIds([id], collections).includes(model.spec.id)))
      throw new Error(`No authored source model for ${id}`);
  if (models.length === 0) throw new Error('No authored models found');
  if (new Set(models.map((model) => model.spec.assetId)).size !== models.length)
    throw new Error('Duplicate authored model asset id');
  return models;
}

/** The registry owns geographic paths; reusable category models retain their semantic home. */
export async function authoredModelDirectories() {
  await assertSourceRegistryCurrent();
  const places = knownSourceEntries()
    .filter((entry) => entry.collection === 'next-1000')
    .map((entry) => structureSourceDirectory(entry.key));
  const genericRoot = resolve(content, 'source/map-structures');
  const generic = await readdir(genericRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return [
    ...places,
    ...generic
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(genericRoot, entry.name)),
  ].sort((a, b) => a.localeCompare(b));
}

let registryCheck;
/** Scan directory names once per tool run, without reading any model or capture payload. */
export function assertSourceRegistryCurrent() {
  registryCheck ??= checkSourceRegistry();
  return registryCheck;
}

export async function checkSourceRegistry({
  entries = knownSourceEntries(),
  repositoryRoot = root,
  directories = [
    resolve(content, 'source/places'),
    resolve(content, 'source/reusable'),
    resolve(content, 'source/map-structures'),
  ],
} = {}) {
  const registered = new Set(entries.map((entry) => resolve(repositoryRoot, entry.sourcePath)));
  const stale = [];
  async function scan(dir) {
    const children = await readdir(dir, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    if (children.some((entry) => entry.isFile() && entry.name === 'source.json')) {
      if (!registered.has(dir)) stale.push(relative(repositoryRoot, dir).replaceAll('\\', '/'));
      return;
    }
    await Promise.all(
      children
        .filter((entry) => entry.isDirectory())
        .map((entry) => scan(resolve(dir, entry.name))),
    );
  }
  await Promise.all([
    ...directories.map((dir) => scan(resolve(dir))),
    ...entries.map(async (entry) => {
      await readdir(resolve(repositoryRoot, entry.sourcePath)).catch((error) => {
        if (error.code === 'ENOENT') stale.push(entry.sourcePath);
        else throw error;
      });
    }),
  ]);
  if (stale.length)
    throw new Error(
      `Structure source registry is stale (${stale.sort().join(', ')}). Run node packages/worldgen/scripts/index-structure-sources.mjs before importing or capturing.`,
    );
}

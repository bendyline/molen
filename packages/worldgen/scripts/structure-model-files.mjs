/** Shared discovery for authored landmarks and reusable map structures. */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { biomeJson } from './format-json.mjs';

export const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
export const content = resolve(root, 'content/worldgen');
export const projectPath = resolve(content, 'project.json');
export const hashBytes = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

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
  await writeFile(path, biomeJson(manifest, path));
}

export async function authoredModels() {
  const selected = process.argv
    .find((arg) => arg.startsWith('--ids='))
    ?.slice(6)
    .split(',');
  const models = [];
  for (const source of ['source/next-1000/models', 'source/map-structures']) {
    let dirs;
    try {
      dirs = await readdir(resolve(content, source), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of dirs
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = resolve(content, source, entry.name);
      const spec = await readOptionalJson(resolve(dir, 'spec.json'));
      if (!spec || (selected && !selected.includes(spec.id))) continue;
      if (typeof spec.assetId !== 'string' || !spec.assetId.startsWith('molen.worldgen.structure.'))
        throw new Error(`Invalid asset id in ${dir}`);
      const sourcePath = resolve(dir, 'models/source.glb');
      models.push({ dir, spec, sourcePath, sourceHash: hashBytes(await readFile(sourcePath)) });
    }
  }
  for (const id of selected ?? [])
    if (!models.some((model) => model.spec.id === id))
      throw new Error(`No authored source model for ${id}`);
  if (models.length === 0) throw new Error('No authored models found');
  if (new Set(models.map((model) => model.spec.assetId)).size !== models.length)
    throw new Error('Duplicate authored model asset id');
  return models;
}

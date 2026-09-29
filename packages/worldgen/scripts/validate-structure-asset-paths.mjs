/** Verify source/runtime address agreement without opening model geometry or changing files. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  structureAssetPackRoot,
  structureAssetPathFromSource,
  validateStructureAssetId,
} from './structure-asset-paths.mjs';
import {
  knownSourceEntries,
  sourcePathWithin,
  sourceRepositoryRoot,
} from './structure-source-paths.mjs';

const prefix = 'molen.worldgen.structure.';
const plainPath = (path) => path.replaceAll('\\', '/');

/** Registry checks are pure so migration mistakes can be exercised without moving real assets. */
export function inspectStructureAssetPaths(entries, projectAssets, packAssets, bundles) {
  const issues = [];
  const authored = new Map(
    entries.filter((entry) => entry.hasModel).map((entry) => [entry.assetId, entry]),
  );
  const byId = new Map();
  for (const bundle of bundles) {
    if (!bundle.id.startsWith(prefix)) continue;
    validateStructureAssetId(bundle.id);
    const copies = byId.get(bundle.id) ?? [];
    copies.push(bundle);
    byId.set(bundle.id, copies);
    const entry = authored.get(bundle.id);
    if (!entry) issues.push(`${bundle.id}: runtime bundle has no authored source: ${bundle.path}`);
    else if (bundle.path !== structureAssetPathFromSource(entry.sourcePath))
      issues.push(`${bundle.id}: runtime bundle is outside its canonical folder: ${bundle.path}`);
  }
  for (const [assetId, entry] of authored) {
    validateStructureAssetId(assetId);
    const expected = structureAssetPathFromSource(entry.sourcePath);
    if (projectAssets[assetId] !== expected)
      issues.push(`${assetId}: project path must be ${expected}`);
    if (packAssets[assetId] !== expected)
      issues.push(`${assetId}: stylepack path must be ${expected}`);
    const copies = byId.get(assetId) ?? [];
    if (copies.length !== 1)
      issues.push(`${assetId}: expected one runtime bundle, found ${copies.length}`);
  }
  for (const [name, assets] of [
    ['project', projectAssets],
    ['stylepack', packAssets],
  ])
    for (const assetId of Object.keys(assets))
      if (assetId.startsWith(prefix) && !authored.has(assetId))
        issues.push(`${assetId}: ${name} registration has no authored source`);
  return issues;
}

export async function validateStructureAssetPaths() {
  const packRoot = structureAssetPackRoot;
  const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const entries = knownSourceEntries();
  const [project, pack] = await Promise.all([
    readJson(resolve(packRoot, 'project.json')),
    readJson(resolve(packRoot, 'stylepack.json')),
  ]);
  const names = await readdir(resolve(packRoot, 'assets'), { recursive: true });
  const bundles = [];
  for (const name of names.filter((name) => name.endsWith('asset.json'))) {
    const absolute = resolve(packRoot, 'assets', name);
    const document = await readJson(absolute);
    bundles.push({ id: document.id, path: plainPath(relative(packRoot, absolute)) });
    if (!document.id.startsWith(prefix)) continue;
    for (const file of [document.files.main, ...Object.values(document.files.variants ?? {})]) {
      const target = sourcePathWithin(dirname(absolute), file);
      if (!(await stat(target)).isFile()) throw new Error(`Not a runtime model file: ${target}`);
    }
  }
  const issues = inspectStructureAssetPaths(entries, project.assets, pack.assets, bundles);
  for (const entry of entries.filter((entry) => entry.hasModel)) {
    const source = await readJson(resolve(sourceRepositoryRoot, entry.sourcePath, 'source.json'));
    const expected = structureAssetPathFromSource(entry.sourcePath);
    const models = source.files.models.filter((model) => model.assetId === entry.assetId);
    if (models.length !== 1 || models[0].output !== expected)
      issues.push(`${entry.assetId}: source model output must be ${expected}`);
  }
  const legacy = resolve(packRoot, 'assets/molen/worldgen/structure');
  const legacyEntries = await readdir(legacy).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (legacyEntries.length) issues.push('Legacy assets/molen/worldgen/structure folders remain');
  if (issues.length)
    throw new Error(`Structure asset address validation failed:\n${issues.join('\n')}`);
  return entries.filter((entry) => entry.hasModel).length;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const count = await validateStructureAssetPaths();
  console.log(`Validated canonical runtime paths for ${count} structure assets.`);
}

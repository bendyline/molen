/** Runtime file addressing is independent of stable structure asset IDs. */
import { dirname, resolve } from 'node:path';
import {
  knownSourceEntries,
  proposedStructureSourcePath,
  sourceRepositoryRoot,
  validateSourceKey,
} from './structure-source-paths.mjs';

export const structureAssetPackRoot = resolve(sourceRepositoryRoot, 'content/worldgen');
const prefix = 'molen.worldgen.structure.';
const sourcePrefix = 'content/worldgen/source/';
const alphabet = '[0123456789bcdefghjkmnpqrstuvwxyz]';
const geographic = new RegExp(`^places/(${alphabet}{2})/(${alphabet}{3})/([a-z0-9][a-z0-9_-]*)$`);

export function validateStructureAssetId(assetId) {
  if (typeof assetId !== 'string' || !assetId.startsWith(prefix))
    throw new Error(`Not a structure asset ID: ${assetId}`);
  return validateSourceKey(assetId.slice(prefix.length));
}

/** Mirror pinned source geography; reusable map features share the runtime reusable family. */
export function structureAssetPathFromSource(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath.startsWith(sourcePrefix))
    throw new Error(`Invalid structure source path: ${sourcePath}`);
  let folder = sourcePath.slice(sourcePrefix.length);
  if (folder.startsWith('map-structures/')) folder = `reusable/${folder}`;
  const place = geographic.exec(folder);
  const semantic =
    /^(?:places\/unlocated|reusable\/(?:urban|infrastructure|map-structures))\/([a-z0-9][a-z0-9_-]*)$/;
  if ((!place && !semantic.test(folder)) || (place && place[1] !== place[2].slice(0, 2)))
    throw new Error(`Invalid canonical structure source path: ${sourcePath}`);
  return `assets/${folder}/asset.json`;
}

/** Pack-relative POSIX sidecar path. Folder classification never activates a placement. */
export function structureAssetSidecarPath(assetId) {
  const key = validateStructureAssetId(assetId);
  const entry = knownSourceEntries().find((source) => source.assetId === assetId);
  return structureAssetPathFromSource(entry?.sourcePath ?? proposedStructureSourcePath(key));
}

/** Absolute runtime bundle directory for importers and authoring tools. */
export function structureAssetDirectory(assetId) {
  return dirname(resolve(structureAssetPackRoot, structureAssetSidecarPath(assetId)));
}

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateByKind } from '@bendyline/molen-schema';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
} from '@bendyline/molen-worldgen/kernel';
import {
  createPlacesContent,
  type PlacesContent,
  type PlacesContentDocs,
} from '../../src/kernel/places';
import type { RegionAtlasDoc } from '../../src/kernel/region-atlas-types';
import '../../src/kernel';

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PACK_DIR: string = resolve(here, '../../../../content/worldgen');
export const DEFAULT_ATLAS_PATH: string = resolve(
  here,
  '../../../../content/earth/world.atlas.json',
);

export async function loadDefaultPack(): Promise<ResolvedStylePack> {
  const root = JSON.parse(await readFile(resolve(DEFAULT_PACK_DIR, 'stylepack.json'), 'utf8'));
  return resolveStylePackDocuments(root, async (path) =>
    JSON.parse(await readFile(resolve(DEFAULT_PACK_DIR, path), 'utf8')),
  );
}

export async function loadDefaultAtlas(): Promise<RegionAtlasDoc> {
  const doc = JSON.parse(await readFile(DEFAULT_ATLAS_PATH, 'utf8'));
  const parsed = validateByKind('region-atlas' as never, doc);
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as RegionAtlasDoc;
}

/**
 * The shipped places content as raw documents, read the way a content pack hands them over: the
 * landmark catalog, each landmark model by catalog key, and the business catalog.
 */
export async function loadDefaultPlacesDocs(): Promise<PlacesContentDocs> {
  const landmarkDir = resolve(DEFAULT_PACK_DIR, 'landmarks');
  const catalog = JSON.parse(await readFile(resolve(landmarkDir, 'catalog.json'), 'utf8')) as {
    models: Record<string, string>;
  };
  const models: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(catalog.models)) {
    models[key] = JSON.parse(await readFile(resolve(landmarkDir, path), 'utf8'));
  }
  const businesses = JSON.parse(
    await readFile(resolve(here, '../../../../content/earth/businesses/catalog.json'), 'utf8'),
  );
  return { landmarks: { catalog, models }, businesses };
}

/** The default places content (landmarks and business catalog), built once for tests. */
export const PLACES: PlacesContent = createPlacesContent(await loadDefaultPlacesDocs());

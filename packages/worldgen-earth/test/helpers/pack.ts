import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateByKind } from '@bendyline/molen-schema';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
} from '@bendyline/molen-worldgen/kernel';
import type { RegionAtlasDoc } from '../../src/kernel/region-atlas-types';
import '../../src/kernel';

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PACK_DIR: string = resolve(here, '../../../worldgen/packs/default');
export const DEFAULT_ATLAS_PATH: string = resolve(here, '../../packs/default/world.atlas.json');

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

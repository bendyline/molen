/**
 * The explorer's content, loaded from the content packs the build writes into public/packs
 * through `@bendyline/molen-earth`: entity types and models, the chosen style pack, the region
 * atlas and business catalog, and the star catalog. `?style=none` turns worldgen off.
 */

import type { SkyStar } from '@bendyline/molen-client';
import {
  EARTH_PACK_IDS,
  type EarthContent,
  type EarthWorldgenContent,
  loadEarthContent,
  openPacksFromIndex,
} from '@bendyline/molen-earth/client';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';

/** Style packs by `?style=` id. */
const STYLE_PACKS: Record<string, string> = { default: EARTH_PACK_IDS.style };

export type ExplorerWorldgenContent = EarthWorldgenContent;

/** Earth content with the entity types the explorer's vehicles and aircraft require. */
export interface ExplorerContent extends EarthContent {
  types: TypeLibrary;
}

function packIndex(base: URL): URL {
  return new URL('packs/index.json', base);
}

/** Only the star catalog, for a page that shows a sky and nothing else. */
export async function loadSkyStars(base: URL): Promise<SkyStar[]> {
  const packs = await openPacksFromIndex(packIndex(base), [EARTH_PACK_IDS.sky]);
  return (await loadEarthContent(packs, { stylePack: false })).stars();
}

/** Open the packs listed in `packs/index.json` under `base` and read what the explorer needs. */
export async function loadExplorerContent(
  base: URL,
  options: { styleId: string },
): Promise<ExplorerContent> {
  const stylePack = options.styleId === 'none' ? false : STYLE_PACKS[options.styleId];
  const packs = await openPacksFromIndex(packIndex(base), [
    EARTH_PACK_IDS.entities,
    EARTH_PACK_IDS.earth,
    EARTH_PACK_IDS.sky,
    ...(typeof stylePack === 'string' ? [stylePack] : []),
  ]);
  const content = await loadEarthContent(packs, {
    // An unknown style id reports as a missing style pack; terrain, cars and aircraft still load.
    stylePack: stylePack ?? `unknown:${options.styleId}`,
  });
  if (content.types === undefined)
    throw new Error('public/packs/index.json lists no entities pack');
  return { ...content, types: content.types };
}

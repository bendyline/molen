/** Fetch and validate a `molen/region-atlas@1` document. */

import { validateByKind } from '@bendyline/molen-schema';
import { registerRegionAtlasSchema } from '../kernel/region-atlas-schema';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';

export interface LoadRegionAtlasOptions {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export async function loadRegionAtlas(
  url: string | URL,
  options: LoadRegionAtlasOptions = {},
): Promise<RegionAtlasDoc> {
  registerRegionAtlasSchema();
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined) throw new Error('loadRegionAtlas requires fetch');
  const response = await fetcher(
    url instanceof URL ? url.href : url,
    options.signal !== undefined ? { signal: options.signal } : {},
  );
  if (!response.ok) throw new Error(`region atlas ${String(url)}: HTTP ${response.status}`);
  const parsed = validateByKind('region-atlas' as never, await response.json());
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as RegionAtlasDoc;
}

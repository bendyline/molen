import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import { describe, expect, it, vi } from 'vitest';
import { loadEarthContent } from '../src/client/content';

describe('Earth structure catalogs', () => {
  it('merges geographic and category catalogs without fetching any model bytes', async () => {
    const binaryRead = vi.fn(async () => {
      throw new Error('Models must load on demand');
    });
    const fakePack = (id: string, folder: string, provides: Record<string, string[]>): Pack =>
      ({
        manifest: { id, version: '0.0.1', provides },
        readJson: async (path: string) =>
          JSON.parse(
            await readFile(new URL(`../../../content/${folder}/${path}`, import.meta.url), 'utf8'),
          ),
        readBytes: binaryRead,
      }) as unknown as Pack;
    const style = fakePack('molen.worldgen.default', 'worldgen', {
      stylepack: ['stylepack.json'],
      landmarks: ['landmarks/catalog.json'],
    });
    const earth = fakePack('molen.earth', 'earth', {
      atlas: ['world.atlas.json'],
      businesses: ['businesses/catalog.json'],
      structures: ['structures/placements.json', 'structures/map-rules.json'],
    });
    const content = await loadEarthContent([style, earth]);
    expect(content.worldgenError).toBeUndefined();
    expect(content.worldgen?.structures.entries.some((entry) => entry.title.includes('520'))).toBe(
      true,
    );
    expect(
      content.worldgen?.structures.rules.some((rule) => rule.asset.endsWith('map_smock_windmill')),
    ).toBe(true);
    expect(binaryRead).not.toHaveBeenCalled();
  });
});

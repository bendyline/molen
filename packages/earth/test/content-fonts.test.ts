import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import { describe, expect, it, vi } from 'vitest';
import { loadEarthContent } from '../src/client/content';

describe('Earth font content', () => {
  it('loads declared fonts even without worldgen, with no model or external-font requests', async () => {
    const readJson = vi.fn(async (path: string) =>
      JSON.parse(
        await readFile(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'),
      ),
    );
    const readBytes = vi.fn(async () => {
      throw new Error('No model reads');
    });
    const pack = {
      manifest: {
        id: 'molen.earth',
        version: '1.0.0',
        provides: { fonts: ['fonts/catalog.json'] },
      },
      readJson,
      readBytes,
    } as unknown as Pack;
    const content = await loadEarthContent([pack], { stylePack: false });
    expect(Object.keys(content.fonts?.fonts ?? {})).toHaveLength(4);
    expect(content.fonts?.roles?.highway).toBe('overpass.semibold');
    expect(readJson).toHaveBeenCalledTimes(5);
    expect(readBytes).not.toHaveBeenCalled();
    expect((await loadEarthContent([], { stylePack: false })).fonts).toBeUndefined();
  });
});

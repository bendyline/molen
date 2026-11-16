// The earth worldgen owns the land cover workers it starts (the semantic renderers leave the
// generator's lifetime to the caller): disposing it ends them, so a remounted view does not
// leave the previous view's workers running.

import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import { describe, expect, it } from 'vitest';
import { loadEarthContent } from '../src/client/content';
import { createEarthWorldgen, surfaceWorkers } from '../src/client/worldgen';

const fakePack = (id: string, folder: string, provides: Record<string, string[]>): Pack =>
  ({
    manifest: { id, version: '0.0.1', provides },
    close: () => {},
    readJson: async (path: string) =>
      JSON.parse(
        await readFile(new URL(`../../../content/${folder}/${path}`, import.meta.url), 'utf8'),
      ),
    readBytes: async () => {
      throw new Error('no models in unit tests');
    },
  }) as unknown as Pack;

describe('createEarthWorldgen', () => {
  it('terminates the land cover workers it started when disposed', async () => {
    const content = await loadEarthContent([
      fakePack('molen.worldgen.default', 'worldgen', { stylepack: ['stylepack.json'] }),
      fakePack('molen.earth', 'earth', { atlas: ['world.atlas.json'] }),
    ]);
    expect(content.worldgenError).toBeUndefined();
    let started = 0;
    let terminated = 0;
    const worker = (): Worker =>
      Object.assign(new EventTarget(), {
        postMessage: () => {},
        terminate: () => {
          terminated++;
        },
        onmessage: null,
        onerror: null,
        onmessageerror: null,
      }) as unknown as Worker;
    const worldgen = createEarthWorldgen({
      content: content.worldgen as NonNullable<typeof content.worldgen>,
      assets: content.assets,
      surfaceRenderer: {} as never,
      metersPerUnit: 1,
      quality: 'balanced',
      lodPolicy: { maxPixelError: 2 } as never,
      workers: {
        landcover: () => {
          started++;
          return worker();
        },
      },
    });
    expect(started).toBe(surfaceWorkers());
    worldgen.dispose();
    expect(terminated).toBe(started);
  });
});

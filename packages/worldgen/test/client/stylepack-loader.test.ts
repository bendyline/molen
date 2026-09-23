import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadStylePack, withStylePackDocuments } from '../../src/client/stylepack-loader';
import '../../src/kernel';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../content/worldgen');
const BASE = 'https://example.test/worldgen/default/';

/** A fetch that serves the in-repo default pack and records every URL it was asked for. */
function packFetch(requests: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const text = await readFile(resolve(packDir, url.slice(BASE.length)), 'utf8');
    return new Response(text, { status: 200 });
  }) as typeof fetch;
}

describe('loadStylePack', () => {
  it('keeps the text of every document it fetched', async () => {
    const requests: string[] = [];
    const loaded = await loadStylePack(BASE, { fetch: packFetch(requests) });
    expect(new Set(requests).size).toBe(requests.length);
    expect([...loaded.documents.keys()].sort()).toEqual([...requests].sort());
  });

  it('serves material documents from the load instead of fetching them again', async () => {
    const requests: string[] = [];
    const loaded = await loadStylePack(BASE, { fetch: packFetch(requests) });
    const fallback: string[] = [];
    const provider = withStylePackDocuments(
      {
        load: async (ref) => {
          fallback.push(`load:${ref}`);
          return new ArrayBuffer(0);
        },
        loadText: async (ref) => {
          fallback.push(`text:${ref}`);
          return '{}';
        },
      },
      loaded,
    );
    const materialIds = Object.keys(loaded.pack.root.materials);
    expect(materialIds.length).toBeGreaterThan(0);
    for (const id of materialIds) {
      const url = loaded.assetIndex[id] as string;
      expect(await provider.loadText(id)).toBe(loaded.documents.get(url));
    }
    // Unknown refs and binary loads still go to the wrapped provider.
    await provider.loadText('not-in-the-pack');
    await provider.load(materialIds[0] as string);
    expect(fallback).toEqual(['text:not-in-the-pack', `load:${materialIds[0]}`]);
  });
});

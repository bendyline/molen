/** Fetch a style pack directory (manifest plus referenced documents) and resolve it. */

import type { AssetProvider } from '@bendyline/molen-client';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
  stylePackAssetIndex,
} from '../kernel/stylepack';

export interface LoadStylePackOptions {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  /** Manifest file name inside the pack directory (default `stylepack.json`). */
  manifest?: string;
}

export interface LoadedStylePack {
  pack: ResolvedStylePack;
  /** Absolute pack directory URL, with a trailing slash. */
  baseUrl: string;
  /** Material and asset ids mapped to absolute URLs, for the client asset provider index. */
  assetIndex: Record<string, string>;
  /** Raw text of every document the load fetched, by absolute URL. */
  documents: ReadonlyMap<string, string>;
}

export async function loadStylePack(
  baseUrl: string | URL,
  options: LoadStylePackOptions = {},
): Promise<LoadedStylePack> {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined) throw new Error('loadStylePack requires fetch');
  const base = new URL(baseUrl instanceof URL ? baseUrl.href : baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;
  const documents = new Map<string, string>();
  const readJson = async (relativePath: string): Promise<unknown> => {
    const url = new URL(relativePath, base);
    const response = await fetcher(
      url.href,
      options.signal !== undefined ? { signal: options.signal } : {},
    );
    if (!response.ok) throw new Error(`style pack file ${url.href}: HTTP ${response.status}`);
    const text = await response.text();
    documents.set(url.href, text);
    return JSON.parse(text);
  };
  const root = await readJson(options.manifest ?? 'stylepack.json');
  const pack = await resolveStylePackDocuments(root, readJson);
  return {
    pack,
    baseUrl: base.href,
    assetIndex: stylePackAssetIndex(pack, base.href),
    documents,
  };
}

/**
 * Serve documents the pack load already fetched (its material docs) from memory, so a
 * MaterialResolver built on this provider doesn't download them a second time. Everything else,
 * including model bytes, goes to `provider`.
 */
export function withStylePackDocuments(
  provider: AssetProvider,
  loaded: Pick<LoadedStylePack, 'assetIndex' | 'documents'>,
): AssetProvider {
  return {
    load: (ref) => provider.load(ref),
    loadText: async (ref) => {
      const url = loaded.assetIndex[ref];
      const text = url === undefined ? undefined : loaded.documents.get(new URL(url).href);
      return text ?? provider.loadText(ref);
    },
  };
}

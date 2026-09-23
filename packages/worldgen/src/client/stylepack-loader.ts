/** Fetch a style pack directory (manifest plus referenced documents) and resolve it. */

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
}

export async function loadStylePack(
  baseUrl: string | URL,
  options: LoadStylePackOptions = {},
): Promise<LoadedStylePack> {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined) throw new Error('loadStylePack requires fetch');
  const base = new URL(baseUrl instanceof URL ? baseUrl.href : baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;
  const readJson = async (relativePath: string): Promise<unknown> => {
    const url = new URL(relativePath, base);
    const response = await fetcher(
      url.href,
      options.signal !== undefined ? { signal: options.signal } : {},
    );
    if (!response.ok) throw new Error(`style pack file ${url.href}: HTTP ${response.status}`);
    return response.json();
  };
  const root = await readJson(options.manifest ?? 'stylepack.json');
  const pack = await resolveStylePackDocuments(root, readJson);
  return { pack, baseUrl: base.href, assetIndex: stylePackAssetIndex(pack, base.href) };
}

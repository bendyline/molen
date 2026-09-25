/**
 * Open a `molen/archive-set@1` as one `TerrainTileArchive`.
 *
 * The set document is fetched lazily on first use; each member archive opens only when a tile it
 * owns is requested and stays in a small LRU, so a camera exploring one region never touches the
 * rest of the planet. Hosts with their own archive transport (offline packs, native range readers,
 * retry policies) pass `openArchive`; the default opens the official PMTiles HTTP reader.
 */

import { PMTiles, TileType } from 'pmtiles';
import {
  createTerrainArchiveSetRouter,
  type TerrainArchiveSetDescriptor,
  type TerrainArchiveSetRouter,
} from './archive-set';
import type { TerrainArchiveHeader, TerrainArchiveTile, TerrainTileArchive } from './package-types';

export interface TerrainArchiveSetArchiveOptions {
  /**
   * Resolves relative archive URLs. Defaults to the set document's URL; required when the set is
   * passed as an object with relative archive URLs.
   */
  baseUrl?: string | URL;
  /** Open one member archive by absolute URL (default: the official PMTiles HTTP reader). */
  openArchive?: (url: string, id: string) => TerrainTileArchive;
  /** Member archives kept open at once (default 12). */
  maxOpenArchives?: number;
  /** Fetch used for the set document (default: global fetch). */
  fetch?: typeof fetch;
}

/** A `TerrainTileArchive` over an archive set, with diagnostics. */
export interface TerrainArchiveSetArchive extends TerrainTileArchive {
  getHeader(): Promise<TerrainArchiveHeader>;
  /** The loaded set document. */
  descriptor(): Promise<TerrainArchiveSetDescriptor>;
  /** Ids of member archives currently open (`'base'` for the base archive). */
  openArchiveIds(): string[];
}

function defaultOpenArchive(url: string): TerrainTileArchive {
  return new PMTiles(url);
}

/** Open an archive set from its document URL or an already-loaded document. */
export function createTerrainArchiveSetArchive(
  set: TerrainArchiveSetDescriptor | string | URL,
  options: TerrainArchiveSetArchiveOptions = {},
): TerrainArchiveSetArchive {
  const maxOpen = options.maxOpenArchives ?? 12;
  if (!Number.isSafeInteger(maxOpen) || maxOpen < 1) {
    throw new Error('archive-set maxOpenArchives must be a positive integer');
  }
  const openArchive = options.openArchive ?? defaultOpenArchive;
  const documentUrl = typeof set === 'object' && !(set instanceof URL) ? undefined : String(set);
  const baseUrl = options.baseUrl ?? documentUrl;
  const open = new Map<string, TerrainTileArchive>();
  let loading: Promise<TerrainArchiveSetRouter> | undefined;

  const router = (): Promise<TerrainArchiveSetRouter> => {
    loading ??= (async () => {
      let descriptor: TerrainArchiveSetDescriptor;
      if (documentUrl === undefined) {
        descriptor = set as TerrainArchiveSetDescriptor;
      } else {
        const response = await (options.fetch ?? fetch)(documentUrl);
        if (!response.ok) {
          throw new Error(`archive set ${documentUrl}: HTTP ${response.status}`);
        }
        descriptor = (await response.json()) as TerrainArchiveSetDescriptor;
      }
      if (descriptor.format !== 'molen/archive-set@1') {
        throw new Error(
          `expected a molen/archive-set@1 document, got ${String(descriptor.format)}`,
        );
      }
      return createTerrainArchiveSetRouter(descriptor);
    })().catch((error: unknown) => {
      // A failed document load retries on the next request rather than failing forever.
      loading = undefined;
      throw error;
    });
    return loading;
  };

  const resolveUrl = (url: string): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    if (baseUrl === undefined) {
      throw new Error(`archive URL "${url}" is relative; pass baseUrl for an in-memory set`);
    }
    return new URL(url, baseUrl).href;
  };

  const member = (id: string, url: string): TerrainTileArchive => {
    const existing = open.get(id);
    if (existing !== undefined) {
      open.delete(id);
      open.set(id, existing);
      return existing;
    }
    const archive = openArchive(resolveUrl(url), id);
    open.set(id, archive);
    while (open.size > maxOpen) open.delete(open.keys().next().value as string);
    return archive;
  };

  return {
    async getHeader(): Promise<TerrainArchiveHeader> {
      const routed = await router();
      return {
        minZoom: routed.minLevel,
        maxZoom: routed.maxLevel,
        tileType: routed.descriptor.tileType === 'png' ? TileType.Png : TileType.Mvt,
      };
    },
    async getZxy(
      level: number,
      x: number,
      y: number,
      signal?: AbortSignal,
    ): Promise<TerrainArchiveTile | undefined> {
      const route = (await router()).resolve(level, x, y);
      if (route === undefined) return undefined;
      const archive =
        route.kind === 'base'
          ? member('base', route.base.url)
          : member(route.entry.id, route.entry.url);
      return archive.getZxy(level, x, y, signal);
    },
    async descriptor(): Promise<TerrainArchiveSetDescriptor> {
      return (await router()).descriptor;
    },
    openArchiveIds(): string[] {
      return [...open.keys()];
    },
  };
}

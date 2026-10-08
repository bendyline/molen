// The content an Earth view draws from, read out of content packs the host has opened: entity
// types and models (cars, trees), a worldgen style pack (architecture, materials, landmarks),
// the Earth pack (region atlas, business catalog), and the sky pack's star catalog. Molen never
// fetches content on its own: pass opened packs, or use `openPacksFromIndex` with the URL of a
// pack index you host.

import { type AssetProvider, decodeStarCatalog, type SkyStar } from '@bendyline/molen-client';
import { createTypeLibrary, type TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  createPackSet,
  isDirectoryPackUrl,
  type OpenPackOptions,
  openDirectoryPack,
  openPack,
  type Pack,
  type PackSet,
} from '@bendyline/molen-pack';
import {
  type BlockCache,
  cachingDocumentFetch,
  cachingRangeReader,
  urlRangeReader,
} from '@bendyline/molen-pack/cache';
import type { PackIndex, PackIndexEntry, VehicleData } from '@bendyline/molen-schema';
import type { TerrainParkedVehicle } from '@bendyline/molen-terrain/client';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
  stylePackAssetIndex,
} from '@bendyline/molen-worldgen/kernel';
import {
  checkEcologyAtlas,
  createPlacesContent,
  createRegionalLibrary,
  createStructureIndex,
  createWildlifeRangeResolver,
  type EcologyAtlasDoc,
  type PlacesContent,
  type PlacesContentDocs,
  type RegionAtlasDoc,
  type RegionalEnvironmentDocs,
  regionalCatalogSchema,
  type StructureCatalogDoc,
  type StructureIndex,
  type WildlifeRangesDoc,
  wildlifeRangesSchema,
} from '@bendyline/molen-worldgen-earth/kernel';
import { withModelArchives } from './model-archives';

/** Content-pack ids an Earth view looks for. */
export const EARTH_PACK_IDS: {
  readonly entities: 'molen.entities';
  readonly style: 'molen.worldgen.default';
  readonly earth: 'molen.earth';
  readonly sky: 'molen.sky';
  readonly sounds: 'molen.sounds';
  readonly ecology: 'molen.ecology';
  readonly wildlife: 'molen.wildlife';
} = {
  entities: 'molen.entities',
  style: 'molen.worldgen.default',
  earth: 'molen.earth',
  sky: 'molen.sky',
  sounds: 'molen.sounds',
  ecology: 'molen.ecology',
  wildlife: 'molen.wildlife',
};

/** Worldgen style, region atlas and recognizable places, resolved from the packs. */
export interface EarthWorldgenContent {
  pack: ResolvedStylePack;
  /** Pack id of the style pack, for addressing its assets. */
  styleId: string;
  atlas: RegionAtlasDoc;
  /** Compact ecological geography and composable channels from every opened regional pack. */
  environment?: RegionalEnvironmentDocs;
  places: PlacesContent;
  /** The same places content as plain documents, for the generation worker. */
  placesDocs: PlacesContentDocs;
  /** Indexed geographic positions for authored landmark models. */
  structures: StructureIndex;
}

export interface EarthContent {
  packs: PackSet;
  /** Entity types, when the entities pack is present. */
  types?: TypeLibrary;
  /** Parked-car kinds for street surfaces, in type order. */
  parkedVehicles: TerrainParkedVehicle[];
  /** Assets across every pack: entity models by id, style-pack materials and props by path. */
  assets: AssetProvider;
  /** Undefined when no style pack was requested or it failed to load. */
  worldgen?: EarthWorldgenContent;
  /** Why worldgen content is missing when it was requested. */
  worldgenError?: string;
  /** The star catalog, read from the sky pack on first use (empty without one). */
  stars(): Promise<SkyStar[]>;
}

export interface LoadEarthContentOptions {
  /** Style pack id, or false for plain extrusions (default `molen.worldgen.default`). */
  stylePack?: string | false;
}

async function readTypes(pack: Pack): Promise<TypeLibrary> {
  const docs = await Promise.all(
    (pack.manifest.provides.types ?? []).map((path) => pack.readJson(path)),
  );
  return createTypeLibrary(docs, { label: `${pack.manifest.id}@${pack.manifest.version}` });
}

async function readWorldgen(styles: Pack, earth: Pack): Promise<EarthWorldgenContent> {
  const stylepackPath = styles.manifest.provides.stylepack?.[0] ?? 'stylepack.json';
  const landmarkPath = styles.manifest.provides.landmarks?.[0] ?? 'landmarks/catalog.json';
  const structuresPaths = earth.manifest.provides.structures ?? [];
  const landmarkDir = landmarkPath.slice(0, landmarkPath.lastIndexOf('/') + 1);
  const [pack, atlas, catalog, businesses, structures] = await Promise.all([
    styles
      .readJson(stylepackPath)
      .then((root) => resolveStylePackDocuments(root, (path) => styles.readJson(path))),
    earth.readJson<RegionAtlasDoc>(earth.manifest.provides.atlas?.[0] ?? 'world.atlas.json'),
    styles.readJson<{ models: Record<string, string> }>(landmarkPath),
    earth.readJson(earth.manifest.provides.businesses?.[0] ?? 'businesses/catalog.json'),
    Promise.all(structuresPaths.map((path) => earth.readJson<StructureCatalogDoc>(path))),
  ]);
  for (const doc of structures)
    if (doc.format !== 'molen/structure-placements@1')
      throw new Error('invalid structure catalog format');
  const models: Record<string, unknown> = {};
  await Promise.all(
    Object.entries(catalog.models).map(async ([key, path]) => {
      models[key] = await styles.readJson(`${landmarkDir}${path}`);
    }),
  );
  const placesDocs: PlacesContentDocs = { landmarks: { catalog, models }, businesses };
  return {
    pack,
    styleId: styles.manifest.id,
    atlas,
    places: createPlacesContent(placesDocs),
    placesDocs,
    structures: createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Earth structures',
      entries: structures.flatMap((doc) => doc.entries),
      rules: structures.flatMap((doc) => doc.rules ?? []),
    }),
  };
}

async function readRegionalContent(
  opened: readonly Pack[],
  stylePack: ResolvedStylePack,
): Promise<RegionalEnvironmentDocs | undefined> {
  const atlasSources = opened.flatMap((pack) =>
    (pack.manifest.provides['ecology-atlas'] ?? []).map((path) => ({ pack, path })),
  );
  const catalogSources = opened.flatMap((pack) =>
    (pack.manifest.provides['regional-catalog'] ?? []).map((path) => ({ pack, path })),
  );
  const rangeSources = opened.flatMap((pack) =>
    (pack.manifest.provides['wildlife-ranges'] ?? []).map((path) => ({ pack, path })),
  );
  if (rangeSources.length > 1)
    throw new Error('Regional catalogs support at most one wildlife range atlas');
  if (catalogSources.length === 0) return undefined;
  if (atlasSources.length > 1)
    throw new Error('Regional catalogs support at most one ecological atlas');
  const source = atlasSources[0];
  const [atlas, catalogs, wildlifeRanges] = await Promise.all([
    source?.pack.readJson<EcologyAtlasDoc>(source.path),
    Promise.all(
      catalogSources.map(async ({ pack, path }) =>
        regionalCatalogSchema.parse(await pack.readJson(path)),
      ),
    ),
    rangeSources[0]?.pack
      .readJson<WildlifeRangesDoc>(rangeSources[0].path)
      .then((doc) => wildlifeRangesSchema.parse(doc)),
  ]);
  if (atlas !== undefined) checkEcologyAtlas(atlas);
  if (wildlifeRanges !== undefined) createWildlifeRangeResolver(wildlifeRanges);
  const library = createRegionalLibrary(catalogs, stylePack);
  if (
    atlas === undefined &&
    library.profiles.some(
      ({ match }) =>
        match.biomes !== undefined || match.realms !== undefined || match.ecoregions !== undefined,
    )
  )
    throw new Error('Ecological profile selectors require an ecological atlas');
  if (library.catalogs.length === 0) return undefined;
  return {
    ...(atlas !== undefined ? { atlas } : {}),
    ...(wildlifeRanges !== undefined ? { wildlifeRanges } : {}),
    catalogs: [...library.catalogs],
  };
}

export interface OpenPacksFromIndexOptions {
  /**
   * Keep pack bytes in this cache (`createBlockCache` from `@bendyline/molen-pack/cache`): the
   * index is revalidated instead of refetched, and a pack read before opens from cached bytes.
   * Pass the same cache to `mountEarthView` so terrain shares its budget.
   */
  byteCache?: BlockCache;
  /** With `byteCache`: packs at most this size are fetched whole on first use (default 4 MiB). */
  wholeBelow?: number;
}

/**
 * Open the packs with the given ids from a `molen/pack-index@1` document at `indexUrl`, in
 * parallel and hash-checked. Ids the index does not list are skipped. The supplied fetch
 * handles the index, archive opening and later asset range requests.
 */
export async function openPacksFromIndex(
  indexUrl: string | URL,
  ids: readonly string[] = Object.values(EARTH_PACK_IDS),
  fetchImpl: typeof fetch = fetch,
  options: OpenPacksFromIndexOptions = {},
): Promise<Pack[]> {
  const url = new URL(indexUrl, typeof document === 'undefined' ? undefined : document.baseURI);
  const cache = options.byteCache;
  const response = await (cache !== undefined
    ? cachingDocumentFetch(cache.store, fetchImpl)
    : fetchImpl)(url);
  if (!response.ok) throw new Error(`content packs: HTTP ${response.status} for ${url}`);
  const index = (await response.json()) as PackIndex;
  /** One pack file: through the cache by content and file name when there is one. */
  const open = (
    entry: PackIndexEntry,
    extra: OpenPackOptions & { signal?: AbortSignal },
  ): Promise<Pack> => {
    const fileUrl = new URL(entry.file, url).href;
    if (isDirectoryPackUrl(fileUrl)) {
      // An unzipped pack: a small manifest, then one request per file. Cached files are keyed by
      // content, so a file shared by several packs or versions is stored once.
      const { mode: _mode, ...rest } = extra;
      return openDirectoryPack(fileUrl, {
        fetch: cache === undefined ? fetchImpl : cachingDocumentFetch(cache.store, fetchImpl),
        ...rest,
        ...(cache !== undefined
          ? {
              fileReader: (fileHref: string, file: { size: number; sha256: string }) =>
                cachingRangeReader(
                  urlRangeReader(fileHref, {
                    size: file.size,
                    fetch: fetchImpl,
                    ...(rest.signal !== undefined ? { signal: rest.signal } : {}),
                  }),
                  cache,
                  { key: `file:${file.sha256}`, url: fileHref, size: file.size },
                  options.wholeBelow !== undefined ? { wholeBelow: options.wholeBelow } : {},
                ),
            }
          : {}),
      });
    }
    if (cache === undefined) {
      return openPack(fileUrl, { fetch: fetchImpl, sizeHint: entry.size, ...extra });
    }
    const reader = urlRangeReader(fileUrl, {
      size: entry.size,
      fetch: fetchImpl,
      ...(extra.signal !== undefined ? { signal: extra.signal } : {}),
    });
    return openPack(
      cachingRangeReader(
        reader,
        cache,
        // The content hash names what the pack holds; the file and size pin its zip layout.
        {
          key: `pack:${entry.contentHash}:${entry.file}:${entry.size}`,
          url: fileUrl,
          size: entry.size,
        },
        options.wholeBelow !== undefined ? { wholeBelow: options.wholeBelow } : {},
      ),
      { label: fileUrl, ...extra },
    );
  };
  const opened = await Promise.allSettled(
    ids.map(async (id) => {
      const entry = index.packs[id];
      if (entry === undefined) return undefined;
      const core = await open(entry, { expect: { contentHash: entry.contentHash } });
      try {
        return await withModelArchives(core, (archiveId, contentHash, signal) => {
          const archive = index.packs[archiveId];
          if (!archive || archive.contentHash !== contentHash)
            throw new Error(`Missing or stale model archive in index: ${archiveId}`);
          return open(archive, {
            mode: 'range',
            expect: { contentHash },
            integrity: 'sha256',
            maxCacheBytes: 4 * 1024 * 1024,
            signal,
          });
        });
      } catch (error) {
        core.close();
        throw error;
      }
    }),
  );
  const failure = opened.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') {
    for (const result of opened) if (result.status === 'fulfilled') result.value?.close();
    throw failure.reason;
  }
  return opened.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
}

/** Read what an Earth view needs from opened packs. Missing packs turn features off, not errors. */
export async function loadEarthContent(
  opened: readonly Pack[],
  options: LoadEarthContentOptions = {},
): Promise<EarthContent> {
  const byId = new Map(opened.map((pack) => [pack.manifest.id, pack]));
  const packs = createPackSet([...opened]);
  const entities = byId.get(EARTH_PACK_IDS.entities);
  const types = entities === undefined ? undefined : await readTypes(entities);
  const styleId =
    options.stylePack === false ? undefined : (options.stylePack ?? EARTH_PACK_IDS.style);
  let worldgen: EarthWorldgenContent | undefined;
  let worldgenError: string | undefined;
  if (styleId !== undefined) {
    // A missing or broken style pack turns worldgen off; terrain and cars still render.
    try {
      const styles = byId.get(styleId);
      const earth = byId.get(EARTH_PACK_IDS.earth);
      if (styles === undefined) throw new Error(`style pack "${styleId}" is not open`);
      if (earth === undefined) throw new Error(`the ${EARTH_PACK_IDS.earth} pack is not open`);
      worldgen = await readWorldgen(styles, earth);
      const environment = await readRegionalContent(opened, worldgen.pack);
      if (environment !== undefined) worldgen.environment = environment;
    } catch (error) {
      worldgenError = `Style pack "${styleId}" unavailable: ${(error as Error).message}`;
    }
  }
  const styleIndex =
    worldgen === undefined ? {} : stylePackAssetIndex(worldgen.pack, `pack:${worldgen.styleId}/`);
  let stars: Promise<SkyStar[]> | undefined;
  return {
    packs,
    ...(types !== undefined ? { types } : {}),
    parkedVehicles:
      types?.idsWith('vehicle').map((id) => ({
        id,
        spec: types.component<VehicleData>(id, 'vehicle').spec,
      })) ?? [],
    assets: {
      load: (ref, options) => packs.readBytes(styleIndex[ref] ?? ref, options),
      loadText: (ref, options) => packs.readText(styleIndex[ref] ?? ref, options),
    },
    ...(worldgen !== undefined ? { worldgen } : {}),
    ...(worldgenError !== undefined ? { worldgenError } : {}),
    stars: () => {
      const sky = byId.get(EARTH_PACK_IDS.sky);
      stars ??=
        sky === undefined
          ? Promise.resolve([])
          : sky.readBytes('stars.bin').then((bytes) => decodeStarCatalog(bytes));
      return stars;
    },
  };
}

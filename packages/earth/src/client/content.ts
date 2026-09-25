// The content an Earth view draws from, read out of content packs the host has opened: entity
// types and models (cars, trees), a worldgen style pack (architecture, materials, landmarks),
// the Earth pack (region atlas, business catalog), and the sky pack's star catalog. Molen never
// fetches content on its own: pass opened packs, or use `openPacksFromIndex` with the URL of a
// pack index you host.

import { type AssetProvider, decodeStarCatalog, type SkyStar } from '@bendyline/molen-client';
import { createTypeLibrary, type TypeLibrary } from '@bendyline/molen-kernel/content';
import { createPackSet, openPack, type Pack, type PackSet } from '@bendyline/molen-pack';
import type { PackIndex, VehicleData } from '@bendyline/molen-schema';
import type { TerrainParkedVehicle } from '@bendyline/molen-terrain/client';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
  stylePackAssetIndex,
} from '@bendyline/molen-worldgen/kernel';
import {
  createPlacesContent,
  type PlacesContent,
  type PlacesContentDocs,
  type RegionAtlasDoc,
} from '@bendyline/molen-worldgen-earth/kernel';

/** Content-pack ids an Earth view looks for. */
export const EARTH_PACK_IDS: {
  readonly entities: 'molen.entities';
  readonly style: 'molen.worldgen.default';
  readonly earth: 'molen.earth';
  readonly sky: 'molen.sky';
} = {
  entities: 'molen.entities',
  style: 'molen.worldgen.default',
  earth: 'molen.earth',
  sky: 'molen.sky',
};

/** Worldgen style, region atlas and recognizable places, resolved from the packs. */
export interface EarthWorldgenContent {
  pack: ResolvedStylePack;
  /** Pack id of the style pack, for addressing its assets. */
  styleId: string;
  atlas: RegionAtlasDoc;
  places: PlacesContent;
  /** The same places content as plain documents, for the generation worker. */
  placesDocs: PlacesContentDocs;
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
  const landmarkDir = landmarkPath.slice(0, landmarkPath.lastIndexOf('/') + 1);
  const [pack, atlas, catalog, businesses] = await Promise.all([
    styles
      .readJson(stylepackPath)
      .then((root) => resolveStylePackDocuments(root, (path) => styles.readJson(path))),
    earth.readJson<RegionAtlasDoc>(earth.manifest.provides.atlas?.[0] ?? 'world.atlas.json'),
    styles.readJson<{ models: Record<string, string> }>(landmarkPath),
    earth.readJson(earth.manifest.provides.businesses?.[0] ?? 'businesses/catalog.json'),
  ]);
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
  };
}

/**
 * Open the packs with the given ids from a `molen/pack-index@1` document at `indexUrl`, in
 * parallel and hash-checked. Ids the index does not list are skipped.
 */
export async function openPacksFromIndex(
  indexUrl: string | URL,
  ids: readonly string[] = Object.values(EARTH_PACK_IDS),
  fetchImpl: typeof fetch = fetch,
): Promise<Pack[]> {
  const url = new URL(indexUrl, typeof document === 'undefined' ? undefined : document.baseURI);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`content packs: HTTP ${response.status} for ${url}`);
  const index = (await response.json()) as PackIndex;
  const opened = await Promise.all(
    ids.map((id) => {
      const entry = index.packs[id];
      if (entry === undefined) return undefined;
      return openPack(new URL(entry.file, url).href, {
        sizeHint: entry.size,
        expect: { contentHash: entry.contentHash },
      });
    }),
  );
  return opened.filter((pack): pack is Pack => pack !== undefined);
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
      load: (ref) => packs.readBytes(styleIndex[ref] ?? ref),
      loadText: (ref) => packs.readText(styleIndex[ref] ?? ref),
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

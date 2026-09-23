/**
 * The explorer's content, loaded from the content packs the build writes into public/packs:
 * entity types and models, the default style pack, the region atlas and business catalog, and the
 * star catalog. All packs open in parallel; small ones arrive in one request, and models are read
 * from the entities pack only when a car or aircraft is shown.
 */

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

/** Pack ids by role; `?style=default` selects the default style pack. */
const PACK_IDS = {
  entities: 'molen.entities',
  styles: { default: 'molen.worldgen.default' } as Record<string, string>,
  earth: 'molen.earth',
  sky: 'molen.sky',
} as const;

export interface ExplorerWorldgenContent {
  pack: ResolvedStylePack;
  atlas: RegionAtlasDoc;
  places: PlacesContent;
  /** The same places content as documents, for the generation worker. */
  placesDocs: PlacesContentDocs;
}

export interface ExplorerContent {
  packs: PackSet;
  types: TypeLibrary;
  /** Parked-car kinds for the terrain surfaces, in type-document order. */
  parkedVehicles: TerrainParkedVehicle[];
  /** Asset provider over every pack: entity models by id, style-pack materials and props. */
  assets: AssetProvider;
  /** Undefined when worldgen is off (`?style=none`) or its content failed to load. */
  worldgen?: ExplorerWorldgenContent;
  /** Why worldgen content is missing when it was requested. */
  worldgenError?: string;
  /** The star catalog, read from the sky pack on first use. */
  stars(): Promise<SkyStar[]>;
}

function required(role: string, pack: Pack | undefined): Pack {
  if (pack === undefined) throw new Error(`public/packs/index.json lists no ${role} pack`);
  return pack;
}

async function readTypes(pack: Pack): Promise<TypeLibrary> {
  const docs = await Promise.all(
    (pack.manifest.provides.types ?? []).map((path) => pack.readJson(path)),
  );
  return createTypeLibrary(docs, { label: `${pack.manifest.id}@${pack.manifest.version}` });
}

async function readWorldgen(styles: Pack, earth: Pack): Promise<ExplorerWorldgenContent> {
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
  return { pack, atlas, places: createPlacesContent(placesDocs), placesDocs };
}

/** Open the named packs from `packs/index.json` under `base`, in parallel; unlisted ids are undefined. */
async function openIndexedPacks(base: URL, ids: readonly string[]): Promise<(Pack | undefined)[]> {
  const indexUrl = new URL('packs/index.json', base);
  const response = await fetch(indexUrl);
  if (!response.ok) throw new Error(`content packs: HTTP ${response.status} for ${indexUrl}`);
  const index = (await response.json()) as PackIndex;
  return Promise.all(
    ids.map((id) => {
      const entry = index.packs[id];
      if (entry === undefined) return undefined;
      return openPack(new URL(entry.file, indexUrl).href, {
        sizeHint: entry.size,
        expect: { contentHash: entry.contentHash },
      });
    }),
  );
}

/** Only the star catalog, for a page that shows a sky and nothing else. */
export async function loadSkyStars(base: URL): Promise<SkyStar[]> {
  const [sky] = await openIndexedPacks(base, [PACK_IDS.sky]);
  return decodeStarCatalog(await required('sky', sky).readBytes('stars.bin'));
}

/** Open the packs listed in `packs/index.json` under `base` and read what the explorer needs. */
export async function loadExplorerContent(
  base: URL,
  options: { styleId: string },
): Promise<ExplorerContent> {
  const styleId = options.styleId === 'none' ? undefined : PACK_IDS.styles[options.styleId];
  const wanted = [PACK_IDS.entities, PACK_IDS.earth, PACK_IDS.sky, ...(styleId ? [styleId] : [])];
  const opened = await openIndexedPacks(base, wanted);
  const byId = new Map(opened.flatMap((pack) => (pack ? [[pack.manifest.id, pack]] : [])));
  const entities = required('entities', byId.get(PACK_IDS.entities));
  const packs = createPackSet([...byId.values()]);
  const types = await readTypes(entities);
  // A missing or broken style pack turns worldgen off; terrain, cars and aircraft still load.
  let worldgen: ExplorerWorldgenContent | undefined;
  let worldgenError: string | undefined;
  if (options.styleId !== 'none') {
    try {
      if (styleId === undefined) throw new Error(`unknown style pack "${options.styleId}"`);
      worldgen = await readWorldgen(
        required('style', byId.get(styleId)),
        required('earth', byId.get(PACK_IDS.earth)),
      );
    } catch (error) {
      worldgenError = `Style pack "${options.styleId}" unavailable: ${(error as Error).message}`;
    }
  }
  // Style-pack materials and props are addressed by their pack paths; entity models by asset id.
  const styleIndex =
    worldgen === undefined ? {} : stylePackAssetIndex(worldgen.pack, `pack:${styleId}/`);
  let stars: Promise<SkyStar[]> | undefined;
  return {
    packs,
    types,
    parkedVehicles: types.idsWith('vehicle').map((id) => ({
      id,
      spec: types.component<VehicleData>(id, 'vehicle').spec,
    })),
    assets: {
      load: (ref) => packs.readBytes(styleIndex[ref] ?? ref),
      loadText: (ref) => packs.readText(styleIndex[ref] ?? ref),
    },
    ...(worldgen !== undefined ? { worldgen } : {}),
    ...(worldgenError !== undefined ? { worldgenError } : {}),
    stars: () => {
      stars ??= required('sky', byId.get(PACK_IDS.sky))
        .readBytes('stars.bin')
        .then((bytes) => decodeStarCatalog(bytes));
      return stars;
    },
  };
}

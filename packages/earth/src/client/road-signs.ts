import { validateByKind } from '@bendyline/molen-schema';
import {
  type TerrainRoadSignCatalog,
  type TerrainRoadSignProfile,
  type TerrainRouteShieldLibrary,
  terrainRoadSignCatalogSchema,
} from '@bendyline/molen-terrain/kernel';
import {
  createRegionResolver,
  type RegionAtlasDoc,
  registerRegionAtlasSchema,
} from '@bendyline/molen-worldgen-earth/kernel';

export interface EarthRoadSignContent {
  catalog: TerrainRoadSignCatalog;
  shields?: TerrainRouteShieldLibrary;
  /** Country-code regions, independent of architectural overlays and broader fleet markets. */
  atlas?: RegionAtlasDoc;
}

export interface EarthRoadSigns {
  profileAt(x: number, z: number): Readonly<TerrainRoadSignProfile>;
  profileForCountry(code: string | undefined): Readonly<TerrainRoadSignProfile>;
  profileForSubdivision(code: string | undefined): Readonly<TerrainRoadSignProfile>;
}

/** Resolve once per terrain tile in the same metric Mercator frame as Earth. */
export function createEarthRoadSigns(
  content: EarthRoadSignContent,
  metersPerUnit: number,
): EarthRoadSigns {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0)
    throw new Error('Invalid road-sign frame scale');
  const catalog = terrainRoadSignCatalogSchema.parse(content.catalog);
  const profiles = new Map(catalog.profiles.map((profile) => [profile.id, profile]));
  const fallback = profiles.get(catalog.fallback) as TerrainRoadSignProfile;
  const countries = new Map(
    catalog.profiles.flatMap((profile) =>
      profile.countries.map((code) => [code, profile] as const),
    ),
  );
  const subdivisions = new Map(
    catalog.profiles.flatMap((profile) =>
      (profile.subdivisions ?? []).map((code) => [code, profile] as const),
    ),
  );
  let atlas: RegionAtlasDoc | undefined;
  if (content.atlas) {
    registerRegionAtlasSchema();
    const checked = validateByKind('region-atlas' as never, content.atlas);
    if (!checked.ok) throw new Error(checked.formatted);
    atlas = checked.value as RegionAtlasDoc;
    for (const region of atlas.regions)
      if (!countries.has(region.id.toUpperCase()) && !subdivisions.has(region.id.toUpperCase()))
        throw new Error(`Unbound sign country: ${region.id}`);
  }
  const regions = atlas ? createRegionResolver(atlas, { metersPerUnit }) : undefined;
  const profileForCountry = (code: string | undefined): TerrainRoadSignProfile =>
    countries.get(code?.toUpperCase() ?? '') ?? fallback;
  const profileForSubdivision = (code: string | undefined): TerrainRoadSignProfile =>
    subdivisions.get(code?.toUpperCase() ?? '') ?? profileForCountry(code?.split('-')[0]);
  return {
    profileForCountry,
    profileForSubdivision,
    profileAt: (x, z) => profileForSubdivision(regions?.resolve(x, z)?.id),
  };
}

/**
 * What a mapped building is for. Stock Protomaps footprints say only `building`, with a height on
 * perhaps one in ten, so the use has to be argued from what surrounds them. The evidence, strongest
 * first: a POI that shares the footprint's source id is the same OSM element, so the building is
 * that thing; an institution's POI inside it; a crowd of shops in it; the land use under it; and
 * last its shape, since a tall block on commercial land is offices and on residential land is flats.
 */
import {
  pointInPolygon,
  polygonArea,
  polygonBounds,
  type TerrainPoiFeature,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { BuildingRequest, ResolvedStylePack } from '@bendyline/molen-worldgen/kernel';
import type { BuildingPiece } from './building-parts';

export type BuildingUse =
  | 'mall'
  | 'office'
  | 'skyscraper'
  | 'apartments'
  | 'apartment_tower'
  | 'hotel'
  | 'hospital'
  | 'school'
  | 'place_of_worship'
  | 'theatre'
  | 'cinema'
  | 'museum'
  | 'sports_hall'
  | 'civic'
  | 'station'
  | 'fire_station'
  | 'library';

/** POI kinds that name a whole building, when the POI is the footprint or sits alone inside it. */
const USE_BY_POI: Readonly<Record<string, BuildingUse>> = {
  mall: 'mall',
  shopping_centre: 'mall',
  hotel: 'hotel',
  motel: 'hotel',
  hostel: 'hotel',
  guest_house: 'hotel',
  apartment: 'apartments',
  apartments: 'apartments',
  student_accommodation: 'apartments',
  dormitory: 'apartments',
  hospital: 'hospital',
  school: 'school',
  prep_school: 'school',
  kindergarten: 'school',
  childcare: 'school',
  college: 'school',
  university: 'school',
  place_of_worship: 'place_of_worship',
  theatre: 'theatre',
  arts_centre: 'theatre',
  concert_hall: 'theatre',
  conference_centre: 'theatre',
  events_venue: 'theatre',
  cinema: 'cinema',
  museum: 'museum',
  gallery: 'museum',
  sports_centre: 'sports_hall',
  sports_hall: 'sports_hall',
  ice_rink: 'sports_hall',
  swimming_pool: 'sports_hall',
  townhall: 'civic',
  courthouse: 'civic',
  police: 'civic',
  public_building: 'civic',
  government: 'civic',
  community_centre: 'civic',
  station: 'station',
  terminal: 'station',
  train_station: 'station',
  fire_station: 'fire_station',
  library: 'library',
};

/** A tenant, not the building: dozens of these under one roof is what a mall is. */
const TENANTS: ReadonlySet<string> = new Set([
  'clothes',
  'shoes',
  'jewelry',
  'cosmetics',
  'gift',
  'bag',
  'electronics',
  'toys',
  'books',
  'sports',
  'watches',
  'optician',
  'mobile_phone',
  'fashion_accessories',
  'beauty',
  'restaurant',
  'fast_food',
  'cafe',
  'food_court',
  'ice_cream',
  'confectionery',
]);
const LAND_USES: Readonly<Record<string, BuildingUse>> = {
  school: 'school',
  university: 'school',
  college: 'school',
  kindergarten: 'school',
  education: 'school',
  hospital: 'hospital',
};

/** The exterior each use asks for; packs without one keep their usual architecture. */
const USE_STYLES: Readonly<Partial<Record<BuildingUse, string>>> = {
  mall: 'molen.worldgen.generic.shopping_mall',
  office: 'molen.worldgen.use.office_block',
  skyscraper: 'molen.worldgen.use.skyscraper',
  apartment_tower: 'molen.worldgen.use.apartment_tower',
  hotel: 'molen.worldgen.use.hotel',
  hospital: 'molen.worldgen.use.hospital',
  school: 'molen.worldgen.use.school',
  place_of_worship: 'molen.worldgen.use.place_of_worship',
  theatre: 'molen.worldgen.use.theatre',
  cinema: 'molen.worldgen.use.theatre',
  museum: 'molen.worldgen.use.museum',
  sports_hall: 'molen.worldgen.use.sports_hall',
  civic: 'molen.worldgen.use.civic',
  station: 'molen.worldgen.catalog.railway_station',
  fire_station: 'molen.worldgen.catalog.brick_fire_station',
  library: 'molen.worldgen.catalog.public_library',
};

/** Uses that need no POI to name them: a host may declare any of these outright. */
const BUILDING_USES: ReadonlySet<string> = new Set<BuildingUse>([
  'mall',
  'office',
  'skyscraper',
  'apartments',
  'apartment_tower',
  'hotel',
  'hospital',
  'school',
  'place_of_worship',
  'theatre',
  'cinema',
  'museum',
  'sports_hall',
  'civic',
  'station',
  'fire_station',
  'library',
]);

/**
 * Exteriors for declared uses the pack's own rules would misread: they send a warehouse of any
 * size to a shopping mall or a shop front, which is right for an unlabelled retail shed and wrong
 * for a building whose owner said what it is.
 */
const DECLARED_STYLES: Readonly<Record<string, string>> = {
  warehouse: 'molen.worldgen.generic.warehouse',
  industrial: 'molen.worldgen.generic.warehouse',
};

/** Smaller than this, a footprint is a kiosk or an outbuilding of whatever it stands in. */
const MIN_AREA = 180;
/** A chapel or a neighbourhood mosque is a building in its own right at a fraction of that. */
const MIN_WORSHIP_AREA = 25;
/** Past this a footprint holding a place of worship's point is a complex it is one part of, m². */
const MAX_WORSHIP_HALL = 3000;
/**
 * Footprint from which a use a POI names takes over the whole exterior, m². Below it the use is
 * a tenant of an ordinary building: a guest house in a town house, a gallery in a shop, a branch
 * library on a ground floor. The inside still follows the use; the outside stays its region's.
 * Uses not listed take over at any size.
 */
const EXTERIOR_AREA: Readonly<Partial<Record<BuildingUse, number>>> = {
  hotel: 900,
  museum: 500,
  theatre: 400,
  cinema: 400,
  library: 400,
  civic: 400,
  sports_hall: 400,
  station: 250,
};
/** Uses that occupy an old town's ordinary buildings as readily as their own. */
const ROW_TENANTS: ReadonlySet<BuildingUse> = new Set([
  'hotel',
  'hospital',
  'school',
  'museum',
  'library',
  'civic',
  'theatre',
  'cinema',
]);
/** A mapped height from which a lodging is a hotel block whatever its footprint, meters. */
const HOTEL_HEIGHT = 15;
/** Below this, a mapped use on land like a campus is a shed, not a teaching block. */
const MIN_CAMPUS_AREA = 300;
const MALL_AREA = 5000;
const MALL_TENANTS = 8;
/** Other businesses under the roof from which a named use is one occupant among several. */
const SHARED_TENANTS = 4;
/** Heights that change what a block is, in meters. */
const OFFICE_HEIGHT = 15;
const FLATS_HEIGHT = 12;
const TOWER_HEIGHT = 45;
const SKYSCRAPER_HEIGHT = 60;
/** Where a height is unmapped, what storeys it would take to be one of those. */
const STOREY = 3.2;

export interface BuildingUseEvidence {
  use: BuildingUse;
  /** What decided it: a mapped identity outranks a guess from shape. */
  source: 'identity' | 'occupant' | 'tenants' | 'land' | 'form';
  name?: string;
  /** The POI's own detail: a place of worship's religion, as the map words it. */
  detail?: string;
  /**
   * The footprint holds other businesses or institutions too: a block of a town, mapped as one
   * outline, that the use occupies a part of.
   */
  shared?: boolean;
}

function metersHigh(piece: BuildingPiece): number | undefined {
  const { height, levels } = piece.feature;
  return height ?? (levels !== undefined ? levels * STOREY : undefined);
}

/** A block's use from its shape and the land it stands on. */
function fromForm(
  height: number | undefined,
  context: string | undefined,
): BuildingUse | undefined {
  if (height === undefined) return undefined;
  if (context === 'residential') {
    if (height >= TOWER_HEIGHT) return 'apartment_tower';
    return height >= FLATS_HEIGHT ? 'apartments' : undefined;
  }
  if (height >= SKYSCRAPER_HEIGHT) return 'skyscraper';
  return (context === 'commercial' || context === 'retail') && height >= OFFICE_HEIGHT
    ? 'office'
    : height >= TOWER_HEIGHT
      ? 'office'
      : undefined;
}

/** The evidence for every footprint a use can be argued for. */
export function associateBuildingUses(
  tile: TerrainSemanticTile,
  pieces: readonly BuildingPiece[],
  tileSize: number,
  contextOf: (piece: BuildingPiece) => string | undefined,
): Map<BuildingPiece, BuildingUseEvidence> {
  const found = new Map<BuildingPiece, BuildingUseEvidence>();
  const mapped = pieces
    .filter(
      (piece) =>
        // A remainder is what is left around mapped parts: still the same building.
        piece.feature.tags?.['molen:inferred'] === undefined,
    )
    .map((piece) => ({
      piece,
      bounds: polygonBounds(piece.polygon),
      area: polygonArea(piece.polygon) * tileSize * tileSize,
    }));
  const solid = mapped.filter(({ area }) => area >= MIN_AREA);
  const chapels = mapped.filter(({ area }) => area >= MIN_WORSHIP_AREA && area < MIN_AREA);
  const hosts = (poi: TerrainPoiFeature, among: typeof solid = solid): typeof solid =>
    among.filter(
      ({ piece, bounds }) =>
        poi.point[0] >= bounds[0] &&
        poi.point[0] <= bounds[2] &&
        poi.point[1] >= bounds[1] &&
        poi.point[1] <= bounds[3] &&
        pointInPolygon(poi.point, piece.polygon),
    );
  const tenants = new Map<BuildingPiece, number>();
  /** The different uses POIs inside a footprint name, where they are not the footprint itself. */
  const occupants = new Map<BuildingPiece, Set<BuildingUse>>();
  const halls: Array<{ piece: BuildingPiece; evidence: BuildingUseEvidence }> = [];
  for (const poi of tile.pois ?? []) {
    const use = USE_BY_POI[poi.class];
    if (use === undefined) {
      if (TENANTS.has(poi.class)) {
        const inside = hosts(poi);
        if (inside.length === 1) {
          const host = (inside[0] as (typeof solid)[number]).piece;
          tenants.set(host, (tenants.get(host) ?? 0) + 1);
        }
      }
      continue;
    }
    const worship = use === 'place_of_worship';
    const named = {
      ...(poi.name !== undefined ? { name: poi.name } : {}),
      ...(worship && poi.subclass !== undefined ? { detail: poi.subclass } : {}),
    };
    const sized = worship ? [...solid, ...chapels] : solid;
    const same = sized.filter(({ piece }) => poi.id !== undefined && piece.feature.id === poi.id);
    if (same.length > 0) {
      for (const { piece } of same) found.set(piece, { use, source: 'identity', ...named });
      continue;
    }
    const inside = hosts(poi, sized);
    if (inside.length !== 1) continue;
    const { piece } = inside[0] as (typeof solid)[number];
    if (found.get(piece)?.source === 'identity') continue;
    // A place of worship or a cinema inside a tower does not make the tower one.
    const contained = ['hotel', 'hospital', 'school', 'mall', 'library', 'museum'].includes(use);
    if (contained) {
      found.set(piece, { use, source: 'occupant', ...named });
      occupants.set(piece, (occupants.get(piece) ?? new Set()).add(use));
    }
    // A place of worship mapped as a point stands in its own building: a chapel in a footprint
    // the size of one is it outright; a hall-sized one is decided once the tenants are counted.
    else if (worship && inside[0] !== undefined) {
      if (inside[0].area < MIN_AREA) found.set(piece, { use, source: 'identity', ...named });
      else if (inside[0].area <= MAX_WORSHIP_HALL && (metersHigh(piece) ?? 0) < OFFICE_HEIGHT)
        halls.push({ piece, evidence: { use, source: 'occupant', ...named } });
    }
  }
  // A prayer room above a row of shops does not make the row a temple.
  for (const { piece, evidence } of halls)
    if (!found.has(piece) && (tenants.get(piece) ?? 0) === 0) found.set(piece, evidence);
  // A hotel over a street of shops, or beside a museum under the same outline, is one occupant
  // of a town block: old centers are often mapped a block to a footprint.
  for (const [piece, evidence] of found)
    if (
      evidence.source === 'occupant' &&
      ((tenants.get(piece) ?? 0) >= SHARED_TENANTS || (occupants.get(piece)?.size ?? 0) > 1)
    )
      evidence.shared = true;
  for (const { piece, area } of solid) {
    if (found.has(piece)) continue;
    // A richer source that names the use outright needs no argument.
    const named = USE_BY_POI[piece.feature.subclass ?? ''];
    if (named !== undefined) {
      found.set(piece, { use: named, source: 'identity' });
      continue;
    }
    if (area >= MALL_AREA && (tenants.get(piece) ?? 0) >= MALL_TENANTS) {
      found.set(piece, { use: 'mall', source: 'tenants' });
      continue;
    }
    const context = contextOf(piece);
    const land = context !== undefined ? LAND_USES[context] : undefined;
    if (land !== undefined && area >= MIN_CAMPUS_AREA) {
      found.set(piece, { use: land, source: 'land' });
      continue;
    }
    const form = fromForm(metersHigh(piece), context);
    if (form !== undefined) found.set(piece, { use: form, source: 'form' });
  }
  return found;
}

/**
 * Whether a use takes over a building's exterior, or is a tenant behind an ordinary front. A use
 * argued from land or shape, or counted from a crowd of tenants, is about the whole building; a
 * use a POI names needs the building to be the size of one.
 */
export function useOwnsExterior(
  evidence: BuildingUseEvidence,
  scale: { area: number; height?: number; attached?: boolean },
): boolean {
  if (evidence.source === 'land' || evidence.source === 'form' || evidence.source === 'tenants')
    return true;
  if (evidence.use === 'hotel' && (scale.height ?? 0) >= HOTEL_HEIGHT) return true;
  // One of a row or a block with no height mapped, or one occupant among several: a building
  // of its street that the use moved into (a hotel in a palazzo, a school in a terrace),
  // whatever its size.
  if (
    ROW_TENANTS.has(evidence.use) &&
    (evidence.shared === true || (scale.attached === true && scale.height === undefined))
  )
    return false;
  return scale.area >= (EXTERIOR_AREA[evidence.use] ?? 0);
}

/**
 * Give a building request its use. Packs without the style keep their architecture, and so does
 * a building too small to be anything but an ordinary one the use occupies (`scale`, when given).
 */
export function applyBuildingUse(
  request: BuildingRequest,
  evidence: BuildingUseEvidence,
  styles: ResolvedStylePack['archstyles'],
  scale?: { area: number; height?: number; attached?: boolean },
): void {
  // Ahead of any tenant: a cafe in the lobby does not make the tower a cafe.
  request.interiorLabels = [evidence.use, ...(request.interiorLabels ?? [])];
  if (scale !== undefined && !useOwnsExterior(evidence, scale)) return;
  // A block of flats looks like its city: a Parisian one is Parisian. Only its inside changes.
  const style = USE_STYLES[evidence.use];
  if (style === undefined) return;
  // A regional place of worship is already in its region's stone and roof: keep it.
  if (evidence.use === 'place_of_worship' && /.worship(.|$)/.test(request.style ?? '')) return;
  if (styles[style] !== undefined) request.style = style;
  request.labels = [evidence.use, ...request.labels];
}

/**
 * Give a building request the use its owner declared (a map override's `use`, carried as the
 * feature's subclass). Nothing is argued from POIs, land or shape, so the answer is the same at
 * every tile level: the inside follows the use, and the outside does too unless the request
 * already names a style. Packs without the style keep their architecture.
 */
export function applyDeclaredBuildingUse(
  request: BuildingRequest,
  label: string,
  styles: ResolvedStylePack['archstyles'],
): void {
  const use: BuildingUse | undefined =
    USE_BY_POI[label] ?? (BUILDING_USES.has(label) ? (label as BuildingUse) : undefined);
  if (use !== undefined) request.interiorLabels = [use, ...(request.interiorLabels ?? [])];
  if (request.style !== undefined) return;
  const style = (use !== undefined ? USE_STYLES[use] : undefined) ?? DECLARED_STYLES[label];
  if (style === undefined || styles[style] === undefined) return;
  request.style = style;
  if (use !== undefined && !request.labels.includes(use)) request.labels = [use, ...request.labels];
}

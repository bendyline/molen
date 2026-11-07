/**
 * Which mapped footprints are multi-storey car parks. Stock Protomaps tiles drop `building=parking`
 * and `parking=multi-storey`, but they keep two things that identify one: a `parking` POI carrying
 * the source id of the footprint itself (one OSM element tagged both `building=*` and
 * `amenity=parking`), and `parking_entrance` nodes on its walls.
 */
import {
  pointInPolygon,
  polygonArea,
  polygonBounds,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { BuildingRequest, ResolvedStylePack, Vec2 } from '@bendyline/molen-worldgen/kernel';
import type { BuildingPiece } from './building-parts';

export const PARKING_GARAGE_STYLE = 'molen.worldgen.use.parking_garage';
export const PARKING_GARAGE_LABEL = 'parking_garage';

/** Less than this cannot hold a ramp and stalls: small roofed lots and mechanical stackers. */
const MIN_AREA = 450;
/** Taller is a tower with parking in it, not a parking structure. Sydney's tallest mapped is 38 m. */
const MAX_HEIGHT = 48;
const MAX_LEVELS = 14;
/** A footprint mapped with no height at all: the commonest size of a city deck. */
const DEFAULT_LEVELS = 3;
/** Protomaps derives missing heights this way, from `building:levels`. */
const STOREY = 3;
const ROOF_ALLOWANCE = 2;
const PARAPET = 1.1;
/** How far a mapped entrance can sit from the wall it serves, in meters. */
const ENTRANCE_REACH = 6;
const MAX_ENTRANCES = 8;
/** Names that say structure. A POI that only says "parking" inside a tower is its basement. */
const STRUCTURE_NAME =
  /\b(garage|parkade|parkhaus|parking (deck|structure|ramp|building|tower)|car ?park)\b|立体駐車場|立駐/i;

export interface ParkingStructure {
  levels: number;
  /** Mapped vehicle entrances, in normalized tile coordinates, strongest first. */
  entrances: TerrainSemanticPoint[];
  /** The POI that named it, when it has one. */
  name?: string;
}

function distanceToBoundary(point: TerrainSemanticPoint, polygon: TerrainSemanticPolygon): number {
  let best = Number.POSITIVE_INFINITY;
  const ring = polygon.outer;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as TerrainSemanticPoint,
      b = ring[(i + 1) % ring.length] as TerrainSemanticPoint;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
    best = Math.min(best, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz));
  }
  return best;
}

/** Decks below the roof: mapped levels, or undone from the height Protomaps built from them. */
export function parkingLevels(height: number | undefined, levels: number | undefined): number {
  const mapped =
    levels !== undefined && levels >= 1
      ? levels
      : height !== undefined
        ? (height - ROOF_ALLOWANCE) / STOREY
        : DEFAULT_LEVELS;
  return Math.max(1, Math.min(MAX_LEVELS, Math.round(mapped)));
}

function eligible(piece: BuildingPiece, tileSize: number): boolean {
  const { feature, polygon, remainder } = piece;
  if (feature.class === 'building_part' || remainder !== undefined) return false;
  if (feature.tags?.['molen:inferred'] !== undefined) return false;
  if ((feature.minHeight ?? 0) > 0 || (feature.height ?? 0) > MAX_HEIGHT) return false;
  return polygonArea(polygon) * tileSize * tileSize >= MIN_AREA;
}

/** Footprints that are car parks, and what the map says about them. */
export function associateParkingStructures(
  tile: TerrainSemanticTile,
  pieces: readonly BuildingPiece[],
  tileSize: number,
): Map<BuildingPiece, ParkingStructure> {
  const found = new Map<BuildingPiece, ParkingStructure>();
  const pois = tile.pois ?? [];
  const parking = pois.filter((poi) => poi.class === 'parking');
  if (parking.length === 0) return found;
  const candidates = pieces
    .filter((piece) => eligible(piece, tileSize))
    .map((piece) => ({ piece, bounds: polygonBounds(piece.polygon) }));
  const add = (piece: BuildingPiece, poi: TerrainPoiFeature): void => {
    if (!found.has(piece))
      found.set(piece, {
        levels: parkingLevels(piece.feature.height, piece.feature.levels),
        entrances: [],
        ...(poi.name !== undefined ? { name: poi.name } : {}),
      });
  };
  for (const poi of parking) {
    const direct = candidates.filter(
      ({ piece }) => poi.id !== undefined && piece.feature.id === poi.id,
    );
    if (direct.length > 0) {
      for (const { piece } of direct) add(piece, poi);
      continue;
    }
    // A separately mapped parking area: its name must claim a structure, since a POI alone
    // inside a footprint is as likely a tower's basement. Skip anything nested or ambiguous.
    if (poi.name === undefined || !STRUCTURE_NAME.test(poi.name)) continue;
    const hosts = candidates.filter(
      ({ piece, bounds }) =>
        poi.point[0] >= bounds[0] &&
        poi.point[0] <= bounds[2] &&
        poi.point[1] >= bounds[1] &&
        poi.point[1] <= bounds[3] &&
        pointInPolygon(poi.point, piece.polygon),
    );
    if (hosts.length === 1) add((hosts[0] as (typeof hosts)[number]).piece, poi);
  }
  const reach = ENTRANCE_REACH / tileSize;
  const entrances = pois
    .filter((poi) => poi.class === 'parking_entrance')
    .sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]);
  for (const [piece, structure] of found) {
    structure.entrances = entrances
      .filter(
        (poi) =>
          pointInPolygon(poi.point, piece.polygon) ||
          distanceToBoundary(poi.point, piece.polygon) <= reach,
      )
      // A named entrance is a driveway somebody signed; an unnamed node may be a stair door.
      .sort((a, b) => Number(b.name !== undefined) - Number(a.name !== undefined))
      .slice(0, MAX_ENTRANCES)
      .map((poi) => poi.point);
  }
  return found;
}

/** Turn a building request into a car park. Packs without the style keep their architecture. */
export function applyParkingStructure(
  request: BuildingRequest,
  structure: ParkingStructure,
  size: number,
  styles: ResolvedStylePack['archstyles'],
): void {
  if (styles[PARKING_GARAGE_STYLE] === undefined) return;
  request.style = PARKING_GARAGE_STYLE;
  request.labels = [PARKING_GARAGE_LABEL, ...request.labels];
  request.interiorLabels = [PARKING_GARAGE_LABEL, ...(request.interiorLabels ?? [])];
  request.levels = structure.levels;
  // Decks must stand a car even where the map's height is a rounding of nothing.
  request.height = Math.max(request.height ?? 0, structure.levels * STOREY + PARAPET);
  // Openings are worth more here than on any neighbour: they are the whole building.
  request.priority = 1;
  // Ground-floor tenants do not repaint a car park, or sign its wall as a shop.
  delete request.storefronts;
  delete request.appearance;
  request.parking = {
    levels: structure.levels,
    ...(structure.entrances.length > 0
      ? { entrances: structure.entrances.map((p): Vec2 => [p[0] * size, p[1] * size]) }
      : {}),
  };
}

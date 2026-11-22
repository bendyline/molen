/**
 * Where a place is, in words: the street it is on or beside, the settlement it is in or near, and
 * the district of that settlement, read from map tiles the view streams anyway. It backs
 * `EarthView.locate`, a reverse geocoder with no service behind it.
 *
 * The locator observes the human-features layer (as the audio terrain does) and keeps two things:
 * - per rendered tile, the roads that have a name or a route number, as references to the decoded
 *   features (nothing copied), dropped when the stream evicts the tile;
 * - the place labels of every tile (`TerrainSemanticTile.places`: cities, towns, villages and
 *   their districts), in world coordinates, kept after their tile leaves (up to MAX_LABELS, the
 *   least recently seen going first), so a city's label still names it once the camera is far
 *   enough in that only finer tiles, which hold no city label, are loaded.
 *
 * Streets come from the finest roads at hand. Basemaps drop minor streets' names below their last
 * zoom (Protomaps' zoom 13 names main roads only), so where the package has a building-detail
 * level (`useStreets`: molen-terrain's `OpenTerrainPackageBuildingDetail.streets`) the locator
 * loads that level's roads alone for the tiles around the place it is asked about: up to
 * MAX_STREET_TILES, the least recently used going first. They are the tiles the view read for
 * buildings, so the bytes are usually in the byte cache already, and the roads-only decode runs
 * on the semantic worker. Until a place's tile arrives, or where that level has no roads, the
 * rendered tiles answer, at the finest level holding the place.
 *
 * A label is a point, not an outline. A settlement's extent is estimated from its kind and
 * population (`placeExtent`). The settlement a place is in is the one whose label is nearest
 * relative to that extent (downtown Bellevue is Bellevue, not Seattle ten kilometres away); a place
 * in none is near the one whose estimated edge is nearest, within three extents and 10 km of it.
 *
 * Costs: a lookup reads only tiles within reach of the place and skips any road whose bounds
 * cannot come nearer than the nearest found (bounds are measured once per decoded line), then
 * scans the label list; well under a millisecond in a dense city. A street tile loads once per
 * tile the place enters (about a kilometre on a side at zoom 15). It is still for a slow poll (a
 * HUD refreshed every second or so), not every frame; pass `street: false` where no street is
 * wanted (in the air), so a fast aircraft loads no street tiles.
 */
import type {
  TerrainPlaceFeature,
  TerrainPyramidTileLayerContext,
  TerrainSemanticPoint,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from '@bendyline/molen-terrain/client';
import { roadWidth } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

/** The street {@link EarthView.locate} found. */
export interface EarthStreet {
  /** The road's name ("Buena Road"); absent for a road the map knows only by its number. */
  name?: string;
  /** Its route numbers as mapped, `;`-separated ("WA 22", "I 82;US 12"). */
  ref?: string;
  /** The map's road class (`major_road`, `minor_road`, `highway`, `path`, …). */
  class: string;
  /** The map's finer class (`primary`, `residential`, `footway`, …), when it has one. */
  subclass?: string;
  /** Meters from the place to the road's edge: 0 on the road. */
  distance: number;
}

/** A settlement or district {@link EarthView.locate} found. */
export interface EarthLocality {
  /** The map's name for it, in its local script. */
  name: string;
  /** An English or Latin-script name, when the map has one besides `name`. */
  nameLatin?: string;
  /**
   * What it is: `city`, `town`, `village`, `hamlet` (settlements), `suburb`, `quarter`,
   * `neighbourhood` (districts), or the map's own word when it gives no finer one.
   */
  kind: string;
  /** Inhabitants, when the map knows. */
  population?: number;
  /** Where the map labels it. */
  latitude: number;
  longitude: number;
  /** Meters from the place to the label. */
  distance: number;
  /** Its estimated radius in meters, from its kind and population (the map has no outline). */
  extent: number;
  /** The place lies within `extent`: "in Buena" rather than "near Buena". */
  within: boolean;
}

/** What {@link EarthView.locate} returns; each part is absent when the loaded map does not say. */
export interface EarthLocation {
  /** The nearest named road within `streetRadius`, preferring one running along `heading`. */
  street?: EarthStreet;
  /**
   * The settlement the place is in, or else the one whose estimated edge is nearest (within three
   * of its extents and 10 km).
   */
  locality?: EarthLocality;
  /** The district the place is in, when the map labels one around it. */
  district?: EarthLocality;
}

/** What to locate: a place, and optionally which way the viewer is going. */
export interface EarthLocateOptions {
  latitude: number;
  longitude: number;
  /**
   * Compass heading of travel, radians. At a junction the road running this way wins over the
   * cross street, so a moving viewer's street does not flicker as it passes side streets.
   */
  heading?: number;
  /** How far from the road's edge a street still counts, meters (default 30). */
  streetRadius?: number;
  /**
   * Look for the street (default true). Pass false where it means nothing (in the air), so the
   * lookup loads no street tiles.
   */
  street?: boolean;
}

type Point = TerrainSemanticPoint;
type TileAddress = TerrainPyramidTileLayerContext['address'];

/** A located label in world coordinates, as the view converts it. */
export interface LocatedLabel extends Omit<EarthLocality, 'latitude' | 'longitude'> {
  x: number;
  z: number;
}

/**
 * Roads at one level finer than the rendered feature tiles, loaded a tile at a time for lookups:
 * the view wires the package's building-detail level here (molen-terrain's
 * `OpenTerrainPackageBuildingDetail.streets`), where basemaps keep the side streets' names.
 */
export interface EarthStreetSource {
  level: number;
  load(address: TileAddress, signal: AbortSignal): Promise<TerrainSemanticTile | undefined>;
}

/** A tile's named, street-like roads, where it lies in the world. */
interface StreetTile {
  level: number;
  origin: readonly [number, number];
  tileSize: number;
  roads: readonly TerrainTransportationFeature[];
}

/** A street-source tile: its streets, null where the source holds no roads there, or loading. */
type StreetSourceTile = StreetTile | null | 'loading';

interface Label {
  x: number;
  z: number;
  name: string;
  nameLatin?: string;
  kind: string;
  population?: number;
  settlement: boolean;
  extent: number;
}

/** Street-source tiles kept: the few around a walker or a car, and the way back. */
const MAX_STREET_TILES = 16;
/** Meters past `streetRadius` a tile may lie and still be searched (wide roads' half widths). */
const REACH_SLACK = 50;
/** Labels kept for the session; a dense city region holds a few hundred. */
const MAX_LABELS = 4096;
/** Default reach of a street, meters past the road's edge. */
const STREET_RADIUS = 30;
/** Meters a road running square to `heading` counts as being farther away than it is. */
const CROSSING_PENALTY = 12;
/** A settlement farther than this many extents, or this many meters past its edge, is not "near". */
const NEAR_EXTENTS = 3;
const NEAR_GAP = 10_000;
/** Extent = max(the kind's, this × √population), meters. */
const POPULATION_EXTENT = 15;
const MAX_EXTENT = 25_000;

/** Ways that are not streets: tracks, ferries, lifts and airfield pavement. */
const NOT_STREETS: ReadonlySet<string> = new Set([
  'rail',
  'railway',
  'light_rail',
  'subway',
  'tram',
  'monorail',
  'funicular',
  'narrow_gauge',
  'ferry',
  'aerialway',
  'aeroway',
  'runway',
  'taxiway',
  'apron',
  'platform',
]);

/** Kinds of district; any other place label is a settlement. */
const DISTRICTS: ReadonlySet<string> = new Set([
  'neighbourhood',
  'macrohood',
  'suburb',
  'quarter',
  'borough',
  'city_block',
]);

/** Typical radius of each kind of place, meters, before population is counted. */
const KIND_EXTENT: Readonly<Record<string, number>> = {
  city: 6_000,
  town: 2_500,
  village: 1_200,
  locality: 1_200,
  hamlet: 500,
  isolated_dwelling: 200,
  borough: 3_000,
  macrohood: 2_500,
  suburb: 1_500,
  quarter: 1_000,
  neighbourhood: 600,
  city_block: 200,
};

/**
 * A place's estimated radius in meters: its kind's typical radius, raised for a large population
 * (15 m per √inhabitant, suburban density: Seattle, 737k, about 13 km), at most 25 km. Exported
 * for tests.
 */
export function placeExtent(kind: string, population: number | undefined): number {
  const typical = KIND_EXTENT[kind] ?? 1_000;
  const fromPopulation = population !== undefined ? POPULATION_EXTENT * Math.sqrt(population) : 0;
  return Math.min(MAX_EXTENT, Math.max(typical, fromPopulation));
}

/** The label's kind: the finer one when the map gives it (`locality` → `village`). */
function placeKind(place: TerrainPlaceFeature): string {
  return place.subclass ?? place.class;
}

function isDistrict(place: TerrainPlaceFeature): boolean {
  return (
    DISTRICTS.has(place.class) || (place.subclass !== undefined && DISTRICTS.has(place.subclass))
  );
}

function isStreet(road: TerrainTransportationFeature): boolean {
  if (road.tunnel) return false;
  if (road.name === undefined && road.ref === undefined) return false;
  return (
    !NOT_STREETS.has(road.class) && (road.subclass === undefined || !NOT_STREETS.has(road.subclass))
  );
}

/** Each line's tile-normalized bounds, computed once per (immutable) decoded line. */
const lineBounds = new WeakMap<Point[], [number, number, number, number]>();

/** Distance from (u, v) to the bounds of `line`: a lower bound on the distance to the line. */
function boundsDistance(u: number, v: number, line: Point[]): number {
  let box = lineBounds.get(line);
  if (box === undefined) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [pu, pv] of line) {
      if (pu < box[0]) box[0] = pu;
      if (pv < box[1]) box[1] = pv;
      if (pu > box[2]) box[2] = pu;
      if (pv > box[3]) box[3] = pv;
    }
    lineBounds.set(line, box);
  }
  return Math.hypot(Math.max(box[0] - u, 0, u - box[2]), Math.max(box[1] - v, 0, v - box[3]));
}

/**
 * The nearest segment of `line` to (u, v): its distance (tile units) and how square it runs to
 * the direction (du, dv), 0 along it to 1 across it; 0 when no direction is given.
 */
function nearestSegment(
  u: number,
  v: number,
  line: Point[],
  du: number,
  dv: number,
): { distance: number; across: number } {
  let distance = Infinity;
  let across = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    const sx = b[0] - a[0];
    const sv = b[1] - a[1];
    const length2 = sx * sx + sv * sv;
    const t =
      length2 > 0 ? Math.max(0, Math.min(1, ((u - a[0]) * sx + (v - a[1]) * sv) / length2)) : 0;
    const d = Math.hypot(u - a[0] - t * sx, v - a[1] - t * sv);
    if (d < distance) {
      distance = d;
      across =
        length2 > 0 && (du !== 0 || dv !== 0)
          ? Math.abs(du * sv - dv * sx) / Math.sqrt(length2)
          : 0;
    }
  }
  return { distance, across };
}

/** Meters from (x, z) to the tile's square: 0 inside it. */
function outsideTile(tile: StreetTile, x: number, z: number): number {
  const { origin, tileSize } = tile;
  return Math.hypot(
    Math.max(origin[0] - x, 0, x - origin[0] - tileSize),
    Math.max(origin[1] - z, 0, z - origin[1] - tileSize),
  );
}

export class EarthLocator {
  /** Every rendered feature tile, with its streets (possibly none). */
  private readonly tiles = new Map<THREE.Object3D, StreetTile>();
  /** Labels by name, kind and 100 m cell, most recently seen last. */
  private readonly labels = new Map<string, Label>();
  private streets: EarthStreetSource | undefined;
  /** The world square of the tile pyramid, read from the rendered tiles. */
  private pyramid: { origin: readonly [number, number]; rootSize: number } | undefined;
  /** Street-source tiles by address, most recently used last. */
  private readonly streetTiles = new Map<string, StreetSourceTile>();
  private loads = new AbortController();

  readonly observer: SemanticTileObserver = {
    added: (object, tile, context) => this.add(object, tile, context),
    removed: (object) => {
      this.tiles.delete(object);
    },
  };

  /**
   * Read streets from `source` (a level finer than the rendered tiles) wherever it holds roads,
   * ahead of the rendered tiles; undefined stops. Each lookup loads the source's tiles around the
   * place it is asked about, once, and answers from the rendered tiles until they arrive.
   */
  useStreets(source: EarthStreetSource | undefined): void {
    this.loads.abort();
    this.loads = new AbortController();
    this.streetTiles.clear();
    this.streets = source;
  }

  private add(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void {
    const { origin, tileSize, address, pyramid } = context;
    if (pyramid !== undefined && Number.isFinite(pyramid.rootSize))
      this.pyramid = { origin: pyramid.origin, rootSize: pyramid.rootSize };
    this.tiles.set(object, {
      level: address.level,
      origin,
      tileSize,
      roads: tile.transportation.filter(isStreet),
    });
    for (const place of tile.places ?? []) {
      const x = origin[0] + place.point[0] * tileSize;
      const z = origin[1] + place.point[1] * tileSize;
      const kind = placeKind(place);
      const key = `${place.name}|${kind}|${Math.round(x / 100)}|${Math.round(z / 100)}`;
      // Seen again: moved to the end, so the oldest labels go first.
      this.labels.delete(key);
      this.labels.set(key, {
        x,
        z,
        name: place.name,
        ...(place.nameLatin !== undefined ? { nameLatin: place.nameLatin } : {}),
        kind,
        ...(place.population !== undefined ? { population: place.population } : {}),
        settlement: !isDistrict(place),
        extent: placeExtent(kind, place.population),
      });
    }
    while (this.labels.size > MAX_LABELS)
      this.labels.delete(this.labels.keys().next().value as string);
  }

  /** The street, settlement and district at world (x, z); see {@link EarthLocateOptions}. */
  locate(
    x: number,
    z: number,
    options: { heading?: number; streetRadius?: number; street?: boolean } = {},
  ): { street?: EarthStreet; locality?: LocatedLabel; district?: LocatedLabel } {
    const street =
      options.street === false
        ? undefined
        : this.street(x, z, options.heading, options.streetRadius ?? STREET_RADIUS);
    // Inside: the most central for its size (downtown Bellevue is Bellevue, though within
    // Seattle's reach). Outside every one: the nearest edge (2 km past a village is near the
    // village, not near the city 16 km away whose estimated edge is 6 km off).
    let inside: Label | undefined;
    let insideScore = Infinity;
    let near: Label | undefined;
    let nearGap = Infinity;
    let district: Label | undefined;
    let districtScore = Infinity;
    for (const label of this.labels.values()) {
      const score = Math.hypot(label.x - x, label.z - z) / label.extent;
      if (!label.settlement) {
        if (score <= 1 && score < districtScore) {
          district = label;
          districtScore = score;
        }
      } else if (score <= 1) {
        if (score < insideScore) {
          inside = label;
          insideScore = score;
        }
      } else if (score <= NEAR_EXTENTS) {
        const gap = (score - 1) * label.extent;
        if (gap <= NEAR_GAP && gap < nearGap) {
          near = label;
          nearGap = gap;
        }
      }
    }
    const locality = inside ?? near;
    const located = (label: Label): LocatedLabel => {
      const { settlement: _settlement, ...rest } = label;
      const distance = Math.hypot(label.x - x, label.z - z);
      return { ...rest, distance, within: distance <= label.extent };
    };
    return {
      ...(street !== undefined ? { street } : {}),
      ...(locality !== undefined ? { locality: located(locality) } : {}),
      ...(district !== undefined ? { district: located(district) } : {}),
    };
  }

  private street(
    x: number,
    z: number,
    heading: number | undefined,
    radius: number,
  ): EarthStreet | undefined {
    // Heading as a world direction: +X east, +Z south.
    const du = heading !== undefined && Number.isFinite(heading) ? Math.sin(heading) : 0;
    const dv = heading !== undefined && Number.isFinite(heading) ? -Math.cos(heading) : 0;
    const reach = radius + REACH_SLACK;
    let best: EarthStreet | undefined;
    let bestScore = Infinity;
    // A rendered tile as fine as the street source holds the same roads (molen-terrain's road
    // detail gives tiles at that level its roads): no street tile is loaded under the reader then.
    const rendered = this.renderedTiles(x, z, reach);
    const fineEnough =
      this.streets !== undefined &&
      rendered[0] !== undefined &&
      rendered[0].level >= this.streets.level;
    for (const { origin, tileSize, roads } of fineEnough
      ? rendered
      : (this.sourceTiles(x, z, reach) ?? rendered)) {
      const u = (x - origin[0]) / tileSize;
      const v = (z - origin[1]) / tileSize;
      for (const road of roads) {
        const half = (road.width ?? roadWidth(road.class)) / 2;
        for (const line of road.lines) {
          // Measured only if it could come nearer than the best so far.
          const near = boundsDistance(u, v, line) * tileSize - half;
          if (near > radius || near >= bestScore) continue;
          const segment = nearestSegment(u, v, line, du, dv);
          const distance = Math.max(0, segment.distance * tileSize - half);
          if (distance > radius) continue;
          const score = distance + CROSSING_PENALTY * segment.across;
          if (score >= bestScore) continue;
          bestScore = score;
          best = {
            ...(road.name !== undefined ? { name: road.name } : {}),
            ...(road.ref !== undefined ? { ref: road.ref } : {}),
            class: road.class,
            ...(road.subclass !== undefined ? { subclass: road.subclass } : {}),
            distance,
          };
        }
      }
    }
    return best;
  }

  /**
   * The street source's loaded tiles within `reach` of (x, z), when the one holding the place has
   * roads; undefined while it loads, where the source has none, or without a source (the rendered
   * tiles answer then). Starts loading any tile in reach not yet asked for.
   */
  private sourceTiles(x: number, z: number, reach: number): StreetTile[] | undefined {
    const source = this.streets;
    const pyramid = this.pyramid;
    if (source === undefined || pyramid === undefined) return undefined;
    const { level } = source;
    const count = 2 ** level;
    const size = pyramid.rootSize / count;
    const column = (value: number, start: number) =>
      Math.min(count - 1, Math.max(0, Math.floor((value - start) / size)));
    const [originX, originZ] = pyramid.origin;
    const hereX = column(x, originX);
    const hereZ = column(z, originZ);
    let here: StreetSourceTile | undefined;
    const found: StreetTile[] = [];
    // The place's tile and the neighbours `reach` touches: at most three others at street radii,
    // and never past the 3 × 3 around it, so a wide radius cannot flush the tiles in use.
    const fromZ = Math.max(hereZ - 1, column(z - reach, originZ));
    const toZ = Math.min(hereZ + 1, column(z + reach, originZ));
    const fromX = Math.max(hereX - 1, column(x - reach, originX));
    const toX = Math.min(hereX + 1, column(x + reach, originX));
    for (let tz = fromZ; tz <= toZ; tz++) {
      for (let tx = fromX; tx <= toX; tx++) {
        const key = `${tx}/${tz}`;
        let tile = this.streetTiles.get(key);
        if (tile === undefined) {
          tile = 'loading';
          this.load(
            source,
            { level, x: tx, z: tz },
            key,
            [originX + tx * size, originZ + tz * size],
            size,
          );
        } else {
          // Used again: moved to the end, so the least recently used goes first.
          this.streetTiles.delete(key);
          this.streetTiles.set(key, tile);
        }
        if (tx === hereX && tz === hereZ) here = tile;
        if (tile !== null && tile !== 'loading') found.push(tile);
      }
    }
    return here !== undefined && here !== null && here !== 'loading' ? found : undefined;
  }

  private load(
    source: EarthStreetSource,
    address: TileAddress,
    key: string,
    origin: [number, number],
    tileSize: number,
  ): void {
    const signal = this.loads.signal;
    this.streetTiles.set(key, 'loading');
    while (this.streetTiles.size > MAX_STREET_TILES)
      this.streetTiles.delete(this.streetTiles.keys().next().value as string);
    const settle = (tile: StreetSourceTile) => {
      // Cleared, or evicted while it loaded: nobody is waiting for it.
      if (!signal.aborted && this.streetTiles.get(key) === 'loading')
        this.streetTiles.set(key, tile);
    };
    source.load(address, signal).then(
      (tile) =>
        settle(
          // No tile, or one without roads (a detail archive of buildings alone): not the source's.
          tile !== undefined && tile.transportation.length > 0
            ? {
                level: address.level,
                origin,
                tileSize,
                roads: tile.transportation.filter(isStreet),
              }
            : null,
        ),
      () => settle(null),
    );
  }

  /**
   * The rendered tiles within `reach` of (x, z), at the finest level among those holding it: a
   * coarser tile's lines are generalized, and while the stream refines, a place can lie under both.
   */
  private renderedTiles(x: number, z: number, reach: number): StreetTile[] {
    let finest = -1;
    for (const tile of this.tiles.values())
      if (tile.level > finest && outsideTile(tile, x, z) === 0) finest = tile.level;
    const found: StreetTile[] = [];
    for (const tile of this.tiles.values())
      if (tile.level === finest && outsideTile(tile, x, z) <= reach) found.push(tile);
    return found;
  }

  clear(): void {
    this.useStreets(undefined);
    this.tiles.clear();
    this.labels.clear();
    this.pyramid = undefined;
  }
}

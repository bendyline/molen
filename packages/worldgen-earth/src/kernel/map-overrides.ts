/**
 * Map overrides: a host's replacement for part of the mapped world. An override names a
 * rectangle, what to clear from it (mapped buildings, landmarks, plants, street furniture,
 * parking, optionally roads) and what stands there instead: buildings generated from an outline,
 * placed models and props. This module is the declaration, its validation and the registry a
 * view keeps them in; map-override-tile.ts applies them to a semantic tile.
 *
 * An override is geographic and data only. Everything inside it is laid out in the override's own
 * frame: meters from the area's center, +x east and +z south, turned by the area's heading. All
 * headings are compass sense, radians clockwise seen from above.
 */

import { dmath, hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import type { Vec2 } from '@bendyline/molen-worldgen/kernel';
import { validGroundOutline } from './ground-cutout';
import { MAP_OVERRIDE_PROP_CLASS, mapOverrideFeatureId } from './map-override-tags';
import { MERCATOR_MAX_LATITUDE, projectWgs84, unprojectMercator } from './projection';
import type { TileGeometry } from './semantic-adapter';
import { PROTOMAPS_TILE_BUFFER } from './tile-edges';

/** A point in an override's frame: meters from the area's center, +x east and +z south at heading 0. */
export type MapOverridePoint = [x: number, z: number];

/** The rectangle an override replaces. */
export type MapOverrideArea =
  | {
      /** `[longitude, latitude]` of the rectangle's center, the origin of the override's frame. */
      center: [longitude: number, latitude: number];
      /** `[width, depth]` in meters along the frame's x and z; each 1 to 2000. */
      size: [width: number, depth: number];
      /** Compass heading the frame's -z side faces, radians (default 0, north). */
      heading?: number;
    }
  | {
      /** WGS84 `[west, south, east, north]`, at most 2000 m a side; the frame is north up. */
      bounds: [west: number, south: number, east: number, north: number];
    };

/** What an override removes from its rectangle. */
export interface MapOverrideClear {
  /**
   * Mapped building footprints (default true): one at least half inside the rectangle goes whole,
   * and one cut by a tile's edge or merged with its neighbors on a coarse tile is trimmed at the
   * rectangle. `'clip'` trims every footprint at the rectangle instead.
   */
  buildings?: boolean | 'clip';
  /** Catalogued landmark models anchored in the rectangle (default true). */
  landmarks?: boolean;
  /** Land cover, scattered plants and mapped trees (default true). */
  vegetation?: boolean;
  /** Mapped street furniture: lamps, benches, bicycle racks, chargers (default true). */
  props?: boolean;
  /** Parking lots, their aisles and driveways, and the cars parked on them (default true). */
  parking?: boolean;
  /**
   * Roads and paths whose center line is in the rectangle (default false). Bridges, tunnels,
   * graded approaches, railways and runways are never cut, and the ground keeps the grading the
   * removed road gave it.
   */
  roads?: boolean;
}

/** The ground of a cleared rectangle. */
export type MapOverrideSurface =
  | 'ground'
  | 'grass'
  | 'paved'
  | 'plaza'
  | 'gravel'
  | 'bare'
  | 'sand';

/** A building generated where the override stands, by the same generator as the mapped city. */
export interface MapOverrideBuilding {
  /** Unique among the override's buildings. */
  id: string;
  /** Footprint ring in the override's frame: 3 to 256 points, not self-crossing. Give this or `rect`. */
  outline?: MapOverridePoint[];
  /** A rectangular footprint instead of `outline`. */
  rect?: {
    /** Its center (default the area's). */
    center?: MapOverridePoint;
    /** `[width, depth]` in meters, each 1 to 1000. */
    size: [width: number, depth: number];
    /** Compass heading added to the area's, radians (default 0). */
    heading?: number;
  };
  /** Meters above its base, up to 1000. */
  height?: number;
  /** Floors, 1 to 200 (default 1 when there is no height). */
  levels?: number;
  /** Meters its base stands above the ground (default 0). */
  minHeight?: number;
  /** What it is, as map data names buildings (`warehouse`, `school`, `house`): picks a default look. */
  use?: string;
  /** An architecture style id of the style pack; ignored when the pack has none by that id. */
  style?: string;
  /** Wall color, `#rrggbb`. */
  wall?: string;
  /** Trim color, `#rrggbb`. */
  trim?: string;
  name?: string;
}

/** A model placed whole where the override stands: a landmark of the content packs, or the host's own. */
export interface MapOverrideModel {
  /** Unique among the override's models. */
  id: string;
  /** A structure asset id of the style pack, or any ref the view's override assets load. */
  asset: string;
  /** Where the model's origin stands, in the override's frame. */
  position: MapOverridePoint;
  /** Compass heading added to the area's, radians (default 0: the model's +Z front faces the frame's +z). */
  heading?: number;
  /** One factor or `[x, y, z]`, each 0.01 to 100 (default 1). */
  scale?: number | [x: number, y: number, z: number];
  /** Meters above the ground at `position` (default 0). */
  elevation?: number;
  /** Coarsest tile level it is drawn at (default the override's, and 13 for the host's own models). */
  minLevel?: number;
}

/** A small object drawn many at a time with the tile: street furniture, a tree, or a named model. */
export type MapOverrideProp = {
  /** Unique among the override's props. */
  id: string;
  position: MapOverridePoint;
  /** Compass heading added to the area's, radians (default 0). */
  heading?: number;
} & (
  | {
      kind: 'tree';
      /** Meters. */
      height?: number;
      /** Meters. */
      crownDiameter?: number;
      leafType?: 'broadleaved' | 'needleleaved';
      species?: string;
    }
  | {
      kind: 'street_lamp';
      /** Meters. */
      height?: number;
    }
  | { kind: 'bench' | 'bike_rack' | 'charger' }
  | {
      /** A prop model ref: a `builtin:` model, a regional plant, or any ref the view's assets load. */
      model: string;
      /** One factor or `[x, y, z]`, each 0.01 to 100 (default 1). */
      scale?: number | [x: number, y: number, z: number];
      /** A tint, `#rrggbb`. */
      color?: string;
    }
);

/** A host's replacement for one rectangle of the mapped world. */
export interface MapOverride {
  /** Stable id, lowercase: letters, digits, `.`, `_` and `-`; names the features it generates. */
  id: string;
  area: MapOverrideArea;
  /** What is removed from the rectangle (see each flag's default). */
  clear?: MapOverrideClear;
  /** The ground of the cleared rectangle (default `'ground'`); unused when vegetation is kept. */
  surface?: MapOverrideSurface;
  /** At most 64. */
  buildings?: readonly MapOverrideBuilding[];
  /** At most 16. */
  models?: readonly MapOverrideModel[];
  /** At most 256. */
  props?: readonly MapOverrideProp[];
  /** Coarsest tile level the map is edited at, 0 to 26 (default 11); landmarks hide at every level. */
  minLevel?: number;
}

/** Limits a map override is validated against. */
export const MAP_OVERRIDE_LIMITS: {
  readonly areaSide: readonly [number, number];
  readonly buildings: number;
  readonly models: number;
  readonly props: number;
  readonly outlinePoints: number;
  readonly buildingSide: number;
} = {
  areaSide: [1, 2000],
  buildings: 64,
  models: 16,
  props: 256,
  outlinePoints: 256,
  buildingSide: 1000,
};

/** Coarsest tile level an override edits by default, as landmarks appear. */
export const MAP_OVERRIDE_MIN_LEVEL = 11;
/** Coarsest tile level a host's own model is drawn at by default: it has one detail level. */
export const MAP_OVERRIDE_HOST_MODEL_MIN_LEVEL = 13;

const SURFACE_COVER: Readonly<Record<MapOverrideSurface, string>> = {
  ground: 'open_ground',
  grass: 'grass',
  paved: 'pavement',
  plaza: 'pedestrian',
  gravel: 'gravel',
  bare: 'barren',
  sand: 'sand',
};

const PROP_CLASS: Readonly<Record<string, string>> = {
  tree: 'tree',
  street_lamp: 'street_lamp',
  bench: 'bench',
  bike_rack: 'bicycle_parking',
  charger: 'charging_station',
};

type Box = [minX: number, minZ: number, maxX: number, maxZ: number];

/** A host building as the tile edit injects it. Coordinates are Web Mercator meters. */
export interface ResolvedMapOverrideBuilding {
  readonly featureId: string;
  /** Footprint ring, open, with positive shoelace area in (x, z). */
  readonly ring: readonly Vec2[];
  readonly bounds: Readonly<Box>;
  readonly height?: number;
  readonly levels?: number;
  readonly minHeight?: number;
  readonly use?: string;
  readonly style?: string;
  readonly wall?: string;
  readonly trim?: string;
  readonly name?: string;
}

/** A host prop as the tile edit injects it. */
export interface ResolvedMapOverrideProp {
  readonly featureId: string;
  /** Web Mercator meters. */
  readonly point: Vec2;
  /** Rotation about +Y, radians: the model's +Z front as placed. */
  readonly rotation: number;
  /** The POI class it travels as. */
  readonly poiClass: string;
  readonly height?: number;
  readonly crownDiameter?: number;
  readonly leafType?: string;
  readonly species?: string;
  /** With `poiClass` the override prop class: the model ref, scale `"sx,sy,sz"` and tint. */
  readonly model?: string;
  readonly scale?: string;
  readonly color?: string;
}

/** A host model as the structure index offers it. */
export interface ResolvedMapOverrideModel {
  /** Placement id, `override.<override id>.<model id>`. */
  readonly id: string;
  readonly localId: string;
  readonly asset: string;
  readonly anchor: readonly [longitude: number, latitude: number];
  /** Rotation about +Y, radians, as `StructurePlacement.heading`. */
  readonly rotation: number;
  readonly scale?: readonly [number, number, number];
  readonly elevation: number;
  /** Set by the declaration; the index applies the defaults, which depend on where the asset comes from. */
  readonly minLevel?: number;
}

/** An override validated and laid out on the map. Planar coordinates are Web Mercator meters. */
export interface ResolvedMapOverride {
  readonly id: string;
  /** Content hash of the fields the map edit reads; equal hashes edit a tile identically. */
  readonly hash: string;
  readonly minLevel: number;
  readonly clear: {
    readonly buildings: boolean | 'clip';
    readonly landmarks: boolean;
    readonly vegetation: boolean;
    readonly props: boolean;
    readonly parking: boolean;
    readonly roads: boolean;
  };
  /** Land cover subclass of the cleared ground. */
  readonly cover: string;
  /** The frame's origin, `[longitude, latitude]`, and compass heading, radians. */
  readonly center: readonly [longitude: number, latitude: number];
  readonly heading: number;
  /** The origin in Web Mercator meters, and the frame's axes there: mercator = origin + axis * meters. */
  readonly origin: Vec2;
  readonly axisX: Vec2;
  readonly axisZ: Vec2;
  /** Half the rectangle's width and depth, meters in the frame. */
  readonly half: Vec2;
  /** The rectangle's four corners. */
  readonly ring: readonly Vec2[];
  /** Bounds of the rectangle alone. */
  readonly areaBounds: Readonly<Box>;
  /** Bounds of everything the override clears or draws. */
  readonly bounds: Readonly<Box>;
  /** The same as WGS84 `[west, south, east, north]`. */
  readonly geoBounds: readonly [number, number, number, number];
  readonly buildings: readonly ResolvedMapOverrideBuilding[];
  readonly props: readonly ResolvedMapOverrideProp[];
  readonly models: readonly ResolvedMapOverrideModel[];
}

/** Where an override's frame sits: its origin and compass heading. */
export interface MapOverrideFrame {
  center: [longitude: number, latitude: number];
  /** Radians. */
  heading: number;
}

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const STYLE = /^[a-z][a-z0-9_.-]*$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$/;

interface Frame {
  center: [number, number];
  heading: number;
  origin: Vec2;
  axisX: Vec2;
  axisZ: Vec2;
  half: Vec2;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
}

function geographic(point: unknown): point is [number, number] {
  return (
    isPair(point) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    dmath.abs(point[1]) <= MERCATOR_MAX_LATITUDE
  );
}

/** The frame of an area, or a message saying what is wrong with it. */
function frameOf(area: MapOverrideArea): Frame | string {
  if (area === null || typeof area !== 'object') return 'area must be an object';
  const [minSide, maxSide] = MAP_OVERRIDE_LIMITS.areaSide;
  if ('bounds' in area) {
    const b = area.bounds;
    if (
      !Array.isArray(b) ||
      b.length !== 4 ||
      !geographic([b[0], b[1]]) ||
      !geographic([b[2], b[3]])
    )
      return 'area.bounds must be WGS84 [west, south, east, north]';
    if (!(b[0] < b[2] && b[1] < b[3]))
      return 'area.bounds must be ordered west < east, south < north';
    const [x0, z1] = projectWgs84(b[0], b[1]);
    const [x1, z0] = projectWgs84(b[2], b[3]);
    const origin: Vec2 = [(x0 + x1) / 2, (z0 + z1) / 2];
    const center = unprojectMercator(origin[0], origin[1]);
    const k = 1 / dmath.cos((center[1] * dmath.PI) / 180);
    const half: Vec2 = [(x1 - x0) / 2 / k, (z1 - z0) / 2 / k];
    if (
      half[0] * 2 < minSide ||
      half[1] * 2 < minSide ||
      half[0] * 2 > maxSide ||
      half[1] * 2 > maxSide
    )
      return `area must be ${minSide} to ${maxSide} m a side`;
    return {
      center: [center[0], center[1]],
      heading: 0,
      origin,
      axisX: [k, 0],
      axisZ: [0, k],
      half,
    };
  }
  if (!geographic(area.center)) return 'area.center must be [longitude, latitude]';
  if (!isPair(area.size) || area.size.some((side) => side < minSide || side > maxSide))
    return `area.size must be [width, depth], each ${minSide} to ${maxSide} m`;
  if (area.heading !== undefined && !finite(area.heading)) return 'area.heading must be a number';
  const heading = area.heading ?? 0;
  const k = 1 / dmath.cos((area.center[1] * dmath.PI) / 180);
  const c = dmath.cos(heading) * k;
  const s = dmath.sin(heading) * k;
  return {
    center: [area.center[0], area.center[1]],
    heading,
    origin: projectWgs84(area.center[0], area.center[1]),
    // Clockwise seen from above with +z south: the frame's -z side turns from north toward east.
    axisX: [c, s],
    axisZ: [-s, c],
    half: [area.size[0] / 2, area.size[1] / 2],
  };
}

function place(frame: Frame, [x, z]: readonly [number, number]): Vec2 {
  return [
    frame.origin[0] + frame.axisX[0] * x + frame.axisZ[0] * z,
    frame.origin[1] + frame.axisX[1] * x + frame.axisZ[1] * z,
  ];
}

/** The frame an area lays its contents out in. Throws for an invalid area. */
export function mapOverrideFrame(area: MapOverrideArea): MapOverrideFrame {
  const frame = frameOf(area);
  if (typeof frame === 'string') throw new Error(`map override: ${frame}`);
  return { center: frame.center, heading: frame.heading };
}

/**
 * A point of an override's frame as `[longitude, latitude]`: the one conversion its buildings,
 * props, models and whatever a host stands beside them (people, vehicles) all go through, so
 * they line up. Meters are true at the frame's origin.
 */
export function mapOverridePoint(
  frame: MapOverrideFrame,
  local: readonly [number, number],
): [longitude: number, latitude: number] {
  const resolved = frameOf({ center: frame.center, size: [1, 1], heading: frame.heading });
  if (typeof resolved === 'string') throw new Error(`map override: ${resolved}`);
  const [x, z] = place(resolved, local);
  const [longitude, latitude] = unprojectMercator(x, z);
  return [longitude, latitude];
}

function boundsOf(points: readonly Vec2[]): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, z] of points) {
    if (x < box[0]) box[0] = x;
    if (z < box[1]) box[1] = z;
    if (x > box[2]) box[2] = x;
    if (z > box[3]) box[3] = z;
  }
  return box;
}

function grow(box: Box, other: Readonly<Box>): void {
  if (other[0] < box[0]) box[0] = other[0];
  if (other[1] < box[1]) box[1] = other[1];
  if (other[2] > box[2]) box[2] = other[2];
  if (other[3] > box[3]) box[3] = other[3];
}

function scaleOf(value: unknown): [number, number, number] | undefined | string {
  if (value === undefined) return undefined;
  const scale = typeof value === 'number' ? [value, value, value] : value;
  if (
    !Array.isArray(scale) ||
    scale.length !== 3 ||
    scale.some((factor) => !finite(factor) || factor < 0.01 || factor > 100)
  )
    return 'scale must be a factor or [x, y, z], each 0.01 to 100';
  return [scale[0], scale[1], scale[2]];
}

/** `value` without undefined members, as JSON hashes it. */
function plain(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, JsonValue> = {};
    for (const [key, member] of Object.entries(value))
      if (member !== undefined) copy[key] = plain(member);
    return copy;
  }
  return value as JsonValue;
}

/**
 * Validate an override and lay it out on the map. Throws an `Error` naming the override and what
 * is wrong; fields this module does not know (a host's own bundles) are ignored.
 */
export function resolveMapOverride(override: MapOverride): ResolvedMapOverride {
  if (override === null || typeof override !== 'object')
    throw new Error('map override must be an object');
  // Typed on the binding: only then does a call to it end the control flow for narrowing.
  const fail: (message: string) => never = (message) => {
    throw new Error(`map override "${String(override.id)}": ${message}`);
  };
  if (typeof override.id !== 'string' || !ID.test(override.id))
    fail('id must be lowercase letters, digits, ".", "_" or "-" (at most 64)');
  const frame = frameOf(override.area);
  if (typeof frame === 'string') return fail(frame);
  const clear = override.clear ?? {};
  for (const [flag, value] of Object.entries(clear))
    if (
      !['buildings', 'landmarks', 'vegetation', 'props', 'parking', 'roads'].includes(flag) ||
      !(typeof value === 'boolean' || (flag === 'buildings' && value === 'clip'))
    )
      fail(`clear.${flag} is not a flag this override understands`);
  const surface = override.surface ?? 'ground';
  if (!Object.hasOwn(SURFACE_COVER, surface)) fail(`unknown surface "${String(surface)}"`);
  const minLevel = override.minLevel ?? MAP_OVERRIDE_MIN_LEVEL;
  if (!Number.isInteger(minLevel) || minLevel < 0 || minLevel > 26)
    fail('minLevel must be an integer from 0 to 26');
  const { half } = frame;
  const ring = (
    [
      [-half[0], -half[1]],
      [half[0], -half[1]],
      [half[0], half[1]],
      [-half[0], half[1]],
    ] as const
  ).map((corner) => place(frame, corner));
  const areaBounds = boundsOf(ring);
  const bounds: Box = [...areaBounds];

  const unique = (kind: string, items: readonly { id: string }[], limit: number): void => {
    if (!Array.isArray(items)) fail(`${kind} must be an array`);
    if (items.length > limit) fail(`at most ${limit} ${kind}`);
    const ids = new Set<string>();
    for (const item of items) {
      if (
        item === null ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        !ID.test(item.id)
      )
        fail(`every one of its ${kind} needs an id of lowercase letters, digits, ".", "_" or "-"`);
      if (ids.has(item.id)) fail(`duplicate id "${item.id}" among its ${kind}`);
      ids.add(item.id);
    }
  };
  const color = (value: unknown, what: string): void => {
    if (value !== undefined && (typeof value !== 'string' || !COLOR.test(value)))
      fail(`${what} must be a #rrggbb color`);
  };
  const heading = (value: unknown, what: string): number => {
    if (value !== undefined && !finite(value)) fail(`${what} heading must be a number`);
    return (value as number | undefined) ?? 0;
  };
  const position = (value: unknown, what: string): [number, number] => {
    if (!isPair(value)) fail(`${what} needs a position [x, z] in meters`);
    return value as [number, number];
  };

  const sourceBuildings = override.buildings ?? [];
  unique('buildings', sourceBuildings, MAP_OVERRIDE_LIMITS.buildings);
  const buildings = sourceBuildings.map((building): ResolvedMapOverrideBuilding => {
    const what = `building "${building.id}"`;
    if ((building.outline === undefined) === (building.rect === undefined))
      fail(`${what} needs an outline or a rect, not both`);
    let local: [number, number][];
    if (building.rect !== undefined) {
      const rect = building.rect;
      const side = MAP_OVERRIDE_LIMITS.buildingSide;
      if (!isPair(rect.size) || rect.size.some((length) => length < 1 || length > side))
        fail(`${what} rect.size must be [width, depth], each 1 to ${side} m`);
      const at = rect.center === undefined ? [0, 0] : position(rect.center, `${what} rect.center:`);
      const turn = heading(rect.heading, `${what} rect`);
      const c = dmath.cos(turn);
      const s = dmath.sin(turn);
      const [w, d] = [rect.size[0] / 2, rect.size[1] / 2];
      local = (
        [
          [-w, -d],
          [w, -d],
          [w, d],
          [-w, d],
        ] as const
      ).map(([x, z]): [number, number] => [
        (at[0] as number) + x * c - z * s,
        (at[1] as number) + x * s + z * c,
      ]);
    } else {
      const outline = building.outline as MapOverridePoint[];
      if (
        !Array.isArray(outline) ||
        outline.length < 3 ||
        outline.length > MAP_OVERRIDE_LIMITS.outlinePoints ||
        !outline.every(isPair) ||
        !validGroundOutline(outline)
      )
        fail(
          `${what} outline must be 3 to ${MAP_OVERRIDE_LIMITS.outlinePoints} points [x, z] that do not cross`,
        );
      local = outline.map(([x, z]): [number, number] => [x, z]);
      const first = local[0] as [number, number];
      const last = local.at(-1) as [number, number];
      if (local.length > 3 && first[0] === last[0] && first[1] === last[1]) local.pop();
      const extent = boundsOf(local);
      if (
        extent[2] - extent[0] > MAP_OVERRIDE_LIMITS.buildingSide ||
        extent[3] - extent[1] > MAP_OVERRIDE_LIMITS.buildingSide
      )
        fail(`${what} is more than ${MAP_OVERRIDE_LIMITS.buildingSide} m across`);
    }
    if (
      building.height !== undefined &&
      !(finite(building.height) && building.height > 0 && building.height <= 1000)
    )
      fail(`${what} height must be above 0, at most 1000 m`);
    if (
      building.levels !== undefined &&
      !(Number.isInteger(building.levels) && building.levels >= 1 && building.levels <= 200)
    )
      fail(`${what} levels must be an integer from 1 to 200`);
    if (
      building.minHeight !== undefined &&
      !(finite(building.minHeight) && building.minHeight >= 0 && building.minHeight <= 500)
    )
      fail(`${what} minHeight must be 0 to 500 m`);
    if (
      building.height !== undefined &&
      building.minHeight !== undefined &&
      building.height <= building.minHeight
    )
      fail(`${what} height must be above its minHeight`);
    for (const [field, max] of [
      ['use', 64],
      ['name', 120],
    ] as const) {
      const value = building[field];
      if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > max))
        fail(`${what} ${field} must be a non-empty string of at most ${max} characters`);
    }
    if (
      building.style !== undefined &&
      (typeof building.style !== 'string' || !STYLE.test(building.style))
    )
      fail(`${what} style must be an architecture style id`);
    color(building.wall, `${what} wall`);
    color(building.trim, `${what} trim`);
    let placed = local.map((point) => place(frame, point));
    let area = 0;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i] as Vec2;
      const b = placed[(i + 1) % placed.length] as Vec2;
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (area < 0) placed = placed.reverse();
    const footprint = boundsOf(placed);
    grow(bounds, footprint);
    return {
      featureId: mapOverrideFeatureId(override.id, building.id),
      ring: placed,
      bounds: footprint,
      ...(building.height !== undefined ? { height: building.height } : {}),
      // A footprint with neither would have its floors guessed from its neighbors.
      ...(building.levels !== undefined
        ? { levels: building.levels }
        : building.height === undefined
          ? { levels: 1 }
          : {}),
      ...(building.minHeight !== undefined ? { minHeight: building.minHeight } : {}),
      ...(building.use !== undefined ? { use: building.use.trim().toLowerCase() } : {}),
      ...(building.style !== undefined ? { style: building.style } : {}),
      ...(building.wall !== undefined ? { wall: building.wall.toLowerCase() } : {}),
      ...(building.trim !== undefined ? { trim: building.trim.toLowerCase() } : {}),
      ...(building.name !== undefined ? { name: building.name.trim() } : {}),
    };
  });

  const sourceProps = override.props ?? [];
  unique('props', sourceProps, MAP_OVERRIDE_LIMITS.props);
  const props = sourceProps.map((prop): ResolvedMapOverrideProp => {
    const what = `prop "${prop.id}"`;
    const point = place(frame, position(prop.position, what));
    grow(bounds, [point[0], point[1], point[0], point[1]]);
    // Never -0: it reads as a different value to equality checks and to JSON.
    const rotation = -(frame.heading + heading(prop.heading, what)) || 0;
    const base = { featureId: mapOverrideFeatureId(override.id, prop.id), point, rotation };
    if ('model' in prop) {
      if (
        typeof prop.model !== 'string' ||
        !REF.test(prop.model) ||
        prop.model.startsWith('builtin:box')
      )
        fail(`${what} model must be a prop model ref (not a building stand-in)`);
      const scale = scaleOf(prop.scale);
      if (typeof scale === 'string') fail(`${what} ${scale}`);
      color(prop.color, `${what} color`);
      return {
        ...base,
        poiClass: MAP_OVERRIDE_PROP_CLASS,
        model: prop.model,
        ...(scale !== undefined ? { scale: (scale as number[]).join(',') } : {}),
        ...(prop.color !== undefined ? { color: prop.color.toLowerCase() } : {}),
      };
    }
    const poiClass = PROP_CLASS[prop.kind as string];
    if (poiClass === undefined || !Object.hasOwn(PROP_CLASS, prop.kind))
      fail(`${what} kind must be tree, street_lamp, bench, bike_rack or charger, or give a model`);
    const measure = (value: unknown, name: string, max: number): number | undefined => {
      if (value !== undefined && !(finite(value) && value > 0 && value <= max))
        fail(`${what} ${name} must be above 0, at most ${max} m`);
      return value as number | undefined;
    };
    const sized = prop as {
      height?: number;
      crownDiameter?: number;
      leafType?: string;
      species?: string;
    };
    const height = measure(sized.height, 'height', 80);
    const crownDiameter = measure(sized.crownDiameter, 'crownDiameter', 40);
    if (sized.leafType !== undefined && !['broadleaved', 'needleleaved'].includes(sized.leafType))
      fail(`${what} leafType must be broadleaved or needleleaved`);
    if (sized.species !== undefined && (typeof sized.species !== 'string' || !sized.species.trim()))
      fail(`${what} species must be a non-empty string`);
    return {
      ...base,
      poiClass: poiClass as string,
      ...(height !== undefined ? { height } : {}),
      ...(prop.kind === 'tree' && crownDiameter !== undefined ? { crownDiameter } : {}),
      ...(prop.kind === 'tree' && sized.leafType !== undefined ? { leafType: sized.leafType } : {}),
      ...(prop.kind === 'tree' && sized.species !== undefined
        ? { species: sized.species.trim() }
        : {}),
    };
  });

  const sourceModels = override.models ?? [];
  unique('models', sourceModels, MAP_OVERRIDE_LIMITS.models);
  const models = sourceModels.map((model): ResolvedMapOverrideModel => {
    const what = `model "${model.id}"`;
    if (typeof model.asset !== 'string' || !REF.test(model.asset))
      fail(`${what} needs an asset ref`);
    const point = place(frame, position(model.position, what));
    grow(bounds, [point[0], point[1], point[0], point[1]]);
    const scale = scaleOf(model.scale);
    if (typeof scale === 'string') fail(`${what} ${scale}`);
    if (
      model.elevation !== undefined &&
      !(finite(model.elevation) && model.elevation >= -100 && model.elevation <= 1000)
    )
      fail(`${what} elevation must be -100 to 1000 m`);
    if (
      model.minLevel !== undefined &&
      !(Number.isInteger(model.minLevel) && model.minLevel >= 0 && model.minLevel <= 26)
    )
      fail(`${what} minLevel must be an integer from 0 to 26`);
    const [longitude, latitude] = unprojectMercator(point[0], point[1]);
    return {
      id: `override.${override.id}.${model.id}`,
      localId: model.id,
      asset: model.asset,
      anchor: [longitude, latitude],
      rotation: -(frame.heading + heading(model.heading, what)) || 0,
      ...(scale !== undefined ? { scale: scale as [number, number, number] } : {}),
      elevation: model.elevation ?? 0,
      ...(model.minLevel !== undefined ? { minLevel: model.minLevel } : {}),
    };
  });

  const [west, north] = unprojectMercator(bounds[0], bounds[1]);
  const [east, south] = unprojectMercator(bounds[2], bounds[3]);
  const resolvedClear = {
    buildings: clear.buildings ?? true,
    landmarks: clear.landmarks ?? true,
    vegetation: clear.vegetation ?? true,
    props: clear.props ?? true,
    parking: clear.parking ?? true,
    roads: clear.roads ?? false,
  };
  return {
    id: override.id,
    hash: hashJson(
      plain({
        area: override.area,
        clear: resolvedClear,
        surface,
        minLevel,
        buildings: sourceBuildings,
        models: sourceModels,
        props: sourceProps,
      }),
    ),
    minLevel,
    clear: resolvedClear,
    cover: SURFACE_COVER[surface],
    center: frame.center,
    heading: frame.heading,
    origin: frame.origin,
    axisX: frame.axisX,
    axisZ: frame.axisZ,
    half: frame.half,
    ring,
    areaBounds,
    bounds,
    geoBounds: [west, south, east, north],
    buildings,
    props,
    models,
  };
}

/** Whether a Web Mercator point is in an override's rectangle, grown by `margin` meters. */
export function mapOverrideContains(
  override: ResolvedMapOverride,
  x: number,
  z: number,
  margin = 0,
): boolean {
  const dx = x - override.origin[0];
  const dz = z - override.origin[1];
  // The axes are orthogonal with one length (mercator meters per frame meter).
  const k2 = override.axisX[0] * override.axisX[0] + override.axisX[1] * override.axisX[1];
  const u = (dx * override.axisX[0] + dz * override.axisX[1]) / k2;
  const v = (dx * override.axisZ[0] + dz * override.axisZ[1]) / k2;
  return dmath.abs(u) <= override.half[0] + margin && dmath.abs(v) <= override.half[1] + margin;
}

/** What changed in a {@link MapOverrideSet}. */
export interface MapOverrideChange {
  /** The set's revision after the change. */
  revision: number;
  /** Overrides added, replaced or removed. */
  ids: readonly string[];
  /**
   * WGS84 `[west, south, east, north]` of everything those overrides clear or draw, as they were
   * and as they are: the ground to build again.
   */
  bounds: readonly (readonly [number, number, number, number])[];
  /** The map itself changed; false when only fields this module ignores did (a host's bundles). */
  tiles: boolean;
}

/**
 * The overrides of one view. It keeps what it is given by reference (a host's own fields on an
 * override, functions included, survive), so treat an override as immutable once set and `set` a
 * new object to change it.
 */
export interface MapOverrideSet<T extends MapOverride = MapOverride> {
  /** Bumped by every change. */
  readonly revision: number;
  list(): readonly T[];
  get(id: string): T | undefined;
  /** Add an override, or replace the one with its id. Throws, changing nothing, when it is invalid. */
  set(override: T): void;
  /** Remove one; false when there was none by that id. */
  delete(id: string): boolean;
  /** Make the set exactly these, as one change. Throws, changing nothing, when any is invalid. */
  replace(overrides: readonly T[]): void;
  /** Called after each change, in the same task. Returns the call that stops it. */
  subscribe(listener: (change: MapOverrideChange) => void): () => void;
  /** An override as laid out on the map. */
  resolved(id: string): ResolvedMapOverride | undefined;
  /**
   * The overrides that edit a tile: at or above their `minLevel`, reaching its square grown by
   * `buffer` of its size (default the map tiles' own clip buffer). Ordered by id.
   */
  forTile(geom: TileGeometry, buffer?: number): readonly ResolvedMapOverride[];
  /** The overrides reaching a WGS84 `[west, south, east, north]` rectangle. Ordered by id. */
  query(bounds: readonly [number, number, number, number]): readonly ResolvedMapOverride[];
}

/** An empty set of map overrides, or one holding `initial`. Throws when any of those is invalid. */
export function createMapOverrideSet<T extends MapOverride = MapOverride>(
  initial: readonly T[] = [],
): MapOverrideSet<T> {
  let entries = new Map<string, { override: T; resolved: ResolvedMapOverride }>();
  const listeners = new Set<(change: MapOverrideChange) => void>();
  let revision = 0;
  let ordered: ResolvedMapOverride[] | undefined;
  const resolveAll = (
    overrides: readonly T[],
  ): Map<string, { override: T; resolved: ResolvedMapOverride }> => {
    const next = new Map<string, { override: T; resolved: ResolvedMapOverride }>();
    for (const override of overrides) {
      const resolved = resolveMapOverride(override);
      if (next.has(resolved.id)) throw new Error(`duplicate map override "${resolved.id}"`);
      next.set(resolved.id, { override, resolved });
    }
    return next;
  };
  const sorted = (): ResolvedMapOverride[] => {
    ordered ??= [...entries.values()]
      .map((entry) => entry.resolved)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return ordered;
  };
  const reaching = (box: Readonly<Box>): ResolvedMapOverride[] =>
    sorted().filter(
      (item) =>
        item.bounds[0] <= box[2] &&
        item.bounds[2] >= box[0] &&
        item.bounds[1] <= box[3] &&
        item.bounds[3] >= box[1],
    );
  const publish = (
    changes: ReadonlyArray<{
      id: string;
      before?: ResolvedMapOverride;
      after?: ResolvedMapOverride;
    }>,
  ): void => {
    if (changes.length === 0) return;
    revision++;
    ordered = undefined;
    const change: MapOverrideChange = {
      revision,
      ids: changes.map((item) => item.id),
      bounds: changes.flatMap(({ before, after }) => [
        ...(before !== undefined ? [before.geoBounds] : []),
        ...(after !== undefined && after.hash !== before?.hash ? [after.geoBounds] : []),
      ]),
      tiles: changes.some(({ before, after }) => before?.hash !== after?.hash),
    };
    for (const listener of [...listeners]) listener(change);
  };
  entries = resolveAll(initial);
  return {
    get revision(): number {
      return revision;
    },
    list: () => [...entries.values()].map((entry) => entry.override),
    get: (id) => entries.get(id)?.override,
    resolved: (id) => entries.get(id)?.resolved,
    set(override) {
      const resolved = resolveMapOverride(override);
      const before = entries.get(resolved.id)?.resolved;
      entries.set(resolved.id, { override, resolved });
      publish([{ id: resolved.id, ...(before !== undefined ? { before } : {}), after: resolved }]);
    },
    delete(id) {
      const before = entries.get(id)?.resolved;
      if (before === undefined) return false;
      entries.delete(id);
      publish([{ id, before }]);
      return true;
    },
    replace(overrides) {
      const next = resolveAll(overrides);
      const changes: Array<{
        id: string;
        before?: ResolvedMapOverride;
        after?: ResolvedMapOverride;
      }> = [];
      for (const [id, { override, resolved }] of entries) {
        const after = next.get(id);
        if (after === undefined) changes.push({ id, before: resolved });
        else if (after.override !== override)
          changes.push({ id, before: resolved, after: after.resolved });
      }
      for (const [id, { resolved }] of next)
        if (!entries.has(id)) changes.push({ id, after: resolved });
      entries = next;
      publish(changes);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    forTile(geom, buffer = PROTOMAPS_TILE_BUFFER) {
      if (entries.size === 0) return [];
      const scale = 1 / geom.metersPerUnit;
      const margin = buffer * geom.size;
      return reaching([
        (geom.originX - margin) * scale,
        (geom.originZ - margin) * scale,
        (geom.originX + geom.size + margin) * scale,
        (geom.originZ + geom.size + margin) * scale,
      ]).filter((item) => geom.level >= item.minLevel);
    },
    query(bounds) {
      if (entries.size === 0) return [];
      const [x0, z1] = projectWgs84(bounds[0], bounds[1]);
      const [x1, z0] = projectWgs84(bounds[2], bounds[3]);
      // A rectangle across the antimeridian is two; overrides are far too small to straddle it.
      return x0 <= x1
        ? reaching([x0, z0, x1, z1])
        : [...new Set([...reaching([x0, z0, Infinity, z1]), ...reaching([-Infinity, z0, x1, z1])])];
    },
  };
}

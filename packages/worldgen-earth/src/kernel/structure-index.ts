/** Indexed, geographic placements for authored structure assets. Coordinates are WGS84. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import { type BuildingMetrics, matchesWhen } from '@bendyline/molen-worldgen/kernel';
import { validGroundOutline } from './ground-cutout';
import { projectWgs84 } from './projection';
import { createRegionResolver, regionStyleRules } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';
import {
  type HistoricalStructureAppearance,
  isHistoricalStructureAppearance,
  isStructureViewingDate,
} from './structure-date';

const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface StructurePlacement {
  id: string;
  title: string;
  asset: string;
  /** [longitude, latitude], at the intended model origin. */
  anchor: [number, number];
  /** Rotation about +Y in radians, from the model's authored +Z front. */
  heading?: number;
  /** Multiplicative model scale; omitted means authored meters. */
  scale?: [number, number, number];
  datum?: 'terrain' | 'sea-level';
  /** Vertical offset from datum, in world meters (lake surfaces need not be sea level). */
  elevation?: number;
  /** Ground at another known site point; modelHeight is that point's native model Y in metres. */
  terrainReference?: { anchor: [number, number]; modelHeight: number; basis: string };
  /** WGS84 extent [west, south, east, north]. Extended models are clipped per resident tile. */
  bounds?: [number, number, number, number];
  /** Suppress mapped bridge centerlines inside this model-local rectangle (meters). */
  replaceRoads?: {
    length: number;
    width: number;
    /** Optional exact native X/Z footprint; supersedes the rectangle for road suppression. */
    outline?: [number, number][];
    /** Uniform native deck Y, or separate native Y values at negative-X / positive-X ends. */
    deckHeight?: number;
    deckHeights?: [number, number];
    /** Also clip longitudinal grade approaches sharing a covered bridge endpoint. */
    includeConnectedApproaches?: boolean;
  };
  /** Only a contained, nongeneralized mapped footprint may be replaced. */
  replaceFootprint?: boolean;
  /** Ground opening in native model X/Z metres; active only while this structure is visible. */
  groundCutout?: { outline: [number, number][]; basis: string };
  /** Optional confirmed map identity used to refine orientation from a nearby feature. */
  mapIdentity?: { wikidata?: string; names?: string[]; maxDistance?: number };
  /** Fixed is the catalog heading; mapped follows a confirmed footprint or bridge axis. */
  orientation?: 'fixed' | 'mapped';
  /** Model horizontal axis aligned to the longest mapped edge (default +X). */
  lengthAxis?: 'x' | 'z';
  /** The model enters adaptive terrain at this level. */
  minLevel?: number;
  /** Draft records are never drawn; historical records require an explicit viewing date. */
  status: 'preview' | 'draft' | 'historical';
  appearance?: HistoricalStructureAppearance;
  source: string;
  note?: string;
}

/** A deliberately reusable model. Never inferred from a unique landmark's category. */
export interface StructureMapRule {
  id: string;
  title: string;
  asset: string;
  /** All supplied fields must match; values within each array are alternatives. */
  match: { classes?: string[]; subclasses?: string[]; tags?: Record<string, string[]> };
  /** Native model dimensions in meters, in +X,+Y,+Z order. Base must be Y=0. */
  dimensions: [number, number, number];
  orientation?: 'direction' | 'longest-edge' | 'north';
  lengthAxis?: 'x' | 'z';
  fit?: 'native' | 'footprint';
  /** Also replace a nongeneralized building containing a matching point feature. */
  replaceFootprint?: boolean;
  minLevel?: number;
  maxPerTile?: number;
  source: string;
}

export interface StructureCatalogDoc {
  format: 'molen/structure-placements@1';
  title: string;
  entries: StructurePlacement[];
  rules?: StructureMapRule[];
}

export interface StructureIndex {
  readonly entries: readonly StructurePlacement[];
  readonly cells: ReadonlyMap<string, readonly StructurePlacement[]>;
  readonly rules: readonly StructureMapRule[];
  /** Geographic rectangle [west, south, east, north]. */
  query(
    bounds: readonly [number, number, number, number],
    options?: boolean | StructureQueryOptions,
  ): StructurePlacement[];
}

export interface StructureQueryOptions {
  /** Inspection only: include every record regardless of status or date. */
  includeDraft?: boolean;
  /** Explicit ISO calendar date for historical models. Omitted means current-world previews. */
  viewingDate?: string;
}

/** Standard geohash, kept here so the Earth pack does not depend on Qualla. */
export function encodeStructureGeohash(longitude: number, latitude: number, length = 3): string {
  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > 12
  )
    throw new Error('invalid geohash coordinate or length');
  let west = -180,
    east = 180,
    south = -90,
    north = 90;
  let value = 0,
    bits = 0,
    hash = '';
  while (hash.length < length) {
    const longitudeBit = (hash.length * 5 + bits) % 2 === 0;
    const midpoint = longitudeBit ? (west + east) / 2 : (south + north) / 2;
    const high = (longitudeBit ? longitude : latitude) >= midpoint;
    value = (value << 1) | Number(high);
    if (longitudeBit) {
      if (high) west = midpoint;
      else east = midpoint;
    } else {
      if (high) south = midpoint;
      else north = midpoint;
    }
    bits++;
    if (bits === 5) {
      hash += alphabet[value] as string;
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

function candidateCells(bounds: readonly [number, number, number, number]): string[] | undefined {
  // A 3-character cell has 8 longitude and 7 latitude bits. Large horizon tiles use
  // the linear fallback; fine tiles only visit the handful of cells they cross.
  const lonStep = 360 / 256,
    latStep = 180 / 128;
  const minX = Math.floor((bounds[0] + 180) / lonStep);
  const maxX = Math.floor((bounds[2] + 180) / lonStep);
  const minY = Math.floor((bounds[1] + 90) / latStep);
  const maxY = Math.floor((bounds[3] + 90) / latStep);
  if ((maxX - minX + 1) * (maxY - minY + 1) > 256) return undefined;
  const cells = new Set<string>();
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      cells.add(
        encodeStructureGeohash(
          Math.max(-180, Math.min(180, -180 + (x + 0.5) * lonStep)),
          Math.max(-90, Math.min(90, -90 + (y + 0.5) * latStep)),
        ),
      );
  return [...cells];
}

type GeographicBox = [number, number, number, number];

function lookupBounds(entry: StructurePlacement): GeographicBox[] {
  if (entry.bounds) return [entry.bounds];
  const [longitude, latitude] = entry.anchor;
  if (entry.orientation !== 'mapped') return [[longitude, latitude, longitude, latitude]];
  // Include the identity search neighborhood so a reference coordinate in the next tile
  // does not prevent that feature's true owning tile from resolving it.
  const latRadius = (entry.mapIdentity?.maxDistance ?? 150) / 110000;
  const lonRadius = Math.min(
    180,
    latRadius / Math.max(1e-6, dmath.cos((latitude * dmath.PI) / 180)),
  );
  const south = Math.max(-90, latitude - latRadius),
    north = Math.min(90, latitude + latRadius);
  if (lonRadius === 180) return [[-180, south, 180, north]];
  const west = longitude - lonRadius,
    east = longitude + lonRadius;
  if (west < -180)
    return [
      [west + 360, south, 180, north],
      [-180, south, east, north],
    ];
  if (east > 180)
    return [
      [west, south, 180, north],
      [-180, south, east - 360, north],
    ];
  return [[west, south, east, north]];
}

export function createStructureIndex(doc: StructureCatalogDoc): StructureIndex {
  if (doc.format !== 'molen/structure-placements@1')
    throw new Error('invalid structure catalog format');
  const ids = new Set<string>();
  for (const rule of doc.rules ?? []) {
    if (ids.has(rule.id)) throw new Error(`duplicate structure map rule ${rule.id}`);
    ids.add(rule.id);
    if (
      !rule.asset ||
      !rule.source ||
      rule.dimensions.length !== 3 ||
      rule.dimensions.some((n) => !Number.isFinite(n) || n <= 0) ||
      ![
        ...(rule.match.classes ?? []),
        ...(rule.match.subclasses ?? []),
        ...Object.values(rule.match.tags ?? {}).flat(),
      ].length
    )
      throw new Error(`invalid structure map rule ${rule.id}`);
    if (
      rule.maxPerTile !== undefined &&
      (!Number.isInteger(rule.maxPerTile) || rule.maxPerTile < 1 || rule.maxPerTile > 64)
    )
      throw new Error(`invalid structure map rule budget ${rule.id}`);
  }
  const cells = new Map<string, StructurePlacement[]>();
  const boxes = new Map<string, GeographicBox[]>();
  const unbucketed: StructurePlacement[] = [];
  for (const entry of doc.entries) {
    if (ids.has(entry.id)) throw new Error(`duplicate structure placement ${entry.id}`);
    ids.add(entry.id);
    if (
      entry.groundCutout &&
      (!entry.groundCutout.basis?.trim() ||
        entry.groundCutout.outline.length < 3 ||
        entry.groundCutout.outline.length > 512 ||
        entry.groundCutout.outline.some(
          (p) => p.length !== 2 || p.some((v) => !Number.isFinite(v)),
        ) ||
        !validGroundOutline(entry.groundCutout.outline))
    )
      throw new Error(`invalid ground cutout ${entry.id}`);
    if (!entry.asset || !entry.source || !['preview', 'draft', 'historical'].includes(entry.status))
      throw new Error(`invalid structure placement ${entry.id}`);
    if (
      (entry.appearance !== undefined && !isHistoricalStructureAppearance(entry.appearance)) ||
      (entry.status === 'historical' && !entry.appearance) ||
      (entry.status === 'preview' && entry.appearance)
    )
      throw new Error(`invalid historical structure appearance ${entry.id}`);
    encodeStructureGeohash(...entry.anchor);
    if (entry.elevation !== undefined && !Number.isFinite(entry.elevation))
      throw new Error(`invalid structure elevation ${entry.id}`);
    if (entry.terrainReference) {
      const reference = entry.terrainReference;
      if (
        entry.datum === 'sea-level' ||
        !Number.isFinite(reference.modelHeight) ||
        !reference.basis?.trim()
      )
        throw new Error(`invalid structure terrain reference ${entry.id}`);
      encodeStructureGeohash(...reference.anchor);
    }
    if (
      entry.bounds &&
      (entry.bounds.some((v) => !Number.isFinite(v)) ||
        entry.bounds[0] < -180 ||
        entry.bounds[2] > 180 ||
        entry.bounds[1] < -90 ||
        entry.bounds[3] > 90 ||
        entry.bounds[0] >= entry.bounds[2] ||
        entry.bounds[1] >= entry.bounds[3] ||
        (entry.datum !== 'sea-level' && !entry.terrainReference))
    )
      throw new Error(`invalid structure extent or vertical reference ${entry.id}`);
    if (entry.replaceRoads && !entry.bounds)
      throw new Error(`road replacement requires an extent ${entry.id}`);
    if (entry.replaceRoads) {
      const road = entry.replaceRoads;
      if (
        road.outline &&
        (road.outline.length < 3 ||
          road.outline.length > 512 ||
          road.outline.some(
            (point) => point.length !== 2 || point.some((v) => !Number.isFinite(v)),
          ) ||
          !validGroundOutline(road.outline))
      )
        throw new Error(`invalid structure road outline ${entry.id}`);
      if (
        !Number.isFinite(road.length) ||
        road.length <= 0 ||
        !Number.isFinite(road.width) ||
        road.width <= 0 ||
        (road.includeConnectedApproaches !== undefined &&
          typeof road.includeConnectedApproaches !== 'boolean') ||
        (road.deckHeight !== undefined && !Number.isFinite(road.deckHeight)) ||
        (road.deckHeights !== undefined &&
          (road.deckHeight !== undefined ||
            road.deckHeights.length !== 2 ||
            road.deckHeights.some((height) => !Number.isFinite(height))))
      )
        throw new Error(`invalid structure road replacement ${entry.id}`);
    }
    const extent = lookupBounds(entry);
    boxes.set(entry.id, extent);
    const keys = new Set<string>();
    for (const box of extent) {
      const candidates = candidateCells(box);
      if (!candidates) {
        if (entry.bounds) throw new Error(`structure extent is too large: ${entry.id}`);
        unbucketed.push(entry);
      } else for (const key of candidates) keys.add(key);
    }
    for (const cell of keys) {
      const bucket = cells.get(cell) ?? [];
      bucket.push(entry);
      cells.set(cell, bucket);
    }
  }
  return {
    entries: doc.entries,
    cells,
    rules: doc.rules ?? [],
    query(bounds, options = false) {
      const { includeDraft = false, viewingDate } =
        typeof options === 'boolean' ? { includeDraft: options } : options;
      if (viewingDate !== undefined && !isStructureViewingDate(viewingDate))
        throw new Error('viewingDate must be a valid YYYY-MM-DD calendar date');
      const spans: Array<readonly [number, number, number, number]> =
        bounds[0] <= bounds[2]
          ? [bounds]
          : [
              [bounds[0], bounds[1], 180, bounds[3]],
              [-180, bounds[1], bounds[2], bounds[3]],
            ];
      const found = new Map<string, StructurePlacement>();
      for (const span of spans) {
        const keys = candidateCells(span);
        const candidates =
          keys === undefined
            ? doc.entries
            : [...unbucketed, ...keys.flatMap((key) => cells.get(key) ?? [])];
        for (const entry of candidates) {
          if (
            (includeDraft ||
              entry.status === 'preview' ||
              (entry.status === 'historical' &&
                viewingDate !== undefined &&
                entry.appearance !== undefined &&
                viewingDate >= entry.appearance.validFrom &&
                viewingDate < entry.appearance.validUntil)) &&
            boxes
              .get(entry.id)
              ?.some(
                (box) =>
                  box[2] >= span[0] && box[0] <= span[2] && box[3] >= span[1] && box[1] <= span[3],
              )
          )
            found.set(entry.id, entry);
        }
      }
      return [...found.values()];
    },
  };
}

export interface StyleSuggestion {
  regionId?: string;
  variants: Array<{ style: string; weight: number; share: number }>;
}

/** Inspect the same ordered atlas rules used by generation, without choosing a random variant. */
export function suggestStructureStyles(
  atlas: RegionAtlasDoc,
  longitude: number,
  latitude: number,
  metrics: BuildingMetrics,
): StyleSuggestion | undefined {
  const [x, z] = projectWgs84(longitude, latitude);
  const region = createRegionResolver(atlas, { metersPerUnit: 1 }).resolve(x, z);
  const rule = regionStyleRules(atlas, region).find((item) => matchesWhen(item.when, metrics));
  if (rule === undefined) return undefined;
  const variants = rule.variants ?? [{ style: rule.style, weight: 1 }];
  const total = variants.reduce((sum, item) => sum + item.weight, 0);
  return {
    ...(region !== undefined ? { regionId: region.id } : {}),
    variants: variants.map((item) => ({ ...item, share: item.weight / total })),
  };
}

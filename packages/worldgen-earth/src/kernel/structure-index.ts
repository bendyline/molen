/** Indexed, geographic placements for authored structure assets. Coordinates are WGS84. */
import { type BuildingMetrics, matchesWhen } from '@bendyline/molen-worldgen/kernel';
import { projectWgs84 } from './projection';
import { createRegionResolver, regionStyleRules } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';

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
  /** WGS84 extent [west, south, east, north]. Extended models are clipped per resident tile. */
  bounds?: [number, number, number, number];
  /** Suppress mapped bridge centerlines inside this model-local rectangle (meters). */
  replaceRoads?: { length: number; width: number; deckHeight?: number };
  /** Only a contained, nongeneralized mapped footprint may be replaced. */
  replaceFootprint?: boolean;
  /** The model enters adaptive terrain at this level. */
  minLevel?: number;
  /** Draft records are discoverable but never drawn. */
  status: 'preview' | 'draft';
  source: string;
  note?: string;
}

export interface StructureCatalogDoc {
  format: 'molen/structure-placements@1';
  title: string;
  entries: StructurePlacement[];
}

export interface StructureIndex {
  readonly entries: readonly StructurePlacement[];
  readonly cells: ReadonlyMap<string, readonly StructurePlacement[]>;
  /** Geographic rectangle [west, south, east, north]. */
  query(
    bounds: readonly [number, number, number, number],
    includeDraft?: boolean,
  ): StructurePlacement[];
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

export function createStructureIndex(doc: StructureCatalogDoc): StructureIndex {
  if (doc.format !== 'molen/structure-placements@1')
    throw new Error('invalid structure catalog format');
  const ids = new Set<string>();
  const cells = new Map<string, StructurePlacement[]>();
  for (const entry of doc.entries) {
    if (ids.has(entry.id)) throw new Error(`duplicate structure placement ${entry.id}`);
    ids.add(entry.id);
    if (!entry.asset || !entry.source || !['preview', 'draft'].includes(entry.status))
      throw new Error(`invalid structure placement ${entry.id}`);
    encodeStructureGeohash(...entry.anchor);
    if (entry.elevation !== undefined && !Number.isFinite(entry.elevation))
      throw new Error(`invalid structure elevation ${entry.id}`);
    if (
      entry.bounds &&
      (entry.bounds.some((v) => !Number.isFinite(v)) ||
        entry.bounds[0] < -180 ||
        entry.bounds[2] > 180 ||
        entry.bounds[1] < -90 ||
        entry.bounds[3] > 90 ||
        entry.bounds[0] >= entry.bounds[2] ||
        entry.bounds[1] >= entry.bounds[3] ||
        entry.datum !== 'sea-level')
    )
      throw new Error(`invalid absolute structure extent ${entry.id}`);
    if (entry.replaceRoads && !entry.bounds)
      throw new Error(`road replacement requires an extent ${entry.id}`);
    const keys = entry.bounds
      ? candidateCells(entry.bounds)
      : [encodeStructureGeohash(entry.anchor[0], entry.anchor[1])];
    if (!keys) throw new Error(`structure extent is too large: ${entry.id}`);
    for (const cell of keys) {
      const bucket = cells.get(cell) ?? [];
      bucket.push(entry);
      cells.set(cell, bucket);
    }
  }
  return {
    entries: doc.entries,
    cells,
    query(bounds, includeDraft = false) {
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
          keys === undefined ? doc.entries : keys.flatMap((key) => cells.get(key) ?? []);
        for (const entry of candidates) {
          const box: [number, number, number, number] = entry.bounds ?? [
            entry.anchor[0],
            entry.anchor[1],
            entry.anchor[0],
            entry.anchor[1],
          ];
          if (
            (includeDraft || entry.status === 'preview') &&
            box[2] >= span[0] &&
            box[0] <= span[2] &&
            box[3] >= span[1] &&
            box[1] <= span[3]
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

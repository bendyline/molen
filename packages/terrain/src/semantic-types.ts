/**
 * Format-neutral semantic geometry for one terrain tile.
 *
 * Coordinates are normalized tile-local `[u, v]` values where +u is east/right and +v is
 * south/down. Decoders may preserve buffered geometry just outside [0,1]; renderers clip or accept
 * it as appropriate. No geographic CRS or source-specific property names cross this boundary.
 */

import { isDegenerateRing } from './polygon';

export type TerrainSemanticPoint = [u: number, v: number];
export type TerrainSemanticLine = TerrainSemanticPoint[];
export type TerrainSemanticRing = TerrainSemanticPoint[];

export interface TerrainSemanticPolygon {
  /** Closed or open outer ring. The renderer closes it implicitly. */
  outer: TerrainSemanticRing;
  holes?: TerrainSemanticRing[];
}

export interface TerrainLandcoverFeature {
  id?: string | number;
  class: string;
  /** Finer source category when the schema carries one (e.g. Protomaps `kind_detail`). */
  subclass?: string;
  polygons: TerrainSemanticPolygon[];
  /** Optional normalized vegetation/decorator density multiplier. */
  density?: number;
}

export interface TerrainWaterFeature {
  id?: string | number;
  class?: string;
  polygons?: TerrainSemanticPolygon[];
  lines?: TerrainSemanticLine[];
  /** Suggested rendered width for linear waterways, in world units. */
  width?: number;
}

export interface TerrainTransportationFeature {
  id?: string | number;
  class: string;
  /** Finer category, e.g. residential, parking_aisle or footway. */
  subclass?: string;
  surface?: string;
  lanes?: number;
  oneway?: boolean;
  /** Turning connector or ramp, rather than an independent junction approach. */
  link?: boolean;
  /** Source service subtype, for example parking_aisle or driveway. */
  service?: string;
  /** Grade separation; different layers do not form junctions. */
  layer?: number;
  lines: TerrainSemanticLine[];
  /** Suggested rendered width in world units (meters for Earth packages). */
  width?: number;
  bridge?: boolean;
  tunnel?: boolean;
}

export interface TerrainBuildingFeature {
  id?: string | number;
  class?: string;
  /** Finer source category when the schema carries one (e.g. Protomaps `kind_detail`). */
  subclass?: string;
  polygons: TerrainSemanticPolygon[];
  /** World-space height above the building base. */
  height?: number;
  /** World-space offset of the building base above terrain. */
  minHeight?: number;
  levels?: number;
  /** Source stacking layer (negative = underground); informational. */
  layer?: number;
  name?: string;
  brand?: string;
  brandId?: string;
}

/** A mapped business, amenity, or individual outdoor object. */
export interface TerrainPoiFeature {
  id?: string | number;
  class: string;
  subclass?: string;
  point: TerrainSemanticPoint;
  name?: string;
  brand?: string;
  /** Stable source brand identifier, when supplied by an enriched source. */
  brandId?: string;
  /** Measurements in world units; absence means unknown. */
  height?: number;
  crownDiameter?: number;
  /** Rotation about +Y in radians; local model front is +Z. */
  heading?: number;
  leafType?: string;
  capacity?: number;
}

export interface TerrainSemanticTile {
  format: 'molen/terrain-semantics@1';
  landcover: TerrainLandcoverFeature[];
  water: TerrainWaterFeature[];
  transportation: TerrainTransportationFeature[];
  buildings: TerrainBuildingFeature[];
  pois?: TerrainPoiFeature[];
  /** Source merged/generalized footprints cannot reliably identify individual premises. */
  buildingsGeneralized?: boolean;
}

function assertFinite(value: number, path: string): void {
  if (!Number.isFinite(value)) throw new Error(`${path} must be finite`);
}

function assertPoint(point: TerrainSemanticPoint, path: string): void {
  if (!Array.isArray(point) || point.length !== 2) {
    throw new Error(`${path} must be a normalized [u,v] point`);
  }
  assertFinite(point[0], `${path}/0`);
  assertFinite(point[1], `${path}/1`);
}

function assertLine(line: TerrainSemanticLine, path: string, minimumPoints: number): void {
  if (!Array.isArray(line) || line.length < minimumPoints) {
    throw new Error(`${path} must contain at least ${minimumPoints} points`);
  }
  for (let index = 0; index < line.length; index++) {
    assertPoint(line[index] as TerrainSemanticPoint, `${path}/${index}`);
  }
}

/**
 * A ring with no enclosed area is not renderable: three.js earcut faults on such a hole rather
 * than ignoring it, so the contract rejects it here with the offending path instead of letting a
 * raw TypeError take out the whole layer for the tile.
 */
function assertRing(ring: TerrainSemanticRing, path: string): void {
  assertLine(ring, path, 3);
  if (isDegenerateRing(ring)) {
    throw new Error(
      `${path} must enclose an area: at least 3 distinct, non-collinear points are required`,
    );
  }
}

function assertPolygons(polygons: TerrainSemanticPolygon[], path: string): void {
  if (!Array.isArray(polygons) || polygons.length === 0) {
    throw new Error(`${path} must contain at least one polygon`);
  }
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
    const polygon = polygons[polygonIndex] as TerrainSemanticPolygon;
    assertRing(polygon.outer, `${path}/${polygonIndex}/outer`);
    for (let holeIndex = 0; holeIndex < (polygon.holes?.length ?? 0); holeIndex++) {
      assertRing(
        polygon.holes?.[holeIndex] as TerrainSemanticRing,
        `${path}/${polygonIndex}/holes/${holeIndex}`,
      );
    }
  }
}

function assertClass(value: string, path: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

/** Fail early when a source decoder violates the renderer's normalized semantic contract. */
export function assertTerrainSemanticTile(tile: TerrainSemanticTile): void {
  if (tile.format !== 'molen/terrain-semantics@1') {
    throw new Error(`terrain semantic tile format must be molen/terrain-semantics@1`);
  }
  const collections = [tile.landcover, tile.water, tile.transportation, tile.buildings];
  if (collections.some((collection) => !Array.isArray(collection))) {
    throw new Error('terrain semantic tile collections must be arrays');
  }
  if (tile.pois !== undefined && !Array.isArray(tile.pois))
    throw new Error('terrain semantic pois must be an array');
  for (const [index, feature] of (tile.pois ?? []).entries()) {
    const path = `/pois/${index}`;
    assertClass(feature.class, `${path}/class`);
    assertPoint(feature.point, `${path}/point`);
    for (const key of ['name', 'brand', 'brandId', 'subclass', 'leafType'] as const)
      if (feature[key] !== undefined) assertClass(feature[key], `${path}/${key}`);
    for (const key of ['height', 'crownDiameter', 'capacity'] as const) {
      if (feature[key] === undefined) continue;
      assertFinite(feature[key], `${path}/${key}`);
      if (feature[key] <= 0) throw new Error(`${path}/${key} must be positive`);
    }
    if (feature.heading !== undefined) assertFinite(feature.heading, `${path}/heading`);
  }
  for (let index = 0; index < tile.landcover.length; index++) {
    const feature = tile.landcover[index] as TerrainLandcoverFeature;
    assertClass(feature.class, `/landcover/${index}/class`);
    if (feature.subclass !== undefined) {
      assertClass(feature.subclass, `/landcover/${index}/subclass`);
    }
    assertPolygons(feature.polygons, `/landcover/${index}/polygons`);
    if (feature.density !== undefined) {
      assertFinite(feature.density, `/landcover/${index}/density`);
      if (feature.density < 0) throw new Error(`/landcover/${index}/density must not be negative`);
    }
  }
  for (let index = 0; index < tile.water.length; index++) {
    const feature = tile.water[index] as TerrainWaterFeature;
    if ((feature.polygons?.length ?? 0) === 0 && (feature.lines?.length ?? 0) === 0) {
      throw new Error(`/water/${index} must contain polygons or lines`);
    }
    if (feature.polygons !== undefined) {
      assertPolygons(feature.polygons, `/water/${index}/polygons`);
    }
    for (let lineIndex = 0; lineIndex < (feature.lines?.length ?? 0); lineIndex++) {
      assertLine(
        feature.lines?.[lineIndex] as TerrainSemanticLine,
        `/water/${index}/lines/${lineIndex}`,
        2,
      );
    }
    if (feature.width !== undefined) {
      assertFinite(feature.width, `/water/${index}/width`);
      if (feature.width <= 0) throw new Error(`/water/${index}/width must be positive`);
    }
  }
  for (let index = 0; index < tile.transportation.length; index++) {
    const feature = tile.transportation[index] as TerrainTransportationFeature;
    assertClass(feature.class, `/transportation/${index}/class`);
    if (feature.subclass !== undefined)
      assertClass(feature.subclass, `/transportation/${index}/subclass`);
    if (feature.surface !== undefined)
      assertClass(feature.surface, `/transportation/${index}/surface`);
    if (feature.layer !== undefined) assertFinite(feature.layer, `/transportation/${index}/layer`);
    if (feature.service !== undefined)
      assertClass(feature.service, `/transportation/${index}/service`);
    if (feature.link !== undefined && typeof feature.link !== 'boolean')
      throw new Error('transportation link must be boolean');
    if (feature.oneway !== undefined && typeof feature.oneway !== 'boolean')
      throw new Error('transportation oneway must be boolean');
    if (feature.lanes !== undefined && (!Number.isSafeInteger(feature.lanes) || feature.lanes <= 0))
      throw new Error('transportation lanes must be a positive safe integer');
    if (!Array.isArray(feature.lines) || feature.lines.length === 0) {
      throw new Error(`/transportation/${index}/lines must contain at least one line`);
    }
    for (let lineIndex = 0; lineIndex < feature.lines.length; lineIndex++) {
      assertLine(
        feature.lines[lineIndex] as TerrainSemanticLine,
        `/transportation/${index}/lines/${lineIndex}`,
        2,
      );
    }
    if (feature.width !== undefined) {
      assertFinite(feature.width, `/transportation/${index}/width`);
      if (feature.width <= 0) throw new Error(`/transportation/${index}/width must be positive`);
    }
  }
  if (tile.buildingsGeneralized !== undefined && typeof tile.buildingsGeneralized !== 'boolean')
    throw new Error('buildingsGeneralized must be boolean');
  for (let index = 0; index < tile.buildings.length; index++) {
    const feature = tile.buildings[index] as TerrainBuildingFeature;
    assertPolygons(feature.polygons, `/buildings/${index}/polygons`);
    if (feature.height !== undefined) {
      assertFinite(feature.height, `/buildings/${index}/height`);
      if (feature.height < 0) throw new Error(`/buildings/${index}/height must not be negative`);
    }
    if (feature.minHeight !== undefined) {
      assertFinite(feature.minHeight, `/buildings/${index}/minHeight`);
      if (feature.minHeight < 0) {
        throw new Error(`/buildings/${index}/minHeight must not be negative`);
      }
    }
    if (feature.levels !== undefined) {
      assertFinite(feature.levels, `/buildings/${index}/levels`);
      if (feature.levels < 0) throw new Error(`/buildings/${index}/levels must not be negative`);
    }
    if (feature.subclass !== undefined) {
      assertClass(feature.subclass, `/buildings/${index}/subclass`);
    }
    if (feature.name !== undefined) assertClass(feature.name, `/buildings/${index}/name`);
    if (feature.brand !== undefined) assertClass(feature.brand, `/buildings/${index}/brand`);
    if (feature.brandId !== undefined) assertClass(feature.brandId, `/buildings/${index}/brandId`);
    if (feature.layer !== undefined) assertFinite(feature.layer, `/buildings/${index}/layer`);
  }
}

/** Allocate a normalized empty tile without sharing mutable collection instances. */
export function createEmptyTerrainSemanticTile(): TerrainSemanticTile {
  return {
    format: 'molen/terrain-semantics@1',
    landcover: [],
    water: [],
    transportation: [],
    buildings: [],
  };
}

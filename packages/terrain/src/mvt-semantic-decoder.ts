/** Mapbox Vector Tile adapter for the format-neutral terrain semantic contract. */

import {
  classifyRings,
  VectorTile,
  type VectorTileFeature,
  type VectorTileLayer,
} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import type {
  TerrainSemanticTileDecodeContext,
  TerrainSemanticTileDecoder,
} from './package-client';
import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainLandcoverFeature,
  type TerrainPoiFeature,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  type TerrainWaterFeature,
} from './semantic-types';

export interface TerrainMvtSemanticDecoder extends TerrainSemanticTileDecoder {
  decode(data: Uint8Array, context: TerrainSemanticTileDecodeContext): TerrainSemanticTile;
}

type MvtPropertyValue = string | number | boolean;
type MvtProperties = Record<string, MvtPropertyValue>;

export interface TerrainMvtSemanticLayerNames {
  landcover: readonly string[];
  water: readonly string[];
  transportation: readonly string[];
  building: readonly string[];
  poi: readonly string[];
}

export interface TerrainMvtSemanticPropertyNames {
  landcoverClass: readonly string[];
  landcoverSubclass: readonly string[];
  landcoverDensity: readonly string[];
  waterClass: readonly string[];
  waterWidth: readonly string[];
  transportationClass: readonly string[];
  transportationSubclass: readonly string[];
  transportationSurface: readonly string[];
  transportationLanes: readonly string[];
  transportationOneway: readonly string[];
  transportationLink: readonly string[];
  transportationService: readonly string[];
  transportationLayer: readonly string[];
  transportationWidth: readonly string[];
  bridge: readonly string[];
  tunnel: readonly string[];
  buildingClass: readonly string[];
  buildingSubclass: readonly string[];
  buildingHeight: readonly string[];
  buildingMinHeight: readonly string[];
  buildingLevels: readonly string[];
  buildingLayer: readonly string[];
  buildingName: readonly string[];
}

export interface TerrainMvtSemanticDecoderLimits {
  maxFeaturesPerTile?: number;
  maxGeometryPointsPerTile?: number;
}

export interface TerrainMvtSemanticDecoderOptions {
  layers?: Partial<TerrainMvtSemanticLayerNames>;
  properties?: Partial<TerrainMvtSemanticPropertyNames>;
  /** Convert source height/width properties into terrain world units. */
  linearUnitScale?: number;
  limits?: TerrainMvtSemanticDecoderLimits;
}

const DEFAULT_LAYERS: TerrainMvtSemanticLayerNames = {
  landcover: ['landcover'],
  water: ['water'],
  transportation: ['transportation'],
  building: ['building'],
  poi: ['poi'],
};

const PROTOMAPS_LAYERS: TerrainMvtSemanticLayerNames = {
  landcover: ['landcover', 'landuse'],
  water: ['water'],
  transportation: ['roads'],
  building: ['buildings'],
  poi: ['pois'],
};

const DEFAULT_PROPERTIES: TerrainMvtSemanticPropertyNames = {
  landcoverClass: ['kind', 'class', 'landuse', 'natural'],
  landcoverSubclass: ['kind_detail', 'subclass'],
  landcoverDensity: ['density'],
  waterClass: ['kind', 'class', 'waterway', 'natural'],
  waterWidth: ['width'],
  transportationClass: ['kind', 'class', 'highway', 'kind_detail'],
  transportationSubclass: ['kind_detail', 'subclass', 'highway'],
  transportationSurface: ['surface'],
  transportationLanes: ['lanes'],
  transportationOneway: ['oneway', 'is_oneway'],
  transportationLink: ['is_link', 'link'],
  transportationService: ['service'],
  transportationLayer: ['layer'],
  transportationWidth: ['width'],
  bridge: ['is_bridge', 'bridge'],
  tunnel: ['is_tunnel', 'tunnel'],
  buildingClass: ['kind', 'class', 'building'],
  buildingSubclass: ['kind_detail', 'subclass', 'building:use'],
  buildingHeight: ['height', 'render_height', 'building:height'],
  buildingMinHeight: ['min_height', 'render_min_height', 'building:min_height'],
  buildingLevels: ['levels', 'building:levels'],
  buildingLayer: ['layer'],
  buildingName: ['name'],
};

interface DecodeBudget {
  features: number;
  points: number;
  maxFeatures: number;
  maxPoints: number;
}

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
  return value;
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function firstProperty(
  properties: MvtProperties,
  names: readonly string[],
): MvtPropertyValue | undefined {
  for (const name of names) {
    if (Object.hasOwn(properties, name)) return properties[name];
  }
  return undefined;
}

function stringProperty(
  properties: MvtProperties,
  names: readonly string[],
  fallback: string,
): string {
  const value = firstProperty(properties, names);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function optionalStringProperty(
  properties: MvtProperties,
  names: readonly string[],
): string | undefined {
  const value = firstProperty(properties, names);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
}

function numberProperty(
  properties: MvtProperties,
  names: readonly string[],
  scale = 1,
): number | undefined {
  const value = firstProperty(properties, names);
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(number) ? number * scale : undefined;
}

function flagProperty(properties: MvtProperties, names: readonly string[]): boolean {
  const value = firstProperty(properties, names);
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return !['', '0', 'false', 'no', 'none'].includes(value.trim().toLowerCase());
}

function featureId(feature: VectorTileFeature): string | number | undefined {
  return feature.id;
}

function consumeFeature(budget: DecodeBudget): void {
  budget.features++;
  if (budget.features > budget.maxFeatures) {
    throw new Error(`MVT semantic tile exceeds ${budget.maxFeatures} features`);
  }
}

function normalizedPoint(point: { x: number; y: number }, extent: number): TerrainSemanticPoint {
  return [point.x / extent, point.y / extent];
}

function normalizeLine(
  points: Array<{ x: number; y: number }>,
  extent: number,
  budget: DecodeBudget,
): TerrainSemanticLine {
  budget.points += points.length;
  if (budget.points > budget.maxPoints) {
    throw new Error(`MVT semantic tile exceeds ${budget.maxPoints} geometry points`);
  }
  return points.map((point) => normalizedPoint(point, extent));
}

function normalizeRing(
  points: Array<{ x: number; y: number }>,
  extent: number,
  budget: DecodeBudget,
): TerrainSemanticPoint[] {
  const ring = normalizeLine(points, extent, budget);
  const first = ring[0];
  const last = ring.at(-1);
  if (
    ring.length > 3 &&
    first !== undefined &&
    last !== undefined &&
    first[0] === last[0] &&
    first[1] === last[1]
  ) {
    ring.pop();
  }
  return ring;
}

function featureLines(feature: VectorTileFeature, budget: DecodeBudget): TerrainSemanticLine[] {
  if (feature.type !== 2) return [];
  return feature
    .loadGeometry()
    .map((line) => normalizeLine(line, feature.extent, budget))
    .filter((line) => line.length >= 2);
}

function featurePolygons(
  feature: VectorTileFeature,
  budget: DecodeBudget,
): TerrainSemanticPolygon[] {
  if (feature.type !== 3) return [];
  const classified = classifyRings(feature.loadGeometry());
  const polygons: TerrainSemanticPolygon[] = [];
  for (const rings of classified) {
    const [outer, ...holes] = rings.map((ring) => normalizeRing(ring, feature.extent, budget));
    if (outer === undefined || outer.length < 3) continue;
    const validHoles = holes.filter((hole) => hole.length >= 3);
    polygons.push({ outer, ...(validHoles.length > 0 ? { holes: validHoles } : {}) });
  }
  return polygons;
}

function forEachFeature(
  tile: VectorTile,
  layerNames: readonly string[],
  budget: DecodeBudget,
  visit: (feature: VectorTileFeature) => void,
): void {
  for (const layerName of layerNames) {
    const layer: VectorTileLayer | undefined = tile.layers[layerName];
    if (layer === undefined) continue;
    for (let index = 0; index < layer.length; index++) {
      consumeFeature(budget);
      visit(layer.feature(index));
    }
  }
}

function decodeLandcover(
  vectorTile: VectorTile,
  result: TerrainSemanticTile,
  layers: TerrainMvtSemanticLayerNames,
  properties: TerrainMvtSemanticPropertyNames,
  budget: DecodeBudget,
): void {
  forEachFeature(vectorTile, layers.landcover, budget, (feature) => {
    const polygons = featurePolygons(feature, budget);
    if (polygons.length === 0) return;
    const density = numberProperty(feature.properties, properties.landcoverDensity);
    const subclass = optionalStringProperty(feature.properties, properties.landcoverSubclass);
    const decoded: TerrainLandcoverFeature = {
      ...(featureId(feature) !== undefined ? { id: featureId(feature) } : {}),
      class: stringProperty(feature.properties, properties.landcoverClass, 'unknown'),
      ...(subclass !== undefined ? { subclass } : {}),
      polygons,
      ...(density !== undefined && density >= 0 ? { density } : {}),
    };
    result.landcover.push(decoded);
  });
}

function decodeWater(
  vectorTile: VectorTile,
  result: TerrainSemanticTile,
  layers: TerrainMvtSemanticLayerNames,
  properties: TerrainMvtSemanticPropertyNames,
  linearUnitScale: number,
  budget: DecodeBudget,
): void {
  forEachFeature(vectorTile, layers.water, budget, (feature) => {
    const polygons = featurePolygons(feature, budget);
    const lines = featureLines(feature, budget);
    if (polygons.length === 0 && lines.length === 0) return;
    const width = numberProperty(feature.properties, properties.waterWidth, linearUnitScale);
    const decoded: TerrainWaterFeature = {
      ...(featureId(feature) !== undefined ? { id: featureId(feature) } : {}),
      class: stringProperty(feature.properties, properties.waterClass, 'water'),
      ...(polygons.length > 0 ? { polygons } : {}),
      ...(lines.length > 0 ? { lines } : {}),
      ...(width !== undefined && width > 0 ? { width } : {}),
    };
    result.water.push(decoded);
  });
}

function decodeTransportation(
  vectorTile: VectorTile,
  result: TerrainSemanticTile,
  layers: TerrainMvtSemanticLayerNames,
  properties: TerrainMvtSemanticPropertyNames,
  linearUnitScale: number,
  budget: DecodeBudget,
): void {
  forEachFeature(vectorTile, layers.transportation, budget, (feature) => {
    const lines = featureLines(feature, budget);
    if (lines.length === 0) return;
    const width = numberProperty(
      feature.properties,
      properties.transportationWidth,
      linearUnitScale,
    );
    const decoded: TerrainTransportationFeature = {
      ...(featureId(feature) !== undefined ? { id: featureId(feature) } : {}),
      class: stringProperty(feature.properties, properties.transportationClass, 'road'),
      lines,
      ...(width !== undefined && width > 0 ? { width } : {}),
      ...(flagProperty(feature.properties, properties.bridge) ? { bridge: true } : {}),
      ...(flagProperty(feature.properties, properties.tunnel) ? { tunnel: true } : {}),
    };
    const subclass = optionalStringProperty(feature.properties, properties.transportationSubclass);
    const surface = optionalStringProperty(feature.properties, properties.transportationSurface);
    const lanes = numberProperty(feature.properties, properties.transportationLanes);
    const layer = numberProperty(feature.properties, properties.transportationLayer);
    if (subclass !== undefined) decoded.subclass = subclass;
    if (surface !== undefined) decoded.surface = surface;
    const service = optionalStringProperty(feature.properties, properties.transportationService);
    if (service !== undefined) decoded.service = service;
    if (flagProperty(feature.properties, properties.transportationLink)) decoded.link = true;
    if (lanes !== undefined && Number.isSafeInteger(lanes) && lanes > 0) decoded.lanes = lanes;
    if (layer !== undefined) decoded.layer = layer;
    if (firstProperty(feature.properties, properties.transportationOneway) !== undefined)
      decoded.oneway = flagProperty(feature.properties, properties.transportationOneway);
    result.transportation.push(decoded);
  });
}

function decodeBuildings(
  vectorTile: VectorTile,
  result: TerrainSemanticTile,
  layers: TerrainMvtSemanticLayerNames,
  properties: TerrainMvtSemanticPropertyNames,
  linearUnitScale: number,
  budget: DecodeBudget,
): void {
  forEachFeature(vectorTile, layers.building, budget, (feature) => {
    const polygons = featurePolygons(feature, budget);
    if (polygons.length === 0) return;
    const height = numberProperty(feature.properties, properties.buildingHeight, linearUnitScale);
    const minHeight = numberProperty(
      feature.properties,
      properties.buildingMinHeight,
      linearUnitScale,
    );
    const levels = numberProperty(feature.properties, properties.buildingLevels);
    const subclass = optionalStringProperty(feature.properties, properties.buildingSubclass);
    const layer = numberProperty(feature.properties, properties.buildingLayer);
    const name = optionalStringProperty(feature.properties, properties.buildingName);
    const decoded: TerrainBuildingFeature = {
      ...(featureId(feature) !== undefined ? { id: featureId(feature) } : {}),
      class: stringProperty(feature.properties, properties.buildingClass, 'building'),
      ...(subclass !== undefined ? { subclass } : {}),
      polygons,
      ...(height !== undefined && height >= 0 ? { height } : {}),
      ...(minHeight !== undefined && minHeight >= 0 ? { minHeight } : {}),
      ...(levels !== undefined && levels >= 0 ? { levels } : {}),
      ...(layer !== undefined ? { layer } : {}),
      ...(name !== undefined ? { name } : {}),
    };
    const brand = optionalStringProperty(feature.properties, ['brand']);
    const brandId = optionalStringProperty(feature.properties, ['brand:wikidata', 'brand_id']);
    if (brand !== undefined) decoded.brand = brand;
    if (brandId !== undefined) decoded.brandId = brandId;
    result.buildings.push(decoded);
  });
}

function decodePois(
  vectorTile: VectorTile,
  result: TerrainSemanticTile,
  layers: TerrainMvtSemanticLayerNames,
  linearUnitScale: number,
  budget: DecodeBudget,
): void {
  const pois: TerrainPoiFeature[] = [];
  forEachFeature(vectorTile, layers.poi, budget, (feature) => {
    if (feature.type !== 1) return;
    for (const line of feature.loadGeometry()) {
      for (const point of normalizeLine(line, feature.extent, budget)) {
        const properties = feature.properties;
        const poi: TerrainPoiFeature = {
          ...(featureId(feature) !== undefined ? { id: featureId(feature) } : {}),
          class: stringProperty(
            properties,
            ['kind', 'class', 'amenity', 'shop', 'natural', 'highway'],
            'unknown',
          ),
          point,
        };
        for (const [field, names] of [
          ['name', ['name', 'name:en']],
          ['subclass', ['kind_detail', 'subclass']],
          ['brand', ['brand']],
          ['brandId', ['brand:wikidata', 'brand_id']],
          ['leafType', ['leaf_type', 'leafType']],
        ] as const) {
          const value = optionalStringProperty(properties, names);
          if (value !== undefined) poi[field] = value;
        }
        for (const [field, names, scale] of [
          ['height', ['height'], linearUnitScale],
          ['crownDiameter', ['diameter_crown', 'crown_diameter'], linearUnitScale],
          ['capacity', ['capacity'], 1],
        ] as const) {
          const value = numberProperty(properties, names, scale);
          if (value !== undefined && value > 0) poi[field] = value;
        }
        const bearing = numberProperty(properties, ['direction']);
        if (bearing !== undefined) poi.heading = ((180 - bearing) * Math.PI) / 180;
        pois.push(poi);
      }
    }
  });
  if (pois.length > 0) result.pois = pois;
}

/** Decode configured MVT source layers into renderer-neutral tile-local semantic geometry. */
export function createTerrainMvtSemanticDecoder(
  options: TerrainMvtSemanticDecoderOptions = {},
): TerrainMvtSemanticDecoder {
  const layers: TerrainMvtSemanticLayerNames = { ...DEFAULT_LAYERS, ...options.layers };
  const properties: TerrainMvtSemanticPropertyNames = {
    ...DEFAULT_PROPERTIES,
    ...options.properties,
  };
  const linearUnitScale = requirePositiveFinite(options.linearUnitScale ?? 1, 'linearUnitScale');
  const maxFeatures = requirePositiveInteger(
    options.limits?.maxFeaturesPerTile ?? 100_000,
    'maxFeaturesPerTile',
  );
  const maxPoints = requirePositiveInteger(
    options.limits?.maxGeometryPointsPerTile ?? 2_000_000,
    'maxGeometryPointsPerTile',
  );
  return {
    decode(data: Uint8Array, context: TerrainSemanticTileDecodeContext): TerrainSemanticTile {
      if (context.encoding !== 'mvt') {
        throw new Error(`MVT semantic decoder cannot decode ${context.encoding}`);
      }
      const vectorTile = new VectorTile(new Pbf(data));
      const result = createEmptyTerrainSemanticTile();
      const budget: DecodeBudget = { features: 0, points: 0, maxFeatures, maxPoints };
      if (context.content === 'landcover' || context.content === 'all') {
        decodeLandcover(vectorTile, result, layers, properties, budget);
        if (context.content === 'landcover') return result;
      }
      const requested = new Set(context.layers);
      if (requested.has('water')) {
        decodeWater(vectorTile, result, layers, properties, linearUnitScale, budget);
      }
      if (requested.has('transportation')) {
        decodeTransportation(vectorTile, result, layers, properties, linearUnitScale, budget);
      }
      if (requested.has('poi')) decodePois(vectorTile, result, layers, linearUnitScale, budget);
      if (requested.has('building')) {
        decodeBuildings(vectorTile, result, layers, properties, linearUnitScale, budget);
      }
      return result;
    },
  };
}

/** Preset matching the `world.pmtiles` Protomaps basemap this repo's sample package ships. */
export function createProtomapsTerrainMvtDecoder(
  options: Omit<TerrainMvtSemanticDecoderOptions, 'layers'> & {
    layers?: Partial<TerrainMvtSemanticLayerNames>;
  } = {},
): TerrainMvtSemanticDecoder {
  const decoder = createTerrainMvtSemanticDecoder({
    ...options,
    layers: { ...PROTOMAPS_LAYERS, ...options.layers },
  });
  return {
    decode(data, context) {
      const result = decoder.decode(data, context);
      if (context.address.level < 15 && result.buildings.length > 0)
        result.buildingsGeneralized = true;
      return result;
    },
  };
}

import type { FontLibrary } from '@bendyline/molen-materials/text';
import type { VehicleSpec } from '@bendyline/molen-schema';
import type { TerrainRoadSignProfile } from './road-sign-styles';
import type { TerrainRouteShieldLibrary } from './route-shields';

/** Data-only surface art direction. The 1910 preset is an interpretation, not historical data. */
export type TerrainSurfaceStyleId = 'modern' | '1910' | 'minimal';

export interface TerrainSurfaceStyle {
  id: string;
  label: string;
  road: string;
  parking: string;
  dirt: string;
  path: string;
  plaza: string;
  shoulder: string;
  sidewalk: string;
  curb: string;
  white: string;
  center: string;
  /** Applied to inferred widths; explicitly mapped widths remain authoritative. */
  roadWidthScale: number;
  sidewalkWidth: number;
  unpavedRoads: boolean;
  markings: boolean;
  sidewalks: boolean;
  crossings: boolean;
  streetlights: boolean;
  trafficSignals: boolean;
  /** Physical road signs. Optional on custom styles for source compatibility. */
  roadSigns?: boolean;
  parkingStalls: boolean;
  parkedCars: boolean;
}

const MODERN: Readonly<TerrainSurfaceStyle> = Object.freeze({
  id: 'modern',
  label: 'Modern traffic',
  road: '#646766',
  parking: '#6e7170',
  dirt: '#a18a64',
  path: '#bab3a3',
  plaza: '#afa89b',
  shoulder: '#918974',
  sidewalk: '#c6c4b9',
  curb: '#ded9cb',
  white: '#cdcbbf',
  center: '#c3aa68',
  roadWidthScale: 1,
  sidewalkWidth: 1.8,
  unpavedRoads: false,
  markings: true,
  sidewalks: true,
  crossings: true,
  streetlights: true,
  trafficSignals: true,
  roadSigns: true,
  parkingStalls: true,
  parkedCars: true,
});

export const TERRAIN_SURFACE_STYLES: Readonly<
  Record<TerrainSurfaceStyleId, Readonly<TerrainSurfaceStyle>>
> = Object.freeze({
  modern: MODERN,
  '1910': Object.freeze({
    ...MODERN,
    id: '1910',
    label: 'Circa 1910',
    road: '#a18b68',
    parking: '#ad9875',
    dirt: '#a18b68',
    path: '#bca681',
    plaza: '#a49a86',
    shoulder: '#8c8866',
    roadWidthScale: 0.8,
    unpavedRoads: true,
    markings: false,
    sidewalks: false,
    crossings: false,
    streetlights: false,
    trafficSignals: false,
    roadSigns: false,
    parkingStalls: false,
    parkedCars: false,
  }),
  minimal: Object.freeze({
    ...MODERN,
    id: 'minimal',
    label: 'Simple surfaces',
    markings: false,
    sidewalks: false,
    crossings: false,
    streetlights: false,
    trafficSignals: false,
    roadSigns: false,
    parkingStalls: false,
    parkedCars: false,
  }),
});

export interface TerrainSurfaceDetails {
  /** Suppress inferred lamps near mapped ones when a separate mapped-prop layer is active. */
  preferMappedProps?: boolean;
  /** Infer pavement from aisle patterns and bounded service-road courts near nonresidential buildings. Default true. */
  inferParking?: boolean;
  markings?: boolean;
  sidewalks?: boolean;
  crossings?: boolean;
  streetlights?: boolean;
  trafficSignals?: boolean;
  roadSigns?: boolean;
  /** Infer decorative stop controls where no mapped controls exist. Defaults to the sign profile. */
  inferStopSigns?: boolean;
  parkingStalls?: boolean;
  parkedCars?: boolean;
  /** Fraction of valid parking bays occupied, [0,1], default 0.7. */
  parkingOccupancy?: number;
  /** Fixture and car count limit per tile, default 160. */
  maxFixturesPerTile?: number;
  /** Separate lamp budget, default 1.5 × maxFixturesPerTile; lamps do not displace parked cars. */
  maxStreetlightsPerTile?: number;
  /** Marking/parking layout work limit per tile, default 16,000. */
  maxDetailElements?: number;
  /** Render details at this many levels below the finest level, default 0. */
  detailLevelsBelowMax?: number;
  /**
   * The vehicles parked cars are drawn from, in order: a kind id and its spec, such as the
   * vehicle types of the `molen.entities` content pack. Omitted or empty, no cars are parked.
   */
  parkedVehicles?: readonly TerrainParkedVehicle[];
}

/** One kind of parked car: the entity type id and the vehicle spec that sizes and seats it. */
export interface TerrainParkedVehicle {
  id: string;
  spec: VehicleSpec;
  /** Relative regional prevalence (default 1); zero excludes a vehicle. */
  weight?: number;
  /** Optional model-specific paint palette. */
  colors?: readonly string[];
}

export interface TerrainSurfaceOptions {
  /** Override regional handedness for road markings, signals and signs together. */
  drivingSide?: 'left' | 'right';
  /** Host-loaded font content, shared by direct rendering and workers. No font means unlettered panels. */
  fonts?: FontLibrary;
  /** Host-loaded vector route artwork, shared with workers once per change. */
  routeShields?: TerrainRouteShieldLibrary;
  /** Face id or semantic role; defaults to the library's highway role. */
  signFont?: string;
  /** Country-specific appearance and conservative stop inference; data-only for workers. */
  signProfile?: Readonly<TerrainRoadSignProfile>;
  style?: TerrainSurfaceStyleId | Readonly<TerrainSurfaceStyle>;
  details?: TerrainSurfaceDetails;
}

export function resolveTerrainSurfaceStyle(
  style: TerrainSurfaceOptions['style'] = 'modern',
  details: TerrainSurfaceDetails = {},
): TerrainSurfaceStyle {
  const source = typeof style === 'string' ? TERRAIN_SURFACE_STYLES[style] : style;
  if (!source) throw new Error(`Unknown terrain surface style: ${String(style)}`);
  const result = { ...source };
  for (const key of [
    'markings',
    'sidewalks',
    'crossings',
    'streetlights',
    'trafficSignals',
    'roadSigns',
    'parkingStalls',
    'parkedCars',
  ] as const) {
    if (details[key] !== undefined) result[key] = details[key];
  }
  if (
    !Number.isFinite(result.roadWidthScale) ||
    result.roadWidthScale <= 0 ||
    !Number.isFinite(result.sidewalkWidth) ||
    result.sidewalkWidth < 0
  ) {
    throw new Error(
      'Surface widths must be finite; road scale positive and sidewalk width nonnegative',
    );
  }
  for (const key of [
    'maxFixturesPerTile',
    'maxStreetlightsPerTile',
    'maxDetailElements',
    'detailLevelsBelowMax',
  ] as const) {
    const value = details[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`${key} must be a nonnegative safe integer`);
    }
  }
  if (
    details.parkingOccupancy !== undefined &&
    (!Number.isFinite(details.parkingOccupancy) ||
      details.parkingOccupancy < 0 ||
      details.parkingOccupancy > 1)
  ) {
    throw new Error('parkingOccupancy must be between 0 and 1');
  }
  return result;
}

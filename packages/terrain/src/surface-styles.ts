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
  parkingStalls: boolean;
  parkedCars: boolean;
}

const MODERN: Readonly<TerrainSurfaceStyle> = Object.freeze({
  id: 'modern',
  label: 'Modern traffic',
  road: '#41484d',
  parking: '#535b61',
  dirt: '#a18a64',
  path: '#c0b18f',
  plaza: '#afa89b',
  shoulder: '#918974',
  sidewalk: '#c6c4b9',
  curb: '#ded9cb',
  white: '#eee9d4',
  center: '#e8bd57',
  roadWidthScale: 1,
  sidewalkWidth: 1.8,
  unpavedRoads: false,
  markings: true,
  sidewalks: true,
  crossings: true,
  streetlights: true,
  trafficSignals: true,
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
  parkingStalls?: boolean;
  parkedCars?: boolean;
  /** Fraction of valid parking bays occupied, [0,1], default 0.7. */
  parkingOccupancy?: number;
  /** Fixture and car count limit per tile, default 160. */
  maxFixturesPerTile?: number;
  /** Marking/parking layout work limit per tile, default 16,000. */
  maxDetailElements?: number;
  /** Render details at this many levels below the finest level, default 0. */
  detailLevelsBelowMax?: number;
}

export interface TerrainSurfaceOptions {
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
  for (const key of ['maxFixturesPerTile', 'maxDetailElements', 'detailLevelsBelowMax'] as const) {
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

import type { TerrainSurfaceStyle } from '@bendyline/molen-terrain/client';

export interface WorldRegion {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  /** Catalog airport/runway used for aircraft selection; coordinates locate its geographic cell. */
  airport: { id: string; runway: string };
  /** West, south, east, north; street detail and wider coarse elevation coverage. */
  detailBounds: [number, number, number, number];
  coverageBounds: [number, number, number, number];
  /**
   * Further places inside the coverage with fine elevation (through `elevationMaxLevel`) and map
   * features of their own, away from the main detail window.
   */
  detailWindows?: readonly {
    id: string;
    label: string;
    bounds: [number, number, number, number];
    elevationMaxLevel?: number;
  }[];
  /**
   * Snow line in meters above sea level: lying snow begins here unless `?snow=` says otherwise.
   * Absent, the region opens without snow on the ground.
   */
  snowLevel?: number;
  /**
   * Open-water color seen from above, from matched orthophotos: deep or turbid water is far
   * darker than the sky it reflects at a glance. Defaults to the shared Earth water color.
   */
  water?: string;
  /**
   * Surface colors over the selected street style, where local paving reads differently, and the
   * railways: `railElectrification: 'all'` where main lines run under catenary too, and the main
   * lines' gauge where it is not standard.
   */
  surfaces?: Partial<
    Pick<
      TerrainSurfaceStyle,
      'road' | 'parking' | 'sidewalk' | 'curb' | 'railElectrification' | 'railGauge'
    >
  >;
}

export const DEFAULT_WORLD_REGION: WorldRegion = {
  id: 'seattle-bellevue-sammamish',
  label: 'Seattle, Bellevue, and Sammamish, Washington',
  longitude: -122.310997,
  latitude: 47.540501,
  airport: { id: 'KBFI', runway: '14R/32L' },
  // Include Boeing Field and the neighborhoods south of its runway start.
  detailBounds: [-122.46, 47.49, -121.95, 47.7],
  // East past the Cascade crest and south past Mount Rainier and the Tatoosh Range.
  coverageBounds: [-123.15, 46.6, -120.9, 48.3],
  detailWindows: [
    // The summit, Paradise and Sunrise: about 13 m between elevation samples.
    {
      id: 'mount-rainier',
      label: 'Mount Rainier',
      bounds: [-121.93, 46.73, -121.58, 46.95],
      elevationMaxLevel: 13,
    },
  ],
  // Rainier's glaciers and the high Cascades keep their snow above about 2,000 m all year.
  snowLevel: 2000,
  // Puget Sound and Lake Washington read near-black navy in summer NAIP imagery.
  water: '#071f2b',
};

/** Shared by the viewer and the regional PMTiles builder. */
export const WORLD_REGIONS: readonly WorldRegion[] = [
  DEFAULT_WORLD_REGION,
  {
    id: 'sydney',
    label: 'Sydney, Australia',
    longitude: 151.171997,
    latitude: -33.929401,
    airport: { id: 'YSSY', runway: '16R/34L' },
    detailBounds: [151.04, -33.99, 151.31, -33.77],
    coverageBounds: [150.3, -34.5, 151.8, -33.2],
    // Port Jackson's harbour water is a dark green-teal in NSW imagery.
    water: '#22493f',
    // Sydney Trains' suburban network is electrified (1500 V DC overhead).
    surfaces: { railElectrification: 'all' },
  },
  {
    id: 'kyoto',
    label: 'Kyoto, Japan',
    // Itami is inside the wider Kyoto package, southwest of the city detail window.
    longitude: 135.429001,
    latitude: 34.791302,
    airport: { id: 'RJOO', runway: '14R/32L' },
    detailBounds: [135.66, 34.88, 135.88, 35.09],
    coverageBounds: [135.15, 34.5, 136.4, 35.7],
    // JR and private railways around Kyoto run under overhead catenary, on 1,067 mm gauge.
    surfaces: { railElectrification: 'all', railGauge: 1.067 },
  },
  {
    id: 'yuma',
    label: 'Yuma, Arizona',
    longitude: -114.628998,
    latitude: 32.636799,
    airport: { id: 'KNYL', runway: '03L/21R' },
    detailBounds: [-114.78, 32.57, -114.47, 32.81],
    coverageBounds: [-115.4, 32.1, -113.8, 33.5],
    // The Colorado and its canals run dark olive-green under algae and silt.
    water: '#0c2416',
  },
  {
    id: 'new-delhi',
    label: 'New Delhi, India',
    longitude: 77.084801,
    latitude: 28.5672,
    airport: { id: 'VIDP', runway: '10/28' },
    detailBounds: [77.08, 28.49, 77.34, 28.75],
    coverageBounds: [76.4, 27.9, 78, 29.4],
    // Dust settles on Delhi's roads and footpaths: Sentinel-2 reads them warm grey-brown.
    // Indian Railways' main lines through Delhi are electrified (25 kV AC overhead).
    surfaces: {
      road: '#625a4e',
      parking: '#685f52',
      sidewalk: '#94876f',
      curb: '#ab9d85',
      railElectrification: 'all',
      railGauge: 1.676,
    },
  },
];

export function regionPackagePath(region: WorldRegion): string {
  return `terrain/${region.id}/terrain-package.json`;
}

/** Explicit custom packages and synthetic fixtures retain their existing URL behavior. */
export function selectedRegion(params: URLSearchParams): WorldRegion | undefined {
  if (params.has('synthetic')) return undefined;
  const packagePath = params.get('package');
  if (packagePath !== null)
    return WORLD_REGIONS.find((region) => regionPackagePath(region) === packagePath);
  const id = params.get('region');
  if (id === null) return DEFAULT_WORLD_REGION;
  const region = WORLD_REGIONS.find((candidate) => candidate.id === id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}

/** Keep rendering preferences, but reset location-specific startup state on a region change. */
export function regionUrl(current: URL, region: WorldRegion): URL {
  const next = new URL(current);
  for (const key of [
    'package',
    'synthetic',
    'lat',
    'lon',
    'alt',
    'yaw',
    'pitch',
    'level',
    'diorama',
    'navigation',
    'aircraft',
    'boat',
    // Each region opens on its own snow line.
    'snow',
  ])
    next.searchParams.delete(key);
  next.searchParams.set('region', region.id);
  return next;
}

export function createRegionControls(select: HTMLSelectElement): void {
  const params = new URLSearchParams(location.search);
  const selected = selectedRegion(params);
  if (!selected) {
    const option = new Option(params.has('synthetic') ? 'Synthetic demo' : 'Custom package', '');
    option.disabled = true;
    select.add(option);
  }
  for (const region of WORLD_REGIONS) select.add(new Option(region.label, region.id));
  select.value = selected?.id ?? '';
  select.addEventListener('change', () => {
    const region = WORLD_REGIONS.find((candidate) => candidate.id === select.value);
    if (region) location.assign(regionUrl(new URL(location.href), region));
  });
}

export interface WorldRegion {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  /** West, south, east, north; street detail and wider coarse elevation coverage. */
  detailBounds: [number, number, number, number];
  coverageBounds: [number, number, number, number];
}

export const DEFAULT_WORLD_REGION: WorldRegion = {
  id: 'seattle-bellevue-sammamish',
  label: 'Seattle, Bellevue, and Sammamish, Washington',
  longitude: -122.0356,
  latitude: 47.6163,
  detailBounds: [-122.46, 47.55, -121.95, 47.7],
  coverageBounds: [-123.15, 46.95, -120.9, 48.3],
};

/** Shared by the viewer and the regional PMTiles builder. */
export const WORLD_REGIONS: readonly WorldRegion[] = [
  DEFAULT_WORLD_REGION,
  {
    id: 'sydney',
    label: 'Sydney, Australia',
    longitude: 151.2093,
    latitude: -33.8688,
    detailBounds: [151.04, -33.99, 151.31, -33.77],
    coverageBounds: [150.3, -34.5, 151.8, -33.2],
  },
  {
    id: 'kyoto',
    label: 'Kyoto, Japan',
    longitude: 135.7681,
    latitude: 35.0116,
    detailBounds: [135.66, 34.88, 135.88, 35.09],
    coverageBounds: [135.15, 34.5, 136.4, 35.7],
  },
  {
    id: 'yuma',
    label: 'Yuma, Arizona',
    longitude: -114.6244,
    latitude: 32.7253,
    detailBounds: [-114.78, 32.57, -114.47, 32.81],
    coverageBounds: [-115.4, 32.1, -113.8, 33.5],
  },
  {
    id: 'new-delhi',
    label: 'New Delhi, India',
    longitude: 77.209,
    latitude: 28.6139,
    detailBounds: [77.08, 28.49, 77.34, 28.75],
    coverageBounds: [76.4, 27.9, 78, 29.4],
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

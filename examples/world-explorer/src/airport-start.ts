import type { EarthAirports } from '@bendyline/molen-earth/client';
import { wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import type { WorldRegion } from './regions.js';

export interface AirportStart {
  label: string;
  position: [number, number];
  /** Aircraft yaw: zero points along world +Z. */
  yaw: number;
}

/** Use the same observed runway endpoints as the airport surface renderer. */
export async function airportStart(
  region: WorldRegion,
  airports: EarthAirports,
  metersPerUnit: number,
): Promise<AirportStart> {
  const airport = (await airports.at(region.latitude, region.longitude)).find(
    (entry) => entry.id === region.airport.id,
  );
  const runway = airport?.runways.find((entry) => entry.id === region.airport.runway);
  if (!airport || !runway) throw new Error('Starting airport runway is unavailable');
  const [west, south, east, north] = region.coverageBounds;
  if (runway.ends.some(([lon, lat]) => lon < west || lon > east || lat < south || lat > north))
    throw new Error('Starting airport runway is outside this region');
  const [a, b] = runway.ends.map(([lon, lat]) =>
    wgs84ToWebMercator(lon, lat).map((value) => value * metersPerUnit),
  ) as [[number, number], [number, number]];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid starting runway');
  // Leave room behind the largest airframe while keeping most of the takeoff roll ahead.
  const inset = Math.min(120, length / 10) / length;
  return {
    label: airport.name,
    position: [a[0] + dx * inset, a[1] + dz * inset],
    yaw: Math.atan2(dx, dz),
  };
}

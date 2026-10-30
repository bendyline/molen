import { createEarthAirports, type EarthAirportIndex } from '@bendyline/molen-earth/client';
import {
  webMercatorScaleAtLatitude,
  webMercatorToWgs84,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { airportStart } from './airport-start';
import { DEFAULT_WORLD_REGION, WORLD_REGIONS } from './regions';

const documents = import.meta.glob<string>('../../../content/earth/airports/**/*.json', {
  query: '?raw',
  import: 'default',
});
const read = async <T>(path: string): Promise<T> => {
  const load = documents[`../../../content/earth/${path}`];
  if (!load) throw new Error(`Missing airport document: ${path}`);
  return JSON.parse(await load()) as T;
};
const airports = await createEarthAirports(
  await read<EarthAirportIndex>('airports/index.json'),
  read,
);

describe('starter airports', () => {
  it.each(
    WORLD_REGIONS,
  )('places $label on an observed runway within the packaged area', async (region) => {
    const scale = webMercatorScaleAtLatitude(region.latitude);
    const start = await airportStart(region, airports, scale);
    const [lon, lat] = webMercatorToWgs84(start.position[0] / scale, start.position[1] / scale);
    const [west, south, east, north] = region.coverageBounds;
    expect(lon).toBeGreaterThan(west);
    expect(lon).toBeLessThan(east);
    expect(lat).toBeGreaterThan(south);
    expect(lat).toBeLessThan(north);
    const record = (await airports.at(region.latitude, region.longitude)).find(
      (a) => a.id === region.airport.id,
    );
    const runway = record?.runways.find((r) => r.id === region.airport.runway);
    if (!runway) throw new Error('Missing catalog runway');
    const [a, b] = runway.ends.map((end) => wgs84ToWebMercator(...end).map((n) => n * scale)) as [
      [number, number],
      [number, number],
    ];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    expect(Math.hypot(start.position[0] - a[0], start.position[1] - a[1])).toBeCloseTo(120);
    expect(Math.sin(start.yaw)).toBeCloseTo(dx / Math.hypot(dx, dz));
    expect(Math.cos(start.yaw)).toBeCloseTo(dz / Math.hypot(dx, dz));
    expect(start.label).toBe(record?.name);
  });

  it('rejects unavailable runways instead of inventing a field', async () => {
    const region = { ...DEFAULT_WORLD_REGION, airport: { id: 'missing', runway: '01/19' } };
    await expect(airportStart(region, airports, 1)).rejects.toThrow('unavailable');
  });
});

import { readFile } from 'node:fs/promises';
import { createFleetLibrary, type FleetCatalog } from '@bendyline/molen-ambient/kernel';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import type { RegionAtlasDoc } from '@bendyline/molen-worldgen-earth/kernel';
import { describe, expect, it } from 'vitest';
import { ambientContentFromTypes } from '../src/client/ambient';
import { createEarthFleet } from '../src/client/fleet';

const json = async (path: string) =>
  JSON.parse(await readFile(new URL(`../../../content/${path}`, import.meta.url), 'utf8'));
const atlas = (await json('earth/world.atlas.json')) as RegionAtlasDoc;
const catalog = (await json('entities/fleets/road.json')) as FleetCatalog;
const docs = await Promise.all(
  ['vehicle', 'transit'].map((name) => json(`entities/types/${name}.types.json`)),
);
const types = createTypeLibrary(docs);
const content = ambientContentFromTypes(types, async () => {
  throw new Error('Fleet metadata must not load models');
});
const fleet = createEarthFleet({ catalogs: [catalog], atlas }, content.types.car ?? [], [], 1);

describe('Earth regional fleets', () => {
  it.each([
    ['Beijing', 116.4, 39.9, 'china'],
    ['Tokyo', 139.7, 35.7, 'japan'],
    ['Seoul', 126.98, 37.57, 'korea'],
    ['Paris', 2.35, 48.86, 'europe-west'],
    ['Berlin', 13.4, 52.52, 'europe'],
    ['London', -0.127, 51.51, 'europe-islands'],
    ['São Paulo', -46.63, -23.55, 'brazil'],
    ['Bogotá', -74.07, 4.71, 'andes'],
    ['Buenos Aires', -58.38, -34.6, 'southern-south-america'],
    ['Lagos', 3.38, 6.52, 'africa-west'],
    ['Nairobi', 36.82, -1.29, 'africa-east'],
    ['Johannesburg', 28.04, -26.2, 'africa-south'],
    ['Casablanca', -7.59, 33.57, 'africa-north'],
    ['Seattle', -122.33, 47.61, 'north-america'],
  ] as const)('resolves %s without architecture overlays hiding its fleet', (_name, lon, lat, expected) => {
    const [x, z] = wgs84ToWorld(1, lon, lat);
    expect(fleet.profileAt(x, z)).toBe(expected);
    const pool = fleet.carsAt(x, z);
    expect(pool.length).toBeGreaterThanOrEqual(10);
    expect(pool.length).toBeLessThanOrEqual(16);
    expect(fleet.carsAt(x, z)).toBe(pool);
  });
  it('references available models and atlas regions; excludes US pickups in China', () => {
    for (const profile of catalog.profiles)
      for (const id of Object.keys(profile.weights)) expect(types.has(id), id).toBe(true);
    for (const id of Object.keys(catalog.regions))
      expect(
        atlas.regions.some((r) => r.id === id),
        id,
      ).toBe(true);
    const library = createFleetLibrary([catalog], new Set(types.ids()));
    expect(
      library.select('library.china').weights.has('molen.entities.vehicle.ford_f_150_2025'),
    ).toBe(false);
    expect(
      library.select('library.china').weights.has('molen.entities.vehicle.byd_seagull_2024'),
    ).toBe(true);
    expect(library.select('jp').weights.has('molen.entities.vehicle.honda_n_box_2024')).toBe(true);
  });
  it('has a compact fallback and keeps boat/aircraft catalogs outside the road filter', () => {
    const [x, z] = wgs84ToWorld(1, -140, 0);
    expect(fleet.profileAt(x, z)).toBe('global');
    expect(
      catalog.profiles.every((p) =>
        Object.keys(p.weights).every(
          (id) => !id.includes('watercraft') && !id.includes('aircraft'),
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify(catalog).length).toBeLessThan(30000);
  });
});

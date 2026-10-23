import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import { terrainRoadSignCatalogSchema, wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import type { RegionAtlasDoc } from '@bendyline/molen-worldgen-earth/kernel';
import { describe, expect, it, vi } from 'vitest';
import { loadEarthContent } from '../src/client/content';
import { createEarthRoadSigns } from '../src/client/road-signs';

const json = async (path: string) =>
  JSON.parse(await readFile(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'));
const base = await json('signs/catalog.json');
const states = await json('signs/us-states.json');
const catalog = terrainRoadSignCatalogSchema.parse({
  ...base,
  profiles: [...base.profiles, ...states.profiles],
});
const atlas = (await json('signs/regions.atlas.json')) as RegionAtlasDoc;

describe('Earth road-sign conventions', () => {
  it.each([
    ['Seattle', -122.33, 47.61, 'us-wa'],
    ['Portland', -122.68, 45.52, 'us-or'],
    ['Sacramento', -121.49, 38.58, 'us-ca'],
    ['Manhattan', -73.98, 40.76, 'us-ny'],
    ['Anchorage', -149.9, 61.22, 'us-ak'],
    ['Honolulu', -157.85, 21.31, 'us-hi'],
    ['Washington DC', -77.04, 38.91, 'us'],
    ['Vancouver', -123.12, 49.28, 'generic'],
    ['London', -0.127, 51.51, 'gb'],
    ['Paris', 2.35, 48.86, 'fr'],
    ['Berlin', 13.4, 52.52, 'de'],
    ['Rome', 12.5, 41.9, 'it'],
    ['Zürich', 8.54, 47.38, 'ch'],
    ['Vienna', 16.37, 48.21, 'generic'],
    ['Tokyo', 139.7, 35.7, 'generic'],
    ['Open ocean', -140, 0, 'generic'],
  ] as const)('resolves %s using country outlines, not architectural envelopes', (_name, lon, lat, id) => {
    for (const scale of [1, 0.67]) {
      const signs = createEarthRoadSigns({ catalog, atlas }, scale);
      const [x, z] = wgs84ToWorld(scale, lon, lat);
      expect(signs.profileAt(x, z).id).toBe(id);
      expect(signs.profileAt(x, z)).toBe(signs.profileAt(x, z));
    }
  });
  it('loads sign content without architectural styles, fonts or model downloads', async () => {
    const readJson = vi.fn(json),
      readBytes = vi.fn();
    const pack = {
      manifest: {
        id: 'molen.earth',
        version: '1.0.0',
        provides: {
          'road-signs': ['signs/catalog.json'],
          'road-sign-profiles': ['signs/us-states.json'],
          'route-shields': ['signs/route-shields.json'],
          'road-sign-regions': ['signs/regions.atlas.json'],
        },
      },
      readJson,
      readBytes,
    } as unknown as Pack;
    const content = await loadEarthContent([pack], { stylePack: false });
    expect(content.roadSigns?.catalog.profiles).toHaveLength(57);
    expect(Object.keys(content.roadSigns?.shields?.shields ?? {})).toHaveLength(50);
    expect(readJson.mock.calls.map((args) => args[0])).toEqual([
      'signs/us-states.json',
      'signs/catalog.json',
      'signs/route-shields.json',
      'signs/regions.atlas.json',
    ]);
    expect(readBytes).not.toHaveBeenCalled();
    if (!content.roadSigns) throw new Error('Missing sign content');
    expect(createEarthRoadSigns(content.roadSigns, 1).profileForCountry('gb').drivingSide).toBe(
      'left',
    );
  });
  it('binds all state profiles while retaining country lookup and neutral fallback', () => {
    const signs = createEarthRoadSigns({ catalog, atlas }, 1);
    expect(atlas.regions.filter((r) => r.id.startsWith('us-'))).toHaveLength(50);
    for (const profile of catalog.profiles.filter((p) => p.stateNetwork))
      expect(signs.profileForSubdivision(profile.subdivisions?.[0]).id).toBe(profile.id);
    expect(signs.profileForCountry('us').id).toBe('us');
    expect(signs.profileForSubdivision('US-DC').id).toBe('us');
    expect(signs.profileForSubdivision('CA-BC').id).toBe('generic');
    const old = createEarthRoadSigns({ catalog: terrainRoadSignCatalogSchema.parse(base) }, 1);
    expect(old.profileForCountry('us').id).toBe('us');
  });
  it('rejects ambiguous bindings and invalid styles, with an explicit unclassified fallback', () => {
    expect(() =>
      terrainRoadSignCatalogSchema.parse({
        ...catalog,
        profiles: [...catalog.profiles, catalog.profiles[0]],
      }),
    ).toThrow();
    expect(() => terrainRoadSignCatalogSchema.parse({ ...catalog, fallback: 'missing' })).toThrow();
    const region = atlas.regions[0];
    if (!region) throw new Error('Missing country outline');
    expect(() =>
      createEarthRoadSigns(
        { catalog, atlas: { ...atlas, regions: [{ ...region, id: 'unknown' }] } },
        1,
      ),
    ).toThrow('Unbound');
    expect(() => createEarthRoadSigns({ catalog }, 0)).toThrow('scale');
    expect(createEarthRoadSigns({ catalog }, 1).profileAt(0, 0).id).toBe('generic');
  });
});

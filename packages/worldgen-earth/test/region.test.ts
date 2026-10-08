import { getSchema, validateByKind } from '@bendyline/molen-schema';
import { webMercatorScaleAtLatitude, wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { createRegionResolver, regionScatterId, regionStyleRules } from '../src/kernel/region';
import { REGION_ATLAS_EXAMPLE } from '../src/kernel/region-atlas-schema';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const atlas = await loadDefaultAtlas();
const pack = await loadDefaultPack();
const metersPerUnit = webMercatorScaleAtLatitude(47.6);
const resolver = createRegionResolver(atlas, { metersPerUnit });

function world(lon: number, lat: number): [number, number] {
  const [x, z] = wgs84ToWebMercator(lon, lat);
  return [x * metersPerUnit, z * metersPerUnit];
}

describe('region atlas', () => {
  it('bounds regional and fallback tree fill factors to zero through one', () => {
    for (const fill of [-0.1, 1.1]) {
      const invalidDefault = structuredClone(atlas);
      invalidDefault.default.treeFillFactor = fill;
      expect(validateByKind('region-atlas' as never, invalidDefault).ok).toBe(false);
      const invalidRegion = structuredClone(atlas);
      const first = invalidRegion.regions[0];
      if (first) first.bindings.treeFillFactor = fill;
      expect(validateByKind('region-atlas' as never, invalidRegion).ok).toBe(false);
    }
  });

  it('registers with a valid example and validates the shipped atlas', () => {
    expect(getSchema('region-atlas')).toBeDefined();
    expect(validateByKind('region-atlas' as never, REGION_ATLAS_EXAMPLE).ok).toBe(true);
    const styleIds = new Set(Object.keys(pack.archstyles));
    const scatterIds = new Set(Object.keys(pack.scatters));
    expect(atlas.regions).toHaveLength(53);
    for (const region of atlas.regions) {
      for (const rule of region.bindings.buildings) {
        expect(styleIds.has(rule.style), rule.style).toBe(true);
        for (const variant of rule.variants ?? [])
          expect(styleIds.has(variant.style), `${region.id}: ${variant.style}`).toBe(true);
      }
      if (region.bindings.default !== undefined)
        expect(styleIds.has(region.bindings.default)).toBe(true);
      if (region.bindings.scatter !== undefined)
        expect(scatterIds.has(region.bindings.scatter)).toBe(true);
    }
    for (const rule of atlas.default.buildings) {
      expect(styleIds.has(rule.style), rule.style).toBe(true);
      for (const variant of rule.variants ?? []) expect(styleIds.has(variant.style)).toBe(true);
    }
    if (atlas.default.scatter !== undefined)
      expect(scatterIds.has(atlas.default.scatter)).toBe(true);
  });

  it('reports geometry and id problems', () => {
    const broken = structuredClone(REGION_ATLAS_EXAMPLE) as Record<string, unknown> & {
      regions: Array<Record<string, unknown>>;
    };
    broken.regions.push({ id: 'us.pnw', priority: 1, bindings: { buildings: [] } });
    broken.regions.push({ id: 'bad', bbox: [10, 20, 5, 95], bindings: { buildings: [] } });
    const result = validateByKind('region-atlas' as never, broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('duplicate_region_id');
    expect(codes).toContain('region_geometry_missing');
    expect(codes).toContain('bbox_order');
    expect(codes).toContain('lonlat_range');
  });

  it('resolves regions by bbox, polygon, and priority in projected meters', () => {
    expect(resolver.resolve(...world(-122.3, 47.6))?.id).toBe('us.pnw');
    expect(resolver.resolve(...world(-105.9, 35.7))?.id).toBe('us.southwest');
    expect(resolver.resolve(...world(139.7, 35.7))?.id).toBe('jp');
    expect(resolver.resolve(...world(2.35, 48.85))?.id).toBe('library.france');
    expect(resolver.resolve(...world(-30, 0))).toBeUndefined();
    const seattle = world(-122.3, 47.6);
    expect(
      resolver
        .intersecting([seattle[0] - 10, seattle[1] - 10, seattle[0] + 10, seattle[1] + 10])
        .map((region) => region.id),
    ).toEqual(['us.pnw', 'library.north_america']);
    const paris = world(2.35, 48.85);
    expect(
      resolver
        .intersecting([paris[0] - 10, paris[1] - 10, paris[0] + 10, paris[1] + 10])
        .map((region) => region.id),
    ).toEqual(['library.france']);
  });

  it.each([
    [151.2, -33.87, 'library.australia'],
    [174.76, -36.85, 'library.new_zealand'],
    [-73.99, 40.73, 'library.north_america'],
    [-43.2, -22.9, 'library.brazil'],
    [-7.98, 31.63, 'library.maghreb'],
    [18.42, -33.92, 'library.south_africa'],
    [126.98, 37.56, 'library.korea'],
    [121.56, 25.03, 'library.taiwan'],
    [100.5, 13.75, 'library.mainland_southeast_asia'],
    [8.54, 47.38, 'library.alps'],
    [16.37, 48.21, 'library.alps'],
    [19.04, 47.5, 'library.eastern_europe'],
    [30.31, 59.94, 'library.russia'],
    [37.62, 55.75, 'library.russia'],
    [76.89, 43.24, 'library.central_asia'],
    [31.24, 30.04, 'library.nile'],
    [15.3, -4.32, 'library.central_africa'],
    [-58.38, -34.6, 'library.southern_south_america'],
    [-84.08, 9.93, 'library.central_america'],
    [103.82, 1.35, 'library.maritime_southeast_asia'],
    [147.18, -9.48, 'library.melanesia'],
    [-171.76, -13.83, 'library.pacific'],
    [-179.9, -16.5, 'library.fiji'],
  ] as const)('chooses the appropriate regional precedent at %s,%s', (lon, lat, id) => {
    expect(resolver.resolve(...world(lon, lat))?.id).toBe(id);
  });

  it('uses nearest outlines only in small uncovered gaps, keeping containment authoritative', () => {
    const r = createRegionResolver(
      {
        format: 'molen/region-atlas@1',
        id: 'test.coast',
        title: 'Coarse coast',
        version: 1,
        fallbackDistanceMeters: 1000,
        default: { buildings: [] },
        regions: [
          {
            id: 'west',
            priority: 10,
            polygons: [
              [
                [-1, -1],
                [0, -1],
                [0, 1],
                [-1, 1],
              ],
            ],
            bindings: { buildings: [] },
          },
          {
            id: 'east',
            priority: 0,
            polygons: [
              [
                [0.002, -1],
                [1, -1],
                [1, 1],
                [0.002, 1],
              ],
            ],
            bindings: { buildings: [] },
          },
        ],
      },
      { metersPerUnit: 1 },
    );
    expect(r.resolve(50, 0)?.id).toBe('west');
    expect(r.resolve(250, 0)?.id).toBe('east');
    expect(r.resolve(300_000, 0)).toBeUndefined();
    expect(r.intersecting([50, -1, 51, 1]).map((entry) => entry.id)).toContain('west');
  });

  it('builds the rule chain and scatter binding for a region', () => {
    const pnw = resolver.resolve(...world(-122.3, 47.6));
    const rules = regionStyleRules(atlas, pnw);
    expect(rules.length).toBeGreaterThan(atlas.default.buildings.length);
    expect(rules[0]?.style).toBe('molen.worldgen.pnw.house');
    expect(regionScatterId(atlas, pnw)).toBe('molen.worldgen.scatter.pnw');
    expect(regionScatterId(atlas, undefined)).toBe(atlas.default.scatter);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_REGION,
  regionPackagePath,
  regionUrl,
  selectedRegion,
  WORLD_REGIONS,
} from './regions.js';

describe('world region navigation', () => {
  it('keeps Seattle as the default and rejects unknown region links', () => {
    expect(selectedRegion(new URLSearchParams())).toBe(DEFAULT_WORLD_REGION);
    expect(() => selectedRegion(new URLSearchParams('region=typo'))).toThrow('Unknown region');
  });

  it.each(WORLD_REGIONS)('opens $label inside its terrain coverage', (region) => {
    const url = regionUrl(new URL('https://molen.dev/play/world-explorer/'), region);
    expect(selectedRegion(url.searchParams)).toBe(region);
    const [west, south, east, north] = region.coverageBounds;
    expect(region.longitude).toBeGreaterThan(west);
    expect(region.longitude).toBeLessThan(east);
    expect(region.latitude).toBeGreaterThan(south);
    expect(region.latitude).toBeLessThan(north);
  });

  it('clears stale location and vehicle overrides without losing display preferences', () => {
    const current = new URL(
      'https://molen.dev/play/world-explorer/?package=qualla&synthetic=1&lat=47&lon=-122' +
        '&alt=10&yaw=1&pitch=0&level=22&diorama=football&navigation=walk&aircraft=oh6&boat=1' +
        '&backend=webgl&quality=economy&weather=rain',
    );
    const region = selectedRegion(new URLSearchParams('region=sydney'));
    if (!region) throw new Error('Missing Sydney region');
    const next = regionUrl(current, region);
    expect(next.pathname).toBe('/play/world-explorer/');
    expect(Object.fromEntries(next.searchParams)).toEqual({
      backend: 'webgl',
      quality: 'economy',
      weather: 'rain',
      region: 'sydney',
    });
    expect(current.searchParams.get('package')).toBe('qualla');
  });

  it('honors synthetic and custom package overrides over a region parameter', () => {
    expect(selectedRegion(new URLSearchParams('region=kyoto&synthetic=1'))).toBeUndefined();
    expect(selectedRegion(new URLSearchParams('region=kyoto&package=qualla'))).toBeUndefined();
    expect(
      selectedRegion(
        new URLSearchParams({ region: 'kyoto', package: regionPackagePath(DEFAULT_WORLD_REGION) }),
      ),
    ).toBe(DEFAULT_WORLD_REGION);
  });
});

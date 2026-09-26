import { describe, expect, it } from 'vitest';
import { earthCredits, formatEarthCredits } from '../src/client/attribution';
import { EARTH_PACK_IDS, loadEarthContent } from '../src/client/content';
import {
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
} from '../src/client/performance';

describe('earth credits', () => {
  it('puts OpenStreetMap first, links it, and shortens labels to the credited party', () => {
    const credits = earthCredits([
      {
        text: 'Mapzen Terrain Tiles; USGS 3DEP and SRTM',
        license: 'Public domain',
        licenseUrl: 'https://example.test/joerd',
      },
      { text: '© OpenStreetMap contributors; Protomaps Basemap', license: 'ODbL-1.0' },
    ]);
    expect(credits.map((credit) => credit.label)).toEqual([
      '© OpenStreetMap contributors',
      'Mapzen Terrain Tiles',
    ]);
    expect(credits[0]?.url).toBe('https://www.openstreetmap.org/copyright');
    expect(credits[1]?.url).toBe('https://example.test/joerd');
    expect(formatEarthCredits(credits)).toBe('© OpenStreetMap contributors · Mapzen Terrain Tiles');
  });
});

describe('earth performance tiers', () => {
  it('grows budgets with level and maps presets to levels', () => {
    const low = earthPerformanceTier(0);
    const high = earthPerformanceTier(5);
    expect(high.terrain.viewDistance).toBeGreaterThan(low.terrain.viewDistance);
    expect(high.terrain.maxResidentTiles).toBeGreaterThan(low.terrain.maxResidentTiles);
    expect(earthPerformanceTier(99).name).toBe(high.name);
    expect([
      earthQualityLevel('economy'),
      earthQualityLevel('balanced'),
      earthQualityLevel('high'),
    ]).toEqual([1, 3, 5]);
  });

  it('caps total pixels as well as the device ratio', () => {
    expect(earthPixelRatio(3, 400, 300, 3)).toBe(2);
    // A 4K canvas at level 0 is held to the level's pixel budget.
    const ratio = earthPixelRatio(0, 3840, 2160, 2);
    expect(3840 * 2160 * ratio * ratio).toBeLessThanOrEqual(earthPerformanceTier(0).maxPixels + 1);
  });
});

describe('earth content', () => {
  it('turns features off rather than failing when packs are missing', async () => {
    const bare = await loadEarthContent([], { stylePack: false });
    expect(bare.types).toBeUndefined();
    expect(bare.worldgen).toBeUndefined();
    expect(bare.worldgenError).toBeUndefined();
    expect(bare.parkedVehicles).toEqual([]);
    expect(await bare.stars()).toEqual([]);

    const styled = await loadEarthContent([]);
    expect(styled.worldgen).toBeUndefined();
    expect(styled.worldgenError).toContain(EARTH_PACK_IDS.style);
  });
});

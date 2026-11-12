import { snowCoverAt } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { WORLD_REGIONS } from './regions.js';
import { snowCoverChoice } from './snow-level.js';

describe('snow level choices', () => {
  it('reads a snow line in meters, everywhere, or none', () => {
    expect(snowCoverChoice('1500')).toEqual({ level: 1500 });
    expect(snowCoverChoice('0')).toEqual({ level: 0 });
    for (const value of ['off', '', ' ', 'deep', '99999', '-2000', 'NaN'])
      expect(snowCoverChoice(value), value).toBeUndefined();
    // Everywhere: the waterfront is covered too, and the hills lie deeper.
    const all = snowCoverChoice('all');
    expect(snowCoverAt(all, 0).coverage).toBe(1);
    expect(snowCoverAt(all, 0).depth).toBeCloseTo(0.19, 6);
    expect(snowCoverAt(all, 1000).depth).toBeGreaterThan(0.5);
  });

  it('opens Seattle with snow on Mount Rainier and the high Cascades, and no other region', () => {
    for (const region of WORLD_REGIONS) {
      if (region.snowLevel === undefined) continue;
      expect(region.id).toBe('seattle-bellevue-sammamish');
      const cover = snowCoverChoice(String(region.snowLevel));
      // Sea level streets are bare; the summit (4,392 m) is under more than a meter.
      expect(snowCoverAt(cover, 50).coverage).toBe(0);
      expect(snowCoverAt(cover, 4392).depth).toBeGreaterThan(1);
    }
    // The Seattle package reaches the mountain: its summit and Paradise are inside the coverage,
    // and inside the detail window that carries their fine elevation.
    const seattle = WORLD_REGIONS[0];
    const inside = (bounds: readonly number[], longitude: number, latitude: number): boolean =>
      longitude > (bounds[0] as number) &&
      latitude > (bounds[1] as number) &&
      longitude < (bounds[2] as number) &&
      latitude < (bounds[3] as number);
    const rainier = seattle?.detailWindows?.find((window) => window.id === 'mount-rainier');
    for (const [longitude, latitude] of [
      [-121.7603, 46.8523],
      [-121.7355, 46.7862],
    ] as const) {
      expect(inside(seattle?.coverageBounds ?? [], longitude, latitude)).toBe(true);
      expect(inside(rainier?.bounds ?? [], longitude, latitude)).toBe(true);
    }
  });
});

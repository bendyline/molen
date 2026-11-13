import type { SnowCoverData } from '@bendyline/molen-schema';
import { describe, expect, it, vi } from 'vitest';
import { createSnowPace } from '../src/client/snow';

describe('walking pace through lying snow', () => {
  it('is full on bare ground, slower the deeper the snow, and eased on a ploughed road', () => {
    let cover: SnowCoverData | undefined;
    const surfaceAt = vi.fn((x: number): string | undefined => (x < 0 ? 'asphalt' : 'grass'));
    const pace = createSnowPace({ snowCover: () => cover, surfaceAt });
    // No snow anywhere: nothing is asked of the map.
    expect(pace(50, 400, 0)).toBe(1);
    expect(surfaceAt).not.toHaveBeenCalled();
    cover = { level: 1000 };
    // Below the line the ground is bare.
    expect(pace(50, 400, 0)).toBe(1);
    expect(surfaceAt).not.toHaveBeenCalled();
    // 1,900 m: 0.6 m of snow on open ground, 0.18 m left on the road.
    const field = pace(50, 1900, 0);
    const road = pace(-50, 1900, 0);
    expect(field).toBeCloseTo(0.4, 6);
    expect(road).toBeGreaterThan(0.85);
    expect(road).toBeLessThan(1);
    // Unmapped ground keeps the whole depth.
    expect(createSnowPace({ snowCover: () => cover })(0, 1900, 0)).toBeCloseTo(0.4, 6);
    // A change of weather applies on the next step.
    cover = undefined;
    expect(pace(50, 1900, 0)).toBe(1);
  });

  it('remembers the ground under the walker instead of asking the map every step', () => {
    const surfaceAt = vi.fn(() => 'grass');
    const pace = createSnowPace({ snowCover: () => ({ level: 0 }), surfaceAt });
    for (let i = 0; i < 240; i++) pace(10.2 + i * 0.001, 500, 3.1);
    expect(surfaceAt).toHaveBeenCalledTimes(1);
    pace(14.5, 500, 3.1);
    expect(surfaceAt).toHaveBeenCalledTimes(2);
  });
});

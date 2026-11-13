import { describe, expect, it } from 'vitest';
import { projectWgs84 } from '../src/kernel/projection';
import { alpineTreeline } from '../src/kernel/treeline';

describe('alpine tree line', () => {
  it('falls from the tropics toward the poles and stands lower in the south', () => {
    const at = (latitude: number, scale = 1): number =>
      alpineTreeline(scale)(projectWgs84(0, latitude)[1] * scale);
    for (const latitude of [-20, 0, 20]) expect(at(latitude)).toBe(3900);
    // Mount Rainier: forest gives out a little above 2,200 m.
    expect(at(46.85)).toBeGreaterThan(2150);
    expect(at(46.85)).toBeLessThan(2350);
    expect(at(45)).toBeCloseTo(2400, 6);
    expect(at(65)).toBeCloseTo(800, 6);
    expect(at(85)).toBe(400);
    // The Southern Alps of New Zealand at the latitude of the Alps.
    expect(at(-45)).toBeCloseTo(1300, 6);
    expect(at(-45)).toBeLessThan(at(45) * 0.6);
    // Monotonic away from the equator in both hemispheres.
    for (const sign of [1, -1])
      for (let latitude = 0; latitude < 84; latitude += 2)
        expect(at(sign * (latitude + 2))).toBeLessThanOrEqual(at(sign * latitude));
    // World Z is scaled by the frame's meters per unit; the answer is in meters either way.
    expect(at(46.85, 0.68)).toBeCloseTo(at(46.85), 6);
  });
});

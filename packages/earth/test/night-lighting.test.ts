import { expect, it } from 'vitest';
import { earthNightFactor } from '../src/client/look';

it('fades lights through civil dusk and reverses the same way at dawn', () => {
  expect([-90, -6, -2, 2, 90].map(earthNightFactor)).toEqual([1, 1, 0.5, 0, 0]);
  for (let altitude = -6; altitude < 2; altitude += 0.1)
    expect(earthNightFactor(altitude)).toBeGreaterThanOrEqual(earthNightFactor(altitude + 0.1));
  expect(() => earthNightFactor(NaN)).toThrow();
});

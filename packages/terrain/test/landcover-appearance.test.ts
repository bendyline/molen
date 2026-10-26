import { describe, expect, it } from 'vitest';
import { crispLandcover, landcoverAppearance, orderLandcover } from '../src/landcover-appearance';
import type { TerrainLandcoverFeature } from '../src/semantic-types';

const feature = (id: string, size: number, subclass?: string): TerrainLandcoverFeature => ({
  id,
  class: id,
  subclass,
  polygons: [
    {
      outer: [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
      ],
    },
  ],
});
describe('aerial land-cover precedence', () => {
  it('keeps garden and gravel courts above broad urban use regardless of source order', () => {
    const city = feature('urban_area', 1),
      garden = feature('park', 0.4, 'garden'),
      court = feature('landuse', 0.1, 'courtyard');
    for (const input of [
      [city, garden, court],
      [court, garden, city],
    ]) {
      expect(orderLandcover(input)).toEqual([city, garden, court]);
      expect(input).not.toBe(orderLandcover(input));
    }
    expect(landcoverAppearance(court)).toBe('gravel');
    expect(landcoverAppearance(garden)).toBe('garden');
  });
  it('does not blend pavement, fields or courts into neighboring natural cover', () => {
    for (const id of ['farmland', 'gravel', 'parking', 'pavement'])
      expect(crispLandcover(feature(id, 1))).toBe(true);
    expect(crispLandcover(feature('forest', 1))).toBe(false);
  });
});

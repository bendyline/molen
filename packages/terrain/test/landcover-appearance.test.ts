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
  it('keeps mown and raked golf ground on a line, over the course it lies on', () => {
    const course = feature('golf_course', 1),
      fairway = feature('golf_fairway', 0.5),
      green = feature('golf_green', 0.1),
      bunker = feature('golf_bunker', 0.05);
    for (const cut of [fairway, green, bunker, feature('golf_tee', 0.02)])
      expect(crispLandcover(cut)).toBe(true);
    // The rough is the course's own grass and keeps its soft edge.
    expect(landcoverAppearance(course)).toBe('grass');
    expect(crispLandcover(course)).toBe(false);
    expect(orderLandcover([bunker, green, fairway, course])).toEqual([
      course,
      fairway,
      green,
      bunker,
    ]);
  });
  it('edges courts, infields and painted lines, each over the larger ground it lies on', () => {
    const turf = feature('sports_turf', 1),
      skin = feature('sports_dirt', 0.4),
      line = feature('sports_line', 0.01);
    for (const patch of [
      turf,
      skin,
      line,
      feature('sports_court', 0.2),
      feature('sports_blacktop', 0.2),
    ])
      expect(crispLandcover(patch)).toBe(true);
    expect(orderLandcover([line, skin, turf])).toEqual([turf, skin, line]);
  });
});

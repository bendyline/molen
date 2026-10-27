import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { districtLevels, withDistrictLevels } from '../src/kernel/district-heights';

/** A square footprint `side` tile units across with its lower corner at (u, v). */
function square(u: number, v: number, side: number): TerrainBuildingFeature['polygons'] {
  return [
    {
      outer: [
        [u, v],
        [u + side, v],
        [u + side, v + side],
        [u, v + side],
      ],
    },
  ];
}

/** A 1,000 m tile with a downtown grid of 30 m blocks on a 40 m pitch. */
function downtown(feature: Partial<TerrainBuildingFeature> = {}) {
  const tile = createEmptyTerrainSemanticTile();
  for (let i = 0; i < 25; i++)
    for (let j = 0; j < 25; j++)
      tile.buildings.push({
        id: i * 25 + j,
        class: 'building',
        subclass: 'commercial',
        polygons: square(i * 0.04, j * 0.04, 0.03),
        ...feature,
      });
  return tile;
}

describe('district height priors', () => {
  it('raises unmeasured commercial blocks in a dense core, deterministically', () => {
    const tile = withDistrictLevels(downtown(), [0, 0], 1000);
    const levels = tile.buildings.map((b) => b.levels);
    expect(levels.every((value) => value !== undefined && value >= 2 && value <= 16)).toBe(true);
    expect(Math.max(...(levels as number[]))).toBeGreaterThan(4);
    expect(withDistrictLevels(downtown(), [0, 0], 1000)).toEqual(tile);
  });

  it('leaves mapped heights, homes, shops and suburbs to their own data and styles', () => {
    for (const feature of [
      { height: 9 },
      { levels: 2 },
      { subclass: 'house' },
      { subclass: 'retail' },
    ])
      expect(withDistrictLevels(downtown(feature), [0, 0], 1000).buildings[0]?.levels).toBe(
        feature.levels,
      );
    const suburb = createEmptyTerrainSemanticTile();
    for (let i = 0; i < 10; i++)
      suburb.buildings.push({ id: i, class: 'building', polygons: square(i * 0.1, 0.5, 0.02) });
    expect(withDistrictLevels(suburb, [0, 0], 1000)).toBe(suburb);
  });

  it('does not count a lone big box as a dense block', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings.push({ id: 1, class: 'building', polygons: square(0.4, 0.4, 0.12) });
    expect(withDistrictLevels(tile, [0, 0], 1000)).toBe(tile);
    expect(districtLevels(['building'], 'residential', 2000, 0.8, 'x')).toBeUndefined();
    expect(districtLevels(['office'], undefined, 2000, 0.8, 'x')).toBeGreaterThan(4);
  });
});

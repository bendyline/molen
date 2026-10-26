import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { coarseBuildingTile } from '../src/kernel/coarse-buildings';

describe('bounded airplane massing', () => {
  it('retains surveyed heights and prioritizes towers without generating details', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = Array.from({ length: 1000 }, (_, id) => ({
      id,
      height: id === 999 ? 210 : 6,
      levels: id === 999 ? 50 : 2,
      polygons: [
        {
          outer: [
            [0, 0],
            [0.01, 0],
            [0.01, 0.01],
            [0, 0.01],
          ],
        },
      ],
    }));
    const result = coarseBuildingTile(tile);
    expect(result.buildings).toHaveLength(256);
    expect(result.buildings[0]).toBe(tile.buildings[999]);
    expect(result.buildings[0]?.height).toBe(210);
    expect(result.transportation).toEqual([]);
    expect(result.pois).toEqual([]);
    expect(coarseBuildingTile(tile)).toEqual(result);
    expect(tile.buildings).toHaveLength(1000);
  });
});

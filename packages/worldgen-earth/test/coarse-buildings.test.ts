import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { coarseBuildingTile } from '../src/kernel/coarse-buildings';
import { MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';

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

  it("keeps a host's building, however small, ahead of everything mapped", () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = Array.from({ length: 400 }, (_, id) => ({
      id,
      height: 30,
      polygons: [
        {
          outer: [
            [0, 0],
            [0.02, 0],
            [0.02, 0.02],
            [0, 0.02],
          ],
        },
      ],
    }));
    // A kiosk a map override placed: by volume the least of the tile, and listed last.
    const kiosk = {
      id: 'override:lot:kiosk',
      levels: 1,
      polygons: [
        {
          outer: [
            [0.5, 0.5],
            [0.501, 0.5],
            [0.501, 0.501],
            [0.5, 0.501],
          ] as [number, number][],
        },
      ],
      tags: { [MAP_OVERRIDE_TAG]: 'lot' },
    };
    tile.buildings.push(kiosk);
    const result = coarseBuildingTile(tile);
    expect(result.buildings).toHaveLength(256);
    expect(result.buildings[0]).toBe(kiosk);
    expect(coarseBuildingTile(tile, 1).buildings).toEqual([kiosk]);
    // Untagged, the same footprint is among the dropped.
    const { tags: _tags, ...mapped } = kiosk;
    tile.buildings[400] = mapped;
    expect(coarseBuildingTile(tile).buildings).not.toContain(mapped);
  });
});

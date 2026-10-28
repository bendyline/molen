import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { createEmptyTerrainSemanticTile, Heightfield } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { gradeStructureApproaches } from '../src/client/structure-approaches';

const context = {
  origin: [0, 0],
  tileSize: 400,
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [0, 0],
    worldSize: [400, 400],
    height: { min: 5, max: 6 },
  }),
} as TerrainPyramidTileLayerContext;

describe('connected authored approach grades', () => {
  it('crosses short way boundaries, retains source polylines, and stops at disconnected/layer/path barriers', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'join',
        class: 'highway',
        lines: [
          [
            [0, 0.5],
            [0.01, 0.5],
          ],
        ],
        bridgeConnections: [{ point: [0, 0.5], elevation: 18, radius: 20 }],
      },
      {
        id: 'continuation',
        class: 'highway',
        lines: [
          [
            [0.01, 0.5],
            [0.04, 0.5],
            [0.8, 0.5],
          ],
        ],
      },
      {
        id: 'nearby',
        class: 'highway',
        lines: [
          [
            [0, 0.501],
            [0.2, 0.501],
          ],
        ],
      },
      {
        id: 'other-layer',
        class: 'highway',
        layer: 1,
        lines: [
          [
            [0.01, 0.5],
            [0.01, 0.8],
          ],
        ],
      },
      {
        id: 'path',
        class: 'path',
        lines: [
          [
            [0.01, 0.5],
            [0.2, 0.6],
          ],
        ],
      },
      {
        id: 'tunnel',
        class: 'highway',
        tunnel: true,
        lines: [
          [
            [0.01, 0.5],
            [0.2, 0.7],
          ],
        ],
      },
      {
        id: 'ferry',
        class: 'ferry',
        lines: [
          [
            [0.01, 0.5],
            [0.2, 0.7],
          ],
        ],
      },
    );
    const before = JSON.stringify(tile),
      result = gradeStructureApproaches(tile, context);
    expect(JSON.stringify(tile)).toBe(before);
    for (let i = 0; i < 2; i++)
      expect(result.transportation[i]?.lines).toBe(tile.transportation[i]?.lines);
    const a = result.transportation[0]?.bridgeApproachProfile ?? [];
    const b = result.transportation[1]?.bridgeApproachProfile ?? [];
    expect(a.at(-1)?.elevation).toBeCloseTo(18);
    expect(b[0]?.elevation).toBeCloseTo(18);
    expect(b.find((p) => p.point[0] === 0.04)?.elevation).toBeCloseTo(18);
    expect(b.at(-1)).toMatchObject({ elevation: 5.32, flatness: 0 });
    for (let i = 2; i < tile.transportation.length; i++)
      expect(result.transportation[i]).toBe(tile.transportation[i]);
  });

  it('does not build profiles for ordinary map tiles without authored connections', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      lines: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    });
    expect(gradeStructureApproaches(tile, context)).toBe(tile);
  });
});

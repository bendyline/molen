import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { renderedGroundSampler } from '../src/rendered-ground';
import { buildTerrainWaterBanks } from '../src/water-shoreline';

describe('mapped water banks', () => {
  const context = {
    origin: [200, 400],
    tileSize: 100,
    heightfield: new Heightfield(new Float32Array([0.2, 0.8, 0.4, 0.9]), 2, 2, {
      origin: [200, 400],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
  } as TerrainPyramidTileLayerContext;
  it('closes outer and island banks against the rendered triangle surface', () => {
    const geometry = buildTerrainWaterBanks(
      [
        {
          polygon: {
            outer: [
              [0.1, 0.2],
              [0.8, 0.1],
              [0.9, 0.8],
              [0.2, 0.9],
            ],
            holes: [
              [
                [0.4, 0.4],
                [0.6, 0.4],
                [0.6, 0.6],
                [0.4, 0.6],
              ],
            ],
          },
          height: 0.5,
        },
      ],
      context,
      0.18,
    );
    expect(geometry).toBeDefined();
    if (!geometry) throw new Error('Expected visible banks');
    const p = geometry.getAttribute('position');
    const sample = renderedGroundSampler(context.heightfield, context.origin, context.tileSize);
    let islandVertices = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        y = p.getY(i);
      if (x >= 40 && x <= 60 && z >= 40 && z <= 60) islandVertices++;
      if (Math.abs(y - 0.45) > 1e-5) expect(y).toBeCloseTo(sample(200 + x, 400 + z) + 0.18, 4);
      expect(Number.isFinite(y)).toBe(true);
    }
    expect(islandVertices).toBeGreaterThan(0);
    geometry.dispose();
  });
  it('does not construct false banks along tile seams or above already submerged terrain', () => {
    const polygon = {
      outer: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as [number, number][],
    };
    expect(buildTerrainWaterBanks([{ polygon, height: 0 }], context, 0)).toBeUndefined();
    expect(
      buildTerrainWaterBanks(
        [
          {
            polygon: {
              outer: [
                [0.2, 0.2],
                [0.8, 0.2],
                [0.8, 0.8],
                [0.2, 0.8],
              ],
            },
            height: 30,
          },
        ],
        context,
        0,
      ),
    ).toBeUndefined();
  });
});

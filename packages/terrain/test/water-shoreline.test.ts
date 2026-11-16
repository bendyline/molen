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
  it('closes the underside of an explicit water stage against lower dry terrain', () => {
    const geometry = buildTerrainWaterBanks(
      [
        {
          polygon: {
            outer: [
              [0, 0.25],
              [0.75, 0.25],
              [0.75, 0.75],
              [0, 0.75],
            ],
          },
          height: 30,
          fixedStage: true,
        },
      ],
      context,
      0.18,
    );
    if (!geometry) throw new Error('Expected banks below the fixed water stage');
    const positions = geometry.getAttribute('position');
    const sample = renderedGroundSampler(context.heightfield, context.origin, context.tileSize);
    let groundVertices = 0;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y === 30) continue;
      expect(y).toBeCloseTo(sample(200 + positions.getX(i), 400 + positions.getZ(i)) - 0.05, 4);
      groundVertices++;
    }
    expect(groundVertices).toBeGreaterThan(0);
    for (let i = 0; i < positions.count; i += 3)
      expect([0, 1, 2].some((j) => positions.getX(i + j) > 0)).toBe(true);
    geometry.dispose();
  });
  it('builds no banks in the buffer that decoded and overzoomed areas carry past the tile', () => {
    // Open water clipped to the tile plus a 1/32 buffer, as decoded tiles carry it: its seams lie
    // outside the ground, where banks once stood as walls in the sea.
    const buffered = {
      outer: [
        [-1 / 32, -1 / 32],
        [1 + 1 / 32, -1 / 32],
        [1 + 1 / 32, 1 + 1 / 32],
        [-1 / 32, 1 + 1 / 32],
      ] as [number, number][],
    };
    expect(buildTerrainWaterBanks([{ polygon: buffered, height: 0 }], context, 0)).toBeUndefined();
    // A shore that runs on past the tile is banked only over the tile's own ground.
    const shore = {
      outer: [
        [-0.1, -0.1],
        [0.5, -0.1],
        [0.5, 1.1],
        [-0.1, 1.1],
      ] as [number, number][],
    };
    const geometry = buildTerrainWaterBanks([{ polygon: shore, height: 0 }], context, 0);
    if (!geometry) throw new Error('Expected the shore inside the tile to be banked');
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      expect(p.getX(i)).toBeCloseTo(50, 6);
      expect(p.getZ(i)).toBeGreaterThanOrEqual(-1e-9);
      expect(p.getZ(i)).toBeLessThanOrEqual(100 + 1e-9);
    }
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(0, 6);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(100, 6);
    geometry.dispose();
  });
  it('keeps a canal mouth open where both polygons share the same water stage', () => {
    const river = {
      outer: [
        [0.1, 0.2],
        [0.9, 0.2],
        [0.9, 0.5],
        [0.6, 0.5],
        [0.4, 0.5],
        [0.1, 0.5],
      ],
    } as const;
    const canal = {
      outer: [
        [0.4, 0.8],
        [0.6, 0.8],
        [0.6, 0.5],
        [0.4, 0.5],
      ],
    } as const;
    const runs = [
      {
        waters: [
          { polygon: river, height: 1 },
          { polygon: canal, height: 1 },
        ],
        hasBank: false,
      },
      {
        waters: [
          { polygon: river, height: 1 },
          { polygon: canal, height: 2 },
        ],
        hasBank: true,
      },
      {
        waters: [
          { polygon: river, height: 1 },
          { polygon: river, height: 1 },
        ],
        hasBank: true,
      },
    ];
    for (const { waters, hasBank } of runs) {
      const geometry = buildTerrainWaterBanks(waters, context, 0);
      if (!geometry) throw new Error('Expected visible outer banks');
      const position = geometry.getAttribute('position');
      let mouthTriangles = 0;
      for (let i = 0; i < position.count; i += 3) {
        if (
          [i, i + 1, i + 2].every(
            (j) => position.getZ(j) === 50 && position.getX(j) >= 40 && position.getX(j) <= 60,
          )
        )
          mouthTriangles++;
      }
      expect(mouthTriangles > 0).toBe(hasBank);
      geometry.dispose();
    }
  });
});

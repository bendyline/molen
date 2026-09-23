import * as THREE from 'three';
import { expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { createTerrainPyramidStream, terrainPyramidBudgetForQuality } from '../src/pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '../src/pyramid-types';

it('recovers ground detail after climbing and descending across the tile cache', async () => {
  const d: TerrainPyramidDescriptor = {
    name: 'flight',
    origin: [-(2 ** 24), -(2 ** 24)],
    rootSize: 2 ** 25,
    minLevel: 8,
    maxLevel: 15,
    tileResolution: 257,
    height: { min: 0, max: 100 },
    layers: [{ name: 'ground', color: '#668855', tiling: 1 }],
    skirts: true,
  };
  const stream = createTerrainPyramidStream(
    d,
    {
      async load(address) {
        const size = terrainPyramidTileSize(d, address.level);
        return new Heightfield(new Float32Array(9), 3, 3, {
          origin: terrainPyramidTileOrigin(d, address),
          worldSize: [size, size],
          height: d.height,
        });
      },
    },
    {
      ...terrainPyramidBudgetForQuality('high'),
      maxSurfaceTileResolution: 3,
      layers: [
        {
          id: 'human',
          category: 'human-feature',
          minLevel: 14,
          async createTile() {
            await new Promise((resolve) => setTimeout(resolve, 0));
            return new THREE.Group();
          },
        },
      ],
    },
  );
  try {
    for (let frame = 0; frame < 160; frame++) {
      const t = frame / 159;
      stream.update({
        position: [512 + 14000 * t, 200 + Math.sin(t * Math.PI) * 12000, 512],
        verticalFov: Math.PI / 3,
        viewportHeight: 1820,
        direction: [Math.sin(t * 8), -0.6, Math.cos(t * 8)],
        aspect: 3022 / 1820,
      });
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    for (const [x, altitude, direction] of [
      [512, 200, 0],
      [512, 12000, 0],
      [8000, 12000, 1],
      [8000, 200, 1],
      [512, 200, 0],
    ] as const) {
      stream.update({
        position: [x, altitude, 512],
        verticalFov: Math.PI / 3,
        viewportHeight: 1820,
        direction: [direction, -0.6, -1],
        aspect: 3022 / 1820,
      });
      await expect
        .poll(
          () => {
            const s = stream.stats();
            return { queued: s.queued, loading: s.loading, layers: s.loadingLayers };
          },
          { timeout: 5000 },
        )
        .toEqual({ queued: 0, loading: 0, layers: 0 });
      await stream.whenIdle();
      if (altitude === 200) expect(stream.stats().maxDisplayedLevel).toBe(15);
    }
  } finally {
    stream.dispose();
  }
}, 30000);

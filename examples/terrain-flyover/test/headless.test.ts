import { buildChunkGeometry } from '@bendyline/molen-terrain/client';
import {
  generateHeightmap,
  generateHeightmapPng,
  heightfieldFromPng,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
// TERRAIN is the validated descriptor (schema defaults applied); importing it also registers
// the terrain schemas and throws if terrain.json is invalid.
import { HEIGHTMAP_SEED, HEIGHTMAP_SIZE, TERRAIN } from '../src/flyover';

describe('terrain flyover headless', () => {
  it('heightmap is deterministic for the demo seed', () => {
    const a = generateHeightmap({
      size: HEIGHTMAP_SIZE,
      seed: HEIGHTMAP_SEED,
      octaves: 6,
      island: true,
    });
    const b = generateHeightmap({
      size: HEIGHTMAP_SIZE,
      seed: HEIGHTMAP_SEED,
      octaves: 6,
      island: true,
    });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('kernel raycast samples terrain heights within range', () => {
    const png = generateHeightmapPng({
      size: HEIGHTMAP_SIZE,
      seed: HEIGHTMAP_SEED,
      octaves: 6,
      island: true,
    });
    const hf = heightfieldFromPng(TERRAIN, png);
    const worldW = TERRAIN.chunkSize * TERRAIN.gridSize[0];
    // Sample a grid of points; every height must be within the declared range.
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const x = (i / 8) * worldW;
        const z = (j / 8) * worldW;
        const h = hf.raycastDown(x, z);
        expect(h).toBeGreaterThanOrEqual(TERRAIN.height.min - 0.001);
        expect(h).toBeLessThanOrEqual(TERRAIN.height.max + 0.001);
      }
    }
    // Island center should be higher than the edge (falloff).
    const center = hf.sampleHeight(worldW / 2, worldW / 2);
    const edge = hf.sampleHeight(2, 2);
    expect(center).toBeGreaterThan(edge);
  });

  it('builds chunk geometry for the whole grid', () => {
    const png = generateHeightmapPng({
      size: HEIGHTMAP_SIZE,
      seed: HEIGHTMAP_SEED,
      octaves: 6,
      island: true,
    });
    const hf = heightfieldFromPng(TERRAIN, png);
    let triangles = 0;
    for (let cz = 0; cz < TERRAIN.gridSize[1]; cz++) {
      for (let cx = 0; cx < TERRAIN.gridSize[0]; cx++) {
        const geo = buildChunkGeometry(hf, TERRAIN, cx, cz, { skirt: true });
        expect(geo.vertexCount).toBeGreaterThan(0);
        triangles += geo.indices.length / 3;
      }
    }
    expect(triangles).toBeGreaterThan(10000);
  });
});

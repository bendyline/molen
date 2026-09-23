import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { TerrainDescriptor } from '../src/descriptor-types';
import { Heightfield } from '../src/heightfield';
import {
  buildChunkGeometry,
  type ChunkGeometry,
  lodStepForDistance,
  type TerrainNeighborHeightSampler,
} from '../src/mesh';
import { registerTerrainSchemas } from '../src/schema';
import { splatColor } from '../src/splat';

registerTerrainSchemas();

function descriptor(over: Partial<Record<string, unknown>> = {}): TerrainDescriptor {
  const r = validate('terrain' as never, {
    format: 'molen/terrain@2',
    name: 't',
    chunkSize: 64,
    tileResolution: 17,
    gridSize: [2, 2],
    height: { min: 0, max: 100 },
    tiles: { heightUrl: 'h.png' },
    layers: [
      { name: 'grass' },
      { name: 'rock', auto: { slopeMin: 0.5 } },
      { name: 'snow', auto: { heightMin: 70 } },
    ],
    ...over,
  });
  if (!r.ok) throw new Error(r.formatted);
  return r.value as TerrainDescriptor;
}

function flatField(d: TerrainDescriptor): Heightfield {
  const cols = d.tileResolution;
  const rows = d.tileResolution;
  return new Heightfield(new Float32Array(cols * rows).fill(0.5), cols, rows, {
    origin: d.origin,
    worldSize: [d.chunkSize * d.gridSize[0], d.chunkSize * d.gridSize[1]],
    height: d.height,
  });
}

describe('lodStepForDistance', () => {
  it('returns finer steps near the camera, coarser far away', () => {
    const d = descriptor({ lod: { levels: 4, distanceBands: [100, 200, 400], skirts: true } });
    expect(lodStepForDistance(d, 50)).toBe(1);
    expect(lodStepForDistance(d, 150)).toBe(2);
    expect(lodStepForDistance(d, 300)).toBe(4);
    expect(lodStepForDistance(d, 9999)).toBe(8);
  });
});

describe('buildChunkGeometry', () => {
  it('produces a full-resolution grid of vertices + triangles', () => {
    const d = descriptor();
    const geo = buildChunkGeometry(flatField(d), d, 0, 0, { step: 1, skirt: false });
    // 17x17 vertices
    expect(geo.vertexCount).toBe(17 * 17);
    // (16*16) quads * 2 triangles * 3 indices
    expect(geo.indices.length).toBe(16 * 16 * 6);
  });

  it('LOD step reduces vertex density', () => {
    const d = descriptor();
    const full = buildChunkGeometry(flatField(d), d, 0, 0, { step: 1, skirt: false });
    const half = buildChunkGeometry(flatField(d), d, 0, 0, { step: 2, skirt: false });
    expect(half.vertexCount).toBeLessThan(full.vertexCount);
    expect(half.vertexCount).toBe(9 * 9);
  });

  it('clamps an excessive direct LOD step to a safe two-vertex edge', () => {
    const d = descriptor({
      tileResolution: 2,
      lod: { levels: 1, distanceBands: [], skirts: false },
    });
    const geo = buildChunkGeometry(flatField(d), d, 0, 0, { step: 1024, skirt: false });
    expect(geo.vertexCount).toBe(4);
    expect(geo.positions.every(Number.isFinite)).toBe(true);
    expect(geo.indices).toHaveLength(6);
  });

  it('places vertices in the chunk world bounds at the right height', () => {
    const d = descriptor();
    const geo = buildChunkGeometry(flatField(d), d, 1, 0, { skirt: false });
    // chunk (1,0) spans x in [64,128]
    expect(geo.positions[0]).toBeCloseTo(64); // first vertex x = chunk origin
    expect(geo.positions[1]).toBeCloseTo(50); // height 0.5 * 100
  });

  it('adds skirt vertices when enabled', () => {
    const d = descriptor();
    const noSkirt = buildChunkGeometry(flatField(d), d, 0, 0, { skirt: false });
    const withSkirt = buildChunkGeometry(flatField(d), d, 0, 0, { skirt: true });
    expect(withSkirt.vertexCount).toBeGreaterThan(noSkirt.vertexCount);
  });
});

describe('splatColor banding', () => {
  const d = descriptor();
  it('low flat ground is grass-green', () => {
    const [r, g, b] = splatColor(d, 10, 0);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
  it('high ground blends in snow (brighter)', () => {
    const low = splatColor(d, 10, 0);
    const high = splatColor(d, 95, 0);
    const lum = (c: [number, number, number]) => c[0] + c[1] + c[2];
    expect(lum(high)).toBeGreaterThan(lum(low));
  });
  it('steep slopes blend in rock', () => {
    const flat = splatColor(d, 40, 0);
    const steep = splatColor(d, 40, 0.9);
    expect(steep).not.toEqual(flat);
  });
  it('lets a fully matching auto band express its authored color', () => {
    const color = splatColor(
      descriptor({
        layers: [
          { name: 'dirt', color: '#403020', tiling: 1 },
          { name: 'grass', color: '#609050', tiling: 1, auto: { heightMin: 0, heightMax: 50 } },
        ],
      }),
      20,
      0,
    );
    expect(color).toEqual([0x60 / 255, 0x90 / 255, 0x50 / 255]);
  });
  it('falls back to a height ramp with no layers', () => {
    const bare = descriptor({ layers: [] });
    const c = splatColor(bare, 50, 0);
    expect(c.every((x) => x >= 0 && x <= 1)).toBe(true);
  });
});

describe('tile border normals', () => {
  const d = descriptor({ chunkSize: 64, tileResolution: 17, gridSize: [2, 1] });
  // A smooth analytic surface, sampled by each tile over its own inclusive bounds. Adjacent
  // tiles therefore hold identical heights along the column they share.
  const surface = (x: number, z: number): number =>
    0.5 + 0.22 * Math.sin(x / 37) * Math.cos(z / 51) + 0.12 * Math.sin((x + z) / 23);

  function tileField(cx: number): Heightfield {
    const res = d.tileResolution;
    const cell = d.chunkSize / (res - 1);
    const ox = d.origin[0] + cx * d.chunkSize;
    const oz = d.origin[1];
    const grid = new Float32Array(res * res);
    for (let r = 0; r < res; r++) {
      for (let c = 0; c < res; c++) grid[r * res + c] = surface(ox + c * cell, oz + r * cell);
    }
    return new Heightfield(grid, res, res, {
      origin: [ox, oz],
      worldSize: [d.chunkSize, d.chunkSize],
      height: d.height,
    });
  }

  const west = tileField(0);
  const east = tileField(1);
  const seamX = d.origin[0] + d.chunkSize;

  // What a streamer supplies: heights from whichever resident tile covers the sample.
  const neighborHeight: TerrainNeighborHeightSampler = (x, z) => {
    const field = x < seamX ? west : east;
    if (
      x < field.origin[0] ||
      x > field.origin[0] + field.worldSize[0] ||
      z < field.origin[1] ||
      z > field.origin[1] + field.worldSize[1]
    ) {
      return undefined;
    }
    return field.sampleHeight(x, z);
  };

  function edgeNormals(geometry: ChunkGeometry, column: number): Array<[number, number, number]> {
    const res = d.tileResolution;
    const rows: Array<[number, number, number]> = [];
    for (let r = 0; r < res; r++) {
      const base = (r * res + column) * 3;
      rows.push([
        geometry.normals[base] as number,
        geometry.normals[base + 1] as number,
        geometry.normals[base + 2] as number,
      ]);
    }
    return rows;
  }

  // Chord form, not acos(dot): near-identical float32 normals make acos numerically unstable.
  const degreesApart = (
    left: Array<[number, number, number]>,
    right: Array<[number, number, number]>,
  ): number => {
    let worst = 0;
    for (const [index, a] of left.entries()) {
      const b = right[index] as [number, number, number];
      const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      worst = Math.max(worst, (2 * Math.asin(Math.min(1, chord / 2)) * 180) / Math.PI);
    }
    return worst;
  };

  it('shares the border heights but not, without an apron, the border normals', () => {
    const westGeometry = buildChunkGeometry(west, d, 0, 0, { skirt: false });
    const eastGeometry = buildChunkGeometry(east, d, 1, 0, { skirt: false });
    for (let r = 0; r < d.tileResolution; r++) {
      const z = d.origin[1] + (r * d.chunkSize) / (d.tileResolution - 1);
      expect(west.sampleHeight(seamX, z)).toBeCloseTo(east.sampleHeight(seamX, z), 10);
    }
    // The regression this guards: one-sided clamped stencils disagree by a visible angle.
    const apart = degreesApart(
      edgeNormals(westGeometry, d.tileResolution - 1),
      edgeNormals(eastGeometry, 0),
    );
    expect(apart).toBeGreaterThan(1);
  });

  it('matches normals along a shared edge when neighbour heights are available', () => {
    const westGeometry = buildChunkGeometry(west, d, 0, 0, { skirt: false, neighborHeight });
    const eastGeometry = buildChunkGeometry(east, d, 1, 0, { skirt: false, neighborHeight });
    const westEdge = edgeNormals(westGeometry, d.tileResolution - 1);
    const eastEdge = edgeNormals(eastGeometry, 0);
    expect(degreesApart(westEdge, eastEdge)).toBe(0);
    for (const [index, normal] of westEdge.entries()) {
      for (const axis of [0, 1, 2]) {
        expect(normal[axis]).toBeCloseTo((eastEdge[index] as number[])[axis] as number, 12);
      }
    }
  });

  it('leaves interior normals exactly as the heightfield reports them', () => {
    const plain = buildChunkGeometry(west, d, 0, 0, { skirt: false });
    const aproned = buildChunkGeometry(west, d, 0, 0, { skirt: false, neighborHeight });
    const res = d.tileResolution;
    for (let r = 1; r < res - 1; r++) {
      for (let c = 1; c < res - 1; c++) {
        const base = (r * res + c) * 3;
        for (const axis of [0, 1, 2]) {
          expect(aproned.normals[base + axis]).toBe(plain.normals[base + axis]);
        }
      }
    }
  });
});

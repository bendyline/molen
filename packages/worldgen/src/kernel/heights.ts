/**
 * A plain height grid and its sampler: the transferable form of ground data for workers and
 * fixtures. Bilinear sampling matches the terrain heightfield formula so in-thread and worker
 * generation agree bit for bit.
 */

import type { HeightSampler, Vec3 } from './types';

export interface HeightGrid {
  cols: number;
  rows: number;
  /** Local coordinate of sample (0, 0). */
  originX: number;
  originZ: number;
  /** Extent covered by the grid, meters. */
  sizeX: number;
  sizeZ: number;
  /** Row-major heights in meters, `cols * rows` entries. */
  heights: Float32Array;
}

export function createHeightSampler(grid: HeightGrid): HeightSampler {
  if (grid.cols < 2 || grid.rows < 2 || grid.heights.length !== grid.cols * grid.rows) {
    throw new Error('height grid needs at least 2x2 samples matching cols * rows');
  }
  const cellX = grid.sizeX / (grid.cols - 1);
  const cellZ = grid.sizeZ / (grid.rows - 1);
  const at = (col: number, row: number): number => {
    const c = col < 0 ? 0 : col >= grid.cols ? grid.cols - 1 : col;
    const r = row < 0 ? 0 : row >= grid.rows ? grid.rows - 1 : row;
    return grid.heights[r * grid.cols + c] as number;
  };
  const sampleHeight = (x: number, z: number): number => {
    const fx = (x - grid.originX) / cellX;
    const fz = (z - grid.originZ) / cellZ;
    const col = Math.floor(fx);
    const row = Math.floor(fz);
    const tx = Math.min(1, Math.max(0, fx - col));
    const tz = Math.min(1, Math.max(0, fz - row));
    const top = at(col, row) + (at(col + 1, row) - at(col, row)) * tx;
    const bottom = at(col, row + 1) + (at(col + 1, row + 1) - at(col, row + 1)) * tx;
    return top + (bottom - top) * tz;
  };
  const normalAt = (x: number, z: number): Vec3 => {
    const dx = (sampleHeight(x + cellX, z) - sampleHeight(x - cellX, z)) / (2 * cellX);
    const dz = (sampleHeight(x, z + cellZ) - sampleHeight(x, z - cellZ)) / (2 * cellZ);
    const length = Math.sqrt(dx * dx + 1 + dz * dz) || 1;
    return [-dx / length, 1 / length, -dz / length];
  };
  return {
    sampleHeight,
    normalAt,
    slopeAt: (x, z) => {
      const normal = normalAt(x, z);
      return 1 - normal[1];
    },
  };
}

/** Sample any ground into a grid (fixtures, worker payloads, tests). */
export function heightGridFromSampler(
  sampler: HeightSampler,
  originX: number,
  originZ: number,
  sizeX: number,
  sizeZ: number,
  cols: number,
  rows: number,
): HeightGrid {
  const heights = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      heights[row * cols + col] = sampler.sampleHeight(
        originX + (sizeX * col) / (cols - 1),
        originZ + (sizeZ * row) / (rows - 1),
      );
    }
  }
  return { cols, rows, originX, originZ, sizeX, sizeZ, heights };
}

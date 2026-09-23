/**
 * Small integer rasters over a local rectangle: label lookups (which polygon covers a point) and
 * exclusion masks (keep clear of roads, water, buildings). Cheap to build once per batch and to
 * query once per placement candidate.
 */

import type { Bounds2 } from './geometry2d';
import type { Vec2 } from './types';

export class RasterGrid {
  readonly cols: number;
  readonly rows: number;
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly data: Uint16Array;

  constructor(bounds: Bounds2, cell: number) {
    if (!(cell > 0) || !Number.isFinite(cell)) throw new Error('raster cell must be positive');
    this.originX = bounds[0];
    this.originZ = bounds[1];
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((bounds[2] - bounds[0]) / cell));
    this.rows = Math.max(1, Math.ceil((bounds[3] - bounds[1]) / cell));
    this.data = new Uint16Array(this.cols * this.rows);
  }

  /** Cell index for a local point, or -1 outside the raster. */
  index(x: number, z: number): number {
    const col = Math.floor((x - this.originX) / this.cell);
    const row = Math.floor((z - this.originZ) / this.cell);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  get(x: number, z: number): number {
    const index = this.index(x, z);
    return index < 0 ? 0 : (this.data[index] as number);
  }

  centreOf(col: number, row: number): Vec2 {
    return [this.originX + (col + 0.5) * this.cell, this.originZ + (row + 0.5) * this.cell];
  }
}

/** Even-odd scanline fill of a polygon (outer ring plus holes) writing `value` into covered cells. */
export function rasterizePolygon(
  raster: RasterGrid,
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
  value: number,
): void {
  const rings = [outer, ...holes].filter((ring) => ring.length >= 3);
  if (rings.length === 0) return;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of outer) {
    minZ = Math.min(minZ, point[1]);
    maxZ = Math.max(maxZ, point[1]);
  }
  const rowStart = Math.max(0, Math.floor((minZ - raster.originZ) / raster.cell));
  const rowEnd = Math.min(raster.rows - 1, Math.floor((maxZ - raster.originZ) / raster.cell));
  const crossings: number[] = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    const z = raster.originZ + (row + 0.5) * raster.cell;
    crossings.length = 0;
    for (const ring of rings) {
      for (let index = 0; index < ring.length; index++) {
        const a = ring[index] as Vec2;
        const b = ring[(index + 1) % ring.length] as Vec2;
        if (a[1] > z === b[1] > z) continue;
        crossings.push(a[0] + ((z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const x0 = crossings[pair] as number;
      const x1 = crossings[pair + 1] as number;
      const colStart = Math.max(0, Math.ceil((x0 - raster.originX) / raster.cell - 0.5));
      const colEnd = Math.min(
        raster.cols - 1,
        Math.floor((x1 - raster.originX) / raster.cell - 0.5),
      );
      for (let col = colStart; col <= colEnd; col++) raster.data[row * raster.cols + col] = value;
    }
  }
}

/** Mark every cell whose centre lies within `halfWidth` of a polyline. */
export function rasterizePolyline(
  raster: RasterGrid,
  points: readonly Vec2[],
  halfWidth: number,
  value: number,
): void {
  for (let index = 0; index + 1 < points.length; index++) {
    const a = points[index] as Vec2;
    const b = points[index + 1] as Vec2;
    const minX = Math.min(a[0], b[0]) - halfWidth;
    const maxX = Math.max(a[0], b[0]) + halfWidth;
    const minZ = Math.min(a[1], b[1]) - halfWidth;
    const maxZ = Math.max(a[1], b[1]) + halfWidth;
    const colStart = Math.max(0, Math.floor((minX - raster.originX) / raster.cell));
    const colEnd = Math.min(raster.cols - 1, Math.floor((maxX - raster.originX) / raster.cell));
    const rowStart = Math.max(0, Math.floor((minZ - raster.originZ) / raster.cell));
    const rowEnd = Math.min(raster.rows - 1, Math.floor((maxZ - raster.originZ) / raster.cell));
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const [cx, cz] = raster.centreOf(col, row);
        let t = lengthSquared > 0 ? ((cx - a[0]) * dx + (cz - a[1]) * dz) / lengthSquared : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = a[0] + dx * t - cx;
        const pz = a[1] + dz * t - cz;
        if (px * px + pz * pz <= halfWidth * halfWidth)
          raster.data[row * raster.cols + col] = value;
      }
    }
  }
}

/** Grow every non-zero cell by `cells` in each direction (separable Chebyshev dilation). */
export function dilate(raster: RasterGrid, cells: number): void {
  if (cells <= 0) return;
  const { cols, rows, data } = raster;
  const pass = new Uint16Array(data.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let value = 0;
      for (let offset = -cells; offset <= cells; offset++) {
        const source = col + offset;
        if (source < 0 || source >= cols) continue;
        const sample = data[row * cols + source] as number;
        if (sample > value) value = sample;
      }
      pass[row * cols + col] = value;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let value = 0;
      for (let offset = -cells; offset <= cells; offset++) {
        const source = row + offset;
        if (source < 0 || source >= rows) continue;
        const sample = pass[source * cols + col] as number;
        if (sample > value) value = sample;
      }
      data[row * cols + col] = value;
    }
  }
}

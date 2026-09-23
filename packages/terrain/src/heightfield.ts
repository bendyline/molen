// Logical heightfield: bilinear height sampling + downward raycast in world coordinates.
// Pure (no PNG, no three.js) so it is unit-testable in Node. The kernel half uses this for
// collision/ground queries; the client uses it for camera clamping.

export interface HeightfieldOptions {
  /** World XZ of the field's (0,0) corner. */
  origin: [number, number];
  /** World size in meters [width(x), depth(z)]. */
  worldSize: [number, number];
  /** Height value range the normalized grid maps onto. */
  height: { min: number; max: number };
}

/** What a physics engine needs to build a heightfield collider from this field. */
export interface HeightfieldCollider {
  nrows: number;
  ncols: number;
  /** Denormalized heights (meters), column-major: heights[col * nrows + row]. */
  heights: Float32Array;
  /** Local x/y/z scale: [worldWidth, 1, worldDepth] (heights already carry meters). */
  scale: [number, number, number];
  /** World position of the field's center (the collider is centered on its local origin). */
  center: [number, number, number];
}

export class Heightfield {
  readonly cols: number;
  readonly rows: number;
  /** World XZ of the field's (0,0) corner. */
  readonly origin: [number, number];
  /** World size in meters [width(x), depth(z)]. */
  readonly worldSize: [number, number];
  /** The height range the normalized grid maps onto. */
  readonly heightRange: { min: number; max: number };
  /** Grid cell size in meters [x, z]; satisfies the kernel's GroundField contract. */
  readonly cellSize: [number, number];
  private readonly hmin: number;
  private readonly hrange: number;

  /** grid holds normalized [0,1] heights, row-major, length = cols*rows. */
  constructor(
    private readonly grid: Float32Array,
    cols: number,
    rows: number,
    opts: HeightfieldOptions,
  ) {
    if (!Number.isSafeInteger(cols) || cols < 2 || !Number.isSafeInteger(rows) || rows < 2) {
      throw new Error(`heightfield dimensions must be safe integers >= 2, got ${cols}x${rows}`);
    }
    if (grid.length !== cols * rows) {
      throw new Error(`heightfield grid length ${grid.length} != ${cols}x${rows}`);
    }
    if (
      !opts.worldSize.every((n) => Number.isFinite(n) && n > 0) ||
      !opts.origin.every(Number.isFinite)
    ) {
      throw new Error(
        'heightfield origin must be finite and worldSize must be finite and positive',
      );
    }
    if (
      !Number.isFinite(opts.height.min) ||
      !Number.isFinite(opts.height.max) ||
      opts.height.min >= opts.height.max
    ) {
      throw new Error('heightfield height.min must be finite and less than height.max');
    }
    for (const value of grid) {
      if (!Number.isFinite(value)) throw new Error('heightfield grid values must be finite');
    }
    this.cols = cols;
    this.rows = rows;
    this.origin = [opts.origin[0], opts.origin[1]];
    this.worldSize = [opts.worldSize[0], opts.worldSize[1]];
    this.heightRange = { min: opts.height.min, max: opts.height.max };
    this.cellSize = [opts.worldSize[0] / (cols - 1), opts.worldSize[1] / (rows - 1)];
    this.hmin = opts.height.min;
    this.hrange = opts.height.max - opts.height.min;
  }

  /**
   * The field as a physics heightfield collider: denormalized meters, transposed to the
   * column-major layout rigid-body engines (Rapier/parry) expect, with the world center so the
   * collider can be placed without an authored offset.
   */
  toRapierHeightfield(): HeightfieldCollider {
    const { cols, rows } = this;
    const heights = new Float32Array(cols * rows);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        heights[c * rows + r] = this.hmin + (this.grid[r * cols + c] as number) * this.hrange;
      }
    }
    return {
      nrows: rows,
      ncols: cols,
      heights,
      scale: [this.worldSize[0], 1, this.worldSize[1]],
      center: [this.origin[0] + this.worldSize[0] / 2, 0, this.origin[1] + this.worldSize[1] / 2],
    };
  }

  private at(c: number, r: number): number {
    const cc = c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
    const rr = r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
    return this.grid[rr * this.cols + cc] as number;
  }

  /** Independent normalized samples for transfer to a worker; the resident field stays intact. */
  copySamples(): Float32Array {
    return this.grid.slice();
  }

  /** Bilinear-sampled terrain height (world Y in meters) at world (x, z). */
  sampleHeight(x: number, z: number): number {
    // Map world coords to grid space [0, cols-1] x [0, rows-1].
    const gx = ((x - this.origin[0]) / this.worldSize[0]) * (this.cols - 1);
    const gz = ((z - this.origin[1]) / this.worldSize[1]) * (this.rows - 1);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const fx = gx - x0;
    const fz = gz - z0;
    const v00 = this.at(x0, z0);
    const v10 = this.at(x0 + 1, z0);
    const v01 = this.at(x0, z0 + 1);
    const v11 = this.at(x0 + 1, z0 + 1);
    const top = v00 + (v10 - v00) * fx;
    const bot = v01 + (v11 - v01) * fx;
    const v = top + (bot - top) * fz;
    return this.hmin + v * this.hrange;
  }

  /** The terrain surface height directly below/above (x, z) — same as sampleHeight for a heightmap. */
  raycastDown(x: number, z: number): number {
    return this.sampleHeight(x, z);
  }

  /** Approximate surface normal at world (x, z) from the height gradient. */
  normalAt(x: number, z: number): [number, number, number] {
    const dx = this.worldSize[0] / (this.cols - 1);
    const dz = this.worldSize[1] / (this.rows - 1);
    const hl = this.sampleHeight(x - dx, z);
    const hr = this.sampleHeight(x + dx, z);
    const hd = this.sampleHeight(x, z - dz);
    const hu = this.sampleHeight(x, z + dz);
    const nx = -(hr - hl) / (2 * dx);
    const nz = -(hu - hd) / (2 * dz);
    const ny = 1;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  /** Slope at (x,z): 0 = flat, 1 = vertical. */
  slopeAt(x: number, z: number): number {
    return 1 - this.normalAt(x, z)[1];
  }
}

// Grid flow-field pathfinding for many-unit (RTS) movement. One Dijkstra integration field per
// goal serves any number of agents — each just samples the field's direction at its position.
// Pure and deterministic (no Math.random, stable tie-breaking).

const SQRT2 = Math.SQRT2;

/**
 * Default ceiling on `cols * rows` (a 2000x2000 grid). Sized off the per-query cost, not off
 * what fits in memory: one `computeFlowField` allocates three `Float32Array`s over every cell
 * (plus heap entries) — about 13 bytes per cell — and runs a full Dijkstra sweep, so 4M cells
 * is roughly 52 MB and a couple of seconds per query on a worker thread.
 */
export const DEFAULT_MAX_CELLS = 4_000_000;

export interface GridOptions {
  cols: number;
  rows: number;
  /** World size of one cell (square). */
  cellSize: number;
  /** World XZ of the (0,0) cell's corner. */
  origin?: [number, number];
  /**
   * Opt-in ceiling on `cols * rows` (default {@link DEFAULT_MAX_CELLS} = 4,000,000). Raise it
   * only after measuring: every {@link computeFlowField} call costs about 13 bytes per cell and
   * a full Dijkstra sweep over the grid, so a 10,000x10,000 grid is ~1.3 GB and minutes of
   * blocked worker per query. Prefer a coarser `cellSize` over a bigger grid.
   */
  maxCells?: number;
}

/**
 * A uniform grid mapping world XZ to cells, with per-cell blocked flags.
 *
 * Cell count is capped ({@link GridOptions.maxCells}, default {@link DEFAULT_MAX_CELLS}) because
 * the grid itself is the cheap part: the Uint8Array of blocked flags is 1 byte per cell, while
 * each flow-field query over it costs about 13 bytes per cell and a full Dijkstra sweep.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly origin: [number, number];
  /** The cell-count ceiling this grid was built under (see {@link GridOptions.maxCells}). */
  readonly maxCells: number;
  private readonly blocked: Uint8Array;

  constructor(opts: GridOptions) {
    if (!Number.isSafeInteger(opts.cols) || opts.cols <= 0) {
      throw new RangeError('grid cols must be a positive safe integer');
    }
    if (!Number.isSafeInteger(opts.rows) || opts.rows <= 0) {
      throw new RangeError('grid rows must be a positive safe integer');
    }
    if (!Number.isFinite(opts.cellSize) || opts.cellSize <= 0) {
      throw new RangeError('grid cellSize must be finite and greater than 0');
    }
    if (
      opts.origin !== undefined &&
      (!Number.isFinite(opts.origin[0]) || !Number.isFinite(opts.origin[1]))
    ) {
      throw new RangeError('grid origin coordinates must be finite');
    }
    if (
      opts.maxCells !== undefined &&
      (!Number.isSafeInteger(opts.maxCells) || opts.maxCells <= 0)
    ) {
      throw new RangeError('grid maxCells must be a positive safe integer');
    }
    const maxCells = opts.maxCells ?? DEFAULT_MAX_CELLS;
    const cellCount = opts.cols * opts.rows;
    if (!Number.isSafeInteger(cellCount)) {
      throw new RangeError(
        `grid is too large: ${opts.cols}x${opts.rows} cells overflows exact integer arithmetic`,
      );
    }
    if (cellCount > maxCells) {
      throw new RangeError(
        `grid is too large: ${opts.cols}x${opts.rows} = ${cellCount} cells exceeds the ${maxCells}-cell limit ` +
          '(each computeFlowField query costs about 13 bytes per cell plus a full Dijkstra sweep). ' +
          'Use a coarser cellSize, or pass maxCells to raise the limit deliberately.',
      );
    }
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.cellSize = opts.cellSize;
    this.origin = opts.origin ?? [0, 0];
    this.maxCells = maxCells;
    this.blocked = new Uint8Array(cellCount);
  }

  index(cx: number, cz: number): number {
    return cz * this.cols + cx;
  }
  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }
  setBlocked(cx: number, cz: number, value = true): void {
    if (this.inBounds(cx, cz)) this.blocked[this.index(cx, cz)] = value ? 1 : 0;
  }
  isBlocked(cx: number, cz: number): boolean {
    return !this.inBounds(cx, cz) || this.blocked[this.index(cx, cz)] === 1;
  }
  /** World XZ → cell coordinates (floored). */
  worldToCell(x: number, z: number): [number, number] {
    return [
      Math.floor((x - this.origin[0]) / this.cellSize),
      Math.floor((z - this.origin[1]) / this.cellSize),
    ];
  }
  /** Cell center in world XZ. */
  cellToWorld(cx: number, cz: number): [number, number] {
    return [
      this.origin[0] + (cx + 0.5) * this.cellSize,
      this.origin[1] + (cz + 0.5) * this.cellSize,
    ];
  }
}

const NEIGHBOURS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** A flow field: per-cell cost-to-goal and a unit direction toward the goal. */
export class FlowField {
  readonly cost: Float32Array;
  readonly dirX: Float32Array;
  readonly dirZ: Float32Array;

  constructor(
    private readonly grid: Grid,
    cost: Float32Array,
    dirX: Float32Array,
    dirZ: Float32Array,
  ) {
    this.cost = cost;
    this.dirX = dirX;
    this.dirZ = dirZ;
  }

  reachable(cx: number, cz: number): boolean {
    return (
      this.grid.inBounds(cx, cz) && this.cost[this.grid.index(cx, cz)] !== Number.POSITIVE_INFINITY
    );
  }

  /** Direction toward the goal at a world position (zero if blocked/unreachable). */
  directionAt(x: number, z: number): [number, number] {
    const [cx, cz] = this.grid.worldToCell(x, z);
    if (!this.grid.inBounds(cx, cz)) return [0, 0];
    const i = this.grid.index(cx, cz);
    return [this.dirX[i] as number, this.dirZ[i] as number];
  }
}

// Minimal binary min-heap of (cost, cellIndex) with deterministic tie-break by index.
class MinHeap {
  private readonly cost: number[] = [];
  private readonly idx: number[] = [];
  get size(): number {
    return this.cost.length;
  }
  push(cost: number, idx: number): void {
    this.cost.push(cost);
    this.idx.push(idx);
    let c = this.cost.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.less(c, p)) {
        this.swap(c, p);
        c = p;
      } else break;
    }
  }
  pop(): number {
    const top = this.idx[0] as number;
    const lastC = this.cost.pop() as number;
    const lastI = this.idx.pop() as number;
    if (this.cost.length > 0) {
      this.cost[0] = lastC;
      this.idx[0] = lastI;
      let c = 0;
      const n = this.cost.length;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < n && this.less(l, m)) m = l;
        if (r < n && this.less(r, m)) m = r;
        if (m === c) break;
        this.swap(c, m);
        c = m;
      }
    }
    return top;
  }
  private less(a: number, b: number): boolean {
    const ca = this.cost[a] as number;
    const cb = this.cost[b] as number;
    return ca < cb || (ca === cb && (this.idx[a] as number) < (this.idx[b] as number));
  }
  private swap(a: number, b: number): void {
    [this.cost[a], this.cost[b]] = [this.cost[b] as number, this.cost[a] as number];
    [this.idx[a], this.idx[b]] = [this.idx[b] as number, this.idx[a] as number];
  }
}

/**
 * Compute a flow field over the grid toward a goal world position (Dijkstra integration).
 *
 * Cost scales with the whole grid, not with the distance walked: three `Float32Array`s over
 * every cell plus heap entries — about 13 bytes per cell — and one Dijkstra sweep of every
 * passable cell. Budget roughly 12 MB and ~1 s per query per million cells, and reuse one field
 * for every agent heading to the same goal (that is the point of a flow field).
 */
export function computeFlowField(grid: Grid, goal: [number, number]): FlowField {
  const n = grid.cols * grid.rows;
  const cost = new Float32Array(n).fill(Number.POSITIVE_INFINITY);
  const dirX = new Float32Array(n);
  const dirZ = new Float32Array(n);
  const [gx, gz] = grid.worldToCell(goal[0], goal[1]);
  if (!grid.inBounds(gx, gz) || grid.isBlocked(gx, gz)) {
    return new FlowField(grid, cost, dirX, dirZ);
  }

  // Dijkstra outward from the goal over passable cells.
  const heap = new MinHeap();
  const gi = grid.index(gx, gz);
  cost[gi] = 0;
  heap.push(0, gi);
  while (heap.size > 0) {
    const i = heap.pop();
    const cz = Math.floor(i / grid.cols);
    const cx = i - cz * grid.cols;
    const base = cost[i] as number;
    for (const [dx, dz, w] of NEIGHBOURS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (grid.isBlocked(nx, nz)) continue;
      // Prevent diagonal corner-cutting through blocked orthogonal cells.
      if (dx !== 0 && dz !== 0 && (grid.isBlocked(cx + dx, cz) || grid.isBlocked(cx, cz + dz)))
        continue;
      const ni = grid.index(nx, nz);
      const nc = base + w * grid.cellSize;
      if (nc < (cost[ni] as number)) {
        cost[ni] = nc;
        heap.push(nc, ni);
      }
    }
  }

  // Direction at each cell = toward the lowest-cost passable neighbour.
  for (let cz = 0; cz < grid.rows; cz++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      const i = grid.index(cx, cz);
      if (cost[i] === Number.POSITIVE_INFINITY) continue;
      let bestCost = cost[i] as number;
      let bx = 0;
      let bz = 0;
      for (const [dx, dz] of NEIGHBOURS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (grid.isBlocked(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (grid.isBlocked(cx + dx, cz) || grid.isBlocked(cx, cz + dz)))
          continue;
        const c = cost[grid.index(nx, nz)] as number;
        if (c < bestCost) {
          bestCost = c;
          bx = dx;
          bz = dz;
        }
      }
      const len = Math.sqrt(bx * bx + bz * bz);
      if (len > 0) {
        dirX[i] = bx / len;
        dirZ[i] = bz / len;
      }
    }
  }
  return new FlowField(grid, cost, dirX, dirZ);
}

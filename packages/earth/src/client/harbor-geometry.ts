/**
 * Plane geometry for harbors.ts: polygon membership through row buckets of edges, scanline fills
 * into a cell grid, and a seeded hash anchored to world positions. Coordinates are absolute world
 * X/Z meters throughout; rings are flat `[x0, z0, x1, z1, ...]` arrays, closed implicitly.
 */

export type HarborRing = Float64Array;

/** A mixing hash of a world position (quantized to 0.25 m) and a salt, in [0, 1). */
export function harborHash(x: number, z: number, salt: number): number {
  let h =
    Math.imul(Math.round(x * 4) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 4) | 0, 0x165667b1);
  h ^= Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Signed area of a ring (positive when it turns counterclockwise in X/Z). */
export function harborRingArea(ring: HarborRing): number {
  let sum = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++)
    sum +=
      (ring[j * 2] as number) * (ring[i * 2 + 1] as number) -
      (ring[i * 2] as number) * (ring[j * 2 + 1] as number);
  return sum / 2;
}

/** Perimeter of a ring, meters. */
export function harborRingPerimeter(ring: HarborRing): number {
  let sum = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++)
    sum += Math.hypot(
      (ring[i * 2] as number) - (ring[j * 2] as number),
      (ring[i * 2 + 1] as number) - (ring[j * 2 + 1] as number),
    );
  return sum;
}

/**
 * One polygon (outer ring and holes, even-odd) with its edges bucketed by rows of Z, so a
 * membership test walks only the edges spanning the point's row: a lake's ring of thousands of
 * points answers in tens of edge tests.
 */
export class HarborPolygon {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
  /** Edges as [ax, az, bx, bz] quadruples. */
  private readonly edges: Float64Array;
  private readonly rowHeight: number;
  private readonly rows: number;
  private readonly rowStart: Uint32Array;
  private readonly rowEdges: Uint32Array;

  constructor(readonly rings: readonly HarborRing[]) {
    let count = 0;
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const ring of rings) {
      count += ring.length / 2;
      for (let i = 0; i < ring.length; i += 2) {
        const x = ring[i] as number;
        const z = ring[i + 1] as number;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    this.minX = minX;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxZ = maxZ;
    const edges = new Float64Array(count * 4);
    let e = 0;
    for (const ring of rings) {
      const n = ring.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        edges[e++] = ring[j * 2] as number;
        edges[e++] = ring[j * 2 + 1] as number;
        edges[e++] = ring[i * 2] as number;
        edges[e++] = ring[i * 2 + 1] as number;
      }
    }
    this.edges = edges;
    const rows = Math.max(1, Math.min(512, Math.ceil(count / 6)));
    this.rows = rows;
    this.rowHeight = Math.max(1e-6, (maxZ - minZ) / rows);
    const counts = new Uint32Array(rows + 1);
    const span = (k: number): [number, number] => {
      const a = edges[k * 4 + 1] as number;
      const b = edges[k * 4 + 3] as number;
      return [this.row(Math.min(a, b)), this.row(Math.max(a, b))];
    };
    for (let k = 0; k < count; k++) {
      const [r0, r1] = span(k);
      for (let r = r0; r <= r1; r++) counts[r + 1] = (counts[r + 1] as number) + 1;
    }
    for (let r = 0; r < rows; r++)
      counts[r + 1] = (counts[r + 1] as number) + (counts[r] as number);
    this.rowStart = counts;
    const rowEdges = new Uint32Array(counts[rows] as number);
    const fill = counts.slice(0, rows);
    for (let k = 0; k < count; k++) {
      const [r0, r1] = span(k);
      for (let r = r0; r <= r1; r++) {
        rowEdges[fill[r] as number] = k;
        fill[r] = (fill[r] as number) + 1;
      }
    }
    this.rowEdges = rowEdges;
  }

  private row(z: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / this.rowHeight)));
  }

  contains(x: number, z: number): boolean {
    if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) return false;
    const r = this.row(z);
    const edges = this.edges;
    let inside = false;
    for (let i = this.rowStart[r] as number; i < (this.rowStart[r + 1] as number); i++) {
      const k = (this.rowEdges[i] as number) * 4;
      const az = edges[k + 1] as number;
      const bz = edges[k + 3] as number;
      if (az > z === bz > z) continue;
      const ax = edges[k] as number;
      const bx = edges[k + 2] as number;
      if (x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    }
    return inside;
  }

  /** Inside, or within `radius` of an edge. */
  near(x: number, z: number, radius: number): boolean {
    if (
      x < this.minX - radius ||
      x > this.maxX + radius ||
      z < this.minZ - radius ||
      z > this.maxZ + radius
    )
      return false;
    if (this.contains(x, z)) return true;
    const r0 = this.row(z - radius);
    const r1 = this.row(z + radius);
    const edges = this.edges;
    const r2 = radius * radius;
    for (let r = r0; r <= r1; r++)
      for (let i = this.rowStart[r] as number; i < (this.rowStart[r + 1] as number); i++) {
        const k = (this.rowEdges[i] as number) * 4;
        if (
          segmentPointDistance2(
            edges[k] as number,
            edges[k + 1] as number,
            edges[k + 2] as number,
            edges[k + 3] as number,
            x,
            z,
          ) <= r2
        )
          return true;
      }
    return false;
  }

  /** X crossings of the polygon's edges along the line Z = `z`, sorted. */
  crossings(z: number, out: number[]): number[] {
    out.length = 0;
    if (z < this.minZ || z > this.maxZ) return out;
    const r = this.row(z);
    const edges = this.edges;
    for (let i = this.rowStart[r] as number; i < (this.rowStart[r + 1] as number); i++) {
      const k = (this.rowEdges[i] as number) * 4;
      const az = edges[k + 1] as number;
      const bz = edges[k + 3] as number;
      if (az > z === bz > z) continue;
      const ax = edges[k] as number;
      const bx = edges[k + 2] as number;
      out.push(((bx - ax) * (z - az)) / (bz - az) + ax);
    }
    out.sort((a, b) => a - b);
    return out;
  }
}

/** Squared distance from (px, pz) to the segment a-b. */
export function segmentPointDistance2(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length2)) : 0;
  const x = ax + dx * t - px;
  const z = az + dz * t - pz;
  return x * x + z * z;
}

/** A rectangle on the water: center, heading (yaw 0 faces +Z) and half extents. */
export interface HarborRect {
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
  halfWidth: number;
}

/** Whether two rectangles overlap, by separating axes, with `gap` meters to spare. */
export function harborRectsOverlap(a: HarborRect, b: HarborRect, gap = 0): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const reach = Math.hypot(a.halfLength, a.halfWidth) + Math.hypot(b.halfLength, b.halfWidth);
  if (dx * dx + dz * dz > (reach + gap) * (reach + gap)) return false;
  const axes: [number, number][] = [
    [Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(a.yaw), -Math.sin(a.yaw)],
    [Math.sin(b.yaw), Math.cos(b.yaw)],
    [Math.cos(b.yaw), -Math.sin(b.yaw)],
  ];
  const extent = (r: HarborRect, ax: number, az: number): number => {
    const fx = Math.sin(r.yaw);
    const fz = Math.cos(r.yaw);
    return Math.abs(fx * ax + fz * az) * r.halfLength + Math.abs(fz * ax - fx * az) * r.halfWidth;
  };
  for (const [ax, az] of axes)
    if (Math.abs(dx * ax + dz * az) > extent(a, ax, az) + extent(b, ax, az) + gap) return false;
  return true;
}

import type * as THREE from 'three';

/**
 * The triangles of one geometry bucketed by the horizontal (XZ) cell of their local-space
 * footprint. A collision neighborhood then visits only the triangles that can reach it, instead
 * of transforming every triangle of a kilometer-wide terrain tile or building cell on each
 * rebuild. Built once per geometry version and kept beside the geometry in a WeakMap, so an
 * evicted tile releases its index with its buffers.
 */
export interface TriangleIndex {
  readonly cells: number;
  readonly minX: number;
  readonly minZ: number;
  readonly cellWidth: number;
  readonly cellDepth: number;
  /** Start of each cell's run in `triangles`; length `cells * cells + 1`. */
  readonly offsets: Uint32Array;
  /** Triangle numbers grouped by cell. A triangle spanning several cells is listed in each. */
  readonly triangles: Uint32Array;
  /** Per-triangle visit stamp, so one query reports a spanning triangle once. */
  readonly seen: Uint32Array;
  stamp: number;
}

interface CachedIndex extends TriangleIndex {
  positionVersion: number;
  indexVersion: number;
  triangleCount: number;
}

/** Smaller geometries are walked directly; an index would cost more than it saves. */
export const TRIANGLE_INDEX_MIN_TRIANGLES: number = 4096;
const MIN_CELLS = 4;
const MAX_CELLS = 64;
const TARGET_TRIANGLES_PER_CELL = 48;

const indexes = new WeakMap<THREE.BufferGeometry, CachedIndex>();

/** The geometry's index, building it on first use or after its buffers change; undefined when small. */
export function triangleIndexFor(geometry: THREE.BufferGeometry): TriangleIndex | undefined {
  const position = geometry.getAttribute('position');
  if (position === undefined) return undefined;
  const index = geometry.index;
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  if (triangleCount < TRIANGLE_INDEX_MIN_TRIANGLES) return undefined;
  // Interleaved attributes carry no version of their own; the buffer's identity still keys them.
  const positionVersion = (position as { version?: number }).version ?? 0;
  const indexVersion = index?.version ?? -1;
  const existing = indexes.get(geometry);
  if (
    existing !== undefined &&
    existing.positionVersion === positionVersion &&
    existing.indexVersion === indexVersion &&
    existing.triangleCount === triangleCount
  )
    return existing;
  const built: CachedIndex = {
    ...buildTriangleIndex(position, index, triangleCount),
    positionVersion,
    indexVersion,
    triangleCount,
  };
  indexes.set(geometry, built);
  return built;
}

function cellOf(value: number, min: number, size: number, cells: number): number {
  return Math.max(0, Math.min(cells - 1, Math.floor((value - min) / size)));
}

/** @internal Exposed for tests; hosts use {@link triangleIndexFor}. */
export function buildTriangleIndex(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: THREE.BufferAttribute | null,
  triangleCount: number,
): TriangleIndex {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) {
    minX = maxX = minZ = maxZ = 0;
  }
  const cells = Math.max(
    MIN_CELLS,
    Math.min(MAX_CELLS, Math.round(Math.sqrt(triangleCount / TARGET_TRIANGLES_PER_CELL))),
  );
  const cellWidth = Math.max(maxX - minX, 1e-6) / cells;
  const cellDepth = Math.max(maxZ - minZ, 1e-6) / cells;
  // Pass one records each triangle's cell range and counts cell occupancy; pass two places it.
  const ranges = new Int32Array(triangleCount * 4);
  const offsets = new Uint32Array(cells * cells + 1);
  for (let t = 0; t < triangleCount; t++) {
    const vertex = t * 3;
    const i0 = index === null ? vertex : index.getX(vertex);
    const i1 = index === null ? vertex + 1 : index.getX(vertex + 1);
    const i2 = index === null ? vertex + 2 : index.getX(vertex + 2);
    const x0 = position.getX(i0);
    const x1 = position.getX(i1);
    const x2 = position.getX(i2);
    const z0 = position.getZ(i0);
    const z1 = position.getZ(i1);
    const z2 = position.getZ(i2);
    const cx0 = cellOf(Math.min(x0, x1, x2), minX, cellWidth, cells);
    const cx1 = cellOf(Math.max(x0, x1, x2), minX, cellWidth, cells);
    const cz0 = cellOf(Math.min(z0, z1, z2), minZ, cellDepth, cells);
    const cz1 = cellOf(Math.max(z0, z1, z2), minZ, cellDepth, cells);
    ranges[t * 4] = cx0;
    ranges[t * 4 + 1] = cx1;
    ranges[t * 4 + 2] = cz0;
    ranges[t * 4 + 3] = cz1;
    for (let cz = cz0; cz <= cz1; cz++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const slot = cz * cells + cx + 1;
        offsets[slot] = (offsets[slot] as number) + 1;
      }
  }
  for (let cell = 0; cell < cells * cells; cell++)
    offsets[cell + 1] = (offsets[cell] as number) + (offsets[cell + 1] as number);
  const triangles = new Uint32Array(offsets[cells * cells] as number);
  const cursor = offsets.slice(0, cells * cells);
  for (let t = 0; t < triangleCount; t++) {
    const cx0 = ranges[t * 4] as number;
    const cx1 = ranges[t * 4 + 1] as number;
    const cz0 = ranges[t * 4 + 2] as number;
    const cz1 = ranges[t * 4 + 3] as number;
    for (let cz = cz0; cz <= cz1; cz++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = cz * cells + cx;
        triangles[cursor[cell] as number] = t;
        cursor[cell] = (cursor[cell] as number) + 1;
      }
  }
  return {
    cells,
    minX,
    minZ,
    cellWidth,
    cellDepth,
    offsets,
    triangles,
    seen: new Uint32Array(triangleCount),
    stamp: 0,
  };
}

/**
 * Visit each triangle whose local-space footprint can overlap the XZ box, once. Candidates are
 * cell-level: the caller still tests the triangle itself.
 */
export function forEachIndexedTriangle(
  index: TriangleIndex,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  visit: (triangle: number) => void,
): void {
  const { cells, cellWidth, cellDepth, offsets, triangles, seen } = index;
  if (
    !(maxX >= minX && maxZ >= minZ) ||
    maxX < index.minX ||
    minX > index.minX + cellWidth * cells ||
    maxZ < index.minZ ||
    minZ > index.minZ + cellDepth * cells
  )
    return;
  if (index.stamp === 0xffffffff) {
    seen.fill(0);
    index.stamp = 0;
  }
  const stamp = ++index.stamp;
  const cx0 = cellOf(minX, index.minX, cellWidth, cells);
  const cx1 = cellOf(maxX, index.minX, cellWidth, cells);
  const cz0 = cellOf(minZ, index.minZ, cellDepth, cells);
  const cz1 = cellOf(maxZ, index.minZ, cellDepth, cells);
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const cell = cz * cells + cx;
      const end = offsets[cell + 1] as number;
      for (let k = offsets[cell] as number; k < end; k++) {
        const triangle = triangles[k] as number;
        if (seen[triangle] === stamp) continue;
        seen[triangle] = stamp;
        visit(triangle);
      }
    }
  }
}

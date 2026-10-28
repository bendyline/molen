/**
 * Soft land-class boundaries. Landcover polygons are draped with one flat color each, so two
 * classes meet along a hard, straight polygon edge. This rasterizes a tile's classes, then gives
 * every landcover vertex the two classes that dominate its surroundings, in a fixed order, and
 * the weight of the second. Both sides of a boundary therefore carry the same pair and a weight
 * that crosses 0.5 at the edge, and the ground shader thresholds that weight against world-space
 * noise to draw an organic, ragged transition in place of the polygon edge.
 */
import type * as THREE from 'three';
import { crispLandcover } from './landcover-appearance';
import type { TerrainLandcoverFeature } from './semantic-types';

/** Raster cells across one tile; boundary radius is at least 1.5 cells. */
const RASTER = 128;
/** Meters over which neighboring natural classes interpenetrate, at the finest tiles. */
const BLEND_RADIUS = 9;

/** Two rings of eight sample directions (unit vectors) at half and full radius. */
const RING: readonly (readonly [number, number])[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/** Sample rings: half radius at full weight, full radius at three quarters. */
const RINGS: readonly (readonly [number, number])[] = [
  [0.5, 1],
  [1, 0.75],
];

export interface LandcoverBlendRange {
  /** First vertex (inclusive) and last (exclusive) of one feature's draped triangles. */
  start: number;
  end: number;
  feature: number;
}

function rasterize(
  features: readonly TerrainLandcoverFeature[],
  size: number,
  margin: number,
): Int16Array {
  const cells = new Int16Array(size * size).fill(-1);
  // Raster cell (i, j) covers normalized tile coordinates starting at -margin.
  const scale = size / (1 + margin * 2);
  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    if (feature === undefined) continue;
    for (const polygon of feature.polygons) {
      const rings = [polygon.outer, ...(polygon.holes ?? [])].filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      let minY = Number.POSITIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY;
      for (const point of polygon.outer) {
        minY = Math.min(minY, point[1]);
        maxY = Math.max(maxY, point[1]);
      }
      const rowStart = Math.max(0, Math.ceil((minY + margin) * scale - 0.5));
      const rowEnd = Math.min(size - 1, Math.floor((maxY + margin) * scale - 0.5));
      const crossings: number[] = [];
      for (let row = rowStart; row <= rowEnd; row++) {
        const y = (row + 0.5) / scale - margin;
        crossings.length = 0;
        for (const ring of rings) {
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const a = ring[i] as readonly [number, number];
            const b = ring[j] as readonly [number, number];
            if (a[1] > y !== b[1] > y)
              crossings.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
        }
        crossings.sort((p, q) => p - q);
        for (let k = 0; k + 1 < crossings.length; k += 2) {
          const from = Math.max(0, Math.ceil(((crossings[k] as number) + margin) * scale - 0.5));
          const to = Math.min(
            size - 1,
            Math.floor(((crossings[k + 1] as number) + margin) * scale - 0.5),
          );
          // Later features cover earlier ones, as in the draped mesh.
          for (let col = from; col <= to; col++) cells[row * size + col] = index;
        }
      }
    }
  }
  return cells;
}

/**
 * Cells within `reach` cells (Chebyshev) of a class change. A vertex outside the mask sees only
 * its own class in every sample, so the per-vertex work can skip it outright.
 */
function nearBoundary(cells: Int16Array, size: number, reach: number): Uint8Array {
  const edge = new Uint8Array(size * size);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const here = cells[row * size + col];
      if (
        (col + 1 < size && cells[row * size + col + 1] !== here) ||
        (row + 1 < size && cells[(row + 1) * size + col] !== here)
      ) {
        edge[row * size + col] = 1;
        if (col + 1 < size) edge[row * size + col + 1] = 1;
        if (row + 1 < size) edge[(row + 1) * size + col] = 1;
      }
    }
  // Separable box dilation: rows, then columns.
  const across = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) {
    let last = -Infinity;
    for (let col = 0; col < size; col++) {
      if (edge[row * size + col]) last = col;
      if (col - last <= reach) across[row * size + col] = 1;
    }
    last = Infinity;
    for (let col = size - 1; col >= 0; col--) {
      if (edge[row * size + col]) last = col;
      if (last - col <= reach) across[row * size + col] = 1;
    }
  }
  const mask = new Uint8Array(size * size);
  for (let col = 0; col < size; col++) {
    let last = -Infinity;
    for (let row = 0; row < size; row++) {
      if (across[row * size + col]) last = row;
      if (row - last <= reach) mask[row * size + col] = 1;
    }
    last = Infinity;
    for (let row = size - 1; row >= 0; row--) {
      if (across[row * size + col]) last = row;
      if (last - row <= reach) mask[row * size + col] = 1;
    }
  }
  return mask;
}

/**
 * Write `landcoverBlend` (weight of the second class, then its linear color) and replace the
 * vertex color with the first class's. Cultivated features keep crisp edges in both directions:
 * their own vertices do not blend, and their neighbors ignore them.
 */
export function applyLandcoverBlend(
  geometry: THREE.BufferGeometry,
  features: readonly TerrainLandcoverFeature[],
  ranges: readonly LandcoverBlendRange[],
  tileSize: number,
  colorAt: (feature: number, x: number, z: number) => THREE.Color,
  createAttribute: (array: Float32Array, size: number) => THREE.BufferAttribute,
): void {
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const blend = new Float32Array(position.count * 4);
  const cell = tileSize / RASTER;
  const radius = Math.max(BLEND_RADIUS, cell * 1.5);
  const margin = radius / tileSize + 1 / RASTER;
  const size = Math.ceil(RASTER * (1 + margin * 2));
  const cells = rasterize(features, size, margin);
  const scale = size / (1 + margin * 2);
  const near = nearBoundary(cells, size, Math.ceil((radius / tileSize) * scale) + 1);
  const xyz = position.array;
  const crisp = features.map(crispLandcover);
  const lookup = (x: number, z: number): number => {
    const col = Math.floor((x / tileSize + margin) * scale);
    const row = Math.floor((z / tileSize + margin) * scale);
    if (col < 0 || row < 0 || col >= size || row >= size) return -1;
    return cells[row * size + col] as number;
  };
  // The ring samples as flat (dx, dz, weight) triples, read by index in the hot loop.
  const offsets = new Float64Array(RINGS.length * RING.length * 3);
  let o = 0;
  for (const [ring, w] of RINGS)
    for (const [dx, dz] of RING) {
      offsets[o++] = dx * radius * ring;
      offsets[o++] = dz * radius * ring;
      offsets[o++] = w;
    }
  // Up to 17 samples per vertex: parallel arrays beat a Map in this hot loop.
  const ids = new Int32Array(17);
  const sums = new Float32Array(17);
  let classes = 0;
  const add = (index: number, w: number): void => {
    if (index < 0 || crisp[index]) return;
    for (let k = 0; k < classes; k++)
      if (ids[k] === index) {
        sums[k] = (sums[k] as number) + w;
        return;
      }
    ids[classes] = index;
    sums[classes++] = w;
  };
  for (const range of ranges) {
    for (let vertex = range.start; vertex < range.end; vertex++) {
      if (crisp[range.feature]) continue;
      const x = xyz[vertex * 3] as number,
        z = xyz[vertex * 3 + 2] as number;
      const col = Math.floor((x / tileSize + margin) * scale);
      const row = Math.floor((z / tileSize + margin) * scale);
      if (col >= 0 && row >= 0 && col < size && row < size && !near[row * size + col]) continue;
      classes = 0;
      // Weights depend on position alone, so the duplicated vertices either side of a polygon
      // edge get identical attributes and the edge itself disappears.
      add(lookup(x, z), 2);
      for (let k = 0; k < offsets.length; k += 3)
        add(
          lookup(x + (offsets[k] as number), z + (offsets[k + 1] as number)),
          offsets[k + 2] as number,
        );
      if (classes < 2) continue;
      let first = -1,
        second = -1,
        firstWeight = 0,
        secondWeight = 0;
      for (let k = 0; k < classes; k++) {
        const index = ids[k] as number,
          weight = sums[k] as number;
        if (weight > firstWeight || (weight === firstWeight && index < first)) {
          second = first;
          secondWeight = firstWeight;
          first = index;
          firstWeight = weight;
        } else if (weight > secondWeight || (weight === secondWeight && index < second)) {
          second = index;
          secondWeight = weight;
        }
      }
      // A fixed order (by feature) keeps the pair identical on both sides of a boundary.
      const low = Math.min(first, second),
        high = Math.max(first, second);
      const lowWeight = low === first ? firstWeight : secondWeight;
      const highWeight = high === first ? firstWeight : secondWeight;
      const a = colorAt(low, x, z);
      const b = colorAt(high, x, z);
      color.setXYZ(vertex, a.r, a.g, a.b);
      blend[vertex * 4] = highWeight / (lowWeight + highWeight);
      blend[vertex * 4 + 1] = b.r;
      blend[vertex * 4 + 2] = b.g;
      blend[vertex * 4 + 3] = b.b;
    }
  }
  // Unblended vertices keep their own color and a zero weight toward a copy of it.
  for (let vertex = 0; vertex < position.count; vertex++) {
    if (blend[vertex * 4] !== 0) continue;
    blend[vertex * 4 + 1] = color.getX(vertex);
    blend[vertex * 4 + 2] = color.getY(vertex);
    blend[vertex * 4 + 3] = color.getZ(vertex);
  }
  color.needsUpdate = true;
  geometry.setAttribute('landcoverBlend', createAttribute(blend, 4));
}

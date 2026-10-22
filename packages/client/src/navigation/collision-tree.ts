import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';

const LEAF_SIZE = 16;

/** Keep Three's collision queries, but partition triangles without duplicating them.
 * Rendered roads, walls and portal covers can overlap. An octree copies each triangle into
 * every intersecting cell and repeatedly splits those copies, causing long rebuild stalls.
 * A balanced bounding-volume tree stores each triangle once, even for coincident surfaces.
 *
 * Triangle bounds and centers live in flat arrays and each split selects its median instead of
 * sorting: an aircraft's neighborhood over dense ground cover held 170k triangles, and sorting
 * them at every level of the tree took 700 ms of one frame.
 */
export class CollisionTree extends Octree {
  override build(): this {
    this.calcBox();
    this.subTrees = [];
    const triangles = this.triangles;
    if (triangles.length > 0) {
      const bounds = new Float64Array(triangles.length * 6);
      const centers = new Float64Array(triangles.length * 3);
      triangles.forEach(({ a, b, c }, index) => {
        const box = index * 6;
        bounds[box] = Math.min(a.x, b.x, c.x);
        bounds[box + 1] = Math.min(a.y, b.y, c.y);
        bounds[box + 2] = Math.min(a.z, b.z, c.z);
        bounds[box + 3] = Math.max(a.x, b.x, c.x);
        bounds[box + 4] = Math.max(a.y, b.y, c.y);
        bounds[box + 5] = Math.max(a.z, b.z, c.z);
        for (let axis = 0; axis < 3; axis++)
          centers[index * 3 + axis] =
            ((bounds[box + axis] as number) + (bounds[box + 3 + axis] as number)) / 2;
      });
      const order = new Uint32Array(triangles.length);
      for (let index = 0; index < order.length; index++) order[index] = index;
      // Octree query methods start at the children, including for a single leaf.
      this.subTrees.push(partition({ triangles, bounds, centers, order }, 0, triangles.length));
    }
    this.triangles = [];
    return this;
  }
}

interface Entries {
  triangles: THREE.Triangle[];
  /** Per triangle: min x, y, z then max x, y, z. */
  bounds: Float64Array;
  centers: Float64Array;
  /** Triangle indices; each node owns the range `start..end`. */
  order: Uint32Array;
}

function partition(entries: Entries, start: number, end: number): Octree {
  const { bounds, centers, order } = entries;
  const box = new THREE.Box3();
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let k = start; k < end; k++) {
    const index = order[k] as number;
    for (let axis = 0; axis < 3; axis++) {
      const center = centers[index * 3 + axis] as number;
      if (center < (low[axis] as number)) low[axis] = center;
      if (center > (high[axis] as number)) high[axis] = center;
    }
    box.min.x = Math.min(box.min.x, bounds[index * 6] as number);
    box.min.y = Math.min(box.min.y, bounds[index * 6 + 1] as number);
    box.min.z = Math.min(box.min.z, bounds[index * 6 + 2] as number);
    box.max.x = Math.max(box.max.x, bounds[index * 6 + 3] as number);
    box.max.y = Math.max(box.max.y, bounds[index * 6 + 4] as number);
    box.max.z = Math.max(box.max.z, bounds[index * 6 + 5] as number);
  }
  const node = new Octree(box);
  if (end - start <= LEAF_SIZE) {
    // Insertion order, so a leaf lists its triangles the same way however the tree split.
    const leaf = Array.from(order.subarray(start, end)).sort((p, q) => p - q);
    node.triangles = leaf.map((index) => entries.triangles[index] as THREE.Triangle);
    return node;
  }
  const size = high.map((value, axis) => value - (low[axis] as number));
  const [sx, sy, sz] = size as [number, number, number];
  const axis = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2;
  const middle = start + Math.floor((end - start) / 2);
  selectMedian(entries, axis, start, end - 1, middle);
  node.subTrees.push(partition(entries, start, middle), partition(entries, middle, end));
  return node;
}

/**
 * Reorder `order[left..right]` so position `k` holds the entry a full sort by center along `axis`
 * would put there, with smaller entries before it and larger after. Equal centers order by
 * triangle index, so the two halves never depend on how earlier splits arranged the range.
 */
function selectMedian(
  { centers, order }: Entries,
  axis: number,
  left: number,
  right: number,
  k: number,
): void {
  const before = (p: number, q: number): boolean => {
    const cp = centers[p * 3 + axis] as number;
    const cq = centers[q * 3 + axis] as number;
    return cp < cq || (cp === cq && p < q);
  };
  const swap = (i: number, j: number): void => {
    const held = order[i] as number;
    order[i] = order[j] as number;
    order[j] = held;
  };
  while (right > left) {
    // Median of three keeps sorted and reversed ranges linear.
    const mid = left + ((right - left) >> 1);
    if (before(order[mid] as number, order[left] as number)) swap(mid, left);
    if (before(order[right] as number, order[left] as number)) swap(right, left);
    if (before(order[right] as number, order[mid] as number)) swap(right, mid);
    const pivot = order[mid] as number;
    let i = left;
    let j = right;
    while (i <= j) {
      while (before(order[i] as number, pivot)) i++;
      while (before(pivot, order[j] as number)) j--;
      if (i <= j) {
        swap(i, j);
        i++;
        j--;
      }
    }
    if (k <= j) right = j;
    else if (k >= i) left = i;
    else return;
  }
}

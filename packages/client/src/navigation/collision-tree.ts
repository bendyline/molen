import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';

interface Entry {
  triangle: THREE.Triangle;
  bounds: THREE.Box3;
  center: THREE.Vector3;
}

const LEAF_SIZE = 16;

/** Keep Three's collision queries, but partition triangles without duplicating them.
 * Rendered roads, walls and portal covers can overlap. An octree copies each triangle into
 * every intersecting cell and repeatedly splits those copies, causing long rebuild stalls.
 * A balanced bounding-volume tree stores each triangle once, even for coincident surfaces.
 */
export class CollisionTree extends Octree {
  override build(): this {
    this.calcBox();
    this.subTrees = [];
    if (this.triangles.length > 0) {
      const entries = this.triangles.map((triangle) => {
        const bounds = new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]);
        return { triangle, bounds, center: bounds.getCenter(new THREE.Vector3()) };
      });
      // Octree query methods start at the children, including for a single leaf.
      this.subTrees.push(partition(entries));
    }
    this.triangles = [];
    return this;
  }
}

function partition(entries: Entry[]): Octree {
  const bounds = new THREE.Box3();
  const centers = new THREE.Box3();
  for (const entry of entries) {
    bounds.union(entry.bounds);
    centers.expandByPoint(entry.center);
  }
  const node = new Octree(bounds);
  if (entries.length <= LEAF_SIZE) {
    node.triangles = entries.map((entry) => entry.triangle);
    return node;
  }
  const size = centers.getSize(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  entries.sort((a, b) => a.center[axis] - b.center[axis]);
  const middle = Math.floor(entries.length / 2);
  node.subTrees.push(partition(entries.slice(0, middle)), partition(entries.slice(middle)));
  return node;
}

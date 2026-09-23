import * as THREE from 'three';
import { CollisionTree } from './collision-tree.js';

const COLLISION_RADIUS = 24;
const REBUILD_DISTANCE = 6;

interface CollisionMesh {
  mesh: THREE.Mesh;
  matrix: THREE.Matrix4;
  count: number;
  geometry: THREE.BufferGeometry;
  version: number;
}

/** A small collision neighborhood in metric coordinates, independent of floating-origin shifts.
 * Only visible, resident geometry participates; evicted tiles and hidden layers disappear on
 * the next update. Instance transforms are expanded only inside the neighborhood.
 */
export class WalkCollision {
  readonly origin: THREE.Vector3 = new THREE.Vector3();
  readonly octree: CollisionTree = new CollisionTree();
  private meshes: CollisionMesh[] = [];
  private initialized = false;

  constructor(private readonly ignoreVehicles = false) {}

  update(root: THREE.Object3D, x: number, z: number): void {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const meshes: CollisionMesh[] = [];
    // Compare only the neighborhood represented by the current octree. Distant streaming and
    // LOD changes must not trigger a rebuild of every nearby triangle.
    const stationary =
      this.initialized && Math.hypot(x - this.origin.x, z - this.origin.z) < REBUILD_DISTANCE;
    const centerX = stationary ? this.origin.x : x;
    const centerZ = stationary ? this.origin.z : z;
    const bounds = new THREE.Box3();
    root.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.walkIgnore === true) return;
      if (this.ignoreVehicles && (object.userData.vehicleIds || object.userData.vehicleGeometry))
        return;
      // Land-cover is a thin visual overlay of the existing terrain collision surface.
      if (object.name === 'semantic:landcover') return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Water is a visual surface, not a solid floor.
      if (materials.every((material) => material.userData.terrainWaterMaterial === true)) return;
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
      if (object instanceof THREE.InstancedMesh) {
        if (object.boundingBox === null) object.computeBoundingBox();
        bounds.copy(object.boundingBox as THREE.Box3);
      } else {
        if (object.geometry.boundingBox === null) object.geometry.computeBoundingBox();
        bounds.copy(object.geometry.boundingBox as THREE.Box3);
      }
      bounds.applyMatrix4(matrix);
      // Include the rebuild margin so moving across a cell edge cannot miss a new obstacle.
      const radius = COLLISION_RADIUS + REBUILD_DISTANCE;
      if (
        bounds.min.x > centerX + radius ||
        bounds.max.x < centerX - radius ||
        bounds.min.z > centerZ + radius ||
        bounds.max.z < centerZ - radius
      )
        return;
      meshes.push({
        mesh: object,
        matrix,
        count: object instanceof THREE.InstancedMesh ? object.count : 1,
        geometry: object.geometry,
        version:
          object instanceof THREE.InstancedMesh
            ? object.instanceMatrix.version
            : (object.geometry.index?.version ?? 0),
      });
    });
    const unchanged =
      meshes.length === this.meshes.length &&
      meshes.every((entry, index) => {
        const previous = this.meshes[index];
        return (
          previous?.mesh === entry.mesh &&
          previous.count === entry.count &&
          previous.geometry === entry.geometry &&
          previous.version === entry.version &&
          previous.matrix.equals(entry.matrix)
        );
      });
    if (
      this.initialized &&
      unchanged &&
      Math.hypot(x - this.origin.x, z - this.origin.z) < REBUILD_DISTANCE
    ) {
      return;
    }
    this.initialized = true;
    this.meshes = meshes;
    this.origin.set(x, 0, z);
    this.octree.clear();
    const offset = new THREE.Matrix4().makeTranslation(-x, 0, -z);
    const instance = new THREE.Matrix4();
    const transform = new THREE.Matrix4();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const { mesh, matrix, count } of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute('position');
      if (position === undefined) continue;
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      const local = new THREE.Matrix4().multiplyMatrices(offset, matrix);
      // Reject whole distant batches before walking their (potentially thousands of) instances.
      if (mesh instanceof THREE.InstancedMesh && mesh.boundingBox === null)
        mesh.computeBoundingBox();
      bounds
        .copy(
          (mesh instanceof THREE.InstancedMesh
            ? mesh.boundingBox
            : geometry.boundingBox) as THREE.Box3,
        )
        .applyMatrix4(local);
      if (!nearby(bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z)) continue;
      const index = geometry.index;
      const end = Math.min(
        index?.count ?? position.count,
        geometry.drawRange.start + geometry.drawRange.count,
      );
      for (let i = 0; i < count; i++) {
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.getMatrixAt(i, instance);
          transform.multiplyMatrices(local, instance);
        } else transform.copy(local);
        bounds.copy(geometry.boundingBox as THREE.Box3).applyMatrix4(transform);
        if (!nearby(bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z)) continue;
        for (let vertex = geometry.drawRange.start; vertex + 2 < end; vertex += 3) {
          a.fromBufferAttribute(position, index?.getX(vertex) ?? vertex).applyMatrix4(transform);
          b.fromBufferAttribute(position, index?.getX(vertex + 1) ?? vertex + 1).applyMatrix4(
            transform,
          );
          c.fromBufferAttribute(position, index?.getX(vertex + 2) ?? vertex + 2).applyMatrix4(
            transform,
          );
          if (
            !nearby(
              Math.min(a.x, b.x, c.x),
              Math.max(a.x, b.x, c.x),
              Math.min(a.z, b.z, c.z),
              Math.max(a.z, b.z, c.z),
            )
          )
            continue;
          this.octree.addTriangle(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
          if (mesh.userData.walkDoubleSided === true)
            this.octree.addTriangle(new THREE.Triangle(c.clone(), b.clone(), a.clone()));
        }
      }
    }
    this.octree.build();
  }

  clear(): void {
    this.meshes = [];
    this.initialized = false;
    this.octree.clear();
  }
}

function nearby(minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  return (
    minX <= COLLISION_RADIUS &&
    maxX >= -COLLISION_RADIUS &&
    minZ <= COLLISION_RADIUS &&
    maxZ >= -COLLISION_RADIUS
  );
}

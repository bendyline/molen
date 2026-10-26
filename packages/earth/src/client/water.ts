import type { WaterSample } from '@bendyline/molen-kernel/boats';
import type { WaterSettings } from '@bendyline/molen-schema';
import { taggedTerrainObjects } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';

/** Whether `object` is attached under `root` with it and every object between them visible. */
export function shownUnder(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let cursor: THREE.Object3D | null = object; cursor !== null; cursor = cursor.parent) {
    if (!cursor.visible) return false;
    if (cursor === root) return true;
  }
  return false;
}

/** Mild coastal chop; hosts can supply calm water, different swells, and currents. */
export const EARTH_WATER_CONDITIONS: WaterSettings = {
  waves: [
    { amplitude: 0.18, wavelength: 24, direction: 0.7, speed: 4.5 },
    { amplitude: 0.07, wavelength: 11, direction: -0.4, speed: 2.8 },
  ],
  current: [0, 0],
};
/**
 * Water coverage and datum from the very meshes the terrain draws, including lakes at altitude.
 * Render transforms may use a floating origin; input/output remain absolute metric coordinates.
 * DEM height is not bathymetry, so no depth is fabricated from it.
 */
export class EarthWater {
  private meshes: Array<{ mesh: THREE.Mesh; bounds: THREE.Box3 }> = [];
  private readonly ray = new THREE.Raycaster();
  private readonly point = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();
  constructor(
    private readonly root: THREE.Object3D,
    private readonly ground: (x: number, z: number) => number | undefined,
  ) {}
  sync(): void {
    this.meshes = [];
    // Each water mesh's own chain only: refreshing the whole tree recomposed every resident
    // tile's matrices, hidden ones too, five times a second.
    this.root.updateWorldMatrix(true, false);
    const inverse = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    // The water surfaces the terrain tagged, shown under this root: walking the whole visible
    // scene for them, five times a second, was milliseconds a pass over a town.
    for (const object of taggedTerrainObjects('water')) {
      if (!(object as THREE.Mesh).isMesh || !shownUnder(object, this.root)) continue;
      const mesh = object as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      // Water geometry does not change once built; a replaced geometry brings its own box.
      if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox
        ?.clone()
        .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      if (bounds) this.meshes.push({ mesh, bounds });
    }
  }
  sample(x: number, z: number): WaterSample | null | undefined {
    this.root.updateWorldMatrix(true, false);
    this.ray.ray.origin.set(x, 100_000, z).applyMatrix4(this.root.matrixWorld);
    this.ray.ray.direction.set(0, -1, 0).transformDirection(this.root.matrixWorld);
    this.inverse.copy(this.root.matrixWorld).invert();
    let height: number | undefined;
    for (const { mesh, bounds } of this.meshes) {
      if (x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z) continue;
      // Detached tiles can be evicted between sync calls.
      let ancestor: THREE.Object3D | null = mesh;
      while (ancestor && ancestor !== this.root && ancestor.visible) ancestor = ancestor.parent;
      if (ancestor !== this.root) continue;
      mesh.updateWorldMatrix(true, false);
      const hit = this.ray.intersectObject(mesh, false)[0];
      if (hit) {
        const y = this.point.copy(hit.point).applyMatrix4(this.inverse).y;
        height = height === undefined ? y : Math.min(height, y);
      }
    }
    return height !== undefined ? { height } : this.ground(x, z) === undefined ? undefined : null;
  }
}

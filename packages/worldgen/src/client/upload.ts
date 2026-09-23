/** Wrap generated mesh buffers in three.js objects. */

import * as THREE from 'three';
import type { MaterialSlot, MeshBuffers } from '../kernel/types';
import { packedColorAttribute } from './color-attribute';
import { bindMaterialGroups } from './material-groups';

export interface WorldgenMaterialSet {
  /** Material for a (slot, materialRef) pair; may be shared across groups and batches. */
  materialFor(slot: MaterialSlot, materialRef: string): THREE.Material;
  dispose?(): void;
}

/** One mesh with one geometry group per material; owns its geometry, shares materials. */
export function buffersToObject3D(
  buffers: MeshBuffers,
  materials: WorldgenMaterialSet,
  name = 'worldgen:buildings',
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('color', packedColorAttribute(buffers.colors));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  const list = bindMaterialGroups(geometry, buffers.groups, materials);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, list);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.worldgenOwnedGeometry = true;
  return mesh;
}

/** Dispose geometry and instance buffers this package created; shared materials survive. */
export function disposeWorldgenObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.worldgenOwnedGeometry === true) mesh.geometry.dispose();
    const instanced = object as THREE.InstancedMesh;
    if (instanced.isInstancedMesh) instanced.dispose();
  });
}

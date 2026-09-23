/** Instanced unit boxes for degraded buildings (and any `builtin:box` placement set). */

import * as THREE from 'three';
import { PLACEMENT_STRIDE, type PlacementSet } from '../kernel/types';

let unitBox: THREE.BoxGeometry | undefined;

/** Shared unit cube with its base at y = 0 and a darker top face baked into vertex colors. */
export function unitBoxGeometry(): THREE.BoxGeometry {
  if (unitBox === undefined) {
    unitBox = new THREE.BoxGeometry(1, 1, 1);
    unitBox.translate(0, 0.5, 0);
    const normals = unitBox.getAttribute('normal');
    const colors = new Float32Array(normals.count * 3);
    for (let index = 0; index < normals.count; index++) {
      const shade = normals.getY(index) > 0.5 ? 0.72 : normals.getY(index) < -0.5 ? 0.5 : 1;
      colors[index * 3] = shade;
      colors[index * 3 + 1] = shade;
      colors[index * 3 + 2] = shade;
    }
    unitBox.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return unitBox;
}

/** One `InstancedMesh` for a placement set; geometry is shared, instance buffers are owned. */
export function createInstancedPlacements(
  set: PlacementSet,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name = `worldgen:${set.setId}`,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, set.count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < set.count; index++) {
    const offset = index * PLACEMENT_STRIDE;
    position.set(
      set.data[offset] as number,
      set.data[offset + 1] as number,
      set.data[offset + 2] as number,
    );
    quaternion.setFromAxisAngle(up, set.data[offset + 3] as number);
    scale.set(
      set.data[offset + 4] as number,
      set.data[offset + 5] as number,
      set.data[offset + 6] as number,
    );
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    color.setRGB(
      set.data[offset + 7] as number,
      set.data[offset + 8] as number,
      set.data[offset + 9] as number,
    );
    mesh.setColorAt(index, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

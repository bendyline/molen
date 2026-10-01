/**
 * Instanced unit boxes for degraded buildings (and any `builtin:box` placement set), and their
 * pitched counterpart `builtin:box.gable`: a box whose walls stop at `GABLE_BOX_EAVE` of its
 * height under a roof ridged along local x. Both shade by vertex color under the instance color:
 * roofs darker than walls, so a neighbourhood seen from above reads as roofs, not boxes.
 */

import * as THREE from 'three';
import { GABLE_BOX_EAVE } from '../kernel/building';
import { PLACEMENT_STRIDE, type PlacementSet } from '../kernel/types';

let unitBox: THREE.BoxGeometry | undefined;
let gableBox: THREE.BufferGeometry | undefined;

/** Roof shade under a stand-in's wall color: weathered shingle rather than painted wall. */
const GABLE_ROOF_SHADE = 0.46;

/**
 * Shared unit gable house: footprint [-0.5, 0.5]², walls to `GABLE_BOX_EAVE`, ridge along x at
 * height 1, a small overhang, flat-shaded (each face its own vertices).
 */
export function gableBoxGeometry(): THREE.BufferGeometry {
  if (gableBox !== undefined) return gableBox;
  const e = GABLE_BOX_EAVE;
  const o = 0.06;
  const positions: number[] = [];
  const colors: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], shade: number) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) colors.push(shade, shade, shade);
  };
  const tri = (a: number[], b: number[], c: number[], shade: number) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(shade, shade, shade);
  };
  // Long walls (±z) and gable ends (±x), counter-clockwise from outside.
  quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, e, 0.5], [-0.5, e, 0.5], 1);
  quad([0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, e, -0.5], [0.5, e, -0.5], 1);
  quad([0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, e, -0.5], [0.5, e, 0.5], 1);
  tri([0.5, e, 0.5], [0.5, e, -0.5], [0.5, 1, 0], 1);
  quad([-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, e, 0.5], [-0.5, e, -0.5], 1);
  tri([-0.5, e, -0.5], [-0.5, e, 0.5], [-0.5, 1, 0], 1);
  // Roof planes, overhanging the walls a little on every side.
  const drop = (o / 0.5) * (1 - e);
  quad(
    [-0.5 - o, e - drop, 0.5 + o],
    [0.5 + o, e - drop, 0.5 + o],
    [0.5 + o, 1, 0],
    [-0.5 - o, 1, 0],
    GABLE_ROOF_SHADE,
  );
  quad(
    [0.5 + o, e - drop, -0.5 - o],
    [-0.5 - o, e - drop, -0.5 - o],
    [-0.5 - o, 1, 0],
    [0.5 + o, 1, 0],
    GABLE_ROOF_SHADE,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  gableBox = geometry;
  return geometry;
}

/** The shared stand-in geometry for a box placement set's model, or undefined for other models. */
export function buildingBoxGeometry(modelRef: string): THREE.BufferGeometry | undefined {
  if (modelRef === 'builtin:box') return unitBoxGeometry();
  if (modelRef === 'builtin:box.gable') return gableBoxGeometry();
  return undefined;
}

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

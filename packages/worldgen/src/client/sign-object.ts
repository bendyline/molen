/** A batch's named signs (`SignMeshBuffers`) as one object: letters near, plates farther, then nothing. */
import * as THREE from 'three';
import type { SignMeshBuffers } from '../kernel/sign-mesh';
import { paddedVec3Attribute } from './color-attribute';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './screen-space-lod';
import { SIGN_INK_ATTRIBUTE, SIGN_PLATE_ATTRIBUTE, signLettersMaterial } from './sign-material';

/** Letters are drawn while a cap height spans this many pixels; plates while they span this many. */
export const SIGN_LETTER_PIXELS = 3;
export const SIGN_PLATE_PIXELS = 1.5;

/**
 * The sign mesh as a detail switch at its bounds' center: plates and letters, then the plates
 * alone, then nothing. Every level draws a range of the same buffers: the plates are the leading
 * `plateIndexCount` indices, the letters the rest. Thresholds are in pixels of the smallest name
 * and plate against the policy's viewport, whatever its pixel error. `material` is a sign
 * material (`createSignMaterialAsync`); its letters twin draws the letters. Geometry is owned
 * (`worldgenOwnedGeometry`); the materials are the caller's.
 */
export function createSignMeshObject(
  signs: SignMeshBuffers,
  material: THREE.Material,
  policy?: ScreenSpaceLodPolicy,
  name = 'worldgen:signs',
): THREE.Object3D {
  const attributes: Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute> = {
    position: new THREE.BufferAttribute(signs.positions, 3),
    normal: paddedVec3Attribute(signs.normals),
    uv: new THREE.BufferAttribute(signs.uvs, 2),
    [SIGN_PLATE_ATTRIBUTE]: new THREE.InterleavedBufferAttribute(
      new THREE.InterleavedBuffer(signs.plate, 4),
      4,
      0,
      true,
    ),
    [SIGN_INK_ATTRIBUTE]: new THREE.InterleavedBufferAttribute(
      new THREE.InterleavedBuffer(signs.ink, 4),
      4,
      0,
      true,
    ),
  };
  const index = new THREE.BufferAttribute(signs.indices, 1);
  const bounds = new THREE.Box3(
    new THREE.Vector3(...signs.bounds.slice(0, 3)),
    new THREE.Vector3(...signs.bounds.slice(3)),
  );
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const letters = signLettersMaterial(material) ?? material;
  const range = (
    start: number,
    count: number,
    drawn: THREE.Material,
    level: string,
  ): THREE.Mesh => {
    const geometry = new THREE.BufferGeometry();
    for (const [key, value] of Object.entries(attributes)) geometry.setAttribute(key, value);
    geometry.setIndex(index);
    geometry.setDrawRange(start, count);
    geometry.boundingBox = bounds.clone();
    geometry.boundingSphere = new THREE.Sphere(center.clone(), radius);
    // The buffers stay in batch meters; the mesh sits back by the center the switch stands at.
    const mesh = new THREE.Mesh(geometry, drawn);
    mesh.name = `${name}:${level}`;
    mesh.position.copy(center).negate();
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.shadowCaster = false;
    mesh.userData.worldgenOwnedGeometry = true;
    // Walked past and flown over, never stood on.
    mesh.userData.walkIgnore = true;
    return mesh;
  };
  const plates = signs.plateIndexCount;
  const near = new THREE.Group();
  near.name = `${name}:near`;
  near.add(range(0, plates, material, 'plates'));
  near.add(range(plates, signs.indices.length - plates, letters, 'letters'));
  near.updateMatrix();
  near.matrixAutoUpdate = false;
  if (policy === undefined) {
    near.position.copy(center);
    near.updateMatrix();
    return near;
  }
  // Fixed pixel sizes rather than the policy's error budget: a sign is legible or it is not.
  const pixels: ScreenSpaceLodPolicy = {
    get viewportHeight() {
      return policy.viewportHeight;
    },
    maxPixelError: 1,
  };
  const lod = new ScreenSpaceLod(pixels, radius);
  lod.name = name;
  lod.position.copy(center);
  const lettered = signs.capHeight / SIGN_LETTER_PIXELS;
  lod.addDetail(near, 0);
  lod.addDetail(range(0, plates, material, 'far'), lettered);
  const nothing = new THREE.Group();
  nothing.name = `${name}:none`;
  lod.addDetail(nothing, Math.max(lettered * 1.001, signs.plateHeight / SIGN_PLATE_PIXELS));
  lod.updateMatrix();
  lod.matrixAutoUpdate = false;
  return lod;
}

/**
 * Kernel buffers to three.js: a `SkinnedMesh` over a `Skeleton` built in rig order (bones
 * parented under the mesh so the default "attached" bind mode handles the entity transform),
 * an explicit bounding sphere (three would otherwise compute a skinned sphere per cull), and
 * `applyPose` writing the shared evaluator's local transforms straight into the bones.
 */

import * as THREE from 'three';
import type { FigureBody } from '../kernel/body';
import type { FigurePose } from '../kernel/pose';
import type { FigureJoint, FigureRig } from '../kernel/rig';
import type { SkinnedMeshBuffers } from '../kernel/skinned-mesh-builder';

export interface FigureMesh {
  /** The root the backend places: the mesh and (for skinned tiers) the bone hierarchy. */
  root: THREE.Group;
  mesh: THREE.SkinnedMesh | THREE.Mesh;
  skeleton: THREE.Skeleton | undefined;
  /** Bones in rig order (empty for rigid tiers). */
  bones: THREE.Bone[];
  dispose(): void;
}

/** Pack 8-bit RGB triplets to a 4-byte stride (WebGPU alignment) as a normalized RGB attribute. */
function packedColorAttribute(
  colors: Uint8Array,
  vertexCount: number,
): THREE.InterleavedBufferAttribute {
  const packed = new Uint8Array(vertexCount * 4);
  for (let v = 0; v < vertexCount; v++) {
    packed[v * 4] = colors[v * 3] as number;
    packed[v * 4 + 1] = colors[v * 3 + 1] as number;
    packed[v * 4 + 2] = colors[v * 3 + 2] as number;
    packed[v * 4 + 3] = 255;
  }
  return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(packed, 4), 3, 0, true);
}

/** A three.js geometry over kernel-generated figure buffers (shared by every entity with the key). */
export function figureGeometry(buffers: SkinnedMeshBuffers): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('color', packedColorAttribute(buffers.colors, buffers.vertexCount));
  if (buffers.joints !== undefined && buffers.weights !== undefined) {
    const joints = new Uint16Array(buffers.joints.length);
    for (let i = 0; i < joints.length; i++) joints[i] = buffers.joints[i] as number;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(buffers.weights, 4));
  }
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildBones(rig: FigureRig): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  for (let j = 0; j < rig.joints.length; j++) {
    const joint = rig.joints[j] as FigureJoint;
    const bone = new THREE.Bone();
    bone.name = joint.name;
    bone.position.set(joint.bindPos[0], joint.bindPos[1], joint.bindPos[2]);
    bone.quaternion.set(joint.bindRot[0], joint.bindRot[1], joint.bindRot[2], joint.bindRot[3]);
    bone.matrixAutoUpdate = true;
    if (joint.parent >= 0) (bones[joint.parent] as THREE.Bone).add(bone);
    bones.push(bone);
  }
  return bones;
}

/** Wrap a generated body (its geometry already uploaded) in a posable mesh. */
export function figureBodyToSkinnedMesh(
  body: FigureBody,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): FigureMesh {
  const root = new THREE.Group();
  root.name = 'figure';
  const sphere = new THREE.Sphere(
    new THREE.Vector3(...body.bounds.sphere.center),
    body.bounds.sphere.radius * 1.35,
  );
  if (body.buffers.joints === undefined) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'figure-body';
    root.add(mesh);
    return {
      root,
      mesh,
      skeleton: undefined,
      bones: [],
      dispose: () => {
        root.removeFromParent();
      },
    };
  }
  const bones = buildBones(body.rig);
  const inverses: THREE.Matrix4[] = [];
  for (let j = 0; j < body.rig.joints.length; j++) {
    inverses.push(new THREE.Matrix4().fromArray(body.inverseBind, j * 16));
  }
  const skeleton = new THREE.Skeleton(bones, inverses);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'figure-body';
  mesh.add(bones[0] as THREE.Bone);
  root.add(mesh);
  mesh.updateMatrixWorld(true);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.boundingSphere = sphere;
  mesh.frustumCulled = true;
  return {
    root,
    mesh,
    skeleton,
    bones,
    dispose: () => {
      skeleton.dispose();
      root.removeFromParent();
    },
  };
}

/** Write a pose's local joint transforms into the bones (rig order). */
export function applyPose(pose: FigurePose, bones: readonly THREE.Bone[]): void {
  const local = pose.local;
  for (let j = 0; j < bones.length; j++) {
    const bone = bones[j] as THREE.Bone;
    const o = j * 7;
    bone.position.set(local[o] as number, local[o + 1] as number, local[o + 2] as number);
    bone.quaternion.set(
      local[o + 3] as number,
      local[o + 4] as number,
      local[o + 5] as number,
      local[o + 6] as number,
    );
  }
}

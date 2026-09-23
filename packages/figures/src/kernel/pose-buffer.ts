/**
 * The working representation of a pose while it is being built: one rotation per joint
 * (applied on top of the bind pose, in the joint's local frame) plus a root translation.
 * Gait curves write here; `evaluatePose` turns the result into local joint transforms.
 */

import {
  dmath,
  type Quat,
  quatFromAxisAngle,
  quatMul,
  quatNormalize,
  quatSlerp,
} from '@bendyline/molen-kernel/determinism';

export interface PoseBuffer {
  /** 4 floats per joint: [x, y, z, w]. */
  q: Float32Array;
  /** Root translation [x, y, z] added to the root joint's bind offset. */
  root: Float32Array;
}

export function poseBuffer(jointCount: number): PoseBuffer {
  const buf: PoseBuffer = { q: new Float32Array(jointCount * 4), root: new Float32Array(3) };
  resetPose(buf);
  return buf;
}

export function resetPose(buf: PoseBuffer): void {
  const q = buf.q;
  for (let i = 0; i < q.length; i += 4) {
    q[i] = 0;
    q[i + 1] = 0;
    q[i + 2] = 0;
    q[i + 3] = 1;
  }
  buf.root[0] = 0;
  buf.root[1] = 0;
  buf.root[2] = 0;
}

export function copyPose(from: PoseBuffer, to: PoseBuffer): void {
  to.q.set(from.q);
  to.root.set(from.root);
}

export function getQuat(buf: PoseBuffer, joint: number): Quat {
  const o = joint * 4;
  return [
    buf.q[o] as number,
    buf.q[o + 1] as number,
    buf.q[o + 2] as number,
    buf.q[o + 3] as number,
  ];
}

export function setQuat(buf: PoseBuffer, joint: number, q: Quat): void {
  const o = joint * 4;
  buf.q[o] = q[0];
  buf.q[o + 1] = q[1];
  buf.q[o + 2] = q[2];
  buf.q[o + 3] = q[3];
}

/** Post-multiply a rotation onto a joint (applied in the joint's own local frame). */
export function rotateJoint(buf: PoseBuffer, joint: number, q: Quat): void {
  if (joint < 0) return;
  setQuat(buf, joint, quatNormalize(quatMul(getQuat(buf, joint), q)));
}

const X_AXIS: [number, number, number] = [1, 0, 0];
const Y_AXIS: [number, number, number] = [0, 1, 0];
const Z_AXIS: [number, number, number] = [0, 0, 1];

export function rotateX(buf: PoseBuffer, joint: number, angle: number): void {
  if (angle !== 0) rotateJoint(buf, joint, quatFromAxisAngle(X_AXIS, angle));
}
export function rotateY(buf: PoseBuffer, joint: number, angle: number): void {
  if (angle !== 0) rotateJoint(buf, joint, quatFromAxisAngle(Y_AXIS, angle));
}
export function rotateZ(buf: PoseBuffer, joint: number, angle: number): void {
  if (angle !== 0) rotateJoint(buf, joint, quatFromAxisAngle(Z_AXIS, angle));
}

export function translateRoot(buf: PoseBuffer, x: number, y: number, z: number): void {
  buf.root[0] = (buf.root[0] as number) + x;
  buf.root[1] = (buf.root[1] as number) + y;
  buf.root[2] = (buf.root[2] as number) + z;
}

/** out = slerp(a, b, t) per joint; root lerped. `out` may alias `a` or `b`. */
export function blendPose(a: PoseBuffer, b: PoseBuffer, t: number, out: PoseBuffer): void {
  const joints = a.q.length / 4;
  for (let j = 0; j < joints; j++) setQuat(out, j, quatSlerp(getQuat(a, j), getQuat(b, j), t));
  for (let i = 0; i < 3; i++) out.root[i] = dmath.lerp(a.root[i] as number, b.root[i] as number, t);
}

/**
 * Procedural figure bodies: a resolved descriptor and its rig become a skinned mesh in the
 * Molen style (readable silhouettes, color blocks, gently faceted). Three-free and
 * deterministic: the same descriptor yields byte-identical buffers in Node, a Worker, and the
 * browser, so geometry can be cached and baked by content key.
 */

import {
  type Quat,
  quatConjugate,
  quatRotateVec3,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';
import { buildBipedBody } from './body-biped';
import { buildQuadrupedBody } from './body-quadruped';
import { descriptorKey } from './descriptor';
import { deriveRig, type FigureJoint, type FigureRig, rigBindModel } from './rig';
import {
  type FigureTier,
  type SkinnedMeshBuffers,
  SkinnedMeshBuilder,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

export interface FigureBounds {
  min: Vec3;
  max: Vec3;
  sphere: { center: Vec3; radius: number };
}

export interface FigureBody {
  buffers: SkinnedMeshBuffers;
  rig: FigureRig;
  /** 16 floats (column-major) per joint: the inverse of its rest-pose figure-space transform. */
  inverseBind: Float32Array;
  bounds: FigureBounds;
}

/** Content key of one body: descriptor key plus tier. */
export function figureBodyKey(descriptor: ResolvedFigureDescriptor, tier: FigureTier): string {
  return `${descriptorKey(descriptor)}|${tier}`;
}

function writeInverseRigid(out: Float32Array, offset: number, pos: Vec3, rot: Quat): void {
  const inv = quatConjugate(rot);
  const [x, y, z, w] = inv;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  // Column-major rotation matrix of the inverse rotation.
  const r00 = 1 - 2 * (yy + zz);
  const r01 = 2 * (xy + wz);
  const r02 = 2 * (xz - wy);
  const r10 = 2 * (xy - wz);
  const r11 = 1 - 2 * (xx + zz);
  const r12 = 2 * (yz + wx);
  const r20 = 2 * (xz + wy);
  const r21 = 2 * (yz - wx);
  const r22 = 1 - 2 * (xx + yy);
  const t = quatRotateVec3(inv, [-pos[0], -pos[1], -pos[2]]);
  const m = [r00, r01, r02, 0, r10, r11, r12, 0, r20, r21, r22, 0, t[0], t[1], t[2], 1];
  for (let i = 0; i < 16; i++) out[offset + i] = m[i] as number;
}

/** Inverse bind matrices of a rig (column-major 4x4 per joint), for skinning. */
export function rigInverseBind(rig: FigureRig): Float32Array {
  const bind = rigBindModel(rig);
  const out = new Float32Array(rig.joints.length * 16);
  for (let j = 0; j < rig.joints.length; j++) {
    const o = j * 7;
    writeInverseRigid(
      out,
      j * 16,
      [bind[o] as number, bind[o + 1] as number, bind[o + 2] as number],
      [bind[o + 3] as number, bind[o + 4] as number, bind[o + 5] as number, bind[o + 6] as number],
    );
  }
  return out;
}

function boundsOf(positions: Float32Array): FigureBounds {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k] as number;
      if (v < (min[k] as number)) min[k] = v;
      if (v > (max[k] as number)) max[k] = v;
    }
  }
  if (positions.length === 0)
    return { min: [0, 0, 0], max: [0, 0, 0], sphere: { center: [0, 0, 0], radius: 0 } };
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radiusSq = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = (positions[i] as number) - center[0];
    const dy = (positions[i + 1] as number) - center[1];
    const dz = (positions[i + 2] as number) - center[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d > radiusSq) radiusSq = d;
  }
  return { min, max, sphere: { center, radius: Math.sqrt(radiusSq) } };
}

/**
 * Generate the body of a resolved descriptor at a detail tier (0 near, 1 medium, 2 distant
 * rigid). Pass the rig when already derived; it must come from the same descriptor.
 */
export function generateFigureBody(
  descriptor: ResolvedFigureDescriptor,
  tier: FigureTier,
  rig: FigureRig = deriveRig(descriptor),
): FigureBody {
  const builder = new SkinnedMeshBuilder();
  const detail: FigureTier = tier === 0 ? 0 : 1;
  if (descriptor.archetype === 'biped') buildBipedBody(descriptor, rig, detail, builder);
  else buildQuadrupedBody(descriptor, rig, detail, builder);
  const buffers = builder.finalize(tier, tier !== 2);
  return { buffers, rig, inverseBind: rigInverseBind(rig), bounds: boundsOf(buffers.positions) };
}

/** Joint index by name (throws on a missing joint: a rig/body mismatch is a programming error). */
export function jointIndex(rig: FigureRig, name: string): number {
  const index = rig.index[name];
  if (index === undefined) throw new Error(`rig has no joint "${name}"`);
  return index;
}

/** Rest-pose figure-space position of a joint. */
export function jointPosition(bind: Float64Array, joint: number): Vec3 {
  const o = joint * 7;
  return [bind[o] as number, bind[o + 1] as number, bind[o + 2] as number];
}

export type { FigureJoint };

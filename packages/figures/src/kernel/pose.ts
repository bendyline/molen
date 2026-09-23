/**
 * The pose evaluator shared by both halves: (rig, locomotion state, tick) to local joint
 * transforms. Pure and allocation-light; identical inputs give identical Float32 output in the
 * kernel (sockets) and on the client (bones), which is what keeps hats on heads.
 */

import {
  composeTransforms,
  dmath,
  type Quat,
  quatConjugate,
  quatFromTo,
  quatMul,
  quatNormalize,
  quatRotateVec3,
  type TransformLike,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';
import type {
  FigureAnchor,
  FigureGait,
  FigureIkEffector,
  FigureMode,
  FigureStateData,
} from './components';
import { bipedGaitPose, fallPose, idlePose, jumpPose, quadrupedGaitPose, sitPose } from './gait';
import { solveTwoBoneIk } from './ik';
import {
  blendPose,
  type PoseBuffer,
  poseBuffer,
  resetPose,
  rotateX,
  rotateY,
  setQuat,
} from './pose-buffer';
import type { FigureJoint, FigureRig, FigureSocket } from './rig';

export interface FigurePose {
  rig: FigureRig;
  /** 7 floats per joint in rig order: parent-local position xyz and rotation xyzw. */
  local: Float32Array;
}

export interface PoseEvalOptions {
  tickRate: number;
  /** Seed for idle variation (see `figureSeed`). */
  seed?: number;
  /** Ticks to blend from `state.prevMode` (default 12). */
  blendTicks?: number;
  /** Figure-local point the head aims at. */
  lookTarget?: Vec3;
  /** 0..1 weight of the look-at (default 1). */
  lookWeight?: number;
  /** Joint-local rotations by name that replace the evaluated rotation. */
  overrides?: Record<string, Quat>;
  /** Figure-local effector goals solved after the gait. */
  ik?: Partial<Record<FigureIkEffector, Vec3>>;
  /** Re-anchor the root so this point sits at the figure origin (seats, saddles). */
  anchor?: FigureAnchor;
}

const DEG = dmath.PI / 180;
const IDENTITY: Quat = [0, 0, 0, 1];

/** Gait phase in [0, 1) at a (possibly fractional) tick. */
export function figurePhase(state: FigureStateData, tick: number, tickRate: number): number {
  if (state.strideRate <= 0) return state.phaseAt;
  return dmath.frac(state.phaseAt + (state.strideRate * (tick - state.phaseAtTick)) / tickRate);
}

const scratchBuffers = new Map<number, [PoseBuffer, PoseBuffer]>();
const scratchModels = new Map<number, Float32Array>();

function scratch(jointCount: number): [PoseBuffer, PoseBuffer] {
  let pair = scratchBuffers.get(jointCount);
  if (pair === undefined) {
    pair = [poseBuffer(jointCount), poseBuffer(jointCount)];
    scratchBuffers.set(jointCount, pair);
  }
  return pair;
}

function scratchModel(jointCount: number): Float32Array {
  let model = scratchModels.get(jointCount);
  if (model === undefined) {
    model = new Float32Array(jointCount * 7);
    scratchModels.set(jointCount, model);
  }
  return model;
}

function modePose(
  rig: FigureRig,
  mode: FigureMode,
  phase: number,
  gait: FigureGait | undefined,
  tick: number,
  tickRate: number,
  seed: number,
  buf: PoseBuffer,
): void {
  resetPose(buf);
  switch (mode) {
    case 'idle':
      idlePose(rig, tick / tickRate, seed, buf);
      break;
    case 'walk':
    case 'run':
      if (rig.archetype === 'biped') bipedGaitPose(rig, phase, mode === 'run', buf);
      else quadrupedGaitPose(rig, phase, gait ?? (mode === 'run' ? 'trot' : 'walk'), buf);
      break;
    case 'jump':
      jumpPose(rig, buf);
      break;
    case 'fall':
      fallPose(rig, buf);
      break;
    case 'sit':
      sitPose(rig, buf);
      break;
    default:
      break;
  }
}

function writeLocals(rig: FigureRig, buf: PoseBuffer, local: Float32Array): void {
  for (let j = 0; j < rig.joints.length; j++) {
    const joint = rig.joints[j] as FigureJoint;
    const o = j * 7;
    const q = j * 4;
    local[o] = joint.bindPos[0] + (j === 0 ? (buf.root[0] as number) : 0);
    local[o + 1] = joint.bindPos[1] + (j === 0 ? (buf.root[1] as number) : 0);
    local[o + 2] = joint.bindPos[2] + (j === 0 ? (buf.root[2] as number) : 0);
    const rot = quatMul(joint.bindRot, [
      buf.q[q] as number,
      buf.q[q + 1] as number,
      buf.q[q + 2] as number,
      buf.q[q + 3] as number,
    ]);
    local[o + 3] = rot[0];
    local[o + 4] = rot[1];
    local[o + 5] = rot[2];
    local[o + 6] = rot[3];
  }
}

function readTransform(data: Float32Array, index: number): TransformLike {
  const o = index * 7;
  return {
    pos: [data[o] as number, data[o + 1] as number, data[o + 2] as number],
    rot: [
      data[o + 3] as number,
      data[o + 4] as number,
      data[o + 5] as number,
      data[o + 6] as number,
    ],
  };
}

function writeTransform(data: Float32Array, index: number, t: TransformLike): void {
  const o = index * 7;
  data[o] = t.pos[0];
  data[o + 1] = t.pos[1];
  data[o + 2] = t.pos[2];
  const r = t.rot ?? IDENTITY;
  data[o + 3] = r[0];
  data[o + 4] = r[1];
  data[o + 5] = r[2];
  data[o + 6] = r[3];
}

/** Forward kinematics: every joint's figure-space transform (7 floats per joint). */
export function poseModelSpace(pose: FigurePose, out?: Float32Array): Float32Array {
  const joints = pose.rig.joints;
  const model = out ?? new Float32Array(joints.length * 7);
  for (let j = 0; j < joints.length; j++) {
    const joint = joints[j] as FigureJoint;
    const local = readTransform(pose.local, j);
    writeTransform(
      model,
      j,
      joint.parent < 0 ? local : composeTransforms(readTransform(model, joint.parent), local),
    );
  }
  return model;
}

/** A joint's figure-space transform from a model buffer. */
export function jointTransform(model: Float32Array, joint: number): TransformLike {
  return readTransform(model, joint);
}

/** A socket's figure-space transform under a pose (`model` = poseModelSpace, computed if absent). */
export function socketTransform(
  rig: FigureRig,
  pose: FigurePose,
  socket: string | number,
  model?: Float32Array,
): TransformLike | undefined {
  const index = typeof socket === 'number' ? socket : rig.socketIndex[socket];
  if (index === undefined) return undefined;
  const s = rig.sockets[index] as FigureSocket;
  const m = model ?? poseModelSpace(pose, scratchModel(rig.joints.length));
  const t = composeTransforms(readTransform(m, s.joint), { pos: s.pos, rot: s.rot });
  return { pos: t.pos, rot: t.rot ?? [0, 0, 0, 1] };
}

const IK_CHAINS: Record<FigureIkEffector, { chain: [string, string, string]; pole: Vec3 }> = {
  'hand.l': { chain: ['upperArm.l', 'foreArm.l', 'hand.l'], pole: [0, 0, -1] },
  'hand.r': { chain: ['upperArm.r', 'foreArm.r', 'hand.r'], pole: [0, 0, -1] },
  'foot.l': { chain: ['upperLeg.l', 'lowerLeg.l', 'foot.l'], pole: [0, 0, 1] },
  'foot.r': { chain: ['upperLeg.r', 'lowerLeg.r', 'foot.r'], pole: [0, 0, 1] },
};

function unit(v: Vec3): Vec3 {
  const l = dmath.hypot(v[0], v[1], v[2]);
  return l === 0 ? [0, -1, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

function applyIk(
  rig: FigureRig,
  buf: PoseBuffer,
  model: Float32Array,
  effector: FigureIkEffector,
  goal: Vec3,
): void {
  const { chain, pole } = IK_CHAINS[effector];
  const u = rig.index[chain[0]];
  const l = rig.index[chain[1]];
  const e = rig.index[chain[2]];
  if (u === undefined || l === undefined || e === undefined) return;
  const upper = rig.joints[u] as FigureJoint;
  const lower = rig.joints[l] as FigureJoint;
  const end = rig.joints[e] as FigureJoint;
  const root = readTransform(model, u).pos;
  const parentRot =
    upper.parent >= 0 ? (readTransform(model, upper.parent).rot ?? IDENTITY) : IDENTITY;
  const a = dmath.hypot(lower.bindPos[0], lower.bindPos[1], lower.bindPos[2]);
  const b = dmath.hypot(end.bindPos[0], end.bindPos[1], end.bindPos[2]);
  const solved = solveTwoBoneIk(root, goal, pole, a, b);
  const upperModel = quatFromTo(unit(lower.bindPos), solved.upperDir);
  const lowerModel = quatFromTo(unit(end.bindPos), solved.lowerDir);
  setQuat(
    buf,
    u,
    quatNormalize(quatMul(quatConjugate(quatMul(parentRot, upper.bindRot)), upperModel)),
  );
  setQuat(
    buf,
    l,
    quatNormalize(quatMul(quatConjugate(quatMul(upperModel, lower.bindRot)), lowerModel)),
  );
}

function applyLookAt(
  rig: FigureRig,
  buf: PoseBuffer,
  model: Float32Array,
  target: Vec3,
  weight: number,
): void {
  const head = rig.index.head;
  const neck = rig.index.neck;
  if (head === undefined || neck === undefined) return;
  const hp = readTransform(model, head).pos;
  const d: Vec3 = [target[0] - hp[0], target[1] - hp[1], target[2] - hp[2]];
  const planar = dmath.hypot(d[0], 0, d[2]);
  if (planar < 1e-6 && dmath.abs(d[1]) < 1e-6) return;
  const yaw = dmath.atan2(d[0], d[2]);
  const pitch = dmath.atan2(d[1], planar);
  const w = dmath.clamp(weight, 0, 1);
  rotateY(buf, neck, w * dmath.clamp(0.4 * yaw, -35 * DEG, 35 * DEG));
  rotateX(buf, neck, -w * dmath.clamp(0.4 * pitch, -20 * DEG, 20 * DEG));
  rotateY(buf, head, w * dmath.clamp(0.6 * yaw, -70 * DEG, 70 * DEG));
  rotateX(buf, head, -w * dmath.clamp(0.6 * pitch, -35 * DEG, 35 * DEG));
}

/**
 * Evaluate the pose of a rig at a tick. `state` undefined means a standing idle. Pass `out` to
 * reuse a pose buffer of the same rig (no allocation per call).
 */
export function evaluatePose(
  rig: FigureRig,
  state: FigureStateData | undefined,
  tick: number,
  opts: PoseEvalOptions,
  out?: FigurePose,
): FigurePose {
  const jointCount = rig.joints.length;
  const pose =
    out !== undefined && out.rig === rig && out.local.length === jointCount * 7
      ? out
      : { rig, local: new Float32Array(jointCount * 7) };
  const [cur, prev] = scratch(jointCount);
  const mode = state?.mode ?? 'idle';
  const phase = state === undefined ? 0 : figurePhase(state, tick, opts.tickRate);
  const seed = opts.seed ?? 0;
  modePose(rig, mode, phase, state?.gait, tick, opts.tickRate, seed, cur);
  const blendTicks = opts.blendTicks ?? 12;
  if (state?.prevMode !== undefined && blendTicks > 0) {
    const w = dmath.smoothstep((tick - state.modeAtTick) / blendTicks);
    if (w < 1) {
      modePose(rig, state.prevMode, phase, state.gait, tick, opts.tickRate, seed, prev);
      blendPose(prev, cur, w, cur);
    }
  }
  if (opts.overrides !== undefined) {
    for (const [name, q] of Object.entries(opts.overrides)) {
      const index = rig.index[name];
      if (index !== undefined) setQuat(cur, index, quatNormalize(q));
    }
  }
  writeLocals(rig, cur, pose.local);
  const needsModel =
    opts.ik !== undefined ||
    (opts.lookTarget !== undefined && (opts.lookWeight ?? 1) > 0) ||
    (opts.anchor !== undefined && opts.anchor !== 'origin');
  if (!needsModel) return pose;
  const model = scratchModel(jointCount);
  if (opts.ik !== undefined) {
    poseModelSpace(pose, model);
    for (const effector of ['hand.l', 'hand.r', 'foot.l', 'foot.r'] as const) {
      const goal = opts.ik[effector];
      if (goal !== undefined) applyIk(rig, cur, model, effector, goal);
    }
    writeLocals(rig, cur, pose.local);
  }
  if (opts.lookTarget !== undefined && (opts.lookWeight ?? 1) > 0) {
    poseModelSpace(pose, model);
    applyLookAt(rig, cur, model, opts.lookTarget, opts.lookWeight ?? 1);
    writeLocals(rig, cur, pose.local);
  }
  if (opts.anchor !== undefined && opts.anchor !== 'origin') {
    poseModelSpace(pose, model);
    let p: Vec3 | undefined;
    if (opts.anchor === 'pelvis') {
      const hips = rig.index.hips;
      if (hips !== undefined) p = readTransform(model, hips).pos;
    } else {
      p = socketTransform(rig, pose, 'eye', model)?.pos;
    }
    if (p !== undefined) {
      pose.local[0] = (pose.local[0] as number) - p[0];
      pose.local[1] = (pose.local[1] as number) - p[1];
      pose.local[2] = (pose.local[2] as number) - p[2];
    }
  }
  return pose;
}

/** A figure-space transform into world space through the entity transform. */
export function figureToWorld(entity: TransformLike, local: TransformLike): TransformLike {
  return composeTransforms(entity, local);
}

/** A world point into figure space (the inverse of the entity transform, scale ignored). */
export function worldToFigure(entity: TransformLike, point: Vec3): Vec3 {
  const inv = quatConjugate(entity.rot ?? IDENTITY);
  return quatRotateVec3(inv, [
    point[0] - entity.pos[0],
    point[1] - entity.pos[1],
    point[2] - entity.pos[2],
  ]);
}

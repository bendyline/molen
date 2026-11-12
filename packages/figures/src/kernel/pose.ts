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
  /** Saddle-relative contact points for a cycle rider, evaluated after the seated pose. */
  riding?: {
    lean: number;
    turn?: number;
    ik: Partial<Record<FigureIkEffector, Vec3>>;
    /**
     * Default `seated`. A `standing` or `sideways` rider stands on the idle pose instead of the
     * seated one, the hips raised or lowered to this body's legs; a sideways rider turns across
     * the board, left foot forward, and looks down it.
     */
    stance?: 'seated' | 'standing' | 'sideways';
    /** Sideways riders: 0 riding across the board to 1 turned forward to push off. */
    push?: number;
  };
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
  /** Turns the knee or elbow direction with a body turned this far about Y. */
  poleYaw = 0,
): void {
  const { chain } = IK_CHAINS[effector];
  let { pole } = IK_CHAINS[effector];
  if (poleYaw !== 0) {
    const c = dmath.cos(poleYaw),
      s = dmath.sin(poleYaw);
    pole = [pole[0] * c + pole[2] * s, pole[1], -pole[0] * s + pole[2] * c];
  }
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
  const riding = rig.archetype === 'biped' ? opts.riding : undefined;
  const stance = riding?.stance ?? 'seated';
  // A rider standing on a deck or a board stands on the idle pose, whatever the host's seat mode.
  const upright = riding !== undefined && stance !== 'seated';
  const mode = upright ? 'idle' : (state?.mode ?? 'idle');
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
  // A sideways rider faces the board's right side; pushing off turns them forward.
  const push = stance === 'sideways' ? dmath.clamp(riding?.push ?? 0, 0, 1) : 0;
  const bodyYaw = stance === 'sideways' ? dmath.lerp(-84 * DEG, -18 * DEG, push) : 0;
  if (riding !== undefined) {
    // Replace the chair's upright torso with the posture authored for these handlebars.
    const spine = rig.index.spine;
    if (spine !== undefined)
      setQuat(cur, spine, [dmath.sin(riding.lean / 2), 0, 0, dmath.cos(riding.lean / 2)]);
    const hips = rig.index.hips,
      chest = rig.index.chest;
    if (stance === 'sideways') {
      // Hips across the board, shoulders opened a little toward the nose, head down the board.
      const open = (1 - push) * 22 * DEG;
      if (hips !== undefined)
        setQuat(cur, hips, [0, dmath.sin(bodyYaw / 2), 0, dmath.cos(bodyYaw / 2)]);
      if (chest !== undefined)
        setQuat(cur, chest, [0, dmath.sin(open / 2), 0, dmath.cos(open / 2)]);
      const look = -bodyYaw - open;
      const neck = rig.index.neck,
        head = rig.index.head;
      if (neck !== undefined) rotateY(cur, neck, 0.4 * look);
      if (head !== undefined) rotateY(cur, head, 0.6 * look);
    } else {
      // At walking-speed steering lock the rider counterweights at the saddle and turns their
      // shoulders with the bars. At speed the steering angle fades, so chassis lean dominates.
      // Standing, the counterweight is the hips' smaller sway over the feet.
      const turn = riding.turn ?? 0;
      const sway = turn * (upright ? 0.3 : 0.75);
      if (hips !== undefined) setQuat(cur, hips, [0, 0, dmath.sin(sway / 2), dmath.cos(sway / 2)]);
      if (chest !== undefined)
        setQuat(cur, chest, [0, dmath.sin(turn / 2), 0, dmath.cos(turn / 2)]);
    }
  }
  writeLocals(rig, cur, pose.local);
  const needsModel =
    opts.riding !== undefined ||
    opts.ik !== undefined ||
    (opts.lookTarget !== undefined && (opts.lookWeight ?? 1) > 0) ||
    (opts.anchor !== undefined && opts.anchor !== 'origin');
  if (!needsModel) return pose;
  const model = scratchModel(jointCount);
  // How far an upright rider's hips sit below the seat, which is an adult's hip position.
  let drop = 0;
  if (riding !== undefined) {
    poseModelSpace(pose, model);
    const hips = rig.index.hips;
    const origin = hips === undefined ? [0, 0, 0] : readTransform(model, hips).pos;
    if (upright) drop = fitHips(rig, model, origin, riding.ik, stance, push);
    for (const effector of ['hand.l', 'hand.r', 'foot.l', 'foot.r'] as const) {
      const target = riding.ik[effector];
      if (target === undefined) continue;
      // Feet and grips stay where the vehicle has them; a sideways rider's free hands move
      // with the hips instead.
      const free = stance === 'sideways' && effector.startsWith('hand');
      applyIk(
        rig,
        cur,
        model,
        effector,
        [
          target[0] + (origin[0] ?? 0),
          target[1] + (origin[1] ?? 0) + (free ? 0 : drop),
          target[2] + (origin[2] ?? 0),
        ],
        bodyYaw,
      );
    }
    writeLocals(rig, cur, pose.local);
    poseModelSpace(pose, model);
    // Keep the shoes level on the pedals/footrests as the knees flex. A standing rider's rear
    // foot splays out; a sideways rider's feet lie across the board, turning forward to push.
    const feet = footYaws(riding.ik, stance, push);
    for (const [k, name] of (['foot.l', 'foot.r'] as const).entries()) {
      const index = rig.index[name];
      const joint = index === undefined ? undefined : rig.joints[index];
      if (index === undefined || joint === undefined || joint.parent < 0) continue;
      const level = quatConjugate(
        quatMul(readTransform(model, joint.parent).rot ?? IDENTITY, joint.bindRot),
      );
      const yaw = feet[k] ?? 0;
      setQuat(
        cur,
        index,
        yaw === 0 ? level : quatMul(level, [0, dmath.sin(yaw / 2), 0, dmath.cos(yaw / 2)]),
      );
    }
    writeLocals(rig, cur, pose.local);
  }
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
      pose.local[1] = (pose.local[1] as number) - p[1] - (opts.anchor === 'pelvis' ? drop : 0);
      pose.local[2] = (pose.local[2] as number) - p[2];
    }
  }
  return pose;
}

/**
 * How far an upright rider's hips must drop below the seat (negative: rise) so the farther foot
 * reaches its target with the knee slightly bent: nearly straight standing, a soft crouch riding
 * sideways, the push leg reaching for the ground. Feet are seat-relative, as `riding.ik`.
 */
function fitHips(
  rig: FigureRig,
  model: Float32Array,
  origin: readonly number[],
  ik: Partial<Record<FigureIkEffector, Vec3>>,
  stance: 'seated' | 'standing' | 'sideways',
  push: number,
): number {
  const extension = stance === 'standing' ? 0.97 : dmath.lerp(0.9, 0.97, push);
  let drop = Number.NEGATIVE_INFINITY;
  for (const effector of ['foot.l', 'foot.r'] as const) {
    const goal = ik[effector];
    const { chain } = IK_CHAINS[effector];
    const u = rig.index[chain[0]],
      l = rig.index[chain[1]],
      e = rig.index[chain[2]];
    if (goal === undefined || u === undefined || l === undefined || e === undefined) continue;
    const lower = rig.joints[l] as FigureJoint,
      end = rig.joints[e] as FigureJoint;
    const reach =
      extension *
      (dmath.hypot(lower.bindPos[0], lower.bindPos[1], lower.bindPos[2]) +
        dmath.hypot(end.bindPos[0], end.bindPos[1], end.bindPos[2]));
    const root = readTransform(model, u).pos;
    const dx = goal[0] + (origin[0] ?? 0) - root[0],
      dz = goal[2] + (origin[2] ?? 0) - root[2];
    const below = root[1] - (goal[1] + (origin[1] ?? 0));
    const vertical = dmath.sqrt(dmath.max(0, reach * reach - dx * dx - dz * dz));
    drop = dmath.max(drop, below - vertical);
  }
  return Number.isFinite(drop) ? drop : 0;
}

/**
 * Each shoe's turn about Y from straight ahead, left then right. Seated riders keep both
 * forward; a standing rider's rear foot splays out; a sideways rider's feet point across the
 * board toward its right side, the front one angled to the nose, both turning forward to push.
 */
function footYaws(
  ik: Partial<Record<FigureIkEffector, Vec3>>,
  stance: 'seated' | 'standing' | 'sideways',
  push: number,
): [number, number] {
  if (stance === 'seated') return [0, 0];
  if (stance === 'sideways')
    return [dmath.lerp(-72 * DEG, -8 * DEG, push), dmath.lerp(-98 * DEG, -24 * DEG, push)];
  // Splay the trailing foot outward: the right toward -x, the left toward +x.
  return (ik['foot.l']?.[2] ?? 0) >= (ik['foot.r']?.[2] ?? 0) ? [0, -20 * DEG] : [20 * DEG, 0];
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

/**
 * Canonical rigs: a fixed, parent-first joint order per archetype (the pose buffer layout),
 * bind-pose offsets derived from the descriptor metrics, and named sockets (attachment points)
 * in joint-local space. Bind rotations are identity, so every joint's local axes coincide with
 * the figure frame in the rest pose: +Y up, +Z forward, +X the figure's left.
 */

import {
  composeTransforms,
  dmath,
  type Quat,
  quatRotateVec3,
  type TransformLike,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';
import type { MountableData } from '@bendyline/molen-kernel/vehicles';
import { descriptorKey } from './descriptor';
import { deriveMetrics, type FigureMetrics } from './proportions';
import type { FigureArchetype, ResolvedFigureDescriptor } from './types';

export interface FigureJoint {
  name: string;
  /** Parent joint index, always smaller than the joint's own index; -1 for the root. */
  parent: number;
  /** Parent-local rest offset, meters. */
  bindPos: Vec3;
  bindRot: Quat;
  /** Length of the segment this joint drives, meters (0 for leaf/helper joints). */
  length: number;
}

export interface FigureSocket {
  name: string;
  joint: number;
  /** Joint-local offset, meters. */
  pos: Vec3;
  /** Joint-local orientation; +Z of the socket faces "out". */
  rot: Quat;
}

export interface FigureRig {
  archetype: FigureArchetype;
  /** Content key of the descriptor this rig was derived from. */
  key: string;
  joints: readonly FigureJoint[];
  index: Readonly<Record<string, number>>;
  sockets: readonly FigureSocket[];
  socketIndex: Readonly<Record<string, number>>;
  metrics: FigureMetrics;
  height: number;
  legLength: number;
  hipHeight: number;
  eyeHeight: number;
}

export const BIPED_JOINT_NAMES: readonly string[] = [
  'root',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulder.l',
  'upperArm.l',
  'foreArm.l',
  'hand.l',
  'shoulder.r',
  'upperArm.r',
  'foreArm.r',
  'hand.r',
  'upperLeg.l',
  'lowerLeg.l',
  'foot.l',
  'toes.l',
  'upperLeg.r',
  'lowerLeg.r',
  'foot.r',
  'toes.r',
];

export const QUADRUPED_JOINT_NAMES: readonly string[] = [
  'root',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'ear.l',
  'ear.r',
  'upperLeg.fl',
  'lowerLeg.fl',
  'foot.fl',
  'toes.fl',
  'upperLeg.fr',
  'lowerLeg.fr',
  'foot.fr',
  'toes.fr',
  'upperLeg.hl',
  'lowerLeg.hl',
  'foot.hl',
  'toes.hl',
  'upperLeg.hr',
  'lowerLeg.hr',
  'foot.hr',
  'toes.hr',
  'tail.0',
  'tail.1',
  'tail.2',
];

export const BIPED_SOCKET_NAMES: readonly string[] = [
  'head.top',
  'face',
  'eyes',
  'eye',
  'ear.l',
  'ear.r',
  'neck',
  'chest',
  'back',
  'hip.l',
  'hip.r',
  'hand.l',
  'hand.r',
  'foot.l',
  'foot.r',
  'pelvis',
];

export const QUADRUPED_SOCKET_NAMES: readonly string[] = [
  'head.top',
  'face',
  'eyes',
  'eye',
  'mouth',
  'neck',
  'withers',
  'saddle',
  'back',
  'tail.tip',
  'foot.fl',
  'foot.fr',
  'foot.hl',
  'foot.hr',
  'pelvis',
];

const IDENTITY: Quat = [0, 0, 0, 1];
/** Half turn about +Y: a socket whose +Z faces backward. */
const YAW_180: Quat = [0, 1, 0, 0];
const A_POSE = (15 * dmath.PI) / 180;
const TAIL_DROOP = (35 * dmath.PI) / 180;

/** The name of the mirrored joint or socket ('.l' ↔ '.r', 'fl' ↔ 'fr', 'hl' ↔ 'hr'). */
export function mirrorName(name: string): string {
  if (name.endsWith('.l')) return `${name.slice(0, -2)}.r`;
  if (name.endsWith('.r')) return `${name.slice(0, -2)}.l`;
  if (name.endsWith('.fl')) return `${name.slice(0, -3)}.fr`;
  if (name.endsWith('.fr')) return `${name.slice(0, -3)}.fl`;
  if (name.endsWith('.hl')) return `${name.slice(0, -3)}.hr`;
  if (name.endsWith('.hr')) return `${name.slice(0, -3)}.hl`;
  return name;
}

class RigBuilder {
  readonly joints: FigureJoint[] = [];
  readonly index: Record<string, number> = {};
  readonly sockets: FigureSocket[] = [];
  readonly socketIndex: Record<string, number> = {};

  joint(name: string, parent: string | null, bindPos: Vec3, length: number): void {
    const parentIndex = parent === null ? -1 : this.index[parent];
    if (parent !== null && parentIndex === undefined) {
      throw new Error(`rig joint "${name}" declared before its parent "${parent}"`);
    }
    this.index[name] = this.joints.length;
    this.joints.push({
      name,
      parent: parentIndex ?? -1,
      bindPos,
      bindRot: [...IDENTITY],
      length,
    });
  }

  /** A left/right joint pair from the left offset (x mirrored for the right side). */
  pair(
    base: string,
    side: [string, string],
    parent: [string, string] | string,
    pos: Vec3,
    length: number,
  ): void {
    const [l, r] = side;
    const parentL = typeof parent === 'string' ? parent : parent[0];
    const parentR = typeof parent === 'string' ? parent : parent[1];
    this.joint(`${base}.${l}`, parentL, pos, length);
    this.joint(`${base}.${r}`, parentR, [-pos[0], pos[1], pos[2]], length);
  }

  socket(name: string, joint: string, pos: Vec3, rot: Quat = IDENTITY): void {
    const jointIndex = this.index[joint];
    if (jointIndex === undefined)
      throw new Error(`rig socket "${name}" on unknown joint "${joint}"`);
    this.socketIndex[name] = this.sockets.length;
    this.sockets.push({ name, joint: jointIndex, pos, rot: [...rot] });
  }
}

function buildBiped(m: FigureMetrics, b: RigBuilder): void {
  const s = dmath.sin(A_POSE);
  const c = dmath.cos(A_POSE);
  b.joint('root', null, [0, 0, 0], 0);
  b.joint('hips', 'root', [0, m.hipHeight, 0], m.hipsLen);
  b.joint('spine', 'hips', [0, m.hipsLen, 0], m.spineLen);
  b.joint('chest', 'spine', [0, m.spineLen, 0], m.chestLen);
  b.joint('neck', 'chest', [0, m.chestLen, 0], m.neckLen);
  b.joint('head', 'neck', [0, m.neckLen, 0], m.headLen);
  for (const side of ['l', 'r'] as const) {
    const sign = side === 'l' ? 1 : -1;
    b.joint(
      `shoulder.${side}`,
      'chest',
      [sign * 0.45 * m.shoulderHalf, 0.85 * m.chestLen, 0],
      0.55 * m.shoulderHalf,
    );
    b.joint(
      `upperArm.${side}`,
      `shoulder.${side}`,
      [sign * 0.55 * m.shoulderHalf, 0, 0],
      m.upperArmLen,
    );
    b.joint(
      `foreArm.${side}`,
      `upperArm.${side}`,
      [sign * s * m.upperArmLen, -c * m.upperArmLen, 0],
      m.foreArmLen,
    );
    b.joint(
      `hand.${side}`,
      `foreArm.${side}`,
      [sign * s * m.foreArmLen, -c * m.foreArmLen, 0],
      m.handLen,
    );
  }
  for (const side of ['l', 'r'] as const) {
    const sign = side === 'l' ? 1 : -1;
    b.joint(`upperLeg.${side}`, 'hips', [sign * m.hipHalf, 0, 0], m.upperLegLen);
    b.joint(`lowerLeg.${side}`, `upperLeg.${side}`, [0, -m.upperLegLen, 0], m.lowerLegLen);
    b.joint(
      `foot.${side}`,
      `lowerLeg.${side}`,
      [0, -m.lowerLegLen, 0],
      dmath.hypot(m.ankleHeight, 0.6 * m.footLen),
    );
    b.joint(`toes.${side}`, `foot.${side}`, [0, -m.ankleHeight, 0.6 * m.footLen], 0.4 * m.footLen);
  }
  b.socket('head.top', 'head', [0, m.headLen, 0]);
  b.socket('face', 'head', [0, 0.5 * m.headLen, 0.5 * m.headWidth]);
  b.socket('eyes', 'head', [0, 0.6 * m.headLen, 0.45 * m.headWidth]);
  b.socket('eye', 'head', [0, 0.55 * m.headLen, 0.4 * m.headWidth]);
  b.socket('ear.l', 'head', [0.5 * m.headWidth, 0.55 * m.headLen, 0]);
  b.socket('ear.r', 'head', [-0.5 * m.headWidth, 0.55 * m.headLen, 0]);
  b.socket('neck', 'neck', [0, 0.5 * m.neckLen, 0]);
  b.socket('chest', 'chest', [0, 0.5 * m.chestLen, m.torsoRadius]);
  b.socket('back', 'chest', [0, 0.5 * m.chestLen, -m.torsoRadius], YAW_180);
  b.socket('hip.l', 'hips', [1.3 * m.hipHalf, 0, 0]);
  b.socket('hip.r', 'hips', [-1.3 * m.hipHalf, 0, 0]);
  b.socket('hand.l', 'hand.l', [0, -0.5 * m.handLen, 0]);
  b.socket('hand.r', 'hand.r', [0, -0.5 * m.handLen, 0]);
  b.socket('foot.l', 'toes.l', [0, 0, 0]);
  b.socket('foot.r', 'toes.r', [0, 0, 0]);
  b.socket('pelvis', 'hips', [0, 0, 0]);
}

function buildQuadruped(m: FigureMetrics, b: RigBuilder): void {
  const tailSeg = dmath.max(m.tailLen / 3, 0.01);
  const tailStep: Vec3 = [0, -dmath.sin(TAIL_DROOP) * tailSeg, -dmath.cos(TAIL_DROOP) * tailSeg];
  b.joint('root', null, [0, 0, 0], 0);
  b.joint('hips', 'root', [0, m.legY, m.hipZ], -m.hipZ);
  b.joint('spine', 'hips', [0, 0, -m.hipZ], m.chestZ);
  b.joint('chest', 'spine', [0, 0, m.chestZ], 0.6 * m.bodyRadius);
  b.joint('neck', 'chest', [0, 0.4 * m.bodyRadius, 0.35 * m.bodyRadius], m.neckLen);
  b.joint(
    'head',
    'neck',
    [0, dmath.sin(m.neckPitch) * m.neckLen, dmath.cos(m.neckPitch) * m.neckLen],
    m.headLen,
  );
  b.joint('ear.l', 'head', [0.5 * m.headWidth, 0.5 * m.headHeight, 0.1 * m.headLen], m.earLen);
  b.joint('ear.r', 'head', [-0.5 * m.headWidth, 0.5 * m.headHeight, 0.1 * m.headLen], m.earLen);
  const legs: [string, string, Vec3][] = [
    ['fl', 'chest', [m.shoulderHalf, 0, 0.05 * m.bodyLength]],
    ['fr', 'chest', [-m.shoulderHalf, 0, 0.05 * m.bodyLength]],
    ['hl', 'hips', [m.hipHalf, 0, -0.02 * m.bodyLength]],
    ['hr', 'hips', [-m.hipHalf, 0, -0.02 * m.bodyLength]],
  ];
  for (const [leg, parent, pos] of legs) {
    b.joint(`upperLeg.${leg}`, parent, pos, m.quadUpperLen);
    b.joint(`lowerLeg.${leg}`, `upperLeg.${leg}`, [0, -m.quadUpperLen, 0], m.quadLowerLen);
    b.joint(`foot.${leg}`, `lowerLeg.${leg}`, [0, -m.quadLowerLen, 0], m.quadFootLen);
    b.joint(`toes.${leg}`, `foot.${leg}`, [0, -m.quadFootLen, 0.4 * m.quadToesLen], m.quadToesLen);
  }
  b.joint('tail.0', 'hips', [0, 0.6 * m.bodyRadius, -0.5 * m.bodyRadius], tailSeg);
  b.joint('tail.1', 'tail.0', tailStep, tailSeg);
  b.joint('tail.2', 'tail.1', tailStep, tailSeg);
  const hp = m.headPitch;
  b.socket('head.top', 'head', [0, 0.5 * m.headHeight, 0.2 * m.headLen]);
  b.socket('face', 'head', [0, -dmath.sin(hp) * m.headLen, dmath.cos(hp) * m.headLen]);
  b.socket('eyes', 'head', [0, 0.25 * m.headHeight, 0.45 * m.headLen]);
  b.socket('eye', 'head', [0, 0.25 * m.headHeight, 0.45 * m.headLen]);
  b.socket('mouth', 'head', [0, -0.3 * m.headHeight, 0.9 * m.headLen]);
  b.socket('neck', 'neck', [
    0,
    0.5 * dmath.sin(m.neckPitch) * m.neckLen,
    0.5 * dmath.cos(m.neckPitch) * m.neckLen,
  ]);
  b.socket('withers', 'chest', [0, m.bodyRadius, 0]);
  b.socket('saddle', 'spine', [0, 0.95 * m.bodyRadius, 0]);
  b.socket('back', 'spine', [0, 0.95 * m.bodyRadius, -0.15 * m.bodyLength], YAW_180);
  b.socket('tail.tip', 'tail.2', tailStep);
  for (const leg of ['fl', 'fr', 'hl', 'hr']) {
    b.socket(`foot.${leg}`, `toes.${leg}`, [0, -0.04 * m.legY, 0]);
  }
  b.socket('pelvis', 'hips', [0, 0, 0]);
}

/** Rest-pose transforms of every joint in figure space (7 floats per joint: pos, quat). */
export function rigBindModel(rig: FigureRig): Float64Array {
  const out = new Float64Array(rig.joints.length * 7);
  for (let j = 0; j < rig.joints.length; j++) {
    const joint = rig.joints[j] as FigureJoint;
    let t: TransformLike = { pos: joint.bindPos, rot: joint.bindRot };
    if (joint.parent >= 0) {
      const p = joint.parent * 7;
      t = composeTransforms(
        {
          pos: [out[p] as number, out[p + 1] as number, out[p + 2] as number],
          rot: [
            out[p + 3] as number,
            out[p + 4] as number,
            out[p + 5] as number,
            out[p + 6] as number,
          ],
        },
        t,
      );
    }
    const o = j * 7;
    out[o] = t.pos[0];
    out[o + 1] = t.pos[1];
    out[o + 2] = t.pos[2];
    const r = t.rot ?? IDENTITY;
    out[o + 3] = r[0];
    out[o + 4] = r[1];
    out[o + 5] = r[2];
    out[o + 6] = r[3];
  }
  return out;
}

/** A socket's rest-pose position in figure space. */
export function socketBindPosition(
  rig: FigureRig,
  name: string,
  model?: Float64Array,
): Vec3 | undefined {
  const index = rig.socketIndex[name];
  if (index === undefined) return undefined;
  const socket = rig.sockets[index] as FigureSocket;
  const bind = model ?? rigBindModel(rig);
  const o = socket.joint * 7;
  const pos: Vec3 = [bind[o] as number, bind[o + 1] as number, bind[o + 2] as number];
  const rot: Quat = [
    bind[o + 3] as number,
    bind[o + 4] as number,
    bind[o + 5] as number,
    bind[o + 6] as number,
  ];
  const r = quatRotateVec3(rot, socket.pos);
  return [pos[0] + r[0], pos[1] + r[1], pos[2] + r[2]];
}

/** Derive the canonical rig of a resolved descriptor (pure; cache by `descriptorKey`). */
export function deriveRig(d: ResolvedFigureDescriptor): FigureRig {
  const metrics = deriveMetrics(d);
  const b = new RigBuilder();
  if (d.archetype === 'biped') buildBiped(metrics, b);
  else buildQuadruped(metrics, b);
  const rig: FigureRig = {
    archetype: d.archetype,
    key: descriptorKey(d),
    joints: b.joints,
    index: b.index,
    sockets: b.sockets,
    socketIndex: b.socketIndex,
    metrics,
    height: d.height,
    legLength: metrics.legLength,
    hipHeight: metrics.hipHeight,
    eyeHeight: 0,
  };
  const eye = socketBindPosition(rig, 'eye');
  return { ...rig, eyeHeight: eye === undefined ? d.height : eye[1] };
}

/** A `mountable` component for a figure: rideable sockets become passenger seats. */
export function figureMountable(rig: FigureRig): MountableData {
  const bind = rigBindModel(rig);
  const seats: MountableData['seats'] = [];
  const saddle = socketBindPosition(rig, 'saddle', bind);
  if (saddle !== undefined && rig.archetype === 'quadruped') {
    seats.push({ id: 'saddle', role: 'passenger', position: saddle });
  }
  const side = rig.metrics.bodyRadius + 0.6;
  const rear = rig.metrics.bodyLength / 2 + 0.6;
  return {
    seats,
    exits: [
      [side, 0, 0],
      [-side, 0, 0],
      [0, 0, -rear],
    ],
    reach: 2.5,
  };
}

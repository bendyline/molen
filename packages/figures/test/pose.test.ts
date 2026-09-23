import { hashBytes, quatRotateVec3, yawOf } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  evaluatePose,
  FIGURE_MODES,
  type FigureRig,
  type FigureStateData,
  figurePhase,
  jointTransform,
  poseModelSpace,
  resolveFigureDescriptor,
  socketTransform,
  strideRateFor,
} from '../src/kernel';

const TICK_RATE = 60;
const human = deriveRig(resolveFigureDescriptor({ preset: 'human.adult' }));
const horse = deriveRig(resolveFigureDescriptor({ preset: 'horse' }));

function walking(rig: FigureRig, speed: number, mode: 'walk' | 'run' = 'walk'): FigureStateData {
  return {
    mode,
    speed,
    strideRate: strideRateFor(speed, rig.legLength),
    phaseAt: 0,
    phaseAtTick: 0,
    modeAtTick: 0,
  };
}

function bytes(pose: { local: Float32Array }): string {
  return hashBytes(new Uint8Array(pose.local.buffer, pose.local.byteOffset, pose.local.byteLength));
}

describe('pose evaluation', () => {
  it('is a pure function of its inputs', () => {
    const state = walking(human, 1.4);
    const a = evaluatePose(human, state, 37.25, { tickRate: TICK_RATE, seed: 7 });
    const b = evaluatePose(human, state, 37.25, { tickRate: TICK_RATE, seed: 7 });
    expect(bytes(a)).toBe(bytes(b));
    const reused = evaluatePose(human, state, 37.25, { tickRate: TICK_RATE, seed: 7 }, a);
    expect(reused).toBe(a);
    expect(bytes(reused)).toBe(bytes(b));
  });

  it('stays finite and unit-length across modes, rigs and fractional ticks', () => {
    for (const rig of [human, horse]) {
      for (const mode of FIGURE_MODES) {
        const state: FigureStateData = { ...walking(rig, 2), mode };
        for (let tick = 0; tick <= 120; tick += 7.25) {
          const pose = evaluatePose(rig, state, tick, { tickRate: TICK_RATE, seed: 3 });
          for (let j = 0; j < rig.joints.length; j++) {
            const o = j * 7;
            for (let k = 0; k < 7; k++) expect(Number.isFinite(pose.local[o + k])).toBe(true);
            const len = Math.hypot(
              pose.local[o + 3] as number,
              pose.local[o + 4] as number,
              pose.local[o + 5] as number,
              pose.local[o + 6] as number,
            );
            expect(len).toBeCloseTo(1, 4);
          }
        }
      }
    }
  });

  it('reconstructs a continuous phase from tick-anchored state', () => {
    const slow = walking(human, 1.2);
    const tick = 200;
    const phase = figurePhase(slow, tick, TICK_RATE);
    // Re-anchoring at a speed change (what the locomotion system does) keeps the phase.
    const fast: FigureStateData = {
      ...walking(human, 2.4),
      phaseAt: phase,
      phaseAtTick: tick,
    };
    expect(figurePhase(fast, tick, TICK_RATE)).toBeCloseTo(phase, 12);
    expect(figurePhase(fast, tick + 1, TICK_RATE) - phase).toBeCloseTo(
      fast.strideRate / TICK_RATE,
      12,
    );
    expect(figurePhase(fast, tick - 0.5, TICK_RATE)).toBeGreaterThanOrEqual(0);
  });

  it('moves the legs in opposition while walking', () => {
    const state = walking(human, 1.4);
    const pose = evaluatePose(human, state, 0, { tickRate: TICK_RATE });
    const model = poseModelSpace(pose);
    const left = jointTransform(model, human.index['foot.l'] as number).pos;
    const right = jointTransform(model, human.index['foot.r'] as number).pos;
    // Left heel strike at phase 0: the left foot is ahead (+Z), the right foot behind.
    expect(left[2]).toBeGreaterThan(right[2] + 0.2);
    const half = evaluatePose(human, { ...state, phaseAt: 0.5 }, 0, { tickRate: TICK_RATE });
    const halfModel = poseModelSpace(half);
    expect(jointTransform(halfModel, human.index['foot.r'] as number).pos[2]).toBeGreaterThan(
      jointTransform(halfModel, human.index['foot.l'] as number).pos[2] + 0.2,
    );
  });

  it('blends out of the previous mode over blendTicks', () => {
    const idle = evaluatePose(human, undefined, 0, { tickRate: TICK_RATE, seed: 1 });
    const walk = walking(human, 1.4);
    const blended: FigureStateData = { ...walk, prevMode: 'idle', modeAtTick: 0 };
    const start = evaluatePose(human, blended, 0, { tickRate: TICK_RATE, seed: 1, blendTicks: 12 });
    const end = evaluatePose(human, blended, 12, { tickRate: TICK_RATE, seed: 1, blendTicks: 12 });
    const pureWalk = evaluatePose(human, walk, 12, { tickRate: TICK_RATE, seed: 1 });
    expect(bytes(start)).toBe(bytes(idle));
    expect(bytes(end)).toBe(bytes(pureWalk));
  });

  it('aims the head at a look target within clamps', () => {
    const noLook = evaluatePose(human, undefined, 30, { tickRate: TICK_RATE, seed: 2 });
    const look = evaluatePose(human, undefined, 30, {
      tickRate: TICK_RATE,
      seed: 2,
      lookTarget: [5, human.eyeHeight, 0.5],
    });
    const head = human.index.head as number;
    const yawNoLook = yawOf(jointTransform(poseModelSpace(noLook), head).rot ?? [0, 0, 0, 1]);
    const yawLook = yawOf(jointTransform(poseModelSpace(look), head).rot ?? [0, 0, 0, 1]);
    expect(yawLook - yawNoLook).toBeGreaterThan(0.5);
    expect(yawLook - yawNoLook).toBeLessThanOrEqual((105 * Math.PI) / 180 + 1e-6);
  });

  it('reaches inverse-kinematics goals and clamps beyond reach', () => {
    const shoulder = human.index['upperArm.l'] as number;
    const hand = human.index['hand.l'] as number;
    const bind = poseModelSpace(
      evaluatePose(human, { ...walking(human, 0), mode: 'custom' }, 0, { tickRate: TICK_RATE }),
    );
    const root = jointTransform(bind, shoulder).pos;
    const reach = human.metrics.upperArmLen + human.metrics.foreArmLen;
    const goal: [number, number, number] = [
      root[0] + 0.3 * reach,
      root[1] - 0.2 * reach,
      root[2] + 0.6 * reach,
    ];
    const posed = evaluatePose(human, { ...walking(human, 0), mode: 'custom' }, 0, {
      tickRate: TICK_RATE,
      ik: { 'hand.l': goal },
    });
    const handPos = jointTransform(poseModelSpace(posed), hand).pos;
    for (let i = 0; i < 3; i++) expect(handPos[i]).toBeCloseTo(goal[i] as number, 4);
    const far = evaluatePose(human, { ...walking(human, 0), mode: 'custom' }, 0, {
      tickRate: TICK_RATE,
      ik: { 'hand.l': [root[0], root[1], root[2] + 3 * reach] },
    });
    const farHand = jointTransform(poseModelSpace(far), hand).pos;
    const dist = Math.hypot(farHand[0] - root[0], farHand[1] - root[1], farHand[2] - root[2]);
    expect(dist).toBeCloseTo(reach, 3);
  });

  it('re-anchors the root so the pelvis sits at the origin when seated', () => {
    const seated = evaluatePose(human, { ...walking(human, 0), mode: 'sit' }, 0, {
      tickRate: TICK_RATE,
      anchor: 'pelvis',
    });
    const hips = jointTransform(poseModelSpace(seated), human.index.hips as number).pos;
    for (const v of hips) expect(v).toBeCloseTo(0, 5);
    const eyeAnchored = evaluatePose(human, { ...walking(human, 0), mode: 'sit' }, 0, {
      tickRate: TICK_RATE,
      anchor: 'eye',
    });
    const eye = socketTransform(human, eyeAnchored, 'eye');
    for (const v of eye?.pos ?? [1, 1, 1]) expect(v).toBeCloseTo(0, 5);
  });

  it('keeps sockets on the body: the head top follows the head', () => {
    const pose = evaluatePose(human, walking(human, 1.4), 17, { tickRate: TICK_RATE });
    const model = poseModelSpace(pose);
    const head = jointTransform(model, human.index.head as number);
    const top = socketTransform(human, pose, 'head.top', model);
    const expected = quatRotateVec3(head.rot ?? [0, 0, 0, 1], [0, human.metrics.headLen, 0]);
    for (let i = 0; i < 3; i++)
      expect(top?.pos[i]).toBeCloseTo(head.pos[i] + (expected[i] as number), 5);
    expect(top?.pos[1]).toBeGreaterThan(human.height - 0.08);
  });
});

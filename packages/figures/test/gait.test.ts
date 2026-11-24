// How people move: feet planted through the stance of a walk or run at any speed and body size,
// no foot under the ground, no joint that snaps between phases, left and right half-cycles that
// mirror each other, an idle that shifts its weight over planted feet, and seated hands on thighs.

import { type Quat, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  evaluatePose,
  type FigureDescriptor,
  type FigureRig,
  type FigureStateData,
  figureStrideRate,
  jointTransform,
  mirrorName,
  poseModelSpace,
  resolveFigureDescriptor,
  strideRateFor,
} from '../src/kernel';
import { BIPED_HEEL_REACH, BIPED_TOE_REACH, bipedGaitTiming } from '../src/kernel/gait';

const TICK_RATE = 60;
const DEG = Math.PI / 180;
const IDENTITY: Quat = [0, 0, 0, 1];

const BODIES: Record<string, FigureDescriptor> = {
  adult: { preset: 'human.adult' },
  child: { preset: 'human.child' },
  elder: { preset: 'human.elder' },
  tall: { preset: 'human.adult', height: 1.95, build: 0.8 },
  short: { preset: 'human.adult', height: 1.5, build: -0.6 },
  leggy: { preset: 'human.adult', proportions: { legRatio: 1.2 } },
  squat: { preset: 'human.adult', proportions: { legRatio: 0.85, hipWidth: 1.2 } },
};
/** Adult speeds (m/s); other bodies move at the same Froude number. */
const WALKS = [0.5, 0.9, 1.35, 1.7, 2];
const RUNS = [2.4, 3.6, 5, 7];
const ADULT_LEG = deriveRig(resolveFigureDescriptor({ preset: 'human.adult' })).legLength;

function rigOf(descriptor: FigureDescriptor): FigureRig {
  return deriveRig(resolveFigureDescriptor(descriptor));
}

function moving(rig: FigureRig, mode: 'walk' | 'run', speed: number, phase: number) {
  const strideRate = figureStrideRate(rig, speed);
  const state: FigureStateData = {
    mode,
    speed,
    strideRate,
    phaseAt: phase - Math.floor(phase),
    phaseAtTick: 0,
    modeAtTick: -1000,
  };
  const pose = evaluatePose(rig, state, 0, { tickRate: TICK_RATE });
  return { pose, model: poseModelSpace(pose), stride: speed / strideRate };
}

/** A foot under a pose: heel and toe of the sole (figure space) and the shoe's pitch, toes down positive. */
function footOf(rig: FigureRig, model: Float32Array, side: 'l' | 'r') {
  const foot = jointTransform(model, rig.index[`foot.${side}`] as number);
  const rot = foot.rot ?? IDENTITY;
  const at = (z: number): Vec3 => {
    const o = quatRotateVec3(rot, [0, -rig.metrics.ankleHeight, z * rig.metrics.footLen]);
    return [foot.pos[0] + o[0], foot.pos[1] + o[1], foot.pos[2] + o[2]];
  };
  const forward = quatRotateVec3(rot, [0, 0, 1]);
  return { heel: at(-BIPED_HEEL_REACH), toe: at(BIPED_TOE_REACH), pitch: Math.asin(-forward[1]) };
}

function kneeFlexion(rig: FigureRig, local: Float32Array, side: 'l' | 'r'): Quat {
  const o = (rig.index[`lowerLeg.${side}`] as number) * 7;
  return [local[o + 3], local[o + 4], local[o + 5], local[o + 6]] as Quat;
}

function angleBetween(a: ArrayLike<number>, b: ArrayLike<number>, o: number): number {
  const dot =
    (a[o] as number) * (b[o] as number) +
    (a[o + 1] as number) * (b[o + 1] as number) +
    (a[o + 2] as number) * (b[o + 2] as number) +
    (a[o + 3] as number) * (b[o + 3] as number);
  return 2 * Math.acos(Math.min(1, Math.abs(dot)));
}

describe('walking and running on planted feet', () => {
  const cases: [string, 'walk' | 'run', number][] = [];
  for (const name of Object.keys(BODIES)) {
    for (const speed of WALKS) cases.push([name, 'walk', speed]);
    for (const speed of RUNS) cases.push([name, 'run', speed]);
  }

  it('keeps each stance foot where it landed and no foot under the ground', () => {
    const N = 240;
    let worstSlip = 0;
    let worstSink = 0;
    let worstFloat = 0;
    for (const [name, mode, adultSpeed] of cases) {
      const rig = rigOf(BODIES[name] as FigureDescriptor);
      const speed = adultSpeed * Math.sqrt(rig.legLength / ADULT_LEG);
      const { duty } = bipedGaitTiming(rig, mode === 'run', speed / figureStrideRate(rig, speed));
      const label = `${name} ${mode} ${adultSpeed}`;
      for (const side of ['l', 'r'] as const) {
        let heelAt: Vec3 | undefined;
        let toeAt: Vec3 | undefined;
        for (let i = 0; i <= N; i++) {
          // The leg's own phase: 0 at its strike.
          const q = i / N;
          const phase = side === 'l' ? q : q + 0.5;
          const { model, stride } = moving(rig, mode, speed, phase);
          const { heel, toe, pitch } = footOf(rig, model, side);
          const low = Math.min(heel[1], toe[1]);
          worstSink = Math.max(worstSink, -low);
          expect(low, `${label}: sole under the ground at ${q}`).toBeGreaterThan(-2e-5);
          if (q > duty - 1e-6) continue;
          // On the ground: the sole touches it, and the point it stands on does not move.
          worstFloat = Math.max(worstFloat, low);
          expect(low, `${label}: stance foot off the ground at ${q}`).toBeLessThan(2e-5);
          const travelled = stride * (phase - (side === 'l' ? 0 : 0.5));
          const world = (p: Vec3): Vec3 => [p[0], p[1], p[2] + travelled];
          if (pitch < 0.05 * DEG) {
            const now = world(heel);
            heelAt ??= now;
            worstSlip = Math.max(worstSlip, Math.hypot(now[0] - heelAt[0], now[2] - heelAt[2]));
          }
          if (pitch > -0.05 * DEG) {
            const now = world(toe);
            toeAt ??= now;
            worstSlip = Math.max(worstSlip, Math.hypot(now[0] - toeAt[0], now[2] - toeAt[2]));
          }
        }
      }
      expect(worstSlip, `${label}: stance foot slip (m)`).toBeLessThan(2e-5);
    }
    // Float32 poses: measured 0.0002 mm at worst over these bodies and speeds.
    expect(worstSlip).toBeLessThan(2e-5);
    expect(worstSink).toBeLessThan(2e-5);
    expect(worstFloat).toBeLessThan(2e-5);
  }, 60_000);

  it('moves every joint smoothly through the cycle and across its wrap', () => {
    const N = 360;
    for (const [name, mode, adultSpeed] of cases) {
      const rig = rigOf(BODIES[name] as FigureDescriptor);
      const speed = adultSpeed * Math.sqrt(rig.legLength / ADULT_LEG);
      let previous = moving(rig, mode, speed, 1 - 1e-7).pose.local.slice();
      for (let i = 0; i <= N; i++) {
        const local = moving(rig, mode, speed, i / N).pose.local;
        // The first step is across the wrap (1e-7 of a cycle): nothing may move there.
        const limit = i === 0 ? 0.05 * DEG : 7 * DEG;
        for (let j = 0; j < rig.joints.length; j++) {
          const turned = angleBetween(previous, local, j * 7 + 3);
          expect(
            turned,
            `${name} ${mode} ${adultSpeed}: ${rig.joints[j]?.name} at ${i / N}`,
          ).toBeLessThan(limit);
        }
        const moved = Math.hypot(
          (local[0] as number) - (previous[0] as number),
          (local[1] as number) - (previous[1] as number),
          (local[2] as number) - (previous[2] as number),
        );
        expect(moved).toBeLessThan(i === 0 ? 1e-5 : 0.004 * rig.height);
        previous = local.slice();
      }
    }
  }, 60_000);

  it('mirrors the left half-cycle in the right', () => {
    for (const [name, mode, adultSpeed] of cases) {
      const rig = rigOf(BODIES[name] as FigureDescriptor);
      const speed = adultSpeed * Math.sqrt(rig.legLength / ADULT_LEG);
      for (const phase of [0, 0.07, 0.19, 0.33, 0.41]) {
        const a = moving(rig, mode, speed, phase).pose.local;
        const b = moving(rig, mode, speed, phase + 0.5).pose.local;
        for (let j = 0; j < rig.joints.length; j++) {
          const twin = rig.index[mirrorName(rig.joints[j]?.name ?? '')] as number;
          const o = j * 7;
          const t = twin * 7;
          expect(b[t]).toBeCloseTo(-(a[o] as number), 5);
          expect(b[t + 1]).toBeCloseTo(a[o + 1] as number, 5);
          expect(b[t + 2]).toBeCloseTo(a[o + 2] as number, 5);
          // A rotation mirrored across x = 0 keeps x and w and flips y and z.
          const mirrored = [a[o + 3], -(a[o + 4] as number), -(a[o + 5] as number), a[o + 6]];
          const dot = mirrored.reduce<number>(
            (sum, v, k) => sum + (v as number) * (b[t + 3 + k] as number),
            0,
          );
          expect(Math.abs(dot), `${name} ${mode}: ${rig.joints[j]?.name}`).toBeGreaterThan(
            1 - 1e-6,
          );
        }
      }
    }
  });

  it('bends knees only the way knees bend, about their hinge', () => {
    for (const [name, mode, adultSpeed] of cases) {
      const rig = rigOf(BODIES[name] as FigureDescriptor);
      const speed = adultSpeed * Math.sqrt(rig.legLength / ADULT_LEG);
      for (let i = 0; i < 120; i++) {
        const local = moving(rig, mode, speed, i / 120).pose.local;
        for (const side of ['l', 'r'] as const) {
          const q = kneeFlexion(rig, local, side);
          const flexion = 2 * Math.atan2(q[0], q[3]);
          expect(flexion, `${name} ${mode} ${adultSpeed} at ${i / 120}`).toBeGreaterThan(
            -0.2 * DEG,
          );
          expect(flexion).toBeLessThan(155 * DEG);
          expect(Math.hypot(q[1], q[2])).toBeLessThan(1e-4);
        }
      }
    }
  });

  it('vaults over the stance leg when walking and holds the head level', () => {
    const rig = rigOf({ preset: 'human.adult' });
    const head = rig.index.head as number;
    const hips = rig.index.hips as number;
    let low = Infinity;
    let high = -Infinity;
    let highAt = 0;
    for (let i = 0; i < 200; i++) {
      const phase = i / 200;
      const { model } = moving(rig, 'walk', 1.35, phase);
      const y = jointTransform(model, hips).pos[1];
      if (y > high) {
        high = y;
        highAt = phase % 0.5;
      }
      low = Math.min(low, y);
      const forward = quatRotateVec3(jointTransform(model, head).rot ?? IDENTITY, [0, 0, 1]);
      expect(Math.abs(Math.atan2(forward[0], forward[2]))).toBeLessThan(1 * DEG);
      expect(Math.abs(Math.asin(forward[1]))).toBeLessThan(3 * DEG);
    }
    // Two to five centimeters for an adult, highest while one foot is under the body.
    expect(high - low).toBeGreaterThan(0.02);
    expect(high - low).toBeLessThan(0.055);
    expect(high).toBeLessThan(rig.hipHeight);
    expect(highAt).toBeGreaterThan(0.15);
    expect(highAt).toBeLessThan(0.4);
  });

  it('flies between the steps of a run and sinks onto the stance leg', () => {
    const rig = rigOf({ preset: 'human.adult' });
    for (const speed of RUNS) {
      const { duty } = bipedGaitTiming(rig, true, speed / figureStrideRate(rig, speed));
      expect(duty).toBeLessThan(0.45);
      expect(duty).toBeGreaterThanOrEqual(0.2);
      // Mid-flight: both soles well clear of the ground.
      const { model } = moving(rig, 'run', speed, (duty + 0.5) / 2);
      for (const side of ['l', 'r'] as const) {
        const { heel, toe } = footOf(rig, model, side);
        expect(Math.min(heel[1], toe[1])).toBeGreaterThan(0.01);
      }
      const hips = rig.index.hips as number;
      const flight = jointTransform(model, hips).pos[1];
      const stance = jointTransform(moving(rig, 'run', speed, 0.4 * duty).model, hips).pos[1];
      expect(flight - stance).toBeGreaterThan(0.02);
    }
    expect(bipedGaitTiming(rig, false, 1.4).duty).toBeGreaterThan(0.55);
  });

  it('takes strides as long as people do, and leaves quadrupeds on the cross-species trend', () => {
    const adult = rigOf({ preset: 'human.adult' });
    // Steps a minute: two per stride.
    const cadence = (speed: number): number => 120 * figureStrideRate(adult, speed);
    expect(cadence(1.35)).toBeGreaterThan(104);
    expect(cadence(1.35)).toBeLessThan(122);
    expect(cadence(0.8)).toBeLessThan(cadence(1.35));
    expect(cadence(3.6)).toBeGreaterThan(155);
    expect(cadence(3.6)).toBeLessThan(185);
    expect(figureStrideRate(adult, 0)).toBe(0);
    const horse = rigOf({ preset: 'horse' });
    for (const speed of [1.2, 3, 8])
      expect(figureStrideRate(horse, speed)).toBe(strideRateFor(speed, horse.legLength));
  });

  it('walks an ordinary stride when the state carries no speed', () => {
    const rig = rigOf({ preset: 'human.adult' });
    for (const mode of ['walk', 'run'] as const) {
      const state: FigureStateData = {
        mode,
        speed: 0,
        strideRate: 0,
        phaseAt: 0,
        phaseAtTick: 0,
        modeAtTick: -1000,
      };
      const model = poseModelSpace(evaluatePose(rig, state, 0, { tickRate: TICK_RATE }));
      const left = jointTransform(model, rig.index['foot.l'] as number).pos;
      const right = jointTransform(model, rig.index['foot.r'] as number).pos;
      expect(left[2] - right[2]).toBeGreaterThan(0.25 * rig.legLength);
    }
  });
});

describe('standing and sitting', () => {
  it('shifts weight over planted feet, each figure in its own time', () => {
    for (const name of Object.keys(BODIES)) {
      const rig = rigOf(BODIES[name] as FigureDescriptor);
      const sideways: number[][] = [];
      for (const seed of [1, 7, 42]) {
        const shifts: number[] = [];
        for (let seconds = 0; seconds < 60; seconds += 0.37) {
          const pose = evaluatePose(rig, undefined, seconds * TICK_RATE, {
            tickRate: TICK_RATE,
            seed,
          });
          const model = poseModelSpace(pose);
          for (const [side, sign] of [
            ['l', 1],
            ['r', -1],
          ] as const) {
            const foot = jointTransform(model, rig.index[`foot.${side}`] as number);
            expect(foot.pos[0]).toBeCloseTo(sign * rig.metrics.hipHalf, 4);
            expect(foot.pos[1]).toBeCloseTo(rig.metrics.ankleHeight, 4);
            expect(foot.pos[2]).toBeCloseTo(0, 4);
            const { heel, toe } = footOf(rig, model, side);
            expect(Math.abs(heel[1])).toBeLessThan(2e-4);
            expect(Math.abs(toe[1])).toBeLessThan(2e-4);
            const q = kneeFlexion(rig, pose.local, side);
            expect(2 * Math.atan2(q[0], q[3])).toBeGreaterThan(-0.2 * DEG);
          }
          shifts.push(jointTransform(model, rig.index.hips as number).pos[0]);
        }
        // The hips travel a few centimeters from side to side over a minute.
        const span = Math.max(...shifts) - Math.min(...shifts);
        expect(span).toBeGreaterThan(0.012 * rig.height);
        expect(span).toBeLessThan(0.06 * rig.height);
        sideways.push(shifts);
      }
      // Different seeds are not in step.
      const [a, b] = sideways as [number[], number[]];
      expect(a.some((x, i) => Math.abs(x - (b[i] as number)) > 0.005 * rig.height)).toBe(true);
    }
  });

  it('rests seated hands on the thighs, hanging or drawn up on a floor', () => {
    for (const height of [1.5, 1.75, 1.95]) {
      const rig = rigOf({ preset: 'human.adult', height });
      const state: FigureStateData = {
        mode: 'sit',
        speed: 0,
        strideRate: 0,
        phaseAt: 0,
        phaseAtTick: 0,
        modeAtTick: -1000,
      };
      for (const floor of [undefined, 0.88]) {
        const pose = evaluatePose(rig, state, 90, {
          tickRate: TICK_RATE,
          seed: 4,
          anchor: 'eye',
          ...(floor !== undefined ? { floor } : {}),
        });
        const model = poseModelSpace(pose);
        for (const side of ['l', 'r'] as const) {
          const hip = jointTransform(model, rig.index[`upperLeg.${side}`] as number).pos;
          const knee = jointTransform(model, rig.index[`lowerLeg.${side}`] as number).pos;
          const wrist = jointTransform(model, rig.index[`hand.${side}`] as number).pos;
          const along = [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]];
          const length = Math.hypot(...along);
          const rel = [wrist[0] - hip[0], wrist[1] - hip[1], wrist[2] - hip[2]];
          const t =
            rel.reduce((sum, v, k) => sum + v * (along[k] as number), 0) / (length * length);
          const off = Math.hypot(...rel.map((v, k) => v - t * (along[k] as number)));
          // Over the middle of the thigh, clear of its surface and no more than a hand above it.
          expect(t).toBeGreaterThan(0.3);
          expect(t).toBeLessThan(0.7);
          expect(off).toBeGreaterThan(1.1 * rig.metrics.limbRadius);
          expect(off).toBeLessThan(1.3 * rig.metrics.limbRadius + 0.35 * rig.metrics.handLen);
          expect(wrist[1]).toBeGreaterThan(hip[1] + t * (along[1] as number));
        }
      }
    }
  });
});

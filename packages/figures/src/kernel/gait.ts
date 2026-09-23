/**
 * Locomotion curves and gait selection. Everything is a pure function of (rig, phase, mode)
 * or (rig, time, seed), so the kernel and the client compute identical joint rotations.
 * Sign conventions (bind axes = figure axes): a down-pointing limb swings forward with a
 * negative rotation about +X, a knee bends backward with a positive one; the torso leans
 * forward with a positive rotation about +X; yaw is about +Y (+Z turns toward +X, the left).
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { FigureGait } from './components';
import { type PoseBuffer, rotateX, rotateY, rotateZ, translateRoot } from './pose-buffer';
import type { FigureRig } from './rig';
import { unit01 } from './seed';

const DEG = dmath.PI / 180;
const TAU = dmath.TAU;

export const GRAVITY: number = 9.81;

/** Froude number v² / (g · L): the dimensionless gait speed. */
export function froude(speed: number, legLength: number): number {
  if (legLength <= 0) return 0;
  return (speed * speed) / (GRAVITY * legLength);
}

/**
 * Stride frequency in cycles per second from Alexander's stride-length scaling
 * (λ = 2.3 · Fr^0.3 · L, clamped to 0.4–4 leg lengths): 1.4 m/s adult ≈ 1.1 Hz.
 */
export function strideRateFor(speed: number, legLength: number): number {
  if (speed <= 0 || legLength <= 0) return 0;
  const fr = froude(speed, legLength);
  const lambda = dmath.clamp(2.3 * dmath.pow(fr, 0.3), 0.4, 4) * legLength;
  return speed / lambda;
}

/** Idle/moving speed thresholds (m/s) with hysteresis, scaled by height. */
export function idleThresholds(height: number): { enter: number; exit: number } {
  const scale = height / 1.75;
  return { enter: 0.1 * scale, exit: 0.15 * scale };
}

/** Biped walk/run choice from Froude with hysteresis (run above 0.5, back below 0.4). */
export function bipedRunFor(fr: number, wasRunning: boolean): boolean {
  return wasRunning ? fr >= 0.4 : fr > 0.5;
}

/** Quadruped gait from Froude with ±12% hysteresis around walk<0.4≤trot<2.0≤gallop. */
export function quadrupedGaitFor(fr: number, prev: FigureGait | undefined): FigureGait {
  const t1 = 0.4;
  const t2 = 2;
  const up = 1.12;
  const down = 0.88;
  if (prev === 'gallop') return fr >= t2 * down ? 'gallop' : fr >= t1 * down ? 'trot' : 'walk';
  if (prev === 'trot') return fr > t2 * up ? 'gallop' : fr >= t1 * down ? 'trot' : 'walk';
  return fr > t2 * up ? 'gallop' : fr > t1 * up ? 'trot' : 'walk';
}

function j(rig: FigureRig, name: string): number {
  return rig.index[name] ?? -1;
}

/** A smooth bump on [start, end] (0 outside), peaking at 1 in the middle. */
function bump(phase: number, start: number, end: number): number {
  if (phase < start || phase > end) return 0;
  const s = dmath.sin((dmath.PI * (phase - start)) / (end - start));
  return s;
}

/** The biped walk/run cycle at phase φ ∈ [0, 1) (left heel strike at 0). */
export function bipedGaitPose(rig: FigureRig, phase: number, run: boolean, buf: PoseBuffer): void {
  const L = rig.legLength;
  const A = (run ? 38 : 22) * DEG;
  const lean = run ? 8 * DEG : 0;
  const stanceKnee = (run ? 25 : 12) * DEG;
  const swingKnee = (run ? 95 : 55) * DEG;
  const legs: [string, number][] = [
    ['l', phase],
    ['r', dmath.frac(phase + 0.5)],
  ];
  for (const [side, p] of legs) {
    const hip = A * dmath.cos(TAU * p);
    const stance = p < 0.55;
    const knee = stance
      ? (stanceKnee * (1 - dmath.cos((TAU * p) / 0.55))) / 2
      : swingKnee * dmath.sin((dmath.PI * (p - 0.55)) / 0.45) ** 2;
    const toeOff = 15 * DEG * bump(p, 0.4, 0.55);
    rotateX(buf, j(rig, `upperLeg.${side}`), -hip);
    rotateX(buf, j(rig, `lowerLeg.${side}`), knee);
    // Keep the foot roughly level: undo most of the leg's accumulated pitch, then toe off.
    rotateX(buf, j(rig, `foot.${side}`), 0.85 * (hip - knee) + toeOff);
  }
  // Pelvis: vertical bob at twice the stride frequency, lateral sway, yaw and roll.
  const bob = -(run ? 0.045 : 0.02) * L * dmath.cos(2 * TAU * phase);
  const sway = 0.015 * L * dmath.sin(TAU * phase);
  translateRoot(buf, sway, bob, 0);
  const pelvisYaw = 4 * DEG * dmath.sin(TAU * phase);
  const pelvisRoll = 3 * DEG * dmath.sin(TAU * phase);
  rotateY(buf, j(rig, 'hips'), pelvisYaw);
  rotateZ(buf, j(rig, 'hips'), pelvisRoll);
  rotateX(buf, j(rig, 'spine'), lean);
  const chestYaw = -0.7 * pelvisYaw;
  rotateY(buf, j(rig, 'chest'), chestYaw);
  rotateZ(buf, j(rig, 'chest'), -pelvisRoll);
  // Head stays level and forward.
  rotateY(buf, j(rig, 'head'), -(pelvisYaw + chestYaw));
  rotateX(buf, j(rig, 'head'), -lean);
  // Arms counter-swing: the left arm moves with the right leg.
  const arms: [string, number][] = [
    ['l', dmath.frac(phase + 0.5)],
    ['r', phase],
  ];
  for (const [side, p] of arms) {
    const swing = (run ? 0.8 : 0.55) * A * dmath.cos(TAU * p);
    const elbow = run ? 90 * DEG : 12 * DEG + (18 * DEG * (1 + dmath.cos(TAU * p))) / 2;
    rotateX(buf, j(rig, `upperArm.${side}`), -swing);
    rotateX(buf, j(rig, `foreArm.${side}`), -elbow);
  }
}

const GAIT_OFFSETS: Record<FigureGait, Record<'fl' | 'fr' | 'hl' | 'hr', number>> = {
  walk: { hl: 0, fl: 0.25, hr: 0.5, fr: 0.75 },
  trot: { fl: 0, hr: 0, fr: 0.5, hl: 0.5 },
  gallop: { hl: 0, hr: 0.1, fl: 0.5, fr: 0.6 },
};

/** The quadruped cycle at phase φ for a gait (lateral-sequence walk, diagonal trot, gallop). */
export function quadrupedGaitPose(
  rig: FigureRig,
  phase: number,
  gait: FigureGait,
  buf: PoseBuffer,
): void {
  const S = rig.height;
  const amp = (gait === 'walk' ? 18 : gait === 'trot' ? 25 : 35) * DEG;
  const swingKnee = (gait === 'walk' ? 35 : gait === 'trot' ? 45 : 60) * DEG;
  const offsets = GAIT_OFFSETS[gait];
  for (const leg of ['fl', 'fr', 'hl', 'hr'] as const) {
    const p = dmath.frac(phase + offsets[leg]);
    const swing = amp * dmath.cos(TAU * p);
    const knee = p < 0.55 ? 0 : swingKnee * dmath.sin((dmath.PI * (p - 0.55)) / 0.45) ** 2;
    rotateX(buf, j(rig, `upperLeg.${leg}`), -swing);
    rotateX(buf, j(rig, `lowerLeg.${leg}`), knee);
    rotateX(buf, j(rig, `foot.${leg}`), 0.5 * (swing - knee));
  }
  if (gait === 'gallop') {
    translateRoot(buf, 0, 0.05 * S * dmath.max(0, dmath.sin(TAU * phase)), 0);
    rotateX(buf, j(rig, 'spine'), 8 * DEG * dmath.sin(TAU * phase));
    rotateX(buf, j(rig, 'chest'), -4 * DEG * dmath.sin(TAU * phase));
  } else {
    translateRoot(buf, 0, -0.01 * S * dmath.cos(2 * TAU * phase), 0);
  }
  rotateX(buf, j(rig, 'head'), 3 * DEG * dmath.cos(2 * TAU * phase));
  for (let seg = 0; seg < 3; seg++) {
    rotateY(buf, j(rig, `tail.${seg}`), 10 * DEG * dmath.sin(TAU * phase - 0.6 * seg));
  }
}

/** Breathing, sway, and seeded head glances; a function of time, never of accumulated state. */
export function idlePose(rig: FigureRig, seconds: number, seed: number, buf: PoseBuffer): void {
  const H = rig.height;
  const s0 = unit01(seed, 1) * TAU;
  const s1 = unit01(seed, 2) * TAU;
  const breath = dmath.sin(TAU * 0.25 * seconds + s0);
  rotateX(buf, j(rig, 'chest'), 1.5 * DEG * breath);
  translateRoot(buf, 0, 0.004 * H * breath, 0);
  rotateZ(buf, j(rig, 'hips'), 0.8 * DEG * dmath.sin(TAU * 0.09 * seconds + s1));
  // Glance: a new target every 3 s, eased in over 0.4 s.
  const window = dmath.floor(seconds / 3);
  const start = window * 3;
  const glance = (k: number): number => 24 * DEG * (unit01(seed, 100 + k) - 0.5);
  const ramp = dmath.smoothstep((seconds - start) / 0.4);
  const yaw = dmath.lerp(glance(window - 1), glance(window), ramp);
  rotateY(buf, j(rig, 'head'), yaw);
  if (rig.archetype === 'quadruped') {
    for (let seg = 0; seg < 3; seg++) {
      rotateY(
        buf,
        j(rig, `tail.${seg}`),
        6 * DEG * dmath.sin(TAU * 0.3 * seconds + s1 - 0.5 * seg),
      );
    }
  }
}

export function jumpPose(rig: FigureRig, buf: PoseBuffer): void {
  if (rig.archetype === 'biped') {
    for (const side of ['l', 'r']) {
      rotateX(buf, j(rig, `upperLeg.${side}`), -40 * DEG);
      rotateX(buf, j(rig, `lowerLeg.${side}`), 50 * DEG);
      rotateX(buf, j(rig, `upperArm.${side}`), -35 * DEG);
      rotateX(buf, j(rig, `foreArm.${side}`), -20 * DEG);
    }
    return;
  }
  for (const leg of ['fl', 'fr']) rotateX(buf, j(rig, `upperLeg.${leg}`), -35 * DEG);
  for (const leg of ['hl', 'hr']) rotateX(buf, j(rig, `upperLeg.${leg}`), 25 * DEG);
}

export function fallPose(rig: FigureRig, buf: PoseBuffer): void {
  if (rig.archetype === 'biped') {
    rotateZ(buf, j(rig, 'upperArm.l'), 60 * DEG);
    rotateZ(buf, j(rig, 'upperArm.r'), -60 * DEG);
    for (const side of ['l', 'r']) rotateX(buf, j(rig, `lowerLeg.${side}`), 20 * DEG);
    return;
  }
  for (const leg of ['fl', 'fr', 'hl', 'hr']) rotateX(buf, j(rig, `lowerLeg.${leg}`), 25 * DEG);
}

/** Seated: thighs forward, shins down; the root is re-anchored by the caller. */
export function sitPose(rig: FigureRig, buf: PoseBuffer): void {
  if (rig.archetype === 'biped') {
    for (const side of ['l', 'r']) {
      rotateX(buf, j(rig, `upperLeg.${side}`), -85 * DEG);
      rotateX(buf, j(rig, `lowerLeg.${side}`), 85 * DEG);
      rotateX(buf, j(rig, `upperArm.${side}`), -20 * DEG);
      rotateX(buf, j(rig, `foreArm.${side}`), -30 * DEG);
    }
    rotateX(buf, j(rig, 'spine'), -5 * DEG);
    return;
  }
  // Lying down: hind legs folded, front legs stretched.
  for (const leg of ['hl', 'hr']) {
    rotateX(buf, j(rig, `upperLeg.${leg}`), -70 * DEG);
    rotateX(buf, j(rig, `lowerLeg.${leg}`), 120 * DEG);
  }
  for (const leg of ['fl', 'fr']) rotateX(buf, j(rig, `upperLeg.${leg}`), -80 * DEG);
  translateRoot(buf, 0, -0.55 * rig.legLength, 0);
}

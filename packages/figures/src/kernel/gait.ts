/**
 * Locomotion curves and gait selection. Everything is a pure function of (rig, phase, mode,
 * stride) or (rig, time, seed), so the kernel and the client compute identical joint rotations.
 * Sign conventions (bind axes = figure axes): a down-pointing limb swings forward with a
 * negative rotation about +X, a knee bends backward with a positive one; the torso leans
 * forward with a positive rotation about +X; yaw is about +Y (+Z turns toward +X, the left).
 *
 * People walk and run on planted feet: each foot follows a path over the ground (heel strike,
 * flat, heel-off, toe-off, swing) and the legs are solved onto it, so a stance foot stays where
 * it landed while the body travels one stride per cycle. The pelvis rides at the height the legs
 * can reach, and the knee angles follow from that.
 */

import {
  dmath,
  lookRotation,
  type Quat,
  quatConjugate,
  quatFromEuler,
  quatFromTo,
  quatMul,
  quatRotateVec3,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';
import type { FigureGait } from './components';
import { forearmRoll, REST_FOREARM_ROLL } from './hand-rest';
import { solveTwoBoneIk } from './ik';
import {
  getQuat,
  type PoseBuffer,
  rotateJoint,
  rotateX,
  rotateY,
  rotateZ,
  setQuat,
  translateRoot,
} from './pose-buffer';
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

/** Stride length over leg length at a Froude number: `coefficient` · Fr^0.3, 0.4 to `most`. */
function relativeStride(fr: number, coefficient: number, most: number): number {
  return dmath.clamp(coefficient * dmath.pow(fr, 0.3), 0.4, most);
}

/**
 * Stride frequency in cycles per second from Alexander's stride-length scaling
 * (λ = 2.3 · Fr^0.3 · L, clamped to 0.4–4 leg lengths), the trend across walking and running
 * animals. Quadrupeds use it as it is; people take longer strides (see `bipedStrideRateFor`).
 */
export function strideRateFor(speed: number, legLength: number): number {
  if (speed <= 0 || legLength <= 0) return 0;
  return speed / (relativeStride(froude(speed, legLength), 2.3, 4) * legLength);
}

/**
 * How much longer a person's stride is than the cross-species trend: 2.7 · Fr^0.3 hip-to-ankle
 * lengths. Fitted to adults (leg 0.84 m): 1.07 m at 0.8 m/s, 1.43 m at 1.35 m/s (113 steps a
 * minute), 1.8 m at 2 m/s, 2.6 m at 3.6 m/s and 3.9 m at 7 m/s. The trend's 2.3 gave 134 quick,
 * short steps a minute at an ordinary walk.
 */
const BIPED_STRIDE = 2.7;
const BIPED_STRIDE_MOST = 5.4;

/** Stride frequency of a person (cycles per second): 1.35 m/s adult ≈ 0.94 Hz. */
export function bipedStrideRateFor(speed: number, legLength: number): number {
  if (speed <= 0 || legLength <= 0) return 0;
  return (
    speed / (relativeStride(froude(speed, legLength), BIPED_STRIDE, BIPED_STRIDE_MOST) * legLength)
  );
}

/** Stride frequency of a rig at a ground speed, by its archetype (cycles per second). */
export function figureStrideRate(rig: FigureRig, speed: number): number {
  return rig.archetype === 'biped'
    ? bipedStrideRateFor(speed, rig.legLength)
    : strideRateFor(speed, rig.legLength);
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

function turnForearm(rig: FigureRig, buf: PoseBuffer, side: string, angle: number): void {
  const hand = rig.joints[j(rig, `hand.${side}`)];
  if (!hand) return;
  rotateJoint(
    buf,
    j(rig, `foreArm.${side}`),
    forearmRoll(hand.bindPos, angle, side === 'l' ? 1 : -1),
  );
}

// ---- Biped legs -------------------------------------------------------------------------------

/**
 * Where the shoe meets the ground, as fractions of the foot length from the ankle: the sole runs
 * from 0.3 behind it to 0.8 ahead (see buildHumanShoe: sections centred 0.25 ahead, 0.55 half
 * long). A foot rolls about points just inside those ends, so the sole's rounded edge neither
 * digs in nor hovers. Keep these with the shoe.
 */
export const BIPED_HEEL_REACH: number = 0.29;
export const BIPED_TOE_REACH: number = 0.79;

/** The measures a planted-foot gait needs, read from the rig (meters). */
interface BipedLegs {
  upper: number;
  lower: number;
  /** Hip joint to ankle, the leg straight. */
  length: number;
  /** Ankle height over the sole. */
  ankle: number;
  /** Heel and toe pivots behind and ahead of the ankle. */
  heel: number;
  toe: number;
  hipHalf: number;
  hipHeight: number;
}

function bipedLegs(rig: FigureRig): BipedLegs | undefined {
  const hips = rig.joints[j(rig, 'hips')];
  const upperLeg = rig.joints[j(rig, 'upperLeg.l')];
  const lowerLeg = rig.joints[j(rig, 'lowerLeg.l')];
  const foot = rig.joints[j(rig, 'foot.l')];
  if (!hips || !upperLeg || !lowerLeg || !foot) return undefined;
  const upper = dmath.hypot(lowerLeg.bindPos[0], lowerLeg.bindPos[1], lowerLeg.bindPos[2]);
  const lower = dmath.hypot(foot.bindPos[0], foot.bindPos[1], foot.bindPos[2]);
  if (!(upper > 0) || !(lower > 0)) return undefined;
  const footLen = dmath.max(rig.metrics.footLen, 1e-4);
  return {
    upper,
    lower,
    length: upper + lower,
    ankle: dmath.max(rig.metrics.ankleHeight, 0),
    heel: BIPED_HEEL_REACH * footLen,
    toe: BIPED_TOE_REACH * footLen,
    hipHalf: dmath.abs(upperLeg.bindPos[0]),
    hipHeight: hips.bindPos[1],
  };
}

/** Hip-to-ankle distance of a leg whose knee is bent by `flexion` radians. */
function legSpan(legs: BipedLegs, flexion: number): number {
  return dmath.sqrt(
    legs.upper * legs.upper +
      legs.lower * legs.lower +
      2 * legs.upper * legs.lower * dmath.cos(flexion),
  );
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Solve one leg onto an ankle position (figure space) under a pelvis at `hips` turned by
 * `hipsRot`, the knee pointing the way the foot does, and set the shoe to a pitch (toes down
 * positive) and yaw in figure space. An ankle out of reach leaves the leg straight toward it.
 */
function placeLeg(
  rig: FigureRig,
  buf: PoseBuffer,
  side: 'l' | 'r',
  legs: BipedLegs,
  hips: Vec3,
  hipsRot: Quat,
  ankle: Vec3,
  pitch: number,
  yaw: number,
): void {
  const u = j(rig, `upperLeg.${side}`);
  const l = j(rig, `lowerLeg.${side}`);
  const f = j(rig, `foot.${side}`);
  if (u < 0 || l < 0 || f < 0) return;
  const offset = quatRotateVec3(hipsRot, [(side === 'l' ? 1 : -1) * legs.hipHalf, 0, 0]);
  const hip: Vec3 = [hips[0] + offset[0], hips[1] + offset[1], hips[2] + offset[2]];
  let dx = ankle[0] - hip[0];
  let dy = ankle[1] - hip[1];
  let dz = ankle[2] - hip[2];
  let dist = dmath.hypot(dx, dy, dz);
  if (dist < 1e-6) {
    dx = 0;
    dy = -1;
    dz = 0;
    dist = 1;
  }
  const dir: Vec3 = [dx / dist, dy / dist, dz / dist];
  const a = legs.upper;
  const b = legs.lower;
  const d = dmath.clamp(dist, dmath.abs(a - b) + 1e-4 * legs.length, 0.9995 * legs.length);
  const cosA = dmath.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = dmath.sqrt(dmath.max(0, 1 - cosA * cosA));
  // The knee bends toward the way the foot points.
  const pole: Vec3 = [dmath.sin(yaw), 0, dmath.cos(yaw)];
  const along = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
  let perp: Vec3 = [pole[0] - along * dir[0], pole[1] - along * dir[1], pole[2] - along * dir[2]];
  let pl = dmath.hypot(perp[0], perp[1], perp[2]);
  if (pl < 1e-4) {
    // The leg points straight along the foot: any upward perpendicular will do.
    perp = cross(cross(dir, [0, 1, 0]), dir);
    pl = dmath.hypot(perp[0], perp[1], perp[2]) || 1;
  }
  perp = [perp[0] / pl, perp[1] / pl, perp[2] / pl];
  const upperDir: Vec3 = [
    dir[0] * cosA + perp[0] * sinA,
    dir[1] * cosA + perp[1] * sinA,
    dir[2] * cosA + perp[2] * sinA,
  ];
  const lx = dir[0] * d - upperDir[0] * a;
  const ly = dir[1] * d - upperDir[1] * a;
  const lz = dir[2] * d - upperDir[2] * a;
  const ll = dmath.hypot(lx, ly, lz) || 1;
  const lowerDir: Vec3 = [lx / ll, ly / ll, lz / ll];
  // The knee's hinge is the leg plane's normal: both segments turn about it.
  const hinge = cross(perp, dir);
  const upUpper: Vec3 = [-upperDir[0], -upperDir[1], -upperDir[2]];
  const upLower: Vec3 = [-lowerDir[0], -lowerDir[1], -lowerDir[2]];
  const upperRot = lookRotation(cross(hinge, upUpper), upUpper);
  const lowerRot = lookRotation(cross(hinge, upLower), upLower);
  setQuat(buf, u, quatMul(quatConjugate(hipsRot), upperRot));
  setQuat(buf, l, quatMul(quatConjugate(upperRot), lowerRot));
  setQuat(buf, f, quatMul(quatConjugate(lowerRot), quatFromEuler(pitch, yaw, 0)));
}

/** Set the trunk from figure-space rotations of the pelvis, spine, chest, neck and head. */
function placeTrunk(
  rig: FigureRig,
  buf: PoseBuffer,
  hips: Quat,
  spine: Quat,
  chest: Quat,
  neck: Quat,
  head: Quat,
): void {
  const chain: [string, Quat][] = [
    ['hips', hips],
    ['spine', spine],
    ['chest', chest],
    ['neck', neck],
    ['head', head],
  ];
  let parent: Quat = [0, 0, 0, 1];
  for (const [name, rot] of chain) {
    const index = j(rig, name);
    if (index >= 0) setQuat(buf, index, quatMul(quatConjugate(parent), rot));
    parent = rot;
  }
}

/** Cubic Hermite from p0 to p1 with end slopes m0 and m1 (per unit u). */
function hermite(p0: number, p1: number, m0: number, m1: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * m1
  );
}

/** A planted or swinging foot: the ankle (figure space) and the shoe's pitch (toes down positive). */
interface FootPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
}

/** Strides a walker or runner takes when the caller gives none, in leg lengths (1.35 and 3.6 m/s). */
const DEFAULT_WALK_STRIDE = 1.72;
const DEFAULT_RUN_STRIDE = 3.1;

/** Everything about one gait cycle that does not change with phase. */
interface BipedCycle {
  legs: BipedLegs;
  run: boolean;
  /** Ground covered per cycle, meters. */
  stride: number;
  /** Share of the cycle a foot is on the ground. */
  duty: number;
  /** A foot's flat-ankle position ahead of the hips at its strike. */
  strikeZ: number;
  /** Shoe pitch at the strike (toes up: negative) and the share of the cycle until it is flat. */
  strikePitch: number;
  flat: number;
  /** Knee flexion the stance leg aims for at mid-stance and at toe-off. */
  kneeMid: number;
  kneeOff: number;
  /** Feet land this far either side of the line of travel, toes turned out by `toeOut`. */
  stepHalf: number;
  toeOut: number;
  /** Pelvis: turn, list and sideways shift amplitudes, and its height at mid-stance. */
  yaw: number;
  roll: number;
  sway: number;
  pitch: number;
  /**
   * The phase of the left stance at which the pelvis is at `midY`: about when the foot passes
   * under the hip, where a walker is highest and a runner lowest.
   */
  apex: number;
  midY: number;
  /** Walk: the height a quarter cycle from the apex. Run: rise from the apex to mid-flight. */
  lowY: number;
  bounce: number;
  /** Swing: clearance of the sole over the ground, and how early it peaks. */
  lift: number;
  liftSkew: number;
  /** Where each foot (left, right) leaves the ground and lands: solved once, on first use. */
  swings: [SwingEnds | undefined, SwingEnds | undefined];
}

/** The ends of a swing: the foot at toe-off, a moment before it (for its rate), and at the strike. */
interface SwingEnds {
  off: FootPose;
  before: FootPose;
  strike: FootPose;
}

/** How long before toe-off the foot is sampled for its leaving rate, in cycles. */
const SWING_STEP = 0.01;

function pelvisYaw(c: BipedCycle, p: number): number {
  // The hip of the leg that lands leads: left hip forward at the left strike.
  return -c.yaw * dmath.cos(TAU * p);
}

function pelvisRoll(c: BipedCycle, p: number): number {
  // The pelvis drops on the swing side: the left side is high through left stance.
  return c.roll * dmath.sin(TAU * (p - 0.02));
}

function pelvisRot(c: BipedCycle, p: number): Quat {
  return quatFromEuler(c.pitch, pelvisYaw(c, p), pelvisRoll(c, p));
}

function pelvisX(c: BipedCycle, p: number): number {
  // Over the stance foot at its mid-stance.
  return c.sway * dmath.cos(TAU * (p - c.duty / 2));
}

function pelvisY(c: BipedCycle, p: number): number {
  const wave = dmath.cos(2 * TAU * (p - c.apex));
  // Walking vaults over the stance leg (high at mid-stance); running sinks onto it.
  return c.run
    ? c.midY + (c.bounce * (1 - wave)) / 2
    : c.lowY + ((c.midY - c.lowY) * (1 + wave)) / 2;
}

/** A leg's hip joint at a cycle phase (figure space). */
function hipAt(c: BipedCycle, sign: number, p: number, y: number): Vec3 {
  const o = quatRotateVec3(pelvisRot(c, p), [sign * c.legs.hipHalf, 0, 0]);
  return [pelvisX(c, p) + o[0], y + o[1], o[2]];
}

/**
 * A foot on the ground at its own phase q (0 at its strike, `duty` at toe-off): it lands on the
 * heel with the toes up, lies flat, then rolls onto the toe as far as the leg needs to stay on
 * the ground behind the body.
 */
function stanceFoot(c: BipedCycle, sign: number, q: number): FootPose {
  const { legs } = c;
  // The flat shoe's ankle; the shoe rolls in its own vertical plane, which toes out by `toeOut`.
  const refX = sign * c.stepHalf;
  const refZ = c.strikeZ - c.stride * q;
  const headX = dmath.sin(sign * c.toeOut);
  const headZ = dmath.cos(sign * c.toeOut);
  /** The ankle `along` the shoe's heading from a point `from` along it off the flat ankle. */
  const at = (from: number, along: number, y: number, pitch: number): FootPose => ({
    x: refX + headX * (from + along),
    y,
    z: refZ + headZ * (from + along),
    pitch,
  });
  if (q < c.flat) {
    // Heel strike: pivot about the heel, the toes coming down fast at first. The ankle sinking
    // with them is what keeps the knee from snapping forward as the body closes on the foot.
    const rest = 1 - q / c.flat;
    const pitch = c.strikePitch * rest * rest;
    const cs = dmath.cos(pitch);
    const sn = dmath.sin(pitch);
    return at(
      -legs.heel,
      legs.ankle * sn + legs.heel * cs,
      legs.ankle * cs - legs.heel * sn,
      pitch,
    );
  }
  // Heel-off: the shoe pivots about its toe by the angle that leaves the leg its aimed length.
  const half = c.duty / 2;
  const x = dmath.clamp((q - half) / half, 0, 1);
  const flexion = c.run
    ? dmath.lerp(c.kneeMid, c.kneeOff, dmath.smoothstep(x))
    : dmath.lerp(c.kneeMid, c.kneeOff, x * x * x);
  const span = legSpan(legs, flexion);
  const p = sign > 0 ? q : dmath.frac(q + 0.5);
  const hip = hipAt(c, sign, p, pelvisY(c, p));
  // The hip from the toe: up, along the shoe's heading, and across it.
  const offX = hip[0] - (refX + headX * legs.toe);
  const offZ = hip[2] - (refZ + headZ * legs.toe);
  const up = hip[1];
  const along = offX * headX + offZ * headZ;
  const across = offX * headZ - offZ * headX;
  const reach = dmath.hypot(up, along);
  const radius = dmath.hypot(legs.ankle, legs.toe);
  const want = (up * up + along * along + radius * radius + across * across - span * span) / 2;
  const cosine = dmath.clamp(want / dmath.max(reach * radius, 1e-9), -1, 1);
  const pitch = dmath.clamp(
    dmath.atan2(along, up) - dmath.atan2(-legs.toe, legs.ankle) - dmath.acos(cosine),
    0,
    MOST_HEEL_RISE,
  );
  const cs = dmath.cos(pitch);
  const sn = dmath.sin(pitch);
  return at(legs.toe, legs.ankle * sn - legs.toe * cs, legs.ankle * cs + legs.toe * sn, pitch);
}

/** A rigid shoe standing on its toe reads as a stilt well before the foot is vertical. */
const MOST_HEEL_RISE = 78 * DEG;

/** A foot at its own phase q over the whole cycle: on the ground, or swinging to the next strike. */
function footAt(c: BipedCycle, sign: number, q: number): FootPose {
  if (q <= c.duty) return stanceFoot(c, sign, q);
  const { legs } = c;
  const swing = 1 - c.duty;
  const u = (q - c.duty) / swing;
  // Leave the ground as the stance ended (position and rate) and arrive about as it begins: the
  // foot is still moving forward a little when the heel lands, as a real one is.
  const side = sign > 0 ? 0 : 1;
  let ends = c.swings[side];
  if (ends === undefined) {
    ends = {
      off: stanceFoot(c, sign, c.duty),
      before: stanceFoot(c, sign, c.duty - SWING_STEP),
      strike: stanceFoot(c, sign, 0),
    };
    c.swings[side] = ends;
  }
  const { off, before, strike } = ends;
  const step = SWING_STEP;
  const landing = -0.55 * c.stride * swing;
  const x = hermite(off.x, strike.x, ((off.x - before.x) / step) * swing, 0, u);
  const z = hermite(off.z, strike.z, ((off.z - before.z) / step) * swing, landing, u);
  // The toes point down as the foot leaves, level out through the swing and come up to land.
  const leaving = dmath.clamp(((off.pitch - before.pitch) / step) * swing, 0, c.run ? 1.6 : 0.4);
  const pitch = hermite(off.pitch, strike.pitch, leaving, c.run ? 0 : 0.5, u);
  // The lowest point of the sole (toe, then heel) rides `lift` over the ground.
  const sn = dmath.sin(pitch);
  const soft = 0.12 * dmath.sin(dmath.PI * u);
  const edge =
    ((legs.toe - legs.heel) / 2) * sn +
    ((legs.toe + legs.heel) / 2) * dmath.sqrt(sn * sn + soft * soft);
  const bump = dmath.sin(dmath.PI * dmath.pow(u, c.liftSkew));
  // A runner's foot comes down with the body from the top of the flight, not ahead of it.
  const p = sign > 0 ? q : dmath.frac(q + 0.5);
  const fall = c.run
    ? dmath.smoothstep(u / 0.25) * dmath.max(0, pelvisY(c, p) - pelvisY(c, sign > 0 ? 0 : 0.5))
    : 0;
  return {
    x,
    // (The last term brings the heel down onto the ground at a rate, so it lands, not skims.)
    y:
      legs.ankle * dmath.cos(pitch) +
      edge +
      c.lift * bump * bump +
      fall +
      0.07 * legs.length * u * u * (1 - u),
    z,
    pitch,
  };
}

/** Constants of a walk or run at a stride length (meters; absent: an ordinary one). */
function bipedCycle(legs: BipedLegs, run: boolean, strideLength: number | undefined): BipedCycle {
  const L = legs.length;
  const raw =
    strideLength !== undefined && strideLength > 0
      ? strideLength / L
      : run
        ? DEFAULT_RUN_STRIDE
        : DEFAULT_WALK_STRIDE;
  // Past these the legs cannot keep a foot planted: the pose stays at its longest stride.
  const s = dmath.clamp(raw, 0.25, run ? 5.4 : 2.45);
  const c: BipedCycle = {
    legs,
    run,
    stride: s * L,
    duty: 0.6,
    strikeZ: 0,
    strikePitch: 0,
    flat: 0.08,
    kneeMid: 0,
    kneeOff: 0,
    stepHalf: 0,
    toeOut: 6 * DEG,
    yaw: 0,
    roll: 0,
    sway: 0,
    pitch: 0,
    apex: 0.25,
    midY: legs.hipHeight,
    lowY: legs.hipHeight,
    bounce: 0,
    lift: 0,
    liftSkew: 0.8,
    swings: [undefined, undefined],
  };
  let kneeStrike: number;
  if (run) {
    // 0 at a slow jog (2 m/s), 1 at a sprint (7 m/s).
    const vigor = dmath.clamp((s - 2.2) / 2.4, 0, 1.25);
    // A runner's foot stays down for about one leg length of travel, whatever the speed.
    c.duty = dmath.clamp(1 / s, 0.2, 0.42);
    c.strikeZ = 0.28 * c.stride * c.duty;
    c.apex = 0.4 * c.duty;
    c.strikePitch = -(8 - 6 * dmath.min(1, vigor)) * DEG;
    c.flat = 0.2 * c.duty;
    c.kneeMid = (36 + 8 * dmath.min(1, vigor)) * DEG;
    c.kneeOff = 14 * DEG;
    kneeStrike = 18 * DEG;
    c.stepHalf = 0.3 * legs.hipHalf;
    c.toeOut = 4 * DEG;
    c.yaw = (5 + 5 * vigor) * DEG;
    c.roll = (3 + 2 * vigor) * DEG;
    c.sway = 0.008 * L;
    c.pitch = (3 + 3 * vigor) * DEG;
    c.lift = (0.16 + 0.24 * vigor) * L;
    c.liftSkew = 0.72;
  } else {
    // 0 at a shuffle (0.5 m/s), 1 at an ordinary walk (1.35 m/s), 1.5 at a brisk 2 m/s.
    const vigor = dmath.clamp((s - 0.9) / 0.82, 0, 1.7);
    const reach = dmath.clamp(s / 0.9, 0, 1);
    c.duty = dmath.max(0.56, 0.66 - 0.05 * vigor);
    c.strikeZ = 0.4 * c.stride * c.duty;
    c.apex = 0.4 * c.duty + 0.03;
    c.strikePitch = -(4 + 14 * dmath.min(1, vigor) + 3 * dmath.max(0, vigor - 1)) * DEG * reach;
    c.flat = 0.14 * c.duty;
    c.kneeMid = 6 * DEG;
    c.kneeOff = (12 + 10 * dmath.min(1, vigor)) * DEG * reach;
    kneeStrike = 7 * DEG;
    c.stepHalf = (0.5 - 0.08 * dmath.min(1.5, vigor)) * legs.hipHalf;
    c.yaw = (2 + 3.5 * vigor) * DEG * reach;
    c.roll = (1.5 + 2 * vigor) * DEG * reach;
    c.sway = (0.024 - 0.007 * dmath.min(1.5, vigor)) * L * reach;
    c.pitch = (0.6 + 0.8 * vigor) * DEG;
    c.lift = (0.018 + 0.014 * dmath.min(1.5, vigor)) * L;
    c.liftSkew = 0.85;
  }
  // The pelvis rides where the legs reach. At mid-stance the stance knee is bent by `kneeMid`;
  // at the strike the leading leg is nearly straight. Solve the height of each from the foot.
  const solveHeight = (q: number, flexion: number): number => {
    // Height of the hips joint at which the left leg, on the ground at q, has this knee flexion.
    const foot = stanceFlat(c, q);
    const hip = hipAt(c, 1, q, 0);
    const span = legSpan(legs, flexion);
    const dx = foot.x - hip[0];
    const dz = foot.z - hip[2];
    return foot.y - hip[1] + dmath.sqrt(dmath.max(1e-6 * L * L, span * span - dx * dx - dz * dz));
  };
  // The landing leg must reach from the strike until its foot is flat: the lowest of the
  // heights it allows over that time rules.
  const landing: [number, number][] = [
    [0, solveHeight(0, kneeStrike)],
    [0.5 * c.flat, solveHeight(0.5 * c.flat, 0.7 * kneeStrike)],
    [c.flat, solveHeight(c.flat, 0.7 * kneeStrike)],
  ];
  c.midY = solveHeight(c.apex, c.kneeMid);
  if (run) {
    // (A landing leg that cannot reach up to the mid-stance height brings the pelvis down to it.)
    for (const [, y] of landing) c.midY = dmath.min(c.midY, y);
    // Up from mid-stance to the strike by as much as the landing leg reaches, within a hop.
    let rise = Number.POSITIVE_INFINITY;
    for (const [q, y] of landing) {
      const wave = (1 - dmath.cos(2 * TAU * (q - c.apex))) / 2;
      if (wave > 0.05) rise = dmath.min(rise, (y - c.midY) / wave);
    }
    const most = (0.07 + 0.03 * dmath.clamp((s - 2.2) / 2.4, 0, 1)) * L;
    c.bounce = dmath.clamp(rise, 0, most);
  } else {
    // Down from the apex to the strike, which comes about a quarter cycle before it.
    c.lowY = c.midY - 0.003 * L;
    for (const [q, y] of landing) {
      const wave = (1 + dmath.cos(2 * TAU * (q - c.apex))) / 2;
      if (wave < 0.9) c.lowY = dmath.min(c.lowY, (y - c.midY * wave) / (1 - wave));
    }
  }
  return c;
}

/** The stance foot before any heel rise (the heel strike, then flat): what the pelvis is solved from. */
function stanceFlat(c: BipedCycle, q: number): FootPose {
  if (q < c.flat) return stanceFoot(c, 1, q);
  return { x: c.stepHalf, y: c.legs.ankle, z: c.strikeZ - c.stride * q, pitch: 0 };
}

/**
 * The last gait solved for each rig. A walker's stride changes now and then, its phase every
 * frame, so the cycle's constants are solved once per stride and reused (same inputs, same cycle).
 */
const cycles = new WeakMap<
  FigureRig,
  { legs: BipedLegs | undefined; run: boolean; stride: number | undefined; cycle?: BipedCycle }
>();

function cycleFor(
  rig: FigureRig,
  run: boolean,
  stride: number | undefined,
): BipedCycle | undefined {
  let entry = cycles.get(rig);
  if (entry === undefined) {
    entry = { legs: bipedLegs(rig), run, stride };
    cycles.set(rig, entry);
  }
  if (entry.legs === undefined) return undefined;
  if (entry.cycle === undefined || entry.run !== run || entry.stride !== stride) {
    entry.run = run;
    entry.stride = stride;
    entry.cycle = bipedCycle(entry.legs, run, stride);
  }
  return entry.cycle;
}

/**
 * When the feet of a walk or run are on the ground: each for `duty` of the cycle from its
 * strike, the left at phase 0 and the right at 0.5 (below 0.5 there is a flight between them).
 * For footsteps and anything else timed to the feet.
 */
export function bipedGaitTiming(rig: FigureRig, run: boolean, stride?: number): { duty: number } {
  return { duty: cycleFor(rig, run, stride)?.duty ?? 0.6 };
}

/**
 * The biped walk/run cycle at phase φ ∈ [0, 1) (left heel strike at 0). `stride` is the ground
 * covered per cycle in meters (speed / stride rate), which is what keeps the feet planted; absent,
 * an ordinary walk or run for these legs.
 */
export function bipedGaitPose(
  rig: FigureRig,
  phase: number,
  run: boolean,
  buf: PoseBuffer,
  stride?: number,
): void {
  const c = cycleFor(rig, run, stride);
  if (c === undefined) return;
  const { legs } = c;
  const s = c.stride / legs.length;
  const p = dmath.frac(phase);
  // 0..1 through each gait's range of speeds (see bipedCycle).
  const vigor = run ? dmath.clamp((s - 2.2) / 2.4, 0, 1.25) : dmath.clamp((s - 0.9) / 0.82, 0, 1.7);
  const reach = run ? 1 : dmath.clamp(s / 0.9, 0, 1);

  // Pelvis, then each leg onto its foot.
  const hipsRot = pelvisRot(c, p);
  const hips: Vec3 = [pelvisX(c, p), pelvisY(c, p), 0];
  translateRoot(buf, hips[0], hips[1] - legs.hipHeight, 0);
  for (const [side, sign, q] of [
    ['l', 1, p],
    ['r', -1, dmath.frac(p + 0.5)],
  ] as const) {
    const foot = footAt(c, sign, q);
    placeLeg(
      rig,
      buf,
      side,
      legs,
      hips,
      hipsRot,
      [foot.x, foot.y, foot.z],
      foot.pitch,
      sign * c.toeOut,
    );
  }

  // Trunk: the shoulders turn against the pelvis and stay nearly level; the head looks ahead.
  const lean = run ? (6 + 7 * vigor) * DEG : (1.5 + 2.5 * vigor) * DEG;
  const yaw = pelvisYaw(c, p);
  const roll = pelvisRoll(c, p);
  const counter = (run ? 7 + 5 * vigor : 2 + 3.5 * vigor) * DEG * reach;
  const chestYaw = counter * dmath.cos(TAU * p);
  // The chest pitches a little twice a stride as each foot takes the weight.
  const nod = (run ? 1.2 : 0.5) * DEG * reach * dmath.cos(2 * TAU * (p - 0.06));
  placeTrunk(
    rig,
    buf,
    hipsRot,
    quatFromEuler(0.6 * lean, 0.4 * yaw + 0.3 * chestYaw, 0.35 * roll),
    quatFromEuler(lean + nod, chestYaw, -0.3 * roll),
    quatFromEuler(0.45 * lean, 0.4 * chestYaw, -0.1 * roll),
    quatFromEuler(0.12 * lean, 0, 0),
  );

  // Arms swing against the legs: the left arm is forward as the right foot lands. They hang
  // clear of the hips; a runner's bent arms pass in front of them and need less.
  const chestPitch = lean + nod;
  const out = (run ? 0.5 : 1) * armsOut(rig);
  for (const [side, sign, q] of [
    ['l', 1, dmath.frac(p + 0.5)],
    ['r', -1, p],
  ] as const) {
    // +1 with the arm fully forward; the elbow follows a little later.
    const swing = dmath.cos(TAU * (q - 0.03));
    const late = dmath.cos(TAU * (q - 0.1));
    let forward: number;
    let elbow: number;
    let inward: number;
    if (run) {
      forward = (-4 + (30 + 12 * vigor) * swing) * DEG;
      elbow = (88 + 14 * late) * DEG;
      inward = (4 + 7 * dmath.max(0, swing)) * DEG;
    } else {
      const amp = (0.35 + 0.65 * dmath.min(1.5, vigor)) * reach;
      forward = (-3 + 17 * swing) * DEG * amp;
      elbow = (10 + 4 * amp + 15 * amp * (0.5 + 0.5 * late)) * DEG;
      inward = 3 * DEG * amp * dmath.max(0, swing);
    }
    // The arm hangs from a leaning chest: take the lean back out before swinging it.
    rotateX(buf, j(rig, `upperArm.${side}`), -forward - chestPitch);
    rotateZ(buf, j(rig, `upperArm.${side}`), sign * (out - inward));
    rotateX(buf, j(rig, `foreArm.${side}`), -elbow);
    turnForearm(rig, buf, side, (run ? 25 : 40) * DEG);
    rotateX(buf, j(rig, `hand.${side}`), (run ? 8 : 4) * DEG);
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

/** A seeded value held for a window of `period` seconds and eased into over `ease` seconds. */
function held(
  seconds: number,
  period: number,
  ease: number,
  offset: number,
  value: (window: number) => number,
): number {
  const t = seconds / period + offset;
  const window = dmath.floor(t);
  const ramp = dmath.smoothstep(((t - window) * period) / ease);
  return dmath.lerp(value(window - 1), value(window), ramp);
}

/** A head glance: a new seeded yaw every 3 s, eased in over 0.6 s. */
function glanceAt(seconds: number, seed: number): number {
  return held(seconds, 3, 0.6, 0, (k) => 24 * DEG * (unit01(seed, 100 + k) - 0.5));
}

/** A slow nod: a new seeded head pitch every 4.3 s. */
function nodAt(seconds: number, seed: number): number {
  return held(seconds, 4.3, 0.9, unit01(seed, 5), (k) => 7 * DEG * (unit01(seed, 3000 + k) - 0.5));
}

/** Breathing (−1..1, fifteen breaths a minute), each figure at its own point in the breath. */
function breathAt(seconds: number, seed: number): number {
  return dmath.sin(TAU * 0.25 * seconds + unit01(seed, 1) * TAU);
}

/**
 * How far beyond their rest angle a biped's arms hang out so the hands clear the hips, radians:
 * nothing on a body whose shoulders are as wide as its hips, a few degrees on wider hips.
 */
function armsOut(rig: FigureRig): number {
  const m = rig.metrics;
  const elbow = rig.joints[j(rig, 'foreArm.l')];
  if (elbow === undefined || m.hipOutline <= 0) return 0;
  const rest = dmath.atan2(dmath.abs(elbow.bindPos[0]), dmath.abs(elbow.bindPos[1]));
  // The wrist stands a hand's thickness and a little cloth off the hip.
  const need = m.hipOutline + 0.03 * rig.height - m.shoulderHalf;
  const angle = dmath.asin(dmath.clamp(need / (m.upperArmLen + m.foreArmLen), 0, 0.42));
  return dmath.max(0, angle - rest);
}

/** Breathing, sway, and seeded head glances; a function of time, never of accumulated state. */
export function idlePose(rig: FigureRig, seconds: number, seed: number, buf: PoseBuffer): void {
  const H = rig.height;
  const s0 = unit01(seed, 1) * TAU;
  const s1 = unit01(seed, 2) * TAU;
  const breath = breathAt(seconds, seed);
  const glance = glanceAt(seconds, seed);
  if (rig.archetype !== 'biped') {
    rotateX(buf, j(rig, 'chest'), 1.5 * DEG * breath);
    translateRoot(buf, 0, 0.004 * H * breath, 0);
    rotateZ(buf, j(rig, 'hips'), 0.8 * DEG * dmath.sin(TAU * 0.09 * seconds + s1));
    rotateY(buf, j(rig, 'head'), glance);
    for (let seg = 0; seg < 3; seg++) {
      rotateY(
        buf,
        j(rig, `tail.${seg}`),
        6 * DEG * dmath.sin(TAU * 0.3 * seconds + s1 - 0.5 * seg),
      );
    }
    return;
  }
  const legs = bipedLegs(rig);
  // People stand on one leg more than the other and change over now and then: −1 is all the
  // weight on the right leg, 1 on the left. Each figure keeps its own rhythm.
  const period = 6 + 5 * unit01(seed, 3);
  const weight = held(seconds, period, 1.8, unit01(seed, 4), (k) => {
    const side = unit01(seed, 1000 + k) < 0.5 ? -1 : 1;
    return side * (0.35 + 0.65 * unit01(seed, 2000 + k));
  });
  const drift = dmath.sin(TAU * 0.09 * seconds + s1);
  const hipsRoll = 3.4 * weight * DEG;
  const hipsYaw = -2 * weight * DEG;
  const hipsRot = quatFromEuler(0, hipsYaw, hipsRoll);
  if (legs !== undefined) {
    // The pelvis shifts over the loaded leg and drops on the other side, whose knee gives; the
    // feet stay put. It sinks by what its tilt lifts the loaded hip, so that leg stays just short
    // of straight.
    const lifted = legs.hipHalf * dmath.sqrt(dmath.sin(hipsRoll) ** 2 + 1e-5);
    const hips: Vec3 = [
      (0.36 * weight + 0.03 * drift) * legs.hipHalf,
      legs.hipHeight - 0.004 * legs.length - 1.05 * lifted + 0.001 * H * breath,
      0.004 * H * dmath.sin(TAU * 0.07 * seconds + s0),
    ];
    translateRoot(buf, hips[0], hips[1] - legs.hipHeight, hips[2]);
    for (const [side, sign] of [
      ['l', 1],
      ['r', -1],
    ] as const)
      placeLeg(
        rig,
        buf,
        side,
        legs,
        hips,
        hipsRot,
        [sign * legs.hipHalf, legs.ankle, 0],
        0,
        sign * 5 * DEG,
      );
  }
  // The spine takes the pelvis's tilt back out, a little past level at the shoulders.
  const chestPitch = 1.4 * DEG * breath;
  const chestRoll = -0.35 * hipsRoll;
  const nod = nodAt(seconds, seed);
  placeTrunk(
    rig,
    buf,
    hipsRot,
    quatFromEuler(0.4 * chestPitch, 0.5 * hipsYaw, 0.3 * hipsRoll),
    quatFromEuler(chestPitch, 0, chestRoll),
    quatFromEuler(0.3 * nod, 0.35 * glance, 0.4 * chestRoll),
    quatFromEuler(nod, glance, 0),
  );
  // Turn the whole forearm, not just the wrist: backs of hands angle forward, with palms
  // facing diagonally inward/back and a small relaxed wrist flexion. The arms hang plumb from
  // the tilted chest and drift a little, each at its own pace.
  const out = armsOut(rig);
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1],
  ] as const) {
    const sway = dmath.sin(TAU * 0.11 * seconds + s1 + (sign > 0 ? 0 : 2.1));
    // The shoulders rise a little on the in-breath.
    const shrug = sign * 0.6 * DEG * breath;
    rotateZ(buf, j(rig, `shoulder.${side}`), shrug);
    rotateX(buf, j(rig, `upperArm.${side}`), (3 + 0.9 * sway) * DEG - chestPitch);
    rotateZ(buf, j(rig, `upperArm.${side}`), -chestRoll - shrug + sign * out);
    rotateX(buf, j(rig, `foreArm.${side}`), -9 * DEG);
    turnForearm(rig, buf, side, REST_FOREARM_ROLL);
    rotateX(buf, j(rig, `hand.${side}`), 3 * DEG);
    rotateZ(buf, j(rig, `hand.${side}`), (side === 'l' ? -5 : 5) * DEG);
  }
}

/** Rising in a jump: one knee leads, the arms are out and forward for balance. */
export function jumpPose(rig: FigureRig, buf: PoseBuffer): void {
  if (rig.archetype === 'biped') {
    rotateX(buf, j(rig, 'spine'), 5 * DEG);
    rotateX(buf, j(rig, 'head'), -6 * DEG);
    for (const [side, sign] of [
      ['l', 1],
      ['r', -1],
    ] as const) {
      const lead = side === 'l';
      rotateX(buf, j(rig, `upperLeg.${side}`), (lead ? -50 : -18) * DEG);
      rotateZ(buf, j(rig, `upperLeg.${side}`), sign * 3 * DEG);
      rotateX(buf, j(rig, `lowerLeg.${side}`), (lead ? 80 : 46) * DEG);
      rotateX(buf, j(rig, `foot.${side}`), (lead ? 14 : 28) * DEG);
      rotateZ(buf, j(rig, `upperArm.${side}`), sign * (lead ? 24 : 34) * DEG);
      rotateX(buf, j(rig, `upperArm.${side}`), (lead ? -12 : -34) * DEG);
      rotateX(buf, j(rig, `foreArm.${side}`), (lead ? -64 : -48) * DEG);
      turnForearm(rig, buf, side, 35 * DEG);
    }
    return;
  }
  for (const leg of ['fl', 'fr']) rotateX(buf, j(rig, `upperLeg.${leg}`), -35 * DEG);
  for (const leg of ['hl', 'hr']) rotateX(buf, j(rig, `upperLeg.${leg}`), 25 * DEG);
}

/**
 * Dropping: arms out for balance and circling a little, knees loose, feet reaching for the
 * ground. `seconds` and `seed` keep the limbs alive through a long fall.
 */
export function fallPose(rig: FigureRig, buf: PoseBuffer, seconds = 0, seed = 0): void {
  if (rig.archetype === 'biped') {
    const beat = TAU * 1.6 * seconds + unit01(seed, 6) * TAU;
    rotateX(buf, j(rig, 'spine'), 5 * DEG);
    rotateX(buf, j(rig, 'head'), 6 * DEG);
    for (const [side, sign] of [
      ['l', 1],
      ['r', -1],
    ] as const) {
      const lead = side === 'r';
      const wave = dmath.sin(beat + (lead ? 0 : 2.4));
      const kick = dmath.sin(0.8 * beat + (lead ? 1.1 : 3.7));
      rotateZ(buf, j(rig, `upperArm.${side}`), sign * ((lead ? 56 : 64) + 7 * wave) * DEG);
      rotateX(buf, j(rig, `upperArm.${side}`), ((lead ? -22 : -8) + 9 * dmath.cos(beat)) * DEG);
      rotateX(buf, j(rig, `foreArm.${side}`), ((lead ? -34 : -24) + 8 * wave) * DEG);
      turnForearm(rig, buf, side, 30 * DEG);
      rotateX(buf, j(rig, `upperLeg.${side}`), ((lead ? -24 : -6) + 6 * kick) * DEG);
      rotateZ(buf, j(rig, `upperLeg.${side}`), sign * 5 * DEG);
      rotateX(buf, j(rig, `lowerLeg.${side}`), ((lead ? 38 : 22) + 8 * kick) * DEG);
      rotateX(buf, j(rig, `foot.${side}`), 18 * DEG);
    }
    return;
  }
  for (const leg of ['fl', 'fr', 'hl', 'hr']) rotateX(buf, j(rig, `lowerLeg.${leg}`), 25 * DEG);
}

/** A joint's figure-space position and rotation under a pose buffer (the root translation left out). */
function jointFrame(rig: FigureRig, buf: PoseBuffer, index: number): { pos: Vec3; rot: Quat } {
  const chain: number[] = [];
  for (let k = index; k >= 0; k = rig.joints[k]?.parent ?? -1) chain.push(k);
  let pos: Vec3 = [0, 0, 0];
  let rot: Quat = [0, 0, 0, 1];
  for (let i = chain.length - 1; i >= 0; i--) {
    const k = chain[i] as number;
    const joint = rig.joints[k];
    if (!joint) continue;
    const o = quatRotateVec3(rot, joint.bindPos);
    pos = [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]];
    rot = quatMul(quatMul(rot, joint.bindRot), getQuat(buf, k));
  }
  return { pos, rot };
}

function unit(v: Vec3): Vec3 {
  const l = dmath.hypot(v[0], v[1], v[2]);
  return l === 0 ? [0, -1, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Rest a seated biped's hands on its thighs, wherever the legs are (hanging from a chair or
 * drawn up on a floor): each wrist a little above the thigh, the elbow back and out, palm down.
 */
export function restHandsOnThighs(rig: FigureRig, buf: PoseBuffer): void {
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1],
  ] as const) {
    const u = j(rig, `upperArm.${side}`);
    const f = j(rig, `foreArm.${side}`);
    const h = j(rig, `hand.${side}`);
    const thigh = j(rig, `upperLeg.${side}`);
    const shin = j(rig, `lowerLeg.${side}`);
    const upper = rig.joints[u];
    const fore = rig.joints[f];
    const hand = rig.joints[h];
    if (!upper || !fore || !hand || thigh < 0 || shin < 0) continue;
    const hip = jointFrame(rig, buf, thigh).pos;
    const knee = jointFrame(rig, buf, shin).pos;
    const along = unit([knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]]);
    // Up off the thigh: the vertical, less its part along the thigh.
    const up = unit([-along[1] * along[0], 1 - along[1] * along[1], -along[1] * along[2]]);
    const length = dmath.hypot(knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]);
    const off = 1.25 * rig.metrics.limbRadius + 0.2 * rig.metrics.handLen;
    const target: Vec3 = [
      hip[0] + along[0] * 0.5 * length + up[0] * off + sign * 0.1 * rig.metrics.limbRadius,
      hip[1] + along[1] * 0.5 * length + up[1] * off,
      hip[2] + along[2] * 0.5 * length + up[2] * off,
    ];
    const parent = jointFrame(rig, buf, upper.parent);
    const o = quatRotateVec3(parent.rot, upper.bindPos);
    const shoulder: Vec3 = [parent.pos[0] + o[0], parent.pos[1] + o[1], parent.pos[2] + o[2]];
    const solved = solveTwoBoneIk(
      shoulder,
      target,
      [sign * 0.55, -0.2, -1],
      dmath.hypot(fore.bindPos[0], fore.bindPos[1], fore.bindPos[2]),
      dmath.hypot(hand.bindPos[0], hand.bindPos[1], hand.bindPos[2]),
    );
    const upperRot = quatFromTo(unit(fore.bindPos), solved.upperDir);
    const lowerRot = quatFromTo(unit(hand.bindPos), solved.lowerDir);
    setQuat(buf, u, quatMul(quatConjugate(quatMul(parent.rot, upper.bindRot)), upperRot));
    setQuat(buf, f, quatMul(quatConjugate(quatMul(upperRot, fore.bindRot)), lowerRot));
    turnForearm(rig, buf, side, 78 * DEG);
    setQuat(buf, h, [0, 0, 0, 1]);
    rotateX(buf, h, 6 * DEG);
  }
}

/**
 * Seated: thighs forward and a little apart, shins down, hands on the thighs; the root is
 * re-anchored by the caller. `seconds` and `seed` add breathing and the idle's head glances.
 */
export function sitPose(rig: FigureRig, buf: PoseBuffer, seconds = 0, seed = 0): void {
  if (rig.archetype === 'biped') {
    const breath = breathAt(seconds, seed);
    const glance = glanceAt(seconds, seed);
    for (const [side, sign] of [
      ['l', 1],
      ['r', -1],
    ] as const) {
      rotateX(buf, j(rig, `upperLeg.${side}`), -85 * DEG);
      rotateZ(buf, j(rig, `upperLeg.${side}`), sign * 4 * DEG);
      rotateX(buf, j(rig, `lowerLeg.${side}`), 85 * DEG);
    }
    rotateX(buf, j(rig, 'spine'), -5 * DEG);
    rotateX(buf, j(rig, 'chest'), (1 + 1.2 * breath) * DEG);
    rotateY(buf, j(rig, 'neck'), 0.35 * glance);
    rotateX(buf, j(rig, 'neck'), 2 * DEG);
    rotateY(buf, j(rig, 'head'), 0.65 * glance);
    rotateX(buf, j(rig, 'head'), 2 * DEG + 0.5 * nodAt(seconds, seed));
    restHandsOnThighs(rig, buf);
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

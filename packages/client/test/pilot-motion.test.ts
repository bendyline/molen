import { BOOST_SPEED_MULTIPLIER } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PILOT_MOTION,
  PilotMotion,
  type PilotMotionOverrides,
  type PilotMotionPose,
  pilotMotionSample,
  pilotMotionTuning,
} from '../src/pilot-motion';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
const G = 9.81;
const DT = 1 / 60;
const XYZ = [0, 1, 2] as const;
const LEVEL: Quat = [0, 0, 0, 1];
/** Banked right by `angle`: a rotation about the nose (+Z). */
const banked = (angle: number): Quat => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
/** World acceleration that puts `load` g straight up through a level seat. */
const pull = (load: number): Vec3 => [0, (load - 1) * G, 0];
/** World acceleration of a coordinated turn banked right by `angle`: the load stays in the seat. */
const turning = (angle: number): Vec3 => [-G * Math.tan(angle), 0, 0];
const { heave, surge, head } = DEFAULT_PILOT_MOTION;

function near(actual: readonly number[], expected: readonly number[], digits = 9): void {
  expect(actual).toHaveLength(expected.length);
  for (const [i, value] of actual.entries()) expect(value).toBeCloseTo(expected[i] ?? NaN, digits);
}

/** A seat moved by hand: a pilot boards it as it stands, then it accelerates as told. */
class Seat {
  time = 0;
  position: Vec3 = [0, 1000, 0];
  velocity: Vec3 = [0, 0, 80];
  readonly pilot: PilotMotion;
  private readonly scale: number;
  pose: PilotMotionPose;
  constructor(
    public rotation: Quat = LEVEL,
    options: { tuning?: boolean | PilotMotionOverrides; travelScale?: number } = {},
  ) {
    this.pilot = new PilotMotion(options.tuning);
    this.scale = options.travelScale ?? 1;
    this.pose = this.sample();
  }
  private sample(): PilotMotionPose {
    return this.pilot.update({
      time: this.time,
      position: this.position,
      rotation: this.rotation,
      velocity: [
        this.velocity[0] * this.scale,
        this.velocity[1] * this.scale,
        this.velocity[2] * this.scale,
      ],
      travelScale: this.scale,
    });
  }
  /** Accelerate at `acceleration` (m/s², world) for `seconds`, sampled every `step`. */
  run(seconds: number, acceleration: Vec3 = [0, 0, 0], step = DT): PilotMotionPose {
    for (let n = Math.round(seconds / step); n > 0; n--) {
      for (const i of XYZ) {
        this.velocity[i] += acceleration[i] * step;
        this.position[i] += this.velocity[i] * this.scale * step;
      }
      this.time += step;
      this.pose = this.sample();
    }
    return this.pose;
  }
}

describe('pilot motion', () => {
  it('rests at the authored eye point in steady flight', () => {
    const seat = new Seat();
    const pose = seat.run(2);
    near(pose.offset, [0, 0, 0]);
    near([pose.pitch, pose.yaw, pose.roll], [0, 0, 0]);
    near(seat.pilot.load, [0, 1, 0]);
  });

  it('gives the same pose when asked twice in one tick', () => {
    const seat = new Seat();
    seat.run(0.5, pull(5));
    const once = structuredClone(seat.pilot.pose);
    const again = seat.pilot.update({
      time: seat.time,
      position: seat.position,
      rotation: seat.rotation,
      velocity: seat.velocity,
    });
    expect(again).toEqual(once);
  });

  it('sinks into the seat and drops the chin in a pull, within the seat pan', () => {
    const seat = new Seat();
    const pose = seat.run(0.6, pull(5));
    expect(seat.pilot.load[1]).toBeCloseTo(5);
    // 4 g over rest at 8 mm a g, less the little braced so far and the soft limit: 2.5 cm.
    expect(pose.offset[1]).toBeLessThan(-0.02);
    expect(pose.offset[1]).toBeGreaterThan(-0.03);
    expect(pose.pitch).toBeLessThan(-0.01);
    expect(pose.offset[0]).toBeCloseTo(0, 9);
    // Far beyond any airframe, the eye still stops short of the seat pan.
    const crushed = new Seat().run(1, pull(40));
    expect(crushed.offset[1]).toBeGreaterThan(-heave.limit[0]);
    expect(crushed.offset[1]).toBeLessThan(-0.035);
  });

  it('braces against a held load and comes up past rest when it is released', () => {
    const seat = new Seat();
    const onset = seat.run(0.6, pull(5)).offset[1];
    const held = seat.run(5, pull(5)).offset[1];
    // Braced, the pilot has recovered part of the sink (heave.brace is 0.3).
    expect(held).toBeGreaterThan(onset + 0.003);
    expect(held).toBeLessThan(-0.015);
    let highest = -Infinity;
    for (let i = 0; i < 60; i++) highest = Math.max(highest, seat.run(DT).offset[1]);
    expect(highest).toBeGreaterThan(0.004);
    expect(Math.abs(seat.run(8).offset[1])).toBeLessThan(0.0005);
  });

  it('floats against the straps unloaded, less far than it sinks', () => {
    const pose = new Seat().run(0.6, pull(-2));
    expect(pose.offset[1]).toBeGreaterThan(0.012);
    expect(pose.offset[1]).toBeLessThan(heave.limit[1]);
    // Light in the seat, the chin comes up.
    expect(pose.pitch).toBeGreaterThan(0.005);
  });

  it('is thrown forward by braking and pressed back, less far, by thrust', () => {
    const braking = new Seat().run(0.5, [0, 0, -0.7 * G]);
    expect(braking.offset[2]).toBeGreaterThan(0.012);
    // Thrown forward the head nods; the eye rides forward of the neck with it.
    expect(braking.pitch).toBeLessThan(-0.015);
    const thrust = new Seat().run(0.5, [0, 0, 0.7 * G]);
    expect(thrust.offset[2]).toBeLessThan(-0.008);
    expect(thrust.offset[2]).toBeGreaterThan(-surge.limit[0]);
    // The headrest: no tipping back.
    expect(thrust.pitch).toBeCloseTo(0, 6);
    expect(braking.offset[2]).toBeGreaterThan(-thrust.offset[2]);
  });

  it('sways to the outside of a skid and tilts the head with the body', () => {
    // Accelerating to the left (+X): the body goes right.
    const pose = new Seat().run(0.5, [0.5 * G, 0, 0]);
    expect(pose.offset[0]).toBeLessThan(-0.008);
    expect(pose.roll).toBeGreaterThan(0.01);
  });

  it('levels the head toward the horizon in a coordinated bank, not inverted', () => {
    const turn = (angle: number): PilotMotionPose => new Seat(banked(angle)).run(8, turning(angle));
    const right = turn(Math.PI / 4);
    // Banked right, the head tilts left: half of horizonLean at 45°, eased by the soft limit.
    expect(right.roll).toBeCloseTo(-head.limit * Math.tanh(head.horizonLean / 2 / head.limit), 4);
    expect(right.roll).toBeLessThan(-0.05);
    // The tilted head carries the eye to the left of the neck.
    expect(right.offset[0]).toBeGreaterThan(0.004);
    expect(turn(-Math.PI / 4).roll).toBeCloseTo(-right.roll, 6);
    // Hanging inverted there is no horizon to level to (the body's own sway left out).
    const inverted = new Seat(banked(Math.PI * 0.8), { tuning: { head: { swayTilt: 0 } } });
    expect(inverted.pose.roll).toBeCloseTo(0, 9);
  });

  it('boards a tilted seat already settled in it', () => {
    const seat = new Seat(banked(0.3));
    const boarded = structuredClone(seat.pose);
    expect(boarded.roll).toBeLessThan(-0.02);
    const later = seat.run(1);
    expect(later.roll).toBeCloseTo(boarded.roll, 6);
    near(later.offset, boarded.offset, 6);
  });

  it('lets the head lag the start of a roll', () => {
    // A roll to the right spinning up at 6 rad/s² for a quarter of a second.
    const rollIn = (tuning: PilotMotionOverrides): number => {
      const seat = new Seat(LEVEL, { tuning });
      seat.run(0.2);
      let angle = 0;
      let rate = 0;
      let furthest = 0;
      for (let i = 0; i < 15; i++) {
        rate += 6 * DT;
        angle += rate * DT;
        seat.rotation = banked(angle);
        furthest = Math.min(furthest, seat.run(DT, turning(angle)).roll);
      }
      return furthest;
    };
    const lagging = rollIn({});
    const rigid = rollIn({ head: { lag: 0 } });
    // Left behind, the head rolls left of the airframe: over a degree beyond the horizon lean.
    expect(lagging).toBeLessThan(rigid - 0.015);
    expect(lagging).toBeGreaterThan(-head.limit);
  });

  it('takes a teleport as a fresh seat and an impact in place as a jolt', () => {
    const seat = new Seat();
    seat.run(1, pull(3));
    seat.position = [50_000, 20, -3_000];
    seat.velocity = [0, 0, 0];
    near(seat.run(DT).offset, [0, 0, 0]);
    near(seat.pilot.load, [0, 1, 0]);
    // The same stop without the jump throws the pilot onto the straps, and no further.
    const crash = new Seat();
    crash.run(0.5);
    crash.velocity = [0, 0, 0];
    let thrown = 0;
    for (let i = 0; i < 30; i++) thrown = Math.max(thrown, crash.run(DT).offset[2]);
    expect(thrown).toBeGreaterThan(0.02);
    expect(thrown).toBeLessThan(surge.limit[1] + head.neck * head.limit);
  });

  it('does not depend on how many ticks a frame covers', () => {
    const fine = new Seat().run(1.5, pull(4), DT);
    const coarse = new Seat().run(1.5, pull(4), 3 * DT);
    expect(coarse.offset[1]).toBeCloseTo(fine.offset[1], 3);
    expect(coarse.pitch).toBeCloseTo(fine.pitch, 3);
  });

  it('feels flown speed, not boosted travel', () => {
    const boosted = new Seat(LEVEL, { travelScale: BOOST_SPEED_MULTIPLIER }).run(0.6, pull(5));
    const plain = new Seat().run(0.6, pull(5));
    expect(boosted.offset[1]).toBeCloseTo(plain.offset[1], 9);
    const sample = pilotMotionSample(
      1,
      { pos: [0, 0, 0], rot: LEVEL },
      { velocity: [0, 0, 8], boosted: true },
    );
    expect(sample.travelScale).toBe(BOOST_SPEED_MULTIPLIER);
  });

  it('switches off as a whole and scales with intensity', () => {
    const seat = new Seat(LEVEL, { tuning: false });
    near(seat.run(0.6, pull(6)).offset, [0, 0, 0]);
    // Switched on mid-flight it starts settled, then follows.
    seat.pilot.configure(true);
    expect(seat.run(DT, pull(6)).offset[1]).toBeCloseTo(0, 6);
    expect(seat.run(0.6, pull(6)).offset[1]).toBeLessThan(-0.02);
    seat.pilot.configure(false);
    near(seat.run(DT, pull(6)).offset, [0, 0, 0]);

    const gentle = new Seat(LEVEL, { tuning: { intensity: 0.5 } }).run(0.4, pull(2));
    const tuned = new Seat().run(0.4, pull(2));
    expect(gentle.offset[1] / tuned.offset[1]).toBeCloseTo(0.5, 1);
  });

  it('merges tuning without touching the defaults', () => {
    const tuning = pilotMotionTuning({ heave: { travel: 0.02 }, head: { horizonLean: 0 } });
    expect(tuning.heave).toEqual({ ...heave, travel: 0.02 });
    expect(tuning.head.horizonLean).toBe(0);
    expect(tuning.surge).toEqual(surge);
    expect(DEFAULT_PILOT_MOTION.heave.travel).toBe(0.008);
    expect(pilotMotionTuning(false, tuning)).toEqual({ ...tuning, enabled: false });
  });
});

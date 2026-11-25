import type { VehicleSpec } from '@bendyline/molen-schema';
import type { TransformData } from '../component';
import { dmath as m } from '../dmath';
import {
  initialVehicleState,
  stepVehicle,
  type VehicleEnvironment,
  type VehicleInputData,
  type VehicleStateData,
} from '../vehicles';

const G = 9.81;
const FLAT: VehicleEnvironment = { groundHeight: () => 0 };

export interface DriveTrialPose {
  transform: TransformData;
  state: VehicleStateData;
}

export interface DriveTrialOptions {
  seconds: number;
  /** Host tick rate; default 60. The solver substeps below it. */
  hz?: number;
  /** The driver: this tick's inputs from the state before it. */
  controls: (
    state: VehicleStateData,
    seconds: number,
    transform: TransformData,
  ) => VehicleInputData;
  /** State the trial starts in, over a car at rest at the origin heading +Z. */
  start?: Partial<VehicleStateData>;
  /** Called after each tick; return true to end the trial. */
  watch?: (state: VehicleStateData, seconds: number, transform: TransformData) => boolean;
  /** Defaults to level dry pavement in still air. */
  environment?: VehicleEnvironment;
}

/** Drive the production solver under a scripted driver. */
export function driveTrial(
  spec: VehicleSpec,
  { seconds, hz = 60, controls, start = {}, watch = () => false, environment }: DriveTrialOptions,
): DriveTrialPose {
  let transform: TransformData = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
  let state: VehicleStateData = { ...initialVehicleState(), ...start };
  for (let tick = 0; tick < seconds * hz; tick++) {
    const result = stepVehicle(
      transform,
      state,
      controls(state, tick / hz, transform),
      spec,
      1 / hz,
      environment ?? FLAT,
    );
    transform = result.transform;
    state = result.state;
    if (watch(state, (tick + 1) / hz, transform)) break;
  }
  return { transform, state };
}

const FLAT_OUT: VehicleInputData = { throttle: 1, steering: 0, brake: false };
const BRAKING: VehicleInputData = { throttle: 0, steering: 0, brake: true };

/**
 * Seconds at full throttle to reach `speed` m/s from `from` (rest by default); Infinity if it
 * never gets there within a minute.
 */
export function accelerationTime(
  spec: VehicleSpec,
  speed: number,
  from = 0,
  environment?: VehicleEnvironment,
): number {
  let time = Infinity;
  driveTrial(spec, {
    seconds: 60,
    controls: () => FLAT_OUT,
    start: from > 0 ? { speed: from } : {},
    watch: (state, t) => {
      if (state.speed < speed) return false;
      time = t;
      return true;
    },
    ...(environment ? { environment } : {}),
  });
  return time;
}

/** Seconds and speed (m/s) at the end of `distance` meters from a standing start. */
export function standingDistance(
  spec: VehicleSpec,
  distance = 402.336,
): { seconds: number; speed: number } | undefined {
  let result: { seconds: number; speed: number } | undefined;
  driveTrial(spec, {
    seconds: 90,
    controls: () => FLAT_OUT,
    watch: (state, t, transform) => {
      if (transform.pos[2] < distance) return false;
      result = { seconds: t, speed: state.speed };
      return true;
    },
  });
  return result;
}

/** Highest speed in m/s reached in two minutes at full throttle. */
export function topSpeed(spec: VehicleSpec): number {
  return driveTrial(spec, { seconds: 120, controls: () => FLAT_OUT }).state.speed;
}

/** Meters to stop from `speed` m/s with the brakes held on; Infinity if it has not in 30 s. */
export function stoppingDistance(
  spec: VehicleSpec,
  speed: number,
  environment?: VehicleEnvironment,
): number {
  let distance = Infinity;
  driveTrial(spec, {
    seconds: 30,
    controls: () => BRAKING,
    start: { speed },
    watch: (state, _t, transform) => {
      if (state.speed > 0.01) return false;
      distance = transform.pos[2];
      return true;
    },
    ...(environment ? { environment } : {}),
  });
  return distance;
}

export interface SteadyCornering {
  /** Mean of speed × yaw rate once settled, in g. */
  lateralG: number;
  /** Mean speed (m/s) and body roll (rad, right side down positive) over the same time. */
  speed: number;
  bodyRoll: number;
  /**
   * The vehicle left the plane of the road (onto two wheels, and over): the readings are its
   * last second on four.
   */
  tipped: boolean;
}

/**
 * Steady cornering with the wheel held over, as on a skidpad. The driver holds the entry speed
 * if the engine can; a heavy vehicle that cannot slows in the turn, which leaves its cornering
 * grip unchanged. Readings below `slowest` m/s are left out: the car has spun or stopped. A
 * vehicle too tall for its track goes over before its tires let go: what it held up to then is
 * its limit.
 */
export function steadyCornering(
  spec: VehicleSpec,
  speed: number = m.min(20, spec.maxSpeed * 0.7),
  steering = 1,
  slowest = 8,
): SteadyCornering {
  const readings: { t: number; lateral: number; pace: number; roll: number }[] = [];
  let tipped = false;
  driveTrial(spec, {
    seconds: 6,
    controls: (state) => ({
      throttle: m.clamp((speed - state.speed) * 0.5, 0, 1),
      steering,
      brake: false,
    }),
    start: { speed },
    watch: (state, t) => {
      if (state.freeBody) {
        tipped = true;
        return true;
      }
      if (state.speed > slowest)
        readings.push({
          t,
          lateral: m.abs(state.speed * (state.yawRate ?? 0)),
          pace: state.speed,
          roll: state.bodyRoll ?? 0,
        });
      return false;
    },
  });
  // Settled, the second half of the run; gone over, the most it held in its last second.
  const last = readings.at(-1)?.t ?? 0;
  const from = tipped ? last - 1 : 3;
  let lateral = 0;
  let pace = 0;
  let roll = 0;
  let count = 0;
  let most = 0;
  for (const reading of readings) {
    if (reading.t <= from) continue;
    most = m.max(most, reading.lateral);
    lateral += reading.lateral;
    pace += reading.pace;
    roll += reading.roll;
    count++;
  }
  const n = m.max(1, count);
  return {
    lateralG: (tipped ? most : lateral / n) / G,
    speed: pace / n,
    bodyRoll: roll / n,
    tipped,
  };
}

export interface RidingLap {
  /** The rider held the speed and stayed in line the whole way. */
  completed: boolean;
  /** Largest angle between where the machine points and where it goes, rad. */
  maxSideslip: number;
  /** Largest lean reached, rad. */
  maxLean: number;
  /** Lowest speed on the way, m/s. */
  slowest: number;
}

/**
 * A figure-eight: the steering held hard one way for `half` seconds, then the other, twice
 * round, at a held speed. A ridden machine leans in, turns, stands up and leans the other way;
 * one that slides out, spins or stalls has not completed it.
 */
export function figureEight(
  spec: VehicleSpec,
  speed: number = m.min(12, spec.maxSpeed * 0.6),
  half = 4,
  environment?: VehicleEnvironment,
): RidingLap {
  let maxSideslip = 0;
  let maxLean = 0;
  let slowest = Infinity;
  driveTrial(spec, {
    seconds: 4 * half,
    controls: (state, t) => ({
      throttle: m.clamp((speed - state.speed) * 0.5, 0, 1),
      steering: m.floor(t / half) % 2 === 0 ? 1 : -1,
      brake: false,
    }),
    start: { speed },
    watch: (state, t) => {
      if (t < 1) return false;
      const pace = m.hypot(state.speed, state.lateralSpeed ?? 0);
      slowest = m.min(slowest, state.speed);
      if (pace > 1)
        maxSideslip = m.max(
          maxSideslip,
          m.abs(m.atan2(state.lateralSpeed ?? 0, m.abs(state.speed))),
        );
      maxLean = m.max(maxLean, m.abs(state.bodyRoll ?? 0));
      return false;
    },
    ...(environment ? { environment } : {}),
  });
  return {
    completed: maxSideslip < 0.35 && slowest > 0.5 * speed,
    maxSideslip,
    maxLean,
    slowest,
  };
}

export interface LeanResponse {
  /** Lean the machine settles at, rad, right side down positive. */
  steadyLean: number;
  /** Seconds from the steering going over to nine tenths of that lean. */
  time: number | undefined;
  /** Furthest the front wheel turned away from the turn on the way in, rad: the countersteer. */
  countersteer: number;
}

/** From upright at `speed`, the steering held over to the right: how the lean arrives. */
export function leanResponse(
  spec: VehicleSpec,
  speed: number = m.min(12, spec.maxSpeed * 0.6),
  steering = 1,
): LeanResponse {
  const leans: [number, number][] = [];
  let countersteer = 0;
  driveTrial(spec, {
    seconds: 5,
    controls: (state) => ({
      throttle: m.clamp((speed - state.speed) * 0.5, 0, 1),
      steering,
      brake: false,
    }),
    start: { speed },
    watch: (state, t) => {
      leans.push([t, state.bodyRoll ?? 0]);
      if (t < 1.5) countersteer = m.max(countersteer, -m.sign(steering) * state.steer);
      return false;
    },
  });
  const last = leans.slice(-60);
  const steadyLean = last.reduce((sum, [, lean]) => sum + lean, 0) / m.max(1, last.length);
  const reached = leans.find(([, lean]) => m.abs(lean) >= 0.9 * m.abs(steadyLean));
  return { steadyLean, time: m.abs(steadyLean) > 0.02 ? reached?.[0] : undefined, countersteer };
}

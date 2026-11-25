import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  WeatherData,
} from '@bendyline/molen-schema';
import {
  type AircraftEnvironment,
  aircraftDragCoefficient,
  aircraftEngines,
  aircraftEngineThrust,
  bestPowerMixture,
  engineThrottle,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  levelFlightAngleOfAttack,
  sampleAtmosphere,
  stepAircraft,
} from '../aircraft';
import type { TransformData } from '../component';
import { dmath as m } from '../dmath';
import { elevatorTrimFor } from '../flight-surfaces';
import { vehicleRotation } from '../vehicles';
import { type Oscillation, oscillation, rateOfChange, type TrialSample } from './series';

const G = 9.81;
const SEA_LEVEL_DENSITY = 1.225;

/** An aircraft in flight: what `stepAircraft` takes and returns. */
export interface FlightTrialPose {
  transform: TransformData;
  state: AircraftStateData;
}

/** Configuration of an airplane for a trial. */
export interface FlightConfig {
  /** Throttle, 0–1; default 1. Past an afterburner's detent it selects reheat. */
  power?: number;
  gear?: boolean;
  /** Flap position 0–1, or down/up. */
  flaps?: boolean | number;
  weather?: WeatherData;
  /** Load factor the wing carries; default 1 (level flight). A level turn at 60° of bank is 2. */
  loadFactor?: number;
  /**
   * Fly the bare airframe: stick, pedals and a fixed trim straight to the control surfaces, no
   * assist. For an airplane with surfaces; others fly as they always do.
   */
  direct?: boolean;
}

/** Inputs that select direct control with the trim left where it is. */
function controlMode(config: FlightConfig): Partial<AircraftInputData> {
  return config.direct ? { controlMode: 'direct', pitchTrim: 0 } : {};
}

/** A steady point from the force balance: the wing carries the weight at this speed. */
export interface SteadyFlightPoint {
  speed: number;
  altitude: number;
  alpha: number;
  thrust: number;
  drag: number;
  cd: number;
  cl: number;
  mach: number;
  equivalentAirspeed: number;
  /** Thrust along the flight path less drag, N: positive accelerates or climbs. */
  excessThrust: number;
  /** Specific excess power, m/s: the steady rate of climb available at this speed. */
  specificExcessPower: number;
}

/** The same airframe at another all-up mass, for a figure published at a stated weight. */
export function atMass(spec: AircraftSpec, mass: number | undefined): AircraftSpec {
  return mass === undefined || mass === spec.mass ? spec : { ...spec, mass };
}

/**
 * The steady flight condition at `speed` (true, m/s) and `altitude`: the angle of attack at which
 * lift and the thrust's upward part carry the weight, with the thrust and drag there. Uses the
 * solver's own thrust and drag functions. `null` when the wing cannot carry the weight short of
 * the stall.
 */
export function steadyFlightPoint(
  spec: AircraftSpec,
  speed: number,
  altitude: number,
  { power = 1, gear = false, flaps = 0, weather = {}, loadFactor = 1 }: FlightConfig = {},
): SteadyFlightPoint | null {
  const atmosphere = sampleAtmosphere(weather, altitude);
  const wing = spec.airplane;
  if (!wing) throw new Error('Steady wing trim requires an airplane');
  const qS = 0.5 * atmosphere.densityKgM3 * speed ** 2 * wing.wingArea;
  const bank = aircraftEngines(spec);
  const thrustAt = (alpha: number): number =>
    bank.reduce(
      (sum, engine) =>
        sum +
        aircraftEngineThrust(
          engine,
          wing,
          atmosphere,
          speed * m.cos(alpha),
          power,
          undefined,
          // Leaned for best power, as a pilot would.
          bestPowerMixture(engine, atmosphere),
        ),
      0,
    );
  const liftAt = (alpha: number): number =>
    qS * ((alpha + wing.camberAngle) * wing.liftSlope + Number(flaps) * wing.flapLift);
  const weight = spec.mass * G * loadFactor;
  let lo = -wing.stallAngle - wing.camberAngle;
  let hi = wing.stallAngle - wing.camberAngle;
  if (liftAt(hi) + thrustAt(hi) * m.sin(hi) < weight) return null;
  for (let i = 0; i < 32; i++) {
    const alpha = (lo + hi) / 2;
    if (liftAt(alpha) + thrustAt(alpha) * m.sin(alpha) > weight) hi = alpha;
    else lo = alpha;
  }
  const alpha = (lo + hi) / 2;
  const thrust = thrustAt(alpha);
  const mach = speed / atmosphere.speedOfSound;
  const cl = (alpha + wing.camberAngle) * wing.liftSlope + Number(flaps) * wing.flapLift;
  const cd = aircraftDragCoefficient(wing, cl, mach, Number(wing.fixedGear || gear), Number(flaps));
  const drag = qS * cd;
  return {
    speed,
    altitude,
    alpha,
    thrust,
    drag,
    cd,
    cl,
    mach,
    equivalentAirspeed: speed * m.sqrt(atmosphere.densityKgM3 / SEA_LEVEL_DENSITY),
    excessThrust: thrust * m.cos(alpha) - drag,
    specificExcessPower: ((thrust * m.cos(alpha) - drag) * speed) / (spec.mass * G),
  };
}

/** All stable thrust/drag intersections, including separate subsonic and supersonic branches. */
export function levelSpeedRoots(
  spec: AircraftSpec,
  altitude: number,
  config: FlightConfig = {},
): SteadyFlightPoint[] {
  const roots: SteadyFlightPoint[] = [];
  let previous: SteadyFlightPoint | null = null;
  for (let speed = 5; speed <= 1100; speed += 2) {
    const at = steadyFlightPoint(spec, speed, altitude, config);
    if (at && previous && previous.excessThrust >= 0 && at.excessThrust < 0) {
      let lo = previous.speed;
      let hi = speed;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const point = steadyFlightPoint(spec, mid, altitude, config);
        if (point && point.excessThrust >= 0) lo = mid;
        else hi = mid;
      }
      const root = steadyFlightPoint(spec, (lo + hi) / 2, altitude, config);
      if (root) roots.push(root);
    }
    previous = at;
  }
  return roots;
}

/** The speed and rate of the best steady climb at an altitude, from the force balance. */
export function bestSteadyClimb(
  spec: AircraftSpec,
  altitude: number,
  config: FlightConfig = {},
): { rate: number; speed: number } | undefined {
  let best: { rate: number; speed: number } | undefined;
  const consider = (speed: number): void => {
    const at = steadyFlightPoint(spec, speed, altitude, config);
    if (at && (!best || at.specificExcessPower > best.rate))
      best = { rate: at.specificExcessPower, speed };
  };
  // A coarse sweep, then a fine one around its best.
  for (let speed = 10; speed <= 700; speed += 5) consider(speed);
  const coarse = (best as { rate: number; speed: number } | undefined)?.speed;
  if (coarse !== undefined)
    for (let speed = coarse - 4.5; speed <= coarse + 4.5; speed += 0.5) consider(speed);
  return best;
}

/**
 * The altitude in meters at which the best steady climb falls to `rate` m/s (0.508 m/s is the
 * 100 ft/min of a service ceiling), from the force balance.
 */
export function steadyCeiling(spec: AircraftSpec, config: FlightConfig = {}, rate = 0.508): number {
  const climbs = (altitude: number): boolean =>
    (bestSteadyClimb(spec, altitude, config)?.rate ?? -1) >= rate;
  if (!climbs(0)) return 0;
  let lo = 0;
  let hi = 32000;
  if (climbs(hi)) return hi;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (climbs(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The best power-off glide ratio and its speed at an altitude, from the force balance. */
export function steadyGlide(
  spec: AircraftSpec,
  altitude = 0,
  config: FlightConfig = {},
): { ratio: number; speed: number } | undefined {
  let best: { ratio: number; speed: number } | undefined;
  const consider = (speed: number): void => {
    const at = steadyFlightPoint(spec, speed, altitude, { ...config, power: 0 });
    // An idling propeller is a brake: its drag counts with the airframe's.
    if (!at || at.excessThrust >= 0) return;
    const ratio = (spec.mass * G) / -at.excessThrust;
    if (!best || ratio > best.ratio) best = { ratio, speed };
  };
  // A coarse sweep, then a fine one around its best.
  for (let speed = 10; speed <= 400; speed += 4) consider(speed);
  const coarse = (best as { ratio: number; speed: number } | undefined)?.speed;
  if (coarse !== undefined)
    for (let speed = coarse - 3.5; speed <= coarse + 3.5; speed += 0.5) consider(speed);
  return best;
}

/**
 * The tightest steady level turn at an altitude, from the force balance: the highest turn rate
 * at which thrust still meets drag, the wing is short of the stall and the load is within the
 * airframe's limit.
 */
export function steadyTurn(
  spec: AircraftSpec,
  altitude: number,
  config: FlightConfig = {},
): { rate: number; loadFactor: number; speed: number } | undefined {
  const limit = spec.airplane?.maxLoadFactor ?? 6;
  let best: { rate: number; loadFactor: number; speed: number } | undefined;
  for (let speed = 20; speed <= 600; speed += 2) {
    const sustains = (loadFactor: number): boolean => {
      const at = steadyFlightPoint(spec, speed, altitude, { ...config, loadFactor });
      return at !== null && at.excessThrust >= 0;
    };
    if (!sustains(1)) continue;
    let lo = 1;
    let hi = limit;
    if (sustains(hi)) lo = hi;
    else
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (sustains(mid)) lo = mid;
        else hi = mid;
      }
    const rate = (G * m.sqrt(m.max(0, lo * lo - 1))) / speed;
    if (!best || rate > best.rate) best = { rate, loadFactor: lo, speed };
  }
  return best;
}

/** Equivalent airspeed in m/s at which the wing's greatest lift equals the weight at one g. */
export function stallSpeedEstimate(spec: AircraftSpec, flaps: boolean | number = 0): number {
  const wing = spec.airplane;
  if (!wing) return 0;
  const cl = wing.stallAngle * wing.liftSlope + Number(flaps) * wing.flapLift;
  return m.sqrt((2 * spec.mass * G) / (SEA_LEVEL_DENSITY * wing.wingArea * m.max(0.05, cl)));
}

/**
 * An airplane already flying level at `speed` (true, m/s), trimmed at the angle of attack that
 * carries its weight, engines turning.
 */
export function airborneAircraft(
  spec: AircraftSpec,
  {
    speed,
    altitude,
    power = 1,
    gear = false,
    flaps = 0,
    weather = {},
    wind = [0, 0, 0],
    direct = false,
  }: FlightConfig & { speed: number; altitude: number; wind?: [number, number, number] },
): FlightTrialPose {
  const atmosphere = sampleAtmosphere(weather, altitude);
  const steady = steadyFlightPoint(spec, speed, altitude, { power, gear, flaps, weather });
  const alpha =
    steady?.alpha ?? levelFlightAngleOfAttack(spec, speed, atmosphere.densityKgM3, flaps);
  const surfaces = spec.airplane?.surfaces;
  return {
    transform: { pos: [0, altitude, 0], rot: vehicleRotation(0, -alpha, 0) },
    state: {
      ...initialAircraftState(),
      grounded: false,
      pitch: alpha,
      pitchTrim: alpha,
      velocity: [wind[0], wind[1], speed + wind[2]],
      rpm: 1,
      gearPosition: Number(gear),
      flapPosition: Number(flaps),
      // Trimmed for this speed, for a pilot who will fly the surfaces directly.
      ...(direct && surfaces && spec.airplane
        ? {
            elevatorTrim: elevatorTrimFor(spec.airplane, surfaces, alpha, steady?.cl ?? 0),
          }
        : {}),
      engines: Object.fromEntries(
        aircraftEngines(spec).map((e) => [
          e.id,
          {
            rpm: 1,
            rotorAngle: 0,
            failed: false,
            thrust: 0,
            ...(e.afterburnerThrust ? { afterburner: engineThrottle(e, power).afterburner } : {}),
          },
        ]),
      ),
    },
  };
}

/** The mixture a pilot leans to for best power at an altitude: full rich for most engines. */
export function leanedMixture(
  spec: AircraftSpec,
  altitude: number,
  weather: WeatherData = {},
): number {
  const engine = aircraftEngines(spec)[0];
  return engine ? bestPowerMixture(engine, sampleAtmosphere(weather, altitude)) : 1;
}

/** Engine running, brakes off, gear up and controls centered: the base for a pilot's inputs. */
export const FLIGHT_TRIAL_INPUT: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  brake: false,
  gear: false,
};

const unit = (value: number): number => m.clamp(value, -1, 1);

/** Stick and rudder that hold an altitude with the wings level and the ball centered. */
export function holdLevel(
  state: AircraftStateData,
  transform: TransformData,
  altitude: number,
): { pitch: number; roll: number; yaw: number } {
  return {
    pitch: unit(
      (altitude - transform.pos[1]) * 0.002 - state.verticalSpeed * 0.06 - state.pitchRate * 0.8,
    ),
    roll: unit(-state.roll * 2 - state.rollRate * 0.5),
    // Right pedal (positive) against a nose swinging left, and toward a slip to the right.
    yaw: unit((state.yawRate ?? 0) * 0.5 - (state.sideslip ?? 0) * 3),
  };
}

export interface FlightTrialOptions {
  seconds: number;
  /** Host tick rate; default 60. The solver substeps below it. */
  hz?: number;
  /** The pilot: this tick's inputs from the state before it. */
  controls: (
    state: AircraftStateData,
    seconds: number,
    transform: TransformData,
  ) => AircraftInputData;
  /** Called after each tick; return true to end the trial. */
  watch?: (pose: FlightTrialPose, seconds: number) => boolean | undefined;
  /** Defaults to open air: ground 10 km below, standard atmosphere, still air. */
  environment?: Partial<AircraftEnvironment>;
}

/** Fly the production solver from `start` under a scripted pilot. */
export function flightTrial(
  spec: AircraftSpec,
  start: FlightTrialPose,
  { seconds, hz = 60, controls, watch, environment }: FlightTrialOptions,
): FlightTrialPose & { seconds: number } {
  let pose = start;
  let elapsed = 0;
  const ticks = m.round(seconds * hz);
  for (let tick = 0; tick < ticks; tick++) {
    pose = stepAircraft(
      pose.transform,
      pose.state,
      controls(pose.state, tick / hz, pose.transform),
      spec,
      1 / hz,
      { groundHeight: () => -10000, wind: [0, 0, 0], ...environment, time: tick / hz },
    );
    elapsed = (tick + 1) / hz;
    if (!pose.state.velocity.every(Number.isFinite))
      throw new Error(`${spec.label}: invalid flight state`);
    if (watch?.(pose, elapsed)) break;
  }
  return { ...pose, seconds: elapsed };
}

/**
 * Hold an altitude for a time at a fixed throttle and report where the airspeed went: the cruise
 * and top-speed experiment. The pilot is `holdLevel`.
 */
export function flyLevel(
  spec: AircraftSpec,
  {
    speed,
    altitude,
    seconds = 30,
    hz = 30,
    power = 1,
    gear = false,
    flaps = 0,
    weather = {},
    wind = [0, 0, 0],
  }: FlightConfig & {
    speed: number;
    altitude: number;
    seconds?: number;
    hz?: number;
    wind?: [number, number, number];
  },
): FlightTrialPose & { maxAltitudeError: number } {
  const mixture = leanedMixture(spec, altitude, weather);
  let maxAltitudeError = 0;
  const end = flightTrial(
    spec,
    airborneAircraft(spec, { speed, altitude, power, gear, flaps, weather, wind }),
    {
      seconds,
      hz,
      environment: { weather, wind },
      controls: (state, _seconds, transform) => ({
        ...FLIGHT_TRIAL_INPUT,
        power,
        gear,
        flaps,
        mixture,
        ...holdLevel(state, transform, altitude),
      }),
      watch: (pose) => {
        maxAltitudeError = m.max(maxAltitudeError, m.abs(pose.transform.pos[1] - altitude));
        if (pose.state.crashed) throw new Error(`${spec.label}: invalid flight state`);
        return false;
      },
    },
  );
  return { transform: end.transform, state: end.state, maxAltitudeError };
}

/** One reading from a level run. Speeds in m/s. */
export interface LevelRunSample {
  seconds: number;
  /** True airspeed. */
  speed: number;
  equivalentAirspeed: number;
  /** Rate of change of true airspeed, m/s². */
  acceleration: number;
  /**
   * Rate of change of energy height (height plus speed² / 2g), m/s: the rate of climb the
   * airplane could hold at this speed, or power off, the sink of its glide. Counting the height
   * it gained or lost keeps the figure honest where the pilot did not hold the altitude exactly.
   */
  specificExcessPower: number;
  loadFactor: number;
}

export interface LevelRun {
  samples: LevelRunSample[];
  /** Equivalent airspeed at which the wing stalled, corrected to one g; undefined if it did not. */
  stallSpeed: number | undefined;
  maxAltitudeError: number;
  end: FlightTrialPose;
}

/**
 * The level acceleration (or deceleration) run of a flight-test program: hold an altitude at a
 * fixed throttle and record airspeed against time. With power on, speed times acceleration over
 * g is the rate of climb available at each speed and the run ends at the top speed; with power
 * off, g over the deceleration is the glide ratio at each speed and the run ends at the stall.
 */
export function levelRun(
  spec: AircraftSpec,
  {
    speed,
    altitude,
    seconds,
    power = 1,
    gear = false,
    flaps = 0,
    weather = {},
    hz = 60,
  }: FlightConfig & { speed: number; altitude: number; seconds: number; hz?: number },
): LevelRun {
  const density = sampleAtmosphere(weather, altitude).densityKgM3;
  const toEquivalent = m.sqrt(density / SEA_LEVEL_DENSITY);
  const speeds: TrialSample[] = [];
  const energies: TrialSample[] = [];
  const loads: number[] = [];
  let stallSpeed: number | undefined;
  const mixture = leanedMixture(spec, altitude, weather);
  let maxAltitudeError = 0;
  let settled = false;
  const every = m.max(1, m.round(hz / 4));
  let tick = 0;
  const end = flightTrial(
    spec,
    airborneAircraft(spec, { speed, altitude, power, gear, flaps, weather }),
    {
      seconds,
      hz,
      environment: { weather },
      controls: (state, _seconds, transform) => ({
        ...FLIGHT_TRIAL_INPUT,
        power,
        gear,
        flaps,
        mixture,
        ...holdLevel(state, transform, altitude),
      }),
      watch: ({ state, transform }, elapsed) => {
        tick++;
        const error = m.abs(transform.pos[1] - altitude);
        maxAltitudeError = m.max(maxAltitudeError, error);
        if (tick % every === 0) {
          speeds.push([elapsed, state.airspeed]);
          energies.push([elapsed, transform.pos[1] + state.airspeed ** 2 / (2 * G)]);
          loads.push(state.loadFactor ?? 1);
        }
        if (state.crashed) return true;
        if (state.stalled) {
          // The stall is the wing reaching its greatest lift; a sinking airplane reaches it
          // slower than one holding one g, so reduce the reading to one g.
          const load = m.clamp(state.loadFactor ?? 1, 0.5, 1.5);
          stallSpeed = (state.airspeed * toEquivalent) / m.sqrt(load);
          return true;
        }
        // Power on, the run is over when the airplane has stopped accelerating.
        const last = speeds.at(-1);
        const earlier = speeds.at(-21);
        if (power > 0 && elapsed > 20 && last && earlier) {
          settled = m.abs(last[1] - earlier[1]) < 0.02 * (last[0] - earlier[0]);
          if (settled) return true;
        }
        return false;
      },
    },
  );
  const samples: LevelRunSample[] = [];
  const rates = rateOfChange(speeds, 2);
  const powers = rateOfChange(energies, 2);
  for (const [index, [at, acceleration]] of rates.entries()) {
    const reading = speeds[index + 2];
    const power = powers[index];
    if (!reading || !power) continue;
    samples.push({
      seconds: at,
      speed: reading[1],
      equivalentAirspeed: reading[1] * toEquivalent,
      acceleration,
      specificExcessPower: power[1],
      loadFactor: loads[index + 2] ?? 1,
    });
  }
  return {
    samples,
    stallSpeed,
    maxAltitudeError,
    end: { transform: end.transform, state: end.state },
  };
}

export interface StallAndGlide {
  /** One-g stall speed, equivalent airspeed in m/s; undefined if the wing never stalled. */
  stallSpeed: number | undefined;
  /** Best power-off glide ratio, and the equivalent airspeed in m/s it is flown at. */
  glideRatio: number | undefined;
  glideSpeed: number | undefined;
}

/**
 * Power off, hold the altitude and let the speed decay to the stall. The deceleration on the way
 * down is the drag, so the same run gives the glide ratio at every speed.
 */
export function measureStallAndGlide(
  spec: AircraftSpec,
  config: FlightConfig & { altitude?: number } = {},
): StallAndGlide {
  const { altitude = 1000, flaps = 0 } = config;
  const density = sampleAtmosphere(config.weather ?? {}, altitude).densityKgM3;
  const estimate = stallSpeedEstimate(spec, flaps) / m.sqrt(density / SEA_LEVEL_DENSITY);
  const run = levelRun(spec, {
    ...config,
    altitude,
    power: 0,
    speed: estimate * 2.4,
    seconds: 400,
  });
  let glideRatio: number | undefined;
  let glideSpeed: number | undefined;
  for (const sample of run.samples) {
    // With the lift near the weight, the energy lost each second is the drag times the speed.
    if (sample.seconds < 3) continue;
    if (sample.specificExcessPower >= -0.01 || m.abs(sample.loadFactor - 1) > 0.05) continue;
    const ratio = sample.speed / -sample.specificExcessPower;
    if (glideRatio === undefined || ratio > glideRatio) {
      glideRatio = ratio;
      glideSpeed = sample.equivalentAirspeed;
    }
  }
  return { stallSpeed: run.stallSpeed, glideRatio, glideSpeed };
}

export interface ClimbAndTopSpeed {
  /** Best rate of climb available, m/s, and the true airspeed in m/s it is flown at. */
  climbRate: number | undefined;
  climbSpeed: number | undefined;
  /** True airspeed in m/s at which the airplane stopped accelerating; undefined if it had not. */
  topSpeed: number | undefined;
}

/**
 * Full power (or `power`), hold the altitude and accelerate from just above the stall. Speed
 * times acceleration over g is the specific excess power: the rate of climb the airplane would
 * have at that speed. The run ends at the level top speed.
 */
export function measureClimbAndTopSpeed(
  spec: AircraftSpec,
  config: FlightConfig & { altitude?: number; seconds?: number } = {},
): ClimbAndTopSpeed {
  const { altitude = 0, seconds = 600, flaps = 0 } = config;
  const density = sampleAtmosphere(config.weather ?? {}, altitude).densityKgM3;
  const estimate = stallSpeedEstimate(spec, flaps) / m.sqrt(density / SEA_LEVEL_DENSITY);
  const run = levelRun(spec, { ...config, altitude, speed: estimate * 1.1, seconds });
  let climbRate: number | undefined;
  let climbSpeed: number | undefined;
  for (const sample of run.samples) {
    // The first seconds are the pilot and the engine settling, not performance.
    if (sample.seconds < 2 || m.abs(sample.loadFactor - 1) > 0.1) continue;
    const rate = sample.specificExcessPower;
    if (climbRate === undefined || rate > climbRate) {
      climbRate = rate;
      climbSpeed = sample.speed;
    }
  }
  const last = run.samples.at(-1);
  const stopped = last !== undefined && m.abs(last.acceleration) < 0.03;
  if (climbSpeed !== undefined) {
    // The run sweeps through its best speed while the pilot is still settling, which reads
    // low. Fly it again from just below that speed, steady from the start.
    const again = levelRun(spec, { ...config, altitude, speed: climbSpeed * 0.96, seconds: 6 });
    for (const sample of again.samples) {
      if (sample.seconds < 1 || m.abs(sample.loadFactor - 1) > 0.1) continue;
      if (climbRate === undefined || sample.specificExcessPower > climbRate) {
        climbRate = sample.specificExcessPower;
        climbSpeed = sample.speed;
      }
    }
  }
  return { climbRate, climbSpeed, topSpeed: stopped ? last.speed : undefined };
}

/** The throttle that holds level flight at a speed, from the force balance; 1 if none does. */
export function levelFlightPower(
  spec: AircraftSpec,
  speed: number,
  altitude: number,
  config: FlightConfig = {},
): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const power = (lo + hi) / 2;
    const at = steadyFlightPoint(spec, speed, altitude, { ...config, power });
    if (at && at.excessThrust > 0) hi = power;
    else lo = power;
  }
  return (lo + hi) / 2;
}

export interface RollResponse {
  /** Highest roll rate reached, rad/s. */
  peakRate: number;
  /**
   * Seconds from the stick going over to 63% of the rate the roll settles at in its first three
   * seconds: the roll mode's time constant.
   */
  timeConstant: number | undefined;
  /** Seconds to bank through 60° and through a full turn; undefined if not reached. */
  timeTo60: number | undefined;
  timeTo360: number | undefined;
  /** Largest sideslip in the first second, rad; negative slips toward the roll. */
  sideslip: number;
}

/** From level flight at `speed` (true, m/s), full aileron and nothing else. */
export function measureRoll(
  spec: AircraftSpec,
  {
    speed,
    altitude = 1000,
    seconds = 12,
    ...config
  }: FlightConfig & { speed: number; altitude?: number; seconds?: number },
): RollResponse {
  const power = levelFlightPower(spec, speed, altitude, config);
  const hz = 120;
  const rates: TrialSample[] = [];
  let turned = 0;
  let peakRate = 0;
  let earlyRate = 0;
  let timeTo60: number | undefined;
  let timeTo360: number | undefined;
  let sideslip = 0;
  flightTrial(spec, airborneAircraft(spec, { ...config, speed, altitude, power }), {
    seconds,
    hz,
    environment: { weather: config.weather ?? {} },
    controls: () => ({
      ...FLIGHT_TRIAL_INPUT,
      ...controlMode(config),
      power,
      mixture: leanedMixture(spec, altitude, config.weather),
      roll: 1,
    }),
    watch: ({ state }, elapsed) => {
      turned += state.rollRate / hz;
      rates.push([elapsed, m.abs(state.rollRate)]);
      // The steady rate: a long roll dives and speeds up, which is not the aileron's doing.
      if (m.abs(turned) <= m.TAU) peakRate = m.max(peakRate, m.abs(state.rollRate));
      if (elapsed <= 3) earlyRate = m.max(earlyRate, m.abs(state.rollRate));
      if (elapsed <= 1 && m.abs(state.sideslip ?? 0) > m.abs(sideslip))
        sideslip = state.sideslip ?? 0;
      if (timeTo60 === undefined && m.abs(turned) >= m.PI / 3) timeTo60 = elapsed;
      if (m.abs(turned) >= m.TAU) {
        timeTo360 = elapsed;
        return true;
      }
      return false;
    },
  });
  const timeConstant = rates.find(([, rate]) => rate >= 0.632 * earlyRate)?.[0];
  return { peakRate, timeConstant, timeTo60, timeTo360, sideslip };
}

export interface TakeoffRun {
  /** Ground roll to the wheels leaving the runway, m, and the equivalent airspeed there. */
  groundRoll: number | undefined;
  liftoffSpeed: number | undefined;
  /** Distance from brake release to 15 m (50 ft) above the runway, m. */
  distanceOver15m: number | undefined;
}

/**
 * Full power from rest on a level sea-level runway; full back stick from `rotateSpeed`
 * (equivalent, m/s; default 1.1 times the stall speed in this configuration), then a steady
 * climb attitude.
 */
export function measureTakeoff(
  spec: AircraftSpec,
  config: FlightConfig & { rotateSpeed?: number } = {},
): TakeoffRun {
  const { flaps = 0, power = 1, weather = {} } = config;
  const rotateSpeed = config.rotateSpeed ?? 1.1 * stallSpeedEstimate(spec, flaps);
  const run: TakeoffRun = {
    groundRoll: undefined,
    liftoffSpeed: undefined,
    distanceOver15m: undefined,
  };
  flightTrial(
    spec,
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      // Brakes held until the engine is at full power, as a handbook takeoff is flown.
      state: {
        ...initialAircraftState(),
        rpm: 1,
        gearPosition: 1,
        flapPosition: Number(flaps),
        engines: Object.fromEntries(
          aircraftEngines(spec).map((e) => [
            e.id,
            { rpm: 1, rotorAngle: 0, failed: false, thrust: 0 },
          ]),
        ),
      },
    },
    {
      seconds: 180,
      environment: { groundHeight: () => 0, weather },
      controls: (state) => ({
        ...FLIGHT_TRIAL_INPUT,
        gear: true,
        flaps,
        power,
        pitch:
          state.airspeed >= rotateSpeed
            ? state.grounded
              ? 1
              : unit(0.15 - state.pitchRate * 3)
            : 0,
        roll: state.grounded ? 0 : unit(-state.roll * 2 - state.rollRate * 0.5),
        // Hold the centerline against the propeller's swing.
        yaw: unit(state.yaw * 4 + (state.yawRate ?? 0)),
      }),
      watch: ({ state, transform }) => {
        const along = m.hypot(transform.pos[0], transform.pos[2]);
        if (run.groundRoll === undefined && !state.grounded && transform.pos[1] > 0.3) {
          run.groundRoll = along;
          run.liftoffSpeed = state.equivalentAirspeed ?? state.airspeed;
        }
        if (run.groundRoll !== undefined && transform.pos[1] >= 15.24) {
          run.distanceOver15m = along;
          return true;
        }
        return state.crashed;
      },
    },
  );
  return run;
}

/**
 * Hands off the stick, 10% faster than the trimmed speed, wings held level. A speed-stable
 * airplane noses up and trades speed for height in a slow oscillation (the phugoid), whose
 * period is close to π√2 × speed / g. An airplane that holds its new flight path has none.
 */
export function measurePhugoid(
  spec: AircraftSpec,
  {
    speed,
    altitude = 1000,
    seconds = 180,
    ...config
  }: FlightConfig & { speed: number; altitude?: number; seconds?: number },
): Oscillation & { expectedPeriod: number } {
  const power = levelFlightPower(spec, speed, altitude, config);
  const start = airborneAircraft(spec, { ...config, speed, altitude, power });
  start.state.velocity = [0, 0, speed * 1.1];
  // Read from the airspeed, which swings about the trimmed speed whether or not the airplane
  // is drifting up or down as it goes.
  const speeds: TrialSample[] = [];
  let tick = 0;
  flightTrial(spec, start, {
    seconds,
    environment: { weather: config.weather ?? {} },
    controls: (state) => ({
      ...FLIGHT_TRIAL_INPUT,
      ...controlMode(config),
      power,
      mixture: leanedMixture(spec, altitude, config.weather),
      roll: unit(-state.roll * 2 - state.rollRate * 0.5),
    }),
    watch: ({ state }, elapsed) => {
      if (++tick % 30 === 0) speeds.push([elapsed, state.airspeed]);
      return state.crashed;
    },
  });
  return { ...oscillation(speeds), expectedPeriod: (m.PI * m.sqrt(2) * speed) / G };
}

/** The response of one quantity to a disturbance, controls free. */
export interface FreeResponse extends Oscillation {
  /** Value at the start of the record, and at its end. */
  released: number;
  final: number;
  /** Natural frequency, rad/s, where a period and a damping ratio below 1 were measured. */
  naturalFrequency: number | undefined;
}

/**
 * Trimmed level flight at `speed`, displaced by `start` and let go: hands and feet off unless
 * `hold` says otherwise. `read` picks the quantity recorded, 60 times a second.
 */
function freeResponse(
  spec: AircraftSpec,
  {
    speed,
    altitude = 1000,
    seconds,
    ...config
  }: FlightConfig & { speed: number; altitude?: number; seconds: number },
  start: (pose: FlightTrialPose) => void,
  read: (pose: FlightTrialPose) => number,
  hold: (state: AircraftStateData) => Partial<AircraftInputData> = () => ({}),
  settled?: number,
): FreeResponse {
  const power = levelFlightPower(spec, speed, altitude, config);
  const pose = airborneAircraft(spec, { ...config, speed, altitude, power });
  start(pose);
  const record: TrialSample[] = [];
  let tick = 0;
  let released: number | undefined;
  const end = flightTrial(spec, pose, {
    seconds,
    hz: 120,
    environment: { weather: config.weather ?? {} },
    controls: (state) => ({
      ...FLIGHT_TRIAL_INPUT,
      ...controlMode(config),
      power,
      mixture: leanedMixture(spec, altitude, config.weather),
      ...hold(state),
    }),
    watch: (now, elapsed) => {
      released ??= read(now);
      if (++tick % 2 === 0) record.push([elapsed, read(now)]);
      return now.state.crashed;
    },
  });
  const response = oscillation(record, settled, true);
  const { period, dampingRatio } = response;
  return {
    ...response,
    released: released ?? 0,
    final: read(end),
    naturalFrequency:
      period !== undefined && dampingRatio !== undefined && dampingRatio < 1
        ? m.TAU / (period * m.sqrt(1 - dampingRatio * dampingRatio))
        : undefined,
  };
}

const wingsLevel = (state: AircraftStateData): Partial<AircraftInputData> => ({
  roll: unit(-state.roll * 2 - state.rollRate * 0.5),
});

/** Turn a trimmed pose's nose without turning its flight path: yaw, pitch and bank in radians. */
function displace(pose: FlightTrialPose, yaw: number, pitch: number, bank: number): void {
  pose.transform.rot = vehicleRotation(yaw, -(pose.state.pitch + pitch), bank);
  pose.state.yaw = yaw;
  pose.state.pitch += pitch;
  pose.state.roll = bank;
}

/**
 * Short period: released two degrees nose-high of trim, wings held level. The angle of attack
 * swings back in a second or two; its period and damping are how the airplane answers the
 * stick. A response that runs away instead of returning has no damping to report.
 */
export function measureShortPeriod(
  spec: AircraftSpec,
  config: FlightConfig & { speed: number; altitude?: number },
): FreeResponse {
  const step = (2 * m.PI) / 180;
  const response = freeResponse(
    spec,
    { ...config, seconds: 8 },
    (pose) => displace(pose, 0, step, 0),
    ({ state }) => state.angleOfAttack,
    wingsLevel,
  );
  return m.abs(response.final - response.released) < 2 * step
    ? response
    : { ...response, period: undefined, dampingRatio: undefined, naturalFrequency: undefined };
}

/**
 * Dutch roll: released three degrees out of line with the flight path, hands and feet off. The
 * nose swings from side to side while the wings rock; the sideslip's period and damping
 * describe it.
 */
export function measureDutchRoll(
  spec: AircraftSpec,
  config: FlightConfig & { speed: number; altitude?: number },
): FreeResponse {
  return freeResponse(
    spec,
    { ...config, seconds: 25 },
    (pose) => displace(pose, (3 * m.PI) / 180, 0, 0),
    ({ state }) => state.sideslip ?? 0,
    undefined,
    0,
  );
}

/**
 * Spiral: released in a 10° bank each way in turn, hands and feet off, for `seconds`. The bank
 * at the end against the bank at release says whether the airplane rights itself, holds the
 * turn or winds it up: a bank that has doubled in that time has a time to double of `seconds`.
 * `final` is the mean of the two sides, which takes out a propeller's steady pull to one of
 * them.
 */
export function measureSpiral(
  spec: AircraftSpec,
  {
    seconds = 20,
    ...config
  }: FlightConfig & { speed: number; altitude?: number; seconds?: number },
): FreeResponse {
  const bank = (10 * m.PI) / 180;
  const [right, left] = [bank, -bank].map((side) =>
    freeResponse(
      spec,
      { ...config, seconds },
      (pose) => displace(pose, 0, 0, side),
      ({ state }) => state.roll,
    ),
  );
  if (!right || !left) throw Error('unreachable');
  return { ...right, final: (right.final - left.final) / 2 };
}

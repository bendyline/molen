import type { AircraftInputData, AircraftSpec, WeatherData } from '@bendyline/molen-schema';
import { IDLE_AIRCRAFT_INPUT, initialAircraftState, sampleAtmosphere } from '../aircraft';
import { dmath as m } from '../dmath';
import { type RotorTrim, rotorShaftPower, rotorTrim } from '../helicopter-rotor';
import { vehicleRotation } from '../vehicles';
import { type FlightTrialPose, flightTrial } from './flight';

const ROTOR_INPUT: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, engine: true, brake: false };
const unit = (value: number): number => m.clamp(value, -1, 1);

/** A helicopter in the air with its rotor at speed, moving forward at `speed` m/s. */
export function airborneHelicopter(altitude: number, speed = 0, tilt = 0): FlightTrialPose {
  return {
    transform: { pos: [0, altitude, 0], rot: vehicleRotation(0, tilt, 0) },
    state: {
      ...initialAircraftState(),
      grounded: false,
      pitch: -tilt,
      velocity: [0, 0, speed],
      airspeed: speed,
      rpm: 1,
    },
  };
}

/** Steady flight of a helicopter on its rotor element at an altitude, and what it leaves spare. */
function steady(
  spec: AircraftSpec,
  altitude: number,
  flight: { speed?: number; climb?: number; clearance?: number },
): { trim: RotorTrim; spare: number; flies: boolean } | undefined {
  const density = sampleAtmosphere({}, altitude).densityKgM3;
  const trim = rotorTrim(spec, { density, ...flight });
  if (!trim) return undefined;
  const spare = rotorShaftPower(spec, density) - trim.power;
  // Within what the engines give, what the blades carry and what the lever has.
  return { trim, spare, flies: spare >= 0 && !trim.stalled && trim.lever <= 1 };
}

/**
 * Whether full collective lifts the helicopter from a standing hover at `altitude`: its vertical
 * speed in m/s a second and a half after the lever comes up. `clearance` meters of height above the
 * ground puts it in ground effect; omitted, it hovers in free air. On its rotor element the
 * answer is the power left over the hover, as the rate of climb it would buy (negative where
 * the blades or the lever give out first).
 */
export function hoverMargin(spec: AircraftSpec, altitude: number, clearance?: number): number {
  if (spec.helicopter?.rotor) {
    const hover = steady(spec, altitude, clearance === undefined ? {} : { clearance });
    if (!hover) return 0;
    const climb = hover.spare / (spec.mass * 9.81);
    return hover.flies ? climb : m.min(climb, -0.01);
  }
  const ground = clearance === undefined ? -10000 : altitude - clearance;
  return flightTrial(spec, airborneHelicopter(altitude), {
    seconds: 1.5,
    hz: 30,
    environment: { groundHeight: () => ground },
    controls: () => ({ ...ROTOR_INPUT, power: 1 }),
  }).state.verticalSpeed;
}

/**
 * The highest altitude in meters at which the helicopter can still hover at full power, out of
 * ground effect or (with `clearance`, the height of the skids above the ground) in it.
 */
export function hoverCeiling(spec: AircraftSpec, clearance?: number, limit = 9000): number {
  const hovers = (altitude: number): boolean => hoverMargin(spec, altitude, clearance) > 0;
  if (!hovers(0)) return 0;
  if (hovers(limit)) return limit;
  let lo = 0;
  let hi = limit;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (hovers(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface RotorFlight {
  /** True airspeed and vertical speed in m/s, averaged over the last five seconds. */
  speed: number;
  verticalSpeed: number;
  /** Rotor speed as a fraction of its governed speed. */
  rpm: number;
  /** Collective at the end, 0–1. */
  power: number;
  /** Whether the retreating blade was past its stall margin at the end. */
  overspeed: boolean;
}

function settle(
  spec: AircraftSpec,
  start: FlightTrialPose,
  seconds: number,
  controls: Parameters<typeof flightTrial>[2]['controls'],
): RotorFlight {
  let speed = 0;
  let verticalSpeed = 0;
  let count = 0;
  let power = 0;
  const end = flightTrial(spec, start, {
    seconds,
    controls: (state, elapsed, transform) => {
      const input = controls(state, elapsed, transform);
      power = input.power;
      return input;
    },
    watch: ({ state }, elapsed) => {
      if (elapsed > seconds - 5) {
        speed += state.airspeed;
        verticalSpeed += state.verticalSpeed;
        count++;
      }
      return state.crashed;
    },
  });
  return {
    speed: speed / m.max(1, count),
    verticalSpeed: verticalSpeed / m.max(1, count),
    rpm: end.state.rpm,
    power,
    overspeed: end.state.overspeed ?? false,
  };
}

/** The steepest steady climb (or shallowest descent) the helicopter flies at a forward speed. */
function steadyClimb(spec: AircraftSpec, speed: number, altitude: number): RotorFlight {
  let low = -60;
  let high = 60;
  let best: RotorTrim | undefined;
  for (let i = 0; i < 24; i++) {
    const climb = (low + high) / 2;
    const flight = steady(spec, altitude, { speed, climb });
    if (flight?.flies) {
      low = climb;
      best = flight.trim;
    } else high = climb;
  }
  return {
    speed: m.hypot(speed, low),
    verticalSpeed: low,
    rpm: 1,
    power: best ? m.clamp(best.lever, 0, 1) : 1,
    overspeed: best?.stalled ?? true,
  };
}

/** Full collective at a held forward speed (m/s): the climb the helicopter makes there. */
export function rotorClimb(spec: AircraftSpec, speed: number, altitude = 0): RotorFlight {
  if (spec.helicopter?.rotor) return steadyClimb(spec, speed, altitude);
  return settle(spec, airborneHelicopter(altitude + 300, speed), 45, (state) => ({
    ...ROTOR_INPUT,
    power: 1,
    // Nose down to gain speed, up to lose it.
    pitch: unit((state.airspeed - speed) * 0.06 - 0.15),
  }));
}

/** The best full-power climb over forward speeds from 15 to 50 m/s. */
export function bestRotorClimb(spec: AircraftSpec, altitude = 0): RotorFlight | undefined {
  let best: RotorFlight | undefined;
  for (let speed = 15; speed <= 50; speed += 5) {
    const climb = rotorClimb(spec, speed, altitude);
    if (!best || climb.verticalSpeed > best.verticalSpeed) best = climb;
  }
  return best;
}

/**
 * Level flight with the cyclic held at `tilt` of full forward travel and the collective holding
 * the altitude. `held` is false when the collective ran out and the helicopter descended.
 */
export function rotorLevel(
  spec: AircraftSpec,
  tilt: number,
  altitude = 300,
): RotorFlight & { held: boolean } {
  let lowest = altitude;
  const flight = settle(
    spec,
    airborneHelicopter(altitude, 20),
    150,
    (state, _elapsed, transform) => {
      lowest = m.min(lowest, transform.pos[1]);
      return {
        ...ROTOR_INPUT,
        pitch: -tilt,
        power: m.clamp(
          0.5 + (altitude - transform.pos[1]) * 0.02 - state.verticalSpeed * 0.1,
          0,
          1,
        ),
      };
    },
  );
  return { ...flight, held: lowest > altitude - 30 && m.abs(flight.verticalSpeed) < 0.5 };
}

/** The fastest level flight the collective can hold, over cyclic positions; m/s true airspeed. */
export function rotorTopSpeed(spec: AircraftSpec, altitude = 300): RotorFlight | undefined {
  if (spec.helicopter?.rotor) {
    // The fastest speed at which level flight is within the power and the blades.
    let fastest: number | undefined;
    for (let speed = 20; speed <= 130; speed += 2)
      if (steady(spec, altitude, { speed })?.flies) fastest = speed;
    if (fastest === undefined) return undefined;
    let low = fastest;
    let high = fastest + 2;
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      if (steady(spec, altitude, { speed: mid })?.flies) low = mid;
      else high = mid;
    }
    const trim = steady(spec, altitude, { speed: low })?.trim;
    return {
      speed: low,
      verticalSpeed: 0,
      rpm: 1,
      power: trim ? m.clamp(trim.lever, 0, 1) : 1,
      overspeed: trim?.stalled ?? false,
    };
  }
  let best: RotorFlight | undefined;
  for (let tilt = 0.2; tilt <= 1.0001; tilt += 0.1) {
    const flight = rotorLevel(spec, tilt, altitude);
    if (flight.held && (!best || flight.speed > best.speed)) best = flight;
  }
  return best;
}

/**
 * Engine out, holding `speed` m/s with the cyclic and the rotor speed with the collective, as a
 * pilot does: lever down while the rotor is slow, eased up as it comes into its range. The
 * steady descent is then the one the handbook quotes; with the lever left on the floor the
 * helicopter comes down faster than it needs to.
 */
export function rotorAutorotation(spec: AircraftSpec, speed: number, altitude = 1500): RotorFlight {
  if (spec.helicopter?.rotor) {
    // The descent at which the air through the disc turns the rotors by itself.
    const density = sampleAtmosphere({}, altitude).densityKgM3;
    let low = -40;
    let high = 0;
    for (let i = 0; i < 24; i++) {
      const climb = (low + high) / 2;
      const trim = rotorTrim(spec, { density, speed, climb });
      if (trim && trim.power <= 0) low = climb;
      else high = climb;
    }
    const trim = rotorTrim(spec, { density, speed, climb: low });
    return {
      speed: m.hypot(speed, low),
      verticalSpeed: low,
      rpm: 1,
      power: trim ? m.clamp(trim.lever, 0, 1) : 0,
      overspeed: trim?.stalled ?? false,
    };
  }
  return settle(spec, airborneHelicopter(altitude, speed), 40, (state) => ({
    ...ROTOR_INPUT,
    engine: false,
    power: m.clamp((state.rpm - 0.94) * 12, 0, 1),
    pitch: unit((state.airspeed - speed) * 0.06 - 0.1),
  }));
}

/**
 * The disc tilt in radians at which a helicopter's rotor balances its drag in level flight at
 * `speed` m/s: the attitude it cruises at.
 */
export function rotorCruiseTilt(spec: AircraftSpec, speed: number, altitude = 0): number {
  const h = spec.helicopter;
  if (!h) return 0;
  if (h.rotor)
    return (
      rotorTrim(spec, { density: sampleAtmosphere({}, altitude).densityKgM3, speed })?.tilt ?? 0
    );
  const sigma = sampleAtmosphere({}, altitude).densityKgM3 / 1.225;
  const drag = speed * (h.horizontalDrag + speed * h.quadraticDrag) * sigma;
  return m.atan(drag / (spec.mass * 9.81));
}

/**
 * The rotorcraft cruise experiment: a fixed disc tilt (12° unless `tilt` is given, in radians)
 * with the collective holding the altitude, started at `speed` m/s. Reports where the airspeed
 * went and how well the altitude was held; it is not a maximum-speed measurement.
 */
export function flyRotorLevel(
  spec: AircraftSpec,
  {
    speed,
    altitude,
    seconds = 60,
    hz = 30,
    weather = {},
    tilt = (12 * m.PI) / 180,
  }: {
    speed: number;
    altitude: number;
    seconds?: number;
    hz?: number;
    weather?: WeatherData;
    tilt?: number;
  },
): FlightTrialPose & { maxAltitudeError: number; trimPower: number } {
  const h = spec.helicopter;
  const engine = spec.engine;
  if (!h || !engine) throw new Error('Rotor cruise requires a helicopter');
  const sigma = sampleAtmosphere(weather, altitude).densityKgM3 / 1.225;
  const translational = 1 + h.translationalLift * m.min(speed / h.translationalLiftSpeed, 1);
  const rpmAt = (power: number): number =>
    h.powerLimitedRotor ? 1 : engine.idleRpm + power * (1 - engine.idleRpm);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const p = (lo + hi) / 2;
    if (p * rpmAt(p) ** 2 * h.liftMultiplier * translational * sigma * m.cos(tilt) > 1) hi = p;
    else lo = p;
  }
  // On its rotor element the lever is where steady flight at this speed puts it.
  const steadyLever = h.rotor
    ? rotorTrim(spec, { density: sampleAtmosphere(weather, altitude).densityKgM3, speed })?.lever
    : undefined;
  const trimPower = steadyLever === undefined ? (lo + hi) / 2 : m.clamp(steadyLever, 0, 1);
  let maxAltitudeError = 0;
  const end = flightTrial(
    spec,
    {
      transform: { pos: [0, altitude, 0], rot: vehicleRotation(0, tilt, 0) },
      state: {
        ...initialAircraftState(),
        grounded: false,
        pitch: -tilt,
        velocity: [0, 0, speed],
        rpm: rpmAt(trimPower),
      },
    },
    {
      seconds,
      hz,
      environment: { weather },
      controls: (state, _elapsed, transform) => ({
        ...ROTOR_INPUT,
        power: m.max(
          0,
          m.min(1, trimPower + (altitude - transform.pos[1]) * 0.003 - state.verticalSpeed * 0.04),
        ),
        pitch: -tilt / h.cyclicTilt,
      }),
      watch: ({ transform, state }) => {
        maxAltitudeError = m.max(maxAltitudeError, m.abs(transform.pos[1] - altitude));
        if (state.crashed) throw new Error(`${spec.label}: invalid rotor flight state`);
        return false;
      },
    },
  );
  return { transform: end.transform, state: end.state, maxAltitudeError, trimPower };
}

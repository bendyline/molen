/** Headless flight experiments. Uses the production kernel; no DOM, renderer or wall clock. */
import {
  aircraftDragCoefficient,
  aircraftEngines,
  aircraftEngineThrust,
  engineThrottle,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  levelFlightAngleOfAttack,
  sampleAtmosphere,
  stepAircraft,
} from '@bendyline/molen-kernel/aircraft';
import { vehicleRotation } from '@bendyline/molen-kernel/vehicles';

export function trimPoint(
  spec,
  speed,
  altitude,
  { power = 1, gear = false, flaps = 0, weather = {} } = {},
) {
  const atmosphere = sampleAtmosphere(weather, altitude);
  const wing = spec.airplane;
  if (!wing) throw Error('Steady wing trim requires an airplane');
  const qS = 0.5 * atmosphere.densityKgM3 * speed ** 2 * wing.wingArea;
  const bank = aircraftEngines(spec);
  const thrustAt = (alpha) =>
    bank.reduce(
      (sum, engine) =>
        sum + aircraftEngineThrust(engine, wing, atmosphere, speed * Math.cos(alpha), power),
      0,
    );
  const liftAt = (alpha) =>
    qS * ((alpha + wing.camberAngle) * wing.liftSlope + Number(flaps) * wing.flapLift);
  let lo = -wing.stallAngle - wing.camberAngle,
    hi = wing.stallAngle - wing.camberAngle;
  if (liftAt(hi) + thrustAt(hi) * Math.sin(hi) < spec.mass * 9.81) return null;
  for (let i = 0; i < 45; i++) {
    const alpha = (lo + hi) / 2;
    if (liftAt(alpha) + thrustAt(alpha) * Math.sin(alpha) > spec.mass * 9.81) hi = alpha;
    else lo = alpha;
  }
  const alpha = (lo + hi) / 2,
    thrust = thrustAt(alpha),
    mach = speed / atmosphere.speedOfSound;
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
    equivalentAirspeed: speed * Math.sqrt(atmosphere.densityKgM3 / 1.225),
    excessThrust: thrust * Math.cos(alpha) - drag,
    specificExcessPower: ((thrust * Math.cos(alpha) - drag) * speed) / (spec.mass * 9.81),
  };
}

/** All stable thrust/drag intersections, including separate subsonic/supersonic branches. */
export function levelSpeedRoots(spec, altitude, config = {}) {
  const roots = [];
  let previous = null;
  for (let speed = 5; speed <= 1100; speed += 2) {
    const at = trimPoint(spec, speed, altitude, config);
    if (at && previous && previous.excessThrust >= 0 && at.excessThrust < 0) {
      let lo = previous.speed,
        hi = speed;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (trimPoint(spec, mid, altitude, config).excessThrust >= 0) lo = mid;
        else hi = mid;
      }
      roots.push(trimPoint(spec, (lo + hi) / 2, altitude, config));
    }
    previous = at;
  }
  return roots;
}

/** Six-DOF level-flight controller used only by experiments, not a replacement physics solver. */
export function flyLevel(
  spec,
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
  },
) {
  const atmosphere = sampleAtmosphere(weather, altitude);
  const alpha =
    trimPoint(spec, speed, altitude, { power, gear, flaps, weather })?.alpha ??
    levelFlightAngleOfAttack(spec, speed, atmosphere.densityKgM3, flaps);
  let transform = { pos: [0, altitude, 0], rot: vehicleRotation(0, -alpha, 0) };
  let state = {
    ...initialAircraftState(),
    grounded: false,
    pitch: alpha,
    pitchTrim: alpha,
    velocity: [wind[0], wind[1], speed + wind[2]],
    rpm: 1,
    gearPosition: Number(gear),
    flapPosition: Number(flaps),
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
  };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  let maxAltitudeError = 0;
  for (let tick = 0; tick < seconds * hz; tick++) {
    const input = {
      ...IDLE_AIRCRAFT_INPUT,
      engine: true,
      brake: false,
      power,
      gear,
      flaps,
      pitch: clamp(
        (altitude - transform.pos[1]) * 0.002 - state.verticalSpeed * 0.06 - state.pitchRate * 0.8,
      ),
      roll: clamp(-state.roll * 2 - state.rollRate * 0.5),
      yaw: clamp((state.sideslip ?? 0) * 3 + (state.yawRate ?? 0) * 0.5),
    };
    ({ transform, state } = stepAircraft(transform, state, input, spec, 1 / hz, {
      groundHeight: () => -10000,
      weather,
      wind,
      time: tick / hz,
    }));
    maxAltitudeError = Math.max(maxAltitudeError, Math.abs(transform.pos[1] - altitude));
    if (!state.velocity.every(Number.isFinite) || state.crashed)
      throw Error(`${spec.label}: invalid flight state`);
  }
  return { transform, state, maxAltitudeError };
}

/** Rotorcraft cruise experiment at fixed 12 degree disc tilt with a collective altitude hold. */
export function flyRotorLevel(spec, { speed, altitude, seconds = 60, hz = 30, weather = {} }) {
  const h = spec.helicopter,
    tilt = (12 * Math.PI) / 180;
  const sigma = sampleAtmosphere(weather, altitude).densityKgM3 / 1.225;
  const translational = 1 + h.translationalLift * Math.min(speed / h.translationalLiftSpeed, 1);
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 40; i++) {
    const p = (lo + hi) / 2,
      rpm = h.powerLimitedRotor ? 1 : spec.engine.idleRpm + p * (1 - spec.engine.idleRpm);
    if (p * rpm ** 2 * h.liftMultiplier * translational * sigma * Math.cos(tilt) > 1) hi = p;
    else lo = p;
  }
  const trimPower = (lo + hi) / 2;
  let transform = { pos: [0, altitude, 0], rot: vehicleRotation(0, tilt, 0) };
  let state = {
    ...initialAircraftState(),
    grounded: false,
    pitch: -tilt,
    velocity: [0, 0, speed],
    rpm: h.powerLimitedRotor ? 1 : spec.engine.idleRpm + trimPower * (1 - spec.engine.idleRpm),
  };
  let maxAltitudeError = 0;
  for (let tick = 0; tick < seconds * hz; tick++) {
    const power = Math.max(
      0,
      Math.min(1, trimPower + (altitude - transform.pos[1]) * 0.003 - state.verticalSpeed * 0.04),
    );
    ({ transform, state } = stepAircraft(
      transform,
      state,
      { ...IDLE_AIRCRAFT_INPUT, engine: true, brake: false, power, pitch: -tilt / h.cyclicTilt },
      spec,
      1 / hz,
      { groundHeight: () => -10000, weather, wind: [0, 0, 0], time: tick / hz },
    ));
    maxAltitudeError = Math.max(maxAltitudeError, Math.abs(transform.pos[1] - altitude));
    if (!state.velocity.every(Number.isFinite) || state.crashed)
      throw Error(`${spec.label}: invalid rotor flight state`);
  }
  return { transform, state, maxAltitudeError, trimPower };
}

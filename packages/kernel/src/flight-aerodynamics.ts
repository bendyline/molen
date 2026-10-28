import type { AircraftEngineSpec, AirplanePhysicsSpec } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import type { AtmosphereSample } from './weather';

/** Reheat is the last part of the throttle lever; legacy/ordinary engines have no detent. */
export function engineThrottle(
  engine: AircraftEngineSpec,
  throttle: number,
): { dry: number; afterburner: number } {
  const power = m.clamp(throttle, 0, 1);
  const detent = engine.afterburnerThrust ? (engine.afterburnerDetent ?? 0.85) : 1;
  return {
    dry: m.min(1, power / detent),
    afterburner: m.max(0, (power - detent) / (1 - detent || 1)),
  };
}

function engineLapse(engine: AircraftEngineSpec, atmosphere: AtmosphereSample): number {
  const sigma = atmosphere.densityKgM3 / 1.225;
  if (sigma <= 0 && engine.propulsion !== undefined) return 0;
  let lapse =
    engine.propulsion === undefined
      ? 1
      : m.pow(m.min(1, sigma / (engine.ratedDensityRatio ?? 1)), engine.densityExponent ?? 1);
  // A continuous second density slope represents the loss of installed engine margin aloft.
  // It prevents a low-altitude fit from implying unlimited thin-air acceleration.
  if (engine.highAltitudeDensityRatio && sigma < engine.highAltitudeDensityRatio) {
    const knee = engine.highAltitudeDensityRatio;
    lapse =
      m.pow(m.min(1, knee / (engine.ratedDensityRatio ?? 1)), engine.densityExponent ?? 1) *
      m.pow(sigma / knee, engine.highAltitudeExponent ?? engine.densityExponent ?? 1);
  }
  return lapse;
}

/** Reduced fuel/air model: lean cutoff, best-power mixture, then excess-fuel power loss.
 * The density knee also approximates boosted intake air. This is not a carburetor/EGT model.
 */
export function aircraftMixtureEfficiency(
  engine: AircraftEngineSpec,
  atmosphere: AtmosphereSample,
  mixture = 1,
): number {
  if (!engine.mixtureControl || engine.propulsion === 'jet') return 1;
  const fuel = m.clamp(mixture, 0, 1);
  if (fuel <= 0.02) return 0;
  const air = m.clamp(atmosphere.densityKgM3 / 1.225 / (engine.ratedDensityRatio ?? 1), 0.01, 1);
  const ratio = fuel / m.pow(air, 0.75);
  return ratio <= 1
    ? m.smoothstep(m.clamp((ratio - 0.25) / 0.75, 0, 1))
    : 1 / (1 + 1.5 * (ratio - 1) ** 2);
}

function selectedPropellerRpm(engine: AircraftEngineSpec, propeller = 1): number {
  const governor = engine.propulsion === 'jet' ? undefined : engine.propellerControl;
  return governor ? governor.minRpm + (1 - governor.minRpm) * m.clamp(propeller, 0, 1) : 1;
}

/** Low power reaches the fine-pitch stop; otherwise the governor holds the selected RPM. */
export function aircraftEngineRpm(
  engine: AircraftEngineSpec,
  throttle: number,
  combustion = 1,
  propeller = 1,
): number {
  if (combustion <= 0) return 0;
  const power = m.clamp(throttle, 0, 1) * combustion;
  const free =
    engine.idleRpm +
    (1 - engine.idleRpm) *
      (engine.propellerControl && engine.propulsion !== 'jet' ? m.pow(power, 1 / 3) : power);
  return m.min(free, selectedPropellerRpm(engine, propeller));
}

/** Torque-limited shaft model; lower governed RPM reduces available shaft power. */
export function aircraftEngineShaftPower(
  engine: AircraftEngineSpec,
  atmosphere: AtmosphereSample,
  throttle = 1,
  mixture = 1,
  propeller = 1,
): number {
  if (engine.propulsion === 'jet') return 0;
  return (
    engine.power *
    engineLapse(engine, atmosphere) *
    m.clamp(throttle, 0, 1) *
    aircraftMixtureEfficiency(engine, atmosphere, mixture) *
    selectedPropellerRpm(engine, propeller)
  );
}

/** Installed propulsion approximation; full spool. No velocity cap or aircraft-name switches. */
export function aircraftEngineThrust(
  engine: AircraftEngineSpec,
  wing: AirplanePhysicsSpec,
  atmosphere: AtmosphereSample,
  speed: number,
  throttle = 1,
  afterburner: number = engineThrottle(engine, throttle).afterburner,
  mixture = 1,
  propeller = 1,
): number {
  const sigma = atmosphere.densityKgM3 / 1.225;
  const control = engineThrottle(engine, throttle);
  if (engine.propulsion === 'jet') {
    const dry = engine.dryThrust ?? 0;
    const reheat = m.max(0, (engine.afterburnerThrust ?? dry) - dry) * m.clamp(afterburner, 0, 1);
    const mach = m.max(0, speed) / atmosphere.speedOfSound;
    return (
      (dry * control.dry + reheat) *
      engineLapse(engine, atmosphere) *
      (1 + (engine.ramRise ?? 0) * mach * mach)
    );
  }
  return (
    m.min(
      (engine.maxThrust ?? wing.maxThrust) *
        (engine.propulsion ? m.sqrt(m.max(0, sigma)) : 1) *
        selectedPropellerRpm(engine, propeller) ** 2,
      (engine.power *
        engineLapse(engine, atmosphere) *
        (engine.propellerEfficiency ?? wing.propellerEfficiency) *
        selectedPropellerRpm(engine, propeller)) /
        m.max(engine.minPropellerSpeed ?? wing.minPropellerSpeed, speed),
    ) *
    m.clamp(throttle, 0, 1) *
    aircraftMixtureEfficiency(engine, atmosphere, mixture)
  );
}

/** Continuous transonic drag rise. It persists supersonically instead of vanishing past Mach 1. */
export function waveDragCoefficient(wing: AirplanePhysicsSpec, mach: number): number {
  if (wing.criticalMach === undefined) return 0;
  const rise = m.max(0, (mach - wing.criticalMach) / 0.25);
  return (wing.waveDrag ?? 0) * m.min(rise * rise, 1 + 0.12 * m.max(0, rise - 1));
}

/** Shared polar for both the flight solver and steady-performance experiments. */
export function aircraftDragCoefficient(
  wing: AirplanePhysicsSpec,
  cl: number,
  mach: number,
  gear: number,
  flaps: number,
  separation = 0,
  alpha = 0,
  heightOverSpan = 100,
): number {
  const ground = wing.groundEffect ? m.clamp(16 * heightOverSpan, 0, 100) : 100;
  const inducedScale = (ground * ground) / (1 + ground * ground);
  return (
    wing.profileDrag +
    cl * cl * wing.inducedDrag * inducedScale +
    gear * wing.gearDrag +
    flaps * wing.flapDrag +
    separation * wing.stallDrag * m.sin(alpha) ** 2 +
    waveDragCoefficient(wing, mach)
  );
}

/** High-alpha loss/reversal of stability. Symmetric unperturbed flight has no invented yaw. */
export function aircraftDeparture(
  wing: AirplanePhysicsSpec,
  alpha: number,
  grounded: boolean,
): number {
  const d = wing.departure;
  return d && !grounded
    ? m.smoothstep((m.abs(alpha) - d.onsetAngle) / (d.fullAngle - d.onsetAngle))
    : 0;
}

type Triple = [number, number, number];
/** Implicit midpoint Euler top. Preserves torque-free energy instead of amplifying fast spins. */
export function freeRotationRates(omega: Triple, inertia: Triple, dt: number): Triple {
  const [ix, iy, iz] = inertia;
  const a: Triple = [(iy - iz) / ix, (iz - ix) / iy, (ix - iy) / iz];
  let next: Triple = [...omega];
  const det = (u: Triple, v: Triple, w: Triple): number =>
    u[0] * (v[1] * w[2] - v[2] * w[1]) -
    u[1] * (v[0] * w[2] - v[2] * w[0]) +
    u[2] * (v[0] * w[1] - v[1] * w[0]);
  // Newton solves the three coupled midpoint equations, rather than using explicit gyroscopic acceleration.
  for (let n = 0; n < 8; n++) {
    const mid: Triple = [
      (omega[0] + next[0]) / 2,
      (omega[1] + next[1]) / 2,
      (omega[2] + next[2]) / 2,
    ];
    const residual: Triple = [
      next[0] - omega[0] - dt * a[0] * mid[1] * mid[2],
      next[1] - omega[1] - dt * a[1] * mid[2] * mid[0],
      next[2] - omega[2] - dt * a[2] * mid[0] * mid[1],
    ];
    const c0: Triple = [1, (-dt * a[1] * mid[2]) / 2, (-dt * a[2] * mid[1]) / 2];
    const c1: Triple = [(-dt * a[0] * mid[2]) / 2, 1, (-dt * a[2] * mid[0]) / 2];
    const c2: Triple = [(-dt * a[0] * mid[1]) / 2, (-dt * a[1] * mid[0]) / 2, 1];
    const determinant = det(c0, c1, c2);
    const change: Triple = [
      det(residual, c1, c2) / determinant,
      det(c0, residual, c2) / determinant,
      det(c0, c1, residual) / determinant,
    ];
    next = [next[0] - change[0], next[1] - change[1], next[2] - change[2]];
    if (m.max(m.abs(change[0]), m.max(m.abs(change[1]), m.abs(change[2]))) < 1e-12) break;
  }
  return next;
}

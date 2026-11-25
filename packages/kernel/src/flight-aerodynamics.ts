import type {
  AircraftEngineSpec,
  AircraftEngineStateData,
  AirplanePhysicsSpec,
} from '@bendyline/molen-schema';
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

/**
 * The mixture lever position that gives best power in this air: full rich at the density the
 * engine is rated for, leaner as the air thins. What a pilot leans to in a climb or cruise.
 */
export function bestPowerMixture(engine: AircraftEngineSpec, atmosphere: AtmosphereSample): number {
  if (!engine.mixtureControl || engine.propulsion === 'jet') return 1;
  const air = m.clamp(atmosphere.densityKgM3 / 1.225 / (engine.ratedDensityRatio ?? 1), 0.01, 1);
  return m.pow(air, 0.75);
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

/**
 * Thrust in newtons that `power` watts of thrust power gives at an airspeed, by actuator-disc
 * (momentum) theory: the disc speeds the air through it up, and the faster the air already
 * arrives the less of the power is lost in the slipstream. At rest it is finite,
 * power^(2/3) × (2 × density × area)^(1/3); at speed it approaches power / speed.
 */
export function propellerThrust(
  power: number,
  speed: number,
  density: number,
  diameter: number,
): number {
  if (power <= 0 || density <= 0 || diameter <= 0) return 0;
  const flow = (density * m.PI * diameter * diameter) / 2;
  const arriving = m.max(0, speed);
  // Speed of the air through the disc, w: power = flow × w² × (w − arriving). Newton's method
  // from above the root, where the cubic is convex, converges without overshoot.
  let through = arriving + m.pow(power / flow, 1 / 3);
  for (let i = 0; i < 6; i++) {
    const residual = flow * through * through * (through - arriving) - power;
    through -= residual / (flow * through * (3 * through - 2 * arriving));
  }
  return power / through;
}

/**
 * Share of static thrust a turbofan keeps at a Mach number: the fan's large, slow jet loses
 * thrust quickly as the airplane's own speed approaches it, faster for a higher bypass ratio
 * (Torenbeek's takeoff-thrust lapse). Held at its lowest value beyond the fit's range.
 */
export function turbofanLapse(bypassRatio: number, mach: number): number {
  const linear = (0.377 * (1 + bypassRatio)) / m.sqrt(1 + 0.82 * bypassRatio);
  const curve = 0.23 + 0.19 * m.sqrt(bypassRatio);
  const at = m.clamp(mach, 0, linear / (2 * curve));
  return 1 - linear * at + curve * at * at;
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
      (engine.bypassRatio === undefined
        ? 1 + (engine.ramRise ?? 0) * mach * mach
        : turbofanLapse(engine.bypassRatio, mach))
    );
  }
  const rpm = selectedPropellerRpm(engine, propeller);
  const cap =
    (engine.maxThrust ?? wing.maxThrust) *
    (engine.propulsion ? m.sqrt(m.max(0, sigma)) : 1) *
    rpm ** 2;
  const thrustPower =
    engine.power *
    engineLapse(engine, atmosphere) *
    (engine.propellerEfficiency ?? wing.propellerEfficiency) *
    rpm;
  const lever = m.clamp(throttle, 0, 1) * aircraftMixtureEfficiency(engine, atmosphere, mixture);
  const diameter = engine.propellerDiameter;
  if (diameter === undefined)
    return (
      m.min(cap, thrustPower / m.max(engine.minPropellerSpeed ?? wing.minPropellerSpeed, speed)) *
      lever
    );
  // Blades set or governed for cruise work badly when slow, and a fixed-pitch propeller also
  // holds the engine below its rated speed: less thrust power in the takeoff and climb.
  const slow = engine.lowSpeedThrust;
  const reached = slow
    ? slow.atRest + (1 - slow.atRest) * m.clamp(m.max(0, speed) / slow.fullSpeed, 0, 1)
    : 1;
  const thrust = m.min(
    cap,
    propellerThrust(thrustPower * lever * reached, speed, atmosphere.densityKgM3, diameter),
  );
  // With the throttle closed the airflow drives the propeller instead: a brake.
  const windmill =
    (engine.windmillDrag ?? 0) *
    0.5 *
    atmosphere.densityKgM3 *
    m.max(0, speed) ** 2 *
    ((m.PI * diameter * diameter) / 4) *
    m.max(0, 1 - 4 * lever);
  return thrust - windmill;
}

/**
 * Fuel burned by a running engine in kg/s. A jet burns by its thrust, several times more with
 * the afterburner lit; a propeller or rotor engine by the shaft power it delivers (`load` scales
 * that for a governed rotor at part collective). Neither goes below an idle flow.
 */
export function aircraftFuelFlow(
  engine: AircraftEngineSpec,
  state: AircraftEngineStateData,
  load = 1,
): number {
  if (engine.propulsion === 'jet') {
    const dry = engine.fuelConsumption ?? 2e-5;
    const reheat = engine.afterburnerFuelConsumption ?? 5.4e-5;
    return (
      m.max(state.thrust, 0.05 * (engine.dryThrust ?? 0)) *
      (dry + (reheat - dry) * (state.afterburner ?? 0))
    );
  }
  return (
    m.max((state.shaftPower ?? 0) * load, 0.06 * engine.power) *
    (engine.fuelConsumption ?? (engine.mixtureControl ? 7.5e-8 : 9.5e-8))
  );
}

/**
 * Lift coefficient of the wing at an angle of attack measured from zero lift (radians), with
 * how far its flow has separated (0 attached, 1 fully stalled). `flaps` is the flap position.
 */
export function wingLiftCoefficient(
  airplane: AirplanePhysicsSpec,
  alpha: number,
  flaps: number,
): { cl: number; separation: number } {
  const excess = m.max(0, m.abs(alpha) - airplane.stallAngle);
  const blend = m.clamp(excess / (airplane.stallTransitionAngle ?? 0.12), 0, 1);
  const separation = blend * blend * (3 - 2 * blend);
  const flapLift = flaps * airplane.flapLift;
  const attached =
    m.clamp(alpha, -airplane.stallAngle, airplane.stallAngle) * airplane.liftSlope + flapLift;
  // Separated flow loses lift progressively and has no broadside lifting force.
  const separated =
    m.sign(alpha) *
      m.max(
        airplane.postStallLift,
        airplane.stallAngle * airplane.liftSlope - excess * airplane.postStallDecay,
      ) *
      m.cos(alpha) +
    flapLift * airplane.postStallFlapEffect * m.cos(alpha);
  return { cl: attached + (separated - attached) * separation, separation };
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

export { freeRotationRates } from './dynamics/rigid-body';

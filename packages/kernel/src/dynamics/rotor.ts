import { dmath as m } from '../dmath';

/**
 * A rotor as one element: blades of a known area turning at a known speed, set to a pitch. Its
 * thrust comes from the blades' angle to the air they meet (blade-element theory), the air it
 * pulls through itself from that thrust (momentum theory), and its power from both, with the
 * blades' own drag. Its disc tilts back from the air it flies into and lags the shaft it turns
 * on, which is what damps a helicopter and gives it speed stability. Pure functions over plain
 * numbers; a main rotor and a tail rotor are the same thing at different sizes.
 */

export interface RotorBlades {
  radius: number;
  /** Blade area over disc area: number of blades × chord / (π × radius). */
  solidity: number;
  /** Tip speed at full rotor speed, m/s. */
  tipSpeed: number;
  /** Lift-curve slope of the blade section, per rad. */
  liftSlope: number;
  /** Profile drag coefficient of the blades at no lift. */
  drag: number;
  /** Induced power over the ideal: non-uniform inflow, tip loss, swirl. */
  inducedFactor: number;
  /** Mean blade lift coefficient at which the blades stall in a hover. */
  maxLift: number;
}

export interface RotorFlow {
  /** Air density, kg/m³. */
  density: number;
  /** Rotor speed as a share of full speed. */
  speed: number;
  /** Blade pitch at three quarters of the radius, rad. */
  pitch: number;
  /** The hub's speed through the air along the thrust axis (climbing positive), m/s. */
  axial: number;
  /** The hub's speed through the air across the disc, m/s. */
  edgewise: number;
  /** Induced velocity through the disc now, m/s (the rotor's inflow state). */
  inflow: number;
}

export interface RotorLoads {
  /** Thrust along the disc's axis, N. */
  thrust: number;
  /** Shaft power the rotor takes, W: negative when the air is driving it. */
  power: number;
  /** In-plane drag of the disc against its edgewise motion, N. */
  drag: number;
  /** Induced velocity the thrust settles to, m/s. */
  inflowTarget: number;
  /** Mean lift coefficient of the blades, and 0–1 how far they are into the stall. */
  bladeLift: number;
  stall: number;
  /** Edgewise speed over tip speed. */
  advance: number;
  /** Flow through the disc over tip speed (down through it positive). */
  inflowRatio: number;
}

/**
 * Induced velocity over its hover value, for a rotor moving along its axis at `x` times that
 * value (climbing positive) and across it at `across` times. Climbing and in fast flight this is
 * momentum theory; in a slow descent the rotor is in its own wake, where momentum theory has no
 * answer and the measured curve stands in (Leishman, Principles of Helicopter Aerodynamics,
 * eq. 2.96); below twice the hover value it is a windmill.
 */
export function inducedVelocityRatio(x: number, across: number): number {
  // Glauert's flow model, by iteration: v = 1 / sqrt(across² + (x + v)²). In a descent straight
  // down its own wake that has no answer (the flow through the disc comes to nothing): the
  // iteration is kept finite there, and the measured curve below is what is used.
  let glauert = 1;
  for (let i = 0; i < 12; i++)
    glauert =
      0.5 *
      (glauert +
        m.min(4, 1 / m.sqrt(m.max(1e-6, across * across + (x + glauert) * (x + glauert)))));
  if (x >= 0) return glauert;
  const axialOnly =
    x >= -2
      ? 1 + x * (-1.125 + x * (-1.372 + x * (-1.718 + x * -0.655)))
      : -x / 2 - m.sqrt(m.max(0, (x * x) / 4 - 1));
  // Edgewise flow sweeps the wake away: by about twice the hover value across, momentum
  // theory holds again.
  const swept = m.smoothstep(across / 2);
  return axialOnly + (glauert - axialOnly) * swept;
}

/** Thrust, power and in-plane drag of a rotor in the flow it has now. */
export function rotorLoads(blades: RotorBlades, flow: RotorFlow): RotorLoads {
  const tip = blades.tipSpeed * flow.speed;
  const area = m.PI * blades.radius * blades.radius;
  if (!(tip > 1))
    return {
      thrust: 0,
      power: 0,
      drag: 0,
      inflowTarget: 0,
      bladeLift: 0,
      stall: 0,
      advance: 0,
      inflowRatio: 0,
    };
  const advance = flow.edgewise / tip;
  const inflowRatio = (flow.axial + flow.inflow) / tip;
  const scale = flow.density * area * tip * tip;
  // Blade-element thrust with uniform inflow.
  const slope = (blades.solidity * blades.liftSlope) / 2;
  const linear = slope * ((flow.pitch / 3) * (1 + 1.5 * advance * advance) - inflowRatio / 2);
  // The blades stall at a mean lift coefficient that falls as the retreating side slows down.
  const limit = ((blades.solidity * blades.maxLift) / 6) * m.max(0.35, 1 - 1.8 * advance * advance);
  const ratio = m.abs(linear) / limit;
  const stall = m.smoothstep((ratio - 0.8) / 0.5);
  // Up to four fifths of that the blades are in their linear range; past it the lift rounds
  // off and a little is lost as the stall deepens.
  const carried =
    ratio <= 0.8 ? ratio : 0.8 + 0.2 * (1 - m.exp(-(ratio - 0.8) / 0.2)) - 0.1 * stall * stall;
  const coefficient = m.sign(linear) * limit * carried;
  const thrust = coefficient * scale;
  const bladeLift = (6 * m.abs(coefficient)) / blades.solidity;
  // Induced velocity this thrust settles to.
  const hover = m.sqrt(m.abs(thrust) / (2 * flow.density * area));
  const way = m.sign(thrust) || 1;
  const inflowTarget =
    hover > 1e-6
      ? way * hover * inducedVelocityRatio((way * flow.axial) / hover, flow.edgewise / hover)
      : 0;
  // Profile drag grows with the square of the blades' loading, and steeply into the stall.
  const mean = (6 * coefficient) / (blades.solidity * blades.liftSlope);
  const profile = blades.drag + 0.4 * mean * mean + 0.05 * stall;
  const profilePower =
    ((blades.solidity * profile) / 8) * (1 + 4.6 * advance * advance) * scale * tip;
  // Power: thrust against the flow through the disc (the rotor's own, at a loss, and its
  // climb or descent), plus the blades' drag.
  const power = thrust * (flow.axial + blades.inducedFactor * flow.inflow) + profilePower;
  return {
    thrust,
    power,
    drag: ((blades.solidity * profile) / 4) * advance * scale,
    inflowTarget,
    bladeLift,
    stall,
    advance,
    inflowRatio,
  };
}

/** Blade pitch (at three quarters radius) at which a rotor makes `thrust` in the flow it has. */
export function rotorPitchFor(
  blades: RotorBlades,
  flow: Omit<RotorFlow, 'pitch'>,
  thrust: number,
): number {
  const tip = blades.tipSpeed * flow.speed;
  if (!(tip > 1)) return 0;
  const area = m.PI * blades.radius * blades.radius;
  const advance = flow.edgewise / tip;
  const inflowRatio = (flow.axial + flow.inflow) / tip;
  const coefficient = thrust / (flow.density * area * tip * tip);
  const slope = (blades.solidity * blades.liftSlope) / 2;
  return (3 * (coefficient / slope + inflowRatio / 2)) / (1 + 1.5 * advance * advance);
}

/** Time for the induced flow to follow a change in thrust, s: the air above the disc has mass. */
export function inflowTime(blades: RotorBlades, speed: number, inflow: number): number {
  // About a third of the radius of air, moved at the speed of the flow through the disc.
  return m.clamp(
    (0.3 * blades.radius) / m.max(m.abs(inflow), 0.02 * blades.tipSpeed * speed),
    0.02,
    0.4,
  );
}

export interface DiscTilt {
  /** Tilt of the thrust axis away from the edgewise airflow (flapback), rad. */
  back: number;
  /** Tilt toward the advancing side, rad. */
  aside: number;
  /** Tilt per rad/s the shaft is turning away from the disc, s: what damps a helicopter. */
  lag: number;
  /** Cone the blades fly at, rad. */
  coning: number;
}

/**
 * How the disc flaps relative to where its swashplate puts it. A blade advancing into the
 * airflow lifts more and rises a quarter turn later, so the disc tilts back from the air it
 * flies into; coned blades meeting that air, and the inflow being stronger at the back of the
 * disc, tilt it toward the advancing side as well; and it follows a turning shaft late.
 * `lock` is the blades' Lock number (air force over inertia).
 */
export function discTilt(
  blades: RotorBlades,
  loads: Pick<RotorLoads, 'advance' | 'inflowRatio'>,
  pitch: number,
  inducedRatio: number,
  lock: number,
  rate: number,
): DiscTilt {
  const mu = loads.advance;
  const coning = m.max(0, (lock / 8) * (pitch * (1 + mu * mu) - (4 / 3) * loads.inflowRatio));
  const back = (mu * ((8 / 3) * pitch - 2 * loads.inflowRatio)) / (1 - (mu * mu) / 2);
  // The inflow is stronger at the back of the disc once the rotor moves (the "transverse flow"
  // of slow flight), most of all near a tenth of tip speed.
  const skew = inducedRatio > 1e-6 ? mu / inducedRatio : 0;
  const gradient = ((4 / 3) * skew) / (1.2 + skew);
  const aside = ((4 / 3) * mu * coning) / (1 + (mu * mu) / 2) + gradient * inducedRatio;
  void blades;
  return { back, aside, lag: rate > 1e-6 ? 16 / (lock * rate) : 0, coning };
}

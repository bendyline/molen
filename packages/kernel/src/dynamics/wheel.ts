import { dmath as m } from '../dmath';

/**
 * A wheel on a strut: the tire's grip from how its contact patch slips over the road, the
 * wheel's own spin under drive and brake torque, and the spring and damper that carry the load.
 * Pure functions over plain numbers, shared by anything that stands on wheels.
 */

/** Tire curve shape: force peaks, then falls to about 85% of the peak as the tire slides. */
export const TIRE_SHAPE = 1.35;
/** Normalized slip at which the curve peaks is 1: this scales the slip into the curve. */
export const TIRE_PEAK: number = m.tan(m.PI / (2 * TIRE_SHAPE));
/** Straight-line tire grip relative to side grip. */
export const LONGITUDINAL_GRIP = 1.15;
/** Slip ratio at the peak of the drive and brake force, as a share of the peak slip angle. */
const PEAK_RATIO_SHARE = 0.7;
/** Road speed below which slip is measured against this speed, m/s: keeps a standing start finite. */
export const SLIP_REFERENCE_SPEED = 3;

export interface TireInput {
  /** (Wheel surface speed − road speed) / road speed: positive under drive, -1 locked. */
  slipRatio: number;
  /** Radians: the contact patch's sideways motion against its rolling; positive moving left. */
  slipAngle: number;
  /** Load the tire carries, N. */
  load: number;
  /** Peak side friction coefficient on this road at this load. */
  friction: number;
  /** Side force per unit load per radian of slip before it saturates. */
  stiffness: number;
}

export interface TireForces {
  /** Along the wheel's heading, N: positive pushes the vehicle forward. */
  longitudinal: number;
  /** To the wheel's left, N. */
  lateral: number;
  /** 0–1: how far the tire is past its peak (sliding, spinning or locked). */
  over: number;
}

/** Slip angle at which a tire's side force peaks, rad. */
export function tirePeakAngle(friction: number, stiffness: number): number {
  return (TIRE_PEAK * TIRE_SHAPE * friction) / stiffness;
}

/** Slip ratio at which a tire's drive or brake force peaks. */
export function tirePeakRatio(friction: number, stiffness: number): number {
  return PEAK_RATIO_SHARE * tirePeakAngle(friction, stiffness);
}

/**
 * Tire force from combined slip. Sideways and lengthwise slip each count against their own
 * peak; together they use up one grip, shared in the direction the contact patch is slipping
 * (a friction ellipse, a little stronger lengthwise). Past the peak the tire slides and holds
 * about 85% of it.
 */
export function tireForces(input: TireInput): TireForces {
  const { load, friction } = input;
  if (!(load > 0) || !(friction > 0)) return { longitudinal: 0, lateral: 0, over: 0 };
  const peakAngle = tirePeakAngle(friction, input.stiffness);
  const along = input.slipRatio / (PEAK_RATIO_SHARE * peakAngle);
  const across = input.slipAngle / peakAngle;
  const slip = m.hypot(along, across);
  if (slip < 1e-9) return { longitudinal: 0, lateral: 0, over: 0 };
  const share = m.sin(TIRE_SHAPE * m.atan(TIRE_PEAK * slip)) / slip;
  return {
    longitudinal: LONGITUDINAL_GRIP * friction * load * share * along,
    lateral: -friction * load * share * across,
    over: m.clamp((slip - 0.7) / 0.6, 0, 1),
  };
}

/** Slip ratio of a wheel turning at `spin` rad/s whose hub moves at `roadSpeed` along its heading. */
export function slipRatio(spin: number, radius: number, roadSpeed: number): number {
  return (spin * radius - roadSpeed) / m.max(m.abs(roadSpeed), SLIP_REFERENCE_SPEED);
}

export interface WheelStepInput extends Omit<TireInput, 'slipRatio'> {
  /** Wheel speed, rad/s; positive rolling forward. */
  spin: number;
  radius: number;
  /** Rotating inertia about the axle, kg m²: wheel, tire, brake and its share of the driveline. */
  inertia: number;
  /** The hub's speed along the wheel's heading, m/s. */
  roadSpeed: number;
  /** Signed torque from the driveline, N m. */
  driveTorque: number;
  /** Brake torque, N m, 0 or more: opposes the spin and holds a stopped wheel. */
  brakeTorque: number;
  h: number;
}

export interface WheelStep {
  spin: number;
  slipRatio: number;
  forces: TireForces;
}

/** A wheel as the step finds it: its tire force now and how the force answers the spin. */
interface WheelNow {
  at: (rate: number) => TireForces;
  reference: number;
  force: number;
  /** Newtons more tire reaction per m/s more wheel surface speed. */
  slope: number;
  /** Which way the brake's torque acts: against the spin, or the road's pull on a stopped wheel. */
  direction: number;
}

type WheelSide = Omit<WheelStepInput, 'h' | 'driveTorque'>;

function wheelNow(input: WheelSide): WheelNow {
  const { spin, radius, roadSpeed } = input;
  const reference = m.max(m.abs(roadSpeed), SLIP_REFERENCE_SPEED);
  const at = (rate: number): TireForces =>
    tireForces({ ...input, slipRatio: (rate * radius - roadSpeed) / reference });
  const force = at(spin).longitudinal;
  // How the tire's reaction grows as the wheel speeds up. Past the peak the curve no longer
  // rises, but a sliding wheel let go still has to stop at the road's speed and not shoot past
  // it: there the chord back to free rolling stands in for the slope.
  const probe = 0.01 * reference;
  const slipping = spin * radius - roadSpeed;
  const rising = (at(spin + probe / radius).longitudinal - force) / probe;
  return {
    at,
    reference,
    force,
    slope: rising > 0 ? rising : m.abs(slipping) > 1e-6 ? m.max(0, force / slipping) : 0,
    direction: spin > 1e-6 ? 1 : spin < -1e-6 ? -1 : m.sign(roadSpeed),
  };
}

/**
 * A brake stops the wheel; it cannot turn it backward. Stopped, it holds against what the road
 * and the driveline ask of it, up to its torque.
 */
function wheelStep(input: WheelSide, now: WheelNow, spin: number, driveTorque: number): WheelStep {
  let next = spin;
  if (input.brakeTorque > 0 && (now.direction === 0 || next * now.direction <= 0)) {
    const asked = m.abs(driveTorque - input.radius * now.at(0).longitudinal);
    if (asked <= input.brakeTorque || now.direction !== 0) next = 0;
  }
  return {
    spin: next,
    slipRatio: (next * input.radius - input.roadSpeed) / now.reference,
    forces: now.at(next),
  };
}

/**
 * One step of a wheel's spin and the tire force that goes with it. The tire's grip stiffens the
 * equation far beyond what a fixed step can follow, so the spin is advanced implicitly against
 * the slope of the force curve: a rolling wheel stays glued to the road speed, a wheel with more
 * torque than grip spins up, and a wheel braked harder than its grip locks.
 */
export function stepWheel(input: WheelStepInput): WheelStep {
  const { radius, h } = input;
  const now = wheelNow(input);
  const free = input.driveTorque - radius * now.force;
  const next =
    input.spin +
    (h * (free - input.brakeTorque * now.direction)) /
      (input.inertia + h * radius * radius * now.slope);
  return wheelStep(input, now, next, input.driveTorque);
}

export interface AxleStepInput {
  /** The two wheels of the axle; `inertia` is each wheel's own. */
  left: WheelSide;
  right: WheelSide;
  /** Torque the driveline brings to the differential, N m (signed); 0 for an undriven axle. */
  driveTorque: number;
  /**
   * Rotating inertia of the engine and gearbox as the differential's carrier feels it, kg m².
   * The carrier turns at the mean of the two wheels.
   */
  carrierInertia: number;
  /** How far the differential resists a difference in wheel speed: 0 open to 1 locked. */
  locked: number;
  h: number;
}

/**
 * One step of two wheels joined by a differential. An open differential gives both wheels the
 * same torque, and that torque is what is left after the engine has been spun up with them: a
 * wheel that breaks loose runs away with the carrier, and its partner gets only what the loose
 * one can hold. A limited-slip differential also drags the two toward the same speed.
 */
export function stepAxle(input: AxleStepInput): [WheelStep, WheelStep] {
  const { left, right, h } = input;
  const a = wheelNow(left);
  const b = wheelNow(right);
  // Each wheel's inertia with the tire's own stiffness, and the carrier's quarter share.
  const own = (side: WheelSide, now: WheelNow): number =>
    side.inertia / h + side.radius * side.radius * now.slope;
  const carrier = input.carrierInertia / (4 * h);
  // The lock drags the two wheels toward one speed. It acts on the speeds the step ends with,
  // not the ones it began with: two wheels spinning free of the road have only their own
  // inertia to resist it, and a drag sized for the driveline's would throw them past each
  // other, further every step.
  const lock = input.locked * 0.25 * ((left.inertia + right.inertia) / 2 / h + carrier);
  const drag = lock * (right.spin - left.spin);
  const half = input.driveTorque / 2;
  const torqueLeft = half - left.radius * a.force - left.brakeTorque * a.direction + drag;
  const torqueRight = half - right.radius * b.force - right.brakeTorque * b.direction - drag;
  const ownLeft = own(left, a) + carrier + lock;
  const ownRight = own(right, b) + carrier + lock;
  const across = carrier - lock;
  const determinant = ownLeft * ownRight - across * across;
  const changeLeft = (ownRight * torqueLeft - across * torqueRight) / determinant;
  const changeRight = (ownLeft * torqueRight - across * torqueLeft) / determinant;
  return [
    wheelStep(left, a, left.spin + changeLeft, half),
    wheelStep(right, b, right.spin + changeRight, half),
  ];
}

export interface StrutInput {
  /** How far the strut is compressed from its static ride height, m; negative is extended. */
  compression: number;
  /** Rate of compression, m/s. */
  rate: number;
  /** Load it carries at the static ride height, N. */
  staticLoad: number;
  /** Spring rate at the wheel, N/m. */
  spring: number;
  /** Damper rate at the wheel, N s/m. */
  damper: number;
  /** Compression at which the bump stop is met, m. */
  travel: number;
}

/**
 * Load a strut carries to its wheel, N: spring, damper and, past its travel, a bump stop four
 * times as stiff. Never negative: an extended strut lets the wheel hang.
 */
export function strutLoad(input: StrutInput): number {
  const { compression, spring } = input;
  const stop = compression > input.travel ? 4 * spring * (compression - input.travel) : 0;
  return m.max(0, input.staticLoad + spring * compression + input.damper * input.rate + stop);
}

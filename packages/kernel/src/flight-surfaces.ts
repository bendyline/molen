import type { AirplanePhysicsSpec, AirplaneSurfacesSpec } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { wingLiftCoefficient } from './flight-aerodynamics';

/**
 * An airplane's lifting surfaces, each seeing its own airflow and pushing where it sits: four
 * wing panels, a tailplane and a fin. Roll damping, adverse yaw, the dihedral effect,
 * weathercock stability, pitch stiffness and damping, speed stability and a wing dropping at the
 * stall follow from where the surfaces are, not from a constant apiece.
 *
 * Everything here is in body axes about the center of mass: +X left, +Y up, +Z forward.
 */

type Vec3 = [number, number, number];

/**
 * Spanwise stations of the outer and inner wing panels, as shares of the span from the center.
 * Each panel is followed by its mirror, so in symmetric flight their yaw and roll moments cancel
 * to the last bit.
 */
const PANEL_STATIONS = [0.3, -0.3, 0.1, -0.1] as const;
/** Panels beyond this share of the span carry the ailerons. */
const AILERON_STATION = 0.2;
/** Greatest lift coefficient of a tailplane or fin: they are thin, unflapped sections. */
const TAIL_MAX_LIFT = 1.2;

export interface WingPanelInput {
  airplane: AirplanePhysicsSpec;
  surfaces: AirplaneSurfacesSpec;
  span: number;
  /** Air velocity over the center of mass in body axes, m/s. */
  air: Vec3;
  /** Body-axis angular velocity, rad/s. */
  omega: Vec3;
  density: number;
  /** Flap position 0..1. */
  flaps: number;
  /** Aileron deflection -1..1; positive rolls right. */
  aileron: number;
  /** Induced-drag factor: drag coefficient per lift coefficient squared, ground effect included. */
  induced: number;
  /** Share of each wing still attached, 0..1. */
  left: number;
  right: number;
  /** Wind over the left and right wing less the wind at the center of mass, body axes, m/s. */
  gustLeft?: Vec3;
  gustRight?: Vec3;
}

export interface WingPanelLoads {
  /** Lift and induced drag of the wing, N, body axes. */
  force: Vec3;
  /** Their moment about the center of mass, N m, body axes. */
  moment: Vec3;
  /** Greatest flow separation over the four panels, 0..1. */
  separation: number;
}

/**
 * Lift and induced drag of the wing as four panels, two a side. In straight, steady flight the
 * four add up to the whole wing's polar; rolling, yawing, slipping or gusted, each panel meets
 * the air at its own speed and angle, so the wing damps roll, yaws against its ailerons, rights
 * itself in a slip and drops whichever panel stalls first.
 */
export function wingPanelLoads(input: WingPanelInput): WingPanelLoads {
  const { airplane, surfaces, air, omega } = input;
  const force: Vec3 = [0, 0, 0];
  const moment: Vec3 = [0, 0, 0];
  const area = airplane.wingArea / 4;
  const rise = m.sin(surfaces.dihedral);
  const run = m.cos(surfaces.dihedral);
  let separation = 0;
  // A wing with no lift slope (a test article) has no ailerons to speak of.
  const travel =
    airplane.liftSlope > 0 ? (input.aileron * surfaces.aileron) / airplane.liftSlope : 0;
  const ahead = surfaces.liftArm ?? 0;
  for (const station of PANEL_STATIONS) {
    const x = station * input.span;
    const side = station > 0 ? 1 : -1;
    const gust = side > 0 ? input.gustLeft : input.gustRight;
    // The panel's own airspeed: the body's, plus what its distance from the axis of a turn adds.
    const vx = air[0] - (gust?.[0] ?? 0);
    const vy = air[1] + omega[2] * x - (gust?.[1] ?? 0);
    const vz = air[2] - omega[1] * x - (gust?.[2] ?? 0);
    // Dihedral tips the panel's lift toward the centerline, so a slip raises the angle of
    // attack of the wing it comes from.
    const vertical = vy * run - vx * side * rise;
    const speed = m.hypot(vz, vertical);
    if (speed < 0.01) continue;
    const angle = m.atan2(-vertical, vz);
    // Ailerons move the outer panels' lift, one up and one down.
    const deflection = m.abs(station) > AILERON_STATION ? travel * side : 0;
    const section = wingLiftCoefficient(
      airplane,
      angle + airplane.camberAngle + deflection,
      input.flaps,
    );
    separation = m.max(separation, section.separation);
    const pressure =
      0.5 * input.density * speed * speed * area * (side > 0 ? input.left : input.right);
    // Dividing by the cosine keeps the four panels' vertical lift equal to the whole wing's.
    const lift = (pressure * section.cl) / run;
    const drag = pressure * input.induced * section.cl * section.cl;
    const cos = vz / speed;
    const sin = -vertical / speed;
    // Lift is square to the panel's airflow, in the panel's own plane; drag is along the airflow.
    const up: Vec3 = [-side * rise, run, 0];
    const fx = up[0] * (lift * cos + drag * sin);
    const fy = up[1] * (lift * cos + drag * sin);
    const fz = lift * sin - drag * cos;
    force[0] += fx;
    force[1] += fy;
    force[2] += fz;
    // Arm [x, 0, liftArm] crossed with the panel's force: lift ahead of the center of mass
    // pitches the nose up, which is what the tailplane is there to hold.
    moment[0] -= ahead * fy;
    moment[1] += ahead * fx - x * fz;
    moment[2] += x * fy;
  }
  return { force, moment, separation };
}

/**
 * Speed along the fuselage of the air over the tail, m/s: the airplane's own, quickened by the
 * propeller slipstream (given as the dynamic pressure it adds, Pa). The slipstream brings its
 * pressure and its direction together: standing in a crosswind or a tailwind with the engine
 * pulling, the tail still meets its air nearly head on.
 */
function tailFlow(axial: number, density: number, slipstream: number): number {
  if (!(slipstream > 0)) return axial;
  const square = axial * m.abs(axial) + (2 * slipstream) / m.max(density, 1e-6);
  return square >= 0 ? m.sqrt(square) : -m.sqrt(-square);
}

/** The tailplane's state for one step: what the elevator has to work with. */
export interface TailState {
  /** Pitch moment (nose-down positive) per unit of tail lift coefficient, N m. */
  gain: number;
  /** Tail angle of attack with the elevator neutral, rad: incidence and downwash included. */
  angle: number;
  /** Lift-curve slope of the tailplane, per rad. */
  slope: number;
  /** Angle of attack the elevator adds at full deflection, rad. */
  elevator: number;
}

export function tailState(
  surfaces: AirplaneSurfacesSpec,
  air: Vec3,
  omega: Vec3,
  density: number,
  /** Whole-wing lift coefficient over its lift slope: the angle the wing turns the air through. */
  wingAngle: number,
  /** Dynamic pressure the propeller slipstream adds at the tail, Pa. */
  slipstream: number,
  authority: number,
  /** Rate of change of the wing's angle of attack, rad/s. */
  angleRate = 0,
): TailState {
  // The tail's own vertical speed: pitching nose up swings it down, into more lift.
  const vertical = air[1] + omega[0] * surfaces.tailArm;
  const along = tailFlow(air[2], density, slipstream);
  const pressure = 0.5 * density * (along * along + vertical * vertical);
  // The wake the tail meets left the wing a moment ago, at the angle the wing had then.
  const lag = (angleRate * surfaces.tailArm) / m.max(m.abs(air[2]), 10);
  return {
    gain: surfaces.tailArm * pressure * surfaces.tailArea * authority,
    angle:
      (m.abs(along) > 0.01 ? m.atan2(-vertical, along) : 0) -
      surfaces.downwash * (wingAngle - lag) +
      surfaces.tailIncidence,
    slope: surfaces.tailLiftSlope,
    elevator: surfaces.elevator,
  };
}

/**
 * The tailplane's angle of attack (elevator neutral) whose lift balances the wing's about the
 * center of mass in steady flight at a wing lift coefficient.
 */
export function tailTrimAngle(
  airplane: AirplanePhysicsSpec,
  surfaces: AirplaneSurfacesSpec,
  cl: number,
): number {
  return (
    (cl * airplane.wingArea * (surfaces.liftArm ?? 0)) /
    (surfaces.tailLiftSlope * surfaces.tailArea * surfaces.tailArm)
  );
}

/**
 * The elevator position (-1..1, positive nose up) that holds an angle of attack hands-off: the
 * tailplane's lift balancing the wing's about the center of mass. `cl` is the wing's lift
 * coefficient there.
 */
export function elevatorTrimFor(
  airplane: AirplanePhysicsSpec,
  surfaces: AirplaneSurfacesSpec,
  alpha: number,
  cl: number,
): number {
  const wingAngle = airplane.liftSlope > 0 ? cl / airplane.liftSlope : 0;
  return m.clamp(
    (alpha -
      surfaces.downwash * wingAngle +
      surfaces.tailIncidence -
      tailTrimAngle(airplane, surfaces, cl)) /
      surfaces.elevator,
    -1,
    1,
  );
}

/** Pitch moment of the tailplane about +X (nose-down positive) at an elevator deflection -1..1. */
export function tailMoment(tail: TailState, deflection: number): number {
  return (
    tail.gain *
    m.clamp(tail.slope * (tail.angle - deflection * tail.elevator), -TAIL_MAX_LIFT, TAIL_MAX_LIFT)
  );
}

/**
 * The elevator deflection (positive is stick back, nose up; unclamped) at which the tailplane
 * gives a pitch moment about +X.
 */
export function elevatorForMoment(tail: TailState, moment: number): number {
  if (tail.gain <= 0 || tail.elevator <= 0) return 0;
  const lift = m.clamp(moment / tail.gain, -TAIL_MAX_LIFT, TAIL_MAX_LIFT);
  return (tail.angle - lift / tail.slope) / tail.elevator;
}

/**
 * Yaw moment (about +Y, nose left) of the fuselage in a slip: unlike the fin it turns the nose
 * further out of the wind, and the fin has to be big enough to win.
 */
export function bodyYawMoment(
  airplane: AirplanePhysicsSpec,
  surfaces: AirplaneSurfacesSpec,
  span: number,
  air: Vec3,
  density: number,
): number {
  if (!surfaces.bodyYaw || m.abs(air[2]) < 0.01) return 0;
  const slip = m.atan2(air[0], m.abs(air[2]));
  const pressure = 0.5 * density * (air[0] * air[0] + air[2] * air[2]);
  // Grows with the slip to 45 degrees and fades beyond, where the airflow is across the body.
  return -pressure * airplane.wingArea * span * surfaces.bodyYaw * 0.5 * m.sin(2 * slip);
}

/**
 * Moment of the fin about the center of mass: it weathervanes the nose into a slip, resists
 * yawing, and (standing above the center of mass) rolls the airplane away from the slip. Rudder
 * -1..1, positive nose right.
 */
export function finMoment(
  surfaces: AirplaneSurfacesSpec,
  air: Vec3,
  omega: Vec3,
  density: number,
  rudder: number,
  slipstream: number,
  authority: number,
): Vec3 {
  // The fin's own sideways speed: yawing nose left swings it right.
  const lateral = air[0] - omega[1] * surfaces.finArm - omega[2] * surfaces.finHeight;
  const along = tailFlow(air[2], density, slipstream);
  const pressure = 0.5 * density * (along * along + lateral * lateral);
  const slip = m.abs(along) > 0.01 ? m.atan2(lateral, m.abs(along)) : 0;
  const side =
    pressure *
    surfaces.finArea *
    authority *
    m.clamp(
      surfaces.finLiftSlope * (rudder * surfaces.rudder - slip),
      -TAIL_MAX_LIFT,
      TAIL_MAX_LIFT,
    );
  // Arm [0, finHeight, -finArm] crossed with a force along +X (to the left).
  return [0, -surfaces.finArm * side, -surfaces.finHeight * side];
}

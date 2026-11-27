import { type AircraftSpec, aircraftGearLayout } from '@bendyline/molen-schema';
import { aircraftTailStrike } from './aircraft-collision';
import { dmath as m } from './dmath';
import {
  LONGITUDINAL_GRIP,
  SLIP_REFERENCE_SPEED,
  stepWheel,
  strutLoad,
  tireForces,
  tirePeakAngle,
} from './dynamics/wheel';
import { type Quat, quatConjugate, quatRotateVec3, type Vec3 } from './math3d';

/**
 * Landing gear: an aircraft stands on wheels (or skids) at the ends of struts, the same strut
 * and tire a car stands on. Each leg pushes up by how far the ground has compressed it, its
 * tire grips sideways by how its contact patch slips, a braked wheel is slowed through its
 * tire, and the airframe turns about its center of mass by where those forces act. Weight on
 * the wheels, rotation about the main gear, a crosswind's crab, a taildragger's swing and a
 * bounce off the struts are what follows from that, not laws of their own.
 *
 * Body axes are the engine's: +X left, +Y up, +Z forward.
 */

export interface GearLeg {
  /** The tire's contact point with the aircraft at rest, from the center of mass, body axes. */
  arm: Vec3;
  /** Load it carries with the aircraft at rest at its authored mass, N. */
  staticLoad: number;
  /** Spring and damper rates at the wheel, N/m and N s/m. */
  spring: number;
  damper: number;
  /** Compression beyond rest at which the strut bottoms, m. */
  travel: number;
  radius: number;
  /** Rotating inertia of the wheel, kg m². */
  inertia: number;
  /** Share of the full brake force this wheel takes; 0 for an unbraked wheel. */
  brake: number;
  /** 1 turns with the pedals, -1 against them (a tailwheel), 0 does not steer. */
  steer: number;
  /** A skid: it slides, and never rolls. */
  skid: boolean;
  /**
   * A tailwheel's give, m: how far the tail can be pressed down past where it rests, against a
   * soft spring. The taildraggers' models stand in their three-point attitude, and their wing's
   * incidence is measured from that attitude as if it were level flight; pressed down this
   * far the wing meets the air at the angle it lifts off at.
   */
  squat?: number;
}

export interface GearGeometry {
  legs: readonly GearLeg[];
  /** Index of the tailwheel, where braking can put the aircraft on its nose. */
  tail: number | undefined;
  wheelbase: number;
  /** Peak tire friction on a dry runway, and side force per unit load per radian of slip. */
  friction: number;
  stiffness: number;
}

/**
 * Wheel speeds in rad/s, the load on each leg in N, and how far the ground holds each strut
 * closed from where it rests, m (at its full reach below rest where the wheel hangs clear), in
 * the order of the geometry's legs.
 */
export interface GearState {
  spin: number[];
  load: number[];
  travel: number[];
}

const G = 9.81;
/** The gear carries the aircraft while its up axis is within about 70° of the ground's normal. */
const GEAR_UPRIGHT = 0.35;
const geometries = new WeakMap<AircraftSpec, GearGeometry>();

/**
 * The undercarriage a spec describes. An airplane stands on two main wheels and a nose wheel,
 * or a tailwheel (`airplane.tailwheel`); a helicopter on the four ends of its skids. Where the
 * spec's `gear` gives no dimensions they follow from the airframe's size: the main wheels a
 * little behind the center of mass (ahead of it for a tailwheel) so the small wheel carries a
 * tenth of the weight, as designers place them.
 */
export function aircraftGear(spec: AircraftSpec): GearGeometry {
  const known = geometries.get(spec);
  if (known) return known;
  const gear = spec.gear ?? {};
  // Where the legs stand and how far their struts move is the schema's to say: a renderer
  // draws the same legs.
  const layout = aircraftGearLayout(spec);
  const helicopter = spec.model === 'helicopter';
  const weight = spec.mass * G;
  const omega = m.TAU * layout.frequency;
  const ratio = layout.damping;
  const radius = gear.wheelRadius ?? m.clamp(0.012 * spec.length + 0.1, 0.15, 0.65);
  const leg = (x: number, z: number, load: number, extra: Partial<GearLeg>): GearLeg => ({
    arm: [x, -spec.centerOfMass[1], z],
    staticLoad: load,
    spring: (load / G) * omega * omega,
    damper: 2 * ratio * (load / G) * omega,
    travel: layout.travel,
    radius,
    // A wheel and tire are about a hundredth of what they carry, most of it near the rim.
    inertia: 0.008 * (load / G) * radius * radius,
    brake: 0,
    steer: 0,
    skid: false,
    ...extra,
  });
  let geometry: GearGeometry;
  if (helicopter) {
    const legs = layout.legs.map((at) => leg(at.x, at.z, weight / 4, { skid: true, radius: 0.05 }));
    // Steel on a hard surface slides at about 0.4: a run-on landing skids to a stop on its
    // skids, where a tire's grip would trip it onto its nose.
    geometry = {
      legs,
      tail: undefined,
      wheelbase: layout.wheelbase,
      friction: 0.4,
      stiffness: 10,
    };
  } else {
    const tail = layout.tailwheel;
    const wheelbase = layout.wheelbase;
    // The steepest attitude on the wheels: the authored limit, or sooner where the airframe's
    // own tail would meet the runway.
    const steepest = m.max(
      0,
      m.min(spec.airplane?.maxGroundPitch ?? 0, aircraftTailStrike(spec).angle - 0.015),
    );
    const share = layout.auxiliaryShare;
    const [small, left, right] = layout.legs as [
      (typeof layout.legs)[number],
      (typeof layout.legs)[number],
      (typeof layout.legs)[number],
    ];
    const main = (weight * (1 - share)) / 2;
    geometry = {
      legs: [
        leg(small.x, small.z, weight * share, {
          steer: tail ? -1 : 1,
          radius: 0.6 * radius,
          ...(tail ? { squat: wheelbase * m.tan(steepest) } : {}),
        }),
        leg(left.x, left.z, main, { brake: 0.5 }),
        leg(right.x, right.z, main, { brake: 0.5 }),
      ],
      tail: tail ? 0 : undefined,
      wheelbase,
      friction: gear.grip ?? 0.8,
      stiffness: 10,
    };
  }
  geometries.set(spec, geometry);
  return geometry;
}

/** An aircraft standing on its gear: wheels still, each leg carrying its share. */
export function initialGearState(geometry: GearGeometry): GearState {
  return {
    spin: geometry.legs.map(() => 0),
    load: geometry.legs.map((leg) => leg.staticLoad),
    travel: geometry.legs.map(() => 0),
  };
}

/** Each strut at its full reach below where it rests: the gear of an aircraft clear of the ground. */
export function hangingGear(geometry: GearGeometry): number[] {
  return geometry.legs.map((leg) => -leg.staticLoad / leg.spring);
}

export interface GearInput {
  geometry: GearGeometry;
  /** Center of mass in the world, attitude, velocity (world) and angular velocity (body). */
  center: Vec3;
  rot: Quat;
  velocity: Vec3;
  omega: Vec3;
  /** Brakes, 0..1, and the pedals, -1..1 (positive turns the nose right). */
  brake: number;
  pedal: number;
  /** Angle the steered wheel turns at full pedal at this speed, rad. */
  steerAngle: number;
  /** Grip of the surface relative to a dry runway. */
  grip: number;
  /** Deceleration of full braking and of free rolling with all the weight on the wheels, m/s². */
  brakeDeceleration: number;
  rollingDeceleration: number;
  /** The aircraft's mass now, kg. */
  mass: number;
  /**
   * Standing still, held by its tires: everything else that acts on the aircraft, N in world
   * axes. The tires then push back along the ground with exactly what holds it there, shared
   * by the load on each, in place of the grip their slip would give.
   */
  holding?: Vec3;
  groundHeight(x: number, z: number, y?: number): number | undefined;
  h: number;
}

export interface GearStep {
  /** False where the ground under a leg is not there to ask: the state is untouched. */
  ok: boolean;
  /** What the gear does to the airframe: force in world axes, N, and moment about the center of mass in body axes, N m. */
  force: Vec3;
  moment: Vec3;
  /** How many legs carry load, and the load on all of them together, N. */
  loaded: number;
  weight: number;
  /** Speed at which a leg that was in the air met the ground this substep, m/s; 0 if none did. */
  sink: number;
  /** 0–1: the worst any tire is past its grip. */
  skid: number;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Unit normal of the ground through the legs' footprints: three points, or four by their diagonals. */
function groundNormal(points: readonly Vec3[]): Vec3 {
  const [a, b, c, d] = points as [Vec3, Vec3, Vec3, Vec3 | undefined];
  const u: Vec3 = d
    ? [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    : [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = d
    ? [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
    : [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = cross(u, v);
  if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
  const length = m.hypot(n[0], n[1], n[2]);
  // Ground steeper than 45° under the gear is an edge or a wall, not something it stands on.
  if (!(length > 0) || n[1] < 0.7 * length) return [0, 1, 0];
  return [n[0] / length, n[1] / length, n[2] / length];
}

/**
 * One substep of the undercarriage. Mutates `state` (wheel speeds and loads); returns what the
 * legs do to the airframe.
 */
export function stepGear(state: GearState, input: GearInput): GearStep {
  const { geometry, rot, h } = input;
  const { legs } = geometry;
  const none: GearStep = {
    ok: true,
    force: [0, 0, 0],
    moment: [0, 0, 0],
    loaded: 0,
    weight: 0,
    sink: 0,
    skid: 0,
  };
  const inverse = quatConjugate(rot);
  const forward = quatRotateVec3(rot, [0, 0, 1]);
  const up = quatRotateVec3(rot, [0, 1, 0]);
  const left = quatRotateVec3(rot, [1, 0, 0]);
  const feet: Vec3[] = [];
  const heights: number[] = [];
  const velocities: Vec3[] = [];
  for (const leg of legs) {
    const offset = quatRotateVec3(rot, leg.arm);
    const foot: Vec3 = [
      input.center[0] + offset[0],
      input.center[1] + offset[1],
      input.center[2] + offset[2],
    ];
    const ground = input.groundHeight(foot[0], foot[2], foot[1]);
    if (ground === undefined || !Number.isFinite(ground)) return { ...none, ok: false };
    feet.push(foot);
    heights.push(ground);
    const turning = quatRotateVec3(rot, cross(input.omega, leg.arm));
    velocities.push([
      input.velocity[0] + turning[0],
      input.velocity[1] + turning[1],
      input.velocity[2] + turning[2],
    ]);
  }
  const normal = groundNormal(feet.map((foot, i): Vec3 => [foot[0], heights[i] ?? 0, foot[2]]));
  const upright = dot(up, normal);
  const previous = state.load;
  const load = legs.map(() => 0);
  const spin = [...state.spin];
  const travel = hangingGear(geometry);
  if (upright <= GEAR_UPRIGHT) {
    state.load = load;
    state.travel = travel;
    return none;
  }
  const force: Vec3 = [0, 0, 0];
  const moment: Vec3 = [0, 0, 0];
  let loaded = 0;
  let weight = 0;
  let sink = 0;
  let skid = 0;
  const friction = geometry.friction * input.grip;
  // A tailwheel airplane stood on its brakes goes over on its nose: its pilot brakes only as
  // hard as keeps the tail down, and hardly at all while the tail is flying.
  let ease = 1;
  if (geometry.tail !== undefined) {
    const tail = legs[geometry.tail];
    if (tail) ease = m.clamp((previous[geometry.tail] ?? 0) / (0.5 * tail.staticLoad), 0.15, 1);
  }
  const cos = m.cos(input.pedal * input.steerAngle);
  const sin = m.sin(input.pedal * input.steerAngle);
  // Friction that holds a standing aircraft: what cancels the rest along the ground.
  let hold: Vec3 | undefined;
  if (input.holding) {
    const into = dot(input.holding, normal);
    hold = [
      normal[0] * into - input.holding[0],
      normal[1] * into - input.holding[1],
      normal[2] * into - input.holding[2],
    ];
  }
  const presses: number[] = [];
  for (const [i, leg] of legs.entries()) {
    const foot = feet[i] as Vec3;
    // How far the ground has pushed the wheel up its strut from where it rests; a spring's
    // free length is its static deflection, and past that the wheel hangs clear.
    const pressed = (-(foot[1] - (heights[i] ?? 0)) * normal[1]) / upright;
    presses.push(pressed);
    if (pressed <= -leg.staticLoad / leg.spring) continue;
    const rate = -dot(velocities[i] as Vec3, normal) / upright;
    // Where the substep leaves the strut: what it was pressed to, carried on at its own rate.
    travel[i] = m.max(travel[i] ?? 0, pressed + rate * h);
    const carried =
      leg.squat !== undefined && pressed > 0
        ? // Pressed down, a tailwheel gives: a quarter more than its resting load at the end of its
          // squat.
          m.max(
            0,
            leg.staticLoad * (1 + (0.25 * pressed) / m.max(leg.squat, 0.05)) +
              leg.damper * rate +
              (pressed > leg.squat ? 4 * leg.spring * (pressed - leg.squat) : 0),
          )
        : strutLoad({
            compression: pressed,
            rate,
            staticLoad: leg.staticLoad,
            spring: leg.spring,
            damper: leg.damper,
            travel: leg.travel,
          });
    load[i] = carried;
    weight += carried;
  }
  for (const [i, leg] of legs.entries()) {
    const velocity = velocities[i] as Vec3;
    const pressed = presses[i] ?? 0;
    const carried = load[i] ?? 0;
    if (carried <= 0) {
      // In the air a wheel spins down slowly.
      spin[i] = (spin[i] ?? 0) * m.max(0, 1 - 0.2 * h);
      continue;
    }
    loaded++;
    if ((previous[i] ?? 0) <= 0) sink = m.max(sink, -dot(velocity, normal));
    if (hold) {
      // Held: each tire takes its share of the hold, and a braked wheel does not turn.
      const share = carried / weight;
      const push: Vec3 = [
        normal[0] * carried + hold[0] * share,
        normal[1] * carried + hold[1] * share,
        normal[2] * carried + hold[2] * share,
      ];
      if (input.brake > 0 && leg.brake > 0) spin[i] = 0;
      force[0] += push[0];
      force[1] += push[1];
      force[2] += push[2];
      const turning = cross(
        [leg.arm[0], leg.arm[1] + pressed, leg.arm[2]],
        quatRotateVec3(inverse, push),
      );
      moment[0] += turning[0];
      moment[1] += turning[1];
      moment[2] += turning[2];
      continue;
    }
    // The wheel's heading on the ground, turned with the pedals where it steers.
    const way = leg.steer;
    const pointing: Vec3 =
      way === 0
        ? forward
        : [
            forward[0] * cos - way * left[0] * sin,
            forward[1] * cos - way * left[1] * sin,
            forward[2] * cos - way * left[2] * sin,
          ];
    const rise = dot(pointing, normal);
    let heading: Vec3 = [
      pointing[0] - normal[0] * rise,
      pointing[1] - normal[1] * rise,
      pointing[2] - normal[2] * rise,
    ];
    const length = m.hypot(heading[0], heading[1], heading[2]);
    heading =
      length > 1e-6 ? [heading[0] / length, heading[1] / length, heading[2] / length] : pointing;
    const side = cross(normal, heading);
    const rolling = dot(velocity, heading);
    const angle = m.atan2(dot(velocity, side), m.max(m.abs(rolling), SLIP_REFERENCE_SPEED));
    let along: number;
    let across: number;
    if (leg.skid) {
      // A skid is a locked wheel: friction against the way it slides.
      const sliding = tireForces({
        slipRatio: -rolling / m.max(m.abs(rolling), SLIP_REFERENCE_SPEED),
        slipAngle: angle,
        load: carried,
        friction,
        stiffness: geometry.stiffness,
      });
      along = sliding.longitudinal;
      across = sliding.lateral;
      skid = m.max(skid, sliding.over);
    } else {
      // Anti-skid holds the brake just short of what the tire can take, less while it is
      // also holding the airplane against a slide.
      const use = m.min(1, m.abs(angle) / tirePeakAngle(m.max(friction, 0.01), geometry.stiffness));
      const hold =
        0.95 *
        LONGITUDINAL_GRIP *
        friction *
        carried *
        leg.radius *
        m.sqrt(m.max(0.05, 1 - (0.9 * use) ** 2));
      const wheel = stepWheel({
        spin: spin[i] ?? 0,
        radius: leg.radius,
        inertia: leg.inertia,
        roadSpeed: rolling,
        driveTorque: 0,
        brakeTorque: m.min(
          input.brake * ease * leg.brake * input.mass * input.brakeDeceleration * leg.radius,
          hold,
        ),
        slipAngle: angle,
        load: carried,
        friction,
        stiffness: geometry.stiffness,
        h,
      });
      spin[i] = wheel.spin;
      // Rolling resistance by the weight on the wheel.
      along =
        wheel.forces.longitudinal -
        (carried / G) * input.rollingDeceleration * m.clamp(rolling / 0.5, -1, 1);
      across = wheel.forces.lateral;
      skid = m.max(skid, wheel.forces.over);
    }
    const push: Vec3 = [
      normal[0] * carried + heading[0] * along + side[0] * across,
      normal[1] * carried + heading[1] * along + side[1] * across,
      normal[2] * carried + heading[2] * along + side[2] * across,
    ];
    force[0] += push[0];
    force[1] += push[1];
    force[2] += push[2];
    const turning = cross(
      [leg.arm[0], leg.arm[1] + pressed, leg.arm[2]],
      quatRotateVec3(inverse, push),
    );
    moment[0] += turning[0];
    moment[1] += turning[1];
    moment[2] += turning[2];
  }
  state.spin = spin;
  state.load = load;
  state.travel = travel;
  return { ok: true, force, moment, loaded, weight, sink, skid };
}

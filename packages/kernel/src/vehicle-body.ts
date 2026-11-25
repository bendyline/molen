import type { VehicleSpec } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { applyContactImpulse, type ContactBody, contactPoint, separate } from './dynamics/contact';
import { angularAcceleration, type Inertia, turnBody } from './dynamics/rigid-body';
import { SLIP_REFERENCE_SPEED } from './dynamics/wheel';
import { type Quat, quatConjugate, quatRotateVec3, type Vec3 } from './math3d';
import { strutLoads, type WheelControls, type WheelsGeometry, wheelForces } from './vehicle-wheels';

/**
 * A car as a free rigid body: six degrees of freedom, standing on whatever of its four wheels
 * reach the ground and, where they do not, on its own corners. On the road a car is solved in
 * the plane of the road (vehicles.ts) with its body leaning on the struts; this takes over when
 * it leaves that plane: off a ledge or a jump, tipping onto two wheels, tumbling, on its roof.
 * The wheels, tires, differentials and controllers are the same ones.
 *
 * Body axes are the engine's: +X left, +Y up, +Z forward. Wheels are numbered front left, front
 * right, rear left, rear right.
 */

type Four = [number, number, number, number];

export interface CarBody {
  /** Center of mass in the world, m. */
  center: Vec3;
  rot: Quat;
  /** Velocity of the center of mass, world axes, m/s. */
  velocity: Vec3;
  /** Angular velocity about the body axes, rad/s: nose down, turning left, right side down. */
  omega: Vec3;
  /** Wheel speeds, rad/s, and the load on each wheel, N. */
  spin: Four;
  load: Four;
}

export interface CarBodyInput {
  controls: Omit<WheelControls, 'u'>;
  /** Front wheel angle in radians, positive to the right. */
  steer: number;
  /** Inertia about the body's up axis, kg m². */
  yawInertia: number;
  /** Air drag as an acceleration per (m/s)², and the body's side area over its frontal area. */
  drag: number;
  side: number;
  /** Wind over the ground, world axes, m/s. */
  wind?: Vec3;
  /** Rolling resistance of the wheels on this surface, m/s². */
  resistance: number;
  /** Multiplier on horizontal travel: the world's travel boost. */
  travel: number;
  groundHeight(x: number, z: number, y?: number): number | undefined;
}

export interface CarBodyStep {
  /** False where the ground under a wheel is not there to ask: nothing has moved. */
  ok: boolean;
  /** How far the body's up axis leans from the ground under its wheels, as a cosine. */
  upright: number;
  /** How many wheels carry load. */
  wheelsDown: number;
  /** Wheels that met the ground this substep, with the speed they met it at, m/s. */
  landed: { wheel: number; speed: number }[];
  /** 0–1: the worst any loaded tire is past its grip. */
  skid: number;
  /** 0–1: how hard traction or stability control is intervening. */
  assist: number;
  /** Road speed the driven wheels are turning at, m/s. */
  drivenSpeed: number;
}

const G = 9.81;
/** Struts carry the car while its up axis is within about 70° of the ground's normal. */
const STRUT_UPRIGHT = 0.35;

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Principal inertia of the car about its left, up and forward axes, kg m². */
export function carBodyInertia(geometry: WheelsGeometry, yawInertia: number): Inertia {
  return [geometry.pitchInertia, yawInertia, geometry.rollInertia];
}

/** Each wheel's contact point at its static ride height, from the center of mass, body axes. */
export function wheelArms(geometry: WheelsGeometry): [Vec3, Vec3, Vec3, Vec3] {
  const arm = (i: number): Vec3 => [geometry.x[i] ?? 0, -geometry.height, geometry.z[i] ?? 0];
  return [arm(0), arm(1), arm(2), arm(3)];
}

/** How far apart the ground is sampled to find its slope under a wheel, m. */
const SLOPE_SAMPLE = 0.25;

/**
 * Unit normal of the ground at a point whose height is `here`, from the heights a short way
 * along +X and +Z. Ground steeper than 60° there is an edge or the foot of a wall, not a
 * surface a wheel stands on: the wheel is taken to be on the level beside it.
 */
function groundNormal(here: number, alongX: number, alongZ: number): Vec3 {
  const sx = (alongX - here) / SLOPE_SAMPLE;
  const sz = (alongZ - here) / SLOPE_SAMPLE;
  const length = m.hypot(sx, 1, sz);
  if (!(length < 2)) return [0, 1, 0];
  return [-sx / length, 1 / length, -sz / length];
}

/**
 * One substep of the body under gravity, the air, and its wheels: each strut pushes along the
 * ground's normal by how far the ground has compressed it, each loaded tire grips where its
 * patch is, and the body turns about its center of mass by where those forces act. Mutates
 * `body`. Contacts of the body itself are resolved afterwards (`resolveCarBodyContacts`).
 */
export function stepCarBody(body: CarBody, input: CarBodyInput): CarBodyStep {
  const { controls, steer } = input;
  const { spec, geometry, mass, h } = controls;
  const { rot } = body;
  const inverse = quatConjugate(rot);
  const forward = quatRotateVec3(rot, [0, 0, 1]);
  const up = quatRotateVec3(rot, [0, 1, 0]);
  const left = quatRotateVec3(rot, [1, 0, 0]);
  const arms = wheelArms(geometry);
  const points: Vec3[] = [];
  const velocities: Vec3[] = [];
  const normals: Vec3[] = [];
  const heights: Four = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const arm = arms[i] as Vec3;
    const offset = quatRotateVec3(rot, arm);
    const point: Vec3 = [
      body.center[0] + offset[0],
      body.center[1] + offset[1],
      body.center[2] + offset[2],
    ];
    const ground = input.groundHeight(point[0], point[2], point[1]);
    if (ground === undefined || !Number.isFinite(ground))
      return {
        ok: false,
        upright: up[1],
        wheelsDown: 0,
        landed: [],
        skid: 0,
        assist: 0,
        drivenSpeed: 0,
      };
    heights[i] = ground;
    points.push(point);
    normals.push(
      groundNormal(
        ground,
        input.groundHeight(point[0] + SLOPE_SAMPLE, point[2], point[1]) ?? ground,
        input.groundHeight(point[0], point[2] + SLOPE_SAMPLE, point[1]) ?? ground,
      ),
    );
    const turning = quatRotateVec3(rot, cross(body.omega, arm));
    velocities.push([
      body.velocity[0] + turning[0],
      body.velocity[1] + turning[1],
      body.velocity[2] + turning[2],
    ]);
  }
  // The ground under the car as a whole: the mean of what is under its wheels.
  let mean: Vec3 = [0, 0, 0];
  for (const normal of normals)
    mean = [mean[0] + normal[0], mean[1] + normal[1], mean[2] + normal[2]];
  const size = m.hypot(mean[0], mean[1], mean[2]);
  const upright = dot(up, mean) / size;
  const struts = upright > STRUT_UPRIGHT;

  // Struts: how far the ground has pushed each wheel up its travel from the static ride
  // height. A spring's free length is its static deflection: past that the wheel hangs.
  const omega = m.TAU * (spec.suspensionFrequency ?? 1.5);
  const reach = G / (omega * omega);
  const compression: Four = [-reach, -reach, -reach, -reach];
  const rate: Four = [0, 0, 0, 0];
  const touching: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  if (struts)
    for (let i = 0; i < 4; i++) {
      const point = points[i] as Vec3;
      const normal = normals[i] as Vec3;
      // The strut works along the body's up axis, the ground pushes along its own normal.
      const lean = m.max(dot(up, normal), STRUT_UPRIGHT);
      const above = (point[1] - (heights[i] ?? 0)) * normal[1];
      const pressed = -above / lean;
      if (pressed <= -reach) continue;
      touching[i] = true;
      compression[i] = pressed;
      rate[i] = -dot(velocities[i] as Vec3, normal) / lean;
    }
  const load: Four = struts ? strutLoads(geometry, compression, rate) : [0, 0, 0, 0];
  const landed: { wheel: number; speed: number }[] = [];
  let wheelsDown = 0;
  for (let i = 0; i < 4; i++) {
    if (!touching[i]) load[i] = 0;
    if ((load[i] ?? 0) <= 0) continue;
    wheelsDown++;
    if ((body.load[i] ?? 0) <= 0)
      landed.push({
        wheel: i,
        speed: m.max(0, -dot(velocities[i] as Vec3, normals[i] as Vec3)),
      });
  }

  // Each contact patch's motion over the ground, in its wheel's own frame.
  const sin = m.sin(steer);
  const cos = m.cos(steer);
  const rolling: Four = [0, 0, 0, 0];
  const angle: Four = [0, 0, 0, 0];
  const headings: Vec3[] = [];
  const sides: Vec3[] = [];
  for (let i = 0; i < 4; i++) {
    const normal = normals[i] as Vec3;
    const pointing: Vec3 =
      i < 2
        ? [
            forward[0] * cos - left[0] * sin,
            forward[1] * cos - left[1] * sin,
            forward[2] * cos - left[2] * sin,
          ]
        : forward;
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
    headings.push(heading);
    sides.push(side);
    const velocity = velocities[i] as Vec3;
    rolling[i] = dot(velocity, heading);
    angle[i] = m.atan2(dot(velocity, side), m.max(m.abs(rolling[i] ?? 0), SLIP_REFERENCE_SPEED));
  }
  const tires = wheelForces(
    body.spin,
    { rolling, angle, load },
    { ...controls, u: dot(body.velocity, forward) },
  );

  // Forces in world axes, torques about the center of mass in body axes.
  const force: Vec3 = [0, -mass * G, 0];
  const torque: Vec3 = [0, 0, 0];
  let skid = 0;
  for (let i = 0; i < 4; i++) {
    const carried = load[i] ?? 0;
    if (carried <= 0) continue;
    const heading = headings[i] as Vec3;
    const side = sides[i] as Vec3;
    const normal = normals[i] as Vec3;
    const along =
      (tires.longitudinal[i] ?? 0) -
      input.resistance * (carried / G) * m.clamp((rolling[i] ?? 0) / 0.5, -1, 1);
    const across = tires.lateral[i] ?? 0;
    const push: Vec3 = [
      normal[0] * carried + heading[0] * along + side[0] * across,
      normal[1] * carried + heading[1] * along + side[1] * across,
      normal[2] * carried + heading[2] * along + side[2] * across,
    ];
    force[0] += push[0];
    force[1] += push[1];
    force[2] += push[2];
    const arm = arms[i] as Vec3;
    const at: Vec3 = [arm[0], arm[1] + (compression[i] ?? 0), arm[2]];
    const turning = cross(at, quatRotateVec3(inverse, push));
    torque[0] += turning[0];
    torque[1] += turning[1];
    torque[2] += turning[2];
    skid = m.max(skid, tires.over[i] ?? 0);
  }
  // The air: drag along the body, and more of it broadside or flat-on.
  const air: Vec3 = input.wind
    ? [
        body.velocity[0] - input.wind[0] / input.travel,
        body.velocity[1] - input.wind[1],
        body.velocity[2] - input.wind[2] / input.travel,
      ]
    : body.velocity;
  const airspeed = m.hypot(air[0], air[1], air[2]);
  if (airspeed > 0) {
    const ahead = dot(air, forward);
    const aside = dot(air, left) * input.side;
    const above = dot(air, up) * input.side;
    const k = -mass * input.drag * airspeed;
    for (let i = 0; i < 3; i++)
      force[i] =
        (force[i] ?? 0) +
        k * ((forward[i] ?? 0) * ahead + (left[i] ?? 0) * aside + (up[i] ?? 0) * above);
  }

  const turn = angularAcceleration(
    body.omega,
    torque,
    carBodyInertia(geometry, input.yawInertia),
    h,
  );
  body.omega = [
    body.omega[0] + turn[0] * h,
    body.omega[1] + turn[1] * h,
    body.omega[2] + turn[2] * h,
  ];
  body.velocity = [
    body.velocity[0] + (force[0] / mass) * h,
    body.velocity[1] + (force[1] / mass) * h,
    body.velocity[2] + (force[2] / mass) * h,
  ];
  body.rot = turnBody(rot, body.omega, h);
  body.center = [
    body.center[0] + body.velocity[0] * h * input.travel,
    body.center[1] + body.velocity[1] * h,
    body.center[2] + body.velocity[2] * h * input.travel,
  ];
  body.spin = tires.spin;
  body.load = load;
  const frontSpeed = ((tires.spin[0] + tires.spin[1]) / 2) * spec.wheelRadius;
  const rearSpeed = ((tires.spin[2] + tires.spin[3]) / 2) * spec.wheelRadius;
  return {
    ok: true,
    upright,
    wheelsDown,
    landed,
    skid,
    assist: tires.assist,
    drivenSpeed: controls.frontDrive * frontSpeed + (1 - controls.frontDrive) * rearSpeed,
  };
}

/** A point of the car's own body or a bottomed-out wheel against the ground or an obstacle. */
export interface CarBodyContact {
  point: Vec3;
  normal: Vec3;
  depth: number;
  /**
   * For a part that broke off in this contact: the closing speed its joint held to, m/s, and
   * the share of the impulse a broken joint still passes to the body.
   */
  joint?: { breakSpeed: number; share: number };
}

/**
 * The hard outline of a car, from its center of mass in body axes: the corners of its floor,
 * the corners of its roof, and its wheels at the top of their travel.
 */
export function carBodyOutline(
  spec: VehicleSpec,
  geometry: WheelsGeometry,
): { corners: Vec3[]; hubs: Vec3[]; radius: number } {
  const com = spec.centerOfMass;
  const floor = m.max(0.1, 0.55 * spec.wheelRadius);
  // A cabin is narrower than the body under it; a van's or a bus's roof runs its full length.
  const boxy = spec.height > 0.9 * spec.width;
  const roofFront = (boxy ? 0.42 : 0.14) * spec.length;
  const roofRear = (boxy ? -0.46 : -0.3) * spec.length;
  // `width` takes in the mirrors; the sills stand little wider than the wheels.
  const sill = m.min(spec.width / 2, spec.wheelTrack / 2 + 0.3);
  const roofHalf = m.min((boxy ? 0.46 : 0.38) * spec.width, sill + 0.15);
  const at = (x: number, y: number, z: number): Vec3 => [x - com[0], y - com[1], z - com[2]];
  const corners: Vec3[] = [];
  for (const x of [sill, -sill])
    for (const z of [spec.length / 2, -spec.length / 2]) corners.push(at(x, floor, z));
  for (const x of [roofHalf, -roofHalf])
    for (const z of [roofFront, roofRear]) corners.push(at(x, spec.height, z));
  const hubs: Vec3[] = [];
  for (let i = 0; i < 4; i++)
    hubs.push([
      geometry.x[i] ?? 0,
      spec.wheelRadius + geometry.travel + 0.03 - geometry.height,
      geometry.z[i] ?? 0,
    ]);
  return { corners, hubs, radius: spec.wheelRadius };
}

/**
 * Where the car's outline is below the ground. Ground that stands more than `step` above a
 * point is a wall, not a floor: it stops the car's travel instead of lifting it. Undefined
 * where the ground is not there to ask.
 */
export function carBodyGroundContacts(
  body: CarBody,
  outline: { corners: Vec3[]; hubs: Vec3[]; radius: number },
  groundHeight: (x: number, z: number, y?: number) => number | undefined,
  step: number,
  h: number,
): CarBodyContact[] | undefined {
  const contacts: CarBodyContact[] = [];
  const along = m.hypot(body.velocity[0], body.velocity[2]);
  const meet = (point: Vec3): boolean => {
    const ground = groundHeight(point[0], point[2], point[1]);
    if (ground === undefined || !Number.isFinite(ground)) return false;
    const depth = ground - point[1];
    if (depth <= 0) return true;
    if (depth > step && along > 0.1)
      contacts.push({
        point,
        normal: [-body.velocity[0] / along, 0, -body.velocity[2] / along],
        depth: along * h + 0.01,
      });
    else contacts.push({ point, normal: [0, 1, 0], depth });
    return true;
  };
  for (const corner of outline.corners) {
    const offset = quatRotateVec3(body.rot, corner);
    if (!meet([body.center[0] + offset[0], body.center[1] + offset[1], body.center[2] + offset[2]]))
      return undefined;
  }
  for (const hub of outline.hubs) {
    const offset = quatRotateVec3(body.rot, hub);
    if (
      !meet([
        body.center[0] + offset[0],
        body.center[1] + offset[1] - outline.radius,
        body.center[2] + offset[2],
      ])
    )
      return undefined;
  }
  return contacts;
}

/**
 * Answer the body's contacts: an impulse at each point with scraping friction, and a move out
 * of what it has sunk into. Returns the hardest closing speed, m/s; `closing`, when given, is
 * filled with each contact's own.
 */
export function resolveCarBodyContacts(
  body: CarBody,
  mass: number,
  inertia: Inertia,
  contacts: readonly CarBodyContact[],
  closing?: number[],
): number {
  if (contacts.length === 0) return 0;
  let correction: Vec3 = [0, 0, 0];
  let impact = 0;
  // Several points usually touch at once (two wheels, a roof's edge). Answered one after
  // another, the first would take the whole blow and turn the car by it; each is answered
  // against the same motion instead and they share the result, a few times over.
  for (let pass = 0; pass < 6; pass++) {
    const velocity = body.velocity;
    const omega = body.omega;
    const pushed: Vec3 = [0, 0, 0];
    const turned: Vec3 = [0, 0, 0];
    let active = 0;
    for (const contact of contacts) {
      const moving: ContactBody = { mass, inertia, rot: body.rot, velocity, omega };
      const touch = contactPoint(moving, body.center, contact.point, contact.normal);
      if (pass === 0) {
        impact = m.max(impact, touch.incoming);
        closing?.push(touch.incoming);
        if (!contact.joint) correction = separate(correction, contact.normal, contact.depth);
      }
      if (!(touch.incoming > 0)) continue;
      // Sheet metal and rubber: a hard hit gives a little back, a resting corner none.
      applyContactImpulse(moving, touch, {
        bounce: touch.incoming > 1.5 ? 1.15 : 1,
        friction: 0.6,
        ...(contact.joint
          ? {
              joint:
                m.min(1, contact.joint.breakSpeed / m.max(touch.incoming, 1e-3)) *
                contact.joint.share,
            }
          : {}),
      });
      for (let i = 0; i < 3; i++) {
        pushed[i] = (pushed[i] ?? 0) + (moving.velocity[i] ?? 0) - (velocity[i] ?? 0);
        turned[i] = (turned[i] ?? 0) + (moving.omega[i] ?? 0) - (omega[i] ?? 0);
      }
      active++;
    }
    if (active === 0) break;
    body.velocity = [
      velocity[0] + pushed[0] / active,
      velocity[1] + pushed[1] / active,
      velocity[2] + pushed[2] / active,
    ];
    body.omega = [
      omega[0] + turned[0] / active,
      omega[1] + turned[1] / active,
      omega[2] + turned[2] / active,
    ];
  }
  body.center = [
    body.center[0] + correction[0],
    body.center[1] + correction[1],
    body.center[2] + correction[2],
  ];
  return impact;
}

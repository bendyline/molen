import { dmath as m } from '../dmath';
import { type Quat, quatConjugate, quatRotateVec3, type Vec3 } from '../math3d';
import type { Inertia } from './rigid-body';

/**
 * Contact between a rigid body and something that does not move: the ground, a wall, a post.
 * One impulse stops the contact point's approach, friction slows its slide, and the body turns
 * by where it was struck. Aircraft, their wrecks, and cars off their wheels all meet the world
 * through this; a car on its wheels moves in the plane of its road and takes the same impulse
 * in that plane.
 */

/** The moving state of a rigid body. A contact changes `velocity` and `omega` in place. */
export interface ContactBody {
  mass: number;
  /** Principal inertia about the body's left, up and forward axes, kg m². */
  inertia: Inertia;
  rot: Quat;
  /** Velocity of the center of mass in world axes, m/s. */
  velocity: Vec3;
  /** Angular velocity about the body axes, rad/s. */
  omega: Vec3;
}

/** One point of a body touching an obstacle, and how it is moving there. */
export interface ContactPoint {
  /** From the center of mass to the point, in body axes. */
  arm: Vec3;
  /** The obstacle's outward normal, unit length, in world and in body axes. */
  worldNormal: Vec3;
  normal: Vec3;
  /** Velocity of the body's point, world axes. */
  velocity: Vec3;
  /** Speed at which the point is closing on the obstacle, m/s, 0 or more. */
  incoming: number;
  /** The point's velocity along the obstacle's surface, world axes, and its size. */
  tangent: Vec3;
  slide: number;
}

/** How a contact answers. */
export interface ContactResponse {
  /** Normal impulse as a multiple of what stops the approach: 1 is dead, 2 a perfect bounce. */
  bounce: number;
  /** Friction impulse as a share of the normal impulse, at most. */
  friction: number;
  /** Share of the impulse a broken joint still passes to the body; default 1. */
  joint?: number;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** How the body's point at `point` (world) is moving against an obstacle with `normal`. */
export function contactPoint(
  body: ContactBody,
  centerOfMass: Vec3,
  point: Vec3,
  normal: Vec3,
): ContactPoint {
  const inverse = quatConjugate(body.rot);
  const arm = quatRotateVec3(inverse, [
    point[0] - centerOfMass[0],
    point[1] - centerOfMass[1],
    point[2] - centerOfMass[2],
  ]);
  const turning = quatRotateVec3(body.rot, cross(body.omega, arm));
  const velocity: Vec3 = [
    body.velocity[0] + turning[0],
    body.velocity[1] + turning[1],
    body.velocity[2] + turning[2],
  ];
  const approach = dot(velocity, normal);
  const tangent: Vec3 = [
    velocity[0] - normal[0] * approach,
    velocity[1] - normal[1] * approach,
    velocity[2] - normal[2] * approach,
  ];
  return {
    arm,
    worldNormal: normal,
    normal: quatRotateVec3(inverse, normal),
    velocity,
    incoming: m.max(0, -approach),
    tangent,
    slide: m.hypot(tangent[0], tangent[1], tangent[2]),
  };
}

/**
 * Answer a contact with an impulse at its point: along the normal to stop the approach (and
 * bounce by `bounce`), and against the slide by friction. Returns the normal impulse in N s.
 */
export function applyContactImpulse(
  body: ContactBody,
  contact: ContactPoint,
  response: ContactResponse,
): number {
  const { arm, normal } = contact;
  const { mass, inertia } = body;
  const angularImpulse = (direction: Vec3): Vec3 => {
    const torque = cross(arm, direction);
    return [torque[0] / inertia[0], torque[1] / inertia[1], torque[2] / inertia[2]];
  };
  const effectiveInverseMass = (direction: Vec3): number =>
    1 / mass + dot(cross(angularImpulse(direction), arm), direction);
  const impulse =
    (contact.incoming * response.bounce * (response.joint ?? 1)) / effectiveInverseMass(normal);
  let local: Vec3 = [normal[0] * impulse, normal[1] * impulse, normal[2] * impulse];
  if (contact.slide > 0.0001 && impulse > 0) {
    const against = -1 / contact.slide;
    const direction = quatRotateVec3(quatConjugate(body.rot), [
      contact.tangent[0] * against,
      contact.tangent[1] * against,
      contact.tangent[2] * against,
    ]);
    const friction = m.min(
      impulse * response.friction,
      contact.slide / effectiveInverseMass(direction),
    );
    local = [
      local[0] + direction[0] * friction,
      local[1] + direction[1] * friction,
      local[2] + direction[2] * friction,
    ];
  }
  const push = quatRotateVec3(body.rot, local);
  const share = 1 / mass;
  body.velocity = [
    body.velocity[0] + push[0] * share,
    body.velocity[1] + push[1] * share,
    body.velocity[2] + push[2] * share,
  ];
  const turn = angularImpulse(local);
  body.omega = [body.omega[0] + turn[0], body.omega[1] + turn[1], body.omega[2] + turn[2]];
  return impulse;
}

/** A body that moves only in the horizontal plane and turns only about the vertical. */
export interface PlanarBody {
  mass: number;
  /** Inertia about the vertical axis, kg m². */
  yawInertia: number;
  /** World velocity, m/s; a contact changes the horizontal parts in place. */
  velocity: Vec3;
  /** rad/s, positive turning left. */
  yawRate: number;
}

/** Speed at which a planar body's point at `arm` from its center of mass (world) closes on `normal`. */
export function planarIncoming(body: PlanarBody, arm: Vec3, normal: Vec3): number {
  const velocity: Vec3 = [
    body.velocity[0] + body.yawRate * arm[2],
    body.velocity[1],
    body.velocity[2] - body.yawRate * arm[0],
  ];
  return m.max(0, -(velocity[0] * normal[0] + velocity[1] * normal[1] + velocity[2] * normal[2]));
}

/**
 * The same impulse for a body held to its plane: what is under its wheels already carries the
 * vertical part, so only the horizontal part of the normal pushes and turns it. Returns the
 * impulse along that horizontal part, in N s per unit of its length; 0 for a level surface.
 */
export function applyPlanarContactImpulse(
  body: PlanarBody,
  arm: Vec3,
  normal: Vec3,
  incoming: number,
  response: Pick<ContactResponse, 'bounce' | 'joint'>,
): number {
  const [nx, , nz] = normal;
  const horizontal = nx * nx + nz * nz;
  if (horizontal < 1e-6) return 0;
  const lever = arm[2] * nx - arm[0] * nz;
  const j =
    (incoming * response.bounce * (response.joint ?? 1)) /
    (horizontal / body.mass + (lever * lever) / body.yawInertia);
  body.velocity[0] += (j * nx) / body.mass;
  body.velocity[2] += (j * nz) / body.mass;
  body.yawRate += (j * lever) / body.yawInertia;
  return j;
}

/**
 * Add to `correction` what it takes to move a body out of an obstacle it is `depth` meters into
 * along `normal`, given the moves already gathered from other contacts.
 */
export function separate(correction: Vec3, normal: Vec3, depth: number): Vec3 {
  const more = m.max(0, depth - dot(correction, normal));
  return [
    correction[0] + normal[0] * more,
    correction[1] + normal[1] * more,
    correction[2] + normal[2] * more,
  ];
}

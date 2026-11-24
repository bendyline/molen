import { dmath as m } from '../dmath';
import {
  type Quat,
  quatConjugate,
  quatFromAxisAngle,
  quatMul,
  quatNormalize,
  quatRotateVec3,
  type Vec3,
} from '../math3d';

/**
 * The rigid body every vehicle model stands on. A body's transform origin is wherever its model
 * puts it (an aircraft's landing contact, a car's point on the road under its middle); the body
 * turns about its center of mass, `centerOfMass` away from that origin in body coordinates.
 * Body axes are the engine's: +X left, +Y up, +Z forward.
 */

/** Principal moments of inertia about the body's left, up and forward axes, kg m². */
export type Inertia = Vec3;

/** Substeps for one host step of `dt` seconds at no less than `rate` steps a second. */
export function substepCount(dt: number, rate: number): number {
  return m.max(1, m.ceil(dt * rate));
}

/** Turn an attitude by a body-axis angular velocity (rad/s) held for `h` seconds. */
export function turnBody(rot: Quat, omega: Vec3, h: number): Quat {
  const angle = m.hypot(omega[0], omega[1], omega[2]) * h;
  if (!(angle > 0)) return rot;
  return quatNormalize(
    quatMul(
      rot,
      quatFromAxisAngle(
        [(omega[0] * h) / angle, (omega[1] * h) / angle, (omega[2] * h) / angle],
        angle,
      ),
    ),
  );
}

/** World position of the transform origin of a body whose center of mass is at `center`. */
export function originFromCenterOfMass(center: Vec3, rot: Quat, centerOfMass: Vec3): Vec3 {
  const offset = quatRotateVec3(rot, centerOfMass);
  return [center[0] - offset[0], center[1] - offset[1], center[2] - offset[2]];
}

/** World position of the center of mass of a body whose transform origin is at `pos`. */
export function centerOfMassFromOrigin(pos: Vec3, rot: Quat, centerOfMass: Vec3): Vec3 {
  const offset = quatRotateVec3(rot, centerOfMass);
  return [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]];
}

/**
 * Body-axis rates one step later with no torque acting, by the implicit midpoint rule. Euler's
 * equations couple the three axes through the differences of the inertias; solved explicitly a
 * fast spin gains energy every step, solved this way it keeps it.
 */
export function freeRotationRates(omega: Vec3, inertia: Inertia, dt: number): Vec3 {
  const [ix, iy, iz] = inertia;
  const a: Vec3 = [(iy - iz) / ix, (iz - ix) / iy, (ix - iy) / iz];
  let next: Vec3 = [...omega];
  const det = (u: Vec3, v: Vec3, w: Vec3): number =>
    u[0] * (v[1] * w[2] - v[2] * w[1]) -
    u[1] * (v[0] * w[2] - v[2] * w[0]) +
    u[2] * (v[0] * w[1] - v[1] * w[0]);
  // Newton solves the three coupled midpoint equations, rather than using explicit gyroscopic acceleration.
  for (let n = 0; n < 8; n++) {
    const mid: Vec3 = [
      (omega[0] + next[0]) / 2,
      (omega[1] + next[1]) / 2,
      (omega[2] + next[2]) / 2,
    ];
    const residual: Vec3 = [
      next[0] - omega[0] - dt * a[0] * mid[1] * mid[2],
      next[1] - omega[1] - dt * a[1] * mid[2] * mid[0],
      next[2] - omega[2] - dt * a[2] * mid[0] * mid[1],
    ];
    const c0: Vec3 = [1, (-dt * a[1] * mid[2]) / 2, (-dt * a[2] * mid[1]) / 2];
    const c1: Vec3 = [(-dt * a[0] * mid[2]) / 2, 1, (-dt * a[2] * mid[0]) / 2];
    const c2: Vec3 = [(-dt * a[0] * mid[1]) / 2, (-dt * a[1] * mid[0]) / 2, 1];
    const determinant = det(c0, c1, c2);
    const change: Vec3 = [
      det(residual, c1, c2) / determinant,
      det(c0, residual, c2) / determinant,
      det(c0, c1, residual) / determinant,
    ];
    next = [next[0] - change[0], next[1] - change[1], next[2] - change[2]];
    if (m.max(m.abs(change[0]), m.max(m.abs(change[1]), m.abs(change[2]))) < 1e-12) break;
  }
  return next;
}

/**
 * Angular acceleration about the body axes, rad/s², under a body-axis torque in N m: Euler's
 * equations dω/dt = (M − ω × Iω) / I, with the torque-free part from `freeRotationRates`.
 */
export function angularAcceleration(omega: Vec3, torque: Vec3, inertia: Inertia, h: number): Vec3 {
  const free = freeRotationRates(omega, inertia, h);
  return [
    torque[0] / inertia[0] + (free[0] - omega[0]) / h,
    torque[1] / inertia[1] + (free[1] - omega[1]) / h,
    torque[2] / inertia[2] + (free[2] - omega[2]) / h,
  ];
}

/** Forces on a body summed in world axes, with their torques about its center of mass in body axes. */
export interface BodyLoads {
  force: Vec3;
  torque: Vec3;
}

export function noLoads(): BodyLoads {
  return { force: [0, 0, 0], torque: [0, 0, 0] };
}

function crossInto(out: Vec3, a: Vec3, b: Vec3): void {
  out[0] += a[1] * b[2] - a[2] * b[1];
  out[1] += a[2] * b[0] - a[0] * b[2];
  out[2] += a[0] * b[1] - a[1] * b[0];
}

/**
 * Add a force given in body axes, acting at `arm` from the center of mass (body axes, meters):
 * it pushes the body and, off-center, turns it. `rot` is the body's attitude.
 */
export function addBodyForce(loads: BodyLoads, rot: Quat, force: Vec3, arm?: Vec3): void {
  const world = quatRotateVec3(rot, force);
  loads.force[0] += world[0];
  loads.force[1] += world[1];
  loads.force[2] += world[2];
  if (arm) crossInto(loads.torque, arm, force);
}

/** Add a force given in world axes, acting at `arm` from the center of mass (body axes). */
export function addWorldForce(loads: BodyLoads, rot: Quat, force: Vec3, arm?: Vec3): void {
  loads.force[0] += force[0];
  loads.force[1] += force[1];
  loads.force[2] += force[2];
  if (arm) crossInto(loads.torque, arm, quatRotateVec3(quatConjugate(rot), force));
}

/** Velocity, in body axes, of a point of the body at `arm` from its center of mass. */
export function pointVelocity(velocity: Vec3, omega: Vec3, arm: Vec3): Vec3 {
  return [
    velocity[0] + omega[1] * arm[2] - omega[2] * arm[1],
    velocity[1] + omega[2] * arm[0] - omega[0] * arm[2],
    velocity[2] + omega[0] * arm[1] - omega[1] * arm[0],
  ];
}

/**
 * Principal inertia of a box-like body of `mass` kg from its width (left to right), height and
 * length in meters: what a car or a hull has when nothing better is known.
 */
export function boxInertia(mass: number, width: number, height: number, length: number): Inertia {
  return [
    (mass * (height * height + length * length)) / 12,
    (mass * (width * width + length * length)) / 12,
    (mass * (width * width + height * height)) / 12,
  ];
}

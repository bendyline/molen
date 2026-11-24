import { describe, expect, it } from 'vitest';
import {
  addBodyForce,
  addWorldForce,
  angularAcceleration,
  boxInertia,
  centerOfMassFromOrigin,
  freeRotationRates,
  noLoads,
  originFromCenterOfMass,
  pointVelocity,
  substepCount,
  turnBody,
} from '../src/dynamics/rigid-body';
import { quatFromAxisAngle, quatRotateVec3 } from '../src/math3d';

type Vec3 = [number, number, number];
const close = (a: readonly number[], b: readonly number[], digits = 9) =>
  a.forEach((value, i) => {
    expect(value).toBeCloseTo(b[i] ?? 0, digits);
  });

describe('rigid body core', () => {
  it('turns about the body axes: forward for roll, up for yaw, left for pitch', () => {
    // A quarter turn about the forward axis puts the left wingtip up (a right bank).
    const rolled = turnBody([0, 0, 0, 1], [0, 0, Math.PI / 2], 1);
    close(quatRotateVec3(rolled, [1, 0, 0]), [0, 1, 0]);
    // Small steps compose to the same turn as one large one.
    let stepped: [number, number, number, number] = [0, 0, 0, 1];
    for (let i = 0; i < 100; i++) stepped = turnBody(stepped, [0, 0, Math.PI / 2], 0.01);
    close(stepped, rolled);
    expect(turnBody(rolled, [0, 0, 0], 1)).toBe(rolled);
  });

  it('places the origin around the center of mass and back', () => {
    const rot = quatFromAxisAngle([0, 0, 1], 1.1);
    const offset: Vec3 = [0.2, 2.1, -0.4];
    const center: Vec3 = [10, 500, -30];
    const origin = originFromCenterOfMass(center, rot, offset);
    close(centerOfMassFromOrigin(origin, rot, offset), center);
    // Rolled past a right angle, the landing contact is above and beside the center of mass.
    expect(origin[1]).toBeGreaterThan(center[1] - 2.1);
  });

  it('keeps the energy and angular momentum of a torque-free tumble', () => {
    const inertia = boxInertia(1200, 1.8, 1.4, 4.5);
    let omega: Vec3 = [0.4, 3, 0.2];
    const energy = (w: Vec3) =>
      (inertia[0] * w[0] ** 2 + inertia[1] * w[1] ** 2 + inertia[2] * w[2] ** 2) / 2;
    const momentum = (w: Vec3) =>
      Math.hypot(inertia[0] * w[0], inertia[1] * w[1], inertia[2] * w[2]);
    const start = { energy: energy(omega), momentum: momentum(omega) };
    for (let i = 0; i < 6000; i++) omega = freeRotationRates(omega, inertia, 1 / 120);
    expect(energy(omega) / start.energy).toBeCloseTo(1, 6);
    expect(momentum(omega) / start.momentum).toBeCloseTo(1, 6);
  });

  it('accelerates about an axis by the torque over its inertia', () => {
    const inertia: Vec3 = [200, 500, 100];
    close(angularAcceleration([0, 0, 0], [20, -50, 30], inertia, 1 / 120), [0.1, -0.1, 0.3]);
  });

  it('sums forces in world axes and their torques about the center of mass in body axes', () => {
    const level: [number, number, number, number] = [0, 0, 0, 1];
    const loads = noLoads();
    // Lift on the left wingtip rolls the body right: a torque about +forward.
    addBodyForce(loads, level, [0, 100, 0], [5, 0, 0]);
    close(loads.force, [0, 100, 0]);
    close(loads.torque, [0, 0, 500]);
    // A force through the center of mass turns nothing.
    addWorldForce(loads, level, [0, -100, 0]);
    close(loads.force, [0, 0, 0]);
    close(loads.torque, [0, 0, 500]);
    // In a body rolled a right angle, a world-up force at the (now upper) left tip pulls along
    // the wing and so does not roll it.
    const banked = noLoads();
    addWorldForce(banked, quatFromAxisAngle([0, 0, 1], Math.PI / 2), [0, 100, 0], [5, 0, 0]);
    close(banked.torque, [0, 0, 0]);
  });

  it('gives a point off the center of mass the speed of the turn', () => {
    // Rolling right at 1 rad/s, the left wingtip 5 m out rises at 5 m/s.
    close(pointVelocity([0, 0, 60], [0, 0, 1], [5, 0, 0]), [0, 5, 60]);
    // Pitching up (a negative rate about the left axis), the tail 6 m back sinks.
    close(pointVelocity([0, 0, 60], [-0.5, 0, 0], [0, 0, -6]), [0, -3, 60]);
  });

  it('never takes fewer than one substep', () => {
    expect(substepCount(1 / 60, 120)).toBe(2);
    expect(substepCount(1 / 240, 120)).toBe(1);
  });
});

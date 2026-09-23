import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { installCharacterController } from '../src/character';
import { Transform, type TransformData } from '../src/component';
import { installKinematics } from '../src/kinematics';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import {
  driveVehicle,
  initialVehicleState,
  installVehicles,
  Mounted,
  mountEntity,
  stepVehicle,
  unmountEntity,
  VehicleState,
  vehicleLocalPoint,
  vehicleMounts,
  vehicleRotation,
} from '../src/vehicles';
import { World } from '../src/world';

const flat = { groundHeight: () => 0 };
const SEDAN: VehicleSpec = {
  label: 'Test sedan',
  width: 1.82,
  length: 4.65,
  height: 1.45,
  centerOfMass: [0, 0.54, 0],
  wheelbase: 2.75,
  wheelTrack: 1.53,
  wheelRadius: 0.31,
  mass: 1450,
  engineForce: 6200,
  maxSpeed: 42,
  reverseSpeed: 8,
  brakeDeceleration: 9.5,
  maxSteer: 0.56,
  grip: 8,
  driverEye: [0.4, 1.14, 0.25],
  steeringRate: 1.8,
  steeringFadeSpeed: 18,
  rollingResistance: 0.15,
  aerodynamicResistance: 0.0025,
  terrainAlignRate: 1.8,
  supportTolerance: 0.08,
  maxStepHeight: 0.4,
  maxSlope: 0.61,
};
function setup() {
  const w = new World({ tickRate: 60 });
  installVehicles(w, flat);
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      vehicle: {
        kind: 'test.vehicle.sedan',
        color: '#566d82',
        spec: SEDAN,
        visual: {
          wheelNodes: [],
          frontWheelNodes: [],
          steeringWheelNode: 'steering-wheel',
          paintMaterial: 'body-paint',
        },
      },
      vehicleState: initialVehicleState(),
      mountable: vehicleMounts(SEDAN),
    },
    'car',
  );
  w.spawnRaw({ transform: { pos: [-1.8, 0, 0], rot: [0, 0, 0, 1] } }, 'player');
  return w;
}
describe('mountable vehicle foundation', () => {
  it('enforces reach, exclusive seats, and driver authority', () => {
    const w = setup();
    expect(driveVehicle(w, 'player', { throttle: 1, steering: 0, brake: false })).toBe(false);
    w.spawnRaw({ transform: { pos: [100, 0, 0], rot: [0, 0, 0, 1] } }, 'far');
    expect(mountEntity(w, 'far', 'car')).toBe(false);
    expect(mountEntity(w, 'player', 'car')).toBe(true);
    w.patch('far', Transform, { pos: [-1.8, 0, 0] });
    expect(mountEntity(w, 'far', 'car')).toBe(false);
    expect(mountEntity(w, 'player', 'car')).toBe(false);
    expect(driveVehicle(w, 'player', { throttle: 1, steering: 0, brake: false })).toBe(true);
    w.stepN(120);
    expect(w.get('car', Transform)?.pos[2]).toBeGreaterThan(6);
    expect(w.get('car', VehicleState)?.speed).toBeGreaterThan(6);
    expect(w.get('player', Transform)?.pos).toEqual(
      vehicleLocalPoint(w.get('car', Transform) as TransformData, SEDAN.driverEye),
    );
  });
  it('brakes before reversing, refuses moving exits and checks each exit', () => {
    const w = setup();
    mountEntity(w, 'player', 'car');
    driveVehicle(w, 'player', { throttle: 1, steering: 0, brake: false });
    w.stepN(120);
    expect(unmountEntity(w, 'player', flat)).toBe(false);
    driveVehicle(w, 'player', { throttle: -1, steering: 0, brake: false });
    w.stepN(30);
    expect(w.get('car', VehicleState)?.speed).toBeGreaterThan(0);
    w.stepN(150);
    expect(w.get('car', VehicleState)?.speed).toBeLessThan(-1);
    driveVehicle(w, 'player', { throttle: 0, steering: 0, brake: true });
    w.stepN(90);
    expect(w.get('car', VehicleState)?.speed).toBe(0);
    expect(unmountEntity(w, 'player', { ...flat, canExit: () => false })).toBe(false);
    expect(unmountEntity(w, 'player', { ...flat, canExit: (pos) => pos[0] > 0 })).toBe(true);
    expect(w.has('player', Mounted)).toBe(false);
    expect(w.get('player', Transform)?.pos[0]).toBeGreaterThan(1.4);
  });
  it('steers in the appropriate direction in both forward and reverse and never turns in place', () => {
    const w = setup();
    mountEntity(w, 'player', 'car');
    driveVehicle(w, 'player', { throttle: 0, steering: 1, brake: false });
    w.stepN(30);
    expect(w.get('car', VehicleState)?.yaw).toBe(0);
    driveVehicle(w, 'player', { throttle: 1, steering: 1, brake: false });
    w.stepN(90);
    expect(w.get('car', Transform)?.pos[0]).toBeLessThan(-0.5);
    expect(w.get('car', VehicleState)?.yaw).toBeLessThan(0);
    const reverse = stepVehicle(
      { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      { ...initialVehicleState(), speed: -3 },
      { throttle: -1, steering: 1, brake: false },
      SEDAN,
      0.1,
      flat,
    );
    expect(reverse.state.yaw).toBeGreaterThan(0);
  });
  it('stops at missing tiles and collision barriers without tunneling', () => {
    const t = { pos: [0, 0, 0] as [number, number, number], rot: vehicleRotation(0) };
    const state = { ...initialVehicleState(), speed: 35 };
    const input = { throttle: 1, steering: 0, brake: false };
    const missing = stepVehicle(t, state, input, SEDAN, 0.1, {
      groundHeight: () => undefined,
    });
    expect(missing.transform.pos).toEqual(t.pos);
    expect(missing.state.waitingForTerrain).toBe(true);
    const wall = stepVehicle(t, state, input, SEDAN, 0.1, {
      ...flat,
      canOccupy: (p) => p[2] < 0.6,
    });
    expect(wall.transform.pos[2]).toBeLessThan(0.6);
    expect(wall.state.speed).toBe(0);
  });
  it('follows slopes, handles falling, and rejects steep slopes', () => {
    const input = { throttle: 1, steering: 0, brake: false },
      spec = SEDAN;
    let t = { pos: [0, 0, 0] as [number, number, number], rot: vehicleRotation(0) },
      state = initialVehicleState();
    for (let i = 0; i < 120; i++) {
      const result = stepVehicle(t, state, input, spec, 1 / 60, {
        groundHeight: (_x, z) => z * 0.1,
      });
      t = result.transform;
      state = result.state;
    }
    expect(t.pos[1]).toBeCloseTo(t.pos[2] * 0.1, 2);
    expect(state.pitch).toBeLessThan(-0.08);
    const fall = stepVehicle(
      { pos: [0, 2, 0], rot: vehicleRotation(0) },
      initialVehicleState(),
      input,
      spec,
      0.1,
      flat,
    );
    expect(fall.state.grounded).toBe(false);
    expect(fall.state.vy).toBeLessThan(0);
    const steep = stepVehicle(
      { pos: [0, 0, 0], rot: vehicleRotation(0) },
      initialVehicleState(),
      input,
      spec,
      1 / 60,
      { groundHeight: (_x, z) => z },
    );
    expect(steep.state.speed).toBe(0);
  });
  it('replays and restores all durable driving and mount state', () => {
    const a = setup();
    mountEntity(a, 'player', 'car');
    driveVehicle(a, 'player', { throttle: 1, steering: 0.35, brake: false });
    a.stepN(80);
    const checkpoint = takeKeyframe(a);
    const b = setup();
    applyKeyframeTo(b, checkpoint);
    a.stepN(120);
    b.stepN(120);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(Object.isFrozen(a.get('car', VehicleState))).toBe(true);
  });
  it('suspends character motion while mounted and cleans up destroyed mounts', () => {
    const w = setup();
    installCharacterController(w);
    installKinematics(w);
    w.spawnRaw(
      {
        transform: { pos: [-1.7, 0, 0], rot: [0, 0, 0, 1] },
        character: { speed: 6, jumpSpeed: 8, gravity: 20, vy: 0, grounded: true },
        kinematicBody: { vel: [6, 0, 0], slide: true },
      },
      'walker',
    );
    expect(mountEntity(w, 'walker', 'car')).toBe(true);
    w.stepN(60);
    expect(w.get('walker', Transform)?.pos).toEqual(SEDAN.driverEye);
    w.destroy('car');
    w.step();
    expect(w.has('walker', Mounted)).toBe(false);
  });
});

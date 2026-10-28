import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { setBoostMode } from '../src/boost';
import { installCharacterController } from '../src/character';
import { Transform, type TransformData } from '../src/component';
import { installKinematics } from '../src/kinematics';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import {
  driveVehicle,
  initialVehicleState,
  installVehicles,
  Mountable,
  Mounted,
  mountEntity,
  stepVehicle,
  unmountEntity,
  VehicleInput,
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
  it('boosts forward and reverse travel fourfold at the same throttle, with ordinary steering and brakes', () => {
    for (const throttle of [1, -1]) {
      let normal = {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } as TransformData,
        state: initialVehicleState(),
        impact: 0,
      };
      let boosted = structuredClone(normal);
      for (let tick = 0; tick < 1800; tick++) {
        const input = { throttle, steering: 0, brake: false };
        normal = stepVehicle(normal.transform, normal.state, input, SEDAN, 1 / 60, flat);
        boosted = stepVehicle(boosted.transform, boosted.state, input, SEDAN, 1 / 60, {
          ...flat,
          boostMode: true,
        });
      }
      expect(boosted.state.speed / normal.state.speed).toBeCloseTo(4, 2);
      expect(boosted.transform.pos[2] / normal.transform.pos[2]).toBeCloseTo(4, 2);
      const steer = { throttle: 0, steering: 0.4, brake: false };
      const turn = stepVehicle(boosted.transform, boosted.state, steer, SEDAN, 0.2, {
        ...flat,
        boostMode: true,
      });
      expect(Math.abs(turn.state.yaw)).toBeGreaterThan(0);
      const off = stepVehicle(
        boosted.transform,
        boosted.state,
        { ...steer, steering: 0 },
        SEDAN,
        1 / 60,
        flat,
      );
      expect(off.state.boosted).toBeUndefined();
      expect(off.state.speed).toBeCloseTo(normal.state.speed, 0);
      for (let tick = 0; tick < 600; tick++)
        boosted = stepVehicle(
          boosted.transform,
          boosted.state,
          { throttle: 0, steering: 0, brake: true },
          SEDAN,
          1 / 60,
          { ...flat, boostMode: true },
        );
      expect(boosted.state.speed).toBe(0);
    }
  });

  it('keeps boosted collision and terrain checks less than half a meter apart', () => {
    const t: TransformData = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
    const state = { ...initialVehicleState(), speed: 40 };
    const input = { throttle: 1, steering: 0, brake: false };
    let last = 0;
    const result = stepVehicle(t, state, input, SEDAN, 0.1, {
      ...flat,
      boostMode: true,
      canOccupy: (p) => {
        expect(Math.abs(p[2] - last)).toBeLessThan(0.51);
        last = p[2];
        return true;
      },
      groundHeight: (_x, z) => (z > 8 ? undefined : 0),
    });
    expect(result.state.waitingForTerrain).toBe(true);
    expect(result.transform.pos[2]).toBeLessThan(8);
    expect(result.state.speed).toBe(0);
  });
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
    // A hard hit bounces back rather than stopping dead.
    expect(wall.state.speed).toBeLessThan(0);
    expect(wall.impact).toBeGreaterThan(30);
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
  it('carries a passenger, who boards and leaves without touching the controls', () => {
    const w = setup();
    const mounts = vehicleMounts(SEDAN);
    w.set('car', Mountable, {
      ...mounts,
      seats: [
        ...mounts.seats,
        { id: 'passenger', role: 'passenger', position: [-0.4, 1.14, 0.25] },
      ],
    });
    w.spawnRaw({ transform: { pos: [-1.8, 0, 0.25], rot: [0, 0, 0, 1] } }, 'rider');
    expect(mountEntity(w, 'player', 'car')).toBe(true);
    driveVehicle(w, 'player', { throttle: 0, steering: 0.4, brake: true });
    // The passenger seat, not the driver's (which is taken), and the driver keeps the wheel.
    expect(mountEntity(w, 'rider', 'car')).toBe(false);
    expect(mountEntity(w, 'rider', 'car', 'passenger')).toBe(true);
    expect(w.get('car', VehicleInput)?.steering).toBe(0.4);
    expect(driveVehicle(w, 'rider', { throttle: 1, steering: 0, brake: false })).toBe(false);
    driveVehicle(w, 'player', { throttle: 1, steering: 0, brake: false });
    w.stepN(90);
    const t = w.get('car', Transform) as TransformData;
    expect(t.pos[2]).toBeGreaterThan(3);
    expect(w.get('rider', Transform)?.pos).toEqual(vehicleLocalPoint(t, [-0.4, 1.14, 0.25]));
    // Moving: nobody gets out. Stopped: the passenger leaves by an exit and the driver stays.
    expect(unmountEntity(w, 'rider', flat)).toBe(false);
    driveVehicle(w, 'player', { throttle: 0, steering: 0.2, brake: true });
    w.stepN(120);
    expect(w.get('car', VehicleState)?.speed).toBe(0);
    expect(unmountEntity(w, 'rider', flat)).toBe(true);
    expect(w.has('rider', Mounted)).toBe(false);
    expect(w.get('rider', Transform)?.pos[1]).toBeCloseTo(0.02, 5);
    expect(w.get('player', Mounted)?.seat).toBe('driver');
    expect(w.get('car', VehicleInput)?.steering).toBe(0.2);
    // The driver leaving idles the controls.
    expect(unmountEntity(w, 'player', flat)).toBe(true);
    expect(w.get('car', VehicleInput)?.steering).toBe(0);
  });
  it.each([false, true])('restores driving, mounts and boost state (boost=%s)', (boosted) => {
    const a = setup();
    setBoostMode(a, boosted);
    mountEntity(a, 'player', 'car');
    driveVehicle(a, 'player', { throttle: 1, steering: 0.35, brake: false });
    a.stepN(80);
    expect(a.get('car', VehicleState)?.boosted ?? false).toBe(boosted);
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

import type { AircraftContact } from '@bendyline/molen-schema';
import { expect, it } from 'vitest';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { vehiclePartProbes } from '../src/vehicle-damage';
import {
  initialVehicleState,
  installVehicles,
  repairVehicle,
  stepVehicle,
  type VehicleEnvironment,
  VehicleState,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenVehicle } from './helpers/entities';

const vehicle = molenVehicle('molen.entities.vehicle.sedan');
const spec = vehicle.spec;
const pose: TransformData = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
const input = { throttle: 0, steering: 0, brake: false };
const flat = { groundHeight: () => 0 };
const wall: VehicleEnvironment = {
  ...flat,
  contacts: (probes) =>
    probes
      .filter((p) => p.part === 'wheel-front-left')
      .map((p) => ({
        part: p.part,
        point: [p.center[0], p.center[1], p.center[2] + p.radius],
        normal: [0, 0, -1],
        depth: 0.02,
      })),
};

it('a frontal chassis crash loads the nearby hood joint with legacy occupancy hooks', () => {
  let result = { transform: pose, state: { ...initialVehicleState(), speed: 25 } };
  const env: VehicleEnvironment = { ...flat, canOccupy: (p, _yaw, s) => p[2] + s.length / 2 < 4 };
  for (let i = 0; i < 20; i++)
    result = stepVehicle(result.transform, result.state, input, spec, 1 / 60, env);
  expect(result.state.damage?.hood?.detached).toBe(true);
  expect(result.state.damage?.trunk).toBeUndefined();
});

it('a hard landing breaks wheel joints without requiring obstacle geometry', () => {
  const result = stepVehicle(
    { ...pose, pos: [0, 0.03, 0] },
    { ...initialVehicleState(), grounded: false, vy: -18 },
    input,
    spec,
    1 / 60,
    flat,
  );
  expect(
    (spec.collisionParts ?? [])
      .filter((p) => p.role === 'frontWheel' || p.role === 'rearWheel')
      .every((p) => result.state.damage?.[p.id]?.detached),
  ).toBe(true);
});

it('separates only the wheel struck at speed, preserves the input, and advances its debris', () => {
  const start = { ...initialVehicleState(), speed: 20 };
  const original = JSON.stringify(start);
  const hit = stepVehicle(pose, start, input, spec, 1 / 60, wall);
  expect(hit.state.damage?.['wheel-front-left']?.detached).toBe(true);
  expect(hit.state.damage?.['wheel-front-right']).toBeUndefined();
  expect(hit.state.debris).toHaveLength(1);
  expect(hit.state.speed).toBeGreaterThan(10);
  expect(JSON.stringify(start)).toBe(original);
  const next = stepVehicle(hit.transform, hit.state, input, spec, 1 / 30, wall);
  expect(next.state.debris).toHaveLength(1);
  expect(next.state.debris?.[0]?.pos).not.toEqual(hit.state.debris?.[0]?.pos);
  expect(
    vehiclePartProbes(next.transform, spec, next.state).some((p) => p.part === 'wheel-front-left'),
  ).toBe(false);
});

it('a gentle bump does not detach panels and losing driven wheels reduces acceleration and steering', () => {
  const gentle = stepVehicle(
    pose,
    { ...initialVehicleState(), speed: 1 },
    input,
    spec,
    1 / 60,
    wall,
  );
  expect(gentle.state.damage?.['wheel-front-left']?.detached).not.toBe(true);
  const damage = Object.fromEntries(
    (spec.collisionParts ?? [])
      .filter((p) => p.role === 'frontWheel')
      .map((p) => [p.id, { integrity: 0, detached: true }]),
  );
  const controls = { ...input, throttle: 1, steering: 0.5 };
  const healthy = stepVehicle(pose, initialVehicleState(), controls, spec, 1, flat);
  const broken = stepVehicle(pose, { ...initialVehicleState(), damage }, controls, spec, 1, flat);
  expect(healthy.state.speed).toBeGreaterThan(2);
  expect(broken.state.speed).toBeLessThan(0.01);
  expect(broken.state.steer).toBe(0);
  expect(Number.isFinite(broken.state.yawRate)).toBe(true);
});

it('door collision probes follow the open hinge and leave the closed side clear', () => {
  const closed = vehiclePartProbes(pose, spec, initialVehicleState()).filter(
    (p) => p.part === 'doorFrontLeft',
  );
  const opened = vehiclePartProbes(pose, spec, {
    ...initialVehicleState(),
    actuators: { doorFrontLeft: 1 },
  }).filter((p) => p.part === 'doorFrontLeft');
  expect(closed.length).toBeGreaterThan(0);
  expect(Math.max(...opened.map((p) => p.center[0]))).toBeGreaterThan(
    Math.max(...closed.map((p) => p.center[0])) + 0.3,
  );
});

it('replays damage and debris after keyframe restore, and repairs stopped vehicles', () => {
  const create = () => {
    const world = new World({ seed: 'road-collision', tickRate: 60 });
    installVehicles(world, wall);
    world.spawnRaw(
      {
        transform: pose,
        vehicle,
        vehicleState: { ...initialVehicleState(), speed: 20 },
        vehicleInput: input,
      },
      'car',
    );
    return world;
  };
  const a = create();
  a.stepN(2);
  const b = create();
  applyKeyframeTo(b, takeKeyframe(a));
  a.stepN(60);
  b.stepN(60);
  expect(stateHash(a)).toBe(stateHash(b));
  expect(a.get('car', Transform)).toEqual(b.get('car', Transform));
  expect(repairVehicle(a, 'car')).toBe(false);
  a.patch('car', VehicleState, { speed: 0, lateralSpeed: 0 });
  expect(repairVehicle(a, 'car')).toBe(true);
  expect(a.get('car', VehicleState)?.damage).toBeUndefined();
  expect(a.get('car', VehicleState)?.debris).toBeUndefined();
});

it('contact order does not change which parts detach or their velocities', () => {
  const contacts: AircraftContact[] = ['wheel-front-left', 'wheel-front-right'].map((part, i) => ({
    part,
    point: [i ? -0.8 : 0.8, 0.3, 1.6],
    normal: [0, 0, -1],
    depth: 0.1,
  }));
  const start = { ...initialVehicleState(), speed: 20 };
  const a = stepVehicle(pose, start, input, spec, 1 / 60, { ...flat, contacts: () => contacts });
  const b = stepVehicle(pose, start, input, spec, 1 / 60, {
    ...flat,
    contacts: () => [...contacts].reverse(),
  });
  expect(a).toEqual(b);
  expect(a.state.debris).toHaveLength(2);
});

it('keeps detached debris moving after the driver leaves a stopped car', () => {
  const world = new World({ seed: 'parked-debris', tickRate: 60 });
  installVehicles(world, flat);
  world.spawnRaw(
    {
      transform: pose,
      vehicle,
      vehicleState: {
        ...initialVehicleState(),
        damage: { 'wheel-front-left': { integrity: 0, detached: true } },
        debris: [
          {
            part: 'wheel-front-left',
            pos: [0, 2, 0],
            rot: [0, 0, 0, 1],
            velocity: [1, 0, 0],
            angularVelocity: [1, 0, 0],
            age: 0,
          },
        ],
      },
    },
    'car',
  );
  world.stepN(2);
  expect(world.get('car', VehicleState)?.debris?.[0]?.age).toBeGreaterThan(0);
  expect(world.get('car', VehicleState)?.debris?.[0]?.pos[1]).toBeLessThan(2);
  world.stepN(1201);
  expect(world.get('car', VehicleState)?.debris).toHaveLength(0);
  expect(world.get('car', VehicleState)?.damage?.['wheel-front-left']?.detached).toBe(true);
});

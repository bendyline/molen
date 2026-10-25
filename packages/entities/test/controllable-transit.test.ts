import { readFileSync } from 'node:fs';
import {
  flyAircraft,
  initialAircraftState,
  installAircraft,
  stepAircraft,
} from '@bendyline/molen-kernel/aircraft';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  installVehicles,
  mountEntity,
  stepVehicle,
  unmountEntity,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import type { AircraftData, VehicleData, VehicleStateData } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';

const documents = ['transit', 'aircraft'].map((name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../content/entities/types/${name}.types.json`, import.meta.url),
      'utf8',
    ),
  ),
);
const types = createTypeLibrary(documents);
const flat = { groundHeight: () => 0 };

describe('controllable Bendy transit', () => {
  it('validates transit including a genuinely locked steering angle', () => {
    for (const doc of documents) expect(validate('types', doc).ok).toBe(true);
    expect(
      types.component<VehicleData>('molen.entities.transit.lightrail', 'vehicle').spec.maxSteer,
    ).toBe(0);
  });

  it.each([
    'bus',
    'lightrail',
  ])('boards, accelerates, brakes, reverses and exits the %s', (name) => {
    const id = `molen.entities.transit.${name}`,
      components = types.components(id);
    const vehicle = types.component<VehicleData>(id, 'vehicle');
    const world = new World({ tickRate: 60, seed: 'bendy-transit' });
    installVehicles(world, flat);
    world.spawnRaw(components, 'vehicle');
    const entry = (components.mountable as { entries: number[][] }).entries[0];
    world.spawnRaw({ transform: { pos: entry, rot: [0, 0, 0, 1] } }, 'driver');
    expect(mountEntity(world, 'driver', 'vehicle')).toBe(true);
    driveVehicle(world, 'driver', { throttle: 1, steering: 0, brake: false });
    for (let i = 0; i < 300; i++) world.step();
    expect(world.get('vehicle', Transform)?.pos[2]).toBeGreaterThan(3);
    driveVehicle(world, 'driver', { throttle: 0, steering: 0, brake: true });
    for (let i = 0; i < 600; i++) world.step();
    const stop = world.get('vehicle', Transform)?.pos[2] ?? 0;
    driveVehicle(world, 'driver', { throttle: -1, steering: 0, brake: false });
    for (let i = 0; i < 300; i++) world.step();
    expect(world.get('vehicle', Transform)?.pos[2]).toBeLessThan(stop - 3);
    driveVehicle(world, 'driver', { throttle: 0, steering: 0, brake: true });
    for (let i = 0; i < 600; i++) world.step();
    expect(unmountEntity(world, 'driver', flat)).toBe(true);
    if (name === 'lightrail') {
      let transform = {
        pos: [0, 0, 0] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
      };
      let state = components.vehicleState as VehicleStateData;
      for (let i = 0; i < 300; i++) {
        const next = stepVehicle(
          transform,
          state,
          { throttle: 1, steering: 1, brake: false },
          vehicle.spec,
          1 / 60,
          flat,
        );
        transform = next.transform;
        state = next.state;
      }
      expect(transform.pos[0]).toBe(0);
      expect(state.yaw).toBe(0);
    }
  });

  it('boards the airliner and flies under its two engines with gear/flap controls', () => {
    const id = 'molen.entities.aircraft.airliner',
      components = types.components(id);
    const { spec } = types.component<AircraftData>(id, 'aircraft');
    const world = new World({ tickRate: 60, seed: 'bendy-flight' });
    installVehicles(world, flat);
    installAircraft(world, flat);
    world.spawnRaw(components, 'airliner');
    world.spawnRaw({ transform: { pos: [2.2, 0, 11.5], rot: [0, 0, 0, 1] } }, 'pilot');
    expect(mountEntity(world, 'pilot', 'airliner')).toBe(true);
    expect(
      flyAircraft(world, 'pilot', {
        engine: true,
        power: 1,
        brake: false,
        pitch: 0.1,
        roll: 0,
        yaw: 0,
        gear: false,
        flaps: false,
      }),
    ).toBe(true);
    let transform = {
      pos: [0, 1000, 0] as [number, number, number],
      rot: [0, 0, 0, 1] as [number, number, number, number],
    };
    let state = {
      ...initialAircraftState(),
      grounded: false,
      rpm: 1,
      velocity: [0, 0, 100] as [number, number, number],
    };
    const input = {
      engine: true,
      power: 0.8,
      brake: false,
      pitch: 0,
      roll: 0.1,
      yaw: 0,
      gear: false,
      flaps: true,
    };
    for (let i = 0; i < 600; i++) {
      const next = stepAircraft(transform, state, input, spec, 1 / 60, flat);
      transform = next.transform;
      state = next.state;
    }
    expect(state.crashed).toBe(false);
    expect(transform.pos[2]).toBeGreaterThan(500);
    expect(state.airspeed).toBeGreaterThan(65);
    expect(state.engines?.left?.thrust).toBeGreaterThan(10000);
    expect(state.engines?.right?.thrust).toBeGreaterThan(10000);
    expect(state.gearPosition).toBe(0);
    expect(state.flapPosition).toBe(1);
    expect(Math.abs(state.roll)).toBeGreaterThan(0.01);
  });
});

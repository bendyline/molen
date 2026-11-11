import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Transform } from '../src/component';
import { TrackNetwork } from '../src/track-network';
import {
  Coupled,
  consistOffsets,
  driveVehicle,
  initialVehicleState,
  installVehicles,
  Mountable,
  Mounted,
  mountEntity,
  refreshRailHeights,
  settleRailConsist,
  trailLength,
  VehicleInput,
  VehicleState,
  vehicleRotation,
} from '../src/vehicles';
import { World } from '../src/world';

/** Points every `step` meters from a to b. */
function line(a: [number, number], b: [number, number], step = 20): [number, number][] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(length / step));
  return Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
}

/**
 * A main line up the Z axis and a siding leaving it at z = 0 to the left (facing +Z, +X is
 * the left) that runs parallel 5 m over.
 */
function yard(): TrackNetwork {
  const network = new TrackNetwork();
  network.set('tile', [
    { points: line([0, -600], [0, 600]), tags: { name: 'main' } },
    {
      points: [[0, 0], [1.2, 30], [3.8, 60], [5, 90], ...line([5, 110], [5, 400]).slice(0)],
      tags: { name: 'siding', service: 'siding' },
    },
  ]);
  return network;
}

describe('TrackNetwork', () => {
  it('runs straight through a facing switch unless told to take the branch', () => {
    const network = yard();
    const start = { x: 0, z: -100, yaw: 0 };
    const straight = network.advance(start, 200, 0);
    expect(straight?.pose.x).toBeCloseTo(0, 6);
    expect(straight?.pose.z).toBeCloseTo(100, 6);
    expect(straight?.junction).toBe(true);
    expect(straight?.diverged).toBe(false);
    // There is no right-hand route here.
    expect(network.advance(start, 200, 1)?.pose.x).toBeCloseTo(0, 6);
    const left = network.advance(start, 250, -1);
    expect(left?.diverged).toBe(true);
    expect(left?.pose.x).toBeCloseTo(5, 3);
    expect(network.tagsAt(left?.pose ?? start)?.name).toBe('siding');
  });

  it('follows a trailing siding back onto the main line without a choice', () => {
    const network = yard();
    // Backing down the siding toward the switch (heading -Z).
    const on = network.advance({ x: 5, z: 300, yaw: Math.PI }, 400, 0);
    expect(on?.junction).toBe(false);
    expect(on?.pose.x).toBeCloseTo(0, 3);
    expect(on?.pose.z).toBeLessThan(0);
  });

  it('crosses tile seams and prefers the finer copy of a track', () => {
    const network = new TrackNetwork();
    // Two neighbouring tiles' copies overlap by a 30 m buffer; a coarse tile lies under both.
    network.set('a', [{ points: line([0, -400], [0, 15]), rank: 15 }]);
    network.set('b', [{ points: line([0, -15], [0, 400]), rank: 15 }]);
    network.set('coarse', [{ points: line([0.4, -800], [0.4, 800], 200), rank: 13 }]);
    const run = network.advance({ x: 0, z: -200, yaw: 0 }, 400, 0);
    expect(run?.moved).toBeCloseTo(400, 6);
    expect(run?.junction).toBe(false);
    expect(run?.pose.x).toBeCloseTo(0, 6);
    // Without the fine tiles the coarse copy carries the train.
    network.delete('a');
    network.delete('b');
    expect(network.advance({ x: 0, z: -200, yaw: 0 }, 400, 0)?.pose.x).toBeCloseTo(0.4, 6);
  });

  it('stops at the end of the track', () => {
    const network = yard();
    const end = network.advance({ x: 0, z: 500, yaw: 0 }, 300, 0);
    expect(end?.moved).toBeCloseTo(100, 6);
    expect(end?.pose.z).toBeCloseTo(600, 6);
    expect(network.snap({ x: 30, z: 0, yaw: 0 })).toBeUndefined();
  });
});

const LOCO: VehicleSpec = {
  label: 'Test locomotive',
  bodyStyle: 'locomotive',
  width: 3.1,
  length: 22,
  height: 4.7,
  centerOfMass: [0, 1.8, 0],
  wheelbase: 16,
  wheelTrack: 1.5,
  wheelRadius: 0.53,
  mass: 195_000,
  engineForce: 880_000,
  maxSpeed: 33,
  reverseSpeed: 33,
  brakeDeceleration: 0.6,
  maxSteer: 0,
  grip: 3,
  driverEye: [-0.7, 3.6, 8],
  steeringRate: 1,
  steeringFadeSpeed: 18,
  rollingResistance: 0.012,
  aerodynamicResistance: 3e-5,
  terrainAlignRate: 2,
  supportTolerance: 0.1,
  maxStepHeight: 0.4,
  maxSlope: 0.07,
  drive: 'all',
  rail: { truckCenters: 16, couplerLength: 22.3, power: 3.1e6, gauge: 1.435 },
};
const CAR: VehicleSpec = {
  ...LOCO,
  label: 'Test hopper',
  bodyStyle: 'freight-car',
  length: 17.5,
  wheelbase: 13,
  wheelRadius: 0.457,
  mass: 110_000,
  engineForce: 1,
  brakeDeceleration: 0.45,
  aerodynamicResistance: 1e-5,
  rail: { truckCenters: 13, couplerLength: 18, power: 0 },
};

function train(network: TrackNetwork, cars = 2) {
  const w = new World({ tickRate: 60 });
  const env = { groundHeight: () => 0, track: network };
  installVehicles(w, env);
  const specs = [LOCO, ...Array.from({ length: cars }, () => CAR)];
  const offsets = consistOffsets(specs);
  specs.forEach((spec, i) => {
    const id = i === 0 ? 'loco' : `car-${i}`;
    w.spawnRaw(
      {
        transform: { pos: [0, 0, -200 - (offsets[i] ?? 0)], rot: vehicleRotation(0) },
        vehicle: {
          kind: 'test',
          color: '#336699',
          spec,
          visual: { wheelNodes: ['a'], frontWheelNodes: ['a'], paintMaterial: 'p' },
        },
        vehicleState: initialVehicleState(0),
        vehicleInput: { throttle: 0, steering: 0, brake: true },
        ...(i === 0
          ? {
              mountable: {
                seats: [{ id: 'driver', role: 'driver', position: [-0.7, 3.6, 8] }],
                exits: [[2.5, 0, 8]],
                reach: 30,
              },
            }
          : {}),
      },
      id,
    );
    if (i > 0) w.set(id, Coupled, { leader: 'loco', offset: offsets[i] ?? 0 });
  });
  w.spawnRaw({ transform: { pos: [0, 0, -190], rot: [0, 0, 0, 1] } }, 'engineer');
  expect(settleRailConsist(w, 'loco', env)).toBe(true);
  expect(mountEntity(w, 'engineer', 'loco')).toBe(true);
  return { w, offsets };
}

function along(w: World, id: string): [number, number, number] {
  return w.get(id, Transform)?.pos ?? [Number.NaN, Number.NaN, Number.NaN];
}

describe('track-guided consists', () => {
  it('lays a trail and stands each car at its offset', () => {
    const { w, offsets } = train(yard());
    const trail = w.get('loco', VehicleState)?.track?.trail ?? [];
    expect(trailLength(trail)).toBeGreaterThan(offsets[2] ?? 0);
    expect(along(w, 'car-1')[2]).toBeCloseTo(-200 - (offsets[1] ?? 0), 3);
    expect(along(w, 'car-2')[2]).toBeCloseTo(-200 - (offsets[2] ?? 0), 3);
    expect(w.get('engineer', Mounted)?.vehicle).toBe('loco');
  });

  it('pulls away under power, keeps its cars on the rails and brakes to a stand', () => {
    const { w, offsets } = train(yard());
    for (let i = 0; i < 60 * 30; i++) {
      driveVehicle(w, 'engineer', { throttle: 1, steering: 0, brake: false });
      w.step();
    }
    const speed = w.get('loco', VehicleState)?.speed ?? 0;
    // A light engine and two loaded hoppers: about 9 to 14 m/s after half a minute.
    expect(speed).toBeGreaterThan(8);
    expect(speed).toBeLessThan(LOCO.maxSpeed);
    for (const id of ['loco', 'car-1', 'car-2']) expect(along(w, id)[0]).toBeCloseTo(0, 3);
    const gap = along(w, 'loco')[2] - along(w, 'car-2')[2];
    expect(gap).toBeCloseTo(offsets[2] ?? 0, 1);
    expect(w.get('car-2', VehicleState)?.speed).toBeCloseTo(speed, 6);
    // Opposing throttle brakes it to a stand, and it does not run away backwards.
    let reversedBeforeStop = false;
    for (let i = 0; i < 60 * 60; i++) {
      driveVehicle(w, 'engineer', { throttle: -1, steering: 0, brake: false });
      w.step();
      const v = w.get('loco', VehicleState)?.speed ?? 0;
      if (v < -0.5) reversedBeforeStop = true;
      if (v <= 0) break;
    }
    expect(reversedBeforeStop).toBe(false);
    expect(w.get('loco', VehicleState)?.speed ?? 1).toBeLessThanOrEqual(0.05);
  });

  it('takes the left route at a switch and its cars follow it across', () => {
    const { w } = train(yard());
    let seenSplit = false;
    for (let i = 0; i < 60 * 70; i++) {
      // Ask for the left-hand route once, then let go of the key.
      driveVehicle(w, 'engineer', { throttle: 0.6, steering: i < 30 ? -1 : 0, brake: false });
      w.step();
      const lead = along(w, 'loco');
      const last = along(w, 'car-2');
      // Head on the siding while the tail is still on the main line behind the switch.
      if (lead[0] > 0.5 && last[2] < 0 && Math.abs(last[0]) < 0.05) seenSplit = true;
      if (last[2] > 150) break;
    }
    expect(seenSplit).toBe(true);
    expect(along(w, 'car-2')[0]).toBeCloseTo(5, 1);
    expect(w.get('loco', VehicleState)?.track?.prefer).toBe(0);
  });

  it('stops against the end of the track', () => {
    const network = new TrackNetwork();
    network.set('t', [{ points: line([0, -400], [0, -120]) }]);
    const { w } = train(network);
    let hit = 0;
    w.on('vehicle-impact', () => {
      hit++;
    });
    for (let i = 0; i < 60 * 60; i++) {
      driveVehicle(w, 'engineer', { throttle: 1, steering: 0, brake: false });
      w.step();
    }
    expect(along(w, 'loco')[2]).toBeCloseTo(-120, 3);
    expect(w.get('loco', VehicleState)?.track?.ended).toBe(true);
    expect(w.get('loco', VehicleState)?.speed).toBe(0);
    expect(hit).toBe(1);
  });
});

describe('rail heights from streamed terrain', () => {
  it('holds a standing train and ignores a spike in the map heights', () => {
    let spike = true;
    // A 5 m bump under the head, as coarse terrain gives before finer tiles arrive.
    const ground = (_x: number, z: number): number => (spike && z > -205 ? 5 : 0);
    const w = new World({ tickRate: 60 });
    const env = { groundHeight: ground, track: yard() };
    installVehicles(w, env);
    const offsets = consistOffsets([LOCO, CAR]);
    [LOCO, CAR].forEach((spec, i) => {
      w.spawnRaw(
        {
          transform: { pos: [0, 0, -200 - (offsets[i] ?? 0)], rot: vehicleRotation(0) },
          vehicle: {
            kind: 'test',
            color: '#336699',
            spec,
            visual: { wheelNodes: ['a'], frontWheelNodes: ['a'], paintMaterial: 'p' },
          },
          vehicleState: initialVehicleState(0),
          vehicleInput: { throttle: 0, steering: 0, brake: false },
          ...(i === 0
            ? {
                mountable: {
                  seats: [{ id: 'driver', role: 'driver', position: [-0.7, 3.6, 8] }],
                  exits: [[2.5, 0, 8]],
                  reach: 30,
                },
              }
            : {}),
        },
        i === 0 ? 'loco' : 'car-1',
      );
    });
    w.set('car-1', Coupled, { leader: 'loco', offset: offsets[1] ?? 0 });
    w.spawnRaw({ transform: { pos: [0, 0, -190], rot: [0, 0, 0, 1] } }, 'engineer');
    expect(settleRailConsist(w, 'loco', env)).toBe(true);
    expect(mountEntity(w, 'engineer', 'loco')).toBe(true);
    for (let i = 0; i < 600; i++) {
      driveVehicle(w, 'engineer', { throttle: 0, steering: 0, brake: false });
      w.step();
    }
    // Neither the bump nor the shut throttle moves it.
    expect(w.get('loco', VehicleState)?.speed).toBe(0);
    expect(Math.abs(w.get('loco', VehicleState)?.pitch ?? 1)).toBeLessThanOrEqual(0.06);
    // The finer terrain arrives: the trail and the car come down onto it.
    spike = false;
    expect(refreshRailHeights(w, 'loco', env)).toBe(true);
    expect(along(w, 'loco')[1]).toBeCloseTo(0, 6);
    expect(along(w, 'car-1')[1]).toBeCloseTo(0, 6);
    expect(refreshRailHeights(w, 'loco', env)).toBe(false);
  });
});

describe('locked rail vehicles without a guide', () => {
  it.each([
    ['no track guide', undefined],
    ['no track under them', yard()],
  ])('still drive with the car solver: %s', (_name, track) => {
    const w = new World({ tickRate: 60 });
    installVehicles(w, {
      groundHeight: () => 0,
      ...(track ? { track } : {}),
    });
    w.spawnRaw(
      {
        transform: { pos: [300, 0, 0], rot: vehicleRotation(0) },
        vehicle: {
          kind: 'test',
          color: '#336699',
          spec: LOCO,
          visual: { wheelNodes: ['a'], frontWheelNodes: ['a'], paintMaterial: 'p' },
        },
        vehicleState: initialVehicleState(0),
        vehicleInput: { throttle: 0, steering: 0, brake: true },
        mountable: {
          seats: [{ id: 'driver', role: 'driver', position: [0, 3, 0] }],
          exits: [[3, 0, 0]],
          reach: 5,
        },
      },
      'loco',
    );
    w.spawnRaw({ transform: { pos: [300, 0, 1], rot: [0, 0, 0, 1] } }, 'engineer');
    expect(mountEntity(w, 'engineer', 'loco')).toBe(true);
    for (let i = 0; i < 120; i++) {
      w.set('loco', VehicleInput, { throttle: 1, steering: 0, brake: false });
      w.step();
    }
    expect(w.get('loco', VehicleState)?.track).toBeUndefined();
    expect(w.get('loco', Mountable)).toBeDefined();
    expect(along(w, 'loco')[2]).toBeGreaterThan(0);
  });
});

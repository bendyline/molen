import { Vehicle } from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EarthAircraft } from '../src/client/aircraft';
import { EarthVehicles } from '../src/client/vehicles';
import { ENTITY_TYPES } from './entity-types';

const P51 = 'molen.entities.aircraft.p51d';
const OH6 = 'molen.entities.aircraft.oh6';

/** Flat ground at 12 m, a vehicles world, and aircraft sharing it. */
function setup() {
  const root = new THREE.Group();
  const vehicles = new EarthVehicles({
    root,
    sampleHeight: () => 12,
    loadModel: async () => new THREE.Group(),
    types: ENTITY_TYPES,
  });
  const aircraft = new EarthAircraft({
    world: vehicles.world,
    root,
    sampleHeight: () => 12,
    loadModel: async () => {
      throw new Error('no models in unit tests');
    },
    types: ENTITY_TYPES,
    vehicleEnvironment: vehicles.environment,
  });
  const fly = (seconds: number, controls = {}) => {
    for (let t = 0; t < seconds; t += 1 / 30) {
      aircraft.input(1 / 30, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false, ...controls });
      vehicles.update(1 / 30, { throttle: 0, steering: 0, brake: true });
    }
  };
  return { root, vehicles, aircraft, fly };
}

describe('earth aircraft', () => {
  it('lists the flyable types in the entities pack', () => {
    expect(EarthAircraft.typeIds(ENTITY_TYPES)).toEqual([P51, OH6]);
    expect(EarthVehicles.typeIds(ENTITY_TYPES)).toContain('molen.entities.vehicle.sedan');
  });

  it('starts a P-51 in flight along the requested compass heading', () => {
    const { aircraft, fly } = setup();
    const id = aircraft.spawn(P51, {
      position: [0, 312, 0],
      heading: Math.PI / 2,
      airborne: {},
    });
    expect(aircraft.board(id)).toBe(true);
    fly(2);
    const status = aircraft.status();
    expect(status?.label).toMatch(/Mustang|P-51/);
    expect(status?.grounded).toBe(false);
    expect(status?.crashed).toBe(false);
    expect(status?.engine).toBe(true);
    expect(status?.gearDown).toBe(false);
    expect(status?.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(status?.airspeed).toBeGreaterThan(55);
    expect(status?.altitudeAGL).toBeGreaterThan(240);
    // East is +X in the Earth frame: two seconds at ~70 m/s.
    const position = aircraft.position as [number, number, number];
    expect(position[0]).toBeGreaterThan(110);
    expect(Math.abs(position[2])).toBeLessThan(20);
  });

  it('climbs on back pressure and adds power with the throttle lever', () => {
    const { aircraft, fly } = setup();
    aircraft.board(aircraft.spawn(P51, { position: [0, 512, 0], heading: 0, airborne: {} }));
    const power = aircraft.status()?.power ?? 0;
    fly(1.5, { pitch: 1, throttle: 1 });
    const status = aircraft.status();
    expect(status?.verticalSpeed).toBeGreaterThan(1);
    expect(status?.power).toBeGreaterThan(power);
    // Heading north: -Z.
    expect((aircraft.position as number[])[2]).toBeLessThan(-60);
  });

  it('refuses a normal exit in the air, and release removes the spawned aircraft', () => {
    const { vehicles, aircraft, fly } = setup();
    const id = aircraft.spawn(OH6, { position: [100, 212, 100], heading: 0, airborne: {} });
    expect(aircraft.board(id)).toBe(true);
    fly(0.5);
    expect(aircraft.exit()).toBeUndefined();
    expect(aircraft.message).toMatch(/Land/);
    const ground = aircraft.release();
    expect(ground?.[1]).toBe(12);
    expect(aircraft.mountedId).toBeUndefined();
    expect(vehicles.world.exists(id)).toBe(false);
  });

  it('parks on the ground with the engine off and lets the pilot step out', () => {
    const { aircraft, fly } = setup();
    const id = aircraft.spawn(P51, { position: [0, 12, 0], heading: 0 });
    expect(aircraft.board(id)).toBe(true);
    fly(0.5);
    const status = aircraft.status();
    expect(status?.grounded).toBe(true);
    expect(status?.engine).toBe(false);
  });
});

describe('spawned cars', () => {
  it('finds open ground beside a structure instead of parking on it', () => {
    const root = new THREE.Group();
    // A 20 m landmark block standing where the car was asked to start.
    const block = new THREE.Mesh(new THREE.BoxGeometry(24, 20, 24), new THREE.MeshBasicMaterial());
    block.position.set(0, 10 + 10, 0);
    root.add(block);
    root.updateMatrixWorld(true);
    const vehicles = new EarthVehicles({
      root,
      sampleHeight: () => 10,
      loadModel: async () => new THREE.Group(),
      types: ENTITY_TYPES,
    });
    const id = vehicles.spawnNear('molen.entities.vehicle.sedan', 0, 0, 0) as string;
    expect(id).toBeDefined();
    const pos = vehicles.world.get(id, Transform)?.pos as [number, number, number];
    expect(pos[1]).toBe(10);
    // Clear of the block's 12 m half-width plus the car.
    expect(Math.max(Math.abs(pos[0]), Math.abs(pos[2]))).toBeGreaterThan(12);
  });

  it('settles a standing car onto finer ground that streams in after it was added', () => {
    const root = new THREE.Group();
    let ground = 10;
    const vehicles = new EarthVehicles({
      root,
      sampleHeight: () => ground,
      loadModel: async () => new THREE.Group(),
      types: ENTITY_TYPES,
    });
    const id = vehicles.spawn('molen.entities.vehicle.sedan', [0, 10, 0], 0) as string;
    ground = 14.5;
    vehicles.update(1 / 30, { throttle: 0, steering: 0, brake: true });
    expect(vehicles.world.get(id, Transform)?.pos[1]).toBeCloseTo(14.5, 6);
  });

  it('adds a car, seats the driver without walking to it, and removes it on release', () => {
    const { vehicles } = setup();
    const id = vehicles.spawn('molen.entities.vehicle.sedan', [50, 12, 50], Math.PI / 2);
    expect(id).toBeDefined();
    expect(vehicles.board(id as string)).toBe(true);
    expect(vehicles.mountedId).toBe(id);
    expect(vehicles.heading).toBeCloseTo(Math.PI / 2, 6);
    for (let i = 0; i < 60; i++)
      vehicles.update(1 / 30, { throttle: 1, steering: 0, brake: false });
    expect(vehicles.speed).toBeGreaterThan(2);
    expect((vehicles.position as number[])[0]).toBeGreaterThan(50);
    // Survives a sync that no longer sees it on any tile.
    vehicles.sync(performance.now() + 10_000);
    expect(vehicles.world.has(id as string, Vehicle)).toBe(true);
    const at = vehicles.release();
    expect(at?.[0]).toBeGreaterThan(50);
    expect(vehicles.mountedId).toBeUndefined();
    expect(vehicles.world.exists(id as string)).toBe(false);
  });
});

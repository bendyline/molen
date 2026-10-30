import { createParkedVehicleBatch, isParkedVehicleHidden } from '@bendyline/molen-client/vehicles';
import { VehicleState } from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import type { VehicleData, VehiclePlacement } from '@bendyline/molen-schema';
import { tagTerrainObject } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EarthVehicles } from '../src/client/vehicles';
import { ENTITY_TYPES } from './entity-types';

function setup() {
  const root = new THREE.Group(),
    tile = new THREE.Group();
  const kind = 'molen.entities.vehicle.sedan';
  const placements: VehiclePlacement[] = [
    {
      id: 'car',
      kind,
      color: '#566d82',
      spec: ENTITY_TYPES.component<VehicleData>(kind, 'vehicle').spec,
      position: [1000, 0, 2000],
      yaw: 0,
    },
  ];
  tile.userData.vehicles = placements;
  tagTerrainObject('parked-vehicles', tile);
  tile.position.set(1000, 0, 2000);
  tile.add(createParkedVehicleBatch(placements, [1000, 2000]));
  root.add(tile);
  const vehicles = new EarthVehicles({
    root: root,
    sampleHeight: () => 0,
    loadModel: async () => new THREE.Group(),
    types: ENTITY_TYPES,
  });
  vehicles.sync(0);
  return { root, tile, placements, vehicles };
}
describe('earth vehicles', () => {
  it('refreshes parked support after streaming changes and aligns both axles to the road', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const root = new THREE.Group();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2));
    road.position.y = 0.3;
    root.add(road);
    const vehicles = new EarthVehicles({
      root,
      sampleHeight: () => 0,
      loadModel: async () => new THREE.Group(),
      types: ENTITY_TYPES,
    });
    try {
      const id = vehicles.spawn('molen.entities.vehicle.sedan', [0, 0.3, 0], 0);
      expect(id).toBeDefined();
      await Promise.resolve();
      // Replace the old level road with a sloping one while nobody is driving.
      road.rotation.x = 0.1;
      road.position.y = 0.18;
      vi.advanceTimersByTime(250);
      vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
      const t = vehicles.world.get(id as string, Transform);
      const state = vehicles.world.get(id as string, VehicleState);
      expect(t?.pos[1]).toBeCloseTo(0.18, 5);
      expect(state?.pitch).toBeCloseTo(0.1, 5);
      expect(state?.roll).toBeCloseTo(0, 5);
      expect(vehicles.object.children[0]?.position.y).toBeCloseTo(0.18, 5);
    } finally {
      vehicles.dispose();
      vi.useRealTimers();
    }
  });

  it('drives across source-height dips while staying on the displayed road', async () => {
    const { createTerrainPyramidStream } = await import('@bendyline/molen-terrain/client');
    const { Heightfield } = await import('@bendyline/molen-terrain/kernel');
    const field = new Heightfield(
      Float32Array.from({ length: 81 }, (_, i) => (Math.floor(i / 9) % 2 === 0 ? 1 : 0)),
      9,
      9,
      { origin: [0, 0], worldSize: [256, 256], height: { min: 0, max: 10 } },
    );
    const stream = createTerrainPyramidStream(
      {
        name: 'driving-dips',
        origin: [0, 0],
        rootSize: 256,
        minLevel: 0,
        maxLevel: 0,
        tileResolution: 9,
        height: { min: 0, max: 10 },
        layers: [],
        skirts: false,
      },
      { load: async () => field },
      {
        initialView: { position: [96, 20, 64], verticalFov: Math.PI / 2, viewportHeight: 900 },
        maxSurfaceTileResolution: 3,
        maxScreenSpaceError: 10000,
        maxSelectedTiles: 4,
        maxResidentTiles: 8,
        maxConcurrentLoads: 4,
        viewDistance: 500,
      },
    );
    await stream.whenIdle();
    const root = stream.object;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(256, 256).rotateX(-Math.PI / 2));
    road.position.set(128, 10.3, 128);
    root.add(road);
    const vehicles = new EarthVehicles({
      root,
      sampleHeight: (x, z) => stream.sampleSurfaceHeight(x, z),
      loadModel: async () => new THREE.Group(),
      types: ENTITY_TYPES,
    });
    try {
      expect(stream.sampleHeight(96, 32)).toBe(0);
      expect(stream.sampleSurfaceHeight(96, 32)).toBe(10);
      const id = vehicles.spawn('molen.entities.vehicle.sedan', [96, 10.3, 8], 0);
      expect(id).toBeDefined();
      expect(vehicles.board(id as string)).toBe(true);
      for (let i = 0; i < 480; i++) {
        vehicles.update(1 / 60, { throttle: 1, steering: 0, brake: false });
        expect(vehicles.world.get(id as string, Transform)?.pos[1]).toBeCloseTo(10.3, 4);
      }
      expect(vehicles.world.get(id as string, Transform)?.pos[2]).toBeGreaterThan(70);
    } finally {
      vehicles.dispose();
      stream.dispose();
    }
  });

  it('unloads a borrowed car model after walking away while preserving its simulation state', async () => {
    const { tile, vehicles } = setup();
    vehicles.sync(300, [1000, 1.7, 2004]);
    await Promise.resolve();
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    vehicles.release();
    vehicles.sync(performance.now() + 1000, [2000, 2, 3000]);
    expect(vehicles.object.children).toHaveLength(0);
    expect(vehicles.world.exists('car')).toBe(true);
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.Mesh;
    expect(isParkedVehicleHidden(mesh, 0)).toBe(true);
    vehicles.sync(performance.now() + 2000, [1000, 1.7, 2004]);
    await Promise.resolve();
    expect(vehicles.object.children).toHaveLength(1);
    vehicles.dispose();
  });
  it('loads the same cabin GLB on approach, retains it on boarding, and demotes unvisited cars', async () => {
    const { tile, vehicles } = setup();
    vehicles.sync(300, [1000, 1.7, 2004]);
    await Promise.resolve();
    const cabinModel = vehicles.object.children[0];
    expect(cabinModel).toBeDefined();
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.Mesh;
    expect(isParkedVehicleHidden(mesh, 0)).toBe(true);
    vehicles.sync(performance.now() + 1000, [2000, 2, 3000]);
    expect(vehicles.object.children).toHaveLength(0);
    expect(isParkedVehicleHidden(mesh, 0)).toBe(false);
    vehicles.sync(performance.now() + 2000, [1000, 1.7, 2004]);
    await Promise.resolve();
    const reloaded = vehicles.object.children[0];
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    expect(vehicles.object.children[0]).toBe(reloaded);
    vehicles.view = 'chase';
    vehicles.sync(performance.now() + 3000, [2000, 2, 3000]);
    expect(vehicles.object.children[0]).toBe(reloaded);
    vehicles.dispose();
  });

  it('disposes an in-flight detail load after the host is disposed', async () => {
    const { root, tile, vehicles: original } = setup();
    original.dispose();
    let finish: (model: THREE.Object3D) => void = () => {};
    const vehicles = new EarthVehicles({
      root: root,
      sampleHeight: () => 0,
      loadModel: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      types: ENTITY_TYPES,
    });
    vehicles.sync(0, [1000, 1.7, 2004]);
    vehicles.dispose();
    const model = new THREE.Group();
    finish(model);
    await Promise.resolve();
    expect(model.parent).toBeNull();
    expect(vehicles.object.children).toHaveLength(0);
    expect(root.children).toContain(tile);
  });
  it('makes parked cars entities only near the observer, and reclaims them behind it', () => {
    const { vehicles } = setup();
    vehicles.world.destroy('car');
    vehicles.sync(300, [5000, 150, 2000]);
    expect(vehicles.world.exists('car')).toBe(false);
    vehicles.sync(600, [1100, 150, 2000]);
    expect(vehicles.world.exists('car')).toBe(true);
    vehicles.sync(900, [1000 + 300 * 1.25, 150, 2000]);
    expect(vehicles.world.exists('car')).toBe(false);
    vehicles.dispose();
  });
  it('promotes a real parked entity, drives, survives tile eviction/reload, and exits', () => {
    const { root, tile, placements, vehicles } = setup();
    expect(vehicles.world.exists('car')).toBe(true);
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    // Bendy Sedan driver eye (0.4186, 1.13, -0.1) relative to the parked car at x 1000, z 2000.
    expect(vehicles.cameraPose()?.position[0]).toBeCloseTo(1000.4186);
    for (let i = 0; i < 120; i++)
      vehicles.update(1 / 60, { throttle: 1, steering: 0, brake: false });
    expect(vehicles.world.get('car', Transform)?.pos[2]).toBeGreaterThan(2006);
    root.remove(tile);
    vehicles.sync(performance.now() + 1000);
    expect(vehicles.world.exists('car')).toBe(true);
    tile.clear();
    tile.add(createParkedVehicleBatch(placements, [1000, 2000]));
    root.add(tile);
    vehicles.sync(performance.now() + 2000);
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.Mesh;
    expect(isParkedVehicleHidden(mesh, 0)).toBe(true);
    expect(vehicles.exit()).toBeUndefined();
    for (let i = 0; i < 120; i++)
      vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
    const feet = vehicles.exit();
    expect(feet).toBeDefined();
    expect(vehicles.mountedId).toBeUndefined();
    expect(vehicles.world.get('car', Transform)?.pos[2]).toBeGreaterThan(2006);
  });
  it('reclaims unmodified streamed entities and handles duplicate tiles and floating origin', () => {
    const { root, tile, placements, vehicles } = setup();
    const copy = new THREE.Group();
    copy.userData.vehicles = placements;
    tagTerrainObject('parked-vehicles', copy);
    copy.position.copy(tile.position);
    copy.add(createParkedVehicleBatch(placements, [1000, 2000]));
    root.add(copy);
    vehicles.sync(300);
    expect(vehicles.world.query({ name: 'vehicle' }).count()).toBe(1);
    root.position.set(-1000, 0, -2000);
    root.updateMatrixWorld(true);
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    expect(vehicles.cameraPose()?.position[2]).toBeCloseTo(1999.9);
    vehicles.dispose();
    const other = setup();
    other.root.remove(other.tile);
    other.vehicles.sync(500);
    expect(other.vehicles.world.exists('car')).toBe(false);
  });
  it('matches fixed-step motion across rendering frame rates and clips chase views at walls', () => {
    const a = setup().vehicles,
      b = setup().vehicles;
    a.enter([998.5, 1.7, 2000]);
    b.enter([998.5, 1.7, 2000]);
    for (let i = 0; i < 120; i++) a.update(1 / 60, { throttle: 1, steering: 0.2, brake: false });
    for (let i = 0; i < 60; i++) b.update(1 / 30, { throttle: 1, steering: 0.2, brake: false });
    expect(a.world.get('car', Transform)).toEqual(b.world.get('car', Transform));
    expect(a.world.get('car', VehicleState)).toEqual(b.world.get('car', VehicleState));
    a.view = 'chase';
    expect(a.cameraPose()?.position[1]).toBeGreaterThan(2);
  });
});

it('blocks the chassis against buildings and prevents a chase camera from passing through a wall', () => {
  // The collision tree rescans the scene at most every 200 ms while the car stays put.
  vi.useFakeTimers({ toFake: ['performance'] });
  try {
    const { root, vehicles } = setup();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.4), new THREE.MeshBasicMaterial());
    wall.position.set(1000, 2, 2010);
    root.add(wall);
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    for (let i = 0; i < 300; i++)
      vehicles.update(1 / 60, { throttle: 1, steering: 0, brake: false });
    expect(vehicles.world.get('car', Transform)?.pos[2]).toBeLessThan(2007.6);
    expect(vehicles.speed).toBe(0);
    const rearWall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 4, 0.4),
      new THREE.MeshBasicMaterial(),
    );
    rearWall.position.set(1000, 2, (vehicles.world.get('car', Transform)?.pos[2] ?? 0) - 3);
    root.add(rearWall);
    vi.advanceTimersByTime(250);
    vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
    vehicles.view = 'chase';
    const pose = vehicles.cameraPose();
    expect(pose?.position[2]).toBeGreaterThan(rearWall.position.z);
  } finally {
    vi.useRealTimers();
  }
});

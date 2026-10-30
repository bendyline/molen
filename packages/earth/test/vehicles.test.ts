import { AmbientAgent, agentRotation, installAmbient } from '@bendyline/molen-ambient/kernel';
import { createParkedVehicleBatch, isParkedVehicleHidden } from '@bendyline/molen-client/vehicles';
import { VehicleInput, VehicleState } from '@bendyline/molen-kernel/vehicles';
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
const SEDAN = 'molen.entities.vehicle.sedan';
const TRAFFIC = 'ambient:car:1';
/**
 * A sedan in traffic 20 m north of the parked one, heading +x, as ambient life leaves it (no
 * ambient systems run): returns a walker's eye at its front left door.
 */
function traffic(vehicles: EarthVehicles, speed = 0): [number, number, number] {
  vehicles.world.spawnRaw(
    {
      ambientAgent: {
        kind: 'car',
        type: SEDAN,
        color: '#8c1f1f',
        lane: 'lane',
        s: 12,
        speed,
        seed: 1,
        length: 4.65,
        width: 1.82,
        state: speed > 0 ? 'move' : 'wait',
        since: 0,
        hops: 0,
        spawnedTick: 0,
      },
      transform: { pos: [1000, 0, 2020], rot: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
      renderable: { kind: 'ambient-vehicle', ref: SEDAN },
    },
    TRAFFIC,
  );
  // Facing +x, the car's left is -z.
  return [1000, 1.7, 2018.5];
}
describe('earth vehicles', () => {
  it('promotes parked cars across the street and keeps detail through the hysteresis band', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const { tile, vehicles } = setup();
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.Mesh;
    try {
      vehicles.sync(300, [1000, 1.7, 2050]);
      await Promise.resolve();
      expect(vehicles.object.children).toHaveLength(0);
      vehicles.sync(600, [1000, 1.7, 2035]);
      await Promise.resolve();
      const model = vehicles.object.children[0];
      expect(model).toBeDefined();
      expect(isParkedVehicleHidden(mesh, 0)).toBe(true);
      vehicles.sync(900, [1000, 1.7, 2055]);
      expect(vehicles.object.children[0]).toBe(model);
      vehicles.sync(1200, [1000, 1.7, 2070]);
      expect(vehicles.object.children).toHaveLength(0);
      expect(isParkedVehicleHidden(mesh, 0)).toBe(false);
      vehicles.sync(1500, [1000, 1.7, 2055]);
      await Promise.resolve();
      expect(vehicles.object.children).toHaveLength(0);
    } finally {
      vehicles.dispose();
      vi.useRealTimers();
    }
  });

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
  it('opens the door beside the walker before boarding and shuts it behind them', () => {
    const { vehicles } = setup();
    const door = (name: string) => vehicles.world.get('car', VehicleState)?.actuators?.[name] ?? 0;
    const settle = () => {
      for (let i = 0; i < 90; i++)
        vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
    };
    // The parked sedan faces +z, so a walker at lower x stands on its right.
    const right: [number, number, number] = [998.5, 1.7, 2000];
    expect(vehicles.closedDoor('car', right)).toBe('doorFrontRight');
    expect(vehicles.closedDoor('car', [1001.5, 1.7, 2000])).toBe('doorFrontLeft');
    expect(vehicles.openDoor(right)).toBe(true);
    expect(vehicles.mountedId).toBeUndefined();
    expect(vehicles.closedDoor('car', right)).toBeUndefined();
    expect(vehicles.openDoor(right)).toBe(false);
    settle();
    expect(door('doorFrontRight')).toBe(1);
    expect(door('doorFrontLeft')).toBe(0);
    expect(vehicles.enter(right)).toBe(true);
    settle();
    expect(door('doorFrontRight')).toBe(0);
    const feet = vehicles.exit();
    expect(feet).toBeDefined();
    const [x, y, z] = feet as [number, number, number];
    expect(vehicles.openDoor([x, y + 1.7, z], 'car')).toBe(true);
    settle();
    expect(door('doorFrontLeft')).toBe(1);
    // Still beside the car, the door stays open; walking off shuts it.
    vehicles.sync(performance.now() + 1000, [x, y + 1.7, z]);
    expect(vehicles.closedDoor('car', [x, y + 1.7, z])).toBeUndefined();
    vehicles.sync(performance.now() + 2000, [1010, 1.7, 2000]);
    settle();
    expect(door('doorFrontLeft')).toBe(0);
    vehicles.dispose();
  });
  it('takes over a stopped traffic car: its type and paint, the agent gone as its model shows', async () => {
    const { vehicles } = setup();
    const walker = traffic(vehicles, 3);
    expect(vehicles.nearest(walker)).toBeUndefined();
    expect(vehicles.openDoor(walker)).toBe(false);
    vehicles.world.patch(TRAFFIC, AmbientAgent, { speed: 0.2 });
    expect(vehicles.nearest(walker)).toBe(TRAFFIC);
    expect(vehicles.label(TRAFFIC)).toBe('Bendy Sedan');
    expect(vehicles.closedDoor(TRAFFIC, walker)).toBe('doorFrontLeft');
    expect(vehicles.openDoor(walker)).toBe(true);
    const car = vehicles.nearest(walker) as string;
    expect(car).not.toBe(TRAFFIC);
    // Until the drivable car's model shows, the traffic car stays, held behind its replacement.
    expect(vehicles.world.exists(TRAFFIC)).toBe(true);
    const solids = vehicles.trafficSolids();
    expect(solids).toHaveLength(3);
    for (const solid of solids) {
      expect(solid.z).toBeCloseTo(2020);
      expect(Math.abs(solid.x - 1000) + solid.radius).toBeLessThanOrEqual(4.65 / 2 + 1e-9);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vehicles.world.exists(TRAFFIC)).toBe(false);
    expect(vehicles.world.get(car, { name: 'vehicle' })).toMatchObject({
      kind: SEDAN,
      color: '#8c1f1f',
    });
    expect(vehicles.world.get(car, Transform)?.pos).toEqual([1000, 0, 2020]);
    expect(vehicles.world.get(car, VehicleState)?.yaw).toBeCloseTo(Math.PI / 2);
    expect(vehicles.world.get(car, VehicleInput)?.actuators).toEqual({ doorFrontLeft: true });
    expect(vehicles.enter(walker)).toBe(true);
    expect(vehicles.mountedId).toBe(car);
    expect(vehicles.trafficSolids()).toEqual([]);
    vehicles.dispose();
  });
  it('returns a taken car nobody drove to traffic out of model range, and leaves a driven one parked', async () => {
    const { vehicles } = setup();
    const walker = traffic(vehicles);
    expect(vehicles.openDoor(walker)).toBe(true);
    const car = vehicles.nearest(walker) as string;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vehicles.world.exists(TRAFFIC)).toBe(false);
    vehicles.sync(performance.now() + 1000, [1000, 1.7, 2200]);
    expect(vehicles.world.exists(car)).toBe(false);
    expect(vehicles.world.get(TRAFFIC, AmbientAgent)).toMatchObject({
      type: SEDAN,
      color: '#8c1f1f',
      lane: 'lane',
      s: 12,
      speed: 0,
      state: 'wait',
    });
    expect(vehicles.world.get(TRAFFIC, Transform)?.pos).toEqual([1000, 0, 2020]);
    expect(vehicles.trafficSolids()).toEqual([]);
    // One press boards it; driven off and left, it stays parked and traffic yields to it.
    expect(vehicles.enter(walker)).toBe(true);
    const driven = vehicles.mountedId as string;
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 60; i++)
      vehicles.update(1 / 60, { throttle: 1, steering: 0, brake: false });
    for (let i = 0; i < 120; i++)
      vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
    expect(vehicles.exit()).toBeDefined();
    vehicles.sync(performance.now() + 3000, [1000, 1.7, 2200]);
    expect(vehicles.world.exists(driven)).toBe(true);
    expect(vehicles.world.exists(TRAFFIC)).toBe(false);
    expect(vehicles.trafficSolids()).toHaveLength(3);
    vehicles.dispose();
  });
  it('keeps the queue behind a taken traffic car clear of it, and lets it go once driven away', async () => {
    const { vehicles } = setup();
    const ambient = installAmbient(vehicles.world, { classes: ['car'] });
    ambient.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          oneway: true,
          lanes: 2,
          speed: 12,
          points: [
            [900, 2020],
            [1300, 2020],
          ],
        },
      ],
    });
    // The lane nearer -z (the taken car's left, facing +x) and the one beside it.
    const [lane, next] = [...ambient.network.laneIds()]
      .map((id) => ({ id, z: ambient.network.sampleLane(id, 100)?.z ?? 0 }))
      .sort((a, b) => a.z - b.z);
    if (!lane || !next) throw new Error('Missing test lanes');
    const agent = (id: string, laneId: string, s: number, speed: number, type = 'proxy') => {
      const sample = ambient.network.sampleLane(laneId, s);
      if (!sample) throw new Error('Missing lane sample');
      vehicles.world.spawnRaw(
        {
          ambientAgent: {
            kind: 'car',
            type,
            color: '#8c1f1f',
            lane: laneId,
            s,
            speed,
            seed: 1,
            length: type === SEDAN ? 4.65 : 4,
            width: type === SEDAN ? 1.82 : 2,
            state: speed > 0 ? 'move' : 'wait',
            since: 0,
            hops: 0,
            spawnedTick: 0,
          },
          transform: { pos: [sample.x, sample.y, sample.z], rot: agentRotation(sample, true) },
        },
        id,
      );
    };
    agent('leader', lane.id, 100, 0, SEDAN);
    agent('follower', lane.id, 100 - 4.65 / 2 - 2 - 2, 0);
    agent('beside', next.id, 80, 8);
    const at = (id: string) => vehicles.world.get(id, Transform)?.pos[0] ?? Number.NaN;
    const leaderX = at('leader');
    // The walker stands at the leader's front door, holding it (and so the queue) up.
    const walker: [number, number, number] = [leaderX + 1.2, 1.7, lane.z - 1];
    const frames = (n: number, throttle = 0) => {
      for (let i = 0; i < n; i++) {
        ambient.setSolids([
          ...(vehicles.mountedId ? [] : [{ x: walker[0], z: walker[2], radius: 0.5 }]),
          ...vehicles.trafficSolids(),
        ]);
        vehicles.update(1 / 60, { throttle, steering: 0, brake: throttle === 0 });
      }
    };
    frames(30);
    const followerX = at('follower');
    expect(at('leader')).toBeCloseTo(leaderX);
    expect(vehicles.openDoor(walker)).toBe(true);
    const car = vehicles.nearest(walker) as string;
    frames(30);
    expect(at('leader')).toBeCloseTo(leaderX);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vehicles.world.exists('leader')).toBe(false);
    frames(180);
    // Gone from the lane, the leader's replacement still holds the follower at its gap.
    expect(at('follower')).toBeCloseTo(followerX, 1);
    expect(at('follower') + 2).toBeLessThan(at(car) - 4.65 / 2);
    // The next lane flows past it.
    expect(at('beside') - 2).toBeGreaterThan(at(car) + 4.65 / 2);
    expect(vehicles.enter(walker)).toBe(true);
    frames(240, 1);
    expect(at(car)).toBeGreaterThan(leaderX + 10);
    expect(at('follower')).toBeGreaterThan(followerX + 5);
    expect(at('follower') + 2).toBeLessThan(at(car) - 4.65 / 2);
    vehicles.dispose();
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

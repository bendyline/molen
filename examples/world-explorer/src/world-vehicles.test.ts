import { createParkedVehicleBatch } from '@bendyline/molen-client/vehicles';
import { getMolenVehicle } from '@bendyline/molen-entities';
import { Transform } from '@bendyline/molen-kernel';
import { VehicleState } from '@bendyline/molen-kernel/vehicles';
import type { VehiclePlacement } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WorldVehicles } from './world-vehicles';

function setup() {
  const root = new THREE.Group(),
    tile = new THREE.Group();
  const kind = 'molen.entities.vehicle.sedan';
  const placements: VehiclePlacement[] = [
    {
      id: 'car',
      kind,
      color: '#566d82',
      spec: getMolenVehicle(kind).spec,
      position: [1000, 0, 2000],
      yaw: 0,
    },
  ];
  tile.userData.vehicles = placements;
  tile.position.set(1000, 0, 2000);
  tile.add(createParkedVehicleBatch(placements, [1000, 2000]));
  root.add(tile);
  const vehicles = new WorldVehicles(
    root,
    () => 0,
    async () => new THREE.Group(),
  );
  vehicles.sync(0);
  return { root, tile, placements, vehicles };
}
describe('world vehicle integration', () => {
  it('loads the same cabin GLB on approach, retains it on boarding, and demotes unvisited cars', async () => {
    const { tile, vehicles } = setup();
    vehicles.sync(300, [1000, 1.7, 2004]);
    await Promise.resolve();
    const cabinModel = vehicles.object.children[0];
    expect(cabinModel).toBeDefined();
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[5]).toBe(0);
    vehicles.sync(performance.now() + 1000, [2000, 2, 3000]);
    expect(vehicles.object.children).toHaveLength(0);
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[5]).not.toBe(0);
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
    const vehicles = new WorldVehicles(
      root,
      () => 0,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vehicles.sync(0, [1000, 1.7, 2004]);
    vehicles.dispose();
    const model = new THREE.Group();
    finish(model);
    await Promise.resolve();
    expect(model.parent).toBeNull();
    expect(vehicles.object.children).toHaveLength(0);
    expect(root.children).toContain(tile);
  });
  it('promotes a real parked entity, drives, survives tile eviction/reload, and exits', () => {
    const { root, tile, placements, vehicles } = setup();
    expect(vehicles.world.exists('car')).toBe(true);
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    expect(vehicles.cameraPose()?.position[0]).toBeCloseTo(1000.4);
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
    const mesh = (tile.children[0] as THREE.Group).children[0] as THREE.InstancedMesh,
      matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[5]).toBe(0);
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
    copy.position.copy(tile.position);
    copy.add(createParkedVehicleBatch(placements, [1000, 2000]));
    root.add(copy);
    vehicles.sync(300);
    expect(vehicles.world.query({ name: 'vehicle' }).count()).toBe(1);
    root.position.set(-1000, 0, -2000);
    root.updateMatrixWorld(true);
    expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
    expect(vehicles.cameraPose()?.position[2]).toBeCloseTo(2000.25);
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
  const { root, vehicles } = setup();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.4), new THREE.MeshBasicMaterial());
  wall.position.set(1000, 2, 2010);
  root.add(wall);
  expect(vehicles.enter([998.5, 1.7, 2000])).toBe(true);
  for (let i = 0; i < 300; i++) vehicles.update(1 / 60, { throttle: 1, steering: 0, brake: false });
  expect(vehicles.world.get('car', Transform)?.pos[2]).toBeLessThan(2007.6);
  expect(vehicles.speed).toBe(0);
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.4), new THREE.MeshBasicMaterial());
  rearWall.position.set(1000, 2, (vehicles.world.get('car', Transform)?.pos[2] ?? 0) - 3);
  root.add(rearWall);
  vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
  vehicles.view = 'chase';
  const pose = vehicles.cameraPose();
  expect(pose?.position[2]).toBeGreaterThan(rearWall.position.z);
});

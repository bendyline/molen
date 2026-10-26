import type { LiveryData, VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EarthAircraft } from '../src/client/aircraft';
import { Livery } from '../src/client/liveries';
import { EarthVehicles } from '../src/client/vehicles';
import { ENTITY_TYPES } from './entity-types';

it('applies pending choices, resets custom paint to the preset and keeps it through unloading', async () => {
  const kind = 'molen.entities.vehicle.sedan';
  const vehicle = ENTITY_TYPES.component<VehicleData>(kind, 'vehicle');
  const catalog = ENTITY_TYPES.component<LiveryData>(kind, 'livery');
  const alternative = catalog.variants.find((v) => v.paints.body) as LiveryData['variants'][number];
  const original = JSON.stringify(catalog);
  let finish: (model: THREE.Object3D) => void = () => {};
  const vehicles = new EarthVehicles({
    root: new THREE.Group(),
    sampleHeight: () => 0,
    types: ENTITY_TYPES,
    loadModel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const model = () => {
    const material = new THREE.MeshStandardMaterial({ color: vehicle.color });
    material.name = vehicle.visual.paintMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), material);
    mesh.name = 'test-body';
    return new THREE.Group().add(mesh);
  };
  const color = () =>
    (
      (vehicles.object.getObjectByName('test-body') as THREE.Mesh)
        .material as THREE.MeshStandardMaterial
    ).color.getHexString();
  const id = vehicles.spawn(kind, [0, 0, 0], 0, { color: '#123456' }) as string;
  vehicles.setLivery(id, alternative.id);
  finish(model());
  await Promise.resolve();
  expect(color()).toBe(alternative.paints.body?.color.slice(1));
  vehicles.setColor(id, 'rebeccapurple');
  expect(color()).toBe('663399');
  vehicles.setLivery(id, alternative.id);
  expect(color()).toBe(alternative.paints.body?.color.slice(1));
  vehicles.setLivery(id, 'authored');
  expect(color()).toBe(vehicle.color?.slice(1));
  vehicles.setColor(id, '#abcdef');
  vehicles.sync(performance.now() + 1000, [1000, 2, 1000]);
  expect(vehicles.object.children).toHaveLength(0);
  vehicles.sync(performance.now() + 2000, [0, 2, 4]);
  finish(model());
  await Promise.resolve();
  expect(color()).toBe('abcdef');
  expect(JSON.stringify(ENTITY_TYPES.component(kind, 'livery'))).toBe(original);
  const before = vehicles.world.get(id, Livery);
  expect(() => vehicles.setLivery(id, 'missing')).toThrow('Unknown livery');
  expect(vehicles.world.get(id, Livery)).toBe(before);
  vehicles.dispose();
});

it('uses the latest aircraft livery when its model finishes loading', async () => {
  const root = new THREE.Group();
  const vehicles = new EarthVehicles({
    root,
    sampleHeight: () => 0,
    types: ENTITY_TYPES,
    loadModel: async () => new THREE.Group(),
  });
  let finish: (model: THREE.Object3D) => void = () => {};
  const aircraft = new EarthAircraft({
    root,
    world: vehicles.world,
    sampleHeight: () => 0,
    types: ENTITY_TYPES,
    vehicleEnvironment: vehicles.environment,
    loadModel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const id = aircraft.spawn('molen.entities.aircraft.f_16b', {
    position: [0, 0, 0],
    heading: 0,
    livery: 'aggressor-blue',
  });
  aircraft.setLivery(id, 'service-gray');
  const data = vehicles.world.get(id, Livery) as LiveryData;
  const material = new THREE.MeshStandardMaterial();
  material.name = data.slots.body?.materials[0] as string;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), material);
  finish(new THREE.Group().add(mesh));
  await Promise.resolve();
  expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
    data.variants.find((v) => v.id === 'service-gray')?.paints.body?.color.slice(1),
  );
  aircraft.dispose();
  vehicles.dispose();
});

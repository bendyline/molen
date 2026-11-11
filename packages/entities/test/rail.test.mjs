import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  installVehicles,
  mountEntity,
  unmountEntity,
  VehicleState,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import { componentMapIssues, validate } from '@bendyline/molen-schema';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { MOLEN_RAIL_ENTITY_IDS } from '../src/index';

const root = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const document = await json('types/rail.types.json');
const types = createTypeLibrary([document]);
const flat = { groundHeight: () => 0 };
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const slugs = (await readdir(new URL('source/rail/', root))).sort();
const bundles = await Promise.all(
  slugs.map(async (slug) => ({
    slug,
    source: await json(`source/rail/${slug}/source.json`),
    recipe: await json(`source/rail/${slug}/models/recipe.json`),
  })),
);
// Triangle ceilings from the rail brief (drawn triangles, interior included).
const BUDGET = { 'freight-car': 12500, 'passenger-car': 30000, locomotive: 40000 };

describe('rail rolling stock', () => {
  it('registers every rail bundle as a valid type with a name-free identity', () => {
    expect(validate('types', document).ok).toBe(true);
    expect(bundles.map((b) => b.source.id).sort()).toEqual([...MOLEN_RAIL_ENTITY_IDS].sort());
    for (const id of MOLEN_RAIL_ENTITY_IDS) {
      const components = types.components(id);
      expect(
        componentMapIssues(components, `/${id}`).filter((i) => i.severity !== 'notice'),
        id,
      ).toEqual([]);
      // Locomotives lead ambient trains made up of cars from this library; cars have no role.
      if (components.vehicle.spec.bodyStyle === 'locomotive') {
        expect(components.ambientRole?.role, id).toBe('rail');
        expect(components.ambientRole?.track, id).toBe('heavy');
        for (const car of components.ambientRole?.consist?.cars ?? [])
          expect(MOLEN_RAIL_ENTITY_IDS, `${id} consist`).toContain(car.type);
        expect(components.audioSource?.sound, id).toBe('vehicle.engine.diesel');
      } else expect(components.ambientRole, id).toBeUndefined();
      const { spec } = components.vehicle;
      expect(['locomotive', 'passenger-car', 'freight-car']).toContain(spec.bodyStyle);
      expect(spec.genericLabel.length).toBeGreaterThan(3);
      expect(spec.maxSteer).toBe(0);
      expect(spec.rail.gauge).toBe(1.435);
      expect(spec.rail.truckCenters).toBe(spec.wheelbase);
      expect(spec.rail.couplerLength).toBeGreaterThan(spec.length);
      // Seats only where people ride: locomotives and passenger cars.
      expect(components.mountable !== undefined, id).toBe(spec.bodyStyle !== 'freight-car');
      expect((spec.rail.power ?? 0) > 0, id).toBe(spec.bodyStyle === 'locomotive');
    }
  });

  it.each(bundles)('$slug keeps its node contract, pivots, budget and envelope', async ({
    slug,
    source,
    recipe,
  }) => {
    const id = source.id;
    const asset = await json(source.files.models[0].output);
    const sourceBytes = await readFile(new URL(`source/rail/${slug}/models/source.glb`, root));
    expect(hash(sourceBytes)).toBe(source.files.models[0].sha256);
    expect(asset.sourceHash).toBe(hash(sourceBytes));
    const runtimeBytes = await readFile(
      new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), root),
    );
    expect(hash(runtimeBytes)).toBe(asset.hash);
    const { scene } = await new GLTFLoader().parseAsync(
      runtimeBytes.buffer.slice(
        runtimeBytes.byteOffset,
        runtimeBytes.byteOffset + runtimeBytes.byteLength,
      ),
      '',
    );
    scene.updateMatrixWorld(true);
    const { spec, visual } = types.component(id, 'vehicle');
    // Trucks pivot at rail level under the truck centres.
    for (const [name, z] of [
      ['truck-front', spec.rail.truckCenters / 2],
      ['truck-rear', -spec.rail.truckCenters / 2],
    ]) {
      const truck = scene.getObjectByName(name);
      expect(truck, name).toBeDefined();
      const p = truck.getWorldPosition(new Vector3());
      expect(p.x).toBeCloseTo(0, 4);
      expect(p.y).toBeCloseTo(0, 4);
      expect(p.z).toBeCloseTo(z, 4);
    }
    // Wheelsets axle-1..n front to rear, at the axle centre, each with one spinning child.
    const axles = visual.wheelNodes.map((name) => scene.getObjectByName(name));
    expect(visual.wheelNodes).toEqual(visual.wheelNodes.map((_, i) => `axle-${i + 1}`));
    expect(visual.frontWheelNodes).toEqual(['axle-1']);
    expect(axles.length).toBe(spec.bodyStyle === 'locomotive' && slug === 'ge-es44ac' ? 6 : 4);
    let previous = Number.POSITIVE_INFINITY;
    for (const axle of axles) {
      expect(axle.children).toHaveLength(1);
      expect(axle.children[0].name).toBe(`${axle.name}-spin`);
      const p = axle.getWorldPosition(new Vector3());
      expect(p.x).toBeCloseTo(0, 4);
      expect(p.y).toBeCloseTo(spec.wheelRadius, 4);
      expect(p.z).toBeLessThan(previous);
      previous = p.z;
    }
    // Paint material, interior nodes and live bindings resolve to real nodes.
    const materials = new Set();
    let triangles = 0;
    scene.traverse((node) => {
      if (!node.isMesh) return;
      materials.add(node.material.name);
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
    });
    expect(materials.has(visual.paintMaterial)).toBe(true);
    for (const name of [
      ...(visual.interior?.nodes ?? []),
      ...(visual.interior?.bindings ?? []).map((b) => b.node),
    ])
      expect(scene.getObjectByName(name), name).toBeDefined();
    expect(triangles).toBeLessThanOrEqual(BUDGET[spec.bodyStyle]);
    // Envelope: on the rail head, within the coupler faces, the declared height and width.
    // A load (scrap heap, lumber, containers) may stand above a car's own height; check the
    // car without it, and the load only for width.
    const model = scene.children[0];
    const box = new Box3();
    for (const child of model.children) if (child.name !== 'load') box.expandByObject(child);
    const load = model.getObjectByName('load');
    if (load) {
      const loaded = new Box3().setFromObject(load);
      expect(loaded.max.x - loaded.min.x).toBeLessThan(spec.width + 0.15);
      if (id.endsWith('well_car_double_stack') || id.endsWith('centerbeam_flatcar'))
        expect(loaded.max.y).toBeLessThan(spec.height + 0.06);
    }
    expect(box.min.y).toBeGreaterThan(-0.03);
    expect(box.max.y).toBeLessThan(spec.height + 0.06);
    expect(box.max.z).toBeLessThanOrEqual(spec.rail.couplerLength / 2 + 0.005);
    expect(box.min.z).toBeGreaterThanOrEqual(-spec.rail.couplerLength / 2 - 0.005);
    expect(box.max.x - box.min.x).toBeLessThan(spec.width + 0.45);
    expect(spec.label).toBe(recipe.label);
    if (id.endsWith('well_car_double_stack'))
      for (const name of ['container-lower', 'container-upper'])
        expect(materials.has(name), name).toBe(true);
  });

  it.each(
    MOLEN_RAIL_ENTITY_IDS.filter(
      (id) => types.component(id, 'vehicle').spec.bodyStyle === 'locomotive',
    ),
  )('boards %s from its steps, drives, brakes, reverses and exits', (id) => {
    const components = types.components(id);
    const { spec } = components.vehicle;
    const driver = components.mountable.seats.find((s) => s.id === 'driver');
    expect(driver.role).toBe('driver');
    expect(driver.position).toEqual(spec.driverEye);
    // The engineer sits on the right (-X); the conductor seat mirrors it.
    expect(driver.position[0]).toBeLessThan(0);
    expect(
      components.mountable.seats.find((s) => s.id === 'conductor').position[0],
    ).toBeGreaterThan(0);
    for (const exit of components.mountable.exits) expect(exit[1]).toBe(0);
    const world = new World({ tickRate: 60, seed: id });
    installVehicles(world, flat);
    world.spawnRaw(components, 'loco');
    world.spawnRaw(
      { transform: { pos: components.mountable.entries[0], rot: [0, 0, 0, 1] } },
      'engineer',
    );
    expect(mountEntity(world, 'engineer', 'loco')).toBe(true);
    driveVehicle(world, 'engineer', { throttle: 1, steering: 0, brake: false });
    world.stepN(120);
    expect(world.get('loco', Transform).pos[2]).toBeGreaterThan(1);
    expect(Math.abs(world.get('loco', Transform).pos[0])).toBeLessThan(1e-6);
    // Train brakes are gentle (brakeDeceleration 0.6 m/s²): allow a long stop.
    driveVehicle(world, 'engineer', { throttle: 0, steering: 0, brake: true });
    world.stepN(3600);
    expect(Math.abs(world.get('loco', VehicleState).speed)).toBeLessThan(0.1);
    driveVehicle(world, 'engineer', { throttle: -1, steering: 0, brake: false });
    world.stepN(120);
    expect(world.get('loco', VehicleState).speed).toBeLessThan(-0.5);
    driveVehicle(world, 'engineer', { throttle: 0, steering: 0, brake: true });
    world.stepN(3600);
    expect(unmountEntity(world, 'engineer', flat)).toBe(true);
  });

  it.each([
    'molen.entities.rail.bombardier_bilevel_coach',
    'molen.entities.rail.bombardier_bilevel_cab_car',
  ])('%s seats passengers at seated eye height on both levels', (id) => {
    const { seats, entries, exits } = types.components(id).mountable;
    const passengers = seats.filter((s) => s.role === 'passenger');
    expect(passengers.length).toBeGreaterThanOrEqual(6);
    for (const name of [
      'upper-left-1',
      'upper-right-1',
      'lower-left-1',
      'lower-right-1',
      'vestibule',
    ])
      expect(
        passengers.some((s) => s.id === name),
        name,
      ).toBe(true);
    // Upper floor 2.62 m, lower floor 0.62 m above the rail head, eyes 1.2 m above each.
    for (const s of passengers.filter((p) => p.id.startsWith('upper')))
      expect(s.position[1]).toBeCloseTo(3.82, 3);
    for (const s of passengers.filter((p) => p.id.startsWith('lower')))
      expect(s.position[1]).toBeCloseTo(1.82, 3);
    expect(entries).toHaveLength(4);
    for (const exit of exits) expect(exit[1]).toBe(0);
    const driver = seats.find((s) => s.role === 'driver');
    expect(driver !== undefined).toBe(id.endsWith('cab_car'));
  });
});

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  installVehicles,
  mountEntity,
  unmountEntity,
  VehicleState,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import { validate } from '@bendyline/molen-schema';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { MOLEN_VEHICLE_ENTITY_IDS } from '../src/index';

const root = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const { models } = await json('source/mini-acura.json');
const document = await json('types/vehicle.types.json');
const types = createTypeLibrary([document]);
const flat = { groundHeight: () => 0 };
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

describe('Requested MINI and Acura vehicles', () => {
  it('registers the two new models beside the existing MINI without duplicate identities', async () => {
    expect(models).toHaveLength(3);
    expect(models.filter((m) => !m.existing)).toHaveLength(2);
    expect(new Set(models.map((m) => m.id)).size).toBe(3);
    for (const m of models) expect(MOLEN_VEHICLE_ENTITY_IDS).toContain(m.id);
    expect(models.map((m) => m.id)).toEqual([
      'molen.entities.vehicle.mini_cooper_2013',
      'molen.entities.vehicle.mini_cooper_countryman_2012',
      'molen.entities.vehicle.acura_mdx_2019',
    ]);
    expect(validate('types', document).ok).toBe(true);
    const scene = await json('scenes/mini-acura.scene.json');
    expect(validate('scene', scene).ok).toBe(true);
    expect(scene.entities.filter((e) => e.type).map((e) => e.type)).toEqual(
      models.map((m) => m.id),
    );
  });

  it.each(models)('$label has a verified model, interior and usable driving controls', async ({
    id,
    slug,
    label,
  }) => {
    const path = `source/vehicles/${slug}/`;
    const source = await json(`${path}source.json`);
    const recipe = await json(`${path}models/recipe.json`);
    const asset = await json(source.files.models[0].output);
    const sourceBytes = await readFile(new URL(`${path}models/source.glb`, root));
    expect(hash(sourceBytes)).toBe(source.files.models[0].sha256);
    expect(asset.sourceHash).toBe(hash(sourceBytes));
    const runtimePath = source.files.models[0].output.replace('asset.json', 'model.glb');
    const runtimeBytes = await readFile(new URL(runtimePath, root));
    expect(hash(runtimeBytes)).toBe(asset.hash);
    const { scene } = await new GLTFLoader().parseAsync(
      runtimeBytes.buffer.slice(
        runtimeBytes.byteOffset,
        runtimeBytes.byteOffset + runtimeBytes.byteLength,
      ),
      '',
    );
    const data = types.component(id, 'vehicle');
    expect(data.spec.label).toBe(label);
    for (const name of [
      ...data.visual.wheelNodes,
      ...data.visual.interior.nodes,
      ...data.visual.interior.bindings.map((b) => b.node),
    ])
      expect(scene.getObjectByName(name), name).toBeDefined();
    const record = models.find((m) => m.id === id);
    expect(data.color).toBe(record.color);
    expect(recipe.color).toBe(record.color);
    const paints = [];
    scene.traverse((node) => {
      if (node.material?.name === 'vehicle-paint-and-trim')
        paints.push(node.material.color.getHexString());
    });
    expect(paints.length).toBeGreaterThan(0);
    expect(paints.every((c) => c === record.color.slice(1))).toBe(true);
    if (!record.existing) expect(types.component(id, 'ambientRole').colors).toEqual([record.color]);
    for (const name of data.visual.wheelNodes)
      expect(scene.getObjectByName(name).children[0].name).toBe(`${name}-spin`);
    const eye = data.spec.driverEye;
    // Head remains under the roof, safely aft of the inclined windscreen.
    expect(eye[2]).toBeLessThan(recipe.form.roofFront * recipe.length);
    expect(eye[1]).toBeLessThan(recipe.height - 0.15);
    expect(eye[1]).toBeGreaterThan(recipe.height * recipe.form.belt);
    // Includes up to 4k triangles for cut panels and switchable lamp lenses.
    expect(asset.stats.triangles).toBeLessThanOrEqual(30000);
    expect(asset.bounds.aabb.min[1]).toBeGreaterThan(-0.015);
    expect(asset.bounds.aabb.max[1]).toBeLessThan(recipe.height + 0.1);
    const world = new World({ tickRate: 60, seed: slug });
    installVehicles(world, flat);
    const components = types.components(id);
    world.spawnRaw(components, 'car');
    world.spawnRaw(
      { transform: { pos: components.mountable.entries[0], rot: [0, 0, 0, 1] } },
      'driver',
    );
    expect(mountEntity(world, 'driver', 'car')).toBe(true);
    driveVehicle(world, 'driver', { throttle: 1, steering: 0, brake: false });
    world.stepN(180);
    expect(world.get('car', Transform).pos[2]).toBeGreaterThan(3);
    driveVehicle(world, 'driver', { throttle: 0.3, steering: 0.3, brake: false });
    world.stepN(90);
    expect(Math.abs(world.get('car', Transform).pos[0])).toBeGreaterThan(0.1);
    driveVehicle(world, 'driver', { throttle: 0, steering: 0, brake: true });
    world.stepN(300);
    expect(Math.abs(world.get('car', VehicleState).speed)).toBeLessThan(0.1);
    driveVehicle(world, 'driver', { throttle: -1, steering: 0, brake: false });
    world.stepN(150);
    expect(world.get('car', VehicleState).speed).toBeLessThan(-0.5);
    driveVehicle(world, 'driver', { throttle: 0, steering: 0, brake: true });
    world.stepN(180);
    expect(unmountEntity(world, 'driver', flat)).toBe(true);
  });
});

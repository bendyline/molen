import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validate } from '@bendyline/molen-schema';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';

const base = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const { aircraft } = await json('source/aircraft-expansion.json');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
it('adds fifty distinct aircraft and meets each requested category minimum', () => {
  expect(aircraft).toHaveLength(50);
  expect(new Set(aircraft.map((a) => a.id)).size).toBe(50);
  for (const [category, minimum] of [
    ['helicopter', 10],
    ['ga', 10],
    ['fighter', 10],
    ['cargo', 5],
  ])
    expect(aircraft.filter((a) => a.category === category).length).toBeGreaterThanOrEqual(minimum);
  for (const slug of [
    'uh-1h',
    'pa-28-180',
    'cessna-208b',
    'f-16b',
    'f-14d',
    'c-130j',
    'c-17a',
    'mv-22b',
    'av-8b',
  ])
    expect(aircraft.some((a) => a.slug === slug)).toBe(true);
});
describe.each(aircraft)('$slug imported aircraft', (s) => {
  it('has a valid controllable type, pinned source/runtime and bounded texture-free geometry', async () => {
    const source = await json(`source/aircraft/${s.slug}/source.json`);
    const definition = await json(`source/aircraft/${s.slug}/entity.types.json`);
    expect(validate('types', definition).ok).toBe(true);
    const components = definition.types[s.id].components,
      spec = components.aircraft.spec;
    expect(components.mountable.seats.some((seat) => seat.role === 'driver')).toBe(true);
    expect(components.aircraftInput).toBeDefined();
    expect(components.aircraftState).toBeDefined();
    const model = source.files.models[0],
      asset = await json(model.output);
    expect(asset.sourceHash).toBe(model.sha256);
    expect(hash(await readFile(new URL(`source/aircraft/${s.slug}/${model.path}`, base)))).toBe(
      model.sha256,
    );
    const runtime = new URL(model.output.replace('asset.json', 'model.glb'), base),
      bytes = await readFile(runtime);
    expect(hash(bytes)).toBe(asset.hash);
    expect(bytes.length).toBeLessThan(4_000_000);
    expect(asset.stats.triangles).toBeLessThan(100_000);
    expect(asset.stats.textures).toBe(0);
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    scene.updateMatrixWorld(true);
    const nodes = [];
    scene.traverse((node) => nodes.push(node.name));
    const bindings = [
      ...spec.visual.rotors,
      ...spec.visual.flaps,
      ...spec.visual.ailerons,
      ...spec.visual.animation.bindings,
      ...spec.visual.interior.bindings,
    ];
    for (const { node } of bindings)
      expect(
        nodes.filter((n) => n === node),
        node,
      ).toHaveLength(1);
    expect(nodes.join(' ')).not.toMatch(/missile|bomb-rack|gun-pod|weapon-pylon/);
    // The cockpit shell must leave the forward sightline clear. A stopped propeller
    // can legitimately cross it; only descendants of declared rotor nodes are excluded.
    const rotorNodes = new Set(spec.visual.rotors.map(({ node }) => node));
    const belongsToRotor = (object) => {
      for (let current = object; current; current = current.parent)
        if (rotorNodes.has(current.name)) return true;
      return false;
    };
    const hits = new Raycaster(new Vector3(...spec.pilotEye), new Vector3(0, 0, 1)).intersectObject(
      scene,
      true,
    );
    expect(
      hits
        .filter((hit) => !hit.object.material.transparent && !belongsToRotor(hit.object))
        .map((hit) => hit.object.name),
    ).toEqual([]);
    scene.traverse((node) => {
      if (node.isMesh) {
        expect([...node.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
        const normal = node.geometry.getAttribute('normal');
        // Runtime import quantizes normals to signed integers; allow that documented precision.
        for (let i = 0; i < normal.count; i++)
          expect(
            Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1),
          ).toBeLessThan(0.015);
        node.geometry.dispose();
      }
    });
  });
});

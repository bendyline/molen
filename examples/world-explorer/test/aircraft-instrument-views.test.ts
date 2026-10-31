import { readFile } from 'node:fs/promises';
import type { AircraftSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { createAircraftInstrumentViews } from '../src/aircraft-instrument-views';

async function aircraft(slug: string) {
  const base = new URL('../../../content/entities/', import.meta.url);
  const data = JSON.parse(
    await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, base), 'utf8'),
  );
  const components = Object.values(data.types)[0] as {
    components: { aircraft: { spec: AircraftSpec }; renderable: { ref: string } };
  };
  const bytes = await readFile(
    new URL(
      `assets/molen/entities/aircraft/${components.components.renderable.ref.split('.').at(-1)}/model.glb`,
      base,
    ),
  );
  const loader = new GLTFLoader();
  // Geometry and material identity are under test; headless Node has no image element.
  loader.register(() => ({
    name: 'test-no-textures',
    loadTexture: async () => new THREE.Texture(),
  }));
  const { scene: model } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  return { model, spec: components.components.aircraft.spec };
}

describe('external aircraft instruments', () => {
  it.each([
    'p-51',
    'oh-6',
    'cessna-172s',
    'cirrus-sr22t',
    'beech-18',
  ])('finds both actual instruments in %s and keeps its authored materials', async (slug) => {
    const source = await aircraft(slug);
    const views = createAircraftInstrumentViews(source);
    expect(views.map((v) => v.kind)).toEqual(['speed', 'altitude']);
    for (const view of views) {
      expect(view.camera.right).toBeGreaterThan(0);
      expect(view.camera.right).toBeLessThan(0.3);
      const meshes = view.scene.children.filter((node) => node instanceof THREE.Mesh);
      expect(meshes.length).toBeGreaterThan(0);
      for (const mesh of meshes) {
        const original = source.model.getObjectByName(mesh.name) as THREE.Mesh;
        expect(mesh.geometry).toBe(original.geometry);
        expect(mesh.material).toBe(original.material);
      }
    }
    if (slug === 'cirrus-sr22t' || slug === 'cessna-172s')
      expect(views[0]?.node).toContain('PFD-speed');
  });

  it('follows live needles while ignoring aircraft pose and distance-based cabin hiding', async () => {
    const source = await aircraft('p-51');
    const [speed] = createAircraftInstrumentViews(source);
    if (!speed) throw new Error('Missing speed instrument');
    const needle = source.model.getObjectByName(speed.node);
    if (!needle) throw new Error('Missing needle');
    let original: THREE.Mesh | undefined;
    needle.traverse((node) => {
      if (node instanceof THREE.Mesh) original = node;
    });
    if (!original) throw new Error('Missing needle mesh');
    const copy = speed.scene.getObjectByName(original.name) as THREE.Mesh;
    const before = copy.matrix.clone();
    const dispose = vi.spyOn(original.geometry, 'dispose');
    source.model.position.set(1000000, 5000, -2000000);
    source.model.rotation.set(0.4, 1.2, -0.8);
    const cabin = source.model.getObjectByName('cockpit');
    if (!cabin) throw new Error('Missing cabin');
    cabin.visible = false;
    source.model.updateWorldMatrix(true, true);
    speed.sync();
    for (const [index, value] of before.elements.entries())
      expect(copy.matrix.elements[index]).toBeCloseTo(value, 7);
    expect(copy.visible).toBe(true);
    needle.rotation.z += 0.8;
    source.model.updateWorldMatrix(true, true);
    speed.sync();
    expect(copy.matrix.equals(before)).toBe(false);
    needle.visible = false;
    speed.sync();
    expect(copy.visible).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
  });

  it('omits absent instruments instead of inventing a generic gauge', async () => {
    const source = await aircraft('p-51');
    source.spec.visual.interior = undefined;
    expect(createAircraftInstrumentViews(source)).toEqual([]);
  });
});

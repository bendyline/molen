import { readdir, readFile } from 'node:fs/promises';
import { Box3, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fleetModel } from '../scripts/fleet-geometry.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const hits = (root, origin, direction) =>
  new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize()).intersectObject(
    root,
    true,
  );
const boats = await readdir(new URL('source/watercraft/', base));
describe.each(boats)('%s watertight hull and bridge', (slug) => {
  it('closes the keel center seam and has no horizontal glazing across the bridge', async () => {
    const recipe = await json(`source/watercraft/${slug}/models/recipe.json`);
    const types = await json(`source/watercraft/${slug}/entity.types.json`);
    const eye = types.types[recipe.id].components.boat.spec.driverEye;
    const root = fleetModel({ ...recipe, driverEye: eye });
    root.updateMatrixWorld(true);
    for (const x of [-0.015, 0, 0.015])
      for (const fraction of [-0.36, -0.2, 0, 0.2, 0.36]) {
        const hit = hits(root, [x, -recipe.draft - 2, recipe.length * fraction], [0, 1, 0])[0];
        expect(hit, `keel ${x}/${fraction}`).toBeDefined();
        expect(hit.object.material.transparent).not.toBe(true);
        expect(hit.point.y).toBeLessThanOrEqual(0);
      }
    if (!['speedboat', 'sailboat'].includes(slug)) {
      const down = hits(root, eye, [0, -1, 0]);
      expect(down[0]).toBeDefined();
      expect(down[0].object.material.transparent).not.toBe(true);
      expect(down[0].distance).toBeLessThan(1.7);
    }
    // Exterior bridge wings must not become a shelf through the wheel and footwell.
    const wings = [];
    root.traverse((m) => {
      if (m.name === 'bridge-wing') wings.push(m);
    });
    for (const wing of wings) {
      const bounds = new Box3().setFromObject(wing);
      const footwell = new Box3(
        new Vector3(eye[0] - 0.8, eye[1] - 1.1, eye[2] - 0.5),
        new Vector3(eye[0] + 0.8, eye[1], eye[2] + 1.5),
      );
      expect(bounds.intersectsBox(footwell), 'bridge platform crosses the helm').toBe(false);
    }
    root.traverse((m) => {
      if (m.isMesh) m.geometry.dispose();
    });
  });
});
describe.each([
  'compact',
  'pickup',
  'sedan',
  'suv',
  'van',
  'airliner',
])('%s cabin cutout', (slug) => {
  it('retains an inward roof and lower-side surfaces', async () => {
    const category = slug === 'airliner' ? 'aircraft' : 'vehicles';
    const source = await json(`source/${category}/${slug}/source.json`);
    const types = await json(`source/${category}/${slug}/entity.types.json`);
    const c = types.types[source.id].components;
    const eye = c.aircraft?.spec.pilotEye ?? c.vehicle.spec.driverEye;
    const output = source.files.models
      .find((m) => m.output)
      .output.replace('asset.json', 'model.glb');
    const bytes = await readFile(new URL(output, base));
    const root = (
      await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      )
    ).scene;
    root.updateMatrixWorld(true);
    for (const x of [-1, -0.5, 0, 0.5, 1])
      for (const z of [-0.5, 0, 0.5, 1]) {
        const hit = hits(root, eye, [x, -2, z]).find((h) => !h.object.material.transparent);
        expect(hit, `lower cabin ${x}/${z}`).toBeDefined();
        expect(hit.distance).toBeLessThan(4);
      }
    const roof = hits(root, eye, [0, 1, 0]).find((h) => !h.object.material.transparent);
    expect(roof).toBeDefined();
    expect(roof.distance).toBeLessThan(1.7);
  });
});

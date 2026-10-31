import { readdir, readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { roadVehicleModel } from '../scripts/road-vehicle-geometry.mjs';

const base = new URL('../../../content/entities/source/vehicles/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const slugs = [];
for (const slug of (await readdir(base)).sort()) {
  const recipe = await json(`${slug}/models/recipe.json`);
  if (recipe.family === 'road-vehicle' && !recipe.master) slugs.push(slug);
}

describe.each(slugs)('%s cabin enclosure', (slug) => {
  it('closes the cowl and lower sides without exposing interior lining outside the body', async () => {
    const recipe = await json(`${slug}/models/recipe.json`);
    const types = await json(`${slug}/entity.types.json`);
    const eye = types.types[recipe.id].components.vehicle.spec.driverEye;
    const scene = roadVehicleModel({ ...recipe, driverEye: eye });
    scene.updateMatrixWorld(true);
    const origin = new Vector3(...eye);
    const hits = (from, direction) =>
      new Raycaster(from, direction.normalize())
        .intersectObject(scene, true)
        .filter((h) => !h.object.material.transparent);
    for (const side of [-1, 1]) {
      for (const dz of [-0.2, 0.1, 0.4]) {
        const aim = new Vector3(
          side * recipe.width * 0.4,
          Math.min(eye[1] - 0.75, recipe.height * recipe.form.belt - 0.18),
          eye[2] + dz,
        ).sub(origin);
        const hit = hits(origin, aim)[0];
        expect(hit, `lower side ${side}/${dz}`).toBeDefined();
        expect(hit.distance).toBeLessThan(recipe.width);
        expect(hit.object.material.name).not.toBe('vehicle-paint-and-trim');
      }
      const cowl = recipe.length * recipe.form.windshieldBase;
      const aim = new Vector3(
        side * recipe.width * 0.35,
        recipe.height * recipe.form.belt - 0.02,
        cowl - 0.08,
      ).sub(origin);
      const cowlHit = hits(origin, aim)[0];
      expect(cowlHit, 'cowl').toBeDefined();
      expect(cowlHit.object.material.name).not.toBe('vehicle-paint-and-trim');
      for (const dz of [-0.3, 0, 0.25]) {
        const from = new Vector3(
          side * recipe.width,
          recipe.height * recipe.form.belt - 0.14,
          eye[2] + dz,
        );
        const hit = hits(from, new Vector3(-side, 0, 0))[0];
        expect(hit?.object.name, `outside lining ${side}/${dz}`).not.toMatch(/^cabin-/);
      }
    }
    if (['audi-tt-2021', 'dodge-challenger-2018'].includes(slug)) {
      for (const side of [-1, 1]) {
        const from = new Vector3(side * recipe.width * 0.23, recipe.height + 0.5, eye[2] - 1.13);
        const hit = new Raycaster(from, new Vector3(0, -1, 0)).intersectObject(scene, true)[0];
        expect(hit?.object.material.name, 'rear headrest stays below backlight').toBe(
          'clear-glazing',
        );
      }
    }
    scene.traverse((node) => {
      if (node.isMesh) node.geometry.dispose();
    });
  });
});

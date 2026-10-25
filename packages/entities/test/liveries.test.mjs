import { readFile } from 'node:fs/promises';
import { liverySchema } from '@bendyline/molen-schema';
import { expect, it } from 'vitest';

const root = new URL('../../../content/entities/', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
it('ships 2–4 validated, distinct choices and valid material bindings for every vehicle', async () => {
  const catalog = (await read('source/liveries.json')).models;
  const project = await read('project.json');
  const seen = new Set();
  for (const path of project.types) {
    for (const [id, definition] of Object.entries((await read(path)).types)) {
      const components = definition.components;
      if (!components?.vehicle && !components?.aircraft && !components?.boat) continue;
      seen.add(id);
      const data = components.livery;
      expect(data, id).toEqual(catalog[id]);
      expect(liverySchema.safeParse(data).success, id).toBe(true);
      expect(data.variants.length, id).toBeGreaterThanOrEqual(2);
      expect(data.variants.length, id).toBeLessThanOrEqual(4);
      expect(
        new Set(data.variants.map((v) => JSON.stringify([v.paints, v.markings]))).size,
        id,
      ).toBe(data.variants.length);
      const sidecar = await read(project.assets[id]);
      const bytes = await readFile(new URL(sidecar.files.main, new URL(project.assets[id], root)));
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
      const materials = new Set(gltf.materials.map((m) => m.name));
      for (const slot of Object.values(data.slots))
        for (const name of slot.materials)
          expect(materials.has(name), `${id}: stale slot material ${name}`).toBe(true);
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(catalog).sort());
});

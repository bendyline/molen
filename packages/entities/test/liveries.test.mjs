import { readFile } from 'node:fs/promises';
import { liverySchema } from '@bendyline/molen-schema';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { applyLivery } from '../../client/dist/index.mjs';

const root = new URL('../../../content/entities/', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const loadModel = async (bytes) => {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'skipTextures', loadTexture: () => Promise.resolve(null) }));
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
};
it('ships 2–4 photo-sourced choices with working paint and decal bindings for every vehicle', async () => {
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
      for (const variant of data.variants) {
        expect(variant.provenance.kind, `${id}/${variant.id}`).not.toBe('original');
        expect(variant.provenance.references.length, id).toBeGreaterThan(0);
        for (const ref of variant.provenance.references) {
          expect(new URL(ref.url).protocol).toBe('https:');
          expect(ref.url).not.toMatch(/Special:Search|\/w\/index\.php|\/search[/?]/i);
          expect(ref.title.length).toBeGreaterThan(5);
        }
      }
      const sidecar = await read(project.assets[id]);
      const bytes = await readFile(new URL(sidecar.files.main, new URL(project.assets[id], root)));
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
      const materials = new Set(gltf.materials.map((m) => m.name));
      for (const slot of Object.values(data.slots))
        for (const name of slot.materials)
          expect(materials.has(name), `${id}: stale slot material ${name}`).toBe(true);
      const model = await loadModel(bytes);
      for (const variant of data.variants) {
        const appearance = applyLivery(model, { ...data, selected: variant.id });
        expect(appearance.warnings, `${id}/${variant.id}`).toEqual([]);
        appearance.dispose();
      }
    }
  }
  expect([...seen].sort()).toEqual(Object.keys(catalog).sort());
}, 60000);

it('keeps Danish F-16 roundels behind the canopy, serials aft of them and flags on the fin', async () => {
  const id = 'molen.entities.aircraft.f_16b';
  const data = (await read('source/liveries.json')).models[id];
  const project = await read('project.json');
  const asset = await read(project.assets[id]);
  const model = await loadModel(
    await readFile(new URL(asset.files.main, new URL(project.assets[id], root))),
  );
  const appearance = applyLivery(model, { ...data, selected: 'danish-et-612' });
  model.updateMatrixWorld(true);
  for (const side of ['left', 'right']) {
    const bounds = (name) => {
      const decal = model.getObjectByName(`livery:${name}-${side}`);
      expect(decal, name).toBeDefined();
      return new Box3().setFromObject(decal);
    };
    const roundel = bounds('roundel'),
      serial = bounds('serial'),
      flag = bounds('flag');
    // +Z is forward. These regions come from the paired ET-612 side photographs.
    expect(roundel.max.z).toBeLessThan(2);
    expect(roundel.min.z).toBeGreaterThan(1.3);
    expect(serial.max.z).toBeLessThan(roundel.min.z);
    expect(flag.min.y).toBeGreaterThan(4);
    expect(flag.max.z).toBeLessThan(-4);
  }
  appearance.dispose();
});

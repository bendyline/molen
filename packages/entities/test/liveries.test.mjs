import { readFile } from 'node:fs/promises';
import { liverySchema } from '@bendyline/molen-schema';
import { Box3, Vector3 } from 'three';
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
it('ships photo-sourced choices (3–8 per aircraft, 2–4 per vehicle) with working paint and decal bindings', async () => {
  const catalog = (await read('source/liveries.json')).models;
  const project = await read('project.json');
  const seen = new Set();
  for (const path of project.types) {
    for (const [id, definition] of Object.entries((await read(path)).types)) {
      const components = definition.components;
      if (!components?.vehicle && !components?.aircraft && !components?.boat) continue;
      // Rail rolling stock paints through vehicle.color with generic schemes (RAIL.md): colours
      // studied from photographs of real units would reproduce railroad trade dress.
      if (id.startsWith('molen.entities.rail.')) continue;
      seen.add(id);
      const data = components.livery;
      expect(data, id).toEqual(catalog[id]);
      expect(liverySchema.safeParse(data).success, id).toBe(true);
      // Aircraft carry three to eight operator schemes; other vehicles two to four.
      const [fewest, most] = components.aircraft ? [3, 8] : [2, 4];
      expect(data.variants.length, id).toBeGreaterThanOrEqual(fewest);
      expect(data.variants.length, id).toBeLessThanOrEqual(most);
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
    // Markings on one mesh share a decal draw; userData.liveryMarkings names their vertices.
    const bounds = (name) => {
      const box = new Box3();
      model.traverse((decal) => {
        for (const range of decal.userData.liveryMarkings ?? []) {
          if (range.anchor !== `${name}-${side}`) continue;
          const p = decal.geometry.getAttribute('position');
          for (let i = range.start; i < range.start + range.count; i++)
            box.expandByPoint(
              new Vector3().fromBufferAttribute(p, i).applyMatrix4(decal.matrixWorld),
            );
        }
      });
      expect(box.isEmpty(), name).toBe(false);
      return box;
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

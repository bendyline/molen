import { readdir, readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const root = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const { profiles } = await json('source/interiors.json');
const references = await json('source/interior-references.json');

it('covers every controllable source bundle with an authored layout and honest reference status', async () => {
  const ids = [];
  for (const category of ['vehicles', 'cycles', 'watercraft', 'transit', 'aircraft']) {
    for (const slug of await readdir(new URL(`source/${category}/`, root))) {
      const source = await json(`source/${category}/${slug}/source.json`);
      ids.push(source.id);
      expect(profiles[source.id], slug).toMatchObject({ slug, category });
      const citation = references.references[slug];
      if (citation) {
        expect(citation.author.length, slug).toBeGreaterThan(0);
        expect(citation.license, slug).toMatch(/^(CC0|Public domain|CC BY)/);
        expect(citation.url, slug).toMatch(/^https:\/\//);
        expect(citation.publicDomain, slug).toBe(/^(CC0|Public domain)/.test(citation.license));
      } else
        expect(
          references.gaps.some((gap) => gap.id === source.id),
          slug,
        ).toBe(true);
    }
  }
  expect(Object.keys(profiles).sort()).toEqual(ids.sort());
});

it.each(
  Object.entries(profiles).filter(([, p]) => p.category === 'vehicles'),
)('%s keeps cabin and instrument bindings valid in the imported GLB', async (id, { slug }) => {
  const source = await json(`source/vehicles/${slug}/source.json`);
  const model = source.files.models.find((m) => m.output);
  const bytes = await readFile(new URL(model.output.replace('asset.json', 'model.glb'), root));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const names = gltf.nodes.map((node) => node.name);
  const doc = await json(`source/vehicles/${slug}/entity.types.json`);
  const visual = doc.types[id].components.vehicle.visual.interior;
  expect(names.filter((name) => name === 'steering-wheel')).toHaveLength(1);
  expect(names).toContain('cabin');
  for (const binding of visual.bindings)
    expect(names, `${slug}: ${binding.node}`).toContain(binding.node);
  const speedBindings = visual.bindings.filter((binding) => binding.node === 'speed-needle');
  expect(speedBindings.length).toBe(names.includes('speed-needle') ? 1 : 0);
  if (speedBindings.length)
    expect(speedBindings[0]).toMatchObject({ source: 'speed', min: 0, max: 3.9 });
});

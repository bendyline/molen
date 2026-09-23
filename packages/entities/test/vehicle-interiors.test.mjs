import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';

const models = [
  ['aircraft', 'p-51', 'aircraft', 'p51d'],
  ['aircraft', 'hughes-500md', 'aircraft', 'h500md'],
  ...['compact', 'sedan', 'suv', 'pickup', 'van'].map((name) => [
    'vehicles',
    name,
    'vehicle',
    name,
  ]),
];

it.each(
  models,
)('%s/%s interior bindings resolve in its source and imported main GLB', async (category, name, runtimeCategory, runtimeName) => {
  const root = new URL(`../source/${category}/${name}/`, import.meta.url);
  const doc = JSON.parse(await readFile(new URL('entity.types.json', root), 'utf8'));
  const components = Object.values(doc.types)[0].components;
  const visual = components.aircraft?.spec.visual ?? components.vehicle.visual;
  const spec = visual.interior;
  expect(spec.nodes.length).toBeGreaterThan(0);
  for (const path of [
    new URL('models/source.glb', root),
    new URL(
      `../assets/molen/entities/${runtimeCategory}/${runtimeName}/model.glb`,
      import.meta.url,
    ),
  ]) {
    const buffer = await readFile(path);
    const { scene } = await new GLTFLoader().parseAsync(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      '',
    );
    for (const node of [...spec.nodes, ...spec.bindings.map((binding) => binding.node)]) {
      expect(scene.getObjectByName(node), `${name}: missing ${node} in ${path}`).toBeDefined();
    }
  }
});

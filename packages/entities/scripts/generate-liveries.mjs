/** Validate curated photo recipes, then propagate them to the type catalog. */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liverySchema } from '@bendyline/molen-schema';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = fileURLToPath(new URL('../../../content/entities/', import.meta.url));
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const project = await read('project.json');
// Authored data: never replace a missing recipe with a generated palette.
const catalog = await read('source/liveries.json');
if (catalog.format !== 'molen/fleet-liveries@1') throw new Error('Unknown livery catalog format');
const vehicles = new Set();
let count = 0;
for (const path of project.types) {
  for (const [id, type] of Object.entries((await read(path)).types)) {
    const c = type.components;
    if (!c?.aircraft && !c?.vehicle && !c?.boat) continue;
    vehicles.add(id);
    const data = liverySchema.parse(catalog.models[id]);
    if (data.variants.length < 2 || data.variants.length > 4)
      throw new Error(`${id}: expected 2–4 curated liveries`);
    const distinct = new Set();
    for (const variant of data.variants) {
      if (variant.provenance.kind === 'original' || !variant.provenance.references.length)
        throw new Error(`${id}/${variant.id}: a real photograph reference is required`);
      for (const ref of variant.provenance.references) {
        const url = new URL(ref.url);
        if (
          url.protocol !== 'https:' ||
          /\/w\/index\.php|Special:Search|\/search[/?]/i.test(ref.url)
        )
          throw new Error(`${id}/${variant.id}: link the photograph source, not a search`);
      }
      distinct.add(JSON.stringify([variant.paints, variant.markings]));
    }
    if (distinct.size !== data.variants.length) throw new Error(`${id}: duplicate appearances`);
    const asset = await read(project.assets[id]);
    const bytes = await readFile(resolve(root, project.assets[id], '..', asset.files.main));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const materials = new Set(gltf.materials.map((m) => m.name));
    // The loader disambiguates duplicate node names (for example flap-surface_1).
    // Match the same names that the livery renderer sees, without fetching textures.
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'skipTextures', loadTexture: () => Promise.resolve(null) }));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const nodes = new Set();
    model.scene.traverse((node) => nodes.add(node.name));
    for (const [name, slot] of Object.entries(data.slots)) {
      if (slot.node && !nodes.has(slot.node)) throw new Error(`${id}/${name}: missing node`);
      for (const material of slot.materials)
        if (!materials.has(material)) throw new Error(`${id}/${name}: missing ${material}`);
    }
    count += data.variants.length;
  }
}
if (JSON.stringify([...vehicles].sort()) !== JSON.stringify(Object.keys(catalog.models).sort()))
  throw new Error('Vehicle and livery catalogs must have identical coverage');
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL('generate-models.mjs', import.meta.url)),
    ...(process.argv.includes('--check') ? ['--check'] : []),
  ],
  { stdio: 'inherit' },
);
console.log(`${vehicles.size} vehicles, ${count} photo-sourced liveries`);

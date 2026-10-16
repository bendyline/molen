/** Bake bind poses solely for reproducible model import/inspection/capture QA. Runtime uses recipes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wildlifeGeometry } from '../../../packages/ambient/dist/client.mjs';
import {
  importAsset,
  inspectAsset,
  screenshotAsset,
} from '../../../packages/tooling/dist/index.mjs';
import { encodeGlb } from '../../../packages/worldgen/dist/kernel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world/wildlife-preview');
await mkdir(out, { recursive: true });
const projectPath = resolve(out, 'project.json');
try {
  await readFile(projectPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(
    projectPath,
    JSON.stringify(
      {
        format: 'molen/project@1',
        name: 'regional-wildlife-preview',
        scenes: { main: 'scene.json' },
        defaultScene: 'main',
        types: [],
        assets: {},
        reservations: [{ namespace: 'wildlife', owner: 'regional-preview' }],
      },
      null,
      2,
    ),
  );
}
const { animals } = JSON.parse(
  await readFile(new URL('../regional.catalog.json', import.meta.url), 'utf8'),
);
const names = process.argv.filter((arg) => arg.startsWith('--animal=')).map((arg) => arg.slice(9));
if (!names.length)
  names.push(
    'roe_deer',
    'red_kangaroo',
    'savanna_elephant',
    'woodland_songbird',
    'waterfowl_group',
    'capybara',
  );
let previous = [];
try {
  previous = JSON.parse(await readFile(resolve(out, 'evidence.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const evidence = new Map(previous.map((entry) => [entry.name, entry]));
for (const name of names) {
  const recipe = animals.find((animal) => animal.id.endsWith(`.${name}`));
  if (!recipe) throw new Error(`Unknown animal ${name}`);
  const { geometry, triangles } = wildlifeGeometry(recipe, 0);
  const positions = new Float32Array(geometry.getAttribute('position').array);
  const normals = new Float32Array(geometry.getAttribute('normal').array);
  const colors = new Uint8Array(
    [...geometry.getAttribute('color').array].map((value) => Math.round(value * 255)),
  );
  const vertexCount = positions.length / 3;
  const buffers = {
    positions,
    normals,
    colors,
    indices: Uint32Array.from({ length: vertexCount }, (_, i) => i),
    uvs: new Float32Array(vertexCount * 2),
    vertexCount,
    triangleCount: triangles,
    bytes: 0,
    groups: [{ start: 0, count: vertexCount, slot: 'wall', materialRef: 'palette:#ffffff' }],
  };
  const bytes = encodeGlb(
    buffers,
    [{ name: recipe.title, roughness: 0.85, metallic: 0 }],
    'Molen wildlife bind-pose QA',
  );
  geometry.dispose();
  const source = resolve(out, `${name}.source.glb`);
  await writeFile(source, bytes);
  const imported = await importAsset({
    path: source,
    id: `wildlife.${name}`,
    projectPath,
    cwd: out,
    force: true,
    optimize: false,
  });
  if (!imported.ok) throw new Error(imported.error);
  const inspected = await inspectAsset({ ref: `wildlife.${name}`, projectPath, verify: true });
  if (!inspected.ok) throw new Error(inspected.error);
  const shot = await screenshotAsset({
    ref: `wildlife.${name}`,
    projectPath,
    outDir: resolve(out, name),
    angles: 3,
    size: [900, 900],
    reflections: true,
    antialias: true,
    clearColor: '#cbd8dc',
  });
  if (!shot.ok) throw new Error(shot.error);
  evidence.set(name, { name, triangles, hash: imported.sidecar?.hash, frames: shot.frames });
  await writeFile(
    resolve(out, 'evidence.json'),
    `${JSON.stringify([...evidence.values()], null, 2)}\n`,
  );
  console.log(JSON.stringify({ name, triangles, frames: shot.frames?.map((frame) => frame.path) }));
}

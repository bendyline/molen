// Bake selected runtime recipes only for reproducible visual QA, then import/capture through
// Molen's normal model pipeline. The shipped procedural catalog does not download these GLBs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  importAsset,
  inspectAsset,
  screenshotAsset,
} from '../../../packages/tooling/dist/index.mjs';
import { createPlantGeometry } from '../../../packages/worldgen/dist/client.mjs';
import { encodeGlb, seasonalPlantPresets } from '../../../packages/worldgen/dist/kernel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world/plant-preview');
await mkdir(out, { recursive: true });
const projectPath = resolve(out, 'project.json');
let project;
try {
  project = JSON.parse(await readFile(projectPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!project)
  await writeFile(
    projectPath,
    JSON.stringify(
      {
        format: 'molen/project@1',
        name: 'regional-plant-preview',
        scenes: { main: 'scene.json' },
        defaultScene: 'main',
        types: [],
        assets: {},
        reservations: [{ namespace: 'ecology', owner: 'regional-preview' }],
      },
      null,
      2,
    ),
  );
const { plants: sourcePlants } = JSON.parse(
  await readFile(new URL('../regional.catalog.json', import.meta.url), 'utf8'),
);
const plants = Object.values(
  seasonalPlantPresets(Object.fromEntries(sourcePlants.map((p) => [p.id, p]))),
);
const requested = process.argv
  .filter((arg) => arg.startsWith('--plant='))
  .map((arg) => arg.slice(8));
const names = requested.length
  ? requested
  : ['tropical_canopy', 'coconut', 'saguaro', 'acacia', 'cedar', 'mangrove', 'bamboo', 'fern'];
const evidence = [];
for (const name of names) {
  const p = plants.find((plant) => plant.id.endsWith(`.${name}`));
  if (!p) throw new Error(`Unknown preview plant ${name}`);
  const geometry = createPlantGeometry(p);
  const positions = new Float32Array(geometry.getAttribute('position').array);
  const normals = new Float32Array(geometry.getAttribute('normal').array);
  const colors = new Uint8Array(
    [...geometry.getAttribute('color').array].map((value) => Math.round(value * 255)),
  );
  const vertexCount = positions.length / 3;
  const indices = Uint32Array.from({ length: vertexCount }, (_, i) => i);
  const buffers = {
    positions,
    normals,
    colors,
    indices,
    uvs: new Float32Array(vertexCount * 2),
    vertexCount,
    triangleCount: vertexCount / 3,
    bytes: 0,
    groups: [{ start: 0, count: vertexCount, slot: 'wall', materialRef: 'palette:#ffffff' }],
  };
  const bytes = encodeGlb(
    buffers,
    [{ name: p.title, roughness: 0.92, metallic: 0 }],
    'Molen procedural plant visual QA',
  );
  geometry.dispose();
  const source = resolve(out, `${name}.source.glb`);
  await writeFile(source, bytes);
  const imported = await importAsset({
    path: source,
    id: `ecology.${name}`,
    projectPath,
    cwd: out,
    force: true,
    optimize: false,
  });
  if (!imported.ok) throw new Error(imported.error);
  const inspected = await inspectAsset({ ref: `ecology.${name}`, projectPath, verify: true });
  if (!inspected.ok) throw new Error(inspected.error);
  const shot = await screenshotAsset({
    ref: `ecology.${name}`,
    projectPath,
    outDir: resolve(out, name),
    angles: 3,
    size: [900, 900],
    reflections: true,
    antialias: true,
    clearColor: '#cbd8dc',
  });
  if (!shot.ok) throw new Error(shot.error);
  evidence.push({
    name,
    triangles: vertexCount / 3,
    hash: imported.sidecar?.hash,
    frames: shot.frames,
  });
  console.log(
    JSON.stringify({
      name,
      triangles: vertexCount / 3,
      frames: shot.frames?.map((frame) => frame.path),
    }),
  );
}
await writeFile(resolve(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);

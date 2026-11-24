import './../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeGlb,
  MeshBufferBuilder,
} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../../../../../../../packages/worldgen/scripts/architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hashBytes,
  readOptionalJson,
  writeIndex,
} from '../../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { buildMaster, surfaces } from './rila-courtyard-and-stone-chapels.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(dir, '../spec.json');
const sourcePath = resolve(dir, '../source.json');
const master = resolve(dir, 'source.glb');
const [spec, source] = await Promise.all([
  readOptionalJson(specPath),
  readOptionalJson(sourcePath),
]);
const author = createArchitecturalSurfaceAuthoring(surfaces);
const builder = new MeshBufferBuilder();
buildMaster(author.wrap(builder));
const mesh = builder.finalize();
validateAuthoredMesh(mesh, spec.assetId);
const materials = author.materials(mesh.groups);
const bytes = Buffer.from(encodeGlb(mesh, materials, 'Molen Pchelino Assumption Chapel master'));
const sha256 = hashBytes(bytes);
const min = [Infinity, Infinity, Infinity],
  max = [-Infinity, -Infinity, -Infinity];
for (const [i, value] of mesh.positions.entries()) {
  min[i % 3] = Math.min(min[i % 3], value);
  max[i % 3] = Math.max(max[i % 3], value);
}
const metrics = {
  actualBounds: { min, max },
  size: max.map((value, axis) => value - min[axis]),
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: materials.length,
    bytes: bytes.length,
    sha256,
  },
  sharedSurfaces: materials.flatMap(({ sharedSurface }) => sharedSurface ?? []),
};
const model = source.files.models[0];
if (process.argv.includes('--check')) {
  assert((await readFile(master)).equals(bytes));
  assert.equal(model.sha256, sha256);
  for (const [key, value] of Object.entries(metrics)) assert.deepEqual(spec[key], value);
} else {
  const save = (path, value) => writeIndex(path, `${JSON.stringify(value, null, 2)}\n`);
  await writeIndex(master, bytes);
  if (model.sha256 !== sha256) {
    model.sha256 = sha256;
    await save(sourcePath, source);
  }
  if (
    Object.keys(metrics).some((key) => JSON.stringify(spec[key]) !== JSON.stringify(metrics[key]))
  )
    await save(specPath, { ...spec, ...metrics });
}
console.log(`${spec.id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${sha256}`);

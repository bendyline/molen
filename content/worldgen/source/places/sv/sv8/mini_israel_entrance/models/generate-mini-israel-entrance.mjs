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
import { buildEntrance, surfaces } from './entrance-model.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(directory, '../spec.json');
const manifestPath = resolve(directory, '../source.json');
const destination = resolve(directory, 'source.glb');
const [spec, manifest, prior] = await Promise.all([
  readOptionalJson(specPath),
  readOptionalJson(manifestPath),
  readFile(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  }),
]);
const author = createArchitecturalSurfaceAuthoring(surfaces);
const builder = new MeshBufferBuilder();
buildEntrance(author.wrap(builder), 'master');
const mesh = builder.finalize();
validateAuthoredMesh(mesh, spec.assetId);
const materials = author.materials(mesh.groups);
const bytes = Buffer.from(encodeGlb(mesh, materials, 'Molen Mini Israel entrance master'));
const hash = hashBytes(bytes);
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
mesh.positions.forEach((coordinate, i) => {
  const axis = i % 3;
  min[axis] = Math.min(min[axis], coordinate);
  max[axis] = Math.max(max[axis], coordinate);
});
const metrics = {
  actualBounds: { min, max },
  size: max.map((value, axis) => value - min[axis]),
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: materials.length,
    bytes: bytes.length,
    sha256: hash,
  },
  sharedSurfaces: materials.flatMap((material) => material.sharedSurface ?? []),
};
const [model] = manifest.files.models;
if (process.argv.includes('--check')) {
  assert(prior?.equals(bytes), 'Mini Israel entrance master is missing or stale');
  assert.equal(model.sha256, hash);
  for (const [key, value] of Object.entries(metrics)) assert.deepEqual(spec[key], value);
} else {
  if (!prior?.equals(bytes)) await writeIndex(destination, bytes);
  const save = (path, value) => writeIndex(path, `${JSON.stringify(value, null, 2)}\n`);
  if (model.sha256 !== hash)
    await save(manifestPath, {
      ...manifest,
      files: { ...manifest.files, models: [{ ...model, sha256: hash }] },
    });
  if (
    Object.keys(metrics).some((key) => JSON.stringify(spec[key]) !== JSON.stringify(metrics[key]))
  )
    await save(specPath, { ...spec, ...metrics });
}
console.log(`${spec.id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${hash}`);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as denfert from '../../../content/worldgen/source/places/u0/u09/catacombs_denfert_entrance/models/denfert-entrance-model.mjs';
import * as reneCoty from '../../../content/worldgen/source/places/u0/u09/catacombs_rene_coty_exit/models/rene-coty-exit-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashBytes, readOptionalJson, root, writeIndex } from './structure-model-files.mjs';

const portals = {
  catacombs_denfert_entrance: denfert,
  catacombs_rene_coty_exit: reneCoty,
};
const selected =
  process.argv
    .find((arg) => arg.startsWith('--ids='))
    ?.slice(6)
    .split(',') ?? Object.keys(portals);
const check = process.argv.includes('--check');

for (const id of selected) {
  const portal = portals[id];
  if (!Object.hasOwn(portals, id)) throw new Error(`Unknown Catacombs portal ${id}`);
  const dir = resolve(root, 'content/worldgen/source/places/u0/u09', id);
  const specPath = resolve(dir, 'spec.json');
  const sourcePath = resolve(dir, 'source.json');
  const destination = resolve(dir, 'models/source.glb');
  const [spec, source, prior] = await Promise.all([
    readOptionalJson(specPath),
    readOptionalJson(sourcePath),
    readFile(destination).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    }),
  ]);
  const authoring = createArchitecturalSurfaceAuthoring(portal.surfaces);
  const builder = new MeshBufferBuilder();
  portal.buildMaster(authoring.wrap(builder));
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, id);
  const materials = authoring.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, spec.title));
  const signature = hashBytes(bytes);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((value, index) => {
    const axis = index % 3;
    min[axis] = Math.min(min[axis], value);
    max[axis] = Math.max(max[axis], value);
  });
  const metrics = {
    actualBounds: { min, max },
    size: max.map((value, i) => value - min[i]),
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: materials.length,
      bytes: bytes.length,
      sha256: signature,
    },
    sharedSurfaces: materials.flatMap((material) => material.sharedSurface ?? []),
  };
  const [model] = source.files.models;
  if (check) {
    assert(prior?.equals(bytes), `Stale master for ${id}`);
    assert.equal(model.sha256, signature);
    for (const [key, value] of Object.entries(metrics)) assert.deepEqual(spec[key], value);
  } else {
    if (!prior?.equals(bytes)) await writeIndex(destination, bytes);
    const save = (path, data) => writeIndex(path, `${JSON.stringify(data, null, 2)}\n`);
    if (model.sha256 !== signature) {
      model.sha256 = signature;
      await save(sourcePath, source);
    }
    if (
      Object.keys(metrics).some((key) => JSON.stringify(spec[key]) !== JSON.stringify(metrics[key]))
    )
      await save(specPath, { ...spec, ...metrics });
  }
  console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${signature}`);
}

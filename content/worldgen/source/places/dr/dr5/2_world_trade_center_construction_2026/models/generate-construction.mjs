import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  encodeGlb,
  MeshBufferBuilder,
} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../../../../../../../packages/worldgen/scripts/architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hashBytes,
  writeIndex,
} from '../../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { buildMaster, surfaces } from './construction-model.mjs';

export async function generateConstruction(moduleUrl, buildMaster, surfaces, label) {
  const specPath = fileURLToPath(new URL('../spec.json', moduleUrl));
  const manifestPath = fileURLToPath(new URL('../source.json', moduleUrl));
  const destination = fileURLToPath(new URL('source.glb', moduleUrl));
  const [spec, manifest, previous] = await Promise.all([
    readFile(specPath).then(JSON.parse),
    readFile(manifestPath).then(JSON.parse),
    readFile(destination).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    }),
  ]);
  const author = createArchitecturalSurfaceAuthoring(surfaces, { metricTriangleUv: true });
  const builder = new MeshBufferBuilder();
  buildMaster(author.wrap(builder));
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, spec.assetId);
  const materials = author.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, label));
  const hash = hashBytes(bytes);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((coordinate, index) => {
    const axis = index % 3;
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
    assert(previous?.equals(bytes));
    assert.equal(model.sha256, hash);
    for (const [key, value] of Object.entries(metrics)) assert.deepEqual(spec[key], value);
  } else {
    if (!previous?.equals(bytes)) await writeIndex(destination, bytes);
    const save = (path, data) => writeIndex(path, JSON.stringify(data, null, 2) + '\n');
    if (model.sha256 !== hash)
      await save(manifestPath, {
        ...manifest,
        files: { ...manifest.files, models: [{ ...model, sha256: hash }] },
      });
    if (
      Object.entries(metrics).some(
        ([key, value]) => JSON.stringify(spec[key]) !== JSON.stringify(value),
      )
    ) {
      await save(specPath, { ...spec, ...metrics });
    }
  }
  console.log(`${spec.id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${hash}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await generateConstruction(
    import.meta.url,
    buildMaster,
    surfaces,
    'Molen 2 World Trade Center construction, October 2026',
  );
}

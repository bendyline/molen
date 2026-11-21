import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
import { buildRomanianLocks, surfaces } from './romanian-lock-model.mjs';

const { files } = JSON.parse(await readFile(new URL('../source.json', import.meta.url)));
const [model] = files.models;
const destination = new URL('./source.glb', import.meta.url);
const old = await readFile(destination).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
const author = createArchitecturalSurfaceAuthoring(surfaces);
const builder = new MeshBufferBuilder();
buildRomanianLocks(author.wrap(builder), 'master');
const mesh = builder.finalize();
validateAuthoredMesh(mesh, model.assetId);
const bytes = Buffer.from(
  encodeGlb(mesh, author.materials(mesh.groups), 'Molen Iron Gate II Romanian locks master'),
);
const hash = hashBytes(bytes);
assert.equal(hash, model.sha256, 'Romanian locks master differs from the source manifest');
if (process.argv.includes('--check')) {
  assert(old?.equals(bytes), 'Cached Romanian locks master is missing or stale');
} else if (!old?.equals(bytes)) {
  await writeIndex(fileURLToPath(destination), bytes);
}
console.log(`${model.assetId}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${hash}`);

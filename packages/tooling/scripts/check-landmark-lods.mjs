/** Validate every registered runtime derivative without rebuilding the source masters. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validate } from '@bendyline/molen-schema';
import { landmarkLodRecipeHash } from './authored-landmark-lods.mjs';
import { LANDMARK_LOD_LEVELS } from './landmark-lods.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'), 'utf8'));
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .toLowerCase()
  .split(',');
const validatorPath = process.argv.find((arg) => arg.startsWith('--validator='))?.slice(12);
const validator = validatorPath
  ? (await import(pathToFileURL(resolve(root, validatorPath)).href)).default
  : undefined;
const reports = [];
const recipeHashes = new Set();
for (const [id, path] of Object.entries(pack.assets).filter(
  ([id]) =>
    id.startsWith('molen.worldgen.structure.') &&
    (!selection || selection.some((part) => id.includes(part))),
)) {
  const parsed = validate(
    'asset',
    JSON.parse(await readFile(resolve(root, 'content/worldgen', path), 'utf8')),
  );
  assert(parsed.ok, `${id}: ${parsed.formatted}`);
  const sidecar = parsed.value;
  const directory = resolve(root, 'content/worldgen', dirname(path));
  const master = await readFile(resolve(directory, sidecar.files.main));
  assert.equal(hash(master), sidecar.hash, `${id}: canonical master changed`);
  assert.equal(sidecar.runtimeLods?.masterHash, sidecar.hash, `${id}: stale LODs`);
  recipeHashes.add(sidecar.runtimeLods.recipeHash);
  assert.equal(
    sidecar.runtimeLods.recipeHash,
    await landmarkLodRecipeHash(id),
    `${id}: stale generator revision`,
  );
  const masterJson = JSON.parse(master.toString('utf8', 20, 20 + master.readUInt32LE(12)));
  const shared = new Set(
    (masterJson.materials ?? []).map((m) => m.extras?.molenSurface?.ref).filter(Boolean),
  );
  for (const [i, level] of sidecar.runtimeLods.levels.entries()) {
    assert.equal(sidecar.files.variants[level.name], level.file);
    const bytes = await readFile(resolve(directory, level.file));
    assert.equal(bytes.length, level.bytes);
    assert.equal(hash(bytes), level.hash);
    assert(
      level.triangles > 0 && (i > 0 || level.triangles <= LANDMARK_LOD_LEVELS[i].triangles * 4),
      `${id}/${level.name}: triangle budget`,
    );
    if (i === 0) assert(level.bytes <= 200000, `${id}: skyline download budget`);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.equal(gltf.images?.length ?? 0, 0, `${id}/${level.name}: embedded textures`);
    const types = new Map();
    const geometryViews = new Set();
    for (const mesh of gltf.meshes)
      for (const primitive of mesh.primitives) {
        for (const index of Object.values(primitive.attributes)) {
          const accessor = gltf.accessors[index];
          if (!types.has(accessor.bufferView)) types.set(accessor.bufferView, new Set());
          types.get(accessor.bufferView).add(accessor.componentType);
          geometryViews.add(accessor.bufferView);
        }
        if (primitive.indices !== undefined)
          geometryViews.add(gltf.accessors[primitive.indices].bufferView);
      }
    const geometryBytes = [...geometryViews].reduce(
      (sum, index) => sum + gltf.bufferViews[index].byteLength,
      0,
    );
    assert(
      level.cpuBytes >= geometryBytes && level.gpuBytes >= geometryBytes,
      `${id}/${level.name}: underestimated geometry reservation`,
    );
    for (const typesInView of types.values())
      assert.equal(typesInView.size, 1, `${id}/${level.name}: mixed-type GPU upload duplication`);
    for (const material of gltf.materials ?? []) {
      const ref = material.extras?.molenSurface?.ref;
      if (ref) assert(shared.has(ref), `${id}: unexpected shared material ${ref}`);
    }
    const issues = validator
      ? (await validator.validateBytes(bytes, { uri: `${id}/${level.file}`, maxIssues: 30 })).issues
      : undefined;
    assert.equal(issues?.numErrors ?? 0, 0, `${id}/${level.name}: ${JSON.stringify(issues)}`);
    reports.push({
      id,
      ...level,
      targetTriangles: LANDMARK_LOD_LEVELS[i].triangles,
      aboveTriangleTarget: level.triangles > LANDMARK_LOD_LEVELS[i].triangles * 1.1,
      ...(issues ? { errors: issues.numErrors, warnings: issues.numWarnings } : {}),
    });
  }
}
assert(reports.length > 0, 'No matching landmark assets');
const report = {
  models: reports.length / 4,
  derivatives: reports.length,
  khronosValidated: Boolean(validator),
  recipeHashes: [...recipeHashes],
  largest: Object.fromEntries(
    LANDMARK_LOD_LEVELS.map(({ name }) => [
      name,
      Math.max(...reports.filter((r) => r.name === name).map((r) => r.bytes)),
    ]),
  ),
  reports,
};
await mkdir(resolve(root, '.artifacts/landmark-lods'), { recursive: true });
await writeFile(
  resolve(
    root,
    `.artifacts/landmark-lods/${selection ? 'selected-validation' : 'validation'}.json`,
  ),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ ...report, reports: undefined }));

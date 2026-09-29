/** Resumable imports: --ids=N0002,map_smock_windmill selects a batch; --check writes nothing. */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { importAsset, inspectAsset } from '../../tooling/dist/index.mjs';
import { structureAssetDirectory, structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { collectionModelRefs, readStructureCollections } from './structure-collections.mjs';
import {
  authoredModels,
  content,
  projectPath,
  readOptionalJson,
  registerSourceDocuments,
  root,
  writeIndex,
} from './structure-model-files.mjs';

const stylepackPath = resolve(content, 'stylepack.json');
const catalogPath = resolve(content, 'source/next-1000/candidates.json');
const biome = resolve(root, 'packages/worldgen/node_modules/@biomejs/biome/bin/biome');
const check = process.argv.includes('--check');
const pack = JSON.parse(await readFile(stylepackPath, 'utf8'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const collections = await readStructureCollections(
  resolve(content, 'source/next-1000/collections.json'),
  catalog.candidates,
);
const models = await authoredModels();
for (const { dir, spec, sourcePath, sourceHash } of models) {
  const sidecarPath = structureAssetSidecarPath(spec.assetId);
  const existing = await readOptionalJson(resolve(content, sidecarPath));
  let inspected =
    existing?.sourceHash === sourceHash
      ? await inspectAsset({ ref: spec.assetId, projectPath, verify: true })
      : undefined;
  if (check && !inspected?.ok)
    throw new Error(`${spec.id}: missing, stale or corrupt runtime asset`);
  if (!check && (!inspected?.ok || process.argv.includes('--force'))) {
    const result = await importAsset({
      path: sourcePath,
      id: spec.assetId,
      assetDir: structureAssetDirectory(spec.assetId),
      projectPath,
      force: true,
      ...(spec.importOptions?.optimize === false ? { optimize: false } : {}),
    });
    if (!result.ok || result.registered !== true)
      throw new Error(`${spec.id}: ${result.error ?? 'import failed'}`);
    inspected = await inspectAsset({ ref: spec.assetId, projectPath, verify: true });
  }
  if (!inspected?.ok || inspected.sidecar?.sourceHash !== sourceHash)
    throw new Error(`${spec.id}: asset verification failed`);
  if (pack.assets[spec.assetId] !== undefined && pack.assets[spec.assetId] !== sidecarPath)
    throw new Error(`${spec.id}: conflicting style pack registration`);
  const candidate = catalog.candidates.find((entry) => entry.id === spec.id);
  if (/^N\d+$/.test(spec.id) && !candidate) throw new Error(`${spec.id}: catalog entry missing`);
  if (check) {
    if (
      pack.assets[spec.assetId] !== sidecarPath ||
      (candidate && candidate.modelRef !== spec.assetId)
    )
      throw new Error(`${spec.id}: missing catalog registration`);
    for (const collection of collections.filter((entry) =>
      entry.members.some((member) => member.id === spec.id),
    )) {
      const record = catalog.candidates.find((entry) => entry.id === collection.id);
      if (!record.modelRefs?.some((entry) => entry.id === spec.id && entry.asset === spec.assetId))
        throw new Error(`${spec.id}: missing collection reference`);
    }
  } else {
    pack.assets[spec.assetId] = sidecarPath;
    if (candidate) {
      candidate.status = 'modeled';
      candidate.modelRef = spec.assetId;
      // Import success never certifies appearance, orientation or real-world accuracy.
      candidate.modelQuality = spec.quality ?? 'study';
    }
    for (const collection of collections.filter((entry) =>
      entry.members.some((member) => member.id === spec.id),
    )) {
      const record = catalog.candidates.find((entry) => entry.id === collection.id);
      record.modelRefs = collectionModelRefs(collection, pack.assets);
      record.modelRef = null;
      record.status =
        record.modelRefs.length === collection.requiredCount ? 'modeled' : 'in-progress';
      record.modelQuality = 'independent-members';
    }
    const formatted = execFileSync(
      process.execPath,
      [biome, 'format', '--stdin-file-path', stylepackPath],
      {
        input: JSON.stringify(pack),
        encoding: 'utf8',
      },
    );
    await writeIndex(stylepackPath, formatted);
    await writeIndex(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await writeFile(
      resolve(dir, 'import-report.json'),
      `${JSON.stringify(
        {
          format: 'molen/structure-import-report@1',
          assetId: spec.assetId,
          sourceHash,
          runtimeHash: inspected.sidecar.hash,
          stats: inspected.sidecar.stats,
          bounds: inspected.sidecar.bounds,
          verified: true,
        },
        null,
        2,
      )}\n`,
    );
    await registerSourceDocuments(dir, ['import-report.json']);
  }
  console.log(
    `${spec.id}: verified ${inspected.sidecar.stats.triangles} triangles, ${inspected.sidecar.stats.sizeBytes} bytes`,
  );
}
console.log(
  `Verified ${models.length} authored models; placement and visual approval are separate checks.`,
);

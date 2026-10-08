/** Hash-bound, resumable lit and turntable captures. Images still require visual inspection. */
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';
import { hashEvidenceText, matchesEvidenceText } from './evidence-text-hash.mjs';
import {
  authoredModels,
  content,
  hashBytes,
  projectPath,
  readOptionalJson,
  registerSourceDocuments,
} from './structure-model-files.mjs';

const usage =
  'Usage: node packages/worldgen/scripts/capture-next-1000-models.mjs [--ids=N0001,N0002] [--reflections] [--antialias] [--fit-shadows] [--force]';
if (process.argv.includes('--help')) {
  console.log(usage);
  process.exit(0);
}
for (const arg of process.argv.slice(2)) {
  if (
    !['--reflections', '--antialias', '--fit-shadows', '--force'].includes(arg) &&
    !/^--ids=[A-Za-z0-9_,.-]+$/.test(arg)
  ) {
    throw new Error(`Unknown argument ${arg}. ${usage}`);
  }
}

const project = await readOptionalJson(projectPath);
const reflections = process.argv.includes('--reflections');
const antialias = process.argv.includes('--antialias');
const fitShadows = process.argv.includes('--fit-shadows');
for (const { dir, spec, sourceHash, inputHash } of await authoredModels()) {
  const sidecarPath = project?.assets?.[spec.assetId];
  if (!sidecarPath) throw new Error(`${spec.id}: runtime asset is not registered`);
  const sidecar = await readOptionalJson(resolve(content, sidecarPath));
  if (!sidecar || sidecar.sourceHash !== sourceHash)
    throw new Error(`${spec.id}: import current model first`);
  const scenePath = resolve(dir, 'scene.json');
  const sceneBytes = await readFile(scenePath);
  const sceneHash = hashEvidenceText(sceneBytes);
  const reportPath = resolve(dir, 'capture-report.json');
  const previous = await readOptionalJson(reportPath);
  const current =
    previous?.inputHash === inputHash &&
    matchesEvidenceText(sceneBytes, previous?.sceneHash) &&
    previous?.captureVersion === 3 &&
    (previous?.antialias ?? false) === antialias &&
    (previous?.fitShadows ?? false) === fitShadows &&
    (previous?.reflectionMode ?? 'none') === (reflections ? 'sky-pmrem' : 'none') &&
    previous?.qaCamerasHash === hashBytes(JSON.stringify(spec.qaCameras ?? {}));
  if (current && !process.argv.includes('--force')) {
    let complete = true;
    for (const frame of previous.frames) {
      try {
        if (hashBytes(await readFile(resolve(dir, frame.path))) !== frame.hash) complete = false;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        complete = false;
      }
    }
    if (complete) {
      console.log(`${spec.id}: current captures retained`);
      continue;
    }
  }
  const scene = await screenshotScene({
    fitShadows,
    antialias,
    reflections,
    scenePath,
    projectPath,
    ticks: 30,
    size: [1600, 1000],
    outPath: resolve(dir, 'preview.png'),
  });
  if (!scene.ok || (scene.renderStats?.triangles ?? 0) < 100)
    throw new Error(
      `${spec.id}: lit capture failed: ${scene.error ?? JSON.stringify(scene.renderStats)}`,
    );
  const turntable = await screenshotAsset({
    antialias,
    reflections,
    ref: spec.assetId,
    projectPath,
    angles: 4,
    size: [1200, 900],
    outDir: resolve(dir, 'shots/turntable'),
  });
  if (!turntable.ok || turntable.frames?.length !== 4)
    throw new Error(`${spec.id}: turntable failed: ${turntable.error ?? 'missing frames'}`);
  const paths = [scene.imagePath, ...turntable.frames.map((frame) => frame.path)];
  const cameras = Array.isArray(spec.qaCameras)
    ? spec.qaCameras.map(({ name, position, lookAt }) => [name, { position, lookAt }])
    : Object.entries(spec.qaCameras ?? {});
  for (const [name, camera] of cameras) {
    if (!/^[a-z0-9_-]+$/.test(name)) throw new Error(`${spec.id}: invalid QA camera name`);
    const shot = await screenshotScene({
      fitShadows,
      antialias,
      reflections,
      scenePath,
      projectPath,
      ticks: 30,
      camera,
      size: [1600, 1000],
      outPath: resolve(dir, `shots/${name}.png`),
    });
    if (!shot.ok || (shot.renderStats?.triangles ?? 0) < 100)
      throw new Error(`${spec.id}: ${name} capture failed: ${shot.error ?? 'empty render'}`);
    paths.push(shot.imagePath);
  }
  const frames = await Promise.all(
    paths.map(async (path) => ({
      path: relative(dir, path).replaceAll('\\', '/'),
      hash: hashBytes(await readFile(path)),
    })),
  );
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        format: 'molen/structure-capture-report@1',
        captureVersion: 3,
        ...(antialias ? { antialias: true } : {}),
        ...(fitShadows ? { fitShadows: true } : {}),
        ...(reflections ? { reflectionMode: 'sky-pmrem' } : {}),
        assetId: spec.assetId,
        qaCamerasHash: hashBytes(JSON.stringify(spec.qaCameras ?? {})),
        inputHash,
        sceneHash,
        frames,
        stateHash: scene.stateHash,
        renderStats: scene.renderStats,
        review: 'Captured; images require inspection. This is not visual or placement approval.',
      },
      null,
      2,
    )}\n`,
  );
  await registerSourceDocuments(dir, ['capture-report.json']);
  console.log(`${spec.id}: lit preview + ${turntable.frames.length} turntable views`);
}

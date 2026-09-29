/** Hash-bound, resumable lit and turntable captures. Images still require visual inspection. */
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';
import {
  authoredModels,
  content,
  hashBytes,
  projectPath,
  readOptionalJson,
  registerSourceDocuments,
} from './structure-model-files.mjs';

const project = await readOptionalJson(projectPath);
for (const { dir, spec, sourceHash } of await authoredModels()) {
  const sidecarPath = project?.assets?.[spec.assetId];
  if (!sidecarPath) throw new Error(`${spec.id}: runtime asset is not registered`);
  const sidecar = await readOptionalJson(resolve(content, sidecarPath));
  if (!sidecar || sidecar.sourceHash !== sourceHash)
    throw new Error(`${spec.id}: import current model first`);
  const scenePath = resolve(dir, 'scene.json');
  const sceneHash = hashBytes(await readFile(scenePath));
  const reportPath = resolve(dir, 'capture-report.json');
  const previous = await readOptionalJson(reportPath);
  const current =
    previous?.sourceHash === sourceHash &&
    previous?.runtimeHash === sidecar.hash &&
    previous?.sceneHash === sceneHash &&
    previous?.captureVersion === 3 &&
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
        assetId: spec.assetId,
        qaCamerasHash: hashBytes(JSON.stringify(spec.qaCameras ?? {})),
        sourceHash,
        runtimeHash: sidecar.hash,
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

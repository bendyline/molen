/** Render all 97 generated models in a lit Molen scene and two neutral turntable angles. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';
import { assertSourceRegistryCurrent } from './structure-model-files.mjs';
import { knownSourceEntries, structureSourceDirectory } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const projectPath = resolve(root, 'content/worldgen/project.json');
const sceneOnly = process.argv.includes('--scene-only');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
await assertSourceRegistryCurrent();
const dirs = knownSourceEntries()
  .filter((entry) => entry.collection === 'site-structures' && /^[a-e]\d{2}_/.test(entry.key))
  .map((entry) => entry.key)
  .sort();
if (dirs.length !== 97) throw new Error(`Expected 97 models, found ${dirs.length}`);

let totalTriangles = 0;
let captured = 0;
for (const key of dirs) {
  const dir = structureSourceDirectory(key);
  const spec = JSON.parse(await readFile(resolve(dir, 'spec.json'), 'utf8'));
  if (selected !== undefined && !selected.includes(spec.planId)) continue;
  const scene = await screenshotScene({
    scenePath: resolve(dir, 'scene.json'),
    projectPath,
    ticks: 30,
    size: [1280, 720],
    outPath: resolve(dir, 'preview.png'),
  });
  if (
    !scene.ok ||
    (scene.renderStats?.triangles ?? 0) < 50 ||
    scene.renderStats?.entitiesRendered !== 2
  )
    throw new Error(
      `${spec.planId}: scene capture failed: ${scene.error ?? JSON.stringify(scene.renderStats)}`,
    );
  if (sceneOnly) {
    totalTriangles += scene.renderStats.triangles - 12;
    console.log(`${spec.planId}: lit scene preview`);
  } else {
    const turntable = await screenshotAsset({
      ref: spec.id,
      projectPath,
      angles: 2,
      size: [720, 480],
      outDir: resolve(dir, 'shots/turntable'),
    });
    if (!turntable.ok || turntable.frames?.length !== 2)
      throw new Error(`${spec.planId}: turntable failed: ${turntable.error ?? 'missing frames'}`);
    totalTriangles += turntable.triangles ?? 0;
    console.log(
      `${spec.planId}: preview and two turntable angles, ${turntable.triangles} triangles`,
    );
  }
  captured++;
}
if (selected !== undefined && captured !== selected.length)
  throw new Error(`Selected ${selected.length} IDs but captured ${captured}`);
console.log(`Captured ${captured} new assets, ${totalTriangles} source triangles total.`);

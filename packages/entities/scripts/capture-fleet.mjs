/** Review recipe-backed models and both demo scenes using the built Molen renderer. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const report = [];
for (const category of ['vehicles', 'cycles', 'watercraft']) {
  for (const name of (await readdir(`${root}/source/${category}`)).sort()) {
    if (selection && !selection.includes(name)) continue;
    const directory = `${root}/source/${category}/${name}`;
    const raw = await readFile(`${directory}/models/recipe.json`, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!raw) continue;
    const recipe = JSON.parse(raw);
    const result = await screenshotAsset({
      ref: recipe.id,
      projectPath: `${root}/project.json`,
      outDir: `${directory}/shots`,
      angles: 4,
      size: [640, 480],
      reflections: true,
      antialias: true,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    report.push({ id: recipe.id, ...result });
    console.log(recipe.id);
  }
}
if (!report.length) throw new Error('No fleet recipes matched.');
await mkdir(`${root}/shots`, { recursive: true });
await writeFile(
  `${root}/shots/${selection ? 'selected-capture-report' : 'capture-report'}.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
if (!selection) {
  for (const name of ['fleet', 'harbor']) {
    const result = await screenshotScene({
      scenePath: `${root}/scenes/${name}.scene.json`,
      ticks: 90,
      outPath: `${root}/shots/${name}.png`,
      size: [1600, 1000],
      reflections: true,
      antialias: true,
      fitShadows: true,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    console.log(name, JSON.stringify(result));
  }
}

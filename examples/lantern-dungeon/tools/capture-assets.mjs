import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotAsset } from '@bendyline/molen-tooling';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = JSON.parse(await readFile(resolve(root, 'asset-src/catalog.json'), 'utf8')).assets;
const out = resolve(root, '.artifacts/assets');
await mkdir(out, { recursive: true });
const results = [];
for (const a of assets) {
  const r = await screenshotAsset({
    ref: a.id,
    projectPath: resolve(root, 'project.json'),
    outDir: resolve(out, a.name),
    angles: 4,
    size: [384, 384],
    clearColor: '#25343d',
    ...(a.clips.includes('idle') ? { clip: 'idle', clipTime: 0.25 } : {}),
  });
  if (!r.ok) throw new Error(`${a.id}: ${r.error}`);
  results.push({ id: a.id, ...r });
  console.log(`Captured ${a.id}`);
}
await writeFile(resolve(out, 'capture-report.json'), JSON.stringify(results, null, 2));

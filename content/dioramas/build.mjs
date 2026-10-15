// Publishable JavaScript scenes. Content stays outside npm; no uploads happen here.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripScriptTypes } from '../../packages/client/dist/vite.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(await readFile(resolve(root, 'project.json'), 'utf8'));
for (const [name, path] of Object.entries(project.scenes)) {
  const source = dirname(resolve(root, path));
  const out = resolve(root, 'dist', name);
  const scene = JSON.parse(await readFile(resolve(root, path), 'utf8'));
  await mkdir(resolve(out, 'scripts'), { recursive: true });
  for (const script of scene.scripts ?? []) {
    if (!script.path) continue;
    const filename = resolve(source, script.path);
    const code = stripScriptTypes(await readFile(filename, 'utf8'), filename);
    script.path = script.path.replace(/\.ts$/, '.js');
    await writeFile(resolve(out, script.path), code);
  }
  await writeFile(resolve(out, 'scene.json'), `${JSON.stringify(scene, null, 2)}\n`);
  await writeFile(resolve(out, 'bounds.json'), await readFile(resolve(source, 'bounds.json')));
}
await writeFile(
  resolve(root, 'dist/placements.json'),
  await readFile(resolve(root, 'placements.json')),
);
console.log(
  `Built ${Object.keys(project.scenes).length} JavaScript dioramas in content/dioramas/dist`,
);

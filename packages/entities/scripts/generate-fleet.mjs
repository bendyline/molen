/** Generate only recipe-backed fleet models. --ids=slug,slug narrows the authoring loop. */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { fleetModel } from './fleet-geometry.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities/source');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
let count = 0;
for (const category of ['vehicles', 'cycles', 'watercraft']) {
  for (const name of (await readdir(resolve(root, category))).sort()) {
    if (selection && !selection.includes(name)) continue;
    const directory = resolve(root, category, name);
    const recipeText = await readFile(resolve(directory, 'models/recipe.json'), 'utf8').catch(
      (e) => {
        if (e.code === 'ENOENT') return undefined;
        throw e;
      },
    );
    if (!recipeText) continue;
    const recipe = JSON.parse(recipeText);
    const sourcePath = resolve(directory, 'source.json');
    const sourceText = await readFile(sourcePath, 'utf8');
    const source = JSON.parse(sourceText);
    const pin = source.files.models.find((m) => m.path === 'models/source.glb').sha256;
    const bytes = Buffer.from(
      await new GLTFExporter().parseAsync(fleetModel(recipe), { binary: true }),
    );
    const path = resolve(directory, 'models/source.glb');
    const previous = await readFile(path).catch((e) => {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    });
    if (previous && hash(previous) !== pin && !previous.equals(bytes))
      throw new Error(`Preserving artist edits: ${path}`);
    if (process.argv.includes('--check')) {
      if (!previous?.equals(bytes) || hash(bytes) !== pin)
        throw new Error(`Stale fleet model: ${path}`);
    } else {
      if (!previous?.equals(bytes)) await writeFile(path, bytes);
      if (pin !== hash(bytes)) await writeFile(sourcePath, sourceText.replace(pin, hash(bytes)));
    }
    console.log(`${recipe.id}: ${bytes.length} bytes ${hash(bytes)}`);
    count++;
  }
}
if (!count) throw new Error('No fleet recipes matched.');

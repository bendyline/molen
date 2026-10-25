/** Generate only recipe-backed fleet models. --ids=slug,slug narrows the authoring loop. */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fleetModel } from './fleet-geometry.mjs';
import { roadVehicleModel } from './road-vehicle-geometry.mjs';
import { recreationalVehicleModel } from './rv-geometry.mjs';
import { addCarDetail } from './vehicle-detail.mjs';

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
    const output = recipe.master ? 'models/detailed.glb' : 'models/source.glb';
    const pin = source.files.models.find((m) => m.path === output).sha256;
    const definition = JSON.parse(await readFile(resolve(directory, 'entity.types.json'), 'utf8'));
    const components = definition.types[recipe.id].components;
    const driverEye = components.vehicle?.spec.driverEye ?? components.boat?.spec.driverEye;
    let model;
    if (recipe.master) {
      const master = await readFile(resolve(directory, 'models', recipe.master));
      model = (
        await new GLTFLoader().parseAsync(
          master.buffer.slice(master.byteOffset, master.byteOffset + master.byteLength),
          '',
        )
      ).scene;
      model.traverse((node) => {
        if (node.material?.name === 'vehicle-paint-and-trim') node.material.color.set(recipe.color);
      });
      addCarDetail(model, { ...recipe, driverEye }, true);
    } else {
      const generate =
        recipe.family === 'recreational-vehicle'
          ? recreationalVehicleModel
          : recipe.family === 'road-vehicle'
            ? roadVehicleModel
            : fleetModel;
      model = generate({
        ...recipe,
        driverEye,
      });
    }
    const bytes = Buffer.from(await new GLTFExporter().parseAsync(model, { binary: true }));
    const path = resolve(directory, output);
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

/** Refresh collision metadata only; no model generation or import. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { validate } from '@bendyline/molen-schema';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { completeVehicleCollisionParts } from './vehicle-collision-parts.mjs';

const sourceRoot = new URL('../../../content/entities/source/', import.meta.url);
const check = process.argv.includes('--check');
let count = 0,
  vehicles = 0;
for (const family of ['vehicles', 'cycles', 'transit']) {
  const root = new URL(family + '/', sourceRoot);
  for (const slug of await readdir(root)) {
    const file = new URL(`${slug}/entity.types.json`, root);
    const old = await readFile(file, 'utf8'),
      document = JSON.parse(old);
    const vehicle = Object.values(document.types)[0].components.vehicle;
    if (!vehicle) continue;
    const source = JSON.parse(await readFile(new URL(`${slug}/source.json`, root), 'utf8'));
    const model = source.files.models.find((m) => m.assetId);
    const bytes = await readFile(new URL(`${slug}/${model.path}`, root));
    const loader = new GLTFLoader().register(() => ({
      name: 'collision-geometry-only',
      loadTexture: () => Promise.resolve(null),
    }));
    const { scene } = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    completeVehicleCollisionParts(scene, vehicle);
    const result = validate('types', document);
    if (!result.ok) throw Error(`${slug}: ${result.formatted}`);
    if (JSON.stringify(JSON.parse(old)) !== JSON.stringify(document)) {
      if (check)
        throw Error(
          `${slug}: stale vehicle collision metadata; run node packages/entities/scripts/update-vehicle-collision.mjs`,
        );
      const temp = new URL(`${file.href}.${process.pid}.tmp`);
      try {
        await writeFile(temp, `${JSON.stringify(document, null, 2)}\n`);
        await rename(temp, file);
      } finally {
        await rm(temp, { force: true });
      }
    }
    count += vehicle.spec.collisionParts?.length ?? 0;
    vehicles++;
    scene.traverse((node) => node.geometry?.dispose());
  }
}
console.log(
  `${check ? 'Checked' : 'Updated'} ${count} parts across ${vehicles} road vehicles; geometry untouched.`,
);

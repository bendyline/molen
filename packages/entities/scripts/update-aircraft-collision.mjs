/** Refresh only collision metadata from installed source GLBs; geometry is never regenerated. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { validate } from '@bendyline/molen-schema';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { completeAircraftCollisionParts } from './aircraft-collision-parts.mjs';

const root = new URL('../../../content/entities/source/aircraft/', import.meta.url);
const check = process.argv.includes('--check');
let count = 0;
for (const slug of await readdir(root)) {
  const file = new URL(`${slug}/entity.types.json`, root);
  const old = await readFile(file, 'utf8');
  const document = JSON.parse(old);
  const spec = Object.values(document.types)[0].components.aircraft.spec;
  if (!spec.visual.rotors.length) continue;
  const bytes = await readFile(new URL(`${slug}/models/source.glb`, root));
  // Collision extraction needs positions and hierarchy, never textures or a DOM image loader.
  const loader = new GLTFLoader().register(() => ({
    name: 'collision-geometry-only',
    loadTexture: () => Promise.resolve(null),
  }));
  const { scene } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  completeAircraftCollisionParts(scene, spec);
  const result = validate('types', document);
  if (!result.ok) throw Error(`${slug}: ${result.formatted}`);
  if (JSON.stringify(JSON.parse(old)) !== JSON.stringify(document)) {
    if (check)
      throw Error(
        `${slug}: stale rotor collision metadata; run node packages/entities/scripts/update-aircraft-collision.mjs`,
      );
    const temporary = new URL(`${file.href}.${process.pid}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  count += spec.visual.rotors.length;
  scene.traverse((node) => node.geometry?.dispose());
}
console.log(
  `${check ? 'Checked' : 'Updated'} ${count} independent rotor/propeller discs; geometry untouched.`,
);

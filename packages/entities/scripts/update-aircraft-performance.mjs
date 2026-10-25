import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { validate } from '@bendyline/molen-schema';
import { performanceLedger, tuneAircraftPerformance } from './aircraft-performance.mjs';

const root = new URL('../../../content/entities/', import.meta.url);
const check = process.argv.includes('--check');
for (const p of performanceLedger.aircraft) {
  const path = new URL(`source/aircraft/${p.slug}/entity.types.json`, root);
  const old = await readFile(path, 'utf8');
  const document = JSON.parse(old);
  tuneAircraftPerformance(p.id, document.types[p.id].components.aircraft.spec);
  const result = validate('types', document);
  if (!result.ok) throw Error(`${p.id}: ${result.formatted}`);
  // Compare values, not formatter whitespace.
  if (JSON.stringify(JSON.parse(old)) !== JSON.stringify(document)) {
    if (check) throw Error(`${p.id}: stale flight metadata; run aircraft:calibrate`);
    const temporary = new URL(`${path.href}.${process.pid}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
console.log(
  `${check ? 'Checked' : 'Updated'} ${performanceLedger.aircraft.length} flight profiles; geometry untouched.`,
);

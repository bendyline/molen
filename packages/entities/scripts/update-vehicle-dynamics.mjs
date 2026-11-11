/**
 * Write every road vehicle's handling and performance from the dynamics ledger
 * (content/entities/source/vehicle-dynamics.json) into its source bundle's entity.types.json.
 * `--check` fails on stale metadata instead of writing; `--report` prints what each car does
 * beside its reference figures; `--ids=slug,slug` narrows the run. Geometry is untouched.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { validate } from '@bendyline/molen-schema';
import {
  dynamicsLedger,
  measureVehicleDynamics,
  tuneVehicleDynamics,
} from './vehicle-dynamics.mjs';

const root = new URL('../../../content/entities/', import.meta.url);
const check = process.argv.includes('--check');
const report = process.argv.includes('--report');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');

// Each ledger id's source bundle, found by the id its source.json declares.
const bundles = new Map();
for (const category of ['vehicles', 'transit']) {
  const directory = new URL(`source/${category}/`, root);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = JSON.parse(
      await readFile(new URL(`${entry.name}/source.json`, directory), 'utf8'),
    );
    bundles.set(manifest.id, {
      slug: entry.name,
      path: new URL(`${entry.name}/entity.types.json`, directory),
    });
  }
}

let stale = 0;
const rows = [];
for (const row of dynamicsLedger.vehicles) {
  const bundle = bundles.get(row.id);
  if (!bundle) throw Error(`${row.id}: no source bundle`);
  if (selection && !selection.includes(bundle.slug)) continue;
  const old = await readFile(bundle.path, 'utf8');
  const document = JSON.parse(old);
  const components = document.types[row.id].components;
  tuneVehicleDynamics(row, components);
  const result = validate('types', document);
  if (!result.ok) throw Error(`${row.id}: ${result.formatted}`);
  if (report) rows.push({ row, measured: measureVehicleDynamics(components.vehicle.spec) });
  // Compare values, not formatter whitespace.
  if (JSON.stringify(JSON.parse(old)) === JSON.stringify(document)) continue;
  stale++;
  if (check) continue;
  const temporary = new URL(`${bundle.path.href}.${process.pid}.tmp`);
  try {
    // Keep the bundle's own line endings: the tree mixes CRLF and LF.
    const text = `${JSON.stringify(document, null, 2)}\n`;
    await writeFile(temporary, old.includes('\r\n') ? text.replaceAll('\n', '\r\n') : text);
    await rename(temporary, bundle.path);
  } finally {
    await rm(temporary, { force: true });
  }
}
if (report) {
  const cell = (value, width) => String(value).padStart(width);
  console.log(`${'vehicle'.padEnd(34)} 0-100 s (ref)   top km/h (ref)   grip g (ref)   stop m`);
  for (const { row, measured } of rows)
    console.log(
      `${row.id.replace('molen.entities.', '').padEnd(34)}` +
        `${cell(measured.zeroTo100S.toFixed(1), 6)} ${cell(`(${row.zeroTo100S})`, 7)}` +
        `${cell(measured.topSpeedKmh, 9)} ${cell(`(${row.topSpeedKmh})`, 7)}` +
        `${cell(measured.lateralG.toFixed(2), 9)} ${cell(`(${row.lateralG})`, 7)}` +
        `${cell(measured.stoppingM.toFixed(1), 9)}`,
    );
}
if (check && stale > 0)
  throw Error(`${stale} vehicles have stale driving metadata; run vehicles:calibrate`);
console.log(
  `${check ? 'Checked' : 'Updated'} ${selection ? rows.length || 'selected' : dynamicsLedger.vehicles.length} driving profiles${check ? '' : ` (${stale} changed)`}; geometry untouched.`,
);

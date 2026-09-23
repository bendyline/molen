// Build runtime landmark manifests and their catalog from per-landmark source bundles.
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@bendyline/molen-schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The default style pack is content, not package source: it lives in content/worldgen.
const content = resolve(root, '../../content/worldgen');
const sourceRoot = resolve(content, 'source/landmarks');
const runtimeRoot = resolve(content, 'landmarks');
const sourceCatalog = JSON.parse(
  await readFile(resolve(content, 'source/shared/landmark-library/catalog.json'), 'utf8'),
);
const check = process.argv.includes('--check');
const biome = resolve(
  root,
  'node_modules/.bin',
  process.platform === 'win32' ? 'biome.cmd' : 'biome',
);

function formatJson(value, path) {
  return execFileSync(biome, ['format', '--stdin-file-path', path], {
    input: JSON.stringify(value, null, 2),
    encoding: 'utf8',
  });
}

async function emit(path, contents) {
  const previous = await readFile(path, 'utf8').catch(() => undefined);
  if (previous?.replaceAll('\r\n', '\n') === contents) return;
  if (check) throw new Error(`${path} is stale; regenerate the worldgen landmark pack`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

const entries = [];
for (const item of await readdir(sourceRoot, { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const directory = resolve(sourceRoot, item.name);
  const manifest = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
  const checked = validate('source-bundle', manifest);
  if (!checked.ok) throw new Error(`${directory}/source.json\n${checked.formatted}`);
  if (manifest.kind !== 'landmark') throw new Error(`${directory}: expected landmark source`);
  const landmark = JSON.parse(await readFile(resolve(directory, 'landmark.json'), 'utf8'));
  const runtimeName = landmark.id.startsWith('sign.')
    ? landmark.id.slice('sign.'.length)
    : landmark.id;
  const path = `${runtimeName}.landmark.json`;
  entries.push([manifest.id, path, landmark]);
}
const byId = new Map(entries.map((entry) => [entry[0], entry]));
const catalogEntries = Object.entries(sourceCatalog.models).map(([id, path]) => {
  const entry = byId.get(id);
  if (entry === undefined) throw new Error(`Landmark catalog references missing source ${id}`);
  if (entry[1] !== path) {
    throw new Error(`Landmark catalog path for ${id} is ${path}; generated path is ${entry[1]}`);
  }
  byId.delete(id);
  return entry;
});
if (byId.size > 0) {
  throw new Error(`Landmark sources missing from catalog: ${[...byId.keys()].join(', ')}`);
}
const sortedEntries = [...entries].sort((a, b) => (a[1] < b[1] ? -1 : 1));

for (const [, path, landmark] of sortedEntries) {
  await emit(resolve(runtimeRoot, path), formatJson(landmark, path));
}
const catalogPath = resolve(runtimeRoot, 'catalog.json');
await emit(
  catalogPath,
  formatJson(
    {
      format: 'molen/landmark-catalog@1',
      version: sourceCatalog.version,
      models: Object.fromEntries(catalogEntries.map(([id, path]) => [id, path])),
    },
    catalogPath,
  ),
);

console.log(`${check ? 'Verified' : 'Generated'} ${sortedEntries.length} landmark source bundles.`);

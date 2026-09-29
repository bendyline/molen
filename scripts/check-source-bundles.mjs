import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../packages/schema/dist/index.mjs';
import { readBuilt, readLock } from './asset-packs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set([
  '.git',
  '.artifacts',
  'assets',
  'dist',
  'node_modules',
  'public',
  'shots',
]);
const sourceManifests = [];
const generatedDirectories = new Set(['.artifacts', 'assets', 'build', 'dist', 'public', 'shots']);

async function discover(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      await discover(resolve(directory, entry.name));
    } else if (entry.isFile() && entry.name === 'source.json') {
      sourceManifests.push(resolve(directory, entry.name));
    }
  }
}

for (const base of ['assets', 'content', 'examples', 'packages'])
  await discover(resolve(root, base));

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
// Pins are Linux x64 bytes. A model this machine built for the current lock may differ from its
// pin on another host (content/ASSET-PACKS.md); the Assets workflow checks the pinned bytes.
const built = await readBuilt(root);
const builtHere = built.release === (await readLock(root)).release ? built.files : {};
const builtHash = (path) => builtHere[relative(root, path).split(sep).join('/')];
const listedPaths = (manifest) => [
  ...manifest.files.definitions,
  ...manifest.files.models.map((entry) => entry.path),
  ...(manifest.files.generators ?? []).map((entry) => entry.path),
  ...manifest.files.scripts.map((entry) => entry.path),
  ...manifest.files.textures.map((entry) => entry.path),
  ...manifest.files.sounds.map((entry) => entry.path),
  ...manifest.files.documents,
];

async function ownedFiles(directory, relativeDirectory = '') {
  const files = [];
  for (const entry of await readdir(resolve(directory, relativeDirectory), {
    withFileTypes: true,
  })) {
    const path = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!generatedDirectories.has(entry.name)) files.push(...(await ownedFiles(directory, path)));
    } else if (entry.isFile() && path !== 'source.json' && entry.name !== '.DS_Store') {
      files.push(path);
    }
  }
  return files;
}

async function projectRoot(directory) {
  let current = directory;
  let packageRoot;
  while (current.startsWith(root)) {
    // A bundle's outputs are relative to the project or content pack that owns it.
    for (const marker of ['project.json', 'molen-pack.source.json']) {
      try {
        await access(resolve(current, marker));
        return current;
      } catch {}
    }
    try {
      await access(resolve(current, 'package.json'));
      packageRoot ??= current;
    } catch {}
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return packageRoot ?? directory;
}

for (const manifestPath of sourceManifests.sort()) {
  const directory = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const checked = validate('source-bundle', manifest);
  if (!checked.ok) throw new Error(`${manifestPath}\n${checked.formatted}`);
  const listed = new Set(listedPaths(manifest));
  for (const owned of listed) await access(resolve(directory, owned));
  const omitted = (await ownedFiles(directory)).filter((path) => !listed.has(path));
  if (omitted.length > 0) {
    throw new Error(`${manifestPath}: source files missing from manifest: ${omitted.join(', ')}`);
  }
  const outputRoot = await projectRoot(directory);
  for (const model of manifest.files.models) {
    const modelPath = resolve(directory, model.path);
    const actual = hash(await readFile(modelPath));
    if (
      model.sha256 !== undefined &&
      actual !== model.sha256 &&
      actual !== `sha256:${builtHash(modelPath)}`
    ) {
      throw new Error(`${manifestPath}: ${model.path} does not match ${model.sha256}`);
    }
    if (model.output === undefined || model.assetId === undefined) continue;
    const sidecarPath = resolve(outputRoot, model.output);
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
    if (sidecar.id !== model.assetId) {
      throw new Error(`${sidecarPath}: expected asset id ${model.assetId}`);
    }
    if (model.pipeline === 'import' && sidecar.sourceHash !== model.sha256) {
      throw new Error(`${sidecarPath}: sourceHash does not match ${model.path}`);
    }
    if (model.pipeline === 'copy' && sidecar.hash !== model.sha256) {
      throw new Error(`${sidecarPath}: runtime hash does not match ${model.path}`);
    }
  }
}

console.log(`Verified ${sourceManifests.length} logical source bundles.`);

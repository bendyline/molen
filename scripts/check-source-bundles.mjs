import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { validate } from '../packages/schema/dist/index.mjs';
import { readLock, readMasters } from './asset-packs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set([
  '.git',
  '.artifacts',
  'assets',
  'dist',
  'node_modules',
  'public',
  'shots',
]);
const generatedDirectories = new Set(['.artifacts', 'assets', 'build', 'dist', 'public', 'shots']);

async function discover(directory, sourceManifests) {
  try {
    await access(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      await discover(resolve(directory, entry.name), sourceManifests);
    } else if (entry.isFile() && entry.name === 'source.json') {
      sourceManifests.push(resolve(directory, entry.name));
    }
  }
}

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
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

async function projectRoot(root, directory) {
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

export async function checkSourceBundles({
  root = ROOT,
  allowUnlocked = false,
  log = console.log,
} = {}) {
  const sourceManifests = [];
  for (const base of ['assets', 'content', 'examples', 'packages'])
    await discover(resolve(root, base), sourceManifests);

  // A pinned source or runtime GLB (or an authored master) makes the entire bundle required.
  // New model bundles enter this gate when their first GLB is finalized in the lock.
  const registered = new Set([
    ...(await readLock(root)).files.map((file) => file.path),
    ...(await readMasters(root)),
  ]);
  const registeredDirectories = new Set();
  for (const path of registered) {
    for (let directory = dirname(path); directory !== '.'; directory = dirname(directory))
      registeredDirectories.add(directory);
  }
  const posix = (path) => relative(root, path).split(sep).join('/');
  let verified = 0;
  let skipped = 0;
  for (const manifestPath of sourceManifests.sort()) {
    const directory = dirname(manifestPath);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const outputRoot = await projectRoot(root, directory);
    const models = Array.isArray(manifest.files?.models) ? manifest.files.models : [];
    const hasGlb = models.some(
      (model) => typeof model.path === 'string' && model.path.endsWith('.glb'),
    );
    const hasRegisteredGlb =
      registeredDirectories.has(posix(directory)) ||
      models.some(
        (model) =>
          typeof model.output === 'string' &&
          registeredDirectories.has(posix(dirname(resolve(outputRoot, model.output)))),
      );
    if (allowUnlocked && hasGlb && !hasRegisteredGlb) {
      log(
        `Warning: skipping unpinned model source bundle ${posix(manifestPath)} (work in progress). Use pnpm source:check --strict when finalizing it.`,
      );
      skipped++;
      continue;
    }
    const checked = validate('source-bundle', manifest);
    if (!checked.ok) throw new Error(`${manifestPath}\n${checked.formatted}`);
    const listed = new Set(listedPaths(manifest));
    for (const owned of listed) await access(resolve(directory, owned));
    const omitted = (await ownedFiles(directory)).filter((path) => !listed.has(path));
    if (omitted.length > 0) {
      throw new Error(`${manifestPath}: source files missing from manifest: ${omitted.join(', ')}`);
    }
    for (const model of manifest.files.models) {
      const bytes = await readFile(resolve(directory, model.path));
      if (model.sha256 !== undefined && hash(bytes) !== model.sha256) {
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
    verified++;
  }
  log(
    `Verified ${verified} logical source bundles${skipped ? `; ${skipped} unpinned bundles skipped` : ''}.`,
  );
  return { verified, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: { root: { type: 'string' }, strict: { type: 'boolean' } },
  });
  const root = resolve(values.root ?? ROOT);
  checkSourceBundles({ root, allowUnlocked: !values.strict })
    .then(() => {
      execFileSync(
        process.execPath,
        [resolve(root, 'packages/worldgen/scripts/index-structure-authoring.mjs'), '--check'],
        { cwd: root, stdio: 'inherit' },
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

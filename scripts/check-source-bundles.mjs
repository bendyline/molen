import { execFileSync, spawnSync } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { validate } from '../packages/schema/dist/index.mjs';
import { checkTrackedReviewCaptures, isReviewCapture } from './review-captures.mjs';

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

const listedPaths = (manifest) => [
  ...manifest.files.definitions,
  ...manifest.files.models.map((entry) => entry.path),
  ...(manifest.files.generators ?? []).map((entry) => entry.path),
  ...manifest.files.scripts.map((entry) => entry.path),
  ...manifest.files.textures.map((entry) => entry.path),
  ...manifest.files.sounds.map((entry) => entry.path),
  ...manifest.files.documents,
];
// Reports may retain historical capture paths. Their optional images are local QA output,
// while definitions, source models/textures, reports and summary previews remain required.
const requiredPaths = (manifest) => {
  const optionalCaptures = new Set(manifest.files.documents.filter(isReviewCapture));
  return [...new Set(listedPaths(manifest))].filter((path) => !optionalCaptures.has(path));
};

/**
 * A required file that Git ignores and does not track passes here on the machine that made it and
 * is missing from every checkout, CI's included. Force-added files are tracked, so they pass.
 * GLBs are exempt: they are build outputs that `pnpm assets:fetch` restores.
 */
function checkIgnoredSources(root, bundles) {
  const fromRoot = (path) => relative(root, path).split(sep).join('/');
  const owners = new Map();
  for (const { manifestPath, directory, manifest, outputRoot } of bundles) {
    const required = requiredPaths(manifest).map((path) => resolve(directory, path));
    for (const model of manifest.files.models)
      if (model.output !== undefined && model.assetId !== undefined)
        required.push(resolve(outputRoot, model.output));
    for (const path of required)
      if (!path.endsWith('.glb')) owners.set(fromRoot(path), fromRoot(manifestPath));
  }
  if (owners.size === 0) return;
  const result = spawnSync('git', ['check-ignore', '--verbose', '-z', '--stdin'], {
    cwd: root,
    input: [...owners.keys()].join('\0'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 ** 2,
  });
  if (result.error) throw result.error;
  // 0: some path matched, 1: none did.
  if (result.status !== 0 && result.status !== 1)
    throw new Error(`git check-ignore failed: ${result.stderr.trim()}`);
  const fields = result.stdout.split('\0');
  const ignored = [];
  for (let i = 0; i + 3 < fields.length; i += 4) {
    const [source, line, pattern, path] = fields.slice(i, i + 4);
    // Verbose output also names the `!` rules that re-include a path.
    if (!pattern.startsWith('!'))
      ignored.push(`${owners.get(path)}: ${path} (${source}:${line} ${pattern})`);
  }
  if (ignored.length > 0)
    throw new Error(
      `Required source files are ignored by Git and not committed, so a checkout lacks them (${ignored.length}):\n${ignored.join('\n')}\nForce-add them (git add -f) or remove them from the manifest.`,
    );
}

async function ownedFiles(directory, relativeDirectory = '') {
  const files = [];
  for (const entry of await readdir(resolve(directory, relativeDirectory), {
    withFileTypes: true,
  })) {
    const path = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!generatedDirectories.has(entry.name)) files.push(...(await ownedFiles(directory, path)));
    } else if (
      entry.isFile() &&
      path !== 'source.json' &&
      entry.name !== '.DS_Store' &&
      !isReviewCapture(path)
    ) {
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

export async function checkSourceBundles({ root = ROOT, log = console.log } = {}) {
  checkTrackedReviewCaptures({ root, log });
  const sourceManifests = [];
  for (const base of ['assets', 'content', 'examples', 'packages'])
    await discover(resolve(root, base), sourceManifests);

  const bundles = [];
  for (const manifestPath of sourceManifests.sort()) {
    const directory = dirname(manifestPath);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const checked = validate('source-bundle', manifest);
    if (!checked.ok) throw new Error(`${manifestPath}\n${checked.formatted}`);
    bundles.push({
      manifestPath,
      directory,
      manifest,
      outputRoot: await projectRoot(root, directory),
    });
  }
  checkIgnoredSources(root, bundles);

  let verified = 0;
  for (const { manifestPath, directory, manifest, outputRoot } of bundles) {
    const listed = new Set(listedPaths(manifest));
    for (const owned of requiredPaths(manifest)) await access(resolve(directory, owned));
    const omitted = (await ownedFiles(directory)).filter((path) => !listed.has(path));
    if (omitted.length > 0) {
      throw new Error(`${manifestPath}: source files missing from manifest: ${omitted.join(', ')}`);
    }
    // Model bytes are build outputs (their floats print differently across Node, Python and
    // library versions), so bundles are checked for presence and pairing, not committed hashes.
    for (const model of manifest.files.models) {
      if (model.output === undefined || model.assetId === undefined) continue;
      const sidecarPath = resolve(outputRoot, model.output);
      const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
      if (sidecar.id !== model.assetId) {
        throw new Error(`${sidecarPath}: expected asset id ${model.assetId}`);
      }
    }
    verified++;
  }
  log(`Verified ${verified} logical source bundles.`);
  return { verified };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: { root: { type: 'string' } },
  });
  const root = resolve(values.root ?? ROOT);
  checkSourceBundles({ root })
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

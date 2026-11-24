// The asset bundle is named after what builds it, never after what it contains. Its key hashes
// asset-build.json, every generator script with the relative modules it imports, the authored
// masters and the source data asset-build.json declares. Outputs are not inputs, so every machine
// computes the same key whatever bytes its builds produce. Engine code (packages/*/src and their
// dist) is not hashed, except where a generator declares it (see asset-engine.mjs): bump
// `inputs.version` when any other engine change should rebuild the assets.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, join, posix as posixPath, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORMAT = 'molen/asset-inputs@1';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const posix = (root, path) => relative(root, path).split(sep).join('/');
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
export const ENGINE_ENTRY = /^packages\/([a-z0-9-]+)\/src\/(?!.*\.\.)([\w./-]+)\.ts$/;

async function exists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/** A script and the relative modules it imports, transitively. */
async function moduleClosure(root, script, found = new Set()) {
  if (found.has(script)) return found;
  found.add(script);
  const source = await readFile(join(root, script), 'utf8');
  for (const [, specifier] of source.matchAll(IMPORT)) {
    const path = posix(root, resolve(root, dirname(script), specifier));
    if (!path.includes('/dist/') && /\.(mjs|js|json)$/.test(path))
      await moduleClosure(root, path, found);
  }
  return found;
}

/** The engine entry points `job` declares, checked. */
export function engineEntries(job) {
  if (job.engine === undefined) return [];
  if (!Array.isArray(job.engine) || !job.engine.every((entry) => ENGINE_ENTRY.test(entry)))
    throw new Error(`Generator ${job.id}: "engine" lists packages/<name>/src/<entry>.ts files.`);
  return job.engine;
}

/** `entry` and the files it imports relatively, transitively, in path order. */
export function importClosure(root, entry, candidates) {
  const found = new Set();
  const pending = [entry];
  while (pending.length) {
    const path = pending.pop();
    if (found.has(path)) continue;
    found.add(path);
    for (const [, specifier] of readFileSync(join(root, path), 'utf8').matchAll(IMPORT)) {
      const base = posixPath.join(posixPath.dirname(path), specifier);
      const target = candidates(base).find((file) => existsSync(join(root, file)));
      if (!target) throw new Error(`${path} imports ${specifier}, which does not exist.`);
      pending.push(target);
    }
  }
  return [...found].sort();
}

/** The package sources behind an engine entry point. */
export function engineSources(root, entry) {
  return importClosure(root, entry, (base) => [
    `${base}.ts`,
    `${base}/index.ts`,
    base.replace(/\.m?js$/, '.ts'),
    base,
  ]);
}

async function jobCode(root, [program, script]) {
  if (program === 'node') return moduleClosure(root, script);
  // Python generators keep their modules and pinned requirements beside the script.
  const directory = dirname(script);
  return (await readdir(join(root, directory)))
    .filter((name) => name.endsWith('.py') || name === 'requirements.txt')
    .map((name) => `${directory}/${name}`);
}

function excluded(path, patterns) {
  const parts = path.split('/');
  return patterns.some((pattern) =>
    pattern.endsWith('/')
      ? parts.slice(0, -1).includes(pattern.slice(0, -1))
      : pattern.startsWith('*.')
        ? path.endsWith(pattern.slice(1))
        : parts.at(-1) === pattern,
  );
}

/** Generator-written fields that describe outputs, or reviews, are not inputs. */
export function inputDigest(path, bytes) {
  if (path.endsWith('/source.json')) {
    const manifest = JSON.parse(bytes);
    const { documents, models, ...files } = manifest.files ?? {};
    const pins = models?.map(({ sha256, ...model }) => model);
    return sha(JSON.stringify({ ...manifest, files: { ...files, models: pins } }));
  }
  if (path.endsWith('/spec.json')) {
    const { mesh, actualBounds, ...spec } = JSON.parse(bytes);
    return sha(JSON.stringify(spec));
  }
  return sha(bytes);
}

// Changing the normalization rules also invalidates locally memoized input hashes.
export const INPUT_HASH_KIND = `input:${sha(inputDigest.toString())}`;

export function validateInputs(plan) {
  const inputs = plan?.inputs;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(plan?.repository ?? '') ||
    !Number.isSafeInteger(inputs?.version) ||
    inputs.version < 1 ||
    !Array.isArray(inputs.data) ||
    !Array.isArray(inputs.exclude ?? []) ||
    ![...inputs.data, ...(inputs.exclude ?? [])].every(
      (path) => typeof path === 'string' && path && !path.startsWith('/') && !path.includes('..'),
    )
  )
    throw new Error('asset-build.json needs "repository" and "inputs": {version, data, exclude}.');
  return inputs;
}

/** Everything that builds the asset bundle, and the key and release name derived from it. */
export async function assetInputs(root = ROOT, { fileCache } = {}) {
  root = resolve(root);
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  const inputs = validateInputs(plan);
  const paths = new Set(['asset-build.json', ...(plan.masters ?? [])]);
  for (const job of [...plan.generators, ...(plan.afterImport ?? [])]) {
    for (const path of await jobCode(root, job.command)) paths.add(path);
    for (const entry of engineEntries(job))
      for (const path of engineSources(root, entry)) paths.add(path);
  }
  const masters = new Set(plan.masters ?? []);
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...inputs.data],
    { cwd: root, env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' }, maxBuffer: 256 * 1024 ** 2 },
  );
  for (const path of listed.toString().split('\0')) {
    if (!path || (path.endsWith('.glb') && !masters.has(path))) continue;
    if (inputs.data.includes(path) || !excluded(path, inputs.exclude ?? [])) paths.add(path);
  }
  const files = [];
  for (const path of [...paths].sort()) {
    const stat = await exists(join(root, path));
    if (!stat) continue; // tracked but deleted in this working tree
    if (stat.isSymbolicLink()) throw new Error(`Asset inputs do not follow symlinks: ${path}`);
    const file = join(root, path);
    const digest = () => readFile(file).then((bytes) => inputDigest(path, bytes));
    files.push([
      path,
      fileCache ? await fileCache.get(file, INPUT_HASH_KIND, digest) : await digest(),
    ]);
  }
  const key = sha(JSON.stringify({ format: FORMAT, version: inputs.version, files }));
  return { key, release: `assets-${key.slice(0, 16)}`, repository: plan.repository, inputs: files };
}

/** Input paths that differ between two input lists, for explaining a rebuild. */
export function changedInputs(before = [], after = []) {
  const old = new Map(before);
  const current = new Map(after);
  return [...new Set([...old.keys(), ...current.keys()])]
    .filter((path) => old.get(path) !== current.get(path))
    .sort();
}

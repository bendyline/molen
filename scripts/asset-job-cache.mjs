// Local dependency records are independent of published bundles. They are written only after a
// successful job, and validate both the inputs it read and the outputs it produced.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { INPUT_HASH_KIND, inputDigest } from './asset-inputs.mjs';

const FORMAT = 'molen/asset-job-cache@1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Capture the originals before the tracing preload patches node:fs.
const read = readFileSync,
  list = readdirSync,
  exists = existsSync;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const derivedSidecar = (path) => /(?:^|\/)assets\/.*\/asset\.json$/.test(path);
const metadataBytes = async (root, paths) =>
  Promise.all(
    paths.map(async (path) => ({
      path,
      bytes: (await readFile(join(root, path))).toString('base64'),
    })),
  );

export function dependencyPath(root, value) {
  if (value instanceof URL) value = fileURLToPath(value);
  if (Buffer.isBuffer(value)) value = value.toString();
  if (typeof value !== 'string') return undefined;
  const path = relative(root, resolve(value)).split(sep).join('/');
  if (
    !path ||
    isAbsolute(path) ||
    path
      .split('/')
      .some((p) => ['..', 'node_modules', 'dist', 'dist-types', '.git', '.artifacts'].includes(p))
  )
    return undefined;
  return path;
}

export function snapshotDependency(root, { path, kind, ignore = [] }, fileCache) {
  const file = join(root, path);
  try {
    if (kind === 'exists') return exists(file);
    if (kind === 'directory')
      return list(file)
        .filter((name) => !ignore.includes(name))
        .sort();
    const digest = () => inputDigest(path, read(file));
    return fileCache ? fileCache.getSync(file, INPUT_HASH_KIND, digest) : digest();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return null;
    throw error;
  }
}

async function outputInfo(root, path, fileCache) {
  const file = join(root, path);
  if (fileCache) {
    const info = await fileCache.get(file, 'sha256', async () => {
      const { size, sha256 } = await outputInfo(root, path);
      return { size, sha256 };
    });
    return { path, ...info };
  }
  const info = await stat(file);
  if (!info.isFile()) throw new Error(`Not an asset output: ${path}`);
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return { path, size: info.size, sha256: digest.digest('hex') };
}

async function outputsCurrent(root, outputs, fileCache) {
  for (const expected of outputs) {
    try {
      const actual = await outputInfo(root, expected.path, fileCache);
      if (actual.size !== expected.size || actual.sha256 !== expected.sha256) return false;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return false;
    }
  }
  return true;
}

function dependenciesCurrent(root, dependencies, fileCache) {
  return dependencies.every(
    (entry) =>
      JSON.stringify(snapshotDependency(root, entry, fileCache)) === JSON.stringify(entry.value),
  );
}

export async function createJobCache(root, plan, { force = false, inputs = [], fileCache } = {}) {
  const directory = join(root, '.artifacts/asset-build/jobs');
  const tracingCode = await readFile(join(ROOT, 'scripts/trace-asset-job.mjs'));
  const cacheCode = await readFile(fileURLToPath(import.meta.url));
  const engine = {
    node: plan.node,
    version: plan.inputs.version,
    tracer: sha(tracingCode),
    cache: sha(cacheCode),
  };
  const records = new Map();
  const completed = new Map();
  const recordPath = (job) => join(directory, `${job.id}.json`);
  // Non-Node generators declare their output trees; their scripts and authored files in those
  // trees are conservative dependencies. Node jobs record their actual reads via the preload.
  const externalInputs = (job) =>
    inputs.filter(([path]) =>
      [dirname(job.command[1]).replaceAll('\\', '/'), ...(job.outputs ?? [])].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      ),
    );
  const identity = (job) =>
    sha(
      JSON.stringify({
        engine,
        command: job.command,
        ...(job.command[0] === 'node' ? {} : { inputs: externalInputs(job), outputs: job.outputs }),
      }),
    );
  return {
    async current(job) {
      let record;
      try {
        record = JSON.parse(await readFile(recordPath(job), 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
      if (
        record?.format !== FORMAT ||
        !Array.isArray(record.outputs) ||
        !Array.isArray(record.products) ||
        !Array.isArray(record.dependencies)
      )
        return false;
      const paths = [
        ...record.outputs,
        ...record.products,
        ...record.dependencies,
        ...(record.replay ?? []),
      ];
      if (
        paths.some(
          ({ path }) => typeof path !== 'string' || dependencyPath(root, join(root, path)) !== path,
        )
      )
        return false;
      // Keep the ownership information even when an input changed or force was requested.
      records.set(job.id, record);
      return (
        !force &&
        record.key === identity(job) &&
        record.outputs.length > 0 &&
        dependenciesCurrent(root, record.dependencies, fileCache) &&
        (await outputsCurrent(root, [...record.outputs, ...record.products], fileCache))
      );
    },
    outputs(job) {
      return records.get(job.id)?.outputs.map((output) => output.path) ?? [];
    },
    known(job) {
      return records.has(job.id);
    },
    async restore(job) {
      for (const { path, bytes } of records.get(job.id)?.replay ?? []) {
        const built = Buffer.from(bytes, 'base64');
        const file = join(root, path),
          temporary = `${file}.${randomUUID()}.tmp`;
        const current = await readFile(file).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
        if (current?.equals(built)) continue;
        if (current) {
          try {
            if (isDeepStrictEqual(JSON.parse(current), JSON.parse(built))) continue;
          } catch {
            /* Non-JSON output must match its bytes. */
          }
        }
        await writeFile(temporary, built);
        await rename(temporary, file);
      }
    },
    record(job, paths, outputs, metadata = []) {
      const dependencies = paths.map((path) => ({
        path,
        kind: 'file',
        value: snapshotDependency(root, { path, kind: 'file' }, fileCache),
      }));
      return async () =>
        completed.set(job.id, {
          format: FORMAT,
          key: identity(job),
          dependencies,
          outputs: await Promise.all(outputs.map((path) => outputInfo(root, path, fileCache))),
          replay: await metadataBytes(root, metadata),
          productPaths: [],
        });
    },
    async begin(job) {
      await mkdir(directory, { recursive: true });
      await rm(recordPath(job), { force: true });
      const trace = join(directory, `${job.id}-${randomUUID()}`);
      await mkdir(trace);
      return trace;
    },
    async complete(job, trace) {
      const dependencies = new Map(),
        writes = new Set();
      for (const name of await readdir(trace)) {
        const data = JSON.parse(await readFile(join(trace, name), 'utf8'));
        for (const entry of data.dependencies) {
          const key = `${entry.kind}:${entry.path}`;
          const old = dependencies.get(key);
          if (old?.unstable || (old && JSON.stringify(old.value) !== JSON.stringify(entry.value)))
            entry.unstable = true;
          dependencies.set(key, entry);
        }
        for (const path of data.writes) writes.add(path);
      }
      if (job.command[0] !== 'node') {
        async function walk(path) {
          for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
            const file = `${path}/${entry.name}`;
            if (entry.isDirectory()) await walk(file);
            else if (entry.isFile() && file.endsWith('.glb')) writes.add(file);
          }
        }
        for (const path of job.outputs ?? []) await walk(path);
      }
      const outputs = [...writes]
        .filter((path) => /^(content|assets|examples)\/.*\.glb$/.test(path))
        .sort();
      const inputs = [...dependencies.values()].filter((entry) => {
        if (outputs.includes(entry.path)) return false;
        // Import/LOD sidecars are generated, then restored by metadata reconciliation. Replay
        // the generated sidecar for downstream jobs; model bytes remain explicit dependencies.
        if (writes.has(entry.path) && derivedSidecar(entry.path)) return false;
        if (entry.kind === 'exists' && writes.has(entry.path)) return false;
        if (entry.value === null && writes.has(entry.path)) return false;
        if (entry.kind === 'directory') {
          entry.ignore = [...writes]
            .filter((path) => dirname(path).replaceAll('\\', '/') === entry.path)
            .map((path) => path.split('/').at(-1));
          entry.value = entry.value?.filter((name) => !entry.ignore.includes(name));
        }
        return true;
      });
      if (outputs.length && !inputs.some((entry) => entry.unstable)) {
        completed.set(job.id, {
          format: FORMAT,
          key: identity(job),
          dependencies: inputs,
          outputs: await Promise.all(outputs.map((path) => outputInfo(root, path, fileCache))),
          replay: await metadataBytes(root, [...writes].filter(derivedSidecar)),
          productPaths: [...writes].filter(
            (path) => !outputs.includes(path) && !derivedSidecar(path),
          ),
        });
      }
      if (dirname(trace) !== directory)
        throw new Error('Trace directory is outside the job cache.');
      await rm(trace, { recursive: true, force: true });
    },
    async save() {
      // Metadata reconciliation restores committed inputs. Never bless edits made while a job
      // was running, or an output another job subsequently overwrote.
      for (const [id, record] of completed) {
        if (
          !dependenciesCurrent(root, record.dependencies, fileCache) ||
          !(await outputsCurrent(root, record.outputs, fileCache))
        )
          continue;
        const { productPaths, ...saved } = record;
        saved.products = [];
        for (const path of productPaths) {
          const info = await stat(join(root, path)).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
          });
          if (info?.isFile()) saved.products.push(await outputInfo(root, path, fileCache));
        }
        const file = recordPath({ id });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(temporary, `${JSON.stringify(saved)}\n`);
        await rename(temporary, file);
      }
      await fileCache?.save();
    },
  };
}

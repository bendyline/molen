#!/usr/bin/env node
// Build every repository GLB from checked-in source. asset-build.json lists the generator programs
// that write source GLBs; every source bundle (source.json) says how its models become runtime
// GLBs; asset-lock.json pins the exact bytes the result must have. Nothing is downloaded, so a
// fresh checkout proves the lock. The Assets workflow runs exactly this before it publishes.
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, totalmem } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import {
  ASSET_ROOTS,
  createLock,
  fileInfo,
  inventory,
  readLock,
  readMasters,
  recordBuilt,
  recordInstalled,
  safePath,
  writeLock,
} from './asset-packs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = 'asset-build.json';
const PLAN_FORMAT = 'molen/asset-build@2';
const OUT = '.artifacts/asset-build';
// asset-lock.json is written on Linux x64, by the Update asset lock workflow. Other hosts round
// some generator math differently (macOS arm64 builds dozens of models to other bytes), so their
// builds are for iteration: they report lock differences instead of failing on them.
export const LOCK_HOST = 'linux-x64';
const HOST = `${process.platform}-${process.arch}`;
// Generators read package builds, never the content packs under examples/*/public.
const COMPILED = [
  'packages/schema/dist/index.mjs',
  'packages/worldgen/dist/kernel.mjs',
  'packages/tooling/dist/index.mjs',
  'packages/tooling/dist/cli.mjs',
];
const SKIP = new Set(['node_modules', 'dist', 'dist-types', '.git', '.artifacts', '.tmp', 'packs']);
// Directories that hold runtime outputs or review captures, never source bundles.
const NOT_BUNDLES = new Set([...SKIP, 'assets', 'public', 'shots']);
const TEXT = /\.(json|md)$/i;
const GIB = 1024 ** 3;
const sha = (info) => `sha256:${info.sha256}`;
const posix = (root, path) => relative(root, path).split(sep).join('/');

async function exists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function validatePlan(plan) {
  if (
    plan?.format !== PLAN_FORMAT ||
    !Array.isArray(plan.generators) ||
    !Array.isArray(plan.masters) ||
    !Array.isArray(plan.afterImport ?? []) ||
    !/^\d+$/.test(plan.node ?? '')
  )
    throw new Error(
      `Invalid ${PLAN}: expected ${PLAN_FORMAT} with a node major, generators and masters.`,
    );
  const ids = new Set();
  // afterImport: project scripts that derive reports from the imported runtime models.
  for (const job of [...plan.generators, ...(plan.afterImport ?? [])]) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(job.id ?? '') || ids.has(job.id))
      throw new Error(`Invalid or duplicate generator id: ${job.id}`);
    ids.add(job.id);
    const [program, script, ...args] = job.command ?? [];
    if (
      !['node', 'python'].includes(program) ||
      typeof script !== 'string' ||
      !/^(assets|content|examples|packages|scripts)\//.test(script) ||
      script.split('/').includes('..') ||
      !args.every((arg) => typeof arg === 'string')
    )
      throw new Error(`Generator ${job.id} must run a repository script with node or python.`);
  }
  for (const path of plan.masters) safePath(path);
  return plan;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function bundleDirectories(root) {
  const found = [];
  async function walk(directory) {
    if (!(await exists(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !NOT_BUNDLES.has(entry.name))
        await walk(join(directory, entry.name));
      else if (entry.isFile() && entry.name === 'source.json') found.push(directory);
    }
  }
  for (const name of ASSET_ROOTS) await walk(join(root, name));
  return found.sort();
}

async function owningProject(root, directory) {
  for (let current = directory; current !== root; current = dirname(current)) {
    if (await exists(join(current, 'project.json'))) return join(current, 'project.json');
    if (dirname(current) === current) break;
  }
  throw new Error(`${posix(root, directory)}: no owning project.json for its model outputs.`);
}

/** Every model a source bundle turns into a runtime GLB, derived from the committed manifests. */
export async function importPlan(root = ROOT) {
  const imports = [];
  for (const directory of await bundleDirectories(root)) {
    const bundle = await readJson(join(directory, 'source.json'));
    if (bundle.format !== 'molen/source-bundle@1') continue;
    for (const model of bundle.files?.models ?? []) {
      if (!model.output || !model.pipeline || !model.path.endsWith('.glb')) continue;
      const project = await owningProject(root, directory);
      const sidecarPath = join(dirname(project), model.output);
      const sidecar = await readJson(sidecarPath);
      if (model.assetId !== undefined && sidecar.id !== model.assetId)
        throw new Error(`${posix(root, sidecarPath)}: expected asset id ${model.assetId}`);
      const spec = (await exists(join(directory, 'spec.json')))
        ? await readJson(join(directory, 'spec.json'))
        : undefined;
      imports.push({
        id: sidecar.id,
        pipeline: model.pipeline,
        optimize: spec?.importOptions?.optimize !== false,
        source: posix(root, join(directory, model.path)),
        sidecar: posix(root, sidecarPath),
        output: posix(root, join(dirname(sidecarPath), sidecar.files.main)),
        project: posix(root, project),
      });
    }
  }
  const outputs = new Set();
  for (const entry of imports) {
    if (outputs.has(entry.output)) throw new Error(`Two bundles import ${entry.output}`);
    outputs.add(entry.output);
  }
  return imports;
}

async function pool(items, concurrency, work) {
  const queue = [...items];
  const failures = [];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      while (queue.length) {
        try {
          await work(queue.shift());
        } catch (error) {
          failures.push(error);
        }
      }
    }),
  );
  if (failures.length) throw new Error(failures.map((error) => error.message).join('\n\n'));
}

const pythonExecutable = () =>
  process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

// Python jobs need 3.10+ and the exact versions pinned in the requirements.txt beside their
// script (Lantern Dungeon's Pillow). Checked up front, a wrong interpreter is one clear message
// rather than a traceback after every other generator has run.
const PYTHON_MIN = [3, 10];
const SET_PYTHON = `Set PYTHON to a Python ${PYTHON_MIN.join('.')}+ interpreter.`;
const PYTHON_PROBE = `import importlib.metadata as m, json, sys
def version(name):
    try: return m.version(name)
    except m.PackageNotFoundError: return None
print(json.dumps({"python": list(sys.version_info[:3]), "packages": {n: version(n) for n in sys.argv[1:]}}))`;

/** `name==version` pins from the requirements.txt beside each Python job's script. */
async function pythonPins(root, scripts) {
  const pins = new Map();
  for (const script of scripts) {
    const file = join(root, dirname(script), 'requirements.txt');
    if (!(await exists(file))) continue;
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      const pin = /^\s*([A-Za-z0-9][\w.-]*)\s*==\s*([^\s;#]+)/.exec(line);
      if (pin) pins.set(pin[1], { version: pin[2], file: posix(root, file) });
    }
  }
  return pins;
}

/** Why the probed interpreter (`found`) cannot run the Python jobs; empty when it can. */
export function pythonProblems(executable, found, pins) {
  const [major, minor] = found.python;
  const problems = [];
  if (major < PYTHON_MIN[0] || (major === PYTHON_MIN[0] && minor < PYTHON_MIN[1]))
    problems.push(
      `${executable} is Python ${found.python.join('.')}; the Python generators need ${PYTHON_MIN.join('.')}+. ${SET_PYTHON}`,
    );
  for (const [name, { version, file }] of pins)
    if (found.packages[name] !== version)
      problems.push(
        `${file} pins ${name}==${version}; ${executable} has ${found.packages[name] ?? 'none'}. Run: ${executable} -m pip install -r ${file}`,
      );
  return problems;
}

/** Fail before any generator runs when the Python jobs among `jobs` would. */
export async function checkPython(root, jobs, executable = pythonExecutable()) {
  const scripts = jobs.filter((job) => job.command[0] === 'python').map((job) => job.command[1]);
  if (!scripts.length) return;
  const pins = await pythonPins(root, scripts);
  const probe = spawnSync(executable, ['-c', PYTHON_PROBE, ...pins.keys()], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (probe.error || probe.status !== 0)
    throw new Error(
      `Python generators run ${executable}, which failed (${probe.error?.code ?? probe.stderr.trim().split('\n').at(-1)}). ${SET_PYTHON}`,
    );
  const problems = pythonProblems(executable, JSON.parse(probe.stdout), pins);
  if (problems.length) throw new Error(problems.join('\n'));
}

function run(command, { root, log, label }) {
  const [program, ...args] = command;
  const executable = program === 'node' ? process.execPath : pythonExecutable();
  const heap = /--max-old-space-size/.test(process.env.NODE_OPTIONS ?? '')
    ? ''
    : ' --max-old-space-size=12288';
  return new Promise((done, fail) => {
    const started = Date.now();
    const child = spawn(executable, args, {
      cwd: root,
      shell: false,
      windowsHide: true,
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''}${heap}`.trim() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = [];
    child.stdout.on('data', (bytes) => output.push(bytes));
    child.stderr.on('data', (bytes) => output.push(bytes));
    child.on('error', fail);
    child.on('close', async (code) => {
      const text = Buffer.concat(output).toString('utf8');
      await writeFile(log, text);
      const seconds = Math.round((Date.now() - started) / 1000);
      if (code === 0) done(seconds);
      else fail(new Error(`${label} failed (exit ${code}); log: ${log}\n${text.slice(-4000)}`));
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Generators also rewrite their JSON/Markdown metadata. Review evidence pins those files' bytes,
// so a rewrite with identical content keeps the committed bytes and only real changes survive.

async function readText(root) {
  const files = new Map();
  async function walk(directory) {
    if (!(await exists(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && TEXT.test(entry.name)) files.set(path, await readFile(path));
    }
  }
  for (const name of ASSET_ROOTS) await walk(join(root, name));
  return files;
}

/** `writeFile`, waiting out Windows' refusal to truncate a file another process has mapped. */
async function writeSettled(path, bytes) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await writeFile(path, bytes);
    } catch (error) {
      if (process.platform !== 'win32' || attempt >= 20) throw error;
      await new Promise((done) => setTimeout(done, 250 * (attempt + 1)));
    }
  }
}

function sameContent(a, b) {
  const x = a.toString('utf8').replaceAll('\r\n', '\n');
  const y = b.toString('utf8').replaceAll('\r\n', '\n');
  if (x === y) return true;
  try {
    return isDeepStrictEqual(JSON.parse(x), JSON.parse(y));
  } catch {
    return false;
  }
}

async function biomeFormat(root, text) {
  const biome = join(root, 'node_modules/@biomejs/biome/bin/biome');
  return new Promise((done) => {
    const child = spawn(process.execPath, [biome, 'format', '--stdin-file-path', 'asset.json'], {
      cwd: root,
      windowsHide: true,
    });
    const output = [];
    child.stdout.on('data', (bytes) => output.push(bytes));
    child.on('error', () => done(undefined));
    child.on('close', (code) =>
      done(code === 0 ? Buffer.concat(output).toString('utf8') : undefined),
    );
    child.stdin.end(text);
  });
}

/**
 * A verifying build leaves committed text as it found it and reports what the generators would
 * change; `accept` (--update-lock) keeps real changes, laid out as the committed file was.
 */
async function reconcileText(root, before, accept) {
  const after = await readText(root);
  const changed = [];
  const added = [];
  for (const [path, now] of after) {
    const old = before.get(path);
    if (!old) {
      added.push(posix(root, path));
      continue;
    }
    if (old.equals(now)) continue;
    if (sameContent(old, now) || !accept) {
      if (!sameContent(old, now)) changed.push(posix(root, path));
      await writeSettled(path, old);
      continue;
    }
    changed.push(posix(root, path));
    // Keep a document in the compact layout it was committed in, so its diff is the change.
    if (path.endsWith('.json')) {
      const oldText = old.toString('utf8').replaceAll('\r\n', '\n');
      const [formattedOld, formattedNow] = await Promise.all([
        biomeFormat(root, oldText),
        biomeFormat(root, now.toString('utf8')),
      ]);
      if (formattedOld === oldText && formattedNow) await writeSettled(path, formattedNow);
    }
  }
  return { changed: changed.sort(), added: added.sort() };
}

// ---------------------------------------------------------------------------------------------

async function importOne(root, entry) {
  const tooling = await import(pathToFileURL(join(root, 'packages/tooling/dist/index.mjs')).href);
  const result = await tooling.importAsset({
    path: resolve(root, entry.source),
    id: entry.id,
    assetDir: resolve(root, dirname(entry.sidecar)),
    projectPath: resolve(root, entry.project),
    force: true,
    ...(entry.optimize ? {} : { optimize: false }),
  });
  if (!result.ok) throw new Error(`${entry.id}: ${result.error}`);
}

/** A copied model is its source; its sidecar only needs the new hash and size. */
async function copyModel(root, entry) {
  const source = resolve(root, entry.source);
  const output = resolve(root, entry.output);
  const info = await fileInfo(source);
  const sidecarPath = resolve(root, entry.sidecar);
  const text = await readFile(sidecarPath, 'utf8');
  const sidecar = JSON.parse(text);
  await mkdir(dirname(output), { recursive: true });
  await copyFile(source, output);
  if (sidecar.hash === sha(info)) return;
  if (sidecar.stats?.sizeBytes === undefined)
    throw new Error(`${entry.sidecar}: copied model sidecar has no size to update.`);
  await writeFile(
    sidecarPath,
    text
      .replace(`"hash": "${sidecar.hash}"`, `"hash": "${sha(info)}"`)
      .replace(`"sizeBytes": ${sidecar.stats.sizeBytes}`, `"sizeBytes": ${info.size}`),
  );
  if ((await readJson(sidecarPath)).hash !== sha(info))
    throw new Error(`${entry.sidecar}: could not update the copied model hash.`);
}

async function importCurrent(root, entry) {
  const output = resolve(root, entry.output);
  if (!(await exists(output))) return false;
  const sidecar = await readJson(resolve(root, entry.sidecar));
  const [source, runtime] = await Promise.all([
    fileInfo(resolve(root, entry.source)),
    fileInfo(output),
  ]);
  if (sha(runtime) !== sidecar.hash) return false;
  return entry.pipeline === 'copy'
    ? runtime.sha256 === source.sha256
    : sidecar.sourceHash === sha(source);
}

function defaultConcurrency() {
  // Large stadium and bridge generators peak at several GiB each.
  return Math.max(1, Math.min(availableParallelism(), Math.floor(totalmem() / (6 * GIB))));
}

async function compilePackages(root, log) {
  log('Compiling packages (tsdown) for the generators.');
  const { spawnCommand } = await import('./exec-command.mjs');
  const result = spawnCommand('pnpm', ['--filter', './packages/**', '-r', 'exec', 'tsdown'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Package compilation failed.');
}

/** Move generated GLBs aside so generators start clean. Returns the paths it moved. */
async function stageAside(root, paths, backup) {
  await rm(backup, { recursive: true, force: true });
  const moved = [];
  for (const path of paths) {
    const from = join(root, path);
    if (!(await exists(from))) continue;
    const to = join(backup, path);
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
    moved.push(path);
  }
  return moved;
}

/** Put back each moved GLB that `keep` selects and no generator recreated. */
async function restoreMoved(root, moved, backup, keep) {
  for (const path of moved) {
    if (!keep(path) || (await exists(join(root, path)))) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await rename(join(backup, path), join(root, path));
  }
}

// Windows refuses to rewrite a file while an indexer or scanner has it mapped (EUNKNOWN). The
// jobs are idempotent, so one rerun separates that from a real failure.
async function withWindowsRetry(work) {
  try {
    return await work();
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    await new Promise((done) => setTimeout(done, 2000));
    return work();
  }
}

export async function buildAssetsFromSource({
  root = ROOT,
  generate = true,
  updateLock = false,
  force = false,
  compile = false,
  concurrency = defaultConcurrency(),
  log = console.log,
  host = HOST,
} = {}) {
  root = resolve(root);
  const started = Date.now();
  const plan = validatePlan(await readJson(join(root, PLAN)));
  const lockHost = host === LOCK_HOST;
  if (updateLock && !lockHost)
    throw new Error(
      `asset-lock.json is written on ${LOCK_HOST}; this is ${host}, which can build different bytes. Push the branch and run the Update asset lock workflow.`,
    );
  // V8's Math.pow changes between Node majors (three.js's sRGB conversion uses it), so a lock
  // only holds for one: build with any other and every byte comparison would be noise.
  if (process.versions.node.split('.')[0] !== plan.node)
    throw new Error(
      `Asset builds use Node ${plan.node} (${PLAN} "node"); this is Node ${process.versions.node}. Switch Node major, or use pnpm assets:fetch.`,
    );
  await checkPython(root, [...(generate ? plan.generators : []), ...(plan.afterImport ?? [])]);
  const masters = await readMasters(root);
  const lock = (await exists(join(root, 'asset-lock.json'))) ? await readLock(root) : undefined;
  const out = join(root, OUT);
  const logs = join(out, 'logs');
  await rm(logs, { recursive: true, force: true });
  await mkdir(logs, { recursive: true });
  for (const path of masters)
    if (!(await exists(join(root, path))))
      throw new Error(`Missing committed master ${path}; it is source, restore it from Git.`);
  if (compile || !(await Promise.all(COMPILED.map((p) => exists(join(root, p))))).every(Boolean))
    await compilePackages(root, log);
  const imports = await importPlan(root);
  const importOutputs = new Set(imports.map((entry) => entry.output));
  const report = {
    format: 'molen/asset-build-report@1',
    generators: [],
    imports: { run: 0, current: 0 },
    metadata: { changed: [], added: [] },
  };
  const text = await readText(root);

  if (generate) {
    // Everything except masters and import outputs is written by a generator. Moving those GLBs
    // aside makes every build a clean build: generator guards never see a stale output.
    const generated = new Set([
      ...(await inventory(root)),
      ...(lock?.files.map((f) => f.path) ?? []),
    ]);
    for (const path of [...masters, ...importOutputs]) generated.delete(path);
    const backup = join(out, 'previous');
    const moved = await stageAside(root, [...generated], backup);
    const locked = new Set(lock?.files.map((f) => f.path));
    log(`Running ${plan.generators.length} generators (${concurrency} at a time).`);
    try {
      await pool(plan.generators, concurrency, async (job) => {
        const seconds = await withWindowsRetry(() =>
          run(job.command, {
            root,
            log: join(logs, `${job.id}.log`),
            label: `Generator ${job.id}`,
          }),
        );
        report.generators.push({ id: job.id, seconds });
        log(`  ${job.id}: ${seconds}s`);
      });
    } catch (error) {
      // Leave the checkout as it was: every GLB that was not rebuilt, and every committed file.
      await restoreMoved(root, moved, backup, () => true);
      await reconcileText(root, text, false);
      throw error;
    }
    // A moved GLB that is neither locked nor rebuilt is someone's work: keep it, report it below.
    // Locked outputs stay in the backup, so a generator that stopped producing one is caught.
    await restoreMoved(root, moved, backup, (path) => !locked.has(path));
  }

  const pending = [];
  for (const entry of imports) {
    if (!(await exists(resolve(root, entry.source))))
      throw new Error(`${entry.source}: no generator produced this source model.`);
    if (!force && (await importCurrent(root, entry))) report.imports.current++;
    else pending.push(entry);
  }
  log(`Importing ${pending.length} models (${report.imports.current} already current).`);
  let finished = 0;
  try {
    await pool(pending, concurrency, async (entry) => {
      if (entry.pipeline === 'copy') await copyModel(root, entry);
      else {
        // One process per import bounds the importer's memory on the largest stadiums.
        const encoded = Buffer.from(JSON.stringify({ ...entry, root })).toString('base64url');
        await withWindowsRetry(() =>
          run(['node', 'scripts/build-assets.mjs', '--import-one', encoded], {
            root,
            log: join(logs, `import-${entry.id}.log`),
            label: `Import ${entry.id}`,
          }),
        );
      }
      report.imports.run++;
      if (++finished % 25 === 0) log(`  imported ${finished}/${pending.length}`);
    });
    for (const job of plan.afterImport ?? []) {
      const seconds = await withWindowsRetry(() =>
        run(job.command, {
          root,
          log: join(logs, `${job.id}.log`),
          label: `After-import ${job.id}`,
        }),
      );
      log(`  ${job.id}: ${seconds}s`);
    }
  } catch (error) {
    await reconcileText(root, text, false);
    throw error;
  }
  report.metadata = await reconcileText(root, text, updateLock);

  const built = [];
  for (const path of await inventory(root)) {
    if (masters.has(path)) continue;
    built.push({ path, ...(await fileInfo(join(root, path))) });
  }
  const expected = new Map((lock?.files ?? []).map((file) => [file.path, file]));
  const produced = new Map(built.map((file) => [file.path, file]));
  const missing = [...expected.keys()].filter((path) => !produced.has(path));
  const unexpected = built.filter((file) => !expected.has(file.path)).map((file) => file.path);
  const changed = built
    .filter((file) => expected.has(file.path))
    .filter((file) => expected.get(file.path).sha256 !== file.sha256)
    .map((file) => file.path);
  Object.assign(report, {
    files: built.length,
    seconds: Math.round((Date.now() - started) / 1000),
    lock: { release: lock?.release, missing, unexpected, changed },
  });
  let result = lock;
  if (updateLock) {
    result = createLock(built, lock?.repository);
    await writeLock(root, result);
    report.lock.updated = result.release;
    await recordInstalled(root, built);
    await recordBuilt(root, result.release, []);
  } else {
    const matches = (file) => expected.get(file.path)?.sha256 === file.sha256;
    await recordInstalled(root, built.filter(matches));
    // Fetch keeps these while the lock is unchanged, rather than refusing them as local work.
    await recordBuilt(
      root,
      lock?.release,
      built.filter((file) => expected.has(file.path) && !matches(file)),
    );
  }
  await writeFile(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await rm(join(out, 'previous'), { recursive: true, force: true });

  const annotate = process.env.GITHUB_ACTIONS === 'true';
  if (report.metadata.changed.length || report.metadata.added.length) {
    log(
      updateLock
        ? `Generators changed ${report.metadata.changed.length} and added ${report.metadata.added.length} metadata files; review them with the lock:`
        : `Generators would change ${report.metadata.changed.length} committed metadata files (kept as committed; --update-lock accepts) and added ${report.metadata.added.length}:`,
    );
    for (const path of [...report.metadata.changed, ...report.metadata.added].slice(0, 200))
      log(annotate ? `::warning file=${path}::Regenerated metadata differs from Git` : `  ${path}`);
  }
  const problems = [
    ...changed.map((path) => `changed    ${path}`),
    ...missing.map((path) => `missing    ${path}`),
    ...unexpected.map((path) => `unexpected ${path}`),
  ];
  if (problems.length && !updateLock) {
    const listing = `${problems.slice(0, 100).join('\n')}${problems.length > 100 ? `\n… ${problems.length - 100} more` : ''}`;
    // Off the lock host, a difference may be this host's rounding rather than a source change.
    if (!lockHost)
      log(
        `${problems.length} built GLBs differ from asset-lock.json (${lock?.release ?? 'no lock'}) on ${host}; only ${LOCK_HOST} builds are checked against it:\n${listing}\nIf a source change is intended, push the branch and run the Update asset lock workflow.`,
      );
    else {
      if (annotate) for (const line of problems.slice(0, 50)) log(`::error::${line}`);
      throw new Error(
        `${problems.length} built GLBs differ from asset-lock.json (${lock?.release ?? 'no lock'}):\n${listing}\nIf the source change is intended, rerun with --update-lock (or run the Update asset lock workflow) and commit the lock with it. Report: ${join(OUT, 'report.json')}`,
      );
    }
  }
  const summary = `${generate ? 'Built' : 'Imported'} ${built.length} GLBs in ${report.seconds}s`;
  log(
    updateLock
      ? `${summary}; asset-lock.json now names ${result.release}.`
      : problems.length
        ? `${summary}; ${problems.length} differ from ${lock?.release ?? 'no lock'} on ${host}.`
        : `${summary}; every byte matches ${lock.release}.`,
  );
  return report;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'import-one': { type: 'string' },
      'no-generate': { type: 'boolean' },
      'update-lock': { type: 'boolean' },
      force: { type: 'boolean' },
      compile: { type: 'boolean' },
      jobs: { type: 'string' },
    },
  });
  if (values['import-one']) {
    const entry = JSON.parse(Buffer.from(values['import-one'], 'base64url').toString());
    await importOne(entry.root, entry);
    return;
  }
  const concurrency = values.jobs === undefined ? undefined : Number(values.jobs);
  if (concurrency !== undefined && !(Number.isInteger(concurrency) && concurrency > 0))
    throw new Error('--jobs expects a positive integer.');
  await buildAssetsFromSource({
    generate: !values['no-generate'],
    updateLock: values['update-lock'],
    force: values.force,
    compile: values.compile,
    ...(concurrency ? { concurrency } : {}),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

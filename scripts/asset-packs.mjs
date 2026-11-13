#!/usr/bin/env node
// Repository GLB bundles. Every GLB except the authored masters is a build output of checked-in
// source (scripts/build-assets.mjs). A bundle is named by the hash of its inputs
// (scripts/asset-inputs.mjs), so nothing pins output bytes: CI builds a bundle once when the
// inputs change and publishes it as a GitHub release, `fetch` restores it, and falls back to
// building from source when it is not published yet. These archives restore repository build
// outputs; the molen/pack@1 pipeline still builds the runtime packs.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as tar from 'tar';
import { assetInputs, changedInputs } from './asset-inputs.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'asset-manifest.json';
const MANIFEST_FORMAT = 'molen/asset-bundle@1';
const NOTICES = 'ASSET-NOTICES.txt';
const OUTPUT = '.artifacts/asset-packs';
// A copy of a finished build's installed.json, kept beside its job records so a later build on
// another machine can start from that bundle (see seedAssets).
export const SEED = '.artifacts/asset-build/seed.json';
// Which bundle the GLBs on disk are, whether it was built or fetched, and every file it holds.
const STAMP = 'installed.json';
const STAMP_FORMAT = 'molen/asset-install@1';
export const ASSET_ROOTS = ['content', 'assets', 'examples'];
const SKIP = new Set([
  'node_modules',
  'dist',
  'dist-types',
  '.git',
  '.artifacts',
  '.tmp',
  'test-results',
  '__output__',
  '__goldens__',
  'packs',
]);
const SHA = /^[a-f0-9]{64}$/;
const MAX_FILE = 1024 ** 3;
const MAX_ARCHIVE = 2 * 1024 ** 3 - 1;
const ARCHIVE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-part-[0-9]{3,}\.tar\.gz$/;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const same = (a, b) => a?.size === b.size && a?.sha256 === b.sha256;

/** The bundle for these inputs is not on GitHub yet; the caller may build from source instead. */
export class ReleaseMissingError extends Error {}

async function maybeStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function safePath(path) {
  if (
    typeof path !== 'string' ||
    !ASSET_ROOTS.includes(path.split('/')[0]) ||
    !path.endsWith('.glb') ||
    path
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          /[\\:<>"|?*]/.test(p) ||
          [...p].some((character) => character.charCodeAt(0) < 32) ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p),
      )
  ) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
}

// Check every ancestor, including an existing destination; never hydrate through links.
export async function localPath(root, path) {
  safePath(path);
  let current = resolve(root);
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await maybeStat(current))?.isSymbolicLink())
      throw new Error(`Asset path is a symlink: ${current}`);
  }
  return current;
}

export async function fileInfo(path, { fileCache } = {}) {
  if (fileCache) return fileCache.get(path, 'sha256', () => fileInfo(path));
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { size, sha256: hash.digest('hex') };
}

export async function inventory(root = ROOT) {
  const paths = [];
  async function walk(directory) {
    if (!(await maybeStat(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Asset inventory does not follow symlinks: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb'))
        paths.push(relative(root, path).split(sep).join('/'));
    }
  }
  for (const directory of ASSET_ROOTS) await walk(join(root, directory));
  return paths.sort();
}

/** Committed binary masters: authored GLBs with no generator. They are inputs, not outputs. */
export async function readMasters(root = ROOT) {
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  if (!Array.isArray(plan.masters)) throw new Error('asset-build.json must list its masters.');
  for (const path of plan.masters) safePath(path);
  return new Set(plan.masters);
}

/** The GLBs a build leaves: everything on disk except the committed masters. */
export async function bundleFiles(root = ROOT, { fileCache } = {}) {
  const masters = await readMasters(root);
  const files = [];
  for (const path of await inventory(root))
    if (!masters.has(path))
      files.push({ path, ...(await fileInfo(join(root, path), { fileCache })) });
  return files;
}

function validateFiles(files, label) {
  if (!Array.isArray(files) || !files.length) throw new Error(`${label} lists no assets.`);
  const seen = new Set();
  let previous;
  for (const file of files) {
    safePath(file.path);
    const key = file.path.toLowerCase();
    if (
      seen.has(key) ||
      !SHA.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > MAX_FILE
    )
      throw new Error(`Invalid or duplicate asset: ${file.path}`);
    if (previous !== undefined && previous >= file.path)
      throw new Error(`${label} is not sorted by path at ${file.path}`);
    seen.add(key);
    previous = file.path;
  }
  return files;
}

// ---------------------------------------------------------------------------------------------
// asset-manifest.json: a release attachment naming the inputs' key, every file in the bundle and
// the archives that hold them. Downloads are verified against it.

export function validateManifest(manifest, { repository, key }) {
  const release = `assets-${key.slice(0, 16)}`;
  if (
    manifest?.format !== MANIFEST_FORMAT ||
    manifest.repository !== repository ||
    manifest.key !== key ||
    manifest.release !== release ||
    !Array.isArray(manifest.archives) ||
    !manifest.archives.length ||
    manifest.archives.length > 990
  )
    throw new Error(`Bundle manifest does not describe ${release}.`);
  validateFiles(manifest.files, release);
  if (
    manifest.notices?.file !== NOTICES ||
    !SHA.test(manifest.notices.sha256) ||
    !Number.isSafeInteger(manifest.notices.size)
  )
    throw new Error('Missing asset license notices.');
  const sizes = new Map(manifest.files.map((f) => [f.path, f.size]));
  const covered = new Set();
  const names = new Set();
  for (const archive of manifest.archives) {
    if (
      !ARCHIVE_NAME.test(archive.file) ||
      names.has(archive.file) ||
      !SHA.test(archive.sha256) ||
      !Number.isSafeInteger(archive.size) ||
      archive.size < 1 ||
      archive.size > MAX_ARCHIVE ||
      !Array.isArray(archive.files) ||
      !archive.files.length
    )
      throw new Error(`Invalid archive: ${archive.file}`);
    names.add(archive.file);
    let expanded = 0;
    for (const path of archive.files) {
      if (!sizes.has(path) || covered.has(path))
        throw new Error(`Bundle archive ${archive.file} lists an unexpected asset: ${path}`);
      covered.add(path);
      expanded += sizes.get(path);
    }
    if (expanded > MAX_FILE) throw new Error(`Archive expands beyond 1 GiB: ${archive.file}`);
  }
  if (covered.size !== sizes.size)
    throw new Error(`Bundle ${release} is missing ${sizes.size - covered.size} assets.`);
  return manifest;
}

// ---------------------------------------------------------------------------------------------
// installed.json: which bundle the GLBs on disk are. The build and fetch write it, so it describes
// files this tooling placed; anything else on disk is local work it leaves alone.

export async function readStamp(root = ROOT) {
  try {
    const stamp = JSON.parse(await readFile(join(root, OUTPUT, STAMP), 'utf8'));
    return stamp?.format === STAMP_FORMAT ? stamp : undefined;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writeStamp(root, { key, release, from, prefix = '', inputs, files }) {
  await mkdir(join(root, OUTPUT), { recursive: true });
  const stamp = { format: STAMP_FORMAT, key, release, from, prefix, inputs, files };
  await writeFile(join(root, OUTPUT, STAMP), json(stamp));
}

export async function clearStamp(root = ROOT) {
  await rm(join(root, OUTPUT, STAMP), { force: true });
}

/** Why the installed bundle is not this checkout's: the inputs that changed, briefly. */
function explain(stamp, current) {
  const changed = changedInputs(stamp?.inputs, current.inputs);
  if (!changed.length) return '';
  const shown = changed.slice(0, 20).join('\n');
  return `\nChanged inputs:\n${shown}${changed.length > 20 ? `\n… ${changed.length - 20} more` : ''}`;
}

export function groups(files, budget) {
  const buckets = new Map();
  for (const file of files) {
    const parts = file.path.split('/');
    const place = file.path.match(/^content\/worldgen\/(assets|source)\/places\/([^/]+)\//);
    const role = parts[2] === 'assets' ? 'models' : parts[2] === 'source' ? 'sources' : parts[2];
    const label = place
      ? `worldgen-${role}-${place[2]}`
      : parts[0] === 'content'
        ? `${parts[1]}-${parts[3] === 'reusable' ? 'reusable-' : ''}${role}`
        : parts[0] === 'examples'
          ? `${parts[1]}-${parts[2] === 'asset-src' ? 'sources' : parts[2] === 'public' ? 'models' : parts[2]}`
          : parts.slice(0, Math.min(3, parts.length - 1)).join('-');
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(file);
  }
  const result = [];
  for (const [key, entries] of [...buckets].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let chunk = [],
      size = 0,
      index = 1;
    const flush = () => {
      if (chunk.length)
        result.push({ key: `${key}-part-${String(index++).padStart(3, '0')}`, files: chunk });
      chunk = [];
      size = 0;
    };
    for (const file of entries) {
      if (size + file.size > budget) flush();
      chunk.push(file);
      size += file.size;
    }
    flush();
  }
  return result;
}

// Public names repeat between releases. Keep exact archive versions isolated locally.
export function archivePath(directory, archive) {
  return join(directory, archive.sha256, archive.file);
}

async function findArchive(directory, archive) {
  // Also accept manually downloaded release attachments in a flat directory.
  for (const path of [archivePath(directory, archive), join(directory, archive.file)]) {
    if ((await maybeStat(path))?.isFile() && same(await fileInfo(path), archive)) return path;
  }
}

/** Check an archive's own hash, then every member against the bundle manifest. */
export async function verifyArchive(path, archive, files) {
  if (!same(await fileInfo(path), archive))
    throw new Error(`Archive checksum mismatch: ${archive.file}`);
  const expected = new Map(archive.files.map((p) => [p, files.get(p)]));
  const seen = new Set();
  const errors = [];
  await tar.t({
    file: path,
    strict: true,
    onReadEntry(entry) {
      const file = expected.get(entry.path);
      if (!file || entry.type !== 'File' || entry.size !== file.size || seen.has(entry.path)) {
        errors.push(`Unexpected archive entry: ${entry.path} (${entry.type})`);
        return;
      }
      seen.add(entry.path);
      const hash = createHash('sha256');
      let size = 0;
      entry.on('data', (bytes) => {
        hash.update(bytes);
        size += bytes.length;
      });
      entry.on('end', () => {
        if (size !== file.size || hash.digest('hex') !== file.sha256)
          errors.push(`Asset checksum mismatch: ${entry.path}`);
      });
    },
  });
  if (seen.size !== expected.size) errors.push('Archive has missing files.');
  if (errors.length) throw new Error(errors.join('\n'));
}

async function pool(items, concurrency, work) {
  const queue = [...items];
  const results = [];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      while (queue.length) results.push(await work(queue.shift()));
    }),
  );
  return results;
}

/** Archives of bundles packed or downloaded here before, by file name, with their members' bytes. */
async function earlierArchives(directory, repository) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && /^assets-[a-f0-9]{16}$/.test(entry.name))
      paths.push(join(directory, entry.name, MANIFEST));
  }
  const published = join(directory, 'published');
  if ((await maybeStat(published))?.isDirectory())
    for (const name of await readdir(published))
      if (name.endsWith('.json')) paths.push(join(published, name));
  const byName = new Map();
  for (const path of paths) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path, 'utf8'));
      validateManifest(manifest, { repository, key: manifest?.key ?? '' });
    } catch {
      continue; // A partial or foreign manifest just offers nothing to reuse.
    }
    const members = new Map(manifest.files.map((f) => [f.path, f]));
    for (const archive of manifest.archives) {
      if (!byName.has(archive.file)) byName.set(archive.file, []);
      byName.get(archive.file).push({ archive, members: archive.files.map((p) => members.get(p)) });
    }
  }
  return byName;
}

/**
 * An earlier archive holding exactly these files with these bytes, verified like a new one.
 * Unchanged groups then cost a read instead of a recompression: a seeded CI build repacks only
 * the places whose models changed.
 */
async function reusableArchive(directory, candidates = [], members, files) {
  for (const { archive, members: earlier } of candidates) {
    if (
      archive.files.length !== members.length ||
      members.some(
        (file, index) => archive.files[index] !== file.path || !same(earlier[index], file),
      )
    )
      continue;
    const path = archivePath(directory, archive);
    if ((await maybeStat(path))?.size !== archive.size) continue;
    try {
      await verifyArchive(path, archive, files);
    } catch {
      continue; // A damaged cached archive is packed afresh.
    }
    return { file: archive.file, size: archive.size, sha256: archive.sha256, files: archive.files };
  }
}

/** Archive the installed bundle, exactly as it is on disk, as a publishable release. */
export async function packAssets({
  root = ROOT,
  outDir = join(root, OUTPUT),
  budget = 256 * 1024 ** 2,
  concurrency = Math.min(4, availableParallelism()),
  log = console.log,
} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > MAX_FILE)
    throw new Error('Invalid archive budget.');
  const { stamp, repository } = await checkAssets({ root, log: () => {} });
  if (stamp.prefix) throw new Error('Packing needs the whole bundle; fetch it without --prefix.');
  const files = new Map(stamp.files.map((f) => [f.path, f]));
  await mkdir(outDir, { recursive: true });
  const earlier = await earlierArchives(outDir, repository);
  const archives = await pool(groups(stamp.files, budget), concurrency, async (group) => {
    const file = `${group.key}.tar.gz`;
    const reused = await reusableArchive(outDir, earlier.get(file), group.files, files);
    if (reused) {
      log(`Reused ${file}: ${group.files.length} GLBs unchanged`);
      return reused;
    }
    const temporary = join(outDir, `${randomUUID()}.part`);
    try {
      await tar.c(
        {
          file: temporary,
          cwd: root,
          gzip: { level: 6 },
          portable: true,
          noMtime: true,
          follow: false,
          noDirRecurse: true,
          onWriteEntry(entry) {
            entry.stat.mode = 0o644;
          },
        },
        group.files.map((f) => f.path),
      );
      const archive = {
        file,
        ...(await fileInfo(temporary)),
        files: group.files.map((f) => f.path),
      };
      await verifyArchive(temporary, archive, files);
      const destination = archivePath(outDir, archive);
      await mkdir(dirname(destination), { recursive: true });
      await rename(temporary, destination);
      log(
        `Packed ${file}: ${group.files.length} GLBs, ${(archive.size / 1024 ** 2).toFixed(1)} MiB`,
      );
      return archive;
    } finally {
      await rm(temporary, { force: true });
    }
  });
  archives.sort((a, b) => (a.file < b.file ? -1 : 1));
  const releaseDir = join(outDir, stamp.release);
  await mkdir(releaseDir, { recursive: true });
  const notices = [];
  for (const path of ['LICENSE', 'content/worldgen/NOTICE.md', 'content/entities/NOTICE.md']) {
    if (await maybeStat(join(root, path)))
      notices.push(`--- ${path} ---\n${await readFile(join(root, path), 'utf8')}`);
  }
  if (!notices.length) throw new Error('No asset license notices found.');
  await writeFile(join(releaseDir, NOTICES), notices.join('\n\n'));
  const manifest = validateManifest(
    {
      format: MANIFEST_FORMAT,
      repository,
      release: stamp.release,
      key: stamp.key,
      files: stamp.files,
      notices: { file: NOTICES, ...(await fileInfo(join(releaseDir, NOTICES))) },
      archives,
    },
    { repository, key: stamp.key },
  );
  await writeFile(join(releaseDir, MANIFEST), json(manifest));
  log(`${stamp.files.length} GLBs in ${archives.length} archives for release ${stamp.release}`);
  return manifest;
}

/** The installed GLBs are this checkout's bundle: its inputs' key, with every file intact. */
/** Runtime LODs a sidecar records but does not name in files.variants, where packs look them up. */
async function sidecarProblems(root, directory) {
  const path = `${directory}/asset.json`;
  const sidecar = await readFile(join(root, path), 'utf8').then(JSON.parse, (error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  const lods = sidecar?.format === 'molen/asset@1' ? sidecar.runtimeLods : undefined;
  if (!lods) return [];
  const problems = [];
  if (lods.masterHash !== sidecar.hash)
    problems.push(`${path}: runtimeLods were derived from another master`);
  for (const level of lods.levels ?? [])
    if (sidecar.files?.variants?.[level.name] !== level.file)
      problems.push(`${path}: files.variants.${level.name} must name ${level.file}`);
  return problems;
}

export async function checkAssets({ root = ROOT, prefix = '', log = console.log } = {}) {
  const current = await assetInputs(root);
  const stamp = await readStamp(root);
  if (!stamp)
    throw new Error('No asset bundle is installed; run pnpm assets:fetch (or pnpm assets:build).');
  if (stamp.key !== current.key)
    throw new Error(
      `The installed GLBs are ${stamp.release}, built from other inputs than this checkout's ${current.release}; run pnpm assets:fetch or pnpm assets:build.${explain(stamp, current)}`,
    );
  if (!prefix.startsWith(stamp.prefix))
    throw new Error(`Only ${stamp.prefix} is installed; run pnpm assets:fetch without --prefix.`);
  const files = stamp.files.filter((f) => f.path.startsWith(prefix));
  if (!files.length) throw new Error(`No assets match prefix: ${prefix}`);
  const errors = [];
  for (const file of files) {
    const path = await localPath(root, file.path);
    if (!(await maybeStat(path))) errors.push(`Missing ${file.path}; run pnpm assets:fetch.`);
    else if (!same(await fileInfo(path), file))
      errors.push(`Changed ${file.path}; run pnpm assets:build, or pnpm assets:fetch --force.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  // Builds rewrite runtime sidecars beside these GLBs, so check what they say about them too.
  for (const directory of new Set(files.map((f) => dirname(f.path))))
    errors.push(...(await sidecarProblems(root, directory)));
  if (errors.length)
    throw new Error(
      `${errors.join('\n')}\nRegenerate their LOD metadata: node packages/tooling/scripts/generate-landmark-lods.mjs`,
    );
  const listed = new Set(stamp.files.map((f) => f.path));
  const masters = await readMasters(root);
  const local = (await inventory(root)).filter(
    (path) => path.startsWith(prefix) && !listed.has(path) && !masters.has(path),
  );
  if (local.length)
    log(`Note: ${local.length} GLBs on disk are local work outside ${stamp.release}.`);
  log(`Verified ${files.length} GLBs of ${stamp.release}.`);
  return { stamp, repository: current.repository };
}

async function download(url, path, expected, fetchImpl) {
  const temporary = `${path}.${randomUUID()}.part`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`Asset download failed: HTTP ${response.status} ${url}`);
    let count = 0;
    await pipeline(
      Readable.fromWeb(response.body),
      new Transform({
        transform(chunk, _encoding, done) {
          count += chunk.length;
          done(
            count > expected.size ? new Error('Asset download exceeds its declared size.') : null,
            chunk,
          );
        },
      }),
      createWriteStream(temporary, { flags: 'wx' }),
    );
    if (!same(await fileInfo(temporary), expected))
      throw new Error(`Archive checksum mismatch: ${url}`);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

const releaseUrl = ({ repository, release }, file) =>
  `https://github.com/${repository}/releases/download/${release}/${file}`;

async function releaseManifest(current, archiveDir, offline, fetchImpl) {
  // The published manifest is cached apart from a local `pack`: archives are not byte-reproducible,
  // so a local packing only stands in for the release when working offline.
  const cached = join(archiveDir, 'published', `${current.release}.json`);
  const packed = join(archiveDir, current.release, MANIFEST);
  for (const path of offline ? [cached, packed] : [cached]) {
    if (await maybeStat(path))
      return validateManifest(JSON.parse(await readFile(path, 'utf8')), current);
  }
  if (offline)
    throw new ReleaseMissingError(`Offline and ${current.release} is not cached in ${archiveDir}.`);
  const response = await fetchImpl(releaseUrl(current, MANIFEST), {
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 404)
    throw new ReleaseMissingError(
      `Bundle ${current.release} is not published yet. CI publishes it once these inputs reach main.`,
    );
  if (!response.ok) throw new Error(`Bundle manifest download failed: HTTP ${response.status}`);
  const text = await response.text();
  const manifest = validateManifest(JSON.parse(text), current);
  await mkdir(dirname(cached), { recursive: true });
  await writeFile(cached, text);
  return manifest;
}

/** Whether a GLB on disk already holds a bundle file's exact bytes (hashing each path once). */
function localMatcher(root) {
  const known = new Map();
  return async (file) => {
    if (!known.has(file.path)) {
      const path = await localPath(root, file.path);
      if ((await maybeStat(path))?.size !== file.size) return false;
      known.set(file.path, await fileInfo(path));
    }
    return same(known.get(file.path), file);
  };
}

async function removeStage(path, parent) {
  if (!resolve(path).startsWith(`${resolve(parent)}${sep}`))
    throw new Error('Invalid staging cleanup path.');
  await rm(path, { recursive: true, force: true });
}

export async function fetchAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  offline = false,
  force = false,
  prefix = '',
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const current = await assetInputs(root);
  const stamp = await readStamp(root);
  // installed.json can arrive with cached archives from a different checkout. Verify the
  // actual bytes before reusing any GLB, including the already-installed shortcut below.
  const matchesLocalFile = localMatcher(root);
  if (!force && stamp?.key === current.key && prefix.startsWith(stamp.prefix)) {
    const files = stamp.files.filter((f) => f.path.startsWith(prefix));
    let present = files.length > 0;
    for (const file of files) {
      if (!(await matchesLocalFile(file))) {
        present = false;
        break;
      }
    }
    if (present) {
      log(`Ready: ${files.length} GLBs of ${current.release} (nothing to restore).`);
      return files.length;
    }
  }
  const manifest = await releaseManifest(current, archiveDir, offline, fetchImpl);
  const { files, restored } = await installBundle({
    root,
    archiveDir,
    manifest,
    previous: stamp,
    matchesLocalFile,
    offline,
    force,
    prefix,
    fetchImpl,
    log,
  });
  await writeStamp(root, { ...current, from: 'fetch', prefix, files });
  log(`Ready: ${files.length} GLBs of ${current.release} (${restored} restored).`);
  return files.length;
}

/**
 * Put `manifest`'s GLBs (those under `prefix`) on disk: keep files whose bytes already match,
 * restore the rest from cached or downloaded archives, and remove outputs of the `previous`
 * bundle that this one no longer has. Local work outside both bundles stays.
 */
async function installBundle({
  root,
  archiveDir,
  manifest,
  previous,
  matchesLocalFile,
  offline,
  force,
  prefix = '',
  fetchImpl,
  log,
}) {
  const files = manifest.files.filter((f) => f.path.startsWith(prefix));
  if (!files.length) throw new Error(`No assets match prefix: ${prefix}`);
  const byPath = new Map(manifest.files.map((f) => [f.path, f]));
  const wanted = new Set();
  for (const file of files) if (force || !(await matchesLocalFile(file))) wanted.add(file.path);
  const staging = join(root, OUTPUT, 'staging');
  await mkdir(staging, { recursive: true });
  let restored = 0;
  for (const archive of manifest.archives) {
    const members = archive.files.filter((path) => wanted.has(path)).map((p) => byPath.get(p));
    if (!members.length) continue;
    let path = await findArchive(archiveDir, archive);
    if (!path) {
      if (offline) throw new Error(`Offline archive missing or corrupt: ${archive.file}`);
      log(`Downloading ${archive.file}`);
      path = archivePath(archiveDir, archive);
      await mkdir(dirname(path), { recursive: true });
      await download(releaseUrl(manifest, archive.file), path, archive, fetchImpl);
    }
    await verifyArchive(path, archive, byPath);
    const stage = await mkdtemp(join(staging, 'restore-'));
    try {
      const names = new Set(members.map((f) => f.path));
      await tar.x({
        file: path,
        cwd: stage,
        strict: true,
        noMtime: true,
        filter: (name, entry) => names.has(name) && entry.type === 'File',
      });
      for (const file of members) {
        if (!same(await fileInfo(join(stage, file.path)), file))
          throw new Error(`Extracted checksum mismatch: ${file.path}`);
      }
      for (const file of members) {
        const destination = await localPath(root, file.path);
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.part`;
        try {
          await copyFile(join(stage, file.path), temporary);
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      restored += members.length;
      log(`Restored ${members.length} GLBs from ${archive.file}`);
    } finally {
      await removeStage(stage, staging);
    }
  }
  // Outputs of the previous bundle that this one no longer has are stale; local work stays.
  if (!prefix && previous && !previous.prefix)
    for (const file of previous.files)
      if (!byPath.has(file.path)) await rm(await localPath(root, file.path), { force: true });
  return { files, restored };
}

/** The newest published bundle (what main last built), or undefined when none can be listed. */
async function latestPublished(repository, fetchImpl) {
  const headers = { Accept: 'application/vnd.github+json' };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/releases?per_page=100`,
    { headers, signal: AbortSignal.timeout(60_000) },
  );
  if (!response.ok)
    throw new Error(`Listing ${repository} releases failed: HTTP ${response.status}`);
  return (await response.json())
    .filter(
      (release) =>
        !release.draft &&
        /^assets-[a-f0-9]{16}$/.test(release.tag_name) &&
        release.assets?.some((asset) => asset.name === MANIFEST),
    )
    .sort((a, b) =>
      a.published_at < b.published_at ? 1 : a.published_at > b.published_at ? -1 : 0,
    )
    .at(0)?.tag_name;
}

/**
 * A seed bundle's manifest: a packed one whose archives are all cached here (an Actions cache of
 * an unpublished build), else the published one. Undefined when it is neither.
 */
async function seedManifest(release, { repository, key }, archiveDir, fetchImpl) {
  const check = (manifest) => {
    validateManifest(manifest, { repository, key: key ?? manifest?.key ?? '' });
    if (manifest.release !== release) throw new Error(`Seed manifest is not ${release}.`);
    return manifest;
  };
  const packed = join(archiveDir, release, MANIFEST);
  if (await maybeStat(packed)) {
    const manifest = check(JSON.parse(await readFile(packed, 'utf8')));
    const cached = await Promise.all(
      manifest.archives.map(
        async (archive) =>
          (await maybeStat(archivePath(archiveDir, archive)))?.size === archive.size,
      ),
    );
    // Archives are not byte-reproducible: a packing only stands in for itself, never a release.
    if (cached.every(Boolean)) return { manifest, offline: true };
  }
  const published = join(archiveDir, 'published', `${release}.json`);
  if (await maybeStat(published))
    return { manifest: check(JSON.parse(await readFile(published, 'utf8'))), offline: false };
  const response = await fetchImpl(releaseUrl({ repository, release }, MANIFEST), {
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Seed manifest download failed: HTTP ${response.status}`);
  const text = await response.text();
  const manifest = check(JSON.parse(text));
  await mkdir(dirname(published), { recursive: true });
  await writeFile(published, text);
  return { manifest, offline: false };
}

/**
 * Before a source build on a machine with no GLBs (a CI runner), install the bundle an earlier
 * build left: the one named by its saved job records (SEED), else the newest published bundle.
 * The build then reruns only jobs whose recorded inputs or outputs differ from it, instead of
 * all of them. Any bundle is a safe seed: records are checked against the bytes on disk, so a
 * GLB the seed got wrong only means its job runs. Returns the release installed, if any.
 */
export async function seedAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const { repository } = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  let seed;
  try {
    seed = JSON.parse(await readFile(join(root, SEED), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  const recorded =
    seed?.format === STAMP_FORMAT && SHA.test(seed.key ?? '')
      ? `assets-${seed.key.slice(0, 16)}`
      : undefined;
  const install = async (release, key, why) => {
    const found = await seedManifest(release, { repository, key }, archiveDir, fetchImpl);
    if (!found) {
      log(`Seed ${release} is neither cached nor published.`);
      return;
    }
    const { manifest, offline } = found;
    const { files, restored } = await installBundle({
      root,
      archiveDir,
      manifest,
      previous: await readStamp(root),
      matchesLocalFile: localMatcher(root),
      offline,
      force: false,
      fetchImpl,
      log,
    });
    await writeStamp(root, {
      key: manifest.key,
      release: manifest.release,
      from: 'seed',
      prefix: '',
      inputs: release === recorded ? seed.inputs : [],
      files,
    });
    log(`Seeded with ${files.length} GLBs of ${release} (${why}; ${restored} restored).`);
    return release;
  };
  if (recorded) {
    const installed = await install(recorded, seed.key, 'the bundle its job records describe');
    if (installed) return installed;
  }
  let latest;
  try {
    latest = await latestPublished(repository, fetchImpl);
  } catch (error) {
    log(`Warning: ${error.message}`);
  }
  if (latest && latest !== recorded) {
    const installed = await install(latest, undefined, 'the newest published bundle');
    if (installed) return installed;
  }
  await clearStamp(root);
  log('No earlier bundle to start from: the build runs every job.');
}

/**
 * Publish the packed bundle for this checkout's inputs as the release it names. An already
 * published bundle is left alone: its archives were verified when they went up.
 */
export async function publishAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing 40-character GitHub commit SHA>.');
  const current = await assetInputs(root);
  const { repository, release } = current;
  const gh =
    runGh ??
    ((args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 8 * 1024 ** 2,
      }));
  // List releases rather than treating arbitrary authentication/network failures as "not found".
  const releases = JSON.parse(
    gh(['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`]),
  ).flat();
  let published = releases.find((r) => r.tag_name === release);
  if (published && !published.draft) {
    log(`Already published https://github.com/${repository}/releases/tag/${release}`);
    return release;
  }
  const releaseDir = join(archiveDir, release);
  const manifestPath = join(releaseDir, MANIFEST);
  if (!(await maybeStat(manifestPath))) await packAssets({ root, outDir: archiveDir, log });
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')), current);
  const paths = new Map();
  for (const archive of manifest.archives) {
    const path = await findArchive(archiveDir, archive);
    if (!path) throw new Error(`Archive missing or corrupt: ${archive.file}; run assets:pack.`);
    paths.set(archive.file, path);
  }
  if (!same(await fileInfo(join(releaseDir, NOTICES)), manifest.notices))
    throw new Error('Asset notices checksum mismatch.');
  paths.set(NOTICES, join(releaseDir, NOTICES));
  paths.set(MANIFEST, manifestPath);
  const uploads = [
    ...manifest.archives,
    manifest.notices,
    { file: MANIFEST, ...(await fileInfo(manifestPath)) },
  ];
  if (!published) {
    const request = join(releaseDir, 'release-request.json');
    await writeFile(
      request,
      json({
        tag_name: release,
        target_commitish: target,
        name: `Molen asset bundle ${current.key.slice(0, 12)}`,
        body: `${manifest.files.length} GLBs built from source at ${target}.\n\nRestore them with \`pnpm assets:fetch\` in any checkout whose asset inputs hash to \`${release}\` (\`node scripts/asset-packs.mjs key\`), or rebuild them with \`pnpm assets:build\`. \`${MANIFEST}\` lists the archives; see ${NOTICES} for licenses.\n\nThese are repository build outputs. Applications use Molen's runtime content packs.\n`,
        draft: true,
        make_latest: 'false',
      }),
    );
    // Use the create response's ID: GitHub's release list can lag behind a new draft.
    published = JSON.parse(
      gh(['api', '--method', 'POST', `repos/${repository}/releases`, '--input', request]),
    );
    if (!published?.draft) throw new Error('Could not create the draft asset release.');
  }
  const listAssets = () =>
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repository}/releases/${published.id}/assets?per_page=100`,
      ]),
    ).flat();
  const remote = listAssets();
  for (const upload of uploads) {
    const existing = remote.find((a) => a.name === upload.file);
    if (existing?.size === upload.size && existing.digest === `sha256:${upload.sha256}`) {
      log(`Already uploaded ${upload.file}`);
      continue;
    }
    if (existing) {
      // An interrupted run's draft may hold another packing of the same files. Drafts are not
      // public, and every attachment is verified again below before the release is published.
      log(`Replacing draft attachment ${upload.file}`);
      gh(['api', '--method', 'DELETE', `repos/${repository}/releases/assets/${existing.id}`]);
    }
    log(`Uploading ${upload.file}`);
    gh(['release', 'upload', release, paths.get(upload.file), '--repo', repository]);
  }
  const uploaded = listAssets();
  const expected = new Set(uploads.map((u) => u.file));
  const extra = uploaded.filter((a) => !expected.has(a.name)).map((a) => a.name);
  if (extra.length) throw new Error(`Draft ${release} has unexpected attachments: ${extra}`);
  for (const file of uploads) {
    const asset = uploaded.find((a) => a.name === file.file);
    if (asset?.size !== file.size || asset?.digest !== `sha256:${file.sha256}`)
      throw new Error(`Uploaded asset integrity check failed: ${file.file}`);
  }
  gh(['release', 'edit', release, '--repo', repository, '--draft=false', '--latest=false']);
  log(`Published https://github.com/${repository}/releases/tag/${release}`);
  return release;
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      'archive-dir': { type: 'string' },
      prefix: { type: 'string' },
      offline: { type: 'boolean' },
      force: { type: 'boolean' },
      'no-build': { type: 'boolean' },
      explain: { type: 'boolean' },
      target: { type: 'string' },
    },
  });
  const root = resolve(values.root ?? ROOT);
  const archiveDir = resolve(values['archive-dir'] ?? join(root, OUTPUT));
  if (positionals.length !== 1)
    throw new Error(
      'Usage: node scripts/asset-packs.mjs key|pack|fetch|seed|check|publish [options]',
    );
  switch (positionals[0]) {
    case 'key': {
      const current = await assetInputs(root);
      console.log(current.release);
      if (values.explain) {
        const stamp = await readStamp(root);
        console.log(
          stamp?.key === current.key
            ? 'The installed bundle matches these inputs.'
            : `Installed: ${stamp?.release ?? 'none'}${explain(stamp, current)}`,
        );
      }
      break;
    }
    case 'pack':
      await packAssets({ root, outDir: archiveDir });
      break;
    case 'fetch':
      try {
        await fetchAssets({
          root,
          archiveDir,
          prefix: values.prefix,
          offline: values.offline,
          force: values.force,
        });
      } catch (error) {
        if (error instanceof ReleaseMissingError && (values['no-build'] || values.prefix)) {
          // Distinct status so CI can build from source instead of failing.
          console.error(error.message);
          process.exitCode = 3;
          return;
        }
        if (!(error instanceof ReleaseMissingError)) throw error;
        console.log(`Warning: ${error.message}\nBuilding the bundle locally.`);
        const { buildAssetsFromSource } = await import('./build-assets.mjs');
        await buildAssetsFromSource({ root, compile: true, force: values.force });
      }
      break;
    case 'seed':
      await seedAssets({ root, archiveDir });
      break;
    case 'check':
      await checkAssets({ root, prefix: values.prefix });
      break;
    case 'publish':
      await publishAssets({ root, archiveDir, target: values.target });
      break;
    default:
      throw new Error('Expected key, pack, fetch, seed, check or publish.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
// Repository GLB bundles. Every GLB except the authored masters is a build output of checked-in
// source (scripts/build-assets.mjs). A bundle is named by the hash of its inputs
// (scripts/asset-inputs.mjs), so nothing pins output bytes: the Assets workflow builds a bundle
// once when the inputs change and publishes it as a GitHub release, `fetch` restores it, and falls
// back to building from source when it is not published yet. A bundle lists its archives wherever
// they are: an archive whose files are unchanged stays in the release that first held it, so
// publishing a bundle uploads what changed. These archives restore repository build outputs; the
// molen/pack@1 pipeline still builds the runtime packs.
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
  rmdir,
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
import { listReleases } from './github-releases.mjs';
import { httpError, retryTransient } from './release-download.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'asset-manifest.json';
// @2 may list archives that another bundle's release holds, and the build's job records.
const MANIFEST_FORMAT = 'molen/asset-bundle@2';
const MANIFEST_FORMATS = ['molen/asset-bundle@1', MANIFEST_FORMAT];
const NOTICES = 'ASSET-NOTICES.txt';
const RECORDS = 'asset-records.tar.gz';
const OUTPUT = '.artifacts/asset-packs';
const BUILD = '.artifacts/asset-build';
// The key and inputs of the build whose job records are beside it, so a later build on another
// machine can start from that bundle (see seedAssets).
export const SEED = `${BUILD}/seed.json`;
// The sidecar changes `check --committed` found, for `git apply`. CI uploads it as an artifact.
export const SIDECAR_PATCH = '.artifacts/asset-build/sidecars.patch';
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
const RELEASE_NAME = /^assets-[a-f0-9]{16}$/;
// What asset-records.tar.gz holds, relative to .artifacts: the job records, the landmark LOD
// reports and seed.json. Nothing else is written from one.
const RECORD_NAME =
  /^(?:asset-build\/seed\.json|asset-build\/jobs\/[a-z0-9][\w.-]*\.json|landmark-lods\/[a-z0-9][\w.-]*\.json)$/i;
// GitHub allows 1,000 attachments to a release.
const MAX_ATTACHMENTS = 990;
// An earlier archive is listed again while at least two thirds of it is still in use. Below that
// a restore would download more dead bytes than repacking its live files costs once.
const MIN_LIVE = 2 / 3;
// How many earlier bundles a source build compares itself with to find the nearest.
const SEED_CANDIDATES = 4;
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
    !MANIFEST_FORMATS.includes(manifest?.format) ||
    manifest.repository !== repository ||
    manifest.key !== key ||
    manifest.release !== release ||
    !Array.isArray(manifest.archives) ||
    !manifest.archives.length ||
    manifest.archives.filter((archive) => archive.release === undefined).length > MAX_ATTACHMENTS
  )
    throw new Error(`Bundle manifest does not describe ${release}.`);
  validateFiles(manifest.files, release);
  if (
    manifest.notices?.file !== NOTICES ||
    !SHA.test(manifest.notices.sha256) ||
    !Number.isSafeInteger(manifest.notices.size)
  )
    throw new Error('Missing asset license notices.');
  const { records } = manifest;
  if (
    records !== undefined &&
    (records.file !== RECORDS ||
      !SHA.test(records.sha256) ||
      !Number.isSafeInteger(records.size) ||
      records.size < 1 ||
      records.size > MAX_FILE)
  )
    throw new Error('Invalid asset job records.');
  const sizes = new Map(manifest.files.map((f) => [f.path, f.size]));
  const covered = new Set();
  const names = new Set();
  for (const archive of manifest.archives) {
    const name = `${archive.release ?? release}/${archive.file}`;
    if (
      !ARCHIVE_NAME.test(archive.file) ||
      names.has(name) ||
      (archive.release !== undefined &&
        (manifest.format !== MANIFEST_FORMAT ||
          !RELEASE_NAME.test(archive.release) ||
          archive.release === release)) ||
      !SHA.test(archive.sha256) ||
      !Number.isSafeInteger(archive.size) ||
      archive.size < 1 ||
      archive.size > MAX_ARCHIVE ||
      !Array.isArray(archive.files) ||
      !archive.files.length
    )
      throw new Error(`Invalid archive: ${archive.file}`);
    names.add(name);
    let expanded = 0;
    for (const path of archive.files) {
      if (!sizes.has(path) || covered.has(path))
        throw new Error(`Bundle archive ${archive.file} lists an unexpected asset: ${path}`);
      covered.add(path);
      expanded += sizes.get(path);
    }
    // `bytes` counts every member; an archive of an earlier bundle may hold files this one changed.
    const bytes = archive.bytes ?? expanded;
    if (!Number.isSafeInteger(bytes) || bytes < expanded)
      throw new Error(`Invalid archive: ${archive.file}`);
    if (bytes > MAX_FILE) throw new Error(`Archive expands beyond 1 GiB: ${archive.file}`);
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

/** The archives a GLB belongs to: its content role and, for a place, its geohash2 region. */
export function archiveGroup(path) {
  const parts = path.split('/');
  const place = path.match(/^content\/worldgen\/(assets|source)\/places\/([^/]+)\//);
  const role = parts[2] === 'assets' ? 'models' : parts[2] === 'source' ? 'sources' : parts[2];
  const label = place
    ? `worldgen-${role}-${place[2]}`
    : parts[0] === 'content'
      ? `${parts[1]}-${parts[3] === 'reusable' ? 'reusable-' : ''}${role}`
      : parts[0] === 'examples'
        ? `${parts[1]}-${parts[2] === 'asset-src' ? 'sources' : parts[2] === 'public' ? 'models' : parts[2]}`
        : parts.slice(0, Math.min(3, parts.length - 1)).join('-');
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function groups(files, budget) {
  const buckets = new Map();
  for (const file of files) {
    const key = archiveGroup(file.path);
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

/** Run `work` over the items, a few at a time. After a failure the running ones finish first. */
async function pool(items, concurrency, work) {
  const queue = [...items];
  const results = [];
  let failed;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      while (queue.length && !failed) {
        try {
          results.push(await work(queue.shift()));
        } catch (error) {
          failed ??= { error };
        }
      }
    }),
  );
  if (failed) throw failed.error;
  return results;
}

/** The valid bundle manifests among `paths`; a partial or foreign one offers nothing to reuse. */
async function readManifests(paths, repository) {
  const manifests = [];
  for (const path of paths) {
    try {
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      manifests.push(validateManifest(manifest, { repository, key: manifest?.key ?? '' }));
    } catch {
      // Skipped.
    }
  }
  return manifests;
}

/** Manifests of releases that GitHub has published: downloaded from one, or by publishing it. */
async function publishedManifests(directory, repository) {
  const published = join(directory, 'published');
  if (!(await maybeStat(published))?.isDirectory()) return [];
  const names = (await readdir(published)).filter((name) => name.endsWith('.json')).sort();
  return readManifests(
    names.map((name) => join(published, name)),
    repository,
  );
}

/**
 * How much of a bundle its predecessors already hold. Archives of published bundles that still
 * hold mostly files of this one are listed again, in the release they are in; the remaining files
 * need new archives. Adding a place then uploads that place, not the rest of its region.
 */
export function carryArchives(files, manifests, { release, budget }) {
  const wanted = new Map(files.map((f) => [f.path, f]));
  const known = new Map();
  for (const manifest of manifests) {
    const members = new Map(manifest.files.map((f) => [f.path, f]));
    const total = (paths) => paths.reduce((sum, path) => sum + members.get(path).size, 0);
    for (const archive of manifest.archives) {
      const holder = archive.release ?? manifest.release;
      if (holder === release) continue; // Never published, or there would be nothing to pack.
      const id = `${holder}/${archive.file}`;
      if (!known.has(id))
        known.set(id, {
          file: archive.file,
          release: holder,
          size: archive.size,
          sha256: archive.sha256,
          bytes: archive.bytes ?? total(archive.files),
          live: new Set(),
        });
      const entry = known.get(id);
      if (entry.sha256 !== archive.sha256) continue;
      for (const path of archive.files)
        if (wanted.has(path) && same(members.get(path), wanted.get(path))) entry.live.add(path);
    }
  }
  const held = (paths) => [...paths].reduce((sum, path) => sum + wanted.get(path).size, 0);
  const covered = new Set();
  let carried = [];
  const fullest = [...known.values()]
    .map((entry) => ({ ...entry, held: held(entry.live) }))
    .sort((a, b) => b.held - a.held || (a.release + a.file < b.release + b.file ? -1 : 1));
  for (const { live, held: most, ...archive } of fullest) {
    if (most < archive.bytes * MIN_LIVE) continue;
    const paths = [...live].filter((path) => !covered.has(path)).sort();
    if (!paths.length || held(paths) < archive.bytes * MIN_LIVE) continue;
    for (const path of paths) covered.add(path);
    carried.push({ ...archive, files: paths });
  }
  // A group that gets a new archive takes its small ones along, so a region that grows a little
  // at a time does not end up in hundreds of them.
  const growing = new Set(
    files.filter((f) => !covered.has(f.path)).map((f) => archiveGroup(f.path)),
  );
  carried = carried.filter((archive) => {
    if (held(archive.files) >= budget / 16 || !growing.has(archiveGroup(archive.files[0])))
      return true;
    for (const path of archive.files) covered.delete(path);
    return false;
  });
  return { carried, rest: files.filter((f) => !covered.has(f.path)) };
}

/** Archives packed here for bundles that were never published, by name, with their members. */
async function localArchives(directory, repository) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true }))
    if (entry.isDirectory() && RELEASE_NAME.test(entry.name))
      paths.push(join(directory, entry.name, MANIFEST));
  const byName = new Map();
  for (const manifest of await readManifests(paths, repository)) {
    const members = new Map(manifest.files.map((f) => [f.path, f]));
    for (const archive of manifest.archives) {
      if (archive.release !== undefined) continue;
      if (!byName.has(archive.file)) byName.set(archive.file, []);
      byName.get(archive.file).push({ archive, members: archive.files.map((p) => members.get(p)) });
    }
  }
  return byName;
}

/**
 * A local archive holding exactly these files with these bytes, verified like a new one. Packing
 * again after an interrupted publish then costs a read instead of a recompression.
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

/**
 * Archive the job records of the build that made this bundle, or nothing when none are here. A
 * build anywhere can then start from the bundle's release alone: the GLBs and what built them.
 */
async function packRecords(root, releaseDir, { key, release, inputs }) {
  const artifacts = join(root, '.artifacts');
  const names = [];
  for (const directory of ['asset-build/jobs', 'landmark-lods']) {
    if (!(await maybeStat(join(artifacts, directory)))?.isDirectory()) continue;
    for (const entry of await readdir(join(artifacts, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isFile() && RECORD_NAME.test(name)) names.push(name);
    }
  }
  if (!names.some((name) => name.startsWith('asset-build/jobs/'))) return undefined;
  await writeFile(join(root, SEED), json({ format: STAMP_FORMAT, key, release, inputs }));
  const file = join(releaseDir, RECORDS);
  await tar.c(
    {
      file,
      cwd: artifacts,
      gzip: { level: 9 },
      portable: true,
      noMtime: true,
      follow: false,
      noDirRecurse: true,
    },
    ['asset-build/seed.json', ...names.sort()],
  );
  return { file: RECORDS, ...(await fileInfo(file)) };
}

/**
 * Archive the installed bundle, exactly as it is on disk, as a publishable release: new archives
 * for the files no published bundle holds, and the list of those that one does.
 */
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
  const { carried, rest } = carryArchives(
    stamp.files,
    await publishedManifests(outDir, repository),
    { release: stamp.release, budget },
  );
  const local = await localArchives(outDir, repository);
  const packed = await pool(groups(rest, budget), concurrency, async (group) => {
    const file = `${group.key}.tar.gz`;
    const reused = await reusableArchive(outDir, local.get(file), group.files, files);
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
  const order = (archive) => `${archive.file}/${archive.release ?? ''}`;
  const archives = [...carried, ...packed].sort((a, b) => (order(a) < order(b) ? -1 : 1));
  const releaseDir = join(outDir, stamp.release);
  await mkdir(releaseDir, { recursive: true });
  const notices = [];
  for (const path of ['LICENSE', 'content/worldgen/NOTICE.md', 'content/entities/NOTICE.md']) {
    if (await maybeStat(join(root, path)))
      notices.push(`--- ${path} ---\n${await readFile(join(root, path), 'utf8')}`);
  }
  if (!notices.length) throw new Error('No asset license notices found.');
  await writeFile(join(releaseDir, NOTICES), notices.join('\n\n'));
  const records = await packRecords(root, releaseDir, stamp);
  const manifest = validateManifest(
    {
      format: MANIFEST_FORMAT,
      repository,
      release: stamp.release,
      key: stamp.key,
      files: stamp.files,
      notices: { file: NOTICES, ...(await fileInfo(join(releaseDir, NOTICES))) },
      ...(records ? { records } : {}),
      archives,
    },
    { repository, key: stamp.key },
  );
  await writeFile(join(releaseDir, MANIFEST), json(manifest));
  const mib = (list) => (list.reduce((sum, a) => sum + a.size, 0) / 1024 ** 2).toFixed(0);
  log(
    `${stamp.files.length} GLBs in ${archives.length} archives for release ${stamp.release}: ${packed.length} new (${mib(packed)} MiB), ${carried.length} in ${new Set(carried.map((a) => a.release)).size} earlier releases (${mib(carried)} MiB)`,
  );
  return manifest;
}

/**
 * What a sidecar gets wrong about the GLBs beside it. `stale`: it records other bytes than the
 * bundle holds, which every pack build rejects. `lods`: runtime LODs it records but does not name
 * in files.variants, where packs look them up.
 */
async function sidecarProblems(root, directory, bundled) {
  const path = `${directory}/asset.json`;
  const sidecar = await readFile(join(root, path), 'utf8').then(JSON.parse, (error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  const problems = { stale: [], lods: [] };
  if (sidecar?.format !== 'molen/asset@1') return problems;
  const stale = [];
  const compare = (file, hash) => {
    const glb = bundled.get(`${directory}/${file}`);
    if (hash && glb && hash !== `sha256:${glb.sha256}`) stale.push(file);
  };
  compare(sidecar.files?.main, sidecar.hash);
  const lods = sidecar.runtimeLods;
  if (lods && lods.masterHash !== sidecar.hash)
    problems.lods.push(`${path}: runtimeLods were derived from another master`);
  for (const level of lods?.levels ?? []) {
    compare(level.file, level.hash);
    if (sidecar.files?.variants?.[level.name] !== level.file)
      problems.lods.push(`${path}: files.variants.${level.name} must name ${level.file}`);
  }
  if (stale.length) problems.stale.push(`${path}: records other bytes than ${stale.join(', ')}`);
  return problems;
}

/** Committed sidecars whose content on disk differs from the commit, and those changes as a patch. */
function changedSidecars(root) {
  const diff = (...options) =>
    execFileSync(
      'git',
      [
        'diff',
        '--no-ext-diff',
        ...options,
        'HEAD',
        '--',
        ...ASSET_ROOTS.map((name) => `:(glob)${name}/**/asset.json`),
      ],
      { cwd: root, maxBuffer: MAX_FILE, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  const paths = diff('--name-only', '-z').toString().split('\0').filter(Boolean);
  return { paths, patch: paths.length ? diff('--binary') : undefined };
}

/**
 * The installed GLBs are this checkout's bundle: its inputs' key, with every file intact and every
 * sidecar describing them. `committed` also requires those sidecars to be the committed ones. A
 * source build rewrites the sidecar of each GLB it builds differently, so without it such a build
 * is compared with its own edits, while a clean checkout that installs the bundle has the commit's.
 */
export async function checkAssets({
  root = ROOT,
  prefix = '',
  committed = false,
  log = console.log,
} = {}) {
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
  const bundled = new Map(stamp.files.map((f) => [f.path, f]));
  const stale = [];
  const lods = [];
  for (const directory of new Set(files.map((f) => dirname(f.path)))) {
    const problems = await sidecarProblems(root, directory, bundled);
    stale.push(...problems.stale);
    lods.push(...problems.lods);
  }
  if (stale.length)
    errors.push(
      ...stale,
      'Commit each of these sidecars with the change that rebuilt its GLB. The CI run that built the bundle has them as its asset-sidecars artifact; locally, pnpm assets:build rewrites them.',
    );
  if (lods.length)
    errors.push(
      ...lods,
      'Regenerate their LOD metadata: node packages/tooling/scripts/generate-landmark-lods.mjs',
    );
  if (errors.length) throw new Error(errors.join('\n'));
  if (committed) {
    const file = join(root, SIDECAR_PATCH);
    const { paths, patch } = changedSidecars(root);
    if (paths.length) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, patch);
      throw new Error(
        `The build changed these committed sidecars, and a checkout that installs its bundle still has the old ones:\n${paths.join('\n')}\nReview the changes and commit them. They are in ${SIDECAR_PATCH}; from CI:\ngh run download ${process.env.GITHUB_RUN_ID ?? '<run id>'} -n asset-sidecars && git apply sidecars.patch`,
      );
    }
    await rm(file, { force: true });
  }
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

/** One attempt at an archive: a dropped connection leaves nothing behind for the next one. */
async function download(url, path, expected, fetchImpl) {
  const temporary = `${path}.${randomUUID()}.part`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw httpError(`Asset download failed: HTTP ${response.status} ${url}`, response.status);
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

/** A release's manifest text, or undefined when GitHub has no such release attachment. */
function manifestText(release, fetchImpl, { label, log, retry }) {
  return retryTransient(
    async () => {
      const response = await fetchImpl(releaseUrl(release, MANIFEST), {
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 404) return undefined;
      if (!response.ok)
        throw httpError(
          `${label} manifest download failed: HTTP ${response.status}`,
          response.status,
        );
      return await response.text();
    },
    { what: `${label} manifest of ${release.release}`, log, ...retry },
  );
}

async function releaseManifest(current, archiveDir, offline, fetchImpl, { log, retry } = {}) {
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
  const text = await manifestText(current, fetchImpl, { label: 'Bundle', log, retry });
  if (text === undefined)
    throw new ReleaseMissingError(
      `Bundle ${current.release} is not published yet. CI publishes it once these inputs reach main.`,
    );
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
  keepArchives = true,
  prefix = '',
  fetchImpl = fetch,
  retry,
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
  const manifest = await releaseManifest(current, archiveDir, offline, fetchImpl, { log, retry });
  const { files, restored } = await installBundle({
    root,
    archiveDir,
    manifest,
    previous: stamp,
    matchesLocalFile,
    offline,
    force,
    keepArchives,
    prefix,
    fetchImpl,
    retry,
    log,
  });
  await writeStamp(root, { ...current, from: 'fetch', prefix, files });
  log(`Ready: ${files.length} GLBs of ${current.release} (${restored} restored).`);
  return files.length;
}

/** Move a file, replacing the destination in one step where the disk allows it. */
async function moveFile(from, to) {
  try {
    await rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    const temporary = `${to}.${randomUUID()}.part`;
    try {
      await copyFile(from, temporary);
      await rename(temporary, to);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

/** An attachment of a bundle's release, or of the earlier release that holds it, on disk. */
async function localAttachment(
  attachment,
  manifest,
  { archiveDir, offline, fetchImpl, retry, log },
) {
  const found = await findArchive(archiveDir, attachment);
  if (found) return found;
  if (offline) throw new Error(`Offline archive missing or corrupt: ${attachment.file}`);
  log(`Downloading ${attachment.file}`);
  const path = archivePath(archiveDir, attachment);
  await mkdir(dirname(path), { recursive: true });
  // A bundle is hundreds of archives: one dropped connection must not cost the whole restore.
  const url = releaseUrl(
    { repository: manifest.repository, release: attachment.release ?? manifest.release },
    attachment.file,
  );
  await retryTransient(() => download(url, path, attachment, fetchImpl), {
    what: `Download of ${attachment.file}`,
    log,
    ...retry,
  });
  return path;
}

/**
 * Put `manifest`'s GLBs (those under `prefix`) on disk: keep files whose bytes already match,
 * restore the rest from cached or downloaded archives, and remove outputs of the `previous`
 * bundle that this one no longer has. Local work outside both bundles stays. An archive's own hash
 * is checked when it is found or downloaded and every file's before it is moved into place, so
 * members this bundle does not list (dead files of a carried archive) are never written.
 */
async function installBundle({
  root,
  archiveDir,
  manifest,
  previous,
  matchesLocalFile,
  offline,
  force,
  keepArchives = true,
  prefix = '',
  concurrency = Math.min(4, availableParallelism()),
  fetchImpl,
  retry,
  log,
}) {
  const files = manifest.files.filter((f) => f.path.startsWith(prefix));
  if (!files.length) throw new Error(`No assets match prefix: ${prefix}`);
  const byPath = new Map(manifest.files.map((f) => [f.path, f]));
  const wanted = new Set();
  for (const file of files) if (force || !(await matchesLocalFile(file))) wanted.add(file.path);
  const staging = join(root, OUTPUT, 'staging');
  await mkdir(staging, { recursive: true });
  const restore = manifest.archives
    .map((archive) => [archive, archive.files.filter((path) => wanted.has(path))])
    .filter(([, paths]) => paths.length);
  let restored = 0;
  await pool(restore, concurrency, async ([archive, paths]) => {
    const path = await localAttachment(archive, manifest, {
      archiveDir,
      offline,
      fetchImpl,
      retry,
      log,
    });
    const stage = await mkdtemp(join(staging, 'restore-'));
    try {
      const names = new Set(paths);
      await tar.x({
        file: path,
        cwd: stage,
        strict: true,
        noMtime: true,
        filter: (name, entry) => names.has(name) && entry.type === 'File',
      });
      const staged = paths.map((name) => ({ file: byPath.get(name), path: join(stage, name) }));
      for (const { file, path: extracted } of staged) {
        const info = (await maybeStat(extracted))?.isFile() ? await fileInfo(extracted) : undefined;
        if (!same(info, file)) throw new Error(`Extracted checksum mismatch: ${file.path}`);
      }
      for (const { file, path: extracted } of staged) {
        const destination = await localPath(root, file.path);
        await mkdir(dirname(destination), { recursive: true });
        await moveFile(extracted, destination);
      }
      restored += paths.length;
      log(`Restored ${paths.length} GLBs from ${archive.file}`);
    } finally {
      await removeStage(stage, staging);
    }
    // A CI runner's disk holds the GLBs or the archives comfortably, not both.
    if (!keepArchives) {
      await rm(path, { force: true });
      // Downloads live alone at <sha256>/<file> (archivePath).
      if (path === archivePath(archiveDir, archive)) await rmdir(dirname(path));
    }
  });
  // Outputs of the previous bundle that this one no longer has are stale; local work stays.
  if (!prefix && previous && !previous.prefix)
    for (const file of previous.files)
      if (!byPath.has(file.path)) await rm(await localPath(root, file.path), { force: true });
  return { files, restored };
}

/**
 * Sidecars in this checkout that do not describe the published bundle for its inputs, without
 * restoring a GLB: the manifest has every hash. A commit that changed sidecars only, or kept ones
 * a build rewrote, fails in seconds instead of in every job that pairs them with the bundle.
 */
export async function checkPublishedSidecars({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  manifest,
  fetchImpl = fetch,
  retry,
  log = console.log,
} = {}) {
  manifest ??= await releaseManifest(await assetInputs(root), archiveDir, false, fetchImpl, {
    log,
    retry,
  });
  const bundled = new Map(manifest.files.map((f) => [f.path, f]));
  const errors = [];
  for (const directory of new Set(manifest.files.map((f) => dirname(f.path)))) {
    const { stale, lods } = await sidecarProblems(root, directory, bundled);
    errors.push(...stale, ...lods);
  }
  if (errors.length)
    throw new Error(
      `These committed sidecars do not describe ${manifest.release}, the bundle of this checkout's inputs:\n${errors.join('\n')}\nCommit the sidecars of the build that made it: the run that built it has them as its asset-sidecars artifact; locally, pnpm assets:build rewrites them.`,
    );
  log(`The committed sidecars describe ${manifest.release}.`);
  return manifest;
}

/** Whether GitHub has published the bundle for this checkout's inputs. */
export async function bundleState({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  fetchImpl = fetch,
  retry,
  log = console.error,
} = {}) {
  const current = await assetInputs(root);
  try {
    const manifest = await releaseManifest(current, archiveDir, false, fetchImpl, { log, retry });
    return { release: current.release, published: true, manifest };
  } catch (error) {
    if (!(error instanceof ReleaseMissingError)) throw error;
    return { release: current.release, published: false };
  }
}

/** The published bundles, newest first, and whether each has its build's job records. */
async function publishedBundles(repository, fetchImpl, { log, retry } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  // Giving up here means a build from nothing, so a busy API is worth waiting for.
  const releases = await retryTransient(
    async () => {
      const response = await fetchImpl(
        `https://api.github.com/repos/${repository}/releases?per_page=100`,
        { headers, signal: AbortSignal.timeout(60_000) },
      );
      if (!response.ok)
        throw httpError(
          `Listing ${repository} releases failed: HTTP ${response.status}`,
          response.status,
        );
      return await response.json();
    },
    { what: `Listing ${repository} releases`, log, ...retry },
  );
  const has = (release, name) => release.assets?.some((asset) => asset.name === name) ?? false;
  return releases
    .filter(
      (release) => !release.draft && RELEASE_NAME.test(release.tag_name) && has(release, MANIFEST),
    )
    .sort((a, b) =>
      a.published_at < b.published_at ? 1 : a.published_at > b.published_at ? -1 : 0,
    )
    .map((release) => ({ release: release.tag_name, recorded: has(release, RECORDS) }));
}

/** A published bundle's manifest, or undefined when GitHub no longer has it. */
async function seedManifest(release, repository, archiveDir, fetchImpl, options = {}) {
  const check = (manifest) => {
    validateManifest(manifest, { repository, key: manifest?.key ?? '' });
    if (manifest.release !== release) throw new Error(`Seed manifest is not ${release}.`);
    return manifest;
  };
  const published = join(archiveDir, 'published', `${release}.json`);
  if (await maybeStat(published)) return check(JSON.parse(await readFile(published, 'utf8')));
  const text = await manifestText({ repository, release }, fetchImpl, {
    label: 'Seed',
    ...options,
  });
  if (text === undefined) return undefined;
  const manifest = check(JSON.parse(text));
  await mkdir(dirname(published), { recursive: true });
  await writeFile(published, text);
  return manifest;
}

const isSeed = (seed) =>
  seed?.format === STAMP_FORMAT && SHA.test(seed.key ?? '') && Array.isArray(seed.inputs);

/** The seed.json of a records archive. */
async function seedIn(path) {
  const chunks = [];
  await tar.t({
    file: path,
    strict: true,
    onReadEntry(entry) {
      if (entry.path === 'asset-build/seed.json') entry.on('data', (bytes) => chunks.push(bytes));
    },
  });
  const seed = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
  if (!isSeed(seed)) throw new Error(`No seed in ${path}.`);
  return seed;
}

/** Replace this checkout's job records with a records archive's. */
async function restoreRecords(root, path) {
  const artifacts = join(root, '.artifacts');
  await rm(join(root, BUILD, 'jobs'), { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  await tar.x({
    file: path,
    cwd: artifacts,
    strict: true,
    noMtime: true,
    filter: (name, entry) => entry.type === 'File' && RECORD_NAME.test(name),
  });
}

/**
 * Before a source build on a machine with no GLBs (a CI runner), install an earlier bundle and the
 * job records that built it, so the build reruns only jobs whose recorded inputs or outputs
 * differ instead of all of them. Of the newest published bundles, the one whose inputs differ
 * least from this checkout's is the one that leaves least to build: a pull request's own last
 * bundle, else main's. Any bundle is a safe seed: records are checked against the bytes on disk,
 * so a GLB the seed got wrong only means its job runs. Returns the release installed, if any.
 */
export async function seedAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  keepArchives = true,
  fetchImpl = fetch,
  retry,
  log = console.log,
} = {}) {
  const current = await assetInputs(root);
  const { repository } = current;
  const options = { log, retry };
  let releases = [];
  try {
    releases = await publishedBundles(repository, fetchImpl, options);
  } catch (error) {
    log(`Warning: ${error.message}`);
  }
  // Job records restored by other means (an Actions cache) describe one of these bundles too.
  let cached;
  try {
    cached = JSON.parse(await readFile(join(root, SEED), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  const candidates = [];
  for (const { release, recorded } of releases) {
    const here = isSeed(cached) && release === `assets-${cached.key.slice(0, 16)}`;
    if (candidates.length >= SEED_CANDIDATES && !here) continue;
    const candidate = { release, inputs: here ? cached.inputs : undefined };
    if (recorded) {
      // A candidate that cannot be read is passed over, never a reason to fail the build.
      try {
        const manifest = await seedManifest(release, repository, archiveDir, fetchImpl, options);
        candidate.records = await localAttachment(manifest.records, manifest, {
          archiveDir,
          fetchImpl,
          ...options,
        });
        candidate.inputs = (await seedIn(candidate.records)).inputs;
      } catch (error) {
        log(`Warning: ${release} has no usable job records: ${error.message}`);
        candidate.records = undefined;
      }
    }
    candidate.distance = candidate.inputs
      ? changedInputs(candidate.inputs, current.inputs).length
      : Number.POSITIVE_INFINITY;
    candidates.push(candidate);
  }
  // Stable: among equals, and among bundles with no records, the newest.
  candidates.sort((a, b) => (a.distance === b.distance ? 0 : a.distance - b.distance));
  for (const { release, records, inputs, distance } of candidates) {
    let manifest;
    try {
      manifest = await seedManifest(release, repository, archiveDir, fetchImpl, options);
    } catch (error) {
      log(`Warning: ${release} cannot seed this build: ${error.message}`);
    }
    if (!manifest) continue;
    let files;
    let restored;
    try {
      ({ files, restored } = await installBundle({
        root,
        archiveDir,
        manifest,
        previous: await readStamp(root),
        matchesLocalFile: localMatcher(root),
        offline: false,
        force: false,
        keepArchives,
        fetchImpl,
        retry,
        log,
      }));
    } catch (error) {
      // An archive that is gone rules this bundle out. A network that keeps failing fails the job:
      // building everything from nothing would cost hours instead of a rerun.
      if (error.status !== 404) throw error;
      log(`Warning: ${release} cannot seed this build: ${error.message}`);
      continue;
    }
    if (records) await restoreRecords(root, records);
    await writeStamp(root, {
      key: manifest.key,
      release: manifest.release,
      from: 'seed',
      prefix: '',
      inputs: inputs ?? [],
      files,
    });
    log(
      `Seeded with ${files.length} GLBs of ${release} (${inputs ? `${distance} inputs differ` : 'without job records, the newest published bundle'}; ${restored} restored).`,
    );
    return release;
  }
  await clearStamp(root);
  log('No earlier bundle to start from: the build runs every job.');
}

/**
 * Delete the cached archives that the bundle for this checkout's inputs does not use. Nothing is
 * removed unless that bundle's manifest is here to say what it uses.
 */
export async function pruneArchives({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  log = console.log,
} = {}) {
  const current = await assetInputs(root);
  // A local packing and the published release can hold different bytes for the same bundle.
  const used = new Set();
  let manifests = 0;
  for (const path of [
    join(archiveDir, current.release, MANIFEST),
    join(archiveDir, 'published', `${current.release}.json`),
  ]) {
    if (!(await maybeStat(path))) continue;
    const manifest = validateManifest(JSON.parse(await readFile(path, 'utf8')), current);
    for (const archive of manifest.archives) used.add(archive.sha256);
    manifests++;
  }
  if (!manifests) {
    log(`No manifest of ${current.release} in ${archiveDir}: no archives removed.`);
    return { removed: 0, bytes: 0 };
  }
  let removed = 0;
  let bytes = 0;
  for (const entry of await readdir(archiveDir, { withFileTypes: true })) {
    // Archives live at <sha256>/<file> (archivePath); manifests and stamps are left alone.
    if (!entry.isDirectory() || !SHA.test(entry.name) || used.has(entry.name)) continue;
    const directory = join(archiveDir, entry.name);
    for (const file of await readdir(directory, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      bytes += (await lstat(join(directory, file.name))).size;
      removed++;
    }
    await removeStage(directory, archiveDir);
  }
  log(
    `Removed ${removed} archives of other bundles (${(bytes / 1024 ** 2).toFixed(0)} MiB); ${current.release} uses ${used.size}.`,
  );
  return { removed, bytes };
}

/** The GitHub CLI, trying again when the network or a busy server failed a repeatable call. */
function githubCli() {
  const transient =
    /HTTP (?:408|425|429|5\d\d)|connection reset|connection refused|timeout|timed out|TLS handshake|unexpected EOF|i\/o error|no such host/i;
  return (args) => {
    const creates = args.includes('POST');
    for (let attempt = 1; ; attempt++) {
      try {
        // A second upload replaces what a broken first one left.
        const again = attempt > 1 && args[1] === 'upload' ? ['--clobber'] : [];
        return execFileSync('gh', [...args, ...again], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 64 * 1024 ** 2,
        });
      } catch (error) {
        if (creates || attempt >= 4 || !transient.test(String(error.stderr))) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 10_000);
      }
    }
  };
}

/**
 * Publish the packed bundle for this checkout's inputs as the release it names: its manifest, its
 * job records and the archives no earlier release holds. An already published bundle is left
 * alone: its archives were verified when they went up, and later bundles may list them.
 */
export async function publishAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  builtFrom = target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing 40-character GitHub commit SHA>.');
  const current = await assetInputs(root);
  const { repository, release } = current;
  const gh = runGh ?? githubCli();
  // List releases rather than treating arbitrary authentication/network failures as "not found".
  const releases = listReleases(gh, repository);
  let published = releases.find((r) => r.tag_name === release);
  if (published && !published.draft) {
    log(`Already published https://github.com/${repository}/releases/tag/${release}`);
    return release;
  }
  const releaseDir = join(archiveDir, release);
  const manifestPath = join(releaseDir, MANIFEST);
  if (!(await maybeStat(manifestPath))) await packAssets({ root, outDir: archiveDir, log });
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')), current);
  const own = manifest.archives.filter((archive) => archive.release === undefined);
  const carried = manifest.archives.filter((archive) => archive.release !== undefined);
  const paths = new Map();
  for (const archive of own) {
    const path = await findArchive(archiveDir, archive);
    if (!path) throw new Error(`Archive missing or corrupt: ${archive.file}; run assets:pack.`);
    paths.set(archive.file, path);
  }
  for (const attachment of [manifest.notices, manifest.records]) {
    if (!attachment) continue;
    const path = join(releaseDir, attachment.file);
    if (!(await maybeStat(path)) || !same(await fileInfo(path), attachment))
      throw new Error(`${attachment.file} checksum mismatch; run assets:pack.`);
    paths.set(attachment.file, path);
  }
  paths.set(MANIFEST, manifestPath);
  const uploads = [
    ...own,
    manifest.notices,
    ...(manifest.records ? [manifest.records] : []),
    { file: MANIFEST, ...(await fileInfo(manifestPath)) },
  ];
  const listAssets = (id) =>
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repository}/releases/${id}/assets?per_page=100`,
      ]),
    ).flat();
  const matches = (asset, file) =>
    asset?.size === file.size && asset.digest === `sha256:${file.sha256}`;
  // A bundle must not go out naming an archive that a restore will not find.
  for (const holder of new Set(carried.map((archive) => archive.release))) {
    const earlier = releases.find((r) => r.tag_name === holder && !r.draft);
    const attachments = new Map((earlier ? listAssets(earlier.id) : []).map((a) => [a.name, a]));
    for (const archive of carried.filter((a) => a.release === holder))
      if (!matches(attachments.get(archive.file), archive))
        throw new Error(
          `${holder} no longer holds ${archive.file}; remove ${join(archiveDir, 'published', `${holder}.json`)} and run assets:pack.`,
        );
  }
  if (!published) {
    const request = join(releaseDir, 'release-request.json');
    await writeFile(
      request,
      json({
        tag_name: release,
        target_commitish: target,
        name: `Molen asset bundle ${current.key.slice(0, 12)}`,
        body: `${manifest.files.length} GLBs built from source at ${builtFrom}.\n\nRestore them with \`pnpm assets:fetch\` in any checkout whose asset inputs hash to \`${release}\` (\`node scripts/asset-packs.mjs key\`), or rebuild them with \`pnpm assets:build\`. \`${MANIFEST}\` lists the archives, ${own.length} here and ${carried.length} in earlier releases; see ${NOTICES} for licenses. Later bundles list archives of this release: do not delete it.\n\nThese are repository build outputs. Applications use Molen's runtime content packs.\n`,
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
  const remote = listAssets(published.id);
  for (const upload of uploads) {
    const existing = remote.find((a) => a.name === upload.file);
    if (matches(existing, upload)) {
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
  const expected = new Set(uploads.map((u) => u.file));
  let uploaded = listAssets(published.id);
  // An interrupted packing with other archives may have uploaded some this one does not have.
  for (const stray of uploaded.filter((a) => !expected.has(a.name))) {
    if (!ARCHIVE_NAME.test(stray.name) && stray.name !== RECORDS) continue;
    log(`Removing draft attachment ${stray.name}`);
    gh(['api', '--method', 'DELETE', `repos/${repository}/releases/assets/${stray.id}`]);
    uploaded = uploaded.filter((a) => a !== stray);
  }
  const extra = uploaded.filter((a) => !expected.has(a.name)).map((a) => a.name);
  if (extra.length) throw new Error(`Draft ${release} has unexpected attachments: ${extra}`);
  for (const file of uploads) {
    if (
      !matches(
        uploaded.find((a) => a.name === file.file),
        file,
      )
    )
      throw new Error(`Uploaded asset integrity check failed: ${file.file}`);
  }
  gh(['release', 'edit', release, '--repo', repository, '--draft=false', '--latest=false']);
  // The next bundle packed here can list these archives.
  await mkdir(join(archiveDir, 'published'), { recursive: true });
  await copyFile(manifestPath, join(archiveDir, 'published', `${release}.json`));
  log(`Published https://github.com/${repository}/releases/tag/${release}`);
  return release;
}

/** What `pnpm assets:build --compile` does: compile, drop records of older engine code, build. */
async function buildMissing(root, force) {
  const { spawnCommand } = await import('./exec-command.mjs');
  const compiled = spawnCommand('pnpm', ['-r', '--filter', './packages/**', 'exec', 'tsdown'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (compiled.status !== 0) throw new Error('Package compilation failed.');
  const { expireEngineJobs } = await import('./asset-engine.mjs');
  await expireEngineJobs(root);
  const { buildAssetsFromSource } = await import('./build-assets.mjs');
  await buildAssetsFromSource({ root, force });
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
      'no-cache': { type: 'boolean' },
      check: { type: 'boolean' },
      explain: { type: 'boolean' },
      committed: { type: 'boolean' },
      published: { type: 'boolean' },
      target: { type: 'string' },
      'built-from': { type: 'string' },
    },
  });
  const root = resolve(values.root ?? ROOT);
  const archiveDir = resolve(values['archive-dir'] ?? join(root, OUTPUT));
  if (positionals.length !== 1)
    throw new Error(
      'Usage: node scripts/asset-packs.mjs key|state|pack|fetch|seed|prune|check|publish [options]',
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
    case 'state': {
      // Two lines for $GITHUB_OUTPUT; everything else goes to stderr. Hashing the inputs takes a
      // minute, so `--check` compares the sidecars with the bundle in the same run.
      const { release, published, manifest } = await bundleState({ root, archiveDir });
      console.log(`release=${release}\npublished=${published}`);
      if (values.check && published)
        await checkPublishedSidecars({ root, manifest, log: console.error });
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
          keepArchives: !values['no-cache'],
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
        await buildMissing(root, values.force);
      }
      break;
    case 'seed':
      await seedAssets({ root, archiveDir, keepArchives: !values['no-cache'] });
      break;
    case 'prune':
      await pruneArchives({ root, archiveDir });
      break;
    case 'check':
      if (values.published) await checkPublishedSidecars({ root, archiveDir });
      else await checkAssets({ root, prefix: values.prefix, committed: values.committed });
      break;
    case 'publish':
      await publishAssets({
        root,
        archiveDir,
        target: values.target,
        builtFrom: values['built-from'],
      });
      break;
    default:
      throw new Error('Expected key, state, pack, fetch, seed, prune, check or publish.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
